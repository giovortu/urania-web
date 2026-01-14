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
  
  console.log('Connesso al database: ' + dbPath);
  
  db.all("PRAGMA table_info(books)", (err, rows) => {
    if (err) {
      console.error('Errore schema:', err);
      process.exit(1);
    }
    
    console.log('\n=== Colonne della tabella books ===');
    rows.forEach(col => {
      console.log(`${col.name} (${col.type})`);
    });
    
    const hasHashColumns = rows.some(col => col.name === 'cover_hash' || col.name === 'synopsis_hash');
    console.log(`\nColonne hash presenti: ${hasHashColumns ? 'SÌ ✅' : 'NO ❌'}`);
    
    db.close();
  });
});
