-- Table for storing flagged/reported questions from students
CREATE TABLE IF NOT EXISTS flagged_questions (
    id SERIAL PRIMARY KEY,
    question_id INT NOT NULL,
    student_id INT NOT NULL,
    student_name VARCHAR(255),
    flag_reason VARCHAR(50) NOT NULL, -- 'wrong_answer', 'unclear_question', 'wrong_topic', 'other'
    flag_description TEXT,
    quiz_id INT,
    quiz_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'dismissed'
    reviewed_by INT,
    reviewed_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES question(id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_flagged_questions_status ON flagged_questions(status);
CREATE INDEX IF NOT EXISTS idx_flagged_questions_question_id ON flagged_questions(question_id);
