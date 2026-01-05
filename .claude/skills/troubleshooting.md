---
name: troubleshooting
description: Diagnose and fix common Telegram bot issues with diagnostic flowcharts and solutions. Use this skill when: (1) Bot not responding to messages, (2) Commands not working, (3) API errors occurring, (4) LLM services failing, (5) Performance issues detected.
---

# Troubleshooting Common Issues

## Overview

This skill provides comprehensive troubleshooting guides for common Telegram Bot Plugin issues, with diagnostic flowcharts and step-by-step solutions.

## Quick Diagnostic Flowchart

```
Bot Not Working?
│
├─ Step 1: Check Process Status
│   └─ Run: ps aux | grep "start.js"
│       ├─ Process running? → Step 2
│       └─ Not running? → Start bot: node start.js
│
├─ Step 2: Check Environment
│   └─ Run: cat .env | grep -E "TELEGRAM_BOT_TOKEN|ZAI_API_KEY|MINIMAX_API_KEY"
│       ├─ All variables set? → Step 3
│       └─ Missing variables? → Add to .env
│
├─ Step 3: Test Telegram API
│   └─ Run: curl https://api.telegram.org/bot<TOKEN>/getMe
│       ├─ Valid response? → Step 4
│       └─ Error (401)? → Invalid token, regenerate from BotFather
│
├─ Step 4: Check Claude CLI
│   └─ Run: claude --print -- "test"
│       ├─ Works? → Step 5
│       └─ Error? → Run: claude (authenticate)
│
└─ Step 5: Check Logs
    └─ Run: tail -100 /tmp/bot.log
        ├─ Errors found? → Look up error below
        └─ No obvious errors? → Enable debug mode
```

## Error Reference Guide

| Error Code | Error Message | Cause | Quick Fix |
|------------|---------------|-------|-----------|
| `401` | Unauthorized | Invalid bot token | Regenerate from BotFather |
| `409` | Conflict | Another instance running | Kill existing process |
| `429` | Too Many Requests | Rate limit exceeded | Add delays between messages |
| `500` | Internal Server Error | Server-side issue | Retry with exponential backoff |
| `ECONNREFUSED` | Connection refused | Network/API unavailable | Check internet connection |
| `ENOENT` | File not found | Missing dependency/file | Run `npm install` |
| `ETIMEDOUT` | Connection timeout | Request timeout | Increase timeout value |
| `CLI_TIMEOUT` | Claude CLI timed out | Claude CLI issue | Authenticate or increase timeout |

## Common Issues & Solutions

### Issue: Bot Not Responding

**Symptoms:**
- Messages sent to bot receive no response
- Bot appears offline in Telegram
- Commands don't trigger

**Diagnostic Steps:**

```bash
# 1. Check if process is running
ps aux | grep "node start.js" | grep -v grep

# 2. Check bot logs
tail -50 /tmp/bot.log

# 3. Test Telegram API connection
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/getMe"

# 4. Check environment variables
cat .env | grep TELEGRAM_BOT_TOKEN
```

**Solutions:**

1. **Bot process not running**
   ```bash
   # Start the bot
   cd /path/to/telegram-bot-plugin
   node start.js

   # Or with PM2
   pm2 start telegram-bot

   # Or with systemd
   sudo systemctl start telegram-bot
   ```

2. **Invalid bot token**
   ```bash
   # Regenerate token from BotFather
   # Update .env file
   nano .env
   # TELEGRAM_BOT_TOKEN=new_token_here

   # Restart bot
   pm2 restart telegram-bot
   ```

3. **Network connectivity issues**
   ```bash
   # Test connection to Telegram API
   ping api.telegram.org

   # Check firewall
   sudo ufw status

   # Check DNS
   nslookup api.telegram.org
   ```

### Issue: Commands Not Working

**Symptoms:**
- Specific commands don't respond
- All commands fail
- Command returns error message

**Diagnostic Steps:**

```bash
# 1. Check if command is registered
grep -r "registerCommand('\/your-command'" src/

# 2. Check for syntax errors
npm run build

# 3. Test command manually
# In Telegram: /your-command test-args

# 4. Check logs for errors
tail -100 /tmp/bot.log | grep -i "your-command"
```

**Solutions:**

1. **Command not registered**
   ```typescript
   // Add to src/index.ts
   import { yourCommand } from './features/your-feature';

   commandHandler.registerCommand('/your-command', async (message, args) => {
     trackCommand('/your-command', String(message.chat.id));
     await yourCommand(api, message, args);
   });
   ```

2. **Function export error**
   ```typescript
   // Ensure function is properly exported
   // src/features/your-feature/commands.ts
   export async function yourCommand(api: ApiMethods, message: Message, args: string[]) {
     // Implementation
   }
   ```

3. **TypeScript compilation error**
   ```bash
   # Check build errors
   npm run build

   # Fix type errors
   # Common issues:
   # - Missing imports
   # - Type mismatches
   # - Missing type definitions
   ```

### Issue: Claude CLI Timeout

**Symptoms:**
- Messages timeout after waiting
- Error: "Claude CLI timed out"
- Fallback to other LLM services

**Diagnostic Steps:**

```bash
# 1. Test Claude CLI directly
time claude --print -- "test"

# 2. Check authentication
claude --version

# 3. Check timeout setting
echo $CLAUDE_TIMEOUT

# 4. Test with longer timeout
CLAUDE_TIMEOUT=600000 node start.js
```

**Solutions:**

1. **Claude CLI not authenticated**
   ```bash
   # Run interactive authentication
   claude

   # Verify authentication
   claude --print -- "hello"

   # Restart bot
   pm2 restart telegram-bot
   ```

2. **Timeout too short**
   ```bash
   # Increase timeout in .env
   nano .env
   # CLAUDE_TIMEOUT=600000  # 10 minutes

   # Or set environment variable
   export CLAUDE_TIMEOUT=600000
   pm2 restart telegram-bot
   ```

3. **Working directory issues**
   ```typescript
   // Ensure correct working directory in src/claude-code/service.ts
   const claude = spawn('claude', args, {
     cwd: process.cwd(),  // Should be project root
     env: { ...process.env },
   });
   ```

4. **CLI hanging on JSON output**
   ```bash
   # Try without --output-format json
   # Update spawn arguments in service
   ```

### Issue: Rate Limiting (429 Errors)

**Symptoms:**
- Bots stops sending messages
- Error: "Too Many Requests"
- Messages queued or delayed

**Diagnostic Steps:**

```bash
# 1. Check logs for rate limit errors
grep -i "429\|rate limit" /tmp/bot.log

# 2. Check message frequency
# Count messages in last minute
grep "$(date +%H:%M)" /tmp/bot.log | wc -l

# 3. Test with delay
# Send message, wait 2 seconds, send another
```

**Solutions:**

1. **Add delays between messages**
   ```typescript
   async function sendWithDelay(api: ApiMethods, chatId: string, text: string) {
     await api.sendText(chatId, text);
     await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
   }
   ```

2. **Implement exponential backoff**
   ```typescript
   async function sendWithBackoff(api: ApiMethods, chatId: string, text: string, attempt = 0) {
     try {
       await api.sendText(chatId, text);
     } catch (error) {
       if (error.message.includes('429')) {
         const delay = Math.min(1000 * Math.pow(2, attempt), 60000);
         await new Promise(resolve => setTimeout(resolve, delay));
         return sendWithBackoff(api, chatId, text, attempt + 1);
       }
       throw error;
     }
   }
   ```

3. **Use queue system**
   ```typescript
   import PQueue from 'p-queue';

   const queue = new PQueue({
     concurrency: 1,
     interval: 1000,
     intervalCap: 20, // 20 messages per second
   });

   await queue.add(() => api.sendText(chatId, text));
   ```

### Issue: Database Locked

**Symptoms:**
- Error: "Database is locked"
- Error: "SQLITE_BUSY"
- Commands fail to read/write

**Diagnostic Steps:**

```bash
# 1. Check database file
ls -lh /tmp/telegram-bot/bot.db

# 2. Check for multiple processes
ps aux | grep "node start.js"

# 3. Test database access
sqlite3 /tmp/telegram-bot/bot.db "SELECT 1"
```

**Solutions:**

1. **Multiple bot instances running**
   ```bash
   # Kill all instances
   ps aux | grep "node start.js" | grep -v grep | awk '{print $2}' | xargs kill

   # Start single instance
   node start.js
   ```

2. **Enable WAL mode**
   ```typescript
   // In src/database/index.ts
   const db = new Database('/tmp/telegram-bot/bot.db');
   db.pragma('journal_mode = WAL');
   ```

3. **Increase busy timeout**
   ```typescript
   const db = new Database('/tmp/telegram-bot/bot.db', {
     verbose: console.log,
   });
   db.pragma('busy_timeout = 5000'); // 5 seconds
   ```

4. **Reset database**
   ```bash
   # Backup first
   cp /tmp/telegram-bot/bot.db /tmp/telegram-bot/bot.db.backup

   # Delete and recreate
   rm /tmp/telegram-bot/bot.db
   # Bot will recreate on next start
   ```

### Issue: Memory Leak

**Symptoms:**
- Memory usage increases over time
- Bot becomes slow
- Process crashes with out of memory

**Diagnostic Steps:**

```bash
# 1. Check memory usage
ps aux | grep "node start.js"
# Look at VSZ (virtual memory) and RSS (resident set size)

# 2. Monitor over time
watch -n 5 'ps aux | grep "node start.js"'

# 3. Use Node.js memory profiler
node --inspect start.js
# Then connect with Chrome DevTools
```

**Solutions:**

1. **Enable heap snapshots**
   ```javascript
   // Add to start.js
   if (process.env.MEMORY_PROFILE === 'true') {
     const v8 = require('v8');
     setInterval(() => {
       const heap = v8.getHeapStatistics();
       console.log('Heap usage:', {
         used: heap.used_heap_size / 1024 / 1024,
         total: heap.total_heap_size / 1024 / 1024,
         limit: heap.heap_size_limit / 1024 / 1024,
       });
     }, 60000); // Every minute
   }
   ```

2. **Fix common leak patterns**
   ```typescript
   // Bad: Global arrays that grow forever
   const cache = [];  // ❌

   // Good: Use LRU cache
   import { LRUCache } from 'lru-cache';
   const cache = new LRUCache({ max: 1000 });  // ✅

   // Bad: Event listeners not removed
   client.on('message', handler);  // ❌

   // Good: Remove listeners
   client.on('message', handler);
   client.off('message', handler);  // ✅
   ```

3. **Set memory limits**
   ```bash
   # For systemd
   # In /etc/systemd/system/telegram-bot.service
   [Service]
   MemoryMax=512M

   # For PM2
   pm2 start start.js --max-memory-restart 500M

   # For Node.js
   node --max-old-space-size=512 start.js
   ```

### Issue: All LLM Services Failing

**Symptoms:**
- Error: "All LLM services failed"
- Messages not processed
- Fallback chain exhausted

**Diagnostic Steps:**

```bash
# 1. Check each service

# Claude CLI
claude --print -- "test"

# Z.ai
curl -X POST "https://api.z.ai.com/v1/chat" \
  -H "Authorization: Bearer $ZAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'

# MiniMax
curl -X POST "https://api.minimax.chat/v1/text/chatcompletion" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'
```

**Solutions:**

1. **Claude CLI issue**
   ```bash
   # Re-authenticate
   claude

   # Check version
   claude --version

   # Reinstall if needed
   npm install -g @anthropic-ai/claude-code
   ```

2. **API key issues**
   ```bash
   # Verify keys are set
   echo $ZAI_API_KEY | cut -c1-10
   echo $MINIMAX_API_KEY | cut -c1-10

   # Check keys haven't expired
   # Update in .env if needed
   nano .env
   pm2 restart telegram-bot
   ```

3. **Network issues**
   ```bash
   # Test connectivity
   ping api.anthropic.com
   ping api.z.ai.com
   ping api.minimax.chat

   # Check proxy settings
   echo $HTTP_PROXY
   echo $HTTPS_PROXY
   ```

4. **Rate limiting on APIs**
   ```bash
   # Check API dashboards for limits
   # Implement request queuing
   # Add exponential backoff
   ```

### Issue: WebSocket/Streaming Issues

**Symptoms:**
- Streaming responses hang
- Partial responses only
- Connection drops mid-stream

**Diagnostic Steps:**

```bash
# 1. Check for timeout issues
grep -i "timeout" /tmp/bot.log | tail -20

# 2. Monitor network stability
ping -c 100 api.telegram.org

# 3. Check for memory issues during streaming
# Monitor while bot processes a message
```

**Solutions:**

1. **Increase timeout**
   ```bash
   export CLAUDE_TIMEOUT=600000
   pm2 restart telegram-bot
   ```

2. **Handle stream interruptions**
   ```typescript
   // In src/streaming/handler.ts
   let buffer = '';
   let lastChunkTime = Date.now();

   stream.on('data', (chunk) => {
     buffer += chunk;
     lastChunkTime = Date.now();
   });

   // Detect stale streams
   const staleCheck = setInterval(() => {
     if (Date.now() - lastChunkTime > 30000) {
       stream.destroy();
       clearInterval(staleCheck);
     }
   }, 5000);
   ```

3. **Implement retry logic**
   ```typescript
   async function processWithRetry(chatId: string, message: string, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await processMessage(chatId, message);
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
       }
     }
   }
   ```

## Debug Mode

### Enable Verbose Logging

```bash
# Set debug flag
export DEBUG=true
export NODE_ENV=development

# Restart bot
pm2 restart telegram-bot

# Follow logs
pm2 logs telegram-bot --lines 100
```

### Enable Process Monitoring

```typescript
// Add to src/index.ts
if (process.env.DEBUG === 'true') {
  setInterval(() => {
     const usage = process.cpuUsage();
     const memory = process.memoryUsage();
     console.log('Process stats:', {
       cpu: usage,
       memory: {
         rss: Math.round(memory.rss / 1024 / 1024) + 'MB',
         heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
         heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
       },
     });
  }, 60000);
}
```

### Enable Inspector

```bash
# Start with inspector
node --inspect=0.0.0.0:9229 start.js

# Connect with Chrome DevTools
# Navigate to: chrome://inspect
```

## Performance Issues

### Slow Response Times

**Diagnostic:**

```bash
# Measure response time
time echo "test message" | nc localhost 3000

# Check CPU usage
top -p $(pgrep -f "node start.js")

# Profile with Node.js
node --profile start.js
# After running:
node --prof-process isolate-*.log > profile.txt
```

**Solutions:**

1. **Optimize database queries**
   ```typescript
   // Add indexes
   db.prepare('CREATE INDEX IF NOT EXISTS idx_chat_id ON messages(chat_id)').run();

   // Use prepared statements
   const stmt = db.prepare('SELECT * FROM messages WHERE chat_id = ?');
   const result = stmt.get(chatId);
   ```

2. **Cache frequently accessed data**
   ```typescript
   import NodeCache from 'node-cache';
   const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes

   function getUser(userId: string) {
     let user = cache.get(userId);
     if (!user) {
       user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
       cache.set(userId, user);
     }
     return user;
   }
   ```

3. **Use connection pooling**
   ```typescript
   // For external APIs
   import { Agent } from 'undici';

   const agent = new Agent({
     connections: 10,
     pipelining: 1,
   });

   // Use with fetch
   fetch(url, { dispatcher: agent });
   ```

## Getting Help

### Log Collection

When asking for help, collect these logs:

```bash
# Create debug bundle
mkdir -p /tmp/debug-bundle

# System info
uname -a > /tmp/debug-bundle/system.txt
node --version > /tmp/debug-bundle/node.txt
npm --version > /tmp/debug-bundle/npm.txt

# Environment
env | grep -E "(TELEGRAM|ZAI|MINIMAX|CLAUDE|NODE)" > /tmp/debug-bundle/env.txt

# Logs
tail -500 /tmp/bot.log > /tmp/debug-bundle/bot.log

# Process status
ps aux | grep node > /tmp/debug-bundle/processes.txt

# Config files
cp .env /tmp/debug-bundle/env.txt  # Remove secrets first!
cp package.json /tmp/debug-bundle/

# Create archive
cd /tmp
tar czf debug-bundle.tar.gz debug-bundle/
```

### Useful Commands

```bash
# Quick health check
curl -X POST "https://api.telegram.org/bot<TOKEN>/getMe"

# Test Claude CLI
claude --print -- "test"

# Check bot status
pm2 status
# or
systemctl status telegram-bot

# View recent errors
grep -i "error\|exception\|failed" /tmp/bot.log | tail -50

# Monitor in real-time
tail -f /tmp/bot.log
```

## Prevention Strategies

1. **Regular monitoring**
   - Set up log aggregation
   - Monitor resource usage
   - Track error rates

2. **Automated health checks**
   - Create `/health` endpoint
   - Run periodic tests
   - Alert on failures

3. **Testing**
   - Test fallback chain
   - Load test before deployment
   - Test with staging environment

4. **Documentation**
   - Document all errors encountered
   - Keep troubleshooting notes
   - Update runbooks

5. **Backups**
   - Regular database backups
   - Configuration backups
   - Emergency recovery procedures
