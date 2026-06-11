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
    # Dates are in format 20Mar2025 — search anywhere in text
    dates = re.findall(r'(\d{2}[A-Za-z]{3}\d{4})', text)
    if dates:
        header["report_date"] = dates[0]
    if len(dates) > 1:
        header["received_date"] = dates[-1]
    # Strain name: use positional extraction — strain words appear at top ~75-85px
    # The garbled text is two columns overlapping; strain name words are on the right
    try:
        with pdfplumber.open(pdf_path) as pdf2:
            words = pdf2.pages[0].extract_words()
        strain_words = [
            w["text"] for w in words
            if 72 < w["top"] < 79 and w["x0"] > 180
        ]
        if strain_words:
            header["sample_name"] = " ".join(strain_words)
    except Exception:
        pass
    return header
