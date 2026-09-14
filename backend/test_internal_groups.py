"""Internal classification persists without affecting any publication output.

Run separately: python -m unittest test_internal_groups
"""
import os
from pathlib import Path
import tempfile
import unittest

temp = tempfile.TemporaryDirectory(prefix='cyl-groups-')
os.environ['DATABASE_URL'] = 'sqlite:///' + (Path(temp.name) / 'test.db').as_posix()

from fastapi import FastAPI
from fastapi.testclient import TestClient
from models.product import Product
from routers.products import router
from services import database
from services.csv_handler import build_ameise_csv, build_stammdaten_csv, build_seo_csv
from services.workflow import publication_fingerprint
from integrations.artikelwerk.mapper import build_preview
from integrations.artikelwerk.schemas import ArtikelwerkSettings
from state import state


class InternalGroupTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app = FastAPI()
        app.include_router(router)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        database._pool.close()
        database._pool = None
        temp.cleanup()

    def setUp(self):
        state.clear_products()
        state.add_product(Product(artikelnummer='A', artikelname='Test'))
        state.add_product(Product(artikelnummer='B', artikelname='Test B'))

    def test_single_assignment_survives_reload_and_can_be_removed(self):
        response = self.client.patch('/api/products/A/stammdaten', json={'interne_warengruppe': 'Poppers'})
        self.assertEqual(response.status_code, 200, response.text)
        database.init_db()  # Repeated migrations must preserve the assignment.
        state.reload_from_db()
        self.assertEqual(state.get_product('A').interne_warengruppe, 'Poppers')
        self.assertIsNone(state.get_product('B').interne_warengruppe)
        response = self.client.patch('/api/products/A/stammdaten', json={'interne_warengruppe': None})
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(database.load_all_products()['A'].interne_warengruppe)

    def test_bulk_assignment_and_validation(self):
        response = self.client.post('/api/products/bulk/stammdaten', json={
            'artikelnummern': ['A', 'B'], 'fields': {'interne_warengruppe': 'Poppers'}})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['updated'], 2)
        self.assertTrue(all(p.interne_warengruppe == 'Poppers' for p in database.load_all_products().values()))
        response = self.client.post('/api/products/bulk/stammdaten', json={
            'artikelnummern': ['A', 'B'], 'fields': {'interne_warengruppe': []}})
        self.assertEqual(response.status_code, 422)

    def test_classification_does_not_change_exports_or_approval(self):
        normal = Product(artikelnummer='A', artikelname='Test', preis=10, attributes={'test': 'value'})
        grouped = normal.model_copy(update={'interne_warengruppe': 'Poppers'})
        self.assertEqual(publication_fingerprint(normal), publication_fingerprint(grouped))
        self.assertEqual(publication_fingerprint(normal, [normal]), publication_fingerprint(normal, [grouped]))
        for export in (build_stammdaten_csv, build_seo_csv):
            self.assertEqual(export([normal]), export([grouped]))
        self.assertEqual(build_ameise_csv([normal], {}), build_ameise_csv([grouped], {}))
        options = dict(children=[], attribute_config={}, context={}, capabilities={}, settings=ArtikelwerkSettings())
        self.assertEqual(build_preview(normal, **options), build_preview(grouped, **options))


if __name__ == '__main__':
    unittest.main()
