/**
 * Notes Store - File-based persistence for user notes
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Note, NotesStore } from './types';

const NOTES_DIR = '/tmp/telegram-bot/notes';
const NOTES_FILE = (chatId: string) => path.join(NOTES_DIR, `${chatId}.json`);

export class FileNotesStore implements NotesStore {
  constructor() {
    if (!fs.existsSync(NOTES_DIR)) {
      fs.mkdirSync(NOTES_DIR, { recursive: true });
    }
  }

  get(chatId: string): Note[] {
    const filePath = NOTES_FILE(chatId);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  save(chatId: string, notes: Note[]): void {
    const filePath = NOTES_FILE(chatId);
    fs.writeFileSync(filePath, JSON.stringify(notes, null, 2));
  }

  add(chatId: string, content: string, tags: string[] = []): Note {
    const notes = this.get(chatId);
    const note: Note = {
      id: Date.now().toString(),
      chatId,
      content,
      tags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    notes.push(note);
    this.save(chatId, notes);
    return note;
  }

  update(chatId: string, noteId: string, content: string): Note | null {
    const notes = this.get(chatId);
    const note = notes.find(n => n.id === noteId);
    if (note) {
      note.content = content;
      note.updatedAt = Date.now();
      this.save(chatId, notes);
      return note;
    }
    return null;
  }

  delete(chatId: string, noteId: string): boolean {
    const notes = this.get(chatId);
    const index = notes.findIndex(n => n.id === noteId);
    if (index !== -1) {
      notes.splice(index, 1);
      this.save(chatId, notes);
      return true;
    }
    return false;
  }

  search(chatId: string, query: string): Note[] {
    const notes = this.get(chatId);
    const lowerQuery = query.toLowerCase();
    return notes.filter(n =>
      n.content.toLowerCase().includes(lowerQuery) ||
      n.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  addTag(chatId: string, noteId: string, tag: string): boolean {
    const notes = this.get(chatId);
    const note = notes.find(n => n.id === noteId);
    if (note && !note.tags.includes(tag)) {
      note.tags.push(tag);
      note.updatedAt = Date.now();
      this.save(chatId, notes);
      return true;
    }
    return false;
  }

  removeTag(chatId: string, noteId: string, tag: string): boolean {
    const notes = this.get(chatId);
    const note = notes.find(n => n.id === noteId);
    if (note) {
      const index = note.tags.indexOf(tag);
      if (index !== -1) {
        note.tags.splice(index, 1);
        note.updatedAt = Date.now();
        this.save(chatId, notes);
        return true;
      }
    }
    return false;
  }
}
