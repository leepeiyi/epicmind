// routes/paperRoutes.js or similar
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

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

// GET recent 3 papers based on latest inserted question timestamp
router.get('/recent', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT paper_name, MAX(created_at) as last_uploaded
      FROM question
      GROUP BY paper_name
      ORDER BY last_uploaded DESC
      LIMIT 3;
    `);
    client.release();
    res.json({ recent: result.rows });
  } catch (err) {
    console.error("❌ Failed to fetch recent papers:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET questions by paper_name
router.get('/questions/:paper_name', async (req, res) => {
    const { paper_name } = req.params;
    try {
      const client = await pool.connect();
      const result = await client.query(
        'SELECT * FROM question WHERE paper_name = $1 ORDER BY question_number ASC',
        [paper_name]
      );
      client.release();
      res.json({ questions: result.rows });
    } catch (err) {
      console.error("❌ Failed to fetch questions:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  

module.exports = router;
