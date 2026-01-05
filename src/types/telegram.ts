/**
 * Telegram API Types
 * Types voor Telegram Bot API objecten en responses
 */

// =============================================================================
// Core Telegram Types
// =============================================================================

export interface User {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
}

export interface Chat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_forum?: boolean;
}

export interface Message {
  message_id: number;
  from?: User;
  chat: Chat;
  date: number;
  text?: string;
  entities?: MessageEntity[];
  reply_to_message?: Message;
  edit_date?: number;
}

export interface MessageEntity {
  type: 'mention' | 'hashtag' | 'bot_command' | 'url' | 'email' | 'bold' | 'italic' | 'code' | 'pre';
  offset: number;
  length: number;
  url?: string;
  language?: string;
}

// =============================================================================
// Update Types
// =============================================================================

export interface Update {
  update_id: number;
  message?: Message;
  edited_message?: Message;
  callback_query?: CallbackQuery;
  inline_query?: InlineQuery;
  chosen_inline_result?: ChosenInlineResult;
}

// =============================================================================
// Callback Query Types
// =============================================================================

export interface CallbackQuery {
  id: string;
  from: User;
  message?: Message;
  inline_message_id?: string;
  chat_instance?: string;
  data?: string;
  game_short_name?: string;
}

// =============================================================================
// Inline Query Types
// =============================================================================

export interface InlineQuery {
  id: string;
  from: User;
  query: string;
  offset: string;
  chat_type?: string;
}

export interface ChosenInlineResult {
  result_id: string;
  from: User;
  query?: string;
  inline_message_id?: string;
}

// =============================================================================
// Keyboard Types
// =============================================================================

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  callback_game?: CallbackGame;
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
}

export interface CallbackGame {
  user_score?: number;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface KeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
  request_poll?: KeyboardButtonPollType;
}

export interface KeyboardButtonPollType {
  type?: 'quiz' | 'regular';
}

export interface ReplyKeyboardMarkup {
  keyboard: KeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  input_field_placeholder?: string;
  selective?: boolean;
}

export interface ReplyKeyboardRemove {
  remove_keyboard: boolean;
  selective?: boolean;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface ApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: ResponseParameters;
}

export interface ResponseParameters {
  migrate_to_chat_id?: number;
  retry_after?: number;
}

export interface SendMessageResponse {
  message_id: number;
  from?: User;
  chat: Chat;
  date: number;
  text?: string;
}

export interface GetUpdatesResponse {
  result: Update[];
}

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
