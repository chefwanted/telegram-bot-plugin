/**
 * Start Command
 * Welkomstbericht en bot introductie
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';

// =============================================================================
// Start Command
// =============================================================================

export async function startCommand(
  api: ApiMethods,
  message: Message
): Promise<void> {
  const chatId = message.chat.id;
  const userName = message.from?.first_name || 'gebruiker';

  const welcomeMessage = `
👋 *Welkom ${userName}!*

Ik ben een Telegram bot voor OpenCode. Ik kan je helpen met:

• Berichten doorsturen naar OpenCode agents
• Interactieve workflows uitvoeren
• Commando's uitvoeren

Gebruik /help om alle beschikbare commando's te zien.

*Veel plezier!* 🚀
`.trim();

  await api.sendText(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
  });
}
