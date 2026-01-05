/**
 * News Service
 * RSS and NewsAPI integration
 */

import Parser from 'rss-parser';
import axios from 'axios';
import type { NewsArticle, NewsSource, NewsOptions } from './types';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ prefix: 'News' });

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; TelegramBot/1.0)',
  },
});

// =============================================================================
// Default RSS Sources
// =============================================================================

const DEFAULT_SOURCES: NewsSource[] = [
  // Dutch News
  { name: 'NU.nl', url: 'https://www.nu.nl/rss', category: 'algemeen', enabled: true },
  { name: 'NOS', url: 'https://feeds.nos.nl/nosnieuws_algemeen', category: 'algemeen', enabled: true },
  { name: 'AD Nieuws', url: 'https://www.ad.nl/rss.xml', category: 'algemeen', enabled: true },
  { name: 'RTL Nieuws', url: 'https://www.rtlnieuws.nl/rss.xml', category: 'algemeen', enabled: true },
  { name: 'De Volkskrant', url: 'https://www.volkskrant.nl/secties/voorpagina/rss.xml', category: 'algemeen', enabled: true },

  // Tech News
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'tech', enabled: true },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tech', enabled: true },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tech', enabled: true },

  // World News
  { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/rss.xml', category: 'wereld', enabled: true },
  { name: 'CNN', url: 'http://rss.cnn.com/rss/edition.rss', category: 'wereld', enabled: true },
  { name: 'Reuters', url: 'https://www.reutersagency.com/feed/', category: 'wereld', enabled: true },
];

// =============================================================================
// News Service Class
// =============================================================================

export class NewsService {
  private sources: NewsSource[] = [...DEFAULT_SOURCES];

  /**
   * Fetch news from RSS feeds
   */
  async fetchNews(options: NewsOptions = {}): Promise<NewsArticle[]> {
    const { category, limit = 10 } = options;

    // Filter sources by category if specified
    let sourcesToUse = this.sources.filter(s => s.enabled);
    if (category) {
      sourcesToUse = sourcesToUse.filter(s => s.category === category);
    }

    // Limit sources to fetch from to avoid timeout
    sourcesToUse = sourcesToUse.slice(0, 5);

    const allArticles: NewsArticle[] = [];

    // Fetch from all sources in parallel
    const fetchPromises = sourcesToUse.map(source => this.fetchFromSource(source));
    const results = await Promise.allSettled(fetchPromises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allArticles.push(...result.value);
      } else {
        logger.warn('Failed to fetch from source', { error: result.reason });
      }
    }

    // Sort by published date (newest first)
    allArticles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    // Return limited results
    return allArticles.slice(0, limit);
  }

  /**
   * Fetch from a single RSS source
   */
  private async fetchFromSource(source: NewsSource): Promise<NewsArticle[]> {
    try {
      const feed = await parser.parseURL(source.url);

      if (!feed.items) {
        return [];
      }

      return feed.items.slice(0, 20).map((item, index) => ({
        id: `${source.name}-${index}-${Date.now()}`,
        title: item.title || 'Geen titel',
        description: this.cleanDescription(item.contentSnippet || item.content || ''),
        url: item.link || '',
        source: source.name,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        category: source.category,
        imageUrl: this.extractImageUrl(item),
      }));
    } catch (error) {
      logger.error(`Error fetching from ${source.name}`, { error });
      return [];
    }
  }

  /**
   * Clean HTML from description
   */
  private cleanDescription(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
      .substring(0, 300); // Limit length
  }

  /**
   * Extract image URL from RSS item
   */
  private extractImageUrl(item: {
    enclosure?: { type?: string; url?: string };
    'media:content'?: { $?: { url?: string } };
    'media:thumbnail'?: { $?: { url?: string } };
  }): string | undefined {
    // Try different fields where images might be stored
    if (item.enclosure && item.enclosure.type?.startsWith('image/')) {
      return item.enclosure.url;
    }
    if (item['media:content']?.$?.url) {
      return item['media:content'].$.url;
    }
    if (item['media:thumbnail']?.$?.url) {
      return item['media:thumbnail'].$.url;
    }
    return undefined;
  }

  /**
   * Search news by keyword
   */
  async searchNews(query: string, options: NewsOptions = {}): Promise<NewsArticle[]> {
    const allNews = await this.fetchNews({ ...options, limit: 50 });

    const lowerQuery = query.toLowerCase();
    return allNews.filter(article =>
      article.title.toLowerCase().includes(lowerQuery) ||
      article.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get available categories
   */
  getCategories(): string[] {
    const categories = new Set(this.sources.map(s => s.category));
    return Array.from(categories).sort();
  }

  /**
   * Get available sources
   */
  getSources(category?: string): NewsSource[] {
    if (category) {
      return this.sources.filter(s => s.category === category);
    }
    return [...this.sources];
  }

  /**
   * Format article for Telegram message
   */
  formatArticle(article: NewsArticle): string {
    return `
*${article.title}*

${article.description}

📰 ${article.source} | ${article.publishedAt.toLocaleDateString('nl-NL')}

[Lees meer](${article.url})
    `.trim();
  }

  /**
   * Format multiple articles for Telegram
   */
  formatArticles(articles: NewsArticle[]): string {
    if (articles.length === 0) {
      return 'Geen nieuws gevonden.';
    }

    const header = `*📰 Nieuws (${articles.length} artikelen)*\n\n`;

    const articlesText = articles.map(article =>
      `*${article.title}*\n_${article.source}_ | ${article.publishedAt.toLocaleDateString('nl-NL')}\n`
    ).join('\n');

    return header + articlesText + '\n\nGebruik /news-search <term> om te zoeken';
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createNewsService(): NewsService {
  return new NewsService();
}
