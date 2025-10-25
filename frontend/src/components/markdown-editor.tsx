'use client';

/**
 * CodeMirror 6 Markdown Editor with Wiki Links and Transclusion
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { EditorState, Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldKeymap,
} from '@codemirror/language';
import {
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { markdown } from '@codemirror/lang-markdown';
import { vim } from '@replit/codemirror-vim';

// Custom extensions
import { wikiLinkPlugin, wikiLinkTheme, handleWikiLinkClick } from '@/lib/codemirror/wiki-links';
import { wikiLinkAutocomplete } from '@/lib/codemirror/autocomplete';
import { transclusionPlugin, transclusionTheme } from '@/lib/codemirror/transclusion';
import { tagPlugin, tagTheme, handleTagClick } from '@/lib/codemirror/tags';
import { notesDB } from '@/lib/db';
import type { EditorProps } from '@/lib/codemirror/types';
import { useAutosave } from '@/hooks/useAutosave';
import { SaveStatusIndicator } from '@/components/SaveStatusIndicator';

/**
 * Main Markdown Editor Component
 */
export function MarkdownEditor({
  initialContent = '',
  noteId,
  onSave,
  onChange,
  onWikiLinkClick,
  onTagClick,
  vimMode = false,
  autoSave = true,
  autoSaveDelay = 500,
  className = '',
}: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isVimMode, setIsVimMode] = useState(vimMode);

  // Use production-grade autosave hook
  const { save: autosaveContent, status, lastSaved, error, forceFlush } = useAutosave({
    onSave: async (content) => {
      if (onSave) {
        await onSave(content);
      }
      return {}; // Could return { etag } if backend supports it
    },
    debounceMs: autoSaveDelay,
    maxWaitMs: 5000, // Force save after 5 seconds of continuous typing
    enabled: autoSave,
  });

  /**
   * Create editor extensions
   */
  const createExtensions = useCallback(
    (vimEnabled: boolean): Extension[] => {
      const extensions: Extension[] = [
        // Make editor editable
        EditorView.editable.of(true),
        EditorState.readOnly.of(false),
        
        // Basic setup
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        closeBrackets(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),

        // Keymaps
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
        ]),

        // Markdown support with code blocks
        markdown(),

        // Custom extensions
        wikiLinkPlugin,
        wikiLinkTheme,
        wikiLinkAutocomplete(),
        transclusionPlugin,
        transclusionTheme,
        tagPlugin,
        tagTheme,

        // Click handler for wiki links and tags
        EditorView.domEventHandlers({
          click: (event, view) => {
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos === null) return false;

            // Ctrl/Cmd+Click for wiki links
            if ((event.ctrlKey || event.metaKey) && onWikiLinkClick) {
              const handled = handleWikiLinkClick(view, pos, onWikiLinkClick);
              if (handled) {
                event.preventDefault();
                return true;
              }
            }

            // Regular click for tags
            if (onTagClick) {
              const handled = handleTagClick(view, pos, onTagClick);
              if (handled) {
                event.preventDefault();
                return true;
              }
            }

            return false;
          },
        }),

        // Editor theme
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '14px',
            fontFamily: 'monospace',
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          },
          '.cm-content': {
            padding: '12px 0',
            caretColor: '#3b82f6',
          },
          '.cm-line': {
            padding: '0 12px',
            lineHeight: '1.6',
          },
          '.cm-activeLine': {
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
          },
          '.cm-gutters': {
            backgroundColor: '#f9fafb',
            border: 'none',
            color: '#9ca3af',
          },
          '.cm-foldPlaceholder': {
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid #3b82f6',
            color: '#3b82f6',
          },
        }),

        // Update callback
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const content = update.state.doc.toString();
            // Call onChange immediately
            if (onChange) {
              onChange(content);
            }
            // Production-grade autosave with maxWait, dedup, retry, etc.
            autosaveContent(content);
          }
        }),

        // Keyboard shortcuts
        keymap.of([
          {
            key: 'Mod-s',
            run: (view) => {
              const content = view.state.doc.toString();
              forceFlush(); // Immediate save on Ctrl/Cmd+S
              return true;
            },
          },
        ]),

        // Line wrapping
        EditorView.lineWrapping,
      ];

      // Add Vim mode if enabled
      if (vimEnabled) {
        extensions.push(vim());
      }

      return extensions;
    },
    [onChange, autosaveContent, forceFlush]
  );

  /**
   * Initialize editor
   */
  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: initialContent,
      extensions: createExtensions(isVimMode),
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent]);

  // Save on blur
  useEffect(() => {
    const handleBlur = () => {
      if (viewRef.current) {
        const content = viewRef.current.state.doc.toString();
        autosaveContent(content, true); // Immediate save
      }
    };

    const editorElement = editorRef.current;
    if (editorElement) {
      editorElement.addEventListener('blur', handleBlur, true);
      return () => {
        editorElement.removeEventListener('blur', handleBlur, true);
      };
    }
  }, [autosaveContent]);

  /**
   * Toggle Vim mode
   */
  const toggleVimMode = useCallback(() => {
    if (!viewRef.current) return;

    const content = viewRef.current.state.doc.toString();
    const newVimMode = !isVimMode;

    // Recreate editor with new vim mode
    const state = EditorState.create({
      doc: content,
      extensions: createExtensions(newVimMode),
    });

    viewRef.current.setState(state);
    setIsVimMode(newVimMode);
  }, [isVimMode, createExtensions]);

  /**
   * Get current content
   */
  const getContent = useCallback(() => {
    return viewRef.current?.state.doc.toString() || '';
  }, []);

  /**
   * Set content programmatically
   */
  const setContent = useCallback((content: string) => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      changes: {
        from: 0,
        to: viewRef.current.state.doc.length,
        insert: content,
      },
    });
  }, []);

  return (
    <div className={`relative h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleVimMode}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              isVimMode
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title="Toggle Vim keybindings"
          >
            {isVimMode ? '✓ Vim' : 'Vim'}
          </button>
        </div>

        <SaveStatusIndicator status={status} lastSaved={lastSaved} error={error} />
      </div>

      {/* Editor */}
      <div ref={editorRef} className="h-[calc(100%-48px)] overflow-hidden" />
    </div>
  );
}

export default MarkdownEditor;

