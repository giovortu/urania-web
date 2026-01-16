const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('📚 Script di merge database - Recupero libri danneggiati\n');
console.log('Questo script recupera i dati dei libri che sono stati');
console.log('danneggiati (campi azzerati) nel database di destinazione,');
console.log('ripristinandoli dal database di backup.\n');

// Chiedi i percorsi dei database
rl.question('📁 Percorso database SOURCE (backup con dati completi): ', (sourcePath) => {
  if (!fs.existsSync(sourcePath)) {
    console.error('❌ File database source non trovato:', sourcePath);
    rl.close();
    process.exit(1);
  }

  rl.question('📁 Percorso database TARGET (da ripristinare): ', (targetPath) => {
    if (!fs.existsSync(targetPath)) {
      console.error('❌ File database target non trovato:', targetPath);
      rl.close();
      process.exit(1);
    }

    rl.question('⚠️  Vuoi procedere? Questo modificherà il database target. (yes/no): ', (answer) => {
      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Operazione annullata');
        rl.close();
        process.exit(0);
      }

      rl.close();
      processMerge(sourcePath, targetPath);
    });
  });
});

function processMerge(sourcePath, targetPath) {
  console.log('\n🔄 Apertura database...\n');

  const sourceDb = new sqlite3.Database(sourcePath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('❌ Errore apertura database source:', err);
      process.exit(1);
    }
    console.log('✅ Database source aperto (sola lettura)');
  });

  const targetDb = new sqlite3.Database(targetPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      console.error('❌ Errore apertura database target:', err);
      process.exit(1);
    }
    console.log('✅ Database target aperto (lettura/scrittura)\n');
  });

  // Trova libri danneggiati nel target
  console.log('🔍 Ricerca libri danneggiati nel database target...\n');

  const query = `
    SELECT id, number, title_ita, title_orig, author, editore, collana, date_pub, owned, read, digital, stars
    FROM books
    WHERE (title_ita IS NULL OR title_ita = '')
      AND (title_orig IS NULL OR title_orig = '')
  `;

  targetDb.all(query, [], (err, damagedBooks) => {
    if (err) {
      console.error('❌ Errore lettura libri danneggiati:', err);
      closeAndExit(sourceDb, targetDb);
      return;
    }

    if (damagedBooks.length === 0) {
      console.log('✅ Nessun libro danneggiato trovato nel database target!');
      closeAndExit(sourceDb, targetDb);
      return;
    }

    console.log(`⚠️  Trovati ${damagedBooks.length} libri danneggiati:\n`);
    
    damagedBooks.forEach((book, idx) => {
      console.log(`   ${idx + 1}. ID: ${book.id}, Numero: ${book.number || 'N/A'}`);      console.log(`      Title ITA: "${book.title_ita || 'VUOTO'}"`);
      console.log(`      Title ORIG: "${book.title_orig || 'VUOTO'}"`);
      console.log(`      Author: "${book.author || 'VUOTO'}"`);
      console.log(`      Owned: ${book.owned ? '✓' : '✗'}, Read: ${book.read ? '✓' : '✗'}, Stars: ${book.stars || 0}\n`);
    });

    console.log('🔄 Inizio recupero dati dal database source...\n');

    let recovered = 0;
    let notFound = 0;
    let processed = 0;

    const updateStmt = targetDb.prepare(`
      UPDATE books SET
        title_ita = ?,
        title_orig = ?,
        author = ?,
        date_pub = ?,
        cover_author = ?,
        editore = ?,
        collana = ?,
        synopsis = ?,
        comment = ?,
        owned = ?,
        read = ?,
        digital = ?,
        reprint = ?,
        stars = ?
      WHERE id = ?
    `);

    damagedBooks.forEach((damaged) => {
      // Cerca il libro corrispondente nel source
      sourceDb.get('SELECT * FROM books WHERE id = ?', [damaged.id], (err, sourceBook) => {
        processed++;

        if (err) {
          console.error(`❌ Errore lettura libro ${damaged.id} dal source:`, err);
        } else if (!sourceBook) {
          console.log(`⚠️  Libro ID ${damaged.id} non trovato nel database source`);
          notFound++;
        } else {
          // Verifica che il libro source abbia dati validi
          if (!sourceBook.title_ita && !sourceBook.title_orig) {
            console.log(`⚠️  Libro ID ${damaged.id} anche nel source ha dati mancanti, skip`);
            notFound++;
          } else {
            // Ripristina i dati
            updateStmt.run(
              sourceBook.title_ita,
              sourceBook.title_orig,
              sourceBook.author,
              sourceBook.date_pub,
              sourceBook.cover_author,
              sourceBook.editore,
              sourceBook.collana,
              sourceBook.synopsis,
              sourceBook.comment,
              sourceBook.owned,
              sourceBook.read,
              sourceBook.digital,
              sourceBook.reprint,
              sourceBook.stars,
              damaged.id,
              (err) => {
                if (err) {
                  console.error(`❌ Errore aggiornamento libro ${damaged.id}:`, err);
                } else {
                  console.log(`✅ Recuperato: ID ${damaged.id} - "${sourceBook.title_ita || sourceBook.title_orig}"`);
                  recovered++;
                }
              }
            );
          }
        }

        // Se abbiamo processato tutti i libri
        if (processed === damagedBooks.length) {
          updateStmt.finalize(() => {
            console.log('\n' + '='.repeat(60));
            console.log('✅ Merge completato!\n');
            console.log('📊 Riepilogo:');
            console.log(`   • Libri danneggiati trovati: ${damagedBooks.length}`);
            console.log(`   • Libri recuperati con successo: ${recovered}`);
            console.log(`   • Libri non trovati nel source: ${notFound}`);
            console.log('='.repeat(60));

            closeAndExit(sourceDb, targetDb);
          });
        }
      });
    });
  });
}

function closeAndExit(sourceDb, targetDb) {
  sourceDb.close((err) => {
    if (err) console.error('Errore chiusura source db:', err);
  });
  targetDb.close((err) => {
    if (err) console.error('Errore chiusura target db:', err);
  });
  process.exit(0);
}
