#!/usr/bin/env python3
"""
Reindex all markdown files in the vault
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.config import settings
from app.vault_service import VaultService
from app.search.indexer import get_indexer
from app.search.markdown_parser import extract_metadata_for_index

async def reindex_all():
    """Reindex all markdown files for all users"""
    print("Starting reindexing...")
    print("=" * 50)
    
    # Get indexer
    indexer = get_indexer()
    print(f"Index directory: {settings.WHOOSH_INDEX_DIR}")
    
    # Get all user directories
    vaults_root = Path(settings.VAULTS_ROOT)
    if not vaults_root.exists():
        print(f"Vaults directory not found: {vaults_root}")
        return
    
    total_indexed = 0
    
    # Process each user's vault
    for user_dir in vaults_root.glob("user_*"):
        if not user_dir.is_dir():
            continue
            
        # Extract user ID from directory name
        try:
            user_id = int(user_dir.name.split("_")[1])
        except (IndexError, ValueError):
            print(f"Skipping invalid user directory: {user_dir.name}")
            continue
        
        print(f"\nProcessing user {user_id}...")
        
        # Get vault service for this user
        vault = VaultService(user_id)
        
        # List all files
        try:
            files = await vault.list_files()
            
            for file_info in files:
                if not file_info.path.endswith('.md'):
                    continue
                
                try:
                    # Read file content
                    file_data = await vault.read_file(file_info.path)
                    content = file_data.get('content', '')
                    
                    # Extract metadata
                    metadata = extract_metadata_for_index(content, file_info.path)
                    
                    # Index the document
                    success = indexer.upsert_document(
                        path=file_info.path,
                        content=content,
                        name=metadata['name'],
                        tags=metadata['tags'],
                        props=metadata['props']
                    )
                    
                    if success:
                        total_indexed += 1
                        print(f"  ✅ Indexed: {file_info.path}")
                    else:
                        print(f"  ❌ Failed to index: {file_info.path}")
                        
                except Exception as e:
                    print(f"  ❌ Error processing {file_info.path}: {e}")
                    
        except Exception as e:
            print(f"  ❌ Error listing files for user {user_id}: {e}")
    
    print("\n" + "=" * 50)
    print(f"✅ Reindexing complete! Indexed {total_indexed} files.")
    
    # Verify index
    with indexer.ix.searcher() as searcher:
        doc_count = searcher.doc_count()
        print(f"Total documents in index: {doc_count}")

if __name__ == "__main__":
    asyncio.run(reindex_all())
