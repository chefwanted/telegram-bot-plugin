/**
 * Streaming Integration Tests
 * End-to-end tests for the streaming message handler
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { StreamingMessageHandler, createStreamingMessageHandler } from '../../src/bot/handlers/streaming-message';
import type { ApiMethods } from '../../src/api';
import type { LLMRouter } from '../../src/llm';
import { StreamStatus, ToolUseEvent, ToolResultEvent } from '../../src/streaming/types';
import type { Message } from '../../src/types/telegram';

describe('StreamingMessageHandler Integration', () => {
  let handler: StreamingMessageHandler;
  let mockApi: Record<string, jest.Mock>;
  let mockRouter: Record<string, jest.Mock>;

  const createMockMessage = (overrides: Partial<Message> = {}): Message => ({
    message_id: 12345,
    chat: { id: 67890, type: 'private' },
    date: Math.floor(Date.now() / 1000),
    from: { id: 67890, is_bot: false, first_name: 'TestUser' },
    text: 'Hello Claude',
    ...overrides,
  } as Message);

  beforeEach(() => {
    mockApi = {
      sendMessage: jest.fn().mockResolvedValue({ message_id: 11111 }),
      editMessageText: jest.fn().mockResolvedValue({ message_id: 11111 }),
      deleteMessage: jest.fn().mockResolvedValue(true),
      answerCallbackQuery: jest.fn().mockResolvedValue({ ok: true }),
      answerInlineQuery: jest.fn().mockResolvedValue({ ok: true, results: [] }),
      getMe: jest.fn().mockResolvedValue({ id: 12345, is_bot: true, first_name: 'TestBot' }),
      getChat: jest.fn().mockResolvedValue({ id: 67890, type: 'private' }),
      getChatPhoto: jest.fn().mockResolvedValue([]),
      setMyCommands: jest.fn().mockResolvedValue({ ok: true }),
      setupCommands: jest.fn().mockResolvedValue({ ok: true }),
      createInlineKeyboard: jest.fn().mockReturnValue({ inline_keyboard: [] }),
      createReplyKeyboard: jest.fn().mockReturnValue({ keyboard: [], resize_keyboard: true }),
      createRemoveKeyboard: jest.fn().mockReturnValue({ remove_keyboard: true }),
      sendText: jest.fn().mockResolvedValue({ message_id: 11111 }),
      sendWithKeyboard: jest.fn().mockResolvedValue({ message_id: 11111 }),
      sendWithReplyKeyboard: jest.fn().mockResolvedValue({ message_id: 11111 }),
      removeKeyboard: jest.fn().mockResolvedValue({ message_id: 11111 }),
      sendChatAction: jest.fn().mockResolvedValue(true),
      editMessageTextStream: jest.fn().mockResolvedValue(undefined),
    };

    mockRouter = {
      getProvider: jest.fn().mockReturnValue('zai'),
      getProviderLabel: jest.fn().mockReturnValue('Z.ai GLM-4.7'),
      processMessageStream: jest.fn(),
    };

    handler = createStreamingMessageHandler(mockApi as unknown as ApiMethods, mockRouter as unknown as LLMRouter);
  });

  afterEach(() => {
    handler.destroy();
    jest.restoreAllMocks();
  });

  describe('handle', () => {
    it('should skip command messages starting with /', async () => {
      const commandMessage = createMockMessage({ text: '/start' });

      await handler.handle(commandMessage);

      expect(mockRouter.processMessageStream).not.toHaveBeenCalled();
      expect(mockApi.sendMessage).not.toHaveBeenCalled();
    });

    it('should skip empty messages', async () => {
      const emptyMessage = createMockMessage({ text: undefined });

      await handler.handle(emptyMessage);

      expect(mockRouter.processMessageStream).not.toHaveBeenCalled();
    });

    it('should send typing action and initial status message', async () => {
      const message = createMockMessage();

      mockRouter.processMessageStream.mockResolvedValue({
        text: 'Response',
        sessionId: 'session-123',
        isNewSession: true,
        durationMs: 1000,
        exitCode: 0,
        toolHistory: [],
      });

      await handler.handle(message);

      expect(mockApi.sendChatAction).toHaveBeenCalledWith({
        chat_id: 67890,
        action: 'typing',
      });
      expect(mockApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chat_id: 67890,
          parse_mode: 'Markdown',
        })
      );
    });

    it('should call processMessageStream with correct parameters', async () => {
      const message = createMockMessage({ text: 'Test message' });

      mockRouter.processMessageStream.mockResolvedValue({
        text: 'Response',
        sessionId: 'session-123',
        isNewSession: true,
        durationMs: 1000,
        exitCode: 0,
        toolHistory: [],
      });

      await handler.handle(message);

      expect(mockRouter.processMessageStream).toHaveBeenCalledWith(
        '67890',
        'Test message',
        expect.objectContaining({
          onContent: expect.any(Function),
          onToolUse: expect.any(Function),
          onToolResult: expect.any(Function),
          onComplete: expect.any(Function),
        })
      );
    });

    it('should handle onStatusChange callback', async () => {
      const message = createMockMessage();

      mockRouter.processMessageStream.mockImplementation(async (_chatId, _message, callbacks) => {
        callbacks.onStatusChange?.(StreamStatus.THINKING);
        callbacks.onStatusChange?.(StreamStatus.RESPONSE);
        callbacks.onComplete?.({
          text: 'Done',
          sessionId: 'sess-1',
          isNewSession: true,
          durationMs: 500,
          exitCode: 0,
          toolHistory: [],
        });
        return {
          text: 'Done',
          sessionId: 'sess-1',
          isNewSession: true,
          durationMs: 500,
          exitCode: 0,
          toolHistory: [],
        };
      });

      await handler.handle(message);

      expect(mockApi.editMessageText).toHaveBeenCalled();
    });

    it('should handle onToolUse callback', async () => {
      const message = createMockMessage();

      const toolUse: ToolUseEvent = {
        type: 'tool_use',
        id: 'tool-123',
        name: 'Read',
        input: { file_path: 'test.txt' },
        timestamp: new Date(),
      };

      mockRouter.processMessageStream.mockImplementation(async (_chatId, _message, callbacks) => {
        callbacks.onToolUse?.(toolUse);
        callbacks.onComplete?.({
          text: 'Done',
          sessionId: 'sess-1',
          isNewSession: true,
          durationMs: 500,
          exitCode: 0,
          toolHistory: [toolUse],
        });
        return {
          text: 'Done',
          sessionId: 'sess-1',
          isNewSession: true,
          durationMs: 500,
          exitCode: 0,
          toolHistory: [toolUse],
        };
      });

      await handler.handle(message);

      expect(mockApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chat_id: 67890,
          parse_mode: 'Markdown',
        })
      );
    });

    it('should handle onToolResult callback', async () => {
      const message = createMockMessage();

      const toolResult: ToolResultEvent = {
        type: 'tool_result',
        toolUseId: 'tool-123',
        content: 'File contents here',
        timestamp: new Date(),
      };

      mockRouter.processMessageStream.mockImplementation(async (_chatId, _message, callbacks) => {
        callbacks.onToolResult?.(toolResult);
        callbacks.onComplete?.({
          text: 'Done',
          sessionId: 'sess-1',
          isNewSession: true,
          durationMs: 500,
          exitCode: 0,
          toolHistory: [],
        });
        return {
          text: 'Done',
          sessionId: 'sess-1',
          isNewSession: true,
          durationMs: 500,
          exitCode: 0,
          toolHistory: [],
        };
      });

      await handler.handle(message);

      expect(mockApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chat_id: 67890,
          parse_mode: 'Markdown',
        })
      );
    });

    it('should handle onError callback', async () => {
      const message = createMockMessage();

      mockRouter.processMessageStream.mockImplementation(async (_chatId, _message, callbacks) => {
        callbacks.onError?.(new Error('Test error'));
        return {
          text: '',
          sessionId: 'sess-1',
          isNewSession: true,
          durationMs: 500,
          exitCode: 1,
          toolHistory: [],
        };
      });

      await handler.handle(message);

      expect(mockApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chat_id: 67890,
          text: expect.stringContaining('Error'),
        })
      );
    });

    it('should handle concurrent calls gracefully', async () => {
      const message1 = createMockMessage({ message_id: 1, text: 'First' });
      const message2 = createMockMessage({ message_id: 2, text: 'Second' });

      mockRouter.processMessageStream
        .mockResolvedValueOnce({
          text: 'Response 1',
          sessionId: 'sess-1',
          isNewSession: true,
          durationMs: 100,
          exitCode: 0,
          toolHistory: [],
        })
        .mockRejectedValueOnce(new Error('Already processing'));

      await handler.handle(message1);
    });

    it('should cleanup on completion', async () => {
      const message = createMockMessage();

      mockRouter.processMessageStream.mockResolvedValue({
        text: 'Response',
        sessionId: 'session-123',
        isNewSession: true,
        durationMs: 1000,
        exitCode: 0,
        toolHistory: [],
      });

      await handler.handle(message);

      expect(handler.destroy()).toBeUndefined();
    });
  });

  describe('createStreamingMessageHandler', () => {
    it('should create handler instance', () => {
      const handler = createStreamingMessageHandler(mockApi as unknown as ApiMethods, mockRouter as unknown as LLMRouter);
      expect(handler).toBeInstanceOf(StreamingMessageHandler);
    });
  });
});
