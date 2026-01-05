/**
 * Start Command
 * Welkomstbericht met versie, changelog en gebruiksaanwijzing
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';

// =============================================================================
// Version Info
// =============================================================================

const BOT_VERSION = '2.2.0';

const CHANGELOG = `
*Versie ${BOT_VERSION} (Januari 2025)*

*Nieuw:*
• 🤖 Multi-LLM chat met provider switch (/llm)
• 🧠 Mistral provider toegevoegd
• 🔧 Tool confirmation - bevestiging voor gevaarlijke operaties
• 💡 Error suggestions - slimme foutoplossingen

*Verbeterd:*
• Snellere respons met throttled updates
• Betere error messages
• Session persistence in database
• Opgeschoonde commando's (oude games/news verwijderd)
`;

// =============================================================================
// Features Overview
// =============================================================================

const FEATURES = `
*💬 AI Chat*
Stel vragen, vraag om hulp met code, of gebruik als assistent.
Typ gewoon je bericht - geen commando nodig!

*🤖 LLM Providers*
• /llm - kies provider (Z.ai, MiniMax, Mistral, Claude CLI)

*🛠️ Developer Tools*
• /project - Bekijk project structuur
• /read <bestand> - Lees bestand
• /write <bestand> <inhoud> - Schrijf bestand
• /code <opdracht> - Laat AI code schrijven
• /git - Git status en commits
• /patch - Pas patches toe

*📝 Productiviteit*
• /note - Notities opslaan en beheren
• /remind - Herinneringen instellen
• /tr <tekst> - Vertaal tekst

*🎯 Skills XP*
Verdien XP door tools te gebruiken. Bekijk je skills met /skills en het leaderboard met /leaderboard!
`;

// =============================================================================
// Setup Instructions
// =============================================================================

const SETUP = `
*🚀 Quick Start*

1. Typ een bericht om met de AI te chatten
2. Gebruik /help voor alle commando's
3. Gebruik /llm om je provider te kiezen

*⚠️ Let op*
- Sommige operaties vragen om bevestiging
- Sessies worden bewaard tussen berichten
- Gebruik /claude_clear voor nieuwe Claude CLI sessie
`;

// =============================================================================
// Start Command
// =============================================================================

export async function startCommand(
  api: ApiMethods,
  message: Message
): Promise<void> {
  const chatId = message.chat.id;
  const userName = message.from?.first_name || 'gebruiker';

  const welcomeMessage = `
🤖 *AI Bot* v${BOT_VERSION}

👋 *Welkom, ${userName}!*

Ik ben je AI assistent. Hier is wat je kunt doen:

${FEATURES}

---
*📋 Changelog*

${CHANGELOG}

---
${SETUP}

_Stuur /help voor alle commando's_
  `.trim();

  await api.sendText(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
  });
}
