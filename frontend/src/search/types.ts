// ============================================================================
// SEARCH ENGINE TYPES - Unified type definitions for local and federated search
// ============================================================================

export type FileId = string; // equals path or hash

// File metadata
export interface FileMeta {
  path: string;           // "notes/today.md"
  name: string;           // "today.md"
  mtime: number;          // ms timestamp
  size: number;           // bytes
  hash: string;           // xxhash/sha1 for deduplication
}

// Markdown structural elements
export interface Heading {
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  offset: number;         // character offset in file
  line: number;           // line number
}

export interface BlockIndex {
  id: string;             // ^block-id
  start: number;          // character offset
  end: number;
  line: number;
}

export interface TaskIndex {
  line: number;
  text: string;
  done: boolean;
  priority?: 'low' | 'medium' | 'high';
}

export interface LinkInfo {
  target: string;         // normalized path "notes/other.md"
  alias?: string;         // display text
  type: 'wikilink' | 'markdown' | 'embed';
  line: number;
  offset: number;
}

// Metadata document (stored in IndexedDB)
export interface MetaDoc {
  path: string;
  tags: string[];                       // normalized: lowercase, without #, hierarchical tag/sub
  props: Record<string, PropertyValue>;  // frontmatter properties
  headings: Heading[];
  links: LinkInfo[];                    // outgoing links
  backlinks?: string[];                 // filled when building graph
  blocks: BlockIndex[];
  tasks: TaskIndex[];
  lang?: 'ru' | 'en' | 'mixed';
  wordCount?: number;
}

export type PropertyValue = string | number | boolean | string[] | null;

// Query AST Types
export type QueryAST = Expr;

export type Expr =
  | { kind: 'and'; children: Expr[] }
  | { kind: 'or'; children: Expr[] }
  | { kind: 'not'; child: Expr }
  | Term;

export type Term =
  | { kind: 'word'; value: string; caseSensitive?: boolean }
  | { kind: 'phrase'; value: string; caseSensitive?: boolean }
  | { kind: 'regex'; value: string; flags?: string }
  | { kind: 'tag'; value: string }                    // tag:work
  | { kind: 'file'; value: string }                   // file:today.md
  | { kind: 'path'; value: string }                   // path:notes/
  | { kind: 'prop'; key: string; op: PropOp; value: PropertyValue }  // [status:todo]
  | { kind: 'line'; sub: Term }                       // line:/regex/
  | { kind: 'block'; id: string }                     // block:^abc123
  | { kind: 'section'; title: string }                // section:"Header"
  | { kind: 'link'; target: string }                  // link:[[note]]
  | { kind: 'backlink'; target: string }              // backlink:[[note]]
  | { kind: 'task'; done?: boolean };                 // task: or task-done: or task-todo:

export type PropOp = ':' | '=' | '!=' | '>' | '>=' | '<' | '<';

// Search execution layer marker
export type LayerMarker = 'local' | 'server' | 'hybrid';

export interface AnnotatedExpr {
  expr: Expr;
  layer: LayerMarker;
}

// Local search options
export interface LocalSearchOptions {
  caseSensitive?: boolean;
  limit?: number;
  offset?: number;
  sort?: 'name' | 'mtime' | 'path' | 'relevance';
  includeContent?: boolean;
}

// Search results
export interface SearchHit {
  path: string;
  score: number;
  title?: string;           // from first heading or filename
  snippet?: string;
  matches?: MatchRange[];
  layer: 'local' | 'server';
  meta?: Partial<MetaDoc>;
}

export interface MatchRange {
  start: number;            // character or line offset
  end: number;
  line?: number;
  type: 'tag' | 'heading' | 'content' | 'property';
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  took: number;             // ms
  query: string;
  plan?: QueryPlan;
}

// Query execution plan
export interface QueryPlan {
  local: Expr | null;       // local part
  server: Expr | null;      // server part
  restrictPaths?: string[]; // paths from local filtering
  explanation: string;
}

// ============================================================================
// SERVER API TYPES
// ============================================================================

export interface ServerSearchReq {
  terms: ServerTerm[];
  restrict_paths?: string[];
  limit?: number;
  offset?: number;
  caseSensitive?: boolean;
}

export type ServerTerm =
  | { type: 'word'; value: string }
  | { type: 'phrase'; value: string }
  | { type: 'regex'; value: string; flags?: string }
  | { type: 'line'; sub: ServerTerm };

export interface ServerHit {
  path: string;
  score: number;
  ranges?: Array<{ start: number; end: number }>;
  snippets?: Array<{ line: number; text: string; ranges: number[][] }>;
}

export interface ServerSearchResp {
  hits: ServerHit[];
  total: number;
  took: number;
}

// ============================================================================
// WORKER MESSAGES
// ============================================================================

export type WorkerMessage =
  | { type: 'INDEX_FILE'; payload: IndexFilePayload }
  | { type: 'DELETE_FILE'; payload: { path: string } }
  | { type: 'REBUILD_GRAPH'; payload?: never }
  | { type: 'GET_STATUS'; payload?: never };

export interface IndexFilePayload {
  path: string;
  content: string;
  mtime: number;
  hash: string;
}

export type WorkerResponse =
  | { type: 'INDEXED'; path: string; success: boolean; error?: string }
  | { type: 'DELETED'; path: string; success: boolean }
  | { type: 'GRAPH_REBUILT'; success: boolean; stats: { files: number; links: number } }
  | { type: 'STATUS'; payload: IndexStatus };

export interface IndexStatus {
  state: 'idle' | 'indexing' | 'error';
  filesIndexed: number;
  totalFiles: number;
  lastIndexed?: number;   // timestamp
  queueSize: number;
}

// ============================================================================
// SEARCH ENGINE INTERFACE (pluggable backends)
// ============================================================================

export interface SearchEngine {
  // Local indexing
  indexLocal(file: IndexFilePayload): Promise<void>;
  deleteLocal(path: string): Promise<void>;
  rebuildGraph?(): Promise<void>;
  
  // Search
  search(query: string, opts?: LocalSearchOptions): Promise<SearchResult>;
  
  // Diagnostics
  explain?(query: string): Promise<QueryPlan>;
  getStatus(): Promise<IndexStatus>;
}

// ============================================================================
// INDEXEDDB SCHEMA TYPES (for Dexie)
// ============================================================================

export interface FileRecord {
  path: string;
  name: string;
  mtime: number;
  size: number;
  hash: string;
}

export interface MetaRecord {
  path: string;
  tags: string[];           // indexed with *tags
  headingTexts: string[];   // indexed with *headingTexts
  linkPaths: string[];      // indexed with *linkPaths
  meta: MetaDoc;            // full metadata JSON
}

export interface TagIndexRecord {
  tag: string;
  path: string;
  id?: string;              // compound key [tag+path]
}

export interface PropIndexRecord {
  key: string;
  value: string | number | boolean;
  path: string;
  id?: string;              // compound key [key+value+path]
}

export interface LinkIndexRecord {
  srcPath: string;
  dstPath: string;
  id?: string;              // compound key [dstPath+srcPath]
}

export interface BlockIndexRecord {
  path: string;
  blockId: string;
  line: number;
  id?: string;              // compound key [path+blockId]
}

export interface TaskIndexRecord {
  path: string;
  line: number;
  done: boolean;
  text: string;
  id?: string;              // compound key [path+line]
}

