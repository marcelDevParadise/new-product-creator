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

---

## Teil 7: App-Deployment auf dem Pi

Architektur:

```
[Browser]
   │  HTTPS via Tailscale
   ▼
https://<host>.<tailnet>.ts.net   ← tailscale serve
   │
   ▼
Caddy :8080 (lokal)
   ├─ /api/*  → uvicorn :8000  (systemd: attribut-generator.service)
   └─ /*      → frontend/dist   (statisches React-Build)
                  │
                  ▼
              PostgreSQL :5432  (lokal über Unix-Socket / 127.0.0.1)
```

### 7.1 Repo klonen

```bash
cd ~
git clone https://github.com/marcelDevParadise/new-product-creator.git
cd new-product-creator
```

### 7.2 `.env` für Backend anlegen

Da das Backend jetzt **auf dem Pi selbst** läuft, geht die DB-Verbindung über `127.0.0.1` (nicht über Tailscale):

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

```env
DATABASE_URL=postgresql://attributgen:SICHERES_PASSWORT_HIER@127.0.0.1:5432/attribut_generator
CORS_ORIGINS=https://<host>.<tailnet>.ts.net
```

> Tailscale-Hostname rausfinden mit `tailscale status --self --json | jq -r '.Self.DNSName'` oder einfach `tailscale dns status`.

### 7.3 Setup-Skript ausführen

```bash
chmod +x deploy/setup-pi.sh deploy/update-pi.sh
bash deploy/setup-pi.sh
```

Das Skript:
- installiert Python-venv, Node.js, Caddy
- legt `.venv` an und installiert Backend-Dependencies
- baut das Frontend (`npm ci && npm run build`)
- installiert die systemd-Unit `attribut-generator.service` und startet sie
- kopiert den Caddyfile nach `/etc/caddy/` und startet Caddy
- aktiviert Tailscale Serve (HTTPS auf Port 443 → Caddy auf 8080)

### 7.4 Daten von der lokalen SQLite migrieren (einmalig)

Falls noch nicht geschehen — vom **Windows-PC aus** die Migration ausführen (DATABASE_URL zeigt dann auf die Tailscale-IP):

```powershell
cd backend
python migrate_to_postgres.py --clear
```

### 7.5 Status prüfen

```bash
sudo systemctl status attribut-generator caddy
sudo journalctl -u attribut-generator -f
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8080/api/health
```

### 7.6 Im Browser öffnen

```
https://<host>.<tailnet>.ts.net/
```

Funktioniert von jedem Gerät, das im selben Tailscale-Netz angemeldet ist.

### 7.7 Updates einspielen

Code geändert und auf GitHub gepusht? Auf dem Pi:

```bash
cd ~/new-product-creator
bash deploy/update-pi.sh
```

Macht `git pull`, installiert geänderte Python-Pakete, baut Frontend neu, restartet Backend, reloadet Caddy.

---

## Teil 7b: Auto-Deploy per Tag (kein SSH nötig)

Wenn du nur bei "echten" Releases den Pi aktualisieren willst, kannst du einen Tag pushen — der Pi prüft alle 5 Min auf neue Tags und deployed dann automatisch.

### 7b.1 Cronjob auf dem Pi einrichten

```bash
crontab -e
```

```cron
*/5 * * * * /home/marcel/new-product-creator/deploy/auto-update.sh >> /home/marcel/auto-deploy.log 2>&1
```

> Pfad an deinen User anpassen falls du nicht `marcel` heißt.

Was das Skript tut:
1. `git fetch --tags` (kein Side-Effect, falls keine neuen Tags)
2. Sucht den neuesten Tag, der zu `v*` oder `deploy-*` passt
3. Vergleicht mit dem zuletzt deployten Tag (in `.last-deployed-tag`)
4. Wenn neu → `git checkout <tag>` + `bash deploy/update-pi.sh`
5. Sonst: still beenden (kein Restart, keine Disk-IO)

### 7b.2 Release vom Windows-PC pushen

Im Repo-Root in PowerShell:

```powershell
# Datum-basierter Tag (deploy-2026-04-22-1)
.\deploy\release.ps1

# Semver-Tag (v1.4.0)
.\deploy\release.ps1 -Version "1.4.0" -Message "Neue Variantenmatrix"
```

Das Skript:
- prüft dass nichts uncommittetes da ist
- erstellt einen annotated Tag
- pusht Branch + Tag (`--follow-tags`)
- Pi deployed beim nächsten Cron-Run

### 7b.3 Status prüfen

Auf dem Pi:

```bash
tail -f /home/marcel/auto-deploy.log
cat ~/new-product-creator/.last-deployed-tag
sudo systemctl status attribut-generator caddy
```

### 7b.4 Manueller Trigger zwischendurch

Wenn du nicht 5 Min warten willst:

```bash
ssh marcel@100.87.118.91 'bash ~/new-product-creator/deploy/auto-update.sh'
```

Oder ohne Tag-Check direkt vom letzten master-Commit deployen:

```bash
ssh marcel@100.87.118.91 'cd ~/new-product-creator && git checkout master && bash deploy/update-pi.sh'
```

---

## Teil 8: Häufige Probleme

| Symptom | Lösung |
|---|---|
| `502 Bad Gateway` von Caddy | `sudo journalctl -u attribut-generator -n 50` — meist ImportError oder fehlende `.env` |
| Frontend lädt aber API gibt 404 | Caddyfile-Pfad falsch — `handle /api/*` vor `handle {}` prüfen |
| `permission denied` auf `/var/log/caddy` | `sudo chown -R caddy:caddy /var/log/caddy` |
| `tailscale serve` zeigt "permission denied" | Pi neu mit `--operator=$USER` aufsetzen oder `sudo` davor |
| Browser zeigt "ERR_CERT_AUTHORITY_INVALID" | Gerät noch nicht im Tailscale eingeloggt — Tailscale-Cert wird nur Mitgliedern ausgeliefert |
| Backend startet aber `init_db` schlägt fehl | DATABASE_URL prüfen, `psql -h 127.0.0.1 -U attributgen -d attribut_generator` testen |
| `npm run build` läuft out-of-memory auf Pi | `NODE_OPTIONS=--max-old-space-size=2048 npm run build` |

