require("dotenv").config();

const express = require('express');
const router = express.Router();
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


const client = new Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    port: process.env.DB_PORT,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: {
        require: true,
        rejectUnauthorized: false
    }
});

// Establish the database connection
client.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        // Handle the error appropriately here. You might want to:
        // 1.  Exit the application (if the connection is essential).
        // 2.  Retry the connection after a delay.
        // 3.  Inform the administrator.
        return; // Important: Stop further execution if connection fails
    } else {
        console.log('Connected to database');
    }
});

router.post('/register', async (req, res) => {
    const { name, email, password, role, parentEmail } = req.body;
    try {
      const hashed = await bcrypt.hash(password, 10);
      const result = await client.query(
        `INSERT INTO users (name, email, password, role, parent_email)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, email, role`,
        [name, email, hashed, role, parentEmail || null]
      );
      res.status(201).json({ message: 'User created', user: result.rows[0] });
    } catch (err) {
      console.error(err.message);
      res.status(400).json({ error: 'Registration failed', detail: err.message });
    }
  });
  
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];
      if (!user) return res.status(401).json({ error: 'User not found' });
  
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ error: 'Incorrect password' });
  
      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' });
  
      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: 'Login failed', detail: err.message });
    }
  });
  
  module.exports = router;

