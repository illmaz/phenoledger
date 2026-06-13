import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


class TestPhase5to12Auth:

    # ── batch_records ──────────────────────────────────────────────────────────
    def test_get_batch_records_requires_auth(self):
        response = client.get("/batch-records")
        assert response.status_code in (401, 403)

    def test_post_batch_records_requires_auth(self):
        response = client.post("/batch-records", json={})
        assert response.status_code in (401, 403)

    # ── input_records ──────────────────────────────────────────────────────────
    def test_get_input_records_requires_auth(self):
        response = client.get("/input-records")
        assert response.status_code in (401, 403)

    def test_post_input_records_requires_auth(self):
        response = client.post("/input-records", json={})
        assert response.status_code in (401, 403)

    # ── sops ───────────────────────────────────────────────────────────────────
    def test_get_sops_requires_auth(self):
        response = client.get("/sops")
        assert response.status_code in (401, 403)

    def test_post_sops_requires_auth(self):
        response = client.post("/sops", json={})
        assert response.status_code in (401, 403)

    # ── grow_rooms ─────────────────────────────────────────────────────────────
    def test_get_grow_rooms_requires_auth(self):
        response = client.get("/grow-rooms")
        assert response.status_code in (401, 403)

    def test_post_grow_rooms_requires_auth(self):
        response = client.post("/grow-rooms", json={})
        assert response.status_code in (401, 403)

    # ── environmental_logs ─────────────────────────────────────────────────────
    def test_get_environmental_logs_requires_auth(self):
        response = client.get("/environmental-logs")
        assert response.status_code in (401, 403)

    def test_post_environmental_logs_requires_auth(self):
        response = client.post("/environmental-logs", json={})
        assert response.status_code in (401, 403)

    # ── staff ──────────────────────────────────────────────────────────────────
    def test_get_staff_requires_auth(self):
        response = client.get("/staff")
        assert response.status_code in (401, 403)

    def test_post_staff_requires_auth(self):
        response = client.post("/staff", json={})
        assert response.status_code in (401, 403)

    # ── visitor_log ────────────────────────────────────────────────────────────
    def test_get_visitor_log_requires_auth(self):
        response = client.get("/visitor-log")
        assert response.status_code in (401, 403)

    def test_post_visitor_log_requires_auth(self):
        response = client.post("/visitor-log", json={})
        assert response.status_code in (401, 403)

    # ── harvest_sales ──────────────────────────────────────────────────────────
    def test_get_harvest_sales_requires_auth(self):
        response = client.get("/harvest-sales")
        assert response.status_code in (401, 403)

    def test_post_harvest_sales_requires_auth(self):
        response = client.post("/harvest-sales", json={})
        assert response.status_code in (401, 403)

    # ── export_records ─────────────────────────────────────────────────────────
    def test_get_export_records_requires_auth(self):
        response = client.get("/export-records")
        assert response.status_code in (401, 403)

    def test_post_export_records_requires_auth(self):
        response = client.post("/export-records", json={})
        assert response.status_code in (401, 403)
