# Installazione come servizio systemd

## Prerequisiti
- Sistema Linux con systemd
- Node.js installato
- Accesso root/sudo

## Passi di installazione

### 1. Prepara la directory
```bash
# Copia il progetto in /opt
sudo cp -r /percorso/al/progetto /opt/book-manager
sudo chown -R www-data:www-data /opt/book-manager
```

### 2. Installa il file .service
```bash
# Copia il file service
sudo cp /opt/book-manager/book-manager.service /etc/systemd/system/

# Ricarica systemd
sudo systemctl daemon-reload
```

### 3. Abilita il servizio
```bash
# Abilita l'avvio automatico
sudo systemctl enable book-manager

# Avvia il servizio
sudo systemctl start book-manager
```

## Comandi utili

```bash
# Verifica lo stato
sudo systemctl status book-manager

# Visualizza i log
sudo journalctl -u book-manager -f

# Riavvia il servizio
sudo systemctl restart book-manager

# Ferma il servizio
sudo systemctl stop book-manager

# Disabilita l'avvio automatico
sudo systemctl disable book-manager
```

## Note di configurazione

Il file `.service` è configurato con:
- **User**: www-data (modifica se necessario)
- **WorkingDirectory**: /opt/book-manager (adatta al tuo percorso)
- **Restart**: always (riavvio automatico in caso di crash)
- **StandardOutput**: journal (log su systemd journal)

### Se usi un utente diverso
Modifica la riga `User=` nel file `.service`:
```ini
User=tu-utente
```

### Se usi una porta diversa da 3100
Modifica il file `dbpath.conf` e riavvia il servizio:
```bash
sudo systemctl restart book-manager
```

## Disinstallazione

```bash
# Ferma e disabilita il servizio
sudo systemctl stop book-manager
sudo systemctl disable book-manager

# Rimuovi il file service
sudo rm /etc/systemd/system/book-manager.service

# Ricarica systemd
sudo systemctl daemon-reload
```
