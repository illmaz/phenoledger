CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- already enabled in Supabase; explicit here for local dev

-- All tables carry farm_id as the RLS boundary.

CREATE TABLE farms (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    country     TEXT NOT NULL DEFAULT 'TH',
    timezone    TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    gacp_cert_number TEXT,           -- Thai GACP cert from DTAM
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ          -- soft delete for GDPR
);

ALTER TABLE farms ENABLE ROW LEVEL SECURITY;

-- farms policy is defined after farm_users — it references that table in its subquery

CREATE TABLE farm_users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id     UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'viewer',  -- 'owner' | 'analyst' | 'viewer'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(farm_id, user_id)
);

ALTER TABLE farm_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farm_users: own rows only"
ON farm_users
FOR ALL
USING (user_id = auth.uid());

CREATE POLICY "farms: owner access only"
ON farms
FOR ALL
USING (
    id IN (
        SELECT farm_id FROM farm_users
        WHERE user_id = auth.uid()
    )
);

CREATE TABLE strains (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    internal_code   TEXT,
    phenotype_notes TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(farm_id, name)
);

ALTER TABLE strains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "strains: farm members only"
ON strains
FOR ALL
USING (
    farm_id IN (
        SELECT farm_id FROM farm_users
        WHERE user_id = auth.uid()
    )
);

CREATE TABLE batches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    strain_id       UUID REFERENCES strains(id) ON DELETE SET NULL,
    batch_number    TEXT NOT NULL,
    harvest_date    DATE,
    grow_type       TEXT,           -- 'indoor' | 'outdoor' | 'greenhouse'
    grow_medium     TEXT,           -- 'soil' | 'hydro' | 'coco'
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(farm_id, batch_number)
);

ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "batches: farm members only"
ON batches
FOR ALL
USING (
    farm_id IN (
        SELECT farm_id FROM farm_users
        WHERE user_id = auth.uid()
    )
);

CREATE TABLE coa_uploads (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id             UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    batch_id            UUID REFERENCES batches(id) ON DELETE SET NULL,

    -- Never store the full S3 URL; build pre-signed URLs at runtime
    s3_bucket           TEXT NOT NULL,
    s3_key              TEXT NOT NULL,   -- e.g. "farms/{farm_id}/coas/{uuid}.pdf"
    original_filename   TEXT NOT NULL,
    file_size_bytes     BIGINT,

    extraction_status   TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'extracting' | 'needs_review' | 'confirmed' | 'failed'
    extraction_engine   TEXT,           -- 'textract' | 'pdfplumber'
    extraction_raw_json JSONB,          -- unmodified output; normalisation happens downstream
    extraction_error    TEXT,
    extracted_at        TIMESTAMPTZ,
    confirmed_at        TIMESTAMPTZ,
    confirmed_by        UUID REFERENCES auth.users(id),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE coa_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coa_uploads: farm members only"
ON coa_uploads
FOR ALL
USING (
    farm_id IN (
        SELECT farm_id FROM farm_users
        WHERE user_id = auth.uid()
    )
);

CREATE TABLE coa_reports (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id             UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    upload_id           UUID NOT NULL REFERENCES coa_uploads(id) ON DELETE CASCADE,
    batch_id            UUID REFERENCES batches(id) ON DELETE SET NULL,

    lab_name            TEXT,
    lab_license_number  TEXT,
    lab_country         TEXT,

    sample_name         TEXT,
    sample_type         TEXT,           -- 'flower' | 'concentrate' | 'extract' | 'pre-roll'
    reported_batch_number TEXT,
    collection_date     DATE,
    received_date       DATE,
    report_date         DATE,

    overall_pass_fail   TEXT,           -- 'PASS' | 'FAIL' | 'INCONCLUSIVE'

    -- Denormalised for fast queries and dbt aggregations; source of truth is cannabinoid_results
    total_thc_pct           NUMERIC(8,4),
    total_cbd_pct           NUMERIC(8,4),
    total_cannabinoids_pct  NUMERIC(8,4),
    moisture_pct            NUMERIC(8,4),
    water_activity          NUMERIC(8,4),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE coa_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coa_reports: farm members only"
ON coa_reports
FOR ALL
USING (
    farm_id IN (
        SELECT farm_id FROM farm_users
        WHERE user_id = auth.uid()
    )
);

CREATE TABLE cannabinoid_results (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    report_id       UUID NOT NULL REFERENCES coa_reports(id) ON DELETE CASCADE,

    compound_name   TEXT NOT NULL,      -- canonical form: "THCA", "CBD", "CBG"
    compound_raw    TEXT,               -- as printed on the COA, e.g. "Δ9-THCA"

    -- Both raw and normalised are stored; value_pct is computed by dbt
    value_raw       NUMERIC(12,6),
    unit_raw        TEXT,               -- "%", "mg/g", "mg/mL"
    value_pct       NUMERIC(8,4),

    lod             NUMERIC(12,6),
    loq             NUMERIC(12,6),
    pass_fail       TEXT,               -- 'PASS' | 'FAIL' | 'ND'

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cannabinoid_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cannabinoid_results: farm members only"
ON cannabinoid_results
FOR ALL
USING (
    farm_id IN (
        SELECT farm_id FROM farm_users
        WHERE user_id = auth.uid()
    )
);

-- Covers the common query shape: all compounds for a report, filtered by name
CREATE INDEX idx_cannabinoid_results_report
ON cannabinoid_results(report_id, compound_name);

CREATE TABLE terpene_results (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    report_id       UUID NOT NULL REFERENCES coa_reports(id) ON DELETE CASCADE,
    compound_name   TEXT NOT NULL,
    compound_raw    TEXT,
    value_raw       NUMERIC(12,6),
    unit_raw        TEXT,
    value_pct       NUMERIC(8,4),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE terpene_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terpene_results: farm members only"
ON terpene_results
FOR ALL
USING (
    farm_id IN (
        SELECT farm_id FROM farm_users
        WHERE user_id = auth.uid()
    )
);

CREATE TABLE contaminant_results (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    report_id       UUID NOT NULL REFERENCES coa_reports(id) ON DELETE CASCADE,

    panel           TEXT NOT NULL,      -- 'pesticides' | 'heavy_metals' | 'microbials' | 'solvents'
    compound_name   TEXT NOT NULL,
    compound_raw    TEXT,
    value_raw       NUMERIC(12,6),
    unit_raw        TEXT,
    action_limit    NUMERIC(12,6),
    pass_fail       TEXT NOT NULL,      -- 'PASS' | 'FAIL' | 'ND'

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE contaminant_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contaminant_results: farm members only"
ON contaminant_results
FOR ALL
USING (
    farm_id IN (
        SELECT farm_id FROM farm_users
        WHERE user_id = auth.uid()
    )
);

CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    farm_id         UUID,               -- nullable: pre-auth events have no farm context
    user_id         UUID,
    event_type      TEXT NOT NULL,
    -- 'coa.upload' | 'coa.access' | 'coa.delete' | 'farm.created'
    -- 'user.login' | 'data.export' | 'farm.deletion_requested'
    resource_type   TEXT,               -- 'coa_upload' | 'farm' | etc.
    resource_id     UUID,
    metadata        JSONB,              -- flexible: IP, user agent, filename, etc.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only: no UPDATE or DELETE policies are defined
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log: farm members can read their own"
ON audit_log
FOR SELECT
USING (
    farm_id IN (
        SELECT farm_id FROM farm_users
        WHERE user_id = auth.uid()
    )
);

-- WITH CHECK (true) here; actual write restriction is enforced at the role level:
-- revoke INSERT from anon and authenticated, grant only to service_role
CREATE POLICY "audit_log: service role insert only"
ON audit_log
FOR INSERT
WITH CHECK (true);

-- dbt owns this table — do not hand-code it here.
-- Supabase exposes materialised views via the PostgREST API automatically.
-- CREATE MATERIALIZED VIEW batch_consistency_scores AS ...
