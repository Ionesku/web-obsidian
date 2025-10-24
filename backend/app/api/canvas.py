from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from pydantic import BaseModel

from app.auth import get_current_user
from app.models import User
from app.vault_service import VaultService

router = APIRouter()


class CanvasNode(BaseModel):
    id: str
    type: str  # 'note', 'text', 'group', 'file'
    x: float
    y: float
    width: float
    height: float
    content: str = None
    noteId: str = None
    color: str = None


class CanvasEdge(BaseModel):
    id: str
    fromNode: str
    toNode: str
    fromSide: str = None
    toSide: str = None
    color: str = None


class CanvasData(BaseModel):
    nodes: List[CanvasNode] = []
    edges: List[CanvasEdge] = []


def get_vault_service(current_user: User = Depends(get_current_user)) -> VaultService:
    """Dependency to get vault service for current user"""
    return VaultService(current_user.id)


@router.get("/list")
async def list_canvas_files(
    vault: VaultService = Depends(get_vault_service)
):
    """List all canvas files"""
    canvas_path = vault.vault_path / 'canvas'
    
    if not canvas_path.exists():
        return []
    
    canvases = []
    for file in canvas_path.glob('*.canvas'):
        stats = file.stat()
        canvases.append({
            'path': f'canvas/{file.name}',
            'name': file.stem,
            'modified': stats.st_mtime,
            'size': stats.st_size
        })
    
    return sorted(canvases, key=lambda x: x['modified'], reverse=True)


@router.get("/{canvas_name}")
async def get_canvas(
    canvas_name: str,
    vault: VaultService = Depends(get_vault_service)
):
    """Get a canvas file"""
    if not canvas_name.endswith('.canvas'):
        canvas_name = f"{canvas_name}.canvas"
    
    canvas_path = f"canvas/{canvas_name}"
    
    try:
        data = await vault.read_file(canvas_path)
        
        # Parse canvas JSON
        import json
        canvas_data = json.loads(data['content'])
        
        return {
            'path': canvas_path,
            'data': canvas_data,
            'modified': data['modified']
        }
    except FileNotFoundError:
        # Return empty canvas
        return {
            'path': canvas_path,
            'data': {'nodes': [], 'edges': []},
            'modified': None
        }
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid canvas file format"
        )


@router.put("/{canvas_name}")
async def save_canvas(
    canvas_name: str,
    canvas_data: CanvasData,
    vault: VaultService = Depends(get_vault_service)
):
    """Save a canvas file"""
    if not canvas_name.endswith('.canvas'):
        canvas_name = f"{canvas_name}.canvas"
    
    canvas_path = f"canvas/{canvas_name}"
    
    try:
        import json
        content = json.dumps(canvas_data.dict(), indent=2)
        
        result = await vault.write_file(canvas_path, content)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{canvas_name}")
async def delete_canvas(
    canvas_name: str,
    vault: VaultService = Depends(get_vault_service)
):
    """Delete a canvas file"""
    if not canvas_name.endswith('.canvas'):
        canvas_name = f"{canvas_name}.canvas"
    
    canvas_path = f"canvas/{canvas_name}"
    
    try:
        result = await vault.delete_file(canvas_path)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

