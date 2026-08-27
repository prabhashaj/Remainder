-- Add deep_research_used column to usage_logs table
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS deep_research_used integer DEFAULT 0 NOT NULL;
