# Admin-Bereich: Bestandsaufnahme und Konzept (Entwurf 23.10.2026)

Stand: nur gelesen, nichts umgebaut. Teil A listet Veraltetes und Überflüssiges je Seite, Teil B schlägt einen einheitlichen Aufbau vor. Das Menü (`ADMIN_GROUPS` in `components/admin-chrome.tsx`) und die Adressen bleiben im Kern gleich.

---

## Teil A: Veraltet oder überflüssig

Alle Pfade beziehen sich auf `components/`, sofern kein anderer Ordner genannt ist. Zeilennummern geben den Stand vom 23.10.2026 wieder.

### Seitenübergreifend

- **Texte zur Titelregel und zu den Thema-Regeln.** Seit 22.10. ordnet das Modell ein.
  - `admin-texts.ts:16`: Die Einleitung der Seite Verarbeitung lautet „nach Regeln (Titel, Thema, …)“. Der Zusatz „die KI startet nur auf Klick“ stimmt ebenfalls nicht mehr, weil die KI nur über den Agentenablauf (MCP) läuft.
  - `admin-texts.ts:123–124`: Die Hilfe `verarbeitung.regeln` beschreibt „ordnet zuerst die Titel ein … Wortliste“.
  - `admin-texts.ts:161`: Die Prüfliste sagt „Themen stammen aus den festen Regeln: zuerst aus dem Titel …“ und spricht von 16 Sachgebieten.
  - Weitere Stellen: `admin-texts.ts:172` (to-do „Fehlende Regel-Einordnung“), `:200` (Begriff „Thema“), `:277` (`REVIEW_HELP.labels`), `:318` (`sachgebieteNotiz`).
- **„Sachgebiet“ ist der alte Begriff, heute heißt es „Thema“.** Betroffen sind `admin-processing.tsx:165, 167`, `database-admin.tsx:28` und `server/integrations/schedules.mjs:79`.
- **Jobbeschreibung „Themen & Texte“ in `server/integrations/schedules.mjs:78–79`.** Sie nennt die Schritte „Titel einordnen (Titelregel)“ und „Art des Punkts, Thema“. Der Schritt „Modell anwenden“ (`scripts/rule-texts.mjs:70`) fehlt. Auch `:73` („die KI liest alle“) ist zu prüfen.
- **Schrittname „Titel einordnen“ in `shared/pipeline-terms.mjs:34`.** Er erscheint über `Glossary`/`StepList` auf den Seiten Letzte Nacht und Altbestand. Neu soll dort der Schritt „Modell anwenden“ stehen, „Titel einordnen“ bleibt nur als Alias.
- **Gleiche Hilfsfunktionen in vielen Dateien.**
  - `n`, `pct`, `mio`, `dd`/`day`/`shortDate` sind mehrfach definiert: `admin-ui.tsx:13`, `admin-pdf-parts.tsx:15`, `admin-rule-texts.tsx:30–32`, `admin-pipeline-parts.tsx` sowie Cockpit, Abdeckung und Atlas.
  - `SectionHead` ist zweimal kopiert (`admin-overview.tsx:28`, `admin-atlas.tsx:33`). `H2`/`Lead` stehen in Cockpit, Letzte Nacht, Altbestand und Fehler je einmal.
- **Drei Arten von Überschriften nebeneinander:**
  - `admin-section` mit `HELP` (Abdeckung, Atlas, Dashboard, Themen & Texte),
  - eigenes `H2` mit Symbol in 22 px (Cockpit, Letzte Nacht, PDF, Altbestand, Fehler, Jobs, Speicher),
  - `admin-estimate-step` (Hochrechnung).
- **Stand-Anzeige uneinheitlich.** `StandLine` haben nur Abdeckung, Atlas, Dashboard-Seiten, Themen & Texte und Hochrechnung. PDF-Import und Speicher bauen sie selbst. Cockpit, Letzte Nacht, Altbestand, Fehler, Jobs und Social Media haben keine.
- **Ungenutzte Props.**
  - `displayName`/`signOutPath` in `admin-overview.tsx:75`, `admin-atlas.tsx:41`, `admin-forecast.tsx:5` und `admin-estimate.tsx:91` werden von `app/admin/page.tsx` nie übergeben.
  - `admin-forecast.tsx` ist nur eine Hülle mit `revision={0}`.
- **ChatGPT-Anmeldung als Altweg.** Betroffen sind `app/admin/page.tsx` (`chatGPTSignIn*`, „Mit ChatGPT anmelden“) und das „Abmelden“ über `signOutPath` in `admin-chrome.tsx:121`.
  - Die Funktion greift nur mit `ADMIN_LEGACY_HEADER=1`.
  - Vorschlag: Mit dem Ende des Altwegs entfernen. Das ist eine Entscheidung, die du treffen musst, und betrifft auch das Backend.
- **Farben.**
  - `fill="#fff"` steht in `admin-atlas.tsx:160`, `admin-estimate.tsx:69`, `admin-colors.ts:9–10` und `admin-processing-map.tsx:18, 48`. Weiß ist erlaubt, sollte aber als Variable gesetzt sein.
  - Fehlerbalken in `admin-pipeline-parts.tsx:63` sind slate-900. Warnungen sollten amber sein.
  - `COLS_NOTE` (`admin-overview.tsx:32`) spricht von „Schwarz“, gemeint ist slate-900.

### Cockpit (`admin-cockpit.tsx`)
- `:54–56`: Der amberfarbene Hinweis zu den Auslösern steht fast wortgleich auch in `admin-debug.tsx:74–77`.
- `:26`: `IMPORT_STATE` ist doppelt, in `admin-debug.tsx:26` mit anderem Wortlaut („teilweise“ statt „teilweise gespeichert“).
- `:92`: „Berichte ohne Thema“ prüfen. Die Zahl sollte das Modellthema meinen (`topic_effective_labels`), nicht die Titelregel.
- Es fehlt eine Stand-Zeile. Die Seite aktualisiert sich still alle 5 Minuten.

### Abdeckung (`admin-overview.tsx`)
- Die Kacheln „Gebiete angebunden“ und „Einwohner erreicht“ sowie die Abschnitte Rückreichweite und Aktualität stehen auch im Lückenatlas (`admin-atlas.tsx:145–146`).
- „Einwohner erreicht“ ist auf vier Seiten unterschiedlich definiert: Gemeindeebene, mit VG, mit Kreisen.

### Lückenatlas (`admin-atlas.tsx`)
- `:109–114`: Die Kacheln „inkl. VG“ und „inkl. Kreise“ rechnet der Browser selbst nach, obwohl die API `withVg`/`withDistricts` schon liefert (`admin-coverage.mjs`, genutzt in `admin-mobile.tsx`).

### Mobil (`admin-mobile.tsx`, `?seite=mobil`)
- `:5`: Der Kommentar „nur die Abdeckung“ stimmt nicht, darunter steht das ganze Menü.
- Die überschrift (h1) hat nur 14 px, und es gibt keine Stand-Zeile.

### Letzte Nacht (`admin-debug.tsx`)
- `:41`: Die Zeile „Titel eingeordnet“ (`w.label`) zeigt die ersetzte Titelregel. Stattdessen gehört dort „Modell angewendet“ hin, mit Berichten mit aktueller Modellantwort. Dafür ist der Wert im Backend nötig (`scripts/pipeline-trace.mjs`).
- `:42`: „Regeln angewendet“ bleibt, mit dem Hinweis, dass damit nur Zusammenfassung und Fakten gemeint sind.
- `:74–77`: Der Auslöser-Hinweis ist doppelt zum Cockpit.
- Die Breite ist 1100 px statt der üblichen 820/900. Das Laufbuch steht als `summary`-Überschrift mit 22 px.

### Abruf (`admin-processing.tsx`, über `admin-loader.tsx`)
- **Einordnung nach Regeln als Auftragsart `analysis`.** Betroffen sind `:31` (`RUNNERS.analysis`), `:124–128` (`labelJob`/`labelTotal`) und `:153, 170–171` („wendet die Regeln an (Titel, Thema, …)“). Diese Einordnung macht heute der Job „Themen & Texte“ mit dem Modell.
- **Kartenmodi.** Von den 8 Modi gehören `rules`, `summary` und `aiLabel` zur Verarbeitung, nicht zum Abruf.
  - `MAP_HELP.rules`, `summary` und `aiLabel` haben dreimal denselben Text.
  - `:167`: Der Text sagt „Die drei KI-Zahlen“, es sind aber zwei.
- `admin-dashboard.tsx:17`: `RUN_MODE` enthält `claude-analysis`, `prepared-analysis` und „Labels & Themenmerkmale“. Diese alten Laufarten bleiben nur für die Historie in der Tabelle. Der Wortlaut sollte angepasst werden.
- `qualitaet.importe` (`admin-texts.ts:166`) sagt „auf dieser Seite fortsetzen“, `statusOffen` (`:329`) verweist dagegen auf die Seite Abruf.

### Verarbeitung (`admin-verarbeitung.tsx`, `admin-ai-local.tsx`)
- Der Abschnitt „Nach Regeln“ und die Einleitung beschreiben die Titel- und Thema-Regeln. `:12` (Kommentar) nennt noch „Titel einordnen“.
- Der Fortschritt „nach Regeln“ steht doppelt zu „Themen & Texte“, das den Lauf und die Knöpfe ebenfalls zeigt.
- Seitenkopf und Aktualisieren sind aus `admin-dashboard.tsx` kopiert (`Head`, `refresh`), statt `Page`/`useDashboard` zu nutzen.
- Die Gebietsauswahl steht zweimal übereinander: `AdminAreaPick` und die Gebietswahl in `AdminAiLocal`. Die Abschnitts-ID heißt `abruf-ki-lokal`.
- „Früherer KI-Auftrag“ (`legacyJob`, alter `ai-job.mjs`) sollte bleiben, solange Altaufträge da sind. Danach entfernen.

### Altbestand (`admin-altbestand.tsx`)
- `:107–108`: „Regeln und KI“ mit dem Schritt `stepName('title')` („Titel einordnen“) ist ersetzt durch „Modell anwenden“.
- `:95, 114`: Die Absätze „die KI liest sie mit“ und „Regel-Zusammenfassung … KI-Fassung“ beziehen sich auf den alten KI-Weg und sollten neu formuliert werden.
- Knöpfe für die Verarbeitung gibt es doppelt, hier und in Themen & Texte. „Alte Fehler“ steht auch unter Fehler & Server.

### PDF-Import (`admin-pdf.tsx`, `admin-pdf-parts.tsx`)
- `:234`: „… die KI liest dieselben Texte“ prüfen.
- `:176`: „Wortliste“ umbenennen in den festen Schrittnamen „Suche aktualisieren“.
- Doppelt zu Speicher: freie Festplatte (`:192`) und Größe der Ablage.
- Doppelt zu Fehler & Server: die Abschnitte „Abrufe, Fehler und Server“ und `HostList` (`:241–261`).
- „Ø Qualität“ erscheint viermal (`:139, 153, 168, 201`). Insgesamt stehen über 35 Kacheln auf der Seite. `:126` ist ein einziger langer Erklärabsatz.
- Kein Fehler, nur als Hinweis: OCR im Tageslauf (`nightly.mjs --daily`, bis 45 Minuten) ist gewollt, die Texte `:111` und `:228` stimmen.

### Themen & Texte (`admin-rule-texts.tsx`)
- `:171–172`: Die Kachel „… n von der KI“ und „Ø Güte der automatischen Texte“ prüfen.
  - Die KI-Texte kommen nur noch aus dem Agentenablauf.
  - Die Güte bezieht sich auf die frühere Regel-Zusammenfassung. Seit 22.10. wählt der Satzkopf die Kernsätze.
- `:123`: Die Ausgang-Regel nennt den „Newsradar“. Der Newsradar nutzt die Ausgang-Regel zwar weiter (`shared/vote-result.mjs`), sein Schritt und das Streitthema kommen aber aus dem Modell. Den Text präzisieren.
- `:42, 183, 231`: Ersetzte Regeln werden dreimal im Fließtext erwähnt. Einmal genügt.
- Der lange Modell-Text steht vor Lauf, Status und Knöpfen. Dadurch stehen die Handlungen weit unten.

### Prüfliste (`AdminReview` in `admin-dashboard.tsx:50–97`)
- `:74`: „KI-Sachgebiete (alle, auch Titeltest)“, dazu `admin-texts.ts:162, 201, 314` (Titeltest Billerbeck). Das ist ein Altbegriff aus `labels-v2`.
- Die KI-Quote ist auf Verarbeitung und Prüfliste unterschiedlich definiert: „Mit KI-Zusammenfassung“ gegen „Als KI-Text gekennzeichnet“ bzw. „KI-Inhaltsanalyse abgeschlossen“.

### Bestandsprüfung (`AdminStock` in `admin-dashboard.tsx:99–114`, `database-admin.tsx`, `admin-quality-check.tsx`)
- `database-admin.tsx:30`: „Push-Abonnements werden nicht übertragen“ streichen, Web-Push ist nicht angebunden.
- Es gibt zwei Exporte, die nicht erklärt sind: einen CSV-Link in der Sprungleiste und JSONL im Abschnitt.

### Jobs & Zeitpläne (`admin-schedules.tsx`)
- `:76`: „erst abrufen, dann sichern, dann die Wortliste, dann PDFs“ ist falsch.
  - Die Reihenfolge ist Sichern 00:30, dann Abruf 01:00.
  - Einen eigenen Wortlisten-Job gibt es seit 14.10. nicht mehr.
- `accounts` (00:10) und `betrieb` (09:30) stehen im Balken „Ablauf der Nacht“, obwohl sie nicht zur Pipeline gehören.
- 13 Jobs in einer flachen Liste, obwohl `flow` (Tagespipeline, Nacharbeit, Altbestand, Betrieb) die Gruppen hergibt.

### Fehler & Server (`admin-fehler.tsx`)
- Kaum Veraltetes. Es fehlen Summenkacheln und eine Stand-Zeile, die Summen stehen nur in den Radio-Labels.

### Speicher & Sicherungen (`admin-storage.tsx`)
- `:100`: „Job ‚Datensicherung‘“ heißt im Menü der Jobs „Sichern“.
- `:18`: Die Legende hat sechs Grautöne, die kaum zu unterscheiden sind.

### Social Media (`admin-social.tsx`)
- `:47`: Der Kommentar nennt `social-topics.mjs`, die Route nutzt `social-model.mjs`.
- `:95`: Der Satz zu den weggefallenen Streitwörtern ist nur noch Geschichte und kann weg.
- `:86`: `Alert` ohne `onRetry`.

### Tote Exporte und Texte (per grep geprüft)
- In `admin-texts.ts:50–59` sind `ZUSTAND.nie`, `nieAktion`, `erstes`, `fehlerAktion`, `veraltet`, `nachrechnen` und `ohne0016` tot.
  - `veraltet` und `ohne0016` stehen zusätzlich als Literal in `admin-stand.tsx:9, 18`.
  - `nachrechnen` steht zusätzlich in `admin-catch-up.tsx`.
- `admin-texts.ts:254–256`: `STATE_HELP` „Ohne Artikel“ und „Datenstand älter“ sind tot. Der Kommentar „bis … umbenannt ist“ ist überholt.
- `FILTER_HELP.attention/html/closed` (`admin-texts.ts:231–234`) gehören zum alten CSV-Export der Qualitätsseite.
- `type CatchUp` (`admin-store.ts`) ist tot.
- Diese Exporte werden nur innerhalb ihrer eigenen Datei genutzt, das `export` ist unnötig: `stepSentence`, `BUCKET_COLOR`, `RunDebugView` (`admin-run-debug.tsx:17`).
- Der Kopfkommentar `admin-pipeline-parts.tsx:6` nennt nicht alle Nutzer der Datei, es fehlt Fehler & Server.

Kein Treffer gab es zu Stichwörtern, Themenradaren, Förderung, Kita-Plätzen, Parkgebühr, OpenAI und `labels-v2` (außer „Titeltest“ und „Sachgebiet“, siehe oben).

---

## Teil B: Konzept

### B0. Ziel

Der Admin-Bereich soll fast keine Arbeit machen. Alles läuft von selbst, und wir sehen nur nach, wenn etwas zu tun ist.

- **Benachrichtigungen statt Nachsehen.** Was Handeln braucht, kommt per Mail: die Fehlermail je Einheit, die tägliche Betriebsprüfung (Job `betrieb`) und `/api/health` für einen Uptime-Dienst. Neue Warnungen gehören dorthin, nicht nur auf eine Seite.
- **Erst die Antwort, dann die Tiefe.** Jede Seite sagt oben in einem Satz, ob alles in Ordnung ist oder was Aufmerksamkeit braucht. Dazu kommt eine Kennzahl im Kopfband und eine Zeile mit Zahlen. Alles Weitere ist aufklappbar: Abschnitte, die man nicht auf den ersten Blick braucht, Schritte eines Laufs, Listen, Protokolle, Begriffe und Methodik.
- **Das Cockpit beantwortet „Muss ich etwas tun?“.** Bei Normalbetrieb ist es ruhig. Erscheint dort ein Hinweis, führt ein Link zur Seite, auf der man ihn versteht, und zur Steuerung, auf der man ihn behebt.
- **Aufgeklappt bleibt, was man aufgeklappt hat.** Die Seite merkt sich je Betrachter, welche Abschnitte offen sind (nur im Browser).

### B1. Grundsätze
1. **Jede Seite beantwortet eine Frage.** Das ist die Leitfrage im Menü. Die Seite beginnt mit der Antwort (Kennzahlen, Status) und endet mit den Details.
2. **Jede Zahl hat eine Heimatseite.** Andere Seiten zeigen die Zahl höchstens als Kachel mit Link dorthin, nie als eigenen Abschnitt. Zum Beispiel gehört der freie Platz zu Speicher, Fehler und Server zu Fehler & Server, der Lauf und die Knöpfe der Verarbeitung zu Themen & Texte.
3. **Lesen und Steuern getrennt.** Alle manuellen Schalter liegen auf einer Seite, der Steuerung (B1a). Alle anderen Seiten lesen nur.
4. **Gleiche Bausteine, gleiche Reihenfolge.** Kein eigenes `H2`, `Lead`, `SectionHead` und keine eigenen Formathelfer mehr je Datei.
5. **Ein Begriff, ein Wort.** Alle Schritte heißen nach `shared/pipeline-terms.mjs`, Themen nach dem Modell. Ersetzte Regeln erscheinen nicht mehr, auch nicht im Fließtext.

### B1a. Manuelle Schalter: eine Steuerung, alle anderen Seiten lesen nur

Heute verteilen sich Start, Anhalten und Optionen über sieben Seiten: Abruf, PDF-Import, Themen & Texte, Verarbeitung, Altbestand, Jobs & Zeitpläne und Fehler & Server. Dieselbe Verarbeitung lässt sich an drei Stellen starten. Ob eine Seite etwas auslöst, sieht man ihr nicht an.

**Möglichkeiten**
- **A, Empfehlung: eine Seite „Steuerung“.** Sie ersetzt „Jobs & Zeitpläne“ in der Gruppe Betrieb.
  - Dort liegen alle Handlungen, die auf dem Server etwas tun.
  - Alle übrigen Seiten zeigen nur Stand und Ergebnis und verlinken mit „Steuern →“ auf den passenden Job.
  - Vorteile: Eine Stelle zum Lernen, kein versehentliches Auslösen beim Lesen, die Lese-Seiten werden ruhig wie plenara.X.
  - Nachteil: Beim Steuern wechselt man die Seite. Die Steuerung zeigt deshalb je Job die zwei, drei wichtigsten Ergebniszahlen gleich mit.
- **B: Schalter bleiben auf den Fachseiten, aber klar abgesetzt.**
  - Jede Seite mit Schaltern bekommt einen einheitlichen Kasten „Steuern“ an fester Stelle, oben unter den Kennzahlen.
  - Das Menü markiert diese Seiten mit einem Symbol.
  - Weniger Umbau, aber die Doppelungen bleiben.

**Regeln, wenn A gilt**
- **Was zur Steuerung gehört:**
  - Jetzt ausführen, Anhalten, Zeitplan ein/aus und Uhrzeit.
  - Optionen eines Laufs: Zeitraum, Gebiete, Umfang, OCR an/aus.
  - Erneut versuchen, Server freigeben, Messen, „Neu berechnen“ und „Stand neu zählen“.
  - Kurz: alles, was auf dem Server einen Job, einen Auftrag oder eine Schreibaktion auslöst.
- **Was auf Lese-Seiten bleibt:** Aktualisieren der Anzeige, Filter, Umschalter, Suche, Aufklappen, Kopieren, Herunterladen (CSV, JSON, Export).
  - Ausnahme ist der vollständige Export der Bestandsprüfung. Er schreibt nichts, läuft aber lange und bleibt deshalb dort, mit Hinweis.
- **Aufbau der Steuerung:**
  1. **Läuft gerade:** alle laufenden Jobs und Bahnen, mit Anhalten.
  2. **Warteschlange.**
  3. **Jobs gruppiert nach Ablauf:** Tagespipeline, Nacharbeit, Altbestand, Betrieb. Jeder Job ist eine `JobCard` mit Schalter, Zeit, Optionen, „Jetzt ausführen“, letztem Ergebnis und dem Link „Ergebnis ansehen →“.
  4. **Ablauf der Nacht:** der Balken.
  5. **Sonderaufträge:** Abruf mit Gebietsauswahl, Altbestand-Fenster, PDF-Sonderläufe.
- **Übergabe von Lese-Seiten:**
  - Lese-Seiten übergeben eine Auswahl per Adresse, z. B. Gebiete aus dem Lückenatlas oder Abruf: `?seite=steuerung&job=import&auswahl=…`.
  - Die Steuerung zeigt die übergebene Auswahl vor dem Start an.
- **Erkennbarkeit:**
  - Im Menü trägt die Steuerung als einzige Seite das Symbol eines Schalters.
  - Lese-Seiten haben keinen `btn-primary`.
- **Seiten mit Schaltern heute**, die künftig auf die Steuerung verweisen: Abruf, PDF-Import, Themen & Texte, Verarbeitung, Altbestand, Fehler & Server (Freigeben, erneut versuchen), Speicher (Messen) und Social Media (Neu berechnen).
- **Kopieren von IDs auf der KI-Aufbereitung:** Das Kopieren bleibt dort. Es löst auf dem Server nichts aus, sondern bereitet nur den Agentenablauf vor.

### B2. Einheitlicher Seitenaufbau

```
┌ Kopf ──────────────────────────────────────────────────────────┐
│ Administration / Gruppe / Seite                                │
│ Titel (h1)                                                     │
│ Einleitung: ein Satz, beantwortet die Leitfrage                │
│ Stand: 23.10. 09:12 · Aktualisieren                            │
├ Meldungen (nur wenn nötig) ────────────────────────────────────┤
│ Fehler (Alert mit „Erneut versuchen“) · Hinweis (amber)        │
├ Kennzahlen ────────────────────────────────────────────────────┤
│ 4 Kacheln (höchstens 6), je Kachel Link zur Heimatseite        │
├ Jetzt (nur Seiten mit Jobs, nur lesend) ───────────────────────┤
│ Laufzeile je Job: Status · Fortschritt · Nächster Start        │
│ „Steuern →“ (Link auf die Steuerung, Anker des Jobs)           │
├ Abschnitte ────────────────────────────────────────────────────┤
│ h2 + Unterzeile + „Wie wird gezählt?“ (zu)                     │
│ Inhalt: Diagramm / Tabelle / Liste                             │
│ „Was tun?“-Links                                               │
├ Protokoll (zu) ────────────────────────────────────────────────┤
│ Letzte Läufe, Rohdaten, CSV                                    │
└ Fußzeile: Begriffe · Zur Website ──────────────────────────────┘
```

**Regeln für den Aufbau:**
- **Breite:** Der Inhalt ist höchstens 1100 px breit, Fließtext 820 px. Mobil gilt eine Spalte mit 16 px Rand.
- **Sprungleiste:** Ab fünf Abschnitten steht unter den Kennzahlen eine Sprungleiste mit Ankern. Das betrifft Abdeckung, PDF-Import, Hochrechnung, Themen & Texte und Abruf.
- **Knöpfe:** Auf Lese-Seiten gibt es keine Knöpfe, die etwas auf dem Server auslösen (siehe B1a). Erlaubt sind nur „Aktualisieren“, Filter, Umschalter, Kopieren und Herunterladen. Links sind immer `text-teal-600`.
- **Leer- und Ladezustand:** `PageSkeleton` aus den Abschnitts-IDs, keine eigenen Lade-Punkte.

**Neue oder vereinheitlichte Bausteine in `admin-ui.tsx`:**

| Baustein | ersetzt |
|---|---|
| `AdminPageHead` mit Pflicht-`stand` | eigene Stand-Zeilen in PDF, Speicher, Cockpit, Verarbeitung |
| `AdminSection({id,icon?})` mit `HELP`-Titel, `SectionHelp` und `SectionTodo` | `SectionHead` ×2, `H2`/`Lead` ×4, `admin-estimate-step` |
| `JobLine({job})` auf Lese-Seiten: Status, Fortschritt, nächster Start, Link „Steuern →“ | Lauf- und Knopfzeilen in PDF, Altbestand, Themen & Texte, Verarbeitung |
| `JobCard({job})` nur auf der Steuerung: dazu Schalter, Zeit, Optionen, Jetzt ausführen, Anhalten, Warteschlange | Jobliste von Jobs & Zeitpläne |
| `Notice` (amber) | Amber-Hinweise in Cockpit, Letzte Nacht, Jobs |
| `JumpNav` | Sprungleiste der Bestandsprüfung |
| `admin-format.ts` mit `n`, `pct`, `mio`, `day`, `when`, `dur` | Kopien in 8 Dateien |

### B2a. Stil wie die plenara.X-Seiten (Wunsch 23.10.2026)

Der Adminbereich nutzt `PageBand` schon. Er soll die übrigen Bausteine der plenara.X-Seiten (`components/ratsmonitor/pages/analytics/`) mitnehmen, statt eigene nachzubauen.

**Kopfband**
- **`Befund`:** Unter dem Titel steht ein Satz mit der Antwort auf die Leitfrage statt einer festen Einleitung. Beispiele: „Letzte Nacht liefen 7 von 8 Jobs, 312 Berichte sind neu.“ oder „Das Modell hat 98 % der Berichte eingeordnet.“ Die feste Einleitung wandert in die Methodik.
- **`Kennzahlen` im Band:** Die Hauptzahl steht groß mit Bezug und „+N in 7 Tagen“, die übrigen Zahlen ruhig in einer Zeile. Das ersetzt die Kachelreihe `Kpis` unter dem Kopf.
- **Stand:** Der Stand steht wie bei plenara.X unter dem Befund.

**Zustände**
- **`Laden`:** Zeigt die Form der Seite mit laufender Zeit. Ersetzt `PageSkeleton` und die drei Punkte.
- **`Leer`:** Ein Satz, was fehlt, und darunter, was man tun kann. Ersetzt die freien Leertexte.
- **`Fehler`:** Fehler mit dem Knopf „Noch einmal“. Ersetzt `Alert`.

**Abschnitte**
- **Überschriften:** h2 mit 22 px wie auf `BeschluessePage`, darüber optional `ListenKopf` (Symbol in Petrol, kleine Zeile darüber, Zahl rechts) für Listen.
- **Wahl zwischen Ansichten:** `Reiter` für ganze Ansichten, `Segmented` für Umschalter. Beispiele: PDF-Bestand Hauptdokumente / Übrige / Alle, Fehler Tagesbereich / Altbestand, Abdeckung Gebiete / Einwohner.
- **`ListRow` mit Balken statt Tabellen**, wo es um Rangfolgen geht: Länder, Größenklassen, Server, Fehlergründe, Jobs, Fakten, Fragen des Modells. Ein Klick klappt die Zeile auf und zeigt die Details. Die Tabellen bleiben nur für Rohdaten im Protokoll.
- **Zeitverlauf als Linie, keine Säulen** (UX-Leitlinie), z. B. Abdeckung, Monate der PDF-Ablage, Social Media.

**Methodik**
- „Wie wird gezählt?“, Erklärabsätze und Formeln wandern in die Methodik am Seitenende (`MethodikNote`). Der Text auf der Seite bleibt kurz.

**Was der Admin behält**
- **Kopf und Menü:** `AdminBar` mit Gruppenmenü bleibt, statt `XKopf` und `ThemenLeiste` zu übernehmen.
- **Handlungen:** Handlungen gibt es nur auf der Steuerung (B1a). Alle übrigen Seiten lesen nur, wie plenara.X.
- **Dichte:** Etwas dichter als plenara.X, zum Beispiel mit kleinerem Abstand im Band (`PageBand compact`).
- **Farben:** Nur das Farbschema Petrol klar, kein Rot. „Fehler“ nutzt im Admin amber.

### B3. Navigation

Die Gruppen bleiben, mit drei kleinen Verschiebungen. Keine Adresse fällt weg, alte Namen leiten weiter (`PAGES` in `app/admin/page.tsx`).

| Gruppe | Seiten (Leitfrage) |
|---|---|
| Cockpit | Wie steht es? |
| Abdeckung | Abdeckung (Wie viel erreichen wir?) · Lückenatlas (Wo fehlt was?) |
| Pipeline | Letzte Nacht · Abruf · PDF-Import · **KI-Aufbereitung** (bisher Verarbeitung: Was hat die KI bearbeitet?) · Altbestand |
| Qualität | **Einordnungsmodell** (bisher Themen & Texte: Wie gut ordnet das Modell ein?) · Prüfliste · Bestandsprüfung |
| Betrieb | **Steuerung** (bisher Jobs & Zeitpläne: Was läuft, was starte ich?) · Fehler & Server · Speicher & Sicherungen |
| Planung | To-do-Liste · Hochrechnung · Social Media |

**Begründung der Verschiebungen:**
- „Themen & Texte“ heißt künftig „Einordnungsmodell“. Die Seite steht als erste in der Gruppe Qualität, weil sie dort der wichtigste Teil ist. Sie zeigt die Messwerte des Modells, die Regeln, die bleiben, Zusammenfassung und Fakten sowie den Lauf des Jobs.
- Die bisherige Seite „Verarbeitung“ gibt ihren Regel-Teil ab, weil er doppelt zum Einordnungsmodell ist, und behält nur die KI. Neuer Titel: „KI-Aufbereitung“, Platz in der Gruppe Pipeline.

Die Mobilansicht `?seite=mobil` bleibt: Kopf mit Stand, drei Kacheln aus `withVg`/`withDistricts`, darunter das Menü.

### B4. Vorschläge je Seite

**Cockpit**
- Ändern:
  - Stand-Zeile ergänzen.
  - Vier Kacheln, jede mit Link zur Heimatseite.
  - „Letzte Nacht“ als `JobLine`-Kurzform.
  - Den Hinweis „Auslöser“ nur hier zeigen.
  - Die Zahl ohne Thema nach dem Modell zählen.
- Weg: eigenes `H2` und `IMPORT_STATE`, stattdessen eine gemeinsame Quelle.

**Abdeckung**
- Behalten: Verlauf, Monate, je Land, je Größenklasse, Begriffe.
- Weg: Rückreichweite und Aktualität, beides ist die Heimat des Lückenatlas. Hier bleibt nur ein Link.
- „Einwohner erreicht“ einmal definieren, mit VG. Die anderen Varianten nur in der Notiz der Kachel nennen.

**Lückenatlas**
- Kacheln aus der API statt aus Rechnungen im Browser.
- Filter an einer Stelle: über der Liste, mit der Karte verknüpft.
- Die vier „Warum“-Balken bleiben, darunter Karte und Liste.

**Letzte Nacht**
- Aufbau:
  - Kopf mit Stand.
  - Kacheln: Läufe ok/gescheitert, Berichte neu, Fehler im Tagesbereich, Dauer.
  - Zeitachse.
  - Laufkarten für Tagespipeline, Nacharbeit, OCR und Altbestand.
  - Wege der Berichte.
  - Protokoll.
- „Titel eingeordnet“ wird zu „Modell angewendet“. Dafür ist ein Backend-Wert nötig.
- Breite einheitlich.

**Abruf**
- Aufbau:
  - Kacheln.
  - Gebiete wählen (Karte und Liste).
  - Abrufen.
  - Laufender Auftrag als `JobLine`. Die Gebietsauswahl und „Abrufen“ wandern auf die Steuerung (Job „Abruf“, Gebiete per Link `?seite=steuerung&job=import&auswahl=…` übergeben). Auf der Abruf-Seite bleibt die Karte zum Ansehen mit „Diese Gebiete abrufen →“.
  - Läufe und Zeitachse im Protokoll.
- Weg:
  - Auftragsart „Einordnung nach Regeln“ (`analysis`) in der Oberfläche.
  - Kartenmodi `rules`, `summary` und `aiLabel`. Sie wandern auf Einordnungsmodell bzw. KI-Aufbereitung, falls dort eine Karte gewünscht ist.

**PDF-Import**
- Aufbau:
  - Kacheln.
  - Jetzt: zwei Bahnen als `JobLine` (Laden, OCR). Die Knöpfe „OCR starten“, „Übrige PDFs laden“, „Textebene lesen“, „erneut versuchen“ und „Stand neu zählen“ kommen auf die Steuerung.
  - Abschnitt „Bestand“ mit Umschalter Hauptdokumente / Übrige / Alle statt drei Kachelblöcken mit je 6 Kacheln.
  - Platz und Grenze.
  - Qualität („Ø Qualität“ nur hier).
  - Ablauf.
  - Protokoll.
- Fehler und Server nur als Kachel mit Link zu Fehler & Server. Den freien Platz nur als Kachel mit Link zu Speicher.
- Den langen Erklärabsatz `:126` in „Wie wird gezählt?“ verschieben.

**Einordnungsmodell (bisher Themen & Texte)**
- Reihenfolge:
  - Kopf ohne Knöpfe.
  - Kacheln: Berichte mit Modellantwort, Stand des Modells, letzter Lauf, offene.
  - `JobLine` des Jobs. „Jetzt erstellen“ und „Alle neu erstellen“ kommen auf die Steuerung.
  - Modell: Fragen mit Genauigkeit und Abdeckung. Die Erklärung „So arbeitet es“ steht zugeklappt.
  - Themen.
  - Regeln, die bleiben.
  - Zusammenfassung und Fakten.
- Kacheln „von der KI“ und „Güte“ an den Satzkopf anpassen.

**KI-Aufbereitung (bisher Verarbeitung)**
- Nur der KI-Teil: Kacheln (bereit, bearbeitet, mit KI-Text), Ergebnisliste und Filter.
- Eine Gebietsauswahl statt zwei.
- „Früherer KI-Auftrag“ bleibt zugeklappt am Ende, bis die Altaufträge leer sind.
- Nutzt `Page`/`useDashboard`.

**Altbestand**
- Kacheln ergänzen: offen je Stufe, alte Fehler.
- Die drei nummerierten Stufen bleiben, jede als `JobLine`. Das Formular für den Abruf, die Aufträge der Extraktion, der Schalter für OCR, die Knöpfe der Verarbeitung und „Alte Fehler erneut versuchen“ kommen auf die Steuerung (Gruppe Altbestand).
- Der Verarbeitungsschritt heißt „Modell anwenden + Regeln“.
- „Alte Fehler“ als Link zu Fehler & Server (Bereich Altbestand).

**Prüfliste**
- Kacheln.
- Abschnitt „Einordnung im Bestand“ mit Themenbalken und Verfahrensstand.
- Abschnitt „Prüfliste“ (Grund und Gebiet), am Ende „Was tun?“.
- Alle Zahlen zu „Titeltest“ und „Sachgebieten“ entfernen.
- Die KI-Quote einheitlich mit der KI-Aufbereitung definieren.

**Bestandsprüfung**
- Sprungleiste.
- Pflichtangaben.
- Prüfungen.
- Datenbank.
- Export mit beiden Formaten erklärt.
- Den Satz zu Push streichen.

**Steuerung (bisher Jobs & Zeitpläne)**
- Jobs nach `flow` gruppieren: Tagespipeline, Nacharbeit, Altbestand, Betrieb (backup, accounts, notify, betrieb, startseite-trends).
- Der Balken „Ablauf der Nacht“ zeigt nur die Pipeline.
- Den Text `:76` korrigieren.
- Jeder Job erscheint als `JobCard` mit allen seinen Knöpfen und Optionen. Ein Link „Ergebnis ansehen →“ führt auf die Fachseite.
- Oben steht „Läuft gerade“ (alle laufenden Jobs und Bahnen, Anhalten) und die Warteschlange.
- Die Jobbeschreibung „Themen & Texte“ in `schedules.mjs` auf das Modell bringen.

**Fehler & Server**
- Kacheln: Fehler im Tagesbereich, im Altbestand, wartende Server, Fehler im Code.
- Stand-Zeile.
- Der Rest bleibt.

**Speicher & Sicherungen**
- Bleibt so.
- Jobname „Sichern“ korrigieren.
- Legende mit weniger Grautönen bzw. Petrol- und Blauabstufungen.

**To-do-Liste:** bleibt.

**Hochrechnung**
- Sprungleiste über die zehn Schritte.
- Kacheln auf vier begrenzen.
- Die Schritte als `AdminSection`.
- Den Bezug „KI-Kosten“ prüfen: Gilt das noch, wenn die Aufbereitung über den Agentenablauf läuft?
- `admin-forecast.tsx` als Hülle entfernen.

**Social Media**
- Den Erklärabsatz zur Formel in „Wie wird gezählt?“ verschieben.
- Die Filter direkt unter die Kacheln.
- Den historischen Satz zu den Streitwörtern streichen.

### B5. Reihenfolge der Umsetzung (Vorschlag)
1. **Texte richtigstellen.** Nur Frontend und Texte, aus Teil A: Titelregel, Sachgebiet, Push, Wortliste, Jobtexte. Dazu kommen `schedules.mjs` und `pipeline-terms.mjs`, die Backend-Dateien sind. Dafür ist deine Freigabe nötig.
2. **Tote Exporte und Hüllen entfernen**, Formathelfer in `admin-format.ts` bündeln.
3. **Bausteine und Stil** (B2, B2a): `Befund`, `Kennzahlen`, `Laden`/`Leer`/`Fehler`, `ListRow`, `Reiter`/`Segmented`, `MethodikNote` übernehmen; dazu `AdminSection`, `JobCard`, `Notice`, `JumpNav` sowie die Stand-Zeile im Kopf. Danach die Seiten einzeln umstellen, zuerst die mit den meisten eigenen Teilen: Cockpit, Letzte Nacht, PDF, Altbestand, Jobs.
4. **Navigation:** Einordnungsmodell und KI-Aufbereitung, Doppeltes auf Links reduzieren.
5. **Backend-Werte** für „Modell angewendet“ (Letzte Nacht, Altbestand) sowie das Ende des ChatGPT-Altwegs, getrennt freigeben.

### Entscheidungen (23.10.2026)
- „Themen & Texte“ heißt künftig „Einordnungsmodell“ und bleibt in der Gruppe Qualität, dort an erster Stelle (Wunsch des Nutzers).
- „Verarbeitung“ wird zu „KI-Aufbereitung“ und zeigt nur noch den KI-Teil. Der Teil zu den Regeln fällt weg, weil er auf dem Einordnungsmodell schon steht.
- B1a: Möglichkeit A gilt. Alle manuellen Schalter liegen auf der Seite „Steuerung“ (bisher Jobs & Zeitpläne), alle anderen Seiten lesen nur. Der vollständige Export der Bestandsprüfung bleibt auf seiner Seite.
- Die ChatGPT-Anmeldung, der Cloudflare-Altweg und die Hochrechnung bleiben vorerst unverändert (Schritt 5 und der Hinweis zu den KI-Kosten ruhen).

### Stand der Umsetzung
- **Schritt 1 (23.10.2026) erledigt, nicht committet.** Geändert wurden:
  - die Hilfetexte zu Titelregel und Thema-Regeln, jetzt auf das Modell bezogen,
  - „Sachgebiet“ zu „Thema“,
  - der Satz zu Push gestrichen,
  - die Reihenfolge im Text der Jobs,
  - der Jobtext und die Schritte von „Einordnung, nachts“ (`schedules.mjs`),
  - der Schritt „Titel einordnen“, jetzt ohne Stufe und nur noch als Alias (`pipeline-terms.mjs`),
  - Altbestand mit „Modell anwenden“,
  - Jobname „Sichern“.
- **Bewusst offen geblieben:**
  - „Titel eingeordnet“ auf Letzte Nacht: Dafür ist ein Backend-Wert nötig, siehe Schritt 5.
  - Die Prüfung `ruleLabel` in `server/integrations/data-completeness.mjs` prüft noch `classification` (Titelregel). Sie muss im Backend auf das Modell umgestellt werden.
  - Die Texte zum „Titeltest“ bleiben, solange die Zahlen ihn noch enthalten.

- **Schritt 2 (23.10.2026), noch nicht committet.** Erledigt ist:
  - Die ungenutzten Texte aus `ZUSTAND`, `STATE_HELP` und `FILTER_HELP` sind entfernt.
  - Unnötige Exporte sind entfernt (`stepSentence`, `RunDebugView`, `BUCKET_COLOR`).
  - Die Hülle `admin-forecast.tsx` und die ungenutzten Props sind entfernt.
  - Die Formathelfer stehen in `components/admin-format.ts` (`n`, `nOr`, `pct`, `mio`, `gb`, `size`, `day`, `mm`, `when`, `clock`, `dur`).
  - „Themen & Texte“ heißt im Menü und auf der Seite „Einordnungsmodell“, Adresse unverändert `?seite=regeltexte`.
- **Kleine Änderungen in der Anzeige durch Schritt 2:**
  - Prozente werden mit höchstens einer Nachkommastelle angezeigt, nicht mehr fest („12 %“ statt „12,0 %“).
  - Das Cockpit rechnet Gigabyte wie die Seite Speicher mit Basis 1024.
  - Uhrzeiten stehen überall in Berliner Zeit.
  - Bei fehlendem Wert steht „–“ statt „—“.
- **Eigene Formate behalten:** Das Prozentformat in `admin-rule-texts.tsx` passt seine Nachkommastellen an. Die Hochrechnung hat ein eigenes Format für Anteile (`pct`) und für Speichergrößen (`bytes`).
- **Schritt 3, erster Teil (23.10.2026), noch nicht committet.**
  - Neue Bausteine in `admin-ui.tsx`:
    - `AdminPageHead` mit `figure` (schmales Band wie auf plenara.X),
    - `Befund`, `Zahlen`, `Abschnitt` (mit `open`, merkt sich offen oder zu je Betrachter),
    - `Aufklapp`, `Hinweis`, `Fehler`, `Leer`, `Laden`, `SteuernLink`.
  - Die Einleitung jeder Seite steht unten unter „Über diese Seite“.
  - Umgestellt sind:
    - Letzte Nacht, Cockpit („Muss ich etwas tun?“), Fehler & Server, Speicher & Sicherungen,
    - Steuerung (bisher Jobs & Zeitpläne; nach Ablauf gruppiert, darin die Aufträge von Altbestand und PDF-Ablage sowie „Alle neu erstellen“),
    - Altbestand und PDF-Import (lesen nur), Einordnungsmodell, Social Media, Abdeckung, Lückenatlas (Gründe in den Farben des Farbschemas), Prüfliste, Bestandsprüfung,
    - KI-Aufbereitung (bisher Verarbeitung, ohne Regel-Teil).
- **Schritt 3, zweiter Teil (23.10.2026):** erledigt ist auch der Rest.
  - **Abruf:** Die Seite liest nur. Gebiete wählen, abrufen, pausieren und beenden geht im Auftragsmodus `?seite=abruf&auftrag=1`, den die Steuerung öffnet; die Übergabe aus der Hochrechnung (`auswahl=…`) öffnet ihn ebenfalls. Die Kartenfarben zur Verarbeitung sind entfernt.
  - **Steuerung:** „Erneut versuchen“ und „Freigeben“ stehen unter Nacharbeit (`FehlerSteuern`), „Neu messen“ unter Betrieb (`SpeicherSteuern`). Fehler & Server und Speicher lesen nur.
  - **Hochrechnung und Mobilansicht** haben den neuen Aufbau. Die Mobilansicht zeigt dazu die Abdeckung der letzten 7 Tage und das Menü mit Symbolen.
  - **KI-Aufbereitung:** eine Gebietswahl („Welche Gebiete“, ohne Wahl ganz Deutschland).
  - **Abdeckung:** Das Monatsdiagramm ist eine Linie.
  - **Adresse:** Die Steuerung heißt `?seite=steuerung`; `zeitplaene` und `jobs` leiten weiter.
  - **Ausnahme von B1a:** „Neu berechnen“ der Hochrechnung und der Social-Media-Vorschläge bleibt auf der Seite. Beides rechnet nur die eigene Ansicht in Sekunden neu und startet keinen Job.
- **Reale Abdeckung (23.10.2026), noch nicht committet:** `activeCoverage` in `server/integrations/admin-coverage.mjs`.
  - Gezählt werden Gebiete mit mindestens einem gelungenen Abruf in den letzten 7 Tagen, aus `import_runs` (Lauf `metadata`, Status `completed` oder `partial`, mindestens eine Anfrage beantwortet).
  - Läufe mit `partial`, deren Anfragen alle mit 403 abgelehnt wurden, zählen nicht; das waren auf dem Server rund 1.100 am Tag.
  - Die Abdeckung zeigt dazu eine dritte Linie im Verlauf und eine Zahl, das Cockpit eine Zahl.
  - Server, Stand 23.10.: 2.851 von 4.041 angebundenen Gebieten, 74,2 % der Einwohner (angebunden 87,9 %).
- **Aufgeräumt (23.10.2026):**
  - Der Job „PDF-Aufträge und Messungen“ steht in der Steuerung unter Betrieb, dort auch die PDF-Bahnen, „Stand neu zählen“ und „Speicher messen“. Damit führen die Links von PDF-Import und Speicher an die richtige Stelle.
  - Unter Altbestand stehen „OCR des Altbestands“ (nur ältere Berichte, läuft bis Anhalten) und gleich darunter „OCR aller PDFs“ (einmal alle, egal wie alt), jeweils mit dem Unterschied im Text. Dort steht auch „Fehlgeschlagene PDFs erneut versuchen“.
  - Der Fehlerspeicher in der Steuerung zeigt nur den Tagesbereich; alte Fehler gibt es nur beim Altbestand.
  - Der Job „Verarbeitung, nachts“ heißt „Einordnung, nachts“ (Job-ID `rule-texts` unverändert), passend zur Seite „Einordnungsmodell“.
