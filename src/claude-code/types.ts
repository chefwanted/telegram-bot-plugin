/**
 * Claude Code CLI Service Types
 * Types voor integratie met Claude Code via CLI
 */

// =============================================================================
// Service Options
// =============================================================================

export interface ClaudeCodeOptions {
  /** Working directory for Claude Code (default: process.cwd()) */
  workingDir?: string;
  /** Claude CLI binary path (default: 'claude') */
  cliBinary?: string;
  /** Default model to use */
  model?: string;
  /** Max output tokens */
  maxTokens?: number;
  /** Session storage path */
  sessionStoragePath?: string;
  /** Timeout for CLI calls in ms (default: 120000 = 2 min) */
  timeout?: number;
  /** Allowed tools for Claude Code */
  allowedTools?: string[];
  /** Denied tools for Claude Code */
  deniedTools?: string[];
  /** System prompt override */
  systemPrompt?: string;
}

// =============================================================================
// Session Types
// =============================================================================

export interface ClaudeCodeSession {
  /** Unique session ID (from Claude CLI) */
  id: string;
  /** Telegram chat ID this session belongs to */
  chatId: string;
  /** Session name/label for display */
  name: string;
  /** When session was created */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
  /** Number of messages in session */
  messageCount: number;
  /** Working directory for this session */
  workingDir: string;
  /** Whether session is currently active for this chat */
  isActive: boolean;
}

export interface SessionStorage {
  /** Get session by chat ID (active session) */
  getActiveSession(chatId: string): Promise<ClaudeCodeSession | null>;
  /** Get all sessions for a chat */
  getSessionsForChat(chatId: string): Promise<ClaudeCodeSession[]>;
  /** Get session by ID */
  getSession(sessionId: string): Promise<ClaudeCodeSession | null>;
  /** Save/update session */
  saveSession(session: ClaudeCodeSession): Promise<void>;
  /** Set active session for chat */
  setActiveSession(chatId: string, sessionId: string): Promise<void>;
  /** Delete session */
  deleteSession(sessionId: string): Promise<boolean>;
  /** Get all sessions */
  getAllSessions(): Promise<ClaudeCodeSession[]>;
}

// =============================================================================
// Response Types
// =============================================================================

export interface ClaudeCodeResponse {
  /** Response text from Claude */
  text: string;
  /** Session ID used */
  sessionId: string;
  /** Whether this created a new session */
  isNewSession: boolean;
  /** Cost info if available */
  cost?: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Duration in ms */
  durationMs: number;
  /** Exit code from CLI */
  exitCode: number;
}

export interface ClaudeCodeError extends Error {
  code: 'TIMEOUT' | 'CLI_ERROR' | 'SESSION_ERROR' | 'PARSE_ERROR' | 'UNKNOWN';
  exitCode?: number;
  stderr?: string;
}

// =============================================================================
// CLI Output Types (from Claude CLI JSON output)
// =============================================================================

export interface ClaudeCliMessage {
  type: 'user' | 'assistant' | 'system' | 'result';
  message?: {
    role: string;
    content: string | ClaudeCliContentBlock[];
  };
  content?: string;
  session_id?: string;
  cost_usd?: number;
  is_error?: boolean;
  duration_ms?: number;
  duration_api_ms?: number;
}

export interface ClaudeCliContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string;
}

export interface ClaudeCliResult {
  type: 'result';
  session_id: string;
  cost_usd: number;
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result?: string;
}

// =============================================================================
// Command Types
// =============================================================================

export type ClaudeCodeCommand = 
  | { type: 'message'; content: string }
  | { type: 'new_session'; name?: string }
  | { type: 'switch_session'; sessionId: string }
  | { type: 'list_sessions' }
  | { type: 'end_session' }
  | { type: 'status' };
