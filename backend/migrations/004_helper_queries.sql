-- Migration: Helper queries and functions for common operations
-- Created: 2025-12-02
-- Description: Useful queries for finding questions, adjusting scores, and analytics

-- =====================================================
-- FUNCTION: Bulk adjust scores for a corrected question
-- Use this when you fix a question's answer key and need to
-- give back points to all students who answered correctly
-- =====================================================
CREATE OR REPLACE FUNCTION adjust_scores_for_question(
    p_question_id INTEGER,
    p_correct_answer VARCHAR(50),
    p_adjusted_by INTEGER,
    p_reason TEXT DEFAULT 'Answer key corrected'
)
RETURNS TABLE(
    attempt_id INTEGER,
    student_id INTEGER,
    student_name TEXT,
    old_points INTEGER,
    new_adjustment INTEGER
) AS $$
BEGIN
    RETURN QUERY
    UPDATE quiz_attempt_answers qaa
    SET
        points_adjusted = points_possible,
        adjusted_by = p_adjusted_by,
        adjusted_at = NOW(),
        adjustment_reason = p_reason
    FROM quiz_attempts qa
    JOIN users u ON qa.student_id = u.id
    WHERE qaa.attempt_id = qa.id
      AND qaa.question_id = p_question_id
      AND qaa.student_answer = p_correct_answer
      AND qaa.is_correct = false
      AND qaa.points_adjusted = 0
    RETURNING
        qa.id as attempt_id,
        qa.student_id,
        u.name::TEXT as student_name,
        qaa.points_earned as old_points,
        qaa.points_adjusted as new_adjustment;

    -- Also update the adjusted_score in quiz_attempts
    UPDATE quiz_attempts qa
    SET adjusted_score = (
        SELECT COALESCE(SUM(points_adjusted), 0)
        FROM quiz_attempt_answers
        WHERE attempt_id = qa.id
    )
    WHERE id IN (
        SELECT attempt_id FROM quiz_attempt_answers
        WHERE question_id = p_question_id AND points_adjusted > 0
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Get questions by topic with full hierarchy
-- Returns questions with their subject/level/topic info
-- =====================================================
CREATE OR REPLACE FUNCTION get_questions_by_topic(
    p_topic_id INTEGER DEFAULT NULL,
    p_level_id INTEGER DEFAULT NULL,
    p_subject_name VARCHAR DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
    question_id INTEGER,
    question_number INTEGER,
    question_text TEXT,
    answer_options JSONB,
    answer_key VARCHAR,
    difficulty_level VARCHAR,
    topic_name VARCHAR,
    level_name VARCHAR,
    subject_name VARCHAR,
    paper_name VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        q.id as question_id,
        q.question_number,
        q.question_text,
        q.answer_options,
        q.answer_key,
        q.difficulty_level,
        t.label as topic_name,
        l.display_name as level_name,
        s.display_name as subject_name,
        q.paper_name
    FROM question q
    LEFT JOIN topics t ON q.topic_id = t.id
    LEFT JOIN levels l ON t.level_id = l.id
    LEFT JOIN subjects s ON l.subject_id = s.id
    WHERE
        (p_topic_id IS NULL OR q.topic_id = p_topic_id)
        AND (p_level_id IS NULL OR t.level_id = p_level_id)
        AND (p_subject_name IS NULL OR s.name ILIKE p_subject_name)
    ORDER BY q.id DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEW: Student performance by topic
-- Shows how students perform on different topics
-- =====================================================
CREATE OR REPLACE VIEW student_topic_performance AS
SELECT
    qa.student_id,
    u.name as student_name,
    t.id as topic_id,
    t.label as topic_name,
    l.display_name as level_name,
    s.display_name as subject_name,
    COUNT(qaa.id) as total_questions,
    SUM(CASE WHEN qaa.is_correct THEN 1 ELSE 0 END) as correct_answers,
    ROUND(
        (SUM(CASE WHEN qaa.is_correct THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(qaa.id), 0)) * 100,
        1
    ) as accuracy_percent,
    MAX(qa.completed_at) as last_attempted
FROM quiz_attempt_answers qaa
JOIN quiz_attempts qa ON qaa.attempt_id = qa.id
JOIN users u ON qa.student_id = u.id
JOIN question q ON qaa.question_id = q.id
LEFT JOIN topics t ON q.topic_id = t.id
LEFT JOIN levels l ON t.level_id = l.id
LEFT JOIN subjects s ON l.subject_id = s.id
WHERE qa.status = 'completed'
GROUP BY qa.student_id, u.name, t.id, t.label, l.display_name, s.display_name;

-- =====================================================
-- VIEW: Questions that need review (frequently wrong)
-- Helps identify problematic questions
-- =====================================================
CREATE OR REPLACE VIEW questions_needing_review AS
SELECT
    q.id as question_id,
    q.question_number,
    q.paper_name,
    q.topic_label,
    t.label as topic_name,
    COUNT(qaa.id) as total_attempts,
    SUM(CASE WHEN qaa.is_correct THEN 1 ELSE 0 END) as correct_count,
    SUM(CASE WHEN NOT qaa.is_correct THEN 1 ELSE 0 END) as wrong_count,
    ROUND(
        (SUM(CASE WHEN NOT qaa.is_correct THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(qaa.id), 0)) * 100,
        1
    ) as wrong_percentage,
    (SELECT COUNT(*) FROM flagged_questions fq WHERE fq.question_id = q.id AND fq.status = 'pending') as pending_flags
FROM question q
LEFT JOIN quiz_attempt_answers qaa ON q.id = qaa.question_id
LEFT JOIN topics t ON q.topic_id = t.id
GROUP BY q.id, t.label
HAVING COUNT(qaa.id) >= 5  -- At least 5 attempts
   AND (SUM(CASE WHEN NOT qaa.is_correct THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(qaa.id), 0)) > 0.7  -- >70% wrong
ORDER BY wrong_percentage DESC, pending_flags DESC;

-- =====================================================
-- VIEW: Quiz leaderboard
-- Shows top performers for each quiz
-- =====================================================
CREATE OR REPLACE VIEW quiz_leaderboard AS
SELECT
    qa.quiz_id,
    qf.name as quiz_name,
    qa.student_id,
    u.name as student_name,
    (qa.total_score + qa.adjusted_score) as final_score,
    qa.max_score,
    CASE
        WHEN qa.max_score > 0
        THEN ROUND(((qa.total_score + qa.adjusted_score)::numeric / qa.max_score) * 100, 1)
        ELSE 0
    END as percentage,
    qa.time_taken_seconds,
    qa.completed_at,
    RANK() OVER (PARTITION BY qa.quiz_id ORDER BY (qa.total_score + qa.adjusted_score) DESC, qa.time_taken_seconds ASC) as rank
FROM quiz_attempts qa
JOIN users u ON qa.student_id = u.id
JOIN quiz_folders qf ON qa.quiz_id = qf.id
WHERE qa.status = 'completed'
ORDER BY qa.quiz_id, rank;

-- =====================================================
-- Example queries for common use cases
-- =====================================================

-- 1. Find all questions for a specific topic:
-- SELECT * FROM get_questions_by_topic(p_topic_id := 5);

-- 2. Find questions by level (e.g., all Sec 3 questions):
-- SELECT * FROM get_questions_by_topic(p_level_id := 3);

-- 3. Find questions by subject:
-- SELECT * FROM get_questions_by_topic(p_subject_name := 'math');

-- 4. Adjust scores when you fix a wrong answer key:
-- SELECT * FROM adjust_scores_for_question(
--     p_question_id := 123,
--     p_correct_answer := 'B',
--     p_adjusted_by := 1,
--     p_reason := 'Original answer key was A, but B is correct'
-- );

-- 5. See which topics a student struggles with:
-- SELECT * FROM student_topic_performance WHERE student_id = 5 ORDER BY accuracy_percent ASC;

-- 6. Find questions that might have issues:
-- SELECT * FROM questions_needing_review LIMIT 10;

-- 7. Get quiz leaderboard:
-- SELECT * FROM quiz_leaderboard WHERE quiz_id = 10;

SELECT 'Helper functions and views created successfully' as status;
