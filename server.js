const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { parseBookFromHtml } = require('./service/htmlImportParser');

const app = express();
const PORT = 3100;

// Cache directories
const cacheDir = path.join(__dirname, 'cache');
const coverCacheDir = path.join(cacheDir, 'covers');
const synopsisCacheDir = path.join(cacheDir, 'synopsis');

// Create cache directories if they don't exist
[cacheDir, coverCacheDir, synopsisCacheDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Database setup - read path from configuration file
const configPath = path.join(__dirname, 'dbpath.conf');
const dbPathRaw = fs.readFileSync(configPath, 'utf8').trim();
// Resolve to absolute path if relative
const dbPath = path.isAbsolute(dbPathRaw) ? dbPathRaw : path.join(__dirname, dbPathRaw);

console.log('Database path:', dbPath);
console.log('Working directory:', process.cwd());
console.log('__dirname:', __dirname);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Database connection error:', err);
    console.error('Failed to open database at:', dbPath);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database');
    
    // Check write permissions
    db.run('PRAGMA query_only', [], (err, row) => {
      if (err) console.error('Error checking query_only pragma:', err);
    });
    
    initializeDatabase();
  }
});

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }

      resolve(this);
    });
  });
}

async function fetchRemoteText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla Firefox'
    }
  });

  if (!response.ok) {
    throw new Error(`Errore HTTP ${response.status} durante il download della pagina`);
  }

  return response.text();
}

async function fetchRemoteBuffer(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla Firefox'
    }
  });

  if (!response.ok) {
    throw new Error(`Errore HTTP ${response.status} durante il download dell'immagine`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function getImageContentType(imageBuffer) {
  if (!imageBuffer || imageBuffer.length < 4) {
    return 'application/octet-stream';
  }

  if (imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8) {
    return 'image/jpeg';
  }

  if (
    imageBuffer[0] === 0x89 &&
    imageBuffer[1] === 0x50 &&
    imageBuffer[2] === 0x4e &&
    imageBuffer[3] === 0x47
  ) {
    return 'image/png';
  }

  if (imageBuffer.subarray(0, 4).toString('ascii') === 'RIFF' && imageBuffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }

  if (imageBuffer.subarray(0, 3).toString('ascii') === 'GIF') {
    return 'image/gif';
  }

  return 'application/octet-stream';
}

function parseBase64Image(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.trim()) {
    return Buffer.alloc(0);
  }

  const match = dataUrl.match(/^data:.*;base64,(.+)$/);
  if (!match) {
    const error = new Error('Formato immagine non valido');
    error.statusCode = 400;
    throw error;
  }

  return Buffer.from(match[1], 'base64');
}

async function getOrCreateEditore(nome) {
  const normalizedName = typeof nome === 'string' ? nome.trim() : '';
  if (!normalizedName) {
    throw new Error('Editore mancante');
  }

  const existing = await dbGet('SELECT id FROM editori WHERE LOWER(nome) = LOWER(?)', [normalizedName]);
  if (existing) {
    return existing.id;
  }

  const inserted = await dbRun('INSERT INTO editori (nome) VALUES (?)', [normalizedName]);
  return inserted.lastID;
}

async function getOrCreateCollana(nome, editoreId) {
  const normalizedName = typeof nome === 'string' ? nome.trim() : '';
  if (!normalizedName) {
    throw new Error('Collana mancante');
  }

  const existing = await dbGet(
    'SELECT id FROM collane WHERE LOWER(nome) = LOWER(?) AND editore = ?',
    [normalizedName, editoreId]
  );

  if (existing) {
    return existing.id;
  }

  const inserted = await dbRun(
    'INSERT INTO collane (nome, editore) VALUES (?, ?)',
    [normalizedName, editoreId]
  );

  return inserted.lastID;
}

// Initialize database schema (add hash columns if missing)
function initializeDatabase() {
  db.serialize(() => {
    // Add cover_hash column if it doesn't exist
    db.run(`ALTER TABLE books ADD COLUMN cover_hash TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding cover_hash column:', err);
      }
    });
    
    // Add synopsis_hash column if it doesn't exist
    db.run(`ALTER TABLE books ADD COLUMN synopsis_hash TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding synopsis_hash column:', err);
      }
    });
    
    // Create indexes for faster hash lookups
    db.run(`CREATE INDEX IF NOT EXISTS idx_cover_hash ON books(cover_hash)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_synopsis_hash ON books(synopsis_hash)`);
  });
}

// ============================================
// CACHE UTILITIES
// ============================================

function getCacheFilePath(bookId, imageType) {
  const dir = imageType === 'cover' ? coverCacheDir : synopsisCacheDir;
  return path.join(dir, `${bookId}.jpg`);
}

function isCached(bookId, imageType) {
  const cachePath = getCacheFilePath(bookId, imageType);
  return fs.existsSync(cachePath);
}

function saveCacheImage(bookId, imageType, imageBuffer) {
  try {
    const cachePath = getCacheFilePath(bookId, imageType);
    if (!imageBuffer || imageBuffer.length === 0) {
      return false;
    }
    fs.writeFileSync(cachePath, imageBuffer);
    
    // Save hash to separate file for ultra-fast validation
    const hash = crypto.createHash('md5').update(imageBuffer).digest('hex');
    saveFileHash(bookId, imageType, hash);
    
    return true;
  } catch (err) {
    console.error(`Error saving ${imageType} cache for book ${bookId}:`, err);
    return false;
  }
}

// Get file hash path (separate metadata file)
function getHashFilePath(bookId, imageType) {
  const cachePath = getCacheFilePath(bookId, imageType);
  return cachePath + '.hash';
}

// Save hash to separate file (ultra-fast metadata)
function saveFileHash(bookId, imageType, hash) {
  try {
    const hashFilePath = getHashFilePath(bookId, imageType);
    fs.writeFileSync(hashFilePath, hash);
    return true;
  } catch (err) {
    return false;
  }
}

// Get hash from separate file (32 bytes, no image I/O)
function getCachedFileHash(bookId, imageType) {
  try {
    const hashFilePath = getHashFilePath(bookId, imageType);
    if (!fs.existsSync(hashFilePath)) return null;
    return fs.readFileSync(hashFilePath, 'utf8');
  } catch (err) {
    return null;
  }
}

function getCacheImage(bookId, imageType) {
  try {
    const cachePath = getCacheFilePath(bookId, imageType);
    if (fs.existsSync(cachePath)) {
      return fs.readFileSync(cachePath);
    }
  } catch (err) {
    console.error(`Error reading ${imageType} cache for book ${bookId}:`, err);
  }
  return null;
}

// Helper function to compute MD5 hash of image buffer
function getImageHash(imageBuffer) {
  if (!imageBuffer) return null;
  return crypto.createHash('md5').update(imageBuffer).digest('hex');
}

function clearBookCache(bookId) {
  try {
    const coverPath = getCacheFilePath(bookId, 'cover');
    const synopsisPath = getCacheFilePath(bookId, 'synopsis');
    const coverHashPath = getHashFilePath(bookId, 'cover');
    const synopsisHashPath = getHashFilePath(bookId, 'synopsis');
    
    if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
    if (fs.existsSync(synopsisPath)) fs.unlinkSync(synopsisPath);
    if (fs.existsSync(coverHashPath)) fs.unlinkSync(coverHashPath);
    if (fs.existsSync(synopsisHashPath)) fs.unlinkSync(synopsisHashPath);
    return true;
  } catch (err) {
    console.error(`Error clearing cache for book ${bookId}:`, err);
    return false;
  }
}

// Pre-cache adjacent images (look-ahead and look-behind) using hash-based validation
function preCacheAdjacentImages(bookId, filters = {}, lookAhead = 2, lookBehind = 2) {
  // Build where conditions for prev books (same as /prev endpoint)
  let behindConditions = ['b1.id = ?'];
  let behindParams = [bookId];
  
  if (filters.collana) {
    behindConditions.push('b2.collana = ?');
    behindParams.push(filters.collana);
  }
  if (filters.owned === 'true') {
    behindConditions.push('b2.owned = 1');
  }
  if (filters.read === 'true') {
    behindConditions.push('b2.read = 1');
  }
  if (filters.digital === 'true') {
    behindConditions.push('b2.digital = 1');
  }
  
  const behindWhereClause = behindConditions.join(' AND ');
  
  // Get lookBehind books (same as /prev endpoint)
  const behindQuery = `
    SELECT b2.id, b2.cover_hash, b2.synopsis_hash FROM books b1
    JOIN books b2 ON b2.number < b1.number
    WHERE ${behindWhereClause}
    ORDER BY b2.number DESC
    LIMIT ?
  `;
  behindParams.push(lookBehind);
  
  // Build where conditions for next books (same as /next endpoint)
  let aheadConditions = ['b1.id = ?'];
  let aheadParams = [bookId];
  
  if (filters.collana) {
    aheadConditions.push('b2.collana = ?');
    aheadParams.push(filters.collana);
  }
  if (filters.owned === 'true') {
    aheadConditions.push('b2.owned = 1');
  }
  if (filters.read === 'true') {
    aheadConditions.push('b2.read = 1');
  }
  if (filters.digital === 'true') {
    aheadConditions.push('b2.digital = 1');
  }
  
  const aheadWhereClause = aheadConditions.join(' AND ');
  
  // Get lookAhead books (same as /next endpoint)
  const aheadQuery = `
    SELECT b2.id, b2.cover_hash, b2.synopsis_hash FROM books b1
    JOIN books b2 ON b2.number > b1.number
    WHERE ${aheadWhereClause}
    ORDER BY b2.number ASC
    LIMIT ?
  `;
  aheadParams.push(lookAhead);
  
  // Execute both queries
  db.all(behindQuery, behindParams, (err, behindBooks) => {
    if (err) {
      console.error('Error in behindQuery:', err);
      return;
    }
    
    db.all(aheadQuery, aheadParams, (err, aheadBooks) => {
      if (err) {
        console.error('Error in aheadQuery:', err);
        return;
      }
      
      const allBooks = [...(behindBooks || []), ...(aheadBooks || [])];
      
      // Cache images asynchronously using HASH-FILE validation (no I/O of image data)
      setImmediate(() => {
        allBooks.forEach(book => {
          // Cover: validate cache using only hash file (32 bytes, <1ms)
          if (book.cover_hash) {
            const cachedHash = getCachedFileHash(book.id, 'cover');
            
            if (cachedHash === null) {
              // Cache miss: reload from DB
              db.get('SELECT cover_image FROM books WHERE id = ?', [book.id], (err, row) => {
                if (row && row.cover_image) {
                  saveCacheImage(book.id, 'cover', row.cover_image);
                }
              });
            } else if (cachedHash !== book.cover_hash) {
              // Hash mismatch: image changed, reload from DB
              db.get('SELECT cover_image FROM books WHERE id = ?', [book.id], (err, row) => {
                if (row && row.cover_image) {
                  saveCacheImage(book.id, 'cover', row.cover_image);
                }
              });
            } else {
              // Cache hit: hash matches, skip
            }
          }
          
          // Synopsis: same logic
          if (book.synopsis_hash) {
            const cachedHash = getCachedFileHash(book.id, 'synopsis');
            
            if (cachedHash === null) {
              // Cache miss: reload from DB
              db.get('SELECT synopsis_image FROM books WHERE id = ?', [book.id], (err, row) => {
                if (row && row.synopsis_image) {
                  saveCacheImage(book.id, 'synopsis', row.synopsis_image);
                }
              });
            } else if (cachedHash !== book.synopsis_hash) {
              // Hash mismatch: image changed, reload from DB
              db.get('SELECT synopsis_image FROM books WHERE id = ?', [book.id], (err, row) => {
                if (row && row.synopsis_image) {
                  saveCacheImage(book.id, 'synopsis', row.synopsis_image);
                }
              });
            } else {
              // Cache hit: hash matches, skip
            }
          }
        });
      });
    });
  });
}

// Preload cache for a single book (from list or editor view)
function preloadBookCache(bookId) {
  db.get('SELECT id, cover_hash, synopsis_hash FROM books WHERE id = ?', [bookId], (err, book) => {
    if (err || !book) return;
    
    // Cover: validate cache using only hash file
    if (book.cover_hash) {
      const cachedHash = getCachedFileHash(book.id, 'cover');
      
      if (cachedHash === null) {
        console.log(`[CACHE] MISS - cover for book ${book.id}`);
        db.get('SELECT cover_image FROM books WHERE id = ?', [book.id], (err, row) => {
          if (row && row.cover_image) {
            console.log(`[CACHE] DOWNLOAD - cover from DB for book ${book.id}`);
            saveCacheImage(book.id, 'cover', row.cover_image);
          }
        });
      } else if (cachedHash !== book.cover_hash) {
        console.log(`[CACHE] MISMATCH - cover hash for book ${book.id} (cached: ${cachedHash.substring(0, 8)}... vs db: ${book.cover_hash.substring(0, 8)}...)`);
        db.get('SELECT cover_image FROM books WHERE id = ?', [book.id], (err, row) => {
          if (row && row.cover_image) {
            console.log(`[CACHE] DOWNLOAD - cover from DB for book ${book.id} (hash changed)`);
            saveCacheImage(book.id, 'cover', row.cover_image);
          }
        });
      } else {
        console.log(`[CACHE] HIT - cover for book ${book.id}`);
      }
    }
    
    // Synopsis
    if (book.synopsis_hash) {
      const cachedHash = getCachedFileHash(book.id, 'synopsis');
      
      if (cachedHash === null) {
        console.log(`[CACHE] MISS - synopsis for book ${book.id}`);
        db.get('SELECT synopsis_image FROM books WHERE id = ?', [book.id], (err, row) => {
          if (row && row.synopsis_image) {
            console.log(`[CACHE] DOWNLOAD - synopsis from DB for book ${book.id}`);
            saveCacheImage(book.id, 'synopsis', row.synopsis_image);
          }
        });
      } else if (cachedHash !== book.synopsis_hash) {
        console.log(`[CACHE] MISMATCH - synopsis hash for book ${book.id} (cached: ${cachedHash.substring(0, 8)}... vs db: ${book.synopsis_hash.substring(0, 8)}...)`);
        db.get('SELECT synopsis_image FROM books WHERE id = ?', [book.id], (err, row) => {
          if (row && row.synopsis_image) {
            console.log(`[CACHE] DOWNLOAD - synopsis from DB for book ${book.id} (hash changed)`);
            saveCacheImage(book.id, 'synopsis', row.synopsis_image);
          }
        });
      } else {
        console.log(`[CACHE] HIT - synopsis for book ${book.id}`);
      }
    }
  });
}

// API Routes

app.post('/api/books', async (req, res) => {
  const payload = req.body || {};
  const number = parseInt(payload.number, 10);
  const stars = parseInt(payload.stars, 10);
  const titleIta = typeof payload.title_ita === 'string' ? payload.title_ita.trim() : '';
  const titleOrig = typeof payload.title_orig === 'string' ? payload.title_orig.trim() : '';
  const author = typeof payload.author === 'string' ? payload.author.trim() : '';
  const coverAuthor = typeof payload.cover_author === 'string' && payload.cover_author.trim()
    ? payload.cover_author.trim()
    : 'N/A';
  const synopsis = typeof payload.synopsis === 'string' ? payload.synopsis.trim() : '';
  const comment = typeof payload.comment === 'string' ? payload.comment.trim() : '';
  const useNewCollana = Boolean(payload.useNewCollana);

  if (!Number.isInteger(number) || number <= 0) {
    res.status(400).json({ error: 'Numero non valido' });
    return;
  }

  if (!titleIta) {
    res.status(400).json({ error: 'Titolo italiano obbligatorio' });
    return;
  }

  if (!author) {
    res.status(400).json({ error: 'Autore obbligatorio' });
    return;
  }

  let transactionStarted = false;

  try {
    let collanaId;
    let editoreId;

    if (useNewCollana) {
      const newCollanaName = typeof payload.newCollanaName === 'string' ? payload.newCollanaName.trim() : '';
      const newEditoreName = typeof payload.newEditoreName === 'string' ? payload.newEditoreName.trim() : '';

      if (!newCollanaName) {
        const error = new Error('Nome nuova collana obbligatorio');
        error.statusCode = 400;
        throw error;
      }

      if (!newEditoreName) {
        const error = new Error('Editore obbligatorio per la nuova collana');
        error.statusCode = 400;
        throw error;
      }

      await dbRun('BEGIN TRANSACTION');
      transactionStarted = true;

      editoreId = await getOrCreateEditore(newEditoreName);
      collanaId = await getOrCreateCollana(newCollanaName, editoreId);
    } else {
      collanaId = parseInt(payload.collanaId, 10);
      if (!Number.isInteger(collanaId) || collanaId <= 0) {
        const error = new Error('Seleziona una collana valida');
        error.statusCode = 400;
        throw error;
      }

      await dbRun('BEGIN TRANSACTION');
      transactionStarted = true;

      const collanaRow = await dbGet('SELECT id, editore FROM collane WHERE id = ?', [collanaId]);
      if (!collanaRow) {
        const error = new Error('Collana non trovata');
        error.statusCode = 404;
        throw error;
      }

      editoreId = collanaRow.editore;
    }

    const existingBook = await dbGet(
      'SELECT id FROM books WHERE LOWER(title_ita) = LOWER(?) AND LOWER(author) = LOWER(?) AND collana = ?',
      [titleIta, author, collanaId]
    );

    if (existingBook) {
      const error = new Error('Il libro esiste gia in questa collana');
      error.statusCode = 409;
      error.bookId = existingBook.id;
      throw error;
    }

    const coverImage = payload.coverImage ? parseBase64Image(payload.coverImage) : Buffer.alloc(0);
    const coverHash = coverImage.length > 0 ? getImageHash(coverImage) : '';

    const insertResult = await dbRun(
      `INSERT INTO books (
        number, title_ita, title_orig, author, date_pub, cover_author, cover_image,
        synopsis, synopsis_image, owned, stars, comment, reprint, read, digital,
        cover_hash, synopsis_hash, editore, collana
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        number,
        titleIta,
        titleOrig || titleIta,
        author,
        payload.date_pub || null,
        coverAuthor,
        coverImage,
        synopsis,
        Buffer.alloc(0),
        payload.owned ? 1 : 0,
        Number.isInteger(stars) ? stars : 0,
        comment,
        payload.reprint ? 1 : 0,
        payload.read ? 1 : 0,
        payload.digital ? 1 : 0,
        coverHash,
        '',
        editoreId,
        collanaId
      ]
    );

    await dbRun('COMMIT');
    transactionStarted = false;

    const createdBook = await dbGet(
      `SELECT b.*, c.nome AS collanaNome, e.nome AS editoreNome
       FROM books b
       LEFT JOIN collane c ON b.collana = c.id
       LEFT JOIN editori e ON b.editore = e.id
       WHERE b.id = ?`,
      [insertResult.lastID]
    );

    res.status(201).json({
      message: 'Libro creato con successo',
      book: createdBook
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await dbRun('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback failed while creating book:', rollbackError);
      }
    }

    if (error.statusCode) {
      const responseBody = { error: error.message };
      if (error.bookId) {
        responseBody.id = error.bookId;
      }
      res.status(error.statusCode).json(responseBody);
      return;
    }

    console.error('Error creating book:', error);
    res.status(500).json({ error: 'Errore durante la creazione del libro' });
  }
});

// Get all books with pagination
app.get('/api/books', (req, res) => {
  // Disable caching so list always reflects latest edits
  res.setHeader('Cache-Control', 'no-store');
  
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;
  const search = req.query.search;
  const searchNumber = req.query.searchNumber;
  const collana = req.query.collana;
  const owned = req.query.owned;
  const notOwned = req.query.notOwned;
  const read = req.query.read;
  const notRead = req.query.notRead;
  const digital = req.query.digital;
  
  let whereConditions = [];
  let params = [];
  
  if (search) {
    whereConditions.push('(title_ita COLLATE NOCASE LIKE ? OR title_orig COLLATE NOCASE LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
    console.log(`[SEARCH] Query: "${search}"`);
  }
  if (searchNumber) {
    const num = parseInt(searchNumber, 10);
    if (!isNaN(num)) {
      whereConditions.push('number = ?');
      params.push(num);
      console.log(`[SEARCH] Number: ${num}`);
    }
  }
  if (collana) {
    whereConditions.push('collana = ?');
    params.push(collana);
  }
  if (owned === 'true') {
    whereConditions.push('owned = 1');
  }
  if (notOwned === 'true') {
    whereConditions.push('owned = 0');
  }
  if (read === 'true') {
    whereConditions.push('read = 1');
  }
  if (notRead === 'true') {
    whereConditions.push('read = 0');
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
      
      // Pre-cache images for books in this page (asynchronously)
      if (rows && rows.length > 0) {
        console.log(`[LIST] Pre-caching ${rows.length} books from page ${page}`);
        setImmediate(() => {
          rows.forEach(book => {
            preloadBookCache(book.id);
          });
        });
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
  const query = `SELECT id,nome FROM collane ORDER BY nome ASC`;
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows.map(r => ({ id: r.id, nome: r.nome })));
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

  //this query recover the book from ID and adds in the row the name of the collana and editore as collanaNome and editoreNome
  const query = `SELECT b.*, c.nome as collanaNome, e.nome as editoreNome FROM books b LEFT JOIN collane c ON b.collana = c.id LEFT JOIN editori e ON b.editore = e.id WHERE b.id = ?`; 


  
  db.get(query, [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    
    // Pre-cache adjacent images (look-ahead and look-behind)
    const filters = {
      collana: req.query.collana || '',
      owned: req.query.owned || '',
      notOwned: req.query.notOwned || '',
      read: req.query.read || '',
      notRead: req.query.notRead || '',
      digital: req.query.digital || '',
      search: req.query.search || '',
      collanaNome: req.query.collanaNome || '',
      editoreNome: req.query.editoreNome || ''
    };
    preCacheAdjacentImages(id, filters, 3, 3); // 3 ahead, 3 behind
    
    res.json(row);
  });
});

// Get previous book (by number)
app.get('/api/books/:id/prev', (req, res) => {
  const id = req.params.id;
  const collana = req.query.collana;
  const owned = req.query.owned;
  const notOwned = req.query.notOwned;
  const read = req.query.read;
  const notRead = req.query.notRead;
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
  if (notOwned === 'true') {
    whereConditions.push('b2.owned = 0');
  }
  if (read === 'true') {
    whereConditions.push('b2.read = 1');
  }
  if (notRead === 'true') {
    whereConditions.push('b2.read = 0');
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
  const notOwned = req.query.notOwned;
  const read = req.query.read;
  const notRead = req.query.notRead;
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
  if (notOwned === 'true') {
    whereConditions.push('b2.owned = 0');
  }
  if (read === 'true') {
    whereConditions.push('b2.read = 1');
  }
  if (notRead === 'true') {
    whereConditions.push('b2.read = 0');
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
  const updateData = req.body;

  // Build dynamic UPDATE query based on provided fields
  const allowedFields = [
    'title_ita', 'title_orig', 'author', 'date_pub', 'cover_author',
    'synopsis', 'owned', 'stars', 'comment', 'reprint', 'read', 
    'collana', 'editore', 'digital'
  ];

  const fieldsToUpdate = [];
  const params = [];

  allowedFields.forEach(field => {
    if (updateData.hasOwnProperty(field)) {
      fieldsToUpdate.push(`${field} = ?`);
      
      // Handle boolean fields
      if (['owned', 'read', 'reprint', 'digital'].includes(field)) {
        params.push(updateData[field] ? 1 : 0);
      }
      // Handle stars (normalize to integer)
      else if (field === 'stars') {
        params.push(Number.isFinite(parseInt(updateData[field], 10)) ? parseInt(updateData[field], 10) : 0);
      }
      // Handle other fields as-is
      else {
        params.push(updateData[field]);
      }
    }
  });

  if (fieldsToUpdate.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  params.push(id); // Add id as last parameter

  const query = `UPDATE books SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;

  db.run(query, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Clear cache for this book since it was updated
    clearBookCache(id);
    res.json({ id, message: 'Book updated successfully' });
  });
});

app.delete('/api/books/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'ID libro non valido' });
    return;
  }

  let transactionStarted = false;

  try {
    await dbRun('BEGIN TRANSACTION');
    transactionStarted = true;

    await dbRun('DELETE FROM indexes WHERE id = ?', [id]);
    const deleteResult = await dbRun('DELETE FROM books WHERE id = ?', [id]);

    if (!deleteResult.changes) {
      const notFoundError = new Error('Book not found');
      notFoundError.statusCode = 404;
      throw notFoundError;
    }

    await dbRun('COMMIT');
    transactionStarted = false;

    clearBookCache(id);

    res.json({
      id,
      message: 'Book deleted successfully'
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await dbRun('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback failed while deleting book:', rollbackError);
      }
    }

    if (error.statusCode === 404) {
      res.status(404).json({ error: 'Libro non trovato' });
      return;
    }

    console.error('Error deleting book:', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione del libro' });
  }
});

app.post('/api/import/web', async (req, res) => {
  const sourceUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  const collanaId = parseInt(req.body?.collanaId, 10);

  if (!sourceUrl) {
    res.status(400).json({ error: 'URL mancante' });
    return;
  }

  if (!Number.isInteger(collanaId) || collanaId <= 0) {
    res.status(400).json({ error: 'Collana non valida' });
    return;
  }

  try {
    const collana = await dbGet(
      `SELECT c.id, c.nome, c.editore, e.nome AS editoreNome
       FROM collane c
       LEFT JOIN editori e ON e.id = c.editore
       WHERE c.id = ?`,
      [collanaId]
    );

    if (!collana) {
      res.status(404).json({ error: 'Collana non trovata' });
      return;
    }

    const html = await fetchRemoteText(sourceUrl);
    const parsedBook = parseBookFromHtml(html, {
      baseUrl: sourceUrl,
      collanaName: collana.nome
    });

    const book = {
      number: Number.isInteger(parsedBook.number) ? parsedBook.number : 0,
      title_ita: parsedBook.title_ita || '',
      title_orig: parsedBook.title_orig || parsedBook.title_ita || '',
      author: parsedBook.author || '',
      date_pub: parsedBook.date_pub || null,
      cover_author: parsedBook.cover_author || 'N/A',
      synopsis: parsedBook.synopsis || '',
      owned: 0,
      stars: 0,
      comment: '',
      reprint: 0,
      read: 0,
      digital: 0,
      collana: collana.id,
      editore: collana.editore,
      index: parsedBook.index || []
    };

    if (!book.title_ita || !book.author) {
      res.status(422).json({ error: 'Parsing incompleto: titolo o autore non trovati nella pagina HTML' });
      return;
    }

    const existingBook = await dbGet(
      'SELECT id FROM books WHERE LOWER(title_ita) = LOWER(?) AND LOWER(author) = LOWER(?) AND collana = ?',
      [book.title_ita, book.author, book.collana]
    );

    if (existingBook) {
      res.status(409).json({ error: 'Il libro esiste gia in questa collana', id: existingBook.id });
      return;
    }

    let coverImage = Buffer.alloc(0);
    if (parsedBook.coverImageUrl) {
      try {
        coverImage = await fetchRemoteBuffer(parsedBook.coverImageUrl);
      } catch (error) {
        console.warn('Cover download failed:', error.message);
      }
    }

    let synopsisImage = Buffer.alloc(0);
    if (!book.synopsis && parsedBook.synopsisImageUrl) {
      try {
        synopsisImage = await fetchRemoteBuffer(parsedBook.synopsisImageUrl);
      } catch (error) {
        console.warn('Synopsis image download failed:', error.message);
      }
    }

    const coverHash = coverImage.length > 0 ? getImageHash(coverImage) : '';
    const synopsisHash = synopsisImage.length > 0 ? getImageHash(synopsisImage) : '';

    const insertResult = await dbRun(
      `INSERT INTO books (
        number, title_ita, title_orig, author, date_pub, cover_author, cover_image,
        synopsis, synopsis_image, owned, stars, comment, reprint, read, digital,
        cover_hash, synopsis_hash, editore, collana
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        book.number,
        book.title_ita,
        book.title_orig,
        book.author,
        book.date_pub,
        book.cover_author,
        coverImage,
        book.synopsis,
        synopsisImage,
        book.owned,
        book.stars,
        book.comment,
        book.reprint,
        book.read,
        book.digital,
        coverHash,
        synopsisHash,
        book.editore,
        book.collana
      ]
    );

    for (const indexEntry of book.index) {
      if (!indexEntry || (!indexEntry.title && !indexEntry.author)) {
        continue;
      }

      await dbRun(
        'INSERT INTO indexes (id, title, author) VALUES (?, ?, ?)',
        [insertResult.lastID, indexEntry.title || '', indexEntry.author || '']
      );
    }

    const importedBook = await dbGet(
      `SELECT b.*, c.nome AS collanaNome, e.nome AS editoreNome
       FROM books b
       LEFT JOIN collane c ON b.collana = c.id
       LEFT JOIN editori e ON b.editore = e.id
       WHERE b.id = ?`,
      [insertResult.lastID]
    );

    res.status(201).json({
      message: 'Libro importato con successo',
      book: importedBook
    });
  } catch (error) {
    console.error('Error importing book from web:', error);
    res.status(500).json({ error: 'Errore durante l\'importazione dal web' });
  }
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

// Get book cover image with caching
app.get('/api/books/:id/cover', (req, res) => {
  const id = req.params.id;
  
  // Check cache first
  const cachedImage = getCacheImage(id, 'cover');
  if (cachedImage) {
    res.setHeader('Content-Type', getImageContentType(cachedImage));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(cachedImage);
    return;
  }
  
  // If not in cache, fetch from database
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
    
    // Save to cache
    saveCacheImage(id, 'cover', row.cover_image);
    
    res.setHeader('Content-Type', getImageContentType(row.cover_image));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(row.cover_image);
  });
});

// Get book synopsis image with caching
app.get('/api/books/:id/synopsis-image', (req, res) => {
  const id = req.params.id;
  
  // Check cache first
  const cachedImage = getCacheImage(id, 'synopsis');
  if (cachedImage) {
    res.setHeader('Content-Type', getImageContentType(cachedImage));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(cachedImage);
    return;
  }
  
  // If not in cache, fetch from database
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
    
    // Save to cache
    saveCacheImage(id, 'synopsis', row.synopsis_image);
    
    res.setHeader('Content-Type', getImageContentType(row.synopsis_image));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(row.synopsis_image);
  });
});

// Clear cache for a book (used after updates)
app.delete('/api/cache/:bookId', (req, res) => {
  const bookId = req.params.bookId;
  clearBookCache(bookId);
  res.json({ message: 'Cache cleared for book ' + bookId });
});

// Clear all cache
app.delete('/api/cache', (req, res) => {
  try {
    const files = fs.readdirSync(coverCacheDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(coverCacheDir, file));
    });
    const synFiles = fs.readdirSync(synopsisCacheDir);
    synFiles.forEach(file => {
      fs.unlinkSync(path.join(synopsisCacheDir, file));
    });
    res.json({ message: 'All cache cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Cache diagnostic endpoint
app.get('/api/cache-status', (req, res) => {
  try {
    const coverFiles = fs.readdirSync(coverCacheDir).length;
    const synopsisFiles = fs.readdirSync(synopsisCacheDir).length;
    
    let coverSize = 0, synopsisSize = 0;
    
    fs.readdirSync(coverCacheDir).forEach(file => {
      coverSize += fs.statSync(path.join(coverCacheDir, file)).size;
    });
    
    fs.readdirSync(synopsisCacheDir).forEach(file => {
      synopsisSize += fs.statSync(path.join(synopsisCacheDir, file)).size;
    });
    
    res.json({
      cache: {
        covers: {
          files: coverFiles,
          sizeBytes: coverSize,
          sizeMB: (coverSize / 1024 / 1024).toFixed(2)
        },
        synopsis: {
          files: synopsisFiles,
          sizeBytes: synopsisSize,
          sizeMB: (synopsisSize / 1024 / 1024).toFixed(2)
        },
        total: {
          files: coverFiles + synopsisFiles,
          sizeBytes: coverSize + synopsisSize,
          sizeMB: ((coverSize + synopsisSize) / 1024 / 1024).toFixed(2)
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pre-warm cache endpoint (for a specific book)
app.post('/api/cache/warm/:bookId', (req, res) => {
  const bookId = req.params.bookId;
  const filters = req.body || {};
  
  console.log(`[CACHE] Manual warm-up requested for book ${bookId}`);
  preCacheAdjacentImages(bookId, filters, 5, 5);
  
  res.json({ message: `Cache warm-up started for book ${bookId}` });
});

// Populate image hashes for all books (one-time or maintenance task)
app.post('/api/hash/populate', (req, res) => {
  res.json({ message: 'Hash population started in background' });
  
  // Run in background without blocking
  setImmediate(() => {
    const batchSize = 100;
    let processed = 0;
    let updated = 0;
    
    // Get all books that don't have hashes
    const countQuery = `SELECT COUNT(*) as count FROM books WHERE cover_hash IS NULL OR synopsis_hash IS NULL`;
    
    db.get(countQuery, (err, result) => {
      if (err) {
        console.error('Error counting books without hashes:', err);
        return;
      }
      
      const totalBooks = result.count;
      console.log(`[HASH] Starting population of ${totalBooks} books`);
      
      function processBatch(offset) {
        const getUnhashedQuery = `
          SELECT id, cover_image, synopsis_image, cover_hash, synopsis_hash 
          FROM books 
          WHERE cover_hash IS NULL OR synopsis_hash IS NULL
          ORDER BY id ASC
          LIMIT ? OFFSET ?
        `;
        
        db.all(getUnhashedQuery, [batchSize, offset], (err, books) => {
          if (err) {
            console.error('Error fetching books for hashing:', err);
            return;
          }
          
          if (!books || books.length === 0) {
            console.log(`[HASH] Completed! Processed: ${processed}, Updated: ${updated}`);
            return;
          }
          
          let batchUpdated = 0;
          books.forEach(book => {
            let needsUpdate = false;
            const updates = {};
            
            if (book.cover_image && !book.cover_hash) {
              const hash = getImageHash(book.cover_image);
              updates.cover_hash = hash;
              needsUpdate = true;
            }
            
            if (book.synopsis_image && !book.synopsis_hash) {
              const hash = getImageHash(book.synopsis_image);
              updates.synopsis_hash = hash;
              needsUpdate = true;
            }
            
            if (needsUpdate) {
              const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
              const values = Object.values(updates);
              const updateQuery = `UPDATE books SET ${setClauses} WHERE id = ?`;
              
              db.run(updateQuery, [...values, book.id], (err) => {
                if (err) {
                  console.error(`Error updating hashes for book ${book.id}:`, err);
                } else {
                  updated++;
                  batchUpdated++;
                }
              });
            }
            
            processed++;
          });
          
          // Log progress
          console.log(`[HASH] Processed: ${processed}/${totalBooks} (${Math.round(processed/totalBooks*100)}%) - Updated in batch: ${batchUpdated}`);
          
          // Process next batch if there are more books
          if (books.length === batchSize) {
            setImmediate(() => processBatch(offset + batchSize));
          }
        });
      }
      
      // Start processing
      processBatch(0);
    });
  });
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
