/**
 * News Feature Types
 */

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: Date;
  category?: string;
  imageUrl?: string;
}

export interface NewsSource {
  name: string;
  url: string;
  category: string;
  enabled: boolean;
}

export interface NewsOptions {
  category?: string;
  limit?: number;
  sources?: string[];
}
