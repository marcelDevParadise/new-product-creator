"""Quick test script for the API."""

import urllib.request
import json

BASE = "http://localhost:8000/api"


def test_health():
    resp = urllib.request.urlopen(f"{BASE}/health")
    data = json.loads(resp.read())
    assert data["status"] == "ok", f"Health check failed: {data}"
    print("[OK] Health check passed")


def test_import():
    csv_data = "Artikelnummer;Artikelname\nSKU-001;Testprodukt Dildo Classic\nSKU-002;Vibrator Extreme Pro\nSKU-003;Gleitgel Wasserbasiert 100ml"  # noqa: E501

    boundary = "----TestBoundary123"
    body_parts = [
        f"--{boundary}",
        'Content-Disposition: form-data; name="file"; filename="test.csv"',
        "Content-Type: text/csv",
        "",
        csv_data,
        f"--{boundary}--",
    ]
    body = "\r\n".join(body_parts).encode("utf-8")

    req = urllib.request.Request(
        f"{BASE}/products/import",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read())
    assert result["imported"] == 3, f"Expected 3 imports, got {result}"
    print(f"[OK] Import: {result}")


def test_products():
    resp = urllib.request.urlopen(f"{BASE}/products")
    products = json.loads(resp.read())
    assert len(products) == 3, f"Expected 3 products, got {len(products)}"
    print(f"[OK] Products: {len(products)} loaded")
    for p in products:
        print(f"     {p['artikelnummer']}: {p['artikelname']}")


def test_attributes():
    data = json.dumps({"attributes": {"meta_brand": "TestBrand", "meta_type": "Dildo"}}).encode()
    req = urllib.request.Request(
        f"{BASE}/attributes/products/SKU-001",
        data=data,
        headers={"Content-Type": "application/json"},
        method="PUT",
    )
    resp = urllib.request.urlopen(req)
    product = json.loads(resp.read())
    assert product["attributes"]["meta_brand"] == "TestBrand"
    print(f"[OK] Attribute update: {product['attributes']}")


def test_export_preview():
    resp = urllib.request.urlopen(f"{BASE}/export/preview")
    preview = json.loads(resp.read())
    print(f"[OK] Export preview: {preview['total_rows']} rows, {preview['total_products']} products")
    for row in preview["rows"]:
        print(f"     {row['artikelnummer']} | {row['attributname']} = {row['attributwert']}")


if __name__ == "__main__":
    test_health()
    test_import()
    test_products()
    test_attributes()
    test_export_preview()
    print("\n=== All tests passed ===")
