# Produktattribute aus XLSX importieren

Der Import ist auf der Seite **Produktattribute** und in der **Attributansicht eines einzelnen Produkts** über **Attribute aus XLSX importieren** erreichbar.

1. XLSX-Datei auswählen und festlegen, ob Dateiwerte bestehende Werte ersetzen oder nur leere Attribute ergänzen sollen.
2. **Vorschau laden** anklicken.
3. Die Zielprodukte kontrollieren. Bei Bedarf ein Produkt auswählen oder eine Produktgruppe ausdrücklich vom Import ausschließen. Nach einer Änderung die Vorschau erneut laden.
4. Die angezeigten Änderungen mit **… Attributwerte importieren** übernehmen.

Die Vorschau speichert nichts. Fehler verhindern den gesamten Import. Nach dem Import bleiben Stammdaten, Archivstatus und nicht aufgeführte Attribute erhalten. Eine bestehende Freigabe für betroffene Produkte wird zurückgesetzt; die Übertragung an Artikelwerk erfolgt separat.

## Dateiformat

Eine Zeile enthält einen Attributwert für ein Produkt. Die erste Zeile jedes befüllten Tabellenblatts enthält die Überschriften. Mehrere Tabellenblätter werden gemeinsam eingelesen.

| Spalte | Bedeutung |
| --- | --- |
| Artikelnummer oder SKU | Eindeutige Zuordnung zu einem vorhandenen Artikel; hat Vorrang vor Produktnamen. |
| Produkt | Alternativ zur Artikelnummer: Produktname. Ein eindeutiger Name oder eine EAN aus einer Attributzeile dient als Zuordnungsvorschlag. |
| Key | Pflichtfeld: bestehender Key aus dem Attributkatalog. |
| Wert | Pflichtspalte: zu importierender Attributwert. Leere Zellen löschen keine vorhandenen Werte. |
| Datentyp | Optional: muss, wenn angegeben, zum Datentyp im Attributkatalog passen. |
| Attributname, Kategorie | Optionale Angaben aus der Datei; ändern den Attributkatalog nicht. |
| Quelle, Wertart | Optionale Angaben, die bei Änderungen im Produktverlauf dokumentiert werden. Quellen werden nicht automatisch aufgerufen. |

Archivierte Artikel stehen ebenfalls zur Zuordnung bereit und werden als **Archiv** gekennzeichnet. In der Einzelproduktansicht ist ausschließlich der geöffnete Artikel als Ziel erlaubt; andere Produktgruppen können ausgeschlossen werden.

Zahlen und Wahrheitswerte werden entsprechend dem Attributkatalog gespeichert. Listen und strukturierte Werte benötigen JSON, beispielsweise `["Rot", "Blau"]` oder `{"value": 5, "unit": "minutes"}`. Für boolesche Werte sind auch `ja`/`nein` und `1`/`0` möglich. Datumswerte können als Excel-Datum oder ISO-Datum wie `2026-09-11` vorliegen. Formeln werden nicht ausgewertet und müssen vorab durch feste Werte ersetzt werden.

Identische doppelte Zeilen werden einmal übernommen; widersprüchliche Werte für dieselbe Kombination aus Zielprodukt und Key blockieren den Import. Grenzen: 10 MB Dateigröße, 50 MB entpackt, 10.000 Datenzeilen insgesamt und 100 Spalten pro Tabellenblatt.

## Technische Prüfung

`POST /api/attributes/products/import/preview` und `/apply` akzeptieren Multipart-Formulardaten mit `file`, optional `mapping` als JSON, `mode` (`overwrite` oder `fill_empty`) und optional `target_sku`. Für `/apply` ist zusätzlich das `token` aus der Vorschau erforderlich. Änderungen an Datei, Zuordnung, relevanten Attributwerten oder Attributdefinitionen machen die Vorschau ungültig.

Alle Produktänderungen und Verlaufseinträge werden in einer Datenbanktransaktion gespeichert. Laufende oder wartende Artikelwerk-Übertragungen betroffener Produkte verhindern den Import.

Backendtests: aus `backend` mit `python -m unittest test_attribute_import -v` starten. Die Regression verwendet eine separate Testdatenbank und eine Kopie der bereitgestellten XLSX unter `tests/fixtures/attribut_import.xlsx`.

Optionaler Browsertest: Frontend mit `npm.cmd run build` bauen, Playwright in einer Testumgebung installieren und aus `backend` `python tests/browser_attribute_import.py` starten. Unter Windows wird Edge verwendet, sonst ein installiertes Playwright-Chromium. Der Test verwendet eine temporäre Datenbank und Port 8187; externe Browseranfragen sind gesperrt.
