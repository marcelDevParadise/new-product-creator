# Projekterweiterungen

## Ziel dieses Dokuments

Diese Sammlung bündelt mögliche Erweiterungen für den **Attribut Generator** und priorisiert sie grob nach Nutzen, Umsetzungsaufwand und strategischem Mehrwert.  
Die Vorschläge sind so formuliert, dass sie direkt als Grundlage für Claude Code, Ticket-Planung oder eine technische Roadmap verwendet werden können.

---

## Ausgangslage

Das bestehende Projekt deckt bereits viele Kernprozesse sauber ab:

- CSV-Import
- Produkt- und Stammdatenverwaltung
- Attribut-Definitionen und Zuweisungen
- Smart Defaults
- Vorlagen
- Export-Vorschau und Validierung
- JTL-Ameise-Export
- Dashboard und Aktivitätslog

Damit ist eine solide operative Basis vorhanden. Die nächsten Erweiterungen sollten vor allem eines leisten:

1. **manuelle Arbeit reduzieren**
2. **Datenqualität erhöhen**
3. **Skalierung für mehr Produkte / mehr Nutzer ermöglichen**
4. **Export- und Shopify-Prozesse robuster machen**
5. **das System langfristig modularer und intelligenter machen**

---

## 1. Höchste Priorität: Funktionen mit direktem Alltagsnutzen

## 1.1 ✅ Erweiterte Validierung / Datenqualitätsprüfung

### Ziel
Nicht nur fehlende Pflichtattribute erkennen, sondern echte Datenfehler und Inkonsistenzen frühzeitig sichtbar machen.

### Mögliche Prüfungen
- doppelte EANs
- ungültige oder leere Bild-URLs
- unrealistische Maße oder Gewichte
- fehlende Herstellerangaben
- fehlende oder unvollständige Kategoriepfade
- inkonsistente Attributwerte
- falsche Formatierungen bei numerischen Feldern
- unlogische Kombinationen von Produkttyp und Attributen
- fehlende Angaben für grundpreispflichtige Produkte
- Produkte mit zu wenig Bildmaterial
- Produkte ohne Lieferantendaten
- Produkte mit leerem oder zu kurzem Artikelnamen

### Erweiterungsideen
- Validierungsstatus pro Produkt
- Ampelsystem: OK / Warnung / Fehler
- eigene Seite „Datenqualität“
- Filter „nur fehlerhafte Produkte“
- Exportblocker bei kritischen Fehlern
- Warnungen statt Blocker bei weichen Regeln

### Technische Ansätze
- dedizierter Validation-Service im Backend
- standardisierte Rule-Objekte
- Validierung sowohl beim Speichern als auch beim Export
- Ergebnisstruktur mit `severity`, `field`, `message`, `suggested_fix`

---

## 1.2 Regel-Engine für automatische Attributzuweisung

### Ziel
Die heutige Smart-Default-Logik zu einem flexiblen Regelwerk ausbauen.

### Beispielregeln
- Wenn `artikelname` enthält „Silikon“, dann `Material = Silikon`
- Wenn `kategorie_1 = Toys`, dann setze Basisattribute A, B, C
- Wenn `hersteller = Marke X`, dann `Marke = X`
- Wenn `gewicht > 1000`, dann `Versandgewicht` automatisch setzen
- Wenn `Produkttyp = Vibrator`, dann Pflichtattribute für diesen Typ aktivieren

### Erweiterungen
- mehrere Bedingungen pro Regel
- Prioritäten und Überschreiblogik
- Vorschau „welche Regeln würden greifen?“
- Regeltest mit Beispieldaten
- Dry-Run vor Anwendung auf viele Produkte
- Regelbibliothek nach Produkttyp

### Technischer Vorschlag
Ein kleines DSL / JSON-Format für Regeln:

```json
{
  "name": "Material aus Titel",
  "conditions": [
    { "field": "artikelname", "operator": "contains", "value": "silikon" }
  ],
  "actions": [
    { "field": "attributes.material", "value": "Silikon" }
  ],
  "priority": 10,
  "enabled": true
}
```

---

## 1.3 ✅ Bulk-Stammdatenbearbeitung

### Ziel
Nicht nur Attribute, sondern auch Stammdaten gesammelt ändern können.

### Sinnvolle Bulk-Felder
- Hersteller
- Lieferant
- Kategorien
- Maße
- Grundpreis-Felder
- Bilder zurücksetzen / ergänzen
- Export-Status / Archiv-Status
- EAN-Felder
- Preisfelder
- Versandgewicht

### Sinnvolle Bulk-Aktionen
- Wert setzen
- Wert löschen
- Wert ersetzen
- Prefix / Suffix anhängen
- numerische Felder prozentual anpassen
- Kategoriepfad aus Vorlage übernehmen
- Bilder aus CSV-Mapping ergänzen

### UX-Ideen
- Bulk-Modal mit Feldwahl
- Sicherheitsvorschau: „X Produkte werden geändert“
- Änderungsprotokoll
- Undo für letzte Bulk-Aktion

---

## 1.4 Variantenlogik

### Ziel
Parent-/Child-Produkte oder Varianten sauber abbilden.

### Mögliche Variantenachsen
- Größe
- Farbe
- Material
- Länge
- Härtegrad
- Ausführung

### Nutzen
- gemeinsame Stammdaten auf Parent-Ebene
- variantenspezifische Werte auf Child-Ebene
- sauberere Exporte
- deutlich bessere Skalierung im Produktmanagement

### Denkbare Datenstruktur
- `parent_sku`
- `is_variant_parent`
- `variant_group`
- `variant_attributes`
- gemeinsame Bilder / gemeinsame Beschreibungslogik
- variantenspezifische EANs und Preise

### Zusätzliche Features
- Variantenmatrix
- Massenbearbeitung innerhalb einer Variantengruppe
- gemeinsame Attributvererbung
- Sichtprüfung „welche Werte weichen vom Parent ab?“

---

## 1.5 ✅ Gespeicherte Filter und Arbeitsansichten

### Ziel
Wiederkehrende Arbeitszustände schneller erreichbar machen.

### Beispiele
- Unvollständige Produkte
- Produkte ohne Bilder
- Produkte ohne EAN
- Exportbereit
- Archiviert
- GPSR prüfen
- Neue Produkte
- Produkte mit Warnungen
- Produkte ohne Kategorie
- Produkte mit fehlenden Pflichtattributen

### Zusatzideen
- persönliche Standardansicht
- gemeinsame Team-Ansichten
- sortierte Warteschlangen für Redaktionsarbeit

---

## 2. Produktivität und Workflow

## 2.1 Aufgaben- und Freigabesystem

### Ziel
Produkte durch definierte Bearbeitungsstufen bewegen.

### Beispielstatus
- importiert
- in Bearbeitung
- Daten fehlen
- bereit zur Prüfung
- freigegeben
- exportiert
- archiviert

### Erweiterungen
- Verantwortliche Person pro Produkt
- interne Notizen
- To-do-Kommentare
- Review-Funktion
- Freigabeprozess vor Export

---

## 2.2 ✅ Produktbezogene Änderungshistorie

### Ziel
Nachvollziehen können, wer wann was geändert hat.

### Sinnvolle Historien-Einträge
- Feld vorher / nachher
- Attribut hinzugefügt / entfernt
- Bulk-Aktion durchgeführt
- Export ausgelöst
- Archivierung / Wiederherstellung
- Vorlage angewendet
- Regel-Engine angewendet

### Erweiterungen
- Vergleichsansicht
- Wiederherstellung älterer Werte
- Audit-Log für sensible Änderungen

---

## 2.3 Notizen, Kommentare und interne Hinweise

### Ziel
Produktwissen direkt am Datensatz sammeln.

### Beispiele
- „EAN noch prüfen“
- „Bildmaterial vom Lieferanten fehlt“
- „Attributwert mit Hersteller abklären“
- „Nicht exportieren bis Freigabe“

### Erweiterungen
- private vs. globale Notizen
- Erwähnungen bei Mehrbenutzerbetrieb
- Notizen mit Status / Priorität

---

## 2.4 Undo / Wiederherstellung für kritische Aktionen

### Ziel
Fehler bei Bulk-Aktionen oder Löschungen schnell rückgängig machen.

### Sinnvolle Kandidaten
- Bulk-Attribut-Updates
- Bulk-Stammdatenänderungen
- Archivierung
- Vorlagen-Anwendung
- Import-Merge
- Löschaktionen

---

## 2.5 ✅ Import-Center mit Fehlerreport

### Ziel
CSV-Import robuster und transparenter machen.

### Erweiterungen
- Import-Mapping speichern
- Feldzuordnung per UI
- Preview mit Konflikterkennung
- Fehlerreport zum Download
- Teilimporte erlauben
- „nur neue Produkte importieren“
- „nur bestehende Produkte aktualisieren“
- Import-Regeln pro Quelle speichern

---

## 2.6 Duplikat-Erkennung

### Ziel
Beim Import und beim manuellen Anlegen frühzeitig auf mögliche Duplikate hinweisen.

### Prüfungen
- gleiche oder ähnliche Artikelnamen (Fuzzy-Matching)
- identische EANs
- gleiche Bild-URLs bei unterschiedlichen Artikelnummern
- sehr ähnliche Kombination aus Hersteller + Artikelname

### UX-Ideen
- Warnung im Import-Report: „X mögliche Duplikate gefunden"
- Duplikat-Prüfung auf Datenqualitäts-Seite
- Zusammenführungs-Assistent (Merge)

---

## 2.7 CSV-Spalten-Mapping

### Ziel
Beim Import beliebige CSV-Formate unterstützen, indem der Nutzer selbst zuordnet welche Spalte zu welchem Feld gehört.

### Features
- Spalten-Mapping per Drag & Drop oder Dropdown
- Mapping-Vorlage speichern und wiederverwenden
- Vorschau der gemappten Daten vor Import
- Automatische Erkennung bekannter Spaltenbezeichnungen
- Unterstützung für verschiedene Trennzeichen (Semikolon, Komma, Tab)

---

## 2.8 Daten-Vergleich

### Ziel
Zwei Produkte oder Import-Daten vs. bestehende Daten nebeneinander vergleichen.

### Einsatzgebiete
- Diff-Ansicht bei CSV-Import: Was ändert sich?
- Zwei Produkte vergleichen (z.B. bei Duplikatverdacht)
- Vorher/Nachher-Vergleich bei Bulk-Aktionen
- Soll/Ist-Abgleich mit Lieferantendaten

### UX-Ideen
- Side-by-Side-Ansicht mit farblicher Hervorhebung der Unterschiede
- Felder filtern: nur Abweichungen anzeigen
- Übernahme einzelner Werte per Klick

---

## 3. Datenmodell und Fachlogik

## 3.1 Attribut-Abhängigkeiten

### Ziel
Bestimmte Attribute nur dann verlangen oder anzeigen, wenn andere Werte gesetzt sind.

### Beispiele
- Wenn Produkttyp = Vibrator, dann Felder X, Y, Z einblenden
- Wenn Grundpreis ausweisen = true, dann Bezugsmenge verpflichtend
- Wenn Material = Glas, dann Temperaturspiel standardmäßig anbieten

### Nutzen
- weniger UI-Überladung
- bessere Datenqualität
- kontextbezogene Formulare

---

## 3.2 Attributsets / Produkttyp-Profile

### Ziel
Vordefinierte Attributgruppen nach Produkttyp bereitstellen.

### Beispiele
- Dildo
- Vibrator
- Masturbator
- Pflegeprodukt
- Zubehör
- Geschenkartikel

### Nutzen
- schnellere Pflege
- einheitliche Datenstruktur
- bessere Validierbarkeit

---

## 3.3 Vererbungslogik für Defaultwerte

### Ziel
Werte aus verschiedenen Ebenen intelligent ableiten.

### Denkbare Ebenen
- globaler Default
- Default pro Kategorie
- Default pro Produkttyp
- Default pro Hersteller
- Regel-Engine
- individueller Produktwert

### Wichtig
Die Prioritäten sollten klar definiert sein, damit nachvollziehbar bleibt, warum ein Wert gesetzt wurde.

---

## 3.4 Referenzdaten / Lookup-Tabellen

### Ziel
Frei eingetippte Werte reduzieren.

### Beispiele
- Herstellerliste
- Lieferantenliste
- Materialliste
- Produkttypen
- Farben
- Maßeinheiten
- Kategoriebäume

### Nutzen
- sauberere Daten
- weniger Tippfehler
- bessere Filterbarkeit

---

## 4. Shopify-, Export- und Integrationsausbau

## 4.1 Shopify-Direktsync

### Ziel
Nicht nur CSV exportieren, sondern Daten direkt nach Shopify synchronisieren.

### Denkbare Sync-Arten
- Metafields
- Produktdaten
- Bilder
- Tags
- Collections
- SEO-Felder

### Vorteile
- weniger Zwischenschritte
- geringere Fehleranfälligkeit
- schnellere Veröffentlichungsprozesse

### Technische Überlegungen
- Mapping-Schicht zwischen internen Feldern und Shopify
- Sync-Queue
- Retry-Mechanismus
- Fehlerprotokoll
- Dry-Run-Sync

---

## 4.2 Export-Profile

### Ziel
Mehrere Exportformate bzw. Exportkonfigurationen verwalten können.

### Beispiele
- JTL-Ameise
- interner Stammdatenexport
- Lieferantenexport
- Qualitätssicherungsreport
- Shopify-API-Sync-Export
- CSV für Fremdsysteme

### Erweiterungen
- Feldmapping je Profil
- Profile speichern
- aktivierbare Pflichtfelder je Profil
- Exportvorschau je Profil

---

## 4.3 Delta-Export / Nur geänderte Produkte exportieren

### Ziel
Nur Produkte exportieren, die seit dem letzten Lauf geändert wurden.

### Vorteile
- spart Zeit
- kleinere Exporte
- klarere Änderungsprozesse

### Voraussetzung
- `updated_at`
- `last_exported_at`
- optional Hash / Änderungskennung je Produkt

---

## 4.4 Export-Jobs und Export-Historie

### Ziel
Transparente Nachvollziehbarkeit aller Exporte.

### Erweiterungen
- Exporthistorie mit Timestamp
- Anzahl Produkte
- Anzahl Fehler / Warnungen
- Nutzer
- Exportdatei erneut herunterladen
- Vergleich zweier Exporte

---

## 4.5 Lieferanten-Schnittstellen

### Ziel
Produktdaten nicht nur per CSV, sondern auch aus wiederkehrenden Quellen beziehen.

### Denkbare Anbindungen
- FTP / SFTP CSV-Abholung
- API-Import
- XML / JSON-Feeds
- definierte Mapping-Profile pro Lieferant

---

## 4.6 ✅ SEO & Content Export

### Ziel
SEO-relevante Produktdaten (Kurzbeschreibung, Beschreibung, URL-Pfad, Title Tag, Meta-Description) als Stammdaten pflegen und als eigenen CSV-Export bereitstellen.

### Umgesetzte Features
- 5 neue Stammdaten-Felder: `kurzbeschreibung`, `beschreibung`, `url_pfad`, `title_tag`, `meta_description`
- SEO & Content Sektion im Stammdaten-Editor mit Zeichenzähler (Title ≤60, Meta ≤155)
- Neuer Export-Typ: SEO & Content CSV (Vorschau + Download)
- Export-Spalten: Artikelnummer, Artikelname, Kurzbeschreibung, Beschreibung, URL-Pfad, Title Tag, Meta-Description
- Bulk-Stammdaten-Bearbeitung unterstützt die neuen Felder

---

## 4.7 Shopify-Metafield-Mapping

### Ziel
Attribute direkt auf Shopify-Metafield-Definitionen mappen, sodass Exporte nahtlos in Shopify importiert werden können.

### Features
- Mapping-Tabelle: Attribut-Key → Shopify-Metafield-Namespace + Key
- Unterstützung für verschiedene Metafield-Typen (single_line_text_field, number_integer, boolean, etc.)
- Validierung der Werte gegen Shopify-Typen
- Export im Shopify-kompatiblen CSV- oder JSON-Format
- Vorschau der gemappten Werte vor Export

### Erweiterungen
- Shopify-Produkttyp → Attributset-Zuordnung
- Automatische Konvertierung von Einheiten und Formaten

---

## 4.8 API-Webhooks

### Ziel
Bei Produktänderungen externe Systeme automatisch benachrichtigen.

### Auslöser
- Produkt erstellt / geändert / gelöscht
- Stammdaten aktualisiert
- Attribute geändert
- Export ausgelöst
- Bulk-Aktion durchgeführt

### Features
- Webhook-URL + Secret pro Endpunkt konfigurieren
- Retry-Logik bei Fehlern (3 Versuche, exponentielles Backoff)
- Webhook-Log: welche Events wann an wen gesendet wurden
- Filterbare Events (nur bestimmte Event-Typen)

---

## 5. UI- und UX-Verbesserungen

## 5.1 ✅ Medien-Management mit Vorschaubildern

### Ziel
Bildpflege deutlich komfortabler machen.

### Erweiterungen
- Thumbnail-Vorschau
- Drag & Drop-Sortierung
- Prüfung der Bild-URLs
- Markierung des Hauptbilds
- Bild-Status (OK / Fehler)
- Alt-Text / Dateiname / Herkunft pflegen

---

## 5.2 Schnellbearbeitung direkt in Tabellen

### Ziel
Weniger Seitenwechsel, schnellere Bearbeitung.

### Einsatzgebiete
- Hersteller
- Preise
- EAN
- Kategorien
- einzelne Attribute
- Statusfelder

---

## 5.3 Tastaturfreundliche Power-User-Workflows

### Ideen
- Slash-Command-Palette
- globale Suche
- Shortcuts für Speichern / Nächster Datensatz / Filtern
- schnelle Massenaktionen per Tastatur

---

## 5.4 Verbesserte Dashboard-Ansichten

### Zusätzliche KPI-Ideen
- Produkte mit Fehlern
- Produkte ohne Bilder
- Exporte heute / diese Woche
- Top-Fehlerarten
- Attributnutzung je Kategorie
- Produkte pro Bearbeitungsstatus
- zuletzt geänderte Produkte

---

## 5.5 Konfigurierbare Tabellenansichten

### Ziel
Jede Tabelle an den Arbeitsstil anpassen.

### Features
- Spalten ein-/ausblenden
- Spaltenbreiten speichern
- Sortierung speichern
- Gruppierung
- CSV-Download der aktuellen Ansicht

---

## 5.6 Globale Suche

### Ziel
Über alle Bereiche hinweg suchen — Produkte, Attribute, Templates, Aktivitäten.

### Features
- Suchleiste in der Sidebar oder als Overlay (Ctrl+K)
- Ergebnisse gruppiert nach Typ (Produkt, Attribut, Template, Log)
- Schnellnavigation zum Treffer
- Letzte Suchen merken
- Fuzzy-Matching für Tippfehler

---

## 5.7 Dark Mode

### Ziel
Optionales dunkles Farbschema für komfortableres Arbeiten bei wenig Licht.

### Umsetzung
- Tailwind CSS `dark:`-Varianten für alle Komponenten
- Toggle in den Einstellungen oder Sidebar
- Präferenz speichern (localStorage)
- System-Präferenz respektieren (prefers-color-scheme)

---

## 5.8 Druckansicht / PDF-Export

### Ziel
Produktdatenblätter als PDF generieren für interne Dokumentation, Lieferanten oder Freigabeprozesse.

### Features
- Einzelprodukt als PDF (Stammdaten + Attribute + Bilder)
- Produktliste als PDF (kompakte Übersicht)
- Konfigurierbare Felder: welche Daten sollen auf dem Datenblatt erscheinen
- Firmenlogo / Header anpassbar
- Batch-PDF für mehrere Produkte

---

## 6. Teamfähigkeit und Rechte

## 6.1 Benutzerverwaltung und Rollen

### Rollenbeispiele
- Admin
- Redaktion
- Stammdatenpflege
- Qualitätssicherung
- Export-Freigabe
- Read-Only

### Rechtebeispiele
- Produkte ansehen
- Produkte bearbeiten
- Attribute ändern
- Exporte ausführen
- Einstellungen ändern
- Vorlagen verwalten
- Regeln verwalten

---

## 6.2 Verantwortlichkeiten / Ownership

### Ziel
Produkte oder Aufgaben bestimmten Personen zuweisen.

### Beispiele
- zuständige Person
- Prüfer
- letzter Bearbeiter
- Eskalationsstatus

---

## 6.3 Benachrichtigungen

### Mögliche Trigger
- Import fehlgeschlagen
- Export mit Fehlern
- Produkt freigegeben
- Pflichtdaten fehlen
- Review angefordert
- Regelkonflikt erkannt

---

## 7. Reporting, Analyse und Transparenz

## 7.1 Datenqualitäts-Dashboard

### Ziel
Nicht nur operative Bearbeitung, sondern aktive Qualitätssteuerung.

### Metriken
- Fehlerquote je Kategorie
- fehlende Pflichtfelder
- Bildabdeckung
- EAN-Abdeckung
- Attributvollständigkeit
- Produkte ohne Lieferant
- Trend über Zeit

---

## 7.2 Änderungs- und Performance-Reporting

### Mögliche Fragen
- Wie viele Produkte wurden diese Woche vervollständigt?
- Welche Felder verursachen die meisten Fehler?
- Welche Regeln sparen am meisten manuelle Arbeit?
- Wo treten die meisten Importe-Probleme auf?

---

## 7.3 Health-Monitoring für Integrationen

### Ziel
Schnittstellen und Exporte besser überwachen.

### Beispiele
- letzter erfolgreicher Export
- letzte Fehlerursache
- API-Limits
- Queue-Status
- offene Konflikte

---

## 8. Intelligenz / Assistenzfunktionen

## 8.1 Attributvorschläge aus Produktdaten

### Ziel
Auf Basis von Artikelnamen, Kategorien, Herstellerdaten und vorhandenen Mustern Vorschläge machen.

### Denkbare Vorschläge
- Material
- Farbe
- Produkttyp
- Länge / Größe
- geeignete Materialien
- Textbausteine

### Hinweis
Das kann zuerst regelbasiert starten und später um KI ergänzt werden.

---

## 8.2 Auto-Kategorisierung

### Ziel
Produkte automatisch in vorgeschlagene Kategorien einordnen.

### Varianten
- regelbasiert
- keywordbasiert
- embedding- oder KI-basiert

---

## 8.3 Anomalie-Erkennung

### Beispiele
- Preis weicht stark von ähnlichen Produkten ab
- Gewicht unrealistisch hoch / niedrig
- Produktname passt nicht zu Produkttyp
- Variante hat untypische Maße

---

## 8.4 Textgeneratoren / Content-Helfer

### Einsatzfelder
- Produkttitel normalisieren
- Kurztexte generieren
- Meta-Titel / Meta-Description vorbereiten
- Standardtexte für Eigenschaften

### Wichtig
Nur als Unterstützung, nicht als Ersatz für redaktionelle Prüfung.

---

## 8.5 Mehrsprachigkeit / Multi-Language-Support

### Ziel
Produkttexte in mehreren Sprachen verwalten (z.B. DE, EN, FR) für internationale Shops.

### Datenmodell
- Sprachvarianten pro Textfeld (artikelname, kurzbeschreibung, beschreibung, title_tag, meta_description)
- Primärsprache + beliebig viele Übersetzungen
- Übersetzungsstatus pro Feld: leer / übersetzt / veraltet

### Features
- Sprachauswahl im Editor (Tab oder Dropdown)
- Übersetzungs-Fortschritt pro Produkt und global
- Export pro Sprache oder alle Sprachen in einer Datei
- KI-gestützte Übersetzungsvorschläge (optional)

---

## 9. Architektur und technische Skalierung

## 9.1 Wechsel von SQLite auf PostgreSQL

### Warum sinnvoll
SQLite ist für den Start stark, aber bei Mehrbenutzerbetrieb, wachsender Datenmenge und komplexeren Filtern / Reports stößt es perspektivisch an Grenzen.

### Vorteile von PostgreSQL
- bessere Parallelität
- stärkere Abfrageoptionen
- robustere Skalierung
- einfachere spätere Integrationen

---

## 9.2 Hintergrundjobs

### Kandidaten
- große CSV-Importe
- Validierungsläufe
- Regel-Anwendung
- Shopify-Sync
- Exportjobs
- Massenänderungen

### Vorteile
- bessere Nutzererfahrung
- Fortschrittsanzeige
- Retry-Möglichkeiten
- Fehlerreports

---

## 9.3 Service-Schicht stärker modularisieren

### Mögliche Module
- validation service
- rules engine
- export service
- sync service
- audit service
- import service
- media service

---

## 9.4 API-Versionierung

### Ziel
Spätere Erweiterungen sauber einführen.

### Beispiel
- `/api/v1/...`
- spätere Breaking Changes besser handhabbar

---

## 9.5 Teststrategie ausbauen

### Wichtige Testarten
- Unit-Tests für Regel-Engine
- Integrations-Tests für Export
- Import-Tests mit Edge Cases
- UI-Tests für Bulk-Aktionen
- Regression-Tests für Mapping-Logik

---

## 10. Sicherheit, Stabilität, Betrieb

## 10.1 Backup- und Restore-Funktionen

### Ziel
Datenverlust vermeiden und Wiederherstellung vereinfachen.

### Ideen
- manuelles DB-Backup
- Export aller Konfigurationen
- Restore-Assistent
- Snapshot vor kritischen Bulk-Aktionen

---

## 10.2 Error-Tracking und Logging verbessern

### Erweiterungen
- strukturierte Fehlerlogs
- Request-ID
- bessere Backend-Exceptions
- Frontend-Fehlerdialoge mit mehr Kontext

---

## 10.3 Konfigurationsverwaltung

### Ziel
Nicht alles hart in JSON-Dateien halten.

### Denkbare Schritte
- Admin-Oberfläche für Konfigurationen
- versionierte Settings
- Import / Export von Regeln, Attributen, Profilen

---

## 10.4 Performance-Optimierung

### Ansatzpunkte
- serverseitige Pagination
- Caching für Stats
- selektive Neuberechnung
- optimierte Tabellenrendering im Frontend
- Suche / Filter auf DB-Ebene

---

## 11. Konkrete Roadmap-Vorschläge

## Phase 1 — Schnell umsetzbar, hoher Nutzen
- ✅ erweiterte Validierung
- ✅ Bulk-Stammdatenbearbeitung
- ✅ gespeicherte Filter
- ✅ Medienvorschau
- ✅ produktbezogene Historie
- ✅ Import-Fehlerreport

## Phase 2 — Strukturelle Verbesserung
- Regel-Engine
- Attribut-Abhängigkeiten
- Attributsets / Produkttyp-Profile
- Export-Profile
- Delta-Export
- Benutzerrollen
- Duplikat-Erkennung
- CSV-Spalten-Mapping
- Globale Suche
- Shopify-Metafield-Mapping

## Phase 3 — Strategischer Ausbau
- Variantenlogik
- Shopify-Direktsync
- Hintergrundjobs
- PostgreSQL-Migration
- Assistenzfunktionen / Vorschläge / Anomalie-Erkennung
- Mehrsprachigkeit
- API-Webhooks
- Daten-Vergleich
- Druckansicht / PDF-Export
- Dark Mode

---

## 12. Besonders empfehlenswerte nächste 10 Schritte

1. ✅ Erweiterte Validierungsregeln einführen  
2. ✅ Eigene Datenqualitätsansicht bauen  
3. ✅ Bulk-Stammdatenbearbeitung ergänzen  
4. ✅ Produkt-Historie / Audit-Log pro Datensatz einbauen  
5. ✅ Medien-Handling mit Bildvorschau verbessern  
6. ✅ Gespeicherte Filter und Arbeitsansichten ergänzen  
7. Regel-Engine als Nachfolger von Smart Defaults planen  
8. Export-Historie und Delta-Export ergänzen  
9. Attribut-Abhängigkeiten und Produkttyp-Profile einführen  
10. Variantenmodell für spätere Shopify-/E-Commerce-Skalierung vorbereiten  

---

## 13. Optionaler Fokus für Claude Code

Falls dieses Dokument direkt als Arbeitsgrundlage für Claude Code genutzt werden soll, wäre folgende Reihenfolge besonders praktikabel:

### Fokus A — Operative Entlastung
- ✅ Bulk-Stammdatenbearbeitung
- ✅ gespeicherte Filter
- ✅ Medienvorschau
- ✅ Import-Fehlerreport

### Fokus B — Datenqualität
- ✅ Validierungs-Engine
- ✅ Datenqualitäts-Dashboard
- Attribut-Abhängigkeiten
- ✅ Audit-Log

### Fokus C — Strategischer Ausbau
- Regel-Engine
- Variantenlogik
- Export-Profile
- Shopify-Sync-Vorbereitung

### Fokus D — Neue Erweiterungen (2026-04)
- Duplikat-Erkennung
- CSV-Spalten-Mapping
- Daten-Vergleich
- Shopify-Metafield-Mapping
- API-Webhooks
- Globale Suche
- Dark Mode
- Druckansicht / PDF-Export
- Mehrsprachigkeit

---

## 14. Abschluss

Das Projekt ist bereits auf einem guten Fundament aufgebaut. Der größte Hebel liegt jetzt nicht mehr im bloßen Ergänzen einzelner CRUD-Funktionen, sondern in drei Richtungen:

- **Automatisierung**
- **Qualitätssicherung**
- **Skalierbarkeit**

Wenn die nächsten Schritte klug priorisiert werden, kann aus dem aktuellen Tool sehr gut ein zentrales Produktdaten- und Attributmanagement-System für E-Commerce entstehen.
