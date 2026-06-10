import pdfplumber
from pathlib import Path
from phenoledger.normaliser import canonical_compound, parse_and_normalise, parse_numeric
import re
from datetime import date


def extract(pdf_path: str | Path) -> dict:
    cannabinoids = []
    terpenes = []
    try:
        pdf_cm = pdfplumber.open(pdf_path)
    except Exception as e:
        raise ValueError(f"Cannot open PDF {pdf_path}: {e}") from e
    with pdf_cm as pdf:
        for i, page in enumerate(pdf.pages):
            if i > 1:
                break
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table[0]) < 4:
                    continue
                first_row = [cell for cell in table[0] if cell]
                is_cannabinoid = any("thca" in str(cell).lower() for cell in first_row)
                KNOWN_TERPENES = {
                    "pinene", "myrcene", "limonene", "linalool", "caryophyllene",
                    "humulene", "terpinolene", "ocimene", "bisabolol", "guaiol",
                    "camphene", "geraniol", "terpineol", "farnesene", "nerolidol"
                }
                is_terpene = not is_cannabinoid and any(
                    any(t in str(cell).lower() for t in KNOWN_TERPENES)
                    for cell in first_row if cell
                )
                if not is_cannabinoid and not is_terpene:
                    continue
                target = cannabinoids if is_cannabinoid else terpenes
                for row in table:
                    if not row or len(row) < 4 or not row[0]:
                        continue
                    compound = canonical_compound(str(row[0]))
                    value_mg_g = parse_numeric(str(row[2] or ""))
                    value_pct, needs_review = parse_and_normalise(str(row[3] or ""), "%")
                    target.append({
                        "compound": compound,
                        "value_mg_g": value_mg_g,
                        "value_pct": value_pct,
                        "needs_review": needs_review,
                    })
    return {"cannabinoids": cannabinoids, "terpenes": terpenes}


def extract_header(pdf_path: str | Path) -> dict:
    with pdfplumber.open(pdf_path) as pdf:
        text = pdf.pages[0].extract_text() or ""

    header = {}

    m = re.search(r'DATE ISSUED\s+(\d{2}/\d{2}/\d{4})', text)
    if m:
        header["report_date"] = m.group(1)

    m = re.search(r'SAMPLE NAME:\s+(.+)', text)
    if m:
        header["sample_name"] = m.group(1).strip()

    m = re.search(r'Date Collected:\s+(\d{1,2}/\d{2}/\d{4})', text)
    if m:
        header["collection_date"] = m.group(1)

    m = re.search(r'Date Received:\s+(\d{1,2}/\d{2}/\d{4})', text)
    if m:
        header["received_date"] = m.group(1)

    m = re.search(r'OVERALL BATCH RESULT:\s+(\w+)', text)
    if m:
        header["overall_pass_fail"] = m.group(1)

    return header
