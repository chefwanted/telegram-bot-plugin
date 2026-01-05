# Claude CLI Setup Guide

This Telegram bot uses Claude CLI (Claude Code) for AI interactions. Follow these steps to set it up properly.

## Prerequisites

- Claude CLI installed (https://github.com/anthropics/claude-cli)
- Anthropic API key from https://console.anthropic.com

## Installation

### 1. Install Claude CLI

```bash
# macOS/Linux
curl -fsSL https://install.claude.ai | sh

# Or download from GitHub releases
# https://github.com/anthropics/claude-cli/releases
```

### 2. Verify Installation

```bash
claude --version
# Should show: 2.0.76 (Claude Code) or similar
```

### 3. Authenticate

Run Claude CLI interactively to set up authentication:

```bash
claude
```

This will:
1. Prompt you for your Anthropic API key
2. Save credentials to `~/.config/claude/`
3. Create initial configuration

Alternatively, set up authentication non-interactively:

```bash
# Set API key via environment variable
export ANTHROPIC_API_KEY="your-api-key-here"

# Or create config manually
mkdir -p ~/.config/claude
echo '{"apiKey":"your-api-key-here"}' > ~/.config/claude/config.json
```

### 4. Test Claude CLI

```bash
claude --print -- "Hello, how are you?"
```

If this works and returns a response, your setup is complete!

## Troubleshooting

### Error: "Claude CLI timed out"

**Cause:** Claude CLI is not authenticated or cannot connect to Anthropic API.

**Solution:**
1. Run `claude` in terminal to authenticate interactively
2. Check your internet connection
3. Verify API key is valid at https://console.anthropic.com

### Error: "Claude CLI not found"

**Cause:** Claude CLI is not installed or not in PATH.

**Solution:**
1. Install Claude CLI (see Installation above)
2. Verify with `which claude`
3. Add to PATH if needed: `export PATH="$HOME/.local/bin:$PATH"`

### Error: "Authentication error"

**Cause:** API key is missing, invalid, or expired.

**Solution:**
1. Get a new API key from https://console.anthropic.com
2. Re-authenticate with `claude`
3. Check API key has required permissions

### Error: "Permission denied"

**Cause:** Claude CLI doesn't have permission to access workspace files.

**Solution:**
1. Check file permissions: `ls -la`
2. Ensure bot user has read/write access to working directory
3. Consider using `--dangerously-skip-permissions` for trusted environments

## Bot Configuration

### Environment Variables

Configure Claude CLI behavior via environment variables in your bot:

```bash
# Claude CLI binary path (default: "claude")
export CLAUDE_CLI_BINARY="/usr/local/bin/claude"

# Working directory (default: current directory)
export CLAUDE_WORKING_DIR="/home/user/projects"

# Model to use (default: auto-selected)
export CLAUDE_MODEL="claude-3-5-sonnet-20241022"

# Timeout in milliseconds (default: 120000 = 2 minutes)
export CLAUDE_TIMEOUT="180000"

# System prompt (optional)
export CLAUDE_SYSTEM_PROMPT="You are a helpful assistant in a Telegram chat."
```

### Telegram Bot Start

```bash
# Start bot with environment variables
cd /path/to/telegram-bot-plugin
npm start
```

## Advanced Configuration

### Allowed/Denied Tools

Restrict which tools Claude can use:

```typescript
// In your bot configuration
const claudeCodeService = createClaudeCodeService({
  allowedTools: ['Read', 'Write', 'Bash'],  // Only these tools
  deniedTools: ['Delete', 'Execute'],       // Exclude these
});
```

### Session Management

Sessions are automatically managed per Telegram chat:
- Each chat gets its own session
- Sessions persist between messages
- Use `/claude_clear` to start a new session
- Use `/claude status` to view session info

### Working Directory

By default, Claude CLI works in the bot's current directory. To change:

```bash
export CLAUDE_WORKING_DIR="/path/to/your/project"
```

Or per session in code:

```typescript
await claudeCodeService.createNewSession(chatId, 'My Session', {
  workingDir: '/path/to/project'
});
```

## Usage Examples

### Basic Chat

User: `Hello, how are you?`
Bot: Responds using Claude Code

### Developer Commands

```
/project - View project structure
/read <file> - Read a file
/write <file> <content> - Write to file
/code <instruction> - Generate code
/git - Git status and operations
```

### Session Management

```
/claude status - View current session info
/claude_clear - Start new session
/claude - Full session management menu
```

## Getting Help

If you encounter issues:

1. Check bot logs: `/logs`
2. Test Claude CLI manually: `claude --print -- "test"`
3. Verify authentication: `ls -la ~/.config/claude/`
4. Check bot status: `/status`
5. See error suggestions in bot messages

## Security Notes

⚠️ **Important Security Considerations:**

1. **API Key Security**: Keep your Anthropic API key secret
2. **File Access**: Claude has access to files in the working directory
3. **Tool Permissions**: Be careful with `Bash` and `Execute` tools
4. **User Confirmation**: Bot requests confirmation for dangerous operations
5. **Rate Limits**: Monitor your Anthropic API usage

## Resources

- Claude CLI: https://github.com/anthropics/claude-cli
- Anthropic Console: https://console.anthropic.com
- API Documentation: https://docs.anthropic.com
- Bot Documentation: ../README.md
