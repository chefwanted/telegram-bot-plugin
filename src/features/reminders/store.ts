/**
 * Reminders Store - File-based persistence
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Reminder, ReminderStore } from './types';

const REMINDERS_FILE = '/tmp/telegram-bot/reminders.json';

export class FileReminderStore implements ReminderStore {
  private reminders: Reminder[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    if (fs.existsSync(REMINDERS_FILE)) {
      try {
        const content = fs.readFileSync(REMINDERS_FILE, 'utf-8');
        this.reminders = JSON.parse(content);
      } catch {
        this.reminders = [];
      }
    }
  }

  private save(): void {
    const dir = path.dirname(REMINDERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(REMINDERS_FILE, JSON.stringify(this.reminders, null, 2));
  }

  getAll(): Reminder[] {
    return [...this.reminders];
  }

  getPending(): Reminder[] {
    const now = Date.now();
    return this.reminders.filter(r => r.remindAt <= now);
  }

  add(chatId: string, message: string, remindAt: number, recurring?: Reminder['recurring']): Reminder {
    const reminder: Reminder = {
      id: Date.now().toString(),
      chatId,
      message,
      remindAt,
      createdAt: Date.now(),
      recurring,
    };
    this.reminders.push(reminder);
    this.save();
    return reminder;
  }

  delete(id: string): boolean {
    const index = this.reminders.findIndex(r => r.id === id);
    if (index !== -1) {
      this.reminders.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  markSent(id: string): boolean {
    const reminder = this.reminders.find(r => r.id === id);
    if (reminder && reminder.recurring) {
      // Reschedule recurring reminder
      reminder.remindAt = this.calculateNextOccurrence(reminder.recurring);
      this.save();
      return true;
    }
    // Remove non-recurring
    return this.delete(id);
  }

  private calculateNextOccurrence(recurring: NonNullable<Reminder['recurring']>): number {
    const now = new Date();

    if (recurring.type === 'daily') {
      const [hours, minutes] = recurring.time.split(':').map(Number);
      const next = new Date(now);
      next.setHours(hours, minutes, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next.getTime();
    }

    if (recurring.type === 'weekly') {
      const [hours, minutes] = recurring.time.split(':').map(Number);
      const next = new Date(now);
      next.setHours(hours, minutes, 0, 0);

      const currentDay = next.getDay();
      const targetDay = recurring.day;
      const daysUntil = (targetDay - currentDay + 7) % 7 || 7;

      next.setDate(next.getDate() + daysUntil);
      return next.getTime();
    }

    if (recurring.type === 'monthly') {
      const [hours, minutes] = recurring.time.split(':').map(Number);
      const next = new Date(now);
      next.setHours(hours, minutes, 0, 0);
      next.setDate(recurring.day);

      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      return next.getTime();
    }

    // Default: 1 day from now
    return now.getTime() + 24 * 60 * 60 * 1000;
  }
}
