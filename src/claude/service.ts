/**
 * Claude Service - Direct Anthropic API Integration
 * Core service for processing messages through Claude AI
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  ClaudeServiceOptions,
  Conversation,
  ConversationMessage,
  ClaudeResponse,
  ClaudeServiceError,
  ClaudeRateLimitError,
  ClaudeContentFilterError,
} from './types';
import { ConversationStore } from './store';
import { DEFAULT_SYSTEM_PROMPT } from './prompts';
import { createLogger } from '../utils/logger';

const logger = createLogger({ prefix: 'ClaudeService' });

// Types for Anthropic API (defined locally to avoid import issues)
type MessageParam = {
  role: 'user' | 'assistant';
  content: string;
};

export class ClaudeService {
  private readonly anthropic: Anthropic;
  private readonly options: Required<ClaudeServiceOptions>;
  private readonly store: ConversationStore;

  constructor(options: ClaudeServiceOptions) {
    // Validate API key
    if (!options.apiKey) {
      throw new ClaudeServiceError('API key is required');
    }

    // Merge with defaults
    this.options = {
      apiKey: options.apiKey,
      model: options.model || 'claude-3-5-sonnet-20241022',
      maxTokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
      maxHistoryMessages: options.maxHistoryMessages || 50,
      systemPrompt: options.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    };

    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: this.options.apiKey,
      dangerouslyAllowBrowser: false, // Server-side only
    });

    // Initialize conversation store
    this.store = new ConversationStore({
      ttl: 86400, // 24 hours
      cleanupInterval: 3600, // 1 hour
    });
  }

  /**
   * Process a message from Telegram
   * @param chatId Telegram chat ID
   * @param userMessage Message text from user
   * @returns Claude's response
   */
  async processMessage(chatId: string, userMessage: string): Promise<ClaudeResponse> {
    // Get or create conversation
    let conversation = this.store.get(chatId);
    if (!conversation) {
      conversation = this.store.create(chatId);
    }

    // Add user message to conversation
    this.store.addMessage(conversation, 'user', userMessage);

    // Trim history if needed
    this.trimHistory(conversation);

    try {
      // Call Anthropic API
      const response = await this.callAnthropic(conversation);

      // Add assistant response to conversation
      this.store.addMessage(conversation, 'assistant', response.text);

      // Save updated conversation
      this.store.save(chatId, conversation);

      return response;
    } catch (error) {
      // Handle API errors
      throw this.handleApiError(error);
    }
  }

  /**
   * Clear conversation history for a chat
   */
  clearConversation(chatId: string): void {
    const conversation = this.store.get(chatId);
    if (conversation) {
      this.store.clearMessages(conversation);
      this.store.save(chatId, conversation);
    }
  }

  /**
   * Delete conversation for a chat
   */
  deleteConversation(chatId: string): void {
    this.store.delete(chatId);
  }

  /**
   * Get conversation info
   */
  getConversationInfo(chatId: string): { messageCount: number; lastActivity: Date } | null {
    const conversation = this.store.get(chatId);
    if (!conversation) {
      return null;
    }
    return {
      messageCount: conversation.messageCount,
      lastActivity: new Date(conversation.lastActivity),
    };
  }

  /**
   * Get stats for all conversations
   */
  getStats(): { totalConversations: number; totalMessages: number } {
    const conversations = this.store.getAll();
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messageCount, 0);
    return {
      totalConversations: conversations.length,
      totalMessages,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.store.destroy();
  }

  /**
   * Call Anthropic Messages API
   */
  private async callAnthropic(conversation: Conversation): Promise<ClaudeResponse> {
    const messages = this.formatMessages(conversation.messages);

    const startTime = Date.now();
    const response = await this.anthropic.messages.create({
      model: this.options.model,
      max_tokens: this.options.maxTokens,
      temperature: this.options.temperature,
      system: this.options.systemPrompt,
      messages,
    });
    const duration = Date.now() - startTime;

    // Extract response text
    const text = this.extractResponseText(response);

    logger.debug('API call completed', { duration: `${duration}ms`, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens });

    return {
      text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  /**
   * Format conversation messages for Anthropic API
   */
  private formatMessages(messages: ConversationMessage[]): MessageParam[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Extract text from Anthropic response
   */
  private extractResponseText(response: {
    content?: Array<{ type?: string; text?: string }>;
  }): string {
    const content = response.content?.[0];

    if (content?.type === 'text' && content.text) {
      return content.text;
    }

    // Handle tool use or other content types
    return 'I received a response I cannot process in this context.';
  }

  /**
   * Trim conversation history if it exceeds max messages
   */
  private trimHistory(conversation: Conversation): void {
    const maxMessages = this.options.maxHistoryMessages;

    if (conversation.messages.length > maxMessages) {
      // Keep the first message (context) and last N messages
      const keepFirst = 1;
      const keepLast = maxMessages - keepFirst;

      conversation.messages = [
        conversation.messages[0],
        ...conversation.messages.slice(-keepLast),
      ];
    }
  }

  /**
   * Handle API errors and convert to appropriate error types
   */
  private handleApiError(error: unknown): ClaudeServiceError {
    if (error instanceof Anthropic.APIError) {
      const status = error.status;

      if (status === 429) {
        // Rate limit error
        const retryAfter = error.headers?.['retry-after'];
        return new ClaudeRateLimitError(
          'Rate limit exceeded. Please try again later.',
          retryAfter ? parseInt(retryAfter, 10) : undefined
        );
      }

      if (status === 400) {
        // Content filter or validation error
        return new ClaudeContentFilterError(
          error.message || 'Your message was rejected by content filtering.'
        );
      }

      // Other API errors
      return new ClaudeServiceError(
        `API error (${status}): ${error.message}`,
        error.error?.type
      );
    }

    if (error instanceof Error) {
      return new ClaudeServiceError(error.message);
    }

    return new ClaudeServiceError('Unknown error occurred');
  }
}
