/**
 * Code Languages Support for CodeMirror
 * Provides syntax highlighting for code blocks in Markdown
 */

import { LanguageSupport } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { rust } from '@codemirror/lang-rust';
import { php } from '@codemirror/lang-php';
import { sql } from '@codemirror/lang-sql';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';

/**
 * Language support configuration
 */
export interface LanguageConfig {
  name: string;
  aliases: string[];
  support: () => LanguageSupport;
}

/**
 * All supported languages with their aliases
 */
export const languages: LanguageConfig[] = [
  // JavaScript & TypeScript
  {
    name: 'javascript',
    aliases: ['js', 'javascript', 'node', 'jsx'],
    support: () => javascript(),
  },
  {
    name: 'typescript',
    aliases: ['ts', 'typescript', 'tsx'],
    support: () => javascript({ typescript: true }),
  },
  
  // Python
  {
    name: 'python',
    aliases: ['py', 'python', 'python3', 'py3'],
    support: () => python(),
  },
  
  // Java
  {
    name: 'java',
    aliases: ['java'],
    support: () => java(),
  },
  
  // C/C++
  {
    name: 'cpp',
    aliases: ['cpp', 'c++', 'cxx', 'cc', 'c', 'h', 'hpp'],
    support: () => cpp(),
  },
  
  // Rust
  {
    name: 'rust',
    aliases: ['rust', 'rs'],
    support: () => rust(),
  },
  
  // PHP
  {
    name: 'php',
    aliases: ['php', 'php3', 'php4', 'php5'],
    support: () => php(),
  },
  
  // SQL
  {
    name: 'sql',
    aliases: ['sql', 'mysql', 'postgresql', 'postgres', 'sqlite', 'plsql'],
    support: () => sql(),
  },
  
  // HTML
  {
    name: 'html',
    aliases: ['html', 'htm', 'xhtml', 'jinja', 'jinja2', 'django', 'twig', 'handlebars', 'hbs', 'mustache'],
    support: () => html(),
  },
  
  // CSS
  {
    name: 'css',
    aliases: ['css', 'scss', 'sass', 'less', 'stylus'],
    support: () => css(),
  },
  
  // JSON
  {
    name: 'json',
    aliases: ['json', 'jsonc', 'json5'],
    support: () => json(),
  },
  
  // XML
  {
    name: 'xml',
    aliases: ['xml', 'svg', 'rss', 'atom'],
    support: () => xml(),
  },
  
  // YAML
  {
    name: 'yaml',
    aliases: ['yaml', 'yml'],
    support: () => yaml(),
  },
];

/**
 * Map of language aliases to their support functions
 */
const languageMap = new Map<string, () => LanguageSupport>();

// Build the language map
languages.forEach(lang => {
  lang.aliases.forEach(alias => {
    languageMap.set(alias.toLowerCase(), lang.support);
  });
});

/**
 * Get language support for a given language name
 */
export function getLanguageSupport(langName: string): LanguageSupport | null {
  const normalized = langName.toLowerCase().trim();
  const support = languageMap.get(normalized);
  return support ? support() : null;
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(langName: string): boolean {
  const normalized = langName.toLowerCase().trim();
  return languageMap.has(normalized);
}

/**
 * Get all supported language names (for autocomplete, etc.)
 */
export function getSupportedLanguages(): string[] {
  return Array.from(languageMap.keys()).sort();
}

/**
 * Get language name from alias
 */
export function getLanguageName(alias: string): string | null {
  const normalized = alias.toLowerCase().trim();
  const lang = languages.find(l => l.aliases.includes(normalized));
  return lang ? lang.name : null;
}

