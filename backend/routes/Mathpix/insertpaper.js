// routes/paperRoutes.js or similar
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

// GET recent 3 papers based on latest inserted question timestamp
router.get("/recent", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT paper_name, MAX(created_at) as last_uploaded,
       MAX(topic_label) as topic_label,
       MAX(paper_type) as paper_type
      FROM question
      GROUP BY paper_name
      ORDER BY last_uploaded DESC
      LIMIT 3;
    `);
    client.release();
    res.json({ recent: result.rows });
  } catch (err) {
    console.error("❌ Failed to fetch recent papers:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/all-papers", async (req, res) => {
  try {
    const client = await pool.connect();

    const result = await client.query(`
      SELECT 
        paper_name,
        MAX(created_at) AS last_uploaded,
        MAX(topic_label) AS topic_label,
        MAX(paper_type) AS paper_type
      FROM question
      GROUP BY paper_name
      ORDER BY last_uploaded DESC;
    `);

    client.release();
    res.json({ papers: result.rows });
  } catch (err) {
    console.error("❌ Failed to fetch all papers:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});


// GET questions by paper_name
router.get("/questions/:paper_name", async (req, res) => {
  const { paper_name } = req.params;
  try {
    const client = await pool.connect();
    const result = await client.query(
      "SELECT * FROM question WHERE paper_name = $1 ORDER BY question_number ASC",
      [paper_name]
    );
    client.release();
    res.json({ questions: result.rows });
  } catch (err) {
    console.error("❌ Failed to fetch questions:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/update-question-details", async (req, res) => {
  const { paper_name, content } = req.body;
  if (!paper_name || !content) {
    return res.status(400).json({ error: "Missing paper_name or content" });
  }
  
  const client = await pool.connect();
  
  try {
    const questionBlocks = content.split(/\n---+\n/); // Separate by markdown divider
    const updates = [];
    
    for (const block of questionBlocks) {
      const matchQNum = block.match(/^### Q(\d+)/m);
      if (!matchQNum) continue;
      
      const question_number = matchQNum[1];
      
      // Extract question_text
      const questionTextMatch = block.match(
        /### Q\d+ \(Topic\)\n\n([\s\S]*?)\n\n(-|\!|\*\*|$)/
      );
      const question_text = questionTextMatch
        ? questionTextMatch[1].trim()
        : null;
      
      // Extract answer options
      const answerOptions = [];
      const optionRegex = /- \*\*(A|B|C|D)\*\* (.*)/g;
      let match;
      while ((match = optionRegex.exec(block)) !== null) {
        answerOptions.push({ option: match[1], text: match[2] });
      }
      
      // Extract image paths
      const imagePaths = [];
      const imageRegex = /!\[.*?\]\((.*?)\)/g;
      while ((match = imageRegex.exec(block)) !== null) {
        imagePaths.push(match[1]);
      }
      
      // Extract answer key (if exists) - IMPROVED VERSION
      let answerKey = null;
      // First, get the existing answer key from the database
      const existingAnswerQuery = await client.query(
        `SELECT answer_key FROM question WHERE paper_name = $1 AND question_number = $2`,
        [paper_name, question_number]
      );
      
      // Use existing answer_key as a default
      if (existingAnswerQuery.rows.length > 0 && existingAnswerQuery.rows[0].answer_key) {
        answerKey = existingAnswerQuery.rows[0].answer_key;
      }
      
      // Now try to find an answer in the markdown - improved regex that matches more formats
      const answerMatch = block.match(/\*\*Answer:\*\* ([\s\S]+?)(?=\n\n|\n$|$)/);
      if (answerMatch) {
        const answerText = answerMatch[1].trim();
        // Create a new answer key object
        answerKey = { 
          question_number, 
          correct_answer: answerText 
        };
      }
      
      updates.push(
        client.query(
          `UPDATE question 
           SET question_text = $1,
               answer_options = $2,
               image_paths = $3,
               answer_key = $4
           WHERE paper_name = $5 AND question_number = $6`,
          [
            question_text,
            JSON.stringify(answerOptions),
            JSON.stringify(imagePaths),
            answerKey ? JSON.stringify(answerKey) : null,
            paper_name,
            question_number,
          ]
        )
      );
    }
    
    await Promise.all(updates);
    res.json({ message: "✅ All questions updated successfully" });
  } catch (err) {
    console.error("❌ Update error:", err.message);
    res.status(500).json({ error: "Update failed: " + err.message });
  } finally {
    client.release();
  }
});

// In your Express backend
router.get("/exists/:paper_name", async (req, res) => {
  const { paper_name } = req.params;
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT 1 FROM question WHERE paper_name = $1 LIMIT 1",
      [paper_name]
    );
    res.json({ exists: result.rowCount > 0 });
  } catch (err) {
    console.error("❌ DB check error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/update-question-numbers", async (req, res) => {
  const { paper_name, questions } = req.body;
  if (!paper_name || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: "Missing paper_name or questions" });
  }

  const client = await pool.connect();

  try {
    // Begin transaction
    await client.query("BEGIN");

    for (const question of questions) {
      await client.query(
        `UPDATE question 
         SET question_number = $1
         WHERE paper_name = $2 AND id = $3`,
        [question.question_number, paper_name, question.id]
      );
    }

    // Commit transaction
    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Question numbers updated successfully",
    });
  } catch (err) {
    // Rollback transaction on error
    await client.query("ROLLBACK");
    console.error("❌ Update question numbers error:", err.message);
    res
      .status(500)
      .json({ error: "Failed to update question numbers: " + err.message });
  } finally {
    client.release();
  }
});

//logs 
router.get("/logs/:paper_name", async (req, res) => {
  const { paper_name } = req.params;
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM logs WHERE paper_name = $1 ORDER BY timestamp DESC`,
      [paper_name]
    );
    res.json({ logs: result.rows });
  } catch (err) {
    console.error("❌ Failed to fetch logs:", err.message);
    res.status(500).json({ error: "Failed to fetch logs" });
  } finally {
    client.release();
  }
});




module.exports = router;
