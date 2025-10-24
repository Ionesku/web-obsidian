from whoosh import index
from whoosh.fields import Schema, TEXT, ID, DATETIME, STORED
from whoosh.qparser import MultifieldParser, QueryParser
from whoosh.analysis import StemmingAnalyzer
from whoosh.query import Term, Or
from pathlib import Path
from datetime import datetime
import os

from app.config import settings


class SearchService:
    """Service for full-text search using Whoosh"""
    
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.index_path = Path(settings.INDEXES_ROOT) / f"user_{user_id}"
        self.vault_path = Path(settings.VAULTS_ROOT) / f"user_{user_id}"
        
        # Define search schema
        self.schema = Schema(
            path=ID(stored=True, unique=True),
            title=TEXT(stored=True, analyzer=StemmingAnalyzer()),
            content=TEXT(analyzer=StemmingAnalyzer()),
            tags=TEXT(stored=True),
            modified=STORED()
        )
        
        self._ensure_index()
    
    def _ensure_index(self):
        """Create or open the search index"""
        self.index_path.mkdir(parents=True, exist_ok=True)
        
        if not index.exists_in(str(self.index_path)):
            self.ix = index.create_in(str(self.index_path), self.schema)
        else:
            self.ix = index.open_dir(str(self.index_path))
    
    def reindex_all(self):
        """Rebuild the entire search index"""
        writer = self.ix.writer()
        
        # Clear existing index
        writer.mergetype = index.CLEAR
        
        # Index all markdown files
        if self.vault_path.exists():
            for md_path in self.vault_path.rglob('*.md'):
                try:
                    content = md_path.read_text(encoding='utf-8')
                    relative_path = str(md_path.relative_to(self.vault_path)).replace('\\', '/')
                    
                    # Extract metadata
                    title = self._extract_title(content, md_path.stem)
                    tags = self._extract_tags(content)
                    modified = md_path.stat().st_mtime
                    
                    writer.add_document(
                        path=relative_path,
                        title=title,
                        content=content,
                        tags=' '.join(tags),
                        modified=modified
                    )
                except Exception as e:
                    # Skip files that can't be indexed
                    print(f"Failed to index {md_path}: {e}")
                    continue
        
        writer.commit()
    
    def index_file(self, path: str, content: str):
        """Index or update a single file"""
        writer = self.ix.writer()
        
        try:
            title = self._extract_title(content, Path(path).stem)
            tags = self._extract_tags(content)
            modified = datetime.now().timestamp()
            
            # Update or add document
            writer.update_document(
                path=path,
                title=title,
                content=content,
                tags=' '.join(tags),
                modified=modified
            )
            
            writer.commit()
        except Exception as e:
            writer.cancel()
            raise e
    
    def remove_file(self, path: str):
        """Remove a file from the index"""
        writer = self.ix.writer()
        
        try:
            writer.delete_by_term('path', path)
            writer.commit()
        except Exception as e:
            writer.cancel()
            raise e
    
    def search(self, query: str, limit: int = 50) -> list:
        """Search the index"""
        results = []
        
        with self.ix.searcher() as searcher:
            # Parse query across multiple fields
            parser = MultifieldParser(['title', 'content', 'tags'], self.schema)
            
            try:
                q = parser.parse(query)
            except:
                # If parsing fails, do a simple term search
                q = Term('content', query)
            
            search_results = searcher.search(q, limit=limit)
            
            for hit in search_results:
                # Get file path
                file_path = self.vault_path / hit['path']
                
                # Get preview with context
                if file_path.exists():
                    try:
                        content = file_path.read_text(encoding='utf-8')
                        preview = self._get_preview(content, query)
                    except:
                        preview = ''
                else:
                    preview = ''
                
                results.append({
                    'path': hit['path'],
                    'title': hit['title'],
                    'preview': preview,
                    'score': hit.score
                })
        
        return results
    
    def search_by_tag(self, tag: str, limit: int = 50) -> list:
        """Search files by tag"""
        results = []
        
        with self.ix.searcher() as searcher:
            parser = QueryParser('tags', self.schema)
            q = parser.parse(tag)
            
            search_results = searcher.search(q, limit=limit)
            
            for hit in search_results:
                results.append({
                    'path': hit['path'],
                    'title': hit['title'],
                    'tags': hit['tags'].split() if hit['tags'] else []
                })
        
        return results
    
    def _extract_title(self, content: str, default: str) -> str:
        """Extract title from markdown content"""
        lines = content.split('\n')
        
        # Look for first heading in first few lines
        for line in lines[:10]:
            line = line.strip()
            if line.startswith('# '):
                return line[2:].strip()
            elif line.startswith('## '):
                return line[3:].strip()
        
        return default
    
    def _extract_tags(self, content: str) -> list:
        """Extract hashtags from content"""
        import re
        tags = re.findall(r'#([a-zA-Z0-9_/-]+)', content)
        return list(set(tags))
    
    def _get_preview(self, content: str, query: str, context_size: int = 200) -> str:
        """Generate preview with query context"""
        query_lower = query.lower()
        content_lower = content.lower()
        
        # Remove query operators for preview search
        clean_query = query_lower.replace('and', '').replace('or', '').replace('not', '').strip()
        words = clean_query.split()
        
        # Find first occurrence of any query word
        pos = -1
        for word in words:
            if len(word) > 2:  # Skip very short words
                pos = content_lower.find(word)
                if pos != -1:
                    break
        
        if pos == -1:
            # No match found, return beginning of content
            lines = content.split('\n')
            preview_lines = []
            char_count = 0
            
            for line in lines:
                if line.strip() and not line.strip().startswith('#'):
                    preview_lines.append(line)
                    char_count += len(line)
                    if char_count >= context_size:
                        break
            
            preview = ' '.join(preview_lines)
            if len(preview) > context_size:
                preview = preview[:context_size] + '...'
            return preview or content[:context_size] + '...'
        
        # Extract context around match
        start = max(0, pos - context_size // 2)
        end = min(len(content), pos + context_size // 2)
        
        preview = content[start:end]
        
        # Add ellipsis
        if start > 0:
            preview = '...' + preview
        if end < len(content):
            preview = preview + '...'
        
        return preview.strip()
    
    def get_stats(self) -> dict:
        """Get index statistics"""
        with self.ix.searcher() as searcher:
            return {
                'total_documents': searcher.doc_count_all(),
                'index_size': self._get_index_size()
            }
    
    def _get_index_size(self) -> int:
        """Calculate index size in bytes"""
        total_size = 0
        for file in self.index_path.glob('*'):
            if file.is_file():
                total_size += file.stat().st_size
        return total_size

