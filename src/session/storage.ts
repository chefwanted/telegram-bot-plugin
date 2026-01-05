/**
 * Session Storage Implementation
 * Implementeert storage interface met in-memory en database storage
 */

import type {
  Storage,
  Session,
  SessionData,
  SessionOptions,
  MemoryStorageOptions,
  DatabaseStorageOptions,
} from '../types/session';
import { getDatabase } from '../database';
import { createLogger } from '../utils/logger';

const logger = createLogger({ prefix: 'SessionStorage' });

// =============================================================================
// Database Storage
// =============================================================================

export class DatabaseStorage implements Storage {
  private db = getDatabase();
  private tableName: string;
  private defaultTtl: number; // in seconds

  constructor(options: DatabaseStorageOptions = {}) {
    this.tableName = options.tableName || 'sessions';
    this.defaultTtl = options.ttl || 86400; // 24 hours default
  }

  /**
   * Initialize database table for sessions
   */
  async initialize(): Promise<void> {
    this.db.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        chat_id INTEGER NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER
      )
    `);

    this.db.db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON ${this.tableName}(user_id)`);
    this.db.db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_chat ON ${this.tableName}(chat_id)`);
    this.db.db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON ${this.tableName}(expires_at)`);
  }

  /**
   * Haal sessie op op basis van ID
   */
  async get(id: string): Promise<Session | null> {
    const record = this.db.db.prepare(`
      SELECT * FROM ${this.tableName} WHERE id = ?
    `).get(id) as SessionRecord | undefined;

    if (!record) {
      return null;
    }

    // Check if session expired
    if (record.expires_at && record.expires_at < Date.now()) {
      await this.delete(id);
      return null;
    }

    return this.recordToSession(record);
  }

  /**
   * Sla sessie op
   */
  async set(session: Session): Promise<void> {
    const record = this.sessionToRecord(session);

    this.db.db.prepare(`
      INSERT OR REPLACE INTO ${this.tableName} (id, user_id, chat_id, data, created_at, updated_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.user_id,
      record.chat_id,
      record.data,
      record.created_at,
      record.updated_at,
      record.expires_at
    );
  }

  /**
   * Verwijder sessie
   */
  async delete(id: string): Promise<boolean> {
    const result = this.db.db.prepare(`
      DELETE FROM ${this.tableName} WHERE id = ?
    `).run(id);

    return result.changes > 0;
  }

  /**
   * Check of sessie bestaat
   */
  async has(id: string): Promise<boolean> {
    const record = this.db.db.prepare(`
      SELECT 1 FROM ${this.tableName} WHERE id = ? AND (expires_at IS NULL OR expires_at > ?)
    `).get(id, Date.now());

    return !!record;
  }

  /**
   * Haal alle sessies op
   */
  async getAll(): Promise<Session[]> {
    const records = this.db.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE expires_at IS NULL OR expires_at > ?
      ORDER BY updated_at DESC
    `).all(Date.now()) as SessionRecord[];

    return records.map(r => this.recordToSession(r));
  }

  /**
   * Verwijder alle sessies
   */
  async clear(): Promise<void> {
    this.db.db.prepare(`DELETE FROM ${this.tableName}`).run();
  }

  /**
   * Haal sessies op basis van user ID
   */
  async getByUserId(userId: number): Promise<Session[]> {
    const records = this.db.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY updated_at DESC
    `).all(userId, Date.now()) as SessionRecord[];

    return records.map(r => this.recordToSession(r));
  }

  /**
   * Haal sessies op basis van chat ID
   */
  async getByChatId(chatId: number): Promise<Session[]> {
    const records = this.db.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE chat_id = ? AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY updated_at DESC
    `).all(chatId, Date.now()) as SessionRecord[];

    return records.map(r => this.recordToSession(r));
  }

  /**
   * Cleanup vervallen sessies
   */
  async cleanup(): Promise<number> {
    const result = this.db.db.prepare(`
      DELETE FROM ${this.tableName}
      WHERE expires_at IS NOT NULL AND expires_at < ?
    `).run(Date.now());

    return result.changes;
  }

  /**
   * Get aantal sessies
   */
  async size(): Promise<number> {
    const result = this.db.db.prepare(`
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE expires_at IS NULL OR expires_at > ?
    `).get(Date.now()) as { count: number };

    return result.count;
  }

  /**
   * Clear alle sessies en stop
   */
  destroy(): void {
    // No cleanup timer for database storage
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  private recordToSession(record: SessionRecord): Session {
    return {
      id: record.id,
      userId: record.user_id,
      chatId: record.chat_id,
      data: JSON.parse(record.data),
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
      expiresAt: record.expires_at ? new Date(record.expires_at) : undefined,
    };
  }

  private sessionToRecord(session: Session): SessionRecord {
    return {
      id: session.id,
      user_id: session.userId,
      chat_id: session.chatId,
      data: JSON.stringify(session.data),
      created_at: session.createdAt.getTime(),
      updated_at: session.updatedAt.getTime(),
      expires_at: session.expiresAt?.getTime() || null,
    };
  }
}

// =============================================================================
// Database Record Type
// =============================================================================

interface SessionRecord {
  id: string;
  user_id: number;
  chat_id: number;
  data: string;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
}

// =============================================================================
// In-Memory Storage
// =============================================================================

export class MemoryStorage implements Storage {
  private sessions: Map<string, Session> = new Map();
  private options: Required<MemoryStorageOptions>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: MemoryStorageOptions = {}) {
    this.options = {
      maxSize: options.maxSize || 1000,
      cleanupInterval: options.cleanupInterval || 60000, // 1 minuut
    };

    // Start cleanup interval
    if (this.options.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(
        () => this.cleanup(),
        this.options.cleanupInterval
      );
    }
  }

  /**
   * Haal sessie op op basis van ID
   */
  async get(id: string): Promise<Session | null> {
    const session = this.sessions.get(id);

    // Check if session expired
    if (session && session.expiresAt && session.expiresAt < new Date()) {
      this.sessions.delete(id);
      return null;
    }

    return session || null;
  }

  /**
   * Sla sessie op
   */
  async set(session: Session): Promise<void> {
    // Check max size
    if (this.sessions.size >= this.options.maxSize) {
      // Remove oldest session
      const firstKey = this.sessions.keys().next().value;
      if (firstKey) {
        this.sessions.delete(firstKey);
      }
    }

    this.sessions.set(session.id, session);
  }

  /**
   * Verwijder sessie
   */
  async delete(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }

  /**
   * Check of sessie bestaat
   */
  async has(id: string): Promise<boolean> {
    const session = await this.get(id);
    return session !== null;
  }

  /**
   * Haal alle sessies op
   */
  async getAll(): Promise<Session[]> {
    const now = new Date();
    const validSessions: Session[] = [];

    for (const session of this.sessions.values()) {
      // Filter expired sessions
      if (!session.expiresAt || session.expiresAt > now) {
        validSessions.push(session);
      }
    }

    return validSessions;
  }

  /**
   * Verwijder alle sessies
   */
  async clear(): Promise<void> {
    this.sessions.clear();
  }

  /**
   * Haal sessies op basis van user ID
   */
  async getByUserId(userId: number): Promise<Session[]> {
    const allSessions = await this.getAll();
    return allSessions.filter(s => s.userId === userId);
  }

  /**
   * Haal sessies op basis van chat ID
   */
  async getByChatId(chatId: number): Promise<Session[]> {
    const allSessions = await this.getAll();
    return allSessions.filter(s => s.chatId === chatId);
  }

  /**
   * Cleanup vervallen sessies
   */
  private async cleanup(): Promise<void> {
    const now = new Date();
    let removed = 0;

    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt && session.expiresAt < now) {
        this.sessions.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug(`Cleaned up ${removed} expired sessions`);
    }
  }

  /**
   * Get aantal sessies
   */
  size(): number {
    return this.sessions.size;
  }

  /**
   * Clear alle sessies en stop cleanup
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.sessions.clear();
  }
}

// =============================================================================
// Storage Factory
// =============================================================================

export function createStorage(
  type: 'memory' | 'redis' | 'database' = 'memory',
  options?: MemoryStorageOptions | DatabaseStorageOptions
): Storage {
  switch (type) {
    case 'memory':
      return new MemoryStorage(options as MemoryStorageOptions);
    case 'redis':
      throw new Error('Redis storage not yet implemented');
    case 'database':
      return new DatabaseStorage(options as DatabaseStorageOptions);
    default:
      throw new Error(`Unsupported storage type: ${type}`);
  }
}
