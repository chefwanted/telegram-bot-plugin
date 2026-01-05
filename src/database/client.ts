/**
 * SQLite Database Client
 * File-based persistent storage for Telegram bot
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { createLogger } from '../utils/logger';

const logger = createLogger({ prefix: 'Database' });

// Database path
const DB_DIR = process.env.DATABASE_PATH ? path.dirname(process.env.DATABASE_PATH) : '/tmp/telegram-bot';
const DB_PATH = process.env.DATABASE_PATH || path.join(DB_DIR, 'bot.db');

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// =============================================================================
// Database Client Class
// =============================================================================

export class DatabaseClient {
  private database: Database.Database;

  constructor(dbPath?: string) {
    const pathToUse = dbPath || DB_PATH;
    this.database = new Database(pathToUse);
    this.database.pragma('journal_mode = WAL');
    this.database.pragma('foreign_keys = ON');

    logger.info(`Database connected: ${pathToUse}`);

    // Initialize schema
    this.initializeSchema();
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    // Notes table
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.database.exec(`CREATE INDEX IF NOT EXISTS idx_notes_chat ON notes(chat_id)`);
    this.database.exec(`CREATE INDEX IF NOT EXISTS idx_notes_tags ON notes(tags)`);

    // Reminders table
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        message TEXT NOT NULL,
        remind_at INTEGER NOT NULL,
        recurring TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    this.database.exec(`CREATE INDEX IF NOT EXISTS idx_reminders_chat ON reminders(chat_id)`);
    this.database.exec(`CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(remind_at)`);

    // Analytics table
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT,
        event_type TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

    this.database.exec(`CREATE INDEX IF NOT EXISTS idx_analytics_chat ON analytics(chat_id)`);
    this.database.exec(`CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics(event_type)`);

    // Conversations table (AI)
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        chat_id TEXT PRIMARY KEY,
        messages TEXT,
        created_at INTEGER NOT NULL,
        last_access_at INTEGER NOT NULL
      )
    `);

    // Files table
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        file_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER,
        mime_type TEXT,
        folder TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    this.database.exec(`CREATE INDEX IF NOT EXISTS idx_files_chat ON files(chat_id)`);
    this.database.exec(`CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder)`);

    // Skills table
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS user_skills (
        chat_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        level INTEGER DEFAULT 0,
        xp INTEGER DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (chat_id, skill_id)
      )
    `);

    this.database.exec(`CREATE INDEX IF NOT EXISTS idx_skills_xp ON user_skills(xp)`);

    // P2000 subscriptions
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS p2000_subscriptions (
        chat_id TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 1,
        regions TEXT,
        filters TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    logger.info('Database schema initialized');
  }

  // ==========================================================================
  // Notes Operations
  // ==========================================================================

  addNote(chatId: string, content: string, tags?: string): number {
    const now = Date.now();
    const result = this.database.prepare(`
      INSERT INTO notes (chat_id, content, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(chatId, content, tags || null, now, now);

    return result.lastInsertRowid as number;
  }

  getNotes(chatId: string): any[] {
    return this.database.prepare(`
      SELECT * FROM notes WHERE chat_id = ? ORDER BY created_at DESC
    `).all(chatId);
  }

  getNote(id: number, chatId: string): any | undefined {
    return this.database.prepare(`
      SELECT * FROM notes WHERE id = ? AND chat_id = ?
    `).get(id, chatId);
  }

  deleteNote(id: number, chatId: string): boolean {
    const result = this.database.prepare(`
      DELETE FROM notes WHERE id = ? AND chat_id = ?
    `).run(id, chatId);

    return result.changes > 0;
  }

  searchNotes(chatId: string, term: string): any[] {
    return this.database.prepare(`
      SELECT * FROM notes WHERE chat_id = ? AND content LIKE ?
      ORDER BY created_at DESC
    `).all(chatId, `%${term}%`);
  }

  // ==========================================================================
  // Reminders Operations
  // ==========================================================================

  addReminder(chatId: string, message: string, remindAt: number, recurring?: string): number {
    const now = Date.now();
    const result = this.database.prepare(`
      INSERT INTO reminders (chat_id, message, remind_at, recurring, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(chatId, message, remindAt, recurring || null, now);

    return result.lastInsertRowid as number;
  }

  getReminders(chatId: string): any[] {
    return this.database.prepare(`
      SELECT * FROM reminders WHERE chat_id = ? ORDER BY remind_at ASC
    `).all(chatId);
  }

  getPendingReminders(now: number = Date.now()): any[] {
    return this.database.prepare(`
      SELECT * FROM reminders WHERE remind_at <= ? ORDER BY remind_at ASC
    `).all(now);
  }

  deleteReminder(id: number): boolean {
    const result = this.database.prepare(`DELETE FROM reminders WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  updateReminderTime(id: number, remindAt: number): boolean {
    const result = this.database.prepare(`
      UPDATE reminders SET remind_at = ? WHERE id = ?
    `).run(remindAt, id);
    return result.changes > 0;
  }

  // ==========================================================================
  // Analytics Operations
  // ==========================================================================

  trackEvent(chatId: string, eventType: string): void {
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO analytics (chat_id, event_type, timestamp)
      VALUES (?, ?, ?)
    `).run(chatId, eventType, now);
  }

  getAnalytics(chatId?: string): any[] {
    if (chatId) {
      return this.database.prepare(`
        SELECT * FROM analytics WHERE chat_id = ? ORDER BY timestamp DESC LIMIT 100
      `).all(chatId);
    }
    return this.database.prepare(`
      SELECT * FROM analytics ORDER BY timestamp DESC LIMIT 100
    `).all();
  }

  getStats(): { [key: string]: number } {
    const messageCount = this.database.prepare(`
      SELECT COUNT(*) as count FROM analytics WHERE event_type = 'message'
    `).get() as { count: number };

    const commandCount = this.database.prepare(`
      SELECT COUNT(*) as count FROM analytics WHERE event_type LIKE 'command_%'
    `).get() as { count: number };

    return {
      totalMessages: messageCount.count,
      totalCommands: commandCount.count,
    };
  }

  // ==========================================================================
  // Conversations Operations (AI)
  // ==========================================================================

  saveConversation(chatId: string, messages: string): void {
    const now = Date.now();
    const existing = this.getConversation(chatId);

    if (existing) {
      this.database.prepare(`
        UPDATE conversations SET messages = ?, last_access_at = ? WHERE chat_id = ?
      `).run(messages, now, chatId);
    } else {
      this.database.prepare(`
        INSERT INTO conversations (chat_id, messages, created_at, last_access_at)
        VALUES (?, ?, ?, ?)
      `).run(chatId, messages, now, now);
    }
  }

  getConversation(chatId: string): any | undefined {
    return this.database.prepare(`SELECT * FROM conversations WHERE chat_id = ?`).get(chatId);
  }

  deleteConversation(chatId: string): void {
    this.database.prepare(`DELETE FROM conversations WHERE chat_id = ?`).run(chatId);
  }

  // ==========================================================================
  // Files Operations
  // ==========================================================================

  addFile(chatId: string, fileId: string, fileName: string, fileSize: number, mimeType: string, folder?: string): number {
    const now = Date.now();
    const result = this.database.prepare(`
      INSERT INTO files (chat_id, file_id, file_name, file_size, mime_type, folder, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(chatId, fileId, fileName, fileSize, mimeType, folder || null, now);

    return result.lastInsertRowid as number;
  }

  getFiles(chatId: string, folder?: string): any[] {
    if (folder) {
      return this.database.prepare(`
        SELECT * FROM files WHERE chat_id = ? AND folder = ? ORDER BY created_at DESC
      `).all(chatId, folder);
    }
    return this.database.prepare(`
      SELECT * FROM files WHERE chat_id = ? ORDER BY created_at DESC
    `).all(chatId);
  }

  deleteFile(id: number, chatId: string): boolean {
    const result = this.database.prepare(`
      DELETE FROM files WHERE id = ? AND chat_id = ?
    `).run(id, chatId);
    return result.changes > 0;
  }

  // ==========================================================================
  // Skills Operations
  // ==========================================================================

  addXp(chatId: string, skillId: string, amount: number): void {
    const now = Date.now();
    const existing = this.database.prepare(`
      SELECT * FROM user_skills WHERE chat_id = ? AND skill_id = ?
    `).get(chatId, skillId) as any;

    if (existing) {
      const newXp = existing.xp + amount;
      const newLevel = Math.floor(newXp / 100);

      this.database.prepare(`
        UPDATE user_skills SET xp = ?, level = ?, updated_at = ? WHERE chat_id = ? AND skill_id = ?
      `).run(newXp, newLevel, now, chatId, skillId);
    } else {
      const level = Math.floor(amount / 100);
      this.database.prepare(`
        INSERT INTO user_skills (chat_id, skill_id, level, xp, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(chatId, skillId, level, amount, now);
    }
  }

  getSkills(chatId: string): any[] {
    return this.database.prepare(`
      SELECT * FROM user_skills WHERE chat_id = ? ORDER BY xp DESC
    `).all(chatId);
  }

  getLeaderboard(skillId?: string, limit: number = 10): any[] {
    if (skillId) {
      return this.database.prepare(`
        SELECT chat_id, skill_id, level, xp FROM user_skills
        WHERE skill_id = ? ORDER BY xp DESC LIMIT ?
      `).all(skillId, limit);
    }
    return this.database.prepare(`
      SELECT chat_id, skill_id, level, xp FROM user_skills
      ORDER BY xp DESC LIMIT ?
    `).all(limit);
  }

  // ==========================================================================
  // P2000 Operations
  // ==========================================================================

  subscribeP2000(chatId: string, regions?: string[], filters?: string[]): void {
    const now = Date.now();
    const existing = this.database.prepare(`SELECT * FROM p2000_subscriptions WHERE chat_id = ?`).get(chatId) as any;

    if (existing) {
      this.database.prepare(`
        UPDATE p2000_subscriptions SET regions = ?, filters = ? WHERE chat_id = ?
      `).run(regions ? JSON.stringify(regions) : null, filters ? JSON.stringify(filters) : null, chatId);
    } else {
      this.database.prepare(`
        INSERT INTO p2000_subscriptions (chat_id, regions, filters, created_at)
        VALUES (?, ?, ?, ?)
      `).run(chatId, regions ? JSON.stringify(regions) : null, filters ? JSON.stringify(filters) : null, now);
    }
  }

  unsubscribeP2000(chatId: string): void {
    this.database.prepare(`DELETE FROM p2000_subscriptions WHERE chat_id = ?`).run(chatId);
  }

  getP2000Subscriptions(): any[] {
    return this.database.prepare(`SELECT * FROM p2000_subscriptions WHERE enabled = 1`).all();
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  close(): void {
    this.database.close();
    logger.info('Database connection closed');
  }

  /**
   * Get database instance for raw queries
   */
  get db(): Database.Database {
    return this.database;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let clientInstance: DatabaseClient | null = null;

export function getDatabase(): DatabaseClient {
  if (!clientInstance) {
    clientInstance = new DatabaseClient();
  }
  return clientInstance;
}

export function closeDatabase(): void {
  if (clientInstance) {
    clientInstance.close();
    clientInstance = null;
  }
}
