import { SaveStatus } from '@/hooks/useAutosave';
import { Check, Cloud, CloudOff, AlertCircle, Loader2, GitBranch, RefreshCw } from 'lucide-react';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  lastSaved: Date | null;
  error: string | null;
  syncQueueSize?: number;
}

export function SaveStatusIndicator({ status, lastSaved, error, syncQueueSize = 0 }: SaveStatusIndicatorProps) {
  const getStatusDisplay = () => {
    switch (status) {
      case 'saving':
        return (
          <span className="flex items-center gap-1 text-blue-600">
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving...
          </span>
        );
      case 'saved':
        return (
          <span className="flex items-center gap-1 text-green-600">
            <Check className="w-3 h-3" />
            Saved
            {lastSaved && (
              <span className="text-gray-500 ml-1">
                {formatTimeSince(lastSaved)}
              </span>
            )}
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1 text-red-600" title={error || 'Save failed'}>
            <AlertCircle className="w-3 h-3" />
            {error || 'Error'}
          </span>
        );
      case 'offline':
        return (
          <span className="flex items-center gap-1 text-orange-600" title="Offline - changes queued">
            <CloudOff className="w-3 h-3" />
            Offline (queued)
          </span>
        );
      case 'conflict':
        return (
          <span className="flex items-center gap-1 text-purple-600" title="Version conflict detected">
            <GitBranch className="w-3 h-3" />
            Conflict
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-gray-500">
            <Cloud className="w-3 h-3" />
            {lastSaved ? `Saved ${formatTimeSince(lastSaved)}` : 'Unsaved'}
          </span>
        );
    }
  };

  const getSyncDisplay = () => {
    if (syncQueueSize === 0) return null;
    
    return (
      <span className="flex items-center gap-1 text-amber-600 ml-2 px-2 py-0.5 bg-amber-50 rounded" 
            title={`${syncQueueSize} item${syncQueueSize > 1 ? 's' : ''} pending sync`}>
        <RefreshCw className="w-3 h-3 animate-spin" />
        <span className="font-medium">{syncQueueSize}</span>
        {syncQueueSize === 1 ? 'syncing' : 'queued'}
      </span>
    );
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      {getStatusDisplay()}
      {getSyncDisplay()}
    </div>
  );
}

function formatTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString();
}

