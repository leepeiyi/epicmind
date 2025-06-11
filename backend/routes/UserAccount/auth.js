require("dotenv").config();

const express = require("express");
const router = express.Router();
const { Client } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const SibApiV3Sdk = require("sib-api-v3-sdk"); 
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5008";

const client = new Client({
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

client.connect((err) => {
  if (err) {
    console.error("Error connecting to database:", err);
    return;
  } else {
    console.log("Connected to database");
  }
});

// === USER REGISTRATION ===
router.post("/register", async (req, res) => {
  const { name, email, password, role, parentEmail } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await client.query(
      `INSERT INTO users (name, email, password, role, parent_email)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, name, email, role`,
      [name, email, hashed, role, parentEmail || null]
    );
    res.status(201).json({ message: "User created", user: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(400).json({ error: "Registration failed", detail: err.message });
  }
});

// === USER LOGIN ===
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await client.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Incorrect password" });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Login failed", detail: err.message });
  }
});

// === FORGOT PASSWORD ===
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const result = await client.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const user = result.rows[0];
    if (!user) {
      console.log("❌ Email not found in DB:", email);
      return res.status(404).json({ error: "User not found" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires = Date.now() + 3600000; // 1 hour

    await client.query(
      "UPDATE users SET reset_token = $1, token_expires = $2 WHERE email = $3",
      [token, expires, email]
    );

    const resetLink = `${API_BASE_URL}/reset-password?token=${token}`;

    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    defaultClient.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    const emailPayload = {
      to: [{ email }],

      // ⬅️ You can temporarily hardcode this to test delivery
      sender: {
        email: "ppeiyijoleen@gmail.com",
        name: "The Epic Mind Learning Loft",
      },
      subject: "Reset Your Password",
      htmlContent: `<p>Hello ${user.name},<br><br>
          Click <a href="${resetLink}">here</a> to reset your password.
          This link will expire in 1 hour.</p>`,
    };

    console.log("📨 Sending reset email to:", email);
    console.log("🔗 Reset Link:", resetLink);

    const response = await apiInstance.sendTransacEmail(emailPayload);

    console.log("✅ Brevo Response:", response);
    res.json({ message: "Reset email sent" });
  } catch (err) {
    console.error("🔥 Email send error:", err.message);
    res
      .status(500)
      .json({ error: "Error sending reset email", detail: err.message });
  }
});

// === RESET PASSWORD ===
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const result = await client.query(
      "SELECT * FROM users WHERE reset_token = $1",
      [token]
    );
    const user = result.rows[0];

    if (!user || !user.token_expires || user.token_expires < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await client.query(
      "UPDATE users SET password = $1, reset_token = NULL, token_expires = NULL WHERE id = $2",
      [hashed, user.id]
    );

    res.json({ message: "Password has been reset" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Reset failed" });
  }
});

module.exports = router;
