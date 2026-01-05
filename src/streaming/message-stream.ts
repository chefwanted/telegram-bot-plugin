/**
 * Message Stream
 * Logic voor streaming berichten naar Telegram
 */

import type { ApiMethods } from '../api/methods';
import type { StreamStatus, MessageChunk, ChunkingOptions } from './types';
import { splitIntoChunks } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger({ prefix: 'MessageStream' });

// =============================================================================
// Message Streamer
// =============================================================================

export class MessageStreamer {
  private updateThrottle = new Map<string, NodeJS.Timeout>();
  private pendingUpdates = new Map<string, string>();

  constructor(private api: ApiMethods) {}

  /**
   * Stream content to Telegram via message editing
   *
   * Strategy:
   * 1. Send initial status message
   * 2. Edit message with progressive content updates
   * 3. When content is complete, send remaining chunks as new messages
   */
  async streamContent(
    chatId: number,
    contentStream: AsyncIterable<string>,
    options: {
      initialMessage?: string;
      maxLength?: number;
      parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
      onChunkSent?: (chunk: string, remaining: string, index: number) => void;
    } = {}
  ): Promise<void> {
    const { initialMessage = '⏳ Thinking...', maxLength = 4000, parseMode } = options;

    // Send initial message
    const result = await this.api.sendMessage({
      chat_id: chatId,
      text: initialMessage,
      parse_mode: parseMode,
    });

    const messageId = result.message_id;
    let accumulatedContent = '';
    let lastUpdate = Date.now();
    const UPDATE_INTERVAL = 500; // Throttle updates to every 500ms

    try {
      // Consume the stream
      for await (const chunk of contentStream) {
        accumulatedContent += chunk;

        // Throttle updates
        const now = Date.now();
        if (now - lastUpdate >= UPDATE_INTERVAL) {
          await this.updateMessage(chatId, messageId, accumulatedContent, maxLength, parseMode);
          lastUpdate = now;
        }
      }

      // Final update with complete content
      const chunks = splitIntoChunks(accumulatedContent, maxLength);

      if (chunks.length === 1) {
        // Single chunk, just edit the message
        await this.api.editMessageText({
          chat_id: chatId,
          message_id: messageId,
          text: chunks[0].content,
          parse_mode: parseMode,
        });
      } else if (chunks.length > 1) {
        // Multiple chunks: edit with first chunk, send rest as new messages
        await this.api.editMessageText({
          chat_id: chatId,
          message_id: messageId,
          text: chunks[0].content + '\n\n_...continuing..._',
          parse_mode: parseMode,
        });

        // Send remaining chunks as new messages
        for (let i = 1; i < chunks.length; i++) {
          await this.api.sendMessage({
            chat_id: chatId,
            text: chunks[i].content,
            parse_mode: parseMode,
          });

          options.onChunkSent?.(chunks[i].content, chunks.slice(i + 1).map(c => c.content).join('\n'), i);
        }
      }
    } catch (error) {
      logger.error('Error streaming content', { error, chatId });
      throw error;
    }
  }

  /**
   * Update a message with new content
   */
  async updateMessage(
    chatId: number,
    messageId: number,
    content: string,
    maxLength: number = 4000,
    parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML'
  ): Promise<void> {
    const truncated = content.length > maxLength
      ? content.substring(0, maxLength) + '\n\n_...continuing..._'
      : content;

    try {
      await this.api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: truncated,
        parse_mode: parseMode,
      });
    } catch (error) {
      // Log but don't throw - transient errors are ok
      logger.warn('Failed to update message', { error, chatId, messageId });
    }
  }

  /**
   * Send complete message (all chunks at once)
   */
  async sendComplete(
    chatId: number,
    text: string,
    options: ChunkingOptions = {}
  ): Promise<void> {
    const { maxLength = 4000, parseMode = 'Markdown', onChunkSent } = options;
    const chunks = splitIntoChunks(text, maxLength);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      if (i === 0 && chunks.length > 1) {
        // First chunk of multi-part message
        await this.api.sendMessage({
          chat_id: chatId,
          text: chunk.content + '\n\n_...continuing..._',
          parse_mode: parseMode,
        });
      } else {
        await this.api.sendMessage({
          chat_id: chatId,
          text: chunk.content,
          parse_mode: parseMode,
        });
      }

      const remaining = chunks.slice(i + 1).map(c => c.content).join('\n');
      onChunkSent?.(chunk.content, remaining, i);
    }
  }

  /**
   * Edit message with throttling
   */
  async editMessageThrottled(
    chatId: number,
    messageId: number,
    text: string,
    options: {
      maxLength?: number;
      parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
      throttleMs?: number;
    } = {}
  ): Promise<void> {
    const { maxLength = 4000, parseMode, throttleMs = 500 } = options;
    const key = `${chatId}:${messageId}`;

    // Store pending update
    this.pendingUpdates.set(key, text);

    // Clear existing timeout
    const existingTimeout = this.updateThrottle.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule update
    const timeout = setTimeout(async () => {
      const content = this.pendingUpdates.get(key);
      if (!content) return;

      await this.updateMessage(chatId, messageId, content, maxLength, parseMode);
      this.pendingUpdates.delete(key);
      this.updateThrottle.delete(key);
    }, throttleMs);

    this.updateThrottle.set(key, timeout);
  }

  /**
   * Cleanup resources for a chat
   */
  cleanup(chatId: number): void {
    // Clear all timeouts for this chat
    for (const [key, timeout] of this.updateThrottle.entries()) {
      if (key.startsWith(`${chatId}:`)) {
        clearTimeout(timeout);
        this.updateThrottle.delete(key);
        this.pendingUpdates.delete(key);
      }
    }
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    for (const timeout of this.updateThrottle.values()) {
      clearTimeout(timeout);
    }
    this.updateThrottle.clear();
    this.pendingUpdates.clear();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createMessageStreamer(api: ApiMethods): MessageStreamer {
  return new MessageStreamer(api);
}
