import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { DigestContent } from '@/types';
import { FeedbackButtons } from '@/components/FeedbackButtons';

async function checkDatabaseSetup(): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from('sources').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function getLatestDigest() {
  try {
    const { data: digest } = await supabaseAdmin
      .from('digests')
      .select('*')
      .order('date', { ascending: false })
      .limit(1)
      .single();
    return digest;
  } catch {
    return null;
  }
}

async function getRecentDigests() {
  try {
    const { data: digests } = await supabaseAdmin
      .from('digests')
      .select('id, date, email_sent, created_at')
      .order('date', { ascending: false })
      .limit(7);
    return digests || [];
  } catch {
    return [];
  }
}

async function getStats() {
  try {
    const { count: sourcesCount } = await supabaseAdmin
      .from('sources')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true);

    const { count: itemsCount } = await supabaseAdmin
      .from('items')
      .select('*', { count: 'exact', head: true });

    const { count: summariesCount } = await supabaseAdmin
      .from('summaries')
      .select('*', { count: 'exact', head: true });

    return {
      sources: sourcesCount || 0,
      items: itemsCount || 0,
      summaries: summariesCount || 0,
    };
  } catch {
    return { sources: 0, items: 0, summaries: 0 };
  }
}

function DigestItem({
  title,
  summary,
  why_it_matters,
  url,
  topics,
  relevance_score,
}: {
  title: string;
  summary: string;
  why_it_matters: string;
  url: string;
  topics: string[];
  relevance_score: number;
}) {
  return (
    <div className="border-b border-gray-100 last:border-b-0 py-4">
      <div className="flex items-start justify-between gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-900 font-medium hover:text-blue-600 flex-1"
        >
          {title}
        </a>
        <div className="flex items-center gap-2">
          <FeedbackButtons itemUrl={url} />
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {relevance_score}
          </span>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-600">{why_it_matters}</p>
      {topics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {topics.map((topic) => (
            <span
              key={topic}
              className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
            >
              {topic}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DigestSection({
  title,
  items,
  color,
}: {
  title: string;
  items: DigestContent['must_know'];
  color: 'red' | 'yellow' | 'blue';
}) {
  if (items.length === 0) return null;

  const colorClasses = {
    red: 'border-red-500 bg-red-50',
    yellow: 'border-yellow-500 bg-yellow-50',
    blue: 'border-blue-500 bg-blue-50',
  };

  return (
    <div className={`rounded-lg border-l-4 ${colorClasses[color]} p-4 mb-4`}>
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      {items.map((item, i) => (
        <DigestItem key={i} {...item} />
      ))}
    </div>
  );
}

export default async function Dashboard() {
  // Check if database is set up
  const isSetup = await checkDatabaseSetup();
  if (!isSetup) {
    redirect('/setup');
  }

  const [latestDigest, recentDigests, stats] = await Promise.all([
    getLatestDigest(),
    getRecentDigests(),
    getStats(),
  ]);

  const content = latestDigest?.content as unknown as DigestContent | undefined;

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-gray-900">{stats.sources}</div>
          <div className="text-sm text-gray-500">Active Sources</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-gray-900">{stats.items}</div>
          <div className="text-sm text-gray-500">Total Items</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-gray-900">{stats.summaries}</div>
          <div className="text-sm text-gray-500">Summaries</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Latest Digest */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Latest Digest
                {latestDigest && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    {new Date(latestDigest.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </h2>
            </div>
            <div className="p-6">
              {content ? (
                <>
                  <DigestSection
                    title="Must Know"
                    items={content.must_know}
                    color="red"
                  />
                  <DigestSection
                    title="Worth a Look"
                    items={content.worth_a_look}
                    color="yellow"
                  />
                  <DigestSection
                    title="Quick Hits"
                    items={content.quick_hits}
                    color="blue"
                  />
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No digest available yet.</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Run the ingestion and digest generation to get started.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Digests */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Digests
              </h2>
            </div>
            <div className="p-4">
              {recentDigests.length > 0 ? (
                <ul className="space-y-2">
                  {recentDigests.map((digest) => (
                    <li key={digest.id}>
                      <Link
                        href={`/digest/${digest.date}`}
                        className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50"
                      >
                        <span className="text-sm text-gray-700">
                          {new Date(digest.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        {digest.email_sent && (
                          <span className="text-xs text-green-600">Sent</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No digests yet
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Actions</h2>
            </div>
            <div className="p-4 space-y-2">
              <form action="/api/ingest" method="POST">
                <button
                  type="submit"
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded border border-gray-200"
                >
                  Run Ingestion
                </button>
              </form>
              <form action="/api/summarize" method="POST">
                <button
                  type="submit"
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded border border-gray-200"
                >
                  Generate Summaries
                </button>
              </form>
              <form action="/api/digest" method="POST">
                <button
                  type="submit"
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded border border-gray-200"
                >
                  Generate Digest
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Revalidate every 5 minutes
export const revalidate = 300;
