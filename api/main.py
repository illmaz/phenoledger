import os
import re
import uuid
import tempfile
from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from api.dependencies import s3, supabase
from phenoledger.lab_detector import detect, LabFamily
from phenoledger.extractors.sclabs import extract as sclabs_extract
from phenoledger.extractors.confident_lims import extract as confident_lims_extract

FARM_ID = "fd1c1598-8769-4da9-a885-2f74bca047d6"

LAB_DISPLAY = {
    "sclabs":             "SC Labs",
    "confident_cannabis": "Confident Cannabis",
    "confident_lims":     "Confident LIMS",
    "fesa_labs":          "FESA Labs",
    "new_bloom":          "New Bloom Labs",
    "marin_analytics":    "Marin Analytics",
    "analytics_labs":     "Analytics Labs",
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
    return name.replace('_', ' ').title()

_CONCENTRATE_KW = ['rosin', 'wax', 'live resin', 'hash', 'badder', 'batter', 'sauce',
                   'diamonds', 'crumble', 'shatter', 'kief', 'sift', 'bubble', 'ice water']
_EXTRACT_KW     = ['distillate', 'isolate', 'tincture', 'rso', 'oil', 'cartridge',
                   'extract', 'co2', 'nano', 'tincture']

def _infer_sample_type(name: str) -> str:
    lower = name.lower()
    if any(k in lower for k in _CONCENTRATE_KW):
        return 'concentrate'
    if any(k in lower for k in _EXTRACT_KW):
        return 'extract'
    return 'flower'

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/upload")
async def upload_coa(file: UploadFile):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="only PDF files accepted")

    contents = await file.read()

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
    elif lab == LabFamily.CONFIDENT_LIMS:
        raw = confident_lims_extract(tmp_path)
        extracted = {"cannabinoids": raw, "terpenes": []}
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

    for r in extracted["terpenes"]:
        if r["value_pct"] is None:
            continue
        supabase.table("terpene_results").insert({
            "farm_id": FARM_ID,
            "report_id": report_id,
            "compound_name": r["compound"],
            "value_pct": float(r["value_pct"]),
            "value_raw": float(r["value_mg_g"]) if r["value_mg_g"] else None,
            "unit_raw": "mg/g",
        }).execute()

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
def list_uploads():
    rows = supabase.table("coa_uploads") \
        .select("id, original_filename, extraction_status, created_at, coa_reports(lab_name)") \
        .eq("farm_id", FARM_ID) \
        .order("created_at", desc=True) \
        .limit(10) \
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
            "created_at": r["created_at"],
        })
    return result


@app.get("/uploads/count")
def uploads_count():
    rows = supabase.table("coa_uploads") \
        .select("id", count="exact") \
        .eq("farm_id", FARM_ID) \
        .execute()
    return {"count": rows.count or 0}


@app.get("/consistency")
def consistency():
    rows = supabase.table("cannabinoid_results") \
        .select("value_pct, coa_reports(sample_name, coa_uploads(original_filename))") \
        .eq("farm_id", FARM_ID) \
        .eq("compound_name", "THCA") \
        .not_.is_("value_pct", "null") \
        .order("created_at", desc=True) \
        .limit(12) \
        .execute()
    data: list[dict] = rows.data  # type: ignore[assignment]
    result = []
    for r in data:
        report = r.get("coa_reports") or {}
        upload = report.get("coa_uploads") or {}
        filename = upload.get("original_filename", "")
        strain = report.get("sample_name") or (_display_name(filename) if filename else "Unknown")
        val = r.get("value_pct")
        if val is not None:
            result.append({"strain": strain, "thca": round(float(val), 2)})
    return result

@app.get("/strains")
def list_strains():
    rows = supabase.table("cannabinoid_results") \
        .select("value_pct, created_at, coa_reports(sample_name, lab_name, coa_uploads(original_filename))") \
        .eq("farm_id", FARM_ID) \
        .eq("compound_name", "THCA") \
        .not_.is_("value_pct", "null") \
        .order("created_at", desc=True) \
        .execute()
    data: list[dict] = rows.data  # type: ignore[assignment]
    # Collect all readings per strain; dict preserves insertion order so index 0 is latest
    strain_vals: dict[str, list[float]] = {}
    strain_labs: dict[str, str | None] = {}
    for r in data:
        report = r.get("coa_reports") or {}
        upload = report.get("coa_uploads") or {}
        filename = upload.get("original_filename", "")
        strain = report.get("sample_name") or (_display_name(filename) if filename else "Unknown")
        strain_vals.setdefault(strain, []).append(float(r["value_pct"]))
        if strain not in strain_labs:
            lab_raw = report.get("lab_name")
            strain_labs[strain] = LAB_DISPLAY.get(lab_raw, lab_raw) if lab_raw else None
    result = []
    for strain, vals in strain_vals.items():
        avg = sum(vals) / len(vals)
        if len(vals) > 1 and avg > 0:
            variance = sum((v - avg) ** 2 for v in vals) / len(vals)
            std_dev = variance ** 0.5
            cv = (std_dev / avg) * 100
        else:
            cv = 0.0
        stability = round(max(0.0, 100.0 - cv))
        if cv < 5:
            status = "excellent"
        elif cv < 10:
            status = "good"
        elif cv < 15:
            status = "watch"
        else:
            status = "drift"
        result.append({
            "strain": strain,
            "thca": round(vals[0], 2),
            "upload_count": len(vals),
            "status": status,
            "stability": stability,
            "lab": strain_labs.get(strain),
            "sample_type": _infer_sample_type(strain),
        })
    return result


@app.get("/strain/{strain_name}/cannabinoids")
def strain_cannabinoids(strain_name: str):
    reports_rows = supabase.table("coa_reports") \
        .select("id, sample_name, coa_uploads(original_filename)") \
        .eq("farm_id", FARM_ID) \
        .execute()
    reports_data: list[dict] = reports_rows.data  # type: ignore[assignment]
    matching_ids = []
    for r in reports_data:
        upload = r.get("coa_uploads") or {}
        filename = upload.get("original_filename", "")
        name = r.get("sample_name") or (_display_name(filename) if filename else "Unknown")
        if name == strain_name:
            matching_ids.append(r["id"])
    if not matching_ids:
        return []
    cann_rows = supabase.table("cannabinoid_results") \
        .select("compound_name, value_pct") \
        .in_("report_id", matching_ids) \
        .not_.is_("value_pct", "null") \
        .execute()
    cann_data: list[dict] = cann_rows.data  # type: ignore[assignment]
    # Average across batches so each compound appears once
    grouped: dict[str, list[float]] = {}
    for r in cann_data:
        grouped.setdefault(r["compound_name"], []).append(float(r["value_pct"]))
    return sorted(
        [{"compound": name, "value_pct": round(sum(vals) / len(vals), 4)} for name, vals in grouped.items()],
        key=lambda x: x["value_pct"],
        reverse=True,
    )

@app.get("/strain/{strain_name}/batches")
def strain_batches(strain_name: str):
    reports_rows = supabase.table("coa_reports") \
        .select("id, upload_id, sample_name, coa_uploads(original_filename, extraction_status, created_at)") \
        .eq("farm_id", FARM_ID) \
        .execute()
    reports_data: list[dict] = reports_rows.data  # type: ignore[assignment]
    matching = []
    for r in reports_data:
        upload = r.get("coa_uploads") or {}
        filename = upload.get("original_filename", "")
        name = r.get("sample_name") or (_display_name(filename) if filename else "Unknown")
        if name == strain_name:
            matching.append({
                "report_id": r["id"],
                "date": upload.get("created_at"),
                "status": upload.get("extraction_status"),
            })
    if not matching:
        return []
    matching_ids = [m["report_id"] for m in matching]
    cann_rows = supabase.table("cannabinoid_results") \
        .select("report_id, compound_name, value_pct") \
        .in_("report_id", matching_ids) \
        .in_("compound_name", ["THCA", "CBD"]) \
        .not_.is_("value_pct", "null") \
        .execute()
    cann_data: list[dict] = cann_rows.data  # type: ignore[assignment]
    cann_by_report: dict[str, dict] = {}
    for r in cann_data:
        cann_by_report.setdefault(r["report_id"], {})[r["compound_name"]] = float(r["value_pct"])
    terp_rows = supabase.table("terpene_results") \
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
def strain_terpenes(strain_name: str):
    reports_rows = supabase.table("coa_reports") \
        .select("id, sample_name, coa_uploads(original_filename)") \
        .eq("farm_id", FARM_ID) \
        .execute()
    reports_data: list[dict] = reports_rows.data  # type: ignore[assignment]
    matching_ids = []
    for r in reports_data:
        upload = r.get("coa_uploads") or {}
        filename = upload.get("original_filename", "")
        name = r.get("sample_name") or (_display_name(filename) if filename else "Unknown")
        if name == strain_name:
            matching_ids.append(r["id"])
    if not matching_ids:
        return []
    rows = supabase.table("terpene_results") \
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