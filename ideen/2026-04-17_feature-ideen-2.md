---
tags:
  - ideen
  - attribut-generator
  - feature-request
  - e-commerce
  - shopify
  - produktdaten
date: 2026-04-17
status: neu
bereich:
  - shopify-integration
  - preislogik
  - content
  - monitoring
  - multi-channel
  - compliance
  - ux-advanced
  - datenstruktur
---

# Feature-Ideen — 2026-04-17 (Runde 2)

> [!info] Kontext
> Vierte Ideenrunde — komplett neue Ideen. Keine Duplikate zu [[2025-07-13_feature-ideen]], [[2026-04-15_feature-ideen]], [[2026-04-17_feature-ideen]] oder [[Projekterweiterungen]].

---

## Shopify-spezifische Features

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 1 | **Shopify-Tag-Manager** | Dediziertes UI zum Verwalten von Shopify-Tags. Batch-Zuweisen, -Entfernen, Tag-Gruppen definieren, Regeln: „Alle Produkte ab 50€ → Tag ‚premium'". Export als Tag-CSV. | Tags sind in Shopify zentral für Filter, Suche, Automatisierungen — aktuell kein UI dafür | Klein–Mittel |
| 2 | **Shopify-Variant-Options-Builder** | Varianten-Achsen per UI definieren (z.B. Farbe × Größe), Matrix vorgenerieren, einzelne Kombis deaktivieren. Export als Shopify-kompatible CSV mit Option1/Option2/Option3. | Shopify braucht exaktes Format — manuelles Erstellen ist fehleranfällig | Mittel |
| 3 | **Inventory-Location-Mapping** | Lagerstandorte pro Produkt/Variante zuweisen. Multi-Location Support (Lager A, Lager B, Dropship). Kein Bestand tracken, nur Zuordnung. | Shopify Multi-Location erfordert Location-IDs im Import — aktuell manuell | Klein |
| 4 | **Shopify Liquid-Snippet-Export** | Aus Attributen automatisch Liquid-Code generieren: Custom Metafield-Anzeige, Produktvergleichstabellen, Badges. Copy-Paste-ready für Theme-Code. | Brücke zwischen Daten und Shop-Darstellung — spart Theme-Entwicklung | Klein |

---

## Preislogik & Kalkulation

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 5 | **Preisstufen-Rechner** | Mehrere VK-Preise pro Produkt berechnen: Staffelpreise (ab 5 Stk → −10%), Händlerpreise (EK × 1.3), UVP, Sale-Preis. Konfigurierbares Regelwerk. | Verschiedene Preise für unterschiedliche Kanäle/Kunden automatisch | Mittel |
| 6 | **Margen-Alarm** | Warnung wenn berechnete Marge unter konfigurierbaren Schwellwert fällt (z.B. <20%). Badge auf Produktkarte, Filter „kritische Marge". | Verhindert Verlustverkäufe — gerade bei Preisänderungen durch Lieferanten | Klein |
| 7 | **Währungsumrechnung** | EK in Fremdwährung (USD, GBP) eingeben → automatisch in EUR umrechnen mit konfigurierbarem oder Live-Kurs. Kurs-Historie speichern. | Spart manuelles Rechnen bei internationalen Lieferanten | Klein |
| 8 | **Preis-Rundungsregeln** | Automatisch auf „schöne" Preise runden: 29.97 → 29.99, oder immer auf .90/.95/.99. Konfigurierbar pro Preisfeld. | Professionellere Preisgestaltung ohne manuelles Anpassen | Klein |

---

## Content & Copy

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 9 | **Text-Snippets-Bibliothek** | Globale Bausteinbibliothek: Pflegehinweise, Materialinfos, Garantietexte, Warnhinweise, Versandinfos. Kategorisiert. Per Klick in TipTap-Editor einfügen. Variablen: `{hersteller}`, `{material}`. | Konsistente Texte, 5× schneller als einzeln tippen | Klein |
| 10 | **Beschreibungs-Analyse** | Live-Info beim Bearbeiten: Zeichenanzahl, Wortanzahl, Lesezeit, Keyword-Dichte, Flesch-Score, fehlende Pflicht-Phrasen (z.B. „Lieferumfang" oder „Material"). | Sicherstellen dass Beschreibungen Mindestanforderungen erfüllen | Klein |
| 11 | **Produktname-Normalisierung** | Regelbasiertes Tool: Reihenfolge festlegen (Marke → Produkttyp → Variante → Farbe), automatisch umformatieren. Vorschau: „Lovense Lush 3 Pink" statt „LUSH 3 PINK von Lovense". | Einheitliche Produkttitel über das gesamte Sortiment | Klein–Mittel |
| 12 | **Content-Fortschritts-Score** | Pro Produkt: Titel ✓, Kurzbeschreibung ✓, Langbeschreibung ✗, Meta-Title ✗, Meta-Description ✗. Score 2/5 = 40%. Filterable, sortierbar. | Gezielt SEO-Lücken schließen statt raten wo Content fehlt | Klein |

---

## Monitoring & Betrieb

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 13 | **System-Health-Dashboard** | DB-Größe, Anzahl Produkte, letzte Backups, Backend-Uptime, API-Response-Times, letzte Fehler. Sichtbar auf eigener Settings-Unterseite. | Überblick ob das System gesund ist, bevor Probleme auftreten | Klein |
| 14 | **Automatisches DB-Vacuum** | SQLite VACUUM + ANALYZE regelmäßig ausführen (z.B. beim Start oder per Button). DB-Größe-Trend anzeigen. | SQLite wird mit der Zeit fragmentiert — behebt Performance-Degradierung | Klein |
| 15 | **Konfigurations-Export/Import** | Alle Einstellungen, Attribut-Definitionen, Templates, Validierungsregeln als JSON exportieren und importieren. Für Backup oder Übertragung auf zweite Instanz. | Sicherung der gesamten Konfiguration; ermöglicht Staging → Produktion | Klein |
| 16 | **Changelog pro Release** | Automatisches Changelog basierend auf Aktivitätslog: „Seit letztem Start: 12 Produkte geändert, 3 Exporte, 2 Importe." Anzeige im Dashboard. | Schnelle Orientierung nach Pause: „Was ist passiert seit ich zuletzt aktiv war?" | Klein |

---

## Multi-Channel & Plattform

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 17 | **Kanal-spezifische Feldwerte** | Pro Feld alternative Werte für verschiedene Kanäle speichern: `title_shopify`, `title_amazon`, `title_ebay`. Ein Produkt, mehrere Ausprägungen. | Verschiedene Plattformen haben verschiedene Längen/Format-Anforderungen | Mittel |
| 18 | **Google Merchant Center Feed** | Export im Google Product Data Format (XML/TSV): g:title, g:description, g:price, g:availability, g:image_link etc. | Direkt zu Google Shopping, kein externas Tool nötig | Mittel |
| 19 | **Amazon Flat-File Generator** | Export im Amazon Inventory-Flat-File-Format. Template-Auswahl nach Produktkategorie (Health & Beauty, Toys). | Direkt zu Amazon Seller Central hochladbar | Mittel–Groß |
| 20 | **Plattform-Vollständigkeits-Check** | Pro Kanal prüfen: „Dieses Produkt erfüllt alle Shopify-Anforderungen ✓ / Amazon-Anforderungen ✗ (fehlend: bullet_point_3, search_terms)." | Nie wieder Listing-Ablehnungen wegen fehlender Pflichtfelder | Mittel |

---

## Compliance & Recht

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 21 | **Warnhinweis-Manager** | Pflicht-Warnhinweise nach Produkttyp verwalten: CE, 18+, „Nicht für Kinder", Batteriehinweise, WEEE-Reg-Nr. Pro Produkttyp konfigurierbar, als Validierungsregel. | Rechtliche Pflichtangaben nie vergessen | Klein–Mittel |
| 22 | **Versandklassen-Zuordnung** | Automatische Zuordnung zu Versandklassen basierend auf Gewicht, Maße, Wert. Regeln: >5 kg → Sperrgut, >200€ → versichert. Exportierbar als Shopify-Feld. | Keine manuelle Versandklassen-Pflege, weniger Fehlzuordnungen | Klein |
| 23 | **Inhaltsstoff-Deklaration** | Strukturiertes Feld für INCI-Listen, Materialzusammensetzung, Allergene. Formatiert exportierbar. Template pro Produkttyp. | Pflicht bei Kosmetik/Pflege — aktuell in Freitext versteckt | Klein–Mittel |

---

## Erweiterte UX

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 24 | **Persönlicher Workspace** | Gespeicherte Ansichten: „Mein Workspace = Filter X + Spalten Y + Sortierung Z". Mehrere Workspaces schaltbar. Ähnlich Excel-Views. | Jede Aufgabe hat optimale Ansicht — einmal einrichten, immer nutzen | Mittel |
| 25 | **Kontextuelle Hilfe-Tooltips** | Jedes Formularfeld bekommt ein ⓘ-Icon mit erklärendem Text: „Dieses Feld wird als Shopify Metafield `custom.material` exportiert. Erlaubte Werte: Silikon, TPE, ABS." | Einarbeitung neuer Nutzer, weniger Rückfragen | Klein |
| 26 | **Quick-Actions von Dashboard** | Dashboard-Widgets sind nicht nur Anzeige, sondern auch Aktion: „3 Produkte ohne EAN" → Klick → direkt zur gefilterten Liste → Inline bearbeiten. Zero-Click-Philosophie. | Dashboard wird zur Schaltzentrale statt nur zum Ablesen | Klein–Mittel |
| 27 | **Fokus-Modus** | Alles ausblenden außer dem aktuellen Produkt. Keine Sidebar, kein Header, nur die Felder. Keyboard-Navigation. Für konzentriertes Arbeiten. | Weniger Ablenkung, maximale Produktivität bei Serial-Editing | Klein |

---

## Datenstruktur & Modell

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 28 | **Dynamische Feld-Typen** | Zum Beispiel: Attribut-Typ „Maßangabe" → speichert Wert + Einheit getrennt. Typ „Preisliste" → Key-Value-Paare. Typ „Farbwahl" → Hex-Picker. Typ „Ja/Nein" → Toggle. | Bessere Datenqualität durch passende Eingabefelder statt Freitext für alles | Mittel |
| 29 | **Bedingte Sichtbarkeit** | Felder nur anzeigen wenn andere Bedingungen erfüllt: „Akkulaufzeit" nur bei `stromquelle = Akku`. Per Regel im Admin konfigurierbar. | Weniger visuelles Rauschen, Fokus auf relevante Felder | Mittel |
| 30 | **Produkt-Tagging-Engine** | Regelbasiertes Auto-Tagging: Produkt hat Material=Silikon + Kategorie=Toys → Tags: `body-safe`, `premium`, `hypoallergen`. Regeln als Bibliothek. | Shopify-Tags automatisch statt manuell pflegen | Klein–Mittel |
| 31 | **Einheiten-Konverter** | Automatische Umrechnung: mm ↔ cm ↔ Zoll, g ↔ kg ↔ lb. Einheit pro Feld konfigurierbar, Shopify braucht z.B. Gewicht in g. | Lieferanten liefern in verschiedenen Einheiten — kein Kopfrechnen mehr | Klein |
| 32 | **Feld-Aliase** | Ein Feld kann mehrere Import-Namen haben: „Artikelname" = „title" = „Name" = „product_title". Kein Mapping nötig wenn unterschiedliche CSVs verschiedene Spaltennamen nutzen. | Reduziert Mapping-Aufwand bei verschiedenen Quellen drastisch | Klein |

---

## Reporting & Analytics

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 33 | **Hersteller-Dashboard** | Pro Hersteller: Anzahl Produkte, Durchschnittspreis, Vollständigkeitsgrad, häufigste Attribute, fehlende Daten. Sortierbar nach „meiste Lücken". | Priorisierung: Welcher Hersteller braucht am meisten Nacharbeit? | Klein |
| 34 | **Import-Statistiken** | Pro Import: Wie viele neu/aktualisiert/übersprungen/fehlerhaft? Trend über letzte 10 Importe. | Datenqualität der Quellen bewerten | Klein |
| 35 | **Attribut-Diversitäts-Report** | Pro Attribut: Wie viele verschiedene Werte? Top 10 Werte mit Häufigkeit. „Material" hat 47 verschiedene Werte — evtl. normalisieren? | Identifiziert Felder die aufgeräumt werden müssen | Klein |

---

> [!tip] Top 5 Empfehlungen
> 1. **#6 Margen-Alarm** — Klein, verhindert Verlustverkäufe, hoher Business-Impact
> 2. **#9 Text-Snippets-Bibliothek** — Kleiner Aufwand, beschleunigt Content massiv
> 3. **#15 Konfigurations-Export/Import** — Backup der gesamten Config, Sicherheitsnetz
> 4. **#32 Feld-Aliase** — Eliminiert Import-Mapping-Probleme
> 5. **#30 Produkt-Tagging-Engine** — Shopify-Tags automatisch statt manuell

> [!abstract] Übersicht aller Ideen-Dateien
> - [[2025-07-13_feature-ideen]] — Erste Runde (MVP-Phase)
> - [[2026-04-15_feature-ideen]] — Zweite Runde (KI, Import, UX)
> - [[2026-04-17_feature-ideen]] — Dritte Runde (Workflow, Medien, Export)
> - [[2026-04-17_feature-ideen-2]] — **Diese Datei** (Shopify, Preise, Content, Multi-Channel)
