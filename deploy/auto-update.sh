#!/usr/bin/env bash
# auto-update.sh — Pollt das Git-Remote auf neue Tags und deployt nur bei einem neuen Tag.
#
# Für den systemd-Timer konzipiert. Macht nichts, wenn kein neuer Tag vorhanden ist.
# Deployed wird nur bei Tags, die dem Pattern entsprechen (default: v* und deploy-*).
#
# Aufruf: bash deploy/auto-update.sh
# Logs:   journalctl -u attribut-generator-update.service

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TAG_PATTERN="${TAG_PATTERN:-v* deploy-*}"
STATE_FILE="${REPO_DIR}/.last-deployed-tag"
LOCK_FILE="/tmp/attribut-generator-deploy.lock"

# Verhindert parallele Deployments, auch während der Cron-zu-systemd-Migration.
exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
	echo "[$(date '+%F %T')] Anderer Deploy läuft noch — abbrechen."
	exit 0
fi

cd "${REPO_DIR}"

# Den ursprünglichen Checkout bei Erfolg und bei jedem Fehler wiederherstellen.
# So bleibt der Pi nach einem fehlgeschlagenen Build nicht im detached HEAD.
ORIGINAL_BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
ORIGINAL_COMMIT="$(git rev-parse HEAD)"
restore_checkout() {
	local exit_code=$?
	trap - EXIT
	if [ -n "${ORIGINAL_BRANCH}" ]; then
		git checkout --quiet "${ORIGINAL_BRANCH}" || true
	else
		git checkout --quiet --detach "${ORIGINAL_COMMIT}" || true
	fi
	exit "${exit_code}"
}
trap restore_checkout EXIT

git fetch --quiet --tags --prune origin

# Höchsten passenden Tag nach Erstellungsdatum finden.
# shellcheck disable=SC2086
LATEST_TAG="$(git for-each-ref --sort=-creatordate --format='%(refname:short)' refs/tags/ \
	| grep -E "$(echo ${TAG_PATTERN} | sed 's/ /|/g; s/\*/.*/g')" \
	| head -n 1 || true)"

if [ -z "${LATEST_TAG}" ]; then
	exit 0
fi

LAST_DEPLOYED=""
[ -f "${STATE_FILE}" ] && LAST_DEPLOYED="$(cat "${STATE_FILE}")"

if [ "${LATEST_TAG}" = "${LAST_DEPLOYED}" ]; then
	exit 0
fi

echo ""
echo "============================================================"
echo "[$(date '+%F %T')] Neuer Tag erkannt: ${LATEST_TAG}"
echo "Vorheriger Deploy:                    ${LAST_DEPLOYED:-<keiner>}"
echo "============================================================"

# Datenbanken sind Laufzeitdaten und dürfen nie aus einem Tag ausgecheckt werden.
if git ls-tree -r --name-only "${LATEST_TAG}" \
	| grep -Eqi '\.(db|sqlite|sqlite3|db3|sdb|s3db)(-wal|-shm)?$'; then
	echo "!! Tag enthält eine Datenbankdatei — Deployment abgebrochen."
	exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
	echo "!! Working Tree ist dirty — Deployment abgebrochen."
	exit 1
fi

git checkout --quiet "${LATEST_TAG}"

echo "==> deploy/update-pi.sh"
bash "${REPO_DIR}/deploy/update-pi.sh"

# Erst nach erfolgreichem Update inklusive Healthcheck als deployed markieren.
printf '%s\n' "${LATEST_TAG}" > "${STATE_FILE}"
echo "[$(date '+%F %T')] Deploy fertig (${LATEST_TAG})"

# Der EXIT-Trap stellt den ursprünglichen Checkout wieder her.
