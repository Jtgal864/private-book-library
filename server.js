const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure folders exist
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
const coversDir = path.join(uploadsDir, 'covers');
const filesDir = path.join(uploadsDir, 'files');

[dataDir, uploadsDir, coversDir, filesDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallbacksecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false // set true if using HTTPS behind reverse proxy
  }
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// DB setup
const dbPath = path.join(__dirname, 'data', 'library.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      genre TEXT,
      description TEXT,
      cover_image TEXT,
      file_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Multer storage for covers
const coverStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, coversDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, uniqueName);
  }
});

// Multer storage for book files
const fileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, filesDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, uniqueName);
  }
});

const uploadCover = multer({ storage: coverStorage });
const uploadFile = multer({ storage: fileStorage });

const combinedUpload = (req, res, next) => {
  const multi = multer({
    storage: multer.memoryStorage()
  }).fields([
    { name: 'cover', maxCount: 1 },
    { name: 'bookFile', maxCount: 1 }
  ]);

  multi(req, res, function (err) {
    if (err) return res.status(500).json({ error: 'Upload error' });

    // Save cover manually
    if (req.files && req.files.cover && req.files.cover[0]) {
      const cover = req.files.cover[0];
      const coverName = Date.now() + '-cover-' + cover.originalname.replace(/\s+/g, '_');
      const coverPath = path.join(coversDir, coverName);
      fs.writeFileSync(coverPath, cover.buffer);
      req.savedCoverPath = '/uploads/covers/' + coverName;
    }

    // Save book file manually
    if (req.files && req.files.bookFile && req.files.bookFile[0]) {
      const file = req.files.bookFile[0];
      const fileName = Date.now() + '-file-' + file.originalname.replace(/\s+/g, '_');
      const filePath = path.join(filesDir, fileName);
      fs.writeFileSync(filePath, file.buffer);
      req.savedBookFilePath = '/uploads/files/' + fileName;
    }

    next();
  });
};

// Auth middleware
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

// Routes
app.get('/api/books', (req, res) => {
  const search = req.query.search || '';

  if (search) {
    db.all(
      `SELECT * FROM books 
       WHERE title LIKE ? OR author LIKE ? OR genre LIKE ?
       ORDER BY created_at DESC`,
      [`%${search}%`, `%${search}%`, `%${search}%`],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
      }
    );
  } else {
    db.all(`SELECT * FROM books ORDER BY created_at DESC`, [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }
});

app.get('/api/books/:id', (req, res) => {
  db.get(`SELECT * FROM books WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Book not found' });
    res.json(row);
  });
});

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  return res.status(401).json({ error: 'Invalid password' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/admin/check', (req, res) => {
  res.json({ isAdmin: !!req.session.isAdmin });
});

app.post('/api/books', requireAdmin, combinedUpload, (req, res) => {
  const { title, author, genre, description } = req.body;

  if (!title || !author) {
    return res.status(400).json({ error: 'Title and author are required' });
  }

  const coverImage = req.savedCoverPath || null;
  const filePath = req.savedBookFilePath || null;

  db.run(
    `INSERT INTO books (title, author, genre, description, cover_image, file_path)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [title, author, genre, description, coverImage, filePath],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

app.delete('/api/books/:id', requireAdmin, (req, res) => {
  db.get(`SELECT * FROM books WHERE id = ?`, [req.params.id], (err, book) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!book) return res.status(404).json({ error: 'Book not found' });

    if (book.cover_image) {
      const coverFsPath = path.join(__dirname, book.cover_image);
      if (fs.existsSync(coverFsPath)) fs.unlinkSync(coverFsPath);
    }

    if (book.file_path) {
      const fileFsPath = path.join(__dirname, book.file_path);
      if (fs.existsSync(fileFsPath)) fs.unlinkSync(fileFsPath);
    }

    db.run(`DELETE FROM books WHERE id = ?`, [req.params.id], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true });
    });
  });
});

// Fallback routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/books', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'books.html'));
});

app.get('/book', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'book.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`Library server running at http://localhost:${PORT}`);
});