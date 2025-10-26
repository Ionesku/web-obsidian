// ============================================================================
// SYNC QUEUE - Manage offline/online synchronization
// ============================================================================

import { db } from './idb';

export interface SyncQueueItem {
  id: string;
  type: 'index' | 'delete';
  path: string;
  content?: string;
  mtime?: number;
  timestamp: number;
  retries: number;
}

class SyncQueue {
  private processing = false;
  private readonly MAX_RETRIES = 3;
  private readonly BATCH_SIZE = 10;

  // Store pending items in IndexedDB
  async enqueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): Promise<void> {
    const queueItem: SyncQueueItem = {
      ...item,
      id: `${item.type}-${item.path}-${Date.now()}`,
      timestamp: Date.now(),
      retries: 0,
    };

    // Store in localStorage as fallback (IndexedDB might be full)
    try {
      const queue = this.getLocalQueue();
      queue.push(queueItem);
      localStorage.setItem('search_sync_queue', JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to enqueue sync item:', e);
    }
  }

  private getLocalQueue(): SyncQueueItem[] {
    try {
      const stored = localStorage.getItem('search_sync_queue');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private setLocalQueue(queue: SyncQueueItem[]): void {
    try {
      localStorage.setItem('search_sync_queue', JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to save queue:', e);
    }
  }

  async processQueue(): Promise<void> {
    if (this.processing) return;
    if (!navigator.onLine) return;

    this.processing = true;

    try {
      const queue = this.getLocalQueue();
      if (queue.length === 0) {
        this.processing = false;
        return;
      }

      console.log(`Processing ${queue.length} queued sync items`);

      // Process in batches
      const batch = queue.splice(0, this.BATCH_SIZE);
      const remaining: SyncQueueItem[] = [];
      const failed: SyncQueueItem[] = [];

      for (const item of batch) {
        try {
          await this.syncItem(item);
          console.log(`Synced: ${item.path}`);
        } catch (error) {
          console.error(`Failed to sync ${item.path}:`, error);
          
          // Retry logic
          if (item.retries < this.MAX_RETRIES) {
            failed.push({ ...item, retries: item.retries + 1 });
          } else {
            console.error(`Giving up on ${item.path} after ${this.MAX_RETRIES} retries`);
          }
        }
      }

      // Update queue
      this.setLocalQueue([...failed, ...queue]);

      // Continue processing if there are more items
      if (queue.length > 0 || failed.length > 0) {
        setTimeout(() => {
          this.processing = false;
          this.processQueue();
        }, 1000);
      } else {
        this.processing = false;
      }

    } catch (error) {
      console.error('Queue processing error:', error);
      this.processing = false;
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    const { api } = await import('@/lib/api');
    
    if (item.type === 'index' && item.content) {
      // Send to server for indexing
      const response = await fetch('/api/search/index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify({
          path: item.path,
          content: item.content,
          name: item.path.split('/').pop() || item.path,
          tags: [], // Will be extracted on server
          props: {},
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
    } else if (item.type === 'delete') {
      // Delete from server index
      const response = await fetch(`/api/search/index/${encodeURIComponent(item.path)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${api.getToken()}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`Server returned ${response.status}`);
      }
    }
  }

  // Clear queue (for testing or after full reindex)
  clearQueue(): void {
    localStorage.removeItem('search_sync_queue');
  }

  // Get queue size
  getQueueSize(): number {
    return this.getLocalQueue().length;
  }

  // Check if queue is empty
  isEmpty(): boolean {
    return this.getQueueSize() === 0;
  }
}

export const syncQueue = new SyncQueue();

// Auto-process queue when coming online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Network reconnected, processing sync queue');
    syncQueue.processQueue();
  });

  // Process on page load if online
  if (navigator.onLine) {
    // Wait a bit for app to initialize
    setTimeout(() => {
      syncQueue.processQueue();
    }, 2000);
  }
}

