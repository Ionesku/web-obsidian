import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useVaultStore } from '@/stores/vault';
import { useSearchStore } from '@/stores/search';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarkdownEditor } from '@/components/markdown-editor';
import {
  File,
  Folder,
  FilePlus,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Calendar,
  Search,
  Command,
  FileText,
  Grid3x3,
  X,
  BookMarked,
  ChevronsDownUp,
  ChevronsUpDown,
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
  const { query, results, search, clearSearch, setQuery } = useSearchStore();
  
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadFiles();
  }, [isAuthenticated, navigate]);

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

  const expandAll = () => {
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
  };

  const collapseAll = () => {
    setExpandedFolders(new Set());
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

  const handleSave = async (content: string) => {
    if (selectedPath) {
      await saveNote(selectedPath, content);
    }
  };

  const handleContentChange = (content: string) => {
    // Count words and characters
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const chars = content.length;
    setWordCount(words);
    setCharCount(chars);
  };

  const handleSearch = (value: string) => {
    setSearchInput(value);
    if (value.trim()) {
      search(value);
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
    // Search by tag
    const searchQuery = `tag:${tag}`;
    setSearchInput(searchQuery);
    search(searchQuery);
  };

  const currentNoteModified = files.find(f => f.path === selectedPath)?.modified;

  return (
    <div className="h-screen flex bg-slate-50">
      {/* Left icon panel */}
      <aside className="w-12 bg-slate-800 flex flex-col items-center py-4 gap-4">
        <button
          onClick={() => {}}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Files"
        >
          <FileText className="w-5 h-5" />
        </button>
        <button
          onClick={() => setSearchInput('')}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Search"
        >
          <Search className="w-5 h-5" />
        </button>
        <button
          onClick={handleDailyNote}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Daily Notes"
        >
          <Calendar className="w-5 h-5" />
        </button>
        <button
          onClick={() => {}}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Quick Switcher"
        >
          <Command className="w-5 h-5" />
        </button>
        <button
          onClick={() => {}}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Templates"
        >
          <FileText className="w-5 h-5" />
        </button>
        <button
          onClick={() => navigate('/canvas')}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Canvas"
        >
          <Grid3x3 className="w-5 h-5" />
        </button>
        <button
          onClick={() => {}}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Bookmarks"
        >
          <BookMarked className="w-5 h-5" />
        </button>
      </aside>

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Obsidian Web</h1>
            <div className="relative">
              <Input
                type="text"
                placeholder="Search notes..."
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {user?.username}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 bg-white border-r flex flex-col">
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
                  onClick={expandAll}
                  className="px-3 py-2 text-sm border rounded hover:bg-slate-50 transition-colors"
                  title="Expand all"
                >
                  <ChevronsUpDown className="w-4 h-4" />
                </button>
                <button
                  onClick={collapseAll}
                  className="px-3 py-2 text-sm border rounded hover:bg-slate-50 transition-colors"
                  title="Collapse all"
                >
                  <ChevronsDownUp className="w-4 h-4" />
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
                {query ? 'Search Results' : 'Files'}
              </h3>
              
              {isLoading ? (
                <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
              ) : query && results.length > 0 ? (
                <div className="space-y-1">
                  {results.map((result) => (
                    <button
                      key={result.path}
                      onClick={() => handleSelectNote(result.path)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-slate-100 transition-colors ${
                        selectedPath === result.path ? 'bg-blue-50 text-blue-600' : ''
                      }`}
                    >
                      <div className="font-medium truncate flex items-center gap-1">
                        <File className="w-4 h-4" />
                        {result.title}
                      </div>
                      {result.preview && (
                        <div className="text-xs text-gray-500 truncate mt-1">
                          {result.preview}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : query ? (
                <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
              ) : (
                <div className="space-y-0.5">
                  {renderFileTree(fileTree)}
                </div>
              )}
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 flex flex-col overflow-hidden">
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

            {currentNote ? (
              <>
                {/* File header with metadata */}
                <div className="bg-white border-b px-6 py-3">
                  <h2 className="text-xl font-bold">{selectedPath?.split('/').pop()}</h2>
                  {currentNoteModified && (
                    <p className="text-xs text-gray-500 mt-1">
                      Modified: {new Date(currentNoteModified).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Editor */}
                <div className="flex-1 overflow-hidden">
                  <MarkdownEditor
                    key={selectedPath}
                    initialContent={currentNote.content}
                    onSave={handleSave}
                    onChange={handleContentChange}
                    onWikiLinkClick={handleWikiLinkClick}
                    onTagClick={handleTagClick}
                  />
                </div>

                {/* Status bar */}
                <div className="bg-slate-100 border-t px-4 py-1 flex items-center justify-between text-xs text-gray-600">
                  <div className="flex items-center gap-4">
                    <span>{wordCount} words</span>
                    <span>{charCount} characters</span>
                    <span>0 backlinks</span>
                  </div>
                  <div>
                    {selectedPath}
                  </div>
                </div>
              </>
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
    </div>
  );
}
