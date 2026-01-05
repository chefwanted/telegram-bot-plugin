/**
 * Command Handler
 * Verwerkt bot commando's zoals /start, /help, etc.
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import { createLogger } from '../../utils/logger';
import { telegramLogger } from '../../utils/telegram-logger';

// =============================================================================
// Command Handler Interface
// =============================================================================

export interface CommandHandler {
  /**
   * Handle command message
   */
  handle(message: Message): Promise<void>;

  /**
   * Register command
   */
  registerCommand(command: string, handler: CommandFn): void;

  /**
   * Unregister command
   */
  unregisterCommand(command: string): void;
}

// =============================================================================
// Command Function Type
// =============================================================================

export type CommandFn = (
  message: Message,
  args: string[]
) => Promise<void> | void;

// =============================================================================
// Command Handler Implementation
// =============================================================================

export class BotCommandHandler implements CommandHandler {
  private commands: Map<string, CommandFn> = new Map();
  private logger = createLogger({ prefix: 'CommandHandler' });

  constructor(private api: ApiMethods) {
    // Register default commands
    this.registerDefaultCommands();
  }

  /**
   * Handle command message
   */
  async handle(message: Message): Promise<void> {
    if (!message.text) {
      return;
    }

    const { command, args } = this.parseCommand(message.text);

    // Log all commands
    telegramLogger.logCommand(message, command, args);

    this.logger.debug('Command received', { command, argsCount: args.length });

    const handler = this.commands.get(command);

    if (handler) {
      try {
        await handler(message, args);
      } catch (error) {
        this.logger.error('Command error', { command, error });

        await this.api.sendText(
          message.chat.id,
          'Er is een fout opgetreden bij het uitvoeren van dit commando.'
        );
      }
    } else {
      this.logger.debug('Unknown command', { command });

      await this.api.sendText(
        message.chat.id,
        `Onbekend commando: ${command}\nGebruik /help voor beschikbare commando's.`
      );
    }
  }

  /**
   * Register command
   */
  registerCommand(command: string, handler: CommandFn): void {
    const cleanCommand = command.startsWith('/') ? command : `/${command}`;
    this.commands.set(cleanCommand, handler);
    this.logger.debug('Command registered', { command: cleanCommand });
  }

  /**
   * Unregister command
   */
  unregisterCommand(command: string): void {
    const cleanCommand = command.startsWith('/') ? command : `/${command}`;
    this.commands.delete(cleanCommand);
    this.logger.debug('Command unregistered', { command: cleanCommand });
  }

  /**
   * Get registered commands
   */
  getCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Parse command from message text
   * Normalizes hyphens to underscores for compatibility
   */
  private parseCommand(text: string): { command: string; args: string[] } {
    const parts = text.trim().split(/\s+/);
    // Normalize: /claude-status -> /claude_status
    const command = parts[0].toLowerCase().replace(/-/g, '_');
    const args = parts.slice(1);

    return { command, args };
  }

  /**
   * Register default commands
   */
  private registerDefaultCommands(): void {
    // Help command
    this.registerCommand('/help', async (message) => {
      const commands = this.getCommands().sort().join(', ');
      await this.api.sendText(
        message.chat.id,
        `Beschikbare commando's:\n${commands}`
      );
    });

    // Start command - redirect to extended welcome (handled in index.ts)
    // This is a fallback that won't be reached since /start is registered in index.ts
    this.registerCommand('/start', async (message) => {
      const userName = message.from?.first_name || 'gebruiker';
      await this.api.sendText(
        message.chat.id,
        `Hallo ${userName}! Gebruik /help voor alle beschikbare commando's.`
      );
    });
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createCommandHandler(api: ApiMethods): CommandHandler {
  return new BotCommandHandler(api);
}
