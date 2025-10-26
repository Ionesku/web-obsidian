import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useVaultStore } from '@/stores/vault';
import { useSearchStore } from '@/stores/search';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarkdownEditor } from '@/components/markdown-editor';
import { SaveStatusIndicator } from '@/components/SaveStatusIndicator';
import { Search } from '@/components/Search';
import QuickSwitcher from '@/components/QuickSwitcher'; // Import the new component
import { ThemeToggle } from '@/components/ThemeToggle';
import { searchEngine } from '@/search';
import { federatedSearch } from '@/search/parser/federation';
import type { AutosaveStatus } from '@/lib/codemirror/types';
import type { SearchResult } from '@/search/types';
import {
  File,
  Folder,
  FilePlus,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Calendar,
  Search as SearchIcon,
  Command,
  FileText,
  Grid3x3,
  X,
  BookMarked,
  ChevronsUpDown,
  LogOut,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
  PanelRight,
  ChevronRight as PanelRightIcon,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Move,
  Star
} from 'lucide-react';
import api from '@/lib/api';
import FolderSelector from '@/components/FolderSelector';
import AddBookmarkDialog from '@/components/AddBookmarkDialog';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  modified?: string;
}

interface Tab {
  path: string;
  title: string;
}

export function VaultPage() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuthStore();
  const { files, currentNote, loadFiles, loadNote, saveNote, createNote, isLoading } = useVaultStore();
  const { query, result, setQuery, reset } = useSearchStore();
  
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [localSearchInput, setLocalSearchInput] = useState(''); // For Ctrl+F local search
  const [showLocalSearch, setShowLocalSearch] = useState(false); // For Ctrl+F overlay
  const [showSearchSidebar, setShowSearchSidebar] = useState(false); // For dedicated search sidebar
  const [showFilesSidebar, setShowFilesSidebar] = useState(true); // For files sidebar
  const [showBookmarksSidebar, setShowBookmarksSidebar] = useState(false);
  const [syncQueueSize, setSyncQueueSize] = useState(0); // Sync queue status
  const [localSearchState, setLocalSearchState] = useState({ query: '', matchCount: 0, currentMatch: 0 });
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>(''); // Query to pass to editor from global search
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const saved = localStorage.getItem('vault_tabs');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState<string | null>(() => {
    return localStorage.getItem('vault_active_tab');
  });
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [vimMode, setVimMode] = useState(false);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [expandedBookmarkGroups, setExpandedBookmarkGroups] = useState<Set<string>>(new Set());
  // THIS IS THE ONLY STATE WE NEED FOR THE SIDEBAR VISIBILITY
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isResizing, setIsResizing] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>({
    status: 'idle',
    lastSaved: null,
    error: null,
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; type: 'file' | 'folder'; } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [movingPath, setMovingPath] = useState<string | null>(null);
  const [copyingPath, setCopyingPath] = useState<string | null>(null);
  const [bookmarkingPath, setBookmarkingPath] = useState<string | null>(null);
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  const localSearchInputRef = useRef<HTMLInputElement>(null);
  const globalSearchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Use e.code for keyboard layout-independent shortcuts
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          // Global search (Ctrl/Cmd + Shift + F)
          setShowSearchSidebar(true);
          setShowFilesSidebar(false);
          setShowBookmarksSidebar(false);
          if (!isSidebarOpen) setIsSidebarOpen(true);
        } else {
          // Local search (Ctrl/Cmd + F)
          setShowLocalSearch(true);
          // Focus will be handled by the useEffect below
        }
      }
      // Quick switcher (Ctrl/Cmd + K or Ctrl/Cmd + P)
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyK' || e.code === 'KeyP')) {
        e.preventDefault();
        e.stopPropagation();
        setShowQuickSwitcher(true);
      }
      // Escape key
      if (e.key === 'Escape') {
        if (showLocalSearch) setShowLocalSearch(false);
        if (showQuickSwitcher) setShowQuickSwitcher(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [showLocalSearch, showQuickSwitcher, showSearchSidebar, showFilesSidebar, isSidebarOpen]);

  // Focus local search input
  useEffect(() => {
    if (showLocalSearch) {
      localSearchInputRef.current?.focus();
    }
  }, [showLocalSearch]);

  // Focus global search input
  useEffect(() => {
    if (showSearchSidebar && isSidebarOpen) {
      setTimeout(() => globalSearchInputRef.current?.focus(), 100);
    }
  }, [showSearchSidebar, isSidebarOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu]);

  useEffect(() => {
    if (showBookmarksSidebar) {
      loadBookmarks();
    }
  }, [showBookmarksSidebar]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadFiles();
  }, [isAuthenticated, navigate, loadFiles]);

  // Monitor sync queue status
  useEffect(() => {
    const updateSyncStatus = () => {
      const size = searchEngine.getSyncQueueSize();
      setSyncQueueSize(size);
    };
    
    // Update immediately
    updateSyncStatus();
    
    // Update every second
    const interval = setInterval(updateSyncStatus, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Auto-load active tab after page refresh
  useEffect(() => {
    if (activeTab && !currentNote && files.length > 0) {
      // Check if the file still exists
      const fileExists = files.find(f => f.path === activeTab);
      if (fileExists) {
        console.log('🔄 Restoring active tab:', activeTab);
        loadNote(activeTab);
        setSelectedPath(activeTab);
      } else {
        // File doesn't exist anymore, clear active tab
        setActiveTab(null);
        localStorage.removeItem('vault_active_tab');
      }
    }
  }, [activeTab, currentNote, files, loadNote]);

  // Save tabs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('vault_tabs', JSON.stringify(tabs));
  }, [tabs]);

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('vault_active_tab', activeTab);
    } else {
      localStorage.removeItem('vault_active_tab');
    }
  }, [activeTab]);

  // Resize handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX - 48; // 48px = left icon panel width
      if (newWidth >= 200 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Build file tree from flat file list
  const buildFileTree = (items: FileNode[]): FileNode[] => {
    const tree: FileNode[] = [];
    const nodes: { [path: string]: FileNode } = {};

    // First pass: create all nodes and store them in a map
    items.forEach(item => {
        nodes[item.path] = {
            ...item,
            children: [],
        };
    });

    // Second pass: build the tree structure
    Object.values(nodes).forEach(node => {
        const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
        
        if (parentPath && nodes[parentPath]) {
            nodes[parentPath].children?.push(node);
        } else {
            tree.push(node);
        }
    });

    // Sort children alphabetically, folders first
    const sortNodes = (nodesToSort: FileNode[]) => {
        nodesToSort.sort((a, b) => {
            if (a.type === 'folder' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        });
        nodesToSort.forEach(node => {
            if (node.children) {
                sortNodes(node.children);
            }
        });
    };
    
    sortNodes(tree);

    return tree;
  };

  // Memoize file tree generation
  const fileTree = buildFileTree(files);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const toggleAllFolders = () => {
    if (allExpanded) {
      setExpandedFolders(new Set());
      setAllExpanded(false);
    } else {
      const allFolderPaths = new Set<string>();
      const collectFolders = (nodes: FileNode[]) => {
        nodes.forEach((node) => {
          if (node.type === 'folder') {
            allFolderPaths.add(node.path);
            if (node.children) collectFolders(node.children);
          }
        });
      };
      collectFolders(fileTree);
      setExpandedFolders(allFolderPaths);
      setAllExpanded(true);
    }
  };

  const handleSelectNote = useCallback(async (path: string, searchQueryToHighlight?: string) => {
    setSelectedPath(path);
    setActiveTab(path);
    await loadNote(path);
    if (!tabs.some(tab => tab.path === path)) {
      const fileName = path.split('/').pop() || path;
      setTabs(t => [...t, { path, title: fileName }]);
    }
    
    // If called from search, pass query to editor for highlighting
    if (searchQueryToHighlight) {
      setGlobalSearchQuery(searchQueryToHighlight);
      setLocalSearchInput(searchQueryToHighlight);
    } else {
      // Clear search when opening normally
      setGlobalSearchQuery('');
      setLocalSearchInput('');
    }
  }, [loadNote, tabs]);

  const closeTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = tabs.filter((tab) => tab.path !== path);
    setTabs(newTabs);
    
    if (activeTab === path) {
      if (newTabs.length > 0) {
        const newActiveTab = newTabs[newTabs.length - 1];
        setActiveTab(newActiveTab.path);
        handleSelectNote(newActiveTab.path);
      } else {
        setActiveTab(null);
        setSelectedPath(null);
      }
    }
  };

  const handleSave = useCallback(async (content: string) => {
    if (selectedPath) {
      try {
      await saveNote(selectedPath, content);
        console.log('Note saved successfully');
      } catch (error) {
        console.error('Failed to save note:', error);
      }
    }
  }, [selectedPath, saveNote]);

  const handleContentChange = useCallback((content: string) => {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const chars = content.length;
    setWordCount(words);
    setCharCount(chars);
  }, []);

  const handleSearch = async (value: string) => {
    setSearchInput(value);
    if (value.trim()) {
      setIsSearching(true);
      try {
        // Check if it's a tag search
        const tagMatch = value.match(/^tag:(#?)(.+)$/);
        if (tagMatch) {
          const tag = tagMatch[2]; // Extract tag without #
          const searchResult = await federatedSearch(`tag:${tag}`, { limit: 50 });
          setSearchResults(searchResult);
          setQuery(`tag:${tag}`);
        } else {
          const searchResult = await federatedSearch(value, { limit: 50 });
          setSearchResults(searchResult);
          setQuery(value);
        }
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults(null);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults(null);
      reset();
    }
  };

  const handleCreateNote = async () => {
    if (!newNoteName.trim()) return;
    
    const path = newNoteName.endsWith('.md') 
      ? `${newNoteName}` 
      : `${newNoteName}.md`;
    
    const initialContent = `# ${newNoteName.replace('.md', '')}\n\n`;
    
    try {
      await createNote(path, initialContent);
      setShowNewNoteDialog(false);
      setNewNoteName('');
      await loadFiles();
      await handleSelectNote(path);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    // Create a .gitkeep file in the folder
    const path = `${newFolderName}/.gitkeep`;
    
    try {
      await createNote(path, '');
      setShowNewFolderDialog(false);
      setNewFolderName('');
      await loadFiles();
      setExpandedFolders((prev) => new Set(prev).add(newFolderName));
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  const handleCreateFromSwitcher = async (name: string) => {
    const path = name.endsWith('.md')
      ? `notes/${name}`
      : `notes/${name}.md`;

    const initialContent = `# ${name.replace('.md', '')}\n\n`;

    try {
      // Check if file already exists to avoid errors
      const fileExists = files.find(f => f.path === path);
      if (fileExists) {
        // If it exists, just open it
        await handleSelectNote(path);
        return;
      }
      
      await createNote(path, initialContent);
      await loadFiles(); // To refresh file list
      await handleSelectNote(path); // To open the new note
    } catch (error) {
      console.error('Failed to create note from switcher:', error);
    }
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleDailyNote = async () => {
    const today = new Date().toISOString().split('T')[0];
    const path = `daily/${today}.md`;
    
    // Check if daily note already exists
    const exists = files.find(f => f.path === path);
    if (!exists) {
      const initialContent = `# ${today}\n\n`;
      await createNote(path, initialContent);
      await loadFiles();
    }
    
    await handleSelectNote(path);
  };

  const handleWikiLinkClick = (noteTitle: string) => {
    // Find file by title (name without extension)
    const file = files.find((f) => {
      const fileName = f.path.split('/').pop()?.replace(/\.md$/, '');
      return fileName === noteTitle;
    });
    
    if (file) {
      handleSelectNote(file.path);
    } else {
      // If file doesn't exist, prompt to create it
      const shouldCreate = window.confirm(`Note "${noteTitle}" doesn't exist. Create it?`);
      if (shouldCreate) {
        const path = `notes/${noteTitle}.md`;
        const initialContent = `# ${noteTitle}\n\n`;
        createNote(path, initialContent).then(() => {
          loadFiles().then(() => {
            handleSelectNote(path);
          });
        });
      }
    }
  };

  const handleTagClick = useCallback((tag: string) => {
    const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
    setQuery(`tag:${cleanTag}`);
    setShowSearchSidebar(true);
    setShowFilesSidebar(false);
  }, [setQuery]);

  // Local search within current file (Ctrl+F)
  const handleLocalSearch = (value: string) => {
    setLocalSearchInput(value);
    setGlobalSearchQuery(value);
  };

  const handleContextMenu = (e: React.MouseEvent, path: string, type: 'file' | 'folder') => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, path, type });
  };

  const handleDelete = async (path: string) => {
    if (window.confirm(`Are you sure you want to delete ${path}?`)) {
      try {
        await api.deleteFile(path);
        await loadFiles();
        // Close tab if open
        if (tabs.some(tab => tab.path === path)) {
          closeTab(path, new MouseEvent('click'));
        }
      } catch (error) {
        console.error('Failed to delete file:', error);
        alert(`Error: ${error.message}`);
      }
    }
  };

  const handleRename = async () => {
    if (!renamingPath || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }

    const oldPath = renamingPath;
    const newPath = oldPath.substring(0, oldPath.lastIndexOf('/') + 1) + renameValue + (oldPath.endsWith('.md') ? '.md' : '');

    if (oldPath === newPath) {
      setRenamingPath(null);
      return;
    }

    try {
      await api.renameFile(oldPath, newPath);
      await loadFiles();
      // Update tab if open
      const tab = tabs.find(t => t.path === oldPath);
      if (tab) {
        const newTabs = tabs.map(t => t.path === oldPath ? { ...t, path: newPath, title: renameValue } : t);
        setTabs(newTabs);
        if (activeTab === oldPath) {
          setActiveTab(newPath);
        }
      }
    } catch (error) {
      console.error('Failed to rename file:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setRenamingPath(null);
    }
  };

  const handleMove = async (destinationFolder: string) => {
    if (!movingPath) return;

    const fileName = movingPath.split('/').pop();
    const newPath = `${destinationFolder}/${fileName}`;

    if (movingPath === newPath) {
      setMovingPath(null);
      return;
    }

    try {
      await api.renameFile(movingPath, newPath); // rename is used for moving
      await loadFiles();
      // Update tab if open
      const tab = tabs.find(t => t.path === movingPath);
      if (tab) {
        const newTabs = tabs.map(t => t.path === movingPath ? { ...t, path: newPath } : t);
        setTabs(newTabs);
        if (activeTab === movingPath) {
          setActiveTab(newPath);
        }
      }
    } catch (error) {
      console.error('Failed to move file:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setMovingPath(null);
    }
  };

  const handleCopy = async (destinationFolder: string) => {
    if (!copyingPath) return;

    const fileName = copyingPath.split('/').pop();
    let newPath = `${destinationFolder}/${fileName}`;

    // Handle name conflicts by adding a number
    let counter = 1;
    while (files.some(f => f.path === newPath)) {
      const nameWithoutExt = fileName.replace(/\.md$/, '');
      const ext = fileName.endsWith('.md') ? '.md' : '';
      newPath = `${destinationFolder}/${nameWithoutExt} ${counter}${ext}`;
      counter++;
    }

    try {
      await api.copyFile(copyingPath, newPath);
      await loadFiles();
    } catch (error) {
      console.error('Failed to copy file:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setCopyingPath(null);
    }
  };

  const loadBookmarks = async () => {
    try {
      const fetchedBookmarks = await api.getBookmarks();
      setBookmarks(fetchedBookmarks);
      // Automatically expand all groups by default
      const groups = new Set(fetchedBookmarks.map(b => b.group || 'Uncategorized'));
      setExpandedBookmarkGroups(groups);
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    }
  };

  const handleDeleteBookmark = async (id: number) => {
    try {
      await api.deleteBookmark(id);
      loadBookmarks(); // Refresh list
    } catch (error) {
      console.error('Failed to delete bookmark:', error);
    }
  };

  const toggleBookmarkGroup = (group: string) => {
    setExpandedBookmarkGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const bookmarkGroups = useMemo(() => {
    return [...new Set(bookmarks.map(b => b.group).filter(Boolean))];
  }, [bookmarks]);

  const groupedBookmarks = useMemo(() => {
    return bookmarks.reduce((acc, bookmark) => {
      const group = bookmark.group || 'Uncategorized';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(bookmark);
      return acc;
    }, {} as Record<string, any[]>);
  }, [bookmarks]);

  const currentNoteModified = files.find(f => f.path === selectedPath)?.modified;

  // Initialize word/char count on note load
  useEffect(() => {
    if (currentNote) {
      handleContentChange(currentNote.content);
    }
  }, [currentNote, handleContentChange]);

  const renderFileTree = useCallback((nodes: FileNode[], depth: number = 0): JSX.Element[] => {
    return nodes.map((node) => {
      if (renamingPath === node.path) {
        return (
          <div key={node.path} style={{ paddingLeft: `${depth * 12 + 12}px` }} className="p-1">
            <Input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setRenamingPath(null);
              }}
              autoFocus
              className="h-7 text-sm"
            />
          </div>
        );
      }
      
      if (node.type === 'folder') {
        const isExpanded = expandedFolders.has(node.path);
        return (
          <div key={node.path} className="relative group">
            <button
              onClick={() => toggleFolder(node.path)}
              onContextMenu={(e) => handleContextMenu(e, node.path, 'folder')}
              className="w-full text-left px-3 py-1 rounded-md text-sm hover:bg-slate-100 dark:hover:bg-black/20 transition-colors flex items-center gap-1"
              style={{ paddingLeft: `${depth * 12 + 12}px` }}
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <Folder className="w-4 h-4" />
              <span className="font-medium">{node.name}</span>
            </button>
            <button 
              onClick={(e) => handleContextMenu(e, node.path, 'folder')}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200 dark:hover:bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-3 h-3" />
            </button>
            {isExpanded && node.children && (
              <div>{renderFileTree(node.children, depth + 1)}</div>
            )}
          </div>
        );
      } else {
        return (
          <div key={node.path} className="relative group">
            <button
              key={node.path}
              onClick={() => handleSelectNote(node.path)}
              onContextMenu={(e) => handleContextMenu(e, node.path, 'file')}
              className={`w-full text-left px-3 py-1 rounded-md text-sm hover:bg-slate-100 dark:hover:bg-black/20 transition-colors flex items-center gap-1 ${
                selectedPath === node.path ? 'bg-blue-50 text-blue-600 dark:bg-accent dark:text-foreground' : ''
              }`}
              style={{ paddingLeft: `${depth * 12 + 24}px` }}
            >
              <File className="w-4 h-4" />
              <span className="truncate">{node.name.replace(/\.md$/, '')}</span>
            </button>
            <button 
              onClick={(e) => handleContextMenu(e, node.path, 'file')}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200 dark:hover:bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-3 h-3" />
            </button>
          </div>
        );
      }
    });
  }, [expandedFolders, selectedPath, toggleFolder, handleSelectNote, renamingPath, renameValue, handleRename]);


  return (
    <div className="h-screen flex bg-slate-50 dark:bg-background">
      <FolderSelector
        isOpen={!!movingPath}
        onClose={() => setMovingPath(null)}
        onSelect={handleMove}
        title={`Move ${movingPath?.split('/').pop()} to...`}
      />
      <FolderSelector
        isOpen={!!copyingPath}
        onClose={() => setCopyingPath(null)}
        onSelect={handleCopy}
        title={`Copy ${copyingPath?.split('/').pop()} to...`}
      />
      {bookmarkingPath && (
        <AddBookmarkDialog
          isOpen={!!bookmarkingPath}
          onClose={() => setBookmarkingPath(null)}
          onSuccess={loadBookmarks}
          path={bookmarkingPath}
          defaultTitle={bookmarkingPath.split('/').pop()?.replace(/\.md$/, '') || ''}
          existingGroups={bookmarkGroups}
        />
      )}
      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-card border dark:border-border rounded-lg shadow-lg py-2 w-48"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={() => setContextMenu(null)} // Close on click
        >
          <button 
            onClick={() => {
              setRenamingPath(contextMenu.path);
              setRenameValue(contextMenu.path.split('/').pop()?.replace(/\.md$/, '') || '');
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-black/20 flex items-center gap-2">
            <Edit className="w-4 h-4" /> Rename
          </button>
          <button 
            onClick={() => setMovingPath(contextMenu.path)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-black/20 flex items-center gap-2">
            <Move className="w-4 h-4" /> Move
          </button>
          <button 
            onClick={() => setCopyingPath(contextMenu.path)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-black/20 flex items-center gap-2">
            <Copy className="w-4 h-4" /> Copy
          </button>
          <div className="my-1 border-t dark:border-border"></div>
          <button 
            onClick={() => setBookmarkingPath(contextMenu.path)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-black/20 flex items-center gap-2">
            <Star className="w-4 h-4" /> Add to bookmarks
          </button>
          <div className="my-1 border-t dark:border-border"></div>
          <button 
            onClick={() => handleDelete(contextMenu.path)}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}
      {/* Dark, permanent vertical icon bar */}
      <aside className="w-12 bg-slate-800 dark:bg-card flex flex-col items-center py-4 gap-4 z-10">
        <button
          onClick={() => setIsSidebarOpen(o => !o)}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelRight className="w-5 h-5" />}
        </button>
        <button
          onClick={() => {
            setShowFilesSidebar(true);
            setShowSearchSidebar(false);
            setShowBookmarksSidebar(false);
            if (!isSidebarOpen) setIsSidebarOpen(true);
          }}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
            showFilesSidebar && isSidebarOpen ? 'bg-slate-700 text-white' : 'hover:bg-slate-700 text-slate-300 hover:text-white'
          }`}
          title="Files"
        >
          <FileText className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            setShowSearchSidebar(true);
            setShowFilesSidebar(false);
            setShowBookmarksSidebar(false);
            if (!isSidebarOpen) setIsSidebarOpen(true);
          }}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
            showSearchSidebar && isSidebarOpen ? 'bg-slate-700 text-white' : 'hover:bg-slate-700 text-slate-300 hover:text-white'
          }`}
          title="Search"
        >
          <SearchIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            setShowBookmarksSidebar(true);
            setShowSearchSidebar(false);
            setShowFilesSidebar(false);
            if (!isSidebarOpen) setIsSidebarOpen(true);
          }}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
            showBookmarksSidebar && isSidebarOpen ? 'bg-slate-700 text-white' : 'hover:bg-slate-700 text-slate-300 hover:text-white'
          }`}
          title="Bookmarks"
        >
          <BookMarked className="w-5 h-5" />
        </button>
        <button
          onClick={handleDailyNote}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Daily Notes"
        >
          <Calendar className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowQuickSwitcher(!showQuickSwitcher)}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Quick Switcher"
        >
          <Command className="w-5 h-5" />
        </button>
        <button
          onClick={() => navigate('/canvas')}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Canvas"
        >
          <Grid3x3 className="w-5 h-5" />
        </button>
        <button
          onClick={() => setVimMode(!vimMode)}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
            vimMode 
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'hover:bg-slate-700 text-slate-300 hover:text-white'
          }`}
          title={vimMode ? "Vim Mode: ON" : "Vim Mode: OFF"}
        >
          <span className="text-lg font-bold font-mono">V</span>
        </button>
        
        {/* Spacer */}
        <div className="flex-1" />
        
        <ThemeToggle />

        {/* User menu at bottom */}
          <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold hover:bg-blue-600 transition-colors"
            title={user?.username}
          >
            {user?.username.charAt(0).toUpperCase()}
          </button>
          
          {showUserMenu && (
            <div className="absolute left-12 bottom-0 bg-white border rounded-lg shadow-lg py-2 w-48 z-20">
              <div className="px-4 py-2 border-b">
                <div className="text-sm font-semibold">{user?.username}</div>
                <div className="text-xs text-gray-500">{user?.email}</div>
              </div>
              <button
                onClick={() => {
                  handleLogout();
                  setShowUserMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 flex items-center gap-2 text-red-600"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Collapsible File/Search Sidebar */}
      {isSidebarOpen && (
        <aside 
          ref={sidebarRef}
          className="bg-slate-50 dark:bg-card border-r flex flex-col relative"
          style={{ width: `${sidebarWidth}px` }}
        >
          {/* Top horizontal control panel */}
          <div className="bg-white dark:bg-background border-b border-slate-200 dark:border-border flex items-center gap-1 px-2 py-2">
            <button
              onClick={() => {
                setShowFilesSidebar(true);
                setShowSearchSidebar(false);
                setShowBookmarksSidebar(false);
              }}
              className={`p-2 rounded transition-colors ${
                showFilesSidebar ? 'bg-slate-200 dark:bg-primary' : 'hover:bg-slate-100 dark:hover:bg-black/20'
              }`}
              title="Files"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowSearchSidebar(true);
                setShowFilesSidebar(false);
                setShowBookmarksSidebar(false);
              }}
              className={`p-2 rounded transition-colors ${
                showSearchSidebar ? 'bg-slate-200 dark:bg-primary' : 'hover:bg-slate-100 dark:hover:bg-black/20'
              }`}
              title="Search"
            >
              <SearchIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowBookmarksSidebar(true);
                setShowSearchSidebar(false);
                setShowFilesSidebar(false);
              }}
              className={`p-2 rounded transition-colors ${
                showBookmarksSidebar ? 'bg-slate-200 dark:bg-primary' : 'hover:bg-slate-100 dark:hover:bg-black/20'
              }`}
              title="Bookmarks"
            >
              <BookMarked className="w-4 h-4" />
            </button>
          </div>
          
          {/* Main content area of sidebar */}
          <div className="flex-1 flex flex-col overflow-hidden">
          {showSearchSidebar ? (
              <Search 
                ref={globalSearchInputRef}
                key={query}
                onResultClick={(path) => handleSelectNote(path, query)}
                initialQuery={query}
              />
          ) : showBookmarksSidebar ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <h2 className="text-lg font-semibold mb-2">Bookmarks</h2>
              {Object.entries(groupedBookmarks).map(([group, bookmarksInGroup]) => (
                <div key={group}>
                  <button 
                    onClick={() => toggleBookmarkGroup(group)}
                    className="w-full text-left text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1"
                  >
                    {expandedBookmarkGroups.has(group) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {group}
                  </button>
                  {expandedBookmarkGroups.has(group) && (
                    <div className="space-y-1 pl-2 border-l ml-1">
                      {bookmarksInGroup.map(bookmark => (
                        <div key={bookmark.id} className="group flex items-center justify-between p-2 rounded-md hover:bg-slate-100 dark:hover:bg-black/20">
                          <button
                            onClick={() => handleSelectNote(bookmark.path)}
                            className="flex-1 text-left text-sm"
                          >
                            {bookmark.title}
                          </button>
                          <button
                            onClick={() => handleDeleteBookmark(bookmark.id)}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
              <>
                {/* File controls (New Note, New Folder) */}
                <div className="p-4 space-y-2 border-b dark:border-border">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowNewNoteDialog(true)}
                      className="flex-1 px-3 py-2 text-sm border dark:border-border rounded hover:bg-slate-100 dark:hover:bg-black/20 transition-colors flex items-center justify-center gap-1"
                      title="New note"
                    >
                      <FilePlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowNewFolderDialog(true)}
                      className="flex-1 px-3 py-2 text-sm border dark:border-border rounded hover:bg-slate-100 dark:hover:bg-black/20 transition-colors flex items-center justify-center gap-1"
                      title="New folder"
                    >
                      <FolderPlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={toggleAllFolders}
                      className="px-3 py-2 text-sm border dark:border-border rounded hover:bg-slate-100 dark:hover:bg-black/20 transition-colors"
                      title={allExpanded ? "Collapse all" : "Expand all"}
                    >
                      <ChevronsUpDown className="w-4 h-4" />
                    </button>
                  </div>

                  {showNewNoteDialog && (
                    <div className="p-3 border dark:border-border rounded-lg bg-slate-50 dark:bg-background space-y-2">
                      <Input
                        placeholder="Note name"
                        value={newNoteName}
                        onChange={(e) => setNewNoteName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateNote();
                          if (e.key === 'Escape') {
                            setShowNewNoteDialog(false);
                            setNewNoteName('');
                          }
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleCreateNote}>
                          Create
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            setShowNewNoteDialog(false);
                            setNewNoteName('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {showNewFolderDialog && (
                    <div className="p-3 border dark:border-border rounded-lg bg-slate-50 dark:bg-background space-y-2">
                      <Input
                        placeholder="Folder name"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateFolder();
                          if (e.key === 'Escape') {
                            setShowNewFolderDialog(false);
                            setNewFolderName('');
                          }
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleCreateFolder}>
                          Create
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            setShowNewFolderDialog(false);
                            setNewFolderName('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {/* File Tree */}
                <div className="flex-1 overflow-y-auto px-2 py-2">
                  {isLoading ? (
                    <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
                  ) : (
                    <div className="space-y-0.5">
                      {renderFileTree(fileTree)}
                    </div>
                  )}
                </div>
              </>
          )}
          </div>
          
          {/* Resize handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors"
            onMouseDown={() => setIsResizing(true)}
          />
        </aside>
      )}

      {/* Main Content Area (Editor, etc.) */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Local search overlay (Ctrl+F) */}
          {showLocalSearch && (
            <div className="absolute top-4 right-4 z-50 bg-white dark:bg-card border dark:border-border rounded-lg shadow-xl p-4 min-w-[400px]">
              <div className="flex items-center gap-2 mb-2">
                <SearchIcon className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Find in file</span>
                <div className="flex-1" />
                <button
                  onClick={() => {
                    setShowLocalSearch(false);
                    setLocalSearchInput('');
                  }}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-black/20 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <Input
                ref={localSearchInputRef}
                type="text"
                placeholder="Search in current file..."
                value={localSearchInput}
                onChange={(e) => handleLocalSearch(e.target.value)}
                className="w-full mb-2"
              />
              {localSearchState.matchCount > 0 && (
                <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
                  <span>
                    {localSearchState.currentMatch} of {localSearchState.matchCount}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        // Trigger Shift+F3 for previous match
                        const event = new KeyboardEvent('keydown', { 
                          key: 'F3', 
                          shiftKey: true,
                          bubbles: true,
                          cancelable: true
                        });
                        window.dispatchEvent(event);
                      }}
                      className="px-2 py-1 rounded hover:bg-slate-200"
                      title="Previous (Shift+F3)"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => {
                        // Trigger F3 for next match
                        const event = new KeyboardEvent('keydown', { 
                          key: 'F3',
                          bubbles: true,
                          cancelable: true
                        });
                        window.dispatchEvent(event);
                      }}
                      className="px-2 py-1 rounded hover:bg-slate-200"
                      title="Next (F3)"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              )}
              <div className="text-xs text-gray-500 mt-2">
                Use F3/Shift+F3 to navigate, Esc to close
              </div>
            </div>
          )}

          {/* Quick Switcher */}
          <QuickSwitcher
            isOpen={showQuickSwitcher}
            onClose={() => setShowQuickSwitcher(false)}
            onSelect={(path) => {
              handleSelectNote(path);
              setShowQuickSwitcher(false); // Ensure it closes on selection
            }}
            onCreate={handleCreateFromSwitcher}
          />

          {/* Tabs */}
          {tabs.length > 0 && (
            <div className="bg-white dark:bg-card border-b dark:border-border flex items-center overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.path}
                  onClick={() => handleSelectNote(tab.path)}
                  className={`px-4 py-2 text-sm border-r dark:border-border flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-black/20 transition-colors ${
                    activeTab === tab.path ? 'bg-slate-100 dark:bg-background' : ''
                  }`}
                >
                  <File className="w-3 h-3" />
                  <span>{tab.title}</span>
                  <button
                    onClick={(e) => closeTab(tab.path, e)}
                    className="hover:bg-slate-200 dark:hover:bg-black/20 rounded p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </button>
              ))}
            </div>
          )}

          {currentNote && currentNote.path === selectedPath ? (
            <>
              {/* Editor */}
              <div className="flex-1 overflow-hidden">
                <MarkdownEditor
                  key={selectedPath}
                  noteId={selectedPath}
                  initialContent={currentNote.content}
                  onSave={handleSave}
                  onChange={handleContentChange}
                  onWikiLinkClick={handleWikiLinkClick}
                  onTagClick={handleTagClick}
                  onAutosaveStatusChange={setAutosaveStatus}
                  vimMode={vimMode}
                  searchQuery={globalSearchQuery}
                  onSearchStateChange={setLocalSearchState}
                />
              </div>

              {/* Status bar */}
              <div className="bg-slate-100 dark:bg-card border-t dark:border-border px-4 py-1 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-4">
                  <SaveStatusIndicator 
                    status={autosaveStatus.status} 
                    lastSaved={autosaveStatus.lastSaved} 
                    error={autosaveStatus.error}
                    syncQueueSize={syncQueueSize}
                  />
                  <span className="text-gray-400">•</span>
                  <span>{wordCount} words</span>
                  <span>{charCount} characters</span>
                  <span>0 backlinks</span>
                  {currentNoteModified && (
                    <span className="text-gray-500">
                      Modified: {new Date(currentNoteModified).toLocaleString()}
                    </span>
                  )}
                  {localSearchState.matchCount > 0 && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-blue-600 font-medium">
                        {localSearchState.currentMatch}/{localSearchState.matchCount} matches
                      </span>
                    </>
                  )}
                </div>
                <div>
                  {selectedPath}
                </div>
              </div>
            </>
          ) : selectedPath ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-sm">Loading {selectedPath}...</p>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <h2 className="text-2xl font-semibold mb-2">Welcome to Your Vault</h2>
                <p className="text-sm">Select a note from the sidebar or create a new one</p>
              </div>
            </div>
          )}
        </main>
    </div>
  );
}
