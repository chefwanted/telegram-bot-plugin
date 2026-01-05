/**
 * Session Manager Implementation
 * Beheert gebruikerssessies met TTL en cleanup
 */

import type {
  Session,
  SessionData,
  SessionManager,
  SessionOptions,
} from '../types/session';
import type { Storage } from '../types/session';
import { createStorage } from './storage';
import { createLogger } from '../utils/logger';

const logger = createLogger({ prefix: 'SessionManager' });

// =============================================================================
// Default Options
// =============================================================================

const DEFAULT_OPTIONS: Required<SessionOptions> = {
  ttl: 3600, // 1 uur
  maxSessions: 1000,
  storage: 'memory',
  cleanupInterval: 60000, // 1 minuut
};

// =============================================================================
// Session Manager Implementation
// =============================================================================

export class Manager implements SessionManager {
  private storage: Storage;
  private options: Required<SessionOptions>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: SessionOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Create storage instance
    this.storage = createStorage(this.options.storage, {
      maxSize: this.options.maxSessions,
      cleanupInterval: this.options.cleanupInterval,
    });

    // Start cleanup interval
    if (this.options.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(
        () => this.cleanup(),
        this.options.cleanupInterval
      );
      this.cleanupTimer.unref();
    }
  }

  /**
   * Creëer nieuwe sessie
   */
  async create(
    userId: number,
    chatId: number,
    options?: Partial<SessionOptions>
  ): Promise<Session> {
    const ttl = options?.ttl ?? this.options.ttl;
    const now = new Date();

    const session: Session = {
      id: this.generateSessionId(userId, chatId),
      userId,
      chatId,
      data: {},
      createdAt: now,
      updatedAt: now,
      expiresAt: ttl > 0 ? new Date(now.getTime() + ttl * 1000) : undefined,
    };

    await this.storage.set(session);
    return session;
  }

  /**
   * Haal sessie op
   */
  async get(id: string): Promise<Session | null> {
    const session = await this.storage.get(id);

    if (session && this.isExpired(session)) {
      await this.delete(id);
      return null;
    }

    return session;
  }

  /**
   * Update sessie data
   */
  async update(
    id: string,
    data: Partial<SessionData>
  ): Promise<Session> {
    const session = await this.get(id);

    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    // Merge data
    session.data = {
      ...session.data,
      ...data,
    };
    session.updatedAt = new Date();

    await this.storage.set(session);
    return session;
  }

  /**
   * Verwijder sessie
   */
  async delete(id: string): Promise<boolean> {
    return await this.storage.delete(id);
  }

  /**
   * Haal of creëer sessie
   */
  async getOrCreate(
    userId: number,
    chatId: number,
    options?: Partial<SessionOptions>
  ): Promise<Session> {
    const id = this.generateSessionId(userId, chatId);
    let session = await this.get(id);

    if (!session) {
      session = await this.create(userId, chatId, options);
    }

    return session;
  }

  /**
   * Cleanup vervallen sessies
   */
  async cleanup(): Promise<number> {
    const allSessions = await this.storage.getAll();
    let removed = 0;

    for (const session of allSessions) {
      if (this.isExpired(session)) {
        await this.delete(session.id);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug(`Cleaned up ${removed} expired sessions`);
    }

    return removed;
  }

  /**
   * Get aantal actieve sessies
   */
  async count(): Promise<number> {
    return (await this.storage.getAll()).length;
  }

  /**
   * Haal sessies op basis van user ID
   */
  async getByUserId(userId: number): Promise<Session[]> {
    return this.storage.getByUserId(userId);
  }

  /**
   * Haal sessies op basis van chat ID
   */
  async getByChatId(chatId: number): Promise<Session[]> {
    return this.storage.getByChatId(chatId);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Genereer sessie ID
   */
  private generateSessionId(userId: number, chatId: number): string {
    return `${userId}:${chatId}:${Date.now()}`;
  }

  /**
   * Check of sessie verlopen is
   */
  private isExpired(session: Session): boolean {
    if (!session.expiresAt) {
      return false;
    }
    return session.expiresAt < new Date();
  }

  /**
   * Cleanup en stop
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    if ('destroy' in this.storage) {
      (this.storage as unknown as { destroy: () => void }).destroy();
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createSessionManager(
  options?: SessionOptions
): SessionManager {
  return new Manager(options);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Maak sessie data helper
 */
export function createSessionData(
  data: Partial<SessionData> = {}
): SessionData {
  return {
    context: {},
    agentState: {
      status: 'idle',
      messageQueue: [],
      lastInteractionAt: new Date(),
    },
    preferences: {
      language: 'nl',
      notifications: true,
    },
    temporary: {},
    ...data,
  };
}

/**
 * Update agent state helper
 */
export function updateAgentState(
  session: Session,
  updates: Partial<SessionData['agentState']>
): SessionData['agentState'] {
  if (!session.data.agentState) {
    session.data.agentState = {
      status: 'idle',
      messageQueue: [],
      lastInteractionAt: new Date(),
    };
  }

  session.data.agentState = {
    ...session.data.agentState,
    ...updates,
    lastInteractionAt: new Date(),
  };

  return session.data.agentState;
}

/**
 * Add message to queue helper
 */
export function queueMessage(
  session: Session,
  content: string
): void {
  if (!session.data.agentState) {
    session.data.agentState = {
      status: 'idle',
      messageQueue: [],
      lastInteractionAt: new Date(),
    };
  }

  session.data.agentState.messageQueue.push({
    id: `${Date.now()}-${Math.random()}`,
    timestamp: new Date(),
    content,
    processed: false,
  });
}
