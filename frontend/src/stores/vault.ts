import { create } from 'zustand';
import api from '@/lib/api';

interface FileInfo {
  path: string;
  name: string;
  title: string;
  folder: string;
  modified: string;
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
      
      // Update current note if it's the one being saved
      const { currentNote } = get();
      if (currentNote?.path === path) {
        set({ 
          currentNote: { 
            ...currentNote, 
            content 
          } 
        });
      }
      
      // Reload files to update modified time
      await get().loadFiles();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  createNote: async (path: string, content: string = '') => {
    set({ error: null });
    try {
      await api.createFile(path, content);
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

