/**
 * Telegram API Method Wrappers
 * Type-safe wrappers voor Telegram Bot API methoden
 */

import type { Api } from 'grammy';
import axios from 'axios';
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
  GetFileResponse,
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
  private callCount = 0;

  constructor(
    private api: Api,
    private config: {
      token?: string;
      apiRoot?: string;
    } = {}
  ) {}

  private async withCount<T>(fn: () => Promise<T>): Promise<T> {
    this.callCount += 1;
    return fn();
  }

  getCallCount(): number {
    return this.callCount;
  }

  resetCallCount(): void {
    this.callCount = 0;
  }

  // ==========================================================================
  // Messaging Methods
  // ==========================================================================

  /**
   * Verstuur tekstbericht
   */
  async sendMessage(
    request: SendMessageRequest
  ): Promise<SendMessageResponse> {
    return this.withCount(() =>
      this.api.raw.sendMessage(request as unknown as Parameters<Api['raw']['sendMessage']>[0])
    );
  }

  /**
   * Bewerkt tekstbericht
   */
  async editMessageText(
    request: EditMessageTextRequest
  ): Promise<EditMessageTextResponse> {
    return this.withCount(() =>
      this.api.raw.editMessageText(request as unknown as Parameters<Api['raw']['editMessageText']>[0])
    );
  }

  /**
   * Verwijder bericht
   */
  async deleteMessage(
    chatId: number | string,
    messageId: number
  ): Promise<boolean> {
    return this.withCount(() => this.api.raw.deleteMessage({
      chat_id: chatId,
      message_id: messageId,
    }));
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
    return this.withCount(() =>
      this.api.raw.answerCallbackQuery(
        request as unknown as Parameters<Api['raw']['answerCallbackQuery']>[0]
      )
    );
  }

  /**
   * Beantwoord inline query
   */
  async answerInlineQuery(
    request: AnswerInlineQueryRequest
  ): Promise<AnswerInlineQueryResponse> {
    return this.withCount(() =>
      this.api.raw.answerInlineQuery(request as unknown as Parameters<Api['raw']['answerInlineQuery']>[0])
    );
  }

  // ==========================================================================
  // Chat Methods
  // ==========================================================================

  /**
   * Haal bot informatie op
   */
  async getMe(): Promise<GetMeResponse> {
    return this.withCount(() => this.api.raw.getMe());
  }

  /**
   * Haal bestand info op
   */
  async getFile(fileId: string): Promise<GetFileResponse> {
    return this.withCount(() =>
      this.api.raw.getFile({ file_id: fileId } as unknown as Parameters<Api['raw']['getFile']>[0])
    );
  }

  /**
   * Haal chat informatie op
   */
  async getChat(chatId: number | string): Promise<GetChatResponse> {
    return this.withCount(() => this.api.raw.getChat({
      chat_id: chatId,
    }));
  }

  /**
   * Download een bestand via file_path
   */
  async downloadFile(filePath: string): Promise<Buffer> {
    const token = this.config.token;
    if (!token) {
      throw new Error('Bot token is vereist om bestanden te downloaden.');
    }
    const apiRoot = this.config.apiRoot || 'https://api.telegram.org';
    const url = `${apiRoot}/file/bot${token}/${filePath}`;
    return this.withCount(async () => {
      const response = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    });
  }

  /**
   * Haal chat foto op
   */
  async getChatPhoto(chatId: number | string): Promise<object> {
    return this.withCount(async () => {
      const chat = await this.api.raw.getChat({ chat_id: chatId });
      return (chat as { photo?: object }).photo || {};
    });
  }

  /**
   * Stel bot commando's in (voor / menu in Telegram)
   */
  async setMyCommands(request: SetMyCommandsRequest): Promise<SetMyCommandsResponse> {
    return this.withCount(() =>
      this.api.raw.setMyCommands(request as unknown as Parameters<Api['raw']['setMyCommands']>[0])
    );
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

  /**
   * Stuur chat action (typing indicator, etc.)
   */
  async sendChatAction(params: {
    chat_id: number | string;
    action: 'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 'record_voice' | 'upload_voice' | 'upload_document' | 'find_location' | 'record_video_note' | 'upload_video_note';
  }): Promise<boolean> {
    return this.withCount(() =>
      this.api.raw.sendChatAction(
        params as unknown as Parameters<Api['raw']['sendChatAction']>[0]
      )
    );
  }

  /**
   * Stream content to message via editing and new messages
   * Used for streaming long responses
   */
  async editMessageTextStream(
    chatId: number | string,
    messageId: number,
    text: string,
    options: {
      maxLength?: number;
      parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML';
      onChunkSent?: (chunk: string, remaining: string, index: number) => void;
    } = {}
  ): Promise<void> {
    const { maxLength = 4000, parse_mode, onChunkSent } = options;

    if (text.length <= maxLength) {
      // Fits in one message, just edit
      await this.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode,
      });
      return;
    }

    // Need to split into chunks
    const chunks = this.splitIntoChunks(text, maxLength);

    // Edit with first chunk + continuation indicator
    await this.editMessageText({
      chat_id: chatId,
      message_id: messageId,
      text: chunks[0] + '\n\n_...continuing..._',
      parse_mode,
    });

    // Send remaining chunks as new messages
    for (let i = 1; i < chunks.length; i++) {
      await this.sendMessage({
        chat_id: chatId,
        text: chunks[i],
        parse_mode,
      });

      const remaining = chunks.slice(i + 1).join('\n');
      onChunkSent?.(chunks[i], remaining, i);
    }
  }

  /**
   * Helper: Split text into chunks respecting Telegram limits
   */
  private splitIntoChunks(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    const lines = text.split('\n');
    let current = '';

    for (const line of lines) {
      if ((current + line).length > maxLength) {
        if (current) {
          chunks.push(current);
        }

        // If single line exceeds limit, split it
        if (line.length > maxLength) {
          const lineChunks = Math.ceil(line.length / maxLength);
          for (let j = 0; j < lineChunks; j++) {
            chunks.push(line.substring(j * maxLength, (j + 1) * maxLength));
          }
          current = '';
        } else {
          current = line + '\n';
        }
      } else {
        current += (current ? '\n' : '') + line;
      }
    }

    if (current) {
      chunks.push(current);
    }

    return chunks;
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

export function createApiMethods(api: Api, config?: { token?: string; apiRoot?: string }): ApiMethods {
  return new ApiMethods(api, config);
}
