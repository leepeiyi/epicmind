const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
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
  if (decoded.text) {
    decoded.text = decodeLatex(decoded.text);
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

// Create a PostgreSQL connection pool
const pool = new Pool(dbConfig);

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

// Initialize Gemini API - Switch to Flash-Lite for better availability (less overloaded)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

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
      selectedSubTopics = [], // New array for multiple sub-topics
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

    const queryParams = [subject, banding, level, `%${topic.label}%`];
    let paramIndex = 5;

    // Handle multiple sub-topics
    if (selectedSubTopics && selectedSubTopics.length > 0) {
      // Check if sub_topic JSON array contains ANY of the selected sub-topics
      const subTopicConditions = selectedSubTopics.map((_, i) => {
        return `q.sub_topic::jsonb @> $${paramIndex + i}::jsonb`;
      });
      query += ` AND (${subTopicConditions.join(' OR ')})`;
      
      selectedSubTopics.forEach(st => {
        queryParams.push(JSON.stringify([st]));
        paramIndex++;
      });
    } else if (subTopic) {
      // Backward compatibility: single sub-topic
      query += ` AND q.sub_topic::jsonb @> $${paramIndex}::jsonb`;
      queryParams.push(JSON.stringify([subTopic]));
      paramIndex++;
    }

    if (difficultyLevel) {
      query += ` AND q.difficulty_level = $${paramIndex}`;
      queryParams.push(difficultyLevel);
      paramIndex++;
    }

    // ✅ Increase candidate pool to ensure enough options
    const maxCandidates = Math.max(questionCount * 5, 100); // Increased multiplier
    query += ` LIMIT $${paramIndex}`;
    queryParams.push(maxCandidates);

    const result = await pool.query(query, queryParams);
    // Decode LaTeX in fetched questions
    let candidateQuestions = result.rows.map(decodeQuestionLatex);
    console.log(`Found ${candidateQuestions.length} database questions`);
    console.log("includeQuestions:", includeQuestions);

    // ✅ Merge includeQuestions (full objects) - prioritize them
    if (includeQuestions.length > 0) {
      const existingIds = new Set(candidateQuestions.map((q) => q.id));
      includeQuestions.forEach((q) => {
        if (!existingIds.has(q.id)) {
          candidateQuestions.unshift(q); // Add to beginning for priority
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
    const requiredQuestionIds = new Set(includeQuestions.map((q) => q.id));
    const requiredCount = requiredQuestionIds.size;
    const additionalNeeded = Math.max(0, questionCount - requiredCount);

    console.log(
      `Required questions: ${requiredCount}, Additional needed: ${additionalNeeded}`
    );

    // ✅ If we have enough required questions, just return them
    if (requiredCount >= questionCount) {
      const selectedQuestions = candidateQuestions
        .filter((q) => requiredQuestionIds.has(q.id))
        .slice(0, questionCount)
        .map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options,
          image_url: Array.isArray(q.image_path)
            ? q.image_path[0]
            : q.image_path,
          topic: q.topic.label,
          difficulty: q.difficulty,
          source: q.source,
          answer: q.answer,
        }));

      return res.json({
        success: true,
        questions: selectedQuestions,
      });
    }

    // ✅ Get non-required candidates for Gemini to choose from
    const nonRequiredCandidates = candidateQuestions.filter(
      (q) => !requiredQuestionIds.has(q.id)
    );

    console.log(`Non-required candidates: ${nonRequiredCandidates.length}`);

    // ✅ If we don't have enough additional candidates, use what we have
    if (nonRequiredCandidates.length === 0) {
      console.log(
        "No additional candidates available, using only required questions"
      );
      const selectedQuestions = candidateQuestions
        .filter((q) => requiredQuestionIds.has(q.id))
        .map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options,
          image_url: Array.isArray(q.image_path)
            ? q.image_path[0]
            : q.image_path,
          topic: q.topic.label,
          difficulty: q.difficulty,
          source: q.source,
          answer: q.answer,
        }));

      return res.json({
        success: true,
        questions: selectedQuestions,
      });
    }
    console.log(topic)

    // Step 2: Use Gemini to select additional questions
    const promptContext = `
You are an expert educational quiz generator specializing in ${subject} for secondary school students.

CONTEXT:
- I already have ${requiredCount} required questions that MUST be included in the final quiz
- I need you to select exactly ${additionalNeeded} additional questions from the candidate pool below
- Total final quiz size will be: ${questionCount} questions

QUIZ REQUIREMENTS:
- Subject: ${subject}
- Academic Level: ${level}
- Topic: ${topic.label}
${subTopic ? `- Sub-topic: ${subTopic}` : ""}

${
  difficultyLevel
    ? `- Difficulty: All questions should be ${difficultyLevel} level`
    : `- Difficulty Distribution: Select questions to create a balanced difficulty distribution:
      * ~30% Easy questions
      * ~40% Medium questions  
      * ~30% Hard questions`
}

CANDIDATE QUESTIONS TO CHOOSE FROM:
${JSON.stringify(nonRequiredCandidates, null, 2)}

YOUR TASK:
Select EXACTLY ${additionalNeeded} question IDs from the candidate pool above.

SELECTION CRITERIA:
1. Choose questions that complement the required questions already in the quiz
2. Ensure good coverage of different aspects of the topic
3. Maintain balanced difficulty distribution (if no specific difficulty was requested)
4. Prioritize questions with clear wording and pedagogical value
5. Include a mix of question formats if available
6. Include questions with diagrams/images if available and relevant

RESPONSE FORMAT:
Respond with ONLY a JSON array of exactly ${additionalNeeded} question IDs.
Example: [123, 456, 789]

Do not include any other text, explanations, or formatting.
`;

    let selectedAdditionalIds = [];

    if (additionalNeeded > 0) {
      const geminiResponse = await model.generateContent(promptContext);
      const responseText = geminiResponse.response.text();
      console.log("Gemini response:", responseText);

      const selectedIdsMatch = responseText.match(/\[.*\]/s);
      if (!selectedIdsMatch) {
        console.log(
          "Failed to parse Gemini response, using fallback selection"
        );
        // Fallback: select first N available candidates
        selectedAdditionalIds = nonRequiredCandidates
          .slice(0, additionalNeeded)
          .map((q) => q.id);
      } else {
        try {
          let parsed = JSON.parse(selectedIdsMatch[0]);
          selectedAdditionalIds = parsed.slice(0, additionalNeeded);
        } catch (error) {
          console.error("Error parsing Gemini response:", error);
          // Fallback: select first N available candidates
          selectedAdditionalIds = nonRequiredCandidates
            .slice(0, additionalNeeded)
            .map((q) => q.id);
        }
      }
    }

    // Step 3: Combine required and selected additional questions
    const finalQuestionIds = [
      ...Array.from(requiredQuestionIds),
      ...selectedAdditionalIds,
    ];

    console.log(`Final question IDs: ${finalQuestionIds}`);

    // Step 4: Assemble final question list
    const selectedQuestions = [];
    for (const id of finalQuestionIds) {
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

    // ✅ Fallback: if we still don't have enough, add more from candidates
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

    console.log(`Final selected questions: ${selectedQuestions.length}`);

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
      segmented_questions, // 👈 pre-segmented questions data
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

    // Normalize and validate field lengths to prevent VARCHAR overflow
    const normalizedQuizName = String(quizName || '').substring(0, 255);
    const normalizedSubject = String(subject || '').substring(0, 255);
    const normalizedBanding = String(banding || '').substring(0, 50);
    const normalizedLevel = String(level || '').substring(0, 50);

    // Handle topic - if it's an object, extract the label property
    let normalizedTopic = topic;
    if (typeof topic === 'object' && topic !== null) {
      normalizedTopic = topic.label || JSON.stringify(topic);
    }
    normalizedTopic = String(normalizedTopic || '').substring(0, 255);

    // Segmented questions should be stored as JSONB, but we'll stringify for now
    // and ensure it's within reasonable limits
    const segmentedQuestionsJson = segmented_questions ? JSON.stringify(segmented_questions) : null;

    // Log field lengths for debugging
    console.log(`📝 Field lengths - Name: ${normalizedQuizName.length}, Subject: ${normalizedSubject.length}, Topic: ${normalizedTopic.length}, Segmented: ${segmentedQuestionsJson?.length || 0}`);

    if (segmentedQuestionsJson && segmentedQuestionsJson.length > 255) {
      console.warn(`⚠️ Segmented questions JSON is ${segmentedQuestionsJson.length} chars - may need TEXT column type`);
    }

    // Insert quiz with the teacher_id and segmented questions
    const quizInsertResult = await pool.query(
      `INSERT INTO quiz_folders (
                name,
                subject,
                banding,
                level,
                topic,
                question_ids,
                teacher_id,
                segmented_questions,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id`,
      [normalizedQuizName, normalizedSubject, normalizedBanding, normalizedLevel, normalizedTopic, questionIds, teacher_id, segmentedQuestionsJson]
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

// Update a single question (for teachers to fix errors)
router.put("/question/:questionId", async (req, res) => {
  try {
    const { questionId } = req.params;
    const {
      question_text,
      answer_options,
      answer_key,
      topic_label,
      difficulty_level,
      sub_topic,
      teacher_id // For audit trail
    } = req.body;

    // Validate required fields
    if (!questionId) {
      return res.status(400).json({
        success: false,
        error: "Question ID is required"
      });
    }

    // Check if question exists
    const existingQuestion = await pool.query(
      "SELECT * FROM question WHERE id = $1",
      [questionId]
    );

    if (existingQuestion.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Question not found"
      });
    }

    // Build dynamic update query based on provided fields
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (question_text !== undefined) {
      updates.push(`question_text = $${paramIndex}`);
      values.push(question_text);
      paramIndex++;
    }

    if (answer_options !== undefined) {
      updates.push(`answer_options = $${paramIndex}`);
      // Ensure it's stored as JSONB
      values.push(typeof answer_options === 'string' ? answer_options : JSON.stringify(answer_options));
      paramIndex++;
    }

    if (answer_key !== undefined) {
      updates.push(`answer_key = $${paramIndex}`);
      // Ensure it's stored as JSONB
      values.push(typeof answer_key === 'string' ? answer_key : JSON.stringify(answer_key));
      paramIndex++;
    }

    if (topic_label !== undefined) {
      updates.push(`topic_label = $${paramIndex}`);
      values.push(topic_label);
      paramIndex++;

      // Also try to match topic_id from topics table
      // This helps keep topic_id in sync when topic_label changes
      const topicMatch = await pool.query(
        `SELECT id FROM topics WHERE label = $1 OR hashtag ILIKE $2 LIMIT 1`,
        [topic_label, `%${topic_label}%`]
      );
      if (topicMatch.rows.length > 0) {
        updates.push(`topic_id = $${paramIndex}`);
        values.push(topicMatch.rows[0].id);
        paramIndex++;
      }
    }

    if (difficulty_level !== undefined) {
      updates.push(`difficulty_level = $${paramIndex}`);
      values.push(difficulty_level);
      paramIndex++;
    }

    if (sub_topic !== undefined) {
      updates.push(`sub_topic = $${paramIndex}`);
      values.push(typeof sub_topic === 'string' ? sub_topic : JSON.stringify(sub_topic));
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No fields to update"
      });
    }

    // Add question ID as last parameter
    values.push(questionId);

    const updateQuery = `
      UPDATE question
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    console.log(`📝 Updating question ${questionId} by teacher ${teacher_id || 'unknown'}`);

    const result = await pool.query(updateQuery, values);
    const updatedQuestion = result.rows[0];

    // Process the returned question for response
    let options = [];
    if (updatedQuestion.answer_options) {
      try {
        options = typeof updatedQuestion.answer_options === 'string'
          ? JSON.parse(updatedQuestion.answer_options)
          : updatedQuestion.answer_options;
      } catch (e) {
        options = [];
      }
    }

    let answerKey = {};
    if (updatedQuestion.answer_key) {
      try {
        answerKey = typeof updatedQuestion.answer_key === 'string'
          ? JSON.parse(updatedQuestion.answer_key)
          : updatedQuestion.answer_key;
      } catch (e) {
        answerKey = {};
      }
    }

    return res.json({
      success: true,
      message: "Question updated successfully",
      question: {
        id: updatedQuestion.id,
        text: updatedQuestion.question_text,
        options: options,
        answer: answerKey.correct_answer || '',
        topic: updatedQuestion.topic_label,
        difficulty: updatedQuestion.difficulty_level,
        sub_topic: updatedQuestion.sub_topic
      }
    });

  } catch (error) {
    console.error("❌ Error updating question:", error);
    return res.status(500).json({
      success: false,
      error: "Server error: " + error.message
    });
  }
});

// Get a single question by ID (for editing)
router.get("/question/:questionId", async (req, res) => {
  try {
    const { questionId } = req.params;

    const result = await pool.query(
      "SELECT * FROM question WHERE id = $1",
      [questionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Question not found"
      });
    }

    // Decode LaTeX in question
    const row = decodeQuestionLatex(result.rows[0]);

    // Process answer options
    let options = [];
    if (row.answer_options) {
      try {
        options = typeof row.answer_options === 'string'
          ? JSON.parse(row.answer_options)
          : row.answer_options;
      } catch (e) {
        options = [];
      }
    }

    // Process answer key
    let answerKey = {};
    if (row.answer_key) {
      try {
        answerKey = typeof row.answer_key === 'string'
          ? JSON.parse(row.answer_key)
          : row.answer_key;
      } catch (e) {
        answerKey = {};
      }
    }

    return res.json({
      success: true,
      question: {
        id: row.id,
        question_text: row.question_text,
        answer_options: options,
        answer_key: answerKey,
        topic_label: row.topic_label,
        difficulty_level: row.difficulty_level,
        sub_topic: row.sub_topic,
        image_paths: row.image_paths,
        paper_name: row.paper_name,
        subject: row.subject,
        level: row.level,
        banding: row.banding
      }
    });

  } catch (error) {
    console.error("❌ Error fetching question:", error);
    return res.status(500).json({
      success: false,
      error: "Server error: " + error.message
    });
  }
});

// Handle database connection errors
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

// Update a question's correct answer
router.put("/question/:id/update-answer", async (req, res) => {
  try {
    const { id } = req.params;
    const { correct_answer } = req.body;

    if (!correct_answer) {
      return res.status(400).json({
        success: false,
        error: "correct_answer is required"
      });
    }

    // Get the current answer_key
    const current = await pool.query(
      "SELECT answer_key FROM question WHERE id = $1",
      [id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Question not found"
      });
    }

    // Parse current answer_key or create new one
    let answerKey = {};
    try {
      answerKey = typeof current.rows[0].answer_key === "string"
        ? JSON.parse(current.rows[0].answer_key)
        : current.rows[0].answer_key || {};
    } catch (e) {
      answerKey = {};
    }

    // Update the correct_answer
    answerKey.correct_answer = correct_answer;

    // Save back to database
    const result = await pool.query(
      "UPDATE question SET answer_key = $1 WHERE id = $2 RETURNING *",
      [JSON.stringify(answerKey), id]
    );

    console.log(`✅ Updated answer for question ${id} to: ${correct_answer}`);

    res.json({
      success: true,
      message: "Answer updated successfully",
      question: result.rows[0]
    });

  } catch (error) {
    console.error("❌ Error updating answer:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update answer"
    });
  }
});

module.exports = router;
