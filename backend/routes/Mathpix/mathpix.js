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

async function parseGeminiJsonResponse(rawResponse) {
  const strategies = [
    // Strategy 1: Clean response and parse directly
    {
      name: "Direct parsing after cleanup",
      parse: (raw) => {
        const cleaned = raw.replace(/^```json\s*|```\s*$/gm, "").trim();
        const jsonMatch = cleaned.match(/\[\s*{[\s\S]*}\s*\]/);
        if (!jsonMatch) throw new Error("No JSON array found");
        return JSON.parse(jsonMatch[0]);
      },
    },

    // Strategy 2: Fix common LaTeX escaping issues
    {
      name: "LaTeX backslash normalization",
      parse: (raw) => {
        let cleaned = raw.replace(/^```json\s*|```\s*$/gm, "").trim();
        const jsonMatch = cleaned.match(/\[\s*{[\s\S]*}\s*\]/);
        if (!jsonMatch) throw new Error("No JSON array found");

        let jsonString = jsonMatch[0];

        // Fix over-escaped LaTeX commands
        jsonString = jsonString
          .replace(/\\\\\\\\([a-zA-Z_{}])/g, "\\\\$1") // \\\\log -> \\log
          .replace(/\\\\\\\\([()])/g, "\\\\$1") // \\\\( -> \\(
          .replace(/\\\\\\\\([{}])/g, "\\\\$1") // \\\\{ -> \\{
          .replace(/\\\\\\\\text/g, "\\\\text") // \\\\text -> \\text
          .replace(/\\\\\\\\frac/g, "\\\\frac") // \\\\frac -> \\frac
          .replace(/\\\\\\\\sqrt/g, "\\\\sqrt") // \\\\sqrt -> \\sqrt
          .replace(/\\\\\\\\log/g, "\\\\log") // \\\\log -> \\log
          .replace(/\\\\\\\\sin/g, "\\\\sin") // \\\\sin -> \\sin
          .replace(/\\\\\\\\cos/g, "\\\\cos"); // \\\\cos -> \\cos

        return JSON.parse(jsonString);
      },
    },

    // Strategy 3: Aggressive backslash reduction
    {
      name: "Aggressive backslash reduction",
      parse: (raw) => {
        let cleaned = raw.replace(/^```json\s*|```\s*$/gm, "").trim();
        const jsonMatch = cleaned.match(/\[\s*{[\s\S]*}\s*\]/);
        if (!jsonMatch) throw new Error("No JSON array found");

        let jsonString = jsonMatch[0];

        // More aggressive cleaning - reduce all multiple backslashes
        jsonString = jsonString
          .replace(/\\{4,}/g, "\\\\") // Any 4+ backslashes -> 2 backslashes
          .replace(/\\{3}/g, "\\\\") // Triple backslashes -> double
          .replace(/\\\\\\([a-zA-Z])/g, "\\\\$1"); // Clean up LaTeX commands

        return JSON.parse(jsonString);
      },
    },

    // Strategy 4: Character-by-character escape fixing
    {
      name: "Character-level escape fixing",
      parse: (raw) => {
        let cleaned = raw.replace(/^```json\s*|```\s*$/gm, "").trim();
        const jsonMatch = cleaned.match(/\[\s*{[\s\S]*}\s*\]/);
        if (!jsonMatch) throw new Error("No JSON array found");

        let jsonString = jsonMatch[0];

        // Fix specific problematic patterns seen in the error
        jsonString = jsonString
          .replace(/\\\\log_\{([^}]+)\}/g, "\\\\log_{$1}") // Fix log subscripts
          .replace(/\\\\log_([0-9]+)/g, "\\\\log_$1") // Fix simple log bases
          .replace(/\\\\sqrt\{([^}]*)\}/g, "\\\\sqrt{$1}") // Fix sqrt
          .replace(/\\\\frac\{([^}]*)\}\{([^}]*)\}/g, "\\\\frac{$1}{$2}") // Fix fractions
          .replace(/\\\\\(/g, "\\\\(") // Fix LaTeX delimiters
          .replace(/\\\\\)/g, "\\\\)");

        return JSON.parse(jsonString);
      },
    },

    // Strategy 5: Last resort - manual JSON reconstruction
    {
      name: "Manual JSON reconstruction",
      parse: (raw) => {
        // Extract just the question data using regex, then rebuild JSON manually
        const questions = [];
        const questionMatches = raw.matchAll(
          /\{\s*"question_number"\s*:\s*"([^"]+)"[\s\S]*?\}/g
        );

        for (const match of questionMatches) {
          try {
            // Try to parse individual question objects with fixes
            let questionJson = match[0].replace(
              /\\\\\\\\([a-zA-Z])/g,
              "\\\\$1"
            );
            const question = JSON.parse(questionJson);
            questions.push(question);
          } catch (e) {
            console.warn("Failed to parse individual question:", e.message);
          }
        }

        if (questions.length === 0) {
          throw new Error("No valid questions could be reconstructed");
        }

        return questions;
      },
    },
  ];

  // Try each strategy in order
  for (const strategy of strategies) {
    try {
      console.log(`🔧 Trying parsing strategy: ${strategy.name}`);
      const result = strategy.parse(rawResponse);

      if (Array.isArray(result) && result.length > 0) {
        console.log(`✅ Success with strategy: ${strategy.name}`);
        return result;
      } else {
        console.log(
          `⚠️ Strategy ${strategy.name} returned empty/invalid result`
        );
      }
    } catch (error) {
      console.log(`❌ Strategy ${strategy.name} failed:`, error.message);
      continue;
    }
  }

  // If all strategies fail
  throw new Error(
    "All JSON parsing strategies failed. Gemini response may be fundamentally malformed."
  );
}

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

    // Validation
    if (!pdf_id || !subject || !banding || !level || !paper_name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!paper_type || paper_type === "undefined") {
      return res.status(400).json({
        error: "Invalid paper_type. Must be 'exam' or 'topical'",
      });
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
    const pageRangeNote =
      startPage && endPage
        ? `- Focus only on pages ${startPage} to ${endPage}.`
        : "";

    // ✅ IMPROVED PROMPT - Critical LaTeX escaping instructions
    const prompt = `You are extracting questions from an exam worksheet in Markdown format.

CRITICAL JSON & LaTeX FORMATTING RULES:
1. For LaTeX expressions: Use SINGLE backslashes only
   - Correct: "\\log_2 x", "\\frac{1}{2}", "\\sqrt{x}"
   - WRONG: "\\\\log_2 x", "\\\\\\\\frac{1}{2}"
2. Return VALID JSON without markdown code blocks
3. No json markers in your response
4. Escape quotes in strings with \"
5. Keep LaTeX delimiters as-is: \\( ... \\) and $ ... $

Instructions:
- Extract each question's number and full text
- Extract answer options (if present)  
- Extract image URLs from ![Diagram](...) 
- Match correct answers from answer section
${pageRangeNote}

EXAMPLE OUTPUT FORMAT (no code blocks): do not give question numbers like "b", if you are not sure about the question number of that question, either analyse the next or previous question to find out. for example if next question is 17, you should deduce that this question is 16.
[{
  "question_number": "1",
  "question_text": "Solve \\(\\log_2 x = 3\\)",
  "answer_options": [{"option": "A", "text": "x = 8"}],
  "answer_key": {"question_number": "1", "correct_answer": "8"},
  "image_path": [],
  "subject": "${subject}",
  "banding": "${banding}",
  "level": "${level}",
  "paper_type": "${paper_type}",
  "topic_label": "${topic_label || ""}"
}]

Return the JSON array directly:`;

    const result = await model.generateContent([
      { text: `${prompt}\n\n${markdownContent}` },
    ]);

    const raw =
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("📝 Gemini raw response length:", raw.length);
    console.log("📝 First 300 chars:", raw.substring(0, 300));

    // ✅ COMPREHENSIVE JSON PARSING with multiple strategies
    let parsed;

    try {
      parsed = await parseGeminiJsonResponse(raw);
      console.log(`✅ Successfully parsed ${parsed.length} questions`);
    } catch (parseError) {
      console.error(
        "❌ All JSON parsing strategies failed:",
        parseError.message
      );

      // Log to database
      try {
        const logClient = await pool.connect();
        await logClient.query(
          `INSERT INTO logs (paper_name, log_type, message)
     VALUES ($1, 'error', $2)`,
          [
            paper_name || "UNKNOWN",
            `Gemini JSON parse failure: ${parseError.message}`,
          ]
        );
        logClient.release();
      } catch (logErr) {
        console.error("❌ Failed to write to logs table:", logErr.message);
      }

      return res.status(500).json({
        error: "Failed to parse Gemini response as valid JSON",
        details: parseError.message,
        suggestions: [
          "Gemini may not be following LaTeX escaping rules",
          "Try processing a smaller page range",
          "Check if PDF contains unusual mathematical notation",
        ],
        rawPreview: raw.substring(0, 500),
      });
    }

    // Continue with image processing...
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

    // Replace image paths with correct ones
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

    res.json({ questions: updatedQuestions });
  } catch (err) {
    console.error("❌ Extract from MMD + Gemini error:", err);
    try {
      const logClient = await pool.connect();
      await logClient.query(
        `INSERT INTO logs (paper_name, log_type, message)
         VALUES ($1, 'error', $2)`,
        [paper_name || "UNKNOWN", `Route error: ${err.message}`]
      );
      logClient.release();
    } catch (logErr) {
      console.error(
        "❌ Failed to write top-level error to logs:",
        logErr.message
      );
    }
  }
});

// Extract answers from Mathpix MMD
router.post("/extract_answers_from_mmd", async (req, res) => {
  try {
    const { pdf_id, paper_name } = req.body;

    if (!pdf_id) {
      return res.status(400).json({ error: "PDF ID is required" });
    }

    console.log(`📝 Extracting answers from Mathpix for PDF ID: ${pdf_id}`);

    // Get the Mathpix MMD and lines data for the PDF
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

    // Extract the raw MMD text
    let mmdText = "";
    if (mmdRes.data && typeof mmdRes.data === "string") {
      mmdText = mmdRes.data;
    } else if (mmdRes.data && mmdRes.data.mmd) {
      mmdText = mmdRes.data.mmd;
    }
    console.log(mmdText);
    if (!mmdText) {
      console.error("❌ Invalid MMD data structure:", mmdRes.data);
      return res
        .status(400)
        .json({ error: "Failed to extract MMD content from Mathpix" });
    }

    console.log(`📋 Extracted ${mmdText.length} characters of MMD text`);

    // Use Gemini AI with a more specific prompt to extract mathematical answers
    const geminiResponse = await axios.post(
      "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent",
      {
        contents: [
          {
            parts: [
              {
                text: `
                You are an expert mathematics answer parser. Parse this mathematics answer key document and extract all question answers.

                IMPORTANT GUIDELINES:
                answer is usually at the end of the question so before the end 
                1. Extract ONLY the answers, not the working or solutions
                2. Watch for tabular layouts with question numbers like "1a", "1b", "2a", etc.
                3. For questions with LaTeX, extract just the final result, not all steps
                4. If the answer is a numerical value or expression, extract it exactly
                5. For multiple-choice questions, just extract the letter (A, B, C, D)
                6. Handle complex mathematical notation correctly

                Return a JSON array where each object has:
                Take the list of math answers from the document and regroup them by main number:
                - If question_number is 1a, 1b, 1c — group under 1
                - Format each sub-answer as (a), (b), etc.
                - Return a JSON array like: 
                  [{ "question_number": "1", "correct_answer": "(a) ..., (b) ..." }, ...]
                - correct_answer: The answer, which may be a numerical value, expression, letter, or mathematical result
                - confidence: Your confidence level (high, medium, low)
                
                ANSWER KEY CONTENT:
                ${mmdText}
                
                FORMAT AS VALID JSON WITHOUT CODE BLOCK MARKERS.
                `,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topP: 0.8,
          topK: 16,
          maxOutputTokens: 8192,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
      }
    );

    // --- Start of modifications for response handling ---

    // Safely access the generated text from the Gemini response
    const geminiGeneratedText =
      geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!geminiGeneratedText) {
      console.error(
        "❌ Gemini did not return a valid text response or it was filtered."
      );
      return res.status(500).json({
        error:
          "Failed to get generated text from Gemini API. Response may be empty or filtered.",
        rawGeminiResponse: geminiResponse.data, // Log the full data for debugging
      });
    }

    console.log(
      "💬 Gemini response (first 200 chars):",
      geminiGeneratedText.substring(0, 200) + "..."
    );

    let answersData;
    try {
      // The model often wraps the JSON in markdown code blocks (```json...```)
      // We need to remove these markers before parsing.
      // Use a more robust regex to ensure it catches variations and newlines.
      const cleanedResponse = geminiGeneratedText
        .replace(/^```json\s*|```\s*$/g, "") // Remove '```json\n' from start and '\n```' from end, including any surrounding whitespace
        .trim(); // Trim any remaining whitespace

      answersData = JSON.parse(cleanedResponse);

      // Ensure it's always an array, even if Gemini returns a single object
      if (!Array.isArray(answersData)) {
        answersData = [answersData];
      }

      // Clean up and standardize the question numbers
      answersData = answersData.map((item) => {
        if (item.question_number !== undefined) {
          // Convert to string to handle cases where it might be a number
          item.question_number = String(item.question_number);
          // Optional: Trim whitespace from question_number if necessary
          item.question_number = item.question_number.trim();
        }
        // Optional: Trim whitespace from correct_answer if necessary
        if (item.correct_answer && typeof item.correct_answer === "string") {
          item.correct_answer = item.correct_answer.trim();
        }
        return item;
      });

      // Sort by question number (this logic looks good for alphanumeric)
      answersData.sort((a, b) => {
        if (!a.question_number || !b.question_number) return 0;

        const aMatches = a.question_number.match(/^(\d+)([a-z]*)$/i);
        const bMatches = b.question_number.match(/^(\d+)([a-z]*)$/i);

        if (aMatches && bMatches) {
          const aNum = parseInt(aMatches[1]);
          const bNum = parseInt(bMatches[1]);

          if (aNum !== bNum) return aNum - bNum;

          // Compare the alphabetical part if numbers are equal
          return (aMatches[2] || "").localeCompare(bMatches[2] || "");
        }

        // Fallback for non-standard question numbers
        return a.question_number.localeCompare(b.question_number);
      });
    } catch (error) {
      console.error("❌ Failed to parse Gemini JSON response:", error);
      return res.status(500).json({
        error:
          "Failed to parse answer key data from Gemini. Response may be malformed JSON.",
        rawResponseContent: geminiGeneratedText, // Log the content that failed to parse
        parsingError: error.message,
      });
    }

    console.info(
      `✅ Successfully extracted ${answersData.length} answers from answer key`
    );

    // Return the structured answers
    return res.json({
      answers: answersData,
      paper_name: paper_name,
    });

    // --- End of modifications for response handling ---
  } catch (error) {
    console.error("❌ Error extracting answers from MMD:", error);
    // Log the full error object if it's an Axios error for more details
    if (axios.isAxiosError(error)) {
      console.error(
        "Axios error details:",
        error.response?.data || error.message
      );
    }
    return res
      .status(500)
      .json({ error: "Failed to extract answers: " + error.message });
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

    for (const item of answers) {
      const { question_number, correct_answer } = item;
      if (!question_number) continue;

      const answer_key = {
        question_number,
        correct_answer: correct_answer || "",
      };

      const result = await pool.query(
        `UPDATE question SET answer_key = $1 WHERE paper_name = $2 AND question_number = $3`,
        [JSON.stringify(answer_key), paper_name, question_number]
      );

      if (result.rowCount > 0) updated++;
    }

    res.json({ success: true, updated });
  } catch (err) {
    console.error("❌ Error in update_answer_keys_direct:", err);
    res
      .status(500)
      .json({ error: "Failed to update answers", details: err.message });
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
