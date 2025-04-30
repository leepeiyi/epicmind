const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); // Allow frontend to connect
app.use(express.json());

const PORT = 5008;

app.get('/api/message', (req, res) => {
  res.json({ message: 'Hello from backend!' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
