/**
 * Main Bot Class
 * Telegram bot implementation met polling en handlers
 */

import type { Update, Message } from '../types/telegram';
import type { PluginOptions, PluginState } from '../types/plugin';
import { ApiClient } from '../api/client';
import { ApiMethods } from '../api/methods';
import { createSessionManager, type SessionManager } from '../session';
import { createLogger } from '../utils/logger';
import type { MessageHandler } from './handlers/message';
import type { CommandHandler } from './handlers/command';
import type { CallbackHandler } from './handlers/callback';
import type { ZAIService } from '../zai';

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
  lastUpdateId?: number;
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
  private client: ApiClient;
  private api: ApiMethods;
  private sessionManager: SessionManager;
  private zaiService?: ZAIService;
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

  private pollingTimer?: NodeJS.Timeout;
  private messageHandler?: MessageHandler;
  private commandHandler?: CommandHandler;
  private callbackHandler?: CallbackHandler;

  constructor(options: BotOptions) {
    this.client = new ApiClient(
      options.token,
      options.options?.api
    );

    this.api = new ApiMethods(this.client);

    this.sessionManager = createSessionManager(
      options.options?.session
    );

    // Store Z.ai service
    this.zaiService = options.zaiService;

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

    try {
      // Verify bot token
      const me = await this.api.getMe();
      this.logger.info(`Started bot: @${me.username}`);

      // Setup bot commands (for / menu in Telegram)
      await this.setupCommands();

      // Start polling
      if (!this.options?.webhook) {
        await this.startPolling();
      }
    } catch (error) {
      this.state.isRunning = false;
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

    // Stop polling
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = undefined;
    }

    this.state.isPolling = false;

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

    await this.poll();
  }

  /**
   * Poll voor updates
   */
  private async poll(): Promise<void> {
    while (this.state.isPolling && this.state.isRunning) {
      try {
        const updates = await this.getUpdates();

        if (updates.length > 0) {
          for (const update of updates) {
            await this.processUpdate(update);
          }
        }
      } catch (error) {
        this.state.stats.totalErrors++;
        this.logger.error('Polling error', { error });

        // Check if we should stop on error
        if (this.options?.polling?.stopOnError !== false) {
          break;
        }
      }

      // Wait before next poll
      if (this.state.isPolling && this.state.isRunning) {
        const interval = this.options?.polling?.interval || 300;
        this.pollingTimer = setTimeout(() => this.poll(), interval);
        break;
      }
    }
  }

  /**
   * Haal updates van Telegram
   */
  private async getUpdates(): Promise<Update[]> {
    const params: Record<string, unknown> = {};

    if (this.state.lastUpdateId) {
      params.offset = this.state.lastUpdateId + 1;
    }

    // Call returns response.data.result directly, which is Update[]
    const updates = await this.client.call<Update[]>('getUpdates', params);

    // Update last update ID
    if (updates && updates.length > 0) {
      this.state.lastUpdateId = updates[updates.length - 1].update_id;
    }

    return updates || [];
  }

  // ==========================================================================
  // Update Processing
  // ==========================================================================

  /**
   * Verwerk update
   */
  private async processUpdate(update: Update): Promise<void> {
    this.state.stats.totalUpdates++;

    try {
      // Message update
      if (update.message) {
        await this.processMessage(update.message);
      }

      // Edited message
      else if (update.edited_message) {
        await this.processMessage(update.edited_message);
      }

      // Callback query
      else if (update.callback_query) {
        await this.processCallbackQuery(update.callback_query);
      }

      // Inline query
      else if (update.inline_query) {
        this.logger.debug('Inline query not implemented');
      }
    } catch (error) {
      this.state.stats.totalErrors++;
      this.logger.error('Update processing error', { update, error });
    }
  }

  /**
   * Verwerk bericht
   */
  private async processMessage(message: Message): Promise<void> {
    this.state.stats.totalMessages++;

    // Check if command
    if (message.text?.startsWith('/')) {
      this.state.stats.totalCommands++;

      if (this.commandHandler) {
        await this.commandHandler.handle(message);
      }
    } else if (this.messageHandler) {
      await this.messageHandler.handle(message);
    }

    // Also send to Z.ai service if not a command
    if (this.zaiService && message.text && !message.text.startsWith('/')) {
      await this.processWithZAI(message);
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
        // Claude Commands
        { command: 'start', description: 'Start de bot' },
        { command: 'help', description: 'Help overzicht' },
        { command: 'claude_status', description: 'Claude status' },
        { command: 'claude_clear', description: 'Wis Claude geschiedenis' },
        // Notes
        { command: 'note', description: '📝 Notities beheren' },
        // Reminders
        { command: 'remind', description: '⏰ Herinneringen' },
        // Translation
        { command: 'tr', description: '🌐 Vertaal tekst' },
        // Links
        { command: 'link', description: '🔗 Link shortener' },
        // Analytics
        { command: 'stats', description: '📊 Bot statistieken' },
        // Search
        { command: 'search', description: '🔍 Zoeken' },
        // Games
        { command: 'trivia', description: '🎮 Trivia spel' },
        { command: 'ttt', description: '🎮 Tic Tac Toe' },
        // Files
        { command: 'file', description: '📎 Bestanden' },
        // Groups
        { command: 'group', description: '👥 Groepen' },
        // System
        { command: 'status', description: 'Bot status' },
      ], 'all_private_chats');
      this.logger.info('Bot commands registered');
    } catch (error) {
      this.logger.warn('Failed to register bot commands', { error });
      // Don't fail the bot start if commands setup fails
    }
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

  getState(): PluginState {
    return {
      isStarted: this.state.isRunning,
      isPolling: this.state.isPolling,
      sessionCount: 0, // TODO: Get from session manager
      startedAt: undefined, // TODO: Track start time
      lastUpdateAt: undefined,
      stats: {
        totalUpdates: this.state.stats.totalUpdates,
        totalMessages: this.state.stats.totalMessages,
        totalCommands: this.state.stats.totalCommands,
        totalApiCalls: 0, // TODO: Track API calls
        totalErrors: this.state.stats.totalErrors,
        lastResetAt: new Date(),
      },
    };
  }

  // Private getter for options
  private get options(): PluginOptions | undefined {
    return undefined; // TODO: Store options in constructor
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createBot(options: BotOptions): TelegramBot {
  return new TelegramBot(options);
}
