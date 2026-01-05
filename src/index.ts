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
import { createStreamingMessageHandler } from './bot/handlers/streaming-message';
import { getConfirmationManager } from './streaming/confirmation';
import { helpCommand, DEFAULT_COMMANDS, startCommand } from './bot/commands';
import { statusCommand } from './bot/commands/status';
import { telegramLogger, LogLevel } from './utils/telegram-logger';
import { ZAIService } from './zai';
import { MiniMaxService } from './minimax';
import { MistralService } from './mistral';
import { closeDatabase } from './database';
import { LLMRouter, type LLMProvider } from './llm';

// Claude Code CLI integration
import {
  ClaudeCodeService,
  createClaudeCodeService,
  routeClaudeCommand,
} from './claude-code';

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

// Files
import {
  fileListCommand,
  fileDeleteCommand,
  fileMoveCommand,
} from './features/files';
import {
  folderListCommand,
  folderCreateCommand,
} from './features/files';
import {
  gitInitCommand,
  gitStatusCommand,
  gitAddCommand,
  gitCommitCommand,
  gitLogCommand,
  gitPushCommand,
  gitPullCommand,
  gitCloneCommand,
  gitRemoteCommand,
  gitBranchCommand,
} from './features/files';

// Skills
import {
  skillsCommand,
  skillInfoCommand,
  leaderboardCommand,
} from './features/skills';

// Custom Tools
import { customToolCommand } from './features/custom-tools';
import { llmCommand } from './features/llm';

// CLI Commands
import { claudeCliCommand, omoCommand } from './bot/commands/cli';

// Logs Command
import { logsCommand } from './bot/commands/logs';

// Admin Command
import { adminCommand } from './bot/commands/admin';

// Version & update info
import { formatVersionMessage, formatUpdateMessage, formatChangelogMessage } from './utils/version';

// Developer Mode
import {
  projectCommand,
  filesCommand,
  treeCommand,
  readCommand,
  focusCommand,
  patchCommand,
  writeCommand,
  codeCommand,
  devHelpCommand,
} from './features/developer';

// =============================================================================
// Plugin Interface
// =============================================================================

export interface ITelegramBotPlugin {
  /** Start de plugin */
  start(): Promise<void>;

  /** Stop de plugin */
  stop(): Promise<void>;

  /** Get plugin state */
  getState(): Promise<PluginState>;

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
  private miniMaxService?: MiniMaxService;
  private mistralService?: MistralService;
  private claudeCodeService: ClaudeCodeService;
  private reminderService?: ReminderService;
  private llmRouter: LLMRouter;

  constructor(config: PluginConfig) {
    this.config = config;
    this.logger = createLogger({
      prefix: 'Plugin',
      level: config.options?.logging?.level,
      format: config.options?.logging?.format,
    });

    // Create Claude Code service (main AI for chat)
    this.claudeCodeService = createClaudeCodeService({
      workingDir: process.env.CLAUDE_WORKING_DIR || process.cwd(),
      cliBinary: process.env.CLAUDE_CLI_BINARY || 'claude',
      model: process.env.CLAUDE_MODEL,
      timeout: parseInt(process.env.CLAUDE_TIMEOUT || '300000', 10), // 5 minuten
      systemPrompt: process.env.CLAUDE_SYSTEM_PROMPT,
    });
    this.logger.info('Claude Code service initialized');

    // Create Z.ai service as fallback if API key is available
    if (config.zaiApiKey) {
      this.zaiService = new ZAIService({
        apiKey: config.zaiApiKey,
        model: process.env.ZAI_MODEL || 'glm-4.7',
        maxTokens: config.options?.claude?.maxTokens,
        temperature: config.options?.claude?.temperature,
      });
      this.logger.info('Z.ai service initialized');
    }

    // Create MiniMax service as additional fallback if API key is available
    if (config.miniMaxApiKey) {
      this.miniMaxService = new MiniMaxService({
        apiKey: config.miniMaxApiKey,
        model: process.env.MINIMAX_MODEL || 'MiniMax-v2.1',
        maxTokens: config.options?.claude?.maxTokens,
        temperature: config.options?.claude?.temperature,
      });
      this.logger.info('MiniMax service initialized (v2.1 + Lite fallback)');
    }

    // Create Mistral service as additional provider if API key is available
    if (config.mistralApiKey) {
      this.mistralService = new MistralService({
        apiKey: config.mistralApiKey,
        model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
        maxTokens: config.options?.claude?.maxTokens,
        temperature: config.options?.claude?.temperature,
      });
      this.logger.info('Mistral service initialized');
    }

    const defaultProvider = this.resolveDefaultProvider();
    this.llmRouter = new LLMRouter(
      {
        claude: this.claudeCodeService,
        zai: this.zaiService,
        minimax: this.miniMaxService,
        mistral: this.mistralService,
      },
      {
        defaultProvider,
        devModels: {
          zai: process.env.ZAI_DEV_MODEL,
          minimax: process.env.MINIMAX_DEV_MODEL,
          mistral: process.env.MISTRAL_DEV_MODEL || 'codestral-latest',
        },
      }
    );

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

    // Destroy Claude Code service
    this.claudeCodeService.destroy();

    // Destroy Z.ai service
    if (this.zaiService) {
      this.zaiService.destroy();
    }

    // Destroy MiniMax service
    if (this.miniMaxService) {
      this.miniMaxService.destroy();
    }

    // Destroy Mistral service
    if (this.mistralService) {
      this.mistralService.destroy();
    }

    // Clear event handlers
    this.eventDispatcher.clear();

    // Close database connection (if used)
    closeDatabase();

    this.logger.info('Plugin stopped');
  }

  async getState(): Promise<PluginState> {
    return await this.bot.getState();
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
    // Core Commands
    // ==========================================================================

    commandHandler.registerCommand('/start', async (message, _args) => {
      trackCommand('/start', String(message.chat.id));
      await startCommand(api, message);
    });

    commandHandler.registerCommand('/help', async (message, _args) => {
      trackCommand('/help', String(message.chat.id));
      await helpCommand(api, message);
    });

    commandHandler.registerCommand('/version', async (message, _args) => {
      trackCommand('/version', String(message.chat.id));
      await api.sendMessage({ chat_id: message.chat.id, text: formatVersionMessage() });
    });

    commandHandler.registerCommand('/update', async (message, _args) => {
      trackCommand('/update', String(message.chat.id));
      await api.sendMessage({ chat_id: message.chat.id, text: formatUpdateMessage() });
    });

    commandHandler.registerCommand('/claude_status', async (message, _args) => {
      trackCommand('/claude-status', String(message.chat.id));
      if (!this.llmRouter.isProviderActive(String(message.chat.id), 'claude-cli')) {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: '⚠️ Claude CLI staat uit. Activeer met `/llm set claude-cli`.',
          parse_mode: 'Markdown',
        });
        return;
      }
      // Use Claude Code service status
      await routeClaudeCommand(api, message, ['status'], this.claudeCodeService);
    });

    commandHandler.registerCommand('/claude_clear', async (message, _args) => {
      trackCommand('/claude-clear', String(message.chat.id));
      if (!this.llmRouter.isProviderActive(String(message.chat.id), 'claude-cli')) {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: '⚠️ Claude CLI staat uit. Activeer met `/llm set claude-cli`.',
          parse_mode: 'Markdown',
        });
        return;
      }
      // End current Claude Code session (creates new one on next message)
      await routeClaudeCommand(api, message, ['end'], this.claudeCodeService);
    });

    // /claude command - full session management
    commandHandler.registerCommand('/claude', async (message, args) => {
      trackCommand('/claude', String(message.chat.id));
      if (!this.llmRouter.isProviderActive(String(message.chat.id), 'claude-cli')) {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: '⚠️ Claude CLI staat uit. Activeer met `/llm set claude-cli`.',
          parse_mode: 'Markdown',
        });
        return;
      }
      await routeClaudeCommand(api, message, args, this.claudeCodeService);
    });

    commandHandler.registerCommand('/code', async (message, args) => {
      trackCommand('/code', String(message.chat.id));
      await codeCommand(api, message, args, this.llmRouter);
    });

    commandHandler.registerCommand('/llm', async (message, args) => {
      trackCommand('/llm', String(message.chat.id));
      await llmCommand(api, message, args, this.llmRouter);
    });

    // ==========================================================================
    // Developer Mode Commands
    // ==========================================================================

    commandHandler.registerCommand('/dev', async (message, _args) => {
      trackCommand('/dev', String(message.chat.id));
      await devHelpCommand(api, message);
    });

    commandHandler.registerCommand('/project', async (message, args) => {
      trackCommand('/project', String(message.chat.id));
      await projectCommand(api, message, args);
    });

    commandHandler.registerCommand('/files', async (message, args) => {
      trackCommand('/files', String(message.chat.id));
      await filesCommand(api, message, args);
    });

    commandHandler.registerCommand('/tree', async (message, args) => {
      trackCommand('/tree', String(message.chat.id));
      await treeCommand(api, message, args);
    });

    commandHandler.registerCommand('/read', async (message, args) => {
      trackCommand('/read', String(message.chat.id));
      await readCommand(api, message, args);
    });

    commandHandler.registerCommand('/focus', async (message, args) => {
      trackCommand('/focus', String(message.chat.id));
      await focusCommand(api, message, args);
    });

    commandHandler.registerCommand('/patch', async (message, args) => {
      trackCommand('/patch', String(message.chat.id));
      await patchCommand(api, message, args);
    });

    commandHandler.registerCommand('/write', async (message, args) => {
      trackCommand('/write', String(message.chat.id));
      await writeCommand(api, message, args);
    });

    commandHandler.registerCommand('/changelog', async (message, _args) => {
      trackCommand('/changelog', String(message.chat.id));
      await api.sendMessage({ chat_id: message.chat.id, text: formatChangelogMessage() });
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
    // Files Commands
    // ==========================================================================

    commandHandler.registerCommand('/file', async (message, args) => {
      trackCommand('/file', String(message.chat.id));
      const action = args[0];
      if (action === 'list') {
        await fileListCommand(api, message, args.slice(1));
      } else if (action === 'delete') {
        await fileDeleteCommand(api, message, args.slice(1));
      } else if (action === 'move') {
        await fileMoveCommand(api, message, args.slice(1));
      } else {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: '📎 Bestanden:\n/file list [folder] - Toon bestanden\n/file delete <id> - Verwijder bestand\n/file move <id> <folder> - Verplaats bestand\n\nStuur een bestand naar de chat om op te slaan.',
        });
      }
    });

    // ==========================================================================
    // Folder Commands
    // ==========================================================================

    commandHandler.registerCommand('/folder', async (message, args) => {
      trackCommand('/folder', String(message.chat.id));
      const action = args[0];
      if (action === 'list') {
        await folderListCommand(api, message);
      } else if (action === 'create') {
        await folderCreateCommand(api, message, args.slice(1));
      } else {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: '📁 Folders:\n/folder list - Toon folders\n/folder create <naam> - Maak folder',
        });
      }
    });

    // ==========================================================================
    // Git Commands
    // ==========================================================================

    commandHandler.registerCommand('/git', async (message, args) => {
      trackCommand('/git', String(message.chat.id));
      const action = args[0];
      if (action === 'init') {
        await gitInitCommand(api, message);
      } else if (action === 'status') {
        await gitStatusCommand(api, message);
      } else if (action === 'add') {
        await gitAddCommand(api, message, args.slice(1));
      } else if (action === 'commit') {
        await gitCommitCommand(api, message, args.slice(1));
      } else if (action === 'log') {
        await gitLogCommand(api, message, args.slice(1));
      } else if (action === 'push') {
        await gitPushCommand(api, message, args.slice(1));
      } else if (action === 'pull') {
        await gitPullCommand(api, message, args.slice(1));
      } else if (action === 'clone') {
        await gitCloneCommand(api, message, args.slice(1));
      } else if (action === 'remote') {
        await gitRemoteCommand(api, message, args.slice(1));
      } else if (action === 'branch') {
        await gitBranchCommand(api, message, args.slice(1));
      } else {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: '📦 Git versiebeheer:\n/git init - Start repository\n/git status - Toon status\n/git add [bestanden] - Voeg toe aan staging\n/git commit <bericht> - Maak commit\n/git log [aantal] - Toon geschiedenis\n/git push [remote] [branch] - Push naar remote\n/git pull [remote] [branch] - Pull van remote\n/git clone <url> - Kloon repository\n/git remote [list|add|remove] - Beheer remotes\n/git branch [list|create|delete|switch] - Beheer branches',
        });
      }
    });

    // ==========================================================================
    // Skills Commands
    // ==========================================================================

    commandHandler.registerCommand('/skills', async (message, _args) => {
      trackCommand('/skills', String(message.chat.id));
      await skillsCommand(api, message);
    });

    commandHandler.registerCommand('/skill-info', async (message, args) => {
      trackCommand('/skill-info', String(message.chat.id));
      await skillInfoCommand(api, message, args);
    });

    commandHandler.registerCommand('/leaderboard', async (message, args) => {
      trackCommand('/leaderboard', String(message.chat.id));
      await leaderboardCommand(api, message, args);
    });

    // ==========================================================================
    // Custom Tools Commands
    // ==========================================================================

    commandHandler.registerCommand('/tool', async (message, args) => {
      trackCommand('/tool', String(message.chat.id));
      await customToolCommand(api, message, args);
    });

    // ==========================================================================
    // CLI Commands (Direct shortcuts)
    // ==========================================================================

    commandHandler.registerCommand('/claude-cli', async (message, args) => {
      trackCommand('/claude-cli', String(message.chat.id));
      await claudeCliCommand(api, message, args);
    });

    commandHandler.registerCommand('/omo', async (message, args) => {
      trackCommand('/omo', String(message.chat.id));
      await omoCommand(api, message, args);
    });

    // ==========================================================================
    // Logs Command
    // ==========================================================================

    commandHandler.registerCommand('/logs', async (message, args) => {
      trackCommand('/logs', String(message.chat.id));
      await logsCommand(api, message, args);
    });

    // ==========================================================================
    // Admin Commands
    // ==========================================================================

    commandHandler.registerCommand('/admin', async (message, args) => {
      trackCommand('/admin', String(message.chat.id));
      await adminCommand(api, message, args);
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

    // Register confirmation callbacks for streaming handler
    // Confirmation IDs start with "conf_" prefix
    const confirmationManager = getConfirmationManager(api);
    callbackHandler.registerPrefixCallback('conf_', async (callbackQuery) => {
      const callbackData = callbackQuery.data;
      if (callbackData) {
        await confirmationManager.handleCallback(callbackData, callbackQuery.id);
      }
    });

    // Setup message handler - use StreamingMessageHandler for interactive responses
    const messageHandler = createStreamingMessageHandler(api, this.llmRouter);

    // Set handlers on bot
    this.bot.setCommandHandler(commandHandler);
    this.bot.setCallbackHandler(callbackHandler);
    this.bot.setMessageHandler(messageHandler);
  }

  private resolveDefaultProvider(): LLMProvider {
    const fromEnv = process.env.LLM_DEFAULT_PROVIDER;
    const envProvider = fromEnv ? this.normalizeProviderName(fromEnv) : undefined;

    if (envProvider && this.isProviderConfigured(envProvider)) {
      return envProvider;
    }

    if (this.zaiService) return 'zai';
    if (this.miniMaxService) return 'minimax';
    if (this.mistralService) return 'mistral';
    return 'claude-cli';
  }

  private normalizeProviderName(value: string): LLMProvider | undefined {
    const key = value.trim().toLowerCase();
    const aliases: Record<string, LLMProvider> = {
      'zai': 'zai',
      'glm': 'zai',
      'glm-4.7': 'zai',
      'minimax': 'minimax',
      'minimax-v2.1': 'minimax',
      'mistral': 'mistral',
      'mixtral': 'mistral',
      'claude': 'claude-cli',
      'claude-cli': 'claude-cli',
      'cli': 'claude-cli',
    };
    return aliases[key];
  }

  private isProviderConfigured(provider: LLMProvider): boolean {
    switch (provider) {
      case 'zai':
        return !!this.zaiService;
      case 'minimax':
        return !!this.miniMaxService;
      case 'mistral':
        return !!this.mistralService;
      case 'claude-cli':
        return true;
      default:
        return false;
    }
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
