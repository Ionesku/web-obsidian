/**
 * CodeMirror 6 Search Highlighting Extension
 * 
 * Provides search functionality with highlighting and navigation
 */

import { Extension, StateField, StateEffect } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { search, getSearchQuery, SearchQuery, setSearchQuery } from '@codemirror/search';

// ============================================================================
// STATE: For tracking the CURRENT match index
// ============================================================================

export const setCurrentMatch = StateEffect.define<number>();

const searchStateField = StateField.define<{ currentMatchIndex: number }>({
  create() {
    return { currentMatchIndex: -1 };
  },
  update(state, tr) {
    const query = getSearchQuery(tr.state);
    const oldQuery = getSearchQuery(tr.startState);

    // Reset index if the query changes or is cleared
    if (query.source !== oldQuery.source) {
      return { currentMatchIndex: query.source ? 0 : -1 };
    }

    for (const effect of tr.effects) {
      if (effect.is(setCurrentMatch)) {
        return { currentMatchIndex: effect.value };
      }
    }

    return state;
  },
});

// ============================================================================
// PLUGIN: To highlight ONLY the CURRENT match
// ============================================================================

const currentMatchHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.getDecorations(view);
    }

    update(update: ViewUpdate) {
      const queryChanged = getSearchQuery(update.startState).source !== getSearchQuery(update.state).source;
      const currentIndexChanged = update.startState.field(searchStateField).currentMatchIndex !== update.state.field(searchStateField).currentMatchIndex;

      if (update.docChanged || queryChanged || currentIndexChanged) {
        this.decorations = this.getDecorations(update.view);
      }
    }

    getDecorations(view: EditorView): DecorationSet {
      const { currentMatchIndex } = view.state.field(searchStateField);
      if (currentMatchIndex < 0) return Decoration.none;

      const query = getSearchQuery(view.state);
      if (!query.source) return Decoration.none;

      const matches = [];
      const cursor = query.getCursor(view.state.doc);
      for (let i = 0; !cursor.done && i <= currentMatchIndex; i++) {
          cursor.next();
          if (i === currentMatchIndex && !cursor.done) {
            matches.push(Decoration.mark({ class: 'cm-searchMatch-current' }).range(cursor.value.from, cursor.value.to));
          }
      }

      return Decoration.set(matches);
    }
  },
  {
    decorations: v => v.decorations,
  }
);


// ============================================================================
// THEME
// ============================================================================

export const searchHighlightTheme = EditorView.baseTheme({
  // Default match style from @codemirror/search
  '.cm-searchMatch': {
    backgroundColor: '#ffd54f80', // yellow with some transparency
  },
  // Style for the currently selected match via our plugin
  '.cm-searchMatch-current': {
    backgroundColor: '#ff9800', // more prominent orange
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
  getState: () => { query: string; matches: number; currentMatchIndex: number };
}


export function createSearchAPI(view: EditorView): SearchAPI {
    const getMatches = () => {
        const query = getSearchQuery(view.state);
        const matches = [];
        if (query.source) {
            const cursor = query.getCursor(view.state.doc);
            while (cursor.next()) {
                if(cursor.value.from !== cursor.value.to) {
                    matches.push({ from: cursor.value.from, to: cursor.value.to });
                }
            }
        }
        return matches;
    };

    return {
        setQuery(query: string) {
            view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: query, caseSensitive: false })) });
            
            setTimeout(() => {
                const matches = getMatches();
                if (matches.length > 0) {
                    view.dispatch({
                        effects: EditorView.scrollIntoView(matches[0].from, { y: 'center' }),
                        selection: { anchor: matches[0].from, head: matches[0].to },
                    });
                }
            }, 0);
        },

        nextMatch() {
            const matches = getMatches();
            if (matches.length === 0) return;
            const { currentMatchIndex } = view.state.field(searchStateField);
            const nextIndex = (currentMatchIndex + 1) % matches.length;
            const match = matches[nextIndex];

            view.dispatch({
                effects: [
                    setCurrentMatch.of(nextIndex),
                    EditorView.scrollIntoView(match.from, { y: 'center' }),
                ],
                selection: { anchor: match.from, head: match.to },
            });
        },

        prevMatch() {
            const matches = getMatches();
            if (matches.length === 0) return;
            const { currentMatchIndex } = view.state.field(searchStateField);
            const prevIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
            const match = matches[prevIndex];

            view.dispatch({
                effects: [
                    setCurrentMatch.of(prevIndex),
                    EditorView.scrollIntoView(match.from, { y: 'center' }),
                ],
                selection: { anchor: match.from, head: match.to },
            });
        },

        clearSearch() {
            view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: '' })) });
        },

        getState() {
            const matches = getMatches();
            const state = view.state.field(searchStateField);
            return {
                query: getSearchQuery(view.state).source,
                matches: matches.length,
                currentMatchIndex: state.currentMatchIndex,
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
    searchStateField,
    currentMatchHighlighter,
    searchHighlightTheme,
  ];
}

