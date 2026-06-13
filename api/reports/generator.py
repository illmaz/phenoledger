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

def render_batch_record_report(
    farm_name: str,
    batch: dict,
    seed_lot: dict | None,
    mother_plant: dict | None,
    trial: dict | None,
    coa: dict | None,
) -> bytes:
    template = _jinja_env.get_template("batch_record.html")
    html_content = template.render(
        farm_name=farm_name,
        batch=batch,
        seed_lot=seed_lot,
        mother_plant=mother_plant,
        trial=trial,
        coa=coa,
        generated_date=date.today().strftime("%d %b %Y"),
    )
    return HTML(string=html_content).write_pdf()

def render_monthly_summary_report(
    farm_name: str,
    month_label: str,
    coa_count: int,
    total_grams_sold: float,
    total_revenue: float,
    coas: list[dict],
    trials: list[dict],
    sales: list[dict],
    inputs: list[dict],
) -> bytes:
    template = _jinja_env.get_template("monthly_summary.html")
    html_content = template.render(
        farm_name=farm_name,
        month_label=month_label,
        coa_count=coa_count,
        total_grams_sold=total_grams_sold,
        total_revenue=total_revenue,
        coas=coas,
        trials=trials,
        sales=sales,
        inputs=inputs,
        generated_date=date.today().strftime("%d %b %Y"),
    )
    return HTML(string=html_content).write_pdf()
