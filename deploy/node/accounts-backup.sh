#!/usr/bin/env bash
# Sicherung der Kontendatei (requirements/konten-konzept.md 12): VACUUM INTO in ein tmpfs, geprüft, gepackt und mit age
# verschlüsselt; unverschlüsselte Kontodaten landen nie auf der Platte. Ohne age-Empfänger: Abbruch (keine Sicherung).
# Die letzten KEEP Stände bleiben (Standard 7). Zurückholen: age -d -i schluessel.txt datei.sqlite.zst.age | zstd -d > accounts.sqlite
set -euo pipefail
DB="${ACCOUNTS_FILE:?ACCOUNTS_FILE fehlt}"
DIR="${ACCOUNTS_BACKUP_DIR:-$(dirname "$DB")/backups}"
KEEP="${KEEP:-7}"
PREFIX="${PREFIX:-accounts-}"
TMP="${ACCOUNTS_BACKUP_TMP:-/run/accounts-backup}"
RECIPIENT="${ACCOUNTS_AGE_RECIPIENT:-}"
[ -f "$DB" ] || { echo "$(date -Is) keine Kontendatei unter $DB"; exit 1; }
[ -n "$RECIPIENT" ] || { echo "$(date -Is) ACCOUNTS_AGE_RECIPIENT fehlt: keine unverschlüsselte Sicherung"; exit 1; }
command -v age >/dev/null || { echo "$(date -Is) age ist nicht installiert (apt install age)"; exit 1; }
[ -d "$DIR" ] && [ ! -L "$DIR" ] || { echo "$(date -Is) Sicherungsordner fehlt oder ist ein Verweis: $DIR"; exit 1; }
mkdir -p "$TMP"
umask 077
copy="$TMP/accounts-$$.sqlite"
trap 'rm -f "$copy"' EXIT
sqlite3 "$DB" ".timeout 60000" "VACUUM INTO '$copy'"
check=$(sqlite3 -readonly "$copy" "PRAGMA quick_check;")
[ "$check" = ok ] || { echo "$(date -Is) Prüfung der Kopie fehlgeschlagen: $check"; exit 1; }
target="$DIR/${PREFIX}$(date +%F-%H%M%S).sqlite.zst.age"
set -o pipefail
zstd -q -c "$copy" | age -r "$RECIPIENT" > "$target.part" || { rm -f "$target.part"; echo "$(date -Is) Packen oder Verschlüsseln fehlgeschlagen"; exit 1; }
mv "$target.part" "$target"
ls -1t "$DIR"/"$PREFIX"*.sqlite.zst.age 2>/dev/null | tail -n +$(( KEEP + 1 )) | xargs -r rm -f
echo "$(date -Is) Kontendatei gesichert: $target ($(du -h "$target" | cut -f1))"
