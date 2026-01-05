/**
 * Z.ai GLM-4.7 Service
 * OpenAI-compatible API integration for Telegram bot
 */

import * as https from 'https';
import type { ZAIServiceOptions, ZAIMessage, ZAIConversation, ZAIResponse, ZAIChatRequest, ZAIChatResponse } from './types';
import { ZAIServiceError, ZAIRateLimitError, ZAIContentFilterError } from './types';

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

export class ZAIService {
  private options: Required<ZAIServiceOptions>;
  private conversations: Map<string, ZAIConversation> = new Map();

  constructor(options: ZAIServiceOptions) {
    this.options = {
      apiKey: options.apiKey,
      model: options.model || 'glm-4.7',
      maxTokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
      systemPrompt: options.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      apiEndpoint: options.apiEndpoint || 'https://api.z.ai/api/coding/paas/v4',
    };
  }

  /**
   * Process a message from a user and get AI response
   */
  async processMessage(chatId: string, userMessage: string): Promise<ZAIResponse> {
    return this.processMessageInternal(chatId, userMessage, this.options.systemPrompt);
  }

  /**
   * Process a developer-focused message (used by /code)
   */
  async processDevMessage(chatId: string, userMessage: string): Promise<ZAIResponse> {
    // Use separate conversation namespace to avoid mixing with chat mode
    const scopedChatId = `dev:${chatId}`;
    return this.processMessageInternal(scopedChatId, userMessage, DEV_SYSTEM_PROMPT);
  }

  /**
   * Shared message processor with custom system prompt
   */
  private async processMessageInternal(
    chatId: string,
    userMessage: string,
    systemPrompt: string,
  ): Promise<ZAIResponse> {
    // Get or create conversation
    const conversation = this.getConversation(chatId);

    // Add user message to conversation
    conversation.messages.push({
      role: 'user',
      content: userMessage,
    });
    conversation.lastAccessAt = Date.now();

    try {
      // Prepare messages for API (include system prompt)
      const apiMessages: ZAIMessage[] = [
        { role: 'system', content: systemPrompt },
        ...conversation.messages,
      ];

      // Call Z.ai API
      const response = await this.callChatAPI(apiMessages);

      // Extract response text
      const text = response.choices[0]?.message?.content || '';

      // Add assistant response to conversation
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
      // Remove failed user message from conversation
      conversation.messages.pop();
      throw error;
    }
  }

  /**
   * Call Z.ai chat completion API
   */
  private async callChatAPI(messages: ZAIMessage[]): Promise<ZAIChatResponse> {
    const requestBody: ZAIChatRequest = {
      model: this.options.model,
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

            const response: ZAIChatResponse = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(new ZAIServiceError(`Failed to parse response: ${error}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new ZAIServiceError(`Request failed: ${error.message}`));
      });

      req.write(JSON.stringify(requestBody));
      req.end();
    });
  }

  /**
   * Handle API errors and convert to appropriate error types
   */
  private handleAPIError(statusCode: number | undefined, errorData: any): never {
    if (statusCode === 429) {
      throw new ZAIRateLimitError(errorData.error?.message || 'Rate limit exceeded');
    }

    if (statusCode === 400) {
      throw new ZAIContentFilterError(errorData.error?.message || 'Content was filtered');
    }

    throw new ZAIServiceError(
      errorData.error?.message || `API error: ${statusCode}`,
      errorData.error?.code
    );
  }

  /**
   * Get or create conversation for a chat
   */
  private getConversation(chatId: string): ZAIConversation {
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
   * Clear conversation history for a chat
   */
  clearConversation(chatId: string): void {
    this.conversations.delete(chatId);
  }

  /**
   * Get conversation info
   */
  getConversationInfo(chatId: string): { messageCount: number; createdAt: number; lastAccessAt: number } | undefined {
    const conversation = this.conversations.get(chatId);
    if (!conversation) {
      return undefined;
    }

    return {
      messageCount: conversation.messages.length,
      createdAt: conversation.createdAt,
      lastAccessAt: conversation.lastAccessAt,
    };
  }

  /**
   * Get all conversations
   */
  getAllConversations(): Map<string, ZAIConversation> {
    return new Map(this.conversations);
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
