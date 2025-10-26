# Obsidian Web - Setup Guide

## Quick Start

### 1. First Time Setup
```bash
# Build and start
docker compose up -d --build

# Check status
docker compose ps
```

### 2. Access the Application
- **Frontend:** http://0.0.0.0:80 or http://localhost:80
- **Backend API:** http://0.0.0.0:8000
- **API Docs:** http://0.0.0.0:8000/docs

### 3. Register Your Account
1. Open http://0.0.0.0
2. Click "Sign Up"
3. Enter username, email, password
4. You'll be auto-logged in

## Data Persistence

### Database & Vaults
All data is stored in the `./data` directory:
```
data/
├── app.db          # User accounts (SQLite)
├── vaults/         # User notes
│   └── user_1/     # First user's vault
│       ├── notes/  # Regular notes
│       └── daily/  # Daily notes
└── indexes/        # Search indexes
```

**Important:** Your user account and all notes **persist across container rebuilds**. No need to re-register!

## Test Data

We've created example notes in `data/vaults/user_1/`:

### Notes Created:
1. **Welcome.md** - Introduction with features overview
2. **Getting Started.md** - Basic usage guide
3. **Advanced Features.md** - Code blocks, transclusion examples
4. **Templates.md** - Reusable note templates
5. **Research/Machine Learning.md** - Example in subfolder
6. **daily/2025-10-25.md** - Today's daily note

### Features to Try:
- **Wiki Links:** Ctrl/Cmd+Click on `[[Welcome]]` to navigate
- **Tags:** Click on `#tutorial` to search by tag
- **Code Blocks:** Syntax highlighting for 15+ languages
- **Folders:** Organize notes hierarchically
- **Daily Notes:** Click calendar icon for today's note
- **Quick Switcher:** Click Cmd icon or press Ctrl/Cmd+P
- **Search:** Click search icon, try `tag:#tutorial`

## Development

### Rebuild After Changes
```bash
# Rebuild specific service
docker compose build backend
docker compose build frontend

# Restart
docker compose up -d
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Reset Everything
```bash
# Stop and remove containers
docker compose down

# CAREFUL: This deletes ALL data including users!
rm -rf data/app.db data/vaults/* data/indexes/*

# Rebuild
docker compose up -d --build
```

## Troubleshooting

### Can't Edit Notes?
1. Check browser console (F12 → Console)
2. Rebuild frontend: `docker compose build frontend`
3. Hard refresh browser: Ctrl+Shift+R

### Notes Not Saving?
1. Check backend logs: `docker compose logs backend`
2. Verify volume mount: `docker compose exec backend ls -la /data`

### Search Not Working?
1. Reindex: Click user menu → Settings → Reindex (coming soon)
2. Or restart backend: `docker compose restart backend`

### Lost Your Password?
Currently no password reset. Options:
1. Delete `data/app.db` and re-register
2. Or manually edit SQLite database

## Features Roadmap

### ✅ Implemented:
- User authentication
- File/folder management
- Wiki-links with navigation
- Tag system with search
- Quick switcher
- Daily notes
- Code syntax highlighting
- Tabs
- Status bar (word/char count)
- Auto-save

### 🚧 Coming Soon:
- [ ] Bookmarks
- [ ] Callouts/Admonitions
- [ ] Image rendering in preview mode
- [ ] Drag & drop attachments
- [ ] Graph view
- [ ] Dark mode (UI prepared)
- [ ] Export to PDF/HTML
- [ ] Mobile responsive design

## Tech Stack

- **Frontend:** React, TypeScript, Vite, CodeMirror 6, Tailwind CSS
- **Backend:** FastAPI, Python 3.11, SQLAlchemy, Whoosh
- **Auth:** JWT with Argon2 password hashing
- **Database:** SQLite
- **Deployment:** Docker, Nginx

## Support

For issues or questions, check:
1. Browser console (F12)
2. Backend logs (`docker compose logs backend`)
3. Frontend logs (`docker compose logs frontend`)

Enjoy your Obsidian Web! 🎉

