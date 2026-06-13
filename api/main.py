import os
import re
import uuid
import tempfile
import logging
import hashlib
import urllib.parse
from typing import Optional, Literal
from pydantic import model_validator
from pydantic import BaseModel, Field
from fastapi import FastAPI, UploadFile, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from api.dependencies import s3, supabase, verify_token
from phenoledger.lab_detector import detect, LabFamily
from phenoledger.extractors.sclabs import extract as sclabs_extract, extract_header as sclabs_header
from phenoledger.extractors.confident_lims import extract as confident_lims_extract, extract_header as confident_lims_header
from phenoledger.extractors.botanacor import extract as botanacor_extract, extract_header as botanacor_header
from phenoledger.extractors.analytics_labs import extract as analytics_labs_extract, extract_header as analytics_labs_header
from datetime import datetime, timezone, date


LAB_DISPLAY = {
    "sclabs":             "SC Labs",
    "confident_cannabis": "Confident Cannabis",
    "confident_lims":     "Confident LIMS",
    "fesa_labs":          "FESA Labs",
    "new_bloom":          "New Bloom Labs",
    "marin_analytics":    "Marin Analytics",
    "analytics_labs":     "Analytics Labs",
    "botanacor":          "SC Labs (Botanacor)",
}

_LAB_SUFFIX = re.compile(
    r'_(sclabs|confident_cannabis|confident_lims|fesa_labs|new_bloom'
    r'|marin_analytics|analytics_labs|massachusetts|illinois)',
    re.IGNORECASE,
)

def _display_name(filename: str) -> str:
    name = re.sub(r'^\d+_', '', filename)
    name = _LAB_SUFFIX.sub('', name)
    name = name.rsplit('.', 1)[0]
    result = name.replace('_', ' ').title()
    if re.match(r'^[\d\s\-]+$', result) or len(result) < 3:
        logging.warning("_display_name produced suspicious result %r from %r", result, filename)
    return result

_CONCENTRATE_KW = ['rosin', 'wax', 'live resin', 'hash', 'badder', 'batter', 'sauce',
                   'diamonds', 'crumble', 'shatter', 'kief', 'sift', 'bubble', 'ice water']
_EXTRACT_KW     = ['distillate', 'isolate', 'tincture', 'rso', 'oil', 'cartridge',
                   'extract', 'co2', 'nano']

def _infer_sample_type(name: str) -> str:
    lower = name.lower()
    if any(k in lower for k in _CONCENTRATE_KW):
        return 'concentrate'
    if any(k in lower for k in _EXTRACT_KW):
        return 'extract'
    return 'flower'

class SeedLotIn(BaseModel):
    lot_code: str = Field(..., max_length=50)
    strain_name: Optional[str] = None
    strain_id: Optional[str] = None
    origin_country: Optional[str] = Field(None, max_length=100)
    import_permit_number: Optional[str] = Field(None, max_length=100)
    phytosanitary_cert_number: Optional[str] = Field(None, max_length=100)
    germination_rate: Optional[float] = Field(None, ge=0, le=100)
    quantity_seeds: Optional[int] = Field(None, ge=0)
    arrival_date: Optional[date] = None
    viability_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=500)
    status: Optional[Literal["active", "exhausted", "quarantine"]] = "active"


class MotherPlantIn(BaseModel):
    plant_code: str = Field(..., max_length=50)
    strain_name: Optional[str] = None
    established_date: Optional[date] = None
    clone_generation: Optional[int] = Field(None, ge=0)
    health_status: Literal["healthy", "watch", "sick", "retired"] = "healthy"
    hlvd_tested: bool = False
    hlvd_result: Optional[Literal["negative", "positive", "pending"]] = None
    hlvd_test_date: Optional[date] = None
    last_cloned_date: Optional[date] = None
    total_clones_taken: Optional[int] = 0
    origin_country: Optional[str] = Field(None, max_length=100)
    retirement_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=500)

class MotherPlantUpdate(BaseModel):
    health_status: Optional[Literal["healthy", "watch", "sick", "retired"]] = None
    hlvd_result: Optional[Literal["negative", "positive", "pending"]] = None
    hlvd_test_date: Optional[date] = None
    last_cloned_date: Optional[date] = None
    total_clones_taken: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=500)


class SeedLotUpdate(BaseModel):
    origin_country: Optional[str] = Field(None, max_length=100)
    import_permit_number: Optional[str] = Field(None, max_length=100)
    phytosanitary_cert_number: Optional[str] = Field(None, max_length=100)
    germination_rate: Optional[float] = Field(None, ge=0, le=100)
    quantity_seeds: Optional[int] = Field(None, ge=0)
    arrival_date: Optional[date] = None
    viability_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=500)
    status: Optional[Literal["active", "exhausted", "quarantine"]] = None


class TrialEventIn(BaseModel):
    event_date: date
    event_type: Literal["pesticide", "nutrient", "anomaly", "observation"]
    product_name: Optional[str] = Field(None, max_length=200)
    quantity: Optional[float] = Field(None, ge=0)
    unit: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = Field(None, max_length=500)


class TrialUpdate(BaseModel):
    location_name: Optional[str] = Field(None, max_length=200)
    @model_validator(mode='after')
    def validate_ranges(self):
        if self.start_date and self.harvest_date and self.harvest_date < self.start_date:
            raise ValueError("harvest_date cannot be before start_date")
        if self.temperature_min is not None and self.temperature_max is not None:
            if self.temperature_min > self.temperature_max:
                raise ValueError("temperature_min cannot exceed temperature_max")
        if self.humidity_min is not None and self.humidity_max is not None:
            if self.humidity_min > self.humidity_max:
                raise ValueError("humidity_min cannot exceed humidity_max")
        return self
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    grow_type: Optional[Literal["indoor", "outdoor", "greenhouse"]] = None
    start_date: Optional[date] = None
    harvest_date: Optional[date] = None
    grow_medium: Optional[str] = Field(None, max_length=100)
    light_cycle: Optional[str] = Field(None, max_length=50)
    temperature_min: Optional[float] = None
    temperature_max: Optional[float] = None
    humidity_min: Optional[float] = Field(None, ge=0, le=100)
    humidity_max: Optional[float] = Field(None, ge=0, le=100)
    wet_weight_g: Optional[float] = Field(None, ge=0)
    dry_weight_g: Optional[float] = Field(None, ge=0)
    plant_count: Optional[int] = Field(None, ge=1)
    notes: Optional[str] = Field(None, max_length=500)
    status: Optional[Literal["ongoing", "completed", "harvested"]] = None


class COALinkIn(BaseModel):
    report_id: str


class TrialIn(BaseModel):
    strain_id: Optional[str] = None
    @model_validator(mode='after')
    def validate_ranges(self):
        if self.start_date and self.harvest_date and self.harvest_date < self.start_date:
            raise ValueError("harvest_date cannot be before start_date")
        if self.temperature_min is not None and self.temperature_max is not None:
            if self.temperature_min > self.temperature_max:
                raise ValueError("temperature_min cannot exceed temperature_max")
        if self.humidity_min is not None and self.humidity_max is not None:
            if self.humidity_min > self.humidity_max:
                raise ValueError("humidity_min cannot exceed humidity_max")
        return self
    mother_plant_id: Optional[str] = None
    location_name: Optional[str] = Field(None, max_length=200)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    grow_type: Optional[Literal["indoor", "outdoor", "greenhouse"]] = None
    start_date: Optional[date] = None
    harvest_date: Optional[date] = None
    grow_medium: Optional[str] = Field(None, max_length=100)
    light_cycle: Optional[str] = Field(None, max_length=50)
    temperature_min: Optional[float] = Field(None, ge=-10, le=60)
    temperature_max: Optional[float] = Field(None, ge=-10, le=60)
    humidity_min: Optional[float] = Field(None, ge=0, le=100)
    humidity_max: Optional[float] = Field(None, ge=0, le=100)
    wet_weight_g: Optional[float] = Field(None, ge=0)
    dry_weight_g: Optional[float] = Field(None, ge=0)
    plant_count: Optional[int] = Field(None, ge=1)
    cost_per_gram: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=500)
    status: Optional[Literal["ongoing", "completed", "harvested"]] = "ongoing"


class PropagationUpdate(BaseModel):
    propagation_date: Optional[date] = None
    clones_taken: Optional[int] = Field(None, ge=1)
    grow_type: Optional[Literal["indoor", "outdoor", "greenhouse"]] = None
    notes: Optional[str] = Field(None, max_length=500)
    report_id: Optional[str] = None


class PropagationIn(BaseModel):
    mother_plant_id: str
    report_id: Optional[str] = None
    propagation_date: date
    clones_taken: int = Field(..., ge=1)
    grow_type: Optional[Literal["indoor", "outdoor", "greenhouse"]] = None
    notes: Optional[str] = Field(None, max_length=500)

class BreedingRecordIn(BaseModel):
    result_strain_id: str
    parent_strain_a_id: str
    parent_strain_b_id: Optional[str] = None
    generation: Literal["F1","F2","F3","F4","BX1","BX2","BX3","S1","IBL","Other"]
    cross_date: Optional[date] = None
    seed_count: Optional[int] = Field(None, ge=0)
    success_rate: Optional[float] = Field(None, ge=0, le=100)
    breeding_notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[Literal["in_progress", "completed", "failed"]] = "in_progress"

class BreedingRecordUpdate(BaseModel):
    cross_date: Optional[date] = None
    seed_count: Optional[int] = Field(None, ge=0)
    success_rate: Optional[float] = Field(None, ge=0, le=100)
    breeding_notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[Literal["in_progress", "completed", "failed"]] = None

class PlantHealthScreeningIn(BaseModel):
    mother_plant_id: Optional[str] = None
    report_id: Optional[str] = None
    pathogen: Literal["Fusarium","Botrytis","HLVd","Powdery Mildew","Spider Mites","Russet Mites","Root Aphids","Other"]
    test_date: date
    result: Literal["negative","positive","pending"]
    testing_lab: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=1000)

    def model_post_init(self, __context) -> None:
        if not self.mother_plant_id and not self.report_id:
            raise ValueError("either mother_plant_id or report_id must be provided")

class PlantHealthScreeningUpdate(BaseModel):
    result: Optional[Literal["negative","positive","pending"]] = None
    testing_lab: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=1000)

class DUSTestIn(BaseModel):
    strain_id: str
    testing_body: Optional[str] = Field(None, max_length=200)
    test_date: date
    status: Literal["pending","in_progress","passed","failed"] = "pending"
    distinctness_score: Optional[float] = Field(None, ge=0, le=100)
    uniformity_score: Optional[float] = Field(None, ge=0, le=100)
    stability_score: Optional[float] = Field(None, ge=0, le=100)
    overall_result: Optional[Literal["pass","fail","pending"]] = None
    registration_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)

class DUSTestUpdate(BaseModel):
    testing_body: Optional[str] = Field(None, max_length=200)
    status: Optional[Literal["pending","in_progress","passed","failed"]] = None
    distinctness_score: Optional[float] = Field(None, ge=0, le=100)
    uniformity_score: Optional[float] = Field(None, ge=0, le=100)
    stability_score: Optional[float] = Field(None, ge=0, le=100)
    overall_result: Optional[Literal["pass","fail","pending"]] = None
    registration_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)

class TissueCultureRecordIn(BaseModel):
    strain_id: str
    accession_number: str = Field(..., max_length=100)
    banking_date: date
    storage_facility: Optional[str] = Field(None, max_length=200)
    culture_type: Literal["meristem","shoot_tip","callus","protoplast","embryo","pollen"]
    viability_status: Literal["viable","degraded","unknown","destroyed"] = "viable"
    last_viability_check: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=1000)

class TissueCultureRecordUpdate(BaseModel):
    storage_facility: Optional[str] = Field(None, max_length=200)
    viability_status: Optional[Literal["viable","degraded","unknown","destroyed"]] = None
    last_viability_check: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=1000)


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:5174").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/overview")
def overview(auth = Depends(verify_token)):
    client = auth["client"]

    strains_rows = client.table("strain_consistency") \
        .select("strain_name, avg_pct, stability_score, status") \
        .eq("farm_id", auth["farm_id"]) \
        .eq("compound_name", "THCA") \
        .execute()
    strains_data: list[dict] = strains_rows.data  # type: ignore[assignment]

    strain_count = len(strains_data)
    avg_stability = round(
        sum(float(r["stability_score"] or 0) for r in strains_data) / strain_count
        if strain_count > 0 else 0
    )

    count_rows = client.table("coa_uploads") \
        .select("id", count="exact") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    coa_count = count_rows.count or 0

    uploads_rows = client.table("coa_uploads") \
        .select("id, original_filename, extraction_status, created_at, coa_reports(lab_name, report_date, sample_name)") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .order("created_at", desc=True) \
        .range(0, 4) \
        .execute()
    uploads_data: list[dict] = uploads_rows.data  # type: ignore[assignment]
    recent_uploads = []
    for r in uploads_data:
        reports = r.get("coa_reports") or []
        lab_raw = reports[0]["lab_name"] if reports else None
        sample_name = reports[0].get("sample_name") if reports else None
        recent_uploads.append({
            "id": r["id"],
            "name": sample_name or _display_name(r["original_filename"]),
            "status": r["extraction_status"],
            "lab": LAB_DISPLAY.get(lab_raw, lab_raw) if lab_raw else None,
            "created_at": reports[0].get("report_date") or r["created_at"] if reports else r["created_at"],
        })

    consistency = [
        {"strain": r["strain_name"], "thca": round(float(r["avg_pct"] or 0), 2), "stability": round(float(r["stability_score"] or 0))}
        for r in strains_data
    ]

    alerts_rows = client.table("strain_consistency") \
        .select("strain_name, compound_name, status, cv_pct, stability_score") \
        .eq("farm_id", auth["farm_id"]) \
        .in_("status", ["watch", "drift"]) \
        .execute()
    alerts_data: list[dict] = alerts_rows.data  # type: ignore[assignment]
    alerts = [
        {
            "strain": r["strain_name"],
            "compound": r["compound_name"],
            "status": r["status"],
            "cv_pct": round(float(r["cv_pct"] or 0), 1),
            "stability": round(float(r["stability_score"] or 0)),
        }
        for r in alerts_data
    ]

    # next actions — strains not tested in 60+ days
    from datetime import datetime, timedelta, timezone as tz
    sixty_days_ago = (datetime.now(tz.utc) - timedelta(days=60)).date().isoformat()
    strain_reports = client.table("coa_reports") \
        .select("strain_id, report_date, strains(name)") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .order("report_date", desc=True) \
        .execute()
    latest_by_strain: dict = {}
    for rep in (strain_reports.data or []):
        sid = rep["strain_id"]
        if sid not in latest_by_strain:
            latest_by_strain[sid] = {"date": rep["report_date"], "name": (rep.get("strains") or {}).get("name", "Unknown")}
    overdue_strains = [v["name"] for v in latest_by_strain.values() if v["date"] and v["date"] < sixty_days_ago]
    never_tested_strains = [r["strain_name"] for r in strains_data if r["strain_name"] not in [v["name"] for v in latest_by_strain.values()]]
    # next actions — mother plants overdue for health screening (90+ days)
    ninety_days_ago = (datetime.now(tz.utc) - timedelta(days=90)).date().isoformat()
    mp_rows = client.table("mother_plants") \
        .select("id, plant_code, strain_id") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    screening_rows = client.table("plant_health_screenings") \
        .select("mother_plant_id, test_date") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .order("test_date", desc=True) \
        .execute()
    latest_screening: dict = {}
    for s in (screening_rows.data or []):
        mid = s["mother_plant_id"]
        if mid not in latest_screening:
            latest_screening[mid] = s["test_date"]
    overdue_mothers = []
    for mp in (mp_rows.data or []):
        last = latest_screening.get(mp["id"] if "id" in mp else None)
        if not last or last < ninety_days_ago:
            overdue_mothers.append(mp["plant_code"])
    next_actions = []
    if overdue_strains:
        next_actions.append({"type": "strain_overdue", "message": f"{len(overdue_strains)} strain{'s' if len(overdue_strains) > 1 else ''} not tested in 60+ days", "items": overdue_strains})
    if never_tested_strains:
        next_actions.append({"type": "strain_never_tested", "message": f"{len(never_tested_strains)} strain{'s' if len(never_tested_strains) > 1 else ''} never tested", "items": never_tested_strains})
    if overdue_mothers:
        next_actions.append({"type": "mother_overdue", "message": f"{len(overdue_mothers)} mother plant{'s' if len(overdue_mothers) > 1 else ''} overdue for health screening", "items": overdue_mothers})
    return {
        "strain_count": strain_count,
        "coa_count": coa_count,
        "avg_stability": avg_stability,
        "flagged_count": len({a["strain"] for a in alerts}),
        "recent_uploads": recent_uploads,
        "consistency": consistency,
        "next_actions": next_actions,
        "alerts": alerts,
    }


@app.post("/upload")
async def upload_coa(file: UploadFile, auth = Depends(verify_token)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="only PDF files accepted")

    contents = await file.read()

    MAX_SIZE = 50 * 1024 * 1024  # 50MB
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 50MB")

    if not contents.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File is not a valid PDF")

    content_hash = hashlib.sha256(contents).hexdigest()
    existing = supabase.table("coa_uploads") \
        .select("id") \
        .eq("farm_id", auth["farm_id"]) \
        .eq("content_hash", content_hash) \
        .execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="This COA has already been uploaded")

    s3_key = f"coas/{auth['farm_id']}/{uuid.uuid4()}.pdf"
    s3.put_object(
        Bucket=os.environ["AWS_S3_BUCKET"],
        Key=s3_key,
        Body=contents,
        ContentType="application/pdf",
    )

    upload = supabase.table("coa_uploads").insert({
        "farm_id": auth["farm_id"],
        "s3_bucket": os.environ["AWS_S3_BUCKET"],
        "s3_key": s3_key,
        "original_filename": file.filename,
        "file_size_bytes": len(contents),
        "content_hash": content_hash,
        "extraction_status": "pending",
    }).execute()

    upload_id: str = upload.data[0]["id"]  # type: ignore[index]

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        lab = detect(tmp_path)

        report = supabase.table("coa_reports").insert({
            "farm_id": auth["farm_id"],
            "upload_id": upload_id,
            "lab_name": lab.value if lab != LabFamily.UNKNOWN else None,
        }).execute()

        report_id: str = report.data[0]["id"]  # type: ignore[index]

        if lab == LabFamily.SCLABS:
            extracted = sclabs_extract(tmp_path)
        elif lab == LabFamily.BOTANACOR:
            extracted = botanacor_extract(tmp_path)
        elif lab == LabFamily.CONFIDENT_LIMS:
            extracted = confident_lims_extract(tmp_path)
        elif lab == LabFamily.ANALYTICS_LABS:
            extracted = analytics_labs_extract(tmp_path)
        else:
            extracted = {"cannabinoids": [], "terpenes": []}

        for r in extracted["cannabinoids"]:
            supabase.table("cannabinoid_results").insert({
                "farm_id": auth["farm_id"],
                "report_id": report_id,
                "compound_name": r["compound"],
                "value_pct": float(r["value_pct"]) if r["value_pct"] else None,
                "value_raw": float(r["value_mg_g"]) if r["value_mg_g"] else None,
                "unit_raw": "mg/g",
            }).execute()

        terpenes_with_value = [r for r in extracted["terpenes"] if r["value_pct"] is not None]
        if extracted["terpenes"] and not terpenes_with_value:
            logging.warning("upload %s: %d terpenes extracted but all have null value_pct", upload_id, len(extracted["terpenes"]))
        for r in terpenes_with_value:
            try:
                supabase.table("terpene_results").insert({
                    "farm_id": auth["farm_id"],
                    "report_id": report_id,
                    "compound_name": r["compound"],
                    "value_pct": float(r["value_pct"]),
                    "value_raw": float(r["value_mg_g"]) if r["value_mg_g"] else None,
                    "unit_raw": "mg/g",
                }).execute()
            except Exception as e:
                logging.error("Terpene insert failed: %s — %s", r["compound"], e)
        for r in extracted.get("pesticides", []):
            try:
                supabase.table("pesticide_results").insert({
                    "farm_id": auth["farm_id"],
                    "report_id": report_id,
                    "compound_name": r["compound"],
                    "value_ppb": r.get("value_ppb"),
                    "lod_ppb": r.get("lod_ppb"),
                    "loq_ppb": r.get("loq_ppb"),
                    "result": r.get("result"),
                }).execute()
            except Exception as e:
                logging.error("Pesticide insert failed: %s — %s", r["compound"], e)

        if lab == LabFamily.SCLABS:
            header = sclabs_header(tmp_path)
        elif lab == LabFamily.BOTANACOR:
            header = botanacor_header(tmp_path)
        elif lab == LabFamily.CONFIDENT_LIMS:
            header = confident_lims_header(tmp_path)
        elif lab == LabFamily.ANALYTICS_LABS:
            header = analytics_labs_header(tmp_path)
        else:
            header = {}

        if header:
            supabase.table("coa_reports").update({
                "sample_name": header.get("sample_name"),
                "report_date": header.get("report_date"),
                "collection_date": header.get("collection_date"),
                "received_date": header.get("received_date"),
                "overall_pass_fail": header.get("overall_pass_fail"),
                "reported_batch_number": header.get("reported_batch_number"),
            }).eq("id", report_id).execute()

            strain_name_raw = header.get("sample_name") or _display_name(file.filename or "")
            strain_name = strain_name_raw.split(" Received:")[0].split(" - Flower")[0].strip()
            if strain_name != strain_name_raw:
                logging.warning("Strain name cleaned: %r → %r", strain_name_raw, strain_name)

            existing = supabase.table("strains") \
                .select("id") \
                .eq("farm_id", auth["farm_id"]) \
                .eq("name", strain_name) \
                .is_("deleted_at", "null") \
                .execute()

            if existing.data:
                strain_id = existing.data[0]["id"]
            else:
                new_strain = supabase.table("strains").insert({
                    "farm_id": auth["farm_id"],
                    "name": strain_name,
                }).execute()
                strain_id = new_strain.data[0]["id"]  # type: ignore[index]

            supabase.table("coa_reports") \
                .update({"strain_id": strain_id}) \
                .eq("id", report_id) \
                .execute()

        supabase.table("coa_uploads").update({
            "extraction_status": "confirmed",
        }).eq("id", upload_id).execute()
    finally:
        os.unlink(tmp_path)

    return {
        "upload_id": upload_id,
        "report_id": report_id,
        "lab": lab.value,
        "compounds_extracted": len(extracted["cannabinoids"]),
        "terpenes_extracted": len(extracted["terpenes"]),
    }


@app.get("/uploads")
def list_uploads(auth = Depends(verify_token), limit: int = 50, offset: int = 0, lab: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None):
    q = auth["client"].table("coa_uploads") \
        .select("id, original_filename, extraction_status, created_at, coa_reports(lab_name, report_date, sample_name, cannabinoid_results(compound_name, value_pct))") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .order("created_at", desc=True)
    if date_from:
        q = q.gte("created_at", date_from)
    if date_to:
        q = q.lte("created_at", date_to + "T23:59:59")
    rows = q.range(offset, offset + limit - 1).execute()
    data: list[dict] = rows.data  # type: ignore[assignment]
    result = []
    for r in data:
        reports = r.get("coa_reports") or []
        lab_raw = reports[0]["lab_name"] if reports else None
        sample_name = reports[0].get("sample_name") if reports else None
        cannabinoids = reports[0].get("cannabinoid_results") or [] if reports else []
        thca_row = next((c for c in cannabinoids if c.get("compound_name") == "THCA"), None)
        thca = round(float(thca_row["value_pct"]), 2) if thca_row and thca_row.get("value_pct") is not None else None
        lab_display = LAB_DISPLAY.get(lab_raw, lab_raw) if lab_raw else None
        if lab and lab_display and lab.lower() not in lab_display.lower():
            continue
        result.append({
            "id": r["id"],
            "name": sample_name or _display_name(r["original_filename"]),
            "filename": r["original_filename"],
            "status": r["extraction_status"],
            "lab": lab_display,
            "created_at": reports[0].get("report_date") or r["created_at"] if reports else r["created_at"],
            "thca": thca,
        })
    return result


@app.get("/uploads/count")
def uploads_count(auth = Depends(verify_token)):
    rows = (auth["client"].table("coa_uploads")
        .select("id", count="exact")
        .eq("farm_id", auth["farm_id"])
        .is_("deleted_at", "null")
        .limit(1)
        .execute())
    return {"count": rows.count or 0}


@app.get("/consistency")
def consistency(auth = Depends(verify_token)):
    rows = auth["client"].table("strain_consistency") \
        .select("strain_name, avg_pct") \
        .eq("farm_id", auth["farm_id"]) \
        .eq("compound_name", "THCA") \
        .execute()
    data: list[dict] = rows.data  # type: ignore[assignment]
    return [
        {"strain": r["strain_name"], "thca": round(float(r["avg_pct"] or 0), 2), "stability": round(float(r["stability_score"] or 0))}
        for r in data
    ]

@app.get("/consistency/alerts")
def consistency_alerts(auth = Depends(verify_token)):
    rows = auth["client"].table("strain_consistency") \
        .select("strain_name, compound_name, status, cv_pct, stability_score") \
        .eq("farm_id", auth["farm_id"]) \
        .in_("status", ["watch", "drift"]) \
        .execute()
    data: list[dict] = rows.data  # type: ignore[assignment]
    return [
        {
            "strain": r["strain_name"],
            "compound": r["compound_name"],
            "status": r["status"],
            "cv_pct": round(float(r["cv_pct"] or 0), 1),
            "stability": round(float(r["stability_score"] or 0)),
        }
        for r in data
    ]


def compute_chemotype(compounds: dict) -> str:
    thc = float(compounds.get("THCA", 0) or 0) + float(compounds.get("D9-THC", 0) or 0)
    cbd = float(compounds.get("CBDA", 0) or 0) + float(compounds.get("CBD", 0) or 0)
    cbg = float(compounds.get("CBGA", 0) or 0) + float(compounds.get("CBG", 0) or 0)
    if cbg > thc and cbg > cbd and cbg > 1.0:
        return "Type IV"
    if thc > 1.0 and thc > cbd * 2:
        return "Type I"
    if thc >= 0.5 and cbd >= 0.5:
        return "Type II"
    if cbd > thc * 2 and cbd > 1.0:
        return "Type III"
    return "Type V"

@app.get("/strains/all")
def list_all_strains(auth = Depends(verify_token)):
    rows = auth["client"].table("strains") \
        .select("id, name") \
        .eq("farm_id", auth["farm_id"]) \
        .order("name") \
        .execute()
    return [{"strain_id": r["id"], "strain": r["name"]} for r in (rows.data or [])]

@app.get("/strains")
def list_strains(limit: int = Query(50, le=200), offset: int = 0, auth = Depends(verify_token)):
    rows = auth["client"].table("strain_consistency") \
        .select("strain_id, strain_name, batch_count, avg_pct, stability_score, status, compound_name") \
        .eq("farm_id", auth["farm_id"]) \
        .in_("compound_name", ["THCA", "D9-THC", "CBDA", "CBD", "CBGA", "CBG"]) \
        .execute()
    data: list[dict] = rows.data  # type: ignore[assignment]
    # group by strain
    from collections import defaultdict
    strains: dict = {}
    compounds_by_strain: dict = defaultdict(dict)
    for r in data:
        sid = r["strain_id"]
        compounds_by_strain[sid][r["compound_name"]] = float(r["avg_pct"] or 0)
        if r["compound_name"] == "THCA":
            strains[sid] = r
    # get latest report date per strain
    strain_ids = list(strains.keys())
    last_tested: dict = {}
    top_terpene: dict = {}
    if strain_ids:
        reports = auth["client"].table("coa_reports") \
            .select("id, strain_id, report_date") \
            .eq("farm_id", auth["farm_id"]) \
            .in_("strain_id", strain_ids) \
            .is_("deleted_at", "null") \
            .order("report_date", desc=True) \
            .execute()
        report_ids_by_strain: dict = {}
        for rep in (reports.data or []):
            sid = rep["strain_id"]
            if sid not in last_tested:
                last_tested[sid] = rep["report_date"]
            report_ids_by_strain.setdefault(sid, []).append(rep["id"])
        all_report_ids = [rep["id"] for rep in (reports.data or [])]
        if all_report_ids:
            terp_rows = auth["client"].table("terpene_results") \
                .select("report_id, compound_name, value_pct") \
                .in_("report_id", all_report_ids) \
                .not_.is_("value_pct", "null") \
                .gt("value_pct", 0) \
                .execute()
            from collections import defaultdict
            terp_totals: dict = defaultdict(lambda: defaultdict(float))
            for t in (terp_rows.data or []):
                for sid, rids in report_ids_by_strain.items():
                    if t["report_id"] in rids:
                        terp_totals[sid][t["compound_name"]] += float(t["value_pct"] or 0)
            for sid, totals in terp_totals.items():
                if totals:
                    top_terpene[sid] = max(totals, key=totals.__getitem__)
    result = []
    for sid, r in strains.items():
        stability = round(float(r["stability_score"] or 0))
        result.append({
            "strain_id": sid,
            "strain": r["strain_name"],
            "thca": round(float(r["avg_pct"] or 0), 2),
            "upload_count": r["batch_count"],
            "status": r["status"],
            "stability": stability,
            "sample_type": _infer_sample_type(r["strain_name"]),
            "chemotype": compute_chemotype(compounds_by_strain[sid]),
            "last_tested": last_tested.get(sid),
            "top_terpene": top_terpene.get(sid),
        })
    return result


def _get_strain_report_ids(strain_name: str, client, farm_id: str) -> list[str]:
    """Look up report IDs for a strain by name using strain_id join."""
    strain_row = client.table("strains") \
        .select("id") \
        .eq("farm_id", farm_id) \
        .eq("name", strain_name) \
        .is_("deleted_at", "null") \
        .execute()
    if not strain_row.data:
        return []
    strain_id = strain_row.data[0]["id"]
    reports = client.table("coa_reports") \
        .select("id") \
        .eq("strain_id", strain_id) \
        .eq("farm_id", farm_id) \
        .is_("deleted_at", "null") \
        .execute()
    return [r["id"] for r in (reports.data or [])]


@app.get("/strain/{strain_name}/cannabinoids")
def strain_cannabinoids(strain_name: str, auth = Depends(verify_token)):
    matching_ids = _get_strain_report_ids(strain_name, auth["client"], auth["farm_id"])
    if not matching_ids:
        return []
    cann_rows = auth["client"].table("cannabinoid_results") \
        .select("compound_name, value_pct") \
        .in_("report_id", matching_ids) \
        .not_.is_("value_pct", "null") \
        .execute()
    cann_data: list[dict] = cann_rows.data  # type: ignore[assignment]
    grouped: dict[str, list[float]] = {}
    for r in cann_data:
        grouped.setdefault(r["compound_name"], []).append(float(r["value_pct"]))
    return sorted(
        [{"compound": name, "value_pct": round(sum(vals) / len(vals), 4)} for name, vals in grouped.items()],
        key=lambda x: x["value_pct"],
        reverse=True,
    )


@app.get("/strain/{strain_name}/batches")
def strain_batches(strain_name: str, auth = Depends(verify_token)):
    matching_ids = _get_strain_report_ids(strain_name, auth["client"], auth["farm_id"])
    if not matching_ids:
        return []
    reports_rows = auth["client"].table("coa_reports") \
        .select("id, upload_id, report_date, lab_name, notes, coa_uploads(original_filename, extraction_status, created_at, s3_key)") \
        .in_("id", matching_ids) \
        .is_("deleted_at", "null") \
        .execute()
    reports_data: list[dict] = reports_rows.data  # type: ignore[assignment]
    matching = []
    for r in reports_data:
        upload = r.get("coa_uploads") or {}
        matching.append({
            "report_id": r["id"],
            "date": r.get("report_date") or upload.get("created_at"),
            "status": upload.get("extraction_status"),
            "lab": LAB_DISPLAY.get(r.get("lab_name"), r.get("lab_name")),
            "s3_key": upload.get("s3_key"),
            "notes": r.get("notes"),
        })
    cann_rows = auth["client"].table("cannabinoid_results") \
        .select("report_id, compound_name, value_pct") \
        .in_("report_id", matching_ids) \
        .in_("compound_name", ["THCA", "CBD"]) \
        .not_.is_("value_pct", "null") \
        .execute()
    cann_data: list[dict] = cann_rows.data  # type: ignore[assignment]
    cann_by_report: dict[str, dict] = {}
    for r in cann_data:
        cann_by_report.setdefault(r["report_id"], {})[r["compound_name"]] = float(r["value_pct"])
    terp_rows = auth["client"].table("terpene_results") \
        .select("report_id, compound_name, value_pct") \
        .in_("report_id", matching_ids) \
        .not_.is_("value_pct", "null") \
        .gt("value_pct", 0) \
        .order("value_pct", desc=True) \
        .execute()
    terp_data: list[dict] = terp_rows.data  # type: ignore[assignment]
    top_terp: dict[str, dict] = {}
    for r in terp_data:
        rid = r["report_id"]
        if rid not in top_terp:
            top_terp[rid] = {"compound": r["compound_name"], "value_pct": round(float(r["value_pct"]), 4)}
    result = []
    for m in sorted(matching, key=lambda x: x["date"] or "", reverse=True):
        rid = m["report_id"]
        c = cann_by_report.get(rid, {})
        thca = c.get("THCA")
        cbd = c.get("CBD")
        result.append({
            "report_id": rid,
            "date": m["date"],
            "thca": round(thca, 2) if thca is not None else None,
            "cbd": round(cbd, 4) if cbd is not None else None,
            "top_terpene": top_terp.get(rid),
            "status": m["status"],
            "notes": m.get("notes"),
        })
    return result


@app.get("/strain/{strain_name}/terpenes")
def strain_terpenes(strain_name: str, auth = Depends(verify_token)):
    matching_ids = _get_strain_report_ids(strain_name, auth["client"], auth["farm_id"])
    if not matching_ids:
        return []
    rows = auth["client"].table("terpene_results") \
        .select("compound_name, value_pct") \
        .in_("report_id", matching_ids) \
        .not_.is_("value_pct", "null") \
        .execute()
    data: list[dict] = rows.data  # type: ignore[assignment]
    grouped: dict[str, list[float]] = {}
    for r in data:
        grouped.setdefault(r["compound_name"], []).append(float(r["value_pct"]))
    return sorted(
        [{"compound": name, "value_pct": round(sum(vals) / len(vals), 4)} for name, vals in grouped.items()],
        key=lambda x: x["value_pct"],
        reverse=True,
    )


@app.get("/upload/{upload_id}/pdf")
def get_pdf_url(upload_id: str, auth = Depends(verify_token)):
    row = auth["client"].table("coa_uploads") \
        .select("s3_bucket, s3_key, farm_id") \
        .eq("id", upload_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .single() \
        .execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="upload not found")
    upload = row.data
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": upload["s3_bucket"], "Key": upload["s3_key"]},
        ExpiresIn=900,
    )
    return {"url": url}


@app.delete("/strain/{strain_name}")
def delete_strain(strain_name: str, auth = Depends(verify_token)):
    now = datetime.now(timezone.utc).isoformat()
    strain_row = supabase.table("strains") \
        .select("id") \
        .eq("farm_id", auth["farm_id"]) \
        .eq("name", strain_name) \
        .is_("deleted_at", "null") \
        .execute()
    strain_data: list[dict] = strain_row.data  # type: ignore[assignment]
    if not strain_data:
        raise HTTPException(status_code=404, detail="strain not found")
    strain_id = strain_data[0]["id"]
    reports = supabase.table("coa_reports") \
        .select("id, upload_id") \
        .eq("farm_id", auth["farm_id"]) \
        .eq("strain_id", strain_id) \
        .is_("deleted_at", "null") \
        .execute()
    data: list[dict] = reports.data or []  # type: ignore[assignment]
    report_ids = [r["id"] for r in data]
    if report_ids:
        supabase.table("cannabinoid_results") \
            .delete() \
            .in_("report_id", report_ids) \
            .execute()
        supabase.table("terpene_results") \
            .delete() \
            .in_("report_id", report_ids) \
            .execute()
    for r in data:
        supabase.table("coa_reports") \
            .update({"deleted_at": now}) \
            .eq("id", r["id"]) \
            .execute()
        if r.get("upload_id"):
            supabase.table("coa_uploads") \
                .update({"deleted_at": now}) \
                .eq("id", r["upload_id"]) \
                .execute()
    supabase.table("strains") \
        .update({"deleted_at": now}) \
        .eq("id", strain_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    return {"deleted": strain_name}


# ── Genetic Lineage ───────────────────────────────────────────────────────────

@app.get("/mother-plants")
def list_mother_plants(limit: int = 50, offset: int = 0, auth = Depends(verify_token)):
    rows = auth["client"].table("mother_plants") \
        .select("*, strains(name)") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .order("created_at", desc=True) \
        .range(offset, offset + limit - 1) \
        .execute()
    return rows.data


@app.post("/mother-plants")
def create_mother_plant(payload: MotherPlantIn, auth = Depends(verify_token)):
    strain_id = None
    if payload.strain_name:
        existing = supabase.table("strains") \
            .select("id") \
            .eq("farm_id", auth["farm_id"]) \
            .eq("name", payload.strain_name) \
            .is_("deleted_at", "null") \
            .execute()
        ex: list[dict] = existing.data  # type: ignore[assignment]
        if ex:
            strain_id = ex[0]["id"]
        else:
            ns = supabase.table("strains").insert({
                "farm_id": auth["farm_id"], "name": payload.strain_name,
            }).execute()
            ns_data: list[dict] = ns.data  # type: ignore[assignment]
            strain_id = ns_data[0]["id"] if ns_data else None
    existing_code = supabase.table("mother_plants") \
        .select("id") \
        .eq("farm_id", auth["farm_id"]) \
        .eq("plant_code", payload.plant_code) \
        .is_("deleted_at", "null") \
        .execute()
    if existing_code.data:
        raise HTTPException(status_code=409, detail=f"Plant code '{payload.plant_code}' already exists")
    row = supabase.table("mother_plants").insert({
        "farm_id": auth["farm_id"],
        "plant_code": payload.plant_code,
        "strain_id": strain_id,
        "established_date": payload.established_date.isoformat() if payload.established_date else None,
        "clone_generation": payload.clone_generation,
        "health_status": payload.health_status,
        "hlvd_tested": payload.hlvd_tested,
        "hlvd_result": payload.hlvd_result,
        "hlvd_test_date": payload.hlvd_test_date.isoformat() if payload.hlvd_test_date else None,
        "last_cloned_date": payload.last_cloned_date.isoformat() if payload.last_cloned_date else None,
        "total_clones_taken": payload.total_clones_taken or 0,
        "origin_country": payload.origin_country,
        "notes": payload.notes,
        "retirement_date": payload.retirement_date.isoformat() if payload.retirement_date else None,
    }).execute()
    row_data: list[dict] = row.data  # type: ignore[assignment]
    return row_data[0] if row_data else {}


@app.put("/mother-plants/{plant_id}")
def update_mother_plant(plant_id: str, payload: MotherPlantUpdate, auth = Depends(verify_token)):
    check = auth["client"].table("mother_plants") \
        .select("id") \
        .eq("id", plant_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="mother plant not found")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(status_code=422, detail="no fields to update")
    if updates.get("hlvd_result") == "positive":
        updates["health_status"] = "sick"
    supabase.table("mother_plants") \
        .update(updates) \
        .eq("id", plant_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    return {"updated": plant_id}


@app.delete("/mother-plants/{plant_id}")
def delete_mother_plant(plant_id: str, auth = Depends(verify_token)):
    result = supabase.table("mother_plants") \
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("id", plant_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="mother plant not found")
    return {"deleted": plant_id}


@app.get("/seed-lots")
def list_seed_lots(limit: int = 50, offset: int = 0, auth = Depends(verify_token)):
    rows = auth["client"].table("seed_lots") \
        .select("*, strains(name)") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .order("created_at", desc=True) \
        .range(offset, offset + limit - 1) \
        .execute()
    return rows.data


@app.post("/seed-lots")
def create_seed_lot(payload: SeedLotIn, auth = Depends(verify_token)):
    # Use strain_id directly if provided, otherwise look up by name
    strain_id = payload.strain_id or None
    if strain_id:
        strain_check = supabase.table("strains") \
            .select("id") \
            .eq("id", strain_id) \
            .eq("farm_id", auth["farm_id"]) \
            .execute()
        if not strain_check.data:
            raise HTTPException(status_code=404, detail="strain not found")
    if not strain_id and payload.strain_name:
        existing = supabase.table("strains") \
            .select("id") \
            .eq("farm_id", auth["farm_id"]) \
            .eq("name", payload.strain_name) \
            .is_("deleted_at", "null") \
            .execute()
        ex: list[dict] = existing.data  # type: ignore[assignment]
        if ex:
            strain_id = ex[0]["id"]
        else:
            ns = supabase.table("strains").insert({
                "farm_id": auth["farm_id"], "name": payload.strain_name,
            }).execute()
            ns_data: list[dict] = ns.data  # type: ignore[assignment]
            strain_id = ns_data[0]["id"] if ns_data else None
    existing_code = supabase.table("seed_lots") \
        .select("id") \
        .eq("farm_id", auth["farm_id"]) \
        .eq("lot_code", payload.lot_code) \
        .is_("deleted_at", "null") \
        .execute()
    if existing_code.data:
        raise HTTPException(status_code=409, detail=f"Lot code '{payload.lot_code}' already exists")
    row = supabase.table("seed_lots").insert({
        "farm_id": auth["farm_id"],
        "lot_code": payload.lot_code,
        "strain_id": strain_id,
        "origin_country": payload.origin_country,
        "import_permit_number": payload.import_permit_number,
        "phytosanitary_cert_number": payload.phytosanitary_cert_number,
        "germination_rate": payload.germination_rate,
        "quantity_seeds": payload.quantity_seeds,
        "arrival_date": payload.arrival_date.isoformat() if payload.arrival_date else None,
        "notes": payload.notes,
        "status": payload.status,
        "viability_date": payload.viability_date.isoformat() if payload.viability_date else None,
    }).execute()
    row_data: list[dict] = row.data  # type: ignore[assignment]
    return row_data[0]


@app.put("/seed-lots/{lot_id}")
def update_seed_lot(lot_id: str, payload: SeedLotUpdate, auth = Depends(verify_token)):
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    result = supabase.table("seed_lots") \
        .update(update) \
        .eq("id", lot_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="seed lot not found")
    return {"updated": lot_id}

@app.delete("/seed-lots/{lot_id}")
def delete_seed_lot(lot_id: str, auth = Depends(verify_token)):
    result = supabase.table("seed_lots") \
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("id", lot_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="seed lot not found")
    return {"deleted": lot_id}


@app.get("/strain/{strain_name}/lineage")
def strain_lineage(strain_name: str, auth = Depends(verify_token)):
    sr = auth["client"].table("strains") \
        .select("id") \
        .eq("farm_id", auth["farm_id"]) \
        .eq("name", strain_name) \
        .is_("deleted_at", "null") \
        .execute()
    sr_data: list[dict] = sr.data  # type: ignore[assignment]
    if not sr_data:
        return {"seed_lots": [], "mother_plants": []}
    sid = sr_data[0]["id"]
    seed_lots = auth["client"].table("seed_lots") \
        .select("*") \
        .eq("strain_id", sid) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    mother_plants = auth["client"].table("mother_plants") \
        .select("*, propagations(*, coa_reports(id, sample_name, report_date))") \
        .eq("strain_id", sid) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    breeding = auth["client"].table("breeding_records")         .select("*, parent_a:strains!parent_strain_a_id(name), parent_b:strains!parent_strain_b_id(name)")         .eq("result_strain_id", sid)         .eq("farm_id", auth["farm_id"])         .is_("deleted_at", "null")         .execute()
    sl: list[dict] = seed_lots.data  # type: ignore[assignment]
    mp: list[dict] = mother_plants.data  # type: ignore[assignment]
    br: list[dict] = breeding.data  # type: ignore[assignment]
    return {"seed_lots": sl, "mother_plants": mp, "breeding_records": br}

# ── Propagations ──────────────────────────────────────────────────────────────

@app.get("/propagations")
def list_propagations(limit: int = 50, offset: int = 0, auth = Depends(verify_token)):
    rows = auth["client"].table("propagations") \
        .select("*, mother_plants(plant_code, strains(name)), coa_reports(sample_name, report_date)") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .order("created_at", desc=True) \
        .range(offset, offset + limit - 1) \
        .execute()
    return rows.data

@app.post("/propagations")
def create_propagation(payload: PropagationIn, auth = Depends(verify_token)):
    mp_check = supabase.table("mother_plants") \
        .select("id") \
        .eq("id", payload.mother_plant_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    if not mp_check.data:
        raise HTTPException(status_code=404, detail="mother plant not found")
    row = supabase.table("propagations").insert({
        "farm_id": auth["farm_id"],
        "mother_plant_id": payload.mother_plant_id,
        "report_id": payload.report_id,
        "propagation_date": payload.propagation_date.isoformat() if payload.propagation_date else None,
        "clones_taken": payload.clones_taken,
        "grow_type": payload.grow_type,
        "notes": payload.notes,
    }).execute()
    row_data: list[dict] = row.data  # type: ignore[assignment]
    return row_data[0]

@app.put("/propagations/{prop_id}")
def update_propagation(prop_id: str, payload: PropagationUpdate, auth = Depends(verify_token)):
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    result = supabase.table("propagations") \
        .update(update) \
        .eq("id", prop_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="propagation not found")
    return {"updated": prop_id}

@app.delete("/propagations/{prop_id}")
def delete_propagation(prop_id: str, auth = Depends(verify_token)):
    result = supabase.table("propagations") \
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("id", prop_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="propagation not found")
    return {"deleted": prop_id}

# ── Phase 3: Trials ───────────────────────────────────────────────────────────

@app.get("/trials")
def list_trials(limit: int = 50, offset: int = 0, auth = Depends(verify_token)):
    rows = auth["client"].table("trials") \
        .select("*, strains(name), mother_plants(plant_code), trial_coa_links(report_id)") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .order("created_at", desc=True) \
        .range(offset, offset + limit - 1) \
        .execute()
    return rows.data

@app.post("/trials")
def create_trial(payload: TrialIn, auth = Depends(verify_token)):
    if payload.strain_id:
        strain_check = supabase.table("strains") \
            .select("id") \
            .eq("id", payload.strain_id) \
            .eq("farm_id", auth["farm_id"]) \
            .execute()
        if not strain_check.data:
            raise HTTPException(status_code=404, detail="strain not found")
    if payload.mother_plant_id:
        mp_check = supabase.table("mother_plants") \
            .select("id") \
            .eq("id", payload.mother_plant_id) \
            .eq("farm_id", auth["farm_id"]) \
            .execute()
        if not mp_check.data:
            raise HTTPException(status_code=404, detail="mother plant not found")
    row = supabase.table("trials").insert({
        "farm_id": auth["farm_id"],
        "strain_id": payload.strain_id,
        "mother_plant_id": payload.mother_plant_id,
        "location_name": payload.location_name,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "grow_type": payload.grow_type,
        "start_date": payload.start_date.isoformat() if payload.start_date else None,
        "harvest_date": payload.harvest_date.isoformat() if payload.harvest_date else None,
        "grow_medium": payload.grow_medium,
        "light_cycle": payload.light_cycle,
        "temperature_min": payload.temperature_min,
        "temperature_max": payload.temperature_max,
        "humidity_min": payload.humidity_min,
        "humidity_max": payload.humidity_max,
        "wet_weight_g": payload.wet_weight_g,
        "dry_weight_g": payload.dry_weight_g,
        "plant_count": payload.plant_count,
        "notes": payload.notes,
        "status": payload.status,
        "cost_per_gram": payload.cost_per_gram,
    }).execute()
    row_data: list[dict] = row.data  # type: ignore[assignment]
    if not row_data:
        raise HTTPException(status_code=500, detail="trial creation failed")
    return row_data[0]

@app.post("/trials/{trial_id}/coa")
def link_trial_coa(trial_id: str, payload: COALinkIn, auth = Depends(verify_token)):
    report_id = payload.report_id
    trial_check = supabase.table("trials") \
        .select("id") \
        .eq("id", trial_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    if not trial_check.data:
        raise HTTPException(status_code=404, detail="trial not found")
    report_check = supabase.table("coa_reports") \
        .select("id") \
        .eq("id", report_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    if not report_check.data:
        raise HTTPException(status_code=404, detail="report not found")
    existing_link = supabase.table("trial_coa_links") \
        .select("id") \
        .eq("trial_id", trial_id) \
        .eq("report_id", report_id) \
        .execute()
    if existing_link.data:
        raise HTTPException(status_code=409, detail="COA already linked to this trial")
    row = supabase.table("trial_coa_links").insert({
        "trial_id": trial_id,
        "report_id": report_id,
    }).execute()
    row_data: list[dict] = row.data  # type: ignore[assignment]
    if not row_data:
        raise HTTPException(status_code=500, detail="link creation failed")
    return row_data[0]

@app.get("/trials/analytics")
def trials_analytics(auth = Depends(verify_token)):
    rows = auth["client"].table("trials") \
        .select("*, strains(name), trial_coa_links(report_id, coa_reports(sample_name, report_date, cannabinoid_results(compound_name, value_pct)))") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    data: list[dict] = rows.data or []
    result = []
    for trial in data:
        strain_name = (trial.get("strains") or {}).get("name", "Unknown")
        thca = None
        links = trial.get("trial_coa_links") or []
        found_thca = False
        for link in links:
            if found_thca:
                break
            report = link.get("coa_reports") or {}
            for compound in (report.get("cannabinoid_results") or []):
                if compound["compound_name"] == "THCA" and compound["value_pct"]:
                    thca = float(compound["value_pct"])
                    found_thca = True
                    break
        result.append({
            "trial_id": trial["id"],
            "strain": strain_name,
            "grow_type": trial.get("grow_type"),
            "location": trial.get("location_name"),
            "dry_weight_g": trial.get("dry_weight_g"),
            "plant_count": trial.get("plant_count"),
            "thca": thca,
            "harvest_date": trial.get("harvest_date"),
        })
    return result
@app.get("/trials/analytics/summary")
def trials_analytics_summary(auth = Depends(verify_token)):
    rows = auth["client"].table("trials") \
        .select("grow_type, dry_weight_g, wet_weight_g, plant_count, strains(name), trial_coa_links(coa_reports(cannabinoid_results(compound_name, value_pct)))") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    data: list[dict] = rows.data or []
    by_grow_type: dict = {}
    for trial in data:
        gt = trial.get("grow_type") or "unknown"
        if gt not in by_grow_type:
            by_grow_type[gt] = {"thca_vals": [], "yield_per_plant": [], "efficiency_vals": [], "count": 0}
        by_grow_type[gt]["count"] += 1
        links = trial.get("trial_coa_links") or []
        trial_thca = None
        for link in links:
            if trial_thca is not None:
                break
            report = link.get("coa_reports") or {}
            for c in (report.get("cannabinoid_results") or []):
                if c["compound_name"] == "THCA" and c["value_pct"]:
                    trial_thca = float(c["value_pct"])
                    break
        if trial_thca is not None:
            by_grow_type[gt]["thca_vals"].append(trial_thca)
        if trial.get("dry_weight_g") and trial.get("plant_count"):
            by_grow_type[gt]["yield_per_plant"].append(
                float(trial["dry_weight_g"]) / int(trial["plant_count"])
            )
        if trial.get("dry_weight_g") and trial.get("wet_weight_g") and float(trial["wet_weight_g"]) > 0:
            if "efficiency_vals" not in by_grow_type[gt]:
                by_grow_type[gt]["efficiency_vals"] = []
            by_grow_type[gt]["efficiency_vals"].append(
                float(trial["dry_weight_g"]) / float(trial["wet_weight_g"]) * 100
            )
    summary = []
    for gt, vals in by_grow_type.items():
        thca_list = vals["thca_vals"]
        yield_list = vals["yield_per_plant"]
        summary.append({
            "grow_type": gt,
            "trial_count": vals["count"],
            "avg_thca": round(sum(thca_list) / len(thca_list), 2) if thca_list else None,
            "avg_yield_per_plant_g": round(sum(yield_list) / len(yield_list), 1) if yield_list else None,
            "avg_yield_efficiency_pct": round(sum(vals.get("efficiency_vals", [])) / len(vals.get("efficiency_vals", [])), 1) if vals.get("efficiency_vals") else None,
        })
    return summary
@app.get("/trials/{trial_id}")
def get_trial(trial_id: str, auth = Depends(verify_token)):
    row = auth["client"].table("trials") \
        .select("*, strains(name), mother_plants(plant_code), trial_coa_links(report_id, coa_reports(sample_name, report_date))") \
        .eq("id", trial_id) \
        .eq("farm_id", auth["farm_id"]) \
        .single() \
        .execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="trial not found")
    return row.data

@app.delete("/trials/{trial_id}")
def delete_trial(trial_id: str, auth = Depends(verify_token)):
    now = datetime.now(timezone.utc).isoformat()
    result = supabase.table("trials") \
        .update({"deleted_at": now}) \
        .eq("id", trial_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="trial not found")
    supabase.table("trial_events") \
        .update({"deleted_at": now}) \
        .eq("trial_id", trial_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    return {"deleted": trial_id}

@app.put("/trials/{trial_id}")
def update_trial(trial_id: str, payload: TrialUpdate, auth = Depends(verify_token)):
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "start_date" in update and update["start_date"]:
        update["start_date"] = update["start_date"].isoformat()
    if "harvest_date" in update and update["harvest_date"]:
        update["harvest_date"] = update["harvest_date"].isoformat()
    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    result = supabase.table("trials") \
        .update(update) \
        .eq("id", trial_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="trial not found")
    return {"updated": trial_id}

@app.delete("/trials/{trial_id}/coa/{report_id}")
def unlink_trial_coa(trial_id: str, report_id: str, auth = Depends(verify_token)):
    trial_check = supabase.table("trials") \
        .select("id") \
        .eq("id", trial_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    if not trial_check.data:
        raise HTTPException(status_code=404, detail="trial not found")
    result = supabase.table("trial_coa_links") \
        .delete() \
        .eq("trial_id", trial_id) \
        .eq("report_id", report_id) \
        .execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="link not found")
    return {"unlinked": report_id}


# ── Trial Events ──────────────────────────────────────────────────────────────

@app.get("/trials/{trial_id}/events")
def list_trial_events(trial_id: str, auth = Depends(verify_token)):
    trial_check = auth["client"].table("trials") \
        .select("id") \
        .eq("id", trial_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    if not trial_check.data:
        raise HTTPException(status_code=404, detail="trial not found")
    rows = auth["client"].table("trial_events") \
        .select("*") \
        .eq("trial_id", trial_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .order("event_date", desc=False) \
        .execute()
    return rows.data

@app.post("/trials/{trial_id}/events")
def create_trial_event(trial_id: str, payload: TrialEventIn, auth = Depends(verify_token)):
    trial_check = supabase.table("trials") \
        .select("id") \
        .eq("id", trial_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    if not trial_check.data:
        raise HTTPException(status_code=404, detail="trial not found")
    row = supabase.table("trial_events").insert({
        "trial_id": trial_id,
        "farm_id": auth["farm_id"],
        "event_date": payload.event_date.isoformat(),
        "event_type": payload.event_type,
        "product_name": payload.product_name,
        "quantity": str(payload.quantity) if payload.quantity is not None else None,
        "unit": payload.unit,
        "notes": payload.notes,
    }).execute()
    row_data: list[dict] = row.data  # type: ignore[assignment]
    if not row_data:
        raise HTTPException(status_code=500, detail="event creation failed")
    return row_data[0]

@app.delete("/trials/{trial_id}/events/{event_id}")
def delete_trial_event(trial_id: str, event_id: str, auth = Depends(verify_token)):
    result = supabase.table("trial_events") \
        .delete() \
        .eq("id", event_id) \
        .eq("trial_id", trial_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="event not found")
    return {"deleted": event_id}

# ── Phase 4: Compliance Reports ───────────────────────────────────────────────

@app.get("/reports/gacp/{strain_name}")
def gacp_batch_report(strain_name: str, auth = Depends(verify_token)):
    from fastapi.responses import Response
    from api.reports.generator import render_gacp_batch_report

    # Strain
    strain_row = auth["client"].table("strains") \
        .select("id, name") \
        .eq("farm_id", auth["farm_id"]) \
        .eq("name", strain_name) \
        .is_("deleted_at", "null") \
        .execute()
    if not strain_row.data:
        raise HTTPException(status_code=404, detail="strain not found")
    strain_id = strain_row.data[0]["id"]

    # Seed lots
    seed_lots = auth["client"].table("seed_lots") \
        .select("lot_code, origin_country, import_permit_number, phytosanitary_cert_number, germination_rate, arrival_date") \
        .eq("strain_id", strain_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()

    # Mother plants
    mother_plants = auth["client"].table("mother_plants") \
        .select("plant_code, established_date, clone_generation, health_status, hlvd_tested, hlvd_result, hlvd_test_date") \
        .eq("strain_id", strain_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()

    # COA batches with cannabinoids
    report_ids = _get_strain_report_ids(strain_name, auth["client"], auth["farm_id"])
    batches = []
    if report_ids:
        reports = auth["client"].table("coa_reports") \
            .select("id, sample_name, lab_name, report_date") \
            .in_("id", report_ids) \
            .execute()
        cann = auth["client"].table("cannabinoid_results") \
            .select("report_id, compound_name, value_pct") \
            .in_("report_id", report_ids) \
            .in_("compound_name", ["THCA", "CBD", "D9-THC"]) \
            .execute()
        cann_by_report: dict = {}
        for c in (cann.data or []):
            cann_by_report.setdefault(c["report_id"], {})[c["compound_name"]] = c["value_pct"]
        stability_row = auth["client"].table("strain_consistency")\
            .select("stability_score")\
            .eq("farm_id", auth["farm_id"])\
            .eq("strain_name", strain_name)\
            .eq("compound_name", "THCA")\
            .execute()
        real_stability = round(float(stability_row.data[0]["stability_score"] or 0)) if stability_row.data else None
        for r in (reports.data or []):
            rid = r.get("id") or report_ids[reports.data.index(r)]
            compounds = cann_by_report.get(rid, {})
            thca = compounds.get("THCA")
            d9 = compounds.get("D9-THC", 0) or 0
            total_thc = round(float(thca) * 0.877 + float(d9), 2) if thca else None
            batches.append({
                "sample_name": r.get("sample_name"),
                "lab_name": LAB_DISPLAY.get(r.get("lab_name"), r.get("lab_name")),
                "report_date": r.get("report_date"),
                "thca": thca,
                "cbd": compounds.get("CBD"),
                "total_thc": total_thc,
                "stability": real_stability,
            })

    # Trials
    trials = auth["client"].table("trials") \
        .select("location_name, grow_type, start_date, harvest_date, plant_count, dry_weight_g, grow_medium, light_cycle") \
        .eq("strain_id", strain_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()

    farm_row = auth["client"].table("farms").select("name").eq("id", auth["farm_id"]).execute()
    farm_name = farm_row.data[0]["name"] if farm_row.data else "Unknown Farm"
    pdf = render_gacp_batch_report(
        farm_name=farm_name,
        strain_name=strain_name,
        seed_lots=seed_lots.data or [],
        mother_plants=mother_plants.data or [],
        batches=batches,
        trials=trials.data or [],
    )

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={urllib.parse.quote(strain_name.replace(' ', '_'), safe='')}.pdf"}
    )


@app.get("/reports/strain-performance/{strain_name}")
def strain_performance_report(strain_name: str, auth = Depends(verify_token)):
    from fastapi.responses import Response
    from api.reports.generator import render_strain_performance_report

    strain_row = auth["client"].table("strains")         .select("id")         .eq("farm_id", auth["farm_id"])         .eq("name", strain_name)         .is_("deleted_at", "null")         .execute()
    if not strain_row.data:
        raise HTTPException(status_code=404, detail="strain not found")
    strain_id = strain_row.data[0]["id"]

    farm_row = auth["client"].table("farms").select("name").eq("id", auth["farm_id"]).execute()
    farm_name = farm_row.data[0]["name"] if farm_row.data else "Unknown Farm"

    compounds_raw = auth["client"].table("strain_consistency")         .select("compound_name, avg_pct, cv_pct, stability_score, status")         .eq("farm_id", auth["farm_id"])         .eq("strain_name", strain_name)         .execute()
    compounds = [
        {
            "compound_name": r["compound_name"],
            "avg_pct": round(float(r["avg_pct"] or 0), 2),
            "cv_pct": round(float(r["cv_pct"] or 0), 1),
            "stability_score": round(float(r["stability_score"] or 0)),
            "status": r["status"],
        }
        for r in (compounds_raw.data or [])
    ]

    report_ids = _get_strain_report_ids(strain_name, auth["client"], auth["farm_id"])
    batches = []
    if report_ids:
        reports = auth["client"].table("coa_reports")             .select("id, sample_name, lab_name, report_date")             .in_("id", report_ids)             .order("report_date", desc=False)             .execute()
        cann = auth["client"].table("cannabinoid_results")             .select("report_id, compound_name, value_pct")             .in_("report_id", report_ids)             .in_("compound_name", ["THCA", "CBD", "CBG", "D9-THC"])             .execute()
        cann_by_report: dict = {}
        for c in (cann.data or []):
            cann_by_report.setdefault(c["report_id"], {})[c["compound_name"]] = c["value_pct"]
        for r in (reports.data or []):
            compounds_row = cann_by_report.get(r["id"], {})
            thca = compounds_row.get("THCA")
            d9 = compounds_row.get("D9-THC", 0) or 0
            total_thc = round(float(thca) * 0.877 + float(d9), 2) if thca else None
            batches.append({
                "sample_name": r.get("sample_name"),
                "lab_name": LAB_DISPLAY.get(r.get("lab_name"), r.get("lab_name")),
                "report_date": r.get("report_date"),
                "thca": thca,
                "cbd": compounds_row.get("CBD"),
                "cbg": compounds_row.get("CBG"),
                "total_thc": total_thc,
            })

    terpenes_raw: list[dict] = []
    if report_ids:
        terp_rows = auth["client"].table("terpene_results")             .select("compound_name, value_pct")             .in_("report_id", report_ids)             .not_.is_("value_pct", "null")             .gt("value_pct", 0)             .execute()
        totals: dict[str, list] = {}
        for r in (terp_rows.data or []):
            totals.setdefault(r["compound_name"], []).append(float(r["value_pct"]))
        terpenes_raw = sorted(
            [
                {
                    "compound_name": k,
                    "avg_pct": round(sum(v) / len(v), 4),
                    "batch_count": len(v),
                }
                for k, v in totals.items()
            ],
            key=lambda x: x["avg_pct"],
            reverse=True,
        )[:5]

    pdf = render_strain_performance_report(
        farm_name=farm_name,
        strain_name=strain_name,
        compounds=compounds,
        batches=batches,
        terpenes=terpenes_raw,
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={urllib.parse.quote(strain_name.replace(' ', '_'), safe='')}.pdf"},
    )


@app.get("/reports/import-summary")
def import_summary_report(auth = Depends(verify_token)):
    from fastapi.responses import Response
    from api.reports.generator import render_import_summary_report

    farm_row = auth["client"].table("farms").select("name").eq("id", auth["farm_id"]).execute()
    farm_name = farm_row.data[0]["name"] if farm_row.data else "Unknown Farm"

    seed_lots_raw = auth["client"].table("seed_lots")         .select("*, strains(name)")         .eq("farm_id", auth["farm_id"])         .is_("deleted_at", "null")         .order("arrival_date", desc=False)         .execute()
    seed_lots = seed_lots_raw.data or []

    origin_countries: dict[str, int] = {}
    strain_ids: set = set()
    for lot in seed_lots:
        country = lot.get("origin_country") or "Unknown"
        origin_countries[country] = origin_countries.get(country, 0) + 1
        if lot.get("strain_id"):
            strain_ids.add(lot["strain_id"])

    pdf = render_import_summary_report(
        farm_name=farm_name,
        seed_lots=seed_lots,
        origin_countries=origin_countries,
        strains_count=len(strain_ids),
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=ImportSummary.pdf"},
    )


@app.get("/reports/trial-performance/{strain_name}")
def trial_performance_report(strain_name: str, auth = Depends(verify_token)):
    from fastapi.responses import Response
    from api.reports.generator import render_trial_performance_report

    strain_row = auth["client"].table("strains")         .select("id")         .eq("farm_id", auth["farm_id"])         .eq("name", strain_name)         .is_("deleted_at", "null")         .execute()
    if not strain_row.data:
        raise HTTPException(status_code=404, detail="strain not found")
    strain_id = strain_row.data[0]["id"]

    farm_row = auth["client"].table("farms").select("name").eq("id", auth["farm_id"]).execute()
    farm_name = farm_row.data[0]["name"] if farm_row.data else "Unknown Farm"

    trials_raw = auth["client"].table("trials")         .select("location_name, grow_type, start_date, harvest_date, plant_count, dry_weight_g, wet_weight_g, grow_medium, light_cycle, trial_coa_links(coa_reports(cannabinoid_results(compound_name, value_pct)))")         .eq("farm_id", auth["farm_id"])         .eq("strain_id", strain_id)         .is_("deleted_at", "null")         .order("start_date", desc=False)         .execute()
    trials = trials_raw.data or []

    by_grow_type: dict = {}
    for trial in trials:
        gt = trial.get("grow_type") or "unknown"
        if gt not in by_grow_type:
            by_grow_type[gt] = {"thca_vals": [], "yield_per_plant": [], "efficiency_vals": [], "count": 0}
        by_grow_type[gt]["count"] += 1
        links = trial.get("trial_coa_links") or []
        trial_thca = None
        for link in links:
            if trial_thca is not None:
                break
            report = link.get("coa_reports") or {}
            for c in (report.get("cannabinoid_results") or []):
                if c["compound_name"] == "THCA" and c["value_pct"]:
                    trial_thca = float(c["value_pct"])
                    break
        if trial_thca is not None:
            by_grow_type[gt]["thca_vals"].append(trial_thca)
        if trial.get("dry_weight_g") and trial.get("plant_count"):
            by_grow_type[gt]["yield_per_plant"].append(
                float(trial["dry_weight_g"]) / int(trial["plant_count"])
            )
        if trial.get("dry_weight_g") and trial.get("wet_weight_g") and float(trial.get("wet_weight_g", 0)) > 0:
            by_grow_type[gt]["efficiency_vals"].append(
                float(trial["dry_weight_g"]) / float(trial["wet_weight_g"]) * 100
            )

    analytics = []
    for gt, vals in by_grow_type.items():
        thca_list = vals["thca_vals"]
        yield_list = vals["yield_per_plant"]
        eff_list = vals["efficiency_vals"]
        analytics.append({
            "grow_type": gt,
            "trial_count": vals["count"],
            "avg_thca": round(sum(thca_list) / len(thca_list), 2) if thca_list else None,
            "avg_yield_per_plant_g": round(sum(yield_list) / len(yield_list), 1) if yield_list else None,
            "avg_yield_efficiency_pct": round(sum(eff_list) / len(eff_list), 1) if eff_list else None,
        })

    pdf = render_trial_performance_report(
        farm_name=farm_name,
        strain_name=strain_name,
        trials=trials,
        analytics=analytics,
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={urllib.parse.quote(strain_name.replace(' ', '_'), safe='')}.pdf"},
    )


# ── Phase 2 Extended: Breeding Records ────────────────────────────────────────

@app.get("/breeding-records")
def list_breeding_records(limit: int = Query(50, le=200), offset: int = 0, auth = Depends(verify_token)):
    rows = auth["client"].table("breeding_records")         .select("*, result_strain:strains!result_strain_id(name), parent_a:strains!parent_strain_a_id(name), parent_b:strains!parent_strain_b_id(name)")         .eq("farm_id", auth["farm_id"])         .is_("deleted_at", "null")         .order("created_at", desc=True)         .execute()
    return rows.data or []

@app.post("/breeding-records")
def create_breeding_record(payload: BreedingRecordIn, auth = Depends(verify_token)):
    for strain_id in [payload.result_strain_id, payload.parent_strain_a_id]:
        check = auth["client"].table("strains")             .select("id")             .eq("id", strain_id)             .eq("farm_id", auth["farm_id"])             .execute()
        if not check.data:
            raise HTTPException(status_code=404, detail=f"strain {strain_id} not found")
    if payload.parent_strain_b_id:
        check = auth["client"].table("strains")             .select("id")             .eq("id", payload.parent_strain_b_id)             .eq("farm_id", auth["farm_id"])             .execute()
        if not check.data:
            raise HTTPException(status_code=404, detail=f"strain {payload.parent_strain_b_id} not found")
    row = supabase.table("breeding_records").insert({
        "farm_id": auth["farm_id"],
        "result_strain_id": payload.result_strain_id,
        "parent_strain_a_id": payload.parent_strain_a_id,
        "parent_strain_b_id": payload.parent_strain_b_id,
        "generation": payload.generation,
        "cross_date": str(payload.cross_date) if payload.cross_date else None,
        "seed_count": payload.seed_count,
        "success_rate": payload.success_rate,
        "status": payload.status,
        "breeding_notes": payload.breeding_notes,
    }).execute()
    return row.data[0]

@app.patch("/breeding-records/{record_id}")
def update_breeding_record(record_id: str, payload: BreedingRecordUpdate, auth = Depends(verify_token)):
    check = auth["client"].table("breeding_records")         .select("id")         .eq("id", record_id)         .eq("farm_id", auth["farm_id"])         .is_("deleted_at", "null")         .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="breeding record not found")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "cross_date" in updates and updates["cross_date"]:
        updates["cross_date"] = str(updates["cross_date"])
    row = supabase.table("breeding_records").update(updates)         .eq("id", record_id)         .eq("farm_id", auth["farm_id"])         .execute()
    return row.data[0]

@app.delete("/breeding-records/{record_id}")
def delete_breeding_record(record_id: str, auth = Depends(verify_token)):
    check = auth["client"].table("breeding_records")         .select("id")         .eq("id", record_id)         .eq("farm_id", auth["farm_id"])         .is_("deleted_at", "null")         .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="breeding record not found")
    supabase.table("breeding_records")         .update({"deleted_at": datetime.now(timezone.utc).isoformat()})         .eq("id", record_id)         .eq("farm_id", auth["farm_id"])         .execute()
    return {"deleted": record_id}






# ── Phase 9: Staff & Training Records ────────────────────────────────────────
class StaffMemberIn(BaseModel):
    name: str = Field(..., max_length=100)
    role: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    start_date: Optional[date] = None
    status: Optional[Literal["active", "inactive"]] = "active"
    notes: Optional[str] = Field(None, max_length=500)

class StaffMemberUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    role: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    start_date: Optional[date] = None
    status: Optional[Literal["active", "inactive"]] = None
    notes: Optional[str] = Field(None, max_length=500)

class StaffTrainingIn(BaseModel):
    staff_id: str
    sop_id: Optional[str] = None
    training_date: date
    trainer: Optional[str] = Field(None, max_length=100)
    training_type: Optional[Literal["initial", "refresher", "certification"]] = "initial"
    expiry_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=500)

class VisitorLogIn(BaseModel):
    visitor_name: str = Field(..., max_length=100)
    organization: Optional[str] = Field(None, max_length=100)
    purpose: Optional[str] = Field(None, max_length=200)
    visit_date: date
    host_name: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)

# ── Phase 8: Environmental Monitoring ────────────────────────────────────────
class GrowRoomIn(BaseModel):
    name: str = Field(..., max_length=100)
    room_type: Optional[Literal["veg", "flower", "mother", "clone", "drying", "other"]] = None
    capacity_plants: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=500)

class GrowRoomUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    room_type: Optional[Literal["veg", "flower", "mother", "clone", "drying", "other"]] = None
    capacity_plants: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=500)

class EnvironmentalLogIn(BaseModel):
    grow_room_id: str
    log_date: date
    temp_min: Optional[float] = Field(None, ge=-10, le=60)
    temp_max: Optional[float] = Field(None, ge=-10, le=60)
    humidity_min: Optional[float] = Field(None, ge=0, le=100)
    humidity_max: Optional[float] = Field(None, ge=0, le=100)
    co2_ppm: Optional[int] = Field(None, ge=0, le=10000)
    vpd: Optional[float] = Field(None, ge=0, le=10)
    notes: Optional[str] = Field(None, max_length=500)

class EnvironmentalLogUpdate(BaseModel):
    log_date: Optional[date] = None
    temp_min: Optional[float] = Field(None, ge=-10, le=60)
    temp_max: Optional[float] = Field(None, ge=-10, le=60)
    humidity_min: Optional[float] = Field(None, ge=0, le=100)
    humidity_max: Optional[float] = Field(None, ge=0, le=100)
    co2_ppm: Optional[int] = Field(None, ge=0, le=10000)
    vpd: Optional[float] = Field(None, ge=0, le=10)
    notes: Optional[str] = Field(None, max_length=500)

# ── Phase 7: SOP Management ───────────────────────────────────────────────────
class SOPIn(BaseModel):
    title: str = Field(..., max_length=200)
    sop_code: str = Field(..., max_length=50)
    version: str = Field("1.0", max_length=20)
    category: Optional[Literal["cultivation", "harvesting", "processing", "quality_control", "health_safety", "environmental", "other"]] = None
    status: Optional[Literal["draft", "active", "under_review", "retired"]] = "draft"
    effective_date: Optional[date] = None
    review_date: Optional[date] = None
    approved_by: Optional[str] = Field(None, max_length=100)
    document_url: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)

class SOPUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    version: Optional[str] = Field(None, max_length=20)
    category: Optional[Literal["cultivation", "harvesting", "processing", "quality_control", "health_safety", "environmental", "other"]] = None
    status: Optional[Literal["draft", "active", "under_review", "retired"]] = None
    effective_date: Optional[date] = None
    review_date: Optional[date] = None
    approved_by: Optional[str] = Field(None, max_length=100)
    document_url: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)

class SOPAcknowledgmentIn(BaseModel):
    sop_id: str
    staff_name: str = Field(..., max_length=100)
    notes: Optional[str] = Field(None, max_length=500)

# ── Phase 6: Agricultural Input Records ──────────────────────────────────────
class InputRecordIn(BaseModel):
    input_date: date
    input_type: Literal["fertilizer", "pesticide", "pH_adjuster", "irrigation", "other"]
    product_name: str = Field(..., max_length=200)
    rate: Optional[str] = Field(None, max_length=50)
    unit: Optional[str] = Field(None, max_length=50)
    operator: Optional[str] = Field(None, max_length=100)
    grow_room: Optional[str] = Field(None, max_length=100)
    batch_record_id: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=500)

class InputRecordUpdate(BaseModel):
    input_date: Optional[date] = None
    input_type: Optional[Literal["fertilizer", "pesticide", "pH_adjuster", "irrigation", "other"]] = None
    product_name: Optional[str] = Field(None, max_length=200)
    rate: Optional[str] = Field(None, max_length=50)
    unit: Optional[str] = Field(None, max_length=50)
    operator: Optional[str] = Field(None, max_length=100)
    grow_room: Optional[str] = Field(None, max_length=100)
    batch_record_id: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=500)

# ── Phase 5: Batch Records ────────────────────────────────────────────────────
class BatchRecordIn(BaseModel):
    batch_code: str = Field(..., max_length=100)
    strain_id: Optional[str] = None
    seed_lot_id: Optional[str] = None
    mother_plant_id: Optional[str] = None
    trial_id: Optional[str] = None
    coa_report_id: Optional[str] = None
    status: Optional[Literal["planning", "growing", "harvested", "tested", "complete"]] = "planning"
    notes: Optional[str] = Field(None, max_length=1000)

class BatchRecordUpdate(BaseModel):
    batch_code: Optional[str] = Field(None, max_length=100)
    strain_id: Optional[str] = None
    seed_lot_id: Optional[str] = None
    mother_plant_id: Optional[str] = None
    trial_id: Optional[str] = None
    coa_report_id: Optional[str] = None
    status: Optional[Literal["planning", "growing", "harvested", "tested", "complete"]] = None
    notes: Optional[str] = Field(None, max_length=1000)

# ── Phase 4 Extended: Plant Health Screenings ─────────────────────────────────

@app.get("/plant-health-screenings")
def list_plant_health_screenings(
    mother_plant_id: Optional[str] = None,
    report_id: Optional[str] = None,
    auth = Depends(verify_token),
):
    q = auth["client"].table("plant_health_screenings")         .select("*, mother_plants(plant_code), coa_reports(sample_name)")         .eq("farm_id", auth["farm_id"])         .is_("deleted_at", "null")         .order("test_date", desc=True)
    if mother_plant_id:
        q = q.eq("mother_plant_id", mother_plant_id)
    if report_id:
        q = q.eq("report_id", report_id)
    return q.execute().data or []

@app.post("/plant-health-screenings")
def create_plant_health_screening(payload: PlantHealthScreeningIn, auth = Depends(verify_token)):
    if payload.mother_plant_id:
        check = auth["client"].table("mother_plants")             .select("id")             .eq("id", payload.mother_plant_id)             .eq("farm_id", auth["farm_id"])             .execute()
        if not check.data:
            raise HTTPException(status_code=404, detail="mother plant not found")
    if payload.report_id:
        check = auth["client"].table("coa_reports")             .select("id")             .eq("id", payload.report_id)             .eq("farm_id", auth["farm_id"])             .execute()
        if not check.data:
            raise HTTPException(status_code=404, detail="COA report not found")
    row = supabase.table("plant_health_screenings").insert({
        "farm_id": auth["farm_id"],
        "mother_plant_id": payload.mother_plant_id,
        "report_id": payload.report_id,
        "pathogen": payload.pathogen,
        "test_date": str(payload.test_date),
        "result": payload.result,
        "testing_lab": payload.testing_lab,
        "notes": payload.notes,
    }).execute()
    return row.data[0]

@app.patch("/plant-health-screenings/{screening_id}")
def update_plant_health_screening(
    screening_id: str,
    payload: PlantHealthScreeningUpdate,
    auth = Depends(verify_token),
):
    check = auth["client"].table("plant_health_screenings")         .select("id")         .eq("id", screening_id)         .eq("farm_id", auth["farm_id"])         .is_("deleted_at", "null")         .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="screening not found")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    row = supabase.table("plant_health_screenings").update(updates)         .eq("id", screening_id)         .eq("farm_id", auth["farm_id"])         .execute()
    return row.data[0]

@app.delete("/plant-health-screenings/{screening_id}")
def delete_plant_health_screening(screening_id: str, auth = Depends(verify_token)):
    check = auth["client"].table("plant_health_screenings")         .select("id")         .eq("id", screening_id)         .eq("farm_id", auth["farm_id"])         .is_("deleted_at", "null")         .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="screening not found")
    supabase.table("plant_health_screenings")         .update({"deleted_at": datetime.now(timezone.utc).isoformat()})         .eq("id", screening_id)         .eq("farm_id", auth["farm_id"])         .execute()
    return {"deleted": screening_id}


# ── Phase 4 Extended: DUS Testing ─────────────────────────────────────────────

@app.get("/dus-tests")
def list_dus_tests(strain_id: Optional[str] = None, limit: int = Query(50, le=200), offset: int = 0, auth = Depends(verify_token)):
    q = auth["client"].table("dus_tests")         .select("*, strains(name)")         .eq("farm_id", auth["farm_id"])         .is_("deleted_at", "null")         .order("test_date", desc=True)
    if strain_id:
        q = q.eq("strain_id", strain_id)
    return q.execute().data or []

@app.post("/dus-tests")
def create_dus_test(payload: DUSTestIn, auth = Depends(verify_token)):
    check = auth["client"].table("strains")         .select("id")         .eq("id", payload.strain_id)         .eq("farm_id", auth["farm_id"])         .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="strain not found")
    row = supabase.table("dus_tests").insert({
        "farm_id": auth["farm_id"],
        "strain_id": payload.strain_id,
        "testing_body": payload.testing_body,
        "test_date": str(payload.test_date),
        "status": payload.status,
        "distinctness_score": payload.distinctness_score,
        "uniformity_score": payload.uniformity_score,
        "stability_score": payload.stability_score,
        "overall_result": payload.overall_result,
        "registration_number": payload.registration_number,
        "notes": payload.notes,
    }).execute()
    return row.data[0]

@app.patch("/dus-tests/{test_id}")
def update_dus_test(test_id: str, payload: DUSTestUpdate, auth = Depends(verify_token)):
    check = auth["client"].table("dus_tests")         .select("id")         .eq("id", test_id)         .eq("farm_id", auth["farm_id"])         .is_("deleted_at", "null")         .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="DUS test not found")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    row = supabase.table("dus_tests").update(updates)         .eq("id", test_id)         .eq("farm_id", auth["farm_id"])         .execute()
    return row.data[0]

@app.delete("/dus-tests/{test_id}")
def delete_dus_test(test_id: str, auth = Depends(verify_token)):
    check = auth["client"].table("dus_tests")         .select("id")         .eq("id", test_id)         .eq("farm_id", auth["farm_id"])         .is_("deleted_at", "null")         .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="DUS test not found")
    supabase.table("dus_tests")         .update({"deleted_at": datetime.now(timezone.utc).isoformat()})         .eq("id", test_id)         .eq("farm_id", auth["farm_id"])         .execute()
    return {"deleted": test_id}


# ── Phase 4 Extended: Tissue Culture Records ──────────────────────────────────

@app.get("/tissue-culture-records")
def list_tissue_culture_records(strain_id: Optional[str] = None, limit: int = Query(50, le=200), offset: int = 0, auth = Depends(verify_token)):
    q = auth["client"].table("tissue_culture_records")         .select("*, strains(name)")         .eq("farm_id", auth["farm_id"])         .is_("deleted_at", "null")         .order("banking_date", desc=True)
    if strain_id:
        q = q.eq("strain_id", strain_id)
    return q.execute().data or []

@app.post("/tissue-culture-records")
def create_tissue_culture_record(payload: TissueCultureRecordIn, auth = Depends(verify_token)):
    check = auth["client"].table("strains")         .select("id")         .eq("id", payload.strain_id)         .eq("farm_id", auth["farm_id"])         .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="strain not found")
    row = supabase.table("tissue_culture_records").insert({
        "farm_id": auth["farm_id"],
        "strain_id": payload.strain_id,
        "accession_number": payload.accession_number,
        "banking_date": str(payload.banking_date),
        "storage_facility": payload.storage_facility,
        "culture_type": payload.culture_type,
        "viability_status": payload.viability_status,
        "last_viability_check": str(payload.last_viability_check) if payload.last_viability_check else None,
        "notes": payload.notes,
    }).execute()
    return row.data[0]

@app.patch("/tissue-culture-records/{record_id}")
def update_tissue_culture_record(record_id: str, payload: TissueCultureRecordUpdate, auth = Depends(verify_token)):
    check = auth["client"].table("tissue_culture_records")         .select("id")         .eq("id", record_id)         .eq("farm_id", auth["farm_id"])         .is_("deleted_at", "null")         .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="tissue culture record not found")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "last_viability_check" in updates and updates["last_viability_check"]:
        updates["last_viability_check"] = str(updates["last_viability_check"])
    row = supabase.table("tissue_culture_records").update(updates)         .eq("id", record_id)         .eq("farm_id", auth["farm_id"])         .execute()
    return row.data[0]

@app.delete("/tissue-culture-records/{record_id}")
def delete_tissue_culture_record(record_id: str, auth = Depends(verify_token)):
    check = auth["client"].table("tissue_culture_records")         .select("id")         .eq("id", record_id)         .eq("farm_id", auth["farm_id"])         .is_("deleted_at", "null")         .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="tissue culture record not found")
    supabase.table("tissue_culture_records")         .update({"deleted_at": datetime.now(timezone.utc).isoformat()})         .eq("id", record_id)         .eq("farm_id", auth["farm_id"])         .execute()
    return {"deleted": record_id}






# ── Phase 9: Staff & Training Records ────────────────────────────────────────
class StaffMemberIn(BaseModel):
    name: str = Field(..., max_length=100)
    role: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    start_date: Optional[date] = None
    status: Optional[Literal["active", "inactive"]] = "active"
    notes: Optional[str] = Field(None, max_length=500)

class StaffMemberUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    role: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    start_date: Optional[date] = None
    status: Optional[Literal["active", "inactive"]] = None
    notes: Optional[str] = Field(None, max_length=500)

class StaffTrainingIn(BaseModel):
    staff_id: str
    sop_id: Optional[str] = None
    training_date: date
    trainer: Optional[str] = Field(None, max_length=100)
    training_type: Optional[Literal["initial", "refresher", "certification"]] = "initial"
    expiry_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=500)

class VisitorLogIn(BaseModel):
    visitor_name: str = Field(..., max_length=100)
    organization: Optional[str] = Field(None, max_length=100)
    purpose: Optional[str] = Field(None, max_length=200)
    visit_date: date
    host_name: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)

# ── Phase 8: Environmental Monitoring ────────────────────────────────────────
class GrowRoomIn(BaseModel):
    name: str = Field(..., max_length=100)
    room_type: Optional[Literal["veg", "flower", "mother", "clone", "drying", "other"]] = None
    capacity_plants: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=500)

class GrowRoomUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    room_type: Optional[Literal["veg", "flower", "mother", "clone", "drying", "other"]] = None
    capacity_plants: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=500)

class EnvironmentalLogIn(BaseModel):
    grow_room_id: str
    log_date: date
    temp_min: Optional[float] = Field(None, ge=-10, le=60)
    temp_max: Optional[float] = Field(None, ge=-10, le=60)
    humidity_min: Optional[float] = Field(None, ge=0, le=100)
    humidity_max: Optional[float] = Field(None, ge=0, le=100)
    co2_ppm: Optional[int] = Field(None, ge=0, le=10000)
    vpd: Optional[float] = Field(None, ge=0, le=10)
    notes: Optional[str] = Field(None, max_length=500)

class EnvironmentalLogUpdate(BaseModel):
    log_date: Optional[date] = None
    temp_min: Optional[float] = Field(None, ge=-10, le=60)
    temp_max: Optional[float] = Field(None, ge=-10, le=60)
    humidity_min: Optional[float] = Field(None, ge=0, le=100)
    humidity_max: Optional[float] = Field(None, ge=0, le=100)
    co2_ppm: Optional[int] = Field(None, ge=0, le=10000)
    vpd: Optional[float] = Field(None, ge=0, le=10)
    notes: Optional[str] = Field(None, max_length=500)

# ── Phase 7: SOP Management ───────────────────────────────────────────────────
class SOPIn(BaseModel):
    title: str = Field(..., max_length=200)
    sop_code: str = Field(..., max_length=50)
    version: str = Field("1.0", max_length=20)
    category: Optional[Literal["cultivation", "harvesting", "processing", "quality_control", "health_safety", "environmental", "other"]] = None
    status: Optional[Literal["draft", "active", "under_review", "retired"]] = "draft"
    effective_date: Optional[date] = None
    review_date: Optional[date] = None
    approved_by: Optional[str] = Field(None, max_length=100)
    document_url: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)

class SOPUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    version: Optional[str] = Field(None, max_length=20)
    category: Optional[Literal["cultivation", "harvesting", "processing", "quality_control", "health_safety", "environmental", "other"]] = None
    status: Optional[Literal["draft", "active", "under_review", "retired"]] = None
    effective_date: Optional[date] = None
    review_date: Optional[date] = None
    approved_by: Optional[str] = Field(None, max_length=100)
    document_url: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)

class SOPAcknowledgmentIn(BaseModel):
    sop_id: str
    staff_name: str = Field(..., max_length=100)
    notes: Optional[str] = Field(None, max_length=500)

# ── Phase 6: Agricultural Input Records ──────────────────────────────────────
class InputRecordIn(BaseModel):
    input_date: date
    input_type: Literal["fertilizer", "pesticide", "pH_adjuster", "irrigation", "other"]
    product_name: str = Field(..., max_length=200)
    rate: Optional[str] = Field(None, max_length=50)
    unit: Optional[str] = Field(None, max_length=50)
    operator: Optional[str] = Field(None, max_length=100)
    grow_room: Optional[str] = Field(None, max_length=100)
    batch_record_id: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=500)

class InputRecordUpdate(BaseModel):
    input_date: Optional[date] = None
    input_type: Optional[Literal["fertilizer", "pesticide", "pH_adjuster", "irrigation", "other"]] = None
    product_name: Optional[str] = Field(None, max_length=200)
    rate: Optional[str] = Field(None, max_length=50)
    unit: Optional[str] = Field(None, max_length=50)
    operator: Optional[str] = Field(None, max_length=100)
    grow_room: Optional[str] = Field(None, max_length=100)
    batch_record_id: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=500)

# ── Phase 5: Batch Records ────────────────────────────────────────────────────
@app.get("/batch-records")
def list_batch_records(limit: int = Query(50, le=200), offset: int = 0, auth = Depends(verify_token)):
    rows = auth["client"].table("batch_records") \
        .select("*, strains(name), seed_lots(lot_code), mother_plants(plant_code), trials(location_name, grow_type), coa_reports(sample_name, report_date, lab_name)") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .order("created_at", desc=True) \
        .range(offset, offset + limit - 1) \
        .execute()
    return rows.data or []

@app.post("/batch-records")
def create_batch_record(payload: BatchRecordIn, auth = Depends(verify_token)):
    existing = auth["client"].table("batch_records") \
        .select("id") \
        .eq("farm_id", auth["farm_id"]) \
        .eq("batch_code", payload.batch_code) \
        .is_("deleted_at", "null") \
        .execute()
    if existing.data:
        raise HTTPException(status_code=409, detail=f"Batch code '{payload.batch_code}' already exists")
    row = supabase.table("batch_records").insert({
        "farm_id": auth["farm_id"],
        "batch_code": payload.batch_code,
        "strain_id": payload.strain_id,
        "seed_lot_id": payload.seed_lot_id,
        "mother_plant_id": payload.mother_plant_id,
        "trial_id": payload.trial_id,
        "coa_report_id": payload.coa_report_id,
        "status": payload.status,
        "notes": payload.notes,
    }).execute()
    return row.data[0]

@app.patch("/batch-records/{record_id}")
def update_batch_record(record_id: str, payload: BatchRecordUpdate, auth = Depends(verify_token)):
    check = auth["client"].table("batch_records") \
        .select("id") \
        .eq("id", record_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="batch record not found")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(status_code=422, detail="no fields to update")
    row = supabase.table("batch_records").update(updates) \
        .eq("id", record_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    return row.data[0]

@app.delete("/batch-records/{record_id}")
def delete_batch_record(record_id: str, auth = Depends(verify_token)):
    check = auth["client"].table("batch_records") \
        .select("id") \
        .eq("id", record_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="batch record not found")
    supabase.table("batch_records") \
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("id", record_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    return {"deleted": record_id}

@app.get("/reports/batch-record/{batch_id}")
def batch_record_report(batch_id: str, auth = Depends(verify_token)):
    from fastapi.responses import Response
    from api.reports.generator import render_batch_record_report
    from datetime import date

    batch_row = auth["client"].table("batch_records") \
        .select("*, strains(name), seed_lots(lot_code, origin_country, import_permit_number, phytosanitary_cert_number, germination_rate, arrival_date), mother_plants(plant_code, established_date, clone_generation, health_status, hlvd_tested, hlvd_result, hlvd_test_date), trials(location_name, grow_type, start_date, harvest_date, plant_count, dry_weight_g, grow_medium, light_cycle), coa_reports(sample_name, lab_name, report_date, total_thc_pct, total_cbd_pct)") \
        .eq("id", batch_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    if not batch_row.data:
        raise HTTPException(status_code=404, detail="batch record not found")
    b = batch_row.data[0]

    farm_row = auth["client"].table("farms").select("name").eq("id", auth["farm_id"]).execute()
    farm_name = farm_row.data[0]["name"] if farm_row.data else "Unknown Farm"

    seed_lot = b.get("seed_lots")
    mother_plant = b.get("mother_plants")
    trial = b.get("trials")
    coa = b.get("coa_reports")

    # Get THCA from cannabinoid results if available
    if coa:
        coa_id = b.get("coa_report_id")
        if coa_id:
            cann = auth["client"].table("cannabinoid_results") \
                .select("compound_name, value_pct") \
                .eq("report_id", coa_id) \
                .in_("compound_name", ["THCA", "D9-THC", "CBD"]) \
                .execute()
            cann_map = {r["compound_name"]: float(r["value_pct"] or 0) for r in (cann.data or [])}
            thca = cann_map.get("THCA")
            d9 = cann_map.get("D9-THC", 0)
            coa["thca"] = round(thca, 3) if thca else None
            coa["total_thc"] = round(thca * 0.877 + d9, 2) if thca else None
            coa["cbd"] = round(cann_map.get("CBD", 0), 3) if cann_map.get("CBD") else None
            coa["lab_name"] = LAB_DISPLAY.get(coa.get("lab_name"), coa.get("lab_name"))

    batch_data = {
        "batch_code": b["batch_code"],
        "status": b["status"],
        "strain_name": (b.get("strains") or {}).get("name"),
        "seed_lot_code": (seed_lot or {}).get("lot_code"),
        "mother_plant_code": (mother_plant or {}).get("plant_code"),
        "trial_location": (trial or {}).get("location_name"),
        "coa_sample_name": (coa or {}).get("sample_name"),
        "notes": b.get("notes"),
        "created_at": b.get("created_at"),
    }

    pdf = render_batch_record_report(
        farm_name=farm_name,
        batch=batch_data,
        seed_lot=seed_lot,
        mother_plant=mother_plant,
        trial=trial,
        coa=coa,
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=BatchRecord_{batch_data['batch_code']}.pdf"},
    )




# ── Phase 9: Staff & Training Records ────────────────────────────────────────
class StaffMemberIn(BaseModel):
    name: str = Field(..., max_length=100)
    role: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    start_date: Optional[date] = None
    status: Optional[Literal["active", "inactive"]] = "active"
    notes: Optional[str] = Field(None, max_length=500)

class StaffMemberUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    role: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    start_date: Optional[date] = None
    status: Optional[Literal["active", "inactive"]] = None
    notes: Optional[str] = Field(None, max_length=500)

class StaffTrainingIn(BaseModel):
    staff_id: str
    sop_id: Optional[str] = None
    training_date: date
    trainer: Optional[str] = Field(None, max_length=100)
    training_type: Optional[Literal["initial", "refresher", "certification"]] = "initial"
    expiry_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=500)

class VisitorLogIn(BaseModel):
    visitor_name: str = Field(..., max_length=100)
    organization: Optional[str] = Field(None, max_length=100)
    purpose: Optional[str] = Field(None, max_length=200)
    visit_date: date
    host_name: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)

# ── Phase 8: Environmental Monitoring ────────────────────────────────────────
class GrowRoomIn(BaseModel):
    name: str = Field(..., max_length=100)
    room_type: Optional[Literal["veg", "flower", "mother", "clone", "drying", "other"]] = None
    capacity_plants: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=500)

class GrowRoomUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    room_type: Optional[Literal["veg", "flower", "mother", "clone", "drying", "other"]] = None
    capacity_plants: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=500)

class EnvironmentalLogIn(BaseModel):
    grow_room_id: str
    log_date: date
    temp_min: Optional[float] = Field(None, ge=-10, le=60)
    temp_max: Optional[float] = Field(None, ge=-10, le=60)
    humidity_min: Optional[float] = Field(None, ge=0, le=100)
    humidity_max: Optional[float] = Field(None, ge=0, le=100)
    co2_ppm: Optional[int] = Field(None, ge=0, le=10000)
    vpd: Optional[float] = Field(None, ge=0, le=10)
    notes: Optional[str] = Field(None, max_length=500)

class EnvironmentalLogUpdate(BaseModel):
    log_date: Optional[date] = None
    temp_min: Optional[float] = Field(None, ge=-10, le=60)
    temp_max: Optional[float] = Field(None, ge=-10, le=60)
    humidity_min: Optional[float] = Field(None, ge=0, le=100)
    humidity_max: Optional[float] = Field(None, ge=0, le=100)
    co2_ppm: Optional[int] = Field(None, ge=0, le=10000)
    vpd: Optional[float] = Field(None, ge=0, le=10)
    notes: Optional[str] = Field(None, max_length=500)

# ── Phase 7: SOP Management ───────────────────────────────────────────────────
class SOPIn(BaseModel):
    title: str = Field(..., max_length=200)
    sop_code: str = Field(..., max_length=50)
    version: str = Field("1.0", max_length=20)
    category: Optional[Literal["cultivation", "harvesting", "processing", "quality_control", "health_safety", "environmental", "other"]] = None
    status: Optional[Literal["draft", "active", "under_review", "retired"]] = "draft"
    effective_date: Optional[date] = None
    review_date: Optional[date] = None
    approved_by: Optional[str] = Field(None, max_length=100)
    document_url: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)

class SOPUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    version: Optional[str] = Field(None, max_length=20)
    category: Optional[Literal["cultivation", "harvesting", "processing", "quality_control", "health_safety", "environmental", "other"]] = None
    status: Optional[Literal["draft", "active", "under_review", "retired"]] = None
    effective_date: Optional[date] = None
    review_date: Optional[date] = None
    approved_by: Optional[str] = Field(None, max_length=100)
    document_url: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)

class SOPAcknowledgmentIn(BaseModel):
    sop_id: str
    staff_name: str = Field(..., max_length=100)
    notes: Optional[str] = Field(None, max_length=500)

# ── Phase 6: Agricultural Input Records ──────────────────────────────────────
@app.get("/input-records")
def list_input_records(batch_record_id: Optional[str] = None, input_type: Optional[str] = None, limit: int = Query(50, le=200), offset: int = 0, auth = Depends(verify_token)):
    q = auth["client"].table("input_records") \
        .select("*") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .order("input_date", desc=True)
    if batch_record_id:
        q = q.eq("batch_record_id", batch_record_id)
    if input_type:
        q = q.eq("input_type", input_type)
    return q.range(offset, offset + limit - 1).execute().data or []

@app.post("/input-records")
def create_input_record(payload: InputRecordIn, auth = Depends(verify_token)):
    row = supabase.table("input_records").insert({
        "farm_id": auth["farm_id"],
        "input_date": payload.input_date.isoformat(),
        "input_type": payload.input_type,
        "product_name": payload.product_name,
        "rate": payload.rate,
        "unit": payload.unit,
        "operator": payload.operator,
        "grow_room": payload.grow_room,
        "batch_record_id": payload.batch_record_id,
        "notes": payload.notes,
    }).execute()
    return row.data[0]

@app.patch("/input-records/{record_id}")
def update_input_record(record_id: str, payload: InputRecordUpdate, auth = Depends(verify_token)):
    check = auth["client"].table("input_records") \
        .select("id") \
        .eq("id", record_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="input record not found")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "input_date" in updates:
        updates["input_date"] = str(updates["input_date"])
    if not updates:
        raise HTTPException(status_code=422, detail="no fields to update")
    row = supabase.table("input_records").update(updates) \
        .eq("id", record_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    return row.data[0]

@app.delete("/input-records/{record_id}")
def delete_input_record(record_id: str, auth = Depends(verify_token)):
    check = auth["client"].table("input_records") \
        .select("id") \
        .eq("id", record_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="input record not found")
    supabase.table("input_records") \
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("id", record_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    return {"deleted": record_id}



# ── Phase 9: Staff & Training Records ────────────────────────────────────────
class StaffMemberIn(BaseModel):
    name: str = Field(..., max_length=100)
    role: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    start_date: Optional[date] = None
    status: Optional[Literal["active", "inactive"]] = "active"
    notes: Optional[str] = Field(None, max_length=500)

class StaffMemberUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    role: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    start_date: Optional[date] = None
    status: Optional[Literal["active", "inactive"]] = None
    notes: Optional[str] = Field(None, max_length=500)

class StaffTrainingIn(BaseModel):
    staff_id: str
    sop_id: Optional[str] = None
    training_date: date
    trainer: Optional[str] = Field(None, max_length=100)
    training_type: Optional[Literal["initial", "refresher", "certification"]] = "initial"
    expiry_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=500)

class VisitorLogIn(BaseModel):
    visitor_name: str = Field(..., max_length=100)
    organization: Optional[str] = Field(None, max_length=100)
    purpose: Optional[str] = Field(None, max_length=200)
    visit_date: date
    host_name: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)

# ── Phase 8: Environmental Monitoring ────────────────────────────────────────
class GrowRoomIn(BaseModel):
    name: str = Field(..., max_length=100)
    room_type: Optional[Literal["veg", "flower", "mother", "clone", "drying", "other"]] = None
    capacity_plants: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=500)

class GrowRoomUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    room_type: Optional[Literal["veg", "flower", "mother", "clone", "drying", "other"]] = None
    capacity_plants: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=500)

class EnvironmentalLogIn(BaseModel):
    grow_room_id: str
    log_date: date
    temp_min: Optional[float] = Field(None, ge=-10, le=60)
    temp_max: Optional[float] = Field(None, ge=-10, le=60)
    humidity_min: Optional[float] = Field(None, ge=0, le=100)
    humidity_max: Optional[float] = Field(None, ge=0, le=100)
    co2_ppm: Optional[int] = Field(None, ge=0, le=10000)
    vpd: Optional[float] = Field(None, ge=0, le=10)
    notes: Optional[str] = Field(None, max_length=500)

class EnvironmentalLogUpdate(BaseModel):
    log_date: Optional[date] = None
    temp_min: Optional[float] = Field(None, ge=-10, le=60)
    temp_max: Optional[float] = Field(None, ge=-10, le=60)
    humidity_min: Optional[float] = Field(None, ge=0, le=100)
    humidity_max: Optional[float] = Field(None, ge=0, le=100)
    co2_ppm: Optional[int] = Field(None, ge=0, le=10000)
    vpd: Optional[float] = Field(None, ge=0, le=10)
    notes: Optional[str] = Field(None, max_length=500)

# ── Phase 7: SOP Management ───────────────────────────────────────────────────
@app.get("/sops")
def list_sops(status: Optional[str] = None, category: Optional[str] = None, limit: int = Query(50, le=200), offset: int = 0, auth = Depends(verify_token)):
    q = auth["client"].table("sops") \
        .select("*, sop_acknowledgments(id, staff_name, acknowledged_at)") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .order("created_at", desc=True)
    if status:
        q = q.eq("status", status)
    if category:
        q = q.eq("category", category)
    return q.range(offset, offset + limit - 1).execute().data or []

@app.post("/sops")
def create_sop(payload: SOPIn, auth = Depends(verify_token)):
    existing = auth["client"].table("sops") \
        .select("id") \
        .eq("farm_id", auth["farm_id"]) \
        .eq("sop_code", payload.sop_code) \
        .eq("version", payload.version) \
        .is_("deleted_at", "null") \
        .execute()
    if existing.data:
        raise HTTPException(status_code=409, detail=f"SOP '{payload.sop_code}' v{payload.version} already exists")
    row = supabase.table("sops").insert({
        "farm_id": auth["farm_id"],
        "title": payload.title,
        "sop_code": payload.sop_code,
        "version": payload.version,
        "category": payload.category,
        "status": payload.status,
        "effective_date": payload.effective_date.isoformat() if payload.effective_date else None,
        "review_date": payload.review_date.isoformat() if payload.review_date else None,
        "approved_by": payload.approved_by,
        "document_url": payload.document_url,
        "notes": payload.notes,
    }).execute()
    return row.data[0]

@app.patch("/sops/{sop_id}")
def update_sop(sop_id: str, payload: SOPUpdate, auth = Depends(verify_token)):
    check = auth["client"].table("sops") \
        .select("id") \
        .eq("id", sop_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="SOP not found")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    for date_field in ["effective_date", "review_date"]:
        if date_field in updates:
            updates[date_field] = str(updates[date_field])
    if not updates:
        raise HTTPException(status_code=422, detail="no fields to update")
    row = supabase.table("sops").update(updates) \
        .eq("id", sop_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    return row.data[0]

@app.delete("/sops/{sop_id}")
def delete_sop(sop_id: str, auth = Depends(verify_token)):
    check = auth["client"].table("sops") \
        .select("id") \
        .eq("id", sop_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="SOP not found")
    supabase.table("sops") \
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("id", sop_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    return {"deleted": sop_id}

@app.post("/sops/{sop_id}/acknowledge")
def acknowledge_sop(sop_id: str, payload: SOPAcknowledgmentIn, auth = Depends(verify_token)):
    check = auth["client"].table("sops") \
        .select("id") \
        .eq("id", sop_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="SOP not found")
    row = supabase.table("sop_acknowledgments").insert({
        "farm_id": auth["farm_id"],
        "sop_id": sop_id,
        "staff_name": payload.staff_name,
        "notes": payload.notes,
    }).execute()
    return row.data[0]


# ── Phase 9: Staff & Training Records ────────────────────────────────────────
class StaffMemberIn(BaseModel):
    name: str = Field(..., max_length=100)
    role: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    start_date: Optional[date] = None
    status: Optional[Literal["active", "inactive"]] = "active"
    notes: Optional[str] = Field(None, max_length=500)

class StaffMemberUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    role: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    start_date: Optional[date] = None
    status: Optional[Literal["active", "inactive"]] = None
    notes: Optional[str] = Field(None, max_length=500)

class StaffTrainingIn(BaseModel):
    staff_id: str
    sop_id: Optional[str] = None
    training_date: date
    trainer: Optional[str] = Field(None, max_length=100)
    training_type: Optional[Literal["initial", "refresher", "certification"]] = "initial"
    expiry_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=500)

class VisitorLogIn(BaseModel):
    visitor_name: str = Field(..., max_length=100)
    organization: Optional[str] = Field(None, max_length=100)
    purpose: Optional[str] = Field(None, max_length=200)
    visit_date: date
    host_name: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)

# ── Phase 8: Environmental Monitoring ────────────────────────────────────────
@app.get("/grow-rooms")
def list_grow_rooms(auth = Depends(verify_token)):
    rows = auth["client"].table("grow_rooms") \
        .select("*") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .order("name") \
        .execute()
    return rows.data or []

@app.post("/grow-rooms")
def create_grow_room(payload: GrowRoomIn, auth = Depends(verify_token)):
    existing = auth["client"].table("grow_rooms") \
        .select("id") \
        .eq("farm_id", auth["farm_id"]) \
        .eq("name", payload.name) \
        .is_("deleted_at", "null") \
        .execute()
    if existing.data:
        raise HTTPException(status_code=409, detail=f"Grow room '{payload.name}' already exists")
    row = supabase.table("grow_rooms").insert({
        "farm_id": auth["farm_id"],
        "name": payload.name,
        "room_type": payload.room_type,
        "capacity_plants": payload.capacity_plants,
        "notes": payload.notes,
    }).execute()
    return row.data[0]

@app.delete("/grow-rooms/{room_id}")
def delete_grow_room(room_id: str, auth = Depends(verify_token)):
    check = auth["client"].table("grow_rooms") \
        .select("id") \
        .eq("id", room_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="grow room not found")
    supabase.table("grow_rooms") \
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("id", room_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    return {"deleted": room_id}

@app.get("/environmental-logs")
def list_environmental_logs(grow_room_id: Optional[str] = None, limit: int = Query(50, le=200), offset: int = 0, auth = Depends(verify_token)):
    q = auth["client"].table("environmental_logs") \
        .select("*, grow_rooms(name)") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .order("log_date", desc=True)
    if grow_room_id:
        q = q.eq("grow_room_id", grow_room_id)
    return q.range(offset, offset + limit - 1).execute().data or []

@app.post("/environmental-logs")
def create_environmental_log(payload: EnvironmentalLogIn, auth = Depends(verify_token)):
    room_check = auth["client"].table("grow_rooms") \
        .select("id") \
        .eq("id", payload.grow_room_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    if not room_check.data:
        raise HTTPException(status_code=404, detail="grow room not found")
    row = supabase.table("environmental_logs").insert({
        "farm_id": auth["farm_id"],
        "grow_room_id": payload.grow_room_id,
        "log_date": payload.log_date.isoformat(),
        "temp_min": payload.temp_min,
        "temp_max": payload.temp_max,
        "humidity_min": payload.humidity_min,
        "humidity_max": payload.humidity_max,
        "co2_ppm": payload.co2_ppm,
        "vpd": payload.vpd,
        "notes": payload.notes,
    }).execute()
    return row.data[0]

@app.delete("/environmental-logs/{log_id}")
def delete_environmental_log(log_id: str, auth = Depends(verify_token)):
    check = auth["client"].table("environmental_logs") \
        .select("id") \
        .eq("id", log_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="environmental log not found")
    supabase.table("environmental_logs") \
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("id", log_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    return {"deleted": log_id}

# ── Phase 9: Staff & Training Records ────────────────────────────────────────
@app.get("/staff")
def list_staff(auth = Depends(verify_token)):
    rows = auth["client"].table("staff_members") \
        .select("*, staff_training(id, training_date, expiry_date, sop_id, training_type, sops(title))") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .order("name") \
        .execute()
    return rows.data or []

@app.post("/staff")
def create_staff(payload: StaffMemberIn, auth = Depends(verify_token)):
    row = supabase.table("staff_members").insert({
        "farm_id": auth["farm_id"],
        "name": payload.name,
        "role": payload.role,
        "email": payload.email,
        "phone": payload.phone,
        "start_date": payload.start_date.isoformat() if payload.start_date else None,
        "status": payload.status,
        "notes": payload.notes,
    }).execute()
    return row.data[0]

@app.patch("/staff/{staff_id}")
def update_staff(staff_id: str, payload: StaffMemberUpdate, auth = Depends(verify_token)):
    check = auth["client"].table("staff_members") \
        .select("id") \
        .eq("id", staff_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="staff member not found")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "start_date" in updates:
        updates["start_date"] = str(updates["start_date"])
    if not updates:
        raise HTTPException(status_code=422, detail="no fields to update")
    row = supabase.table("staff_members").update(updates) \
        .eq("id", staff_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    return row.data[0]

@app.delete("/staff/{staff_id}")
def delete_staff(staff_id: str, auth = Depends(verify_token)):
    check = auth["client"].table("staff_members") \
        .select("id") \
        .eq("id", staff_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="staff member not found")
    supabase.table("staff_members") \
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("id", staff_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    return {"deleted": staff_id}

@app.post("/staff/{staff_id}/training")
def add_training(staff_id: str, payload: StaffTrainingIn, auth = Depends(verify_token)):
    check = auth["client"].table("staff_members") \
        .select("id") \
        .eq("id", staff_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="staff member not found")
    row = supabase.table("staff_training").insert({
        "farm_id": auth["farm_id"],
        "staff_id": staff_id,
        "sop_id": payload.sop_id,
        "training_date": payload.training_date.isoformat(),
        "trainer": payload.trainer,
        "training_type": payload.training_type,
        "expiry_date": payload.expiry_date.isoformat() if payload.expiry_date else None,
        "notes": payload.notes,
    }).execute()
    return row.data[0]

@app.delete("/staff/training/{training_id}")
def delete_training(training_id: str, auth = Depends(verify_token)):
    check = auth["client"].table("staff_training") \
        .select("id") \
        .eq("id", training_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="training record not found")
    supabase.table("staff_training") \
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("id", training_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    return {"deleted": training_id}

@app.get("/visitor-log")
def list_visitors(auth = Depends(verify_token)):
    rows = auth["client"].table("visitor_log") \
        .select("*") \
        .eq("farm_id", auth["farm_id"]) \
        .order("visit_date", desc=True) \
        .execute()
    return rows.data or []

@app.post("/visitor-log")
def log_visitor(payload: VisitorLogIn, auth = Depends(verify_token)):
    row = supabase.table("visitor_log").insert({
        "farm_id": auth["farm_id"],
        "visitor_name": payload.visitor_name,
        "organization": payload.organization,
        "purpose": payload.purpose,
        "visit_date": payload.visit_date.isoformat(),
        "host_name": payload.host_name,
        "notes": payload.notes,
    }).execute()
    return row.data[0]


# ── Phase 12: Export Records ──────────────────────────────────────────────────
class ExportRecordIn(BaseModel):
    batch_code: Optional[str] = Field(None, max_length=100)
    strain_id: Optional[str] = None
    destination_country: str = Field(..., max_length=100)
    exporter_name: Optional[str] = Field(None, max_length=200)
    export_date: Optional[date] = None
    certificate_number: Optional[str] = Field(None, max_length=100)
    status: Optional[Literal["pending", "approved", "shipped", "completed", "cancelled"]] = "pending"
    notes: Optional[str] = Field(None, max_length=1000)

class ExportRecordUpdate(BaseModel):
    batch_code: Optional[str] = Field(None, max_length=100)
    strain_id: Optional[str] = None
    destination_country: Optional[str] = Field(None, max_length=100)
    exporter_name: Optional[str] = Field(None, max_length=200)
    export_date: Optional[date] = None
    certificate_number: Optional[str] = Field(None, max_length=100)
    status: Optional[Literal["pending", "approved", "shipped", "completed", "cancelled"]] = None
    notes: Optional[str] = Field(None, max_length=1000)

# ── Phase 11: Pesticide Residue Intelligence ─────────────────────────────────
@app.get("/pesticide-results")
def list_pesticide_results(result: Optional[str] = None, limit: int = Query(100, le=500), offset: int = 0, auth = Depends(verify_token)):
    q = auth["client"].table("pesticide_results") \
        .select("*, coa_reports(sample_name, lab_name, report_date, strain_id, strains(name))") \
        .eq("farm_id", auth["farm_id"]) \
        .order("created_at", desc=True)
    if result:
        q = q.eq("result", result)
    rows = q.range(offset, offset + limit - 1).execute()
    data = rows.data or []
    result_list = []
    for r in data:
        report = r.get("coa_reports") or {}
        strain = report.get("strains") or {}
        result_list.append({
            "id": r["id"],
            "compound_name": r["compound_name"],
            "value_ppb": r.get("value_ppb"),
            "lod_ppb": r.get("lod_ppb"),
            "loq_ppb": r.get("loq_ppb"),
            "action_limit_ppb": r.get("action_limit_ppb"),
            "result": r.get("result"),
            "strain": strain.get("name"),
            "lab": LAB_DISPLAY.get(report.get("lab_name"), report.get("lab_name")),
            "report_date": report.get("report_date"),
            "sample_name": report.get("sample_name"),
        })
    return result_list

# ── Phase 12: Export Records ──────────────────────────────────────────────────
@app.get("/export-records")
def list_export_records(limit: int = Query(50, le=200), offset: int = 0, auth = Depends(verify_token)):
    rows = auth["client"].table("export_records") \
        .select("*, strains(name)") \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .order("created_at", desc=True) \
        .range(offset, offset + limit - 1) \
        .execute()
    return rows.data or []

@app.post("/export-records")
def create_export_record(payload: ExportRecordIn, auth = Depends(verify_token)):
    row = supabase.table("export_records").insert({
        "farm_id": auth["farm_id"],
        "batch_code": payload.batch_code,
        "strain_id": payload.strain_id,
        "destination_country": payload.destination_country,
        "exporter_name": payload.exporter_name,
        "export_date": payload.export_date.isoformat() if payload.export_date else None,
        "certificate_number": payload.certificate_number,
        "status": payload.status,
        "notes": payload.notes,
    }).execute()
    return row.data[0]

@app.patch("/export-records/{record_id}")
def update_export_record(record_id: str, payload: ExportRecordUpdate, auth = Depends(verify_token)):
    check = auth["client"].table("export_records") \
        .select("id") \
        .eq("id", record_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="export record not found")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "export_date" in updates:
        updates["export_date"] = str(updates["export_date"])
    if not updates:
        raise HTTPException(status_code=422, detail="no fields to update")
    row = supabase.table("export_records").update(updates) \
        .eq("id", record_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    return row.data[0]

@app.delete("/export-records/{record_id}")
def delete_export_record(record_id: str, auth = Depends(verify_token)):
    check = auth["client"].table("export_records") \
        .select("id") \
        .eq("id", record_id) \
        .eq("farm_id", auth["farm_id"]) \
        .is_("deleted_at", "null") \
        .execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="export record not found")
    supabase.table("export_records") \
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("id", record_id) \
        .eq("farm_id", auth["farm_id"]) \
        .execute()
    return {"deleted": record_id}

# ── GACP Compliance Checklist ─────────────────────────────────────────────────
@app.get("/compliance-checklist/{strain_name}")
def compliance_checklist(strain_name: str, auth = Depends(verify_token)):
    from datetime import datetime, timedelta, timezone as tz
    client = auth["client"]
    farm_id = auth["farm_id"]
    ninety_days_ago = (datetime.now(tz.utc) - timedelta(days=90)).date().isoformat()
    checks = []

    # 1. Strain exists
    strain_row = client.table("strains").select("id").eq("farm_id", farm_id).eq("name", strain_name).is_("deleted_at", "null").execute()
    if not strain_row.data:
        raise HTTPException(status_code=404, detail="strain not found")
    strain_id = strain_row.data[0]["id"]

    # 2. Seed lot with import permit
    seed_lots = client.table("seed_lots").select("id, import_permit_number, phytosanitary_cert_number").eq("farm_id", farm_id).eq("strain_id", strain_id).is_("deleted_at", "null").execute()
    has_seed_lot = bool(seed_lots.data)
    has_import_permit = any(r.get("import_permit_number") for r in (seed_lots.data or []))
    has_phyto_cert = any(r.get("phytosanitary_cert_number") for r in (seed_lots.data or []))
    checks.append({"id": "seed_lot", "label": "Seed lot registered", "passed": has_seed_lot, "severity": "high", "message": None if has_seed_lot else "No seed lot found for this strain"})
    checks.append({"id": "import_permit", "label": "Import permit on file", "passed": has_import_permit, "severity": "high", "message": None if has_import_permit else "Seed lot missing import permit number"})
    checks.append({"id": "phyto_cert", "label": "Phytosanitary certificate on file", "passed": has_phyto_cert, "severity": "medium", "message": None if has_phyto_cert else "Seed lot missing phytosanitary certificate"})

    # 3. Mother plant records
    mother_plants = client.table("mother_plants").select("id, plant_code, hlvd_tested, hlvd_result, health_status").eq("farm_id", farm_id).eq("strain_id", strain_id).is_("deleted_at", "null").execute()
    has_mother = bool(mother_plants.data)
    all_hlvd_tested = all(r.get("hlvd_tested") for r in (mother_plants.data or []))
    any_hlvd_positive = any(r.get("hlvd_result") == "positive" for r in (mother_plants.data or []))
    checks.append({"id": "mother_plant", "label": "Mother plant registered", "passed": has_mother, "severity": "high", "message": None if has_mother else "No mother plant found for this strain"})
    checks.append({"id": "hlvd_tested", "label": "All mother plants HLVd tested", "passed": has_mother and all_hlvd_tested, "severity": "high", "message": None if (has_mother and all_hlvd_tested) else "One or more mother plants missing HLVd test result"})
    checks.append({"id": "hlvd_negative", "label": "No HLVd positive mother plants", "passed": not any_hlvd_positive, "severity": "critical", "message": None if not any_hlvd_positive else "One or more mother plants tested HLVd positive — quarantine required"})

    # 4. COA records
    report_ids_row = client.table("coa_reports").select("id, report_date").eq("farm_id", farm_id).eq("strain_id", strain_id).is_("deleted_at", "null").order("report_date", desc=True).execute()
    has_coa = bool(report_ids_row.data)
    latest_report_date = report_ids_row.data[0]["report_date"] if report_ids_row.data else None
    recent_coa = latest_report_date and latest_report_date >= ninety_days_ago
    checks.append({"id": "coa_uploaded", "label": "COA on file", "passed": has_coa, "severity": "critical", "message": None if has_coa else "No Certificate of Analysis found for this strain"})
    checks.append({"id": "coa_recent", "label": "COA tested within 90 days", "passed": bool(recent_coa), "severity": "high", "message": None if recent_coa else f"Last COA dated {latest_report_date} — retesting recommended" if latest_report_date else "No COA on file"})

    # 5. Consistency status
    consistency_row = client.table("strain_consistency").select("status, stability_score").eq("farm_id", farm_id).eq("strain_name", strain_name).eq("compound_name", "THCA").execute()
    status = consistency_row.data[0]["status"] if consistency_row.data else None
    not_drifting = status not in ("drift",)
    checks.append({"id": "consistency", "label": "Strain consistency stable", "passed": not_drifting, "severity": "medium", "message": None if not_drifting else f"Strain THCA consistency status is {status} — investigate batch variation"})

    # 6. Trial/grow conditions recorded
    trials = client.table("trials").select("id").eq("farm_id", farm_id).eq("strain_id", strain_id).is_("deleted_at", "null").execute()
    has_trial = bool(trials.data)
    checks.append({"id": "trial", "label": "Growing conditions recorded", "passed": has_trial, "severity": "medium", "message": None if has_trial else "No trial/grow conditions recorded for this strain"})

    # 7. Input records
    input_rows = client.table("input_records").select("id").eq("farm_id", farm_id).is_("deleted_at", "null").limit(1).execute()
    has_inputs = bool(input_rows.data)
    checks.append({"id": "input_records", "label": "Agricultural input records on file", "passed": has_inputs, "severity": "high", "message": None if has_inputs else "No fertilizer or pesticide input records found"})

    # 8. SOPs
    sops = client.table("sops").select("id, status, review_date").eq("farm_id", farm_id).eq("status", "active").is_("deleted_at", "null").execute()
    has_active_sop = bool(sops.data)
    from datetime import date
    today = date.today().isoformat()
    overdue_sops = [r for r in (sops.data or []) if r.get("review_date") and r["review_date"] < today]
    checks.append({"id": "sops", "label": "Active SOPs registered", "passed": has_active_sop, "severity": "high", "message": None if has_active_sop else "No active SOPs found — GACP requires documented procedures"})
    checks.append({"id": "sop_review", "label": "No SOPs overdue for review", "passed": not overdue_sops, "severity": "medium", "message": None if not overdue_sops else f"{len(overdue_sops)} SOP(s) overdue for review"})

    # 9. Staff training
    staff_training = client.table("staff_training").select("id").eq("farm_id", farm_id).is_("deleted_at", "null").limit(1).execute()
    has_training = bool(staff_training.data)
    checks.append({"id": "staff_training", "label": "Staff training records on file", "passed": has_training, "severity": "medium", "message": None if has_training else "No staff training records found"})

    # 10. Environmental logs (last 30 days)
    thirty_days_ago = (datetime.now(tz.utc) - timedelta(days=30)).date().isoformat()
    env_logs = client.table("environmental_logs").select("id").eq("farm_id", farm_id).gte("log_date", thirty_days_ago).is_("deleted_at", "null").limit(1).execute()
    has_env_logs = bool(env_logs.data)
    checks.append({"id": "env_logs", "label": "Environmental logs in last 30 days", "passed": has_env_logs, "severity": "medium", "message": None if has_env_logs else "No environmental logs in the last 30 days"})

    passed = sum(1 for c in checks if c["passed"])
    total = len(checks)
    critical_failures = [c for c in checks if not c["passed"] and c["severity"] == "critical"]
    
    return {
        "strain": strain_name,
        "score": passed,
        "total": total,
        "percent": round(passed / total * 100),
        "ready": len(critical_failures) == 0,
        "critical_failures": len(critical_failures),
        "checks": checks,
    }
