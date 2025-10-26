"""
Markdown Parser for extracting metadata from markdown files
"""
import re
import yaml
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class MarkdownParser:
    """Parser for extracting metadata from markdown files"""
    
    def __init__(self):
        # Regex patterns
        self.frontmatter_pattern = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.DOTALL | re.MULTILINE)
        self.tag_pattern = re.compile(r'#([a-zA-Z0-9_/\-]+)', re.MULTILINE)
        self.wikilink_pattern = re.compile(r'\[\[([^\]|]+)(?:\|[^\]]+)?\]\]')
        self.heading_pattern = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)
        self.task_pattern = re.compile(r'^\s*[-*]\s+\[([x\s])\]\s+(.+)$', re.MULTILINE)
        self.block_id_pattern = re.compile(r'\^([a-zA-Z0-9\-]+)\s*$', re.MULTILINE)
    
    def parse(self, content: str) -> Dict[str, Any]:
        """
        Parse markdown content and extract metadata
        
        Args:
            content: Markdown file content
            
        Returns:
            Dictionary with extracted metadata:
            - tags: List of tags (without #)
            - props: Dict of frontmatter properties
            - headings: List of headings
            - links: List of internal links
            - tasks: List of tasks with done status
            - blocks: List of block IDs
        """
        metadata = {
            'tags': [],
            'props': {},
            'headings': [],
            'links': [],
            'tasks': [],
            'blocks': [],
        }
        
        try:
            # Extract frontmatter
            metadata['props'] = self.extract_frontmatter(content)
            
            # Extract tags
            metadata['tags'] = self.extract_tags(content)
            
            # Extract headings
            metadata['headings'] = self.extract_headings(content)
            
            # Extract links
            metadata['links'] = self.extract_links(content)
            
            # Extract tasks
            metadata['tasks'] = self.extract_tasks(content)
            
            # Extract block IDs
            metadata['blocks'] = self.extract_blocks(content)
            
        except Exception as e:
            logger.error(f"Error parsing markdown: {e}")
        
        return metadata
    
    def extract_frontmatter(self, content: str) -> Dict[str, Any]:
        """Extract YAML frontmatter from markdown"""
        match = self.frontmatter_pattern.match(content)
        if not match:
            return {}
        
        try:
            yaml_str = match.group(1)
            props = yaml.safe_load(yaml_str)
            if not isinstance(props, dict):
                return {}
            
            # Convert dates to strings for JSON serialization
            for key, value in props.items():
                if isinstance(value, datetime):
                    props[key] = value.isoformat()
            
            return props
        except yaml.YAMLError as e:
            logger.warning(f"Failed to parse frontmatter YAML: {e}")
            return {}
    
    def extract_tags(self, content: str) -> List[str]:
        """Extract hashtags from content"""
        # Remove frontmatter to avoid extracting from YAML
        content_without_frontmatter = self.frontmatter_pattern.sub('', content)
        
        # Find all tags
        tags = self.tag_pattern.findall(content_without_frontmatter)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_tags = []
        for tag in tags:
            tag_lower = tag.lower()
            if tag_lower not in seen:
                seen.add(tag_lower)
                unique_tags.append(tag)
        
        return unique_tags
    
    def extract_headings(self, content: str) -> List[Dict[str, Any]]:
        """Extract headings from markdown"""
        headings = []
        
        for match in self.heading_pattern.finditer(content):
            level = len(match.group(1))
            text = match.group(2).strip()
            
            # Remove formatting from heading text
            text = re.sub(r'\*{1,2}([^\*]+)\*{1,2}', r'\1', text)  # Remove bold/italic
            text = re.sub(r'`([^`]+)`', r'\1', text)  # Remove code
            text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)  # Remove links
            
            headings.append({
                'level': level,
                'text': text,
                'line': content[:match.start()].count('\n') + 1
            })
        
        return headings
    
    def extract_links(self, content: str) -> List[str]:
        """Extract wiki-style links from content"""
        links = []
        
        for match in self.wikilink_pattern.finditer(content):
            target = match.group(1).strip()
            
            # Handle relative paths
            if not target.endswith('.md'):
                target += '.md'
            
            links.append(target)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_links = []
        for link in links:
            if link not in seen:
                seen.add(link)
                unique_links.append(link)
        
        return unique_links
    
    def extract_tasks(self, content: str) -> List[Dict[str, Any]]:
        """Extract tasks from markdown"""
        tasks = []
        
        for match in self.task_pattern.finditer(content):
            done = match.group(1).lower() == 'x'
            text = match.group(2).strip()
            line = content[:match.start()].count('\n') + 1
            
            tasks.append({
                'done': done,
                'text': text,
                'line': line
            })
        
        return tasks
    
    def extract_blocks(self, content: str) -> List[str]:
        """Extract block IDs from content"""
        blocks = []
        
        for match in self.block_id_pattern.finditer(content):
            block_id = match.group(1)
            blocks.append(block_id)
        
        return list(set(blocks))  # Remove duplicates
    
    def extract_for_indexing(self, content: str, path: str) -> Dict[str, Any]:
        """
        Extract metadata specifically for search indexing
        
        Args:
            content: Markdown content
            path: File path
            
        Returns:
            Dictionary with:
            - tags: List of tags for Whoosh
            - props: Dict of properties for Whoosh
            - name: File name
        """
        metadata = self.parse(content)
        
        # Extract file name from path
        name = path.split('/')[-1] if '/' in path else path
        
        # Format properties for Whoosh (key=value format)
        props_dict = metadata.get('props', {})
        
        return {
            'name': name,
            'tags': metadata.get('tags', []),
            'props': props_dict,
        }


# Singleton instance
_parser: Optional[MarkdownParser] = None


def get_parser() -> MarkdownParser:
    """Get or create singleton parser instance"""
    global _parser
    if _parser is None:
        _parser = MarkdownParser()
    return _parser


def extract_metadata_for_index(content: str, path: str) -> Dict[str, Any]:
    """
    Convenience function to extract metadata for indexing
    
    Args:
        content: Markdown content
        path: File path
        
    Returns:
        Dictionary with tags, props, and name
    """
    parser = get_parser()
    return parser.extract_for_indexing(content, path)
