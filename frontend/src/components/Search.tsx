// ============================================================================
// SEARCH COMPONENT - Advanced search UI with query syntax
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { federatedSearch, explainSearch } from '../search/parser/federation';
import type { SearchResult, SearchHit } from '../search/types';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface SearchProps {
  onResultClick?: (path: string) => void;
  initialQuery?: string;
}

export function Search({ onResultClick, initialQuery }: SearchProps) {
  const [query, setQuery] = useState(initialQuery || '');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Load search history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('search_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load search history', e);
      }
    }
  }, []);

  // Debounced search
  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResult(null);
      return;
    }

    setIsSearching(true);
    
    try {
      const searchResult = await federatedSearch(q, { limit: 50 });
      setResult(searchResult);
      
      // Add to history
      if (!history.includes(q)) {
        const newHistory = [q, ...history.slice(0, 19)]; // Keep last 20
        setHistory(newHistory);
        localStorage.setItem('search_history', JSON.stringify(newHistory));
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResult({
        hits: [],
        total: 0,
        took: 0,
        query: q,
      });
    } finally {
      setIsSearching(false);
    }
  }, [history]);

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
    // performSearch is stable due to useCallback, but including it is good practice
  }, [initialQuery, performSearch]);

  // Handle query change with debounce
  const handleQueryChange = (value: string) => {
    setQuery(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Explain query
  const handleExplain = async () => {
    if (!query.trim()) return;
    
    const exp = await explainSearch(query);
    setExplanation(exp);
    setShowExplanation(true);
  };

  // Quick filters
  const insertFilter = (filter: string) => {
    const newQuery = query ? `${query} ${filter}` : filter;
    setQuery(newQuery);
    performSearch(newQuery);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search header */}
      <div className="p-4 border-b">
        <div className="flex gap-2 mb-3">
          <Input
            type="text"
            placeholder="Search: tag:work OR path:notes/ [status:todo]"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="flex-1"
            autoFocus
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExplain}
            disabled={!query.trim()}
          >
            Explain
          </Button>
        </div>

        {/* Quick filters */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => insertFilter('tag:')}
          >
            tag:
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => insertFilter('[prop:value]')}
          >
            [prop:]
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => insertFilter('file:')}
          >
            file:
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => insertFilter('path:')}
          >
            path:
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => insertFilter('task:')}
          >
            task:
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => insertFilter('link:')}
          >
            link:
          </Button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {isSearching && (
          <div className="text-center text-gray-500 py-8">
            Searching...
          </div>
        )}

        {!isSearching && result && (
          <>
            {/* Stats */}
            <div className="text-sm text-gray-500 mb-4">
              Found {result.total} result(s) in {result.took.toFixed(0)}ms
              {result.plan?.restrictPaths && (
                <span className="ml-2">
                  (filtered to {result.plan.restrictPaths.length} file(s) locally)
                </span>
              )}
            </div>

            {/* Hits */}
            <div className="space-y-2">
              {result.hits.map((hit) => (
                <SearchHitCard 
                  key={hit.path} 
                  hit={hit} 
                  query={query}
                  onResultClick={onResultClick}
                />
              ))}
            </div>

            {result.hits.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No results found
              </div>
            )}
          </>
        )}

        {/* History */}
        {!query && !result && history.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-2 text-gray-700">Recent Searches</h3>
            <div className="space-y-1">
              {history.map((q, i) => (
                <button
                  key={i}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                  onClick={() => {
                    setQuery(q);
                    performSearch(q);
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Explanation modal */}
      {showExplanation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Query Explanation</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExplanation(false)}
              >
                ✕
              </Button>
            </div>
            <div className="p-4">
              <pre className="text-sm bg-gray-100 p-4 rounded overflow-x-auto">
                {explanation}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Search hit card component
function SearchHitCard({ 
  hit, 
  query, 
  onResultClick 
}: { 
  hit: SearchHit; 
  query: string;
  onResultClick?: (path: string) => void;
}) {
  const handleOpen = () => {
    if (onResultClick) {
      onResultClick(hit.path);
    }
  };

  return (
    <Card className="p-3 hover:shadow-md transition-shadow cursor-pointer" onClick={handleOpen}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex-1">
          <h3 className="font-semibold text-sm">{hit.title || hit.path}</h3>
          <p className="text-xs text-gray-500">{hit.path}</p>
        </div>
        <div className="flex items-center gap-2">
          {hit.layer === 'local' && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
              Local
            </span>
          )}
          {hit.layer === 'server' && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
              Server
            </span>
          )}
          {hit.score !== undefined && hit.score > 0 && (
            <span className="text-xs text-gray-400">
              {hit.score.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Snippet */}
      {hit.snippet && (
        <div className="text-sm text-gray-600 mt-2">
          <HighlightedText text={hit.snippet} query={query} />
        </div>
      )}

      {/* Metadata */}
      {hit.meta && (
        <div className="mt-2 flex gap-2 flex-wrap">
          {hit.meta.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
              #{tag}
            </span>
          ))}
          {hit.meta.tags.length > 3 && (
            <span className="text-xs text-gray-400">
              +{hit.meta.tags.length - 3} more
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

// Highlighted text component
function HighlightedText({ text, query }: { text: string; query: string }) {
  // Simple highlighting - extract words from query
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => !w.includes(':') && !w.startsWith('[') && w.length > 2);

  if (words.length === 0) {
    return <span>{text}</span>;
  }

  // Build regex
  const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(pattern);

  return (
    <span>
      {parts.map((part, i) => {
        const isMatch = words.some(w => part.toLowerCase() === w.toLowerCase());
        return isMatch ? (
          <mark key={i} className="bg-yellow-200 px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </span>
  );
}

