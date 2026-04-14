# Feature-Ideen — 2026-04-15

> Keine Duplikate zu `2025-07-13_feature-ideen.md` oder `Projekterweiterungen.md`.

## KI & Intelligente Automatisierung

| Idee | Beschreibung | Nutzen | Aufwand | Aktuell sinnvoll? |
|------|-------------|--------|---------|-------------------|
| KI-Produktbeschreibungen | Kurz- und Langbeschreibung per LLM aus Produktname + Attributen generieren | Spart 5–10 Min pro Produkt; konsistenter Schreibstil | Mittel | ✅ Ja — HtmlEditor + ContentEditPage existieren, API-Call zu OpenAI/Ollama reicht |
| KI-Kategorievorschlag | Kategorie automatisch aus Produktname + Hersteller ableiten | Weniger manuelle Zuordnung, weniger Fehlkategorisierungen | Klein | ✅ Ja — Kategorie-Baum existiert, Pattern-Matching oder Embedding-Lookup |
| KI-SEO-Optimierung | Title-Tag und Meta-Description aus Produktdaten generieren lassen | SEO-Felder sind oft leer — automatisches Befüllen spart Zeit | Klein | ✅ Ja — SEO-Felder existieren, gleicher LLM-Ansatz wie Beschreibungen |
| Attribut-Wert-Extraktion | Aus Produktname automatisch Werte erkennen (Farbe, Material, Größe) | Spart manuelles Zuweisen bei >80% der Produkte | Mittel | Später — Smart Defaults decken einfache Fälle ab, NLP wäre der nächste Schritt |
| Anomalie-Erkennung | Ungewöhnliche Werte markieren (z.B. Gewicht 0.001 kg, EK 0€, Preis 9999€) | Datenfehler automatisch finden statt manuell prüfen | Klein | ✅ Ja — einfache Heuristiken im Validation-Service |

## Datenmanagement & Import

| Idee | Beschreibung | Nutzen | Aufwand | Aktuell sinnvoll? |
|------|-------------|--------|---------|-------------------|
| Clipboard-Import | Direkt aus Excel/Google Sheets einfügen (Ctrl+V in Import-Seite) | Kein Umweg über CSV-Datei speichern | Klein | ✅ Ja — Clipboard API + Tab-Separator parsen, wenig Code |
| Import-Diff-Vorschau | Vor dem Import anzeigen: welche Felder ändern sich bei bestehenden Produkten | Keine versehentlichen Überschreibungen mehr | Mittel | ✅ Ja — Merge-Logik existiert, braucht nur Vergleichs-UI |
| Auto-Backup vor Bulk-Ops | Automatischer DB-Snapshot vor Import, Bulk-Änderung, Template-Apply | Schnelles Rollback bei Fehlern, Sicherheitsnetz | Klein | ✅ Ja — SQLite-Datei kopieren reicht, kein komplexes System nötig |
| Wiederkehrender Import | Import-Quelle + Mapping speichern, mit einem Klick erneut ausführen | Spart 5 Min bei jedem Lieferanten-Update | Mittel | Später — braucht gespeicherte Mappings (Projekterw. 2.7) als Basis |
| Produkt-Merge-Assistent | Bei Duplikaten: Felder aus beiden Produkten in einem Dialog zusammenführen | Saubere Datenbasis statt manuelles Kopieren zwischen Produkten | Mittel | Später — Duplikat-Erkennung muss erst implementiert sein |

## Analyse & Reporting

| Idee | Beschreibung | Nutzen | Aufwand | Aktuell sinnvoll? |
|------|-------------|--------|---------|-------------------|
| Attribut-Nutzungsbericht | Übersicht: welches Attribut ist bei wie vielen Produkten gesetzt | Tote Attribute identifizieren, Pflichtfelder-Entscheidungen treffen | Klein | ✅ Ja — ein SQL-Query + kleines Dashboard-Widget |
| Preisverlauf pro Produkt | EK/VK-Änderungen über Zeit als Sparkline oder Chart | Preisänderungen nachvollziehen, Margenentwicklung sehen | Mittel | Später — braucht historische Preisdaten, derzeit nur aktueller Stand gespeichert |
| Sortiment-Matrix | Raster: Kategorien × Hersteller → Anzahl Produkte pro Zelle | Lücken im Sortiment auf einen Blick erkennen | Klein | ✅ Ja — reine DB-Aggregation + HTML-Tabelle |
| Export-Changelog | Automatisch generierte Änderungsübersicht: was war im letzten Export neu/geändert | Nachvollziehbar was an den Shop gesendet wurde | Mittel | Später — braucht Snapshot-Vergleich zwischen Exporten |
| Vollständigkeits-Trend | Chart: Datenvollständigkeit über Zeit (täglich/wöchentlich) | Fortschritt sichtbar machen, Motivation im Team | Mittel | Später — braucht regelmäßig gespeicherte Snapshots |

## UX & Produktivität

| Idee | Beschreibung | Nutzen | Aufwand | Aktuell sinnvoll? |
|------|-------------|--------|---------|-------------------|
| Multi-Tab Bearbeitung | Mehrere Produkte gleichzeitig in Tabs öffnen, schnell wechseln | Vergleichen und parallel bearbeiten ohne ständiges Navigieren | Mittel | Später — braucht Tab-Management-State, Routing-Anpassung |
| Bookmark/Favoriten | Produkte als Favorit markieren, eigene Schnellzugriff-Liste | Häufig bearbeitete Produkte sofort finden | Klein | ✅ Ja — ein Flag in der DB + Filter in der Sidebar |
| Inline-Edit in Tabellen | Einzelne Zellen direkt in der Übersichtstabelle bearbeiten (Doppelklick) | Kein Seitenwechsel für kleine Änderungen (EAN, Preis, Hersteller) | Mittel | ✅ Ja — Großer Produktivitätsgewinn, schrittweise umsetzbar |
| Kontext-Aktionen (Rechtsklick) | Rechtsklick auf Produkt → Klonen, Archivieren, Exportieren, Bearbeiten | Schnellerer Zugriff auf häufige Aktionen | Klein | ✅ Ja — Kontextmenü-Komponente + bestehende API-Calls |
| Drag & Drop Sortierung (Produktliste) | Produkte per Drag & Drop manuell sortieren / priorisieren | Eigene Bearbeitungsreihenfolge festlegen | Klein | Später — @dnd-kit ist schon dabei, aber braucht Sort-Persistenz |
| Statusleiste (Footer) | Fixierte Leiste unten: "42 Produkte aktiv · 3 Fehler · Letzter Export: vor 2h" | Immer im Blick was los ist, ohne zum Dashboard zu navigieren | Klein | ✅ Ja — Stats-API existiert, reine Frontend-Komponente |

## Konsistenz & Qualität

| Idee | Beschreibung | Nutzen | Aufwand | Aktuell sinnvoll? |
|------|-------------|--------|---------|-------------------|
| Attribut-Konsistenz-Check | Finden: "Schwarz" vs "schwarz" vs "SCHWARZ" beim gleichen Attribut | Normalisierte Daten, sauberere Exporte | Klein | ✅ Ja — Gruppierte DB-Query auf Attributwerte |
| Regex-Suche | Power-Suche mit regulären Ausdrücken über alle Felder | Komplexe Muster finden (z.B. alle EANs die mit 40 beginnen) | Klein | Später — Standard-Suche reicht meist, nützlich für Power-User |
| Pflichtfeld-Matrix | Übersicht: welche Felder fehlen bei welchen Produkten (Kreuztabelle) | Gezielte Nacharbeit statt Produkt für Produkt durchgehen | Klein | ✅ Ja — Validation-Daten existieren, braucht nur Pivot-Darstellung |
| Auto-Korrektur Vorschläge | Bei Tippfehlern in Attributwerten: "Meinten Sie Silikon statt Silokon?" | Weniger Datenmüll, höhere Konsistenz | Mittel | Später — braucht Ähnlichkeitsvergleich (Levenshtein) gegen bestehende Werte |

---

## Top-3-Empfehlungen für sofortige Umsetzung

1. **KI-Produktbeschreibungen** — ContentEditPage + HtmlEditor existieren. Ein LLM-Call generiert aus Produktname + Attributen sofort brauchbare Texte. Größter Zeitgewinn pro Feature.
2. **Clipboard-Import** — Minimaler Aufwand (Tab-separated Paste parsen), riesiger Komfort. Kein CSV-Speichern mehr nötig.
3. **Attribut-Konsistenz-Check** — Eine SQL-Query findet inkonsistente Schreibweisen. Sofort sauberere Daten ohne manuelles Durchforsten.
