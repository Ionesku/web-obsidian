// ============================================================================
// QUERY PLANNER - Divide query into local (A) and server (B) layers
// ============================================================================

import type { Expr, Term, QueryPlan, LayerMarker } from '../types';

// Classify a term as local, server, or hybrid
export function classifyTerm(term: Term): LayerMarker {
  switch (term.kind) {
    // Local-only terms
    case 'tag':
    case 'file':
    case 'path':
    case 'prop':
    case 'block':
    case 'section':
    case 'link':
    case 'backlink':
    case 'task':
      return 'local';
    
    // Server-only terms (full-text search)
    case 'word':
    case 'phrase':
    case 'regex':
      return 'server';
    
    // Hybrid (depends on context)
    case 'line':
      return 'hybrid'; // Line boundaries are local, but content matching is server
    
    default:
      return 'server';
  }
}

// Classify an expression recursively
export function classifyExpr(expr: Expr): LayerMarker {
  if ('kind' in expr) {
    switch (expr.kind) {
      case 'and':
      case 'or': {
        const layers = expr.children.map(classifyExpr);
        if (layers.every(l => l === 'local')) return 'local';
        if (layers.every(l => l === 'server')) return 'server';
        return 'hybrid';
      }
      
      case 'not':
        return classifyExpr(expr.child);
      
      default:
        return classifyTerm(expr as Term);
    }
  }
  
  return 'local';
}

// Split expression into local and server parts
export function planQuery(expr: Expr): QueryPlan {
  const layer = classifyExpr(expr);
  
  // Pure local query
  if (layer === 'local') {
    return {
      local: expr,
      server: null,
      explanation: 'Query is purely local (metadata only)',
    };
  }
  
  // Pure server query
  if (layer === 'server') {
    return {
      local: null,
      server: expr,
      explanation: 'Query requires full-text search on server',
    };
  }
  
  // Hybrid - need to split
  const { local, server } = splitQuery(expr);
  
  return {
    local,
    server,
    explanation: local && server 
      ? 'Query uses both local filters and server search'
      : local 
      ? 'Query is purely local'
      : 'Query is purely server-side',
  };
}

// Split hybrid query into local and server parts
function splitQuery(expr: Expr): { local: Expr | null; server: Expr | null } {
  // If it's a term, classify it
  if ('kind' in expr && expr.kind !== 'and' && expr.kind !== 'or' && expr.kind !== 'not') {
    const layer = classifyTerm(expr as Term);
    if (layer === 'local') return { local: expr, server: null };
    if (layer === 'server') return { local: null, server: expr };
    // Hybrid term (line:) - treat as server with local post-filter
    return { local: null, server: expr };
  }
  
  if (expr.kind === 'and') {
    // Split children into local and server
    const localChildren: Expr[] = [];
    const serverChildren: Expr[] = [];
    
    for (const child of expr.children) {
      const { local, server } = splitQuery(child);
      if (local) localChildren.push(local);
      if (server) serverChildren.push(server);
    }
    
    return {
      local: localChildren.length > 0 
        ? localChildren.length === 1 
          ? localChildren[0] 
          : { kind: 'and', children: localChildren }
        : null,
      server: serverChildren.length > 0
        ? serverChildren.length === 1
          ? serverChildren[0]
          : { kind: 'and', children: serverChildren }
        : null,
    };
  }
  
  if (expr.kind === 'or') {
    // OR is tricky - if any child is server, the whole OR must be server
    const hasServer = expr.children.some(c => classifyExpr(c) === 'server' || classifyExpr(c) === 'hybrid');
    
    if (hasServer) {
      // Entire OR goes to server
      return { local: null, server: expr };
    }
    
    // All children are local
    return { local: expr, server: null };
  }
  
  if (expr.kind === 'not') {
    // NOT of local is local, NOT of server is server
    const { local, server } = splitQuery(expr.child);
    
    if (local && !server) {
      return { local: { kind: 'not', child: local }, server: null };
    }
    if (server && !local) {
      return { local: null, server: { kind: 'not', child: server } };
    }
    // Hybrid NOT - send to server
    return { local: null, server: expr };
  }
  
  return { local: null, server: null };
}

// Extract all server terms for API request
export function extractServerTerms(expr: Expr | null): Term[] {
  if (!expr) return [];
  
  const terms: Term[] = [];
  
  function walk(e: Expr) {
    if ('kind' in e) {
      if (e.kind === 'and' || e.kind === 'or') {
        e.children.forEach(walk);
      } else if (e.kind === 'not') {
        walk(e.child);
      } else {
        // It's a term
        const term = e as Term;
        if (classifyTerm(term) === 'server' || classifyTerm(term) === 'hybrid') {
          terms.push(term);
        }
      }
    }
  }
  
  walk(expr);
  return terms;
}

// Generate human-readable explanation
export function explainQuery(plan: QueryPlan): string {
  const lines: string[] = [];
  
  lines.push('Query Plan:');
  lines.push('');
  
  if (plan.local) {
    lines.push('Local (Layer A):');
    lines.push(stringifyExprSimple(plan.local, '  '));
    lines.push('');
  }
  
  if (plan.server) {
    lines.push('Server (Layer B):');
    lines.push(stringifyExprSimple(plan.server, '  '));
    lines.push('');
  }
  
  if (plan.restrictPaths) {
    lines.push(`Restrict to ${plan.restrictPaths.length} file(s) from local filtering`);
    lines.push('');
  }
  
  lines.push(`Strategy: ${plan.explanation}`);
  
  return lines.join('\n');
}

function stringifyExprSimple(expr: Expr, indent = ''): string {
  if ('kind' in expr) {
    switch (expr.kind) {
      case 'and':
        return expr.children.map(c => stringifyExprSimple(c, indent)).join(' AND ');
      case 'or':
        return '(' + expr.children.map(c => stringifyExprSimple(c, indent)).join(' OR ') + ')';
      case 'not':
        return 'NOT ' + stringifyExprSimple(expr.child, indent);
      case 'word':
        return `"${expr.value}"`;
      case 'phrase':
        return `"${expr.value}"`;
      case 'regex':
        return `/${expr.value}/${expr.flags || ''}`;
      case 'tag':
        return `tag:${expr.value}`;
      case 'file':
        return `file:${expr.value}`;
      case 'path':
        return `path:${expr.value}`;
      case 'prop':
        return `[${expr.key}${expr.op}${expr.value}]`;
      case 'line':
        return `line:(${stringifyExprSimple(expr.sub as Expr, indent)})`;
      case 'block':
        return `block:${expr.id}`;
      case 'section':
        return `section:"${expr.title}"`;
      case 'link':
        return `link:${expr.target}`;
      case 'backlink':
        return `backlink:${expr.target}`;
      case 'task':
        return `task${expr.done !== undefined ? ':' + (expr.done ? 'done' : 'todo') : ''}`;
    }
  }
  
  return JSON.stringify(expr);
}

