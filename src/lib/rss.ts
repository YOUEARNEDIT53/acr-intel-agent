import Parser from 'rss-parser';
import { RSSItem } from '@/types';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'AI-News-Agent/1.0',
  },
});

export async function fetchRSSFeed(url: string): Promise<RSSItem[]> {
  try {
    const feed = await parser.parseURL(url);

    return feed.items.map((item) => ({
      title: item.title || 'Untitled',
      link: item.link || '',
      content: item.content || item.contentSnippet || item.summary || '',
      contentSnippet: item.contentSnippet || '',
      pubDate: item.pubDate,
      isoDate: item.isoDate,
    }));
  } catch (error) {
    console.error(`Error fetching RSS feed ${url}:`, error);
    throw error;
  }
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove trailing slashes, normalize protocol
    let normalized = parsed.href.replace(/\/+$/, '');
    // Remove common tracking params
    const cleanUrl = new URL(normalized);
    cleanUrl.searchParams.delete('utm_source');
    cleanUrl.searchParams.delete('utm_medium');
    cleanUrl.searchParams.delete('utm_campaign');
    cleanUrl.searchParams.delete('ref');
    return cleanUrl.href;
  } catch {
    return url;
  }
}

export function hashUrl(url: string): string {
  const normalized = normalizeUrl(url);
  // Simple hash for deduplication
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}
