/**
 * Git Integration
 * Simple git commands for version control
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ prefix: 'Git' });
const execAsync = promisify(exec);

const FILES_DIR = '/tmp/telegram-bot/files';

// =============================================================================
// Types
// =============================================================================

export interface GitStatus {
  branch: string;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

// =============================================================================
// Git Commands
// =============================================================================

export async function gitInit(chatId: string): Promise<boolean> {
  const userDir = path.join(FILES_DIR, chatId);

  try {
    // Create user directory if it doesn't exist
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    // Check if already a git repo
    const gitDir = path.join(userDir, '.git');
    if (fs.existsSync(gitDir)) {
      return false; // Already initialized
    }

    await execAsync('git init', { cwd: userDir });
    logger.info(`Git repository initialized for ${chatId}`);
    return true;
  } catch (error: any) {
    logger.error('Git init error', { error: error.message });
    return false;
  }
}

export async function gitStatus(chatId: string): Promise<GitStatus | null> {
  const userDir = path.join(FILES_DIR, chatId);
  const gitDir = path.join(userDir, '.git');

  if (!fs.existsSync(gitDir)) {
    return null; // Not a git repo
  }

  try {
    const { stdout } = await execAsync('git status --porcelain', { cwd: userDir });

    const status: GitStatus = {
      branch: await getCurrentBranch(chatId),
      modified: [],
      added: [],
      deleted: [],
      untracked: [],
    };

    const lines = stdout.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      const statusCode = line.substring(0, 2);
      const filePath = line.substring(3);

      if (statusCode.startsWith('M')) {
        status.modified.push(filePath);
      } else if (statusCode.startsWith('A')) {
        status.added.push(filePath);
      } else if (statusCode.startsWith('D')) {
        status.deleted.push(filePath);
      } else if (statusCode.startsWith('??')) {
        status.untracked.push(filePath);
      }
    }

    return status;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Git status error', { error: errorMessage });
    return null;
  }
}

export async function gitAdd(chatId: string, files?: string[]): Promise<boolean> {
  const userDir = path.join(FILES_DIR, chatId);

  try {
    const filesToAdd = files && files.length > 0 ? files.join(' ') : '.';
    await execAsync(`git add ${filesToAdd}`, { cwd: userDir });
    logger.info(`Git add: ${filesToAdd} for ${chatId}`);
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Git add error', { error: errorMessage });
    return false;
  }
}

export async function gitCommit(chatId: string, message: string): Promise<boolean> {
  const userDir = path.join(FILES_DIR, chatId);

  try {
    // Escape the message for shell
    const escapedMessage = message.replace(/'/g, "'\\''");
    await execAsync(`git commit -m '${escapedMessage}'`, { cwd: userDir });
    logger.info(`Git commit for ${chatId}: ${message}`);
    return true;
  } catch (error: any) {
    // If nothing to commit, that's okay
    if (error.message.includes('nothing to commit')) {
      return true;
    }
    logger.error('Git commit error', { error: error.message });
    return false;
  }
}

export async function gitLog(chatId: string, limit: number = 10): Promise<GitCommit[]> {
  const userDir = path.join(FILES_DIR, chatId);

  try {
    const { stdout } = await execAsync(
      `git log -${limit} --pretty=format:'%H|%an|%ad|%s' --date=short`,
      { cwd: userDir }
    );

    const commits: GitCommit[] = [];

    for (const line of stdout.trim().split('\n').filter(Boolean)) {
      const [hash, author, date, message] = line.split('|');
      commits.push({
        hash: hash.substring(0, 8),
        author,
        date,
        message,
      });
    }

    return commits;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Git log error', { error: errorMessage });
    return [];
  }
}

export async function gitPush(chatId: string, remote: string = 'origin', branch?: string): Promise<{ success: boolean; message: string }> {
  const userDir = path.join(FILES_DIR, chatId);

  try {
    const branchArg = branch || await getCurrentBranch(chatId);
    await execAsync(`git push ${remote} ${branchArg}`, { cwd: userDir });
    logger.info(`Git push for ${chatId} to ${remote}/${branchArg}`);
    return { success: true, message: `Gepusht naar ${remote}/${branchArg}` };
  } catch (error: any) {
    logger.error('Git push error', { error: error.message });
    return { success: false, message: error.message || 'Push failed' };
  }
}

export async function gitPull(chatId: string, remote: string = 'origin', branch?: string): Promise<{ success: boolean; message: string }> {
  const userDir = path.join(FILES_DIR, chatId);

  try {
    const branchArg = branch || await getCurrentBranch(chatId);
    const { stdout } = await execAsync(`git pull ${remote} ${branchArg}`, { cwd: userDir });
    logger.info(`Git pull for ${chatId} from ${remote}/${branchArg}`);
    return { success: true, message: stdout.trim() || `Gepulled van ${remote}/${branchArg}` };
  } catch (error: any) {
    logger.error('Git pull error', { error: error.message });
    return { success: false, message: error.message || 'Pull failed' };
  }
}

export async function gitClone(chatId: string, url: string): Promise<{ success: boolean; message: string }> {
  const userDir = path.join(FILES_DIR, chatId);

  try {
    // Check if directory is empty or doesn't exist
    if (fs.existsSync(userDir)) {
      const files = fs.readdirSync(userDir);
      if (files.length > 0 && files.some(f => f !== '.git')) {
        return { success: false, message: 'Directory niet leeg. Gebruik een lege directory.' };
      }
    } else {
      fs.mkdirSync(userDir, { recursive: true });
    }

    await execAsync(`git clone ${url} .`, { cwd: userDir });
    logger.info(`Git clone for ${chatId} from ${url}`);
    return { success: true, message: `Repository gekloond van ${url}` };
  } catch (error: any) {
    logger.error('Git clone error', { error: error.message });
    return { success: false, message: error.message || 'Clone failed' };
  }
}

export async function gitRemote(chatId: string, action: 'add' | 'remove' | 'list', name?: string, url?: string): Promise<{ success: boolean; message: string; remotes?: string[] }> {
  const userDir = path.join(FILES_DIR, chatId);

  try {
    if (action === 'list') {
      const { stdout } = await execAsync('git remote -v', { cwd: userDir });
      const remotes = stdout.trim().split('\n').filter(Boolean);
      return { success: true, message: 'Remotes opgehaald', remotes };
    } else if (action === 'add' && name && url) {
      await execAsync(`git remote add ${name} ${url}`, { cwd: userDir });
      logger.info(`Git remote add for ${chatId}: ${name} -> ${url}`);
      return { success: true, message: `Remote '${name}' toegevoegd` };
    } else if (action === 'remove' && name) {
      await execAsync(`git remote remove ${name}`, { cwd: userDir });
      logger.info(`Git remote remove for ${chatId}: ${name}`);
      return { success: true, message: `Remote '${name}' verwijderd` };
    }
    return { success: false, message: 'Ongeldige remote actie' };
  } catch (error: any) {
    logger.error('Git remote error', { error: error.message });
    return { success: false, message: error.message || 'Remote actie failed' };
  }
}

export async function gitBranch(chatId: string, action: 'list' | 'create' | 'delete' | 'switch', branchName?: string): Promise<{ success: boolean; message: string; branches?: string[] }> {
  const userDir = path.join(FILES_DIR, chatId);

  try {
    if (action === 'list') {
      const { stdout } = await execAsync('git branch', { cwd: userDir });
      const branches = stdout.trim().split('\n').map(b => b.trim()).filter(Boolean);
      return { success: true, message: 'Branches opgehaald', branches };
    } else if (action === 'create' && branchName) {
      await execAsync(`git branch ${branchName}`, { cwd: userDir });
      logger.info(`Git branch create for ${chatId}: ${branchName}`);
      return { success: true, message: `Branch '${branchName}' aangemaakt` };
    } else if (action === 'delete' && branchName) {
      await execAsync(`git branch -d ${branchName}`, { cwd: userDir });
      logger.info(`Git branch delete for ${chatId}: ${branchName}`);
      return { success: true, message: `Branch '${branchName}' verwijderd` };
    } else if (action === 'switch' && branchName) {
      await execAsync(`git checkout ${branchName}`, { cwd: userDir });
      logger.info(`Git branch switch for ${chatId}: ${branchName}`);
      return { success: true, message: `Geswitched naar branch '${branchName}'` };
    }
    return { success: false, message: 'Ongeldige branch actie' };
  } catch (error: any) {
    logger.error('Git branch error', { error: error.message });
    return { success: false, message: error.message || 'Branch actie failed' };
  }
}

export async function gitIsRepo(chatId: string): Promise<boolean> {
  const userDir = path.join(FILES_DIR, chatId);
  const gitDir = path.join(userDir, '.git');
  return fs.existsSync(gitDir);
}

// =============================================================================
// Helper Functions
// =============================================================================

async function getCurrentBranch(chatId: string): Promise<string> {
  const userDir = path.join(FILES_DIR, chatId);

  try {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: userDir });
    return stdout.trim() || 'main';
  } catch {
    return 'main';
  }
}

export function formatGitStatus(status: GitStatus): string {
  let text = `📁 *Git Status*\n`;
  text += `🌿 Branch: \`${status.branch}\`\n\n`;

  if (status.modified.length > 0) {
    text += `🟡 *Modified* (${status.modified.length}):\n`;
    text += status.modified.map(f => `  ~ ${f}`).join('\n') + '\n\n';
  }

  if (status.added.length > 0) {
    text += `🟢 *Added* (${status.added.length}):\n`;
    text += status.added.map(f => `  + ${f}`).join('\n') + '\n\n';
  }

  if (status.deleted.length > 0) {
    text += `🔴 *Deleted* (${status.deleted.length}):\n`;
    text += status.deleted.map(f => `  - ${f}`).join('\n') + '\n\n';
  }

  if (status.untracked.length > 0) {
    text += `⚪ *Untracked* (${status.untracked.length}):\n`;
    text += status.untracked.map(f => `  ? ${f}`).join('\n') + '\n\n';
  }

  if (status.modified.length === 0 && status.added.length === 0 &&
      status.deleted.length === 0 && status.untracked.length === 0) {
    text += `✅ Working directory clean\n`;
  }

  return text;
}

export function formatGitLog(commits: GitCommit[]): string {
  if (commits.length === 0) {
    return '📋 Geen commits gevonden.\n';
  }

  let text = `📋 *Git Log*\n\n`;

  for (const commit of commits) {
    text += `\`${commit.hash}\` *${commit.author}* - ${commit.date}\n`;
    text += `   ${commit.message}\n\n`;
  }

  return text;
}
