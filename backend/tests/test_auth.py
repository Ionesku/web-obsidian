"""Tests for authentication endpoints"""
import pytest


def test_register_user(client):
    """Test user registration"""
    response = client.post(
        "/api/auth/register",
        json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "password123"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "newuser"
    assert data["email"] == "newuser@example.com"
    assert "id" in data


def test_register_duplicate_username(client):
    """Test registration with duplicate username"""
    # Register first user
    client.post(
        "/api/auth/register",
        json={
            "username": "duplicate",
            "email": "user1@example.com",
            "password": "password123"
        }
    )
    
    # Try to register with same username
    response = client.post(
        "/api/auth/register",
        json={
            "username": "duplicate",
            "email": "user2@example.com",
            "password": "password123"
        }
    )
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()


def test_login_success(client):
    """Test successful login"""
    # Register user
    client.post(
        "/api/auth/register",
        json={
            "username": "loginuser",
            "email": "login@example.com",
            "password": "password123"
        }
    )
    
    # Login
    response = client.post(
        "/api/auth/login",
        json={"username": "loginuser", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client):
    """Test login with wrong password"""
    # Register user
    client.post(
        "/api/auth/register",
        json={
            "username": "wrongpass",
            "email": "wrong@example.com",
            "password": "correct123"
        }
    )
    
    # Try to login with wrong password
    response = client.post(
        "/api/auth/login",
        json={"username": "wrongpass", "password": "wrong123"}
    )
    assert response.status_code == 401


def test_get_current_user(auth_client):
    """Test getting current user info"""
    response = auth_client.get("/api/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testuser"
    assert data["email"] == "test@example.com"


def test_logout(auth_client):
    """Test logout"""
    response = auth_client.post("/api/auth/logout")
    assert response.status_code == 200
    assert "message" in response.json()

