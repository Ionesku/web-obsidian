# Obsidian Knowledge Management System

A comprehensive full-stack knowledge management system with note-taking, visual organization, and daily journaling capabilities.

[🇷🇺 Русская версия](./docs/README_RU.md)

## 🚀 Features

### Backend (FastAPI)
- **JWT Authentication** - Secure user registration and login
- **SQLModel ORM** - Type-safe database operations with async support
- **CRUD API** - Complete REST API for Users, Vaults, and Notes
- **File Upload** - Markdown file upload with validation
- **Async/Await** - Fully asynchronous for optimal performance

### Frontend - Markdown Editor
- **CodeMirror 6** - Modern, extensible markdown editor
- **Wiki Links** - `[[note]]` syntax with autocomplete
- **Transclusion** - `![[note]]` with live preview
- **Vim Mode** - Optional vim keybindings
- **Auto-Save** - Automatic saving to IndexedDB

### Frontend - Infinite Canvas
- **Fabric.js Canvas** - Visual organization of notes
- **Drag & Drop** - Drag notes from sidebar onto canvas
- **Connections** - Draw arrows between related cards
- **Groups** - Organize multiple objects together
- **Pan & Zoom** - Navigate large canvases easily
- **Save/Load** - Export and import canvas state as JSON

### Frontend - Daily Notes
- **Calendar Widget** - Visual date picker with shadcn/ui
- **Auto-Creation** - Daily notes created with YYYY-MM-DD format
- **Template System** - Customizable templates with variable substitution
- **Default Templates** - Daily, Weekly, and Meeting note templates
- **Custom Templates** - Create and manage your own templates

### Advanced Search System (NEW! ⭐)
- **Dual-Layer Architecture** - Local (IndexedDB) + Server (Whoosh) for optimal performance
- **Lightning Fast** - Local metadata search < 50ms, full-text search < 200ms
- **Rich Query Syntax** - Tags, properties, tasks, links, blocks, sections, and more
- **Boolean Logic** - AND, OR, NOT operators with grouping support
- **Federated Execution** - Intelligently splits queries between local and server
- **Web Worker** - Background indexing doesn't block UI
- **Auto-Indexing** - Files automatically indexed on save
- **Obsidian-Inspired** - Familiar query syntax for Obsidian users

**Query Examples:**
```
tag:work task:todo              # Work tasks
[priority:high]                 # High priority notes
"meeting notes"                 # Full-text phrase search
link:[[Research]]               # Files linking to Research
(work OR personal) -archive     # Boolean logic
```

📖 **Documentation**: See [SEARCH_README.md](./SEARCH_README.md) and [SEARCH_IMPLEMENTATION.md](./SEARCH_IMPLEMENTATION.md)

## 📦 Installation

### Option 1: Docker (Recommended)

```bash
# Clone repository
git clone <repository-url>
cd obsidian

# Start with Docker Compose
docker-compose up -d

# Access the application
# Frontend: http://0.0.0.0:3000
# Backend API: http://0.0.0.0:8000
# API Docs: http://0.0.0.0:8000/docs
```

### Option 2: Manual Installation

#### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
echo "DATABASE_URL=sqlite+aiosqlite:///./obsidian.db" > .env
echo "SECRET_KEY=$(openssl rand -hex 32)" >> .env

# Run server
python main.py
```

Backend runs at: `http://0.0.0.0:8000`

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend runs at: `http://0.0.0.0:3000`

## 🎯 Quick Start

### 1. Create Your First Note

1. Go to `http://YOUR_SERVER_IP:3000/editor`
2. Click **"➕ New Note"**
3. Write your note with markdown
4. Auto-saves to IndexedDB

### 2. Try Wiki Links

```markdown
# My Note

Check out [[Another Note]] for more details.

You can also embed notes:
![[Project Overview]]
```

### 3. Organize Visually

1. Go to `/canvas`
2. Drag notes from sidebar onto canvas
3. Click **"🔗 Connect"** to link cards
4. Arrange and save your layout

### 4. Start Daily Journaling

1. Go to `/daily`
2. Today's note auto-creates
3. Edit using your custom template
4. Navigate between dates with calendar

## 📖 Documentation

### General
- [README.md](./README.md) - This file
- [README (Russian)](./docs/README_RU.md) - Russian version
- [Installation Guide](./docs/INSTALLATION_GUIDE.md) - Full installation guide
- [Docker Guide](./docs/DOCKER_README.md) - Docker deployment guide
- [Quick Commands](./docs/QUICK_COMMANDS.md) - Command cheat sheet

### Backend
- [backend/README.md](./backend/README.md) - Backend documentation

### Summaries
- [Editor Complete](./docs/CODEMIRROR_EDITOR_COMPLETE.md) - Editor feature summary
- [Canvas Complete](./docs/CANVAS_COMPLETE.md) - Canvas feature summary
- [Daily Notes Complete](./docs/DAILY_NOTES_COMPLETE.md) - Daily notes summary
- [Project Complete](./docs/PROJECT_COMPLETE.md) - Full project summary
- [Final Summary](./docs/FINAL_SUMMARY.md) - Final project overview

### Additional
- [Changelog](./docs/CHANGELOG.md) - Version history
- [Credits](./docs/CREDITS.md) - Acknowledgments
- [Project Structure](./docs/PROJECT_STRUCTURE.md) - File structure guide

## 🗂️ Project Structure

```
obsidian/
├── backend/                      # FastAPI Backend
│   ├── main.py                  # Main application
│   ├── config.py                # Configuration
│   ├── database.py              # Database setup
│   ├── models.py                # SQLModel models
│   ├── auth.py                  # JWT authentication
│   ├── routers/                 # API endpoints
│   │   ├── auth_router.py      # Auth endpoints
│   │   ├── vaults_router.py    # Vault CRUD
│   │   └── notes_router.py     # Note CRUD
│   ├── requirements.txt         # Python dependencies
│   ├── Dockerfile              # Backend Docker image
│   └── README.md               # Backend docs
│
├── frontend/                     # Next.js Frontend
│   ├── src/
│   │   ├── app/                # Next.js app directory
│   │   │   ├── editor/         # Editor page
│   │   │   ├── canvas/         # Canvas page
│   │   │   └── daily/          # Daily notes page
│   │   ├── components/         # React components
│   │   │   ├── markdown-editor.tsx
│   │   │   ├── infinite-canvas.tsx
│   │   │   ├── daily-notes.tsx
│   │   │   └── template-manager.tsx
│   │   └── lib/                # Utilities
│   │       ├── db.ts           # Dexie.js database
│   │       ├── templates.ts    # Template system
│   │       ├── codemirror/     # Editor extensions
│   │       └── canvas/         # Canvas utilities
│   ├── package.json
│   ├── Dockerfile              # Frontend Docker image
│   └── README.md               # Frontend docs
│
├── docker-compose.yml           # Docker Compose config
├── .gitignore
├── README.md                    # This file
└── README_RU.md                # Russian version
```

## 🛠️ Technology Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLModel** - SQL ORM with Pydantic validation
- **SQLite/AsyncSQLite** - Database (easily swappable)
- **python-jose** - JWT token handling
- **passlib** - Password hashing with bcrypt
- **aiofiles** - Async file operations

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **CodeMirror 6** - Code editor
- **Fabric.js** - Canvas manipulation
- **Dexie.js** - IndexedDB wrapper
- **date-fns** - Date utilities
- **react-day-picker** - Calendar component
- **Tailwind CSS** - Styling

## 🔧 Configuration

### Backend Environment Variables

Create `backend/.env`:

```env
# Database
DATABASE_URL=sqlite+aiosqlite:///./obsidian.db

# JWT
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# File Upload
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE=10485760
```

### Frontend Configuration

Frontend uses IndexedDB for local storage - no configuration needed!

## 🐳 Docker Configuration

### Services

- **backend** - FastAPI server (port 8000)
- **frontend** - Next.js application (port 3000)

### Volumes

- `backend-data` - Persistent database storage
- `backend-uploads` - Uploaded files

### Networks

- `obsidian-network` - Internal network for services

## 📱 Features Overview

### Editor (`/editor`)

**Markdown Editing:**
- Syntax highlighting
- Line numbers
- Code folding
- Auto-save

**Wiki Links:**
- Type `[[` to trigger autocomplete
- Links to other notes
- Custom styling

**Transclusion:**
- Embed notes with `![[note]]`
- Live preview
- Markdown rendering

**Vim Mode:**
- Toggle vim keybindings
- All standard vim commands
- Visual mode support

### Canvas (`/canvas`)

**Visual Organization:**
- Drag notes from sidebar
- Create text blocks
- Draw connections
- Group objects

**Navigation:**
- Pan with Shift+Drag
- Zoom with mouse wheel
- Fit to screen

**Persistence:**
- Save to localStorage
- Export as JSON
- Export as PNG

### Daily Notes (`/daily`)

**Calendar:**
- Visual date picker
- Highlight dates with notes
- Quick navigation

**Templates:**
- Daily journal template
- Weekly review template
- Meeting notes template
- Custom templates

**Variables:**
- `{{date:YYYY-MM-DD}}`
- `{{time:HH:mm}}`
- `{{weekNumber}}`
- Custom variables

## 🔒 Security

- **Password Hashing**: bcrypt
- **JWT Tokens**: Secure authentication
- **CORS Configuration**: Configurable origins
- **Input Validation**: Pydantic models
- **File Upload Security**: Type and size validation

## 🚀 Deployment

### Production Build

#### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

#### Frontend

```bash
cd frontend
npm run build
npm start
```

### Docker Production

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 📊 Performance

- **Backend**: Async I/O for high concurrency
- **Frontend**: IndexedDB for instant local access
- **Canvas**: Efficient rendering with Fabric.js
- **Editor**: CodeMirror 6 optimized for large files

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

### Documentation

- Check inline code comments
- Read feature-specific READMEs
- Review examples in docs

### Common Issues

**Backend won't start:**
- Check Python version (3.12+)
- Verify dependencies installed
- Check .env file exists

**Frontend errors:**
- Clear browser cache
- Delete node_modules and reinstall
- Check console for specific errors

**Docker issues:**
- Ensure Docker Desktop running
- Check port availability (3000, 8000)
- Review container logs

### Getting Help

1. Check documentation first
2. Search existing issues
3. Create new issue with:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Environment details

## 🗺️ Roadmap

### Planned Features

- [ ] Real-time collaboration
- [ ] Mobile app
- [ ] Export to PDF/HTML
- [ ] Advanced search
- [ ] Tag management
- [ ] Graph view
- [ ] Sync across devices
- [ ] Plugins system
- [ ] Themes
- [ ] AI integration

### Version History

- **v1.3.0** - Daily notes with calendar and templates
- **v1.2.0** - Infinite canvas with Fabric.js
- **v1.1.0** - CodeMirror editor with wiki links
- **v1.0.0** - Initial release with backend API

## 🎯 Use Cases

**Personal Knowledge Base:**
- Organize research and notes
- Link related concepts
- Visualize connections

**Daily Journaling:**
- Track daily activities
- Review weekly progress
- Document meetings

**Project Management:**
- Create project notes
- Visualize workflows on canvas
- Connect related tasks

**Learning:**
- Take course notes
- Link concepts together
- Review with daily notes

## 🌟 Credits

Built with amazing open-source projects:
- FastAPI
- Next.js
- CodeMirror
- Fabric.js
- Dexie.js
- shadcn/ui
- And many more!

## 📞 Contact

For questions, feature requests, or bug reports, please create an issue.

---

**Made with ❤️ for better knowledge management**

**Happy note-taking! 📝✨**
