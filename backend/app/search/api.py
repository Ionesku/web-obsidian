"""
FastAPI Search Endpoints
"""
import re
import logging
from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, Query

from whoosh.qparser import QueryParser, MultifieldParser, OrGroup
from whoosh.query import And, Or, Term, Phrase, Regex, Every
from whoosh import scoring

from .indexer import get_indexer, MarkdownIndexer
from ..auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/search", tags=["search"])


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class ServerTerm(BaseModel):
    """Search term for server-side search"""
    type: str = Field(..., description="Term type: word, phrase, regex, line")
    value: Optional[str] = None
    flags: Optional[str] = None
    sub: Optional[Dict[str, Any]] = None  # For line: queries


class SearchRequest(BaseModel):
    """Search request from client"""
    terms: List[ServerTerm] = Field(..., description="Search terms")
    restrict_paths: Optional[List[str]] = Field(
        None,
        description="Restrict search to these paths (from local filtering)"
    )
    limit: int = Field(100, ge=1, le=1000)
    offset: int = Field(0, ge=0)
    caseSensitive: bool = False


class MatchRange(BaseModel):
    """Character range for highlighting"""
    start: int
    end: int


class Snippet(BaseModel):
    """Text snippet with highlighting"""
    line: int
    text: str
    ranges: List[List[int]]  # List of [start, end] pairs


class SearchHit(BaseModel):
    """Single search result"""
    path: str
    score: float
    ranges: Optional[List[MatchRange]] = None
    snippets: Optional[List[Snippet]] = None


class SearchResponse(BaseModel):
    """Search response"""
    hits: List[SearchHit]
    total: int
    took: float  # milliseconds


# ============================================================================
# SEARCH ENDPOINT
# ============================================================================

@router.post("", response_model=SearchResponse)
async def search(
    req: SearchRequest,
    indexer: MarkdownIndexer = Depends(lambda: get_indexer()),
    current_user: dict = Depends(get_current_user),
) -> SearchResponse:
    """
    Full-text search endpoint
    
    Executes server-side search with optional path filtering from local layer.
    
    - **terms**: List of search terms (word, phrase, regex, line)
    - **restrict_paths**: Optional list of paths to restrict search
    - **limit**: Maximum number of results
    - **offset**: Pagination offset
    """
    start_time = datetime.now()
    
    try:
        # Build Whoosh query from terms
        query = build_whoosh_query(req.terms, indexer, req.caseSensitive)
        
        # Execute search
        with indexer.ix.searcher(weighting=scoring.BM25F()) as searcher:
            # Apply path filter if provided
            filter_query = None
            if req.restrict_paths:
                # Create OR query for allowed paths
                path_terms = [Term("path", path) for path in req.restrict_paths]
                filter_query = Or(path_terms)
            
            # Search with filter
            results = searcher.search(
                query,
                limit=req.limit + req.offset,
                filter=filter_query,
            )
            
            # Convert results to hits
            hits = []
            for result in results[req.offset:req.offset + req.limit]:
                hit = SearchHit(
                    path=result["path"],
                    score=result.score,
                )
                
                # Add snippets if content is available
                # Note: content is not stored, so we'd need to read from filesystem
                # For now, just return basic hit
                
                hits.append(hit)
            
            took = (datetime.now() - start_time).total_seconds() * 1000
            
            return SearchResponse(
                hits=hits,
                total=len(results),
                took=took,
            )
    
    except Exception as e:
        logger.error(f"Search error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


# ============================================================================
# QUERY BUILDER
# ============================================================================

def build_whoosh_query(terms: List[ServerTerm], indexer: MarkdownIndexer, case_sensitive: bool = False):
    """
    Build Whoosh query from search terms
    
    Args:
        terms: List of search terms
        indexer: Indexer instance
        case_sensitive: Whether search is case-sensitive
        
    Returns:
        Whoosh query object
    """
    if not terms:
        return Every()
    
    clauses = []
    
    for term in terms:
        if term.type == "word":
            # Simple word search in content
            parser = QueryParser("content", indexer.ix.schema)
            q = parser.parse(term.value or "")
            clauses.append(q)
        
        elif term.type == "phrase":
            # Phrase search (exact match)
            words = (term.value or "").split()
            clauses.append(Phrase("content", words))
        
        elif term.type == "regex":
            # Regex search (with trigram prefilter)
            pattern = term.value or ""
            flags = term.flags or ""
            
            # Extract prefix for trigram prefilter
            prefix = extract_regex_prefix(pattern)
            if len(prefix) >= 3:
                tri_query = Term("tri", prefix[:3].lower())
                clauses.append(tri_query)
            
            # Add regex query
            re_flags = 0
            if 'i' in flags:
                re_flags |= re.IGNORECASE
            if 'm' in flags:
                re_flags |= re.MULTILINE
            
            try:
                clauses.append(Regex("content", pattern, flags=re_flags))
            except Exception as e:
                logger.warning(f"Invalid regex '{pattern}': {e}")
        
        elif term.type == "line":
            # Line-specific search (treat sub-term as regular search for now)
            if term.sub:
                sub_term = ServerTerm(**term.sub)
                sub_query = build_whoosh_query([sub_term], indexer, case_sensitive)
                clauses.append(sub_query)
    
    # Combine with AND
    if len(clauses) == 0:
        return Every()
    if len(clauses) == 1:
        return clauses[0]
    
    return And(clauses)


def extract_regex_prefix(pattern: str) -> str:
    """
    Extract literal prefix from regex pattern for trigram filtering
    
    Args:
        pattern: Regex pattern
        
    Returns:
        Literal prefix (may be empty)
    """
    # Simple heuristic: extract leading literal characters
    prefix = []
    i = 0
    while i < len(pattern):
        c = pattern[i]
        
        # Stop at regex metacharacters
        if c in r'.*+?[]{}()|\^$':
            break
        
        # Handle escapes
        if c == '\\' and i + 1 < len(pattern):
            prefix.append(pattern[i + 1])
            i += 2
        else:
            prefix.append(c)
            i += 1
    
    return ''.join(prefix)


# ============================================================================
# INDEX MANAGEMENT ENDPOINTS
# ============================================================================

class IndexRequest(BaseModel):
    """Request to index a file"""
    path: str
    content: str
    name: str
    tags: List[str] = []
    props: Dict[str, Any] = {}


@router.post("/index")
async def index_file(
    req: IndexRequest,
    indexer: MarkdownIndexer = Depends(lambda: get_indexer()),
    current_user: dict = Depends(get_current_user),
):
    """
    Index a single file
    
    Called by backend when file is saved.
    """
    success = indexer.upsert_document(
        path=req.path,
        content=req.content,
        name=req.name,
        tags=req.tags,
        props=req.props,
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to index file")
    
    return {"success": True, "path": req.path}


@router.delete("/index/{path:path}")
async def delete_from_index(
    path: str,
    indexer: MarkdownIndexer = Depends(lambda: get_indexer()),
    current_user: dict = Depends(get_current_user),
):
    """
    Delete a file from index
    """
    success = indexer.delete_document(path)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete from index")
    
    return {"success": True, "path": path}


@router.get("/stats")
async def get_stats(
    indexer: MarkdownIndexer = Depends(lambda: get_indexer()),
    current_user: dict = Depends(get_current_user),
):
    """
    Get index statistics
    """
    stats = indexer.get_stats()
    return stats


@router.post("/optimize")
async def optimize_index(
    indexer: MarkdownIndexer = Depends(lambda: get_indexer()),
    current_user: dict = Depends(get_current_user),
):
    """
    Optimize index (merge segments)
    """
    success = indexer.optimize()
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to optimize index")
    
    return {"success": True}


@router.post("/clear")
async def clear_index(
    indexer: MarkdownIndexer = Depends(lambda: get_indexer()),
    current_user: dict = Depends(get_current_user),
):
    """
    Clear entire index (dangerous!)
    """
    success = indexer.clear_index()
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to clear index")
    
    return {"success": True}

