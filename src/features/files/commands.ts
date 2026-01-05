/**
 * Files Commands
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import * as path from 'path';
import { createLogger } from '../../utils/logger';
import {
  saveFile,
  getUserFiles,
  deleteFile,
  formatFileSize,
  createFolder,
  getFolders,
  moveFile,
} from './files';
import { getMaxUploadBytes } from '../../utils/input-validation';

const logger = createLogger({ prefix: 'FilesCmd' });
import {
  gitInit,
  gitStatus,
  gitAdd,
  gitCommit,
  gitLog,
  gitIsRepo,
  gitPush,
  gitPull,
  gitClone,
  gitRemote,
  gitBranch,
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
  fileService: { saveFile: typeof saveFile } = { saveFile }
): Promise<void> {
  const document = (message as Message & { document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number } }).document;
  const photo = (message as Message & { photo?: { file_id: string; file_size?: number }[] }).photo;

  if (!document && !photo) {
    return;
  }

  const chatId = message.chat.id;
  const isPhoto = !document && Array.isArray(photo) && photo.length > 0;
  const fileId = document?.file_id || (isPhoto ? photo![photo!.length - 1].file_id : undefined);
  const fileSize = document?.file_size || (isPhoto ? photo![photo!.length - 1].file_size : undefined);

  if (!fileId) {
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Kon bestand niet verwerken (geen file_id gevonden).',
    });
    return;
  }

  const fileName = document?.file_name
    ? path.basename(document.file_name)
    : `photo_${message.message_id}.jpg`;
  const mimeType = document?.mime_type || (isPhoto ? 'image/jpeg' : 'application/octet-stream');

  const maxBytes = getMaxUploadBytes();
  if (typeof fileSize === 'number' && fileSize > maxBytes) {
    await api.sendMessage({
      chat_id: chatId,
      text: `❌ Bestand te groot (${formatFileSize(fileSize)}). Max: ${formatFileSize(maxBytes)}.`,
    });
    return;
  }

  try {
    await api.sendChatAction({
      chat_id: chatId,
      action: isPhoto ? 'upload_photo' : 'upload_document',
    });

    const fileInfo = await api.getFile(fileId);
    if (!fileInfo.file_path) {
      await api.sendMessage({
        chat_id: chatId,
        text: '❌ Kon bestand niet downloaden (geen file_path beschikbaar).',
      });
      return;
    }

    const data = await api.downloadFile(fileInfo.file_path);
    const saved = fileService.saveFile(String(chatId), fileName, data, mimeType);

    await api.sendMessage({
      chat_id: chatId,
      text: `📎 Bestand opgeslagen: *${saved.fileName}*\nGrootte: ${formatFileSize(saved.fileSize)}\nID: \`${saved.id}\``,
      parse_mode: 'Markdown',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('File upload failed', { error: errorMessage });
    await api.sendMessage({
      chat_id: chatId,
      text: `❌ Bestand upload mislukt: ${errorMessage}`,
    });
  }
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

export async function gitPushCommand(api: ApiMethods, message: Message, args: string[] = []): Promise<void> {
  const isRepo = await gitIsRepo(String(message.chat.id));

  if (!isRepo) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Geen git repository gevonden.\n\nGebruik /git init om te starten.',
    });
    return;
  }

  const remote = args[0] || 'origin';
  const branch = args[1];

  const result = await gitPush(String(message.chat.id), remote, branch);

  if (result.success) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `✅ ${result.message}`,
    });
  } else {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `❌ Push failed: ${result.message}`,
    });
  }
}

export async function gitPullCommand(api: ApiMethods, message: Message, args: string[] = []): Promise<void> {
  const isRepo = await gitIsRepo(String(message.chat.id));

  if (!isRepo) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Geen git repository gevonden.\n\nGebruik /git init om te starten.',
    });
    return;
  }

  const remote = args[0] || 'origin';
  const branch = args[1];

  const result = await gitPull(String(message.chat.id), remote, branch);

  if (result.success) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `✅ ${result.message}`,
    });
  } else {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `❌ Pull failed: ${result.message}`,
    });
  }
}

export async function gitCloneCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const url = args[0];

  if (!url) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik: /git clone <url>\n\nVoorbeeld: /git clone https://github.com/user/repo.git',
    });
    return;
  }

  const result = await gitClone(String(message.chat.id), url);

  if (result.success) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `✅ ${result.message}`,
    });
  } else {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `❌ Clone failed: ${result.message}`,
    });
  }
}

export async function gitRemoteCommand(api: ApiMethods, message: Message, args: string[] = []): Promise<void> {
  const isRepo = await gitIsRepo(String(message.chat.id));

  if (!isRepo) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Geen git repository gevonden.\n\nGebruik /git init om te starten.',
    });
    return;
  }

  const action = args[0] as 'add' | 'remove' | 'list' | undefined;

  if (!action || action === 'list') {
    const result = await gitRemote(String(message.chat.id), 'list');
    if (result.success && result.remotes) {
      const text = result.remotes.length > 0
        ? `🔗 *Git Remotes*\n\n${result.remotes.join('\n')}`
        : '📋 Geen remotes geconfigureerd.';
      await api.sendMessage({
        chat_id: message.chat.id,
        text,
        parse_mode: 'Markdown',
      });
    } else {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '❌ Kon remotes niet ophalen.',
      });
    }
    return;
  }

  if (action === 'add') {
    const name = args[1];
    const url = args[2];

    if (!name || !url) {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '❌ Gebruik: /git remote add <naam> <url>\n\nVoorbeeld: /git remote add origin https://github.com/user/repo.git',
      });
      return;
    }

    const result = await gitRemote(String(message.chat.id), 'add', name, url);
    await api.sendMessage({
      chat_id: message.chat.id,
      text: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
    });
  } else if (action === 'remove') {
    const name = args[1];

    if (!name) {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '❌ Gebruik: /git remote remove <naam>\n\nVoorbeeld: /git remote remove origin',
      });
      return;
    }

    const result = await gitRemote(String(message.chat.id), 'remove', name);
    await api.sendMessage({
      chat_id: message.chat.id,
      text: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
    });
  } else {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Onbekende remote actie.\n\nGebruik: list, add of remove',
    });
  }
}

export async function gitBranchCommand(api: ApiMethods, message: Message, args: string[] = []): Promise<void> {
  const isRepo = await gitIsRepo(String(message.chat.id));

  if (!isRepo) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Geen git repository gevonden.\n\nGebruik /git init om te starten.',
    });
    return;
  }

  const action = args[0] as 'list' | 'create' | 'delete' | 'switch' | undefined;

  if (!action || action === 'list') {
    const result = await gitBranch(String(message.chat.id), 'list');
    if (result.success && result.branches) {
      const text = result.branches.length > 0
        ? `🌿 *Git Branches*\n\n${result.branches.join('\n')}`
        : '📋 Geen branches gevonden.';
      await api.sendMessage({
        chat_id: message.chat.id,
        text,
        parse_mode: 'Markdown',
      });
    } else {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '❌ Kon branches niet ophalen.',
      });
    }
    return;
  }

  if (action === 'create') {
    const branchName = args[1];

    if (!branchName) {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '❌ Gebruik: /git branch create <naam>\n\nVoorbeeld: /git branch create feature-x',
      });
      return;
    }

    const result = await gitBranch(String(message.chat.id), 'create', branchName);
    await api.sendMessage({
      chat_id: message.chat.id,
      text: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
    });
  } else if (action === 'delete') {
    const branchName = args[1];

    if (!branchName) {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '❌ Gebruik: /git branch delete <naam>\n\nVoorbeeld: /git branch delete feature-x',
      });
      return;
    }

    const result = await gitBranch(String(message.chat.id), 'delete', branchName);
    await api.sendMessage({
      chat_id: message.chat.id,
      text: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
    });
  } else if (action === 'switch') {
    const branchName = args[1];

    if (!branchName) {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '❌ Gebruik: /git branch switch <naam>\n\nVoorbeeld: /git branch switch main',
      });
      return;
    }

    const result = await gitBranch(String(message.chat.id), 'switch', branchName);
    await api.sendMessage({
      chat_id: message.chat.id,
      text: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
    });
  } else {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Onbekende branch actie.\n\nGebruik: list, create, delete of switch',
    });
  }
}
