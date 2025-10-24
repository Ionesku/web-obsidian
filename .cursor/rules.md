# Obsidian Web - Local-First Note-Taking Application

## Project Overview
A web-based Obsidian-like note-taking application with local-first architecture, self-hosted deployment, and real-time collaboration capabilities.

### Tech Stack
**Frontend:**
- Framework: Next.js 14 with App Router
- Language: TypeScript (strict mode)
- UI Components: shadcn/ui (Radix UI + Tailwind CSS)
- Editor: CodeMirror 6 with custom extensions
- Canvas: Fabric.js for infinite canvas
- State: Zustand for global state
- Storage: Dexie.js (IndexedDB wrapper)
- Markdown: remark + rehype pipeline
- Search: Fuse.js for fuzzy search
- Validation: Zod for schemas

**Backend:**
- Framework: FastAPI (Python 3.11+)
- ORM: SQLModel (SQLAlchemy + Pydantic)
- Auth: FastAPI-Users with JWT
- Storage: MinIO (S3-compatible) or Local FS
- Database: PostgreSQL for production, SQLite for development
- File Sync: Watchdog for file system monitoring
- Security: python-jose, passlib, python-multipart

## Code Style and Conventions

### TypeScript/React
- Use functional components with TypeScript
- Prefer `function` keyword over arrow functions for components
- Use `'use client'` directive only when necessary
- Implement error boundaries with error.tsx
- Add loading states with loading.tsx
- Keep components small and focused
- Use custom hooks for complex logic

### Python/FastAPI
- Use Python 3.11+ features (type hints, async/await)
- Follow PEP 8 with 88 char line length (Black formatter)
- Use Pydantic for all request/response schemas
- Implement dependency injection for database sessions
- Use async functions for all endpoints
- Add docstrings to all functions

### File Structure
```
frontend/
├── app/                    # Next.js App Router
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── editor/            # Editor-related components
│   ├── canvas/            # Canvas components
│   └── vault/             # Vault-specific components
├── lib/                   # Utilities and helpers
├── hooks/                 # Custom React hooks
└── stores/                # Zustand stores

backend/
├── app/
│   ├── api/              # FastAPI routers
│   ├── core/             # Core functionality
│   ├── models/           # SQLModel definitions
│   ├── schemas/          # Pydantic schemas
│   └── services/         # Business logic
```

## Component Patterns

### React Component Template
```typescript
'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface ComponentProps {
  className?: string
  children?: React.ReactNode
}

export function ComponentName({ className, children }: ComponentProps) {
  // Component logic here
  return (
    <div className={cn('default-classes', className)}>
      {children}
    </div>
  )
}
```

### API Route Pattern
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from typing import List, Optional

router = APIRouter(prefix="/api/resource", tags=["resource"])

@router.get("/", response_model=List[ResourceSchema])
async def get_resources(
    skip: int = 0,
    limit: int = 100,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all resources with pagination"""
    # Implementation
```

## Database Models

### SQLModel Pattern
```python
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from typing import Optional, List
import uuid

class NoteBase(SQLModel):
    title: str = Field(index=True)
    content: str
    path: str = Field(index=True)
    
class Note(NoteBase, table=True):
    __tablename__ = "notes"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    vault_id: uuid.UUID = Field(foreign_key="vaults.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    vault: "Vault" = Relationship(back_populates="notes")
    backlinks: List["Link"] = Relationship(back_populates="target_note")
```

## Security Guidelines

### Input Validation
- Always validate user input with Zod (frontend) and Pydantic (backend)
- Sanitize Markdown content with DOMPurify before rendering
- Prevent path traversal in file operations
- Use parameterized queries (SQLModel handles this)

### Authentication
- Implement JWT with refresh tokens
- Store tokens in httpOnly cookies
- Add CSRF protection for state-changing operations
- Rate limit authentication endpoints

### File Operations
- Validate file extensions and MIME types
- Limit file sizes (10MB for notes, 50MB for attachments)
- Isolate vaults by user ID
- Never expose internal file paths

## Editor Implementation

### CodeMirror Setup
```typescript
import { EditorView, basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { vim } from '@codemirror/vim'

// Custom extensions for WikiLinks, tags, etc.
import { wikiLinkExtension } from './extensions/wikilinks'
import { tagExtension } from './extensions/tags'
import { transclusionExtension } from './extensions/transclusion'

const extensions = [
  basicSetup,
  markdown(),
  wikiLinkExtension(),
  tagExtension(),
  transclusionExtension(),
  // Optional vim mode
  vim()
]
```

## Canvas Architecture

### Canvas Data Structure
```typescript
interface CanvasNode {
  id: string
  type: 'note' | 'text' | 'group' | 'image'
  x: number
  y: number
  width: number
  height: number
  content?: string      // For text nodes
  noteId?: string       // For note nodes
  color?: string
  zIndex: number
}

interface CanvasEdge {
  id: string
  fromNode: string
  toNode: string
  fromSide?: 'top' | 'right' | 'bottom' | 'left'
  toSide?: 'top' | 'right' | 'bottom' | 'left'
  color?: string
  label?: string
}

interface CanvasData {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  viewport: {
    x: number
    y: number
    zoom: number
  }
}
```

## Storage Strategy

### IndexedDB Schema (Dexie)
```typescript
import Dexie, { Table } from 'dexie'

class VaultDatabase extends Dexie {
  notes!: Table<Note>
  canvases!: Table<Canvas>
  attachments!: Table<Attachment>
  
  constructor() {
    super('VaultDB')
    this.version(1).stores({
      notes: '&id, vaultId, path, *tags, updatedAt',
      canvases: '&id, vaultId, name, updatedAt',
      attachments: '&id, noteId, name, type'
    })
  }
}
```

## Search Implementation

### Full-Text Search
```typescript
import Fuse from 'fuse.js'

const fuseOptions = {
  keys: [
    { name: 'title', weight: 2 },
    { name: 'content', weight: 1 },
    { name: 'tags', weight: 1.5 }
  ],
  threshold: 0.3,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2
}
```

## Performance Optimization

### Frontend
- Use React.memo for expensive components
- Implement virtual scrolling for long lists
- Debounce search and auto-save operations
- Lazy load heavy components (Canvas, Graph)
- Use Next.js Image optimization
- Enable SWC minification

### Backend
- Use Redis for session storage
- Implement database connection pooling
- Add caching layer for frequently accessed data
- Use background tasks for heavy operations
- Implement pagination for all list endpoints
- Add database indexes on frequently queried fields

## Testing Strategy

### Frontend Tests
```typescript
// Use Vitest + React Testing Library
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NoteEditor } from '@/components/editor/NoteEditor'

describe('NoteEditor', () => {
  it('renders markdown content correctly', () => {
    // Test implementation
  })
})
```

### Backend Tests
```python
# Use pytest + httpx
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_create_note():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post("/api/notes", json={...})
        assert response.status_code == 201
```

## Error Handling

### Frontend Error Boundary
```typescript
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

### Backend Error Handler
```python
from fastapi import HTTPException, status

async def get_note_or_404(note_id: str, session: Session) -> Note:
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Note {note_id} not found"
        )
    return note
```

## Deployment Configuration

### Docker Setup
```dockerfile
# Frontend Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

### Environment Variables
```env
# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000

# Backend
DATABASE_URL=postgresql://user:pass@localhost/obsidian
SECRET_KEY=your-secret-key-here
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
REDIS_URL=redis://localhost:6379
```

## Git Workflow

### Branch Strategy
- `main` - Production ready code
- `develop` - Integration branch
- `feature/*` - New features
- `fix/*` - Bug fixes
- `release/*` - Release preparation

### Commit Messages
Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Maintenance

## Common Tasks

### Add New Note Type
1. Create TypeScript interface in `frontend/types/note.ts`
2. Add SQLModel in `backend/app/models/note.py`
3. Create API endpoints in `backend/app/api/notes.py`
4. Implement UI component in `frontend/components/notes/`
5. Add to IndexedDB schema in `frontend/lib/db.ts`
6. Write tests for both frontend and backend

### Implement New Editor Feature
1. Create CodeMirror extension in `frontend/lib/editor/extensions/`
2. Add to editor configuration
3. Implement keyboard shortcuts if needed
4. Add UI controls to editor toolbar
5. Update markdown parser if necessary
6. Test with various markdown edge cases

### Add Canvas Feature
1. Define data structure in TypeScript
2. Implement Fabric.js objects
3. Add serialization/deserialization logic
4. Create API endpoints for persistence
5. Implement undo/redo functionality
6. Add keyboard shortcuts and gestures