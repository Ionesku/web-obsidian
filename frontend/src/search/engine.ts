// ============================================================================
// SEARCH ENGINE - Main entry point for search functionality
// ============================================================================

import { db } from './idb';
import { federatedSearch } from './parser/federation';
import { hashContent } from './parser/md';
import type {
  SearchEngine,
  IndexFilePayload,
  SearchResult,
  LocalSearchOptions,
  IndexStatus,
  WorkerMessage,
  WorkerResponse,
} from './types';

class ObsidianSearchEngine implements SearchEngine {
  private worker: Worker | null = null;
  private workerReady = false;
  private status: IndexStatus = {
    state: 'idle',
    filesIndexed: 0,
    totalFiles: 0,
    queueSize: 0,
  };

  constructor() {
    this.initWorker();
  }

  // Initialize web worker
  private initWorker() {
    try {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
        this.status.state = 'error';
      };

      this.workerReady = true;
    } catch (error) {
      console.error('Failed to initialize worker:', error);
      this.workerReady = false;
    }
  }

  // Handle worker responses
  private handleWorkerMessage(response: WorkerResponse) {
    switch (response.type) {
      case 'INDEXED':
        if (response.success) {
          console.log(`Indexed: ${response.path}`);
        } else {
          console.error(`Failed to index ${response.path}:`, response.error);
        }
        break;

      case 'DELETED':
        if (response.success) {
          console.log(`Deleted: ${response.path}`);
        }
        break;

      case 'GRAPH_REBUILT':
        if (response.success) {
          console.log('Graph rebuilt:', response.stats);
        }
        break;

      case 'STATUS':
        this.status = response.payload;
        break;
    }
  }

  // Send message to worker
  private postToWorker(message: WorkerMessage) {
    if (this.worker && this.workerReady) {
      this.worker.postMessage(message);
    } else {
      console.warn('Worker not ready, message queued');
    }
  }

  // Index a file
  async indexLocal(file: IndexFilePayload): Promise<void> {
    // Calculate hash if not provided
    const hash = file.hash || hashContent(file.content);

    this.postToWorker({
      type: 'INDEX_FILE',
      payload: { ...file, hash },
    });
  }

  // Delete a file from index
  async deleteLocal(path: string): Promise<void> {
    this.postToWorker({
      type: 'DELETE_FILE',
      payload: { path },
    });
  }

  // Rebuild backlink graph
  async rebuildGraph(): Promise<void> {
    this.postToWorker({
      type: 'REBUILD_GRAPH',
    });
  }

  // Perform search
  async search(query: string, opts?: LocalSearchOptions): Promise<SearchResult> {
    return await federatedSearch(query, opts);
  }

  // Get index status
  async getStatus(): Promise<IndexStatus> {
    return this.status;
  }

  // Batch index multiple files
  async indexBatch(files: IndexFilePayload[]): Promise<void> {
    for (const file of files) {
      await this.indexLocal(file);
    }
  }

  // Clear entire index (for reindexing)
  async clearIndex(): Promise<void> {
    await db.transaction('rw', [db.files, db.meta, db.tagIndex, db.propIndex, db.linkIndex, db.blocks, db.tasks], async () => {
      await Promise.all([
        db.files.clear(),
        db.meta.clear(),
        db.tagIndex.clear(),
        db.propIndex.clear(),
        db.linkIndex.clear(),
        db.blocks.clear(),
        db.tasks.clear(),
      ]);
    });

    this.status = {
      state: 'idle',
      filesIndexed: 0,
      totalFiles: 0,
      queueSize: 0,
    };
  }

  // Get index statistics
  async getStats() {
    return await db.getStats();
  }
}

// Singleton instance
export const searchEngine = new ObsidianSearchEngine();

// Initialize on load
export function initSearchEngine() {
  console.log('Search engine initialized');
  return searchEngine;
}

