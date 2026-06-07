from phenoledger.lab_detector import detect, detect_from_text, LabFamily
from pathlib import Path

DATA = Path("data")


class TestDetectFromText:
    def test_sclabs(self):
        assert detect_from_text("SC Laboratories California LLC.") == LabFamily.SCLABS

    def test_confident_cannabis(self):
        assert detect_from_text("Powered by Confident Cannabis") == LabFamily.CONFIDENT_CANNABIS

    def test_confident_lims(self):
        assert detect_from_text("Powered by Confident LIMS") == LabFamily.CONFIDENT_LIMS

    def test_fesa_labs(self):
        assert detect_from_text("FESA Labs - Santa Ana, CA") == LabFamily.FESA_LABS

    def test_marin_analytics(self):
        assert detect_from_text("Marin Analytics, LLC") == LabFamily.MARIN_ANALYTICS

    def test_new_bloom(self):
        assert detect_from_text("New Bloom Labs - Portland, OR") == LabFamily.NEW_BLOOM

    def test_analytics_labs(self):
        assert detect_from_text("Analytics Labs Massachusetts") == LabFamily.ANALYTICS_LABS

    def test_font_artifact_confident_cannabis(self):
        assert detect_from_text("Powered by Con\x00dent Cannabis") == LabFamily.CONFIDENT_CANNABIS

    def test_unknown(self):
        assert detect_from_text("Some random lab nobody has heard of") == LabFamily.UNKNOWN


class TestDetectFromFiles:
    def test_og_kush(self):
        assert detect(DATA / "01_og_kush_confident_cannabis.pdf") == LabFamily.CONFIDENT_CANNABIS

    def test_sclabs_flower(self):
        assert detect(DATA / "03_z_georgia_pie_sclabs.pdf") == LabFamily.SCLABS

    def test_confident_lims(self):
        assert detect(DATA / "05_blockberry_confident_lims_illinois.pdf") == LabFamily.CONFIDENT_LIMS

    def test_fesa_labs(self):
        assert detect(DATA / "06_blockberry_fesa_labs.pdf") == LabFamily.FESA_LABS

    def test_marin_analytics(self):
        assert detect(DATA / "09_critical_berry_marin_analytics.pdf") == LabFamily.MARIN_ANALYTICS

    def test_new_bloom(self):
        assert detect(DATA / "08_glitter_bomb_new_bloom.pdf") == LabFamily.NEW_BLOOM

    def test_analytics_labs(self):
        assert detect(DATA / "10_analytics_labs_massachusetts.pdf") == LabFamily.ANALYTICS_LABS

    def test_nonexistent_file_returns_unknown(self):
        assert detect("nonexistent_file_that_does_not_exist.pdf") == LabFamily.UNKNOWN