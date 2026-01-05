# Telegram Bot Plugin voor OpenCode

Dit project is een Telegram Bot Plugin voor OpenCode die bidirectionele communicatie mogelijk maakt tussen OpenCode agents en Telegram gebruikers.

## Installatie

(Coming soon)

## Gebruik

1. Zet een `.env` met minimaal:

```
TELEGRAM_BOT_TOKEN=123:abc
ZAI_API_KEY=sk-...
```

2. Start de bot:

```
npm install
npm run build
node start.js
```

3. Stuur `/start` in Telegram. Gebruik `/help` voor het menu.

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
