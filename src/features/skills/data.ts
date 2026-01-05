/**
 * Skills Data
 * Skill definitions and configurations
 */

import type { Skill } from './types';

export const SKILLS: Record<string, Skill> = {
  chatter: {
    id: 'chatter',
    name: 'Gesprekspartner',
    description: 'XP voor elk bericht naar de AI',
    icon: '💬',
    levels: ['Nieuw', 'Begonnen', 'Actief', 'Chatter', 'Gesprekspartner', 'Expert', 'Meester', 'Legende'],
    xpPerAction: 10,
    maxLevel: 7,
  },
  note_taker: {
    id: 'note_taker',
    name: 'Notitie Maker',
    description: 'XP voor elke notitie die je maakt',
    icon: '📝',
    levels: ['Beginner', 'Notulist', 'Georganiseerd', 'Productief', 'Notitie Meester', 'Archivaris'],
    xpPerAction: 25,
    maxLevel: 5,
  },
  translator: {
    id: 'translator',
    name: 'Vertaler',
    description: 'XP voor elke vertaling',
    icon: '🌐',
    levels: ['Aangemeld', 'Beginner', 'Tussenlevel', 'Vertaler', 'Tolk', 'Meester Vertaler'],
    xpPerAction: 15,
    maxLevel: 5,
  },
  reminder_master: {
    id: 'reminder_master',
    name: 'Herinnerings Meester',
    description: 'XP voor elke herinnering',
    icon: '⏰',
    levels: ['Vergetelaar', 'Organisator', 'Tijd management', 'Efficient', 'Meester van Tijd'],
    xpPerAction: 20,
    maxLevel: 4,
  },
  file_manager: {
    id: 'file_manager',
    name: 'Beheerder',
    description: 'XP voor elk bestand dat je opslaat',
    icon: '📁',
    levels: ['Nieuw', 'Gebruiker', 'Beheerder', 'Archivaris', 'Data Meester'],
    xpPerAction: 15,
    maxLevel: 4,
  },
  searcher: {
    id: 'searcher',
    name: 'Zoeker',
    description: 'XP voor elke zoekopdracht',
    icon: '🔍',
    levels: ['Zoeker', 'Onderzoeker', 'Detective', 'Meester Zoeker'],
    xpPerAction: 10,
    maxLevel: 3,
  },
  gamer: {
    id: 'gamer',
    name: 'Gamer',
    description: 'XP voor elk gespeeld spel',
    icon: '🎮',
    levels: ['Casual', 'Speler', 'Gamer', 'Pro Gamer', 'E-sporter'],
    xpPerAction: 20,
    maxLevel: 4,
  },
  link_master: {
    id: 'link_master',
    name: 'Link Specialist',
    description: 'XP voor elke verkorte link',
    icon: '🔗',
    levels: ['Beginner', 'Linker', 'URL Master', 'Web Expert'],
    xpPerAction: 10,
    maxLevel: 3,
  },
  news_reader: {
    id: 'news_reader',
    name: 'Nieuws Lezer',
    description: 'XP voor het lezen van nieuws',
    icon: '📰',
    levels: ['Lezer', 'Nieuwsjager', 'Informed', 'Nieuws Expert'],
    xpPerAction: 5,
    maxLevel: 3,
  },
  p2000_watcher: {
    id: 'p2000_watcher',
    name: 'Hulpverlener',
    description: 'XP voor P2000 meldingen',
    icon: '🚨',
    levels: ['Observator', 'Getuige', 'Hulpverlener', 'Eerste Hulp'],
    xpPerAction: 5,
    maxLevel: 3,
  },
};

/**
 * Get all skills as array
 */
export function getAllSkills(): Skill[] {
  return Object.values(SKILLS);
}

/**
 * Get skill by ID
 */
export function getSkill(id: string): Skill | undefined {
  return SKILLS[id];
}

/**
 * Get XP required for a specific level
 */
export function getXpForLevel(skill: Skill, level: number): number {
  return level * 100; // Simple: each level requires 100 XP more
}

/**
 * Get level from XP
 */
export function getLevelFromXp(skill: Skill, xp: number): number {
  return Math.min(Math.floor(xp / 100), skill.maxLevel);
}

/**
 * Get progress to next level (0-100)
 */
export function getProgressToNext(skill: Skill, xp: number): number {
  const currentLevel = getLevelFromXp(skill, xp);
  const currentLevelXp = currentLevel * 100;
  const nextLevelXp = (currentLevel + 1) * 100;
  const xpInCurrentLevel = xp - currentLevelXp;
  const xpNeededForNext = nextLevelXp - currentLevelXp;

  return Math.min(100, Math.floor((xpInCurrentLevel / xpNeededForNext) * 100));
}
