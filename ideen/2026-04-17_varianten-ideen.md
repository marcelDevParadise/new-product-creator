---
tags:
  - ideen
  - attribut-generator
  - feature-request
  - varianten
  - parent-child
  - shopify
date: 2026-04-17
status: neu
bereich:
  - varianten
---

# Feature-Ideen — Variantenlogik

> [!info] Kontext
> Dedizierte Ideensammlung für Erweiterungen der Variantenlogik.
> Bestehende Features: Parent/Child-Gruppen, Vererbung, Diff, Auto-Suggest, Matrix-Ansicht, 11 API-Endpoints.
> Keine Duplikate zu [[2026-04-17_feature-ideen-2]] #2 (Shopify-Variant-Options-Builder) oder [[Projekterweiterungen]] §1.4.

---

## Varianten-Erstellung & Matrix

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 1 | **Kartesische Matrix-Generierung** | Achsen definieren (z.B. Farbe: Rot, Blau, Grün × Größe: S, M, L) → 9 Children automatisch generieren. SKU, Name, Attribute automatisch. Einzelne Kombis vor dem Erzeugen deaktivierbar. | Aktuell muss jede Variante einzeln erstellt werden — bei 4×5 Achsen = 20 Klicks | Mittel |
| 2 | **SKU-Schema für Varianten** | Konfigurierbares Suffix: Parent `CYL-00123` → Children `CYL-00123-ROT-S`, `CYL-00123-BLU-M`. Kürzel pro Achsenwert definierbar. | Sofort erkennbar welche Variante welche ist, statt generierter Laufnummern | Klein |
| 3 | **Varianten aus CSV importieren** | CSV mit Parent-SKU + Varianten-Attributen hochladen → Children werden automatisch erzeugt und zugeordnet. Mapping: welche Spalte = welche Achse. | Lieferanten liefern oft Variantenlisten als Tabelle — aktuell manueller Aufwand | Mittel |
| 4 | **Varianten-Klonen** | Komplette Variantengruppe duplizieren: Parent + alle Children. Neuer Basisname, neue SKUs, Achsenwerte bleiben. Ideal für: „Gleiches Produkt, andere Marke." | Spart massiv Zeit bei ähnlichen Produktfamilien | Klein |
| 5 | **Varianten-Achsen dynamisch erweitern** | Neue Achse nachträglich hinzufügen: Gruppe hat nur Farbe → jetzt auch Größe dazu. Bestehende Children behalten Farbwert, Größe wird als „Standard" gesetzt. | Aktuell müsste man die Gruppe auflösen und neu erstellen | Mittel |

---

## Varianten-Übersicht & Navigation

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 6 | **Dedizierte Variantengruppen-Seite** | Eigene Seite `/varianten` mit allen Gruppen als Cards: Parent-Name, Achsen-Tags, Anzahl Children, Completeness-Score. Suche und Filter. | Aktuell nur über StammdatenPage erreichbar — keine Übersicht aller Gruppen | Mittel |
| 7 | **Varianten-Baum-Ansicht** | Hierarchische Tree-View: Parent → Children als Baumstruktur. Expandable Nodes. Drag & Drop zum Umgruppieren. | Visuell sofort klar welches Kind zu welchem Parent gehört | Klein–Mittel |
| 8 | **Varianten-Schnellwechsel** | Im Produkt-Editor: Dropdown/Tabs mit allen Geschwister-Varianten. Ein Klick wechselt zur nächsten Variante ohne zurück zur Liste. | Spart ständiges Raus-und-Rein-Navigieren bei seriellem Bearbeiten | Klein |
| 9 | **Varianten-Badge in Produktlisten** | Visuelles Badge auf jeder Produktkarte: „Parent (5 Varianten)" oder „Variante von CYL-00123". Farblich getrennt. Klickbar → zur Gruppe. | Aktuell muss man den Datensatz öffnen um die Zugehörigkeit zu sehen | Klein |
| 10 | **Verwaiste Varianten finden** | Dashboard-Widget / Filter: Children deren Parent gelöscht/archiviert wurde. Oder Produkte mit `parent_sku` gesetzt aber Parent existiert nicht. | Datenintegrität — verwaiste Varianten sind unsichtbare Leichen | Klein |

---

## Vererbung & Synchronisation

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 11 | **Selektive Vererbungs-Übersteuerung per Child** | Pro Child pro Feld: „Eigener Wert" vs. „Vom Parent geerbt" explizit schaltbar. Toggle-Button neben jedem Feld. Aktuell nur implizit durch leere vs. gefüllte Felder. | Explizit statt implizit — weniger Verwirrung bei „warum ist der Wert leer?" | Klein–Mittel |
| 12 | **Bulk-Sync Parent → Children** | Button: „Alle Children jetzt synchronisieren." Überschreibt geerbte Felder in Children mit aktuellen Parent-Werten. Vorschau-Diff vorher anzeigen. | Nach Parent-Änderung sicherstellen dass Children aktuell sind | Klein |
| 13 | **Reverse-Vererbung (Child → Parent)** | Gemeinsame Werte aus Children in den Parent übernehmen: „Alle 5 Children haben Material = Silikon → soll das in den Parent?" Vorschlag + Bestätigung. | Aufräum-Tool: Parent hat leere Felder, Children redundante Daten | Mittel |
| 14 | **Vererbungs-Changelog** | Protokollieren wann ein geerbter Wert sich geändert hat, weil der Parent aktualisiert wurde. In der History sichtbar: „Beschreibung geändert (geerbt von CYL-00100)." | Nachvollziehbarkeit bei automatischen Werteänderungen | Klein |
| 15 | **Vererbungs-Profil pro Gruppe** | Nicht global, sondern pro Variantengruppe konfigurieren welche Felder vererbt werden. Gruppe A erbt Bilder, Gruppe B nicht. | Flexibler als die globale inherit_fields-Liste | Mittel |

---

## Varianten-Matrix & Inline-Editing

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 16 | **Matrix-Inline-Bearbeitung** | Zellen in der VariantMatrix direkt editierbar: Doppelklick auf Preis/EAN/Name → Inline-Input → Enter → Gespeichert. Kein Seitenwechsel. | Aktuell muss man für jede Änderung zum Detail-Editor navigieren | Mittel |
| 17 | **Matrix-Spalten konfigurieren** | Wählbar welche Felder die VariantMatrix zeigt: aktuell fest (Name, EK, VK, EAN, Gewicht). User will vielleicht Bild-URL, Lieferant, Status sehen. | Jede Arbeitsaufgabe braucht andere Spalten | Klein |
| 18 | **Matrix-Sortierung** | Kinder innerhalb der Matrix sortieren: nach Achsenwert (Farbe alphabetisch), nach Preis, nach SKU, per Drag & Drop manuell. Sortierung exportrelevant. | Sortierung bestimmt die Reihenfolge in Shopify — aktuell zufällig | Klein |
| 19 | **Matrix-Zellenfarben** | Farbcodierung: grün = eigener Wert, grau/kursiv = geerbt, amber = abweicht vom Parent, rot = fehlt/Pflichtfeld leer. | Sofort sehen was Aufmerksamkeit braucht, ohne jede Zelle einzeln zu prüfen | Klein |
| 20 | **Matrix-CSV-Export** | Die aktuelle Matrixansicht als CSV exportieren. Nur sichtbare Spalten, nur Children dieser Gruppe. | Schneller Auszug für Lieferanten oder interne Abstimmung | Klein |

---

## Preise & Aufpreise

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 21 | **Varianten-Aufpreis-System** | Aufpreis pro Achsenwert: Größe XL = +5€, Farbe Gold = +10€. Basis-VK vom Parent + Aufpreise = Varianten-VK. Automatisch berechnet. | Kein manuelles Preisrechnen pro Variante mehr | Mittel |
| 22 | **Staffelpreise pro Variante** | Mengenrabatte die pro Variante unterschiedlich sein können: Variante A ab 10 Stk −10%, Variante B ab 5 Stk −15%. | Unterschiedliche Preisstrukturen je nach Variante (z.B. teure vs. günstige Farbe) | Mittel |
| 23 | **Preis-Sync-Optionen** | Pro Gruppe: „VK vom Parent übernehmen" vs. „VK pro Variante individuell" vs. „VK = Parent + Aufpreis". Mode schaltbar. | Explizite Kontrolle statt implizites Verhalten | Klein |

---

## Shopify-spezifische Varianten

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 24 | **Shopify-Varianten-Vorschau** | Live-Vorschau wie die Varianten-Auswahl im Shop aussehen wird: Farbwahl-Swatches, Größen-Buttons, Preis-Range „29,90€ – 49,90€". | Qualitätskontrolle bevor es in den Shop geht | Klein–Mittel |
| 25 | **Option-Value-Mapping** | Interne Werte auf Shopify-Werte mappen: intern `rot` → Shopify Option1 `Rot`, intern `s` → `Small`. Getrennte Darstellung. | Shopify braucht saubere Display-Werte — intern kann kürzer sein | Klein |
| 26 | **Varianten-Bild-Zuordnung** | Pro Achsenwert ein Bild hinterlegen: Farbe „Rot" → zeigt rotes Produktbild. Exportierbar als Shopify `Variant Image`. | In Shopify sind Varianten-Bilder wichtig für die Darstellung | Mittel |
| 27 | **Shopify-Varianten-Limit-Check** | Warnung wenn >100 Varianten pro Produkt (Shopify-Limit) oder >3 Achsen. Bevor man 4×5×6 = 120 generiert. | Verhindert Export-Fehler durch Shopify-Limitierung | Klein |
| 28 | **Varianten-Metafield-Export** | Pro Variante eigene Metafields exportieren (z.B. `variant.metafields.custom.ean`). Nicht nur Produkt-Metafields, sondern auch Varianten-Metafields. | Shopify hat seit 2024 eigene Varianten-Metafields — aktuell nicht unterstützt | Mittel |

---

## Qualität & Validierung

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 29 | **Varianten-Vollständigkeits-Check** | Pro Gruppe prüfen: Haben alle Children die gleichen Achsen? Fehlen EANs? Haben alle einen Preis? Score pro Gruppe. | Lücken in Variantengruppen sind häufig und schwer zu finden | Klein |
| 30 | **Achsenwert-Konsistenz** | Prüfung: „Rot" vs „rot" vs „ROT" innerhalb einer Achse. Oder: „M" vs „Medium" vs „mittel" bei Größe. Normalisierungs-Vorschlag. | Inkonsistente Achsenwerte führen zu doppelten Optionen im Shop | Klein |
| 31 | **Fehlende-Varianten-Erkennung** | Wenn Gruppe Achsen Farbe (Rot, Blau) × Größe (S, M, L) hat: „Es fehlt Blau/L." Matrix zeigt Lücken. One-Click erstellen. | Unvollständige Matrizen auffüllen | Klein–Mittel |
| 32 | **Varianten-Diff-Report exportierbar** | Den bestehenden Diff (Parent vs Children) als CSV/PDF exportieren. Für interne Abstimmung. | „Schau mal, diese 5 Varianten weichen vom Parent ab — ist das gewollt?" | Klein |

---

## Automatisierung

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 33 | **Auto-Gruppierung bei Import** | Beim CSV-Import erkennen: Diese 5 Zeilen gehören zusammen (gleicher Basisname, Spalte „Variante" vorhanden). Automatisch Parent erstellen + gruppieren. | Aktuell muss nach dem Import manuell gruppiert werden | Mittel |
| 34 | **Regel-basierte Variantenerstellung** | Regel: „Wenn Produkt Kategorie = Unterwäsche, erstelle automatisch Größen-Varianten S/M/L/XL." Template pro Produkttyp. | Standard-Varianten ohne manuelles Klicken | Mittel |
| 35 | **Varianten-Template** | Achsen-Kombinationen als Template speichern: „Farb-Set Basic" (Rot, Schwarz, Pink), „Größen EU" (S, M, L, XL, XXL). Bei neuer Gruppe ein Template wählen → Achsen vorausgefüllt. | Immer wieder gleiche Achsen-Sets eingeben entfällt | Klein |
| 36 | **Smart Auto-Suggest v2** | Verbesserter Algorithmus: Fuzzy-Matching statt nur Suffix-Strip. „Satisfyer Pro 2 Red" und „Satisfyer Pro 2 Blue" als Gruppe erkennen auch wenn der Farbname mitten im Titel steht. | Aktueller Suggest verpasst viele offensichtliche Gruppen | Mittel |

---

## Erweiterte Strukturen

| # | Idee | Beschreibung | Nutzen | Aufwand |
|---|------|-------------|--------|---------|
| 37 | **Multi-Level-Varianten** | Parent → Sub-Parent → Child. Beispiel: „Satisfyer Pro" → „Pro 2" / „Pro 3" → jeweils in Farben. Baumtiefe > 1. | Komplexe Produkthierarchien abbilden (Serien → Modelle → Farben) | Groß |
| 38 | **Varianten-Sets / Swatches-Daten** | Pro Achsenwert zusätzliche Daten: Farbe „Rot" → Hex `#FF0000`, Bild-Swatch-URL. Exportierbar für Color-Picker im Shop. | Farbwahl im Shop braucht Hex-Codes oder Swatch-Bilder | Klein–Mittel |
| 39 | **Varianten-Gruppen verschmelzen** | Zwei bestehende Gruppen zu einer zusammenführen. Parent aus Gruppe A wird neuer Parent, Children aus B werden integriert. | Bei Sortimentsbereinigung: Aus zwei ähnlichen Produkten eines machen | Mittel |
| 40 | **Varianten-Gruppe aufsplitten** | Umkehrung: Eine große Gruppe in zwei aufteilen. Z.B. „Rot-Varianten" und „Blau-Varianten" bekommen jeweils eigenen Parent. | Wenn die Gruppe zu groß oder heterogen wird | Klein–Mittel |

---

> [!tip] Top 5 Empfehlungen
> 1. **#1 Kartesische Matrix-Generierung** — Der größte Zeitfresser aktuell, höchster Impact
> 2. **#8 Varianten-Schnellwechsel** — Klein, sofort spürbarer Komfort beim Bearbeiten
> 3. **#16 Matrix-Inline-Bearbeitung** — Eliminiert Seitenwechsel, massiv schneller
> 4. **#29 Varianten-Vollständigkeits-Check** — Lücken finden die man sonst übersieht
> 5. **#35 Varianten-Template** — Klein, spart wiederkehrende Eingaben

> [!abstract] Siehe auch
> - [[2026-04-17_feature-ideen-2]] #2 — Shopify-Variant-Options-Builder
> - [[Projekterweiterungen]] §1.4 — Implementierte Variantenlogik (✅)
> - [[Erledigte-Erweiterungen]] — Phase 1 + 2 Details
