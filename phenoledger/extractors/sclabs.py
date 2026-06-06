import pdfplumber
from pathlib import Path
from phenoledger.normaliser import canonical_compound, parse_and_normalise


def extract(pdf_path: str | Path) -> list[dict]:
    results = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table:
                    continue
                first_row = [cell for cell in table[0] if cell]
                if not any("THCa" in str(cell) for cell in first_row):
                    continue
                for row in table[1:]:
                    if not row or not row[0]:
                        continue
                    compound = canonical_compound(str(row[0]))
                    value_mg_g, _ = parse_and_normalise(str(row[2] or ""), "mg/g")
                    value_pct, _ = parse_and_normalise(str(row[3] or ""), "%")
                    results.append({
                        "compound": compound,
                        "value_mg_g": value_mg_g,
                        "value_pct": value_pct,
                    })
    return results
