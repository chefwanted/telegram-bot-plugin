# Telegram Bot Plugin voor OpenCode

Dit project is een Telegram Bot Plugin voor OpenCode die bidirectionele communicatie mogelijk maakt tussen OpenCode agents en Telegram gebruikers.

## Installatie

### Vereisten

- Node.js 18 of hoger
- Claude CLI (voor AI chat functionaliteit)
- Telegram Bot Token
- Anthropic API Key

### Stap 1: Installeer Dependencies

```bash
npm install
npm run build
```

### Stap 2: Configureer Claude CLI

**Belangrijk:** Claude CLI moet geauthenticeerd zijn voordat de bot werkt!

```bash
# Installeer Claude CLI (als nog niet geïnstalleerd)
curl -fsSL https://install.claude.ai | sh

# Authenticeer met je Anthropic API key
claude
```

📖 **Zie [Claude CLI Setup Guide](docs/CLAUDE_CLI_SETUP.md) voor gedetailleerde instructies**

### Stap 3: Configureer Environment

Maak een `.env` bestand met minimaal:

```
TELEGRAM_BOT_TOKEN=123:abc
ANTHROPIC_API_KEY=sk-...  # Voor Claude CLI
ZAI_API_KEY=sk-...        # Optioneel: voor fallback AI
```

### Stap 4: Start de Bot

```bash
node start.js
```

### Stap 5: Test in Telegram

Stuur `/start` in Telegram. Gebruik `/help` voor het menu.

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

## Licentie

ISC
