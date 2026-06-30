import { supabaseAdmin } from '@/lib/supabase';
import { Source } from '@/types';

export const dynamic = 'force-dynamic';

// ---- live data ---------------------------------------------------------
async function getSources(): Promise<Source[]> {
  try {
    const { data } = await supabaseAdmin
      .from('sources')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    return (data as Source[]) || [];
  } catch {
    return [];
  }
}

async function getRecipientInfo() {
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'digest_recipients')
      .single();
    const emails = (data?.value || '')
      .split(',')
      .map((e: string) => e.trim())
      .filter(Boolean);
    const domains: Record<string, number> = {};
    for (const e of emails) {
      const d = e.split('@')[1]?.toLowerCase() || 'unknown';
      domains[d] = (domains[d] || 0) + 1;
    }
    return { count: emails.length, domains };
  } catch {
    return { count: 0, domains: {} as Record<string, number> };
  }
}

async function getRecentDigests() {
  try {
    const { data } = await supabaseAdmin
      .from('digests')
      .select('date, email_sent, created_at')
      .order('date', { ascending: false })
      .limit(10);
    return data || [];
  } catch {
    return [];
  }
}

// ---- static descriptive data ------------------------------------------
const PIPELINE = [
  {
    step: '1',
    title: 'Collect',
    body: 'Public news and industry RSS feeds are pulled on a schedule. Only published, publicly available articles are read — no internal or proprietary ACR documents are ever ingested.',
    by: 'RSS feeds',
  },
  {
    step: '2',
    title: 'Filter & summarize',
    body: 'Each article is scored by an AI model for relevance to ACR’s world (beacon tech, ELTs, EPIRBs, SAR, regulation) and given a short summary. Off-topic and stock/financial filler is dropped.',
    by: 'Anthropic Claude',
  },
  {
    step: '3',
    title: 'Daily digest',
    body: 'The top items are compiled into "The ACR Report" digest and emailed to the distribution list each weekday morning.',
    by: 'Resend email',
  },
  {
    step: '4',
    title: 'Podcast',
    body: 'Claude writes a tight two-host script from the digest, synthetic voices narrate it, and the audio is assembled and emailed. Every episode is capped under 6 minutes.',
    by: 'Edge TTS + Podcastfy',
  },
];

const SERVICES = [
  {
    name: 'Anthropic Claude',
    role: 'AI: relevance scoring, article summaries, and the podcast script.',
    model: 'claude-sonnet-4-6',
    data: 'Public article titles & text only. Anthropic does not train on API data.',
  },
  {
    name: 'Microsoft Edge TTS',
    role: 'Text-to-speech voices for the two hosts (via the Podcastfy library).',
    model: 'Neural voices',
    data: 'The generated script only. No personal data; nothing stored.',
  },
  {
    name: 'Vercel',
    role: 'Hosts this web app and the ingest / summarize / digest API endpoints.',
    model: 'Next.js',
    data: 'Application code and server functions.',
  },
  {
    name: 'Supabase',
    role: 'Database for sources, articles, summaries, digests, and settings.',
    model: 'Postgres',
    data: 'Article metadata, summaries, digest history, recipient list.',
  },
  {
    name: 'GitHub Actions',
    role: 'The scheduler that runs the whole pipeline automatically each weekday.',
    model: 'Cron: 8:00 AM ET, Mon–Fri',
    data: 'Runs the published code; holds API keys as encrypted secrets.',
  },
  {
    name: 'Resend',
    role: 'Delivers the digest email and the podcast to the distribution list.',
    model: 'Email API',
    data: 'Recipient addresses and the email/audio content.',
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  sar: 'bg-red-100 text-red-800',
  aviation: 'bg-blue-100 text-blue-800',
  maritime: 'bg-cyan-100 text-cyan-800',
  manufacturing: 'bg-purple-100 text-purple-800',
  geopolitical: 'bg-orange-100 text-orange-800',
  customer: 'bg-green-100 text-green-800',
  competitor: 'bg-yellow-100 text-yellow-800',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
}

// ---- page --------------------------------------------------------------
export default async function TransparencyPage() {
  const [sources, recipients, digests] = await Promise.all([
    getSources(),
    getRecipientInfo(),
    getRecentDigests(),
  ]);

  const enabledSources = sources.filter((s) => s.enabled);
  const byCategory: Record<string, Source[]> = {};
  for (const s of sources) {
    (byCategory[s.category] ||= []).push(s);
  }
  const lastDigest = digests[0];

  return (
    <div className="space-y-10">
      {/* Header */}
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">The ACR Report</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">How this works — full transparency</h1>
        <p className="mt-3 max-w-3xl text-gray-600">
          The ACR Report is an automated daily briefing and 5-minute podcast on the world of beacon
          technology. This page lays out exactly what it reads, which services it uses, and how the
          AI is involved — so nothing about how the report is made is a black box.
        </p>
      </header>

      {/* Quick stats */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Active sources', value: enabledSources.length },
          { label: 'Recipients', value: recipients.count },
          { label: 'Schedule', value: 'Mon–Fri' },
          { label: 'Episode length', value: 'Under 6 min' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">{s.label}</div>
          </div>
        ))}
      </section>

      {/* Pipeline */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">The pipeline, end to end</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {PIPELINE.map((p) => (
            <div key={p.step} className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {p.step}
              </div>
              <h3 className="mt-3 font-semibold text-gray-900">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{p.body}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-gray-400">{p.by}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section>
        <h2 className="mb-1 text-xl font-semibold text-gray-900">Services we use</h2>
        <p className="mb-4 text-sm text-gray-500">Every third-party service in the chain, what it does, and what data it touches.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {SERVICES.map((svc) => (
            <div key={svc.name} className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{svc.name}</h3>
                <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600">{svc.model}</span>
              </div>
              <p className="mt-2 text-sm text-gray-600">{svc.role}</p>
              <p className="mt-2 text-xs text-gray-500"><span className="font-medium text-gray-700">Data handled:</span> {svc.data}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI disclosure */}
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">About the AI &amp; the hosts</h2>
        <ul className="mt-3 space-y-2 text-sm text-amber-900/90">
          <li>• <strong>Gary McGee</strong> and <strong>Margaret Ann Jenkins</strong> are AI-generated synthetic voices and personas — they are not real people.</li>
          <li>• The script, summaries, and relevance scoring are produced by <strong>Anthropic&rsquo;s Claude</strong> (<code className="font-mono">claude-sonnet-4-6</code>). AI can make mistakes — always verify specifics against the original source linked in the digest.</li>
          <li>• Only <strong>public</strong> news content is processed. No proprietary, internal, or customer ACR information is sent to any AI service.</li>
          <li>• Episodes are deliberately kept <strong>under 6 minutes</strong>; the digest leads with the most relevant 1&ndash;2 stories.</li>
        </ul>
      </section>

      {/* Sources */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Sources</h2>
          <span className="text-sm text-gray-500">{enabledSources.length} active of {sources.length} total</span>
        </div>
        {Object.keys(byCategory).length === 0 ? (
          <p className="text-sm text-gray-500">No sources configured.</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(byCategory).map(([cat, list]) => (
              <div key={cat}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${CATEGORY_COLORS[cat] || 'bg-gray-100 text-gray-700'}`}>{cat}</span>
                  <span className="text-xs text-gray-400">{list.length}</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  {list.map((s) => (
                    <div key={s.id} className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 last:border-b-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${s.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="truncate text-sm font-medium text-gray-900">{s.name}</span>
                        <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-500">{s.type}</span>
                      </div>
                      <span className="shrink-0 pl-3 text-xs text-gray-400">last fetched {fmtDate(s.last_fetched)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Distribution + recent activity */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Who receives it</h2>
          <p className="mt-1 text-sm text-gray-500">{recipients.count} recipients. Addresses are kept private; here&rsquo;s the breakdown by organization:</p>
          <div className="mt-3 space-y-2">
            {Object.entries(recipients.domains).map(([d, n]) => (
              <div key={d} className="flex items-center justify-between text-sm">
                <span className="font-mono text-gray-700">@{d}</span>
                <span className="text-gray-500">{n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent editions</h2>
          <p className="mt-1 text-sm text-gray-500">
            Last digest: <strong>{lastDigest ? fmtDate(lastDigest.date) : '—'}</strong>
          </p>
          <div className="mt-3 divide-y divide-gray-100">
            {digests.length === 0 ? (
              <p className="text-sm text-gray-400">No editions recorded yet.</p>
            ) : (
              digests.map((d: { date: string; email_sent: boolean }) => (
                <div key={d.date} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-gray-700">{fmtDate(d.date)}</span>
                  <span className={d.email_sent ? 'text-green-600' : 'text-gray-400'}>
                    {d.email_sent ? 'Sent' : 'Not sent'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 pt-6 text-xs text-gray-400">
        This page reflects the live configuration of the pipeline. The ACR Report is an internal,
        automated industry-awareness tool. Generated content is AI-assisted and provided for
        situational awareness — verify specifics against the cited sources.
      </footer>
    </div>
  );
}
