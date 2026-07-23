"""Image hosting upload API."""

from __future__ import annotations

import hmac
import os
import re
import shlex
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile


router = APIRouter(prefix="/api/images", tags=["images"])

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg"}
DEFAULT_ROOT = Path("/srv/images")
CHUNK_SIZE = 1024 * 1024


def _image_root() -> Path:
    return Path(os.environ.get("IMAGE_LIBRARY_ROOT", str(DEFAULT_ROOT))).resolve()


def _max_upload_bytes() -> int:
    value = os.environ.get("IMAGE_UPLOAD_MAX_MB", "50")
    try:
        mb = int(value)
    except ValueError:
        mb = 50
    return max(1, mb) * 1024 * 1024


def _extract_token(authorization: str | None, x_image_upload_token: str | None) -> str:
    if x_image_upload_token:
        return x_image_upload_token.strip()
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return ""


def require_upload_token(
    authorization: Annotated[str | None, Header()] = None,
    x_image_upload_token: Annotated[str | None, Header()] = None,
) -> None:
    expected = os.environ.get("IMAGE_UPLOAD_TOKEN", "").strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="IMAGE_UPLOAD_TOKEN ist nicht gesetzt. Upload-API ist deaktiviert.",
        )

    token = _extract_token(authorization, x_image_upload_token)
    if not token or not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="Ungueltiger Upload-Token.")


def _slugify_segment(value: str, fallback: str) -> str:
    value = value.strip().lower()
    replacements = {
        "\u00e4": "ae",
        "\u00f6": "oe",
        "\u00fc": "ue",
        "\u00df": "ss",
        "\u00c3\u00a4": "ae",
        "\u00c3\u00b6": "oe",
        "\u00c3\u00bc": "ue",
        "\u00c3\u009f": "ss",
    }
    for old, new in replacements.items():
        value = value.replace(old, new)
    value = unicodedata.normalize("NFKD", value)
    value = "".join(c for c in value if not unicodedata.combining(c))
    value = re.sub(r"[^a-z0-9._-]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-._")
    return value or fallback


def _safe_filename(value: str) -> str:
    name = Path(value).name
    suffix = Path(name).suffix.lower()
    stem = Path(name).stem
    if suffix not in IMAGE_EXTS:
        raise HTTPException(400, "Nur Bilddateien sind erlaubt.")
    return f"{_slugify_segment(stem, 'bild')}{suffix}"


def _target_path(root: Path, brand: str, product: str, filename: str) -> Path:
    target = root / "produkte" / brand / product / filename
    resolved = target.resolve()
    if root != resolved and root not in resolved.parents:
        raise HTTPException(400, "Ungueltiger Zielpfad.")
    return resolved


def _existing_image_path(root: Path, relative_path: str) -> Path:
    """Resolve a library-relative image path without allowing path traversal."""
    candidate = (root / relative_path.lstrip("/")).resolve()
    if root != candidate and root not in candidate.parents:
        raise HTTPException(400, "Ungueltiger Bildpfad.")
    if candidate.suffix.lower() not in IMAGE_EXTS:
        raise HTTPException(400, "Nur Bilddateien koennen geloescht werden.")
    if not candidate.is_file():
        raise HTTPException(404, "Bild wurde nicht gefunden.")
    return candidate


def _brand_path(root: Path, brand: str) -> Path:
    """Resolve a brand directory from the canonical products hierarchy."""
    safe_brand = _slugify_segment(brand, "")
    if not safe_brand or safe_brand != brand:
        raise HTTPException(400, "Ungueltige Marke.")
    candidate = (root / "produkte" / safe_brand).resolve()
    if root not in candidate.parents:
        raise HTTPException(400, "Ungueltiger Markenpfad.")
    if not candidate.is_dir():
        raise HTTPException(404, "Marke wurde nicht gefunden.")
    return candidate


def _remove_empty_parents(path: Path, stop: Path) -> None:
    """Remove empty product/brand directories, but never the products root."""
    current = path
    while current != stop and stop in current.parents:
        try:
            current.rmdir()
        except OSError:
            break
        current = current.parent


def _rebuild_index() -> dict:
    script = os.environ.get("IMAGE_REBUILD_COMMAND", "").strip()
    if script:
        command = shlex.split(script)
    else:
        repo_script = Path(__file__).resolve().parents[2] / "rebuild-image-index.py"
        if repo_script.exists():
            command = [sys.executable, str(repo_script)]
        else:
            command = ["rebuild-image-index"]

    env = os.environ.copy()
    env.setdefault("IMAGE_LIBRARY_ROOT", str(_image_root()))

    try:
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            timeout=60,
            env=env,
        )
    except FileNotFoundError:
        return {"ok": False, "error": "Indexer wurde nicht gefunden."}
    except subprocess.CalledProcessError as exc:
        return {"ok": False, "error": exc.stderr.strip() or exc.stdout.strip()}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "Indexer hat zu lange gebraucht."}

    return {"ok": True, "output": result.stdout.strip()}


@router.post("/upload", dependencies=[Depends(require_upload_token)])
async def upload_image(
    file: Annotated[UploadFile, File()],
    brand: Annotated[str, Form()] = "sonstige",
    product: Annotated[str, Form()] = "ohne-produktgruppe",
    filename: Annotated[str | None, Form()] = None,
    overwrite: Annotated[bool, Form()] = False,
    rebuild: Annotated[bool, Form()] = True,
):
    """Upload one image into /srv/images/produkte/<brand>/<product>/."""
    if not file.filename and not filename:
        raise HTTPException(400, "Dateiname fehlt.")

    root = _image_root()
    safe_brand = _slugify_segment(brand, "sonstige")
    safe_product = _slugify_segment(product, "ohne-produktgruppe")
    safe_name = _safe_filename(filename or file.filename or "bild")
    target = _target_path(root, safe_brand, safe_product, safe_name)

    if target.exists() and not overwrite:
        raise HTTPException(409, "Datei existiert bereits. overwrite=true setzen, wenn sie ersetzt werden soll.")

    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_name(f".{target.name}.uploading")
    max_bytes = _max_upload_bytes()
    total = 0

    try:
        with tmp.open("wb") as handle:
            while chunk := await file.read(CHUNK_SIZE):
                total += len(chunk)
                if total > max_bytes:
                    raise HTTPException(413, f"Datei ist groesser als {max_bytes // 1024 // 1024} MB.")
                handle.write(chunk)
        shutil.move(str(tmp), str(target))
    finally:
        if tmp.exists():
            tmp.unlink()

    relative_path = target.relative_to(root).as_posix()
    index_result = _rebuild_index() if rebuild else {"ok": None, "skipped": True}

    return {
        "uploaded": True,
        "path": relative_path,
        "url": f"/images/{relative_path}",
        "size": total,
        "rebuild": index_result,
    }


@router.post("/rebuild", dependencies=[Depends(require_upload_token)])
def rebuild_image_index():
    """Rebuild /srv/images/index.html after external file changes."""
    return _rebuild_index()


@router.delete("/file", dependencies=[Depends(require_upload_token)])
def delete_image(
    path: Annotated[str, Query(min_length=1)],
):
    """Delete one image and clean up directories that became empty."""
    root = _image_root()
    target = _existing_image_path(root, path)
    relative_path = target.relative_to(root).as_posix()
    target.unlink()
    _remove_empty_parents(target.parent, root / "produkte")

    return {
        "deleted": True,
        "path": relative_path,
        "rebuild": _rebuild_index(),
    }


@router.delete("/brand/{brand}", dependencies=[Depends(require_upload_token)])
def delete_brand(brand: str):
    """Delete a brand directory and every image below it."""
    root = _image_root()
    target = _brand_path(root, brand)
    image_count = sum(
        1
        for item in target.rglob("*")
        if item.is_file() and item.suffix.lower() in IMAGE_EXTS
    )
    shutil.rmtree(target)

    return {
        "deleted": True,
        "brand": brand,
        "images": image_count,
        "rebuild": _rebuild_index(),
    }
