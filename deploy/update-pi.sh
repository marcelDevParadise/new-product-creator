#!/usr/bin/env bash
# update-pi.sh - Code aktualisieren und Dienste neu starten.
# Aufruf:   bash deploy/update-pi.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENV_DIR="${REPO_DIR}/.venv"
RUN_USER="$(id -un)"

cd "${REPO_DIR}"

# git pull nur wenn wir auf einem Branch sind (nicht im detached-HEAD-Tag-Modus von auto-update.sh)
if git symbolic-ref -q HEAD >/dev/null; then
	echo "==> git pull"
	git pull --ff-only
else
	echo "==> Detached HEAD ($(git describe --tags --always)) - ueberspringe git pull"
fi

echo "==> Backend-Dependencies (falls geaendert)"
"${VENV_DIR}/bin/pip" install -r backend/requirements.txt

echo "==> Image Library aktualisieren"
sudo install -d -o "${RUN_USER}" -g "${RUN_USER}" -m 0755 /srv/images
sudo chown -R "${RUN_USER}:${RUN_USER}" /srv/images
sudo install -m 0755 "${REPO_DIR}/rebuild-image-index.py" /usr/local/bin/rebuild-image-index
if ! grep -q '^IMAGE_LIBRARY_ROOT=' backend/.env; then
	echo "IMAGE_LIBRARY_ROOT=/srv/images" >> backend/.env
fi
if ! grep -q '^IMAGE_UPLOAD_TOKEN=' backend/.env; then
	IMAGE_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
	echo "IMAGE_UPLOAD_TOKEN=${IMAGE_TOKEN}" >> backend/.env
	echo ""
	echo "==> Neuer Image-Upload-Token:"
	echo "    ${IMAGE_TOKEN}"
	echo "    Speichere ihn fuer Upload-Skripte."
fi
sudo -u "${RUN_USER}" env IMAGE_LIBRARY_ROOT=/srv/images /usr/local/bin/rebuild-image-index || true

echo "==> Frontend neu bauen"
cd frontend
npm ci
NODE_OPTIONS="--max-old-space-size=2048" npm run build
cd ..

echo "==> systemd-Unit und Caddyfile aktualisieren"
sed -e "s|__USER__|${RUN_USER}|g" -e "s|__REPO__|${REPO_DIR}|g" \
	"${REPO_DIR}/deploy/attribut-generator.service" \
	| sudo tee /etc/systemd/system/attribut-generator.service > /dev/null
sudo systemctl daemon-reload

sed -e "s|__REPO__|${REPO_DIR}|g" "${REPO_DIR}/deploy/Caddyfile" \
	| sudo tee /etc/caddy/Caddyfile > /dev/null

echo "==> Backend-Service neu starten"
sudo systemctl restart attribut-generator.service

echo "==> Caddy reloaden"
sudo systemctl reload caddy || sudo systemctl restart caddy

echo "OK: Update fertig."
sudo systemctl status attribut-generator.service --no-pager -l | head -n 12
