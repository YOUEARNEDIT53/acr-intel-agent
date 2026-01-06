import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchRSSFeed, normalizeUrl } from '@/lib/rss';
import { scrapeSource } from '@/lib/scraper';
import { Source } from '@/types';

export const maxDuration = 60; // Allow up to 60 seconds for ingestion

// Only ingest items from the last 2 days for fresh daily content
const MAX_AGE_DAYS = 2;

interface IngestResult {
  source: string;
  fetched: number;
  new: number;
  errors: string[];
}

async function ingestSource(source: Source): Promise<IngestResult> {
  const result: IngestResult = {
    source: source.name,
    fetched: 0,
    new: 0,
    errors: [],
  };

  try {
    let items: Array<{ title: string; url: string; content?: string; published_at?: string }> = [];

    if (source.type === 'rss') {
      const rssItems = await fetchRSSFeed(source.url);
      items = rssItems.map((item) => ({
        title: item.title,
        url: normalizeUrl(item.link),
        content: item.content || item.contentSnippet,
        published_at: item.isoDate || item.pubDate,
      }));
    } else if (source.type === 'scrape') {
      const scraped = await scrapeSource(source.url);
      items = scraped.map((item) => ({
        title: item.title,
        url: normalizeUrl(item.url),
        content: item.content,
        published_at: item.published_at,
      }));
    }

    // Filter to only recent items (last 7 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_AGE_DAYS);

    items = items.filter(item => {
      if (!item.published_at) return true; // Keep items without dates (we'll check them)
      const pubDate = new Date(item.published_at);
      return pubDate >= cutoffDate;
    });

    result.fetched = items.length;

    // Insert items, ignoring duplicates (ON CONFLICT DO NOTHING via upsert)
    for (const item of items) {
      if (!item.url || !item.title) continue;

      const { error } = await supabaseAdmin
        .from('items')
        .upsert(
          {
            source_id: source.id,
            url: item.url,
            title: item.title,
            content: item.content?.slice(0, 10000) || null, // Limit content size
            published_at: item.published_at || null,
          },
          {
            onConflict: 'url',
            ignoreDuplicates: true,
          }
        );

      if (error) {
        // Only log non-duplicate errors
        if (!error.message.includes('duplicate') && !error.code?.includes('23505')) {
          result.errors.push(`${item.title}: ${error.message}`);
        }
      } else {
        result.new++;
      }
    }

    // Update last_fetched timestamp
    await supabaseAdmin
      .from('sources')
      .update({ last_fetched: new Date().toISOString() })
      .eq('id', source.id);

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
}

export async function POST(request: NextRequest) {
  // Verify cron secret for automated calls (skip for form submissions from dashboard)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCronCall = authHeader?.startsWith('Bearer ');

  // Allow form submissions from dashboard without auth, but require auth for cron API calls
  if (isCronCall && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get source_id from body if provided (for single source ingestion)
  let sourceId: string | null = null;
  try {
    const body = await request.json();
    sourceId = body?.source_id || null;
  } catch {
    // No body provided, ingest all sources
  }

  // Fetch sources
  let query = supabaseAdmin
    .from('sources')
    .select('*')
    .eq('enabled', true);

  if (sourceId) {
    query = query.eq('id', sourceId);
  }

  const { data: sources, error: sourcesError } = await query;

  if (sourcesError) {
    return NextResponse.json(
      { error: 'Failed to fetch sources', details: sourcesError.message },
      { status: 500 }
    );
  }

  if (!sources || sources.length === 0) {
    return NextResponse.json({ message: 'No sources to ingest' });
  }

  // Ingest all sources in parallel (with some concurrency limit)
  const results: IngestResult[] = [];
  const batchSize = 4;

  for (let i = 0; i < sources.length; i += batchSize) {
    const batch = sources.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((source) => ingestSource(source as Source))
    );
    results.push(...batchResults);
  }

  const totalFetched = results.reduce((sum, r) => sum + r.fetched, 0);
  const totalNew = results.reduce((sum, r) => sum + r.new, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  return NextResponse.json({
    success: true,
    summary: {
      sources_processed: sources.length,
      items_fetched: totalFetched,
      items_new: totalNew,
      errors: totalErrors,
    },
    results,
  });
}

// Also support GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request);
}
