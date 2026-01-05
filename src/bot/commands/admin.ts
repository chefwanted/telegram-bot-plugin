/**
 * Admin Commands
 * Beheer de bot via Telegram - restart, reload, status, kill processen
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import { execSync, exec } from 'child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

// Admin user IDs - voeg hier je Telegram user ID toe
const ADMIN_USER_IDS: number[] = [
  // Voeg admin user IDs hier toe
  // Bijvoorbeeld: 123456789
];

// Lock file path voor single instance
const LOCK_FILE = join(process.cwd(), '.bot.lock');
const PID_FILE = join(process.cwd(), '.bot.pid');

// =============================================================================
// Types
// =============================================================================

interface SystemInfo {
  hostname: string;
  platform: string;
  uptime: number;
  memory: {
    total: number;
    free: number;
    used: number;
    percentage: number;
  };
  cpu: {
    load: number[];
  };
  processInfo: {
    pid: number;
    uptime: number;
    memory: number;
    cwd: string;
  };
}

interface BotProcess {
  pid: number;
  command: string;
  user: string;
  startTime: string;
}

// =============================================================================
// Admin Check
// =============================================================================

export function isAdmin(userId: number): boolean {
  // Als geen admins geconfigureerd, sta alle users toe (voor development)
  if (ADMIN_USER_IDS.length === 0) {
    return true;
  }
  return ADMIN_USER_IDS.includes(userId);
}

export function addAdmin(userId: number): void {
  if (!ADMIN_USER_IDS.includes(userId)) {
    ADMIN_USER_IDS.push(userId);
  }
}

export function removeAdmin(userId: number): void {
  const index = ADMIN_USER_IDS.indexOf(userId);
  if (index > -1) {
    ADMIN_USER_IDS.splice(index, 1);
  }
}

export function getAdminIds(): number[] {
  return [...ADMIN_USER_IDS];
}

// =============================================================================
// System Functions
// =============================================================================

function getSystemInfo(): SystemInfo {
  const os = require('os');
  
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  return {
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.release()}`,
    uptime: os.uptime(),
    memory: {
      total: Math.round(totalMem / 1024 / 1024),
      free: Math.round(freeMem / 1024 / 1024),
      used: Math.round(usedMem / 1024 / 1024),
      percentage: Math.round((usedMem / totalMem) * 100),
    },
    cpu: {
      load: os.loadavg(),
    },
    processInfo: {
      pid: process.pid,
      uptime: process.uptime(),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      cwd: process.cwd(),
    },
  };
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

function findBotProcesses(): BotProcess[] {
  try {
    const output = execSync(
      'ps aux | grep -E "node.*start.js|bun.*start|telegram-bot" | grep -v grep',
      { encoding: 'utf-8' }
    ).trim();
    
    if (!output) return [];
    
    return output.split('\n').map(line => {
      const parts = line.split(/\s+/);
      return {
        user: parts[0],
        pid: parseInt(parts[1], 10),
        startTime: parts[8] || 'unknown',
        command: parts.slice(10).join(' '),
      };
    }).filter(p => p.pid !== process.pid); // Exclude current process
  } catch {
    return [];
  }
}

function killProcess(pid: number): boolean {
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch (error) {
    try {
      // Force kill if SIGTERM fails
      process.kill(pid, 'SIGKILL');
      return true;
    } catch {
      return false;
    }
  }
}

function killAllOtherBotProcesses(): number {
  const processes = findBotProcesses();
  let killed = 0;
  
  for (const proc of processes) {
    if (killProcess(proc.pid)) {
      killed++;
    }
  }
  
  return killed;
}

// =============================================================================
// Lock File Management
// =============================================================================

export function acquireLock(): boolean {
  try {
    // Check if lock file exists
    if (existsSync(LOCK_FILE)) {
      const lockData = readFileSync(LOCK_FILE, 'utf-8');
      const lockPid = parseInt(lockData.trim(), 10);
      
      // Check if process is still running
      try {
        process.kill(lockPid, 0); // Signal 0 = check if process exists
        // Process exists, lock is valid
        return false;
      } catch {
        // Process doesn't exist, stale lock - remove it
        unlinkSync(LOCK_FILE);
      }
    }
    
    // Create lock file with current PID
    writeFileSync(LOCK_FILE, String(process.pid));
    writeFileSync(PID_FILE, String(process.pid));
    
    return true;
  } catch (error) {
    console.error('Failed to acquire lock:', error);
    return false;
  }
}

export function releaseLock(): void {
  try {
    if (existsSync(LOCK_FILE)) {
      const lockData = readFileSync(LOCK_FILE, 'utf-8');
      const lockPid = parseInt(lockData.trim(), 10);
      
      // Only remove if we own the lock
      if (lockPid === process.pid) {
        unlinkSync(LOCK_FILE);
      }
    }
    
    if (existsSync(PID_FILE)) {
      unlinkSync(PID_FILE);
    }
  } catch {
    // Ignore errors on cleanup
  }
}

export function getCurrentLockPid(): number | null {
  try {
    if (existsSync(LOCK_FILE)) {
      const lockData = readFileSync(LOCK_FILE, 'utf-8');
      return parseInt(lockData.trim(), 10);
    }
  } catch {
    // Ignore
  }
  return null;
}

// =============================================================================
// Git Functions
// =============================================================================

function getGitStatus(): { branch: string; commit: string; dirty: boolean; behind: number; ahead: number } {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    const dirty = status.length > 0;
    
    // Check how many commits behind/ahead
    let behind = 0;
    let ahead = 0;
    try {
      execSync('git fetch --quiet', { encoding: 'utf-8' });
      const behindOutput = execSync('git rev-list HEAD..@{upstream} --count', { encoding: 'utf-8' }).trim();
      const aheadOutput = execSync('git rev-list @{upstream}..HEAD --count', { encoding: 'utf-8' }).trim();
      behind = parseInt(behindOutput, 10) || 0;
      ahead = parseInt(aheadOutput, 10) || 0;
    } catch {
      // No upstream configured
    }
    
    return { branch, commit, dirty, behind, ahead };
  } catch {
    return { branch: 'unknown', commit: 'unknown', dirty: false, behind: 0, ahead: 0 };
  }
}

function gitPull(): { success: boolean; output: string } {
  try {
    const output = execSync('git pull --rebase', { encoding: 'utf-8' });
    return { success: true, output: output.trim() };
  } catch (error: any) {
    return { success: false, output: error.message || 'Pull failed' };
  }
}

function npmBuild(): { success: boolean; output: string } {
  try {
    const output = execSync('npm run build', { encoding: 'utf-8', cwd: process.cwd() });
    return { success: true, output: 'Build completed' };
  } catch (error: any) {
    return { success: false, output: error.message || 'Build failed' };
  }
}

// =============================================================================
// Admin Commands
// =============================================================================

export async function adminCommand(
  api: ApiMethods,
  message: Message,
  args: string[]
): Promise<void> {
  const chatId = message.chat.id;
  const userId = message.from?.id ?? 0;
  
  // Check admin permissions
  if (!isAdmin(userId)) {
    await api.sendText(chatId, '⛔ Je hebt geen admin rechten.');
    return;
  }
  
  if (args.length === 0) {
    await showAdminHelp(api, chatId);
    return;
  }
  
  const subCommand = args[0].toLowerCase();
  
  switch (subCommand) {
    case 'status':
    case 'info':
      await showSystemStatus(api, chatId);
      break;
      
    case 'processes':
    case 'ps':
      await showProcesses(api, chatId);
      break;
      
    case 'kill':
      await killBotProcess(api, chatId, args.slice(1));
      break;
      
    case 'killall':
    case 'clean':
      await killAllProcesses(api, chatId);
      break;
      
    case 'restart':
      await restartBot(api, chatId);
      break;
      
    case 'update':
      await updateBot(api, chatId);
      break;
      
    case 'pull':
      await pullCode(api, chatId);
      break;
      
    case 'build':
      await buildBot(api, chatId);
      break;
      
    case 'git':
      await showGitStatus(api, chatId);
      break;
      
    case 'env':
      await showEnvironment(api, chatId);
      break;
      
    case 'reload':
      await reloadConfig(api, chatId);
      break;
      
    case 'broadcast':
      await broadcastMessage(api, chatId, args.slice(1));
      break;
      
    case 'shutdown':
    case 'stop':
      await shutdownBot(api, chatId);
      break;
      
    case 'health':
      await healthCheck(api, chatId);
      break;
      
    case 'help':
    default:
      await showAdminHelp(api, chatId);
  }
}

// =============================================================================
// Command Implementations
// =============================================================================

async function showAdminHelp(api: ApiMethods, chatId: number): Promise<void> {
  const help = `
*🔐 Admin Commands*

*Systeem:*
/admin status - Systeem status
/admin health - Health check
/admin processes - Draaiende processen
/admin env - Environment info

*Proces Beheer:*
/admin kill <pid> - Kill specifiek proces
/admin killall - Kill alle andere instanties
/admin restart - Herstart de bot
/admin shutdown - Stop de bot

*Updates:*
/admin git - Git status
/admin pull - Git pull
/admin build - Rebuild TypeScript
/admin update - Pull + Build + Restart

*Overig:*
/admin reload - Herlaad configuratie
/admin broadcast <bericht> - Broadcast naar admins

━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Process ID: ${process.pid}_
  `.trim();
  
  await api.sendText(chatId, help, { parse_mode: 'Markdown' });
}

async function showSystemStatus(api: ApiMethods, chatId: number): Promise<void> {
  const info = getSystemInfo();
  const git = getGitStatus();
  
  const statusText = `
*🖥️ System Status*

*Server:*
• Hostname: \`${info.hostname}\`
• Platform: ${info.platform}
• Uptime: ${formatUptime(info.uptime)}

*Memory:*
• Used: ${info.memory.used} MB / ${info.memory.total} MB (${info.memory.percentage}%)
• Free: ${info.memory.free} MB

*CPU Load:*
• 1m: ${info.cpu.load[0].toFixed(2)}
• 5m: ${info.cpu.load[1].toFixed(2)}
• 15m: ${info.cpu.load[2].toFixed(2)}

*Bot Process:*
• PID: \`${info.processInfo.pid}\`
• Uptime: ${formatUptime(info.processInfo.uptime)}
• Memory: ${info.processInfo.memory} MB
• CWD: \`${info.processInfo.cwd}\`

*Git:*
• Branch: \`${git.branch}\`
• Commit: \`${git.commit}\`
• Status: ${git.dirty ? '⚠️ Uncommitted changes' : '✅ Clean'}
${git.behind > 0 ? `• Behind: ⬇️ ${git.behind} commits` : ''}
${git.ahead > 0 ? `• Ahead: ⬆️ ${git.ahead} commits` : ''}
  `.trim();
  
  await api.sendText(chatId, statusText, { parse_mode: 'Markdown' });
}

async function showProcesses(api: ApiMethods, chatId: number): Promise<void> {
  const processes = findBotProcesses();
  const currentPid = process.pid;
  
  let text = `*🔄 Bot Processen*\n\n`;
  text += `*Huidige instantie:* PID \`${currentPid}\` ✅\n\n`;
  
  if (processes.length === 0) {
    text += '✅ Geen andere bot instanties gevonden.';
  } else {
    text += `⚠️ *${processes.length} andere instantie(s) gevonden:*\n\n`;
    for (const proc of processes) {
      text += `• PID \`${proc.pid}\` - Started: ${proc.startTime}\n`;
      text += `  \`${proc.command.substring(0, 50)}...\`\n\n`;
    }
    text += '\nGebruik `/admin killall` om alle andere instanties te stoppen.';
  }
  
  await api.sendText(chatId, text, { parse_mode: 'Markdown' });
}

async function killBotProcess(api: ApiMethods, chatId: number, args: string[]): Promise<void> {
  if (args.length === 0) {
    await api.sendText(chatId, 'Gebruik: /admin kill <pid>');
    return;
  }
  
  const pid = parseInt(args[0], 10);
  
  if (isNaN(pid)) {
    await api.sendText(chatId, '❌ Ongeldige PID.');
    return;
  }
  
  if (pid === process.pid) {
    await api.sendText(chatId, '⚠️ Kan huidige instantie niet killen. Gebruik /admin shutdown.');
    return;
  }
  
  const success = killProcess(pid);
  
  if (success) {
    await api.sendText(chatId, `✅ Process ${pid} is gestopt.`);
  } else {
    await api.sendText(chatId, `❌ Kon process ${pid} niet stoppen.`);
  }
}

async function killAllProcesses(api: ApiMethods, chatId: number): Promise<void> {
  const msg = await api.sendText(chatId, '🔄 Stoppen van andere bot instanties...');
  
  const killed = killAllOtherBotProcesses();
  
  if (killed === 0) {
    await api.editMessageText({
      chat_id: chatId,
      message_id: msg.message_id,
      text: '✅ Geen andere instanties gevonden om te stoppen.',
    });
  } else {
    await api.editMessageText({
      chat_id: chatId,
      message_id: msg.message_id,
      text: `✅ ${killed} andere instantie(s) gestopt.`,
    });
  }
}

async function restartBot(api: ApiMethods, chatId: number): Promise<void> {
  await api.sendText(chatId, '🔄 Bot wordt herstart...\n\n_Dit duurt enkele seconden._', {
    parse_mode: 'Markdown',
  });
  
  // Kill other instances first
  killAllOtherBotProcesses();
  
  // Schedule restart
  setTimeout(() => {
    // Start new process
    const child = exec('node start.js', {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
    } as any);
    
    child.unref();
    
    // Exit current process after short delay
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }, 500);
}

async function updateBot(api: ApiMethods, chatId: number): Promise<void> {
  const msg = await api.sendText(chatId, '🔄 *Update starten...*\n\n1️⃣ Git pull...', {
    parse_mode: 'Markdown',
  });
  
  // Step 1: Git pull
  const pullResult = gitPull();
  if (!pullResult.success) {
    await api.editMessageText({
      chat_id: chatId,
      message_id: msg.message_id,
      text: `❌ *Update mislukt bij git pull*\n\n\`${pullResult.output}\``,
      parse_mode: 'Markdown',
    });
    return;
  }
  
  await api.editMessageText({
    chat_id: chatId,
    message_id: msg.message_id,
    text: '🔄 *Update bezig...*\n\n1️⃣ Git pull ✅\n2️⃣ Build TypeScript...',
    parse_mode: 'Markdown',
  });
  
  // Step 2: Build
  const buildResult = npmBuild();
  if (!buildResult.success) {
    await api.editMessageText({
      chat_id: chatId,
      message_id: msg.message_id,
      text: `❌ *Update mislukt bij build*\n\n\`${buildResult.output}\``,
      parse_mode: 'Markdown',
    });
    return;
  }
  
  await api.editMessageText({
    chat_id: chatId,
    message_id: msg.message_id,
    text: '🔄 *Update bezig...*\n\n1️⃣ Git pull ✅\n2️⃣ Build ✅\n3️⃣ Herstart...',
    parse_mode: 'Markdown',
  });
  
  // Step 3: Kill other instances and restart
  killAllOtherBotProcesses();
  
  setTimeout(() => {
    const child = exec('node start.js', {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
    } as any);
    
    child.unref();
    
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }, 500);
}

async function pullCode(api: ApiMethods, chatId: number): Promise<void> {
  const msg = await api.sendText(chatId, '🔄 Git pull...');
  
  const result = gitPull();
  
  await api.editMessageText({
    chat_id: chatId,
    message_id: msg.message_id,
    text: result.success 
      ? `✅ *Git pull succesvol*\n\n\`\`\`\n${result.output}\n\`\`\``
      : `❌ *Git pull mislukt*\n\n\`${result.output}\``,
    parse_mode: 'Markdown',
  });
}

async function buildBot(api: ApiMethods, chatId: number): Promise<void> {
  const msg = await api.sendText(chatId, '🔨 Building TypeScript...');
  
  const result = npmBuild();
  
  await api.editMessageText({
    chat_id: chatId,
    message_id: msg.message_id,
    text: result.success 
      ? '✅ Build succesvol!\n\nGebruik `/admin restart` om de nieuwe code te laden.'
      : `❌ *Build mislukt*\n\n\`${result.output}\``,
    parse_mode: 'Markdown',
  });
}

async function showGitStatus(api: ApiMethods, chatId: number): Promise<void> {
  const git = getGitStatus();
  
  let text = `*📦 Git Status*\n\n`;
  text += `• Branch: \`${git.branch}\`\n`;
  text += `• Commit: \`${git.commit}\`\n`;
  text += `• Status: ${git.dirty ? '⚠️ Uncommitted changes' : '✅ Clean'}\n`;
  
  if (git.behind > 0) {
    text += `• ⬇️ ${git.behind} commits achter remote\n`;
  }
  if (git.ahead > 0) {
    text += `• ⬆️ ${git.ahead} commits voor op remote\n`;
  }
  
  if (git.behind > 0) {
    text += '\n💡 Gebruik `/admin update` om te updaten.';
  }
  
  await api.sendText(chatId, text, { parse_mode: 'Markdown' });
}

async function showEnvironment(api: ApiMethods, chatId: number): Promise<void> {
  // Show safe environment info (no secrets)
  const safeEnvKeys = [
    'NODE_ENV', 'LOG_LEVEL', 'CLAUDE_MODEL', 'ZAI_MODEL', 
    'MINIMAX_MODEL', 'MISTRAL_MODEL', 'LLM_DEFAULT_PROVIDER'
  ];
  
  let text = '*🔧 Environment*\n\n';
  
  for (const key of safeEnvKeys) {
    const value = process.env[key];
    if (value) {
      text += `• ${key}: \`${value}\`\n`;
    }
  }
  
  // Show which API keys are configured (not the values!)
  text += '\n*API Keys Configured:*\n';
  text += `• BOT_TOKEN: ${process.env.BOT_TOKEN ? '✅' : '❌'}\n`;
  text += `• ZAI_API_KEY: ${process.env.ZAI_API_KEY ? '✅' : '❌'}\n`;
  text += `• MINIMAX_API_KEY: ${process.env.MINIMAX_API_KEY ? '✅' : '❌'}\n`;
  text += `• MISTRAL_API_KEY: ${process.env.MISTRAL_API_KEY ? '✅' : '❌'}\n`;
  
  await api.sendText(chatId, text, { parse_mode: 'Markdown' });
}

async function reloadConfig(api: ApiMethods, chatId: number): Promise<void> {
  // Note: Full config reload requires restart in Node.js
  // This just clears caches where possible
  
  await api.sendText(chatId, 
    '⚠️ Volledige config reload vereist een herstart.\n\n' +
    'Gebruik `/admin restart` om met nieuwe config te starten.',
    { parse_mode: 'Markdown' }
  );
}

async function broadcastMessage(api: ApiMethods, chatId: number, args: string[]): Promise<void> {
  if (args.length === 0) {
    await api.sendText(chatId, 'Gebruik: /admin broadcast <bericht>');
    return;
  }
  
  const message = args.join(' ');
  
  // Broadcast to all admins
  const admins = getAdminIds();
  let sent = 0;
  
  for (const adminId of admins) {
    try {
      await api.sendText(adminId, `📢 *Admin Broadcast*\n\n${message}`, {
        parse_mode: 'Markdown',
      });
      sent++;
    } catch {
      // Admin might have blocked the bot
    }
  }
  
  await api.sendText(chatId, `✅ Broadcast verzonden naar ${sent} admin(s).`);
}

async function shutdownBot(api: ApiMethods, chatId: number): Promise<void> {
  await api.sendText(chatId, '🛑 Bot wordt gestopt...\n\n_Tot ziens!_', {
    parse_mode: 'Markdown',
  });
  
  // Give time for message to be sent
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

async function healthCheck(api: ApiMethods, chatId: number): Promise<void> {
  const checks: { name: string; status: boolean; details?: string }[] = [];
  
  // Check bot is running
  checks.push({
    name: 'Bot Process',
    status: true,
    details: `PID ${process.pid}`,
  });
  
  // Check memory usage
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  checks.push({
    name: 'Memory',
    status: heapUsedMB < heapTotalMB * 0.9, // Less than 90% used
    details: `${heapUsedMB}/${heapTotalMB} MB`,
  });
  
  // Check for duplicate instances
  const otherProcesses = findBotProcesses();
  checks.push({
    name: 'Single Instance',
    status: otherProcesses.length === 0,
    details: otherProcesses.length === 0 ? 'OK' : `${otherProcesses.length} duplicates!`,
  });
  
  // Check git status
  const git = getGitStatus();
  checks.push({
    name: 'Git Sync',
    status: git.behind === 0,
    details: git.behind > 0 ? `${git.behind} behind` : 'Up to date',
  });
  
  // Format response
  let text = '*🏥 Health Check*\n\n';
  
  for (const check of checks) {
    const emoji = check.status ? '✅' : '❌';
    text += `${emoji} ${check.name}`;
    if (check.details) {
      text += `: ${check.details}`;
    }
    text += '\n';
  }
  
  const allHealthy = checks.every(c => c.status);
  text += `\n*Overall:* ${allHealthy ? '✅ Healthy' : '⚠️ Issues detected'}`;
  
  await api.sendText(chatId, text, { parse_mode: 'Markdown' });
}
