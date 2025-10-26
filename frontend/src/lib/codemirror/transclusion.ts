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
import { RangeSetBuilder, StateField, StateEffect } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
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

/**
 * Load transclusion content
 */
async function loadTransclusion(noteTitle: string): Promise<string | null> {
  if (transclusionCache.has(noteTitle)) {
    return transclusionCache.get(noteTitle)!;
  }

  try {
    const note = await notesDB.getNoteByTitle(noteTitle);
    const content = note?.content || null;
    transclusionCache.set(noteTitle, content);
    return content;
  } catch (error) {
    console.error('Error loading transclusion:', error);
    transclusionCache.set(noteTitle, null);
    return null;
  }
}

// This state field will hold our decorations
const transclusionDecorations = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, transaction) {
    // Handle changes and effects here
    if (transaction.docChanged) {
      // If doc changed, we might need to re-evaluate transclusions
      // This can be optimized, but for now, let's just clear
      return Decoration.none; 
    }
    for (let effect of transaction.effects) {
      if (effect.is(addTransclusionEffect)) {
        return decorations.update({ add: effect.value, sort: true });
      }
    }
    return decorations;
  }
});

// An effect to add our decorations
const addTransclusionEffect = StateEffect.define<Decoration[]>();


function findTransclusions(view: EditorView) {
  const decorations: Decoration[] = [];
  const doc = view.state.doc;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name.includes('Transclusion')) { // Assuming your syntax highlighting marks this up
          const line = doc.lineAt(node.from);
          const text = doc.sliceString(node.from, node.to);
          const match = /!\[\[([^\]]+)\]\]/.exec(text);
          if (match) {
            const noteTitle = match[1];

            // Replace the entire line
            const deco = Decoration.replace({
              widget: new TransclusionWidget(noteTitle, null, true), // Start with loading state
            });
            decorations.push(deco.range(line.from, line.to));

            // Asynchronously load content and update the widget
            loadTransclusion(noteTitle).then(content => {
              const newDeco = Decoration.replace({
                widget: new TransclusionWidget(noteTitle, content, false),
              });
              
              // We need to find the line again as the doc could have changed
              const currentDoc = view.state.doc.toString();
              const newMatchPos = currentDoc.indexOf(text);

              if (newMatchPos !== -1) {
                 const newLine = view.state.doc.lineAt(newMatchPos);
                 view.dispatch({
                    effects: addTransclusionEffect.of([newDeco.range(newLine.from, newLine.to)])
                 });
              }
            });
          }
        }
      },
    });
  }
  return decorations;
}


/**
 * Transclusion view plugin
 */
export const transclusionPlugin = ViewPlugin.fromClass(
  class {
    constructor(view: EditorView) {
      this.updateDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.updateDecorations(update.view);
      }
    }
    
    updateDecorations(view: EditorView) {
        const decorations = findTransclusions(view);
        view.dispatch({
            effects: addTransclusionEffect.of(decorations)
        });
    }

    destroy() {}
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

