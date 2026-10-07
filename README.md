# Gestione Libri Urania - Applicazione Web

Applicazione web Node.js per gestire un database SQLite di libri. Permette di visualizzare, filtrare e modificare i dati dei libri della collezione Urania.

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

3. (Opzionale) Configura il percorso di Calibre e Calibre-Web in `calibre.conf` (copiando da `calibre.conf.example`):

```conf
CALIBRE_DIR=/home/username/Calibre Library
CALIBRE_WEB_DB=/home/username/.../calibre-web/app.db
CALIBRE_WEB_URL=http://localhost:8083
```

*(Se omesso, l'applicazione auto-rileva la libreria Calibre e la configurazione di Calibre-Web sul sistema).*

## Utilizzo

Avvia il server:

```bash
npm start
```

Il server sarà disponibile a `http://localhost:3100`

## Struttura Progetto

```
Urania_web/
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
- `POST /api/import/web` - Importa libro da URL web o URL Calibre-Web
- `GET /api/calibre/status` - Verifica stato e percorsi Calibre / Calibre-Web
- `GET /api/calibre/books` - Cerca o elenca libri presenti in Calibre
- `GET /api/calibre/books/:id` - Ottieni metadati completi di un libro Calibre per l'importazione
- `GET /api/calibre/books/:id/cover` - Immagine di copertina del libro Calibre
- `POST /api/calibre/import` - Importa un libro da Calibre nel database Urania

## Campi Database

La tabella `books` contiene i seguenti campi:
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
- `stars` (INTEGER) - Valutazione (0-5)
- `comment` (TEXT) - Commenti
- `reprint` (BOOL) - Ristampa?
- `read` (BOOL) - Letto?
- `collana` (TEXT) - Collana/Serie
- `editore` (TEXT) - Editore
- `digital` (BOOL) - Versione digitale?

## Funzionalità

### Visualizzazione
- Vista lista: Visualizzazione compatta di tutti i libri
- Vista griglia: Visualizzazione a griglia con copertina

### Filtri
- **Collana**: Filtra per collezione
- **Posseduti**: Mostra solo libri posseduti
- **Letti**: Mostra solo libri letti
- **Digitali**: Mostra solo versioni digitali

### Modifica Libri
Seleziona un libro per visualizzare tutti i dettagli. Usa il pulsante "Modifica" per aggiornare i campi del libro.

## Sviluppo

Modificare i file in `public/` per personalizzare interfaccia e stili.
Modificare `server.js` per aggiungere nuove API o funzionalità backend.
