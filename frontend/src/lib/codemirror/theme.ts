import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { defaultHighlightStyle } from '@codemirror/language';

// --- Light Theme ---

export const lightTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: '#ffffff',
  },
  '.cm-scroller': {
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  },
  '.cm-content': {
    caretColor: '#3b82f6',
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
});

export const lightSyntaxHighlighting = syntaxHighlighting(defaultHighlightStyle, { fallback: true });


// --- Dark Theme (Obsidian-like) ---

const darkColors = {
  keyword: '#c678dd',
  atom: '#d19a66',
  number: '#d19a66',
  string: '#98c379',
  regexp: '#98c379',
  comment: '#7f848e',
  variableName: '#e06c75',
  typeName: '#e5c07b',
  propertyName: '#61afef',
  className: '#e5c07b',
  operator: '#56b6c2',
  punctuation: '#abb2bf',
  meta: '#abb2bf',
  link: '#61afef',
  heading: '#e06c75',
  emphasis: '#c678dd',
  strong: '#d19a66',
  invalid: '#ff0000',
  foreground: '#abb2bf',
  selection: '#3e4451',
  cursor: '#528bff',
  lineHighlight: '#2c313a',
  functionName: '#61afef',
};

export const darkTheme = EditorView.theme(
  {
    '&': {
      color: darkColors.foreground,
      backgroundColor: 'hsl(var(--background))',
      height: '100%',
      fontSize: '14px',
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    },
    '.cm-content': {
      padding: '12px 0',
      caretColor: darkColors.cursor,
    },
    '.cm-line': {
      padding: '0 12px',
      lineHeight: '1.6',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: darkColors.cursor,
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: darkColors.selection,
    },
    '.cm-activeLine': {
      backgroundColor: darkColors.lineHighlight,
    },
    '.cm-gutters': {
      backgroundColor: 'hsl(var(--background))',
      color: '#6c727d',
      border: 'none',
    },
     '.cm-activeLineGutter': {
      backgroundColor: darkColors.lineHighlight,
    },
  },
  { dark: true }
);

export const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: darkColors.keyword },
  {
    tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName],
    color: darkColors.variableName,
  },
  {
    tag: [tags.function(tags.variableName), tags.labelName],
    color: darkColors.functionName,
  },
  {
    tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)],
    color: '#d19a66',
  },
  {
    tag: [tags.definition(tags.name), tags.separator],
    color: darkColors.foreground,
  },
  {
    tag: [
      tags.typeName,
      tags.className,
      tags.number,
      tags.changed,
      tags.annotation,
      tags.modifier,
      tags.self,
      tags.namespace,
    ],
    color: darkColors.typeName,
  },
  {
    tag: [
      tags.operator,
      tags.operatorKeyword,
      tags.url,
      tags.escape,
      tags.regexp,
      tags.link,
      tags.special(tags.string),
    ],
    color: darkColors.operator,
  },
  { tag: [tags.meta, tags.comment], color: darkColors.comment },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: darkColors.link, textDecoration: 'underline' },
  { tag: tags.heading, fontWeight: 'bold', color: darkColors.heading },
  {
    tag: [tags.atom, tags.bool, tags.special(tags.variableName)],
    color: darkColors.atom,
  },
  { tag: [tags.processingInstruction, tags.string, tags.inserted], color: darkColors.string, },
  { tag: tags.invalid, color: darkColors.invalid },
]);

export const darkSyntaxHighlighting = syntaxHighlighting(darkHighlightStyle);
