// ============================================================================
// SEARCH MODULE - Public exports
// ============================================================================

// Main engine
export { searchEngine, initSearchEngine } from './engine';

// Types
export type {
  SearchResult,
  SearchHit,
  SearchEngine,
  QueryAST,
  Expr,
  Term,
  LocalSearchOptions,
  IndexStatus,
  MetaDoc,
  FileMeta,
} from './types';

// Query parsing and planning
export { parseQuery, stringifyAST } from './parser/query-parse';
export { planQuery, explainQuery } from './parser/query-plan';
export { federatedSearch, explainSearch } from './parser/federation';
export { executeLocal, pathsToHits } from './parser/execute-local';

// Database
export { db } from './idb';

// Hooks
export { useSearch, useIndexing } from '../hooks/useSearch';

// Store
export { useSearchStore } from '../stores/search';

