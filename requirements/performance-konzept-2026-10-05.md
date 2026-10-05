# Performance-Konzept · 05.10.2026

Stand: 5. Oktober 2026. Grundlage: Messungen an der lokalen Datenbank und am Dev-Server, ein aktueller Produktions-Build und drei Codeanalysen (Suche und Datenbank, Frontend, Admin und Importe). Die Vorarbeiten [performance-review-2026-09-27.md](performance-review-2026-09-27.md) und [hosting-performance-analyse-2026-10-03.md](hosting-performance-analyse-2026-10-03.md) gingen von 25.000 bzw. 70.000 Vorgängen aus; heute sind es 902.310. Fast alle Engpässe stammen aus diesem Wachstum.

Alle Zeiten sind lokal gemessen (Dev-Server, D1 in Miniflare). In der Produktion sind die Absolutwerte anders, die Verhältnisse gelten.

## Kurzfassung

1. **Die Datenbank läuft voll.** 9,17 GB von 10 GB, die D1 höchstens erlaubt. Allein am 05.10. kamen 0,72 GB Versionen hinzu. Die Hälfte der Versionszeilen unterscheidet sich vom Vorgänger nur in Zeitstempeln. Ohne Gegenmaßnahme scheitern Importe in wenigen Tagen. **Das ist der dringlichste Punkt.**
2. **Jede Suche dauert 4 bis 6 Sekunden und liefert 0,5 MB.** Ursachen: Die Liste aller 5.030 Gemeinden als Filter verhindert die Indizes (erste Seite 730 ms statt 7 ms). Pro Anfrage laufen fünf Vollscans. Der Abdeckungsstand aller Gebiete (400 KB) steckt in jeder Antwort. Nichts wird zwischengespeichert. Die Suche läuft außerdem auf jeder Unterseite mit, auch im Impressum.
3. **Beim ersten Besuch erscheinen Treffer erst nach etwa 8,5 Sekunden.** Die Startseite lädt zuerst 2,4 MB Kartendaten und 527 KB Gebietskatalog als JavaScript, dann wartet sie auf die Suche.
4. **Zwei öffentliche Endpunkte bringen den Server zum Absturz.** `/api/analytics` lud im Test alle Vorgänge in den Speicher; der Worker brach mit „heap out of memory“ ab und nahm den ganzen Dev-Server mit. `/api/topics/<id>/related` liest die gesamte Vorgangstabelle. Beide sind ungenutzt, aber für jeden aufrufbar.
5. **Die Administration rechnet bei jedem Aufruf alles neu.** Übersicht 12 bis 60 Sekunden über 5 GB JSON, Stichwörter 61 Sekunden. Während eines Abrufs wirkt kein Zwischenspeicher, weil jede geschriebene Zeile den Datenstand weiterzählt.

Mit Stufe 0 des Fahrplans (Abschnitt 4, etwa zwei Arbeitstage) sind erreichbar: Suche unter 1 Sekunde und 50 KB, erste Treffer nach 2 bis 3 Sekunden, halbiertes Datenbankwachstum, keine abstürzenden Endpunkte.

## 1. Messungen

### Datenbank

| Tabelle | Zeilen | Größe |
|---|---:|---:|
| `topics` (Vorgänge, JSON) | 911.865 | 6,0 GB |
| `article_versions` (volle Kopien früherer Stände) | 268.853 | 2,1 GB |
| `search_cards` | 902.310 | 0,59 GB |
| `system_state` (davon `import-debug` 43 MB) | 4.374 | 63 MB |
| Indizes zusammen | | rund 0,3 GB |
| **Gesamt** | | **9,17 GB** |

- Durchschnittliche Nutzlast eines Vorgangs: 4,9 bis 5,9 KB. Davon sind 28 bis 36 % Anwesenheitslisten, die bei jedem Tagesordnungspunkt derselben Sitzung erneut gespeichert sind.
- In der Datenbank wurde nie `ANALYZE` ausgeführt; dem Abfrageplaner fehlen Statistiken.

### Öffentliche Endpunkte

| Aufruf | Zeit (wiederholt) | Antwort | Cache |
|---|---:|---:|---|
| Startseite `/` (HTML) | 50 ms | 50 KB | – |
| Suche ganz Deutschland, ohne Begriff (erster Aufruf jeder Seite) | 4,4–4,5 s | 484 KB | `no-store` |
| Suche mit Begriff („Schule“, „Windpark“) | 5,3–5,9 s | 430–490 KB | `no-store` |
| Suche Seite 2 oder 50 | 4,7–6,0 s | 485 KB | `no-store` |
| Suche mit Gebiet oder Thema | 1,1–1,7 s | 410–510 KB | `no-store` |
| `/api/sources` | 6,3 s kalt, 0,6 s warm | 455 KB | `no-store` |
| `/api/analytics` ohne Parameter | Absturz nach 33 s (Speicher) | – | – |
| `/data/de_map.json` | 15 ms | 2,4 MB (1,2 MB gzip) | `no-cache` |

Zusammensetzung einer Suchantwort: 20 Artikel 13 KB, `coverage` (Abdeckung aller 4.591 Gebiete) 397 KB, `areaCounts` 16 bis 79 KB.

Gezielte Messung der Standardsuche direkt in SQLite:

| Abfrage | mit Liste aller Gemeinden | ohne Liste |
|---|---:|---:|
| Treffer zählen | 690 ms | 53 ms |
| erste Seite (20 Treffer) | 730 ms | 7 ms |
| Begriff „Windpark“ (Volltextvergleich mit `instr`) | 1.040 ms je Teilabfrage | |

### Erster Besuch im Browser (Startseite)

- HTML nach 0,8 Sekunden, aber es enthält nur den Rahmen („Karte wird aufgebaut …“, „Einträge werden geladen …“).
- Danach: Kartendaten 2,4 MB, Suche 5,3 Sekunden. **Erste Treffer nach etwa 8,5 Sekunden.**

### Produktions-Build (05.10.2026)

| Paket | roh | gzip | Geladen |
|---|---:|---:|---|
| `App` (gesamte öffentliche Oberfläche) | 336 KB | 101 KB | sofort |
| `regions` (Gebietskatalog aller Länder) | 527 KB | 140 KB | sofort |
| `framework` (React) | 186 KB | 58 KB | sofort |
| CSS (eine Datei für alle Seiten, auch Admin) | 295 KB | rund 45 KB | sofort, blockiert das Rendern |
| `jspdf` und `html2canvas` | 585 KB | 170 KB | erst beim Export |
| `germany-heatmap` (alte Analyseseite) | 1.085 KB | 359 KB | nur auf `/analysen` |
| Server-Paket | 29 MB | | eingebettete Startdaten (`data/topics.json` 10,9 MB, NRW-Snapshot 4 MB) |

Zusammen mit den Kartendaten überträgt der erste Besuch rund 1,6 MB komprimiert.

### Administration

| Aufruf | Zeit | Antwort |
|---|---:|---:|
| `/api/admin/overview` | 12 s warm, 59 s kalt | 4,7 MB |
| `/api/admin/keywords` | 61 s | 260 KB |

## 2. Ursachen

### 2.1 Suche (`server/integrations/monitor-search.mjs`)

- **Gemeindeliste statt Ebene.** Ohne Ortsfilter wird jede Teilabfrage mit `region_id IN (SELECT value FROM json_each(?))` und allen 5.030 Gemeinde-IDs (70 KB) gefiltert (`:39`, `:49`, `:53`). Damit liest SQLite alle Zeilen über den Gebietsindex, holt jede Tabellenzeile und sortiert danach. Die Liste dient nur dazu, Kreise auszuschließen; dafür fehlt eine Spalte für die Ebene.
- **Acht Abfragen pro Anfrage, fünf davon Vollscans** (`:70-80`): Anzahl, Ergebnisseite, Gebiets-, Themen- und Statusfacetten, Abdeckung, Stand. D1 führt sie nacheinander aus. Die Gebietsfacette ignoriert den Ortsfilter und liest auch bei einer einzelnen Gemeinde alle Zeilen.
- **Abdeckung in jeder Antwort.** `coverage` (`:77`, `:87`) hängt nicht von den Filtern ab, wird aber bei jeder Anfrage berechnet und als 400 KB mitgeschickt.
- **Begriffssuche ohne Index.** `instr(search,?)` (`:63`) liest den Suchtext aller Zeilen, und das in jeder der fünf Teilabfragen. Kein FTS. `noformal` prüft zusätzlich 17 `LIKE`-Muster je Zeile.
- **Ergebnisseite mit Nachschlagen in den Vorgängen.** Für jede Trefferzeile laufen zwei Unterabfragen in die 6-GB-Tabelle `topics` (`steps` aus `events`, `sourceUrl`). Seiten weit hinten blättern mit `OFFSET` bis 4.980.
- **Kein Cache.** `app/api/search/route.ts` setzt `no-store`. Die Startabfrage ist für alle Besucher eines Tages gleich und wird trotzdem jedes Mal neu berechnet.
- **Suche auf jeder Seite.** `components/ratsmonitor/App.tsx` hält die Übersicht auf allen Seiten versteckt geladen; `state/search.tsx:293-319` startet die Suche ohne Prüfung der Route. Detailseite, FAQ, Impressum und Konto lösen deshalb jeweils die 5-Sekunden-Suche aus. Pro Tastendruck (nach 180 ms) folgt eine weitere. Export (`lib/exportResults.ts`) und gespeicherte Suchen fragen bis zu 25-mal nacheinander.
- **Folge für alle anderen Anfragen:** D1 führt eine Abfrage nach der anderen aus. Jede lange Suche hält Detailseiten und Importe auf.

### 2.2 Erstaufruf und Bedienung im Browser

- **Keine Daten im ersten HTML.** Die öffentliche Oberfläche ist eine einzige Client-Komponente. Treffer erscheinen erst nach JavaScript, Hydrierung, einem 180-ms-Timer und der Suche.
- **Kartendaten auf jeder Seite.** `public/data/de_map.json` (2,4 MB) wird auf `/` sofort und auf allen anderen Seiten im Leerlauf geladen. Das Zerlegen (`lib/geo/geoModel.ts`: 284.000 Punkte, rund 700.000 Linienbefehle, Sortieren mit `localeCompare`) läuft in einem Stück auf dem Hauptthread, auf einem Mittelklasse-Handy geschätzt 1 bis 2 Sekunden. Die Datei hat keinen Hash im Namen und wird bei jedem Besuch neu validiert.
- **Ein Paket für alle Seiten.** `App.tsx` importiert Übersicht, Detail, Konto, Kalender, Infoseiten und Rechtliches statisch. Der Gebietskatalog (527 KB) kommt über `state/search.tsx` → `shared/regions.ts` → `shared/catalog.mjs` mit, obwohl der Browser ihn nur selten braucht. Datumsauswahl (`react-day-picker`, `date-fns`) wird geladen, auch wenn der Filter geschlossen bleibt.
- **Jeder Tastendruck rendert fast alles neu.** Ein einziger Kontext (`state/search.tsx:225`) für Eingabe, Ergebnisse und Popup. Pro Taste: Ortsvorschläge über 11.600 Einträge mit `localeCompare`, Neuzeichnen aller 20 Karten, und die Karte aktualisiert sich (`MapPanel.tsx:58-83`, `mapEngine.ts:114` serialisiert dafür 490 KB mit `JSON.stringify`).
- **Weichzeichner über der Karte** (`backdrop-filter: blur`) kostet auf Handys viel Grafikleistung.
- **CSS für alles.** Eine Datei mit Admin-, Analyse- und öffentlichen Regeln (295 KB), Tailwind durchsucht das ganze Repository.
- **Detailseite liest doppelt.** `generateMetadata` und die Client-Komponente lesen denselben Vorgang (`beschluss/[id]/page.tsx`, `DetailPage.tsx:18`), dazu die versteckte Suche.

### 2.3 Datenbankgröße und Schreiblast

- **Versionen ohne inhaltliche Änderung.** `server/services/sync.ts:124` vergleicht `JSON.stringify(events)`; darin steckt `attendance.fetchedAt`. Jeder erneut gelesene Termin erzeugt deshalb eine neue Version und schreibt den Vorgang komplett neu. Bei 1.741 untersuchten Versionspaaren unterschieden sich 51 % nur in `fetchedAt`, `lastFetchedAt`, `updatedAt` oder `quality.checkedAt`. Dasselbe gilt für `apply-backfill.mjs:24-26`.
- **Versionen sind volle Kopien** (Durchschnitt 7,6 KB, bis zu 18 je Vorgang), es wird nichts gelöscht.
- **Anwesenheitslisten mehrfach.** Sie stehen in jedem Tagesordnungspunkt derselben Sitzung, mit wiederholter Quelladresse je Person: 28 bis 36 % jeder Nutzlast.
- **Revision je Zeile.** Zwölf Trigger (`drizzle/0004`) zählen den Datenstand bei jeder geschriebenen Zeile weiter, auch für Abdeckung und Versionen. Jeder Importschritt erhöht ihn, auch ohne Änderungen. Dadurch verfällt jeder Zwischenspeicher, der am Datenstand hängt, während eines Abrufs ständig.
- **Viel Nebenlast je Importschritt:** `import-debug` (bis 204 KB je Gebiet), der Auftrag als 504-KB-JSON (zweimal je Schritt neu geschrieben), `import_runs` (11.196 Zeilen, 6.307 an einem Tag) ohne Bereinigung.

### 2.4 Administration und Auswertungen

- **Übersicht** (`admin-data.mjs:40-43`): ein `GROUP BY` über alle Vorgänge mit 84 `json_extract`, 7 `json_each` und 6 `json_array_length` je Zeile. Die Zählung je Gebiet allein dauert 97 ms; der Rest ist JSON-Auswertung über 5 GB. Der Zwischenspeicher hängt am Datenstand (siehe 2.3) und zusätzlich an der Stunde.
- **4,7 MB Antwort:** ein Objekt je Gebiet (5.324), davon 3.206 ohne Daten mit Platzhaltern (1,9 MB), doppelte Felder, Katalogdaten, die der Browser schon hat.
- **Stichwörter** (`admin-keywords.mjs:34-54`): fünf Vollscans, nicht zwischengespeichert. Zeitverlauf und Hochrechnung scannen ebenfalls; die Hochrechnung wechselt ihren Schlüssel täglich.
- **Importe lesen ganze Gebiete:** `sync.ts:101-105` lädt bei jedem Schritt alle Nutzlasten des Gebiets (Dortmund: 88,5 MB JSON-Text). Das liegt nahe an der Speichergrenze eines Workers (128 MB).

### 2.5 Öffentliche Endpunkte ohne Begrenzung

| Endpunkt | Problem | Genutzt |
|---|---|---|
| `/analysen`, `/api/analytics`, `/api/analytics/articles` | `SELECT … FROM topics` ohne Bedingung, rund 680 MB in den Speicher (geschätzt) | nein (alte Analyseseite) |
| `/api/topics/<id>/related` | `WHERE source='district'` ohne Index, liest die ganze Tabelle | nein |
| `/api/topics` (Feed) | sortiert über `json_extract` in der Nutzlast aller Vorgänge eines Gebiets | nein |
| `/api/calendar`, `/api/calendar/ics` | liest die Nutzlasten aller Vorgänge von bis zu 500 Gebieten; ICS-Abos fragen alle 6 Stunden | ja |
| `/api/sources` | Schleife 5.324 × 2.113 × 2.093 in JavaScript | ja |

## 3. Konzepte

Aufwand: S = Stunden bis 1 Tag, M = mehrere Tage, L = eine Woche oder mehr.

### Konzept A: Speicherplatz sichern

| # | Maßnahme | Wirkung | Aufwand |
|---|---|---|---|
| A1 | Zeitstempel (`fetchedAt`, `lastFetchedAt`, `updatedAt`, `quality.checkedAt`, `attendance.fetchedAt`) beim Vergleich „hat sich etwas geändert?“ ausnehmen (`sync.ts:124`, `apply-backfill.mjs:24`) | etwa halb so viele Versionen und Neuschreibungen, halb so viel Triggerarbeit | S |
| A2 | Versionen begrenzen: höchstens die letzten N inhaltlichen Stände je Vorgang, ältere löschen; künftig als Differenz oder gzip-BLOB statt voller Kopie | 1,5 bis 2 GB frei | M |
| A3 | `import-debug` nur für den letzten Lauf je Gebiet und gekürzt; `import_runs` nach 30 Tagen löschen; Auftragspositionen in eine eigene Tabelle statt 504-KB-JSON | rund 60 MB frei, weniger Schreiblast je Schritt | S |
| A4 | Anwesenheit in eine Tabelle je Sitzung (`meeting_attendance`) | Nutzlast −28 bis −36 %, rund 1,4 GB frei, jeder Scan schneller | M–L |
| A5 | Nach A2 bis A4: `VACUUM` (lokal) bzw. Neuaufbau der Datenbank, da D1 freigegebene Seiten sonst nicht an das Limit zurückgibt (prüfen) | Platz tatsächlich frei | S |

Reicht das nicht dauerhaft, die Datenbank teilen: Versionen und Debugdaten nach R2 oder in eine zweite D1-Datenbank, notfalls Vorgänge nach Ländern trennen.

### Konzept B: Suche neu zuschneiden

| # | Maßnahme | Wirkung | Aufwand |
|---|---|---|---|
| B1 | Spalte `level` (Gemeinde/Kreis) in `search_cards` mit Index `(level, date)`; die Gemeindeliste nur noch für echte Teilmengen (Umkreis, Land) | erste Seite 730 → unter 10 ms, Zählung 690 → rund 60 ms | S |
| B2 | `coverage` und `updatedAt` aus der Suchantwort nehmen: eigener Endpunkt, nach jedem Import neu berechnet, lange zwischengespeichert | −400 KB je Antwort und je Tastendruck, −2 Abfragen | S |
| B3 | Anzahl und drei Facetten in einer Abfrage (`GROUP BY region_id, label, status`) über den Grundfilter, Summen in JavaScript | vier Durchläufe werden einer | S–M |
| B4 | Abdeckender Index `search_cards(region_id, date, label, status)`, danach `PRAGMA optimize` | Zählen und Facetten lesen 45 MB Index statt 563 MB Tabelle | S |
| B5 | `steps`, `sourceUrl` und ein Merker `formal` direkt in `search_cards` (Trigger und Nachbefüllung) | keine Nutzlast-Lookups je Treffer, keine 17 `LIKE` je Zeile | M |
| B6 | Blättern per Schlüssel (`date, id`) statt `OFFSET` | tiefe Seiten so schnell wie Seite 1 | S–M |
| B7 | Volltextindex FTS5 (Trigramm) für Begriffe | Begriffssuche von Sekunden auf 10 bis 100 ms; Achtung: Index von geschätzt 0,7 GB, also erst nach Konzept A | M–L |
| B8 | `areaCounts` nur für die angezeigte Ebene und kompakt | kleinere Antworten | S |
| B9 | Datenstand vor statt nach der Abfrage prüfen (`:82`), Zahl der Begriffe begrenzen (D1 erlaubt 100 Parameter) | keine verschwendeten Abfragen bei 409, keine 503 bei vielen Begriffen | S |

### Konzept C: Zwischenspeicher an der Kante

| # | Maßnahme | Wirkung | Aufwand |
|---|---|---|---|
| C1 | „Veröffentlichter Datenstand“: ein Zähler, der am Ende eines Importschritts oder Analyselaufs steigt statt bei jeder Zeile (ersetzt die zwölf Zeilentrigger) | Zwischenspeicher bleiben während Abrufen gültig; weniger Schreiblast | S–M |
| C2 | Suche, Artikel, Quellen und Kalender über die Workers Cache API zwischenspeichern, Schlüssel = Anfrage + veröffentlichter Datenstand; `s-maxage` 60 bis 300 s und `stale-while-revalidate` | Startabfrage und beliebte Seiten fast ohne Datenbankarbeit | S–M |
| C3 | `de_map.json` mit Hash im Namen und `Cache-Control: max-age=31536000, immutable` (`_headers`) | kein Revalidieren bei Wiederbesuchen | S |
| C4 | Client: kleiner Zwischenspeicher je Suchschlüssel (Zurückblättern, Filter zurücksetzen) | weniger Anfragen beim Bedienen | S |

### Konzept D: Schlankes Frontend

| # | Maßnahme | Wirkung | Aufwand |
|---|---|---|---|
| D1 | Suche nur auf der Übersicht starten, nicht auf Detail-, Info- und Kontoseiten (`state/search.tsx:293`) | eine 5-Sekunden-Suche und 0,5 MB weniger je Seitenaufruf | S |
| D2 | Erste Anfrage ohne 180-ms-Wartezeit; später die erste Ergebnisseite auf dem Server rendern und mitliefern | Treffer sichtbar, sobald die Seite da ist | S / M |
| D3 | Tastendruck: 300 bis 400 ms warten, Mindestlänge; Eingabe lokal halten (`useDeferredValue`); Suchkontext in Eingabe, Ergebnisse und Aktionen aufteilen; `filterChips` einmal berechnen | flüssiges Tippen, weniger Anfragen | M |
| D4 | Karte zweistufig: leichte Übersichtsgeometrie für den ersten Aufbau, volle Gemeindegrenzen erst beim Heranzoomen oder bei Ortswahl; Zerlegen im Web Worker | Kartendaten und Hauptthread-Arbeit beim Start auf einen Bruchteil | M–L |
| D5 | Karte nicht bei jedem Tastendruck aktualisieren (`inScope` stabil, Revision statt `JSON.stringify` in `mapEngine.update`); `flyTo` nur bei echtem Zielwechsel | keine Kartenarbeit beim Tippen | S |
| D6 | `norm()` auf ganze Zeichenketten statt Zeichen für Zeichen (`lib/text.ts`), ein gemeinsamer `Intl.Collator` | schnellere Ortsvorschläge und Hervorhebung | S |
| D7 | Seiten einzeln nachladen (`React.lazy` in `App.tsx`: Detail mit Export, Konto, Kalender, Info, Rechtliches, Datumsauswahl); Gebietskatalog per `import()` nur bei Bedarf | rund 140 KB gzip Katalog und ein großer Teil von `App` weniger beim Start | M |
| D8 | Admin- und Analyse-CSS nur in deren Layouts; Tailwind auf `app/` und `components/` beschränken; genutzte Schriften vorladen, ungenutzte Fira-Regeln entfernen | kleineres, nicht blockierendes CSS | S–M |
| D9 | Kein Weichzeichner auf kleinen Bildschirmen | weniger Grafiklast auf Handys | S |
| D10 | Detailseite: Vorgang vom Server an den Client übergeben statt doppelt lesen; Anwesenheit erst bei Bedarf | halbe Leselast je Artikel | S–M |
| D11 | Eingebettete Startdaten (`topics.ts:4-6`, 15 MB) nur im Fehlerfall dynamisch laden | schnellerer Kaltstart des Workers | S |

### Konzept E: Vorberechnete Kennzahlen

| # | Maßnahme | Wirkung | Aufwand |
|---|---|---|---|
| E1 | Tabelle `region_stats` (Anzahl, Themen, Verarbeitungsstufen, offene Analysen, letzte Abrufe), am Ende jedes Importschritts und Analyselaufs für das betroffene Gebiet neu berechnet, dazu „alles neu berechnen“ im Admin | Admin-Übersicht und `/api/sources` lesen 2.000 kleine Zeilen statt 5 GB: 12 bis 60 s → unter 100 ms | M |
| E2 | Admin-Übersicht teilen und verschlanken: Zusammenfassung, Quellentabelle, Details je Gebiet bei Bedarf; nur Gebiete mit Daten oder Quelle, ohne Katalogfelder | 4,7 MB → geschätzt 0,6 bis 0,8 MB | S–M |
| E3 | Schmale Faktentabelle `topic_facts` (Gebiet, Status, Thema, Verarbeitungsstufe, erstes und letztes Sitzungsdatum, PDF-Anzahl) oder virtuelle Spalten mit Index statt JSON-Auswertung | alle Admin- und Prüfabfragen lesen 50 Byte statt 5,9 KB je Zeile | M–L |
| E4 | Tabelle `topic_events` (Vorgang, Gebiet, Tag, Gremium, Status, Adresse) mit Index `(region_id, day)` | Kalender, ICS, Zeitverlauf, Hochrechnung und `steps` der Suche ohne Nutzlast-Scan | M |
| E5 | Stichwörter sofort zwischenspeichern und in einem Batch abfragen; später `topic_terms`-Tabelle | 61 s nur beim ersten Aufruf je Datenstand, später Millisekunden | S, dann M |

### Konzept F: Öffentliche Endpunkte absichern

| # | Maßnahme | Wirkung | Aufwand |
|---|---|---|---|
| F1 | `/analysen`, `/api/analytics*`, `/api/topics/<id>/related` und `/api/topics` entfernen oder auf `/` umleiten (laut Hosting-Analyse ohnehin offen) | keine Abstürze und Vollscans durch Aufrufe von außen | S |
| F2 | Kalender auf `topic_events` umstellen (E4), bis dahin Zeitraum und Gebietszahl begrenzen und zwischenspeichern | kalkulierbare Last auch bei ICS-Abos | S / M |
| F3 | Zugriffsbegrenzung für `/api/search` und Export (Rate-Limit-Regel bei Cloudflare) | Schutz vor Lastspitzen | S |

## 4. Fahrplan

**Stufe 0: sofort (etwa zwei Arbeitstage).** Wichtig, weil die Datenbank sonst volläuft und die Suche jeden Besuch ausbremst.

1. A1 Zeitstempel aus dem Änderungsvergleich nehmen.
2. A3 Debug- und Laufdaten begrenzen.
3. F1 ungenutzte, gefährliche Endpunkte entfernen.
4. B1 Spalte `level` statt Gemeindeliste, B2 Abdeckung auslagern, B9.
5. D1 Suche nur auf der Übersicht, D2 ohne Wartezeit.
6. C3 Kartendaten dauerhaft cachen.
7. `ANALYZE` bzw. `PRAGMA optimize` einmal ausführen.

Erwartung: Suche ohne Begriff unter 1 Sekunde und rund 50 KB, erste Treffer nach 2 bis 3 Sekunden, Detailseiten ohne versteckte Suche, Versionswachstum etwa halbiert.

**Stufe 1: ein bis zwei Wochen.**

- C1 und C2: veröffentlichter Datenstand und Zwischenspeicher an der Kante.
- B3, B4: Facetten bündeln, abdeckender Index.
- E1, E2: Kennzahlentabelle und schlanke Admin-Übersicht; E5 Stichwörter.
- A2: Versionen begrenzen, danach A5.
- D5, D6, D7, D8, D10, D11.

Erwartung: Startseite und häufige Suchen aus dem Zwischenspeicher in Millisekunden, Admin-Übersicht unter 1 Sekunde, deutlich weniger JavaScript beim Start, 1,5 bis 2 GB frei.

**Stufe 2: mehrere Wochen.**

- B5, B6, B7: Suchkarten mit Schritten, Blättern per Schlüssel, Volltextindex.
- A4: Anwesenheit je Sitzung.
- E3, E4: Faktentabelle und Termintabelle, damit F2.
- D3, D4, D9: Bedienung beim Tippen, zweistufige Karte im Web Worker.
- Erste Ergebnisseite serverseitig rendern (D2 zweiter Teil).

**Stufe 3: bei Bedarf.** Datenbank teilen (Versionen nach R2, Länder getrennt), Importe per Zeitplan und Warteschlange statt aus dem Admin-Browser (siehe Hosting-Analyse, Phase 2).

## 5. Ziele und Nachweis

| Kennzahl | heute (lokal) | Ziel nach Stufe 1 |
|---|---:|---:|
| Suche ohne Begriff, ganz Deutschland | 4,4 s, 484 KB | < 300 ms, < 50 KB (aus Cache < 50 ms) |
| Suche mit Begriff | 5,3–5,9 s | < 1 s (nach B7 < 300 ms) |
| Erste Treffer auf der Startseite | ~8,5 s | < 2 s |
| Detailseite (Daten) | Suche plus zwei Lesezugriffe | ein Lesezugriff, aus Cache |
| Admin-Übersicht | 12–60 s, 4,7 MB | < 1 s, < 1 MB |
| Datenbankgröße | 9,17 GB, +0,3 bis 0,7 GB je Importtag | < 7 GB, Wachstum halbiert |
| JavaScript beim Start (gzip) | ~300 KB plus 1,2 MB Karte | < 200 KB plus < 300 KB Karte |

Nachweis: die Messskripte dieser Analyse vor und nach jeder Stufe wiederholen (Endpunktzeiten, Tabellengrößen, Build-Größen) und danach einmal in der Produktion messen (Workers-Analytics, D1-Abfragestatistik, Lighthouse auf einem Mittelklasse-Handy). Lokale Werte sind nur im Verhältnis aussagekräftig.

## 6. Risiken und offene Fragen

- **Limits der Produktion prüfen:** Abfragedauer von D1 (vermutlich 30 Sekunden; die Admin-Scans von 60 Sekunden würden scheitern), Speicher eines Workers (128 MB; Importe großer Gebiete liegen nahe daran), Zeilenlesekosten (eine Suche liest heute mehrere Millionen Zeilen).
- **Migrationen über 900.000 Zeilen** (neue Spalten, Indizes, Nachbefüllung) in Abschnitten ausführen, sonst greifen Zeitlimits. Nachträglich hinzugefügte berechnete Spalten können in SQLite nur `VIRTUAL` sein.
- **Zähler können abweichen**, wenn sie per Trigger gepflegt werden (etwa nach Wiederherstellungen). Neuberechnung je Gebiet und ein „alles neu berechnen“ heilen das.
- **Semantik:** Ignorierte Zeitstempel ändern, was „zuletzt abgerufen“ in einer Version bedeutet. Die Revision je Batch statt je Zeile berührt die 409-Prüfung der Suche und den Datenexport. Eine schlankere Admin-Übersicht ändert den Vertrag `shared/admin-types.ts` und den CSV-Export.
- **Volltextindex** kostet Platz (geschätzt 0,7 GB) und kommt deshalb erst nach Konzept A. Ob D1 virtuelle Tabellen exportiert, ist zu prüfen.
- **Offen:** SQLite-Version von D1, ob vinext `generateMetadata` auch bei Navigation im Browser ausführt, wie stark Tailwinds Scan des ganzen Repositorys das CSS aufbläht.
