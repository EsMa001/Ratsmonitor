# Adminseiten: Analyse und Umsetzungskonzept

Dieses Konzept behandelt Performance, Abrufbarkeit, Design und Erklärtexte der Adminseiten.

Stand 08.10.26. Repo `C:\Git\vor-ort-quellcode`, Branch `quellen-erweiterung`. Alle Pfade sind relativ zur Repo-Wurzel. Mit „(NEU)“ markierte Dateien, Funktionen und Routen gibt es heute noch nicht. Alles andere ist im Code vorhanden und geprüft.

**Für das umsetzende Modell:** Zuerst Abschnitt 8 lesen (Projektregeln, Prüf- und Messbefehle). Danach die Pakete in Abschnitt 4 der Reihe nach umsetzen. Die Abschnitte 3, 5 und 6 sind Nachschlagewerk. Pakete mit Buchstaben (z. B. P15a, P15b) sind Teile eines größeren Schritts. Jeder Teil wird einzeln committet.

---

## 1. Kurzfassung

**Ursache**

1. **Rechnen bei jedem Aufruf.** Die Adminseiten berechnen ihre Zahlen bei jedem Aufruf aus allen gespeicherten Berichten. `topics` hat 1,34 Mio. Zeilen mit 8,1 GB JSON in `payload`. Ein Lauf darüber dauert lokal 28–31 s, mit Gruppierung bis 87 s.
2. **Übersicht.** `GET /api/admin/coverage` braucht für eine Antwort von 7,7 KB zwei solche Läufe: Zeitverlauf nach Aufnahmetag etwa 52 s, nach Sitzungstag etwa 70 s. Gemessen: kalt über 180 s, zweiter Aufruf 75 s. Warm wird die Seite nie, weil `server/integrations/revision-cache.mjs:21` beim Speichern alle Einträge derselben „Art“ löscht. Dadurch verdrängen sich `timeline|import` und `timeline|event` gegenseitig.
3. **Stichwörter, Atlas, Abruf.**
   - Stichwörter machen fünf Läufe: kalt 116 s.
   - Atlas (kalt 92 s) und Abruf (kalt 38 s) kosten selbst nur 0,6 s bzw. 1,3 s. Sie warten hinter fremden Läufen: D1 arbeitet Abfragen einer Datenbank nacheinander ab, und ein Abbruch im Browser stoppt die Abfrage auf dem Server nicht.
4. **Zeitverlauf während eines Auftrags.** Die Seite „Abruf & Verarbeitung“ lädt bei jeder neuen Revision den Zeitverlauf neu (`components/admin-timeline.tsx:33`). Während eines Auftrags ist das bis zu einmal pro Minute ein Vollscan. Im Log `tmp/dev-server.log` stehen 145 solcher Läufe mit 55–92 s.
   - Pipeline-`run`-Anfragen dauern planmäßig bis etwa 90 s (`RUN_MS`, `server/integrations/pipeline-jobs.mjs:37`) plus Speichern.
   - Die Admin-Scans verlängern sie zusätzlich: 163 von 2.596 Pipeline-POSTs dauerten mindestens 100 s, und `/api/health` brauchte bis 36 s.
5. **6,4 MB je Aufruf.** Abruf und Qualität laden je Aufruf 6,4 MB: alle 5.324 Gebiete, davon 2,1 MB Hinweistexte. Solange Kennzahlen ausstehen, wiederholt sich das alle 300 ms (`components/admin-loader.tsx:19`).
6. **Zwischenspeicher nur im Arbeitsspeicher.** Er liegt im Worker (`atRevision`) und verfällt bei jedem Importschritt, bei jedem Neustart und in Produktion bei jedem Isolate-Wechsel. Dazu kommt: Alle Antworten tragen `no-store`, und jeder Seitenwechsel ist ein voller Seitenaufruf.
7. **Produktion.** D1 bricht dort eine einzelne Abfrage vermutlich nach 30 s ab. Stichwörter, Übersicht, Zeitverlauf, Hochrechnung und Duplikatprüfungen können dort nicht fertig werden.

**Lösung**

1. **Grundsatz:** Ein Seitenaufruf (GET) liest nur vorberechnete Zeilen und schreibt nie. Er liest `topics.payload` nie über mehr als ein Gebiet. Ausnahmen sind eng begrenzt und stehen in R1. Gerechnet wird nur in kurzen POST-Schritten (höchstens 8 s) unter einer Sperre und im Import-Haken für das eigene Gebiet.
2. **Neue Tabelle `region_series`** (Migration `0016`):
   - Eine Zeile je Gebiet: Berichte je Sitzungstag und je Aufnahmetag, die Spalten der Hochrechnung und die Zählung nach Status.
   - Sie wird wie das vorhandene `region_stats` nur für geänderte Gebiete nachgerechnet, direkt nach jedem Metadaten-Import für dessen Gebiet.
   - Zeitverlauf, Übersicht, Atlas und Hochrechnung werden daraus in Millisekunden abgeleitet. Das Ergebnis ist gleich dem heutigen.
3. **Gespeicherte Stände für globale Auswertungen** (Stichwörter, Qualitätsprüfungen, Hochrechnung):
   - Einmal gebaut und als Stand in `system_state` gespeichert.
   - Neu gebaut wird in Gebietsabschnitten, auf Knopfdruck oder durch einen Runner. Jeder Abschnitt ist gegen doppeltes Zählen geschützt.
   - Die Seite zeigt sofort den letzten Stand, z. B. „Stand 08.10.26, 14:05 · ≈ 4.210 geänderte Datensätze seither“.
4. **Abrufbarkeit:** ETag/304 statt `no-store`, ein Browser-Speicher über Seitenwechsel (`next/link`). „Aktualisieren“ lässt die alten Daten stehen.
5. **Die 6,4-MB-Antwort wird geteilt:**
   - unveränderliche Gebietsdaten, einmal je Deploy und dauerhaft gecacht,
   - Werte je Gebiet, etwa 100 KB mit gzip,
   - Kopfzahlen, etwa 30 KB,
   - Hinweise je Gebiet nur auf Bedarf.
6. **Vorab acht kleine Sofortmaßnahmen** (P01–P08), darunter der Cache-Fehler und die Entkopplung des Zeitverlaufs.
7. **Danach Design und Texte:** Gestaltung wie die Startseite (Wurzel `.ratsmonitor`, Kopfband `PageBand`, Linien statt Karten, nur die Schriftgrößen 12/14/16/18/22/28/44 px). Erklärtexte je Seite, Abschnitt und Kennzahl.

**Ziel:**
- Die Seite „Abruf & Verarbeitung“ lokal kalt unter 1,5 s, jede andere Adminseite unter 1 s.
- Wiederaufruf mit 304 in unter 0,3 s.
- Während eines Auftrags kein `GET /api/admin/timeline`. Kein Pipeline-`run` über etwa 100 s, Status-Aufrufe unter 2 s.

---

## 2. Analyse

### 2.1 Datenlage (lokale D1, nur lesend gemessen)

| Objekt | Umfang | Bemerkung |
|---|---|---|
| `topics` | 1.337.583 Zeilen, davon 1.325.289 kanonisch; **8,1 GB** | `payload` im Mittel 3,8–6,9 KB JSON. Jeder Vollscan liest etwa 8 GB und parst das JSON. |
| `region_revisions` / `region_stats` | je 3.516 Zeilen; `region_stats` 2,6 MB | Migration `0011`. Trigger zählen je Gebiet bei INSERT/UPDATE/DELETE auf `topics` hoch, auch beim Wechsel von `region_id`. Zum Messzeitpunkt waren 0 Gebiete veraltet, alle mit `v=2`. |
| `source_coverage` | 3.550 Zeilen, 4,1 MB | Hinweise 0,99 MB (8.377), Warnungen 1,04 MB (5.681); ein Gebiet bis 78 KB |
| `import_runs` | 19.201 Zeilen | Nur der Primärschlüssel-Index. Sortieren nach `started_at` läuft als SCAN plus TEMP B-TREE. |
| `system_state` | 7.342 Zeilen, 78 MB | `import-debug:*` 50,45 MB, `admin-estimate` 243 KB (gzip), `admin-quality-check` 24 KB |
| `data_revisions.content` | 2.316.386 | globaler Zähler, Trigger aus `drizzle/0004` auf `topics`, `article_versions`, `article_analyses` **und `source_coverage`** |
| Katalog (`shared/catalog.mjs`) | 5.324 Gebiete (5.030 Gemeinden/Städte/Verbände, 294 Kreise) | 3.516 mit Berichten, 3.554 angebunden |
| Datenbankdatei | 11,4–11,9 GB | **über der D1-Grenze von 10 GB**, eigenes Thema (Abschnitt 7) |

Kosten eines Vollscans (gespeicherte `ms` der Qualitätsprüfungen):
- eine einfache JSON-Bedingung: 27,7–30,7 s
- GROUP BY über Adresse und Titel: 85,9–87,0 s
- je Bericht 0,07–0,1 ms für die Kennzahlen (`FIGURES`), 0,04–0,08 ms für die Tagesgruppierung
- Gemessene Abfrage je Gebiet: series-Abfrage (3.4) für Hamburg (`de-02000000`, 22.000 Berichte) 0,57 s, `event_days` dort 10 KB.

### 2.2 Laufzeit-Eigenschaften, die alles prägen

- **D1 arbeitet seriell.** Jede Datenbank führt eine Abfrage nach der anderen aus, lokal (Durable Object) wie in Produktion. Ein Scan von 70 s blockiert alle anderen Adminseiten, laufende Importe und die öffentliche Seite. `Promise.all` über D1-Abfragen bringt keine Parallelität.
- **Abbruch stoppt nichts.** AbortController, Seitenwechsel oder curl-Timeout beenden die Abfrage auf dem Server nicht. Umgekehrt kann ein Worker abgebrochen werden, wenn der Client trennt; ein `finally` läuft dann nicht sicher.
- **Produktion (OpenAI Sites, `.openai/hosting.json`: nur D1).**
  - Eine Abfrage darf vermutlich höchstens 30 s laufen.
  - Arbeitsspeicher im Isolate überlebt keinen Wechsel.
  - Es gibt keinen Cron, keine Queue, kein KV und kein `caches.default`.
  - `after()` gibt es über vinext (`ctx.waitUntil`), aber nur kurz.
  - Maschineller Anstoß heute: der externe Runner `scripts/run-imports.mjs` über `POST /api/internal/sync` mit `Bearer IMPORT_TOKEN`.

### 2.3 Messwerte vorher (lokal, Dev-Server)

| Aufruf | kalt | direkt danach | Größe |
|---|---|---|---|
| `GET /admin` (Hülle To-do) | 0,8 s | – | – |
| `GET /admin?seite=uebersicht` (Hülle) | 0,6 s | – | – |
| `GET /api/admin/overview?review=0` (Abruf) | 38,2 s | 2,5 s | 6,4 MB |
| `GET /api/admin/overview` (Qualität, mit Prüfliste) | – | 1,6 s | 6,4 MB |
| `GET /api/admin/coverage` (Übersicht) | > 180 s (curl-Abbruch) | **75 s** | 7,7 KB |
| `GET /api/admin/atlas` | 92 s | 0,67 s | 1,8 MB |
| `GET /api/admin/keywords` | 116 s | 0,03 s | 250 KB |
| `GET /api/admin/timeline?basis=event` | 55–92 s (Log) | 0,06 s | 1 MB |
| `GET /api/admin/estimate` | 0,07 s | – | 1,2 MB |
| `GET /api/admin/quality` | 0,08 s | – | 24 KB |
| `POST /api/admin/estimate` | 2–3 min | – | – |
| `POST /api/admin/quality {check}` | 0,2–87 s je Prüfung | – | – |

Log `tmp/dev-server.log`:
- 153 × `GET /api/admin/timeline`, davon 145 mit 55–92 s (113 mit 55–60 s, 22 mit 60–70 s, 10 über 70 s) und 8 aus dem Zwischenspeicher unter 1 s
- 183 Dashboard-Abrufe
- 2.596 × `POST /api/admin/pipeline`: 2.089 unter 5 s (Status- und Kurzaufrufe), 326 mit 50–90 s, 7 mit 90–100 s, 163 ab 100 s
  - Eine `run`-Anfrage nimmt bis zu 90 s lang neue Gebiete an (`pipeline-jobs.mjs:37-39`, `RUN_MS=90000`) und antwortet erst, wenn deren Importe gespeichert sind. 50–90 s sind also gewollt. Erst Zeiten über etwa 100 s gehen auf Warten hinter Admin-Scans zurück.
- `/api/health` (404) wiederholt 30–36 s

Typische Folge (Logzeilen 3019–3024): overview 1,9 s → pipeline 57,6 / 56,8 / 56,5 s → health 35,8 s → timeline 58,7 s.

### 2.4 Ursachen je Seite und Schnittstelle

Alle Seiten sind Hüllen ohne Daten im SSR (`app/admin/page.tsx`, `force-dynamic`, eine Zeile `adminAccess`). Die Daten lädt der Browser. Die Hülle ist nicht das Problem.

**Übersicht** (`?seite=uebersicht`, `components/admin-overview.tsx:64-66` → `GET /api/admin/coverage` → `adminCoverage`, `server/integrations/admin-coverage.mjs:21-46`)
- In `:24` laufen parallel: `adminTimeline(basis:'import')` (Vollscan ~52 s), `adminTimeline(basis:'event')` (Vollscan ~70 s) und `areaFigures(budgetMs:4000)`.
  - `import`: `substr(json_extract(payload,'$.metadata.firstImportedAt'),1,10)`
  - `event`: korrelierte `json_each`-Unterabfrage, die laut Plan zweimal je Zeile läuft
  - `areaFigures` rechnet veraltete Gebiete und schreibt `region_stats`
- Beide Ergebnisse speichert `atRevision` (`admin-timeline.mjs:23`). Der Fehler in `revision-cache.mjs:21`:
  ```js
  const kind=key.split('|')[0];for(const other of entries.keys())if(other.split('|')[0]===kind)entries.delete(other);
  ```
  Wer zuletzt fertig wird, löscht den anderen Eintrag. Jeder Aufruf scannt also mindestens einmal neu. Die Timeline der Abruf-Seite (`event`) und der POST der Hochrechnung (`event`) verdrängen ebenfalls.
- Verdichtet werden die Läufe nur zu:
  - `withData`: welche Gebiete Berichte haben
  - `dataCoverageSeries`: erster Import-Tag je Gebiet (`shared/coverage.mjs:32-43`)
  - `monthlyReports`: Berichte je Sitzungsmonat und Gebiet (`shared/coverage.mjs:114-123`)

  Das alles lässt sich je Gebiet vorberechnen.
- Im Browser:
  - Bis die Antwort da ist, zeigt die Seite nur eine Statuszeile.
  - „Aktualisieren“ setzt `setData(null)` (`admin-overview.tsx:84`), die Seite wird leer.
  - Der Katalogteil (angebunden, Verlauf „Quelle angebunden“) braucht keine Datenbank, wartet aber trotzdem.

**Abruf & Verarbeitung** (`?seite=abruf`, `components/admin-loader.tsx` → `AdminProcessing`)
- `GET /api/admin/overview?review=0` → `getAdminDashboard` (`server/repositories/admin.ts:13-16`) → `loadAdminData` (`server/integrations/admin-data.mjs:117-148`).
  - Eigene Abfragen etwa 1,3 s: `regionFigures` 0,4–0,5 s, Status-Zählung über `idx_topics_canonical_region_status` 0,5–0,6 s, `source_coverage` ganz, `import_runs ORDER BY started_at DESC LIMIT 30` ohne Index.
  - Kalte 38 s: Warten in der D1-Warteschlange hinter fremden Scans, Kaltstart.
- 6,37 MB Antwort (`admin-data.mjs:143`): `sources` = alle 5.324 Katalog-Gebiete mit je etwa 1,2 KB.

  | Feld | Größe |
  |---|---|
  | `processing` (14 Zahlen, auch für Gebiete ohne Berichte) | 1,23 MB |
  | `warnings` | 1,11 MB |
  | `issues` | 1,04 MB |
  | `sourceUrl` | 225 KB |
  | `accessLabel` | 194 KB |
  | `lastAttemptAt`, `lastSuccessAt` | je 190 KB |
  | `name` | 161 KB |

  Mit gzip 534 KB. Hinweise und Warnungen zeigt die Seite nur in 10 sichtbaren, zugeklappten Listenzeilen.
- `admin-loader.tsx:16-19`: Solange `statsPending>0`, holt der Loader die vollen 6,4 MB, verwirft sie und fragt nach 300 ms erneut. Jede Anfrage rechnet bis zu 8 s (`statsBudgetMs=8000`, `admin-data.mjs:117,124`) und schreibt `region_stats` (`:104`).
- `<AdminTimeline … revision={data.processing.revision}/>` ist immer eingehängt (`admin-processing.tsx:164`). Schlüssel `basis+':'+revision` (`admin-timeline.tsx:33`).
  - Während eines Auftrags holt `reload()` (`admin-processing.tsx:63`, höchstens einmal pro Minute) die Übersicht neu.
  - Eine neue Revision bedeutet einen neuen Timeline-Vollscan (55–92 s), mitten im Import.
- Weitere Vollreloads mit 6,4 MB: `refresh()` (~`:49`), Ende eines Auftrags (~`:80`), Aktionen. Die Kartenformen `public/geo/germany.json` (1,09 MB) und `de-areas.json` (2,37 MB) starten erst nach dem Dashboard; für `/geo/*` gibt es keine Cache-Regel in `public/_headers`.
- Darstellung:
  - `visible` (`:46`) filtert bei jedem Render alle 5.324 Gebiete mit `toLocaleLowerCase`.
  - Dazu kommen mehrere ungemerkte `filter`/`reduce` (`:45`, `:87`, `:96`, `:140`).

**Lückenatlas** (`?seite=atlas`, `components/admin-atlas.tsx:40-45` → `GET /api/admin/atlas` → `adminAtlas`, `server/integrations/admin-atlas.mjs:40-53`)
- Eigene Kosten 0,5–0,6 s: `areaFigures` mit 4 s Budget, dazu `source_coverage`. Die kalten 92 s sind Warten hinter fremden Scans.
- 1,8 MB Antwort, davon etwa 85 % statisch (`source-atlas.json`, `staticAreas()` `:16-38`). Dynamisch sind nur `cnt`, `fe`, `le`, `last`, `st`.
- Neuladen alle 5 min, auch im Hintergrund-Tab und ohne Schutz vor überlappenden Läufen. Die Karte erscheint erst mit den Atlasdaten (`:96`). Ladetext mit fest eingetragener Zahl „5324“ (`:95`).

**Qualität & Betrieb** (`?seite=qualitaet`, `AdminLoader` → `AdminDashboardView`)
- `GET /api/admin/overview` mit Prüfliste, 6,4 MB. Gebraucht werden davon etwa 1 %: Zählungen und `{id,name}`.
- `GET /api/admin/quality` (gespeichert, 0,08 s) startet erst nach dem Dashboard.
- `GET /api/admin/review` bei jedem Filterwechsel; mit aktuellen `region_stats` billig (25 ms).
  - **Aber:** Stehen mehr als 100 Gebiete aus, gibt `reviewScope` `null` zurück (`admin-data.mjs:40-41`). Dann zählt `:63` über alle Berichte mit `payload`-Bedingung (Vollscan, ~30 s), und `:59` läuft über `idx_topics_canonical_updated` bis 25 Treffer, bei seltenen Gründen also über die ganze Tabelle.
- `admin-dashboard.tsx:11` importiert `regionName` aus `@/shared/regions`. Das zieht den ganzen Katalog (540 KB) ins Bündel.
- DOM: natives `<select>` mit 5.325 Optionen (`database-admin.tsx:20`), Radix-Select mit 3.517 Einträgen (`admin-dashboard.tsx:60`).
- `POST /api/admin/quality {check}` (`quality-check.mjs:19-58`): ein bis zwei Vollscans je Prüfung, 0,2–87 s.

**Hochrechnung** (`?seite=hochrechnung`)
- GET liest den gespeicherten Stand (`admin-estimate-store.mjs`, `system_state['admin-estimate']`, gzip): 0,07 s. **Das ist das Vorbild.**
- POST (`admin-estimate.mjs:26-85`):
  - `adminTimeline(event)` (`:27`), etwa 70 s ohne Cache
  - `DETAILS_SQL` (`:18`): Vollscan mit drei korrelierten `json_each` je Zeile, etwa 123 s
- Der gespeicherte Stand gilt dauerhaft als veraltet: berechnet bei Revision 1.910.240, heute 2.316.386.

**Stichwörter** (`?seite=stichwoerter`)
- `GET /api/admin/keywords` → `atRevision(db,'keywords',…)` (`server/repositories/admin.ts:25`) → `adminKeywords` (`admin-keywords.mjs:33-80`): fünf Vollscans.

  | Abfrage | Stelle | Dauer |
  |---|---|---|
  | Zähler | `:35-41` | ~22 s |
  | Begründungen | `:43` | ~23 s |
  | Titelbegriffe | `:44` | ~28 s |
  | Themen | `:45` | ~26 s |
  | KI-Stichwörter | `:47-53` | ~18 s |

  Zusammen ~117 s. Der Wiederabruf ist nur im Arbeitsspeicher gesichert und verfällt mit jedem Importschritt.

**Kleineres**
- `GET /api/admin/run-debug` (`import-trace.mjs:59-63`): `json_extract(details,'$.region')=?` als Scan über `import_runs`, 40 ms, wächst linear.
- `GET /api/admin/export` baut die volle Übersicht **mit** Prüfliste.
- `GET /api/admin/database?action=audit` (`data-completeness.mjs:17-23`): ein Vollscan, etwa 30 s, nur auf Knopfdruck.

### 2.5 Querschnittsfehler

| Befund | Stelle | Folge |
|---|---|---|
| Cache-Verdrängung je „Art“ | `server/integrations/revision-cache.mjs:21` | Übersicht nie warm; Abruf-Seite und Hochrechnung verdrängen ebenfalls |
| Globaler Datenstand zählt bei `source_coverage` mit | Trigger `drizzle/0004_fair_arclight.sql:7-73`; `sync.ts:149` und `:56` schreiben bei **jedem** Lauf | Jeder Importschritt macht alle `atRevision`-Einträge, die Hochrechnung und die Prüfungen „veraltet“ |
| Cache nur im Arbeitsspeicher | `revision-cache.mjs:12` (`WeakMap`) | Verloren bei Neustart, HMR und Isolate-Wechsel |
| GET rechnet und schreibt | `regionFigures` (`admin-data.mjs:81-110`, `INSERT OR REPLACE` `:104`), aufgerufen aus Übersicht (8 s), Atlas und Abdeckung (je 4 s) | Doppelte Arbeit bei parallelen Seiten; Budget nur zwischen Abschnitten geprüft |
| Prüfliste scannt bei vielen veralteten Gebieten | `admin-data.mjs:40-41,59,63` | Nach jedem Lauf über viele Gebiete kostet jeder Filterwechsel einen Vollscan |
| Kein HTTP-Caching | `server/services/admin-auth.ts:5` `'private, no-store, max-age=0'`; alle Client-`fetch` mit `cache:'no-store'` | Jeder Aufruf kalt am Server |
| Seitenwechsel = voller Seitenaufruf | `components/admin-chrome.tsx` `<a href>` in `AdminHeader` | Kein gemeinsamer Speicher, alles wird neu geladen |
| `read-cache.mjs` (TTL 30 s) | nur `server/repositories/analytics.ts:23,26` | Für die Admin-Seiten ohne Bedeutung |

### 2.6 Kostentreiber (Rangliste)

| Rang | Kostentreiber | Stelle | Wirkung | Paket |
|---|---|---|---|---|
| 1 | Vollscans über `topics.payload` in Seiten-GETs | `admin-timeline.mjs:23`, `admin-coverage.mjs:24`, `admin-keywords.mjs:34-54`, `admin-data.mjs:63` | Übersicht ~122 s, Stichwörter ~117 s, Zeitverlauf 52–92 s, Prüfliste ~30 s; in Produktion über dem Limit von 30 s | P09–P15a, P20 |
| 2 | Cache-Verdrängung `timeline|*` | `revision-cache.mjs:21` | Übersicht warm 75 s | P01 |
| 3 | Serielle D1 ohne Abbruch | Plattform | Atlas kalt 92 s und Abruf kalt 38 s durch Warten; 163 Pipeline-POSTs ≥ 100 s, `/api/health` bis 36 s | indirekt durch 1, 5 |
| 4 | Cache nur im Arbeitsspeicher, globale Revision | `revision-cache.mjs`, `drizzle/0004`, `sync.ts:149` | Im Normalbetrieb zählt der kalte Pfad | P14, P16, P19–P20 |
| 5 | Zeitverlauf lädt bei jeder Revision | `admin-timeline.tsx:33`, `admin-processing.tsx:63,164` | bis zu einem Vollscan (55–92 s) pro Minute während Aufträgen | P02 |
| 6 | 6,4 MB je Übersichts-Aufruf, Schleife alle 300 ms | `admin-data.mjs:143`, `admin-loader.tsx:19` | Bau, Übertragung und Parse von 6,4 MB, mehrfach je Besuch | P03, P23–P27d |
| 7 | GET rechnet `regionFigures` mit Budget | `admin-data.mjs:124`, `admin-atlas.mjs:41`, `area-figures.mjs:13` | GET schreibt; doppelte Arbeit | P15a |
| 8 | POST-Rechnungen als Einzelabfrage | Hochrechnung 2–3 min, Prüfungen bis 87 s, Audit ~30 s | Scheitern in Produktion | P19, P21a–c, P22 |
| 9 | Kein HTTP- und Client-Cache, `<a href>` | `admin-auth.ts:5`, `admin-chrome.tsx` | Jeder Seitenwechsel kalt | P16–P17, P25–P26 |
| 10 | Kleinkram | Status-Scan 0,5 s je Übersicht; `run-debug`-Scan; Export mit Prüfliste; Atlas mit 1,5 MB statischen Daten; `/geo/*` ohne Cache-Regel; Katalog im Bündel | – | P04, P07, P08, P09, P23 |

### 2.7 Vorhandene Muster, die wiederverwendet werden

- **Muster A: Werte je Gebiet, nur geänderte neu.** `region_stats` und `region_revisions` (`drizzle/0011_region_stats.sql`, `admin-data.mjs:66-110`). Gebiete sind veraltet, wenn die Revision abweicht oder `stats.v≠FIGURES_VERSION` (`:70`, heute `2`).
- **Muster B: Ergebnis gespeichert, GET liest, POST rechnet.**
  - `admin-estimate-store.mjs`: gzip und Base64 über `CompressionStream`, weil eine D1-Zeile höchstens 2 MB fasst.
  - `quality-check.mjs:65-81`: `system_state['admin-quality-check']`.
- **Muster C: lange Arbeit in vielen kurzen Anfragen.**
  - `server/integrations/search-words.mjs`: Stand in `system_state`, `onlyIfBuilt`, `maxCards`, `GONE_MAX`. Massenschreiben über `json_each(?)` in `insertRows` (`:60-63`): eine Anweisung je 1.500 Zeilen, mit `WHERE true`.
  - `pipeline-jobs.mjs:49-56`: Sperre `pipeline-lease` per `INSERT … ON CONFLICT … WHERE … RETURNING`.
- **Import-Haken:** `server/services/sync.ts:42` bildet `const data = await (… refreshSummaries(…) : refreshMetadata(…))`. Zeile 44 ruft danach, noch unter der Import-Sperre (`:36`), `refreshSearchWords(…,{onlyIfBuilt:true})` in try/catch auf. `refreshMetadata` liefert in Zeile 167 `resume`: Der Import ist noch nicht fertig, ein weiterer Schritt folgt.

---

## 3. Zielarchitektur

### 3.1 Leitregeln (verbindlich)

- **R1.** Ein GET schreibt nie und liest `topics.payload` nie über mehr als ein Gebiet.
  - Erlaubt: kleine Tabellen (`region_stats`, `region_series`, `region_revisions`, `source_coverage`, einzelne `system_state`-Zeilen), `import_runs … LIMIT` über einen Index.
  - Erlaubt sind außerdem Index-Zählungen `count(*)` über Teilindizes ohne `payload`-Bedingung (z. B. `idx_topics_canonical_region_status`).
  - Für die Prüfliste (`adminReview`) gilt:
    - Liste mit `INDEXED BY idx_topics_canonical_updated … LIMIT 25`.
    - Zählung veralteter Gebiete nur, wenn es höchstens 500 sind, gebunden über `json_each(?)`.
    - Stehen mehr aus, wird nicht gezählt, und der Indexlauf liest höchstens 5.000 Zeilen (P15a).
  - Ausnahmen:
    - `GET /api/admin/database?action=audit`, nur auf Knopfdruck, bis P22
    - der Rückfall ohne Migration 0011
- **R2.** Jede lesende Admin-Route mit Bezug zum Bestand antwortet über `adminRead()` mit schwachem ETag. Passt `If-None-Match`, kommt 304, ohne dass die Antwort gebaut wird.
- **R3.** Jede solche Antwort trägt `stand` (Typ in 3.5). Die Oberfläche zeigt ihn einheitlich mit `StandLine`.
- **R4.** Gerechnet wird nur in POST-Schritten:
  - Budget 5–8 s je Schritt, unter **einer** Sperre `admin-refresh-lease`.
  - Jede einzelne Abfrage höchstens etwa 25.000 Berichte (etwa 2–3 s).
  - Der Zustand liegt fortsetzbar in `system_state`.
  - Jeder Schritt ist wiederholbar, ohne doppelt zu zählen (Revisionsschutz bzw. Vergleichen-und-Tauschen, 3.4).
  - **Ausnahme:** Der Import-Haken (P13) rechnet das eigene Gebiet ohne diese Sperre. Bis zu 24 Haken können parallel laufen. Geschützt sind sie über `WHERE excluded.revision>=…revision`.
- **R5.** Kein Rückfall auf Vollscans in GETs, wenn `0016` fehlt. Dann kommt `stand.missing='0016'`. Der bestehende Rückfall bei fehlender Migration `0011` bleibt vorerst (siehe Abschnitt 7).
- **R6.** Der Browser verwirft nie fertige Daten:
  - Er zeigt den letzten Stand, prüft im Hintergrund nach und tauscht dann aus.
  - Je URL läuft höchstens eine Anfrage gleichzeitig.
  - „Aktualisieren“ setzt nie `data=null`.
- **R7.** Prozess-Speicher ist kein Speicher. `atRevision` verschwindet aus allen Admin-Pfaden. Ausnahmen:
  - der Rückfall ohne Migration 0011 (`admin-data.mjs:136`, `area-figures.mjs:15`)
  - `/api/sources` (`app/api/sources/route.ts:40`)

### 3.2 Drei Datenklassen

| Klasse | Inhalt | Wo | Wer rechnet | Auslieferung |
|---|---|---|---|---|
| **A: ändert sich nur mit dem Deploy** | Katalog, Atlas-Grunddaten (`staticAreas()`), Zugang und Kanal (`accessFields`), Quellenart, Katalogteil der Abdeckung | JSON im Bundle | einmal je Isolate gebaut und gemerkt | `GET /api/admin/static?v=<ver>` (NEU), `immutable` |
| **B: Werte je Gebiet** | `region_stats` (vorhanden) und `region_series` (NEU): Tage nach Sitzungstag mit Hochrechnungsspalten, Tage nach Aufnahmetag, Zählung nach Status | D1 | Import-Haken (eigenes Gebiet), Nachholschritte (geänderte Gebiete) | beim Lesen abgeleitet (ms bis wenige 100 ms): `timeline`, `coverage`, `atlas`, `areas`, `summary`; ETag/304 |
| **C: globale Auswertungen** | Stichwörter, Qualitätsprüfungen, Hochrechnung, optional Vollständigkeitsprüfung | `system_state` (gzip, in Abschnitten) | Bauauftrag in Gebietsabschnitten bzw. Rechnung aus Klasse B, auf Knopfdruck oder Runner | gespeicherter Text ohne Parse; ETag/304 |

**Ressourcen (Zielbild)**

| Route | Inhalt | Größe roh → gzip (geschätzt) | Cache |
|---|---|---|---|
| `GET /api/admin/static?v=` (NEU) | Klasse A, `areas` in Katalogreihenfolge | 1,3–1,6 MB → 200–250 KB | `private, max-age=31536000, immutable`, wenn `v` passt |
| `GET /api/admin/areas` (NEU) | veränderliche Werte je Gebiet als Zeilen-Arrays | 0,5–0,8 MB → 80–150 KB | ETag |
| `GET /api/admin/area?id=` (NEU) | `issues`, `warnings`, `sourceUrl` eines Gebiets | 0,1–80 KB | ETag |
| `GET /api/admin/summary` (NEU) | Kopfzahlen, Läufe, Auftragsstand, `stand` | 15–30 KB | `no-store` |
| `GET /api/admin/coverage` | wie heute plus `stand` | 7,7 KB | ETag |
| `GET /api/admin/timeline?basis=` | wie heute plus `stand` | ~1 MB → ~200 KB | ETag |
| `GET /api/admin/atlas` | bis P27c wie heute (nur lesend), danach entfällt die Route | 1,8 MB → 260 KB | ETag |
| `GET /api/admin/keywords`, `/estimate`, `/quality` | gespeicherter Stand plus `stand` | 250 KB / 1,2 MB / 24 KB | ETag |
| `GET` und `POST /api/admin/refresh` (NEU) | Status bzw. ein Rechenschritt | < 5 KB | `no-store` |
| `/geo/*.json` | Kartenformen | 3,46 MB | `public, max-age=86400, stale-while-revalidate=604800` |

### 3.3 Datenmodell: Migration `drizzle/0016_admin_precompute.sql` (NEU)

0016 ist die nächste freie Nummer (letzte: `0015_search_cards_gone.sql`; auf keinem Branch belegt). Stil wie 0011: `IF NOT EXISTS`, `--> statement-breakpoint`, kein Nachfüllen in der Migration. **Kein `drizzle-kit generate`:** `drizzle/meta/_journal.json` endet bei 0009, und `db/schema.ts` kennt die Tabellen ab 0010 nicht.

```sql
-- Werte je Gebiet für die Administration (server/integrations/region-facts.mjs): Tage nach Sitzungstag (mit den
-- Spalten der Hochrechnung) und nach Aufnahmetag, Zählung nach Status. Wie region_stats nur für Gebiete neu
-- gerechnet, deren region_revisions sich geändert hat; Seitenaufrufe lesen nur.
CREATE TABLE IF NOT EXISTS `region_series` (
	`region_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`v` integer NOT NULL,
	`computed_at` text NOT NULL,
	`event_days` text NOT NULL,   -- JSON [[day|null, n, mitPdf, pdfLinks, folgeberatungen, beratungen], …]
	`import_days` text NOT NULL,  -- JSON [[day|null, n], …]
	`statuses` text NOT NULL      -- JSON {"approved":n, …}
);
--> statement-breakpoint
-- Teilsummen laufender Bauaufträge (Stichwörter); nach Abschluss geleert.
CREATE TABLE IF NOT EXISTS `admin_agg` (
	`build` text NOT NULL,
	`list` text NOT NULL,          -- 'terms' | 'subjects' | 'ai' | 'rule'
	`g` text NOT NULL DEFAULT '',  -- bei 'rule': Label
	`k` text NOT NULL,
	`n` integer NOT NULL DEFAULT 0,
	`a` real NOT NULL DEFAULT 0,   -- ai: Gewicht
	`b` integer NOT NULL DEFAULT 0,-- ai: Berichte mit Inhalt als Grundlage
	`c` real NOT NULL DEFAULT 0,   -- ai: Gewicht mit Inhalt als Grundlage
	PRIMARY KEY(`build`,`list`,`g`,`k`)
) WITHOUT ROWID;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_import_runs_started` ON `import_runs` (`started_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_import_runs_region` ON `import_runs` (json_extract(`details`,'$.region'),`started_at`);
```

- Platz: `region_series` ~5–10 MB, `admin_agg` vorübergehend bis ~30 MB.
- `import-trace.mjs` muss den Ausdruck exakt so schreiben: `json_extract(details,'$.region')=?`. Das tut es heute.
- Die Tests spielen alle `drizzle/*.sql` in eine In-Memory-SQLite ein, also auch 0016.

### 3.4 Server-Module und Signaturen

**Modulaufteilung gegen Kreisimporte (wichtig).** `admin-data.mjs` importiert `admin-timeline.mjs` (`FIRST_DAY_SQL`). Würde `admin-timeline.mjs` ein Modul importieren, das seinerseits `admin-data.mjs` importiert, entstünde ein Kreis. `FIGURES` wird beim Laden ausgewertet, das ergäbe einen TDZ-Fehler. Deshalb:
- `region-series.mjs` (NEU) ist ein **Blatt**: Es importiert kein `admin-*`-Modul. Es enthält Leser und Konstanten.
- `region-facts.mjs` (NEU) ist der **Rechner**. Er importiert `FIGURES` aus `admin-data.mjs`. `admin-data.mjs` importiert `region-facts.mjs` **nie**.

**Sortierung von Gebietskennungen:** überall, wo Reihenfolge zählt (Abschnitte, Einheiten, Zeitverlauf), binär wie SQL: `ORDER BY region_id` bzw. in JS `(a,b)=>a<b?-1:a>b?1:0`. **Nie `localeCompare`** (wie in `admin-data.mjs:95`), sonst stimmen Beispiele und Reihenfolgen nicht mit `ORDER BY region_id` überein.

**`server/integrations/region-series.mjs` (NEU, Blatt)**

```js
export const SERIES_VERSION=1;
export const FIGURES_VERSION=2;   // umgezogen aus admin-data.mjs:70; admin-data.mjs importiert es von hier
/** Nur lesend. Map<region_id,{revision,v,computedAt,eventDays?,importDays?,statuses?}> (JSON geparst), null wenn die Tabelle fehlt. */
export async function readSeries(db,{columns=['event_days','import_days','statuses']}={})
/** Nur lesend: {pending,unbuilt,total}; {missing:'0016'} ohne Tabelle.
 *  unbuilt: Gebiete ohne Zeile in region_series oder region_stats (noch nie berechnet).
 *  pending: Zeilen vorhanden, aber Revision oder Version passt nicht (veraltet). */
export async function pendingRegions(db)
```

Die Abfrage für `pendingRegions` liest etwa 3.516 Zeilen, ~10–30 ms:

```sql
SELECT coalesce(sum(s.region_id IS NULL OR t.region_id IS NULL),0) unbuilt,
 coalesce(sum(s.region_id IS NOT NULL AND t.region_id IS NOT NULL AND (s.revision IS NOT r.revision OR s.v IS NOT ?
   OR t.revision IS NOT r.revision OR json_extract(t.stats,'$.v') IS NOT ?)),0) pending,
 count(*) total
FROM region_revisions r LEFT JOIN region_series s ON s.region_id=r.region_id LEFT JOIN region_stats t ON t.region_id=r.region_id
```

Gebunden werden `SERIES_VERSION` und `FIGURES_VERSION`.

**`server/integrations/region-facts.mjs` (NEU, Rechner)**

```js
/** Rechnet veraltete und fehlende Gebiete nach (region_stats und/oder region_series), kleinste zuerst, Abschnitt für Abschnitt bis budgetMs.
 *  regions: nur diese Gebiete betrachten (Import-Haken). Rückgabe {done,pending,unbuilt,ms}. */
export async function refreshRegionFacts(db,{regions,budgetMs=5000,chunkRows=25000,now=new Date()}={})
```

Ablauf:

1. **Ein `db.batch` liest:**
   - `SELECT region_id,revision FROM region_revisions`
   - `SELECT region_id,revision,json_extract(stats,'$.v') v FROM region_stats`
   - `SELECT region_id,revision,v FROM region_series`
   - Größen: `SELECT region_id,count(*) n FROM topics WHERE ${canonical} GROUP BY region_id`. Das ist eine Index-Zählung wie `admin-data.mjs:88`, ~0,4 s. Sie gilt auch für neue Gebiete ohne `region_stats`, deshalb wird nicht `region_stats.count` verwendet.

   Mit `regions` bekommt jede dieser Abfragen `WHERE region_id IN (SELECT value FROM json_each(?))`. Der Haken liest also nur die eigenen Zeilen, nicht die 2,6 MB von `region_stats`. Die Revision wird **vor** dem Scan gelesen, wie heute.
2. **Veraltet je Art:**
   - `stats`: Zeile fehlt, Revision verschieden oder `v≠FIGURES_VERSION`
   - `series`: Zeile fehlt, Revision verschieden oder `v≠SERIES_VERSION`
   - Sortierung aufsteigend nach Größe, bei Gleichstand binär nach `region_id`.
3. **Abschnitte:** Summe der Größen ≤ `chunkRows`, höchstens 500 IDs. Ein größeres Gebiet bildet einen eigenen Abschnitt. IDs werden **als ein JSON-Wert** gebunden: `region_id IN (SELECT value FROM json_each(?))`. Damit gilt die Grenze von 100 Parametern nicht. Der Plan wurde geprüft: `SEARCH … idx_topics_canonical_region_updated`.
4. **Je Abschnitt** laufen nur die Abfragen der veralteten Arten:
   - **stats:** die heutige Abfrage aus `admin-data.mjs:101` (`SELECT region_id,count(*) count,${FIGURES} FROM topics WHERE ${canonical} AND region_id IN (…) GROUP BY region_id`), nur mit `json_each(?)` statt `?,?,…`. `FIGURES` wird in `admin-data.mjs:71` dafür exportiert.
   - **series:** Die Ausdrücke sind wörtlich aus `admin-timeline.mjs:6,9` und `admin-estimate.mjs:18` übernommen.
     ```sql
     WITH t AS MATERIALIZED (
       SELECT region_id,
         substr((SELECT min(json_extract(value,'$.date')) FROM json_each(payload,'$.events')),1,10) eday,
         substr(json_extract(payload,'$.metadata.firstImportedAt'),1,10) iday,
         (SELECT count(*) FROM json_each(payload,'$.documents') WHERE json_extract(value,'$.kind') IN ('application/pdf','pdf')) pdfs,
         (SELECT count(DISTINCT substr(json_extract(value,'$.date'),1,10)) FROM json_each(payload,'$.events')) days
       FROM topics WHERE json_extract(payload,'$.identity.mergedInto') IS NULL AND region_id IN (SELECT value FROM json_each(?)))
     SELECT region_id,eday,iday,count(*) n,sum(pdfs>0) wd,sum(pdfs) links,sum(days>1) fu,sum(days) cons
     FROM t GROUP BY region_id,eday,iday
     ```
     - Erwarteter Plan (lokal, SQLite 3.51.3, geprüft):
       - `MATERIALIZE t`, darin `SEARCH topics USING INDEX idx_topics_canonical_region_updated`.
       - **Genau drei** `CORRELATED SCALAR SUBQUERY`: 1 = erster Sitzungstag (events), 2 = PDFs (documents), 3 = Beratungstage (events, count DISTINCT). Alle stehen unterhalb von `MATERIALIZE`.
       - Danach `SCAN t` und `USE TEMP B-TREE FOR GROUP BY`.
     - Zwei Unterabfragen über `$.events` sind gewollt. `MATERIALIZED` verhindert nur, dass die Gruppierung die Ausdrücke erneut auswertet.
     - Kennt D1 `MATERIALIZED` nicht, die Unterabfrage mit `LIMIT -1` als Schranke verwenden.
   - **statuses:** im selben Durchgang wie series.
     ```sql
     SELECT region_id,status,count(*) n FROM topics
     WHERE json_extract(payload,'$.identity.mergedInto') IS NULL AND region_id IN (SELECT value FROM json_each(?)) GROUP BY 1,2
     ```
     Der Plan nutzt `idx_topics_canonical_region_status` (geprüft). `INDEXED BY` nicht setzen.
5. **Falten in JS je Gebiet:**
   - `event_days`: eine Zeile je `eday`, **roh gespeichert**. Fehlerhafte Tage bleiben Text, fehlende sind `null`. Werte: Summen von `n`, `wd`, `links`, `fu`, `cons` über alle `iday`.
   - `import_days`: eine Zeile je `iday` (roh bzw. `null`) mit der Summe von `n`.
   - `statuses`: Objekt `{status:n}`.
   - Ein Gebiet ohne kanonische Berichte bekommt leere Arrays bzw. `{count:0,v}` in `region_stats`, wie heute `admin-data.mjs:103`.
6. **Schreiben als Massen-Upsert** (Muster `search-words.mjs:60-63`): eine Anweisung je Tabelle und je ≤ 90 KB JSON, höchstens 10 Anweisungen je Schritt. Jede Zeile ist ein Array. Die JSON-Spalten stehen darin als Text (`JSON.stringify`).
   ```sql
   INSERT INTO region_series(region_id,revision,v,computed_at,event_days,import_days,statuses)
   SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]'),
          json_extract(value,'$[4]'),json_extract(value,'$[5]'),json_extract(value,'$[6]')
   FROM json_each(?) WHERE true
   ON CONFLICT(region_id) DO UPDATE SET revision=excluded.revision,v=excluded.v,computed_at=excluded.computed_at,
     event_days=excluded.event_days,import_days=excluded.import_days,statuses=excluded.statuses
   WHERE excluded.revision>=region_series.revision
   ```
   ```sql
   INSERT INTO region_stats(region_id,revision,computed_at,stats)
   SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]')
   FROM json_each(?) WHERE true
   ON CONFLICT(region_id) DO UPDATE SET revision=excluded.revision,computed_at=excluded.computed_at,stats=excluded.stats
   WHERE excluded.revision>=region_stats.revision
   ```
   - `WHERE true` ist bei `INSERT…SELECT…ON CONFLICT` Pflicht.
   - Das ersetzt `INSERT OR REPLACE`.
   - Die Spaltenliste von `region_stats` vorher in `drizzle/0011_region_stats.sql` gegenprüfen.
7. **Budget** zwischen den Abschnitten prüfen. Rückgabe `{done,pending,unbuilt,ms}`.

Kosten:
- Erstaufbau von `region_series`: 65–130 s D1-Zeit, also 15–30 Schritte zu 5 s.
- Danach je Import: Median-Gebiet (244 Berichte) etwa 0,05 s, Hamburg (22.000) lokal gemessen 0,6 s für series, mit stats und statuses bis ~2 s.

**`server/integrations/admin-data.mjs` (geändert)**
- `export const FIGURES` (Zeile 71). `FIGURES_VERSION` kommt aus `region-series.mjs`.
- `regionFigures(db,{now})` wird **reiner Leser**:
  - Die Rechenschleife (Zeilen 96–106) entfällt.
  - `pending` = Zahl der veralteten oder fehlenden Gebiete.
  - Der Parameter `budgetMs` entfällt; alle Aufrufer werden angepasst.
  - Der Rückfall `null` bei fehlender 0011 bleibt.
- `reviewScope` / `adminReview` (P15a):
  - Veraltete Gebiete werden über `region_id IN (SELECT value FROM json_each(?))` gezählt, solange es höchstens 500 sind. Die Grenze `D1_MAX_PARAMETERS` in `:41` entfällt dafür.
  - Bei mehr als 500 gibt `reviewScope` `{total:null,pending:n,regions:null}` zurück. `adminReview` zählt dann nicht (`:63` entfällt) und antwortet `{issue,total:null,pending:n,articles}`.
  - Die Liste läuft in diesem Fall über `FROM (SELECT * FROM topics INDEXED BY idx_topics_canonical_updated WHERE ${canonical} ORDER BY updated_at DESC,id LIMIT 5000) WHERE (${conditions[issue]}) … LIMIT 25`.
- `loadAdminData`: Status-Zählung aus `region_series.statuses` statt Index-Scan; ohne `region_series` wie heute.
- NEU `buildAreas(db,{now})` (P24a) und `buildSummary(db,{now})` (P24b).

**`server/integrations/admin-timeline.mjs` (geändert)**
- `adminTimeline(db,{basis,now})` holt die Zeilen aus `readSeries(db,{columns:[basis==='event'?'event_days':'import_days']})`.
  - Die Zeilen werden zu `{area,day,count}` ausgeklappt (`count` = `n`).
  - **Sortierung wie SQL `ORDER BY day,region_id`:** `null` zuerst, dann binärer Stringvergleich (`a<b`), **kein `localeCompare`**.
- Der Rest der Funktion (Zeilen 24–31) bleibt unverändert. `atRevision` entfällt.
- Fehlt die Tabelle: `{basis,missing:'0016',asOf,today,total:0,days:[],areas:{},undated:{}}`.
- NEU exportiert, nur für Tests und das Skript: `timelineRowsSql(db,basis)` mit der alten Abfrage aus Zeile 23.

**`server/integrations/admin-estimate.mjs` (geändert)**
- NEU `export function detailsFromSeries(seriesMap,from,to)`:
  - Summiert alle `event_days`-Einträge mit `day!==null && day>=from && day<=to` je Gebiet zu `{area,withDocuments,links,followUps,consultations}`.
  - Ein Gebiet erscheint nur, wenn mindestens ein Eintrag passt, wie bei SQL `GROUP BY area`.
  - Das ist exakt `DETAILS_SQL`, weil der Tag roh gespeichert ist.
- `DETAILS_SQL` wird für Tests exportiert. `atRevision` entfällt.
- `computeEstimate` bricht mit `AdminError(409,'Erst nach der Vorberechnung möglich')` ab, solange `pendingRegions().unbuilt>0`.

**`server/integrations/admin-refresh.mjs` (NEU): Sperre und Schritt-Verteiler**

```js
/** Sperre ohne Warten. fn läuft nur, wenn die Sperre frei ist; sonst {busy:true,until}. */
export async function withRefreshLease(db,budgetMs,fn)
/** Ein Schritt: action 'step'|'start'|'cancel', target 'regions'|'keywords'|'quality:<id>'|'quality:all'|'audit'.
 *  Rückgabe {target,state:'running'|'done'|'busy'|'conflict',done,total,pending,ms,until?}. */
export async function refreshStep(db,{action='step',target='regions',restart=false,budgetMs=5000,now=new Date()})
/** Nur lesend: {regions:{pending,unbuilt,total}|{missing:'0016'},builds:{[target]:state},busy?:{until},jobRunning:boolean,importBusyUntil:string|null} */
export async function refreshStatus(db)
```

- Sperre:
  ```sql
  INSERT INTO system_state(key,value) VALUES('admin-refresh-lease',?)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER)<? RETURNING value
  ```
  - Gebunden werden `String(Date.now()+budgetMs+20000)` und `Date.now()`.
  - Freigabe im `finally`: `DELETE FROM system_state WHERE key='admin-refresh-lease' AND value=?`.
  - Das `finally` läuft bei einem abgebrochenen Worker nicht sicher. Dann läuft die Sperre nach Budget + 20 s ab.
  - Die Sperre allein schützt nicht vor doppeltem Zählen: Ein Schritt kann länger laufen als die Sperre, etwa wenn D1 durch einen Import belegt ist. Den Schutz liefern Revision (Klasse B) und Vergleichen-und-Tauschen (Bauaufträge, unten).
  - **Nie `import-lock` oder `pipeline-lease` benutzen.**
- `target:'regions'` ruft `refreshRegionFacts(db,{budgetMs})` auf. `state` ist `'done'`, wenn `pending+unbuilt===0`.
- `jobRunning`/`importBusyUntil` kommen aus dem Auftragsstand (`processingState`, `server/integrations/processing-status.mjs`) und `system_state['import-lock']` (wie `admin-data.mjs:133,145`, `lockedUntil` aus `import-lock.mjs`).

**`server/integrations/admin-stand.mjs` (NEU): Kennungen in einem Batch, ~5–30 ms**

```js
/** {stock,stockSum,seriesStamp,statsStamp,pending,unbuilt,total,content,seriesComputedAt,statsComputedAt}|{missing:'0016'} */
export async function adminStand(db)
// 1) SELECT count(*) n,total(revision) s FROM region_revisions                        → stock, stockSum
// 2) SELECT count(*) n,total(revision) s,max(computed_at) m FROM region_series         → seriesStamp ('n:s:m'), seriesComputedAt
// 3) SELECT count(*) n,total(revision) s,max(computed_at) m FROM region_stats          → statsStamp ('n:s:m'), statsComputedAt
// 4) pendingRegions (siehe oben)                                                       → pending, unbuilt, total
// 5) SELECT revision FROM data_revisions WHERE id='content'                            → content
```

- `stockSum` steigt nur, wenn sich Berichte ändern (Trigger aus 0011). Ein Schreiben in `source_coverage` ändert nur `content`.
- `max(computed_at)` gehört in die Stempel. Sonst ändert ein neuer Aufbau bei gleicher Revision (`--full`, Versionswechsel, Korrektur am Rechner) das ETag nicht, und der Browser bekäme 304 mit alten Inhalten.

**`server/services/admin-etag.mjs` (NEU, rein, testbar) und `server/services/admin-http.ts` (NEU)**

`admin-http.ts` importiert aus `admin-auth.ts`, das `cloudflare:workers` importiert. Deshalb liegen `etagMatches` und `fnv` in der reinen Datei `admin-etag.mjs`, und `admin-http.ts` exportiert sie weiter.

```ts
import {requireAdmin,adminFailure} from '@/server/services/admin-auth';
import {etagMatches,fnv} from '@/server/services/admin-etag.mjs';
export {etagMatches,fnv};
const BASE={'Vary':'Cookie, oai-authenticated-user-id','X-Robots-Tag':'noindex, nofollow'};
export const ADMIN_READ_HEADERS={...BASE,'Cache-Control':'private, no-cache'};
export const ADMIN_IMMUTABLE_HEADERS={...BASE,'Cache-Control':'private, max-age=31536000, immutable'};
/** tag(): billige Kennung (≤ 5 kleine Abfragen). build(): Antwort (Objekt oder fertiger JSON-Text), nur wenn nötig. */
export async function adminRead(request:Request,tag:()=>Promise<string>,build:()=>Promise<unknown|string>,headers=ADMIN_READ_HEADERS){
 try{
  await requireAdmin();
  const etag=`W/"${await tag()}"`;
  if(etagMatches(request.headers.get('If-None-Match'),etag))return new Response(null,{status:304,headers:{...headers,ETag:etag}});
  const body=await build();
  return typeof body==='string'
   ?new Response(body,{headers:{...headers,ETag:etag,'Content-Type':'application/json; charset=utf-8'}})
   :Response.json(body,{headers:{...headers,ETag:etag}});
 }catch(e){return adminFailure(e);}
}
```

```js
// server/services/admin-etag.mjs
const bare=t=>t.trim().replace(/^W\//,'');
export const etagMatches=(h,etag)=>!!h&&(h.trim()==='*'||h.split(',').some(t=>bare(t)===bare(etag)));
/** FNV-1a (32 bit, hex) über die Teile, durch '|' verbunden. */
export function fnv(parts){let h=0x811c9dc5;for(const c of parts.join('|')){h^=c.charCodeAt(0);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16);}
```

`ADMIN_HEADERS` (`no-store`) bleibt für POST, Fehler, `summary` und `refresh`.

ETag-Bestandteile (Präfix erhöhen, wenn sich die Antwortform ändert). Alle Klasse-B-Kennungen enthalten zusätzlich `SERIES_VERSION` und `FIGURES_VERSION`:

| Route | Teile |
|---|---|
| `timeline?basis=` | `t1`, Versionen, basis, stockSum, seriesStamp, today |
| `coverage` | `c1`, Versionen, stockSum, seriesStamp, statsStamp, staticVer, today |
| `areas` | `a1`, Versionen, stockSum, statsStamp, content, staticVer, Stunde (wegen `updated7d`) |
| `atlas` (bis P27c) | `at1`, Versionen, stockSum, statsStamp, content, staticVer, Stunde |
| `area?id=` | `ar1`, content, id |
| `keywords` / `estimate` | `k1` / `e1`, `computedAt` des Stands, stockSum, Build-Zustand |
| `quality` | `q1`, größtes `checkedAt`, stockSum, content |

Bis P23 gibt es kein `staticVer`. Dort steht vorläufig die Konstante `'0'`.

**`server/integrations/admin-stored.mjs` (NEU): gespeicherte Stände (Klasse C)**

```js
export const PART_CHARS=90000;
/** Nur Kopf: {computedAt,stockSum,content,ms,rawBytes,parts}|null */
export async function storedMeta(db,name)
/** Kopf + Text (unverändert, ohne JSON.parse): {meta,text}|null */
export async function readStored(db,name)
/** Schreibt atomar in EINEM db.batch: alte Abschnitte löschen, neue Abschnitte, Kopf. */
export async function writeStored(db,name,data,{stockSum,content,ms})
export {gzipText,gunzipText}   // umgezogen aus admin-estimate-store.mjs; dort weiter re-exportiert
```

- Schlüssel: Kopf `admin-stored:<name>`, Abschnitte `admin-stored:<name>#000`, `#001` usw. (dreistellig), je höchstens `PART_CHARS` Zeichen Base64.
- Lesen: ein Batch aus Kopf und `SELECT key,value FROM system_state WHERE key>=? AND key<? ORDER BY key` (Bereich `…#` bis `…#~`). Stimmt die Zahl der Abschnitte nicht, gilt der Stand als fehlend.
- Abbruch mit Fehler bei gzip über 1,5 MB.
- Nutzer: `keywords` (NEU) und `estimate` (Umzug von `admin-estimate` mit einmaliger Übernahme). Die Qualitätsprüfungen bleiben in `admin-quality-check` (24 KB).

**`server/integrations/admin-builds.mjs` (NEU): Bauaufträge in Abschnitten**

- Zustand in `system_state['admin-build:<target>']`:
  ```json
  {"id":"…","target":"keywords","startedAt":"…","stockSum":476357,"content":2316386,"units":["…region_ids…"],"sizes":[…],"next":0,"partial":{},"ms":0}
  ```
- `startBuild(db,target,{restart})` ist idempotent:
  - Ein laufender Bau wird zurückgegeben.
  - `restart` erzeugt eine neue `id` und löscht `admin_agg` der alten.
  - `units` = `region_id` aus `region_revisions`, binär sortiert. `sizes` kommen aus der Index-Zählung `SELECT region_id,count(*) n FROM topics WHERE ${canonical} GROUP BY region_id`.
  - Die Prüfungen `badEventDate`, `conflicts` und `merge*` lesen auch zusammengeführte Zeilen; für sie ist die Größe nur ein Näherungswert.
- `stepBuild(db,target,{budgetMs=8000})`:
  - Nimmt ab `next` Abschnitte mit höchstens 25.000 Berichten, gebunden als `json_each(?)`.
  - Läuft, bis das Budget verbraucht ist. Am Ende folgt `finish`.
  - **Schutz gegen doppeltes Zählen (Vergleichen-und-Tauschen):** Jeder Abschnitt schreibt in **einem** `db.batch`. Ein `db.batch` ist eine Transaktion. Bedingung G:
    ```sql
    EXISTS(SELECT 1 FROM system_state WHERE key=? AND json_extract(value,'$.id')=? AND json_extract(value,'$.next')=?)
    ```
    Gebunden werden Schlüssel, Bau-`id` und das **erwartete** `next`.
    1. Alle Schreibanweisungen nach `admin_agg` tragen `AND G` in ihrer `WHERE`-Klausel (G ist konstant und wird einmal ausgewertet).
    2. Als letzte Anweisung kommt `UPDATE system_state SET value=? WHERE key=? AND json_extract(value,'$.id')=? AND json_extract(value,'$.next')=?`. Der neue Wert enthält das neue `next`, `partial` und `ms`.
    3. Hat das UPDATE keine Zeile geändert (`meta.changes===0`), hat der ganze Batch nichts bewirkt. Der Schritt endet dann mit `state:'conflict'`, und der Client fragt erneut.
  - Prüfungen ohne `admin_agg` schreiben nur das bedingte UPDATE.
- `cancelBuild(db,target)` löscht Zustand und `admin_agg` des Baus.
- **Stichwörter.** `admin-keywords.mjs` wird geteilt in `keywordChunk(db,ids,state)` und `keywordFinish(db,state)`. `adminKeywords` bleibt für Gleichheitstests.
  - Je Abschnitt:
    1. **Lesen** (vor dem Batch):
       - Zähler: die Summenabfrage aus Zeilen 35–41 mit `AND region_id IN (SELECT value FROM json_each(?))`.
       - Begründungen: die Abfrage aus Zeile 43 je Abschnitt; die JS-Logik wie Zeilen 57–68.
       - Ergebnis: `partial.counts` und `partial.outcome` aufaddiert, dazu Regelwort-Zeilen `[label, Schreibweise, n]`.
    2. **Schreiben** in einem Batch mit G:
       - Regelwörter als Massen-Upsert (je ≤ 90 KB JSON eine Anweisung):
         ```sql
         INSERT INTO admin_agg(build,list,g,k,n)
         SELECT ?,'rule',json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]') FROM json_each(?)
         WHERE <G> ON CONFLICT(build,list,g,k) DO UPDATE SET n=n+excluded.n
         ```
       - Titelbegriffe (`subjects` genauso mit `$.analysisFeatures.subjects`):
         ```sql
         INSERT INTO admin_agg(build,list,g,k,n) SELECT ?, 'terms', '', j.value, count(*)
         FROM topics, json_each(topics.payload,'$.analysisFeatures.terms') j
         WHERE json_extract(topics.payload,'$.identity.mergedInto') IS NULL AND topics.region_id IN (SELECT value FROM json_each(?))
           AND j.value IS NOT NULL AND <G>
         GROUP BY j.value
         ON CONFLICT(build,list,g,k) DO UPDATE SET n=n+excluded.n
         ```
       - `ai` mit `n`, `a`, `b`, `c`, gruppiert nach `trim(json_extract(j.value,'$.term'))`, mit den Bedingungen aus Zeilen 47–52, ebenfalls `AND <G>` und `ON CONFLICT … DO UPDATE SET n=n+excluded.n,a=a+excluded.a,b=b+excluded.b,c=c+excluded.c`.
       - Zuletzt das bedingte UPDATE des Bauzustands.
       - Eine `WHERE`-Klausel im SELECT ist bei `INSERT…SELECT…ON CONFLICT` Pflicht. Hier liefert G sie.
  - `finish`:
    - `terms`: `SELECT k term,n,count(*) OVER() distinctTerms,sum(n=1) OVER() once FROM admin_agg WHERE build=? AND list='terms' ORDER BY n DESC,k LIMIT 2000`
    - `subjects`: vollständig `ORDER BY n DESC,k`
    - `ai`: `… ORDER BY n DESC,a DESC,k LIMIT 20000` mit `count(*) OVER() spellings`
    - `rule`: alle Zeilen, `ORDER BY g,n DESC,k`. `merge()` (`admin-keywords.mjs:27`) nimmt bei Gleichstand die zuerst gesehene Schreibweise.
    - Danach `merge()` und Sortierung **unverändert** wie Zeilen 69–79. Ergebnis über `writeStored('keywords')`, dann `DELETE FROM admin_agg WHERE build=?` und den Bauzustand löschen.
  - **Einzige bekannte Abweichung:** Bei Regelwörtern gewinnt die Schreibweise mit der größten **Summe** über alle Abschnitte. Heute gewinnt die zuerst gesehene je Zeile (Sachgebiet, Begründung). Die Zahlen sind identisch. Die KI-Stichwörter sind exakt gleich, weil die alte Abfrage schon über alle Berichte je `trim(term)` gruppiert. Im Test festhalten.
  - `null` in `terms`/`subjects` wird ausgelassen (`j.value IS NOT NULL`). Im Gleichheitstest gilt dieselbe Bedingung für die alte Abfrage.
- **Qualitätsprüfungen.** In `quality-check.mjs` wird `rows(condition)` (Zeilen 19–22) zu `rows(condition,{regions})`. Mit `regions` lautet die Bedingung **immer geklammert**:
  ```sql
  … FROM topics WHERE (${condition}) AND region_id IN (SELECT value FROM json_each(?)) …
  ```
  Ohne Klammern bindet der Filter bei ODER-Ketten nur an das letzte Glied. `badEventDate` (`:44`) würde dann alle Gebiete zählen, und der Plan zeigt `SCAN topics`. Die Reihenfolge der Bindungen ist: Gebiets-JSON, dann `SAMPLES`.

  | Prüfung | Abschnitte | exakt? |
  |---|---|---|
  | truncatedTitle, emptyTitle, noEvents, badEventDate, eventDateMismatch, documentsWithoutUrl, conflicts, mergeTargetMissing, mergeChain | Gebiete binär aufsteigend; `count` aufaddieren; Beispiele sammeln, bis 20 erreicht sind | ja: heutige Ordnung `ORDER BY region_id,event_date DESC LIMIT 20`; Zielsuche über den Primärschlüssel |
  | dupSameMeeting | Gebiete aufsteigend; `groups`/`extra` aufaddieren; Top 20 je Abschnitt nach `count DESC,region_id,event_date DESC` zusammenführen | ja: Gruppen liegen innerhalb eines Gebiets (`:35`) |
  | dupSharedSystem | Einheiten = Gruppen nach `provider(id)` (`pipeline-jobs.mjs:31`) mit mindestens 2 Gebieten; je Gruppe die Abfrage aus `:27-29` mit `AND region_id IN (SELECT value FROM json_each(?))` (Bedingung geklammert); Top 20 nach `count DESC,url` | nur wenn gleiche Adresse gleichen `provider` heißt; **einmal lokal gegen die alte Abfrage prüfen** |
  | regionUnknown, orphanAnalyses, orphanVersions | ein Schritt wie heute | ja |

  - `finish` schreibt in `admin-quality-check` im heutigen Format plus `stockSum` und `content`.
  - Veraltet wird künftig in `storedQualityChecks` (`quality-check.mjs:67-70`) beim Lesen bestimmt. Die Funktion liest `adminStand` und setzt `stale = entry.stockSum !== stockSum`; bei den beiden orphan-Prüfungen zusätzlich `|| entry.content !== content`. Fehlt `stockSum` im Eintrag, gilt er als veraltet.

**`server/integrations/admin-static.mjs` (NEU)**
- `getAdminStatic()` baut einmal je Isolate den Text von Klasse A und merkt sich `{text,v}`, mit `v` = FNV-1a des Texts.
- Felder: `{v,builtAt,areas:StaticArea[],texts,categories,access,lands,catalog:{total,connected,history,sizes:{total,connected}}}`.
- `areas` in Katalogreihenfolge mit den heutigen `staticAreas()`-Feldern (`admin-atlas.mjs:16-38`) plus `id,name,ags,land,kind,method (Konfiguration),canImport,access,accessLabel,channel` (wie `admin-data.mjs:143`, `accessFields` `:22`).

**Neue und geänderte Routen**

| Route | Funktion |
|---|---|
| `app/api/admin/refresh/route.ts` (NEU) | GET → `refreshStatus`; POST `{action,target,restart?}` → `refreshStep` mit `requireSameOrigin` und `requireAdmin`, Budget 5000 (regions) bzw. 8000 (Bauaufträge) |
| `app/api/internal/admin-refresh/route.ts` (NEU) | **nur** die Bearer-Prüfung wie `app/api/internal/sync/route.ts:5-6`, **kein** `requireSameOrigin` und **kein** `requireAdmin`; dann `refreshStep(env.DB,body)` |
| `app/api/admin/static/route.ts` (NEU) | `?v=` passt → `ADMIN_IMMUTABLE_HEADERS`; sonst aktueller Inhalt mit `no-cache` |
| `app/api/admin/areas/route.ts`, `area/route.ts`, `summary/route.ts` (NEU) | siehe P24a/P24b |
| `timeline`, `coverage`, `atlas`, `keywords`, `estimate` (GET), `quality` (GET) | über `adminRead` mit `stand`; Signatur `GET(request:Request)` |
| `estimate` (POST) | rechnet aus `region_series`, schreibt `writeStored('estimate')` |
| `quality` (POST `{check}`) | startet bzw. treibt den Bau `quality:<id>`. Antwort während des Baus `{id,running:true,done,total}`, danach das Ergebnis wie heute. Der Client wiederholt, bis `running` fehlt. |

### 3.5 Browser-Module

**Typ `Stand`** (in `shared/admin-types.ts` ergänzen)

```ts
export type Stand={computedAt:string|null;stale:boolean;changes:number|null;pending:number;unbuilt:number;total:number;missing?:'0016';
 build?:{target:string;state:'running'|'paused';done:number;total:number;startedAt:string}|null};
```

- Abgeleitete Ansichten (Klasse B):
  - `computedAt` = `max(computed_at)` der genutzten Tabelle
  - `pending`, `unbuilt`, `total` aus `pendingRegions`
  - `stale = pending>0`
  - `changes = pending`
- Gespeicherte Stände (Klasse C):
  - `computedAt` des Stands; `computedAt:null`, wenn noch nie berechnet
  - `pending=0`, `unbuilt=0`, `total=0`
  - `changes` = stockSum jetzt minus stockSum bei der Berechnung. Fehlt `stockSum` im alten Stand: `changes:null`, `stale:true`.
  - `stale = changes!==0`
  - `changes` zählt Trigger-Erhöhungen, also geänderte Datensätze, nicht Berichte. Schon ein erneuter Abruf, der nur Metadaten anpasst (`sync.ts:136`), erhöht den Wert.

**`components/admin-stand.tsx` (NEU): einheitliche Stand-Zeile**

```tsx
'use client';
import type {ReactNode} from 'react';
import type {Stand} from '@/shared/admin-types';
const n=(x:number)=>x.toLocaleString('de-DE');
/** „08.10.26, 14:05“ (Europe/Berlin) */
export const standText=(iso?:string|null)=>iso?new Date(iso).toLocaleString('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'–';
const STALE_TITLE='Seit der Berechnung wurden Berichte gespeichert oder geändert. Die Zahlen stimmen für den genannten Stand; „Neu berechnen“ holt den Rest nach.';
const since=(s:Stand)=>s.pending>0?` · Kennzahlen für ${n(s.pending)} Gebiete werden nachgerechnet`
 :s.changes===null?' · Bestand seither geändert'
 :s.changes>10000?' · viele Änderungen seither'
 :s.changes>0?` · ≈ ${n(s.changes)} geänderte Datensätze seither`:' · Bestand unverändert';
/** stand undefined = lädt. action: „Neu berechnen“ (Server rechnet), „Aktualisieren“ (liest nur), „Neu zählen“ (Stichwörter). */
export function StandLine({stand,busy,action='Neu berechnen',onAction,extra,hint}:{stand:Stand|null|undefined;busy?:boolean;action?:string;onAction?:()=>void;extra?:ReactNode;hint?:string}){
 const b=stand?.build,pct=b?Math.round(100*b.done/Math.max(1,b.total)):0;
 const text=stand===undefined?'Stand wird geladen …'
  :!stand||stand.missing?'Vorberechnung noch nicht eingerichtet (Migration 0016 fehlt)'
  :stand.unbuilt>0?`Vorberechnung läuft: ${n(stand.total-stand.unbuilt)} von ${n(stand.total)} Gebieten`
  :b?.state==='running'?`Wird neu berechnet: ${pct} % (${n(b.done)} von ${n(b.total)} Gebieten)`
  :stand.computedAt===null?'Noch kein Stand gespeichert'
  :'Stand '+standText(stand.computedAt)+since(stand)+(b?.state==='paused'?` · angehalten bei ${pct} %`:'');
 return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-slate-500">
  <span role="status" title={stand&&stand.stale?STALE_TITLE:undefined}>{text}{extra}</span>
  {onAction&&<button type="button" className="btn-secondary btn-sm" title={hint} disabled={busy||stand===undefined} onClick={onAction}>{busy?'Wird berechnet …':action+' →'}</button>}
 </div>;
}
```

**Erstes Füllen (`unbuilt>0`):** Solange `stand.unbuilt>0`, zeigen Übersicht (`coverage`), Zeitverlauf und Hochrechnung keine Zahlen, die aus `region_series` stammen. Stattdessen erscheinen die Stand-Zeile („Vorberechnung läuft …“) und `Skeleton`. Der Server liefert wie sonst; die Oberfläche blendet aus. So erscheinen keine Teilsummen als echte Zahlen.

**`components/admin-store.ts` (NEU, reines Modul ohne React-Kontext und ohne JSX)**

```ts
export function fetchAdmin(url:string,opts?:{force?:boolean}):Promise<void>;
export function useAdmin<T>(url:string|null,opts?:{maxAgeMs?:number;when?:'mount'|'visible'}):
  {data:T|undefined;error:string;loading:boolean;refreshing:boolean;reload:()=>Promise<void>;ref?:(el:Element|null)=>void};
export function invalidateAdmin(prefix:string):void;
export function useAdminStatic(version:string):{areas:StaticArea[];index:Map<string,number>;nameOf(id:string):string}|undefined;
export function useAdminSources(version:string):AdminSource[]|undefined;   // Adapter static+areas → heutiges AdminSource[]
export function loadGeo():Promise<{germany:unknown;areas:unknown}>;        // einmal je Tab
export function useRegionCatchUp():{pending:number;unbuilt:number;running:boolean;missing:boolean};
```

1. **Fetch:**
   - `?v=`-URLs mit `cache:'default'`, sonst `cache:'no-cache'`. Der Browser schickt dann selbst `If-None-Match` und gibt bei 304 den gespeicherten Körper zurück, auch nach F5.
   - Gleiches ETag wie das gemerkte: Objekt bleibt dasselbe, kein Neuzeichnen.
2. **Je URL höchstens eine Anfrage.** Kein Abbruch beim Unmount.
3. **Stale-while-revalidate:**
   - Vorhandene Daten sofort liefern.
   - Nachfragen beim Mount (älter als `maxAgeMs`), bei `visibilitychange` (älter als 60 s), bei `reload()` und bei `invalidateAdmin()`.
   - Ein Fehler lässt die Daten stehen und setzt `error`.
4. **`when:'visible'`** startet erst per `IntersectionObserver` (Zeitverlauf).
5. **`useRegionCatchUp`:**
   - Liest `GET /api/admin/refresh`.
   - Ist `regions.pending+regions.unbuilt>0`, der Tab sichtbar, `jobRunning` falsch und `importBusyUntil` vorbei: `POST /api/admin/refresh {action:'step',target:'regions'}` wiederholen, bis `state==='done'`.
   - Bei `busy` 3 s warten, bei `conflict` sofort erneut. Danach `invalidateAdmin('/api/admin/')`.

**`components/admin-catch-up.tsx` (NEU, `'use client'`)**: `export function RegionCatchUp()` treibt `useRegionCatchUp`. Bei `pending+unbuilt>0` zeigt es die Zeile „Kennzahlen für {n} Gebiete werden nachgerechnet …“ (14 px grau, `px-[max(1vw,16px)]`), sonst nichts.

**`shared/admin-areas.mjs` (NEU, rein, testbar mit `node --test`)**
- `toSources(staticData,areasData,now)` baut das heutige `AdminSource[]` (`shared/admin-types.ts:8`):
  - Felder aus `static`, Werte aus `areas`
  - `sourceHealth()` aus `shared/admin.mjs`
  - `issues:[]`, `warnings:[]`, `issueCount`, `warningCount`
  - ein vorab kleingeschriebener Suchtext `search`
- Gemerkt in einer `WeakMap` je Datenobjekt.

### 3.6 Ablauf

**Lesen (jeder Seitenaufruf):** Browser-Speicher → `fetch` mit `no-cache` → Server `adminRead`: `tag()` (≤ 5 kleine Abfragen) → bei Treffer 304, sonst `build()` aus `region_series`/`region_stats`/`system_state` → Browser zeigt die Daten und `StandLine`.

**Neu berechnen (wer wann, ohne Cron)**

| Auslöser | Was | Wo |
|---|---|---|
| Letzter Schritt eines Metadaten-Imports (`!data.resume`) | Klasse B für dieses Gebiet, ohne Sperre, Budget 4 s | `sync.ts`, in den Block von Zeile 44 (P13) |
| Adminseite offen, `pending+unbuilt>0` | Nachholschritte `regions` bis 0. Bedingungen: Tab sichtbar, kein Auftrag, keine Import-Sperre | `RegionCatchUp` im Rahmen |
| Ende eines Abrufauftrags | Nachhol-Schleife, dann `invalidateAdmin` | `admin-processing.tsx` nach `drain` |
| Knopf „Neu zählen“, „Alle prüfen“, „Neu berechnen“ | Bauauftrag bzw. Hochrechnung. Die Seite treibt die Schritte an und zeigt Fortschritt; der alte Stand bleibt sichtbar | Stichwörter, Qualität, Hochrechnung |
| Externer Runner | nach Importen `regions` bis 0; optional nachts `keywords` | `scripts/run-imports.mjs` → `/api/internal/admin-refresh` |
| Lokal | `node scripts/refresh-admin.mjs [--regions] [--build keywords|quality:all|audit] [--full]` | Adapter `node:sqlite` wie `scripts/refresh-search-words.mjs` |

**Was macht was ungültig?**

| Ereignis | ändert | Folge |
|---|---|---|
| Metadaten-Import (`sync.ts`) | `region_revisions` → stockSum; der Haken rechnet das Gebiet → seriesStamp/statsStamp | neue ETags für areas, coverage, timeline, atlas; Stichwörter, Hochrechnung und Qualität zeigen „≈ N geänderte Datensätze seither“ |
| `source_coverage`-Upsert (`sync.ts:56,149`) | content | neue ETags nur für areas, area, atlas |
| Textverarbeitung, Regelanalyse (`manual-analysis.mjs`), KI (`ai-jobs.mjs`), vorbereitete Analysen, Backfill, Wiederherstellung | stockSum (viele Gebiete) | `pending>0` → Nachholschritte; gespeicherte Stände gelten als veraltet |
| `article_versions`/`article_analyses` | content | `summary` (immer frisch); orphan-Prüfungen veraltet |
| Deploy (Katalog, Quellenkataloge, `source-atlas.json`, `source-robots.json`, `coverage-history.json`, Stichproben-JSONs) | staticVer | neue Static-URL, alle abhängigen ETags neu |
| Formeländerung | `FIGURES_VERSION` / `SERIES_VERSION` (im ETag) / ETag-Präfix | alle Gebiete stehen aus, neue ETags |
| `refresh-admin.mjs --full` | `computed_at` (im Stempel) | neue ETags nach dem Neuaufbau |
| Uhrzeit | `today`/Stunde im ETag | `today`, `updated7d`, „älter als 7 Tage“ |

### 3.7 Verhalten in Sonderfällen

| Fall | Verhalten |
|---|---|
| Migration 0016 fehlt | GETs liefern `stand.missing='0016'` und leere Ableitungen, keinen Scan und keine Ausnahme. `StandLine` zeigt „Vorberechnung noch nicht eingerichtet (Migration 0016 fehlt)“. |
| Erstes Mal (Tabelle leer oder teilweise gefüllt) | `unbuilt>0`. Zeitverlauf, Abdeckung und Hochrechnung zeigen nur „Vorberechnung läuft: {done} von {total} Gebieten“ und graue Flächen, keine Teilsummen. Die Nachhol-Schleife baut auf (15–30 Schritte). `POST /api/admin/estimate` antwortet 409 „Erst nach der Vorberechnung möglich“. Stichwörter ohne Stand: „Noch kein Stand gespeichert“ mit Knopf (Entscheidung E2: automatischer Start ja/nein). |
| Veraltet | Daten anzeigen, `StandLine` mit „≈ N geänderte Datensätze seither“ bzw. „Kennzahlen für N Gebiete werden nachgerechnet“. |
| Prüfliste bei mehr als 500 veralteten Gebieten | Liste aus den letzten 5.000 geänderten Berichten, Trefferzahl „wird nachgerechnet“ (`total:null`). |
| Fehler beim Lesen ohne Daten | `<Alert onRetry>`: „Die Zahlen konnten nicht geladen werden. Es werden keine geschätzten Werte angezeigt.“ |
| Fehler beim Neu berechnen | alte Daten bleiben; „Neu berechnen ist fehlgeschlagen: {Fehler}. Angezeigt bleibt der Stand vom {stand}.“ |
| Zwei Tabs, Skript oder Runner rechnen gleichzeitig | eine Sperre; der Verlierer bekommt `{state:'busy',until}`. Der Zustand ist fortsetzbar. |
| Sperre läuft während eines langen Schritts ab | Gebietswerte: Revisionsschutz. Bauaufträge: Vergleichen-und-Tauschen auf `next`; der Verlierer bekommt `conflict`, nichts wird doppelt gezählt. |
| Import-Haken und Nachholschritt am selben Gebiet | `WHERE excluded.revision>=…revision`: schlimmstenfalls doppelte Arbeit, nie ein Rückschritt. |
| Bestand ändert sich während eines Baus | `stockSum` wird beim Start gespeichert; der fertige Stand zeigt sofort „≈ N geänderte Datensätze seither“. |
| Leser während eines Baus | lesen den alten Stand; `writeStored` ersetzt ihn in einem Batch. |
| Browser bricht ab | GETs sind billig. Schritte haben ein Budget; die Sperre wird im `finally` freigegeben oder läuft nach höchstens Budget + 20 s ab. |
| Langer Bauschritt neben einem Import | Jede Abfrage dauert höchstens ~3 s; der Import wartet höchstens so lange (heute 55–92 s). |

### 3.8 Grenzen von Workers und D1 (einzuhalten)

- **Aus Code und Projekt-Dokumenten belegt:**
  - Höchstens 100 gebundene Parameter je Abfrage (`admin-data.mjs:80`, Test `tests/admin.test.mjs:122`).
  - Höchstens ~100 KB je gebundenem Wert (`search-words.mjs:60`).
  - Höchstens 2 MB je Zeile (`admin-estimate-store.mjs:4`).
  - Worker-Speicher 128 MB.
- **Vermutet, in P41 prüfen:**
  - 30 s je Abfrage
  - 1.000 D1-Abfragen je Aufruf (bezahlt) bzw. 50 (frei)
  - Obergrenze an Anweisungen je Batch
  - CPU 30 s Standard
  - Der Tarif von OpenAI Sites ist unbekannt.
- **Daraus:**
  - Jede Abfrage höchstens ~25.000 Berichte.
  - Jeder Schritt 5–8 s mit höchstens ~20 Abfragen; Schreiben als Massen-Upsert (≤ 10 Schreibanweisungen je Schritt, ≤ 50 Anweisungen je Batch).
  - Gebundene Werte ≤ 90 KB; gespeicherte Werte in Abschnitten von 90.000 Zeichen.
  - Keine zusätzliche Zeile je Bericht, solange die Datenbank über 10 GB liegt.

### 3.9 Erwartete Zeiten (nach Umsetzung, in P41 messen)

| Seite / Schnittstelle | heute lokal | neu lokal kalt | Prod kalt | Prod warm (304/Speicher) |
|---|---|---|---|---|
| Übersicht `coverage` | > 180 s / 75 s | < 1 s | 0,3–0,8 s | 0,1–0,2 s |
| Abruf | 38 s / 2,5 s, 6,4 MB | < 1,5 s, ~350 KB gzip inkl. static | 0,6–1,2 s | 0,1–0,3 s, Seitenwechsel ≈ 0 |
| Abruf `timeline` | 55–92 s | < 1 s | 0,4–1,0 s | 0,1–0,2 s |
| Atlas | 92 s / 0,67 s | < 1 s | 0,3–0,6 s | ≈ 0–0,2 s |
| Qualität | 1,6 s warm, 6,4 MB | < 1 s | 0,4–0,9 s | ≈ 0–0,2 s |
| Hochrechnung GET / POST | 0,07 s / 2–3 min | < 0,3 s / 2–10 s | 0,1–0,3 s / 2–10 s | 0,05 s |
| Stichwörter GET / „Neu zählen“ | 116 s / – | < 0,3 s / 2–3 min in Schritten | 0,1–0,3 s | 0,05–0,15 s |
| Qualitätsprüfungen | 0,2–87 s je Prüfung | Schritte ≤ 8 s, alle zusammen 3–5 min | – | – |
| Pipeline-POST (Nebenwirkung) | `run` bis ~90 s gewollt; 163 × ≥ 100 s | `run` ≤ ~100 s, Status < 2 s, Haken + 0,05–2 s | – | – |

---

## 4. Umsetzungsplan

Jedes Paket ist einzeln committbar. Die Reihenfolge ist: Performance (Phasen 1, 2, 4, 6), Abrufbarkeit und Stand-Anzeige (Phasen 3, 5), dann Design (Phase 7), dann Texte (Phase 8).

Abkürzungen für Prüfbefehle (genaue Form in Abschnitt 8.3):
- **TC** = Typcheck
- **UT** = alle Tests
- **MS** = Messung mit curl
- **IX** = `node scripts/frontend-index.mjs`, nötig bei neuen oder entfernten Dateien und Klassen

„[Server]“ heißt: Das Paket ändert `server/`, `shared/`, `app/api/`, `drizzle/` oder `tests/`. Vorher prüfen, ob ein Import läuft (Abschnitt 8.1).

**Deploy in Produktion:** P09 bis P15b nur gemeinsam deployen. Vorher Migration 0016 einspielen und nach dem Deploy den Erstaufbau abwarten, über den Runner oder eine offene Adminseite. Ein Deploy zwischen P14 und P15b ließe Zeitverlauf, Abdeckung und Hochrechnung leer.

**Empfohlenes Modell je Paket:** Jedes Paket in einer eigenen Sitzung umsetzen.

| Pakete | Modell | Grund |
|---|---|---|
| P10, P11, P13, P15a, P20, P21b, P21c | Opus 5.5 | SQL fast wörtlich, Sperren, Revisionsschutz, Import-Haken. Fehler hier verfälschen Zahlen unbemerkt. |
| P01–P09, P12, P14, P15b–P19, P21a, P22–P36, P39, P41 | Sonnet 5.5 | Klar umrissen, durch Tests und Messung abgesichert |
| P37, P38, P40 | Haiku 5.5 | Texte stehen wörtlich in Abschnitt 6, nur einsetzen |

Nach Phase 2 und nach Phase 4 je eine Prüfung mit Opus 5.5 (`/code-review high`).

### Phase 1: Sofortmaßnahmen

#### P01 · Cache-Verdrängung beheben [Server]
- **Ziel:** Übersicht beim zweiten Aufruf warm; Zeitverlauf und Übersicht verdrängen sich nicht mehr.
- **Dateien:** `server/integrations/revision-cache.mjs` (Zeile 21); NEU `tests/revision-cache.test.mjs`.
- **Schritte:**
  1. Zeile 21 ersetzen durch:
     ```js
     const kindOf=k=>k.startsWith('timeline|')?k:k.split('|')[0],kind=kindOf(key);for(const other of entries.keys())if(kindOf(other)===kind)entries.delete(other);
     ```
  2. Den Kommentar in Zeile 20 anpassen: „timeline keys are kept per basis“.
- **Nicht ändern:** die übrige Logik von `atRevision`; die Aufrufer.
- **Tests:** `tests/revision-cache.test.mjs`: Fake-`db` mit `prepare().first()` → `{revision:1}`, Zähler je `compute`.
  - `timeline|import` und `timeline|event` nacheinander, dann beide erneut: Jede `compute` lief genau einmal.
  - `estimate|a|b` nach `estimate|c|d`: Der alte Eintrag ist ersetzt.
- **Prüfen:** UT; MS `coverage` zweimal hintereinander (nur ohne laufenden Import).
- **Abnahme:** zweiter Aufruf von `GET /api/admin/coverage` unter 2 s (vorher 75 s).

#### P02 · Zeitverlauf von der Revision entkoppeln
- **Ziel:** Kein Timeline-Vollscan mehr während eines Auftrags; Laden erst bei Sichtbarkeit.
- **Dateien:** `components/admin-timeline.tsx` (Zeilen 30–38), `components/admin-processing.tsx` (~49, ~63, ~80, 164).
- **Schritte:**
  1. In `AdminTimeline` die Prop `revision:number` durch `version:number` ersetzen. Schlüssel `key=basis+':'+version`; der `initial`-Schlüssel ebenso.
  2. In `AdminProcessing`: `const [timelineVersion,setTimelineVersion]=useState(0)`. Erhöhen **nur** in `refresh()` (Auftragsende, Aktionen), nicht in `reload()` (Zeile 63). In Zeile 164 `<AdminTimeline selected={selected} version={timelineVersion}/>`.
  3. Laden erst bei Sichtbarkeit:
     ```tsx
     const box=useRef<HTMLElement>(null),[seen,setSeen]=useState(false);
     useEffect(()=>{const el=box.current;if(!el||seen)return;const io=new IntersectionObserver(e=>{if(e.some(x=>x.isIntersecting)){setSeen(true);io.disconnect();}},{rootMargin:'200px'});io.observe(el);return()=>io.disconnect();},[seen]);
     ```
     Der `fetch`-Effekt läuft nur bei `seen`. `ref={box}` an das äußere `<section>`.
- **Nicht ändern:** `cache:'no-store'` (kommt in P17); die Server-Route.
- **Tests:** keine Unit-Tests (Browser). Sichtprüfung.
- **Prüfen:** TC; Abruf-Seite öffnen und im Browser-Netzwerk prüfen; einen kleinen Abrufauftrag (ein Gebiet) laufen lassen und `tmp/dev-server.log` lesen.
- **Abnahme:**
  - Abruf-Seite ohne Scrollen: kein `GET /api/admin/timeline`.
  - Während eines Auftrags: keine Zeile `GET /api/admin/timeline` im Log.

#### P03 · `statsPending`-Schleife ohne 6,4 MB [Server]
- **Ziel:** Solange Kennzahlen nachgerechnet werden, nur kleine Antworten.
- **Dateien:** `app/api/admin/overview/route.ts`, `server/repositories/admin.ts`, `components/admin-loader.tsx` (Zeilen 12–20), `tests/admin.test.mjs` (Stub Zeile 184).
- **Schritte:**
  1. `server/repositories/admin.ts`: NEU `export async function getAdminPending(){if(!env.DB)throw Error('Datenbank fehlt');const r=await regionFigures(env.DB,{budgetMs:8000});return {statsPending:r?.pending??0};}`. `regionFigures` aus `../integrations/admin-data.mjs` importieren.
  2. Route: Der Test ruft `routes.overview.GET()` ohne `request` auf (`tests/admin.test.mjs:205`). Deshalb:
     ```ts
     const p=request?new URL(request.url).searchParams:null;
     if(p?.get('pending')==='1')return Response.json(await getAdminPending(),{headers:ADMIN_HEADERS});
     ```
  3. Stub in `tests/admin.test.mjs:184` um `export async function getAdminPending(){return {statsPending:0};}` ergänzen. Sonst schlägt der Import der Route beim Laden fehl, und die ganze Testdatei wird rot.
  4. Loader:
     - Erst `?pending=1` abfragen, bis `statsPending===0` (je 300 ms, Anzeige „Kennzahlen werden berechnet: noch N Gebiete …“).
     - Dann einmal die volle URL.
     - Hat die volle Antwort trotzdem `statsPending`, die Daten **anzeigen** und nicht verwerfen.
- **Nicht ändern:** `loadAdminData`; die Antwortform ohne `pending`.
- **Tests:** UT (Stub).
- **Prüfen:** TC; UT; Netzwerk-Tab auf der Abruf-Seite nach einem Import.
- **Abnahme:** keine wiederholten Antworten über 1 KB während `statsPending>0`; UT grün.

#### P04 · Cache-Regel für Kartenformen
- **Dateien:** `public/_headers`.
- **Schritte:** Block anfügen:
  ```
  # Kartenformen der Administration (germany.json 1,1 MB, de-areas.json 2,4 MB): wie /data.
  /geo/*
    Cache-Control: public, max-age=86400, stale-while-revalidate=604800
  ```
- **Nicht ändern:** die übrigen Regeln.
- **Prüfen:** Der Vite-Dev-Server liest `_headers` nicht. Prüfung in Produktion (P41): `curl -sI https://<host>/geo/germany.json`.
- **Abnahme:** Antwortkopf `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`.

#### P05 · Atlas: Nachladen nur sichtbar, ohne Überlappung
- **Dateien:** `components/admin-atlas.tsx` (Zeilen 40–45, 95–96).
- **Schritte:**
  1. Das 5-Minuten-Intervall ruft nur, wenn `document.visibilityState==='visible'` und kein Lauf aktiv ist (`useRef<boolean>` als Sperre).
  2. Beim Zurückkehren in den Tab (`visibilitychange`) einmal nachladen, wenn der letzte Stand älter als 5 min ist.
  3. Ladetext ohne `n(5324)`: „Alle Gebiete werden mit Anbindung, Grund und Berichtsstand geladen …“.
  4. Solange `data` fehlt, einen Platzhalter in Kartenhöhe (`<div className="h-[520px] animate-pulse rounded-lg bg-slate-100"/>`) statt nichts.
- **Nicht ändern:** Datenlogik, Server.
- **Prüfen:** TC; Tab 6 min im Hintergrund lassen: keine Anfrage.
- **Abnahme:** im Hintergrund-Tab keine `GET /api/admin/atlas`; nie zwei gleichzeitig.

#### P06 · Übersicht: „Aktualisieren“ leert die Seite nicht
- **Dateien:** `components/admin-overview.tsx` (~64-66, ~84).
- **Schritte:**
  1. `const [refreshing,setRefreshing]=useState(false)`.
  2. Im Klick (~84) `setData(null)` ersetzen durch `setRefreshing(true);setAttempt(a=>a+1)`.
  3. Im Lade-Effekt (`:64-66`) an die Kette anhängen: `.finally(()=>{if(!c.signal.aborted)setRefreshing(false);})`.
  4. Den Inhalt währenddessen mit `className={refreshing?'opacity-60 transition-opacity':''}` dimmen. Ein Fehler lässt die Daten stehen.
- **Abnahme:** Nach Klick auf „Aktualisieren“ bleibt der Inhalt sichtbar.

#### P07 · Qualität: Gebietsnamen ohne Katalog im Bündel
- **Dateien:** `components/admin-dashboard.tsx` (Zeile 11 und Verwendungen von `regionName`).
- **Schritte:**
  1. Import `regionName` aus `@/shared/regions` entfernen.
  2. Stattdessen `const names=useMemo(()=>new Map(data.sources.map(s=>[s.id,s.name])),[data.sources]);const regionName=(id:string)=>names.get(id)||id;`.
  3. Mit `grep -n "shared/regions" components/admin-*.tsx` prüfen, ob noch ein Admin-Client-Modul den Katalog importiert. Ausgenommen sind Server-Komponenten wie `app/admin/page.tsx`.
- **Abnahme:** Das Bündel der Qualitätsseite enthält den Katalog nicht mehr (~540 KB weniger, sichtbar im Build-Ausgabe-Chunk `regions`).

#### P08 · CSV-Export ohne Prüfliste [Server]
- **Dateien:** `app/api/admin/export/route.ts`.
- **Schritte:** `getAdminDashboard()` → `getAdminDashboard({review:false})`.
- **Abnahme:** UT grün; Export identisch (die Prüfliste wird nicht exportiert), eine Abfrage weniger.

Hinweis: Atlas und Abdeckung rechnen bis P15a weiter mit Budget 4000. Sonst sähe, wer nur Übersicht oder Atlas öffnet, dauerhaft veraltete Zahlen.

### Phase 2: Werte je Gebiet vorberechnen (Klasse B)

#### P09 · Migration 0016 [Server]
- **Dateien:** NEU `drizzle/0016_admin_precompute.sql` (SQL in 3.3).
- **Schritte:**
  1. Datei anlegen. Zeilenenden wie die übrigen Migrationen (LF).
  2. **Nur ohne laufenden Import** lokal einspielen: `pnpm exec wrangler d1 migrations apply DB --local --config .\wrangler.local.json --persist-to .\.wrangler\state`.
  3. Prüfen: `SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1` (read-only, `node:sqlite`).
- **Nicht ändern:** `db/schema.ts`, `drizzle/meta/*`.
- **Tests:** UT. Alle Tests spielen die Migrationen ein, ein Syntaxfehler fällt sofort auf.
- **Abnahme:**
  - UT grün.
  - Tabellen `region_series` und `admin_agg` sowie zwei Indizes auf `import_runs` lokal vorhanden.
  - `EXPLAIN QUERY PLAN` der Abfrage von `GET /api/admin/run-debug?region=…` zeigt `idx_import_runs_region`.
  - `ORDER BY started_at DESC LIMIT 30` zeigt `idx_import_runs_started` ohne TEMP B-TREE.

#### P10 · Leser und Rechner je Gebiet [Server]
- **Ziel:** `region_series` und `region_stats` nachführen können; noch keine Verwendung.
- **Dateien:**
  - NEU `server/integrations/region-series.mjs`, NEU `server/integrations/region-facts.mjs` (Spezifikation 3.4)
  - `server/integrations/admin-data.mjs` (`export const FIGURES`; `FIGURES_VERSION` aus `region-series.mjs` importieren und Zeile 70 entfernen)
  - NEU `tests/region-facts.test.mjs`
- **Schritte:** wie 3.4. `canonical` in `region-facts.mjs` lokal definieren (gleicher String wie `admin-data.mjs:14`). Schreiben als Massen-Upsert (3.4 Schritt 6), Größen aus der Index-Zählung (3.4 Schritt 1).
- **Nicht ändern:** `regionFigures` (bis P15a), `admin-timeline.mjs`.
- **Tests** in `tests/region-facts.test.mjs`. Vorlagen: `tests/search-cards-gone.test.mjs` für „Nachführen = voller Aufbau“, `tests/admin.test.mjs` für zählende und strenge Adapter, `sqliteAdapter` aus `scripts/ai-job.mjs:13-26`.
  1. **Nachführen = voller Aufbau.** Zufällige Änderungen (neu, geändert, zusammengeführt, gelöscht, `region_id` verschoben), je Runde inkrementell `refreshRegionFacts`. `region_stats` und `region_series` sind zeilengleich mit einem frischen Aufbau (Tabellen leeren, alles neu). `computed_at` wird dabei nicht verglichen.
  2. **Budget.** Mit `budgetMs:0` und `chunkRows:1`: `pending+unbuilt>0`; der nächste Aufruf macht weiter.
  3. **Schreibschutz.** Eine Zeile mit höherer Revision wird von einem älteren Stand nicht überschrieben.
  4. **Grenzen.** Jede Anweisung hat höchstens 100 gebundene Parameter; jeder gebundene Wert ist kleiner als 100 KB; höchstens 10 Schreibanweisungen je Aufruf (zählender Adapter).
     - Den Test „figures per area bind at most 100 parameters“ (`tests/admin.test.mjs:122`) hierher **kopieren** und auf `refreshRegionFacts` umstellen.
     - Das Original bleibt bis P15a, weil `regionFigures` bis dahin weiter rechnet.
  5. **EXPLAIN** der series-Abfrage:
     - Der Plan enthält `MATERIALIZE` und `SEARCH topics USING INDEX idx_topics_canonical_region_updated`.
     - Er enthält **genau drei** `CORRELATED SCALAR SUBQUERY`, alle vor `SCAN t`.
     - Läuft die Abfrage ohne `MATERIALIZED`, prüft der Test stattdessen die `LIMIT -1`-Fassung auf dieselben Merkmale.
  6. **Fehlende Tabelle.** Ohne 0016 liefert `readSeries` `null` und `pendingRegions` `{missing:'0016'}`.
  7. **Unbuilt gegen pending.** Gebiet ohne Zeile zählt bei `unbuilt`, Gebiet mit alter Revision bei `pending`.
- **Prüfen:** UT, TC.
- **Abnahme:** alle Tests grün.

#### P11 · Sperre und Schritt-Endpunkt [Server]
- **Dateien:**
  - NEU `server/integrations/admin-refresh.mjs` (3.4, zunächst nur `target:'regions'`)
  - NEU `app/api/admin/refresh/route.ts`, NEU `app/api/internal/admin-refresh/route.ts`
  - `server/repositories/admin.ts` (Wrapper `getRefreshStatus`, `runRefreshStep`)
  - NEU `tests/admin-refresh.test.mjs`
- **Schritte:**
  - GET: `requireAdmin`, Antwort mit `ADMIN_HEADERS`.
  - POST: `requireSameOrigin(request)`, `requireAdmin()`, Body `{action,target,restart}` prüfen (unbekanntes Ziel → `AdminError(400)`).
  - Antwortform: `{target,state,done,total,pending,ms,until?}` (3.4).
  - Interner Zugang: **nur** die Bearer-Prüfung wörtlich wie `app/api/internal/sync/route.ts:5-6`; kein `requireSameOrigin`, kein `requireAdmin`.
- **Nicht ändern:** `pipeline-jobs.mjs`, `import-lock.mjs`.
- **Tests:**
  - Zwei gleichzeitige `refreshStep` → genau einer bekommt `busy`.
  - Eine abgelaufene Sperre wird übernommen.
  - Die Sperre ist nach Ausnahme in `fn` frei.
- **Abnahme:**
  - `curl -X POST` ohne gleichen Ursprung → 403.
  - Im Browser bzw. mit Header `Origin: http://localhost:5173`: `{state,done,pending}`; jeder Schritt höchstens 6 s (Feld `ms`).

#### P12 · Lokales Skript und Erstaufbau [Server]
- **Dateien:** NEU `scripts/refresh-admin.mjs`, `scripts/run-framework.mjs` (Start im Hintergrund wie die Suchwortliste, Zeilen 17–24).
- **Schritte:**
  1. Adapter `sqliteAdapter` aus `scripts/ai-job.mjs` (Zeilen 13–26) auf die lokale D1-Datei. Pfad und Öffnen wie `scripts/refresh-search-words.mjs`, **einschließlich `PRAGMA busy_timeout=60000`** (`:12`). Ohne den Wartewert drohen `SQLITE_BUSY`-Abbrüche, weil der Dev-Server dieselbe Datei offen hält.
  2. Optionen:
     - `--regions`: `refreshStep` bis `state==='done'`, je Schritt eine Zeile Ausgabe.
     - `--build <target>`: ab P20/P21a.
     - `--full`: `UPDATE region_series SET v=0` und `UPDATE region_stats SET stats=json_set(stats,'$.v',0)`, dann `--regions`.
  3. Fortsetzbar: Jeder Schritt ist für sich gültig.
  4. In `run-framework.mjs` nach dem Start der Suchwortliste: `refresh-admin.mjs --regions` im Hintergrund, abschaltbar mit `RM_SKIP_ADMIN_REFRESH=1`.
- **Nicht ändern:** `refresh-search-words.mjs`.
- **Prüfen:** Erstaufbau lokal **ohne laufenden Import** in einer PowerShell-Neustartschleife (Memory: lange Node-Läufe sterben still), z. B.:
  ```powershell
  do { node scripts/refresh-admin.mjs --regions } while ($LASTEXITCODE -ne 0)
  ```
- **Abnahme:** `pendingRegions` = `{pending:0,unbuilt:0}`; `SELECT count(*) FROM region_series` = Zeilen in `region_revisions` (3.516); Dauer etwa 2–3 min.

#### P13 · Import-Haken [Server]
- **Dateien:** `server/services/sync.ts` (Zeile 44).
- **Schritte:**
  - `import {refreshRegionFacts} from '../integrations/region-facts.mjs';`.
  - In Zeile 44 steht `if (mode === 'metadata') { try { await refreshSearchWords(…); } catch { … } }`. **Innerhalb** dieses Blocks, hinter dem `try/catch` von `refreshSearchWords`, einfügen:
    ```ts
    if (!(data as { resume?: boolean }).resume) {
      try { await refreshRegionFacts(env.DB, { regions: [region], budgetMs: 4000 }); } catch { /* nicht wichtig für den Import; der nächste Nachholschritt holt nach */ }
    }
    ```
    `data` ist das Ergebnis aus Zeile 42 (`refreshMetadata` gibt in Zeile 167 `resume` zurück). Der Haken läuft noch unter der Import-Sperre.
- **Nicht ändern:** `refreshMetadata`, Textverarbeitung, Regelanalyse, KI-Pfade (die rechnen nicht sofort).
- **Tests:** in `tests/region-facts.test.mjs` die Funktion mit `regions:[x]` prüfen (zählender Adapter):
  - Nur `x` wird gelesen: `region_id IN (SELECT value FROM json_each(?))` mit `["x"]`.
  - Keine Abfrage liest `region_stats` oder `region_revisions` ohne diesen Filter.
- **Abnahme:** Nach einem lokalen Import eines Gebiets passt dessen `region_series.revision` zu `region_revisions.revision`; der Pipeline-Schritt dauert höchstens 4 s länger.

#### P14 · Ableitungen aus `region_series` [Server]
- **Ziel:** Zeitverlauf, Abdeckung und Hochrechnungs-Details ohne Vollscan, Ergebnis wie heute.
- **Dateien:**
  - `server/integrations/admin-timeline.mjs`, `server/integrations/admin-estimate.mjs`
  - `tests/timeline.test.mjs`, `tests/admin-coverage.test.mjs`, `tests/estimate.test.mjs`
  - NEU `tests/admin-series.test.mjs`
- **Schritte:** wie 3.4:
  - `adminTimeline` aus `readSeries`
  - `timelineRowsSql`, `detailsFromSeries`, `DETAILS_SQL` exportieren
  - `atRevision` in beiden Dateien entfernen
  - 409 in `computeEstimate` bei `unbuilt>0`

  `admin-coverage.mjs` bleibt unverändert und profitiert automatisch.
- **Nicht ändern:** Antwortformen; `shared/coverage.mjs`; `shared/timeline.mjs`.
- **Tests:**
  - Bestehende Tests, die `adminTimeline`, `adminCoverage`, `adminAtlas` oder `adminEstimate` über eine Datenbank aufrufen, rufen nach dem Einfügen `await refreshRegionFacts(db,{budgetMs:1e9})` auf.
  - Als Adapter `sqliteAdapter` aus `scripts/ai-job.mjs` verwenden. Er hat `batch` mit Transaktion und wird schon in `tests/timeline.test.mjs:7` und `tests/estimate.test.mjs:10` genutzt. `tests/admin-coverage.test.mjs` darauf umstellen, falls er einen eigenen Adapter ohne `batch` hat.
  - NEU `tests/admin-series.test.mjs` mit festem `now` und einer Fixture inklusive fehlerhafter (`'2026-1-5'`, `'unbekannt'`) und fehlender Tage:
    - `adminTimeline` aus `region_series` = Ergebnis aus `timelineRowsSql`, beide Bezüge, `deepEqual` inklusive Reihenfolge von `days`.
    - `adminCoverage` neu = alt.
    - `detailsFromSeries` = `DETAILS_SQL` für zwei Zeitfenster.
    - `adminEstimate` mit festen Replikaten gleich.
- **Prüfen:** UT; MS `timeline?basis=event`, `timeline?basis=import`, `coverage`.
- **Abnahme:**
  - Lokal kalt (nach Neustart des Dev-Servers): `coverage` unter 1 s (vorher > 180 s), `timeline` unter 1 s (vorher 55–92 s).
  - Antworten inhaltlich gleich der alten (Test).

#### P15a · Alle GETs nur lesend (Server) [Server]
- **Ziel:** R1 überall; kein GET rechnet oder schreibt.
- **Dateien:**
  - `server/integrations/admin-data.mjs` (`regionFigures` als Leser, Status-Zählung aus `region_series`, `reviewScope`/`adminReview` laut 3.4)
  - `server/integrations/area-figures.mjs` (Parameter `budgetMs` entfernen)
  - `server/integrations/admin-atlas.mjs:41`, `server/integrations/admin-coverage.mjs:24` (Aufruf ohne `budgetMs`)
  - `server/repositories/admin.ts` (`getAdminPending` entfernen), `app/api/admin/overview/route.ts` (`?pending=1` entfernen)
  - `tests/admin.test.mjs`; NEU `tests/admin-readonly.test.mjs`
- **Schritte:**
  1. `regionFigures`: Schleife entfernen, `pending` zählen. `loadAdminData` ruft `regionFigures(db,{now})` auf; `statsBudgetMs` entfällt.
  2. `areaFigures(db,{now})` ohne Budget.
  3. `reviewScope`/`adminReview`: Grenze 500 über `json_each(?)`. Darüber gilt `total:null`, `pending:n`, kein Zählen, und die Liste läuft über die 5.000 zuletzt geänderten Berichte (3.4).
  4. Stub in `tests/admin.test.mjs:184`: `getAdminPending` wieder entfernen.
- **Nicht ändern:** den Rückfall bei fehlender 0011 (`regionFigures` gibt `null`; `atRevision` dort bleibt).
- **Tests:**
  - `tests/admin.test.mjs`, alle vier Tests, die über `loadAdminData` rechnen. Vor jedem `loadAdminData` steht dort `await refreshRegionFacts(db,{budgetMs:1e9,now:at})`.
    - `:76` („the overview reads the stored reports once …“): Zusicherungen `scans()==1` und „only the changed area is read“ (`region_id IN (?)`) auf `refreshRegionFacts` umstellen.
    - `:100` („figures per area are computed step by step …“): Der Budget-Teil prüft jetzt `refreshRegionFacts`, der Rückfall ohne Tabellen bleibt.
    - `:122` (strenger Adapter, 100 Parameter): entfernen; die Kopie aus P10 deckt es ab.
    - `:142` (Prüfliste): Zeile 150 füllt `region_stats` über `refreshRegionFacts` statt über `loadAdminData`. Neu: Bei mehr als 500 veralteten Gebieten ist `total===null`, und keine Abfrage zählt über alle Berichte.
  - NEU `tests/admin-readonly.test.mjs`: Ein zählender Adapter wirft bei `INSERT|UPDATE|DELETE|REPLACE`. Damit `loadAdminData`, `adminCoverage`, `adminAtlas`, `adminTimeline`, `adminReview` und `refreshStatus` aufrufen: keine Ausnahme.
    - Keine Abfrage `FROM topics` mit `payload`-Bedingung ohne Gebietsgrenze.
    - Erlaubt sind:
      - `count(*)` über Teilindizes
      - `INDEXED BY idx_topics_canonical_updated` mit `LIMIT 25` bzw. der Unterabfrage `LIMIT 5000`
      - `region_id IN (SELECT value FROM json_each(?))`
    - Die Vollständigkeitsprüfung (`audit`) ist ausgenommen.
- **Prüfen:** UT, TC; MS `overview?review=0`, `atlas`.
- **Abnahme:**
  - Kein Admin-GET schreibt (Test).
  - `overview?review=0` lokal kalt nach Neustart unter 3 s (vorher 38 s).

#### P15b · Nachholen im Browser
- **Ziel:** Veraltete Gebiete werden nachgerechnet, solange eine Adminseite offen ist.
- **Dateien:**
  - NEU `components/admin-store.ts`, zunächst nur `useRegionCatchUp` (3.5)
  - NEU `components/admin-catch-up.tsx` (`RegionCatchUp`)
  - `components/admin-chrome.tsx` (`import {RegionCatchUp} from '@/components/admin-catch-up';`, in `AdminHeader` einsetzen)
  - `components/admin-loader.tsx` (Schleife entfernen, Daten sofort zeigen; bei `statsPending>0` den Hinweis wie `admin-overview.tsx:106`)
- **Prüfen:** TC; IX (neue Dateien); einen kleinen Import laufen lassen, Adminseite offen, im Netzwerk-Tab `POST /api/admin/refresh` beobachten.
- **Abnahme:** Nach einem Import holt eine offene Adminseite die veralteten Gebiete in Schritten unter 6 s nach; danach `pending=0`.

### Phase 3: Abrufbarkeit (ETag/304 und Stand)

#### P16 · Kennungen und `adminRead` [Server]
- **Dateien:** NEU `server/integrations/admin-stand.mjs`, NEU `server/services/admin-etag.mjs`, NEU `server/services/admin-http.ts` (3.4), `shared/admin-types.ts` (Typ `Stand`), NEU `tests/admin-http.test.mjs`.
- **Tests:**
  - `etagMatches` mit `W/`, Liste und `*`.
  - `fnv` stabil.
  - `adminStand`:
    - Ein `source_coverage`-Upsert ändert `content`, aber nicht `stockSum`/`seriesStamp`.
    - Ein `topics`-Update ändert `stockSum`.
    - Ein Neuaufbau bei gleicher Revision (`v=0`, dann `refreshRegionFacts`) ändert `seriesStamp`.
- **Abnahme:** UT grün.

#### P17 · Lese-Routen über `adminRead`; Browser `no-cache` [Server + Client]
- **Dateien:**
  - `app/api/admin/timeline/route.ts`, `coverage/route.ts`, `atlas/route.ts`, `estimate/route.ts` (nur GET), `quality/route.ts` (nur GET)
  - `server/repositories/admin.ts`
  - `components/admin-overview.tsx`, `admin-timeline.tsx`, `admin-atlas.tsx`, `admin-estimate.tsx`, `admin-quality-check.tsx`, `admin-keywords.tsx`
- **Schritte:**
  1. Handler ohne Parameter auf `export async function GET(request:Request)` ändern. Das betrifft `coverage`, `keywords`, `estimate` und `quality`.
  2. Je Route: `return adminRead(request,()=>tagFor…(),()=>build…())` mit den Teilen aus 3.4. Die Antwort bekommt `stand`.
     - Klasse B: aus `adminStand`.
     - Hochrechnung und Qualität: mit `stockSum` des gespeicherten Stands; fehlt es, `changes:null`, `stale:true`.
  3. Hochrechnung: Die heutigen Felder `computed`, `computedAt`, `revision`, `currentRevision`, `stale` bleiben in der Antwort (aus `storedEstimate`). `stand` kommt dazu.
  4. Client: in reinen GET-`fetch` `cache:'no-store'` → `'no-cache'`. Wo ein `fetch` GET und POST bedient (`admin-estimate.tsx:100`, `admin-quality-check.tsx:13`): `cache: method==='GET'?'no-cache':'no-store'`.
- **Nicht ändern:** POST-Handler, Antwortinhalte außer dem neuen Feld `stand`.
- **Tests:** in `tests/admin-http.test.mjs`: Bei passendem `If-None-Match` wird `build` nicht aufgerufen; 304 trägt `ETag`, `Cache-Control`, `Vary`. UT (Routen-Tests in `tests/admin.test.mjs` laufen mit Request).
- **Prüfen:** MS je Route, dann mit `If-None-Match` (8.3).
- **Abnahme:** zweiter Aufruf jeder dieser Routen liefert 304 in unter 0,3 s; im Browser nach F5 Status 304 im Netzwerk-Tab.

#### P18 · Stand-Zeile auf den Seiten
- **Dateien:** NEU `components/admin-stand.tsx` (Code in 3.5); `components/admin-overview.tsx`, `admin-atlas.tsx`, `admin-estimate.tsx`, `admin-timeline.tsx`.
- **Schritte:** `StandLine` direkt unter das h1 setzen (bestehender Kopf `admin-heading`).

  | Seite | `action` | `onAction` |
  |---|---|---|
  | Übersicht | „Aktualisieren“ | `reload` |
  | Atlas | „Aktualisieren“ | Neuladen; `extra`: „ · Gründe aus der Quellensuche vom {reportDate}“ |
  | Hochrechnung | „Neu berechnen“ | ersetzt den heutigen Text „Berechnet …“ (`admin-estimate.tsx:124`); liest `d.stand` statt `d.computedAt`/`d.stale` |

  - Die Abruf-Seite bekommt ihre Stand-Zeile erst in P27a (über `summary`), weil `overview` kein `stand` liefert.
  - Stichwörter und Qualität bekommen sie in P20/P21a.
  - Übersicht und Zeitverlauf: Bei `stand.unbuilt>0` statt der Diagramme `Skeleton` (3.5, „Erstes Füllen“).
- **Prüfen:** IX (neue Datei), TC.
- **Abnahme:** Jede genannte Seite zeigt „Stand TT.MM.JJ, HH:MM · …“.

### Phase 4: Gespeicherte Stände (Klasse C)

#### P19 · Gespeicherte Stände; Hochrechnung aus `region_series` [Server + Client]
- **Voraussetzung:** P18 (die Komponente liest `stand`).
- **Dateien:** NEU `server/integrations/admin-stored.mjs`; `server/integrations/admin-estimate-store.mjs`, `admin-estimate.mjs`; `app/api/admin/estimate/route.ts`; `components/admin-estimate.tsx`; `tests/estimate.test.mjs`; NEU `tests/admin-stored.test.mjs`.
- **Schritte:**
  1. `gzipText`/`gunzipText` umziehen und re-exportieren.
  2. `computeEstimate`: `details` über `detailsFromSeries(await readSeries(db,{columns:['event_days']}),from,to)`. Speichern über `writeStored(db,'estimate',…,{stockSum,content,ms})`.
  3. `storedEstimate`: zuerst `readStored(db,'estimate')`, sonst einmal den alten Schlüssel `admin-estimate`.
  4. GET liefert den Text ohne Parse (`adminRead` mit String). Die Felder, die heute `storedEstimate` dazumischt (`admin-estimate-store.mjs:23-24`), werden vorn angefügt:
     ```js
     '{"stand":'+JSON.stringify(stand)+',"computed":true,"computedAt":'+JSON.stringify(meta.computedAt)
       +',"revision":'+JSON.stringify(meta.content)+',"currentRevision":'+JSON.stringify(content)
       +',"stale":'+String(stand.stale)+','+text.slice(1)
     ```
     Ohne gespeicherten Stand: `{"computed":false,"stand":{…,"computedAt":null}}` (als Objekt über `adminRead`).
  5. `admin-estimate.tsx`: `data.computed===false` (`:114`) bleibt; Leer-Zustand laut 6.8.
  6. Dauer des POST messen. Liegt sie über 8 s, die Replikate auf zwei Schritte verteilen (Entscheidung erst nach Messung).
- **Tests:**
  - gzip hin und zurück mit `PART_CHARS=100` (viele Abschnitte).
  - Zeile kleiner als 2 MB.
  - Übernahme des alten Schlüssels.
  - GET-Text ist gültiges JSON mit `computed`, `computedAt`, `stale`, `stand`.
  - POST bei `unbuilt>0` → 409.
- **Abnahme:** `POST /api/admin/estimate` lokal unter 15 s (vorher 2–3 min); Ergebnis gleich dem alten bei festen Replikaten.

#### P20 · Bauaufträge; Stichwörter gespeichert [Server + Client]
- **Dateien:**
  - NEU `server/integrations/admin-builds.mjs`
  - `server/integrations/admin-keywords.mjs` (`keywordChunk`, `keywordFinish`)
  - `server/integrations/admin-refresh.mjs` (Ziel `keywords`)
  - `server/repositories/admin.ts` (Zeile 25: `atRevision` entfällt; GET liest `readStored('keywords')`)
  - `app/api/admin/keywords/route.ts`
  - `components/admin-keywords.tsx`
  - `scripts/refresh-admin.mjs` (`--build keywords`)
  - `tests/admin-keywords.test.mjs`
- **Schritte:**
  1. wie 3.4 (Vergleichen-und-Tauschen je Abschnitt, Massen-Upsert der Regelwörter, `j.value IS NOT NULL`, `finish` mit `ORDER BY g,n DESC,k` bei `rule`).
  2. Seite:
     - `StandLine action="Neu zählen" hint="Liest alle Berichte; kann einige Minuten dauern."`.
     - Klick: `POST /api/admin/refresh {action:'start',target:'keywords'}`, danach `step`, bis `state==='done'`. Bei `busy` 3 s warten, bei `conflict` sofort erneut. Fortschritt über `stand.build`.
     - Der alte Stand bleibt sichtbar.
     - Ohne Stand: Text „Noch kein Stand gespeichert …“ (6.7) und Knopf „Jetzt berechnen“ (`.btn-primary`).
- **Tests:**
  - Ein Bau mit 1–2 Gebieten je Abschnitt (`chunkRows` klein) ergibt dasselbe wie `adminKeywords`, wobei die alte Abfrage `null`-Begriffe auslässt. Einzige erlaubte Abweichung ist die Schreibweise bei Regelwörtern. KI-Stichwörter sind exakt gleich.
  - Abbruch und Fortsetzung ergeben dasselbe.
  - **Doppelter Schritt:** Derselbe Abschnitt wird zweimal mit demselben erwarteten `next` geschickt. Der zweite ändert nichts (`conflict`), und das Ergebnis ist gleich.
  - Ein `null` in `analysisFeatures.terms` lässt den Abschnitt nicht scheitern.
  - `admin_agg` ist danach leer.
- **Abnahme:** `GET /api/admin/keywords` lokal unter 0,3 s kalt (vorher 116 s); kein Schritt über 8 s (Feld `ms`); ein vollständiger Bau lokal in 2–3 min.

#### P21a · Qualitätsprüfungen in Gebietsreihenfolge [Server + Client]
- **Dateien:**
  - `server/integrations/quality-check.mjs` (`rows(condition,{regions})` mit Klammern, Abschnittsfassung der neun Prüfungen in Gebietsreihenfolge; `storedQualityChecks` mit `stockSum`, 3.4)
  - `server/integrations/admin-builds.mjs` (Ziele `quality:<id>`, `quality:all`)
  - `app/api/admin/quality/route.ts` (POST treibt den Bau; Antwortform 3.4)
  - `components/admin-quality-check.tsx` (Knopf „Alle prüfen“ mit Fortschritt; wiederholt, bis `running` fehlt)
  - `tests/quality-check.test.mjs`
- **Tests:**
  - Je Prüfung: Zahl und die ersten 20 Beispiele gleich den alten `RUNNERS`. Bei gleichen `region_id`/`event_date` ist die Reihenfolge der alten Abfrage nicht festgelegt; deshalb nach `(regionId, date desc, id)` sortiert vergleichen.
  - **`badEventDate` mit zwei Gebieten:** schlechtes Datum nur in Gebiet B; ein Abschnitt nur aus Gebiet A ergibt 0; die Summe der Abschnitte ist gleich dem alten Wert.
  - Ein Schritt mit kleinem Budget pausiert und wird fortgesetzt.
  - Veraltet: Ein Eintrag ohne `stockSum` gilt als veraltet.
- **Abnahme:** keine Einzelabfrage über 3 s lokal; UT grün.

#### P21b · `dupSameMeeting` in Abschnitten [Server]
- **Dateien:** `server/integrations/quality-check.mjs`, `tests/quality-check.test.mjs`.
- **Tests:** `groups`, `extra` und Top 20 gleich der alten Prüfung bei Abschnitten von 1–2 Gebieten.
- **Abnahme:** UT grün; keine Einzelabfrage über 3 s lokal.

#### P21c · `dupSharedSystem` in Abschnitten [Server]
- **Dateien:** `server/integrations/quality-check.mjs`, `tests/quality-check.test.mjs`, NEU `scripts/check-dup-shared.mjs` (lokaler Vergleich alt gegen neu, nur lesend, `readOnly`).
- **Schritte:** Einheiten nach `provider(id)` (3.4). Danach `node scripts/check-dup-shared.mjs` einmal lokal ohne laufenden Import ausführen.
- **Abnahme:** Das Skript meldet gleiche Zahl und gleiche Top 20. Weicht es ab, bleibt die Prüfung nur lokal (Entscheidung E4).

#### P22 · (optional) Vollständigkeitsprüfung und Runner [Server]
- **Dateien:** `server/integrations/data-completeness.mjs`, `admin-builds.mjs` (Ziel `audit`), `components/database-admin.tsx`, `scripts/run-imports.mjs` (nach den Importen `POST /api/internal/admin-refresh {target:'regions'}`, bis `state==='done'`).
- **Abnahme:** Audit in Schritten von höchstens 8 s; der Runner hält `pending` nach seinem Lauf auf 0; die Ausnahme für `audit` in R1 und im Lesetest entfällt.

### Phase 5: Antwort aufteilen, Browser-Speicher, Navigation

#### P23 · Unveränderliche Gebietsdaten [Server]
- **Dateien:** NEU `server/integrations/admin-static.mjs`, NEU `app/api/admin/static/route.ts`; `app/admin/page.tsx` (`staticVersion` als Prop an jede Seitenkomponente); `server/integrations/admin-atlas.mjs` (`staticAreas()` exportieren und wiederverwenden).
- **Tests:** NEU `tests/admin-static.test.mjs`: gleiche Eingaben ergeben dasselbe `v`; alle 5.324 Gebiete; Felder vollständig.
- **Abnahme:** `GET /api/admin/static?v=<v>` mit `Cache-Control: private, max-age=31536000, immutable`; zweiter Abruf im Browser ohne Anfrage.

#### P24a · `areas` und `area` [Server]
- **Dateien:** `server/integrations/admin-data.mjs` (NEU `buildAreas`); NEU `app/api/admin/areas/route.ts`, `area/route.ts`; `server/repositories/admin.ts`.
- **`areas`:**
  - Form: `{asOf,staticVersion,fields:[…],rows:(number|string|null)[][],stand}`. `rows[i]` gehört zu `static.areas[i]`.
  - Felder:

    | Kürzel | Quelle |
    |---|---|
    | `cnt` | count |
    | `u7` | updated7d |
    | `fe`/`le` | firstEvent/lastEvent |
    | `pa` | pendingAnalysis |
    | `rules`, `sum`, `ail`, `kw`, `ins`, `stl`, `bs`, `ba`, `bk`, `fat`, `pat` | die Felder von `stages()` (`admin-data.mjs:142`): rules, summary, aiLabel, keywords, insufficient, stale, blocked_summary, blocked_aiLabel, blocked_keywords, fetchedAt, processedAt |
    | `m` | wirksames `method`: Abdeckung vor Konfiguration, wie `:143` |
    | `as` | attemptStatus |
    | `ls` | lastSuccessAt bzw. importedAt |
    | `la` | lastAttemptAt bzw. importedAt |
    | `cp` | complete |
    | `nr` | nextRetryAt |
    | `ni`/`nw` | Zahl der issues/warnings |

  - Quelle für die dynamischen Felder: `regionFigures(db,{now})` und
    ```sql
    SELECT region_id,json_extract(payload,'$.method'),json_extract(payload,'$.attemptStatus'),coalesce(json_extract(payload,'$.lastSuccessAt'),json_extract(payload,'$.importedAt')),json_extract(payload,'$.lastAttemptAt'),json_extract(payload,'$.importedAt'),json_extract(payload,'$.complete'),json_extract(payload,'$.nextRetryAt'),json_array_length(payload,'$.issues'),json_array_length(payload,'$.warnings') FROM source_coverage
    ```
  - **Pflicht:** alle Felder, die `sourceHealth()` (`shared/admin.mjs:3-9`) liest.
- **`area?id=`:** `{id,issues,warnings,sourceUrl}` aus einer Zeile `source_coverage` (Primärschlüssel); `sourceUrl` wie `:143`.
- **Tests:** `buildAreas` und der Adapter (P25) ergeben dasselbe `sources` wie `loadAdminData`, ohne `issues`/`warnings`, die als Zahlen kommen. Diesen Test in P25 vervollständigen.
- **Abnahme:** `areas` lokal unter 0,5 s und unter 200 KB gzip.

#### P24b · `summary` [Server]
- **Dateien:** `server/integrations/admin-data.mjs` (NEU `buildSummary`); NEU `app/api/admin/summary/route.ts`; `server/repositories/admin.ts`.
- **Inhalt:** wie heute `AdminDashboard` ohne `sources` und `review`, plus `stand`.
  - `counts` als `sum(json_extract(stats,'$.x'))` über `region_stats`; `labels` aus `label_*`; `statuses` aus `region_series.statuses`.
  - `runs` über `idx_import_runs_started`; `lastScheduledAt` über `ORDER BY started_at DESC` mit Filter auf den Auslöser, erstes Ergebnis.
  - Live: versions, analyses, push; `processingState`, `importBusyUntil`, `stand`.
  - `no-store`.
- **Tests:** `buildSummary` ergibt dieselben `counts`, `labels`, `statuses` und `runs` wie `loadAdminData`.
- **Abnahme:** `summary` lokal unter 0,5 s und unter 30 KB.

#### P25 · Browser-Speicher und Adapter
- **Dateien:** `components/admin-store.ts` (ausbauen, 3.5); NEU `shared/admin-areas.mjs`; NEU `tests/admin-areas.test.mjs`.
- **Tests:** Adapter: Zustand, `issueCount`, Zugang und Filter gleich dem alten `sources`.
- **Abnahme:** UT grün; IX.

#### P26 · Navigation mit `next/link`
- **Dateien:** `components/admin-chrome.tsx` (Reiter), interne Admin-Links mit `adminHref(...)` in `components/admin-*.tsx`.
- **Schritte:** `<a href={adminHref(…)}>` → `<Link href={adminHref(…)} prefetch={false}>`. Abmelde-Links (`target="_top"`) bleiben `<a>`.
- **Prüfen:** Zwischen Abruf und Atlas wechseln; im Netzwerk-Tab steht eine `_rsc`-Anfrage, aber keine erneute `areas`/`static`-Anfrage.
- **Rückweg:** Lädt vinext trotzdem neu, `<a>` behalten; der HTTP-Cache wirkt weiter.
- **Abnahme:** Ein Wechsel Abruf ↔ Atlas lädt keine Daten neu.

#### P27a · Abruf-Seite auf den Speicher
- **Dateien:** `components/admin-processing.tsx`, `components/admin-processing-map.tsx`, `app/admin/page.tsx`.
- **Schritte:**
  - `AdminProcessing` holt `summary`, `static`, `areas` (über `useAdminSources`) und `loadGeo()` parallel.
  - Kopf, Kennzahlen, Stand-Zeile (`StandLine stand={summary.stand} action="Aktualisieren"`) und Auftragssteuerung erscheinen nach `summary`, Liste und Karte nach `static`+`areas`.
  - Hinweise kommen über `area?id` beim Aufklappen von „Verarbeitung & Quellenhinweise“. Der Filter „issues“ nutzt `issueCount>0`.
  - **Während eines Auftrags:**
    - Fortschritt wie heute.
    - `summary` höchstens einmal pro Minute und nur bei sichtbarem Tab.
    - Zahlen der Auftragsgebiete aus `job.items`; `areas` erst nach Auftragsende, sonst höchstens alle 5 min bei sichtbarem Tab.
    - Zeitverlauf nie automatisch.
    - Nach dem Ende Nachhol-Schleife und `invalidateAdmin('/api/admin/')`.
- **Abnahme:** Abruf öffnet ohne `overview`-Anfrage; erste vollständige Anzeige lokal kalt unter 1,5 s.

#### P27b · Qualität auf den Speicher
- **Dateien:** `components/admin-dashboard.tsx`, `components/admin-loader.tsx` (entfällt, sobald P27a und P27b fertig sind), `app/admin/page.tsx`.
- **Schritte:** `summary`, `static`, `areas`, `quality` und `review` (Standardfilter) parallel. Die Zählungen kommen aus `useAdminSources`. Die Prüfliste zeigt bei `total===null` „Trefferzahl wird nachgerechnet“.
- **Abnahme:** „Qualität“ öffnet ohne `overview`-Anfrage, beim ersten Mal unter 400 KB, danach unter 150 KB.

#### P27c · Atlas auf den Speicher
- **Dateien:** `components/admin-atlas.tsx`.
- **Schritte:** `static` + `areas` + `loadGeo()`. Die Route `atlas` wird nicht mehr genutzt.
- **Abnahme:** keine `GET /api/admin/atlas`; Atlas lokal kalt unter 1 s.

#### P27d · Übersicht, Hochrechnung, Stichwörter auf `useAdmin`
- **Dateien:** `components/admin-overview.tsx`, `admin-estimate.tsx`, `admin-keywords.tsx`, `admin-timeline.tsx`.
- **Schritte:** `useAdmin`; nach Aktionen `invalidateAdmin(...)`.
- **Abnahme:** Nach F5 antworten alle Daten-GETs mit 304, und `static` kommt ohne Anfrage.

#### P28 · Export umstellen, alte Routen entfernen [Server]
- **Dateien:**
  - `app/api/admin/export/route.ts`: aus `buildAreas` + static + `issues`/`warnings` aus `source_coverage`; `sourcesCsv` bleibt.
  - Routen `overview` und `atlas` löschen, sobald `grep -rn "api/admin/overview\|api/admin/atlas" components app` leer ist.
  - `tests/admin.test.mjs`:
    - die Routenliste (`:195`) und die Prüfung auf `no-store` bei 401/403 (`:200-201`) von `overview` auf `summary`/`areas` umstellen
    - `routes.overview.GET()` (`:205`) ersetzen
    - den Stub (`:184`) um die neuen Repository-Funktionen ergänzen
  - `loadAdminData` bleibt nur, wenn Tests es brauchen.
- **Abnahme:** UT grün; CSV byte-gleich zum alten Export (gleiche Filter); IX.

### Phase 6: Darstellungskosten

#### P29 · Renderkosten senken
- **Dateien:** `components/admin-processing.tsx` (`:45-46,87,96,140`), `components/admin-atlas.tsx`, `components/admin-quality-check.tsx`.
- **Schritte:**
  - `visible` und die Summen per `useMemo`; Suchtext aus dem Adapter (`search`).
  - Atlas: `hover` in eine Kindkomponente verlagern, Stapelzahlen per `useMemo`.
  - `regionName` per `Map` statt `find`.
  - `AdminTimeline` per `React.lazy`.
- **Abnahme:** Tippen im Suchfeld der Abruf-Seite ohne spürbare Verzögerung (React Profiler: ein Render unter 16 ms).

### Phase 7: Design wie die Startseite

Details in Abschnitt 5. Prüfseiten ohne langsame Schnittstellen: `/admin` (To-do) und `/admin?seite=hochrechnung`, jeweils bei 375 und 1440 px.

#### P30 · Bausteine anlegen
- **Dateien:** NEU `components/admin-ui.tsx` (5.2), NEU `components/admin-colors.ts` (5.4), NEU `components/admin-texts.ts` mit `PAGE_HEAD`, `FOOT` (6.1).
- **Schritte:** In `HELP` schon jetzt **alle IDs mit ihrem `title`** eintragen (Spalte „title“ in 6.3–6.9). `sub`, `how` und `todo` folgen in P38. Sonst fehlen von P34 bis P38 die Überschriften im Ladezustand. Die übrigen Tabellen bleiben leere Objekte.
- **Abnahme:** TC; IX.

#### P31 · Rahmen und alte Admin-Skins
- **Dateien:**
  - `components/admin-chrome.tsx` (5.1); `app/admin/page.tsx` (`AdminFrame`; Seitenkomponenten ohne `displayName`/`signOutPath`)
  - alle Seitenkomponenten: Wrapper `div.admin-app`, `AdminHeader` und `main.admin-shell` entfernen
  - `RegionCatchUp` in `AdminFrame`
  - `app/ratsmonitor.css`, `app/analyse-admin.css` (CSS-Schritt 1, 5.5)
- **Abnahme:**
  - Logo und Inhalt bei x=16.
  - Weißer Hintergrund, kein Rahmen um die Seite.
  - Tab-Titel „{Seite} · Administration · Plenara“.

#### P32 · CSS: Token-Skript und Abschlussblock
- **Dateien:** `app/analyse-admin.css` (Schritte 2 und 3, 5.5).
- **Abnahme:** `grep -c "#0f766e" app/analyse-admin.css` trifft nur noch übersprungene Zeilen; Abschnitte als Linien.

#### P33 · Seitenköpfe
- **Dateien:** alle Seitenkomponenten. `AdminPageHead page=…` mit `StandLine` als Kind; Dachzeilen (`eyebrow`) und `admin-heading` entfernen.
- **Abnahme:** h1 28 px (mobil) bzw. 44 px; Pfadzeile „Administration / …“.

#### P34 · Kennzahlen und Ladezustände
- **Schritte:** Alle Kennzahlen auf `Kpis`; beim Laden `PageSkeleton` (Abschnittslisten in 5.6).
- **Abnahme:** 4 Spalten (mobil 2), Wert 22 px; Überschriften im Ladezustand sichtbar.

#### P35 · Bedienelemente
- **Schritte:**
  - `Choice`/shadcn `Select` → `AdminChoice`.
  - Gebietswahl in Qualität und `DatabaseAdmin` → `AdminAreaPick`.
  - Knöpfe → `.btn-primary`, `.btn-secondary btn-sm`, `.btn-danger`, `.link-btn`.
  - Checkbox, Input → native Elemente mit Klassen.
  - `confirmDialog` für Abruf aller Quellen, Beenden, Verwerfen.
- **Abnahme:** `grep -n "@/components/ui/\(select\|button\|checkbox\|input\)" components/admin-*.tsx components/database-admin.tsx` ist leer.

#### P36 · Farben
- **Schritte:** Diagramm- und Kartenfarben laut 5.4.
- **Abnahme:** keine Treffer für `#2352ad`, `#101d37`, `#555"`, `#b4530a` in `components/admin-*.tsx`.

### Phase 8: Texte

#### P37 · Bezeichnungen, Wortersetzungen, Datum [Server: `shared/admin.mjs`]
- **Schritte:** Ersetzungen aus 6.12 und die Bezeichnungen in `shared/admin.mjs` (6.13); Datum zweistellig.
- **Abnahme:** `grep -nE "\b(du|dein\w*|Artikel\w*)\b|Datenbankstand|Datenstand|year:'numeric'" components/admin-*.tsx components/database-admin.tsx app/admin/page.tsx` trifft nur noch den Arbeitsauftrag an den KI-Agenten.

#### P38 · Abschnittstexte, Hilfen, Glossar, Fußzeilen
- **Schritte:**
  - In `HELP` `sub`, `how` und `todo` ergänzen; `TERMS`, `FILTER_HELP`, `MAP_HELP`, `STATE_HELP`, `JOB_STATE_HELP`, `ATLAS_TODO`, `REVIEW_HELP`, `FIELD_HELP`, `QUALITY_EXPLAIN`, `COL_HELP` in `admin-texts.ts` füllen (6.2–6.11).
  - `SectionHelp`/`SectionTodo` je Abschnitt einsetzen; Glossar-Abschnitt `#begriffe` auf der Übersicht.
- **Abnahme:** Auf jeder Seite stehen Überschriften, Unterzeilen und „Wie wird gezählt?“ **vor** dem Eintreffen der Daten; `/admin?seite=uebersicht#begriffe` springt an.

#### P39 · Neue Filter und fachliche Korrekturen
- **Schritte:**
  - `FILTERS` in `app/admin/page.tsx` **und** die Auswahlliste `const FILTERS:[string,string][]` in `components/admin-processing.tsx:31` um `'partial','stale','failed'` ergänzen (Namen aus 6.4). `shared/admin.mjs` (`SOURCE_FILTERS`, `filterAdminSources`) kennt `partial` und `stale` schon. Dort `failed` ergänzen, falls es fehlt.
  - `matchesFilter` in `admin-processing.tsx` um `filter==='partial'&&s.partial`, `filter==='stale'&&s.stale`, `filter==='failed'&&s.attemptStatus==='failed'` ergänzen.
  - Korrekturen aus 6.14.
- **Abnahme:** `/admin?seite=abruf&filter=failed` zeigt nur Gebiete mit fehlgeschlagenem letzten Abruf; der Filter steht in der Auswahl.

### Phase 9: Abschluss

#### P40 · Dokumentation
- **Schritte:**
  - `CLAUDE.md`: Block „Admin: Vorberechnung“ nach dem Muster „Suche: Wortliste“ (Was, Wozu, Lokal, Produktion, Rückfall, nach Formeländerungen `SERIES_VERSION`/`FIGURES_VERSION` erhöhen bzw. `refresh-admin.mjs --full`).
  - `components/ratsmonitor/FRONTEND.md` Zeile 46 und Dateikarte (5.8).
  - IX.

#### P41 · Messen in Produktion
- **Schritte:**
  - Migration `--remote` (gleicher Befehl wie P09 mit `--remote` statt `--local`).
  - Deploy (P09–P15b gemeinsam); Nachhol-Schleife über eine offene Adminseite oder den Runner.
  - Messen:
    - Zeiten der Lese-Routen und `ms` der Schritte
    - 304 hinter dem Hosting und `content-encoding`
    - Grenze gebundener Werte (ob `PART_CHARS` steigen darf), Anweisungen je Batch, Abfragen je Aufruf
    - CPU der Hochrechnung
    - Cache-Regel `/geo/*`
- **Abnahme:** Werte in die Tabelle 3.9 eintragen.

---

## 5. Design-Angleichung

**Ziel:** Die Adminseiten sehen aus wie die Startseite und die Plenara.X-Seiten.

**Heutige Hauptabweichungen:**
- Die Wurzel ohne `.ratsmonitor` führt zu Kobalt-Links und -Fokus aus `app/design-tokens.css`/`design-styles.css`.
- Fünf übereinanderliegende Stil-Schichten (`analyse-admin.css` vier, `ratsmonitor.css:66-94` eine) erzeugen Rahmen und Schatten um die Seite und Kachel in Kachel.
- Drei linke Kanten: Logo x=16, Reiter x=76, Inhalt x=30.
- Hintergrund Slate-50, Akzent `#0f766e` (52-mal) statt `#0d9488`, rund 20 Schriftgrößen, shadcn-Knöpfe.

**Designregeln** (`components/ratsmonitor/FRONTEND.md`:48-57):
- IBM Plex Sans; Größen nur 12/14/16/18/22/28/44 px.
- Text nur `#0f172a`, `#64748b`, `#0d9488`; Fehler `rose-700`.
- Weiß; Linien `#e2e8f0` statt Kästen; keine bunten Abzeichen.
- Hauptaktion schwarze Pille mit „→“ (`.btn-primary`), Nebenaktion Petrol-Text (`.btn-secondary`).
- „Sie“, „Stand“, Datum „08.10.26“.

### 5.1 Rahmen: `components/admin-chrome.tsx`

Die Exporte `AdminPage`, `ADMIN_PAGES` und `adminHref` bleiben unverändert, weil mehrere Dateien sie importieren. `AdminHeader` und `ShieldCheck` entfallen.

```tsx
'use client';
import Link from 'next/link';
import {useEffect,type ReactNode} from 'react';
import {Brand} from '@/components/ratsmonitor/components/Brand';
import {ConfirmDialog} from '@/components/ratsmonitor/components/ConfirmDialog';
import {BRAND_NAME,DEFAULT_BRAND} from '@/components/ratsmonitor/lib/brands';
import {FOOT} from '@/components/admin-texts';
import {RegionCatchUp} from '@/components/admin-catch-up';
// AdminPage, ADMIN_PAGES, adminHref: unverändert lassen.

/** Kopfzeile wie Header.tsx der Startseite: 56 px, Linie unten, Logo links, Konto rechts. */
export function AdminBar({displayName,signOutPath}:{displayName?:string;signOutPath?:string}){
 return <header className="sticky top-0 z-[1100] border-b border-slate-200 bg-white">
  <div className="flex h-[56px] items-center justify-between gap-4 px-4">
   <div className="flex min-w-0 items-center gap-3"><Brand/><span className="hidden text-[14px] text-slate-500 sm:inline">Administration</span></div>
   {signOutPath&&<div className="flex min-w-0 items-center gap-2 text-[14px] text-slate-500">
    {displayName&&<span className="hidden max-w-[240px] truncate md:inline">{displayName}</span>}
    <a target="_top" href={signOutPath} className="btn-secondary btn-sm">Abmelden</a></div>}
  </div>
 </header>;
}
/** Seitenreiter in der Optik von .ri-topnav; Text bündig mit dem Inhalt (x = 16 px). */
export function AdminTabs({page}:{page:AdminPage}){
 return <nav aria-label="Adminseiten" className="border-b border-slate-200 bg-white px-[max(1vw,16px)]">
  <div className="scroll-thin -mx-2.5 flex gap-1 overflow-x-auto py-1.5">
   {ADMIN_PAGES.map(p=><Link key={p.id} href={adminHref(p.id)} prefetch={false} aria-current={page===p.id?'page':undefined}
    className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg px-2.5 text-[14px] text-slate-500 hover:bg-slate-100 hover:text-slate-900 aria-[current=page]:font-medium aria-[current=page]:text-slate-900">{p.label}</Link>)}
  </div>
 </nav>;
}
/** Rahmen jeder Adminseite; steht in app/admin/page.tsx, damit Kopf und Reiter beim Seitenwechsel stehen bleiben. */
export function AdminFrame({page,displayName,signOutPath,tabs=true,children}:{page?:AdminPage;displayName?:string;signOutPath?:string;tabs?:boolean;children:ReactNode}){
 const label=ADMIN_PAGES.find(p=>p.id===page)?.label;
 useEffect(()=>{document.title=(label?label+' · ':'')+'Administration · '+BRAND_NAME[DEFAULT_BRAND];},[label]);
 return <div className="ratsmonitor admin-app">
  <AdminBar displayName={displayName} signOutPath={signOutPath}/>
  {tabs&&page&&<AdminTabs page={page}/>}
  {tabs&&<RegionCatchUp/>}
  <main id="inhalt" className="w-full px-[max(1vw,16px)] text-slate-900">{children}
   <footer className="mt-16 flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-slate-100 py-4 text-[12px] text-slate-500">
    <span className="max-w-[820px]">{page?FOOT[page]:null}</span>
    <span className="flex gap-5">{page&&<Link href={adminHref('uebersicht')+'#begriffe'} className="text-teal-600">Begriffe →</Link>}<a href="/" className="text-teal-600">Zur öffentlichen Website →</a></span>
   </footer>
  </main>
  <ConfirmDialog/>
 </div>;
}
```

- `RegionCatchUp` kommt aus P15b (`components/admin-catch-up.tsx`).
- `admin-texts.ts` darf `admin-chrome.tsx` nur als **Typ** importieren (`import type {AdminPage}`), sonst entsteht ein Kreisimport.

`app/admin/page.tsx`:
- Die Anmelde-, Einrichtungs- und Fehlerzustände rendern `<AdminFrame tabs={false}><div className="mx-auto max-w-[640px] py-16">…</div></AdminFrame>`:
  - h1 `text-[28px] font-semibold`
  - Text `mt-3 text-[16px] text-slate-500`
  - Anmeldelink `<a className="btn-primary mt-6">`
  - `eyebrow`, `Button` und `.text-link` entfallen
- Die Seiten rendern `<AdminFrame page={page} displayName={…} signOutPath={signOutPath}>{inhalt}</AdminFrame>`.

### 5.2 Bausteine: `components/admin-ui.tsx` (NEU)

```tsx
'use client';
import Link from 'next/link';
import {useMemo,useState,type ReactNode} from 'react';
import {PageBand} from '@/components/ratsmonitor/pages/analytics/PageBand';
import {FilterSelect} from '@/components/ratsmonitor/components/FilterSelect';
import {HELP,PAGE_HEAD} from '@/components/admin-texts';
import type {AdminPage} from '@/components/admin-chrome';
export {StandLine,standText} from '@/components/admin-stand';

/** „2026-10-08“ → „08.10.26“ */ export const dd=(d?:string|null)=>d?d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(2,4):'–';
/** „2026-10…“ → „10.26“ */     export const mm=(d?:string|null)=>d?d.slice(5,7)+'.'+d.slice(2,4):'–';
/** „06.10.2026“ → „06.10.26“ (reportDate des Atlas) */ export const short=(s:string)=>s.replace(/\.(\d{2})(\d{2})$/,'.$2');

export function AdminPageHead({page,children}:{page:AdminPage;children?:ReactNode}){
 const h=PAGE_HEAD[page];
 return <PageBand>
  <p className="text-[14px] text-slate-500"><Link href="/admin" className="text-teal-600">Administration</Link> / {h.title}</p>
  <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">{h.title}</h1>
  <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">{h.intro}</p>
  {children&&<div className="mt-4">{children}</div>}
 </PageBand>;
}
export type Kpi={label:string;value?:ReactNode;of?:ReactNode;note?:ReactNode;title?:string};
/** Kennzahlen wie Plenara.X (BeschluessePage.tsx:84). value undefined = lädt (drei Punkte). */
export function Kpis({label,items}:{label:string;items:Kpi[]}){
 return <dl aria-label={label} className="grid grid-cols-2 gap-y-6 sm:grid-cols-4">
  {items.map((k,i)=><div key={k.label} title={k.title} className={'min-w-0 px-4 '+(i%2?'border-l border-slate-200 ':'max-sm:pl-0 ')+(i?'sm:border-l sm:border-slate-200':'sm:pl-0')}>
   <dt className="text-[12px] text-slate-500">{k.label}</dt>
   <dd className="mt-1 text-[22px] font-semibold tabular-nums">{k.value===undefined?<span className="rm-dots" aria-label="wird geladen"><i/><i/><i/></span>:k.value}
    {k.of!==undefined&&k.value!==undefined&&<span className="text-[14px] font-normal text-slate-500"> / {k.of}</span>}</dd>
   {k.note&&<dd className="mt-1 text-[12px] leading-[1.45] text-slate-500">{k.note}</dd>}
  </div>)}
 </dl>;
}
export function How({label='Wie wird gezählt?',children}:{label?:string;children:ReactNode}){
 return <details className="mt-2 max-w-[820px] text-[14px] text-slate-500"><summary className="w-fit cursor-pointer text-teal-600">{label}</summary><div className="mt-2 space-y-2">{children}</div></details>;
}
/** Unterzeile und aufklappbare Erklärung eines Abschnitts; direkt unter dem Überschriften-Block. */
export function SectionHelp({id}:{id:string}){
 const h=HELP[id];if(!h)return null;
 return <>{h.sub&&<p className="mt-1 max-w-[820px] text-[14px] text-slate-500">{h.sub}</p>}
  {h.how?.length?<How label={h.howLabel}>{h.how.map(t=><p key={t}>{t}</p>)}</How>:null}</>;
}
/** „Was tun?“-Links eines Abschnitts; am Ende des Abschnitts. */
export function SectionTodo({id}:{id:string}){
 const t=HELP[id]?.todo;if(!t?.length)return null;
 return <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[14px]">{t.map(x=><Link key={x.href} href={x.href} className="text-teal-600">{x.label} →</Link>)}</p>;
}
export const Skeleton=({h=240}:{h?:number})=><div aria-hidden="true" className="w-full animate-pulse rounded-lg bg-slate-100" style={{height:h}}/>;
/** Solange Daten fehlen: Abschnitte mit Überschrift und Erklärung, darunter graue Flächen. [HELP-ID, Höhe in px] */
export function PageSkeleton({sections}:{sections:[string,number][]}){
 return <>{sections.map(([id,h])=><section key={id} className="admin-section"><div className="admin-section-heading"><h2>{HELP[id]?.title}</h2></div><SectionHelp id={id}/><div className="mt-5"><Skeleton h={h}/></div></section>)}</>;
}
export function Legend({items}:{items:[string,string][]}){
 return <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[12px] text-slate-500">{items.map(([c,l])=><li key={l} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm" style={{background:c}}/>{l}</li>)}</ul>;
}
export function Alert({children,onRetry}:{children:ReactNode;onRetry?:()=>void}){
 return <p role="alert" className="mt-3 max-w-[820px] text-[14px] text-rose-700">{children}{onRetry&&<> <button type="button" className="link-btn" onClick={onRetry}>Erneut laden</button></>}</p>;
}
/** Ersetzt die lokalen Choice-Helfer (shadcn Select). Kurze Listen bis ca. 30 Einträge. */
export function AdminChoice({id,label,value,onChange,items,help}:{id:string;label:string;value:string;onChange:(v:string)=>void;items:[string,string][];help?:string}){
 return <div className="min-w-0"><label htmlFor={id} className="field-label mb-1 block">{label}</label>
  <FilterSelect id={id} label={label} allLabel="" value={value} options={items.map(([v,l])=>({value:v,label:l}))} onChange={onChange} size="sm" highlight={false} className="w-full"/>
  {help&&<p className="field-help mt-1">{help}</p>}</div>;
}
/** Gebietswahl für lange Listen (3.500–5.300 Gebiete): Suchfeld, höchstens 20 Treffer. */
export function AdminAreaPick({id,label,value,onChange,options,allLabel,disabled}:{id:string;label:string;value:string;onChange:(v:string)=>void;options:{id:string;name:string}[];allLabel:string;disabled?:boolean}){
 const [q,setQ]=useState('');
 const current=value==='all'?allLabel:options.find(o=>o.id===value)?.name||value;
 const hits=useMemo(()=>{const s=q.trim().toLocaleLowerCase('de-DE');return s?options.filter(o=>o.name.toLocaleLowerCase('de-DE').includes(s)).slice(0,20):[];},[q,options]);
 const pick=(v:string)=>{onChange(v);setQ('');};
 return <div className="relative min-w-0"><label htmlFor={id} className="field-label mb-1 block">{label}</label>
  <input id={id} type="search" autoComplete="off" className="field-input" value={q} disabled={disabled} placeholder={current}
   onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&hits[0]){e.preventDefault();pick(hits[0].id);}if(e.key==='Escape')setQ('');}}/>
  {q&&<ul className="popover absolute left-0 right-0 z-20 m-0 mt-1 max-h-[320px] list-none overflow-auto p-1.5">
   {[{id:'all',name:allLabel},...hits].map(o=><li key={o.id}><button type="button" className="w-full rounded-lg px-3 py-2 text-left text-[14px] hover:bg-slate-100" onClick={()=>pick(o.id)}>{o.name}</button></li>)}
   {!hits.length&&<li className="px-3 py-2 text-[14px] text-slate-500">Kein Gebiet gefunden.</li>}</ul>}
  <p className="field-help mt-1">Gewählt: {current}</p></div>;
}
```

`PageBand` erwartet `px-[max(1vw,16px)]` am Elternelement (negativer Rand). Das liefert `<main>` in `AdminFrame`.

### 5.3 Texte: Gerüst `components/admin-texts.ts` (NEU)

```ts
import type {AdminPage} from '@/components/admin-chrome';   // nur Typ (Kreisimport!)
export const href=(page:string,params='')=>'/admin?seite='+page+(params?'&'+params:'');
export type Todo={label:string;href:string};
export type Help={title:string;sub?:string;how?:string[];howLabel?:string;todo?:Todo[]};
export const PAGE_HEAD:Record<AdminPage,{title:string;intro:string}>={/* 6.1 */};
export const FOOT:Record<AdminPage,string>={/* 6.1 */};
export const HELP:Record<string,Help>={/* 6.3–6.9, IDs wie 'uebersicht.verlauf'; title schon in P30 */};
export const TERMS:{term:string;text:string}[]=[/* 6.11 */];
export const FILTER_HELP:Record<string,string>={};  export const MAP_HELP:Record<string,string>={};
export const STATE_HELP:Record<string,string>={};   export const JOB_STATE_HELP:Record<string,string>={};
export const ATLAS_TODO:Record<string,{sie?:string;dev?:string}>={};
export const REVIEW_HELP:Record<string,string>={};  export const FIELD_HELP:Record<string,string>={};
export const QUALITY_EXPLAIN:Record<string,string>={}; export const COL_HELP:Record<string,string>={};
```

Texte mit Zahlen bleiben im JSX.

### 5.4 Farben: `components/admin-colors.ts` (NEU)

Die Farben in `shared/coverage.mjs`, `shared/source-access.mjs` und `shared/atlas-categories.mjs` bleiben unverändert, denn der eigenständige Atlas (`scripts/dashboard/build.mjs`) nutzt sie. Der Admin überschreibt sie hier.

```ts
import {MAP_COLORS} from '@/components/ratsmonitor/lib/constants';
export const AC={accent:'#0d9488',ink:'#0f172a',muted:'#94a3b8',grid:'#e2e8f0',base:'#cbd5e1',axis:'#64748b',track:'#f1f5f9',
 zero:MAP_COLORS.zero,hatch:MAP_COLORS.hatch,scale:MAP_COLORS.scale,warn:MAP_COLORS.ring,selection:'#0f172a',land:MAP_COLORS.national} as const;
/** Schraffur „angebunden, ohne Berichte“: CSS-Fläche (Legende, Listenpunkt, Balken). */
export const HATCH_CSS=`repeating-linear-gradient(135deg,#fff 0 2px,${AC.hatch} 2px 3px)`;
// SVG: <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#fff"/><path d="M0 5L5 0" stroke={AC.hatch} strokeWidth="1"/></pattern>
export const COVERAGE={data:AC.scale[3],partial:AC.scale[1],failed:AC.warn,none:AC.zero} as const;
/** Anteile: bis 20 %, bis 50 %, bis 80 %, darüber (Schwellen wie admin-processing-map.tsx:31) */
export const shareColor=(a:number)=>a>.8?AC.scale[3]:a>.5?AC.scale[2]:a>.2?AC.scale[1]:AC.scale[0];
export const BUCKET_COLOR:Record<string,string>={'fresh:d180':AC.muted,'fresh:old':AC.warn,'reach:none':HATCH_CSS,'fresh:none':HATCH_CSS};
export const bucketColor=(kind:'reach'|'fresh',b:{id:string;color:string})=>BUCKET_COLOR[kind+':'+b.id]??b.color;
export const ACCESS_COLOR:Record<string,string>={oparl:AC.scale[3],api:AC.accent,scraping:AC.scale[2],'api-noreader':'#64748b',noreader:AC.muted,blocked:AC.warn,none:AC.zero};
```

Diagramme: wörtlich ersetzen in `admin-overview.tsx`, `admin-timeline.tsx` und `admin-estimate.tsx`.

| Alt | Neu | Bedeutung |
|---|---|---|
| `#e3e3e3` | `#e2e8f0` | Gitter |
| `#8a8a8a` | `#cbd5e1` | Nulllinie |
| `#555` | `#64748b` | Achsentext |
| `#101d37` | `#0f172a` | Mauszeiger-Linie, Punkt |
| `#2352ad` | `#0f172a` | zweite Reihe (Übersicht) |
| `#0f766e` | `#0d9488` | erste Reihe, Balken |
| `fill="#171717"` | `fill="#64748b"` | Achsentitel (Hochrechnung) |
| `stroke="#171717"` | `stroke="#94a3b8"` | Modelllinie (Hochrechnung) |
| `#b4530a` | `#0f172a` | Stichproben-Punkte (Hochrechnung) |
| `'#777'` (`admin-keywords.tsx:20`) | `'#94a3b8'` | Ersatzfarbe |

Karten (`admin-processing-map.tsx`, `admin-atlas.tsx`): nur noch `AC`, `COVERAGE`, `shareColor`, `bucketColor`, `ACCESS_COLOR` und die Schraffur.
- Auswahlrand `#101d37` → `AC.selection`
- Landesgrenzen `#8a95a5` → `AC.land`
- `#e4e7eb`/`#e3e8ed` → `AC.zero`
- fehlgeschlagen `#ad392d` → `AC.warn`
- „angebunden, ohne Daten“ `#f2ce82` → Schraffur
- Die Kategoriefarben des Atlas bleiben die Serverfarben.

### 5.5 CSS in drei mechanischen Schritten

`app/analyse-admin.css` hat Zeilen über 300 Zeichen. Dort nur mit `grep -n -o "<eindeutiges Stück>"` suchen und mit `Edit` auf genau diese Teilzeichenkette ersetzen.

**Schritt 1: Admin-Skins löschen.** Die Anker sind Textstellen, keine Zeilennummern.

| Datei | Was | Wie |
|---|---|---|
| `app/ratsmonitor.css` | Kommentar „/* Shared administration keeps its workflows …“ (~66) | löschen |
| `app/ratsmonitor.css` | Zeile `@layer base {.admin-shell…` (~67) | ersetzen durch `@layer base {.ratsmonitor .analysis-provenance,.ratsmonitor .prose{margin-top:28px}.ratsmonitor .heading-m{font-size:18px;line-height:1.4}.ratsmonitor .facts__row{padding:10px 0}.ratsmonitor .page-note{font-size:14px;line-height:1.6;margin-top:10px}}`. Die folgende Zeile (`.ratsmonitor *`, reduzierte Bewegung) **bleibt**. Vorher prüfen, dass die übrigen Regeln dieser Zeile genau diese Nicht-Admin-Regeln sind. |
| `app/ratsmonitor.css` | „/* Explicit light controls for the administration workspace. */“ bis `@media(max-width:760px){.admin-shell{margin:12px 8px…}}` (~70–87) | löschen |
| `app/ratsmonitor.css` | „/* Administration im Rahmen der übrigen Seiten …“ bis `.admin-topbar>a.admin-back:last-child{margin-left:0}` (~89–94) | löschen; ab „/* Eigener Leeren-Button …“ bleibt alles |
| `app/analyse-admin.css` | Zeile ~84: genau die vier Regeln `.admin-shell{margin:24px auto;padding:24px;border:1px solid #e2e8f0}`, `.admin-gate .wordmark{font-size:28px;color:#0f766e}`, `.admin-shell .admin-topbar{border-color:#e2e8f0}`, `.admin-stage-ai{background:#f0fdfa}` | als Teilzeichenkette entfernen; der Rest der Zeile dient `/analysen` |
| `app/analyse-admin.css` | „/* Adminbereich im Quorumo-Design …“ bis zur `}`, die `@media(max-width:700px){` schließt (~100–156) | löschen |
| `app/analyse-admin.css` | „/* Ganz Deutschland: …“ bis `@media (max-width:860px){.admin-app .admin-germany…}` (~162–175) | löschen (tote Klassen) |

**Gelöscht werden nur die in der Tabelle genannten Stellen. Alles andere bleibt.** Dazu gehören auch:
- die Admin-Regeln in Zeile 79 (`.admin-pages…`, 5.556 Zeichen)
- die Zeilen 85–97 (`.admin-timeline`, `.admin-estimate` mit Diagramm-Rastern, `.admin-run-debug`, `.admin-terms-columns`)
- die Zeilen 158–160 (Auftragsfortschritt)
- Zeile 177 bis Dateiende
- Zeile 81 `}`: Sie schließt das `@layer base {` aus Zeile 3.

Der Abschlussblock (Schritt 3) überstimmt die bleibenden Regeln.

**Schritt 2: Token-Skript.** Datei mit dem **Write-Werkzeug** in den Scratchpad schreiben (nicht per Bash-Heredoc, sonst gehen Backslashes verloren), mit `node --check` prüfen und aus der Repo-Wurzel `node <pfad>/admin-css-tokens.mjs` ausführen.

```js
import {readFileSync,writeFileSync} from 'node:fs';
const file='app/analyse-admin.css';
const skip=['.screen','.masthead','.page-error-action','.map-view','.analysis-','.legacy-tools','.tabbar','.deferred-map','.map-loading','.region-search','.skip-link'];
const px=r=>{const v=parseFloat(r)*16;return v<=12.5?12:v<=15.5?14:v<=17?16:v<=20?18:v<=25?22:28;};
const out=readFileSync(file,'utf8').split('\n').map(line=>{
 if(!line.includes('admin-')||skip.some(s=>line.includes(s)))return line;
 return line.replace(/font-size:\s*([0-9.]+)rem/g,(_,r)=>'font-size:'+px(r)+'px')
  .replace(/#0f766e/gi,'#0d9488').replace(/#(475569|334155|555)(?![0-9a-f])/gi,'#64748b').replace(/#2352ad/gi,'#0f172a')
  .replace(/box-shadow:[^;}]*/g,'box-shadow:none')
  .replace(/border-radius:(\d+)px/g,(m,v)=>Number(v)>=10&&Number(v)<=24?'border-radius:0':m);
});
writeFileSync(file,out.join('\n'));
```

Danach prüfen: `git diff --stat app/analyse-admin.css` und `grep -c "#0f766e" app/analyse-admin.css` (nur noch Treffer in übersprungenen Zeilen).

**Schritt 3: Abschlussblock ans Ende von `app/analyse-admin.css`.**

```css
/* ===== Adminbereich im Design der Startseite (Oktober 2026) =====
   Wurzel jeder Adminseite: <div class="ratsmonitor admin-app">; <main> ohne admin-shell/admin-workspace.
   Steht am Dateiende und überstimmt ältere .admin-Regeln. Nur .admin-*-Klassen ansprechen:
   ungeschichtete Regeln schlagen Tailwind- und .btn-*-Klassen (die liegen in @layer). */
.admin-app :is(.admin-section,.admin-territories,.admin-pipeline,.admin-job,.admin-storage-status,.admin-timeline,.admin-estimate,.admin-note,.admin-notice,.admin-attention) a:not([class]){color:#0d9488;text-decoration:none}
.admin-app :is(.admin-section,.admin-territories,.admin-pipeline,.admin-job,.admin-storage-status,.admin-timeline,.admin-estimate,.admin-note,.admin-notice,.admin-attention) a:not([class]):hover{text-decoration:underline;text-underline-offset:3px}
.admin-app :is(.admin-section,.admin-territories,.admin-pipeline,.admin-job,.admin-storage-status,.admin-timeline,.admin-estimate) summary{cursor:pointer;color:#0d9488}
.admin-app .eyebrow{margin:0 0 4px;font-size:12px;font-weight:500;letter-spacing:0;text-transform:none;color:#64748b}
.admin-app .admin-section,.admin-app .admin-territories,.admin-app .admin-pipeline,.admin-app .admin-job,.admin-app .admin-storage-status,.admin-app .admin-timeline,.admin-app .admin-estimate{margin:48px 0 0;padding:32px 0 0;border:0;border-top:1px solid #e2e8f0;border-radius:0;background:none;box-shadow:none;scroll-margin-top:72px}
.admin-app .admin-atlas-why,.admin-app .admin-atlas-main{margin-top:48px}
.admin-app .admin-section-heading{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px 24px;margin:0}
.admin-app .admin-section-heading>span{font-size:14px;color:#64748b}
.admin-app :is(.admin-section,.admin-territories,.admin-pipeline,.admin-job,.admin-storage-status,.admin-timeline,.admin-estimate,.admin-atlas-detail-head) h2{margin:0;font-size:22px;font-weight:600;line-height:1.25;letter-spacing:0}
.admin-app :is(.admin-section,.admin-territories,.admin-pipeline,.admin-job,.admin-storage-status,.admin-timeline,.admin-estimate) h3{font-size:18px;font-weight:600;line-height:1.3;letter-spacing:0}
.admin-app :is(.admin-section,.admin-territories,.admin-pipeline,.admin-job,.admin-storage-status,.admin-timeline,.admin-estimate) h4{font-size:16px;font-weight:600}
.admin-app .admin-note,.admin-app .admin-map-hover{max-width:820px;margin:8px 0 0;font-size:14px;line-height:1.5;color:#64748b}
.admin-app .admin-notice,.admin-app .admin-attention,.admin-app .admin-empty,.admin-app .admin-explainer{display:block;max-width:820px;margin:12px 0;padding:0;border:0;border-radius:0;background:none;font-size:14px;line-height:1.5;color:#64748b}
.admin-app .admin-attention>svg{display:none}
.admin-app .admin-attention strong,.admin-app .admin-explainer strong{display:block;color:#0f172a;font-weight:500}
.admin-app .admin-error{max-width:820px;margin:12px 0;padding:0;border:0;border-radius:0;background:none;font-size:14px;line-height:1.5;color:#be123c}
.admin-app .admin-state{padding:0;border:0;background:none;font-size:14px;color:#64748b}
.admin-app .admin-state.needs-attention{color:#0f172a;font-weight:500}
.admin-app .admin-stage,.admin-app .admin-stage-ai{padding:20px 0 0;border:0;border-top:1px solid #e2e8f0;border-radius:0;background:none}
.admin-app .admin-stage-number{font-size:14px;font-weight:500;color:#0d9488}
.admin-app .admin-stage .btn-primary,.admin-app .admin-stage .btn-secondary{height:auto;min-height:44px;padding:10px 20px;white-space:normal;text-align:left}
.admin-app .admin-map,.admin-app .admin-atlas-canvas{padding:0;border:0;border-radius:0;background:#fff}
.admin-app .admin-map-legend{gap:6px 20px;padding-top:10px;border-top:0;font-size:12px;color:#64748b}
.admin-app .admin-next{gap:0 24px}
.admin-app .admin-next-link{padding:14px 0;border:0;border-top:1px solid #e2e8f0;border-radius:0;background:none}
.admin-app .admin-next-link:hover{background:none}
.admin-app .admin-next-link:hover strong{color:#0d9488}
.admin-app .admin-next-link>svg:first-child{color:#0d9488}
.admin-app .admin-run-debug-panel{padding:4px 0 4px 16px;border:0;border-left:2px solid #e2e8f0;background:none}
.admin-app .admin-atlas-detail{border-radius:0}
.admin-app .admin-atlas-block blockquote{padding:4px 0 4px 14px;border-left-width:2px;border-radius:0;background:none}
.admin-app .admin-pill{padding:0;border:0;background:none;font-size:14px;color:#64748b}
.admin-app .admin-atlas-flag{margin-left:6px;padding:0;border:0;background:none;font-size:12px;font-weight:500;letter-spacing:0;color:#0d9488}
.admin-app .admin-source-item.is-selected,.admin-app .admin-atlas-row[aria-current=true]{background:#f0fdfa}
.admin-app .admin-quality-stats strong{font-size:22px;font-weight:600}
.admin-app .admin-timeline-retry{font-size:14px;font-weight:500;color:#0d9488;text-decoration:none}
.admin-app .admin-timeline-retry:hover{text-decoration:underline;text-underline-offset:3px}
.admin-app .admin-lands,.admin-app .admin-timeline-table{border:0;border-top:1px solid #e2e8f0;border-radius:0;background:none}
.admin-app .admin-lands thead th,.admin-app .admin-timeline-table thead th,.admin-app .admin-table th{background:#fff;font-size:12px;font-weight:500;color:#64748b}
.admin-app .admin-bar,.admin-app .admin-bar>span{height:8px;border-radius:999px}
.admin-app .admin-bar{background:#f1f5f9}.admin-app .admin-bar>span{background:#0d9488}
.admin-app .admin-share{height:8px;border-radius:999px;background:#f1f5f9}
.admin-app .admin-share i{border-radius:999px;background:#0d9488}
.admin-app .admin-share.is-data i{background:#0f172a}
.admin-app .admin-atlas-stack{height:16px;border-radius:999px;background:#f1f5f9}
.admin-app .admin-job-progress{height:8px;accent-color:#0d9488}
.admin-app .admin-seg{display:inline-flex;gap:16px;border:0;border-radius:0;background:none;overflow:visible}
.admin-app .admin-seg button{min-height:0;padding:4px 0;border:0;border-bottom:2px solid transparent;background:none;font-size:14px;color:#64748b}
.admin-app .admin-seg button:hover{color:#0f172a}
.admin-app .admin-seg button[aria-pressed=true]{border-bottom-color:#0d9488;background:none;color:#0d9488}
.admin-app .admin-chip{min-height:26px;gap:5px;padding:2px 9px;border:1px solid #e2e8f0;border-radius:999px;background:#fff;font-size:12px;font-weight:500;color:#0f172a}
.admin-app .admin-chip i{width:8px;height:8px;border-radius:2px}
.admin-app .admin-chip[aria-pressed=false]{opacity:1;background:#f8fafc;color:#94a3b8}
.admin-app .admin-chip[aria-pressed=false] i{opacity:.4}
.admin-app .admin-chip.is-group{background:#f8fafc}
.admin-app .admin-zoom button{min-width:36px;min-height:36px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#0f172a}
.admin-app .admin-estimate-tag.is-counted,.admin-app .admin-estimate-tag.is-model,.admin-app .admin-estimate-tag.is-assumed{position:relative;padding:0 0 0 12px;border:0;border-radius:0;background:none;font-size:12px;font-weight:500;color:#64748b}
.admin-app .admin-estimate-tag::before{content:"";position:absolute;left:0;top:50%;width:8px;height:8px;margin-top:-4px;border-radius:2px;background:#94a3b8}
.admin-app .admin-estimate-tag.is-counted::before{background:#0d9488}
.admin-app .admin-estimate-tag.is-model::before{background:#0f172a}
.admin-app .admin-estimate-facts{border:0}
.admin-app .admin-estimate-facts>div{border-top-width:2px}
.admin-app .admin-estimate-facts>.is-counted{border-top-color:#0d9488}
.admin-app .admin-estimate-facts>.is-model{border-top-color:#0f172a}
.admin-app .admin-estimate-facts>.is-assumed{border-top-color:#94a3b8}
.admin-app .admin-estimate-key.is-sample{background:#0f172a}
@media(max-width:700px){.admin-app .admin-section,.admin-app .admin-territories,.admin-app .admin-pipeline,.admin-app .admin-job,.admin-app .admin-storage-status,.admin-app .admin-timeline,.admin-app .admin-estimate{margin-top:40px;padding-top:24px}}
```

### 5.6 Änderungen je Datei

| Datei | Änderung |
|---|---|
| `components/admin-todo.tsx` | `<><AdminPageHead page="todo"/><TodoPage embedded/></>` |
| `components/admin-overview.tsx` | <ul><li>`<AdminPageHead page="uebersicht"><StandLine stand={data?.stand} action="Aktualisieren" onAction={reload}/></AdminPageHead>`</li><li>Kennzahlen → `<Kpis label="Abdeckung heute">` (6.3)</li><li>beim Laden und bei `stand.unbuilt>0` `PageSkeleton [['uebersicht.verlauf',300],['uebersicht.reichweite',120],['uebersicht.monate',240],['uebersicht.laender',320],['uebersicht.groesse',240]]`</li><li>alle `<p className="eyebrow">` löschen, h2-Text aus `HELP[id].title`, `<SectionHelp id/>` unter jeder Überschrift, `<SectionTodo id/>` am Ende</li><li>Abschnitt `<section id="begriffe" className="admin-section">` mit `<dl>` aus `TERMS` (statisch, auch beim Laden)</li></ul> |
| `components/admin-processing.tsx` | <ul><li>Kopf + `StandLine action="Aktualisieren"` (Stand aus `summary`, P27a)</li><li>Kennzahlen → `Kpis` (6.4)</li><li>`Choice` → `AdminChoice`; `Input` → `<input className="field-input">`; `Checkbox` → `<input type="checkbox" className="h-4 w-4 accent-teal-600">`</li><li>Knöpfe: `Button` default → `<button className="btn-primary">` (lucide-Symbole in Knöpfen entfallen); `variant="outline"/"ghost"` → `btn-secondary btn-sm`; Beenden/Verwerfen → `btn-danger` mit `confirmDialog`; `variant="link"` → `link-btn`</li><li>Blättern „← Zurück“ / „Weiter →“</li><li>`field-help` unter Filter (`FILTER_HELP[filter]`) und Kartenfarbe (`MAP_HELP[mode]`)</li><li>`title={STATE_HELP[s.state]}`; `month()` → `mm()`</li><li>beim Laden `PageSkeleton [['abruf.gebiete',520],['abruf.stufen',260],['abruf.verlauf',300]]`</li></ul> |
| `components/admin-processing-map.tsx` | Farben (5.4); Legende über `Legend` mit vier Anteilsstufen und Schwellen bei „Anzahl“ (6.4); „Teilbestand“ → „Teilstand“; die Fußnote zur Kartenfarbe entfällt (steht in `MAP_HELP`); BKG-Zeile bleibt |
| `components/admin-timeline.tsx` | Eyebrow weg, `SectionHelp id="abruf.verlauf"`, `Choice` → `AdminChoice`, Kennzahlen → `Kpis`, Farben, `year:'numeric'` → `'2-digit'` (Zeilen 8–9), Fehler → `Alert`; bei `stand.unbuilt>0` `Skeleton` |
| `components/admin-run-debug.tsx` | Wortlaut nach 6.4 („Protokoll“, „Leser“); oben im Panel `How` mit Feld-Erklärungen |
| `components/admin-atlas.tsx` | <ul><li>`StandLine action="Aktualisieren" extra={<> · Gründe aus der Quellensuche vom {short(data.reportDate)}</>}`</li><li>Kennzahlen → `Kpis`; h2 aus HELP + `SectionHelp`/`SectionTodo`</li><li>Chips mit `title={c.why}`; `Choice` → `AdminChoice`</li><li>Farben in `colorOf`; Listenpunkt mit `HATCH_CSS`</li><li>`.admin-pill` → Text „Grund: … · Zugang: …“ mit Farbquadrat</li><li>Blöcke nach 6.5; `day()`/`month()` → `dd()`/`mm()`</li></ul> |
| `components/admin-dashboard.tsx` | <ul><li>Kopf + `StandLine action="Aktualisieren"`; `Kpis` (6.6)</li><li>`.admin-attention` wird eine Zeile mit Links; Eyebrows weg; `SectionHelp`</li><li>Prüfgrund → `AdminChoice` mit `help={REVIEW_HELP[issue]}`; Gebiet → `AdminAreaPick`</li><li>beim Laden `PageSkeleton [['qualitaet.inhalt',320],['qualitaet.importe',240],['qualitaet.vollstaendig',160],['qualitaet.pruefung',240],['qualitaet.betrieb',200]]`</li></ul> |
| `components/database-admin.tsx` | natives `<select>` → `AdminAreaPick`; Tabelle `admin-table`, Spalte „Pflichtangabe“ mit `title={FIELD_HELP[f.id]}`; darunter `How` „Was bedeuten die Pflichtangaben?“; Knöpfe `btn-secondary btn-sm` |
| `components/admin-quality-check.tsx` | Eyebrow weg, `SectionHelp id="qualitaet.pruefung"`; Erklärung `QUALITY_EXPLAIN[c.id] ?? c.explain`; „veraltet“ mit `title`; Knöpfe `btn-secondary btn-sm` |
| `components/admin-forecast.tsx` | `<AdminPageHead page="hochrechnung"/>` + `<AdminEstimate/>` |
| `components/admin-estimate.tsx` | Eyebrow weg; `StandLine stand={d.stand} busy={busy} onAction={compute}`; `Kpis`, darunter die Kurzfassung (6.8); Farben; `day()` → `dd()` |
| `components/admin-keywords.tsx` | Kopf + `StandLine action="Neu zählen"`; `Kpis`; Eyebrows weg; `SectionHelp`; `Choice` → `AdminChoice` |
| `components/admin-activation.tsx` | Eingabe `field-input`, Knopf `btn-primary` |

Hinweise zu langen Zeilen: `admin-estimate.tsx` hat 56 Zeilen über 300 Zeichen, `admin-atlas.tsx` 33, `admin-processing.tsx` 21. Dort nur mit `grep -n -o` suchen.

### 5.7 Zustände jeder Ansicht

| Zustand | Erkennung | Anzeige |
|---|---|---|
| Lädt | `data` fehlt, kein Fehler | Kopfband mit `StandLine stand={undefined}`; `Kpis` mit `value: undefined`; `PageSkeleton` (Überschriften, Unterzeilen und „Wie wird gezählt?“ sofort lesbar) |
| Erstes Füllen | `stand.unbuilt>0` | „Vorberechnung läuft: {done} von {total} Gebieten“; graue Flächen statt Zahlen aus `region_series` |
| Noch nie berechnet | `stand.computedAt===null` | Text 6.2 `zustand.nie`, Knopf `.btn-primary` „Jetzt berechnen“ |
| Daten da | – | `StandLine`, Inhalte normal |
| Veraltet | `stand.stale` | „Stand … · ≈ N geänderte Datensätze seither“ bzw. „… werden nachgerechnet“; keine Farbe, kein Kasten |
| Wird neu berechnet | `busy` oder `stand.build.state==='running'` | Knopf „Wird berechnet …“; Inhalt bleibt mit `opacity-60 transition-opacity` sichtbar |
| Fehler ohne Daten | `error && !data` | `<Alert onRetry>` mit `zustand.fehler`; Skelett bleibt |
| Fehler mit Daten | `error && data` | `<Alert>` mit `zustand.fehlerNeu` |

### 5.8 Doku-Anpassungen (P40)

`components/ratsmonitor/FRONTEND.md`:
- Zeile 46: „`app/analyse-admin.css`: Admin-Teil im Startseiten-Design, Block am Dateiende; ältere Admin-Regeln nicht erweitern.“
- Dateikarte: „Adminbereich: Rahmen `components/admin-chrome.tsx`, Bausteine `components/admin-ui.tsx`, Stand `components/admin-stand.tsx`, Speicher `components/admin-store.ts`, Nachholen `components/admin-catch-up.tsx`, Texte `components/admin-texts.ts`, Farben `components/admin-colors.ts`.“

### 5.9 Abnahme Design (je Seite bei 375 und 1440 px)

- Logo, Reitertext, Pfadzeile und Inhalt beginnen bei x=16.
- Kein `box-shadow` und kein Rahmen um die Seite; Hintergrund `#fff`.
- h1 28 bzw. 44 px; h2 22 px; im berechneten Stil nur 12/14/16/18/22/28/44 px.
- Akzent nur `#0d9488`; kein Kobalt `#2352ad`, keine Links in `rgb(35,82,173)`.
- Hauptaktion schwarze Pille mit „→“, Nebenaktion Petrol-Text; Stufen-Knöpfe mindestens 44 px hoch.
- Aktiver Reiter Schwarz/500; mobil waagrecht scrollbar ohne Seitenscroll.

---

## 6. Erklärtexte

**Platzierung:**

| Ort | Form | Quelle |
|---|---|---|
| Einleitung im Kopfband | 1–2 Sätze „Zeigt, …“, 16 px grau | `PAGE_HEAD` |
| Unter jeder h2 | genau 1 Satz: was die Grafik zählt, 14 px grau | `HELP[id].sub` |
| Darunter, zugeklappt | „Wie wird gezählt?“ bzw. „Wie lese ich das?“ | `HELP[id].how` |
| Abschnittsende | „Was tun?“ als Petrol-Links mit „→“ | `HELP[id].todo` |
| Kennzahl | `dt` Begriff, `dd` Wert, Notiz 12 px; `title` | `Kpis` |
| Tabellenspalte | `<th title>`, dazu 12-px-Fußzeile unter der Tabelle | `COL_HELP` |
| Zustand, Chip, Marke | `title` | `STATE_HELP`, `JOB_STATE_HELP`, Kategorie `why` |
| Auswahlfeld | `field-help` unter dem Feld | `FILTER_HELP`, `MAP_HELP`, `REVIEW_HELP` |
| Fachwort | Glossar „Begriffe“ am Ende der Übersicht | `TERMS` |

**Schreibregeln:**
- „Sie“; „Stand“; Datum „08.10.26“.
- „Bericht“ statt „Artikel“; „Sachgebiet“ statt „Label“; „Leser“ statt „Baustein“; „Protokoll“ statt „Debug-Infos“; „Teilstand“ statt „Teilbestand“.
- Keine englischen Wörter, wo es ein deutsches gibt.

### 6.1 Seitenköpfe (`PAGE_HEAD`) und Fußzeilen (`FOOT`)

| Seite | h1 | Einleitung | Stand-Zeile | Fußzeile |
|---|---|---|---|---|
| todo | To-do-Liste | Alles, was vor dem Start noch zu tun ist. Abhaken, Termin eintragen, speichern; erledigte Einträge bleiben in der Liste. | – | Gespeichert wird in docs/todo/todos.json, nur am lokalen Dev-Server. |
| uebersicht | Übersicht | Zeigt, wie viele Gebiete und Einwohner Plenara erreicht: wo eine lesbare Quelle bekannt ist, wo schon Berichte gespeichert sind, wie weit sie zurückreichen und wie aktuell sie sind. | Stand … · Aktualisieren → | Zahlen aus Quellenkatalog und Datenbank. Doppelt gelieferte Berichte, die zu einem Vorgang zusammengeführt wurden, zählen einmal. |
| abruf | Abruf & Verarbeitung | Zeigt je Gebiet, was gespeichert und aufbereitet ist, und startet die drei Stufen: Berichte abrufen, nach festen Regeln einordnen, mit KI aufbereiten. Jede Stufe startet nur auf Klick. | Stand … · Aktualisieren → | Doppelt gelieferte Berichte zählen einmal. Seitenaufrufe starten keinen Abruf. |
| atlas | Lückenatlas | Zeigt für alle Gebiete Deutschlands, ob Plenara ihre Ratsinformationen lesen kann, und wenn nicht, warum – mit dem nächsten Schritt, der die Lücke schließen könnte. | Stand … · Gründe aus der Quellensuche vom 06.10.26 · Aktualisieren → | Anbindung und Gründe aus Quellenkatalog und Quellensuche, Berichte und Abrufe aus der Datenbank. Karten: © BKG (2026), dl-de/by-2-0. |
| qualitaet | Qualität & Betrieb | Zeigt, wo der Bestand einen zweiten Blick braucht: fehlende Einordnung, unklare Verfahrensstände, Doppelungen und Defekte. Dazu die letzten Abrufe, die Datensicherung und was technisch eingerichtet ist. | Stand … · Aktualisieren → | Zahlen aus der Datenbank; doppelt gelieferte Berichte zählen einmal. Technische Prüfungen ersetzen keine fachliche Bewertung. |
| hochrechnung | Hochrechnung | Schätzt, wie viele Berichte alle kommunalen Gremien in Deutschland pro Tag erzeugen und wie viel Text das ist. Grundlage für die Abschätzung der KI-Kosten. | Stand … · Neu berechnen → | Die Hochrechnung liest nur den gespeicherten Bestand und startet keinen Abruf. |
| stichwoerter | Stichwörter | Zeigt, an welchen Wörtern die festen Regeln Sachgebiete erkennen, welche Begriffe in den Titeln stehen und welche Stichwörter die KI vergibt. Die Seite zählt nur, was schon gespeichert ist. | Stand … · Neu zählen → (`hint`: „Liest alle Berichte; kann einige Minuten dauern.“) | Die Seite zählt nur, was frühere Schritte gespeichert haben; sie startet keine Analyse. |

### 6.2 Allgemeine Zustandstexte

| ID | Text |
|---|---|
| zustand.nie | Für diese Seite ist noch kein Stand gespeichert. Die Berechnung liest alle gespeicherten Berichte einmal; danach öffnet sich die Seite sofort. [Jetzt berechnen] |
| zustand.erstes | Vorberechnung läuft: {done} von {total} Gebieten. Die Zahlen erscheinen, sobald alle Gebiete berechnet sind. |
| zustand.fehler | Die Zahlen konnten nicht geladen werden. Es werden keine geschätzten Werte angezeigt. [Erneut laden] |
| zustand.fehlerNeu | Neu berechnen ist fehlgeschlagen: {Fehler}. Angezeigt bleibt der Stand vom {stand}. |
| zustand.veraltet (`title` an „≈ N geänderte Datensätze seither“) | Seit der Berechnung wurden Berichte gespeichert oder geändert. Die Zahlen stimmen für den genannten Stand; „Neu berechnen“ holt den Rest nach. |
| zustand.nachrechnen (Zeile im Rahmen) | Kennzahlen für {n} Gebiete werden nachgerechnet … |
| zustand.ohne0016 | Vorberechnung noch nicht eingerichtet (Migration 0016 fehlt). |

### 6.3 Übersicht

**Kennzahlen** (`Kpis label="Abdeckung heute"`):

| Begriff | Wert | Notiz |
|---|---|---|
| Gebiete angebunden | `connected.areas` / `total.areas` | {pct} aller Gebiete haben eine Quelle, die Plenara lesen kann |
| Einwohner erreicht | pct | {mio} von {mio} Einwohnern, gezählt auf Gemeindeebene |
| Gebiete mit Berichten | `data.areas` / `total.areas` | {pct} · {n} Berichte gespeichert |
| Einwohner mit Berichten | pct | {mio} Einwohner in Gebieten mit gespeicherten Berichten |

Fußnote unter den Kennzahlen (14 px grau; geprüft gegen `shared/coverage.mjs:12-20`): „Einwohner zählen nur bei Städten, Gemeinden und Gemeindeverbänden; ein Kreis umfasst seine Gemeinden. Ist nur der Kreis angebunden, zählen seine Einwohner hier nicht mit.“

**Abschnitte:**

| ID | title (h2) | sub | how | todo |
|---|---|---|---|---|
| uebersicht.verlauf | Wie hat sich die Abdeckung entwickelt? | Petrol: Gebiete mit lesbarer Quelle. Schwarz: Gebiete, aus denen schon Berichte gespeichert sind. Der Abstand zwischen beiden Linien sind angebundene Gebiete ohne Berichte. | 1. „Quelle angebunden“ folgt dem Quellenkatalog: ein Punkt je Änderung des Katalogs, jeweils gezählt gegen den heutigen Katalog. „Arbeitsstand“ in der Tabelle sind Änderungen, die noch nicht in Git übernommen sind. 2. „Mit gespeicherten Berichten“ zählt ein Gebiet ab dem Tag, an dem sein erster Bericht gespeichert wurde. Dieses Datum gibt es erst seit Oktober 2026; früher gespeicherte Gebiete zählen ab dem ersten Tag der Reihe. 3. Einwohner zählen nur auf Gemeindeebene. | Angebundene Gebiete ohne Berichte abrufen (`abruf`, `filter=empty`) |
| uebersicht.reichweite | Wie weit zurück und wie aktuell sind die Berichte? | Je angebundenem Gebiet: wie weit die gespeicherten Berichte zurückreichen und wann die jüngste Sitzung war. Der Umschalter zählt nach Gebieten oder nach Einwohnern. | 1. Rückreichweite: Tage von der ältesten Sitzung mit gespeichertem Bericht bis heute. Stufen ab 25, 80, 165, 330 und 700 Tagen; die Grenzen liegen etwas unter vollen Monaten, weil ein Abruf „12 Monate rückwirkend“ knapp unter einem Jahr beginnt. 2. Eine kurze Rückreichweite heißt meist nur, dass mit kurzem Zeitraum abgerufen wurde, nicht, dass die Quelle Lücken hat. 3. Aktualität: Tage seit der jüngsten Sitzung mit gespeichertem Bericht. „Sitzung angekündigt“: Die jüngste gespeicherte Sitzung liegt in der Zukunft. Über 90 Tage ohne Sitzung: Das Gremium ruht, oder der Abruf bringt nichts Neues. 4. „Keine Berichte“: angebunden, aber noch nichts gespeichert. | Gebiete unter 3 Monaten abrufen (`filter=shallow`) · Seit über 90 Tagen ohne Sitzung (`filter=quiet`) · Rückreichweite auf der Karte (`atlas`, `farbe=reach`) |
| uebersicht.monate | Aus welchen Monaten stammen die Berichte? | Balken (linke Skala): Berichte je Monat, in dem sie erstmals auf einer Tagesordnung standen. Linie (rechte Skala): Gebiete mit mindestens einem solchen Bericht im Monat. Die letzten 24 Monate. | howLabel „Wie lese ich das?“: 1. Der linke Rand zeigt, wie weit die Abrufe zurückreichen. Einbrüche im Sommer sind Sitzungspausen. Monate nach dem heutigen enthalten bereits angekündigte Sitzungen. 2. Berichte ohne gültigen Sitzungstag (fehlend oder fehlerhaft) fehlen im Diagramm; ihre Zahl steht darunter. | – |
| uebersicht.laender | Abdeckung nach Bundesland | Je Land: wie viele Gebiete eine lesbare Quelle haben und aus wie vielen schon Berichte gespeichert sind. Prozent: Anteil an allen Gebieten bzw. Einwohnern des Landes. | – | Offene Gebiete im Lückenatlas (`atlas`) |
| uebersicht.groesse | Erreichen wir große und kleine Gebiete gleich gut? | Dieselben Zahlen nach Einwohnerzahl des Gebiets. Kreise stehen für sich und zählen keine eigenen Einwohner. | Kleine Gemeinden haben oft kein eigenes Ratsinformationssystem und veröffentlichen nur im Amtsblatt oder auf ihrer Website; dort sind niedrige Werte zu erwarten. | – |
| uebersicht.weiter | Als Nächstes | – | – | (die drei Links unten) |
| uebersicht.begriffe | Begriffe | Die Fachwörter der Adminseiten, kurz erklärt. | – | – |

Notizen mit Zahlen (im JSX):
- Reichweite: „{deep} Gebiete reichen mindestens ein Jahr zurück, {shallow} weniger als drei Monate.“
- Aktualität: „{current} Gebiete hatten in den letzten 30 Tagen eine Sitzung oder haben eine angekündigt, {quiet} seit über 90 Tagen keine.“
- Monate: „{undated} Berichte ohne gültigen Sitzungstag (fehlend oder fehlerhaft) sind nicht enthalten.“ (`undated` zählt beides, `admin-timeline.mjs:27`)
- Verlauf: „{undatedAreas} Gebiete wurden vor Oktober 2026 gespeichert und zählen ab dem ersten Tag der Reihe.“

Links „Als Nächstes“:
- „{n} offene Gebiete: warum, und was sie schließen könnte“ (Atlas)
- „Angebundene Gebiete ohne Berichte abrufen“ (ohne Zahl, siehe 6.14 Nr. 1)
- „Prüfliste, letzte Abrufe, Datenbank“ (Qualität)

`COL_HELP` (Länder- und Größentabelle). Fußzeile unter der Tabelle: „Balken: Petrol = angebunden, Schwarz = mit Berichten.“

| Spalte | Text |
|---|---|
| Gebiete | Städte, Gemeinden, Gemeindeverbände und Kreise im Katalog. |
| Angebunden | Gebiete mit einer Quelle, die Plenara lesen kann; Balken = Anteil. |
| Mit Berichten | Gebiete mit mindestens einem gespeicherten Bericht. |
| Einwohner angebunden | Anteil der Einwohner (Gemeindeebene), die in einem angebundenen Gebiet leben. |
| Einwohner mit Berichten | Anteil der Einwohner (Gemeindeebene) in Gebieten mit gespeicherten Berichten. |

Legende „Sitzungen je Monat“: „Berichte“ (Petrol), „Gebiete mit Berichten im Monat“ (Schwarz).

### 6.4 Abruf & Verarbeitung

**Kennzahlen:**

| Begriff | Wert | Notiz | title |
|---|---|---|---|
| Berichte gespeichert | `counts.online` | Doppelungen einmal gezählt · Revision {n} | Revision: laufende Nummer des Datenbestands; sie steigt mit jedem Speichern, auch bei einem Abruf ohne neue Berichte. |
| Gebiete mit Berichten | n / alle | {n} angebunden · davon {n} noch ohne Berichte | – |
| Letzter Abruf fehlgeschlagen | n | Gebiete; die zuvor gespeicherten Berichte bleiben erhalten | – |
| Ihre Auswahl | n | {n} Berichte · {n} ohne angebundene Quelle; sie erscheinen im Auftrag als „Keine Quelle“ | – |

**Abschnitte:**

| ID | title | sub | how | todo |
|---|---|---|---|---|
| abruf.gebiete | Gebiete auswählen | Auf der Karte oder in der Liste anklicken. Die Filter grenzen die Liste ein; „Alle Treffer auswählen“ übernimmt die ganze gefilterte Liste, etwa ein Land oder alle angebundenen Gebiete ohne Berichte. | howLabel „Wie lese ich die Liste?“: 1. Zustand: Ergebnis des letzten Abrufs; mit der Maus darauf zeigen für die Erklärung. 2. Übernahme: letzter Abruf, dessen Ergebnis gespeichert wurde. Letzter Versuch: letzter Abruf überhaupt, auch wenn er scheiterte. 3. Sitzungen: älteste bis jüngste Sitzung mit gespeichertem Bericht. | – |
| abruf.stufen | Drei Stufen, jede startet nur auf Klick | Stufe 01 holt Berichte aus den Quellen, Stufe 02 ordnet sie nach festen Regeln ein, Stufe 03 erarbeitet Inhalte mit KI. Seitenaufrufe lesen nur den Status. | howLabel „Wie läuft ein Auftrag?“: 1. Ein Abruf liest bis zu 24 Gebiete gleichzeitig, höchstens zwei auf demselben Server, die Server mit den meisten Gebieten zuerst. 2. Die Einordnung nach Regeln läuft in Paketen von 500 Berichten, bei „alle offenen Berichte“ über alle Gebiete hinweg, bei einer Auswahl Gebiet für Gebiet; jedes Paket wird sofort gespeichert. 3. Schließen der Seite pausiert nach den laufenden Schritten; „Auftrag fortsetzen“ macht dort weiter. | – |
| abruf.auftrag | (dynamisch, siehe unten) | (dynamische Fortschrittszeile) | howLabel „Was bedeuten die Zustände?“: alle `JOB_STATE_HELP` als Liste | – |
| abruf.kiauftrag | KI-Auftrag | (dynamisch) | – | – |
| abruf.verlauf | Wie viele Berichte sind gespeichert, wie viele kommen hinzu? | Bestand und Zulauf der gespeicherten Berichte, für die Auswahl auf der Karte oder für alle Gebiete. | 1. Zeitbezug „Erste Beratung“: Ein Bericht zählt an dem Tag, an dem er erstmals auf einer Tagesordnung stand. „Aufnahme in die Datenbank“: an dem Tag, an dem Plenara ihn zuerst gespeichert hat; dieses Datum gibt es erst seit Oktober 2026. 2. Neu pro Woche = neu pro Tag × 7; hochgerechnet pro Jahr = neu pro Tag × 365. Der Jahreswert stimmt nur, wenn alle Gebiete der Auswahl für den ganzen Zeitraum abgerufen sind; sonst ist er zu niedrig. | Gebiete mit kurzer Rückreichweite (`filter=shallow`) |

Titel des Auftrags-Abschnitts:
- „Abrufauftrag · {Zeitraum} rückwirkend“
- „Abruf aller Quellen in Deutschland · {Zeitraum} rückwirkend“
- „Einordnung nach Regeln · alle offenen Berichte“
- Status: „Läuft“ / „Pausiert – wartet auf Ihren Start“ / „Beendet“

**Stufen** (im JSX):
- **01 Amtliche Daten abrufen:** Text bleibt.
- **02 Nach Regeln einordnen:**
  - Text: „Feste Regeln ordnen jeden Bericht anhand seines amtlichen Titels einem Sachgebiet zu und zerlegen den Titel in Begriffe für den Vergleich zwischen Gebieten. Ohne KI, ohne Kosten. Jedes Paket von 500 Berichten wird sofort gespeichert; Sie können jederzeit pausieren und später dort fortsetzen.“
  - Fortschritt: „{a} von {b} Berichten nach Regeln bearbeitet“, Kleintext „{c} offen · gilt für den ganzen Bestand, nicht nur für Ihre Auswahl“.
  - Knopf „Alle offenen Berichte einordnen“; Nebenaktion „Nur die Auswahl: {n} offene Berichte in {m} Gebieten“.
- **03 KI-Inhalte erarbeiten:**
  - Text: „Ein KI-Agent Ihrer Wahl liest die Originalunterlagen der Auswahl. Sie laden den Auftrag herunter, starten ihn selbst in Ihrem Projekt und lesen das Ergebnis hier wieder ein.“
  - Schritte: „KI-Zusammenfassung“, „KI-Sachgebiet aus dem Inhalt“, „Zehn gewichtete Stichwörter“, je „{a} von {b} gespeichert · {c} ohne ausreichende Quelle“.
  - `How` mit dem Titel „Was heißt „ohne ausreichende Quelle“?“: „Ein früherer Versuch fand zu wenig lesbaren Text, etwa nur einen Titel oder einen Scan. Diese Berichte werden erst wieder angefordert, wenn sich ihre Quelldaten ändern – oder mit dem Haken „erneut versuchen“, der nur nach einer Änderung am Verfahren sinnvoll ist.“
  - Auswahl „Berichte je KI-Auftrag“: „10 · Testlauf“, „25 Berichte“, „50 Berichte“, „100 Berichte“, „Alle offenen Berichte“.
  - Haken: „Berichte ohne ausreichende Quelle erneut versuchen“.
  - Kleintext: „Je Bericht werden nur die fehlenden Schritte angefordert, zuerst nie exportierte Berichte. Ein offener Auftrag reserviert seine Berichte bis zur Übernahme oder zum Verwerfen.“
  - KI-Auftrag, Hinweis „prepared“: „Reserviert – der Download allein ist keine erfolgreiche Bearbeitung. Geben Sie den Auftrag an Ihren KI-Agenten und lesen Sie die Ergebnisse hier ein; mehrere Teildateien sind möglich. Solange Berichte fehlen, bleibt der Auftrag offen.“

**Rückfragen** (`confirmDialog`):

| Aktion | title | text | confirmLabel |
|---|---|---|---|
| Alle Quellen abrufen | Alle angebundenen Quellen abrufen? | Der Abruf liest {n} Gebiete und belegt die Datenbank, solange er läuft. Sie können jederzeit pausieren; Gespeichertes bleibt. | Abruf starten |
| Auftrag beenden | Offenen Auftrag beenden? | Bereits Gespeichertes bleibt erhalten; noch nicht begonnene Gebiete werden nicht mehr abgerufen. | Beenden |
| KI-Auftrag verwerfen | KI-Auftrag verwerfen? | Die reservierten Berichte werden wieder frei, stehen aber hinter bisher nicht exportierten Berichten. Vorhandene Analyseergebnisse bleiben erhalten. | Verwerfen |

**Filter** (`FILTERS` in `app/admin/page.tsx` und `components/admin-processing.tsx:31`, dazu `FILTER_HELP`):

| Wert | Name | Hilfe |
|---|---|---|
| all | Alle Gebiete | Alle Gebiete des Katalogs. |
| connected | Mit angebundener Quelle | Gebiete mit einer Quelle, die Plenara lesen kann. |
| data | Mit Berichten | Gebiete mit mindestens einem gespeicherten Bericht. |
| empty | Angebunden, ohne Berichte | Quelle bekannt, aber noch kein Bericht gespeichert – Kandidaten für einen ersten Abruf. |
| issues | Mit Hinweisen oder Lücken | Letzter Abruf gescheitert oder unvollständig, seit 7 Tagen keine neue Übernahme, noch keine Berichte, oder der Abruf hat Hinweise gespeichert. |
| partial (neu) | Teilstand | Berichte gespeichert, aber der letzte Abruf hat nicht alles gelesen. |
| stale (neu) | Älter als 7 Tage | Die letzte erfolgreiche Übernahme ist mehr als 7 Tage her. |
| failed (neu) | Letzter Abruf fehlgeschlagen | Der letzte Abruf endete mit einem Fehler; Gespeichertes bleibt. |
| shallow | Berichte reichen unter 3 Monate zurück | Angebunden, mit Berichten, deren älteste Sitzung weniger als 80 Tage zurückliegt. |
| quiet | Seit über 90 Tagen keine Sitzung | Angebunden, mit Berichten, aber seit über 90 Tagen keine gespeicherte Sitzung. |
| selected | Ausgewählt | Nur die ausgewählten Gebiete. |

**Kartenfarbe** (`MAP_HELP` + Legende):

| Wert | Name | Hilfe | Legende |
|---|---|---|---|
| coverage | Zustand des letzten Abrufs | Farbe = Ergebnis des letzten Abrufs. Teilstand: Berichte gespeichert, aber der letzte Abruf hat nicht alles gelesen; bei 12 und 24 Monaten setzt ein neuer Abruf mit demselben Zeitraum dort fort. | Berichte, keine Lücke gemeldet · Teilstand · Letzter Abruf fehlgeschlagen · Angebunden, ohne Berichte (Schraffur) · Nicht angebunden |
| reach | Rückreichweite | Älteste Sitzung mit gespeichertem Bericht. Eine kurze Reichweite heißt meist ein Abruf mit kurzem Zeitraum, keine lückenhafte Quelle. Schraffur: angebunden, noch ohne Berichte. | Stufen aus `REACH_BUCKETS` · Schraffur · Nicht angebunden |
| fresh | Jüngste Sitzung | Jüngste Sitzung mit gespeichertem Bericht. Liegt sie lange zurück, ruht das Gremium oder der Abruf bringt nichts Neues. Schraffur: angebunden, noch ohne Berichte. | Stufen aus `FRESH_BUCKETS` · Schraffur · Nicht angebunden |
| access | Zugang (OParl, API, HTML, Sperren) | Wie Programme an die Daten kommen: OParl (genormte Schnittstelle), andere Schnittstelle (API) oder öffentliche HTML-Seiten. robots.txt wird nur festgehalten. | Zugangsstufen |
| count | Anzahl Berichte | Zahl der gespeicherten Berichte, gestaucht dargestellt (logarithmisch), damit auch kleine Gebiete sichtbar bleiben. Schraffur: keine Berichte. | bis {e(.2)} · bis {e(.5)} · bis {e(.8)} · mehr · keine (Schraffur); `e=t=>Math.round(10**(t*most)-1)`, `most` wie `admin-processing-map.tsx:28` |
| rules | Anteil nach Regeln bearbeitet | Anteil der Berichte des Gebiets, die diesen Schritt fertig haben. Schraffur: keine Berichte. | bis 20 % · über 20 bis 50 % · über 50 bis 80 % · über 80 % · keine Berichte |
| summary | Anteil mit KI-Zusammenfassung | wie rules | wie rules |
| aiLabel | Anteil mit KI-Sachgebiet aus dem Inhalt | wie rules | wie rules |
| keywords | Anteil mit zehn KI-Stichwörtern | wie rules | wie rules |

**Zustände je Gebiet** (`STATE_HELP`; Schlüssel sind die neuen Texte aus `shared/admin.mjs`, 6.13):

| Zustand | title |
|---|---|
| Abruf fehlgeschlagen | Der letzte Abruf endete mit einem Fehler. Die zuvor gespeicherten Berichte bleiben erhalten. |
| Nicht angebunden | Für das Gebiet ist keine lesbare Quelle eingetragen. |
| Ohne Berichte | Quelle bekannt, aber noch kein Bericht gespeichert. |
| Teilstand | Berichte gespeichert, aber der letzte Abruf hat nicht alles gelesen. |
| Älter als 7 Tage | Die letzte erfolgreiche Übernahme ist mehr als 7 Tage her. |
| Ohne gemeldete Lücke | Der letzte Abruf meldete weder Fehler noch Lücke. Das beweist nicht, dass die Quelle vollständig ist. |

Listenzeile: „Übernahme {stand} · Letzter Versuch {stand} · Sitzungen {mm} bis {mm}“. „Übernahme“ und „Letzter Versuch“ bekommen `title` aus dem Glossar.

Aufklappbereich „Verarbeitung & Quellenhinweise“:
- Zeilen: „Nach Regeln bearbeitet“, „KI-Zusammenfassung“, „KI-Sachgebiet aus dem Inhalt“, „Zehn KI-Stichwörter aus dem Inhalt“, je „x / y“.
- Kleintext: „Die drei KI-Zahlen zählen nur, was aus dem Inhalt der Unterlagen entstand; der frühere Titeltest zählt hier nicht.“
- Hinweise: „Hinweise: Der Abruf meldet, dass etwas fehlt oder nicht gelesen wurde. Warnungen: Auffälligkeiten, die den Abruf nicht unvollständig machen.“ (prüfen, Abschnitt 7)
- Leer: „Keine Abrufhinweise gespeichert. Das bestätigt keine vollständige Quelle.“

**Auftrag** (`JOB_STATE_HELP`):

| Zustand | title |
|---|---|
| Ausstehend | Noch nicht begonnen. |
| Läuft | Wird gerade gelesen oder eingeordnet. |
| Gespeichert | Fertig, Ergebnis gespeichert. |
| Teilstand gespeichert | Ein Teil ist gespeichert; ein neuer Auftrag mit demselben Zeitraum setzt fort. |
| Fehlgeschlagen | Mit Fehler beendet; vorher Gespeichertes bleibt. Den Grund zeigt das Protokoll des letzten Abrufs. |
| Keine Quelle | Gebiet ohne angebundene Quelle; übersprungen. |
| Ausgang prüfen | Die Antwort ist unterwegs abgebrochen, etwa durch ein Zeitlimit. Ob etwas gespeichert wurde, zeigt die Gebietsliste nach „Aktualisieren“. |
| Beendet | Auftrag beendet; Gespeichertes bleibt. |

**Verlauf, Kennzahlen:**

| Begriff | Notiz |
|---|---|
| Bestand | Berichte bis heute; dazu {n} für schon angekündigte Sitzungen |
| Neu pro Tag | Durchschnitt über {n} Kalendertage · {x} an den {n} Tagen mit Zulauf |
| Neu pro Woche | pro Tag × 7 · Spitzenwoche ab {dd}: {n} |
| Hochgerechnet pro Jahr | pro Tag × 365 · Spitzentag {dd}: {n} |

Zeitbezug-Auswahl: „Erste Beratung (Sitzungsdatum)“ und „Aufnahme in die Datenbank“. Die zweite bekommt `help`: „Zeigt, wann Plenara Berichte geholt hat, nicht wann sie entstanden.“

**Protokoll** (`admin-run-debug.tsx`; alle Vorkommen von „Debug-Infos“ ersetzen):
- Knopf „Protokoll des letzten Abrufs“ / „Protokoll ausblenden“.
- Fehler: „Das Protokoll konnte nicht geladen werden.“
- aria-label „Protokoll: {Name}“; Feld „Zeitraum · Leser“.
- `How` „Was bedeuten die Angaben?“:
  - „Leser: das Programm für diese Art Ratsinformationssystem.“
  - „Unverändert übersprungen: Sitzungen, die sich seit dem letzten Abruf nicht geändert haben, werden nicht erneut gelesen.“
  - „Wartezeit: Summe aller Antwortzeiten; Anfragen laufen teils gleichzeitig, deshalb kann sie länger sein als der Abruf.“
  - „Art: Seitentyp, aus der Adresse gelesen. SessionNet und ALLRIS benennen Seiten mit Kürzeln, z. B. si = Sitzungen, to = Tagesordnung, vo = Vorlagen; „oparl“ = OParl-Schnittstelle; „api …“ = Schnittstelle der Anwendung.“
- Fußzeile bleibt: „Aufgezeichnet wird der jeweils letzte Abruf eines Gebiets; ältere Läufe stehen mit ihren Kennzahlen darunter.“

### 6.5 Lückenatlas

**Kennzahlen:**

| Begriff | Notiz |
|---|---|
| Gebiete angebunden | {pct} · einschließlich eingeschalteter Quellen, deren erste Prüfung aussteht |
| Einwohner erreicht | {mio} von {mio} auf Gemeindeebene |
| Gebiete offen | {mio} Einwohner auf Gemeindeebene · ohne lesbare Quelle |
| Mit gespeicherten Berichten | {n} Berichte in der Datenbank |

Ladetext: „Alle Gebiete werden mit Anbindung, Grund und Berichtsstand geladen …“

**Abschnitte:**

| ID | title | sub | how | todo |
|---|---|---|---|---|
| atlas.anbindung | Stand der Anbindung | Jedes Gebiet hat genau einen Grund. Ein Klick auf den Balken oder ein Kästchen zeigt nur diese Gebiete in Karte und Liste. | 1. „Angebunden“ und „Eingeschaltet, Live-Prüfung ausstehend“ sind keine Lücken; alle anderen Gründe sind offene Gebiete. 2. Was ein Grund bedeutet und was ihn behebt, steht beim einzelnen Gebiet: in Karte oder Liste anklicken. | – |
| atlas.zugang | Bekommen wir Daten, und auf welchem Weg? | Ja: wird gelesen. Noch nicht: ein Leser fehlt. Nein: technische Sperre oder nichts gefunden. | OParl ist die genormte Schnittstelle für Ratsinformationen und am zuverlässigsten. „Schnittstelle (API)“: eine andere Schnittstelle der Anwendung. „HTML-Seiten“: Plenara liest die öffentlichen Webseiten. robots.txt wird beim Gebiet festgehalten, seit dem 05.10.26 aber nicht mehr befolgt; technische Sperren werden beachtet. | – |
| atlas.reichweite | Wie weit zurück reichen die Berichte? | Älteste Sitzung mit gespeichertem Bericht, je angebundenem Gebiet. Ein Klick filtert Karte und Liste. | wie `uebersicht.reichweite` Punkte 1, 2 und 4 | – |
| atlas.aktualitaet | Wie aktuell sind die Berichte? | Jüngste Sitzung mit gespeichertem Bericht, je angebundenem Gebiet. Ein Klick filtert Karte und Liste. | wie `uebersicht.reichweite` Punkte 3 und 4 | – |
| atlas.verfahren | Was die Leseverfahren liefern | Je Leseverfahren: wie viele angebundene Gebiete es liest und was dabei herauskommt. | 1. Median je Gebiet: Die Hälfte der Gebiete mit Berichten hat weniger, die Hälfte mehr. 2. „Ab 1 Jahr zurück“: älteste Sitzung mindestens 330 Tage zurück; Anteil an allen Gebieten des Verfahrens. 3. Viele Teilstände oder Fehlschläge bei einem Verfahren deuten auf ein Problem im Leser. Wenig „ab 1 Jahr zurück“ heißt meist: nur mit kurzem Zeitraum abgerufen. | Gebiete mit fehlgeschlagenem Abruf (`abruf`, `filter=failed`) |

**Karte:**
- Umschalter: „Anbindung · Zugang · Berichte · Reichweite · Aktualität“.
- Hilfszeile bleibt: „Mausrad oder Plus/Minus zoomt, Ziehen verschiebt, Klick zeigt das Gebiet.“
- Legende „Berichte“: „Berichte gespeichert · Teilstand · Letzter Abruf fehlgeschlagen · Angebunden, ohne Berichte (Schraffur) · Nicht angebunden“.

**Liste:**
- „Betreiber oder Rechner“ → „Betreiber (Adresse des Systems)“, `help`: „Internetadresse, unter der das gefundene System läuft; nur offene Gebiete, ab 3 Gebieten. Viele offene Gebiete beim selben Betreiber: Eine Freischaltung oder ein Leser öffnet sie alle.“
- Markierung „Neuprüfung“, `title`: „Seit der letzten Prüfung gibt es einen neuen Leser oder bessere Suchregeln; das Gebiet sollte neu geprüft werden.“

**Gebietsdetail:**
- Felder (`dt` mit `title`):
  - „Gemeindeschlüssel“ (title „Amtlicher Gemeindeschlüssel (AGS)“)
  - „Verfahren“ (title „Leseverfahren, dahinter der Zugangsweg, wenn er abweicht“)
  - „Freigabe“ (title „Datum der schriftlichen Zustimmung von Gemeinde oder Betreiber“)
  - „Geprüft“ (title „Tag der letzten Prüfung der Quelle“)
- Blöcke:
  - „Grund laut Quellensuche“ (statt „Prüfbericht“)
  - „Warum diese Lücke besteht“ bzw. „Was das heißt“
  - **neu** „Was Sie tun können“ und „Aufgabe für die Entwicklung“ aus `ATLAS_TODO` (ersetzt den bisherigen `help`-Block)
  - „Zugang für Programme“, „Neuprüfung vorgesehen“, „Kandidaten aus der Länderrecherche (ungeprüft)“

`ATLAS_TODO` (Umformung der vorhandenen `help`-Texte aus `shared/atlas-categories.mjs:6-17`):

| Grund | Was Sie tun können | Aufgabe für die Entwicklung |
|---|---|---|
| ok | Nichts. Neue Berichte holt ein Abruf auf der Seite „Abruf & Verarbeitung“. | – |
| nolink | – | Mit den korrigierten Suchregeln neu prüfen; Kandidaten der Länderrecherche prüfen; Systeme bei Dienstleistern über öffentliche Zertifikatsverzeichnisse finden; Leser für Gemeinde-Websites. |
| website | – | Leser für Gemeinde-Websites, sobald die Freigabe geprüft ist. |
| robots | – | Mit dem Prüfskript (verify.mjs) neu prüfen. |
| blocked | Gemeinde oder Dienstleister um Freischaltung der OParl-Schnittstelle bitten (etwa ratsinfomanagement.net, Kommune aktiv, ekom21). | – |
| noreader | – | Leser für RIS-Portal und komuna bauen; Gebiete mit ALLRIS 3 und korrigierter Linksuche neu prüfen; Leser für häufige unbekannte Systeme. |
| readfail | – | Erneut prüfen; Mandant oder Pfad korrigieren. |
| shared | – | Gremien eines gemeinsamen Systems je Gemeinde trennen, wie es der OParl-Gremienfilter für Bremen schon kann. |
| consent | – | Freigegebene Gebiete (consents.mjs) mit dem Prüfskript prüfen; bei einer Freischaltung zuerst den Betreiber abwarten. |
| ready | Gebiet abrufen („Abrufen →“). Findet der Abruf nichts, nennt er den Grund. | Prüfskript ausführen (Befehl steht im Grund). |
| special | Berlin: Freigabe der Bezirke bzw. des ITDZ anfragen. | Hamburg: Transparenzportal anbinden, sobald entschieden ist, ob die Bezirke eigene Gebiete werden. |
| other | – | Quellensuche für das Gebiet ausführen. |

`COL_HELP` der Verfahrenstabelle:

| Spalte | Text |
|---|---|
| Gebiete | angebundene Gebiete mit diesem Verfahren |
| Mit Berichten | mindestens ein Bericht; Anteil an den Gebieten des Verfahrens |
| Berichte | gespeicherte Berichte zusammen |
| Median je Gebiet | mittlere Zahl der Berichte der Gebiete mit Berichten |
| Ab 1 Jahr zurück | älteste Sitzung ≥ 330 Tage zurück; Anteil an allen Gebieten des Verfahrens |
| Teilstand | Gebiete mit Teilstand |
| Abruf fehlgeschlagen | Gebiete, deren letzter Abruf scheiterte |

### 6.6 Qualität & Betrieb

**Kennzahlen:**

| Begriff | Wert | Notiz |
|---|---|---|
| Berichte online | `counts.online` | Doppelungen einmal gezählt · {n} in 7 Tagen neu gespeichert oder geändert |
| Gebiete mit Berichten | n / alle | {n} Städte, Gemeinden und Verbände · {n} Kreise |
| Ohne Sachgebiet | pct | {n} Berichte · in der Prüfliste ansehen ↓ |
| Gebiete mit Abrufproblemen | Vereinigungsmenge (6.14 Nr. 2) | {n} mit Teilstand · {n} letzter Abruf fehlgeschlagen |

Zeile „Als Nächstes“ (14 px): „Als Nächstes: {n} Gebiete mit Teilstand → · {n} Gebiete seit 7 Tagen ohne neue Übernahme → · {n} angebundene Gebiete ohne Berichte → · Offene Gebiete im Lückenatlas →“. Die Links zeigen auf `filter=partial`, `filter=stale`, `filter=empty` und `atlas`.

Sprungleiste (`.admin-nav`): „Inhaltsqualität · Abrufe · Datenbank · Duplikate & Defekte · Betrieb · Quellen als CSV · Website ansehen“. Neuer Anker `#admin-pruefung`.

**Abschnitte:**

| ID | title | sub | how | todo |
|---|---|---|---|---|
| qualitaet.inhalt | Prüfliste und Einordnung | Wie weit die Berichte aufbereitet sind, wie sie sich auf Sachgebiete und Verfahrensstände verteilen, und welche einen zweiten Blick brauchen. | 1. Technische Prüfungen ersetzen keine fachliche Bewertung. Die Sachgebiete stammen aus den festen Regeln (Stufe 02). KI-Sachgebiete aus dem früheren Test mit Billerbeck werden getrennt gespeichert und auf den Berichtsseiten gegenübergestellt. 2. „Alle, auch Titeltest“: Diese Zahlen enthalten Ergebnisse des früheren Tests, bei dem die KI nur den Titel sah. Auf der Seite „Abruf & Verarbeitung“ zählen nur Ergebnisse aus dem Inhalt. | Offene Berichte nach Regeln einordnen (`abruf`) |
| qualitaet.importe | Die letzten Abrufe | Die letzten 30 Läufe, die dieses System gestartet hat. Extern eingespielte Daten stehen im Quellenstand der Gebiete. | 1. „Status offen“: Der Lauf hat sich seit über 10 Minuten nicht zurückgemeldet und ist vermutlich abgebrochen; ein offener Auftrag lässt sich auf der Seite „Abruf & Verarbeitung“ fortsetzen oder beenden. 2. Einträge: gelesene bzw. bearbeitete Berichte des Laufs. | – |
| qualitaet.export | Export und lokale Übernahme | Sichern Sie den Bestand als Datei oder übernehmen Sie einen geprüften Export lokal. | – | – |
| qualitaet.vollstaendig | Was ist wirklich gespeichert? | Prüft je Bericht zwölf Pflichtangaben; vollständig ist ein Bericht, wenn alle erfüllt sind. Die Prüfung liest nur, sie erstellt keine Einordnung und keine KI-Texte. | Unbekannte Werte und Quellenlücken zählen nicht als vollständig. Anwesenheit bezieht sich auf die Sitzung, nicht auf einen einzelnen Tagesordnungspunkt. Zehn bloß aus Titeln abgeleitete Stichwörter erfüllen die Inhaltsanforderung nicht. | Fehlende KI-Angaben: Stufe 03 (`abruf`) · Fehlende Regel-Einordnung: Stufe 02 (`abruf`) |
| qualitaet.pruefung | Ist der Bestand in sich stimmig? | Vierzehn Prüfungen lesen den gespeicherten Bestand. Jede Prüfung läuft in Schritten, ihr Ergebnis bleibt gespeichert; nichts wird verändert oder zusammengeführt. | howLabel „Was tun bei Treffern?“: 1. Doppelungen: Der Leser trennt die Gremien eines gemeinsamen Systems nicht – Aufgabe für die Entwicklung. 2. Defekte: Gebiet neu abrufen; bleibt der Fehler, den Leser prüfen (Entwicklung). 3. Verwaiste Einträge: Bereinigung durch die Entwicklung. 4. Hinweise: meist korrekte, gleichlautende Punkte; nur bei Auffälligkeiten prüfen. | – |
| qualitaet.betrieb | Was ist eingerichtet? | Was technisch eingerichtet ist und was zuletzt automatisch lief. | – | – |

**Zahlen der Inhaltsqualität:**

| Neu | Alt | title |
|---|---|---|
| Als KI-Text gekennzeichnet | KI-Zusammenfassungen | Berichte, deren Text als KI-Zusammenfassung gekennzeichnet ist, aus allen bisherigen Verfahren. |
| Ohne KI-Kennzeichnung | Ohne aktuelle KI-Kennzeichnung | Alle übrigen Berichte. |
| Mit PDF-Unterlage | Artikel mit PDF-Verweis | Berichte mit mindestens einer verlinkten PDF-Datei. |
| Textprüfung bestanden | Technische Textprüfung bestanden | Die automatische Textprüfung des Berichts ist bestanden. (prüfen, Abschnitt 7) |
| KI-Inhaltsanalyse abgeschlossen | Inhaltsanalysen abgeschlossen | Die KI hat die Unterlagen gelesen und eine Analyse gespeichert. |
| Zu wenig lesbarer Text | Sachtext unzureichend | Die Unterlagen enthielten zu wenig lesbaren Text, etwa nur einen Scan. |
| KI-Analyse veraltet | Inhaltsanalyse veraltet | Die Unterlagen haben sich seit der KI-Analyse geändert. (prüfen, Abschnitt 7) |
| KI-Sachgebiete (alle, auch Titeltest) | Separate KI-Labels | Von der KI vergebenes Sachgebiet, getrennt von dem der Regeln gespeichert. |
| KI-Stichwortprofile (alle, auch Titeltest) | Gewichtete Stichwortprofile | Gewichtete Stichwörter der KI, auch aus dem Titeltest. |

Diagramme:
- „Thematische Einordnung“ wird h3 „Sachgebiete“ mit der Notiz: „Nach den festen Regeln (Stufe 02), Anteil an allen Berichten. „Unklar“: Die Regeln fanden im Titel kein Sachgebiet.“
- „Verfahrensstand“: je Zeile `title={STATUS[id].description}` (`shared/types.ts:101`). „Unbekannt“: „Aus der Quelle geht nicht hervor, wie weit der Vorgang ist.“

Prüfliste:
- h3 „Prüfliste“, Notiz: „Bis zu 25 zuletzt geänderte Berichte, die zum Prüfgrund passen. Die Links öffnen den Bericht in einem neuen Tab.“
- Trefferzeile: „{n} Berichte passen zu diesem Prüfgrund.“ Bei `total===null`: „Trefferzahl wird nachgerechnet; gezeigt werden Treffer unter den 5.000 zuletzt geänderten Berichten.“
- Gebietsfeld „Gebiet“, `allLabel` „Alle Gebiete mit Berichten“.

`REVIEW_HELP`:

| Prüfgrund | Hilfe |
|---|---|
| labels | Kein Sachgebiet oder „unklar“: Die Regeln fanden im Titel kein Thema. |
| status | Aus der Quelle geht nicht hervor, ob beraten, beschlossen oder abgelehnt wurde. |
| identity | Quellen nennen für denselben Bericht verschiedene amtliche Vorgänge; er wurde deshalb nicht zusammengeführt. |
| summaries | Eine Unterlage ist nicht lesbar, oder die KI-Analyse ist gescheitert, veraltet oder fand zu wenig Text. |

Letzte Abrufe:
- Art des Laufs: „Labels & Themenmerkmale“ → „Einordnung nach Regeln“, „Quellenimport“ → „Abruf“.
- Leer: „Noch keine Abrufe protokolliert. Abrufe starten Sie auf der Seite „Abruf & Verarbeitung“.“
- Spalte „Ergebnis“, `title` an „Status offen“ = `how` Punkt 1.

`FIELD_HELP` (IDs aus `server/integrations/data-completeness.mjs:3-15`):

| id | Text |
|---|---|
| processedAt | Zeitpunkt der letzten Bearbeitung ist gespeichert. |
| region | Der Bericht ist einem Gebiet zugeordnet. |
| committee | Das beratende Gremium ist bekannt. |
| participants | Für jede Sitzung des Berichts ist die Anwesenheit mit Quelle belegt. |
| reference | Eine Vorgangsnummer ist da, oder es ist belegt, dass die Quelle keine führt. |
| process | Der Verfahrensstand ist bekannt. |
| title | Der amtliche Titel aus der Quelle ist gespeichert. |
| summary | KI-Analyse abgeschlossen, mit Kurz- und Langfassung und Belegstellen. |
| originals | Mindestens ein https-Link zur Quelle oder zu einer Unterlage. |
| ruleLabel | Die festen Regeln haben den Bericht eingeordnet; auch „unklar“ zählt. |
| aiLabel | Die KI hat ein eigenes Sachgebiet vergeben. |
| keywords | Zehn Stichwörter aus dem Inhalt der Unterlagen, Gewichte zusammen 100. |

Unter der Tabelle: „Vorhanden: Berichte, die die Angabe erfüllen. Offen: Berichte, denen sie fehlt.“

Export:
- „Gesamten Artikelbestand sichern“ → „Gesamten Berichtsbestand sichern“.
- „Enthält alle gespeicherten Artikel …“ → „Enthält alle gespeicherten Berichte …“.
- Ergebnis: „{a} von {b} Berichten erfüllen alle Pflichtangaben. {c} brauchen Ergänzungen.“

`QUALITY_EXPLAIN`:

| Prüfung | Text |
|---|---|
| eventDateMismatch | Das Datum, nach dem Listen und Zeiträume sortieren, weicht vom Sitzungsdatum im Bericht ab. |
| mergeChain | Das Ziel eines zusammengeführten Berichts ist selbst zusammengeführt (Verweis auf einen Verweis); Leser lösen nur eine Stufe auf. |
| orphanAnalyses | Ältere Analysefassungen, deren Bericht nicht mehr existiert. |
| orphanVersions | Archivierte Fassungen, deren Bericht nicht mehr existiert. |

`title` an „veraltet“: „Der Bestand hat sich seit dieser Prüfung geändert.“

Betrieb:
- Datenbank, small: „Revision: laufende Nummer des Datenbestands. Archivierte Fassungen: frühere Stände geänderter Berichte. Zusammengeführte Verweise: doppelt gelieferte Berichte, die auf einen anderen zeigen.“
- „Laufende KI-Zusammenfassungen“ → „KI-Schnittstelle“, dd „Zugang eingerichtet“ / „Zugang nicht eingerichtet“.
- Push, small: „Benachrichtigungen im Browser. Ein gespeichertes Abonnement ist kein Nachweis einer zugestellten Nachricht.“

Meldungen:
- „{n} Berichte analysiert. {m} stehen in dieser Auswahl noch aus. Ein weiterer Lauf startet erst mit Ihrem nächsten Klick.“
- „{n} Berichte zur Textverarbeitung übernommen. …“

### 6.7 Stand-Zeilen der Seiten mit gespeichertem Stand

- **Stichwörter, ohne Stand:** „Noch kein Stand gespeichert. Das Zählen liest alle Berichte in Schritten und dauert etwa 2–3 Minuten; danach öffnet sich die Seite sofort.“ Knopf „Jetzt berechnen“.
- **Während eines Baus:** „Wird neu berechnet: {p} % ({done} von {total} Gebieten) · Der bisherige Stand bleibt sichtbar, bis die Zählung fertig ist.“
- **Angehalten:** „Angehalten bei {p} % · Fortsetzen →“.

### 6.8 Hochrechnung

- **Kurzfassung** (neu, 16 px grau, direkt unter den Kennzahlen): „Kurz gesagt: Alle kommunalen Gremien in Deutschland bringen zusammen rund {perDay} neue Berichte (Tagesordnungspunkte) pro Tag auf, Spanne {low} bis {high}. Mit den heutigen Quellen könnte Plenara davon etwa {connectedShare} lesen. Nur ein Teil ist gezählt, der Rest hochgerechnet; die Marken „gezählt“, „gerechnet“ und „angenommen“ zeigen, worauf jede Zahl beruht.“
- **Leer:** h2 „Noch keine Hochrechnung gespeichert“. Text: „Die Berechnung nutzt die vorberechneten Zahlen je Gebiet und zieht die Spannen; das dauert wenige Sekunden. Danach zeigt die Seite das Ergebnis sofort, bis Sie neu rechnen lassen.“ Knopf `.btn-primary` „Jetzt berechnen“.
- **Vor der Vorberechnung** (409): „Die Hochrechnung ist erst möglich, wenn die Zahlen je Gebiet vorberechnet sind ({done} von {total}).“
- **Stand-Zeile:** `StandLine` mit `extra` „ · {sampleCount} Beispiele mit vollständigem Jahr · {dd(from)} bis {dd(to)}“.
- **Kennzahl „Davon heute lesbar“**, Notiz: „rund {n} Berichte pro Tag mit den vorhandenen Anbindungen; große Gebiete zählen mehr, weil sie mehr Berichte haben“.
- **Token-Kennzahlen**, `title`: „Token: Texteinheit, nach der KI-Anbieter abrechnen; meist ein Wortteil von wenigen Zeichen.“
- **Schritt 2** (Zeile ~157): „Sobald ein Gebiet mit „12 Monate“ abgerufen ist, zählt es nach dem nächsten „Neu berechnen“ als Beispiel.“ Die Links „… auf Seite 1 …“ (Zeilen ~157 und ~174) → „… auf der Seite „Abruf & Verarbeitung“ auswählen →“.
- **Schritt 3**, neuer erster Satz: „Je mehr Einwohner ein Gebiet hat, desto mehr Berichte entstehen, aber nicht im gleichen Maß. Die Kurve beschreibt diesen Zusammenhang; beide Achsen sind gestaucht (logarithmisch), damit kleine und große Gebiete zugleich lesbar sind.“ Zur Streuung „×/÷ {f}“: „Typische Beispiele liegen bis zum {f}-Fachen über oder unter der Kurve.“ (prüfen, Abschnitt 7)
- **Schritt 5:** „mit Zurücklegen“ → „(ein Beispiel kann mehrfach gezogen werden)“; „Median“ mit Glossar-`title`.
- **Schritt 6:** „Bausteine“ → „Leser“.
- **Schritt 7:** „Tokenizer o200k“ → „ein zweites Zählverfahren (o200k)“.
- Die Schritte 1, 4, 8, 9 und 10 bleiben.

### 6.9 Stichwörter

**Kennzahlen:**

| Begriff | Notiz |
|---|---|
| Berichte im Bestand | Doppelungen einmal gezählt |
| Erkannte Sachbegriffe | in {n} Berichten · Wörter, an denen die Regeln ein Sachgebiet erkannt haben |
| Titelbegriffe | aus {n} ausgewerteten Berichten · verbinden gleiche Themen über Gebiete hinweg |
| KI-Stichwörter | aus {n} Stichwortprofilen |

**Abschnitte** (die vorhandenen Absätze bleiben, aber zugeklappt in `How`):

| ID | title | sub | Textänderung |
|---|---|---|---|
| stichwoerter.regeln | Welche Sachbegriffe haben die Regeln erkannt? | Wörter im Originaltitel, an denen die festen Regeln ein Sachgebiet erkannt haben, und in wie vielen Berichten sie stehen. | „Die Label-Regeln“ → „Die Regeln für Sachgebiete“; „über das Label“ → „über das Sachgebiet“; „mit Regel-Label“ → „mit Sachgebiet nach Regeln“ |
| stichwoerter.titel | Welche Begriffe stehen in den Titeln? | Begriffe, in die eine zweite Regel jeden Titel zerlegt; sie verbinden Berichte verschiedener Gebiete zum selben Thema. | keine |
| stichwoerter.ki | Welche Stichwörter vergibt die KI? | Gewichtete Stichwörter, die ein KI-Agent je Bericht vergeben hat; die Gewichte eines Berichts ergeben zusammen 100. | Spalte „Ø Gewicht“, `title`: „Gewichtssumme geteilt durch die Zahl der Berichte. Hoch heißt: Das Stichwort ist dort meist zentral.“ |

### 6.10 To-do und Anmeldung

| ID | Text |
|---|---|
| todo.ueberfaellig (12 px unter dem Fortschritt) | Überfällig: Der Termin liegt vor heute, und der Eintrag ist nicht erledigt. |
| rahmen.anmelden | h1 „Geschützter Bereich“ · „Melden Sie sich mit ChatGPT an, um die Administration zu öffnen.“ · Knopf „Mit ChatGPT anmelden“ |
| rahmen.einrichten | bleibt („Angemeldet als … Der einmalige Freischaltcode …“) |
| rahmen.keinZugriff | bleibt; Link „Konto wechseln →“ |
| rahmen.fehler | h1 „Administration nicht erreichbar“ · „Die Zugangsprüfung hat gerade nicht geantwortet. Bitte versuchen Sie es gleich noch einmal.“ · Knopf „Erneut versuchen“ |

### 6.11 Begriffe (`TERMS`; Abschnitt `#begriffe` der Übersicht, `<dl>` mit `dt` 14 px schwarz, `dd` 14 px grau)

| Begriff | Text |
|---|---|
| Gebiet | Eine Stadt, eine Gemeinde, ein Gemeindeverband (Samtgemeinde, Amt, Verbandsgemeinde, Verwaltungsgemeinschaft) oder ein Kreis. Berlin und Hamburg sind je ein Gebiet. |
| Angebunden | Plenara kennt für das Gebiet eine Quelle, die ein Programm lesen kann. Ob schon Berichte gespeichert sind, ist eine eigene Zahl. |
| Offen | Für das Gebiet gibt es noch keine lesbare Quelle. Den Grund zeigt der Lückenatlas. |
| Bericht | Ein öffentlicher Tagesordnungspunkt oder Vorgang eines Gremiums. Liefern Quellen denselben Vorgang doppelt, wird er zusammengeführt und zählt einmal. |
| Gemeindeebene | Einwohner zählen nur bei Städten, Gemeinden und Gemeindeverbänden. Ein Kreis umfasst seine Gemeinden; zählte er mit, wären Menschen doppelt gezählt. |
| Stand | Zeitpunkt, zu dem die angezeigten Zahlen berechnet wurden. „≈ N geänderte Datensätze seither“: Seitdem wurden Berichte gespeichert oder geändert; auch ein erneuter Abruf ohne neuen Inhalt zählt mit. |
| Übernahme | Der letzte Abruf, dessen Ergebnis gespeichert wurde. |
| Letzter Versuch | Der letzte Abruf überhaupt, auch wenn er scheiterte. |
| Teilstand | Berichte sind gespeichert, aber der letzte Abruf hat nicht alles gelesen, etwa wegen eines Zeitlimits. |
| Revision | Laufende Nummer des Datenbestands. Sie steigt mit jeder Änderung an Berichten, früheren Fassungen und Analysen und mit jedem gespeicherten Abruf, auch wenn er nichts Neues brachte. Gleiche Nummer heißt: seitdem nichts gespeichert. |
| Sachgebiet | Thema eines Berichts, etwa Schule oder Verkehr. Feste Regeln vergeben es aus dem Titel (Stufe 02), die KI aus dem Inhalt (Stufe 03). Im Code heißt es „Label“. |
| Titeltest | Früherer Versuch, bei dem die KI nur den Titel sah (Billerbeck). Seine Ergebnisse werden getrennt gespeichert und zählen bei „aus dem Inhalt“ nicht. |
| Erster Tagesordnungstag | Der Tag, an dem ein Bericht zum ersten Mal auf einer Tagesordnung stand. |
| Rückreichweite | Wie weit die gespeicherten Berichte eines Gebiets zurückreichen, gemessen an der ältesten Sitzung. |
| Aktualität | Wie lange die jüngste Sitzung mit gespeichertem Bericht zurückliegt. |
| OParl | Genormte Schnittstelle für Ratsinformationen, für Programme gedacht und am zuverlässigsten. |
| Schnittstelle (API) | Eine andere Schnittstelle der Anwendung, über die ein Programm Daten abfragt. |
| HTML-Seiten | Keine Schnittstelle vorhanden; Plenara liest die öffentlichen Webseiten des Ratsinformationssystems. |
| robots.txt | Datei, in der eine Website Wünsche an Suchprogramme äußert. Plenara hält sie fest, befolgt sie seit dem 05.10.26 aber nicht mehr; technische Sperren werden beachtet. |
| Zugriffsschutz | Das System sperrt Programme aus (HTTP 401/403, Web-Firewall, Anmeldung). Plenara umgeht das nicht; Daten gibt es nur mit Freischaltung. |
| Leser | Das Programm, das eine bestimmte Art Ratsinformationssystem lesen kann (im Code: Adapter oder Baustein). |
| Quellensuche | Automatische Suche nach dem Ratsinformationssystem jedes Gebiets; ihr letztes Ergebnis liefert die Gründe im Lückenatlas. |
| Median | Der mittlere Wert: Die Hälfte liegt darunter, die Hälfte darüber. Einzelne Ausreißer verschieben ihn kaum. |
| Spanne | Bereich, in dem 8 von 10 Rechendurchgängen der Hochrechnung lagen. |
| Token | Texteinheit, nach der KI-Anbieter abrechnen; meist ein Wortteil von wenigen Zeichen. |

### 6.12 Wortersetzungen (genaue Zeichenketten)

| Datei | Alt | Neu |
|---|---|---|
| `app/admin/page.tsx` | Melde dich mit ChatGPT an | Melden Sie sich mit ChatGPT an |
| `admin-processing.tsx` | Deine Auswahl (2×) | Ihre Auswahl |
| `admin-processing.tsx` | du kannst jederzeit pausieren und später dahinter fortsetzen | Sie können jederzeit pausieren und später dort fortsetzen |
| `admin-processing.tsx` | Der KI-Agent deiner Wahl … Du startest den heruntergeladenen Auftrag manuell in deinem Projekt. | Text aus 6.4, Stufe 03 |
| `admin-processing.tsx` | Pausiert – wartet auf deinen Start | Pausiert – wartet auf Ihren Start |
| `admin-processing.tsx` | Auftrag an deinen KI-Agenten übergeben und Ergebnisse hier einlesen | Geben Sie den Auftrag an Ihren KI-Agenten und lesen Sie die Ergebnisse hier ein |
| `admin-processing.tsx` | Artikel je KI-Auftrag · 25/50/100 Artikel · Alle offenen Artikel · Artikel ohne ausreichende Quelle … · Je Artikel … nie exportierte Artikel … seine Artikel · festgelegte Artikel · Die Artikel sind wieder verfügbar … nicht exportierten Artikeln · Die Artikelauswahl bleibt unverändert. | jeweils Bericht/Berichte/Berichten/Berichtsauswahl |
| `admin-processing.tsx` | Regel-Labels · Alle offenen Berichte labeln · Regel-Labeling | Nach Regeln bearbeitet · Alle offenen Berichte einordnen · Einordnung nach Regeln |
| `admin-processing.tsx` | KI-Label aus Inhalt · Gewichtete Stichwörter (`kindNames`) | KI-Sachgebiet aus dem Inhalt · Zehn gewichtete Stichwörter |
| `admin-dashboard.tsx` | Abrufe startest du auf der Seite | Abrufe starten Sie auf der Seite |
| `admin-dashboard.tsx` | mit deinem nächsten Klick | mit Ihrem nächsten Klick |
| `admin-dashboard.tsx` | Artikel online · Gebiete mit Artikeln · Artikel zur Einordnung · Artikel mit PDF-Verweis · Alle Gebiete mit Artikeln · Artikel passen zu dieser Auswahl · öffnen den Artikel · Artikel analysiert · Artikel zur Textverarbeitung | laut 6.6 |
| `admin-dashboard.tsx`, `admin-keywords.tsx` | Datenbankstand {…} Uhr | entfällt (`StandLine`) |
| `admin-estimate.tsx` (~114) | bis du neu rechnen lässt | bis Sie neu rechnen lassen |
| `admin-forecast.tsx` (~9), `admin-keywords.tsx` (~85) | Daten & Verarbeitung | Abruf & Verarbeitung |
| `admin-processing-map.tsx` (~37) | Teilbestand · Daten vorhanden · Angebunden, ohne Daten | Teilstand · Berichte, keine Lücke gemeldet · Angebunden, ohne Berichte |
| `admin-run-debug.tsx` | Debug-Infos (alle Vorkommen) · Baustein | Protokoll · Leser |
| `database-admin.tsx` | Artikeln · Artikelbestand · alle gespeicherten Artikel | Berichten · Berichtsbestand · alle gespeicherten Berichte |
| `admin-atlas.tsx` (~95) | Alle {n(5324)} Gebiete werden … geladen | Alle Gebiete werden mit Anbindung, Grund und Berichtsstand geladen … |
| `admin-atlas.tsx` (~93) | aktualisiert sich alle fünf Minuten · Prüfberichte vom | (`StandLine extra`) Gründe aus der Quellensuche vom |
| Datum | `year:'numeric'` (`admin-timeline.tsx:8-9`), `day()`/`month()` (`admin-atlas.tsx:24-25`, `admin-estimate.tsx:33`, `admin-processing.tsx` `month`), `p.day.split('-').reverse().join('.')` (`admin-overview.tsx:102`) | `dd()` / `mm()` / `'2-digit'` |

### 6.13 Bezeichnungen in `shared/admin.mjs` (nur Texte) [Server]

| Alt | Neu |
|---|---|
| `'Ohne Artikel'` (in `sourceHealth`) | `'Ohne Berichte'` |
| `'Datenstand älter'` | `'Älter als 7 Tage'` |
| `REVIEW_FILTERS` `'Label offen'` | `'Ohne Sachgebiet'` |
| `SOURCE_FILTERS` `'Mit Artikeln'` | `'Mit Berichten'` |
| `'Konfiguriert, ohne Artikel'` | `'Angebunden, ohne Berichte'` |
| `'Seit 7 Tagen ohne Datenübernahme'` | `'Seit 7 Tagen ohne neue Übernahme'` |

Vor der Änderung `grep -rn "Ohne Artikel\|Datenstand älter" components shared server tests` ausführen. Wo Code mit diesen Texten vergleicht, dort mit anpassen.

### 6.14 Fachliche Korrekturen, die mit den Texten zusammenhängen (Frontend)

1. **Übersicht, „Abruf starten“** (`admin-overview.tsx:128`): `connected.areas - data.areas` ist eine Differenz, keine Schnittmenge. Die Zahl weglassen. Mit `static`+`areas` (Phase 5) kann sie exakt gezählt werden: angebunden und `cnt===0`.
2. **Qualität, „Quellen mit Hinweisen“** (`admin-dashboard.tsx:49`): `partial.length+failed.length` zählt doppelt. Richtig: `new Set([...partial,...failed].map(s=>s.id)).size`.
3. **Qualität, Links „Als Nächstes“** (`admin-dashboard.tsx:52`): Teilstand und „ältere Datenstände“ zeigen beide auf `issues`. Neu: `partial` bzw. `stale`.
4. **Atlas, Farbe „Berichte“** (`admin-atlas.tsx:67`): `a.c==='ok'` zeigt eingeschaltete Quellen (`ready`) ohne Berichte grau. Richtig: `!catById.get(a.c)?.open`, mit Schraffur.
5. **Abruf-Karte, Legende** (`admin-processing-map.tsx:31,37`): vier Farbstufen, aber drei Legendeneinträge. Neu laut 6.4.
6. **Atlas, Listenpunkt:** `colorOf` liefert bei Reichweite und Aktualität `url(#atlas-empty)`. Das wirkt als CSS-Hintergrund nicht. Stattdessen `HATCH_CSS`.
7. **Übersicht, „Aktualisieren“** leert die Seite (erledigt in P06).

---

## 7. Risiken und offene Fragen

### 7.1 Entscheidungen, die der Nutzer treffen sollte

| Nr. | Frage | Empfehlung |
|---|---|---|
| **E1** | Billige Ansichten (Übersicht, Zeitverlauf, Atlas, Gebietstabelle) **beim Lesen aus den vorberechneten Werten je Gebiet ableiten** (immer aktuell, Millisekunden) oder zusätzlich als fertigen Seitenstand speichern? | Ableiten. Das erfüllt „einmal erstellen, dann abrufen“ (die teure Arbeit geschieht nur einmal je Gebiet), ohne ein zweites Veraltungsfenster. |
| **E2** | Stichwörter beim ersten Öffnen ohne Stand **automatisch** zählen (2–3 min D1-Last in Schritten) oder nur auf Knopfdruck? | Nur auf Knopfdruck, mit deutlichem Hinweis; zusätzlich nachts per Runner. |
| **E3** | Nachhol-Schleife **automatisch**, solange eine Adminseite offen ist (Tab sichtbar, kein Auftrag, keine Import-Sperre), oder nur per Knopf bzw. Runner? | Automatisch; Schritte höchstens 5 s. |
| **E4** | Duplikatprüfungen (`dupSharedSystem`, `dupSameMeeting`, je ~87 s) in Produktion in Abschnitten (Gruppierung nach `provider()`, kann Aliase übersehen) oder **nur lokal** prüfbar? | In Abschnitten, nach einmaligem lokalen Vergleich mit `scripts/check-dup-shared.mjs` (P21c); weicht es ab: nur lokal. |
| **E5** | `components/ratsmonitor/FRONTEND.md:46` sagt „`app/analyse-admin.css` nicht ändern“. Der Auftrag (Design wie die Startseite) verlangt Änderungen dort. | Freigeben; FRONTEND.md in P40 anpassen. |
| **E6** | Startseite des Adminbereichs: To-do (heute) oder Übersicht? | Unverändert To-do; Umstellung ist eine Zeile in `app/admin/page.tsx` (Rückfall `'todo'` → `'uebersicht'`). |
| **E7** | Kategorie `ready` in `shared/atlas-categories.mjs:15` von „Eingeschaltet, Live-Prüfung ausstehend“ in „Eingeschaltet, Prüfung an der echten Quelle ausstehend“ umbenennen? Betrifft auch den eigenständigen Atlas. | Optional; dann `atlas.anbindung.how` anpassen. |
| **E8** | Bezeichnungen in `shared/admin.mjs` ändern (6.13)? Das ändert auch die Filternamen des CSV-Exports. | Ja. |
| **E9** | Datenbank über 10 GB (lokal 11,4–11,9 GB; `import-debug:*` 50 MB, `topics.payload` 8,1 GB). Grenze in Produktion? | **Eigene Aufgabe**, nicht Teil dieses Konzepts. Neue Tabellen hier ~10–40 MB. |
| **E10** | Ein eigener Cloudflare-Worker mit Cron und Queue würde die Nachholschritte unabhängig von offenen Seiten machen; er braucht ein eigenes Konto. | Nicht jetzt; das Konzept hängt nicht davon ab. |
| **E11** | Anzeige von „Änderungen seither“: genaue Zahl geänderter Datensätze (kann nach einem Regel-Lauf über 1 Mio. betragen) oder ab 10.000 nur „viele Änderungen seither“? | Wie in `StandLine` (3.5): genaue Zahl bis 10.000, darüber „viele Änderungen seither“. |

### 7.2 Technische Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| 304 oder ETag kommen durch vinext/Hosting nicht an | Vor Phase 5 in Produktion prüfen (P41); der Browser-Speicher wirkt innerhalb eines Tabs trotzdem. |
| `next/link` lädt in vinext doch neu | `<a>` behalten; der HTTP-Cache bleibt. |
| D1 kennt `MATERIALIZED` nicht | Unterabfrage mit `LIMIT -1`; im Plan prüfen. |
| Grenze für gebundene Werte (100 KB oder 2 MB) unklar | `PART_CHARS=90000`; IDs eines Abschnitts als JSON (höchstens 500 IDs, ~15 KB); Massen-Upserts je ≤ 90 KB; in P41 messen. |
| Grenze an Abfragen je Aufruf (1.000 bzw. 50) | Massen-Upsert statt einer Anweisung je Gebiet; ≤ 20 Abfragen je Schritt. |
| D1 30 s je Abfrage, CPU-Grenze des Tarifs unbekannt | Abfragen höchstens ~3 s, Schritte höchstens 8 s; `areas` parst ~2,6 MB `region_stats` (~30–60 ms CPU). |
| Doppeltes Zählen bei abgelaufener Sperre oder Wiederholung | Revisionsschutz (Klasse B), Vergleichen-und-Tauschen auf `next` in einem Batch (Bauaufträge); Test „doppelter Schritt“. |
| Hamburg-Abschnitt (22.000 Berichte) | lokal 0,6 s für series; Grenze `chunkRows=25000`; Import-Haken mit Budget 4000. |
| Rechenzeit der 300 Replikate der Hochrechnung | Messen (P19); über 8 s auf zwei Schritte verteilen. |
| Teilsummen während des ersten Füllens | `unbuilt` getrennt von `pending`; Oberfläche zeigt bis `unbuilt===0` keine Zahlen aus `region_series`; Hochrechnung 409. |
| Abhängigkeit von den Triggern aus 0011 | Nach Datenwiederherstellung oder Handänderungen: `node scripts/refresh-admin.mjs --full`. |
| Nachhol-Schleife belegt D1, während der Admin offen ist | Nur bei sichtbarem Tab, ohne Auftrag und ohne Import-Sperre, eine Sperre für alle. |
| Zahlen sind nicht „live“ | Gewollt und sichtbar (Stand-Zeile); Gebietswerte hält der Haken aktuell. |
| Deploy mitten in Phase 2 | P09–P15b gemeinsam deployen; Migration vorher, Erstaufbau abwarten. |
| Kleineres Modell verfehlt Details (`json_each(?)`, `WHERE` bei `INSERT…SELECT…ON CONFLICT`, Klammern um Bedingungen, binäre Sortierung statt `localeCompare`, `data.resume`, Kreisimporte, Test-Stubs) | Die Statements stehen hier fast wörtlich; Gleichheitstests gegen die alten Funktionen sichern ab. |
| Rückfall ohne Migration 0011 scannt weiter | Produktion auf 0011 prüfen (P41); danach Rückfall entfernen. |

### 7.3 Offene Prüfpunkte (fachliche Texte)

- `admin-coverage.mjs:20`, `admin-data.mjs:143` und `admin-atlas.mjs:30` bestimmen „angebunden“ an drei Stellen. Vermutlich dieselbe Menge; weichen die Zahlen ab, ins Glossar.
- `server/integrations/import-trace.mjs:15-19`: weitere Seitenkürzel (kp, pe, do) für das Protokoll.
- Setzstellen von `quality.passed` (u. a. `server/integrations/ai-summary.mjs`): was „Textprüfung bestanden“ umfasst.
- `contentAnalysis.status='stale'`: ob „veraltet“ „Unterlagen geändert“ heißt.
- `shared/estimate.mjs`: Definition der Streuung „×/÷“ (Schritt 3).
- Herkunft von `source_coverage.issues` gegenüber `warnings` (Import-Schreiber in `server/integrations/`).

---

## 8. Hinweise für das umsetzende Modell

### 8.1 Projektregeln (aus `CLAUDE.md` und Projekt-Erfahrung)

- **Keine reine Frontend-Aufgabe.** Pakete mit [Server] ändern `server/`, `shared/`, `app/api/`, `drizzle/` und `tests/`; das ist gewollt. Pakete ohne diese Markierung ändern das Backend nicht.
- **Vor jeder Änderung an `server/` oder `shared/` prüfen, ob ein Import läuft.**
  - Ein Neuladen des Dev-Servers kann ihn abbrechen oder den Port 5173 kaputt machen (500, oder nur noch `/admin` mit Anmeldung).
  - Prüfen: in `tmp/dev-server.log` die letzten Zeilen nach `POST /api/admin/pipeline` durchsuchen (`tail -n 200 tmp/dev-server.log | grep "api/admin/pipeline"`), **nie `tail -F`**. Bei Zweifel den Nutzer fragen.
  - Läuft ein Import, in einem **git-Worktree** arbeiten (frische Checkouts haben CRLF; `node_modules` als Junction) und erst nach Pause des Auftrags zusammenführen.
  - Bei kaputtem Server: neu starten; hilft das nicht, `node_modules/.vite` löschen.
- **Migrationen nur ohne laufenden Import einspielen.**
- **Dev-Server:**
  - Er lauscht auf `localhost`, **nicht** auf `127.0.0.1`.
  - Im Dev-Modus braucht `/admin` keine Anmeldung.
  - Nicht als Hintergrund-Task des Agenten starten; der Prozess stirbt. Laut Projekt-Memory über Explorer und eine versteckte `.vbs` in `tmp/launch/` starten oder den Nutzer bitten.
- **Lange Node-Läufe** (`refresh-admin.mjs`) sterben teils still nach 1–5 min (Exitcode 127 oder 0xC0000409). Deshalb fortsetzbar bauen und unter einer PowerShell-Neustartschleife laufen lassen; nie zwei solche Läufe gleichzeitig. Skripte auf der lokalen D1 mit `PRAGMA busy_timeout=60000` öffnen.
- **Skripte mit Backslashes** (Regex, Pfade) nie per Bash-Heredoc oder `node -e` schreiben; mit dem Write-Werkzeug als `.mjs` anlegen, dann `node --check <datei>`.
- **Token sparen:**
  - Nichts ganz lesen, was man nur nachschlagen will: erst `grep`, dann `Read` mit `offset`/`limit`.
  - Datei oder CSS-Klasse über `components/ratsmonitor/INDEX.md` finden (`grep "^admin-section " components/ratsmonitor/INDEX.md`), INDEX.md nie ganz lesen.
  - `⚠N` im Index heißt: N Zeilen über 300 Zeichen. Betroffen sind vor allem `app/analyse-admin.css`, `components/admin-*.tsx` und `server/integrations/admin-data.mjs`. Dort `grep -n -o ".\{0,80\}<Muster>.\{0,80\}"` verwenden und mit `Edit` auf eine eindeutige Teilzeichenkette ersetzen.
  - Nie ganz lesen: `INDEX.md`, `vendor/`, `components/ratsmonitor/info/content.ts`, `components/ratsmonitor/lib/geo/mapEngine.ts`, `tests/fixtures/`, Lockfiles, `server/integrations/*.json`.
- **Nach neuen oder entfernten Dateien oder Klassen:** `node scripts/frontend-index.mjs` ausführen und `components/ratsmonitor/INDEX.md` mitcommitten.
- **Kein `drizzle-kit generate`** (Journal endet bei 0009).
- **Routen-Tests:** `tests/admin.test.mjs:184` stubbt `@/server/repositories/admin` mit festen Exporten. Jeder neue benannte Import aus diesem Modul in einer dort geladenen Route (`:195`) muss im Stub ergänzt werden, sonst wird die ganze Testdatei rot.
- **Je Paket ein Commit**, Nachricht auf Deutsch, Paketnummer vorn (z. B. „P01 Admin: Zeitverlauf-Cache je Bezug getrennt“).

### 8.2 Tests

- Alle Tests: `node --test tests/*.test.mjs` (laut FRONTEND.md auch `~/.local/bin/node --test tests/*.test.mjs`). Gelegentlich zufällig rot: „marks of read meetings“ und „every import leaves a record“; bei Rot einmal wiederholen.
- Ein Test: `node --test tests/region-facts.test.mjs`.
- Typcheck: `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- Testvorlagen:
  - In-Memory-SQLite mit allen Migrationen: `tests/quality-check.test.mjs:9-14`, `tests/admin-pipeline.test.mjs:11`.
  - `sqliteAdapter` aus `scripts/ai-job.mjs:13-26` (mit `batch` und Transaktion); genutzt in `tests/timeline.test.mjs:7`, `tests/estimate.test.mjs:10`, `tests/admin-keywords.test.mjs:5`.
  - Zählender und strenger Adapter (Parametergrenze): `tests/admin.test.mjs:122`.
  - „Nachführen = voller Aufbau“: `tests/search-cards-gone.test.mjs`.
  - Fehlende Tabelle simulieren: `tests/admin.test.mjs:100` (Rückfall ohne Tabellen).

### 8.3 Messen (nur ohne laufenden Import, nie zwei langsame Aufrufe gleichzeitig)

Ein Abbruch durch curl stoppt die Abfrage auf dem Server nicht. Langsame Endpunkte (vorher `coverage`, `keywords`, `timeline`) deshalb nur einzeln und mit Pause messen.

Git Bash:

```bash
m(){ curl -s -o /dev/null --max-time 300 -w "%{http_code} ttfb=%{time_starttransfer}s total=%{time_total}s size=%{size_download}B  $1\n" "http://localhost:5173$1"; }
m /api/admin/coverage; m /api/admin/coverage
```

PowerShell:

```powershell
curl.exe -s -o NUL --max-time 300 -w "%{http_code} ttfb=%{time_starttransfer}s total=%{time_total}s size=%{size_download}B`n" http://localhost:5173/api/admin/coverage
```

304 prüfen (ab P17):

```bash
E=$(curl -s -D - -o /dev/null http://localhost:5173/api/admin/coverage | grep -i '^etag:' | cut -d' ' -f2- | tr -d '\r')
curl -s -o /dev/null -H "If-None-Match: $E" -w "%{http_code} ttfb=%{time_starttransfer}s\n" http://localhost:5173/api/admin/coverage
```

POST-Schritt (ab P11; der Ursprung muss passen):

```bash
curl -s -X POST -H 'Content-Type: application/json' -H 'Origin: http://localhost:5173' -d '{"action":"step","target":"regions"}' http://localhost:5173/api/admin/refresh
```

**Vorher-Werte und Ziele**

| Route | vorher kalt | vorher direkt danach | Größe vorher | Ziel kalt | Ziel Wiederaufruf |
|---|---|---|---|---|---|
| `/admin` (Hülle) | 0,8 s | – | – | unverändert | – |
| `/api/admin/coverage` | > 180 s | 75 s | 7,7 KB | < 1 s | 304 < 0,3 s |
| `/api/admin/overview?review=0` | 38,2 s | 2,5 s | 6,4 MB | < 3 s nach P15a; entfällt (P28) | – |
| `/api/admin/overview` | – | 1,6 s | 6,4 MB | entfällt (P28) | – |
| `/api/admin/atlas` | 92 s | 0,67 s | 1,8 MB | < 1 s (bis P27c) | 304 < 0,3 s |
| `/api/admin/keywords` | 116 s | 0,03 s | 250 KB | < 0,3 s | 304 < 0,3 s |
| `/api/admin/timeline?basis=event` | 55–92 s | 0,06 s | 1 MB | < 1 s | 304 < 0,3 s |
| `/api/admin/estimate` (GET) | 0,07 s | – | 1,2 MB | < 0,3 s | 304 < 0,3 s |
| `/api/admin/quality` (GET) | 0,08 s | – | 24 KB | < 0,3 s | 304 < 0,3 s |
| `/api/admin/areas` (NEU) | – | – | – | < 0,5 s, < 200 KB gzip | 304 < 0,3 s |
| `/api/admin/summary` (NEU) | – | – | – | < 0,5 s, < 30 KB | – |
| `/api/admin/static?v=` (NEU) | – | – | – | < 0,5 s | aus Cache, keine Anfrage |
| `POST /api/admin/refresh` | – | – | – | jeder Schritt ≤ 8 s (Feld `ms`) | – |
| `POST /api/admin/estimate` | 2–3 min | – | – | < 15 s | – |

Zusätzlich nach Phase 2 im Log `tmp/dev-server.log` während eines Auftrags:
- keine Zeile `GET /api/admin/timeline`
- kein `POST /api/admin/pipeline` (Aktion `run`) über etwa 100 s; Status-Aufrufe unter 2 s

Vorher: 163 von 2.596 Pipeline-POSTs mit mindestens 100 s. Die Laufzeiten von 50–90 s sind gewollt (`RUN_MS=90000`).

### 8.4 Abschließende Abnahme (alle Pakete)

- Kein Admin-GET schreibt oder liest `topics.payload` über mehr als ein Gebiet, außer den Ausnahmen in R1 (Test `tests/admin-readonly.test.mjs`).
- Zeitverlauf, Abdeckung, Hochrechnungs-Details, Stichwörter und Qualitätsprüfungen sind gleich den alten Funktionen. Einzige dokumentierte Ausnahme ist die Schreibweise der Regelwörter (Tests).
- Abruf lokal kalt unter 1,5 s, jede andere Adminseite unter 1 s bis zur ersten vollständigen Anzeige; nach F5 nur 304-Antworten.
- Jede Seite zeigt eine Stand-Zeile; „Neu berechnen“ und „Aktualisieren“ lassen die alten Zahlen stehen.
- Design-Abnahme 5.9 und Text-Abnahme (P37, P38) erfüllt.
- `CLAUDE.md`, `FRONTEND.md` und `INDEX.md` aktualisiert (P40).

---

## Prüfvermerk

Eingearbeitete Korrekturen aus den drei Prüfberichten. Strittige Punkte wurden im Code nachgesehen (`sync.ts:40-46`, `quality-check.mjs:19-22,44`, `admin-keywords.mjs:43-53`, `admin-data.mjs:28-65`, `area-figures.mjs`, `tests/admin.test.mjs`, `admin-estimate.tsx`).

- **Pipeline-Dauern richtiggestellt:** `run` dauert planmäßig bis ~90 s (`RUN_MS`). Die neue Abnahme lautet „`run` ≤ ~100 s, Status < 2 s, kein Timeline-GET während eines Auftrags“. Die Timeline-Zahlen im Log sind korrigiert (145 × 55–92 s, 8 warm).
- **Qualitätsprüfungen:** Der Gebietsfilter steht immer hinter der geklammerten Bedingung (`WHERE (${condition}) AND region_id IN …`). Dazu kommt ein Test für `badEventDate`. Einheiten werden binär sortiert, nicht mit `localeCompare`.
- **EXPLAIN-Test:** Erwartet werden genau drei `CORRELATED SCALAR SUBQUERY` unter `MATERIALIZE`. Die Forderung „json_each(events) nicht doppelt“ ist gestrichen.
- **Schreiben je Gebiet:** Massen-Upsert über `json_each(?)` mit `WHERE true`, höchstens 10 Schreibanweisungen je Schritt (statt bis zu 1.000 Einzelanweisungen). Die „80 Anweisungen je Batch“ stehen jetzt unter „vermutet“.
- **Bauaufträge gegen doppeltes Zählen:** Vergleichen-und-Tauschen auf `next` in einem Batch, mit der Bedingung G in allen Inserts. Neuer Test „doppelter Schritt“. Die Sperre allein gilt nicht mehr als Schutz.
- **Chunk-Größen:** aus der Index-Zählung über `topics` statt aus `region_stats.count` (neue Gebiete). Der Haken liest nur die eigenen Zeilen.
- **Erstes Füllen:** `unbuilt` ist von `pending` getrennt. Die Oberfläche zeigt bis `unbuilt===0` keine Teilsummen, die Hochrechnung antwortet 409.
- **ETag:** Die Stempel enthalten `max(computed_at)` sowie `SERIES_VERSION`/`FIGURES_VERSION`. Grund: `--full` und Versionswechsel.
- **Prüfliste:** Bei mehr als 100 veralteten Gebieten lief bisher ein Vollscan. Neu: Zählung bis 500 Gebiete über `json_each`, darüber `total:null` und eine Liste über die 5.000 zuletzt geänderten Berichte. R1 und der Lesetest nennen diese Ausnahmen.
- **Hochrechnung GET:** Der Vorspann enthält `computed`, `computedAt`, `revision`, `currentRevision`, `stale` und `stand`. Ohne Stand gilt `{computed:false}`. P18 (Stand-Zeile) kommt vor P19.
- **Import-Haken:** exakte Stelle im Block von `sync.ts:44`, mit `data.resume`. R4 nennt den Haken als Ausnahme von der Sperre.
- **Tests und Stubs:** Der Stub in `tests/admin.test.mjs:184` ist in P03 und P15a nachgeführt. Die Route ist ohne `request` aufrufbar. Alle vier rechnenden Tests (`:76`, `:100`, `:122`, `:142`) sind benannt. Der Parametertest wird zuerst kopiert und erst in P15a entfernt. `sqliteAdapter` ersetzt den Batch ohne Transaktion. In P28 werden die Routenliste und die `no-store`-Prüfung umgestellt.
- **Reihenfolge:** P08 (alt, Budget 0) ist in P15a aufgegangen. Bis dahin bleibt Budget 4000. Die Stand-Zeile der Abruf-Seite folgt erst in P27a (über `summary`). P09–P15b werden gemeinsam deployt.
- **Kleinere Modelle:** Große Pakete sind aufgeteilt: P15a/b, P21a–c, P24a/b, P27a–d. `RegionCatchUp` liegt in der eigenen Datei `components/admin-catch-up.tsx`. Die interne Route prüft nur das Bearer-Token. Die Antwortformen von `refreshStep` und `POST quality` sind festgelegt.
- **Stand-Typ:** `changes:number|null` (alte Stände ohne `stockSum`). Text „≈ N geänderte Datensätze seither“, ab 10.000 „viele Änderungen seither“.
- **Stichwörter:** Nur bei den Regelwörtern weicht die Schreibweise ab, die KI-Stichwörter sind exakt gleich. `j.value IS NOT NULL` ist ergänzt. Die Reihenfolge bei `rule` ist `ORDER BY g,n DESC,k`.
- **Veraltet bei Qualitätsprüfungen:** wird jetzt beim Lesen über `stockSum` bestimmt, bei den orphan-Prüfungen zusätzlich über `content`.
- **CSS-Schritt 1:** Gelöscht werden nur die Tabellenstellen. Die Admin-Regeln in Zeile 79, 85–97, 158–160 und ab 177 bleiben.
- **Texte:** Revision und Stand im Glossar sind korrigiert. Die Stufe 02 beschreibt jetzt die Pakete über Gebiete hinweg. `undated` umfasst fehlerhafte Tage. `HELP`-Titel stehen schon in P30. Die Filterliste in `admin-processing.tsx:31` ist ergänzt.
- **Kleinkram:** `GET(request)` in vier Routen; `cache` je Methode; Zustand `refreshing` in P06; `busy_timeout` im Skript; R7 mit Ausnahme für den Rückfall ohne 0011; Zeilenangaben korrigiert (`admin-timeline.tsx:8-9`, `admin-forecast.tsx:9`, `coverage.mjs:32-43`, `internal/sync/route.ts:5-6`, `admin-processing-map.tsx:28`, `ai-job.mjs:13-26`); einheitliches Ziel: Abruf < 1,5 s, alle anderen Seiten < 1 s.