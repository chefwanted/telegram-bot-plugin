/**
 * Search Commands
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import type { ClaudeService } from '../../claude';
import { searchAll } from './search';

let claudeService: ClaudeService | undefined;

export function setClaudeService(service: ClaudeService): void {
  claudeService = service;
}

export async function searchCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const query = args.join(' ');

  if (!query) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik: /search <zoekterm>\n\nZoekt in notities en gesprekken.',
    });
    return;
  }

  await api.sendMessage({
    chat_id: message.chat.id,
    text: '🔍 Zoeken...',
  });

  try {
    const results = await searchAll(query, String(message.chat.id), claudeService);

    if (results.length === 0) {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '🔍 Geen resultaten gevonden.',
      });
      return;
    }

    let text = `🔍 ${results.length} resultaat(en) voor "${query}":\n\n`;
    results.slice(0, 10).forEach((r, i) => {
      const icon = r.type === 'note' ? '📝' : '💬';
      const preview = r.content.length > 60 ? r.content.substring(0, 60) + '...' : r.content;
      text += `${icon} ${preview}\n`;
    });

    if (results.length > 10) {
      text += `\n...en ${results.length - 10} meer`;
    }

    await api.sendMessage({ chat_id: message.chat.id, text });
  } catch (error) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Zoeken mislukt.',
    });
  }
}
