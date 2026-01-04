import { supabaseAdmin } from '@/lib/supabase';
import { Source } from '@/types';

async function getSources() {
  const { data: sources } = await supabaseAdmin
    .from('sources')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  return sources || [];
}

function SourceRow({ source }: { source: Source }) {
  const categoryColors = {
    research: 'bg-purple-100 text-purple-800',
    lab: 'bg-blue-100 text-blue-800',
    ecosystem: 'bg-green-100 text-green-800',
  };

  const typeColors = {
    rss: 'bg-gray-100 text-gray-800',
    api: 'bg-yellow-100 text-yellow-800',
    scrape: 'bg-orange-100 text-orange-800',
  };

  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              source.enabled ? 'bg-green-500' : 'bg-gray-300'
            }`}
          />
          <span className="font-medium text-gray-900">{source.name}</span>
        </div>
      </td>
      <td className="py-4 px-4">
        <span
          className={`text-xs font-medium px-2 py-1 rounded ${
            categoryColors[source.category] || 'bg-gray-100 text-gray-800'
          }`}
        >
          {source.category}
        </span>
      </td>
      <td className="py-4 px-4">
        <span
          className={`text-xs font-medium px-2 py-1 rounded ${
            typeColors[source.type] || 'bg-gray-100 text-gray-800'
          }`}
        >
          {source.type}
        </span>
      </td>
      <td className="py-4 px-4">
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-800 truncate block max-w-xs"
          title={source.url}
        >
          {source.url.length > 50
            ? source.url.substring(0, 50) + '...'
            : source.url}
        </a>
      </td>
      <td className="py-4 px-4 text-sm text-gray-500">
        {source.last_fetched
          ? new Date(source.last_fetched).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })
          : 'Never'}
      </td>
    </tr>
  );
}

export default async function SourcesPage() {
  const sources = await getSources();

  const enabledCount = sources.filter((s) => s.enabled).length;
  const byCategory = sources.reduce(
    (acc, s) => {
      acc[s.category] = (acc[s.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Sources</h1>
        <p className="text-gray-500 mt-1">
          Manage the feeds and websites that are monitored for AI news.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{sources.length}</div>
          <div className="text-sm text-gray-500">Total Sources</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">{enabledCount}</div>
          <div className="text-sm text-gray-500">Active</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-purple-600">
            {byCategory.research || 0}
          </div>
          <div className="text-sm text-gray-500">Research</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-blue-600">
            {byCategory.lab || 0}
          </div>
          <div className="text-sm text-gray-500">Labs</div>
        </div>
      </div>

      {/* Sources Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                URL
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Fetched
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <SourceRow key={source.id} source={source as Source} />
            ))}
          </tbody>
        </table>

        {sources.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No sources configured.</p>
            <p className="text-sm text-gray-400 mt-2">
              Run the database migration to add default sources.
            </p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">Adding New Sources</h3>
        <p className="text-sm text-blue-700">
          To add new sources, insert them directly into the Supabase database or
          modify the migration file. Sources can be of type &quot;rss&quot; (for RSS
          feeds), &quot;api&quot; (for API endpoints), or &quot;scrape&quot; (for web scraping).
        </p>
      </div>
    </div>
  );
}

export const revalidate = 60;
