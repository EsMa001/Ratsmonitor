# Betrieb auf dem eigenen Server (Node statt Cloudflare)

Stand: 10. Oktober 2026. Gilt für `main` (nur `main` wird ausgerollt) und den Hostinger-VPS (KVM 4, Deutschland, Ubuntu 24.04).

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
| `/srv/ratsmonitor/backups/` | nächtliche Sicherung 3:30 Uhr, mit zstd gepackt (`ratsmonitor-<Datum>.sqlite.zst`, zurück mit `zstd -d … -o ratsmonitor.sqlite`), höchstens zwei Stände, auch während einer neuen (`ratsmonitor-backup.service`, Zeitplaner) |
| `ratsmonitor-search-words.service` (früher `/etc/cron.d/ratsmonitor-search-words`) | Wortliste der Suche nachführen, 04:20 Uhr (Zeitplaner); baut voll neu auf, wenn die vorberechneten Zahlen fehlen (Protokoll `backups/search-words.log`) |
| `/etc/systemd/system/ratsmonitor.service` | Dienst; Vorlage `deploy/node/ratsmonitor.service` |
| `/etc/caddy/Caddyfile`, `/etc/default/caddy` | Caddy und Admin-Kennung; Vorlage `deploy/node/Caddyfile` |
| `/srv/ratsmonitor/data/pdf-store/` | PDF-Ablage (`RM_PDF_STORE`): Originale, Textfassungen, `index.sqlite`; gefüllt von der nächtlichen Kette |
| `/srv/ratsmonitor/ocr-tools/`, `data/ocr-cache/` | OCR-Werkzeuge (tesseract.js, @napi-rs/canvas) und Sprachdaten |
| `/etc/systemd/system/ratsmonitor-pdf-nightly.*` | nächtliche Kette der PDF-Ablage, 05:30 Uhr; Vorlage `deploy/node/ratsmonitor-pdf-nightly.*` |

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
systemctl stop ratsmonitor-import.timer ratsmonitor-import-nightly.timer ratsmonitor-import ratsmonitor-import-nightly
systemctl stop ratsmonitor
sudo -u ratsmonitor node /tmp/m/scripts/node-migrate.mjs /srv/ratsmonitor/data/ratsmonitor.sqlite
systemctl start ratsmonitor
deploy/node/deploy.sh main
```

Migration 0017 (Spalte `formal`, Datenstand `search`) dauerte lokal bei 1,3 Mio. Karten 142 s. Danach stimmt der Stand
der Wortliste nicht mehr; das nächste Nachführen übernimmt ihn (`scripts/refresh-search-words.mjs`, bis dahin sucht die
App über alle Karten).

Migration 0018 (Datenstand `coverage`) ersetzt nur drei Trigger und dauert Millisekunden. Danach erhöht ein Importschritt
den Datenstand `content` nur noch, wenn er Vorgänge schreibt; die Quellenstände zählen `coverage`
(`server/integrations/revision-cache.mjs`). Ohne die Migration läuft alles wie vorher.

Migration 0024 (Datum der Suchkarte „Stand heute“, Spalte `next_date`, lokal 3,8 s): Vorgänge mit früherer und künftiger
Sitzung tragen das Datum der letzten Sitzung bis heute. Suchtext und Wortliste bleiben unverändert, kein Neuaufbau nötig.
Danach rückt jeder Metadaten-Import und der nächtliche Lauf von `scripts/refresh-search-words.mjs` die Karten nach, deren
nächste Sitzung erreicht ist. Ohne die Migration läuft alles wie vorher.

Migrationen 0019 bis 0023 (Datenmodell, 11.10.2026; Plan und Messwerte in `requirements/datenmodell-plan.md`). Der Code
braucht 0020 (Spalte `active`), deshalb alle zusammen vor dem Ausrollen einspielen. Gemessen auf einer lokalen Kopie mit
941.000 Karten, auf dem Server mit 1,43 Mio. grob das Anderthalbfache:
- 0019 (45 s): Suchtext nur Überschrift, Kurztext und Gremium, KI-Stichwörter entfernt, alle Karten neu geschrieben,
  Stand der Wortliste gelöscht.
- 0020 (28 s): generierte Spalte `topics.active`, drei Teilindizes neu.
- 0021 (21 s) und 0022 (27 s): doppelten Text bzw. doppelte Belege aus dem Payload entfernen.
- 0023 (43 s, +650 MB lokal): Volltextindex `search_fts` mit Triggern.

Danach: Wortliste voll aufbauen (`node scripts/refresh-search-words.mjs --full`, zuletzt 158 s; bis dahin sucht die App
über den Volltextindex bzw. über alle Karten), Gebietswerte zählen wegen `FIGURES_VERSION` 5 einmal neu (Nachholschritte;
bis dahin zeigt die Übersicht keine Zahlen), auf der Admin-Seite „Stichwörter“ einmal „Neu zählen“.

Am Ende eines Abrufauftrags erneuert der Server die Planerstatistik dort, wo sich Tabellen stark verändert haben
(`PRAGMA optimize=0x10002` mit `analysis_limit=4000`, `pipeline-jobs.mjs`). Die Statistik von Hand zu erneuern
(Abschnitt unten) braucht es damit nur noch nach neuen Indizes.

Nachführen der Wortliste nachts (einmal anlegen):

```bash
cat > /etc/cron.d/ratsmonitor-search-words <<'CRON'
15 4 * * * ratsmonitor cd /srv/ratsmonitor/app/current && DATABASE_FILE=/srv/ratsmonitor/data/ratsmonitor.sqlite node --no-warnings --max-old-space-size=6144 scripts/refresh-search-words.mjs >> /srv/ratsmonitor/backups/search-words.log 2>&1
CRON
```

Das Skript läuft unter derselben Sperre wie das Nachführen nach Importen (`search-words-lease` in `system_state`);
läuft schon eines, lässt es aus.

Die Datenbank auf dem Server hat Statistiken für den Planer (`sqlite_stat1`). Neue Indizes kennt sie nicht, und ohne
Verteilung (stat4) unterschätzt sie schiefe Spalten (98 % der Analysen sind `rule-label`). Nach Migrationen mit neuen
Indizes deshalb die Pläne der betroffenen Abfragen prüfen (`EXPLAIN QUERY PLAN`) und die Statistik der Tabellen
erneuern, das dauert mit Stichprobe unter einer Sekunde; danach den Dienst neu starten, damit er sie liest:

```bash
sudo -u ratsmonitor sqlite3 /srv/ratsmonitor/data/ratsmonitor.sqlite "PRAGMA analysis_limit=4000;" "ANALYZE search_cards;" "ANALYZE article_analyses;"
systemctl restart ratsmonitor
```

## Importprozess (seit 11.10.2026, Code-Analyse A14)

Abrufe laufen in einem eigenen Prozess neben dem Webserver, `dist/standalone/worker/import-worker.mjs` (Quelle
`server/node/import-worker.mjs`, Schleife in `server/integrations/pipeline-worker.mjs`, gebaut von
`scripts/build-node.mjs`). Er arbeitet denselben gespeicherten Auftrag ab wie die Admin-Seite (`admin-pipeline-job`
in `system_state`), mit 24 Bahnen im Prozess; Auftrag, Sperren und Fortschritt liegen in der Datenbank, die Admin-Seite
zeigt den Lauf wie einen aus dem Browser, und beide dürfen denselben Auftrag treiben (jedes Gebiet genau einmal).

| Einheit | Zweck |
|---|---|
| `ratsmonitor-import.timer` → `.service` | alle 10 Minuten: offenen Auftrag abarbeiten (`--run --max-minutes 240`); ohne Auftrag endet der Prozess sofort |
| `ratsmonitor-import-nightly.timer` → `.service` | täglich 01:00 Uhr: Auftrag über alle angebundenen Quellen, eine Woche zurück (`--create sources --window 1w`), fertig vor der Sicherung um 03:30 |

Einrichten: `cp deploy/node/ratsmonitor-import*.service deploy/node/ratsmonitor-import*.timer /etc/systemd/system/ &&
systemctl daemon-reload && systemctl enable --now ratsmonitor-import.timer ratsmonitor-import-nightly.timer`.
Protokoll: `journalctl -u ratsmonitor-import -u ratsmonitor-import-nightly` (eine Zeile je Minute mit den Zählern).
Anhalten: in der Administration „Pause“ oder „Beenden“; der Prozess endet dann nach den laufenden Gebieten. Von
Hand starten: `systemctl start ratsmonitor-import`. Ein Auftrag aus der Administration: „Im Hintergrund abrufen“
legt ihn nur an, der Timer holt ihn innerhalb von zehn Minuten.

Der Prozess öffnet die Datenbank wie der Dienst (`DATABASE_FILE`), wartet aber bis 30 s auf Schreibsperren
(`IMPORT_BUSY_TIMEOUT_MS` in der Einheit; `DATABASE_BUSY_TIMEOUT_MS` aus der Umgebungsdatei gilt nur dem Dienst);
Heap 6 GB, Speicherrahmen 8 GB, niedrige CPU- und Platten-Priorität. Nach dem Auftrag rechnet er die Kennzahlen der
Administration nach. Exit 0: fertig, nichts zu tun oder Zeitgrenze (der Auftrag bleibt, der nächste Lauf macht
weiter); 1: Abbruch; 2: der nächtliche Lauf fand einen pausierten frischen Auftrag vor und legte keinen an (ein
pausierter oder seit sechs Stunden unbewegter Auftrag wird dagegen beendet). Ein Deployment startet nur den Dienst neu;
ein laufender Importprozess läuft mit seinem alten Stand zu Ende (`deploy.sh` meldet das). **Vor Migrationen** den
Importprozess und beide Timer stoppen (Abschnitt „Migrationen“).

## PDF-Ablage, Texte, Fakten: die Kette (Stand 11.10.2026, auf dem Server noch nicht eingerichtet, die Ablage ist leer)

Der Server erzeugt alles aus seinen eigenen PDFs; übertragen wird nichts. Jede Stufe liest nur, was die vorige
abgelegt hat, und lässt aus, was schon da ist (gleiche Adresse oder gleiche Prüfsumme):

1. **Bericht** (Import, `runSync`): Metadaten nach `topics` und `search_cards`. Hauptdokument je Bericht `primaryPdf`
   (`shared/document-type.mjs`); Unterlagen der ganzen Sitzung (`sessionDocument`: Niederschrift, Einladung, an 5 und
   mehr Berichten) werden weder zusammengefasst noch für Fakten gelesen.
2. **PDF** (`RM_PDF_STORE`, `server/node/pdf-store.mjs`): Der Import liest zuerst aus der Ablage und legt neu geladene
   PDFs dort ab (`readDocument`). Bestand: `scripts/pdf-store/fetch.mjs`, Budget: `budget.mjs`.
3. **Text** (`texts` in der Ablage, Seiten getrennt durch `\f`): `text.mjs` (Textebene), danach `text.mjs --ocr` (Seiten
   unter 20 Zeichen). Version `TEXT_VERSION`; eine neue Version liest alles neu.
4. **Zusammenfassung** (Regel, ohne KI): im Import `refreshSummaries` (je Lauf höchstens 8 Berichte je Gebiet, nur
   solche ohne Versuch), für den Bestand `summaries.mjs` (alle ohne `ruleSummary`, deren Text in der Ablage liegt).
5. **Fakten** (`topic_facts`, `shared/topic-facts.mjs` und `shared/radars.mjs`, Version `FACTS_VERSION`): im Import
   zusammen mit Stufe 4, für den Bestand und nach jeder Regeländerung `facts.mjs` (schreibt alle Berichte neu, lokal
   rund 2 Minuten für 940.000 Berichte, in Stücken von 5.000, die App liest weiter).
6. **Suche**: `refresh-search-words.mjs --full` nach Stufe 4 im Bestand (neue Zusammenfassungen ändern den Suchtext);
   im Import führt `runSync` die Wortliste und `rollCardDates` selbst nach.

**Einrichten** (einmal, als root; der Server hat noch keine PDFs, die Kette lädt sie selbst):

1. Umgebung: `RM_PDF_STORE`, `OCR_TOOLS`, `OCR_CACHE` aus `deploy/node/ratsmonitor.env.example` in
   `/srv/ratsmonitor/ratsmonitor.env` übernehmen. Ab dem nächsten Importlauf legt der Import jedes gelesene PDF ab.
2. OCR-Werkzeuge außerhalb des Releases (sie gehören nicht zu den App-Paketen):
   `mkdir -p /srv/ratsmonitor/ocr-tools && cd /srv/ratsmonitor/ocr-tools && npm install tesseract.js@7 @napi-rs/canvas &&
   chown -R ratsmonitor:ratsmonitor /srv/ratsmonitor/ocr-tools`. Die Sprachdaten lädt der erste OCR-Lauf nach `OCR_CACHE`.
3. Migrationen `0024` und `0025` (Abschnitt „Migrationen“).
4. Einheiten: `cp deploy/node/ratsmonitor-pdf-nightly.service deploy/node/ratsmonitor-pdf-nightly.timer /etc/systemd/system/ &&
   systemctl daemon-reload && systemctl enable --now ratsmonitor-pdf-nightly.timer`.

**Nachts** (05:30, nach Import, Sicherung und Wortliste) führt `scripts/pdf-store/nightly.mjs` die Stufen 2 bis 6 in fester
Reihenfolge aus, höchstens drei Stunden: Laden (bis 40 % der Zeit, Monat für Monat ab heute zurück) mit **fester Grenze
von 100 GB** für PDFs und Texte zusammen: Ist sie erreicht, wird jede neue Datei sofort bewertet (Score 0 bis 100 % aus `shared/pdf-rank.mjs`,
Textebene gleich gelesen, Seiten ohne Text vorläufig geschätzt) und verdrängt die schlechteste Datei der Ablage, wenn sie besser ist;
sonst fliegt sie selbst raus. Der Text bleibt immer: vor jedem Löschen werden Seiten ohne Text sofort per OCR gelesen, auch bei
vielen Seiten. So liegen in den 100 GB die besten Dokumente unter allen geladenen. Danach nur zur Sicherung das Kürzen
(`budget.mjs --apply`, etwa nach einer gesenkten Grenze), Textebene, OCR (die verbleibende
Zeit bis auf 25 Minuten), Zusammenfassungen, Fakten, Wortliste. Was nicht fertig wird, macht die nächste Nacht weiter;
eine Sperre (`nightly.lock` in der Ablage) verhindert zwei Läufe. Protokoll: `journalctl -u ratsmonitor-pdf-nightly`.
Probe ohne Wirkung: `node scripts/pdf-store/nightly.mjs --dry-run`.
Fehlgeschlagene Abrufe werden nicht erneut versucht; Liste: `node scripts/pdf-store/fetch.mjs --errors [--csv fehler.csv]`.

**Admin-Reiter „PDF-Import“** (`/admin?seite=pdf`, früher „PDF-Ablage“; Konzept `requirements/admin-pdf-ablage-konzept.md`):
liest nur `system_state` (`server/integrations/pdf-store-admin.mjs`). „Jetzt“: Fortschritt des Laufs bzw. OCR-Laufs (jede
Minute von `fetch.mjs`/`text.mjs`/`nightly.mjs` geschrieben, `pdf-store-progress-chain`/`-ocr`, `scripts/pdf-store/state.mjs`),
„Anhalten“ (`pdf-store-stop`; die Skripte prüfen das jede Minute und hören geordnet auf, `nightly.mjs` überspringt die
übrigen Schritte und endet mit Exit-Code 3), Warteschlange (`pdf-store-job` = `{queue, current, recent}`; immer nur ein
Auftrag, `job.mjs` startet je Aufruf höchstens einen), „Stand neu zählen“ (`pdf-store-count`, `stats.mjs` auch während eines
Laufs). Dazu Abdeckung je Sitzungsmonat, „vollständig bis“, Texte und Auswertung, Platz mit Schwelle der Grenze, der
Prozessablauf mit Regeln und Grenzen, Fehlergründe, Server, die nicht liefern, Fehlerliste als CSV
(`/api/admin/pdf-ablage/fehler`, aus `pdf-store-errors-csv:N`), Protokoll der letzten Läufe (`pdf-store-runs`, je Schritt Zeit
und Zusammenfassung). `job.mjs` schreibt bei jedem Aufruf ein Lebenszeichen (`pdf-store-heartbeat`); fehlt es 20 Minuten,
sperrt die Seite die Knöpfe (lokal führt niemand Aufträge aus).

**Admin-Reiter „Speicher & Sicherungen“** (`/admin?seite=speicher`, `server/integrations/server-storage.mjs`): Platte, Datenbank
mit Nebendateien und größten Tabellen (`dbstat`, einmal am Tag), PDF-Ablage, Sicherungen (Datenbankkopien und Sicherungen der
Einstellungsdatei, nur Name und Größe), Programmstände, OCR-Werkzeuge. Gemessen von `scripts/server-disk.mjs` (`server-disk`),
aufgerufen von `job.mjs` höchstens stündlich und auf Wunsch („Neu messen“, `server-disk-count`).

### Zeitplaner (Admin-Reiter „Jobs & Zeitpläne“, seit 12.10.2026)

Alle Jobs, die von selbst laufen, starten über `scripts/schedule.mjs <job>`; Befehle, Standardzeiten und Beschreibungen
stehen in `server/integrations/schedules.mjs` (`JOBS`): `import-nightly` (01:00), `backup` (03:30), `search-words` (04:20),
`pdf-nightly` (05:30), `import` und `pdf-job` (alle 10 Minuten). Die Auslöser fragen alle 10 Minuten; der Zeitplaner startet
den Job, wenn er nach seiner Einstellung dran ist (`schedules` in `system_state`: ein/aus, Uhrzeit deutscher Zeit in
10-Minuten-Schritten bzw. Abstand), ein täglicher Job wird bis 3 Stunden nach seiner Zeit nachgeholt; „Jetzt ausführen“
(`schedule-now`) startet ihn sofort, auch ausgeschaltet. Jeder Lauf steht in `schedule-runs` (Start, Ende,
Dauer, Ergebnis). Ohne fälligen Job endet der Zeitplaner still. Von Hand: `node scripts/schedule.mjs <job> --force`,
Übersicht `node scripts/schedule.mjs --list`.

Einrichten (einmal, als root; danach gelten die Einstellungen der Administration, vorher laufen die Jobs zu ihren festen
Zeiten weiter und die Seite sagt das):

```bash
cp deploy/node/ratsmonitor-import.service deploy/node/ratsmonitor-import-nightly.service deploy/node/ratsmonitor-import-nightly.timer deploy/node/ratsmonitor-pdf-nightly.service deploy/node/ratsmonitor-pdf-nightly.timer deploy/node/ratsmonitor-pdf-job.service /etc/systemd/system/
systemctl daemon-reload
```

Die Timer selbst bleiben eingeschaltet (`systemctl list-timers`); ein- und ausgeschaltet wird in der Administration.

**Sofortstart** (seit 12.10.2026): Jeder Knopf, der einen Job braucht („Jetzt ausführen“, PDF-Aufträge, „Stand neu zählen“,
„Neu messen“), schreibt zusätzlich `/srv/ratsmonitor/data/trigger/<job>` (`server/integrations/job-trigger.mjs`; Ordner
`RM_TRIGGER_DIR`, sonst `trigger` neben `DATABASE_FILE`). Je Job beobachtet eine `.path`-Einheit die Datei und startet den
Dienst sofort; `schedule.mjs` führt ihn aus, wenn ein Wunsch offen ist (`schedule-now` oder `pendingWork`: beim Auftragsdienst
Zählen, Messen, wartende Aufträge), auch ausgeschaltet. Läuft der Dienst schon, erledigt der laufende Auftragsdienst Zählen und
Messen binnen 30 Sekunden; ein weiterer Auftrag startet beim nächsten Timer-Aufruf nach dem Ende. Sicherung und Wortliste
laufen dafür nicht mehr über Cron, sondern über eigene Einheiten (Protokoll weiter in `backups/backup.log` und
`backups/search-words.log`). Einrichten (einmal, als root):

```bash
cd /srv/ratsmonitor/app/current
cp deploy/node/ratsmonitor-backup.service deploy/node/ratsmonitor-backup.timer deploy/node/ratsmonitor-search-words.service deploy/node/ratsmonitor-search-words.timer deploy/node/ratsmonitor-*.path /etc/systemd/system/
rm /etc/cron.d/ratsmonitor
systemctl daemon-reload
systemctl enable --now ratsmonitor-backup.timer ratsmonitor-search-words.timer ratsmonitor-import.path ratsmonitor-import-nightly.path ratsmonitor-pdf-job.path ratsmonitor-pdf-nightly.path ratsmonitor-backup.path ratsmonitor-search-words.path
```

Von Hand, unabhängig vom Schalter: `systemd-run --unit ratsmonitor-pdf-job-now --uid=ratsmonitor --gid=ratsmonitor -p
EnvironmentFile=/srv/ratsmonitor/ratsmonitor.env -p WorkingDirectory=/srv/ratsmonitor/app/current /usr/bin/node --no-warnings
scripts/schedule.mjs pdf-job --force` (Job-Name austauschbar).

**Übrige PDFs** (Anlagen, Pläne …, in keinem Bericht Hauptdokument; Server 12.10.2026: rund 682.000): nur über den Knopf
„Übrige PDFs laden“ (Auftrag `others`, `nightly.mjs --others`, `fetch.mjs --others`), nicht in der nächtlichen Kette. Ein
Lauf lädt bis 15 Minuten vor Ende (Standard 180 min), neueste Sitzungen zuerst, liest die Textebene und zählt den Stand neu;
kein OCR, keine Zusammenfassungen und Fakten (die lesen nur Hauptdokumente). Sie laufen durch dieselbe feste Grenze mit Tausch
und stehen dabei fest unter allen Hauptdokumenten (`ranked` in `store-lib.mjs`): ein neues Hauptdokument verdrängt
zuerst übrige PDFs, ein übriges PDF nie ein Hauptdokument. In der Ablage `pdfs.role='other'`; OCR (Tausch,
`text.mjs --ocr`) nur für Dateien, die auch als Hauptdokument verlinkt oder ohne Angabe sind. Der Admin-Reiter zeigt sie
getrennt (`others` in `pdf-store-stats`). Mehrere Läufe nötig; jeder macht dort weiter, wo der vorige aufgehört hat.

**Texte erstellen** (Auftrag `texts`, `nightly.mjs --texts`): lädt nichts, liest die Textebene aller abgelegten PDFs ohne Text,
danach Zusammenfassungen, Fakten, Wortliste und Stand wie nachts; keine OCR (die hält auf). Die Kennzahl „PDFs ohne Text“
(`texts.missing` in `pdf-store-stats`) zeigt, wie viele darauf warten. **OCR starten** (Auftrag `ocr`, `nightly.mjs --ocr-only`):
keine Textebene, OCR (nur Hauptdokumente) mit der ganzen Zeit, dann dieselbe Auswertung. Ein von Hand gestarteter OCR-Dienst (`systemd-run`, Einheit `ratsmonitor-pdf-ocr`)
hört nicht auf „Anhalten“; beenden mit `systemctl stop ratsmonitor-pdf-ocr`. Den Lauf der Aufträge selbst beendet
`systemctl stop ratsmonitor-pdf-job` (der Dienst vermerkt den Auftrag als abgebrochen).

**Score einer Datei** (`shared/pdf-rank.mjs`, Entscheidung 12.10.2026): 0 bis 100 % = Dokumentart (Vorlage und Beschluss 1,
Niederschrift 0,7, Anlage und Sonstiges 0,4, Einladung 0,1) × Formalie (0,5, nicht bei Niederschriften) × Inhalt (voll ab
4.000 Zeichen, darunter mit der Wurzel fallend; Seiten, die auf OCR warten, vorläufig 800 Zeichen) × Größe (voll bis 100 KB,
darüber mit der Kubikwurzel fallend; über 10 MB für alle Dokumentarten: 0, nur Text; `text.mjs` löscht das PDF, sobald der Text vollständig ist, Scans gleich nach der OCR). Scan und Alter zählen nicht.
Der Score wird bei jedem Lauf aus dem aktuellen Text gerechnet; nach der OCR gilt die echte Zeichenzahl.

**Qualität der Ablage** (Abschnitt im Reiter, `quality` in `pdf-store-stats`, `storeQuality` in `store-lib.mjs`): Ø Score der
als PDF abgelegten Dateien, getrennt nach Hauptdokumenten und übrigen, je Dokumentart und Scorestufe, dazu der Ø Score der
Dateien, die nur als Text bleiben. Erscheint nach dem nächsten Zählen.

**Wie lange der Aufbau dauert** (hochgerechnet aus dem lokalen Aufbau, 11.10.2026): Alle Hauptdokumente sind 65 bis 80 GB,
etwa 300.000 bis 360.000 PDFs; lokal kamen 30 bis 60 PDFs je Sekunde, also einige Nächte Laden. Textebene lokal 87.600
Dateien in 18 Minuten. OCR braucht etwa jede zwanzigste Datei; lokal 4.612 Dateien (11.584 Seiten) in 3,2 Stunden mit 4 Workern, also rund
1.400 Dateien je Stunde. Für den Bestand (grob 15.000 bis 18.000 Dateien) mit 2 Workern und gut 2 Stunden je Nacht etwa
zwei bis drei Wochen; die tatsächliche Rate steht nach dem ersten Lauf im Protokoll. Bis die Ablage gefüllt ist, stützen sich die Analysen auf Titel und die neu gelesenen
Dokumente; das Förderradar braucht die Volltexte.

Lücken: Der Import legt das PDF ab, aber nicht den daraus gelesenen Text (die Kette holt ihn nachts nach), und macht kein
OCR; Berichte, deren Zusammenfassung schon versucht wurde, bekommen ihre Fakten nur über `facts.mjs`. Nach einer Änderung
an `FACTS_VERSION` läuft das von selbst in der nächsten Nacht; nach `TEXT_VERSION` liest die Kette alle Texte neu (Nächte).

## Vor dem Öffnen für andere

Phase 1 ist nur über den Tunnel erreichbar. Bevor die Seite unter einer Domain erreichbar wird:

- **Admin-Zugang trennen.** Heute ist jeder mit Zugang Admin. Caddy darf die Admin-Kennung nur unter `/admin*` und
  `/api/admin*` nach eigener Anmeldung setzen; der Rest wird ohne Anmeldung ausgeliefert. Abmelden geht mit
  HTTP-Basic-Anmeldung nicht (der Browser schickt das Passwort weiter); dafür ein Anmeldedienst mit Sitzung.
- **`SITE_URL`** auf die https-Adresse setzen, `VINEXT_TRUST_PROXY=1` bleibt.
- **Ausgehende Verbindungen sperren**, die nicht ins Internet gehen (127.0.0.0/8, 10/8, 172.16/12, 192.168/16,
  169.254/16, ::1, fc00::/7) für den Benutzer `ratsmonitor`. `/api/dokument` lädt gespeicherte Quellenadressen; seit
  Paket 3 (`server/integrations/document-proxy.mjs`) nur https, nur öffentliche Namen und Adressen (auch nach der
  Namensauflösung), Weiterleitungen von Hand mit Prüfung je Ziel. Die Sperre auf dem Server bleibt als zweite Schranke
  sinnvoll: Ein Name, der sich zwischen Prüfung und Abruf anders auflöst (DNS-Rebinding), wird im Code nicht erkannt.
- **Impressum und Datenschutz** mit Hostinger als Hoster.
- **Zeitgesteuerte Importe** laufen über den Importprozess (Abschnitt oben). `scripts/run-imports.mjs` (über
  `/api/internal/sync`, braucht `IMPORT_TOKEN` mit mindestens 16 Zeichen und eine https-Adresse) ist der ältere Weg
  von außen.

## Bekannte Grenzen

- Begriffssuche ohne Volltextindex dauert bei vollem Bestand rund 3 s und hält den Prozess so lange an.
- `refreshSearchWords` läuft unter einer Sperre, die jeder Lauf vor jedem Abschnitt verlängert (3 min, beim vollen
  Aufbau 1 h); wer sie verliert, bricht ab. Bricht ein Lauf hart ab, ist die
  Wortliste bis zum Ablauf der Sperre nicht nachführbar, die Suche läuft dann über alle Karten.
- Fehlerzweige mancher Leser lesen die Antwort nicht zu Ende; in einem lange laufenden Prozess bleiben die
  Verbindungen dann bis zur nächsten Speicherbereinigung offen.
