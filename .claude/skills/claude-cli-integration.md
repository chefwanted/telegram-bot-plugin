---
name: claude-cli-integration
description: Best practices for integrating Claude CLI into applications. Use this skill when: (1) Implementing Claude CLI integration, (2) Handling streaming responses, (3) Managing CLI timeouts, (4) Debugging Claude CLI issues, (5) Optimizing Claude CLI performance.
---

# Claude CLI Integration Guide

## Overview

This skill provides comprehensive patterns for integrating Claude CLI into applications, with a focus on the Telegram Bot Plugin implementation.

## Architecture

### Claude CLI Integration Flow

```
User Message (Telegram)
    ↓
Telegram Bot Plugin
    ↓
Claude CLI Service
    ↓
Spawn Claude Process
    ↓
Stream Response
    ↓
Send to Telegram
```

### Key Components

- **Service**: `src/claude-code/service.ts`
- **Handler**: `src/bot/handlers/streaming-message.ts`
- **Configuration**: `CLAUDE_TIMEOUT` environment variable

## Implementation Patterns

### Basic Process Spawning

```typescript
import { spawn } from 'child_process';

export class ClaudeCodeService {
  private config: {
    timeout: number;
    cwd: string;
    env: NodeJS.ProcessEnv;
  };

  constructor(config: { timeout?: number } = {}) {
    this.config = {
      timeout: config.timeout || 300000, // 5 minutes
      cwd: process.cwd(),
      env: { ...process.env },
    };
  }

  async processMessage(
    chatId: string,
    message: string
  ): Promise<{ text: string }> {
    return new Promise((resolve, reject) => {
      const claude = spawn('claude', [
        '--non-interactive',
        '--output-format', 'json',
        '--print', '--',
        message
      ], {
        timeout: this.config.timeout,
        cwd: this.config.cwd,
        env: this.config.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Handle output...
    });
  }
}
```

### Streaming Response Handling

```typescript
async processMessage(
  chatId: string,
  message: string
): Promise<{ text: string }> {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', ['--non-interactive', '--output-format', 'json', '--print', '--', message], {
      timeout: this.config.timeout,
      cwd: this.config.cwd,
      env: this.config.env,
    });

    let responseText = '';
    let buffer = '';

    // Handle stdout (streaming chunks)
    claude.stdout.on('data', (data: Buffer) => {
      buffer += data.toString();

      // Try to parse complete JSON objects
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete chunk in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const response = JSON.parse(line);
          if (response.content) {
            responseText = response.content;
            // Optionally stream to Telegram here
          }
        } catch (e) {
          // Not valid JSON yet, wait for more data
        }
      }
    });

    // Handle stderr (error messages)
    claude.stderr.on('data', (data: Buffer) => {
      const error = data.toString();
      logger.error(`Claude CLI stderr: ${error}`);

      // Detect specific errors
      if (error.includes('not authenticated')) {
        reject(new Error('Claude CLI not authenticated'));
      } else if (error.includes('rate limit')) {
        reject(new Error('Claude API rate limit exceeded'));
      }
    });

    // Handle process exit
    claude.on('close', (code: number) => {
      if (code === 0 && responseText) {
        resolve({ text: responseText });
      } else if (code === 0) {
        reject(new Error('No response from Claude CLI'));
      } else {
        reject(new Error(`Claude CLI exited with code ${code}`));
      }
    });

    // Handle spawn errors
    claude.on('error', (error: Error) => {
      if (error.message.includes('ENOENT')) {
        reject(new Error('Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code'));
      } else {
        reject(error);
      }
    });
  });
}
```

### Timeout Management

```typescript
import { spawn } from 'child_process';

async processMessageWithTimeout(
  chatId: string,
  message: string
): Promise<{ text: string }> {
  return new Promise((resolve, reject) => {
    let timeoutHandle: NodeJS.Timeout;

    const claude = spawn('claude', ['--non-interactive', '--output-format', 'json', '--print', '--', message], {
      timeout: this.config.timeout,
    });

    // Set timeout
    timeoutHandle = setTimeout(() => {
      claude.kill('SIGTERM');
      reject(new Error(`Claude CLI timed out after ${this.config.timeout}ms`));
    }, this.config.timeout);

    // Clear timeout on successful completion
    claude.on('close', (code) => {
      clearTimeout(timeoutHandle);
      // Handle response...
    });
  });
}
```

### Graceful Shutdown

```typescript
async processMessage(
  chatId: string,
  message: string
): Promise<{ text: string }> {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', ['--non-interactive', '--output-format', 'json', '--print', '--', message], {
      timeout: this.config.timeout,
    });

    let isKilled = false;

    const gracefulShutdown = () => {
      if (isKilled) return;
      isKilled = true;

      // Try SIGTERM first
      claude.kill('SIGTERM');

      // Force kill after 5 seconds
      setTimeout(() => {
        try {
          claude.kill('SIGKILL');
        } catch {}
      }, 5000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    claude.on('close', (code) => {
      process.removeListener('SIGTERM', gracefulShutdown);
      process.removeListener('SIGINT', gracefulShutdown);
      // Handle response...
    });
  });
}
```

## Error Handling Patterns

### Authentication Errors

```typescript
claude.stderr.on('data', (data: Buffer) => {
  const error = data.toString();

  if (error.includes('not authenticated') || error.includes('401')) {
    reject(new Error('Claude CLI not authenticated. Run: claude'));
  }
});
```

### Rate Limiting

```typescript
if (error.includes('rate limit') || error.includes('429')) {
  // Extract retry-after if available
  const match = error.match(/retry-after:\s*(\d+)/i);
  const retryAfter = match ? parseInt(match[1]) * 1000 : 60000;

  reject(new Error(`Rate limited. Retry after ${retryAfter}ms`));
}
```

### Timeout Handling

```typescript
// Set timeout on the process itself
const claude = spawn('claude', args, {
  timeout: this.config.timeout,
});

// Also implement application-level timeout
const timeoutId = setTimeout(() => {
  claude.kill('SIGTERM');
  reject(new Error('Process timeout'));
}, this.config.timeout);

claude.on('close', () => clearTimeout(timeoutId));
```

## Performance Optimization

### Connection Pooling

```typescript
class ClaudeCLIProcessPool {
  private processes: Map<string, ChildProcess> = new Map();
  private maxProcesses = 3;

  async acquire(chatId: string): Promise<ChildProcess> {
    // Reuse existing process if available
    if (this.processes.has(chatId)) {
      return this.processes.get(chatId)!;
    }

    // Create new process if under limit
    if (this.processes.size < this.maxProcesses) {
      const claude = spawn('claude', ['--interactive']);
      this.processes.set(chatId, claude);
      return claude;
    }

    // Wait for available process
    return this.waitForAvailableProcess();
  }

  release(chatId: string) {
    const process = this.processes.get(chatId);
    if (process) {
      process.kill();
      this.processes.delete(chatId);
    }
  }
}
```

### Response Streaming

```typescript
// Stream partial responses to Telegram
async streamResponse(
  api: ApiMethods,
  chatId: string,
  claude: ChildProcess
): Promise<string> {
  let fullResponse = '';
  let lastMessageId: number | null = null;

  claude.stdout.on('data', async (data: Buffer) => {
    const chunk = data.toString();
    fullResponse += chunk;

    // Send or update message every 500 characters
    if (fullResponse.length % 500 < chunk.length) {
      if (lastMessageId) {
        await api.editMessageText(chatId, lastMessageId, fullResponse);
      } else {
        const result = await api.sendText(chatId, fullResponse);
        lastMessageId = result.message_id;
      }
    }
  });

  return new Promise((resolve) => {
    claude.on('close', () => resolve(fullResponse));
  });
}
```

## Debugging

### Enable Debug Logging

```typescript
class ClaudeCodeService {
  private debug: boolean;

  constructor(config: { timeout?: number; debug?: boolean } = {}) {
    this.debug = config.debug || process.env.DEBUG === 'true';
  }

  async processMessage(chatId: string, message: string): Promise<{ text: string }> {
    if (this.debug) {
      logger.debug(`Claude CLI input: ${message}`);
      logger.debug(`Timeout: ${this.config.timeout}ms`);
      logger.debug(`CWD: ${this.config.cwd}`);
    }

    // ... rest of implementation
  }
}
```

### Log All Process Events

```typescript
const claude = spawn('claude', args);

claude.on('spawn', () => {
  logger.debug('Claude CLI process spawned');
});

claude.on('error', (error) => {
  logger.error(`Claude CLI spawn error: ${error.message}`);
});

claude.on('exit', (code, signal) => {
  logger.debug(`Claude CLI exited: code=${code}, signal=${signal}`);
});
```

## Testing

### Mock Child Process

```typescript
// tests/unit/claude-code.test.ts
jest.mock('child_process');

describe('ClaudeCodeService', () => {
  let mockSpawn: jest.MockedFunction<typeof spawn>;
  let service: ClaudeCodeService;

  beforeEach(() => {
    mockSpawn = require('child_process').spawn;
    service = new ClaudeCodeService({ timeout: 30000 });
  });

  it('should process message successfully', async () => {
    const mockProcess = {
      stdout: {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('{"content": "Test response"}\n'));
          }
        }),
      },
      stderr: { on: jest.fn() },
      on: jest.fn((event, callback) => {
        if (event === 'close') callback(0);
      }),
    };

    mockSpawn.mockReturnValue(mockProcess as any);

    const result = await service.processMessage('12345', 'Hello');

    expect(result).toEqual({ text: 'Test response' });
    expect(mockSpawn).toHaveBeenCalledWith(
      'claude',
      ['--non-interactive', '--output-format', 'json', '--print', '--', 'Hello'],
      expect.objectContaining({
        timeout: 30000,
      })
    );
  });
});
```

## Common Issues & Solutions

### Issue: CLI Not Found

**Error**: `ENOENT: claude command not found`

**Solution**:
```bash
npm install -g @anthropic-ai/claude-code
```

### Issue: Authentication Failed

**Error**: `Claude CLI not authenticated`

**Solution**:
```bash
# Run interactive authentication
claude

# Verify authentication
claude --print -- "test"
```

### Issue: Timeout

**Error**: `Claude CLI timed out after 300000ms`

**Solutions**:
```bash
# Increase timeout
export CLAUDE_TIMEOUT=600000  # 10 minutes

# Or reduce message complexity
# Or check for slow network
```

### Issue: JSON Parsing Error

**Error**: `Unexpected token in JSON`

**Solution**:
```typescript
// Handle incomplete chunks
let buffer = '';
claude.stdout.on('data', (data) => {
  buffer += data.toString();

  // Only parse complete lines
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        // Handle response
      } catch (e) {
        logger.error(`JSON parse error: ${e.message}`);
      }
    }
  }
});
```

### Issue: Process Hangs

**Error**: Process never exits

**Solution**:
```typescript
// Always kill process on timeout
const timeout = setTimeout(() => {
  claude.kill('SIGTERM');

  // Force kill if SIGTERM doesn't work
  setTimeout(() => {
    try {
      claude.kill('SIGKILL');
    } catch {}
  }, 5000);
}, this.config.timeout);

claude.on('close', () => clearTimeout(timeout));
```

## Environment Configuration

### Required Environment Variables

```bash
# Claude CLI authentication (handled by CLI itself)
# Run: claude

# Timeout configuration
CLAUDE_TIMEOUT=300000  # milliseconds

# Debug mode
DEBUG=true  # optional

# Working directory (optional, defaults to process.cwd())
CLAUDE_CWD=/path/to/working/directory
```

### Configuration in Service

```typescript
export interface ClaudeConfig {
  timeout?: number;
  cwd?: string;
  debug?: boolean;
  maxRetries?: number;
}

export class ClaudeCodeService {
  constructor(config: ClaudeConfig = {}) {
    this.config = {
      timeout: config.timeout || parseInt(process.env.CLAUDE_TIMEOUT || '300000'),
      cwd: config.cwd || process.env.CLADE_CWD || process.cwd(),
      debug: config.debug || process.env.DEBUG === 'true',
      maxRetries: config.maxRetries || 2,
    };
  }
}
```

## Best Practices

1. **Always set timeouts**: Prevents indefinite hangs
2. **Handle all process events**: spawn, error, exit, close
3. **Clean up resources**: Kill processes, remove listeners
4. **Log everything**: Helps with debugging
5. **Validate authentication**: Before processing messages
6. **Use non-interactive mode**: Required for automation
7. **Handle partial JSON**: Streaming responses may be incomplete
8. **Implement retry logic**: For transient failures
9. **Monitor process count**: Don't spawn unlimited processes
10. **Test error paths**: Not just success cases

## Security Considerations

1. **Sanitize input**: Escape shell arguments
2. **Don't log sensitive data**: API keys, user messages
3. **Validate responses**: Check for malicious content
4. **Use environment variables**: For configuration
5. **Limit resource usage**: Process count, memory, CPU
6. **Audit logs**: Track CLI usage

## Performance Tips

1. **Reuse processes**: When possible (connection pooling)
2. **Stream responses**: Don't wait for complete response
3. **Compress output**: If response is very large
4. **Cache responses**: For repeated queries
5. **Use timeouts**: Prevent resource waste
6. **Monitor metrics**: Track latency, success rate
7. **Load balance**: Distribute across multiple CLI instances
