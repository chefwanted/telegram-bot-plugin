# Telegram Bot Plugin - Volledige Documentatie

## 📋 Inhoudsopgave

1. [Overzicht](#overzicht)
2. [Architectuur](#architectuur)
3. [Installatie](#installatie)
4. [Configuratie](#configuratie)
5. [Commands Overzicht](#commands-overzicht)
6. [Admin Systeem](#admin-systeem)
7. [Process Management](#process-management)
8. [Update Workflow](#update-workflow)
9. [LLM Providers](#llm-providers)
10. [Troubleshooting](#troubleshooting)

---

## Overzicht

De Telegram Bot Plugin is een uitgebreide bot die meerdere AI-providers ondersteunt (Claude CLI, Z.ai, MiniMax, Mistral) en een breed scala aan functionaliteit biedt:

- **AI Chat**: Conversaties met meerdere LLM providers
- **Developer Tools**: Project management, code editing, patches
- **Productiviteit**: Notities, herinneringen, vertalingen
- **Bestanden**: Upload, download, Git integratie
- **Admin**: Systeem beheer, restart, updates

### Versie
- Package: 2.2.0
- Laatste update: 2026-01-05

---

## Architectuur

```
telegram-bot-plugin/
├── start.js              # Entry point met process management
├── .bot.lock             # Lock file (single instance)
├── .bot.pid              # PID file
├── src/
│   ├── index.ts          # Plugin hoofdklasse
│   ├── bot/
│   │   ├── bot.ts        # TelegramBot class
│   │   ├── handlers/     # Message, Command, Callback handlers
│   │   └── commands/     # Alle bot commands
│   ├── api/              # Telegram API wrapper
│   ├── llm/              # LLM Router & providers
│   ├── claude-code/      # Claude CLI integratie
│   ├── zai/              # Z.ai (GLM-4.7) provider
│   ├── minimax/          # MiniMax provider
│   ├── mistral/          # Mistral provider
│   ├── features/         # Feature modules
│   │   ├── notes/        # Notities systeem
│   │   ├── reminders/    # Herinneringen
│   │   ├── translate/    # Vertalingen
│   │   ├── files/        # Bestandsbeheer
│   │   ├── developer/    # Dev mode tools
│   │   └── ...
│   └── utils/
│       ├── config.ts     # Configuratie loader
│       ├── logger.ts     # Logging systeem
│       └── process-manager.ts  # Process management
└── dist/                 # Compiled JavaScript
```

### Dataflow

```
Telegram → grammY Bot → Handler Router → Feature Module → Response
                            ↓
                       LLM Router → AI Provider → Stream Response
```

---

## Installatie

### Vereisten
- Node.js 18+ of Bun 1.3+
- npm of bun package manager
- Telegram Bot Token (van @BotFather)
- Minimaal één AI API key

### Setup

```bash
# Clone of download
cd telegram-bot-plugin

# Dependencies installeren
npm install
# of
bun install

# TypeScript compileren
npm run build

# .env configureren
cp .env.example .env
nano .env
```

### Eerste start

```bash
# Start de bot
node start.js

# Met force flag (kill bestaande instanties)
node start.js --force
```

---

## Configuratie

### Environment Variables (.env)

```bash
# Telegram Bot Token (VERPLICHT)
BOT_TOKEN=123456:ABCDefGhIJKlmnOPQrstUVwxyz

# AI Providers (minimaal één nodig)
ZAI_API_KEY=your_zai_key
ZAI_MODEL=glm-4.7

MINIMAX_API_KEY=your_minimax_key
MINIMAX_MODEL=MiniMax-v2.1

MISTRAL_API_KEY=your_mistral_key
MISTRAL_MODEL=mistral-small-latest
MISTRAL_DEV_MODEL=codestral-latest

# Claude CLI (optioneel, moet geïnstalleerd zijn)
CLAUDE_WORKING_DIR=/path/to/projects
CLAUDE_CLI_BINARY=claude
CLAUDE_TIMEOUT=300000

# Default LLM Provider
LLM_DEFAULT_PROVIDER=zai  # zai, minimax, mistral, claude-cli

# Logging
LOG_LEVEL=info  # debug, info, warn, error, silent
LOG_FORMAT=text  # text, json

# Session
SESSION_TTL=3600
SESSION_MAX=1000

# Polling
POLLING_TIMEOUT=30000
POLLING_INTERVAL=300
```

### Provider Prioriteit

De LLM Router kiest automatisch een provider:
1. Als `LLM_DEFAULT_PROVIDER` is ingesteld → gebruik die
2. Anders: eerste beschikbare van: Z.ai → MiniMax → Mistral → Claude CLI

---

## Commands Overzicht

### Core Commands

| Command | Beschrijving |
|---------|-------------|
| `/start` | Start de bot |
| `/help` | Toon alle commands |
| `/status` | Bot status & statistieken |
| `/version` | Versie informatie |
| `/changelog` | Changelog bekijken |

### AI Commands

| Command | Beschrijving |
|---------|-------------|
| `/llm` | LLM provider beheer |
| `/llm list` | Beschikbare providers |
| `/llm set <provider>` | Wissel van provider |
| `/claude` | Claude CLI sessie management |
| `/claude status` | Sessie status |
| `/claude clear` | Nieuwe sessie starten |

### Developer Commands

| Command | Beschrijving |
|---------|-------------|
| `/dev` | Developer help |
| `/project open <pad>` | Project openen |
| `/files [pad]` | Bestanden bekijken |
| `/tree [pad]` | Directory tree |
| `/read <bestand>` | Bestand lezen |
| `/focus add <bestand>` | Bestand aan context toevoegen |
| `/code <instructie>` | Code genereren/aanpassen |
| `/patch apply <id>` | Patch toepassen |
| `/write <pad> <inhoud>` | Bestand schrijven |
| `/git <subcommand>` | Git operaties |

### Productiviteit Commands

| Command | Beschrijving |
|---------|-------------|
| `/note list` | Notities bekijken |
| `/note add <tekst>` | Notitie toevoegen |
| `/remind in 5m <bericht>` | Herinnering instellen |
| `/tr en <tekst>` | Vertalen naar Engels |
| `/search <query>` | Zoeken |

### Admin Commands

| Command | Beschrijving |
|---------|-------------|
| `/admin` | Admin help |
| `/admin status` | Systeem status |
| `/admin processes` | Draaiende processen |
| `/admin kill <pid>` | Process killen |
| `/admin killall` | Alle duplicaten killen |
| `/admin restart` | Bot herstarten |
| `/admin update` | Pull + Build + Restart |
| `/admin shutdown` | Bot stoppen |
| `/admin health` | Health check |

---

## Admin Systeem

### Toegangsbeheer

Standaard heeft iedereen admin toegang (voor development). 
Voeg admin user IDs toe in `src/bot/commands/admin.ts`:

```typescript
const ADMIN_USER_IDS: number[] = [
  123456789,  // Jouw Telegram user ID
  987654321,  // Andere admin
];
```

Je vindt je user ID door `/status` te sturen naar de bot of via @userinfobot.

### Admin Commands in Detail

#### `/admin status`
Toont:
- Server hostname & platform
- Memory usage
- CPU load
- Process info (PID, uptime, memory)
- Git status (branch, commit, dirty state)

#### `/admin processes`
Toont alle draaiende bot instanties. Handig om duplicaten te detecteren.

#### `/admin killall`
Stopt alle bot instanties behalve de huidige. Gebruik dit om de "oude code blijft draaien" problemen op te lossen.

#### `/admin update`
Voert een complete update uit:
1. `git pull --rebase`
2. `npm run build`
3. Kill alle andere instanties
4. Herstart met nieuwe code

#### `/admin health`
Voert health checks uit:
- ✅ Bot process draait
- ✅ Memory gebruik onder 90%
- ✅ Geen duplicate instanties
- ✅ Git up-to-date

---

## Process Management

### Single Instance Enforcement

De bot gebruikt een lock file systeem om te voorkomen dat meerdere instanties tegelijk draaien:

```
.bot.lock - JSON met PID, startTime, version
.bot.pid  - Simpele PID voor scripts
```

### Start Scenarios

**Eerste start:**
```bash
node start.js
# → Lock acquired, bot start
```

**Tweede start (zonder force):**
```bash
node start.js
# ❌ Another bot instance is already running (PID: 12345)
#    Use --force to kill and replace it.
```

**Tweede start (met force):**
```bash
node start.js --force
# ⚠️ Force killing existing process (PID: 12345)...
# 🔒 Lock acquired, bot start
```

### Graceful Shutdown

De bot handelt shutdown signalen correct af:
- `SIGINT` (Ctrl+C)
- `SIGTERM` (kill)
- `SIGHUP` (terminal closed)

Bij shutdown:
1. Alle LLM services worden gestopt
2. Database connecties worden gesloten
3. Reminder service wordt gestopt
4. Lock files worden verwijderd

---

## Update Workflow

### Handmatige Update

```bash
# Stop de huidige bot
kill $(cat .bot.pid)

# Pull nieuwe code
git pull

# Rebuild
npm run build

# Start opnieuw
node start.js
```

### Update via Telegram

Stuur `/admin update` naar de bot:
1. Bot voert git pull uit
2. Bot bouwt TypeScript opnieuw
3. Bot herstart zichzelf met nieuwe code

### Hot-Reload Beperkingen

Node.js ondersteunt geen echte hot-reload van modules. Daarom moet de bot altijd volledig herstarten voor code changes. Het `/admin update` command automatiseert dit proces.

---

## LLM Providers

### Z.ai (GLM-4.7)

Chinese AI van Zhipu AI. Goed voor algemene taken.

```bash
ZAI_API_KEY=your_key
ZAI_MODEL=glm-4.7
```

### MiniMax (v2.1)

Chinese AI met goede code capabilities. Heeft automatische fallback naar Lite model bij overload.

```bash
MINIMAX_API_KEY=your_key
MINIMAX_MODEL=MiniMax-v2.1
```

### Mistral

Franse AI met speciale Codestral model voor code.

```bash
MISTRAL_API_KEY=your_key
MISTRAL_MODEL=mistral-small-latest
MISTRAL_DEV_MODEL=codestral-latest  # Voor /code command
```

### Claude CLI

Gebruikt lokale Claude CLI installatie. Vereist:
- Claude CLI geïnstalleerd (`claude` command)
- Actieve Claude account

```bash
CLAUDE_WORKING_DIR=/home/user/projects
CLAUDE_CLI_BINARY=claude
```

### Wisselen van Provider

```
/llm list          # Toon beschikbare providers
/llm set zai       # Wissel naar Z.ai
/llm set minimax   # Wissel naar MiniMax
/llm set mistral   # Wissel naar Mistral
/llm set claude-cli # Wissel naar Claude CLI
```

---

## Troubleshooting

### "Oude code blijft draaien"

**Symptoom:** Na update reageren sommige commands nog op oude manier.

**Oorzaak:** Meerdere bot instanties draaien.

**Oplossing:**
```bash
# Via Telegram
/admin killall
/admin restart

# Of via terminal
pkill -f "node.*start.js"
node start.js
```

### "Another bot instance is already running"

**Oorzaak:** Lock file bestaat en process draait nog.

**Oplossing:**
```bash
node start.js --force
```

### "Bot reageert niet"

Check:
1. `/admin status` - werkt de bot?
2. `/admin health` - health checks
3. Logs bekijken: `/logs recent`

### "LLM geeft geen response"

**Oorzaak:** API key fout of provider down.

**Oplossing:**
```bash
/llm list    # Check welke providers actief zijn
/llm set <andere>  # Wissel naar werkende provider
```

### Rate Limits

De bot heeft ingebouwde rate limiting:
- Messages: 30/minuut
- Commands: 20/minuut
- Uploads: 5/minuut

Bij rate limit krijg je: `⚠️ Rate limit bereikt. Probeer het over Xs opnieuw.`

---

## Bestandsstructuur in Detail

### `/src/bot/commands/admin.ts`

Admin command handler met:
- `isAdmin()` - Check admin rechten
- `adminCommand()` - Hoofd command router
- System info functies
- Process management functies
- Git functies

### `/src/utils/process-manager.ts`

Utility functies voor:
- Lock file management
- Process detection
- Graceful shutdown
- Signal handlers

### `/start.js`

Entry point met:
- Process lock acquisitie
- Graceful shutdown handlers
- Error handling
- Pretty console output

---

## API Reference

### Plugin Interface

```typescript
interface ITelegramBotPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  getState(): Promise<PluginState>;
  getEventDispatcher(): EventDispatcher;
  getBot(): TelegramBot;
}
```

### Events

```typescript
// Bot lifecycle events
DefaultEvents.BOT_STARTED
DefaultEvents.BOT_STOPPED
DefaultEvents.MESSAGE_RECEIVED
DefaultEvents.COMMAND_EXECUTED
```

---

## Changelog

### v2.2.0 (2026-01-05)
- ✨ Admin command systeem toegevoegd
- ✨ Process management met lock files
- ✨ Single instance enforcement
- ✨ `/admin update` voor easy updates
- 🐛 Fix voor duplicate processes

### v2.1.0 (2026-01-05)
- ✨ Multi-LLM provider switch
- ✨ Mistral provider toegevoegd
- ✨ MiniMax v2.1 integratie

### v2.0.0 (2026-01-04)
- 🎉 Initial release
- ✨ 28+ bot features
- ✨ Z.ai / Claude CLI integratie
