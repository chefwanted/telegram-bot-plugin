/**
 * Status Command
 * Toont bot status en statistieken
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';

// =============================================================================
// Status Command
// =============================================================================

export async function statusCommand(
  api: ApiMethods,
  message: Message,
  stats: {
    isRunning: boolean;
    isPolling: boolean;
    totalUpdates: number;
    totalMessages: number;
    totalCommands: number;
    totalErrors: number;
  }
): Promise<void> {
  const chatId = message.chat.id;

  const statusEmoji = stats.isRunning ? '✅' : '❌';
  const pollingEmoji = stats.isPolling ? '🟢' : '🔴';

  const statusMessage = `
*Bot Status* ${statusEmoji}

• *Status:* ${stats.isRunning ? 'Online' : 'Offline'}
• *Polling:* ${stats.isPolling ? 'Actief' : 'Inactief'} ${pollingEmoji}

*Statistieken:*
• Updates: ${stats.totalUpdates}
• Berichten: ${stats.totalMessages}
• Commando's: ${stats.totalCommands}
• Fouten: ${stats.totalErrors}

*Uptime:* ${new Date().toLocaleString('nl-NL')}
`.trim();

  await api.sendText(chatId, statusMessage, {
    parse_mode: 'Markdown',
  });
}
