import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from api.main import app
from api.dependencies import verify_token

client = TestClient(app)

FARM_ID = "fd1c1598-8769-4da9-a885-2f74bca047d6"
STRAIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
TEST_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

def mock_auth():
    mock_client = MagicMock()
    return {"user": MagicMock(), "client": mock_client, "farm_id": "fd1c1598-8769-4da9-a885-2f74bca047d6"}

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

def test_dus_tests_requires_auth():
    response = client.get("/dus-tests")
    assert response.status_code in (401, 403)

def test_create_dus_test_requires_auth():
    response = client.post("/dus-tests", json={})
    assert response.status_code in (401, 403)

def test_list_dus_tests():
    auth = mock_auth()
    auth["client"].table.return_value = mock_chain([{"id": TEST_ID, "status": "pending"}])
    app.dependency_overrides[verify_token] = lambda: auth
    try:
        response = client.get("/dus-tests")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    finally:
        app.dependency_overrides.clear()

@patch("api.main.supabase")
def test_create_dus_test(mock_supa):
    auth = mock_auth()
    auth["client"].table.return_value = mock_chain([{"id": STRAIN_ID}])
    mock_supa.table.return_value = mock_chain([{"id": TEST_ID, "status": "pending"}])
    app.dependency_overrides[verify_token] = lambda: auth
    try:
        response = client.post("/dus-tests", json={
            "strain_id": STRAIN_ID,
            "test_date": "2025-03-01",
            "status": "pending",
        })
        assert response.status_code == 200
    finally:
        app.dependency_overrides.clear()

def test_create_dus_test_strain_not_found():
    auth = mock_auth()
    auth["client"].table.return_value = mock_chain([])
    app.dependency_overrides[verify_token] = lambda: auth
    try:
        response = client.post("/dus-tests", json={
            "strain_id": STRAIN_ID,
            "test_date": "2025-03-01",
        })
        assert response.status_code == 404
    finally:
        app.dependency_overrides.clear()

def test_delete_dus_test_not_found():
    auth = mock_auth()
    auth["client"].table.return_value = mock_chain([])
    app.dependency_overrides[verify_token] = lambda: auth
    try:
        response = client.delete(f"/dus-tests/{TEST_ID}")
        assert response.status_code == 404
    finally:
        app.dependency_overrides.clear()
