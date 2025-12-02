require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Initialize PostgreSQL client with same config as databasepg.js
const client = new Client({
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

// Migration files to run (in order)
const migrationFiles = [
  'migrations/002_add_topic_id_to_questions.sql',
  'migrations/003_create_quiz_attempts.sql',
  'migrations/004_helper_queries.sql',
];

const runMigration = async (filePath) => {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }

  try {
    const sql = fs.readFileSync(fullPath, 'utf8');
    console.log(`\n📄 Running: ${path.basename(filePath)}...`);

    await client.query(sql);
    console.log(`✅ Completed: ${path.basename(filePath)}`);
    return true;
  } catch (err) {
    console.error(`❌ Error in ${filePath}:`, err.message);
    return false;
  }
};

const main = async () => {
  console.log('🚀 Starting database migrations...\n');

  try {
    await client.connect();
    console.log('🟢 Connected to database:', process.env.DB_DATABASE);

    let successCount = 0;
    let failCount = 0;

    for (const file of migrationFiles) {
      const success = await runMigration(file);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log('\n========================================');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log('========================================');

    if (failCount === 0) {
      console.log('\n🎉 All migrations completed successfully!');
    } else {
      console.log('\n⚠️  Some migrations failed. Check errors above.');
    }

  } catch (err) {
    console.error('❌ Database connection error:', err.message);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
};

main();
