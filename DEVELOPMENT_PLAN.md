# Telegram Bot Plugin - Ontwikkelingsplan

**Versie:** 2.2.0  
**Laatst bijgewerkt:** 5 Januari 2026  
**Status:** Streaming feature in ontwikkeling

---

## 📋 Inhoudsopgave

1. [Project Overzicht](#1-project-overzicht)
2. [Huidige Staat](#2-huidige-staat)
3. [Fase Plan](#3-fase-plan)
4. [Geprioriteerde Taken](#4-geprioriteerde-taken)
5. [Tijdlijn](#5-tijdlijn)
6. [Technische Details](#6-technische-details)

---

## 1. Project Overzicht

| Aspect | Details |
|--------|---------|
| **Naam** | `telegram-bot-plugin` |
| **Versie** | 2.1.0 |
| **Taal** | TypeScript 5.9.3 |
| **Target** | ES2020 (CommonJS modules) |
| **Build** | `npm run build` → `dist/` |
| **Entry** | `src/index.ts` (804 regels) |

### Features

- **Claude Code CLI integratie** - Volledige Claude Code functionaliteit via Telegram
- **Streaming responses** - Real-time updates van Claude AI
- **Session management** - Meerdere gesprekken per chat
- **Confirmation system** - Inline keyboard goedkeuringen voor tool gebruik
- **12 Feature modules** - Notes, reminders, translate, search, games, etc.

### Architectuur

```
src/
├── api/           # Telegram API wrappers (455 regels)
├── bot/           # Bot setup, handlers, commands
│   ├── commands/  # /start, /help, /status, /claude, etc.
│   └── handlers/  # message, callback, streaming-message
├── bridge/        # OpenCode bridge integratie
├── claude/        # Claude AI service (Z.ai fallback)
├── claude-code/   # Claude Code CLI service ⭐ NEW (689 regels)
├── database/      # SQLite (better-sqlite3)
├── events/        # Event dispatcher systeem
├── features/      # 12 feature modules (55 bestanden!)
├── session/       # Session management
├── streaming/     ⭐ NEW streaming module
├── types/         # TypeScript types
├── utils/         # Helpers (config, logger, etc.)
└── zai/           # Z.ai API integratie
```

### Dependencies

**Core:**
- `grammy` ^1.39.2
- `@anthropic-ai/sdk` ^0.71.2
- `better-sqlite3` ^12.5.0

**Utils:**
- `axios`, `dotenv`, `cheerio`, `rss-parser`, `ts-node`

---

## 2. Huidige Staat

### Git Status

```
Branch: master
Status: 1 commit voor op origin/master

Changes not staged:
  M src/api/methods.ts
  M src/bot/handlers/callback.ts
  M src/claude-code/service.ts
  M src/index.ts
  M src/types/session.ts

Untracked:
  src/bot/handlers/streaming-message.ts
  src/streaming/
```

### Wijzigingen (Deze Session)

| Bestand | +regels | -regels | Omschrijving |
|---------|---------|---------|--------------|
| `src/claude-code/service.ts` | +281 | 0 | Claude Code CLI streaming service |
| `src/api/methods.ts` | +87 | 0 | `editMessageTextStream` + chunking |
| `src/bot/handlers/callback.ts` | +29 | 0 | Confirmation callbacks |
| `src/types/session.ts` | +28 | 0 | Session types |
| `src/index.ts` | 0 | -59 | Refactored voor streaming |
| **Totaal** | **+437** | **-59** | |

### Nieuwe Bestanden

```
src/bot/handlers/streaming-message.ts     # Streaming message handler
src/streaming/
├── index.ts                              # Module exports
├── types.ts                              # 260 regels - Stream types
├── message-stream.ts                     # 218 regels - Message streaming
├── confirmation.ts                       # ~200 regels - Confirmations
├── tool-visibility.ts                    # ~250 regels - Tool status UI
├── status.ts                             # ~180 regels - Status display
└── confirmation-types.ts                 # ~60 regels - Confirmation types
```

### Code Statistieken

| Metric | Waarde |
|--------|--------|
| Totaal TS bestanden | ~100+ |
| Totaal regels code | ~8,136 |
| Feature modules | 12 |
| Bot commands | 30+ |
| Dist bestanden | 15 folders |

---

## 3. Fase Plan

### Fase 0: Onmiddellijke Acties (Nu)

| Prioriteit | Taak | Status | Actie |
|------------|------|--------|-------|
| 🔴 Kritiek | Commit huidige wijzigingen | ⚠️ Unstaged | `git add + commit` |
| 🔴 Kritiek | Build verification | ⚠️ Ongeldieerd | `npm run build` |
| 🟠 Belangrijk | Code review streaming module | ❌ Niet gedaan | Claude Code service check |
| 🟠 Belangrijk | Type safety validatie | ❌ Niet gedaan | `lsp_diagnostics` |

### Fase 1: Stabilisatie (Week 1)

#### 1.1 Git & Versioning

```bash
# Commit message template
git commit -m "feat(streaming): add Claude Code streaming with confirmation system

- Add ClaudeCodeService with streaming support
- Add streaming module (types, message-stream, confirmation)
- Add message streaming via editMessageTextStream
- Add confirmation system with inline keyboards"
```

#### 1.2 Testing Framework Opzetten

```bash
npm install --save-dev jest @types/jest ts-jest
# Doel: 80% coverage op core modules
```

**Test prioriteiten:**

| Module | Coverage Goal | Tests |
|--------|--------------|-------|
| `session/manager.ts` | 90% | Session CRUD, persistence |
| `streaming/types.ts` | 100% | Status en utility functions |
| `api/methods.ts` | 85% | Message formatting, chunking |
| `claude-code/service.ts` | 75% | CLI spawning, parsing |

#### 1.3 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm run lint
```

### Fase 2: Feature Completering (Week 2)

#### 2.1 Streaming Module Finaliseren

- [ ] `streaming/confirmation.ts` - Volledige integratie met callback handler
- [ ] `streaming/tool-visibility.ts` - Tool use status in Telegram UI
- [ ] `streaming/message-stream.ts` - Real-time message updates
- [ ] Error recovery - `getErrorSuggestions()` integratie

#### 2.2 Claude Code Service Uitbreiden

| Feature | Status | Effort |
|---------|--------|--------|
| Tool approval flow | ⏳ Pending | 2 dagen |
| Multi-turn conversations | ✅ Bestaat | - |
| Session switching | ✅ Bestaat | - |
| Streaming JSON parsing | ✅ Bestaat | - |
| Cost tracking | ❌ Ontbreekt | 1 dag |

### Fase 3: Kwaliteit & Refactor (Week 3-4)

#### 3.1 Code Kwaliteit

```bash
# ESLint setup
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install --save-dev prettier eslint-config-prettier eslint-plugin-prettier
npm install --save-dev husky lint-staged
```

#### 3.2 Documentation

| Document | Prioriteit | Lengte |
|----------|------------|--------|
| `API.md` | Hoog | 50+ regels |
| `ARCHITECTURE.md` | Hoog | 100+ regels |
| `CONTRIBUTING.md` | Medium | 30+ regels |
| Inline comments | Hoog | Alle public APIs |

### Fase 4: Nieuwe Features (Maand 2)

| Feature | Complexiteit | Afhankelijkheden |
|---------|--------------|------------------|
| `/slash` commands voor agents | Medium | CLI integration |
| Webhook support | Hoog | Server setup |
| Message reactions | Laag | Telegram API |
| Multi-bot support | Hoog | Refactor nodig |
| Plugin system | Hoog | Nieuwe architectuur |

### Fase 5: Production Readiness (Maand 3)

#### 5.1 Monitoring & Observability

```typescript
// Metrics
- Response time per request
- Claude API token usage
- Error rate tracking
- Session statistics
```

#### 5.2 Security

```
├── Rate limiting per chat
├── Input sanitization
├── Command whitelisting
├── Sensitive data masking
└── API key encryption
```

---

## 4. Geprioriteerde Taken

### 🔥 IMMEDIAT (Deze Week)

| # | Taak | Tijd | Blokker |
|---|------|------|---------|
| 1 | **Git commit huidige wijzigingen** | 10 min | - |
| 2 | **Build verification** (`npm run build`) | 5 min | 1 |
| 3 | **Type check** (`lsp_diagnostics`) | 5 min | 2 |
| 4 | **Commit push naar origin** | 5 min | 1 |

### Onmiddellijke Taken Uitvoering

```bash
# Stap 1: Review wijzigingen
git diff --stat
git diff src/claude-code/service.ts | head -100

# Stap 2: Stage en commit
git add -A
git commit -m "feat(streaming): add Claude Code streaming with confirmation system

- Add ClaudeCodeService with streaming support
- Add streaming module (types, message-stream, confirmation)
- Add message streaming via editMessageTextStream
- Add confirmation system with inline keyboards"

# Stap 3: Build
npm run build

# Stap 4: Verify
lsp_diagnostics op changed files

# Stap 5: Push
git push origin master
```

### Week 1: Stabilisatie

| Dag | Taak | Tijd | Output |
|-----|------|------|--------|
| Ma | Jest setup + first tests | 4 uur | `npm test` werkt |
| Di | Session module tests | 3 uur | 90% coverage |
| Wo | API methods tests | 3 uur | 85% coverage |
| Do | Streaming types tests | 2 uur | 100% coverage |
| Vr | GitHub Actions CI | 3 uur | `.github/workflows/ci.yml` |

### Week 2: Feature Completering

| Dag | Taak | Tijd | Deliverable |
|-----|------|------|-------------|
| Ma | Confirmation integratie | 4 uur | `conf_*` callbacks werken |
| Di | Tool visibility UI | 4 uur | "Using: Read" in Telegram |
| Wo | Error suggestions | 3 uur | `getErrorSuggestions()` actief |
| Do | Claude Code cost tracking | 4 uur | Token usage in stats |
| Vr | Integration test | 2 uur | End-to-end streaming test |

---

## 5. Tijdlijn

### Roadmap Visualisatie

```
Tijd →    Week 1      Week 2      Week 3-4     Maand 2     Maand 3
         ┌─────────┬─────────┬─────────────┬─────────┬─────────────┐
Fase 1   │ ████    │         │             │         │             │ Stabilisatie
Fase 2   │         │ ████    │             │         │             │ Feature completering
Fase 3   │         │         │ ████        │         │             │ Kwaliteit
Fase 4   │         │         │             │ ████    │             │ Nieuwe features
Fase 5   │         │         │             │         │ ████        │ Production
         └─────────┴─────────┴─────────────┴─────────┴─────────────┘
                  ↑              ↑               ↑          ↑
                Commit       Streaming       Docs &     Monitoring
               & Build       Final          Refactor   & Security
```

### Effort per Taak

```
Totaal: ~120 uur

WEEK 1  ████████████░░░░░░░░░░░░░░░░░░░░░░░  25 uur
WEEK 2  ████████████████████░░░░░░░░░░░░░░░  30 uur  
WEEK 3  ████████████████████░░░░░░░░░░░░░░░  25 uur
WEEK 4  ████████████░░░░░░░░░░░░░░░░░░░░░░░  20 uur
MAAND 2 ██████████████████████████████░░░░  45 uur
```

### Checkpoint Overzicht

| Checkpoint | Datum | Criteria |
|------------|-------|----------|
| CP1 | Week 1, Vr | Build werkt, tests kunnen draaien |
| CP2 | Week 2, Vr | Streaming werkt end-to-end |
| CP3 | Week 4, Vr | 80% coverage, docs volledig |
| CP4 | Maand 2, Vr | Nieuwe features geïmplementeerd |
| CP5 | Maand 3, Vr | Production ready |

---

## 6. Technische Details

### Streaming Module

#### StreamStatus Enum

```typescript
export enum StreamStatus {
  IDLE = 'idle',
  THINKING = 'thinking',      // ⏳ Claude is thinking...
  TOOL_USE = 'tool_use',       // 🔧 Using: Read
  RESPONSE = 'response',       // ✍️ Generating response...
  CONFIRMATION = 'confirmation',  // ❓ Awaiting confirmation
  COMPLETE = 'complete',       // ✅ Complete
  ERROR = 'error'              // ❌ Error
}
```

#### Status Display

```typescript
export const STATUS_DISPLAYS: Record<StreamStatus, StatusDisplay> = {
  [StreamStatus.IDLE]: { emoji: '💤', text: 'Idle' },
  [StreamStatus.THINKING]: { emoji: '⏳', text: 'Thinking', showElapsed: true, animated: true },
  [StreamStatus.TOOL_USE]: { emoji: '🔧', text: 'Using tool' },
  [StreamStatus.RESPONSE]: { emoji: '✍️', text: 'Generating', showElapsed: true, animated: true },
  [StreamStatus.CONFIRMATION]: { emoji: '❓', text: 'Awaiting confirmation' },
  [StreamStatus.COMPLETE]: { emoji: '✅', text: 'Complete' },
  [StreamStatus.ERROR]: { emoji: '❌', text: 'Error' },
};
```

### Claude Code Service

#### Core Methods

```typescript
class ClaudeCodeService {
  async processMessage(chatId: string, message: string): Promise<ClaudeCodeResponse>
  async processMessageStream(chatId: string, message: string, callbacks: ClaudeCodeStreamCallbacks): Promise<StreamingResult>
  async createNewSession(chatId: string, name?: string): Promise<ClaudeCodeSession>
  async switchSession(chatId: string, sessionId: string): Promise<ClaudeCodeSession | null>
  async endSession(chatId: string): Promise<boolean>
}
```

#### Streaming Callbacks

```typescript
interface ClaudeCodeStreamCallbacks {
  onContent?: (chunk: string) => void;
  onToolUse?: (tool: ToolUseEvent) => void;
  onToolResult?: (result: ToolResultEvent) => void;
  onStatusChange?: (status: StreamStatus) => void;
  onError?: (error: Error) => void;
  onComplete?: (result: StreamingResult) => void;
}
```

### API Methods

#### Nieuwe Stream Editing

```typescript
async editMessageTextStream(
  chatId: number | string,
  messageId: number,
  text: string,
  options: {
    maxLength?: number;
    parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML';
    onChunkSent?: (chunk: string, remaining: string, index: number) => void;
  } = {}
): Promise<void>
```

### Error Suggestions

```typescript
export const ERROR_SUGGESTIONS: ErrorSuggestion[] = [
  {
    errorPattern: /permission|denied|access/i,
    suggestions: [
      '🔑 Check file permissions with `ls -la`',
      '👤 Try running with different user permissions',
      '📂 Verify the file/directory path is correct',
    ],
  },
  // ... more patterns
];
```

### Configuratie

#### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

#### Environment Variabelen

```bash
TELEGRAM_BOT_TOKEN=123:abc
ZAI_API_KEY=sk-...
CLAUDE_WORKING_DIR=/path/to/project
CLAUDE_CLI_BINARY=claude
CLAUDE_MODEL=glm-4.7
CLAUDE_TIMEOUT=120000
```

---

## ✅ Success Criteria

| Metric | Doel |
|--------|------|
| Test coverage | ≥80% |
| Build success | 100% |
| Type errors | 0 |
| Documentation | 100% public APIs |
| Response time | <2s voor streaming |

---

## 📝 Todo Checklist

### Onmiddellijk
- [ ] `git add -A && git commit -m "feat(streaming): ..."`
- [ ] `npm run build`
- [ ] `git push origin master`

### Week 1
- [ ] Jest installeren
- [ ] `session/manager.ts` tests (90%)
- [ ] `api/methods.ts` tests (85%)
- [ ] `.github/workflows/ci.yml` aanmaken

### Week 2  
- [ ] Confirmation callbacks testen
- [ ] Tool visibility integreren
- [ ] Error suggestions toevoegen aan responses

### Week 3-4
- [ ] ESLint config
- [ ] ARCHITECTURE.md schrijven
- [ ] API.md schrijven

### Maand 2
- [ ] `/claude edit` implementeren
- [ ] Webhook support toevoegen

---

*Document gegenereerd: 5 Januari 2026*  
*Laatste wijziging: Sisyphus AI Agent*
