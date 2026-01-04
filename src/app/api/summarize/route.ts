import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { summarizeItem } from '@/lib/claude';

export const maxDuration = 300; // Allow up to 5 minutes for summarization

interface SummarizeResult {
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  // Verify cron secret for automated calls (skip for form submissions from dashboard)
  const authHeader = request.headers.get('authorization');
  const contentType = request.headers.get('content-type') || '';
  const cronSecret = process.env.CRON_SECRET;
  const isCronCall = authHeader?.startsWith('Bearer ');

  // Allow form submissions from dashboard without auth, but require auth for API calls
  if (isCronCall && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get optional limit from body
  let limit = 50;
  try {
    const body = await request.json();
    limit = body?.limit || 50;
  } catch {
    // Use default limit
  }

  // Fetch existing summaries to filter them out
  const { data: existingSummaries } = await supabaseAdmin
    .from('summaries')
    .select('item_id');

  const summarizedIds = new Set(existingSummaries?.map(s => s.item_id) || []);

  const { data: allItems, error: allItemsError } = await supabaseAdmin
    .from('items')
    .select(`
      id,
      title,
      content,
      url,
      source:sources(name, category)
    `)
    .order('fetched_at', { ascending: false })
    .limit(limit * 2); // Fetch extra in case many are already summarized

  if (allItemsError) {
    return NextResponse.json(
      { error: 'Failed to fetch items', details: allItemsError.message },
      { status: 500 }
    );
  }

  // Filter to items without summaries
  const itemsToSummarize = (allItems || [])
    .filter(item => !summarizedIds.has(item.id))
    .slice(0, limit);

  if (itemsToSummarize.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No items to summarize',
      result: { processed: 0, successful: 0, failed: 0, errors: [] },
    });
  }

  const result: SummarizeResult = {
    processed: itemsToSummarize.length,
    successful: 0,
    failed: 0,
    errors: [],
  };

  // Process items in batches to respect rate limits
  const batchSize = 5;

  for (let i = 0; i < itemsToSummarize.length; i += batchSize) {
    const batch = itemsToSummarize.slice(i, i + batchSize);

    const batchPromises = batch.map(async (item) => {
      try {
        const source = item.source as unknown as { name: string; category: string } | null;
        const sourceCategory = source?.category || 'research';

        const summary = await summarizeItem(
          item.title,
          item.content || '',
          sourceCategory
        );

        // Insert summary (priority_keywords and major_model added later if schema supports)
        const insertData: Record<string, unknown> = {
          item_id: item.id,
          summary: summary.summary,
          why_it_matters: summary.why_it_matters,
          category: summary.category,
          topics: summary.topics,
          relevance_score: summary.relevance_score,
          must_read: summary.must_read,
          hype_flag: summary.hype_flag,
        };

        const { error: insertError } = await supabaseAdmin
          .from('summaries')
          .insert(insertData);

        if (insertError) {
          throw new Error(insertError.message);
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: `${item.title}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const r of batchResults) {
      if (r.success) {
        result.successful++;
      } else {
        result.failed++;
        if (r.error) {
          result.errors.push(r.error);
        }
      }
    }

    // Rate limiting delay between batches
    if (i + batchSize < itemsToSummarize.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return NextResponse.json({
    success: true,
    result,
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
