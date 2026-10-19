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
| `/srv/ratsmonitor/backups/` | nächtliche Sicherung 00:30 Uhr (vor dem Import), mit zstd gepackt (`ratsmonitor-<Datum>.sqlite.zst`, zurück mit `zstd -d … -o ratsmonitor.sqlite`), höchstens zwei Stände, auch während einer neuen (`ratsmonitor-backup.service`, Zeitplaner) |
| `ratsmonitor-rule-texts.service` | Themen & Texte, direkt nach der PDF-Nachtkette (sie stößt ihn an), sonst 08:50 Uhr (Zeitplaner, `scripts/rule-texts.mjs`): Regeln je Bericht (Art des Punkts, Thema, Regel-Zusammenfassung, Fakten; `read-reports.mjs`), Wortliste aus den Texten der PDF-Ablage und Zahlen für plenara.X (`x_cases`, Migration 0036, `build-x-cases.mjs`); Ergebnis je Schritt in `system_state` `rule-texts-last` (Protokoll `backups/rule-texts.log`) |
| `ratsmonitor-startseite-trends.service` | Karte und Trends der Startseite vorab rechnen, 05:10 Uhr (nach dem spätesten Ende des Imports) (Zeitplaner, `scripts/startseite-trends.mjs`, Ergebnis in `system_state` `startseite-trends`, gelesen über `/api/startseite-trends`; Protokoll `backups/startseite-trends.log`) |
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
Danach rückt jeder Metadaten-Import und jeder Lauf von `scripts/refresh-search-words.mjs` (im Job „Themen & Texte“) die Karten nach, deren
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
bis dahin zeigt die Übersicht keine Zahlen).

Migrationen 0029 bis 0031 (13.10.2026, je unter einer Sekunde): 0029 legte `ai_usage.duration_ms` an, 0030 nimmt die
Spalte wieder heraus (die Bearbeitungsdauer je Bericht wird weder gespeichert noch ausgewertet; gefüllt war sie nie).
0031 entfernt die letzten Stichwort-Reste: den gespeicherten Zählstand der früheren Admin-Seite „Stichwörter“ und die
alten KI-Stichwortanalysen in `article_analyses` (auf dem Server 7.629 Zeilen, 19 MB; erhöht den Datenstand `content`).

Am Ende eines Abrufauftrags erneuert der Server die Planerstatistik dort, wo sich Tabellen stark verändert haben
(`PRAGMA optimize=0x10002` mit `analysis_limit=4000`, `pipeline-jobs.mjs`). Die Statistik von Hand zu erneuern
(Abschnitt unten) braucht es damit nur noch nach neuen Indizes.

Früher: Nachführen der Wortliste nachts per Cron (seit 14.10.2026 nicht mehr anlegen; die Wortliste führt der Job „Themen & Texte“ nach):

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

## plenara.X im Worker-Thread (seit 17.10.2026)

Der Webserver liest SQLite synchron (`node:sqlite`, `DatabaseSync`). Eine plenara.X-Rechnung von 2 s (Newsradar, Trends,
Gremiennetz kalt) hielt deshalb jede andere Anfrage an, auch Seitengerüste und die Suche (gemessen 17.10.2026,
`docs/qualitaet/frontend-effizienz-2026-10-17.md`, Befund 7). Seitdem rechnen die X-Routen in Worker-Threads:
`dist/standalone/worker/x-worker.mjs` (Quelle `server/node/x-worker.mjs`, Funktionen je Art in
`server/integrations/x-registry.mjs`, Verteilung `server/integrations/x-offload.mjs`, gebaut von `scripts/build-node.mjs`
neben dem Importprozess). `serve.mjs` setzt `RM_X_WORKER` auf die Datei, wenn sie liegt; `RM_X_WORKERS` (Standard 2) ist
die Zahl der Threads, jeder mit eigener Nur-Lese-Verbindung auf `DATABASE_FILE`. `RM_X_WORKER=0` schaltet ab, dann
rechnet der Hauptprozess wie vorher. Der Zwischenspeicher je Bau (`xCached`, `revision-cache.mjs`) bleibt im Hauptprozess;
nur die kalte Rechnung wandert. Ohne Datei (Dev-Server, Cloudflare) ändert sich nichts. Test: `tests/x-offload.test.mjs`.

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
4. **Regeln je Bericht** (ohne KI, seit 14.10.2026 ein Schritt, `readReport` in `server/integrations/report-rules.mjs`, Plan
   `requirements/regel-schritt-plan.md`): in fester Reihenfolge Hauptdokument und Sitzungsunterlage, Art des Punkts
   (`shared/item-kind.mjs`, `payload.itemKind`), Thema und Unterthemen (`shared/themes.mjs`, `payload.theme`, nur aus Titel,
   Betreff und Beschlussvorschlag), Regel-Zusammenfassung (`ruleSummary`) und Fakten (`topic_facts`, `shared/topic-facts.mjs`,
   `FACTS_VERSION`). Jede Regel liest nur Quellen, nie das Ergebnis einer anderen. Für den Bestand `read-reports.mjs`: nur
   Berichte mit geänderten Eingaben (Schlüssel in `report_rules`, Migration `0032`, aus den Regelfassungen, Titel,
   Hauptdokument, Sitzungsunterlage und Textstand), `--all` liest alle neu. KI-Felder bleiben unberührt. Im Import
   `refreshSummaries` (je Lauf höchstens 8 Berichte je Gebiet) dieselbe Funktion mit dem dort gelesenen Text.
   `summaries.mjs` und `facts.mjs` bleiben eine Fassung lang als Rückfall.
5. (entfällt, in Stufe 4)
6. **Suche**: `refresh-search-words.mjs` nach Stufe 4 im Bestand (neue Zusammenfassungen ändern den Suchtext);
   im Import führt `runSync` die Wortliste und `rollCardDates` selbst nach.

Die PDF-Kette (`nightly.mjs`, Aufträge im Reiter PDF-Import) macht nur die Stufen 2 und 3 (Laden, Textebene, OCR, Dokumentart,
Stand). Die Stufen 4 bis 6 für den Bestand laufen getrennt davon im Job `rule-texts` (`scripts/rule-texts.mjs`, Reiter
„Themen & Texte“, direkt nach der Kette, Rückfall 08:50 Uhr; Entscheidung 13.10.2026): Regeln je Bericht (`read-reports.mjs`), Wortliste
(nur wenn Berichte neu gelesen wurden), Zahlen für plenara.X (`scripts/plenara-x/build-x-cases.mjs`, immer; ohne sie antwortet
`/api/x` mit 503, nach dem Einspielen von Migration 0036 also einmal von Hand oder über „Jetzt erstellen“ bauen).

**Einführung plenara.X Atlas (Oktober 2026), einmal nach dem Deploy:** Migrationen bis `0037` einspielen
(`0034` und `0037` setzen die Labels aller Karten neu, `0037` löscht die Fakten `radar:*`), dann
`node scripts/reclassify-rules.mjs` (Titelregel `title-rules-v6`) und den Job „Themen & Texte“ mit „Alle neu erstellen“
(`scripts/rule-texts.mjs --all`: alle Berichte neu lesen, lokal 30 Minuten für 941.000 Berichte, Wortliste voll,
Zahlen für plenara.X). Bis der Job fertig ist, zeigen Suche und Themen die Titelregel und `/api/x` antwortet mit 503.

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
von 80 GB** (`BUDGET_GB` in `shared/pdf-rank.mjs`, bis 12.10.2026 100 GB) für PDFs und Texte zusammen: Ist sie erreicht, wird jede neue Datei sofort bewertet (Score 0 bis 100 % aus `shared/pdf-rank.mjs`,
Textebene gleich gelesen, Seiten ohne Text vorläufig geschätzt) und verdrängt die schlechteste Datei der Ablage, wenn sie besser ist;
sonst fliegt sie selbst raus. Die Textebene bleibt immer; vor dem Löschen gibt es keine OCR mehr (Entscheidung 12.10.2026):
Seiten ohne Text liest „OCR starten“ später und lädt die Datei dafür kurz nach. So liegen in den 80 GB die besten Dokumente unter
allen geladenen. Danach nur zur Sicherung das Kürzen (`budget.mjs --apply`, etwa nach einer gesenkten Grenze), dann stellt die
Kette den Auftrag „OCR starten“ an (er läuft in der Bahn OCR neben dem Rest), dann Textebene, Zusammenfassungen, Fakten,
Wortliste. Was nicht fertig wird, macht die nächste Nacht weiter; die Sperre der Bahn Laden (`nightly.lock` in der Ablage)
verhindert zwei Läufe. Protokoll: `journalctl -u ratsmonitor-pdf-nightly`.
Probe ohne Wirkung: `node scripts/pdf-store/nightly.mjs --dry-run`.
Fehlgeschlagene Abrufe werden nicht erneut versucht; Liste: `node scripts/pdf-store/fetch.mjs --errors [--csv fehler.csv]`.

**Admin-Reiter „PDF-Import“** (`/admin?seite=pdf`, früher „PDF-Ablage“; Konzept `requirements/admin-pdf-ablage-konzept.md`):
liest nur `system_state` (`server/integrations/pdf-store-admin.mjs`). „Jetzt“: je Bahn (Laden, OCR) Fortschritt des laufenden Auftrags (jede
Minute von `fetch.mjs`/`text.mjs`/`nightly.mjs` geschrieben, `pdf-store-progress-chain`/`-ocr`, `scripts/pdf-store/state.mjs`),
„Anhalten“ (`pdf-store-stop`; `nightly.mjs` und die Skripte prüfen das alle 2 s, `onStop` in `state.mjs`, und warten nicht
auf das Ende des Schritts: der laufende Schritt bekommt SIGTERM, `fetch.mjs` bricht laufende Abrufe ab und lässt sie offen
(kein Fehler), `text.mjs` hört nach der Datei bzw. OCR-Seitengruppe auf (halb gelesene Dateien bleiben in der Reihe), Schritte
mit Datenbank rollen die offene Transaktion zurück, im Tausch wird nichts mehr verdrängt; `nightly.mjs` überspringt die
übrigen Schritte, vermerkt den Lauf als angehalten und endet mit Exit-Code 3, spätestens nach 60 s; `systemctl stop` wirkt
genauso), Warteschlange (`pdf-store-job` = `{queue, current, recent}`; immer nur ein
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
stehen in `server/integrations/schedules.mjs` (`JOBS`): `backup` (00:30), `import-nightly` (01:00, höchstens bis 05:00), `startseite-trends` (05:10),
`pdf-nightly` (05:30, höchstens bis 08:30), `rule-texts` (direkt nach `pdf-nightly`, die ihn anstößt, wenn er eingeschaltet ist; sonst 08:50), `import` und `pdf-job` (alle 10 Minuten). Die Auslöser fragen alle 10 Minuten; der Zeitplaner startet
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
Messen binnen 30 Sekunden; ein weiterer Auftrag startet beim nächsten Timer-Aufruf nach dem Ende. Die Sicherung
läuft dafür nicht mehr über Cron, sondern über eigene Einheiten (Protokoll weiter in `backups/backup.log`). Die Wortliste
hat seit 14.10.2026 keinen eigenen Job mehr: Jeder Import und der Job „Themen & Texte“ führen sie nach, auch das
Datum „Stand heute“ der Karten. Einrichten (einmal, als root):

```bash
cd /srv/ratsmonitor/app/current
cp deploy/node/ratsmonitor-backup.service deploy/node/ratsmonitor-backup.timer deploy/node/ratsmonitor-*.path /etc/systemd/system/
rm /etc/cron.d/ratsmonitor
systemctl daemon-reload
systemctl enable --now ratsmonitor-backup.timer ratsmonitor-import.path ratsmonitor-import-nightly.path ratsmonitor-pdf-job.path ratsmonitor-pdf-nightly.path ratsmonitor-backup.path
```

**Startseite: Karte und Trends** (seit 13.10.2026, Job `startseite-trends`, 04:50 Uhr): rechnet je Beispielbegriff der Startseite
die Ausbreitung (wie `/api/analytics/diffusion`, je Begriff bis etwa 10 s) und legt sie in `system_state` ab. Ohne Eintrag zeigt
die Startseite den mitgelieferten Stand `public/data/startseite-trends.json` (lokal neu: `node scripts/startseite-trends.mjs --file`).
Einrichten (einmal, als root):

```bash
cd /srv/ratsmonitor/app/current
cp deploy/node/ratsmonitor-startseite-trends.service deploy/node/ratsmonitor-startseite-trends.timer deploy/node/ratsmonitor-startseite-trends.path deploy/node/ratsmonitor-stop-startseite-trends.path /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ratsmonitor-startseite-trends.timer ratsmonitor-startseite-trends.path ratsmonitor-stop-startseite-trends.path
node scripts/schedule.mjs startseite-trends --force   # einmal sofort (als ratsmonitor, mit EnvironmentFile)
```

Themen & Texte (`rule-texts`, seit 13.10.2026; Regeln je Bericht und Wortliste, vorher Teil der PDF-Kette), einrichten (einmal, als root):

```bash
cd /srv/ratsmonitor/app/current
cp deploy/node/ratsmonitor-rule-texts.service deploy/node/ratsmonitor-rule-texts.timer deploy/node/ratsmonitor-rule-texts.path deploy/node/ratsmonitor-stop-rule-texts.path /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ratsmonitor-rule-texts.timer ratsmonitor-rule-texts.path ratsmonitor-stop-rule-texts.path
```

**Anhalten** (Knopf je laufendem Job im Reiter „Jobs & Zeitpläne“, seit 12.10.2026): schreibt `trigger/stop-<job>` und
`schedule-stop` (Anzeige „wird angehalten“); `ratsmonitor-stop-<job>.path` startet `ratsmonitor-stop@<job>.service` (als root),
das `systemctl stop ratsmonitor-<job>.service` ausführt; der Zeitplaner vermerkt den Lauf als angehalten. Einrichten (einmal):

```bash
cd /srv/ratsmonitor/app/current
cp deploy/node/ratsmonitor-stop@.service deploy/node/ratsmonitor-stop-*.path /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ratsmonitor-stop-import.path ratsmonitor-stop-import-nightly.path ratsmonitor-stop-pdf-job.path ratsmonitor-stop-pdf-nightly.path ratsmonitor-stop-backup.path
```

Von Hand, unabhängig vom Schalter: `systemd-run --unit ratsmonitor-pdf-job-now --uid=ratsmonitor --gid=ratsmonitor -p
EnvironmentFile=/srv/ratsmonitor/ratsmonitor.env -p WorkingDirectory=/srv/ratsmonitor/app/current /usr/bin/node --no-warnings
scripts/schedule.mjs pdf-job --force` (Job-Name austauschbar).

**Übrige PDFs** (Anlagen, Pläne …, in keinem Bericht Hauptdokument; Server 12.10.2026: rund 682.000): nur über den Knopf
„Übrige PDFs laden“ (Auftrag `others`, `nightly.mjs --others`, `fetch.mjs --others`), nicht in der nächtlichen Kette. Ein
Lauf lädt bis 15 Minuten vor Ende (Standard 180 min), neueste Sitzungen zuerst, liest die Textebene und zählt den Stand neu;
keine Zusammenfassungen und Fakten (die lesen nur Hauptdokumente). Sie laufen durch dieselbe feste Grenze mit Tausch
und stehen dabei fest unter allen Hauptdokumenten (`ranked` in `store-lib.mjs`): ein neues Hauptdokument verdrängt
zuerst übrige PDFs, ein übriges PDF nie ein Hauptdokument. In der Ablage `pdfs.role='other'`; OCR über „OCR starten“ wie bei
Hauptdokumenten (bei gleicher Seitenzahl nach ihnen). Der Admin-Reiter zeigt sie
getrennt (`others` in `pdf-store-stats`). Mehrere Läufe nötig; jeder macht dort weiter, wo der vorige aufgehört hat.

**Textebene lesen** (Auftrag `texts`, `nightly.mjs --texts`): lädt nichts, liest die Textebene aller abgelegten PDFs ohne Text,
danach Zusammenfassungen, Fakten, Wortliste und Stand wie nachts. Die Kennzahl „PDFs ohne Text“
(`texts.missing` in `pdf-store-stats`) zeigt, wie viele darauf warten. **OCR starten** (Auftrag `ocr`, `nightly.mjs --ocr-only`,
`text.mjs --ocr`, Bahn OCR): OCR aller PDFs, Hauptdokumente und übrige, in einer Reihe (`ocrQueue`): wenigste OCR-Seiten zuerst,
bei gleich vielen Hauptdokumente vor übrigen, abgelegte vor verdrängten. Verdrängte (`text-only`) werden kurz nachgeladen (gleiche
Prüfsumme), gelesen und sofort wieder gelöscht, der Eintrag bleibt `text-only`; scheitert das, steht die Datei in `ocr_refetch`
(Ablage) und kommt nicht wieder; ein Server mit 3 Fehlern in Folge fällt für den Lauf heraus. Je Datei höchstens 5 Minuten
(`--file-minutes`), sonst über `ocr_slow` ans Ende der Reihe. 3 Worker, je eine Datei. Danach Zusammenfassungen, Fakten und
Wortliste, aber nur, wenn Hauptdokumente gelesen wurden.

**Zwei Bahnen** (seit 12.10.2026): Laden (`run`, `retry`, `others`, `texts`, auch die Nachtkette) und OCR (`ocr`) laufen
nebeneinander, je Bahn ein Auftrag (`laneOf`, Sperren `LANE_LOCKS` in `pdf-store-admin.mjs`: `nightly.lock`, `ocr-lane.lock`).
`job.mjs` startet beide, bleibt, solange etwas läuft, und startet frei gewordene Bahnen nach; der Dienst darf deshalb 12 Stunden
laufen (`TimeoutStartSec=12h` in `ratsmonitor-pdf-job.service`, nach dem Ausrollen `systemctl daemon-reload`). Zusammenfassungen,
Fakten und Wortliste schreiben dieselben Berichte: eigene Sperre `eval.lock`, die andere Bahn wartet. Ein von Hand gestarteter
OCR-Dienst (`systemd-run`, Einheit `ratsmonitor-pdf-ocr`) hört nicht auf „Anhalten“; beenden mit `systemctl stop ratsmonitor-pdf-ocr` (endet ebenso nach der laufenden Seitengruppe). Den Lauf der Aufträge selbst beendet
`systemctl stop ratsmonitor-pdf-job` (der Dienst vermerkt beide laufenden Aufträge als abgebrochen).

**Qualität einer Datei** (im Code „Score“, `shared/pdf-rank.mjs`, Entscheidung 12.10.2026; im Admin-Reiter „Qualität“): 0 bis 100 % = Dokumentart (Vorlage und Beschluss 1,
Niederschrift 0,7, Anlage und Sonstiges 0,4, Einladung 0,1; seit 12.10.2026 aus dem ersten Wort des Titels, `documentType`, berichtigt
durch den Textanfang, `documentTypeFromText`/`effectiveType` in `shared/document-type.mjs`, Spalte `texts.head_type`; Schritt
„Art nachtragen“ = `budget.mjs --backfill`, nach neuen Regeln (`DOC_TYPE_VERSION`) einmal für alle Einträge). Hauptdokumente bis 10 MB, die nur noch als Text vorliegen, lädt der
normale Lauf wieder, solange übrige PDFs als PDF liegen (die weichen in der Grenze zuerst); sonst nicht, damit nichts im Kreis lädt × Formalie (0,5, nicht bei Niederschriften) × Inhalt (voll ab
4.000 Zeichen, darunter mit der Wurzel fallend; Seiten, die auf OCR warten, vorläufig 800 Zeichen) × Größe (voll bis 100 KB,
darüber mit der Kubikwurzel fallend; über 10 MB für alle Dokumentarten: 0, nur Text; `text.mjs` löscht das PDF gleich nach der Textebene, auch bei Scans). Scan und Alter zählen nicht.
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
OCR; der Job `rule-texts` liest danach jeden Bericht mit dem Text der Ablage. Nach einer Änderung an einer Regelfassung
(`READ_VERSION` setzt sich aus allen zusammen) läuft das von selbst beim nächsten Job; nach `TEXT_VERSION` liest die Kette alle Texte neu (Nächte).

## Betriebsplan: Tagespipeline, Nacharbeit, Altbestand (seit 15.10.2026)

Konzept und Ablaufbild: `requirements/betriebsplan-konzept.md`, `requirements/betriebsplan-ablauf.html`. Namen aller Abläufe, Stufen und
Schritte: `shared/pipeline-terms.mjs`.

- **Tagespipeline** (jede Nacht, Stufen Abruf → Extraktion → Verarbeitung): `backup` „Sichern“ 00:30 → `import-nightly` „Abruf, nachts“
  01:00 (alle Quellen, **1 Tag** zurück, sonntags 1 Monat für Nachträge; Gebiete und Server, die im Fehlerspeicher warten, „Zurückgestellt“) → `startseite-trends` 05:10 →
  `pdf-nightly` „Extraktion, nachts“ 05:30 (`nightly.mjs --daily`: PDF laden und Anlagen laden für die Berichte seit `pdf-daily-last` und alle mit Sitzung im Tagesbereich,
  Text lesen, OCR bis 45 min, Dokumentart, Stand zählen) → `rule-texts` „Verarbeitung, nachts“ (Titel einordnen, Regeln anwenden, Suche
  aktualisieren, Zahlen rechnen, KI-Stand `ai-counts`, Wege zählen `pipeline-trace`).
- **Tagesbereich und Altbestand:** Tagesbereich sind Sitzungen der letzten 7 Tage, frühestens 12.10.2026, deren Fehler nicht vor dem
  12.10. entstanden. Nur ihn bearbeitet die Nacharbeit; alles Ältere ist Altbestand.
- **Fehlerspeicher** (Migration `0040`, `server/integrations/work-failures.mjs`): Grund je Eintrag (Quelle bremst, Zugriff verweigert,
  vorübergehend, fehlt dauerhaft, zu langsam, Sperre im Haus, Fehler im eigenen Code), Stufe, nächster Termin; `source_hosts` je Server
  (liefert, bremst 1 h → 7 d, gesperrt 7 d → 30 d → prüfen mit Stichprobe alle 30 Tage). Nichts wird endgültig außer 404, „kein PDF“,
  zu groß und geänderte Dateien; vorübergehende Fehler laufen wöchentlich weiter. Wartende Server lassen alle Abrufer aus; ein fälliger
  bekommt erst eine Stichprobe von 3. Beim ersten Lauf überträgt `scripts/pdf-store/failures.mjs` die alten Fehler der Ablage als Altbestand.
- **Nacharbeit** (Job `nacharbeit`, `scripts/nacharbeit.mjs --range daily`, alle 30 min von 09:00 bis 23:00): fällige Einträge Stufe
  für Stufe; gelingt ein Abruf, laufen für die geschriebenen Berichte gleich Extraktion und Regeln (Folgekette).
- **OCR, tagsüber** (Job `ocr`, eigene Einheit, 07:00 bis 23:00): Reste der Nacht im Tagesbereich; ist auf der Seite Altbestand die OCR
  angefordert, danach (10 bis 22 Uhr) der Altbestand. Nach einem Lauf mit gelesenen Dateien gleich Regeln anwenden und Suche
  aktualisieren für die Berichte mit neuem Text (nicht, solange „Verarbeitung, nachts“ läuft).
- **Altbestand** (Seite `/admin?seite=altbestand`, Job `altbestand`, `scripts/altbestand.mjs`, 10:00 bis 22:00, nur mit Anforderung
  in `altbestand-requests`): rückwirkender Abruf (1 bis 24 Monate, je 8 Gebiete, mit Folgekette), alte Fehler erneut versuchen; dazu die
  Aufträge der PDF-Ablage (`pdf-job`: ältere Monate laden, Anlagen laden, Text lesen) im selben Fenster. Hat die Nacharbeit fällige
  Einträge, lässt er aus. Die KI startet nie von selbst.
- **Debug-Seite** (vorübergehend): `/admin?seite=debug`: Laufbuch des Zeitplaners (`schedule-log`), was die Läufe getan haben, Wege der
  Berichte, Fehlerspeicher des Tagesbereichs mit „freigeben“ und „erneut“.
- **Nachtbericht** (nur lesend, ohne Deploy): `ssh ratsmonitor 'node --input-type=module - --hours 30' < scripts/pipeline-report.mjs`: Schalter,
  Laufbuch je Job, Abruf, Extraktion, Verarbeitung, Nacharbeit, Fehlerspeicher (neu, fällig, Gründe), Server und auffällige Journalzeilen je Einheit;
  dazu der Zustand der Auslöser (Timer und Pfade, `systemd-units`).
- **Ausrollen während laufender Jobs:** `deploy.sh` nennt laufende Jobs; sie arbeiten mit ihrem Stand weiter, der nächste Lauf
  nimmt den neuen. Ein alter Stand, in dem noch ein Prozess arbeitet, wird beim Aufräumen nicht gelöscht (seit 18.10.2026).
- **Jobs anhalten:** nur über „Anhalten“ in der Administration (stoppt den Dienst) oder den Schalter im Zeitplaner. Nie
  `systemctl stop ratsmonitor-<job>.timer`: der Job startet dann nie wieder, bis jemand den Timer startet (16.10.2026: OCR 17 Stunden
  aus, Fund erst am Nachmittag). Ist es doch passiert: `systemctl start ratsmonitor-<job>.timer ratsmonitor-<job>.path`.

**Einrichten** (einmal, als root, nach dem Deploy des Stands):

```bash
cd /srv/ratsmonitor/app/current
systemctl stop ratsmonitor-import.timer ratsmonitor-import-nightly.timer
sudo -u ratsmonitor node scripts/node-migrate.mjs /srv/ratsmonitor/data/ratsmonitor.sqlite   # 0040: zwei leere Tabellen
cp deploy/node/ratsmonitor-ocr.* deploy/node/ratsmonitor-nacharbeit.* deploy/node/ratsmonitor-altbestand.* deploy/node/ratsmonitor-stop-ocr.path deploy/node/ratsmonitor-stop-nacharbeit.path deploy/node/ratsmonitor-stop-altbestand.path /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ratsmonitor-ocr.timer ratsmonitor-ocr.path ratsmonitor-stop-ocr.path ratsmonitor-nacharbeit.timer ratsmonitor-nacharbeit.path ratsmonitor-stop-nacharbeit.path ratsmonitor-altbestand.timer ratsmonitor-altbestand.path ratsmonitor-stop-altbestand.path
systemctl start ratsmonitor-import.timer ratsmonitor-import-nightly.timer
install -m 755 deploy/node/backup.sh /usr/local/bin/ratsmonitor-backup   # nur, falls die Sicherung von dort läuft
```

Danach die Jobs im Reiter „Jobs & Zeitpläne“ einschalten. Der erste Lauf von `fetch.mjs` oder `text.mjs` überträgt die alten
Fehler (einige Sekunden). Sicherung außer Haus: `BACKUP_REMOTE` (rclone-Ziel) in `ratsmonitor.env`, rclone installieren.

## Konten (Thema 1, seit 13.10.2026 im Code, seit 15.10.2026 auf dem Server)

**Stand auf dem Server (15.10.2026, d82b772):** Schritte 1 und 2 von „Umstellen ohne Ausfall“ erledigt (Caddy
Schritt 0, `RM_ACCESS=open`, `ADMIN_LEGACY_HEADER=1`, `MAIL_TRANSPORT=log`, Stufengrenzen aktiv: wer nicht angemeldet
ist, hat Gast-Rechte). Kontojob, Pfad- und Stopp-Einheiten aktiv, Sicherung mit age geprüft. Konto Max (Enterprise,
admin) angelegt; Nico fehlt noch. Sicherungen vor dem Umbau: `ratsmonitor.env.bak-vor-konten-20261015-1801`,
`/etc/caddy/Caddyfile.bak-vor-konten-20261015-1801`, `/root/units-bak-vor-konten-20261015-1801/`.

**Domain `plenara.de` (seit 17.10.2026):** bei IONOS registriert (dazu `parlamo.de`, `quorumo.de`, unbenutzt). DNS bei IONOS:
A `@` → `187.7.72.52` (die IONOS-Parkseite „Default Site“ samt AAAA ist abgeschaltet), A `www` → `187.7.72.52`; MX, SPF,
DKIM, DMARC und `autodiscover` bleiben bei IONOS (Postfächer möglich). Noch kein AAAA (IPv6 der Firewall ungeprüft). Caddy:
Block `plenara.de` an die Fassung von Schritt 0 angehängt (Let's-Encrypt-Zertifikat, Passwort wie bei sslip, HSTS, `noindex`),
`www.plenara.de` und die alte Adresse `187-7-72-52.sslip.io` leiten dauerhaft (301) auf `https://plenara.de` weiter. `SITE_URL=https://plenara.de`.
Sicherungen: `Caddyfile.bak-vor-domain-*`, `ratsmonitor.env.bak-vor-domain-*`.

**Mailversand über das Postfach (seit 19.10.2026):** `MAIL_TRANSPORT=smtp` verschickt über `kontakt@plenara.de` bei IONOS
(`server/accounts/smtp.mjs`, `smtp.ionos.de:465` mit TLS, `MAIL_FROM="Plenara <kontakt@plenara.de>"`, `MAIL_REPLY_TO`
ebenso). `SMTP_USER` und das Passwort (`SMTP_PASSWORD_B64`, Base64, nur auf dem Server eintragen, Vorlage in
`accounts.env.example`) stehen in `/etc/ratsmonitor/accounts.env`. IONOS erlaubt je Postfach anfangs 50 Mails pro Stunde,
nach 30 Tagen 500. Prüfen: `echo adresse | ratsmonitor-accounts test-mail --email-stdin`. Später ein eigenes Postfach
`anmeldung@` als Absender, damit das Passwort des Teampostfachs nicht auf dem Server liegt.

**Anmelden ohne Mailanbieter:** Mit `MAIL_TRANSPORT=log` bietet die Anmeldeseite keine Anmeldung per Mail an. Admins
melden sich mit `LOGIN_TOTP=1` (in `ratsmonitor.env`) über E-Mail-Adresse und Code aus der Authenticator-App an
(Konzept, Nachtrag 15.10. abends). Den zweiten Faktor einrichten: im Tunnel unter `/admin` oder
`ratsmonitor-accounts totp-setup --id u_…` (zeigt den Schlüssel einmal im Terminal). Alle anderen: `login-link`.

Konzept: `requirements/konten-konzept.md`. Anmeldung per E-Mail-Link oder achtstelligem Code, ohne Passwort. Admin ist
eine Rolle am Konto und gilt nur über den Tunnel (`ADMIN_HOSTS`). Die Zugangssperre `RM_ACCESS=invite` ersetzt das
Basic-Auth-Passwort, sobald sie geprüft ist.

**Wo was liegt**

| Pfad | Inhalt |
|---|---|
| `/srv/ratsmonitor/accounts/` | Kontenordner, `ratsmonitor`, Rechte 700; nur Webdienst und Kontojob sehen ihn (`InaccessiblePaths` in allen anderen Einheiten) |
| `/srv/ratsmonitor/accounts/accounts.sqlite` | Kontendatei (eigene Datei, nie in Entwicklerkopien, Export oder MCP) |
| `/etc/ratsmonitor/accounts.env` | `ACCOUNTS_FILE`, `ACCOUNTS_SECRET`, `MAIL_API_KEY`, `ACCOUNTS_AGE_RECIPIENT`; root, 600; Vorlage `deploy/node/accounts.env.example` |
| `/srv/ratsmonitor/accounts/backups/` | verschlüsselte Sicherungen (`accounts-*.sqlite.zst.age`, 7 Stände) und `pre-<commit>` vor jeder Kontomigration |
| `/srv/ratsmonitor/accounts/deleted.log` | Löschprotokoll (Hash der Konto-ID, HMAC der Adresse), für `reapply-deletions` nach dem Rückspielen |
| `/srv/ratsmonitor/accounts/maintenance.log` | Protokoll des Kontojobs |

**Sicherungsschlüssel:** öffentlicher age-Schlüssel `age1mdxuz50cc929xe6matw5c7y04xlt4hqnv2ma2j7wgywyc2frypgq2v0qr3`
(seit 15.10.2026 in `/etc/ratsmonitor/accounts.env` als `ACCOUNTS_AGE_RECIPIENT`). Der private Teil liegt offline bei
Max (Kopie für Nico); ohne ihn lassen sich die Kontosicherungen nicht wiederherstellen.

**Einrichten (einmal, als root)**

```bash
apt install age sqlite3
mkdir -p /srv/ratsmonitor/accounts/backups && chown -R ratsmonitor:ratsmonitor /srv/ratsmonitor/accounts && chmod -R 700 /srv/ratsmonitor/accounts
mkdir -p /etc/ratsmonitor && chmod 700 /etc/ratsmonitor
cp /srv/ratsmonitor/app/current/deploy/node/accounts.env.example /etc/ratsmonitor/accounts.env
chmod 600 /etc/ratsmonitor/accounts.env      # ACCOUNTS_SECRET: openssl rand -base64 48
# age-Schlüssel auf dem eigenen Rechner erzeugen (age-keygen -o plenara-konten.key), privaten Teil offline bei Max und
# Nico ablegen, nur den öffentlichen (age1…) als ACCOUNTS_AGE_RECIPIENT eintragen
sudo -u ratsmonitor node /srv/ratsmonitor/app/current/scripts/node-migrate.mjs /srv/ratsmonitor/accounts/accounts.sqlite --dir drizzle-accounts --table accounts_migrations
install -m 755 /srv/ratsmonitor/app/current/deploy/node/ratsmonitor-accounts /usr/local/bin/ratsmonitor-accounts
cd /srv/ratsmonitor/app/current/deploy/node && cp ratsmonitor.service ratsmonitor-*.service ratsmonitor-*.timer ratsmonitor-*.path /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now ratsmonitor-accounts.timer ratsmonitor-accounts.path ratsmonitor-stop-accounts.path
mkdir -p /etc/systemd/journald.conf.d && cp journald-ratsmonitor.conf /etc/systemd/journald.conf.d/ratsmonitor.conf && systemctl restart systemd-journald
```

In `ratsmonitor.env` die Werte aus `ratsmonitor.env.example`, Abschnitt Konten, ergänzen (`RM_ACCESS`, `ADMIN_HOSTS`,
`ADMIN_LEGACY_HEADER`, `MAIL_*`, `OPERATOR_EMAIL`, `SITE_URL`). `deploy/node/deploy.sh` sichert und migriert die
Kontendatei danach bei jedem Stand selbst (nur additive Migrationen, `drizzle-accounts/`) und prüft `/api/internal/health`.

**Kontenverwaltung** nur per Kommandozeile, Adressen immer über die Eingabe, nie als Argument:

```bash
ratsmonitor-accounts invite --email-stdin --note "Gespräch 14.10., Zustimmung" --tier pro --until 2027-01-31 --send
ratsmonitor-accounts role admin --email-stdin          # Rolle beendet alle Sitzungen der Person
ratsmonitor-accounts list            # Adressen gekürzt; --full zeigt sie ganz, --invites die Einladungen
ratsmonitor-accounts login-link --base http://127.0.0.1:8080 --email-stdin   # Notzugang, wenn der Mailversand ausfällt
ratsmonitor-accounts block --note "Grund" --id u_…  |  unblock  |  revoke  |  delete  |  export --out datei.json
```

`HISTCONTROL=ignoreboth` in der Shell von root setzen. Nach dem Rückspielen einer Sicherung der Kontendatei immer
`ratsmonitor-accounts reapply-deletions`.

**Umstellen ohne Ausfall** (Konzept 14.2, Caddy-Fassungen in `deploy/node/caddy/`, vor jedem Neuladen
`node scripts/check-caddy.mjs /etc/caddy/Caddyfile`):

1. Caddy Schritt 0 (`snippets.caddy` + `step0.caddy`, Hash von Hand): Admin-Kennung nur noch im Tunnel, die
   öffentliche Site lässt niemanden mehr über das Passwort allein in die Administration. Über sslip.io geht die
   Administration erst wieder mit Admin-Konto und zweitem Faktor (Schritt 3).
2. Konten einrichten (oben), Release mit Konten ausrollen; `RM_ACCESS=open`, `ADMIN_LEGACY_HEADER=1`.
3. Max und Nico einladen, `role admin`, im Tunnel unter `http://127.0.0.1:8080/anmelden` per Code anmelden und in
   `/admin` den zweiten Faktor einrichten (Authenticator-App). Danach geht die Administration auch über die öffentliche
   Adresse: Admin-Symbol in der Kopfzeile, einmal am Tag der Code aus der App. Ohne Tunnel: `ratsmonitor-accounts
   totp-setup --email-stdin` zeigt den Schlüssel einmal; Handy verloren: `totp-reset`.
4. Umschalten: `ADMIN_LEGACY_HEADER=0`, Caddy `step2.caddy`, `RM_ADMIN_*` aus `/etc/default/caddy` löschen.
5. `RM_ACCESS=invite`, Basic-Auth vorerst davor lassen, Sperre prüfen.
6. Mit Domain, Mailanbieter und Rechtstexten: Caddy `step3.caddy`, `SITE_URL` auf die Domain, Tester in Wellen einladen.

Rückweg: `ADMIN_LEGACY_HEADER=1` (bis Schritt 4), Basic-Auth-Block wieder einsetzen. Ohne Kontendatei und ohne
`ADMIN_LEGACY_HEADER` gilt der alte Admin-Weg automatisch weiter; ein Stand mit Konten sperrt sich also nicht selbst aus.

**Lokal:** Der Dev-Start (`npm run dev`) spielt die Kontotabellen in die lokale D1-Datei und legt `basic@`, `pro@`,
`enterprise@` und `admin@plenara.test` an (`scripts/accounts/dev-setup.mjs`, abschaltbar mit `RM_SKIP_ACCOUNTS=1`).
Mails landen im Dev-Postfach (`/konto/postfach`), Anmelden ohne Mail über `/api/dev/login`. Die Administration bleibt
im Dev-Server ohne Anmeldung offen.

## Vor dem Öffnen für andere

Phase 1 ist nur über den Tunnel erreichbar. Bevor die Seite unter einer Domain erreichbar wird:

- **Admin-Zugang trennen:** mit den Konten (Abschnitt „Konten“, Schritte 1 bis 4): Admin nur als Rolle am Konto über
  den Tunnel ohne weiteren Code, über die öffentliche Adresse mit zweitem Faktor (Authenticator-App).
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

**Wortlisten-Job entfernt (14.10.2026), einmal auf dem Server:** `systemctl disable --now ratsmonitor-search-words.timer
ratsmonitor-search-words.path ratsmonitor-stop-search-words.path && rm /etc/systemd/system/ratsmonitor-search-words.*
/etc/systemd/system/ratsmonitor-stop-search-words.path && systemctl daemon-reload`.
