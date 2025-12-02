-- Migration: Add topic_id foreign key to question table
-- Created: 2025-12-02
-- Description: Links questions to the topics table for faster and more reliable lookups

-- Step 1: Add topic_id column to question table
ALTER TABLE question
ADD COLUMN IF NOT EXISTS topic_id INTEGER;

-- Step 2: Add foreign key constraint
-- Using DO block to handle case where constraint might already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_question_topic'
    ) THEN
        ALTER TABLE question
        ADD CONSTRAINT fk_question_topic
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Step 3: Create index for faster lookups by topic
CREATE INDEX IF NOT EXISTS idx_question_topic_id ON question(topic_id);

-- Step 4: Populate topic_id from existing topic_label data (best effort matching)
-- This attempts to match existing topic_label strings to topic records
UPDATE question q
SET topic_id = t.id
FROM topics t
WHERE q.topic_id IS NULL
  AND q.topic_label IS NOT NULL
  AND (
    LOWER(q.topic_label) = LOWER(t.label)
    OR LOWER(q.topic_label) = LOWER(t.hashtag)
    OR q.topic_label ILIKE '%' || t.label || '%'
  );

-- Step 5: Add additional useful indexes on question table
CREATE INDEX IF NOT EXISTS idx_question_subject ON question(subject);
CREATE INDEX IF NOT EXISTS idx_question_level ON question(level);
CREATE INDEX IF NOT EXISTS idx_question_paper_name ON question(paper_name);
CREATE INDEX IF NOT EXISTS idx_question_difficulty ON question(difficulty_level);

-- Verify migration
SELECT
    'Questions with topic_id populated' as metric,
    COUNT(*) as count
FROM question
WHERE topic_id IS NOT NULL
UNION ALL
SELECT
    'Questions without topic_id' as metric,
    COUNT(*) as count
FROM question
WHERE topic_id IS NULL;
