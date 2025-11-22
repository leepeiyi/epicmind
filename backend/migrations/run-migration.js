// Script to run database migrations
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
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

async function runMigration(filename) {
  const client = await pool.connect();

  try {
    console.log(`\n🔄 Running migration: ${filename}`);

    const migrationPath = path.join(__dirname, filename);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await client.query(sql);

    console.log(`✅ Migration completed successfully: ${filename}`);
  } catch (error) {
    console.error(`❌ Migration failed: ${filename}`);
    console.error(error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    // Run the migration
    await runMigration('001_create_topic_tables.sql');

    console.log('\n✅ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed!');
    process.exit(1);
  }
}

main();
