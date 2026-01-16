const express = require("express");
const router = express.Router();
const { Pool } = require("pg");
const { decodeLatex } = require("../../utils/latexBase64");
const { dbConfig } = require("../../utils/db-config");

// Helper function to decode LaTeX in a question object
const decodeQuestionLatex = (question) => {
  if (!question) return question;

  const decoded = { ...question };

  if (decoded.question_text) {
    decoded.question_text = decodeLatex(decoded.question_text);
  }

  if (Array.isArray(decoded.answer_options)) {
    decoded.answer_options = decoded.answer_options.map(opt => {
      if (opt && typeof opt.text === 'string') {
        return { ...opt, text: decodeLatex(opt.text) };
      }
      return opt;
    });
  }

  if (decoded.answer_key && typeof decoded.answer_key === 'object') {
    if (decoded.answer_key.correct_answer) {
      decoded.answer_key = {
        ...decoded.answer_key,
        correct_answer: decodeLatex(decoded.answer_key.correct_answer)
      };
    }
  }

  return decoded;
};

const pool = new Pool(dbConfig);

// GET /api/folders/all
router.get("/folders/all", async (req, res) => {
  try {
    // Assuming your table is named 'quiz_folders'
    const client = await pool.connect();
    const result = await client.query(
      `SELECT *,
        COALESCE(array_length(question_ids, 1), 0) as question_count
       FROM quiz_folders
       ORDER BY created_at DESC`
    );
    client.release();
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

    // Step 2: Fetch question details (including topic_label and paper_name for teachers)
    const questionRes = await client.query(
      `SELECT id, question_text, answer_key, answer_options, image_paths, topic_label, paper_name
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
      // First decode LaTeX
      const decodedQuestion = decodeQuestionLatex(question);

      if (segmentedQuestionsParsed && segmentedQuestionsParsed[question.id]) {
        const segmentData = segmentedQuestionsParsed[question.id];
        console.log(`✅ Found segmented data for question ${question.id}`);
        return {
          ...decodedQuestion,
          question_number: questionIds.indexOf(question.id) + 1, // Add question number for ordering
          questionParts: segmentData.questionParts || segmentData.parts // Handle both possible property names
        };
      }
      console.log(`⚠️ No segmented data for question ${question.id}`);
      return {
        ...decodedQuestion,
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

// PUT /api/quiz/folders/:folderId/rename - Rename a quiz folder
router.put("/folders/:folderId/rename", async (req, res) => {
  const { folderId } = req.params;
  const { name } = req.body;
  console.log("✏️ Received request to rename folder ID:", folderId, "to:", name);

  if (!folderId) {
    return res.status(400).json({ error: "Folder ID is required" });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "New name is required" });
  }

  const folderIdInt = parseInt(folderId, 10);
  if (isNaN(folderIdInt)) {
    return res.status(400).json({ error: "Invalid folder ID format" });
  }

  const client = await pool.connect();

  try {
    // Update the folder name
    const updateRes = await client.query(
      `UPDATE quiz_folders
       SET name = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [name.trim(), folderIdInt]
    );

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: "Folder not found" });
    }

    console.log("✅ Folder renamed successfully:", updateRes.rows[0]);
    res.status(200).json({
      success: true,
      message: "Quiz folder renamed successfully",
      folder: updateRes.rows[0]
    });
  } catch (error) {
    console.error("❌ Error renaming folder:", error);
    res.status(500).json({
      error: "Failed to rename folder",
      details: error.message,
    });
  } finally {
    client.release();
  }
});

// DELETE /api/quiz/folders/:folderId - Delete a quiz folder
router.delete("/folders/:folderId", async (req, res) => {
  const { folderId } = req.params;
  console.log("🗑️ Received request to delete folder ID:", folderId);

  if (!folderId) {
    return res.status(400).json({ message: "❌ Folder ID is required" });
  }

  const folderIdInt = parseInt(folderId, 10);
  if (isNaN(folderIdInt)) {
    return res.status(400).json({ message: "❌ Invalid folder ID format" });
  }

  const client = await pool.connect();

  try {
    // First check if folder exists
    const checkRes = await client.query(
      `SELECT id FROM quiz_folders WHERE id = $1`,
      [folderIdInt]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: "❌ Folder not found" });
    }

    // Delete any quiz assignments associated with this folder
    await client.query(
      `DELETE FROM quiz_assignments WHERE quiz_id = $1`,
      [folderIdInt]
    );

    // Delete the folder
    const deleteRes = await client.query(
      `DELETE FROM quiz_folders WHERE id = $1 RETURNING *`,
      [folderIdInt]
    );

    console.log("✅ Folder deleted successfully:", deleteRes.rows[0]);
    res.status(200).json({
      success: true,
      message: "Quiz folder deleted successfully",
      deleted: deleteRes.rows[0]
    });
  } catch (error) {
    console.error("❌ Error deleting folder:", error);
    res.status(500).json({
      message: "Failed to delete folder",
      error: error.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;


