/**
 * Claude Code Commands
 * Telegram commands voor Claude Code CLI integratie
 */

import type { Message } from '../types/telegram';
import type { ApiMethods } from '../api';
import type { ClaudeCodeService } from './service';
import type { ClaudeCodeSession } from './types';

// =============================================================================
// Session Commands
// =============================================================================

/**
 * /claude new [naam] - Start nieuwe sessie
 */
export async function claudeNewSessionCommand(
  api: ApiMethods,
  message: Message,
  args: string[],
  service: ClaudeCodeService
): Promise<void> {
  const chatId = message.chat.id;
  const sessionName = args.join(' ') || undefined;

  try {
    const session = await service.startNewSession(String(chatId), sessionName);
    
    await api.sendMessage({
      chat_id: chatId,
      text: `✅ Nieuwe Claude sessie gestart!

📝 Naam: ${session.name}
🔑 ID: \`${session.id}\`

Je kunt nu berichten sturen en Claude Code zal reageren.`,
      parse_mode: 'Markdown',
    });
  } catch (error) {
    await api.sendMessage({
      chat_id: chatId,
      text: `❌ Kon geen nieuwe sessie starten: ${(error as Error).message}`,
    });
  }
}

/**
 * /claude sessions - Lijst van sessies
 */
export async function claudeSessionsCommand(
  api: ApiMethods,
  message: Message,
  service: ClaudeCodeService
): Promise<void> {
  const chatId = message.chat.id;

  try {
    const sessions = await service.getSessionsForChat(String(chatId));

    if (sessions.length === 0) {
      await api.sendMessage({
        chat_id: chatId,
        text: `📭 Je hebt nog geen Claude sessies.

Stuur een bericht om automatisch een sessie te starten, of gebruik:
/claude new [naam] - Start nieuwe sessie`,
      });
      return;
    }

    let text = '📋 *Jouw Claude Sessies:*\n\n';

    for (const session of sessions) {
      const active = session.isActive ? '🟢' : '⚪';
      const date = session.lastActivityAt.toLocaleDateString('nl-NL');
      text += `${active} *${session.name}*\n`;
      text += `   ID: \`${session.id}\`\n`;
      text += `   Berichten: ${session.messageCount} | Laatst: ${date}\n\n`;
    }

    text += `\n_Gebruik /claude switch <id> om te wisselen_`;

    await api.sendMessage({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    });
  } catch (error) {
    await api.sendMessage({
      chat_id: chatId,
      text: `❌ Kon sessies niet ophalen: ${(error as Error).message}`,
    });
  }
}

/**
 * /claude switch <id> - Wissel naar andere sessie
 */
export async function claudeSwitchCommand(
  api: ApiMethods,
  message: Message,
  args: string[],
  service: ClaudeCodeService
): Promise<void> {
  const chatId = message.chat.id;
  const sessionId = args[0];

  if (!sessionId) {
    await api.sendMessage({
      chat_id: chatId,
      text: `⚠️ Geef een sessie ID op.

Gebruik: /claude switch <sessie-id>
Zie /claude sessions voor beschikbare sessies.`,
    });
    return;
  }

  try {
    const session = await service.switchSession(String(chatId), sessionId);

    if (!session) {
      await api.sendMessage({
        chat_id: chatId,
        text: `❌ Sessie niet gevonden: \`${sessionId}\``,
        parse_mode: 'Markdown',
      });
      return;
    }

    await api.sendMessage({
      chat_id: chatId,
      text: `✅ Gewisseld naar sessie: *${session.name}*

🔑 ID: \`${session.id}\`
📊 Berichten: ${session.messageCount}`,
      parse_mode: 'Markdown',
    });
  } catch (error) {
    await api.sendMessage({
      chat_id: chatId,
      text: `❌ Kon niet wisselen: ${(error as Error).message}`,
    });
  }
}

/**
 * /claude end - Beëindig huidige sessie
 */
export async function claudeEndCommand(
  api: ApiMethods,
  message: Message,
  service: ClaudeCodeService
): Promise<void> {
  const chatId = message.chat.id;

  try {
    const session = await service.getActiveSession(String(chatId));
    
    if (!session) {
      await api.sendMessage({
        chat_id: chatId,
        text: `⚠️ Je hebt geen actieve sessie.`,
      });
      return;
    }

    await service.endSession(String(chatId));

    await api.sendMessage({
      chat_id: chatId,
      text: `✅ Sessie beëindigd: *${session.name}*

De sessie is opgeslagen en je kunt later terug met:
/claude switch ${session.id}

Of start een nieuwe sessie met /claude new`,
      parse_mode: 'Markdown',
    });
  } catch (error) {
    await api.sendMessage({
      chat_id: chatId,
      text: `❌ Kon sessie niet beëindigen: ${(error as Error).message}`,
    });
  }
}

/**
 * /claude delete <id> - Verwijder een sessie
 */
export async function claudeDeleteCommand(
  api: ApiMethods,
  message: Message,
  args: string[],
  service: ClaudeCodeService
): Promise<void> {
  const chatId = message.chat.id;
  const sessionId = args[0];

  if (!sessionId) {
    await api.sendMessage({
      chat_id: chatId,
      text: `⚠️ Geef een sessie ID op.

Gebruik: /claude delete <sessie-id>`,
    });
    return;
  }

  try {
    const deleted = await service.deleteSession(sessionId);

    if (!deleted) {
      await api.sendMessage({
        chat_id: chatId,
        text: `❌ Sessie niet gevonden: \`${sessionId}\``,
        parse_mode: 'Markdown',
      });
      return;
    }

    await api.sendMessage({
      chat_id: chatId,
      text: `🗑️ Sessie verwijderd: \`${sessionId}\``,
      parse_mode: 'Markdown',
    });
  } catch (error) {
    await api.sendMessage({
      chat_id: chatId,
      text: `❌ Kon sessie niet verwijderen: ${(error as Error).message}`,
    });
  }
}

/**
 * /claude status - Toon huidige sessie status
 */
export async function claudeCodeStatusCommand(
  api: ApiMethods,
  message: Message,
  service: ClaudeCodeService
): Promise<void> {
  const chatId = message.chat.id;

  try {
    const session = await service.getActiveSession(String(chatId));
    const stats = await service.getStats();

    let text = '📊 *Claude Code Status*\n\n';

    if (session) {
      text += `🟢 *Actieve Sessie:*\n`;
      text += `   Naam: ${session.name}\n`;
      text += `   ID: \`${session.id}\`\n`;
      text += `   Berichten: ${session.messageCount}\n`;
      text += `   Gestart: ${session.createdAt.toLocaleDateString('nl-NL')}\n`;
      text += `   Laatst actief: ${session.lastActivityAt.toLocaleString('nl-NL')}\n\n`;
    } else {
      text += `⚪ Geen actieve sessie\n\n`;
    }

    text += `📈 *Totaal:*\n`;
    text += `   Sessies: ${stats.totalSessions}\n`;
    text += `   Actief: ${stats.activeSessions}\n`;
    text += `   Berichten: ${stats.totalMessages}\n`;

    await api.sendMessage({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    });
  } catch (error) {
    await api.sendMessage({
      chat_id: chatId,
      text: `❌ Kon status niet ophalen: ${(error as Error).message}`,
    });
  }
}

/**
 * /claude help - Toon Claude Code help
 */
export async function claudeCodeHelpCommand(
  api: ApiMethods,
  message: Message
): Promise<void> {
  const chatId = message.chat.id;

  const helpText = `🤖 *Claude Code - Telegram Integratie*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*CHATTEN*
Stuur gewoon een bericht en Claude Code reageert!
Je chat gaat door tot je een nieuwe sessie start.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*SESSIE BEHEER*
/claude new [naam] - Start nieuwe sessie
/claude sessions - Bekijk al je sessies
/claude switch <id> - Wissel naar sessie
/claude end - Beëindig huidige sessie
/claude delete <id> - Verwijder sessie

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*INFO*
/claude status - Huidige sessie info
/claude help - Dit bericht

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 *Tips:*
• Sessies worden automatisch bewaard
• Je kunt later terugkeren naar oude sessies
• Claude Code heeft toegang tot je project bestanden

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await api.sendMessage({
    chat_id: chatId,
    text: helpText,
    parse_mode: 'Markdown',
  });
}

// =============================================================================
// Main Router
// =============================================================================

/**
 * Route /claude commands
 */
export async function routeClaudeCommand(
  api: ApiMethods,
  message: Message,
  args: string[],
  service: ClaudeCodeService
): Promise<void> {
  const subcommand = args[0]?.toLowerCase();

  switch (subcommand) {
    case 'new':
      await claudeNewSessionCommand(api, message, args.slice(1), service);
      break;
    case 'sessions':
    case 'list':
      await claudeSessionsCommand(api, message, service);
      break;
    case 'switch':
      await claudeSwitchCommand(api, message, args.slice(1), service);
      break;
    case 'end':
    case 'stop':
      await claudeEndCommand(api, message, service);
      break;
    case 'delete':
    case 'remove':
      await claudeDeleteCommand(api, message, args.slice(1), service);
      break;
    case 'status':
      await claudeCodeStatusCommand(api, message, service);
      break;
    case 'help':
    case undefined:
      await claudeCodeHelpCommand(api, message);
      break;
    default:
      // If first arg is not a known command, treat it as a message
      await api.sendMessage({
        chat_id: message.chat.id,
        text: `⚠️ Onbekend commando: ${subcommand}

Gebruik /claude help voor beschikbare commando's.`,
      });
  }
}
