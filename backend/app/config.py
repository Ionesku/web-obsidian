from pydantic_settings import BaseSettings
from pydantic import field_validator
from pathlib import Path


class Settings(BaseSettings):
    """Application settings"""
    
    # Security
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = "sqlite:///data/app.db"
    
    # Storage paths
    VAULTS_ROOT: str = "data/vaults"
    INDEXES_ROOT: str = "data/indexes"
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://0.0.0.0:5173", "http://0.0.0.0:3000", "http://0.0.0.0:80"]
    
    # File limits
    MAX_NOTE_SIZE: int = 10 * 1024 * 1024  # 10MB
    MAX_ATTACHMENT_SIZE: int = 50 * 1024 * 1024  # 50MB
    
    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list"""
        if isinstance(v, str):
            # Handle comma-separated string from environment
            return [origin.strip() for origin in v.split(',') if origin.strip()]
        return v
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Ensure data directories exist
Path(settings.VAULTS_ROOT).mkdir(parents=True, exist_ok=True)
Path(settings.INDEXES_ROOT).mkdir(parents=True, exist_ok=True)

