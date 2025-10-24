/**
 * Dexie.js database configuration for IndexedDB storage
 */
import Dexie, { Table } from 'dexie';

export interface Note {
  id?: number;
  title: string;
  content: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  vaultId?: string;
  isDailyNote?: boolean;
  dailyNoteDate?: string; // YYYY-MM-DD format
}

export interface Template {
  id?: number;
  name: string;
  type: 'daily' | 'weekly' | 'meeting' | 'custom';
  content: string;
  variables: string[]; // List of variables used in template
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class NotesDatabase extends Dexie {
  notes!: Table<Note>;
  templates!: Table<Template>;

  constructor() {
    super('ObsidianNotesDB');
    
    // Version 1: Original schema
    this.version(1).stores({
      notes: '++id, title, *tags, createdAt, updatedAt, vaultId'
    });

    // Version 2: Add templates and daily notes
    this.version(2).stores({
      notes: '++id, title, *tags, createdAt, updatedAt, vaultId, isDailyNote, dailyNoteDate',
      templates: '++id, name, type, isDefault, createdAt, updatedAt'
    }).upgrade(async (tx) => {
      // Add default templates on upgrade
      await tx.table('templates').bulkAdd([
        {
          name: 'Daily Note',
          type: 'daily',
          content: `# {{date:YYYY-MM-DD}}

## 📅 {{date:dddd, MMMM D, YYYY}}

### 🎯 Goals for Today
- 

### 📝 Notes


### ✅ Completed


### 💭 Reflections


---
Created: {{time:HH:mm}}`,
          variables: ['date', 'time'],
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Weekly Review',
          type: 'weekly',
          content: `# Week of {{date:YYYY-MM-DD}}

## 🗓️ Week {{weekNumber}}

### 🎯 Goals for This Week
- 

### 📊 Progress


### 🏆 Wins


### 📚 Learnings


### ➡️ Next Week


---
Created: {{date:YYYY-MM-DD}} at {{time:HH:mm}}`,
          variables: ['date', 'weekNumber', 'time'],
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Meeting Notes',
          type: 'meeting',
          content: `# Meeting: {{title}}

**Date:** {{date:YYYY-MM-DD}}
**Time:** {{time:HH:mm}}
**Attendees:** 

## 📋 Agenda


## 📝 Notes


## ✅ Action Items
- [ ] 

## 🔗 Related
- 

---
Next meeting: `,
          variables: ['title', 'date', 'time'],
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });
  }
}

// Create singleton instance
export const db = new NotesDatabase();

/**
 * Helper functions for database operations
 */
export const notesDB = {
  /**
   * Get all notes
   */
  async getAllNotes(): Promise<Note[]> {
    return await db.notes.toArray();
  },

  /**
   * Get note by ID
   */
  async getNote(id: number): Promise<Note | undefined> {
    return await db.notes.get(id);
  },

  /**
   * Search notes by title (for autocomplete)
   */
  async searchNotesByTitle(query: string): Promise<Note[]> {
    const lowerQuery = query.toLowerCase();
    return await db.notes
      .filter(note => note.title.toLowerCase().includes(lowerQuery))
      .toArray();
  },

  /**
   * Create or update a note
   */
  async saveNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }): Promise<number> {
    const now = new Date();
    
    if (note.id) {
      // Update existing note
      await db.notes.update(note.id, {
        ...note,
        updatedAt: now
      });
      return note.id;
    } else {
      // Create new note
      return await db.notes.add({
        ...note,
        createdAt: now,
        updatedAt: now
      });
    }
  },

  /**
   * Delete a note
   */
  async deleteNote(id: number): Promise<void> {
    await db.notes.delete(id);
  },

  /**
   * Get note by title (for wiki links)
   */
  async getNoteByTitle(title: string): Promise<Note | undefined> {
    return await db.notes
      .filter(note => note.title.toLowerCase() === title.toLowerCase())
      .first();
  },

  /**
   * Get daily note by date
   */
  async getDailyNote(date: string): Promise<Note | undefined> {
    return await db.notes
      .filter(note => note.isDailyNote === true && note.dailyNoteDate === date)
      .first();
  },

  /**
   * Get all daily notes
   */
  async getAllDailyNotes(): Promise<Note[]> {
    return await db.notes
      .filter(note => note.isDailyNote === true)
      .reverse()
      .sortBy('dailyNoteDate');
  },
};

/**
 * Template database operations
 */
export const templatesDB = {
  /**
   * Get all templates
   */
  async getAllTemplates(): Promise<Template[]> {
    return await db.templates.toArray();
  },

  /**
   * Get template by ID
   */
  async getTemplate(id: number): Promise<Template | undefined> {
    return await db.templates.get(id);
  },

  /**
   * Get templates by type
   */
  async getTemplatesByType(type: Template['type']): Promise<Template[]> {
    return await db.templates
      .filter(template => template.type === type)
      .toArray();
  },

  /**
   * Get default template for type
   */
  async getDefaultTemplate(type: Template['type']): Promise<Template | undefined> {
    return await db.templates
      .filter(template => template.type === type && template.isDefault === true)
      .first();
  },

  /**
   * Create or update template
   */
  async saveTemplate(template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }): Promise<number> {
    const now = new Date();
    
    if (template.id) {
      await db.templates.update(template.id, {
        ...template,
        updatedAt: now,
      });
      return template.id;
    } else {
      return await db.templates.add({
        ...template,
        createdAt: now,
        updatedAt: now,
      });
    }
  },

  /**
   * Delete template
   */
  async deleteTemplate(id: number): Promise<void> {
    await db.templates.delete(id);
  },
};

