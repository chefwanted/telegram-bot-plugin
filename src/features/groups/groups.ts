/**
 * Groups Feature - Multi-user groups and shared conversations
 */

import * as fs from 'fs';
import * as path from 'path';

const GROUPS_DIR = '/tmp/telegram-bot/groups';

export interface Group {
  id: string;
  name: string;
  creator: string;
  members: string[];
  createdAt: number;
  settings: {
    allowAnonymous: boolean;
    requireApproval: boolean;
  };
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  anonymous: boolean;
  content: string;
  timestamp: number;
}

const groups = new Map<string, Group>();
const messages = new Map<string, GroupMessage[]>();

function initGroupsDir(): void {
  if (!fs.existsSync(GROUPS_DIR)) {
    fs.mkdirSync(GROUPS_DIR, { recursive: true });
  }
}

export function createGroup(name: string, creatorId: string): Group {
  initGroupsDir();

  const id = 'grp_' + Date.now().toString(36);
  const group: Group = {
    id,
    name,
    creator: creatorId,
    members: [creatorId],
    createdAt: Date.now(),
    settings: {
      allowAnonymous: true,
      requireApproval: false,
    },
  };

  groups.set(id, group);
  messages.set(id, []);
  saveGroup(group);

  return group;
}

export function getGroup(id: string): Group | undefined {
  return groups.get(id);
}

export function getUserGroups(chatId: string): Group[] {
  return Array.from(groups.values()).filter(g => g.members.includes(chatId));
}

export function joinGroup(groupId: string, chatId: string): boolean {
  const group = groups.get(groupId);
  if (group && !group.members.includes(chatId)) {
    group.members.push(chatId);
    saveGroup(group);
    return true;
  }
  return false;
}

export function leaveGroup(groupId: string, chatId: string): boolean {
  const group = groups.get(groupId);
  if (group) {
    group.members = group.members.filter(m => m !== chatId);
    saveGroup(group);
    return true;
  }
  return false;
}

export function addGroupMessage(groupId: string, senderId: string, content: string, anonymous: boolean = false): GroupMessage {
  const groupMessages = messages.get(groupId) || [];
  const msg: GroupMessage = {
    id: Date.now().toString(),
    groupId,
    senderId,
    anonymous,
    content,
    timestamp: Date.now(),
  };
  groupMessages.push(msg);
  messages.set(groupId, groupMessages);
  saveGroupMessages(groupId, groupMessages);
  return msg;
}

export function getGroupMessages(groupId: string, limit: number = 50): GroupMessage[] {
  const groupMessages = messages.get(groupId) || [];
  return groupMessages.slice(-limit);
}

function saveGroup(group: Group): void {
  const filePath = path.join(GROUPS_DIR, `${group.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(group, null, 2));
}

function saveGroupMessages(groupId: string, msgs: GroupMessage[]): void {
  const filePath = path.join(GROUPS_DIR, `${groupId}_messages.json`);
  fs.writeFileSync(filePath, JSON.stringify(msgs, null, 2));
}

export function listGroups(): Group[] {
  return Array.from(groups.values());
}
