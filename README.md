# Gestione Libri Urania - Applicazione Web

Applicazione web Node.js per gestire un database SQLite di libri. Permette di visualizzare, filtrare, modificare e importare i dati dei libri della collezione Urania (e altre collane).

## Caratteristiche

- 📚 Visualizzazione lista e griglia dei libri con copertine
- 🔍 Filtri per collana, libri posseduti (📚), letti (👁️), digitali (💻)
- 📖 Visualizzazione dettagliata di ogni libro con sinossi e indice
- ✏️ Modifica inline e form completo per aggiornare i dati dei libri
- 📥 Importazione diretta da siti web e integrazione completa con **Calibre** e **Calibre-Web**
- 📊 Statistiche in tempo reale sui libri posseduti e letti
- 🐳 Pronto all'uso con Docker e Docker Compose
- 🎨 Interfaccia moderna, responsive e ottimizzata

## Requisiti

- **Per esecuzione locale**:
  - Node.js 18+ (consigliato 20 o 22)
  - npm
  - SQLite database `books.db`
- **Per esecuzione con Docker**:
  - Docker e Docker Compose

---

## Installazione Locale

1. Configura il percorso del database `books.db` in `dbpath.conf` (copiando da `dbpath.conf.example`):
   ```bash
   cp dbpath.conf.example dbpath.conf
   ```
   Inserisci nel file il percorso assoluto o relativo al tuo file `books.db`.

2. Installa le dipendenze:
   ```bash
   npm install
   ```

3. (Opzionale) Configura il percorso di Calibre e Calibre-Web in `calibre.conf` (copiando da `calibre.conf.example`):
   ```bash
   cp calibre.conf.example calibre.conf
   ```
   ```conf
   CALIBRE_DIR=/home/username/Calibre Library
   CALIBRE_WEB_DB=/home/username/.../calibre-web/app.db
   CALIBRE_WEB_URL=http://localhost:8083
   ```
   *(Se omesso, l'applicazione tenta di auto-rilevare la libreria Calibre e Calibre-Web sul sistema).*

---

## Utilizzo

### Avvio locale

Avvia il server:

```bash
npm start
```

Il server sarà disponibile all'indirizzo `http://localhost:3100`.

### Avvio con Docker / Docker Compose

L'applicazione include un `Dockerfile` e un file `docker-compose.yml` preconfigurato.

1. Copia `.env.example` in `.env` e imposta i percorsi delle cartelle sul tuo computer host:
   ```bash
   cp .env.example .env
   ```
   Nel file `.env` puoi definire:
   - `PORT`: porta esposta (default: `3100`)
   - `DB_DIR_HOST`: cartella sull'host che contiene il file `books.db`
   - `CALIBRE_DIR_HOST`: cartella della libreria Calibre sull'host
   - `CALIBRE_WEB_DB_HOST`: percorso del database `app.db` di Calibre-Web
   - `CALIBRE_WEB_URL`: URL di Calibre-Web (`http://host.docker.internal:8083` per raggiungere l'host dal container)

2. Avvia il container:
   ```bash
   docker compose up -d
   ```

3. Visualizza i log o arresta il container:
   ```bash
   # Visualizza log in tempo reale
   docker compose logs -f

   # Arresta il container
   docker compose down
   ```

Il server sarà accessibile all'indirizzo `http://localhost:3100`.

---

## Struttura Progetto

```
urania-web/
├── Dockerfile              # Immagine Docker basata su Node 22 slim
├── docker-compose.yml      # Configurazione Docker Compose con volumi e porte
├── .dockerignore           # File esclusi dal build Docker
├── .env.example            # Variabili d'ambiente d'esempio per Docker
├── calibre.conf.example    # Esempio configurazione percorsi Calibre
├── dbpath.conf.example     # Esempio configurazione percorso database books.db
├── package.json            # Dipendenze del progetto
├── server.js               # Server Express.js e API REST
├── service/
│   ├── calibreService.js   # Servizio di integrazione Calibre / Calibre-Web
│   └── htmlImportParser.js # Parser per importazione metadati da pagine web
├── public/
│   ├── index.html          # Interfaccia grafica HTML
│   ├── styles.css          # Stili CSS responsive
│   └── app.js              # Logica JavaScript frontend (filtri, modali, import)
└── cache/                  # Cache locale delle copertine e sinossi
```

---

## API Endpoints

- `GET /api/books` - Ottieni tutti i libri (con filtri e paginazione)
- `GET /api/books/:id` - Ottieni dettagli di un libro
- `GET /api/collane` - Ottieni lista delle collane
- `GET /api/books/collana/:collana` - Ottieni libri di una collana specifica
- `GET /api/indexes/:bookId` - Ottieni indice e racconti di un libro
- `PUT /api/books/:id` - Aggiorna campi di un libro
- `POST /api/import/web` - Importa libro da URL web o URL Calibre-Web
- `GET /api/calibre/status` - Verifica stato e percorsi Calibre / Calibre-Web
- `GET /api/calibre/books` - Cerca o elenca libri presenti in Calibre
- `GET /api/calibre/books/:id` - Ottieni metadati completi di un libro Calibre per importazione
- `GET /api/calibre/books/:id/cover` - Immagine di copertina da Calibre
- `POST /api/calibre/import` - Importa un libro da Calibre nel database Urania

---

## Campi Database

La tabella `books` contiene i seguenti campi principali:
- `id` (INTEGER) - Chiave primaria
- `number` (INTEGER) - Numero nella collana
- `title_ita` (TEXT) - Titolo italiano
- `title_orig` (TEXT) - Titolo originale
- `author` (TEXT) - Autore
- `date_pub` (DATE) - Data di pubblicazione
- `cover_author` (TEXT) - Autore della copertina
- `cover_image` (BLOB) - Immagine copertina
- `synopsis` (TEXT) - Sinossi
- `synopsis_image` (BLOB) - Immagine sinossi
- `owned` (BOOL) - Nella collezione (📚)
- `stars` (INTEGER) - Valutazione (0-50, mezze stelle)
- `comment` (TEXT) - Note e commenti
- `reprint` (BOOL) - Ristampa
- `read` (BOOL) - Letto (👁️)
- `collana` (INTEGER/TEXT) - ID collana
- `editore` (INTEGER/TEXT) - ID editore
- `digital` (BOOL) - Versione digitale (💻)

---

## Funzionalità

### Visualizzazione
- **Vista lista**: visualizzazione tabellare compatta di tutti i libri.
- **Vista griglia**: visualizzazione a tessere con copertina, metadati e badge di stato.

### Filtri e Ricerca
- **Collana**: selezione della collana / serie.
- **Nella collezione / Non nella collezione**: filtro sui libri posseduti.
- **Letti / Non letti**: filtro sullo stato di lettura.
- **Digitali**: filtro sui libri disponibili in formato elettronico.

### Importazione
- **Importazione Web**: incolla un link (es. UraniaMania, Mondadori o pagina libro Calibre-Web) per compilare automaticamente la scheda.
- **Importazione Calibre-Web**: ricerca o sfoglia i libri presenti nella libreria Calibre locale e importali con un click, trasferendo copertina e metadati.
