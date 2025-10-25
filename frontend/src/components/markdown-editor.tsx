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
  debug = false,
  onAutosaveStatusChange,
  className = '',
}: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  
  // Use refs to avoid recreating editor extensions on every change
  const onSaveRef = useRef(onSave);
  const onChangeRef = useRef(onChange);
  
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Use production-grade autosave hook
  const { save: autosaveContent, status, lastSaved, error, forceFlush, reset } = useAutosave({
    onSave: async (content) => {
      if (onSaveRef.current) {
        await onSaveRef.current(content);
      }
      return {}; // Could return { etag } if backend supports it
    },
    debounceMs: autoSaveDelay,
    maxWaitMs: 5000, // Force save after 5 seconds of continuous typing
    enabled: autoSave,
    debug,
  });

  // Reset to "saved" status when loading a file from server
  useEffect(() => {
    if (initialContent) {
      reset();
    }
  }, [noteId, reset]);

  // Notify parent of autosave status changes
  useEffect(() => {
    if (onAutosaveStatusChange) {
      onAutosaveStatusChange({ status, lastSaved, error });
    }
  }, [status, lastSaved, error, onAutosaveStatusChange]);

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
          keydown: (event, view) => {
            // Prevent browser's "Save Page" dialog on Ctrl/Cmd+S
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
              event.preventDefault();
              return false; // Let CodeMirror's keymap handle it
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
            if (onChangeRef.current) {
              onChangeRef.current(content);
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
    [autosaveContent, forceFlush]
  );

  /**
   * Initialize editor
   */
  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: initialContent,
      extensions: createExtensions(vimMode || false),
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
   * Update editor when vim mode changes
   */
  useEffect(() => {
    if (!viewRef.current) return;

    const content = viewRef.current.state.doc.toString();

    // Recreate editor with new vim mode
    const state = EditorState.create({
      doc: content,
      extensions: createExtensions(vimMode || false),
    });

    viewRef.current.setState(state);
  }, [vimMode, createExtensions]);

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
      {/* Editor */}
      <div ref={editorRef} className="h-full overflow-hidden" />
    </div>
  );
}

export default MarkdownEditor;

