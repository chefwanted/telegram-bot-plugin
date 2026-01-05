/**
 * MiniMax API Service
 * OpenAI-compatible API integration for Telegram bot
 */

import * as https from 'https';
import type { MiniMaxServiceOptions, MiniMaxMessage, MiniMaxConversation, MiniMaxResponse } from './types';
import { MiniMaxServiceError, MiniMaxRateLimitError, MiniMaxContentFilterError } from './types';

// Default system prompt for the bot
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant in Telegram.
- Be concise and direct
- Use markdown for code blocks
- Respond in user's language when possible
- Keep responses under 4000 characters
- Be friendly and professional`;

export class MiniMaxService {
  private options: Required<MiniMaxServiceOptions>;
  private conversations: Map<string, MiniMaxConversation> = new Map();
  private useLite = false; // Track if using lite fallback

  constructor(options: MiniMaxServiceOptions) {
    this.options = {
      apiKey: options.apiKey,
      model: options.model || 'MiniMax-v2.1', // Use 2.1 by default
      maxTokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
      systemPrompt: options.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      apiEndpoint: options.apiEndpoint || 'https://api.minimax.chat/v1',
    };
  }

  /**
   * Process a message from a user and get AI response
   */
  async processMessage(chatId: string, userMessage: string): Promise<MiniMaxResponse> {
    return this.processMessageInternal(chatId, userMessage, this.options.systemPrompt);
  }

  /**
   * Process a developer-focused message
   */
  async processDeveloperMessage(chatId: string, userMessage: string): Promise<MiniMaxResponse> {
    const devPrompt = `You are a senior software engineer helping via Telegram.
- Default to Dutch if the user writes Dutch, otherwise mirror the user language.
- Keep answers compact and actionable. Prefer bullet lists.
- When providing changes, output unified diffs or apply_patch blocks.
- Never invent files that don't exist; if context is missing, ask a clarifying question.
- Maximum ~3500 characters per reply; if longer, summarize and offer to continue.`;

    return this.processMessageInternal(chatId, userMessage, devPrompt);
  }

  /**
   * Internal message processing
   */
  private async processMessageInternal(
    chatId: string,
    userMessage: string,
    systemPrompt: string
  ): Promise<MiniMaxResponse> {
    const conversation = this.getConversation(chatId);

    // Add user message to conversation
    conversation.messages.push({
      role: 'user',
      content: userMessage,
    });

    const startTime = Date.now();

    try {
      const response = await this.callMiniMaxAPI(conversation.messages, systemPrompt);
      const duration = Date.now() - startTime;

      // Extract response text
      const text = this.extractResponseText(response);

      // Add assistant response to conversation
      conversation.messages.push({
        role: 'assistant',
        content: text,
      });

      conversation.lastAccessAt = Date.now();

      return {
        text,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      // Remove user message if request failed
      conversation.messages.pop();
      throw error;
    }
  }

  /**
   * Call MiniMax API with fallback to lite
   */
  private async callMiniMaxAPI(messages: MiniMaxMessage[], systemPrompt: string): Promise<any> {
    const model = this.useLite ? 'MiniMax-Lite' : this.options.model;

    try {
      return await this.callAPI(model, messages, systemPrompt);
    } catch (error) {
      // If not using lite and we get an error, try lite fallback
      if (!this.useLite && error instanceof MiniMaxServiceError) {
        console.log(`[MiniMax] Primary model failed, trying lite fallback...`);
        this.useLite = true;
        return await this.callAPI('MiniMax-Lite', messages, systemPrompt);
      }
      throw error;
    }
  }

  /**
   * Actual API call implementation
   */
  private async callAPI(model: string, messages: MiniMaxMessage[], systemPrompt: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestBody = JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.filter(m => m.role !== 'system'),
        ],
        max_tokens: this.options.maxTokens,
        temperature: this.options.temperature,
        stream: false,
      });

      const options = {
        hostname: 'api.minimax.chat',
        port: 443,
        path: '/v1/chat/completions',
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
            const response = JSON.parse(data);

            if (res.statusCode !== 200) {
              this.handleAPIError(res.statusCode || 500, response);
              return;
            }

            resolve(response);
          } catch (parseError) {
            reject(new MiniMaxServiceError(`Failed to parse API response: ${parseError}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new MiniMaxServiceError(`API request failed: ${error.message}`));
      });

      req.write(requestBody);
      req.end();
    });
  }

  /**
   * Handle API errors
   */
  private handleAPIError(statusCode: number, errorData: any): never {
    if (statusCode === 429) {
      throw new MiniMaxRateLimitError();
    }

    if (statusCode === 400) {
      const message = errorData.error?.message || 'Content was filtered';
      throw new MiniMaxContentFilterError(message);
    }

    throw new MiniMaxServiceError(
      errorData.error?.message || `API error: ${statusCode}`,
      errorData.error?.code
    );
  }

  /**
   * Extract response text from API response
   */
  private extractResponseText(response: any): string {
    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message.content;
    }
    return 'No response from MiniMax';
  }

  /**
   * Get or create conversation for a chat
   */
  private getConversation(chatId: string): MiniMaxConversation {
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
   * Get conversation stats
   */
  getStats(): {
    totalConversations: number;
    totalMessages: number;
  } {
    const all = Array.from(this.conversations.values());
    return {
      totalConversations: all.length,
      totalMessages: all.reduce((sum, c) => sum + c.messages.length, 0),
    };
  }

  /**
   * Cleanup old conversations (older than 1 hour)
   */
  cleanupOldConversations(): void {
    const oneHour = 60 * 60 * 1000;
    const now = Date.now();

    for (const [chatId, conversation] of this.conversations.entries()) {
      if (now - conversation.lastAccessAt > oneHour) {
        this.conversations.delete(chatId);
      }
    }
  }

  /**
   * Destroy service and cleanup
   */
  destroy(): void {
    this.conversations.clear();
  }
}
