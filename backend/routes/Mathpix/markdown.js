// backend/routes/markdown.js
const express = require("express");
const router = express.Router();
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const insertJSONPayload = require("../Mathpix/insertPostgresql");
const axios = require("axios");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
require("dotenv").config();

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Helper function to get file extension from mimetype
function getFileExtension(mimetype) {
  const extensions = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
  };
  return extensions[mimetype] || ".jpg";
}

// Helper function to sanitize filename
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, "_") // Replace special chars with underscore
    .replace(/_{2,}/g, "_") // Replace multiple underscores with single
    .toLowerCase();
}

// Helper function to download and upload image to S3
async function downloadAndUploadImage(
  mathpixUrl,
  paperName,
  questionNumber,
  imageIndex
) {
  try {
    console.log(`📥 Downloading image: ${mathpixUrl}`);

    const response = await axios.get(mathpixUrl, {
      responseType: "arraybuffer",
      timeout: 30000, // 30 second timeout
    });

    const buffer = Buffer.from(response.data, "binary");
    const fileName = `diagram_q${questionNumber}_${imageIndex}.png`;
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

    console.log(`✅ Uploaded image to S3: ${s3Url}`);
    return s3Url;
  } catch (err) {
    console.warn(`⚠️ Failed to upload image: ${err.message}`);
    return mathpixUrl; // Return original URL as fallback
  }
}

// Helper function to extract questions using Gemini
async function extractQuestionsFromMarkdown(markdownContent, paperMetadata) {
  const prompt = `You are extracting questions from a mathematics exam worksheet in Markdown format.

CRITICAL FORMATTING RULES:
1. For LaTeX expressions: Use SINGLE backslashes only
   - Correct: "\\log_2 x", "\\frac{1}{2}", "\\sqrt{x}"
   - WRONG: "\\\\log_2 x", "\\\\\\\\frac{1}{2}"
2. Return VALID JSON without markdown code blocks
3. No json markers in your response
4. Escape quotes in strings with \"
5. Keep LaTeX delimiters as-is: \\( ... \\) and $ ... $

Instructions:
- Extract each question's number and full text (preserve LaTeX formatting exactly)
- Extract answer options (A, B, C, D) if present
- Extract image URLs from ![...](https://cdn.mathpix.com/cropped/...) do not modify these URLs
- Do NOT change or modify any LaTeX expressions
- Question numbers should be sequential integers (1, 2, 3, etc.)
- If you see table formatting or non-question content, ignore it
- If the answer is included inline (e.g. starts with "Ans:" or "**Answer:**"), extract it and store it in "answer_key.correct_answer"


EXAMPLE OUTPUT FORMAT (no code blocks):
[{
  "question_number": "1",
  "question_text": "Solve \\\\(\\\\log_2 x = 3\\\\)",
  "answer_options": [
    {"option": "A", "text": "x = 8"},
    {"option": "B", "text": "x = 4"}
  ],
 "answer_key": {
    "question_number": "1",
    "correct_answer": "(a) a = 338 or b = 320, (b) 21^x = 21, (c) x = 1/3"
  },
  "image_path": ["https://cdn.mathpix.com/cropped/..."],
  "subject": "${paperMetadata.subject}",
  "banding": "${paperMetadata.banding}",
  "level": "${paperMetadata.level}",
  "paper_type": "${paperMetadata.paper_type}",
  "topic_label": "${paperMetadata.topic_label || ""}"
}]

MARKDOWN CONTENT TO PROCESS:
${markdownContent}

Return the JSON array directly:`;

  try {
    const result = await model.generateContent([{ text: prompt }]);
    const rawResponse =
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("📝 Gemini raw response length:", rawResponse.length);
    console.log("📝 First 300 chars:", rawResponse.substring(0, 300));

    // Parse the JSON response with multiple strategies
    let parsed;
    try {
      parsed = await parseGeminiJsonResponse(rawResponse);
    } catch (parseError) {
      console.error("❌ Failed to parse Gemini response:", parseError.message);
      throw new Error(`Failed to extract questions: ${parseError.message}`);
    }

    if (!Array.isArray(parsed)) {
      throw new Error("Gemini response is not an array");
    }

    console.log(
      `✅ Successfully parsed ${parsed.length} questions from markdown`
    );
    return parsed;
  } catch (error) {
    console.error("❌ Error extracting questions with Gemini:", error);
    throw new Error(`Failed to extract questions: ${error.message}`);
  }
}

// Helper function to parse Gemini JSON responses with multiple strategies
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

async function matchAnswersWithGemini(questions, answerKeyMarkdown) {
  const prompt = `
  You are given a list of math questions and a separate answer key in text.
  
  Match each question to its correct answer based on question number.
  
  If the answer key includes sub-parts (like 1a, 1b), combine them under the main number:
  (e.g., "1a: 5", "1b: 7" => "correct_answer": "(a) 5, (b) 7")
  
  Return the updated array of questions like this:
  [
    {
      "question_number": "1",
      "question_text": "...",
      "answer_options": [...],
      "answer_key": { "question_number": "1", "correct_answer": "B" },
      ...
    }
  ]
  
  QUESTIONS:
  ${JSON.stringify(questions)}
  
  ANSWER KEY:
  ${answerKeyMarkdown}
  
  Return only the valid JSON array. Do not include markdown, code blocks, or explanations.`;

  try {
    const result = await model.generateContent([{ text: prompt }]);
    const raw =
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const cleaned = raw.replace(/^```json\s*|```$/gm, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("❌ Failed to parse Gemini answer match:", err.message);
    return questions; // fallback
  }
}

// ===== IMAGE UPLOAD ROUTES =====

// Route to upload single image
router.post("/upload/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    console.log(`📸 Uploading image: ${req.file.originalname}`);

    // Get folder from request or use default
    const folder = req.body.folder || "manual-uploads";

    // Generate unique filename
    const fileExtension = getFileExtension(req.file.mimetype);
    const sanitizedOriginalName = sanitizeFilename(
      path.parse(req.file.originalname).name
    );
    const uniqueId = uuidv4().substring(0, 8);
    const fileName = `${sanitizedOriginalName}_${uniqueId}${fileExtension}`;
    const key = `${folder}/${fileName}`;

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ContentDisposition: "inline", // Allow direct viewing in browser
      CacheControl: "max-age=31536000", // 1 year cache
    });

    await s3.send(uploadCommand);

    // Generate S3 URL
    const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${
      process.env.S3_REGION
    }.amazonaws.com/${encodeURIComponent(key)}`;

    console.log(`✅ Image uploaded successfully: ${imageUrl}`);

    res.json({
      success: true,
      message: "Image uploaded successfully",
      imageUrl: imageUrl,
      fileName: fileName,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      s3Key: key,
    });
  } catch (error) {
    console.error("❌ Image upload error:", error);

    if (error.message === "Only image files are allowed") {
      return res.status(400).json({ error: "Only image files are allowed" });
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File too large. Maximum size is 10MB." });
    }

    res.status(500).json({
      error: "Failed to upload image",
      details: error.message,
    });
  }
});

// Route to upload multiple images
router.post("/upload/images", upload.array("images", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No image files provided" });
    }

    console.log(`📸 Uploading ${req.files.length} images`);

    const folder = req.body.folder || "manual-uploads";
    const uploadResults = [];
    const errors = [];

    // Upload each file
    for (const file of req.files) {
      try {
        // Generate unique filename
        const fileExtension = getFileExtension(file.mimetype);
        const sanitizedOriginalName = sanitizeFilename(
          path.parse(file.originalname).name
        );
        const uniqueId = uuidv4().substring(0, 8);
        const fileName = `${sanitizedOriginalName}_${uniqueId}${fileExtension}`;
        const key = `${folder}/${fileName}`;

        // Upload to S3
        const uploadCommand = new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ContentDisposition: "inline",
          CacheControl: "max-age=31536000",
        });

        await s3.send(uploadCommand);

        // Generate S3 URL
        const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${
          process.env.S3_REGION
        }.amazonaws.com/${encodeURIComponent(key)}`;

        uploadResults.push({
          success: true,
          imageUrl: imageUrl,
          fileName: fileName,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          s3Key: key,
        });

        console.log(`✅ Uploaded: ${fileName}`);
      } catch (uploadError) {
        console.error(`❌ Failed to upload ${file.originalname}:`, uploadError);
        errors.push({
          fileName: file.originalname,
          error: uploadError.message,
        });
      }
    }

    res.json({
      success: uploadResults.length > 0,
      message: `Uploaded ${uploadResults.length} of ${req.files.length} images`,
      results: uploadResults,
      errors: errors,
      totalUploaded: uploadResults.length,
      totalFailed: errors.length,
    });
  } catch (error) {
    console.error("❌ Batch image upload error:", error);
    res.status(500).json({
      error: "Failed to upload images",
      details: error.message,
    });
  }
});

// Route to get upload info/stats
router.get("/upload/info", (req, res) => {
  res.json({
    maxFileSize: "10MB",
    allowedTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "image/bmp",
    ],
    maxFiles: 10,
    bucket: process.env.S3_BUCKET_NAME,
    region: process.env.S3_REGION,
  });
});

// ===== EXISTING MARKDOWN PROCESSING ROUTES =====

// ROUTE 1: Preview route - extract questions and optionally match answers
router.post("/preview", async (req, res) => {
  try {
    const {
      markdown_content,
      answer_key_content, // ✅ NEW
      subject,
      banding,
      level,
      paper_type,
      topic_label,
      year,
    } = req.body;

    // Validation
    if (!markdown_content || !subject || !banding || !level || !paper_type) {
      return res.status(400).json({
        error:
          "Missing required fields: markdown_content, subject, banding, level, paper_type",
      });
    }

    console.log(`🔍 Generating preview for markdown content`);
    console.log(`📊 Content length: ${markdown_content.length} characters`);

    const paperMetadata = {
      subject,
      banding,
      level,
      paper_type,
      topic_label,
      year,
    };

    // Step 1: Extract questions from markdown
    let extractedQuestions = await extractQuestionsFromMarkdown(
      markdown_content,
      paperMetadata
    );

    if (!extractedQuestions || extractedQuestions.length === 0) {
      return res.status(400).json({
        error: "No questions could be extracted from the markdown content",
      });
    }

    // Step 2: Extract original Mathpix image links from markdown
    const imageRegex =
      /!\[.*?\]\((https:\/\/cdn\.mathpix\.com\/cropped[^\s)]+)\)/g;
    const markdownImages = [];
    let match;
    while ((match = imageRegex.exec(markdown_content)) !== null) {
      markdownImages.push(match[1]);
    }

    // Step 3: Override Gemini image_path with original Mathpix links
    let imgIndex = 0;
    for (const q of extractedQuestions) {
      if (Array.isArray(q.image_path) && q.image_path.length > 0) {
        const newPaths = [];
        for (let i = 0; i < q.image_path.length; i++) {
          if (markdownImages[imgIndex]) {
            newPaths.push(markdownImages[imgIndex]);
            imgIndex++;
          }
        }
        q.image_path = newPaths;
      }
    }

    // Step 4: If separate answer_key_content is provided, match answers
    if (answer_key_content && answer_key_content.trim().length > 0) {
      console.log("🔗 Matching answers using Gemini...");
      const matched = await matchAnswersWithGemini(
        extractedQuestions,
        answer_key_content
      );

      // 🔁 Re-apply original markdown image paths to maintain visual consistency
      let imgIdx = 0;
      for (let i = 0; i < matched.length; i++) {
        const q = matched[i];
        if (Array.isArray(q.image_path) && q.image_path.length > 0) {
          const newPaths = [];
          for (let j = 0; j < q.image_path.length; j++) {
            if (markdownImages[imgIdx]) {
              newPaths.push(markdownImages[imgIdx]);
              imgIdx++;
            }
          }
          q.image_path = newPaths;
        }
      }

      extractedQuestions = matched;
    }

    res.json({
      success: true,
      questions: extractedQuestions,
      message: `Successfully extracted ${extractedQuestions.length} questions for preview`,
    });
  } catch (error) {
    console.error("❌ Error generating markdown preview:", error);
    res.status(500).json({
      error: "Failed to generate preview: " + error.message,
    });
  }
});

// ROUTE 2: Process route - for when user wants to save after preview
router.post("/process", async (req, res) => {
  try {
    const {
      questions, // Pre-extracted questions from preview
      paper_name,
      subject,
      banding,
      level,
      paper_type,
      topic_label,
      year,
    } = req.body;

    // Validation
    if (
      !questions ||
      !Array.isArray(questions) ||
      !paper_name ||
      !subject ||
      !banding ||
      !level ||
      !paper_type
    ) {
      return res.status(400).json({
        error:
          "Missing required fields: questions, paper_name, subject, banding, level, paper_type",
      });
    }

    console.log(
      `📝 Processing ${questions.length} questions for paper: ${paper_name}`
    );

    // Process images and upload to S3
    let imagesProcessed = 0;
    const updatedQuestions = await Promise.all(
      questions.map(async (question) => {
        if (
          !Array.isArray(question.image_path) ||
          question.image_path.length === 0
        ) {
          return { ...question, image_path: [] };
        }

        const newImagePaths = await Promise.all(
          question.image_path.map(async (rawUrl, index) => {
            const cleanedUrl = rawUrl.replace(/\\&/g, "&");
            if (cleanedUrl.includes("cdn.mathpix.com")) {
              const s3Url = await downloadAndUploadImage(
                cleanedUrl,
                paper_name,
                question.question_number,
                index
              );
              if (s3Url !== rawUrl) {
                imagesProcessed++;
              }
              return s3Url;
            }
            return rawUrl;
          })
        );

        return { ...question, image_path: newImagePaths };
      })
    );

    console.log(`📸 Processed ${imagesProcessed} images`);

    // Save to database
    await insertJSONPayload({
      paper_name,
      subject,
      banding,
      level,
      questions: updatedQuestions,
      paper_type,
      topic_label,
      year,
    });

    console.log(
      `✅ Successfully saved ${updatedQuestions.length} questions to database`
    );

    res.json({
      success: true,
      message: "Questions processed and saved successfully",
      questions: updatedQuestions,
      images_processed: imagesProcessed,
    });
  } catch (error) {
    console.error("❌ Error processing questions:", error);
    res.status(500).json({
      error: "Failed to process questions: " + error.message,
    });
  }
});

// ROUTE 3: Direct process route (for backward compatibility - processes markdown directly)
router.post("/process-direct", async (req, res) => {
  try {
    const {
      markdown_content,
      paper_name,
      subject,
      banding,
      level,
      paper_type,
      topic_label,
      year,
    } = req.body;

    // Validation
    if (
      !markdown_content ||
      !paper_name ||
      !subject ||
      !banding ||
      !level ||
      !paper_type
    ) {
      return res.status(400).json({
        error:
          "Missing required fields: markdown_content, paper_name, subject, banding, level, paper_type",
      });
    }

    console.log(
      `📝 Direct processing markdown content for paper: ${paper_name}`
    );
    console.log(`📊 Content length: ${markdown_content.length} characters`);

    // Step 1: Extract questions using Gemini
    const paperMetadata = {
      subject,
      banding,
      level,
      paper_type,
      topic_label,
      year,
    };

    const extractedQuestions = await extractQuestionsFromMarkdown(
      markdown_content,
      paperMetadata
    );

    if (!extractedQuestions || extractedQuestions.length === 0) {
      return res.status(400).json({
        error: "No questions could be extracted from the markdown content",
      });
    }

    console.log(`📋 Extracted ${extractedQuestions.length} questions`);

    // Step 2: Process images and upload to S3
    let imagesProcessed = 0;
    const updatedQuestions = await Promise.all(
      extractedQuestions.map(async (question) => {
        if (
          !Array.isArray(question.image_path) ||
          question.image_path.length === 0
        ) {
          return { ...question, image_path: [] };
        }

        const newImagePaths = await Promise.all(
          question.image_path.map(async (mathpixUrl, index) => {
            if (mathpixUrl && mathpixUrl.includes("cdn.mathpix.com")) {
              const s3Url = await downloadAndUploadImage(
                mathpixUrl,
                paper_name,
                question.question_number,
                index
              );
              if (s3Url !== mathpixUrl) {
                imagesProcessed++;
              }
              return s3Url;
            }
            return mathpixUrl;
          })
        );

        return { ...question, image_path: newImagePaths };
      })
    );

    console.log(`📸 Processed ${imagesProcessed} images`);

    // Step 3: Save to database
    await insertJSONPayload({
      paper_name,
      subject,
      banding,
      level,
      questions: updatedQuestions,
      paper_type,
      topic_label,
      year,
    });

    console.log(
      `✅ Successfully processed markdown and saved ${updatedQuestions.length} questions to database`
    );

    res.json({
      success: true,
      message: "Markdown processed successfully",
      questions: updatedQuestions,
      images_processed: imagesProcessed,
    });
  } catch (error) {
    console.error("❌ Error processing markdown:", error);
    res.status(500).json({
      error: "Failed to process markdown: " + error.message,
    });
  }
});

module.exports = router;
