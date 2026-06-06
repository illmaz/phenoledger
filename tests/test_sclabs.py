from phenoledger.extractors.sclabs import extract
from pathlib import Path
from decimal import Decimal

class TestSCLabsExtractor:
    def test_extracts_thca(self):
        path = Path("data/03_z_georgia_pie_sclabs.pdf")
        results = extract(path)
        thca = next(r for r in results if r["compound"] == "THCA")
        assert abs(thca["value_pct"] - Decimal("27.71")) < Decimal("0.01")
