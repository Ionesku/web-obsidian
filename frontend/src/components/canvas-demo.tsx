'use client';

/**
 * Complete Canvas Demo with Sidebar and Controls
 */
import React, { useState, useRef, useCallback } from 'react';
import { InfiniteCanvas } from './infinite-canvas';
import { CanvasSidebar } from './canvas-sidebar';
import { notesDB } from '@/lib/db';
import type { CanvasControls } from '@/lib/canvas/types';

export function CanvasDemo() {
  const [canvasControls, setCanvasControls] = useState<CanvasControls | null>(null);
  const [selectedObjects, setSelectedObjects] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle canvas ready
   */
  const handleCanvasReady = useCallback((controls: CanvasControls) => {
    setCanvasControls(controls);
  }, []);

  /**
   * Handle selection change
   */
  const handleSelectionChange = useCallback((selected: any[]) => {
    setSelectedObjects(selected);
  }, []);

  /**
   * Create new note and go to editor
   */
  const handleCreateNote = async () => {
    try {
      const newNoteId = await notesDB.saveNote({
        title: 'Untitled Canvas Note',
        content: '# New Note\n\nStart writing...',
      });

      alert(`Note created! ID: ${newNoteId}\nGo to /editor to edit it.`);
    } catch (error) {
      console.error('Error creating note:', error);
      alert('Failed to create note');
    }
  };

  /**
   * Save canvas state
   */
  const handleSave = () => {
    if (!canvasControls) return;

    const json = canvasControls.saveToJSON();
    
    // Save to localStorage
    localStorage.setItem('canvas-state', json);
    
    // Also download as file
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `canvas-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    alert('Canvas saved to localStorage and downloaded!');
  };

  /**
   * Load canvas state
   */
  const handleLoad = () => {
    if (!canvasControls) return;

    const saved = localStorage.getItem('canvas-state');
    if (saved) {
      canvasControls.loadFromJSON(saved);
      alert('Canvas loaded from localStorage!');
    } else {
      alert('No saved canvas found in localStorage');
    }
  };

  /**
   * Load from file
   */
  const handleLoadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canvasControls || !e.target.files?.[0]) return;

    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        canvasControls.loadFromJSON(content);
        alert('Canvas loaded from file!');
      }
    };

    reader.readAsText(file);
  };

  /**
   * Delete selected objects
   */
  const handleDelete = () => {
    if (selectedObjects.length === 0) {
      alert('No objects selected');
      return;
    }

    if (confirm(`Delete ${selectedObjects.length} selected object(s)?`)) {
      selectedObjects.forEach((obj) => {
        // Note: You'd need to add a method to canvas controls to delete specific objects
        console.log('Deleting:', obj);
      });
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <CanvasSidebar onCreateNote={handleCreateNote} />

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Control Bar */}
        <div className="bg-white border-b border-gray-300 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">🎨 Infinite Canvas</h1>
            <span className="text-sm text-gray-500">
              {selectedObjects.length > 0 && `(${selectedObjects.length} selected)`}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 border border-gray-300 rounded-lg">
              <button
                onClick={() => canvasControls?.zoomOut()}
                className="px-3 py-1.5 hover:bg-gray-100 transition"
                title="Zoom Out"
              >
                🔍−
              </button>
              <button
                onClick={() => canvasControls?.resetZoom()}
                className="px-3 py-1.5 border-x border-gray-300 hover:bg-gray-100 transition"
                title="Reset Zoom"
              >
                100%
              </button>
              <button
                onClick={() => canvasControls?.zoomIn()}
                className="px-3 py-1.5 hover:bg-gray-100 transition"
                title="Zoom In"
              >
                🔍+
              </button>
            </div>

            {/* Fit to Screen */}
            <button
              onClick={() => canvasControls?.fitToScreen()}
              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
              title="Fit to Screen"
            >
              📐 Fit
            </button>

            {/* Save/Load */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleSave}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                title="Save Canvas"
              >
                💾 Save
              </button>
              <button
                onClick={handleLoad}
                className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                title="Load Canvas"
              >
                📂 Load
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                title="Load from File"
              >
                📁
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleLoadFile}
                className="hidden"
              />
            </div>

            {/* Export */}
            <button
              onClick={() => canvasControls?.exportToPNG()}
              className="px-3 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
              title="Export as PNG"
            >
              📷 PNG
            </button>

            {/* Clear */}
            <button
              onClick={() => canvasControls?.clear()}
              className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
              title="Clear Canvas"
            >
              🗑️ Clear
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <InfiniteCanvas
            onCanvasReady={handleCanvasReady}
            onSelectionChange={handleSelectionChange}
          />
        </div>

        {/* Bottom Help Bar */}
        <div className="bg-gray-800 text-white p-2 text-xs flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span>💡 <strong>Tips:</strong></span>
            <span>• Drag notes from sidebar</span>
            <span>• Shift+Drag to pan</span>
            <span>• Mouse wheel to zoom</span>
            <span>• Click "Connect" then click two cards</span>
          </div>
          <div>
            <a
              href="/editor"
              className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700 transition"
            >
              ✏️ Go to Editor
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CanvasDemo;

