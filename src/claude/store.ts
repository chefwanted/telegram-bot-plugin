/**
 * Conversation Store for Claude Service
 * File-based persistence of conversation history per chat
 */

import * as fs from 'fs';
import * as path from 'path';
import { Conversation, ConversationMessage } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger({ prefix: 'ConversationStore' });

/** Store configuration options */
export interface ConversationStoreOptions {
  /** Directory to store conversation files (default: /tmp/telegram-claude-bot/conversations) */
  storagePath?: string;
  /** Time-to-live for conversations in seconds (default: 86400 = 24 hours) */
  ttl?: number;
  /** Cleanup interval in seconds (default: 3600 = 1 hour) */
  cleanupInterval?: number;
}

/** Conversation Store implementation */
export class ConversationStore {
  private readonly storagePath: string;
  private readonly ttl: number;
  private readonly cleanupIntervalMs: number;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: ConversationStoreOptions = {}) {
    this.storagePath = options.storagePath || '/tmp/telegram-claude-bot/conversations';
    this.ttl = options.ttl || 86400; // 24 hours
    this.cleanupIntervalMs = (options.cleanupInterval || 3600) * 1000;

    // Ensure storage directory exists
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }

    // Start cleanup interval
    this.startCleanup();
  }

  /** Get conversation for a chat ID */
  get(chatId: string): Conversation | null {
    const filePath = this.getFilePath(chatId);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const conversation = JSON.parse(content) as Conversation;

      // Check if expired
      if (this.isExpired(conversation)) {
        this.delete(chatId);
        return null;
      }

      return conversation;
    } catch (error) {
      logger.error(`Failed to load conversation for ${chatId}`, { error });
      return null;
    }
  }

  /** Save or update conversation for a chat ID */
  save(chatId: string, conversation: Conversation): void {
    const filePath = this.getFilePath(chatId);

    // Update metadata
    conversation.lastActivity = Date.now();
    conversation.messageCount = conversation.messages.length;

    try {
      fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2), 'utf-8');
    } catch (error) {
      logger.error(`Failed to save conversation for ${chatId}`, { error });
    }
  }

  /** Delete conversation for a chat ID */
  delete(chatId: string): void {
    const filePath = this.getFilePath(chatId);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        logger.error(`Failed to delete conversation for ${chatId}`, { error });
      }
    }
  }

  /** Create a new conversation */
  create(chatId: string): Conversation {
    return {
      id: chatId,
      messages: [],
      lastActivity: Date.now(),
      messageCount: 0,
    };
  }

  /** Add a message to conversation */
  addMessage(conversation: Conversation, role: 'user' | 'assistant', content: string): void {
    conversation.messages.push({
      role,
      content,
      timestamp: Date.now(),
    });
  }

  /** Clear messages from conversation (keeps conversation alive) */
  clearMessages(conversation: Conversation): void {
    conversation.messages = [];
    conversation.lastActivity = Date.now();
    conversation.messageCount = 0;
  }

  /** Get all active conversations */
  getAll(): Conversation[] {
    if (!fs.existsSync(this.storagePath)) {
      return [];
    }

    const files = fs.readdirSync(this.storagePath);
    const conversations: Conversation[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const chatId = file.replace('.json', '');
        const conversation = this.get(chatId);
        if (conversation) {
          conversations.push(conversation);
        }
      }
    }

    return conversations;
  }

  /** Cleanup expired conversations */
  cleanup(): number {
    const conversations = this.getAll();
    let cleaned = 0;

    for (const conversation of conversations) {
      if (this.isExpired(conversation)) {
        this.delete(conversation.id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /** Stop cleanup timer and cleanup resources */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /** Get file path for a chat ID */
  private getFilePath(chatId: string): string {
    return path.join(this.storagePath, `${chatId}.json`);
  }

  /** Check if conversation is expired */
  private isExpired(conversation: Conversation): boolean {
    const age = Date.now() - conversation.lastActivity;
    return age > this.ttl * 1000;
  }

  /** Start periodic cleanup */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const cleaned = this.cleanup();
      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} expired conversation(s)`);
      }
    }, this.cleanupIntervalMs);
    this.cleanupTimer.unref();
  }
}
