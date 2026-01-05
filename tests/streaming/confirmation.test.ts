/**
 * Confirmation Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ConfirmationManager } from '../../src/streaming/confirmation';
import type { ApiMethods } from '../../src/api/methods';
import type { ToolUseEvent } from '../../src/streaming/types';

describe('ConfirmationManager', () => {
  let confirmationManager: ConfirmationManager;
  let mockApi: jest.Mocked<ApiMethods>;

  const createMockToolUse = (overrides: Partial<ToolUseEvent> = {}): ToolUseEvent => ({
    type: 'tool_use',
    id: 'tool-123',
    name: 'Read',
    input: { path: 'test.txt' },
    timestamp: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockApi = {
      sendMessage: jest.fn().mockResolvedValue({ message_id: 12345 }),
      answerCallbackQuery: jest.fn().mockResolvedValue({ ok: true }),
      deleteMessage: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<ApiMethods>;

    confirmationManager = new ConfirmationManager(mockApi);
  });

  afterEach(() => {
    confirmationManager.destroy();
    jest.restoreAllMocks();
  });

  describe('requiresConfirmation', () => {
    it('should return true for Write tool', () => {
      const tool = createMockToolUse({ name: 'Write', input: { file_path: 'test.txt', content: 'test' } });
      expect(confirmationManager.requiresConfirmation(tool)).toBe(true);
    });

    it('should return true for Edit tool', () => {
      const tool = createMockToolUse({ name: 'Edit', input: { file_path: 'test.txt' } });
      expect(confirmationManager.requiresConfirmation(tool)).toBe(true);
    });

    it('should return true for Delete tool', () => {
      const tool = createMockToolUse({ name: 'Delete', input: { path: 'test.txt' } });
      expect(confirmationManager.requiresConfirmation(tool)).toBe(true);
    });

    it('should return true for dangerous bash command', () => {
      const tool = createMockToolUse({
        name: 'Bash',
        input: { command: 'rm -rf /tmp/test' },
      });
      expect(confirmationManager.requiresConfirmation(tool)).toBe(true);
    });

    it('should return true for git push --force', () => {
      const tool = createMockToolUse({
        name: 'Bash',
        input: { command: 'git push --force origin main' },
      });
      expect(confirmationManager.requiresConfirmation(tool)).toBe(true);
    });

    it('should return true for git reset --hard', () => {
      const tool = createMockToolUse({
        name: 'Bash',
        input: { command: 'git reset --hard HEAD~1' },
      });
      expect(confirmationManager.requiresConfirmation(tool)).toBe(true);
    });

    it('should return false for safe bash command', () => {
      const tool = createMockToolUse({
        name: 'Bash',
        input: { command: 'ls -la' },
      });
      expect(confirmationManager.requiresConfirmation(tool)).toBe(false);
    });

    it('should return false for Read tool', () => {
      const tool = createMockToolUse({ name: 'Read' });
      expect(confirmationManager.requiresConfirmation(tool)).toBe(false);
    });

    it('should return false for unknown safe tool', () => {
      const tool = createMockToolUse({ name: 'Grep', input: { pattern: 'test' } });
      expect(confirmationManager.requiresConfirmation(tool)).toBe(false);
    });

    it('should be case insensitive for bash commands', () => {
      const tool = createMockToolUse({
        name: 'bash',
        input: { command: 'RM -RF /TMP/TEST' },
      });
      expect(confirmationManager.requiresConfirmation(tool)).toBe(true);
    });
  });

  describe('requestConfirmation', () => {
    it('should send confirmation message with inline keyboard', async () => {
      const tool = createMockToolUse({ name: 'Write', input: { file_path: 'test.txt', content: 'hello' } });

      // Start confirmation (will wait for callback)
      const confirmationPromise = confirmationManager.requestConfirmation(tool, 12345);

      // Give time for the message to be sent
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify the message was sent with correct format
      expect(mockApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chat_id: 12345,
          parse_mode: 'Markdown',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '✅ Approve' }),
                expect.objectContaining({ text: '❌ Reject' }),
              ]),
            ]),
          }),
        })
      );

      // Now approve to resolve the promise
      const pendingConfirmations = (confirmationManager as unknown as { pendingConfirmations: Map<string, object> }).pendingConfirmations;
      const confirmationId = pendingConfirmations.keys().next().value;
      await confirmationManager.handleCallback(`${confirmationId}:approve`, 'callback-query-id');
      await confirmationPromise;
    }, 15000);

    it('should return true when user approves', async () => {
      const tool = createMockToolUse({ name: 'Write', input: { file_path: 'test.txt', content: 'test' } });

      const promise = confirmationManager.requestConfirmation(tool, 12345);

      // Let the message be sent first
      await new Promise(resolve => setTimeout(resolve, 10));

      // Get the pending confirmation
      const pendingConfirmations = (confirmationManager as unknown as { pendingConfirmations: Map<string, object> }).pendingConfirmations;
      const confirmationId = pendingConfirmations.keys().next().value;

      // Simulate approve callback
      await confirmationManager.handleCallback(`${confirmationId}:approve`, 'callback-query-id');

      const result = await promise;
      expect(result).toBe(true);
    });

    it('should return false when user rejects', async () => {
      const tool = createMockToolUse({ name: 'Write', input: { file_path: 'test.txt', content: 'test' } });

      const promise = confirmationManager.requestConfirmation(tool, 12345);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Get the pending confirmation
      const pendingConfirmations = (confirmationManager as unknown as { pendingConfirmations: Map<string, object> }).pendingConfirmations;
      const confirmationId = pendingConfirmations.keys().next().value;

      // Simulate reject callback
      await confirmationManager.handleCallback(`${confirmationId}:reject`, 'callback-query-id');

      const result = await promise;
      expect(result).toBe(false);
    });
  });

  describe('handleCallback', () => {
    it('should return false for unknown confirmation ID', async () => {
      const result = await confirmationManager.handleCallback('unknown_id:approve', 'callback-query-id');
      expect(result).toBe(false);
    });

    it('should answer callback query on approve', async () => {
      const tool = createMockToolUse({ name: 'Write', input: { file_path: 'test.txt', content: 'test' } });

      const promise = confirmationManager.requestConfirmation(tool, 12345);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Get the confirmation ID
      const pendingConfirmations = (confirmationManager as unknown as { pendingConfirmations: Map<string, object> }).pendingConfirmations;
      const confirmationId = pendingConfirmations.keys().next().value;

      await confirmationManager.handleCallback(`${confirmationId}:approve`, 'callback-query-id');

      await promise;

      expect(mockApi.answerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          callback_query_id: 'callback-query-id',
          text: '✅ Approved',
        })
      );
    });

    it('should answer callback query on reject', async () => {
      const tool = createMockToolUse({ name: 'Write', input: { file_path: 'test.txt', content: 'test' } });

      const promise = confirmationManager.requestConfirmation(tool, 12345);
      await new Promise(resolve => setTimeout(resolve, 10));

      const pendingConfirmations = (confirmationManager as unknown as { pendingConfirmations: Map<string, object> }).pendingConfirmations;
      const confirmationId = pendingConfirmations.keys().next().value;

      await confirmationManager.handleCallback(`${confirmationId}:reject`, 'callback-query-id');

      await promise;

      expect(mockApi.answerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          callback_query_id: 'callback-query-id',
          text: '❌ Rejected',
        })
      );
    });

    it('should delete confirmation message after decision', async () => {
      const tool = createMockToolUse({ name: 'Write', input: { file_path: 'test.txt', content: 'test' } });

      const promise = confirmationManager.requestConfirmation(tool, 12345);
      await new Promise(resolve => setTimeout(resolve, 10));

      const pendingConfirmations = (confirmationManager as unknown as { pendingConfirmations: Map<string, object> }).pendingConfirmations;
      const confirmationId = pendingConfirmations.keys().next().value;

      await confirmationManager.handleCallback(`${confirmationId}:approve`, 'callback-query-id');

      await promise;

      expect(mockApi.deleteMessage).toHaveBeenCalledWith(12345, 12345);
    });
  });

  describe('getPendingConfirmation', () => {
    it('should return undefined for unknown ID', () => {
      const result = confirmationManager.getPendingConfirmation('unknown');
      expect(result).toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('should clear all pending confirmations', async () => {
      const tool = createMockToolUse({ name: 'Write', input: { file_path: 'test.txt', content: 'test' } });

      // Start multiple confirmations
      confirmationManager.requestConfirmation(tool, 12345);
      confirmationManager.requestConfirmation(tool, 67890);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Destroy
      confirmationManager.destroy();

      // Verify cleanup
      const pendingConfirmations = (confirmationManager as unknown as { pendingConfirmations: Map<string, object> }).pendingConfirmations;
      expect(pendingConfirmations.size).toBe(0);
    });
  });
});
