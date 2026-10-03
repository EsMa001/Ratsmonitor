# Performance und Überführung in ein eigenes Hosting

Stand: 3. Oktober 2026 · Grundlage: vier Teilanalysen (Hosting/Deployment, Backend/Datenbank, Frontend, Betrieb/Sicherheit) mit Codefundstellen sowie eigene Messungen an der lokalen Datenbank.

## Ausgangslage

- **Plattform:** Das Projekt ist eine Vorlage für OpenAI Sites („site-creator-vinext-starter“), technisch Cloudflare Workers mit D1. Ein eigenes Deployment gibt es nicht (Platzhalter-Datenbank-ID in `vite.config.ts`/`wrangler.local.json`, kein Deploy-Skript, keine CI unter `.github/workflows/`). Die OpenAI-Plattform deployt anhand von `.openai/hosting.json`.
- **Anmeldung:** Der Admin-Login vertraut allein den Kopfzeilen `oai-authenticated-user-*` (`app/chatgpt-auth.ts`). Außerhalb der OpenAI-Plattform sind diese fälschbar.
- **Importe:** laufen synchron im Worker-Request, gesteuert vom Browser-Tab des Admins (`components/admin-processing.tsx`, `server/integrations/pipeline-jobs.mjs`). Kein Zeitplan, keine Hintergrundjobs.
- **Größen (gemessen):**

| Bestandteil | Größe |
|---|---|
| Datenbank gesamt | 1,2 GB |
| Vorgänge (`topics`) | 69.588 Zeilen, 448 MB JSON |
| Versionshistorie (`article_versions`) | 75.030 Zeilen, 462 MB JSON (volle Kopien je Änderung) |
| Kartendaten `public/data/de_map.json` | 2,4 MB roh, 1,2 MB gzip, nur 3,5 % davon NRW |
| Server-Paket (Stand 28.09.) | ca. 8 MB gzip, davon 15,7 MB roh eingebettete Startdaten |

## Zielbild

**Eigener Cloudflare-Account im Bezahltarif.** Der Code läuft dort weitgehend unverändert; nötig sind Deploy-Konfiguration mit echter D1-Datenbank, eigene Anmeldung, Importe per Zeitplan (Cron Trigger plus Queue oder Workflows) und das Auslagern der eingebetteten Startdaten. Ein Umzug auf Node mit Postgres wäre deutlich aufwändiger (164 Stellen mit SQLite-JSON-SQL); Node mit SQLite/libSQL wäre ein Mittelweg.

## Phase 1: umgesetzt

| Maßnahme | Ort | Wirkung |
|---|---|---|
| Unveränderte Vorgänge werden beim Re-Import nicht mehr neu geschrieben, wenn sich an den Metadaten nur der Abrufzeitpunkt geändert hat | `server/services/sync.ts`, `server/integrations/apply-backfill.mjs`, `shared/article-record.mjs` (`metadataChanged`) | Schreiblast bei Re-Importen stark reduziert, Datenrevision bleibt ruhig (weniger 409-Fehler beim Blättern während Importen) |
| Schreibvorgänge gebündelt (bis 80 Statements je Batch, Identitätsgruppen bleiben atomar) | `server/integrations/batches.mjs` | weniger Datenbank-Roundtrips |
| Suchkarten-Trigger feuert nur bei suchrelevanten Änderungen | `drizzle/0008_search_cards_trigger.sql` | keine Suchkarten-Neuschreibung bei Metadaten-Updates |
| Budgetende wird als „Zeitbudget“ gemeldet statt als Fehler; vorübergehende Fehler (Timeout, HTTP 429/502/503/504) werden einmal mit Pause wiederholt | `server/integrations/request-budget.mjs` (gilt für SessionNet, SD.NET, ALLRIS, MORE!/RUBIN, OParl) | Abrufe gelten häufiger als fortsetzbar statt gescheitert |
| Höchstens 5 gleichzeitige Netzabrufe im OParl-Modul; Zeitlimit beginnt erst mit dem Slot | `server/integrations/oparl-regional.mjs` | keine Timeouts durch Warten auf Verbindungen |
| Suche: Seitentiefe auf 250 Seiten begrenzt | `server/integrations/monitor-search.mjs` (`MAX_PAGE`), `ResultsPanel.tsx` | keine teuren tiefen OFFSET-Abfragen |
| Kartendaten auf Unterseiten erst im Leerlauf laden | `components/ratsmonitor/state/data.tsx` | schnellerer erster Seitenaufbau von Detail- und Kontoseiten |
| Suchergebnisse als stabiles Objekt; Artikelkarten ohne ungenutzte, sich ständig ändernde Eigenschaften; Abdunkeln erst nach 300 ms | `state/search.tsx`, `ResultsPanel.tsx`, `ArticleCard.tsx` | weniger Neurendern, kein Flackern beim Tippen |
| Mindestabstände 6 px, Seitenbreite ohne Scrollbalken-Fehler, Wischen über der Karte scrollt die Seite | `app/ratsmonitor.css`, Komponenten, `MapPanel.tsx` | Bedienbarkeit auf dem Handy |

Tests: `tests/write-path.test.mjs`, `tests/request-budget.test.mjs`, Ergänzung in `tests/monitor-search.test.mjs`; Gesamtsuite 248 Tests grün.

**Wichtig für die veröffentlichte Datenbank:** Die Migrationen `0006_search_cards`, `0007_ai_usage` und `0008_search_cards_trigger` müssen dort angewendet werden.

## Phase 2: Hosting-Fähigkeit (offen)

1. Anmeldung ersetzen (Cloudflare Access oder OIDC), `getChatGPTUser()` hinter eine Schnittstelle legen.
2. Eigene `wrangler.jsonc` mit echter D1-Datenbank; CI-Deploy, das zuerst `wrangler d1 migrations apply --remote` ausführt.
3. Importe per Cron Trigger plus Queue (eine Nachricht je Gebiet) statt Browser-Schleife.
4. Eingebettete Startdaten (`data/topics.json`, `*-gzip.json`, `billerbeck-content-v1.json`) aus dem Server-Paket nehmen.
5. Zugriffsbegrenzung (WAF/Rate-Limits) für `/api/search`, `/api/analytics*`, `/api/push/subscribe`; Gästelimit serverseitig durchsetzen oder bewusst aufgeben.
6. Automatische Backups, Erreichbarkeitsprüfung, Sicherheits-Kopfzeilen (CSP, HSTS, frame-ancestors).
7. `test`- und `typecheck`-Skripte, CI, Lint-Fehler (154) beheben.
8. Datenschutzerklärung an den tatsächlichen Hoster und den KI-Weg anpassen; Tarif- und E-Mail-Versprechen erst zeigen, wenn Zahlung und Versand existieren.
9. Alte Routen entfernen oder umleiten (`/analysen`, `/ueber`, `/mitteilungen`, `/abgemeldet`, `/quellen` prüfen).

## Phase 3: Umbauten (offen)

| Maßnahme | Erwarteter Effekt |
|---|---|
| Anwesenheitslisten in eigene Sitzungstabelle (heute ca. 20-fach dupliziert, 115 MB) | Payload −45 % |
| Versionshistorie als Diff mit Aufbewahrungsfrist | ca. −400 MB |
| Vorberechnete Kennzahlen für Admin, `/quellen`, Analysen (heute 3–7 s Vollscan je Aufruf) | Sekunden → Millisekunden |
| Suche: `steps`/`src` als Spalten in `search_cards`, Keyset-Pagination, gebündelte bzw. gecachte Facetten, FTS5 | Begriffssuche 3–4× schneller |
| Artikelseiten serverseitig rendern mit Metadaten je Artikel, Sitemap, robots.txt | Sichtbarkeit in Suchmaschinen, Link-Vorschauen |
| Kartengeometrie: NRW detailliert, Rest grob; Parsen im Web Worker; Zeichnen auf den sichtbaren Ausschnitt begrenzen | −85–90 % Kartendaten, flüssigeres Zoomen |
| Suchzustand in mehrere Contexts aufteilen | Tastendruck rendert nur noch das Suchfeld |
| Caching öffentlicher GET-Antworten (Revision als ETag, `s-maxage` + `stale-while-revalidate`); `de_map.json` mit Hash und `immutable` | weniger Datenbanklast, schnellere Wiederbesuche |
