require("dotenv").config();
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

// Fixed escapeLatex function that handles both strings and arrays
const escapeLatex = (text) => {
  // Handle null/undefined
  if (!text) return text;
  
  // Handle arrays - convert to string first
  if (Array.isArray(text)) {
    // Join array elements with a delimiter (e.g., comma and space)
    text = text.join(', ');
  }
  
  // Handle non-string types
  if (typeof text !== 'string') {
    text = String(text);
  }
  
  // Now safely apply string replacements
  return text.replace(/\\/g, "\\\\") || "";
};

const insertJSONPayload = async (parsedJSON) => {
  const client = await pool.connect();

  try {
    console.log("✅ Connected to the database");
    const { paper_name, subject, banding, level, questions } = parsedJSON;
    const fullPaperName =
      `${paper_name}_${subject}_${banding}_${level}`.replace(/\s+/g, "_");

    for (const original of questions) {
      const item = {
        ...original,
        question_text: escapeLatex(original.question_text),
        answer_key:
          typeof original.answer_key === "object" &&
          original.answer_key !== null
            ? {
                ...original.answer_key,
                correct_answer: escapeLatex(original.answer_key.correct_answer),
              }
            : original.answer_key,
        answer_options: Array.isArray(original.answer_options)
          ? original.answer_options.map((opt) => ({
              ...opt,
              text: escapeLatex(opt.text),
            }))
          : [],
      };

      console.log("🔍 Storing Q", item.question_number, {
        text: item.question_text,
        answer: item.answer_key,
      });

      await client.query(
        `INSERT INTO question (
          paper_name, question_number, question_text, answer_options, 
          image_paths, answer_key, subject, banding, level, paper_type, topic_label
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          paper_name,
          item.question_number, // Changed from question.question_number
          item.question_text, // Changed from question.question_text
          JSON.stringify(item.answer_options), // Changed
          JSON.stringify(item.image_path), // Changed
          JSON.stringify(item.answer_key), // Changed
          subject,
          banding,
          level,
          parsedJSON.paper_type, // Add paper_type from parsedJSON
          parsedJSON.topic_label, // Changed from topic
        ]
      );
    }

    console.log("🚀 All JSON data inserted successfully");
  } catch (err) {
    console.error("❌ Error inserting JSON data:", err.message);
    throw err;
  } finally {
    client.release();
    console.log("🔌 Client released");
  }
};

module.exports = insertJSONPayload;