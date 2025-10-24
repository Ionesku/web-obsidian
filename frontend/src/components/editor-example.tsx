'use client';

/**
 * Example usage of the Markdown Editor
 */
import React, { useState, useEffect } from 'react';
import { MarkdownEditor } from './markdown-editor';
import { notesDB, Note } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

/**
 * Editor Demo Component
 */
export function EditorDemo() {
  const [currentNoteId, setCurrentNoteId] = useState<number | undefined>();
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get all notes for sidebar
  const allNotes = useLiveQuery(() => notesDB.getAllNotes(), []);

  /**
   * Load a specific note
   */
  const loadNote = async (id: number) => {
    setIsLoading(true);
    try {
      const note = await notesDB.getNote(id);
      if (note) {
        setCurrentNote(note);
        setCurrentNoteId(id);
      }
    } catch (error) {
      console.error('Error loading note:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Create a new note
   */
  const createNewNote = async () => {
    try {
      const newNoteId = await notesDB.saveNote({
        title: 'Untitled Note',
        content: '# Untitled Note\n\nStart writing...',
      });
      await loadNote(newNoteId);
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };

  /**
   * Delete current note
   */
  const deleteCurrentNote = async () => {
    if (!currentNoteId) return;
    
    const confirmed = window.confirm('Are you sure you want to delete this note?');
    if (!confirmed) return;

    try {
      await notesDB.deleteNote(currentNoteId);
      setCurrentNote(null);
      setCurrentNoteId(undefined);
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  /**
   * Handle note save
   */
  const handleSave = async (content: string) => {
    if (!currentNoteId || !currentNote) return;

    try {
      await notesDB.saveNote({
        id: currentNoteId,
        title: currentNote.title,
        content,
      });
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  /**
   * Load first note on mount
   */
  useEffect(() => {
    if (!currentNoteId && allNotes && allNotes.length > 0) {
      loadNote(allNotes[0].id!);
    }
  }, [allNotes, currentNoteId]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <button
            onClick={createNewNote}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            ➕ New Note
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <h3 className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
              All Notes ({allNotes?.length || 0})
            </h3>
            {allNotes?.map((note) => (
              <button
                key={note.id}
                onClick={() => loadNote(note.id!)}
                className={`w-full text-left px-3 py-2 rounded mb-1 transition-colors ${
                  currentNoteId === note.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'hover:bg-gray-100'
                }`}
              >
                <div className="font-medium truncate">{note.title}</div>
                <div className="text-xs text-gray-500">
                  {new Date(note.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </div>

        {currentNoteId && (
          <div className="p-4 border-t">
            <button
              onClick={deleteCurrentNote}
              className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              🗑️ Delete Note
            </button>
          </div>
        )}
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col">
        {currentNote ? (
          <>
            {/* Header */}
            <div className="bg-white border-b p-4">
              <input
                type="text"
                value={currentNote.title}
                onChange={(e) => {
                  setCurrentNote({ ...currentNote, title: e.target.value });
                  notesDB.saveNote({
                    id: currentNoteId,
                    title: e.target.value,
                    content: currentNote.content,
                  });
                }}
                className="text-2xl font-bold w-full outline-none"
                placeholder="Note title..."
              />
            </div>

            {/* Editor */}
            <div className="flex-1 bg-white">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-500">Loading...</div>
                </div>
              ) : (
                <MarkdownEditor
                  key={currentNoteId}
                  initialContent={currentNote.content}
                  noteId={currentNoteId}
                  onSave={handleSave}
                  vimMode={false}
                  autoSave={true}
                  autoSaveDelay={1000}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <p className="text-xl mb-4">No note selected</p>
              <button
                onClick={createNewNote}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Create your first note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EditorDemo;

