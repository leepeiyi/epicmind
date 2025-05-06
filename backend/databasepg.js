require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// ✅ Initialize PostgreSQL client
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

// ✅ List of SQL files to execute
const sqlFiles = [
  path.join(__dirname, 'db', 'users.sql'),
  path.join(__dirname, 'db', 'question.sql'),

];

// ✅ Helper to run individual .sql files
const runSQLFile = async (filePath) => {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return;
  }
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    await client.query(sql);
    console.log(`✅ Executed ${path.basename(filePath)}`);
  } catch (err) {
    console.error(`❌ Error executing ${filePath}:`, err.message);
  }
};

// ✅ Main function
const main = async () => {
  try {
    await client.connect();
    console.log('🟢 Connected to the database');

    for (const file of sqlFiles) {
      await runSQLFile(file);
    }

    console.log('🚀 Database table creation complete');
  } catch (err) {
    console.error('❌ Database setup error:', err.message);
  } finally {
    await client.end();
    console.log('🔌 Disconnected from the database');
  }
};

// 🏁 Execute if run directly
if (require.main === module) {
  main();
}

module.exports = client;
