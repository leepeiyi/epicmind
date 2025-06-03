const express = require("express");
const router = express.Router();
const { Pool } = require("pg");

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

// GET /api/folders/all
router.get("/folders/all", async (req, res) => {
  try {
    // Assuming your table is named 'quiz_folders'
    const client = await pool.connect();
    const result = await client.query(
      "SELECT * FROM quiz_folders ORDER BY created_at DESC"
    );
    res.json({ folders: result.rows });
  } catch (error) {
    console.error("Error fetching folders:", error);
    res.status(500).json({ error: "Failed to fetch folders" });
  }
});

// GET /api/folders/filter
router.get("/folders/filter", async (req, res) => {
  try {
    const { subject, level, banding } = req.query;
    const client = await pool.connect();
    let query = "SELECT * FROM quiz_folders WHERE 1=1";
    const params = [];

    if (subject) {
      params.push(subject);
      query += ` AND subject = $${params.length}`;
    }
    if (level) {
      params.push(level);
      query += ` AND level = $${params.length}`;
    }
    if (banding) {
      params.push(banding);
      query += ` AND banding = $${params.length}`;
    }

    query += " ORDER BY created_at DESC";
    const result = await client.query(query, params);
    res.json({ folders: result.rows });
  } catch (error) {
    console.error("Error fetching filtered folders:", error);
    res.status(500).json({ error: "Failed to fetch folders" });
  }
});

router.get("/folders/getQuestionsByFolderId", async (req, res) => {
  const { folderId } = req.query;
  console.log("📥 Received request for folder ID:", folderId);

  if (!folderId) {
    return res.status(400).json({ message: "❌ Folder ID is required" });
  }

  const folderIdInt = parseInt(folderId, 10);
  if (isNaN(folderIdInt)) {
    return res.status(400).json({ message: "❌ Invalid folder ID format" });
  }

  const client = await pool.connect();

  try {
    // Step 1: Fetch question_ids from folder
    const folderRes = await client.query(
      `SELECT question_ids FROM quiz_folders WHERE id = $1`,
      [folderIdInt]
    );

    if (folderRes.rows.length === 0) {
      return res.status(404).json({ message: "❌ Folder not found" });
    }

    const questionIds = folderRes.rows[0].question_ids;
    console.log("✅ Question IDs:", questionIds);

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(200).json([]); // Return empty list if no questions
    }

    // Step 2: Fetch question details
    const questionRes = await client.query(
      `SELECT id, question_text, answer_key, answer_options, image_paths
       FROM question
       WHERE id = ANY($1::int[])`,
      [questionIds]
    );

    res.status(200).json(questionRes.rows);
  } catch (error) {
    console.error("❌ Error retrieving questions:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;


