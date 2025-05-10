// === Simulated Markdown OCR Route with Gemini Full Context Extraction ===
const express = require("express");
const router = express.Router();
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const insertJSONPayload = require("../InsertPaper/insertPostgresql");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();
const axios = require("axios");

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// === Step 1: Accept Markdown file via form-data ===
router.post("/extract_questions_and_keys_from_markdown", upload.single("markdown"), async (req, res) => {
  try {
    const markdownContent = req.file.buffer.toString();
    const { subject, banding, level } = req.body;

    if (!markdownContent || !subject || !banding || !level)
      return res.status(400).json({ error: "Missing required fields" });

    const prompt = `You will be given a full exam worksheet in Markdown format. It includes questions, diagrams (via image URLs), and a final answer key.

Your task:
- Extract each question's number and text
- Extract answer options (if present)
- Match the correct answer for each question using the final answer section

Return the result as a JSON array. Do not include explanations.

Each item should follow this structure:
{
  "question_number": "1",
  "question_text": "...",
  "answer_options": [
    { "option": "A", "text": "..." },
    { "option": "B", "text": "..." }
  ],
  "answer_key": { "question_number": "1", "correct_answer": "B" },
  "subject": "${subject}",
  "banding": "${banding}",
  "level": "${level}"
}`;

    const result = await model.generateContent([
      { text: prompt },
      { text: markdownContent },
    ]);

    const raw =
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const jsonMatch = raw.match(/\[\s*{[\s\S]+?}\s*\]/);
    if (!jsonMatch) {
      throw new Error("Could not find valid JSON array in Gemini response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    res.json({ questions: parsed });
  } catch (err) {
    console.error("❌ Gemini extraction error:", err);
    res.status(500).json({ error: "Gemini extraction failed: " + err.message });
  }
});

// === Step 2: Upload extracted image paths to your S3 ===
router.post("/upload_extracted_images_to_s3", async (req, res) => {
  try {
    const { paper_name, questions } = req.body;
    if (!questions || !paper_name) {
      return res.status(400).json({ error: "Missing paper_name or questions" });
    }

    const updatedQuestions = await Promise.all(
      questions.map(async (q) => {
        if (!Array.isArray(q.image_path)) return q;

        const newPaths = await Promise.all(
          q.image_path.map(async (url, i) => {
            try {
              console.log(`📥 Downloading: ${url}`);
              const response = await axios.get(url, { responseType: "arraybuffer" });
              const buffer = Buffer.from(response.data, "binary");
              const fileName = `page-custom_diagram_${q.question_number}_${i}.png`;
              const key = `${paper_name}/${fileName}`;

              await s3.send(
                new PutObjectCommand({
                  Bucket: process.env.S3_BUCKET_NAME,
                  Key: key,
                  Body: buffer,
                  ContentType: "image/png",
                })
              );

              return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/${encodeURIComponent(paper_name)}/${fileName}`;
            } catch (err) {
              console.warn(`⚠️ Failed to upload image for Q${q.question_number}: ${err.message}`);
              console.log(q.image_path);
              return url;
            }
          })
        );

        return { ...q, image_path: newPaths };
      })
    );

    res.json({ questions: updatedQuestions });
  } catch (err) {
    console.error("❌ Image upload replacement error:", err);
    res.status(500).json({ error: "Image S3 upload failed: " + err.message });
  }
});

module.exports = router;
