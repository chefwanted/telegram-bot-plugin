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
import {
  claudeStartCommand,
  claudeStatusCommand,
  claudeHelpCommand,
} from './bot/commands/claude';
import { ZAIService } from './zai';

// Features imports
import { ReminderService, setReminderService } from './features/reminders';
import { setClaudeService as setSearchClaudeService } from './features/search';
import { trackMessage, trackCommand, trackError } from './features/analytics';

// Notes
import {
  noteListCommand,
  noteAddCommand,
  noteGetCommand,
  noteDeleteCommand,
  noteSearchCommand,
  noteTagCommand,
} from './features/notes';

// Reminders
import {
  remindAddCommand,
  remindListCommand,
  remindDeleteCommand,
} from './features/reminders';

// Translation
import { translateCommand, translateListCommand } from './features/translate';

// Links
import {
  linkShortenCommand,
  linkListCommand,
  linkDeleteCommand,
  linkPreviewCommand,
} from './features/links';

// Analytics
import { statsCommand, statsResetCommand } from './features/analytics';

// Search
import { searchCommand } from './features/search';

// Games
import { triviaCommand, triviaAnswerCommand, tttCommand, tttMoveCommand } from './features/games';

// Files
import { fileListCommand, fileDeleteCommand } from './features/files';

// Groups
import {
  groupCreateCommand,
  groupListCommand,
  groupJoinCommand,
  groupLeaveCommand,
  groupPostCommand,
  groupReadCommand,
  groupDiscoverCommand,
} from './features/groups';

// =============================================================================
// Plugin Interface
// =============================================================================

export interface ITelegramBotPlugin {
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

class Plugin implements ITelegramBotPlugin {
  private bot: TelegramBot;
  private eventDispatcher: EventDispatcher;
  private logger: Logger;
  private config: PluginConfig;
  private zaiService?: ZAIService;
  private reminderService?: ReminderService;

  constructor(config: PluginConfig) {
    this.config = config;
    this.logger = createLogger({
      prefix: 'Plugin',
      level: config.options?.logging?.level,
      format: config.options?.logging?.format,
    });

    // Create Z.ai service if API key is available
    if (config.zaiApiKey) {
      this.zaiService = new ZAIService({
        apiKey: config.zaiApiKey,
        model: config.options?.claude?.model || 'glm-4.7',
        maxTokens: config.options?.claude?.maxTokens,
        temperature: config.options?.claude?.temperature,
      });
      this.logger.info('Z.ai service initialized');

      // Set for search feature
      setSearchClaudeService(this.zaiService as any); // Type compatibility
    }

    // Create bot
    this.bot = createBot({
      token: config.botToken,
      options: config.options,
      zaiService: this.zaiService,
    });

    // Create reminder service
    this.reminderService = new ReminderService(this.bot.apiMethods);
    setReminderService(this.reminderService);

    // Create event dispatcher
    this.eventDispatcher = createEventDispatcher();

    // Setup handlers
    this.setupHandlers();

    // Register event handlers
    registerDefaultHandlers(
      this.eventDispatcher,
      this.bot.apiMethods,
      { defaultChatId: undefined }
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

    // Start reminder service
    if (this.reminderService) {
      this.reminderService.start();
    }

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

    // Stop reminder service
    if (this.reminderService) {
      this.reminderService.stop();
    }

    // Stop bot
    await this.bot.stop();

    // Destroy Z.ai service
    if (this.zaiService) {
      this.zaiService.destroy();
    }

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

    // ==========================================================================
    // Claude Commands
    // ==========================================================================

    commandHandler.registerCommand('/start', async (message, _args) => {
      trackCommand('/start', String(message.chat.id));
      await claudeStartCommand(api, message);
    });

    commandHandler.registerCommand('/help', async (message, _args) => {
      trackCommand('/help', String(message.chat.id));
      await claudeHelpCommand(api, message);
    });

    commandHandler.registerCommand('/claude_status', async (message, _args) => {
      trackCommand('/claude-status', String(message.chat.id));
      const service = this.bot.zaiServiceInstance;
      if (service) {
        const zaiInfo = service.getConversationInfo(String(message.chat.id));
        const info = zaiInfo ? {
          messageCount: zaiInfo.messageCount,
          lastActivity: new Date(zaiInfo.lastAccessAt),
        } : null;
        await claudeStatusCommand(api, message, info);
      } else {
        await api.sendMessage({ chat_id: message.chat.id, text: '⚠️ Z.ai service is niet geconfigureerd.' });
      }
    });

    commandHandler.registerCommand('/claude_clear', async (message, _args) => {
      trackCommand('/claude-clear', String(message.chat.id));
      const service = this.bot.zaiServiceInstance;
      if (service) {
        service.clearConversation(String(message.chat.id));
        await api.sendMessage({ chat_id: message.chat.id, text: '✅ Gespreksgeschiedenis gewist.' });
      } else {
        await api.sendMessage({ chat_id: message.chat.id, text: '⚠️ Claude service is niet geconfigureerd.' });
      }
    });

    // ==========================================================================
    // Notes Commands
    // ==========================================================================

    commandHandler.registerCommand('/note', async (message, args) => {
      trackCommand('/note', String(message.chat.id));
      const action = args[0];
      if (action === 'list') {
        await noteListCommand(api, message);
      } else if (action === 'add') {
        await noteAddCommand(api, message, args.slice(1));
      } else if (action === 'get') {
        await noteGetCommand(api, message, args.slice(1));
      } else if (action === 'delete') {
        await noteDeleteCommand(api, message, args.slice(1));
      } else if (action === 'search') {
        await noteSearchCommand(api, message, args.slice(1));
      } else if (action === 'tag') {
        await noteTagCommand(api, message, args.slice(1));
      } else {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: '📝 Notities commando\'s:\n/note list - Toon alle notities\n/note add <tekst> - Voeg notitie toe\n/note get <nummer> - Lees notitie\n/note delete <nummer> - Verwijder notitie\n/note search <term> - Zoek in notities\n/note tag <nummer> <tag> - Voeg tag toe',
        });
      }
    });

    // ==========================================================================
    // Reminders Commands
    // ==========================================================================

    commandHandler.registerCommand('/remind', async (message, args) => {
      trackCommand('/remind', String(message.chat.id));
      const action = args[0];
      if (action === 'list') {
        await remindListCommand(api, message);
      } else if (action === 'add' || action === 'in' || action === 'at') {
        await remindAddCommand(api, message, args);
      } else if (action === 'delete') {
        await remindDeleteCommand(api, message, args.slice(1));
      } else {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: '⏰ Herinneringen:\n/remind in <tijd> <bericht> - Herinnering in X tijd\n/remind at <tijd> <bericht> - Herinnering op tijd\n/remind list - Toon herinneringen\n/remind delete <nummer> - Verwijder herinnering\n\nTijd formaten: 5m, 1h, 2d of 14:30',
        });
      }
    });

    // ==========================================================================
    // Translation Commands
    // ==========================================================================

    commandHandler.registerCommand('/tr', async (message, args) => {
      trackCommand('/tr', String(message.chat.id));
      await translateCommand(api, message, args);
    });

    commandHandler.registerCommand('/translate', async (message, args) => {
      trackCommand('/translate', String(message.chat.id));
      await translateCommand(api, message, args);
    });

    commandHandler.registerCommand('/tr-list', async (message, _args) => {
      trackCommand('/tr-list', String(message.chat.id));
      await translateListCommand(api, message);
    });

    // ==========================================================================
    // Links Commands
    // ==========================================================================

    commandHandler.registerCommand('/link', async (message, args) => {
      trackCommand('/link', String(message.chat.id));
      const action = args[0];
      if (action === 'shorten') {
        await linkShortenCommand(api, message, args.slice(1));
      } else if (action === 'list') {
        await linkListCommand(api, message);
      } else if (action === 'delete') {
        await linkDeleteCommand(api, message, args.slice(1));
      } else if (action === 'preview') {
        await linkPreviewCommand(api, message, args.slice(1));
      } else {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: '🔗 Links:\n/link shorten <url> - Maak korte link\n/link list - Toon links\n/link delete <code> - Verwijder link\n/link preview <url> - Link preview',
        });
      }
    });

    // ==========================================================================
    // Analytics Commands
    // ==========================================================================

    commandHandler.registerCommand('/stats', async (message, _args) => {
      trackCommand('/stats', String(message.chat.id));
      await statsCommand(api, message);
    });

    commandHandler.registerCommand('/stats-reset', async (message, _args) => {
      trackCommand('/stats-reset', String(message.chat.id));
      await statsResetCommand(api, message);
    });

    // ==========================================================================
    // Search Commands
    // ==========================================================================

    commandHandler.registerCommand('/search', async (message, args) => {
      trackCommand('/search', String(message.chat.id));
      await searchCommand(api, message, args);
    });

    // ==========================================================================
    // Games Commands
    // ==========================================================================

    commandHandler.registerCommand('/trivia', async (message, _args) => {
      trackCommand('/trivia', String(message.chat.id));
      await triviaCommand(api, message);
    });

    commandHandler.registerCommand('/trivia-answer', async (message, args) => {
      trackCommand('/trivia-answer', String(message.chat.id));
      await triviaAnswerCommand(api, message, args);
    });

    commandHandler.registerCommand('/ttt', async (message, _args) => {
      trackCommand('/ttt', String(message.chat.id));
      await tttCommand(api, message);
    });

    commandHandler.registerCommand('/ttt-move', async (message, args) => {
      trackCommand('/ttt-move', String(message.chat.id));
      await tttMoveCommand(api, message, args);
    });

    // ==========================================================================
    // Files Commands
    // ==========================================================================

    commandHandler.registerCommand('/file', async (message, args) => {
      trackCommand('/file', String(message.chat.id));
      const action = args[0];
      if (action === 'list') {
        await fileListCommand(api, message);
      } else if (action === 'delete') {
        await fileDeleteCommand(api, message, args.slice(1));
      } else {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: '📎 Bestanden:\n/file list - Toon bestanden\n/file delete <id> - Verwijder bestand\n\nStuur een bestand naar de chat om op te slaan.',
        });
      }
    });

    // ==========================================================================
    // Groups Commands
    // ==========================================================================

    commandHandler.registerCommand('/group', async (message, args) => {
      trackCommand('/group', String(message.chat.id));
      const action = args[0];
      if (action === 'create') {
        await groupCreateCommand(api, message, args.slice(1));
      } else if (action === 'list') {
        await groupListCommand(api, message);
      } else if (action === 'join') {
        await groupJoinCommand(api, message, args.slice(1));
      } else if (action === 'leave') {
        await groupLeaveCommand(api, message, args.slice(1));
      } else if (action === 'post') {
        await groupPostCommand(api, message, args.slice(1));
      } else if (action === 'read') {
        await groupReadCommand(api, message, args.slice(1));
      } else if (action === 'discover') {
        await groupDiscoverCommand(api, message);
      } else {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: '👥 Groepen:\n/group create <naam> - Maak groep\n/group list - Jouw groepen\n/group join <id> - Join groep\n/group leave <id> - Verlaat groep\n/group post <id>|<tekst>|[anon] - Plaats bericht\n/group read <id> [aantal] - Lees berichten\n/group discover - Ontdek groepen',
        });
      }
    });

    // ==========================================================================
    // System Commands
    // ==========================================================================

    commandHandler.registerCommand('/status', async (message, _args) => {
      trackCommand('/status', String(message.chat.id));
      await statusCommand(api, message, {
        isRunning: this.bot.isRunning,
        isPolling: this.bot.isPolling,
        ...this.bot.stats,
      });
    });

    // Setup callback handler
    const callbackHandler = createCallbackHandler(api);

    // Register agent callbacks
    registerAgentCallbacks(callbackHandler);

    // Setup message handler
    const messageHandler = new SimpleMessageHandler(api, async (message) => {
      trackMessage(String(message.chat.id));

      if (message.text && !message.text.startsWith('/')) {
        // Non-command messages go to Z.ai
        if (this.bot.zaiServiceInstance) {
          // Let the bot handle it (already in bot.ts)
          return;
        }
        // Fallback echo if no Claude
        await api.sendMessage({ chat_id: message.chat.id, text: `Echo: ${message.text}` });
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
export function createPlugin(config: PluginConfig): ITelegramBotPlugin {
  if (!validateConfig(config)) {
    throw new Error('Invalid plugin configuration');
  }

  return new Plugin(config);
}

/**
 * Create plugin from environment variables
 */
export function createPluginFromEnv(): ITelegramBotPlugin {
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
): Promise<ITelegramBotPlugin> {
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
  version: '2.0.0',
  create: createPluginFromEnv,
};

// Named exports
export { PluginConfig, PluginState, OpenCodeEvent } from './types/plugin';
export type { ITelegramBotPlugin as TelegramBotPlugin } from './index';
