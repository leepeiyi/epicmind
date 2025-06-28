// Enhanced utils/latex-parser.js with robust Base64 fallback
const crypto = require('crypto');

// Base64 utilities for fallback
const Base64Utils = {
  encode(text) {
    try {
      return Buffer.from(text, 'utf8').toString('base64');
    } catch (error) {
      console.error('❌ Base64 encode failed:', error);
      return text;
    }
  },

  decode(base64) {
    try {
      return Buffer.from(base64, 'base64').toString('utf8');
    } catch (error) {
      console.error('❌ Base64 decode failed:', error);
      return base64;
    }
  },

  isBase64Encoded(obj) {
    return obj && obj._encoded === true && obj.encoding_method === 'base64';
  }
};

// Enhanced function to detect problematic LaTeX content
function hasProblematicLatex(text) {
  const problematicPatterns = [
    /\$[^$]*\\[^$]*\$/g,  // LaTeX expressions with backslashes
    /\\(?:frac|sqrt|times|div|text|circ|angle|triangle|equiv|leq|geq|%)[\{\}]*/g,
    /\\[a-zA-Z]+/g, // Any LaTeX commands
    /\\\\/g, // Double backslashes
  ];
  
  return problematicPatterns.some(pattern => pattern.test(text));
}

// Pre-process content to encode problematic LaTeX as Base64
function preprocessWithBase64(rawResponse) {
  console.log('🔄 Pre-processing with Base64 encoding for problematic LaTeX...');
  
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
  
  console.log(`🔧 Pre-processed ${processedCount} problematic LaTeX expressions`);
  return { processed, encodedCount: processedCount };
}

// Post-process to decode Base64 back to readable format
function postprocessBase64(parsedData, wasEncoded = false) {
  if (!wasEncoded) return parsedData;
  
  console.log('🔄 Post-processing Base64 encoded content...');
  
  const jsonString = JSON.stringify(parsedData);
  const decoded = jsonString.replace(
    /"__B64_START__([^"]+)__B64_END__"/g,
    (match, encoded) => {
      try {
        const decoded = Base64Utils.decode(encoded);
        return `"${decoded.replace(/"/g, '\\"')}"`;
      } catch (error) {
        console.error('❌ Failed to decode Base64:', error);
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

  // Strategy 1: Pre-process with Base64 encoding (NEW PRIORITY STRATEGY)
  try {
    console.log('🔧 Trying enhanced Base64 pre-processing strategy...');
    
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
      console.log(`✅ Success with Base64 pre-processing - parsed ${finalResult.length} items (${encodedCount} LaTeX expressions encoded)`);
      
      return finalResult.map(item => ({
        ...item,
        _parsing_method: "base64_preprocessing",
        _uses_base64: encodedCount > 0,
        _encoded_expressions: encodedCount
      }));
    }
  } catch (error) {
    console.log(`❌ Base64 pre-processing failed:`, error.message);
  }

  // Strategy 2: Enhanced character-by-character escaping
  try {
    console.log('🔧 Trying enhanced character escaping strategy...');
    
    let cleaned = rawResponse.replace(/^```json\s*|```\s*$/gm, "").trim();
    const jsonMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/) || [cleaned];
    let jsonString = jsonMatch[0];

    // More comprehensive LaTeX escaping
    const latexCommands = [
      'times', 'div', 'frac', 'sqrt', 'log', 'sin', 'cos', 'tan', 
      'text', 'circ', 'angle', 'triangle', 'equiv', 'leq', 'geq', 
      'neq', 'approx', 'pm', 'infty', 'pi', 'alpha', 'beta', 'gamma',
      'delta', 'theta', 'lambda', 'mu', 'sigma', 'phi', 'omega'
    ];
    
    // Escape LaTeX commands within quoted strings
    jsonString = jsonString.replace(/"([^"]*(?:\\.[^"]*)*)"/g, (match, content) => {
      let fixed = content;
      
      // Handle specific LaTeX patterns
      latexCommands.forEach(cmd => {
        const pattern = new RegExp(`\\\\${cmd}(?![a-zA-Z])`, 'g');
        fixed = fixed.replace(pattern, `\\\\${cmd}`);
      });
      
      // Handle other backslash patterns
      fixed = fixed
        .replace(/\\\$/g, '\\\\$')  // Dollar signs
        .replace(/\\%/g, '\\\\%')   // Percent signs
        .replace(/\\{/g, '\\\\{')   // Braces
        .replace(/\\}/g, '\\\\}')
        .replace(/\\\(/g, '\\\\(')  // Parentheses
        .replace(/\\\)/g, '\\\\)')
        .replace(/\\>/g, '\\\\>')   // Greater than
        .replace(/\\</g, '\\\\<')   // Less than
        .replace(/\\_/g, '\\\\_')   // Underscores
        .replace(/\\\^/g, '\\\\^'); // Carets
      
      return `"${fixed}"`;
    });

    const parsed = JSON.parse(jsonString);
    const result = Array.isArray(parsed) ? parsed : [parsed];
    
    if (result.length > 0) {
      console.log(`✅ Success with enhanced character escaping - parsed ${result.length} items`);
      
      return result.map(item => ({
        ...item,
        _parsing_method: "enhanced_character_escaping",
        _uses_base64: false
      }));
    }
  } catch (error) {
    console.log(`❌ Enhanced character escaping failed:`, error.message);
  }

  // Strategy 3: Complete Base64 fallback with Gemini retry
  try {
    console.log('🔧 Trying complete Base64 fallback strategy...');
    
    // Encode the entire problematic content as Base64
    const encoded = Base64Utils.encode(rawResponse);
    
    // Create a simplified structure that we can parse safely
    const safeStructure = [{
      question_number: "1",
      correct_answer: `__ENCODED_CONTENT__${encoded}__ENCODED_CONTENT__`,
      confidence: "medium",
      _requires_decoding: true
    }];
    
    console.log(`✅ Applied complete Base64 fallback strategy`);
    
    return safeStructure.map(item => ({
      ...item,
      _parsing_method: "complete_base64_fallback",
      _uses_base64: true,
      _requires_manual_processing: true
    }));
    
  } catch (error) {
    console.log(`❌ Complete Base64 fallback failed:`, error.message);
  }

  // Strategy 4: Regex extraction with Base64 safety
  try {
    console.log('🔧 Trying regex extraction with Base64 safety...');
    
    const results = [];

    if (contentType === "questions") {
      // Extract questions using regex but encode problematic content
      const questionPattern = /"question_number"\s*:\s*"([^"]+)"[\s\S]*?(?="question_number"|$)/g;
      const matches = [...rawResponse.matchAll(questionPattern)];

      for (const match of matches) {
        try {
          const questionBlock = match[0];
          const questionNumber = questionBlock.match(/"question_number"\s*:\s*"([^"]+)"/)?.[1];
          const questionTextMatch = questionBlock.match(/"question_text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          
          if (questionNumber && questionTextMatch) {
            let questionText = questionTextMatch[1];
            let isEncoded = false;
            
            // If the question text has problematic LaTeX, encode it
            if (hasProblematicLatex(questionText)) {
              questionText = `__B64_CONTENT__${Base64Utils.encode(questionText)}__B64_CONTENT__`;
              isEncoded = true;
            }
            
            results.push({
              question_number: questionNumber,
              question_text: questionText,
              answer_options: [],
              answer_key: null,
              image_path: [],
              topic_label: "",
              _encoded_content: isEncoded
            });
          }
        } catch (e) {
          console.warn("Failed to extract question:", e.message);
        }
      }
    } else if (contentType === "answers") {
      // Extract answers using regex but encode problematic content
      const answerPattern = /"question_number"\s*:\s*"([^"]+)"[\s\S]*?"correct_answer"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
      let match;
      while ((match = answerPattern.exec(rawResponse)) !== null) {
        let correctAnswer = match[2];
        let isEncoded = false;
        
        // If the answer has problematic LaTeX, encode it
        if (hasProblematicLatex(correctAnswer)) {
          correctAnswer = `__B64_CONTENT__${Base64Utils.encode(correctAnswer)}__B64_CONTENT__`;
          isEncoded = true;
        }
        
        results.push({
          question_number: match[1],
          correct_answer: correctAnswer,
          confidence: "medium",
          _encoded_content: isEncoded
        });
      }
    }

    if (results.length > 0) {
      console.log(`✅ Success with regex extraction - parsed ${results.length} items`);
      
      return results.map(item => ({
        ...item,
        _parsing_method: "regex_with_base64_safety",
        _uses_base64: item._encoded_content || false
      }));
    }
  } catch (error) {
    console.log(`❌ Regex extraction with Base64 safety failed:`, error.message);
  }

  // If all strategies fail, throw detailed error
  throw new Error(
    `All enhanced parsing strategies failed for ${contentType}. The content appears to have complex LaTeX that cannot be safely parsed. Consider simplifying the mathematical notation.`
  );
}

// Function to decode Base64 content in parsed data (for frontend use)
function decodeBase64Content(data) {
  if (typeof data === 'string') {
    // Check for Base64 content markers
    if (data.includes('__B64_CONTENT__')) {
      return data.replace(/__B64_CONTENT__([^_]+)__B64_CONTENT__/g, (match, encoded) => {
        try {
          return Base64Utils.decode(encoded);
        } catch (error) {
          console.error('❌ Failed to decode Base64 content:', error);
          return match;
        }
      });
    }
    
    if (data.includes('__ENCODED_CONTENT__')) {
      return data.replace(/__ENCODED_CONTENT__([^_]+)__ENCODED_CONTENT__/g, (match, encoded) => {
        try {
          return Base64Utils.decode(encoded);
        } catch (error) {
          console.error('❌ Failed to decode encoded content:', error);
          return match;
        }
      });
    }
  }
  
  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.map(item => decodeBase64Content(item));
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

// Enhanced question prompt that encourages Base64-safe responses
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

CRITICAL: To avoid JSON parsing errors with LaTeX, please use SIMPLIFIED mathematical notation:

SAFE NOTATION RULES:
- Use × ÷ ² ³ √ ≤ ≥ ° instead of LaTeX commands
- Use simple fractions: 1/2, 3/4
- Use $ signs without internal backslashes
- Replace \\text{} with plain text
- Use plain superscripts: x² not x^{2}

EXTRACTION RULES:
- Extract each question's number and full text
- Group sub-parts under main numbers
- Extract answer options if present
- Return valid JSON array without markdown blocks
${pageRangeNote}

OUTPUT FORMAT (use simplified notation):
[{
  "question_number": "1",
  "question_text": "Find the value of x where x² + 3x = 10",
  "answer_options": [{"option": "A", "text": "x = 2"}],
  "subject": "${subject}",
  "banding": "${banding}",
  "level": "${level}",
  "paper_type": "${paper_type}",
  "topic_label": "${topic_label || ""}"
}]

CONTENT:
${markdownContent}`;
}

module.exports = {
  parseLatexSafeJsonResponse,
  getImprovedQuestionPrompt,
  getImprovedAnswerPrompt,
  Base64Utils,
  decodeBase64Content,
  hasProblematicLatex
};