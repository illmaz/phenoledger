import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from api.main import app
from api.dependencies import verify_token

client = TestClient(app)

FARM_ID = "fd1c1598-8769-4da9-a885-2f74bca047d6"
STRAIN_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
STRAIN_R = "cccccccc-cccc-cccc-cccc-cccccccccccc"
RECORD_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"

def mock_auth():
    mock_client = MagicMock()
    return {"user": MagicMock(), "client": mock_client}

def mock_chain(data):
    m = MagicMock()
    m.execute.return_value.data = data
    m.eq.return_value = m
    m.is_.return_value = m
    m.order.return_value = m
    m.select.return_value = m
    m.insert.return_value = m
    m.update.return_value = m
    return m

def test_breeding_records_requires_auth():
    response = client.get("/breeding-records")
    assert response.status_code in (401, 403)

def test_create_breeding_record_requires_auth():
    response = client.post("/breeding-records", json={})
    assert response.status_code in (401, 403)

def test_list_breeding_records():
    app.dependency_overrides[verify_token] = mock_auth
    auth = mock_auth()
    auth["client"].table.return_value = mock_chain([{"id": RECORD_ID, "generation": "F1"}])
    app.dependency_overrides[verify_token] = lambda: auth
    try:
        response = client.get("/breeding-records")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    finally:
        app.dependency_overrides.clear()

@patch("api.main.supabase")
def test_create_breeding_record(mock_supa):
    auth = mock_auth()
    auth["client"].table.return_value = mock_chain([{"id": STRAIN_A}])
    mock_supa.table.return_value = mock_chain([{"id": RECORD_ID, "generation": "F1"}])
    app.dependency_overrides[verify_token] = lambda: auth
    try:
        response = client.post("/breeding-records", json={
            "result_strain_id": STRAIN_R,
            "parent_strain_a_id": STRAIN_A,
            "generation": "F1",
        })
        assert response.status_code == 200
    finally:
        app.dependency_overrides.clear()

@patch("api.main.supabase")
def test_delete_breeding_record(mock_supa):
    auth = mock_auth()
    auth["client"].table.return_value = mock_chain([{"id": RECORD_ID}])
    mock_supa.table.return_value = mock_chain([])
    app.dependency_overrides[verify_token] = lambda: auth
    try:
        response = client.delete(f"/breeding-records/{RECORD_ID}")
        assert response.status_code == 200
    finally:
        app.dependency_overrides.clear()

def test_delete_breeding_record_not_found():
    auth = mock_auth()
    auth["client"].table.return_value = mock_chain([])
    app.dependency_overrides[verify_token] = lambda: auth
    try:
        response = client.delete(f"/breeding-records/{RECORD_ID}")
        assert response.status_code == 404
    finally:
        app.dependency_overrides.clear()
