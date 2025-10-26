from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import uvicorn
import logging
from filelock import FileLock, Timeout

from app.config import settings
from app.database import init_db
from app.api import auth, files, canvas, bookmarks
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
    
    # Initialize search index
    from app.search.indexer import get_indexer
    indexer = get_indexer()
    stats = indexer.get_stats()
    logger.info(f"🔍 Search index loaded: {stats.get('doc_count', 0)} documents")
    
    # Auto-index only when explicitly enabled (and under lock)
    if getattr(settings, 'INDEX_ON_STARTUP', False):
        lock = FileLock("data/whoosh/.index.lock", timeout=0)
        try:
            with lock:
                logger.info("📚 Starting background indexing (exclusive)...")
                import asyncio
                app.state.index_task = asyncio.create_task(auto_index_all_files())
        except Timeout:
            logger.info("Another worker already indexing; skip")
    
    yield
    
    # Shutdown
    logger.info("👋 Shutting down Obsidian Web API...")
    # cancel background indexing if running
    task = getattr(app.state, "index_task", None)
    if task and not task.done():
        task.cancel()


async def auto_index_all_files():
    """Background task to index all files on startup"""
    import time
    from pathlib import Path
    from app.vault_service import VaultService
    from app.search.indexer import get_indexer
    from app.search.markdown_parser import extract_metadata_for_index
    from datetime import datetime, timezone
    
    start_time = time.time()
    total_indexed = 0
    total_skipped = 0
    total_errors = 0

    try:
        indexer = get_indexer()
        vaults_root = Path(settings.VAULTS_ROOT)
        
        if not vaults_root.exists():
            logger.warning(f"Vaults directory not found: {vaults_root}")
            return
        
        # Get indexed documents with their mtimes
        indexed_docs = {}
        with indexer.ix.searcher() as searcher:
            for doc in searcher.all_stored_fields():
                indexed_docs[doc.get('path')] = doc.get('mtime')
        
        # Process each user's vault
        for user_dir in vaults_root.glob("user_*"):
            if not user_dir.is_dir():
                continue
            
            try:
                user_id = int(user_dir.name.split("_")[1])
            except (IndexError, ValueError):
                continue
            
            vault = VaultService(user_id)
            
            try:
                files = await vault.list_files()
                
                for file_info in files:
                    if not file_info.path.endswith('.md'):
                        continue
                    
                    try:
                        # Check if file needs reindexing (modified or new)
                        file_data = await vault.read_file(file_info.path)
                        
                        modified_str = file_data.get('modified', '1970-01-01T00:00:00Z')
                        try:
                            file_mtime = datetime.fromisoformat(modified_str.replace('Z', '+00:00')).astimezone(timezone.utc)
                        except ValueError:
                            file_mtime = datetime.fromisoformat(modified_str).astimezone(timezone.utc)
                        
                        indexed_mtime = indexed_docs.get(file_info.path)
                        
                        # Skip if already indexed and not modified
                        if indexed_mtime and isinstance(indexed_mtime, datetime):
                            # Ensure indexed_mtime is timezone-aware for comparison
                            if indexed_mtime.tzinfo is None:
                                indexed_mtime = indexed_mtime.replace(tzinfo=timezone.utc)

                            if file_mtime <= indexed_mtime:
                                total_skipped += 1
                                continue
                        
                        # Index the file
                        content = file_data.get('content', '')
                        metadata = extract_metadata_for_index(content, file_info.path)
                        
                        indexer.upsert_document(
                            path=file_info.path,
                            content=content,
                            name=metadata['name'],
                            tags=metadata['tags'],
                            props=metadata['props'],
                            mtime=file_mtime
                        )
                        
                        total_indexed += 1
                        
                    except Exception as e:
                        logger.error(f"Error indexing {file_info.path}: {e}")
                        total_errors += 1
                        
            except Exception as e:
                logger.error(f"Error processing user {user_id}: {e}")
                total_errors += 1
        
        end_time = time.time()
        duration = end_time - start_time
        docs_per_sec = total_indexed / duration if duration > 0 else 0
        
        # Optimize index after bulk update
        if total_indexed > 0:
            indexer.optimize()
        
        stats = indexer.get_detailed_stats()
        
        logger.info(
            f"✅ Background indexing complete! "
            f"Duration: {duration:.2f}s, "
            f"Indexed: {total_indexed}, "
            f"Skipped: {total_skipped}, "
            f"Errors: {total_errors}, "
            f"Docs/sec: {docs_per_sec:.2f}, "
            f"Index size: {stats.get('index_size_mb', 0):.2f}MB, "
            f"Segments: {stats.get('segments', 'N/A')}"
        )
        
    except Exception as e:
        logger.error(f"Auto-indexing failed: {e}", exc_info=True)


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
app.include_router(bookmarks.router, prefix="/bookmarks", tags=["Bookmarks"])


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

