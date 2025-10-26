from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import uvicorn
import logging

from app.config import settings
from app.database import init_db
from app.api import auth, files, canvas
from app.search import search_router
from app.middleware import LoggingMiddleware, ErrorHandlingMiddleware, SecurityHeadersMiddleware
from app.logging_config import setup_logging

# Setup logging
setup_logging(log_level="INFO", log_file="data/app.log")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events - startup and shutdown"""
    # Startup
    logger.info("🚀 Starting Obsidian Web API...")
    init_db()
    logger.info("✅ Database initialized")
    logger.info(f"📁 Vaults directory: {settings.VAULTS_ROOT}")
    logger.info(f"🔍 Indexes directory: {settings.INDEXES_ROOT}")
    logger.info(f"🔐 CORS origins: {settings.CORS_ORIGINS}")
    
    yield
    
    # Shutdown
    logger.info("👋 Shutting down Obsidian Web API...")


app = FastAPI(
    title="Obsidian Web API",
    description="Self-hosted multi-user note-taking application",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware - MUST be first to handle preflight requests!
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add custom middlewares (order matters!)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(LoggingMiddleware)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(files.router, prefix="/files", tags=["Files"])
app.include_router(search_router, prefix="/search", tags=["Search"])  # Whoosh-based search at /search
app.include_router(canvas.router, prefix="/canvas", tags=["Canvas"])


@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "Obsidian Web API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    from app.health import get_detailed_health
    return get_detailed_health()


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

