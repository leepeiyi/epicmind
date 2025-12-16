/**
 * Storage Abstraction Layer
 * Supports both S3 and Local file storage
 * Toggle via STORAGE_TYPE environment variable
 */

const fs = require("fs-extra");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");

// Determine storage type from environment
const STORAGE_TYPE = process.env.STORAGE_TYPE || "s3";
const LOCAL_STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || "./uploads";
const PUBLIC_URL_BASE = process.env.PUBLIC_URL_BASE || "http://localhost:3000/uploads";

// S3 Client (only initialized if using S3)
let s3Client = null;
let PutObjectCommand = null;

if (STORAGE_TYPE === "s3") {
  const { S3Client, PutObjectCommand: POC } = require("@aws-sdk/client-s3");
  PutObjectCommand = POC;
  s3Client = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  console.log("📦 Storage: Using AWS S3");
} else {
  console.log(`📂 Storage: Using local file storage at ${LOCAL_STORAGE_PATH}`);
  fs.ensureDirSync(LOCAL_STORAGE_PATH);
}

/**
 * Upload a file to storage
 * @param {Buffer} buffer - File buffer
 * @param {string} key - Storage key/path (e.g., "paper_name/image.png")
 * @param {string} contentType - MIME type (e.g., "image/png")
 * @returns {Promise<string>} - Public URL of uploaded file
 */
async function uploadFile(buffer, key, contentType = "application/octet-stream") {
  if (STORAGE_TYPE === "s3") {
    return uploadToS3(buffer, key, contentType);
  } else {
    return uploadToLocal(buffer, key, contentType);
  }
}

/**
 * Upload to AWS S3
 */
async function uploadToS3(buffer, key, contentType) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/${encodeURIComponent(key)}`;
}

/**
 * Upload to local file system
 */
async function uploadToLocal(buffer, key, contentType) {
  const sanitizedKey = key.replace(/\.\./g, "").replace(/^\//, "");
  const filePath = path.join(LOCAL_STORAGE_PATH, sanitizedKey);

  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, buffer);

  console.log(`✅ Saved locally: ${filePath}`);

  return `${PUBLIC_URL_BASE}/${sanitizedKey}`;
}

/**
 * Upload image from URL (download and re-upload)
 */
async function uploadFromUrl(sourceUrl, key, contentType = "image/png") {
  try {
    const response = await axios.get(sourceUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
    });
    const buffer = Buffer.from(response.data, "binary");

    return await uploadFile(buffer, key, contentType);
  } catch (error) {
    console.error(`❌ Failed to download from ${sourceUrl}:`, error.message);
    throw error;
  }
}

/**
 * Delete a file from storage
 */
async function deleteFile(key) {
  if (STORAGE_TYPE === "s3") {
    const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
      })
    );
  } else {
    const sanitizedKey = key.replace(/\.\./g, "").replace(/^\//, "");
    const filePath = path.join(LOCAL_STORAGE_PATH, sanitizedKey);
    await fs.remove(filePath);
  }
}

/**
 * Check if using local storage
 */
function isLocalStorage() {
  return STORAGE_TYPE === "local";
}

/**
 * Get storage type
 */
function getStorageType() {
  return STORAGE_TYPE;
}

/**
 * Generate a unique filename
 */
function generateUniqueFilename(originalName, questionNumber) {
  const extension = path.extname(originalName) || ".png";
  return `${uuidv4()}_Q${questionNumber}${extension}`;
}

module.exports = {
  uploadFile,
  uploadFromUrl,
  deleteFile,
  isLocalStorage,
  getStorageType,
  generateUniqueFilename,
  STORAGE_TYPE,
  LOCAL_STORAGE_PATH,
  PUBLIC_URL_BASE,
};
