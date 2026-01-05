/**
 * Analytics Commands
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import { getStats, resetStats } from './analytics';

export async function statsCommand(api: ApiMethods, message: Message): Promise<void> {
  const stats = getStats();
  const uptime = Math.round((Date.now() - stats.lastReset) / 1000 / 60);

  let text = `📊 Bot Statistieken:\n\n`;
  text += `📩 Berichten: ${stats.messages}\n`;
  text += `⌨️ Commando's: ${stats.commands}\n`;
  text += `❌ Fouten: ${stats.errors}\n`;
  text += `⏱️ Uptime: ${uptime} min\n`;

  if (Object.keys(stats.commandCounts).length > 0) {
    text += `\nTop commando's:\n`;
    const sorted = Object.entries(stats.commandCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    sorted.forEach(([cmd, count]) => {
      text += `  ${cmd}: ${count}x\n`;
    });
  }

  await api.sendMessage({ chat_id: message.chat.id, text });
}

export async function statsResetCommand(api: ApiMethods, message: Message): Promise<void> {
  resetStats();
  await api.sendMessage({
    chat_id: message.chat.id,
    text: '✅ Statistieken gereset.',
  });
}
