"""Optional browser regression: build frontend, install playwright, then run this file.

Uses a temporary local database and headless Edge on Windows / Chromium elsewhere.
No remote product writes or Artikelwerk requests are made.
"""
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import time

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
temp = tempfile.TemporaryDirectory(prefix='cyl-xlsx-browser-')
os.environ['DATABASE_URL'] = 'sqlite:///' + (Path(temp.name) / 'test.db').as_posix()

from main import app
from state import state
from models.product import Product
from models.attribute import AttributeDefinition
from services import database
from services.attribute_import import read_rows
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from playwright.sync_api import sync_playwright, expect
import uvicorn

fixture = BACKEND / 'tests' / 'fixtures' / 'attribut_import.xlsx'
rows = read_rows(fixture.read_bytes())
sources = list(dict.fromkeys(row['source'] for row in rows))
for row in rows:
    state.add_attribute_definition(row['key'], AttributeDefinition(
        id=row['key'], name=row['name'], category=row['category'], shopify_type=row['declared_type']))
for index, source in enumerate(sources):
    state.add_product(Product(artikelnummer=source, artikelname=f'Import Test {index + 1}',
                              stammdaten_complete=True, attributes={'untouched': 'Beibehalten'}))

dist = BACKEND.parent / 'frontend' / 'dist'
@app.get('/products')
@app.get('/products/{sku}')
def frontend(sku: str = ''):
    return FileResponse(dist / 'index.html')
app.mount('/', StaticFiles(directory=dist, html=True), name='frontend')
server = uvicorn.Server(uvicorn.Config(app, host='127.0.0.1', port=8187, log_level='error'))
thread = threading.Thread(target=server.run, daemon=True)
thread.start()
try:
    for _ in range(100):
        if server.started:
            break
        time.sleep(.1)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, **({'channel': 'msedge'} if os.name == 'nt' else {}))
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route('**/*', lambda route: route.continue_() if route.request.url.startswith('http://127.0.0.1:8187/') else route.abort())
        page.goto('http://127.0.0.1:8187/products')
        page.get_by_role('button', name='Attribute aus XLSX importieren', exact=True).click()
        page.get_by_label('XLSX-Datei').set_input_files(str(fixture))
        page.get_by_role('button', name='Vorschau laden').click()
        expect(page.get_by_text('87 Änderungen · 3 Produkte · 0 Fehler', exact=False)).to_be_visible()
        expect(page.get_by_role('button', name='87 Attributwerte importieren')).to_be_enabled()
        page.get_by_role('button', name='87 Attributwerte importieren').click()
        expect(page.get_by_role('status').filter(has_text='87 Attributwerte für 3 Produkte importiert')).to_be_visible()
        page.get_by_role('button', name='Schließen', exact=True).click()
        for source in sources:
            product = page.request.get(f'http://127.0.0.1:8187/api/products/{source}').json()
            assert product['attributes']['untouched'] == 'Beibehalten'
            assert len(product['attributes']) == sum(row['source'] == source for row in rows) + 1
        # Single-product entry: explicit exclusion of other groups, refreshed preview, no-op import.
        page.goto(f'http://127.0.0.1:8187/products/{sources[0]}')
        page.get_by_role('button', name='Attribute aus XLSX importieren', exact=True).click()
        page.get_by_label('XLSX-Datei').set_input_files(str(fixture))
        page.get_by_role('button', name='Vorschau laden').click()
        for source in sources[1:]:
            page.get_by_role('combobox', name=f'Zielprodukt für {source}').select_option('__skip__')
        expect(page.get_by_text('Zuordnung oder Einstellungen geändert.', exact=False)).to_be_visible()
        page.get_by_role('button', name='Vorschau laden').click()
        expect(page.get_by_text('0 Änderungen · 0 Produkte · 0 Fehler', exact=False)).to_be_visible()
        expect(page.get_by_role('button', name='0 Attributwerte importieren')).to_be_disabled()
        # Mobile layout keeps the dialog and footer usable.
        page.set_viewport_size({'width': 390, 'height': 844})
        expect(page.get_by_role('button', name='Schließen', exact=True)).to_be_visible()
        assert not errors, errors
        print('PASS: XLSX upload, 87-row preview, product mapping, import, persisted merge, single-product restriction, no-op detection, mobile footer; no browser errors')
        browser.close()
finally:
    server.should_exit = True
    thread.join(timeout=10)
    database._pool.close()
    temp.cleanup()
