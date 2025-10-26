/**
 * CodeMirror 6 Search Highlighting Extension
 * 
 * Provides search functionality with highlighting and navigation
 */

import { Extension, StateField, StateEffect } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { SearchCursor } from '@codemirror/search';

// ============================================================================
// STATE EFFECTS
// ============================================================================

export const setSearchQuery = StateEffect.define<string>();
export const setCurrentMatch = StateEffect.define<number>();

// ============================================================================
// STATE FIELD
// ============================================================================

interface SearchState {
  query: string;
  matches: { from: number; to: number }[];
  currentMatchIndex: number;
}

function buildCursor(doc: any, query: string) {
  if (!query) return null;
  // Экранируем спецсимволы и собираем регистронезависимый regex
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(safe, 'gi');
  return new SearchCursor(doc, rx, 0);
}

const searchStateField = StateField.define<SearchState>({
  create() {
    return {
      query: '',
      matches: [],
      currentMatchIndex: -1,
    };
  },

  update(state, tr) {
    let newState = state;

    for (const effect of tr.effects) {
      if (effect.is(setSearchQuery)) {
        const query = effect.value.trim();
        if (query.length < 2) {
          newState = { query: '', matches: [], currentMatchIndex: -1 };
        } else {
            const cur = buildCursor(tr.state.doc, query);
            const matches: {from:number; to:number}[] = [];
            if (cur) {
                while (cur.next()) {
                    if (cur.value.from !== cur.value.to) { // ensure match is not empty
                        matches.push({ from: cur.value.from, to: cur.value.to });
                    }
                }
            }
            newState = { query, matches, currentMatchIndex: matches.length ? 0 : -1 };
        }
      } else if (effect.is(setCurrentMatch)) {
        const index = effect.value;
        if (index >= 0 && index < state.matches.length) {
          newState = { ...state, currentMatchIndex: index };
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

function getSearchDecorations(state: SearchState): DecorationSet {
  if (state.query === '' || state.matches.length === 0) {
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
      this.decorations = getSearchDecorations(view.state.field(searchStateField));
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.transactions.some((tr) => tr.effects.length > 0)) {
        this.decorations = getSearchDecorations(update.state.field(searchStateField));
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
  getState: () => SearchState;
}

export function createSearchAPI(view: EditorView): SearchAPI {
  return {
    setQuery(query: string) {
      view.dispatch({
        effects: setSearchQuery.of(query),
      });

      // Scroll to first match if exists
      if (query) {
        setTimeout(() => {
          const state = view.state.field(searchStateField);
          if (state.matches.length > 0) {
            const firstMatch = state.matches[0];
            view.dispatch({
              effects: EditorView.scrollIntoView(firstMatch.from, {
                y: 'center',
              }),
              selection: { anchor: firstMatch.from, head: firstMatch.to },
            });
          }
        }, 0);
      }
    },

    nextMatch() {
      const state = view.state.field(searchStateField);
      if (state.matches.length === 0) return;

      const nextIndex = (state.currentMatchIndex + 1) % state.matches.length;
      const match = state.matches[nextIndex];

      view.dispatch({
        effects: [
          setCurrentMatch.of(nextIndex),
          EditorView.scrollIntoView(match.from, {
            y: 'center',
          }),
        ],
        selection: { anchor: match.from, head: match.to },
      });
    },

    prevMatch() {
      const state = view.state.field(searchStateField);
      if (state.matches.length === 0) return;

      const prevIndex =
        (state.currentMatchIndex - 1 + state.matches.length) % state.matches.length;
      const match = state.matches[prevIndex];

      view.dispatch({
        effects: [
          setCurrentMatch.of(prevIndex),
          EditorView.scrollIntoView(match.from, {
            y: 'center',
          }),
        ],
        selection: { anchor: match.from, head: match.to },
      });
    },

    clearSearch() {
      view.dispatch({
        effects: setSearchQuery.of(''),
      });
    },

    getState() {
      return view.state.field(searchStateField);
    },
  };
}

// ============================================================================
// EXTENSION
// ============================================================================

export function searchHighlight(): Extension {
  return [searchStateField, searchDecorationsPlugin, searchHighlightTheme];
}

