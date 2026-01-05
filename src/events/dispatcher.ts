/**
 * Event Dispatcher
 * Dispatcht events naar OpenCode agents en verwerkt responses
 */

import type { OpenCodeEvent, OpenCodeMessage } from '../types/plugin';
import { createLogger, type Logger } from '../utils/logger';

// =============================================================================
// Event Handler Type
// =============================================================================

export type EventHandler = (event: OpenCodeEvent) => Promise<void> | void;

// =============================================================================
// Event Dispatcher
// =============================================================================

export class EventDispatcher {
  private handlers: Map<string, EventHandler[]> = new Map();
  private logger: Logger;

  constructor() {
    this.logger = createLogger({ prefix: 'EventDispatcher' });
  }

  /**
   * Registreer event handler
   */
  on(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    this.handlers.get(eventType)!.push(handler);
    this.logger.debug('Handler registered', { eventType });
  }

  /**
   * Registreer one-time event handler
   */
  once(eventType: string, handler: EventHandler): void {
    const wrappedHandler: EventHandler = async (event) => {
      await handler(event);
      this.off(eventType, wrappedHandler);
    };

    this.on(eventType, wrappedHandler);
  }

  /**
   * Verwijder event handler
   */
  off(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);

    if (handlers) {
      const index = handlers.indexOf(handler);

      if (index > -1) {
        handlers.splice(index, 1);
        this.logger.debug('Handler removed', { eventType });
      }
    }
  }

  /**
   * Dispatch event
   */
  async dispatch(event: OpenCodeEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);

    if (!handlers || handlers.length === 0) {
      this.logger.debug('No handlers for event', { type: event.type });
      return;
    }

    this.logger.debug('Dispatching event', {
      type: event.type,
      handlerCount: handlers.length,
    });

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error('Handler error', { type: event.type, error });
      }
    }
  }

  /**
   * Remove all handlers for event type
   */
  removeAll(eventType: string): void {
    this.handlers.delete(eventType);
  }

  /**
   * Remove all handlers
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Get registered event types
   */
  getEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get handler count for event type
   */
  getHandlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.length || 0;
  }
}

// =============================================================================
// Default Events
// =============================================================================

export const DefaultEvents = {
  // Bot events
  BOT_STARTED: 'bot.started',
  BOT_STOPPED: 'bot.stopped',
  BOT_ERROR: 'bot.error',

  // Message events
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_SENT: 'message.sent',

  // Agent events
  AGENT_CALLED: 'agent.called',
  AGENT_RESPONSE: 'agent.response',

  // Session events
  SESSION_CREATED: 'session.created',
  SESSION_UPDATED: 'session.updated',
  SESSION_DELETED: 'session.deleted',

  // Command events
  COMMAND_RECEIVED: 'command.received',
  COMMAND_EXECUTED: 'command.executed',
} as const;

// =============================================================================
// Factory Function
// =============================================================================

export function createEventDispatcher(): EventDispatcher {
  return new EventDispatcher();
}
