from fastapi import APIRouter, Depends, Query
from typing import List

from app.auth import get_current_user
from app.models import User, SearchResult
from app.search_service import SearchService

router = APIRouter()


def get_search_service(current_user: User = Depends(get_current_user)) -> SearchService:
    """Dependency to get search service for current user"""
    return SearchService(current_user.id)


@router.get("/", response_model=List[SearchResult])
async def search_notes(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of results"),
    search: SearchService = Depends(get_search_service)
):
    """Search notes by content, title, or tags"""
    return search.search(q, limit=limit)


@router.get("/tags/{tag}", response_model=List[dict])
async def search_by_tag(
    tag: str,
    limit: int = Query(50, ge=1, le=100),
    search: SearchService = Depends(get_search_service)
):
    """Search notes by tag"""
    return search.search_by_tag(tag, limit=limit)


@router.post("/reindex")
async def reindex_vault(
    search: SearchService = Depends(get_search_service)
):
    """Rebuild search index for user's vault"""
    search.reindex_all()
    stats = search.get_stats()
    return {
        "message": "Search index rebuilt successfully",
        "stats": stats
    }


@router.get("/stats")
async def get_search_stats(
    search: SearchService = Depends(get_search_service)
):
    """Get search index statistics"""
    return search.get_stats()

