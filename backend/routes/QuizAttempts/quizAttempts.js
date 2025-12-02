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

// =====================================================
// START A NEW QUIZ ATTEMPT
// Called when student starts a quiz
// =====================================================
router.post("/start", async (req, res) => {
  try {
    const { student_id, quiz_id, assignment_id, mode = 'practice' } = req.body;

    if (!student_id || !quiz_id) {
      return res.status(400).json({
        success: false,
        error: "student_id and quiz_id are required"
      });
    }

    // Get quiz info to calculate max_score
    const quizResult = await pool.query(
      "SELECT question_ids FROM quiz_folders WHERE id = $1",
      [quiz_id]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Quiz not found"
      });
    }

    const questionCount = quizResult.rows[0].question_ids?.length || 0;

    // Create the attempt
    const result = await pool.query(
      `INSERT INTO quiz_attempts
        (student_id, quiz_id, assignment_id, mode, max_score, status, started_at)
       VALUES ($1, $2, $3, $4, $5, 'in_progress', NOW())
       RETURNING *`,
      [student_id, quiz_id, assignment_id || null, mode, questionCount]
    );

    const attempt = result.rows[0];

    console.log(`📝 Started quiz attempt ${attempt.id} for student ${student_id} on quiz ${quiz_id}`);

    res.json({
      success: true,
      attempt: {
        id: attempt.id,
        quiz_id: attempt.quiz_id,
        mode: attempt.mode,
        max_score: attempt.max_score,
        started_at: attempt.started_at
      }
    });

  } catch (error) {
    console.error("❌ Error starting quiz attempt:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start quiz attempt"
    });
  }
});

// =====================================================
// SUBMIT AN ANSWER
// Called when student answers a question
// =====================================================
router.post("/answer", async (req, res) => {
  try {
    const {
      attempt_id,
      question_id,
      student_answer,
      question_order,
      time_spent_seconds
    } = req.body;

    if (!attempt_id || !question_id) {
      return res.status(400).json({
        success: false,
        error: "attempt_id and question_id are required"
      });
    }

    // Get the correct answer for this question (snapshot it)
    const questionResult = await pool.query(
      "SELECT answer_key FROM question WHERE id = $1",
      [question_id]
    );

    if (questionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Question not found"
      });
    }

    // Parse the answer key
    let correctAnswer = '';
    try {
      const answerKey = typeof questionResult.rows[0].answer_key === 'string'
        ? JSON.parse(questionResult.rows[0].answer_key)
        : questionResult.rows[0].answer_key || {};
      correctAnswer = answerKey.correct_answer || '';
    } catch (e) {
      correctAnswer = '';
    }

    // Check if answer is correct
    const isCorrect = student_answer && correctAnswer &&
      student_answer.toUpperCase() === correctAnswer.toUpperCase();
    const pointsEarned = isCorrect ? 1 : 0;

    // Insert or update the answer (upsert)
    const result = await pool.query(
      `INSERT INTO quiz_attempt_answers
        (attempt_id, question_id, student_answer, correct_answer_snapshot,
         is_correct, points_earned, question_order, time_spent_seconds, answered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (attempt_id, question_id)
       DO UPDATE SET
         student_answer = EXCLUDED.student_answer,
         is_correct = EXCLUDED.is_correct,
         points_earned = EXCLUDED.points_earned,
         time_spent_seconds = EXCLUDED.time_spent_seconds,
         answered_at = NOW()
       RETURNING *`,
      [attempt_id, question_id, student_answer, correctAnswer,
       isCorrect, pointsEarned, question_order || null, time_spent_seconds || null]
    );

    res.json({
      success: true,
      answer: {
        id: result.rows[0].id,
        is_correct: isCorrect,
        points_earned: pointsEarned,
        correct_answer: correctAnswer // Only return this in practice mode or after quiz ends
      }
    });

  } catch (error) {
    console.error("❌ Error submitting answer:", error);
    res.status(500).json({
      success: false,
      error: "Failed to submit answer"
    });
  }
});

// =====================================================
// COMPLETE A QUIZ ATTEMPT
// Called when student finishes the quiz
// =====================================================
router.post("/complete", async (req, res) => {
  try {
    const { attempt_id, time_taken_seconds } = req.body;

    if (!attempt_id) {
      return res.status(400).json({
        success: false,
        error: "attempt_id is required"
      });
    }

    // Calculate total score from answers
    const scoreResult = await pool.query(
      `SELECT
        SUM(points_earned) as total_score,
        SUM(points_adjusted) as adjusted_score,
        COUNT(*) as answered_count
       FROM quiz_attempt_answers
       WHERE attempt_id = $1`,
      [attempt_id]
    );

    const totalScore = parseInt(scoreResult.rows[0].total_score) || 0;
    const adjustedScore = parseInt(scoreResult.rows[0].adjusted_score) || 0;

    // Update the attempt
    const result = await pool.query(
      `UPDATE quiz_attempts
       SET status = 'completed',
           completed_at = NOW(),
           total_score = $1,
           adjusted_score = $2,
           time_taken_seconds = $3
       WHERE id = $4
       RETURNING *`,
      [totalScore, adjustedScore, time_taken_seconds || null, attempt_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Attempt not found"
      });
    }

    const attempt = result.rows[0];
    const finalScore = totalScore + adjustedScore;
    const percentage = attempt.max_score > 0
      ? Math.round((finalScore / attempt.max_score) * 100)
      : 0;

    console.log(`✅ Completed quiz attempt ${attempt_id}: ${finalScore}/${attempt.max_score} (${percentage}%)`);

    res.json({
      success: true,
      result: {
        attempt_id: attempt.id,
        total_score: totalScore,
        adjusted_score: adjustedScore,
        final_score: finalScore,
        max_score: attempt.max_score,
        percentage,
        time_taken_seconds: attempt.time_taken_seconds,
        completed_at: attempt.completed_at
      }
    });

  } catch (error) {
    console.error("❌ Error completing quiz attempt:", error);
    res.status(500).json({
      success: false,
      error: "Failed to complete quiz attempt"
    });
  }
});

// =====================================================
// GET ATTEMPT DETAILS
// Get a specific attempt with all answers
// =====================================================
router.get("/:attemptId", async (req, res) => {
  try {
    const { attemptId } = req.params;

    // Get attempt info
    const attemptResult = await pool.query(
      `SELECT qa.*, qf.name as quiz_name, u.name as student_name
       FROM quiz_attempts qa
       JOIN quiz_folders qf ON qa.quiz_id = qf.id
       JOIN users u ON qa.student_id = u.id
       WHERE qa.id = $1`,
      [attemptId]
    );

    if (attemptResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Attempt not found"
      });
    }

    const attempt = attemptResult.rows[0];

    // Get all answers for this attempt
    const answersResult = await pool.query(
      `SELECT qaa.*, q.question_text, q.answer_options, q.topic_label
       FROM quiz_attempt_answers qaa
       JOIN question q ON qaa.question_id = q.id
       WHERE qaa.attempt_id = $1
       ORDER BY qaa.question_order, qaa.id`,
      [attemptId]
    );

    // Process answers
    const answers = answersResult.rows.map(row => {
      let options = [];
      try {
        options = typeof row.answer_options === 'string'
          ? JSON.parse(row.answer_options)
          : row.answer_options || [];
      } catch (e) {
        options = [];
      }

      return {
        id: row.id,
        question_id: row.question_id,
        question_text: row.question_text,
        answer_options: options,
        topic: row.topic_label,
        student_answer: row.student_answer,
        correct_answer: row.correct_answer_snapshot,
        is_correct: row.is_correct,
        points_earned: row.points_earned,
        points_adjusted: row.points_adjusted,
        adjustment_reason: row.adjustment_reason,
        time_spent_seconds: row.time_spent_seconds
      };
    });

    res.json({
      success: true,
      attempt: {
        id: attempt.id,
        quiz_id: attempt.quiz_id,
        quiz_name: attempt.quiz_name,
        student_id: attempt.student_id,
        student_name: attempt.student_name,
        mode: attempt.mode,
        status: attempt.status,
        total_score: attempt.total_score,
        adjusted_score: attempt.adjusted_score,
        final_score: (attempt.total_score || 0) + (attempt.adjusted_score || 0),
        max_score: attempt.max_score,
        percentage: attempt.max_score > 0
          ? Math.round(((attempt.total_score + attempt.adjusted_score) / attempt.max_score) * 100)
          : 0,
        started_at: attempt.started_at,
        completed_at: attempt.completed_at,
        time_taken_seconds: attempt.time_taken_seconds,
        answers
      }
    });

  } catch (error) {
    console.error("❌ Error fetching attempt:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch attempt"
    });
  }
});

// =====================================================
// GET STUDENT'S ATTEMPTS
// Get all attempts for a student (optionally filtered by quiz)
// =====================================================
router.get("/student/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const { quiz_id, status } = req.query;

    let query = `
      SELECT qa.*, qf.name as quiz_name, qf.topic as quiz_topic,
             (qa.total_score + qa.adjusted_score) as final_score,
             CASE WHEN qa.max_score > 0
                  THEN ROUND(((qa.total_score + qa.adjusted_score)::numeric / qa.max_score) * 100, 1)
                  ELSE 0
             END as percentage
      FROM quiz_attempts qa
      JOIN quiz_folders qf ON qa.quiz_id = qf.id
      WHERE qa.student_id = $1
    `;
    const params = [studentId];
    let paramIndex = 2;

    if (quiz_id) {
      query += ` AND qa.quiz_id = $${paramIndex}`;
      params.push(quiz_id);
      paramIndex++;
    }

    if (status) {
      query += ` AND qa.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY qa.started_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      attempts: result.rows
    });

  } catch (error) {
    console.error("❌ Error fetching student attempts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch attempts"
    });
  }
});

// =====================================================
// GET QUIZ LEADERBOARD
// Get top performers for a specific quiz
// =====================================================
router.get("/leaderboard/:quizId", async (req, res) => {
  try {
    const { quizId } = req.params;
    const { limit = 10 } = req.query;

    const result = await pool.query(
      `SELECT
        qa.student_id,
        u.name as student_name,
        (qa.total_score + qa.adjusted_score) as final_score,
        qa.max_score,
        CASE WHEN qa.max_score > 0
             THEN ROUND(((qa.total_score + qa.adjusted_score)::numeric / qa.max_score) * 100, 1)
             ELSE 0
        END as percentage,
        qa.time_taken_seconds,
        qa.completed_at,
        RANK() OVER (ORDER BY (qa.total_score + qa.adjusted_score) DESC, qa.time_taken_seconds ASC) as rank
       FROM quiz_attempts qa
       JOIN users u ON qa.student_id = u.id
       WHERE qa.quiz_id = $1 AND qa.status = 'completed'
       ORDER BY rank
       LIMIT $2`,
      [quizId, parseInt(limit)]
    );

    res.json({
      success: true,
      quiz_id: quizId,
      leaderboard: result.rows
    });

  } catch (error) {
    console.error("❌ Error fetching leaderboard:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch leaderboard"
    });
  }
});

// =====================================================
// ADJUST SCORE FOR A SPECIFIC ANSWER
// For teachers to manually adjust points
// =====================================================
router.put("/adjust-score", async (req, res) => {
  try {
    const { answer_id, points_adjusted, reason, adjusted_by } = req.body;

    if (!answer_id || points_adjusted === undefined) {
      return res.status(400).json({
        success: false,
        error: "answer_id and points_adjusted are required"
      });
    }

    // Update the answer
    const answerResult = await pool.query(
      `UPDATE quiz_attempt_answers
       SET points_adjusted = $1,
           adjustment_reason = $2,
           adjusted_by = $3,
           adjusted_at = NOW()
       WHERE id = $4
       RETURNING attempt_id`,
      [points_adjusted, reason || null, adjusted_by || null, answer_id]
    );

    if (answerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Answer not found"
      });
    }

    const attemptId = answerResult.rows[0].attempt_id;

    // Recalculate total adjusted score for the attempt
    const scoreResult = await pool.query(
      `SELECT SUM(points_adjusted) as total_adjusted
       FROM quiz_attempt_answers
       WHERE attempt_id = $1`,
      [attemptId]
    );

    const totalAdjusted = parseInt(scoreResult.rows[0].total_adjusted) || 0;

    // Update attempt's adjusted_score
    await pool.query(
      `UPDATE quiz_attempts SET adjusted_score = $1 WHERE id = $2`,
      [totalAdjusted, attemptId]
    );

    console.log(`✅ Adjusted score for answer ${answer_id}: +${points_adjusted} points`);

    res.json({
      success: true,
      message: "Score adjusted successfully",
      new_adjusted_total: totalAdjusted
    });

  } catch (error) {
    console.error("❌ Error adjusting score:", error);
    res.status(500).json({
      success: false,
      error: "Failed to adjust score"
    });
  }
});

// =====================================================
// BULK ADJUST SCORES FOR A QUESTION
// When a question's answer key is corrected
// =====================================================
router.post("/bulk-adjust", async (req, res) => {
  try {
    const { question_id, correct_answer, adjusted_by, reason } = req.body;

    if (!question_id || !correct_answer) {
      return res.status(400).json({
        success: false,
        error: "question_id and correct_answer are required"
      });
    }

    // Find all wrong answers that should now be correct
    const wrongAnswers = await pool.query(
      `SELECT qaa.id, qaa.attempt_id, qaa.student_answer, qa.student_id, u.name as student_name
       FROM quiz_attempt_answers qaa
       JOIN quiz_attempts qa ON qaa.attempt_id = qa.id
       JOIN users u ON qa.student_id = u.id
       WHERE qaa.question_id = $1
         AND UPPER(qaa.student_answer) = UPPER($2)
         AND qaa.is_correct = false
         AND qaa.points_adjusted = 0`,
      [question_id, correct_answer]
    );

    if (wrongAnswers.rows.length === 0) {
      return res.json({
        success: true,
        message: "No answers needed adjustment",
        adjusted_count: 0
      });
    }

    const adjustmentReason = reason || `Answer key corrected. Student answer "${correct_answer}" is now correct.`;

    // Update all affected answers
    const answerIds = wrongAnswers.rows.map(r => r.id);
    await pool.query(
      `UPDATE quiz_attempt_answers
       SET points_adjusted = 1,
           adjustment_reason = $1,
           adjusted_by = $2,
           adjusted_at = NOW()
       WHERE id = ANY($3)`,
      [adjustmentReason, adjusted_by || null, answerIds]
    );

    // Update adjusted_score for all affected attempts
    const attemptIds = [...new Set(wrongAnswers.rows.map(r => r.attempt_id))];
    for (const attemptId of attemptIds) {
      const scoreResult = await pool.query(
        `SELECT SUM(points_adjusted) as total FROM quiz_attempt_answers WHERE attempt_id = $1`,
        [attemptId]
      );
      await pool.query(
        `UPDATE quiz_attempts SET adjusted_score = $1 WHERE id = $2`,
        [parseInt(scoreResult.rows[0].total) || 0, attemptId]
      );
    }

    console.log(`✅ Bulk adjusted ${wrongAnswers.rows.length} answers for question ${question_id}`);

    res.json({
      success: true,
      message: `Adjusted ${wrongAnswers.rows.length} student answers`,
      adjusted_count: wrongAnswers.rows.length,
      affected_students: wrongAnswers.rows.map(r => ({
        student_id: r.student_id,
        student_name: r.student_name,
        original_answer: r.student_answer
      }))
    });

  } catch (error) {
    console.error("❌ Error bulk adjusting scores:", error);
    res.status(500).json({
      success: false,
      error: "Failed to bulk adjust scores"
    });
  }
});

// =====================================================
// GET STUDENT PERFORMANCE BY TOPIC
// Analytics for a student's performance across topics
// =====================================================
router.get("/analytics/topic-performance/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;

    const result = await pool.query(
      `SELECT
        t.id as topic_id,
        t.label as topic_name,
        l.display_name as level_name,
        s.display_name as subject_name,
        COUNT(qaa.id) as total_questions,
        SUM(CASE WHEN qaa.is_correct THEN 1 ELSE 0 END) as correct_answers,
        ROUND(
          (SUM(CASE WHEN qaa.is_correct THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(qaa.id), 0)) * 100,
          1
        ) as accuracy_percent
       FROM quiz_attempt_answers qaa
       JOIN quiz_attempts qa ON qaa.attempt_id = qa.id
       JOIN question q ON qaa.question_id = q.id
       LEFT JOIN topics t ON q.topic_id = t.id
       LEFT JOIN levels l ON t.level_id = l.id
       LEFT JOIN subjects s ON l.subject_id = s.id
       WHERE qa.student_id = $1 AND qa.status = 'completed'
       GROUP BY t.id, t.label, l.display_name, s.display_name
       ORDER BY accuracy_percent ASC`,
      [studentId]
    );

    res.json({
      success: true,
      student_id: studentId,
      topic_performance: result.rows
    });

  } catch (error) {
    console.error("❌ Error fetching topic performance:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch topic performance"
    });
  }
});

// =====================================================
// GET QUESTIONS NEEDING REVIEW
// Questions with high wrong rates or many flags
// =====================================================
router.get("/analytics/questions-review", async (req, res) => {
  try {
    const { min_attempts = 5, min_wrong_percent = 70 } = req.query;

    const result = await pool.query(
      `SELECT
        q.id as question_id,
        q.question_number,
        q.paper_name,
        q.topic_label,
        t.label as topic_name,
        COUNT(qaa.id) as total_attempts,
        SUM(CASE WHEN qaa.is_correct THEN 1 ELSE 0 END) as correct_count,
        SUM(CASE WHEN NOT qaa.is_correct THEN 1 ELSE 0 END) as wrong_count,
        ROUND(
          (SUM(CASE WHEN NOT qaa.is_correct THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(qaa.id), 0)) * 100,
          1
        ) as wrong_percentage,
        (SELECT COUNT(*) FROM flagged_questions fq WHERE fq.question_id = q.id AND fq.status = 'pending') as pending_flags
       FROM question q
       LEFT JOIN quiz_attempt_answers qaa ON q.id = qaa.question_id
       LEFT JOIN topics t ON q.topic_id = t.id
       GROUP BY q.id, t.label
       HAVING COUNT(qaa.id) >= $1
          AND (SUM(CASE WHEN NOT qaa.is_correct THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(qaa.id), 0)) * 100 >= $2
       ORDER BY wrong_percentage DESC, pending_flags DESC
       LIMIT 50`,
      [parseInt(min_attempts), parseInt(min_wrong_percent)]
    );

    res.json({
      success: true,
      questions_needing_review: result.rows
    });

  } catch (error) {
    console.error("❌ Error fetching questions for review:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch questions for review"
    });
  }
});

module.exports = router;
