# Backend-Cleanup: Analyse vom 20.10.2026

Branch `cleanup/backend` (von `main` 3b22a0f8). Nur gelesen, nichts geändert. Fünf parallele Prüfungen (Quell-Adapter, Routen/Services/Konten, shared/scripts/Migrationen, API-Performance, Ladeperformance), Kernbefunde am Code nachgeprüft. Messwerte stammen aus lokalen Nachbauten (node:sqlite im Speicher, esbuild-Bündel, Laptop), nicht vom Server; Verhältnisse sind belastbar, absolute Zeiten auf dem Server höher. Nicht erneut gemeldet: was in `code-analyse-2026-10-10.md` (Pakete 1–6), `docs/qualitaet/frontend-effizienz-2026-10-17.md` und Commit 5c777b13 (20.10., ungenutzte Exporte) schon erledigt ist.

## Ausgangsstand

- `tsc --noEmit`: fehlerfrei. Tests (`node --test tests/*.test.mjs`): alles grün bis auf die zwei bekannten Windows-Fehler (`job-trigger` triggerDir, `pdf-store-stop` SIGTERM).
- `npm run lint`: nicht grün (server/, shared/, scripts/: 25 Fehler, 83 Warnungen). Kein `test`/`typecheck`-Script, keine CI.
- Nicht gemergt: `claude/lucid-cray-28b349` (Befunde Technik-Doku 17.10.) ändert 22 Backend-Dateien, u. a. `plenara-x-query.mjs`, `x-cases.mjs`, `schedules.mjs`, `work-failures.mjs`, `pdf-store-admin.mjs`, `scripts/pdf-store/*`. Vor dem Aufräumen dieser Dateien mergen oder bewusst aussparen, sonst Konflikte.
- Tote Module: in `server/` und `shared/` nur `shared/ai-result-batches.mjs` (nur Test).

## A. Code-Qualität

### A1 Sicherheitsnetz (verhaltensneutral, Risiko niedrig, zuerst)
- `eslint.config.mjs`: `build/**` ist ausgeschlossen, obwohl dort Quellcode liegt; `.claude/worktrees/**` (≈ 1.800 Dateien) wird mitgeprüft; `dist`, `tmp`, `.local-backups` nur im npm-Script statt in `globalIgnores`.
- Für `.mjs` (338 von 356 Backend-Dateien) fehlen Grundregeln (`no-undef`, `no-dupe-keys`, `no-unreachable`); `checkJs` aus. Deshalb fiel der kaputte Import in `scripts/facts-study/measure-funding.mjs` nicht auf. Vorschlag: `js.configs.recommended` mit Node-Globals für `**/*.mjs`.
- 3 Fehlalarme `react-hooks/rules-of-hooks` wegen `useDocumentStore` (`server/node/import-worker.mjs:38`, `scripts/pdf-store/summaries.mjs:39`, `read-reports-check.mjs:20`): React-Regeln nur für `app/`, `components/`.
- `package.json`: `"test"` und `"typecheck"` ergänzen; Name noch `site-creator-vinext-starter`.

### A2 Toter Code und Altlasten (verhaltensneutral, Risiko niedrig)
- `server/integrations/pio.mjs:129–204`: ganze Ergebnis-Erkennung aus Freitext (`outcome`, `tally`, `endsSentence`, `YES/NO`, `SETTLED` …) wird nie aufgerufen; `tests/pio.test.mjs:85` sagt ausdrücklich „no status is read from free text“. Import `DECIDING_BODY` ungenutzt.
- `scripts/facts-study/measure-funding.mjs` importiert das seit 15.10. entfernte `fundingEuroOf` (läuft nicht) samt `tests/fixtures/facts-funding-reference*.json`; `sample-facts.mjs` mit Standard `kita_places`.
- Label-Studie labels-v2 (laut CLAUDE.md ungültig): `scripts/label-study/`, `shared/label-study.mjs`, `tests/label-study.test.mjs`, `tests/fixtures/label-*.json` (192 KB).
- `shared/ai-result-batches.mjs` samt Test; tote Exporte `ITEM_KINDS`, `RegionId`, `ROUTINE`/`COLLECTION` in `themes.mjs:151` (alte Kopie von `item-kind.mjs`), `WASTE_TITLE`, `FREE_ANALYTICS`; `sessionnet.links`; unbenutzte Importe (`ai-summary` `hash`, `analytics-factions` `searchFilters`, `pipeline-worker` `currentRelease`, `plenara-x-query` `wilson`, `nightly.mjs` `queueJob` …). Etwa 30 Exporte, die nur in der eigenen Datei genutzt werden (`export` kann weg).
- Abhängigkeiten `cmdk`, `class-variance-authority` ohne Import; Platzhalter `allowBuilds: core-js` in `pnpm-workspace.yaml`; `overrides` doppelt (dort und in `package.json`).
- Text-Reste: README nennt 12 nicht mehr vorhandene Skripte; `shared/source-access.mjs:18` verweist auf eine nicht vorhandene JSON; Kommentare in `readers.mjs` stehen vor dem falschen Leser; `tests/topic-facts.test.mjs:25` filtert noch `radar:`; `session.ts:85` doppelter JSDoc.

### A3 Gemeinsame Helfer (verhaltensneutral, nur wörtlich gleiche Kopien, Risiko niedrig)
- In den Adaptern: `fnv` 11×, `slug` (nur ASCII) 9×, `day` TT.MM.JJJJ 7× bzw. 4× (zwei Varianten), `clip` 6× (obwohl `small-common` ihn exportiert), `guard`/`PATHS` 3×, `plain` 3×, `RESTRICTED` 5×, `safeDecode` 3×, `MONTHS` 3×, `citystates.mjs:35–40` kopiert aus dem schon importierten `ckan.mjs`. Nicht vereinen: `slug` mit Umlautfaltung (ändert Topic-IDs), die drei Entity-Decoder (verhalten sich verschieden).
- Helfer liegen in fremden Adaptern: `sessionnet.mjs` liefert `fetchText/allowed/text/decode` an 34 Module, `oparl.mjs` `hash/category/sourceSummary/parallel` an 29. Vorschlag `server/integrations/source-common.mjs`, alte Stellen exportieren weiter.
- `system_state`: Lesen 29× in 11 Dateien, Upsert 26× in 21 Dateien, drei eigene `readState`. Vorschlag `shared/system-state.mjs`.
- `sqliteAdapter` (D1-Adapter für 10 laufende Skripte und ≈ 45 Tests) liegt im Altskript `scripts/ai-job.mjs`; in ein neutrales Modul, `ai-job.mjs` reicht weiter.
- Zeitbudget: `BUDGET_REACHED` existiert, `sessionnet:53` und `website:71` schreiben den Text literal, 44× `/Zeitbudget/.test(`; Helfer `isBudgetReached(e)`, `httpStatus(e)`. Feste Zahlen: `maxDurationMs=300000` in 27 Dateien, `parallel(…,2)` 31×.
- Suche: `norm` dreimal gleich (`monitor-search.mjs:11`, `x-terms.mjs:9`, `analytics-compare.mjs:22`), gehört zusammen, weil Suche und plenara.X gleich zählen müssen. `requireSameOrigin` doppelt (`accounts/http.mjs`, `admin-access.mjs`).

### A4 Gemeinsamer Rahmen für Adapter und Routen (Risiko mittel, schrittweise)
- `sourceSummary` (`oparl.mjs:39`) schreibt „Münster“ fest; 26 Adapter flicken das mit `replace('in Münster','in '+source.name)` und kopieren den `t.quality`-Block (26×), `budgeted(…)` (25×), „Sitzungslimit erreicht“ (24×). `collectSmall` ist dieser Rahmen schon, nutzen aber nur 5 Leser. Vorschlag `sourceSummary(t,{place})` + `finishTopics(…)`, dann Adapter einzeln umstellen (alle haben Tests).
- `collect-region.mjs`: if-Kette (Münster, NRW-OParl, `'recklinghausen'`, sdnet, allris) neben der `READERS`-Registry, `oparlChecked` und „pending“ doppelt. Münster-Quelle viermal definiert.
- Admin-POST-Routen: 11 lesen den Body selbst (Größe, `JSON.parse`), fünf nehmen auch Arrays an, uneinheitliche Reihenfolge (`todos` prüft Admin vor Herkunft, `quality` meldet 503 vor der Anmeldung). Vorschlag `adminRoute(handler,{write,maxBytes})`.
- 13 Datenrouten mit identischem catch-Block und 14 eigenen `CACHE='public,…'`-Konstanten, die `gated()` ohnehin zu `private` macht (Kommentare „öffentlich“ irreführend). Fehlerklassen mit vertauschter Argumentreihenfolge (`AdminError(status,msg)` vs. `AnalyticsError(msg,status)`). Vorschlag `dataFailure(error)`.
- Vier interne Routen bauen die Bearer-Prüfung selbst statt `internalCall`. Fehlerformat uneinheitlich (Klartext in `dokument`, `calendar/ics`; `throw Error('Datenbank fehlt')` 9× in `repositories/admin.ts`; `topics/[id]` ohne try/catch).
- Vorschlag: statischer Test über alle `app/api/**/route.ts`, der je Route `gated`/`adminRead`/`requireAdmin`/`accountRoute`/Bearer oder einen Eintrag in einer Ausnahmeliste verlangt.

### A5 Große Module (verhaltensneutral beim reinen Verschieben)
- `website-text.mjs` (169 KB): Kodierung (4 KB) und „nichtöffentlich“ (13 KB) brauchen auch councilservice, komfa, ris-portal, citystates, public-agenda; zuerst diese beiden auslagern (mit Re-Export). `parseSessionText` ist eine Funktion mit 40 KB.
- `website.mjs`: `collectWebsite` über 335 Zeilen, Ratsnamen-Liste 3×, `fetchSite` wiederholt die Weiterleitungsschleife von `fetchText`.
- `server/services/sync.ts`: irreführende Formatierung (Anweisung nach `if(…)return` in derselben Zeile, 36–37, 44–47, 94–95, 165), 10 leere catch-Blöcke (Vorschlag `bestEffort(label,fn)` mit `console.warn`), `UPDATE import_runs` 3×, `source_coverage`-Upsert 2× (+ seed, backfill).

### A6 Typen und Logging (niedrig)
- Keine `@ts-ignore`; JSDoc fehlt an den `.mjs`-Exporten, die TypeScript importiert (`accessDecision`, `currentSession`, `accountsConfig`, `AdminError` …); `Handler=(ctx:any)` in `session.ts:15`.
- Stille Rückfälle: `requestTier` macht bei einem Fehler der Kontendatei still einen Gast (`session.ts:101`); `/api/dokument` macht aus einem DB-Fehler 404. Log-Präfixe uneinheitlich.

## B. Performance für das Frontend

### Hoch
- **B1 Regex-Tabellen im Startpaket jeder Seite.** `lib/constants.ts:3` und `lib/searchUrl.ts:1` importieren `LABELS` aus `shared/labels.mjs`, das `themes.mjs` lädt; dort entstehen beim Laden 70 RegExps mit `\p{L}`-Lookarounds (`themes.mjs:117`). 34 KB min, größtes eigenes Modul im Startpaket, ≈ 65 ms Rechenzeit vor der Hydrierung (Desktop; Handy geschätzt das 3- bis 5-Fache). Das Frontend braucht nur Namen und Farben (≈ 2,5 KB gz). Vorschlag `shared/theme-names.mjs`. Neutral; ändert zwei Importzeilen im Frontend.
- **B2 Facettenzählung je Filter neu.** `monitor-search.mjs:199–202`: Die Gruppierung `region_id,label,status` hängt nur von Ebene, Zeitraum, Formalien und Begriff ab; Ort, Thema, Status und Umkreis filtert danach JavaScript. Der Cache ist aber an der ganzen Adresse festgemacht, also rechnet jeder Ort- oder Filterklick dieselbe Zählung neu (laut früheren Servermessungen 0,85–1,9 s). Vorschlag: Gruppenzeilen getrennt merken (Facetten-SQL + Argumente + Datenstand `search`); erwartet 10–30 ms je weiterer Variante. Neutral.
- **B3 `/api/x/teaser` rechnet im Hauptthread.** `teaser` fehlt in `X_FUNCTIONS` (`x-registry.mjs:14`), `xTeaser` ruft news, trends, network, decisions, Fakten und Signale direkt auf. `warmTeasers` (`serve.mjs:140`) stößt nach jedem Bau von `x_cases` und um Mitternacht UTC alle 16 Auszüge nacheinander an: grob 10–15 s Arbeit im Hauptthread, Blöcke bis 2,5 s, in denen keine andere Anfrage bedient wird. Vorschlag: Auszüge aus `xCached` der Grundarten zusammensetzen (rechnet dann im Worker, teilt den Cache mit den X-Seiten). Neutral.
- **B4 Zeilenkopie im Datenbank-Adapter.** `d1-sqlite.mjs:52,75,80`: jede Zeile wird mit `{...row}` kopiert. Nachbau 600.000 × 15 Spalten (Form von `x_cases`): 2,5 s lesen + 2,1 s kopieren; mit `setReturnArrays(true)` und Objektbauer je Anweisung 1,3 + 0,1 s. Trifft trends, graph, decisions, compare in den X-Workern. Neutral (Node-Version auf dem Server prüfen; doppelte Spaltennamen wie bisher).

### Mittel
- **B5 `warmData()` blockiert alle 10 Minuten** (`serve.mjs:128`): synchroner Vollscan von `x_cases` (terms ≈ 85 MB) im Hauptthread, 144× am Tag, und wärmt nur den Betriebssystem-Cache, nicht die Seitencaches der Worker. Vorschlag: als Nachricht an die X-Worker. Neutral.
- **B6 Gleichzeitige gleiche Anfragen rechnen doppelt** (`revision-cache.mjs:41`, `cachedSearch`, `x-offload.mjs`): nach einem Wechsel des Datenstands rechnet jede gleiche Anfrage selbst; zwei news-Läufe (je 2,5 s) können vor einem Atlas (78 ms) in der Warteschlange stehen. Vorschlag: laufendes Promise je Schlüssel merken. Neutral.
- **B7 Erste Suchseite** (`part=stream`) ohne Cache, auch die für alle gleiche Startliste von `/suche`; `ROW_SELECT` liest `topics.payload` je Zeile vor dem `LIMIT`, weil der Index nur `date` hat (1.500 Karten am selben Tag: 1.500 Auswertungen für 21 Zeilen). Vorschlag: `WITH ids AS MATERIALIZED (… LIMIT …)` + Join; Stromergebnis je Datenstand merken. Neutral (B4 aus dem Audit vom 10.10.).
- **B8 Deutschlandkarte** `de_map.json` (2,4 MB / 1,2 MB gz) lädt auf fast jeder Seite im Leerlauf (`state/data.tsx:17`), danach ≈ 160 ms Aufbau; auf den plenara.X-Kartenseiten fehlt sie dagegen bis zu 4 s, bevor der Download beginnt. Vorschlag: auf X-Kartenseiten sofort laden (neutral); auf Artikel- und Infoseiten später (nicht neutral). Frontend.
- **B9 Kreiskarte der Startseite** `/geo/de-districts.json` (897 KB / 294 KB gz): mit relativen Pfadbefehlen 489 KB / 145 KB gz; Mitten ins JSON statt 30 ms Regex beim Laden und erneut je Rendern (`StartseitePage.tsx:198,323`). Generator + Frontend. Neutral.
- **B10 Gebietskatalog-Chunk** (514 KB / 142 KB gz) enthält `POPULATION` (≈ 30 KB gz), das nur der Admin braucht → `shared/population.mjs`; Trends lädt den ganzen Katalog nur für Ortsnamen. Neutral.
- **B11 Wasserfall auf plenara.X:** ein Sammelchunk `AnalyticsPages` (272 KB / 86 KB gz) für alle 12 Seiten, Datenabruf wartet auf `/api/me`. Vorschlag `lazy()` je Seite, Abruf ohne Warten starten, wenn ein Sitzungscookie da ist. Frontend.

### Niedrig bis mittel
- **B12 Sitzung mehrfach je Anfrage:** `/api/search` macht 6 Kontenabfragen und 3 SHA-256 (`guard()` und die Route rufen `requestTier` beide auf). Vorschlag: WeakMap je `Request`, `guard` gibt die Stufe zurück.
- **B13 Gemerkte Antworten** (Fakten ≈ 1 MB, Atlas 428 KB) gehen bei jedem Treffer durch `JSON.stringify`; außerhalb von `/api/admin` gibt es kein ETag. Vorschlag: JSON-Text im Cache halten, schwaches ETag aus Datenstand und Schlüssel, 304.
- **B14 Admin:** `middleware.ts:14` setzt für `/api/admin|auth|me` `no-store` und überschreibt damit (vinext `mergeMiddlewareResponseHeaders` nutzt `set()`) `private, no-cache` + ETag der Admin-Lesewege. Folge: Der ETag-/304-Weg der Vorberechnung greift nie. Nicht live gemessen (`curl -I` auf dem Server). Behebung ändert gewollt Kopfzeilen. Dazu Polling ohne Sichtbarkeitsprüfung in 8 Admin-Seiten (60 s, 30 s, 5 s).
- **B15 Bau und Auslieferung:** `deploy/node/deploy.sh:39` baut ohne `--precompress` (Caddy 2.6.2 kann kein Brotli); Server-Bündel: Quellkataloge 1,78 MB mit zur Laufzeit ungenutzten Feldern (`apiCheck`, `verifiedSource`, `foundBy`, ≈ 0,9 MB), `nrw-seed-gzip.json` (4 MB) und `billerbeck-content-v1.json` (3 MB) fest importiert (Startzeit und Speicher, nicht Frontend).
- **B16 Kleinere:** Gebietsnamen je Suche 4–5× normalisiert (2–4 ms); Detailseite liefert ≈ 20 % ungenutzte Felder und parst die ganze Nutzlast samt `sourceText` (auch `/api/dokument`, das nur eine URL braucht); `KEEP_PER_KIND=20` gilt für alle Varianten von `x-v6` zusammen; Kalender läuft `json_each` über `topics.payload` ohne Cache (B6 vom 10.10.).

## C. Entscheidungen (nicht verhaltensneutral)

1. Push: Oberfläche seit 17.10. weg, kein Service Worker registriert; übrig sind `app/api/push/*`, `server/services/push.ts`, `dispatchDecisionPush` in `sync.ts`. Entfernen oder bewusst behalten.
2. Admin-Routen ohne Aufrufer: `/api/admin/analyse`, `/import`, `/prepared-analysis` (bündelt 3 MB). `analyse?mode=summaries` ist der einzige Weg zu `refreshSummaries` mit OpenAI-Zusammenfassung (nur Münster), was „keine automatische Modell-API“ widerspricht.
3. Alter Admin-Weg über Kopfzeilen (`ADMIN_LEGACY_HEADER`, auf dem VPS an): erst abschalten, dann entfernen.
4. Rückfall- und Einmalskripte: `summaries.mjs`, `facts.mjs` (zählt noch `funding`), `read-reports-check.mjs`, `scripts/ai-batch/` (ruft `claude -p`), `dedupe-analyses`, `compact-/prune-versions`, `ocr-mac`/`ocr-import`, `check-dup-shared`, verworfene Thema-Varianten samt 700 KB Fixtures.
5. Nur von Tests genutzte Repositories (`analytics.ts` `getAnalytics`, `getFeedPage`, `getSourceStats`, `getUpcomingSessions`, `getRelated`): gehört zu D11 (Rückfall-Startdaten).
6. `labelName` viermal in `analytics-*` mit abweichendem Ersatzwert (`id`/`null` statt „Sonstiges“, ohne `LEGACY_LABELS`): Vereinheitlichen ändert Ausgaben.
7. User-Agent: `document-proxy.mjs:13` „Mozilla/5.0 (Plenara …)“ gegen `robots-policy.mjs` „never a browser identity“.
8. HTTP-Fehler ohne `retryAfterMs` in `website`, `citystates`, `ti-generator` (anders als `fetchText`).
9. `/api/dokument` aus der PDF-Ablage statt live (schneller, bricht aber „nichts wird gespeichert“).
10. Farben: `app/api/dokument` `errorPage` nutzt `#18181b`, `#52525b`, `#268478` außerhalb von „Petrol klar“.

### Entschieden am 20.10.2026

| Nr. | Entscheidung | Umsetzung |
|---|---|---|
| C1 Push | Entfernen. Keine Vorliebe angegeben, also die Empfehlung; ein Einspruch geht noch. | `app/api/push/*`, `server/services/push.ts`, `dispatchDecisionPush` in `sync.ts`, `pushConfigured`, `public/sw.js`, VAPID-Zeilen der Vorlage |
| C2 Admin-Routen | Alle drei entfernen. | `/api/admin/analyse`, `/import`, `/prepared-analysis`, dazu `refreshSummaries` mit OpenAI-Zusammenfassung (`runSync` Modus `summaries`), `server/data/billerbeck-content-v1.json`; Tests anpassen |
| C3 Alter Admin-Weg | Entfernen. Berichtigt: Auf dem Server ist er laut `docs/betrieb/node-server.md` seit 19.10. aus (`ADMIN_LEGACY_HEADER=0`), nicht an. | `admin/claim`, `adminAccess`, `getChatGPTUser`, `Vary: oai-authenticated-user-id`; vorher auf dem Server `cleanup-legacy` (nur nach Rückfrage) |
| C4 Skripte | Entfernen: `summaries.mjs`, `facts.mjs`, `read-reports-check.mjs`, `scripts/ai-batch/`, `dedupe-analyses.mjs`, `check-dup-shared.mjs`, verworfene Thema-Varianten samt Fixtures. Bleiben: `compact-/prune-versions` (dokumentierte Wartung), `ocr-mac`/`ocr-import` (Test). | CLAUDE.md und Doku mitziehen |
| C5 Rückfall-Startdaten | Eigenes Paket nach Paket 6 (D11). | Funktionen, Startdaten und Rückfallwege zusammen |
| C6 `labelName` | Vereinheitlichen auf `shared/labels.mjs`. Noch drei Kopien: `analytics-decisions`, `analytics-factions`, `analytics-graph`. | Vorher prüfen, ob `graph` `null` zum Ausfiltern braucht |
| C7 User-Agent | Projektkennung. `requirements/freischaltung-anfragen.md` sagt den Kommunen „keine Browser-Kennung“ zu. | `document-proxy.mjs` wie der Abruf, Zusatz Dokumentenansicht |
| C8 Retry-After | Angleichen. | `website.mjs`, `citystates.mjs`, `ti-generator.mjs` über `statusError` |
| C9 Dokumente aus der Ablage | Später, eigenes Thema: Aktualität und Rechtliches erst klären. | – |
| C10 Farben der Fehlerseite | Berichtigt, keine Entscheidung nötig: `#18181b`, `#52525b` und `#268478` sind die Palettenwerte (Text, Grautext, Petrol). Die eigenständige HTML-Seite hat keine CSS-Variablen. | bleibt |
| C11 Themenfarben | Entfernen. `LABELS` in `shared/labels.mjs` tragen Hex-Farben außerhalb der Palette, die Oberfläche nutzt sie nicht. | `color`/`COLORS` raus, `tests/labels.test.mjs` anpassen |

### Umsetzung (20.10.2026)

- **Paket C (Branch `cleanup/entscheidungen`, Commit b9322ea1):** C1, C2, C4, C6, C7, C8, C11 wie entschieden. Typecheck, Lint (0 Fehler), Tests (nur die zwei bekannten Windows-Fehler) und `build-node` laufen durch.
- **Folgen von C2 und C4**, entfernt, weil kein Aufrufer mehr da war:
  - `compact-summary.mjs`
  - `enrichDocument` und `extractPassages` in `documents.mjs`
  - `sharedByHosts` in `quality-check.mjs`
  - die Ablage-Methoden für `text_hashes`/`facts_keys` in `pdf-store.mjs`
- **`qualityCheck` bleibt:** `oparl.mjs` ruft es beim Abruf von Münster selbst auf. Die neue Lint-Regel `no-undef` hat das gezeigt.
- **C3 (eigener Branch `cleanup/legacy-admin`):**
  - Rückfrage: Den Cloudflare-Build braucht niemand mehr. Damit ist Variante a aus `requirements/konten-konzept.md` aufgehoben.
  - Entfernt sind alter Weg, Freischaltung, `bind-admin-owner.mjs` und `legacyHeader`.
  - `tests/admin.test.mjs` prüft die Admin-Routen jetzt über den Kontoweg.
  - Die Zeile `admin-owner-v1` bleibt auf dem Server (entschieden, ungelesen). Einen Befehl `cleanup-legacy` gab es nie, nur die Warnung in `serve.mjs` nannte ihn.
  - Laut Konzept wird zwei Wochen nach Schritt 4 (19.10.) aufgeräumt, also frühestens am 02.11. Bis dahin wäre `ADMIN_LEGACY_HEADER=1` der Rückweg.
- **Neu aufgefallen, außerhalb von „Petrol klar“ (nicht geändert):**
  - Konto-Mails: `server/accounts/mail-templates.mjs` (`#0f5e66`, `#1f2937`, `#6b7280`, `#f6f7f9`).
  - Kategorien des Lückenatlas: `shared/atlas-categories.mjs` (Grün, Violett, Rot).

## Vorgeschlagene Pakete

1. A1 Sicherheitsnetz (Lint grün für Backend, `test`/`typecheck`).
2. A2 toter Code und Altlasten.
3. A3 gemeinsame Helfer (nur gleiche Kopien).
4. B2–B7, B12, B13 Server-Performance (alle neutral, je mit Test und Messung).
5. B1, B8–B11, B15 Ladezeit (berührt `components/`, nach `FRONTEND.md`).
6. A4/A5 größere Umbauten, Adapter einzeln.
7. C nach Entscheidung.

Je Paket eigener Commit, danach `node --test tests/*.test.mjs`, `tsc --noEmit`, `node scripts/build-node.mjs`; vor A3/B3–B5 den Branch `claude/lucid-cray-28b349` klären.

## Umsetzung Pakete 1–3 (20.10.2026, Branch `cleanup/backend`)

Nach jedem Paket: `npm run typecheck` fehlerfrei, `npm test` grün bis auf die zwei bekannten Windows-Fehler, nach Paket 3 `node scripts/build-node.mjs` ohne neue Warnung. `npm run lint` im ganzen Repo: vorher 25 Fehler (nur Backend gezählt), jetzt 0 Fehler, 62 Warnungen (davon 2 im Backend, beide in Dateien des offenen Branches).

- **Paket 1 (dedcc4b7):** A1 umgesetzt; 25 explizite `any` durch Typen ersetzt (nur Typen); `npm test`, `npm run typecheck`.
- **Paket 2 (1afb6292):** A2 umgesetzt: `pio.mjs`, unbenutzte Importe/Variablen/Konstanten, Label-Studie labels-v2, `measure-funding.mjs`, `ai-result-batches.mjs`, `cmdk`, `class-variance-authority`, Kommentare und README-Absatz.
- **Paket 3 (3479795e):** `server/integrations/source-common.mjs` (zeichengleiche Helfer aus 21 Lesern), `norm` der Suche einmal, `scripts/sqlite-adapter.mjs`, `BUDGET_REACHED` statt Literal.

Bewusst nicht gemacht, mit Grund:
- Rund 100 Exporte, die nur in ihrer eigenen Datei vorkommen: werden dort alle benutzt, also kein toter Code; viele liegen in Dateien des offenen Branches.
- `system_state`-Helfer: Zugriffe zu uneinheitlich (Batches, Bedingungen, JSON-Werte), teils in Dateien des offenen Branches.
- `/Zeitbudget/.test(e.message)` (44×) als Helfer und `maxDurationMs=300000` als Konstante: ein Helfer mit `String(e)` verhielte sich bei geworfenen Nicht-Errors anders; reine Umbenennung ohne Nutzen.
- `requireSameOrigin` doppelt: verschiedene Fehlerklassen und Texte, Sicherheitscode; gehört zu A4 (Routen-Rahmen).
- `guard`/`guarded`/`statusOf`/`plain` der Leser: hängen an Modul- oder Funktionsvariablen (A4).
- `pnpm-workspace.yaml` (`allowBuilds: core-js`, doppelte `overrides`) und `deploy.sh`: Bereitstellung, nicht ohne Rücksprache.
- README: historische Kapitel mit entfernten Skripten bleiben als Protokoll; korrigiert nur Aussagen zum heutigen Stand.
- Dateien des offenen Branches `claude/lucid-cray-28b349` an denselben Stellen (`nightly.mjs` `queueJob`, `failures.mjs`, `schedules.mjs` `STEP_MIN`, Kommentar in `work-failures.mjs`): nach dessen Merge nachziehen.

## Umsetzung Paket 4: Server-Performance (20.10.2026, Branch `cleanup/server-performance`)

Gemessen lokal auf der D1-Kopie (1,33 Mio. `search_cards`, Node 24, nur lesend), Ergebnisse jeweils mit der alten Fassung verglichen (gleich). Die lokale Kopie hat kein `x_cases`; plenara.X ist deshalb mit Tests und Nachbauten geprüft, nicht gemessen.

| Punkt | Änderung | Messung lokal |
|---|---|---|
| B4 | `d1-sqlite.mjs`: Zeilen als Arrays lesen, Objektbauer je Anweisung (`setReturnArrays`, sonst wie bisher) | 600.000 × 5 Spalten 2,4 s → 1,2 s; 200.000 × 8 1,2 s → 0,6 s; Facettengruppen 290 → 170 ms |
| B2 | Suche: Gruppen der Zähler je Grundfilter und Datenstand gemerkt (`keptGroups`), Ort/Thema/Status filtert JS | „schule“ + Status 2,96 s → 27 ms; ohne Formalien + Thema 240 → 30 ms (jeder weitere Filter auf denselben Grundfilter) |
| B7 | Seite und Strom nach Datum: erst die IDs (`WITH ids AS MATERIALIZED`), dann die Stationen | großes Gebiet 136 → 17 ms; älteste zuerst (Kreise) 1,5 s → 39 ms; Strom mit Gebiet 180 → 32 ms; Seite 40 31 → 6 ms; Relevanz unverändert |
| B3 | `/api/x/teaser` rechnet im plenara.X-Worker (`xOffload`, ohne Worker wie bisher) | Hauptprozess frei (Test mit eigenem Worker) |
| B5 | `warmData` mit Worker in einem eigenen Thread (Nachricht `warm`, `warmX`) | Hauptprozess frei (Test) |
| B6 | Gleiche laufende Rechnungen geteilt (`atRevisionStale`, `cachedSearch`) | zwei gleichzeitige Anfragen: eine Rechnung (Tests) |
| B12 | `requestTier`/`internalCall` einmal je Anfrage (WeakMap) | Suche: eine statt zwei Sitzungsabfragen, ein statt drei SHA-256 |
| B13 | plenara.X-Routen: JSON-Text und schwaches ETag je gemerktem Ergebnis, 304 (`server/services/cached-json.mjs`) | kein `JSON.stringify` je Treffer mehr; 304 bei gleichem Stand |

Nicht im laufenden Server geprüft (kein Start auf der lokalen Kopie, kein Deploy). Auf dem Server nach dem Deploy messen: Suche mit Gebiet, Filterklicks, `/api/x` nach dem Bau.

## Umsetzung Paket 5: Ladezeit (20.10.2026, Branch `cleanup/ladezeit`)

- **B1:** `shared/themes.mjs` baut die 70 Muster erst bei der ersten Einordnung (`reFor`, `themeRe`). Die Oberfläche lädt die Datei nur für Namen. Laden in Node: 63–79 ms → 9–10 ms. Die Ausgabe von `scripts/theme-study/measure.mjs` ist auf `theme-dev`, `theme-val` und `theme-test` unverändert. Gewählt statt eines eigenen Namensmoduls: Das hätte die 70 Unterthemen-Namen ein zweites Mal gebraucht. Die Größe des Chunks bleibt deshalb fast gleich.
- **B10:** `POPULATION` in `shared/catalog.mjs` ist als reiner Aufruf markiert (`Object.assign`, gleiches Objekt). Der Gebietskatalog-Chunk sinkt von 540 auf 436 KB, komprimiert von 144 auf 113 KB. Die Einwohnerzahlen sind nicht mehr im Client.
- **B8:** Die Karte lädt auf plenara.X Atlas, Fakten und Trends sofort statt im Leerlauf (`MAP_NOW` in `state/data.tsx`). Die Datenmenge bleibt gleich, nur der Zeitpunkt ist früher.
- **Nicht gemacht:**
  - B9 (Kreiskarte neu erzeugen): Generator und Datendatei, eigener Schritt mit Sichtprüfung.
  - B11 (`lazy()` je plenara.X-Seite, Abruf ohne Warten auf `/api/me`): Umbau des Routings.
  - B15 (`--precompress` in `deploy.sh`): Bereitstellung, nur mit Rücksprache.
  - `scripts/frontend-check.mjs` nicht gelaufen (braucht laufenden Server und Playwright).
- **Neu aufgefallen (Entscheidung):** `LABELS` in `shared/labels.mjs` tragen Hex-Farben außerhalb von „Petrol klar“ (`COLORS`). Die Oberfläche nutzt nach Suche im Code nur Namen und IDs. Klären, ob die Farben weg können.

## Umsetzung Paket 6: Rahmen und große Module (20.10.2026, Branch `cleanup/paket-6`)

- **6a:** `server/services/data-response.mjs`
  - `dataFailure` und `X_CACHE` ersetzen 13 gleiche catch-Blöcke und 11 gleiche Cache-Angaben.
  - Die internen Routen prüfen den Bearer über `internalCall`.
  - Neu ist `tests/route-access.test.mjs`: Jede Route unter `app/api` prüft ihren Zugang, ändernde Admin-Routen auch die Herkunft. Die Gegenprobe mit `gated` testweise entfernt schlägt an.
- **6b:** `sync.ts`
  - `bestEffort` statt leerer catch-Blöcke: Fehler kommen als Warnung ins Log.
  - Die irreführenden Zeilen sind gerade gezogen, die SQL-Texte stehen als Konstanten da.
- **6c:** `text-repair.mjs` übernimmt die Textreparatur aus `website-text.mjs`. Der Teil zu nichtöffentlichen Abschnitten bleibt dort, weil er an `normalizeLine` hängt.
- **6d:** `sourceSummary(t,{place})` in 29 Lesern.
  - Behebt das Ersetzen von „in Münster…“ im Titel.
  - Ein gemeinsamer Abschluss für die Qualitätsangaben lohnt nicht, die Texte sind je Leser eigen.
- **Zurückgestellt:**
  - Rahmen für die Admin-POST-Routen (`adminRoute`): nach C3 (#18), sonst Konflikte in `admin-auth.ts` und `tests/admin.test.mjs`.
  - Verteilung in `collect-region.mjs`.
  - `collectWebsite` aufteilen.

## Vorher-Nachher-Vergleich auf dem Server (20.10.2026, 22:45 bis 23:15)

- **Aufbau:**
  - „Vorher“ ist main `a6bea4f5`. „Nachher“ ist main plus #14 bis #19 einschließlich #18, als lokaler Merge ohne Konflikte.
  - Beide Fassungen sind wie bei `deploy.sh` auf dem Server gebaut und laufen gleichzeitig auf 127.0.0.1 mit niedriger Priorität.
  - Beide lesen dieselbe Datenbankkopie (Sicherung vom 19.10. 22:30, 26 GB). Jede Fassung hat eine eigene Testkontendatei mit einem Konto Enterprise + Admin.
  - 183 GET-Abfragen: Suche 60, plenara.X 27, Teaser 8, Auswertungen 34, Admin 21, Themen 8, Daten 4, Seiten 6, Gast 12, Konto 1, entfernte Wege 2.
  - Die Reihenfolge wechselt je Abfrage: Wer zuerst fragt, liest aus dem leeren Seitencache des Systems.
  - Produktion, Live-Datenbank, env und systemd blieben unberührt. Alles ist wieder entfernt, der Platz ist wieder 48 GB frei.
- **Gleichheit:** Alle Datenantworten sind inhaltlich gleich. 106 sind auf das Byte gleich. Die übrigen Unterschiede sind erwartet:
  - 54 Antworten von plenara.X, Teasern und Auswertungen tragen jetzt ein ETag (Paket 4, `cachedJson`), der Inhalt ist gleich.
  - `/api/admin/summary` hat kein `counts.pushSubscriptions` und kein `operations` mehr (C1, C2). Die Oberfläche liest beides nicht.
  - `/api/push/*` antwortet mit 404 (C1).
  - Testbedingt: Zeitstempel (`asOf`, `at`, `next`), die Konto-ID, der Port in den Kalenderlinks und die Asset-Namen im HTML.
  - Die Serverprotokolle zeigen keine Fehler.
- **Zeiten** (Summe über alle Abfragen der Gruppe):

| Gruppe | Lauf 1 kalt (Cache leer) | Lauf 2 kalt (neu gestartet, Reihenfolge getauscht) | warm (Median aus 3) |
|---|---|---|---|
| alle | 81,0 → 67,0 s (−17 %) | 75,2 → 60,0 s (−20 %) | 3,19 → 3,15 s (−1 %) |
| Suche | 43,6 → 29,5 s (−32 %), Median 777 → 176 ms | 42,0 → 30,9 s (−27 %), Median 791 → 240 ms | −4 % |
| Auswertungen | 15,5 → 12,6 s (−18 %) | 15,6 → 12,0 s (−23 %) | −3 % |
| plenara.X | 16,9 → 16,1 s (−5 %) | 13,1 → 13,3 s (+1 %) | −3 % |
| Admin | 4,1 → 7,9 s (Reihenfolge, siehe unten) | 3,9 → 3,5 s (−12 %) | −1 % |
| Seiten | 0,57 → 0,12 s | 0,21 → 0,09 s | +4 % |

- **Größte Gewinne:**
  - Facetten seltener oder kurzer Begriffe (`ab`, `b-plan`, `windenergie`): 0,9 bis 1,1 s → 14 bis 35 ms.
  - Seite 2 und `sort=asc`: 1,0 bis 1,4 s → 40 bis 165 ms.
  - `sort=relevance`: 1,9 bis 2,1 s → 0,9 bis 1,1 s.
  - `/api/analytics/decisions` ohne Filter: 2,6 → 1,3 s.
- **Verschlechterungen:**
  - In Lauf 1 waren `/api/admin/social` (1,4 → 3,9 s), `/api/admin/summary` (0,3 → 1,8 s) und `/api/x?view=atlas&q=schule` (0,5 → 3,8 s) nachher langsamer. Jedes Mal fragte „Nachher“ zuerst. In Lauf 2 mit getauschter Reihenfolge war keine davon langsamer, summary 617 → 337 ms.
  - In Lauf 2 bleiben zwei Abweichungen über 150 ms: Suche `haushalt` Seite 1 (1,09 → 1,30 s) und `/api/x?by=fact:hebesatz` (2,37 → 2,65 s), beide mit „Nachher“ zuerst. In Lauf 1 war hebesatz 4,1 → 2,6 s. Das liegt im Rauschen.
- **Last** (8 parallel, je Liste 60 neue Abfragen: Seite, Facetten, Atlas mit Begriff): ohne Fehler.
  - Liste 1, „Vorher“ zuerst: 26,0 s, p95 7,5 s → 19,0 s, p95 3,8 s.
  - Liste 2, „Nachher“ zuerst: 22,8 s, p95 5,5 s; danach „Vorher“: 22,5 s, p95 5,6 s.
  - Unter Last also mindestens gleich.
- **Speicher:** Die Spitze lag in Lauf 1 bei 2,06 GB vorher und 2,32 GB nachher, in Lauf 2 bei 2,54 GB vorher und 1,98 GB nachher. Ein Unterschied ist nicht erkennbar.
- **Nicht abgedeckt:**
  - POST und Admin-Aktionen, Importprozess, Jobs der PDF-Ablage und von `rule-texts`, MCP, Darstellung im Browser.
  - Drei Abfragen mit `label=bildung` und `compare` ohne Ort antworteten bei beiden mit 400 (falsche Testadresse). Der Themenfilter ist daher nur über `/api/x` geprüft.
