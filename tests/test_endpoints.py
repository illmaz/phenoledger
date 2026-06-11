import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from api.main import app
from api.dependencies import verify_token

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_strains_requires_auth():
    response = client.get("/strains")
    assert response.status_code in (401, 403)


def test_uploads_requires_auth():
    response = client.get("/uploads")
    assert response.status_code in (401, 403)


def test_upload_requires_auth():
    response = client.post("/upload")
    assert response.status_code in (401, 403)


def mock_auth():
    return {"user": MagicMock(), "client": MagicMock()}


def test_upload_rejects_non_pdf():
    app.dependency_overrides[verify_token] = mock_auth
    try:
        response = client.post(
            "/upload",
            files={"file": ("test.txt", b"not a pdf", "text/plain")},
        )
        assert response.status_code == 400
        assert "PDF" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_upload_rejects_fake_pdf():
    app.dependency_overrides[verify_token] = mock_auth
    try:
        response = client.post(
            "/upload",
            files={"file": ("test.pdf", b"not really a pdf", "application/pdf")},
        )
        assert response.status_code == 400
        assert "valid PDF" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_upload_rejects_oversized_file():
    app.dependency_overrides[verify_token] = mock_auth
    try:
        big_file = b"%PDF" + b"x" * (51 * 1024 * 1024)
        response = client.post(
            "/upload",
            files={"file": ("big.pdf", big_file, "application/pdf")},
        )
        assert response.status_code == 413
    finally:
        app.dependency_overrides.clear()
