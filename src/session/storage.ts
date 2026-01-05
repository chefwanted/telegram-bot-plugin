/**
 * Session Storage Implementation
 * Implementeert storage interface met in-memory storage
 */

import type {
  Storage,
  Session,
} from '../types/session';
import type {
  MemoryStorageOptions,
} from '../types/session';

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
      console.debug(`[MemoryStorage] Cleaned up ${removed} expired sessions`);
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
  options?: MemoryStorageOptions
): Storage {
  switch (type) {
    case 'memory':
      return new MemoryStorage(options);
    case 'redis':
      throw new Error('Redis storage not yet implemented');
    case 'database':
      throw new Error('Database storage not yet implemented');
    default:
      throw new Error(`Unsupported storage type: ${type}`);
  }
}
