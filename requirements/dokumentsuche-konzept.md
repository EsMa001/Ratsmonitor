# Konzept Dokumentsuche (Plenara Pro)

Oct 31, 2026 · @Nico Dirks

## 1. Worum es geht

Die Dokumentsuche wird ein eigenes Pro-Produkt mit eigener Seite `/dokumente`, nicht ein Schalter in der bestehenden Suche. Sie durchsucht die Texte der Hauptdokumente aus der PDF-Ablage (derzeit rund 7 GB `.txt`) und liefert Dokumente mit Fundstellen, Seitenzahl und Textauszug. Die normale Suche über Titel, Kurztext und Gremium bleibt unverändert; `volltext=1` dort wird nicht gebaut und kann entfallen.

Warum eigenes Produkt: Gast, Konto und Plus nutzen dieselbe Suche; ein zusätzlicher Filter rechtfertigt keine 19,99 € im Monat. Eine eigene Seite kann anders aussehen (Dokumente statt Vorgänge, Fundstellen statt Karten), lässt sich zeigen, verlinken und bewerben, und hält die Trefferzahlen der normalen Suche, der Glocken und von plenara.X stabil.

Abgrenzung:

- Keine Antwortgenerierung durch ein Sprachmodell, keine Vektorsuche.
- Die Tippfehler-Korrektur der normalen Suche (Branch `Nico-tippfehler`, `search-suggest.mjs`) ist unabhängig; für die Dokumentsuche bekommt sie ein eigenes Register aus dem Dokumentindex (Abschnitt 9).

|  | Normale Suche (`/suche`) | Dokumentsuche (`/dokumente`) |
| --- | --- | --- |
| Durchsucht | Titel, Kurztext, Gremium (`search_cards.search`) | Text der Hauptdokumente (PDF-Ablage, `.txt`) |
| Ergebnis | Vorgang (Suchkarte) | Dokument mit Fundstellen und Seite |
| Stufen | Gast bis Enterprise | Pro und Enterprise (`FEATURES.fulltext`) |
| Ranking | Datum, optional Relevanz Titel ×3 | bm25 über Seiten, Datum als zweites Kriterium |
| Suchsprache | Wörter, „oder“, exakt | Wörter, Phrasen, UND/ODER/NICHT, Präfix |
| Index | `search_words`, `search_fts` (Trigram) in der Hauptdatenbank | eigene Datei `fts.sqlite` in `RM_PDF_STORE` |

## 2. Nutzererlebnis

**Einstieg.** Am Kopf der Suchseite ein Umschalter „Vorgänge | Dokumente“ im Chip-Stil der Suchleiste, für alle Stufen sichtbar. Am Desktop zusätzlich der Eintrag „Dokumente“ im Kopfmenü neben plenara.X. Die untere Leiste am Handy (Start, Suche, plenara.X, Favoriten, Mehr) bleibt bei fünf Feldern; „Suche“ führt wie heute zu den Vorgängen, der Umschalter sitzt oben auf der Seite.

**Stufen.** Pro und Enterprise landen auf `/dokumente` und suchen. Gast, Konto und Plus sehen beim Tippen auf „Dokumente“ das vorhandene Gate (`GateDialog`, `openLimitGate`) mit zwei Sätzen, was die Dokumentsuche kann, und dem Buchen-Knopf (`usePlusLink('pro')`). `/dokumente` ist auch ohne Pro aufrufbar: Suchfeld oben, darunter ein festes Beispielergebnis (Bild oder statische Zeilen) und der Pro-Hinweis. So lässt sich die Seite aus Preisseite, Mails und Social Media verlinken. Admins prüfen jede Stufe über „ansehen als“.

**Suchen.** Ein Suchfeld mit Ort (dieselbe Ortserkennung wie die Suche, `lib/place.ts`), Zeitraum, Dokumentart (Vorlage, Niederschrift, Antrag, Anlage, Sonstiges) und Gebietsebene. Kein Thema, kein Status: die gehören zum Vorgang. Suchsprache: Wörter (UND), `oder`, Phrase in Anführungszeichen, `-wort` schließt aus, `wort*` als Präfix.

**Treffer.** Eine Zeile je Dokument: Dokumentname, Kommune, Gremium, Sitzungstag, Dokumentart; darunter bis zu drei Fundstellen mit Seitenzahl und Textauszug (rund 160 Zeichen, Begriff fett). Klick auf die Zeile öffnet den Vorgang (`/beschluss/<id>`), Klick auf eine Fundstelle das Originaldokument beim Ratsinformationssystem (wie heute `/api/dokument`), mit Seitenangabe im Link, wo der Viewer das unterstützt (`#page=7`). Ob Plenara die PDFs selbst anzeigt: offene Entscheidung, Abschnitt 9.

**Zahlen.** Trefferzahl als Dokumente, nicht als Vorgänge; Karte optional (Gebiete einfärben wie in der Suche, aber ohne Abzeichen). Blättern wie in der Suche (`page`, `revision`).

**Handy.** Liste zuerst, Karte als Blatt dahinter; Fundstellen brauchen die Breite. Trefferzeile zweizeilig, Fundstellen einklappbar nach der ersten.

**Später, nicht im ersten Schritt:** Glocke auf eine Dokumentsuche (täglich, nur Pro), Export der Fundstellen als CSV, Tippfehler-Vorschlag aus dem Dokumentregister.

## 3. Ausgangslage im Code

Alles, was die Dokumentsuche braucht, liegt in der PDF-Ablage; nichts davon ist heute für Nutzer durchsuchbar.

| Baustein | Wo | Was es liefert |
| --- | --- | --- |
| Textfassungen | `RM_PDF_STORE/files/<ab>/<sha256>.txt` | Seiten roh wie pdf.js, getrennt durch `\f`; `store.textPages(sha)` gibt das Array (`server/node/pdf-store.mjs`) |
| Index der Ablage | `RM_PDF_STORE/index.sqlite` | `pdfs` (url, sha256, status, region\_id, topic\_id, doc\_type, model\_type, formal, event\_date, role), `texts` (sha256, status, method, pages, ocr\_pages, chars, head\_type) |
| Dokumentart | `pdfs.model_type` (Modell), sonst `doc_type` (Titelregel) | Filter Dokumentart; Bedeutung in `shared/document-type.mjs` |
| Sitzungstag, Gebiet, Bericht | `pdfs.event_date`, `region_id`, `topic_id` | Zeitraum- und Ortsfilter, Link zum Vorgang |
| Umlautfaltung | `norm` in `server/integrations/x-terms.mjs` | gleiche Faltung wie `search_cards.search` (ä→a, ß→ss) |
| Stufen | `FEATURES.fulltext` in `shared/plans.mjs`, `gated(…,{feature})` in `server/services/session.ts` | Pro und Enterprise; Oberfläche über `useEntitlements().allowFeature` |
| Gate | `components/ratsmonitor/components/GateDialog.tsx` (`openLimitGate`) | Hinweis plus Buchen-Knopf, wie beim Blättern für Gäste |
| Nachtkette | `scripts/pdf-store/nightly.mjs`, Aufträge in `scripts/pdf-store/job.mjs` (Bahnen „Laden“ und „OCR“) | Einhängepunkt für den Indexschritt |
| Admin | `components/admin-pdf.tsx`, `server/integrations/pdf-store-admin.mjs`, `scripts/pdf-store/stats.mjs` | Kennzahlen und Knöpfe |
| Trefferzeile | `components/ratsmonitor/components/results/ArticleCard.tsx` | Vorlage für Stil, nicht wiederverwenden |

Nicht nutzbar: `search_fts` (Trigram über Suchkarten) und die Wortliste, beide kennen nur Titel, Kurztext und Gremium. Die Route `app/api/search/route.ts` antwortet auf `volltext=1` mit 403/501; diese Zeilen entfallen oder bleiben als Sperre.

Mengen (Stand Oktober 2026): rund 1,5 Mio. Berichte, Texte der Hauptdokumente etwa 7 GB, 95 % mit Textebene, Rest OCR. Anlagen (`pdfs.role='other'`) nur teilweise geladen. Server: 4 Kerne, 15 GB RAM, 193 GB Platte, Ablage-Budget 80 GB.

## 4. Der Index

Eigene Datei `RM_PDF_STORE/fts.sqlite`, eine Zeile je Seite, FTS5 mit `unicode61`, Ranking per bm25. Nicht in der Hauptdatenbank (die hat mit `search_cards` 14 GB genug) und nicht in `index.sqlite` (deren Schreiber sind die Lade- und OCR-Läufe; der Index soll sie nicht sperren).

**Schema** (`server/node/doc-index.mjs`, `openDocIndex(dir)`):

```sql
CREATE TABLE IF NOT EXISTS doc_pages(
  id INTEGER PRIMARY KEY,
  sha256 TEXT NOT NULL,      -- Datei der Ablage
  page INTEGER NOT NULL,     -- 1-basiert
  topic_id TEXT, region_id TEXT, event_date TEXT, doc_type TEXT, role TEXT,
  chars INTEGER NOT NULL,
  UNIQUE(sha256,page)
);
CREATE INDEX IF NOT EXISTS idx_doc_pages_region ON doc_pages(region_id,event_date);
CREATE INDEX IF NOT EXISTS idx_doc_pages_topic ON doc_pages(topic_id);
CREATE VIRTUAL TABLE IF NOT EXISTS doc_fts USING fts5(
  text,
  content='',               -- contentless: der Text bleibt in den .txt-Dateien
  tokenize="unicode61 remove_diacritics 2 tokenchars '-'",
  detail=full
);
CREATE TABLE IF NOT EXISTS doc_index_state(key TEXT PRIMARY KEY, value TEXT);
```

Contentless (`content=''`) spart die zweite Kopie des Textes; Snippets kommen aus der `.txt` (Seite lesen, Begriff suchen, 160 Zeichen ausschneiden), das ist billiger als `snippet()` über 7 GB. `rowid` von `doc_fts` = `doc_pages.id`. `remove_diacritics 2` faltet ä→a wie `norm`; `ß` wird vor dem Einfügen und in der Anfrage zu `ss` ersetzt, damit „Straße“ und „Strasse“ zusammenfallen. `detail=full` für Phrasen und `NEAR`; Platzpreis gegenüber `detail=column` etwa doppelt, siehe Abschnitt 8.

**Welche Seiten:** Dateien aus `index.sqlite` mit `texts.status='ok'`, `COALESCE(pdfs.role,'')<>'other'` (Hauptdokumente, dort ist `role` leer; Anlagen haben `role='other'`, nach Entscheidung in Abschnitt 9), `pdfs.topic_id` gesetzt. Seiten unter 20 Zeichen (`MIN_CHARS` in `store-lib.mjs`) werden übersprungen. Textfassungen mit Status `text-only` (PDF verdrängt) sind drin, der Text bleibt ja.

**Aufbau** (`scripts/pdf-store/index.mjs [--full] [--limit N] [--minutes M]`): liest `pdfs` nach `event_date` absteigend (Neuestes zuerst, damit die Suche früh nützlich ist), je Datei `store.textPages(sha)`, Seiten einfügen, eine Transaktion je 200 Dateien. Stand in `doc_index_state` (`after` = letzter sha256 und Datum, `version`); wiederaufnehmbar nach Abbruch oder `--minutes`. Mit `--full` wird alles neu gebaut (nach Änderung von Tokenizer oder `INDEX_VERSION`). Geänderte Texte (neue `texts.made_at`, OCR nachgeholt): alte Seiten der Datei löschen (`DELETE FROM doc_fts WHERE rowid IN …` per `'delete'`-Befehl, contentless braucht den Text dafür, daher `doc_pages` zuerst lesen und Text neu liefern; einfacher: `INSERT INTO doc_fts(doc_fts,rowid,text) VALUES('delete',?,?)` mit dem alten Text aus der `.txt`), dann neu einfügen. Dateien, die aus der Ablage fallen (Status `gone`), werden entfernt.

**Nachtlauf:** neuer Auftrag `index` in `scripts/pdf-store/job.mjs`, Bahn „Laden“, nach `texts` und vor `rule-texts`; `nightly.mjs --daily` ruft ihn am Ende (`index.mjs --minutes 45`). Tagsüber nach dem OCR-Job (`ocr`) für die Berichte mit neuem Text (`--ids`). Betriebsbegriff in `shared/pipeline-terms.mjs`: Schritt „Dokumente indizieren“, Stufe Verarbeitung.

**Sperre:** `doc_index_state` Schlüssel `lease` mit Zeitstempel, 2 Stunden, wie `search-words-lease`.

**Schreibende Prozesse:** nur das Skript. Der Webdienst öffnet `fts.sqlite` lesend (`readOnly:true`, eigenes Handle neben `index.sqlite`, `PRAGMA query_only`). WAL-Modus, damit der nächtliche Aufbau die Suche nicht blockiert.

(Im Original ein Diagramm „Datenfluss Dokumentsuche“: PDF-Ablage → Indexlauf → fts.sqlite → Route /api/dokumente → Seite /dokumente.)

Der Indexlauf ist der einzige Schreiber; die Route liest den Index und holt den Textauszug je Fundstelle direkt aus der Textfassung.

## 5. Suche und Route `/api/dokumente`

Eine Route, ein Modul, Ergebnisse je Dokument mit bis zu drei Fundstellen; die Antwort ist je Datenstand des Index zwischengespeichert.

**Route** `app/api/dokumente/route.ts`: `export const GET=gated(handler,{feature:'fulltext'})` (ohne Kontendatei, also im Cloudflare-Build, gelten keine Stufen; dort gibt es aber auch keine Ablage, die Route antwortet 503 „Dokumentsuche nicht eingerichtet“). Interne Aufrufe mit `IMPORT_TOKEN` kommen durch.

**Parameter** (`parseDocSearch` in `server/integrations/doc-search.mjs`, gleiche Prüfungen wie `parseMonitorSearch`):

| Parameter | Bedeutung |
| --- | --- |
| `q` | Suchtext, höchstens 200 Zeichen, siehe Suchsprache |
| `area`, `scope`, `more`, `within`, `without` | Ort und Umkreis wie in der Suche (Gebiets-IDs über `searchFilters` ableiten, nur die Gebietsliste übernehmen) |
| `from`, `to` | Zeitraum nach `event_date`, Standard bis heute |
| `art` | Dokumentart: `vorlage`, `niederschrift`, `antrag`, `anlage`, `sonstige` (Abbildung aus `pdfs.model_type`/`doc_type` in `shared/document-type.mjs`) |
| `sort` | `relevance` (Standard) oder `desc` (Sitzungstag) |
| `page`, `size` | wie in der Suche, höchstens Seite 50 |
| `revision` | Stand des Index (`doc_index_state.version`), 409 bei Wechsel |

**Suchsprache** → FTS5-MATCH, gebaut in `toMatch(q)`; nie den Rohtext an MATCH geben (Syntaxfehler, Injektion):

| Eingabe | MATCH |
| --- | --- |
| `wärmeplanung förderung` | `"warmeplanung" AND "forderung"` |
| `kita oder kindergarten` | `("kita") OR ("kindergarten")` |
| `"kommunale wärmeplanung"` | `"kommunale warmeplanung"` (Phrase) |
| `-anlage` | `NOT "anlage"` (nur mit mindestens einem positiven Begriff) |
| `wärme*` | `"warme"*` (Präfix) |
| `wärme NAHE förderung` | `NEAR("warme" "forderung", 10)` |

Faltung vor dem Bauen: `norm` (klein, ohne Diakritika, ß→ss), Füllwörter wie in der Suche entfernen, jedes Token in Anführungszeichen, Sonderzeichen außer `*` und `-` entfernen. Höchstens 12 Begriffe.

**Abfrage** (zwei Schritte, damit Filter und Ranking zusammenpassen):

```sql
-- 1. Seiten mit Rang, gefiltert; Kandidaten gedeckelt
WITH hits AS (
  SELECT f.rowid AS id, bm25(doc_fts) AS rank
  FROM doc_fts f WHERE doc_fts MATCH ?
  ORDER BY rank LIMIT ?            -- CAND_MAX = 20000
)
SELECT p.sha256, p.topic_id, p.region_id, p.event_date, p.doc_type, p.role,
       min(h.rank) AS best, count(*) AS pages, group_concat(p.page) AS page_list
FROM hits h JOIN doc_pages p ON p.id=h.id
WHERE p.region_id IN (SELECT value FROM json_each(?))   -- bzw. NOT IN, wie regionCondition
  AND p.event_date BETWEEN ? AND ?
  AND (? = '' OR p.doc_type = ?)
GROUP BY p.sha256
ORDER BY best, p.event_date DESC
LIMIT ? OFFSET ?;
```

Sehr häufige Begriffe („Antrag“) füllen `CAND_MAX`; dann gilt die Trefferzahl als „mehr als 20.000 Seiten“ und die Seite zeigt die besten, nicht alle. Das ist dieselbe Logik wie `FTS_PAGE_MAX` in der Suche. Für die Trefferzahl ohne Filter reicht `SELECT count(DISTINCT …)` über `hits`; mit Ortsfilter zählt man die gruppierte Abfrage ohne LIMIT, gedeckelt durch `CAND_MAX`.

**Fundstellen** (`snippetsOf(store, sha, pages, terms)`): für die drei bestbewerteten Seiten des Dokuments die `.txt` lesen (`store.textPages(sha)`), Seite holen, ersten Treffer eines Begriffs (gefaltet) suchen, 160 Zeichen um die Stelle schneiden, an Wortgrenzen, Begriffe als `<b>`-Spanne markieren (als `{before,hit,after}`-Tripel, nicht als HTML). Kein Zugriff auf PDFs.

**Antwort** (JSON, `Cache-Control: private, max-age=30`):

```json
{ "total": 412, "capped": false, "page": 1, "pageSize": 20, "revision": "17",
  "documents": [{
    "sha256": "…", "topicId": "…", "title": "Beschlussvorlage V/0486/2026",
    "regionId": "nrw-05315000", "gemeinde": "Köln", "ags": "05315000",
    "gremium": "Stadtentwicklungsausschuss", "date": "2026-09-17", "art": "vorlage",
    "url": "https://…/00588651.pdf", "pages": 14, "hits": 3,
    "snippets": [{"page": 7, "before": "…für die ", "hit": "kommunale Wärmeplanung", "after": " ist bis …"}]
  }],
  "areaCounts": { "05315000": 12, "05": 412 } }
```

Titel, Gremium, Gemeinde und `url` kommen aus `search_cards`/`topics` der Hauptdatenbank über `topic_id` (eine Abfrage je Seite mit `json_each` der IDs); `url` ist die Adresse in `pdfs.url`. `areaCounts` nur für die Karte, gleiche Form wie in der Suche.

**Zwischenspeicher:** `cachedDocSearch` wie `cachedSearch` (`revision-cache.mjs`), Schlüssel = Parameter + `doc_index_state.version`; der Index ändert sich nur nachts, also lange gültig.

**Datenbankhandle:** `openDocIndex` einmal je Prozess, `readOnly`, `busy_timeout 5000`; fehlt die Datei → 503 und Kennzahl im Admin, kein Fehlerlog je Anfrage.

## 6. Frontend

Eine neue Seite `/dokumente` als eigenes Modul neben plenara.X, nachgeladen wie `AnalyticsPages`; die Vorgangssuche (`OverviewPage`) bleibt unverändert bis auf den Umschalter. Vor der Arbeit `components/ratsmonitor/FRONTEND.md` lesen: Farbschema „Petrol klar“, Schriftgrößen 12/14/16/18/22/28/44, Linien statt Kästen, Hauptaktion als Petrol-Pille mit „→“.

**Dateien**

| Datei | Inhalt |
| --- | --- |
| `app/(monitor)/dokumente/page.tsx` | `pageMeta('Dokumentsuche', …, '/dokumente')`, rendert null wie `suche/page.tsx` |
| `components/ratsmonitor/App.tsx` | `isKnownPath` um `/dokumente` erweitern, `pageModule(()=>import('./pages/dokumente/DokumentePage'))`, Klasse `rm-docs` am `html` für Stile |
| `components/ratsmonitor/pages/dokumente/DokumentePage.tsx` | Seite: Kopf mit Suchfeld, Filterzeile, Trefferliste, Blättern, Gast-Ansicht |
| `components/ratsmonitor/pages/dokumente/DocumentRow.tsx` | eine Trefferzeile mit Fundstellen (memo, wie `ArticleCard`) |
| `components/ratsmonitor/pages/dokumente/useDocSearch.ts` | Zustand der Dokumentsuche: Parameter in der Adresse (`?q=&area=&von=&bis=&art=&seite=`), `fetchJson('/api/dokumente?…')`, Abbruch bei neuer Eingabe, 409 → neu laden |
| `components/ratsmonitor/components/SearchModeSwitch.tsx` | Umschalter „Vorgänge \| Dokumente“ |
| `components/ratsmonitor/lib/pageTitle.ts` | Titel „Dokumentsuche“ |
| `app/styles/search.css` | Block „Dokumentsuche“: Fundstellen, Markierung, Handy |
| `components/ratsmonitor/menu/MainMenu.tsx`, `Header.tsx` | Eintrag „Dokumente“ hinter plenara.X (Desktop) |
| `components/ratsmonitor/info/content.ts`, `docs/produkt/stufen.md`, Preisseite | Text für Pro: „Dokumentsuche“ statt „Volltextsuche (folgt)“ |

**Umschalter** (`SearchModeSwitch`): zwei Chips im Stil der Suchleiste (`glass.css`, Chips) am Kopf von `/suche` und `/dokumente`, aktiver Chip Petrol. Klick auf „Dokumente“: `allowFeature('fulltext')` → `push('/dokumente?q=…')` mit dem aktuellen Begriff und Ort; sonst `openLimitGate('fulltext')`. Das Gate braucht einen neuen Fall in `GateDialog.tsx` (Text, Buchen-Knopf `usePlusLink('pro')`, bei Plus „Wechseln zu Pro“). Am Handy sitzt der Umschalter in der ersten Zeile der Suchseite über dem Suchfeld, nicht in der unteren Leiste.

**Seite `/dokumente`** (Pro):

1. Kopfband wie `pl-band` der plenara.X-Seiten: Titel „Dokumentsuche“, ein Satz („Sucht in den Texten der Sitzungsunterlagen, nicht nur in Titeln.“).
2. Suchfeld mit Ortserkennung (dieselbe `SearchBox`-Logik: `place.parse`, übernommener Ort als Chip), Enter sucht. Hilfe-Zeile unter dem Feld: `"Phrase"`, `-wort`, `oder`, `wort*`.
3. Filterzeile: Zeitraum (`DateRangeFilter`), Dokumentart (Chips), Umkreis (wie Suche). Kein Thema, kein Status.
4. Trefferkopf: „412 Dokumente“ (bei `capped`: „mehr als 20.000 Seiten, die besten zuerst“), Sortierung Relevanz/Datum.
5. Liste `DocumentRow`: Zeile 1 Dokumentname (fett) · Dokumentart als Grautext; Zeile 2 Gemeinde · Gremium · Datum (zweistelliges Jahr, `lib/format.ts`); darunter Fundstellen: „S. 7“ in Petrol, Auszug mit `hit` fett. Am Desktop drei Fundstellen offen, am Handy eine, „2 weitere Stellen“ klappt auf. Klick auf Dokumentname → `/beschluss/<topicId>`; Klick auf Fundstelle → `url` in neuem Tab, mit `#page=<n>`.
6. Blättern wie `ResultsPanel` (`page`, Grenze 50), `revision` mitschicken.
7. Karte: im ersten Schritt keine. Später `MapPanel` mit `areaCounts` als Blatt.

**Gast-Ansicht** (Gast, Konto, Plus): gleiches Kopfband und Suchfeld, darunter statt der Liste zwei statische Beispielzeilen (fester Text, deutlich als Beispiel beschriftet) und der Hinweis „Die Dokumentsuche gehört zu Pro“ mit Buchen-Knopf. Enter im Suchfeld öffnet das Gate. Keine Anfrage an die Route.

**Handy:** Liste in voller Breite, Fundstellen mit 14 px, Markierung durch Schrift, nicht Farbe. Umschalter und Filter als Chips in einer scrollbaren Zeile. `rm-docs` steuert in `search.css`, dass die Trefferliste nicht im Karten-Blatt liegt.

**Prüfen:** `node node_modules/typescript/bin/tsc --noEmit --incremental false`, ESLint auf `components/ratsmonitor` (0 Fehler), `node scripts/frontend-index.mjs` und `INDEX.md` mit committen, `node scripts/frontend-check.mjs` vor dem Ausrollen. Gast/Plus/Pro über den DEV-Umschalter prüfen (`basic@`, `plus@`, `pro@plenara.test`).

## 7. Betrieb und Admin

Der Index läuft als weiterer Auftrag der PDF-Ablage mit; Platz und Zeit kommen aus dem Messskript (Abschnitt 8), bevor der Erstaufbau startet.

**Jobs**

| Wann | Was | Wo |
| --- | --- | --- |
| Erstaufbau | `node scripts/pdf-store/index.mjs --minutes 120` an mehreren Tagen (10 bis 22 Uhr, wie Altbestand) oder als Auftrag `index` über den Admin-Knopf; wiederaufnehmbar | Bahn „Laden“ in `job.mjs` |
| Nachts | `nightly.mjs --daily` ruft `index.mjs --minutes 45` nach „Text lesen“ und vor `rule-texts` | `scripts/pdf-store/nightly.mjs` |
| Tagsüber | nach dem OCR-Job die Dateien mit neuem Text (`--ids` bzw. `--since <made_at>`) | Job `ocr`, Folgekette wie bei `read-reports.mjs --ids` |
| Nach Tokenizer-Änderung | `index.mjs --full` (neue `INDEX_VERSION`), Suche bleibt derweil auf dem alten Index, die Datei wird als `fts.next.sqlite` gebaut und am Ende umbenannt | Skript |

**Admin-Reiter „PDF-Import“**, neuer Block „Dokumentindex“: indizierte Dateien und Seiten, Anteil der Ablage (Dateien mit Text ÷ indiziert), Größe von `fts.sqlite`, letzter Lauf mit Dauer, Rückstand (Texte ohne Indexeintrag). Knöpfe „Index aufbauen“ (Auftrag `index`) und „Index neu aufbauen“ (`--full`). Kennzahlen aus `scripts/pdf-store/stats.mjs` (eine Abfrage auf `doc_index_state` und `doc_pages`), Stand in `system_state` `doc-index-last` wie `rule-texts-last`. Ohne Datei: „nicht eingerichtet“.

**Betriebsprüfung** (`ops-check.mjs`): Warnung, wenn der Rückstand über 5 % liegt oder der letzte Lauf älter als 2 Tage ist. Fehlermail über die vorhandene `OnFailure`-Einheit, wenn der Index als eigener Service läuft; als Schritt in `nightly` reicht das Protokoll.

**Platz:** Schätzung bei `detail=full` 5 bis 7 GB, bei `detail=column` 2 bis 3 GB, dazu WAL während des Aufbaus (bis 1 GB). Reiter „Speicher & Sicherungen“ zeigt `fts.sqlite` getrennt. Die Datei gehört nicht in die Sicherung (reproduzierbar aus den Texten), das in `server-disk.mjs` bzw. der Sicherungsliste ausnehmen.

**RAM:** FTS-Abfragen laufen über den Page-Cache; der Webdienst hat `MemoryMax=8G`, der Index belegt im Webprozess nichts Festes. Bei `fts.sqlite` von 6 GB liegt nach einigen Stunden Betrieb ein Teil im Cache, kalte Abfragen lesen von der SSD. Keine Änderung an den systemd-Grenzen nötig; `PRAGMA cache_size` des Handles auf 64 MB.

**Rechte:** die Einheit des Webdiensts braucht Lesezugriff auf `RM_PDF_STORE` (heute liest sie dort schon für `/api/dokument`); `InaccessiblePaths` unberührt.

**Rückbau:** Datei löschen, Umschalter ausblenden (`FEATURES.fulltext=false` für alle), Route antwortet 503. Nichts in der Hauptdatenbank.

## 8. Messskript und erwartete Zahlen

Vor dem Erstaufbau einmal zehn Minuten messen, dann steht fest, wie groß der Index wird und was Abfragen kosten. Das Skript baut einen Probeindex aus den neuesten N Dateien in eine Wegwerfdatei und rechnet hoch.

`scripts/pdf-store/fts-probe.mjs` (geprüft an einer kleinen Testablage, Umlautfaltung inklusive; läuft direkt gegen `RM_PDF_STORE`; nutzt nur `index.sqlite` lesend und die `.txt`-Dateien):

```js
// Probeindex: node scripts/pdf-store/fts-probe.mjs [--files 20000] [--detail full|column]
// Baut tmp/fts-probe.sqlite aus den neuesten N Hauptdokumenten mit Text, misst Größe, Dauer, Abfragezeiten, rechnet hoch.
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
const N=Number(arg('--files',20000)),detail=arg('--detail','full');
const dir=process.env.RM_PDF_STORE||'tmp/pdf-store',out=path.join(dir,'fts-probe.sqlite');
for(const f of [out,out+'-wal',out+'-shm'])fs.rmSync(f,{force:true});
const src=new DatabaseSync(path.join(dir,'index.sqlite'),{readOnly:true});
const db=new DatabaseSync(out);
db.exec(`PRAGMA journal_mode=WAL;PRAGMA synchronous=OFF;
CREATE TABLE doc_pages(id INTEGER PRIMARY KEY,sha256 TEXT NOT NULL,page INTEGER NOT NULL,topic_id TEXT,region_id TEXT,event_date TEXT,chars INTEGER NOT NULL);
CREATE VIRTUAL TABLE doc_fts USING fts5(text,content='',tokenize="unicode61 remove_diacritics 2 tokenchars '-'",detail=${detail});`);
const fold=s=>s.replaceAll('ß','ss');
const files=src.prepare(`SELECT p.sha256,p.topic_id,p.region_id,p.event_date FROM pdfs p JOIN texts t ON t.sha256=p.sha256 WHERE t.status='ok' AND COALESCE(p.role,'')<>'other' AND p.topic_id IS NOT NULL GROUP BY p.sha256 ORDER BY p.event_date DESC LIMIT ?`).all(N);
const total=Number(src.prepare(`SELECT count(DISTINCT p.sha256) n FROM pdfs p JOIN texts t ON t.sha256=p.sha256 WHERE t.status='ok' AND COALESCE(p.role,'')<>'other' AND p.topic_id IS NOT NULL`).get().n);
const insPage=db.prepare('INSERT INTO doc_pages(sha256,page,topic_id,region_id,event_date,chars) VALUES(?,?,?,?,?,?)');
const insFts=db.prepare('INSERT INTO doc_fts(rowid,text) VALUES(?,?)');
let pages=0,chars=0;const t0=Date.now();
db.exec('BEGIN');
for(const [i,f] of files.entries()){
  const file=path.join(dir,'files',f.sha256.slice(0,2),f.sha256+'.txt');
  let text;try{text=fs.readFileSync(file,'utf8');}catch{continue;}
  for(const [j,p] of text.split('\f').entries()){
    if(p.trim().length<20)continue;
    const r=insPage.run(f.sha256,j+1,f.topic_id,f.region_id,f.event_date,p.length);
    insFts.run(Number(r.lastInsertRowid),fold(p));pages++;chars+=p.length;
  }
  if(i%500===499){db.exec('COMMIT');db.exec('BEGIN');}
}
db.exec('COMMIT');db.exec("INSERT INTO doc_fts(doc_fts) VALUES('optimize')");db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
const secs=(Date.now()-t0)/1000,bytes=fs.statSync(out).size;
console.log(JSON.stringify({files:files.length,of:total,pages,mb_text:Math.round(chars/1e6),mb_index:Math.round(bytes/1e6),seconds:Math.round(secs),ratio_index_to_text:(bytes/chars).toFixed(2),projected_gb:(bytes/files.length*total/1e9).toFixed(1),projected_hours:(secs/files.length*total/3600).toFixed(1)}));
const q=db.prepare('SELECT count(*) n FROM (SELECT rowid FROM doc_fts WHERE doc_fts MATCH ? ORDER BY bm25(doc_fts) LIMIT 20000)');
for(const term of ['"warmeplanung"','"hebesatz"','"bebauungsplan"','"kita"','"antrag"','"haushalt"','"kommunale warmeplanung"','"windenergie" AND "flachennutzungsplan"','"photovoltaik" OR "solar"','"grundsteuer" NOT "hebesatz"']){
  const a=performance.now();const n=q.get(term).n;console.log(term.padEnd(48),String(n).padStart(6),'Seiten',(performance.now()-a).toFixed(0).padStart(5),'ms');
}
```

Was die Ausgabe sagt:

| Wert | Bedeutung | Erwartung |
| --- | --- | --- |
| `ratio_index_to_text` | Indexbytes je Textzeichen | 0,6–1,0 bei `detail=full`, 0,3–0,5 bei `column` |
| `projected_gb` | Index für alle Hauptdokumente | 5–7 GB (`full`), 2–3 GB (`column`) |
| `projected_hours` | Erstaufbau auf einem Kern | 3–8 Stunden; in Stücken von 45 Minuten nachts also 5–10 Nächte, oder tagsüber 2–3 Läufe à 2 Stunden |
| Abfragezeiten | seltenes Wort / häufiges Wort | unter 50 ms / 0,5–2 s bei kaltem Cache, 20.000 Kandidaten |

Wenn `projected_hours` über 10 liegt: `synchronous=OFF` und Transaktionen je 500 Dateien sind schon gesetzt, dann hilft nur Parallelität (zwei Prozesse auf getrennten Datumsbereichen, am Ende `INSERT … SELECT` zusammenführen) oder der Aufbau auf dem Mac aus einer Kopie der `.txt`-Dateien und Hochladen der fertigen Datei (eine Datei, rsync).

Wenn `projected_gb` über 8 liegt: `detail=column` nehmen (keine Phrasen und kein NEAR, aber Wörter, UND/ODER/NICHT, Präfix) oder Anlagen auslassen (sind in der Probe ohnehin nicht drin). Die Probe mit `--detail column` ein zweites Mal laufen lassen, das kostet dieselben Minuten.

## 9. Offene Entscheidungen

Sieben Fragen, jede mit Empfehlung; vor PR 1 sollten die ersten vier beantwortet sein, die übrigen vor PR 2.

| Nr. | Frage | Empfehlung | Begründung |
| --- | --- | --- | --- |
| 1 | Anlagen (`role='other'`) mit indizieren? | Nein, erst Hauptdokumente | Anlagen sind nur teilweise geladen, oft Pläne und Tabellen mit wenig Fließtext; Index halb so groß, Erstaufbau halb so lang. Später als Filter „auch Anlagen“ nachrüsten, das Schema trägt `role` schon. |
| 2 | `detail=full` oder `column`? | `full`, wenn das Messskript unter 8 GB ergibt | Phrasen und NEAR sind das, was Profis von einer Dokumentsuche erwarten. Über 8 GB: `column`, Phrasen entfallen. |
| 3 | Index auf derselben Platte neben den 80 GB Ablage? | Ja | 193 GB Platte, Ablage 80 GB, Hauptdatenbank 14 GB plus Sicherungen; 5–7 GB passen. Zur Sicherheit `BUDGET_GB` der Ablage nicht erhöhen. |
| 4 | Erstaufbau auf dem Server oder auf dem Mac? | Server, in Stücken tagsüber | Kein Transfer, kein zweiter Stand. Nur wenn `projected_hours` über 10: Mac mit Kopie der `.txt`, eine Datei hochladen. |
| 5 | PDF in Plenara anzeigen oder nur Fundstelle plus Link zum Original? | Fundstelle plus Link, mit `#page=` | Das Original liegt beim Ratsinformationssystem, Nutzer kennen den Weg schon von `/api/dokument`. Eigene Anzeige berührt Urheberrecht, Datenschutz (Namen in Niederschriften) und Platz; dafür ein eigenes Konzept, wenn Pro-Kunden es verlangen. |
| 6 | Karte auf `/dokumente`? | Im ersten Schritt nicht | Die Seite lebt von Fundstellen; Karte als Blatt später, `areaCounts` liefert die Route schon. |
| 7 | Name und Platz im Menü | „Dokumentsuche“, eigener Eintrag hinter plenara.X, Umschalter auf der Suche | Ein Wort, das jeder versteht; „Volltextsuche“ klingt nach Technik. Preisseite: „Dokumentsuche: sucht in den Texten der Sitzungsunterlagen“. |

**Tippfehler in der Dokumentsuche** gehen mit demselben Verfahren wie in der normalen Suche, nur mit einer anderen Wortquelle: `fts5vocab('doc_fts','row')` liefert jedes Wort des Dokumentindex mit seiner Seitenzahl, ohne eigenen Aufbau. Daraus füllt `syncSuggestIndex` aus `search-suggest.mjs` (Branch `Nico-tippfehler`) ein zweites Register (`doc_suggest_words`, `doc_suggest_trg`) in `fts.sqlite`, nachts nach dem Indexlauf; die Route `/api/dokumente` liefert bei 0 Treffern `suggestions` wie `/api/search/suggest`, die Seite zeigt „Meinten Sie …?“. Unterschied zur Suche: Die Wortliste der Dokumente ist größer (Schätzung 3 bis 5 Mio. Wörter, viele OCR-Fehler), darum Wörter ab 3 Seiten statt ab 2 Karten und Schreibweise aus der Seite statt aus der Suchkarte. Aufwand ein halber Tag, in PR 2.

## 10. Umsetzungsplan

Drei Pull Requests, jeder für sich ausrollbar; der Index kann nachts wachsen, während die Seite entsteht. Gesamt 6 bis 8 Arbeitstage.

**PR 0: Messen** (1 Stunde, kein Ausrollen)

- `scripts/pdf-store/fts-probe.mjs` aus Abschnitt 8 anlegen, auf dem Server mit `--files 20000` laufen lassen, Ausgabe in dieses Dokument oder nach `docs/qualitaet/` schreiben.
- Entscheidungen 1 bis 4 festlegen.

**PR 1: Index und Route** (2 bis 3 Tage)

| Datei | Änderung |
| --- | --- |
| `server/node/doc-index.mjs` | `openDocIndex(dir,{readOnly})`, Schema, `INDEX_VERSION`, `indexFiles(store, index, {minutes, ids, full})` mit Stücken, Sperre, Stand |
| `scripts/pdf-store/index.mjs` | Kommandozeile: `--full`, `--minutes`, `--ids`, `--since`, `--dry-run`; Ausgabe wie die anderen Skripte (JSON-Zeile am Ende) |
| `scripts/pdf-store/job.mjs`, `nightly.mjs` | Auftrag `index` (Bahn „Laden“), Schritt am Ende von `--daily`, Folgeschritt nach `ocr` |
| `shared/pipeline-terms.mjs` | Schritt „Dokumente indizieren“ |
| `server/integrations/doc-search.mjs` | `parseDocSearch`, `toMatch`, `searchDocuments(db, index, store, catalog, params)`, `snippetsOf`, `cachedDocSearch` |
| `app/api/dokumente/route.ts` | `gated(…,{feature:'fulltext'})`, 503 ohne Index |
| `app/api/search/route.ts` | `volltext=1`-Zweig entfernen (oder 410 mit Hinweis auf `/api/dokumente`) |
| `scripts/pdf-store/stats.mjs`, `server/integrations/pdf-store-admin.mjs`, `components/admin-pdf.tsx` | Block „Dokumentindex“ mit Kennzahlen und Knöpfen |
| `server/integrations/ops-check.mjs` | Warnung Rückstand und Alter |
| `tests/doc-index.test.mjs`, `tests/doc-search.test.mjs` | siehe Abschnitt 11 |
| `docs/technik/suche.md`, `docs/betrieb/node-server.md`, `CLAUDE.md` | Abschnitt „Dokumentsuche“; Betrieb: Erstaufbau, Jobs, Platz |

Nach dem Ausrollen: Erstaufbau anstoßen (Admin-Knopf oder Skript mit `--minutes 120`, mehrere Tage). Die Route liefert ab der ersten Stunde Treffer aus dem, was schon indiziert ist.

**PR 2: Seite und Umschalter** (3 bis 4 Tage)

| Datei | Änderung |
| --- | --- |
| `app/(monitor)/dokumente/page.tsx` | Meta |
| `components/ratsmonitor/App.tsx`, `lib/pageTitle.ts`, `state/nav.ts` | Pfad bekannt machen, Titel, Zurück-Verhalten |
| `components/ratsmonitor/pages/dokumente/*` | `DokumentePage`, `DocumentRow`, `useDocSearch` |
| `components/ratsmonitor/components/SearchModeSwitch.tsx` | Umschalter |
| `components/ratsmonitor/components/GateDialog.tsx` | Fall `fulltext` |
| `components/ratsmonitor/menu/MainMenu.tsx`, `components/Header.tsx` | Eintrag „Dokumente“ |
| `app/styles/search.css` | Block „Dokumentsuche“ |
| `components/ratsmonitor/info/content.ts`, `docs/produkt/stufen.md`, `tests/accounts-rules.test.mjs` | Pro-Text: „Dokumentsuche“; der Test prüft die Zeile „Volltextsuche“ in `stufen.md`, Zeile und Test gemeinsam umbenennen |
| `components/ratsmonitor/INDEX.md` | `node scripts/frontend-index.mjs` |

**PR 3 (später): Glocke und Export**

- Gespeicherte Dokumentsuche mit Glocke (täglich, Pro): `notify.mjs` bekommt eine zweite Quelle; Ereignis = neue Datei im Index mit Treffer.
- Export der Fundstellen als CSV (`/api/dokumente?format=csv`, nur Pro).

**Reihenfolge und Abhängigkeiten:** PR 0 vor PR 1 (Entscheidungen 1–4). PR 1 und PR 2 können parallel entstehen; PR 2 braucht zum Testen eine lokale `fts.sqlite` aus dem Probelauf (`fts-probe.sqlite` umbenennen reicht, das Schema ist dasselbe bis auf `doc_type` und `role`). Vor PR 2 die Entscheidungen 5–7.

## 11. Tests und Abnahme

Tests laufen ohne echte Ablage: eine Testablage mit drei bis fünf erfundenen Texten in einem Temp-Ordner (`index.sqlite` mit `pdfs` und `texts`, `.txt`-Dateien), wie `tests/pdf-store.test.mjs` es macht.

**`tests/doc-index.test.mjs`**

- Aufbau aus der Testablage: Seiten unter 20 Zeichen fehlen, Anlagen (`role='other'`) fehlen, `text-only` ist drin.
- Wiederaufnahme: Lauf mit `minutes:0` hört nach einem Stück auf, zweiter Lauf macht weiter, am Ende `done`; kein Doppel in `doc_pages` (UNIQUE) und `doc_fts` (Zahl der Zeilen = Seiten).
- Geänderter Text (neues `made_at`): alte Seiten weg, neue drin; `gone` entfernt die Datei.
- Sperre: zweiter Lauf unter laufender Sperre gibt `busy`.
- `--full` mit neuer `INDEX_VERSION` baut neu, die Suche sieht bis zum Umbenennen den alten Index.

**`tests/doc-search.test.mjs`**

- `toMatch`: jede Zeile der Tabelle in Abschnitt 5, dazu Angriffe (`"`, `(`, `OR OR`, 300 Zeichen) → gültiges MATCH oder Fehler 400, nie Ausnahme aus SQLite.
- Umlaute: Anfrage „Wärmeplanung“ findet Text „Waermeplanung“ und „Wärmeplanung“; „Straße“ findet „Strasse“.
- Filter: Gebiet, Zeitraum, Dokumentart grenzen ein; Ergebnis mit und ohne `CAND_MAX`-Deckel identisch bei kleinen Mengen.
- Fundstellen: Seite stimmt, Auszug enthält den Begriff, höchstens drei je Dokument, Ausschnitt an Wortgrenzen.
- Antwortform: Felder aus Abschnitt 5, `revision` wechselt mit dem Indexstand, 409 bei veralteter `revision`.
- Route: Gast und Plus 403 mit `limit:'fulltext'`, Pro 200, ohne Index 503 (`tests/route-access.test.mjs` prüft `gated(` von selbst).

**Abnahme auf dem Server** (Max, nach PR 1 und erstem Teilaufbau)

1. Zehn Begriffe aus dem Alltag (Wärmeplanung, Hebesatz, Kita-Gebühren, Windkraft, Bebauungsplan, Haushaltssicherung, Grundsteuer B, Photovoltaik, Radweg, Vergabe) mit Ort und ohne: Antwortzeit unter 1 s warm, Fundstellen lesbar, Seitenzahl stimmt mit dem PDF überein (fünf Stichproben öffnen).
2. Häufiges Wort („Antrag“) mit Ort: Antwort unter 2 s, `capped:true` sichtbar.
3. Phrase und NEAR liefern weniger als die Einzelwörter.
4. Nachtlauf: am Morgen Rückstand im Admin null oder klein, Dauer im Protokoll.
5. Nach PR 2: Gast tippt „Dokumente“ → Gate; Pro sucht; Handy-Liste ohne Überlauf (`frontend-check.mjs`).

**Nicht testbar ohne Server:** Indexgröße und Aufbauzeit (Messskript), Antwortzeiten bei kaltem Cache.

## 12. Anhang: Hinweise für Claude Code

Dieser Abschnitt ist als Einstieg für eine Claude-Code-Sitzung im Repo gedacht; er nennt, was vor dem ersten Edit zu lesen ist, und die Stolpersteine, die beim Lesen des Codes nicht auffallen.

**Zuerst lesen:** `CLAUDE.md` (Abschnitte „PDF-Ablage“, „Suche: Wortliste“, „Konten“), `docs/technik/suche.md`, `docs/betrieb/node-server.md` („PDF-Ablage, Texte, Fakten“, „Zeitplaner“), `components/ratsmonitor/FRONTEND.md`, `server/node/pdf-store.mjs` (Kopfkommentar), `scripts/pdf-store/job.mjs` (Bahnen), `server/integrations/monitor-search.mjs` (nur `parseMonitorSearch`, `searchFilters`, `regionCondition`, `cachedSearch`).

**Stolpersteine**

- `pdfs.role` ist für Hauptdokumente leer, nicht `'primary'`; Anlagen tragen `'other'`. Immer `COALESCE(role,'')<>'other'`.
- Die Umlautfaltung der Suche ist ä→a (nicht ae): `norm` in `x-terms.mjs`. `remove_diacritics 2` im Tokenizer macht dasselbe; `ß` muss man selbst zu `ss` machen, in Text und Anfrage.
- Contentless FTS5 (`content=''`): `delete` braucht den Originaltext als Argument, sonst bleibt der Eintrag; Text dafür aus der `.txt` lesen. Kein `UPDATE`, immer delete + insert.
- `optimize` und `delete` sind Befehle über `INSERT INTO doc_fts(doc_fts[,rowid,text]) VALUES(…)`; mit einfachen Anführungszeichen schreiben.
- MATCH nie mit Rohtext füttern; jedes Token in doppelte Anführungszeichen, Operatoren nur aus `toMatch`.
- Der Node-Server ist ein Prozess: lange Abfragen blockieren alle Anfragen. Deshalb `CAND_MAX`, `readOnly`-Handle und keine Indexläufe im Webprozess (anders als beim Tippfehler-Register, das klein ist).
- `fts.sqlite` nie in `drizzle/` oder `TRANSFER_TABLES`; sie ist abgeleitet und wird nicht gesichert.
- Stufen nur über `gated(…,{feature:'fulltext'})` und `allowFeature('fulltext')`; nie `tier==='pro'` vergleichen (Enterprise, „ansehen als“).
- Neue Route unter `app/api/` muss `gated(` oder `guard(` im Quelltext haben, sonst schlägt `tests/route-access.test.mjs` fehl.
- `tests/accounts-rules.test.mjs` prüft die Zeile „Volltextsuche“ in `docs/produkt/stufen.md` gegen `FEATURES.fulltext`; beim Umbenennen beides ändern.
- Frontend: keine neuen Farben, nur Variablen und slate/teal/sky/amber; nach neuen Dateien `node scripts/frontend-index.mjs`; ESLint-Regel: kein `setState` synchron im Effekt.
- Dev-Server: Dokumentsuche lokal nur mit `RM_PDF_STORE` und einer `fts.sqlite` (aus dem Probelauf); ohne beides antwortet die Route 503, das ist gewollt.

**Prompt für die Sitzung** (Vorschlag, in einem Stück einzugeben):

```markdown
Setze das Konzept „Dokumentsuche (Plenara Pro)“ um, PR 1 (Index und Route). Lies zuerst CLAUDE.md,
docs/technik/suche.md, server/node/pdf-store.mjs und scripts/pdf-store/job.mjs. Entscheidungen:
nur Hauptdokumente (role leer), detail=full, Index in RM_PDF_STORE/fts.sqlite, Erstaufbau auf dem Server.
Baue server/node/doc-index.mjs, scripts/pdf-store/index.mjs, server/integrations/doc-search.mjs,
app/api/dokumente/route.ts, den Auftrag „index“ in job.mjs und nightly.mjs, den Admin-Block
„Dokumentindex“ und die Tests aus Abschnitt 11 des Konzepts. Keine Migration in drizzle/. Branch
Nico-dokumente. Am Ende: node --test tests/doc-index.test.mjs tests/doc-search.test.mjs
tests/route-access.test.mjs, Typcheck, und ein Absatz in docs/technik/suche.md und CLAUDE.md.
```

**Was dieses Konzept nicht enthält:** fertigen Code für Index und Route (nur das Messskript), die Texte der Gate- und Preisseite, und die Zahlen vom Server. Die ersten beiden sind Arbeit von Stunden, die Zahlen liefert das Messskript.

## 13. Umsetzung (31.10.2026)

Umgesetzt sind PR 0 (Messskript), PR 1 (Index, Route, Jobs, Admin, Betriebsprüfung, Tests, Doku) und PR 2 (Seite, Umschalter,
Sperrhinweis, Menü, Preistexte) auf einem Branch. Die Zahlen vom Server (Abschnitt 8) fehlen noch: `fts-probe.mjs` ist dafür da.
Entscheidungen 1 bis 7 wie empfohlen (nur Hauptdokumente, `detail=full` vorbehaltlich der Messung, Index neben der Ablage,
Erstaufbau auf dem Server, Link zum Original mit `#page=`, keine Karte, Name „Dokumentsuche“).

**Abweichungen vom Konzept, mit Grund**

| Konzept | Umsetzung | Grund |
| --- | --- | --- |
| Alte Seiten löschen mit `'delete'` und dem alten Text aus der `.txt` | FTS5 mit `contentless_delete=1`, `DELETE … WHERE rowid IN …` | Die OCR überschreibt die `.txt`, bevor der Index nachführt; ein `delete` mit dem neuen Text ließe den alten Eintrag still stehen und verdirbt den Index. SQLite 3.51 (Node 24) kann es. |
| Erst die besten 20.000 Seiten, dann nach Ort filtern | Filter (Ort, Zeitraum, Art, Ausschluss) vor dem Rang, dann höchstens 20.000 | Sonst findet „Antrag“ in einer kleinen Gemeinde nichts, weil ihre Seiten nicht unter den besten des Landes sind (Test „filters apply before the cap“). |
| `tokenchars '-'` | Bindestrich trennt Wörter; „Kita-Gebühren“ in der Anfrage wird Phrase | Mit `tokenchars '-'` fände „Kita“ das Wort „Kita-Gebühren“ nicht. |
| `NOT` je Seite | `-wort` schließt das Dokument aus, wenn das Wort auf irgendeiner Seite steht | Seitenweise blieb ein Dokument drin, sobald eine andere Seite das Wort nicht hat; das erwartet niemand. |
| Metadaten je Seite in `doc_pages` | `doc_files` je Datei, `doc_pages` nur Seite | Eine Datei hängt oft an mehreren Adressen; Stand (`made_at`) und Adresse gehören zur Datei. |
| Umlaut-Test „Wärmeplanung“ findet „Waermeplanung“ | Anfrage mit Umlaut sucht zusätzlich ae/oe/ue | `remove_diacritics` macht ä → a, nicht ae; die Faltung im Index bleibt wie in der Suche. |
| Standard „bis heute“ | ohne Zeitraum auch künftige Sitzungen | Vorlagen für die nächste Sitzung sind für Pro-Kunden das Wertvollste. |
| Dokumentart „Antrag“ | Vorlage oder Antrag, Beschluss, Niederschrift, Einladung, Anlage, Sonstiges | Die Ablage unterscheidet Antrag nicht von Vorlage (`shared/document-type.mjs`). |
| Abfrage im Webprozess | im plenara.X-Worker-Thread, sonst im Prozess | Eine kalte Abfrage (bis 2 s) hielte sonst alle Anfragen an. |
| Index wird nachts immer gebaut | nachts und nach OCR nur mit `--if-exists`, angelegt per Auftrag | Ein Deploy legt nicht still 5 bis 7 GB an; der Betreiber entscheidet nach der Messung. |
| Betriebsprüfung: Rückstand über 5 % | erst nach dem ersten vollständigen Aufbau | Sonst kommt während des Erstaufbaus jeden Tag eine Warnmail. |
| Skript `scripts/pdf-store/index.mjs` | `scripts/pdf-store/doc-index.mjs` | gleicher Name wie das Modul, nicht verwechselbar mit `index.sqlite`. |
| Eintrag „Dokumente“ in der Kopfzeile | Eintrag „Dokumentsuche“ unter „Funktionen“ (Kopfzeile und Menü), Umschalter über der Trefferliste | Die Kopfzeile ist ab 1280 px voll; der Umschalter sitzt dort, wo man die Treffer sieht, auch bei null Treffern. |
| Ortssuche über `SearchBox` | eigenes Feld, Ort per `place.parse` als Chip | `SearchBox` hängt am Zustand der Vorgangssuche. Ein Kreis zählt mit seinen Gemeinden, eine Gemeinde nur selbst. |

**Noch offen**

- Messung auf dem Server (`fts-probe.mjs --files 20000`) und danach Erstaufbau per Auftrag „Dokumentindex aufbauen“.
- Tippfehler-Vorschlag aus dem Dokumentregister (`fts5vocab`), Glocke auf eine Dokumentsuche, CSV-Export, Karte (`areaCounts`).
- Filter „auch Anlagen“: dafür `doc_files` um die Rolle erweitern und Anlagen in die Quelle nehmen (neue `INDEX_VERSION`, Neubau).
