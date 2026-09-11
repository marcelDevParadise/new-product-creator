"""XLSX import integration tests, always using an isolated temporary database."""
import io
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch

TEST_DB = Path(__file__).with_name('.attribute-import-test.db')
os.environ['DATABASE_URL'] = f'sqlite:///{TEST_DB.as_posix()}'

from fastapi import FastAPI
from fastapi.testclient import TestClient
from openpyxl import Workbook
from models.attribute import AttributeDefinition
from models.product import Product
from routers.attributes import router
from services import database
from services.attribute_import import read_rows, build_preview, apply_preview
from state import state

FIXTURE = Path(__file__).parent / 'tests' / 'fixtures' / 'attribut_import.xlsx'


def workbook(rows, headers=('Produkt', 'Key', 'Datentyp', 'Wert', 'Quelle', 'Wertart')):
    book = Workbook()
    book.active.append(headers)
    for row in rows:
        book.active.append(row)
    output = io.BytesIO()
    book.save(output)
    book.close()
    return output.getvalue()


class AttributeImportTests(unittest.TestCase):
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
        for suffix in ('', '-wal', '-shm'):
            Path(str(TEST_DB) + suffix).unlink(missing_ok=True)

    def setUp(self):
        state.clear_products()
        with database.get_conn() as conn, conn.cursor() as cur:
            for table in ('articlewerk_jobs', 'product_history', 'articlewerk_publications'):
                cur.execute(f'DELETE FROM {table}')
        state.attribute_config = {
            'color': AttributeDefinition(id='color', category='Test', name='Farbe'),
            'count': AttributeDefinition(id='count', category='Test', name='Anzahl', shopify_type='number_integer'),
            'enabled': AttributeDefinition(id='enabled', category='Test', name='Aktiv', shopify_type='boolean'),
            'tags': AttributeDefinition(id='tags', category='Test', name='Tags', shopify_type='list.single_line_text_field'),
        }
        state.add_product(Product(artikelnummer='A', artikelname='Produkt A', ean='123', attributes={'keep': 'Bleibt', 'color': 'Rot'}))
        state.add_product(Product(artikelnummer='B', artikelname='Produkt B'))

    def preview(self, content, **data):
        response = self.client.post('/api/attributes/products/import/preview',
                                    files={'file': ('test.xlsx', content)}, data=data)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def apply(self, content, preview, **data):
        return self.client.post('/api/attributes/products/import/apply',
                                files={'file': ('test.xlsx', content)}, data={'token': preview['token'], **data})

    def test_example_all_87_rows_and_metadata(self):
        content = FIXTURE.read_bytes()
        rows = read_rows(content)
        self.assertEqual(len(rows), 87)
        self.assertEqual(len({r['source'] for r in rows}), 3)
        for row in rows:
            state.attribute_config[row['key']] = AttributeDefinition(
                id=row['key'], name=row['name'], category=row['category'], shopify_type=row['declared_type'])
        for index, source in enumerate(dict.fromkeys(r['source'] for r in rows)):
            state.add_product(Product(artikelnummer=source if rows[0]['source_sku'] else f'EX-{index}', artikelname=source))
        preview = self.preview(content)
        self.assertEqual(preview['errors'], 0, preview['rows'])
        self.assertEqual(preview['changes'], 87)
        self.assertEqual(self.apply(content, preview).status_code, 200)
        imported = database.load_all_products()
        for group in preview['groups']:
            self.assertEqual(len(imported[group['sku']].attributes), group['count'])
            history = database.get_product_history(group['sku'])
            detail = json.loads(history[0]['detail'])
            self.assertTrue(detail['source_url'].startswith('https://'))
            self.assertTrue(detail['evidence_kind'])

    def test_preview_is_read_only_and_apply_merges_typed_values(self):
        content = workbook([['Produkt A', 'color', '', 'Blau'], ['Produkt A', 'count', 'number_integer', 0],
                            ['Produkt A', 'enabled', 'boolean', False], ['Produkt A', 'tags', 'list.single_line_text_field', '["eins", "zwei"]']])
        database.approve_product_workflow('A', 'old', 'Angela')
        preview = self.preview(content)
        self.assertEqual(state.get_product('A').attributes['color'], 'Rot')
        self.assertEqual(database.get_product_history('A'), [])
        response = self.apply(content, preview)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(state.get_product('A').attributes, {'keep': 'Bleibt', 'color': 'Blau', 'count': 0, 'enabled': False, 'tags': ['eins', 'zwei']})
        self.assertEqual(database.get_product_workflow('A')['status'], 'in_progress')
        self.assertEqual(database.get_product_workflow('A')['assignee'], 'Angela')
        self.assertEqual(self.preview(content)['changes'], 0)

    def test_invalid_row_blocks_entire_import(self):
        content = workbook([['Produkt A', 'color', '', 'Blau'], ['Produkt B', 'unknown', '', 'Wert']])
        preview = self.preview(content)
        self.assertEqual(preview['errors'], 1)
        self.assertEqual(self.apply(content, preview).status_code, 422)
        self.assertEqual(state.get_product('A').attributes['color'], 'Rot')

    def test_explicit_mapping_and_skip_support_one_product(self):
        content = workbook([['Externer Name', 'color', '', 'Blau'], ['Produkt B', 'color', '', 'Grün']])
        mapping = json.dumps({'Externer Name': 'A', 'Produkt B': None})
        preview = self.preview(content, mapping=mapping, target_sku='A')
        self.assertEqual(preview['errors'], 0)
        self.assertEqual(preview['skipped'], 1)
        self.assertEqual(self.apply(content, preview, mapping=mapping, target_sku='A').status_code, 200)
        self.assertEqual(state.get_product('B').attributes, {})

    def test_ambiguous_names_require_mapping(self):
        state.add_product(Product(artikelnummer='C', artikelname='Produkt A'))
        content = workbook([['Produkt A', 'color', '', 'Blau']])
        self.assertEqual(self.preview(content)['errors'], 1)

    def test_ean_match_and_archived_product(self):
        state.attribute_config['ean'] = AttributeDefinition(id='ean', category='Test', name='EAN')
        state.archive_product('A')
        content = workbook([['Anderer Name', 'ean', '', '123'], ['Anderer Name', 'color', '', 'Blau']])
        preview = self.preview(content)
        self.assertEqual(preview['groups'][0]['sku'], 'A')
        self.assertEqual(self.apply(content, preview).status_code, 200)
        self.assertTrue(state.get_product('A').exported)

    def test_sku_column_has_priority_over_name(self):
        content = workbook([['B', 'Produkt A', 'color', 'Blau']], ('Artikelnummer', 'Produkt', 'Key', 'Wert'))
        preview = self.preview(content)
        self.assertEqual(preview['groups'][0]['sku'], 'B')

    def test_empty_and_fill_only_preserve_existing_values(self):
        content = workbook([['Produkt A', 'color', '', 'Blau'], ['Produkt A', 'count', '', 0], ['Produkt B', 'color', '', None]])
        preview = self.preview(content, mode='fill_empty')
        self.assertEqual(preview['changes'], 1)
        self.assertEqual(preview['skipped'], 2)
        self.assertEqual(self.apply(content, preview, mode='fill_empty').status_code, 200)
        self.assertEqual(state.get_product('A').attributes['color'], 'Rot')

    def test_stale_preview_rejected(self):
        content = workbook([['Produkt A', 'color', '', 'Blau']])
        preview = self.preview(content)
        state.get_product('A').attributes['color'] = 'Grün'
        state.save_product_changes(state.get_product('A'))
        self.assertEqual(self.apply(content, preview).status_code, 409)

    def test_changed_file_or_mapping_cannot_reuse_preview(self):
        content = workbook([['Produkt A', 'color', '', 'Blau']])
        preview = self.preview(content)
        self.assertEqual(self.apply(workbook([['Produkt A', 'color', '', 'Gelb']]), preview).status_code, 409)
        self.assertEqual(self.apply(content, preview, mapping=json.dumps({'Produkt A': 'B'})).status_code, 409)
        self.assertEqual(state.get_product('A').attributes['color'], 'Rot')
        self.assertEqual(state.get_product('B').attributes, {})

    def test_identical_duplicates_are_written_once(self):
        content = workbook([['Produkt A', 'color', '', 'Blau'], ['Produkt A', 'color', '', 'Blau']])
        preview = self.preview(content)
        self.assertEqual((preview['changes'], preview['skipped'], preview['errors']), (1, 1, 0))
        self.assertEqual(self.apply(content, preview).status_code, 200)
        self.assertEqual(len(database.get_product_history('A')), 1)

    def test_child_import_invalidates_parent_approval(self):
        state.get_product('B').parent_sku = 'A'
        state.save_product_changes(state.get_product('B'))
        database.approve_product_workflow('A', 'old', 'Angela')
        content = workbook([['Produkt B', 'color', '', 'Blau']])
        preview = self.preview(content)
        self.assertEqual(self.apply(content, preview).status_code, 200)
        self.assertEqual(database.get_product_workflow('A')['status'], 'in_progress')

    def test_database_only_change_rejected(self):
        content = workbook([['Produkt A', 'color', '', 'Blau']])
        preview = self.preview(content)
        with database.get_conn() as conn, conn.cursor() as cur:
            cur.execute('UPDATE products SET attributes=%s WHERE artikelnummer=%s', ('{"color":"Gelb"}', 'A'))
        self.assertEqual(self.apply(content, preview).status_code, 409)

    def test_formulas_conflicts_and_wrong_types_are_errors(self):
        for values in ([['Produkt A', 'color', '', '=1+1']],
                       [['Produkt A', 'color', '', 'Blau'], ['Produkt A', 'color', '', 'Grün']],
                       [['Produkt A', 'count', 'number_integer', 'abc']],
                       [['Produkt A', 'color', 'number_integer', '123']]):
            with self.subTest(values=values):
                self.assertGreater(self.preview(workbook(values))['errors'], 0)

    def test_rollback_and_running_publication(self):
        content = workbook([['Produkt A', 'color', '', 'Blau'], ['Produkt B', 'color', '', 'Grün']])
        preview = build_preview(content, state.products, state.attribute_config, {})
        with patch.object(database, '_NOW_SQL', 'missing_function()'):
            with self.assertRaises(Exception):
                apply_preview(preview, state.products, 'test.xlsx')
        self.assertEqual(database.load_all_products()['A'].attributes['color'], 'Rot')
        self.assertEqual(state.get_product('A').attributes['color'], 'Rot')
        database.create_articlewerk_job('queued', 'A', 0, {})
        self.assertEqual(self.apply(content, preview).status_code, 409)

    def test_malformed_file_and_headers(self):
        for content in (b'not an xlsx', workbook([['x']], ('Falsch',))):
            response = self.client.post('/api/attributes/products/import/preview', files={'file': ('test.xlsx', content)})
            self.assertEqual(response.status_code, 400)


if __name__ == '__main__':
    unittest.main()
