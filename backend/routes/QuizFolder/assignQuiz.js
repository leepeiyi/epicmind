// routes/QuizFolder/quizAssignments.js

require("dotenv").config();
const express = require("express");
const router = express.Router();
const { Pool } = require("pg");
const verifyToken = require("../../middleware/verify-token"); // Adjust path if needed

// Database connection pool for better performance
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

//======================================================
// TEACHER-STUDENT RELATIONSHIP ENDPOINTS
//======================================================

// 1. Get all students for a teacher
// Route: /api/quiz/teacher/:teacherId/students

router.get("/students/all", verifyToken, async (req, res) => {
  try {
    // Only teachers or admins can view all students
    if (req.user.role !== "teacher" && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Not authorized to view all students" });
    }

    // Get all students from the system
    const result = await pool.query(`
        SELECT id, name, email 
        FROM users 
        WHERE role = 'student'
        ORDER BY name
      `);

    res.json({ students: result.rows });
  } catch (err) {
    console.error("❌ Error fetching all students:", err);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});
router.get("/teacher/:teacherId/students", verifyToken, async (req, res) => {
  try {
    const teacherId = req.params.teacherId;

    // Verify that the authenticated user is the teacher or an admin
    if (req.user.id !== parseInt(teacherId) && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Not authorized to access these students" });
    }

    // Query to get students using the join table
    const result = await pool.query(
      `
      SELECT u.id, u.name, u.email 
      FROM users u
      JOIN teacher_student_relations tsr ON u.id = tsr.student_id
      WHERE tsr.teacher_id = $1 AND u.role = 'student'
      ORDER BY u.name
    `,
      [teacherId]
    );

    res.json({ students: result.rows });
  } catch (err) {
    console.error("❌ Error fetching students:", err);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

// 2. Get all students who are NOT yet associated with this teacher
// Route: /api/quiz/teacher/:teacherId/available-students
router.get(
  "/teacher/:teacherId/available-students",
  verifyToken,
  async (req, res) => {
    try {
      const teacherId = req.params.teacherId;

      // Verify that the authenticated user is the teacher or an admin
      if (req.user.id !== parseInt(teacherId) && req.user.role !== "admin") {
        return res
          .status(403)
          .json({ error: "Not authorized to access these students" });
      }

      // Query to get students not linked to this teacher
      const result = await pool.query(
        `
      SELECT id, name, email 
      FROM users 
      WHERE role = 'student' 
      AND id NOT IN (
        SELECT student_id 
        FROM teacher_student_relations 
        WHERE teacher_id = $1
      )
      ORDER BY name
    `,
        [teacherId]
      );

      res.json({ availableStudents: result.rows });
    } catch (err) {
      console.error("❌ Error fetching available students:", err);
      res.status(500).json({ error: "Failed to fetch available students" });
    }
  }
);

// 3. Add multiple students to a teacher (batch link)
// Route: /api/quiz/teacher/:teacherId/students
router.post("/teacher/:teacherId/students", verifyToken, async (req, res) => {
  // Start a transaction
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const teacherId = req.params.teacherId;
    const { student_ids } = req.body; // Array of student IDs to link

    // Verify that the authenticated user is the teacher or an admin
    if (req.user.id !== parseInt(teacherId) && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Not authorized to manage students" });
    }

    if (
      !student_ids ||
      !Array.isArray(student_ids) ||
      student_ids.length === 0
    ) {
      return res.status(400).json({ error: "Invalid student_ids provided" });
    }

    // Prepare values for batch insert
    const insertValues = student_ids
      .map((_, index) => `($1, $${index + 2})`)
      .join(", ");

    const insertParams = [teacherId, ...student_ids];

    await client.query(
      `
      INSERT INTO teacher_student_relations (teacher_id, student_id)
      VALUES ${insertValues}
      ON CONFLICT (teacher_id, student_id) 
      DO NOTHING
    `,
      insertParams
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: `${student_ids.length} students assigned to teacher successfully`,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error assigning students to teacher:", err);
    res.status(500).json({ error: "Failed to assign students to teacher" });
  } finally {
    client.release();
  }
});

// 4. Add a single student to a teacher (single link)
// Route: /api/quiz/teacher/:teacherId/students/:studentId
router.post(
  "/teacher/:teacherId/students/:studentId",
  verifyToken,
  async (req, res) => {
    try {
      const { teacherId, studentId } = req.params;

      // Verify that the authenticated user is the teacher or an admin
      if (req.user.id !== parseInt(teacherId) && req.user.role !== "admin") {
        return res
          .status(403)
          .json({ error: "Not authorized to manage students" });
      }

      // Check if the student exists and is actually a student
      const studentCheck = await pool.query(
        "SELECT id FROM users WHERE id = $1 AND role = 'student'",
        [studentId]
      );

      if (studentCheck.rows.length === 0) {
        return res.status(404).json({ error: "Student not found" });
      }

      // Link the student to this teacher
      await pool.query(
        "INSERT INTO teacher_student_relations (teacher_id, student_id) VALUES ($1, $2) ON CONFLICT (teacher_id, student_id) DO NOTHING",
        [teacherId, studentId]
      );

      res.json({
        success: true,
        message: "Student linked to teacher successfully",
      });
    } catch (err) {
      console.error("❌ Error linking student to teacher:", err);
      res.status(500).json({ error: "Failed to link student to teacher" });
    }
  }
);

// 5. Remove a student from a teacher
// Route: /api/quiz/teacher/:teacherId/students/:studentId
router.delete(
  "/teacher/:teacherId/students/:studentId",
  verifyToken,
  async (req, res) => {
    try {
      const { teacherId, studentId } = req.params;

      // Verify that the authenticated user is the teacher or an admin
      if (req.user.id !== parseInt(teacherId) && req.user.role !== "admin") {
        return res
          .status(403)
          .json({ error: "Not authorized to manage students" });
      }

      // Remove the association
      const result = await pool.query(
        "DELETE FROM teacher_student_relations WHERE teacher_id = $1 AND student_id = $2 RETURNING *",
        [teacherId, studentId]
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Student not found or not linked to this teacher" });
      }

      res.json({
        success: true,
        message: "Student unlinked from teacher successfully",
      });
    } catch (err) {
      console.error("❌ Error unlinking student from teacher:", err);
      res.status(500).json({ error: "Failed to unlink student from teacher" });
    }
  }
);

//======================================================
// QUIZ ASSIGNMENT ENDPOINTS
//======================================================

// 6. Get assignments for a quiz
// Route: /api/quiz/:quizId/assignments
router.get("/:quizId/assignments", verifyToken, async (req, res) => {
  try {
    const quizId = req.params.quizId;

    // Verify permissions - teacher should own the quiz or student should be assigned to it
    if (req.user.role === "teacher") {
      // Check if teacher owns the quiz
      const quizOwnerCheck = await pool.query(
        "SELECT teacher_id FROM quiz_folders WHERE id = $1",
        [quizId]
      );

      if (
        quizOwnerCheck.rows.length === 0 ||
        quizOwnerCheck.rows[0].teacher_id !== req.user.id
      ) {
        return res
          .status(403)
          .json({ error: "Not authorized to view these assignments" });
      }
    } else if (req.user.role === "student") {
      // Check if student is assigned this quiz
      const assignmentCheck = await pool.query(
        "SELECT id FROM quiz_assignments WHERE quiz_id = $1 AND student_id = $2",
        [quizId, req.user.id]
      );

      if (assignmentCheck.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Not authorized to view these assignments" });
      }
    }

    // Get all assignments for this quiz
    const result = await pool.query(
      `SELECT qa.*, u.name, u.email 
       FROM quiz_assignments qa
       JOIN users u ON qa.student_id = u.id
       WHERE qa.quiz_id = $1
       ORDER BY u.name`,
      [quizId]
    );

    res.json({ assignments: result.rows });
  } catch (err) {
    console.error("❌ Error fetching quiz assignments:", err);
    res.status(500).json({ error: "Failed to fetch quiz assignments" });
  }
});

// 7. Create or update assignments for a quiz
// Route: /api/quiz/:quizId/assignments
router.post("/:quizId/assignments", verifyToken, async (req, res) => {
  // Start a transaction
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const quizId = req.params.quizId;
    const { teacher_id, add_student_ids, remove_student_ids } = req.body;

    // Verify that the authenticated user is the teacher
    if (req.user.id !== parseInt(teacher_id) || req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Not authorized to manage these assignments" });
    }

    // Check if the quiz exists and belongs to this teacher
    const quizCheck = await client.query(
      "SELECT id FROM quiz_folders WHERE id = $1 AND teacher_id = $2",
      [quizId, teacher_id]
    );

    if (quizCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Quiz not found or not owned by this teacher" });
    }

    // Handle new assignments
    if (add_student_ids && add_student_ids.length > 0) {
      // Verify that all students are linked to this teacher
      const validStudentCheck = await client.query(
        `
        SELECT student_id FROM teacher_student_relations 
        WHERE teacher_id = $1 AND student_id = ANY($2::int[])
      `,
        [teacher_id, add_student_ids]
      );

      if (validStudentCheck.rows.length !== add_student_ids.length) {
        return res.status(400).json({
          error: "Some students are not linked to this teacher",
        });
      }

      // Prepare values for batch insert
      const insertValues = add_student_ids
        .map(
          (_, index) => `($1, $${index + 2}, $${add_student_ids.length + 2})`
        )
        .join(", ");

      const insertParams = [quizId, ...add_student_ids, teacher_id];

      await client.query(
        `
        INSERT INTO quiz_assignments (quiz_id, student_id, teacher_id)
        VALUES ${insertValues}
        ON CONFLICT (quiz_id, student_id) 
        DO NOTHING
      `,
        insertParams
      );

      console.log(
        `✅ Assigned quiz ${quizId} to ${add_student_ids.length} students`
      );
    }

    // Handle assignment removals
    if (remove_student_ids && remove_student_ids.length > 0) {
      const placeholders = remove_student_ids
        .map((_, index) => `$${index + 3}`)
        .join(", ");

      await client.query(
        `
        DELETE FROM quiz_assignments 
        WHERE quiz_id = $1 
        AND teacher_id = $2
        AND student_id IN (${placeholders})
      `,
        [quizId, teacher_id, ...remove_student_ids]
      );

      console.log(
        `✅ Removed quiz ${quizId} assignment from ${remove_student_ids.length} students`
      );
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Quiz assignments updated successfully",
      added: add_student_ids?.length || 0,
      removed: remove_student_ids?.length || 0,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error updating quiz assignments:", err);
    res.status(500).json({ error: "Failed to update quiz assignments" });
  } finally {
    client.release();
  }
});

// 8. Get quizzes assigned to a student
// Route: /api/quiz/student/:studentId/assigned-quizzes
// Get quizzes assigned to a student
router.get(
  "/student/:studentId/assigned-quizzes",
  verifyToken,
  async (req, res) => {
    try {
      const studentId = req.params.studentId;

      // First check if assignments exist without joins
      const checkAssignments = await pool.query(
        "SELECT * FROM quiz_assignments WHERE student_id = $1",
        [studentId]
      );

      if (checkAssignments.rows.length === 0) {
        // No assignments found, return empty array
        return res.json({ assignments: [] });
      }

      // If assignments exist, try the full query with joins
      // Modified query with subquery to count questions
      const result = await pool.query(
        `
        SELECT 
          qa.id,
          qa.quiz_id,
          COALESCE(qf.name, 'Unknown Quiz') as folder_name,
          COALESCE(qf.subject, 'Unknown') as subject,
          COALESCE(qf.level, 'Unknown') as level,
          COALESCE(array_length(qf.question_ids, 1), 0) as question_count,
          qa.assigned_at,
          qa.completed,
          qa.completion_date,
          qa.score,
          COALESCE(u.name, 'Unknown Teacher') as teacher_name
        FROM quiz_assignments qa
        LEFT JOIN quiz_folders qf ON qa.quiz_id = qf.id
        LEFT JOIN users u ON qa.teacher_id = u.id
        WHERE qa.student_id = $1
      `,
        [studentId]
      );

      res.json({ assignments: result.rows });
    } catch (err) {
      console.error("Detailed error:", err);
      res.status(500).json({ error: "Failed to fetch assigned quizzes" });
    }
  }
);

// 9. Update student quiz assignment status (mark as completed)
// Route: /api/quiz/student/:studentId/quiz/:quizId/complete
router.put(
  "/student/:studentId/quiz/:quizId/complete",
  verifyToken,
  async (req, res) => {
    try {
      const { studentId, quizId } = req.params;
      const { score } = req.body;

      // Verify that the authenticated user is the student or their teacher
      if (req.user.id !== parseInt(studentId) && req.user.role !== "teacher") {
        // If the user is a teacher, verify they assigned this quiz
        if (req.user.role === "teacher") {
          const assignmentCheck = await pool.query(
            `
          SELECT * FROM quiz_assignments 
          WHERE quiz_id = $1 AND student_id = $2 AND teacher_id = $3
        `,
            [quizId, studentId, req.user.id]
          );

          if (assignmentCheck.rows.length === 0) {
            return res
              .status(403)
              .json({ error: "Not authorized to update this assignment" });
          }
        } else {
          return res
            .status(403)
            .json({ error: "Not authorized to update this assignment" });
        }
      }

      // Update the assignment
      const result = await pool.query(
        `
      UPDATE quiz_assignments
      SET 
        completed = TRUE, 
        completion_date = CURRENT_TIMESTAMP,
        score = $1
      WHERE quiz_id = $2 AND student_id = $3
      RETURNING *
    `,
        [score || null, quizId, studentId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      res.json({
        success: true,
        message: "Quiz marked as completed",
        assignment: result.rows[0],
      });
    } catch (err) {
      console.error("❌ Error completing quiz assignment:", err);
      res
        .status(500)
        .json({ error: "Failed to update quiz completion status" });
    }
  }
);

// 10. Get teachers for a student (for student view)
// Route: /api/quiz/student/:studentId/teachers
router.get("/student/:studentId/teachers", verifyToken, async (req, res) => {
  try {
    const studentId = req.params.studentId;

    // Verify that the authenticated user is the student or an admin
    if (req.user.id !== parseInt(studentId) && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Not authorized to view these teachers" });
    }

    // Get all teachers linked to this student
    const result = await pool.query(
      `
      SELECT u.id, u.name, u.email
      FROM users u
      JOIN teacher_student_relations tsr ON u.id = tsr.teacher_id
      WHERE tsr.student_id = $1 AND u.role = 'teacher'
      ORDER BY u.name
    `,
      [studentId]
    );

    res.json({ teachers: result.rows });
  } catch (err) {
    console.error("❌ Error fetching student's teachers:", err);
    res.status(500).json({ error: "Failed to fetch teachers" });
  }
});

// 11. Get statistics for all assignments for a teacher
// Route: /api/quiz/teacher/:teacherId/assignment-stats
router.get(
  "/teacher/:teacherId/assignment-stats",
  verifyToken,
  async (req, res) => {
    try {
      const teacherId = req.params.teacherId;

      // Verify that the authenticated user is the teacher or an admin
      if (req.user.id !== parseInt(teacherId) && req.user.role !== "admin") {
        return res
          .status(403)
          .json({ error: "Not authorized to access these statistics" });
      }

      // Get overview statistics for all assignments
      const result = await pool.query(
        `
      SELECT 
        COUNT(*) as total_assignments,
        SUM(CASE WHEN completed = TRUE THEN 1 ELSE 0 END) as completed_assignments,
        AVG(score) as average_score,
        COUNT(DISTINCT student_id) as total_students,
        COUNT(DISTINCT quiz_id) as total_quizzes
      FROM quiz_assignments
      WHERE teacher_id = $1
    `,
        [teacherId]
      );

      // Get statistics per quiz
      const quizStats = await pool.query(
        `
      SELECT 
        qf.id,
        qf.folder_name,
        COUNT(*) as assignment_count,
        SUM(CASE WHEN qa.completed = TRUE THEN 1 ELSE 0 END) as completed_count,
        AVG(qa.score) as average_score
      FROM quiz_assignments qa
      JOIN quiz_folders qf ON qa.quiz_id = qf.id
      WHERE qa.teacher_id = $1
      GROUP BY qf.id, qf.folder_name
      ORDER BY assignment_count DESC
    `,
        [teacherId]
      );

      // Get statistics per student
      const studentStats = await pool.query(
        `
      SELECT 
        u.id,
        u.name,
        COUNT(*) as assignment_count,
        SUM(CASE WHEN qa.completed = TRUE THEN 1 ELSE 0 END) as completed_count,
        AVG(qa.score) as average_score
      FROM quiz_assignments qa
      JOIN users u ON qa.student_id = u.id
      WHERE qa.teacher_id = $1
      GROUP BY u.id, u.name
      ORDER BY assignment_count DESC
    `,
        [teacherId]
      );

      res.json({
        overview: result.rows[0],
        quizzes: quizStats.rows,
        students: studentStats.rows,
      });
    } catch (err) {
      console.error("❌ Error fetching assignment statistics:", err);
      res.status(500).json({ error: "Failed to fetch assignment statistics" });
    }
  }
);

// settings for quiz timing
router.post("/:id/set-timer", async (req, res) => {
  const { id } = req.params;
  const { time_per_question_minutes } = req.body;

  if (!time_per_question_minutes || isNaN(time_per_question_minutes)) {
    return res.status(400).json({ error: "Invalid or missing time." });
  }

  try {
    const result = await pool.query(
      `UPDATE quiz_folders SET time_per_question_minutes = $1 WHERE id = $2`,
      [time_per_question_minutes, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    res.json({ message: "⏱ Timer updated successfully" });
  } catch (err) {
    console.error("❌ Failed to update timer:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 3. COMPLETE QUIZ ASSIGNMENT
// POST /api/quiz/assignment/complete
app.post('/assignment/complete', async (req, res) => {
  try {
      const {
          quiz_id,
          completed,
          completion_date,
          score,
          time_taken_seconds,
          questions_answered,
          correct_answers,
          time_expired
      } = req.body;

      // Get current user (student) ID from authentication
      const student_id = req.user?.id;
      
      if (!student_id) {
          return res.status(401).json({ error: 'Not authenticated' });
      }

      if (!quiz_id || completed === undefined || !completion_date || !score) {
          return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check if assignment exists
      const existingAssignment = await db.query(`
          SELECT id FROM quiz_assignments 
          WHERE quiz_id = ? AND student_id = ?
      `, [quiz_id, student_id]);

      if (existingAssignment.length === 0) {
          return res.status(404).json({ error: 'Assignment not found' });
      }

      const assignmentId = existingAssignment[0].id;

      // Update the assignment with completion data
      await db.query(`
          UPDATE quiz_assignments 
          SET 
              completed = ?,
              completion_date = ?,
              score = ?,
              updated_at = NOW()
          WHERE id = ?
      `, [completed, completion_date, score, assignmentId]);

      // Optional: Store additional test statistics in a separate table
      await db.query(`
          INSERT INTO quiz_test_statistics 
          (assignment_id, time_taken_seconds, questions_answered, correct_answers, time_expired, created_at)
          VALUES (?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
              time_taken_seconds = VALUES(time_taken_seconds),
              questions_answered = VALUES(questions_answered),
              correct_answers = VALUES(correct_answers),
              time_expired = VALUES(time_expired),
              updated_at = NOW()
      `, [assignmentId, time_taken_seconds, questions_answered, correct_answers, time_expired]);

      res.json({ 
          success: true, 
          message: 'Quiz assignment completed successfully',
          assignment_id: assignmentId,
          score: score
      });

  } catch (error) {
      console.error('❌ Complete assignment error:', error);
      res.status(500).json({ error: 'Failed to complete assignment' });
  }
});


module.exports = router;
