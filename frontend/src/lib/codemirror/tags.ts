/**
 * Tags extension for CodeMirror
 * Supports #tag syntax with syntax highlighting and click handling
 */
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

/**
 * Regular expression for tags
 */
const TAG_REGEX = /#[\w\-\/]+/g;

/**
 * Parse document for tags
 */
export function findTags(doc: string) {
  const tags: Array<{ text: string; from: number; to: number }> = [];
  
  let match;
  while ((match = TAG_REGEX.exec(doc)) !== null) {
    // Don't match tags inside code blocks or headers
    const lineStart = doc.lastIndexOf('\n', match.index) + 1;
    const lineText = doc.substring(lineStart, match.index);
    
    // Skip if it's a header
    if (lineText.trim().startsWith('#')) {
      continue;
    }
    
    tags.push({
      text: match[0],
      from: match.index,
      to: match.index + match[0].length,
    });
  }
  
  return tags;
}

/**
 * Tag decoration
 */
const tagDecoration = Decoration.mark({
  class: 'cm-tag',
  attributes: {
    style: 'color: #10b981; font-weight: 500; cursor: pointer; background: rgba(16, 185, 129, 0.1); padding: 1px 4px; border-radius: 3px;'
  }
});

/**
 * Create decorations for tags
 */
function createTagDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc.toString();
  const tags = findTags(doc);
  
  for (const tag of tags) {
    builder.add(tag.from, tag.to, tagDecoration);
  }
  
  return builder.finish();
}

/**
 * Tag view plugin
 */
export const tagPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = createTagDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = createTagDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

/**
 * Theme for tags
 */
export const tagTheme = EditorView.baseTheme({
  '.cm-tag': {
    textDecoration: 'none',
    '&:hover': {
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
    },
  },
});

/**
 * Get tag at cursor position
 */
export function getTagAtPos(view: EditorView, pos: number): string | null {
  const doc = view.state.doc.toString();
  const tags = findTags(doc);
  
  for (const tag of tags) {
    if (pos >= tag.from && pos <= tag.to) {
      return tag.text;
    }
  }
  
  return null;
}

/**
 * Handle tag clicks
 */
export function handleTagClick(
  view: EditorView,
  pos: number,
  onTagClick: (tag: string) => void
): boolean {
  const tag = getTagAtPos(view, pos);
  if (tag) {
    onTagClick(tag);
    return true;
  }
  return false;
}

/**
 * Extract all tags from content
 */
export function extractTags(content: string): string[] {
  const tags = findTags(content);
  return Array.from(new Set(tags.map(t => t.text)));
}

