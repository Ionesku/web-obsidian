import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import { useVaultStore, type FileInfo } from '../stores/vault'; // Import FileInfo
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

// Helpers for recent files
const RECENT_FILES_KEY = 'recent_files';
const MAX_RECENT_FILES = 6;

const getRecentFiles = (): string[] => {
  try {
    const saved = localStorage.getItem(RECENT_FILES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Failed to get recent files', e);
    return [];
  }
};

const addRecentFile = (path: string) => {
  try {
    const recents = getRecentFiles();
    const updated = [path, ...recents.filter(p => p !== path)].slice(0, MAX_RECENT_FILES);
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to add recent file', e);
  }
};

interface QuickSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  onCreate: (name: string) => void;
}

const QuickSwitcher: React.FC<QuickSwitcherProps> = ({ isOpen, onClose, onSelect, onCreate }) => {
  const [query, setQuery] = useState('');
  const { files: allFiles } = useVaultStore(); // Get files from the store
  const [results, setResults] = useState<FileInfo[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter markdown files from the store
  const files = useMemo(() => 
    allFiles.filter(f => f.type === 'file' && f.name.endsWith('.md')),
    [allFiles]
  );

  // Fuse.js fuzzy search instance
  const fuse = useMemo(() => new Fuse(files, {
    keys: ['name', 'path'],
    includeScore: true,
    threshold: 0.4, // Adjust for more/less fuzzy matching
  }), [files]);

  // Handle search and display results
  useEffect(() => {
    if (!query) {
      // Show recent files if query is empty
      const recentPaths = getRecentFiles();
      const recentFileObjects = recentPaths
        .map(path => files.find(f => f.path === path))
        .filter((f): f is FileInfo => !!f);
      setResults(recentFileObjects);
    } else {
      const searchResults = fuse.search(query).map(result => result.item);
      setResults(searchResults);
    }
    setActiveIndex(0); // Reset selection on new results
  }, [query, files, fuse]);


  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[activeIndex]) {
        handleSelect(results[activeIndex].path);
      } else if (query.trim()) {
        onCreate(query);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelect = (path: string) => {
    addRecentFile(path);
    onSelect(path);
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
        // Reset query on open
        setQuery('');
        // Focus input when dialog opens
        setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Find or create a note...</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input
            ref={inputRef}
            placeholder="Type to search files..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-[400px] overflow-y-auto">
            {results.map((file, index) => (
              <div
                key={file.path}
                onClick={() => handleSelect(file.path)}
                className={`p-2 rounded cursor-pointer ${
                  index === activeIndex ? 'bg-gray-200 dark:bg-gray-700' : ''
                }`}
              >
                <p className="font-semibold">{file.name.replace(/\.md$/, '')}</p>
                <p className="text-sm text-gray-500">{file.path}</p>
              </div>
            ))}
            {results.length === 0 && (
                <div className="p-4 text-center text-gray-500">
                    {query ? 'No matching files found.' : 'No recent files.'}
                </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickSwitcher;
