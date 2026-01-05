/**
 * Files Commands
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import { getUserFiles, deleteFile, formatFileSize } from './files';

export async function fileListCommand(api: ApiMethods, message: Message): Promise<void> {
  const files = getUserFiles(String(message.chat.id));

  if (files.length === 0) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '📎 Je hebt geen bestanden opgeslagen.\n\nStuur een bestand naar de chat om het op te slaan.',
    });
    return;
  }

  let text = `📎 Je bestanden (${files.length}):\n\n`;
  files.forEach((file, i) => {
    text += `${i + 1}. ${file.fileName}\n`;
    text += `   Grootte: ${formatFileSize(file.fileSize)}\n`;
    text += `   ID: ${file.id}\n\n`;
  });

  await api.sendMessage({ chat_id: message.chat.id, text });
}

export async function fileDeleteCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const fileId = args[0];

  if (!fileId) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik: /file delete <file_id>\n\nGebruik /file list om je bestanden te zien.',
    });
    return;
  }

  const deleted = deleteFile(fileId);

  if (deleted) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '✅ Bestand verwijderd.',
    });
  } else {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❕ Bestand niet gevonden.',
    });
  }
}

// Handle incoming document/photo messages
export async function handleFileUpload(api: ApiMethods, message: Message, fileService: any): Promise<void> {
  const document = (message as any).document;
  const photo = (message as any).photo;

  if (!document && !photo) {
    return;
  }

  // Note: This would require downloading the file from Telegram
  // For now, just acknowledge
  await api.sendMessage({
    chat_id: message.chat.id,
    text: '📎 Bestand ontvangen!\n\n(Notitie: Bestandsopslag integratie vereist extra configuratie)',
  });
}
