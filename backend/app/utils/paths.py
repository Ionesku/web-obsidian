from pathlib import Path
from fastapi import HTTPException

def safe_join(base: Path, user_path: str) -> Path:
    """
    Safely join a base directory with a user-provided path, preventing path traversal.

    Args:
        base: The base directory path.
        user_path: The user-provided path.

    Returns:
        The resolved, safe path.

    Raises:
        HTTPException: If the path is invalid or attempts a traversal attack.
    """
    if not user_path or user_path.startswith(("/", "\\")) or '\\0' in user_path:
        raise HTTPException(status_code=400, detail="Invalid path")

    # Normalize path to prevent '..' traversal
    user_path = Path(user_path).as_posix()
    if ".." in user_path.split("/"):
        raise HTTPException(status_code=400, detail="Invalid path components")

    p = (base / user_path).resolve()
    
    if not str(p).startswith(str(base.resolve())):
        raise HTTPException(status_code=400, detail="Path traversal denied")
        
    return p
