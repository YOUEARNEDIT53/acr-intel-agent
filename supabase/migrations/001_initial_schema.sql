-- AI News Agent Database Schema

-- Source types enum (using DO block to handle existing types)
DO $$ BEGIN
  CREATE TYPE source_type AS ENUM ('rss', 'api', 'scrape');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE source_category AS ENUM ('research', 'lab', 'ecosystem');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE item_category AS ENUM ('research', 'product', 'engineering', 'policy', 'security', 'business');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Sources table
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  type source_type NOT NULL DEFAULT 'rss',
  category source_category NOT NULL DEFAULT 'research',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_fetched TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Summaries table
CREATE TABLE IF NOT EXISTS summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  category item_category NOT NULL DEFAULT 'research',
  topics JSONB NOT NULL DEFAULT '[]',
  relevance_score INTEGER NOT NULL DEFAULT 50 CHECK (relevance_score >= 0 AND relevance_score <= 100),
  must_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Digests table
CREATE TABLE IF NOT EXISTS digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  content JSONB NOT NULL,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_items_source_id ON items(source_id);
CREATE INDEX IF NOT EXISTS idx_items_fetched_at ON items(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_published_at ON items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_summaries_relevance ON summaries(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_summaries_must_read ON summaries(must_read) WHERE must_read = true;
CREATE INDEX IF NOT EXISTS idx_digests_date ON digests(date DESC);

-- Insert default sources
INSERT INTO sources (name, url, type, category) VALUES
  ('arXiv cs.AI', 'https://rss.arxiv.org/rss/cs.AI', 'rss', 'research'),
  ('arXiv cs.LG', 'https://rss.arxiv.org/rss/cs.LG', 'rss', 'research'),
  ('arXiv cs.CL', 'https://rss.arxiv.org/rss/cs.CL', 'rss', 'research'),
  ('HuggingFace Papers', 'https://huggingface.co/papers/rss', 'rss', 'research'),
  ('OpenAI News', 'https://openai.com/news/rss.xml', 'rss', 'lab'),
  ('Anthropic News', 'https://www.anthropic.com/news', 'scrape', 'lab'),
  ('DeepMind Blog', 'https://deepmind.google/blog/rss.xml', 'rss', 'lab'),
  ('Meta AI Blog', 'https://ai.meta.com/blog/', 'scrape', 'lab')
ON CONFLICT (url) DO NOTHING;
