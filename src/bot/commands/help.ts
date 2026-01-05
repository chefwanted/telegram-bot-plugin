/**
 * Help Command
 * Toont beschikbare commando's en gebruiksinstructies
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';

// =============================================================================
// Help Command
// =============================================================================

export async function helpCommand(
  api: ApiMethods,
  message: Message,
  commands: Record<string, string>
): Promise<void> {
  const chatId = message.chat.id;

  let helpText = '*Beschikbare Commando\'s*\n\n';

  for (const [command, description] of Object.entries(commands)) {
    helpText += `${command} - ${description}\n`;
  }

  helpText += '\n*Gebruik:* /command [argumenten]';

  await api.sendText(chatId, helpText, {
    parse_mode: 'Markdown',
  });
}

// =============================================================================
// Default Command Descriptions
// =============================================================================

export const DEFAULT_COMMANDS: Record<string, string> = {
  '/start': 'Start de bot',
  '/help': 'Toon dit help bericht',
  '/status': 'Toon bot status',
};
