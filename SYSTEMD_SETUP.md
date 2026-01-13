# Installazione come servizio systemd

## Prerequisiti
- Sistema Linux con systemd
- Node.js installato
- Accesso root/sudo

## Passi di installazione

### 1. Prepara la directory
```bash
# Copia il progetto in /opt
sudo cp -r /percorso/al/progetto /opt/urania-web
sudo chown -R www-data:www-data /opt/urania-web
```

### 2. Installa il file .service
```bash
# Copia il file service
sudo cp /opt/urania-web/urania-web.service /etc/systemd/system/

# Ricarica systemd
sudo systemctl daemon-reload
```

### 3. Abilita il servizio
```bash
# Abilita l'avvio automatico
sudo systemctl enable urania-web

# Avvia il servizio
sudo systemctl start urania-web
```

## Comandi utili

```bash
# Verifica lo stato
sudo systemctl status urania-web

# Visualizza i log
sudo journalctl -u urania-web -f

# Riavvia il servizio
sudo systemctl restart urania-web

# Ferma il servizio
sudo systemctl stop urania-web

# Disabilita l'avvio automatico
sudo systemctl disable urania-web
```

## Note di configurazione

Il file `.service` è configurato con:
- **User**: www-data (modifica se necessario)
- **WorkingDirectory**: /opt/urania-web (adatta al tuo percorso)
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
sudo systemctl restart urania-web
```

## Disinstallazione

```bash
# Ferma e disabilita il servizio
sudo systemctl stop urania-web
sudo systemctl disable urania-web

# Rimuovi il file service
sudo rm /etc/systemd/system/urania-web.service

# Ricarica systemd
sudo systemctl daemon-reload
```
