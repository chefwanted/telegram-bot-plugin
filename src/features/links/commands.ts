/**
 * Links Commands
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import { shortenUrl, getUserUrls, deleteUrl, getLinkPreview, isValidUrl, type ShortenedUrl } from './links';

export async function linkShortenCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const url = args[0];

  if (!url || !isValidUrl(url)) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik: /link shorten <URL>\n\nVoorbeeld: /link shorten https://example.com',
    });
    return;
  }

  const result = shortenUrl(url);

  await api.sendMessage({
    chat_id: message.chat.id,
    text: `🔗 Korte link gemaakt!\n\n${result.shortUrl}\n\nOrigineel: ${url}`,
  });
}

export async function linkListCommand(api: ApiMethods, message: Message): Promise<void> {
  const urls = getUserUrls();

  if (urls.length === 0) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '🔗 Je hebt nog geen gekorte links.\n\nGebruik /link shorten <URL> om een link te maken.',
    });
    return;
  }

  let text = `🔗 Je gekorte links (${urls.length}):\n\n`;
  urls.forEach((url, i) => {
    text += `${i + 1}. ${url.shortUrl}\n   ➜ ${url.original}\n   Clicks: ${url.clicks}\n\n`;
  });

  await api.sendMessage({ chat_id: message.chat.id, text });
}

export async function linkDeleteCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const code = args[0];

  if (!code) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik: /link delete <code>',
    });
    return;
  }

  const deleted = deleteUrl(code);

  if (deleted) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '✅ Link verwijderd.',
    });
  } else {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❕ Link niet gevonden.',
    });
  }
}

export async function linkPreviewCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const url = args[0];

  if (!url || !isValidUrl(url)) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik: /link preview <URL>',
    });
    return;
  }

  await api.sendMessage({
    chat_id: message.chat.id,
    text: '🔍 Preview aan het laden...',
  });

  try {
    const preview = await getLinkPreview(url);

    if (!preview) {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '❕ Kon geen preview genereren.',
      });
      return;
    }

    let text = '';
    if (preview.title) text += `📌 ${preview.title}\n\n`;
    if (preview.description) text += `${preview.description}\n\n`;
    text += `🔗 ${url}`;

    if (preview.image) {
      await api.sendMessage({
        chat_id: message.chat.id,
        text,
      });
      // Could send image separately
    } else {
      await api.sendMessage({ chat_id: message.chat.id, text });
    }
  } catch (error) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Fout bij laden van preview.',
    });
  }
}
