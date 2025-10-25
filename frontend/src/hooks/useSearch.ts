// ============================================================================
// USE SEARCH HOOK - React hook for search functionality
// ============================================================================

import { useState, useCallback, useEffect } from 'react';
import { searchEngine } from '../search/engine';
import type { SearchResult, LocalSearchOptions } from '../search/types';

export function useSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string, options?: LocalSearchOptions) => {
    if (!query.trim()) {
      setResult(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const searchResult = await searchEngine.search(query, options);
      setResult(searchResult);
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setResult(null);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    search,
    clear,
    isSearching,
    result,
    error,
  };
}

// Hook for indexing
export function useIndexing() {
  const [isIndexing, setIsIndexing] = useState(false);

  const indexFile = useCallback(async (path: string, content: string, mtime: number) => {
    setIsIndexing(true);
    try {
      await searchEngine.indexLocal({
        path,
        content,
        mtime,
        hash: '', // Will be calculated by engine
      });
    } catch (err) {
      console.error('Indexing error:', err);
    } finally {
      setIsIndexing(false);
    }
  }, []);

  const deleteFile = useCallback(async (path: string) => {
    await searchEngine.deleteLocal(path);
  }, []);

  const rebuildGraph = useCallback(async () => {
    setIsIndexing(true);
    try {
      await searchEngine.rebuildGraph();
    } catch (err) {
      console.error('Rebuild graph error:', err);
    } finally {
      setIsIndexing(false);
    }
  }, []);

  return {
    indexFile,
    deleteFile,
    rebuildGraph,
    isIndexing,
  };
}

