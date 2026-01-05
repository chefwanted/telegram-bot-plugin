/**
 * Files Feature - File upload/download management with folders
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDatabase } from '../../database';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ prefix: 'Files' });

const FILES_DIR = '/tmp/telegram-bot/files';

export interface StoredFile {
  id: string;
  chatId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  folder?: string;
  uploadedAt: number;
}

export interface Folder {
  name: string;
  chatId: string;
  fileCount: number;
  createdAt: number;
}

// In-memory cache for files (deprecated, use database)
const filesMap = new Map<string, StoredFile>();

// =============================================================================
// Initialization
// =============================================================================

export function initFilesDir(): void {
  if (!fs.existsSync(FILES_DIR)) {
    fs.mkdirSync(FILES_DIR, { recursive: true });
  }
}

// =============================================================================
// File Operations (with database integration)
// =============================================================================

export function saveFile(
  chatId: string,
  fileName: string,
  data: Buffer,
  mimeType: string,
  folder?: string
): StoredFile {
  initFilesDir();

  const id = Date.now().toString() + Math.random().toString(36).substring(2);
  const ext = path.extname(fileName);
  const filePath = folder
    ? path.join(FILES_DIR, folder, `${id}${ext}`)
    : path.join(FILES_DIR, `${id}${ext}`);

  // Create folder if needed
  if (folder) {
    const folderPath = path.join(FILES_DIR, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
  }

  fs.writeFileSync(filePath, data);

  const file: StoredFile = {
    id,
    chatId,
    fileName,
    fileSize: data.length,
    mimeType,
    filePath,
    folder,
    uploadedAt: Date.now(),
  };

  // Save to database
  const db = getDatabase();
  db.addFile(chatId, id, fileName, data.length, mimeType, folder);

  // Also keep in memory cache
  filesMap.set(id, file);

  logger.info(`File saved: ${fileName} (${folder || 'root'})`);
  return file;
}

export function getFile(id: string): StoredFile | undefined {
  return filesMap.get(id);
}

export function getUserFiles(chatId: string, folder?: string): StoredFile[] {
  const db = getDatabase();
  const dbFiles = db.getFiles(chatId, folder);

  return dbFiles.map((f: any) => ({
    id: f.file_id,
    chatId: f.chat_id,
    fileName: f.file_name,
    fileSize: f.file_size,
    mimeType: f.mime_type,
    filePath: '', // Not stored in DB
    folder: f.folder,
    uploadedAt: f.created_at,
  }));
}

export function deleteFile(id: string, chatId: string): boolean {
  const db = getDatabase();
  const file = filesMap.get(id);

  if (file) {
    try {
      fs.unlinkSync(file.filePath);
    } catch {}
    filesMap.delete(id);
  }

  // Delete from database
  const numericId = parseInt(id, 10);
  return db.deleteFile(numericId, chatId);
}

// =============================================================================
// Folder Operations
// =============================================================================

export function createFolder(chatId: string, folderName: string): boolean {
  // Validate folder name
  if (!/^[a-zA-Z0-9_-]+$/.test(folderName)) {
    return false;
  }

  const folderPath = path.join(FILES_DIR, folderName);

  if (fs.existsSync(folderPath)) {
    return false; // Already exists
  }

  fs.mkdirSync(folderPath, { recursive: true });

  logger.info(`Folder created: ${folderName} for ${chatId}`);
  return true;
}

export function getFolders(chatId: string): Folder[] {
  const db = getDatabase();
  const files = db.getFiles(chatId);

  const folderMap = new Map<string, Folder>();

  for (const file of files) {
    const folderName = file.folder || 'root';
    const existing = folderMap.get(folderName);

    if (existing) {
      existing.fileCount++;
    } else {
      folderMap.set(folderName, {
        name: folderName,
        chatId: file.chat_id,
        fileCount: 1,
        createdAt: file.created_at,
      });
    }
  }

  return Array.from(folderMap.values()).sort((a, b) => b.fileCount - a.fileCount);
}

export function moveFile(fileId: string, chatId: string, targetFolder: string): boolean {
  const db = getDatabase();
  const files = db.getFiles(chatId);

  // Find the file in database
  const file = files.find((f: any) => f.file_id === fileId);

  if (!file) {
    return false;
  }

  // Update folder in database (requires new method)
  try {
    db.db.prepare(
      'UPDATE files SET folder = ? WHERE id = ? AND chat_id = ?'
    ).run(targetFolder, file.id, chatId);

    logger.info(`File ${fileId} moved to ${targetFolder}`);
    return true;
  } catch (error) {
    logger.error('Error moving file', { error });
    return false;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

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
