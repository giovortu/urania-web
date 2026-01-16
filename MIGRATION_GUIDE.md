# Istruzioni per Migrazione Database

## Stato Attuale

È stato creato il branch `database-normalization` con tutte le modifiche necessarie per normalizzare il database.

## Cosa è Stato Fatto

✅ **Database Schema**
- Creato script di migrazione: `tools/migrate_to_normalized_schema.js`
- Definite tabelle `editori` e `collane` con relazioni appropriate
- Mantenuta compatibilità con vecchi campi

✅ **Backend (server.js)**
- Aggiunto endpoint `GET /api/editori`
- Aggiunto endpoint `GET /api/books/editore/:editore`
- Modificato `GET /api/collane` per restituire oggetti completi
- Aggiornati tutti gli endpoint per usare JOIN
- Supporto per filtri sia per nome che per ID

✅ **Frontend**
- Modificato form di modifica per usare dropdown
- Implementato caricamento dinamico di editori e collane
- Cascading dropdown: editore → collane filtrate
- Salvataggio tramite ID invece di stringhe

✅ **Documentazione**
- Aggiornato `docs/API.md` con nuovi endpoint
- Aggiornato `README.md` con struttura database
- Creato `tools/README.md` con istruzioni di migrazione

## Prossimi Passi per Completare la Migrazione

### 1. Eseguire la Migrazione del Database

**IMPORTANTE:** Fare un backup del database prima di procedere!

```bash
# Backup del database
cp path/to/your/database.db path/to/your/database.db.backup

# Eseguire la migrazione
node tools/migrate_to_normalized_schema.js
```

Lo script:
- Creerà le nuove tabelle
- Popolerà i dati
- Aggiungerà i foreign keys
- Mostrerà statistiche di verifica

### 2. Verificare la Migrazione

Controllare l'output dello script per assicurarsi che:
- Tutte le tabelle sono state create
- Il numero di editori e collane è corretto
- Tutti i libri hanno i riferimenti corretti

Esempio di verifica manuale con SQLite:

```sql
-- Aprire il database
sqlite3 path/to/database.db

-- Verificare editori
SELECT COUNT(*) FROM editori;
SELECT * FROM editori LIMIT 5;

-- Verificare collane
SELECT COUNT(*) FROM collane;
SELECT c.*, e.nome as editore 
FROM collane c 
JOIN editori e ON e.id = c.editore_id 
LIMIT 10;

-- Verificare libri con riferimenti
SELECT COUNT(*) FROM books WHERE editore_id IS NOT NULL;
SELECT COUNT(*) FROM books WHERE collana_id IS NOT NULL;

-- Verificare coerenza dati (esempio)
SELECT 
  b.title_ita,
  b.editore as old_editore,
  e.nome as new_editore,
  b.collana as old_collana,
  c.nome as new_collana
FROM books b
LEFT JOIN editori e ON e.id = b.editore_id
LEFT JOIN collane c ON c.id = b.collana_id
LIMIT 10;
```

### 3. Testare l'Applicazione

Avviare il server e testare tutte le funzionalità:

```bash
npm start
```

#### Test Checklist:

**Visualizzazione:**
- [ ] La lista libri si carica correttamente
- [ ] I dettagli del libro mostrano editore e collana
- [ ] Il filtro collane mostra le opzioni con editore

**Filtri:**
- [ ] Filtro per collana funziona
- [ ] Filtro per editore funziona (se implementato nel frontend)
- [ ] Combinazione di filtri funziona correttamente

**Modifica Libro:**
- [ ] Il modal di modifica si apre correttamente
- [ ] I dropdown editore e collana sono popolati
- [ ] Selezionando un editore, le collane vengono filtrate
- [ ] Il salvataggio aggiorna correttamente i dati
- [ ] Dopo il salvataggio, i dati visualizzati sono corretti

**API:**
- [ ] `GET /api/editori` restituisce la lista
- [ ] `GET /api/collane` restituisce oggetti con relazioni
- [ ] `GET /api/collane?editore_id=1` filtra correttamente
- [ ] `GET /api/books` include editore e collana
- [ ] `PUT /api/books/:id` con editore_id/collana_id funziona

### 4. Test dei Casi Limite

- [ ] Libro senza editore (null/vuoto)
- [ ] Libro senza collana (null/vuoto)
- [ ] Cambio editore di un libro
- [ ] Cambio collana di un libro
- [ ] Navigazione prev/next con filtri attivi

### 5. Performance

Confrontare le performance prima e dopo:

```bash
# Prima (su branch main)
# Misurare tempo di caricamento /api/books con filtro collana

# Dopo (su branch database-normalization)
# Misurare tempo di caricamento con stesso filtro
# Dovrebbe essere più veloce grazie agli indici
```

### 6. Merge nel Branch Principale

Una volta verificato tutto:

```bash
# Tornare al branch main
git checkout main

# Fare merge del branch di normalizzazione
git merge database-normalization

# Pushare le modifiche
git push origin main
```

## Risoluzione Problemi

### Problema: Script di migrazione non trova il database
**Soluzione:** Verificare che `dbpath.conf` contenga il percorso corretto

### Problema: Errori durante la migrazione
**Soluzione:** 
1. Ripristinare il backup
2. Verificare che il database non sia corrotto
3. Verificare permessi di scrittura

### Problema: Frontend non carica i dropdown
**Soluzione:**
1. Aprire la console del browser
2. Verificare eventuali errori JavaScript
3. Verificare che gli endpoint API rispondano correttamente

### Problema: Dati non salvati correttamente
**Soluzione:**
1. Verificare nella console del browser il payload inviato
2. Verificare che editore_id e collana_id siano numeri
3. Controllare i log del server per errori

## Rollback (se necessario)

Se qualcosa non funziona:

```bash
# Tornare al branch main
git checkout main

# Ripristinare il database dal backup
cp path/to/database.db.backup path/to/database.db

# Riavviare il server
npm start
```

## Note Importanti

1. **Compatibilità Backward:** Il codice mantiene i vecchi campi `editore` e `collana` come stringhe per retrocompatibilità. Questi possono essere rimossi in futuro dopo verifica approfondita.

2. **Cache del Browser:** Dopo il merge, chiedere agli utenti di fare un refresh forzato (Ctrl+F5) per caricare i nuovi file JavaScript/CSS.

3. **Dati Esistenti:** Tutti i dati esistenti sono preservati. La migrazione è additiva (aggiunge tabelle e colonne, non rimuove).

4. **Performance:** Le query dovrebbero essere più veloci grazie agli indici sui foreign keys. Monitorare le performance in produzione.

## Supporto

Per domande o problemi durante la migrazione, consultare:
- `tools/README.md` - Dettagli tecnici della migrazione
- `docs/API.md` - Documentazione API aggiornata
- `README.md` - Struttura database completa
