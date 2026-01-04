'use client';

import { useState } from 'react';

const MIGRATION_SQL = `-- Run this SQL in your Supabase SQL Editor
-- Go to: https://supabase.com/dashboard → Your Project → SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE source_type AS ENUM ('rss', 'api', 'scrape');
CREATE TYPE source_category AS ENUM ('research', 'lab', 'ecosystem');
CREATE TYPE item_category AS ENUM ('research', 'product', 'engineering', 'policy', 'security', 'business');

CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  type source_type NOT NULL DEFAULT 'rss',
  category source_category NOT NULL DEFAULT 'research',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_fetched TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  category item_category NOT NULL DEFAULT 'research',
  topics JSONB NOT NULL DEFAULT '[]',
  relevance_score INTEGER NOT NULL DEFAULT 50,
  must_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE digests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  content JSONB NOT NULL,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sources (name, url, type, category) VALUES
  ('arXiv cs.AI', 'https://rss.arxiv.org/rss/cs.AI', 'rss', 'research'),
  ('arXiv cs.LG', 'https://rss.arxiv.org/rss/cs.LG', 'rss', 'research'),
  ('arXiv cs.CL', 'https://rss.arxiv.org/rss/cs.CL', 'rss', 'research'),
  ('HuggingFace Papers', 'https://huggingface.co/papers/rss', 'rss', 'research'),
  ('OpenAI News', 'https://openai.com/news/rss.xml', 'rss', 'lab'),
  ('Anthropic News', 'https://www.anthropic.com/news', 'scrape', 'lab'),
  ('DeepMind Blog', 'https://deepmind.google/blog/rss.xml', 'rss', 'lab'),
  ('Meta AI Blog', 'https://ai.meta.com/blog/', 'scrape', 'lab');`;

export default function SetupPage() {
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(MIGRATION_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ingest');
      const data = await res.json();
      if (data.error?.includes('sources')) {
        setTestResult('Tables not found. Please run the SQL migration first.');
      } else if (data.success) {
        setTestResult('Database is set up correctly! Redirecting to dashboard...');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        setTestResult('Connection works but got: ' + JSON.stringify(data));
      }
    } catch (err) {
      setTestResult('Connection error: ' + (err instanceof Error ? err.message : 'Unknown'));
    }
    setTesting(false);
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        Database Setup Required
      </h1>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-yellow-800">
          The database tables haven&apos;t been created yet. Follow the steps below to complete setup.
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Step 1: Open Supabase SQL Editor
          </h2>
          <p className="text-gray-600 mb-4">
            Go to your Supabase dashboard, click on your project, then click &quot;SQL Editor&quot; in the left sidebar.
          </p>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Open Supabase Dashboard
          </a>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Step 2: Run This SQL
          </h2>
          <p className="text-gray-600 mb-4">
            Copy the SQL below and paste it into the SQL Editor, then click &quot;Run&quot;.
          </p>
          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm max-h-96">
              {MIGRATION_SQL}
            </pre>
            <button
              onClick={copyToClipboard}
              className="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
            >
              {copied ? 'Copied!' : 'Copy SQL'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Step 3: Test Connection
          </h2>
          <p className="text-gray-600 mb-4">
            After running the SQL, click the button below to verify everything is working.
          </p>
          <button
            onClick={testConnection}
            disabled={testing}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {testing ? 'Testing...' : 'Test Database Connection'}
          </button>
          {testResult && (
            <p className={`mt-4 p-3 rounded ${
              testResult.includes('correctly')
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}>
              {testResult}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
