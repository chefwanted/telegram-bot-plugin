# Telegram Bot Plugin - Project Overview

## Purpose
Bidirectionele Telegram Bot plugin voor OpenCode die communicatie mogelijk maakt tussen OpenCode agents en Telegram gebruikers.

## Tech Stack
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Dependencies**:
  - `node-telegram-bot-api`: Telegram Bot API wrapper
  - `axios`: HTTP client
  - `typescript`: ^5.9.3
  - `@types/node`: ^25.0.3

## Current Status
- **Phase**: Skelet/Planning phase
- **Implementation**: Alle src bestanden zijn LEEG
- **Documentation**: Uitgebreid plan document (TELEGRAM_BOT_PLAN.md, 33KB)
- **Tests**: Niet geïmplementeerd

## Architecture
Modulaire architectuur met separation of concerns:
- Core API Client (HTTP communicatie met Telegram)
- Session Management (sessiebeheer en persistentie)
- Telegram Bot Implementation (bot logica, commando's)
- Event Integration (OpenCode event systeem)
- Plugin Entry Point (registratie bij OpenCode)

## Project Structure
```
src/
├── types/      # Telegram, session, plugin types
├── api/        # HTTP client, API methods
├── session/    # Session manager, storage
├── bot/        # Bot logic, handlers, commands
├── events/     # Event dispatcher, handlers
└── utils/      # Logger, config loader
```

## Complexity
- **Level**: Gemiddeld tot hoog
- **Estimated Time**: 2-3 weken
- **Tasks**: 22 taken in 9 stages
- **Agents**: 6 gespecialiseerde agents
