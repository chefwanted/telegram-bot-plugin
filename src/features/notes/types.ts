/**
 * Notes Feature Types
 */

export interface Note {
  id: string;
  chatId: string;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface NotesStore {
  get(chatId: string): Note[];
  add(chatId: string, content: string, tags?: string[]): Note;
  update(chatId: string, noteId: string, content: string): Note | null;
  delete(chatId: string, noteId: string): boolean;
  search(chatId: string, query: string): Note[];
  addTag(chatId: string, noteId: string, tag: string): boolean;
  removeTag(chatId: string, noteId: string, tag: string): boolean;
}
