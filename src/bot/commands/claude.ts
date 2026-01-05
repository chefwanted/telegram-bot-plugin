/**
 * Claude Commands
 * Commando's voor interactie met Claude via Telegram
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';

// Conversation info type for status command
export type ConversationInfo = {
  messageCount: number;
  lastActivity: Date;
} | null;

// =============================================================================
// Claude Start Command
// =============================================================================

export async function claudeStartCommand(
  api: ApiMethods,
  message: Message
): Promise<void> {
  const chatId = message.chat.id;
  const userName = message.from?.first_name || 'Vriend';

  const welcomeMessage = `
🤖 Welkom bij de AI Telegram Bot, ${userName}!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 Deze bot kan alles voor je doen!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 NOTITIES
/note list - Toon al je notities
/note add <tekst> - Voeg een notitie toe
/note get <nummer> - Lees een specifieke notitie
/note delete <nummer> - Verwijder een notitie
/note search <term> - Zoek in je notities
/note tag <nummer> <tag> - Voeg een tag toe

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏰ HERINNERINGEN
/remind in <tijd> <bericht> - Herinnering in X tijd (5m, 1h, 2d)
/remind at <tijd> <bericht> - Herinnering op specifieke tijd (14:30)
/remind list - Toon al je herinneringen
/remind delete <nummer> - Verwijder een herinnering

Ondersteunt ook dagelijkse/wekelijkse/maandelijkse herinneringen!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 VERTALING
/tr <taal> <tekst> - Vertaal tekst (bijv: /tr nl Hello World)
/tr-list - Toon alle beschikbare talen

Ondersteunt: Nederlands, Engels, Duits, Frans, Spaans, Italiaans, Portugees, Russisch, Chinees, Japans, Koreaans, Arabisch

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 LINKS
/link shorten <url> - Maak een korte link
/link list - Toon al je links
/link delete <code> - Verwijder een link
/link preview <url> - Bekijk link preview

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 STATISTIEKEN
/stats - Bekijk bot statistieken
/stats-reset - Reset statistieken

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 ZOEKEN
/search <term> - Zoek in notities en gesprekken

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎮 GAMES
/trivia - Start een trivia spel (5 vragen)
/trivia-answer <letter> - Geef antwoord (A, B, C of D)
/ttt - Start Tic Tac Toe
/ttt-move <nummer> - Doe een zet (1-9)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📎 BESTANDEN
/file list - Toon opgeslagen bestanden
/file delete <id> - Verwijder een bestand
Stuur gewoon een bestand naar de chat om op te slaan!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👥 GROEPEN
/group create <naam> - Maak een nieuwe groep
/group list - Toon jouw groepen
/group join <id> - Join een groep
/group leave <id> - Verlaat een groep
/group post <id>|<tekst>|[anon] - Plaats bericht
/group read <id> [aantal] - Lees berichten
/group discover - Ontdek openbare groepen

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 AI CHAT
Stuur gewoon een bericht en ik reageer met GLM-4.7 AI!

/claude_status - Bekijk gesprek status
/claude_clear - Wis gespreksgeschiedenis

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️ SYSTEEM
/status - Bot status
/help - Toon dit help bericht

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Tips:
• Alle commando's werken met - of _ (bijv: /claude-status of /claude_status)
• Gebruik /help voor een snel overzicht
• Stuur een bericht om te chatten met de AI!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Veel plezier! 🚀
`.trim();

  await api.sendMessage({ chat_id: chatId, text: welcomeMessage });
}

// =============================================================================
// Claude Status Command
// =============================================================================

export async function claudeStatusCommand(
  api: ApiMethods,
  message: Message,
  info: ConversationInfo
): Promise<void> {
  const chatId = message.chat.id;

  if (!info) {
    const statusMessage = `
📊 Gesprek Status

Nog geen berichten verstuurd in dit gesprek.

Stuur een bericht om te beginnen! 🚀
`.trim();

    await api.sendMessage({ chat_id: chatId, text: statusMessage });
    return;
  }

  const statusMessage = `
📊 Gesprek Status

Berichten: ${info.messageCount}
Laatste activiteit: ${info.lastActivity.toLocaleString('nl-NL')}
`.trim();

  await api.sendMessage({ chat_id: chatId, text: statusMessage });
}

// =============================================================================
// Claude Help Command
// =============================================================================

export async function claudeHelpCommand(
  api: ApiMethods,
  message: Message
): Promise<void> {
  const chatId = message.chat.id;

  const helpMessage = `
🤖 AI Telegram Bot - Help

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SNEL OVERZICHT

📝 /note - Notities beheren
⏰ /remind - Herinneringen instellen
🌐 /tr - Vertalen
🔗 /link - Link shortener
📊 /stats - Statistieken
🔍 /search - Zoeken
🎮 /trivia of /ttt - Games
📎 /file - Bestanden
👥 /group - Groepen

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AI COMMANDS

/start - Uitgebreide welkomstboodschap
/help - Dit help bericht
/claude_status - Gesprek status
/claude_clear - Wis geschiedenis
/status - Bot systeem status

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DETAILS PER COMMANDO

📝 NOTITIES
/note list - Toon alle notities
/note add <tekst> - Voeg toe
/note get <n> - Lees notitie
/note delete <n> - Verwijder
/note search <term> - Zoek
/note tag <n> <tag> - Tag toevoegen

⏰ HERINNERINGEN
/remind in <5m|1h|2d> <bericht>
/remind at <14:30> <bericht>
/remind list - Toon herinneringen
/remind delete <n> - Verwijder

🌐 VERTALING
/tr <taal> <tekst> - Vertaal
/tr-list - Beschikbare talen

Talen: nl, en, de, fr, es, it, pt, ru, zh, ja, ko, ar

🔗 LINKS
/link shorten <url> - Maak kort
/link list - Toon links
/link delete <code> - Verwijder
/link preview <url> - Preview

📊 STATS
/stats - Gebruiks statistieken
/stats-reset - Reset tellers

🎮 GAMES
/trivia - Start trivia
/trivia-answer <A|B|C|D> - Antwoord
/ttt - Tic Tac Toe
/ttt-move <1-9> - Doe zet

📎 BESTANDEN
/file list - Toon bestanden
/file delete <id> - Verwijder
Stuur bestand om op te slaan!

👥 GROEPEN
/group create <naam> - Maak groep
/group list - Jouw groepen
/group join <id> - Join
/group leave <id> - Verlaat
/group post <id>|<tekst>|[anon] - Post
/group read <id> [aantal] - Lees
/group discover - Ontdek groepen

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 TIPS

• Commando's werken met - of _
• Chatten: stuur gewoon een bericht!
• Geschiedenis wordt onthouden
• 28+ functionaliteiten beschikbaar

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Veel plezier!
`.trim();

  await api.sendMessage({ chat_id: chatId, text: helpMessage });
}
