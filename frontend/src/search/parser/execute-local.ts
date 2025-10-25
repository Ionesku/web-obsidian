// ============================================================================
// LOCAL EXECUTOR - Execute local queries against IndexedDB
// ============================================================================

import { db } from '../idb';
import type { Expr, Term, PropertyValue, SearchHit, LocalSearchOptions } from '../types';

// Boolean algebra on sets
class SetOps {
  static union<T>(sets: Set<T>[]): Set<T> {
    const result = new Set<T>();
    for (const set of sets) {
      for (const item of set) {
        result.add(item);
      }
    }
    return result;
  }

  static intersection<T>(sets: Set<T>[]): Set<T> {
    if (sets.length === 0) return new Set();
    if (sets.length === 1) return new Set(sets[0]);
    
    const result = new Set(sets[0]);
    for (let i = 1; i < sets.length; i++) {
      for (const item of result) {
        if (!sets[i].has(item)) {
          result.delete(item);
        }
      }
    }
    return result;
  }

  static difference<T>(a: Set<T>, b: Set<T>): Set<T> {
    const result = new Set(a);
    for (const item of b) {
      result.delete(item);
    }
    return result;
  }
}

// Execute local query and return paths
export async function executeLocal(expr: Expr | null, options?: LocalSearchOptions): Promise<Set<string>> {
  if (!expr) {
    // No filter - return all paths
    return await db.getAllPaths();
  }
  
  return await evaluateExpr(expr);
}

// Evaluate expression recursively
async function evaluateExpr(expr: Expr): Promise<Set<string>> {
  if ('kind' in expr) {
    switch (expr.kind) {
      case 'and': {
        const sets = await Promise.all(expr.children.map(evaluateExpr));
        return SetOps.intersection(sets);
      }
      
      case 'or': {
        const sets = await Promise.all(expr.children.map(evaluateExpr));
        return SetOps.union(sets);
      }
      
      case 'not': {
        const allPaths = await db.getAllPaths();
        const excludePaths = await evaluateExpr(expr.child);
        return SetOps.difference(allPaths, excludePaths);
      }
      
      default:
        return await evaluateTerm(expr as Term);
    }
  }
  
  return new Set();
}

// Evaluate individual term
async function evaluateTerm(term: Term): Promise<Set<string>> {
  switch (term.kind) {
    case 'tag':
      // Support hierarchical tags: tag:work matches work, work/project, etc.
      if (term.value.endsWith('*') || term.value.includes('/')) {
        return await db.pathsByTagPrefix(term.value.replace(/\*$/, ''));
      }
      return await db.pathsByTag(term.value);
    
    case 'file':
      return await db.pathsByFileName(term.value);
    
    case 'path':
      return await db.pathsByPathPrefix(term.value);
    
    case 'prop':
      return await evaluateProperty(term.key, term.op, term.value);
    
    case 'block':
      return await db.pathsByBlockId(term.id);
    
    case 'section':
      return await db.pathsByHeading(term.title);
    
    case 'link':
      // Files that link to this target
      return await db.linksTo(normalizeLink(term.target));
    
    case 'backlink':
      // Files that are linked from this target
      return await db.linksFrom(normalizeLink(term.target));
    
    case 'task':
      return await db.pathsWithTasks(term.done);
    
    // These should be handled by server, but return empty set for now
    case 'word':
    case 'phrase':
    case 'regex':
    case 'line':
      return new Set();
    
    default:
      return new Set();
  }
}

// Evaluate property with operators
async function evaluateProperty(key: string, op: string, value: PropertyValue): Promise<Set<string>> {
  const normalizedKey = key.toLowerCase();
  
  // Simple equality
  if (op === ':' || op === '=') {
    return await db.pathsByProp(normalizedKey, value as string | number | boolean);
  }
  
  // For comparison operators, we need to fetch all docs with this property
  // and filter manually
  const pathsWithProp = await db.pathsByProp(normalizedKey);
  const matchingPaths = new Set<string>();
  
  for (const path of pathsWithProp) {
    const meta = await db.getMetaDoc(path);
    if (!meta) continue;
    
    const propValue = meta.props[key];
    if (propValue === undefined || propValue === null) continue;
    
    // Type coercion for comparison
    const numericValue = typeof value === 'number' ? value : parseFloat(String(value));
    const numericPropValue = typeof propValue === 'number' ? propValue : parseFloat(String(propValue));
    
    if (isNaN(numericValue) || isNaN(numericPropValue)) {
      // String comparison
      const strValue = String(value);
      const strPropValue = String(propValue);
      
      switch (op) {
        case '!=':
          if (strPropValue !== strValue) matchingPaths.add(path);
          break;
        case '>':
          if (strPropValue > strValue) matchingPaths.add(path);
          break;
        case '>=':
          if (strPropValue >= strValue) matchingPaths.add(path);
          break;
        case '<':
          if (strPropValue < strValue) matchingPaths.add(path);
          break;
        case '<=':
          if (strPropValue <= strValue) matchingPaths.add(path);
          break;
      }
    } else {
      // Numeric comparison
      switch (op) {
        case '!=':
          if (numericPropValue !== numericValue) matchingPaths.add(path);
          break;
        case '>':
          if (numericPropValue > numericValue) matchingPaths.add(path);
          break;
        case '>=':
          if (numericPropValue >= numericValue) matchingPaths.add(path);
          break;
        case '<':
          if (numericPropValue < numericValue) matchingPaths.add(path);
          break;
        case '<=':
          if (numericPropValue <= numericValue) matchingPaths.add(path);
          break;
      }
    }
  }
  
  return matchingPaths;
}

// Convert paths to search hits
export async function pathsToHits(
  paths: Set<string>,
  options?: LocalSearchOptions
): Promise<SearchHit[]> {
  const hits: SearchHit[] = [];
  
  for (const path of paths) {
    const fileRecord = await db.getFileRecord(path);
    const metaDoc = await db.getMetaDoc(path);
    
    if (!fileRecord) continue;
    
    // Get title from first heading or filename
    let title = fileRecord.name.replace(/\.md$/, '');
    if (metaDoc && metaDoc.headings.length > 0) {
      title = metaDoc.headings[0].text;
    }
    
    hits.push({
      path,
      score: 1.0, // Local hits have uniform score (can be enhanced with ranking)
      title,
      layer: 'local',
      meta: metaDoc,
    });
  }
  
  // Sort results
  const sortBy = options?.sort || 'mtime';
  
  if (sortBy === 'name') {
    hits.sort((a, b) => a.title!.localeCompare(b.title!));
  } else if (sortBy === 'path') {
    hits.sort((a, b) => a.path.localeCompare(b.path));
  } else if (sortBy === 'mtime') {
    // Sort by modification time (need to fetch file records)
    const mtimes = new Map<string, number>();
    for (const hit of hits) {
      const record = await db.getFileRecord(hit.path);
      if (record) mtimes.set(hit.path, record.mtime);
    }
    hits.sort((a, b) => (mtimes.get(b.path) || 0) - (mtimes.get(a.path) || 0));
  }
  
  // Apply limit and offset
  const offset = options?.offset || 0;
  const limit = options?.limit || 100;
  
  return hits.slice(offset, offset + limit);
}

// Helper to normalize links
function normalizeLink(link: string): string {
  // Remove [[]] if present
  link = link.replace(/^\[\[|\]\]$/g, '');
  
  // Remove anchor and block references
  link = link.replace(/#.*$/, '').replace(/\^.*$/, '');
  
  // Add .md extension if missing
  if (!link.endsWith('.md') && !link.includes('.')) {
    link += '.md';
  }
  
  return link.trim();
}

