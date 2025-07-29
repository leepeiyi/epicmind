const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Segment multiple questions at once
router.post("/segment-questions", async (req, res) => {
  const { questions } = req.body;

  if (!questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: "Missing questions array" });
  }

  try {
    console.log(`🔄 Segmenting ${questions.length} questions...`);
    
    const segmentedQuestions = {};
    
    // Process each question
    for (const question of questions) {
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

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
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
        
      } catch (error) {
        console.error(`❌ Error segmenting question ${question.id}:`, error);
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