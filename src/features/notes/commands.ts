/**
 * Notes Commands
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import { FileNotesStore } from './store';

const store = new FileNotesStore();

export async function noteListCommand(api: ApiMethods, message: Message): Promise<void> {
  const notes = store.get(String(message.chat.id));

  if (notes.length === 0) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '📝 Je hebt nog geen notities.\n\nGebruik /note add <tekst> om een notitie toe te voegen.',
    });
    return;
  }

  let text = `📝 Je notities (${notes.length}):\n\n`;
  notes.forEach((note, i) => {
    const preview = note.content.length > 50 ? note.content.substring(0, 50) + '...' : note.content;
    text += `${i + 1}. ${preview}`;
    if (note.tags.length > 0) {
      text += ` [${note.tags.join(', ')}]`;
    }
    text += '\n';
  });

  await api.sendMessage({ chat_id: message.chat.id, text });
}

export async function noteAddCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const content = args.join(' ');
  if (!content) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik: /note add <tekst>',
    });
    return;
  }

  const note = store.add(String(message.chat.id), content);
  await api.sendMessage({
    chat_id: message.chat.id,
    text: `✅ Notitie opgeslagen (ID: ${note.id})`,
  });
}

export async function noteGetCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const index = parseInt(args[0] || '0', 10) - 1;
  const notes = store.get(String(message.chat.id));

  if (index < 0 || index >= notes.length) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❕ Ongeldig nummer. Gebruik /note list om alle notities te zien.',
    });
    return;
  }

  const note = notes[index];
  let text = `📝 Notitie #${index + 1}:\n\n${note.content}`;
  if (note.tags.length > 0) {
    text += `\n\nTags: ${note.tags.join(', ')}`;
  }

  await api.sendMessage({ chat_id: message.chat.id, text });
}

export async function noteDeleteCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const index = parseInt(args[0] || '0', 10) - 1;
  const notes = store.get(String(message.chat.id));

  if (index < 0 || index >= notes.length) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❕ Ongeldig nummer.',
    });
    return;
  }

  const note = notes[index];
  const deleted = store.delete(String(message.chat.id), note.id);

  if (deleted) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '✅ Notitie verwijderd.',
    });
  }
}

export async function noteSearchCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const query = args.join(' ').toLowerCase();
  if (!query) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik: /note search <zoekterm>',
    });
    return;
  }

  const results = store.search(String(message.chat.id), query);

  if (results.length === 0) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '🔍 Geen resultaten gevonden.',
    });
    return;
  }

  let text = `🔍 ${results.length} resultaat(s):\n\n`;
  results.forEach((note) => {
    const preview = note.content.length > 50 ? note.content.substring(0, 50) + '...' : note.content;
    text += `• ${preview}\n`;
  });

  await api.sendMessage({ chat_id: message.chat.id, text });
}

export async function noteTagCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const index = parseInt(args[0] || '0', 10) - 1;
  const tag = args[1];
  const notes = store.get(String(message.chat.id));

  if (index < 0 || index >= notes.length || !tag) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik: /note tag <nummer> <tag>',
    });
    return;
  }

  const note = notes[index];
  const added = store.addTag(String(message.chat.id), note.id, tag);

  if (added) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `✅ Tag "${tag}" toegevoegd aan notitie #${index + 1}`,
    });
  } else {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `⚠️ Tag "${tag}" bestaat al.`,
    });
  }
}
