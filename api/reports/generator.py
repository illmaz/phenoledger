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


def render_strain_performance_report(
    farm_name: str,
    strain_name: str,
    compounds: list[dict],
    batches: list[dict],
    terpenes: list[dict],
) -> bytes:
    template = _jinja_env.get_template("strain_performance.html")
    html_content = template.render(
        farm_name=farm_name,
        strain_name=strain_name,
        compounds=compounds,
        batches=batches,
        terpenes=terpenes,
        generated_date=date.today().strftime("%d %b %Y"),
    )
    return HTML(string=html_content).write_pdf()


def render_import_summary_report(
    farm_name: str,
    seed_lots: list[dict],
    origin_countries: dict,
    strains_count: int,
) -> bytes:
    template = _jinja_env.get_template("import_summary.html")
    html_content = template.render(
        farm_name=farm_name,
        seed_lots=seed_lots,
        origin_countries=origin_countries,
        strains_count=strains_count,
        generated_date=date.today().strftime("%d %b %Y"),
    )
    return HTML(string=html_content).write_pdf()


def render_trial_performance_report(
    farm_name: str,
    strain_name: str,
    trials: list[dict],
    analytics: list[dict],
) -> bytes:
    template = _jinja_env.get_template("trial_performance.html")
    html_content = template.render(
        farm_name=farm_name,
        strain_name=strain_name,
        trials=trials,
        analytics=analytics,
        generated_date=date.today().strftime("%d %b %Y"),
    )
    return HTML(string=html_content).write_pdf()
