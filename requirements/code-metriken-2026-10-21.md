# Code-Metriken und statische Analyse (21.10.2026, main `ac572476`)

Gemessen auf dem Stand nach dem Backend-Cleanup. Gezählt sind nur Dateien in Git, ohne `vendor/`, Testdaten (`fixtures/`), erzeugte Dateien und `.d.ts`. „Produktiv“ heißt: alles außer `tests/`. Messwerkzeuge und Rohdaten liegen in `tmp/metrics/` (nicht in Git).

## Kurzurteil

| Bereich | Ergebnis | Bewertung |
|---|---|---|
| Komplexität je Funktion | Median 1, Ø 3,0; 4,9 % über 10 | gut, aber einige sehr große Funktionen |
| Wartbarkeitsindex | 99,5 % der benannten Funktionen grün | gut |
| Duplikate | 1,25 % der Codezeilen | gut (übliche Grenze 3 %) |
| Testabdeckung Backend | Zweige 85 %, Zeilen 89 % | gut |
| Testabdeckung Oberfläche | keine Komponententests | Lücke |
| Lint | 0 Fehler, 63 Warnungen | gut |
| Typprüfung | TS strict ohne Fehler, aber nur 49 % des Codes typgeprüft | mittel |
| Fehlerbehandlung | 188 leere `catch`-Blöcke | mittel |
| Abhängigkeiten | 15 Sicherheitsmeldungen in Laufzeitpaketen, davon 1 kritisch (`next`) | handeln |

## Umfang

| | Dateien | Codezeilen | Funktionen (benannt) |
|---|---|---|---|
| Produktiv | 732 | 54.530 | 12.900 (4.938) |
| Tests | 180 | 17.655 | 4.761 |

- Testcode im Verhältnis zum produktiven Code: 0,32.
- Testfälle: 2.470. Davon bestehen 2.466; 2 scheitern nur unter Windows (bekannt), 2 sind übersprungen.
- Kommentarzeilen: 6.141, das sind 11 % der Codezeilen.
- Codezeilen zählen ohne Leerzeilen und reine Kommentare. Der Code ist dicht geschrieben (oft mehrere Anweisungen je Zeile), daher sind Zeilenzahlen und Zeilenabdeckung eher niedrig bzw. hoch angesetzt.

## Komplexität (produktive Funktionen)

**Zyklomatische Komplexität (McCabe):** 1 plus Verzweigungen (`if`, Schleifen, `case`, `catch`, `?:`, `&&`, `||`, `??`). Innere Funktionen zählen getrennt.

| Ø | Median | 90 % | 99 % | Maximum | über 10 | über 20 | über 50 |
|---|---|---|---|---|---|---|---|
| 3,0 | 1 | 6 | 28 | 489 | 632 (4,9 %) | 234 (1,8 %) | 26 (0,2 %) |

**Kognitive Komplexität** (vereinfacht nach SonarSource; Verschachtelung zählt mit): Ø 2,4, über 15 bei 464 Funktionen, über 25 bei 234, Maximum 667.

**Weitere Werte je Funktion:**
- **Länge:** Ø 4,5 Codezeilen. Über 50 Zeilen: 154 Funktionen, über 100: 49, längste 318.
- **Parameter:** 41 Funktionen haben mehr als 4, das Maximum ist 8.
- **Verschachtelung:** 57 Funktionen tiefer als 4, maximal 23.

**Nach Bereich:**

| Bereich | Funktionen | Ø Komplexität | über 10 | Ø Wartbarkeit |
|---|---|---|---|---|
| server | 4.081 | 3,9 | 327 | 71 |
| components/ratsmonitor | 3.716 | 2,7 | 130 | 67 |
| scripts | 1.976 | 2,6 | 63 | 76 |
| components (Admin) | 1.345 | 2,6 | 43 | 73 |
| shared | 745 | 3,4 | 57 | 72 |
| app | 179 | 3,2 | 9 | 71 |

**Komplexeste Funktionen:**

| Komplexität | kognitiv | Zeilen | Funktion |
|---|---|---|---|
| 489 | 667 | 225 | Rückruf in `server/integrations/website-text.mjs:1133` (Aufteilung in Sitzungen) |
| 190 | 367 | 157 | `verify`, `scripts/source-discovery/verify.mjs:201` |
| 158 | 274 | 268 | `collectWebsite`, `server/integrations/website.mjs:322` |
| 133 | 160 | 247 | `XAtlasView`, `components/ratsmonitor/pages/analytics/XAtlasView.tsx:38` |
| 119 | 128 | 208 | `SignalePage`, `components/ratsmonitor/pages/analytics/SignalePage.tsx:144` |
| 106 | 117 | 230 | `FaktenPage`, `components/ratsmonitor/pages/analytics/FaktenPage.tsx:45` |
| 104 | 108 | 197 | `AdminPdf`, `components/admin-pdf.tsx:62` |
| 83 | 63 | 32 | `meetingHeader`, `server/integrations/website-text.mjs:847` |
| 80 | 94 | 147 | `AdminAtlas`, `components/admin-atlas.tsx:41` |
| 76 | 88 | 86 | `searchMonitor`, `server/integrations/monitor-search.mjs:194` |

Bei React-Seiten zählt jede Bedingung im JSX mit (`cond && <…>`, `?:`). Die Werte dort sind daher höher, als sie sich lesen.

**Größte Dateien (Codezeilen):** `website-text.mjs` mit 1.031 Zeilen und Komplexität 1.574 in Summe; `mapEngine.ts` mit 1.014. Drei weitere Dateien haben über 500 Zeilen.

## Wartbarkeitsindex

Formel nach Visual Studio, Skala 0 bis 100: 171 − 5,2·ln(Halstead-Volumen) − 0,23·Komplexität − 16,2·ln(Zeilen). Gemessen für die 4.938 benannten Funktionen.

- Ø 71,3, Median 79,9.
- Grün (ab 20): 4.913 Funktionen, das sind 99,5 %.
- Gelb (10 bis 19): 18.
- Rot (unter 10): 7. Das sind die großen Funktionen aus der Tabelle oben.

## Duplikate

Gleiche Folgen von mindestens 70 Tokens im produktiven Code: 684 Zeilen, das sind 1,25 %. Größte Paare:
- `GraphView.tsx` ↔ `NetView.tsx` (Analytics)
- Videoszenen `docs/videos/szenen/x-*/szene.mjs` untereinander
- `Brand.tsx` ↔ `lib/favicon.ts`
- `admin-altbestand.tsx` ↔ `admin-fehler.tsx`

## Testabdeckung

Gemessen mit `node --test --experimental-test-coverage` über alle Tests. Dateien, die kein Test lädt, zählen mit 0 %.

| Bereich | Dateien (von Tests geladen) | Zeilen gesamt | Zeilen (geladene Dateien) | Zweige (geladene) | Funktionen (geladene) |
|---|---|---|---|---|---|
| server | 175 (157) | 92,9 % | 98,2 % | 85,2 % | 94,0 % |
| shared | 47 (42) | 93,7 % | 99,5 % | 88,6 % | 96,3 % |
| scripts | 115 (29) | 33,4 % | 89,7 % | 80,2 % | 84,2 % |
| app (Routen und Seiten) | 106 (0) | 0 % | – | – | – |
| components (Oberfläche und Admin) | 232 (0) | 0 % | – | – | – |

- **Backend** (server, shared, app/api): Zeilen 89 %, Zweige 86 %.
- **Zweigabdeckung ist der bessere Maßstab.** Die Zeilenabdeckung wirkt bei dichtem Code zu hoch, weil eine Zeile schon als abgedeckt gilt, wenn einer ihrer Teile läuft.
- **Kein Test lädt** die TypeScript-Schicht `server/services/*.ts` (`sync.ts`, `session.ts`), `server/repositories/*.ts`, `server/node/serve.mjs` und die Routen in `app/api`. Teile davon prüfen Tests indirekt über Text (`route-access`, `x-warm`).
- **Oberfläche:** Für die Komponenten gibt es keine automatisierten Tests. `node --test` lädt kein TSX.

## Statische Analyse

**ESLint:** 0 Fehler, 63 Warnungen.
- `no-unused-vars`: 29
- `import/no-anonymous-default-export`: 21
- `react-hooks/exhaustive-deps`: 7
- `no-unused-expressions`: 4
- je 1 aus `jsx-a11y` und `@next/next`

**TypeScript:** `strict`, `tsc --noEmit` ohne Fehler. Geprüft werden aber nur `.ts` und `.tsx`, das sind etwa 27.000 der 54.500 produktiven Codezeilen (49 %). Die `.mjs`-Module (51 %) sind nicht typgeprüft (`allowJs` ohne `checkJs`).

Probelauf mit `checkJs` über `server`, `shared` und `scripts`:
- **Mit strict:** 8.413 Meldungen in 307 Dateien. Davon fehlen bei 6.300 nur Typangaben (implizites `any`).
- **Ohne strict:** 697 Meldungen. 418 betreffen unbekannte Eigenschaften, 84 Argumenttypen, 54 die Zahl der Argumente.
- Die Stichproben waren Fehlalarme: Funktionen werden als leere Platzhalter angelegt und später ersetzt, Typen aus Datenbankzeilen sind unbekannt. Ein Fehler im Verhalten ist daraus nicht abzulesen.

**Unterdrückungen und Warnzeichen** (produktiver Code):
- `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`: 0
- `any` in TypeScript: 3
- `eslint-disable`: 23
- TODO, FIXME, HACK: 0
- leere `catch`-Blöcke: 188
- `console.log` außerhalb von Skripten: 10

**Abhängigkeiten zwischen Modulen:**
- **Importzyklen:** 6.
  - Je 6 Module bei den Lesern (`sessionnet`, `website-text`, `text-repair`, `public-agenda`, `oparl-regional`, `sessionnet-details`) und bei plenara.X (`x-offload` mit `plenara-x-query`, `x-cases`, `plenara-x-signals` und Auswertungen).
  - Dazu 4 Paare in der Oberfläche und im Admin.
- **Meistgenutzte Module:**
  - `session.ts` (47)
  - `sessionnet.mjs` (38)
  - `oparl.mjs` (33)
  - `shared/regions.ts` (32)
- **Module mit den meisten Importen:**
  - `App.tsx` (29)
  - `readers.mjs` (27)
  - `app/admin/page.tsx` (25)

**Ungenutzte Exporte:** 191 von rund 2.000 Exporten importiert keine andere Datei.
- 170 davon nutzt nur die eigene Datei; das `export` ist dort überflüssig.
- 15 werden nirgends genutzt (Kandidaten zum Löschen, z. B. `ChipRail`, `DevBrandSwitcher`, `getFeedPage`, `getUpcomingSessions`, `themeName`, `STEP_MIN`).

**Brennpunkte** (Änderungen in den letzten 90 Tagen × Komplexität der Datei):

| Änderungen | Komplexität | Datei |
|---|---|---|
| 53 | 679 | `shared/topic-facts.mjs` |
| 58 | 406 | `components/ratsmonitor/state/search.tsx` |
| 46 | 416 | `server/integrations/monitor-search.mjs` |
| 58 | 313 | `pages/analytics/SignalePage.tsx` |
| 49 | 330 | `pages/analytics/XAtlasView.tsx` |
| 10 | 1.574 | `server/integrations/website-text.mjs` |

## Abhängigkeiten mit Sicherheitsmeldungen (`pnpm audit`)

- **Alle Pakete:** 64 Meldungen (1 kritisch, 31 hoch, 24 mittel, 8 niedrig).
- **Nur Laufzeitpakete:** 15 Meldungen (1 kritisch, 5 hoch, 7 mittel, 2 niedrig).

Laufzeitpakete:
- **kritisch:** `next` 16.3.4, „Remote Code Execution in next/og ImageResponse“, behoben ab 16.3.6. Die App nutzt `ImageResponse` aus `next/og` (`app/(monitor)/beschluss/[id]/opengraph-image.tsx`). Der Node-Build bündelt `@vercel/og` 1.0.3. Ob die Lücke über vinext erreichbar ist, ist nicht geprüft.
- **hoch:** `next`, Server-Side Request Forgery in der Bildoptimierung (ab 16.3.8); `sharp` < 0.35.5 über `@vercel/og`; `browserslist`; `source-map-js`.

Nur Entwicklungswerkzeuge:
- `undici`, `ws` und `vite` über `@cloudflare/vite-plugin` und miniflare.
- `brace-expansion` und `js-yaml` über ESLint.

## Empfehlungen (nach Wirkung)

1. **`next` auf mindestens 16.3.8 heben, `@vercel/og` und `sharp` mitziehen**, danach `pnpm audit --prod` erneut. Bis dahin klären, ob das OG-Bild über vinext den betroffenen Code nutzt.
2. **Die drei Riesenfunktionen aufteilen:** Aufteilung in `website-text.mjs`, `collectWebsite` und `verify`. Die ersten beiden sind gut getestet (über 99 % der Zeilen), das Aufteilen ist also absicherbar.
3. **Die 188 leeren `catch`-Blöcke durchgehen.** Im Server mindestens ins Log schreiben, wie `bestEffort` in `sync.ts`.
4. **Typprüfung schrittweise auf `.mjs` ausdehnen:** zuerst `shared/` mit `// @ts-check` und JSDoc an den Schnittstellen, dann die meistgenutzten Server-Module.
5. **Tests für die Oberfläche**, beginnend bei den Brennpunkten: `state/search.tsx`, `SignalePage` und `XAtlasView`.
6. **Kleinkram:** 15 ungenutzte Exporte entfernen, die 6 Importzyklen auflösen (am einfachsten bei den Lesern über `text-repair` und `sessionnet`), die 63 Lint-Warnungen abbauen.

## Grenzwerte zum Vergleich

| Maß | übliche Grenze | Quelle |
|---|---|---|
| Zyklomatische Komplexität je Funktion | 10 | McCabe |
| Kognitive Komplexität je Funktion | 15 | SonarSource |
| Wartbarkeitsindex | ab 20 grün | Visual Studio |
| Duplikate | höchstens 3 % | Qualitätstor in SonarQube |
| Abdeckung neuer Code | mindestens 80 % | Qualitätstor in SonarQube |
