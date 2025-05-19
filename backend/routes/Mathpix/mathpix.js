// === Simulated Markdown OCR Route with Gemini Full Context Extraction + Mathpix + Polling ===
const express = require("express");
const router = express.Router();
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const insertJSONPayload = require("../Mathpix/insertPostgresql");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();
const axios = require("axios");
const FormData = require("form-data");

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// === Upload PDF to Mathpix, then poll until extraction is ready ===
// === Step 1: Upload PDF to Mathpix and get pdf_id ===
router.post(
  "/upload_pdf_to_mathpix",
  upload.single("pdf"),
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ error: "PDF file required" });

      const form = new FormData();
      form.append("file", req.file.buffer, req.file.originalname);
      form.append(
        "options_json",
        JSON.stringify({
          formats: ["markdown_with_ids", "images"],
          include_answer_box_crop: true,
          math_inline_delimiters: ["$", "$"],
          math_display_delimiters: ["$$", "$$"],
          sandbox: true,
        })
      );

      const uploadRes = await axios.post(
        "https://api.mathpix.com/v3/pdf",
        form,
        {
          headers: {
            ...form.getHeaders(),
            app_id: process.env.MATHPIX_APP_ID,
            app_key: process.env.MATHPIX_APP_KEY,
          },
        }
      );

      res.json({ pdf_id: uploadRes.data.pdf_id });
    } catch (err) {
      console.error("❌ Mathpix upload error:", err);
      res
        .status(500)
        .json({ error: "Failed to upload to Mathpix: " + err.message });
    }
  }
);

async function pollMathpixStatus(pdf_id, retries = 10, delay = 4000) {
  console.log(`⏳ Polling Mathpix status for PDF ID: ${pdf_id}...`);

  for (let i = 0; i < retries; i++) {
    const response = await axios.get(
      `https://api.mathpix.com/v3/pdf/${pdf_id}`,
      {
        headers: {
          app_id: process.env.MATHPIX_APP_ID,
          app_key: process.env.MATHPIX_APP_KEY,
        },
      }
    );

    const status = response.data.status;
    console.log(`📡 Attempt ${i + 1}: status = ${status}`);

    if (status === "completed") {
      console.log("✅ Mathpix processing complete.");
      return response.data;
    } else if (status === "error") {
      throw new Error("❌ Mathpix returned an error during processing.");
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error("❌ Mathpix processing timed out after polling.");
}

router.get("/mathpix/markdown/:pdf_id", async (req, res) => {
  const { pdf_id } = req.params;

  if (!pdf_id) {
    return res.status(400).json({ error: "Missing PDF ID" });
  }

  try {
    const response = await axios.get(
      `https://api.mathpix.com/v3/pdf/${pdf_id}.mmd`,
      {
        headers: {
          app_id: process.env.MATHPIX_APP_ID,
          app_key: process.env.MATHPIX_APP_KEY,
        },
      }
    );

    res.setHeader("Content-Type", "text/plain");
    res.send(response.data); // raw markdown with LaTeX
  } catch (err) {
    console.error("❌ Error fetching MMD from Mathpix:", err.message);
    res.status(500).json({
      error: "Failed to fetch MMD content",
      detail: err.message,
    });
  }
});

router.post("/extract_questions_from_mmd", async (req, res) => {
  try {
    const { pdf_id, subject, banding, level, paper_name, paper_type, topic} =
      req.body;
    if (!pdf_id || !subject || !banding || !level || !paper_name) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    await pollMathpixStatus(pdf_id);

    const [mmdRes, linesRes] = await Promise.all([
      axios.get(`https://api.mathpix.com/v3/pdf/${pdf_id}.mmd`, {
        headers: {
          app_id: process.env.MATHPIX_APP_ID,
          app_key: process.env.MATHPIX_APP_KEY,
        },
      }),
      axios.get(`https://api.mathpix.com/v3/pdf/${pdf_id}.lines.mmd.json`, {
        headers: {
          app_id: process.env.MATHPIX_APP_ID,
          app_key: process.env.MATHPIX_APP_KEY,
        },
      }),
    ]);

    const markdownContent = mmdRes.data;

    const prompt = `You will be given a full exam worksheet in Markdown format. It includes questions, math expressions (in LaTeX), and a final answer key.

Instructions:
- Extract each question's number and full text.
- Keep all LaTeX expressions exactly as-is, including delimiters like \\( ... \\) and $$ ... $$.
- Extract answer options (if present).
- Extract image URLs for each question (from ![Diagram](...)).
- Match the correct answer for each question using the final answer section.

IMPORTANT:
- Do not remove or alter any math symbols or formatting.
- Do not modify LaTeX. Do not strip backslashes or parentheses.
- Preserve all Markdown formatting exactly as shown.
- Make sure all backslashes are double-escaped for JSON (e.g., \\ instead of \).


Return the result as a JSON array. Do not include explanations.

Each item should follow this format:
{
  "question_number": "1",
  "question_text": "...",
  "answer_options": [
    { "option": "A", "text": "..." },
    { "option": "B", "text": "..." }
  ],
  "answer_key": { "question_number": "1", "correct_answer": "B" },
  "image_path": ["..."],
  "subject": "${subject}",
  "banding": "${banding}",
  "level": "${level}",
   "paper_type": "${paper_type}",
    "topic": "${topic || ''}" (if any, if not leave it empty)
}`;

    const result = await model.generateContent([
      { text: `${prompt}\n\n${markdownContent}` },
    ]);

    const raw =
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = raw.match(/\[\s*{[\s\S]+?}\s*\]/);
    if (!jsonMatch) {
      throw new Error("Could not find valid JSON array in Gemini response");
    }
    console.log("📝 Gemini raw response:\n", raw);

    const parsed = JSON.parse(jsonMatch[0]);

    // Extract correct image URLs in order from lines.mmd.json
    const pages = linesRes.data.pages || [];
    const orderedImageUrls = [];
    for (const page of pages) {
      for (const line of page.lines || []) {
        if (
          line.text &&
          line.text.includes("https://cdn.mathpix.com/cropped")
        ) {
          const matches = [
            ...line.text.matchAll(
              /https:\/\/cdn\.mathpix\.com\/cropped[^\s)]+/g
            ),
          ];
          for (const match of matches) {
            orderedImageUrls.push(match[0]);
          }
        }
      }
    }

    // Replace Gemini image paths with correct ones by order
    let imageIndex = 0;
    const updatedQuestions = parsed.map((q) => {
      const image_path = [];
      if (Array.isArray(q.image_path) && q.image_path.length > 0) {
        for (let i = 0; i < q.image_path.length; i++) {
          if (orderedImageUrls[imageIndex]) {
            image_path.push(orderedImageUrls[imageIndex]);
            imageIndex++;
          }
        }
      }
      return { ...q, image_path };
    });

    res.json({ questions: updatedQuestions });
  } catch (err) {
    console.error("❌ Extract from MMD + Gemini error:", err);
    res
      .status(500)
      .json({ error: "Extraction from MMD failed: " + err.message });
  }
});

// === Step 2: Upload extracted image paths to your S3 ===
router.post("/upload_extracted_images_to_s3", async (req, res) => {
  try {
    const { paper_name, subject, banding, level, paper_type, topic, questions } = req.body;
    if (!questions || !paper_name || !subject || !banding || !level) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const updatedQuestions = await Promise.all(
      questions.map(async (q) => {
        if (!Array.isArray(q.image_path)) return q;

        const newPaths = await Promise.all(
          q.image_path.map(async (url, i) => {
            try {
              console.log(`📥 Downloading: ${url}`);
              const response = await axios.get(url, {
                responseType: "arraybuffer",
              });
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

              return `https://${process.env.S3_BUCKET_NAME}.s3.${
                process.env.S3_REGION
              }.amazonaws.com/${encodeURIComponent(paper_name)}/${fileName}`;
            } catch (err) {
              console.warn(
                `⚠️ Failed to upload image for Q${q.question_number}: ${err.message}`
              );
              return url;
            }
          })
        );

        return { ...q, image_path: newPaths };
      })
    );

    // ✅ Insert into PostgreSQL
    await insertJSONPayload({
      paper_name,
      subject,
      banding,
      level,
      paper_type,
      topic,
      questions: updatedQuestions,
    });

    res.json({
      message: "✅ Uploaded to S3 and inserted to DB",
      questions: updatedQuestions,
    });
  } catch (err) {
    console.error("❌ Image upload or DB insert error:", err);
    res.status(500).json({ error: "Upload/Insert failed: " + err.message });
  }
});

router.get("/markdown/:pdf_id", async (req, res) => {
  try {
    const { pdf_id } = req.params;

    if (!pdf_id) {
      return res.status(400).json({ error: "Missing PDF ID" });
    }

    const response = await axios.get(
      `https://api.mathpix.com/v3/pdf/${pdf_id}.mmd`,
      {
        headers: {
          app_id: process.env.MATHPIX_APP_ID,
          app_key: process.env.MATHPIX_APP_KEY,
        },
      }
    );

    res.setHeader("Content-Type", "text/plain");
    res.send(response.data);
  } catch (err) {
    console.error("❌ Error fetching MMD from Mathpix:", err.message);
    res
      .status(500)
      .json({ error: "Failed to fetch MMD content", detail: err.message });
  }
});

module.exports = router;
