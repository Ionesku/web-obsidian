/**
 * TypeScript interfaces for infinite canvas objects
 */

export interface NoteCardData {
  id: string;
  type: 'note-card';
  title: string;
  content: string;
  noteId?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor: string;
  tags?: string[];
}

export interface TextBlockData {
  id: string;
  type: 'text-block';
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
}

export interface ConnectionData {
  id: string;
  type: 'connection';
  from: string; // Source object ID
  to: string; // Target object ID
  fromPoint?: { x: number; y: number };
  toPoint?: { x: number; y: number };
  color: string;
  strokeWidth: number;
  arrowType: 'none' | 'arrow' | 'double';
}

export interface GroupData {
  id: string;
  type: 'group';
  name: string;
  objects: string[]; // IDs of objects in group
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor: string;
  borderColor: string;
}

export interface CanvasState {
  version: string;
  timestamp: number;
  viewport: {
    zoom: number;
    panX: number;
    panY: number;
  };
  objects: (NoteCardData | TextBlockData | ConnectionData | GroupData)[];
}

export interface CanvasConfig {
  width: number;
  height: number;
  backgroundColor: string;
  gridSize: number;
  showGrid: boolean;
  minZoom: number;
  maxZoom: number;
}

export interface DraggedNote {
  id: number;
  title: string;
  content: string;
  tags?: string[];
}

export interface CanvasObject {
  id: string;
  type: 'note-card' | 'text-block' | 'connection' | 'group';
  fabricObject?: fabric.Object;
}

export interface Point {
  x: number;
  y: number;
}

export interface CanvasControls {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitToScreen: () => void;
  saveToJSON: () => string;
  loadFromJSON: (json: string) => void;
  exportToPNG: () => void;
  clear: () => void;
}

