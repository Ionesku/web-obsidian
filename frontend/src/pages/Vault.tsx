import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useVaultStore } from '@/stores/vault';
import { useSearchStore } from '@/stores/search';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarkdownEditor } from '@/components/markdown-editor';
import { SaveStatusIndicator } from '@/components/SaveStatusIndicator';
import { Search } from '@/components/Search';
import type { AutosaveStatus } from '@/lib/codemirror/types';
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
} from 'lucide-react';

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
  const { results, search, searchByTag, clearSearch, setQuery, query: searchQuery } = useSearchStore();
  
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [localSearchInput, setLocalSearchInput] = useState(''); // For Ctrl+F local search
  const [showLocalSearch, setShowLocalSearch] = useState(false); // For Ctrl+F overlay
  const [showSearchSidebar, setShowSearchSidebar] = useState(false); // For dedicated search sidebar
  const [showFilesSidebar, setShowFilesSidebar] = useState(true); // For files sidebar
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>(() => {
    // Load tabs from localStorage on init
    const saved = localStorage.getItem('vault_tabs');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState<string | null>(() => {
    // Load active tab from localStorage
    return localStorage.getItem('vault_active_tab');
  });
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [vimMode, setVimMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256); // 64rem = 256px
  const [isResizing, setIsResizing] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>({
    status: 'idle',
    lastSaved: null,
    error: null,
  });
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  const localSearchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F for local search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        setShowLocalSearch(true);
      }
      
      // Escape to close search overlays
      if (e.key === 'Escape') {
        if (showLocalSearch) {
          setShowLocalSearch(false);
          setLocalSearchInput('');
        }
        if (showQuickSwitcher) {
          setShowQuickSwitcher(false);
        }
      }
    };

    // Use capture phase to intercept before browser default
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [showLocalSearch, showQuickSwitcher]);

  // Focus local search input when it opens
  useEffect(() => {
    if (showLocalSearch && localSearchInputRef.current) {
      localSearchInputRef.current.focus();
    }
  }, [showLocalSearch]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadFiles();
  }, [isAuthenticated, navigate, loadFiles]);

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
  const buildFileTree = (files: any[]): FileNode[] => {
    const root: FileNode[] = [];
    const folderMap: Map<string, FileNode> = new Map();

    files.forEach((file) => {
      const parts = file.path.split('/');
      let currentLevel = root;
      let currentPath = '';

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isFile = index === parts.length - 1;

        if (isFile) {
          currentLevel.push({
            name: part,
            path: file.path,
            type: 'file',
            modified: file.modified,
          });
        } else {
          let folder = folderMap.get(currentPath);
          if (!folder) {
            folder = {
              name: part,
              path: currentPath,
              type: 'folder',
              children: [],
            };
            folderMap.set(currentPath, folder);
            currentLevel.push(folder);
          }
          currentLevel = folder.children!;
        }
      });
    });

    return root;
  };

  const fileTree = buildFileTree(files);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

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

  const renderFileTree = (nodes: FileNode[], depth: number = 0): JSX.Element[] => {
    return nodes.map((node) => {
      if (node.type === 'folder') {
        const isExpanded = expandedFolders.has(node.path);
        return (
          <div key={node.path}>
            <button
              onClick={() => toggleFolder(node.path)}
              className="w-full text-left px-3 py-1 rounded-md text-sm hover:bg-slate-100 transition-colors flex items-center gap-1"
              style={{ paddingLeft: `${depth * 12 + 12}px` }}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <Folder className="w-4 h-4" />
              <span className="font-medium">{node.name}</span>
            </button>
            {isExpanded && node.children && (
              <div>{renderFileTree(node.children, depth + 1)}</div>
            )}
          </div>
        );
      } else {
        return (
          <button
            key={node.path}
            onClick={() => handleSelectNote(node.path)}
            className={`w-full text-left px-3 py-1 rounded-md text-sm hover:bg-slate-100 transition-colors flex items-center gap-1 ${
              selectedPath === node.path ? 'bg-blue-50 text-blue-600' : ''
            }`}
            style={{ paddingLeft: `${depth * 12 + 24}px` }}
          >
            <File className="w-4 h-4" />
            <span className="truncate">{node.name}</span>
          </button>
        );
      }
    });
  };

  const handleSelectNote = async (path: string) => {
    setSelectedPath(path);
    setActiveTab(path);
    await loadNote(path);
    clearSearch();

    // Add to tabs if not already there
    if (!tabs.find((tab) => tab.path === path)) {
      const fileName = path.split('/').pop() || path;
      setTabs([...tabs, { path, title: fileName }]);
    }
  };

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
    // Count words and characters
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const chars = content.length;
    setWordCount(words);
    setCharCount(chars);
  }, []);

  const handleSearch = (value: string) => {
    setSearchInput(value);
    if (value.trim()) {
      // Check if it's a tag search
      const tagMatch = value.match(/^tag:(#?)(.+)$/);
      if (tagMatch) {
        const tag = tagMatch[2]; // Extract tag without #
        searchByTag(tag);
      } else {
      search(value);
      }
    } else {
      clearSearch();
    }
  };

  const handleCreateNote = async () => {
    if (!newNoteName.trim()) return;
    
    const path = newNoteName.endsWith('.md') 
      ? `notes/${newNoteName}` 
      : `notes/${newNoteName}.md`;
    
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
    const path = `notes/${newFolderName}/.gitkeep`;
    
    try {
      await createNote(path, '');
      setShowNewFolderDialog(false);
      setNewFolderName('');
      await loadFiles();
      setExpandedFolders((prev) => new Set(prev).add(`notes/${newFolderName}`));
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

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

  const handleTagClick = (tag: string) => {
    console.log('Tag clicked:', tag);
    // Remove # if present
    const cleanTag = tag.replace(/^#/, '');
    // Use the tag directly as search query
    const searchQuery = `tag:${cleanTag}`;
    console.log('Search query:', searchQuery);
    setQuery(searchQuery);
    setShowSearchSidebar(true); // Open search sidebar
    setShowFilesSidebar(false); // Hide files sidebar
  };

  // Local search within current file (Ctrl+F)
  const handleLocalSearch = (value: string) => {
    setLocalSearchInput(value);
    // TODO: Implement local search highlighting in editor
    // This would require CodeMirror extensions for search functionality
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    // TODO: Apply dark mode to entire app
  };

  const currentNoteModified = files.find(f => f.path === selectedPath)?.modified;

  return (
    <div className={`h-screen flex flex-col ${darkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      {/* Top toolbar - horizontal */}
      <div className="h-12 bg-slate-800 flex items-center px-2 gap-1">
        {/* Left side - main actions */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelRight className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
        
        <button
          onClick={() => {}}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Bookmarks"
        >
          <BookMarked className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => {
            if (showSearchSidebar) {
              // If search is already open, close it and open files
              setShowSearchSidebar(false);
              setShowFilesSidebar(true);
            } else {
              // Open search and close files
              setShowSearchSidebar(true);
              setShowFilesSidebar(false);
            }
          }}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
            showSearchSidebar
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'hover:bg-slate-700 text-slate-300 hover:text-white'
          }`}
          title="Search (Find)"
        >
          <SearchIcon className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => {
            if (showFilesSidebar) {
              // If files is already open, close it and open search
              setShowFilesSidebar(false);
              setShowSearchSidebar(true);
            } else {
              // Open files and close search
              setShowFilesSidebar(true);
              setShowSearchSidebar(false);
            }
          }}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
            showFilesSidebar
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'hover:bg-slate-700 text-slate-300 hover:text-white'
          }`}
          title="Files"
        >
          <FileText className="w-4 h-4" />
        </button>
        
        {/* Divider */}
        <div className="h-6 w-px bg-slate-600 mx-1" />
        
        <button
          onClick={handleDailyNote}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Daily Notes"
        >
          <Calendar className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowQuickSwitcher(!showQuickSwitcher)}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Quick Switcher"
        >
          <Command className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate('/canvas')}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Canvas"
        >
          <Grid3x3 className="w-4 h-4" />
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
          <span className="text-sm font-bold font-mono">V</span>
        </button>
        
        {/* Spacer */}
        <div className="flex-1" />
        
        {/* User menu at right */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold hover:bg-blue-600 transition-colors text-xs"
            title={user?.username}
          >
            {user?.username.charAt(0).toUpperCase()}
          </button>
          
          {showUserMenu && (
            <div className="absolute right-0 top-12 bg-white border rounded-lg shadow-lg py-2 w-48 z-20">
              <div className="px-4 py-2 border-b">
                <div className="text-sm font-semibold">{user?.username}</div>
                <div className="text-xs text-gray-500">{user?.email}</div>
              </div>
              <button
                onClick={toggleDarkMode}
                className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 flex items-center gap-2"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {darkMode ? 'Light Mode' : 'Dark Mode'}
              </button>
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
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Files or Search */}
        {!sidebarCollapsed && (showFilesSidebar || showSearchSidebar) && (
          <aside 
            ref={sidebarRef}
            className="bg-white border-r flex flex-col relative"
            style={{ width: `${sidebarWidth}px` }}
          >
            {showSearchSidebar ? (
              /* Search Sidebar */
              <Search 
                key={searchQuery} // Force re-render when query changes
                onResultClick={handleSelectNote} 
                initialQuery={searchQuery}
              />
            ) : (
              /* Files Sidebar */
              <>
                <div className="p-4 space-y-2 border-b">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowNewNoteDialog(true)}
                      className="flex-1 px-3 py-2 text-sm border rounded hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                      title="New note"
                    >
                      <FilePlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowNewFolderDialog(true)}
                      className="flex-1 px-3 py-2 text-sm border rounded hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                      title="New folder"
                    >
                      <FolderPlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={toggleAllFolders}
                      className="px-3 py-2 text-sm border rounded hover:bg-slate-50 transition-colors"
                      title={allExpanded ? "Collapse all" : "Expand all"}
                    >
                      <ChevronsUpDown className="w-4 h-4" />
                    </button>
                  </div>

                  {showNewNoteDialog && (
                    <div className="p-3 border rounded-lg bg-slate-50 space-y-2">
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
                    <div className="p-3 border rounded-lg bg-slate-50 space-y-2">
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

                <div className="flex-1 overflow-y-auto px-2 py-2">
                  <h3 className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Files
                  </h3>
                  
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
            
            {/* Resize handle */}
            <div
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors"
              onMouseDown={() => setIsResizing(true)}
            />
          </aside>
        )}

        {/* Expand button when collapsed */}
        {sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="w-8 bg-white border-r hover:bg-slate-50 flex items-center justify-center"
            title="Expand sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Local search overlay (Ctrl+F) */}
          {showLocalSearch && (
            <div className="absolute top-4 right-4 z-50 bg-white border rounded-lg shadow-xl p-4 min-w-[400px]">
              <div className="flex items-center gap-2 mb-2">
                <SearchIcon className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Find in file</span>
                <div className="flex-1" />
                <button
                  onClick={() => {
                    setShowLocalSearch(false);
                    setLocalSearchInput('');
                  }}
                  className="p-1 hover:bg-slate-100 rounded"
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    // TODO: Navigate to next match
                    console.log('Search for:', localSearchInput);
                  }
                }}
                className="w-full"
                autoFocus
              />
              <div className="text-xs text-gray-500 mt-2">
                Press Enter to search, Esc to close
              </div>
            </div>
          )}

          {/* Quick Switcher */}
          {showQuickSwitcher && (
            <div className="absolute top-0 left-0 right-0 z-10 bg-white border-b shadow-lg p-4">
              <div className="max-w-2xl mx-auto">
                <Input
                  type="text"
                  placeholder="Type to search files..."
                  value={searchInput}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setShowQuickSwitcher(false);
                    setSearchInput('');
                    clearSearch();
                  }}
                  className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
                {results.length > 0 && (
                  <div className="mt-2 max-h-96 overflow-y-auto">
                    {results.map((result) => (
                      <button
                        key={result.path}
                        onClick={() => {
                          handleSelectNote(result.path);
                          setShowQuickSwitcher(false);
                          setSearchInput('');
                          clearSearch();
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded"
                      >
                        <div className="font-medium">{result.title}</div>
                        <div className="text-xs text-gray-500">{result.path}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tabs */}
          {tabs.length > 0 && (
            <div className="bg-white border-b flex items-center overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.path}
                  onClick={() => handleSelectNote(tab.path)}
                  className={`px-4 py-2 text-sm border-r flex items-center gap-2 hover:bg-slate-50 transition-colors ${
                    activeTab === tab.path ? 'bg-slate-100' : ''
                  }`}
                >
                  <File className="w-3 h-3" />
                  <span>{tab.title}</span>
                  <button
                    onClick={(e) => closeTab(tab.path, e)}
                    className="hover:bg-slate-200 rounded p-0.5"
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
                />
              </div>

              {/* Status bar */}
              <div className="bg-slate-100 border-t px-4 py-1 flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-4">
                  <SaveStatusIndicator 
                    status={autosaveStatus.status} 
                    lastSaved={autosaveStatus.lastSaved} 
                    error={autosaveStatus.error} 
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
    </div>
  );
}
