import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300; // 5 minutes for the full pipeline

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const results: Record<string, unknown> = {};

  // Step 1: Ingest new items from RSS feeds
  try {
    const ingestRes = await fetch(`${baseUrl}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    results.ingest = await ingestRes.json();
  } catch (error) {
    results.ingest = { error: error instanceof Error ? error.message : 'Unknown error' };
  }

  // Step 2: Summarize new items
  try {
    const summarizeRes = await fetch(`${baseUrl}/api/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    results.summarize = await summarizeRes.json();
  } catch (error) {
    results.summarize = { error: error instanceof Error ? error.message : 'Unknown error' };
  }

  // Step 3: Generate and send digest
  try {
    const digestRes = await fetch(`${baseUrl}/api/digest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    results.digest = await digestRes.json();
  } catch (error) {
    results.digest = { error: error instanceof Error ? error.message : 'Unknown error' };
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
}
