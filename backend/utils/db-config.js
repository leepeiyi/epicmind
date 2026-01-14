/**
 * Shared Database Configuration
 * Supports both cloud (AWS RDS with SSL) and local (NAS PostgreSQL without SSL)
 */

require('dotenv').config();

// SSL config - disabled for local PostgreSQL (NAS), enabled for cloud (AWS RDS)
const sslConfig = process.env.DB_SSL === 'false'
  ? false
  : { require: true, rejectUnauthorized: false };

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: sslConfig,
};

module.exports = { dbConfig, sslConfig };
