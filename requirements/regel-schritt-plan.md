# Ein Schritt für alle Regeln je Bericht (Plan, Schritt 3)

Stand 14.10.2026, Zweig `plenara_x_nico`. Umgesetzt (Commits 1 bis 5), noch nicht auf dem Server. Ausrollen: Migration `0032`,
einmal `read-reports.mjs --all`, danach Wortliste `--full`.

## Ziel

Jeder Bericht wird **einmal** gelesen, und alle regelbasierten Ergebnisse entstehen in **einer** Funktion in fester Reihenfolge.
Jede Regel liest nur Quellen (Titel, Dokumentliste, Text des Hauptdokuments), nie das Ergebnis einer anderen Regel.
Suchkarten und Wortliste folgen aus dem gespeicherten Bericht.

## Heute (wer schreibt was)

| Ergebnis | Wo | Wann |
|---|---|---|
| Label (16, `classification`) | `classifyTopic` über `analysePending` (`manual-analysis.mjs`) | nach jedem Import (`import-worker.mjs`), `reclassify-rules.mjs` |
| Regel-Zusammenfassung | `enrichDocument` + `compactSummaryAttempt` | Import (`refreshSummaries` in `sync.ts`), Job `rule-texts` → `summaries.mjs` |
| Fakten (`topic_facts`) | `factsOf` | Job `rule-texts` → `facts.mjs` (Schlüssel in `facts_keys` der Ablage) |
| Formalie (`search_cards.formal`) | SQL-Muster im Trigger (`drizzle/0017`) | bei jedem Schreiben des Berichts |
| Routine (`routineTitle`) | `topic-facts.mjs`, nur in plenara.X-Auswertungen | beim Abfragen |
| Suchkarte | Trigger `drizzle/0027` | bei jedem Schreiben des Berichts |
| Wortliste | `refresh-search-words.mjs` | nach Import und im Job `rule-texts` |

Drei Durchläufe über alle Berichte im Job, zwei verschiedene Wege im Import, vier Formalien-Regeln.

## Soll

### 1. Eine reine Funktion: `readReport` (`shared/report-rules.mjs`)

```js
readReport({title, documents}, {uses, text, textSha}) →
 { version, key, mainUrl, itemKind, theme:{id,subs,source}, ruleSummary|null, facts:[…] }
```

Feste Reihenfolge, jede Stufe nur aus Quellen:

1. **Dokumente**: Hauptdokument `primaryPdf(documents,{uses,hasText})`, Sitzungsunterlage `sessionDocument` (Schritt 1).
2. **Art des Punkts**: `itemKind(title)` (Schritt 2). Nicht `subject` → kein Thema, keine Fakten außer Fraktion.
3. **Thema und Unterthemen**: `themeOf({title, subject:subjectOf(text)})`. Keine Zusammenfassung als Eingabe
   (die entsteht erst in Stufe 4). Aus dem Text zählt nur Betreff/Beschlussvorschlag wie heute; eine Zählregel über den
   Textanfang wurde gemessen und verworfen (siehe Prüfung 2).
4. **Zusammenfassung kurz und lang**: `ruleSummary(text)` wie heute, nur wenn das Hauptdokument keine Sitzungsunterlage ist.
5. **Fakten**: `factsOf(title, text)` wie heute (facts-v15).

`key` = SHA-256 aus `READ_VERSION` (setzt sich aus den Versionen der fünf Regeln zusammen), Titel, Adresse des Hauptdokuments,
Sitzungsunterlage ja/nein und Prüfsumme des Texts. Gleicher Schlüssel → nichts zu tun.

### 2. Speicherung

- Bericht (`topics.payload`): neu `itemKind`, `theme {id, subs, source, version}`; `ruleSummary`/`ruleSummaryTried` wie heute;
  `classification` (16 Labels) bleibt vorerst unverändert, bis die Suche auf die 10 Themen umgestellt ist (Schritt 5).
- Fakten: `topic_facts` wie heute.
- Schlüssel: neue Tabelle `report_rules(topic_id PRIMARY KEY, key, version, read_at)` in der Hauptdatenbank
  (Migration `0032`), ersetzt `facts_keys` in der Ablage und `ruleSummaryTried` als Merker.
- KI-Felder (`shortSummary`, `longSummary`, `labelAssessments.ai`, `contentAnalysis`) werden nie angefasst.

### 3. Aufrufer

- **Job `rule-texts`** (`scripts/rule-texts.mjs`): ein Schritt `scripts/pdf-store/read-reports.mjs` statt `summaries.mjs`
  und `facts.mjs`; ein Durchlauf über alle aktiven Berichte (Zahl der Berichte je PDF vorab, `pdfUses`), kurze
  Transaktionen wie `summaries.mjs` heute, Sperre `eval.lock`. `--all` = alle Schlüssel verwerfen. Danach Wortliste.
- **Import** (`refreshSummaries` in `sync.ts`): ruft dieselbe Funktion; ohne Text in der Ablage nur Stufen 1 bis 3
  (Titel), Zusammenfassung wie heute über `readDocument`.
- **`analysePending`** schreibt weiter `classification` (bis Schritt 5), zusätzlich nichts.
- `summaries.mjs` und `facts.mjs` bleiben eine Fassung lang als Rückfall, dann weg.

### 4. Was dieser Schritt nicht macht (folgt)

- Schritt 4 (erledigt 14.10.2026): Suchkarten lesen „Formalie“ aus `payload.itemKind` (Migration `0033`, Rückfall auf die
  alten Muster, wenn `itemKind` fehlt); `routineTitle` = kein Sachpunkt nach `itemKind`; einzeln geführte Einwohnerfragen
  („… - Herr X“) sind jetzt Routine in `itemKind` (`item-kind-v2`). Label `sitzung/allgemein` bleibt bis Schritt 5, weil die
  16 Labels dort ohnehin durch die 10 Themen ersetzt werden.
- Schritt 5: 10 Themen in Suche, Lena und Labels (`labels-v3`, Trigger-Migration, Filter in der Oberfläche).
- Schritt 6: plenara.X-Tabellen und `/api/x` aus `theme` und Fakten.

## Prüfung

1. **Gleichheit**: Für 2.000 Berichte aus der lokalen Datenbank müssen `ruleSummary` und Fakten aus `readReport`
   genau dem heutigen Weg (`summaries.mjs`, `facts.mjs`) entsprechen, wo sich nur der Ablauf ändert. Abweichungen nur dort,
   wo Schritt 1 ein anderes Hauptdokument wählt; diese einzeln zählen und Stichproben ansehen.
2. **Thema aus dem Text**: neue Stichprobe vom Server (200 Berichte, Titel ohne Thema und ohne Formalie, mit Text),
   Zählregel ohne und mit langem Text messen; nur übernehmen, wenn Genauigkeit ≥ 90 %.
   **Ergebnis (13.10.2026, `scripts/theme-study/measure-text.mjs`, `tests/fixtures/theme-text.json`):** 120 der 200 haben
   sicher ein Thema. Heutige Regel: 14 vergeben, 79 % richtig. Zählregel über die ersten 1.500/3.000 Zeichen: 49 bis 62 %
   richtig bei 24 bis 49 % gefunden. Nicht übernommen; solche Berichte bleiben „noch nicht zugeordnet“.
3. **Tests**: Einzelfälle für `readReport` (Reihenfolge, Sitzungsunterlage, ohne Text, KI-Felder bleiben); bestehende Tests
   von `summaries` und `facts` laufen gegen den neuen Weg.
4. **Laufzeit**: lokal über alle Berichte mit Text (≈ 95.000) messen; Ziel: nicht langsamer als `summaries.mjs` + `facts.mjs`.
5. **Server**: erst nach Zustimmung ausrollen (Migration `0032`, einmal `read-reports.mjs --all`, danach Wortliste `--full`).

## Reihenfolge der Commits

1. `shared/report-rules.mjs` + Tests (nur Funktion, nichts eingebunden).
2. Messung Thema aus dem Text (Stichprobe, Zählregel), ggf. Anpassung `themes.mjs`.
3. Migration `0032` + `read-reports.mjs` + Gleichheitsprüfung.
4. `rule-texts.mjs` und `sync.ts` umstellen.
5. Doku (`CLAUDE.md`, `docs/betrieb/node-server.md`).

# Schritt 5: Die 10 Themen ersetzen die 16 Labels (erledigt 14.10.2026, Entscheidung: „Übersetzen“)

Ein Katalog: `labels-v3` sind die 10 Themen aus `shared/themes.mjs` plus „noch nicht zugeordnet“ (`unklar`). Alles, was heute
den Katalog aus `shared/labels.mjs` liest (Suche, Filter, Karte, Lena, Admin, plenara.X, Oberfläche), bekommt so die Themen.

## Übersetzung der alten Labels (fest, für Prüfung von Hand und KI-Labels in `labels-v2`)

bildung→bildung, bauen→bauen, mobilitaet→mobilitaet, umwelt→umwelt, klima→umwelt, soziales→soziales, gesundheit→soziales,
wirtschaft→wirtschaft, kultur→kultur, sport→kultur, sicherheit→sicherheit, finanzen→finanzen, verwaltung→verwaltung,
sitzung→unklar, allgemein→unklar, unklar→unklar. (Formalie erkennt die Suche seit Schritt 4 über `itemKind`, nicht über ein Label.)

## Rangfolge des wirksamen Themas (View `topic_effective_labels`, Migration `0034`)

1. Prüfung von Hand (`labelAssessments.review`), `labels-v2` übersetzt, `labels-v3` direkt.
2. KI-Label (`labelAssessments.ai`), ebenso.
3. Thema aus `readReport` (`payload.theme.id`, Fassung `THEMES_VERSION`), `offen` → `unklar`.
4. Rückfall, solange ein Bericht noch nicht gelesen ist: Titelregel (`classification`), `labels-v2` übersetzt.

Die Trigger der Suchkarten (0027) sehen zusätzlich Änderungen an `payload.theme.id`; die Migration setzt `search_cards.label`
für alle Karten neu. Danach Wortliste `--full` (Zahlen je Label).

## Code

- `shared/labels.mjs`: `LABELS` = 10 Themen + `unklar` (Namen aus `themes.mjs`, Farben aus den alten Labels), `LABEL_VERSION`
  `labels-v3`, `LEGACY_LABELS` (Übersetzung oben). `classifyTopic` nimmt das Thema aus `themeOf({title})` und `itemKind`
  (Titelregel = Stufe 3 von `readReport` ohne Text), `CLASSIFIER_VERSION` `title-rules-v5`.
- Lena: Themen-Synonyme aus den Wortlisten der Unterthemen statt `label-words.mjs`; Messung `scripts/lena/measure.mjs`.
- KI-Aufbereitung (`ai-local-content.mjs`, `ai-job.mjs`): Katalog `labels-v3` (neue KI-Labels gleich in den 10 Themen).
- Stellen mit festen alten Kennungen anpassen (Suche nach `klima`, `sport`, `gesundheit`, `sitzung`, `allgemein` als Label).
- Oberfläche liest `LABELS` aus `shared/labels.mjs` und folgt von selbst; nur prüfen, nichts umgestalten.

## Prüfung

- Tests: Übersetzung, Rangfolge im View (alle vier Stufen), Trigger bei geändertem Thema, Lena-Fragen.
- Lokal: Verteilung der Themen vorher/nachher, Suche mit Themenfilter, Lena-Messung.
- Server: erst nach Zustimmung (Migrationen 0032 bis 0034, `read-reports.mjs --all`, Wortliste `--full`).

## Commits

1. `labels.mjs`, Rangfolge, Migration `0034` (View, Neubefüllung; die Trigger aus 0027 folgen dem View von selbst), Tests,
   NRW-Testbestand neu eingeordnet (zusammen, weil JS- und SQL-Rangfolge gleich sein müssen).
2. Lena (`themesIn`); KI-Aufbereitung und MCP lesen den Katalog schon zentral.
3. Feste Kennungen (Social Media über `formal`, Fraktionsprofil), Admin (Zählung übersetzt, offen = Sachpunkt ohne Thema,
   `FIGURES_VERSION` 6), Doku.
Offen in der Oberfläche: Der Schalter für Sammelthemen im Ortsvergleich (`ComparePage.tsx`, `SAMMELTHEMEN`) wirkt nicht mehr,
weil es die Labels Sitzung und Allgemein nicht mehr gibt.
