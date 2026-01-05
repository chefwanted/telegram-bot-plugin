/**
 * Status Manager
 * Beheert streaming status en genereert status displays
 */

import { StreamStatus, type StreamState, type StatusDisplay, type ToolUseEvent, ANIMATION_FRAMES, getErrorSuggestions } from './types';
import { STATUS_DISPLAYS } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger({ prefix: 'StreamStatus' });

// =============================================================================
// Status Manager
// =============================================================================

export class StatusManager {
  private state: Map<string, StreamState> = new Map();
  private animationFrame: Map<string, number> = new Map();  // Track animation frame per chat
  private lastAnimationUpdate: Map<string, number> = new Map();

  /**
   * Create initial stream state for a chat
   */
  createState(chatId: string): StreamState {
    const state: StreamState = {
      status: 'idle' as StreamStatus,
      toolHistory: [],
      startTime: new Date(),
      lastUpdate: new Date(),
    };

    this.state.set(chatId, state);
    logger.debug(`Created stream state for chat ${chatId}`);
    return state;
  }

  /**
   * Get stream state for a chat
   */
  getState(chatId: string): StreamState | undefined {
    return this.state.get(chatId);
  }

  /**
   * Update stream status
   */
  updateStatus(chatId: string, status: StreamStatus, errorMessage?: string): void {
    const state = this.state.get(chatId);
    if (!state) {
      logger.warn(`No stream state for chat ${chatId}`);
      return;
    }

    state.status = status;
    state.lastUpdate = new Date();
    if (errorMessage) {
      state.errorMessage = errorMessage;
    }

    logger.debug(`Updated status for chat ${chatId} to ${status}`);
  }

  /**
   * Set current message ID
   */
  setMessageId(chatId: string, messageId: number): void {
    const state = this.state.get(chatId);
    if (state) {
      state.currentMessageId = messageId;
    }
  }

  /**
   * Set current tool being used
   */
  setCurrentTool(chatId: string, toolName: string): void {
    const state = this.state.get(chatId);
    if (state) {
      state.currentTool = toolName;
    }
  }

  /**
   * Add tool to history
   */
  addToolToHistory(chatId: string, tool: ToolUseEvent): void {
    const state = this.state.get(chatId);
    if (state) {
      state.toolHistory.push(tool);
    }
  }

  /**
   * Clear stream state for a chat
   */
  clearState(chatId: string): void {
    this.state.delete(chatId);
    this.animationFrame.delete(chatId);
    this.lastAnimationUpdate.delete(chatId);
    logger.debug(`Cleared stream state for chat ${chatId}`);
  }

  /**
   * Generate status display text with animations and tokens
   */
  generateStatusDisplay(chatId: string): string {
    const state = this.state.get(chatId);
    if (!state) {
      return '⏳ Initializing...';
    }

    const display = STATUS_DISPLAYS[state.status];
    let text = `${display.emoji} ${display.text}`;

    // Add animated dots for animated states
    if (display.animated) {
      const frame = this.getAnimationFrame(chatId);
      text += ANIMATION_FRAMES[frame];
    }

    // Add elapsed time for long operations
    if (display.showElapsed) {
      const elapsed = Date.now() - state.startTime.getTime();
      const seconds = Math.floor(elapsed / 1000);
      if (seconds >= 3) {
        text += ` (${seconds}s)`;
      }
    }

    // Add token usage if available (only on complete)
    if (state.status === StreamStatus.COMPLETE && state.totalTokens) {
      const tokens = state.totalTokens;
      const tokensK = (tokens / 1000).toFixed(1);
      text += `\n\n📊 ${tokensK}k tokens`;
      if (state.inputTokens && state.outputTokens) {
        text += ` (${(state.inputTokens / 1000).toFixed(1)}k in + ${(state.outputTokens / 1000).toFixed(1)}k out)`;
      }
    }

    // Add current tool if any
    if (state.currentTool) {
      text += `\n\n🔧 ${state.currentTool}`;
    }

    // Add error message with suggestions if any
    if (state.errorMessage) {
      text += `\n\n❌ ${state.errorMessage}`;
      const suggestions = getErrorSuggestions(state.errorMessage);
      if (suggestions.length > 0) {
        text += '\n\n💡 *Possible solutions:*';
        for (const suggestion of suggestions) {
          text += `\n${suggestion}`;
        }
      }
    }

    return text;
  }

  /**
   * Get current animation frame for chat
   */
  getAnimationFrame(chatId: string): number {
    const now = Date.now();
    const lastUpdate = this.lastAnimationUpdate.get(chatId) || 0;

    // Update animation every 500ms
    if (now - lastUpdate > 500) {
      const currentFrame = this.animationFrame.get(chatId) || 0;
      const nextFrame = (currentFrame + 1) % ANIMATION_FRAMES.length;
      this.animationFrame.set(chatId, nextFrame);
      this.lastAnimationUpdate.set(chatId, now);
      return nextFrame;
    }

    return this.animationFrame.get(chatId) || 0;
  }

  /**
   * Set token usage for a stream
   */
  setTokens(chatId: string, inputTokens: number, outputTokens: number): void {
    const state = this.state.get(chatId);
    if (state) {
      state.inputTokens = inputTokens;
      state.outputTokens = outputTokens;
      state.totalTokens = inputTokens + outputTokens;
    }
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedTime(chatId: string): number {
    const state = this.state.get(chatId);
    if (!state) return 0;

    return Math.floor((Date.now() - state.startTime.getTime()) / 1000);
  }

  /**
   * Check if stream is active
   */
  isActive(chatId: string): boolean {
    const state = this.state.get(chatId);
    return state !== undefined && state.status !== StreamStatus.IDLE && state.status !== StreamStatus.COMPLETE && state.status !== StreamStatus.ERROR;
  }

  /**
   * Cleanup old states (older than 1 hour)
   */
  cleanup(): number {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let cleaned = 0;

    for (const [chatId, state] of this.state.entries()) {
      if (state.lastUpdate.getTime() < oneHourAgo) {
        this.state.delete(chatId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old stream states`);
    }

    return cleaned;
  }
}

// =============================================================================
// Factory
// =============================================================================

let defaultManager: StatusManager | null = null;

export function getStatusManager(): StatusManager {
  if (!defaultManager) {
    defaultManager = new StatusManager();
  }
  return defaultManager;
}

export function resetStatusManager(): void {
  defaultManager = null;
}
