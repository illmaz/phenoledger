from typing import Literal

ChemotypeLabel = Literal["Type I", "Type II", "Type III", "Type IV", "Unclassified"]

def classify_chemotype(avg_thca: float | None, avg_cbd: float | None) -> ChemotypeLabel:
    if avg_thca is None or avg_cbd is None:
        return "Unclassified"
    if avg_thca < 1.0 and avg_cbd < 1.0:
        return "Type IV"
    if avg_cbd == 0:
        return "Type I"
    ratio = avg_thca / avg_cbd
    if ratio > 5:
        return "Type I"
    if ratio >= 0.5:
        return "Type II"
    return "Type III"
