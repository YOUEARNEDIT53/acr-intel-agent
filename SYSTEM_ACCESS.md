# AI News Agent - System Access & Configuration Guide

> **Created:** January 4, 2026
> **Full Version with Credentials:** See `SYSTEM_ACCESS_PRIVATE.md` (local only, not in git)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        YOUR AI NEWS SYSTEM                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐ │
│  │   Vercel    │    │  Supabase   │    │    GitHub Actions       │ │
│  │  (Website)  │───▶│ (Database)  │◀───│  (Podcast Generation)   │ │
│  └─────────────┘    └─────────────┘    └─────────────────────────┘ │
│        │                   │                      │                 │
│        ▼                   ▼                      ▼                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐ │
│  │   Resend    │    │  Anthropic  │    │      Podcastfy          │ │
│  │  (Emails)   │    │  (Claude)   │    │  (2-Host AI Podcast)    │ │
│  └─────────────┘    └─────────────┘    └─────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### What Runs Where

| Component | Platform | Schedule | What It Does |
|-----------|----------|----------|--------------|
| News Ingestion | Vercel | 6:00 AM UTC daily | Fetches news from 9 RSS sources |
| Summarization | Vercel | After ingestion | Claude summarizes each article |
| Digest Email | Vercel | 1:00 PM UTC daily | Sends formatted email digest |
| Podcast | GitHub Actions | 8am, 2pm, 8pm UTC | Generates & emails audio podcast |

---

## Where to Find Credentials

| Service | Where Credentials Are Stored |
|---------|------------------------------|
| All API Keys | `.env.local` (local file, not in git) |
| Vercel Env Vars | https://vercel.com → Project → Settings → Environment Variables |
| GitHub Secrets | https://github.com/YOUEARNEDIT53/ai-news-agent/settings/secrets/actions |
| Full Documentation | `SYSTEM_ACCESS_PRIVATE.md` (local only) |

---

## Service Access URLs

### Dashboards

| Service | URL |
|---------|-----|
| **Your Dashboard** | https://ai-news-agent-kohl.vercel.app |
| **Vercel** | https://vercel.com/youearnedit-6188s-projects/ai-news-agent |
| **Supabase** | https://supabase.com/dashboard/project/hpyhglztjtnszqdqvmve |
| **GitHub Actions** | https://github.com/YOUEARNEDIT53/ai-news-agent/actions |
| **GitHub Secrets** | https://github.com/YOUEARNEDIT53/ai-news-agent/settings/secrets/actions |
| **Anthropic** | https://console.anthropic.com |
| **Resend** | https://resend.com/emails |

---

## How to Change Things

### Change Email Recipient

1. **Vercel:** Settings → Environment Variables → Edit `DIGEST_EMAIL_TO`
2. **GitHub:** Settings → Secrets → Update `DIGEST_EMAIL_TO`

### Change Podcast Schedule

Edit `.github/workflows/podcast.yml`:
```yaml
schedule:
  - cron: '0 8 * * *'   # 8:00 AM UTC
  - cron: '0 14 * * *'  # 2:00 PM UTC
  - cron: '0 20 * * *'  # 8:00 PM UTC
```

### Add/Remove News Sources

1. Go to Supabase Dashboard → Table Editor → `sources`
2. Add/edit rows

### Manually Trigger Podcast

GitHub Actions → "Generate AI News Podcast" → "Run workflow"

### Manually Trigger Digest

Visit dashboard → Click "Generate Digest" button

---

## File Structure

```
/home/eng/ai-news-agent/
├── .env.local                    # API keys (LOCAL ONLY - not in git)
├── SYSTEM_ACCESS_PRIVATE.md      # Full docs with keys (LOCAL ONLY)
├── SYSTEM_ACCESS.md              # This file (safe for git)
├── .github/workflows/
│   └── podcast.yml               # Podcast automation
├── src/app/api/                  # API routes
├── scripts/generate_podcast.py   # Podcast script
├── podcast-venv/                 # Python (not in git)
└── bin/                          # Tools (not in git)
```

---

## Current News Sources

| Name | Type |
|------|------|
| arXiv cs.AI | RSS |
| arXiv cs.LG | RSS |
| arXiv cs.CL | RSS |
| arXiv stat.ML | RSS |
| HuggingFace Papers | RSS |
| OpenAI | RSS |
| Anthropic | Scrape |
| DeepMind | RSS |
| Meta AI | Scrape |

---

## Monthly Costs

| Service | Cost |
|---------|------|
| Vercel | $0 (free tier) |
| Supabase | $0 (free tier) |
| Resend | $0 (free tier) |
| GitHub Actions | $0 (free tier) |
| Anthropic Claude | **$5-15** |
| **Total** | **~$5-15/month** |

---

## Troubleshooting

### Podcast Not Sending
→ Check GitHub Actions logs

### Email Not Arriving
→ Check Resend dashboard & spam folder

### No New Articles
→ Check Supabase `sources` table, trigger manual ingest

---

*For full credentials, see `SYSTEM_ACCESS_PRIVATE.md` on your local machine.*
