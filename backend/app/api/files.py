from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from typing import List
from pathlib import Path

from app.auth import get_current_user
from app.models import User, NoteContent, NoteResponse, FileInfo, BacklinkInfo, RenameRequest
from app.vault_service import VaultService
from app.search_service import SearchService
from app.search import get_indexer

router = APIRouter()


def get_vault_service(current_user: User = Depends(get_current_user)) -> VaultService:
    """Dependency to get vault service for current user"""
    return VaultService(current_user.id)


def get_search_service(current_user: User = Depends(get_current_user)) -> SearchService:
    """Dependency to get search service for current user"""
    return SearchService(current_user.id)


@router.get("/list", response_model=List[FileInfo])
async def list_files(
    folder: str = '',
    vault: VaultService = Depends(get_vault_service)
):
    """Get list of all files in vault"""
    return await vault.list_files(folder)


@router.get("/{path:path}", response_model=NoteResponse)
async def read_file(
    path: str,
    vault: VaultService = Depends(get_vault_service)
):
    """Read a file"""
    try:
        return await vault.read_file(path)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File {path} not found"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_file(
    note: NoteContent,
    vault: VaultService = Depends(get_vault_service),
    search: SearchService = Depends(get_search_service)
):
    """Create a new file"""
    try:
        result = await vault.write_file(note.path, note.content)
        
        # Index the file for search (old system)
        search.index_file(note.path, note.content)
        
        # Index for Whoosh (new advanced search)
        indexer = get_indexer()
        # TODO: Extract metadata from content (tags, props)
        indexer.upsert_document(
            path=note.path,
            content=note.content,
            name=Path(note.path).name,
            tags=[],  # Will be extracted from content
            props={},  # Will be extracted from frontmatter
        )
        
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{path:path}")
async def update_file(
    path: str,
    note: NoteContent,
    vault: VaultService = Depends(get_vault_service),
    search: SearchService = Depends(get_search_service)
):
    """Update a file"""
    try:
        result = await vault.write_file(path, note.content)
        
        # Update search index (old system)
        search.index_file(path, note.content)
        
        # Update Whoosh index (new advanced search)
        indexer = get_indexer()
        indexer.upsert_document(
            path=path,
            content=note.content,
            name=Path(path).name,
            tags=[],  # TODO: Extract from content
            props={},  # TODO: Extract from frontmatter
        )
        
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{path:path}")
async def delete_file(
    path: str,
    vault: VaultService = Depends(get_vault_service),
    search: SearchService = Depends(get_search_service)
):
    """Delete a file"""
    try:
        result = await vault.delete_file(path)
        
        # Remove from search index
        search.remove_file(path)
        
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/rename")
async def rename_file(
    request: RenameRequest,
    vault: VaultService = Depends(get_vault_service),
    search: SearchService = Depends(get_search_service)
):
    """Rename or move a file"""
    try:
        result = await vault.rename_file(request.old_path, request.new_path)
        
        # Update search index
        search.remove_file(request.old_path)
        
        # Read and reindex with new path
        file_data = await vault.read_file(request.new_path)
        search.index_file(request.new_path, file_data['content'])
        
        return result
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{path:path}/backlinks", response_model=List[BacklinkInfo])
async def get_backlinks(
    path: str,
    vault: VaultService = Depends(get_vault_service)
):
    """Get backlinks to a note"""
    return await vault.get_backlinks(path)


@router.get("/daily")
@router.get("/daily/{date}")
async def get_daily_note(
    date: str | None = None,
    vault: VaultService = Depends(get_vault_service)
):
    """Get or create daily note"""
    try:
        return await vault.get_daily_note(date)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    file: UploadFile = File(...),
    vault: VaultService = Depends(get_vault_service)
):
    """Upload an attachment"""
    
    # Check file type
    allowed_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.svg', '.webp']
    file_ext = Path(file.filename).suffix.lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"
        )
    
    try:
        content = await file.read()
        result = await vault.save_attachment(file.filename, content)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/attachments/{filename}")
async def get_attachment(
    filename: str,
    vault: VaultService = Depends(get_vault_service)
):
    """Serve an attachment file"""
    file_path = vault.vault_path / 'attachments' / filename
    
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found"
        )
    
    return FileResponse(file_path)

