/**
 * CodeMirror 6 Search Highlighting Extension
 * 
 * Provides search functionality with highlighting and navigation
 */

import { Extension, StateField, StateEffect } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { search, getSearchQuery, SearchQuery, setSearchQuery } from '@codemirror/search';

// ============================================================================
// STATE EFFECTS
// ============================================================================
export const setCurrentMatch = StateEffect.define<number>();


// ============================================================================
// STATE FIELD
// ============================================================================

interface SearchState {
  matches: { from: number; to: number }[];
  currentMatchIndex: number;
}

const searchStateField = StateField.define<SearchState>({
  create() {
    return {
      matches: [],
      currentMatchIndex: -1,
    };
  },

  update(state, tr) {
    const oldQuery = getSearchQuery(tr.startState);
    const newQuery = getSearchQuery(tr.state);
    const queryChanged = oldQuery.source !== newQuery.source || oldQuery.caseSensitive !== newQuery.caseSensitive;

    let newState = state;

    if (tr.docChanged || queryChanged) {
      const matches: { from: number; to: number }[] = [];
      if (newQuery.source && newQuery.source.length >= 2) {
        const cursor = newQuery.getCursor(tr.state.doc);
        while (cursor.next()) {
            if (cursor.value.from !== cursor.value.to) {
                matches.push({ from: cursor.value.from, to: cursor.value.to });
            }
        }
      }
      newState = { matches, currentMatchIndex: matches.length > 0 ? 0 : -1 };
    }

    for (const effect of tr.effects) {
       if (effect.is(setCurrentMatch)) {
        const index = effect.value;
        if (index >= 0 && index < newState.matches.length) {
          newState = { ...newState, currentMatchIndex: index };
        }
      }
    }
    
    return newState;
  },
});


// ============================================================================
// DECORATIONS
// ============================================================================

const searchMatchDecoration = Decoration.mark({
  class: 'cm-search-match',
});

const currentSearchMatchDecoration = Decoration.mark({
  class: 'cm-search-match-current',
});

function getSearchDecorations(state: SearchState, query: SearchQuery): DecorationSet {
  if (!query.source || state.matches.length === 0) {
    return Decoration.none;
  }

  const decorations = state.matches.map((match, index) => {
    const decoration =
      index === state.currentMatchIndex
        ? currentSearchMatchDecoration
        : searchMatchDecoration;
    return decoration.range(match.from, match.to);
  });

  return Decoration.set(decorations);
}

const searchDecorationsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      const state = view.state.field(searchStateField);
      const query = getSearchQuery(view.state);
      this.decorations = getSearchDecorations(state, query);
    }

    update(update: ViewUpdate) {
        const state = update.state.field(searchStateField);
        const query = getSearchQuery(update.state);
        const oldState = update.startState.field(searchStateField);
        const oldQuery = getSearchQuery(update.startState);
        
        if (state !== oldState || query !== oldQuery) {
            this.decorations = getSearchDecorations(state, query);
        }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);


// ============================================================================
// THEME
// ============================================================================

export const searchHighlightTheme = EditorView.baseTheme({
  '.cm-search-match': {
    backgroundColor: '#ffd54f',
    borderRadius: '2px',
  },
  '.cm-search-match-current': {
    backgroundColor: '#ff9800',
    borderRadius: '2px',
    fontWeight: 'bold',
  },
});

// ============================================================================
// PUBLIC API
// ============================================================================

export interface SearchAPI {
  /** Set search query and highlight all matches */
  setQuery: (query: string) => void;
  /** Navigate to next match */
  nextMatch: () => void;
  /** Navigate to previous match */
  prevMatch: () => void;
  /** Clear search */
  clearSearch: () => void;
  /** Get current state */
  getState: () => SearchState & { query: string };
}

export function createSearchAPI(view: EditorView): SearchAPI {
  return {
    setQuery(query: string) {
       view.dispatch({
        effects: setSearchQuery.of(new SearchQuery({ search: query, caseSensitive: false }))
      });

      // Scroll to first match
      setTimeout(() => {
        const state = view.state.field(searchStateField);
        if (state.matches.length > 0) {
          const firstMatch = state.matches[0];
          view.dispatch({
            effects: EditorView.scrollIntoView(firstMatch.from, { y: 'center' }),
            selection: { anchor: firstMatch.from, head: firstMatch.to },
          });
        }
      }, 0);
    },

    nextMatch() {
      const state = view.state.field(searchStateField);
      if (state.matches.length === 0) return;

      const nextIndex = (state.currentMatchIndex + 1) % state.matches.length;
      const match = state.matches[nextIndex];

      view.dispatch({
        effects: [
          setCurrentMatch.of(nextIndex),
          EditorView.scrollIntoView(match.from, { y: 'center' }),
        ],
        selection: { anchor: match.from, head: match.to },
      });
    },

    prevMatch() {
      const state = view.state.field(searchStateField);
      if (state.matches.length === 0) return;

      const prevIndex = (state.currentMatchIndex - 1 + state.matches.length) % state.matches.length;
      const match = state.matches[prevIndex];

      view.dispatch({
        effects: [
          setCurrentMatch.of(prevIndex),
          EditorView.scrollIntoView(match.from, { y: 'center' }),
        ],
        selection: { anchor: match.from, head: match.to },
      });
    },

    clearSearch() {
        view.dispatch({
            effects: setSearchQuery.of(new SearchQuery({ search: '' }))
        });
    },

    getState() {
      return {
        ...view.state.field(searchStateField),
        query: getSearchQuery(view.state).source
      };
    },
  };
}

// ============================================================================
// EXTENSION
// ============================================================================

export function searchHighlight(): Extension {
  return [
    searchStateField,
    searchDecorationsPlugin,
    searchHighlightTheme,
    search({
        top: true,
    })
  ];
}

