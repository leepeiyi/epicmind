// backend/routes/favorites.js
//test
const express = require("express");
const router = express.Router();
const { Pool } = require("pg");
const { dbConfig } = require("../../utils/db-config");

const pool = new Pool(dbConfig);

// GET /api/favorites - Get all favorite topics for a user
// GET /api/favorites?user_id=1
router.get("/", async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    const favorites = await pool.query(
      `SELECT id, subject, banding, level, topic_label, array_length(question_ids, 1) AS question_count
       FROM user_favorites
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [user_id]
    );

    res.json({ success: true, favorites: favorites.rows });
  } catch (error) {
    console.error("❌ Error loading favorites list:", error);
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

router.get("/by-topic", async (req, res) => {
  try {
    const subject = (req.query.subject || "").trim();
    const banding = (req.query.banding || "").trim();
    const level = (req.query.level || "").trim();
    const topic_label = (req.query.topic_label || "").trim();
    const difficulty_level = (req.query.difficulty_level || "").trim();
    const paper_type = (req.query.paper_type || "").trim();
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Validate required parameters
    if (!subject || !banding || !level || !topic_label) {
      return res.status(400).json({
        error:
          "Missing required parameters: subject, banding, level, topic_label",
      });
    }

    // Build dynamic query
    let query = `
        SELECT 
          id,
          question_number,
          question_text,
          answer_options,
          image_paths,
          answer_key,
          paper_name,
          difficulty_level,
          sub_topic,
          paper_type,
          created_at
        FROM question 
        WHERE subject = $1 
          AND banding = $2 
          AND level = $3 
          AND topic_label = $4
      `;

    const queryParams = [subject, banding, level, topic_label];
    let paramIndex = 5;

    // Add optional filters
    if (difficulty_level) {
      query += ` AND difficulty_level = $${paramIndex}`;
      queryParams.push(difficulty_level);
      paramIndex++;
    }

    if (paper_type) {
      query += ` AND paper_type = $${paramIndex}`;
      queryParams.push(paper_type);
      paramIndex++;
    }

    // Add ordering and pagination
    query += ` ORDER BY paper_name, question_number`;

    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      queryParams.push(parseInt(limit));
      paramIndex++;
    }

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      queryParams.push(parseInt(offset));
    }

    // Execute the query
    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    const countQuery = `
        SELECT COUNT(*) as total
        FROM question 
        WHERE subject = $1 
          AND banding = $2 
          AND level = $3 
          AND topic_label = $4
          ${
            difficulty_level
              ? `AND difficulty_level = '${difficulty_level}'`
              : ""
          }
          ${paper_type ? `AND paper_type = '${paper_type}'` : ""}
      `;

    const countResult = await pool.query(countQuery, [
      subject,
      banding,
      level,
      topic_label,
    ]);
    const totalCount = parseInt(countResult.rows[0].total);

    // Process the questions (parse JSON fields)
    const questions = result.rows.map((row) => {
      // Parse answer_options
      let answerOptions = [];
      if (row.answer_options) {
        try {
          answerOptions =
            typeof row.answer_options === "string"
              ? JSON.parse(row.answer_options)
              : row.answer_options;
        } catch (e) {
          console.error("Error parsing answer_options:", e);
        }
      }

      // Parse image_paths
      let imagePaths = [];
      if (row.image_paths) {
        try {
          imagePaths =
            typeof row.image_paths === "string"
              ? JSON.parse(row.image_paths)
              : row.image_paths;
        } catch (e) {
          console.error("Error parsing image_paths:", e);
        }
      }

      // Parse answer_key
      let answerKey = null;
      if (row.answer_key) {
        try {
          answerKey =
            typeof row.answer_key === "string"
              ? JSON.parse(row.answer_key)
              : row.answer_key;
        } catch (e) {
          console.error("Error parsing answer_key:", e);
          answerKey = row.answer_key;
        }
      }

      return {
        id: row.id,
        question_number: row.question_number,
        question_text: row.question_text,
        answer_options: answerOptions,
        image_paths: imagePaths,
        answer_key: answerKey,
        paper_name: row.paper_name,
        difficulty_level: row.difficulty_level,
        sub_topic: row.sub_topic,
        paper_type: row.paper_type,
        created_at: row.created_at,
      };
    });

    res.json({
      success: true,
      questions: questions,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + questions.length < totalCount,
      },
      filters: {
        subject,
        banding,
        level,
        topic_label,
        difficulty_level,
        paper_type,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching questions by topic:", error);
    res.status(500).json({
      error: "Failed to fetch questions",
      details: error.message,
    });
  }
});
router.get("/favquiz/:favoriteId", async (req, res) => {
  const { favoriteId } = req.params;

  if (!favoriteId) {
    return res.status(400).json({ error: "Missing favoriteId" });
  }

  try {
    // Step 1: Get the favorite record
    const favRes = await pool.query(
      `SELECT * FROM user_favorites WHERE id = $1`,
      [favoriteId]
    );

    if (favRes.rows.length === 0) {
      return res.status(404).json({ error: "Favorite not found" });
    }

    const favorite = favRes.rows[0];
    let questions = [];

    // Step 2: Fetch question details
    if (favorite.question_ids && favorite.question_ids.length > 0) {
      const qRes = await pool.query(
        `SELECT * FROM question WHERE id = ANY($1) ORDER BY array_position($1::int[], id)`,
        [favorite.question_ids]
      );

      questions = qRes.rows.map((row) => {
        let options = [];
        try {
          options =
            typeof row.answer_options === "string"
              ? JSON.parse(row.answer_options)
              : row.answer_options;
        } catch (e) {}

        let answerKey = {};
        try {
          answerKey =
            typeof row.answer_key === "string"
              ? JSON.parse(row.answer_key)
              : row.answer_key;
        } catch (e) {}

        return {
          id: row.id,
          question_number: row.question_number,
          text: row.question_text,
          options,
          answer: answerKey.correct_answer || "",
          topic: row.topic_label,
          difficulty: row.difficulty_level || "Medium",
          image_url: Array.isArray(row.image_paths)
            ? row.image_paths[0]
            : row.image_paths,
          source: row.paper_type || "",
        };
      });
    }

    return res.json({
      favorite,
      questions,
    });
  } catch (err) {
    console.error("❌ Failed to fetch favorite:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/favorites/:id/questions - Get all questions for a favorite topic
router.get("/my-fav-topic", async (req, res) => {
  try {
    const { user_id, subject, banding, level, topic_label } = req.query;

    if (!user_id || !subject || !banding || !level || !topic_label) {
      return res.status(400).json({
        error:
          "Missing required query parameters: user_id, subject, banding, level, topic_label",
      });
    }

    const favoriteResult = await pool.query(
      `SELECT id, question_ids
       FROM user_favorites 
       WHERE user_id = $1 AND subject = $2 AND banding = $3 AND level = $4 AND topic_label = $5`,
      [user_id, subject, banding, level, topic_label]
    );

    if (favoriteResult.rows.length === 0) {
      return res.json({ success: true, questions: [] });
    }

    const favorite = favoriteResult.rows[0];
    const questionIds = favorite.question_ids || [];

    if (questionIds.length === 0) {
      return res.json({ success: true, questions: [] });
    }

    const questionsResult = await pool.query(
      `SELECT 
        id, 
        question_number, 
        question_text, 
        answer_options, 
        image_paths, 
        answer_key, 
        paper_name,
        difficulty_level,
        sub_topic
      FROM question 
      WHERE id = ANY($1::int[])
      ORDER BY array_position($1::int[], id)`,
      [questionIds]
    );

    res.json({
      success: true,
      questions: questionsResult.rows,
      favorite_id: favorite.id,
    });
  } catch (error) {
    console.error("❌ Error fetching my favorite topic questions:", error);
    res.status(500).json({ error: "Failed to fetch favorite questions" });
  }
});

// POST /api/favorites/add-question - Add a question to favorites
router.post("/add-question", async (req, res) => {
  try {
    let { user_id, question_id, subject, banding, level, topic_label } =
      req.body;

    // Parse and validate question_id
    question_id = parseInt(question_id);
    user_id = parseInt(user_id);

    if (
      !user_id ||
      isNaN(question_id) ||
      !subject ||
      !banding ||
      !level ||
      !topic_label
    ) {
      return res.status(400).json({
        error:
          "Missing or invalid fields: user_id, question_id, subject, banding, level, topic_label",
      });
    }

    // Check if the question exists
    const questionCheck = await pool.query(
      "SELECT id FROM question WHERE id = $1",
      [question_id]
    );

    if (questionCheck.rows.length === 0) {
      return res.status(404).json({ error: "Question not found" });
    }

    // Insert or update the favorite topic
    const result = await pool.query(
      `INSERT INTO user_favorites (user_id, subject, banding, level, topic_label, question_ids)
       VALUES ($1, $2, $3, $4, $5, ARRAY[$6::int])
       ON CONFLICT (user_id, subject, banding, level, topic_label)
       DO UPDATE SET 
         question_ids = CASE 
           WHEN $6 = ANY(user_favorites.question_ids) THEN user_favorites.question_ids
           ELSE array_append(user_favorites.question_ids, $6)
         END,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, question_ids`,
      [user_id, subject, banding, level, topic_label, question_id]
    );

    res.json({
      success: true,
      message: "Question added to favorites",
      favorite_id: result.rows[0].id,
      question_count: result.rows[0].question_ids.length,
    });
  } catch (error) {
    console.error("❌ Error adding question to favorites:", error);
    res.status(500).json({ error: "Failed to add question to favorites" });
  }
});

// DELETE /api/favorites/remove-question - Remove a question from favorites
router.delete("/remove-question", async (req, res) => {
  try {
    const userId = req.body.user_id;
    const { question_id, subject, banding, level, topic_label } = req.body;

    if (!question_id || !subject || !banding || !level || !topic_label) {
      return res.status(400).json({
        error:
          "Missing required fields: question_id, subject, banding, level, topic_label",
      });
    }

    // Remove the question from the favorites
    const result = await pool.query(
      `UPDATE user_favorites 
       SET question_ids = array_remove(question_ids, $6),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND subject = $2 AND banding = $3 AND level = $4 AND topic_label = $5
       RETURNING id, question_ids`,
      [userId, subject, banding, level, topic_label, question_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Favorite topic not found" });
    }

    // If no questions left, optionally delete the favorite topic
    const questionIds = result.rows[0].question_ids || [];
    if (questionIds.length === 0) {
      await pool.query(
        `DELETE FROM user_favorites 
         WHERE user_id = $1 AND subject = $2 AND banding = $3 AND level = $4 AND topic_label = $5`,
        [userId, subject, banding, level, topic_label]
      );
    }

    res.json({
      success: true,
      message: "Question removed from favorites",
      question_count: questionIds.length,
    });
  } catch (error) {
    console.error("❌ Error removing question from favorites:", error);
    res.status(500).json({ error: "Failed to remove question from favorites" });
  }
});

// DELETE /api/favorites/:id - Delete entire favorite topic
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const favoriteId = req.params.id;

    const result = await pool.query(
      `DELETE FROM user_favorites 
       WHERE id = $1 AND user_id = $2 
       RETURNING topic_label`,
      [favoriteId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Favorite topic not found" });
    }

    res.json({
      success: true,
      message: `Favorite topic "${result.rows[0].topic_label}" deleted successfully`,
    });
  } catch (error) {
    console.error("❌ Error deleting favorite topic:", error);
    res.status(500).json({ error: "Failed to delete favorite topic" });
  }
});

// GET /api/favorites/check-question - Check if a question is favorited
router.get("/check-question", async (req, res) => {
  try {
    const { user_id } = req.query;
    const { question_id, subject, banding, level, topic_label } = req.query;

    if (!question_id || !subject || !banding || !level || !topic_label) {
      return res.status(400).json({
        error: "Missing required query parameters",
      });
    }

    const result = await pool.query(
      `SELECT id FROM user_favorites 
       WHERE user_id = $1 
       AND subject = $2 
       AND banding = $3 
       AND level = $4 
       AND topic_label = $5 
       AND $6 = ANY(question_ids)`,
      [user_id, subject, banding, level, topic_label, parseInt(question_id)]
    );

    res.json({
      success: true,
      is_favorited: result.rows.length > 0,
    });
  } catch (error) {
    console.error("❌ Error checking favorite status:", error);
    res.status(500).json({ error: "Failed to check favorite status" });
  }
});

// GET /api/favorites/topics - Get available topics with question counts
router.get("/topics", async (req, res) => {
  try {
    const { subject, banding, level } = req.query;

    if (!subject || !banding || !level) {
      return res.status(400).json({
        error: "Missing required query parameters: subject, banding, level",
      });
    }

    // Get all available topics for the given criteria
    const result = await pool.query(
      `SELECT 
        topic_label, 
        COUNT(*) as total_questions
      FROM question 
      WHERE subject = $1 AND banding = $2 AND level = $3 
      AND topic_label IS NOT NULL 
      AND topic_label != ''
      GROUP BY topic_label
      ORDER BY topic_label`,
      [subject, banding, level]
    );

    // Get user's favorite topics for these criteria
    const favoritesResult = await pool.query(
      `SELECT topic_label, array_length(question_ids, 1) as favorite_count
       FROM user_favorites 
       WHERE user_id = $1 AND subject = $2 AND banding = $3 AND level = $4`,
      [req.user.id, subject, banding, level]
    );

    // Combine the data
    const favoritesMap = new Map();
    favoritesResult.rows.forEach((row) => {
      favoritesMap.set(row.topic_label, row.favorite_count || 0);
    });

    const topics = result.rows.map((row) => ({
      topic_label: row.topic_label,
      total_questions: parseInt(row.total_questions),
      favorite_count: favoritesMap.get(row.topic_label) || 0,
    }));

    res.json({
      success: true,
      topics: topics,
    });
  } catch (error) {
    console.error("❌ Error fetching topics:", error);
    res.status(500).json({ error: "Failed to fetch topics" });
  }
});

// Add this route to your backend (you can add it to favorites.js or create a new questions.js route file)

// GET /api/questions/by-topic - Get questions filtered by topic criteria

module.exports = router;
