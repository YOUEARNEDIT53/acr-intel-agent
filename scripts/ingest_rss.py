#!/usr/bin/env python3
"""
ACR Intel Agent - RSS Ingest Script
Fetches RSS feeds directly to Supabase, bypassing Vercel timeout limits.
"""

import os
import sys
import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
PROJECT_DIR = Path(__file__).parent.parent
load_dotenv(PROJECT_DIR / '.env.local')

import feedparser
from supabase import create_client

# Configuration
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

def parse_date(entry):
    """Parse date from feed entry"""
    for attr in ['published_parsed', 'updated_parsed', 'created_parsed']:
        parsed = getattr(entry, attr, None)
        if parsed:
            try:
                return datetime(*parsed[:6], tzinfo=timezone.utc).isoformat()
            except:
                pass
    return datetime.now(timezone.utc).isoformat()

def get_content(entry):
    """Extract content from entry"""
    if hasattr(entry, 'content') and entry.content:
        return entry.content[0].get('value', '')[:10000]
    if hasattr(entry, 'summary'):
        return entry.summary[:10000]
    if hasattr(entry, 'description'):
        return entry.description[:10000]
    return ''

def main():
    print("=" * 50)
    print("ACR Intel Agent - RSS Ingest")
    print("=" * 50)

    if not all([SUPABASE_URL, SUPABASE_KEY]):
        print("ERROR: Missing Supabase credentials")
        sys.exit(1)

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    # Get enabled sources
    print("\n1. Fetching enabled sources...")
    sources = supabase.table('sources').select('*').eq('enabled', True).execute()
    print(f"   Found {len(sources.data)} enabled sources")

    # Get existing URLs
    print("\n2. Checking existing items...")
    existing = supabase.table('items').select('url').execute()
    existing_urls = set(item['url'] for item in existing.data)
    print(f"   Found {len(existing_urls)} existing items")

    # Process feeds
    print("\n3. Processing RSS feeds...")
    total_new = 0
    total_skipped = 0

    for source in sources.data:
        try:
            feed = feedparser.parse(source['url'])
            new_count = 0

            for entry in feed.entries[:20]:
                url = entry.get('link', '')
                if not url or url in existing_urls:
                    continue

                pub_date = parse_date(entry)
                try:
                    pub_dt = datetime.fromisoformat(pub_date.replace('Z', '+00:00'))
                    if pub_dt < cutoff:
                        total_skipped += 1
                        continue
                except:
                    pass

                item = {
                    'source_id': source['id'],
                    'title': entry.get('title', 'Untitled')[:500],
                    'url': url,
                    'content': get_content(entry),
                    'published_at': pub_date,
                    'fetched_at': datetime.now(timezone.utc).isoformat(),
                }

                supabase.table('items').insert(item).execute()
                existing_urls.add(url)
                new_count += 1

            if new_count > 0:
                print(f"   [{source['category']}] {source['name']}: +{new_count} items")
            total_new += new_count

        except Exception as e:
            print(f"   ERROR [{source['name']}]: {str(e)[:50]}")

    print(f"\n" + "=" * 50)
    print(f"SUMMARY: {total_new} new items, {total_skipped} skipped (old)")
    print("=" * 50)

if __name__ == '__main__':
    main()
