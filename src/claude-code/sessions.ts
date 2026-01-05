/**
 * Claude Code Session Manager
 * Beheert sessies per Telegram chat
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ClaudeCodeSession, SessionStorage } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger({ prefix: 'ClaudeSessions' });

// =============================================================================
// In-Memory Session Storage
// =============================================================================

export class MemorySessionStorage implements SessionStorage {
  private sessions: Map<string, ClaudeCodeSession> = new Map();
  private activeSessions: Map<string, string> = new Map(); // chatId -> sessionId

  async getActiveSession(chatId: string): Promise<ClaudeCodeSession | null> {
    const sessionId = this.activeSessions.get(chatId);
    if (!sessionId) return null;
    return this.sessions.get(sessionId) || null;
  }

  async getSessionsForChat(chatId: string): Promise<ClaudeCodeSession[]> {
    return Array.from(this.sessions.values())
      .filter(s => s.chatId === chatId)
      .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
  }

  async getSession(sessionId: string): Promise<ClaudeCodeSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async saveSession(session: ClaudeCodeSession): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async setActiveSession(chatId: string, sessionId: string): Promise<void> {
    // Mark previous active as inactive
    const prevId = this.activeSessions.get(chatId);
    if (prevId && this.sessions.has(prevId)) {
      const prev = this.sessions.get(prevId)!;
      prev.isActive = false;
      this.sessions.set(prevId, prev);
    }

    // Set new active
    this.activeSessions.set(chatId, sessionId);
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      session.isActive = true;
      this.sessions.set(sessionId, session);
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Remove from active if it was active
    if (this.activeSessions.get(session.chatId) === sessionId) {
      this.activeSessions.delete(session.chatId);
    }

    return this.sessions.delete(sessionId);
  }

  async getAllSessions(): Promise<ClaudeCodeSession[]> {
    return Array.from(this.sessions.values());
  }
}

// =============================================================================
// File-Based Session Storage (persists across restarts)
// =============================================================================

export class FileSessionStorage implements SessionStorage {
  private sessions: Map<string, ClaudeCodeSession> = new Map();
  private activeSessions: Map<string, string> = new Map();
  private filePath: string;
  private dirty = false;
  private saveTimer?: NodeJS.Timeout;

  constructor(storagePath: string = '/tmp/claude-telegram-sessions.json') {
    this.filePath = storagePath;
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        
        // Load sessions
        if (data.sessions) {
          for (const s of data.sessions) {
            s.createdAt = new Date(s.createdAt);
            s.lastActivityAt = new Date(s.lastActivityAt);
            this.sessions.set(s.id, s);
          }
        }

        // Load active sessions map
        if (data.activeSessions) {
          for (const [chatId, sessionId] of Object.entries(data.activeSessions)) {
            this.activeSessions.set(chatId, sessionId as string);
          }
        }

        logger.info(`Loaded ${this.sessions.size} sessions from storage`);
      }
    } catch (error) {
      logger.error('Failed to load sessions', { error });
    }
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer) return;

    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      if (this.dirty) {
        this.saveNow();
      }
    }, 1000);
  }

  private saveNow(): void {
    try {
      const data = {
        sessions: Array.from(this.sessions.values()),
        activeSessions: Object.fromEntries(this.activeSessions),
      };
      
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
      this.dirty = false;
      logger.debug('Sessions saved to disk');
    } catch (error) {
      logger.error('Failed to save sessions', { error });
    }
  }

  async getActiveSession(chatId: string): Promise<ClaudeCodeSession | null> {
    const sessionId = this.activeSessions.get(chatId);
    if (!sessionId) return null;
    return this.sessions.get(sessionId) || null;
  }

  async getSessionsForChat(chatId: string): Promise<ClaudeCodeSession[]> {
    return Array.from(this.sessions.values())
      .filter(s => s.chatId === chatId)
      .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
  }

  async getSession(sessionId: string): Promise<ClaudeCodeSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async saveSession(session: ClaudeCodeSession): Promise<void> {
    this.sessions.set(session.id, session);
    this.scheduleSave();
  }

  async setActiveSession(chatId: string, sessionId: string): Promise<void> {
    const prevId = this.activeSessions.get(chatId);
    if (prevId && this.sessions.has(prevId)) {
      const prev = this.sessions.get(prevId)!;
      prev.isActive = false;
      this.sessions.set(prevId, prev);
    }

    this.activeSessions.set(chatId, sessionId);
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      session.isActive = true;
      this.sessions.set(sessionId, session);
    }

    this.scheduleSave();
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (this.activeSessions.get(session.chatId) === sessionId) {
      this.activeSessions.delete(session.chatId);
    }

    const result = this.sessions.delete(sessionId);
    this.scheduleSave();
    return result;
  }

  async getAllSessions(): Promise<ClaudeCodeSession[]> {
    return Array.from(this.sessions.values());
  }

  destroy(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    if (this.dirty) {
      this.saveNow();
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createSessionStorage(
  type: 'memory' | 'file' = 'file',
  options?: { path?: string }
): SessionStorage {
  if (type === 'file') {
    return new FileSessionStorage(options?.path);
  }
  return new MemorySessionStorage();
}
