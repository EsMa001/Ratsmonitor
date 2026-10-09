#!/usr/bin/env bash
# Nächtliche Sicherung der Datenbank: eine in sich stimmige Kopie per VACUUM INTO, die letzten KEEP Stände bleiben.
# Läuft neben dem Server; Leser und Schreiber werden nicht angehalten (WAL), die Kopie braucht etwa so viel Platz
# wie die Datenbank. Installieren (als root):
#   install -m 755 deploy/node/backup.sh /usr/local/bin/ratsmonitor-backup
#   echo '30 3 * * * ratsmonitor /usr/local/bin/ratsmonitor-backup >> /srv/ratsmonitor/backups/backup.log 2>&1' > /etc/cron.d/ratsmonitor-backup
set -euo pipefail
DB="${DATABASE_FILE:-/srv/ratsmonitor/data/ratsmonitor.sqlite}"
DIR="${BACKUP_DIR:-/srv/ratsmonitor/backups}"
KEEP="${KEEP:-3}"
[ -f "$DB" ] || { echo "$(date -Is) keine Datenbank unter $DB"; exit 1; }
need=$(stat -c %s "$DB"); free=$(( $(df --output=avail -B1 "$DIR" | tail -1) ))
if [ "$free" -lt $(( need + need / 10 )) ]; then echo "$(date -Is) zu wenig Platz: frei $free, nötig etwa $need"; exit 1; fi
# Reste abgebrochener Läufe entfernen; sie zählen nicht als Sicherung und belegen Platz
rm -f "$DIR"/ratsmonitor-*.sqlite.part
target="$DIR/ratsmonitor-$(date +%F-%H%M).sqlite"
started=$(date +%s)
# Mit niedriger Priorität: Die Kopie liest die ganze Datei, der Server soll dabei bedienbar bleiben.
nice -n 10 ionice -c2 -n7 sqlite3 "$DB" ".timeout 600000" "VACUUM INTO '$target.part'"
check=$(sqlite3 -readonly "$target.part" "PRAGMA quick_check;")
[ "$check" = ok ] || { echo "$(date -Is) Prüfung der Kopie fehlgeschlagen: $check"; rm -f "$target.part"; exit 1; }
mv "$target.part" "$target"
# Der lange Lesevorgang hielt Checkpoints auf; das Protokoll (-wal) jetzt zurückschreiben, damit es nicht weiter wächst.
sqlite3 "$DB" ".timeout 60000" "PRAGMA wal_checkpoint(PASSIVE);" >/dev/null || true
ls -1t "$DIR"/ratsmonitor-*.sqlite | tail -n +$(( KEEP + 1 )) | xargs -r rm -f
echo "$(date -Is) gesichert: $target ($(du -h "$target" | cut -f1), $(( $(date +%s) - started )) s)"
