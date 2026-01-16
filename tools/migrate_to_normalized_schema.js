/**
 * Database Migration Script: Normalize Publisher and Series Tables
 * 
 * This script migrates the database from denormalized structure (editore and collana as text fields)
 * to normalized structure with separate tables:
 * - editori (publishers)
 * - collane (series, linked to publishers via editore_id)
 * 
 * Usage: node migrate_to_normalized_schema.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Read database path from config
const configPath = path.join(__dirname, '..', 'dbpath.conf');
const dbPathRaw = fs.readFileSync(configPath, 'utf8').trim();
const dbPath = path.isAbsolute(dbPathRaw) ? dbPathRaw : path.join(__dirname, '..', dbPathRaw);

console.log('='.repeat(60));
console.log('Database Normalization Migration');
console.log('='.repeat(60));
console.log(`Database path: ${dbPath}`);
console.log('');

// Open database
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✓ Connected to database');
});

// Execute migration
db.serialize(() => {
  console.log('\n--- Step 1: Creating new tables ---');
  
  // Create editori table
  db.run(`
    CREATE TABLE IF NOT EXISTS editori (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating editori table:', err.message);
      process.exit(1);
    }
    console.log('✓ Created table: editori');
  });
  
  // Create collane table
  db.run(`
    CREATE TABLE IF NOT EXISTS collane (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      editore_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (editore_id) REFERENCES editori(id),
      UNIQUE(nome, editore_id)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating collane table:', err.message);
      process.exit(1);
    }
    console.log('✓ Created table: collane');
  });
  
  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_collane_editore_id ON collane(editore_id)`, (err) => {
    if (err) {
      console.error('❌ Error creating index on collane:', err.message);
    } else {
      console.log('✓ Created index: idx_collane_editore_id');
    }
  });
  
  console.log('\n--- Step 2: Populating editori table ---');
  
  // Populate editori from existing data
  db.run(`
    INSERT OR IGNORE INTO editori (nome)
    SELECT DISTINCT editore 
    FROM books 
    WHERE editore IS NOT NULL 
      AND editore != '' 
    ORDER BY editore
  `, function(err) {
    if (err) {
      console.error('❌ Error populating editori:', err.message);
      process.exit(1);
    }
    console.log(`✓ Inserted ${this.changes} publishers into editori table`);
  });
  
  console.log('\n--- Step 3: Populating collane table ---');
  
  // Populate collane from existing data (with editore reference)
  db.run(`
    INSERT OR IGNORE INTO collane (nome, editore_id)
    SELECT DISTINCT b.collana, e.id
    FROM books b
    JOIN editori e ON e.nome = b.editore
    WHERE b.collana IS NOT NULL 
      AND b.collana != ''
      AND b.editore IS NOT NULL
      AND b.editore != ''
    ORDER BY e.id, b.collana
  `, function(err) {
    if (err) {
      console.error('❌ Error populating collane:', err.message);
      process.exit(1);
    }
    console.log(`✓ Inserted ${this.changes} series into collane table`);
  });
  
  console.log('\n--- Step 4: Adding foreign key columns to books table ---');
  
  // Add new columns to books table
  db.run(`ALTER TABLE books ADD COLUMN editore_id INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('❌ Error adding editore_id column:', err.message);
    } else {
      console.log('✓ Added column: books.editore_id');
    }
  });
  
  db.run(`ALTER TABLE books ADD COLUMN collana_id INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('❌ Error adding collana_id column:', err.message);
    } else {
      console.log('✓ Added column: books.collana_id');
    }
  });
  
  console.log('\n--- Step 5: Updating books with foreign key references ---');
  
  // Update editore_id references
  db.run(`
    UPDATE books
    SET editore_id = (
      SELECT e.id 
      FROM editori e 
      WHERE e.nome = books.editore
    )
    WHERE editore IS NOT NULL AND editore != ''
  `, function(err) {
    if (err) {
      console.error('❌ Error updating editore_id references:', err.message);
      process.exit(1);
    }
    console.log(`✓ Updated ${this.changes} books with editore_id references`);
  });
  
  // Update collana_id references
  db.run(`
    UPDATE books
    SET collana_id = (
      SELECT c.id 
      FROM collane c
      JOIN editori e ON e.id = c.editore_id
      WHERE c.nome = books.collana 
        AND e.nome = books.editore
    )
    WHERE collana IS NOT NULL 
      AND collana != ''
      AND editore IS NOT NULL
      AND editore != ''
  `, function(err) {
    if (err) {
      console.error('❌ Error updating collana_id references:', err.message);
      process.exit(1);
    }
    console.log(`✓ Updated ${this.changes} books with collana_id references`);
  });
  
  console.log('\n--- Step 6: Creating indexes on books table ---');
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_books_editore_id ON books(editore_id)`, (err) => {
    if (err) {
      console.error('❌ Error creating index:', err.message);
    } else {
      console.log('✓ Created index: idx_books_editore_id');
    }
  });
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_books_collana_id ON books(collana_id)`, (err) => {
    if (err) {
      console.error('❌ Error creating index:', err.message);
    } else {
      console.log('✓ Created index: idx_books_collana_id');
    }
  });
  
  console.log('\n--- Step 7: Verification ---');
  
  // Verify data integrity
  db.get(`SELECT COUNT(*) as count FROM editori`, (err, row) => {
    if (err) {
      console.error('❌ Error verifying editori:', err.message);
    } else {
      console.log(`✓ Total publishers in editori table: ${row.count}`);
    }
  });
  
  db.get(`SELECT COUNT(*) as count FROM collane`, (err, row) => {
    if (err) {
      console.error('❌ Error verifying collane:', err.message);
    } else {
      console.log(`✓ Total series in collane table: ${row.count}`);
    }
  });
  
  db.get(`SELECT COUNT(*) as count FROM books WHERE editore_id IS NOT NULL`, (err, row) => {
    if (err) {
      console.error('❌ Error verifying books editore_id:', err.message);
    } else {
      console.log(`✓ Books with editore_id set: ${row.count}`);
    }
  });
  
  db.get(`SELECT COUNT(*) as count FROM books WHERE collana_id IS NOT NULL`, (err, row) => {
    if (err) {
      console.error('❌ Error verifying books collana_id:', err.message);
    } else {
      console.log(`✓ Books with collana_id set: ${row.count}`);
    }
  });
  
  // Display sample data
  console.log('\n--- Sample Data ---');
  db.all(`
    SELECT 
      b.id,
      b.title_ita,
      b.editore as old_editore,
      e.nome as new_editore,
      b.collana as old_collana,
      c.nome as new_collana
    FROM books b
    LEFT JOIN editori e ON e.id = b.editore_id
    LEFT JOIN collane c ON c.id = b.collana_id
    LIMIT 5
  `, (err, rows) => {
    if (err) {
      console.error('❌ Error fetching sample data:', err.message);
    } else {
      console.log('\nSample books (showing old vs new data):');
      console.table(rows);
    }
    
    console.log('\n='.repeat(60));
    console.log('Migration completed successfully! ✓');
    console.log('='.repeat(60));
    console.log('\nNOTE: The old columns (editore, collana) are still present');
    console.log('for backward compatibility. After testing, you can remove them');
    console.log('by uncommenting the DROP COLUMN statements in this script.');
    console.log('\nTo remove old columns, run:');
    console.log('  sqlite3 <db_path>');
    console.log('  ALTER TABLE books DROP COLUMN editore;');
    console.log('  ALTER TABLE books DROP COLUMN collana;');
    console.log('');
    
    // Close database
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err.message);
      }
    });
  });
});
