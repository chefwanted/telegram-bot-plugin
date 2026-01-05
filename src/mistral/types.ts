/**
 * Mistral API Service Types
 * OpenAI-compatible API integration
 */

export interface MistralServiceOptions {
  /** Mistral API key */
  apiKey: string;
  /** Model to use (default: mistral-large-latest) */
  model?: string;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Temperature for response generation */
  temperature?: number;
  /** System prompt for the bot */
  systemPrompt?: string;
  /** API endpoint (default: https://api.mistral.ai/v1) */
  apiEndpoint?: string;
}

export interface MistralMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface MistralConversation {
  chatId: string;
  messages: MistralMessage[];
  createdAt: number;
  lastAccessAt: number;
}

export interface MistralResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface MistralChatRequest {
  model: string;
  messages: MistralMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface MistralChatResponse {
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
export class MistralServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'MistralServiceError';
  }
}

export class MistralRateLimitError extends MistralServiceError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT');
    this.name = 'MistralRateLimitError';
  }
}

export class MistralContentFilterError extends MistralServiceError {
  constructor(message: string = 'Content was filtered') {
    super(message, 'CONTENT_FILTER');
    this.name = 'MistralContentFilterError';
  }
}
