const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { dbConfig } = require("../../utils/db-config");

// PostgreSQL connection pool
const pool = new Pool(dbConfig);

// Create the flagged_questions table if it doesn't exist
const createTableIfNotExists = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS flagged_questions (
            id SERIAL PRIMARY KEY,
            question_id INT NOT NULL,
            student_id INT NOT NULL,
            student_name VARCHAR(255),
            flag_reason VARCHAR(50) NOT NULL,
            flag_description TEXT,
            quiz_id INT,
            quiz_name VARCHAR(255),
            status VARCHAR(20) DEFAULT 'pending',
            reviewed_by INT,
            reviewed_at TIMESTAMP,
            resolution_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_flagged_questions_status ON flagged_questions(status);
        CREATE INDEX IF NOT EXISTS idx_flagged_questions_question_id ON flagged_questions(question_id);
    `;
    try {
        await pool.query(createTableQuery);
        console.log('✅ flagged_questions table ready');
    } catch (error) {
        console.error('❌ Error creating flagged_questions table:', error.message);
    }
};

// Initialize table on module load
createTableIfNotExists();

// POST /api/flagged/report - Student reports/flags a question
router.post('/report', async (req, res) => {
    try {
        const {
            question_id,
            student_id,
            student_name,
            flag_reason,
            flag_description,
            quiz_id,
            quiz_name
        } = req.body;

        // Validate required fields
        if (!question_id || !student_id || !flag_reason) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: question_id, student_id, and flag_reason are required'
            });
        }

        // Valid flag reasons
        const validReasons = ['wrong_answer', 'unclear_question', 'wrong_topic', 'typo_error', 'other'];
        if (!validReasons.includes(flag_reason)) {
            return res.status(400).json({
                success: false,
                error: `Invalid flag_reason. Must be one of: ${validReasons.join(', ')}`
            });
        }

        // Check if this student already flagged this question
        const existingFlag = await pool.query(
            'SELECT id FROM flagged_questions WHERE question_id = $1 AND student_id = $2 AND status = $3',
            [question_id, student_id, 'pending']
        );

        if (existingFlag.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'You have already reported this question. Your report is pending review.'
            });
        }

        // Insert the flag
        const result = await pool.query(
            `INSERT INTO flagged_questions
            (question_id, student_id, student_name, flag_reason, flag_description, quiz_id, quiz_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [question_id, student_id, student_name, flag_reason, flag_description || null, quiz_id || null, quiz_name || null]
        );

        res.json({
            success: true,
            message: 'Question reported successfully. A teacher will review it soon.',
            flag: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Error reporting question:', error);
        res.status(500).json({ success: false, error: 'Failed to report question' });
    }
});

// GET /api/flagged/all - Get all flagged questions (for teachers)
router.get('/all', async (req, res) => {
    try {
        const { status } = req.query;

        let query = `
            SELECT
                fq.*,
                q.question_text,
                q.answer_options,
                q.answer_key,
                q.topic_label,
                q.difficulty_level,
                q.paper_name,
                q.subject,
                q.level
            FROM flagged_questions fq
            LEFT JOIN question q ON fq.question_id = q.id
        `;

        const params = [];
        if (status) {
            query += ' WHERE fq.status = $1';
            params.push(status);
        }

        query += ' ORDER BY fq.created_at DESC';

        const result = await pool.query(query, params);

        res.json({
            success: true,
            flagged_questions: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error('❌ Error fetching flagged questions:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch flagged questions' });
    }
});

// GET /api/flagged/pending - Get only pending flagged questions (for teachers)
router.get('/pending', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                fq.*,
                q.question_text,
                q.answer_options,
                q.answer_key,
                q.topic_label,
                q.difficulty_level,
                q.paper_name,
                q.subject,
                q.level,
                q.sub_topic
            FROM flagged_questions fq
            LEFT JOIN question q ON fq.question_id = q.id
            WHERE fq.status = 'pending'
            ORDER BY fq.created_at DESC
        `);

        res.json({
            success: true,
            flagged_questions: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error('❌ Error fetching pending flagged questions:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch pending flagged questions' });
    }
});

// PUT /api/flagged/:id/resolve - Resolve a flagged question (for teachers)
router.put('/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reviewed_by, resolution_notes } = req.body;

        // Valid statuses
        const validStatuses = ['reviewed', 'resolved', 'dismissed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        const result = await pool.query(
            `UPDATE flagged_questions
            SET status = $1, reviewed_by = $2, reviewed_at = NOW(), resolution_notes = $3
            WHERE id = $4
            RETURNING *`,
            [status, reviewed_by, resolution_notes || null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Flagged question not found' });
        }

        res.json({
            success: true,
            message: `Question flag ${status}`,
            flag: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Error resolving flagged question:', error);
        res.status(500).json({ success: false, error: 'Failed to resolve flagged question' });
    }
});

// DELETE /api/flagged/:id - Delete a flag (for teachers)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM flagged_questions WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Flagged question not found' });
        }

        res.json({
            success: true,
            message: 'Flag deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting flag:', error);
        res.status(500).json({ success: false, error: 'Failed to delete flag' });
    }
});

// GET /api/flagged/stats - Get flag statistics (for teachers)
router.get('/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                status,
                COUNT(*) as count
            FROM flagged_questions
            GROUP BY status
        `);

        const stats = {
            pending: 0,
            reviewed: 0,
            resolved: 0,
            dismissed: 0,
            total: 0
        };

        result.rows.forEach(row => {
            stats[row.status] = parseInt(row.count);
            stats.total += parseInt(row.count);
        });

        res.json({ success: true, stats });

    } catch (error) {
        console.error('❌ Error fetching flag stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
    }
});

module.exports = router;
