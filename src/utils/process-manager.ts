/**
 * Process Manager
 * Zorgt voor single instance, graceful shutdown, en process cleanup
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { createLogger } from './logger';

const logger = createLogger({ prefix: 'ProcessManager' });

// File paths
const ROOT_DIR = process.cwd();
const LOCK_FILE = join(ROOT_DIR, '.bot.lock');
const PID_FILE = join(ROOT_DIR, '.bot.pid');
const STARTED_FILE = join(ROOT_DIR, '.bot.started');

// =============================================================================
// Types
// =============================================================================

export interface ProcessInfo {
  pid: number;
  startedAt: Date;
  version: string;
}

export interface LockResult {
  acquired: boolean;
  existingPid?: number;
  message: string;
}

// =============================================================================
// Process Detection
// =============================================================================

/**
 * Check if a process with given PID exists
 */
export function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0); // Signal 0 = just check if exists
    return true;
  } catch {
    return false;
  }
}

/**
 * Find all running bot processes (excluding current)
 */
export function findOtherBotProcesses(): number[] {
  try {
    const output = execSync(
      'ps aux | grep -E "node.*start\\.js|bun.*start|telegram-bot-plugin" | grep -v grep',
      { encoding: 'utf-8' }
    ).trim();
    
    if (!output) return [];
    
    const pids = output.split('\n')
      .map(line => {
        const parts = line.split(/\s+/);
        return parseInt(parts[1], 10);
      })
      .filter(pid => !isNaN(pid) && pid !== process.pid);
    
    return pids;
  } catch {
    return [];
  }
}

/**
 * Kill a process gracefully (SIGTERM first, then SIGKILL)
 */
export function killProcess(pid: number, force = false): boolean {
  try {
    if (force) {
      process.kill(pid, 'SIGKILL');
    } else {
      process.kill(pid, 'SIGTERM');
      
      // Wait a bit and check if still running
      setTimeout(() => {
        if (processExists(pid)) {
          try {
            process.kill(pid, 'SIGKILL');
          } catch {
            // Ignore
          }
        }
      }, 3000);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Kill all other bot processes
 */
export function killOtherBotProcesses(): number {
  const pids = findOtherBotProcesses();
  let killed = 0;
  
  for (const pid of pids) {
    logger.info(`Killing duplicate process: ${pid}`);
    if (killProcess(pid)) {
      killed++;
    }
  }
  
  return killed;
}

// =============================================================================
// Lock Management
// =============================================================================

/**
 * Read current lock file
 */
function readLockFile(): ProcessInfo | null {
  try {
    if (!existsSync(LOCK_FILE)) return null;
    
    const data = readFileSync(LOCK_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    
    return {
      pid: parsed.pid,
      startedAt: new Date(parsed.startedAt),
      version: parsed.version || 'unknown',
    };
  } catch {
    return null;
  }
}

/**
 * Write lock file
 */
function writeLockFile(info: ProcessInfo): void {
  writeFileSync(LOCK_FILE, JSON.stringify({
    pid: info.pid,
    startedAt: info.startedAt.toISOString(),
    version: info.version,
  }));
}

/**
 * Remove lock file
 */
function removeLockFile(): void {
  try {
    if (existsSync(LOCK_FILE)) {
      unlinkSync(LOCK_FILE);
    }
  } catch {
    // Ignore
  }
}

/**
 * Try to acquire process lock
 * - If no lock exists: acquire it
 * - If lock exists but process is dead: take over
 * - If lock exists and process is alive: fail or force
 */
export function acquireLock(options: { force?: boolean; version?: string } = {}): LockResult {
  const { force = false, version = '2.0.0' } = options;
  
  const existingLock = readLockFile();
  
  if (existingLock) {
    const processAlive = processExists(existingLock.pid);
    
    if (processAlive) {
      if (force) {
        // Kill existing process and take over
        logger.warn(`Force killing existing process: ${existingLock.pid}`);
        killProcess(existingLock.pid, true);
        
        // Wait a bit for process to die
        setTimeout(() => {}, 500);
      } else {
        return {
          acquired: false,
          existingPid: existingLock.pid,
          message: `Another bot instance is running (PID: ${existingLock.pid}). Use --force to override.`,
        };
      }
    } else {
      // Stale lock - process is dead
      logger.info(`Removing stale lock from dead process: ${existingLock.pid}`);
    }
  }
  
  // Kill any other bot processes we find
  const killed = killOtherBotProcesses();
  if (killed > 0) {
    logger.info(`Killed ${killed} duplicate process(es)`);
  }
  
  // Create new lock
  const lockInfo: ProcessInfo = {
    pid: process.pid,
    startedAt: new Date(),
    version,
  };
  
  writeLockFile(lockInfo);
  
  // Also write simple PID file for scripts
  writeFileSync(PID_FILE, String(process.pid));
  writeFileSync(STARTED_FILE, new Date().toISOString());
  
  return {
    acquired: true,
    message: `Lock acquired (PID: ${process.pid})`,
  };
}

/**
 * Release the process lock
 */
export function releaseLock(): void {
  const existingLock = readLockFile();
  
  // Only release if we own the lock
  if (existingLock && existingLock.pid === process.pid) {
    removeLockFile();
    
    try {
      if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
      if (existsSync(STARTED_FILE)) unlinkSync(STARTED_FILE);
    } catch {
      // Ignore
    }
    
    logger.info('Lock released');
  }
}

/**
 * Get current lock info (if any)
 */
export function getLockInfo(): ProcessInfo | null {
  return readLockFile();
}

// =============================================================================
// Graceful Shutdown
// =============================================================================

type ShutdownHandler = () => Promise<void>;
const shutdownHandlers: ShutdownHandler[] = [];
let isShuttingDown = false;

/**
 * Register a shutdown handler
 */
export function onShutdown(handler: ShutdownHandler): void {
  shutdownHandlers.push(handler);
}

/**
 * Execute graceful shutdown
 */
async function executeShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  // Execute all shutdown handlers
  for (const handler of shutdownHandlers) {
    try {
      await handler();
    } catch (error) {
      logger.error('Shutdown handler error', { error });
    }
  }
  
  // Release lock
  releaseLock();
  
  logger.info('Shutdown complete');
  process.exit(0);
}

/**
 * Setup graceful shutdown handlers
 */
export function setupGracefulShutdown(): void {
  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => executeShutdown('SIGINT'));
  
  // Handle SIGTERM (kill)
  process.on('SIGTERM', () => executeShutdown('SIGTERM'));
  
  // Handle SIGHUP (terminal closed)
  process.on('SIGHUP', () => executeShutdown('SIGHUP'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    executeShutdown('uncaughtException');
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
    executeShutdown('unhandledRejection');
  });
  
  logger.info('Graceful shutdown handlers registered');
}

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize process manager
 * Call this at the very start of your application
 */
export function initProcessManager(options: { 
  force?: boolean; 
  version?: string;
  autoSetupShutdown?: boolean;
} = {}): boolean {
  const { force = false, version = '2.0.0', autoSetupShutdown = true } = options;
  
  logger.info(`Initializing process manager (PID: ${process.pid})`);
  
  // Try to acquire lock
  const lockResult = acquireLock({ force, version });
  
  if (!lockResult.acquired) {
    logger.error(lockResult.message);
    return false;
  }
  
  logger.info(lockResult.message);
  
  // Setup shutdown handlers
  if (autoSetupShutdown) {
    setupGracefulShutdown();
  }
  
  return true;
}

// =============================================================================
// Exports
// =============================================================================

export default {
  initProcessManager,
  acquireLock,
  releaseLock,
  getLockInfo,
  processExists,
  findOtherBotProcesses,
  killOtherBotProcesses,
  killProcess,
  onShutdown,
  setupGracefulShutdown,
};
