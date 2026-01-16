# API Documentation - Book Manager

Documentazione completa delle API REST implementate nel server.

## Base URL
```
http://localhost:3000
```

---

## Libri (Books)

### GET /api/books
Recupera lista paginata di libri con filtri opzionali.

**Query Parameters:**
- `page` (number, default: 1) - Numero di pagina
- `limit` (number, default: 12) - Numero di libri per pagina
- `search` (string) - Ricerca nel titolo italiano/originale
- `collana` (string|number) - Filtra per collana (nome o ID)
- `editore` (string|number) - Filtra per editore (nome o ID)
- `owned` (boolean) - Filtra solo libri posseduti (`true`)
- `notOwned` (boolean) - Filtra solo libri non posseduti (`true`)
- `read` (boolean) - Filtra solo libri letti (`true`)
- `notRead` (boolean) - Filtra solo libri non letti (`true`)
- `digital` (boolean) - Filtra solo libri digitali (`true`)

**Response:**
```json
{
  "books": [
    {
      "id": 1,
      "number": 123,
      "title_ita": "Titolo italiano",
      "title_orig": "Original Title",
      "author": "Nome Autore",
      "date_pub": "1980-01-01",
      "editore": "Mondadori",
      "editore_id": 1,
      "collana": "Fantascienza",
      "collana_id": 5,
      "cover_author": "Karel Thole",
      "owned": 1,
      "read": 1,
      "digital": 0,
      "reprint": 0,
      "stars": 4,
      "comment": "Commento personale",
      "synopsis": "Trama del libro",
      "cover_hash": "abc123...",
      "synopsis_hash": "def456..."
    }
  ],
  "total": 500,
  "page": 1,
  "limit": 12,
  "pages": 42
}
```

---

### GET /api/books/:id
Recupera dettagli di un singolo libro.

**URL Parameters:**
- `id` (number) - ID del libro

**Query Parameters:**
- `collana`, `owned`, `notOwned`, `read`, `notRead`, `digital`, `search` - Filtri per pre-caching immagini adiacenti

**Response:**
```json
{
  "id": 1,
  "number": 123,
  "title_ita": "Titolo italiano",
  "title_orig": "Original Title",
  "author": "Nome Autore",
  "date_pub": "1980-01-01",
  "editore": "Mondadori",
  "editore_id": 1,
  "collana": "Urania",
  "collana_id": 5,
  "cover_author": "Karel Thole",
  "owned": 1,
  "read": 1,
  "digital": 0,
  "reprint": 0,
  "stars": 4,
  "comment": "Commento personale",
  "synopsis": "Trama del libro",
  "cover_hash": "abc123...",
  "synopsis_hash": "def456..."
}
```

---

### PUT /api/books/:id
Aggiorna uno o più campi di un libro (partial update).

**URL Parameters:**
- `id` (number) - ID del libro

**Request Body:**
```json
{
  "title_ita": "Nuovo titolo",
  "owned": true,
  "read": false,
  "stars": 5,
  "comment": "Ottimo libro!",
  "editore_id": 1,
  "collana_id": 5
}
```

**Campi aggiornabili:**
- `title_ita`, `title_orig` (string)
- `author`, `date_pub`, `cover_author`, `synopsis` (string)
- `collana_id` (number|null) - ID della collana (sostituisce `collana`)
- `editore_id` (number|null) - ID dell'editore (sostituisce `editore`)
- `owned`, `read`, `digital`, `reprint` (boolean)
- `stars` (number, 0-50, rappresenta valutazione da 0 a 5 con mezzo punto)
- `comment` (string)

**Note:**
- I campi `editore` e `collana` (stringhe) sono deprecati ma ancora supportati per retrocompatibilità
- È preferibile usare `editore_id` e `collana_id` (numeri) che fanno riferimento alle nuove tabelle normalizzate

**Response:**
```json
{
  "id": 1,
  "message": "Book updated successfully"
}
```

---

### GET /api/books/:id/prev
Recupera il libro precedente (per numero) nella lista filtrata.

**URL Parameters:**
- `id` (number) - ID del libro corrente

**Query Parameters:**
- `collana`, `owned`, `notOwned`, `read`, `notRead`, `digital` - Filtri applicati

**Response:**
```json
{
  "id": 456,
  "number": 122,
  "title_ita": "Libro precedente",
  ...
}
```

**Errors:**
- 404 - Nessun libro precedente trovato

---

### GET /api/books/:id/next
Recupera il libro successivo (per numero) nella lista filtrata.

**URL Parameters:**
- `id` (number) - ID del libro corrente

**Query Parameters:**
- `collana`, `owned`, `notOwned`, `read`, `notRead`, `digital` - Filtri applicati

**Response:**
```json
{
  "id": 789,
  "number": 124,
  "title_ita": "Libro successivo",
  ...
}
```

**Errors:**
- 404 - Nessun libro successivo trovato

---

### GET /api/books/:id/position
Calcola la posizione del libro nella lista filtrata (per navigazione corretta).

**URL Parameters:**
- `id` (number) - ID del libro

**Query Parameters:**
- `collana`, `owned`, `notOwned`, `read`, `notRead`, `digital`, `search` - Filtri applicati

**Response:**
```json
{
  "position": 42,
  "total": 500
}
```

---

### GET /api/books/:id/cover
Recupera l'immagine di copertina del libro (cache-aware con hash validation).

**URL Parameters:**
- `id` (number) - ID del libro

**Response:**
- Content-Type: `image/jpeg`
- Cache-Control: `public, max-age=31536000` (se hash presente)
- Body: Immagine JPEG

**Errors:**
- 404 - Copertina non disponibile

---

### GET /api/books/:id/synopsis-image
Recupera l'immagine della sinossi/retro del libro (cache-aware con hash validation).

**URL Parameters:**
- `id` (number) - ID del libro

**Response:**
- Content-Type: `image/jpeg`
- Cache-Control: `public, max-age=31536000` (se hash presente)
- Body: Immagine JPEG

**Errors:**
- 404 - Immagine sinossi non disponibile

---

## Editori

### GET /api/editori
Recupera lista di tutti gli editori presenti nel database.

**Response:**
```json
[
  { "id": 1, "nome": "Mondadori" },
  { "id": 2, "nome": "Editrice Nord" },
  { "id": 3, "nome": "Fanucci" }
]
```

---

### GET /api/books/editore/:editore
Recupera tutti i libri di uno specifico editore.

**URL Parameters:**
- `editore` (string|number) - Nome o ID dell'editore

**Response:**
```json
[
  {
    "id": 1,
    "number": 123,
    "title_ita": "Titolo",
    "editore": "Mondadori",
    "editore_id": 1,
    "collana": "Urania",
    "collana_id": 5,
    ...
  }
]
```

---

## Collane

### GET /api/collane
Recupera lista di tutte le collane presenti nel database.

**Query Parameters:**
- `editore_id` (number, optional) - Filtra collane per editore

**Response:**
```json
[
  { 
    "id": 5, 
    "nome": "Fantascienza", 
    "editore_id": 1,
    "editore_nome": "Mondadori"
  },
  { 
    "id": 12, 
    "nome": "Millemondi", 
    "editore_id": 1,
    "editore_nome": "Mondadori"
  },
  { 
    "id": 23, 
    "nome": "Cosmo", 
    "editore_id": 2,
    "editore_nome": "Editrice Nord"
  }
]
```

---

### GET /api/books/collana/:collana
Recupera tutti i libri di una specifica collana.

**URL Parameters:**
- `collana` (string|number) - Nome o ID della collana

**Response:**
```json
[
  {
    "id": 1,
    "number": 123,
    "title_ita": "Titolo",
    "editore": "Mondadori",
    "editore_id": 1,
    "collana": "Urania",
    "collana_id": 5,
    ...
  }
]
```

---

## Indici/Commenti

### GET /api/indexes/:bookId
Recupera indici/commenti associati a un libro.

**URL Parameters:**
- `bookId` (number) - ID del libro

**Response:**
```json
[
  {
    "id": 1,
    "book_id": 123,
    "content": "Contenuto indice/commento"
  }
]
```

---

## Cache Management

### GET /api/cache-status
Restituisce statistiche sulla cache delle immagini.

**Response:**
```json
{
  "cache": {
    "covers": {
      "files": 450,
      "sizeBytes": 125829120,
      "sizeMB": "120.00"
    },
    "synopsis": {
      "files": 380,
      "sizeBytes": 89456128,
      "sizeMB": "85.30"
    },
    "total": {
      "files": 830,
      "sizeBytes": 215285248,
      "sizeMB": "205.30"
    }
  }
}
```

---

### DELETE /api/cache/:bookId
Cancella la cache delle immagini per un libro specifico.

**URL Parameters:**
- `bookId` (number) - ID del libro

**Response:**
```json
{
  "message": "Cache cleared for book 123"
}
```

---

### DELETE /api/cache
Cancella tutta la cache delle immagini (copertine e sinossi).

**Response:**
```json
{
  "message": "All cache cleared"
}
```

---

### POST /api/cache/warm/:bookId
Pre-carica in cache le immagini dei libri adiacenti.

**URL Parameters:**
- `bookId` (number) - ID del libro centrale

**Request Body:**
```json
{
  "collana": "Urania",
  "owned": "true",
  "read": "true"
}
```

**Response:**
```json
{
  "message": "Cache warm-up started for book 123"
}
```

---

### POST /api/hash/populate
Popola gli hash MD5 per tutte le immagini nel database (operazione di manutenzione).

**Response:**
```json
{
  "message": "Hash population started in background"
}
```

**Note:** L'operazione viene eseguita in background e può richiedere diversi minuti.

---

## Diagnostica

### GET /api/diagnostic
Fornisce informazioni diagnostiche sul database e le immagini.

**Response:**
```json
{
  "database": "ok",
  "totalBooks": 1500,
  "booksWithCoverImage": 1450,
  "booksWithSynopsisImage": 1380,
  "sampleBook": {
    "id": 1,
    "title_ita": "Esempio",
    "hasCover": true,
    "hasSynopsis": true
  }
}
```

---

## Note Tecniche

### Sistema di Cache
- Le immagini vengono salvate su filesystem nella cartella `cache/`
- Ogni immagine ha un file `.hash` associato con MD5 per validazione ultra-veloce
- La cache viene invalidata automaticamente quando un libro viene modificato
- Pre-caching intelligente: carica in anticipo 3 libri prima e 3 dopo nella lista filtrata

### Filtri Mutualmente Esclusivi
- `owned` e `notOwned` sono mutualmente esclusivi
- `read` e `notRead` sono mutualmente esclusivi
- Se entrambi sono specificati, il comportamento è indefinito (evitare)

### Normalizzazione Caratteri
La ricerca normalizza automaticamente i caratteri accentati:
- à, á → a'
- è, é → e'
- ì, í → i'
- ò, ó → o'
- ù, ú → u'

### Headers Cache-Control
- **GET /api/books**: `Cache-Control: no-store` (sempre fresco)
- **Immagini con hash**: `Cache-Control: public, max-age=31536000` (1 anno)
- **Immagini senza hash**: `Cache-Control: public, max-age=86400` (1 giorno)

---

## Struttura Database Normalizzata

A partire dalla versione con normalizzazione del database, la struttura è stata ottimizzata per ridurre la ridondanza e migliorare le performance.

### Tabelle Principali

#### books
Tabella principale dei libri. Include foreign key verso `editori` e `collane`.

Campi aggiunti:
- `editore_id` (INTEGER) - Foreign key verso tabella `editori`
- `collana_id` (INTEGER) - Foreign key verso tabella `collane`

Campi deprecati (mantenuti per compatibilità):
- `editore` (TEXT) - Stringa con nome editore
- `collana` (TEXT) - Stringa con nome collana

#### editori
Tabella degli editori (publishers).

Struttura:
```sql
CREATE TABLE editori (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

#### collane
Tabella delle collane/serie, collegata agli editori.

Struttura:
```sql
CREATE TABLE collane (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  editore_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (editore_id) REFERENCES editori(id),
  UNIQUE(nome, editore_id)
)
```

### Migrazione

Per migrare un database esistente alla nuova struttura normalizzata:

```bash
node tools/migrate_to_normalized_schema.js
```

Lo script:
1. Crea le tabelle `editori` e `collane`
2. Popola le nuove tabelle con dati estratti dalla tabella `books`
3. Aggiunge i campi `editore_id` e `collana_id` alla tabella `books`
4. Aggiorna i riferimenti nella tabella `books`
5. Crea indici per ottimizzare le query

**Nota:** I campi vecchi (`editore` e `collana` come stringhe) sono mantenuti per retrocompatibilità ma possono essere rimossi dopo la verifica completa del funzionamento.

---

## Errori Comuni

### 500 Internal Server Error
```json
{
  "error": "Messaggio di errore dal database o filesystem"
}
```

### 404 Not Found
```json
{
  "error": "No previous book"
}
```

### 400 Bad Request
```json
{
  "error": "No fields to update"
}
```
