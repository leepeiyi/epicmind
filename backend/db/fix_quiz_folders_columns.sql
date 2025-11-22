-- Fix VARCHAR(255) column overflow issues in quiz_folders table
-- Run this migration to prevent "value too long for type character varying(255)" errors

-- 1. Check if quiz_folders table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'quiz_folders') THEN
        -- Create the table if it doesn't exist
        CREATE TABLE quiz_folders (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255),
            subject VARCHAR(255),
            banding VARCHAR(50),
            level VARCHAR(50),
            topic VARCHAR(255),
            question_ids INTEGER[],
            teacher_id INTEGER,
            segmented_questions JSONB,
            time_per_question_minutes INTEGER,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );

        RAISE NOTICE 'Created quiz_folders table with proper schema';
    END IF;
END
$$;

-- 2. Alter existing columns to handle longer values
-- Change segmented_questions from VARCHAR(255) to JSONB (if it's not already)
DO $$
BEGIN
    -- First, check the current data type
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'quiz_folders'
        AND column_name = 'segmented_questions'
        AND data_type LIKE '%character%'
    ) THEN
        -- It's a VARCHAR/TEXT, convert to JSONB
        ALTER TABLE quiz_folders
        ALTER COLUMN segmented_questions TYPE JSONB USING segmented_questions::jsonb;

        RAISE NOTICE 'Converted segmented_questions to JSONB';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not convert segmented_questions to JSONB, trying alternative approach';

        -- Alternative: Just make it TEXT if JSON conversion fails
        ALTER TABLE quiz_folders
        ALTER COLUMN segmented_questions TYPE TEXT;

        RAISE NOTICE 'Converted segmented_questions to TEXT';
END
$$;

-- 3. Ensure other text columns can handle longer values
ALTER TABLE quiz_folders
ALTER COLUMN name TYPE TEXT;

ALTER TABLE quiz_folders
ALTER COLUMN topic TYPE TEXT;

ALTER TABLE quiz_folders
ALTER COLUMN subject TYPE TEXT;

-- 4. Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_quiz_folders_teacher_id ON quiz_folders(teacher_id);
CREATE INDEX IF NOT EXISTS idx_quiz_folders_subject ON quiz_folders(subject);
CREATE INDEX IF NOT EXISTS idx_quiz_folders_level ON quiz_folders(level);
CREATE INDEX IF NOT EXISTS idx_quiz_folders_created_at ON quiz_folders(created_at DESC);

-- 5. Verify the changes
SELECT
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'quiz_folders'
ORDER BY ordinal_position;
