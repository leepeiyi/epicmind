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
const fs = require("fs-extra");
const { PDFDocument } = require("pdf-lib");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const { Pool } = require("pg");

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
const { json } = require("stream/consumers");
const {
  parseLatexSafeJsonResponse,
  getImprovedQuestionPrompt,
  getImprovedAnswerPrompt,
} = require("../../utils/latex-parser");

const { Base64Utils } = require("../../utils/latex-parser");
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

router.post("/split_batch", upload.single("pdf"), async (req, res) => {
  try {
    const { startPage, endPage } = req.body;
    const start = parseInt(startPage, 10);
    const end = parseInt(endPage, 10);

    if (!req.file) {
      return res.status(400).json({ error: "No PDF uploaded." });
    }

    const pdfPath = req.file.path;
    const fullPdfBytes = req.file.buffer;
    const fullPdfDoc = await PDFDocument.load(fullPdfBytes);
    const totalPages = fullPdfDoc.getPageCount();

    if (start < 1 || end > totalPages || start > end) {
      return res.status(400).json({ error: "Invalid page range." });
    }

    const newPdfDoc = await PDFDocument.create();
    const copiedPages = await newPdfDoc.copyPages(
      fullPdfDoc,
      Array.from({ length: end - start + 1 }, (_, i) => i + start - 1)
    );
    copiedPages.forEach((page) => newPdfDoc.addPage(page));

    const newPdfBytes = await newPdfDoc.save();
    const batchFilename = `split_batch_${uuidv4()}.pdf`;
    const batchFilePath = path.join("uploads", batchFilename);

    await fs.ensureDir("uploads"); // ✅ makes sure uploads folder exists
    await fs.writeFile(batchFilePath, newPdfBytes);

    // Respond with path to batch file (you can customize to serve as a downloadable file or pass as a buffer)
    res.json({ batch_path: batchFilePath });
  } catch (error) {
    console.error("❌ Error splitting PDF:", error);
    res.status(500).json({ error: "Failed to split PDF batch." });
  } finally {
    if (req.file?.path) await fs.remove(req.file.path); // clean original upload
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
      topic_label,
      startPage,
      endPage,
    } = req.body;

    if (!pdf_id || !subject || !banding || !level || !paper_name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!paper_type || paper_type === "undefined") {
      return res.status(400).json({
        error: "Invalid paper_type. Must be 'exam' or 'topical'",
      });
    }

    console.log(`🔍 Extracting questions for paper: ${paper_name}`);

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
    const pageRangeNote =
      startPage && endPage
        ? `- Focus only on pages ${startPage} to ${endPage}.`
        : "";

    // Use improved prompt
    const prompt = getImprovedQuestionPrompt(
      markdownContent,
      subject,
      banding,
      level,
      paper_type,
      topic_label,
      pageRangeNote
    );

    console.log(
      `📝 Sending ${markdownContent.length} chars to Gemini for question extraction`
    );

    const result = await model.generateContent([{ text: prompt }]);

    const raw =
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!raw) {
      throw new Error("Gemini returned empty response for question extraction");
    }

    console.log(`📝 Gemini response length: ${raw.length}`);

    let parsed;
    try {
      // Use unified parser with questions mode
      parsed = await parseLatexSafeJsonResponse(raw, "questions");
      usesBase64 = parsed.some((q) => q._uses_base64);
      parsingMethods = [...new Set(parsed.map((q) => q._parsing_method))];
      console.log(`✅ Successfully parsed ${parsed.length} questions`);
    } catch (parseError) {
      console.error("❌ Question parsing failed:", parseError.message);

      // Log the error for debugging
      try {
        const logClient = await pool.connect();
        await logClient.query(
          `INSERT INTO logs (paper_name, log_type, message)
           VALUES ($1, 'question_parse_error', $2)`,
          [
            paper_name,
            `Parse error: ${parseError.message}\nRaw response: ${raw.substring(
              0,
              1000
            )}`,
          ]
        );
        logClient.release();
      } catch (logErr) {
        console.error(
          "❌ Failed to write parse error to logs:",
          logErr.message
        );
      }

      return res.status(500).json({
        error: "Failed to parse questions from Gemini response",
        details: parseError.message,
        suggestions: [
          "Try processing smaller page ranges (2–3 pages at a time)",
          "Check if PDF contains unusual mathematical notation or tables",
          "Consider manual question entry for complex content",
          "Verify PDF quality and text clarity",
        ],
        rawPreview: raw.substring(0, 300),
        debugInfo: {
          responseLength: raw.length,
          containsJson: raw.includes("[") && raw.includes("]"),
          containsLatex: raw.includes("\\"),
          paperInfo: { paper_name, subject, banding, level, paper_type },
          parsing_methods_used: parsingMethods,
          base64_fallback_used: usesBase64,
        },
      });
    }

    // Process images (existing logic)
    const pages = linesRes.data.pages || [];
    const orderedImageUrls = [];

    for (const page of pages) {
      if (
        startPage &&
        endPage &&
        (page.page_num < startPage || page.page_num > endPage)
      ) {
        continue;
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

    // Map images to questions
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

      if (startPage && endPage) {
        q.page_range = `${startPage}-${endPage}`;
      }

      return { ...q, image_path };
    });

    res.json({
      questions: updatedQuestions,
      debug: {
        totalQuestions: updatedQuestions.length,
        totalImages: orderedImageUrls.length,
        pageRange: startPage && endPage ? `${startPage}-${endPage}` : "all",
        processingMethod: "gemini_unified_parser",
        parsing_methods_used: parsingMethods,
        base64_fallback_used: usesBase64,
      },
    });
  } catch (err) {
    console.error("❌ Extract questions error:", err);

    // Enhanced error logging
    try {
      const logClient = await pool.connect();
      await logClient.query(
        `INSERT INTO logs (paper_name, log_type, message)
         VALUES ($1, 'extraction_error', $2)`,
        [
          paper_name || "UNKNOWN",
          `Full error: ${err.message}\nStack: ${err.stack}`,
        ]
      );
      logClient.release();
    } catch (logErr) {
      console.error(
        "❌ Failed to write extraction error to logs:",
        logErr.message
      );
    }

    return res.status(500).json({
      error: "Question extraction failed",
      detail: err.message,
      suggestions: [
        "Check Mathpix API connectivity",
        "Verify PDF uploaded successfully",
        "Try smaller page ranges",
        "Check system logs for detailed error info",
      ],
    });
  }
});

// Extract answers from Mathpix MMD
router.post("/extract_questions_from_mmd", async (req, res) => {
  try {
    const {
      pdf_id,
      subject,
      banding,
      level,
      paper_name,
      paper_type,
      topic_label,
      startPage,
      endPage,
    } = req.body;

    if (!pdf_id || !subject || !banding || !level || !paper_name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!paper_type || paper_type === "undefined") {
      return res.status(400).json({
        error: "Invalid paper_type. Must be 'exam' or 'topical'",
      });
    }

    console.log(`🔍 Extracting questions for paper: ${paper_name}`);

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
    const pageRangeNote =
      startPage && endPage
        ? `- Focus only on pages ${startPage} to ${endPage}.`
        : "";

    // Use improved prompt
    const prompt = getImprovedQuestionPrompt(
      markdownContent,
      subject,
      banding,
      level,
      paper_type,
      topic_label,
      pageRangeNote
    );

    console.log(
      `📝 Sending ${markdownContent.length} chars to Gemini for question extraction`
    );

    const result = await model.generateContent([{ text: prompt }]);

    const raw =
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!raw) {
      throw new Error("Gemini returned empty response for question extraction");
    }

    console.log(`📝 Gemini response length: ${raw.length}`);

    let parsed;
    let usesBase64, parsingMethods;

    try {
      // Use unified parser with questions mode
      parsed = await parseLatexSafeJsonResponse(raw, "questions");
      usesBase64 = parsed.some((q) => q._uses_base64);
      parsingMethods = [...new Set(parsed.map((q) => q._parsing_method))];
      console.log(`✅ Successfully parsed ${parsed.length} questions`);
    } catch (parseError) {
      console.error("❌ Question parsing failed:", parseError.message);

      // Log the error for debugging
      try {
        const logClient = await pool.connect();
        await logClient.query(
          `INSERT INTO logs (paper_name, log_type, message)
           VALUES ($1, 'question_parse_error', $2)`,
          [
            paper_name,
            `Parse error: ${parseError.message}\nRaw response: ${raw.substring(
              0,
              1000
            )}`,
          ]
        );
        logClient.release();
      } catch (logErr) {
        console.error(
          "❌ Failed to write parse error to logs:",
          logErr.message
        );
      }

      return res.status(500).json({
        error: "Failed to parse questions from Gemini response",
        details: parseError.message,
        suggestions: [
          "Try processing smaller page ranges (2–3 pages at a time)",
          "Check if PDF contains unusual mathematical notation or tables",
          "Consider manual question entry for complex content",
          "Verify PDF quality and text clarity",
        ],
        rawPreview: raw.substring(0, 300),
        debugInfo: {
          responseLength: raw.length,
          containsJson: raw.includes("[") && raw.includes("]"),
          containsLatex: raw.includes("\\"),
          paperInfo: { paper_name, subject, banding, level, paper_type },
          parsing_methods_used: parsingMethods,
          base64_fallback_used: usesBase64,
        },
      });
    }

    // ✅ FIXED: Preserve image URLs from Gemini extraction instead of replacing them
    // Extract all available image URLs from Mathpix lines data as backup
    const pages = linesRes.data.pages || [];
    const allMathpixImageUrls = [];

    for (const page of pages) {
      if (
        startPage &&
        endPage &&
        (page.page_num < startPage || page.page_num > endPage)
      ) {
        continue;
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
            allMathpixImageUrls.push(match[0]);
          }
        }
      }
    }

    // ✅ NEW LOGIC: Trust Gemini's image extraction, but validate and supplement if needed
    const updatedQuestions = parsed.map((q, questionIndex) => {
      let finalImagePaths = [];

      // First, try to extract image URLs directly from the question_text
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      const imagesInText = [];
      let match;

      while ((match = imageRegex.exec(q.question_text)) !== null) {
        imagesInText.push(match[2]);
      }

      if (imagesInText.length > 0) {
        // Use images found in question_text (most reliable)
        finalImagePaths = imagesInText;
        console.log(
          `✅ Q${q.question_number}: Found ${imagesInText.length} images in question_text`
        );
      } else if (Array.isArray(q.image_path) && q.image_path.length > 0) {
        // Fallback to Gemini's extracted image_path
        finalImagePaths = q.image_path;
        console.log(
          `⚠️ Q${q.question_number}: Using Gemini's image_path (${q.image_path.length} images)`
        );
      } else if (allMathpixImageUrls.length > questionIndex) {
        // Last resort: use Mathpix images sequentially
        finalImagePaths = [allMathpixImageUrls[questionIndex]];
        console.log(`🔄 Q${q.question_number}: Using Mathpix fallback image`);
      }

      // Add page range info if applicable
      const questionData = { ...q, image_path: finalImagePaths };
      if (startPage && endPage) {
        questionData.page_range = `${startPage}-${endPage}`;
      }

      return questionData;
    });

    console.log(
      `✅ Processed ${updatedQuestions.length} questions with preserved image URLs`
    );

    res.json({
      questions: updatedQuestions,
      debug: {
        totalQuestions: updatedQuestions.length,
        totalMathpixImages: allMathpixImageUrls.length,
        questionsWithImages: updatedQuestions.filter(
          (q) => q.image_path && q.image_path.length > 0
        ).length,
        pageRange: startPage && endPage ? `${startPage}-${endPage}` : "all",
        processingMethod: "gemini_unified_parser_with_preserved_images",
        parsing_methods_used: parsingMethods,
        base64_fallback_used: usesBase64,
      },
    });
  } catch (err) {
    console.error("❌ Extract questions error:", err);

    // Enhanced error logging
    try {
      const logClient = await pool.connect();
      await logClient.query(
        `INSERT INTO logs (paper_name, log_type, message)
         VALUES ($1, 'extraction_error', $2)`,
        [
          paper_name || "UNKNOWN",
          `Full error: ${err.message}\nStack: ${err.stack}`,
        ]
      );
      logClient.release();
    } catch (logErr) {
      console.error(
        "❌ Failed to write extraction error to logs:",
        logErr.message
      );
    }

    return res.status(500).json({
      error: "Question extraction failed",
      detail: err.message,
      suggestions: [
        "Check Mathpix API connectivity",
        "Verify PDF uploaded successfully",
        "Try smaller page ranges",
        "Check system logs for detailed error info",
      ],
    });
  }
});

router.post("/update_answer_keys_direct", async (req, res) => {
  try {
    const { paper_name, answers } = req.body;

    if (!paper_name || !Array.isArray(answers)) {
      return res
        .status(400)
        .json({ error: "Missing paper_name or answers array" });
    }

    let updated = 0;
    const grouped_answers = {};

    // Step 1: Group sub-questions under main question numbers
    for (const item of answers) {
      const { question_number, correct_answer } = item;
      if (!question_number) continue;

      // Extract the main question number (e.g., "3(a)" -> "3", "1b" -> "1")
      const mainQuestionMatch = question_number.match(/^(\d+)/);
      if (!mainQuestionMatch) {
        console.warn(
          `⚠️ Could not extract main question number from: ${question_number}`
        );
        continue;
      }

      const mainQuestionNum = mainQuestionMatch[1];

      // If this is a sub-question (contains letters or parentheses)
      if (/[a-zA-Z\(\)]/.test(question_number)) {
        if (!grouped_answers[mainQuestionNum]) {
          grouped_answers[mainQuestionNum] = [];
        }

        // Extract sub-part label (e.g., "3(a)" -> "(a)", "1b" -> "b")
        const subPartMatch = question_number.match(/\d+([a-zA-Z\(\)]+)/);
        const subPart = subPartMatch
          ? subPartMatch[1]
          : question_number.replace(/^\d+/, "");

        grouped_answers[mainQuestionNum].push({
          subPart,
          answer: correct_answer || "",
        });
      } else {
        // This is a main question without sub-parts
        grouped_answers[mainQuestionNum] = correct_answer || "";
      }
    }

    // Step 2: Update database with grouped answers
    for (const [mainQuestionNum, answerData] of Object.entries(
      grouped_answers
    )) {
      try {
        let finalAnswer;

        if (Array.isArray(answerData)) {
          // Multiple sub-parts - combine them
          const subAnswers = answerData
            .sort((a, b) => a.subPart.localeCompare(b.subPart)) // Sort sub-parts
            .map((item) => `${item.subPart} ${item.answer}`)
            .join(", ");
          finalAnswer = subAnswers;
        } else {
          // Single answer
          finalAnswer = answerData;
        }

        const answer_key = {
          question_number: mainQuestionNum,
          correct_answer: finalAnswer,
        };

        // Convert mainQuestionNum to integer for database query
        const questionNumInt = parseInt(mainQuestionNum, 10);

        if (isNaN(questionNumInt)) {
          console.warn(`⚠️ Invalid question number: ${mainQuestionNum}`);
          continue;
        }

        const result = await pool.query(
          `UPDATE question SET answer_key = $1 WHERE paper_name = $2 AND question_number = $3`,
          [JSON.stringify(answer_key), paper_name, questionNumInt]
        );

        if (result.rowCount > 0) {
          updated++;
          console.log(`✅ Updated Q${questionNumInt}: ${finalAnswer}`);
        } else {
          console.warn(
            `⚠️ No rows updated for Q${questionNumInt} in paper: ${paper_name}`
          );
        }
      } catch (updateError) {
        console.error(
          `❌ Failed to update Q${mainQuestionNum}:`,
          updateError.message
        );
        continue;
      }
    }

    console.log(
      `✅ Successfully updated ${updated} questions for paper: ${paper_name}`
    );
    res.json({
      success: true,
      updated,
      processed_questions: Object.keys(grouped_answers).length,
      details: Object.fromEntries(
        Object.entries(grouped_answers).map(([num, data]) => [
          num,
          Array.isArray(data)
            ? data.map((d) => d.subPart).join(", ")
            : "single answer",
        ])
      ),
    });
  } catch (err) {
    console.error("❌ Error in update_answer_keys_direct:", err);
    res
      .status(500)
      .json({ error: "Failed to update answers", details: err.message });
  }
});

// === Step 2: Upload extracted image paths to your S3 ===

// === Complete Fixed upload_extracted_images_to_s3 Route ===
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

    console.log(
      `🚀 Starting S3 upload and URL replacement for ${questions.length} questions`
    );

    const updatedQuestions = await Promise.all(
      questions.map(async (question) => {
        console.log(`\n🔄 Processing Q${question.question_number}`);

        // ✅ STEP 1: Extract ALL unique Mathpix URLs from all sources
        const allMathpixUrls = extractAllMathpixUrls(question);

        if (allMathpixUrls.length === 0) {
          console.log(
            `ℹ️ Q${question.question_number}: No Mathpix images to process`
          );
          return question;
        }

        console.log(
          `🔍 Found ${allMathpixUrls.length} unique Mathpix URLs to process`
        );

        // ✅ STEP 2: Upload to S3 and create URL mappings
        const urlMappings = await uploadImagesToS3(
          allMathpixUrls,
          paper_name,
          question.question_number
        );

        if (urlMappings.size === 0) {
          console.log(
            `⚠️ Q${question.question_number}: No successful uploads, keeping original URLs`
          );
          return question;
        }

        console.log(`✅ Successfully created ${urlMappings.size} URL mappings`);

        // ✅ STEP 3: Replace URLs in question_text (BULLETPROOF METHOD)
        const updatedQuestionText = replaceUrlsInQuestionText(
          question.question_text,
          urlMappings,
          question.question_number
        );

        // ✅ STEP 4: Update image_path array
        const updatedImagePath = updateImagePathArray(
          question.image_path,
          urlMappings
        );

        // ✅ STEP 5: Update image_paths array
        const updatedImagePaths = updateImagePathsArray(
          question.image_paths,
          urlMappings
        );

        // ✅ STEP 6: Add images from question_text to image_paths
        const finalImagePaths = addQuestionTextImagesToImagePaths(
          updatedQuestionText,
          updatedImagePaths
        );

        // ✅ STEP 7: Final verification
        const verification = verifyUrlReplacement(
          question,
          updatedQuestionText,
          finalImagePaths
        );
        console.log(
          `📊 Q${question.question_number} verification:`,
          verification
        );

        return {
          ...question,
          image_path: updatedImagePath,
          image_paths: finalImagePaths,
          question_text: updatedQuestionText,
        };
      })
    );

    // ✅ Insert into PostgreSQL
    await insertJSONPayload({
      paper_name,
      subject,
      banding,
      level,
      questions: updatedQuestions,
      paper_type,
      topic_label,
    });

    // ✅ Final summary
    const finalStats = generateFinalStats(updatedQuestions);
    console.log(`\n🎉 COMPLETE! Processing summary:`, finalStats);

    res.json({
      message: "✅ Successfully uploaded to S3 and updated all image URLs",
      questions: updatedQuestions,
      debug: finalStats,
    });
  } catch (err) {
    console.error("❌ Error in upload_extracted_images_to_s3:", err);
    res.status(500).json({
      error: "Upload/Insert failed: " + err.message,
      stack: err.stack,
    });
  }
});

// ✅ Helper function to extract all Mathpix URLs from a question
function extractAllMathpixUrls(question) {
  const allUrls = new Set();

  // From question_text
  const textUrls = extractUrlsFromText(question.question_text);
  textUrls.forEach((url) => allUrls.add(url));

  // From image_path array
  if (Array.isArray(question.image_path)) {
    question.image_path.forEach((url) => {
      if (typeof url === "string" && url.includes("cdn.mathpix.com")) {
        allUrls.add(url);
      }
    });
  }

  // From image_paths array
  if (Array.isArray(question.image_paths)) {
    question.image_paths.forEach((item) => {
      if (typeof item === "string" && item.includes("cdn.mathpix.com")) {
        allUrls.add(item);
      } else if (item && typeof item === "object") {
        if (item.image_url && item.image_url.includes("cdn.mathpix.com")) {
          allUrls.add(item.image_url);
        }
        if (item.url && item.url.includes("cdn.mathpix.com")) {
          allUrls.add(item.url);
        }
      }
    });
  }

  return Array.from(allUrls);
}

// ✅ Helper function to extract CDN URLs from text
function extractUrlsFromText(text) {
  if (!text || typeof text !== "string") return [];

  const urlRegex = /https:\/\/cdn\.mathpix\.com\/[^\s)]+/g;
  const matches = text.match(urlRegex) || [];
  return [...new Set(matches)]; // Remove duplicates
}

// ✅ Helper function to upload images to S3 and create mappings
async function uploadImagesToS3(urls, paperName, questionNumber) {
  const urlMappings = new Map();

  for (let index = 0; index < urls.length; index++) {
    const url = urls[index];
    try {
      console.log(
        `📥 Downloading ${index + 1}/${urls.length}: ${url.substring(0, 60)}...`
      );

      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000,
      });
      const buffer = Buffer.from(response.data, "binary");

      const fileName = `page-custom_diagram_${questionNumber}_${index}.png`;
      const key = `${paperName}/${fileName}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: "image/png",
        })
      );

      const s3Url = `https://${process.env.S3_BUCKET_NAME}.s3.${
        process.env.S3_REGION
      }.amazonaws.com/${encodeURIComponent(paperName)}/${fileName}`;

      urlMappings.set(url, s3Url);
      console.log(`✅ Uploaded: ${fileName}`);
    } catch (err) {
      console.warn(`⚠️ Failed to upload image ${index + 1}: ${err.message}`);
      // Continue with other images even if one fails
    }
  }

  return urlMappings;
}

// ✅ BULLETPROOF function to replace URLs in question text
function replaceUrlsInQuestionText(originalText, urlMappings, questionNumber) {
  console.log(`\n🔧 BULLETPROOF URL replacement for Q${questionNumber}`);

  let updatedText = originalText;

  // Step 1: Log what we're starting with
  const initialCdnUrls = extractUrlsFromText(originalText);
  console.log(
    `📝 Starting with ${initialCdnUrls.length} CDN URLs in question_text`
  );

  if (initialCdnUrls.length === 0) {
    console.log(`ℹ️ No CDN URLs found in question text`);
    return originalText;
  }

  // Step 2: Replace each CDN URL found in the text
  let replacementsMade = 0;

  for (let i = 0; i < initialCdnUrls.length; i++) {
    const cdnUrl = initialCdnUrls[i];
    console.log(`\n🔍 Processing URL ${i + 1}: ${cdnUrl.substring(0, 60)}...`);

    let replacementFound = false;

    // Method 1: Direct mapping lookup
    if (urlMappings.has(cdnUrl)) {
      const s3Url = urlMappings.get(cdnUrl);
      console.log(`   ✅ Direct mapping found`);

      // Count occurrences before replacement
      const beforeCount = updatedText.split(cdnUrl).length - 1;

      // Perform replacement using split/join (most reliable method)
      updatedText = updatedText.split(cdnUrl).join(s3Url);

      // Verify replacement
      const afterCount = updatedText.split(cdnUrl).length - 1;
      const actualReplacements = beforeCount - afterCount;

      if (actualReplacements > 0) {
        console.log(`   ✅ Replaced ${actualReplacements} occurrences`);
        replacementsMade += actualReplacements;
        replacementFound = true;
      }
    }

    // Method 2: Filename matching (fallback)
    if (!replacementFound) {
      console.log(`   🔄 Trying filename matching...`);

      const targetFilename = cdnUrl.split("/").pop().split("?")[0]; // Remove query params

      for (const [mappedUrl, s3Url] of urlMappings.entries()) {
        const mappedFilename = mappedUrl.split("/").pop().split("?")[0];

        if (targetFilename === mappedFilename) {
          console.log(`   ✅ Filename match found: ${targetFilename}`);

          const beforeCount = updatedText.split(cdnUrl).length - 1;
          updatedText = updatedText.split(cdnUrl).join(s3Url);
          const afterCount = updatedText.split(cdnUrl).length - 1;
          const actualReplacements = beforeCount - afterCount;

          if (actualReplacements > 0) {
            console.log(
              `   ✅ Replaced ${actualReplacements} occurrences via filename match`
            );
            replacementsMade += actualReplacements;
            replacementFound = true;
            break;
          }
        }
      }
    }

    // Method 3: Emergency fallback - use any available S3 URL
    if (!replacementFound && urlMappings.size > 0) {
      console.log(`   🚨 Using emergency fallback replacement`);
      const firstS3Url = Array.from(urlMappings.values())[0];

      const beforeCount = updatedText.split(cdnUrl).length - 1;
      updatedText = updatedText.split(cdnUrl).join(firstS3Url);
      const afterCount = updatedText.split(cdnUrl).length - 1;
      const actualReplacements = beforeCount - afterCount;

      if (actualReplacements > 0) {
        console.log(
          `   🔧 Emergency replacement made ${actualReplacements} occurrences`
        );
        replacementsMade += actualReplacements;
        replacementFound = true;
      }
    }

    if (!replacementFound) {
      console.log(`   ❌ No suitable replacement found for this URL`);
    }
  }

  // Step 3: Final verification
  const finalCdnUrls = extractUrlsFromText(updatedText);
  console.log(`\n📊 Replacement Summary for Q${questionNumber}:`);
  console.log(`   🔢 Started with: ${initialCdnUrls.length} CDN URLs`);
  console.log(`   ✅ Replacements made: ${replacementsMade}`);
  console.log(`   🔍 CDN URLs remaining: ${finalCdnUrls.length}`);
  console.log(`   📝 Text changed: ${originalText !== updatedText}`);

  if (finalCdnUrls.length === 0) {
    console.log(`   🎉 SUCCESS: All CDN URLs replaced!`);
  } else {
    console.log(`   ⚠️ WARNING: ${finalCdnUrls.length} CDN URLs still remain:`);
    finalCdnUrls.forEach((url, i) => {
      console.log(`      [${i}] ${url.substring(0, 80)}...`);
    });
  }

  return updatedText;
}

// ✅ Helper function to update image_path array
function updateImagePathArray(imagePath, urlMappings) {
  if (!Array.isArray(imagePath)) return [];

  return imagePath.map((url) => {
    if (typeof url === "string" && urlMappings.has(url)) {
      return urlMappings.get(url);
    }
    return url;
  });
}

// ✅ Helper function to update image_paths array
function updateImagePathsArray(imagePaths, urlMappings) {
  if (!Array.isArray(imagePaths)) return [];

  return imagePaths.map((item) => {
    if (typeof item === "string") {
      return urlMappings.get(item) || item;
    } else if (item && typeof item === "object") {
      const updated = { ...item };
      if (item.image_url) {
        updated.image_url = urlMappings.get(item.image_url) || item.image_url;
      }
      if (item.url) {
        updated.url = urlMappings.get(item.url) || item.url;
      }
      return updated;
    }
    return item;
  });
}

// ✅ Helper function to add question text images to image_paths
function addQuestionTextImagesToImagePaths(questionText, existingImagePaths) {
  const textUrls = extractUrlsFromText(questionText);
  const existingUrls = new Set();

  // Collect existing URLs to avoid duplicates
  existingImagePaths.forEach((item) => {
    if (typeof item === "string") {
      existingUrls.add(item);
    } else if (item && typeof item === "object") {
      if (item.image_url) existingUrls.add(item.image_url);
      if (item.url) existingUrls.add(item.url);
    }
  });

  const newImagePaths = [...existingImagePaths];

  // Add new URLs from question text
  textUrls.forEach((url) => {
    if (!existingUrls.has(url)) {
      newImagePaths.push({
        image_url: url,
        alt_text: "",
        source: "question_text",
      });
    }
  });

  return newImagePaths;
}

// ✅ Helper function to verify URL replacement success
function verifyUrlReplacement(
  originalQuestion,
  updatedText,
  updatedImagePaths
) {
  const originalCdnInText = extractUrlsFromText(
    originalQuestion.question_text
  ).length;
  const finalCdnInText = extractUrlsFromText(updatedText).length;

  const s3UrlsInText = (updatedText.match(/amazonaws\.com/g) || []).length;
  const s3UrlsInImagePaths = updatedImagePaths.filter((item) => {
    if (typeof item === "string") return item.includes("amazonaws.com");
    if (item && typeof item === "object") {
      return (
        (item.image_url && item.image_url.includes("amazonaws.com")) ||
        (item.url && item.url.includes("amazonaws.com"))
      );
    }
    return false;
  }).length;

  return {
    originalCdnInText,
    finalCdnInText,
    s3UrlsInText,
    s3UrlsInImagePaths,
    textReplacementSuccess: finalCdnInText === 0,
    textChanged: originalQuestion.question_text !== updatedText,
  };
}

// ✅ Helper function to generate final statistics
function generateFinalStats(questions) {
  return {
    totalQuestions: questions.length,
    questionsWithImagePath: questions.filter(
      (q) => q.image_path && q.image_path.length > 0
    ).length,
    questionsWithImagePaths: questions.filter(
      (q) => q.image_paths && q.image_paths.length > 0
    ).length,
    totalImagePathUrls: questions.reduce(
      (sum, q) => sum + (q.image_path ? q.image_path.length : 0),
      0
    ),
    totalImagePathsUrls: questions.reduce(
      (sum, q) => sum + (q.image_paths ? q.image_paths.length : 0),
      0
    ),
    s3UrlsInImagePath: questions.reduce(
      (sum, q) =>
        sum +
        (q.image_path
          ? q.image_path.filter(
              (url) => typeof url === "string" && url.includes("amazonaws.com")
            ).length
          : 0),
      0
    ),
    s3UrlsInImagePaths: questions.reduce(
      (sum, q) =>
        sum +
        (q.image_paths
          ? q.image_paths.filter((item) => {
              if (typeof item === "string")
                return item.includes("amazonaws.com");
              if (item && typeof item === "object") {
                return (
                  (item.image_url &&
                    item.image_url.includes("amazonaws.com")) ||
                  (item.url && item.url.includes("amazonaws.com"))
                );
              }
              return false;
            }).length
          : 0),
      0
    ),
    cdnUrlsStillRemaining: questions.reduce((sum, q) => {
      const textCdn = extractUrlsFromText(q.question_text).length;
      const pathCdn = q.image_path
        ? q.image_path.filter(
            (url) => typeof url === "string" && url.includes("cdn.mathpix.com")
          ).length
        : 0;
      const pathsCdn = q.image_paths
        ? q.image_paths.filter((item) => {
            if (typeof item === "string")
              return item.includes("cdn.mathpix.com");
            if (item && typeof item === "object") {
              return (
                (item.image_url &&
                  item.image_url.includes("cdn.mathpix.com")) ||
                (item.url && item.url.includes("cdn.mathpix.com"))
              );
            }
            return false;
          }).length
        : 0;
      return sum + textCdn + pathCdn + pathsCdn;
    }, 0),
    imagesAddedFromQuestionText: questions.reduce(
      (sum, q) =>
        sum +
        (q.image_paths
          ? q.image_paths.filter(
              (item) =>
                item &&
                typeof item === "object" &&
                item.source === "question_text"
            ).length
          : 0),
      0
    ),
  };
}

// Helper function to update existing papers with S3 image replacements
router.post("/update_paper_image_urls", async (req, res) => {
  try {
    const { paper_name } = req.body;

    if (!paper_name) {
      return res.status(400).json({ error: "Paper name is required" });
    }

    console.log(`🔄 Updating image URLs for paper: ${paper_name}`);

    // Get all questions for this paper
    const questionsResult = await pool.query(
      "SELECT * FROM question WHERE paper_name = $1 ORDER BY question_number",
      [paper_name]
    );

    if (questionsResult.rows.length === 0) {
      return res.status(404).json({ error: "Paper not found" });
    }

    let updatedCount = 0;

    for (const question of questionsResult.rows) {
      let questionText = question.question_text;
      let hasUpdates = false;
      const imagePaths = question.image_paths || [];

      // Find CDN URLs in question text and replace with S3 URLs if available
      const imageRegex = /!\[([^\]]*)\]\(https:\/\/cdn\.mathpix\.com\/[^)]+\)/g;

      questionText = questionText.replace(
        imageRegex,
        (match, altText, offset, string) => {
          // Extract the CDN URL
          const urlMatch = match.match(/!\[([^\]]*)\]\(([^)]+)\)/);
          if (!urlMatch) return match;

          const cdnUrl = urlMatch[2];

          // Look for corresponding S3 URL in image_paths
          const s3Url = imagePaths.find(
            (path) =>
              typeof path === "string" &&
              path.includes(process.env.S3_BUCKET_NAME)
          );

          if (s3Url) {
            hasUpdates = true;
            console.log(
              `🔄 Replacing CDN URL with S3 URL in Q${question.question_number}`
            );
            return `![${altText}](${s3Url})`;
          }

          return match; // Keep original if no S3 URL found
        }
      );

      // Update the database if changes were made
      if (hasUpdates) {
        await pool.query(
          "UPDATE question SET question_text = $1 WHERE id = $2",
          [questionText, question.id]
        );
        updatedCount++;
        console.log(`✅ Updated Q${question.question_number}`);
      }
    }

    res.json({
      success: true,
      message: `Updated ${updatedCount} questions with S3 image URLs`,
      paper_name,
      updated_questions: updatedCount,
      total_questions: questionsResult.rows.length,
    });
  } catch (error) {
    console.error("❌ Error updating paper image URLs:", error);
    res.status(500).json({
      error: "Failed to update image URLs",
      details: error.message,
    });
  }
});

// Utility function to extract and validate image URLs from question text
function extractImageUrlsFromText(text) {
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const urls = [];
  let match;

  while ((match = imageRegex.exec(text)) !== null) {
    urls.push({
      altText: match[1],
      url: match[2],
      isS3: match[2].includes(process.env.S3_BUCKET_NAME || "amazonaws.com"),
      isCDN: match[2].includes("cdn.mathpix.com"),
    });
  }

  return urls;
}

// Debug endpoint to check image URL status for a paper
router.get("/debug/paper_image_urls/:paper_name", async (req, res) => {
  try {
    const { paper_name } = req.params;

    const questionsResult = await pool.query(
      "SELECT question_number, question_text, image_paths FROM question WHERE paper_name = $1 ORDER BY question_number",
      [paper_name]
    );

    const analysis = questionsResult.rows.map((question) => {
      const textUrls = extractImageUrlsFromText(question.question_text);
      const storedPaths = question.image_paths || [];

      return {
        question_number: question.question_number,
        text_images: textUrls,
        stored_image_paths: storedPaths,
        has_cdn_in_text: textUrls.some((img) => img.isCDN),
        has_s3_in_text: textUrls.some((img) => img.isS3),
        needs_update:
          textUrls.some((img) => img.isCDN) &&
          storedPaths.some(
            (path) =>
              typeof path === "string" &&
              path.includes(process.env.S3_BUCKET_NAME || "amazonaws.com")
          ),
      };
    });

    res.json({
      paper_name,
      total_questions: questionsResult.rows.length,
      questions_with_cdn_urls: analysis.filter((q) => q.has_cdn_in_text).length,
      questions_needing_update: analysis.filter((q) => q.needs_update).length,
      analysis,
    });
  } catch (error) {
    console.error("❌ Error analyzing paper image URLs:", error);
    res.status(500).json({ error: "Analysis failed", details: error.message });
  }
});

// === Direct PDF Answer Extraction Route ===
// Add this to your existing mathpix.js router

router.post(
  "/extract_answers_from_pdf",
  upload.single("pdf"),
  async (req, res) => {
    try {
      const { paper_name, subject, level, banding } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: "PDF file required" });
      }

      if (!paper_name) {
        return res.status(400).json({ error: "Paper name is required" });
      }

      console.log(`🔍 Extracting answers directly from PDF for: ${paper_name}`);

      // Extract text from PDF using pdf-parse
      const dataBuffer = req.file.buffer;
      let pdfText = "";

      try {
        const pdfData = await PDFParser(dataBuffer);
        pdfText = pdfData.text;
        console.log(`📄 Extracted ${pdfText.length} characters from PDF`);
      } catch (pdfError) {
        console.error("❌ PDF parsing failed:", pdfError);
        return res.status(500).json({
          error: "Failed to parse PDF",
          details: pdfError.message,
        });
      }

      if (!pdfText || pdfText.trim().length < 50) {
        return res.status(400).json({
          error:
            "PDF appears to be empty or contains mostly images. Consider using OCR.",
          suggestion:
            "Try uploading through Mathpix first for better OCR results",
        });
      }

      // Enhanced prompt for answer extraction from answer key PDFs
      const prompt = `
You are an expert at extracting answer keys from educational documents. I will provide you with text from an answer key/marking scheme PDF.

Your task is to extract ALL answers and convert them to a structured JSON format.

EXTRACTION RULES:
1. Look for question numbers (1, 2, 3, Q1, Q2, etc.) and their corresponding answers
2. Handle sub-questions like 1(a), 1(b), 2(i), 2(ii), etc.
3. Extract the FINAL ANSWER, not the working steps
4. For multiple choice questions, extract the correct option letter/number
5. For numerical answers, include units if present
6. For algebraic answers, preserve mathematical notation
7. Ignore marking schemes like [M1], [A1], [B2] - focus on actual answers
8. If an answer has multiple acceptable forms, choose the most standard one

RESPONSE FORMAT:
Return a JSON array where each object has:
{
  "question_number": "1" or "1a" or "2(i)" etc.,
  "correct_answer": "the actual answer",
  "confidence": "high|medium|low",
  "answer_type": "multiple_choice|numerical|algebraic|text"
}

EXAMPLE OUTPUT:
[
  {
    "question_number": "1a",
    "correct_answer": "8y²/x",
    "confidence": "high",
    "answer_type": "algebraic"
  },
  {
    "question_number": "1b", 
    "correct_answer": "2q/(1-pq)",
    "confidence": "high",
    "answer_type": "algebraic"
  },
  {
    "question_number": "2a",
    "correct_answer": "1/(x+3)",
    "confidence": "high", 
    "answer_type": "algebraic"
  }
]

IMPORTANT:
- Return ONLY valid JSON, no markdown formatting or explanations
- Extract answers in the order they appear
- Be conservative with confidence - use "medium" or "low" if unsure
- For complex expressions, preserve mathematical notation exactly

PDF CONTENT:
${pdfText}
`;

      console.log(
        `📝 Sending ${pdfText.length} chars to Gemini for answer extraction`
      );

      // Call Gemini API
      const result = await model.generateContent([{ text: prompt }]);
      const raw =
        result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!raw) {
        throw new Error("Gemini returned empty response for answer extraction");
      }

      console.log(`💬 Gemini response length: ${raw.length}`);

      let answersData;
      try {
        // Use unified parser with answers mode
        answersData = await parseLatexSafeJsonResponse(raw, "answers");
        const usesBase64 = answersData.some((a) => a._uses_base64);
        const parsingMethods = [
          ...new Set(answersData.map((a) => a._parsing_method)),
        ];
        console.log(`✅ Successfully parsed ${answersData.length} answers`);
      } catch (parseError) {
        console.error("❌ Answer parsing failed:", parseError.message);

        // Log the error for debugging
        try {
          const logClient = await pool.connect();
          await logClient.query(
            `INSERT INTO logs (paper_name, log_type, message)
           VALUES ($1, 'direct_pdf_parse_error', $2)`,
            [
              paper_name,
              `Parse error: ${
                parseError.message
              }\nRaw response: ${raw.substring(0, 1000)}`,
            ]
          );
          logClient.release();
        } catch (logErr) {
          console.error(
            "❌ Failed to write parse error to logs:",
            logErr.message
          );
        }

        return res.status(500).json({
          error: "Failed to parse answers from Gemini response",
          details: parseError.message,
          suggestions: [
            "PDF may contain complex formatting or images",
            "Try using Mathpix OCR first for better text extraction",
            "Consider manual answer entry for this paper",
            "Check if PDF is a scanned document requiring OCR",
          ],
          rawPreview: raw.substring(0, 300),
          debugInfo: {
            responseLength: raw.length,
            containsJson: raw.includes("[") && raw.includes("]"),
            pdfTextLength: pdfText.length,
            paperName: paper_name,
            parsing_methods_used: parsingMethods,
            base64_fallback_used: usesBase64,
          },
        });
      }

      // Clean up and standardize the answers
      const cleanedAnswers = answersData.map((item) => ({
        question_number: String(item.question_number || "").trim(),
        correct_answer: (item.correct_answer || "").trim(),
        confidence: item.confidence || "medium",
        answer_type: item.answer_type || "text",
      }));

      // Sort answers by question number
      cleanedAnswers.sort((a, b) => {
        const aMatches = a.question_number.match(/^(\d+)([a-z\(\)i]*)$/i);
        const bMatches = b.question_number.match(/^(\d+)([a-z\(\)i]*)$/i);

        if (aMatches && bMatches) {
          const aNum = parseInt(aMatches[1]);
          const bNum = parseInt(bMatches[1]);
          if (aNum !== bNum) return aNum - bNum;
          return (aMatches[2] || "").localeCompare(bMatches[2] || "");
        }

        return a.question_number.localeCompare(b.question_number);
      });

      console.log(
        `✅ Successfully extracted and cleaned ${cleanedAnswers.length} answers`
      );

      return res.json({
        success: true,
        answers: cleanedAnswers,
        paper_name: paper_name,
        debug: {
          totalAnswers: cleanedAnswers.length,
          processingMethod: "direct_pdf_gemini",
          pdfTextLength: pdfText.length,
          highConfidenceCount: cleanedAnswers.filter(
            (a) => a.confidence === "high"
          ).length,
          mediumConfidenceCount: cleanedAnswers.filter(
            (a) => a.confidence === "medium"
          ).length,
          lowConfidenceCount: cleanedAnswers.filter(
            (a) => a.confidence === "low"
          ).length,
          answerTypes: {
            algebraic: cleanedAnswers.filter(
              (a) => a.answer_type === "algebraic"
            ).length,
            numerical: cleanedAnswers.filter(
              (a) => a.answer_type === "numerical"
            ).length,
            multiple_choice: cleanedAnswers.filter(
              (a) => a.answer_type === "multiple_choice"
            ).length,
            text: cleanedAnswers.filter((a) => a.answer_type === "text").length,
          },
        },
      });
    } catch (error) {
      console.error("❌ Direct PDF answer extraction error:", error);

      // Enhanced error logging
      try {
        const logClient = await pool.connect();
        await logClient.query(
          `INSERT INTO logs (paper_name, log_type, message)
         VALUES ($1, 'direct_pdf_extraction_error', $2)`,
          [
            paper_name || "UNKNOWN",
            `Full error: ${error.message}\nStack: ${error.stack}`,
          ]
        );
        logClient.release();
      } catch (logErr) {
        console.error(
          "❌ Failed to write extraction error to logs:",
          logErr.message
        );
      }

      return res.status(500).json({
        error: "Direct PDF answer extraction failed: " + error.message,
        suggestions: [
          "Ensure PDF contains readable text (not just images)",
          "Try using Mathpix OCR route for scanned documents",
          "Check PDF file integrity",
          "Consider manual answer entry as fallback",
          "Check system logs for detailed error info",
        ],
      });
    }
  }
);

// Enhanced route that can handle both PDF text extraction AND OCR via Mathpix
router.post(
  "/extract_answers_smart",
  upload.single("pdf"),
  async (req, res) => {
    try {
      const { paper_name, force_ocr } = req.body;

      if (!req.file || !paper_name) {
        return res
          .status(400)
          .json({ error: "PDF file and paper name required" });
      }

      console.log(`🤖 Smart answer extraction for: ${paper_name}`);

      let textContent = "";
      let extractionMethod = "";

      // First, try direct PDF text extraction
      if (!force_ocr) {
        try {
          const pdfData = await PDFParser(req.file.buffer);
          textContent = pdfData.text;

          if (textContent && textContent.trim().length > 100) {
            extractionMethod = "direct_pdf_text";
            console.log(
              `✅ Direct PDF text extraction successful: ${textContent.length} chars`
            );
          }
        } catch (pdfError) {
          console.log(
            `⚠️ Direct PDF extraction failed, will try OCR: ${pdfError.message}`
          );
        }
      }

      // Now extract answers using Gemini (reuse the same logic from above)
      const prompt = getImprovedAnswerPrompt(textContent);

      const result = await model.generateContent([{ text: prompt }]);
      const raw =
        result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!raw) {
        throw new Error("Gemini returned empty response");
      }

      answersData = await parseLatexSafeJsonResponse(raw, "answers");
      const usesBase64 = answersData.some((a) => a._uses_base64);
      const parsingMethods = [
        ...new Set(answersData.map((a) => a._parsing_method)),
      ];
      const cleanedAnswers = answersData.map((item) => ({
        question_number: String(item.question_number || "").trim(),
        correct_answer: (item.correct_answer || "").trim(),
        confidence: item.confidence || "medium",
        answer_type: item.answer_type || "text",
      }));

      return res.json({
        success: true,
        answers: cleanedAnswers,
        paper_name: paper_name,
        extraction_method: extractionMethod,
        debug: {
          totalAnswers: cleanedAnswers.length,
          textLength: textContent.length,
          extractionMethod: extractionMethod,
          parsing_methods_used: parsingMethods,
          base64_fallback_used: usesBase64,
        },
      });
    } catch (error) {
      console.error("❌ Smart extraction error:", error);
      return res.status(500).json({
        error: "Smart answer extraction failed: " + error.message,
      });
    }
  }
);

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

router.post("/image_to_s3", upload.single("image"), async (req, res) => {
  try {
    const file = req.file;
    const { paper_name, question_number } = req.body;

    if (!file || !paper_name) {
      return res
        .status(400)
        .json({ error: "Missing required image or paper_name" });
    }

    const extension = path.extname(file.originalname) || ".png";
    const cleanName = file.originalname.replace(/\s+/g, "_");

    const keyParts = [paper_name];
    if (question_number) keyParts.push(`Q${question_number}`);
    keyParts.push(`${uuidv4()}_${cleanName}`);

    const s3Key = keyParts.join("/");

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${
      process.env.S3_REGION
    }.amazonaws.com/${encodeURIComponent(s3Key)}`;

    res.json({ imageUrl });
  } catch (err) {
    console.error("❌ Failed to upload image to S3:", err);
    res.status(500).json({ error: "Upload to S3 failed", detail: err.message });
  }
});

router.post("/gemini/split-question-parts", async (req, res) => {
  const { question_text, answer_key_text } = req.body;
  console.log("🔍 Gemini question splitting request received");

  if (!question_text || !answer_key_text) {
    return res
      .status(400)
      .json({ error: "Missing question_text or answer_key_text" });
  }

  try {
    const prompt = `
You are helping to parse a mathematics question and its answer key into structured sub-questions.

RULES:
- Split the full question into logical parts, e.g., (a), (b), (a)(i), (ii), etc.
- Each sub-part must have:
  - "part_label" like "(a)", "(i)", "(b)", etc.
  - "text": the actual question text for that part.
  - "answer": match this part with the corresponding portion of the answer_key_text.
- If a part is a "show that", "prove that", or similar (where the student is expected to derive a result), DO NOT include an answer field.
- The answer_key_text may include answers for parts (a), (b), (c), etc. Match accurately.

Return a JSON array like:
[
  {
    "part_label": "(a)",
    "text": "...",
    "answer": "..."
  },
  {
    "part_label": "(b)",
    "text": "...",
    "answer": "..."
  },
  {
    "part_label": "(c)(i)",
    "text": "Show that ...",
    "answer": null
  }
]

QUESTION:
${question_text}

ANSWER KEY:
${answer_key_text}

Return only valid JSON, no markdown, no extra commentary.
`;

    const result = await model.generateContent([{ text: prompt }]);
    console.log(result);
    const raw =
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Strip possible code block markers
    const cleaned = raw.replace(/^```json\s*|```\s*$/g, "").trim();

    const parsed = JSON.parse(cleaned);
    return res.json({ parts: parsed });
  } catch (err) {
    console.error("❌ Gemini question splitting error:", err.message);
    return res
      .status(500)
      .json({ error: "Failed to process with Gemini", detail: err.message });
  }
});

router.post("/gemini/check-answer-similarity", async (req, res) => {
  const { user_answer, correct_answer, question_context } = req.body;

  if (!user_answer || !correct_answer) {
    return res
      .status(400)
      .json({ error: "Missing user_answer or correct_answer" });
  }

  const prompt = `Compare the student's answer with the correct answer in a math context.
- Ignore superficial differences like whitespace or formatting.
- Focus on whether the student logically gave the correct final result.
- Be tolerant of equivalent expressions.
- Use the question context to disambiguate notation if needed.

Respond in JSON format:
{
  "is_correct": true/false,
  "similarity": 0.0 to 1.0,
  "explanation": "short reason"
}

QUESTION: ${question_context || "N/A"}
STUDENT ANSWER: ${user_answer}
CORRECT ANSWER: ${correct_answer}`;

  try {
    const result = await model.generateContent([{ text: prompt }]);
    const output =
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON block found in Gemini response.");
    }
    const json = JSON.parse(jsonMatch[0]);

    res.json({
      is_correct: json.is_correct,
      similarity: json.similarity,
      explanation: json.explanation,
    });
  } catch (err) {
    console.error("❌ Gemini similarity check failed:", err);
    res.status(500).json({
      error: "Failed to evaluate answer similarity",
      details: err.message,
    });
  }
});

module.exports = router;
