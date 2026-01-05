/**
 * Claude Code CLI Service
 * Voert Claude Code uit via CLI en beheert sessies
 */

import { spawn } from 'child_process';
import type {
  ClaudeCodeOptions,
  ClaudeCodeSession,
  ClaudeCodeResponse,
  ClaudeCodeError,
  ClaudeCliMessage,
  ClaudeCliResult,
  SessionStorage,
  ClaudeCliContentBlock,
} from './types';
import { createSessionStorage, FileSessionStorage } from './sessions';
import { createLogger } from '../utils/logger';
import type { ToolUseEvent, ToolResultEvent, ClaudeCodeStreamCallbacks, StreamingResult } from '../streaming/types';

const logger = createLogger({ prefix: 'ClaudeCode' });

// =============================================================================
// Claude Code Service
// =============================================================================

export class ClaudeCodeService {
  private options: Required<ClaudeCodeOptions>;
  private storage: SessionStorage;
  private processing: Set<string> = new Set(); // chatIds currently processing

  constructor(options: ClaudeCodeOptions = {}) {
    this.options = {
      workingDir: options.workingDir || process.cwd(),
      cliBinary: options.cliBinary || 'claude',
      model: options.model || '',
      maxTokens: options.maxTokens || 16000,
      sessionStoragePath: options.sessionStoragePath || '/tmp/claude-telegram-sessions.json',
      timeout: options.timeout || 120000,
      allowedTools: options.allowedTools || [],
      deniedTools: options.deniedTools || [],
      systemPrompt: options.systemPrompt || '',
    };

    this.storage = createSessionStorage('file', { path: this.options.sessionStoragePath });
    logger.info('Claude Code service initialized', { workingDir: this.options.workingDir });
  }

  // ===========================================================================
  // Main Message Processing
  // ===========================================================================

  /**
   * Process a message from Telegram using Claude Code CLI
   */
  async processMessage(chatId: string, message: string): Promise<ClaudeCodeResponse> {
    // Prevent concurrent processing for same chat
    if (this.processing.has(chatId)) {
      throw this.createError('TIMEOUT', 'Er wordt al een bericht verwerkt voor deze chat. Even geduld...');
    }

    this.processing.add(chatId);

    try {
      // Get or create session
      let session = await this.storage.getActiveSession(chatId);
      const isNewSession = !session;

      if (!session) {
        session = await this.createNewSession(chatId);
      }

      // Run Claude CLI
      const startTime = Date.now();
      const result = await this.runClaudeCli(message, session);
      const durationMs = Date.now() - startTime;

      // Update session with token usage
      session.messageCount++;
      session.lastActivityAt = new Date();

      if (result.cost) {
        if (!session.tokenUsage) {
          session.tokenUsage = {
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalTokens: 0,
            totalCostUSD: 0,
          };
        }
        session.tokenUsage.totalInputTokens += result.cost.inputTokens || 0;
        session.tokenUsage.totalOutputTokens += result.cost.outputTokens || 0;
        session.tokenUsage.totalTokens += (result.cost.inputTokens || 0) + (result.cost.outputTokens || 0);
      }

      await this.storage.saveSession(session);

      return {
        text: result.text,
        sessionId: session.id,
        isNewSession,
        cost: result.cost,
        durationMs,
        exitCode: result.exitCode,
      };
    } finally {
      this.processing.delete(chatId);
    }
  }

  /**
   * Process a message with streaming callbacks
   * This method streams responses and tool usage in real-time
   */
  async processMessageStream(
    chatId: string,
    message: string,
    callbacks: ClaudeCodeStreamCallbacks
  ): Promise<StreamingResult> {
    // Prevent concurrent processing for same chat
    if (this.processing.has(chatId)) {
      throw this.createError('TIMEOUT', 'Er wordt al een bericht verwerkt voor deze chat. Even geduld...');
    }

    this.processing.add(chatId);

    try {
      // Get or create session
      let session = await this.storage.getActiveSession(chatId);
      const isNewSession = !session;

      if (!session) {
        session = await this.createNewSession(chatId);
      }

      // Run Claude CLI with streaming
      const startTime = Date.now();
      const result = await this.runClaudeCliStream(message, session, callbacks);
      const durationMs = Date.now() - startTime;

      // Update session
      session.messageCount++;
      session.lastActivityAt = new Date();
      await this.storage.saveSession(session);

      return {
        text: result.text,
        sessionId: session.id,
        isNewSession,
        durationMs,
        exitCode: result.exitCode,
        toolHistory: result.toolHistory || [],
      };
    } finally {
      this.processing.delete(chatId);
    }
  }

  // ===========================================================================
  // Session Management
  // ===========================================================================

  /**
   * Create a new session for a chat
   */
  async createNewSession(chatId: string, name?: string): Promise<ClaudeCodeSession> {
    const sessionId = this.generateSessionId();
    const session: ClaudeCodeSession = {
      id: sessionId,
      chatId,
      name: name || `Sessie ${new Date().toLocaleDateString('nl-NL')}`,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      messageCount: 0,
      workingDir: this.options.workingDir,
      isActive: true,
    };

    await this.storage.saveSession(session);
    await this.storage.setActiveSession(chatId, sessionId);

    logger.info(`New session created for chat ${chatId}`, { sessionId });
    return session;
  }

  /**
   * Start a completely new session (forget previous)
   */
  async startNewSession(chatId: string, name?: string): Promise<ClaudeCodeSession> {
    return this.createNewSession(chatId, name);
  }

  /**
   * Switch to an existing session
   */
  async switchSession(chatId: string, sessionId: string): Promise<ClaudeCodeSession | null> {
    const session = await this.storage.getSession(sessionId);
    if (!session || session.chatId !== chatId) {
      return null;
    }

    await this.storage.setActiveSession(chatId, sessionId);
    session.isActive = true;
    session.lastActivityAt = new Date();
    await this.storage.saveSession(session);

    logger.info(`Switched to session ${sessionId} for chat ${chatId}`);
    return session;
  }

  /**
   * Get current active session for a chat
   */
  async getActiveSession(chatId: string): Promise<ClaudeCodeSession | null> {
    return this.storage.getActiveSession(chatId);
  }

  /**
   * Get all sessions for a chat
   */
  async getSessionsForChat(chatId: string): Promise<ClaudeCodeSession[]> {
    return this.storage.getSessionsForChat(chatId);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    return this.storage.deleteSession(sessionId);
  }

  /**
   * End current session (just deactivates, doesn't delete)
   */
  async endSession(chatId: string): Promise<boolean> {
    const session = await this.storage.getActiveSession(chatId);
    if (!session) return false;

    session.isActive = false;
    await this.storage.saveSession(session);
    return true;
  }

  /**
   * Get session stats
   */
  async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    totalMessages: number;
  }> {
    const all = await this.storage.getAllSessions();
    return {
      totalSessions: all.length,
      activeSessions: all.filter(s => s.isActive).length,
      totalMessages: all.reduce((sum, s) => sum + s.messageCount, 0),
    };
  }

  // ===========================================================================
  // CLI Execution
  // ===========================================================================

  /**
   * Run Claude CLI with message
   */
  private async runClaudeCli(
    message: string,
    session: ClaudeCodeSession
  ): Promise<{ text: string; cost?: { inputTokens: number; outputTokens: number }; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const args = this.buildCliArgs(message, session);

      logger.debug('Running Claude CLI', { args: args.filter(a => !a.includes(message)) });

      const proc = spawn(this.options.cliBinary, args, {
        cwd: session.workingDir,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let hasOutput = false;

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        hasOutput = true;
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        hasOutput = true;
      });

      // Timeout
      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        
        // Provide better error message if CLI is not authenticated
        let errorMsg = `Claude CLI timed out after ${this.options.timeout}ms`;
        if (!hasOutput) {
          errorMsg += '\n\n⚠️ Claude CLI may not be authenticated. Please run `claude` in your terminal to set up authentication first.';
        }
        
        reject(this.createError('TIMEOUT', errorMsg));
      }, this.options.timeout);

      proc.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0 && !stdout) {
          logger.error('Claude CLI error', { code, stderr });
          
          // Check for authentication errors
          if (stderr.includes('auth') || stderr.includes('login') || stderr.includes('token')) {
            reject(this.createError('CLI_ERROR', 
              `Claude CLI authentication error.\n\nPlease run \`claude\` in your terminal to authenticate first.\n\nError: ${stderr}`, 
              code ?? undefined
            ));
            return;
          }
          
          reject(this.createError('CLI_ERROR', stderr || `Claude CLI exited with code ${code}`, code ?? undefined));
          return;
        }

        try {
          const result = this.parseCliOutput(stdout);
          resolve({
            text: result.text,
            cost: result.cost,
            exitCode: code || 0,
          });
        } catch (error) {
          logger.error('Failed to parse CLI output', { error, stdout });
          // Return raw output if parsing fails
          resolve({
            text: stdout.trim() || stderr.trim() || 'Geen output van Claude.',
            exitCode: code || 0,
          });
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeout);
        logger.error('Failed to spawn Claude CLI', { error });
        
        // Check if binary exists
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(this.createError('CLI_ERROR', 
            `Claude CLI not found at "${this.options.cliBinary}".\n\nPlease install Claude CLI first: https://github.com/anthropics/claude-cli`
          ));
          return;
        }
        
        reject(this.createError('CLI_ERROR', `Failed to run claude: ${error.message}`));
      });
    });
  }

  /**
   * Run Claude CLI with streaming callbacks
   * Parses JSON line-by-line from stdout and emits events
   */
  private async runClaudeCliStream(
    message: string,
    session: ClaudeCodeSession,
    callbacks: ClaudeCodeStreamCallbacks
  ): Promise<{ text: string; exitCode: number; toolHistory?: ToolUseEvent[] }> {
    return new Promise((resolve, reject) => {
      const args = this.buildStreamCliArgs(message, session);

      logger.debug('Running Claude CLI (streaming)', { args: args.filter(a => !a.includes(message)) });

      const proc = spawn(this.options.cliBinary, args, {
        cwd: session.workingDir,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stderr = '';
      let accumulatedText = '';
      const toolHistory: ToolUseEvent[] = [];
      let currentToolUse: ToolUseEvent | null = null;
      let hasOutput = false;

      // Parse stdout line by line
      proc.stdout.on('data', (data) => {
        hasOutput = true;
        const lines = data.toString().split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const msg: ClaudeCliMessage = JSON.parse(line);
            this.handleStreamMessage(msg, callbacks, {
              accumulatedText,
              toolHistory,
              currentToolUse,
              onTextUpdate: (text: string) => { accumulatedText = text; },
              setCurrentTool: (tool: ToolUseEvent | null) => { currentToolUse = tool; },
            });
          } catch (parseError) {
            // Not JSON, treat as plain text
            if (line.trim()) {
              accumulatedText += line + '\n';
              callbacks.onContent?.(line + '\n');
            }
          }
        }
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        hasOutput = true;
      });

      // Timeout
      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        
        // Provide better error message if CLI is not authenticated
        let errorMsg = `Claude CLI timed out after ${this.options.timeout}ms`;
        if (!hasOutput) {
          errorMsg += '\n\n⚠️ Claude CLI may not be authenticated. Please run `claude` in your terminal to set up authentication first.';
        }
        
        const error = new Error(errorMsg);
        callbacks.onError?.(error);
        reject(this.createError('TIMEOUT', errorMsg));
      }, this.options.timeout);

      proc.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0 && !accumulatedText) {
          logger.error('Claude CLI error', { code, stderr });
          
          // Check for authentication errors
          if (stderr.includes('auth') || stderr.includes('login') || stderr.includes('token')) {
            const authError = new Error(
              `Claude CLI authentication error.\n\nPlease run \`claude\` in your terminal to authenticate first.\n\nError: ${stderr}`
            );
            callbacks.onError?.(authError);
            reject(this.createError('CLI_ERROR', authError.message, code ?? undefined));
            return;
          }
          
          callbacks.onError?.(new Error(stderr || `Claude CLI exited with code ${code}`));
          reject(this.createError('CLI_ERROR', stderr || `Claude CLI exited with code ${code}`, code ?? undefined));
          return;
        }

        // Notify completion
        callbacks.onComplete?.({
          text: accumulatedText.trim() || stderr.trim() || 'Geen output van Claude.',
          sessionId: session.id,
          isNewSession: false,
          durationMs: 0,
          exitCode: code || 0,
          toolHistory,
        });

        resolve({
          text: accumulatedText.trim() || stderr.trim() || 'Geen output van Claude.',
          exitCode: code || 0,
          toolHistory,
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timeout);
        logger.error('Failed to spawn Claude CLI', { error });
        
        // Check if binary exists
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          const notFoundError = new Error(
            `Claude CLI not found at "${this.options.cliBinary}".\n\nPlease install Claude CLI first: https://github.com/anthropics/claude-cli`
          );
          callbacks.onError?.(notFoundError);
          reject(this.createError('CLI_ERROR', notFoundError.message));
          return;
        }
        
        callbacks.onError?.(error);
        reject(this.createError('CLI_ERROR', `Failed to run claude: ${error.message}`));
      });
    });
  }

  /**
   * Build CLI arguments
   */
  private buildCliArgs(message: string, session: ClaudeCodeSession): string[] {
    const args: string[] = [
      '--print',           // Print response only (no interactive)
      '--output-format', 'json',  // JSON output for parsing
    ];

    // Resume session if we have one with messages
    if (session.messageCount > 0) {
      args.push('--resume', session.id);
    }

    // Model override
    if (this.options.model) {
      args.push('--model', this.options.model);
    }

    // Max tokens
    if (this.options.maxTokens) {
      args.push('--max-turns', '1'); // Single turn for Telegram
    }

    // Allowed tools
    for (const tool of this.options.allowedTools) {
      args.push('--allowedTools', tool);
    }

    // Denied tools
    for (const tool of this.options.deniedTools) {
      args.push('--disallowedTools', tool);
    }

    // System prompt
    if (this.options.systemPrompt) {
      args.push('--system-prompt', this.options.systemPrompt);
    }

    // The message itself
    args.push('--', message);

    return args;
  }

  /**
   * Build CLI arguments for streaming (without --print flag)
   */
  private buildStreamCliArgs(message: string, session: ClaudeCodeSession): string[] {
    const args: string[] = [
      '--output-format', 'json',  // JSON output for parsing
    ];

    // Resume session if we have one with messages
    if (session.messageCount > 0) {
      args.push('--resume', session.id);
    }

    // Model override
    if (this.options.model) {
      args.push('--model', this.options.model);
    }

    // Max tokens
    if (this.options.maxTokens) {
      args.push('--max-turns', '1'); // Single turn for Telegram
    }

    // Allowed tools
    for (const tool of this.options.allowedTools) {
      args.push('--allowedTools', tool);
    }

    // Denied tools
    for (const tool of this.options.deniedTools) {
      args.push('--disallowedTools', tool);
    }

    // System prompt
    if (this.options.systemPrompt) {
      args.push('--system-prompt', this.options.systemPrompt);
    }

    // The message itself
    args.push('--', message);

    return args;
  }

  /**
   * Parse JSON output from Claude CLI
   */
  private parseCliOutput(output: string): { text: string; cost?: { inputTokens: number; outputTokens: number } } {
    const lines = output.trim().split('\n');
    let text = '';
    let cost: { inputTokens: number; outputTokens: number } | undefined;

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const msg: ClaudeCliMessage = JSON.parse(line);

        if (msg.type === 'assistant' && msg.message?.content) {
          // Extract text from content
          if (typeof msg.message.content === 'string') {
            text += msg.message.content;
          } else if (Array.isArray(msg.message.content)) {
            for (const block of msg.message.content) {
              if (block.type === 'text' && block.text) {
                text += block.text;
              }
            }
          }
        }

        if (msg.type === 'result') {
          const result = msg as unknown as ClaudeCliResult;
          if (result.result) {
            text = result.result;
          }
          // Note: Claude CLI gives cost in USD, not tokens directly
          // We can estimate or just skip for now
        }
      } catch {
        // Not JSON, might be plain text fallback
        text += line + '\n';
      }
    }

    return { text: text.trim(), cost };
  }

  /**
   * Handle streaming JSON message from Claude CLI
   * Parse message types and emit appropriate callbacks
   */
  private handleStreamMessage(
    msg: ClaudeCliMessage,
    callbacks: ClaudeCodeStreamCallbacks,
    context: {
      accumulatedText: string;
      toolHistory: ToolUseEvent[];
      currentToolUse: ToolUseEvent | null;
      onTextUpdate: (text: string) => void;
      setCurrentTool: (tool: ToolUseEvent | null) => void;
    }
  ): void {
    const { accumulatedText, toolHistory, currentToolUse, onTextUpdate, setCurrentTool } = context;

    switch (msg.type) {
      case 'assistant':
        // Assistant message with content blocks
        if (msg.message?.content) {
          let extractedText = '';

          if (typeof msg.message.content === 'string') {
            extractedText = msg.message.content;
          } else if (Array.isArray(msg.message.content)) {
            for (const block of msg.message.content) {
              if (block.type === 'text' && block.text) {
                extractedText += block.text;
              } else if (block.type === 'tool_use' && block.name && block.input) {
                // Tool use detected
                const toolUse: ToolUseEvent = {
                  type: 'tool_use',
                  id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  name: block.name,
                  input: block.input,
                  timestamp: new Date(),
                };

                toolHistory.push(toolUse);
                setCurrentTool(toolUse);
                callbacks.onToolUse?.(toolUse);
              } else if (block.type === 'tool_result' && block.content) {
                // Tool result detected
                if (currentToolUse) {
                  const toolResult: ToolResultEvent = {
                    type: 'tool_result',
                    toolUseId: currentToolUse.id,
                    content: block.content,
                    isError: false,
                    timestamp: new Date(),
                  };

                  callbacks.onToolResult?.(toolResult);
                  setCurrentTool(null);
                }
              }
            }
          }

          if (extractedText) {
            onTextUpdate(accumulatedText + extractedText);
            callbacks.onContent?.(extractedText);
          }
        }
        break;

      case 'result':
        // Final result message
        const result = msg as unknown as ClaudeCliResult;
        if (result.result) {
          onTextUpdate(result.result);
          callbacks.onContent?.(result.result);
        }
        break;

      case 'system':
        // System messages (ignore for now)
        break;

      default:
        // Unknown message type, try to extract content
        if (msg.content) {
          onTextUpdate(accumulatedText + msg.content);
          callbacks.onContent?.(msg.content);
        }
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `tg-${timestamp}-${random}`;
  }

  private createError(code: ClaudeCodeError['code'], message: string, exitCode?: number): ClaudeCodeError {
    const error = new Error(message) as ClaudeCodeError;
    error.code = code;
    error.exitCode = exitCode;
    return error;
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    if (this.storage instanceof FileSessionStorage) {
      this.storage.destroy();
    }
    logger.info('Claude Code service destroyed');
  }
}

// =============================================================================
// Factory
// =============================================================================

let defaultService: ClaudeCodeService | null = null;

export function createClaudeCodeService(options?: ClaudeCodeOptions): ClaudeCodeService {
  return new ClaudeCodeService(options);
}

export function getClaudeCodeService(): ClaudeCodeService {
  if (!defaultService) {
    defaultService = createClaudeCodeService();
  }
  return defaultService;
}

export function resetClaudeCodeService(): void {
  if (defaultService) {
    defaultService.destroy();
    defaultService = null;
  }
}
