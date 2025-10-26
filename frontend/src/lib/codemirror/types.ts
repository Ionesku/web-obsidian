/**
 * TypeScript types for CodeMirror editor
 */
import { Extension } from '@codemirror/state';
import { Note } from '../db';
import type { SaveStatus } from '@/hooks/useAutosave';

export interface AutosaveStatus {
  status: SaveStatus;
  lastSaved: Date | null;
  error: string | null;
}

export interface EditorProps {
  initialContent?: string;
  noteId?: string; // Changed from number to string to use file path as identifier
  onSave?: (content: string) => void;
  onChange?: (content: string) => void;
  onWikiLinkClick?: (noteTitle: string) => void;
  onTagClick?: (tag: string) => void;
  vimMode?: boolean;
  autoSave?: boolean;
  autoSaveDelay?: number;
  debug?: boolean;
  onAutosaveStatusChange?: (status: AutosaveStatus) => void;
  className?: string;
  searchQuery?: string;
  onSearchStateChange?: (state: { query: string; matchCount: number; currentMatch: number }) => void;
}

export interface WikiLink {
  text: string;
  from: number;
  to: number;
  isTransclusion: boolean;
}

export interface TransclusionWidget {
  noteTitle: string;
  noteContent: string;
}

export interface AutocompleteNote {
  title: string;
  id: number;
}

export interface EditorSettings {
  theme?: 'light' | 'dark';
  fontSize?: number;
  lineNumbers?: boolean;
  lineWrapping?: boolean;
  vimMode?: boolean;
}

export type CustomExtension = Extension;

