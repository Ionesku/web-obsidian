from pydantic_settings import BaseSettings
from pydantic import field_validator
from pathlib import Path


class Settings(BaseSettings):
    """Application settings"""
    
    # Security
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database - use absolute path to ensure consistency
    @property
    def DATABASE_URL(self) -> str:
        from pathlib import Path
        db_path = Path(__file__).parent.parent.parent / "data" / "app.db"
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{db_path.as_posix()}"
    
    # Storage paths
    VAULTS_ROOT: str = "data/vaults"
    INDEXES_ROOT: str = "data/indexes"
    WHOOSH_INDEX_DIR: str = "data/whoosh"
    
    # Search settings
    INDEX_ON_STARTUP: bool = True  # Auto-index files on startup if index is empty
    
    # CORS - stored as string, parsed to list
    _cors_origins: str = "http://0.0.0.0:5173,http://0.0.0.0:3000,http://0.0.0.0:80,http://localhost:5173,http://localhost:3000,http://localhost:80,http://localhost:8000,http://127.0.0.1:5173,http://127.0.0.1:3000,http://127.0.0.1:80,http://192.168.1.23:5173,http://192.168.1.23:3000,http://192.168.1.23:80,http://192.168.1.23"
    
    @property
    def CORS_ORIGINS(self) -> list[str]:
        """Parse CORS origins from comma-separated string"""
        if isinstance(self._cors_origins, str):
            origins = [origin.strip() for origin in self._cors_origins.split(',') if origin.strip()]
            return origins if origins else ["http://localhost:5173"]
        return ["http://localhost:5173"]
    
    # File limits
    MAX_NOTE_SIZE: int = 10 * 1024 * 1024  # 10MB
    MAX_ATTACHMENT_SIZE: int = 50 * 1024 * 1024  # 50MB
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
    
    # Allow reading CORS_ORIGINS env var into _cors_origins field
    @classmethod
    def settings_customise_sources(cls, settings_cls, init_settings, env_settings, dotenv_settings, file_secret_settings):
        # Map CORS_ORIGINS to _cors_origins
        class CustomEnvSettings:
            def __init__(self, env_settings):
                self.env_settings = env_settings
            
            def __call__(self):
                d = self.env_settings()
                if 'CORS_ORIGINS' in d:
                    d['_cors_origins'] = d.pop('CORS_ORIGINS')
                return d
        
        return (
            init_settings,
            CustomEnvSettings(env_settings),
            dotenv_settings,
            file_secret_settings,
        )


settings = Settings()

# Ensure data directories exist
Path(settings.VAULTS_ROOT).mkdir(parents=True, exist_ok=True)
Path(settings.INDEXES_ROOT).mkdir(parents=True, exist_ok=True)
Path(settings.WHOOSH_INDEX_DIR).mkdir(parents=True, exist_ok=True)

