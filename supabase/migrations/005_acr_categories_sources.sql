-- ACR Intel Agent: Update categories and add ACR-specific sources
-- This migration updates the source and item categories to focus on ACR industry intelligence

-- Step 1: Create new category enums
DO $$ BEGIN
  CREATE TYPE source_category_new AS ENUM ('sar', 'aviation', 'maritime', 'manufacturing', 'geopolitical', 'customer', 'competitor');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE item_category_new AS ENUM ('regulatory', 'product', 'market', 'supply_chain', 'trade', 'technology', 'competitor');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add new category column with default, then migrate data
ALTER TABLE sources ADD COLUMN IF NOT EXISTS category_new source_category_new DEFAULT 'manufacturing';

-- Map old categories to new ones
UPDATE sources SET category_new =
  CASE
    WHEN category::text = 'research' THEN 'manufacturing'::source_category_new
    WHEN category::text = 'lab' THEN 'competitor'::source_category_new
    WHEN category::text = 'ecosystem' THEN 'manufacturing'::source_category_new
    ELSE 'manufacturing'::source_category_new
  END;

-- Step 3: Drop old column and rename new (only if old column exists)
DO $$ BEGIN
  ALTER TABLE sources DROP COLUMN IF EXISTS category;
  ALTER TABLE sources RENAME COLUMN category_new TO category;
EXCEPTION WHEN undefined_column THEN null;
END $$;

-- Step 4: Same for summaries item_category
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS category_new item_category_new DEFAULT 'technology';

UPDATE summaries SET category_new =
  CASE
    WHEN category::text = 'research' THEN 'technology'::item_category_new
    WHEN category::text = 'product' THEN 'product'::item_category_new
    WHEN category::text = 'engineering' THEN 'technology'::item_category_new
    WHEN category::text = 'policy' THEN 'regulatory'::item_category_new
    WHEN category::text = 'security' THEN 'regulatory'::item_category_new
    WHEN category::text = 'business' THEN 'market'::item_category_new
    ELSE 'technology'::item_category_new
  END;

DO $$ BEGIN
  ALTER TABLE summaries DROP COLUMN IF EXISTS category;
  ALTER TABLE summaries RENAME COLUMN category_new TO category;
EXCEPTION WHEN undefined_column THEN null;
END $$;

-- Step 5: Clear old sources and add ACR-specific ones
DELETE FROM items; -- Will cascade to summaries
DELETE FROM sources;

-- ACR Industry Intelligence Sources
INSERT INTO sources (name, url, type, category) VALUES
  -- SAR (Search and Rescue) Sources
  ('USCG News', 'https://www.news.uscg.mil/rss/USCG-News/', 'rss', 'sar'),
  ('IMRF News', 'https://www.international-maritime-rescue.org/news?format=feed&type=rss', 'rss', 'sar'),
  ('SAR Technology Journal', 'https://www.sarupdates.com/feed/', 'rss', 'sar'),

  -- Aviation Sources
  ('Aviation Week', 'https://aviationweek.com/rss.xml', 'rss', 'aviation'),
  ('FlightGlobal', 'https://www.flightglobal.com/rss-feeds/', 'rss', 'aviation'),
  ('AIN Online', 'https://www.ainonline.com/rss.xml', 'rss', 'aviation'),
  ('Avionics International', 'https://www.aviationtoday.com/feed/', 'rss', 'aviation'),

  -- Maritime Sources
  ('Maritime Executive', 'https://www.maritime-executive.com/rss', 'rss', 'maritime'),
  ('gCaptain', 'https://gcaptain.com/feed/', 'rss', 'maritime'),
  ('Splash247', 'https://splash247.com/feed/', 'rss', 'maritime'),
  ('TradeWinds', 'https://www.tradewindsnews.com/rss/', 'rss', 'maritime'),

  -- Manufacturing/Antenna Technology Sources
  ('Microwave Journal', 'https://www.microwavejournal.com/rss/news', 'rss', 'manufacturing'),
  ('RF Globalnet', 'https://www.rfglobalnet.com/rss/', 'rss', 'manufacturing'),
  ('Antenna Systems & Technology', 'https://www.antennaproducts.com/blog/feed/', 'rss', 'manufacturing'),
  ('Satellite Today', 'https://www.satellitetoday.com/feed/', 'rss', 'manufacturing'),

  -- Geopolitical Sources
  ('Defense News', 'https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml', 'rss', 'geopolitical'),
  ('Breaking Defense', 'https://breakingdefense.com/feed/', 'rss', 'geopolitical'),
  ('Janes', 'https://www.janes.com/feeds/news', 'rss', 'geopolitical'),
  ('The Diplomat', 'https://thediplomat.com/feed/', 'rss', 'geopolitical'),

  -- Customer/Market Intel Sources
  ('Airbus Newsroom', 'https://www.airbus.com/en/newsroom/rss', 'rss', 'customer'),
  ('Boeing News', 'https://boeing.mediaroom.com/rss-feeds', 'rss', 'customer'),
  ('Lockheed Martin News', 'https://news.lockheedmartin.com/rss', 'rss', 'customer'),
  ('Northrop Grumman News', 'https://news.northropgrumman.com/rss', 'rss', 'customer'),

  -- Competitor Sources
  ('Cobham Advanced Electronic Solutions', 'https://www.cobhamaes.com/news', 'scrape', 'competitor'),
  ('L3Harris Technologies', 'https://www.l3harris.com/newsroom/rss', 'rss', 'competitor'),
  ('Collins Aerospace', 'https://www.collinsaerospace.com/newsroom/rss', 'rss', 'competitor'),
  ('Teledyne Technologies', 'https://www.teledyne.com/rss/news', 'rss', 'competitor')
ON CONFLICT (url) DO NOTHING;
