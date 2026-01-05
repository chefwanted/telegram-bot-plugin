/**
 * Claude Commands
 * Commando's voor interactie met Claude via Telegram
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';

// Conversation info type for status command
export type ConversationInfo = {
  messageCount: number;
  lastActivity: Date;
} | null;

// =============================================================================
// Claude Start Command
// =============================================================================

export async function claudeStartCommand(
  api: ApiMethods,
  message: Message
): Promise<void> {
  const chatId = message.chat.id;

  const welcomeMessage = `
🤖 *Claude Telegram Bot*

Je bent nu verbonden met Claude AI! Stuur gewoon een bericht en ik zal reageren.

*Commando's:*
/claude-status - Bekijk gesprek status
/claude-clear - Maak gespreksgeschiedenis leeg
/help - Toon help bericht

*Wat kan ik doen?*
• Vragen beantwoorden
• Code schrijven/analyseren
• Problemen oplossen
• Tekst samenvatten
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
  info: ConversationInfo
): Promise<void> {
  const chatId = message.chat.id;

  if (!info) {
    const statusMessage = `
📊 *Gesprek Status*

Nog geen berichten verstuurd in dit gesprek.

Stuur een bericht om te beginnen! 🚀
`.trim();

    await api.sendText(chatId, statusMessage, {
      parse_mode: 'Markdown',
    });
    return;
  }

  const statusMessage = `
📊 *Gesprek Status*

*Berichten:* ${info.messageCount}
*Laatste activiteit:* ${info.lastActivity.toLocaleString('nl-NL')}
`.trim();

  await api.sendText(chatId, statusMessage, {
    parse_mode: 'Markdown',
  });
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
🤖 *Claude Telegram Bot Help*

*Beschikbare commando's:*

/start - Start de bot
/claude-status - Bekijk gesprek status
/claude-clear - Maak gespreksgeschiedenis leeg
/status - Bot status
/help - Toon dit bericht

*Hoe werkt het?*
1. Stuur een bericht
2. Claude verwerkt je bericht
3. Je ontvangt direct antwoord!

*Tips:*
• Stel duidelijke vragen
• Voor code: gebruik \`\`\` code blokken
• Gespreksgeschiedenis wordt onthouden
• Gebruik /claude-clear om opnieuw te beginnen
`.trim();

  await api.sendText(chatId, helpMessage, {
    parse_mode: 'Markdown',
  });
}
