'use client';

/**
 * File Explorer Sidebar for Canvas
 * Shows notes from IndexedDB that can be dragged to canvas
 */
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { notesDB, type Note } from '@/lib/db';
import type { DraggedNote } from '@/lib/canvas/types';

interface CanvasSidebarProps {
  onCreateNote?: () => void;
}

export function CanvasSidebar({ onCreateNote }: CanvasSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Get all notes from IndexedDB
  const allNotes = useLiveQuery(() => notesDB.getAllNotes(), []);

  // Filter notes based on search
  const filteredNotes = allNotes?.filter((note) =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /**
   * Handle drag start
   */
  const handleDragStart = (e: React.DragEvent, note: Note) => {
    const dragData: DraggedNote = {
      id: note.id!,
      title: note.title,
      content: note.content,
      tags: note.tags,
    };

    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';

    // Visual feedback
    (e.target as HTMLElement).style.opacity = '0.5';
  };

  /**
   * Handle drag end
   */
  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
  };

  return (
    <div className="w-80 h-full bg-white border-r border-gray-300 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-bold mb-3">📁 Notes Library</h2>

        {/* Search */}
        <input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Create Note Button */}
        <button
          onClick={onCreateNote}
          className="w-full mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
        >
          ➕ Create New Note
        </button>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-blue-50 border-b border-blue-200">
        <p className="text-sm text-blue-800">
          💡 <strong>Drag notes</strong> onto the canvas to add them
        </p>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-2">
        {!allNotes ? (
          <div className="p-4 text-center text-gray-500">Loading notes...</div>
        ) : filteredNotes && filteredNotes.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchQuery ? 'No notes found' : 'No notes yet. Create one!'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotes?.map((note) => (
              <div
                key={note.id}
                draggable
                onDragStart={(e) => handleDragStart(e, note)}
                onDragEnd={handleDragEnd}
                className="p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-blue-400 cursor-move transition group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-gray-900 truncate group-hover:text-blue-600">
                      {note.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {note.content}
                    </p>
                  </div>
                  <div className="ml-2 text-gray-400">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 11l5-5m0 0l5 5m-5-5v12"
                      />
                    </svg>
                  </div>
                </div>

                {/* Tags */}
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {note.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {note.tags.length > 3 && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        +{note.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Date */}
                <div className="text-xs text-gray-400 mt-2">
                  {new Date(note.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-sm text-gray-600">
          <span className="font-medium">{filteredNotes?.length || 0}</span> notes
          {searchQuery && ` matching "${searchQuery}"`}
        </div>
      </div>
    </div>
  );
}

export default CanvasSidebar;

