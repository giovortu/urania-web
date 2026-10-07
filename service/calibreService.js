const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');
const cheerio = require('cheerio');

// Cache configuration
let cachedConfig = null;

function resolvePath(filePath) {
  if (!filePath) return '';
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

function loadCalibreConfig(forceReload = false) {
  if (cachedConfig && !forceReload) {
    return cachedConfig;
  }

  const config = {
    calibreDir: '',
    calibreWebDb: '',
    calibreWebUrl: 'http://localhost:8083',
    configured: false
  };

  const configPath = path.join(__dirname, '..', 'calibre.conf');
  if (fs.existsSync(configPath)) {
    const lines = fs.readFileSync(configPath, 'utf8').split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      if (line.includes('=')) {
        const [key, ...rest] = line.split('=');
        const val = rest.join('=').trim();
        const upperKey = key.trim().toUpperCase();
        if (upperKey === 'CALIBRE_DIR' || upperKey === 'CALIBRE_LIBRARY_DIR' || upperKey === 'LIBRARY_DIR') {
          config.calibreDir = resolvePath(val);
        } else if (upperKey === 'CALIBRE_WEB_DB' || upperKey === 'APP_DB') {
          config.calibreWebDb = resolvePath(val);
        } else if (upperKey === 'CALIBRE_WEB_URL' || upperKey === 'URL') {
          config.calibreWebUrl = val;
        }
      } else if (!config.calibreDir) {
        // Plain path line
        config.calibreDir = resolvePath(line);
      }
    }
  }

  // Auto-discover Calibre-Web app.db if not explicitly set
  if (!config.calibreWebDb || !fs.existsSync(config.calibreWebDb)) {
    const candidateWebDbs = [
      path.resolve(__dirname, '../../calibre-web/app.db'),
      path.resolve(__dirname, '../calibre-web/app.db'),
      path.join(os.homedir(), 'Documents/Projects/calibre-web/app.db'),
      path.join(os.homedir(), '.config/calibre-web/app.db')
    ];
    for (const cand of candidateWebDbs) {
      if (fs.existsSync(cand)) {
        config.calibreWebDb = cand;
        break;
      }
    }
  }

  // If app.db exists, read settings from it (calibre_dir and port)
  if (config.calibreWebDb && fs.existsSync(config.calibreWebDb)) {
    try {
      const appDb = new sqlite3.Database(config.calibreWebDb, sqlite3.OPEN_READONLY);
      appDb.get('SELECT config_calibre_dir, config_port FROM settings LIMIT 1', (err, row) => {
        if (!err && row) {
          if (!config.calibreDir && row.config_calibre_dir) {
            config.calibreDir = resolvePath(row.config_calibre_dir);
          }
          if (row.config_port && (!config.calibreWebUrl || config.calibreWebUrl === 'http://localhost:8083')) {
            config.calibreWebUrl = `http://localhost:${row.config_port}`;
          }
        }
        appDb.close();
      });
    } catch {
      // Ignore reading errors
    }
  }

  // Auto-discover Calibre Library dir if still missing
  if (!config.calibreDir || !fs.existsSync(config.calibreDir)) {
    const calibreGlobalConfig = path.join(os.homedir(), '.config/calibre/global.py.json');
    if (fs.existsSync(calibreGlobalConfig)) {
      try {
        const globalData = JSON.parse(fs.readFileSync(calibreGlobalConfig, 'utf8'));
        if (globalData.library_path && fs.existsSync(globalData.library_path)) {
          config.calibreDir = globalData.library_path;
        }
      } catch {
        // Ignore JSON error
      }
    }
  }

  if (!config.calibreDir || !fs.existsSync(config.calibreDir)) {
    const candidateDirs = [
      path.join(os.homedir(), 'Calibre Library'),
      path.join(os.homedir(), 'Documents/Calibre Library')
    ];
    for (const cand of candidateDirs) {
      if (fs.existsSync(cand) && fs.existsSync(path.join(cand, 'metadata.db'))) {
        config.calibreDir = cand;
        break;
      }
    }
  }

  config.configured = Boolean(
    config.calibreDir &&
    fs.existsSync(config.calibreDir) &&
    fs.existsSync(path.join(config.calibreDir, 'metadata.db'))
  );

  cachedConfig = config;
  return config;
}

function openSqliteReadOnly(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function runQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function getQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function parseEpub(epubPath) {
  const result = {
    titleOrig: '',
    coverAuthor: '',
    synopsis: '',
    copyrightYear: '',
    index: []
  };

  if (!epubPath || !fs.existsSync(epubPath)) {
    return result;
  }

  try {
    const listOutput = execSync(`unzip -l "${epubPath}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const lines = listOutput.split('\n');
    const files = lines.map(line => line.trim().split(/\s+/).pop()).filter(Boolean);

    // 1. Parse Copyright / Colophon file
    const copyrightFile = files.find(f => /copyright\.xhtml$/i.test(f) || /colophon\.xhtml$/i.test(f));
    if (copyrightFile) {
      try {
        const html = execSync(`unzip -p "${epubPath}" "${copyrightFile}"`, {
          encoding: 'utf8',
          maxBuffer: 5 * 1024 * 1024
        });
        const $ = cheerio.load(html, { xml: true });

        // Search for original title
        $('p').each((_, el) => {
          const text = $(el).text();
          if (/titolo originale:?/i.test(text)) {
            let orig = text.replace(/titolo originale:?/i, '').trim();
            if (orig) {
              result.titleOrig = orig;
            }
          }
          if (/©\s*(\d{4})/i.test(text)) {
            const match = text.match(/©\s*(\d{4})/i);
            if (match && !result.copyrightYear) {
              result.copyrightYear = match[1];
            }
          }
        });

        // Search for cover artist credits
        const credits = $('.credits, [role="doc-credits"]').text() || $('body').text();
        const coverMatch = credits.match(/COPERTINA[^:]*:?\s*([^|\n<]+)/i) ||
                           credits.match(/GRAPHIC DESIGNER:?\s*([^|\n<]+)/i);
        if (coverMatch) {
          result.coverAuthor = coverMatch[1]
            .replace(/COPERTINA\s*\|\|\s*GRAPHIC DESIGNER:?/i, '')
            .replace(/\|.*/, '')
            .trim();
        }
      } catch (err) {
        console.warn('Error reading copyright file from epub:', err.message);
      }
    }

    // 2. Parse Synopsis file (il-libro / sinossi)
    const synopsisFile = files.find(f => /il-libro\.xhtml$/i.test(f) || /sinossi\.xhtml$/i.test(f));
    if (synopsisFile) {
      try {
        const html = execSync(`unzip -p "${epubPath}" "${synopsisFile}"`, {
          encoding: 'utf8',
          maxBuffer: 5 * 1024 * 1024
        });
        const $ = cheerio.load(html, { xml: true });
        const paragraphs = [];
        $('section[role="doc-abstract"] p, .main p, body p').each((_, el) => {
          const t = $(el).text().trim();
          if (t && !t.toLowerCase().startsWith('il libro')) {
            paragraphs.push(t);
          }
        });
        if (paragraphs.length > 0) {
          result.synopsis = paragraphs.join('\n\n');
        }
      } catch (err) {
        console.warn('Error reading synopsis file from epub:', err.message);
      }
    }

    // 3. Fallback: check OPF description
    if (!result.synopsis) {
      const opfFile = files.find(f => /\.opf$/i.test(f));
      if (opfFile) {
        try {
          const opfXml = execSync(`unzip -p "${epubPath}" "${opfFile}"`, {
            encoding: 'utf8',
            maxBuffer: 5 * 1024 * 1024
          });
          const $ = cheerio.load(opfXml, { xml: true });
          const desc = $('dc\\:description, description').text().trim();
          if (desc) {
            result.synopsis = cheerio.load(desc).text().trim();
          }
        } catch (err) {
          console.warn('Error reading OPF from epub:', err.message);
        }
      }
    }
  } catch (err) {
    console.warn('Error reading epub archive:', err.message);
  }

  return result;
}

function cleanHtmlTags(str = '') {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function parsePublicationDate(rawDate) {
  if (!rawDate) return null;
  const str = String(rawDate).trim();
  // Match ISO YYYY-MM-DD
  const matchIso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchIso) {
    return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`;
  }
  // Match Italian DD/MM/YYYY
  const matchIt = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchIt) {
    const [, d, m, y] = matchIt;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

function parseCalibreTitleAndCollana(rawTitle = '', rawSeries = '') {
  let title = String(rawTitle).trim();
  let collanaHint = '';
  let detectedNumber = null;

  // Strip "(Italian Edition)" or "[Italian Edition]" or "(Edizione Italiana)"
  title = title
    .replace(/\s*[\(\[]\s*(?:italian\s+edition|edizione\s+italiana)\s*[\)\]]/gi, '')
    .trim();

  // Case 1: "Urania 1256 - Il pianeta Berserker" or "Urania 0571 -Fuga da Tschai"
  const prefixMatch = title.match(/^(Urania(?:\s+[a-zA-Z]+)?)\s+(\d+)\s*[-:]\s*(.+)$/i);
  if (prefixMatch) {
    collanaHint = prefixMatch[1].trim();
    detectedNumber = parseInt(prefixMatch[2], 10);
    title = prefixMatch[3].trim();
  }

  // Case 2: "Axis (Urania Jumbo)" or "Macchine IA e robot (Urania)"
  const suffixMatch = title.match(/^(.+?)\s*\((Urania[^\)]*)\)$/i);
  if (suffixMatch) {
    title = suffixMatch[1].trim();
    const parenContent = suffixMatch[2].trim();
    // Check if paren has number, e.g. "Urania Jumbo 78"
    const parenNumMatch = parenContent.match(/^(.+?)\s+(\d+)$/);
    if (parenNumMatch) {
      collanaHint = parenNumMatch[1].trim();
      detectedNumber = parseInt(parenNumMatch[2], 10);
    } else {
      collanaHint = parenContent;
    }
  }

  // Final cleanup on title
  title = title
    .replace(/\s*[\(\[]\s*(?:italian\s+edition|edizione\s+italiana)\s*[\)\]]/gi, '')
    .trim();

  // If series is given and collanaHint is still empty
  if (!collanaHint && rawSeries) {
    collanaHint = rawSeries.trim();
  }

  return {
    cleanTitle: title,
    collanaHint,
    detectedNumber
  };
}

async function matchCollana(collanaHint, uraniaDb) {
  if (!uraniaDb) return null;
  const allCollane = await new Promise((resolve) => {
    uraniaDb.all('SELECT c.id, c.nome, c.editore, e.nome AS editoreNome FROM collane c LEFT JOIN editori e ON e.id = c.editore', [], (err, rows) => {
      resolve(rows || []);
    });
  });

  if (!collanaHint) {
    return null;
  }

  const hintLower = collanaHint.toLowerCase().trim();

  // 1. Exact match
  let matched = allCollane.find(c => c.nome.toLowerCase() === hintLower);
  if (matched) return matched;

  // 2. Specific checks
  if (hintLower.includes('jumbo')) {
    matched = allCollane.find(c => c.nome.toLowerCase().includes('jumbo'));
    if (matched) return matched;
  }
  if (hintLower.includes('millemondi')) {
    matched = allCollane.find(c => c.nome.toLowerCase().includes('millemondi'));
    if (matched) return matched;
  }
  if (hintLower.includes('romanzi')) {
    matched = allCollane.find(c => c.nome.toLowerCase().includes('romanzi'));
    if (matched) return matched;
  }
  if (hintLower.includes('blu')) {
    matched = allCollane.find(c => c.nome.toLowerCase().includes('blu'));
    if (matched) return matched;
  }
  if (hintLower.includes('argento')) {
    matched = allCollane.find(c => c.nome.toLowerCase().includes('argento'));
    if (matched) return matched;
  }
  if (hintLower.includes('bis')) {
    matched = allCollane.find(c => c.nome.toLowerCase().includes('bis'));
    if (matched) return matched;
  }
  if (hintLower.includes('horror')) {
    matched = allCollane.find(c => c.nome.toLowerCase().includes('horror'));
    if (matched) return matched;
  }
  if (hintLower.includes('urania')) {
    matched = allCollane.find(c => c.nome.toLowerCase() === 'urania');
    if (matched) return matched;
  }

  // 3. Substring match
  matched = allCollane.find(c => c.nome.toLowerCase().includes(hintLower) || hintLower.includes(c.nome.toLowerCase()));
  return matched || null;
}

async function getNextNumberForCollana(collanaId, uraniaDb) {
  if (!uraniaDb || !collanaId) return 1;
  const row = await new Promise((resolve) => {
    uraniaDb.get('SELECT MAX(number) AS maxNumber FROM books WHERE collana = ?', [collanaId], (err, r) => {
      resolve(r);
    });
  });
  return (row && row.maxNumber) ? row.maxNumber + 1 : 1;
}

/**
 * Searches books in Calibre library metadata.db
 */
async function searchCalibreBooks(query = '', limit = 30, uraniaDb = null) {
  const config = loadCalibreConfig();
  if (!config.configured) {
    throw new Error('Calibre non configurato o libreria non trovata. Verifica calibre.conf.');
  }

  const calibreDbPath = path.join(config.calibreDir, 'metadata.db');
  const db = await openSqliteReadOnly(calibreDbPath);

  try {
    let sql = `
      SELECT b.id, b.title, b.path, b.has_cover, b.pubdate, b.series_index,
        (SELECT GROUP_CONCAT(a.name, ' & ') FROM authors a JOIN books_authors_link bal ON a.id = bal.author WHERE bal.book = b.id) AS author,
        (SELECT s.name FROM series s JOIN books_series_link bsl ON s.id = bsl.series WHERE bsl.book = b.id LIMIT 1) AS series,
        (SELECT p.name FROM publishers p JOIN books_publishers_link bpl ON p.id = bpl.publisher WHERE bpl.book = b.id LIMIT 1) AS publisher,
        (SELECT GROUP_CONCAT(d.format, ',') FROM data d WHERE d.book = b.id) AS formats
      FROM books b
    `;
    const params = [];

    if (query && query.trim()) {
      const q = query.trim();
      const numQuery = parseInt(q, 10);
      if (Number.isInteger(numQuery) && String(numQuery) === q) {
        // Query by ID directly
        sql += ` WHERE b.id = ? OR b.title LIKE ? OR author LIKE ?`;
        params.push(numQuery, `%${q}%`, `%${q}%`);
      } else {
        sql += ` WHERE b.title LIKE ? OR b.author_sort LIKE ? OR author LIKE ?`;
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }
    }

    sql += ` ORDER BY b.id DESC LIMIT ?`;
    params.push(limit);

    const rows = await runQuery(db, sql, params);

    // Cross reference with Urania DB to mark already imported books
    let existingBooks = [];
    if (uraniaDb) {
      existingBooks = await new Promise((resolve) => {
        uraniaDb.all('SELECT LOWER(title_ita) as title, LOWER(author) as author FROM books', [], (err, r) => {
          resolve(r || []);
        });
      });
    }

    const books = rows.map(r => {
      const formats = r.formats ? r.formats.split(',').map(f => f.trim().toUpperCase()) : [];
      const hasEpub = formats.includes('EPUB');
      const author = r.author || 'Sconosciuto';
      const { cleanTitle } = parseCalibreTitleAndCollana(r.title);
      const cleanLower = cleanTitle.toLowerCase();
      const rawLower = r.title.toLowerCase();
      const authorLower = author.toLowerCase();

      const isImported = existingBooks.some(eb => {
        const ebTitle = (eb.title || '').trim();
        const ebAuthor = (eb.author || '').trim();
        if (ebTitle === cleanLower || ebTitle === rawLower) {
          return true;
        }
        if (authorLower.includes(ebAuthor) || ebAuthor.includes(authorLower)) {
          if (rawLower.includes(ebTitle) || cleanLower.includes(ebTitle) || ebTitle.includes(cleanLower)) {
            return true;
          }
        }
        return false;
      });

      return {
        id: r.id,
        title: r.title,
        author,
        publisher: r.publisher || '',
        pubdate: parsePublicationDate(r.pubdate),
        series: r.series || null,
        seriesIndex: r.series_index || 1,
        hasCover: Boolean(r.has_cover),
        formats,
        hasEpub,
        alreadyImported: isImported
      };
    });

    return books;
  } finally {
    db.close();
  }
}

/**
 * Extracts and parses complete metadata for a Calibre book
 */
async function getCalibreBookDetails(bookIdOrUrl, uraniaDb = null, preferredCollanaId = null) {
  const config = loadCalibreConfig();
  if (!config.configured) {
    throw new Error('Calibre non configurato o libreria non trovata');
  }

  // Parse ID from URL or numeric string
  let bookId = bookIdOrUrl;
  if (typeof bookIdOrUrl === 'string') {
    const urlMatch = bookIdOrUrl.match(/\/book\/(\d+)/i) || bookIdOrUrl.match(/(\d+)/);
    if (urlMatch) {
      bookId = parseInt(urlMatch[1], 10);
    }
  }

  if (!Number.isInteger(bookId) || bookId <= 0) {
    throw new Error('ID o URL Calibre-Web non valido');
  }

  const calibreDbPath = path.join(config.calibreDir, 'metadata.db');
  const db = await openSqliteReadOnly(calibreDbPath);

  try {
    const bookRow = await getQuery(
      db,
      `SELECT b.*,
        (SELECT GROUP_CONCAT(a.name, ' & ') FROM authors a JOIN books_authors_link bal ON a.id = bal.author WHERE bal.book = b.id) AS author,
        (SELECT s.name FROM series s JOIN books_series_link bsl ON s.id = bsl.series WHERE bsl.book = b.id LIMIT 1) AS series,
        (SELECT p.name FROM publishers p JOIN books_publishers_link bpl ON p.id = bpl.publisher WHERE bpl.book = b.id LIMIT 1) AS publisher,
        (SELECT c.text FROM comments c WHERE c.book = b.id LIMIT 1) AS comment
      FROM books b
      WHERE b.id = ?`,
      [bookId]
    );

    if (!bookRow) {
      throw new Error(`Libro con ID ${bookId} non trovato nella libreria Calibre`);
    }

    const bookDir = path.join(config.calibreDir, bookRow.path);
    let coverImagePath = '';
    let coverImageBuffer = null;

    if (fs.existsSync(bookDir)) {
      const candidates = ['cover.jpg', 'cover.jpeg', 'cover.png'];
      for (const cand of candidates) {
        const p = path.join(bookDir, cand);
        if (fs.existsSync(p)) {
          coverImagePath = p;
          coverImageBuffer = fs.readFileSync(p);
          break;
        }
      }
    }

    // Look for EPUB file
    let epubInfo = { titleOrig: '', coverAuthor: '', synopsis: '', copyrightYear: '', index: [] };
    if (fs.existsSync(bookDir)) {
      const files = fs.readdirSync(bookDir);
      const epubFile = files.find(f => f.endsWith('.epub'));
      if (epubFile) {
        epubInfo = parseEpub(path.join(bookDir, epubFile));
      }
    }

    // Title and Collana extraction
    const { cleanTitle, collanaHint, detectedNumber } = parseCalibreTitleAndCollana(bookRow.title, bookRow.series);

    // Match Collana in Urania DB
    let matchedCollana = null;
    if (preferredCollanaId && uraniaDb) {
      matchedCollana = await new Promise((resolve) => {
        uraniaDb.get(
          'SELECT c.id, c.nome, c.editore, e.nome AS editoreNome FROM collane c LEFT JOIN editori e ON e.id = c.editore WHERE c.id = ?',
          [preferredCollanaId],
          (err, r) => resolve(r)
        );
      });
    }

    if (!matchedCollana && collanaHint && uraniaDb) {
      matchedCollana = await matchCollana(collanaHint, uraniaDb);
    }

    // Default to Urania (collana 8) if collanaHint mentioned Urania and not matched
    if (!matchedCollana && collanaHint.toLowerCase().includes('urania') && uraniaDb) {
      matchedCollana = await new Promise((resolve) => {
        uraniaDb.get(
          'SELECT c.id, c.nome, c.editore, e.nome AS editoreNome FROM collane c LEFT JOIN editori e ON e.id = c.editore WHERE LOWER(c.nome) = "urania"',
          [],
          (err, r) => resolve(r)
        );
      });
    }

    // Determine book number
    let finalNumber = detectedNumber;
    if (!finalNumber && bookRow.series_index && bookRow.series_index > 1) {
      finalNumber = Math.floor(bookRow.series_index);
    }
    if (!finalNumber && matchedCollana && uraniaDb) {
      finalNumber = await getNextNumberForCollana(matchedCollana.id, uraniaDb);
    }
    if (!finalNumber) {
      finalNumber = 1;
    }

    // Formatted Titles
    let titleIta = cleanTitle;
    let author = bookRow.author || 'Sconosciuto';
    let titleOrig = epubInfo.titleOrig || '';

    // If copyright year found, format original title: e.g. "THE TITLE (2014)"
    if (titleOrig && epubInfo.copyrightYear && !titleOrig.includes(epubInfo.copyrightYear)) {
      titleOrig = `${titleOrig} (${epubInfo.copyrightYear})`;
    }
    if (!titleOrig) {
      titleOrig = titleIta;
    }

    // For Mondadori / Urania collections, capitalize title and author according to collection style
    const isMondadoriOrUrania = matchedCollana && (
      matchedCollana.editore === 3 ||
      matchedCollana.nome.toLowerCase().includes('urania') ||
      matchedCollana.nome.toLowerCase().includes('millemondi')
    );

    if (isMondadoriOrUrania) {
      titleIta = titleIta.toUpperCase();
      titleOrig = titleOrig.toUpperCase();
      author = author.toUpperCase();
    }

    // Synopsis
    let synopsis = epubInfo.synopsis || cleanHtmlTags(bookRow.comment) || '';

    // Cover author
    const coverAuthor = epubInfo.coverAuthor || 'N/A';

    // Publication date
    const datePub = parsePublicationDate(bookRow.pubdate) || null;

    // Reading status from Calibre-Web app.db
    let isRead = 0;
    if (config.calibreWebDb && fs.existsSync(config.calibreWebDb)) {
      try {
        const appDb = await openSqliteReadOnly(config.calibreWebDb);
        const readRow = await getQuery(appDb, 'SELECT * FROM book_read_link WHERE book_id = ? LIMIT 1', [bookId]);
        if (readRow) {
          isRead = 1;
        }
        appDb.close();
      } catch {
        // Ignore read status error
      }
    }

    return {
      calibreId: bookId,
      rawTitle: bookRow.title,
      number: finalNumber,
      title_ita: titleIta,
      title_orig: titleOrig,
      author,
      date_pub: datePub,
      cover_author: coverAuthor,
      synopsis,
      collanaId: matchedCollana ? matchedCollana.id : null,
      collanaNome: matchedCollana ? matchedCollana.nome : (collanaHint || ''),
      editoreId: matchedCollana ? matchedCollana.editore : (bookRow.publisher ? 3 : null),
      editoreNome: matchedCollana ? matchedCollana.editoreNome : (bookRow.publisher || ''),
      hasCover: Boolean(coverImageBuffer && coverImageBuffer.length > 0),
      coverImageUrl: `/api/calibre/books/${bookId}/cover`,
      digital: 1,
      owned: 1,
      read: isRead,
      reprint: 0,
      stars: 0,
      comment: '',
      index: epubInfo.index || []
    };
  } finally {
    db.close();
  }
}

/**
 * Gets cover image buffer for a Calibre book
 */
async function getCalibreBookCoverBuffer(bookId) {
  const config = loadCalibreConfig();
  if (!config.configured) return null;

  const calibreDbPath = path.join(config.calibreDir, 'metadata.db');
  const db = await openSqliteReadOnly(calibreDbPath);

  try {
    const row = await getQuery(db, 'SELECT path FROM books WHERE id = ?', [bookId]);
    if (!row || !row.path) return null;

    const bookDir = path.join(config.calibreDir, row.path);
    const candidates = ['cover.jpg', 'cover.jpeg', 'cover.png'];
    for (const cand of candidates) {
      const p = path.join(bookDir, cand);
      if (fs.existsSync(p)) {
        return fs.readFileSync(p);
      }
    }

    return null;
  } finally {
    db.close();
  }
}

module.exports = {
  loadCalibreConfig,
  searchCalibreBooks,
  getCalibreBookDetails,
  getCalibreBookCoverBuffer,
  parsePublicationDate,
  parseCalibreTitleAndCollana,
  matchCollana,
  getNextNumberForCollana
};
