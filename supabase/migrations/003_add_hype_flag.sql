-- Add hype_flag column to summaries table
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS hype_flag BOOLEAN NOT NULL DEFAULT false;
