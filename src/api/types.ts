/**
 * API Response Types
 * Types voor Telegram API responses en errors
 */

import type { BotCommand, InlineQueryResult, Message } from 'grammy/types';

// =============================================================================
// Method Response Types
// =============================================================================

export type SendMessageResponse = Message;

export type EditMessageTextResponse = Message | true;

export type AnswerCallbackQueryResponse = boolean;

export type AnswerInlineQueryResponse = boolean;

// =============================================================================
// Inline Query Types
// =============================================================================

export type { InlineQueryResult, BotCommand };

export interface AnswerInlineQueryRequest {
  inline_query_id: string;
  results: InlineQueryResult[];
  cache_time?: number;
  is_personal?: boolean;
  next_offset?: string;
}

export interface GetMeResponse {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

export interface GetChatResponse {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  description?: string;
  invite_link?: string;
}

export type SetMyCommandsResponse = boolean;

// =============================================================================
// Bot Command Types
// =============================================================================

export interface SetMyCommandsRequest {
  commands: BotCommand[];
  scope?: {
    type: 'default' | 'all_private_chats' | 'all_group_chats' | 'all_chat_administrators';
    chat_id?: number | string;
  };
  language_code?: string;
}

// =============================================================================
// Request Types
// =============================================================================

export interface SendMessageRequest {
  chat_id: number | string;
  text: string;
  parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_to_message_id?: number;
  reply_markup?: object;
}

export interface EditMessageTextRequest {
  chat_id?: number | string;
  message_id?: number;
  inline_message_id?: string;
  text: string;
  parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  disable_web_page_preview?: boolean;
  reply_markup?: object;
}

export interface AnswerCallbackQueryRequest {
  callback_query_id: string;
  text?: string;
  show_alert?: boolean;
  url?: string;
  cache_time?: number;
}

// =============================================================================
// HTTP Request Config
// =============================================================================

export interface RequestConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface RequestResult<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}

// =============================================================================
// API Error Types
// =============================================================================

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export class ApiTimeoutError extends Error {
  constructor(message: string, public timeout: number) {
    super(message);
    this.name = 'ApiTimeoutError';
  }
}

export class ApiRetryExhaustedError extends Error {
  constructor(
    message: string,
    public attempts: number,
    public lastError?: Error
  ) {
    super(message);
    this.name = 'ApiRetryExhaustedError';
  }
}
