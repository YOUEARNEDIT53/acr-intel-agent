#!/usr/bin/env python3
"""
ACR Intel Agent - Industry Intelligence Podcast Generator
Generates a two-host podcast (Marcus & Priya) covering SAR/ELT/EPIRB/PLB industry intelligence
"""

import os
import sys
import json
import shutil
from datetime import datetime
from pathlib import Path

# Add local ffmpeg to PATH
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
BIN_DIR = PROJECT_DIR / 'bin'
os.environ['PATH'] = str(BIN_DIR) + ':' + os.environ.get('PATH', '')

# Load environment variables
from dotenv import load_dotenv
load_dotenv(PROJECT_DIR / '.env.local')

from podcastfy.client import generate_podcast
import requests
from supabase import create_client

# Configuration
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
RESEND_API_KEY = os.getenv('RESEND_API_KEY')
DIGEST_EMAIL_TO = os.getenv('DIGEST_EMAIL_TO', 'youearnedit@gmail.com')
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')

# Output directory for podcasts
OUTPUT_DIR = Path(__file__).parent.parent / 'podcasts'
OUTPUT_DIR.mkdir(exist_ok=True)


def get_latest_digest():
    """Fetch the latest digest from Supabase"""
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    result = supabase.table('digests') \
        .select('*') \
        .order('date', desc=True) \
        .limit(1) \
        .execute()

    if result.data:
        return result.data[0]
    return None


def format_digest_for_podcast(digest):
    """Convert digest JSON to a text format suitable for podcast generation"""
    content = digest['content']
    date = digest['date']

    text = f"""# ACR Industry Intelligence Briefing for {date}

Welcome to your daily industry intelligence briefing covering Search & Rescue, aviation safety, maritime regulations, and the broader aerospace/marine equipment market.

## CRITICAL UPDATES - Must Know

"""

    for item in content.get('must_know', []):
        text += f"""### {item['title']}
{item['summary']}

Why this matters for ACR: {item['why_it_matters']}

"""

    text += "\n## INDUSTRY DEVELOPMENTS - Worth Tracking\n\n"

    for item in content.get('worth_a_look', []):
        text += f"""### {item['title']}
{item['summary']}

Relevance: {item['why_it_matters']}

"""

    text += "\n## QUICK INTEL - Brief Updates\n\n"

    for item in content.get('quick_hits', []):
        text += f"- **{item['title']}**: {item['summary']}\n"

    text += """

## Wrap Up

That's your ACR industry intelligence briefing for today. Stay ahead of regulatory changes, track competitor moves, and keep building the best safety equipment in the industry.
"""

    return text


def generate_podcast_audio(text_content, output_path):
    """Generate podcast audio using Podcastfy with Edge TTS (free)"""

    # Marcus & Priya conversation config - industry intelligence style
    # Target: ~15 minutes max (~2000 words at 130 wpm)
    conversation_config = {
        "word_count": 2000,
        "conversation_style": ["informative", "analytical", "conversational", "witty", "skeptical"],
        "podcast_name": "ACR AI News",
        "podcast_tagline": "AI-powered industry intelligence for aerospace and marine safety",
        "creativity": 0.85,
        "roles_person1": "Marcus",
        "roles_person2": "Priya",
        "dialogue_structure": [
            "Quick intro with what's on the agenda today",
            "Critical Updates - regulatory and major industry news",
            "Deep Dive - the most important story with technical and business context",
            "Market Watch - competitor moves, customer trends",
            "Quick Hits - rapid-fire updates",
            "Sign off with key takeaways"
        ],
        "engagement_techniques": [
            "Marcus explains technical details with memorable analogies",
            "Priya translates implications for product and business teams",
            "They ask each other follow-up questions",
            "Reference what companies said vs what they're doing now",
            "Occasional dry humor and friendly disagreements",
            "Call out hype vs substance",
            "Connect stories to broader industry trends"
        ],
        "user_instructions": """
The hosts are Marcus and Priya:

MARCUS (Host 1 - Technical perspective):
- Former engineer who explains things through weird but memorable analogies
- Gets excited about elegant technical solutions
- Self-aware about going too deep - catches himself mid-tangent
- Dry, deadpan humor delivered straight-faced
- Verbal tics: "So here's the thing...", "Wait, it gets better...", "Okay but actually..."
- Pet peeves: sloppy comparisons, marketing buzzwords, buried limitations

PRIYA (Host 2 - Business/applications perspective):
- Product management background - understands tech AND business
- Translates technical stuff into "what this means for people building products"
- Warmly sarcastic, teases Marcus when he goes too deep
- Asks the "dumb questions" that aren't actually dumb
- Keeps receipts on what companies promised vs delivered
- Verbal tics: "Okay but here's my question...", "Let's be real for a second...", "I'm going to be that person and ask..."
- Calls out vaporware and hype

DYNAMIC:
- Genuine rapport - they interrupt each other, finish thoughts, have friendly arguments
- Marcus goes deep on "how", Priya pulls back to "so what"
- They fact-check each other in real time
- Inside jokes about perpetually skeptical companies
- 70% informative, 20% funny, 10% spicy takes
- Never punching down - humor about industry hype, not individuals
""",
        "output_language": "English"
    }

    try:
        # Generate podcast using Edge TTS (free) and Claude for conversation
        audio_file = generate_podcast(
            text=text_content,
            tts_model="edge",  # Free Microsoft Edge TTS
            llm_model_name="anthropic/claude-sonnet-4-20250514",  # Use Claude
            api_key_label="ANTHROPIC_API_KEY",
            conversation_config=conversation_config
        )

        # Move the generated file to our desired output path
        if audio_file and Path(audio_file).exists():
            shutil.move(audio_file, output_path)
            return str(output_path)
        return audio_file

    except Exception as e:
        print(f"Error with custom config: {e}")
        import traceback
        traceback.print_exc()
        # Try simpler approach without conversation_config
        audio_file = generate_podcast(
            text=text_content,
            tts_model="edge",
            llm_model_name="anthropic/claude-sonnet-4-20250514",
            api_key_label="ANTHROPIC_API_KEY"
        )
        if audio_file and Path(audio_file).exists():
            shutil.move(audio_file, output_path)
            return str(output_path)
        return audio_file


def send_podcast_email(audio_path, date):
    """Send the podcast as an email attachment using Resend"""

    # Read the audio file
    with open(audio_path, 'rb') as f:
        audio_data = f.read()

    import base64
    audio_base64 = base64.b64encode(audio_data).decode('utf-8')

    # Support comma-separated list of recipients
    recipients = [email.strip() for email in DIGEST_EMAIL_TO.split(',') if email.strip()]

    response = requests.post(
        'https://api.resend.com/emails',
        headers={
            'Authorization': f'Bearer {RESEND_API_KEY}',
            'Content-Type': 'application/json'
        },
        json={
            'from': 'ACR Intel Agent <onboarding@resend.dev>',
            'to': recipients,
            'subject': f'🎙️ ACR AI News - {date}',
            'html': f'''
                <h1>Your ACR AI News Podcast is Ready!</h1>
                <p>Marcus and Priya break down today's key developments in SAR, aviation, maritime, and the broader safety equipment industry.</p>
                <p>Date: {date}</p>
                <p>The audio file is attached to this email.</p>
                <hr>
                <p style="color: #666; font-size: 12px;">
                    Generated by ACR Intel Agent
                </p>
            ''',
            'attachments': [{
                'filename': f'acr-intel-{date}.mp3',
                'content': audio_base64
            }]
        }
    )

    if response.status_code == 200:
        print(f"Podcast email sent successfully to {DIGEST_EMAIL_TO}")
        return True
    else:
        print(f"Failed to send email: {response.text}")
        return False


def main():
    print("=" * 50)
    print("ACR Intel Agent - Podcast Generator")
    print("=" * 50)

    # Get latest digest
    print("\n1. Fetching latest digest...")
    digest = get_latest_digest()

    if not digest:
        print("No digest found!")
        sys.exit(1)

    date = digest['date']
    print(f"   Found digest for {date}")

    # Format for podcast
    print("\n2. Formatting digest for podcast...")
    text_content = format_digest_for_podcast(digest)
    print(f"   Generated {len(text_content)} characters of content")

    # Generate podcast
    output_path = OUTPUT_DIR / f'acr-intel-{date}.mp3'
    print(f"\n3. Generating podcast audio...")
    print("   Using Edge TTS (free)")

    try:
        audio_file = generate_podcast_audio(text_content, output_path)
        print(f"   Podcast saved to: {audio_file}")
    except Exception as e:
        print(f"   Error: {e}")
        sys.exit(1)

    # Send email
    print("\n4. Sending podcast via email...")
    if send_podcast_email(output_path, date):
        print("   Success!")
    else:
        print("   Failed to send email")
        sys.exit(1)

    print("\n" + "=" * 50)
    print("Podcast generation complete!")
    print("=" * 50)


if __name__ == '__main__':
    main()
