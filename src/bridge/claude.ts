/**
 * Claude Bridge Module
 * Verbindt Telegram bot met Claude Code sessie
 */

import { createLogger, Logger } from '../utils/logger';
import type { ApiMethods } from '../api';
import type { Message } from '../types/telegram';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Claude Message Types
// =============================================================================

export interface ClaudeMessage {
  id: string;
  timestamp: Date;
  from: 'telegram' | 'claude';
  content: string;
  userId?: number;
  chatId?: number;
  messageId?: number;
  processed?: boolean;
  response?: string;
}

export interface ClaudeSession {
  id: string;
  active: boolean;
  createdAt: Date;
  lastActivity: Date;
  messageCount: number;
}

// =============================================================================
// Claude Bridge Class
// =============================================================================

export class ClaudeBridge {
  private logger: Logger;
  private queuePath: string;
  private sessionPath: string;
  private session!: ClaudeSession;
  private processing = false;

  constructor(
    private api: ApiMethods,
    private options: {
      queueDir?: string;
      sessionId?: string;
    } = {}
  ) {
    this.logger = createLogger({ prefix: 'ClaudeBridge' });

    // Setup paths
    const baseDir = options.queueDir || '/tmp/claude-telegram-bridge';
    this.queuePath = path.join(baseDir, 'messages.jsonl');
    this.sessionPath = path.join(baseDir, 'session.json');

    // Create directories
    fs.mkdirSync(baseDir, { recursive: true });

    // Load or create session
    this.loadOrCreateSession();
  }

  /**
   * Verwerk inkomend Telegram bericht
   */
  async processTelegramMessage(message: Message): Promise<void> {
    if (!message.text || !message.from) {
      return;
    }

    this.logger.info('Processing Telegram message', {
      userId: message.from.id,
      text: message.text.substring(0, 50),
    });

    // Create Claude message
    const claudeMessage: ClaudeMessage = {
      id: this.generateId(),
      timestamp: new Date(),
      from: 'telegram',
      content: message.text,
      userId: message.from.id,
      chatId: message.chat.id,
      messageId: message.message_id,
      processed: false,
    };

    // Save to queue
    await this.enqueueMessage(claudeMessage);

    // Update session
    this.updateSession();

    // Notify user
    await this.api.sendText(
      message.chat.id,
      '🤖 Bericht doorgestuurd naar Claude...'
    );
  }

  /**
   * Start processing queue (polling)
   */
  startProcessing(): void {
    if (this.processing) {
      return;
    }

    this.processing = true;
    this.logger.info('Started processing queue');

    // Poll every second
    this.processQueue();
    setInterval(() => this.processQueue(), 1000);
  }

  /**
   * Stop processing queue
   */
  stopProcessing(): void {
    this.processing = false;
    this.logger.info('Stopped processing queue');
  }

  /**
   * Get session info
   */
  getSession(): ClaudeSession {
    return { ...this.session };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Process queued messages
   */
  private async processQueue(): Promise<void> {
    if (!this.processing) {
      return;
    }

    try {
      const messages = await this.loadMessages();

      for (const message of messages) {
        if (message.from === 'claude' && message.response && !message.processed) {
          // Send response to Telegram
          await this.sendToTelegram(message);
          message.processed = true;
          await this.updateMessage(message);
        }
      }
    } catch (error) {
      this.logger.error('Error processing queue', { error });
    }
  }

  /**
   * Send message to Telegram
   */
  private async sendToTelegram(message: ClaudeMessage): Promise<void> {
    if (!message.chatId || !message.response) {
      return;
    }

    this.logger.info('Sending to Telegram', {
      chatId: message.chatId,
      responseLength: message.response.length,
    });

    await this.api.sendText(message.chatId, message.response);
  }

  /**
   * Load messages from queue
   */
  private async loadMessages(): Promise<ClaudeMessage[]> {
    if (!fs.existsSync(this.queuePath)) {
      return [];
    }

    const content = fs.readFileSync(this.queuePath, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }

  /**
   * Enqueue message
   */
  private async enqueueMessage(message: ClaudeMessage): Promise<void> {
    const line = JSON.stringify(message) + '\n';
    fs.appendFileSync(this.queuePath, line);
  }

  /**
   * Update message in queue
   */
  private async updateMessage(message: ClaudeMessage): Promise<void> {
    const messages = await this.loadMessages();
    const index = messages.findIndex(m => m.id === message.id);

    if (index !== -1) {
      messages[index] = message;
      const content = messages.map(m => JSON.stringify(m)).join('\n') + '\n';
      fs.writeFileSync(this.queuePath, content);
    }
  }

  /**
   * Load or create session
   */
  private loadOrCreateSession(): void {
    if (fs.existsSync(this.sessionPath)) {
      const content = fs.readFileSync(this.sessionPath, 'utf-8');
      this.session = JSON.parse(content);
    } else {
      this.session = {
        id: this.options.sessionId || this.generateId(),
        active: true,
        createdAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
      };
      this.saveSession();
    }
  }

  /**
   * Save session
   */
  private saveSession(): void {
    fs.writeFileSync(this.sessionPath, JSON.stringify(this.session, null, 2));
  }

  /**
   * Update session
   */
  private updateSession(): void {
    this.session.lastActivity = new Date();
    this.session.messageCount++;
    this.saveSession();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==========================================================================
  // Public API for Claude Integration
  // ==========================================================================

  /**
   * Get pending messages (for Claude to read)
   */
  getPendingMessages(): ClaudeMessage[] {
    const messages: ClaudeMessage[] = [];
    if (fs.existsSync(this.queuePath)) {
      const content = fs.readFileSync(this.queuePath, 'utf-8');
      content.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
        .forEach(m => {
          if (m.from === 'telegram' && !m.processed) {
            messages.push(m);
          }
        });
    }
    return messages;
  }

  /**
   * Send response from Claude (to be queued for Telegram)
   */
  async sendResponse(messageId: string, response: string): Promise<void> {
    const messages = await this.loadMessages();
    const message = messages.find(m => m.id === messageId);

    if (message) {
      message.response = response;
      message.from = 'claude';
      await this.updateMessage(message);
      this.logger.info('Response queued', { messageId });
    }
  }

  /**
   * Get queue stats
   */
  getStats(): {
    session: ClaudeSession;
    pending: number;
    total: number;
  } {
    const messages = this.getPendingMessages();
    return {
      session: this.session,
      pending: messages.length,
      total: messages.length,
    };
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    if (fs.existsSync(this.queuePath)) {
      fs.unlinkSync(this.queuePath);
    }
    this.logger.info('Queue cleared');
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createClaudeBridge(
  api: ApiMethods,
  options?: { queueDir?: string; sessionId?: string }
): ClaudeBridge {
  return new ClaudeBridge(api, options);
}
