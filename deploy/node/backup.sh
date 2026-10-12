#!/usr/bin/env bash
# Nächtliche Sicherung der Datenbank: eine in sich stimmige Kopie per VACUUM INTO, geprüft und mit zstd gepackt (nur die
# gepackte .sqlite.zst bleibt, seit 12.10.2026); die letzten KEEP Stände bleiben (Standard 2). Zurückholen:
#   zstd -d ratsmonitor-JJJJ-MM-TT-HHMM.sqlite.zst -o ratsmonitor.sqlite
# Es liegen nie mehr als KEEP Sicherungen auf der Platte, auch nicht während einer neuen: vorher werden die ältesten bis auf
# KEEP-1 gelöscht. Scheitert die neue Kopie, bleibt bis zur nächsten Nacht entsprechend eine weniger.
# Läuft neben dem Server; Leser und Schreiber werden nicht angehalten (WAL), die ungepackte Kopie braucht vorübergehend
# etwa so viel Platz wie die Datenbank, dazu die gepackte. Installieren (als root):
#   install -m 755 deploy/node/backup.sh /usr/local/bin/ratsmonitor-backup
#   (früher Cron; seit 12.10.2026 ratsmonitor-backup.service über den Zeitplaner, scripts/schedule.mjs backup)
set -euo pipefail
DB="${DATABASE_FILE:-/srv/ratsmonitor/data/ratsmonitor.sqlite}"
DIR="${BACKUP_DIR:-/srv/ratsmonitor/backups}"
KEEP="${KEEP:-2}"
ZSTD_LEVEL="${ZSTD_LEVEL:-6}"
[ -f "$DB" ] || { echo "$(date -Is) keine Datenbank unter $DB"; exit 1; }
# Sicherungen, neueste zuerst: gepackt (.sqlite.zst) und ältere ungepackte (.sqlite)
list() { ls -1t "$DIR"/ratsmonitor-*.sqlite "$DIR"/ratsmonitor-*.sqlite.zst 2>/dev/null || true; }
# Reste abgebrochener Läufe entfernen; sie zählen nicht als Sicherung und belegen Platz
rm -f "$DIR"/ratsmonitor-*.sqlite.part "$DIR"/ratsmonitor-*.sqlite.zst.part
# Vorher Platz für die neue schaffen: höchstens KEEP-1 alte bleiben, damit es mit der neuen nie mehr als KEEP sind
list | tail -n +"$KEEP" | xargs -r rm -f
need=$(stat -c %s "$DB"); free=$(( $(df --output=avail -B1 "$DIR" | tail -1) ))
if [ "$free" -lt $(( need + need / 2 )) ]; then echo "$(date -Is) zu wenig Platz: frei $free, nötig etwa $(( need + need / 2 ))"; exit 1; fi
target="$DIR/ratsmonitor-$(date +%F-%H%M).sqlite"
started=$(date +%s)
# Mit niedriger Priorität: Die Kopie liest die ganze Datei, der Server soll dabei bedienbar bleiben.
nice -n 10 ionice -c2 -n7 sqlite3 "$DB" ".timeout 600000" "VACUUM INTO '$target.part'"
check=$(sqlite3 -readonly "$target.part" "PRAGMA quick_check;")
[ "$check" = ok ] || { echo "$(date -Is) Prüfung der Kopie fehlgeschlagen: $check"; rm -f "$target.part"; exit 1; }
# Der lange Lesevorgang hielt Checkpoints auf; das Protokoll (-wal) jetzt zurückschreiben, damit es nicht weiter wächst.
sqlite3 "$DB" ".timeout 60000" "PRAGMA wal_checkpoint(PASSIVE);" >/dev/null || true
# Packen (zwei Kerne, niedrige Priorität), das Gepackte prüfen, erst dann die ungepackte Kopie löschen
nice -n 10 ionice -c2 -n7 zstd -q -T2 -"$ZSTD_LEVEL" "$target.part" -o "$target.zst.part"
zstd -q -t "$target.zst.part" || { echo "$(date -Is) Prüfung der gepackten Kopie fehlgeschlagen"; rm -f "$target.part" "$target.zst.part"; exit 1; }
rm -f "$target.part"
mv "$target.zst.part" "$target.zst"
list | tail -n +$(( KEEP + 1 )) | xargs -r rm -f
echo "$(date -Is) gesichert: $target.zst ($(du -h "$target.zst" | cut -f1) gepackt aus $(( need / 1073741824 )) GB, $(( $(date +%s) - started )) s)"
