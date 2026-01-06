import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendDigestEmail } from '@/lib/resend';
import { DigestContent, DigestItem } from '@/types';

export const maxDuration = 60;

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
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

  // Get optional date from body (defaults to today)
  let targetDate = formatDate(new Date());
  let sendEmail = true;
  try {
    const body = await request.json();
    if (body?.date) {
      targetDate = body.date;
    }
    if (body?.send_email === false) {
      sendEmail = false;
    }
  } catch {
    // Use defaults
  }

  // Check if digest already exists for this date
  const { data: existingDigest } = await supabaseAdmin
    .from('digests')
    .select('*')
    .eq('date', targetDate)
    .single();

  if (existingDigest) {
    // If digest exists but email wasn't sent, try to send
    if (sendEmail && !existingDigest.email_sent) {
      const emailResult = await sendDigestEmail(
        targetDate,
        existingDigest.content as unknown as DigestContent
      );

      if (emailResult.success) {
        await supabaseAdmin
          .from('digests')
          .update({ email_sent: true })
          .eq('id', existingDigest.id);
      }

      return NextResponse.json({
        success: true,
        message: 'Digest already exists, sent email',
        digest_id: existingDigest.id,
        email_sent: emailResult.success,
        email_error: emailResult.error,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Digest already exists',
      digest_id: existingDigest.id,
    });
  }

  // Calculate the date range for items (last 24 hours)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString();

  // Fetch summaries with their items from the last 24 hours
  // Filter by summary created_at to only get recently summarized items
  const { data: summaries, error: summariesError } = await supabaseAdmin
    .from('summaries')
    .select(`
      summary,
      why_it_matters,
      category,
      topics,
      relevance_score,
      must_read,
      created_at,
      item:items(
        id,
        title,
        url,
        content,
        fetched_at
      )
    `)
    .gte('created_at', yesterdayISO)
    .order('relevance_score', { ascending: false });

  const itemsError = summariesError;

  // Debug: log what we got
  console.log('Summaries count:', summaries?.length);
  console.log('First summary:', summaries?.[0]);

  // Transform summaries to match expected format
  const items = (summaries || [])
    .filter(s => s.item != null)
    .map(s => {
      // Handle both array and object responses from Supabase
      const item = Array.isArray(s.item)
        ? (s.item as unknown as Array<{id: string; title: string; url: string; content: string; fetched_at: string}>)[0]
        : (s.item as unknown as {id: string; title: string; url: string; content: string; fetched_at: string});
      return {
        ...item,
        summary: [{
          summary: s.summary,
          why_it_matters: s.why_it_matters,
          category: s.category,
          topics: s.topics,
          relevance_score: s.relevance_score,
          must_read: s.must_read,
        }]
      };
    });

  if (itemsError) {
    return NextResponse.json(
      { error: 'Failed to fetch items', details: itemsError.message },
      { status: 500 }
    );
  }

  // Filter to items with summaries and transform
  const itemsWithSummaries = (items || [])
    .filter((item) => item.summary && Array.isArray(item.summary) && item.summary.length > 0)
    .map((item) => {
      const summary = (item.summary as unknown as Array<{
        summary: string;
        why_it_matters: string;
        category: string;
        topics: string[];
        relevance_score: number;
        must_read: boolean;
      }>)[0];

      return {
        title: item.title,
        url: item.url,
        summary: summary.summary,
        why_it_matters: summary.why_it_matters,
        category: summary.category,
        topics: summary.topics || [],
        relevance_score: summary.relevance_score,
        must_read: summary.must_read,
      } as DigestItem;
    });

  // Sort by relevance score
  itemsWithSummaries.sort((a, b) => b.relevance_score - a.relevance_score);

  // Helper to check if item is explicitly marked as not relevant
  const isExplicitlyNotRelevant = (item: DigestItem) => {
    const whyMatters = item.why_it_matters.toLowerCase();
    return whyMatters.includes('not directly relevant') ||
           whyMatters.includes('not relevant to acr') ||
           whyMatters.includes('no direct relevance') ||
           whyMatters.includes('relevance unclear');
  };

  // RELEVANCE FILTERING - Include items relevant to ACR's business
  // ACR makes ELTs, EPIRBs, PLBs - emergency beacons for aviation/maritime safety
  // Thresholds:
  // - Must Know: 70+ (direct impact on ACR business)
  // - Worth a Look: 50-69 (industry relevant)
  // - Quick Hits: 35-49 (tangentially relevant - aviation/maritime news)
  // Items explicitly marked "not relevant" are always excluded

  const MUST_KNOW_THRESHOLD = 70;
  const WORTH_A_LOOK_THRESHOLD = 50;
  const QUICK_HITS_THRESHOLD = 35;

  const content: DigestContent = {
    must_know: itemsWithSummaries
      .filter((item) => !isExplicitlyNotRelevant(item) && (item.must_read || item.relevance_score >= MUST_KNOW_THRESHOLD))
      .slice(0, 5),
    worth_a_look: itemsWithSummaries
      .filter((item) => !isExplicitlyNotRelevant(item) && !item.must_read && item.relevance_score >= WORTH_A_LOOK_THRESHOLD && item.relevance_score < MUST_KNOW_THRESHOLD)
      .slice(0, 10),
    quick_hits: itemsWithSummaries
      .filter((item) => !isExplicitlyNotRelevant(item) && item.relevance_score >= QUICK_HITS_THRESHOLD && item.relevance_score < WORTH_A_LOOK_THRESHOLD)
      .slice(0, 10),
  };

  // Only promote if we have high-scoring items (don't pad with low-relevance content)
  if (content.must_know.length === 0 && content.worth_a_look.length > 0) {
    // Only promote items scoring 70+
    const promotable = content.worth_a_look.filter(i => i.relevance_score >= 70);
    if (promotable.length > 0) {
      content.must_know = promotable.splice(0, 2);
      content.worth_a_look = content.worth_a_look.filter(i => i.relevance_score < 70 || content.must_know.includes(i));
    }
  }

  const totalItems =
    content.must_know.length +
    content.worth_a_look.length +
    content.quick_hits.length;

  if (totalItems === 0) {
    return NextResponse.json({
      success: true,
      message: 'No items for digest',
      items_processed: itemsWithSummaries.length,
      debug: {
        total_items_fetched: items?.length || 0,
        items_with_summaries: itemsWithSummaries.length,
        sample_scores: itemsWithSummaries.slice(0, 5).map(i => i.relevance_score),
        thresholds: { MUST_KNOW_THRESHOLD, WORTH_A_LOOK_THRESHOLD, QUICK_HITS_THRESHOLD },
      }
    });
  }

  // Save digest
  const { data: digest, error: digestError } = await supabaseAdmin
    .from('digests')
    .insert({
      date: targetDate,
      content: content as unknown as Record<string, unknown>,
      email_sent: false,
    })
    .select()
    .single();

  if (digestError) {
    return NextResponse.json(
      { error: 'Failed to save digest', details: digestError.message },
      { status: 500 }
    );
  }

  // Send email if requested
  let emailSent = false;
  let emailError: string | undefined;

  if (sendEmail) {
    const emailResult = await sendDigestEmail(targetDate, content);
    emailSent = emailResult.success;
    emailError = emailResult.error;

    if (emailSent) {
      await supabaseAdmin
        .from('digests')
        .update({ email_sent: true })
        .eq('id', digest.id);
    }
  }

  return NextResponse.json({
    success: true,
    digest_id: digest.id,
    date: targetDate,
    items: {
      must_know: content.must_know.length,
      worth_a_look: content.worth_a_look.length,
      quick_hits: content.quick_hits.length,
      total: totalItems,
    },
    email_sent: emailSent,
    email_error: emailError,
  });
}

// GET returns the latest digest or digest for a specific date
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  let query = supabaseAdmin
    .from('digests')
    .select('*')
    .order('date', { ascending: false });

  if (date) {
    query = query.eq('date', date);
  }

  const { data: digest, error } = await query.limit(1).single();

  if (error || !digest) {
    return NextResponse.json(
      { error: 'Digest not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(digest);
}
