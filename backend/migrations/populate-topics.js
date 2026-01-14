// Script to populate topic tables from topicData.js
const { Pool } = require("pg");
const mathTopicsData = require("../data/topicData");
require("dotenv").config();

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

async function populateTopics() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('\n🔄 Starting topic data population...');

    // Define subject mappings
    const subjects = [
      { name: 'math', displayName: 'Mathematics' },
      { name: 'amath', displayName: 'Additional Mathematics' }
    ];

    // Insert subjects
    console.log('\n📚 Inserting subjects...');
    for (const subject of subjects) {
      const result = await client.query(
        `INSERT INTO subjects (name, display_name)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET display_name = $2
         RETURNING id`,
        [subject.name, subject.displayName]
      );
      console.log(`  ✅ Subject: ${subject.displayName} (ID: ${result.rows[0].id})`);
    }

    // Process each level in topicData
    console.log('\n📊 Inserting levels and topics...');
    let totalTopics = 0;
    let totalSubHashtags = 0;

    for (const [levelKey, topics] of Object.entries(mathTopicsData)) {
      // Determine subject (math or amath)
      const subjectName = levelKey.startsWith('amath') ? 'amath' : 'math';

      // Get subject ID
      const subjectResult = await client.query(
        'SELECT id FROM subjects WHERE name = $1',
        [subjectName]
      );
      const subjectId = subjectResult.rows[0].id;

      // Create display name for level (e.g., "mathSec1" -> "Sec 1")
      const displayName = levelKey
        .replace(/^(math|amath)/, '')
        .replace(/([A-Z])/g, ' $1')
        .replace(/([0-9]+)/g, ' $1')
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Insert level
      const levelResult = await client.query(
        `INSERT INTO levels (subject_id, name, display_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (subject_id, name) DO UPDATE SET display_name = $3
         RETURNING id`,
        [subjectId, levelKey, displayName]
      );
      const levelId = levelResult.rows[0].id;

      console.log(`  📁 Level: ${levelKey} -> ${displayName} (ID: ${levelId})`);

      // Insert topics for this level
      for (const topic of topics) {
        const topicResult = await client.query(
          `INSERT INTO topics (level_id, label, hashtag, description)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (level_id, label) DO UPDATE
           SET hashtag = $3, description = $4
           RETURNING id`,
          [levelId, topic.label, topic.hashtag, topic.description || null]
        );
        const topicId = topicResult.rows[0].id;
        totalTopics++;

        // Insert sub-hashtags for this topic
        if (topic.subHashtags && topic.subHashtags.length > 0) {
          for (const subHashtag of topic.subHashtags) {
            await client.query(
              `INSERT INTO sub_hashtags (topic_id, hashtag)
               VALUES ($1, $2)
               ON CONFLICT (topic_id, hashtag) DO NOTHING`,
              [topicId, subHashtag]
            );
            totalSubHashtags++;
          }
        }
      }
    }

    await client.query('COMMIT');

    console.log('\n✅ Data population completed successfully!');
    console.log(`   📚 Subjects: ${subjects.length}`);
    console.log(`   📊 Levels: ${Object.keys(mathTopicsData).length}`);
    console.log(`   📝 Topics: ${totalTopics}`);
    console.log(`   🏷️  Sub-hashtags: ${totalSubHashtags}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error populating topics:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await populateTopics();
    console.log('\n🎉 All done!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Failed to populate topics!');
    process.exit(1);
  }
}

main();
