const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3100;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Database setup - read path from configuration file
const configPath = path.join(__dirname, 'dbpath.conf');
const dbPath = fs.readFileSync(configPath, 'utf8').trim();
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// API Routes

// Get all books with pagination
app.get('/api/books', (req, res) => {
  // Disable caching so list always reflects latest edits
  res.setHeader('Cache-Control', 'no-store');
  
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;
  const search = req.query.search;
  const collana = req.query.collana;
  const owned = req.query.owned;
  const read = req.query.read;
  const digital = req.query.digital;
  
  let whereConditions = [];
  let params = [];
  
  if (search) {
    whereConditions.push('(title_ita COLLATE NOCASE LIKE ? OR title_orig COLLATE NOCASE LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
    console.log(`[SEARCH] Query: "${search}"`);
  }
  if (collana) {
    whereConditions.push('collana = ?');
    params.push(collana);
  }
  if (owned === 'true') {
    whereConditions.push('owned = 1');
  }
  if (read === 'true') {
    whereConditions.push('read = 1');
  }
  if (digital === 'true') {
    whereConditions.push('digital = 1');
  }
  
  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  
  // Get total count
  db.get(`SELECT COUNT(*) as total FROM books ${whereClause}`, params, (err, countRow) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const total = countRow.total;
    const offset = (page - 1) * limit;
    
    // Get paginated books
    const query = `SELECT * FROM books ${whereClause} ORDER BY number ASC LIMIT ? OFFSET ?`;
    db.all(query, [...params, limit, offset], (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        books: rows,
        total: total,
        page: page,
        limit: limit,
        pages: Math.ceil(total / limit)
      });
    });
  });
});

// Get all unique collections (collane)
app.get('/api/collane', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const query = `SELECT DISTINCT collana FROM books WHERE collana IS NOT NULL AND collana != '' ORDER BY collana ASC`;
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows.map(r => r.collana));
  });
});

// Get books by collection
app.get('/api/books/collana/:collana', (req, res) => {
  const collana = decodeURIComponent(req.params.collana);
  const query = `SELECT * FROM books WHERE collana = ? ORDER BY number ASC`;
  db.all(query, [collana], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get single book by ID
app.get('/api/books/:id', (req, res) => {
  const id = req.params.id;
  const query = `SELECT * FROM books WHERE id = ?`;
  db.get(query, [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    res.json(row);
  });
});

// Get previous book (by number)
app.get('/api/books/:id/prev', (req, res) => {
  const id = req.params.id;
  const collana = req.query.collana;
  const owned = req.query.owned;
  const read = req.query.read;
  const digital = req.query.digital;
  
  let whereConditions = ['b1.id = ?'];
  let params = [id];
  
  if (collana) {
    whereConditions.push('b2.collana = ?');
    params.push(collana);
  }
  if (owned === 'true') {
    whereConditions.push('b2.owned = 1');
  }
  if (read === 'true') {
    whereConditions.push('b2.read = 1');
  }
  if (digital === 'true') {
    whereConditions.push('b2.digital = 1');
  }
  
  const whereClause = whereConditions.join(' AND ');
  
  const query = `
    SELECT b2.* FROM books b1
    JOIN books b2 ON b2.number < b1.number
    WHERE ${whereClause}
    ORDER BY b2.number DESC
    LIMIT 1
  `;
  db.get(query, params, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'No previous book' });
      return;
    }
    res.json(row);
  });
});

// Get next book (by number)
app.get('/api/books/:id/next', (req, res) => {
  const id = req.params.id;
  const collana = req.query.collana;
  const owned = req.query.owned;
  const read = req.query.read;
  const digital = req.query.digital;
  
  let whereConditions = ['b1.id = ?'];
  let params = [id];
  
  if (collana) {
    whereConditions.push('b2.collana = ?');
    params.push(collana);
  }
  if (owned === 'true') {
    whereConditions.push('b2.owned = 1');
  }
  if (read === 'true') {
    whereConditions.push('b2.read = 1');
  }
  if (digital === 'true') {
    whereConditions.push('b2.digital = 1');
  }
  
  const whereClause = whereConditions.join(' AND ');
  
  const query = `
    SELECT b2.* FROM books b1
    JOIN books b2 ON b2.number > b1.number
    WHERE ${whereClause}
    ORDER BY b2.number ASC
    LIMIT 1
  `;
  db.get(query, params, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'No next book' });
      return;
    }
    res.json(row);
  });
});

// Get book position in filtered list
app.get('/api/books/:id/position', (req, res) => {
  const id = req.params.id;
  const collana = req.query.collana;
  const owned = req.query.owned;
  const read = req.query.read;
  const digital = req.query.digital;
  
  let whereConditions = [];
  let params = [];
  
  if (collana) {
    whereConditions.push('collana = ?');
    params.push(collana);
  }
  if (owned === 'true') {
    whereConditions.push('owned = 1');
  }
  if (read === 'true') {
    whereConditions.push('read = 1');
  }
  if (digital === 'true') {
    whereConditions.push('digital = 1');
  }
  
  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  
  // Get the book's number
  const bookQuery = `SELECT number FROM books WHERE id = ?`;
  db.get(bookQuery, [id], (err, bookRow) => {
    if (err || !bookRow) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    
    // Count how many books come before this one
    const countQuery = `
      SELECT COUNT(*) as position FROM books 
      ${whereClause}
      ${whereConditions.length > 0 ? 'AND' : 'WHERE'} number < ?
    `;
    
    db.get(countQuery, [...params, bookRow.number], (err, countRow) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ position: countRow.position });
    });
  });
});

// Update book
app.put('/api/books/:id', (req, res) => {
  const id = req.params.id;
  const {
    title_ita, title_orig, author, date_pub, cover_author,
    synopsis, owned, stars, comment, reprint, read, collana, editore, digital
  } = req.body;

  // Normalize stars to integer (0-50 expected, representing half-stars*10)
  const starsValue = Number.isFinite(parseInt(stars, 10)) ? parseInt(stars, 10) : 0;


  const query = `
    UPDATE books SET
      title_ita = ?,
      title_orig = ?,
      author = ?,
      date_pub = ?,
      cover_author = ?,
      synopsis = ?,
      owned = ?,
      stars = ?,
      comment = ?,
      reprint = ?,
      read = ?,
      collana = ?,
      editore = ?,
      digital = ?
    WHERE id = ?
  `;

  const params = [
    title_ita, title_orig, author, date_pub, cover_author,
    synopsis, owned ? 1 : 0, starsValue, comment, reprint ? 1 : 0, 
    read ? 1 : 0, collana, editore, digital ? 1 : 0, id
  ];

  db.run(query, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id, message: 'Book updated successfully' });
  });
});

// Get book comments/indexes
app.get('/api/indexes/:bookId', (req, res) => {
  const bookId = req.params.bookId;
  const query = `SELECT * FROM indexes WHERE id = ?`;
  db.all(query, [bookId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get book cover image
app.get('/api/books/:id/cover', (req, res) => {
  const id = req.params.id;
  const query = `SELECT cover_image FROM books WHERE id = ?`;
  db.get(query, [id], (err, row) => {
    if (err) {
      console.error('Error fetching cover:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row || !row.cover_image) {
      res.status(404).send('No cover image');
      return;
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(row.cover_image);
  });
});

// Get book synopsis image
app.get('/api/books/:id/synopsis-image', (req, res) => {
  const id = req.params.id;
  const query = `SELECT synopsis_image FROM books WHERE id = ?`;
  db.get(query, [id], (err, row) => {
    if (err) {
      console.error('Error fetching synopsis image:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row || !row.synopsis_image) {
      res.status(404).send('No synopsis image');
      return;
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(row.synopsis_image);
  });
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Diagnostic endpoint
app.get('/api/diagnostic', (req, res) => {
  const diagnostics = {
    database: 'unknown',
    totalBooks: 0,
    booksWithCoverImage: 0,
    booksWithSynopsisImage: 0,
    sampleBook: null
  };

  db.get(`SELECT COUNT(*) as count FROM books`, (err, row) => {
    if (err) {
      diagnostics.database = 'error: ' + err.message;
      return res.json(diagnostics);
    }
    
    diagnostics.totalBooks = row.count;
    
    db.get(`SELECT COUNT(*) as count FROM books WHERE cover_image IS NOT NULL AND typeof(cover_image) = 'blob'`, (err, row) => {
      if (err) {
        diagnostics.booksWithCoverImage = 'error';
      } else {
        diagnostics.booksWithCoverImage = row.count;
      }

      db.get(`SELECT COUNT(*) as count FROM books WHERE synopsis_image IS NOT NULL AND typeof(synopsis_image) = 'blob'`, (err, row) => {
        if (err) {
          diagnostics.booksWithSynopsisImage = 'error';
        } else {
          diagnostics.booksWithSynopsisImage = row.count;
        }

        db.get(`SELECT id, title_ita, title_orig, author, cover_image, synopsis_image FROM books LIMIT 1`, (err, row) => {
          if (!err && row) {
            diagnostics.sampleBook = {
              id: row.id,
              title_ita: row.title_ita,
              title_orig: row.title_orig,
              author: row.author,
              hasCoverImage: row.cover_image ? 'yes' : 'no',
              hasSynopsisImage: row.synopsis_image ? 'yes' : 'no'
            };
          }
          diagnostics.database = 'connected';
          res.json(diagnostics);
        });
      });
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
