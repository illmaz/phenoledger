import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from api.main import app
from api.dependencies import verify_token

client = TestClient(app)


def mock_auth():
    mock_client = MagicMock()
    return {"user": MagicMock(), "client": mock_client, "farm_id": "fd1c1598-8769-4da9-a885-2f74bca047d6"}


# ── Auth guards ───────────────────────────────────────────────────────────────

def test_trials_requires_auth():
    response = client.get("/trials")
    assert response.status_code in (401, 403)


def test_create_trial_requires_auth():
    response = client.post("/trials", json={})
    assert response.status_code in (401, 403)


def test_trial_analytics_requires_auth():
    response = client.get("/trials/analytics")
    assert response.status_code in (401, 403)


def test_trial_analytics_summary_requires_auth():
    response = client.get("/trials/analytics/summary")
    assert response.status_code in (401, 403)


# ── Analytics route ordering ──────────────────────────────────────────────────

def test_analytics_route_not_shadowed_by_trial_id():
    """GET /trials/analytics must not be matched by GET /trials/{trial_id}."""
    app.dependency_overrides[verify_token] = mock_auth
    mock_client = mock_auth()["client"]
    mock_client.table.return_value.select.return_value.eq.return_value.is_.return_value.execute.return_value.data = []
    try:
        response = client.get("/trials/analytics")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    finally:
        app.dependency_overrides.clear()


# ── Date validation ───────────────────────────────────────────────────────────

def test_create_trial_rejects_harvest_before_start():
    app.dependency_overrides[verify_token] = mock_auth
    try:
        response = client.post("/trials", json={
            "start_date": "2025-06-01",
            "harvest_date": "2025-01-01",
        })
        assert response.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_create_trial_rejects_inverted_temperature():
    app.dependency_overrides[verify_token] = mock_auth
    try:
        response = client.post("/trials", json={
            "temperature_min": 35.0,
            "temperature_max": 20.0,
        })
        assert response.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_create_trial_rejects_inverted_humidity():
    app.dependency_overrides[verify_token] = mock_auth
    try:
        response = client.post("/trials", json={
            "humidity_min": 80.0,
            "humidity_max": 40.0,
        })
        assert response.status_code == 422
    finally:
        app.dependency_overrides.clear()


# ── Analytics summary calculation ─────────────────────────────────────────────

def test_analytics_summary_trial_count_per_grow_type():
    """trial_count must be per grow type, not total."""
    from api.main import trials_analytics_summary
    mock_client = MagicMock()
    mock_client.table.return_value.select.return_value.eq.return_value.is_.return_value.execute.return_value.data = [
        {"grow_type": "indoor", "dry_weight_g": 1000, "wet_weight_g": 4000, "plant_count": 10,
         "strains": {"name": "Strain A"}, "trial_coa_links": []},
        {"grow_type": "indoor", "dry_weight_g": 800, "wet_weight_g": 3200, "plant_count": 8,
         "strains": {"name": "Strain A"}, "trial_coa_links": []},
        {"grow_type": "outdoor", "dry_weight_g": 600, "wet_weight_g": 2400, "plant_count": 6,
         "strains": {"name": "Strain A"}, "trial_coa_links": []},
    ]
    auth = {"user": MagicMock(), "client": mock_client, "farm_id": "fd1c1598-8769-4da9-a885-2f74bca047d6"}
    result = trials_analytics_summary(auth=auth)
    by_type = {r["grow_type"]: r for r in result}
    assert by_type["indoor"]["trial_count"] == 2
    assert by_type["outdoor"]["trial_count"] == 1


def test_analytics_summary_yield_efficiency_calculated():
    """avg_yield_efficiency_pct must be calculated when wet and dry weights exist."""
    from api.main import trials_analytics_summary
    mock_client = MagicMock()
    mock_client.table.return_value.select.return_value.eq.return_value.is_.return_value.execute.return_value.data = [
        {"grow_type": "indoor", "dry_weight_g": 1000.0, "wet_weight_g": 4000.0, "plant_count": 10,
         "strains": {"name": "Strain A"}, "trial_coa_links": []},
    ]
    auth = {"user": MagicMock(), "client": mock_client, "farm_id": "fd1c1598-8769-4da9-a885-2f74bca047d6"}
    result = trials_analytics_summary(auth=auth)
    assert result[0]["avg_yield_efficiency_pct"] == 25.0


def test_analytics_summary_thca_one_value_per_trial():
    """Each trial contributes at most one THCA value regardless of link count."""
    from api.main import trials_analytics_summary
    mock_client = MagicMock()
    mock_client.table.return_value.select.return_value.eq.return_value.is_.return_value.execute.return_value.data = [
        {
            "grow_type": "indoor",
            "dry_weight_g": None, "wet_weight_g": None, "plant_count": None,
            "strains": {"name": "Strain A"},
            "trial_coa_links": [
                {"coa_reports": {"cannabinoid_results": [{"compound_name": "THCA", "value_pct": 28.0}]}},
                {"coa_reports": {"cannabinoid_results": [{"compound_name": "THCA", "value_pct": 30.0}]}},
            ]
        },
        {
            "grow_type": "indoor",
            "dry_weight_g": None, "wet_weight_g": None, "plant_count": None,
            "strains": {"name": "Strain A"},
            "trial_coa_links": [
                {"coa_reports": {"cannabinoid_results": [{"compound_name": "THCA", "value_pct": 26.0}]}},
            ]
        },
    ]
    auth = {"user": MagicMock(), "client": mock_client, "farm_id": "fd1c1598-8769-4da9-a885-2f74bca047d6"}
    result = trials_analytics_summary(auth=auth)
    # Should average first THCA from each trial: (28.0 + 26.0) / 2 = 27.0
    assert result[0]["avg_thca"] == 27.0
