const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// Use Flash-Lite for simple segmentation tasks (1,000 RPD limit vs 250)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to retry with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 5000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Check if it's a rate limit error
      if (error.status === 429 && attempt < maxRetries) {
        // Extract retry delay from error if available
        const retryDelay = error.errorDetails?.find(d => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo')?.retryDelay;
        const waitTime = retryDelay ? parseFloat(retryDelay) * 1000 : baseDelay * Math.pow(2, attempt - 1);

        console.log(`⏳ Rate limit hit. Retrying in ${(waitTime / 1000).toFixed(1)}s... (Attempt ${attempt}/${maxRetries})`);
        await delay(waitTime);
        continue;
      }
      throw error;
    }
  }
}

// Segment multiple questions at once
router.post("/segment-questions", async (req, res) => {
  const { questions } = req.body;

  if (!questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: "Missing questions array" });
  }

  try {
    console.log(`🔄 Segmenting ${questions.length} questions...`);

    const segmentedQuestions = {};

    // Process each question with rate limiting
    // Flash-Lite: 15 RPM = 1 request every 4 seconds
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];

      if (!question.id || !question.question_text || !question.answer_key) {
        console.warn(`⚠️ Skipping question ${question.id} - missing required fields`);
        continue;
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
- If the question has no clear parts (single question), return an empty array [].

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
${question.question_text}

ANSWER KEY:
${question.answer_key}

Return only valid JSON, no markdown, no extra commentary.
`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        // Retry with backoff on rate limit errors
        const result = await retryWithBackoff(async () => {
          return await model.generateContent(prompt);
        });

        const responseText = result.response.text();
        
        // Clean the response
        const cleanedResponse = responseText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        const parts = JSON.parse(cleanedResponse);
        
        // Only store if there are multiple parts
        if (Array.isArray(parts) && parts.length > 1) {
          segmentedQuestions[question.id] = {
            questionParts: parts,
            originalQuestionText: question.question_text,
            originalAnswerKey: question.answer_key
          };
          console.log(`✅ Question ${question.id} segmented into ${parts.length} parts`);
        } else {
          console.log(`ℹ️ Question ${question.id} is single-part, no segmentation needed`);
        }

        // Rate limiting: Wait 4 seconds between requests (15 RPM limit)
        if (i < questions.length - 1) {
          console.log(`⏳ Waiting 4s before next request...`);
          await delay(4000);
        }

      } catch (error) {
        console.error(`❌ Error segmenting question ${question.id}:`, error);
        // Still wait before next request even if this one failed
        if (i < questions.length - 1) {
          await delay(4000);
        }
      }
    }

    res.json({
      success: true,
      segmentedQuestions,
      totalSegmented: Object.keys(segmentedQuestions).length
    });

  } catch (error) {
    console.error("❌ Error in segmentation:", error);
    res.status(500).json({
      error: "Failed to segment questions",
      detail: error.message
    });
  }
});

module.exports = router;