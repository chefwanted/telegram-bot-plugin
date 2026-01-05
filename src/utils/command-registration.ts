/**
 * Command Registration Helpers
 * Simplified utilities for registering bot commands
 */

import type { Message, InlineKeyboardMarkup } from '../types/telegram';
import type { ApiMethods } from '../api';
import type { CommandHandler, CommandFn } from '../bot/handlers/command';
import { createLogger } from './logger';

const logger = createLogger({ prefix: 'CommandHelpers' });

// =============================================================================
// Subcommand Types
// =============================================================================

export interface Subcommand {
  name: string;
  description: string;
  handler: (api: ApiMethods, message: Message, args: string[]) => Promise<void>;
}

export interface SubcommandGroup {
  name: string;
  description: string;
  subcommands: Subcommand[];
}

// =============================================================================
// Subcommand Handler
// =============================================================================

/**
 * Create a subcommand handler with consistent help message
 */
export async function handleSubcommand(
  api: ApiMethods,
  message: Message,
  args: string[],
  group: SubcommandGroup
): Promise<void> {
  const action = args[0];

  // Find matching subcommand
  const subcommand = group.subcommands.find(sc => sc.name === action);

  if (subcommand) {
    await subcommand.handler(api, message, args.slice(1));
    return;
  }

  // Show help message
  const helpText = formatSubcommandHelp(group);
  await api.sendMessage({
    chat_id: message.chat.id,
    text: helpText,
  });
}

/**
 * Format help text for subcommand group
 */
function formatSubcommandHelp(group: SubcommandGroup): string {
  const baseCommand = group.name.split(' ')[0]; // Get base command
  const lines = [`${group.name}:`, group.description, ''];

  for (const sc of group.subcommands) {
    lines.push(`/${baseCommand} ${sc.name} - ${sc.description}`);
  }

  return lines.join('\n');
}

/**
 * Register a command with subcommand handling
 */
export function registerSubcommandGroup(
  handler: CommandHandler,
  api: ApiMethods,
  baseCommand: string,
  group: SubcommandGroup
): void {
  handler.registerCommand(baseCommand, async (message, args) => {
    try {
      await handleSubcommand(api, message, args, group);
    } catch (error) {
      logger.error('Subcommand error', { command: baseCommand, error });
      await api.sendText(message.chat.id, 'Er is een fout opgetreden.');
    }
  });
}

// =============================================================================
// Simple Command Registration
// =============================================================================

/**
 * Register a simple command
 */
export function registerSimpleCommand(
  handler: CommandHandler,
  api: ApiMethods,
  command: string,
  fn: (api: ApiMethods, message: Message, args: string[]) => Promise<void>
): void {
  handler.registerCommand(command, async (message, args) => {
    try {
      await fn(api, message, args);
    } catch (error) {
      logger.error('Command error', { command, error });
      await api.sendText(message.chat.id, 'Er is een fout opgetreden.');
    }
  });
}

// =============================================================================
// Help Command Builder
// =============================================================================

export interface CommandHelpEntry {
  command: string;
  description: string;
}

export interface HelpCategory {
  name: string;
  emoji: string;
  commands: CommandHelpEntry[];
}

/**
 * Generate help text from categories
 */
export function generateHelpText(categories: HelpCategory[]): string {
  const lines: string[] = ['Beschikbare commando\'s:', ''];

  for (const category of categories) {
    lines.push(`${category.emoji} ${category.name}`);
    for (const cmd of category.commands) {
      lines.push(`  ${cmd.command} - ${cmd.description}`);
    }
    lines.push('');
  }

  lines.push('Gebruik /help <commando> voor meer info.');
  return lines.join('\n');
}

// =============================================================================
// Confirmation Message Helpers
// =============================================================================

/**
 * Create confirmation keyboard
 */
export function createConfirmationKeyboard(
  confirmData: string,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel'
): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: `✅ ${confirmLabel}`, callback_data: `${confirmData}:confirm` },
        { text: `❌ ${cancelLabel}`, callback_data: `${confirmData}:cancel` },
      ],
    ],
  };
}

/**
 * Send confirmation request
 */
export async function sendConfirmationRequest(
  api: ApiMethods,
  chatId: number | string,
  prompt: string,
  confirmationId: string
): Promise<void> {
  const keyboard = createConfirmationKeyboard(confirmationId);
  await api.sendWithKeyboard(chatId, prompt, keyboard);
}
