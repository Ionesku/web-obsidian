"""Tests for file management endpoints"""
import pytest


def test_list_files_empty(auth_client):
    """Test listing files in empty vault"""
    response = auth_client.get("/api/files/list")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Should have Welcome.md by default
    assert len(data) >= 1


def test_create_file(auth_client):
    """Test creating a new file"""
    response = auth_client.post(
        "/api/files/",
        json={
            "path": "notes/test.md",
            "content": "# Test Note\n\nThis is a test."
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["path"] == "notes/test.md"
    assert data["status"] == "saved"


def test_read_file(auth_client):
    """Test reading a file"""
    # Create file
    auth_client.post(
        "/api/files/",
        json={
            "path": "notes/read-test.md",
            "content": "# Read Test\n\nContent here."
        }
    )
    
    # Read file
    response = auth_client.get("/api/files/notes/read-test.md")
    assert response.status_code == 200
    data = response.json()
    assert data["path"] == "notes/read-test.md"
    assert "# Read Test" in data["content"]


def test_update_file(auth_client):
    """Test updating a file"""
    # Create file
    auth_client.post(
        "/api/files/",
        json={
            "path": "notes/update-test.md",
            "content": "Original content"
        }
    )
    
    # Update file
    response = auth_client.put(
        "/api/files/notes/update-test.md",
        json={
            "path": "notes/update-test.md",
            "content": "Updated content"
        }
    )
    assert response.status_code == 200
    
    # Verify update
    response = auth_client.get("/api/files/notes/update-test.md")
    assert "Updated content" in response.json()["content"]


def test_delete_file(auth_client):
    """Test deleting a file"""
    # Create file
    auth_client.post(
        "/api/files/",
        json={
            "path": "notes/delete-test.md",
            "content": "To be deleted"
        }
    )
    
    # Delete file
    response = auth_client.delete("/api/files/notes/delete-test.md")
    assert response.status_code == 200
    
    # Verify deletion
    response = auth_client.get("/api/files/notes/delete-test.md")
    assert response.status_code == 404


def test_rename_file(auth_client):
    """Test renaming a file"""
    # Create file
    auth_client.post(
        "/api/files/",
        json={
            "path": "notes/old-name.md",
            "content": "Rename test"
        }
    )
    
    # Rename file
    response = auth_client.post(
        "/api/files/rename",
        json={
            "old_path": "notes/old-name.md",
            "new_path": "notes/new-name.md"
        }
    )
    assert response.status_code == 200
    
    # Verify old path doesn't exist
    response = auth_client.get("/api/files/notes/old-name.md")
    assert response.status_code == 404
    
    # Verify new path exists
    response = auth_client.get("/api/files/notes/new-name.md")
    assert response.status_code == 200

