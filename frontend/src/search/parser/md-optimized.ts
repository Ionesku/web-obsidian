// ============================================================================
// OPTIMIZED MARKDOWN PARSER - Single-pass parsing for better performance
// ============================================================================

import type {
  MetaDoc,
  Heading,
  BlockIndex,
  TaskIndex,
  LinkInfo,
  PropertyValue,
} from '../types';

/**
 * Optimized markdown parser that does a single pass through the content
 * instead of multiple regex operations.
 * 
 * Performance improvement: O(n) vs O(n*m) for large files
 */
export function parseMarkdownOptimized(path: string, content: string): MetaDoc {
  const result: MetaDoc = {
    tags: [],
    props: {},
    headings: [],
    links: [],
    backlinks: [],
    blocks: [],
    tasks: [],
    lang: 'en',
  };

  let line = 1;
  let inCodeBlock = false;
  let inFrontmatter = false;
  let frontmatterLines: string[] = [];
  let charIndex = 0;

  // State for tracking
  const tagSet = new Set<string>();
  const linkSet = new Set<string>();

  // Single pass through content
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    const lineStart = i === 0 || content[i - 1] === '\n';

    // Handle newlines
    if (char === '\n') {
      line++;
      charIndex = 0;
      continue;
    }

    charIndex++;

    // ========================================
    // FRONTMATTER (only at file start)
    // ========================================
    if (lineStart && content.slice(i, i + 3) === '---') {
      if (i === 0 || (i === 1 && content[0] === '\n')) {
        inFrontmatter = true;
        i += 2; // Skip '---'
        continue;
      } else if (inFrontmatter) {
        // End of frontmatter
        inFrontmatter = false;
        parseFrontmatterLines(frontmatterLines, result.props);
        frontmatterLines = [];
        i += 2; // Skip '---'
        continue;
      }
    }

    if (inFrontmatter) {
      // Collect frontmatter lines
      const lineEnd = content.indexOf('\n', i);
      if (lineEnd > i) {
        frontmatterLines.push(content.slice(i, lineEnd));
        i = lineEnd;
      }
      continue;
    }

    // ========================================
    // CODE BLOCKS (skip their content)
    // ========================================
    if (lineStart && content.slice(i, i + 3) === '```') {
      inCodeBlock = !inCodeBlock;
      i += 2; // Skip '```'
      continue;
    }

    if (inCodeBlock) {
      continue; // Skip code block content
    }

    // Skip inline code
    if (char === '`') {
      const endBacktick = content.indexOf('`', i + 1);
      if (endBacktick > i) {
        i = endBacktick; // Skip to end of inline code
        continue;
      }
    }

    // ========================================
    // HEADINGS
    // ========================================
    if (lineStart && char === '#') {
      let level = 1;
      let j = i + 1;
      while (j < content.length && content[j] === '#' && level < 6) {
        level++;
        j++;
      }

      if (j < content.length && content[j] === ' ') {
        // Valid heading
        const lineEnd = content.indexOf('\n', j);
        const endPos = lineEnd > j ? lineEnd : content.length;
        const text = content.slice(j + 1, endPos).trim();

        result.headings.push({
          level,
          text,
          line,
        });

        i = endPos - 1; // Skip to end of line
        continue;
      }
    }

    // ========================================
    // TAGS
    // ========================================
    if (char === '#' && (i === 0 || /\s/.test(content[i - 1]))) {
      // Potential tag
      let j = i + 1;
      while (j < content.length && /[a-zA-Z0-9_/-]/.test(content[j])) {
        j++;
      }

      if (j > i + 1) {
        const tag = content.slice(i + 1, j).toLowerCase();
        tagSet.add(tag);

        // Add hierarchical tags
        const parts = tag.split('/');
        for (let k = 1; k < parts.length; k++) {
          tagSet.add(parts.slice(0, k).join('/'));
        }

        i = j - 1; // Skip to end of tag
        continue;
      }
    }

    // ========================================
    // WIKI LINKS: [[target]] or [[target|alias]]
    // ========================================
    if (char === '[' && nextChar === '[') {
      const closeIndex = content.indexOf(']]', i + 2);
      if (closeIndex > i) {
        const linkContent = content.slice(i + 2, closeIndex);
        const pipeIndex = linkContent.indexOf('|');
        const target = pipeIndex > 0 ? linkContent.slice(0, pipeIndex) : linkContent;

        const normalizedTarget = target.trim().endsWith('.md') 
          ? target.trim() 
          : target.trim() + '.md';

        if (!linkSet.has(normalizedTarget)) {
          linkSet.add(normalizedTarget);
          result.links.push({
            target: normalizedTarget,
            line,
            display: pipeIndex > 0 ? linkContent.slice(pipeIndex + 1).trim() : undefined,
          });
        }

        i = closeIndex + 1; // Skip to after ]]
        continue;
      }
    }

    // ========================================
    // TASKS: - [ ] or - [x]
    // ========================================
    if (lineStart && (char === '-' || char === '*') && content[i + 1] === ' ') {
      const taskMatch = content.slice(i, i + 6);
      if (taskMatch === '- [ ] ' || taskMatch === '- [x] ' || 
          taskMatch === '* [ ] ' || taskMatch === '* [x] ') {
        const done = taskMatch[3] === 'x' || taskMatch[3] === 'X';
        const lineEnd = content.indexOf('\n', i);
        const endPos = lineEnd > i ? lineEnd : content.length;
        const text = content.slice(i + 6, endPos).trim();

        result.tasks.push({
          line,
          done,
          text,
        });

        i = endPos - 1; // Skip to end of line
        continue;
      }
    }

    // ========================================
    // BLOCK IDS: ^block-id at end of line
    // ========================================
    if (char === '^' && charIndex > 1) {
      const lineEnd = content.indexOf('\n', i);
      const endPos = lineEnd > i ? lineEnd : content.length;
      const blockId = content.slice(i + 1, endPos).trim();

      if (blockId && /^[a-zA-Z0-9-]+$/.test(blockId)) {
        result.blocks.push({
          id: blockId,
          line,
        });

        i = endPos - 1; // Skip to end of line
        continue;
      }
    }
  }

  // Convert sets to arrays
  result.tags = Array.from(tagSet);
  
  // Detect language
  result.lang = detectLanguage(content);

  return result;
}

/**
 * Parse frontmatter lines into props object
 */
function parseFrontmatterLines(lines: string[], props: Record<string, PropertyValue>): void {
  for (const line of lines) {
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
    if (!match) continue;

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

/**
 * Simple language detection
 */
function detectLanguage(content: string): 'en' | 'ru' | 'mixed' {
  // Sample first 1000 characters
  const sample = content.slice(0, 1000);
  const cyrillicChars = (sample.match(/[\u0400-\u04FF]/g) || []).length;
  const latinChars = (sample.match(/[a-zA-Z]/g) || []).length;

  if (cyrillicChars === 0 && latinChars > 0) return 'en';
  if (latinChars === 0 && cyrillicChars > 0) return 'ru';
  return 'mixed';
}

/**
 * Hash content for deduplication
 */
export function hashContent(content: string): string {
  // Simple hash function (FNV-1a)
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

