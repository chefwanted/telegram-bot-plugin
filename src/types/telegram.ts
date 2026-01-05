/**
 * Telegram API Types
 * Types worden hergebruikt vanuit grammY.
 */

import type { ResponseParameters } from 'grammy/types';

export type {
  Update,
  Message,
  User,
  Chat,
  MessageEntity,
  CallbackQuery,
  InlineQuery,
  ChosenInlineResult,
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  KeyboardButton,
  KeyboardButtonPollType,
  ReplyKeyboardMarkup,
  ReplyKeyboardRemove,
  ApiResponse,
  ResponseParameters,
} from 'grammy/types';

// =============================================================================
// Error Types
// =============================================================================

export class TelegramApiError extends Error {
  constructor(
    public errorCode: number,
    public description: string,
    public parameters?: ResponseParameters
  ) {
    super(`Telegram API Error ${errorCode}: ${description}`);
    this.name = 'TelegramApiError';
  }
}

export class TelegramBotError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'TelegramBotError';
  }
}
