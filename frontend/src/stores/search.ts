import { create } from 'zustand';
import api from '@/lib/api';

interface SearchResult {
  path: string;
  title: string;
  preview: string;
  score: number;
}

interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  error: string | null;
  
  search: (query: string) => Promise<void>;
  searchByTag: (tag: string) => Promise<void>;
  clearSearch: () => void;
  setQuery: (query: string) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  results: [],
  isSearching: false,
  error: null,

  search: async (query: string) => {
    if (!query.trim()) {
      set({ results: [], query: '' });
      return;
    }

    set({ isSearching: true, error: null, query });
    try {
      const results = await api.search(query);
      set({ results, isSearching: false });
    } catch (error: any) {
      set({ error: error.message, isSearching: false, results: [] });
    }
  },

  searchByTag: async (tag: string) => {
    set({ isSearching: true, error: null, query: `#${tag}` });
    try {
      const results = await api.searchByTag(tag);
      set({ results, isSearching: false });
    } catch (error: any) {
      set({ error: error.message, isSearching: false, results: [] });
    }
  },

  clearSearch: () => set({ query: '', results: [], error: null }),
  
  setQuery: (query: string) => set({ query }),
}));

