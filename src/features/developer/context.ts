/**
 * Developer Context Manager
 * Manages project context and file operations for coding via Telegram
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../../utils/logger';
import type {
  ProjectContext,
  DevSession,
  FileInfo,
  PatchInfo,
} from './types';
import { DEFAULT_DEV_SETTINGS } from './types';

const logger = createLogger({ prefix: 'DevContext' });

// =============================================================================
// Session Storage
// =============================================================================

const sessions: Map<string, DevSession> = new Map();

// =============================================================================
// Session Management
// =============================================================================

export function getDevSession(chatId: string): DevSession {
  let session = sessions.get(chatId);
  if (!session) {
    session = createDevSession(chatId);
    sessions.set(chatId, session);
  }
  return session;
}

export function createDevSession(chatId: string): DevSession {
  return {
    chatId,
    projectContext: null,
    mode: 'chat',
    history: [],
    settings: { ...DEFAULT_DEV_SETTINGS },
  };
}

export function clearDevSession(chatId: string): void {
  sessions.delete(chatId);
}

export function setProjectContext(chatId: string, rootPath: string): ProjectContext {
  const session = getDevSession(chatId);
  
  const projectName = path.basename(rootPath);
  
  session.projectContext = {
    rootPath,
    name: projectName,
    focusedFiles: [],
    fileCache: new Map(),
    pendingPatches: [],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
  
  logger.info(`Project context set for ${chatId}: ${rootPath}`);
  return session.projectContext;
}

export function getProjectContext(chatId: string): ProjectContext | null {
  const session = getDevSession(chatId);
  return session.projectContext;
}

// =============================================================================
// File Operations
// =============================================================================

export function listFiles(
  rootPath: string,
  relativePath: string = '',
  options: { recursive?: boolean; maxDepth?: number; excludePatterns?: string[] } = {}
): FileInfo[] {
  const { recursive = false, maxDepth = 3, excludePatterns = [] } = options;
  const fullPath = path.join(rootPath, relativePath);
  
  if (!fs.existsSync(fullPath)) {
    return [];
  }
  
  const results: FileInfo[] = [];
  
  function scanDir(dirPath: string, depth: number): void {
    if (depth > maxDepth) return;
    
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const relPath = path.relative(rootPath, entryPath);
        
        // Check exclude patterns
        if (excludePatterns.some(p => relPath.includes(p) || entry.name.includes(p))) {
          continue;
        }
        
        const stat = fs.statSync(entryPath);
        
        results.push({
          path: relPath,
          name: entry.name,
          isDirectory: entry.isDirectory(),
          size: entry.isFile() ? stat.size : undefined,
          modifiedAt: stat.mtime,
        });
        
        if (recursive && entry.isDirectory()) {
          scanDir(entryPath, depth + 1);
        }
      }
    } catch (error) {
      logger.warn(`Failed to scan directory: ${dirPath}`, { error });
    }
  }
  
  scanDir(fullPath, 0);
  return results;
}

export function readFile(rootPath: string, relativePath: string): string | null {
  const fullPath = path.join(rootPath, relativePath);
  
  try {
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    
    const stat = fs.statSync(fullPath);
    if (stat.size > 500 * 1024) {
      // 500KB limit
      return `[Bestand te groot: ${Math.round(stat.size / 1024)}KB - max 500KB]`;
    }
    
    return fs.readFileSync(fullPath, 'utf-8');
  } catch (error) {
    logger.error(`Failed to read file: ${fullPath}`, { error });
    return null;
  }
}

export function writeFile(rootPath: string, relativePath: string, content: string): boolean {
  const fullPath = path.join(rootPath, relativePath);
  
  try {
    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, content, 'utf-8');
    logger.info(`File written: ${fullPath}`);
    return true;
  } catch (error) {
    logger.error(`Failed to write file: ${fullPath}`, { error });
    return false;
  }
}

export function fileExists(rootPath: string, relativePath: string): boolean {
  const fullPath = path.join(rootPath, relativePath);
  return fs.existsSync(fullPath);
}

export function getFileStats(rootPath: string, relativePath: string): fs.Stats | null {
  const fullPath = path.join(rootPath, relativePath);
  try {
    return fs.statSync(fullPath);
  } catch {
    return null;
  }
}

// =============================================================================
// Focused Files Management
// =============================================================================

export function addFocusedFile(chatId: string, filePath: string): boolean {
  const ctx = getProjectContext(chatId);
  if (!ctx) return false;
  
  if (!ctx.focusedFiles.includes(filePath)) {
    ctx.focusedFiles.push(filePath);
    ctx.lastActivityAt = Date.now();
  }
  return true;
}

export function removeFocusedFile(chatId: string, filePath: string): boolean {
  const ctx = getProjectContext(chatId);
  if (!ctx) return false;
  
  const index = ctx.focusedFiles.indexOf(filePath);
  if (index > -1) {
    ctx.focusedFiles.splice(index, 1);
    ctx.lastActivityAt = Date.now();
    return true;
  }
  return false;
}

export function clearFocusedFiles(chatId: string): void {
  const ctx = getProjectContext(chatId);
  if (ctx) {
    ctx.focusedFiles = [];
    ctx.lastActivityAt = Date.now();
  }
}

export function getFocusedFilesContent(chatId: string): Map<string, string> {
  const ctx = getProjectContext(chatId);
  if (!ctx) return new Map();
  
  const contents = new Map<string, string>();
  
  for (const filePath of ctx.focusedFiles) {
    const content = readFile(ctx.rootPath, filePath);
    if (content) {
      contents.set(filePath, content);
    }
  }
  
  return contents;
}

// =============================================================================
// Patch Management
// =============================================================================

let patchCounter = 0;

export function createPatch(
  chatId: string,
  filePath: string,
  originalContent: string,
  patchedContent: string,
  description: string
): PatchInfo | null {
  const ctx = getProjectContext(chatId);
  if (!ctx) return null;
  
  const patch: PatchInfo = {
    id: `patch_${++patchCounter}_${Date.now()}`,
    filePath,
    originalContent,
    patchedContent,
    diff: generateSimpleDiff(originalContent, patchedContent),
    description,
    createdAt: Date.now(),
    status: 'pending',
  };
  
  ctx.pendingPatches.push(patch);
  ctx.lastActivityAt = Date.now();
  
  logger.info(`Patch created: ${patch.id} for ${filePath}`);
  return patch;
}

export function getPendingPatches(chatId: string): PatchInfo[] {
  const ctx = getProjectContext(chatId);
  if (!ctx) return [];
  return ctx.pendingPatches.filter(p => p.status === 'pending');
}

export function applyPatch(chatId: string, patchId: string): boolean {
  const ctx = getProjectContext(chatId);
  if (!ctx) return false;
  
  const patch = ctx.pendingPatches.find(p => p.id === patchId);
  if (!patch || patch.status !== 'pending') return false;
  
  const success = writeFile(ctx.rootPath, patch.filePath, patch.patchedContent);
  if (success) {
    patch.status = 'applied';
    ctx.lastActivityAt = Date.now();
    logger.info(`Patch applied: ${patchId}`);
  }
  
  return success;
}

export function rejectPatch(chatId: string, patchId: string): boolean {
  const ctx = getProjectContext(chatId);
  if (!ctx) return false;
  
  const patch = ctx.pendingPatches.find(p => p.id === patchId);
  if (!patch || patch.status !== 'pending') return false;
  
  patch.status = 'rejected';
  ctx.lastActivityAt = Date.now();
  logger.info(`Patch rejected: ${patchId}`);
  
  return true;
}

export function applyAllPatches(chatId: string): { applied: number; failed: number } {
  const pending = getPendingPatches(chatId);
  let applied = 0;
  let failed = 0;
  
  for (const patch of pending) {
    if (applyPatch(chatId, patch.id)) {
      applied++;
    } else {
      failed++;
    }
  }
  
  return { applied, failed };
}

// =============================================================================
// Diff Generation
// =============================================================================

function generateSimpleDiff(original: string, modified: string): string {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  const diff: string[] = [];
  let inChange = false;
  
  const maxLen = Math.max(originalLines.length, modifiedLines.length);
  
  for (let i = 0; i < maxLen; i++) {
    const origLine = originalLines[i];
    const modLine = modifiedLines[i];
    
    if (origLine === modLine) {
      if (inChange) {
        diff.push('...');
        inChange = false;
      }
    } else {
      inChange = true;
      if (origLine !== undefined && modLine !== undefined) {
        diff.push(`-${i + 1}: ${origLine}`);
        diff.push(`+${i + 1}: ${modLine}`);
      } else if (origLine !== undefined) {
        diff.push(`-${i + 1}: ${origLine}`);
      } else if (modLine !== undefined) {
        diff.push(`+${i + 1}: ${modLine}`);
      }
    }
  }
  
  return diff.join('\n');
}

// =============================================================================
// Context Summary for LLM
// =============================================================================

export function getContextSummary(chatId: string): string {
  const ctx = getProjectContext(chatId);
  if (!ctx) {
    return 'Geen project context. Gebruik /project <pad> om een project te openen.';
  }
  
  const lines: string[] = [
    `📁 Project: ${ctx.name}`,
    `📍 Pad: ${ctx.rootPath}`,
    `📎 Focus bestanden: ${ctx.focusedFiles.length}`,
    `📝 Pending patches: ${getPendingPatches(chatId).length}`,
  ];
  
  if (ctx.focusedFiles.length > 0) {
    lines.push('', '📎 Gefocuste bestanden:');
    for (const f of ctx.focusedFiles.slice(0, 10)) {
      lines.push(`  • ${f}`);
    }
    if (ctx.focusedFiles.length > 10) {
      lines.push(`  ... en ${ctx.focusedFiles.length - 10} meer`);
    }
  }
  
  return lines.join('\n');
}

export function buildLLMContext(chatId: string): string {
  const ctx = getProjectContext(chatId);
  if (!ctx) return '';
  
  const parts: string[] = [
    `# Project Context`,
    `Project: ${ctx.name}`,
    `Root: ${ctx.rootPath}`,
    '',
  ];
  
  // Add focused file contents
  const contents = getFocusedFilesContent(chatId);
  if (contents.size > 0) {
    parts.push('# Focused Files', '');
    
    for (const [filePath, content] of contents) {
      const ext = path.extname(filePath).slice(1) || 'txt';
      parts.push(`## ${filePath}`);
      parts.push('```' + ext);
      parts.push(content);
      parts.push('```');
      parts.push('');
    }
  }
  
  // Add pending patches info
  const patches = getPendingPatches(chatId);
  if (patches.length > 0) {
    parts.push('# Pending Patches', '');
    for (const patch of patches) {
      parts.push(`- ${patch.id}: ${patch.filePath} - ${patch.description}`);
    }
    parts.push('');
  }
  
  return parts.join('\n');
}

// =============================================================================
// Cleanup
// =============================================================================

export function cleanupOldSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
  const now = Date.now();
  
  for (const [chatId, session] of sessions.entries()) {
    if (session.projectContext) {
      if (now - session.projectContext.lastActivityAt > maxAgeMs) {
        sessions.delete(chatId);
        logger.info(`Cleaned up old session: ${chatId}`);
      }
    }
  }
}

// Export default settings
export { DEFAULT_DEV_SETTINGS } from './types';
