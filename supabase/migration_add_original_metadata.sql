-- Add optional metadata columns for classic puzzle attribution
ALTER TABLE problems
ADD COLUMN IF NOT EXISTS original_title TEXT,
ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Index for faster lookup by original_title when present
CREATE INDEX IF NOT EXISTS idx_problems_original_title
  ON problems(original_title)
  WHERE original_title IS NOT NULL;

