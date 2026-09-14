"""Local browser regression using only an isolated temporary database."""
import os
from pathlib import Path
import sys
import tempfile
import threading
import time

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
temp = tempfile.TemporaryDirectory(prefix='cyl-groups-browser-')
os.environ['DATABASE_URL'] = 'sqlite:///' + (Path(temp.name) / 'test.db').as_posix()

from main import app
from state import state
from models.product import Product
from services import database
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from playwright.sync_api import sync_playwright, expect
import uvicorn

state.add_product(Product(artikelnummer='NORMAL', artikelname='Normales Testprodukt', is_parent=True))
state.add_product(Product(artikelnummer='POP', artikelname='Poppers Testprodukt', interne_warengruppe=' Poppers ', parent_sku='NORMAL'))
state.add_product(Product(artikelnummer='ARCH', artikelname='Archiviertes Poppers', interne_warengruppe='Poppers', exported=True))
dist = BACKEND.parent / 'frontend' / 'dist'
app.mount('/assets', StaticFiles(directory=dist / 'assets'), name='assets')

@app.get('/{path:path}')
def frontend(path: str):
    return FileResponse(dist / 'index.html')

server = uvicorn.Server(uvicorn.Config(app, host='127.0.0.1', port=8188, log_level='error'))
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
        page.route('**/*', lambda route: route.continue_() if route.request.url.startswith('http://127.0.0.1:8188/') else route.abort())
        page.goto('http://127.0.0.1:8188/stammdaten')
        expect(page.get_by_role('row').filter(has_text='Normales Testprodukt')).to_be_visible()
        expect(page.get_by_role('row').filter(has_text='Poppers Testprodukt')).not_to_be_visible()
        page.get_by_role('link', name='Poppers', exact=True).click()
        expect(page.get_by_role('row').filter(has_text='Poppers Testprodukt')).to_be_visible()
        expect(page.get_by_role('row').filter(has_text='Normales Testprodukt')).not_to_be_visible()
        page.get_by_role('button', name='Archiv (1)', exact=True).click()
        expect(page.get_by_role('row').filter(has_text='Archiviertes Poppers')).to_be_visible()
        page.get_by_role('link', name='Stammdaten', exact=True).click()
        row = page.get_by_role('row').filter(has_text='Normales Testprodukt')
        row.get_by_role('checkbox').check()
        page.get_by_role('button', name='Stammdaten bearbeiten', exact=True).click()
        field = page.locator('div.flex.items-center.gap-3').filter(has=page.locator('label', has_text='Interne Warengruppe'))
        field.get_by_role('checkbox').check()
        field.get_by_role('combobox').fill('Poppers')
        page.get_by_role('button', name='1 Produkte aktualisieren', exact=True).click()
        expect(page.get_by_role('row').filter(has_text='Normales Testprodukt')).not_to_be_visible()
        page.get_by_role('link', name='Poppers', exact=True).click()
        expect(page.get_by_role('row').filter(has_text='Normales Testprodukt')).to_be_visible()
        page.goto('http://127.0.0.1:8188/stammdaten/NORMAL')
        page.locator('input[list="interne-warengruppen"]').fill('')
        page.get_by_role('button', name='Speichern', exact=True).click()
        expect(page.get_by_text('Gespeichert', exact=True).first).to_be_visible()
        page.get_by_role('link', name='Stammdaten', exact=True).click()
        expect(page.get_by_role('row').filter(has_text='Normales Testprodukt')).to_be_visible()
        page.goto('http://127.0.0.1:8188/poppers')
        page.set_viewport_size({'width': 390, 'height': 844})
        expect(page.get_by_text('Poppers Testprodukt', exact=True).first).to_be_visible()
        page.reload()
        expect(page.get_by_text('Poppers Testprodukt', exact=True).first).to_be_visible()
        assert database.load_all_products()['NORMAL'].interne_warengruppe is None
        assert not errors, errors
        print('PASS: sidebar separation, child across groups, archive, bulk assignment, single removal, persistence, mobile; no browser errors')
        browser.close()
finally:
    server.should_exit = True
    thread.join(timeout=10)
    database._pool.close()
    temp.cleanup()
