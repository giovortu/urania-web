const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Read database path from config
const configPath = path.join(__dirname, '..', 'dbpath.conf');
const dbPathRaw = fs.readFileSync(configPath, 'utf8').trim();
const dbPath = path.isAbsolute(dbPathRaw) ? dbPathRaw : path.join(__dirname, '..', dbPathRaw);

console.log('📚 Aggiornamento hash immagini nel database');
console.log(`Database: ${dbPath}\n`);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('❌ Errore connessione database:', err);
    process.exit(1);
  }
  
  console.log('✅ Connesso al database\n');
  processBooks();
});

function calculateHash(buffer) {
  if (!buffer || buffer.length === 0) return null;
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function processBooks() {
  // Get all books with images
  const query = `SELECT id, title_ita, cover_image, synopsis_image, cover_hash, synopsis_hash FROM books`;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('❌ Errore lettura libri:', err);
      db.close();
      return;
    }
    
    console.log(`📊 Trovati ${rows.length} libri nel database\n`);
    
    let updatedCover = 0;
    let updatedSynopsis = 0;
    let skippedCover = 0;
    let skippedSynopsis = 0;
    let processed = 0;
    
    // Prepare update statement
    const updateStmt = db.prepare(`UPDATE books SET cover_hash = ?, synopsis_hash = ? WHERE id = ?`);
    
    rows.forEach((book, index) => {
      let coverHash = book.cover_hash;
      let synopsisHash = book.synopsis_hash;
      let needsUpdate = false;
      
      // Process cover image
      if (book.cover_image && book.cover_image.length > 0) {
        const newHash = calculateHash(book.cover_image);
        if (newHash && newHash !== book.cover_hash) {
          coverHash = newHash;
          updatedCover++;
          needsUpdate = true;
          console.log(`🔄 [${index + 1}/${rows.length}] Aggiornato cover_hash per: ${book.title_ita || book.id}`);
        } else if (book.cover_hash) {
          skippedCover++;
        }
      }
      
      // Process synopsis image
      if (book.synopsis_image && book.synopsis_image.length > 0) {
        const newHash = calculateHash(book.synopsis_image);
        if (newHash && newHash !== book.synopsis_hash) {
          synopsisHash = newHash;
          updatedSynopsis++;
          needsUpdate = true;
          console.log(`🔄 [${index + 1}/${rows.length}] Aggiornato synopsis_hash per: ${book.title_ita || book.id}`);
        } else if (book.synopsis_hash) {
          skippedSynopsis++;
        }
      }
      
      // Update database if needed
      if (needsUpdate) {
        updateStmt.run(coverHash, synopsisHash, book.id, (err) => {
          if (err) {
            console.error(`❌ Errore aggiornamento libro ${book.id}:`, err);
          }
        });
      }
      
      processed++;
      
      // Final report
      if (processed === rows.length) {
        updateStmt.finalize(() => {
          console.log('\n' + '='.repeat(60));
          console.log('✅ Aggiornamento completato!\n');
          console.log('📊 Riepilogo:');
          console.log(`   • Cover hash aggiornati: ${updatedCover}`);
          console.log(`   • Cover hash già corretti: ${skippedCover}`);
          console.log(`   • Synopsis hash aggiornati: ${updatedSynopsis}`);
          console.log(`   • Synopsis hash già corretti: ${skippedSynopsis}`);
          console.log(`   • Totale libri processati: ${rows.length}`);
          console.log('='.repeat(60));
          
          db.close();
        });
      }
    });
    
    if (rows.length === 0) {
      console.log('⚠️  Nessun libro trovato nel database');
      db.close();
    }
  });
}
