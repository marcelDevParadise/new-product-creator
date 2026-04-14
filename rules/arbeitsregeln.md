# Allgemeine Arbeitsregeln

## Workflow

1. Vor jeder Implementierung: Kontext sammeln (betroffene Dateien lesen).
2. Backend + Frontend zusammen implementieren (nicht nur eine Seite).
3. Nach Änderungen: `get_errors` ausführen um Kompilierfehler zu prüfen.
4. Erledigte Features in `Projekterweiterungen.md` abhaken (✅).

## Qualität

- Keine unnötigen Features hinzufügen — nur was angefragt wurde.
- Keine Docstrings/Kommentare zu Code der nicht geändert wurde.
- Bestehende Patterns wiederverwenden statt neue zu erfinden.
- Fehlerbehandlung: Nur an Systemgrenzen validieren.

## Nicht ändern ohne Rückfrage

- `attribute_config.json` Struktur
- Datenbank-Schema (bestehende Spalten)
- API-Prefix-Konventionen (`/api/...`)
- Bestehende Endpunkt-Signaturen (Breaking Changes)

## Testen

- Nach Implementierung kurz prüfen ob `python start.py` startet.
- `get_errors` auf geänderte Dateien ausführen.
