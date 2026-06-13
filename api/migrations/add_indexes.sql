-- PhenoLedger — Performance Indexes (Phase 5-12 tables)
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- All statements use IF NOT EXISTS so they are safe to re-run.

-- ── batch_records ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_batch_records_farm_id
    ON batch_records (farm_id);

CREATE INDEX IF NOT EXISTS idx_batch_records_strain_id
    ON batch_records (strain_id);

CREATE INDEX IF NOT EXISTS idx_batch_records_status
    ON batch_records (status);

-- Composite: primary list query pattern — filter by farm, look up by code
CREATE INDEX IF NOT EXISTS idx_batch_records_farm_batch_code
    ON batch_records (farm_id, batch_code);

-- ── input_records ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_input_records_farm_id
    ON input_records (farm_id);

CREATE INDEX IF NOT EXISTS idx_input_records_batch_record_id
    ON input_records (batch_record_id);

CREATE INDEX IF NOT EXISTS idx_input_records_input_date
    ON input_records (input_date);

-- ── sops ──────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sops_farm_id
    ON sops (farm_id);

CREATE INDEX IF NOT EXISTS idx_sops_status
    ON sops (status);

-- ── sop_acknowledgments ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sop_acknowledgments_farm_id
    ON sop_acknowledgments (farm_id);

CREATE INDEX IF NOT EXISTS idx_sop_acknowledgments_sop_id
    ON sop_acknowledgments (sop_id);

-- ── environmental_logs ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_environmental_logs_farm_id
    ON environmental_logs (farm_id);

CREATE INDEX IF NOT EXISTS idx_environmental_logs_grow_room_id
    ON environmental_logs (grow_room_id);

CREATE INDEX IF NOT EXISTS idx_environmental_logs_log_date
    ON environmental_logs (log_date);

-- ── grow_rooms ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_grow_rooms_farm_id
    ON grow_rooms (farm_id);

-- ── staff_members ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_staff_members_farm_id
    ON staff_members (farm_id);

CREATE INDEX IF NOT EXISTS idx_staff_members_status
    ON staff_members (status);

-- ── staff_training ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_staff_training_farm_id
    ON staff_training (farm_id);

CREATE INDEX IF NOT EXISTS idx_staff_training_staff_id
    ON staff_training (staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_training_sop_id
    ON staff_training (sop_id);

-- ── visitor_log ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_visitor_log_farm_id
    ON visitor_log (farm_id);

CREATE INDEX IF NOT EXISTS idx_visitor_log_visit_date
    ON visitor_log (visit_date);

-- ── harvest_sales ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_harvest_sales_farm_id
    ON harvest_sales (farm_id);

CREATE INDEX IF NOT EXISTS idx_harvest_sales_strain_id
    ON harvest_sales (strain_id);

CREATE INDEX IF NOT EXISTS idx_harvest_sales_sale_date
    ON harvest_sales (sale_date);

-- ── export_records ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_export_records_farm_id
    ON export_records (farm_id);

CREATE INDEX IF NOT EXISTS idx_export_records_status
    ON export_records (status);

-- ── pesticide_results ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pesticide_results_farm_id
    ON pesticide_results (farm_id);

CREATE INDEX IF NOT EXISTS idx_pesticide_results_report_id
    ON pesticide_results (report_id);
