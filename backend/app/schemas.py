from pydantic import BaseModel
from typing import List, Optional

class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class User(UserBase):
    id: int

    class Config:
        from_attributes = True

class UserResponse(UserBase):
    id: int

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class NoteContent(BaseModel):
    path: str
    content: str

class NoteResponse(BaseModel):
    path: str
    content: str
    modified: float
    size: int

class FileInfo(BaseModel):
    path: str
    name: str
    type: str
    mtime: float
    size: int

    class Config:
        from_attributes = True

class BacklinkInfo(BaseModel):
    path: str
    title: str
    context: str
    line: int

class RenameRequest(BaseModel):
    old_path: str
    new_path: str

class BookmarkBase(BaseModel):
    path: str
    title: str
    group: Optional[str] = None

class BookmarkCreate(BookmarkBase):
    pass

class Bookmark(BookmarkBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True
