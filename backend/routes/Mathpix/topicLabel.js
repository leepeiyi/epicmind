// routes/labelTopics.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const topicData = require("../../data/topicData");
const { Pool } = require("pg");

require("dotenv").config();

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
      if (normalized.includes("4")) keys.push("mathSec4", "mathSec3"); // 👈 include both
    }
  }

  return keys;
}

router.post("/match-topics", async (req, res) => {
  const { questions, level, subject, paper_type } = req.body;

  if (
    !questions ||
    !Array.isArray(questions) ||
    !level ||
    !subject ||
    !paper_type
  ) {
    return res
      .status(400)
      .json({
        error: "Missing required fields: questions, level, subject, paper_type",
      });
  }

  const sectionKeys = getSectionKeys(level, subject, paper_type);
  const validKeys = sectionKeys.filter((key) => topicData[key]);

  if (validKeys.length === 0) {
    return res
      .status(400)
      .json({ error: `No topic data found for level/subject combination.` });
  }

  // ✅ Merge all topics
  const topics = validKeys.flatMap((key) => topicData[key]);
  const descriptions = topics.map((t) => t.description);
  console.log("Merged keys:", validKeys, "| Total topics:", topics.length);


  const apiUrl =
    "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2";
  const headers = {
    Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
  };

  const results = await Promise.all(
    questions.map(async (q) => {
      try {
        const response = await axios.post(
          apiUrl,
          {
            inputs: {
              source_sentence: q.question_text,
              sentences: descriptions,
            },
          },
          { headers }
        );

        const scores = response.data;
        const bestIdx = scores.indexOf(Math.max(...scores));
        return { ...q, topic_label: topics[bestIdx].label };
      } catch (err) {
        console.error(`❌ Failed to classify question: ${err.message}`);
        return { ...q, topic_label: "" };
      }
    })
  );

  res.json({ success: true, questions: results });
});

router.post("/uploadSyllabus", async (req, res) => {
  const { jsonData, subject, banding, level } = req.body;

  const client = await pool.connect();

  if (!jsonData || !subject || !banding || !level) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    const updates = await Promise.all(
      jsonData.map(async (q) => {
        if (!q.question_number || !q.topic_label) return;

        await client.query(
          `UPDATE question
           SET topic_label = $1
           WHERE question_number = $2 AND subject = $3 AND banding = $4 AND level = $5`,
          [q.topic_label, q.question_number, subject, banding, level]
        );
      })
    );

    res.json({
      message: `✅ ${jsonData.length} topic labels updated successfully.`,
    });
  } catch (err) {
    console.error("❌ Failed to update topic labels:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
