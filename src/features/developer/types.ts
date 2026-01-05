/**
 * Developer Feature Types
 */

export interface ProjectContext {
  /** Project root path */
  rootPath: string;
  /** Project name */
  name: string;
  /** Currently focused files */
  focusedFiles: string[];
  /** Recent file contents cache */
  fileCache: Map<string, { content: string; cachedAt: number }>;
  /** Pending patches to apply */
  pendingPatches: PatchInfo[];
  /** Session created at */
  createdAt: number;
  /** Last activity */
  lastActivityAt: number;
}

export interface PatchInfo {
  id: string;
  filePath: string;
  originalContent: string;
  patchedContent: string;
  diff: string;
  description: string;
  createdAt: number;
  status: 'pending' | 'applied' | 'rejected';
}

export interface FileInfo {
  path: string;
  name: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: Date;
}

export interface CodeTask {
  id: string;
  chatId: string;
  instruction: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export interface DevSession {
  chatId: string;
  projectContext: ProjectContext | null;
  mode: 'chat' | 'code' | 'review' | 'debug';
  history: DevHistoryItem[];
  settings: DevSettings;
}

export interface DevHistoryItem {
  type: 'command' | 'response' | 'file' | 'patch';
  content: string;
  timestamp: number;
}

export interface DevSettings {
  autoApply: boolean;
  confirmPatches: boolean;
  maxFileSize: number;
  excludePatterns: string[];
  language: 'nl' | 'en';
}

export const DEFAULT_DEV_SETTINGS: DevSettings = {
  autoApply: false,
  confirmPatches: true,
  maxFileSize: 100 * 1024, // 100KB
  excludePatterns: ['node_modules', '.git', 'dist', 'build', '.env'],
  language: 'nl',
};

export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}
