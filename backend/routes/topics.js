// routes/topics.js - API endpoints for topic CRUD operations
const express = require("express");
const router = express.Router();
const { Pool } = require("pg");
const requireTeacher = require("../middleware/require-teacher");
const { dbConfig } = require("../utils/db-config");

require("dotenv").config();

const pool = new Pool(dbConfig);

// ==================== GET ENDPOINTS ====================

/**
 * GET /api/topics/hierarchy
 * Returns all topics organized hierarchically by subject and level
 * Format: { math: { mathSec1: [topics...], mathSec2: [...] }, amath: { ... } }
 */
router.get("/hierarchy", async (req, res) => {
  const client = await pool.connect();

  try {
    // Get all data in one query with joins
    const result = await client.query(`
      SELECT
        s.name as subject_name,
        l.name as level_name,
        t.id as topic_id,
        t.label as topic_label,
        t.hashtag,
        t.description,
        ARRAY_AGG(sh.hashtag ORDER BY sh.hashtag) FILTER (WHERE sh.hashtag IS NOT NULL) as sub_hashtags
      FROM subjects s
      LEFT JOIN levels l ON s.id = l.subject_id
      LEFT JOIN topics t ON l.id = t.level_id
      LEFT JOIN sub_hashtags sh ON t.id = sh.topic_id
      GROUP BY s.name, l.name, t.id, t.label, t.hashtag, t.description
      ORDER BY s.name, l.name, t.label
    `);

    // Organize data hierarchically
    const hierarchy = {};

    for (const row of result.rows) {
      const { subject_name, level_name, topic_label, hashtag, description, sub_hashtags } = row;

      // Skip if no level (subject with no levels)
      if (!level_name) continue;

      // Initialize subject if not exists
      if (!hierarchy[subject_name]) {
        hierarchy[subject_name] = {};
      }

      // Initialize level if not exists
      if (!hierarchy[subject_name][level_name]) {
        hierarchy[subject_name][level_name] = [];
      }

      // Add topic (skip if already added - happens with multiple sub_hashtags)
      if (!hierarchy[subject_name][level_name].some(t => t.label === topic_label)) {
        hierarchy[subject_name][level_name].push({
          id: row.topic_id,
          label: topic_label,
          hashtag: hashtag,
          description: description,
          subHashtags: sub_hashtags || []
        });
      }
    }

    res.json(hierarchy);
  } catch (error) {
    console.error("❌ Error fetching topic hierarchy:", error);
    res.status(500).json({ error: "Failed to fetch topic hierarchy" });
  } finally {
    client.release();
  }
});

/**
 * GET /api/topics/by-level
 * Returns topics for specific subject and level combination
 * Query params: level (e.g., "mathSec1", "amathSec3")
 */
router.get("/by-level", async (req, res) => {
  const { level } = req.query;

  if (!level) {
    return res.status(400).json({ error: "Level parameter is required" });
  }

  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        t.id,
        t.label,
        t.hashtag,
        t.description,
        ARRAY_AGG(sh.hashtag ORDER BY sh.hashtag) FILTER (WHERE sh.hashtag IS NOT NULL) as sub_hashtags
      FROM levels l
      JOIN topics t ON l.id = t.level_id
      LEFT JOIN sub_hashtags sh ON t.id = sh.topic_id
      WHERE l.name = $1
      GROUP BY t.id, t.label, t.hashtag, t.description
      ORDER BY t.label
    `, [level]);

    const topics = result.rows.map(row => ({
      id: row.id,
      label: row.label,
      hashtag: row.hashtag,
      description: row.description,
      subHashtags: row.sub_hashtags || []
    }));

    res.json(topics);
  } catch (error) {
    console.error("❌ Error fetching topics by level:", error);
    res.status(500).json({ error: "Failed to fetch topics" });
  } finally {
    client.release();
  }
});

/**
 * GET /api/topics
 * Returns all topics with optional filters
 * Query params: subject, level, search
 */
router.get("/", async (req, res) => {
  const { subject, level, search } = req.query;
  const client = await pool.connect();

  try {
    let query = `
      SELECT
        t.id,
        t.label,
        t.hashtag,
        t.description,
        l.name as level_name,
        s.name as subject_name,
        ARRAY_AGG(sh.hashtag ORDER BY sh.hashtag) FILTER (WHERE sh.hashtag IS NOT NULL) as sub_hashtags
      FROM topics t
      JOIN levels l ON t.level_id = l.id
      JOIN subjects s ON l.subject_id = s.id
      LEFT JOIN sub_hashtags sh ON t.id = sh.topic_id
    `;

    const conditions = [];
    const params = [];

    if (subject) {
      params.push(subject);
      conditions.push(`s.name = $${params.length}`);
    }

    if (level) {
      params.push(level);
      conditions.push(`l.name = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(t.label ILIKE $${params.length} OR t.hashtag ILIKE $${params.length} OR t.description ILIKE $${params.length})`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` GROUP BY t.id, t.label, t.hashtag, t.description, l.name, s.name ORDER BY s.name, l.name, t.label`;

    const result = await client.query(query, params);

    const topics = result.rows.map(row => ({
      id: row.id,
      label: row.label,
      hashtag: row.hashtag,
      description: row.description,
      level: row.level_name,
      subject: row.subject_name,
      subHashtags: row.sub_hashtags || []
    }));

    res.json(topics);
  } catch (error) {
    console.error("❌ Error fetching topics:", error);
    res.status(500).json({ error: "Failed to fetch topics" });
  } finally {
    client.release();
  }
});

// ==================== CREATE ENDPOINTS ====================

/**
 * POST /api/topics
 * Create a new topic
 * Body: { level_id, label, hashtag, description, subHashtags: [] }
 */
router.post("/", requireTeacher, async (req, res) => {
  const { level_id, label, hashtag, description, subHashtags } = req.body;

  if (!level_id || !label || !hashtag) {
    return res.status(400).json({ error: "Missing required fields: level_id, label, hashtag" });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert topic
    const topicResult = await client.query(
      `INSERT INTO topics (level_id, label, hashtag, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, label, hashtag, description, created_at`,
      [level_id, label, hashtag, description || null]
    );

    const topic = topicResult.rows[0];

    // Insert sub-hashtags if provided
    if (subHashtags && subHashtags.length > 0) {
      for (const subHashtag of subHashtags) {
        await client.query(
          `INSERT INTO sub_hashtags (topic_id, hashtag)
           VALUES ($1, $2)`,
          [topic.id, subHashtag]
        );
      }
    }

    await client.query('COMMIT');

    console.log(`✅ Created topic: ${label} (ID: ${topic.id})`);

    res.status(201).json({
      message: "Topic created successfully",
      topic: {
        ...topic,
        subHashtags: subHashtags || []
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Error creating topic:", error);

    if (error.code === '23505') { // Unique constraint violation
      res.status(409).json({ error: "Topic with this label already exists for this level" });
    } else {
      res.status(500).json({ error: "Failed to create topic" });
    }
  } finally {
    client.release();
  }
});

// ==================== UPDATE ENDPOINTS ====================

/**
 * PUT /api/topics/:id
 * Update a topic
 * Body: { label, hashtag, description, subHashtags: [] }
 */
router.put("/:id", requireTeacher, async (req, res) => {
  const { id } = req.params;
  const { label, hashtag, description, subHashtags } = req.body;

  console.log('🔍 Update topic request:', { id, label, hashtag, description, subHashtags });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Update topic
    const topicResult = await client.query(
      `UPDATE topics
       SET label = COALESCE($1, label),
           hashtag = COALESCE($2, hashtag),
           description = COALESCE($3, description)
       WHERE id = $4
       RETURNING id, label, hashtag, description, updated_at`,
      [label, hashtag, description, id]
    );

    if (topicResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Topic not found" });
    }

    const topic = topicResult.rows[0];

    // Update sub-hashtags if provided
    if (subHashtags !== undefined) {
      // Delete existing sub-hashtags
      await client.query('DELETE FROM sub_hashtags WHERE topic_id = $1', [id]);

      // Insert new sub-hashtags
      for (const subHashtag of subHashtags) {
        await client.query(
          `INSERT INTO sub_hashtags (topic_id, hashtag)
           VALUES ($1, $2)`,
          [id, subHashtag]
        );
      }
    }

    await client.query('COMMIT');

    console.log(`✅ Updated topic: ${topic.label} (ID: ${id})`);

    res.json({
      message: "Topic updated successfully",
      topic: {
        ...topic,
        subHashtags: subHashtags || []
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Error updating topic:", error);
    res.status(500).json({ error: "Failed to update topic" });
  } finally {
    client.release();
  }
});

// ==================== DELETE ENDPOINTS ====================

/**
 * DELETE /api/topics/:id
 * Delete a topic (and its sub-hashtags due to CASCADE)
 */
router.delete("/:id", requireTeacher, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    const result = await client.query(
      `DELETE FROM topics WHERE id = $1 RETURNING label`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Topic not found" });
    }

    console.log(`✅ Deleted topic: ${result.rows[0].label} (ID: ${id})`);

    res.json({
      message: "Topic deleted successfully",
      deletedTopic: result.rows[0].label
    });
  } catch (error) {
    console.error("❌ Error deleting topic:", error);
    res.status(500).json({ error: "Failed to delete topic" });
  } finally {
    client.release();
  }
});

// ==================== SUBJECTS & LEVELS ENDPOINTS ====================

/**
 * GET /api/topics/subjects
 * Get all subjects
 */
router.get("/subjects", async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT id, name, display_name
      FROM subjects
      ORDER BY name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching subjects:", error);
    res.status(500).json({ error: "Failed to fetch subjects" });
  } finally {
    client.release();
  }
});

/**
 * GET /api/topics/levels
 * Get all levels, optionally filtered by subject
 * Query params: subject_id
 */
router.get("/levels", async (req, res) => {
  const { subject_id } = req.query;
  const client = await pool.connect();

  try {
    let query = `
      SELECT l.id, l.name, l.display_name, l.subject_id, s.name as subject_name
      FROM levels l
      JOIN subjects s ON l.subject_id = s.id
    `;

    const params = [];
    if (subject_id) {
      params.push(subject_id);
      query += ` WHERE l.subject_id = $1`;
    }

    query += ` ORDER BY s.name, l.name`;

    const result = await client.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching levels:", error);
    res.status(500).json({ error: "Failed to fetch levels" });
  } finally {
    client.release();
  }
});

module.exports = router;
