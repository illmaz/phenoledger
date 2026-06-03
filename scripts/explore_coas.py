import pdfplumber
import sys
from pathlib import Path

def explore_pdf(path):
    print(f"\n{'='*60}")
    print(f"FILE: {Path(path).name}")
    print('='*60)
    
    with pdfplumber.open(path) as pdf:
        print(f"Pages: {len(pdf.pages)}")
        
        for i, page in enumerate(pdf.pages):
            print(f"\n--- Page {i+1} ---")
            text = page.extract_text()
            if text:
                print(text[:800])
            else:
                print("[NO EXTRACTABLE TEXT — likely scanned/image]")
            
            tables = page.extract_tables()
            print(f"\nTables found on page {i+1}: {len(tables)}")
            for j, table in enumerate(tables):
                print(f"  Table {j+1}: {len(table)} rows x {len(table[0]) if table else 0} cols")
                for row in table[:3]:
                    print(f"    {row}")

if __name__ == "__main__":
    pdfs = sorted(Path(".").glob("*.pdf"))
    for pdf in pdfs:
        explore_pdf(pdf)
