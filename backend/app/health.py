"""Health check utilities"""
from datetime import datetime
from pathlib import Path
from app.config import settings
from app.database import SessionLocal
from app.models import User


def check_database() -> dict:
    """Check database connection"""
    try:
        db = SessionLocal()
        # Try a simple query
        db.query(User).first()
        db.close()
        return {"status": "healthy", "message": "Database connection OK"}
    except Exception as e:
        return {"status": "unhealthy", "message": f"Database error: {str(e)}"}


def check_storage() -> dict:
    """Check storage directories"""
    try:
        vaults_path = Path(settings.VAULTS_ROOT)
        indexes_path = Path(settings.INDEXES_ROOT)
        
        if not vaults_path.exists():
            return {"status": "unhealthy", "message": "Vaults directory not found"}
        
        if not indexes_path.exists():
            return {"status": "unhealthy", "message": "Indexes directory not found"}
        
        # Check if writable
        test_file = vaults_path / ".health_check"
        test_file.touch()
        test_file.unlink()
        
        return {"status": "healthy", "message": "Storage accessible"}
    except Exception as e:
        return {"status": "unhealthy", "message": f"Storage error: {str(e)}"}


def get_detailed_health() -> dict:
    """Get detailed health information"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "checks": {
            "database": check_database(),
            "storage": check_storage()
        }
    }

