#!/usr/bin/env python3
"""
ACR Intel Agent - Industry Intelligence Podcast Generator
Generates a two-host podcast (Gary McGee & Margaret Ann Jenkins) covering SAR/ELT/EPIRB/PLB industry intelligence
~5 minute broadcast format
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
DIGEST_EMAIL_TO_ENV = os.getenv('DIGEST_EMAIL_TO', 'youearnedit@gmail.com')
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')


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

    text = f"""# The ACR Report — {date}

Welcome to The ACR Report, your daily industry intelligence briefing covering BOTH aerospace/aviation (ELTs, avionics, FAA, EASA, general aviation safety) AND maritime (EPIRBs, PLBs, USCG, IMO, SOLAS) beacon technology markets equally.

IMPORTANT: Coverage must be balanced between aerospace/aviation AND maritime topics. ACR operates in BOTH markets — ELTs for aviation and EPIRBs/PLBs for maritime. Do NOT lean heavily toward one sector. If the news skews one way, provide context and analysis for the underrepresented sector.

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

That's The ACR Report for today. Stay ahead of regulatory changes, track competitor moves, and keep building the best safety equipment in the industry.
"""

    return text


def generate_podcast_audio(text_content, output_path):
    """Generate podcast audio using Podcastfy with Edge TTS (free)"""

    # Gary & Margaret conversation config - industry intelligence style
    # Target ~5 min, HARD cap 6 min. word_count tuned DOWN for claude-sonnet-4-6 verbosity:
    # old model ran 5:39 at 650 words; claude-sonnet-4-6 ran 9:12 at the same setting.
    # Belt-and-suspenders: enforce_max_duration() trims anything over 6 min after generation.
    conversation_config = {
        "word_count": 300,
        "conversation_style": ["informative", "analytical", "conversational", "witty", "skeptical"],
        "podcast_name": "The ACR Report Podcast",
        "podcast_tagline": "The News in the World of Beacon Tech in five minutes",
        "creativity": 0.5,
        "roles_person1": "Margaret Ann Jenkins",
        "roles_person2": "Gary McGee",
        "dialogue_structure": [
            "Quick intro - 'The News in the World of Beacon Tech in five minutes'",
            "Top 1-2 stories only - the news plus a SHORT implication",
            "Sign off with one key takeaway"
        ],
        "engagement_techniques": [
            "Gary explains the technical bit briefly; Margaret gives the business 'so what'",
            "One short aerospace/ELT <-> maritime/EPIRB bridge",
            "Occasional dry humor - but keep it moving"
        ],
        "user_instructions": """
The hosts are Gary McGee and Margaret Ann Jenkins:

GARY McGEE (Host 1 - Technical perspective):
- Former engineer who explains things through weird but memorable analogies
- Gets excited about elegant technical solutions
- Self-aware about going too deep - catches himself mid-tangent
- Dry, deadpan humor delivered straight-faced
- Verbal tics: "So here's the thing...", "Wait, it gets better...", "Okay but actually..."
- Pet peeves: sloppy comparisons, marketing buzzwords, buried limitations

MARGARET ANN JENKINS (Host 2 - Business/applications perspective):
- Product management background - understands tech AND business
- Translates technical stuff into "what this means for people building products"
- Warmly sarcastic, teases Gary when he goes too deep
- Asks the "dumb questions" that aren't actually dumb
- Keeps receipts on what companies promised vs delivered
- Verbal tics: "Okay but here's my question...", "Let's be real for a second...", "I'm going to be that person and ask..."
- Calls out vaporware and hype

IMPORTANT FORMAT:
- HARD LIMIT: the ENTIRE episode MUST run UNDER 6 MINUTES — aim for about 5. This is the #1 rule.
- Keep the TOTAL spoken script to ~700 words MAX across BOTH hosts combined. Be ruthless; cut, don't pad.
- This is a FIVE MINUTE broadcast - keep it tight and punchy
- Open with: "The News in the World of Beacon Tech in five minutes"
- Cover only the top stories, skip filler
- Wrap up quickly with one key takeaway

CRITICAL - NO GPS OPENING:
- NEVER open the podcast with a GPS/GNSS/satellite constellation story
- GPS topics should be brief mentions at most, never the lead story
- If the top-ranked item is about GPS, skip to the next non-GPS story to open with
- Generic GPS/GNSS news is filler, not headline material

CRITICAL - BALANCED COVERAGE:
- ACR operates in BOTH aerospace/aviation (ELTs) AND maritime (EPIRBs, PLBs)
- ALWAYS cover BOTH sectors — do NOT lean heavily maritime or heavily aviation
- If the news is mostly maritime, add aerospace/ELT context, analysis, or implications
- If the news is mostly aviation, add maritime/EPIRB context, analysis, or implications
- Reference FAA, EASA, TSOs, avionics, general aviation safety alongside USCG, IMO, SOLAS
- Beacon tech spans BOTH worlds — Cospas-Sarsat serves aviation AND maritime

DYNAMIC:
- Genuine rapport - they interrupt each other, finish thoughts, have friendly arguments
- Gary goes deep on "how", Margaret pulls back to "so what"
- They fact-check each other in real time
- Inside jokes about perpetually skeptical companies
- 70% informative, 20% funny, 10% spicy takes
- Never punching down - humor about industry hype, not individuals

LENGTH IS THE TOP PRIORITY (overrides everything above):
- Write a TIGHT show: at most ~26 short dialogue turns total and ~700 spoken words combined across both hosts.
- It MUST feel like 5 minutes, not 10. Cover only the top 1-2 stories. Do not pad, recap, or repeat.
- Output ONLY the final spoken dialogue in the required tag format - NO analysis, NO outline, NO planning notes, NO "(scratchpad)".
""",
        "output_language": "English"
    }

    try:
        # Generate podcast using Edge TTS (free) and Claude for conversation
        audio_file = generate_podcast(
            text=text_content,
            tts_model="edge",  # Free Microsoft Edge TTS
            llm_model_name="anthropic/claude-sonnet-4-6",  # Use Claude
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
            llm_model_name="anthropic/claude-sonnet-4-6",
            api_key_label="ANTHROPIC_API_KEY"
        )
        if audio_file and Path(audio_file).exists():
            shutil.move(audio_file, output_path)
            return str(output_path)
        return audio_file


def enforce_max_duration(path, max_seconds=355, fade=3):
    """Hard guarantee the episode ends under 6 minutes. Trims with a fade-out if over."""
    import subprocess, re, shutil as _sh
    path = str(path)
    ff = _sh.which("ffmpeg") or "/usr/local/bin/ffmpeg"
    try:
        info = subprocess.run([ff, "-i", path], capture_output=True, text=True).stderr
    except Exception as e:
        print(f"   (length guard skipped: {e})")
        return
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", info)
    if not m:
        print("   (length guard: could not read duration)")
        return
    dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    print(f"   Episode length: {dur/60:.2f} min")
    if dur <= max_seconds:
        return
    print(f"   Over 6-min cap -> trimming to {max_seconds}s with {fade}s fade-out")
    tmp = path + ".trim.mp3"
    st = max(0, max_seconds - fade)
    r = subprocess.run(
        [ff, "-y", "-i", path, "-t", str(max_seconds),
         "-af", f"afade=t=out:st={st}:d={fade}",
         "-c:a", "libmp3lame", "-b:a", "32k", tmp],
        capture_output=True, text=True)
    if os.path.exists(tmp) and os.path.getsize(tmp) > 0:
        _sh.move(tmp, path)
        print(f"   Trimmed to under {max_seconds/60:.2f} min")
    else:
        print(f"   (trim failed, leaving original): {r.stderr[-300:]}")


def send_podcast_email(audio_path, date, test_recipient=None):
    """Send the podcast as an email attachment using Resend"""

    # Read the audio file
    with open(audio_path, 'rb') as f:
        audio_data = f.read()

    import base64
    audio_base64 = base64.b64encode(audio_data).decode('utf-8')

    # Use test recipient if provided, otherwise get from database
    if test_recipient:
        recipients = [test_recipient]
        print(f"   TEST MODE: Sending only to {test_recipient}")
    else:
        recipients = get_digest_recipients()

    response = requests.post(
        'https://api.resend.com/emails',
        headers={
            'Authorization': f'Bearer {RESEND_API_KEY}',
            'Content-Type': 'application/json'
        },
        json={
            'from': 'ACR Intel Agent <acr-intel@mail.ipguy.co>',
            'to': recipients,
            'subject': f'🎙️ The ACR Report Podcast — {date}',
            'html': f'''
                <h1>🎙️ The ACR Report Podcast</h1>
                <p>Gary McGee and Margaret Ann Jenkins bring you the news in the world of beacon tech in five minutes.</p>
                <p><strong>Date:</strong> {date}</p>
                <p>The audio file is attached to this email. Five minutes to stay ahead of regulatory changes, competitor moves, and industry trends.</p>
                <hr>
                <p style="color: #666; font-size: 12px;">
                    The ACR Report — Industry intelligence for aerospace & marine safety
                </p>
            ''',
            'attachments': [{
                'filename': f'acr-intel-{date}.mp3',
                'content': audio_base64
            }]
        }
    )

    if response.status_code == 200:
        print(f"Podcast email sent successfully to {len(recipients)} recipients")
        return True
    else:
        print(f"Failed to send email: {response.text}")
        return False


def main():
    import argparse
    parser = argparse.ArgumentParser(description='ACR Intel Podcast Generator')
    parser.add_argument('--test', type=str, metavar='EMAIL',
                        help='Send test broadcast to a single email address')
    args = parser.parse_args()

    print("=" * 50)
    print("ACR Intel Agent - Podcast Generator")
    if args.test:
        print(f"*** TEST MODE — sending to {args.test} only ***")
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
        # Hard cap: episodes must end under 6 minutes
        enforce_max_duration(output_path, max_seconds=355)
    except Exception as e:
        print(f"   Error: {e}")
        sys.exit(1)

    # Send email
    print("\n4. Sending podcast via email...")
    if send_podcast_email(output_path, date, test_recipient=args.test):
        print("   Success!")
    else:
        print("   Failed to send email")
        sys.exit(1)

    print("\n" + "=" * 50)
    print("Podcast generation complete!")
    print("=" * 50)


if __name__ == '__main__':
    main()
