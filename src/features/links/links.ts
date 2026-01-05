/**
 * Links Feature - URL shortener and preview
 */

import axios from 'axios';
import * as crypto from 'crypto';

// In-memory storage for shortened URLs
const urlStore = new Map<string, { original: string; createdAt: number; clicks: number }>();
const BASE_URL = process.env.BASE_URL || 'https://t.example.com';

export interface LinkPreview {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}

export interface ShortenedUrl {
  shortCode: string;
  shortUrl: string;
  original: string;
  createdAt: number;
  clicks: number;
}

// Generate short code
function generateShortCode(url: string): string {
  return crypto.createHash('md5').update(url + Date.now()).digest('hex').substring(0, 6);
}

// Shorten URL
export function shortenUrl(url: string): ShortenedUrl {
  const code = generateShortCode(url);
  const shortUrl = `${BASE_URL}/${code}`;

  urlStore.set(code, {
    original: url,
    createdAt: Date.now(),
    clicks: 0,
  });

  return {
    shortCode: code,
    shortUrl,
    original: url,
    createdAt: Date.now(),
    clicks: 0,
  };
}

// Get URL by code
export function getUrl(code: string): string | null {
  const data = urlStore.get(code);
  if (data) {
    data.clicks++;
    return data.original;
  }
  return null;
}

// Get all shortened URLs for a user
export function getUserUrls(): ShortenedUrl[] {
  return Array.from(urlStore.entries()).map(([code, data]) => ({
    shortCode: code,
    shortUrl: `${BASE_URL}/${code}`,
    original: data.original,
    createdAt: data.createdAt,
    clicks: data.clicks,
  }));
}

// Delete URL
export function deleteUrl(code: string): boolean {
  return urlStore.delete(code);
}

// Get link preview (simple implementation)
export async function getLinkPreview(url: string): Promise<LinkPreview | null> {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TelegramBot/1.0)',
      },
    });

    const html = response.data;

    // Extract Open Graph tags
    const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const imageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);

    // Fallback to title tag
    const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);

    return {
      title: titleMatch?.[1] || titleTagMatch?.[1] || '',
      description: descMatch?.[1] || '',
      image: imageMatch?.[1] || '',
    };
  } catch {
    return null;
  }
}

// Validate URL
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
}
