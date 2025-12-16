// routes/labelTopics.js - Improved version with consistency features
const express = require("express");
const router = express.Router();
const axios = require("axios");
// const topicData = require("../../data/topicData"); // DEPRECATED: Now using database
const { Pool } = require("pg");
const requireTeacher = require("../../middleware/require-teacher");
const { dbConfig } = require("../../utils/db-config");

require("dotenv").config();

const pool = new Pool(dbConfig);

function getSectionKeys(level, subject, paperType) {
  const normalized = level.toLowerCase();
  const keys = [];

  if (paperType === "exam") {
    if (subject.toLowerCase().includes("a-math")) {
      if (normalized.includes("3")) keys.push("amathSec3");
      if (normalized.includes("4")) keys.push("amathSec4", "amathSec3");
    } else {
      if (normalized.includes("1")) keys.push("mathSec1");
      if (normalized.includes("2")) keys.push("mathSec2");
      if (normalized.includes("3")) keys.push("mathSec3");
      if (normalized.includes("4")) keys.push("mathSec4", "mathSec3");
    }
  }

  return keys;
}

// NEW: Fetch topics from database instead of static file
async function getTopicsFromDatabase(levelKeys) {
  const client = await pool.connect();

  try {
    // Build query to get topics for specified levels
    const placeholders = levelKeys.map((_, i) => `$${i + 1}`).join(',');
    const query = `
      SELECT
        t.id,
        t.label,
        t.hashtag,
        t.description,
        l.name as level_name,
        ARRAY_AGG(sh.hashtag ORDER BY sh.hashtag) FILTER (WHERE sh.hashtag IS NOT NULL) as sub_hashtags
      FROM topics t
      JOIN levels l ON t.level_id = l.id
      LEFT JOIN sub_hashtags sh ON t.id = sh.topic_id
      WHERE l.name IN (${placeholders})
      GROUP BY t.id, t.label, t.hashtag, t.description, l.name
      ORDER BY l.name, t.label
    `;

    const result = await client.query(query, levelKeys);

    // Format data to match the old topicData structure
    const topics = result.rows.map(row => ({
      label: row.label,
      hashtag: row.hashtag,
      description: row.description,
      subHashtags: row.sub_hashtags || []
    }));

    return topics;
  } catch (error) {
    console.error("❌ Error fetching topics from database:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Switched back to Gemini with aggressive caching to avoid quota issues
async function getGeminiEmbeddingWithRetry(text, maxRetries = 3) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(
        url,
        {
          model: "models/text-embedding-004",
          content: {
            parts: [{ text: text }],
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      return response.data.embedding.values;
    } catch (error) {
      console.error(
        `❌ Gemini embedding error (attempt ${attempt}/${maxRetries}):`,
        error.response?.data || error.message
      );

      if (attempt === maxRetries) {
        throw error;
      }

      // Wait longer between retries to avoid rate limiting (2s, 4s, 8s)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
}

function stripLatex(text) {
  return text
    .replace(/\\\(|\\\)/g, "") // remove inline math brackets
    .replace(/\$+([^$]+)\$+/g, "$1") // unwrap $...$
    .replace(/\\[a-zA-Z]+\s*/g, "") // remove LaTeX commands like \frac
    .replace(/{|}/g, "") // remove braces
    .replace(/[_^]/g, "") // remove subscript/superscript markers
    .replace(/\\\\/g, "") // remove escaped backslashes
    .replace(/ +/g, " ") // clean spacing
    .trim();
}

// Function to calculate cosine similarity with better precision
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  // Round to 6 decimal places for consistency
  return Math.round((dotProduct / (normA * normB)) * 1000000) / 1000000;
}

// Enhanced cache with persistence and validation
const topicEmbeddingsCache = new Map();
const questionEmbeddingsCache = new Map(); // Cache question embeddings too

// Function to generate a consistent hash for caching
function generateQuestionHash(questionText) {
  // Simple hash function for consistent caching
  let hash = 0;
  for (let i = 0; i < questionText.length; i++) {
    const char = questionText.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

// Sequential processing instead of parallel for consistency
async function processQuestionsSequentially(
  questions,
  topicEmbeddings,
  topics
) {
  const results = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    try {
      console.log(
        `Processing question ${i + 1}/${questions.length}: Q${
          q.question_number
        }`
      );
      console.log(`Question text: ${q.question_text}`);

      // Check cache first
      const questionHash = generateQuestionHash(q.question_text);
      let questionEmbedding;

      if (questionEmbeddingsCache.has(questionHash)) {
        console.log(
          `📋 Using cached embedding for question ${q.question_number}`
        );
        questionEmbedding = questionEmbeddingsCache.get(questionHash);
      } else {
        console.log(
          `🔄 Generating embedding for question ${q.question_number}`
        );
        const cleanedText = stripLatex(q.question_text);
        questionEmbedding = await getGeminiEmbeddingWithRetry(cleanedText);

        questionEmbeddingsCache.set(questionHash, questionEmbedding);
      }

      // Calculate similarities with all topics
      const similarities = topicEmbeddings.map((topicEmb, topicIndex) => {
        try {
          return cosineSimilarity(questionEmbedding, topicEmb);
        } catch (error) {
          console.error(
            `❌ Similarity calculation error for topic ${topicIndex}:`,
            error.message
          );
          return 0;
        }
      });

      // Find the best match
      const bestIdx = similarities.indexOf(Math.max(...similarities));
      const bestScore = similarities[bestIdx];

      console.log(
        `✅ Question ${q.question_number} matched to: ${
          topics[bestIdx].label
        } (score: ${bestScore.toFixed(6)})`
      );

      results.push({
        ...q,
        topic_label: topics[bestIdx].label,
        confidence_score: bestScore,
        all_scores: similarities
          .map((score, idx) => ({
            topic: topics[idx].label,
            score: score,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 3), // Top 3 matches for debugging
      });

      // Delay to avoid rate limiting (300ms between questions)
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (err) {
      console.error(
        `❌ Failed to classify question ${q.question_number}: ${err.message}`
      );
      results.push({
        ...q,
        topic_label: topics[0]?.label || "Unknown",
        confidence_score: 0,
        error: err.message,
      });
    }
  }

  return results;
}

router.post("/match-topics", requireTeacher, async (req, res) => {
  const { questions, level, subject, paper_type } = req.body;

  if (
    !questions ||
    !Array.isArray(questions) ||
    !level ||
    !subject ||
    !paper_type
  ) {
    return res.status(400).json({
      error: "Missing required fields: questions, level, subject, paper_type",
    });
  }

  const sectionKeys = getSectionKeys(level, subject, paper_type);

  if (sectionKeys.length === 0) {
    return res
      .status(400)
      .json({ error: `No topic data found for level/subject combination.` });
  }

  // ✅ Fetch topics from database instead of static file
  let topics;
  try {
    topics = await getTopicsFromDatabase(sectionKeys);
    console.log("Fetched from database - Keys:", sectionKeys, "| Total topics:", topics.length);
  } catch (error) {
    console.error("❌ Failed to fetch topics from database:", error);
    return res.status(500).json({ error: "Failed to fetch topics from database" });
  }

  if (topics.length === 0) {
    return res.status(400).json({ error: "No topics found in database for this level/subject combination" });
  }

  try {
    // Create cache key for this set of topics
    const cacheKey = sectionKeys.join("-");
    let topicEmbeddings;

    // Check if we have cached embeddings for these topics
    if (topicEmbeddingsCache.has(cacheKey)) {
      console.log("📋 Using cached topic embeddings");
      topicEmbeddings = topicEmbeddingsCache.get(cacheKey);
    } else {
      console.log("🔄 Generating topic embeddings...");
      topicEmbeddings = [];

      // Generate embeddings sequentially for consistency
      for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        try {
          console.log(
            `Generating embedding for topic ${i + 1}/${topics.length}: ${
              topic.label
            }`
          );
          const embedding = await getGeminiEmbeddingWithRetry(
            topic.description
          );
          topicEmbeddings.push(embedding);

          // Delay between requests to avoid rate limiting (500ms)
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error(
            `❌ Failed to generate embedding for topic: ${topic.label}`,
            error.message
          );
          // Return a zero vector as fallback
          topicEmbeddings.push(new Array(768).fill(0));
        }
      }

      // Cache the embeddings
      topicEmbeddingsCache.set(cacheKey, topicEmbeddings);
      console.log("💾 Cached topic embeddings");
    }

    console.log("🔄 Processing questions sequentially...");

    // Process questions sequentially for consistency
    const results = await processQuestionsSequentially(
      questions,
      topicEmbeddings,
      topics
    );

    console.log("✅ All questions processed successfully");

    // Add metadata for debugging
    const responseData = {
      success: true,
      questions: results,
      metadata: {
        total_questions: questions.length,
        topics_used: sectionKeys,
        total_topics: topics.length,
        processing_method: "sequential",
        cache_used: topicEmbeddingsCache.has(cacheKey),
        data_source: "database", // NEW: Indicate we're using database
        timestamp: new Date().toISOString(),
      },
    };

    res.json(responseData);
  } catch (error) {
    console.error("❌ Error in match-topics:", error);
    res.status(500).json({
      error: "Failed to process questions with embeddings",
      details: error.message,
    });
  }
});

// Add route to clear caches for testing
router.post("/clear-cache", (req, res) => {
  topicEmbeddingsCache.clear();
  questionEmbeddingsCache.clear();
  console.log("🧹 Cleared all embedding caches");
  res.json({ success: true, message: "Caches cleared" });
});

// Add route to view cache status
router.get("/cache-status", (req, res) => {
  res.json({
    topic_embeddings_cache_size: topicEmbeddingsCache.size,
    question_embeddings_cache_size: questionEmbeddingsCache.size,
    topic_cache_keys: Array.from(topicEmbeddingsCache.keys()),
  });
});

router.post("/uploadSyllabus", requireTeacher, async (req, res) => {
  const { jsonData, subject, banding, level, paper_name } = req.body;

  const client = await pool.connect();

  if (!jsonData || !subject || !banding || !level || !paper_name) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    const updates = await Promise.all(
      jsonData.map(async (q) => {
        if (!q.question_number || !q.topic_label) return;

        await client.query(
          `UPDATE question
           SET topic_label = $1
           WHERE question_number = $2 AND subject = $3 AND banding = $4 AND level = $5 AND paper_name = $6`,
          [q.topic_label, q.question_number, subject, banding, level, paper_name]
        );
      })
    );

    res.json({
      message: `✅ ${jsonData.length} topic labels updated successfully.`,
    });
  } catch (err) {
    console.error("❌ Failed to update topic labels:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

module.exports = router;
