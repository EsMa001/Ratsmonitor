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
| Export-Fenster | `components/ExportMenu.tsx`; Treffer: `lib/exportResults.ts`; Artikel (PDF/Drucken/Excel/CSV): `lib/exportArticle.ts`; Excel/CSV-Erzeugung: `lib/xlsx.ts` |
| Kontoseiten (Routing) | `pages/PersonalPage.tsx` → `SavedSearchesPage`, `SavedArticlesPage`, `KalenderPage`, `ProfilePage`, `PostfachPage` |
| Lena (regelbasierte Assistentin, eigener Reiter `/lena`; Konzept `docs/produkt/lena-konzept.md`) | Regeln und Texte: `lib/lena.ts` (rein, testbar: `tests/lena.test.mjs`), Dialog: `info/LenaPage.tsx`, Reiter: `menu/MainMenu.tsx` |
| Info-Seiten (Routing) | `info/InfoPages.tsx`; Texte/Daten: `info/content.ts`; Bausteine (Seitenkopf, Abschlussband): `info/blocks.tsx` |
| Use Cases | `info/BranchenPages.tsx` (+ Daten in `info/content.ts` → `BRANCHEN`) |
| Preise | `info/PreisePage.tsx`, Tarifkarten: `components/PlanCards.tsx`, Grenzen je Tarif: `lib/tier.ts` |
| E-Mails (Vorlagen: Willkommen, Passwort, Wochenbericht, Treffer, Vorgang, Sitzung) | `lib/mails.ts`; Test-Postfach: `pages/PostfachPage.tsx` |
| Anmelden/Registrieren/Kontakt | `info/AccountPages.tsx`; Testkonten: `lib/testAuth.ts` |
| Impressum/Datenschutz | `pages/LegalPage.tsx` |
| Interne To-do-Liste: erster Reiter im Adminbereich (`/admin?seite=todo`, `components/admin-todo.tsx`; nur lokaler Dev-Server; Daten `docs/todo/todos.json`, Speichern über Vite-Plugin `build/todo-dev-plugin.mjs`, Endpunkt `/__todos`) | `info/TodoPage.tsx`, Status/Datum: `lib/todos.ts` |
| Adminbereich (Rahmen, Bausteine, Stand, Speicher, Nachholen, Texte, Farben) | `components/admin-chrome.tsx` (AdminFrame, Reiter), `components/admin-ui.tsx`, `components/admin-stand.tsx`, `components/admin-store.ts`, `components/admin-catch-up.tsx`, `components/admin-texts.ts`, `components/admin-colors.ts`; Seiten: `components/admin-*.tsx`, `app/admin/page.tsx` |
| Symbole | App: `components/icons.tsx`; Info-Seiten: `info/icons.tsx` |
| Suchzustand + Abfrage an `/api/search` | `state/search.tsx`; Ortserkennung + Regionen: `lib/place.ts`; Logik: `lib/searchLogic.ts` |
| Neue Route anlegen | Stub in `app/(monitor)/<pfad>/page.tsx` (gibt `null` zurück) + Eintrag in `info/InfoPages.tsx` bzw. `pages/PersonalPage.tsx`; Kontoseiten zusätzlich in `app/(monitor)/konto/[[...section]]/page.tsx` freischalten |

## Stile

- `app/ratsmonitor.css`: App (Startseite, Karte, Milchglas `.rm-glass`, Filterfenster `#filter-body`).
- `app/ratsmonitor-info.css`: Info- und Kontoseiten (Klassen `ri-…`). Achtung: Die Datei setzt Grundstile zurück; Tailwind-Klassen greifen dort manchmal nicht → dann Inline-Style.
- Sonst Tailwind direkt im JSX. `app/analyse-admin.css`: Der Admin-Teil steht im Startseiten-Design am Dateiende (Block „Adminbereich im Design der Startseite“); ältere Admin-Regeln nicht erweitern, neue Admin-Stile dort anhängen. Die übrigen Regeln der Datei gehören den Analyse-Seiten. `app/globals.css` (nur Einstieg und Theme) nicht ändern. `app/design-styles.css` wirkt auch auf Admin/Analysen: Änderungen dort immer auch dort prüfen.

## Designregeln (vereinbart)

- Schrift IBM Plex Sans; Größen nur 12, 14, 16, 18, 22, 28, 44 px.
- Textfarben: Schwarz `#0f172a` (slate-900), Grau `#64748b` (slate-500), Petrol `#0d9488` (teal-600).
- Weiß, Linien statt Kästen/Kacheln; keine bunten Abzeichen.
- Hauptaktion: schwarze Pille mit „→“; Nebenaktion: Petrol-Text mit „→“.
- Symbole ohne Beschriftung (Teilen, Folgen, Speichern, Exportieren).
- Milchglas nur auf der Karte (Suchleiste, Filter, Chips); Menüs weiß.
- Datum mit zweistelligem Jahr („05.10.26“); „Stand“ statt „Datenstand“.
- Deutsch, Anrede „Sie“.

## Prüfen

- Typcheck: `~/.local/bin/node node_modules/typescript/bin/tsc --noEmit --incremental false`
- Tests: `~/.local/bin/node --test tests/*.test.mjs` (gelegentlich zufällig rot: „marks of read meetings“, „every import leaves a record“)
- Dev-Server: `corepack pnpm dev` (Port 5173), fürs Handy im WLAN: `corepack pnpm dev --hostname 0.0.0.0`
- Handy-Vorschau lokal: `public/handy.html` (nicht im Git)
- Gast/Tarif testen: Testkonten `basic|pro|enterprise@plenara.test`, Passwort `test1234`

## Git

- Arbeiten auf `nico-aenderungen`; nur auf ausdrückliche Ansage pushen.
- Vor dem Push: `origin/main` einmischen, Typcheck und Tests.
