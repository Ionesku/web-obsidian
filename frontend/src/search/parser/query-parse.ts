// ============================================================================
// QUERY PARSER - Parse search queries into AST
// ============================================================================

import type { QueryAST, Expr, Term, PropOp } from '../types';

export class QueryParser {
  private input: string;
  private pos: number;
  private length: number;

  constructor(input: string) {
    this.input = input.trim();
    this.pos = 0;
    this.length = this.input.length;
  }

  // Main parse method
  parse(): QueryAST {
    const expr = this.parseOrExpr();
    if (this.pos < this.length) {
      throw new Error(`Unexpected character at position ${this.pos}: ${this.input[this.pos]}`);
    }
    return expr;
  }

  // Parse OR expression (lowest precedence)
  private parseOrExpr(): Expr {
    const left = this.parseAndExpr();
    
    this.skipWhitespace();
    if (this.matchKeyword('OR')) {
      const children = [left];
      while (this.matchKeyword('OR')) {
        this.skipWhitespace();
        children.push(this.parseAndExpr());
        this.skipWhitespace();
      }
      return { kind: 'or', children };
    }
    
    return left;
  }

  // Parse AND expression (implicit, higher precedence than OR)
  private parseAndExpr(): Expr {
    const terms: Expr[] = [];
    
    while (this.pos < this.length && !this.peekKeyword('OR') && this.peek() !== ')') {
      this.skipWhitespace();
      if (this.pos >= this.length || this.peek() === ')') break;
      
      terms.push(this.parseNotExpr());
      this.skipWhitespace();
    }
    
    if (terms.length === 0) {
      throw new Error('Expected term');
    }
    if (terms.length === 1) {
      return terms[0];
    }
    
    return { kind: 'and', children: terms };
  }

  // Parse NOT expression
  private parseNotExpr(): Expr {
    this.skipWhitespace();
    
    if (this.peek() === '-') {
      this.consume('-');
      const child = this.parsePrimary();
      return { kind: 'not', child };
    }
    
    return this.parsePrimary();
  }

  // Parse primary term or grouped expression
  private parsePrimary(): Expr {
    this.skipWhitespace();
    
    // Grouped expression
    if (this.peek() === '(') {
      this.consume('(');
      const expr = this.parseOrExpr();
      this.skipWhitespace();
      this.consume(')');
      return expr;
    }
    
    return this.parseTerm();
  }

  // Parse individual term
  private parseTerm(): Term {
    this.skipWhitespace();
    
    // Quoted phrase
    if (this.peek() === '"') {
      return this.parsePhrase();
    }
    
    // Regex
    if (this.peek() === '/') {
      return this.parseRegex();
    }
    
    // Property: [key:value] or [key>=value]
    if (this.peek() === '[') {
      return this.parseProperty();
    }
    
    // Check for prefix operators
    const word = this.peekWord();
    
    if (word.includes(':')) {
      return this.parsePrefixOperator();
    }
    
    // Plain word
    return this.parseWord();
  }

  // Parse quoted phrase
  private parsePhrase(): Term {
    this.consume('"');
    let value = '';
    
    while (this.pos < this.length && this.peek() !== '"') {
      if (this.peek() === '\\' && this.pos + 1 < this.length) {
        this.pos++; // Skip escape
      }
      value += this.input[this.pos++];
    }
    
    if (this.peek() !== '"') {
      throw new Error('Unclosed quote');
    }
    this.consume('"');
    
    return { kind: 'phrase', value };
  }

  // Parse regex /pattern/flags
  private parseRegex(): Term {
    this.consume('/');
    let value = '';
    
    while (this.pos < this.length && this.peek() !== '/') {
      if (this.peek() === '\\' && this.pos + 1 < this.length) {
        value += this.input[this.pos++];
      }
      value += this.input[this.pos++];
    }
    
    if (this.peek() !== '/') {
      throw new Error('Unclosed regex');
    }
    this.consume('/');
    
    // Parse flags (i, g, m, etc.)
    let flags = '';
    while (this.pos < this.length && /[igmsu]/.test(this.peek())) {
      flags += this.input[this.pos++];
    }
    
    return { kind: 'regex', value, flags: flags || undefined };
  }

  // Parse property [key:value] or [key>=value]
  private parseProperty(): Term {
    this.consume('[');
    this.skipWhitespace();
    
    // Parse key
    let key = '';
    while (this.pos < this.length && /[a-zA-Z0-9_-]/.test(this.peek())) {
      key += this.input[this.pos++];
    }
    
    this.skipWhitespace();
    
    // Parse operator
    let op: PropOp = ':';
    if (this.peek() === '>' && this.peekAt(1) === '=') {
      op = '>=';
      this.pos += 2;
    } else if (this.peek() === '<' && this.peekAt(1) === '=') {
      op = '<=';
      this.pos += 2;
    } else if (this.peek() === '!' && this.peekAt(1) === '=') {
      op = '!=';
      this.pos += 2;
    } else if (this.peek() === '>') {
      op = '>';
      this.pos++;
    } else if (this.peek() === '<') {
      op = '<';
      this.pos++;
    } else if (this.peek() === '=' || this.peek() === ':') {
      op = this.input[this.pos] as PropOp;
      this.pos++;
    }
    
    this.skipWhitespace();
    
    // Parse value
    let value: string | number | boolean = '';
    
    // Check for quoted value
    if (this.peek() === '"') {
      this.consume('"');
      while (this.pos < this.length && this.peek() !== '"') {
        if (this.peek() === '\\') this.pos++;
        value += this.input[this.pos++];
      }
      this.consume('"');
    } else {
      // Unquoted value
      while (this.pos < this.length && this.peek() !== ']' && !this.isWhitespace(this.peek())) {
        value += this.input[this.pos++];
      }
      
      // Try to parse as number or boolean
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (/^-?\d+(\.\d+)?$/.test(value)) value = parseFloat(value);
    }
    
    this.skipWhitespace();
    this.consume(']');
    
    return { kind: 'prop', key, op, value };
  }

  // Parse prefix operator (tag:, file:, path:, etc.)
  private parsePrefixOperator(): Term {
    const word = this.readWord();
    const colonIndex = word.indexOf(':');
    
    if (colonIndex === -1) {
      return { kind: 'word', value: word };
    }
    
    const prefix = word.slice(0, colonIndex);
    const value = word.slice(colonIndex + 1);
    
    switch (prefix) {
      case 'tag':
        return { kind: 'tag', value };
      
      case 'file':
        return { kind: 'file', value };
      
      case 'path':
        return { kind: 'path', value };
      
      case 'block':
        return { kind: 'block', id: value };
      
      case 'section':
        // Check if next char is quote
        if (this.peek() === '"') {
          const phrase = this.parsePhrase();
          return { kind: 'section', title: phrase.value };
        }
        return { kind: 'section', title: value };
      
      case 'line':
        // line: followed by another term
        this.skipWhitespace();
        const sub = this.parseTerm();
        return { kind: 'line', sub };
      
      case 'link':
        return { kind: 'link', target: value };
      
      case 'backlink':
        return { kind: 'backlink', target: value };
      
      case 'task':
        if (value === 'done') return { kind: 'task', done: true };
        if (value === 'todo') return { kind: 'task', done: false };
        return { kind: 'task' };
      
      default:
        // Unknown prefix, treat as word
        return { kind: 'word', value: word };
    }
  }

  // Parse plain word
  private parseWord(): Term {
    const value = this.readWord();
    return { kind: 'word', value };
  }

  // ============================================================================
  // LEXER HELPERS
  // ============================================================================

  private peek(): string {
    return this.input[this.pos] || '';
  }

  private peekAt(offset: number): string {
    return this.input[this.pos + offset] || '';
  }

  private consume(expected: string) {
    if (this.peek() !== expected) {
      throw new Error(`Expected '${expected}' at position ${this.pos}, got '${this.peek()}'`);
    }
    this.pos++;
  }

  private peekWord(): string {
    let end = this.pos;
    while (end < this.length && !this.isWhitespace(this.input[end]) && 
           this.input[end] !== ')' && this.input[end] !== '(') {
      end++;
    }
    return this.input.slice(this.pos, end);
  }

  private readWord(): string {
    const word = this.peekWord();
    this.pos += word.length;
    return word;
  }

  private peekKeyword(keyword: string): boolean {
    const saved = this.pos;
    this.skipWhitespace();
    
    if (this.input.slice(this.pos, this.pos + keyword.length) === keyword) {
      const after = this.peekAt(keyword.length);
      if (!after || this.isWhitespace(after) || after === '(' || after === ')') {
        this.pos = saved;
        return true;
      }
    }
    
    this.pos = saved;
    return false;
  }

  private matchKeyword(keyword: string): boolean {
    if (this.peekKeyword(keyword)) {
      this.skipWhitespace();
      this.pos += keyword.length;
      return true;
    }
    return false;
  }

  private skipWhitespace() {
    while (this.pos < this.length && this.isWhitespace(this.peek())) {
      this.pos++;
    }
  }

  private isWhitespace(char: string): boolean {
    return /\s/.test(char);
  }
}

// Convenience function
export function parseQuery(query: string): QueryAST {
  const parser = new QueryParser(query);
  return parser.parse();
}

// ============================================================================
// AST UTILITIES
// ============================================================================

export function stringifyAST(expr: Expr, indent = 0): string {
  const pad = '  '.repeat(indent);
  
  if ('kind' in expr) {
    switch (expr.kind) {
      case 'and':
        return `${pad}AND(\n${expr.children.map(c => stringifyAST(c, indent + 1)).join(',\n')}\n${pad})`;
      case 'or':
        return `${pad}OR(\n${expr.children.map(c => stringifyAST(c, indent + 1)).join(',\n')}\n${pad})`;
      case 'not':
        return `${pad}NOT(\n${stringifyAST(expr.child, indent + 1)}\n${pad})`;
      case 'word':
        return `${pad}word("${expr.value}")`;
      case 'phrase':
        return `${pad}phrase("${expr.value}")`;
      case 'regex':
        return `${pad}regex(/${expr.value}/${expr.flags || ''})`;
      case 'tag':
        return `${pad}tag:${expr.value}`;
      case 'file':
        return `${pad}file:${expr.value}`;
      case 'path':
        return `${pad}path:${expr.value}`;
      case 'prop':
        return `${pad}[${expr.key}${expr.op}${expr.value}]`;
      case 'line':
        return `${pad}line:(\n${stringifyAST(expr.sub as Expr, indent + 1)}\n${pad})`;
      case 'block':
        return `${pad}block:${expr.id}`;
      case 'section':
        return `${pad}section:"${expr.title}"`;
      case 'link':
        return `${pad}link:${expr.target}`;
      case 'backlink':
        return `${pad}backlink:${expr.target}`;
      case 'task':
        return `${pad}task${expr.done !== undefined ? ':' + (expr.done ? 'done' : 'todo') : ''}`;
    }
  }
  
  return `${pad}${JSON.stringify(expr)}`;
}

