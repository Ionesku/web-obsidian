"""
Whoosh Indexer - Incremental indexing for markdown files
"""
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from whoosh import index
from whoosh.writing import AsyncWriter
import hashlib
import os

from .whoosh_schema import get_index
from ..config import settings

logger = logging.getLogger(__name__)


class MarkdownIndexer:
    """Manages indexing of markdown files"""
    
    def __init__(self, index_dir: str = None):
        self.index_dir = index_dir or settings.WHOOSH_INDEX_DIR
        self._index = None
    
    @property
    def ix(self) -> index.Index:
        """Lazy load index"""
        if self._index is None:
            self._index = get_index(self.index_dir)
        return self._index
    
    def upsert_document(
        self,
        path: str,
        content: str,
        name: str,
        tags: List[str],
        props: Dict[str, Any],
        mtime: Optional[datetime] = None,
    ) -> bool:
        """
        Insert or update a document in the index
        
        Args:
            path: File path (unique ID)
            content: Markdown content
            name: File name
            tags: List of tags
            props: Dictionary of frontmatter properties
            mtime: Modification time
            
        Returns:
            True if successful
        """
        try:
            # Format tags and props as comma-separated strings
            tags_str = ",".join(tags) if tags else ""
            props_str = ",".join(
                f"{k}={v}" for k, v in props.items() if v is not None
            )
            
            # Use AsyncWriter for better performance
            writer = AsyncWriter(self.ix)
            
            # Update or add document
            writer.update_document(
                path=path,
                name=name,
                tags=tags_str,
                props=props_str,
                content=content,
                tri=content,  # Whoosh will automatically generate trigrams
                mtime=mtime or datetime.now(),
                size=len(content),
            )
            
            writer.commit()
            logger.info(f"Indexed: {path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to index {path}: {e}")
            return False
    
    def delete_document(self, path: str) -> bool:
        """
        Delete a document from the index
        
        Args:
            path: File path to delete
            
        Returns:
            True if successful
        """
        try:
            writer = self.ix.writer()
            writer.delete_by_term("path", path)
            writer.commit()
            logger.info(f"Deleted from index: {path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete {path}: {e}")
            return False
    
    def batch_upsert(self, documents: List[Dict[str, Any]]) -> int:
        """
        Batch insert/update documents
        
        Args:
            documents: List of document dicts with keys:
                - path, content, name, tags, props, mtime
                
        Returns:
            Number of successfully indexed documents
        """
        count = 0
        writer = None
        
        try:
            writer = AsyncWriter(self.ix)
            
            for doc in documents:
                try:
                    tags_str = ",".join(doc.get("tags", []))
                    props_str = ",".join(
                        f"{k}={v}" 
                        for k, v in doc.get("props", {}).items() 
                        if v is not None
                    )
                    
                    writer.update_document(
                        path=doc["path"],
                        name=doc["name"],
                        tags=tags_str,
                        props=props_str,
                        content=doc["content"],
                        tri=doc["content"],
                        mtime=doc.get("mtime", datetime.now()),
                        size=len(doc["content"]),
                    )
                    count += 1
                    
                except Exception as e:
                    logger.error(f"Failed to index {doc.get('path', 'unknown')}: {e}")
            
            if writer:
                writer.commit()
                logger.info(f"Batch indexed {count} documents")
            
        except Exception as e:
            logger.error(f"Batch indexing failed: {e}")
            if writer:
                writer.cancel()
        
        return count
    
    def clear_index(self) -> bool:
        """
        Clear entire index (for reindexing)
        
        Returns:
            True if successful
        """
        try:
            writer = self.ix.writer()
            # Delete all documents
            writer.mergetype = index.CLEAR
            writer.commit()
            logger.info("Index cleared")
            return True
            
        except Exception as e:
            logger.error(f"Failed to clear index: {e}")
            return False
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get index statistics
        
        Returns:
            Dictionary with stats
        """
        try:
            with self.ix.searcher() as searcher:
                return {
                    "doc_count": searcher.doc_count_all(),
                    "version": self.ix.latest_generation(),
                    "index_dir": self.index_dir,
                }
        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            return {"error": str(e)}
    
    def get_detailed_stats(self) -> Dict[str, Any]:
        """Get more detailed index statistics including size and segments."""
        stats = self.get_stats()
        try:
            # Calculate index size
            total_size = 0
            for dirpath, _, filenames in os.walk(self.index_dir):
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    if not os.path.islink(fp):
                        total_size += os.path.getsize(fp)
            stats['index_size_mb'] = total_size / (1024 * 1024)
            
            # Get number of segments
            stats['segments'] = len(self.ix._segments())
        except Exception as e:
            logger.error(f"Failed to get detailed stats: {e}")
            stats['detailed_error'] = str(e)
            
        return stats

    def optimize(self) -> bool:
        """
        Optimize index (merge segments)
        
        Returns:
            True if successful
        """
        try:
            writer = self.ix.writer()
            writer.commit(optimize=True)
            logger.info("Index optimized")
            return True
            
        except Exception as e:
            logger.error(f"Failed to optimize index: {e}")
            return False


# Singleton instance
_indexer: Optional[MarkdownIndexer] = None


def get_indexer(index_dir: str = None) -> MarkdownIndexer:
    """Get or create singleton indexer instance"""
    global _indexer
    if _indexer is None:
        _indexer = MarkdownIndexer(index_dir or settings.WHOOSH_INDEX_DIR)
    return _indexer

