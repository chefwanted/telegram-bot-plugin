/**
 * API Methods Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ApiMethods, createApiMethods } from '../../src/api/methods';
import type { Api } from 'grammy';
import axios from 'axios';

jest.mock('axios');

describe('ApiMethods', () => {
  let api: ApiMethods;
  let mockApi: { raw: Record<string, jest.Mock> };

  beforeEach(() => {
    const resolvedMock = <T>(value: T) => jest.fn<() => Promise<T>>().mockResolvedValue(value);
    mockApi = {
      raw: {
        sendMessage: resolvedMock({}),
        editMessageText: resolvedMock({}),
        deleteMessage: resolvedMock(true),
        answerCallbackQuery: resolvedMock(true),
        answerInlineQuery: resolvedMock(true),
        getFile: resolvedMock({}),
        getMe: resolvedMock({}),
        getChat: resolvedMock({}),
        setMyCommands: resolvedMock({ ok: true, result: true }),
        sendChatAction: resolvedMock(true),
      },
    };
    api = new ApiMethods(mockApi as unknown as Api);
  });

  describe('sendMessage', () => {
    it('should send message with correct params', async () => {
      await api.sendMessage({
        chat_id: 12345,
        text: 'Hello World',
      });

      expect(mockApi.raw.sendMessage).toHaveBeenCalledWith({
        chat_id: 12345,
        text: 'Hello World',
      });
    });
  });

  describe('editMessageText', () => {
    it('should edit message with correct params', async () => {
      await api.editMessageText({
        chat_id: 12345,
        message_id: 67890,
        text: 'Updated text',
      });

      expect(mockApi.raw.editMessageText).toHaveBeenCalledWith({
        chat_id: 12345,
        message_id: 67890,
        text: 'Updated text',
      });
    });
  });

  describe('deleteMessage', () => {
    it('should delete message with correct params', async () => {
      await api.deleteMessage(12345, 67890);

      expect(mockApi.raw.deleteMessage).toHaveBeenCalledWith({
        chat_id: 12345,
        message_id: 67890,
      });
    });
  });

  describe('answerCallbackQuery', () => {
    it('should answer callback query', async () => {
      await api.answerCallbackQuery({
        callback_query_id: 'abc123',
      });

      expect(mockApi.raw.answerCallbackQuery).toHaveBeenCalledWith({
        callback_query_id: 'abc123',
      });
    });
  });

  describe('getMe', () => {
    it('should call getMe method', async () => {
      await api.getMe();

      expect(mockApi.raw.getMe).toHaveBeenCalled();
    });
  });

  describe('getFile', () => {
    it('should call getFile with file_id', async () => {
      await api.getFile('file123');

      expect(mockApi.raw.getFile).toHaveBeenCalledWith({
        file_id: 'file123',
      });
    });
  });

  describe('getChat', () => {
    it('should get chat with correct id', async () => {
      await api.getChat(12345);

      expect(mockApi.raw.getChat).toHaveBeenCalledWith({
        chat_id: 12345,
      });
    });

    it('should get chat with string id', async () => {
      await api.getChat('@username');

      expect(mockApi.raw.getChat).toHaveBeenCalledWith({
        chat_id: '@username',
      });
    });
  });

  describe('downloadFile', () => {
    it('should download file with token', async () => {
      const mockedAxios = axios as jest.Mocked<typeof axios>;
      mockedAxios.get.mockResolvedValue({ data: new Uint8Array([1, 2, 3]) });

      const apiWithToken = new ApiMethods(mockApi as unknown as Api, {
        token: 'TEST_TOKEN',
        apiRoot: 'https://api.telegram.org',
      });

      const data = await apiWithToken.downloadFile('files/test.txt');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.telegram.org/file/botTEST_TOKEN/files/test.txt',
        { responseType: 'arraybuffer' }
      );
      expect(Buffer.isBuffer(data)).toBe(true);
    });

    it('should throw when token is missing', async () => {
      await expect(api.downloadFile('files/test.txt')).rejects.toThrow(
        'Bot token is vereist om bestanden te downloaden.'
      );
    });
  });

  describe('sendChatAction', () => {
    it('should send typing action', async () => {
      await api.sendChatAction({
        chat_id: 12345,
        action: 'typing',
      });

      expect(mockApi.raw.sendChatAction).toHaveBeenCalledWith({
        chat_id: 12345,
        action: 'typing',
      });
    });

    it('should support all action types', async () => {
      const actions = [
        'typing',
        'upload_photo',
        'record_video',
        'upload_video',
        'record_voice',
        'upload_voice',
        'upload_document',
        'find_location',
        'record_video_note',
        'upload_video_note',
      ] as const;

      for (const action of actions) {
        await api.sendChatAction({ chat_id: 12345, action });
        expect(mockApi.raw.sendChatAction).toHaveBeenCalledWith({
          chat_id: 12345,
          action,
        });
      }
    });
  });

  describe('createInlineKeyboard', () => {
    it('should create inline keyboard from strings', () => {
      const keyboard = api.createInlineKeyboard([
        ['Button 1', 'Button 2'],
        ['Button 3'],
      ]);

      expect(keyboard.inline_keyboard).toHaveLength(2);
      expect(keyboard.inline_keyboard[0]).toEqual([
        { text: 'Button 1', callback_data: 'Button 1' },
        { text: 'Button 2', callback_data: 'Button 2' },
      ]);
    });

    it('should preserve callback_data from objects', () => {
      const keyboard = api.createInlineKeyboard([
        [{ text: 'Click me', callback_data: 'custom_callback' }],
      ]);

      expect(keyboard.inline_keyboard[0][0]).toEqual({
        text: 'Click me',
        callback_data: 'custom_callback',
      });
    });

    it('should handle mixed buttons', () => {
      const keyboard = api.createInlineKeyboard([
        ['String button', { text: 'Object button', callback_data: 'obj' }],
      ]);

      expect(keyboard.inline_keyboard[0]).toHaveLength(2);
    });
  });

  describe('createReplyKeyboard', () => {
    it('should create reply keyboard', () => {
      const keyboard = api.createReplyKeyboard([
        ['Button 1', 'Button 2'],
        ['Button 3'],
      ]);

      expect(keyboard.keyboard).toHaveLength(2);
      expect(keyboard.resize_keyboard).toBe(true);
      expect(keyboard.keyboard[0]).toEqual([
        { text: 'Button 1' },
        { text: 'Button 2' },
      ]);
    });

    it('should merge additional options', () => {
      const keyboard = api.createReplyKeyboard([['Button']], {
        one_time_keyboard: true,
      });

      expect(keyboard.one_time_keyboard).toBe(true);
    });
  });

  describe('createRemoveKeyboard', () => {
    it('should create remove keyboard markup', () => {
      const keyboard = api.createRemoveKeyboard();

      expect(keyboard.remove_keyboard).toBe(true);
    });
  });

  describe('sendText', () => {
    it('should send simple text message', async () => {
      await api.sendText(12345, 'Hello');

      expect(mockApi.raw.sendMessage).toHaveBeenCalledWith({
        chat_id: 12345,
        text: 'Hello',
      });
    });

    it('should merge additional options', async () => {
      await api.sendText(12345, 'Hello', {
        parse_mode: 'HTML',
      });

      expect(mockApi.raw.sendMessage).toHaveBeenCalledWith({
        chat_id: 12345,
        text: 'Hello',
        parse_mode: 'HTML',
      });
    });
  });

  describe('sendWithKeyboard', () => {
    it('should send message with inline keyboard', async () => {
      const keyboard = api.createInlineKeyboard([['Test']]);

      await api.sendWithKeyboard(12345, 'Hello', keyboard);

      expect(mockApi.raw.sendMessage).toHaveBeenCalledWith({
        chat_id: 12345,
        text: 'Hello',
        reply_markup: keyboard,
      });
    });
  });

  describe('sendWithReplyKeyboard', () => {
    it('should send message with reply keyboard', async () => {
      const keyboard = api.createReplyKeyboard([['Test']]);

      await api.sendWithReplyKeyboard(12345, 'Hello', keyboard);

      expect(mockApi.raw.sendMessage).toHaveBeenCalledWith({
        chat_id: 12345,
        text: 'Hello',
        reply_markup: keyboard,
      });
    });
  });

  describe('removeKeyboard', () => {
    it('should send message with remove keyboard', async () => {
      await api.removeKeyboard(12345, 'Keyboard removed');

      expect(mockApi.raw.sendMessage).toHaveBeenCalledWith({
        chat_id: 12345,
        text: 'Keyboard removed',
        reply_markup: { remove_keyboard: true },
      });
    });
  });

  describe('setMyCommands', () => {
    it('should set bot commands', async () => {
      const commands = [
        { command: '/start', description: 'Start the bot' },
        { command: '/help', description: 'Show help' },
      ];

      await api.setMyCommands({ commands });

      expect(mockApi.raw.setMyCommands).toHaveBeenCalledWith({
        commands,
      });
    });
  });

  describe('setupCommands', () => {
    it('should setup commands with default scope', async () => {
      const commands = [
        { command: '/start', description: 'Start' },
      ];

      await api.setupCommands(commands);

      expect(mockApi.raw.setMyCommands).toHaveBeenCalledWith({
        commands,
        scope: undefined,
      });
    });

    it('should setup commands with custom scope', async () => {
      const commands = [{ command: '/start', description: 'Start' }];

      await api.setupCommands(commands, 'all_private_chats');

      expect(mockApi.raw.setMyCommands).toHaveBeenCalledWith({
        commands,
        scope: { type: 'all_private_chats' },
      });
    });
  });

  describe('editMessageTextStream', () => {
    it('should edit single message when under limit', async () => {
      await api.editMessageTextStream(12345, 67890, 'Short text');

      expect(mockApi.raw.editMessageText).toHaveBeenCalledWith({
        chat_id: 12345,
        message_id: 67890,
        text: 'Short text',
        parse_mode: undefined,
      });
    });

    it('should split and send multiple messages when over limit', async () => {
      const longText = 'A'.repeat(5000);

      await api.editMessageTextStream(12345, 67890, longText, { maxLength: 4000 });

      expect(mockApi.raw.editMessageText).toHaveBeenCalledTimes(1);
      expect(mockApi.raw.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should call onChunkSent callback', async () => {
      const onChunkSent = jest.fn();
      const longText = 'Line 1\nLine 2\nLine 3';

      await api.editMessageTextStream(12345, 67890, longText, {
        maxLength: 10,
        onChunkSent,
      });

      expect(onChunkSent).toHaveBeenCalled();
    });
  });

  describe('Formatting Helpers', () => {
    describe('escapeMarkdownV2', () => {
      it('should escape special characters', () => {
        const result = ApiMethods.escapeMarkdownV2('_*[]()~`>#+-=|{}.!');

        expect(result).toBe('\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!');
      });

      it('should not change regular text', () => {
        const result = ApiMethods.escapeMarkdownV2('Hello World 123');

        expect(result).toBe('Hello World 123');
      });

      it('should handle empty string', () => {
        const result = ApiMethods.escapeMarkdownV2('');

        expect(result).toBe('');
      });
    });

    describe('escapeHtml', () => {
      it('should escape HTML entities', () => {
        const result = ApiMethods.escapeHtml('<div>&test</div>');

        expect(result).toBe('&lt;div&gt;&amp;test&lt;/div&gt;');
      });

      it('should not change regular text', () => {
        const result = ApiMethods.escapeHtml('Hello World');

        expect(result).toBe('Hello World');
      });
    });

    describe('formatMarkdown', () => {
      it('should wrap text with bold', () => {
        const result = ApiMethods.formatMarkdown('text', { bold: true });

        expect(result).toBe('*text*');
      });

      it('should wrap text with italic', () => {
        const result = ApiMethods.formatMarkdown('text', { italic: true });

        expect(result).toBe('_text_');
      });

      it('should wrap text with code', () => {
        const result = ApiMethods.formatMarkdown('text', { code: true });

        expect(result).toBe('`text`');
      });

      it('should combine options', () => {
        const result = ApiMethods.formatMarkdown('text', {
          bold: true,
          italic: true,
          code: true,
        });

        // Order: code wraps italic-wrapped bold-wrapped text
        expect(result).toBe('`_*text*_`');
      });

      it('should escape special chars before formatting', () => {
        const result = ApiMethods.formatMarkdown('text_with*special', {
          bold: true,
        });

        expect(result).toBe('*text\\_with\\*special*');
      });
    });

    describe('formatHtml', () => {
      it('should wrap text with bold', () => {
        const result = ApiMethods.formatHtml('text', { bold: true });

        expect(result).toBe('<b>text</b>');
      });

      it('should wrap text with italic', () => {
        const result = ApiMethods.formatHtml('text', { italic: true });

        expect(result).toBe('<i>text</i>');
      });

      it('should wrap text with code', () => {
        const result = ApiMethods.formatHtml('text', { code: true });

        expect(result).toBe('<code>text</code>');
      });

      it('should escape HTML before formatting', () => {
        const result = ApiMethods.formatHtml('<script>', { bold: true });

        expect(result).toBe('<b>&lt;script&gt;</b>');
      });
    });
  });
});

describe('createApiMethods', () => {
  it('should create ApiMethods instance', () => {
    const mockApi = {
      raw: {
        sendMessage: jest.fn(),
      },
    } as unknown as Api;

    const api = createApiMethods(mockApi);

    expect(api).toBeInstanceOf(ApiMethods);
  });
});
