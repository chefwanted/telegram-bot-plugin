#!/usr/bin/env node
/**
 * Bot Starter Script
 * Met single-instance enforcement en graceful shutdown
 */

require('dotenv/config');
const { createPluginFromEnv } = require('./dist/index.js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// =============================================================================
// Configuration
// =============================================================================

const ROOT_DIR = process.cwd();
const LOCK_FILE = path.join(ROOT_DIR, '.bot.lock');
const PID_FILE = path.join(ROOT_DIR, '.bot.pid');
const VERSION = require('./package.json').version;

// =============================================================================
// Process Management
// =============================================================================

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function findOtherBotProcesses() {
  try {
    const output = execSync(
      'ps aux | grep -E "node.*start\\.js|bun.*start" | grep -v grep',
      { encoding: 'utf-8' }
    ).trim();
    
    if (!output) return [];
    
    return output.split('\n')
      .map(line => {
        const parts = line.split(/\s+/);
        return parseInt(parts[1], 10);
      })
      .filter(pid => !isNaN(pid) && pid !== process.pid);
  } catch {
    return [];
  }
}

function killProcess(pid) {
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
      return true;
    } catch {
      return false;
    }
  }
}

function acquireLock() {
  // Check existing lock
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8'));
      const existingPid = lockData.pid;
      
      if (processExists(existingPid)) {
        // Check if --force flag is passed
        if (process.argv.includes('--force') || process.argv.includes('-f')) {
          console.log(`⚠️  Force killing existing process (PID: ${existingPid})...`);
          killProcess(existingPid);
          // Wait a bit
          const start = Date.now();
          while (Date.now() - start < 2000 && processExists(existingPid)) {
            // Busy wait
          }
        } else {
          console.error(`❌ Another bot instance is already running (PID: ${existingPid})`);
          console.error('   Use --force to kill and replace it.');
          process.exit(1);
        }
      } else {
        console.log(`🧹 Removing stale lock from dead process (PID: ${existingPid})`);
      }
    } catch {
      // Invalid lock file, remove it
      fs.unlinkSync(LOCK_FILE);
    }
  }
  
  // Kill any other bot processes
  const others = findOtherBotProcesses();
  if (others.length > 0) {
    console.log(`🧹 Found ${others.length} other bot process(es), killing them...`);
    for (const pid of others) {
      if (killProcess(pid)) {
        console.log(`   Killed PID ${pid}`);
      }
    }
  }
  
  // Create lock
  const lockData = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    version: VERSION,
  };
  
  fs.writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2));
  fs.writeFileSync(PID_FILE, String(process.pid));
  
  console.log(`🔒 Lock acquired (PID: ${process.pid})`);
  return true;
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8'));
      if (lockData.pid === process.pid) {
        fs.unlinkSync(LOCK_FILE);
      }
    }
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch {
    // Ignore cleanup errors
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('');
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│          Telegram Bot Plugin v' + VERSION.padEnd(13) + '    │');
  console.log('└─────────────────────────────────────────────────┘');
  console.log('');
  
  // Acquire lock (enforces single instance)
  if (!acquireLock()) {
    process.exit(1);
  }
  
  // Create plugin
  const plugin = createPluginFromEnv();
  
  // Graceful shutdown handler
  let isShuttingDown = false;
  
  async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log('');
    console.log(`🛑 Received ${signal}, shutting down gracefully...`);
    
    try {
      await plugin.stop();
      console.log('✅ Bot stopped successfully');
    } catch (err) {
      console.error('⚠️  Error during shutdown:', err.message);
    }
    
    releaseLock();
    console.log('🔓 Lock released');
    console.log('');
    console.log('👋 Goodbye!');
    process.exit(0);
  }
  
  // Register shutdown handlers
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));
  
  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught exception:', err);
    shutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled rejection:', reason);
    shutdown('unhandledRejection');
  });
  
  // Start bot
  try {
    await plugin.start();
    
    console.log('');
    console.log('✅ Bot started successfully!');
    console.log('📱 Send /start to your bot on Telegram');
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');
  } catch (err) {
    console.error('');
    console.error('❌ Failed to start bot:', err.message);
    console.error('');
    releaseLock();
    process.exit(1);
  }
}

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  releaseLock();
  process.exit(1);
});
