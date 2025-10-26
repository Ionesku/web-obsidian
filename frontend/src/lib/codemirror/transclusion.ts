/**
 * Note transclusion extension for CodeMirror
 * Supports ![[note]] syntax with live preview
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
import { notesDB } from '../db';

/**
 * Widget for displaying transcluded note content
 */
class TransclusionWidget extends WidgetType {
  constructor(
    public noteTitle: string,
    public noteContent: string | null,
    public isLoading: boolean = false
  ) {
    super();
  }

  eq(other: TransclusionWidget) {
    return (
      other.noteTitle === this.noteTitle &&
      other.noteContent === this.noteContent &&
      other.isLoading === this.isLoading
    );
  }

  toDOM() {
    const container = document.createElement('div');
    container.className = 'cm-transclusion-widget';
    container.style.cssText = `
      margin: 8px 0;
      padding: 12px;
      background: rgba(139, 92, 246, 0.05);
      border-left: 3px solid #8b5cf6;
      border-radius: 4px;
      font-size: 0.95em;
    `;

    if (this.isLoading) {
      container.innerHTML = `
        <div style="color: #9ca3af; font-style: italic;">
          Loading "${this.noteTitle}"...
        </div>
      `;
    } else if (this.noteContent === null) {
      container.innerHTML = `
        <div style="color: #ef4444; font-weight: 500;">
          Note not found: "${this.noteTitle}"
        </div>
      `;
    } else {
      const header = document.createElement('div');
      header.style.cssText = `
        font-weight: 600;
        color: #8b5cf6;
        margin-bottom: 8px;
        font-size: 0.9em;
      `;
      header.textContent = `📄 ${this.noteTitle}`;

      const content = document.createElement('div');
      content.style.cssText = `
        color: #374151;
        line-height: 1.6;
        max-height: 200px;
        overflow-y: auto;
        white-space: pre-wrap;
      `;
      
      // Simple markdown rendering (you can enhance this)
      const renderedContent = this.renderMarkdown(this.noteContent);
      content.innerHTML = renderedContent;

      container.appendChild(header);
      container.appendChild(content);
    }

    return container;
  }

  /**
   * Simple markdown rendering
   * For a real app, use a proper markdown library like marked or remark
   */
  private renderMarkdown(content: string): string {
    let html = content
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers
      .replace(/^### (.*$)/gim, '<h3 style="font-size: 1.1em; font-weight: 600; margin: 8px 0;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="font-size: 1.2em; font-weight: 600; margin: 8px 0;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="font-size: 1.3em; font-weight: 700; margin: 8px 0;">$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Code
      .replace(/`(.+?)`/g, '<code style="background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>')
      // Links (but not wiki links)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #3b82f6; text-decoration: underline;">$1</a>');
    
    return html;
  }

  ignoreEvent() {
    return false;
  }
}

/**
 * Cache for loaded transclusions
 */
const transclusionCache = new Map<string, string | null>();
const pendingTransclusions = new Set<string>();

/**
 * Load transclusion content and trigger a view update upon completion.
 */
async function loadTransclusion(noteTitle: string, view: EditorView): Promise<void> {
  if (transclusionCache.has(noteTitle) || pendingTransclusions.has(noteTitle)) {
    return;
  }

  pendingTransclusions.add(noteTitle);

  try {
    const note = await notesDB.getNoteByTitle(noteTitle);
    const content = note?.content || null;
    transclusionCache.set(noteTitle, content);
  } catch (error) {
    console.error('Error loading transclusion:', error);
    transclusionCache.set(noteTitle, null); // Cache failure
  } finally {
    pendingTransclusions.delete(noteTitle);
    // Dispatch an empty transaction to trigger a view update.
    // Use setTimeout to ensure it runs after the current update cycle.
    setTimeout(() => view.dispatch({}), 0);
  }
}

/**
 * Builds the decoration set for transclusions found in the visible ranges of the editor.
 */
function buildTransclusionDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const decoratedLines = new Set<number>();

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      if (decoratedLines.has(line.number)) {
        pos = line.to + 1;
        continue;
      }

      const text = line.text;
      // Find the first transclusion on the line
      const match = /!\[\[([^\]]+)\]\]/.exec(text);

      if (match) {
        const noteTitle = match[1];
        let widget;

        if (transclusionCache.has(noteTitle)) {
          // Content is cached, display it
          widget = new TransclusionWidget(noteTitle, transclusionCache.get(noteTitle)!, false);
        } else {
          // Content not cached, show loading state and start loading
          widget = new TransclusionWidget(noteTitle, null, true);
          loadTransclusion(noteTitle, view);
        }
        
        const deco = Decoration.replace({ widget });
        builder.add(line.from, line.to, deco);
        decoratedLines.add(line.number);
      }

      pos = line.to + 1;
    }
  }

  return builder.finish();
}


/**
 * Transclusion view plugin
 */
export const transclusionPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildTransclusionDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || !this.decorations.size) {
        this.decorations = buildTransclusionDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

/**
 * Clear transclusion cache
 */
export function clearTransclusionCache() {
  transclusionCache.clear();
}

/**
 * Refresh transclusion for a specific note
 */
export function refreshTransclusion(noteTitle: string) {
  transclusionCache.delete(noteTitle);
}

/**
 * Theme for transclusions
 */
export const transclusionTheme = EditorView.baseTheme({
  '.cm-transclusion-widget': {
    display: 'block',
    userSelect: 'none',
  },
});


