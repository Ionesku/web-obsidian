from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from typing import List
from pathlib import Path

from app.auth import get_current_user
from app.models import User, NoteContent, NoteResponse, FileInfo, BacklinkInfo, RenameRequest
from app.vault_service import VaultService
from app.search import get_indexer
from app.search.markdown_parser import extract_metadata_for_index

router = APIRouter()


def get_vault_service(current_user: User = Depends(get_current_user)) -> VaultService:
    """Dependency to get vault service for current user"""
    return VaultService(current_user.id)


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
    current_user: User = Depends(get_current_user)
):
    """Create a new file"""
    try:
        result = await vault.write_file(note.path, note.content)
        
        # Index via API call
        async with httpx.AsyncClient() as client:
            # You might need to build the URL dynamically
            url = f"http://localhost:8000/api/search/index"
            headers = {"Authorization": f"Bearer {current_user.access_token}"}
            await client.post(url, json={"path": note.path}, headers=headers)
            
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
    current_user: User = Depends(get_current_user)
):
    """Update a file"""
    try:
        result = await vault.write_file(path, note.content)

        # Index directly using the indexer
        indexer = get_indexer()
        metadata = extract_metadata_for_index(note.content)
        
        indexer.upsert_document(
            path=path,
            content=note.content,
            name=path.split('/')[-1],
            tags=metadata['tags'],
            props=metadata['frontmatter']
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
    vault: VaultService = Depends(get_vault_service)
):
    """Delete a file"""
    try:
        result = await vault.delete_file(path)
        
        # Remove from Whoosh index
        indexer = get_indexer()
        indexer.delete_document(path)
        
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
    current_user: User = Depends(get_current_user)
):
    """Rename or move a file"""
    try:
        result = await vault.rename_file(request.old_path, request.new_path)
        
        # Update Whoosh index directly
        indexer = get_indexer()
        indexer.delete_document(request.old_path)
        
        # Re-index with new path
        file_info = await vault.get_file(request.new_path)
        metadata = extract_metadata_for_index(file_info['content'])
        
        indexer.upsert_document(
            path=request.new_path,
            content=file_info['content'],
            name=request.new_path.split('/')[-1],
            tags=metadata['tags'],
            props=metadata['frontmatter']
        )
            
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

