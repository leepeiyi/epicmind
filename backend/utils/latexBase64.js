/**
 * LaTeX Base64 Encoding Utilities
 * Encodes LaTeX content to base64 to avoid all escaping issues.
 */

/**
 * Encode LaTeX portions of text to base64
 * @param {string} text - Text containing LaTeX
 * @returns {string} - Text with LaTeX portions base64 encoded
 */
function encodeLatex(text) {
  if (!text || typeof text !== 'string') return text;

  let result = text;

  // Handle display math $$...$$
  result = result.replace(/\$\$([^$]+)\$\$/g, (match, content) => {
    const encoded = Buffer.from(content, 'utf-8').toString('base64');
    return `$$[B64:${encoded}]$$`;
  });

  // Handle inline math $...$
  result = result.replace(/\$([^$]+)\$/g, (match, content) => {
    const encoded = Buffer.from(content, 'utf-8').toString('base64');
    return `$[B64:${encoded}]$`;
  });

  return result;
}

/**
 * Decode base64 LaTeX portions back to original
 * @param {string} text - Text with base64 encoded LaTeX
 * @returns {string} - Text with decoded LaTeX
 */
function decodeLatex(text) {
  if (!text || typeof text !== 'string') return text;

  let result = text;
  let iteration = 0;
  const maxIterations = 10; // Prevent infinite loops

  // Keep decoding until no more [B64:...] patterns exist (handles double/triple encoding)
  while (result.includes('[B64:') && iteration < maxIterations) {
    iteration++;
    console.log(`🔓 Decoding base64 LaTeX content (iteration ${iteration})...`);

    result = result.replace(/\[B64:([A-Za-z0-9+/=]+)\]/g, (match, encoded) => {
      try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
        console.log(`✅ Decoded: [B64:${encoded.substring(0, 20)}...] → ${decoded.substring(0, 50)}...`);
        return decoded;
      } catch (e) {
        console.error('❌ Failed to decode base64 LaTeX:', e);
        return match;
      }
    });
  }

  if (iteration >= maxIterations) {
    console.warn('⚠️ Max decode iterations reached - possible encoding issue');
  }

  return result;
}

/**
 * Encode LaTeX in question object for storage
 * @param {Object} question - Question object
 * @returns {Object} - Question with encoded LaTeX
 */
function encodeQuestionLatex(question) {
  if (!question) return question;

  const encoded = { ...question };

  if (encoded.question_text) {
    encoded.question_text = encodeLatex(encoded.question_text);
  }

  if (Array.isArray(encoded.answer_options)) {
    encoded.answer_options = encoded.answer_options.map(opt => {
      if (opt && typeof opt.text === 'string') {
        return { ...opt, text: encodeLatex(opt.text) };
      }
      return opt;
    });
  }

  return encoded;
}

/**
 * Decode LaTeX in question object for display
 * @param {Object} question - Question object from database
 * @returns {Object} - Question with decoded LaTeX
 */
function decodeQuestionLatex(question) {
  if (!question) return question;

  const decoded = { ...question };

  if (decoded.question_text) {
    decoded.question_text = decodeLatex(decoded.question_text);
  }

  if (decoded.text) {
    decoded.text = decodeLatex(decoded.text);
  }

  if (Array.isArray(decoded.answer_options)) {
    decoded.answer_options = decoded.answer_options.map(opt => {
      if (opt && typeof opt.text === 'string') {
        return { ...opt, text: decodeLatex(opt.text) };
      }
      return opt;
    });
  }

  return decoded;
}

module.exports = {
  encodeLatex,
  decodeLatex,
  encodeQuestionLatex,
  decodeQuestionLatex
};
