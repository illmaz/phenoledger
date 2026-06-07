import pytest
from decimal import Decimal
from phenoledger.normaliser import (
    fix_font_artifacts,
    fix_doubled,
    is_doubled,
    clean_text,
    canonical_compound,
    parse_numeric,
    normalise_to_pct,
    parse_and_normalise,
)


class TestFontFixes:
    def test_null_byte(self):
        assert fix_font_artifacts("Con\x00dent") == "Confident"

    def test_beta_symbol(self):
        assert fix_font_artifacts("\uf062-Pinene") == "β-Pinene"

    def test_delta_symbol(self):
        assert fix_font_artifacts("\uf0449-THC") == "Δ9-THC"

    def test_no_change_clean_text(self):
        assert fix_font_artifacts("THCA") == "THCA"

    def test_fi_unicode_ligature(self):
        assert fix_font_artifacts("Conﬁdent") == "Confident"

    def test_fl_unicode_ligature(self):
        assert fix_font_artifacts("reﬂect") == "reflect"

    def test_cid_fi_placeholder(self):
        assert fix_font_artifacts("Con(cid:215)dent") == "Confident"


class TestDoubledFix:
    def test_detects_doubled(self):
        assert is_doubled("AAnnaallyyttee") is True

    def test_not_doubled_normal(self):
        assert is_doubled("Analyte") is False

    def test_fix_doubled_text(self):
        assert fix_doubled("AAnnaallyyttee") == "Analyte"

    def test_fix_doubled_number(self):
        assert fix_doubled("2211..7799") == "21.79"

    def test_no_op_normal(self):
        assert fix_doubled("28.065") == "28.065"

    def test_no_false_positive_repeated_digits(self):
        assert is_doubled("2200") is False


class TestCanonicalCompound:
    def test_thca_variants(self):
        assert canonical_compound("THCA-A") == "THCA"
        assert canonical_compound("THC-A") == "THCA"

    def test_d9_variants(self):
        assert canonical_compound("Δ9-THC") == "D9-THC"
        assert canonical_compound("Delta 9-THC") == "D9-THC"
        assert canonical_compound("delta-9-thc") == "D9-THC"

    def test_unknown_compound_stored_uppercased(self):
        assert canonical_compound("ExoTHC") == "EXOTHC"

    def test_greek_terpene_alias(self):
        assert canonical_compound("β-Caryophyllene") == "BETA-CARYOPHYLLENE"


class TestParseNumeric:
    def test_normal_value(self):
        assert parse_numeric("28.065") == Decimal("28.065")

    def test_nd_returns_none(self):
        assert parse_numeric("ND") is None

    def test_loq_returns_none(self):
        assert parse_numeric("<LOQ") is None

    def test_leading_dot(self):
        assert parse_numeric(".2128") == Decimal("0.2128")

    def test_empty_string(self):
        assert parse_numeric("") is None


class TestNormalise:
    def test_pct_unchanged(self):
        assert normalise_to_pct(Decimal("28.0"), "%") == Decimal("28.0")

    def test_mg_g_to_pct(self):
        assert normalise_to_pct(Decimal("280.65"), "mg/g") == Decimal("28.065")

    def test_unknown_unit_returns_none(self):
        assert normalise_to_pct(Decimal("1.0"), "furlongs") is None

    def test_pct_wt_unchanged(self):
        assert normalise_to_pct(Decimal("10.0"), "% wt") == Decimal("10.0")

    def test_pct_ww_unchanged(self):
        assert normalise_to_pct(Decimal("10.0"), "% w/w") == Decimal("10.0")

    def test_ppm_to_pct(self):
        assert normalise_to_pct(Decimal("10000"), "ppm") == Decimal("1.0")

    def test_full_pipeline_unknown_unit_needs_review(self):
        value, needs_review = parse_and_normalise("10.0", "furlongs")
        assert value is None
        assert needs_review is True

    def test_full_pipeline_nd(self):
        value, needs_review = parse_and_normalise("ND", "%")
        assert value is None
        assert needs_review is False

    def test_full_pipeline_mg_g(self):
        value, needs_review = parse_and_normalise("280.65", "mg/g")
        assert value == Decimal("28.065")
        assert needs_review is False
