// ============================================================================
// MARKDOWN PARSER - Extract metadata from markdown files
// ============================================================================

import type {
  MetaDoc,
  Heading,
  BlockIndex,
  TaskIndex,
  LinkInfo,
  PropertyValue,
} from '../types';

// Simple frontmatter parser
function parseFrontmatter(content: string): { props: Record<string, PropertyValue>; endIndex: number } {
  const props: Record<string, PropertyValue> = {};
  
  // Check for YAML frontmatter
  if (!content.startsWith('---')) {
    return { props, endIndex: 0 };
  }
  
  const endMatch = content.slice(3).match(/\n---\n/);
  if (!endMatch || endMatch.index === undefined) {
    return { props, endIndex: 0 };
  }
  
  const yamlContent = content.slice(3, endMatch.index + 3);
  const endIndex = endMatch.index + 7; // 3 (---) + index + 4 (\n---\n)
  
  // Simple YAML parser (supports basic key: value pairs)
  const lines = yamlContent.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
    if (match) {
      const key = match[1].trim();
      let value: PropertyValue = match[2].trim();
      
      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(v => v.trim().replace(/['"]/g, ''));
      }
      // Parse booleans
      else if (value === 'true') value = true;
      else if (value === 'false') value = false;
      // Parse numbers
      else if (/^-?\d+(\.\d+)?$/.test(value)) {
        value = parseFloat(value);
      }
      
      props[key] = value;
    }
  }
  
  return { props, endIndex };
}

// Extract tags from content (excluding code blocks)
function extractTags(content: string): string[] {
  const tags = new Set<string>();
  
  // Remove code blocks first
  const withoutCode = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');
  
  // Match hashtags (but not in URLs or headers)
  const tagRegex = /(?:^|\s)#([a-zA-Z0-9_/-]+)/g;
  let match;
  
  while ((match = tagRegex.exec(withoutCode)) !== null) {
    const tag = match[1].toLowerCase();
    tags.add(tag);
    
    // Add hierarchical tags
    const parts = tag.split('/');
    for (let i = 1; i < parts.length; i++) {
      tags.add(parts.slice(0, i).join('/'));
    }
  }
  
  return Array.from(tags);
}

// Extract headings
function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = [];
  const lines = content.split('\n');
  let offset = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (match) {
      headings.push({
        depth: match[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        text: match[2].trim(),
        offset,
        line: i + 1,
      });
    }
    
    offset += line.length + 1; // +1 for newline
  }
  
  return headings;
}

// Extract wikilinks and markdown links
function extractLinks(content: string): LinkInfo[] {
  const links: LinkInfo[] = [];
  const lines = content.split('\n');
  
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Wikilinks: [[target]] or [[target|alias]]
    const wikilinkRegex = /(!?)\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;
    let match;
    
    while ((match = wikilinkRegex.exec(line)) !== null) {
      const isEmbed = match[1] === '!';
      const target = normalizeLink(match[2]);
      const alias = match[4];
      
      links.push({
        target,
        alias,
        type: isEmbed ? 'embed' : 'wikilink',
        line: i + 1,
        offset: offset + match.index,
      });
    }
    
    // Markdown links: [text](url)
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    while ((match = mdLinkRegex.exec(line)) !== null) {
      const url = match[2];
      // Only internal links (not http://, https://, etc.)
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//')) {
        links.push({
          target: normalizeLink(url),
          alias: match[1],
          type: 'markdown',
          line: i + 1,
          offset: offset + match.index,
        });
      }
    }
    
    offset += line.length + 1;
  }
  
  return links;
}

// Extract block IDs and references
function extractBlocks(content: string): BlockIndex[] {
  const blocks: BlockIndex[] = [];
  const lines = content.split('\n');
  
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Block ID: ^block-id at end of line
    const match = line.match(/\s*\^([a-zA-Z0-9_-]+)\s*$/);
    if (match) {
      blocks.push({
        id: match[1],
        start: offset,
        end: offset + line.length,
        line: i + 1,
      });
    }
    
    offset += line.length + 1;
  }
  
  return blocks;
}

// Extract tasks
function extractTasks(content: string): TaskIndex[] {
  const tasks: TaskIndex[] = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Task: - [ ] or - [x] or - [X]
    const match = line.match(/^\s*-\s+\[([ xX])\]\s+(.+)$/);
    if (match) {
      const done = match[1].toLowerCase() === 'x';
      const text = match[2].trim();
      
      // Extract priority from text (e.g., "task text #high")
      let priority: 'low' | 'medium' | 'high' | undefined;
      if (text.includes('#high') || text.includes('🔴')) priority = 'high';
      else if (text.includes('#medium') || text.includes('🟡')) priority = 'medium';
      else if (text.includes('#low') || text.includes('🟢')) priority = 'low';
      
      tasks.push({
        line: i + 1,
        text,
        done,
        priority,
      });
    }
  }
  
  return tasks;
}

// Detect language
function detectLanguage(content: string): 'ru' | 'en' | 'mixed' {
  // Remove code blocks and URLs
  const cleanContent = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/https?:\/\/\S+/g, '');
  
  const cyrillicChars = (cleanContent.match(/[а-яА-ЯёЁ]/g) || []).length;
  const latinChars = (cleanContent.match(/[a-zA-Z]/g) || []).length;
  
  if (cyrillicChars === 0 && latinChars === 0) return 'en';
  
  const cyrillicRatio = cyrillicChars / (cyrillicChars + latinChars);
  
  if (cyrillicRatio > 0.7) return 'ru';
  if (cyrillicRatio < 0.3) return 'en';
  return 'mixed';
}

// Normalize link paths
function normalizeLink(link: string): string {
  // Remove anchor and block references
  link = link.replace(/#.*$/, '').replace(/\^.*$/, '');
  
  // Add .md extension if missing
  if (!link.endsWith('.md') && !link.includes('.')) {
    link += '.md';
  }
  
  return link.trim();
}

// Main parser function
export function parseMarkdown(path: string, content: string): MetaDoc {
  // 1. Parse frontmatter
  const { props, endIndex } = parseFrontmatter(content);
  const bodyContent = content.slice(endIndex);
  
  // 2. Extract all metadata
  const tags = extractTags(bodyContent);
  const headings = extractHeadings(bodyContent);
  const links = extractLinks(bodyContent);
  const blocks = extractBlocks(bodyContent);
  const tasks = extractTasks(bodyContent);
  const lang = detectLanguage(bodyContent);
  
  // 3. Word count (approximate)
  const wordCount = bodyContent
    .replace(/```[\s\S]*?```/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0).length;
  
  return {
    path,
    tags,
    props,
    headings,
    links,
    blocks,
    tasks,
    lang,
    wordCount,
  };
}

// Hash function for deduplication (simple djb2)
export function hashContent(content: string): string {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) + content.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

