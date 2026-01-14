const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'dbpath.conf');
const dbPath = fs.readFileSync(configPath, 'utf8').trim();

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Errore connessione:', err);
    process.exit(1);
  }
  
  console.log('Verifico gli hash nel database...\n');
  
  // Conta libri con cover_hash
  db.get("SELECT COUNT(*) as count FROM books WHERE cover_hash IS NOT NULL", (err, result) => {
    console.log(`✅ Libri con cover_hash: ${result.count}`);
    
    db.get("SELECT COUNT(*) as count FROM books WHERE synopsis_hash IS NOT NULL", (err, result) => {
      console.log(`✅ Libri con synopsis_hash: ${result.count}`);
      
      // Conta libri totali
      db.get("SELECT COUNT(*) as count FROM books", (err, result) => {
        const total = result.count;
        console.log(`\n📊 Totale libri: ${total}`);
        
        // Mostra sample di hash
        db.get("SELECT id, title_ita, cover_hash FROM books WHERE cover_hash IS NOT NULL LIMIT 1", (err, row) => {
          if (row) {
            console.log(`\n🔹 Esempio hash:\n   Book ID: ${row.id}\n   Title: ${row.title_ita}\n   cover_hash: ${row.cover_hash}`);
          }
          
          db.close();
        });
      });
    });
  });
});
