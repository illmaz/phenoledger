import os
import re
import uuid
import tempfile
import logging
import hashlib
from typing import Optional, Literal
from pydantic import BaseModel, Field
from fastapi import FastAPI, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from api.dependencies import s3, supabase, verify_token
from phenoledger.lab_detector import detect, LabFamily
from phenoledger.extractors.sclabs import extract as sclabs_extract, extract_header as sclabs_header
from phenoledger.extractors.confident_lims import extract as confident_lims_extract, extract_header as confident_lims_header
from phenoledger.extractors.botanacor import extract as botanacor_extract, extract_header as botanacor_header
from phenoledger.extractors.analytics_labs import extract as analytics_labs_extract, extract_header as analytics_labs_header
from datetime import datetime, timezone, date

FARM_ID = os.environ["FARM_ID"]

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
    notes: Optional[str] = Field(None, max_length=500)


class MotherPlantIn(BaseModel):
    plant_code: str = Field(..., max_length=50)
    strain_name: Optional[str] = None
    established_date: Optional[date] = None
    clone_generation: Optional[int] = Field(None, ge=0)
    health_status: Literal["healthy", "watch", "sick"] = "healthy"
    hlvd_tested: bool = False
    hlvd_result: Optional[Literal["negative", "positive", "pending"]] = None
    hlvd_test_date: Optional[date] = None
    last_cloned_date: Optional[date] = None
    total_clones_taken: Optional[int] = 0
    origin_country: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)

class PropagationIn(BaseModel):
    mother_plant_id: str
    report_id: Optional[str] = None
    propagation_date: date
    clones_taken: int = Field(..., ge=1)
    grow_type: Optional[Literal["indoor", "outdoor", "greenhouse"]] = None
    notes: Optional[str] = Field(None, max_length=500)


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
        .eq("farm_id", FARM_ID) \
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
        .eq("farm_id", FARM_ID) \
        .is_("deleted_at", "null") \
        .execute()
    coa_count = count_rows.count or 0

    uploads_rows = client.table("coa_uploads") \
        .select("id, original_filename, extraction_status, created_at, coa_reports(lab_name, report_date)") \
        .eq("farm_id", FARM_ID) \
        .is_("deleted_at", "null") \
        .order("created_at", desc=True) \
        .range(0, 4) \
        .execute()
    uploads_data: list[dict] = uploads_rows.data  # type: ignore[assignment]
    recent_uploads = []
    for r in uploads_data:
        reports = r.get("coa_reports") or []
        lab_raw = reports[0]["lab_name"] if reports else None
        recent_uploads.append({
            "id": r["id"],
            "name": _display_name(r["original_filename"]),
            "status": r["extraction_status"],
            "lab": LAB_DISPLAY.get(lab_raw, lab_raw) if lab_raw else None,
            "created_at": reports[0].get("report_date") or r["created_at"] if reports else r["created_at"],
        })

    consistency = [
        {"strain": r["strain_name"], "thca": round(float(r["avg_pct"] or 0), 2)}
        for r in strains_data
    ]

    alerts_rows = client.table("strain_consistency") \
        .select("strain_name, compound_name, status, cv_pct, stability_score") \
        .eq("farm_id", FARM_ID) \
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

    return {
        "strain_count": strain_count,
        "coa_count": coa_count,
        "avg_stability": avg_stability,
        "flagged_count": len({a["strain"] for a in alerts}),
        "recent_uploads": recent_uploads,
        "consistency": consistency,
        "alerts": alerts,
    }


@app.post("/upload")
async def upload_coa(file: UploadFile, current_user = Depends(verify_token)):
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
        .eq("farm_id", FARM_ID) \
        .eq("content_hash", content_hash) \
        .execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="This COA has already been uploaded")

    s3_key = f"coas/{uuid.uuid4()}.pdf"
    s3.put_object(
        Bucket=os.environ["AWS_S3_BUCKET"],
        Key=s3_key,
        Body=contents,
        ContentType="application/pdf",
    )

    upload = supabase.table("coa_uploads").insert({
        "farm_id": FARM_ID,
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

    lab = detect(tmp_path)

    report = supabase.table("coa_reports").insert({
        "farm_id": FARM_ID,
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
            "farm_id": FARM_ID,
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
                "farm_id": FARM_ID,
                "report_id": report_id,
                "compound_name": r["compound"],
                "value_pct": float(r["value_pct"]),
                "value_raw": float(r["value_mg_g"]) if r["value_mg_g"] else None,
                "unit_raw": "mg/g",
            }).execute()
        except Exception as e:
            logging.error("Terpene insert failed: %s — %s", r["compound"], e)

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
            .eq("farm_id", FARM_ID) \
            .eq("name", strain_name) \
            .is_("deleted_at", "null") \
            .execute()

        if existing.data:
            strain_id = existing.data[0]["id"]
        else:
            new_strain = supabase.table("strains").insert({
                "farm_id": FARM_ID,
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

    os.unlink(tmp_path)

    return {
        "upload_id": upload_id,
        "report_id": report_id,
        "lab": lab.value,
        "compounds_extracted": len(extracted["cannabinoids"]),
        "terpenes_extracted": len(extracted["terpenes"]),
    }


@app.get("/uploads")
def list_uploads(auth = Depends(verify_token), limit: int = 50, offset: int = 0):
    rows = auth["client"].table("coa_uploads") \
        .select("id, original_filename, extraction_status, created_at, coa_reports(lab_name, report_date, sample_name)") \
        .eq("farm_id", FARM_ID) \
        .is_("deleted_at", "null") \
        .order("created_at", desc=True) \
        .range(offset, offset + limit - 1) \
        .execute()
    data: list[dict] = rows.data  # type: ignore[assignment]
    result = []
    for r in data:
        reports = r.get("coa_reports") or []
        lab_raw = reports[0]["lab_name"] if reports else None
        result.append({
            "id": r["id"],
            "name": _display_name(r["original_filename"]),
            "filename": r["original_filename"],
            "status": r["extraction_status"],
            "lab": LAB_DISPLAY.get(lab_raw, lab_raw) if lab_raw else None,
            "created_at": reports[0].get("report_date") or r["created_at"] if reports else r["created_at"],
        })
    return result


@app.get("/uploads/count")
def uploads_count(auth = Depends(verify_token)):
    rows = (auth["client"].table("coa_uploads")
        .select("*", count="exact")
        .eq("farm_id", FARM_ID)
        .is_("deleted_at", "null")
        .execute())
    return {"count": rows.count or 0}


@app.get("/consistency")
def consistency(auth = Depends(verify_token)):
    rows = auth["client"].table("strain_consistency") \
        .select("strain_name, avg_pct") \
        .eq("farm_id", FARM_ID) \
        .eq("compound_name", "THCA") \
        .execute()
    data: list[dict] = rows.data  # type: ignore[assignment]
    return [
        {"strain": r["strain_name"], "thca": round(float(r["avg_pct"] or 0), 2)}
        for r in data
    ]

@app.get("/consistency/alerts")
def consistency_alerts(auth = Depends(verify_token)):
    rows = auth["client"].table("strain_consistency") \
        .select("strain_name, compound_name, status, cv_pct, stability_score") \
        .eq("farm_id", FARM_ID) \
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


@app.get("/strains")
def list_strains(auth = Depends(verify_token)):
    rows = auth["client"].table("strain_consistency") \
        .select("strain_id, strain_name, batch_count, avg_pct, stability_score, status, farm_id") \
        .eq("farm_id", FARM_ID) \
        .eq("compound_name", "THCA") \
        .execute()
    data: list[dict] = rows.data  # type: ignore[assignment]
    result = []
    for r in data:
        stability = round(float(r["stability_score"] or 0))
        result.append({
            "strain_id": r["strain_id"],
            "strain": r["strain_name"],
            "thca": round(float(r["avg_pct"] or 0), 2),
            "upload_count": r["batch_count"],
            "status": r["status"],
            "stability": stability,
            "sample_type": _infer_sample_type(r["strain_name"]),
        })
    return result


def _get_strain_report_ids(strain_name: str, client) -> list[str]:
    """Look up report IDs for a strain by name using strain_id join."""
    strain_row = client.table("strains") \
        .select("id") \
        .eq("farm_id", FARM_ID) \
        .eq("name", strain_name) \
        .is_("deleted_at", "null") \
        .execute()
    if not strain_row.data:
        return []
    strain_id = strain_row.data[0]["id"]
    reports = client.table("coa_reports") \
        .select("id") \
        .eq("strain_id", strain_id) \
        .is_("deleted_at", "null") \
        .execute()
    return [r["id"] for r in (reports.data or [])]


@app.get("/strain/{strain_name}/cannabinoids")
def strain_cannabinoids(strain_name: str, auth = Depends(verify_token)):
    matching_ids = _get_strain_report_ids(strain_name, auth["client"])
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
    matching_ids = _get_strain_report_ids(strain_name, auth["client"])
    if not matching_ids:
        return []
    reports_rows = auth["client"].table("coa_reports") \
        .select("id, upload_id, report_date, coa_uploads(original_filename, extraction_status, created_at)") \
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
        })
    return result


@app.get("/strain/{strain_name}/terpenes")
def strain_terpenes(strain_name: str, auth = Depends(verify_token)):
    matching_ids = _get_strain_report_ids(strain_name, auth["client"])
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
        .eq("farm_id", FARM_ID) \
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
def delete_strain(strain_name: str, current_user = Depends(verify_token)):
    now = datetime.now(timezone.utc).isoformat()
    strain_row = supabase.table("strains") \
        .select("id") \
        .eq("farm_id", FARM_ID) \
        .eq("name", strain_name) \
        .is_("deleted_at", "null") \
        .execute()
    strain_data: list[dict] = strain_row.data  # type: ignore[assignment]
    if not strain_data:
        raise HTTPException(status_code=404, detail="strain not found")
    strain_id = strain_data[0]["id"]
    reports = supabase.table("coa_reports") \
        .select("id, upload_id") \
        .eq("farm_id", FARM_ID) \
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
        .eq("farm_id", FARM_ID) \
        .execute()
    return {"deleted": strain_name}


# ── Genetic Lineage ───────────────────────────────────────────────────────────

@app.get("/mother-plants")
def list_mother_plants(auth = Depends(verify_token)):
    rows = auth["client"].table("mother_plants") \
        .select("*, strains(name)") \
        .eq("farm_id", FARM_ID) \
        .is_("deleted_at", "null") \
        .order("created_at", desc=True) \
        .execute()
    return rows.data


@app.post("/mother-plants")
def create_mother_plant(payload: MotherPlantIn, current_user = Depends(verify_token)):
    strain_id = None
    if payload.strain_name:
        existing = supabase.table("strains") \
            .select("id") \
            .eq("farm_id", FARM_ID) \
            .eq("name", payload.strain_name) \
            .is_("deleted_at", "null") \
            .execute()
        ex: list[dict] = existing.data  # type: ignore[assignment]
        if ex:
            strain_id = ex[0]["id"]
        else:
            ns = supabase.table("strains").insert({
                "farm_id": FARM_ID, "name": payload.strain_name,
            }).execute()
            ns_data: list[dict] = ns.data  # type: ignore[assignment]
            strain_id = ns_data[0]["id"] if ns_data else None
    existing_code = supabase.table("mother_plants") \
        .select("id") \
        .eq("farm_id", FARM_ID) \
        .eq("plant_code", payload.plant_code) \
        .is_("deleted_at", "null") \
        .execute()
    if existing_code.data:
        raise HTTPException(status_code=409, detail=f"Plant code '{payload.plant_code}' already exists")
    row = supabase.table("mother_plants").insert({
        "farm_id": FARM_ID,
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
    }).execute()
    row_data: list[dict] = row.data  # type: ignore[assignment]
    return row_data[0] if row_data else {}


@app.put("/mother-plants/{plant_id}")
def update_mother_plant(plant_id: str, payload: dict, current_user = Depends(verify_token)):
    allowed = {"health_status", "hlvd_result", "hlvd_test_date", "last_cloned_date",
               "total_clones_taken", "notes"}
    update = {k: v for k, v in payload.items() if k in allowed}
    if not update:
        update = {"retired_at": datetime.now(timezone.utc).isoformat()}
    supabase.table("mother_plants") \
        .update(update) \
        .eq("id", plant_id) \
        .eq("farm_id", FARM_ID) \
        .execute()
    return {"updated": plant_id}


@app.delete("/mother-plants/{plant_id}")
def delete_mother_plant(plant_id: str, current_user = Depends(verify_token)):
    result = supabase.table("mother_plants") \
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("id", plant_id) \
        .eq("farm_id", FARM_ID) \
        .execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="mother plant not found")
    return {"deleted": plant_id}


@app.get("/seed-lots")
def list_seed_lots(auth = Depends(verify_token)):
    rows = auth["client"].table("seed_lots") \
        .select("*, strains(name)") \
        .eq("farm_id", FARM_ID) \
        .is_("deleted_at", "null") \
        .order("created_at", desc=True) \
        .execute()
    return rows.data


@app.post("/seed-lots")
def create_seed_lot(payload: SeedLotIn, current_user = Depends(verify_token)):
    # Use strain_id directly if provided, otherwise look up by name
    strain_id = payload.strain_id or None
    if strain_id:
        strain_check = supabase.table("strains") \
            .select("id") \
            .eq("id", strain_id) \
            .eq("farm_id", FARM_ID) \
            .execute()
        if not strain_check.data:
            raise HTTPException(status_code=404, detail="strain not found")
    if not strain_id and payload.strain_name:
        existing = supabase.table("strains") \
            .select("id") \
            .eq("farm_id", FARM_ID) \
            .eq("name", payload.strain_name) \
            .is_("deleted_at", "null") \
            .execute()
        ex: list[dict] = existing.data  # type: ignore[assignment]
        if ex:
            strain_id = ex[0]["id"]
        else:
            ns = supabase.table("strains").insert({
                "farm_id": FARM_ID, "name": payload.strain_name,
            }).execute()
            ns_data: list[dict] = ns.data  # type: ignore[assignment]
            strain_id = ns_data[0]["id"] if ns_data else None
    existing_code = supabase.table("seed_lots") \
        .select("id") \
        .eq("farm_id", FARM_ID) \
        .eq("lot_code", payload.lot_code) \
        .is_("deleted_at", "null") \
        .execute()
    if existing_code.data:
        raise HTTPException(status_code=409, detail=f"Lot code '{payload.lot_code}' already exists")
    row = supabase.table("seed_lots").insert({
        "farm_id": FARM_ID,
        "lot_code": payload.lot_code,
        "strain_id": strain_id,
        "origin_country": payload.origin_country,
        "import_permit_number": payload.import_permit_number,
        "phytosanitary_cert_number": payload.phytosanitary_cert_number,
        "germination_rate": payload.germination_rate,
        "quantity_seeds": payload.quantity_seeds,
        "arrival_date": payload.arrival_date.isoformat() if payload.arrival_date else None,
        "notes": payload.notes,
    }).execute()
    row_data: list[dict] = row.data  # type: ignore[assignment]
    return row_data[0]


@app.put("/seed-lots/{lot_id}")
def update_seed_lot(lot_id: str, payload: dict, current_user = Depends(verify_token)):
    allowed = {"origin_country", "import_permit_number", "phytosanitary_cert_number",
               "germination_rate", "quantity_seeds", "arrival_date", "notes"}
    update = {k: v for k, v in payload.items() if k in allowed}
    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    result = supabase.table("seed_lots") \
        .update(update) \
        .eq("id", lot_id) \
        .eq("farm_id", FARM_ID) \
        .execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="seed lot not found")
    return {"updated": lot_id}

@app.delete("/seed-lots/{lot_id}")
def delete_seed_lot(lot_id: str, current_user = Depends(verify_token)):
    result = supabase.table("seed_lots") \
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("id", lot_id) \
        .eq("farm_id", FARM_ID) \
        .execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="seed lot not found")
    return {"deleted": lot_id}


@app.get("/strain/{strain_name}/lineage")
def strain_lineage(strain_name: str, auth = Depends(verify_token)):
    sr = auth["client"].table("strains") \
        .select("id") \
        .eq("farm_id", FARM_ID) \
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
        .eq("farm_id", FARM_ID) \
        .is_("deleted_at", "null") \
        .execute()
    mother_plants = auth["client"].table("mother_plants") \
        .select("*, propagations(*, coa_reports(id, sample_name, report_date))") \
        .eq("strain_id", sid) \
        .eq("farm_id", FARM_ID) \
        .is_("deleted_at", "null") \
        .execute()
    sl: list[dict] = seed_lots.data  # type: ignore[assignment]
    mp: list[dict] = mother_plants.data  # type: ignore[assignment]
    return {"seed_lots": sl, "mother_plants": mp}

# ── Propagations ──────────────────────────────────────────────────────────────

@app.get("/propagations")
def list_propagations(auth = Depends(verify_token)):
    rows = auth["client"].table("propagations") \
        .select("*, mother_plants(plant_code, strains(name)), coa_reports(sample_name, report_date)") \
        .eq("farm_id", FARM_ID) \
        .is_("deleted_at", "null") \
        .order("created_at", desc=True) \
        .execute()
    return rows.data

@app.post("/propagations")
def create_propagation(payload: PropagationIn, current_user = Depends(verify_token)):
    mp_check = supabase.table("mother_plants") \
        .select("id") \
        .eq("id", payload.mother_plant_id) \
        .eq("farm_id", FARM_ID) \
        .execute()
    if not mp_check.data:
        raise HTTPException(status_code=404, detail="mother plant not found")
    row = supabase.table("propagations").insert({
        "farm_id": FARM_ID,
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
def update_propagation(prop_id: str, payload: dict, current_user = Depends(verify_token)):
    allowed = {"propagation_date", "clones_taken", "grow_type", "notes", "report_id"}
    update = {k: v for k, v in payload.items() if k in allowed}
    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    result = supabase.table("propagations") \
        .update(update) \
        .eq("id", prop_id) \
        .eq("farm_id", FARM_ID) \
        .execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="propagation not found")
    return {"updated": prop_id}

@app.delete("/propagations/{prop_id}")
def delete_propagation(prop_id: str, current_user = Depends(verify_token)):
    result = supabase.table("propagations") \
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("id", prop_id) \
        .eq("farm_id", FARM_ID) \
        .execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="propagation not found")
    return {"deleted": prop_id}
