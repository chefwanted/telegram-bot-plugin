/**
 * Claude Service Type Definitions
 * Direct Anthropic API integration for Telegram bot
 */

import type Anthropic from '@anthropic-ai/sdk';

/** Claude service configuration options */
export interface ClaudeServiceOptions {
  /** Anthropic API key */
  apiKey: string;
  /** Model to use (default: claude-3-5-sonnet-20241022) */
  model?: string;
  /** Maximum tokens in response (default: 4096) */
  maxTokens?: number;
  /** Temperature for randomness (default: 0.7) */
  temperature?: number;
  /** Maximum history messages per conversation (default: 50) */
  maxHistoryMessages?: number;
  /** System prompt for bot persona */
  systemPrompt?: string;
}

/** Message in conversation history */
export interface ConversationMessage {
  /** Role: 'user' or 'assistant' */
  role: 'user' | 'assistant';
  /** Message content */
  content: string;
  /** Timestamp */
  timestamp: number;
}

/** Conversation state for a chat */
export interface Conversation {
  /** Unique conversation ID (chat ID) */
  id: string;
  /** Messages in this conversation */
  messages: ConversationMessage[];
  /** Last activity timestamp */
  lastActivity: number;
  /** Message count */
  messageCount: number;
}

/** Response from Claude service */
export interface ClaudeResponse {
  /** Response text from Claude */
  text: string;
  /** Usage information */
  usage: {
    /** Input tokens used */
    inputTokens: number;
    /** Output tokens used */
    outputTokens: number;
  };
}

/** Error types for Claude service */
export class ClaudeServiceError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'ClaudeServiceError';
  }
}

export class ClaudeRateLimitError extends ClaudeServiceError {
  constructor(message: string, public readonly retryAfter?: number) {
    super(message, 'RATE_LIMIT');
    this.name = 'ClaudeRateLimitError';
  }
}

export class ClaudeContentFilterError extends ClaudeServiceError {
  constructor(message: string) {
    super(message, 'CONTENT_FILTER');
    this.name = 'ClaudeContentFilterError';
  }
}
