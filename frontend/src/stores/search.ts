// ============================================================================
// SEARCH STORE - Zustand store for search state
// ============================================================================

import { create } from 'zustand';
import type { SearchResult, IndexStatus } from '../search/types';

interface SearchState {
  // Current search
  query: string;
  result: SearchResult | null;
  isSearching: boolean;
  error: string | null;
  
  // Index status
  indexStatus: IndexStatus;
  
  // Search history
  history: string[];
  pinnedQueries: string[];
  
  // Actions
  setQuery: (query: string) => void;
  setResult: (result: SearchResult | null) => void;
  setSearching: (isSearching: boolean) => void;
  setError: (error: string | null) => void;
  setIndexStatus: (status: IndexStatus) => void;
  
  addToHistory: (query: string) => void;
  clearHistory: () => void;
  
  pinQuery: (query: string) => void;
  unpinQuery: (query: string) => void;
  
  reset: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  // Initial state
  query: '',
  result: null,
  isSearching: false,
  error: null,
  indexStatus: {
    state: 'idle',
    filesIndexed: 0,
    totalFiles: 0,
    queueSize: 0,
  },
  history: [],
  pinnedQueries: [],
  
  // Actions
  setQuery: (query) => set({ query }),
  setResult: (result) => set({ result }),
  setSearching: (isSearching) => set({ isSearching }),
  setError: (error) => set({ error }),
  setIndexStatus: (indexStatus) => set({ indexStatus }),
  
  addToHistory: (query) =>
    set((state) => {
      if (!query.trim() || state.history.includes(query)) {
        return state;
      }
      return {
        history: [query, ...state.history.slice(0, 19)], // Keep last 20
      };
    }),
  
  clearHistory: () => set({ history: [] }),
  
  pinQuery: (query) =>
    set((state) => {
      if (state.pinnedQueries.includes(query)) {
        return state;
      }
      return {
        pinnedQueries: [...state.pinnedQueries, query],
      };
    }),
  
  unpinQuery: (query) =>
    set((state) => ({
      pinnedQueries: state.pinnedQueries.filter((q) => q !== query),
    })),
  
  reset: () =>
    set({
      query: '',
      result: null,
      isSearching: false,
      error: null,
    }),
}));

// Persist history to localStorage
if (typeof window !== 'undefined') {
  const savedHistory = localStorage.getItem('search_history');
  if (savedHistory) {
    try {
      const history = JSON.parse(savedHistory);
      useSearchStore.setState({ history });
    } catch (e) {
      console.error('Failed to load search history', e);
    }
  }
  
  // Subscribe to history changes
  useSearchStore.subscribe((state) => {
    localStorage.setItem('search_history', JSON.stringify(state.history));
  });
}
