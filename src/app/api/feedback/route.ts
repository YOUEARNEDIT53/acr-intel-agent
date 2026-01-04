import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, item_url, vote } = body;

    if (![-1, 1].includes(vote)) {
      return NextResponse.json(
        { error: 'Invalid vote. Must be -1 or 1' },
        { status: 400 }
      );
    }

    let resolvedItemId = item_id;

    // If item_url provided, look up the item_id
    if (!resolvedItemId && item_url) {
      const { data: item } = await supabaseAdmin
        .from('items')
        .select('id')
        .eq('url', item_url)
        .single();

      if (item) {
        resolvedItemId = item.id;
      }
    }

    if (!resolvedItemId) {
      return NextResponse.json(
        { error: 'Could not find item' },
        { status: 404 }
      );
    }

    // Upsert feedback (update if exists, insert if not)
    const { error } = await supabaseAdmin
      .from('feedback')
      .upsert(
        { item_id: resolvedItemId, vote },
        { onConflict: 'item_id' }
      );

    if (error) {
      return NextResponse.json(
        { error: 'Failed to save feedback', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, item_id: resolvedItemId, vote });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
}

export async function GET() {
  // Get feedback stats
  const { data: stats, error } = await supabaseAdmin
    .from('feedback')
    .select('vote');

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch feedback stats' },
      { status: 500 }
    );
  }

  const upvotes = stats?.filter(f => f.vote === 1).length || 0;
  const downvotes = stats?.filter(f => f.vote === -1).length || 0;

  return NextResponse.json({
    total: stats?.length || 0,
    upvotes,
    downvotes,
  });
}
