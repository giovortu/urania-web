# Database Migration to Normalized Schema

This directory contains the migration script to normalize the database structure for publishers (editori) and series (collane).

## Overview

The original database stored publisher and series information as text fields directly in the `books` table, causing data redundancy. This migration creates separate normalized tables for publishers and series, establishing proper foreign key relationships.

## Migration Script

### migrate_to_normalized_schema.js

Transforms the database from denormalized structure to normalized structure with proper relationships.

#### What it does:

1. **Creates new tables:**
   - `editori` - Publishers table with unique names
   - `collane` - Series table linked to publishers via foreign key

2. **Migrates data:**
   - Extracts unique publishers from `books.editore` field
   - Extracts unique series from `books.collana` field
   - Establishes relationships between series and publishers

3. **Updates books table:**
   - Adds `editore_id` and `collana_id` foreign key columns
   - Populates foreign keys based on text field matches
   - Creates indexes for optimized queries

4. **Maintains compatibility:**
   - Original `editore` and `collana` text fields are kept
   - Allows gradual transition and testing
   - Can be removed after verification

#### Usage:

```bash
# Make sure you're in the project root directory
cd /path/to/urania-web

# Run the migration
node tools/migrate_to_normalized_schema.js
```

#### Output:

The script provides detailed logging:
- Step-by-step progress
- Count of records migrated
- Sample data comparison (old vs new)
- Verification statistics

#### Safety:

- The script only adds new tables and columns
- Original data remains intact
- Can be run multiple times safely (uses OR IGNORE for inserts)
- Database backup recommended before running

## Benefits of Normalization

### Performance Improvements:
- Faster filtering by publisher/series (indexed foreign keys vs string comparison)
- Reduced query complexity with proper JOINs
- Better query optimization by SQLite

### Data Integrity:
- Consistent publisher/series naming
- Easier to rename or merge publishers/series
- Referential integrity via foreign keys

### Storage Efficiency:
- Reduced data redundancy
- Smaller database size (integers vs repeated strings)

## API Changes

The API endpoints have been updated to support both old (string) and new (ID) formats for backward compatibility:

### New Endpoints:
- `GET /api/editori` - List all publishers
- `GET /api/books/editore/:editore` - Filter books by publisher (name or ID)

### Modified Endpoints:
- `GET /api/collane` - Now returns objects with ID and relationships
- `GET /api/books/collana/:collana` - Supports both name and ID
- `GET /api/books` - Supports filtering by `editore` parameter
- `PUT /api/books/:id` - Accepts `editore_id` and `collana_id`

### Response Format:
Book objects now include both text and ID fields:
```json
{
  "id": 123,
  "editore": "Mondadori",
  "editore_id": 1,
  "collana": "Urania",
  "collana_id": 5,
  ...
}
```

## Testing

After migration, verify:

1. **Data integrity:**
   ```sql
   SELECT COUNT(*) FROM books WHERE editore IS NOT NULL AND editore_id IS NULL;
   -- Should return 0
   ```

2. **Frontend functionality:**
   - Test filtering by publisher
   - Test filtering by series
   - Test book editing (dropdown selections)

3. **API responses:**
   - Verify all endpoints return correct data
   - Check that both old and new field formats work

## Rollback (if needed)

If issues occur, the original fields are still present:

```sql
-- Remove foreign key columns
ALTER TABLE books DROP COLUMN editore_id;
ALTER TABLE books DROP COLUMN collana_id;

-- Drop new tables
DROP TABLE collane;
DROP TABLE editori;
```

## Future Cleanup

After thorough testing and verification (recommended: 1-2 weeks in production), you can remove the deprecated fields:

```sql
-- Remove old text columns
ALTER TABLE books DROP COLUMN editore;
ALTER TABLE books DROP COLUMN collana;
```

**Note:** SQLite requires rebuilding the table to drop columns. Consider using a migration tool or manual table recreation:

```sql
-- Create new table without old columns
CREATE TABLE books_new AS 
SELECT id, number, title_ita, title_orig, author, 
       editore_id, collana_id, /* ... other fields ... */
FROM books;

-- Swap tables
DROP TABLE books;
ALTER TABLE books_new RENAME TO books;
```
