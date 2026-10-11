# Datenmodell: Bestand und Plan (Entwurf, 11.10.2026)

Zur Abstimmung mit Max. Ergänzt `code-analyse-2026-10-10.md` (Nummern A/B/D von dort bleiben gültig) und bündelt die
offenen Datenmodell-Punkte aus Paket 6 mit Befunden, die dort nicht vorkommen (hier `M1` bis `M7`). Nichts davon ist
umgesetzt außer den unter „Vorab erledigt“ genannten Kleinigkeiten.

## 1. Datenfluss heute

1. **Import:** Die Quellenadapter schreiben je Vorgang einen JSON-Blob nach `topics.payload` (wenige echte Spalten:
   `id`, `region_id`, `source`, `event_date`, `updated_at`, `status`), dazu `source_coverage.payload` und `import_runs`.
2. **Anreicherung** (Regeln, KI, Hand, vorbereitete Bündel): schreibt dreifach, nämlich die Variante nach
   `article_analyses`, die gewählte Fassung in `topics.payload` und das alte Payload vollständig nach
   `article_versions` (`sync.ts`, `ai-jobs.mjs`, `prepared-analysis.mjs`, `manual-analysis.mjs`).
3. **Ableitungen** auf drei Wegen:
   - SQL-Trigger: `search_cards` (Suchtext, Label, `formal`), `search_cards_gone`, `data_revisions`, `region_revisions`.
     Die Suchkarten-Trigger wurden sechsmal neu geschrieben (0006, 0008, 0009, 0014, 0015, 0017), es gibt zwei
     Migrationen mit der Nummer 0017.
   - JS-Nachführung mit eigenem Stand und eigener Sperre: Wortliste (4 Tabellen), `region_stats`/`region_series`,
     Stichwörter und Qualität in `system_state`.
   - Live per `json_extract` auf `topics.payload` in 29 Dateien.
4. **Leser:** Suche, Lena, Trends und Social lesen `search_cards`; Artikel, Admin, Analytics und Kalender das Payload.

## 2. Befunde, die in der Code-Analyse nicht stehen

- **M1 · Keine gemeinsame Sicht „aktiver Vorgang“.** `json_extract(payload,'$.identity.mergedInto') IS NULL` steht
  17-mal ausgeschrieben (dazu 3-mal `IS NOT NULL`), in verschiedenen Schreibweisen (`payload`, `t.payload`,
  `topics.payload`). Die Teilindizes aus 0002, 0011 und 0012 greifen nur bei passendem Ausdruck.
- **M2 · Rangfolge der Varianten verstreut.** Zusammenfassung: KI vor Regel (KI-Text in `shortSummary`/`longSummary`
  mit `generatedBy`, Regeltext getrennt in `ruleSummary`). Label: Regel vor KI (`classification` ist immer das
  Regel-Label, KI in `labelAssessments.ai`). Die Auswahl steckt im Trigger (0017), in `generatedBy`-Abfragen und in den
  Importpfaden. Die Suche findet nur die gewählte Zusammenfassung, Wörter aus `ruleSummary` nicht.
- **M3 · Textnormalisierung an vielen Stellen.** Umlautfaltung als `replace()`-Kette im Trigger, `wordsOf`
  (`[a-z0-9]+`, ab 3 Zeichen), zwei `stems` (`\p{L}{4,}` mit 7 Zeichen in `rule-summary`, 6 Zeichen ohne Kleinwörter in
  `website`/`website-text`), NFKC in Labels und Lena, vier `fold`-Varianten.
- **M4 · Stopwortlisten kopiert und auseinandergelaufen.** `rule-summary` (59 Wörter) und `similarity` (62) teilen nur
  35; `website` und `website-text` waren gleich (31, jetzt eine Liste, s. u.); dazu `PLACE_STOP` (Lena) und `STOP` im
  Frontend (`lib/place.ts`).
- **M5 · Fünf überlappende Begriffslisten.** `LABEL_WORDS` (Labels, Lena), 18 `subjects` in `similarity.mjs`,
  `GROUPS` in `social-topics.mjs`, KI-Stichwörter (`weightedKeywords`), Wortliste der Suche. Gleiche Begriffe (Kita,
  Ganztag/OGS, Wärmeplanung, Radweg) stehen in mehreren mit eigenen Mustern.
- **M6 · KI-Stichwörter ohne Leser im Produkt.** Nur im Suchtext (Trigger seit 0009) und in der Administration;
  Anzeige auf der Artikelseite war nicht eingebunden. Entscheidung Nico (11.10.): Stichwörter entfallen überall, die
  KI erzeugt sie nicht mehr (umgesetzt, s. Abschnitt 7).
- **M7 · Formalien doppelt** (JS `FORMAL`/`NOT_FORMAL` und SQL in 0017, ein Test hält beide gleich): Folge davon, dass
  die Projektion in SQL lebt.

## 3. Festlegungen

- Zusammenfassung: **KI vor Regel**; Label: **Regel vor KI**. Beide Varianten bleiben gespeichert, weil noch offen
  ist, welche dauerhaft genutzt wird.
- Stichwörter (`weightedKeywords`) entfallen (M6).

## 4. Zielmodell

- **`topics`** = Quellenstand aus dem Import. Analysen werden nicht mehr ins Payload gemischt.
- **Varianten** in `article_analyses` je (Vorgang, Art, Methode, Version): Art `summary` und `label`, Methode `ai`,
  `rule`, `review`, `manual`. Die Rangfolge steht an einer Stelle (`shared/analysis-pick.mjs`,
  `PRIORITY={summary:['review','ai','rule'],label:['review','rule','ai']}`).
- **Eine Lesesicht** (`search_cards` ausgebaut): aktiv/kanonisch, Gebiet, Datum, Status, Gremium, Titel, gewählte
  Zusammenfassung und gewähltes Label, dazu `label_rule`/`label_ai` für den Vergleich, `formal`, Suchtext,
  `steps`/`src` (B4/B5). Gebaut von **einer** JS-Funktion `projectTopic()` hinter einem zentralen `writeTopic()`
  statt von SQL-Triggern. Admin, Analytics und Kalender lesen diese Sicht statt `json_extract` (löst M1, M7).
- **`topic_events`** als eigene Tabelle (B6/E4).
- **Ein Änderungsprotokoll** (aus `search_cards_gone` weiterentwickelt) mit fortlaufender Nummer. Wortliste,
  `region_stats`/`region_series` und Auswertungen lesen es mit eigenem Cursor; ein Muster aus Cursor und Sperre statt
  getrennter Revisionsarten.
- **`shared/text.mjs`**: Faltung (Suche), Faltung mit Umlauten (exakt), Wörter, Stämme, Stopwörter (M3, M4).
- **Begriffskatalog** mit Facetten (Muster, Sachgebiet, Streitgewicht, Vergleichsthema), aus dem Labels, Similarity,
  Social und Lena lesen (M5). Keine flache Einheitsliste, weil die Zwecke verschieden sind.
- **Suche:** FTS5 messen (B7) als Ersatz für `search_postings`; die vorberechneten Zahlen je Wort bleiben nötig.
- **Versionen:** nur bei Änderung am Quellenstand, gekappt (B12); keine Payload-Kopie je Analyse.

## 5. Reihenfolge

Jeder Schritt einzeln auf `main`, mit Tests, Migrationen auf echten Daten gemessen (17-GB-Datenbank).

1. `shared/text.mjs` ohne Ergebnisänderung (nur gleiche Listen und Funktionen zusammenlegen).
2. ~~KI-Stichwörter entfernen (M6)~~: erledigt, s. Abschnitt 7.
3. `analysis-pick` und Spalten `label_rule`/`label_ai` (Migration).
4. Aktiv-Spalte (generierte Spalte oder Teil der Lesesicht) und Ersatz der 17 Ausdrücke (M1).
5. Lesesicht in JS mit `writeTopic()` (größter Schritt, fasst `sync.ts` an), Trigger für Suchkarten entfallen.
6. `topic_events` (B6) und `steps`/`src` (B4/B5).
7. Änderungsprotokoll mit Cursor für alle Ableitungen.
8. FTS5-Messung (B7), Versionen kappen (B12), Entscheidung B10 (1,2 Mio. Regel-Label-Zeilen).

## 6. Gegen Merge-Konflikte

- Neue Module statt Umbau, alte Stellen rufen sie mit einer Zeile auf; Hot Files (`monitor-search.mjs`,
  `admin-data.mjs`, `sync.ts`, `search-words.mjs`) nie am Stück umschreiben, keine Formatänderungen.
- Kurzlebige Zweige in eigenen Worktrees, jeder Schritt in Stunden auf `main`.
- Migrationsnummer früh auf `main` belegen (nächste freie: 0019).

## 7. Vorab erledigt (Zweig `datenmodell_vorab`)

- Nicht eingebundene Komponente `ArticleAnalysis` (`components/article-analysis.tsx`) entfernt.
- Gleiche Kleinwortliste von `website.mjs` und `website-text.mjs` zusammengelegt (`SMALL_WORDS`); Verhalten gleich.
- **KI-Stichwörter entfernt (M6):**
  - KI-Pipeline: Art `keywords` aus `AI_KINDS`, Prüfung, Batch-Prompt (`scripts/ai-batch/`), Vertrag
    (`requirements/ai-processing.md`); ältere Aufträge mit `keywords` laufen weiter, die Art wird übergangen.
  - Vorbereitete Bündel übernehmen keine Stichwörter mehr; `preserveArticleContent` hält sie nicht mehr fest.
  - Administration: KI-Teil der Seite „Stichwörter“ (Regelwörter und Titelbegriffe bleiben), Stufe und Kartenfarbe in
    „Verarbeitung“, Dashboard-Zahl, Pflichtangabe der Vollständigkeitsprüfung (`complete-article-v2`, elf statt zwölf).
  - Gebietswerte: `kw`/`bk` aus `FIGURES` und den Gebietszeilen, `FIGURES_VERSION` 4 → 5.
  - Suche: Migration `drizzle/0019_remove_keywords.sql` entfernt `weightedKeywords` (und `aiAttempts.keywords`) aus dem
    Payload, solange die Trigger aus 0017 noch darauf reagieren (Suchtext der betroffenen Vorgänge wird neu geschrieben,
    alte Fassung in `search_cards_gone`), und legt die Suchkarten-Trigger danach ohne Stichwörter neu an.
    Test: `tests/remove-keywords.test.mjs`.
- **Auf dem Server nach dem Ausrollen (für Max):**
  - Migration 0019 einspielen; sie liest einmal alle Payloads (ähnlich 0017: dort 89 s) und schreibt nur Vorgänge mit
    Stichwörtern. Vorher zählen: `SELECT count(*) FROM topics WHERE json_type(payload,'$.weightedKeywords') IS NOT NULL`.
  - Wortliste nachführen (`node scripts/refresh-search-words.mjs`); bei mehr als 5.000 betroffenen Vorgängen verfallen
    die vorberechneten Zahlen, dann einmal `--full` (zuletzt 158 s).
  - Gebietswerte zählen wegen `FIGURES_VERSION` 5 einmal neu (Nachholschritte der Adminseite oder des Runners); bis dahin
    zeigt die Übersicht keine Zahlen.
  - Stichwort-Seite einmal „Neu zählen“.
  - Bleibt liegen: Zeilen der Art `keywords` in `article_analyses` und alte Fassungen in `article_versions` (B10/B12).

## 8. Fragen an Max

- Passt die Bündelung mit Paket 6 (B4/B5, B6, B7, B12), wer setzt welchen Schritt um?
- B10: Regel-Label-Historie behalten oder löschen (gehört zu den Varianten in Abschnitt 4)?
- Bleibt Cloudflare D1 ein Ziel, oder nur der Node-Server? Das betrifft generierte Spalten, FTS5 und Batchgrenzen.
