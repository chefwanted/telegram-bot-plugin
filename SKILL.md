---
name: telegram-bot-plugin
description: Comprehensive development toolkit for the Telegram Bot Plugin (telegram-bot-plugin). A feature-rich Telegram bot with multi-LLM support (Claude CLI optional, Z.ai GLM-4.7, MiniMax v2.1, Mistral), streaming responses, and 39+ commands. Use this skill when: (1) Adding new features or commands to the bot, (2) Fixing bugs in existing services (Claude Code, Z.ai, MiniMax, Mistral), (3) Integrating new LLM providers or fallback mechanisms, (4) Updating bot configuration or environment variables, (5) Debugging timeout, authentication, or API issues, (6) Modifying streaming message handlers or command routing. The bot uses TypeScript with a modular architecture where features are self-contained modules in src/features/.
---

# Telegram Bot Plugin Development

## Quick Start

### Build & Run

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start bot
node start.js

# Run tests
npm test
```

### Environment Setup

Required `.env` variables:

```bash
TELEGRAM_BOT_TOKEN=123:abc
ZAI_API_KEY=sk-...           # Fallback LLM
MINIMAX_API_KEY=eyJ...        # Additional fallback
MISTRAL_API_KEY=sk-...        # Additional provider
LLM_DEFAULT_PROVIDER=zai      # Optional default provider
MISTRAL_MODEL=mistral-small-latest
ZAI_MODEL=glm-4.7
MINIMAX_MODEL=MiniMax-v2.1
MISTRAL_DEV_MODEL=codestral-latest
ZAI_DEV_MODEL=
MINIMAX_DEV_MODEL=
CLAUDE_TIMEOUT=300000        # 5 min (default)
```

### Claude CLI Authentication

The bot requires Claude CLI to be authenticated:

```bash
claude  # Authenticate interactively
claude --print -- "test"  # Verify
```

## Architecture Overview

### Core Components

```
src/
├── index.ts              # Main plugin entry point
├── bot/                  # Telegram bot core
│   ├── index.ts          # Bot factory
│   ├── handlers/         # Message & command handlers
│   └── commands/         # Individual commands
├── claude-code/          # Claude CLI integration
├── zai/                  # Z.ai GLM-4.7 service
├── minimax/              # MiniMax v2.1 + Lite service
├── streaming/            # Streaming response handlers
├── features/             # Modular features (17+)
├── api/                  # Telegram API client
├── session/              # Session management
├── database/             # SQLite storage
└── utils/                # Utilities (logger, config, version)
```

### Multi-LLM Fallback Chain

1. **Z.ai GLM-4.7** - Default API provider
2. **MiniMax v2.1** - Secondary fallback
3. **Mistral** - Additional fallback
4. **Claude CLI** (optional) - Enable per chat with `/llm set claude-cli`

### Command Registration Flow

Commands are registered in `src/index.ts`:

```typescript
commandHandler.registerCommand('/command', async (message, args) => {
  trackCommand('/command', String(message.chat.id));
  await commandFunction(api, message, args);
});
```

## Adding New Features

### Feature Structure

Create in `src/features/<feature-name>/`:

```
feature-name/
├── index.ts        # Exports command functions
├── types.ts        # Feature-specific types
├── commands.ts     # Command handlers
└── service.ts      # Business logic
```

### Example: Adding a Simple Command

**1. Create feature directory:**

```bash
mkdir -p src/features/example
```

**2. Create `src/features/example/index.ts`:**

```typescript
export async function exampleCommand(api: ApiMethods, message: Message, args: string[]) {
  const chatId = message.chat.id;
  await api.sendText(chatId, 'Example response!');
}
```

**3. Register in `src/index.ts`:**

```typescript
import { exampleCommand } from './features/example';

commandHandler.registerCommand('/example', async (message, args) => {
  trackCommand('/example', String(message.chat.id));
  await exampleCommand(api, message, args);
});
```

### Feature with Database

For features needing persistence:

```typescript
import { getDatabase } from '../database';

// Query database
const db = getDatabase();
const result = db.prepare('SELECT * FROM table WHERE id = ?').get(chatId);
```

See `references/database-schema.md` for table structures.

## LLM Integration

### Adding a New LLM Provider

**1. Create service in `src/<provider>/`:**

```typescript
// src/<provider>/service.ts
export class ProviderService {
  async processMessage(chatId: string, message: string): Promise<{text: string}> {
    // Implementation
  }
}
```

**2. Add fallback logic:**

```typescript
// In src/index.ts constructor
if (config.providerApiKey) {
  this.providerService = new ProviderService({...});
}
```

**3. Update message handler:**

```typescript
// In streaming-message.ts, add fallback chain
try {
  return await claudeCodeService.processMessage(...);
} catch (error) {
  if (zaiService) return await zaiService.processMessage(...);
  if (providerService) return await providerService.processMessage(...);
}
```

### LLM Service Interface

All LLM services must implement:

```typescript
interface LLMService {
  processMessage(chatId: string, message: string): Promise<{text: string}>;
  processDeveloperMessage?(chatId: string, message: string): Promise<{text: string}>;
}
```

## Common Development Tasks

### Adding a New Command

1. Create command handler in feature module
2. Import in `src/index.ts`
3. Register with `commandHandler.registerCommand()`
4. Add tracking with `trackCommand()`

### Fixing Timeout Issues

Claude CLI timeout is controlled by `CLAUDE_TIMEOUT` (default: 300000ms = 5min).

**Common causes:**
- Claude CLI not authenticated
- `--output-format json` causing hang
- Working directory issues

**Fix locations:**
- `src/claude-code/service.ts` - timeout configuration
- `src/index.ts` - CLAUDE_TIMEOUT environment variable

### Debugging Message Flow

1. Bot receives message via Telegram API
2. Command handler or message handler processes
3. Streaming handler creates response
4. Sent back via `api.sendText()`

**Debug logs:**

```bash
# Check bot logs
tail -f /tmp/bot.log

# View recent errors
tail -100 /tmp/bot.log | grep ERROR
```

### Version Updates

Update `src/utils/version.ts`:

```typescript
cachedInfo = {
  packageVersion,
  pluginVersion: '2.3.0',  // Update this
  lastUpdated: new Date().toISOString().split('T')[0],
  highlights: [
    '🆕 Your new feature',
    // ...
  ],
};
```

## Troubleshooting

### "Claude CLI timed out"

**Cause:** Claude CLI not authenticated or timeout too short

**Solution:**
```bash
claude  # Authenticate
export CLAUDE_TIMEOUT=300000  # Increase to 5 minutes
```

### Build Errors

**Common TypeScript errors:**

- Missing imports: Add proper imports for logger, types
- Type mismatches: Check interfaces in `src/types/`
- Module resolution: Ensure paths are correct

**Fix:**
```bash
npm run build  # Check specific errors
npm run build 2>&1 | grep error  # Filter errors only
```

### Bot Not Responding

**Check:**
1. Bot process running: `ps aux | grep start.js`
2. Environment variables: `cat .env`
3. Telegram API: `curl https://api.telegram.org/bot<TOKEN>/getMe`
4. Bot logs: `tail -50 /tmp/bot.log`

### Database Issues

Database location: `/tmp/telegram-bot/bot.db`

**Reset database:**
```bash
rm /tmp/telegram-bot/bot.db
# Bot will recreate on next start
```

## Testing

### Run Tests

```bash
npm test
npm run test:coverage
```

### Manual Testing

```bash
# Start bot
node start.js

# In Telegram, test commands:
/start
/help
/status
/version
```

### Test LLM Fallbacks

1. Set invalid Claude CLI credentials
2. Send message to bot
3. Verify fallback to Z.ai/MiniMax works

## Deployment

### Production Checklist

- [ ] All tests passing
- [ ] Build succeeds: `npm run build`
- [ ] Environment variables set
- [ ] Claude CLI authenticated
- [ ] Bot token valid
- [ ] Database backup (if needed)

### Restart Bot

```bash
# Kill existing
ps aux | grep "start.js" | grep -v grep | awk '{print $2}' | xargs kill

# Start new
nohup node start.js > /tmp/bot.log 2>&1 &

# Check logs
tail -f /tmp/bot.log
```

## Development Automation (Hookify & Skills)

This section documents recommended Hookify hooks and Claude Code skills for efficient Telegram bot development.

### 🪝 Hookify Hooks

Hookify hooks prevent common mistakes and enforce best practices during development. These hooks are stored in `.claude/hookify.*.local.md` files.

#### Security & Safety Hooks

**Prevent Hardcoded Secrets**
```markdown
---
name: detect-secrets
enabled: true
event: file
pattern: (TELEGRAM_BOT_TOKEN|ZAI_API_KEY|MINIMAX_API_KEY|CLAUDE_API_KEY)\s*=\s*['"][^'\"]{10,}
action: warn
---

⚠️ **Potential hardcoded secret detected!**

API keys or tokens appear to be hardcoded in the file. Please use environment variables instead:

**Bad:**
```typescript
const token = '123456:ABC-DEF1234...'
```

**Good:**
```typescript
const token = process.env.TELEGRAM_BOT_TOKEN;
```

Move secrets to `.env` file and reference via `process.env`.
```

**Block Dangerous Commands**
```markdown
---
name: block-dangerous-rm
enabled: true
event: bash
pattern: rm\s+-rf\s+(?!\/tmp\/|\/dev\/null|\.+\/).*\$
action: block
---

🚫 **Dangerous rm -rf command blocked!**

This command could delete important files outside of /tmp or safe directories.

**If you really need this:**
1. Verify the path is correct
2. Use the hook's bypass mechanism if available
3. Consider using a more specific path

**Safe alternatives:**
- `rm -rf /tmp/bot-test-files`
- `rm specific-file.txt`
```

**Prevent Insecure File Permissions**
```markdown
---
name: block-chmod-777
enabled: true
event: bash
pattern: chmod\s+777
action: warn
---

⚠️ **chmod 777 is a security risk!**

Setting permissions to 777 makes files readable/writable by everyone.

**Better alternatives:**
- Directories: `chmod 755` (rwxr-xr-x)
- Scripts: `chmod 744` (rwxr--r--)
- Data files: `chmod 644` (rw-r--r--)

**Example:**
```bash
chmod 755 dist/
chmod 644 dist/index.js
```
```

#### Code Quality Hooks

**Remove Debug Code Before Commit**
```markdown
---
name: detect-debug-code
enabled: true
event: file
pattern: (console\.log\(|console\.debug\(|console\.warn\(|debugger\s*;)
action: warn
---

🐛 **Debug code detected!**

This file contains debug statements that should be removed before committing:

**Found:**
- `console.log()`, `console.debug()`, `console.warn()`
- `debugger;` statements

**Action required:**
1. Remove unnecessary debug logging
2. Use proper logger: `import { logger } from './utils/logger'`
3. For production debugging, use logger with appropriate levels

**Exception:** Debug code in test files is acceptable.
```

**Enforce TypeScript Compilation**
```markdown
---
name: require-ts-compile
enabled: true
event: stop
pattern: .*
action: warn
---

⚡ **TypeScript compilation check!**

Before stopping work, ensure TypeScript compiles successfully:

```bash
npm run build
```

**Check for:**
- Type errors
- Missing imports
- Module resolution issues

**Fix common errors:**
- Missing types: Install `@types/*` packages
- Import errors: Verify file paths and exports
- Type mismatches: Check interfaces in `src/types/`
```

#### Testing Hooks

**Require Tests Before Finishing**
```markdown
---
name: require-tests
enabled: true
event: stop
pattern: .*
action: warn
---

🧪 **Test coverage check!**

Before finishing work, ensure:

1. **Unit tests** written for new features
2. **Tests passing:** `npm test`
3. **New code** is tested

**Quick test:**
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/features/new-feature.test.ts
```

**Test guidelines:**
- Test command handlers
- Test LLM service integrations
- Test error handling paths
- Mock external API calls

**If no tests exist yet:**
- Document why tests aren't needed (e.g., trivial change)
- Create TODO for adding tests later
```

#### Git Workflow Hooks

**Enforce Conventional Commits**
```markdown
---
name: conventional-commits
enabled: true
event: bash
pattern: git\s+commit\s+-m\s+'(?!feat|fix|docs|style|refactor|test|chore|ci|perf|revert):
action: warn
---

📝 **Use conventional commit format!**

Commit messages should follow the format: `type(scope): description`

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks
- `ci:` - CI/CD changes
- `perf:` - Performance improvements
- `revert:` - Revert a previous commit

**Examples:**
```bash
git commit -m "feat(claude): add streaming response support"
git commit -m "fix(minimax): handle API timeout errors"
git commit -m "docs: update README with setup instructions"
git commit -m "test: add unit tests for command handler"
```

**Scope (optional):**
- `claude` - Claude CLI integration
- `minimax` - MiniMax service
- `zai` - Z.ai GLM service
- `bot` - Telegram bot core
- `streaming` - Message streaming
- `database` - Database operations
```

#### Telegram Bot Specific Hooks

**Environment Variables Check**
```markdown
---
name: check-env-vars
enabled: true
event: bash
pattern: node\s+start\.js
action: warn
---

🔧 **Environment variables check!**

Before starting the bot, verify all required environment variables are set:

```bash
# Check if .env exists
ls -la .env

# Verify variables (don't echo the actual values!)
grep -E 'TELEGRAM_BOT_TOKEN|ZAI_API_KEY|MINIMAX_API_KEY' .env | cut -d= -f1
```

**Required variables:**
- `TELEGRAM_BOT_TOKEN` - Bot token from BotFather
- `ZAI_API_KEY` - Z.ai API key (fallback)
- `MINIMAX_API_KEY` - MiniMax API key (optional)
- `CLAUDE_TIMEOUT` - Claude CLI timeout in ms (optional, default: 300000)

**If missing:**
1. Copy `.env.example` to `.env`
2. Fill in the required values
3. Restart bot
```

**Rate Limiting Awareness**
```markdown
---
name: rate-limit-warning
enabled: true
event: file
pattern: (setInterval|setTimeout)\s*\(\s*\(\)\s*=>\s*\{[^}]*api\.send
action: warn
---

⚠️ **Potential rate limit issue!**

Automated messages to Telegram API may hit rate limits.

**Telegram API limits:**
- 30 messages per second to different users
- 20 messages per minute to same group
- 1 message per second to same user

**Best practices:**
```typescript
// Bad - no delay
for (const user of users) {
  await api.sendText(user.id, message);
}

// Good - add delay
for (const user of users) {
  await api.sendText(user.id, message);
  await new Promise(resolve => setTimeout(resolve, 1000));
}

// Better - use batch sending
await Promise.all(
  users.map(user => api.sendText(user.id, message))
);
```

**For bulk messages:**
- Use queues (bull, bee-queue)
- Implement exponential backoff
- Monitor `429 Too Many Requests` errors
```

### 📚 Recommended Claude Code Skills

Skills document best practices and provide reusable patterns. These can be activated in Claude Code.

#### Skill: Telegram Bot Testing

**Purpose:** Testing patterns and strategies for Telegram bots

**Use when:**
- Writing tests for bot commands
- Testing LLM service integrations
- Mocking Telegram API responses

**Key patterns:**

```typescript
// Mock Telegram API
const mockApi = {
  sendText: jest.fn().mockResolvedValue({ message_id: 1 }),
  editMessageText: jest.fn().mockResolvedValue(true),
};

// Test command handler
describe('/status command', () => {
  it('should return bot status', async () => {
    await statusCommand(mockApi, mockMessage, []);
    expect(mockApi.sendText).toHaveBeenCalledWith(
      mockMessage.chat.id,
      expect.stringContaining('Bot Status')
    );
  });
});

// Test LLM fallback
describe('LLM Fallback', () => {
  it('should fallback to Z.ai when Claude fails', async () => {
    mockClaudeService.processMessage.mockRejectedValue(new Error('Timeout'));
    const result = await handleMessage(mockMessage);
    expect(mockZaiService.processMessage).toHaveBeenCalled();
  });
});
```

#### Skill: Multi-LLM Integration Guide

**Purpose:** Guide for adding new LLM providers

**Use when:**
- Integrating a new AI service
- Implementing fallback mechanisms
- Debugging LLM service issues

**Integration checklist:**

1. **Create service class** in `src/<provider>/service.ts`
2. **Implement interface:**
   ```typescript
   interface LLMService {
     processMessage(chatId: string, message: string): Promise<Response>;
     processDeveloperMessage?(chatId: string, message: string): Promise<Response>;
   }
   ```
3. **Add to config** in `src/types/plugin.ts` and `src/utils/config.ts`
4. **Register in main plugin** in `src/index.ts`
5. **Add fallback logic** in streaming message handler
6. **Write tests** for the new service
7. **Update documentation** (README, SKILL.md)

**Error handling patterns:**

```typescript
try {
  return await primaryService.processMessage(chatId, message);
} catch (error) {
  logger.error(`Primary service failed: ${error.message}`);

  if (fallbackService) {
    logger.info('Attempting fallback service...');
    try {
      return await fallbackService.processMessage(chatId, message);
    } catch (fallbackError) {
      logger.error(`Fallback service failed: ${fallbackError.message}`);
    }
  }

  throw new Error('All LLM services failed');
}
```

#### Skill: Claude CLI Integration Patterns

**Purpose:** Best practices for integrating Claude CLI

**Use when:**
- Debugging Claude CLI issues
- Handling streaming responses
- Managing CLI timeouts

**Key patterns:**

```typescript
// Spawn Claude CLI process
const claude = spawn('claude', [
  '--non-interactive',
  '--output-format', 'json',
  '--print', '--',
  message
], {
  timeout: config.claudeTimeout || 300000,
  cwd: process.cwd(),
  env: { ...process.env, HOME: process.env.HOME }
});

// Handle streaming output
claude.stdout.on('data', (data) => {
  const chunk = data.toString();
  try {
    const response = JSON.parse(chunk);
    // Handle streaming response
    sendToTelegram(response.content);
  } catch {
    // Accumulate incomplete JSON
  }
});

// Timeout handling
const timeout = setTimeout(() => {
  claude.kill('SIGTERM');
}, config.claudeTimeout);

claude.on('close', () => clearTimeout(timeout));
```

**Common issues:**
- CLI not authenticated → Run `claude` interactively
- Timeout too short → Increase `CLAUDE_TIMEOUT`
- Working directory issues → Verify `cwd: process.cwd()`
- JSON parsing errors → Handle incomplete chunks

#### Skill: Production Deployment

**Purpose:** Deploy Telegram bots to production

**Use when:**
- Deploying bot to server
- Setting up process management
- Configuring monitoring

**Deployment checklist:**

```bash
# 1. Build project
npm run build
npm prune --production

# 2. Setup environment
cp .env.example .env
nano .env  # Edit with production values

# 3. Setup process manager (PM2)
npm install -g pm2
pm2 start start.js --name telegram-bot
pm2 save
pm2 startup  # Copy output command

# 4. Or use systemd
sudo nano /etc/systemd/system/telegram-bot.service
```

**Systemd service example:**

```ini
[Unit]
Description=Telegram Bot Plugin
After=network.target

[Service]
Type=simple
User=botuser
WorkingDirectory=/opt/telegram-bot-plugin
ExecStart=/usr/bin/node start.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/telegram-bot-plugin/.env

[Install]
WantedBy=multi-user.target
```

**Monitoring:**

```bash
# PM2 monitoring
pm2 monit
pm2 logs telegram-bot

# Systemd
sudo journalctl -u telegram-bot -f

# Custom logs
tail -f /tmp/bot.log
```

#### Skill: Troubleshooting Common Issues

**Purpose:** Diagnose and fix common Telegram bot issues

**Use when:**
- Bot not responding
- Commands not working
- API errors occurring

**Diagnostic flowchart:**

```
Bot not responding?
├─ Check process: ps aux | grep start.js
│  └─ Not running? → Check logs: tail -100 /tmp/bot.log
├─ Check environment: cat .env
│  └─ Missing vars? → Add to .env
├─ Test Telegram API: curl https://api.telegram.org/bot<TOKEN>/getMe
│  └─ Invalid token? → Regenerate from BotFather
└─ Check Claude CLI: claude --print -- "test"
   └─ Not authenticated? → Run claude
```

**Common errors and solutions:**

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid bot token | Regenerate token from BotFather |
| `429 Too Many Requests` | Rate limit hit | Add delays between messages |
| `Cli timed out` | Claude CLI issue | Authenticate or increase timeout |
| `Cannot find module` | Dependency missing | Run `npm install` |
| `ECONNREFUSED` | API unreachable | Check internet connection |

## Resources

### Documentation

- `README.md` - Installation and setup
- `docs/CLAUDE_CLI_SETUP.md` - Claude CLI guide
- `docs/TIMEOUT_FIX.md` - Timeout troubleshooting

### Configuration

- `.env.example` - Environment template
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript config

### Key Files

- `src/index.ts` - Main plugin setup
- `start.js` - Entry point
- `src/bot/handlers/streaming-message.ts` - Message handling
- `src/claude-code/service.ts` - Claude CLI integration
