/**
 * Help Command
 * Toont alle beschikbare commando's en gebruiksinstructies
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';

// =============================================================================
// Complete Command List
// =============================================================================

const COMMANDS = `
*Core*
/start - Welkomstbericht met handleiding
/help - Toon dit overzicht
/status - Bot status en statistieken
/version - Versie informatie

*Claude Code AI*
/claude - Start Claude Code chat sessie
/claude_status - Toon huidige sessie info
/claude_clear - Start nieuwe sessie
/claude-cli <vraag> - Claude CLI direct (snel)
/omo <opdracht> - OpenCode CLI direct (code schrijven)

*Developer Tools*
/dev - Developer mode help en overzicht
/project - Bekijk project info
/files [folder] - Lijst bestanden in folder
/tree [folder] - Toon directory boom structuur
/read <bestand> - Lees bestand inhoud
/focus <bestand1> <bestand2> - Focus bestanden voor AI context
/code <opdracht> - Laat Claude code schrijven/bewerken
/patch <patch> - Pas patch toe op codebase
/write <bestand> <inhoud> - Schrijf nieuw bestand
/git <actie> [args] - Git versiebeheer (status, add, commit, log, init)

*Productiviteit*
/note list - Toon al je notities
/note add <tekst> - Voeg notitie toe
/note get <id> - Toon specifieke notitie
/note delete <id> - Verwijder notitie
/note search <term> - Zoek notities

/remind list - Toon herinneringen
/remind add <minuten> <bericht> - Voeg herinnering toe
/remind delete <id> - Verwijder herinnering

/tr <tekst> - Vertaal tekst naar Engels
/translate <taal> <tekst> - Vertaal naar specifieke taal
/tr-list - Toon vertaling geschiedenis

*Links*
/link short <url> - Maak korte link
/link list - Toon al je links
/link delete <code> - Verwijder link

*Analytics*
/stats - Toon bot statistieken
/stats-reset - Reset statistieken

*Files & Folders*
/file list [folder] - Toon bestanden
/file delete <id> - Verwijder bestand
/file move <id> <folder> - Verplaats bestand

/folder list - Toon folders
/folder create <naam> - Maak nieuwe folder

*Skills & Gamification*
/skills - Toon je skills en XP
/skill-info <skill> - Info over specifieke skill
/leaderboard [skill] - Toon leaderboard
`;

// =============================================================================
// Quick Reference
// =============================================================================

const QUICK_REF = `
*Quick Tips*

- Chat direct met Claude - geen / nodig!
- Gebruik /code help voor code specifieke opties
- /focus helpt Claude beter begrijpen wat belangrijk is
- Tools zoals Write/Edit vragen om bevestiging

*Gevaarlijke operaties vragen altijd bevestiging:*
- Bestanden verwijderen
- Code wijzigen
- Git commits maken

Stuur /start voor welkomstbericht met handleiding
`;

// =============================================================================
// Help Command
// =============================================================================

export async function helpCommand(
  api: ApiMethods,
  message: Message
): Promise<void> {
  const chatId = message.chat.id;

  const helpText = 'Alle Beschikbare Commando\'s\n\n' + COMMANDS + '\n' + QUICK_REF;

  await api.sendText(chatId, helpText, {
    parse_mode: 'Markdown',
  });
}

// =============================================================================
// Default Command Descriptions (for /help in menu)
// =============================================================================

export const DEFAULT_COMMANDS: Record<string, string> = {
  '/start': 'Welkom & handleiding',
  '/help': 'Alle commando\'s',
  '/status': 'Bot status',
  '/version': 'Versie info',
  '/claude': 'Claude Code Chat',
  '/claude_status': 'Session status',
  '/claude_clear': 'Nieuwe sessie',
  '/claude-cli': 'Claude CLI direct',
  '/omo': 'OpenCode CLI direct',
  '/dev': 'Developer help',
  '/project': 'Project info',
  '/files': 'Bestanden bekijken',
  '/tree': 'Directory structuur',
  '/read': 'Bestand lezen',
  '/focus': 'AI context focus',
  '/code': 'Code aanpassen',
  '/patch': 'Patch toepassen',
  '/write': 'Bestand schrijven',
  '/git': 'Git versiebeheer',
  '/note': 'Notities',
  '/remind': 'Herinneringen',
  '/tr': 'Vertaal tekst',
  '/link': 'Link shortener',
  '/stats': 'Bot statistieken',
  '/file': 'Bestanden upload',
  '/folder': 'Folders',
  '/skills': 'Skills XP',
  '/leaderboard': 'Leaderboard',
  '/tool': 'Custom tools',
  '/logs': 'Bot logs bekijken',
};
