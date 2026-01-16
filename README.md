# Gestione Libri - Applicazione Web

Applicazione web Node.js per gestire un database SQLite di libri. Permette di visualizzare, filtrare e modificare i dati della propria collezione di libri.

## Caratteristiche

- 📚 Visualizzazione lista e griglia dei libri
- 🔍 Filtri per collana, libri posseduti, letti, digitali
- 📖 Visualizzazione dettagliata di ogni libro
- ✏️ Modifica dati libro tramite interfaccia web
- 📊 Statistiche sui libri
- 🎨 Interfaccia moderna e responsive

## Requisiti

- Node.js 14+
- npm

## Installazione

1. Assicurati che il database SQLite `books.db` sia nella cartella principale del progetto
2. Installa le dipendenze:

```bash
npm install
```

## Utilizzo

Avvia il server:

```bash
npm start
```

Il server sarà disponibile a `http://localhost:3000`

## Struttura Progetto

```
book-manager/
├── server.js              # Server Express.js
├── package.json          # Dipendenze del progetto
├── books.db             # Database SQLite
└── public/
    ├── index.html       # Interfaccia HTML
    ├── styles.css       # Stili CSS
    └── app.js           # Logica JavaScript frontend
```

## API Endpoints

- `GET /api/books` - Ottieni tutti i libri
- `GET /api/books/:id` - Ottieni dettagli di un libro
- `GET /api/collane` - Ottieni lista collane
- `GET /api/books/collana/:collana` - Ottieni libri di una collana
- `GET /api/indexes/:bookId` - Ottieni indice/commenti di un libro
- `PUT /api/books/:id` - Aggiorna dati di un libro

## Struttura Database

### Tabella `books`
Tabella principale contenente i libri:
- `id` (INTEGER) - Chiave primaria
- `number` (INTEGER) - Numero edizione
- `title_ita` (TEXT) - Titolo italiano
- `title_orig` (TEXT) - Titolo originale
- `author` (TEXT) - Autore
- `date_pub` (DATE) - Data pubblicazione
- `cover_author` (TEXT) - Autore copertina
- `cover_image` (BLOB) - Immagine copertina
- `synopsis` (TEXT) - Sinossi
- `synopsis_image` (BLOB) - Immagine sinossi
- `owned` (BOOL) - Posseduto?
- `stars` (INTEGER) - Valutazione (0-50, rappresenta 0-5 stelle con mezze stelle)
- `comment` (TEXT) - Commenti
- `reprint` (BOOL) - Ristampa?
- `read` (BOOL) - Letto?
- `digital` (BOOL) - Versione digitale?
- `editore_id` (INTEGER) - FK verso tabella `editori`
- `collana_id` (INTEGER) - FK verso tabella `collane`
- `collana` (TEXT) - **Deprecato** - Collana/Serie (mantenuto per retrocompatibilità)
- `editore` (TEXT) - **Deprecato** - Editore (mantenuto per retrocompatibilità)
- `cover_hash` (TEXT) - Hash MD5 dell'immagine copertina
- `synopsis_hash` (TEXT) - Hash MD5 dell'immagine sinossi

### Tabella `editori`
Tabella normalizzata degli editori:
- `id` (INTEGER) - Chiave primaria
- `nome` (TEXT) - Nome editore (UNIQUE)
- `created_at` (DATETIME) - Data creazione record

### Tabella `collane`
Tabella normalizzata delle collane:
- `id` (INTEGER) - Chiave primaria
- `nome` (TEXT) - Nome collana
- `editore_id` (INTEGER) - FK verso tabella `editori`
- `created_at` (DATETIME) - Data creazione record
- UNIQUE constraint su (`nome`, `editore_id`)

### Migrazione Database

Per migrare un database esistente (con editore e collana come stringhe) alla nuova struttura normalizzata:

```bash
node tools/migrate_to_normalized_schema.js
```

Lo script esegue automaticamente:
1. Creazione tabelle `editori` e `collane`
2. Estrazione e popolamento dati dalle colonne stringa esistenti
3. Aggiunta foreign key alla tabella `books`
4. Creazione indici per ottimizzare le query

## Funzionalità

### Visualizzazione
- Vista lista: Visualizzazione compatta di tutti i libri
- Vista griglia: Visualizzazione a griglia con copertina

### Filtri
- **Collana**: Filtra per collezione
- **Editore**: Filtra per editore
- **Posseduti**: Mostra solo libri posseduti
- **Letti**: Mostra solo libri letti
- **Digitali**: Mostra solo versioni digitali

### Modifica Libri
Seleziona un libro per visualizzare tutti i dettagli. Usa il pulsante "Modifica" per aggiornare i campi del libro.
Nel form di modifica, editore e collana sono ora selezionabili da dropdown popolati dinamicamente dalle tabelle normalizzate.

## Sviluppo

Modificare i file in `public/` per personalizzare interfaccia e stili.
Modificare `server.js` per aggiungere nuove API o funzionalità backend.
