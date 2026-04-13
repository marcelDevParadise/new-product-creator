"""Test the archive feature."""
import requests

B = "http://localhost:8000/api"

# Export (archives SKU-001 which has attributes from test_api.py)
r = requests.post(f"{B}/export/ameise")
print(f"[OK] Export: {r.status_code}")

# Active products - SKU-001 should be gone
r = requests.get(f"{B}/products")
active = [p["artikelnummer"] for p in r.json()]
print(f"[OK] Active: {active}")
assert "SKU-001" not in active, "SKU-001 should be archived"

# Archived products - SKU-001 should be here
r = requests.get(f"{B}/products?archived=true")
archived = [p["artikelnummer"] for p in r.json()]
print(f"[OK] Archived: {archived}")
assert "SKU-001" in archived, "SKU-001 should be in archive"

# Unarchive SKU-001
r = requests.post(f"{B}/products/SKU-001/unarchive")
print(f"[OK] Unarchive: {r.status_code}, exported={r.json()['exported']}")
assert r.json()["exported"] == False

# Active again
r = requests.get(f"{B}/products")
active = [p["artikelnummer"] for p in r.json()]
print(f"[OK] Active after unarchive: {active}")
assert "SKU-001" in active, "SKU-001 should be active again"

# Preview should still show SKU-001
r = requests.get(f"{B}/export/preview")
print(f"[OK] Preview: {r.json()['total_products']} products, {r.json()['total_rows']} rows")

print("\n=== All archive tests passed ===")
