"""Focused tests for product workflow persistence and approval snapshots."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, patch


TEST_DB = Path(__file__).with_name(".workflow-test.db")
os.environ["DATABASE_URL"] = "sqlite:///.workflow-test.db"

from fastapi import HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402
from models.product import Product  # noqa: E402
from integrations.artikelwerk.publisher import run_publication_queue  # noqa: E402
from routers.articlewerk import _article_number_sort_key, _require_current_workflow_approval  # noqa: E402
from services import database  # noqa: E402
from services.workflow import publication_fingerprint  # noqa: E402
from state import state  # noqa: E402


class WorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        state.clear_products()

    @classmethod
    def tearDownClass(cls) -> None:
        if database._pool is not None:
            database._pool.close()
            database._pool = None
        TEST_DB.unlink(missing_ok=True)
        TEST_DB.with_name(f"{TEST_DB.name}-wal").unlink(missing_ok=True)
        TEST_DB.with_name(f"{TEST_DB.name}-shm").unlink(missing_ok=True)

    def setUp(self) -> None:
        state.clear_products()
        self.product = Product(
            artikelnummer="WF-001",
            artikelname="Workflow Testprodukt",
            preis=19.99,
        )
        state.add_product(self.product)

    def test_workflow_metadata_and_comments_are_persisted(self) -> None:
        self.assertEqual(database.get_product_workflow("WF-001")["status"], "draft")

        saved = database.save_product_workflow(
            "WF-001",
            status="in_progress",
            assignee="Marcel",
            approved_hash=None,
            approved_at=None,
        )
        self.assertEqual(saved["assignee"], "Marcel")

        comment = database.add_workflow_comment("WF-001", "Marcel", "Bitte prüfen")
        self.assertEqual(comment["body"], "Bitte prüfen")
        self.assertEqual(database.list_product_workflows()["WF-001"]["comment_count"], 1)

    def test_jtl_snapshot_and_revision_are_persisted(self) -> None:
        snapshot = {"name": "Workflow Testprodukt", "revision": {"rowVersion": "0xA1"}}
        database.upsert_articlewerk_publication(
            "WF-001",
            status="published",
            remote_article_id="42",
            synced_revision="0xA1",
            synced_preview_hash="preview-hash",
            synced_product_hash="product-hash",
            synced_snapshot=snapshot,
        )
        publication = database.get_articlewerk_publication("WF-001")
        self.assertEqual(publication["last_synced_revision"], "0xA1")
        self.assertEqual(publication["last_synced_product_hash"], "product-hash")
        self.assertEqual(publication["last_synced_snapshot"], snapshot)

    def test_workflow_api_exposes_board_updates_and_comments(self) -> None:
        with TestClient(app) as client:
            board = client.get("/api/workflow/board")
            self.assertEqual(board.status_code, 200)
            self.assertEqual(board.json()["items"][0]["artikelnummer"], "WF-001")

            sync_overview = client.get("/api/articlewerk/sync")
            self.assertEqual(sync_overview.status_code, 200)
            self.assertEqual(sync_overview.json()["items"][0]["artikelnummer"], "WF-001")

            updated = client.patch(
                "/api/workflow/products/WF-001",
                json={"status": "in_progress", "assignee": "Marcel"},
            )
            self.assertEqual(updated.status_code, 200)
            self.assertEqual(updated.json()["status"], "in_progress")

            comment = client.post(
                "/api/workflow/products/WF-001/comments",
                json={"author": "Marcel", "body": "Bereit zur Prüfung"},
            )
            self.assertEqual(comment.status_code, 201)

            detail = client.get("/api/workflow/products/WF-001")
            self.assertEqual(detail.status_code, 200)
            self.assertEqual(detail.json()["comments"][0]["body"], "Bereit zur Prüfung")

    def test_bulk_workflow_status_update_moves_all_selected_products(self) -> None:
        second = Product(
            artikelnummer="WF-002",
            artikelname="Zweites Workflow Testprodukt",
            preis=24.99,
        )
        state.add_product(second)

        with TestClient(app) as client:
            response = client.post(
                "/api/workflow/products/bulk/status",
                json={
                    "artikelnummern": ["WF-001", "WF-002", "WF-001"],
                    "status": "in_progress",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["updated"], 2)
        self.assertEqual(
            {item["artikelnummer"] for item in response.json()["items"]},
            {"WF-001", "WF-002"},
        )
        self.assertEqual(database.get_product_workflow("WF-001")["status"], "in_progress")
        self.assertEqual(database.get_product_workflow("WF-002")["status"], "in_progress")

    def test_bulk_workflow_status_rejects_published(self) -> None:
        with TestClient(app) as client:
            response = client.post(
                "/api/workflow/products/bulk/status",
                json={"artikelnummern": ["WF-001"], "status": "published"},
            )

        self.assertEqual(response.status_code, 409)

    def test_approval_is_bound_to_exact_product_and_variant_data(self) -> None:
        child_a = Product(artikelnummer="WF-001-A", artikelname="Variante A", parent_sku="WF-001")
        child_b = Product(artikelnummer="WF-001-B", artikelname="Variante B", parent_sku="WF-001")

        fingerprint = publication_fingerprint(self.product, [child_a, child_b])
        self.assertEqual(
            fingerprint,
            publication_fingerprint(self.product, [child_b, child_a]),
        )
        child_b.artikelname = "Geänderte Variante"
        self.assertNotEqual(
            fingerprint,
            publication_fingerprint(self.product, [child_a, child_b]),
        )

    def test_bulk_publication_uses_natural_article_number_order(self) -> None:
        skus = ["CYL-10", "cyl-2", "CYL-001", "ABC-20", "ABC-3"]
        self.assertEqual(
            sorted(skus, key=_article_number_sort_key),
            ["ABC-3", "ABC-20", "CYL-001", "cyl-2", "CYL-10"],
        )

    def test_bulk_publication_runner_preserves_queue_order(self) -> None:
        publications = [("job-1", object()), ("job-2", object()), ("job-3", object())]
        runner = AsyncMock(side_effect=[RuntimeError("Testfehler"), None, None])
        with (
            patch("integrations.artikelwerk.publisher._run_publication", runner),
            patch("integrations.artikelwerk.publisher.logger"),
        ):
            asyncio.run(run_publication_queue(publications))  # type: ignore[arg-type]
        self.assertEqual(
            [call.args[0] for call in runner.await_args_list],
            ["job-1", "job-2", "job-3"],
        )

    def test_publish_gate_rejects_missing_and_stale_approval(self) -> None:
        with self.assertRaises(HTTPException) as missing:
            _require_current_workflow_approval("WF-001")
        self.assertEqual(missing.exception.status_code, 409)

        database.approve_product_workflow(
            "WF-001",
            publication_fingerprint(self.product),
            "Marcel",
        )
        _require_current_workflow_approval("WF-001")

        self.product.artikelname = "Nach Freigabe geändert"
        state.save_product_changes(self.product)
        with self.assertRaises(HTTPException) as stale:
            _require_current_workflow_approval("WF-001")
        self.assertEqual(stale.exception.status_code, 409)

        with TestClient(app) as client:
            assigned = client.patch(
                "/api/workflow/products/WF-001",
                json={"assignee": "Neue Verantwortung"},
            )
        self.assertEqual(assigned.status_code, 200)
        self.assertTrue(assigned.json()["approval_stale"])
        self.assertEqual(database.get_product_workflow("WF-001")["approved_hash"],
                         publication_fingerprint(Product(
                             artikelnummer="WF-001",
                             artikelname="Workflow Testprodukt",
                             preis=19.99,
                         )))


if __name__ == "__main__":
    unittest.main()
