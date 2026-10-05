# Hinweise für Claude Code

- Frontend-Arbeiten (Oberfläche, Texte, Stile): zuerst `components/ratsmonitor/FRONTEND.md` lesen. Dort stehen Dateikarte, Designregeln und Prüfbefehle.
- Bei reinen Frontend-Aufgaben das Backend nicht ändern: `server/`, `shared/`, `app/api/`, `drizzle/`, `tests/`.

## Token sparen beim Suchen und Ändern

- Nichts ganz lesen, was man nur nachschlagen will. Erst gezielt suchen, dann nur den Bereich lesen (`Read` mit `offset`/`limit`).
- Datei oder CSS-Klasse finden: in `components/ratsmonitor/INDEX.md` suchen, nicht die ganze Datei lesen, z. B. `grep -n "ri-burger" components/ratsmonitor/INDEX.md`. Der Index nennt je Datei die Zeilenzahl und die Exporte, je CSS-Datei die Klassen mit Zeilennummer.
- `⚠N` im Index heißt: N Zeilen über 300 Zeichen. Dort mit `grep -o` oder einem engen Muster suchen, nie die ganze Zeile ausgeben lassen. Betroffen sind vor allem `app/analyse-admin.css` und `components/admin-*.tsx`.
- Nie ganz lesen: `INDEX.md`, `vendor/`, `components/ratsmonitor/info/content.ts` (nur Texte, per `grep` nach dem Satz suchen), `components/ratsmonitor/lib/geo/mapEngine.ts`, `tests/fixtures/`, Lockfiles.
- Tailwind-Klassen im JSX stehen nicht im Index: dafür die Komponente über den Index finden und dort lesen.
- Nach neuen oder entfernten Dateien/Klassen: `node scripts/frontend-index.mjs` ausführen und die geänderte `INDEX.md` mit committen.
