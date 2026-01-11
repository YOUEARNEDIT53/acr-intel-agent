#!/usr/bin/env python3
"""
ACR Intel Agent - Digest Generator
Generates daily digest from recent summaries and sends email.
"""

import os
import sys
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
PROJECT_DIR = Path(__file__).parent.parent
load_dotenv(PROJECT_DIR / '.env.local')

import requests
from supabase import create_client

# Configuration
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
RESEND_API_KEY = os.getenv('RESEND_API_KEY')
DIGEST_EMAIL_TO_ENV = os.getenv('DIGEST_EMAIL_TO', 'youearnedit@gmail.com')
DIGEST_EMAIL_FROM = os.getenv('DIGEST_EMAIL_FROM', 'ACR Intel Agent <acr-intel@mail.ipguy.co>')


def get_digest_recipients():
    """Get recipients from database with env var fallback"""
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        result = supabase.table('settings') \
            .select('value') \
            .eq('key', 'digest_recipients') \
            .single() \
            .execute()

        if result.data and result.data.get('value'):
            return [e.strip() for e in result.data['value'].split(',') if e.strip()]
    except Exception as e:
        print(f"   Note: Could not read from settings table ({e}), using env var")

    # Fallback to environment variable
    return [e.strip() for e in DIGEST_EMAIL_TO_ENV.split(',') if e.strip()]

def get_recent_summaries(supabase, hours=24):
    """Get summaries from the last N hours, filtered by item publication date"""
    summary_cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    pub_cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    result = supabase.table('summaries').select(
        'summary,why_it_matters,category,topics,relevance_score,must_read,created_at,'
        'item:items(id,title,url,published_at)'
    ).gte('created_at', summary_cutoff).order('relevance_score', desc=True).execute()

    # Filter out items with old publication dates
    filtered = []
    for s in result.data:
        item = s.get('item')
        if item:
            pub_date = item.get('published_at')
            if pub_date and pub_date < pub_cutoff:
                continue
        filtered.append(s)

    return filtered

def build_digest(summaries):
    """Build digest content from summaries"""
    items = []
    for s in summaries:
        item = s.get('item')
        if not item:
            continue
        if isinstance(item, list):
            item = item[0] if item else None
        if not item:
            continue

        items.append({
            'title': item.get('title', 'Untitled'),
            'url': item.get('url', ''),
            'summary': s.get('summary', ''),
            'why_it_matters': s.get('why_it_matters', ''),
            'category': s.get('category', 'sar'),
            'relevance_score': s.get('relevance_score', 0),
            'must_read': s.get('must_read', False),
        })

    items.sort(key=lambda x: x['relevance_score'], reverse=True)

    scores = [i['relevance_score'] for i in items]
    max_score = max(scores) if scores else 0
    high_threshold = max(max_score * 0.7, 60)
    mid_threshold = max(max_score * 0.4, 30)

    must_know = [i for i in items if i['must_read'] or i['relevance_score'] >= high_threshold][:3]
    worth_a_look = [i for i in items if not i['must_read'] and mid_threshold <= i['relevance_score'] < high_threshold][:7]
    quick_hits = [i for i in items if 0 < i['relevance_score'] < mid_threshold][:10]

    if not must_know and worth_a_look:
        must_know = worth_a_look[:2]
        worth_a_look = worth_a_look[2:]

    return {
        'must_know': must_know,
        'worth_a_look': worth_a_look,
        'quick_hits': quick_hits,
    }

def format_email_html(date, content):
    """Format digest as HTML email"""
    html = f"""
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1a1a1a; border-bottom: 2px solid #0066cc; padding-bottom: 10px;">
            ACR Industry Intelligence - {date}
        </h1>
    """

    if content['must_know']:
        html += '<h2 style="color: #cc0000;">&#x1F6A8; Critical Updates</h2>'
        for item in content['must_know']:
            cat_badge = f'<span style="background: #eee; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 8px;">{item["category"].upper()}</span>'
            html += f"""
            <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-left: 4px solid #cc0000;">
                <h3 style="margin: 0 0 10px 0;"><a href="{item['url']}" style="color: #1a1a1a; text-decoration: none;">{item['title']}</a>{cat_badge}</h3>
                <p style="margin: 0 0 10px 0; color: #333;">{item['summary']}</p>
                <p style="margin: 0; color: #666; font-style: italic;">ACR Impact: {item['why_it_matters']}</p>
            </div>
            """

    if content['worth_a_look']:
        html += '<h2 style="color: #0066cc;">&#x1F4CB; Industry Watch</h2>'
        for item in content['worth_a_look']:
            html += f"""
            <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa;">
                <h4 style="margin: 0 0 5px 0;"><a href="{item['url']}" style="color: #1a1a1a;">{item['title']}</a></h4>
                <p style="margin: 0; color: #666; font-size: 14px;">{item['summary']}</p>
            </div>
            """

    if content['quick_hits']:
        html += '<h2 style="color: #666;">&#x26A1; Quick Hits</h2><ul>'
        for item in content['quick_hits']:
            html += f'<li><a href="{item["url"]}">{item["title"]}</a></li>'
        html += '</ul>'

    html += """
        <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">Generated by ACR Intel Agent</p>
    </body>
    </html>
    """
    return html

def send_email(date, content):
    """Send digest email via Resend"""
    recipients = get_digest_recipients()

    response = requests.post(
        'https://api.resend.com/emails',
        headers={
            'Authorization': f'Bearer {RESEND_API_KEY}',
            'Content-Type': 'application/json'
        },
        json={
            'from': DIGEST_EMAIL_FROM,
            'to': recipients,
            'subject': f'ACR Industry Intelligence - {date}',
            'html': format_email_html(date, content),
        }
    )

    return response.status_code == 200, response.text

def main():
    print("=" * 50)
    print("ACR Intel Agent - Digest Generator")
    print("=" * 50)

    if not all([SUPABASE_URL, SUPABASE_KEY, RESEND_API_KEY]):
        print("ERROR: Missing required credentials")
        sys.exit(1)

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    print("\n1. Fetching recent summaries...")
    summaries = get_recent_summaries(supabase, hours=24)
    print(f"   Found {len(summaries)} summaries from last 24 hours")

    if not summaries:
        print("   No summaries found! Running summarization might be needed.")
        sys.exit(1)

    print("\n2. Building digest...")
    content = build_digest(summaries)
    total = len(content['must_know']) + len(content['worth_a_look']) + len(content['quick_hits'])
    print(f"   Critical Updates: {len(content['must_know'])}")
    print(f"   Industry Watch: {len(content['worth_a_look'])}")
    print(f"   Quick Hits: {len(content['quick_hits'])}")
    print(f"   Total: {total}")

    print("\n   CRITICAL UPDATES:")
    for item in content['must_know']:
        print(f"   - [{item['category']}] {item['title'][:55]}")

    if total == 0:
        print("\n   No items for digest!")
        sys.exit(1)

    print("\n3. Saving digest to database...")
    supabase.table('digests').delete().eq('date', today).execute()

    result = supabase.table('digests').insert({
        'date': today,
        'content': content,
        'email_sent': False,
    }).execute()
    print(f"   Saved digest ID: {result.data[0]['id']}")

    print("\n4. Sending email...")
    success, response = send_email(today, content)
    if success:
        recipients = get_digest_recipients()
        print(f"   Email sent to {len(recipients)} recipients")
        supabase.table('digests').update({'email_sent': True}).eq('date', today).execute()
    else:
        print(f"   Email failed: {response}")
        sys.exit(1)

    print("\n" + "=" * 50)
    print("Digest generation complete!")
    print("=" * 50)

if __name__ == '__main__':
    main()
