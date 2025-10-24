import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useVaultStore } from '@/stores/vault';
import { useSearchStore } from '@/stores/search';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarkdownEditor } from '@/components/markdown-editor';

export function VaultPage() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuthStore();
  const { files, currentNote, loadFiles, loadNote, saveNote, createNote, isLoading } = useVaultStore();
  const { query, results, search, clearSearch, setQuery } = useSearchStore();
  
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadFiles();
  }, [isAuthenticated, navigate]);

  const handleSelectNote = async (path: string) => {
    setSelectedPath(path);
    await loadNote(path);
    clearSearch();
  };

  const handleSave = async (content: string) => {
    if (selectedPath) {
      await saveNote(selectedPath, content);
    }
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
      await handleSelectNote(path);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
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
        <aside className="w-64 bg-white border-r overflow-y-auto">
          <div className="p-4 space-y-2">
            <Button 
              className="w-full" 
              onClick={() => setShowNewNoteDialog(true)}
            >
              + New Note
            </Button>

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
          </div>

          <div className="px-4 py-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              {query ? 'Search Results' : 'All Notes'}
            </h3>
            
            {isLoading ? (
              <div className="text-sm text-gray-500">Loading...</div>
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
                    <div className="font-medium truncate">{result.title}</div>
                    {result.preview && (
                      <div className="text-xs text-gray-500 truncate mt-1">
                        {result.preview}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : query ? (
              <div className="text-sm text-gray-500">No results found</div>
            ) : (
              <div className="space-y-1">
                {files.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => handleSelectNote(file.path)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-slate-100 transition-colors ${
                      selectedPath === file.path ? 'bg-blue-50 text-blue-600' : ''
                    }`}
                  >
                    <div className="font-medium truncate">{file.title}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(file.modified).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          {currentNote ? (
            <MarkdownEditor
              initialContent={currentNote.content}
              onSave={handleSave}
            />
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

