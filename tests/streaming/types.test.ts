/**
 * Streaming Types Tests
 */

import { describe, it, expect } from '@jest/globals';
import {
  StreamStatus,
  STATUS_DISPLAYS,
  ANIMATION_FRAMES,
  ERROR_SUGGESTIONS,
  getErrorSuggestions,
  splitIntoChunks,
  type ToolUseEvent,
  type ToolResultEvent,
  type StreamState,
  type ClaudeCodeStreamCallbacks,
  type StreamingResult,
  type StatusDisplay,
  type MessageChunk,
} from '../../src/streaming/types';

describe('StreamStatus', () => {
  it('should have all expected status values', () => {
    expect(StreamStatus.IDLE).toBe('idle');
    expect(StreamStatus.THINKING).toBe('thinking');
    expect(StreamStatus.TOOL_USE).toBe('tool_use');
    expect(StreamStatus.RESPONSE).toBe('response');
    expect(StreamStatus.CONFIRMATION).toBe('confirmation');
    expect(StreamStatus.COMPLETE).toBe('complete');
    expect(StreamStatus.ERROR).toBe('error');
  });

  it('should have 7 status values', () => {
    const values = Object.values(StreamStatus);
    expect(values).toHaveLength(7);
  });
});

describe('STATUS_DISPLAYS', () => {
  it('should have display for each status', () => {
    const statuses = Object.values(StreamStatus);
    expect(statuses.length).toBe(Object.keys(STATUS_DISPLAYS).length);
  });

  it('should have correct emojis', () => {
    expect(STATUS_DISPLAYS[StreamStatus.IDLE].emoji).toBe('💤');
    expect(STATUS_DISPLAYS[StreamStatus.THINKING].emoji).toBe('⏳');
    expect(STATUS_DISPLAYS[StreamStatus.TOOL_USE].emoji).toBe('🔧');
    expect(STATUS_DISPLAYS[StreamStatus.RESPONSE].emoji).toBe('✍️');
    expect(STATUS_DISPLAYS[StreamStatus.CONFIRMATION].emoji).toBe('❓');
    expect(STATUS_DISPLAYS[StreamStatus.COMPLETE].emoji).toBe('✅');
    expect(STATUS_DISPLAYS[StreamStatus.ERROR].emoji).toBe('❌');
  });

  it('should have text for each status', () => {
    for (const status of Object.values(StreamStatus)) {
      expect(STATUS_DISPLAYS[status].text).toBeDefined();
      expect(STATUS_DISPLAYS[status].text.length).toBeGreaterThan(0);
    }
  });

  it('should mark thinking and response as animated', () => {
    expect(STATUS_DISPLAYS[StreamStatus.THINKING].animated).toBe(true);
    expect(STATUS_DISPLAYS[StreamStatus.RESPONSE].animated).toBe(true);
    expect(STATUS_DISPLAYS[StreamStatus.IDLE].animated).toBeUndefined();
    expect(STATUS_DISPLAYS[StreamStatus.COMPLETE].animated).toBeUndefined();
  });

  it('should show elapsed time for thinking and response', () => {
    expect(STATUS_DISPLAYS[StreamStatus.THINKING].showElapsed).toBe(true);
    expect(STATUS_DISPLAYS[StreamStatus.RESPONSE].showElapsed).toBe(true);
    expect(STATUS_DISPLAYS[StreamStatus.IDLE].showElapsed).toBeUndefined();
  });
});

describe('ANIMATION_FRAMES', () => {
  it('should have 3 animation frames', () => {
    expect(ANIMATION_FRAMES).toHaveLength(3);
  });

  it('should have correct animation frames', () => {
    expect(ANIMATION_FRAMES).toEqual(['.', '..', '...']);
  });
});

describe('ToolUseEvent', () => {
  it('should create valid tool use event', () => {
    const event: ToolUseEvent = {
      type: 'tool_use',
      id: 'tool-123',
      name: 'Read',
      input: { path: 'test.txt' },
      timestamp: new Date(),
    };

    expect(event.type).toBe('tool_use');
    expect(event.id).toBe('tool-123');
    expect(event.name).toBe('Read');
    expect(event.input).toEqual({ path: 'test.txt' });
    expect(event.timestamp).toBeInstanceOf(Date);
  });
});

describe('ToolResultEvent', () => {
  it('should create valid tool result event', () => {
    const event: ToolResultEvent = {
      type: 'tool_result',
      toolUseId: 'tool-123',
      content: 'File contents here',
      isError: false,
      timestamp: new Date(),
    };

    expect(event.type).toBe('tool_result');
    expect(event.toolUseId).toBe('tool-123');
    expect(event.content).toBe('File contents here');
    expect(event.isError).toBe(false);
  });

  it('should allow undefined isError', () => {
    const event: ToolResultEvent = {
      type: 'tool_result',
      toolUseId: 'tool-123',
      content: 'Success',
      timestamp: new Date(),
    };

    expect(event.isError).toBeUndefined();
  });
});

describe('StreamState', () => {
  it('should create valid stream state', () => {
    const state: StreamState = {
      status: StreamStatus.THINKING,
      currentMessageId: 12345,
      currentTool: 'Read',
      pendingConfirmation: undefined,
      toolHistory: [],
      startTime: new Date(),
      lastUpdate: new Date(),
      errorMessage: undefined,
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    };

    expect(state.status).toBe(StreamStatus.THINKING);
    expect(state.currentMessageId).toBe(12345);
    expect(state.currentTool).toBe('Read');
    expect(state.toolHistory).toHaveLength(0);
    expect(state.inputTokens).toBe(100);
    expect(state.totalTokens).toBe(150);
  });

  it('should allow optional fields to be undefined', () => {
    const state: StreamState = {
      status: StreamStatus.IDLE,
      toolHistory: [],
      startTime: new Date(),
      lastUpdate: new Date(),
    };

    expect(state.currentMessageId).toBeUndefined();
    expect(state.currentTool).toBeUndefined();
    expect(state.pendingConfirmation).toBeUndefined();
  });
});

describe('ClaudeCodeStreamCallbacks', () => {
  it('should allow all callbacks to be undefined', () => {
    const callbacks: ClaudeCodeStreamCallbacks = {};

    expect(callbacks.onContent).toBeUndefined();
    expect(callbacks.onToolUse).toBeUndefined();
    expect(callbacks.onToolResult).toBeUndefined();
    expect(callbacks.onStatusChange).toBeUndefined();
    expect(callbacks.onError).toBeUndefined();
    expect(callbacks.onComplete).toBeUndefined();
  });

  it('should allow callbacks to be functions', () => {
    const callbacks: ClaudeCodeStreamCallbacks = {
      onContent: (chunk) => console.log(chunk),
      onToolUse: (tool) => console.log(tool),
      onToolResult: (result) => console.log(result),
      onStatusChange: (status) => console.log(status),
      onError: (error) => console.error(error),
      onComplete: (result) => console.log(result),
    };

    expect(typeof callbacks.onContent).toBe('function');
    expect(typeof callbacks.onToolUse).toBe('function');
    expect(typeof callbacks.onToolResult).toBe('function');
    expect(typeof callbacks.onStatusChange).toBe('function');
    expect(typeof callbacks.onError).toBe('function');
    expect(typeof callbacks.onComplete).toBe('function');
  });
});

describe('StreamingResult', () => {
  it('should create valid streaming result', () => {
    const result: StreamingResult = {
      text: 'Response text',
      sessionId: 'session-123',
      isNewSession: true,
      durationMs: 5000,
      exitCode: 0,
      toolHistory: [],
    };

    expect(result.text).toBe('Response text');
    expect(result.sessionId).toBe('session-123');
    expect(result.isNewSession).toBe(true);
    expect(result.durationMs).toBe(5000);
    expect(result.exitCode).toBe(0);
    expect(result.toolHistory).toHaveLength(0);
  });

  it('should allow tool history with items', () => {
    const toolUse: ToolUseEvent = {
      type: 'tool_use',
      id: 'tool-1',
      name: 'Read',
      input: { path: 'test.txt' },
      timestamp: new Date(),
    };

    const result: StreamingResult = {
      text: 'Done',
      sessionId: 'sess-1',
      isNewSession: false,
      durationMs: 1000,
      exitCode: 0,
      toolHistory: [toolUse],
    };

    expect(result.toolHistory).toHaveLength(1);
    expect(result.toolHistory[0].name).toBe('Read');
  });
});

describe('StatusDisplay', () => {
  it('should have all required fields', () => {
    const display: StatusDisplay = {
      emoji: '✅',
      text: 'Complete',
      showElapsed: false,
      animated: false,
    };

    expect(display.emoji).toBe('✅');
    expect(display.text).toBe('Complete');
    expect(display.showElapsed).toBe(false);
    expect(display.animated).toBe(false);
  });

  it('should allow optional fields to be undefined', () => {
    const display: StatusDisplay = {
      emoji: '💤',
      text: 'Idle',
    };

    expect(display.showElapsed).toBeUndefined();
    expect(display.animated).toBeUndefined();
  });
});

describe('MessageChunk', () => {
  it('should create valid message chunk', () => {
    const chunk: MessageChunk = {
      content: 'Part 1',
      isComplete: false,
      index: 0,
      total: 3,
    };

    expect(chunk.content).toBe('Part 1');
    expect(chunk.isComplete).toBe(false);
    expect(chunk.index).toBe(0);
    expect(chunk.total).toBe(3);
  });

  it('should mark last chunk as complete', () => {
    const lastChunk: MessageChunk = {
      content: 'Part 3',
      isComplete: true,
      index: 2,
      total: 3,
    };

    expect(lastChunk.isComplete).toBe(true);
  });
});

describe('splitIntoChunks', () => {
  it('should handle empty string', () => {
    const chunks = splitIntoChunks('');

    // Empty string returns empty array
    expect(chunks).toHaveLength(0);
  });

  it('should handle short text under limit', () => {
    const chunks = splitIntoChunks('Hello World', 4000);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('Hello World');
    expect(chunks[0].isComplete).toBe(true);
  });

  it('should split long text into multiple chunks', () => {
    const longText = 'A'.repeat(5000);
    const chunks = splitIntoChunks(longText, 4000);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content.length).toBeLessThanOrEqual(4000);
    expect(chunks[chunks.length - 1].content.length).toBeLessThanOrEqual(4000);
  });

  it('should preserve line breaks', () => {
    const text = 'Line 1\nLine 2\nLine 3';
    const chunks = splitIntoChunks(text, 10);

    // At least one chunk should contain a newline
    const hasNewline = chunks.some(c => c.content.includes('\n'));
    expect(hasNewline).toBe(true);
  });

  it('should handle line longer than maxLength', () => {
    const text = 'A'.repeat(5000);
    const chunks = splitIntoChunks(text, 4000);

    // All chunks should be within limit
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(4000);
    }
  });

  it('should set correct index and total', () => {
    const text = 'A'.repeat(10000);
    const chunks = splitIntoChunks(text, 4000);

    expect(chunks[0].index).toBe(0);
    expect(chunks[chunks.length - 1].index).toBe(chunks.length - 1);
    expect(chunks[chunks.length - 1].total).toBe(chunks.length);
  });

  it('should mark last chunk as complete', () => {
    const text = 'A'.repeat(5000);
    const chunks = splitIntoChunks(text, 4000);

    expect(chunks[chunks.length - 1].isComplete).toBe(true);
  });

  it('should not mark intermediate chunks as complete', () => {
    const text = 'A'.repeat(10000);
    const chunks = splitIntoChunks(text, 4000);

    for (let i = 0; i < chunks.length - 1; i++) {
      expect(chunks[i].isComplete).toBe(false);
    }
  });

  it('should use default maxLength of 4000', () => {
    const text = 'A'.repeat(5000);
    const chunks = splitIntoChunks(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content.length).toBeLessThanOrEqual(4000);
  });
});

describe('getErrorSuggestions', () => {
  it('should return permission suggestions', () => {
    const suggestions = getErrorSuggestions('Permission denied access denied');

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toContain('permissions');
  });

  it('should return file not found suggestions', () => {
    const suggestions = getErrorSuggestions('File not found no such file');

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toContain('path');
  });

  it('should return timeout suggestions', () => {
    const suggestions = getErrorSuggestions('Operation timed out');

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toContain('too long');
  });

  it('should return network suggestions', () => {
    const suggestions = getErrorSuggestions('Network connection error dns');

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toContain('internet');
  });

  it('should return syntax error suggestions', () => {
    const suggestions = getErrorSuggestions('Syntax parse error unexpected');

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toContain('syntax');
  });

  it('should return memory error suggestions', () => {
    const suggestions = getErrorSuggestions('Out of memory OOM');

    expect(suggestions.length).toBeGreaterThan(0);
    // First suggestion mentions memory-related actions
    expect(suggestions[0]).toContain('applications');
  });

  it('should return default suggestions for unknown errors', () => {
    const suggestions = getErrorSuggestions('Something completely unknown');

    expect(suggestions.length).toBeGreaterThan(0);
    // Default suggestions include asking Claude
    expect(suggestions.some(s => s.includes('Claude'))).toBe(true);
  });

  it('should be case insensitive', () => {
    const suggestions1 = getErrorSuggestions('PERMISSION');
    const suggestions2 = getErrorSuggestions('permission');

    expect(suggestions1).toEqual(suggestions2);
  });
});

describe('ERROR_SUGGESTIONS', () => {
  it('should have all error patterns', () => {
    expect(ERROR_SUGGESTIONS.length).toBe(6);

    const patterns = ERROR_SUGGESTIONS.map(e => e.errorPattern.source);
    expect(patterns.some(p => p.includes('permission'))).toBe(true);
    expect(patterns.some(p => p.includes('not found'))).toBe(true);
    expect(patterns.some(p => p.includes('timeout'))).toBe(true);
    expect(patterns.some(p => p.includes('network'))).toBe(true);
    expect(patterns.some(p => p.includes('syntax'))).toBe(true);
    expect(patterns.some(p => p.includes('memory'))).toBe(true);
  });

  it('should have suggestions for each pattern', () => {
    for (const { errorPattern, suggestions } of ERROR_SUGGESTIONS) {
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.every(s => s.length > 0)).toBe(true);
    }
  });
});
