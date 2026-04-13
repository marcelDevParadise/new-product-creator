"""Quick check: do products survive a server restart?"""
import requests

r = requests.get("http://localhost:8000/api/products")
data = r.json()
print(f"{len(data)} Produkte nach Neustart:")
for p in data:
    print(f"  {p['artikelnummer']}: {p['artikelname']} (attrs={len(p['attributes'])})")

if len(data) > 0:
    print("\n=== Persistenz funktioniert! ===")
else:
    print("\n=== FEHLER: Keine Daten nach Neustart ===")
