/**
 * Tool Visibility Manager Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ToolVisibilityManager, getToolVisibilityManager, resetToolVisibilityManager } from '../../src/streaming/tool-visibility';
import type { ToolUseEvent, ToolResultEvent } from '../../src/streaming/types';

describe('ToolVisibilityManager', () => {
  let manager: ToolVisibilityManager;

  const createMockToolUse = (overrides: Partial<ToolUseEvent> = {}): ToolUseEvent => ({
    type: 'tool_use',
    id: 'tool-123',
    name: 'Read',
    input: { path: 'test.txt' },
    timestamp: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    manager = new ToolVisibilityManager();
  });

  describe('formatToolUse', () => {
    it('should format Bash tool with command', () => {
      const tool = createMockToolUse({
        name: 'Bash',
        input: { command: 'ls -la', cwd: '/home/user' },
      });

      const result = manager.formatToolUse(tool);

      expect(result).toContain('💻');
      expect(result).toContain('Using: Bash');
      expect(result).toContain('ls -la');
    });

    it('should format Read tool with file path', () => {
      const tool = createMockToolUse({
        name: 'Read',
        input: { file_path: '/src/app.ts', offset: 0, limit: 50 },
      });

      const result = manager.formatToolUse(tool);

      expect(result).toContain('📖');
      expect(result).toContain('/src/app.ts');
      expect(result).toContain('Lines: 1-50');
    });

    it('should format Write tool with file info and preview', () => {
      const tool = createMockToolUse({
        name: 'Write',
        input: { file_path: '/test.py', content: 'print("hello")\nprint("world")' },
      });

      const result = manager.formatToolUse(tool);

      expect(result).toContain('✏️');
      expect(result).toContain('/test.py');
      expect(result).toContain('bytes');
      expect(result).toContain('lines');
      expect(result).toContain('py');
    });

    it('should format Edit tool with patch count', () => {
      const tool = createMockToolUse({
        name: 'Edit',
        input: { file_path: '/src/main.ts', patches: ['@@ -1,3 +1,5 @@', '@@ -10,5 +10,7 @@'] },
      });

      const result = manager.formatToolUse(tool);

      expect(result).toContain('📝');
      expect(result).toContain('/src/main.ts');
      expect(result).toContain('Edits: 2');
    });

    it('should format Search tool with query', () => {
      const tool = createMockToolUse({
        name: 'Search',
        input: { query: 'function.*test', path: '/src', ignore_case: true, regex: true },
      });

      const result = manager.formatToolUse(tool);

      expect(result).toContain('🔍');
      expect(result).toContain('function.*test');
      expect(result).toContain('/src');
      expect(result).toContain('case-insensitive');
      expect(result).toContain('regex');
    });

    it('should format Git tool with command', () => {
      const tool = createMockToolUse({
        name: 'Git',
        input: { command: 'status' },
      });

      const result = manager.formatToolUse(tool);

      expect(result).toContain('📦');
      expect(result).toContain('status');
    });

    it('should format unknown tool generically', () => {
      const tool = createMockToolUse({
        name: 'UnknownTool',
        input: { foo: 'bar', count: 42, enabled: true },
      });

      const result = manager.formatToolUse(tool);

      expect(result).toContain('🔧');
      expect(result).toContain('foo');
      expect(result).toContain('"bar"');
      expect(result).toContain('42');
      expect(result).toContain('true');
    });

    it('should handle git commands in bash', () => {
      const tool = createMockToolUse({
        name: 'Bash',
        input: { command: 'git diff --cached' },
      });

      const result = manager.formatToolUse(tool);

      expect(result).toContain('Git: `diff`');
      expect(result).toContain('Showing changes');
    });

    it('should handle git log with count', () => {
      const tool = createMockToolUse({
        name: 'Bash',
        input: { command: 'git log -5' },
      });

      const result = manager.formatToolUse(tool);

      expect(result).toContain('Git: `log`');
      expect(result).toContain('recent commits');
    });

    it('should be case insensitive for tool names', () => {
      expect((manager as unknown as { getToolEmoji(tool: string): string }).getToolEmoji('Read')).toBe('📖');
      expect((manager as unknown as { getToolEmoji(tool: string): string }).getToolEmoji('read')).toBe('📖');
    });
  });

  describe('formatToolResult', () => {
    it('should format successful result', () => {
      const result: ToolResultEvent = {
        type: 'tool_result',
        toolUseId: 'tool-123',
        content: 'File contents here',
        timestamp: new Date(),
      };

      const display = manager.formatToolResult(result, 'Read');

      expect(display).toContain('📖');
      expect(display).toContain('Result: Read');
      expect(display).toContain('File contents here');
    });

    it('should truncate long content', () => {
      const longContent = 'a'.repeat(2000);
      const result: ToolResultEvent = {
        type: 'tool_result',
        toolUseId: 'tool-123',
        content: longContent,
        timestamp: new Date(),
      };

      const display = manager.formatToolResult(result, 'Bash');

      expect(display).toContain('... (');
      expect(display).toContain('more characters)');
    });

    it('should show error for failed tool', () => {
      const result: ToolResultEvent = {
        type: 'tool_result',
        toolUseId: 'tool-123',
        content: 'Error: file not found',
        isError: true,
        timestamp: new Date(),
      };

      const display = manager.formatToolResult(result, 'Read');

      expect(display).toContain('❌');
      expect(display).toContain('Error');
    });
  });

  describe('getToolEmoji', () => {
    it('should return correct emojis for known tools', () => {
      const emojis: Record<string, string> = {
        'Read': '📖',
        'Write': '✏️',
        'Edit': '📝',
        'Bash': '💻',
        'Search': '🔍',
        'Git': '📦',
        'FileSystem': '📁',
        'HTTP': '🌐',
        'Browser': '🌐',
      };

      for (const [tool, expectedEmoji] of Object.entries(emojis)) {
        const result = (manager as unknown as { getToolEmoji(tool: string): string }).getToolEmoji(tool);
        expect(result).toBe(expectedEmoji);
      }
    });

    it('should return default emoji for unknown tools', () => {
      const result = (manager as unknown as { getToolEmoji(tool: string): string }).getToolEmoji('UnknownTool');
      expect(result).toBe('🔧');
    });

    it('should be case insensitive for tool names', () => {
      // Both 'Read' and 'read' have entries in the emoji map
      expect((manager as unknown as { getToolEmoji(tool: string): string }).getToolEmoji('Read')).toBe('📖');
      expect((manager as unknown as { getToolEmoji(tool: string): string }).getToolEmoji('read')).toBe('📖');
    });
  });

  describe('formatToolExecution', () => {
    it('should combine tool use and result', () => {
      const tool = createMockToolUse({
        name: 'Read',
        input: { file_path: 'test.txt' },
      });

      const result: ToolResultEvent = {
        type: 'tool_result',
        toolUseId: 'tool-123',
        content: 'File contents',
        timestamp: new Date(),
      };

      const display = manager.formatToolExecution(tool, result);

      expect(display).toContain('📖');
      expect(display).toContain('Using: Read');
      expect(display).toContain('Result: Read');
      expect(display).toContain('File contents');
    });

    it('should work without result', () => {
      const tool = createMockToolUse({
        name: 'Read',
        input: { file_path: 'test.txt' },
      });

      const display = manager.formatToolExecution(tool);

      expect(display).toContain('📖');
      expect(display).toContain('Using: Read');
    });
  });

  describe('generateToolSummary', () => {
    it('should return empty string for no tools', () => {
      const result = manager.generateToolSummary([]);
      expect(result).toBe('');
    });

    it('should generate summary of used tools', () => {
      const tools: ToolUseEvent[] = [
        createMockToolUse({ id: '1', name: 'Read', input: { file_path: 'file1.txt' } }),
        createMockToolUse({ id: '2', name: 'Write', input: { file_path: 'file2.txt' } }),
        createMockToolUse({ id: '3', name: 'Read', input: { file_path: 'file3.txt' } }),
      ];

      const result = manager.generateToolSummary(tools);

      expect(result).toContain('Tools Used:');
      expect(result).toContain('Read');
      expect(result).toContain('Write');
      expect(result).toContain('file1.txt');
    });

    it('should list unique tools only', () => {
      const tools: ToolUseEvent[] = [
        createMockToolUse({ id: '1', name: 'Read', input: { file_path: 'file1.txt' } }),
        createMockToolUse({ id: '2', name: 'Write', input: { file_path: 'file2.txt' } }),
        createMockToolUse({ id: '3', name: 'Read', input: { file_path: 'file3.txt' } }),
      ];

      const result = manager.generateToolSummary(tools);

      const header = result.split('\n\n')[0];
      expect(header).toContain('🔧 *Tools Used:* Read, Write');
    });
  });

  describe('formatValue', () => {
    it('should format string values', () => {
      const result = (manager as unknown as { formatValue(value: unknown): string }).formatValue('test');
      expect(result).toBe('"test"');
    });

    it('should format number values', () => {
      const result = (manager as unknown as { formatValue(value: unknown): string }).formatValue(42);
      expect(result).toBe('42');
    });

    it('should format boolean values', () => {
      expect((manager as unknown as { formatValue(value: unknown): string }).formatValue(true)).toBe('true');
      expect((manager as unknown as { formatValue(value: unknown): string }).formatValue(false)).toBe('false');
    });

    it('should format array values', () => {
      const result = (manager as unknown as { formatValue(value: unknown): string }).formatValue([1, 2, 3]);
      expect(result).toBe('[3 items]');
    });

    it('should format object values', () => {
      const result = (manager as unknown as { formatValue(value: unknown): string }).formatValue({ foo: 'bar' });
      expect(result).toBe('{...}');
    });

    it('should truncate long strings', () => {
      const long = 'a'.repeat(100);
      const result = (manager as unknown as { formatValue(value: unknown): string }).formatValue(long);
      expect(result).toContain('...');
    });
  });

  describe('truncateContent', () => {
    it('should return original if under max length', () => {
      const result = (manager as unknown as { truncateContent(content: string, maxLength: number): string }).truncateContent('hello', 100);
      expect(result).toBe('hello');
    });

    it('should over truncate content max length', () => {
      const result = (manager as unknown as { truncateContent(content: string, maxLength: number): string }).truncateContent('hello world', 5);
      expect(result).toBe('hello...');
    });
  });

  describe('Factory functions', () => {
    it('should return same instance from getToolVisibilityManager', () => {
      const manager1 = getToolVisibilityManager();
      const manager2 = getToolVisibilityManager();
      expect(manager1).toBe(manager2);
    });

    it('should reset manager on resetToolVisibilityManager', () => {
      const manager1 = getToolVisibilityManager();
      resetToolVisibilityManager();
      const manager2 = getToolVisibilityManager();
      expect(manager1).not.toBe(manager2);
    });
  });
});
