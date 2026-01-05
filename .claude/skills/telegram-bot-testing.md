---
name: telegram-bot-testing
description: Testing patterns and strategies for Telegram bots. Use this skill when: (1) Writing tests for bot commands, (2) Testing LLM service integrations, (3) Mocking Telegram API responses, (4) Setting up test infrastructure, (5) Writing integration tests for the bot.
---

# Telegram Bot Testing Guide

## Overview

This skill provides comprehensive testing patterns for the Telegram Bot Plugin, including unit tests, integration tests, and mocking strategies.

## Testing Stack

- **Test Runner**: Jest or Vitest
- **Mocking**: Jest mocks or vi.fn() (Vitest)
- **Coverage**: Istanbul (built-in with Jest/Vitest)
- **Test Location**: `tests/` directory

## Test Structure

```
tests/
├── unit/
│   ├── features/
│   │   ├── commands.test.ts
│   │   └── services.test.ts
│   ├── services/
│   │   ├── claude-code.test.ts
│   │   ├── zai.test.ts
│   │   └── minimax.test.ts
│   └── utils/
│       └── helpers.test.ts
├── integration/
│   ├── bot.test.ts
│   └── fallback-chain.test.ts
└── fixtures/
    ├── telegram-updates.ts
    └── mock-responses.ts
```

## Mocking Telegram API

### Basic Mock Setup

```typescript
// tests/fixtures/mock-api.ts
import type { ApiMethods } from '../../src/types/telegram';

export const createMockApi = (): jest.Mocked<ApiMethods> => ({
  sendText: jest.fn().mockResolvedValue({ message_id: 1 }),
  editMessageText: jest.fn().mockResolvedValue(true),
  deleteMessage: jest.fn().mockResolvedValue(true),
  sendChatAction: jest.fn().mockResolvedValue(true),
  answerCallbackQuery: jest.fn().mockResolvedValue(true),
  // Add other API methods as needed
});
```

### Using Mock API in Tests

```typescript
// tests/unit/features/status.test.ts
import { createMockApi } from '../../fixtures/mock-api';
import { statusCommand } from '../../../src/features/status/commands';

describe('/status command', () => {
  let mockApi: jest.Mocked<ApiMethods>;

  beforeEach(() => {
    mockApi = createMockApi();
    jest.clearAllMocks();
  });

  it('should return bot status', async () => {
    const mockMessage = {
      chat: { id: 12345 },
      from: { id: 67890 },
      message_id: 1,
    } as any;

    await statusCommand(mockApi, mockMessage, []);

    expect(mockApi.sendText).toHaveBeenCalledWith(
      12345,
      expect.stringContaining('Bot Status')
    );
    expect(mockApi.sendText).toHaveBeenCalledTimes(1);
  });

  it('should handle API errors gracefully', async () => {
    mockApi.sendText.mockRejectedValue(new Error('API Error'));

    const mockMessage = {
      chat: { id: 12345 },
    } as any;

    // Should not throw
    await expect(
      statusCommand(mockApi, mockMessage, [])
    ).resolves.not.toThrow();
  });
});
```

## Testing Bot Commands

### Command Handler Test Template

```typescript
// tests/unit/features/command-template.test.ts
import { createMockApi } from '../../fixtures/mock-api';
import { yourCommand } from '../../../src/features/your-feature/commands';

describe('/your-command', () => {
  let mockApi: jest.Mocked<ApiMethods>;

  beforeEach(() => {
    mockApi = createMockApi();
    jest.clearAllMocks();
  });

  it('should handle valid input', async () => {
    const mockMessage = createMockMessage();
    const args = ['arg1', 'arg2'];

    await yourCommand(mockApi, mockMessage, args);

    expect(mockApi.sendText).toHaveBeenCalled();
  });

  it('should validate arguments', async () => {
    const mockMessage = createMockMessage();

    // Test missing args
    await yourCommand(mockApi, mockMessage, []);

    expect(mockApi.sendText).toHaveBeenCalledWith(
      mockMessage.chat.id,
      expect.stringContaining('Usage:')
    );
  });

  it('should handle errors gracefully', async () => {
    mockApi.sendText.mockRejectedValue(new Error('Network error'));

    const mockMessage = createMockMessage();

    await expect(
      yourCommand(mockApi, mockMessage, [])
    ).resolves.not.toThrow();
  });
});

function createMockMessage() {
  return {
    chat: { id: 12345, type: 'private' },
    from: { id: 67890, username: 'testuser' },
    message_id: 1,
    date: Date.now() / 1000,
  } as any;
}
```

## Testing LLM Services

### Mock LLM Service

```typescript
// tests/unit/services/claude-code.test.ts
import { ClaudeCodeService } from '../../../src/claude-code/service';

// Mock child_process
jest.mock('child_process');

describe('ClaudeCodeService', () => {
  let service: ClaudeCodeService;
  let mockSpawn: jest.MockedFunction<any>;

  beforeEach(() => {
    mockSpawn = require('child_process').spawn;
    service = new ClaudeCodeService({
      claudeTimeout: 30000,
    });
  });

  it('should process message successfully', async () => {
    const mockProcess = {
      stdout: {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('{"content": "Test response"}'));
          }
        }),
      },
      on: jest.fn((event, callback) => {
        if (event === 'close') callback(0);
      }),
    };

    mockSpawn.mockReturnValue(mockProcess);

    const result = await service.processMessage('12345', 'Hello');

    expect(result).toEqual({ text: 'Test response' });
  });

  it('should handle timeout', async () => {
    const mockProcess = {
      stdout: { on: jest.fn() },
      on: jest.fn((event, callback) => {
        // Never call close - simulates hang
      }),
      kill: jest.fn(),
    };

    mockSpawn.mockReturnValue(mockProcess);

    await expect(
      service.processMessage('12345', 'Hello')
    ).rejects.toThrow('timed out');

    expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
  });
});
```

## Testing Fallback Chain

```typescript
// tests/integration/fallback-chain.test.ts
import { createMockApi } from '../fixtures/mock-api';
import { handleStreamingMessage } from '../../../src/bot/handlers/streaming-message';

describe('LLM Fallback Chain', () => {
  let mockApi: jest.Mocked<ApiMethods>;
  let mockClaudeService: jest.Mocked<any>;
  let mockZaiService: jest.Mocked<any>;
  let mockMiniMaxService: jest.Mocked<any>;

  beforeEach(() => {
    mockApi = createMockApi();
    mockClaudeService = {
      processMessage: jest.fn(),
    };
    mockZaiService = {
      processMessage: jest.fn(),
    };
    mockMiniMaxService = {
      processMessage: jest.fn(),
    };
  });

  it('should use Claude as primary', async () => {
    mockClaudeService.processMessage.mockResolvedValue({
      text: 'Claude response',
    });

    const result = await handleStreamingMessage(
      mockApi,
      { chat: { id: 12345 } } as any,
      'Hello',
      {
        claude: mockClaudeService,
        zai: mockZaiService,
        minimax: mockMiniMaxService,
      }
    );

    expect(result).toEqual({ text: 'Claude response' });
    expect(mockClaudeService.processMessage).toHaveBeenCalledTimes(1);
    expect(mockZaiService.processMessage).not.toHaveBeenCalled();
  });

  it('should fallback to Z.ai when Claude fails', async () => {
    mockClaudeService.processMessage.mockRejectedValue(
      new Error('Claude timeout')
    );
    mockZaiService.processMessage.mockResolvedValue({
      text: 'Z.ai response',
    });

    const result = await handleStreamingMessage(
      mockApi,
      { chat: { id: 12345 } } as any,
      'Hello',
      {
        claude: mockClaudeService,
        zai: mockZaiService,
        minimax: mockMiniMaxService,
      }
    );

    expect(result).toEqual({ text: 'Z.ai response' });
    expect(mockClaudeService.processMessage).toHaveBeenCalledTimes(1);
    expect(mockZaiService.processMessage).toHaveBeenCalledTimes(1);
  });

  it('should fallback through entire chain', async () => {
    mockClaudeService.processMessage.mockRejectedValue(
      new Error('Claude timeout')
    );
    mockZaiService.processMessage.mockRejectedValue(
      new Error('Z.ai error')
    );
    mockMiniMaxService.processMessage.mockResolvedValue({
      text: 'MiniMax response',
    });

    const result = await handleStreamingMessage(
      mockApi,
      { chat: { id: 12345 } } as any,
      'Hello',
      {
        claude: mockClaudeService,
        zai: mockZaiService,
        minimax: mockMiniMaxService,
      }
    );

    expect(result).toEqual({ text: 'MiniMax response' });
    expect(mockClaudeService.processMessage).toHaveBeenCalledTimes(1);
    expect(mockZaiService.processMessage).toHaveBeenCalledTimes(1);
    expect(mockMiniMaxService.processMessage).toHaveBeenCalledTimes(1);
  });

  it('should throw when all services fail', async () => {
    mockClaudeService.processMessage.mockRejectedValue(
      new Error('Claude timeout')
    );
    mockZaiService.processMessage.mockRejectedValue(
      new Error('Z.ai error')
    );
    mockMiniMaxService.processMessage.mockRejectedValue(
      new Error('MiniMax error')
    );

    await expect(
      handleStreamingMessage(
        mockApi,
        { chat: { id: 12345 } } as any,
        'Hello',
        {
          claude: mockClaudeService,
          zai: mockZaiService,
          minimax: mockMiniMaxService,
        }
      )
    ).rejects.toThrow('All LLM services failed');
  });
});
```

## Test Fixtures

### Telegram Update Fixtures

```typescript
// tests/fixtures/telegram-updates.ts
export const createMockMessage = (overrides = {}) => ({
  message_id: 1,
  from: {
    id: 12345,
    is_bot: false,
    first_name: 'Test',
    username: 'testuser',
  },
  chat: {
    id: 12345,
    type: 'private',
  },
  date: Math.floor(Date.now() / 1000),
  text: '/test',
  ...overrides,
});

export const createMockCallbackQuery = (overrides = {}) => ({
  id: 'callback_123',
  from: {
    id: 12345,
    username: 'testuser',
  },
  message: createMockMessage(),
  data: 'button_click',
  ...overrides,
});

export const createMockInlineQuery = (overrides = {}) => ({
  id: 'inline_123',
  from: {
    id: 12345,
    username: 'testuser',
  },
  query: 'test query',
  offset: '',
  ...overrides,
});
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- status.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="fallback"

# Run tests for specific feature
npm test -- features/
```

## Coverage Goals

- **Overall**: > 80%
- **Commands**: > 90%
- **Services**: > 85%
- **Utils**: > 95%

## Best Practices

1. **Mock external dependencies**: Always mock API calls, file system, and child processes
2. **Test error cases**: Don't just test success paths
3. **Use descriptive test names**: Test names should describe what is being tested
4. **Arrange-Act-Assert**: Structure tests clearly
5. **Avoid test interdependence**: Each test should be independent
6. **Use fixtures**: Reuse test data through fixtures
7. **Test boundaries**: Focus on testing your code, not libraries
