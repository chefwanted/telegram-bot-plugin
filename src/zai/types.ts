/**
 * Z.ai GLM-4.7 Service Types
 * OpenAI-compatible API integration
 */

export interface ZAIServiceOptions {
  /** Z.ai API key */
  apiKey: string;
  /** Model to use (default: glm-4.7) */
  model?: string;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Temperature for response generation */
  temperature?: number;
  /** System prompt for the bot */
  systemPrompt?: string;
  /** API endpoint (default: https://api.z.ai/api/coding/paas/v4) */
  apiEndpoint?: string;
}

export interface ZAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ZAIConversation {
  chatId: string;
  messages: ZAIMessage[];
  createdAt: number;
  lastAccessAt: number;
}

export interface ZAIResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ZAIChatRequest {
  model: string;
  messages: ZAIMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ZAIChatResponse {
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
export class ZAIServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ZAIServiceError';
  }
}

export class ZAIRateLimitError extends ZAIServiceError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT');
    this.name = 'ZAIRateLimitError';
  }
}

export class ZAIContentFilterError extends ZAIServiceError {
  constructor(message: string = 'Content was filtered') {
    super(message, 'CONTENT_FILTER');
    this.name = 'ZAIContentFilterError';
  }
}
