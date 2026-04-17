---
tags:
  - ideen
  - attribut-generator
  - feature-request
  - ki
  - datenmanagement
  - ux
date: 2026-04-15
status: aktiv
bereich:
  - ki-automatisierung
  - import
  - analyse
  - ux
  - qualität
---

# Feature-Ideen — 2026-04-15

> [!info] Kontext
> Zweite Ideenrunde. Keine Duplikate zu [[2025-07-13_feature-ideen]] oder [[Projekterweiterungen]].

---

## KI & Intelligente Automatisierung

| Idee | Beschreibung | Nutzen | Aufwand | Sinnvoll? |
|------|-------------|--------|---------|-----------|
| KI-Produktbeschreibungen | Kurz-/Langbeschreibung per LLM aus Produktname + Attributen | Spart 5–10 Min/Produkt; konsistenter Stil | Mittel | ✅ Ja |
| KI-Kategorievorschlag | Kategorie aus Produktname + Hersteller ableiten | Weniger manuelle Zuordnung | Klein | ✅ Ja |
| KI-SEO-Optimierung | Title-Tag + Meta-Description generieren | SEO-Felder oft leer → automatisches Befüllen | Klein | ✅ Ja |
| Attribut-Wert-Extraktion | Aus Name automatisch Farbe, Material, Größe erkennen | Spart manuelles Zuweisen bei >80% | Mittel | Später |
| Anomalie-Erkennung | Ungewöhnliche Werte markieren (Gewicht 0.001 kg, EK 0€) | Datenfehler automatisch finden | Klein | ✅ Ja |

---

## Datenmanagement & Import

| Idee | Beschreibung | Nutzen | Aufwand | Sinnvoll? |
|------|-------------|--------|---------|-----------|
| Clipboard-Import | Direkt aus Excel/Sheets einfügen (Ctrl+V) | Kein CSV-Umweg mehr | Klein | ✅ Ja |
| Import-Diff-Vorschau | Vorher anzeigen: welche Felder ändern sich | Keine versehentlichen Überschreibungen | Mittel | ✅ Ja |
| Auto-Backup vor Bulk-Ops | DB-Snapshot vor Import, Bulk, Template-Apply | Schnelles Rollback bei Fehlern | Klein | ✅ Ja |
| Wiederkehrender Import | Import-Quelle + Mapping speichern, One-Click | Spart 5 Min pro Lieferanten-Update | Mittel | Später |
| Produkt-Merge-Assistent | Bei Duplikaten: Felder zusammenführen im Dialog | Saubere Datenbasis | Mittel | Später |

---

## Analyse & Reporting

| Idee | Beschreibung | Nutzen | Aufwand | Sinnvoll? |
|------|-------------|--------|---------|-----------|
| Attribut-Nutzungsbericht | Welches Attribut ist bei wie vielen Produkten gesetzt | Tote Attribute identifizieren | Klein | ✅ Ja |
| Preisverlauf pro Produkt | EK/VK-Änderungen über Zeit als Sparkline | Margenentwicklung sehen | Mittel | Später |
| Sortiment-Matrix | Kategorien × Hersteller → Produktanzahl pro Zelle | Sortimentslücken erkennen | Klein | ✅ Ja |
| Export-Changelog | Was war im letzten Export neu/geändert | Nachvollziehbar was gesendet wurde | Mittel | Später |
| Vollständigkeits-Trend | Chart: Datenvollständigkeit über Zeit | Fortschritt sichtbar machen | Mittel | Später |

---

## UX & Produktivität

| Idee | Beschreibung | Nutzen | Aufwand | Sinnvoll? |
|------|-------------|--------|---------|-----------|
| Multi-Tab Bearbeitung | Mehrere Produkte in Tabs öffnen | Parallel bearbeiten ohne Navigation | Mittel | Später |
| Bookmark/Favoriten | Produkte als Favorit markieren, Schnellzugriff | Häufig bearbeitete sofort finden | Klein | ✅ Ja |
| Inline-Edit in Tabellen | Zellen per Doppelklick bearbeiten | Kein Seitenwechsel für kleine Änderungen | Mittel | ✅ Ja |
| Kontext-Aktionen (Rechtsklick) | Rechtsklick → Klonen, Archivieren, Exportieren | Schnellerer Zugriff auf Aktionen | Klein | ✅ Ja |
| Drag & Drop Sortierung | Produkte manuell sortieren/priorisieren | Eigene Bearbeitungsreihenfolge | Klein | Später |
| Statusleiste (Footer) | "42 aktiv · 3 Fehler · Export: vor 2h" | Immer im Blick ohne Dashboard | Klein | ✅ Ja |

---

## Konsistenz & Qualität

| Idee | Beschreibung | Nutzen | Aufwand | Sinnvoll? |
|------|-------------|--------|---------|-----------|
| Attribut-Konsistenz-Check | "Schwarz" vs "schwarz" vs "SCHWARZ" finden | Normalisierte Daten, sauberere Exporte | Klein | ✅ Ja |
| Regex-Suche | Reguläre Ausdrücke über alle Felder | Komplexe Muster finden | Klein | Später |
| Pflichtfeld-Matrix | Welche Felder fehlen bei welchen Produkten (Kreuztabelle) | Gezielte Nacharbeit | Klein | ✅ Ja |
| Auto-Korrektur Vorschläge | "Meinten Sie Silikon statt Silokon?" | Weniger Datenmüll | Mittel | Später |

---

> [!tip] Top 3 Empfehlungen
> 1. **KI-Produktbeschreibungen** — ContentEditPage + HtmlEditor existieren, ein LLM-Call reicht
> 2. **Clipboard-Import** — Minimaler Aufwand, riesiger Komfort
> 3. **Attribut-Konsistenz-Check** — Eine SQL-Query findet inkonsistente Schreibweisen