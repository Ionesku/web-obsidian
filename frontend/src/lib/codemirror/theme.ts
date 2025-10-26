import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

// Obsidian-like color palette for syntax highlighting
const colors = {
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
  background: '#282c34',
  foreground: '#abb2bf',
  selection: '#3e4451',
  cursor: '#528bff',
  lineHighlight: '#2c313a',
};

export const obsidianTheme = EditorView.theme(
  {
    '&': {
      color: colors.foreground,
      backgroundColor: 'var(--background)',
      height: '100%',
      fontSize: '14px',
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    },
    '.cm-content': {
      padding: '12px 0',
      caretColor: colors.cursor,
    },
    '.cm-line': {
      padding: '0 12px',
      lineHeight: '1.6',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: colors.cursor,
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: colors.selection,
    },
    '.cm-activeLine': {
      backgroundColor: colors.lineHighlight,
    },
    '.cm-gutters': {
      backgroundColor: 'var(--background)',
      color: '#6c727d',
      border: 'none',
    },
     '.cm-activeLineGutter': {
      backgroundColor: colors.lineHighlight,
    },
  },
  { dark: true }
);

export const obsidianHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: colors.keyword },
  {
    tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName],
    color: colors.variableName,
  },
  {
    tag: [tags.function(tags.variableName), tags.labelName],
    color: colors.functionName,
  },
  {
    tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)],
    color: '#d19a66',
  },
  {
    tag: [tags.definition(tags.name), tags.separator],
    color: colors.foreground,
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
    color: colors.typeName,
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
    color: colors.operator,
  },
  { tag: [tags.meta, tags.comment], color: colors.comment },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: colors.link, textDecoration: 'underline' },
  { tag: tags.heading, fontWeight: 'bold', color: colors.heading },
  {
    tag: [tags.atom, tags.bool, tags.special(tags.variableName)],
    color: colors.atom,
  },
  { tag: [tags.processingInstruction, tags.string, tags.inserted], color: colors.string, },
  { tag: tags.invalid, color: colors.invalid },
]);

export const obsidianSyntaxHighlighting = syntaxHighlighting(obsidianHighlightStyle);
