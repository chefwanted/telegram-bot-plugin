/**
 * Callback Handler
 * Verwerkt callback queries van inline keyboards
 */

import type { CallbackQuery } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import { createLogger } from '../../utils/logger';

// =============================================================================
// Callback Handler Interface
// =============================================================================

export interface CallbackHandler {
  /**
   * Handle callback query
   */
  handle(callbackQuery: CallbackQuery): Promise<void>;

  /**
   * Register callback handler
   */
  registerCallback(data: string, handler: CallbackFn): void;

  /**
   * Unregister callback handler
   */
  unregisterCallback(data: string): void;
}

// =============================================================================
// Callback Function Type
// =============================================================================

export type CallbackFn = (
  callbackQuery: CallbackQuery
) => Promise<void> | void;

// =============================================================================
// Callback Handler Implementation
// =============================================================================

export class BotCallbackHandler implements CallbackHandler {
  private callbacks: Map<string, CallbackFn> = new Map();
  private logger = createLogger({ prefix: 'CallbackHandler' });

  constructor(private api: ApiMethods) {}

  /**
   * Handle callback query
   */
  async handle(callbackQuery: CallbackQuery): Promise<void> {
    const data = callbackQuery.data;

    if (!data) {
      await this.answerCallback(callbackQuery, 'Geen data');
      return;
    }

    this.logger.debug('Callback received', { data });

    const handler = this.callbacks.get(data);

    if (handler) {
      try {
        await handler(callbackQuery);
      } catch (error) {
        this.logger.error('Callback error', { data, error });

        await this.answerCallback(
          callbackQuery,
          'Er is een fout opgetreden',
          true
        );
      }
    } else {
      this.logger.debug('Unknown callback', { data });

      await this.answerCallback(callbackQuery, 'Onbekende actie');
    }
  }

  /**
   * Register callback handler
   */
  registerCallback(data: string, handler: CallbackFn): void {
    this.callbacks.set(data, handler);
    this.logger.debug('Callback registered', { data });
  }

  /**
   * Unregister callback handler
   */
  unregisterCallback(data: string): void {
    this.callbacks.delete(data);
    this.logger.debug('Callback unregistered', { data });
  }

  /**
   * Answer callback query
   */
  async answerCallback(
    callbackQuery: CallbackQuery,
    text?: string,
    showAlert?: boolean
  ): Promise<void> {
    try {
      await this.api.answerCallbackQuery({
        callback_query_id: callbackQuery.id,
        text,
        show_alert: showAlert,
      });
    } catch (error) {
      this.logger.error('Failed to answer callback', { error });
    }
  }

  /**
   * Edit message after callback
   */
  async editMessage(
    callbackQuery: CallbackQuery,
    text: string,
    replyMarkup?: object
  ): Promise<void> {
    try {
      await this.api.editMessageText({
        chat_id: callbackQuery.message?.chat.id,
        message_id: callbackQuery.message?.message_id,
        text,
        reply_markup: replyMarkup,
      });
    } catch (error) {
      this.logger.error('Failed to edit message', { error });
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Parse callback data with prefix
   */
  static parseData(data: string): { prefix: string; params: string[] } {
    const parts = data.split(':');
    return {
      prefix: parts[0],
      params: parts.slice(1),
    };
  }

  /**
   * Create callback data with prefix
   */
  static createData(prefix: string, ...params: string[]): string {
    return [prefix, ...params].join(':');
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createCallbackHandler(api: ApiMethods): CallbackHandler {
  return new BotCallbackHandler(api);
}
