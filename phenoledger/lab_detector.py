from enum import Enum
import pdfplumber
from phenoledger.normaliser import fix_font_artifacts
import logging
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
    # Specific lab names first — must take priority over LIMS platform signatures
    ("SC Laboratories",          LabFamily.SCLABS),
    ("sclabs.com",               LabFamily.SCLABS),
    ("FESA Labs",                LabFamily.FESA_LABS),
    ("New Bloom Labs",           LabFamily.NEW_BLOOM),
    ("Marin Analytics",          LabFamily.MARIN_ANALYTICS),
    ("Analytics Labs",           LabFamily.ANALYTICS_LABS),
    # LIMS platform signatures last — some labs embed these in footers
    ("Confident LIMS",           LabFamily.CONFIDENT_LIMS),
    ("Confident Cannabis",       LabFamily.CONFIDENT_CANNABIS),
]

def detect_from_text(page_one_text: str) -> LabFamily:
    text_lower = fix_font_artifacts(page_one_text).lower()
    for signature, family in _SIGNATURES:
        if signature.lower() in text_lower:
            return family
    return LabFamily.UNKNOWN


def detect(pdf_path: str | Path) -> LabFamily:
    try:
        with pdfplumber.open(pdf_path) as pdf:
            text = pdf.pages[0].extract_text() or ""
        return detect_from_text(text)
    except Exception as e:
        logging.warning("Failed to open PDF %s: %s", pdf_path, e)
        return LabFamily.UNKNOWN