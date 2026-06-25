#!/usr/bin/env python3
"""Upload one image to the Raspberry Pi image hosting API."""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import secrets
import urllib.error
import urllib.request
from pathlib import Path


def _part(name: str, value: str, boundary: str) -> bytes:
    return (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
        f"{value}\r\n"
    ).encode("utf-8")


def _file_part(name: str, path: Path, boundary: str) -> bytes:
    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    header = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{name}"; filename="{path.name}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode("utf-8")
    return header + path.read_bytes() + b"\r\n"


def upload(args: argparse.Namespace) -> dict:
    boundary = f"----image-upload-{secrets.token_hex(16)}"
    body = b"".join(
        [
            _part("brand", args.brand, boundary),
            _part("product", args.product, boundary),
            _part("overwrite", "true" if args.overwrite else "false", boundary),
            _part("rebuild", "true" if args.rebuild else "false", boundary),
            _file_part("file", args.file, boundary),
            f"--{boundary}--\r\n".encode("utf-8"),
        ]
    )

    request = urllib.request.Request(
        f"{args.base_url.rstrip('/')}/api/images/upload",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {args.token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Accept": "application/json",
        },
    )

    with urllib.request.urlopen(request, timeout=args.timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Bild per API auf den Pi hochladen.")
    parser.add_argument("file", type=Path, help="Lokale Bilddatei")
    parser.add_argument("--base-url", required=True, help="z.B. https://dein-pi.tailnet.ts.net")
    parser.add_argument("--token", default=os.environ.get("IMAGE_UPLOAD_TOKEN"), help="Upload-Token")
    parser.add_argument("--brand", default="sonstige", help="Marke/Hersteller")
    parser.add_argument("--product", default="ohne-produktgruppe", help="Produktgruppe")
    parser.add_argument("--overwrite", action="store_true", help="Bestehende Datei ersetzen")
    parser.add_argument("--no-rebuild", dest="rebuild", action="store_false", help="Index nicht neu bauen")
    parser.add_argument("--timeout", type=int, default=120, help="HTTP-Timeout in Sekunden")
    parser.set_defaults(rebuild=True)
    args = parser.parse_args()

    if not args.file.is_file():
        parser.error(f"Datei nicht gefunden: {args.file}")
    if not args.token:
        parser.error("--token fehlt oder IMAGE_UPLOAD_TOKEN ist nicht gesetzt")

    try:
        result = upload(args)
    except urllib.error.HTTPError as exc:
        print(exc.read().decode("utf-8", errors="replace"))
        return 1

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
