from decimal import Decimal, InvalidOperation

FONT_FIXES: dict[str, str] = {
    "\x00": "fi",        # null byte used as ﬁ ligature, e.g. "Con\x00dent" → "Confident"
    "\uf062": "β",       # β in β-Pinene, β-Caryophyllene
    "\uf061": "α",       # α in α-Humulene, α-Bisabolol
    "\uf044": "Δ",       # Δ in Δ9-THC
    "\uf067": "γ",       # γ in γ-Terpinene
    "\uf020": " ",       # private-use space
    "\ufb01": "fi",      # \ufb01 ligature \u2192 "fi"
    "\ufb02": "fl",      # \ufb02 ligature \u2192 "fl"
    "(cid:215)": "fi",   # pdfplumber CID fallback for \ufb01 ligature
    "Β": "B",            # uppercase Greek beta after .upper()
    "Α": "A",            # uppercase Greek alpha after .upper()
    "Γ": "G",            # uppercase Greek gamma after .upper()
}


def fix_font_artifacts(text: str) -> str:
    """Replace known font encoding artifacts with correct characters."""
    for bad, good in FONT_FIXES.items():
        text = text.replace(bad, good)
    return text


def is_doubled(text: str) -> bool:
    """Return True if the string appears to be a doubled PDF artifact.

    Safe for cannabis COA data: compound names (THCA, CBD, CBGA) and lab
    names contain no adjacent repeated character pairs, so false-positives
    are not a practical risk. Pure-digit strings are excluded to protect
    numeric values like batch numbers.
    """
    t = text.strip()
    if len(t) < 4 or len(t) % 2 != 0:
        return False
    if t.isdigit():
        return False
    return all(t[i] == t[i + 1] for i in range(0, len(t) - 1, 2))


def fix_doubled(text: str) -> str:
    """Halve a doubled string. No-op if not doubled."""
    if is_doubled(text):
        return text[::2]
    return text


def clean_text(text: str) -> str:
    """
    Full text cleaning pipeline.
    Apply this to every string before further processing.
    """
    if not text:
        return ""
    text = fix_font_artifacts(text)
    text = fix_doubled(text)
    text = text.strip()
    return text


COMPOUND_ALIASES: dict[str, str] = {
    # THC variants
    "THCA":             "THCA",
    "THCA-A":           "THCA",
    "THC-A":            "THCA",
    "Δ9-THCA":          "THCA",
    "D9-THCA":          "THCA",
    "Δ9-THC":           "D9-THC",
    "D9-THC":           "D9-THC",
    "DELTA 9-THC":      "D9-THC",
    "DELTA-9-THC":      "D9-THC",
    "DELTA9-THC":       "D9-THC",
    "Δ-9-THC":          "D9-THC",
    "Δ-9 THC":          "D9-THC",
    "Δ8-THC":           "D8-THC",
    "D8-THC":           "D8-THC",
    "DELTA 8-THC":      "D8-THC",
    "DELTA-8-THC":      "D8-THC",
    "Δ10-THC":          "D10-THC",
    "THCV":             "THCV",
    "THCVA":            "THCVA",
    "THC-V":            "THCV",
    # CBD variants
    "CBDA":             "CBDA",
    "CBD-A":            "CBDA",
    "CBD":              "CBD",
    "CBDV":             "CBDV",
    "CBDVA":            "CBDVA",
    # CBG variants
    "CBGA":             "CBGA",
    "CBG-A":            "CBGA",
    "CBG":              "CBG",
    # Other cannabinoids
    "CBN":              "CBN",
    "CBNA":             "CBNA",
    "CBC":              "CBC",
    "CBCA":             "CBCA",
    "CBL":              "CBL",
    "CBLA":             "CBLA",
    "CBT":              "CBT",
    # Terpenes — Greek letters already fixed by font step
    "BETA-CARYOPHYLLENE": "BETA-CARYOPHYLLENE",
    "LINALOOL":         "LINALOOL",
    "TERPINOLENE":      "TERPINOLENE",
    "MYRCENE":          "BETA-MYRCENE",    # some labs drop the β
    "CARYOPHYLLENE":    "BETA-CARYOPHYLLENE",
    "B-CARYOPHYLLENE":  "BETA-CARYOPHYLLENE",
    "B-MYRCENE":        "BETA-MYRCENE",
    "B-PINENE":         "BETA-PINENE",
    "B-BISABOLOL":      "BETA-BISABOLOL",
    "A-BISABOLOL":      "ALPHA-BISABOLOL",
    "A-HUMULENE":       "ALPHA-HUMULENE",
    "A-PINENE":         "ALPHA-PINENE",
    "A-TERPINENE":      "ALPHA-TERPINENE",
    "G-TERPINENE":      "GAMMA-TERPINENE",
}


def canonical_compound(raw: str) -> str:
    cleaned = fix_font_artifacts(clean_text(raw).upper().strip())
    return COMPOUND_ALIASES.get(cleaned, cleaned)


SENTINEL_VALUES = {"ND", "<LOQ", "<LOD", "NR", "NT", "N/A", "NONE", ""}


def parse_numeric(raw: str) -> Decimal | None:
    if not raw:
        return None
    cleaned = clean_text(raw).upper().strip()
    if cleaned in SENTINEL_VALUES or cleaned.startswith("<"):
        return None
    # Strip leading dot edge case: '.2128' → '0.2128'
    if cleaned.startswith("."):
        cleaned = "0" + cleaned
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def normalise_to_pct(value: Decimal, unit: str) -> Decimal | None:
    unit = clean_text(unit).lower().strip()
    if unit in ("%", "% wt", "% w/w"):
        return value
    if unit == "mg/g":
        return value / 10
    # ppm for cannabinoids is rare but handle it
    if unit == "ppm":
        return value / 10000
    # Unknown unit — store raw, flag for review
    return None


def parse_and_normalise(raw_value: str, unit: str) -> tuple[Decimal | None, bool]:
    cleaned = clean_text(raw_value).upper().strip()
    if cleaned in SENTINEL_VALUES or cleaned.startswith("<"):
        return None, False
    value = parse_numeric(raw_value)
    if value is None:
        return None, True  # unparseable garbage — needs review
    normalised = normalise_to_pct(value, unit)
    needs_review = normalised is None
    return normalised, needs_review