/**
 * Events Module Barrel Export
 * Exporteert alle event functionaliteit
 */

// Dispatcher
export { EventDispatcher, createEventDispatcher, DefaultEvents } from './dispatcher';

// Handlers
export {
  TelegramMessageHandler,
  createAgentResponseHandler,
  createBotErrorHandler,
  registerDefaultHandlers,
} from './handlers';
export type { MessageHandlerOptions } from './handlers';
