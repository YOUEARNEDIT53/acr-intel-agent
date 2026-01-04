const puppeteer = require('puppeteer');

const MIGRATION_SQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  type source_type NOT NULL DEFAULT 'rss',
  category source_category NOT NULL DEFAULT 'research',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_fetched TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS summaries (
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

CREATE TABLE IF NOT EXISTS digests (
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
  ('Meta AI Blog', 'https://ai.meta.com/blog/', 'scrape', 'lab')
ON CONFLICT (url) DO NOTHING;
`;

async function setupDatabase() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    page.setDefaultTimeout(90000);

    // Go to Supabase login
    console.log('Navigating to Supabase...');
    await page.goto('https://supabase.com/dashboard/sign-in', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: '/tmp/step1-login.png' });

    // Wait for and fill login form
    console.log('Looking for login form...');
    await page.waitForSelector('input[name="email"]', { timeout: 30000 });
    console.log('Logging in...');
    await page.type('input[name="email"]', 'youearnedit@gmail.com', { delay: 50 });
    await page.type('input[name="password"]', 'FREEfat53!', { delay: 50 });
    await page.screenshot({ path: '/tmp/step2-filled.png' });

    // Click sign in button
    await page.click('button[type="submit"]');
    console.log('Submitted login form...');

    // Wait for URL to change (indicates successful login)
    console.log('Waiting for login redirect...');
    await new Promise(r => setTimeout(r, 8000));
    await page.screenshot({ path: '/tmp/step3-after-login.png' });
    console.log('Current URL:', page.url());

    // Navigate to the project
    console.log('Navigating to project...');
    await page.goto('https://supabase.com/dashboard/project/hpyhglztjtnszqdqvmve/sql/new', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for SQL editor to load
    console.log('Waiting for SQL editor...');
    await new Promise(r => setTimeout(r, 5000));

    // Find the Monaco editor and input SQL
    console.log('Entering SQL...');

    // Try to find the editor textarea or use keyboard
    const editor = await page.$('.monaco-editor textarea');
    if (editor) {
      await editor.click();
      await page.keyboard.type(MIGRATION_SQL, { delay: 1 });
    } else {
      // Try clicking in the editor area and typing
      const editorArea = await page.$('.monaco-editor');
      if (editorArea) {
        await editorArea.click();
        await page.keyboard.type(MIGRATION_SQL, { delay: 1 });
      }
    }

    // Click Run button
    console.log('Running SQL...');
    await new Promise(r => setTimeout(r, 2000));

    // Look for Run button
    const runButton = await page.$('button:has-text("Run")');
    if (runButton) {
      await runButton.click();
    } else {
      // Try keyboard shortcut
      await page.keyboard.down('Control');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Control');
    }

    // Wait for execution
    await new Promise(r => setTimeout(r, 5000));

    console.log('SQL migration completed!');

    // Take a screenshot for verification
    await page.screenshot({ path: '/tmp/supabase-result.png', fullPage: true });
    console.log('Screenshot saved to /tmp/supabase-result.png');

  } catch (error) {
    console.error('Error:', error.message);
    const page = (await browser.pages())[0];
    if (page) {
      await page.screenshot({ path: '/tmp/supabase-error.png', fullPage: true });
      console.log('Error screenshot saved to /tmp/supabase-error.png');
    }
  } finally {
    await browser.close();
  }
}

setupDatabase();
