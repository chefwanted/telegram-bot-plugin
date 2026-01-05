/**
 * Migration Script: File-based storage to SQLite
 * Migrates existing data from /tmp/telegram-bot to SQLite database
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDatabase, closeDatabase } from '../src/database';

const DATA_DIR = '/tmp/telegram-bot';
const BACKUP_DIR = '/tmp/telegram-bot-backup';

interface Note {
  id: string;
  content: string;
  tags?: string[];
  createdAt: number;
  updatedAt?: number;
}

interface Reminder {
  id: string;
  chatId: string;
  message: string;
  remindAt: number;
  recurring?: {
    type: 'daily' | 'weekly' | 'monthly';
    time?: string;
    day?: number;
  };
  createdAt: number;
}

interface Stats {
  [chatId: string]: {
    messages: number;
    commands: { [command: string]: number };
    lastReset: number;
  };
}

// =============================================================================
// Migration Functions
// =============================================================================

/**
 * Backup existing data
 */
function backupData(): void {
  if (fs.existsSync(BACKUP_DIR)) {
    console.log('Backup already exists, skipping...');
    return;
  }

  console.log('Creating backup...');
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  // Copy all files
  copyDirectory(DATA_DIR, BACKUP_DIR);
  console.log(`✅ Backup created at ${BACKUP_DIR}`);
}

function copyDirectory(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Migrate notes
 */
function migrateNotes(db: any): number {
  console.log('Migrating notes...');

  const notesDir = path.join(DATA_DIR, 'notes');
  if (!fs.existsSync(notesDir)) {
    console.log('  No notes found, skipping...');
    return 0;
  }

  let count = 0;
  const files = fs.readdirSync(notesDir);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const chatId = file.replace('.json', '');
    const filePath = path.join(notesDir, file);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const notes: Note[] = JSON.parse(content);

      for (const note of notes) {
        db.addNote(
          chatId,
          note.content,
          note.tags ? note.tags.join(',') : undefined
        );
        count++;
      }
    } catch (error) {
      console.error(`  ❌ Error migrating notes for ${chatId}:`, error);
    }
  }

  console.log(`  ✅ Migrated ${count} notes`);
  return count;
}

/**
 * Migrate reminders
 */
function migrateReminders(db: any): number {
  console.log('Migrating reminders...');

  const remindersFile = path.join(DATA_DIR, 'reminders.json');
  if (!fs.existsSync(remindersFile)) {
    console.log('  No reminders found, skipping...');
    return 0;
  }

  try {
    const content = fs.readFileSync(remindersFile, 'utf-8');
    const reminders: Reminder[] = JSON.parse(content);

    let count = 0;
    for (const reminder of reminders) {
      db.addReminder(
        reminder.chatId,
        reminder.message,
        reminder.remindAt,
        reminder.recurring ? JSON.stringify(reminder.recurring) : undefined
      );
      count++;
    }

    console.log(`  ✅ Migrated ${count} reminders`);
    return count;
  } catch (error) {
    console.error(`  ❌ Error migrating reminders:`, error);
    return 0;
  }
}

/**
 * Migrate analytics/stats
 */
function migrateStats(db: any): number {
  console.log('Migrating analytics...');

  const statsFile = path.join(DATA_DIR, 'stats.json');
  if (!fs.existsSync(statsFile)) {
    console.log('  No stats found, skipping...');
    return 0;
  }

  try {
    const content = fs.readFileSync(statsFile, 'utf-8');
    const stats: Stats = JSON.parse(content);

    let count = 0;
    for (const [chatId, chatStats] of Object.entries(stats)) {
      // Track messages
      for (let i = 0; i < chatStats.messages; i++) {
        db.trackEvent(chatId, 'message');
        count++;
      }

      // Track commands
      for (const [command, amount] of Object.entries(chatStats.commands)) {
        for (let i = 0; i < (amount as number); i++) {
          db.trackEvent(chatId, `command_${command}`);
          count++;
        }
      }
    }

    console.log(`  ✅ Migrated ${count} analytics events`);
    return count;
  } catch (error) {
    console.error(`  ❌ Error migrating stats:`, error);
    return 0;
  }
}

/**
 * Migrate conversations
 */
function migrateConversations(db: any): number {
  console.log('Migrating conversations...');

  // Conversations are stored in-memory in the ZAIService, not in files
  // Skip this for now
  console.log('  ⏭️  Conversations are in-memory, skipping...');
  return 0;
}

/**
 * Migrate files
 */
function migrateFiles(db: any): number {
  console.log('Migrating files...');

  const filesDir = path.join(DATA_DIR, 'files');
  if (!fs.existsSync(filesDir)) {
    console.log('  No files found, skipping...');
    return 0;
  }

  // Files are stored as Telegram file_ids, we'd need to re-index
  // Skip for now
  console.log('  ⏭️  Files need Telegram API to re-index, skipping...');
  return 0;
}

// =============================================================================
// Main Migration
// =============================================================================

async function main(): Promise<void> {
  console.log('🔄 Starting migration from file storage to SQLite...\n');

  // Check if data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    console.log(`❌ Data directory not found: ${DATA_DIR}`);
    console.log('Skipping migration...');
    return;
  }

  // Backup existing data
  backupData();

  // Get database instance
  const db = getDatabase();

  // Migrate all data
  const results = {
    notes: 0,
    reminders: 0,
    analytics: 0,
    conversations: 0,
    files: 0,
  };

  results.notes = migrateNotes(db);
  results.reminders = migrateReminders(db);
  results.analytics = migrateStats(db);
  results.conversations = migrateConversations(db);
  results.files = migrateFiles(db);

  // Summary
  console.log('\n📊 Migration Summary:');
  console.log(`  Notes: ${results.notes}`);
  console.log(`  Reminders: ${results.reminders}`);
  console.log(`  Analytics: ${results.analytics}`);
  console.log(`  Conversations: ${results.conversations}`);
  console.log(`  Files: ${results.files}`);
  console.log(`  Total: ${Object.values(results).reduce((a, b) => a + b, 0)} records`);

  console.log('\n✅ Migration completed!');
  console.log(`\n💾 Backup stored at: ${BACKUP_DIR}`);

  // Close database
  closeDatabase();
}

// Run migration
main().catch(console.error);
