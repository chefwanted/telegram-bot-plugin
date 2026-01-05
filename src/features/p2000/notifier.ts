/**
 * P2000 Notification Service
 * Polls for new P2000 messages and sends notifications to subscribers
 */

import type { ApiMethods } from '../../api';
import type { P2000Message, P2000Subscription } from './types';
import { getP2000Scraper, type P2000Scraper } from './scraper';
import { getSubscriptionManager, type P2000SubscriptionManager } from './subscription';
import { isUtrechtRegion } from './filters';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ prefix: 'P2000Notifier' });

// =============================================================================
// Notification Service Configuration
// =============================================================================

export interface P2000NotifierConfig {
  /** Polling interval in milliseconds (default: 30 seconds) */
  pollInterval?: number;
  /** Maximum messages to check per poll (default: 50) */
  maxMessagesPerPoll?: number;
  /** Send at most X notifications per chat per interval (default: 5) */
  maxNotificationsPerChat?: number;
  /** Enable/disable notifications globally */
  enabled?: boolean;
}

const DEFAULT_CONFIG: Required<P2000NotifierConfig> = {
  pollInterval: 30000, // 30 seconds
  maxMessagesPerPoll: 50,
  maxNotificationsPerChat: 5,
  enabled: true,
};

// =============================================================================
// P2000 Notifier
// =============================================================================

export class P2000Notifier {
  private config: Required<P2000NotifierConfig>;
  private scraper: P2000Scraper;
  private subscriptionManager: P2000SubscriptionManager;
  private api: ApiMethods | null = null;
  private isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastMessageIds = new Set<string>();

  constructor(
    config: P2000NotifierConfig = {},
    scraper?: P2000Scraper,
    subscriptionManager?: P2000SubscriptionManager
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.scraper = scraper || getP2000Scraper();
    this.subscriptionManager = subscriptionManager || getSubscriptionManager();
  }

  /**
   * Start the notification service
   */
  start(api: ApiMethods): void {
    if (this.isRunning) {
      logger.warn('Notifier already running');
      return;
    }

    if (!this.config.enabled) {
      logger.info('Notifier is disabled');
      return;
    }

    this.api = api;
    this.isRunning = true;

    logger.info(`Starting P2000 notifier (poll interval: ${this.config.pollInterval}ms)`);

    // Start polling
    this.poll();
    this.pollTimer = setInterval(() => this.poll(), this.config.pollInterval);
    this.pollTimer.unref();
  }

  /**
   * Stop the notification service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping P2000 notifier');

    this.isRunning = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.api = null;
  }

  /**
   * Poll for new messages and send notifications
   */
  private async poll(): Promise<void> {
    if (!this.api) {
      logger.error('API not set, cannot send notifications');
      return;
    }

    try {
      // Fetch recent messages
      const messages = await this.scraper.fetchMessages({
        limit: this.config.maxMessagesPerPoll,
      });

      // Filter for new messages only
      const newMessages = messages.filter(m => !this.lastMessageIds.has(m.id));

      if (newMessages.length === 0) {
        logger.debug('No new messages');
        return;
      }

      logger.info(`Found ${newMessages.length} new P2000 messages`);

      // Track new message IDs
      newMessages.forEach(m => this.lastMessageIds.add(m.id));

      // Cleanup old message IDs (keep last 500)
      if (this.lastMessageIds.size > 500) {
        const ids = Array.from(this.lastMessageIds);
        this.lastMessageIds.clear();
        ids.slice(-250).forEach(id => this.lastMessageIds.add(id));
      }

      // Get all enabled subscriptions
      const subscriptions = await this.subscriptionManager.getEnabledSubscriptions();

      if (subscriptions.length === 0) {
        logger.debug('No active subscriptions');
        return;
      }

      // Send notifications to subscribers
      let notificationsSent = 0;

      for (const subscription of subscriptions) {
        const matchingMessages = newMessages.filter(message =>
          this.matchesSubscription(message, subscription)
        );

        if (matchingMessages.length === 0) {
          continue;
        }

        // Limit notifications per chat
        const messagesToSend = matchingMessages.slice(0, this.config.maxNotificationsPerChat);

        for (const message of messagesToSend) {
          try {
            await this.sendNotification(message, subscription.chatId);
            notificationsSent++;
          } catch (error) {
            logger.error(`Failed to send notification to ${subscription.chatId}`, { error });
          }
        }

        // If there are more messages than the limit, send a summary
        if (matchingMessages.length > this.config.maxNotificationsPerChat) {
          const remaining = matchingMessages.length - this.config.maxNotificationsPerChat;
          await this.sendSummary(subscription.chatId, remaining);
        }
      }

      logger.info(`Sent ${notificationsSent} notifications to ${subscriptions.length} subscribers`);
    } catch (error) {
      logger.error('Error during polling', { error });
    }
  }

  /**
   * Check if a message matches a subscription
   */
  private matchesSubscription(
    message: P2000Message,
    subscription: P2000Subscription
  ): boolean {
    // Check region filter
    if (subscription.regions && subscription.regions.length > 0) {
      const matchesRegion = subscription.regions.some(region =>
        message.description.toLowerCase().includes(region.toLowerCase()) ||
        message.region.toLowerCase().includes(region.toLowerCase())
      );

      if (!matchesRegion) {
        return false;
      }
    } else {
      // Default: only Utrecht region
      if (!isUtrechtRegion(message.description)) {
        return false;
      }
    }

    // Check filters
    return this.subscriptionManager.matchesFilters(message, subscription);
  }

  /**
   * Send a notification for a single message
   */
  private async sendNotification(message: P2000Message, chatId: string): Promise<void> {
    if (!this.api) {
      return;
    }

    const text = this.scraper.formatMessage(message);

    await this.api.sendMessage({
      chat_id: chatId,
      text: `🔔 *Nieuwe P2000 Melding*\n\n${text}`,
      parse_mode: 'Markdown',
      disable_notification: message.priority > 2, // Only notify for high priority
    });
  }

  /**
   * Send a summary message when there are too many notifications
   */
  private async sendSummary(chatId: string, remaining: number): Promise<void> {
    if (!this.api) {
      return;
    }

    await this.api.sendMessage({
      chat_id: chatId,
      text: `📊 _+${remaining} meer meldingen. Gebruik /p2000 om alles te zien._`,
      parse_mode: 'Markdown',
      disable_notification: true,
    });
  }

  /**
   * Check if the notifier is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<P2000NotifierConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Notifier config updated', config);

    // Restart if running and interval changed
    if (this.isRunning && config.pollInterval && this.api) {
      this.stop();
      this.start(this.api);
    }
  }

  /**
   * Get current statistics
   */
  async getStats(): Promise<{
    isRunning: boolean;
    trackedMessages: number;
    pollInterval: number;
    subscriptions: Awaited<ReturnType<P2000SubscriptionManager['getStats']>>;
  }> {
    return {
      isRunning: this.isRunning,
      trackedMessages: this.lastMessageIds.size,
      pollInterval: this.config.pollInterval,
      subscriptions: await this.subscriptionManager.getStats(),
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new P2000 notifier
 */
export function createP2000Notifier(config?: P2000NotifierConfig): P2000Notifier {
  return new P2000Notifier(config);
}

/**
 * Singleton instance for simple usage
 */
let defaultNotifier: P2000Notifier | null = null;

/**
 * Get the default notifier instance (singleton)
 */
export function getP2000Notifier(): P2000Notifier {
  if (!defaultNotifier) {
    defaultNotifier = createP2000Notifier();
  }
  return defaultNotifier;
}

/**
 * Reset the default notifier (useful for testing)
 */
export function resetP2000Notifier(): void {
  if (defaultNotifier) {
    defaultNotifier.stop();
  }
  defaultNotifier = null;
}
