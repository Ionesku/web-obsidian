"""Pytest configuration and fixtures"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from pathlib import Path
import tempfile
import shutil

from app.main import app
from app.database import get_db
from app.models import Base


@pytest.fixture(scope="function")
def test_db():
    """Create a test database"""
    # Create temporary database
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
    
    app.dependency_overrides[get_db] = override_get_db
    
    yield TestingSessionLocal
    
    # Cleanup
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def temp_vault_dir():
    """Create a temporary vault directory"""
    temp_dir = tempfile.mkdtemp()
    yield Path(temp_dir)
    shutil.rmtree(temp_dir)


@pytest.fixture(scope="function")
def client(test_db):
    """Create a test client"""
    return TestClient(app)


@pytest.fixture(scope="function")
def auth_client(client):
    """Create an authenticated test client"""
    # Register user
    response = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpass123"
        }
    )
    assert response.status_code == 201
    
    # Login
    response = client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "testpass123"}
    )
    assert response.status_code == 200
    
    token = response.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    
    return client

