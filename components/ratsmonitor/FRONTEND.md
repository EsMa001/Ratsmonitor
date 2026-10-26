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
| Kontoseiten (Routing) | `pages/PersonalPage.tsx` → `SavedSearchesPage`, `SavedArticlesPage`, `KalenderPage`, `ProfilePage` (Angaben, Geräte, Kalender-Abo, Daten aus diesem Browser, Datenauskunft, Löschen), `PostfachPage` (nur Dev) |
| Konto im Browser: `/api/me` (Stufe, Grenzen, Anmeldung), Abrufe der Kontorouten, Abgleich zwischen Tabs (`ratsmonitor:account-rev:v1`) | `lib/account.ts` (`useMe`, `api`, `logout`, `accountChanged`); Stufe: `lib/tier.ts` (`useTier` mit `ready`), Grenzen: `lib/entitlements.ts`; gespeicherte Suchen `state/account.tsx`, Artikel `lib/savedArticles.ts` (beide über `/api/me/*`, optimistisch mit Rücknahme) |
| Übernahme der Browserdaten (Suchen, Artikel, Kalender, Wochenbericht, Name) ins Konto, als Datei sichern, Datei übernehmen | `lib/browserData.ts`, Dialog `components/ImportDialog.tsx`, Kontoseite `pages/ProfilePage.tsx` |
| Kalender-Abo per Link (Token) | `components/CalendarFeed.tsx`; Gebiete und Umkreis: `lib/calendarAreas.ts` |
| plenara.X (Analysen, Routing und Sperre je Tarif) | `pages/analytics/AnalyticsPages.tsx`, Adressen in `lib/routes.ts`, Übersicht `pages/analytics/AnalyticsAbout.tsx`, Kopf der Ergebnisse (Befund, Link kopieren, Drucken) `pages/analytics/Befund.tsx` |
| plenara.X Atlas (`/analytics/atlas?thema=…&sub=…&stage=…`, Suchbegriff aus geteilten Links per `?q=`) | Rahmen und Themenleiste: `pages/analytics/AtlasPage.tsx`, Ansicht: `pages/analytics/XAtlasView.tsx`, Listen hinter den Zahlen: `pages/analytics/RadarDrill.tsx`; Daten aus `GET /api/x` (Backend `server/integrations/plenara-x-query.mjs`) |
| plenara.X Signale (`/analytics/signale?signal=…&stand=…&zeit=…`): neue Ereignisse je Branche als Liste mit Stand; Konzept `docs/produkt/plenara-x-fakten-konzept.md`. Der Atlas zeigt seit 14.10.26 keine Werte aus den Unterlagen mehr (`SHOW_FACTS` in `XAtlasView.tsx`) | `pages/analytics/SignalePage.tsx`; Daten aus `GET /api/x/signale` (Backend `server/integrations/plenara-x-signals.mjs`) |
| plenara.X Trends, Zeitraffer der Ausbreitung (`XTrendsPage.tsx`): läuft seit 18.10.2026 beim Öffnen eines Begriffs einmal von selbst (außer bei „Bewegung reduzieren“) und hält am Endstand; Knopf „Zeitraffer abspielen“ wiederholt ihn. Karten-Paletten mit `var(--…)` löst `MapEngine` für den Canvas selbst auf (`cssColor` in `lib/geo/mapEngine.ts`) | `pages/analytics/XTrendsPage.tsx`, `XTrendsParts.tsx`, `lib/geo/mapEngine.ts` |
| plenara.X Ausschreibungen (`/analytics/ausschreibungen`, seit 17.10.2026, Gruppe Einblicke): die Kategorie „Ausschreibungen und Vergaben“ als eigene Seite, ohne Kategorienwahl; dieselbe Seitenkomponente wie Signale mit `fest="vergaben"` (`SignalePage fest`), Kopf `XKopf seite="ausschreibungen"`, Erklärtext in `AnalyticsAbout`, Menü in `menu/MainMenu.tsx`. Seit 18.10.2026 ist sie keine Kategorie der Signale mehr (10 Kategorien, Standard Wohnbau); `/analytics/signale?signal=vergaben` leitet auf die neue Seite. Die Vorgänge stehen weiter in ihren Fachkategorien (Backend `SIGNALS` unverändert), die Zahlen beider Seiten werden nicht addiert. Die Karte ist bei Signale und Ausschreibungen eingeklappt (Knopf „Karte zeigen“), die Liste dann in voller Breite | `pages/analytics/SignalePage.tsx`, `AnalyticsPages.tsx`, `XKopf.tsx` |
| plenara.X Menü und Köpfe (seit 16.10.2026) | Menü: Logo als Gruppenname, Abschnitte Analysen (Atlas, Ortsvergleich, Trends, Beschlusslage; Zahlen und Verteilungen), Einblicke (Signale, Ausschreibungen, Aktuelles, Fakten; einzelne Vorgänge und belegte Einzelwerte) und Hintergründe (Fraktionen, Gremien, Themennetz; wer beteiligt ist, was zusammenhängt; drei Gruppen seit 18.10.2026), Abschnittsnamen verlinken auf die Übersicht in `menu/MainMenu.tsx`. Kopf mit Frage und Reitern für alle plenara.X-Seiten: `pages/analytics/XKopf.tsx` (`XKopf`, Querverweise `XWeiter`, Themenkacheln `ThemenLeiste`). Gleiche Bausteine überall: Antwortsatz `Befund` (20 px), Kennzahlen `Kennzahlen`, Umschalter `Segmented`; Linien statt Kästen. Keine Reiter mehr in plenara.X (seit 18.10.2026): Ortsvergleich (`/analytics/vergleich`) und Beschlusslage (`/analytics/beschluesse`) sind eigene Seiten in Analysen. Keine Übersichtsseiten: `/analytics`, `/analytics/ueber`, `/analytics/einblicke` und `/analytics/tools` gibt es nicht (404); Methodik steht unten auf jeder Seite (`Methodik.tsx`, Anker `#methodik`), keine eigene Adresse. Atlas → Ortsvergleich nimmt `?ort=` mit (Ort 1), über die Verweise der Seite. `useAnalysisRun` merkt sich Ergebnisse je Adresse 10 Minuten (Reiterwechsel ohne Neurechnen; `keep:false` schaltet das ab). Konzept `requirements/plenara-x-tools-konzept.md` |
| Neue Auswertung auf Knopfdruck | `pages/analytics/useAnalysisRun.ts` (Ergebnis, Laden, Fehler, „veraltet“), Abfrage aus Suche und Filtern: `pages/analytics/useAnalyticsQuery.ts` |
| Info-Seiten (Routing) | `info/InfoPages.tsx`; Texte/Daten: `info/content.ts`; Bausteine (Seitenkopf, Abschlussband): `info/blocks.tsx` |
| Use Cases | `info/BranchenPages.tsx` (+ Daten in `info/content.ts` → `BRANCHEN`) |
| Preise | `info/PreisePage.tsx`, Tarifkarten: `components/PlanCards.tsx`, Grenzen je Tarif: `lib/tier.ts` (gleich `shared/plans.mjs`), Preise: `PRICES` in `shared/plans.mjs` (`null` = „Preis folgt“), Upgrade-Knöpfe: „In der Testphase auf Anfrage“ (`/kontakt`); „Plus buchen“ und „Abo verwalten“ (Stripe) nur, wenn `/api/me` `billing` meldet: `Billing` in `components/PlanCards.tsx` |
| E-Mails: Vorlagen auf dem Server (`server/accounts/mail-templates.mjs`); Dev-Postfach (Postausgang des Dev-Servers, HTML im `<iframe sandbox>`) | `pages/PostfachPage.tsx` |
| Anmelden (E-Mail, Wartebildschirm mit Code), Bestätigen (`/anmelden/bestaetigen#t=…`), Kontakt; `/registrieren` leitet auf `/anmelden` | `info/AccountPages.tsx` |
| Impressum/Datenschutz | `pages/LegalPage.tsx` |
| Interne To-do-Liste: kategorisierte Liste (Start, offene Aufgaben) und Kanban-Board auf eigenen Klick im Adminbereich (`/admin?seite=todo`, `components/admin-todo.tsx`), mit Status, Zuständigkeit, Pflichtpriorität (Hoch/Mittel/Niedrig), Abschlussgrund (Erledigt/Wird nicht umgesetzt/Duplikat), Startdatum, geplantem Enddatum, abhakenbaren Unteraufgaben und Wartegrund. Bestehende Termine bleiben als geplantes Enddatum (`faellig`) erhalten. Basis `docs/todo/todos.json`; lokal speichert `build/todo-dev-plugin.mjs` (`/__todos`) in die Datei, auf dem Server `/api/admin/todos` in `system_state`; `scripts/pull-todos.mjs` übernimmt den Server-Stand. | `info/TodoPage.tsx`, Daten und Status: `lib/todos.ts`; Stile `app/admin.css` |
| Adminbereich (Rahmen, Menü, Bausteine, Stand, Speicher, Nachholen, Texte, Farben). Menü wie das Hauptmenü der Startseite: Cockpit plus Gruppen Abdeckung, Pipeline, Qualität, Betrieb, Planung (`ADMIN_GROUPS`), je Eintrag Symbol und Leitfrage; neue Seiten dort eintragen, alte Adressen in `app/admin/page.tsx` weiterleiten | `components/admin-chrome.tsx` (AdminFrame, AdminMenu, Gruppen), `components/admin-cockpit.tsx` (Startseite), `components/admin-ui.tsx`, `components/admin-stand.tsx`, `components/admin-store.ts`, `components/admin-catch-up.tsx`, `components/admin-texts.ts`, `components/admin-colors.ts`; Seiten: `components/admin-*.tsx`, `app/admin/page.tsx` |
| Symbole | App: `components/icons.tsx`; Info-Seiten: `info/icons.tsx` |
| Suchzustand + Abfrage an `/api/search` | `state/search.tsx`; Ortserkennung + Regionen: `lib/place.ts`; Logik: `lib/searchLogic.ts` |
| Suche in der Adresse (`/suche?q=…&ort=…&thema=…`, Teilen, Lesezeichen, Zurück/Vor) | Schlüssel und Umwandlung: `lib/searchUrl.ts`; Lesen und Schreiben im `SearchProvider` (`state/search.tsx`), Kennzeichen `history.state.rmSearch`; gespeicherte Suchen per `?suche=<id>`: `pages/OverviewPage.tsx` |
| Neue Route anlegen | Stub in `app/(monitor)/<pfad>/page.tsx` (gibt `null` zurück) + Eintrag in `info/InfoPages.tsx` bzw. `pages/PersonalPage.tsx`; Kontoseiten zusätzlich in `app/(monitor)/konto/[[...section]]/page.tsx` freischalten |

## Stile

- Eigene Stile in `app/styles/`, nach Thema; `app/globals.css` lädt sie in dieser Reihenfolge (bei gleicher Genauigkeit gewinnt die spätere Datei):
  - `tokens.css`: alle Variablen und Farben an einer Stelle, je Selektor ein Block: Handygrenze `max-sm`/`sm`, Tailwind-`@theme`, hell `:root` und `.ratsmonitor`, dunkel `html.rm-dark` und `html.rm-dark .ratsmonitor`.
  - `base-layer.css`: Tailwind-Bausteine (`@layer base/components`).
  - `base.css`: Seite, Schrift, Links, Fokus, Animationen, allgemeine Hilfsklassen.
  - `dark.css`: Dunkelmodus über die Variablen hinaus.
  - `header.css`: Kopfzeile, Logo, Menüs, untere Leiste am Handy.
  - `info.css`: Info-, Konto- und Rechtsseiten (`ri-…`), Startseite, Fußzeile. Achtung: setzt Grundstile zurück; Tailwind-Abstände greifen dort manchmal nicht → dann Inline-Style oder Wrapper.
  - `search.css`: Suche (Karte, Suchleiste, Suchblatt `data-stage`, Trefferliste).
  - `glass.css`: Milchglas `.rm-glass`, Chips, Filterfenster `#filter-body`, Auswahllisten.
  - `analytics.css`: plenara.X (Band, Karte und Liste, Netze, Leisten, `rm-x…`, `rm-solid`). Dort auch die Kopfbänder aller Seiten (`.pl-band`, `.ri-head`): Abstände in einem Block („Abstände der Kopfbänder“), Farben hell/dunkel.
  - `print.css`: Druckansicht.
- Regeln für neue und geänderte Stile:
  - Erst Tailwind im JSX; eigene CSS nur für Wiederkehrendes, Zustände, Pseudoelemente und Handy-Sonderfälle.
  - Neue Regel in die Datei ihres Themas, neben verwandte Regeln (Klasse finden über `components/ratsmonitor/INDEX.md`). Handy-Regeln in einen `@media`-Block mit derselben Abfrage wie `max-sm` (`(max-width:639px),(max-height:500px) and (pointer:coarse) and (max-width:1000px)`, = `PHONE_QUERY` in `lib/usePhone.ts`); gleiche Abfragen direkt hintereinander zu einem Block zusammenfassen.
  - Farben nur als Variable (`var(--rm-…)`, `var(--color-teal-…)`); Hex-Werte und neue Variablen nur in `tokens.css`, immer hell und dunkel. Transparenz als `rgba()` mit den RGB-Werten einer Palettenfarbe.
  - Dunkelmodus: zuerst über die Variablen lösen; nur wenn das nicht reicht, eine Regel `html.rm-dark …` in `dark.css` (bzw. bei plenara.X in `analytics.css`).
  - Kein neues `!important`. Gewinnt eine Regel nicht, den Gegenspieler suchen (Chrome: Elemente → Stile) und die Regel genauer machen (`.pl-band.pl-top` statt `.pl-top`) oder den Gegenspieler ändern. `!important` nur gegen Inline-Stile aus JS, Tailwind-`!`-Klassen, ein anderes `!important` sowie für Druck, reduzierte Bewegung und Autofill; dann mit kurzem Kommentar, wogegen. Ein bestehendes `!important` nur entfernen, wenn es im Gesamtstand nicht mehr gebraucht wird (Fehler 21.10.2026: Band am Handy unter der Kopfzeile, weil der Gegenspieler sein `!important` behielt).
  - Schreibweise: eine Deklaration je Zeile, zwei Leerzeichen Einzug, Selektorliste in einer Zeile, Leerzeile zwischen Regeln, Kommentar über der Regel.
- Sonst Tailwind direkt im JSX. `app/admin.css`: Stile der Administration, geladen von `app/admin/page.tsx`; neue Admin-Stile im bestehenden Design ergänzen. `app/analyse-admin.css` gehört den Analyse-Seiten. `app/globals.css` (nur Einstieg und Theme) nicht ändern. `app/design-styles.css` wirkt auch auf Admin/Analysen: Änderungen dort immer auch dort prüfen.

## Designregeln (vereinbart)

- Schrift IBM Plex Sans; Größen nur 12, 14, 16, 18, 22, 28, 44 px.
- Farbkonzept „Petrol klar“ (seit 17.10.2026, Übersicht `docs/farbschema-petrol-klar-2026-10-17.pdf`): nur vier Farbfamilien plus Weiß/Schwarz. Grau (slate) für Text `#18181b` und Grautext `#52525b`; Petrol (teal) `#268478` = Ton der Deutschlandkarte für Marke, Hauptaktion, Hervorhebung, Balken, Karte, Fußleiste (als Text 4,5:1); Dunkelblau (sky) für beschlossen, Links, Neues; Orange-Braun (amber) für abgelehnt, Fehler, Warnung. Andere Tailwind-Farben (rose, red, emerald, violet …) nicht verwenden. Alle Werte stehen einmal in `app/styles/tokens.css` (Block „Farbkonzept“, hell `:root`, dunkel `html.rm-dark`), dazu die Rollen `--rm-c50`…`--rm-c900`, `--rm-ac`/`--rm-ac2`, `--rm-btn`/`--rm-btn2` (Hauptaktion), `--rm-fill`, `--rm-link`, `--rm-ok`/`--rm-ok2`/`--rm-ok3`/`--rm-no`, `--rm-map1`…`3`, `--rm-tint`/`--rm-tint2`, `--rm-on` (Weiß auf Petrol), `--rm-black`. Statusfarben für Diagramme: `STATUS_COLOR` in `lib/constants.ts`; Zahlenformate: `lib/format.ts`. Im Code keine Hex-Werte und keine Fallbacks `var(--x,#…)`; Ausnahmen nur Kartenmotor und Export (`lib/constants.ts`, `lib/geo/`, `lib/exportArticle.ts`), dort nur Werte aus der Palette.
- Weiß, Linien statt Kästen/Kacheln; keine bunten Abzeichen.
- Hauptaktion: Petrol-Pille mit „→“; Nebenaktion: Petrol-Text mit „→“.
- Symbole ohne Beschriftung (Teilen, Folgen, Speichern, Exportieren).
- Milchglas nur auf der Karte (Suchleiste, Filter, Chips); Menüs weiß.
- Datum mit zweistelligem Jahr („05.10.26“); „Stand“ statt „Datenstand“.
- Deutsch, Anrede „Sie“.

## Prüfen

- Typcheck: `node node_modules/typescript/bin/tsc --noEmit --incremental false`
- Lint: `node node_modules/eslint/bin/eslint.js components/ratsmonitor` muss 0 Fehler zeigen (Warnungen erlaubt). Regeln der React-Hooks: kein setState synchron im Effekt (beim Rendern nachziehen oder Ergebnis je Abfrage ablegen), keine Refs beim Rendern lesen oder setzen. Hilfen: `pages/analytics/useAnalysisRun.ts` (Auswertung auf Knopfdruck), `lib/useClient.ts` (Werte nur im Browser). Ausnahmen nur mit Begründung im Kommentar.
- Tests: `node --test tests/*.test.mjs` (gelegentlich zufällig rot: „marks of read meetings“, „every import leaves a record“)
- Vor dem Veröffentlichen: `node scripts/frontend-check.mjs [basisadresse]` (Chromium und WebKit, 14 Größen, Überlauf, Seitenfehler, HTTP-Status, axe auf Handy und Desktop; Code 1 bei Befunden; Playwright und `@axe-core/playwright` aus `~/code/video-tools`). Firefox startet unter macOS 27 nicht, dort von Hand prüfen.
- Dev-Server: `npm run dev` (Port 5173, setzt `scripts/run-framework.mjs`), fürs Handy im WLAN: `RM_DEV_HOST=0.0.0.0 npm run dev`
- Builds: `node scripts/build-node.mjs` (Server) und `npm run build` (Cloudflare; überschreibt `dist/`)
- Gast/Tarif testen (nur Dev-Server): DEV-Umschalter in der Kopfzeile oder „Dev: als …“ auf `/anmelden` meldet als `basic|pro|enterprise@plenara.test` an (`POST /api/dev/login`), Gast = abmelden; Mails im Dev-Postfach `/konto/postfach`

## Git

- Arbeiten auf `nico_front` (vor jedem Commit `git branch --show-current` prüfen: andere Chats arbeiten im selben Ordner); nach `main` nur auf ausdrückliche Ansage.
- Vor dem Push: `origin/main` einmischen, Typcheck und Tests.
