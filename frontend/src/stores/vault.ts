import { create } from 'zustand';
import api from '@/lib/api';
import { searchEngine } from '@/search/engine';

export interface FileInfo {
  path: string;
  name: string;
  type: 'file' | 'folder';
  modified: number;
  size: number;
}

interface NoteData {
  path: string;
  content: string;
  modified: number;
  size: number;
}

interface VaultState {
  files: FileInfo[];
  currentNote: NoteData | null;
  isLoading: boolean;
  error: string | null;
  
  loadFiles: () => Promise<void>;
  loadNote: (path: string) => Promise<void>;
  saveNote: (path: string, content: string) => Promise<void>;
  createNote: (path: string, content: string) => Promise<void>;
  deleteNote: (path: string) => Promise<void>;
  renameNote: (oldPath: string, newPath: string) => Promise<void>;
  clearError: () => void;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  files: [],
  currentNote: null,
  isLoading: false,
  error: null,

  loadFiles: async () => {
    set({ isLoading: true, error: null });
    try {
      const files = await api.listFiles();
      set({ files, isLoading: false });
      
      // Index all files for search in background (don't block UI)
      console.log(`Starting background indexing of ${files.length} files...`);
      setTimeout(async () => {
        for (const file of files) {
          try {
            const note = await api.getFile(file.path);
            await searchEngine.indexLocal({
              path: file.path,
              content: note.content,
              mtime: note.modified,
              hash: '', // Will be calculated by engine
            });
          } catch (err) {
            console.error(`Failed to index ${file.path}:`, err);
          }
        }
        console.log('✅ Indexing complete!');
      }, 100); // Small delay to not block initial UI render
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  loadNote: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const note = await api.getFile(path);
      set({ currentNote: note, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  saveNote: async (path: string, content: string) => {
    set({ error: null });
    try {
      await api.updateFile(path, content);
      
      // Index the updated file for search
      await searchEngine.indexLocal({
        path,
        content,
        mtime: Date.now(),
        hash: '', // Will be calculated by engine
      });
      
      // Don't reload files on autosave to avoid UI flicker and focus loss
      // The file list will be refreshed when user manually interacts with it
      // This dramatically improves autosave performance and UX
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  createNote: async (path: string, content: string = '') => {
    set({ error: null });
    try {
      await api.createFile(path, content);
      
      // Index the new file for search
      await searchEngine.indexLocal({
        path,
        content,
        mtime: Date.now(),
        hash: '', // Will be calculated by engine
      });
      
      await get().loadFiles();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteNote: async (path: string) => {
    set({ error: null });
    try {
      await api.deleteFile(path);
      
      // Remove from search index
      await searchEngine.deleteLocal(path);
      
      // Clear current note if it was deleted
      const { currentNote } = get();
      if (currentNote?.path === path) {
        set({ currentNote: null });
      }
      
      await get().loadFiles();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  renameNote: async (oldPath: string, newPath: string) => {
    set({ error: null });
    try {
      await api.renameFile(oldPath, newPath);
      
      // Update current note path if it was renamed
      const { currentNote } = get();
      if (currentNote?.path === oldPath) {
        set({ 
          currentNote: { 
            ...currentNote, 
            path: newPath 
          } 
        });
      }
      
      await get().loadFiles();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));

