#!/usr/bin/env bash
# update-pi.sh — Code aktualisieren und Dienste neu starten.
# Aufruf:   bash deploy/update-pi.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENV_DIR="${REPO_DIR}/.venv"

cd "${REPO_DIR}"

echo "==> git pull"
git pull --ff-only

echo "==> Backend-Dependencies (falls geändert)"
"${VENV_DIR}/bin/pip" install -r backend/requirements.txt

echo "==> Frontend neu bauen"
cd frontend
npm ci
NODE_OPTIONS="--max-old-space-size=2048" npm run build
cd ..

echo "==> Backend-Service neu starten"
sudo systemctl restart attribut-generator.service

echo "==> Caddy reloaden (für statische Files reicht das)"
sudo systemctl reload caddy || sudo systemctl restart caddy

echo "✓ Update fertig."
sudo systemctl status attribut-generator.service --no-pager -l | head -n 12
