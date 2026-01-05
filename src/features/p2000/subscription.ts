/**
 * P2000 Subscription Manager
 * Manages user subscriptions to P2000 notifications
 */

import type { P2000Subscription, P2000Filter, P2000Message } from './types';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ prefix: 'P2000Sub' });

// =============================================================================
// Subscription Storage Interface
// =============================================================================

export interface SubscriptionStorage {
  get(chatId: string): Promise<P2000Subscription | null>;
  set(subscription: P2000Subscription): Promise<void>;
  delete(chatId: string): Promise<boolean>;
  getAll(): Promise<P2000Subscription[]>;
  getAllEnabled(): Promise<P2000Subscription[]>;
}

// =============================================================================
// In-Memory Subscription Storage
// =============================================================================

export class MemorySubscriptionStorage implements SubscriptionStorage {
  private subscriptions: Map<string, P2000Subscription> = new Map();

  async get(chatId: string): Promise<P2000Subscription | null> {
    return this.subscriptions.get(chatId) || null;
  }

  async set(subscription: P2000Subscription): Promise<void> {
    this.subscriptions.set(subscription.chatId, subscription);
  }

  async delete(chatId: string): Promise<boolean> {
    return this.subscriptions.delete(chatId);
  }

  async getAll(): Promise<P2000Subscription[]> {
    return Array.from(this.subscriptions.values());
  }

  async getAllEnabled(): Promise<P2000Subscription[]> {
    return Array.from(this.subscriptions.values()).filter(s => s.enabled);
  }

  size(): number {
    return this.subscriptions.size;
  }

  clear(): void {
    this.subscriptions.clear();
  }
}

// =============================================================================
// Subscription Manager
// =============================================================================

export class P2000SubscriptionManager {
  private storage: SubscriptionStorage;

  constructor(storage: SubscriptionStorage) {
    this.storage = storage;
  }

  /**
   * Subscribe a chat to P2000 notifications
   */
  async subscribe(
    chatId: string,
    regions: string[] = [],
    filters: P2000Filter[] = []
  ): Promise<P2000Subscription> {
    const subscription: P2000Subscription = {
      chatId,
      enabled: true,
      regions,
      filters,
    };

    await this.storage.set(subscription);
    logger.info(`Chat ${chatId} subscribed to P2000 notifications`);

    return subscription;
  }

  /**
   * Unsubscribe a chat from P2000 notifications
   */
  async unsubscribe(chatId: string): Promise<boolean> {
    const deleted = await this.storage.delete(chatId);
    
    if (deleted) {
      logger.info(`Chat ${chatId} unsubscribed from P2000 notifications`);
    }

    return deleted;
  }

  /**
   * Enable notifications for a chat
   */
  async enable(chatId: string): Promise<boolean> {
    const sub = await this.storage.get(chatId);
    
    if (!sub) {
      // Create new subscription if doesn't exist
      await this.subscribe(chatId);
      return true;
    }

    sub.enabled = true;
    await this.storage.set(sub);
    logger.info(`Chat ${chatId} enabled P2000 notifications`);

    return true;
  }

  /**
   * Disable notifications for a chat
   */
  async disable(chatId: string): Promise<boolean> {
    const sub = await this.storage.get(chatId);
    
    if (!sub) {
      return false;
    }

    sub.enabled = false;
    await this.storage.set(sub);
    logger.info(`Chat ${chatId} disabled P2000 notifications`);

    return true;
  }

  /**
   * Get subscription for a chat
   */
  async getSubscription(chatId: string): Promise<P2000Subscription | null> {
    return this.storage.get(chatId);
  }

  /**
   * Check if a chat is subscribed
   */
  async isSubscribed(chatId: string): Promise<boolean> {
    const sub = await this.storage.get(chatId);
    return sub !== null && sub.enabled;
  }

  /**
   * Update subscription filters
   */
  async updateFilters(chatId: string, filters: P2000Filter[]): Promise<boolean> {
    const sub = await this.storage.get(chatId);
    
    if (!sub) {
      return false;
    }

    sub.filters = filters;
    await this.storage.set(sub);
    logger.info(`Chat ${chatId} updated filters`);

    return true;
  }

  /**
   * Update subscription regions
   */
  async updateRegions(chatId: string, regions: string[]): Promise<boolean> {
    const sub = await this.storage.get(chatId);
    
    if (!sub) {
      return false;
    }

    sub.regions = regions;
    await this.storage.set(sub);
    logger.info(`Chat ${chatId} updated regions`);

    return true;
  }

  /**
   * Get all enabled subscriptions
   */
  async getEnabledSubscriptions(): Promise<P2000Subscription[]> {
    return this.storage.getAllEnabled();
  }

  /**
   * Get all subscriptions
   */
  async getAllSubscriptions(): Promise<P2000Subscription[]> {
    return this.storage.getAll();
  }

  /**
   * Check if a message matches subscription filters
   */
  matchesFilters(message: P2000Message, subscription: P2000Subscription): boolean {
    // If no filters, match all
    if (!subscription.filters || subscription.filters.length === 0) {
      return true;
    }

    // Check each filter
    return subscription.filters.some(filter => {
      // Check service filter
      if (filter.service && message.service !== filter.service) {
        return false;
      }

      // Check priority filter (lower number = higher priority)
      if (filter.priority !== undefined && message.priority > filter.priority) {
        return false;
      }

      // Check keyword filter
      if (filter.keyword) {
        const keyword = filter.keyword.toLowerCase();
        const description = message.description.toLowerCase();
        
        if (!description.includes(keyword)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get statistics about subscriptions
   */
  async getStats(): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    byService: Record<string, number>;
  }> {
    const all = await this.storage.getAll();
    const enabled = all.filter(s => s.enabled);

    const byService: Record<string, number> = {};

    for (const sub of all) {
      for (const filter of sub.filters) {
        if (filter.service) {
          byService[filter.service] = (byService[filter.service] || 0) + 1;
        }
      }
    }

    return {
      total: all.length,
      enabled: enabled.length,
      disabled: all.length - enabled.length,
      byService,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new subscription storage instance
 */
export function createSubscriptionStorage(
  type: 'memory' = 'memory'
): SubscriptionStorage {
  switch (type) {
    case 'memory':
      return new MemorySubscriptionStorage();
    default:
      throw new Error(`Unsupported storage type: ${type}`);
  }
}

/**
 * Create a new subscription manager
 */
export function createSubscriptionManager(
  storage?: SubscriptionStorage
): P2000SubscriptionManager {
  return new P2000SubscriptionManager(
    storage || createSubscriptionStorage()
  );
}

/**
 * Singleton instance for simple usage
 */
let defaultManager: P2000SubscriptionManager | null = null;

/**
 * Get the default subscription manager (singleton)
 */
export function getSubscriptionManager(): P2000SubscriptionManager {
  if (!defaultManager) {
    defaultManager = createSubscriptionManager();
  }
  return defaultManager;
}

/**
 * Reset the default subscription manager (useful for testing)
 */
export function resetSubscriptionManager(): void {
  defaultManager = null;
}
