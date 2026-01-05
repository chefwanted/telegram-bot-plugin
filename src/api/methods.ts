/**
 * Telegram API Method Wrappers
 * Type-safe wrappers voor Telegram Bot API methoden
 */

import type { ApiClient } from './client';
import type {
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup,
  ReplyKeyboardRemove,
} from '../types/telegram';
import type {
  SendMessageRequest,
  EditMessageTextRequest,
  AnswerCallbackQueryRequest,
  AnswerInlineQueryRequest,
  SendMessageResponse,
  EditMessageTextResponse,
  AnswerCallbackQueryResponse,
  AnswerInlineQueryResponse,
  GetMeResponse,
  GetChatResponse,
  SetMyCommandsRequest,
  SetMyCommandsResponse,
  BotCommand,
} from './types';

// =============================================================================
// API Methods Class
// =============================================================================

export class ApiMethods {
  constructor(private client: ApiClient) {}

  // ==========================================================================
  // Messaging Methods
  // ==========================================================================

  /**
   * Verstuur tekstbericht
   */
  async sendMessage(
    request: SendMessageRequest
  ): Promise<SendMessageResponse> {
    return this.client.call<SendMessageResponse>('sendMessage', request as unknown as Record<string, unknown>);
  }

  /**
   * Bewerkt tekstbericht
   */
  async editMessageText(
    request: EditMessageTextRequest
  ): Promise<EditMessageTextResponse> {
    return this.client.call<EditMessageTextResponse>(
      'editMessageText',
      request as unknown as Record<string, unknown>
    );
  }

  /**
   * Verwijder bericht
   */
  async deleteMessage(
    chatId: number | string,
    messageId: number
  ): Promise<boolean> {
    return this.client.call<boolean>('deleteMessage', {
      chat_id: chatId,
      message_id: messageId,
    });
  }

  // ==========================================================================
  // Callback Query Methods
  // ==========================================================================

  /**
   * Beantwoord callback query
   */
  async answerCallbackQuery(
    request: AnswerCallbackQueryRequest
  ): Promise<AnswerCallbackQueryResponse> {
    return this.client.call<AnswerCallbackQueryResponse>(
      'answerCallbackQuery',
      request as unknown as Record<string, unknown>
    );
  }

  /**
   * Beantwoord inline query
   */
  async answerInlineQuery(
    request: AnswerInlineQueryRequest
  ): Promise<AnswerInlineQueryResponse> {
    return this.client.call<AnswerInlineQueryResponse>(
      'answerInlineQuery',
      request as unknown as Record<string, unknown>
    );
  }

  // ==========================================================================
  // Chat Methods
  // ==========================================================================

  /**
   * Haal bot informatie op
   */
  async getMe(): Promise<GetMeResponse> {
    return this.client.call<GetMeResponse>('getMe');
  }

  /**
   * Haal chat informatie op
   */
  async getChat(chatId: number | string): Promise<GetChatResponse> {
    return this.client.call<GetChatResponse>('getChat', {
      chat_id: chatId,
    });
  }

  /**
   * Haal chat foto op
   */
  async getChatPhoto(chatId: number | string): Promise<object> {
    return this.client.call<object>('getChatPhoto', {
      chat_id: chatId,
    });
  }

  /**
   * Stel bot commando's in (voor / menu in Telegram)
   */
  async setMyCommands(request: SetMyCommandsRequest): Promise<SetMyCommandsResponse> {
    return this.client.call<SetMyCommandsResponse>('setMyCommands', request as unknown as Record<string, unknown>);
  }

  /**
   * Helper: Stel commando's in met een array van {command, description}
   */
  async setupCommands(commands: BotCommand[], scope?: 'default' | 'all_private_chats' | 'all_group_chats' | 'all_chat_administrators'): Promise<SetMyCommandsResponse> {
    return this.setMyCommands({
      commands,
      scope: scope ? { type: scope } : undefined,
    });
  }

  // ==========================================================================
  // Keyboard Helpers
// =============================================================================

  /**
   * Maak inline keyboard
   */
  createInlineKeyboard(
    buttons: (string | { text: string; callback_data: string })[][]
  ): InlineKeyboardMarkup {
    return {
      inline_keyboard: buttons.map(row =>
        row.map(btn => {
          if (typeof btn === 'string') {
            return { text: btn, callback_data: btn };
          }
          return btn;
        })
      ),
    };
  }

  /**
   * Maak reply keyboard
   */
  createReplyKeyboard(
    buttons: string[][],
    options: Partial<ReplyKeyboardMarkup> = {}
  ): ReplyKeyboardMarkup {
    return {
      keyboard: buttons.map(row => row.map(text => ({ text }))),
      resize_keyboard: true,
      ...options,
    };
  }

  /**
   * Maak remove keyboard markup
   */
  createRemoveKeyboard(): ReplyKeyboardRemove {
    return {
      remove_keyboard: true,
    };
  }

  // ==========================================================================
  // Convenience Methods
  // ==========================================================================

  /**
   * Verstuur eenvoudig tekstbericht
   */
  async sendText(
    chatId: number | string,
    text: string,
    options: Partial<SendMessageRequest> = {}
  ): Promise<SendMessageResponse> {
    return this.sendMessage({
      chat_id: chatId,
      text,
      ...options,
    });
  }

  /**
   * Verstuur bericht met inline keyboard
   */
  async sendWithKeyboard(
    chatId: number | string,
    text: string,
    keyboard: InlineKeyboardMarkup,
    options: Partial<SendMessageRequest> = {}
  ): Promise<SendMessageResponse> {
    return this.sendMessage({
      chat_id: chatId,
      text,
      reply_markup: keyboard,
      ...options,
    });
  }

  /**
   * Verstuur bericht met reply keyboard
   */
  async sendWithReplyKeyboard(
    chatId: number | string,
    text: string,
    keyboard: ReplyKeyboardMarkup,
    options: Partial<SendMessageRequest> = {}
  ): Promise<SendMessageResponse> {
    return this.sendMessage({
      chat_id: chatId,
      text,
      reply_markup: keyboard,
      ...options,
    });
  }

  /**
   * Verwijder reply keyboard
   */
  async removeKeyboard(
    chatId: number | string,
    text: string
  ): Promise<SendMessageResponse> {
    return this.sendMessage({
      chat_id: chatId,
      text,
      reply_markup: this.createRemoveKeyboard(),
    });
  }

  // ==========================================================================
  // Formatting Helpers
  // ==========================================================================

  /**
   * Escape MarkdownV2 tekst
   */
  static escapeMarkdownV2(text: string): string {
    const specialChars = [
      '_',
      '*',
      '[',
      ']',
      '(',
      ')',
      '~',
      '`',
      '>',
      '#',
      '+',
      '-',
      '=',
      '|',
      '{',
      '}',
      '.',
      '!',
    ];

    let escaped = text;
    for (const char of specialChars) {
      escaped = escaped.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`);
    }

    return escaped;
  }

  /**
   * Escape HTML tekst
   */
  static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Formatteer bericht met MarkdownV2
   */
  static formatMarkdown(
    text: string,
    options: { bold?: boolean; italic?: boolean; code?: boolean } = {}
  ): string {
    let formatted = this.escapeMarkdownV2(text);

    if (options.bold) {
      formatted = `*${formatted}*`;
    }
    if (options.italic) {
      formatted = `_${formatted}_`;
    }
    if (options.code) {
      formatted = `\`${formatted}\``;
    }

    return formatted;
  }

  /**
   * Formatteer bericht met HTML
   */
  static formatHtml(
    text: string,
    options: { bold?: boolean; italic?: boolean; code?: boolean } = {}
  ): string {
    let formatted = this.escapeHtml(text);

    if (options.bold) {
      formatted = `<b>${formatted}</b>`;
    }
    if (options.italic) {
      formatted = `<i>${formatted}</i>`;
    }
    if (options.code) {
      formatted = `<code>${formatted}</code>`;
    }

    return formatted;
  }
}

// =============================================================================
// Export Factory
// =============================================================================

export function createApiMethods(client: ApiClient): ApiMethods {
  return new ApiMethods(client);
}
