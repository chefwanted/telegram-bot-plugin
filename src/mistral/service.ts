/**
 * Mistral API Service
 * OpenAI-compatible API integration for Telegram bot
 */

import * as https from 'https';
import type {
  MistralServiceOptions,
  MistralMessage,
  MistralConversation,
  MistralResponse,
  MistralChatRequest,
  MistralChatResponse,
} from './types';
import {
  MistralServiceError,
  MistralRateLimitError,
  MistralContentFilterError,
} from './types';

// Default system prompt for the bot
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant in Telegram.
- Be concise and direct
- Use markdown for code blocks
- Respond in user's language when possible
- Keep responses under 4000 characters
- Be friendly and professional`;

// Coding-focused system prompt for /code (developer mode)
const DEV_SYSTEM_PROMPT = `You are a senior software engineer helping via Telegram.
- Default to Dutch if the user writes Dutch, otherwise mirror the user language.
- Keep answers compact and actionable. Prefer bullet lists.
- When providing changes, output unified diffs or apply_patch blocks. If multiple files, separate code blocks per file.
- Never invent files that don't exist; if context is missing, ask a short clarifying question first.
- For shell steps, use bash fenced blocks. For code, use the correct language fences.
- Maximum ~3500 characters per reply; if longer, summarize and offer to continue.`;

export class MistralService {
  private options: Required<MistralServiceOptions>;
  private conversations: Map<string, MistralConversation> = new Map();

  constructor(options: MistralServiceOptions) {
    this.options = {
      apiKey: options.apiKey,
      model: options.model || 'mistral-small-latest',
      maxTokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
      systemPrompt: options.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      apiEndpoint: options.apiEndpoint || 'https://api.mistral.ai/v1',
    };
  }

  /**
   * Process a message from a user and get AI response
   */
  async processMessage(
    chatId: string,
    userMessage: string,
    options?: { model?: string }
  ): Promise<MistralResponse> {
    return this.processMessageInternal(chatId, userMessage, this.options.systemPrompt, options?.model);
  }

  /**
   * Process a developer-focused message (used by /code)
   */
  async processDeveloperMessage(
    chatId: string,
    userMessage: string,
    options?: { model?: string }
  ): Promise<MistralResponse> {
    const scopedChatId = `dev:${chatId}`;
    return this.processMessageInternal(scopedChatId, userMessage, DEV_SYSTEM_PROMPT, options?.model);
  }

  /**
   * Shared message processor with custom system prompt
   */
  private async processMessageInternal(
    chatId: string,
    userMessage: string,
    systemPrompt: string,
    modelOverride?: string,
  ): Promise<MistralResponse> {
    const conversation = this.getConversation(chatId);

    conversation.messages.push({
      role: 'user',
      content: userMessage,
    });
    conversation.lastAccessAt = Date.now();

    try {
      const apiMessages: MistralMessage[] = [
        { role: 'system', content: systemPrompt },
        ...conversation.messages,
      ];

      const response = await this.callChatAPI(apiMessages, modelOverride);
      const text = response.choices[0]?.message?.content || '';

      conversation.messages.push({
        role: 'assistant',
        content: text,
      });

      return {
        text,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      conversation.messages.pop();
      throw error;
    }
  }

  /**
   * Call Mistral chat completion API
   */
  private async callChatAPI(
    messages: MistralMessage[],
    modelOverride?: string
  ): Promise<MistralChatResponse> {
    const requestBody: MistralChatRequest = {
      model: modelOverride || this.options.model,
      messages,
      max_tokens: this.options.maxTokens,
      temperature: this.options.temperature,
      stream: false,
    };

    return new Promise((resolve, reject) => {
      const url = new URL('/chat/completions', this.options.apiEndpoint);

      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.options.apiKey}`,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              const errorData = JSON.parse(data);
              this.handleAPIError(res.statusCode, errorData);
              return;
            }

            const response: MistralChatResponse = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(new MistralServiceError(`Failed to parse response: ${error}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new MistralServiceError(`Request failed: ${error.message}`));
      });

      req.write(JSON.stringify(requestBody));
      req.end();
    });
  }

  getModel(): string {
    return this.options.model;
  }

  /**
   * Handle API errors and convert to appropriate error types
   */
  private handleAPIError(statusCode: number | undefined, errorData: unknown): never {
    const hasErrorMessage = (data: unknown): data is { error: { message?: string; code?: string } } => {
      return typeof data === 'object' && data !== null && 'error' in data;
    };

    if (statusCode === 429) {
      const message = hasErrorMessage(errorData) ? errorData.error?.message || 'Rate limit exceeded' : 'Rate limit exceeded';
      throw new MistralRateLimitError(message);
    }

    if (statusCode === 400) {
      const message = hasErrorMessage(errorData) ? errorData.error?.message || 'Content was filtered' : 'Content was filtered';
      throw new MistralContentFilterError(message);
    }

    throw new MistralServiceError(
      hasErrorMessage(errorData) ? errorData.error?.message || `API error: ${statusCode}` : `API error: ${statusCode}`,
      hasErrorMessage(errorData) ? errorData.error?.code : undefined
    );
  }

  /**
   * Get or create conversation for a chat
   */
  private getConversation(chatId: string): MistralConversation {
    let conversation = this.conversations.get(chatId);

    if (!conversation) {
      conversation = {
        chatId,
        messages: [],
        createdAt: Date.now(),
        lastAccessAt: Date.now(),
      };
      this.conversations.set(chatId, conversation);
    }

    return conversation;
  }

  /**
   * Clean up old conversations
   */
  cleanupOldConversations(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();

    for (const [chatId, conversation] of this.conversations.entries()) {
      if (now - conversation.lastAccessAt > maxAgeMs) {
        this.conversations.delete(chatId);
      }
    }
  }

  /**
   * Destroy the service and cleanup resources
   */
  destroy(): void {
    this.conversations.clear();
  }
}
