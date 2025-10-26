// ============================================================================
// WEB WORKER - Background indexing and parsing
// ============================================================================

import { db } from './idb';
import { parseMarkdownOptimized, hashContent } from './parser/md-optimized';
import type { WorkerMessage, WorkerResponse, IndexStatus } from './types';

// Worker state
let status: IndexStatus = {
  state: 'idle',
  filesIndexed: 0,
  totalFiles: 0,
  queueSize: 0,
};

// Message queue for batching
const indexQueue: Array<{ path: string; content: string; mtime: number; hash: string }> = [];
let processingBatch = false;
const MAX_QUEUE_SIZE = 1000; // Prevent memory leak

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;
  
  try {
    switch (type) {
      case 'INDEX_FILE':
        await handleIndexFile(payload);
        break;
        
      case 'DELETE_FILE':
        await handleDeleteFile(payload.path);
        break;
        
      case 'REBUILD_GRAPH':
        await handleRebuildGraph();
        break;
        
      case 'GET_STATUS':
        sendResponse({ type: 'STATUS', payload: status });
        break;
    }
  } catch (error) {
    console.error('Worker error:', error);
    status.state = 'error';
  }
};

// ============================================================================
// INDEX FILE
// ============================================================================

async function handleIndexFile(payload: { path: string; content: string; mtime: number; hash: string }) {
  // Check queue size to prevent memory leak
  if (indexQueue.length >= MAX_QUEUE_SIZE) {
    console.warn(`Queue is full (${MAX_QUEUE_SIZE} items), dropping oldest item`);
    indexQueue.shift(); // Remove oldest item
  }
  
  // Add to queue
  indexQueue.push(payload);
  status.queueSize = indexQueue.length;
  
  // Start processing if not already running
  if (!processingBatch) {
    await processBatch();
  }
}

async function processBatch() {
  processingBatch = true;
  status.state = 'indexing';
  
  const BATCH_SIZE = 50;
  
  while (indexQueue.length > 0) {
    const batch = indexQueue.splice(0, BATCH_SIZE);
    status.queueSize = indexQueue.length;
    status.totalFiles += batch.length;
    
    for (const item of batch) {
      try {
        await indexFile(item);
        status.filesIndexed++;
        
        sendResponse({
          type: 'INDEXED',
          path: item.path,
          success: true,
        });
      } catch (error) {
        console.error(`Failed to index ${item.path}:`, error);
        sendResponse({
          type: 'INDEXED',
          path: item.path,
          success: false,
          error: String(error),
        });
      }
    }
    
    // Yield to main thread between batches
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  status.state = 'idle';
  status.lastIndexed = Date.now();
  processingBatch = false;
}

async function indexFile(item: { path: string; content: string; mtime: number; hash: string }) {
  // Check if file changed
  const existing = await db.getFileRecord(item.path);
  if (existing && existing.hash === item.hash) {
    // No changes, skip
    return;
  }
  
  // Parse markdown (optimized single-pass parser)
  const meta = parseMarkdownOptimized(item.path, item.content);
  
  // Get file name from path
  const name = item.path.split('/').pop() || item.path;
  
  // Upsert to database
  await db.upsertFile(
    {
      path: item.path,
      name,
      mtime: item.mtime,
      size: item.content.length,
      hash: item.hash,
    },
    meta
  );
}

// ============================================================================
// DELETE FILE
// ============================================================================

async function handleDeleteFile(path: string) {
  try {
    await db.deleteFile(path);
    sendResponse({
      type: 'DELETED',
      path,
      success: true,
    });
  } catch (error) {
    console.error(`Failed to delete ${path}:`, error);
    sendResponse({
      type: 'DELETED',
      path,
      success: false,
    });
  }
}

// ============================================================================
// REBUILD GRAPH
// ============================================================================

async function handleRebuildGraph() {
  try {
    status.state = 'indexing';
    const stats = await db.rebuildBacklinks();
    status.state = 'idle';
    
    sendResponse({
      type: 'GRAPH_REBUILT',
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Failed to rebuild graph:', error);
    status.state = 'error';
    sendResponse({
      type: 'GRAPH_REBUILT',
      success: false,
      stats: { files: 0, links: 0 },
    });
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function sendResponse(response: WorkerResponse) {
  self.postMessage(response);
}

// Export for TypeScript
export {};

