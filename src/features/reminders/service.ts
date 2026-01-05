/**
 * Reminders Service - Checks and sends pending reminders
 */

import type { ApiMethods } from '../../api';
import type { Reminder } from './types';
import { FileReminderStore } from './store';

export class ReminderService {
  private store = new FileReminderStore();
  private interval?: NodeJS.Timeout;
  private api: ApiMethods;

  constructor(api: ApiMethods) {
    this.api = api;
  }

  start(): void {
    // Prevent duplicate intervals
    if (this.interval) {
      return;
    }
    // Check every 30 seconds
    this.interval = setInterval(() => {
      this.checkReminders();
    }, 30000);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  private async checkReminders(): Promise<void> {
    const pending = this.store.getPending();

    for (const reminder of pending) {
      try {
        await this.api.sendMessage({
          chat_id: reminder.chatId,
          text: `⏰ Herinnering: ${reminder.message}`,
        });
        this.store.markSent(reminder.id);
      } catch (error) {
        console.error(`Failed to send reminder ${reminder.id}:`, error);
      }
    }
  }

  getStore(): FileReminderStore {
    return this.store;
  }
}
