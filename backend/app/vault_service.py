from pathlib import Path
from typing import List, Dict, Optional
import json
import aiofiles
from datetime import datetime
import re
from fastapi import HTTPException

from app.config import settings
from app.utils.paths import safe_join


class VaultService:
    """Service for managing user vault files"""
    
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.vault_path = Path(settings.VAULTS_ROOT) / f"user_{user_id}"
        self.ensure_vault_structure()
    
    def ensure_vault_structure(self):
        """Create vault directory structure if it doesn't exist"""
        dirs = ['notes', 'daily', 'attachments', 'canvas', 'templates']
        for dir_name in dirs:
            (self.vault_path / dir_name).mkdir(parents=True, exist_ok=True)
        
        # Create welcome file for new users
        welcome_path = self.vault_path / 'notes' / 'Welcome.md'
        if not welcome_path.exists():
            welcome_content = """# Welcome to Your Vault

## Quick Start
- Create new notes with the + button
- Use [[wiki links]] to connect notes
- Press Cmd/Ctrl+P for quick search
- Daily notes are created automatically

## Keyboard Shortcuts
- `Cmd/Ctrl + S` - Save note
- `Cmd/Ctrl + P` - Quick search
- `Cmd/Ctrl + O` - Open file
- `Cmd/Ctrl + N` - New note

## Features
- **Markdown editing** with syntax highlighting
- **Wikilinks** - `[[note name]]` or `[[note|alias]]`
- **Tags** - Use #tag to organize notes
- **Backlinks** - See which notes link to current note
- **Canvas** - Visual node-based note organization
- **Daily notes** - Automatic daily journal entries

Your files are stored securely on the server and only you have access to them.

## Getting Started

Try creating your first note! Click the + button in the sidebar or press `Cmd/Ctrl + N`.

Use wikilinks to connect ideas: [[My First Note]]

Happy note-taking! 📝
"""
            welcome_path.write_text(welcome_content, encoding='utf-8')
    
    async def read_file(self, path: str) -> Dict:
        """Read a markdown or canvas file"""
        full_path = self._validate_path(path)
        
        if not full_path.exists():
            raise FileNotFoundError(f"File {path} not found")
        
        async with aiofiles.open(full_path, 'r', encoding='utf-8') as f:
            content = await f.read()
        
        stats = full_path.stat()
        return {
            'path': path,
            'content': content,
            'modified': stats.st_mtime,
            'size': stats.st_size
        }
    
    async def write_file(self, path: str, content: str) -> Dict:
        """Save a markdown or canvas file"""
        full_path = self._validate_path(path)
        
        # Check file size
        if len(content.encode('utf-8')) > settings.MAX_NOTE_SIZE:
            raise ValueError(f"File too large. Max size is {settings.MAX_NOTE_SIZE} bytes")
        
        # Create directories if needed
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        async with aiofiles.open(full_path, 'w', encoding='utf-8') as f:
            await f.write(content)
        
        return {'path': path, 'status': 'saved', 'modified': full_path.stat().st_mtime}
    
    async def delete_file(self, path: str) -> Dict:
        """Delete a file"""
        full_path = self._validate_path(path)
        
        if full_path.exists():
            full_path.unlink()
        
        return {'path': path, 'status': 'deleted'}
    
    async def rename_file(self, old_path: str, new_path: str) -> Dict:
        """Rename/move a file"""
        old_full_path = self._validate_path(old_path)
        new_full_path = self._validate_path(new_path)
        
        if not old_full_path.exists():
            raise FileNotFoundError(f"File {old_path} not found")
        
        if new_full_path.exists():
            raise ValueError(f"File {new_path} already exists")
        
        # Create target directory if needed
        new_full_path.parent.mkdir(parents=True, exist_ok=True)
        
        old_full_path.rename(new_full_path)
        
        return {'old_path': old_path, 'new_path': new_path, 'status': 'renamed'}
    
    async def copy_file(self, source_path: str, destination_path: str) -> Dict:
        """Copy a file"""
        source_full_path = self._validate_path(source_path)
        destination_full_path = self._validate_path(destination_path)
        
        if not source_full_path.exists():
            raise FileNotFoundError(f"File {source_path} not found")
        
        if destination_full_path.exists():
            raise ValueError(f"File {destination_path} already exists")
        
        # Create target directory if needed
        destination_full_path.parent.mkdir(parents=True, exist_ok=True)
        
        async with aiofiles.open(source_full_path, 'rb') as f_source:
            content = await f_source.read()
            async with aiofiles.open(destination_full_path, 'wb') as f_dest:
                await f_dest.write(content)
        
        return {'source_path': source_path, 'destination_path': destination_path, 'status': 'copied'}
    
    async def list_files(self, folder: str = '') -> List[Dict]:
        """List all markdown files in vault"""
        base = self.vault_path / folder if folder else self.vault_path
        
        if not base.exists():
            return []
        
        files = []
        # Only find markdown files, ignore directories
        for path in base.rglob('*.md'):
            # Skip dot files/folders, though rglob('*.md') shouldn't hit them
            if any(part.startswith('.') for part in path.parts):
                continue
                
            relative = path.relative_to(self.vault_path)
            stats = path.stat()
            
            files.append({
                'path': str(relative).replace('\\', '/'),
                'name': path.name,
                'type': 'file', # It's always a file now
                'mtime': stats.st_mtime,
                'size': stats.st_size
            })
        
        return sorted(files, key=lambda x: x['mtime'], reverse=True)
    
    async def get_backlinks(self, note_path: str) -> List[Dict]:
        """Find backlinks to a note"""
        note_name = Path(note_path).stem
        note_path_normalized = note_path.replace('\\', '/')
        backlinks = []
        
        # Pattern to match [[note]] or [[path/to/note]]
        patterns = [
            f'[[{note_name}]]',
            f'[[{note_name}|',
            f'[[{note_path_normalized}]]',
            f'[[{note_path_normalized}|'
        ]
        
        # Search all markdown files
        for path in self.vault_path.rglob('*.md'):
            relative_path = str(path.relative_to(self.vault_path)).replace('\\', '/')
            
            # Skip the file itself
            if relative_path == note_path_normalized:
                continue
            
            try:
                content = path.read_text(encoding='utf-8')
                
                # Check if any pattern matches
                if any(pattern in content for pattern in patterns):
                    lines = content.split('\n')
                    
                    # Find lines with links
                    for i, line in enumerate(lines):
                        if any(pattern in line for pattern in patterns):
                            # Get context around the link
                            start = max(0, i - 1)
                            end = min(len(lines), i + 2)
                            context = '\n'.join(lines[start:end])
                            
                            backlinks.append({
                                'path': relative_path,
                                'title': path.stem,
                                'context': context,
                                'line': i + 1
                            })
                            break
            except Exception as e:
                # Skip files that can't be read
                continue
        
        return backlinks
    
    async def get_daily_note(self, date: str = None) -> Dict:
        """Get or create daily note for a date (YYYY-MM-DD format)"""
        if date is None:
            date = datetime.now().strftime('%Y-%m-%d')
        
        # Validate date format
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            raise ValueError("Invalid date format. Use YYYY-MM-DD")
        
        daily_path = f'daily/{date}.md'
        full_path = self.vault_path / 'daily' / f'{date}.md'
        
        # Create if doesn't exist
        if not full_path.exists():
            content = f"""# Daily Note - {date}

## Tasks
- [ ] 

## Notes


## Journal


---
Created: {datetime.now().strftime('%Y-%m-%d %H:%M')}
"""
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content, encoding='utf-8')
        
        return await self.read_file(daily_path)
    
    async def extract_links(self, content: str) -> List[str]:
        """Extract all wikilinks from content"""
        # Pattern: [[link]] or [[link|alias]]
        pattern = r'\[\[([^\]|]+)(?:\|[^\]]+)?\]\]'
        matches = re.findall(pattern, content)
        return list(set(matches))
    
    async def extract_tags(self, content: str) -> List[str]:
        """Extract all tags from content"""
        # Pattern: #tag or #nested/tag
        pattern = r'#([a-zA-Z0-9_/-]+)'
        matches = re.findall(pattern, content)
        return list(set(matches))
    
    def _validate_path(self, path: str) -> Path:
        """Validate path and protect against path traversal"""
        try:
            full_path = safe_join(self.vault_path, path)
        except HTTPException as e:
            # Convert HTTPException from safe_join to ValueError for the service layer
            raise ValueError(e.detail)

        # Allow .gitkeep for folder creation
        if full_path.name == '.gitkeep':
            return full_path

        # Check file extension
        allowed_extensions = ('.md', '.canvas', '.json')
        if full_path.suffix.lower() not in allowed_extensions:
            raise ValueError(f"Only {', '.join(allowed_extensions)} files are allowed")
        
        # Prevent access to hidden files
        if any(part.startswith('.') for part in full_path.relative_to(self.vault_path.resolve()).parts):
            raise ValueError("Access to hidden files is denied")
        
        return full_path
    
    async def save_attachment(self, filename: str, content: bytes) -> Dict:
        """Save an attachment file"""
        # Validate filename using safe_join
        try:
            attachments_dir = self.vault_path / 'attachments'
            attachments_dir.mkdir(exist_ok=True)
            file_path = safe_join(attachments_dir, filename)
        except HTTPException as e:
            raise ValueError(e.detail)

        # Check file size
        if len(content) > settings.MAX_ATTACHMENT_SIZE:
            raise ValueError(f"File too large. Max size is {settings.MAX_ATTACHMENT_SIZE} bytes")
        
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)
        
        return {
            'path': f'attachments/{filename}',
            'url': f'/files/attachments/{filename}', # API endpoint, not fs path
            'size': len(content)
        }

