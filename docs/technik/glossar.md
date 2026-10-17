# Glossar: verbindliche Begriffe

Stand: 17. Oktober 2026. Teil der [technischen Dokumentation](README.md).

Dieses Glossar legt für jeden Gegenstand **ein deutsches Wort** fest und nennt daneben den Namen im Code und in der Datenbank. Die
Dokumentation benutzt nur die fett gesetzten Wörter. Wo der Code oder die Oberfläche ein anderes Wort benutzt, steht es in der Spalte
„auch genannt“, damit man es beim Lesen von Code, Admin-Seiten und älteren Konzepten wiedererkennt.

Die Begriffe der Server-Pipeline (Abläufe, Stufen, Schritte, Gründe) stammen aus `shared/pipeline-terms.mjs`; dort werden sie
gepflegt, hier nur erklärt.

## 1. Gegenstände der Daten

Vom Groben zum Feinen: Gebiet → Quelle → Sitzung → Punkt → Bericht → Suchkarte → Vorgang.

| Begriff | Im Code und in der Datenbank | Auch genannt | Bedeutung |
|---|---|---|---|
| **Gebiet** | `region`, `region_id`, `Region` in `shared/regions.ts`, Katalog `CATALOG` in `shared/catalog.mjs` (aus `nrw-regions.json`, `nds-regions.json`, `de-regions.json`) | Ort, Kommune, Gemeinde (Oberfläche) | Eine Gemeinde, Stadt, ein Kreis oder ein Gemeindeverband (Samtgemeinde, Amt, Verbandsgemeinde, Verwaltungsgemeinschaft) aus dem Katalog (5.324 Gebiete). Kennung: `nrw-<Schlüssel>`, `nds-<Schlüssel>`, `de-<Schlüssel>`, dazu sieben benannte Kennungen (`billerbeck`, `muenster`, `borken`, `coesfeld`, `recklinghausen`, `steinfurt`, `warendorf`). Arten `kind`: `city` (Gemeindeebene) oder `district` (Kreis). Der amtliche Schlüssel steht in `ags` (8 Stellen Gemeinde, 5 Kreis, 9 Gemeindeverband). |
| **Mitgliedsgemeinde** | `members` am Gebiet, `where()` in `server/integrations/member-place.mjs`, `shared/vg-groups.mjs` | – | Gemeinde innerhalb eines Gemeindeverbands. Der Verband ist das Gebiet mit der Quelle; die Mitgliedsgemeinde wird aus Gremium („Ortsgemeinderat Limbach“) oder Titel erschlossen. |
| **Quelle** | `source` (`source.id`, `source.url`, `source.reader`), Kataloge `server/integrations/*-sources.json`, `source-catalog.mjs`, `source-overrides.json` | Ratsinformationssystem, RIS, Anbindung | Das Ratsinformationssystem eines Gebiets: Adresse plus die Angabe, welcher **Leser** es liest. Ein Gebiet hat höchstens eine Quelle; Kreise und Städte sind getrennte Gebiete mit eigener Quelle. Die Spalte `topics.source` enthält nicht die Quelle, sondern die Ebene (`city`/`district`). |
| **Leser** | `readers.mjs` (Registry), ein Modul je Produkt (`sessionnet.mjs`, `oparl.mjs`, `allris.mjs` …) | Adapter, Reader | Code, der ein bestimmtes Ratsinformationsprodukt liest und daraus `ImportData` (Berichte und Quellenstand) macht. |
| **Server** (einer Quelle) | `host`, `source_hosts`, `source-servers.mjs`, `body-identity.mjs` | Host | Der Rechner hinter einer oder mehreren Quellen (ein Anbieter betreibt oft viele Gebiete). Trägt die **Serverstufe** des Fehlerspeichers. Nicht zu verwechseln mit dem eigenen **Node-Server**. |
| **Sitzung** | `meeting` in den Lesern; im Bericht `events[].date` und `events[].committee` | Termin | Zusammenkunft eines Gremiums an einem Tag. Es gibt keine eigene Tabelle; Sitzungen leben in den Beratungsfolgen der Berichte und in den Marken des Abrufs (`import-marks:<gebiet>`). Nicht verwechseln mit der **Anmeldesitzung** eines Kontos. |
| **Gremium** | `committee`, `search_cards.gremium` | Ausschuss, Rat | Rat, Ausschuss, Ortsrat, Verbandsversammlung. |
| **Punkt** (Tagesordnungspunkt) | `agendaItem`, Kennungsteil `top`, Art in `payload.itemKind` (`shared/item-kind.mjs`) | TOP | Ein Punkt der Tagesordnung einer Sitzung. Seine **Art des Punkts** ist `subject` (**Sachpunkt**), `formal` (**Formalie**: Eröffnung, Niederschrift, Tagesordnung), `collection` (**Sammelpunkt**: Mitteilungen, Anfragen) oder `routine` (**Routine**: Wahlen, Besetzungen, Einwohnerfragen). Nur ein Sachpunkt bekommt ein Thema. |
| **Vorlage** | `paper`, Kennungsteil `vo`, `reference` (Drucksachennummer), `paperUrl` in `shared/topic-identity.mjs` | Drucksache, Beschlussvorlage, Antrag | Das Schriftstück, über das beraten wird. Eine Vorlage wandert durch mehrere Sitzungen (Beratungsfolge). |
| **Bericht** | `topic`, Tabelle `topics` (`id`, `region_id`, `source`, `event_date`, `updated_at`, `status`, `payload`, generiert `active`), Typ `StoredTopic` in `server/types.ts` | Topic; Artikel/`article` (`article_versions`, `article_analyses`, `saved_articles`, `ArticleCard`, Artikelseite); „Vorgang“ in der Oberfläche der Suche; Adresse `/beschluss/<id>` | **Die Einheit des Bestands.** Eine Vorlage mit ihrer Beratungsfolge, oder, wenn die Quelle keine Vorlagen-Kennung hergibt, ein einzelner Punkt einer Sitzung. Kennung je Leser: bei SessionNet, ALLRIS, More! Rubin, KIC u. a. `<quelle>-vo-<nr>` (Vorlage) oder `<quelle>-top-<sitzung>-<nr>` (Punkt), bei OParl `<quelle>-oparl-<hash>`. Alles, was die Pipeline tut, tut sie je Bericht. |
| **Beratungsfolge** | `events[]` (`TopicEvent`: `date`, `committee`, `status`, `result`, `decision`, `attendance`) | Stationen, Beratungsweg | Die Sitzungen, in denen ein Bericht behandelt wurde oder wird, mit Ergebnis je Station. |
| **Status** | `status` (`TopicStatus` in `shared/types.ts`: `announced`, `consulting`, `recommended`, `approved`, `rejected`, `postponed`, `info`, `unknown`) | Verfahrensstand | Stand des Berichts als Ganzes, abgeleitet aus der jüngsten Station. Texte dazu in `STATUS` (`shared/types.ts`). |
| **Ausgang** | `events[].result`, `events[].decision`, `NO_RESULT` in `analytics-news.mjs` | Ergebnis, Beschluss | Was eine Station ergab (beschlossen, abgelehnt, vertagt, Kenntnis). Platzhalter der Importe („Ergebnis … nicht belegt“) sind kein Ausgang. |
| **Dokument** | `documents[]` (`SourceDocument`: `title`, `url`, `kind`) | PDF, Unterlage | Ein verlinktes Schriftstück am Bericht. **Hauptdokument** = `primaryPdf` (die Vorlage selbst; in der Ablage `pdfs.role` leer); **Anlage** = jedes weitere PDF (`role='other'`, Schritt „Anlagen laden“); **Sitzungsunterlage** = `sessionDocument` (Niederschrift oder Einladung der ganzen Sitzung, an 5 und mehr Berichten; wird nie zusammengefasst). **Dokumentart** = `documentType` aus `shared/document-type.mjs` (`paper`, `decision`, `attachment`, `minutes`, `invitation`, `other`), berichtigt durch den Textanfang (`texts.head_type`). |
| **Textfassung** | `texts` in `index.sqlite`, Datei `files/<ab>/<sha256>.txt`, Seiten getrennt durch `\f` | Textebene, Text | Der aus einem PDF gelesene Text. **Textebene** heißt der Teil, den das PDF selbst enthält; **OCR** liest Seiten ohne Textebene (Scans). |
| **Suchkarte** | `search_cards` (eine Zeile je aktivem Bericht, gepflegt von Triggern auf `topics`), `search`, `search_exact`, `label`, `formal`, `date`, `next_date`, `gremium` | Karte (mehrdeutig, siehe Abschnitt 4), Treffer | Die Projektion eines Berichts für die Suche: Suchtext, Label, Datum „Stand heute“, Gremium, Formalie ja/nein. Suche, Trends, Social Media und plenara.X lesen Suchkarten, nie `topics.payload`. |
| **Vorgang** | `x_cases` (eine Zeile je Vorgang), `report_rules.case_key` = Gebiet + `titleKey(title)` (`shared/topic-facts.mjs`) | Case, Sachvorgang; in der Suchoberfläche heißt auch ein einzelner Bericht „Vorgang“ | **In plenara.X:** alle Berichte eines Gebiets mit demselben normalisierten Titel, also derselbe Antrag im Ausschuss und im Rat, einmal gezählt. **Sachvorgang** = Vorgang, dessen Punkt ein Sachpunkt ist; nur Sachvorgänge zählen in den Auswertungen. |
| **Thema**, **Unterthema** | `theme`, `subs` (`shared/themes.mjs`: `THEMES`, `SUBTOPICS`, `THEMES_VERSION`), `report_rules.theme`/`subs`, `payload.theme` | Sachgebiet | Eines von 10 Themen und bis zu 7 Unterthemen je Thema, aus Titel, Betreff und Beschlussvorschlag eines Sachpunkts. |
| **Label** | `label` (Suchkarte), `classification` (Bericht), Katalog `LABELS` in `shared/labels.mjs` (`labels-v3` = 10 Themen + `unklar` „Sonstiges“), View `topic_effective_labels` | Einordnung, Kategorie | Das Thema, das Suche, Filter und Landkarte zeigen. Rangfolge: **Einordnung von Hand** → **KI-Label** → Thema aus den Regeln → **Titelregel** (`classifyTopic`, `title-rules-v7`). Ältere Labels (`labels-v2`, 16 Werte) werden fest übersetzt. |
| **Was geschieht** | `stage` (`shared/stage.mjs`), `report_rules.stage`, `x_signals.phase` | Stand (bei Signalen), Art des Vorgangs | Was mit einem Vorgang passiert, quer zu den Themen: Bericht, Bauantrag, Vergabe, Planung, Beschluss … Seit 15.10.2026 nicht mehr im Atlas, aber Stand der Signale Solar, Schulen, Mobilität und Eingang des Newsradars. |
| **Fakt** | `topic_facts` (`topic_id`, `kind`, `value`, `detail`, `method`), Regeln in `shared/topic-facts.mjs` (`FACTS_VERSION`) | Wert, Baustein | Ein ausdrücklich genannter Wert oder eine Einordnung aus Titel oder Text eines Berichts: Hebesatz, Gebühr, Fraktion, Verfahrensschritt eines Bebauungsplans … **Werte für die Karte** sind die Fakten über dem Qualitätstor (`shared/map-facts.mjs`). |
| **Signal** | `x_signals` (`case_key`, `signal`, `art`, `phase`), Regeln in `plenara-x-signals.mjs` | Kategorie | Ein Ereignis für eine Branche (Vergabe, Wohnbau, Wind, Solar, Wärme, Schulen, Straßen, Wasser, Breitband, Mobilität, Gewerbe) mit **Art** (Filter) und **Stand**. |
| **Regel-Zusammenfassung** | `payload.ruleSummary` (`RuleSummary`: `short`, `long`, `score`), `server/integrations/rule-summary.mjs` | Zusammenfassung (Regel) | Satzauswahl aus dem Hauptdokument ohne Modell, kurz und lang. |
| **KI-Fassung** | `payload.shortSummary`, `longSummary` mit `generatedBy`, `contentAnalysis`, `labelAssessments.ai`; Kopie in `article_analyses`; Arbeitsposten `ai_work_items` | KI-Zusammenfassung, KI-Label | Kurzfassung (ein Satz), Langfassung und KI-Label, die ein Agent über den internen MCP-Dienst einreicht. Regeln und KI überschreiben einander nie. |
| **Einordnung von Hand** | `labelAssessments.review` | Review | Ein Label, das ein Mensch gesetzt hat; geht allem anderen vor. Gelesen von View und `storedClassification`; einen Schreiber gibt es im Code derzeit nicht (`manual-analysis.mjs` ist trotz des Namens die Titelregel). |
| **Quellenstand** | `source_coverage` (eine Zeile je Gebiet, `payload` vom Typ `Coverage`) | Abdeckung, Coverage | Je Gebiet: Zeitraum von/bis, letzter Abruf, letzter Erfolg, Sitzungen, vollständig ja/nein, Probleme, nächster Versuch. |
| **Stand** (Datenstand) | `data_revisions` (`content`, `search`, `coverage`), `region_revisions`, Parameter `revision` der Suche, `search-words` in `system_state` | Revision, Datenstand | Ein Zähler je Art, der mit jeder Änderung steigt. Zwischenspeicher, Blättern, ETags und das Nachführen der Wortliste vergleichen ihn. In der Oberfläche heißt das Datum des letzten Abrufs ebenfalls „Stand“. |

## 2. Abläufe und Betrieb

| Begriff | Im Code | Bedeutung |
|---|---|---|
| **Ablauf** | `FLOWS` in `shared/pipeline-terms.mjs` | Einer von dreien: **Tagespipeline** (jede Nacht), **Nacharbeit** (tagsüber, automatisch), **Altbestand** (auf Knopfdruck). |
| **Stufe** (eines Ablaufs) | `PHASES`: `abruf`, `extraktion`, `verarbeitung` | Die drei Stufen je Bericht: **Abruf** (Berichte holen), **Extraktion** (PDFs, Text, OCR), **Verarbeitung** (Einordnung, Regeln, Suche, Zahlen, KI). Nicht die Stufe eines Kontos (Abschnitt 3). |
| **Schritt** | `STEPS` (`id`, `name`, `phase`, `aliases`) | Benannter Teil eines Laufs: Sichern, Abruf, PDF laden, Anlagen laden, Text lesen, OCR, OCR-Nachladen, Dokumentart, Grenze halten, Stand zählen, Titel einordnen, Regeln anwenden, Suche aktualisieren, Zahlen rechnen, KI, Wege zählen. Protokolle tragen diese Namen. |
| **Abruf** (Import) | `runSync` in `server/services/sync.ts`, Prozess `import-worker.mjs` | Die Sitzungen und Berichte einer Quelle holen und in `topics` schreiben. „Import“ ist dasselbe Wort im Code. |
| **Abrufauftrag** | `admin-pipeline-job` in `system_state`, `pipeline-jobs.mjs` | Gespeicherter Auftrag: Liste der Gebiete (Posten), Zeitfenster, Fortschritt, Sperren. Angelegt von der Admin-Seite, vom nächtlichen Job oder von Hand; abgearbeitet vom **Importprozess**. |
| **Importprozess** | `dist/standalone/worker/import-worker.mjs` (Quelle `server/node/import-worker.mjs`) | Eigener Node-Prozess neben dem Webserver, der Abrufaufträge in 24 **Bahnen** abarbeitet. |
| **Teilabruf** | `chunk`, `meeting-marks`, `resumable` | Ein Abruf eines Gebiets innerhalb der Zeitgrenze; der nächste Lauf setzt hinter den Marken fort. |
| **PDF-Ablage** | `RM_PDF_STORE`, `server/node/pdf-store.mjs`, `scripts/pdf-store/`, `index.sqlite`, `files/<ab>/<sha256>.pdf` und `.txt` | Speicher der Original-PDFs (jede Datei einmal, nach Prüfsumme) und ihrer Textfassungen, nur auf dem Node-Server. |
| **Grenze** | `BUDGET_GB` und Score in `shared/pdf-rank.mjs`, `keeper` in `store-lib.mjs` | Feste Größe der Ablage (80 GB). Eine neue Datei verdrängt die schlechteste oder bleibt nur als Text (`text-only`). Im Code „Budget“. |
| **Regeln je Bericht** | `readReport` in `server/integrations/report-rules.mjs`, `scripts/pdf-store/read-reports.mjs`, Schlüssel in `report_rules` | Ein Durchlauf je Bericht in fester Reihenfolge: Hauptdokument, Art des Punkts, Thema, Regel-Zusammenfassung, Fakten. Jede Regel liest nur Quellen. |
| **Wortliste** | `search_words`, `search_postings`, `search_word_areas`, `search_word_facets`, `refreshSearchWords` in `search-words.mjs` | Index der Suche: Wörter mit Kartenzahl, Karten-IDs je Wort und vorberechnete Zahlen je Gebiet, Thema und Status. |
| **Zahlen für plenara.X** | `x_cases`, `x_signals`, `scripts/plenara-x/build-x-cases.mjs`, `x-cases.mjs` | Vorberechnete Vorgänge und Signale, Schritt „Zahlen rechnen“. |
| **Tagesbereich** | `inDailyRange`, `dailyBoundary`, `DAILY_SINCE` in `work-failures.mjs` | Sitzungen der letzten 7 Tage (und künftige), frühestens 12.10.2026. Nur ihn bearbeitet die Nacharbeit; alles andere ist **Altbestand**. |
| **Fehlerspeicher** | `work_failures`, `source_hosts`, `recordFailure`, `clearFailure`, `classify` | Jeder Fehlschlag mit **Grund** (`class`), Versuchen und nächstem Termin. Gründe: Quelle bremst (`blocked`), Zugriff verweigert (`denied`), vorübergehend (`transient`), fehlt dauerhaft (`gone`), zu langsam (`slow`), Sperre im Haus (`busy`), Fehler im eigenen Code (`internal`). |
| **Serverstufe** | `source_hosts.state`: `ok` (liefert), `bremsen`, `gesperrt`, `pruefen` | Wartestufe eines Servers; wartende Server lassen alle Abrufer aus. Ein fälliger Server bekommt erst eine **Stichprobe** (`SAMPLE`, 3 Einträge). |
| **Folgekette** | `followUp` in `scripts/nacharbeit.mjs` | Gelingt ein Schritt, laufen für dieselben Berichte gleich die nächsten Stufen (Abruf → PDF laden → Anlagen → Text → OCR → Regeln). |
| **Job** | `JOBS` in `server/integrations/schedules.mjs`, Einheiten `ratsmonitor-<job>.timer`/`.path`/`.service` | Ein zeitgesteuerter Lauf auf dem Server (backup, import-nightly, startseite-trends, pdf-nightly, rule-texts, nacharbeit, ocr, altbestand, import, pdf-job, accounts). |
| **Zeitplaner** | `scripts/schedule.mjs`, Einstellungen `schedules`, Läufe `schedule-runs`, Laufbuch `schedule-log` | Entscheidet alle 10 Minuten, ob ein Job dran ist; führt ihn aus und vermerkt den Lauf. |
| **Auslöser** | systemd `.timer` (alle 10 Minuten) und `.path` (beobachtet `data/trigger/<job>`), `job-trigger.mjs` | Was den Zeitplaner aufruft: der Timer oder ein Knopf in der Administration (schreibt die Auslöser-Datei). |
| **Anhalten** | `schedule-stop`, `trigger/stop-<job>`, `ratsmonitor-stop@.service`, `onStop` in `scripts/pdf-store/state.mjs` | Laufenden Job beenden, ohne auf das Ende des Schritts zu warten. Nie `systemctl stop …timer`. |
| **Auftrag** (der Ablage) | `pdf-store-job` in `system_state` (`{queue, running:{chain,ocr}, recent}`), `JOB_KINDS` in `pdf-store-admin.mjs`: `run`, `retry`, `others`, `texts`, `ocr` | Ein Knopf im Reiter PDF-Import oder auf der Seite Altbestand, den der Job `pdf-job` als Lauf ausführt. |
| **Bahn** | Ablage: `laneOf` → `chain` (Laden) und `ocr`; Abruf: 24 parallele Bahnen des Importprozesses | Zwei Bedeutungen: In der Ablage sind es die zwei Spuren, die nebeneinander laufen dürfen; im Abruf die parallelen Arbeiter eines Auftrags. |
| **Lauf** | `schedule-runs`, `pdf-store-runs`, `import_runs`, Ergebnis `RESULT_TERMS` (fertig, mit Fehler, angehalten, ausgelassen) | Eine Ausführung eines Jobs oder Auftrags mit Beginn, Ende, Ergebnis. |
| **Sperre** | `import-lock.mjs`, `search-words-lease`, `nightly.lock`, `ocr-lane.lock`, `eval.lock`, `admin-builds` | Verhindert, dass zwei Läufe dasselbe schreiben. Jede Sperre hat eine Frist, die ein lebender Lauf verlängert. |
| **Lebenszeichen** | `pdf-store-heartbeat`, Fortschritt `pdf-store-progress-*`, Journal des Importprozesses | Regelmäßig geschriebener Stand, an dem die Administration erkennt, ob ein Dienst läuft. |
| **Programmstand** | `/srv/ratsmonitor/app/releases/<commit>`, `current`, `work_failures.release` | Ein ausgerollter Commit. |
| **Vorberechnung** (Admin) | `region_stats`, `region_series`, `admin_agg`, `admin-stored.mjs`, `refreshRegionFacts` | Werte je Gebiet und globale Auswertungen, die die Admin-Seiten lesen statt zu rechnen. |

## 3. System, Konten, Oberfläche

| Begriff | Im Code | Bedeutung |
|---|---|---|
| **Hauptdatenbank** | `ratsmonitor.sqlite` (`DATABASE_FILE`), im Code `env.DB` mit D1-Schnittstelle, lokal die Datei unter `.wrangler/`, Migrationen `drizzle/`, Buchführung `d1_migrations` | Alle Berichte, Suchkarten, Regeln, Zahlen, Betriebszustände. Eine Datei, SQLite, WAL. |
| **Kontendatei** | `accounts.sqlite` (`ACCOUNTS_FILE`), `env.ACCOUNTS`, Migrationen `drizzle-accounts/`, `accounts_migrations` | Konten, Anmeldungen, gespeicherte Suchen. Getrennt von der Hauptdatenbank, nie in Kopien, Export oder MCP. Im Dev-Server liegen die Tabellen in der lokalen Hauptdatenbank. |
| **Betriebszustand** | Tabelle `system_state` (`key`, `value` als JSON) | Schlüssel-Wert-Speicher für Aufträge, Stände, Zähler, Einstellungen, Ergebnisse. Schlüssel siehe [Datenmodell](datenmodell.md). |
| **Dev-Server** | `npm run dev` → `scripts/run-framework.mjs dev`, Port 5173, Miniflare mit lokaler D1 | Lokale Entwicklung. Startet Nachführen der Wortliste und der Admin-Werte im Hintergrund. |
| **Node-Server** | `dist/standalone/serve.mjs` (Quelle `server/node/serve.mjs`), Port 3000, hinter Caddy | Der Produktionsprozess auf dem VPS: Seiten, API, Administration. Daneben laufen Importprozess, Jobs und X-Worker-Threads. |
| **D1-Adapter** | `server/node/d1-sqlite.mjs`, `server/node/cloudflare-workers.mjs` | Lässt den für Cloudflare D1 geschriebenen Code unverändert auf `node:sqlite` laufen. |
| **Konto** | `users`, `plan_grants`, `user_roles` | Ein Nutzer mit E-Mail-Adresse, Stufe und Rollen. |
| **Anmeldesitzung** | `sessions` (Kontendatei), Cookie, `server/accounts/sessions.mjs` | Angemeldeter Zustand eines Browsers. Im Code `session`; im Text immer „Anmeldesitzung“, damit sie nicht mit der Sitzung eines Gremiums verwechselt wird. |
| **Stufe** (eines Kontos) | `TIERS` in `shared/plans.mjs`: `guest`, `basic`, `pro`, `enterprise`; `LIMITS`, `FEATURES`; `plan_grants`; `sessions.view_tier` | Was ein Konto darf. Ohne `plan_grants`-Zeile gilt Gast. Nicht die Stufe eines Ablaufs (Abschnitt 2). Im Produkt „Tarif“. |
| **Gast** | `guest`, `guest-search.mjs` | Nicht angemeldet oder ohne freigeschaltete Stufe: 10 Treffer, keine Filter. |
| **Admin** | Rolle `admin` in `user_roles`, `adminState()` in `server/services/session.ts`, `ADMIN_HOSTS`, zweiter Faktor `user_totp` | Rolle am Konto; gilt über den Tunnel ohne weiteren Code, sonst mit TOTP. |
| **Zugangssperre** | `RM_ACCESS=invite`, `middleware.ts`, `server/accounts/access.mjs` | Sperrt alles außer Anmeldung, Rechtstexten und `/api/me`. |
| **Ansehen als** | `sessions.view_tier` | Ein Admin sieht die Seite wie eine andere Stufe. |
| **Postausgang** | `mail_outbox`, `server/accounts/mail.mjs`, `MAIL_TRANSPORT` | Alle Mails gehen über diese Tabelle; der Kontojob verschickt sie. |
| **Suche** | `GET /api/search`, `server/integrations/monitor-search.mjs`, Oberfläche `state/search.tsx` | Die Begriffs- und Filtersuche über Suchkarten. |
| **Landkarte** | `components/map/MapPanel.tsx`, `lib/geo/mapEngine.ts`, `badgeCounts`, `areaCounts` | Die Deutschlandkarte mit Trefferzahlen je Gebiet. Nur „Landkarte“, nie „Karte“ allein. |
| **Artikelseite** | `pages/DetailPage.tsx`, Adresse `/beschluss/<id>`, Datenquelle `getTopic` | Die Detailseite eines Berichts mit Beratungsfolge, Dokumenten, Zusammenfassungen. |
| **plenara.X** | `/analytics/*`, `GET /api/x`, `/api/x/signale`, `/api/analytics/*`, `pages/analytics/` | Der Analyse-Teil (Stufe Enterprise): **Atlas**, **Signale**, **Fakten** und die **Tools** (Trends mit Ausbreitung, Themennetz, Ortsvergleich, Beschlüsse, Beratungswege, Fraktionsprofil, Newsradar). |
| **Agent** (KI) | Client des MCP-Dienstes `scripts/mcp-internal.mjs`, Werkzeuge `ai_list`, `ai_claim`, `ai_read`, `ai_renew`, `ai_release`, `ai_submit` | Ein Modell mit Werkzeugzugriff, das Berichte liest und KI-Fassungen einreicht. Startet nie von selbst. |
| **Arbeitsposten** | `ai_work_items` | Ein Bericht in der Liste des Agenten mit Zustand (bereit, reserviert, erledigt, veraltet). |
| **Kundendienst (MCP)** | `scripts/mcp-customer.mjs`, `mcp-customer-data.mjs` | Reine Recherche über gespeicherte Daten für Kunden; keine interne Verbindung. |
| **Admin-Seite** | `/admin?seite=<name>`, `app/admin/page.tsx`, `components/admin-*.tsx` | Ein Reiter der Administration. |

## 4. Mehrdeutige Wörter und wie wir sie verwenden

| Wort | Bedeutungen | Regel in dieser Dokumentation |
|---|---|---|
| Karte | Suchkarte (`search_cards`) und Landkarte (`MapPanel`) | **Suchkarte** für die Tabelle, **Landkarte** für die Karte. „Karte“ allein nur in Zitaten aus Code und Admin. |
| Vorgang | In der Suche ein einzelner Bericht („Vorgänge gefunden“, `/beschluss/<id>`); in plenara.X die Zusammenfassung gleicher Titel je Gebiet (`x_cases`) | **Bericht** für die Zeile in `topics`, **Vorgang** nur für `x_cases`. Die Oberfläche der Suche bleibt bei „Vorgang“ (für den Leser ist es derselbe Antrag). |
| Artikel | Älterer Name für Bericht in Code und Tabellen (`article_versions`, `article_analyses`, `saved_articles`, `ArticleCard`, `exportArticle`) | **Bericht**; Tabellennamen bleiben, wie sie sind. |
| Stufe | Stufe eines Ablaufs (Abruf, Extraktion, Verarbeitung), Stufe eines Kontos (Gast bis Enterprise), Stufe eines Servers (liefert bis prüfen), Wartestufe (`level`) | Immer mit Zusatz: **Stufe des Ablaufs**, **Stufe des Kontos** (oder Tarif), **Serverstufe**, **Wartestufe**. |
| Sitzung | Sitzung eines Gremiums; Anmeldesitzung eines Kontos (`sessions`) | **Sitzung** nur für Gremien, **Anmeldesitzung** für Konten. |
| Bahn | 24 Bahnen des Abrufs; Bahnen Laden und OCR der Ablage | Mit Zusatz: **Bahn des Abrufs**, **Bahn der Ablage**. |
| Label, Thema | Label = angezeigtes Thema nach Rangfolge; Thema = Ergebnis der Themenregel (`payload.theme`) | **Thema** für die Regel, **Label** für das Angezeigte. Seit `labels-v3` ist der Katalog derselbe (10 Themen plus Sonstiges). |
| Stand | Datenstand (`data_revisions`); Stand der Signale (`phase`); Datum des letzten Abrufs in der Oberfläche; „Stand zählen“ (Ablage) | **Datenstand** für die Zähler, sonst mit Zusatz. |
| Import, Abruf | Dasselbe: Code sagt `import`, Pipeline-Begriffe sagen „Abruf“ | **Abruf** im Text, `import` im Code. |
| Job, Auftrag, Lauf | Job = zeitgesteuerte Einheit; Auftrag = gespeicherter Wunsch (Abrufauftrag, Auftrag der Ablage, Bauauftrag der Admin-Vorberechnung); Lauf = eine Ausführung | So wie links. |
| Server | Rechner einer Quelle (`source_hosts`); eigener Node-Server; VPS | **Server** einer Quelle nur mit Zusatz oder im Kontext des Fehlerspeichers; sonst **Node-Server** oder **VPS**. |
| Analyse | `article_analyses` (KI-, Regel- und Hand-Ergebnisse je Bericht); plenara.X-Auswertungen; Admin-Reiter „Analyse“ | **Auswertung** für plenara.X, **Analyse** nur für die Tabelle und ihre Varianten. |

## 5. Kennungen

| Kennung | Form | Beispiel | Wo |
|---|---|---|---|
| Gebiet | `nrw-`, `nds-`, `de-` plus amtlicher Schlüssel, oder benannte Kennung | `de-09162000`, `nds-03241001`, `billerbeck` | `region_id` überall |
| Bericht | je Leser; `<quelle>-vo-<nr>`, `<quelle>-top-<sitzung>-<nr>`, `<quelle>-oparl-<hash>`, Münster `papers-…` | `billerbeck-vo-12345` | `topics.id`, `search_cards.id`, `report_rules.topic_id`, `topic_facts.topic_id`, `ai_work_items.topic_id` |
| Vorgang | Gebiet + `\|` + normalisierter Titel (`titleKey`: klein, alles außer Buchstaben und Ziffern wird Leerzeichen); ungelesene Berichte Gebiet + `\|` + `lower(title)` | `billerbeck\|bebauungsplan nr 12` | `report_rules.case_key`, `x_cases.case_key`, `x_signals.case_key` |
| PDF | SHA-256 des Inhalts | `3f9a…` | `pdfs.sha256`, `texts.sha256`, Dateiname in `files/<ab>/` |
| Fehlerspeicher | Schritt + Gegenstand | `pdf` + Adresse, `import` + Gebiet, `rules` + Bericht, `ocr` + Prüfsumme | `work_failures (step, key)` |
| Wortliste | Wort (Kleinbuchstaben, Umlaute gefaltet, ab 3 Zeichen) | `waermeplanung` | `search_words.word` |
| Konto | `u_` + Zufall | `u_66FW…` | `users.id` |
| Datenstand | Art + Zahl | `search` 4711 | `data_revisions` |
