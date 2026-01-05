/**
 * Main Bot Class
 * Telegram bot implementation met polling en handlers
 */

import { Bot, type ApiClientOptions, type PollingOptions as GrammyPollingOptions } from 'grammy';
import type { Message } from '../types/telegram';
import type { ApiOptions, PluginOptions, PluginState } from '../types/plugin';
import { ApiMethods } from '../api/methods';
import { createSessionManager, type SessionManager } from '../session';
import { createLogger } from '../utils/logger';
import type { MessageHandler } from './handlers/message';
import type { CommandHandler } from './handlers/command';
import type { CallbackHandler } from './handlers/callback';
import type { ZAIService } from '../zai';
import { routeInlineQuery, type InlineContext } from '../features/inline';
import { handleFileUpload } from '../features/files';
import { validateIncomingText } from '../utils/input-validation';
import { getRateLimitConfig, RateLimiter } from '../utils/rate-limit';

// =============================================================================
// Bot Options
// =============================================================================

export interface BotOptions {
  /** Bot token */
  token: string;
  /** Plugin options */
  options?: PluginOptions;
  /** Z.ai service for AI responses */
  zaiService?: ZAIService;
}

// =============================================================================
// Bot State
// =============================================================================

interface BotStateInternal {
  isRunning: boolean;
  isPolling: boolean;
  stats: {
    totalUpdates: number;
    totalMessages: number;
    totalCommands: number;
    totalErrors: number;
  };
}

// =============================================================================
// Main Bot Class
// =============================================================================

export class TelegramBot {
  private bot: Bot;
  private api: ApiMethods;
  private sessionManager: SessionManager;
  private zaiService?: ZAIService;
  private pluginOptions?: PluginOptions;
  private logger = createLogger({ prefix: 'Bot' });

  private state: BotStateInternal = {
    isRunning: false,
    isPolling: false,
    stats: {
      totalUpdates: 0,
      totalMessages: 0,
      totalCommands: 0,
      totalErrors: 0,
    },
  };

  private startedAt?: Date;
  private lastUpdateAt?: Date;
  private messageHandler?: MessageHandler;
  private commandHandler?: CommandHandler;
  private callbackHandler?: CallbackHandler;
  private rateLimiter = new RateLimiter();
  private rateLimitConfig = getRateLimitConfig();

  constructor(options: BotOptions) {
    const apiOptions = this.buildApiClientOptions(options.options?.api);
    this.bot = new Bot(options.token, apiOptions ? { client: apiOptions } : undefined);
    this.api = new ApiMethods(this.bot.api, {
      token: options.token,
      apiRoot: options.options?.api?.baseUrl,
    });

    this.sessionManager = createSessionManager(
      options.options?.session
    );

    // Store Z.ai service
    this.zaiService = options.zaiService;

    // Store plugin options
    this.pluginOptions = options.options;

    // Configure API retry behavior if requested
    this.configureApiRetries(options.options?.api);

    // Register grammY handlers
    this.registerBotHandlers();

    this.logger.info('Bot initialized');
  }

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================

  /**
   * Start de bot
   */
  async start(): Promise<void> {
    if (this.state.isRunning) {
      this.logger.warn('Bot is already running');
      return;
    }

    this.state.isRunning = true;
    this.startedAt = new Date();

    try {
      // Verify bot token
      const me = await this.api.getMe();
      this.logger.info(`Started bot: @${me.username}`);

      // Setup bot commands (for / menu in Telegram)
      await this.setupCommands();

      // Start polling unless webhook is configured or auto-start disabled
      if (!this.options?.webhook && this.options?.polling?.autoStart !== false) {
        await this.startPolling();
      }
    } catch (error) {
      this.state.isRunning = false;
      this.state.isPolling = false;
      this.logger.error('Failed to start bot', { error });
      throw error;
    }
  }

  /**
   * Stop de bot
   */
  async stop(): Promise<void> {
    if (!this.state.isRunning) {
      return;
    }

    this.state.isRunning = false;
    this.startedAt = undefined;

    // Stop polling
    if (this.state.isPolling) {
      await this.stopPolling();
    }

    // Cleanup Z.ai service
    if (this.zaiService) {
      this.zaiService.destroy();
    }

    // Cleanup session manager
    this.sessionManager.destroy();

    this.logger.info('Bot stopped');
  }

  // ==========================================================================
  // Polling
  // ==========================================================================

  /**
   * Start polling voor updates
   */
  private async startPolling(): Promise<void> {
    if (this.state.isPolling) {
      return;
    }

    this.state.isPolling = true;
    this.logger.debug('Started polling');

    const pollingOptions = this.buildPollingOptions();
    try {
      await this.bot.start(pollingOptions);
    } catch (error) {
      this.state.isPolling = false;
      throw error;
    }
  }

  /**
   * Stop polling
   */
  private async stopPolling(): Promise<void> {
    if (!this.state.isPolling) {
      return;
    }

    this.state.isPolling = false;
    await this.bot.stop();
    this.logger.debug('Stopped polling');
  }

  // ==========================================================================
  // Update Processing
  // ==========================================================================

  /**
   * Verwerk bericht
   */
  private async processMessage(message: Message): Promise<void> {
    this.state.stats.totalMessages++;

    const chatId = message.chat.id;
    const userId = message.from?.id ?? 0;
    const isUpload = !!(message.document || message.photo);
    const isCommand = !!message.text?.startsWith('/');
    const bucketKind = isUpload ? 'upload' : isCommand ? 'command' : 'message';

    const limits =
      bucketKind === 'upload'
        ? this.rateLimitConfig.uploads
        : bucketKind === 'command'
          ? this.rateLimitConfig.commands
          : this.rateLimitConfig.messages;

    const decision = this.rateLimiter.check(`${chatId}:${userId}:${bucketKind}`, limits.limit, limits.windowMs);
    if (!decision.allowed) {
      // Avoid spamming on normal chatter; notify for commands/uploads only.
      if (bucketKind !== 'message') {
        const retrySec = Math.max(1, Math.ceil((decision.retryAfterMs || 0) / 1000));
        await this.api.sendText(chatId, `⚠️ Rate limit bereikt. Probeer het over ${retrySec}s opnieuw.`);
      }
      return;
    }

    // Opportunistic cleanup to prevent unbounded growth.
    if (Math.random() < 0.01) {
      this.rateLimiter.sweep();
    }

    if (message.text) {
      const validated = validateIncomingText(message.text);
      if (!validated.ok) {
        await this.api.sendText(
          chatId,
          `❌ Ongeldig bericht: ${validated.reason || 'onbekende reden'}`
        );
        return;
      }

      if (validated.value !== message.text) {
        message = { ...message, text: validated.value };
      }
    }

    if (message.document || message.photo) {
      await handleFileUpload(this.api, message);
      return;
    }

    // Check if command
    if (message.text?.startsWith('/')) {
      this.state.stats.totalCommands++;

      if (this.commandHandler) {
        await this.commandHandler.handle(message);
      }
    } else if (this.messageHandler) {
      // Let the message handler handle non-command messages
      // (Claude Code CLI integration is in the handler now)
      await this.messageHandler.handle(message);
    }
  }

  /**
   * Verwerk callback query
   */
  private async processCallbackQuery(callbackQuery: import('../types/telegram').CallbackQuery): Promise<void> {
    if (this.callbackHandler) {
      await this.callbackHandler.handle(callbackQuery);
    }
  }

  /**
   * Verwerk inline query
   */
  private async processInlineQuery(inlineQuery: import('../types/telegram').InlineQuery): Promise<void> {
    try {
      const context: InlineContext = {
        query: inlineQuery.query || '',
        userId: inlineQuery.from.id,
      };

      const results = await routeInlineQuery(context);

      await this.api.answerInlineQuery({
        inline_query_id: inlineQuery.id,
        results,
        cache_time: 300,
        is_personal: false,
      });

      this.logger.debug(`Inline query processed: ${context.query}`);
    } catch (error) {
      this.logger.error('Inline query error', { error, query: inlineQuery.query });

      // Send empty results on error
      await this.api.answerInlineQuery({
        inline_query_id: inlineQuery.id,
        results: [],
        cache_time: 60,
      });
    }
  }

  /**
   * Verwerk bericht met Z.ai
   */
  private async processWithZAI(message: Message): Promise<void> {
    if (!message.text || !message.chat) {
      return;
    }

    try {
      const response = await this.zaiService!.processMessage(
        String(message.chat.id),
        message.text
      );

      // Send response to Telegram
      await this.api.sendMessage({ chat_id: message.chat.id, text: response.text });
    } catch (error) {
      this.logger.error('Z.ai processing error', { error, message });

      // Send error message to user
      const errorMessage = this.formatErrorMessage(error);
      try {
        await this.api.sendMessage({ chat_id: message.chat.id, text: errorMessage });
      } catch {
        // Ignore send errors
      }
    }
  }

  /**
   * Format error message for user
   */
  private formatErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      const err = error as { message?: string; code?: string };
      if (err.code === 'RATE_LIMIT') {
        return '⚠️ Rate limit bereikt. Probeer het later opnieuw.';
      }
      if (err.code === 'CONTENT_FILTER') {
        return '⚠️ Bericht geweigerd door content filter.';
      }
      return `❌ Fout: ${err.message || 'Onbekende fout'}`;
    }
    return '❌ Er is een fout opgetreden.';
  }

  /**
   * Setup bot commands (for / menu in Telegram)
    */
  private async setupCommands(): Promise<void> {
    try {
      await this.api.setupCommands([
        // Core
        { command: 'start', description: '🚀 Start de bot' },
        { command: 'help', description: '❓ Help & commands' },
        { command: 'status', description: '⚙️ Bot status' },
        { command: 'version', description: '📦 Versie info' },

        // Claude Code AI
        { command: 'claude', description: '🤖 Claude Code Chat' },
        { command: 'claude_status', description: '📊 Session status' },
        { command: 'claude_clear', description: '🗑️ Nieuwe sessie' },
        { command: 'claudecli', description: '⚡ Claude CLI direct' },
        { command: 'omo', description: '🔧 OpenCode CLI direct' },

        // Developer Tools
        { command: 'dev', description: '🛠️ Developer help' },
        { command: 'project', description: '📂 Project info' },
        { command: 'files', description: '📄 Bestanden bekijken' },
        { command: 'tree', description: '🌳 Directory structuur' },
        { command: 'read', description: '👁️ Bestand lezen' },
        { command: 'focus', description: '📎 AI context focus' },
        { command: 'code', description: '💻 Code aanpassen' },
        { command: 'patch', description: '📝 Patch toepassen' },
        { command: 'write', description: '✏️ Bestand schrijven' },
        { command: 'git', description: '📦 Git status & commits' },

        // Productivity
        { command: 'note', description: '📝 Notities' },
        { command: 'remind', description: '⏰ Herinneringen' },
        { command: 'tr', description: '🌐 Vertaal tekst' },
        { command: 'search', description: '🔍 Zoeken' },

        // Other
        { command: 'link', description: '🔗 Link shortener' },
        { command: 'stats', description: '📊 Bot statistieken' },
        { command: 'file', description: '📎 Bestanden upload' },
        { command: 'folder', description: '📁 Folders' },
        { command: 'skills', description: '🎯 Skills XP' },
        { command: 'leaderboard', description: '🏆 Leaderboard' },
        { command: 'tool', description: '🔧 Custom tools' },
        { command: 'logs', description: '📋 Bot logs bekijken' },
        { command: 'llm', description: '🧠 LLM provider wisselen' },
        
        // Admin (only visible in command hints)
        { command: 'admin', description: '🔐 Admin commands' },
      ], 'all_private_chats');
      this.logger.info('Bot commands registered');
    } catch (error) {
      this.logger.warn('Failed to register bot commands', { error });
      // Don't fail the bot start if commands setup fails
    }
  }

  // ==========================================================================
  // Internal Setup
  // ==========================================================================

  private registerBotHandlers(): void {
    this.bot.use(async (ctx, next) => {
      this.state.stats.totalUpdates++;
      this.lastUpdateAt = new Date();
      await next();
    });

    this.bot.on('message', async (ctx) => {
      if (ctx.message) {
        await this.processMessage(ctx.message);
      }
    });

    this.bot.on('edited_message', async (ctx) => {
      if (ctx.editedMessage) {
        await this.processMessage(ctx.editedMessage);
      }
    });

    this.bot.on('callback_query', async (ctx) => {
      if (ctx.callbackQuery) {
        await this.processCallbackQuery(ctx.callbackQuery);
      }
    });

    this.bot.on('inline_query', async (ctx) => {
      if (ctx.inlineQuery) {
        await this.processInlineQuery(ctx.inlineQuery);
      }
    });

    this.bot.catch((err) => {
      this.state.stats.totalErrors++;
      this.logger.error('Bot error', { error: err.error, update: err.ctx?.update });

      if (this.options?.polling?.stopOnError !== false && this.state.isPolling) {
        void this.stopPolling();
      }
    });
  }

  private buildApiClientOptions(options?: ApiOptions): ApiClientOptions {
    const timeoutMs = options?.timeout ?? 30000;

    return {
      apiRoot: options?.baseUrl || 'https://api.telegram.org',
      timeoutSeconds: Math.max(1, Math.ceil(timeoutMs / 1000)),
    };
  }

  private configureApiRetries(options?: ApiOptions): void {
    const maxRetries = options?.maxRetries ?? 3;
    const retryDelay = options?.retryDelay ?? 1000;

    if (maxRetries <= 0) {
      return;
    }

    this.bot.api.config.use(async (prev, method, payload, signal) => {
      let lastError: unknown;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await prev(method, payload, signal);
        } catch (error) {
          lastError = error;
          if (attempt === maxRetries) {
            throw error;
          }

          await this.delay(retryDelay * (attempt + 1));
        }
      }

      throw lastError;
    });
  }

  private buildPollingOptions(): GrammyPollingOptions {
    const polling = this.options?.polling;
    const options: GrammyPollingOptions = {};

    if (polling?.timeout) {
      options.timeout = Math.max(1, Math.ceil(polling.timeout / 1000));
    }

    return options;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==========================================================================
  // Handler Registration
  // ==========================================================================

  /**
   * Registreer message handler
   */
  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Registreer command handler
   */
  setCommandHandler(handler: CommandHandler): void {
    this.commandHandler = handler;
  }

  /**
   * Registreer callback handler
   */
  setCallbackHandler(handler: CallbackHandler): void {
    this.callbackHandler = handler;
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  get apiMethods(): ApiMethods {
    return this.api;
  }

  get sessions(): SessionManager {
    return this.sessionManager;
  }

  get zaiServiceInstance(): ZAIService | undefined {
    return this.zaiService;
  }

  get isRunning(): boolean {
    return this.state.isRunning;
  }

  get isPolling(): boolean {
    return this.state.isPolling;
  }

  get stats(): BotStateInternal['stats'] {
    return { ...this.state.stats };
  }

  async getState(): Promise<PluginState> {
    const sessionCount = await this.sessionManager.count();
    const apiCalls = this.api.getCallCount();

    return {
      isStarted: this.state.isRunning,
      isPolling: this.state.isPolling,
      sessionCount,
      startedAt: this.startedAt,
      lastUpdateAt: this.lastUpdateAt,
      stats: {
        totalUpdates: this.state.stats.totalUpdates,
        totalMessages: this.state.stats.totalMessages,
        totalCommands: this.state.stats.totalCommands,
        totalApiCalls: apiCalls,
        totalErrors: this.state.stats.totalErrors,
        lastResetAt: new Date(),
      },
    };
  }

  // Private getter for options
  private get options(): PluginOptions | undefined {
    return this.pluginOptions;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createBot(options: BotOptions): TelegramBot {
  return new TelegramBot(options);
}
