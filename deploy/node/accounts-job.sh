#!/usr/bin/env bash
# Kontojob (Zeitplaner „accounts“, Standard 02:40): Fristen und Hinweismails (scripts/accounts/maintenance.mjs), danach die
# verschlüsselte Sicherung der Kontendatei (deploy/node/accounts-backup.sh). Ohne ACCOUNTS_FILE nichts zu tun.
set -euo pipefail
[ -n "${ACCOUNTS_FILE:-}" ] || { echo "$(date -Is) keine Kontendatei eingerichtet"; exit 0; }
node --no-warnings scripts/accounts/maintenance.mjs
bash deploy/node/accounts-backup.sh
