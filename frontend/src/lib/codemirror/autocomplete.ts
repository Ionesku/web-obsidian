/**
 * Autocomplete provider for wiki-style links
 */
import {
  Completion,
  CompletionContext,
  CompletionResult,
  autocompletion,
} from '@codemirror/autocomplete';
import { notesDB } from '../db';

/**
 * Check if cursor is inside wiki link brackets
 */
function isInsideWikiLink(context: CompletionContext): { inside: boolean; start: number } {
  const line = context.state.doc.lineAt(context.pos);
  const lineText = line.text;
  const posInLine = context.pos - line.from;
  
  // Check for [[ before cursor and ]] after or no ]] yet
  const beforeCursor = lineText.slice(0, posInLine);
  const afterCursor = lineText.slice(posInLine);
  
  // Find last [[ before cursor
  const lastOpenBracket = beforeCursor.lastIndexOf('[[');
  if (lastOpenBracket === -1) {
    return { inside: false, start: -1 };
  }
  
  // Check if there's a ]] between [[ and cursor
  const textBetween = beforeCursor.slice(lastOpenBracket);
  if (textBetween.includes(']]')) {
    return { inside: false, start: -1 };
  }
  
  // We're inside wiki link
  return { inside: true, start: line.from + lastOpenBracket + 2 };
}

/**
 * Create completion items from notes
 */
async function createCompletions(query: string): Promise<Completion[]> {
  try {
    const notes = await notesDB.searchNotesByTitle(query);
    
    return notes.map((note) => ({
      label: note.title,
      type: 'text',
      apply: note.title,
      info: note.content.slice(0, 100) + (note.content.length > 100 ? '...' : ''),
      detail: `${note.tags?.join(', ') || 'No tags'}`,
    }));
  } catch (error) {
    console.error('Error fetching notes for autocomplete:', error);
    return [];
  }
}

/**
 * Wiki link autocomplete function
 */
async function wikiLinkCompletions(context: CompletionContext): Promise<CompletionResult | null> {
  const linkInfo = isInsideWikiLink(context);
  
  if (!linkInfo.inside) {
    return null;
  }
  
  // Get the text between [[ and cursor
  const query = context.state.doc.sliceString(linkInfo.start, context.pos);
  
  // Fetch matching notes
  const completions = await createCompletions(query);
  
  if (completions.length === 0) {
    return null;
  }
  
  return {
    from: linkInfo.start,
    options: completions,
    validFor: /^[\w\s-]*$/,
  };
}

/**
 * Create autocomplete extension
 */
export function wikiLinkAutocomplete() {
  return autocompletion({
    override: [wikiLinkCompletions],
    activateOnTyping: true,
    maxRenderedOptions: 10,
    defaultKeymap: true,
  });
}

/**
 * Insert wiki link at cursor
 */
export function insertWikiLink(view: any, noteTitle: string): void {
  const { state } = view;
  const { from, to } = state.selection.main;
  
  view.dispatch({
    changes: { from, to, insert: `[[${noteTitle}]]` },
    selection: { anchor: from + noteTitle.length + 4 },
  });
}

/**
 * Insert transclusion at cursor
 */
export function insertTransclusion(view: any, noteTitle: string): void {
  const { state } = view;
  const { from, to } = state.selection.main;
  
  view.dispatch({
    changes: { from, to, insert: `![[${noteTitle}]]` },
    selection: { anchor: from + noteTitle.length + 5 },
  });
}

