from phenoledger.extractors.sclabs import extract
from pathlib import Path
from decimal import Decimal
import pytest

PDF = Path(__file__).parent.parent / "data" / "03_z_georgia_pie_sclabs.pdf"


@pytest.fixture(scope="module")
def sclabs_results():
    result = extract(PDF)
    return result["cannabinoids"]


class TestSCLabsExtractor:
    def test_no_header_row_in_results(self, sclabs_results):
        compounds = [r["compound"] for r in sclabs_results]
        assert "ANALYTE" not in compounds

    def test_extracts_thca_pct(self, sclabs_results):
        thca = next((r for r in sclabs_results if r["compound"] == "THCA"), None)
        assert thca is not None
        assert abs(thca["value_pct"] - Decimal("27.71")) < Decimal("0.01")

    def test_extracts_thca_mg_g(self, sclabs_results):
        thca = next((r for r in sclabs_results if r["compound"] == "THCA"), None)
        assert thca is not None
        assert abs(thca["value_mg_g"] - Decimal("277.1")) < Decimal("0.1")

    def test_nd_compound_returns_none(self, sclabs_results):
        d8 = next((r for r in sclabs_results if r["compound"] == "D8-THC"), None)
        assert d8 is not None
        assert d8["value_pct"] is None
        assert d8["value_mg_g"] is None

    def test_needs_review_false_for_clean_rows(self, sclabs_results):
        thca = next((r for r in sclabs_results if r["compound"] == "THCA"), None)
        assert thca is not None
        assert thca["needs_review"] is False
