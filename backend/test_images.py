"""Tests for the image-library management API."""

from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app


class ImageDeleteApiTests(TestCase):
    def setUp(self):
        self.temp_dir = TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.env = patch.dict(
            "os.environ",
            {
                "IMAGE_LIBRARY_ROOT": str(self.root),
                "IMAGE_UPLOAD_TOKEN": "test-token",
            },
        )
        self.env.start()
        self.rebuild = patch(
            "routers.images._rebuild_index",
            return_value={"ok": True, "output": "rebuilt"},
        )
        self.rebuild.start()
        self.client = TestClient(app)
        self.headers = {"Authorization": "Bearer test-token"}

    def tearDown(self):
        self.rebuild.stop()
        self.env.stop()
        self.temp_dir.cleanup()

    def _image(self, brand: str, product: str, name: str) -> Path:
        path = self.root / "produkte" / brand / product / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"image")
        return path

    def test_delete_image_and_empty_directories(self):
        image = self._image("acme", "widget", "front.jpg")

        response = self.client.delete(
            "/api/images/file",
            params={"path": "produkte/acme/widget/front.jpg"},
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(image.exists())
        self.assertFalse(image.parent.exists())
        self.assertFalse(image.parent.parent.exists())
        self.assertTrue((self.root / "produkte").exists())

    def test_delete_image_rejects_path_traversal(self):
        response = self.client.delete(
            "/api/images/file",
            params={"path": "../outside.jpg"},
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 400)

    def test_delete_requires_token(self):
        image = self._image("acme", "widget", "front.jpg")

        response = self.client.delete(
            "/api/images/file",
            params={"path": "produkte/acme/widget/front.jpg"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertTrue(image.exists())

    def test_delete_brand_removes_all_images(self):
        self._image("acme", "widget", "front.jpg")
        self._image("acme", "other", "back.png")

        response = self.client.delete(
            "/api/images/brand/acme",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["images"], 2)
        self.assertFalse((self.root / "produkte" / "acme").exists())

