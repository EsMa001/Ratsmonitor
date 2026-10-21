#!/usr/bin/env bash
# Spielt einen Git-Stand auf den Server und startet den Dienst neu. Aufruf vom eigenen Rechner (Git Bash):
#   deploy/node/deploy.sh            # aktueller Commit (HEAD)
#   deploy/node/deploy.sh <commit>   # bestimmter Stand
# Übertragen wird nur, was committet ist (git archive). Gebaut wird auf dem Server (Linux), nicht lokal.
# Voraussetzung: SSH-Alias "ratsmonitor" (root), Einrichtung nach docs/betrieb/node-server.md.
# Fehlende Migrationen der Inhaltsdatei spielt das Skript NICHT ein; es bricht dann ab (erst sichern, dann
# scripts/node-migrate.mjs). Ausnahme Kontendatei (ACCOUNTS_FILE in /etc/ratsmonitor/accounts.env): ihre
# Migrationen (drizzle-accounts/) sind klein und nur additiv; das Skript sichert die Datei vorher und spielt sie ein.
set -euo pipefail
HOST="${RM_HOST:-ratsmonitor}"
REF="${1:-HEAD}"
SHA="$(git rev-parse --short=12 "$REF")"
APP=/srv/ratsmonitor/app
REL="$APP/releases/$SHA"

# Gebaut wird in einem eigenen Ordner; erst nach erfolgreichem Bau ersetzt er den Stand. Ein laufender Stand wird nie
# angefasst, auch nicht, wenn derselbe Commit noch einmal aufgespielt wird.
BUILD="$REL.build"

echo "Stand $SHA nach $HOST:$REL"
# Ohne Zeilenende-Umwandlung: Unter Windows (core.autocrlf=true) bekämen die Shell-Skripte sonst CRLF.
git -c core.autocrlf=false -c core.eol=lf archive --format=tar "$SHA" | ssh "$HOST" "rm -rf '$BUILD' && mkdir -p '$BUILD' && tar -x -C '$BUILD' && chown -R ratsmonitor:ratsmonitor '$BUILD'"

ssh "$HOST" bash -s -- "$REL" "$APP" "$BUILD" <<'REMOTE'
set -euo pipefail
REL="$1"; APP="$2"; BUILD="$3"
trap 'rm -rf "$BUILD"' EXIT
# Nur die zwei Werte lesen, die das Skript braucht (die Datei ist für systemd geschrieben, nicht für die Shell)
envval() { sed -n "s/^$1=//p" "${2:-/srv/ratsmonitor/ratsmonitor.env}" 2>/dev/null | tail -1 | sed 's/^"\(.*\)"$/\1/'; }
DATABASE_FILE="$(envval DATABASE_FILE)"; PORT="$(envval PORT)"; IMPORT_TOKEN="$(envval IMPORT_TOKEN)"; RM_ACCESS="$(envval RM_ACCESS)"
ACCOUNTS_ENV=/etc/ratsmonitor/accounts.env
ACCOUNTS_FILE="$(envval ACCOUNTS_FILE "$ACCOUNTS_ENV")"; ACCOUNTS_AGE_RECIPIENT="$(envval ACCOUNTS_AGE_RECIPIENT "$ACCOUNTS_ENV")"
cd "$BUILD"
# strict-dep-builds aus: core-js hat im Repo noch keine Freigabe (pnpm-workspace.yaml), sein Skript zeigt nur einen Spendenhinweis.
echo "Pakete installieren ..."
sudo -u ratsmonitor -H bash -lc "cd '$BUILD' && CI=1 corepack pnpm install --frozen-lockfile --config.strict-dep-builds=false --reporter=append-only > install.log 2>&1 || { tail -30 install.log; exit 1; }"
echo "Bauen (Node) ..."
sudo -u ratsmonitor -H bash -lc "cd '$BUILD' && node scripts/build-node.mjs > build.log 2>&1" || { tail -40 "$BUILD/build.log"; exit 1; }
[ -f "$BUILD/dist/standalone/worker/import-worker.mjs" ] || { echo "Abbruch: der Importprozess (dist/standalone/worker/import-worker.mjs) wurde nicht gebaut"; exit 1; }
if [ -n "${DATABASE_FILE:-}" ] && [ -f "$DATABASE_FILE" ]; then
  sudo -u ratsmonitor -H node "$BUILD/scripts/node-migrate.mjs" "$DATABASE_FILE" --check || { echo "Abbruch: Migrationen fehlen. Importprozess und Timer stoppen (systemctl stop ratsmonitor-import.timer ratsmonitor-import-nightly.timer ratsmonitor-import ratsmonitor-import-nightly), Dienst stoppen, sichern, dann: node scripts/node-migrate.mjs $DATABASE_FILE"; exit 1; }
fi
# Kontendatei: vorher verschlüsselt sichern (deploy/node/accounts-backup.sh, tmpfs, age; ohne Empfänger Abbruch), dann
# Migrationen einspielen. Alles als ratsmonitor, root schreibt nichts in den Kontenordner (der gehört dem Web-Benutzer).
# Der laufende alte Stand arbeitet mit den neuen Spalten weiter (nur additiv).
if [ -n "${ACCOUNTS_FILE:-}" ]; then
  if [ -f "$ACCOUNTS_FILE" ]; then
    [ -n "${ACCOUNTS_AGE_RECIPIENT:-}" ] || { echo "Abbruch: ACCOUNTS_AGE_RECIPIENT fehlt in $ACCOUNTS_ENV (keine unverschlüsselte Sicherung)"; exit 1; }
    TMPDIR_PRE="$(sudo -u ratsmonitor mktemp -d -p /dev/shm rm-accounts-XXXXXX)"
    sudo -u ratsmonitor env ACCOUNTS_FILE="$ACCOUNTS_FILE" ACCOUNTS_AGE_RECIPIENT="$ACCOUNTS_AGE_RECIPIENT" ACCOUNTS_BACKUP_TMP="$TMPDIR_PRE" PREFIX=pre- KEEP=3 \
      bash "$BUILD/deploy/node/accounts-backup.sh" || { rm -rf "$TMPDIR_PRE"; echo "Abbruch: Sicherung der Kontendatei fehlgeschlagen"; exit 1; }
    rm -rf "$TMPDIR_PRE"
  fi
  sudo -u ratsmonitor -H node "$BUILD/scripts/node-migrate.mjs" "$ACCOUNTS_FILE" --dir drizzle-accounts --table accounts_migrations || { echo "Abbruch: Migration der Kontendatei fehlgeschlagen"; exit 1; }
fi
# Fertigen Bau an seinen Platz. Läuft genau dieser Stand gerade, zuerst auf einen anderen Ordner zeigen lassen.
if [ "$(readlink -f "$APP/current" 2>/dev/null || true)" = "$REL" ]; then
  cp -a "$REL" "$REL.old" && ln -sfn "$REL.old" "$APP/current.new" && mv -T "$APP/current.new" "$APP/current"
fi
rm -rf "$REL" && mv -T "$BUILD" "$REL" && trap - EXIT
ln -sfn "$REL" "$APP/current.new" && mv -T "$APP/current.new" "$APP/current"
rm -rf "$REL.old"
# Ein laufender Importprozess (ratsmonitor-import*.service) hat seinen Stand im Speicher und läuft weiter; der nächste
# Lauf des Timers nimmt den neuen Stand. Nur zur Kenntnis.
for unit in ratsmonitor-import ratsmonitor-import-nightly; do systemctl is-active --quiet "$unit" 2>/dev/null && echo "Hinweis: $unit läuft gerade (alter Stand bis zu seinem Ende; Protokoll: journalctl -u $unit)"; done
systemctl restart ratsmonitor
# Kunden-MCP (ratsmonitor-mcp.service) liest den Stand nur beim Start; ist er nicht eingerichtet, passiert nichts
systemctl try-restart ratsmonitor-mcp 2>/dev/null || true
# Im Einladungsmodus (RM_ACCESS=invite) leitet die Startseite um (302) und die Suche verlangt eine Anmeldung; geprüft wird
# dann mit dem internen Token (IMPORT_TOKEN), der Gesundheitsweg meldet Inhalts- und Kontendatei.
AUTH=(); if [ -n "${IMPORT_TOKEN:-}" ]; then HF="$(mktemp)"; trap 'rm -f "$HF"' EXIT; printf 'Authorization: Bearer %s\n' "$IMPORT_TOKEN" > "$HF"; AUTH=(-H @"$HF"); fi
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "http://127.0.0.1:${PORT:-3000}/" || true)
  { [ "$code" = 200 ] || { [ "${RM_ACCESS:-}" = invite ] && [ "$code" = 302 ]; }; } && { echo "läuft: $(readlink "$APP/current")"; break; }
  sleep 2
done
{ [ "$code" = 200 ] || { [ "${RM_ACCESS:-}" = invite ] && [ "$code" = 302 ]; }; } || { echo "Startseite antwortet nicht (HTTP $code)"; journalctl -u ratsmonitor -n 40 --no-pager; exit 1; }
# Die Seiten fallen bei Datenbankfehlern still auf den mitgelieferten Stand zurück; die Suche dagegen meldet einen Fehler.
search=$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 "${AUTH[@]}" "http://127.0.0.1:${PORT:-3000}/api/search?level=city" || true)
[ "$search" = 200 ] || { echo "Suche antwortet nicht (HTTP $search): Datenbank prüfen"; journalctl -u ratsmonitor -n 40 --no-pager; exit 1; }
if [ -n "${IMPORT_TOKEN:-}" ]; then
  health=$(curl -s --max-time 20 "${AUTH[@]}" "http://127.0.0.1:${PORT:-3000}/api/internal/health" || true)
  echo "Zustand: $health"
  case "$health" in *'"ok":true'*) ;; *) echo "Gesundheitsweg meldet ein Problem"; journalctl -u ratsmonitor -n 40 --no-pager; exit 1;; esac
  if [ -n "${RM_ACCESS:-}" ]; then case "$health" in *"\"access\":\"$RM_ACCESS\""*) ;; *) echo "Zugang laut Server weicht von RM_ACCESS=$RM_ACCESS ab"; exit 1;; esac; fi
fi
journalctl -u ratsmonitor -n 20 --no-pager -o cat | grep -E "Datenbank|Node v" || true
# Alte Stände aufräumen: der laufende und die zwei neuesten anderen bleiben, angefangene Bauten nicht anfassen. Ein Stand, in dem
# noch ein Job arbeitet (Arbeitsordner eines Prozesses, etwa die Verarbeitung, die Schritt für Schritt Skripte aus ihrem Stand
# startet), bleibt bis zum nächsten Ausrollen liegen; sonst fehlten ihm mitten im Lauf die Skripte (16.10.2026: drei Deploys an
# einem Tag während laufender Jobs).
in_use() { for p in /proc/[0-9]*; do c=$(readlink "$p/cwd" 2>/dev/null) || continue; case "$c" in "$1"|"$1"/*) return 0;; esac; done; return 1; }
for old in $(ls -1dt "$APP"/releases/* | grep -v -e '[.]build$' -e '[.]old$' | grep -vxF "$REL" | tail -n +3); do
  if in_use "$old"; then echo "Hinweis: $(basename "$old") wird noch von einem laufenden Job genutzt, bleibt bis zum nächsten Ausrollen"; else rm -rf "$old"; fi
done
jobs=$(systemctl list-units 'ratsmonitor-*.service' --state=active --no-legend 2>/dev/null | awk '{print $1}' | grep -vx 'ratsmonitor-mcp.service' | tr '\n' ' ')
[ -n "$jobs" ] && echo "Hinweis: laufende Jobs ($jobs) arbeiten mit ihrem bisherigen Stand weiter; der nächste Lauf nimmt den neuen"
true
REMOTE
