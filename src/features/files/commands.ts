/**
 * Files Commands
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import {
  getUserFiles,
  deleteFile,
  formatFileSize,
  createFolder,
  getFolders,
  moveFile,
} from './files';
import {
  gitInit,
  gitStatus,
  gitAdd,
  gitCommit,
  gitLog,
  gitIsRepo,
  formatGitStatus,
  formatGitLog,
} from './git';

// =============================================================================
// File Commands
// =============================================================================

export async function fileListCommand(api: ApiMethods, message: Message, args: string[] = []): Promise<void> {
  const folder = args[0];
  const files = getUserFiles(String(message.chat.id), folder);

  if (files.length === 0) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: folder
        ? `📎 Geen bestanden in folder "${folder}".\n\nGebruik /file list om alle bestanden te zien.`
        : '📎 Je hebt geen bestanden opgeslagen.\n\nStuur een bestand naar de chat om het op te slaan.',
    });
    return;
  }

  let text = `📎 Je bestanden (${files.length})${folder ? ` in *${folder}*` : ''}:\n\n`;
  files.forEach((file, i) => {
    text += `${i + 1}. ${file.fileName}\n`;
    text += `   Grootte: ${formatFileSize(file.fileSize)}\n`;
    text += `   ID: \`${file.id}\`\n\n`;
  });

  await api.sendMessage({ chat_id: message.chat.id, text, parse_mode: 'Markdown' });
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

  const deleted = deleteFile(fileId, String(message.chat.id));

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
export async function handleFileUpload(
  api: ApiMethods,
  message: Message,
  fileService: { saveFile: (file: unknown) => Promise<void> }
): Promise<void> {
  const document = (message as Message & { document?: unknown }).document;
  const photo = (message as Message & { photo?: unknown }).photo;

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

// =============================================================================
// Folder Commands
// =============================================================================

export async function folderListCommand(api: ApiMethods, message: Message): Promise<void> {
  const folders = getFolders(String(message.chat.id));

  if (folders.length === 0) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '📁 Je hebt geen folders.\n\nGebruik /folder create <naam> om een folder te maken.',
    });
    return;
  }

  let text = `📁 Je folders (${folders.length}):\n\n`;
  folders.forEach((folder, i) => {
    text += `${i + 1}. *${folder.name}*\n`;
    text += `   Bestanden: ${folder.fileCount}\n\n`;
  });

  await api.sendMessage({ chat_id: message.chat.id, text, parse_mode: 'Markdown' });
}

export async function folderCreateCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const folderName = args[0];

  if (!folderName) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik: /folder create <naam>\n\nVoorbeeld: /folder create fotos',
    });
    return;
  }

  const created = createFolder(String(message.chat.id), folderName);

  if (created) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `✅ Folder "${folderName}" aangemaakt!`,
    });
  } else {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `❌ Kon folder niet aanmaken. Bestaat al of ongeldige naam.\n\nGebruik alleen letters, cijfers, underscores en streepjes.`,
    });
  }
}

// =============================================================================
// File Move Command
// =============================================================================

export async function fileMoveCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const fileId = args[0];
  const targetFolder = args[1];

  if (!fileId || !targetFolder) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik: /file move <file_id> <folder>\n\nVoorbeeld: /file move abc123 fotos',
    });
    return;
  }

  const moved = moveFile(fileId, String(message.chat.id), targetFolder);

  if (moved) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `✅ Bestand verplaatst naar "${targetFolder}"!`,
    });
  } else {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❕ Kon bestand niet verplaatsen. Bestaat het bestand wel?',
    });
  }
}

// =============================================================================
// Git Commands
// =============================================================================

export async function gitInitCommand(api: ApiMethods, message: Message): Promise<void> {
  const isRepo = await gitIsRepo(String(message.chat.id));

  if (isRepo) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '⚠️ Je hebt al een git repository.\n\nGebruik /git status om de status te zien.',
    });
    return;
  }

  const initialized = await gitInit(String(message.chat.id));

  if (initialized) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '✅ Git repository geïnitialiseerd!\n\nGebruik /git add en /git commit om bestanden toe te voegen.',
    });
  } else {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Kon repository niet initialiseren.',
    });
  }
}

export async function gitStatusCommand(api: ApiMethods, message: Message): Promise<void> {
  const isRepo = await gitIsRepo(String(message.chat.id));

  if (!isRepo) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Geen git repository gevonden.\n\nGebruik /git init om te starten.',
    });
    return;
  }

  const status = await gitStatus(String(message.chat.id));

  if (!status) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Kon status niet ophalen.',
    });
    return;
  }

  const text = formatGitStatus(status);
  await api.sendMessage({ chat_id: message.chat.id, text, parse_mode: 'Markdown' });
}

export async function gitAddCommand(api: ApiMethods, message: Message, args: string[] = []): Promise<void> {
  const isRepo = await gitIsRepo(String(message.chat.id));

  if (!isRepo) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Geen git repository gevonden.\n\nGebruik /git init om te starten.',
    });
    return;
  }

  const added = await gitAdd(String(message.chat.id), args.length > 0 ? args : undefined);

  if (added) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: args.length > 0
        ? `✅ ${args.length} bestand(en) toegevoegd aan staging.\n\nGebruik /git commit om te committen.`
        : '✅ Alle gewijzigde bestanden toegevoegd aan staging.\n\nGebruik /git commit om te committen.',
    });
  } else {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Kon bestanden niet toevoegen.',
    });
  }
}

export async function gitCommitCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const messageText = args.join(' ');

  if (!messageText) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik: /git commit <bericht>\n\nVoorbeeld: /git commit Added new files',
    });
    return;
  }

  const isRepo = await gitIsRepo(String(message.chat.id));

  if (!isRepo) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Geen git repository gevonden.',
    });
    return;
  }

  const committed = await gitCommit(String(message.chat.id), messageText);

  if (committed) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `✅ Commit gemaakt!\n\nBericht: ${messageText}`,
    });
  } else {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Kon geen commit maken. Misschien zijn er geen wijzigingen?',
    });
  }
}

export async function gitLogCommand(api: ApiMethods, message: Message, args: string[] = []): Promise<void> {
  const limit = args[0] ? parseInt(args[0], 10) : 10;
  const isRepo = await gitIsRepo(String(message.chat.id));

  if (!isRepo) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Geen git repository gevonden.\n\nGebruik /git init om te starten.',
    });
    return;
  }

  const commits = await gitLog(String(message.chat.id), limit);
  const text = formatGitLog(commits);

  await api.sendMessage({ chat_id: message.chat.id, text, parse_mode: 'Markdown' });
}
