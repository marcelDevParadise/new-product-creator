#!/usr/bin/env bash
# setup-pi.sh — Erstmalige Installation des Attribut Generators auf dem Raspberry Pi.
# Annahmen:
#   - PostgreSQL läuft bereits (siehe ideen/raspberry-pi-setup.md, Teil 1-3)
#   - Tailscale ist eingerichtet (Teil 2)
#   - Repo ist nach /home/pi/new-product-creator geklont
#
# Aufruf:   bash deploy/setup-pi.sh

set -euo pipefail

# Repo-Pfad = Verzeichnis ueber diesem Skript (deploy/), absolut aufgeloest
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENV_DIR="${REPO_DIR}/.venv"
RUN_USER="$(id -un)"

echo "==> Repo:  ${REPO_DIR}"
echo "==> User:  ${RUN_USER}"

echo "==> System-Pakete (Python, Caddy, Tools)"
sudo apt update
sudo apt install -y python3 python3-venv python3-pip debian-keyring debian-archive-keyring apt-transport-https curl ca-certificates gnupg

echo "==> Node.js 20 via NodeSource (enthaelt npm)"
# Falls altes Debian-npm/nodejs installiert ist -> entfernen, weil es mit NodeSource kollidiert
sudo apt remove -y nodejs npm libnode72 libnode-dev 2>/dev/null || true
sudo apt autoremove -y
if [ ! -f /etc/apt/sources.list.d/nodesource.list ]; then
	curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
fi
sudo apt install -y nodejs
node --version
npm --version

if ! command -v caddy >/dev/null 2>&1; then
	echo "==> Caddy installieren"
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
	sudo apt update
	sudo apt install -y caddy
fi

echo "==> Python venv + Backend-Dependencies"
if [ ! -d "${VENV_DIR}" ]; then
	python3 -m venv "${VENV_DIR}"
fi
"${VENV_DIR}/bin/pip" install --upgrade pip
"${VENV_DIR}/bin/pip" install -r "${REPO_DIR}/backend/requirements.txt"

if [ ! -f "${REPO_DIR}/backend/.env" ]; then
	echo ""
	echo "!! backend/.env fehlt."
	echo "!! Erstelle die Datei mit DATABASE_URL=postgresql://attributgen:PASSWORT@127.0.0.1:5432/attribut_generator"
	echo "!! Vorlage: cp backend/.env.example backend/.env"
	exit 1
fi

echo "==> Frontend bauen (npm ci + build)"
cd "${REPO_DIR}/frontend"
npm ci
NODE_OPTIONS="--max-old-space-size=2048" npm run build
cd "${REPO_DIR}"

echo "==> systemd-Unit fuer Backend installieren (User=${RUN_USER}, Repo=${REPO_DIR})"
sed -e "s|__USER__|${RUN_USER}|g" -e "s|__REPO__|${REPO_DIR}|g" \
	"${REPO_DIR}/deploy/attribut-generator.service" \
	| sudo tee /etc/systemd/system/attribut-generator.service > /dev/null
sudo systemctl daemon-reload
sudo systemctl enable attribut-generator.service
sudo systemctl restart attribut-generator.service

echo "==> Caddy konfigurieren"
sed -e "s|__REPO__|${REPO_DIR}|g" "${REPO_DIR}/deploy/Caddyfile" \
	| sudo tee /etc/caddy/Caddyfile > /dev/null
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy
sudo systemctl restart caddy
sudo systemctl enable caddy

echo "==> Tailscale Serve aktivieren (HTTPS auf 443 → lokaler Caddy auf 8080)"
sudo tailscale serve --bg --https 443 http://127.0.0.1:8080 || true

echo ""
echo "✓ Installation fertig."
echo ""
echo "Status prüfen:"
echo "  sudo systemctl status attribut-generator caddy"
echo "  sudo journalctl -u attribut-generator -f"
echo ""
echo "URL:"
TS_NAME="$(tailscale status --self --json 2>/dev/null | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["Self"]["DNSName"].rstrip("."))' 2>/dev/null || echo "<dein-host>.ts.net")"
echo "  https://${TS_NAME}/"
