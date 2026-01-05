/**
 * P2000 Scraper
 * Fetches 112 emergency messages from public sources
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { P2000Message, P2000ScraperOptions } from './types';
import { isUtrechtRegion } from './filters';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ prefix: 'P2000' });

// =============================================================================
// Configuration
// =============================================================================

export interface P2000ScraperConfig {
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtl?: number;
  /** Maximum number of message IDs to track for deduplication */
  maxCacheSize?: number;
  /** Request timeout in milliseconds */
  requestTimeout?: number;
  /** User agent string for requests */
  userAgent?: string;
  /** Base URL for P2000 feed */
  feedUrl?: string;
}

const DEFAULT_CONFIG: Required<P2000ScraperConfig> = {
  cacheTtl: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 1000,
  requestTimeout: 15000,
  userAgent: 'Mozilla/5.0 (compatible; TelegramBot/1.0)',
  feedUrl: 'https://www.p2000.nl/rss',
};

// =============================================================================
// P2000 Scraper Class
// =============================================================================

export class P2000Scraper {
  private lastFetch = 0;
  private cache: P2000Message[] = [];
  private seenMessages = new Set<string>();
  private readonly config: Required<P2000ScraperConfig>;

  constructor(config: P2000ScraperConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Fetch recent P2000 messages
   */
  async fetchMessages(options: P2000ScraperOptions = {}): Promise<P2000Message[]> {
    const now = Date.now();

    // Return cached messages if still fresh
    if (now - this.lastFetch < this.config.cacheTtl && this.cache.length > 0) {
      logger.debug('Returning cached P2000 messages');
      return this.filterMessages(this.cache, options);
    }

    try {
      // Fetch from P2000.nl
      const messages = await this.fetchFromP2000NL();

      // Deduplicate
      const newMessages = messages.filter(m => !this.seenMessages.has(m.id));
      newMessages.forEach(m => this.seenMessages.add(m.id));

      // Clean old cache entries to prevent memory leaks
      if (this.seenMessages.size > this.config.maxCacheSize) {
        const entries = Array.from(this.seenMessages);
        this.seenMessages.clear();
        entries.slice(-Math.floor(this.config.maxCacheSize / 2)).forEach(id => this.seenMessages.add(id));
      }

      this.cache = messages;
      this.lastFetch = now;

      logger.info(`Fetched ${messages.length} P2000 messages, ${newMessages.length} new`);

      return this.filterMessages(messages, options);
    } catch (error) {
      logger.error('Error fetching P2000 messages', { error });

      // Return cached messages on error (graceful degradation)
      if (this.cache.length > 0) {
        logger.warn('Returning stale cached messages due to fetch error');
        return this.filterMessages(this.cache, options);
      }

      return [];
    }
  }

  /**
   * Fetch from P2000.nl RSS feed
   */
  private async fetchFromP2000NL(): Promise<P2000Message[]> {
    const messages: P2000Message[] = [];

    try {
      // Fetch the P2000.nl RSS feed
      const response = await axios.get(this.config.feedUrl, {
        timeout: this.config.requestTimeout,
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept': 'application/rss+xml, application/xml, text/xml',
        },
      });

      const $ = cheerio.load(response.data, { xmlMode: true });

      $('item').each((_, element) => {
        try {
          const $item = $(element);
          const title = $item.find('title').text().trim();
          const description = $item.find('description').text().trim();
          const pubDate = $item.find('pubDate').text().trim();
          const guid = $item.find('guid').text().trim();

          // Parse service type from title
          const service = this.parseService(title);

          // Parse priority from title (Ambulance 1, Brandweer 2, etc.)
          const priority = this.parsePriority(title);

          // Parse region/location
          const location = this.parseLocation(title + ' ' + description);

          // Create message
          const message: P2000Message = {
            id: guid || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: pubDate ? new Date(pubDate) : new Date(),
            region: location?.city || 'Onbekend',
            service,
            priority,
            description: description || title,
            location,
          };

          messages.push(message);
        } catch (error) {
          logger.warn('Error parsing P2000 item', { error });
        }
      });

    } catch (error) {
      logger.error('Error fetching from P2000.nl', { error });
    }

    return messages;
  }

  /**
   * Parse service type from message title
   */
  private parseService(title: string): P2000Message['service'] {
    const lower = title.toLowerCase();

    if (lower.includes('ambulance') || lower.includes('ambu')) {
      return 'ambulance';
    }
    if (lower.includes('brandweer') || lower.includes('brand')) {
      return 'brandweer';
    }
    if (lower.includes('politie')) {
      return 'politie';
    }
    if (lower.includes('knm') || lower.includes('kust')) {
      return 'knm';
    }
    if (lower.includes('ghor')) {
      return 'ghor';
    }

    return 'politie'; // Default
  }

  /**
   * Parse priority from message title
   * Handles multiple formats:
   * - "A1", "A 1", "A-1" (high priority ambulance/fire)
   * - "B1", "B 1", "B-1" (lower priority)
   * - "PRIO 1", "P1", "Prio: 1"
   * - "Grip 1", "GRIP1" (major incidents)
   */
  private parsePriority(title: string): number {
    const upperTitle = title.toUpperCase();
    
    // Check for GRIP (major incident coordination)
    const gripMatch = upperTitle.match(/GRIP\s*([1-4])/);
    if (gripMatch) {
      // GRIP incidents are highest priority
      return parseInt(gripMatch[1], 10);
    }
    
    // Check for A/B priority format (most common in P2000)
    const abMatch = title.match(/([AB])\s*[-]?\s*([12])/);
    if (abMatch) {
      const prio = abMatch[1].toUpperCase();
      const level = parseInt(abMatch[2], 10);
      
      // A1 = 1 (highest), A2 = 2, B1 = 11, B2 = 12
      if (prio === 'A') return level;
      if (prio === 'B') return level + 10;
    }
    
    // Check for explicit PRIO format
    const prioMatch = upperTitle.match(/PRIO[:\s]*([1-3])|P([1-3])(?![0-9])/);
    if (prioMatch) {
      return parseInt(prioMatch[1] || prioMatch[2], 10);
    }
    
    // Check for service-specific keywords that indicate priority
    if (upperTitle.includes('REANIMATIE') || upperTitle.includes('MMT')) {
      return 1; // Highest priority
    }
    if (upperTitle.includes('ZEER GROTE BRAND') || upperTitle.includes('MIDDELBRAND')) {
      return 1;
    }
    
    // Default to medium priority if unknown
    return 5;
  }

  /**
   * Parse location from message text
   */
  private parseLocation(text: string): P2000Message['location'] {
    const location: P2000Message['location'] = {};

    // Try to extract address and city
    const parts = text.split(/[\,\-]/);

    for (const part of parts) {
      const trimmed = part.trim();

      // Check if it's a known Utrecht region
      if (isUtrechtRegion(trimmed)) {
        location.city = trimmed;
        break;
      }

      // Check for address patterns (number at end)
      if (/\d+$/.test(trimmed) && trimmed.length < 50) {
        location.address = trimmed;
      }
    }

    return location;
  }

  /**
   * Filter messages by region and options
   */
  private filterMessages(messages: P2000Message[], options: P2000ScraperOptions): P2000Message[] {
    let filtered = messages;

    // Filter by Utrecht region by default
    if (!options.regions || options.regions.length === 0) {
      filtered = filtered.filter(m => isUtrechtRegion(m.description));
    } else {
      filtered = filtered.filter(m =>
        options.regions!.some(region =>
          m.description.toLowerCase().includes(region.toLowerCase()) ||
          m.region.toLowerCase().includes(region.toLowerCase())
        )
      );
    }

    // Limit results
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get recent messages (last hour)
   */
  async getRecentMessages(hours: number = 1): Promise<P2000Message[]> {
    const messages = await this.fetchMessages();
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    return messages.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Get messages by service type
   */
  async getMessagesByService(service: P2000Message['service'], limit: number = 20): Promise<P2000Message[]> {
    const messages = await this.fetchMessages();
    return messages.filter(m => m.service === service).slice(0, limit);
  }

  /**
   * Format message for Telegram
   */
  formatMessage(message: P2000Message): string {
    const emoji = this.getServiceEmoji(message.service);
    const location = message.location?.city || message.location?.address || message.region;
    const time = message.timestamp.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

    return `
${emoji} *${message.service.toUpperCase()}* | Prio ${message.priority}

${message.description}

📍 ${location} | 🕐 ${time}
    `.trim();
  }

  /**
   * Get emoji for service type
   */
  private getServiceEmoji(service: P2000Message['service']): string {
    switch (service) {
      case 'brandweer': return '🚒';
      case 'ambulance': return '🚑';
      case 'politie': return '👮';
      case 'knm': return '⚓';
      case 'ghor': return '🏥';
      default: return '📢';
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new P2000 scraper instance
 * @param config Optional configuration overrides
 */
export function createP2000Scraper(config?: P2000ScraperConfig): P2000Scraper {
  return new P2000Scraper(config);
}

/**
 * Singleton instance for simple usage
 */
let defaultInstance: P2000Scraper | null = null;

/**
 * Get the default scraper instance (singleton)
 */
export function getP2000Scraper(): P2000Scraper {
  if (!defaultInstance) {
    defaultInstance = createP2000Scraper();
  }
  return defaultInstance;
}

/**
 * Reset the default scraper instance (useful for testing)
 */
export function resetP2000Scraper(): void {
  defaultInstance = null;
}
