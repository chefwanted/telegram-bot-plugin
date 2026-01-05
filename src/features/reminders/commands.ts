/**
 * Reminders Commands
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import type { Reminder } from './types';
import { ReminderService } from './service';

let service: ReminderService;

export function setReminderService(rs: ReminderService): void {
  service = rs;
}

export async function remindAddCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  if (!service) return;

  const input = args.join(' ');
  // Format: /remind in 5m message OR /remind at 14:30 message
  const match = input.match(/^(in|at)\s+(\S+)\s+(.+)/i);

  if (!match) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik:\n/remind in <tijd> <bericht>\n  tijd: 5m, 1h, 2d\n/remind at <tijd> <bericht>\n  tijd: 14:30',
    });
    return;
  }

  const [, type, timeStr, msg] = match;
  const remindAt = parseTime(type, timeStr);

  if (!remindAt) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❕ Ongeldig tijdformaat.',
    });
    return;
  }

  const reminder = service.getStore().add(String(message.chat.id), msg, remindAt);
  const waitTime = Math.round((remindAt - Date.now()) / 60000);

  await api.sendMessage({
    chat_id: message.chat.id,
    text: `✅ Herinnering gezet voor ${new Date(remindAt).toLocaleString('nl-NL')}\n(over ${waitTime} minuten)`,
  });
}

export async function remindListCommand(api: ApiMethods, message: Message): Promise<void> {
  if (!service) return;

  const all = service.getStore().getAll();
  const userReminders = all.filter(r => r.chatId === String(message.chat.id));

  if (userReminders.length === 0) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '📋 Je hebt geen herinneringen.',
    });
    return;
  }

  let text = `📋 Je herinneringen (${userReminders.length}):\n\n`;
  userReminders.forEach((r, i) => {
    const time = new Date(r.remindAt).toLocaleString('nl-NL');
    text += `${i + 1}. ${time}\n   ${r.message}\n\n`;
  });

  await api.sendMessage({ chat_id: message.chat.id, text });
}

export async function remindDeleteCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  if (!service) return;

  const all = service.getStore().getAll();
  const userReminders = all.filter(r => r.chatId === String(message.chat.id));
  const index = parseInt(args[0] || '0', 10) - 1;

  if (index < 0 || index >= userReminders.length) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❕ Ongeldig nummer.',
    });
    return;
  }

  const deleted = service.getStore().delete(userReminders[index].id);

  if (deleted) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '✅ Herinnering verwijderd.',
    });
  }
}

function parseTime(type: string, timeStr: string): number | null {
  const now = Date.now();

  if (type === 'in') {
    // Parse "in 5m", "in 1h", "in 2d"
    const match = timeStr.match(/^(\d+)([mhd])$/i);
    if (!match) return null;

    const [, amount, unit] = match;
    const value = parseInt(amount, 10);

    switch (unit.toLowerCase()) {
      case 'm': return now + value * 60000;
      case 'h': return now + value * 3600000;
      case 'd': return now + value * 86400000;
      default: return null;
    }
  }

  if (type === 'at') {
    // Parse "at 14:30"
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;

    const [, hours, minutes] = match;
    const target = new Date();
    target.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

    if (target.getTime() <= now) {
      target.setDate(target.getDate() + 1);
    }

    return target.getTime();
  }

  return null;
}
