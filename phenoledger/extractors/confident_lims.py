import re
from pathlib import Path
import pdfplumber
from phenoledger.normaliser import canonical_compound, parse_and_normalise, parse_numeric


def extract(pdf_path: str | Path) -> list[dict]:
    results = []
    with pdfplumber.open(pdf_path) as pdf:
        text = pdf.pages[0].extract_text() or ""
    if "Cannabinoids" not in text:
        return results

    start = text.index("Cannabinoids") + len("Cannabinoids")
    end = text.index("Terpenes")
    cannabinoid_block = text[start:end]

    for line in cannabinoid_block.strip().split("\n"):
        parts = line.split()
        if len(parts) < 4:
            continue
        if parts[0].upper() in ("ANALYTE", "%", "LOQ", "RESULT"):
            continue
        compound = canonical_compound(parts[0])
        value_pct, needs_review = parse_and_normalise(parts[2], "%")
        value_mg_g = parse_numeric(parts[3])
        results.append({
            "compound": compound,
            "value_pct": value_pct,
            "value_mg_g": value_mg_g,
            "needs_review": needs_review,
        })

    return results