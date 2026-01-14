-- Migration: Create quiz_attempts and quiz_attempt_answers tables
-- Created: 2025-12-02
-- Description: Track student quiz attempts and individual answers for scoring, analytics, and retroactive corrections

-- =====================================================
-- Table 1: quiz_attempts
-- Stores overall quiz session information
-- =====================================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id SERIAL PRIMARY KEY,

    -- Who took it
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- What quiz
    quiz_id INTEGER NOT NULL REFERENCES quiz_folders(id) ON DELETE CASCADE,

    -- Optional link to assignment (if this was an assigned quiz vs self-practice)
    assignment_id INTEGER REFERENCES quiz_assignments(id) ON DELETE SET NULL,

    -- Quiz mode
    mode VARCHAR(20) NOT NULL DEFAULT 'practice' CHECK (mode IN ('practice', 'test', 'review')),

    -- Timing
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    time_taken_seconds INTEGER,

    -- Scoring
    total_score INTEGER DEFAULT 0,
    max_score INTEGER DEFAULT 0,
    adjusted_score INTEGER DEFAULT 0,  -- Additional points from corrections

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Table 2: quiz_attempt_answers
-- Stores individual question responses within an attempt
-- =====================================================
CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
    id SERIAL PRIMARY KEY,

    -- Link to attempt
    attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,

    -- Link to question
    question_id INTEGER NOT NULL REFERENCES question(id) ON DELETE CASCADE,

    -- Question order in quiz (for display purposes)
    question_order INTEGER,

    -- Student's response
    student_answer VARCHAR(50),  -- e.g., "A", "B", "C", "D" or text answer

    -- Snapshot of correct answer at time of attempt (important for retroactive fixes)
    correct_answer_snapshot VARCHAR(50),

    -- Scoring
    is_correct BOOLEAN,
    points_possible INTEGER DEFAULT 1,
    points_earned INTEGER DEFAULT 0,

    -- Manual adjustments (for when teacher corrects a wrong question)
    points_adjusted INTEGER DEFAULT 0,
    adjusted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    adjusted_at TIMESTAMP,
    adjustment_reason TEXT,

    -- Timing (optional - for time-per-question analytics)
    time_spent_seconds INTEGER,
    answered_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate answers for same question in same attempt
    UNIQUE(attempt_id, question_id)
);

-- =====================================================
-- Indexes for performance
-- =====================================================

-- quiz_attempts indexes
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_id ON quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_assignment_id ON quiz_attempts(assignment_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_status ON quiz_attempts(status);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_completed_at ON quiz_attempts(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_quiz ON quiz_attempts(student_id, quiz_id);

-- quiz_attempt_answers indexes
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_answers_attempt_id ON quiz_attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_answers_question_id ON quiz_attempt_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_answers_is_correct ON quiz_attempt_answers(is_correct);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_answers_needs_adjustment
    ON quiz_attempt_answers(question_id, is_correct) WHERE is_correct = false;

-- =====================================================
-- Trigger to update updated_at on quiz_attempts
-- =====================================================
CREATE TRIGGER update_quiz_attempts_updated_at
    BEFORE UPDATE ON quiz_attempts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Helper view: Get attempt summary with calculated scores
-- =====================================================
CREATE OR REPLACE VIEW quiz_attempt_summary AS
SELECT
    qa.id as attempt_id,
    qa.student_id,
    u.name as student_name,
    qa.quiz_id,
    qf.name as quiz_name,
    qa.mode,
    qa.status,
    qa.started_at,
    qa.completed_at,
    qa.time_taken_seconds,
    qa.total_score,
    qa.max_score,
    qa.adjusted_score,
    (qa.total_score + qa.adjusted_score) as final_score,
    CASE
        WHEN qa.max_score > 0
        THEN ROUND(((qa.total_score + qa.adjusted_score)::numeric / qa.max_score) * 100, 1)
        ELSE 0
    END as percentage,
    COUNT(qaa.id) as questions_answered,
    SUM(CASE WHEN qaa.is_correct THEN 1 ELSE 0 END) as questions_correct
FROM quiz_attempts qa
JOIN users u ON qa.student_id = u.id
JOIN quiz_folders qf ON qa.quiz_id = qf.id
LEFT JOIN quiz_attempt_answers qaa ON qa.id = qaa.attempt_id
GROUP BY qa.id, u.name, qf.name;

-- =====================================================
-- Verification
-- =====================================================
SELECT 'quiz_attempts table created' as status,
       (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'quiz_attempts') as exists;
SELECT 'quiz_attempt_answers table created' as status,
       (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'quiz_attempt_answers') as exists;
