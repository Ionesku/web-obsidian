"""
Search module for full-text search with Whoosh
"""
from .whoosh_schema import get_index, get_schema
from .indexer import get_indexer
from .api import router as search_router

__all__ = ["get_index", "get_schema", "get_indexer", "search_router"]

