import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { DigestContent } from '@/types';

interface PageProps {
  params: Promise<{ date: string }>;
}

async function getDigest(date: string) {
  const { data: digest } = await supabaseAdmin
    .from('digests')
    .select('*')
    .eq('date', date)
    .single();

  return digest;
}

function DigestItem({
  title,
  summary,
  why_it_matters,
  url,
  topics,
  category,
  relevance_score,
}: {
  title: string;
  summary: string;
  why_it_matters: string;
  url: string;
  topics: string[];
  category: string;
  relevance_score: number;
}) {
  return (
    <div className="border-b border-gray-100 last:border-b-0 py-4">
      <div className="flex items-start justify-between">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-900 font-medium hover:text-blue-600 flex-1"
        >
          {title}
        </a>
        <div className="flex items-center gap-2 ml-2">
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {category}
          </span>
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
            {relevance_score}
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-600">{summary}</p>
      <p className="mt-1 text-sm text-blue-600 font-medium">{why_it_matters}</p>
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
  emoji,
}: {
  title: string;
  items: DigestContent['must_know'];
  color: 'red' | 'yellow' | 'blue';
  emoji: string;
}) {
  if (items.length === 0) return null;

  const colorClasses = {
    red: 'border-red-500 bg-red-50',
    yellow: 'border-yellow-500 bg-yellow-50',
    blue: 'border-blue-500 bg-blue-50',
  };

  return (
    <div className={`rounded-lg border-l-4 ${colorClasses[color]} p-6 mb-6`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {emoji} {title}
        <span className="ml-2 text-sm font-normal text-gray-500">
          ({items.length} items)
        </span>
      </h3>
      {items.map((item, i) => (
        <DigestItem key={i} {...item} />
      ))}
    </div>
  );
}

export default async function DigestPage({ params }: PageProps) {
  const { date } = await params;
  const digest = await getDigest(date);

  if (!digest) {
    notFound();
  }

  const content = digest.content as unknown as DigestContent;
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const totalItems =
    content.must_know.length +
    content.worth_a_look.length +
    content.quick_hits.length;

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{formattedDate}</h1>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-sm text-gray-500">{totalItems} items</span>
          {digest.email_sent && (
            <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
              Email Sent
            </span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <DigestSection
          title="Must Know"
          items={content.must_know}
          color="red"
          emoji="🔴"
        />
        <DigestSection
          title="Worth a Look"
          items={content.worth_a_look}
          color="yellow"
          emoji="🟡"
        />
        <DigestSection
          title="Quick Hits"
          items={content.quick_hits}
          color="blue"
          emoji="🔵"
        />

        {totalItems === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No items in this digest.</p>
          </div>
        )}
      </div>
    </div>
  );
}
