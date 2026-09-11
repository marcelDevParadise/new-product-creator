"""Regression coverage for correcting article numbers after a failed transfer."""
import os
from pathlib import Path
import unittest

TEST_DB = Path(__file__).with_name('.article-number-test.db')
os.environ['DATABASE_URL'] = 'sqlite:///.article-number-test.db'

from fastapi import FastAPI
from fastapi.testclient import TestClient
from models.product import Product
from routers.products import router
from services import database
from state import state


class ArticleNumberTests(unittest.TestCase):
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
            for table in ('articlewerk_publications', 'articlewerk_jobs', 'product_history'):
                cur.execute(f'DELETE FROM {table}')
        state.add_product(Product(artikelnummer='OLD', artikelname='Test', preis=12.5))

    def rename(self, sku='NEW'):
        return self.client.patch('/api/products/OLD/artikelnummer', json={'artikelnummer': sku})

    def test_failed_transfer_preserves_data_history_comments_and_retry_target(self):
        database.upsert_articlewerk_publication('OLD', status='failed', error_code='SKU_EXISTS')
        database.approve_product_workflow('OLD', 'old-hash', 'Angela')
        database.add_workflow_comment('OLD', 'Angela', 'Nummer korrigieren')
        database.log_product_history('OLD', 'created')
        database.create_articlewerk_job('failed-job', 'OLD', 0, {'sku': 'OLD'})
        database.update_articlewerk_job('failed-job', status='failed')
        response = self.rename(' NEW ')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['artikelnummer'], 'NEW')
        self.assertEqual(response.json()['preis'], 12.5)
        self.assertIsNone(state.get_product('OLD'))
        self.assertEqual(database.list_workflow_comments('NEW')[0]['body'], 'Nummer korrigieren')
        self.assertEqual(len(database.get_product_history('NEW')), 2)
        workflow = database.get_product_workflow('NEW')
        self.assertEqual(workflow['assignee'], 'Angela')
        self.assertIsNone(workflow['approved_hash'])
        self.assertEqual(workflow['status'], 'in_progress')
        self.assertEqual(database.get_articlewerk_job('failed-job')['root_sku'], 'NEW')
        self.assertEqual(database.get_articlewerk_publication('NEW')['status'], 'failed')
        self.assertIn('NEW', database.load_all_products())
        self.assertNotIn('OLD', database.load_all_products())

    def test_parent_rename_keeps_variant_relationship(self):
        state.add_product(Product(artikelnummer='CHILD', artikelname='Variante', parent_sku='OLD'))
        self.assertEqual(self.rename().status_code, 200)
        self.assertEqual(state.get_product('CHILD').parent_sku, 'NEW')
        self.assertEqual(database.load_all_products()['CHILD'].parent_sku, 'NEW')

    def test_retry_uses_corrected_number_and_fresh_preview(self):
        import asyncio
        from unittest.mock import AsyncMock, patch
        from fastapi import BackgroundTasks
        from routers.articlewerk import retry_job
        from integrations.artikelwerk.schemas import PublicationPreview
        from services.workflow import publication_fingerprint

        database.create_articlewerk_job('retry-job', 'OLD', 0, {'sku': 'OLD'})
        database.update_articlewerk_job('retry-job', status='failed')
        self.assertEqual(self.rename().status_code, 200)
        database.approve_product_workflow('NEW', publication_fingerprint(state.get_product('NEW')), 'Angela')
        preview = PublicationPreview(sku='NEW', is_group=False, valid=True, issues=[], steps=[], unsupported_fields=[])
        with patch('routers.articlewerk._preview', AsyncMock(return_value=preview)) as build:
            result = asyncio.run(retry_job('retry-job', BackgroundTasks()))
        build.assert_awaited_once_with('NEW')
        self.assertEqual(database.get_articlewerk_job(result['job_id'])['root_sku'], 'NEW')

    def test_duplicate_number_does_not_modify_product(self):
        state.add_product(Product(artikelnummer='NEW', artikelname='Anderer Artikel'))
        self.assertEqual(self.rename().status_code, 409)
        self.assertEqual(database.load_all_products()['NEW'].artikelname, 'Anderer Artikel')
        self.assertIsNotNone(state.get_product('OLD'))

    def test_invalid_numbers_are_rejected(self):
        for sku in ('', '  ', 'A B', 'A/B', 'A\\B', 'A?B', 'A#B'):
            with self.subTest(sku=sku):
                self.assertEqual(self.rename(sku).status_code, 400)

    def test_partial_remote_creation_is_protected(self):
        database.upsert_articlewerk_publication('OLD', status='partial', remote_article_id='42')
        self.assertEqual(self.rename().status_code, 409)
        self.assertIn('OLD', database.load_all_products())
        self.assertNotIn('NEW', database.load_all_products())

    def test_queued_variant_transfer_is_protected(self):
        state.add_product(Product(artikelnummer='CHILD', artikelname='Variante', parent_sku='OLD'))
        database.create_articlewerk_job('queued-child', 'CHILD', 0, {'sku': 'CHILD'})
        self.assertEqual(self.rename().status_code, 409)
        self.assertEqual(state.get_product('CHILD').parent_sku, 'OLD')

    def test_rollback_restores_all_references(self):
        from unittest.mock import patch
        original = database._NOW_SQL
        with patch.object(database, '_NOW_SQL', 'missing_function()'):
            with self.assertRaises(Exception):
                database.rename_product_sku('OLD', 'NEW')
        self.assertEqual(database._NOW_SQL, original)
        self.assertIn('OLD', database.load_all_products())
        self.assertNotIn('NEW', database.load_all_products())


if __name__ == '__main__':
    unittest.main()
