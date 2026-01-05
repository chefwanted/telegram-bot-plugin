/**
 * Files Feature - File upload/download management
 */

import * as fs from 'fs';
import * as path from 'path';

const FILES_DIR = '/tmp/telegram-bot/files';

export interface StoredFile {
  id: string;
  chatId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  uploadedAt: number;
}

const filesMap = new Map<string, StoredFile>();

export function initFilesDir(): void {
  if (!fs.existsSync(FILES_DIR)) {
    fs.mkdirSync(FILES_DIR, { recursive: true });
  }
}

export function saveFile(chatId: string, fileName: string, data: Buffer, mimeType: string): StoredFile {
  initFilesDir();

  const id = Date.now().toString() + Math.random().toString(36).substring(2);
  const ext = path.extname(fileName);
  const filePath = path.join(FILES_DIR, `${id}${ext}`);

  fs.writeFileSync(filePath, data);

  const file: StoredFile = {
    id,
    chatId,
    fileName,
    fileSize: data.length,
    mimeType,
    filePath,
    uploadedAt: Date.now(),
  };

  filesMap.set(id, file);
  return file;
}

export function getFile(id: string): StoredFile | undefined {
  return filesMap.get(id);
}

export function getUserFiles(chatId: string): StoredFile[] {
  return Array.from(filesMap.values()).filter(f => f.chatId === chatId);
}

export function deleteFile(id: string): boolean {
  const file = filesMap.get(id);
  if (file) {
    try {
      fs.unlinkSync(file.filePath);
    } catch {}
    return filesMap.delete(id);
  }
  return false;
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }

  return `${size.toFixed(1)} ${units[unit]}`;
}
