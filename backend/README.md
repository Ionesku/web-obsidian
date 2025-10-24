# Obsidian Web - Backend

FastAPI backend for multi-user note-taking application with file-based storage.

## Features

- 🔐 JWT authentication
- 📁 File-based vault storage per user
- 🔍 Full-text search with Whoosh
- 🔗 Wikilink support and backlinks
- 📅 Daily notes
- 🎨 Canvas support
- 📎 File attachments

## Requirements

- Python 3.11+
- SQLite (included)

## Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env and set your SECRET_KEY

# Run the server
python -m uvicorn app.main:app --reload
```

## API Documentation

Once running, visit:
- Interactive docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration settings
│   ├── auth.py              # Authentication logic
│   ├── models.py            # Pydantic models & SQLAlchemy models
│   ├── database.py          # Database setup
│   ├── vault_service.py     # File operations
│   ├── search_service.py    # Search indexing
│   └── api/
│       ├── auth.py          # Auth endpoints
│       ├── files.py         # File endpoints
│       ├── search.py        # Search endpoints
│       └── canvas.py        # Canvas endpoints
├── requirements.txt
├── Dockerfile
└── README.md
```

## Environment Variables

- `SECRET_KEY` - JWT signing key (required)
- `DATABASE_URL` - SQLite database path
- `VAULTS_ROOT` - User vaults directory
- `INDEXES_ROOT` - Search indexes directory
- `CORS_ORIGINS` - Allowed CORS origins

## Development

```bash
# Run with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest

# Format code
black app/
isort app/
```

## Docker

```bash
# Build image
docker build -t obsidian-web-backend .

# Run container
docker run -d \
  -p 8000:8000 \
  -v ./data:/data \
  -e SECRET_KEY=your-secret-key \
  obsidian-web-backend
```

## Security

- All file paths are validated to prevent traversal attacks
- Each user has an isolated vault directory
- JWT tokens for authentication
- Rate limiting recommended in production
- HTTPS required in production

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get token
- `GET /api/auth/me` - Get current user info

### Files
- `GET /api/files/list` - List all files
- `GET /api/files/{path}` - Read file
- `POST /api/files/` - Create file
- `PUT /api/files/{path}` - Update file
- `DELETE /api/files/{path}` - Delete file
- `GET /api/files/{path}/backlinks` - Get backlinks
- `GET /api/files/daily/{date}` - Get/create daily note
- `POST /api/files/upload` - Upload attachment

### Search
- `GET /api/search/?q=query` - Search notes
- `GET /api/search/tags/{tag}` - Search by tag
- `POST /api/search/reindex` - Rebuild index

### Canvas
- `GET /api/canvas/list` - List canvases
- `GET /api/canvas/{name}` - Get canvas
- `PUT /api/canvas/{name}` - Save canvas
- `DELETE /api/canvas/{name}` - Delete canvas

