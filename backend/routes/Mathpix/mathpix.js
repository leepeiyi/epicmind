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

const PDFParser = require("pdf-parse");

// Add this endpoint to mathpix.js
router.post("/get_pdf_page_count", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "PDF file required" });

    const dataBuffer = req.file.buffer;
    const pdfData = await PDFParser(dataBuffer);

    res.json({ pageCount: pdfData.numpages });
  } catch (err) {
    console.error("❌ Error getting PDF page count:", err);
    res.status(500).json({ error: "Failed to get PDF page count" });
  }
});

// Test endpoint for PDF page count
router.post("/test/pdf-page-count", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    const PDFParser = require("pdf-parse");
    const dataBuffer = req.file.buffer;

    console.log("🧪 Testing PDF page count functionality...");

    try {
      const pdfData = await PDFParser(dataBuffer);
      const pageCount = pdfData.numpages;

      console.log(`✅ PDF page count test successful: ${pageCount} pages`);
      return res.json({ success: true, pageCount });
    } catch (pdfError) {
      console.error("❌ PDF parse error:", pdfError);
      return res.status(500).json({
        error: "Failed to parse PDF",
        details: pdfError.message,
      });
    }
  } catch (error) {
    console.error("❌ Test error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Test endpoint for Mathpix API connection (no actual upload)
router.post("/test/mathpix-connection", async (req, res) => {
  try {
    console.log("🧪 Testing Mathpix API connection...");

    // Just check if we can connect to Mathpix API
    const testResponse = await axios.get(
      "https://api.mathpix.com/v3/app-info",
      {
        headers: {
          app_id: process.env.MATHPIX_APP_ID,
          app_key: process.env.MATHPIX_APP_KEY,
        },
      }
    );

    console.log("✅ Mathpix API connection test successful");
    return res.json({
      success: true,
      apiInfo: testResponse.data,
      credentials: {
        app_id_valid: !!process.env.MATHPIX_APP_ID,
        app_key_valid: !!process.env.MATHPIX_APP_KEY,
      },
    });
  } catch (error) {
    console.error("❌ Mathpix API connection test failed:", error);
    return res.status(500).json({
      error: "Failed to connect to Mathpix API",
      details: error.message,
      credentials: {
        app_id_valid: !!process.env.MATHPIX_APP_ID,
        app_key_valid: !!process.env.MATHPIX_APP_KEY,
      },
    });
  }
});

// Test endpoint for batch parameter handling
router.post("/test/batch-params", upload.single("pdf"), async (req, res) => {
  try {
    console.log("🧪 Testing batch parameter handling...");

    const { startPage, endPage, batchSize } = req.body;

    // Validate parameters
    const parsedStartPage = startPage ? parseInt(startPage) : null;
    const parsedEndPage = endPage ? parseInt(endPage) : null;
    const parsedBatchSize = batchSize ? parseInt(batchSize) : 5;

    // If file is provided, get actual page count
    let actualPageCount = null;
    if (req.file) {
      const PDFParser = require("pdf-parse");
      const dataBuffer = req.file.buffer;
      const pdfData = await PDFParser(dataBuffer);
      actualPageCount = pdfData.numpages;
    }

    // Calculate batches
    const result = {
      parsedParams: {
        startPage: parsedStartPage,
        endPage: parsedEndPage,
        batchSize: parsedBatchSize,
      },
      actualFile: {
        provided: !!req.file,
        pageCount: actualPageCount,
      },
      batchCalculations: null,
    };

    // If we have either actual page count or end page, calculate batches
    const pageCount = actualPageCount || parsedEndPage;
    if (pageCount) {
      const totalBatches = Math.ceil(pageCount / parsedBatchSize);
      const batches = [];

      for (let i = 0; i < totalBatches; i++) {
        const batchStart = i * parsedBatchSize + 1;
        const batchEnd = Math.min((i + 1) * parsedBatchSize, pageCount);

        batches.push({
          batchNumber: i + 1,
          startPage: batchStart,
          endPage: batchEnd,
          pageCount: batchEnd - batchStart + 1,
        });
      }

      result.batchCalculations = {
        totalPages: pageCount,
        totalBatches,
        batches,
      };
    }

    console.log("✅ Batch parameter test successful");
    return res.json(result);
  } catch (error) {
    console.error("❌ Batch parameter test failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.post(
  "/upload_pdf_to_mathpix",
  upload.single("pdf"),
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ error: "PDF file required" });

      // Get page range parameters if provided
      const startPage = req.body.startPage
        ? parseInt(req.body.startPage)
        : null;
      const endPage = req.body.endPage ? parseInt(req.body.endPage) : null;

      const form = new FormData();
      form.append("file", req.file.buffer, req.file.originalname);

      // Create options object
      const options = {
        formats: ["markdown_with_ids", "images"],
        include_answer_box_crop: true,
        math_inline_delimiters: ["$", "$"],
        math_display_delimiters: ["$$", "$$"],
        sandbox: true,
      };

      // Add page range if provided
      if (startPage && endPage) {
        options.page_range = `${startPage}-${endPage}`;
        console.log(`🔍 Processing PDF pages ${startPage}-${endPage}`);
      }

      form.append("options_json", JSON.stringify(options));

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
    const {
      pdf_id,
      subject,
      banding,
      level,
      paper_name,
      paper_type,
      topic_label, // Changed from topic
      startPage, // Add these params
      endPage, // Add these params
    } = req.body;

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

    // Build the page range note if applicable
    const pageRangeNote =
      startPage && endPage
        ? `- Focus only on pages ${startPage} to ${endPage}.`
        : "";

    const prompt = `You will be given a full exam worksheet in Markdown format. It includes questions, math expressions (in LaTeX), and a final answer key.

Instructions:
- Extract each question's number and full text.
- Keep all LaTeX expressions exactly as-is, including delimiters like \\( ... \\) and $$ ... $$.
- Extract answer options (if present).
- Extract image URLs for each question (from ![Diagram](...)).
- Match the correct answer for each question using the final answer section.
${pageRangeNote}

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
  "topic_label": "${topic_label || ""}"
}`;

    const result = await model.generateContent([
      { text: `${prompt}\n\n${markdownContent}` },
    ]);

    const raw =
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("📝 Gemini raw response:\n", raw);
    const jsonMatch = raw.match(/\[\s*{[\s\S]+?}\s*\]/);

    const parsed = JSON.parse(jsonMatch[0]);

    // Extract correct image URLs in order from lines.mmd.json
    const pages = linesRes.data.pages || [];
    const orderedImageUrls = [];
    for (const page of pages) {
      // If startPage and endPage are defined, filter pages by range
      if (
        startPage &&
        endPage &&
        (page.page_num < startPage || page.page_num > endPage)
      ) {
        continue; // Skip pages outside the requested range
      }

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

      // Add page information if available
      if (startPage && endPage) {
        q.page_range = `${startPage}-${endPage}`;
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
// === Step 2: Upload extracted image paths to your S3 ===
router.post("/upload_extracted_images_to_s3", async (req, res) => {
  try {
    const {
      paper_name,
      subject,
      banding,
      level,
      questions,
      paper_type,
      topic_label,
    } = req.body;
    if (!questions || !paper_name || !subject || !banding || !level) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const updatedQuestions = await Promise.all(
      questions.map(async (question) => {
        // Changed 'q' to 'question' for clarity
        if (!Array.isArray(question.image_path)) return question;

        const newPaths = await Promise.all(
          question.image_path.map(async (url, i) => {
            try {
              console.log(`📥 Downloading: ${url}`);
              const response = await axios.get(url, {
                responseType: "arraybuffer",
              });
              const buffer = Buffer.from(response.data, "binary");
              // Use question instead of q here
              const fileName = `page-custom_diagram_${question.question_number}_${i}.png`;
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
                `⚠️ Failed to upload image for Q${question.question_number}: ${err.message}`
              );
              return url;
            }
          })
        );

        return { ...question, image_path: newPaths };
      })
    );

    // ✅ Insert into PostgreSQL - include paper_type and topic_label
    await insertJSONPayload({
      paper_name,
      subject,
      banding,
      level,
      questions: updatedQuestions,
      paper_type, // Include these
      topic_label, // Include these
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
