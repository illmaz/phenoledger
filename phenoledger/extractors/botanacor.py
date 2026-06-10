import re
from pathlib import Path
import pdfplumber
from phenoledger.normaliser import canonical_compound, parse_and_normalise, parse_numeric


def extract(pdf_path: str | Path) -> dict:
    cannabinoids = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if "Cannabinoids" not in text:
                continue
            start = text.index("Cannabinoids")
            block = text[start:]
            for line in block.split("\n"):
                parts = line.split()
                if len(parts) < 3:
                    continue
                # Result is 3rd numeric value — skip LOD, LOQ, get Result
                numerics = []
                for p in parts:
                    try:
                        numerics.append(float(p))
                    except ValueError:
                        if p.upper() == "ND":
                            numerics.append(None)
                if len(numerics) < 3:
                    continue
                result = numerics[2]
                # Compound name is everything before the first numeric
                name_parts = []
                for p in parts:
                    try:
                        float(p)
                        break
                    except ValueError:
                        if p.upper() == "ND":
                            break
                        name_parts.append(p)
                if not name_parts:
                    continue
                raw_name = " ".join(name_parts)
                paren_match = re.search(r'\(([^)]+)\)', raw_name)
                if paren_match:
                    raw_name = paren_match.group(1)
                compound = canonical_compound(raw_name)
                if compound in ("LOD", "LOQ", "RESULT", "CANNABINOIDS", "DRY", "TOTAL CANNABINOIDS", "TOTAL POTENTIAL THC"):
                    continue
                value_pct, needs_review = parse_and_normalise(
                    str(result) if result is not None else "ND", "%"
                )
                cannabinoids.append({
                    "compound": compound,
                    "value_pct": value_pct,
                    "value_mg_g": None,
                    "needs_review": needs_review,
                })
    return {"cannabinoids": cannabinoids, "terpenes": []}


def extract_header(pdf_path: str | Path) -> dict:
    with pdfplumber.open(pdf_path) as pdf:
        text = pdf.pages[0].extract_text() or ""
    header = {}
    m = re.search(r'Reported:\s+(\d{2}\w{3}\d{4})', text)
    if m:
        header["report_date"] = m.group(1)
    m = re.search(r'Received:\s+(\d{2}\w{3}\d{4})', text)
    if m:
        header["received_date"] = m.group(1)
    return header
