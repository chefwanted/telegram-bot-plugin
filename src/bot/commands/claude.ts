/**
 * Claude Commands
 * Commando's voor interactie met Claude via Telegram
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import type { ClaudeBridge } from '../../bridge/claude';

// =============================================================================
// Claude Start Command
// =============================================================================

export async function claudeStartCommand(
  api: ApiMethods,
  message: Message
): Promise<void> {
  const chatId = message.chat.id;

  const welcomeMessage = `
🤖 *Claude Bridge Actief*

Je bent nu verbonden met Claude! Stuur gewoon een bericht en ik zal het doorsturen.

*Commando's:*
/claude-status - Bekijk bridge status
/claude-clear - Maak berichten queue leeg

*Wat kan ik doen?*
• Vragen beantwoorden
• Code schrijven/analyseren
• Problemen oplossen
• En meer!

Stuur je bericht! 🚀
`.trim();

  await api.sendText(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
  });
}

// =============================================================================
// Claude Status Command
// =============================================================================

export async function claudeStatusCommand(
  api: ApiMethods,
  message: Message,
  bridge: ClaudeBridge
): Promise<void> {
  const chatId = message.chat.id;
  const stats = bridge.getStats();

  const statusMessage = `
📊 *Bridge Status*

*Session ID:* \`${stats.session.id.substring(0, 8)}...\`
*Actief:* ${stats.session.active ? '✅ Ja' : '❌ Nee'}
*Berichten:* ${stats.session.messageCount}
*In wachtrij:* ${stats.pending}
*Laatste activiteit:* ${new Date(stats.session.lastActivity).toLocaleString('nl-NL')}
`.trim();

  await api.sendText(chatId, statusMessage, {
    parse_mode: 'Markdown',
  });
}

// =============================================================================
// Claude Clear Command
// =============================================================================

export async function claudeClearCommand(
  api: ApiMethods,
  message: Message,
  bridge: ClaudeBridge
): Promise<void> {
  const chatId = message.chat.id;

  bridge.clearQueue();

  await api.sendText(chatId, '🗑️ Queue geleegd.');
}

// =============================================================================
// Claude Help Command
// =============================================================================

export async function claudeHelpCommand(
  api: ApiMethods,
  message: Message
): Promise<void> {
  const chatId = message.chat.id;

  const helpMessage = `
🤖 *Claude Bridge Help*

*Beschikbare commando's:*

/start - Start de bridge
/claude-status - Bekijk status
/claude-clear - Maak queue leeg
/help - Toon dit bericht

*Hoe werkt het?*
1. Stuur een bericht
2. Ik stuur het door naar Claude
3. Claude antwoordt
4. Je ontvangt het antwoord!

*Tips:*
• Stel duidelijke vragen
• Voor code: gebruik \`\`\` code blokken
• Lange antwoorden kunnen in delen komen
`.trim();

  await api.sendText(chatId, helpMessage, {
    parse_mode: 'Markdown',
  });
}
