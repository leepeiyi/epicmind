
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

router.post("/setup-vetting-columns", async (req, res) => {
  const client = await pool.connect();

  try {
    console.log("🔧 Setting up vetting columns...");

    // Begin transaction
    await client.query("BEGIN");

    const operations = [];

    // Check and add difficulty_level column
    try {
      const difficultyCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'question' 
        AND column_name = 'difficulty_level'
      `);

      if (difficultyCheck.rows.length === 0) {
        await client.query(`
          ALTER TABLE question 
          ADD COLUMN difficulty_level TEXT DEFAULT 'Medium'
        `);
        operations.push("✅ Added difficulty_level column");
        console.log("✅ Added difficulty_level column");
      } else {
        operations.push("⚠️ difficulty_level column already exists");
        console.log("⚠️ difficulty_level column already exists");
      }
    } catch (err) {
      console.error("❌ Error adding difficulty_level column:", err.message);
      operations.push(`❌ Error adding difficulty_level: ${err.message}`);
    }

    // Check and add sub_topic column
    try {
      const subTopicCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'question' 
        AND column_name = 'sub_topic'
      `);

      if (subTopicCheck.rows.length === 0) {
        await client.query(`
          ALTER TABLE question 
          ADD COLUMN sub_topic TEXT
        `);
        operations.push("✅ Added sub_topic column");
        console.log("✅ Added sub_topic column");
      } else {
        operations.push("⚠️ sub_topic column already exists");
        console.log("⚠️ sub_topic column already exists");
      }
    } catch (err) {
      console.error("❌ Error adding sub_topic column:", err.message);
      operations.push(`❌ Error adding sub_topic: ${err.message}`);
    }

    // Check and add vetted column
    try {
      const vettedCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'question' 
        AND column_name = 'vetted'
      `);

      if (vettedCheck.rows.length === 0) {
        await client.query(`
          ALTER TABLE question 
          ADD COLUMN vetted BOOLEAN DEFAULT FALSE
        `);
        operations.push("✅ Added vetted column");
        console.log("✅ Added vetted column");
      } else {
        operations.push("⚠️ vetted column already exists");
        console.log("⚠️ vetted column already exists");
      }
    } catch (err) {
      console.error("❌ Error adding vetted column:", err.message);
      operations.push(`❌ Error adding vetted: ${err.message}`);
    }

    // Update existing records to have default difficulty
    try {
      const updateResult = await client.query(`
        UPDATE question 
        SET difficulty_level = 'Medium' 
        WHERE difficulty_level IS NULL
      `);
      operations.push(
        `✅ Updated ${updateResult.rowCount} questions with default difficulty`
      );
      console.log(
        `✅ Updated ${updateResult.rowCount} questions with default difficulty`
      );
    } catch (err) {
      console.error("❌ Error updating default difficulty:", err.message);
      operations.push(`❌ Error updating defaults: ${err.message}`);
    }

    // Commit transaction
    await client.query("COMMIT");

    console.log("🎉 Database setup completed successfully!");

    res.json({
      success: true,
      message: "Database setup completed successfully!",
      operations: operations,
    });
  } catch (err) {
    // Rollback transaction on error
    await client.query("ROLLBACK");
    console.error("❌ Database setup failed:", err.message);
    res.status(500).json({
      success: false,
      error: "Database setup failed: " + err.message,
    });
  } finally {
    client.release();
  }
});

// UPDATE question metadata (difficulty and sub_topics) for tutor vetting
router.post("/update-question-metadata", async (req, res) => {
  const { paper_name, questions } = req.body;

  if (!paper_name || !questions || !Array.isArray(questions)) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: paper_name and questions array",
    });
  }

  const client = await pool.connect();

  try {
    // Begin transaction
    await client.query("BEGIN");

    let updated_count = 0;

    for (const question_update of questions) {
      const { question_number, difficulty, sub_topics } = question_update;

      if (!question_number) {
        console.warn("⚠️ Skipping question update - missing question_number");
        continue;
      }

      // Set default difficulty if not provided
      const final_difficulty = difficulty || "Medium";

      // Convert sub_topics to JSON string for storage
      const sub_topics_json =
        sub_topics && Array.isArray(sub_topics)
          ? JSON.stringify(sub_topics)
          : null;

      // Update the question with difficulty and sub_topics
      const updateResult = await client.query(
        `UPDATE question 
         SET difficulty_level = $1, 
             sub_topic = $2
         WHERE paper_name = $3 AND question_number = $4`,
        [final_difficulty, sub_topics_json, paper_name, question_number]
      );

      if (updateResult.rowCount > 0) {
        updated_count++;
        console.log(
          `✅ Updated Q${question_number}: difficulty=${final_difficulty}, sub_topics=${JSON.stringify(
            sub_topics
          )}`
        );
      } else {
        console.warn(
          `⚠️ No question found for paper=${paper_name}, question_number=${question_number}`
        );
      }
    }

    // Mark paper as vetted after updating questions (if you have a vetted column)
    try {
      await client.query(
        `UPDATE question 
         SET vetted = true 
         WHERE paper_name = $1`,
        [paper_name]
      );
    } catch (vettedError) {
      console.warn(
        "⚠️ Could not mark paper as vetted (vetted column might not exist):",
        vettedError.message
      );
    }

    // Commit transaction
    await client.query("COMMIT");

    console.log(
      `✅ Updated ${updated_count} questions for paper: ${paper_name}`
    );

    res.json({
      success: true,
      message: `Successfully updated ${updated_count} questions and marked paper as vetted`,
      updated_count: updated_count,
      paper_name: paper_name,
    });
  } catch (err) {
    // Rollback transaction on error
    await client.query("ROLLBACK");
    console.error("❌ Error updating question metadata:", err.message);
    res.status(500).json({
      success: false,
      error: `Failed to update question metadata: ${err.message}`,
    });
  } finally {
    client.release();
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

      // Extract question_text - IMPROVED VERSION FOR MULTI-PART QUESTIONS
      let question_text = null;

      // For your format, we need to extract everything between the header and **Answer:**
      // This includes all the (a), (b), (c) parts

      const lines = block.split("\n");
      const questionStartIndex = lines.findIndex((line) =>
        line.match(/^### Q\d+/)
      );

      if (questionStartIndex !== -1) {
        let questionEndIndex = lines.length;

        // Find the **Answer:** line to know where to stop
        for (let i = questionStartIndex + 1; i < lines.length; i++) {
          const line = lines[i].trim();

          // Stop at the answer section
          if (line.match(/^\*\*Answer:\s*/)) {
            questionEndIndex = i;
            break;
          }

          // Also stop at images if they appear before answers
          if (line.match(/^!\[.*?\]/)) {
            // Check if this image is part of the question or separate
            // If there are more content lines after, it might be part of the question
            let hasMoreContent = false;
            for (let j = i + 1; j < lines.length; j++) {
              const nextLine = lines[j].trim();
              if (
                nextLine &&
                !nextLine.match(/^\*\*Answer:\s*/) &&
                !nextLine.match(/^!\[.*?\]/)
              ) {
                hasMoreContent = true;
                break;
              }
              if (nextLine.match(/^\*\*Answer:\s*/)) {
                break;
              }
            }
            if (!hasMoreContent) {
              questionEndIndex = i;
              break;
            }
          }

          // Stop at multiple choice options (- **A**, - **B**, etc.)
          if (line.match(/^- \*\*[A-D]\*\*/)) {
            questionEndIndex = i;
            break;
          }
        }

        // Extract all content between header and answer/options
        const questionLines = lines.slice(
          questionStartIndex + 1,
          questionEndIndex
        );

        // Clean up the question text
        question_text = questionLines
          .join("\n")
          .trim()
          .replace(/^\n+|\n+$/g, "") // Remove leading/trailing newlines
          .replace(/\n{3,}/g, "\n\n"); // Reduce multiple newlines to double newlines

        // Remove any trailing empty lines or extra whitespace
        question_text = question_text.replace(/\s+$/, "");
      }

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
      if (
        existingAnswerQuery.rows.length > 0 &&
        existingAnswerQuery.rows[0].answer_key
      ) {
        answerKey = existingAnswerQuery.rows[0].answer_key;
      }

      // Now try to find an answer in the markdown - improved for your format
      const answerMatch = block.match(
        /\*\*Answer:\s*([\s\S]+?)(?=\n\n\*\*---\*\*|\n---|\n\*\*###|$)/
      );
      if (answerMatch) {
        let answerText = answerMatch[1].trim();

        // Remove leading and trailing ** if present
        answerText = answerText.replace(/^\*\*\s*/, "").replace(/\s*\*\*$/, "");

        // Create a new answer key object
        answerKey = {
          question_number,
          correct_answer: answerText,
        };
      }

      // Debug logging (remove in production)
      console.log(`Question ${question_number}:`);
      console.log(`Extracted question text: "${question_text}"`);
      console.log(`Answer options count: ${answerOptions.length}`);
      console.log(`Image paths count: ${imagePaths.length}`);
      console.log("---");

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
