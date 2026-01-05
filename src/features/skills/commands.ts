/**
 * Skills Commands
 * Command handlers for skills feature
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import { createSkillsService } from './skills';
import { SKILLS } from './data';

const skillsService = createSkillsService();

// =============================================================================
// Skills Commands
// =============================================================================

export async function skillsCommand(api: ApiMethods, message: Message): Promise<void> {
  const chatId = String(message.chat.id);

  const progress = skillsService.getSkillsProgress(chatId);
  const totalXp = skillsService.getTotalXp(chatId);
  const rank = skillsService.getUserRank(chatId);

  let text = `*🎯 Jouw Skills*\n\n`;
  text += `Totaal XP: ${totalXp} | Rank: #${rank}\n\n`;

  // Show top skills
  for (const p of progress.slice(0, 5)) {
    text += skillsService.formatSkillProgress(p);
    text += '\n\n';
  }

  text += `\n💡 Gebruik /skill-info <id> voor meer details`;

  await api.sendMessage({ chat_id: message.chat.id, text });
}

export async function skillInfoCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const chatId = String(message.chat.id);
  const skillId = args[0];

  if (!skillId) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `*📚 Beschikbare Skills*\n\n${Object.values(SKILLS).map(s => `${s.icon} /${s.id} - ${s.name}`).join('\n')}\n\nGebruik: /skill-info <id>`,
    });
    return;
  }

  const skill = SKILLS[skillId];
  if (!skill) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `❌ Onbekende skill: ${skillId}`,
    });
    return;
  }

  const progress = skillsService.getSkillsProgress(chatId).find(p => p.skill.id === skillId);

  let text = `*${skill.icon} ${skill.name}*\n\n`;
  text += `${skill.description}\n\n`;
  text += `*Niveaus:* ${skill.levels.join(' → ')}\n`;
  text += `*XP per actie:* +${skill.xpPerAction} XP\n\n`;

  if (progress && progress.currentXp > 0) {
    text += `*Jouw Voortgang:*\n`;
    text += skillsService.formatSkillProgress(progress);
  } else {
    text += `*Nog niet gestart*\n\nGebruik de bot om XP te verdienen!`;
  }

  await api.sendMessage({ chat_id: message.chat.id, text });
}

export async function leaderboardCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const chatId = String(message.chat.id);
  const skillId = args[0];

  const leaderboard = skillsService.getLeaderboard(skillId, 15);
  const skill = skillId ? SKILLS[skillId] : undefined;

  const text = skillsService.formatLeaderboard(leaderboard, skill);

  await api.sendMessage({ chat_id: message.chat.id, text });
}
