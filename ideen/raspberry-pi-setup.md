# Raspberry Pi 5 — PostgreSQL + Tailscale Setup

## Übersicht

```
[Windows-PC] ──Tailscale VPN──▶ [Raspberry Pi 5]
  FastAPI Dev                      PostgreSQL :5432
  Frontend Dev                     (nur über Tailscale erreichbar)
```

Tailscale erstellt ein privates Mesh-VPN. PostgreSQL ist **nur** über die Tailscale-IP erreichbar — kein Port-Forwarding, kein offener Port im LAN nötig.

---

## Teil 1: PostgreSQL installieren

### 1.1 System aktualisieren

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 PostgreSQL installieren

```bash
sudo apt install postgresql postgresql-contrib -y
sudo systemctl enable postgresql
sudo systemctl status postgresql
```

### 1.3 Datenbank und Benutzer anlegen

```bash
sudo -u postgres psql
```

```sql
CREATE USER attributgen WITH PASSWORD 'SICHERES_PASSWORT_HIER';
CREATE DATABASE attribut_generator OWNER attributgen;
GRANT ALL PRIVILEGES ON DATABASE attribut_generator TO attributgen;
\q
```

### 1.4 Performance-Tuning (Pi 5, 8 GB RAM)

```bash
sudo nano /etc/postgresql/15/main/postgresql.conf
```

```conf
shared_buffers = 512MB
effective_cache_size = 2GB
work_mem = 32MB
maintenance_work_mem = 128MB
wal_buffers = 16MB
max_connections = 20
```

---

## Teil 2: Tailscale einrichten

### 2.1 Tailscale auf dem Raspberry Pi installieren

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

Tailscale starten und mit Account verknüpfen:

```bash
sudo tailscale up
```

→ Es erscheint ein Login-Link. Im Browser öffnen und autorisieren.

Tailscale-IP des Pi anzeigen:

```bash
tailscale ip -4
# Beispiel: 100.64.x.x
```

### 2.2 Tailscale auf dem Windows-PC installieren

1. Download: https://tailscale.com/download/windows
2. Installieren und mit **demselben Account** einloggen
3. Tailscale-IP prüfen: `tailscale ip -4` in PowerShell

### 2.3 Verbindung testen

Vom Windows-PC:

```powershell
ping <tailscale-ip-des-pi>
```

---

## Teil 3: PostgreSQL NUR über Tailscale erreichbar machen

### 3.1 PostgreSQL an Tailscale-IP binden

```bash
sudo nano /etc/postgresql/15/main/postgresql.conf
```

```conf
# NUR Tailscale + localhost — NICHT '*' oder LAN-IP
listen_addresses = 'localhost, 100.64.x.x'
```

→ `100.64.x.x` durch die Tailscale-IP des Pi ersetzen.

### 3.2 Zugriff nur von Tailscale-Netzwerk erlauben

```bash
sudo nano /etc/postgresql/15/main/pg_hba.conf
```

Am Ende hinzufügen:

```
# Tailscale VPN — nur Tailscale-Subnetz erlaubt
host    attribut_generator    attributgen    100.64.0.0/10    scram-sha-256

# Lokaler Zugriff auf dem Pi selbst
host    attribut_generator    attributgen    127.0.0.1/32     scram-sha-256
```

**NICHT** hinzufügen: `192.168.x.0/24` oder `0.0.0.0/0` — das würde den Zugriff über LAN/Internet öffnen.

### 3.3 Firewall härten

```bash
# UFW installieren falls nicht vorhanden
sudo apt install ufw -y

# Grundregeln
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH nur über Tailscale
sudo ufw allow in on tailscale0 to any port 22

# PostgreSQL nur über Tailscale
sudo ufw allow in on tailscale0 to any port 5432

# Tailscale selbst (UDP)
sudo ufw allow 41641/udp

# Aktivieren
sudo ufw enable
sudo ufw status verbose
```

> **Wichtig:** Port 5432 ist damit im LAN und Internet komplett gesperrt. Nur Geräte im Tailscale-Netzwerk können zugreifen.

### 3.4 PostgreSQL neu starten

```bash
sudo systemctl restart postgresql
```

---

## Teil 4: Verbindung vom Windows-PC testen

### Connection-String für die App

```
postgresql://attributgen:SICHERES_PASSWORT_HIER@100.64.x.x:5432/attribut_generator
```

### Manueller Test mit psql (oder pgAdmin)

```powershell
psql -U attributgen -d attribut_generator -h 100.64.x.x
```

---

## Teil 5: Tailscale absichern (Admin Console)

Unter https://login.tailscale.com/admin/acls — ACL-Policy anpassen:

```jsonc
{
  "acls": [
    {
      // Nur dein Windows-PC darf auf den Pi zugreifen
      "action": "accept",
      "src": ["tag:dev"],
      "dst": ["tag:server:5432", "tag:server:22"]
    }
  ],
  "tagOwners": {
    "tag:dev": ["autogroup:admin"],
    "tag:server": ["autogroup:admin"]
  }
}
```

Tags zuweisen:

```bash
# Auf dem Pi
sudo tailscale up --advertise-tags=tag:server

# Auf dem Windows-PC
tailscale up --advertise-tags=tag:dev
```

---

## Teil 6: Tägliches Backup

```bash
mkdir -p ~/backups/postgres

# .pgpass für passwortlosen pg_dump
echo "localhost:5432:attribut_generator:attributgen:SICHERES_PASSWORT_HIER" > ~/.pgpass
chmod 600 ~/.pgpass

# Cronjob: täglich 3 Uhr, behalte letzte 7 Tage
crontab -e
```

```cron
0 3 * * * pg_dump -U attributgen attribut_generator | gzip > ~/backups/postgres/attributgen_$(date +\%Y\%m\%d).sql.gz
0 4 * * * find ~/backups/postgres -name "*.sql.gz" -mtime +7 -delete
```

---

## Checkliste

- [ ] Raspberry Pi OS (64-bit) installiert
- [ ] PostgreSQL installiert und läuft
- [ ] Datenbank `attribut_generator` + User `attributgen` angelegt
- [ ] Tailscale auf Pi installiert und autorisiert
- [ ] Tailscale auf Windows-PC installiert und autorisiert
- [ ] `postgresql.conf`: `listen_addresses` auf Tailscale-IP gesetzt
- [ ] `pg_hba.conf`: nur `100.64.0.0/10` erlaubt
- [ ] UFW: Port 5432 nur auf `tailscale0` Interface
- [ ] Verbindung von Windows-PC über Tailscale-IP getestet
- [ ] ACL-Policy in Tailscale Admin Console gesetzt
- [ ] Backup-Cronjob eingerichtet
- [ ] Passwörter in `.pgpass` und Connection-String gesetzt

---

## Nächste Schritte (App-Migration)

1. **`asyncpg`** oder **`psycopg`** als PostgreSQL-Driver ins Backend
2. **SQLite → PostgreSQL Schema-Migration** (Tabellen + Spalten übersetzen)
3. **Daten migrieren** (SQLite-Export → PostgreSQL-Import)
4. **Connection-String** im Backend auf Tailscale-IP umstellen
5. **Backend auf Pi deployen** (systemd + uvicorn)
6. **Frontend-Build** (`npm run build`) per nginx auf Pi ausliefern
