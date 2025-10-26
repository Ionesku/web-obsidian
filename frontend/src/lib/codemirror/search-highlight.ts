/**
 * CodeMirror 6 Search Highlighting Extension
 * 
 * Provides search functionality with highlighting and navigation
 */

import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  search,
  getSearchQuery,
  SearchQuery,
  setSearchQuery,
  findNext,
  findPrevious,
  searchKeymap,
  openSearchPanel,
} from '@codemirror/search';
import { keymap } from '@codemirror/view';


// ============================================================================
// THEME
// ============================================================================

export const searchHighlightTheme = EditorView.baseTheme({
  // Default match style from @codemirror/search
  '.cm-searchMatch': {
    backgroundColor: '#ffd54f80',
  },
  // Style for the currently selected match
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: '#ff9800',
    fontWeight: 'bold',
  },
});


// ============================================================================
// PUBLIC API
// ============================================================================
export interface SearchAPI {
  setQuery: (query: string) => void;
  nextMatch: () => void;
  prevMatch: () => void;
  clearSearch: () => void;
  getState: () => { query: string };
}


export function createSearchAPI(view: EditorView): SearchAPI {
    return {
        setQuery(query: string) {
            view.dispatch({
                effects: setSearchQuery.of(new SearchQuery({
                    search: query,
                    caseSensitive: false,
                }))
            });
            // After setting query, findNext will automatically focus the first match
            if (query) {
                findNext(view);
            }
        },

        nextMatch() {
            findNext(view);
        },

        prevMatch() {
            findPrevious(view);
        },

        clearSearch() {
            view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: '' })) });
        },

        getState() {
            return {
                query: getSearchQuery(view.state).source,
            };
        },
    };
}


// ============================================================================
// EXTENSION
// ============================================================================

export function searchHighlight(): Extension {
  return [
    search({ top: true }),
    searchHighlightTheme,
    keymap.of([
      ...searchKeymap,
      // Add a specific binding for Ctrl-F to ensure it focuses the search panel
      {
        key: 'Ctrl-f',
        run: openSearchPanel,
      },
    ]),
  ];
}

