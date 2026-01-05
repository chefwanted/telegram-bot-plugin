/**
 * Telegram Bot Plugin - Main Entry Point
 * OpenCode plugin voor Telegram bot integratie
 */

import type { PluginConfig, PluginState, OpenCodeEvent } from './types/plugin';
import { validateConfig, loadConfig, mergeConfig } from './utils/config';
import { createLogger, Logger } from './utils/logger';
import { createBot, type TelegramBot } from './bot';
import { createEventDispatcher, type EventDispatcher, DefaultEvents } from './events';
import { registerDefaultHandlers } from './events';
import { createCommandHandler } from './bot/handlers/command';
import { createCallbackHandler } from './bot/handlers/callback';
import { SimpleMessageHandler } from './bot/handlers/message';
import {
  helpCommand,
  DEFAULT_COMMANDS,
  startCommand,
  statusCommand,
  registerAgentCallbacks,
} from './bot/commands';

// =============================================================================
// Plugin Interface
// =============================================================================

export interface TelegramBotPlugin {
  /** Start de plugin */
  start(): Promise<void>;

  /** Stop de plugin */
  stop(): Promise<void>;

  /** Get plugin state */
  getState(): PluginState;

  /** Get event dispatcher */
  getEventDispatcher(): EventDispatcher;

  /** Get bot instance */
  getBot(): TelegramBot;
}

// =============================================================================
// Plugin Implementation
// =============================================================================

class Plugin implements TelegramBotPlugin {
  private bot: TelegramBot;
  private eventDispatcher: EventDispatcher;
  private logger: Logger;
  private config: PluginConfig;

  constructor(config: PluginConfig) {
    this.config = config;
    this.logger = createLogger({
      prefix: 'Plugin',
      level: config.options?.logging?.level,
      format: config.options?.logging?.format,
    });

    // Create bot
    this.bot = createBot({
      token: config.botToken,
      options: config.options,
    });

    // Create event dispatcher
    this.eventDispatcher = createEventDispatcher();

    // Setup handlers
    this.setupHandlers();

    // Register event handlers
    registerDefaultHandlers(
      this.eventDispatcher,
      this.bot.apiMethods,
      { defaultChatId: undefined } // Will be set per user
    );

    this.logger.info('Plugin initialized');
  }

  async start(): Promise<void> {
    this.logger.info('Starting plugin...');

    // Emit bot started event
    await this.eventDispatcher.dispatch({
      type: DefaultEvents.BOT_STARTED,
      payload: { timestamp: new Date() },
      timestamp: new Date(),
    });

    // Start bot
    await this.bot.start();

    this.logger.info('Plugin started');
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping plugin...');

    // Emit bot stopped event
    await this.eventDispatcher.dispatch({
      type: DefaultEvents.BOT_STOPPED,
      payload: { timestamp: new Date() },
      timestamp: new Date(),
    });

    // Stop bot
    await this.bot.stop();

    // Clear event handlers
    this.eventDispatcher.clear();

    this.logger.info('Plugin stopped');
  }

  getState(): PluginState {
    return this.bot.getState();
  }

  getEventDispatcher(): EventDispatcher {
    return this.eventDispatcher;
  }

  getBot(): TelegramBot {
    return this.bot;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private setupHandlers(): void {
    const api = this.bot.apiMethods;

    // Setup command handler
    const commandHandler = createCommandHandler(api);

    // Register commands
    commandHandler.registerCommand('/help', async (message, _args) => {
      const commands = {
        ...DEFAULT_COMMANDS,
        '/agent': 'Interactie met agents',
      };
      await helpCommand(api, message, commands);
    });

    commandHandler.registerCommand('/start', async (message, _args) => {
      await startCommand(api, message);
    });

    commandHandler.registerCommand('/status', async (message, _args) => {
      await statusCommand(api, message, {
        isRunning: this.bot.isRunning,
        isPolling: this.bot.isPolling,
        ...this.bot.stats,
      });
    });

    // TODO: Register agent commands when agent system is implemented
    // commandHandler.registerCommand('/agent', async (message, args) => {
    //   await agentCommand(api, message, args);
    // });

    // Setup callback handler
    const callbackHandler = createCallbackHandler(api);

    // Register agent callbacks
    registerAgentCallbacks(callbackHandler);

    // Setup message handler (simple echo for now)
    const messageHandler = new SimpleMessageHandler(api, async (message) => {
      if (message.text && !message.text.startsWith('/')) {
        // Echo non-command messages
        await api.sendText(message.chat.id, `Echo: ${message.text}`);
      }
    });

    // Set handlers on bot
    this.bot.setCommandHandler(commandHandler);
    this.bot.setCallbackHandler(callbackHandler);
    this.bot.setMessageHandler(messageHandler);
  }
}

// =============================================================================
// Plugin Factory
// =============================================================================

/**
 * Create plugin from config
 */
export function createPlugin(config: PluginConfig): TelegramBotPlugin {
  if (!validateConfig(config)) {
    throw new Error('Invalid plugin configuration');
  }

  return new Plugin(config);
}

/**
 * Create plugin from environment variables
 */
export function createPluginFromEnv(): TelegramBotPlugin {
  const envConfig = loadConfig();

  if (!validateConfig(envConfig)) {
    throw new Error(
      'BOT_TOKEN environment variable is required. Please set TELEGRAM_BOT_TOKEN or BOT_TOKEN.'
    );
  }

  return createPlugin(envConfig as PluginConfig);
}

/**
 * Create plugin from config file
 */
export async function createPluginFromFile(
  path: string
): Promise<TelegramBotPlugin> {
  const fileConfig = await import(path);
  const mergedConfig = mergeConfig(loadConfig(), fileConfig.default || fileConfig);

  if (!validateConfig(mergedConfig)) {
    throw new Error('Invalid plugin configuration in file');
  }

  return createPlugin(mergedConfig as PluginConfig);
}

// =============================================================================
// Export for OpenCode
// =============================================================================

// Default export for OpenCode plugin system
export default {
  name: 'telegram-bot-plugin',
  version: '1.0.0',
  create: createPluginFromEnv,
};

// Named exports
export { PluginConfig, PluginState, OpenCodeEvent } from './types/plugin';
export { TelegramBotPlugin } from './index';
