import * as cheerio from 'cheerio';
import { ScrapedItem } from '@/types';

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AI-News-Agent/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

export async function scrapeAnthropicNews(): Promise<ScrapedItem[]> {
  const html = await fetchPage('https://www.anthropic.com/news');
  const $ = cheerio.load(html);
  const items: ScrapedItem[] = [];

  // Anthropic news page structure (adjust selectors as needed)
  $('article, [class*="post"], [class*="news-item"], a[href*="/news/"]').each((_, el) => {
    const $el = $(el);
    const link = $el.is('a') ? $el.attr('href') : $el.find('a').first().attr('href');
    const title = $el.find('h2, h3, [class*="title"]').first().text().trim() ||
                  $el.text().trim().slice(0, 100);

    if (link && title && title.length > 5) {
      const fullUrl = link.startsWith('http')
        ? link
        : `https://www.anthropic.com${link.startsWith('/') ? '' : '/'}${link}`;

      // Avoid duplicates in this batch
      if (!items.some(i => i.url === fullUrl)) {
        items.push({
          title,
          url: fullUrl,
          content: $el.find('p, [class*="excerpt"], [class*="description"]').first().text().trim(),
        });
      }
    }
  });

  return items.slice(0, 20); // Limit to most recent
}

export async function scrapeMetaAIBlog(): Promise<ScrapedItem[]> {
  const html = await fetchPage('https://ai.meta.com/blog/');
  const $ = cheerio.load(html);
  const items: ScrapedItem[] = [];

  // Meta AI blog structure (adjust selectors as needed)
  $('article, [class*="post"], [class*="blog-card"], a[href*="/blog/"]').each((_, el) => {
    const $el = $(el);
    const link = $el.is('a') ? $el.attr('href') : $el.find('a').first().attr('href');
    const title = $el.find('h2, h3, h4, [class*="title"]').first().text().trim() ||
                  $el.text().trim().slice(0, 100);

    if (link && title && title.length > 5) {
      const fullUrl = link.startsWith('http')
        ? link
        : `https://ai.meta.com${link.startsWith('/') ? '' : '/'}${link}`;

      if (!items.some(i => i.url === fullUrl) && fullUrl.includes('/blog/')) {
        items.push({
          title,
          url: fullUrl,
          content: $el.find('p, [class*="excerpt"], [class*="description"]').first().text().trim(),
        });
      }
    }
  });

  return items.slice(0, 20);
}

export async function scrapeSource(sourceUrl: string): Promise<ScrapedItem[]> {
  if (sourceUrl.includes('anthropic.com/news')) {
    return scrapeAnthropicNews();
  }
  if (sourceUrl.includes('ai.meta.com/blog')) {
    return scrapeMetaAIBlog();
  }

  // Generic fallback - try to find article links
  const html = await fetchPage(sourceUrl);
  const $ = cheerio.load(html);
  const items: ScrapedItem[] = [];
  const baseUrl = new URL(sourceUrl).origin;

  $('article a[href], [class*="post"] a[href], h2 a[href], h3 a[href]').each((_, el) => {
    const $el = $(el);
    const link = $el.attr('href');
    const title = $el.text().trim();

    if (link && title && title.length > 5 && title.length < 200) {
      const fullUrl = link.startsWith('http') ? link : `${baseUrl}${link}`;
      if (!items.some(i => i.url === fullUrl)) {
        items.push({ title, url: fullUrl });
      }
    }
  });

  return items.slice(0, 20);
}
