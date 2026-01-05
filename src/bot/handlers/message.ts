/**
 * Message Handler Interface
 * Interface voor bericht handlers
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import { createSessionManager, type SessionManager } from '../../session';
import { telegramLogger } from '../../utils/telegram-logger';

// =============================================================================
// Message Handler Interface
// =============================================================================

export interface MessageHandler {
  /**
   * Handle message
   */
  handle(message: Message): Promise<void>;
}

// =============================================================================
// Base Message Handler
// =============================================================================

export class BaseMessageHandler implements MessageHandler {
  private sessionManager: SessionManager;

  constructor(
    protected api: ApiMethods,
    sessionManager?: SessionManager,
    protected logger = createLogger({ prefix: 'MessageHandler' })
  ) {
    this.sessionManager = sessionManager ?? createSessionManager();
  }

  async handle(message: Message): Promise<void> {
    this.logger.debug('Handling message', { messageId: message.message_id });

    // Log all incoming messages
    if (message.text) {
      telegramLogger.logMessage(message, message.text);
    }

    // Get or create session
    const session = await this.getSession(message);

    // Process message content
    if (message.text) {
      await this.handleText(message, session);
    } else {
      this.logger.debug('Non-text message not handled');
    }
  }

  /**
   * Handle text message
   */
  protected async handleText(
    message: Message,
    session: import('../../types/session').Session
  ): Promise<void> {
    // Override in subclass
    this.logger.debug('Text message', { textLength: message.text?.length || 0 });
  }

  /**
   * Get or create session for message
   */
  protected async getSession(message: Message): Promise<import('../../types/session').Session> {
    const userId = message.from?.id || 0;
    const chatId = message.chat.id;

    return this.sessionManager.getOrCreate(userId, chatId);
  }
}

// =============================================================================
// Simple Message Handler
// =============================================================================

export class SimpleMessageHandler extends BaseMessageHandler {
  private handleMessageFn: (message: Message) => Promise<void>;

  constructor(
    api: ApiMethods,
    handleMessageFn: (message: Message) => Promise<void>
  ) {
    super(api);
    this.handleMessageFn = handleMessageFn;
  }

  protected async handleText(
    message: Message,
    _session: import('../../types/session').Session
  ): Promise<void> {
    await this.handleMessageFn(message);
  }

  async handle(message: Message): Promise<void> {
    this.logger.debug('Handling message (no session)', { messageId: message.message_id });
    if (message.text) {
      telegramLogger.logMessage(message, message.text);
    }

    if (message.text) {
      await this.handleMessageFn(message);
    } else {
      this.logger.debug('Non-text message not handled');
    }
  }
}

import { createLogger } from '../../utils/logger';
