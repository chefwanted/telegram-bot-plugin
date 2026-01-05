---
name: multi-llm-integration
description: Guide for integrating new LLM providers into the Telegram Bot Plugin. Use this skill when: (1) Adding a new AI service provider, (2) Implementing fallback mechanisms, (3) Updating LLM service configurations, (4) Debugging LLM integration issues, (5) Comparing different LLM providers.
---

# Multi-LLM Integration Guide

## Overview

The Telegram Bot Plugin uses a sophisticated multi-LLM fallback system to ensure reliable AI responses. This guide explains how to integrate new LLM providers.

## Current Architecture

### Fallback Chain

```
User Message
    ↓
Claude CLI (Primary)
    ↓ (if fails)
Z.ai GLM-4.7 (First Fallback)
    ↓ (if fails)
MiniMax v2.1 (Second Fallback)
    ↓ (if fails)
MiniMax-Lite (Last Resort)
```

### Service Interface

All LLM services must implement:

```typescript
interface LLMService {
  processMessage(
    chatId: string,
    message: string
  ): Promise<{ text: string }>;

  processDeveloperMessage?(
    chatId: string,
    message: string
  ): Promise<{ text: string }>;
}
```

## Integration Checklist

Use this checklist when adding a new LLM provider:

- [ ] 1. Create service class in `src/<provider>/service.ts`
- [ ] 2. Add provider type to `src/types/plugin.ts`
- [ ] 3. Add configuration to `src/utils/config.ts`
- [ ] 4. Register service in `src/index.ts` constructor
- [ ] 5. Add fallback logic in message handler
- [ ] 6. Write unit tests
- [ ] 7. Update environment documentation
- [ ] 8. Test fallback chain
- [ ] 9. Update README.md

## Step-by-Step Integration

### Step 1: Create Service Class

Create `src/<provider>/service.ts`:

```typescript
import { spawn } from 'child_process';
import { logger } from '../utils/logger';

export interface ProviderConfig {
  apiKey: string;
  apiUrl?: string;
  model?: string;
  timeout?: number;
  maxRetries?: number;
}

export class ProviderService {
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      ...config,
    };
  }

  async processMessage(
    chatId: string,
    message: string
  ): Promise<{ text: string }> {
    try {
      return await this._callProviderAPI(chatId, message);
    } catch (error) {
      logger.error(`Provider service error: ${error.message}`);

      // Implement retry logic
      if (this.config.maxRetries! > 0) {
        return await this._retryWithBackoff(chatId, message);
      }

      throw error;
    }
  }

  async processDeveloperMessage(
    chatId: string,
    message: string
  ): Promise<{ text: string }> {
    // Same as regular message or with special handling
    return this.processMessage(chatId, message);
  }

  private async _callProviderAPI(
    chatId: string,
    message: string
  ): Promise<{ text: string }> {
    // Implementation depends on provider
    // Example: HTTP API call
    const response = await fetch(this.config.apiUrl || 'https://api.example.com/v1/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model || 'default-model',
        messages: [{ role: 'user', content: message }],
      }),
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return { text: data.choices[0].message.content };
  }

  private async _retryWithBackoff(
    chatId: string,
    message: string,
    attempt: number = 0
  ): Promise<{ text: string }> {
    const delay = Math.min(1000 * Math.pow(2, attempt), 10000);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      return await this._callProviderAPI(chatId, message);
    } catch (error) {
      if (attempt < this.config.maxRetries! - 1) {
        return this._retryWithBackoff(chatId, message, attempt + 1);
      }
      throw error;
    }
  }
}
```

### Step 2: Add Provider Type

Update `src/types/plugin.ts`:

```typescript
export interface PluginConfig {
  telegramBotToken: string;
  claudeTimeout?: number;
  zaiApiKey?: string;
  minimaxApiKey?: string;
  providerApiKey?: string;  // Add this
  providerModel?: string;   // Add this
  providerTimeout?: number; // Add this
}
```

### Step 3: Add Configuration

Update `src/utils/config.ts`:

```typescript
export function loadConfig(): PluginConfig {
  return {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    claudeTimeout: parseInt(process.env.CLAUDE_TIMEOUT || '300000'),
    zaiApiKey: process.env.ZAI_API_KEY,
    minimaxApiKey: process.env.MINIMAX_API_KEY,
    providerApiKey: process.env.PROVIDER_API_KEY,
    providerModel: process.env.PROVIDER_MODEL || 'default-model',
    providerTimeout: parseInt(process.env.PROVIDER_TIMEOUT || '30000'),
  };
}
```

### Step 4: Register Service

Update `src/index.ts`:

```typescript
import { ProviderService } from './provider/service';

export class TelegramBotPlugin {
  private claudeCodeService?: ClaudeCodeService;
  private zaiService?: ZaiService;
  private minimaxService?: MiniMaxService;
  private providerService?: ProviderService; // Add this

  constructor(private config: PluginConfig) {
    // Claude CLI
    this.claudeCodeService = new ClaudeCodeService({
      timeout: config.claudeTimeout || 300000,
    });

    // Z.ai
    if (config.zaiApiKey) {
      this.zaiService = new ZaiService({
        apiKey: config.zaiApiKey,
      });
      logger.info('Z.ai service initialized');
    }

    // MiniMax
    if (config.minimaxApiKey) {
      this.minimaxService = new MiniMaxService({
        apiKey: config.minimaxApiKey,
      });
      logger.info('MiniMax service initialized');
    }

    // New Provider
    if (config.providerApiKey) {
      this.providerService = new ProviderService({
        apiKey: config.providerApiKey,
        model: config.providerModel,
        timeout: config.providerTimeout,
      });
      logger.info('Provider service initialized');
    }
  }
}
```

### Step 5: Add Fallback Logic

Update `src/bot/handlers/streaming-message.ts`:

```typescript
export async function handleStreamingMessage(
  api: ApiMethods,
  message: Message,
  text: string,
  services: {
    claude?: ClaudeCodeService;
    zai?: ZaiService;
    minimax?: MiniMaxService;
    provider?: ProviderService;  // Add this
  }
): Promise<{ text: string }> {
  const chatId = String(message.chat.id);

  // Try Claude CLI first
  if (services.claude) {
    try {
      logger.info('Using Claude CLI service');
      return await services.claude.processMessage(chatId, text);
    } catch (error) {
      logger.warn(`Claude CLI failed: ${error.message}`);
    }
  }

  // Fallback to Z.ai
  if (services.zai) {
    try {
      logger.info('Falling back to Z.ai service');
      return await services.zai.processMessage(chatId, text);
    } catch (error) {
      logger.warn(`Z.ai service failed: ${error.message}`);
    }
  }

  // Fallback to MiniMax
  if (services.minimax) {
    try {
      logger.info('Falling back to MiniMax service');
      return await services.minimax.processMessage(chatId, text);
    } catch (error) {
      logger.warn(`MiniMax service failed: ${error.message}`);
    }
  }

  // Fallback to new Provider
  if (services.provider) {
    try {
      logger.info('Falling back to Provider service');
      return await services.provider.processMessage(chatId, text);
    } catch (error) {
      logger.warn(`Provider service failed: ${error.message}`);
    }
  }

  throw new Error('All LLM services failed');
}
```

### Step 6: Write Tests

Create `tests/unit/services/provider.test.ts`:

```typescript
import { ProviderService } from '../../../src/provider/service';

describe('ProviderService', () => {
  let service: ProviderService;

  beforeEach(() => {
    service = new ProviderService({
      apiKey: 'test-key',
      timeout: 5000,
    });
  });

  it('should process message successfully', async () => {
    // Mock fetch or implement test double
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Test response' } }],
      }),
    });

    const result = await service.processMessage('12345', 'Hello');

    expect(result).toEqual({ text: 'Test response' });
  });

  it('should handle API errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(
      service.processMessage('12345', 'Hello')
    ).rejects.toThrow('API error');
  });

  it('should retry on failure', async () => {
    let attempts = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.resolve({
          ok: false,
          status: 500,
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Success' } }],
        }),
      });
    });

    const result = await service.processMessage('12345', 'Hello');

    expect(result).toEqual({ text: 'Success' });
    expect(attempts).toBe(3);
  });
});
```

### Step 7: Update Environment Documentation

Add to `.env.example`:

```bash
# Provider API Configuration
PROVIDER_API_KEY=your-provider-api-key-here
PROVIDER_MODEL=default-model-name
PROVIDER_TIMEOUT=30000
```

Update README.md with setup instructions.

### Step 8: Test Fallback Chain

```bash
# Test with invalid Claude credentials
# to force fallback through chain

export CLAUDE_CLI_AUTH=invalid
export ZAI_API_KEY=invalid
export PROVIDER_API_KEY=valid-key

npm test

# Send test message to bot
# Verify it falls back to Provider
```

### Step 9: Update README.md

```markdown
## LLM Providers

The bot supports multiple LLM providers with automatic fallback:

1. **Claude CLI** (primary)
2. **Z.ai GLM-4.7**
3. **MiniMax v2.1**
4. **Provider** (your new provider)

### Adding [Provider Name]

Set these environment variables:

```bash
PROVIDER_API_KEY=your-key
PROVIDER_MODEL=model-name  # Optional
PROVIDER_TIMEOUT=30000     # Optional, in milliseconds
```
```

## Error Handling Patterns

### Exponential Backoff

```typescript
private async _retryWithBackoff(
  chatId: string,
  message: string,
  attempt: number = 0
): Promise<{ text: string }> {
  const baseDelay = 1000;
  const maxDelay = 10000;
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

  await new Promise(resolve => setTimeout(resolve, delay));

  // Retry logic...
}
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  async execute<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > 60000) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.failures = 0;
      this.state = 'closed';
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= 5) {
        this.state = 'open';
      }

      throw error;
    }
  }
}
```

## Provider-Specific Considerations

### REST API Providers

```typescript
// Standard fetch with timeout
const response = await fetch(url, {
  signal: AbortSignal.timeout(this.config.timeout),
});
```

### WebSocket Providers

```typescript
// For streaming responses
const ws = new WebSocket(url);

ws.on('message', (data) => {
  // Handle streaming chunks
});
```

### CLI-Based Providers

```typescript
// Like Claude CLI
const process = spawn('command', ['--arg1', '--arg2']);

// Handle stdout, stderr, exit codes
```

## Testing Strategies

### Unit Tests
- Mock API calls
- Test retry logic
- Test error handling

### Integration Tests
- Test fallback chain
- Test with real API (sandbox)
- Load testing

### Manual Testing
```bash
# Disable higher priority services
# to test fallback to new service

export CLAUDE_CLI_AUTH=invalid
export ZAI_API_KEY=invalid

# Send message to bot
# Verify new service is used
```

## Common Pitfalls

1. **Not implementing all interface methods**
2. **Forgetting to add to fallback chain**
3. **Not handling timeouts properly**
4. **Missing retry logic**
5. **Not logging errors**
6. **Forgetting to update documentation**
7. **Not writing tests**

## Performance Considerations

- Use connection pooling for HTTP APIs
- Implement proper timeout handling
- Cache responses when appropriate
- Monitor API rate limits
- Use streaming for long responses

## Security Best Practices

- Never log API keys
- Use environment variables for secrets
- Validate API responses
- Sanitize user input
- Implement rate limiting
- Use HTTPS only
- Rotate keys regularly
