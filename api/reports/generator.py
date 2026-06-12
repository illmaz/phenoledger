import os
from datetime import date
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

TEMPLATE_DIR = Path(__file__).parent / "templates"
_jinja_env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))


def render_gacp_batch_report(
    farm_name: str,
    strain_name: str,
    seed_lots: list[dict],
    mother_plants: list[dict],
    batches: list[dict],
    trials: list[dict],
) -> bytes:
    template = _jinja_env.get_template("gacp_batch.html")
    html_content = template.render(
        farm_name=farm_name,
        strain_name=strain_name,
        seed_lots=seed_lots,
        mother_plants=mother_plants,
        batches=batches,
        trials=trials,
        generated_date=date.today().strftime("%d %b %Y"),
    )
    return HTML(string=html_content).write_pdf()
