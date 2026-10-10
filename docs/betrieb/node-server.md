# Betrieb auf dem eigenen Server (Node statt Cloudflare)

Stand: 9. Oktober 2026. Gilt für den Zweig `node-server` und den Hostinger-VPS (KVM 4, Deutschland, Ubuntu 24.04).

## Was läuft wo

```
Browser ─▶ SSH-Tunnel ─▶ Caddy 127.0.0.1:8080 ─▶ Node 127.0.0.1:3000 (Seiten, API, Admin, Importe) ─▶ SQLite-Datei
                          setzt Admin-Kennung      dist/standalone/serve.mjs                         /srv/ratsmonitor/data/
```

- **Ein Node-Prozess** liefert Oberfläche, API und Admin aus. Gebaut mit `npm run build:node`.
- **Die Datenbank** ist dieselbe SQLite-Datei wie lokal unter `.wrangler/`, nur an anderem Ort. Der Code spricht sie
  weiter wie D1 an; `server/node/d1-sqlite.mjs` übersetzt.
- **Lokal ändert sich nichts.** `npm run dev` läuft weiter mit Miniflare, `npm run build` baut weiter für Cloudflare.

## Wie der Node-Build funktioniert

| Teil | Datei | Aufgabe |
|---|---|---|
| Umschalter | `vite.config.ts`, `next.config.ts` | Mit `RM_TARGET=node` ohne Cloudflare-Plugin, Ausgabe `standalone` |
| Ersatzmodul | `server/node/cloudflare-workers.mjs` | `import {env} from 'cloudflare:workers'` liefert `env.DB` und Werte aus der Umgebung |
| Datenbank-Adapter | `server/node/d1-sqlite.mjs` | D1-Verhalten über node:sqlite |
| Einstieg | `server/node/serve.mjs` | Startprüfung, Zeitgrenzen für Caddy, sauberes Beenden |
| Bau | `scripts/build-node.mjs` | baut, legt `serve.mjs` ab, prüft auf Cloudflare-Reste |

Der Adapter bildet nach, worauf sich der Code bei D1 verlässt:

- `bind()` liefert eine neue Anweisung, ganze Zahlen werden als INTEGER gebunden, Wahrheitswerte als 1/0.
  Ohne das schrieb node:sqlite aus 5 den Text „5.0“, auch in JSON.
- `batch()` ist eine Transaktion am Stück. Nur lesende Pakete nehmen keine Schreibsperre.
- Vor jeder Abfrage gibt der Adapter kurz an die Ereignisschleife ab. Lange Import-Schleifen halten den Server
  so nicht an. Eine einzelne lange Abfrage tut es weiterhin, etwa die Begriffssuche über alle Karten (rund 3 s bei
  1,3 Mio. Vorgängen). Abfragen über `DATABASE_SLOW_MS` stehen im Protokoll.
- Fehler tragen wie bei D1 das Präfix `D1_ERROR:`.

Tests: `node --test tests/node-d1-adapter.test.mjs`.

## Täglicher Gebrauch

Zugang öffnen, dann im Browser `http://localhost:8080`:

```bash
ssh -N -L 8080:127.0.0.1:8080 ratsmonitor
```

Wer den Tunnel öffnen kann, ist Admin. Caddy meldet jede Anfrage mit der Kennung aus `/etc/default/caddy`.
Die Datei und ihre Einbindung in Caddy (der Caddy-Dienst von Ubuntu liest sie nicht von selbst):

```bash
printf 'RM_ADMIN_USER_ID=max\nRM_ADMIN_EMAIL=admin@ratsmonitor.local\n' > /etc/default/caddy
mkdir -p /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironmentFile=-/etc/default/caddy\n' > /etc/systemd/system/caddy.service.d/env.conf
systemctl daemon-reload && systemctl restart caddy
```

Fehlt die Einbindung, setzt Caddy leere Kennungen, und die Administration ist gesperrt. Die gebundene Kennung muss
zu `RM_ADMIN_USER_ID` passen (`scripts/bind-admin-owner.mjs`).

Für Nico einen eigenen SSH-Schlüssel eintragen. Für den Tunnel allein genügt ein Benutzer ohne Root-Rechte; Deploys
brauchen Root.

Neuen Stand aufspielen (nur Committetes, gebaut wird auf dem Server):

```bash
deploy/node/deploy.sh
```

Das Skript installiert, baut, prüft fehlende Migrationen, startet neu und prüft, dass die Suche die Datenbank nutzt.

Nützlich auf dem Server:

```bash
systemctl status ratsmonitor
journalctl -u ratsmonitor -f
```

## Dateien auf dem Server

| Pfad | Inhalt |
|---|---|
| `/srv/ratsmonitor/app/current` | Verweis auf den laufenden Stand unter `releases/<commit>` (dazu bleiben die zwei neuesten anderen) |
| `/srv/ratsmonitor/data/ratsmonitor.sqlite` | Datenbank |
| `/srv/ratsmonitor/ratsmonitor.env` | Umgebung, Rechte 600; Vorlage `deploy/node/ratsmonitor.env.example` |
| `/srv/ratsmonitor/backups/` | nächtliche Sicherung 3:30 Uhr, drei Stände (`/etc/cron.d/ratsmonitor-backup`) |
| `/etc/cron.d/ratsmonitor-search-words` | Wortliste der Suche nachführen, 4:15 Uhr; baut voll neu auf, wenn die vorberechneten Zahlen fehlen (Protokoll `backups/search-words.log`) |
| `/etc/systemd/system/ratsmonitor.service` | Dienst; Vorlage `deploy/node/ratsmonitor.service` |
| `/etc/caddy/Caddyfile`, `/etc/default/caddy` | Caddy und Admin-Kennung; Vorlage `deploy/node/Caddyfile` |

Der Server startet nicht ohne gültige Datenbank. Sonst würden die Seiten still den mitgelieferten, alten Stand zeigen.

## Datenbank übertragen

Die lokale Datei ist eine SQLite-Datei mit Protokoll (`-wal`). Eine rohe Kopie der laufenden Datei ist unbrauchbar.

1. Lokal den Dev-Server beenden. Auch seine Hintergrundskripte (`refresh-search-words`, `refresh-admin`) und
   jeden KI-Auftrag abwarten: Im Task-Manager darf kein `node.exe` die Datei mehr halten.
2. Protokoll zurückschreiben und prüfen, dass niemand mehr schreibt. Das Skript bricht sonst ab:

   ```bash
   node scripts/db-checkpoint.mjs "<lokale .sqlite>"
   ```

3. Datei übertragen (braucht keinen lokalen Zusatzplatz). Bis zum Ende der Kopie nichts auf der Datei starten:

   ```bash
   scp -C "<lokale .sqlite>" ratsmonitor:/srv/ratsmonitor/data/ratsmonitor.sqlite.new
   ```

4. Auf dem Server: Dienst stoppen, Datei vollständig prüfen und tauschen, Besitzer binden, starten:

   ```bash
   systemctl stop ratsmonitor
   sqlite3 /srv/ratsmonitor/data/ratsmonitor.sqlite.new "PRAGMA integrity_check"
   cd /srv/ratsmonitor/data && rm -f ratsmonitor.sqlite-wal ratsmonitor.sqlite-shm && mv ratsmonitor.sqlite.new ratsmonitor.sqlite && chown ratsmonitor: ratsmonitor.sqlite
   sudo -u ratsmonitor node /srv/ratsmonitor/app/current/scripts/node-migrate.mjs /srv/ratsmonitor/data/ratsmonitor.sqlite --check
   sudo -u ratsmonitor node /srv/ratsmonitor/app/current/scripts/bind-admin-owner.mjs /srv/ratsmonitor/data/ratsmonitor.sqlite max --replace
   systemctl start ratsmonitor
   ```

Danach ist der Server der Hauptbestand. Importe laufen dort; lokale Datenbanken sind Kopien zum Entwickeln
(aus `/srv/ratsmonitor/backups/` holen).

## Migrationen

`scripts/node-migrate.mjs <Datei> [--check]` spielt fehlende `drizzle/*.sql` ein und führt dieselbe Tabelle
`d1_migrations` wie Wrangler. Eine lokal migrierte Datenbank gilt damit als auf demselben Stand. Vorher sichern;
große Indizes über alle Vorgänge brauchen Minuten.

`deploy/node/deploy.sh` bricht ab, wenn Migrationen fehlen (der laufende Stand bleibt). Dann von Hand, mit dem neuen
Stand als Archiv in `/tmp` (`git archive main scripts/node-migrate.mjs drizzle | ssh ratsmonitor 'mkdir -p /tmp/m && tar -x -C /tmp/m'`):

```bash
ls -la /srv/ratsmonitor/backups/          # Sicherung von heute vorhanden?
systemctl stop ratsmonitor
sudo -u ratsmonitor node /tmp/m/scripts/node-migrate.mjs /srv/ratsmonitor/data/ratsmonitor.sqlite
systemctl start ratsmonitor
deploy/node/deploy.sh main
```

Migration 0017 (Spalte `formal`, Datenstand `search`) dauerte lokal bei 1,3 Mio. Karten 142 s. Danach stimmt der Stand
der Wortliste nicht mehr; das nächste Nachführen übernimmt ihn (`scripts/refresh-search-words.mjs`, bis dahin sucht die
App über alle Karten).

Nachführen der Wortliste nachts (einmal anlegen):

```bash
cat > /etc/cron.d/ratsmonitor-search-words <<'CRON'
15 4 * * * ratsmonitor cd /srv/ratsmonitor/app/current && DATABASE_FILE=/srv/ratsmonitor/data/ratsmonitor.sqlite node --no-warnings scripts/refresh-search-words.mjs >> /srv/ratsmonitor/backups/search-words.log 2>&1
CRON
```

Das Skript läuft unter derselben Sperre wie das Nachführen nach Importen (`search-words-lease` in `system_state`);
läuft schon eines, lässt es aus.

## Vor dem Öffnen für andere

Phase 1 ist nur über den Tunnel erreichbar. Bevor die Seite unter einer Domain erreichbar wird:

- **Admin-Zugang trennen.** Heute ist jeder mit Zugang Admin. Caddy darf die Admin-Kennung nur unter `/admin*` und
  `/api/admin*` nach eigener Anmeldung setzen; der Rest wird ohne Anmeldung ausgeliefert. Abmelden geht mit
  HTTP-Basic-Anmeldung nicht (der Browser schickt das Passwort weiter); dafür ein Anmeldedienst mit Sitzung.
- **`SITE_URL`** auf die https-Adresse setzen, `VINEXT_TRUST_PROXY=1` bleibt.
- **Ausgehende Verbindungen sperren**, die nicht ins Internet gehen (127.0.0.0/8, 10/8, 172.16/12, 192.168/16,
  169.254/16, ::1, fc00::/7) für den Benutzer `ratsmonitor`. `/api/dokument` lädt gespeicherte Quellenadressen und
  folgt Weiterleitungen; auf Cloudflare kam man nie an interne Adressen, auf dem Server schon.
- **Impressum und Datenschutz** mit Hostinger als Hoster.
- **Zeitgesteuerte Importe** über `scripts/run-imports.mjs` (braucht `IMPORT_TOKEN` und eine https-Adresse).

## Bekannte Grenzen

- Begriffssuche ohne Volltextindex dauert bei vollem Bestand rund 3 s und hält den Prozess so lange an.
- `refreshSearchWords` läuft unter einer Sperre, die jeder Lauf vor jedem Abschnitt verlängert (3 min, beim vollen
  Aufbau 1 h); wer sie verliert, bricht ab. Bricht ein Lauf hart ab, ist die
  Wortliste bis zum Ablauf der Sperre nicht nachführbar, die Suche läuft dann über alle Karten.
- Fehlerzweige mancher Leser lesen die Antwort nicht zu Ende; in einem lange laufenden Prozess bleiben die
  Verbindungen dann bis zur nächsten Speicherbereinigung offen.
