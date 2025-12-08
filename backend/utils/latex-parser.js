// Enhanced utils/latex-parser.js with robust Base64 fallback
const crypto = require("crypto");

// Base64 utilities for fallback
const Base64Utils = {
  encode(text) {
    try {
      return Buffer.from(text, "utf8").toString("base64");
    } catch (error) {
      console.error("❌ Base64 encode failed:", error);
      return text;
    }
  },

  decode(base64) {
    try {
      return Buffer.from(base64, "base64").toString("utf8");
    } catch (error) {
      console.error("❌ Base64 decode failed:", error);
      return base64;
    }
  },

  isBase64Encoded(obj) {
    return obj && obj._encoded === true && obj.encoding_method === "base64";
  },
};

// Enhanced function to detect problematic LaTeX content
function hasProblematicLatex(text) {
  const problematicPatterns = [
    /\$[^$]*\\[^$]*\$/g, // LaTeX expressions with backslashes
    /\\(?:frac|sqrt|times|div|text|circ|angle|triangle|equiv|leq|geq|%)[\{\}]*/g,
    /\\[a-zA-Z]+/g, // Any LaTeX commands
    /\\\\/g, // Double backslashes
  ];

  return problematicPatterns.some((pattern) => pattern.test(text));
}

// Pre-process content to encode problematic LaTeX as Base64
function preprocessWithBase64(rawResponse) {
  console.log(
    "🔄 Pre-processing with Base64 encoding for problematic LaTeX..."
  );

  // Find and replace problematic LaTeX expressions
  const latexPattern = /"([^"]*(?:\$[^$]*\\[^$]*\$|\\[a-zA-Z]+[^"]*))"/g;

  let processedCount = 0;
  const processed = rawResponse.replace(latexPattern, (match, content) => {
    if (hasProblematicLatex(content)) {
      processedCount++;
      const encoded = Base64Utils.encode(content);
      return `"__B64_START__${encoded}__B64_END__"`;
    }
    return match;
  });

  console.log(
    `🔧 Pre-processed ${processedCount} problematic LaTeX expressions`
  );
  return { processed, encodedCount: processedCount };
}

// Post-process to decode Base64 back to readable format
function postprocessBase64(parsedData, wasEncoded = false) {
  if (!wasEncoded) return parsedData;

  console.log("🔄 Post-processing Base64 encoded content...");

  const jsonString = JSON.stringify(parsedData);
  const decoded = jsonString.replace(
    /"__B64_START__([^"]+)__B64_END__"/g,
    (match, encoded) => {
      try {
        const decoded = Base64Utils.decode(encoded);
        return `"${decoded.replace(/"/g, '\\"')}"`;
      } catch (error) {
        console.error("❌ Failed to decode Base64:", error);
        return match;
      }
    }
  );

  return JSON.parse(decoded);
}

async function parseLatexSafeJsonResponse(
  rawResponse,
  contentType = "questions"
) {
  console.log(`🔧 Starting enhanced LaTeX-safe parsing for ${contentType}`);
  console.log(`📝 Raw response length: ${rawResponse.length}`);

  // Strategy 0: Parse delimiter-based format (MOST RELIABLE for questions)
  if (contentType === "questions" && rawResponse.includes("===QUESTION_START===")) {
    try {
      console.log("🔧 Detected delimiter format - parsing...");

      const results = [];
      const questionBlocks = rawResponse.split("===QUESTION_START===").slice(1);

      console.log(`📝 Found ${questionBlocks.length} question blocks`);

      for (const block of questionBlocks) {
        const endIndex = block.indexOf("===QUESTION_END===");
        const content = endIndex > -1 ? block.substring(0, endIndex) : block;

        // Extract fields using simple line matching
        const questionNumber = content.match(/QUESTION_NUMBER:\s*(.+)/)?.[1]?.trim();

        // Extract QUESTION_TEXT - everything between QUESTION_TEXT: and the next field
        let questionText = "";
        const textMatch = content.match(/QUESTION_TEXT:\s*([\s\S]*?)(?=\nIMAGE_URLS:|$)/);
        if (textMatch) {
          questionText = textMatch[1].trim();
        }

        // Extract IMAGE_URLS
        const imageUrls = [];
        const imageMatch = content.match(/IMAGE_URLS:\s*(.+)/);
        if (imageMatch && imageMatch[1].trim().toUpperCase() !== "NONE") {
          const urls = imageMatch[1].split(",").map(u => u.trim()).filter(u => u);
          imageUrls.push(...urls);
        }

        // Extract ANSWER_OPTIONS
        const answerOptions = [];
        const optionsMatch = content.match(/ANSWER_OPTIONS:\s*(.+)/);
        if (optionsMatch && optionsMatch[1].trim().toUpperCase() !== "NONE") {
          const options = optionsMatch[1].split("|").map(o => o.trim());
          options.forEach(opt => {
            const match = opt.match(/^([A-Z])\)\s*(.+)$/);
            if (match) {
              answerOptions.push({ option: match[1], text: match[2] });
            }
          });
        }

        if (questionNumber && questionText) {
          results.push({
            question_number: questionNumber,
            question_text: questionText,
            image_path: imageUrls,
            answer_options: answerOptions,
            answer_key: null,
            topic_label: "",
            _parsing_method: "delimiter_format",
          });
        }
      }

      if (results.length > 0) {
        console.log(`✅ Success with delimiter parsing - extracted ${results.length} questions`);
        return results;
      }
    } catch (error) {
      console.log(`❌ Delimiter parsing failed:`, error.message);
    }
  }

  // Strategy 1: Pre-process with Base64 encoding (for JSON responses)
  try {
    console.log("🔧 Trying enhanced Base64 pre-processing strategy...");

    const { processed, encodedCount } = preprocessWithBase64(rawResponse);

    // Clean the response
    let cleaned = processed.replace(/^```json\s*|```\s*$/gm, "").trim();
    const jsonMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/) || [cleaned];
    let jsonString = jsonMatch[0];

    // Try to parse the processed JSON
    const parsed = JSON.parse(jsonString);

    // Post-process to decode Base64 content
    const result = postprocessBase64(parsed, encodedCount > 0);
    const finalResult = Array.isArray(result) ? result : [result];

    if (finalResult.length > 0) {
      console.log(
        `✅ Success with Base64 pre-processing - parsed ${finalResult.length} items (${encodedCount} LaTeX expressions encoded)`
      );

      return finalResult.map((item) => ({
        ...item,
        _parsing_method: "base64_preprocessing",
        _uses_base64: encodedCount > 0,
        _encoded_expressions: encodedCount,
      }));
    }
  } catch (error) {
    console.log(`❌ Base64 pre-processing failed:`, error.message);
  }

  // Strategy 2: Enhanced character-by-character escaping
  try {
    console.log("🔧 Trying enhanced character escaping strategy...");

    let cleaned = rawResponse.replace(/^```json\s*|```\s*$/gm, "").trim();
    const jsonMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/) || [cleaned];
    let jsonString = jsonMatch[0];

    // More comprehensive LaTeX escaping
    const latexCommands = [
      "times",
      "div",
      "frac",
      "sqrt",
      "log",
      "sin",
      "cos",
      "tan",
      "text",
      "circ",
      "angle",
      "triangle",
      "equiv",
      "leq",
      "geq",
      "neq",
      "approx",
      "pm",
      "infty",
      "pi",
      "alpha",
      "beta",
      "gamma",
      "delta",
      "theta",
      "lambda",
      "mu",
      "sigma",
      "phi",
      "omega",
    ];

    // Escape LaTeX commands within quoted strings
    jsonString = jsonString.replace(
      /"([^"]*(?:\\.[^"]*)*)"/g,
      (match, content) => {
        let fixed = content;

        // Handle specific LaTeX patterns
        latexCommands.forEach((cmd) => {
          const pattern = new RegExp(`\\\\${cmd}(?![a-zA-Z])`, "g");
          fixed = fixed.replace(pattern, `\\\\${cmd}`);
        });

        // Handle other backslash patterns
        fixed = fixed
          .replace(/\\\$/g, "\\\\$") // Dollar signs
          .replace(/\\%/g, "\\\\%") // Percent signs
          .replace(/\\{/g, "\\\\{") // Braces
          .replace(/\\}/g, "\\\\}")
          .replace(/\\\(/g, "\\\\(") // Parentheses
          .replace(/\\\)/g, "\\\\)")
          .replace(/\\>/g, "\\\\>") // Greater than
          .replace(/\\</g, "\\\\<") // Less than
          .replace(/\\_/g, "\\\\_") // Underscores
          .replace(/\\\^/g, "\\\\^"); // Carets

        return `"${fixed}"`;
      }
    );

    const parsed = JSON.parse(jsonString);
    const result = Array.isArray(parsed) ? parsed : [parsed];

    if (result.length > 0) {
      console.log(
        `✅ Success with enhanced character escaping - parsed ${result.length} items`
      );

      return result.map((item) => ({
        ...item,
        _parsing_method: "enhanced_character_escaping",
        _uses_base64: false,
      }));
    }
  } catch (error) {
    console.log(`❌ Enhanced character escaping failed:`, error.message);
  }

  // Strategy 3: Aggressive JSON cleaning and parsing
  try {
    console.log("🔧 Trying aggressive JSON cleaning strategy...");

    let cleaned = rawResponse.replace(/^```json\s*|```\s*$/gm, "").trim();

    // Extract JSON array
    const jsonMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
      throw new Error("No JSON array found in response");
    }

    let jsonString = jsonMatch[0];

    // Aggressively clean problematic characters
    // Remove control characters (ASCII 0-31 except tab, newline, carriage return)
    jsonString = jsonString.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    // Fix common LaTeX escaping issues
    // Replace single backslashes followed by known problematic chars
    jsonString = jsonString
      .replace(/\\n(?!")/g, '\\\\n')  // newlines not at end of string
      .replace(/\\t(?!")/g, '\\\\t')  // tabs
      .replace(/\\r(?!")/g, '\\\\r')  // carriage returns
      .replace(/\\f/g, '\\\\f')       // form feeds
      .replace(/\\b(?![a-z])/g, '\\\\b'); // backspace (not \beta etc)

    // Fix unescaped quotes inside strings (very common issue)
    // This is tricky - we need to be careful not to break valid JSON
    jsonString = jsonString.replace(
      /"([^"]*?)(?<!\\)"(?=[^:,\[\]\{\}])/g,
      '"$1\\"'
    );

    const parsed = JSON.parse(jsonString);
    const result = Array.isArray(parsed) ? parsed : [parsed];

    if (result.length > 0 && result[0].question_text !== undefined) {
      console.log(`✅ Success with aggressive cleaning - parsed ${result.length} items`);

      return result.map((item) => ({
        ...item,
        _parsing_method: "aggressive_cleaning",
        _uses_base64: false,
      }));
    }
  } catch (error) {
    console.log(`❌ Aggressive JSON cleaning failed:`, error.message);
  }

  // Strategy 4: Improved regex extraction for questions
  try {
    console.log("🔧 Trying improved regex extraction...");

    const results = [];

    if (contentType === "questions") {
      // More robust pattern to extract question objects
      // Look for each { ... } block that contains question_number
      const questionBlockPattern = /\{[^{}]*"question_number"[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
      const blocks = rawResponse.match(questionBlockPattern) || [];

      console.log(`📝 Found ${blocks.length} potential question blocks`);

      for (const block of blocks) {
        try {
          // Try to extract key fields using more lenient patterns
          const questionNumber = block.match(/"question_number"\s*:\s*"([^"]+)"/)?.[1];

          // For question_text, handle multi-line content
          let questionText = "";
          const textMatch = block.match(/"question_text"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"|"\s*\})/);
          if (textMatch) {
            questionText = textMatch[1]
              .replace(/\\"/g, '"')  // Unescape quotes
              .replace(/\\\\/g, '\\'); // Unescape backslashes
          }

          // Extract image_path array
          const imagePaths = [];
          const imagePathMatch = block.match(/"image_path"\s*:\s*\[([\s\S]*?)\]/);
          if (imagePathMatch) {
            const urlMatches = imagePathMatch[1].match(/"([^"]+)"/g);
            if (urlMatches) {
              urlMatches.forEach(m => {
                imagePaths.push(m.replace(/"/g, ''));
              });
            }
          }

          // Extract answer_options array
          const answerOptions = [];
          const optionsMatch = block.match(/"answer_options"\s*:\s*\[([\s\S]*?)\]/);
          if (optionsMatch && optionsMatch[1].trim()) {
            // Try to parse individual option objects
            const optionMatches = optionsMatch[1].match(/\{[^{}]*\}/g);
            if (optionMatches) {
              optionMatches.forEach(optStr => {
                const opt = optStr.match(/"option"\s*:\s*"([^"]+)"/)?.[1];
                const txt = optStr.match(/"text"\s*:\s*"([^"]+)"/)?.[1];
                if (opt) {
                  answerOptions.push({ option: opt, text: txt || "" });
                }
              });
            }
          }

          // Extract other fields
          const subject = block.match(/"subject"\s*:\s*"([^"]+)"/)?.[1] || "";
          const banding = block.match(/"banding"\s*:\s*"([^"]+)"/)?.[1] || "";
          const level = block.match(/"level"\s*:\s*"([^"]+)"/)?.[1] || "";
          const paperType = block.match(/"paper_type"\s*:\s*"([^"]+)"/)?.[1] || "";
          const topicLabel = block.match(/"topic_label"\s*:\s*"([^"]*)"/)?.[1] || "";

          if (questionNumber && questionText) {
            results.push({
              question_number: questionNumber,
              question_text: questionText,
              answer_options: answerOptions,
              image_path: imagePaths,
              subject,
              banding,
              level,
              paper_type: paperType,
              topic_label: topicLabel,
              answer_key: null,
            });
          }
        } catch (e) {
          console.warn("Failed to extract question from block:", e.message);
        }
      }
    } else if (contentType === "answers") {
      // Extract answers using regex
      const answerPattern = /"question_number"\s*:\s*"([^"]+)"[\s\S]*?"correct_answer"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
      let match;
      while ((match = answerPattern.exec(rawResponse)) !== null) {
        results.push({
          question_number: match[1],
          correct_answer: match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\'),
          confidence: "medium",
        });
      }
    }

    if (results.length > 0) {
      console.log(`✅ Success with improved regex extraction - parsed ${results.length} items`);

      return results.map((item) => ({
        ...item,
        _parsing_method: "improved_regex_extraction",
        _uses_base64: false,
      }));
    }
  } catch (error) {
    console.log(`❌ Improved regex extraction failed:`, error.message);
  }

  // If all strategies fail, throw detailed error
  throw new Error(
    `All enhanced parsing strategies failed for ${contentType}. The content appears to have complex LaTeX that cannot be safely parsed. Consider simplifying the mathematical notation.`
  );
}

// Function to decode Base64 content in parsed data (for frontend use)
function decodeBase64Content(data) {
  if (typeof data === "string") {
    // Check for Base64 content markers
    if (data.includes("__B64_CONTENT__")) {
      return data.replace(
        /__B64_CONTENT__([^_]+)__B64_CONTENT__/g,
        (match, encoded) => {
          try {
            return Base64Utils.decode(encoded);
          } catch (error) {
            console.error("❌ Failed to decode Base64 content:", error);
            return match;
          }
        }
      );
    }

    if (data.includes("__ENCODED_CONTENT__")) {
      return data.replace(
        /__ENCODED_CONTENT__([^_]+)__ENCODED_CONTENT__/g,
        (match, encoded) => {
          try {
            return Base64Utils.decode(encoded);
          } catch (error) {
            console.error("❌ Failed to decode encoded content:", error);
            return match;
          }
        }
      );
    }
  }

  if (typeof data === "object" && data !== null) {
    if (Array.isArray(data)) {
      return data.map((item) => decodeBase64Content(item));
    } else {
      const decoded = {};
      for (const [key, value] of Object.entries(data)) {
        decoded[key] = decodeBase64Content(value);
      }
      return decoded;
    }
  }

  return data;
}

// Enhanced answer prompt that encourages Base64-safe responses
function getImprovedAnswerPrompt(mmdText) {
  return `Extract answers from this mathematics answer key document.

CRITICAL: To avoid JSON parsing errors with LaTeX, please use SIMPLIFIED mathematical notation:

SAFE NOTATION RULES:
- Use × instead of \\times
- Use ÷ instead of \\div  
- Use ² ³ instead of ^2 ^3
- Use √ instead of \\sqrt
- Use ≤ ≥ instead of \\leq \\geq
- Use ° instead of \\circ
- Use simple fractions: 1/2, 3/4 instead of \\frac{1}{2}
- Use $ signs without internal backslashes: $x + 1$ not $x \\times 1$

GROUPING RULES:
1. Group sub-questions under main question numbers
2. For questions like 1a, 1b, 1c → create ONE entry for question "1"
3. Combine sub-parts: "(a) answer1, (b) answer2, (c) answer3"
4. Return pure JSON array without backticks or markdown

OUTPUT FORMAT (use simplified notation):
[{
  "question_number": "1", 
  "correct_answer": "(a) 150.04, (b) 150.0",
  "confidence": "high"
}]

ANSWER KEY CONTENT:
${mmdText}`;
}

// Enhanced question prompt - uses delimiter format to avoid JSON escaping issues
function getImprovedQuestionPrompt(
  markdownContent,
  subject,
  banding,
  level,
  paper_type,
  topic_label,
  pageRangeNote
) {
  return `Extract questions from this exam worksheet.

IMPORTANT: Use the EXACT delimiter format below. Do NOT use JSON format.

OUTPUT FORMAT - Use these exact delimiters:
===QUESTION_START===
QUESTION_NUMBER: 1
QUESTION_TEXT: [The full question text here, can include LaTeX like $x^2 + 3x = 10$, images like ![](url), and newlines]
IMAGE_URLS: url1, url2 (comma-separated, or NONE if no images)
ANSWER_OPTIONS: A) option1 | B) option2 | C) option3 (pipe-separated, or NONE if no options)
===QUESTION_END===

===QUESTION_START===
QUESTION_NUMBER: 2
QUESTION_TEXT: [Next question...]
IMAGE_URLS: NONE
ANSWER_OPTIONS: NONE
===QUESTION_END===

EXTRACTION RULES:
- Group sub-parts under main numbers: 1(a), 1(b), 1(c) all become question "1"
- Keep ALL original LaTeX notation exactly as-is (don't simplify)
- Keep ALL image markdown ![](url) in the QUESTION_TEXT exactly where they appear
- Also list all image URLs separately in IMAGE_URLS field
- Preserve newlines and formatting in question text
${pageRangeNote}

METADATA TO USE:
- subject: ${subject}
- banding: ${banding}
- level: ${level}
- paper_type: ${paper_type}
- topic_label: ${topic_label || ""}

CONTENT TO EXTRACT FROM:
${markdownContent}`;
}

// Helper function to extract images from markdown content (for client-side processing if needed)
function extractImagesFromMarkdown(markdownText) {
  const imageRegex = /!\[.*?\]\((https:\/\/cdn\.mathpix\.com\/[^)]+)\)/g;
  const images = [];
  let match;

  while ((match = imageRegex.exec(markdownText)) !== null) {
    images.push(match[1]);
  }

  return images;
}

// Helper function to associate images with questions based on markdown structure
function associateImagesWithQuestions(markdownContent) {
  const lines = markdownContent.split("\n");
  const questions = [];
  let currentQuestion = null;
  let currentImages = [];

  for (const line of lines) {
    // Check for question number pattern
    const questionMatch = line.match(/^#+\s*(?:Question\s*)?(\d+)/i);
    if (questionMatch) {
      // Save previous question if exists
      if (currentQuestion) {
        questions.push({
          ...currentQuestion,
          image_path: [...currentImages],
        });
      }

      // Start new question
      currentQuestion = {
        question_number: questionMatch[1],
        image_path: [],
      };
      currentImages = [];
    }

    // Check for images in current line
    const imageMatches = line.match(
      /!\[.*?\]\((https:\/\/cdn\.mathpix\.com\/[^)]+)\)/g
    );
    if (imageMatches) {
      imageMatches.forEach((match) => {
        const urlMatch = match.match(
          /\((https:\/\/cdn\.mathpix\.com\/[^)]+)\)/
        );
        if (urlMatch) {
          currentImages.push(urlMatch[1]);
        }
      });
    }
  }

  // Don't forget the last question
  if (currentQuestion) {
    questions.push({
      ...currentQuestion,
      image_path: [...currentImages],
    });
  }

  return questions;
}

module.exports = {
  parseLatexSafeJsonResponse,
  getImprovedQuestionPrompt,
  getImprovedAnswerPrompt,
  Base64Utils,
  decodeBase64Content,
  hasProblematicLatex,
};
