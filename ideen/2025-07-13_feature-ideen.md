# Feature-Ideen — 2025-07-13

## Daten & Automatisierung

| Idee | Beschreibung | Nutzen | Aufwand | Aktuell sinnvoll? |
|------|-------------|--------|---------|-------------------|
| EAN-Lookup | EAN eingeben → Produktdaten automatisch aus offener Datenbank ziehen | Spart manuelles Recherchieren; weniger Tippfehler | Mittel | Später — externe API-Abhängigkeit, lohnt sich ab größeren Produktmengen |
| VK-Autoberechnung | Verkaufspreis wird sofort bei EK-Änderung berechnet (MwSt + Faktor) | Kein manuelles Rechnen mehr, weniger Preisfehler | Klein | ✅ Ja — Settings-Infrastruktur existiert bereits, schnell umsetzbar |
| Lieferanten-Import | CSV/Excel von Lieferanten direkt einlesen und Felder mappen | Spart stundenlanges Copy-Paste aus Lieferanten-Listen | Groß | Später — braucht flexibles Feld-Mapping-UI |
| Geplante Exporte | Exporte zeitgesteuert oder bei Änderung automatisch auslösen | Spart tägliche manuelle Export-Routine | Mittel | Später — braucht Scheduler/Cronjob-Infrastruktur |
| Duplikat-Erkennung | Warnung bei ähnlichen SKUs, EANs oder Produktnamen | Verhindert doppelte Produkte, spart Aufräumarbeit | Klein | ✅ Ja — kan über einfache DB-Abfrage realisiert werden |
| Standard-Werte Auto-Ausfüllen | Neue Produkte erben Standard-Werte basierend auf Kategorie | Spart 10+ Felder pro Produkt händisch zu befüllen | Klein | ✅ Ja — DefaultValues-API + Kategorien existieren |
| Konfigurierbare Validierungsregeln | Admin kann Pflichtfelder und Regeln pro Kategorie festlegen | Flexiblere Qualitätsprüfung, passt sich ans Sortiment an | Mittel | Später — aktuell reicht die feste Validierung |

## Content & SEO

| Idee | Beschreibung | Nutzen | Aufwand | Aktuell sinnvoll? |
|------|-------------|--------|---------|-------------------|
| Beschreibungs-Bausteine | Textbausteine per Klick einfügen (Material, Pflegehinweise etc.) | Konsistente Beschreibungen, 5× schnellere Texterstellung | Klein | ✅ Ja — kleines UI-Feature mit großem Zeitgewinn |
| SEO-Score | Live-Bewertung von Titel/Beschreibung (Länge, Keywords) | Bessere Sichtbarkeit in Shop-Suchen | Klein | Später — nützlich aber nicht kritisch für den aktuellen Workflow |
| Keyword-Planer | Keyword-Vorschläge pro Kategorie für Titel und Beschreibungen | Besseres Ranking, konsistente Keyword-Nutzung | Mittel | Später — braucht Keyword-Datenbank |
| Bulk-Content-Editor | Beschreibungen für mehrere Produkte gleichzeitig bearbeiten | Massive Zeitersparnis bei Serien-Produkten | Mittel | Später — BulkStammdaten deckt Basisdaten ab, Content ist komplexer |
| Auto-URL-Slug | URL-Slug automatisch aus Produktname generieren | Ein Feld weniger manuell pflegen, SEO-konforme URLs | Klein | ✅ Ja — reine String-Transformation, trivial umsetzbar |

## Visualisierung & Übersicht

| Idee | Beschreibung | Nutzen | Aufwand | Aktuell sinnvoll? |
|------|-------------|--------|---------|-------------------|
| Kanban-Board | Produkte als Karten in Spalten (Entwurf → Komplett → Exportiert) | Visueller Workflow-Überblick auf einen Blick | Mittel | Später — Dashboard zeigt bereits Status-KPIs |
| Preis-Dashboard | Grafik mit Preisverteilung, Margen, Preisänderungen | Überblick über Preisstrategie, Ausreißer erkennen | Mittel | Nein — nice-to-have, kein akuter Bedarf |
| Heatmap Vollständigkeit | Farbliche Übersicht welche Felder bei welchen Produkten fehlen | Sofort sehen wo Handlungsbedarf ist | Klein | Später — DataQuality-Page existiert, Heatmap wäre Upgrade |
| Produkt-Vergleich | Zwei Produkte nebeneinander anzeigen und Unterschiede markieren | Fehler und Inkonsistenzen schnell finden | Mittel | Nein — seltener Use-Case |

## UX & Produktivität

| Idee | Beschreibung | Nutzen | Aufwand | Aktuell sinnvoll? |
|------|-------------|--------|---------|-------------------|
| Globale Cmd+K Suche | Spotlight-artige Suche über alle Produkte, Seiten, Aktionen | Sofortiger Zugriff auf alles, spart Navigation | Mittel | ✅ Ja — großer UX-Sprung, mittlerer Aufwand |
| Zuletzt bearbeitet | Liste der letzten 10 bearbeiteten Produkte in der Sidebar | Schneller Wiedereinstieg, spart Suchen | Klein | ✅ Ja — ActivityLog-Daten existieren bereits |
| Custom Tags | Produkte mit eigenen Tags versehen und danach filtern | Flexible Organisation jenseits von Kategorien | Klein | Später — Kategorien sind frisch implementiert, erst nutzen |
| Tastenkürzel-Übersicht | Overlay mit allen Keyboard-Shortcuts | Schnelleres Arbeiten für Power-User | Klein | Später — erst wenn es genug Shortcuts gibt |
| Produkt klonen | Bestehendes Produkt als Vorlage für neues nutzen | Spart 80% Eingabezeit bei ähnlichen Produkten | Klein | ✅ Ja — einfache API + Button, sofort großer Nutzen |
| Turbo-Modus | Schnellerfassung: nur Pflichtfelder, Tab-Navigation, Auto-Save | 3× schnellere Produktanlage | Groß | Später — braucht eigene UI-Logik |
| Datenblatt-Export | PDF-Datenblatt pro Produkt generieren | Nützlich für B2B-Kunden, Lieferanten-Kommunikation | Mittel | Nein — kein akuter Bedarf im aktuellen Workflow |

## Integration & Export

| Idee | Beschreibung | Nutzen | Aufwand | Aktuell sinnvoll? |
|------|-------------|--------|---------|-------------------|
| Shopify-Vorschau | Vorschau wie das Produkt im Shop aussehen wird | Fehler vor dem Export erkennen | Groß | Nein — braucht Shop-Template-Rendering |
| Google Shopping Feed | Export als Google Shopping XML/CSV | Direkter Weg zu Google Ads, kein manuelles Umformatieren | Mittel | Später — erst wenn Shopify-Export stabil läuft |
| Marktplatz-Validator | Prüfung ob Produktdaten Amazon/eBay-Anforderungen erfüllen | Weniger Ablehnungen beim Listing | Groß | Nein — komplexe Regelwerke pro Marktplatz |
| Export-Historie | Log aller Exporte mit Zeitstempel und Inhalt | Nachvollziehbar was wann exportiert wurde | Klein | ✅ Ja — ActivityLog-Infrastruktur vorhanden |
| Bild-URL-Vorschau | Thumbnail-Vorschau für hinterlegte Bild-URLs | Sofort sehen ob URLs korrekt sind | Klein | ✅ Ja — reine Frontend-Änderung |

---

## Top-3-Empfehlungen für sofortige Umsetzung

1. **Produkt klonen** — Kleiner Aufwand, riesiger Zeitgewinn bei ähnlichen Produkten. Copy-Endpoint + Button reicht.
2. **Standard-Werte Auto-Ausfüllen** — Infrastruktur (Kategorien + DefaultValues-API) existiert. Verknüpfung spart 10+ Felder pro Produkt.
3. **Beschreibungs-Bausteine** — Kleines Feature, das die Content-Erstellung massiv beschleunigt. Textbausteine als JSON, Einfüge-UI im Editor.
