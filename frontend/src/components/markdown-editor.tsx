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
import { searchHighlight, createSearchAPI, type SearchAPI } from '@/lib/codemirror/search-highlight';
import { getLanguageSupport } from '@/lib/codemirror/code-languages';
import { obsidianTheme, obsidianSyntaxHighlighting } from '@/lib/codemirror/theme';
import { notesDB } from '@/lib/db';
import type { EditorProps } from '@/lib/codemirror/types';
import { useAutosave } from '@/hooks/useAutosave';
import { searchEngine } from '@/search/engine';

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
  searchQuery,
  onSearchStateChange,
}: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const searchAPIRef = useRef<SearchAPI | null>(null);
  
  // Use refs to avoid recreating editor extensions on every change
  const onSaveRef = useRef(onSave);
  const onChangeRef = useRef(onChange);
  const onWikiLinkClickRef = useRef(onWikiLinkClick);
  const onTagClickRef = useRef(onTagClick);
  
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  
  useEffect(() => {
    onWikiLinkClickRef.current = onWikiLinkClick;
  }, [onWikiLinkClick]);
  
  useEffect(() => {
    onTagClickRef.current = onTagClick;
  }, [onTagClick]);

  // Stable save handler - never changes reference
  const stableSaveHandler = useCallback(async (content: string) => {
    if (onSaveRef.current) {
      await onSaveRef.current(content);
    }
    
    return {}; // Could return { etag } if backend supports it
  }, [noteId]); // Include noteId in deps

  // Use production-grade autosave hook
  const { save: autosaveContent, status, lastSaved, error, forceFlush, reset } = useAutosave({
    onSave: stableSaveHandler,
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
        obsidianSyntaxHighlighting,
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

        // Markdown support with code blocks and language highlighting
        markdown({
          codeLanguages: (info) => {
            // Try to get language support for the code block language
            const languageSupport = getLanguageSupport(info);
            return languageSupport?.language || null;
          },
        }),

        // Custom extensions
        wikiLinkPlugin,
        wikiLinkTheme,
        wikiLinkAutocomplete(),
        transclusionPlugin,
        transclusionTheme,
        tagPlugin,
        tagTheme,
        searchHighlight(),

        // Click handler for wiki links and tags
        EditorView.domEventHandlers({
          click: (event, view) => {
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos === null) return false;

            // Ctrl/Cmd+Click for wiki links
            if ((event.ctrlKey || event.metaKey) && onWikiLinkClickRef.current) {
              const handled = handleWikiLinkClick(view, pos, onWikiLinkClickRef.current);
              if (handled) {
                event.preventDefault();
                return true;
              }
            }

            // Regular click for tags
            if (onTagClickRef.current) {
              const handled = handleTagClick(view, pos, onTagClickRef.current);
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
        obsidianTheme,

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
   * Initialize editor - should only run once per noteId
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
    
    // Create search API
    searchAPIRef.current = createSearchAPI(view);
    
    // Apply initial search query if provided
    if (searchQuery) {
      searchAPIRef.current.setQuery(searchQuery);
    }

    return () => {
      view.destroy();
      searchAPIRef.current = null;
    };
    // Only recreate editor when noteId changes (file switch), not on content changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, searchQuery]);

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
  
  // Handle search query changes
  useEffect(() => {
    if (searchAPIRef.current) {
      if (searchQuery) {
        searchAPIRef.current.setQuery(searchQuery);
        
        // Notify parent of state changes
        if (onSearchStateChange) {
          setTimeout(() => {
            if (searchAPIRef.current) {
              const state = searchAPIRef.current.getState();
              onSearchStateChange({
                query: state.query,
                matchCount: state.matches.length,
                currentMatch: state.currentMatchIndex + 1,
              });
            }
          }, 100); // Small delay to ensure state is updated
        }
      } else {
        searchAPIRef.current.clearSearch();
        if (onSearchStateChange) {
          onSearchStateChange({ query: '', matchCount: 0, currentMatch: 0 });
        }
      }
    }
  }, [searchQuery, onSearchStateChange]);
  
  // Handle F3/Shift+F3 navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if we have an active search
      if (!searchQuery || !searchAPIRef.current) return;
      
      // Navigate with F3 / Shift+F3
      if (e.key === 'F3') {
        e.preventDefault();
        e.stopPropagation();
        
        if (e.shiftKey) {
          searchAPIRef.current.prevMatch();
        } else {
          searchAPIRef.current.nextMatch();
        }
        
        // Update state after navigation
        if (onSearchStateChange) {
          setTimeout(() => {
            if (searchAPIRef.current) {
              const state = searchAPIRef.current.getState();
              onSearchStateChange({
                query: state.query,
                matchCount: state.matches.length,
                currentMatch: state.currentMatchIndex + 1,
              });
            }
          }, 10);
        }
      }
    };
    
    // Add event listener to window to catch F3 everywhere
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [searchQuery, onSearchStateChange]);

  /**
   * Update editor when vim mode changes
   * Don't depend on createExtensions to avoid unnecessary re-renders
   */
  const vimModeRef = useRef(vimMode);
  
  useEffect(() => {
    if (!viewRef.current) return;
    
    // Only update if vim mode actually changed
    if (vimModeRef.current === vimMode) return;
    vimModeRef.current = vimMode;

    const content = viewRef.current.state.doc.toString();
    const cursorPos = viewRef.current.state.selection.main.head;

    // Recreate editor state with new vim mode
    const state = EditorState.create({
      doc: content,
      extensions: createExtensions(vimMode || false),
      selection: { anchor: cursorPos, head: cursorPos },
    });

    viewRef.current.setState(state);
  }, [vimMode]);

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

