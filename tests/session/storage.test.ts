/**
 * Session Storage Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MemoryStorage, DatabaseStorage, createStorage } from '../../src/session/storage';
import type { Session } from '../../src/types/session';

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  const createMockSession = (overrides: Partial<Session> = {}): Session => ({
    id: 'test-session-1',
    userId: 12345,
    chatId: 67890,
    data: {
      context: {},
      lastCommand: undefined,
      agentState: undefined,
      preferences: { language: 'nl' },
      temporary: {},
      streamingState: undefined,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: undefined,
    ...overrides,
  });

  beforeEach(() => {
    storage = new MemoryStorage({ maxSize: 10, cleanupInterval: 0 });
  });

  afterEach(() => {
    storage.destroy();
  });

  describe('get', () => {
    it('should return null for non-existent session', async () => {
      const result = await storage.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return session when it exists', async () => {
      const session = createMockSession();
      await storage.set(session);

      const result = await storage.get(session.id);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(session.id);
    });

    it('should return null for expired session', async () => {
      const session = createMockSession({
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });
      await storage.set(session);

      const result = await storage.get(session.id);
      expect(result).toBeNull();
    });

    it('should not return null for session expiring in future', async () => {
      const session = createMockSession({
        expiresAt: new Date(Date.now() + 60000), // Expires in 1 minute
      });
      await storage.set(session);

      const result = await storage.get(session.id);
      expect(result).not.toBeNull();
    });
  });

  describe('set', () => {
    it('should store session successfully', async () => {
      const session = createMockSession();
      await storage.set(session);

      const result = await storage.get(session.id);
      expect(result).toEqual(session);
    });

    it('should update existing session', async () => {
      const session = createMockSession();
      await storage.set(session);

      const updatedSession = { ...session, data: { ...session.data, context: { test: 'value' } } };
      await storage.set(updatedSession);

      const result = await storage.get(session.id);
      expect(result?.data.context).toEqual({ test: 'value' });
    });
  });

  describe('delete', () => {
    it('should return true when deleting existing session', async () => {
      const session = createMockSession();
      await storage.set(session);

      const result = await storage.delete(session.id);
      expect(result).toBe(true);
      expect(await storage.get(session.id)).toBeNull();
    });

    it('should return false when deleting non-existent session', async () => {
      const result = await storage.delete('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('has', () => {
    it('should return true for existing session', async () => {
      const session = createMockSession();
      await storage.set(session);

      const result = await storage.has(session.id);
      expect(result).toBe(true);
    });

    it('should return false for non-existent session', async () => {
      const result = await storage.has('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no sessions', async () => {
      const result = await storage.getAll();
      expect(result).toEqual([]);
    });

    it('should return all non-expired sessions', async () => {
      const session1 = createMockSession({ id: 'session-1' });
      const session2 = createMockSession({ id: 'session-2' });
      const session3 = createMockSession({
        id: 'session-3',
        expiresAt: new Date(Date.now() - 1000), // Expired
      });

      await storage.set(session1);
      await storage.set(session2);
      await storage.set(session3);

      const result = await storage.getAll();
      expect(result).toHaveLength(2);
      expect(result.map(s => s.id)).toContain('session-1');
      expect(result.map(s => s.id)).toContain('session-2');
    });
  });

  describe('clear', () => {
    it('should remove all sessions', async () => {
      await storage.set(createMockSession({ id: 'session-1' }));
      await storage.set(createMockSession({ id: 'session-2' }));

      expect(await storage.getAll()).toHaveLength(2);

      await storage.clear();

      expect(await storage.getAll()).toHaveLength(0);
    });
  });

  describe('getByUserId', () => {
    it('should return sessions for specific user', async () => {
      const session1 = createMockSession({ id: 'session-1', userId: 100 });
      const session2 = createMockSession({ id: 'session-2', userId: 100 });
      const session3 = createMockSession({ id: 'session-3', userId: 200 });

      await storage.set(session1);
      await storage.set(session2);
      await storage.set(session3);

      const result = await storage.getByUserId(100);
      expect(result).toHaveLength(2);
    });
  });

  describe('getByChatId', () => {
    it('should return sessions for specific chat', async () => {
      const session1 = createMockSession({ id: 'session-1', chatId: 100 });
      const session2 = createMockSession({ id: 'session-2', chatId: 200 });
      const session3 = createMockSession({ id: 'session-3', chatId: 100 });

      await storage.set(session1);
      await storage.set(session2);
      await storage.set(session3);

      const result = await storage.getByChatId(100);
      expect(result).toHaveLength(2);
    });
  });

  describe('size', () => {
    it('should return correct number of sessions', async () => {
      expect(storage.size()).toBe(0);

      await storage.set(createMockSession({ id: 'session-1' }));
      expect(storage.size()).toBe(1);

      await storage.set(createMockSession({ id: 'session-2' }));
      expect(storage.size()).toBe(2);
    });
  });

  describe('maxSize limit', () => {
    it('should remove oldest session when limit reached', async () => {
      const smallStorage = new MemoryStorage({ maxSize: 2, cleanupInterval: 0 });

      await smallStorage.set(createMockSession({ id: 'session-1' }));
      await smallStorage.set(createMockSession({ id: 'session-2' }));
      await smallStorage.set(createMockSession({ id: 'session-3' }));

      expect(await smallStorage.get('session-1')).toBeNull();
      expect(await smallStorage.get('session-2')).not.toBeNull();
      expect(await smallStorage.get('session-3')).not.toBeNull();

      smallStorage.destroy();
    });
  });
});

describe('DatabaseStorage', () => {
  let storage: DatabaseStorage;

  const createMockSession = (overrides: Partial<Session> = {}): Session => ({
    id: 'test-session-1',
    userId: 12345,
    chatId: 67890,
    data: {
      context: {},
      lastCommand: undefined,
      agentState: undefined,
      preferences: { language: 'nl' },
      temporary: {},
      streamingState: undefined,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Session);

  beforeEach(async () => {
    storage = new DatabaseStorage({ tableName: 'test_sessions' });
    await storage.initialize();
    await storage.clear();
  });

  afterEach(() => {
    storage.destroy();
  });

  describe('get', () => {
    it('should return null for non-existent session', async () => {
      const result = await storage.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return session when it exists', async () => {
      const session = createMockSession();
      await storage.set(session);

      const result = await storage.get(session.id);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(session.id);
    });

    it('should return null for expired session', async () => {
      const session = createMockSession({
        expiresAt: new Date(Date.now() - 1000),
      });
      await storage.set(session);

      const result = await storage.get(session.id);
      expect(result).toBeNull();
    });

    it('should not return null for session expiring in future', async () => {
      const session = createMockSession({
        expiresAt: new Date(Date.now() + 60000),
      });
      await storage.set(session);

      const result = await storage.get(session.id);
      expect(result).not.toBeNull();
    });
  });

  describe('set', () => {
    it('should store session successfully', async () => {
      const session = createMockSession();
      await storage.set(session);

      const result = await storage.get(session.id);
      expect(result?.id).toBe(session.id);
      expect(result?.userId).toBe(session.userId);
      expect(result?.chatId).toBe(session.chatId);
    });

    it('should update existing session', async () => {
      const session = createMockSession();
      await storage.set(session);

      const updatedSession = { ...session, data: { ...session.data, context: { test: 'value' } } };
      await storage.set(updatedSession);

      const result = await storage.get(session.id);
      expect(result?.data.context).toEqual({ test: 'value' });
    });
  });

  describe('delete', () => {
    it('should return true when deleting existing session', async () => {
      const session = createMockSession();
      await storage.set(session);

      const result = await storage.delete(session.id);
      expect(result).toBe(true);
      expect(await storage.get(session.id)).toBeNull();
    });

    it('should return false when deleting non-existent session', async () => {
      const result = await storage.delete('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no sessions', async () => {
      const result = await storage.getAll();
      expect(result).toEqual([]);
    });

    it('should return all non-expired sessions', async () => {
      const session1 = createMockSession({ id: 'session-1' });
      const session2 = createMockSession({ id: 'session-2' });
      const session3 = createMockSession({
        id: 'session-3',
        expiresAt: new Date(Date.now() - 1000),
      });

      await storage.set(session1);
      await storage.set(session2);
      await storage.set(session3);

      const result = await storage.getAll();
      expect(result).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('should remove all sessions', async () => {
      await storage.set(createMockSession({ id: 'session-1' }));
      await storage.set(createMockSession({ id: 'session-2' }));

      expect(await storage.getAll()).toHaveLength(2);

      await storage.clear();

      expect(await storage.getAll()).toHaveLength(0);
    });
  });

  describe('getByUserId', () => {
    it('should return sessions for specific user', async () => {
      const session1 = createMockSession({ id: 'session-1', userId: 100 });
      const session2 = createMockSession({ id: 'session-2', userId: 100 });
      const session3 = createMockSession({ id: 'session-3', userId: 200 });

      await storage.set(session1);
      await storage.set(session2);
      await storage.set(session3);

      const result = await storage.getByUserId(100);
      expect(result).toHaveLength(2);
    });
  });

  describe('getByChatId', () => {
    it('should return sessions for specific chat', async () => {
      const session1 = createMockSession({ id: 'session-1', chatId: 100 });
      const session2 = createMockSession({ id: 'session-2', chatId: 200 });
      const session3 = createMockSession({ id: 'session-3', chatId: 100 });

      await storage.set(session1);
      await storage.set(session2);
      await storage.set(session3);

      const result = await storage.getByChatId(100);
      expect(result).toHaveLength(2);
    });
  });

  describe('cleanup', () => {
    it('should remove expired sessions', async () => {
      const session1 = createMockSession({ id: 'session-1' });
      const session2 = createMockSession({ id: 'session-2' });
      const session3 = createMockSession({
        id: 'session-3',
        expiresAt: new Date(Date.now() - 1000),
      });

      await storage.set(session1);
      await storage.set(session2);
      await storage.set(session3);

      const removed = await storage.cleanup();
      expect(removed).toBe(1);

      const result = await storage.getAll();
      expect(result).toHaveLength(2);
    });
  });
});

describe('createStorage', () => {
  it('should create memory storage', () => {
    const storage = createStorage('memory');
    expect(storage).toBeInstanceOf(MemoryStorage);
  });

  it('should create database storage', () => {
    const storage = createStorage('database');
    expect(storage).toBeInstanceOf(DatabaseStorage);
  });

  it('should throw for unsupported storage types', () => {
    expect(() => createStorage('redis' as 'memory')).toThrow('Redis storage not yet implemented');
  });

  it('should throw for unknown storage type', () => {
    expect(() => createStorage('unknown' as 'memory')).toThrow('Unsupported storage type: unknown');
  });
});
