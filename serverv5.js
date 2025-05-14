const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json()); // Parse JSON bodies

// Environment-based configuration
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || '422';
const DB_NAME = process.env.DB_NAME || 'gallerydb';
const DB_HOST = process.env.DB_HOST || '10.3.0.3'; // Replace with actual private IP of Cloud SQL from Terraform output
const DB_PORT = parseInt(process.env.DB_PORT, 10) || 3306;

const GCS_BUCKET = process.env.GCS_BUCKET || 'my-terraform-gcs'; // Set via env or Terraform output

// Google Cloud Storage client (uses VM default credentials)
const storage = new Storage();
const bucket = storage.bucket(GCS_BUCKET);

// MySQL connection pool
const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  port: DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Multer config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// === Routes ===

// Signup
app.post('/api/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Database connection failed' });

    const checkQuery = 'SELECT * FROM users WHERE username = ?';
    connection.execute(checkQuery, [username], (err, results) => {
      if (err) {
        connection.release();
        return res.status(500).json({ error: 'Query failed' });
      }

      if (results.length > 0) {
        connection.release();
        return res.status(400).json({ error: 'Username already taken' });
      }

      const id = Math.floor(Math.random() * 1200 + 3);
      const insertQuery = 'INSERT INTO users (id, username, password) VALUES (?, ?, ?)';
      connection.execute(insertQuery, [id, username, password], (err) => {
        connection.release();
        if (err) return res.status(500).json({ error: 'Failed to create user' });
        return res.status(201).json({ message: 'Account created successfully' });
      });
    });
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Database connection failed' });

    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    connection.execute(query, [username, password], (err, results) => {
      connection.release();
      if (err) return res.status(500).json({ error: 'Query failed' });

      if (results.length > 0) {
        return res.status(200).json({ message: 'Login successful', user: results[0] });
      } else {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    });
  });
});

// Upload Photo
app.post('/api/upload', upload.single('imgfile'), async (req, res) => {
  const { userId, photoName } = req.body;
  const file = req.file;
  if (!userId || !file) return res.status(400).json({ error: 'User ID and photo are required' });

  try {
    const blob = bucket.file(file.originalname);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype,
        contentDisposition: 'attachment', // Ensures the browser prompts a download
      },
    });

    blobStream.on('finish', () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      pool.getConnection((err, connection) => {
        if (err) return res.status(500).json({ error: 'Database connection failed' });

        const query = 'INSERT INTO photos (user_id, photo_url, photo_name) VALUES (?, ?, ?)';
        connection.execute(query, [userId, publicUrl, photoName], (err) => {
          connection.release();
          if (err) return res.status(500).json({ error: 'Failed to save photo' });
          return res.status(200).json({ message: 'Photo uploaded', photoUrl: publicUrl });
        });
      });
    });

    blobStream.on('error', (err) => {
      console.error('Upload error:', err);
      return res.status(500).json({ error: 'Upload failed' });
    });

    blobStream.end(file.buffer);
  } catch (err) {
    console.error('Unexpected upload error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
});

// Fetch Photos
app.get('/api/photos', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'User ID is required' });

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Database connection failed' });

    const query = 'SELECT * FROM photos WHERE user_id = ?';
    connection.execute(query, [userId], (err, results) => {
      connection.release();
      if (err) return res.status(500).json({ error: 'Query failed' });
      return res.status(200).json({ photos: results });
    });
  });
});

// Index route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = 80;  // Change port to 80 for production environment
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

