'use client';

/**
 * Daily Notes Component with Calendar Widget
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Calendar } from './ui/calendar';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, isToday, parseISO } from 'date-fns';
import { notesDB, templatesDB, type Note } from '@/lib/db';
import {
  formatDailyNoteTitle,
  formatDateDisplay,
  substituteVariables,
} from '@/lib/templates';
import { MarkdownEditor } from './markdown-editor';
import { TemplateManager } from './template-manager';

export function DailyNotes() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // Get all daily notes for calendar highlighting
  const dailyNotes = useLiveQuery(() => notesDB.getAllDailyNotes(), []);

  // Get daily note for selected date
  useEffect(() => {
    loadDailyNote(selectedDate);
  }, [selectedDate]);

  /**
   * Load or create daily note for date
   */
  const loadDailyNote = async (date: Date) => {
    setIsLoading(true);
    try {
      const dateStr = formatDailyNoteTitle(date);
      let note = await notesDB.getDailyNote(dateStr);

      if (!note) {
        // Create new daily note from template
        note = await createDailyNote(date);
      }

      setCurrentNote(note);
    } catch (error) {
      console.error('Error loading daily note:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Create daily note from template
   */
  const createDailyNote = async (date: Date): Promise<Note> => {
    const template = await templatesDB.getDefaultTemplate('daily');
    const dateStr = formatDailyNoteTitle(date);

    let content: string;
    if (template) {
      content = substituteVariables(template.content, {
        date: dateStr,
      });
    } else {
      // Fallback if no template
      content = `# ${dateStr}\n\n## 📅 ${formatDateDisplay(date)}\n\n### Notes\n\n`;
    }

    const noteId = await notesDB.saveNote({
      title: dateStr,
      content,
      isDailyNote: true,
      dailyNoteDate: dateStr,
      tags: ['daily-note'],
    });

    return (await notesDB.getNote(noteId))!;
  };

  /**
   * Handle date selection from calendar
   */
  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  }, []);

  /**
   * Check if date has a daily note
   */
  const hasNoteForDate = (date: Date): boolean => {
    const dateStr = formatDailyNoteTitle(date);
    return dailyNotes?.some((note) => note.dailyNoteDate === dateStr) || false;
  };

  /**
   * Get modifiers for calendar
   */
  const calendarModifiers = {
    hasNote: dailyNotes?.map((note) => parseISO(note.dailyNoteDate!)) || [],
  };

  const calendarModifiersStyles = {
    hasNote: {
      fontWeight: 'bold' as const,
      textDecoration: 'underline',
    },
  };

  /**
   * Quick navigation
   */
  const goToToday = () => setSelectedDate(new Date());
  const goToPreviousDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };
  const goToNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar - Calendar */}
      <div className="w-80 bg-white border-r border-gray-300 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold mb-3">📅 Daily Notes</h2>
          <button
            onClick={goToToday}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            disabled={isToday(selectedDate)}
          >
            📍 Today
          </button>
        </div>

        {/* Calendar */}
        <div className="p-4 flex-1 overflow-y-auto">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            modifiers={calendarModifiers}
            modifiersStyles={calendarModifiersStyles}
            className="rounded-md border"
          />

          {/* Legend */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
            <p className="font-medium mb-2">Legend:</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span>Selected date</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-400 rounded"></div>
                <span className="font-bold underline">Has note</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
            <p className="font-medium text-blue-900">
              {dailyNotes?.length || 0} daily notes
            </p>
          </div>
        </div>

        {/* Template Button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            📝 Manage Templates
          </button>
        </div>
      </div>

      {/* Main Content - Editor */}
      <div className="flex-1 flex flex-col">
        {/* Header Bar */}
        <div className="bg-white border-b border-gray-300 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={goToPreviousDay}
              className="px-3 py-1.5 bg-gray-200 rounded hover:bg-gray-300 transition"
              title="Previous day"
            >
              ←
            </button>
            <div>
              <h1 className="text-xl font-bold">{formatDailyNoteTitle(selectedDate)}</h1>
              <p className="text-sm text-gray-600">{formatDateDisplay(selectedDate)}</p>
            </div>
            <button
              onClick={goToNextDay}
              className="px-3 py-1.5 bg-gray-200 rounded hover:bg-gray-300 transition"
              title="Next day"
            >
              →
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isToday(selectedDate) && (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Today
              </span>
            )}
            {hasNoteForDate(selectedDate) && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                ✓ Note exists
              </span>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 bg-white">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading note...</div>
            </div>
          ) : currentNote ? (
            <MarkdownEditor
              key={currentNote.id}
              initialContent={currentNote.content}
              noteId={currentNote.id}
              autoSave={true}
              autoSaveDelay={1000}
              vimMode={false}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p className="text-xl mb-4">No note for this date yet</p>
                <button
                  onClick={() => loadDailyNote(selectedDate)}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  Create Daily Note
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Help Bar */}
        <div className="bg-gray-800 text-white p-2 text-xs flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span>💡 <strong>Tips:</strong></span>
            <span>• Click dates on calendar</span>
            <span>• Use arrow buttons to navigate</span>
            <span>• Notes auto-save</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/editor"
              className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700 transition"
            >
              All Notes
            </a>
            <a
              href="/canvas"
              className="px-3 py-1 bg-purple-600 rounded hover:bg-purple-700 transition"
            >
              Canvas
            </a>
          </div>
        </div>
      </div>

      {/* Template Management Modal */}
      {showTemplates && (
        <TemplateManager onClose={() => setShowTemplates(false)} />
      )}
    </div>
  );
}

export default DailyNotes;

