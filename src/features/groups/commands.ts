/**
 * Groups Commands
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import {
  createGroup,
  getUserGroups,
  joinGroup,
  leaveGroup,
  addGroupMessage,
  getGroupMessages,
  listGroups,
} from './groups';

export async function groupCreateCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const name = args.join(' ');

  if (!name) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik: /group create <naam>',
    });
    return;
  }

  const group = createGroup(name, String(message.chat.id));

  await api.sendMessage({
    chat_id: message.chat.id,
    text: `✅ Groep aangemaakt!\n\nNaam: ${group.name}\nID: ${group.id}\n\nDeel dit ID met anderen om ze uit te nodigen.`,
  });
}

export async function groupListCommand(api: ApiMethods, message: Message): Promise<void> {
  const userGroups = getUserGroups(String(message.chat.id));

  if (userGroups.length === 0) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '👥 Je bent nog geen lid van een groep.\n\nGebruik /group create <naam> om een groep te maken.',
    });
    return;
  }

  let text = `👥 Je groepen (${userGroups.length}):\n\n`;
  userGroups.forEach((g, i) => {
    text += `${i + 1}. ${g.name}\n   ID: ${g.id}\n   Leden: ${g.members.length}\n\n`;
  });

  await api.sendMessage({ chat_id: message.chat.id, text });
}

export async function groupJoinCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const groupId = args[0];

  if (!groupId) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik: /group join <group_id>',
    });
    return;
  }

  const joined = joinGroup(groupId, String(message.chat.id));

  if (joined) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '✅ Je bent nu lid van de groep!',
    });
  } else {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❕ Kon niet joinen (bestaat niet of je bent al lid).',
    });
  }
}

export async function groupLeaveCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const groupId = args[0];

  if (!groupId) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik: /group leave <group_id>',
    });
    return;
  }

  const left = leaveGroup(groupId, String(message.chat.id));

  if (left) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '✅ Je hebt de groep verlaten.',
    });
  } else {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❕ Kon de groep niet verlaten.',
    });
  }
}

export async function groupPostCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const parts = args.join(' ').split('|');
  const groupId = parts[0]?.trim();
  const content = parts[1]?.trim();
  const anonymous = parts[2]?.trim().toLowerCase() === 'anon';

  if (!groupId || !content) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik: /group post <group_id> | <bericht> | [anon]\n\nVoorbeeld: /group post grp_abc | Hallo iedereen!',
    });
    return;
  }

  const msg = addGroupMessage(groupId, String(message.chat.id), content, anonymous);

  await api.sendMessage({
    chat_id: message.chat.id,
    text: `✅ Bericht geplaatst in groep! (ID: ${msg.id})`,
  });
}

export async function groupReadCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const groupId = args[0];
  const limit = parseInt(args[1] || '10', 10);

  if (!groupId) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❌ Gebruik: /group read <group_id> [aantal]',
    });
    return;
  }

  const msgs = getGroupMessages(groupId, limit);

  if (msgs.length === 0) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '📭 Geen berichten in deze groep.',
    });
    return;
  }

  let text = `📨 Laatste ${msgs.length} berichten:\n\n`;
  msgs.forEach((msg) => {
    const sender = msg.anonymous ? '👤 Anoniem' : msg.senderId;
    const time = new Date(msg.timestamp).toLocaleTimeString('nl-NL');
    text += `[${time}] ${sender}: ${msg.content}\n\n`;
  });

  await api.sendMessage({ chat_id: message.chat.id, text });
}

export async function groupDiscoverCommand(api: ApiMethods, message: Message): Promise<void> {
  const allGroups = listGroups();

  if (allGroups.length === 0) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '🔍 Geen groepen gevonden.\n\nMaak de eerste groep met /group create <naam>!',
    });
    return;
  }

  let text = `🔍 Beschikbare groepen (${allGroups.length}):\n\n`;
  allGroups.forEach((g, i) => {
    text += `${i + 1}. ${g.name}\n   ID: ${g.id}\n   Leden: ${g.members.length}\n\n`;
  });

  text += 'Gebruik /group join <id> om lid te worden.';

  await api.sendMessage({ chat_id: message.chat.id, text });
}
