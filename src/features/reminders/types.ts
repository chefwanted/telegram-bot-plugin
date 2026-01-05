/**
 * Reminders Feature Types
 */

export interface Reminder {
  id: string;
  chatId: string;
  message: string;
  remindAt: number;
  createdAt: number;
  recurring?: RecurringPattern;
}

export type RecurringPattern =
  | { type: 'daily'; time: string } // "14:30"
  | { type: 'weekly'; day: number; time: string } // day: 0-6
  | { type: 'monthly'; day: number; time: string };

export interface ReminderStore {
  getAll(): Reminder[];
  getPending(): Reminder[];
  add(chatId: string, message: string, remindAt: number, recurring?: RecurringPattern): Reminder;
  delete(id: string): boolean;
  markSent(id: string): boolean;
}
