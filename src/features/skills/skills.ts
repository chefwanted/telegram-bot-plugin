/**
 * Skills Service
 * Manages user skills, XP, and levels
 */

import type { Skill, UserSkill, SkillProgress, LeaderboardEntry } from './types';
import { SKILLS, getSkill, getLevelFromXp, getProgressToNext, getXpForLevel } from './data';
import { getDatabase, toUserSkills, toLeaderboardEntries } from '../../database';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ prefix: 'Skills' });

// =============================================================================
// Skills Service Class
// =============================================================================

export class SkillsService {
  private db = getDatabase();

  /**
   * Add XP to a user's skill
   */
  addXp(chatId: string, skillId: string, amount: number): void {
    const skill = getSkill(skillId);
    if (!skill) {
      logger.warn(`Unknown skill: ${skillId}`);
      return;
    }

    this.db.addXp(chatId, skillId, amount);
    logger.debug(`Added ${amount} XP to ${skillId} for ${chatId}`);
  }

  /**
   * Get all skills for a user
   */
  getUserSkills(chatId: string): UserSkill[] {
    return toUserSkills(this.db.getSkills(chatId));
  }

  /**
   * Get progress for all skills
   */
  getSkillsProgress(chatId: string): SkillProgress[] {
    const userSkills = this.getUserSkills(chatId);
    const progressList: SkillProgress[] = [];

    for (const userSkill of userSkills) {
      const skill = getSkill(userSkill.skillId);
      if (!skill) continue;

      const currentLevel = getLevelFromXp(skill, userSkill.xp);
      const xpToNext = getXpForLevel(skill, currentLevel + 1);
      const percentProgress = getProgressToNext(skill, userSkill.xp);

      progressList.push({
        skill,
        currentLevel,
        currentXp: userSkill.xp,
        xpToNext,
        progress: percentProgress,
      });
    }

    // Also include skills with no XP yet
    for (const skill of Object.values(SKILLS)) {
      if (!progressList.find(p => p.skill.id === skill.id)) {
        progressList.push({
          skill,
          currentLevel: 0,
          currentXp: 0,
          xpToNext: 100,
          progress: 0,
        });
      }
    }

    return progressList.sort((a, b) => b.currentXp - a.currentXp);
  }

  /**
   * Get leaderboard
   */
  getLeaderboard(skillId?: string, limit: number = 10): LeaderboardEntry[] {
    const records = this.db.getLeaderboard(skillId, limit);
    const entries = toLeaderboardEntries(records);

    return entries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }

  /**
   * Format skill progress for Telegram
   */
  formatSkillProgress(progress: SkillProgress): string {
    const { skill, currentLevel, currentXp, xpToNext, progress: percent } = progress;

    const levelName = skill.levels[currentLevel] || skill.levels[skill.levels.length - 1];
    const bar = this.createProgressBar(percent);

    return `
${skill.icon} *${skill.name}*
Niveau ${currentLevel}: ${levelName}
XP: ${currentXp}/${xpToNext}
${bar} ${percent}%
    `.trim();
  }

  /**
   * Format leaderboard for Telegram
   */
  formatLeaderboard(entries: LeaderboardEntry[], skill?: Skill): string {
    if (entries.length === 0) {
      return '🏆 Nog geen data beschikbaar.';
    }

    const header = skill
      ? `*🏆 Leaderboard: ${skill.name}*\n\n`
      : '*🏆 Algemeen Leaderboard*\n\n';

    const medals = ['🥇', '🥈', '🥉'];
    const list = entries.map((entry, index) => {
      const medal = index < 3 ? medals[index] : `${index + 1}.`;
      const skillName = getSkill(entry.skillId)?.name || entry.skillId;
      return `${medal} ${entry.chatId}: ${skillName} (Lvl ${entry.level}, ${entry.xp} XP)`;
    }).join('\n');

    return header + list;
  }

  /**
   * Create a progress bar
   */
  private createProgressBar(percent: number): string {
    const filled = Math.round(percent / 10);
    const empty = 10 - filled;

    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Get total XP for a user
   */
  getTotalXp(chatId: string): number {
    const skills = this.getUserSkills(chatId);
    return skills.reduce((sum, s) => sum + s.xp, 0);
  }

  /**
   * Get user rank based on total XP
   */
  getUserRank(chatId: string): number {
    const leaderboard = this.getLeaderboard();
    const userEntry = leaderboard.find(e => e.chatId === chatId);
    return userEntry?.rank || leaderboard.length + 1;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createSkillsService(): SkillsService {
  return new SkillsService();
}
