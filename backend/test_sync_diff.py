"""Business-level comparison tests for the JTL synchronization center."""

from __future__ import annotations

import unittest

from integrations.artikelwerk.schemas import PreviewIssue, PublicationPreview, PublicationStep
from models.product import Product
from services.sync_diff import build_business_diff, explain_issues, planned_changes


def preview(*, issues: list[PreviewIssue] | None = None) -> PublicationPreview:
    return PublicationPreview(
        sku="CYL-10",
        is_group=False,
        valid=not any(issue.severity == "error" for issue in issues or []),
        issues=issues or [],
        steps=[
            PublicationStep(
                operation="create_article",
                resource_key="article",
                payload={"sku": "CYL-10", "name": "Lokal"},
            ),
            PublicationStep(
                operation="sync_article",
                resource_key="article-master",
                payload={"tenantId": 4, "article": {"name": "Lokal"}},
            ),
        ],
        unsupported_fields=[],
    )


class SyncDiffTests(unittest.TestCase):
    def test_detects_jtl_only_change_since_snapshot(self) -> None:
        product = Product(artikelnummer="CYL-10", artikelname="Lokal", preis=19.99)
        snapshot = {
            "name": "Lokal",
            "pricing": {"grossSalesPrice": 19.99},
            "categories": [],
            "attributes": [],
        }
        remote = {
            **snapshot,
            "pricing": {"grossSalesPrice": 24.99},
        }

        fields = build_business_diff(product, remote, snapshot, preview())
        price = next(field for field in fields if field["field"] == "preis")
        self.assertEqual(price["direction"], "jtl_changed")
        self.assertEqual(price["jtl_value"], 24.99)

    def test_detects_conflict_when_both_sides_changed(self) -> None:
        product = Product(artikelnummer="CYL-10", artikelname="Lokal neu")
        snapshot = {"name": "Alter Name", "categories": [], "attributes": []}
        remote = {"name": "JTL neu", "categories": [], "attributes": []}

        fields = build_business_diff(product, remote, snapshot, preview())
        name = next(field for field in fields if field["field"] == "artikelname")
        self.assertEqual(name["direction"], "conflict")

    def test_explains_category_problem_and_skips_create_for_existing_article(self) -> None:
        issue = PreviewIssue(
            severity="error",
            code="UNKNOWN_CATEGORY_PATH",
            message="Pfad nicht gefunden",
            field="kategorie_2",
        )
        publication_preview = preview(issues=[issue])

        explanation = explain_issues(publication_preview)[0]
        self.assertEqual(explanation["area"], "Kategorien")
        self.assertIn("JTL-Kategoriestamm", explanation["recommended_action"])

        changes = planned_changes(publication_preview, remote_exists=True)
        self.assertNotIn("create_article", {change["operation"] for change in changes})
        self.assertIn("sync_article", {change["operation"] for change in changes})


if __name__ == "__main__":
    unittest.main()
