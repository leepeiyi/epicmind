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
    // Step 1: Fetch question_ids and segmented_questions from folder
    const folderRes = await client.query(
      `SELECT question_ids, segmented_questions FROM quiz_folders WHERE id = $1`,
      [folderIdInt]
    );

    if (folderRes.rows.length === 0) {
      return res.status(404).json({ message: "❌ Folder not found" });
    }

    const questionIds = folderRes.rows[0].question_ids;
    const segmentedQuestions = folderRes.rows[0].segmented_questions;
    console.log("✅ Question IDs:", questionIds);
    console.log("✅ Has segmented questions:", !!segmentedQuestions);

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

    // Step 3: Merge segmented data if available
    let segmentedQuestionsParsed = null;
    if (segmentedQuestions) {
      try {
        // Parse if it's a string
        segmentedQuestionsParsed = typeof segmentedQuestions === 'string' 
          ? JSON.parse(segmentedQuestions) 
          : segmentedQuestions;
      } catch (e) {
        console.error('Failed to parse segmented questions:', e);
      }
    }
    
    const questionsWithSegments = questionRes.rows.map(question => {
      if (segmentedQuestionsParsed && segmentedQuestionsParsed[question.id]) {
        const segmentData = segmentedQuestionsParsed[question.id];
        console.log(`✅ Found segmented data for question ${question.id}`);
        return {
          ...question,
          question_number: questionIds.indexOf(question.id) + 1, // Add question number for ordering
          questionParts: segmentData.questionParts || segmentData.parts // Handle both possible property names
        };
      }
      console.log(`⚠️ No segmented data for question ${question.id}`);
      return {
        ...question,
        question_number: questionIds.indexOf(question.id) + 1 // Add question number for ordering
      };
    });

    // Sort questions by their order in questionIds array
    const sortedQuestions = questionsWithSegments.sort((a, b) => {
      return questionIds.indexOf(a.id) - questionIds.indexOf(b.id);
    });
    
    res.status(200).json(sortedQuestions);
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


// POST /api/folders/saveSegmentedQuestions
router.post("/folders/saveSegmentedQuestions", async (req, res) => {
  const { folderId, segmentedQuestions } = req.body;
  console.log("💾 Saving segmented questions for folder:", folderId);

  if (!folderId || !segmentedQuestions) {
    return res.status(400).json({ 
      message: "❌ Folder ID and segmented questions are required" 
    });
  }

  const client = await pool.connect();

  try {
    // Update the segmented_questions column in quiz_folders
    const updateRes = await client.query(
      `UPDATE quiz_folders 
       SET segmented_questions = $1, updated_at = NOW() 
       WHERE id = $2`,
      [JSON.stringify(segmentedQuestions), folderId]
    );

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ message: "❌ Folder not found" });
    }

    console.log("✅ Segmented questions saved successfully");
    res.status(200).json({ 
      success: true, 
      message: "Segmented questions saved successfully" 
    });
  } catch (error) {
    console.error("❌ Error saving segmented questions:", error);
    res.status(500).json({
      message: "Failed to save segmented questions",
      error: error.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;


