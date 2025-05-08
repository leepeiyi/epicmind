// 🔧 ocrRoutes.js
const express = require("express");
const multer = require("multer");
const router = express.Router();
const axios = require("axios");
const upload = multer({ storage: multer.memoryStorage() });
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const libre = require("libreoffice-convert");
const { exec } = require("child_process");

const { split_image } = require("./split_image");
const { OcrExecutionMinor: OcrExamExecutor } = require("./ocrExecutorExam");
const { OcrExecutionMinor: OcrTopicalExecutor } = require("./ocrExecutorTopical");
const { topicLabelling } = require("./topicLabelling");
const insertJSONPayload = require("./insertPostgresql");

const { Pool } = require("pg");
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: { require: true, rejectUnauthorized: false },
});

const {
  PutObjectCommand,
  S3Client,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

let clients = [];
router.get("/progress-stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  clients.push(res);
  req.on("close", () => {
    clients = clients.filter((client) => client !== res);
  });
});

function sendProgressUpdate(step, message) {
  const data = JSON.stringify({ step, message });
  clients.forEach((client) => client.write(`data: ${data}\n\n`));
}

router.post("/split_pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file || !req.body.subject || !req.body.level) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    if (
      !req.file.mimetype.includes("pdf") ||
      !req.file.originalname.endsWith(".pdf")
    ) {
      return res.status(400).json({ message: "Only PDFs are allowed." });
    }

    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ message: "PDF too large. Max 10MB." });
    }

    const paperName = req.file.originalname.replace(".pdf", "");
    const { subject, banding = "", level } = req.body;
    const folderName = `${paperName}_${subject}_${banding}_${level}`.replace(/\s+/g, "_");

    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET_NAME,
      Prefix: `${folderName}/`,
      MaxKeys: 1,
    });

    const listResponse = await s3.send(listCommand);
    if (listResponse.Contents && listResponse.Contents.length > 0) {
      return res.status(409).json({ message: "Paper already exists." });
    }

    sendProgressUpdate(1, "File submitted");
    const imageUrls = await split_image(req.file.buffer, paperName, subject, banding, level);
    sendProgressUpdate(2, "PDF split into images");

    const resultPayload = {
      paper_name: paperName,
      subject,
      banding,
      level,
      images: imageUrls,
    };

    const ocrData = await OcrExamExecutor(resultPayload);
    sendProgressUpdate(3, "OCR completed");

    await insertJSONPayload(ocrData);
    sendProgressUpdate(5, "Inserted into PostgreSQL");

    res.status(200).json({
      message: "OCR complete and saved.",
      paper_name: ocrData.paper_name,
      questions_count: ocrData.questions.length,
    });
  } catch (error) {
    console.error("❌ Error in /split_pdf:", error);
    res.status(500).json({ message: "Internal server error: " + error.message });
  }
});

router.post("/split_topical", upload.single("file"), async (req, res) => {
  try {
    if (!req.file || !req.body.subject || !req.body.level) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const paperName = req.file.originalname.replace(/\.(pdf|docx)$/i, "");
    const { subject, banding = "", level } = req.body;
    const folderName = `${paperName}_${subject}_${banding}_${level}`.replace(/\s+/g, "_");

    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET_NAME,
      Prefix: `${folderName}/`,
      MaxKeys: 1,
    });

    const listResponse = await s3.send(listCommand);
    if (listResponse.Contents && listResponse.Contents.length > 0) {
      return res.status(409).json({ message: "Paper already exists." });
    }

    sendProgressUpdate(1, "File submitted");
    let imageUrls = [];
    const isPDF = req.file.mimetype.includes("pdf");
    const isDOCX = req.file.mimetype.includes("wordprocessingml");

    if (isPDF) {
      imageUrls = await split_image(req.file.buffer, paperName, subject, banding, level);
    } else if (isDOCX) {
      const tempDocxPath = path.join(os.tmpdir(), `${crypto.randomUUID()}.docx`);
      await fsp.writeFile(tempDocxPath, req.file.buffer);

      const docxBuffer = await fsp.readFile(tempDocxPath);
      const convertedPdf = await new Promise((resolve, reject) => {
        libre.convert(docxBuffer, ".pdf", undefined, (err, done) => {
          if (err) return reject(new Error(`LibreOffice error: ${err.message}`));
          resolve(done);
        });
      });

      const tempPdfPath = path.join(os.tmpdir(), `${crypto.randomUUID()}.pdf`);
      await fsp.writeFile(tempPdfPath, convertedPdf);

      const finalPdfBuffer = await fsp.readFile(tempPdfPath);
      imageUrls = await split_image(finalPdfBuffer, paperName, subject, banding, level);
    } else {
      return res.status(400).json({ message: "Only PDF or Word files allowed." });
    }

    sendProgressUpdate(2, "Converted to images, running OCR...");

    const resultPayload = {
      paper_name: paperName,
      subject,
      banding,
      level,
      images: imageUrls,
      isTopical: true,
    };

    const topicalOcr = await OcrTopicalExecutor(resultPayload);
    sendProgressUpdate(3, "OCR completed");

    await insertJSONPayload(topicalOcr);
    sendProgressUpdate(5, "Inserted into PostgreSQL");

    res.status(200).json({
      message: "Topical questions processed.",
      paper_name: topicalOcr.paper_name,
      questions_count: topicalOcr.questions.length,
    });
  } catch (error) {
    console.error("❌ Error in /split_topical:", error);
    res.status(500).json({ message: "Internal server error: " + error.message });
  }
});

router.post("/run_ocr", async (req, res) => {
  try {
    const ocrData = await OcrExecutionMinor(req.body);
    res.status(200).json(ocrData);
  } catch (error) {
    console.error("❌ Error in /run_ocr:", error);
    res.status(500).json({ message: "OCR execution failed: " + error.message });
  }
});

router.post("/topicLabelling", async (req, res) => {
  try {
    const labelled = await topicLabelling(req.body);
    res.status(200).json(labelled);
  } catch (error) {
    console.error("❌ Error in /topicLabelling:", error);
    res.status(500).json({ message: "Topic labelling failed: " + error.message });
  }
});

router.post("/insertIntoPostgresql", async (req, res) => {
  try {
    await insertJSONPayload(req.body);
    res.status(200).json({ message: "Data inserted into PostgreSQL." });
  } catch (error) {
    console.error("❌ Error in /insertIntoPostgresql:", error);
    res.status(500).json({ message: "Insertion failed: " + error.message });
  }
});

router.get("/questions/:paperName", async (req, res) => {
  const { paperName } = req.params;
  const client = await pool.connect();
  try {
    const query = `
      SELECT question_number, question_text, answer_options, image_paths
      FROM question
      WHERE paper_name = $1
      ORDER BY question_number::int
    `;
    const { rows } = await client.query(query, [paperName]);
    res.status(200).json({ questions: rows });
  } catch (err) {
    console.error("❌ Error fetching questions:", err.message);
    res.status(500).json({ message: "Failed to retrieve questions." });
  } finally {
    client.release();
  }
});

router.post("/upload_diagram", upload.single("image"), async (req, res) => {
  try {
    const { paper_name, question_number } = req.body;
    const buffer = req.file.buffer;
    const fileName = `page-custom_diagram_${question_number}.png`;
    const key = `${paper_name}/${fileName}`;

    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: "image/png",
    });
    await s3.send(uploadCommand);

    const url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/${encodeURIComponent(paper_name).replace(/%20/g, "+")}/${fileName}`;
    res.json({ image_url: url });
  } catch (err) {
    console.error("Upload diagram failed:", err);
    res.status(500).json({ message: "Upload failed." });
  }
});

module.exports = router;
