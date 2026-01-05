# Telegram Bot Plugin voor OpenCode

Dit project is een Telegram Bot Plugin voor OpenCode die bidirectionele communicatie mogelijk maakt tussen OpenCode agents en Telegram gebruikers.

## Installatie

### Vereisten

- Node.js 18 of hoger
- Telegram Bot Token
- Z.ai / MiniMax / Mistral API Key (minstens 1 provider)
- Claude CLI (optioneel, alleen als je Claude CLI wilt gebruiken)

### Stap 1: Installeer Dependencies

```bash
npm install
npm run build
```

Of met Bun:

```bash
bun install
bun run build
```

### Stap 2: Configureer LLM providers

Kies minimaal 1 provider (Z.ai, MiniMax, of Mistral). Claude CLI is optioneel en kan via `/llm set claude-cli` geactiveerd worden.

📖 **Zie [Claude CLI Setup Guide](docs/CLAUDE_CLI_SETUP.md) voor Claude CLI instructies (optioneel)**

### Stap 3: Configureer Environment

Maak een `.env` bestand met minimaal:

```
TELEGRAM_BOT_TOKEN=123:abc
ZAI_API_KEY=sk-...        # Of MINIMAX_API_KEY / MISTRAL_API_KEY
ZAI_MODEL=glm-4.7
MINIMAX_API_KEY=eyJ...    # Optioneel
MINIMAX_MODEL=MiniMax-v2.1
MISTRAL_API_KEY=sk-...    # Optioneel
LLM_DEFAULT_PROVIDER=zai  # Optioneel: zai|minimax|mistral|claude-cli
MISTRAL_MODEL=mistral-small-latest
MISTRAL_DEV_MODEL=codestral-latest
ZAI_DEV_MODEL=
MINIMAX_DEV_MODEL=
DATABASE_PATH=/path/to/bot.db  # default: /tmp/telegram-bot/bot.db
# Optioneel (aanbevolen): lock DATABASE_PATH tot deze directory
DATABASE_DIR=/tmp/telegram-bot
# Optioneel: override lock (NIET aanbevolen)
ALLOW_UNSAFE_DATABASE_PATH=false
FILES_DIR=/path/to/files
# Upload limiet (bytes). Default: 20971520 (20MB)
MAX_UPLOAD_BYTES=20971520
# Rate limiting (per chat+user)
RATE_LIMIT_COMMANDS=10
RATE_LIMIT_COMMANDS_WINDOW_MS=10000
RATE_LIMIT_MESSAGES=20
RATE_LIMIT_MESSAGES_WINDOW_MS=10000
RATE_LIMIT_UPLOADS=3
RATE_LIMIT_UPLOADS_WINDOW_MS=60000
```

Bestanden die via Telegram worden gestuurd, worden opgeslagen in `FILES_DIR` (standaard `/tmp/telegram-bot/files/<chatId>`).

### Stap 4: Start de Bot

```bash
node start.js
```

### Stap 5: Test in Telegram

Stuur `/start` in Telegram. Gebruik `/help` voor het menu.
Gebruik `/llm` om je provider te kiezen.

## Troubleshooting

### "Claude CLI timed out after 120000ms"

Dit betekent dat Claude CLI niet geauthenticeerd is. Oplossing:

1. Run `claude` in je terminal
2. Volg authenticatie prompts
3. Herstart de bot

📖 **Zie [Timeout Fix Guide](docs/TIMEOUT_FIX.md) voor meer info**

### Andere problemen

- Check `/logs` in Telegram voor bot logs
- Test Claude CLI: `claude --print -- "test"`
- Verifieer config: `ls -la ~/.config/claude/`

### Nieuwe commando's
- `/version` – toon plugin- en packageversie
- `/update` – laatste wijzigingen
- `/code <opdracht>` – vraag Claude om code-aanpassingen/patches (developer modus)

### Claude/LLM gedrag
- Alle gewone (niet-`/`) berichten gaan naar Claude voor chat.
- `/code` gebruikt een aparte developer prompt en houdt eigen geschiedenis per chat voor codeworkflows.
## Ontwikkeling

### Setup

1. `npm install`
2. `npm run build`

Met Bun:
1. `bun install`
2. `bun run build`

### Live validatie (geen mocks)

Gebruik dit voor echte API checks (Telegram + LLMs):

```bash
bun run test:live
```

Vereiste env vars:
- `TELEGRAM_BOT_TOKEN` (of `BOT_TOKEN`)
- `LIVE_TEST_CHAT_ID` (chat ID voor testbericht)

Optioneel:
- `LIVE_DB_PATH` (test DB pad)
- `ZAI_API_KEY`, `MINIMAX_API_KEY`, `MISTRAL_API_KEY`

Volledige flow:

```bash
bun run validate:full
```

## Licentie

ISC
