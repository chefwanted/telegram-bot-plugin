/**
 * Tool Visibility Manager
 * Formatteert en toont tool gebruik voor Telegram
 */

import type { ToolUseEvent, ToolResultEvent } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger({ prefix: 'ToolVisibility' });

// =============================================================================
// Tool Visibility Manager
// =============================================================================

export class ToolVisibilityManager {
  /**
   * Format tool use event for display with enhanced formatting
   */
  formatToolUse(tool: ToolUseEvent): string {
    const emoji = this.getToolEmoji(tool.name);
    let display = `${emoji} *Using: ${tool.name}*\n\n`;

    // Format input based on tool type
    const input = tool.input as Record<string, unknown>;

    if (tool.name === 'Bash' || tool.name === 'bash') {
      display += this.formatBashToolUse(input);
    } else if (tool.name === 'Read' || tool.name === 'read') {
      display += this.formatReadToolUse(input);
    } else if (tool.name === 'Write' || tool.name === 'write') {
      display += this.formatWriteToolUse(input);
    } else if (tool.name === 'Edit' || tool.name === 'edit') {
      display += this.formatEditToolUse(input);
    } else if (tool.name === 'Search' || tool.name === 'search') {
      display += this.formatSearchToolUse(input);
    } else if (tool.name === 'Git' || tool.name === 'git') {
      display += this.formatGitToolUse(input);
    } else {
      // Generic tool display
      display += this.formatGenericToolUse(input);
    }

    return display;
  }

  /**
   * Format Bash tool use
   */
  private formatBashToolUse(input: Record<string, unknown>): string {
    let display = '';
    const command = input.command as string;

    // Detect git commands for special formatting
    if (command?.startsWith('git ')) {
      display += this.formatGitCommand(command);
    } else {
      display += `Command: \`${command || ''}\`\n`;
    }

    // Show working directory if specified
    if (input.cwd) {
      display += `Dir: \`${input.cwd}\`\n`;
    }

    display += '\n';
    return display;
  }

  /**
   * Format git command for display
   */
  private formatGitCommand(command: string): string {
    const parts = command.split(' ');
    const subCommand = parts[1];

    let display = `📦 Git: \`${subCommand || 'status'}\`\n`;

    // Add context based on sub-command
    if (subCommand === 'diff') {
      display += `Showing changes...\n`;
    } else if (subCommand === 'log') {
      const count = parts.find(p => /^\d+$/.test(p));
      display += `Showing ${count || 'recent'} commits...\n`;
    } else if (subCommand === 'status') {
      display += `Checking repository status...\n`;
    } else if (subCommand === 'commit') {
      display += `Creating commit...\n`;
    } else if (subCommand === 'push' || subCommand === 'pull') {
      const branch = parts[parts.indexOf(subCommand) + 1];
      display += `Syncing ${branch || 'branch'}...\n`;
    }

    return display;
  }

  /**
   * Format Read tool use with file info
   */
  private formatReadToolUse(input: Record<string, unknown>): string {
    let display = '';
    const filePath = input.file_path as string;

    display += `📖 File: \`${filePath || ''}\`\n`;

    // Show line range if specified
    if (input.offset !== undefined || input.limit !== undefined) {
      const offset = input.offset as number || 0;
      const limit = input.limit as number || 0;
      display += `Lines: ${offset + 1}-${offset + limit}\n`;
    }

    display += '\n';
    return display;
  }

  /**
   * Format Write tool use with content preview
   */
  private formatWriteToolUse(input: Record<string, unknown>): string {
    let display = '';
    const filePath = input.file_path as string;
    const content = input.content as string;

    display += `✏️ File: \`${filePath || ''}\`\n`;

    if (content) {
      const lines = content.split('\n').length;
      const size = content.length;

      display += `Size: ${size} bytes, ${lines} lines\n`;

      // Show language based on extension
      const ext = filePath?.split('.').pop();
      if (ext) {
        display += `Type: \`${ext}\`\n`;
      }

      // Show preview
      display += `\n\`\`\`\n${this.truncateContent(content, 100)}\n\`\`\`\n`;
    }

    display += '\n';
    return display;
  }

  /**
   * Format Edit tool use with patch info
   */
  private formatEditToolUse(input: Record<string, unknown>): string {
    let display = '';
    const filePath = input.file_path as string;

    display += `📝 File: \`${filePath || ''}\`\n`;

    // Count number of edits
    const patches = input.patches;
    if (Array.isArray(patches)) {
      display += `Edits: ${patches.length} change(s)\n`;
    } else if (typeof patches === 'string') {
      const patchCount = (patches.match(/@@/g) || []).length;
      display += `Edits: ${patchCount} change(s)\n`;
    }

    display += '\n';
    return display;
  }

  /**
   * Format Search tool use
   */
  private formatSearchToolUse(input: Record<string, unknown>): string {
    let display = '';
    const query = input.query as string;
    const path = input.path as string;

    display += `🔍 Query: \`${query || ''}\`\n`;

    if (path) {
      display += `Path: \`${path}\`\n`;
    }

    // Show search options
    const options: string[] = [];
    if (input.ignore_case) options.push('case-insensitive');
    if (input.match_case) options.push('case-sensitive');
    if (input.regex) options.push('regex');

    if (options.length > 0) {
      display += `Options: ${options.join(', ')}\n`;
    }

    display += '\n';
    return display;
  }

  /**
   * Format Git tool use
   */
  private formatGitToolUse(input: Record<string, unknown>): string {
    let display = '';
    const command = input.command as string;

    display += `📦 Git: \`${command || ''}\`\n`;

    // Add context for common commands
    if (command === 'status') {
      display += `Checking working tree status...\n`;
    } else if (command === 'log') {
      const n = input.n as number | undefined;
      display += `Showing ${n || 10} recent commits...\n`;
    } else if (command === 'diff') {
      display += `Showing changes...\n`;
    }

    display += '\n';
    return display;
  }

  /**
   * Format generic tool use
   */
  private formatGenericToolUse(input: Record<string, unknown>): string {
    let display = 'Input:\n';

    const keys = Object.keys(input).filter(k => k !== 'session_id');
    for (const key of keys) {
      const value = this.formatValue(input[key]);
      display += `  \`${key}\`: ${value}\n`;
    }

    display += '\n';
    return display;
  }

  /**
   * Format tool result for display
   */
  formatToolResult(result: ToolResultEvent, toolName?: string): string {
    const emoji = this.getToolEmoji(toolName || 'unknown');
    let display = `${emoji} *Result: ${toolName || 'Tool'}*\n\n`;

    const content = result.content;

    // Truncate very long outputs
    if (content.length > 1500) {
      display += `\`\`\`\n${content.substring(0, 1500)}\n\n... (${content.length - 1500} more characters)\n\`\`\`\n`;
    } else {
      display += `\`\`\`\n${content}\n\`\`\`\n`;
    }

    if (result.isError) {
      display = `❌ *Error in ${toolName || 'tool'}*\n\n` + display;
    }

    return display;
  }

  /**
   * Get emoji for tool name
   */
  private getToolEmoji(toolName: string): string {
    const emojiMap: Record<string, string> = {
      'Read': '📖',
      'read': '📖',
      'Write': '✏️',
      'write': '✏️',
      'Edit': '📝',
      'edit': '📝',
      'Bash': '💻',
      'bash': '💻',
      'Search': '🔍',
      'search': '🔍',
      'Git': '📦',
      'git': '📦',
      'FileSystem': '📁',
      'filesystem': '📁',
      'HTTP': '🌐',
      'http': '🌐',
      'Browser': '🌐',
      'browser': '🌐',
    };

    return emojiMap[toolName] || '🔧';
  }

  /**
   * Format value for display
   */
  private formatValue(value: unknown): string {
    if (typeof value === 'string') {
      return `"${this.truncateContent(value, 50)}"`;
    } else if (typeof value === 'number') {
      return value.toString();
    } else if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    } else if (Array.isArray(value)) {
      return `[${value.length} items]`;
    } else if (typeof value === 'object' && value !== null) {
      return '{...}';
    }
    return String(value);
  }

  /**
   * Truncate content for display
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }

  /**
   * Combine tool use and result into single display
   */
  formatToolExecution(tool: ToolUseEvent, result?: ToolResultEvent): string {
    let display = this.formatToolUse(tool);

    if (result) {
      display += this.formatToolResult(result, tool.name);
    }

    return display;
  }

  /**
   * Generate tool summary message
   */
  generateToolSummary(tools: ToolUseEvent[]): string {
    if (tools.length === 0) {
      return '';
    }

    const toolNames = tools.map(t => t.name);
    const uniqueTools = [...new Set(toolNames)];

    let summary = `🔧 *Tools Used:* ${uniqueTools.join(', ')}\n\n`;

    for (const tool of tools) {
      summary += `• ${this.getToolEmoji(tool.name)} ${tool.name}`;

      if (tool.name === 'Bash' || tool.name === 'bash') {
        summary += ` - \`${(tool.input as Record<string, unknown>).command || 'command'}\``;
      } else if (tool.name === 'Read' || tool.name === 'read') {
        summary += ` - \`${(tool.input as Record<string, unknown>).file_path || 'file'}\``;
      } else if (tool.name === 'Write' || tool.name === 'write') {
        summary += ` - \`${(tool.input as Record<string, unknown>).file_path || 'file'}\``;
      }

      summary += '\n';
    }

    return summary;
  }
}

// =============================================================================
// Factory
// =============================================================================

let defaultManager: ToolVisibilityManager | null = null;

export function getToolVisibilityManager(): ToolVisibilityManager {
  if (!defaultManager) {
    defaultManager = new ToolVisibilityManager();
  }
  return defaultManager;
}

export function resetToolVisibilityManager(): void {
  defaultManager = null;
}
