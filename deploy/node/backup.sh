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

# PDF-Ablage (Betriebsplan 15.10.2026): Index (index.sqlite, per .backup) und die Textfassungen (*.txt, die Rechenzeit vieler Nächte;
# die PDFs selbst lassen sich neu laden und werden nicht gesichert). Texte sonntags (oder ohne vorhandene) voll, sonst nur die seit
# der letzten Sicherung geänderten; behalten werden KEEP volle Stände und die Teilstände ab dem ältesten vollen. Scheitert etwas,
# bleibt die Datenbanksicherung oben gültig (Exit 0 mit Meldung).
STORE="${RM_PDF_STORE:-/srv/ratsmonitor/data/pdf-store}"
if [ -f "$STORE/index.sqlite" ]; then
 (
  set -e
  stamp=$(date +%F-%H%M); t0=$(date +%s)
  rm -f "$DIR"/pdf-store-*.part
  idx="$DIR/pdf-store-index-$stamp.sqlite"
  nice -n 10 ionice -c2 -n7 sqlite3 "$STORE/index.sqlite" ".timeout 600000" ".backup '$idx.part'"
  nice -n 10 ionice -c2 -n7 zstd -q -T2 -"$ZSTD_LEVEL" --rm "$idx.part" -o "$idx.zst.part" && mv "$idx.zst.part" "$idx.zst"
  ls -1t "$DIR"/pdf-store-index-*.sqlite.zst 2>/dev/null | tail -n +$(( KEEP + 1 )) | xargs -r rm -f
  marker="$DIR/.pdf-store-texts-stamp"
  if [ "$(date +%u)" = 7 ] || ! ls "$DIR"/pdf-store-texts-full-*.tar.zst >/dev/null 2>&1 || [ ! -f "$marker" ]; then kind=full; else kind=inc; fi
  out="$DIR/pdf-store-texts-$kind-$stamp.tar.zst"; touch "$marker.new"
  if [ "$kind" = full ]; then (cd "$STORE" && find files -name '*.txt' -print0) ; else (cd "$STORE" && find files -name '*.txt' -newer "$marker" -print0); fi \
   | (cd "$STORE" && nice -n 10 ionice -c2 -n7 tar --null -T - -cf -) | nice -n 10 zstd -q -T2 -"$ZSTD_LEVEL" -o "$out.part"
  zstd -q -t "$out.part" && mv "$out.part" "$out" && mv "$marker.new" "$marker"
  # Volle Stände: KEEP behalten; Teilstände älter als der älteste behaltene volle löschen
  ls -1t "$DIR"/pdf-store-texts-full-*.tar.zst | tail -n +$(( KEEP + 1 )) | xargs -r rm -f
  oldest=$(ls -1t "$DIR"/pdf-store-texts-full-*.tar.zst | tail -n 1)
  find "$DIR" -maxdepth 1 -name 'pdf-store-texts-inc-*.tar.zst' ! -newer "$oldest" -delete
  echo "$(date -Is) PDF-Ablage gesichert: Index $(du -h "$idx.zst" | cut -f1), Texte ($kind) $(du -h "$out" | cut -f1), $(( $(date +%s) - t0 )) s"
 ) || echo "$(date -Is) Sicherung der PDF-Ablage fehlgeschlagen; die Datenbanksicherung gilt"
fi

# Stand außer Haus (offene Entscheidung im Betriebsplan): ist BACKUP_REMOTE gesetzt (rclone-Ziel, etwa „objekt:plenara-backups“) und
# rclone installiert, gehen die neuen Sicherungen dorthin; die Aufbewahrung am Ziel regelt dessen Lebenszyklus.
if [ -n "${BACKUP_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
 rclone copy --max-age 2h --include 'ratsmonitor-*.sqlite.zst' --include 'pdf-store-*.zst' "$DIR" "$BACKUP_REMOTE" \
  && echo "$(date -Is) nach $BACKUP_REMOTE kopiert" || echo "$(date -Is) Kopie nach $BACKUP_REMOTE fehlgeschlagen"
fi
