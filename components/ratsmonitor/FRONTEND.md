# Frontend-Karte (Plenara)

Kurzübersicht, damit Änderungen ohne langes Suchen gehen. Alles unter `components/ratsmonitor/`.
**Backend nicht anfassen** (`server/`, `shared/`, `app/api/`, `drizzle/`, `tests/`), außer es ist ausdrücklich gewünscht.

## Wo ist was?

Genauer (alle Dateien mit Exporten, alle CSS-Klassen mit Zeile): `INDEX.md` – nur per `grep` benutzen, nicht ganz lesen. Neu erzeugen: `node scripts/frontend-index.mjs`.

| Bereich | Datei |
|---|---|
| Kopfzeile, Logo, Kontomenü | `components/Header.tsx`, `components/Brand.tsx`, `components/AccountMenu.tsx` |
| Hauptmenü (☰ unter 1280 px, darüber Punkte in der Kopfzeile `.ri-topnav`) | `menu/MainMenu.tsx` |
| Fußzeile + Abschlussband | `components/Footer.tsx` |
| Startseite (Aufbau) | `pages/OverviewPage.tsx` |
| Karte + Kartenmodus (startet, sobald Suche/Filter bestätigt; Darstellung Flächen/Heatmap/Punkte, Zoom, Zentrieren, Neu laden, Trefferzahlen) | `components/map/MapPanel.tsx`, Zeichnen/Abzeichen: `lib/geo/mapEngine.ts` |
| Suchleiste auf der Karte (Herz, Feld, Filter-Knopf) | `components/SearchOverlay.tsx`, Feld + Vorschläge: `components/SearchBox.tsx` |
| Chips unter der Suchleiste | `components/ActiveFilters.tsx` |
| Filterfenster (Umkreis, Zeitraum, Thema, Status, Schalter) | `components/FilterPanel.tsx`, Umkreis: `components/AreaBar.tsx`, Zeitraum: `components/DateRangeFilter.tsx` |
| Eigene Auswahlliste (statt `<select>`) | `components/FilterSelect.tsx` |
| Rückfrage-Fenster (statt `confirm`): `confirmDialog({title,text,confirmLabel})` | `components/ConfirmDialog.tsx` |
| Zuletzt gesucht (Verlauf im Browser) | `lib/recentSearches.ts`, angezeigt in `components/SearchBox.tsx` |
| Marke: Standard ist Plenara, Logo „Plenara v2 ■“ (`lib/brands.ts` → `DEFAULT_LOGO`); alle Logo-Varianten in `components/Brand.tsx`, Wechsel-Logik `lib/brand.ts` (`setLogo`), Umschalter `components/DevBrandSwitcher.tsx` ist nicht eingebunden (in `App.tsx` wieder rendern, um ihn zu nutzen) |
| Tab-Titel und Tab-Symbol je Marke | `App.tsx` (`useBrandTitle`), `lib/favicon.ts` |
| 404-Seite | `info/NotFoundPage.tsx`, erkannt über `isKnownPath` in `App.tsx` |
| Zeile über Trefferliste (Anzahl, Sortierung, Export, Ansicht) | `components/SearchFilterPanel.tsx` |
| Trefferliste / Artikelzeile | `components/results/ResultsPanel.tsx`, `components/results/ArticleCard.tsx` |
| Artikel-Detail | `pages/DetailPage.tsx` |
| KI-Inhalte: offene IDs, Quellenabdeckung, Filter und Kopieren in Admin-Schritt 03; keine Export-/Importdateien. Artikelseite mit getrennten KI-/Originalauszug-Ansichten und belegten Zitaten. | `components/admin-ai-local.tsx`, `components/admin-processing.tsx`, `pages/DetailPage.tsx`; Vertrag: `requirements/ai-processing.md` |
| Export-Fenster | `components/ExportMenu.tsx`; Treffer: `lib/exportResults.ts`; Artikel (Drucken/Excel/CSV): `lib/exportArticle.ts`; Excel/CSV-Erzeugung: `lib/xlsx.ts` |
| Kontoseiten (Routing) | `pages/PersonalPage.tsx` → `SavedSearchesPage`, `SavedArticlesPage`, `KalenderPage`, `ProfilePage` (Angaben, Geräte, Kalender-Abo, Daten aus diesem Browser, Datenauskunft, Löschen), `PostfachPage` (nur Dev) |
| Konto im Browser: `/api/me` (Stufe, Grenzen, Anmeldung), Abrufe der Kontorouten, Abgleich zwischen Tabs (`ratsmonitor:account-rev:v1`) | `lib/account.ts` (`useMe`, `api`, `logout`, `accountChanged`); Stufe: `lib/tier.ts` (`useTier` mit `ready`), Grenzen: `lib/entitlements.ts`; gespeicherte Suchen `state/account.tsx`, Artikel `lib/savedArticles.ts` (beide über `/api/me/*`, optimistisch mit Rücknahme) |
| Übernahme der Browserdaten (Suchen, Artikel, Kalender, Wochenbericht, Name) ins Konto, als Datei sichern, Datei übernehmen | `lib/browserData.ts`, Dialog `components/ImportDialog.tsx`, Kontoseite `pages/ProfilePage.tsx` |
| Kalender-Abo per Link (Token) | `components/CalendarFeed.tsx`; Gebiete und Umkreis: `lib/calendarAreas.ts` |
| plenara.X (Analysen, Routing und Sperre je Tarif) | `pages/analytics/AnalyticsPages.tsx`, Adressen in `lib/routes.ts`, Übersicht `pages/analytics/AnalyticsAbout.tsx`, Kopf der Ergebnisse (Befund, Link kopieren, Drucken) `pages/analytics/Befund.tsx` |
| plenara.X Atlas (`/analytics/atlas?thema=…&sub=…&stage=…`, Suchbegriff aus geteilten Links per `?q=`) | Rahmen und Themenleiste: `pages/analytics/AtlasPage.tsx`, Ansicht: `pages/analytics/XAtlasView.tsx`, Listen hinter den Zahlen: `pages/analytics/RadarDrill.tsx`; Daten aus `GET /api/x` (Backend `server/integrations/plenara-x-query.mjs`) |
| plenara.X Signale (`/analytics/signale?signal=…&stand=…&zeit=…`): neue Ereignisse je Branche als Liste mit Stand; Konzept `docs/produkt/plenara-x-fakten-konzept.md`. Der Atlas zeigt seit 14.10.26 keine Werte aus den Unterlagen mehr (`SHOW_FACTS` in `XAtlasView.tsx`) | `pages/analytics/SignalePage.tsx`; Daten aus `GET /api/x/signale` (Backend `server/integrations/plenara-x-signals.mjs`) |
| plenara.X Menü und Köpfe (seit 16.10.2026) | Menü: Logo als Gruppenname, Abschnitte Analysen (Atlas, Signale, Trends, Fakten) und Einblicke (Fraktionen, Gremien, Themennetz, News) in `menu/MainMenu.tsx`. Kopf mit Frage und Reitern: `pages/analytics/XKopf.tsx` (`XKopf`, Querverweise `XWeiter`). Reiter = eigene Adresse: Atlas *Überblick* / *Vergleich* (`/analytics/vergleich`), Trends *Verlauf* / *Ausgang* (`/analytics/beschluesse`). Übersicht Einblicke `/analytics/einblicke` (`EINBLICKE` in `info/branchen-enterprise.ts`); `/analytics/tools` leitet dorthin. Konzept `requirements/plenara-x-tools-konzept.md` |
| Neue Auswertung auf Knopfdruck | `pages/analytics/useAnalysisRun.ts` (Ergebnis, Laden, Fehler, „veraltet“), Abfrage aus Suche und Filtern: `pages/analytics/useAnalyticsQuery.ts` |
| Info-Seiten (Routing) | `info/InfoPages.tsx`; Texte/Daten: `info/content.ts`; Bausteine (Seitenkopf, Abschlussband): `info/blocks.tsx` |
| Use Cases | `info/BranchenPages.tsx` (+ Daten in `info/content.ts` → `BRANCHEN`) |
| Preise | `info/PreisePage.tsx`, Tarifkarten: `components/PlanCards.tsx`, Grenzen je Tarif: `lib/tier.ts` (gleich `shared/plans.mjs`), Preise: `PRICES` in `shared/plans.mjs` (`null` = „Preis folgt“), Upgrade-Knöpfe: „In der Testphase auf Anfrage“ (`/kontakt`) |
| E-Mails: Vorlagen auf dem Server (`server/accounts/mail-templates.mjs`); Dev-Postfach (Postausgang des Dev-Servers, HTML im `<iframe sandbox>`) | `pages/PostfachPage.tsx` |
| Anmelden (E-Mail, Wartebildschirm mit Code), Bestätigen (`/anmelden/bestaetigen#t=…`), Kontakt; `/registrieren` leitet auf `/anmelden` | `info/AccountPages.tsx` |
| Impressum/Datenschutz | `pages/LegalPage.tsx` |
| Interne To-do-Liste: Board und kategorisierter Backlog im Adminbereich (`/admin?seite=todo`, `components/admin-todo.tsx`), mit Status, Zuständigkeit, Pflichtpriorität (Hoch/Mittel/Niedrig), Abschlussgrund (Erledigt/Wird nicht umgesetzt/Duplikat), Startdatum, geplantem Enddatum, abhakenbaren Unteraufgaben und Wartegrund. Bestehende Termine bleiben als geplantes Enddatum (`faellig`) erhalten. Basis `docs/todo/todos.json`; lokal speichert `build/todo-dev-plugin.mjs` (`/__todos`) in die Datei, auf dem Server `/api/admin/todos` in `system_state`; `scripts/pull-todos.mjs` übernimmt den Server-Stand. | `info/TodoPage.tsx`, Daten und Status: `lib/todos.ts`; Stile `app/admin.css` |
| Adminbereich (Rahmen, Bausteine, Stand, Speicher, Nachholen, Texte, Farben) | `components/admin-chrome.tsx` (AdminFrame, Reiter), `components/admin-ui.tsx`, `components/admin-stand.tsx`, `components/admin-store.ts`, `components/admin-catch-up.tsx`, `components/admin-texts.ts`, `components/admin-colors.ts`; Seiten: `components/admin-*.tsx`, `app/admin/page.tsx` |
| Symbole | App: `components/icons.tsx`; Info-Seiten: `info/icons.tsx` |
| Suchzustand + Abfrage an `/api/search` | `state/search.tsx`; Ortserkennung + Regionen: `lib/place.ts`; Logik: `lib/searchLogic.ts` |
| Suche in der Adresse (`/suche?q=…&ort=…&thema=…`, Teilen, Lesezeichen, Zurück/Vor) | Schlüssel und Umwandlung: `lib/searchUrl.ts`; Lesen und Schreiben im `SearchProvider` (`state/search.tsx`), Kennzeichen `history.state.rmSearch`; gespeicherte Suchen per `?suche=<id>`: `pages/OverviewPage.tsx` |
| Neue Route anlegen | Stub in `app/(monitor)/<pfad>/page.tsx` (gibt `null` zurück) + Eintrag in `info/InfoPages.tsx` bzw. `pages/PersonalPage.tsx`; Kontoseiten zusätzlich in `app/(monitor)/konto/[[...section]]/page.tsx` freischalten |

## Stile

- `app/ratsmonitor.css`: App (Startseite, Karte, Milchglas `.rm-glass`, Filterfenster `#filter-body`).
- `app/ratsmonitor-info.css`: Info- und Kontoseiten (Klassen `ri-…`). Achtung: Die Datei setzt Grundstile zurück; Tailwind-Klassen greifen dort manchmal nicht → dann Inline-Style.
- Sonst Tailwind direkt im JSX. `app/admin.css`: Stile der Administration, geladen von `app/admin/page.tsx`; neue Admin-Stile im bestehenden Design ergänzen. `app/analyse-admin.css` gehört den Analyse-Seiten. `app/globals.css` (nur Einstieg und Theme) nicht ändern. `app/design-styles.css` wirkt auch auf Admin/Analysen: Änderungen dort immer auch dort prüfen.

## Designregeln (vereinbart)

- Schrift IBM Plex Sans; Größen nur 12, 14, 16, 18, 22, 28, 44 px.
- Textfarben: Schwarz `#0f172a` (slate-900), Grau `#64748b` (slate-500), Petrol `#0f766e` (teal-700). Helles Petrol `#0d9488` (teal-600) nur für Flächen, Symbole und Schrift ab 24 px: als Textfarbe zu wenig Kontrast (3,7:1 statt mindestens 4,5:1, WCAG).
- Weiß, Linien statt Kästen/Kacheln; keine bunten Abzeichen.
- Hauptaktion: schwarze Pille mit „→“; Nebenaktion: Petrol-Text mit „→“.
- Symbole ohne Beschriftung (Teilen, Folgen, Speichern, Exportieren).
- Milchglas nur auf der Karte (Suchleiste, Filter, Chips); Menüs weiß.
- Datum mit zweistelligem Jahr („05.10.26“); „Stand“ statt „Datenstand“.
- Deutsch, Anrede „Sie“.

## Prüfen

- Typcheck: `node node_modules/typescript/bin/tsc --noEmit --incremental false`
- Lint: `node node_modules/eslint/bin/eslint.js components/ratsmonitor` muss 0 Fehler zeigen (Warnungen erlaubt). Regeln der React-Hooks: kein setState synchron im Effekt (beim Rendern nachziehen oder Ergebnis je Abfrage ablegen), keine Refs beim Rendern lesen oder setzen. Hilfen: `pages/analytics/useAnalysisRun.ts` (Auswertung auf Knopfdruck), `lib/useClient.ts` (Werte nur im Browser). Ausnahmen nur mit Begründung im Kommentar.
- Tests: `node --test tests/*.test.mjs` (gelegentlich zufällig rot: „marks of read meetings“, „every import leaves a record“)
- Dev-Server: `npm run dev` (Port 5173, setzt `scripts/run-framework.mjs`), fürs Handy im WLAN: `RM_DEV_HOST=0.0.0.0 npm run dev`
- Builds: `node scripts/build-node.mjs` (Server) und `npm run build` (Cloudflare; überschreibt `dist/`)
- Gast/Tarif testen (nur Dev-Server): DEV-Umschalter in der Kopfzeile oder „Dev: als …“ auf `/anmelden` meldet als `basic|pro|enterprise@plenara.test` an (`POST /api/dev/login`), Gast = abmelden; Mails im Dev-Postfach `/konto/postfach`

## Git

- Arbeiten auf `nico_front` (vor jedem Commit `git branch --show-current` prüfen: andere Chats arbeiten im selben Ordner); nach `main` nur auf ausdrückliche Ansage.
- Vor dem Push: `origin/main` einmischen, Typcheck und Tests.
