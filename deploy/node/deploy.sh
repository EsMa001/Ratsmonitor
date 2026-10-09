#!/usr/bin/env bash
# Spielt einen Git-Stand auf den Server und startet den Dienst neu. Aufruf vom eigenen Rechner (Git Bash):
#   deploy/node/deploy.sh            # aktueller Commit (HEAD)
#   deploy/node/deploy.sh <commit>   # bestimmter Stand
# Übertragen wird nur, was committet ist (git archive). Gebaut wird auf dem Server (Linux), nicht lokal.
# Voraussetzung: SSH-Alias "ratsmonitor" (root), Einrichtung nach docs/betrieb/node-server.md.
# Fehlende Migrationen spielt das Skript NICHT ein; es bricht dann ab (erst sichern, dann scripts/node-migrate.mjs).
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
envval() { sed -n "s/^$1=//p" /srv/ratsmonitor/ratsmonitor.env | tail -1 | sed 's/^"\(.*\)"$/\1/'; }
DATABASE_FILE="$(envval DATABASE_FILE)"; PORT="$(envval PORT)"
cd "$BUILD"
# strict-dep-builds aus: core-js hat im Repo noch keine Freigabe (pnpm-workspace.yaml), sein Skript zeigt nur einen Spendenhinweis.
echo "Pakete installieren ..."
sudo -u ratsmonitor -H bash -lc "cd '$BUILD' && CI=1 corepack pnpm install --frozen-lockfile --config.strict-dep-builds=false --reporter=append-only > install.log 2>&1 || { tail -30 install.log; exit 1; }"
echo "Bauen (Node) ..."
sudo -u ratsmonitor -H bash -lc "cd '$BUILD' && node scripts/build-node.mjs > build.log 2>&1" || { tail -40 "$BUILD/build.log"; exit 1; }
if [ -n "${DATABASE_FILE:-}" ] && [ -f "$DATABASE_FILE" ]; then
  sudo -u ratsmonitor -H node "$BUILD/scripts/node-migrate.mjs" "$DATABASE_FILE" --check || { echo "Abbruch: Migrationen fehlen. Dienst stoppen, sichern, dann: node scripts/node-migrate.mjs $DATABASE_FILE"; exit 1; }
fi
# Fertigen Bau an seinen Platz. Läuft genau dieser Stand gerade, zuerst auf einen anderen Ordner zeigen lassen.
if [ "$(readlink -f "$APP/current" 2>/dev/null || true)" = "$REL" ]; then
  cp -a "$REL" "$REL.old" && ln -sfn "$REL.old" "$APP/current.new" && mv -T "$APP/current.new" "$APP/current"
fi
rm -rf "$REL" && mv -T "$BUILD" "$REL" && trap - EXIT
ln -sfn "$REL" "$APP/current.new" && mv -T "$APP/current.new" "$APP/current"
rm -rf "$REL.old"
systemctl restart ratsmonitor
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "http://127.0.0.1:${PORT:-3000}/" || true)
  [ "$code" = 200 ] && { echo "läuft: $(readlink "$APP/current")"; break; }
  sleep 2
done
[ "$code" = 200 ] || { echo "Startseite antwortet nicht (HTTP $code)"; journalctl -u ratsmonitor -n 40 --no-pager; exit 1; }
# Die Seiten fallen bei Datenbankfehlern still auf den mitgelieferten Stand zurück; die Suche dagegen meldet einen Fehler.
search=$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 "http://127.0.0.1:${PORT:-3000}/api/search?level=city" || true)
[ "$search" = 200 ] || { echo "Suche antwortet nicht (HTTP $search): Datenbank prüfen"; journalctl -u ratsmonitor -n 40 --no-pager; exit 1; }
journalctl -u ratsmonitor -n 20 --no-pager -o cat | grep -E "Datenbank|Node v" || true
# Alte Stände aufräumen: der laufende und die zwei neuesten anderen bleiben, angefangene Bauten nicht anfassen
for old in $(ls -1dt "$APP"/releases/* | grep -v -e '[.]build$' -e '[.]old$' | grep -vxF "$REL" | tail -n +3); do rm -rf "$old"; done
REMOTE
