#!/usr/bin/env bash
# auto-update.sh — Pollt das Git-Remote auf neue Tags und deployt nur bei einem neuen Tag.
#
# Designed fuer Cron (alle paar Minuten). Macht NICHTS wenn kein neuer Tag da ist.
# Deployed wird NUR bei Tags die dem Pattern entsprechen (default: v* und deploy-*).
#
# Aufruf:   bash deploy/auto-update.sh           (manuell)
# Cron:     */5 * * * * /home/marcel/new-product-creator/deploy/auto-update.sh >> /var/log/attribut-generator-deploy.log 2>&1

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TAG_PATTERN="${TAG_PATTERN:-v* deploy-*}"          # Welche Tags triggern deploy
STATE_FILE="${REPO_DIR}/.last-deployed-tag"        # Speichert zuletzt deployten Tag
LOCK_FILE="/tmp/attribut-generator-deploy.lock"

# --- Lock damit zwei Cron-Runs nicht kollidieren ---
exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
	echo "[$(date '+%F %T')] Anderer Deploy laeuft noch \u2014 abbrechen."
	exit 0
fi

cd "${REPO_DIR}"

# --- Aktuellen Branch tracken (default master) ---
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# --- Remote refreshen ---
git fetch --quiet --tags --prune origin

# --- Hoechsten matching-Tag nach commit-date finden ---
# shellcheck disable=SC2086
LATEST_TAG="$(git for-each-ref --sort=-creatordate --format='%(refname:short)' refs/tags/ \
	| grep -E "$(echo ${TAG_PATTERN} | sed 's/ /|/g; s/\*/.*/g')" \
	| head -n 1 || true)"

if [ -z "${LATEST_TAG}" ]; then
	exit 0  # gar kein passender Tag im Repo
fi

LAST_DEPLOYED=""
[ -f "${STATE_FILE}" ] && LAST_DEPLOYED="$(cat "${STATE_FILE}")"

if [ "${LATEST_TAG}" = "${LAST_DEPLOYED}" ]; then
	exit 0  # nichts zu tun
fi

echo ""
echo "============================================================"
echo "[$(date '+%F %T')] Neuer Tag erkannt: ${LATEST_TAG}"
echo "Vorheriger Deploy:                    ${LAST_DEPLOYED:-<keiner>}"
echo "============================================================"

# --- Auf den Tag wechseln (detached HEAD), dabei working tree clean halten ---
if ! git diff --quiet || ! git diff --cached --quiet; then
	echo "!! Working tree ist dirty \u2014 abbrechen."
	exit 1
fi

git checkout --quiet "${LATEST_TAG}"

# --- Update ausfuehren ---
echo "==> deploy/update-pi.sh"
bash "${REPO_DIR}/deploy/update-pi.sh"

# --- Tag-Marker schreiben ---
echo "${LATEST_TAG}" > "${STATE_FILE}"

echo "[$(date '+%F %T')] Deploy fertig (${LATEST_TAG})"

# Wieder zurueck auf den Branch (damit git pull spaeter funktioniert)
git checkout --quiet "${BRANCH}" || true
