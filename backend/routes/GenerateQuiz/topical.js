const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
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

// Test database connection
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("Database connection error:", err);
  } else {
    console.log(
      "Database connected successfully. Server time:",
      res.rows[0].now
    );
  }
});

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Generate a quiz using Gemini AI
function normalizeQuestion(row) {
  const isPreformatted = !!row.text && !row.question_text;

  if (isPreformatted) {
    return {
      id: row.id,
      text: row.text,
      options: row.options || [],
      difficulty: row.difficulty || "Medium",
      topic: row.topic,
      subtopic: row.subtopic || "",
      source: row.source || "Topical Exercise",
      answer: row.answer || "",
      has_image: !!row.image_url,
      image_path: row.image_url ? [row.image_url] : [],
    };
  } else {
    let options = [];
    try {
      options =
        typeof row.answer_options === "string"
          ? JSON.parse(row.answer_options)
          : row.answer_options || [];
    } catch (e) {}

    let answerKey = {};
    try {
      answerKey =
        typeof row.answer_key === "string"
          ? JSON.parse(row.answer_key)
          : row.answer_key || {};
    } catch (e) {}

    return {
      id: row.id,
      text: row.question_text,
      options,
      difficulty: row.difficulty_level || "Medium",
      topic: row.topic_label,
      subtopic: row.sub_topic || "",
      source:
        row.paper_type === "past_year"
          ? "Past Year"
          : row.paper_type || "Topical Exercise",
      answer: answerKey.correct_answer || "",
      has_image: Array.isArray(row.image_paths) && row.image_paths.length > 0,
      image_path: row.image_paths,
    };
  }
}

router.post("/generate", async (req, res) => {
  try {
    const {
      subject,
      banding,
      level,
      topic,
      subTopic,
      difficultyLevel,
      questionCount,
      includePastYears,
      includeTopical,
      yearFrom,
      yearTo,
      includeQuestions = [], // ✅ now using full question objects
    } = req.body;

    if (!subject || !banding || !level || !topic || !questionCount) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
      });
    }

    // Step 1: Query additional candidates
    let query = `
      SELECT 
        q.id, 
        q.question_text, 
        q.question_number,
        q.answer_options, 
        q.answer_key, 
        q.topic_label, 
        q.sub_topic,
        q.difficulty_level,
        q.paper_type,
        q.image_paths
      FROM question q
      WHERE q.subject = $1 
        AND q.banding = $2 
        AND q.level = $3 
        AND q.topic_label LIKE $4
    `;

    const queryParams = [subject, banding, level, `%${topic}%`];
    let paramIndex = 5;

    if (subTopic) {
      query += ` AND q.sub_topic = $${paramIndex}`;
      queryParams.push(subTopic);
      paramIndex++;
    }

    if (difficultyLevel) {
      query += ` AND q.difficulty_level = $${paramIndex}`;
      queryParams.push(difficultyLevel);
      paramIndex++;
    }

    const maxCandidates = Math.min(questionCount * 3, 50);
    query += ` LIMIT $${paramIndex}`;
    queryParams.push(maxCandidates);

    const result = await pool.query(query, queryParams);
    let candidateQuestions = result.rows;
    console.log("includedQuestions:", includeQuestions);

    // ✅ Merge includeQuestions (full objects)
    if (includeQuestions.length > 0) {
      const existingIds = new Set(candidateQuestions.map((q) => q.id));
      includeQuestions.forEach((q) => {
        if (!existingIds.has(q.id)) {
          candidateQuestions.unshift(q);
        }
      });
    }

    if (candidateQuestions.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No questions found matching the criteria",
      });
    }

    // ✅ Format all candidates
    candidateQuestions = candidateQuestions.map(normalizeQuestion);

    console.log(`Formatted ${candidateQuestions.length} candidate questions`);
    console.log("Sample formatted question:", candidateQuestions[0]);
    const requiredQuestionIds = new Set(includeQuestions.map(q => q.id));


    // Step 2: Use Gemini to select the final question set
    const promptContext = `
You are an expert educational quiz generator specializing in ${subject} for secondary school students. 
I need you to create a balanced, effective quiz from a pool of candidate questions.

QUIZ REQUIREMENTS:
- Subject: ${subject}
- Academic Level: ${level}
- Topic: ${topic}
${subTopic ? `- Sub-topic: ${subTopic}` : ""}
- Total Questions Needed: ${questionCount}

${
  difficultyLevel
    ? `- Difficulty: All questions should be ${difficultyLevel} level`
    : `- Difficulty Distribution: Create a balanced quiz with approximately:
      * 30% Easy questions
      * 40% Medium questions  
      * 30% Hard questions`
}

CANDIDATE QUESTION POOL:
${JSON.stringify(candidateQuestions, null, 2)}

YOUR TASK:
1. You **must** include the following question IDs in the quiz: [${[...requiredQuestionIds].join(", ")}]
2. Then, select the remaining questions (if needed) to reach exactly ${questionCount} total.
3. If no difficulty was specified, ensure a balanced distribution across difficulty levels.
4. Choose questions that cover different aspects of the topic for comprehensive assessment.
5. Prioritize questions with clear wording and pedagogical value.
6. Include a mix of question formats (multiple choice, short answer) if available.
7. Include some questions with diagrams/images if available.


RESPONSE FORMAT:
Respond only with a JSON array of the selected question IDs in your recommended order.
`;

    const geminiResponse = await model.generateContent(promptContext);
    const responseText = geminiResponse.response.text();
    const selectedIdsMatch = responseText.match(/\[.*\]/s);
    if (!selectedIdsMatch) throw new Error("Failed to parse Gemini response");

    let selectedIds;
    try {
      selectedIds = JSON.parse(selectedIdsMatch[0]);
    } catch (error) {
      console.error("Error parsing Gemini response:", error, responseText);
      throw new Error("Invalid response format from Gemini");
    }

    selectedIds = selectedIds.slice(0, questionCount);

    // Step 3: Assemble final list
    const selectedQuestions = [];
    for (const id of selectedIds) {
      const q = candidateQuestions.find((q) => q.id === id);
      if (q) {
        selectedQuestions.push({
          id: q.id,
          text: q.text,
          options: q.options,
          image_url: Array.isArray(q.image_path)
            ? q.image_path[0]
            : q.image_path,
          topic: q.topic,
          difficulty: q.difficulty,
          source: q.source,
          answer: q.answer,
        });
      }
    }
    console.log("Selected questions:", selectedQuestions);

    // Fill if Gemini returns fewer than requested
    if (selectedQuestions.length < questionCount) {
      const needed = questionCount - selectedQuestions.length;
      const selectedSet = new Set(selectedQuestions.map((q) => q.id));
      const extras = candidateQuestions
        .filter((q) => !selectedSet.has(q.id))
        .slice(0, needed);

      for (const q of extras) {
        selectedQuestions.push({
          id: q.id,
          text: q.text,
          options: q.options,
          image_url: Array.isArray(q.image_path)
            ? q.image_path[0]
            : q.image_path,
          topic: q.topic,
          difficulty: q.difficulty,
          source: q.source,
          answer: q.answer,
        });
      }
    }

    return res.json({
      success: true,
      questions: selectedQuestions,
    });
  } catch (error) {
    console.error("Error generating quiz with Gemini:", error);
    return res.status(500).json({
      success: false,
      error: "Server error: " + error.message,
    });
  }
});

// Save a generated quiz with question_ids array
router.post("/save", async (req, res) => {
  try {
    const {
      quizName,
      subject,
      banding,
      level,
      topic,
      questions,
      teacher_id, // 👈 added field
    } = req.body;

    // Validation
    if (
      !quizName ||
      !subject ||
      !questions ||
      !questions.length ||
      !teacher_id
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
      });
    }

    // Extract question IDs from the questions array
    const questionIds = questions.map((q) => q.id);

    // Insert quiz with the teacher_id
    const quizInsertResult = await pool.query(
      `INSERT INTO quiz_folders (
                name, 
                subject, 
                banding, 
                level, 
                topic,
                question_ids,
                teacher_id, -- 👈 added column
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
      [quizName, subject, banding, level, topic, questionIds, teacher_id] // 👈 added value
    );

    const quizId = quizInsertResult.rows[0].id;

    return res.json({
      success: true,
      quizId,
      message: "Quiz saved successfully",
    });
  } catch (error) {
    console.error("❌ Error saving quiz:", error);
    return res.status(500).json({
      success: false,
      error: "Server error: " + error.message,
    });
  }
});

// Get a quiz with all its questions
router.get("/:quizId", async (req, res) => {
  try {
    const { quizId } = req.params;

    // Get the quiz details using pool
    const quizResult = await pool.query(
      "SELECT * FROM quiz_folders WHERE id = $1",
      [quizId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Quiz not found",
      });
    }

    const quiz = quizResult.rows[0];

    // If there are no question IDs, return just the quiz info
    if (!quiz.question_ids || quiz.question_ids.length === 0) {
      return res.json({
        success: true,
        quiz: {
          ...quiz,
          questions: [],
        },
      });
    }

    // Get all questions associated with this quiz using pool
    const questionsResult = await pool.query(
      "SELECT * FROM question WHERE id = ANY($1) ORDER BY array_position($1, id)",
      [quiz.question_ids]
    );

    // Process the questions (parse JSON fields, etc.)
    const questions = questionsResult.rows.map((row) => {
      // Process answer options if they exist
      let options = [];
      if (row.answer_options) {
        if (typeof row.answer_options === "string") {
          try {
            options = JSON.parse(row.answer_options);
          } catch (e) {
            console.error("Error parsing answer options:", e);
          }
        } else {
          options = row.answer_options;
        }
      }

      // Process answer key
      let answerKey = {};
      if (row.answer_key) {
        if (typeof row.answer_key === "string") {
          try {
            answerKey = JSON.parse(row.answer_key);
          } catch (e) {
            console.error("Error parsing answer key:", e);
          }
        } else {
          answerKey = row.answer_key;
        }
      }

      return {
        id: row.id,
        text: row.question_text,
        options: options,
        image_url: Array.isArray(row.image_path)
          ? row.image_path[0]
          : row.image_path,
        topic: row.topic_label,
        difficulty: row.difficulty_level || "Medium",
        source:
          row.source_type === "past_year"
            ? `Past Year ${row.source_year}`
            : "Topical Exercise",
        answer: answerKey.correct_answer || "",
      };
    });

    return res.json({
      success: true,
      quiz: {
        ...quiz,
        questions,
      },
    });
  } catch (error) {
    console.error("Error retrieving quiz:", error);
    return res.status(500).json({
      success: false,
      error: "Server error: " + error.message,
    });
  }
});

// Get all quizzes (basic info, no questions)
router.get("/", async (req, res) => {
  try {
    const { subject, level } = req.query;

    let query =
      "SELECT id, name, subject, level, topic, created_at FROM quiz_folders";
    const queryParams = [];

    // Add filters if provided
    if (subject || level) {
      query += " WHERE";

      if (subject) {
        query += " subject = $1";
        queryParams.push(subject);
      }

      if (subject && level) {
        query += " AND";
      }

      if (level) {
        query += ` level = $${queryParams.length + 1}`;
        queryParams.push(level);
      }
    }

    // Order by creation date, newest first
    query += " ORDER BY created_at DESC";

    // Execute query using pool
    const result = await pool.query(query, queryParams);

    return res.json({
      success: true,
      quizzes: result.rows,
    });
  } catch (error) {
    console.error("Error retrieving quizzes:", error);
    return res.status(500).json({
      success: false,
      error: "Server error: " + error.message,
    });
  }
});

// Handle database connection errors
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

module.exports = router;
