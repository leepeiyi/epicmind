// Add this to your existing backend/routes/question.js file (or create a new route file)

const express = require("express");
const router = express.Router();
const { Pool } = require("pg");

// Create a PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: {
    require: true,
    rejectUnauthorized: false,
  },
});

// Add these routes to your existing backend/routes/paper.js file

// Route to get only exam papers
router.get("/exam-papers", async (req, res) => {
  try {
    const query = `
            SELECT 
                q.paper_name,
                q.subject,
                q.banding,
                q.level,
                q.paper_type,
                MAX(q.created_at) AS last_uploaded,
                MAX(q.year) AS year,
                COUNT(*) AS question_count
            FROM question q
            WHERE q.paper_type = 'exam'
            GROUP BY q.paper_name, q.subject, q.banding, q.level, q.paper_type
            ORDER BY last_uploaded DESC
        `;

    const result = await pool.query(query);

    res.json({
      success: true,
      papers: result.rows,
    });
  } catch (error) {
    console.error("❌ Error fetching exam papers:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch exam papers",
    });
  }
});

router.get("/by-topic/:topicLabel", async (req, res) => {
  const { topicLabel } = req.params;
  const { topic_id } = req.query; // Optional: use topic_id for more precise queries

  try {
    // If topic_id is provided, use it for faster lookup
    // Otherwise fall back to topic_label text matching
    const query = topic_id ? `
      SELECT
        q.id,
        q.question_number,
        q.question_text,
        q.topic_label,
        q.topic_id,
        q.paper_name,
        q.paper_type,
        q.difficulty_level,
        q.sub_topic,
        q.image_paths,
        q.answer_options,
        q.answer_key,
        t.label as topic_name,
        t.hashtag as topic_hashtag
      FROM question q
      LEFT JOIN topics t ON q.topic_id = t.id
      WHERE q.topic_id = $1
      ORDER BY
        CASE WHEN q.paper_type = 'exam' THEN 1 ELSE 2 END,
        q.question_number ASC
    ` : `
      SELECT
        q.id,
        q.question_number,
        q.question_text,
        q.topic_label,
        q.topic_id,
        q.paper_name,
        q.paper_type,
        q.difficulty_level,
        q.sub_topic,
        q.image_paths,
        q.answer_options,
        q.answer_key,
        t.label as topic_name,
        t.hashtag as topic_hashtag
      FROM question q
      LEFT JOIN topics t ON q.topic_id = t.id
      WHERE q.topic_label = $1
      ORDER BY
        CASE WHEN q.paper_type = 'exam' THEN 1 ELSE 2 END,
        q.question_number ASC
    `;

    const result = await pool.query(query, [topic_id || topicLabel]);

    const questions = result.rows.map((row) => {
      let answer_options = [];
      let answer_key = {};

      try {
        answer_options =
          typeof row.answer_options === "string"
            ? JSON.parse(row.answer_options)
            : row.answer_options || [];
      } catch {
        answer_options = [];
      }

      try {
        answer_key =
          typeof row.answer_key === "string"
            ? JSON.parse(row.answer_key)
            : row.answer_key || {};
      } catch {
        answer_key = {};
      }

      return {
        id: row.id,
        question_number: row.question_number,
        question_text: row.question_text,
        topic_label: row.topic_label,
        paper_name: row.paper_name,
        paper_type: row.paper_type,
        difficulty_level: row.difficulty_level,
        sub_topic: row.sub_topic,
        image_paths: row.image_paths,
        answer_options,
        answer_key,
      };
    });

    res.json({
      success: true,
      questions,
      count: questions.length,
    });
  } catch (error) {
    console.error("❌ Error fetching questions by topic:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch questions by topic",
    });
  }
});

// Route to get all unique topics for filtering/search
router.get("/topics", async (req, res) => {
  try {
    const { subject, level, banding } = req.query;

    let query = `
            SELECT DISTINCT topic_label
            FROM question q
            LEFT JOIN paper p ON q.paper_name = p.paper_name
            WHERE topic_label IS NOT NULL AND topic_label != ''
        `;

    const params = [];
    let paramIndex = 1;

    if (subject) {
      query += ` AND q.subject = ${paramIndex}`;
      params.push(subject);
      paramIndex++;
    }

    if (level) {
      query += ` AND q.level = ${paramIndex}`;
      params.push(level);
      paramIndex++;
    }

    if (banding) {
      query += ` AND q.banding = ${paramIndex}`;
      params.push(banding);
      paramIndex++;
    }

    query += ` ORDER BY topic_label ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      topics: result.rows.map((row) => row.topic_label),
    });
  } catch (error) {
    console.error("❌ Error fetching topics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch topics",
    });
  }
});

// Route to get question statistics by topic
router.get("/topic-stats/:topicLabel", async (req, res) => {
  try {
    const { topicLabel } = req.params;

    const query = `
            SELECT 
                q.paper_type,
                q.difficulty_level,
                COUNT(*) as count
            FROM question q
            WHERE q.topic_label = $1
            GROUP BY q.paper_type, q.difficulty_level
            ORDER BY q.paper_type, q.difficulty_level
        `;

    const result = await pool.query(query, [topicLabel]);

    // Organize the stats
    const stats = {
      total: 0,
      by_type: {
        exam: 0,
        topical: 0,
      },
      by_difficulty: {
        Easy: 0,
        Medium: 0,
        Hard: 0,
      },
    };

    result.rows.forEach((row) => {
      const count = parseInt(row.count);
      stats.total += count;

      if (row.paper_type) {
        stats.by_type[row.paper_type] =
          (stats.by_type[row.paper_type] || 0) + count;
      }

      if (row.difficulty_level) {
        stats.by_difficulty[row.difficulty_level] =
          (stats.by_difficulty[row.difficulty_level] || 0) + count;
      }
    });

    res.json({
      success: true,
      topic: topicLabel,
      stats: stats,
    });
  } catch (error) {
    console.error("❌ Error fetching topic stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch topic statistics",
    });
  }
});

module.exports = router;
