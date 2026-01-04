-- Add arXiv stat.ML source
INSERT INTO sources (name, url, type, category) VALUES
  ('arXiv stat.ML', 'https://rss.arxiv.org/rss/stat.ML', 'rss', 'research')
ON CONFLICT (url) DO NOTHING;
