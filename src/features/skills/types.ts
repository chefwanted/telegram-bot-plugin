/**
 * Skills Feature Types
 */

export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  levels: string[];
  xpPerAction: number;
  maxLevel: number;
}

export interface UserSkill {
  chatId: string;
  skillId: string;
  level: number;
  xp: number;
  updatedAt: number;
}

export interface SkillProgress {
  skill: Skill;
  currentLevel: number;
  currentXp: number;
  xpToNext: number;
  progress: number; // 0-100
}

export interface LeaderboardEntry {
  chatId: string;
  skillId: string;
  level: number;
  xp: number;
  rank?: number;
}
