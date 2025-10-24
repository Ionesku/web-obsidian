from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from pydantic import BaseModel, EmailStr

Base = declarative_base()


class User(Base):
    """SQLAlchemy User model"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


# Pydantic schemas for API
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


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
    title: str
    folder: str
    modified: str
    size: int


class BacklinkInfo(BaseModel):
    path: str
    title: str
    context: str


class SearchResult(BaseModel):
    path: str
    title: str
    preview: str
    score: float


class RenameRequest(BaseModel):
    old_path: str
    new_path: str
