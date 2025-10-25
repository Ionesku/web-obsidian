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
  autoSaveDelay = 2000,
  className = '',
}: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isVimMode, setIsVimMode] = useState(vimMode);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Auto-save function
   */
  const autoSaveContent = useCallback(
    async (content: string) => {
      if (!autoSave || !noteId) return;

      setIsSaving(true);
      try {
        await notesDB.saveNote({
          id: noteId,
          title: '', // Should be provided from parent
          content,
        });
        onSave?.(content);
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsSaving(false);
      }
    },
    [autoSave, noteId, onSave]
  );

  /**
   * Debounced auto-save
   */
  const debouncedAutoSave = useCallback(
    (content: string) => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setTimeout(() => {
        autoSaveContent(content);
      }, autoSaveDelay);
    },
    [autoSaveContent, autoSaveDelay]
  );

  /**
   * Create editor extensions
   */
  const createExtensions = useCallback(
    (vimEnabled: boolean): Extension[] => {
      const extensions: Extension[] = [
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

        // Markdown support
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
            onChange?.(content);
            debouncedAutoSave(content);
          }
        }),

        // Line wrapping
        EditorView.lineWrapping,
      ];

      // Add Vim mode if enabled
      if (vimEnabled) {
        extensions.push(vim());
      }

      return extensions;
    },
    [onChange, debouncedAutoSave]
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
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [initialContent, isVimMode, createExtensions]);

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
   * Manual save
   */
  const handleSave = useCallback(() => {
    if (viewRef.current) {
      const content = viewRef.current.state.doc.toString();
      autoSaveContent(content);
    }
  }, [autoSaveContent]);

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

        <div className="flex items-center gap-2 text-sm text-gray-600">
          {isSaving && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              Saving...
            </span>
          )}
        </div>
      </div>

      {/* Editor */}
      <div ref={editorRef} className="h-[calc(100%-48px)] overflow-hidden" />
    </div>
  );
}

export default MarkdownEditor;

