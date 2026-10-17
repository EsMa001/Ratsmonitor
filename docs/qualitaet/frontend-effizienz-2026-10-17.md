# Frontend-Effizienz: Messung Live-Server, 17.10.2026

Gemessen über SSH-Tunnel auf den serverinternen Port 8080 (Caddy ohne Basic Auth, gleiche App), Browser-Pane, kalter Cache beim ersten Aufruf. Als Gast; plenara.X-Seiten noch offen (Enterprise-Anmeldung nötig).

## Seiten (erster Aufruf, kalt)

| Seite | TTFB | DOM fertig | alles geladen | Download gesamt | davon JS | API-Aufrufe |
|---|---|---|---|---|---|---|
| Startseite `/` | 72 ms | 604 ms | 1,5 s | ≈ 2,3 MB | 1.029 KB (29 Dateien) | me, search (514 ms), facets (512), coverage (531, 103 KB zstd / 701 KB roh), startseite-trends (529) |
| Suche `/suche?q=haushalt` | 41 ms | 62 ms (warm) | 2,1 s | 2,4 MB neu (de_map.json) | warm | search 3× dieselbe URL (0 KB abgebrochen, 713 ms, 161 ms) |
| Artikel `/beschluss/…` | 46 ms | 78 ms (warm) | 1,1 s | 552 KB neu | regions-Chunk 528 KB | me |
| plenara.X (10 Seiten) | 33–146 ms | ≈ 50 ms | — | AnalyticsPages-Chunk 232 KB | — | nur me (Gast gesperrt) |

## Befund 1: Statische Dateien kommen unkomprimiert (größter Hebel, nur Konfiguration)

HTML und API-Antworten sind zstd-komprimiert, aber `/_next/static/*` und `/data/*` nicht (`Content-Length` = Rohgröße, kein `Content-Encoding`; Caddy hat bewusst kein `encode`, „vinext komprimiert selbst“, das gilt aber nur für dynamische Antworten).

| Datei | roh | gzip | brotli |
|---|---|---|---|
| /data/de_map.json | 2.416 KB | 1.187 KB | 1.109 KB |
| chunks/regions | 527 KB | 139 KB | 135 KB |
| chunks/index | 258 KB | 65 KB | 59 KB |
| chunks/framework | 185 KB | 57 KB | 54 KB |
| css/index | 175 KB | 32 KB | 29 KB |

Erster Aufruf Startseite: ≈ 2,3 MB → ≈ 0,6 MB; mit Karte (Suche) ≈ 4,7 MB → ≈ 1,8 MB. Umsetzung: `encode zstd br gzip` in Caddy nur für `/_next/static/*`, `/data/*`, `/geo/*` (Suchstrom bleibt unberührt, der ist `/api/`). Alternativ vorkomprimierte `.br`-Dateien beim Build.

**Umgesetzt (17.10.2026, Zweig nico_eff):** `encode @static_assets zstd gzip` in `deploy/node/caddy/snippets.caddy` (beide Proxy-Bausteine) und `deploy/node/Caddyfile`; mit dem Caddy des Servers (2.6.2, kein brotli) validiert, noch nicht ausgerollt. Ausrollen: Bausteine neu zusammensetzen (`cat snippets.caddy stepN.caddy`, Hash ergänzen), `caddy validate`, `systemctl reload caddy`; danach prüfen mit `curl -sI -H 'Accept-Encoding: zstd' https://…/data/de_map.json?v=2018-1 | grep -i content-encoding`.

## Befund 2: de_map.json (2,4 MB) auf Startseite und Suche

Komprimiert nur 2:1, also viele Koordinaten-Nachkommastellen. Optionen: Koordinaten auf 3–4 Stellen runden bzw. TopoJSON (Datei ≈ ⅓ bis ¼), erst laden, wenn die Karte sichtbar ist. Cache ist in Ordnung (1 Tag + stale-while-revalidate).

## Befund 3: regions-Chunk 528 KB (139 KB gz) auf der Artikelseite

Gebietskatalog als JS-Bündel; prüfen, ob die Artikelseite ihn wirklich braucht oder nur wenige Felder.

## Befund 4: Suche fragt dieselbe Suche dreimal ab

Beim Öffnen von `/suche?q=…` geht derselbe Aufruf dreimal raus (einer abgebrochen, zwei vollständig, 713 + 161 ms). Vermutlich doppelter Effekt bzw. Abhängigkeit (Filterzustand, Sortierung). Serverlast und Wartezeit halbierbar, nur Frontend.

**Umgesetzt (17.10.2026, Zweig nico_eff):** Ursache war `buildQuery` in `state/search.tsx`, das am Objekt `local` hing; das entsteht neu, sobald Geodaten und Ortsliste geladen sind, und ließ den laufenden Strom-Aufruf abbrechen und identisch neu starten (live: Abbruch nach 260 ms, Neustart bei 920 ms). Jetzt hängt `buildQuery` nur am Suchschlüssel (Ref). Lokal geprüft: je Suche ein Strom-Aufruf und ein Zähler-Aufruf, auch mit Ortsfilter.

## Befund 5: Startseite wartet auf vier parallele API-Aufrufe (≈ 530 ms)

search, facets, coverage, startseite-trends laufen parallel, alle ≈ 510–530 ms; coverage liefert 700 KB roh. Erst nach Hydration (≈ 950 ms) gestartet, Inhalt steht bei ≈ 1,5 s. Hebel: Aufrufe früher starten (Preload-Link oder serverseitig), coverage schlanker.


## plenara.X (angemeldet als Enterprise, ohne Filter, erster Aufruf = kalter Server-Zwischenspeicher)

| Seite | Inhalt steht nach | langsamster Aufruf (kalt) | Antwort (zstd / roh) | warm (xCached) |
|---|---|---|---|---|
| Atlas | 0,7 s | view=atlas 78 ms | 88 KB / 428 KB | 3 ms |
| Signale | 1,1 s | signale 55 ms | 66 KB | — |
| Fakten | 1,2 s | view=fakten 804 ms | 164 KB / 1.030 KB | 24 ms |
| Aktuelles (news) | 2,9 s | news 2.536 ms | 6 KB | 2 ms |
| Themennetz | 0,2 s | kein Aufruf ohne Begriff | — | — |
| Gremien | 3,1 s | network 1.325 ms (+ TTFB 1,7 s, siehe Befund 7) | 2 KB | 7 ms |
| Ausgang | 0,5 s | kein Aufruf ohne Begriff | — | — |
| Vergleich | 1,0 s | kein Aufruf (TTFB 644 ms) | — | — |
| Trends | 6,5 s | trends 1.805 ms, dann part=spread 1.938 ms (nacheinander) | 9 KB + 230 KB | 2 ms |
| Fraktionen | 1,3 s | fraktionen 950 ms | 3 KB | 2 ms |

Zusätzlich auf jeder X-Seite: `/api/me`, `/api/me/articles`, `/api/me/searches` (je ≈ 40 ms, parallel, unkritisch). JS je X-Seite: ein Chunk `AnalyticsPages` 232 KB (unkomprimiert, siehe Befund 1), nach dem ersten Mal im Cache.

## Befund 6: Trends lädt zwei Stufen nacheinander (6,5 s kalt)

Erst `trends` (1,8 s), erst mit dessen Ergebnis `part=spread` mit den gefundenen Schlüsseln (1,9 s, 230 KB). Hebel: Ausbreitung erst auf Anforderung laden (Klick/Sichtbarkeit) oder die Spread-Rechnung in den ersten Aufruf ziehen; Schlüsselliste kürzen.

**Geprüft und entschieden (17.10.2026):** Die Ausbreitung braucht die Begriffe aus der Trend-Rechnung, die Kette ist zwingend. Die Ausbreitung ist ein Durchlauf über alle 675.000 Vorgänge (85 MB Begriffstext, 1,5 s, unabhängig von der Zahl der Begriffe; SQL-Vorfilter mit 40 Begriffen 2,4 s, also langsamer); schneller nur mit Vorberechnung, die ausgeschlossen ist. Umgesetzt (Zweig nico_eff, `XTrendsPage.tsx`): bei Sortierung „Ausbreitung“ steht die Liste schon nach dem ersten Aufruf vorläufig nach Anstieg da, die Spalte „Gebiete“ füllt sich mit dem zweiten Aufruf und sortiert einmal um. Zahlen unverändert; erster Inhalt kalt nach ≈ 2 s statt 6,5 s.

## Befund 7: Eine langsame X-Abfrage blockiert den ganzen Server

Der Node-Server nutzt `node:sqlite` `DatabaseSync` (synchron, ein Prozess). Während news (2,5 s) oder trends (1,9 s) rechnen, wartet jede andere Anfrage: Seitengerüste, die sonst 60 ms brauchen, hatten TTFB 1,7 s (Gremien) und 2,4 s (Trends), per curl danach wieder 60 ms. Das trifft alle Nutzer gleichzeitig, auch die Suche. Hebel: die teuren X-Rechnungen (news, trends, network, fraktionen, fakten) in einen Worker-Thread mit eigener Verbindung verlegen (kein neues Datenmodell, keine Vorberechnung); oder die Abfragen selbst beschleunigen.

**Umgesetzt (17.10.2026, Zweig nico_eff):** Worker-Threads für alle X-Routen (`server/integrations/x-offload.mjs`, `x-registry.mjs`, `server/node/x-worker.mjs`; `docs/betrieb/node-server.md`, „plenara.X im Worker-Thread“). Geprüft auf dem Server (17.10.2026, Testinstanz des neuen Stands unter /tmp, nur lesend, Port 3005, gegen die laufende Instanz auf 3000): 11 Abfragen über alle X-Routen (news, trends, network, fraktionen, atlas, signale, graph, compare, decisions, diffusion, fakten) liefern byteweise dieselben Antworten, auch der Fehlerfall (compare 400). Während einer kalten Rechnung (decisions, 1,4 s) wartete auf der laufenden Instanz der nächste Aufruf von `/api/me` 1,0 s; auf der Worker-Instanz bleibt er bei 2 ms (6 Aufrufe während network kalt 0,9 s, alle 1 bis 2 ms). Testinstanz danach beendet und entfernt.

## Befund 8: Zwischenspeicher der X-Routen ist tagesabhängig und nur im Arbeitsspeicher

`paramsKey` enthält das Datum; nach Mitternacht und nach jedem Neustart wartet der erste Nutzer je Ansicht die volle Rechenzeit. Kein Vorrechnen gewünscht; mildern über Befund 7 (Rechnung blockiert dann wenigstens nicht) und schnellere Abfragen.

## Befund 9: Große Rohantworten (Fakten 1 MB, Atlas 428 KB)

zstd drückt sie auf 164 bzw. 88 KB, aber Parsen und Speicher im Browser (Handy) bleiben. Prüfen, welche Felder die Seite wirklich nutzt.

## Offen

- Handy-Messung (mobile Preset) nach den Änderungen.
