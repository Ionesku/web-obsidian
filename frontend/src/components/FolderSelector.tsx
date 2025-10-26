import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useVaultStore } from '@/stores/vault';
import { Folder } from 'lucide-react';

interface FolderSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  title: string;
}

const FolderSelector: React.FC<FolderSelectorProps> = ({ isOpen, onClose, onSelect, title }) => {
  const [query, setQuery] = useState('');
  const { files } = useVaultStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const folders = useMemo(() => {
    const folderPaths = new Set<string>();
    files.forEach(file => {
      const parts = file.path.split('/');
      parts.pop(); // remove filename
      let currentPath = '';
      parts.forEach(part => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        folderPaths.add(currentPath);
      });
    });
    return Array.from(folderPaths).sort();
  }, [files]);

  const filteredFolders = useMemo(() => {
    if (!query) return folders;
    return folders.filter(folder => folder.toLowerCase().includes(query.toLowerCase()));
  }, [query, folders]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div 
        className="bg-white dark:bg-card border dark:border-border rounded-lg shadow-lg w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search folders..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full mt-2 p-2 border rounded"
          />
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {filteredFolders.map(folder => (
            <button
              key={folder}
              onClick={() => onSelect(folder)}
              className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-slate-100 dark:hover:bg-black/20 flex items-center gap-2"
            >
              <Folder className="w-4 h-4" />
              <span>{folder}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FolderSelector;
