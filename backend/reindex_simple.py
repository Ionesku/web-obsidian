#!/usr/bin/env python3
"""
Simple reindex script without FastAPI dependencies
"""
import sys
import os
from pathlib import Path
import asyncio
import aiofiles

# Fix paths
sys.path.insert(0, str(Path(__file__).parent))

async def reindex_all():
    """Reindex all markdown files"""
    print("Starting simple reindexing...")
    print("=" * 50)
    
    # Import Whoosh directly
    from whoosh import index
    from whoosh.fields import Schema, ID, TEXT, KEYWORD, NGRAM, DATETIME, NUMERIC
    from whoosh.analysis import StemmingAnalyzer, StandardAnalyzer
    from datetime import datetime
    
    # Define schema
    schema = Schema(
        path=ID(stored=True, unique=True),
        name=TEXT(analyzer=StandardAnalyzer(), stored=True, field_boost=2.0),
        tags=KEYWORD(lowercase=True, commas=True, scorable=True, stored=True),
        props=KEYWORD(lowercase=True, commas=True, stored=True),
        content=TEXT(analyzer=StemmingAnalyzer(), phrase=True, stored=False),
        tri=NGRAM(minsize=3, maxsize=3, stored=False),
        mtime=DATETIME(stored=True),
        size=NUMERIC(stored=True),
    )
    
    # Create or open index
    index_dir = Path("data/whoosh")
    index_dir.mkdir(parents=True, exist_ok=True)
    
    if index.exists_in(str(index_dir)):
        print(f"Opening existing index at: {index_dir}")
        ix = index.open_dir(str(index_dir))
    else:
        print(f"Creating new index at: {index_dir}")
        ix = index.create_in(str(index_dir), schema)
    
    # Get all markdown files
    vaults_dir = Path("../data/vaults")
    if not vaults_dir.exists():
        print(f"Vaults directory not found: {vaults_dir}")
        print(f"Current directory: {Path.cwd()}")
        return
    
    total_indexed = 0
    writer = ix.writer()
    
    # Find all .md files
    for md_file in vaults_dir.rglob("*.md"):
        relative_path = md_file.relative_to(vaults_dir)
        
        # Extract user_id and file path
        parts = relative_path.parts
        if len(parts) < 2 or not parts[0].startswith("user_"):
            continue
        
        # Get file path relative to user vault
        file_path = "/".join(parts[1:])
        
        print(f"  Processing: {file_path}")
        
        try:
            # Read file content
            async with aiofiles.open(md_file, 'r', encoding='utf-8') as f:
                content = await f.read()
            
            # Basic metadata extraction
            tags = []
            props = {}
            
            # Extract tags (simple regex)
            import re
            tag_pattern = re.compile(r'#([a-zA-Z0-9_\-/]+)')
            tags = tag_pattern.findall(content)
            
            # Extract frontmatter if present
            if content.startswith('---'):
                lines = content.split('\n')
                end_index = -1
                for i in range(1, len(lines)):
                    if lines[i].strip() == '---':
                        end_index = i
                        break
                
                if end_index > 0:
                    # Parse YAML frontmatter (simple approach)
                    for line in lines[1:end_index]:
                        if ':' in line:
                            key, value = line.split(':', 1)
                            props[key.strip()] = value.strip()
            
            # Format for Whoosh
            tags_str = ",".join(tags) if tags else ""
            props_str = ",".join(f"{k}={v}" for k, v in props.items())
            
            # Update document in index
            writer.update_document(
                path=file_path,
                name=md_file.name,
                tags=tags_str,
                props=props_str,
                content=content,
                tri=content,  # Whoosh will generate trigrams
                mtime=datetime.fromtimestamp(md_file.stat().st_mtime),
                size=len(content),
            )
            
            total_indexed += 1
            print(f"    [OK] Indexed")
            
        except Exception as e:
            print(f"    [ERROR] {e}")
    
    # Commit changes
    writer.commit()
    
    print("\n" + "=" * 50)
    print(f"[SUCCESS] Reindexing complete! Indexed {total_indexed} files.")
    
    # Verify index
    with ix.searcher() as searcher:
        doc_count = searcher.doc_count()
        print(f"Total documents in index: {doc_count}")

if __name__ == "__main__":
    asyncio.run(reindex_all())
