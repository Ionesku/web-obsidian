/**
 * TypeScript types for CodeMirror editor
 */
import { Extension } from '@codemirror/state';
import { Note } from '../db';

export interface EditorProps {
  initialContent?: string;
  noteId?: number;
  onSave?: (content: string) => void;
  onChange?: (content: string) => void;
  onWikiLinkClick?: (noteTitle: string) => void;
  onTagClick?: (tag: string) => void;
  vimMode?: boolean;
  autoSave?: boolean;
  autoSaveDelay?: number;
  className?: string;
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

