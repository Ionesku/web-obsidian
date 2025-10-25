import { useCallback, useRef, useMemo, useEffect, useState } from 'react';

// Fast hash function (FNV-1a)
function fastHash(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

// Exponential backoff with jitter
function getBackoffDelay(attempt: number): number {
  const base = 1000;
  const max = 30000;
  const delay = Math.min(base * Math.pow(2, attempt), max);
  return delay + Math.random() * 1000; // Add jitter
}

export type SaveStatus = 
  | 'idle' 
  | 'saving' 
  | 'saved' 
  | 'error' 
  | 'offline' 
  | 'conflict';

interface UseAutosaveOptions {
  onSave: (content: string, etag?: string) => Promise<{ etag?: string }>;
  debounceMs?: number;
  maxWaitMs?: number;
  enabled?: boolean;
  debug?: boolean;
  onConflict?: (localContent: string, serverEtag: string) => void;
}

interface UseAutosaveReturn {
  save: (content: string, immediate?: boolean) => void;
  status: SaveStatus;
  lastSaved: Date | null;
  error: string | null;
  forceFlush: () => void;
  reset: () => void;
}

export function useAutosave({
  onSave,
  debounceMs = 500,
  maxWaitMs = 5000,
  enabled = true,
  debug = false,
  onConflict,
}: UseAutosaveOptions): UseAutosaveReturn {
  
  const log = useCallback((...args: any[]) => {
    if (debug) {
      console.log(...args);
    }
  }, [debug]);
  
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for state that shouldn't trigger re-renders
  const latestContentRef = useRef<string | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);
  const etagRef = useRef<string | null>(null);
  const lastSavedHashRef = useRef<string>('');
  const retryCountRef = useRef<number>(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxWaitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastChangeTimeRef = useRef<number>(Date.now());

  // Cleanup function
  const cleanup = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    if (maxWaitTimeoutRef.current) {
      clearTimeout(maxWaitTimeoutRef.current);
      maxWaitTimeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (inFlightRef.current) {
      inFlightRef.current.abort();
      inFlightRef.current = null;
    }
  }, []);

  // The actual save function
  const executeSave = useCallback(async (content: string) => {
    // Hash-based deduplication
    const hash = fastHash(content);
    if (hash === lastSavedHashRef.current) {
      log('⏭️  Skipping save (content unchanged)');
      setStatus('saved');
      return;
    }

    // If already saving, queue this content
    if (inFlightRef.current) {
      log('⏳ Queueing save (request in flight)');
      latestContentRef.current = content;
      return;
    }

    const ac = new AbortController();
    inFlightRef.current = ac;
    setStatus('saving');
    setError(null);

    try {
      log('💾 Saving...', { hash, etag: etagRef.current });
      
      const result = await onSave(content, etagRef.current ?? undefined);
      
      // Success!
      if (result.etag) {
        etagRef.current = result.etag;
      }
      lastSavedHashRef.current = hash;
      retryCountRef.current = 0;
      setStatus('saved');
      setLastSaved(new Date());
      log('✅ Saved successfully');

      // Auto-transition from 'saved' to 'idle' after 2 seconds
      setTimeout(() => {
        setStatus(prev => prev === 'saved' ? 'idle' : prev);
      }, 2000);
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        log('🚫 Save aborted');
        return;
      }

      log('❌ Save failed:', err);

      // Handle different error types
      if (err.status === 412 || err.message?.includes('412')) {
        // ETag conflict
        setStatus('conflict');
        setError('Conflict detected');
        if (onConflict) {
          onConflict(content, etagRef.current || '');
        }
        return;
      }

      if (err.status === 409 || err.status === 412) {
        // Don't retry conflicts
        setStatus('conflict');
        setError('Version conflict');
        return;
      }

      if (!navigator.onLine) {
        setStatus('offline');
        setError('Offline - will retry when online');
        // Queue for retry when back online
        latestContentRef.current = content;
        return;
      }

      // Retry for 5xx errors and 429
      if (
        (err.status >= 500 && err.status < 600) ||
        err.status === 429
      ) {
        retryCountRef.current++;
        if (retryCountRef.current <= 5) {
          const delay = getBackoffDelay(retryCountRef.current - 1);
          setStatus('error');
          setError(`Retrying in ${Math.round(delay / 1000)}s... (attempt ${retryCountRef.current}/5)`);
          log(`🔄 Retry ${retryCountRef.current}/5 in ${delay}ms`);
          
          retryTimeoutRef.current = setTimeout(() => {
            executeSave(content);
          }, delay);
          return;
        }
      }

      // Give up
      setStatus('error');
      setError(err.message || 'Save failed');
      
    } finally {
      inFlightRef.current = null;
      
      // Check if there's queued content to save
      const nextContent = latestContentRef.current;
      latestContentRef.current = null;
      
      if (nextContent && nextContent !== content) {
        log('🔄 Processing queued save');
        setTimeout(() => executeSave(nextContent), 100);
      }
    }
  }, [onSave, onConflict, log]);

  // Debounced save with maxWait
  const debouncedSave = useCallback((content: string, immediate: boolean = false) => {
    if (!enabled) return;

    if (immediate) {
      // Clear all timers and save immediately
      cleanup();
      executeSave(content);
      return;
    }

    // Clear existing debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set up maxWait timeout if not already set
    if (!maxWaitTimeoutRef.current) {
      const timeSinceLastChange = Date.now() - lastChangeTimeRef.current;
      const remainingMaxWait = maxWaitMs - timeSinceLastChange;
      
      if (remainingMaxWait > 0) {
        maxWaitTimeoutRef.current = setTimeout(() => {
          log('⏰ maxWait reached, forcing save');
          maxWaitTimeoutRef.current = null;
          lastChangeTimeRef.current = Date.now();
          executeSave(content);
        }, remainingMaxWait);
      }
    }

    // Set up regular debounce
    debounceTimeoutRef.current = setTimeout(() => {
      debounceTimeoutRef.current = null;
      if (maxWaitTimeoutRef.current) {
        clearTimeout(maxWaitTimeoutRef.current);
        maxWaitTimeoutRef.current = null;
      }
      lastChangeTimeRef.current = Date.now();
      executeSave(content);
    }, debounceMs);
  }, [enabled, debounceMs, maxWaitMs, executeSave, cleanup]);

  // Force flush (save immediately)
  const forceFlush = useCallback(() => {
    if (latestContentRef.current) {
      debouncedSave(latestContentRef.current, true);
    }
  }, [debouncedSave]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      log('🌐 Back online');
      if (latestContentRef.current) {
        executeSave(latestContentRef.current);
      }
    };

    const handleOffline = () => {
      log('📡 Went offline');
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [executeSave, log]);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (latestContentRef.current && navigator.sendBeacon) {
        // Use sendBeacon for reliable final save
        log('📤 Sending beacon save');
        // Note: This would need a special endpoint that accepts beacon POST
        forceFlush();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && latestContentRef.current) {
        log('👁️ Page hidden, forcing save');
        forceFlush();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [forceFlush, log]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Reset to "saved" state (for when loading a file from server)
  const reset = useCallback(() => {
    cleanup();
    setStatus('saved');
    setLastSaved(new Date());
    setError(null);
    lastSavedHashRef.current = ''; // Will be recalculated on next change
  }, [cleanup]);

  return {
    save: debouncedSave,
    status,
    lastSaved,
    error,
    forceFlush,
    reset,
  };
}

