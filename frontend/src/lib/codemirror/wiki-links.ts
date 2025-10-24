/**
 * Wiki-style links extension for CodeMirror
 * Supports [[note]] syntax with syntax highlighting
 */
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

/**
 * Regular expressions for wiki links
 */
const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g;
const TRANSCLUSION_REGEX = /!\[\[([^\]]+)\]\]/g;

/**
 * Parse document for wiki links
 */
export function findWikiLinks(doc: string) {
  const links: Array<{ text: string; from: number; to: number; isTransclusion: boolean }> = [];
  
  // Find regular wiki links
  let match;
  while ((match = WIKI_LINK_REGEX.exec(doc)) !== null) {
    links.push({
      text: match[1],
      from: match.index,
      to: match.index + match[0].length,
      isTransclusion: false,
    });
  }
  
  // Find transclusions
  TRANSCLUSION_REGEX.lastIndex = 0;
  while ((match = TRANSCLUSION_REGEX.exec(doc)) !== null) {
    links.push({
      text: match[1],
      from: match.index,
      to: match.index + match[0].length,
      isTransclusion: true,
    });
  }
  
  return links.sort((a, b) => a.from - b.from);
}

/**
 * Wiki link decoration
 */
const wikiLinkDecoration = Decoration.mark({
  class: 'cm-wiki-link',
  attributes: {
    style: 'color: #3b82f6; font-weight: 500; cursor: pointer;'
  }
});

const wikiLinkBracketDecoration = Decoration.mark({
  class: 'cm-wiki-link-bracket',
  attributes: {
    style: 'color: #9ca3af; opacity: 0.6;'
  }
});

const transclusionDecoration = Decoration.mark({
  class: 'cm-transclusion',
  attributes: {
    style: 'color: #8b5cf6; font-weight: 500; background: rgba(139, 92, 246, 0.1); padding: 2px 4px; border-radius: 3px;'
  }
});

/**
 * Create decorations for wiki links
 */
function createWikiLinkDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc.toString();
  const links = findWikiLinks(doc);
  
  for (const link of links) {
    if (link.isTransclusion) {
      // Style transclusions
      builder.add(link.from, link.from + 3, wikiLinkBracketDecoration); // ![[
      builder.add(link.from + 3, link.to - 2, transclusionDecoration); // note name
      builder.add(link.to - 2, link.to, wikiLinkBracketDecoration); // ]]
    } else {
      // Style regular wiki links
      builder.add(link.from, link.from + 2, wikiLinkBracketDecoration); // [[
      builder.add(link.from + 2, link.to - 2, wikiLinkDecoration); // note name
      builder.add(link.to - 2, link.to, wikiLinkBracketDecoration); // ]]
    }
  }
  
  return builder.finish();
}

/**
 * Wiki link view plugin
 */
export const wikiLinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = createWikiLinkDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = createWikiLinkDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

/**
 * Theme for wiki links
 */
export const wikiLinkTheme = EditorView.baseTheme({
  '.cm-wiki-link': {
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  '.cm-wiki-link-bracket': {
    fontSize: '0.9em',
  },
  '.cm-transclusion': {
    display: 'inline-block',
  },
});

/**
 * Get wiki link at cursor position
 */
export function getWikiLinkAtPos(view: EditorView, pos: number): string | null {
  const doc = view.state.doc.toString();
  const links = findWikiLinks(doc);
  
  for (const link of links) {
    if (pos >= link.from && pos <= link.to) {
      return link.text;
    }
  }
  
  return null;
}

/**
 * Handle wiki link clicks
 */
export function handleWikiLinkClick(
  view: EditorView,
  pos: number,
  onLinkClick: (noteTitle: string) => void
): boolean {
  const linkText = getWikiLinkAtPos(view, pos);
  if (linkText) {
    onLinkClick(linkText);
    return true;
  }
  return false;
}

