import pdfplumber
from pathlib import Path
from phenoledger.normaliser import canonical_compound, parse_and_normalise, parse_numeric

def extract(pdf_path: str | Path) -> list[dict]:
    results = []
    try:
        pdf_cm = pdfplumber.open(pdf_path)
    except Exception as e:
        raise ValueError(f"Cannot open PDF {pdf_path}: {e}") from e
    with pdf_cm as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table:
                    continue
                first_row = [cell for cell in table[0] if cell]
                if not any("thca" in str(cell).lower() for cell in first_row):
                    continue
                for row in table:
                    if not row or len(row) < 4 or not row[0]:
                        continue
                    compound = canonical_compound(str(row[0]))
                    value_mg_g = parse_numeric(str(row[2] or ""))
                    value_pct, needs_review = parse_and_normalise(str(row[3] or ""), "%")
                    results.append({
                        "compound": compound,
                        "value_mg_g": value_mg_g,
                        "value_pct": value_pct,
                        "needs_review": needs_review,
                    })
    return results