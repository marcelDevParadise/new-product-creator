# Artikelwerk-Updates auf dem Raspberry Pi prüfen

Diese Prüfliste untersucht den Veröffentlichungs- und Updatepfad des Attribut-Generators. Die Beispiele verwenden den Artikel `CYL-00030`. Für einen anderen Artikel die Variable `SKU` entsprechend ändern.

Die Befehle werden, soweit nicht anders angegeben, direkt auf dem Raspberry Pi ausgeführt.

## 1. Arbeitsverzeichnis und Artikel festlegen

```bash
cd ~/new-product-creator
SKU='CYL-00030'
pwd
```

## 2. Installierten Codezustand prüfen

```bash
git status --short
git branch --show-current
git log -1 --date=iso --format='%h %ad %s'
```

Die SQLite-Abfrage darf kein `DISTINCT ON` mehr enthalten:

```bash
grep -n 'DISTINCT ON' backend/services/database.py || echo 'OK: kein DISTINCT ON vorhanden'
```

Die Suche nach vorhandenen Artikeln muss aktive und inaktive Artikel berücksichtigen:

```bash
grep -n 'for status in ("active", "inactive")' backend/integrations/artikelwerk/publisher.py
```

Bereits veröffentlichte Artikel dürfen nicht durch die Publish-Route blockiert werden:

```bash
grep -n 'publication.get("status") in' backend/routers/articlewerk.py
```

Erwartet wird nur:

```text
{"queued", "publishing"}
```

## 3. Aktuellen Stand installieren

```bash
bash deploy/update-pi.sh
```

Anschließend den Dienstzustand kontrollieren:

```bash
sudo systemctl status attribut-generator.service --no-pager -l
sudo systemctl status caddy.service --no-pager -l
sudo tailscale serve status
```

## 4. Backend lokal prüfen

```bash
curl -fsS http://127.0.0.1:8000/api/health
curl -fsS http://127.0.0.1:8080/api/health
```

Beide Aufrufe sollten eine erfolgreiche Health-Antwort liefern.

## 5. Konfiguration prüfen, ohne Geheimnisse auszugeben

```bash
grep -E '^(DATABASE_URL|ARTIKELWERK_BASE_URL|ARTIKELWERK_API_KEY|IMAGE_LIBRARY_ROOT|IMAGE_UPLOAD_TOKEN)=' backend/.env \
  | sed -E \
      -e 's#^(DATABASE_URL=).*#\1[gesetzt]#' \
      -e 's#^(ARTIKELWERK_API_KEY=).*#\1[gesetzt]#' \
      -e 's#^(IMAGE_UPLOAD_TOKEN=).*#\1[gesetzt]#'
```

Zusätzlich prüfen, dass die benötigten Variablen nicht leer sind:

```bash
for name in DATABASE_URL ARTIKELWERK_BASE_URL ARTIKELWERK_API_KEY; do
  if grep -q "^${name}=." backend/.env; then
    echo "OK: ${name} ist gesetzt"
  else
    echo "FEHLT ODER LEER: ${name}"
  fi
done
```

## 6. Verbindung über den Generator prüfen

```bash
curl -sS http://127.0.0.1:8000/api/articlewerk/connection \
  | python3 -m json.tool
```

Wichtige Felder:

- `configured` muss `true` sein.
- `reachable` muss `true` sein.
- Unter `features` sollten mindestens `articleWrite` und `attributeWrite` aktiviert sein.

Den vollständigen von Artikelwerk gelieferten Kontext prüfen:

```bash
curl -sS http://127.0.0.1:8000/api/articlewerk/context \
  | python3 -m json.tool
```

## 7. Vorschau für den betroffenen Artikel prüfen

```bash
curl -sS -X POST \
  "http://127.0.0.1:8000/api/articlewerk/products/${SKU}/preview" \
  -w '\nHTTP %{http_code}\n'
```

Nur den formatierten JSON-Body anzeigen:

```bash
curl -fsS -X POST \
  "http://127.0.0.1:8000/api/articlewerk/products/${SKU}/preview" \
  | python3 -m json.tool
```

In `steps` sollten bei einem bestehenden Artikel unter anderem folgende Operationen vorkommen:

```text
create_article
sync_article
sync_tenants
set_attribute
```

Wenn Kategorien vorhanden und zur Veröffentlichung aktiviert sind, zusätzlich:

```text
sync_categories
```

## 8. Artikelwerk direkt abfragen

Die folgenden Variablen werden aus `backend/.env` gelesen, aber nicht ausgegeben:

```bash
ARTIKELWERK_BASE_URL="$(sed -n 's/^ARTIKELWERK_BASE_URL=//p' backend/.env | tail -n 1)"
ARTIKELWERK_API_KEY="$(sed -n 's/^ARTIKELWERK_API_KEY=//p' backend/.env | tail -n 1)"
```

Capabilities abrufen:

```bash
curl -fsS \
  -H "Authorization: Bearer ${ARTIKELWERK_API_KEY}" \
  -H 'Accept: application/json' \
  "${ARTIKELWERK_BASE_URL}/capabilities" \
  | python3 -m json.tool
```

Kontext speichern und sichtbare Mandanten anzeigen:

```bash
curl -fsS \
  -H "Authorization: Bearer ${ARTIKELWERK_API_KEY}" \
  -H 'Accept: application/json' \
  "${ARTIKELWERK_BASE_URL}/context" \
  -o /tmp/artikelwerk-context.json

python3 -c 'import json; d=json.load(open("/tmp/artikelwerk-context.json", encoding="utf-8")); print("\n".join("{}: {}".format(x["id"], x.get("name", "")) for x in d.get("tenants", [])))'
```

Den Artikel in jedem sichtbaren Mandanten als aktiv und inaktiv suchen:

```bash
for TENANT_ID in $(python3 -c 'import json; d=json.load(open("/tmp/artikelwerk-context.json", encoding="utf-8")); print(" ".join(str(x["id"]) for x in d.get("tenants", [])))'); do
  for STATUS in active inactive; do
    echo "=== tenantId=${TENANT_ID}, status=${STATUS} ==="
    curl -sS --get \
      -H "Authorization: Bearer ${ARTIKELWERK_API_KEY}" \
      -H 'Accept: application/json' \
      --data-urlencode "tenantId=${TENANT_ID}" \
      --data-urlencode "sku=${SKU}" \
      --data-urlencode "status=${STATUS}" \
      -w '\nHTTP %{http_code}\n' \
      "${ARTIKELWERK_BASE_URL}/articles"
    echo
  done
done
```

Mindestens eine Antwort muss den Artikel einschließlich seiner numerischen `id` oder `articleId` enthalten. Wenn alle Antworten leer sind, Artikelwerk aber beim Anlegen `Artikelnummer ist bereits vorhanden` meldet, kann die vorhandene Artikel-ID über den aktuellen Suchvertrag nicht aufgelöst werden.

Variablen anschließend aus der Shell entfernen:

```bash
unset ARTIKELWERK_API_KEY ARTIKELWERK_BASE_URL TENANT_ID STATUS
```

## 9. Lokalen Veröffentlichungsstatus und Operationshistorie prüfen

Dieser Befehl funktioniert mit PostgreSQL und SQLite, weil er den Datenbankadapter der Anwendung verwendet:

```bash
cd ~/new-product-creator/backend

../.venv/bin/python - "$SKU" <<'PY'
import json
import sys

from services.database import get_conn, get_articlewerk_managed_attribute_ids

sku = sys.argv[1]

with get_conn() as conn, conn.cursor() as cur:
    cur.execute(
        "SELECT artikelnummer, remote_article_id, status, last_error_code, "
        "last_error_message, last_request_id, updated_at "
        "FROM articlewerk_publications WHERE artikelnummer=%s",
        (sku,),
    )
    publication = cur.fetchone()

    cur.execute(
        "SELECT job_id, status, current_phase, progress_current, progress_total, "
        "last_error, created_at, finished_at "
        "FROM articlewerk_jobs WHERE root_sku=%s ORDER BY created_at DESC LIMIT 10",
        (sku,),
    )
    jobs = cur.fetchall()

    cur.execute(
        "SELECT operation_type, resource_key, status, attempts, error_code, "
        "request_id, updated_at "
        "FROM articlewerk_operations WHERE artikelnummer=%s "
        "ORDER BY updated_at DESC LIMIT 50",
        (sku,),
    )
    operations = cur.fetchall()

print("PUBLICATION:")
print(publication)
print("\nJOBS:")
for row in jobs:
    print(row)
print("\nOPERATIONS:")
for row in operations:
    print(row)
print("\nVOM GENERATOR VERWALTETE ATTRIBUTE:")
print(sorted(get_articlewerk_managed_attribute_ids(sku)))
PY

cd ..
```

Für einen aktualisierbaren vorhandenen Artikel muss `articlewerk_publications.remote_article_id` eine numerische Artikel-ID enthalten.

## 10. Veröffentlichung kontrolliert auslösen

Dieser Befehl verändert Daten in Artikelwerk/JTL und sollte erst nach erfolgreicher Vorschau ausgeführt werden:

```bash
curl -sS -X POST \
  "http://127.0.0.1:8000/api/articlewerk/products/${SKU}/publish" \
  -w '\nHTTP %{http_code}\n'
```

Erwartet wird `HTTP 202` mit einer `job_id`.

Den Jobstatus anschließend abrufen:

```bash
JOB_ID='<JOB-ID-AUS-DER-ANTWORT>'

curl -sS \
  "http://127.0.0.1:8000/api/articlewerk/jobs/${JOB_ID}" \
  | python3 -m json.tool
```

Die letzten Artikelwerk-Logs anzeigen:

```bash
curl -sS \
  'http://127.0.0.1:8000/api/articlewerk/logs?limit=20' \
  | python3 -m json.tool
```

## 11. Dienstprotokolle untersuchen

Nur Meldungen seit dem letzten Dienststart:

```bash
sudo journalctl -u attribut-generator.service \
  --since "$(systemctl show attribut-generator.service -p ActiveEnterTimestamp --value)" \
  --no-pager
```

Die letzten 150 Zeilen:

```bash
sudo journalctl -u attribut-generator.service -n 150 --no-pager
```

Live verfolgen, während im Browser erneut veröffentlicht wird:

```bash
sudo journalctl -u attribut-generator.service -f
```

Nur typische Fehler und Artikelwerk-Meldungen herausfiltern:

```bash
sudo journalctl -u attribut-generator.service --since today --no-pager \
  | grep -Ei 'error|exception|traceback|artikelwerk|conflict|etag|request-id|CYL-00030'
```

## 12. Ergebnis einordnen

### Vorschau liefert HTTP 500

Den Python-Stacktrace aus Abschnitt 11 sichern. Zusätzlich prüfen, dass `DISTINCT ON` laut Abschnitt 2 nicht mehr vorhanden ist.

### Veröffentlichung liefert HTTP 409 mit `queued` oder `publishing`

Es läuft bereits ein Job. Den Job- und Operationsstatus aus Abschnitt 9 prüfen und nicht mehrfach parallel veröffentlichen.

### `create_article` meldet weiterhin `CONFLICT`

Die direkten Suchergebnisse aus Abschnitt 8 prüfen:

- Wird eine Artikel-ID zurückgegeben, muss der Generator sie wiederverwenden.
- Bleiben alle Suchantworten leer, obwohl die globale SKU-Prüfung einen Konflikt meldet, benötigt die Artikelwerk-API eine globale SKU-Auflösung oder muss die vorhandene `articleId` im 409-Fehler unter `details` ausgeben.

### Update scheitert mit HTTP 412

Der ETag hat sich zwischen Lesen und Schreiben geändert. Den Vorgang erneut starten. Bleibt der Fehler bestehen, die Request-ID und den betroffenen `sync_*`-Schritt aus den Logs sichern.

### Update scheitert mit `MISSING_ETAG`

Der betreffende Artikelwerk-GET-Endpunkt liefert keinen `ETag`-Header. Ohne ETag wird das Update absichtlich nicht ausgeführt, um parallele Änderungen nicht zu überschreiben.

## 13. Diagnoseinformationen zum Weitergeben

Für eine weitere Fehleranalyse werden benötigt:

```text
- Ausgabe aus Abschnitt 2
- Verbindungsergebnis aus Abschnitt 6
- Vorschau aus Abschnitt 7
- Suchantworten aus Abschnitt 8, ohne API-Key
- Veröffentlichungsstatus und Operationshistorie aus Abschnitt 9
- relevanter Journal-Stacktrace aus Abschnitt 11
- Request-ID aus der Artikelwerk-Fehlermeldung
```

API-Key, Datenbankkennwort und `IMAGE_UPLOAD_TOKEN` niemals mitsenden.
