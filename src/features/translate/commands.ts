/**
 * Translation Commands
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import { translateText, LANGUAGE_NAMES } from './translate';

export async function translateCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  if (args.length < 2) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `❌ Gebruik: /tr <taal> <tekst>

Beschikbare talen:
${Object.entries(LANGUAGE_NAMES).map(([code, name]) => `  ${code} - ${name}`).join('\n')}

Voorbeeld: /tr en Hello world`,
    });
    return;
  }

  const targetLang = args[0].toLowerCase();
  const text = args.slice(1).join(' ');

  if (!LANGUAGE_NAMES[targetLang]) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `❕ Onbekende taal: ${targetLang}`,
    });
    return;
  }

  try {
    const result = await translateText({
      text,
      source: 'auto',
      target: targetLang,
    });

    await api.sendMessage({
      chat_id: message.chat.id,
      text: `🌐 ${LANGUAGE_NAMES[targetLang] || targetLang.toUpperCase()}:\n\n${result.translatedText}`,
    });
  } catch (error) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Vertaling mislukt. Probeer het later opnieuw.',
    });
  }
}

export async function translateListCommand(api: ApiMethods, message: Message): Promise<void> {
  let text = '🌐 Beschikbare talen:\n\n';
  text += Object.entries(LANGUAGE_NAMES)
    .map(([code, name]) => `${code} - ${name}`)
    .join('\n');

  text += '\n\nGebruik: /tr <taal> <tekst>';

  await api.sendMessage({ chat_id: message.chat.id, text });
}
