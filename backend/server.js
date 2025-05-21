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
const mathpixRoutes = require('./routes/Mathpix/mathpix');
app.use('/api/mathpix', mathpixRoutes);
const paperRoutes = require('./routes/Mathpix/insertpaper');
app.use('/api/paper', paperRoutes);
const generateRoutes = require('./routes/GenerateQuiz/topical');
app.use('/api/quiz', generateRoutes);
const quizRoutes = require('./routes/QuizFolder/getQuiz');
app.use('/api/quiz', quizRoutes);
const quizAssignmentRoutes = require('./routes/QuizFolder/assignQuiz');
app.use('/api/quiz', quizAssignmentRoutes);
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));



const PORT = 5008;

app.get('/api/message', (req, res) => {
  res.json({ message: 'Hello from backend!' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
