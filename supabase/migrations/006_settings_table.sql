-- Settings table for runtime configuration
-- Allows UI-based management of settings like email distribution list

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for fast key lookups
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Seed with current distribution list
INSERT INTO settings (key, value, description) VALUES
  ('digest_recipients',
   'adam.sadowski@acrartex.com,chris.bolender@acrartex.com,jim.story@acrartex.com,youearnedit@gmail.com,John.Nguyen@acrartex.com,mikele.darcangelo@acrartex.com,bill.cox@acrartex.com,Jose.Casanova@acrartex.com,Ernesto.Puig@acrartex.com,jeff.geraci@acrartex.com,Shawn.Pariaug@acrartex.com,mark.kindell@acrartex.com',
   'Comma-separated list of email recipients for digest and podcast distribution');
