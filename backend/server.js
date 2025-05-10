require("dotenv").config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); // Allow frontend to connect
app.use(express.json());
const client = require("./databasepg");

//insert routes
const userAccountRoutes = require('./routes/UserAccount/auth');
app.use('/api/user', userAccountRoutes);
const ocrRoutes = require('./routes/InsertPaper/ocrRoutes');
app.use("/api/ocr", ocrRoutes);
const mathpixRoutes = require('./routes/Mathpix/mathpix');
app.use('/api/mathpix', mathpixRoutes);
const paperRoutes = require('./routes/Mathpix/insertpaper');
app.use('/api/paper', paperRoutes);


const PORT = 5008;

app.get('/api/message', (req, res) => {
  res.json({ message: 'Hello from backend!' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
