/**
 * Files Feature - File upload/download management with folders
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDatabase } from '../../database';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ prefix: 'Files' });

const FILES_DIR = process.env.FILES_DIR || '/tmp/telegram-bot/files';

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

export function initFilesDir(chatId: string): void {
  const chatDir = getChatFilesDir(chatId);
  if (!fs.existsSync(chatDir)) {
    fs.mkdirSync(chatDir, { recursive: true });
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
  initFilesDir(chatId);

  const id = Date.now().toString() + Math.random().toString(36).substring(2);
  const safeName = path.basename(fileName);
  const ext = path.extname(safeName);
  const normalizedFolder = normalizeFolder(folder);
  const chatDir = getChatFilesDir(chatId);
  const folderPath = normalizedFolder ? path.join(chatDir, normalizedFolder) : chatDir;

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const filePath = path.join(folderPath, `${id}${ext}`);

  // Create folder if needed
  fs.writeFileSync(filePath, data);

  const file: StoredFile = {
    id,
    chatId,
    fileName: safeName,
    fileSize: data.length,
    mimeType,
    filePath,
    folder: normalizedFolder,
    uploadedAt: Date.now(),
  };

  // Save to database
  const db = getDatabase();
  db.addFileWithPath(chatId, id, safeName, data.length, mimeType, normalizedFolder, filePath);

  // Also keep in memory cache
  filesMap.set(id, file);

  logger.info(`File saved: ${fileName} (${folder || 'root'})`);
  return file;
}

export function getFile(id: string, chatId?: string): StoredFile | undefined {
  const cached = filesMap.get(id);
  if (cached) {
    return cached;
  }

  if (!chatId) {
    return undefined;
  }

  const db = getDatabase();
  const record = db.getFileByFileId(chatId, id);
  if (!record) {
    return undefined;
  }

  const filePath = resolveFilePath(record.chat_id, record.file_id, record.folder || undefined, record.file_path || undefined);
  return {
    id: record.file_id,
    chatId: record.chat_id,
    fileName: record.file_name,
    fileSize: record.file_size || 0,
    mimeType: record.mime_type || '',
    filePath: filePath || '',
    folder: record.folder || undefined,
    uploadedAt: record.created_at,
  };
}

export function getUserFiles(chatId: string, folder?: string): StoredFile[] {
  const db = getDatabase();
  const dbFiles = db.getFiles(chatId, folder);

  return dbFiles.map((f) => ({
    id: f.file_id,
    chatId: f.chat_id,
    fileName: f.file_name,
    fileSize: f.file_size || 0,
    mimeType: f.mime_type || '',
    filePath: f.file_path || '',
    folder: f.folder || undefined,
    uploadedAt: f.created_at,
  }));
}

export function deleteFile(id: string, chatId: string): boolean {
  const db = getDatabase();
  const file = filesMap.get(id);
  const record = db.getFileByFileId(chatId, id);
  const filePath = file?.filePath
    || resolveFilePath(chatId, id, record?.folder || undefined, record?.file_path || undefined);

  if (filePath) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Ignore file system errors; DB cleanup still proceeds.
    }
  }
  filesMap.delete(id);

  // Delete from database (by file_id)
  return db.deleteFileByFileId(chatId, id);
}

// =============================================================================
// Folder Operations
// =============================================================================

export function createFolder(chatId: string, folderName: string): boolean {
  // Validate folder name
  if (!/^[a-zA-Z0-9_-]+$/.test(folderName)) {
    return false;
  }

  initFilesDir(chatId);
  const chatDir = getChatFilesDir(chatId);
  const folderPath = path.join(chatDir, folderName);

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
  const normalizedFolder = normalizeFolder(targetFolder);

  // Find the file in database
  const file = files.find((f) => f.file_id === fileId);

  if (!file) {
    return false;
  }

  try {
    const currentPath = resolveFilePath(chatId, fileId, file.folder || undefined, file.file_path || undefined);
    let newPath = currentPath;

    if (currentPath) {
      const fileName = path.basename(currentPath);
      const chatDir = getChatFilesDir(chatId);
      const targetDir = normalizedFolder ? path.join(chatDir, normalizedFolder) : chatDir;
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      newPath = path.join(targetDir, fileName);
      if (currentPath !== newPath) {
        fs.renameSync(currentPath, newPath);
      }
    }

    db.db.prepare(
      'UPDATE files SET folder = ?, file_path = ? WHERE id = ? AND chat_id = ?'
    ).run(normalizedFolder || null, newPath || null, file.id, chatId);

    logger.info(`File ${fileId} moved to ${normalizedFolder || 'root'}`);
    return true;
  } catch (error) {
    logger.error('Error moving file', { error });
    return false;
  }
}

function getChatFilesDir(chatId: string): string {
  return path.join(FILES_DIR, chatId);
}

function normalizeFolder(folder?: string): string | undefined {
  if (!folder) return undefined;
  const trimmed = folder.trim();
  if (!trimmed || trimmed.toLowerCase() === 'root') return undefined;
  // Prevent path traversal: only allow simple folder names.
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function resolveFilePath(
  chatId: string,
  fileId: string,
  folder?: string,
  filePath?: string
): string | undefined {
  if (filePath) {
    const chatDir = getChatFilesDir(chatId);
    const resolved = path.resolve(filePath);
    const base = path.resolve(chatDir);
    const baseWithSep = base.endsWith(path.sep) ? base : `${base}${path.sep}`;
    if (resolved.startsWith(baseWithSep)) {
      return resolved;
    }
    // Ignore unsafe persisted paths; fall back to deterministic lookup.
  }
  const chatDir = getChatFilesDir(chatId);
  const candidates: string[] = [];
  if (folder) {
    candidates.push(path.join(chatDir, folder));
  }
  candidates.push(chatDir);

  for (const base of candidates) {
    const resolved = findFileByPrefix(base, fileId);
    if (resolved) return resolved;
  }

  // Fallback: scan subdirectories in chat dir
  return findFileInSubdirs(chatDir, fileId);
}

function findFileByPrefix(dirPath: string, prefix: string): string | undefined {
  if (!fs.existsSync(dirPath)) return undefined;
  const entries = fs.readdirSync(dirPath);
  const match = entries.find((entry) => entry.startsWith(prefix));
  if (!match) return undefined;
  return path.join(dirPath, match);
}

function findFileInSubdirs(dirPath: string, prefix: string): string | undefined {
  if (!fs.existsSync(dirPath)) return undefined;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = findFileByPrefix(path.join(dirPath, entry.name), prefix);
    if (candidate) return candidate;
  }
  return undefined;
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
