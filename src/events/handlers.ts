/**
 * Event Handlers
 * Handlers voor OpenCode events die berichten naar Telegram sturen
 */

import type { OpenCodeEvent, OpenCodeMessage } from '../types/plugin';
import type { ApiMethods } from '../api';
import { EventDispatcher } from './dispatcher';
import { createLogger } from '../utils/logger';

// =============================================================================
// Message Handler Options
// =============================================================================

export interface MessageHandlerOptions {
  /** Default chat ID for messages */
  defaultChatId?: number;
  /** Message format */
  format?: 'text' | 'markdown' | 'html';
}

// =============================================================================
// Telegram Message Handler
// =============================================================================

export class TelegramMessageHandler {
  private logger = createLogger({ prefix: 'MessageHandler' });

  constructor(
    private api: ApiMethods,
    private options: MessageHandlerOptions = {}
  ) {}

  /**
   * Handle OpenCode message and send to Telegram
   */
  async handleOpenCodeMessage(message: OpenCodeMessage): Promise<void> {
    this.logger.debug('Handling OpenCode message', { messageId: message.id });

    const chatId = this.options.defaultChatId || this.extractChatId(message);

    if (!chatId) {
      this.logger.warn('No chat ID found', { message });
      return;
    }

    await this.api.sendText(chatId, message.content, {
      parse_mode: this.formatToParseMode(this.options.format),
    });
  }

  /**
   * Extract chat ID from OpenCode message
   */
  private extractChatId(message: OpenCodeMessage): number | undefined {
    // Try to extract chat ID from message metadata
    if ('metadata' in message && typeof message.metadata === 'object') {
      const metadata = message.metadata as Record<string, unknown>;
      return typeof metadata.chatId === 'number'
        ? metadata.chatId
        : undefined;
    }

    // Try to extract from 'to' field
    const toMatch = (message.to || '').match(/(\d+)/);
    return toMatch ? parseInt(toMatch[1], 10) : undefined;
  }

  /**
   * Convert format to parse mode
   */
  private formatToParseMode(
    format?: string
  ): 'Markdown' | 'MarkdownV2' | 'HTML' | undefined {
    switch (format) {
      case 'markdown':
        return 'Markdown';
      case 'html':
        return 'HTML';
      default:
        return undefined;
    }
  }
}

// =============================================================================
// Event Handler Factory Functions
// =============================================================================

/**
 * Create handler for agent response events
 */
export function createAgentResponseHandler(
  api: ApiMethods,
  options?: MessageHandlerOptions
): (event: OpenCodeEvent) => Promise<void> {
  const messageHandler = new TelegramMessageHandler(api, options);

  return async (event: OpenCodeEvent) => {
    if (event.type === 'agent.response') {
      const message = event.payload as unknown as OpenCodeMessage;
      await messageHandler.handleOpenCodeMessage(message);
    }
  };
}

/**
 * Create handler for bot error events
 */
export function createBotErrorHandler(
  api: ApiMethods,
  options?: MessageHandlerOptions
): (event: OpenCodeEvent) => Promise<void> {
  const logger = createLogger({ prefix: 'BotErrorHandler' });

  return async (event: OpenCodeEvent) => {
    if (event.type === 'bot.error') {
      const error = event.payload.error as Error;

      if (options?.defaultChatId) {
        await api.sendText(
          options.defaultChatId,
          `❌ Bot Error: ${error.message}`
        );
      }

      logger.error('Bot error event', { error });
    }
  };
}

/**
 * Register all default event handlers
 */
export function registerDefaultHandlers(
  dispatcher: EventDispatcher,
  api: ApiMethods,
  options?: MessageHandlerOptions
): void {
  // Agent response handler
  dispatcher.on(
    'agent.response',
    createAgentResponseHandler(api, options)
  );

  // Bot error handler
  dispatcher.on(
    'bot.error',
    createBotErrorHandler(api, options)
  );
}
