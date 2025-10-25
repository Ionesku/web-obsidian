// ============================================================================
// FEDERATION - Coordinate local and server search
// ============================================================================

import { executeLocal, pathsToHits } from './execute-local';
import { planQuery, extractServerTerms } from './query-plan';
import { parseQuery } from './query-parse';
import type {
  SearchResult,
  SearchHit,
  LocalSearchOptions,
  ServerSearchReq,
  ServerSearchResp,
  ServerTerm,
  Term,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Main federated search function
export async function federatedSearch(
  query: string,
  options?: LocalSearchOptions
): Promise<SearchResult> {
  const startTime = performance.now();
  
  try {
    // 1. Parse query
    const ast = parseQuery(query);
    
    // 2. Plan execution
    const plan = planQuery(ast);
    
    // 3. Execute local part
    let restrictPaths: string[] | undefined;
    let localHits: SearchHit[] = [];
    
    if (plan.local) {
      const localPathsSet = await executeLocal(plan.local, options);
      restrictPaths = Array.from(localPathsSet);
      
      // If no server part, convert paths to hits and return
      if (!plan.server) {
        localHits = await pathsToHits(localPathsSet, options);
        
        return {
          hits: localHits,
          total: localHits.length,
          took: performance.now() - startTime,
          query,
          plan,
        };
      }
      
      // If local filtering resulted in empty set, return empty
      if (restrictPaths.length === 0) {
        return {
          hits: [],
          total: 0,
          took: performance.now() - startTime,
          query,
          plan: { ...plan, restrictPaths },
        };
      }
    }
    
    // 4. Execute server part if present
    if (plan.server) {
      const serverReq = buildServerRequest(plan.server, restrictPaths, options);
      const serverResp = await callServerSearch(serverReq);
      
      // Convert server hits to SearchHits
      const serverHits = serverResp.hits.map(hit => ({
        path: hit.path,
        score: hit.score,
        layer: 'server' as const,
        snippet: hit.snippets?.[0]?.text,
        matches: hit.ranges?.map(r => ({
          start: r.start,
          end: r.end,
          type: 'content' as const,
        })),
      }));
      
      // 5. Merge results
      const mergedHits = mergeHits(localHits, serverHits, restrictPaths);
      
      return {
        hits: mergedHits,
        total: mergedHits.length,
        took: performance.now() - startTime,
        query,
        plan: { ...plan, restrictPaths },
      };
    }
    
    // No server part, return local results
    return {
      hits: localHits,
      total: localHits.length,
      took: performance.now() - startTime,
      query,
      plan: { ...plan, restrictPaths },
    };
    
  } catch (error) {
    console.error('Search error:', error);
    return {
      hits: [],
      total: 0,
      took: performance.now() - startTime,
      query,
    };
  }
}

// Build server search request
function buildServerRequest(
  serverExpr: any,
  restrictPaths: string[] | undefined,
  options?: LocalSearchOptions
): ServerSearchReq {
  const terms = extractServerTerms(serverExpr);
  
  return {
    terms: terms.map(termToServerTerm).filter(t => t !== null) as ServerTerm[],
    restrict_paths: restrictPaths,
    limit: options?.limit || 100,
    offset: options?.offset || 0,
    caseSensitive: options?.caseSensitive || false,
  };
}

// Convert local term to server term
function termToServerTerm(term: Term): ServerTerm | null {
  switch (term.kind) {
    case 'word':
      return { type: 'word', value: term.value };
    
    case 'phrase':
      return { type: 'phrase', value: term.value };
    
    case 'regex':
      return { type: 'regex', value: term.value, flags: term.flags };
    
    case 'line':
      const subTerm = termToServerTerm(term.sub as Term);
      if (subTerm) {
        return { type: 'line', sub: subTerm };
      }
      return null;
    
    default:
      return null;
  }
}

// Call server search API
async function callServerSearch(req: ServerSearchReq): Promise<ServerSearchResp> {
  const response = await fetch(`${API_BASE}/api/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify(req),
  });
  
  if (!response.ok) {
    throw new Error(`Server search failed: ${response.statusText}`);
  }
  
  return await response.json();
}

// Merge local and server hits
function mergeHits(
  localHits: SearchHit[],
  serverHits: SearchHit[],
  restrictPaths?: string[]
): SearchHit[] {
  // If we have restrictPaths, server hits are already filtered
  // Just deduplicate and merge
  
  const hitMap = new Map<string, SearchHit>();
  
  // Add local hits first
  for (const hit of localHits) {
    hitMap.set(hit.path, hit);
  }
  
  // Add or enhance with server hits
  for (const hit of serverHits) {
    const existing = hitMap.get(hit.path);
    if (existing) {
      // Enhance with server data (snippets, highlights)
      hitMap.set(hit.path, {
        ...existing,
        score: hit.score, // Use server score
        snippet: hit.snippet,
        matches: hit.matches,
      });
    } else {
      hitMap.set(hit.path, hit);
    }
  }
  
  // Sort by score (server) or keep order
  const merged = Array.from(hitMap.values());
  merged.sort((a, b) => (b.score || 0) - (a.score || 0));
  
  return merged;
}

// Get auth token from store
function getAuthToken(): string {
  // TODO: integrate with your auth store
  return localStorage.getItem('auth_token') || '';
}

// Explain query (for debugging)
export async function explainSearch(query: string): Promise<string> {
  try {
    const ast = parseQuery(query);
    const plan = planQuery(ast);
    
    const lines: string[] = [];
    lines.push('Query: ' + query);
    lines.push('');
    lines.push('AST:');
    lines.push(JSON.stringify(ast, null, 2));
    lines.push('');
    lines.push('Plan:');
    lines.push(plan.explanation);
    lines.push('');
    
    if (plan.local) {
      lines.push('Local expression:');
      lines.push(JSON.stringify(plan.local, null, 2));
      lines.push('');
    }
    
    if (plan.server) {
      lines.push('Server expression:');
      lines.push(JSON.stringify(plan.server, null, 2));
      lines.push('');
    }
    
    // Execute local part to see how many paths
    if (plan.local) {
      const paths = await executeLocal(plan.local);
      lines.push(`Local filtering: ${paths.size} file(s)`);
    }
    
    return lines.join('\n');
  } catch (error) {
    return `Error: ${error}`;
  }
}

