// Epic Mind Backend Server - Auto-deploy test
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

require("dotenv").config({ 
  path: process.env.NODE_ENV === 'development' ? '.env.local' : '.env' 
});

// CORS configuration for production
// Update the CORS configuration in your server.js

const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? [
          "https://epic-mind-frontend.vercel.app", // ✅ Your actual Vercel domain
          "https://epic-mind-frontend-git-main-peiyis-projects.vercel.app", // Git branch URL
          "https://epic-mind-frontend-leepeiyi.vercel.app", // Alternative URL format
          "https://epic-mind-backend.onrender.com", // Your backend URL (for testing)
        ]
      : [
          "http://localhost:5173",
          "http://localhost:5174",
          "http://localhost:3000",
          "http://localhost:5008",
        ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Trust proxy for deployment platforms
app.set("trust proxy", 1);

// Database connection
const client = require("./databasepg");

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Epic Mind Backend API is running!",
    version: "1.0.0",
    status: "active",
  });
});

// Legacy endpoint (keep for compatibility)
app.get("/api/message", (req, res) => {
  res.json({ message: "Hello from backend!" });
});

// Route imports and setup
const userAccountRoutes = require("./routes/UserAccount/auth");
app.use("/api/user", userAccountRoutes);

const mathpixRoutes = require("./routes/Mathpix/mathpix");
app.use("/api/mathpix", mathpixRoutes);

const paperRoutes = require("./routes/Mathpix/insertpaper");
app.use("/api/paper", paperRoutes);

const generateRoutes = require("./routes/GenerateQuiz/topical");
app.use("/api/quiz", generateRoutes);

const segmentRoutes = require("./routes/GenerateQuiz/segmentQuestions");
app.use("/api/quiz", segmentRoutes);

const quizRoutes = require("./routes/QuizFolder/getQuiz");
app.use("/api/quiz", quizRoutes);

const quizAssignmentRoutes = require("./routes/QuizFolder/assignQuiz");
app.use("/api/quiz", quizAssignmentRoutes);

const markdownRoutes = require("./routes/Mathpix/markdown");
app.use("/api/markdown", markdownRoutes);

const favouriteRoutes = require("./routes/Favourite/favourite");
app.use("/api/favourite", favouriteRoutes);

const mathsteryRoutes = require("./routes/Mathstery/mathstery");
app.use("/api/mathstery", mathsteryRoutes);

const topicLabelRoutes = require("./routes/Mathpix/topicLabel");
app.use("/api/topic-label", topicLabelRoutes);

const completionLogRoutes = require("./routes/Logs/completionLog");
app.use("/api/completion-log", completionLogRoutes);

const topicsRoutes = require("./routes/topics");
app.use("/api/topics", topicsRoutes);

const flaggedQuestionsRoutes = require("./routes/FlaggedQuestions/flaggedQuestions");
app.use("/api/flagged", flaggedQuestionsRoutes);

const quizAttemptsRoutes = require("./routes/QuizAttempts/quizAttempts");
app.use("/api/attempts", quizAttemptsRoutes);

// Static files - using sendFile for better path handling with special characters
app.use("/uploads", (req, res, next) => {
  try {
    let decodedPath = decodeURIComponent(req.path);
    // Remove trailing slash if present
    if (decodedPath.endsWith('/') && decodedPath.length > 1) {
      decodedPath = decodedPath.slice(0, -1);
    }

    const filePath = path.join(__dirname, "uploads", decodedPath);

    // Check if file exists and serve it
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    next();
  } catch (e) {
    next();
  }
});

// FIXED: 404 handler for unknown routes (removed problematic '*' pattern)
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableRoutes: [
      "/health",
      "/api/user",
      "/api/mathpix",
      "/api/paper",
      "/api/quiz",
      "/api/attempts",
      "/api/flagged",
    ],
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);

  res.status(err.status || 500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

// Use dynamic port for deployment platforms
const PORT = process.env.PORT || 5008;
const HOST = process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost";

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: http://${HOST}:${PORT}/health`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", err);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception thrown:", err);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  process.exit(0);
});
