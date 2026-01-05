/**
 * Streaming Module Types
 * Types voor streaming responses en tool visibility
 */

// =============================================================================
// Streaming Status
// =============================================================================

export enum StreamStatus {
  IDLE = 'idle',
  THINKING = 'thinking',      // ⏳ Claude is thinking...
  TOOL_USE = 'tool_use',       // 🔧 Using: Read
  RESPONSE = 'response',       // ✍️ Generating response...
  CONFIRMATION = 'confirmation',  // ❓ Awaiting confirmation
  COMPLETE = 'complete',       // ✅ Complete
  ERROR = 'error'              // ❌ Error
}

// =============================================================================
// Tool Use Events
// =============================================================================

export interface ToolUseEvent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
  timestamp: Date;
}

export interface ToolResultEvent {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
  timestamp: Date;
}

// =============================================================================
// Streaming State
// =============================================================================

export interface StreamState {
  status: StreamStatus;
  currentMessageId?: number;
  currentTool?: string;
  pendingConfirmation?: string;
  toolHistory: ToolUseEvent[];
  startTime: Date;
  lastUpdate: Date;
  errorMessage?: string;
  // Token tracking (if available from Claude Code)
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

// =============================================================================
// Callback Types
// =============================================================================

export interface ClaudeCodeStreamCallbacks {
  onContent?: (chunk: string) => void;
  onToolUse?: (tool: ToolUseEvent) => void;
  onToolResult?: (result: ToolResultEvent) => void;
  onStatusChange?: (status: StreamStatus) => void;
  onError?: (error: Error) => void;
  onComplete?: (result: StreamingResult) => void;
}

export interface StreamingResult {
  text: string;
  sessionId: string;
  isNewSession: boolean;
  durationMs: number;
  exitCode: number;
  toolHistory: ToolUseEvent[];
}

// =============================================================================
// Status Display
// =============================================================================

export interface StatusDisplay {
  emoji: string;
  text: string;
  showElapsed?: boolean;
  animated?: boolean;  // Whether to show animated dots
  subtext?: string;    // Additional context
}

export const STATUS_DISPLAYS: Record<StreamStatus, StatusDisplay> = {
  [StreamStatus.IDLE]: { emoji: '💤', text: 'Ready' },
  [StreamStatus.THINKING]: { emoji: '🤔', text: 'Analyzing', showElapsed: true, animated: true, subtext: 'Thinking about your request...' },
  [StreamStatus.TOOL_USE]: { emoji: '🔧', text: 'Working', subtext: 'Using tools to complete your request' },
  [StreamStatus.RESPONSE]: { emoji: '✍️', text: 'Writing', showElapsed: true, animated: true, subtext: 'Generating response...' },
  [StreamStatus.CONFIRMATION]: { emoji: '⚠️', text: 'Confirmation needed', subtext: 'A potentially dangerous operation requires your approval' },
  [StreamStatus.COMPLETE]: { emoji: '✅', text: 'Done' },
  [StreamStatus.ERROR]: { emoji: '❌', text: 'Error' },
};

// =============================================================================
// Animation Frames
// =============================================================================

export const ANIMATION_FRAMES = ['.', '..', '...'];

// =============================================================================
// Error Recovery Suggestions
// =============================================================================

export interface ErrorSuggestion {
  errorPattern: RegExp;
  suggestions: string[];
}

export const ERROR_SUGGESTIONS: ErrorSuggestion[] = [
  {
    errorPattern: /permission|denied|access/i,
    suggestions: [
      '🔑 Check file permissions with `ls -la`',
      '👤 Try running with different user permissions',
      '📂 Verify the file/directory path is correct',
    ],
  },
  {
    errorPattern: /not found|no such file|does not exist/i,
    suggestions: [
      '🔍 Verify the file path is correct',
      '📂 List directory contents with `ls` or `dir`',
      '📍 Check your current working directory',
    ],
  },
  {
    errorPattern: /timeout|timed out/i,
    suggestions: [
      '⏱️ The operation took too long',
      '🔄 Try again with a smaller task',
      '📊 Check system resources',
    ],
  },
  {
    errorPattern: /network|connection|dns/i,
    suggestions: [
      '🌐 Check your internet connection',
      '🔌 Verify VPN or proxy settings',
      '🔄 Try the operation again',
    ],
  },
  {
    errorPattern: /syntax|parse|unexpected/i,
    suggestions: [
      '📝 Review the code for syntax errors',
      '🔍 Check for missing brackets or quotes',
      '💡 Ask Claude to explain the error',
    ],
  },
  {
    errorPattern: /memory|out of memory|oom/i,
    suggestions: [
      '💾 Close unnecessary applications',
      '🔄 Try with a smaller file or dataset',
      '🖥️ Consider increasing available memory',
    ],
  },
];

/**
 * Get error suggestions based on error message
 */
export function getErrorSuggestions(errorMessage: string): string[] {
  for (const { errorPattern, suggestions } of ERROR_SUGGESTIONS) {
    if (errorPattern.test(errorMessage)) {
      return suggestions;
    }
  }
  return [
    '💡 Try asking Claude to explain what went wrong',
    '🔄 Retry the operation',
    '📋 Review the steps that led to this error',
  ];
}

// =============================================================================
// Chunking Options
// =============================================================================

export interface ChunkingOptions {
  maxLength?: number;      // Max chars per message (default 4000)
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  onChunkSent?: (chunk: string, remaining: string, index: number) => void;
}

// =============================================================================
// Message Chunk
// =============================================================================

export interface MessageChunk {
  content: string;
  isComplete: boolean;
  index: number;
  total?: number;
}

/**
 * Split text into chunks respecting Telegram limits and formatting
 */
export function splitIntoChunks(text: string, maxLength: number = 4000): MessageChunk[] {
  const chunks: MessageChunk[] = [];
  const lines = text.split('\n');
  let current = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // If adding this line would exceed limit
    if ((current + line).length > maxLength) {
      if (current) {
        chunks.push({
          content: current,
          isComplete: false,
          index: chunks.length,
        });
      }

      // If single line exceeds limit, split it
      if (line.length > maxLength) {
        const lineChunks = Math.ceil(line.length / maxLength);
        for (let j = 0; j < lineChunks; j++) {
          chunks.push({
            content: line.substring(j * maxLength, (j + 1) * maxLength),
            isComplete: j === lineChunks - 1 && i === lines.length - 1,
            index: chunks.length,
          });
        }
        current = '';
      } else {
        current = line + '\n';
      }
    } else {
      current += (current ? '\n' : '') + line;
    }
  }

  // Add remaining content
  if (current) {
    chunks.push({
      content: current,
      isComplete: true,
      index: chunks.length,
    });
  }

  // Mark total count
  return chunks.map((chunk, idx) => ({
    ...chunk,
    total: chunks.length,
  }));
}
