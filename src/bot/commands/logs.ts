/**
 * Logs Command
 * View and search bot interaction logs from Telegram
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import { telegramLogger } from '../../utils/telegram-logger';

export async function logsCommand(
  api: ApiMethods,
  message: Message,
  args: string[]
): Promise<void> {
  const chatId = message.chat.id;

  if (args.length === 0) {
    const help = `
*Bot Logs*

Gebruik: /logs <optie> [params]

*Opties:*
/logs recent - Toon recent logs (laatste 20)
/logs chat - Toon logs voor deze chat
/logs search <term> - Zoek in logs
/logs path - Toon log bestand pad
/logs dir - Toon log directory

*Voorbeeld:*
/logs recent
/logs search claude
/logs chat
    `.trim();
    await api.sendText(chatId, help, { parse_mode: 'Markdown' });
    return;
  }

  const subCommand = args[0].toLowerCase();

  switch (subCommand) {
    case 'recent':
    case 'last':
    case '-r':
      const recentLogs = telegramLogger.getRecentLogs(20);
      if (recentLogs.length === 0) {
        await api.sendText(chatId, 'Nog geen logs beschikbaar.');
        return;
      }
      const recentText = `*Recente Logs (${recentLogs.length})*\n\n` + recentLogs.join('\n');
      await api.sendText(chatId, recentText.length > 4000 ? recentText.substring(0, 3900) + '\n...' : recentText, { parse_mode: 'Markdown' });
      break;

    case 'chat':
    case 'this':
    case '-c':
      const chatLogs = telegramLogger.getLogsByChat(chatId, 30);
      if (chatLogs.length === 0) {
        await api.sendText(chatId, 'Nog geen logs voor deze chat.');
        return;
      }
      const chatText = `*Logs voor Chat ${chatId} (${chatLogs.length})*\n\n` + chatLogs.join('\n');
      await api.sendText(chatId, chatText.length > 4000 ? chatText.substring(0, 3900) + '\n...' : chatText, { parse_mode: 'Markdown' });
      break;

    case 'search':
    case 'find':
    case '-s':
      if (args.length < 2) {
        await api.sendText(chatId, 'Gebruik: /logs search <term>');
        return;
      }
      const searchTerm = args.slice(1).join(' ');
      const searchResults = telegramLogger.searchLogs(searchTerm, 20);
      if (searchResults.length === 0) {
        await api.sendText(chatId, `Geen resultaten gevonden voor "${searchTerm}".`);
        return;
      }
      const searchText = `*Zoekresultaten voor "${searchTerm}" (${searchResults.length})*\n\n` + searchResults.join('\n');
      await api.sendText(chatId, searchText.length > 4000 ? searchText.substring(0, 3900) + '\n...' : searchText, { parse_mode: 'Markdown' });
      break;

    case 'path':
    case 'file':
    case '-p':
      const logPath = telegramLogger.getLogPath();
      await api.sendText(chatId, `📁 *Log Bestand*\n\n\`${logPath}\``, { parse_mode: 'Markdown' });
      break;

    case 'dir':
    case 'directory':
    case '-d':
      const logDir = telegramLogger.getLogDir();
      await api.sendText(chatId, `📁 *Log Directory*\n\n\`${logDir}\``, { parse_mode: 'Markdown' });
      break;

    case 'help':
    case '--help':
    case '-h':
      const helpText = `
*Bot Logs Help*

Gebruik: /logs <optie> [params]

*Opties:*
\`/logs recent\` - Laatste 20 log regels
\`/logs chat\` - Logs voor deze chat
\`/logs search <term>\` - Zoek in logs
\`/logs path\` - Toon log bestand locatie
\`/logs dir\` - Toon log directory

*Logs worden opgeslagen in:*
/tmp/telegram-bot-logs/interactions.log
      `.trim();
      await api.sendText(chatId, helpText, { parse_mode: 'Markdown' });
      break;

    default:
      await api.sendText(chatId, `Onbekende optie: ${subCommand}\n\nGebruik /logs help voor opties.`);
  }
}
