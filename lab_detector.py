from enum import Enum
import pdfplumber
from pathlib import Path

class LabFamily(Enum):
    SCLABS = "sclabs"
    CONFIDENT_CANNABIS = "confident_cannabis"
    CONFIDENT_LIMS = "confident_lims"
    FESA_LABS = "fesa_labs"
    NEW_BLOOM = "new_bloom"
    MARIN_ANALYTICS = "marin_analytics"
    UNKNOWN = "unknown"
    ANALYTICS_LABS = "analytics_labs"

_SIGNATURES: list[tuple[str, LabFamily]] = [
    ("SC Laboratories",          LabFamily.SCLABS),
    ("sclabs.com",               LabFamily.SCLABS),
    ("Confident LIMS",           LabFamily.CONFIDENT_LIMS),
    ("Confident Cannabis",       LabFamily.CONFIDENT_CANNABIS),
    ("condentcannabis.com",      LabFamily.CONFIDENT_CANNABIS),
    ("FESA Labs",                LabFamily.FESA_LABS),
    ("New Bloom Labs",           LabFamily.NEW_BLOOM),
    ("Marin Analytics",          LabFamily.MARIN_ANALYTICS),
    ("Analytics Labs",           LabFamily.ANALYTICS_LABS),
]

def detect_from_text(page_one_text: str) -> LabFamily:
    text_lower = page_one_text.lower()
    for signature, family in _SIGNATURES:
        if signature.lower() in text_lower:
            return family
    return LabFamily.UNKNOWN


def detect(pdf_path: str | Path) -> LabFamily:
    try:
        with pdfplumber.open(pdf_path) as pdf:
            text = pdf.pages[0].extract_text() or ""
        return detect_from_text(text)
    except Exception:
        return LabFamily.UNKNOWN