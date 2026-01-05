/**
 * Analytics Feature - Track bot usage
 */

import * as fs from 'fs';
import * as path from 'path';

const STATS_FILE = '/tmp/telegram-bot/stats.json';

interface BotStats {
  messages: number;
  commands: number;
  errors: number;
  activeUsers: number;
  commandCounts: Record<string, number>;
  lastReset: number;
}

let stats: BotStats = {
  messages: 0,
  commands: 0,
  errors: 0,
  activeUsers: 0,
  commandCounts: {},
  lastReset: Date.now(),
};

function loadStats(): void {
  if (fs.existsSync(STATS_FILE)) {
    try {
      stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
    } catch {}
  }
}

function saveStats(): void {
  const dir = path.dirname(STATS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

loadStats();

export function trackMessage(chatId: string): void {
  stats.messages++;
  saveStats();
}

export function trackCommand(command: string, chatId: string): void {
  stats.commands++;
  stats.commandCounts[command] = (stats.commandCounts[command] || 0) + 1;
  saveStats();
}

export function trackError(): void {
  stats.errors++;
  saveStats();
}

export function getStats(): BotStats {
  return { ...stats };
}

export function resetStats(): void {
  stats = {
    messages: 0,
    commands: 0,
    errors: 0,
    activeUsers: 0,
    commandCounts: {},
    lastReset: Date.now(),
  };
  saveStats();
}
