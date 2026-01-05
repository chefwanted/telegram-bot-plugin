/**
 * Message Handler Interface
 * Interface voor bericht handlers
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';

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
  constructor(
    protected api: ApiMethods,
    protected logger = createLogger({ prefix: 'MessageHandler' })
  ) {}

  async handle(message: Message): Promise<void> {
    this.logger.debug('Handling message', { messageId: message.message_id });

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
    this.logger.debug('Text message', { text: message.text });
  }

  /**
   * Get or create session for message
   */
  protected async getSession(message: Message): Promise<import('../../types/session').Session> {
    const userId = message.from?.id || 0;
    const chatId = message.chat.id;

    // TODO: Get session manager
    throw new Error('Session manager not available');
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

  protected override async getSession(_message: Message): Promise<import('../../types/session').Session> {
    // Override to not use session
    throw new Error('Session not supported in SimpleMessageHandler');
  }
}

import { createLogger } from '../../utils/logger';
