/**
 * MiniMax API Types
 * OpenAI-compatible API for MiniMax
 */

export interface MiniMaxServiceOptions {
  /** MiniMax API key */
  apiKey: string;
  /** Model to use (default: MiniMax-Text-01) */
  model?: string;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Temperature for response generation */
  temperature?: number;
  /** System prompt for the bot */
  systemPrompt?: string;
  /** API endpoint */
  apiEndpoint?: string;
}

export interface MiniMaxMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface MiniMaxConversation {
  chatId: string;
  messages: MiniMaxMessage[];
  createdAt: number;
  lastAccessAt: number;
}

export interface MiniMaxResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface MiniMaxChatRequest {
  model: string;
  messages: MiniMaxMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface MiniMaxChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Custom error classes
export class MiniMaxServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'MiniMaxServiceError';
  }
}

export class MiniMaxRateLimitError extends MiniMaxServiceError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT');
    this.name = 'MiniMaxRateLimitError';
  }
}

export class MiniMaxContentFilterError extends MiniMaxServiceError {
  constructor(message: string = 'Content was filtered') {
    super(message, 'CONTENT_FILTER');
    this.name = 'MiniMaxContentFilterError';
  }
}
