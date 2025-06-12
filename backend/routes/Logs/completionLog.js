const express = require("express");
const router = express.Router();
const { Pool } = require("pg");
const SibApiV3Sdk = require("sib-api-v3-sdk");
const verifyToken = require("../../middleware/verify-token");
const { verify } = require("crypto");

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

// Configure Brevo API
const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// GET /api/completion-logs - Get all completion logs for a teacher
router.get("/", verifyToken, async (req, res) => {
  try {
    // Get teacher ID from JWT token (you'll need to implement JWT middleware)
    const teacherId = req.user?.id; // Assuming you have JWT middleware
    
    if (!teacherId) {
      return res.status(401).json({ error: "Teacher ID required" });
    }

    const query = `
      SELECT 
        qa.id,
        qa.quiz_id,
        qa.student_id,
        qa.assigned_at,
        qa.due_date,
        qa.completed,
        qa.completed_at,
        qa.score,
        u.name as student_name,
        u.email as student_email,
        qf.name as quiz_name,
        qf.subject,
        qf.level,
        qf.topic,
        array_length(qf.question_ids, 1) as question_count
      FROM quiz_assignments qa
      JOIN users u ON qa.student_id = u.id
      JOIN quiz_folders qf ON qa.quiz_id = qf.id
      WHERE qa.teacher_id = $1
      ORDER BY qa.assigned_at DESC, qa.completed ASC
    `;

    const result = await pool.query(query, [teacherId]);

    res.json({
      success: true,
      logs: result.rows
    });
  } catch (error) {
    console.error("❌ Error fetching completion logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch completion logs"
    });
  }
});

// POST /api/completion-logs/send-reminder - Send reminder email to a student
router.post("/send-reminder", verifyToken, async (req, res) => {
  try {
    const {
      assignment_id,
      student_email,
      student_name,
      quiz_name,
      due_date
    } = req.body;

    if (!assignment_id || !student_email || !student_name || !quiz_name) {
      return res.status(400).json({
        error: "Missing required fields"
      });
    }

    // Get teacher info
    const teacherId = req.user?.id;
    const teacherResult = await pool.query(
      "SELECT name, email FROM users WHERE id = $1",
      [teacherId]
    );
    
    if (teacherResult.rows.length === 0) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const teacher = teacherResult.rows[0];
    const dueDateText = due_date ? new Date(due_date).toLocaleDateString() : "soon";

    // Prepare email content
    const emailPayload = {
      to: [{ email: student_email, name: student_name }],
      sender: {
        email: "ppeiyijoleen@gmail.com", // Your verified sender email
        name: "The Epic Mind Learning Loft",
      },
      subject: `Reminder: Complete Your Quiz - ${quiz_name}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #66CC99;">📚 Quiz Reminder</h2>
          
          <p>Dear ${student_name},</p>
          
          <p>This is a friendly reminder that you have a pending quiz assignment:</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">📝 ${quiz_name}</h3>
            <p style="margin: 0;"><strong>Assigned by:</strong> ${teacher.name}</p>
            <p style="margin: 5px 0 0 0;"><strong>Due:</strong> ${dueDateText}</p>
          </div>
          
          <p>Please log in to your account and complete this quiz at your earliest convenience.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_BASE_URL}/quiz-folder" 
               style="background-color: #66CC99; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Access My Quizzes
            </a>
          </div>
          
          <p>If you have any questions about this assignment, please contact your teacher.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #888;">
            This is an automated reminder from The Epic Mind Learning Loft.<br>
            If you believe you received this email in error, please contact your teacher.
          </p>
        </div>
      `,
    };

    // Send email
    await apiInstance.sendTransacEmail(emailPayload);

    // Update reminder sent timestamp
    await pool.query(
      "UPDATE quiz_assignments SET last_reminder_sent = NOW() WHERE id = $1",
      [assignment_id]
    );

    res.json({
      success: true,
      message: "Reminder sent successfully"
    });

  } catch (error) {
    console.error("❌ Error sending reminder:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send reminder email"
    });
  }
});

// POST /api/completion-logs/send-bulk-reminders - Send reminders to multiple students
router.post("/send-bulk-reminders",verifyToken, async (req, res) => {
  try {
    const { assignment_ids } = req.body;

    if (!assignment_ids || !Array.isArray(assignment_ids)) {
      return res.status(400).json({
        error: "Assignment IDs array required"
      });
    }

    const teacherId = req.user?.id;
    const teacherResult = await pool.query(
      "SELECT name, email FROM users WHERE id = $1",
      [teacherId]
    );
    
    if (teacherResult.rows.length === 0) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const teacher = teacherResult.rows[0];

    // Get all assignment details
    const assignmentsQuery = `
      SELECT 
        qa.id,
        qa.due_date,
        u.name as student_name,
        u.email as student_email,
        qf.name as quiz_name
      FROM quiz_assignments qa
      JOIN users u ON qa.student_id = u.id
      JOIN quiz_folders qf ON qa.quiz_id = qf.id
      WHERE qa.id = ANY($1) AND qa.teacher_id = $2 AND qa.completed = false
    `;

    const result = await pool.query(assignmentsQuery, [assignment_ids, teacherId]);
    const assignments = result.rows;

    let sentCount = 0;
    const errors = [];

    // Send reminders in batches to avoid rate limiting
    for (const assignment of assignments) {
      try {
        const dueDateText = assignment.due_date ? 
          new Date(assignment.due_date).toLocaleDateString() : "soon";

        const emailPayload = {
          to: [{ email: assignment.student_email, name: assignment.student_name }],
          sender: {
            email: "ppeiyijoleen@gmail.com",
            name: "The Epic Mind Learning Loft",
          },
          subject: `Reminder: Complete Your Quiz - ${assignment.quiz_name}`,
          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #66CC99;">📚 Quiz Reminder</h2>
              
              <p>Dear ${assignment.student_name},</p>
              
              <p>This is a friendly reminder that you have a pending quiz assignment:</p>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #333;">📝 ${assignment.quiz_name}</h3>
                <p style="margin: 0;"><strong>Assigned by:</strong> ${teacher.name}</p>
                <p style="margin: 5px 0 0 0;"><strong>Due:</strong> ${dueDateText}</p>
              </div>
              
              <p>Please log in to your account and complete this quiz at your earliest convenience.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_BASE_URL}/quiz-folder" 
                   style="background-color: #66CC99; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Access My Quizzes
                </a>
              </div>
              
              <p>If you have any questions about this assignment, please contact your teacher.</p>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="font-size: 12px; color: #888;">
                This is an automated reminder from The Epic Mind Learning Loft.<br>
                If you believe you received this email in error, please contact your teacher.
              </p>
            </div>
          `,
        };

        await apiInstance.sendTransacEmail(emailPayload);
        sentCount++;

        // Update reminder sent timestamp
        await pool.query(
          "UPDATE quiz_assignments SET last_reminder_sent = NOW() WHERE id = $1",
          [assignment.id]
        );

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (emailError) {
        console.error(`❌ Error sending reminder to ${assignment.student_email}:`, emailError);
        errors.push({
          student: assignment.student_name,
          error: emailError.message
        });
      }
    }

    res.json({
      success: true,
      sent_count: sentCount,
      total_assignments: assignments.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("❌ Error sending bulk reminders:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send bulk reminders"
    });
  }
});

// POST /api/completion-logs/mark-completed - Mark a quiz as completed (for testing)
router.post("/mark-completed", async (req, res) => {
  try {
    const { assignment_id, score } = req.body;

    if (!assignment_id) {
      return res.status(400).json({ error: "Assignment ID required" });
    }

    const result = await pool.query(
      `UPDATE quiz_assignments 
       SET completed = true, completed_at = NOW(), score = $2
       WHERE id = $1 
       RETURNING *`,
      [assignment_id, score || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    res.json({
      success: true,
      message: "Quiz marked as completed",
      assignment: result.rows[0]
    });

  } catch (error) {
    console.error("❌ Error marking quiz as completed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark quiz as completed"
    });
  }
});

module.exports = router;