import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { Setting } from '@/types';

// GET - Fetch settings (optionally filter by key)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  try {
    let query = supabaseAdmin.from('settings').select('*');

    if (key) {
      query = query.eq('key', key);
      const { data, error } = await query.single();

      if (error) {
        // Setting not found - return env var fallback for known keys
        if (key === 'digest_recipients') {
          return NextResponse.json({
            key: 'digest_recipients',
            value: process.env.DIGEST_EMAIL_TO || '',
            description: 'Comma-separated list of email recipients',
            source: 'environment',
          });
        }
        return NextResponse.json({ error: 'Setting not found' }, { status: 404 });
      }

      return NextResponse.json(data);
    }

    const { data, error } = await query.order('key');

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch settings', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    // Table might not exist yet - return env var fallbacks
    return NextResponse.json([
      {
        key: 'digest_recipients',
        value: process.env.DIGEST_EMAIL_TO || '',
        description: 'Comma-separated list of email recipients',
        source: 'environment',
      },
    ]);
  }
}

// POST - Update a setting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || typeof value !== 'string') {
      return NextResponse.json(
        { error: 'Missing required fields: key and value' },
        { status: 400 }
      );
    }

    // Upsert the setting
    const { data, error } = await supabaseAdmin
      .from('settings')
      .upsert(
        {
          key,
          value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update setting', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      setting: data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
