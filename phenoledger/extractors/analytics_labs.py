import re
from pathlib import Path
import pdfplumber
from phenoledger.normaliser import canonical_compound, parse_and_normalise, parse_numeric


def _parse_block(block: str) -> list[dict]:
    results = []
    for line in block.strip().split("\n"):
        parts = line.split()
        if len(parts) < 4:
            continue
        if parts[0].upper() in ("ANALYTE", "LOD", "LOQ", "RESULT", "%", "MG/G"):
            continue
        compound = canonical_compound(parts[0])
        if compound in ("TOTAL", "ENTERED", "INSTRUMENT", "DATE", "LOD="):
            continue
        value_pct, needs_review = parse_and_normalise(parts[3], "%")
        value_mg_g = parse_numeric(parts[4]) if len(parts) > 4 else None
        results.append({
            "compound": compound,
            "value_pct": value_pct,
            "value_mg_g": value_mg_g,
            "needs_review": needs_review,
        })
    return results


def _parse_terpene_block(block: str) -> list[dict]:
    results = []
    for line in block.strip().split("\n"):
        parts = line.split()
        if len(parts) < 5:
            continue
        if parts[0].upper() in ("ANALYTE", "LOD", "LOQ", "RESULT", "%", "MG/G", "CAS"):
            continue
        compound = canonical_compound(parts[0])
        if compound in ("TOTAL", "ENTERED", "PRIMARY", "AROMAS"):
            continue
        # Terpene rows have CAS# as second column, so result is at index 3
        value_pct, needs_review = parse_and_normalise(parts[3], "%")
        value_mg_g = parse_numeric(parts[4]) if len(parts) > 4 else None
        results.append({
            "compound": compound,
            "value_pct": value_pct,
            "value_mg_g": value_mg_g,
            "needs_review": needs_review,
        })
    return results


def extract(pdf_path: str | Path) -> dict:
    cannabinoids = []
    terpenes = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            if i == 0 and "Cannabinoids Complete" in text:
                start = text.index("Cannabinoids Complete")
                end = text.index("Entered by:") if "Entered by:" in text else len(text)
                cannabinoids = _parse_block(text[start:end])
            if i == 1 and "Terpenes" in text:
                start = text.index("Terpenes") + len("Terpenes")
                end = text.index("Primary Aromas") if "Primary Aromas" in text else len(text)
                terpenes = _parse_terpene_block(text[start:end])
    return {"cannabinoids": cannabinoids, "terpenes": terpenes}


def extract_header(pdf_path: str | Path) -> dict:
    with pdfplumber.open(pdf_path) as pdf:
        text = pdf.pages[0].extract_text() or ""
    header = {}
    m = re.search(r"Completed:\s+(\d{2}/\d{2}/\d{4})", text)
    if m:
        header["report_date"] = m.group(1)
    m = re.search(r"Strain:\s+([^\n]+?)\s+Completed:", text)
    if m:
        header["sample_name"] = m.group(1).strip()
    m = re.search(r"Sample ID:\s+(\S+)", text)
    if m:
        header["reported_batch_number"] = m.group(1)
    return header
