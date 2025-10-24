'use client';

/**
 * Infinite Canvas Component using Fabric.js
 * Features: Pan, Zoom, Drag & Drop, Connections, Save/Load
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import {
  createNoteCard,
  createTextBlock,
  createConnection,
  updateConnection,
  generateId,
  getRandomColor,
} from '@/lib/canvas/utils';
import type {
  NoteCardData,
  CanvasState,
  DraggedNote,
  CanvasControls,
} from '@/lib/canvas/types';

interface InfiniteCanvasProps {
  onCanvasReady?: (controls: CanvasControls) => void;
  onSelectionChange?: (selected: any[]) => void;
  className?: string;
}

export function InfiniteCanvas({
  onCanvasReady,
  onSelectionChange,
  className = '',
}: InfiniteCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPanning, setIsPanning] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isDrawingConnection, setIsDrawingConnection] = useState(false);
  const [connectionStart, setConnectionStart] = useState<fabric.Object | null>(null);
  const [tempLine, setTempLine] = useState<fabric.Line | null>(null);

  // Store connections for updating
  const connectionsRef = useRef<Map<string, { from: string; to: string; line: fabric.Group }>>(
    new Map()
  );

  /**
   * Initialize Fabric.js canvas
   */
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      backgroundColor: '#f9fafb',
      selection: true,
      renderOnAddRemove: true,
    });

    fabricCanvasRef.current = canvas;

    // Handle window resize
    const handleResize = () => {
      if (containerRef.current) {
        canvas.setWidth(containerRef.current.clientWidth);
        canvas.setHeight(containerRef.current.clientHeight);
        canvas.renderAll();
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
    };
  }, []);

  /**
   * Setup pan and zoom functionality
   */
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    let lastPosX = 0;
    let lastPosY = 0;

    // Mouse wheel zoom
    const handleWheel = (opt: any) => {
      const evt = opt.e;
      evt.preventDefault();
      evt.stopPropagation();

      const delta = evt.deltaY;
      let newZoom = canvas.getZoom();
      newZoom *= 0.999 ** delta;

      // Limit zoom
      if (newZoom > 5) newZoom = 5;
      if (newZoom < 0.1) newZoom = 0.1;

      // Zoom to mouse point
      canvas.zoomToPoint({ x: evt.offsetX, y: evt.offsetY }, newZoom);
      setZoom(newZoom);

      opt.e.preventDefault();
      opt.e.stopPropagation();
    };

    // Panning with mouse drag (middle button or space+drag)
    const handleMouseDown = (opt: any) => {
      const evt = opt.e;

      // Middle mouse button or space key
      if (evt.button === 1 || (evt.button === 0 && evt.shiftKey)) {
        setIsPanning(true);
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
        canvas.selection = false;
      }
    };

    const handleMouseMove = (opt: any) => {
      if (!isPanning) return;

      const evt = opt.e;
      const vpt = canvas.viewportTransform!;
      vpt[4] += evt.clientX - lastPosX;
      vpt[5] += evt.clientY - lastPosY;
      canvas.requestRenderAll();
      lastPosX = evt.clientX;
      lastPosY = evt.clientY;
    };

    const handleMouseUp = () => {
      if (isPanning) {
        setIsPanning(false);
        canvas.selection = true;
      }
    };

    // Add event listeners
    canvas.on('mouse:wheel', handleWheel);
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    // Cleanup
    return () => {
      canvas.off('mouse:wheel', handleWheel);
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [isPanning]);

  /**
   * Update connections when objects move
   */
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleObjectMoving = (e: any) => {
      const movedObject = e.target;
      const movedId = (movedObject as any).id;

      if (!movedId) return;

      // Update all connections related to this object
      connectionsRef.current.forEach((conn, connId) => {
        if (conn.from === movedId || conn.to === movedId) {
          const fromObj = canvas.getObjects().find((obj) => (obj as any).id === conn.from);
          const toObj = canvas.getObjects().find((obj) => (obj as any).id === conn.to);

          if (fromObj && toObj) {
            updateConnection(conn.line, fromObj, toObj);
            canvas.renderAll();
          }
        }
      });
    };

    canvas.on('object:moving', handleObjectMoving);

    return () => {
      canvas.off('object:moving', handleObjectMoving);
    };
  }, []);

  /**
   * Handle selection changes
   */
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleSelection = () => {
      const selected = canvas.getActiveObjects();
      onSelectionChange?.(selected);
    };

    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', handleSelection);

    return () => {
      canvas.off('selection:created', handleSelection);
      canvas.off('selection:updated', handleSelection);
      canvas.off('selection:cleared', handleSelection);
    };
  }, [onSelectionChange]);

  /**
   * Handle drag and drop from file explorer
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const data = e.dataTransfer.getData('application/json');
      if (!data) return;

      try {
        const note: DraggedNote = JSON.parse(data);

        // Get drop position relative to canvas viewport
        const rect = canvasRef.current!.getBoundingClientRect();
        const point = new fabric.Point(e.clientX - rect.left, e.clientY - rect.top);
        const transformedPoint = fabric.util.transformPoint(
          point,
          fabric.util.invertTransform(canvas.viewportTransform!)
        );

        // Create note card
        const noteCardData: NoteCardData = {
          id: generateId(),
          type: 'note-card',
          title: note.title,
          content: note.content,
          noteId: note.id,
          x: transformedPoint.x,
          y: transformedPoint.y,
          width: 250,
          height: 150,
          backgroundColor: getRandomColor(),
          tags: note.tags,
        };

        const noteCard = createNoteCard(noteCardData);
        canvas.add(noteCard);
        canvas.setActiveObject(noteCard);
        canvas.renderAll();
      } catch (error) {
        console.error('Error dropping note:', error);
      }
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  /**
   * Add text block
   */
  const addTextBlock = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const center = canvas.getCenter();
    const textBlock = createTextBlock('Double-click to edit', center.left, center.top);
    canvas.add(textBlock);
    canvas.setActiveObject(textBlock);
    canvas.renderAll();
  }, []);

  /**
   * Start drawing connection
   */
  const startConnection = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const selected = canvas.getActiveObject();
    if (!selected || !(selected as any).id) {
      alert('Please select a card first');
      return;
    }

    setIsDrawingConnection(true);
    setConnectionStart(selected);
  }, []);

  /**
   * Complete connection
   */
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isDrawingConnection) return;

    const handleClick = (e: any) => {
      if (!connectionStart) return;

      const target = e.target;
      if (!target || !(target as any).id || target === connectionStart) {
        // Cancel connection
        setIsDrawingConnection(false);
        setConnectionStart(null);
        if (tempLine) {
          canvas.remove(tempLine);
          setTempLine(null);
        }
        return;
      }

      // Create connection
      const connection = createConnection(connectionStart, target);
      canvas.add(connection);

      // Store connection reference
      const connId = (connection as any).id;
      connectionsRef.current.set(connId, {
        from: (connectionStart as any).id,
        to: (target as any).id,
        line: connection,
      });

      // Reset state
      setIsDrawingConnection(false);
      setConnectionStart(null);
      if (tempLine) {
        canvas.remove(tempLine);
        setTempLine(null);
      }

      canvas.renderAll();
    };

    canvas.on('mouse:down', handleClick);

    return () => {
      canvas.off('mouse:down', handleClick);
    };
  }, [isDrawingConnection, connectionStart, tempLine]);

  /**
   * Group selected objects
   */
  const groupSelected = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeSelection = canvas.getActiveObject();
    if (!activeSelection || activeSelection.type !== 'activeSelection') {
      alert('Please select multiple objects to group');
      return;
    }

    const group = (activeSelection as fabric.ActiveSelection).toGroup();
    (group as any).id = generateId();
    canvas.renderAll();
  }, []);

  /**
   * Ungroup selected group
   */
  const ungroupSelected = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'group') {
      alert('Please select a group to ungroup');
      return;
    }

    (activeObject as fabric.Group).toActiveSelection();
    canvas.renderAll();
  }, []);

  /**
   * Save canvas to JSON
   */
  const saveToJSON = useCallback((): string => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return '';

    const state: CanvasState = {
      version: '1.0',
      timestamp: Date.now(),
      viewport: {
        zoom: canvas.getZoom(),
        panX: canvas.viewportTransform![4],
        panY: canvas.viewportTransform![5],
      },
      objects: canvas.getObjects().map((obj) => ({
        ...((obj as any).customData || {}),
        fabricJSON: obj.toJSON(),
      })),
    };

    return JSON.stringify(state, null, 2);
  }, []);

  /**
   * Load canvas from JSON
   */
  const loadFromJSON = useCallback((jsonString: string) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    try {
      const state: CanvasState = JSON.parse(jsonString);

      // Clear canvas
      canvas.clear();
      canvas.backgroundColor = '#f9fafb';
      connectionsRef.current.clear();

      // Restore viewport
      if (state.viewport) {
        canvas.setZoom(state.viewport.zoom);
        canvas.viewportTransform![4] = state.viewport.panX;
        canvas.viewportTransform![5] = state.viewport.panY;
        setZoom(state.viewport.zoom);
      }

      // Restore objects
      state.objects.forEach((objData: any) => {
        if (objData.fabricJSON) {
          fabric.util.enlivenObjects([objData.fabricJSON], (objects: fabric.Object[]) => {
            objects.forEach((obj) => {
              (obj as any).customData = objData;
              canvas.add(obj);
            });
            canvas.renderAll();
          });
        }
      });
    } catch (error) {
      console.error('Error loading canvas:', error);
      alert('Failed to load canvas state');
    }
  }, []);

  /**
   * Export canvas controls
   */
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const controls: CanvasControls = {
      zoomIn: () => {
        const canvas = fabricCanvasRef.current!;
        const newZoom = Math.min(canvas.getZoom() * 1.2, 5);
        canvas.setZoom(newZoom);
        setZoom(newZoom);
        canvas.renderAll();
      },
      zoomOut: () => {
        const canvas = fabricCanvasRef.current!;
        const newZoom = Math.max(canvas.getZoom() / 1.2, 0.1);
        canvas.setZoom(newZoom);
        setZoom(newZoom);
        canvas.renderAll();
      },
      resetZoom: () => {
        const canvas = fabricCanvasRef.current!;
        canvas.setZoom(1);
        canvas.viewportTransform![4] = 0;
        canvas.viewportTransform![5] = 0;
        setZoom(1);
        canvas.renderAll();
      },
      fitToScreen: () => {
        const canvas = fabricCanvasRef.current!;
        const objects = canvas.getObjects();
        if (objects.length === 0) return;

        const group = new fabric.Group(objects);
        const bound = group.getBoundingRect();

        const canvasWidth = canvas.getWidth();
        const canvasHeight = canvas.getHeight();
        const zoomX = canvasWidth / (bound.width + 100);
        const zoomY = canvasHeight / (bound.height + 100);
        const newZoom = Math.min(zoomX, zoomY, 2);

        canvas.setZoom(newZoom);
        canvas.viewportTransform![4] = (canvasWidth - bound.width * newZoom) / 2 - bound.left * newZoom;
        canvas.viewportTransform![5] = (canvasHeight - bound.height * newZoom) / 2 - bound.top * newZoom;
        setZoom(newZoom);
        canvas.renderAll();
      },
      saveToJSON,
      loadFromJSON,
      exportToPNG: () => {
        const canvas = fabricCanvasRef.current!;
        const dataURL = canvas.toDataURL({
          format: 'png',
          quality: 1,
        });
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `canvas-${Date.now()}.png`;
        link.click();
      },
      clear: () => {
        const canvas = fabricCanvasRef.current!;
        if (confirm('Are you sure you want to clear the canvas?')) {
          canvas.clear();
          canvas.backgroundColor = '#f9fafb';
          connectionsRef.current.clear();
          canvas.renderAll();
        }
      },
    };

    onCanvasReady?.(controls);
  }, [saveToJSON, loadFromJSON, onCanvasReady]);

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <canvas
        ref={canvasRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border border-gray-300"
      />

      {/* Toolbar */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-2 flex gap-2">
        <button
          onClick={addTextBlock}
          className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          title="Add Text Block"
        >
          📝 Text
        </button>
        <button
          onClick={startConnection}
          className={`px-3 py-2 rounded transition ${
            isDrawingConnection
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          title="Draw Connection"
        >
          🔗 Connect
        </button>
        <button
          onClick={groupSelected}
          className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
          title="Group Selected"
        >
          📦 Group
        </button>
        <button
          onClick={ungroupSelected}
          className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
          title="Ungroup Selected"
        >
          📂 Ungroup
        </button>
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg px-4 py-2">
        <span className="text-sm font-mono">{Math.round(zoom * 100)}%</span>
      </div>

      {/* Instructions */}
      {isDrawingConnection && (
        <div className="absolute top-20 left-4 bg-green-100 border border-green-400 rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-green-800">
            Click on another card to create connection
          </p>
          <p className="text-xs text-green-600">Click elsewhere to cancel</p>
        </div>
      )}
    </div>
  );
}

export default InfiniteCanvas;

