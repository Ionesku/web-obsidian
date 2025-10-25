"""
Whoosh Schema for Full-Text Search
"""
import os
from whoosh.fields import Schema, ID, TEXT, KEYWORD, NGRAM, DATETIME, NUMERIC
from whoosh.analysis import (
    StemmingAnalyzer,
    RegexTokenizer,
    LowercaseFilter,
    StandardAnalyzer,
)
from whoosh import index
from whoosh.qparser import QueryParser, MultifieldParser, OrGroup
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def get_schema() -> Schema:
    """
    Define Whoosh schema for markdown files
    
    Fields:
    - path: Unique file path (ID)
    - name: File name (searchable)
    - tags: Comma-separated tags (keyword field)
    - props: Comma-separated key=value properties
    - content: Full markdown content (with stemming)
    - tri: Trigrams for regex prefiltering
    - mtime: Modification time
    - size: File size in bytes
    """
    return Schema(
        path=ID(stored=True, unique=True),
        name=TEXT(analyzer=StandardAnalyzer(), stored=True, field_boost=2.0),
        tags=KEYWORD(lowercase=True, commas=True, scorable=True, stored=True),
        props=KEYWORD(lowercase=True, commas=True, stored=True),
        content=TEXT(analyzer=StemmingAnalyzer(), phrase=True, stored=False),
        tri=NGRAM(minsize=3, maxsize=3, stored=False),  # For regex prefiltering
        mtime=DATETIME(stored=True),
        size=NUMERIC(stored=True),
    )


def ensure_index(index_dir: str) -> index.Index:
    """
    Ensure Whoosh index exists, create if missing
    
    Args:
        index_dir: Directory to store index
        
    Returns:
        Index object
    """
    if not os.path.exists(index_dir):
        logger.info(f"Creating index directory: {index_dir}")
        os.makedirs(index_dir, exist_ok=True)
    
    if index.exists_in(index_dir):
        logger.info(f"Opening existing index at: {index_dir}")
        return index.open_dir(index_dir)
    
    logger.info(f"Creating new index at: {index_dir}")
    schema = get_schema()
    return index.create_in(index_dir, schema)


def get_index(index_dir: str = "/data/whoosh") -> index.Index:
    """
    Get or create Whoosh index
    
    Args:
        index_dir: Directory containing the index
        
    Returns:
        Index object
    """
    return ensure_index(index_dir)

