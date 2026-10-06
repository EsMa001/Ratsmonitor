# Hinweise für Claude Code

- Frontend-Arbeiten (Oberfläche, Texte, Stile): zuerst `components/ratsmonitor/FRONTEND.md` lesen. Dort stehen Dateikarte, Designregeln und Prüfbefehle.
- Bei reinen Frontend-Aufgaben das Backend nicht ändern: `server/`, `shared/`, `app/api/`, `drizzle/`, `tests/`.

## Token sparen beim Suchen und Ändern

- Nichts ganz lesen, was man nur nachschlagen will. Erst gezielt suchen, dann nur den Bereich lesen (`Read` mit `offset`/`limit`).
- Datei oder CSS-Klasse finden: in `components/ratsmonitor/INDEX.md` suchen, nicht die ganze Datei lesen, z. B. `grep "^ri-burger " components/ratsmonitor/INDEX.md` (eine Zeile pro Klasse und Datei: `klasse datei:zeile`) oder `grep "Brand" components/ratsmonitor/INDEX.md` für Komponenten (Datei, Zeilenzahl, Exporte).
- `⚠N` im Index heißt: N Zeilen über 300 Zeichen. Dort mit `grep -o` oder einem engen Muster suchen, nie die ganze Zeile ausgeben lassen. Betroffen sind vor allem `app/analyse-admin.css` und `components/admin-*.tsx`.
- Nie ganz lesen: `INDEX.md`, `vendor/`, `components/ratsmonitor/info/content.ts` (nur Texte, per `grep` nach dem Satz suchen), `components/ratsmonitor/lib/geo/mapEngine.ts`, `tests/fixtures/`, Lockfiles.
- Tailwind-Klassen im JSX stehen nicht im Index: dafür die Komponente über den Index finden und dort lesen.
- Nach neuen oder entfernten Dateien/Klassen: `node scripts/frontend-index.mjs` ausführen und die geänderte `INDEX.md` mit committen.

## Suche: Wortliste (Backend, `server/integrations/search-words.mjs`)

- **Was:** Tabellen `search_words` (jedes Wort aus `search_cards.search` ab 3 Zeichen, mit Kartenzahl), `search_postings` (Karten-IDs je Wort bis 500 Karten), `search_word_areas` und `search_word_facets` (vorberechnete Zahlen je Gebiet, Thema, Status für häufige Wörter), Stand in `system_state` `search-words`. Schema: `drizzle/0013_search_words.sql`. Die Daten selbst liegen nicht im Repo.
- **Wozu:** `monitor-search.mjs` nutzt sie vor dem Durchsuchen aller Karten: „keine Treffer“ sofort, Treffer und Zähler seltener Wörter über die Karten-IDs, Zähler und Karte häufiger Wörter (ohne Filter, ein Begriff) aus den vorberechneten Zahlen, erste Seite als Strom (`part=stream`). Ergebnis ist immer dasselbe wie die Suche über alle Karten (Test: `tests/monitor-search.test.mjs`, `tests/search-words.test.mjs`).
- **Lokal:** Der Start des Dev-Servers (`scripts/run-framework.mjs dev`) baut sie im Hintergrund bzw. führt sie nach (erstes Mal etwa 30 s, bis dahin sucht die App wie gewohnt). Von Hand: `node scripts/refresh-search-words.mjs --full`. Abschalten: `RM_SKIP_SEARCH_WORDS=1`.
- **Produktion:** Migration `0013` einspielen und die Liste **einmal** voll aufbauen (`refreshSearchWords(db,{full:true,kinds})`; für einen Worker-Aufruf zu lang, deshalb in Stücken oder außerhalb). Danach führt `runSync` (`server/services/sync.ts`) sie nach jedem Metadaten-Import nach (nur Neues, nie der erste Aufbau). Ohne Liste sucht die App wie früher, nur langsamer, es gibt keinen Fehler.
- **Wann die Suche auf den alten Weg zurückfällt:** Stand der Liste passt nicht zum Datenstand, Begriff mit Sonderzeichen oder unter 3 Zeichen, Filter gesetzt (bei den vorberechneten Zahlen); Begriff in einem Gebietsnamen wird bei den vorberechneten Zahlen nur nachgezählt (Karten des Gebiets ohne den Begriff im Text, `nameOnly`), mehrere Wörter oder „oder“ (bei den vorberechneten Zahlen).
- **Nach Änderungen** am Suchtext (Trigger in `drizzle/0006`, `0008`, `0009`), an `wordsOf` oder an den Gebietsarten die Liste mit `--full` neu aufbauen; geänderte oder gelöschte Einträge machen die vorberechneten Zahlen bis zum nächsten vollen Aufbau ungültig.
- **Karte:** Die Abzeichen (`badgeCounts`) zählen jeden Eintrag genau einmal (Summe = Trefferzahl); die Einfärbung nutzt `areaCounts`, wo ein Samtgemeinde-Bericht bei jeder Mitgliedsgemeinde steht.
