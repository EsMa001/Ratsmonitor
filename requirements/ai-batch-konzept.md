# KI-Aufträge im großen Stil · Konzept und Prototyp

Stand 09.10.2026. Ziel: Aufträge mit vielen tausend Berichten (Beispiel: Auftrag `1c81957a…`, 27.322 Artikel, 81.966 Schritte) robust und mit möglichst wenigen Tokens abarbeiten, die eigentliche Auswertung mit Haiku. Der Vertrag aus `requirements/ai-processing.md` und die Prüfung in `shared/ai-job.mjs` bleiben unverändert; alles hier erzeugt Ergebnisdateien, die `node scripts/ai-job.mjs validate` besteht.

## Grundidee

Das Modell liest und schreibt nur, was nur ein Modell kann. Alles Mechanische macht ein Skript, einmal, deterministisch und fortsetzbar:

| Schritt | Wer | Was |
|---|---|---|
| 1. Abruf | `scripts/ai-batch/fetch.mjs` | jede Adresse einmal laden, Text extrahieren, Hash, Wortzahl, Cache auf Platte |
| 2. Vorprüfung | `pack.mjs` | Artikel ohne Inhaltsquelle oder ohne Sachtext regelbasiert melden, ohne Modell |
| 3. Lesepakete | `pack.mjs` | kompakter Lesetext mit Satzkennungen, Dubletten und Kopfzeilen entfernt, Budget je Quelle |
| 4. Auswertung | `run.mjs` → `claude -p` mit Haiku | je Paket ein frischer Aufruf ohne Werkzeuge; Antwort im Kurzformat, Belege nur als Kennungen |
| 5. Zusammenbau | `assemble.mjs` | Kurzformat → `ratsmonitor-ai-results-v1`, Zitate wörtlich aus dem Cache, Prüfung je Artikel mit `articleResult`, Dateien zu 100 Artikeln |
| 6. Übernahme | Admin oder `scripts/ai-job.mjs apply` | wie bisher |

Laufordner: `.local-backups/ai-runs/<jobId>/` mit `cache/`, `packets/`, `answers/`, `results/` (nicht im Repo).

## Die Hebel und was sie bringen (gemessen an einer Stichprobe von 52 Artikeln aus 13 Hosts)

1. **Vorprüfung ohne Modell.** Im ganzen Auftrag haben 13.362 Artikel (49 %) weder Vorlage noch Niederschrift noch TOP-Seite: sofort `insufficient_source`, kein Abruf, keine Tokens. 1.836 weitere haben nur eine TOP-Seite; in der Stichprobe stand dort immer nur der Titel (2 bis 26 Wörter). Dazu kommen Inhaltsartikel, deren Quellen leer sind (Bild-PDF, nur Titel). In der Stichprobe gingen 18 von 52 Artikeln so ab.
2. **Text statt Dokument.** Rohtext der Stichprobe: 251.000 Wörter, gezeigt nach Aufbereitung: 20.400 (−92 %). Dafür sorgen
   - Dubletten über Wortgruppen: Die SessionNet-Seite `vo0050` enthält den vollständigen Vorlagentext, die PDF „Vorlage“ denselben noch einmal. Gezeigt wird nur, was eine frühere Quelle desselben Artikels nicht schon hatte (70 % der Fünf-Wort-Gruppen bekannt = Wiederholung).
   - Kopf-, Fuß- und Bedienzeilen: ein Satz, der in mindestens drei verschiedenen Texten desselben Hosts steht, entfällt.
   - Budget: Hauptquelle bis 1.200 Wörter, jede weitere Quelle bis 300, Niederschrift/Sammeldokument nur der Abschnitt zum Titel (500), höchstens 1.800 je Artikel. Pläne, Gutachten und Haushaltsanlagen mit 5.000 bis 30.000 Wörtern kommen so mit ihrem Anfang vor.
   - Gemeinsame Quellen stehen im Paket nur einmal („Q3 (oben)“). Die Auftragsreihenfolge (Gebiet, Sitzung) bringt sie ins selbe Paket.
3. **Belege als Kennungen.** Jeder Satz trägt `[Quelle.Satz]`. Das Modell nennt nur Kennungen; Zitat, Auszug, Seite und Hash setzt der Zusammenbau wörtlich ein. Spart Ausgabetokens und macht erfundene oder veränderte Zitate unmöglich.
4. **Kurzformat der Antwort.** Eine JSON-Zeile je Artikel mit kurzen Feldnamen; Prüfungen als `[1,1,1,1]`. Etwa 770 Ausgabetokens je Artikel ohne Denken.
5. **Frischer, werkzeugloser Aufruf je Paket.** `claude -p --tools "" --strict-mcp-config --setting-sources "" --disable-slash-commands --no-session-persistence --system-prompt <prompt.md>` aus einem leeren Ordner außerhalb des Repos: Grundaufwand rund 800 Tokens statt Werkzeugbeschreibungen und CLAUDE.md. Kein wachsender Gesprächsverlauf, gemessener Verbrauch je Paket (`--output-format json`).

## Robustheit

- **Abruf:** Node `fetch` mit Projektkennung (`SOURCE_USER_AGENT`), keine Weiterleitung auf fremde Hosts, bis 60 MB, von langen PDFs die ersten 40 Seiten. Gedrosselt wird je **Plattform** (letzte zwei Namensteile, z. B. alle `*.komm.one`), nicht je Host: höchstens ein Abruf zur Zeit, 1 s Pause danach; 16 Plattformen parallel, die größten zuerst. Plattformen haben das Netz des Rechners nach Abrufspitzen schon stundenlang gesperrt. Deshalb pausiert eine Plattform nach fünf Netzfehlern oder Sperrantworten (403/429/503) in Folge für den Rest des Laufs; Netzfehler bleiben offen statt als Fehler gezählt zu werden. HTTP-Fehler und unlesbare Dateien kommen in den Cache und werden bis zu drei Läufe lang erneut versucht. Sperrdatei gegen Doppelstart, Zwischenstand in `fetch-status.json`. Der Cache liegt in Unterordnern (`cache/ab/abcd….json|.txt`).
- **Wächter:** Lange Node-Läufe brechen auf diesem Rechner gelegentlich ohne Meldung ab, Hintergrundaufgaben der App sterben mit ihr. Abruf und Modelllauf starten daher über `tmp/launch/ai-fetch.vbs` bzw. `tmp/launch/ai-run.vbs` (Explorer → unsichtbares PowerShell, außerhalb der App), die den Schritt bis zur Abschlusszeile `fertig:` wiederholen. Protokolle `tmp/ai-fetch.log`, `tmp/ai-run.log`; nie mit `tail -F` beobachten.
- **Modelllauf:** Zeitgrenze 20 min je Aufruf; ein Paket, das dreimal scheitert, wird übersprungen (`run-failures.json`) und seine Artikel kommen als Wiederholung. Rate- oder Kontingentgrenze: der Lauf hält sauber an (`fertig: … angehalten`), derselbe Starter setzt später fort. Kosten nach `scripts/ai-prices.json` (Haiku 5.5 eingetragen).
- **Wiederholung:** `assemble.mjs` schreibt Artikel ohne gültige Antwort nach `retry.json`; `pack.mjs --retry` baut daraus Pakete `R0001 …` mit höchstens zwei Artikeln und dem Prüfhinweis. Je Artikel zählt die erste gültige Antwort. Der Wächter macht höchstens zwei Wiederholungsrunden.
- **Antworten schützen:** `pack.mjs` baut Pakete, zu denen es schon Antworten gibt, nur mit `--force` neu und verschiebt die Antworten dann nach `answers-alt/`.
- **Umlaute:** PDF-Text über `unpdf` (wie die App). `pdftotext` unter Windows schreibt ohne `-enc UTF-8` Latin-1; das war die Ursache der „�“ im ersten Versuch, nicht die PDF.
- **App-Hüllen:** KIC/komuna (`/app/sitzungen/…`, 1.579 Inhaltsartikel) liefert die Seite leer; der Text kommt aus der öffentlichen Gastschnittstelle (`web/guestagendaitems/<id>`, Textblöcke Base64-HTML). Adapter eingebaut, Text bleibt der Seitenadresse zugeordnet. SessionNet 6 (`/sitzungen/<id>#top-…`, 138 Artikel) hat noch keinen Adapter: solche Artikel bleiben **offen** (`skipped.json`), nicht `insufficient_source` – ein Werkzeugmangel darf den Artikel nicht bis zur nächsten Quelländerung sperren.
- **Zusammenbau prüft streng:** jede Kennung muss zu einer Quelle des Artikels gehören, jeder Artikel läuft durch `articleResult`. Zusätzlich Hinweise: Zahlen in der Zusammenfassung, die im gezeigten Text nicht vorkommen; Beschlussformulierungen, obwohl die Beratungsfolge kein Ergebnis hat. Fehler und fehlende Antworten landen in `results/report.json` und werden als kleines Wiederholungspaket erneut geschickt.
- **Fehlschläge zählen richtig:** nicht abrufbar → `failed` (ein zweiter Versuch ist laut Vertrag erlaubt), kein Sachtext → `insufficient_source`, Adapter fehlt → keine Antwort.

## Modellwahl (gemessen am selben Paket mit drei Bebauungsplan- und Haushaltsvorlagen)

| | Haiku 5.5, Aufwand `low` | Haiku 5.5, Standard | Haiku 4.5 ohne Denken |
|---|---|---|---|
| Ausgabe gesamt | 26.394 (davon 22.669 Denken) | 58.210 (54.284 Denken) | 2.421 |
| Kosten zu Listenpreisen* | ≈ 0,016 USD | ≈ 0,032 USD | ≈ 0,053 USD |
| Dauer | 101 s | 215 s | 27 s |
| Inhalt | korrekt getrennt: „Die Vorlage schlägt vor … ein Beschluss liegt nicht vor“ | – | erfindet „Der Bauausschuss billigt den Entwurf und beschließt …“; 2 von 3 Antworten kein gültiges JSON |

\* Haiku 5.5: 0,10 USD je Mio. Eingabe, 0,50 USD je Mio. Ausgabe; Haiku 4.5: 1 / 5 USD. Die CLI rechnet Haiku 5.5 noch mit falschem Preis („costBasis unknown“) und meldet zu hohe Beträge; `scripts/ai-prices.json` hat keinen Haiku-Eintrag.

Empfehlung: **Haiku 5.5 mit `--effort low`**. Denken lässt sich über die CLI nicht abschalten (`MAX_THINKING_TOKENS=0` und `alwaysThinkingEnabled:false` wirken nicht), kostet aber bei Haiku-5.5-Preisen weniger als Haiku 4.5 ohne Denken. Bei Abrechnung über ein Abo zählen die Denktokens gegen das Kontingent; dann ist die Paketgröße der wichtigste Regler.

**Paketgröße:** Ein Paket mit 15 Artikeln (12.000 Wörter) ließ Haiku 5.5 über 130.000 Tokens denken und nur einen Artikel beantworten. Kleine Pakete (rund 4.000 Wörter, höchstens 6 Artikel) liefen vollständig. Messwerte des Laufs über alle Pakete der Stichprobe: siehe unten.

## Messwerte Stichprobe

52 Artikel aus 13 Hosts, 136 Adressen in 66 s geladen (1 × HTTP 403). Vorprüfung: 18 Artikel ohne Modell, 3 offen (SessionNet 6), 31 an Haiku 5.5 (`--effort low`) in 6 Paketen zu höchstens 6 Artikeln / 4.000 Wörtern. Alle 31 beantwortet, alle 49 Artikel bestehen `articleResult` und `node scripts/ai-job.mjs validate`.

| je Artikel (Modell) | Wert |
|---|---|
| Eingabe | 3.700 Token |
| Ausgabe | 4.200 Token, davon 3.100 Denken |
| Dauer | 16 s (Paket 50 bis 124 s) |
| Kosten zu Listenpreisen | **0,0028 USD** (0,28 Cent); 75 % davon Denken |

Gefundene und behobene Fehler im Lauf: Kennungen im Fließtext der Zusammenfassung („… [14.3]“) und Sätze über den Auszug statt über die Sache. Beides steht jetzt in der Anweisung; der Zusammenbau entfernt Kennungen aus dem Text und übernimmt sie als Belege. Restliche Hinweise: Daten, die nur in einer nicht gezeigten Stelle stehen (Stichprobe prüfen).

## Hochrechnung für den Beispielauftrag

| | Artikel | Abrufe | Modell |
|---|---|---|---|
| ohne Inhaltsquelle und ohne TOP-Seite | 13.362 | 0 | 0 |
| nur TOP-Seite (fast immer nur Titel) | 1.836 | 1.836 | fast 0 |
| mit Inhaltsquelle | 12.124 | ≈ 31.600 + TOP-Seiten | ≈ 74 % → ≈ 9.000 |

- Abruf: ≈ 34.500 Adressen, bei 12 Hosts parallel und 1 s Pause je Host einige Stunden; der größte Host (`sessionnet.owl-it.de`) bestimmt die Dauer.
- Modell: ≈ 9.000 Artikel × 0,0028 USD ≈ **25 USD** zu Listenpreisen; ≈ 33 Mio. Eingabe- und 38 Mio. Ausgabetokens. Rechenzeit ≈ 40 h nacheinander, mit 4 bis 8 parallelen Aufrufen 5 bis 10 h, soweit die Kontingente es zulassen.
- Zum Vergleich ohne Aufbereitung: die Stichprobe hatte Ø 4.800 Wörter Rohtext je Artikel statt Ø 650 gezeigter.

## Offene Entscheidungen

1. **Herkunft der Vorprüfung.** Regelbasierte Meldungen tragen `agent: "regelbasierte Vorprüfung (scripts/ai-batch)"`, `model: "keines"`. Der Validator nimmt das an; die Methode heißt trotzdem `ai-agent-content-v1`. Alternative: diese Artikel gar nicht beantworten und den Auftrag danach verwerfen. Dann kommen sie beim nächsten Auftrag wieder.
2. **Bild-PDFs.** Ohne Textschicht → `insufficient_source`. Eine OCR-Stufe (tesseract.js liegt in `~/code/video-tools`) könnte sie retten; der Artikel ist dann über „erneut versuchen“ wieder wählbar.
3. **SessionNet-6-Adapter** (138 Artikel) nach dem Muster von KIC.
4. **Gelesener Text und Hash.** Hash und Wortzahl beziehen sich auf den ganzen extrahierten Text; das Modell sieht davon die gekürzte Auswahl. `words` je Quelle ist die gezeigte Wortzahl (für die Kostenauswertung).
5. **Stichprobe zur Freigabe:** je 200 Artikel einige mit einem stärkeren Modell oder von Hand gegenlesen, vor allem Artikel mit Hinweisen aus dem Zusammenbau.

## Ablauf für den echten Lauf

Stufe 1, ohne Modell: Quellen laden und vorprüfen.

```powershell
Start-Process explorer.exe -ArgumentList 'C:\Git\vor-ort-quellcode\tmp\launch\ai-fetch.vbs'   # fetch.mjs --all im Wächter
node scripts/ai-batch/fetch.mjs .local-backups/ai-runs/auftrag.json --all                      # Nachlauf für Fehler und Netzfehler
node scripts/ai-batch/pack.mjs .local-backups/ai-runs/auftrag.json --all --force               # Vorprüfung + Pakete, Bericht vorpruefung.json
node scripts/ai-batch/assemble.mjs .local-backups/ai-runs/auftrag.json                          # Ergebnisdateien der Vorprüfung
```

Stufe 2: Stopp, Bericht prüfen, entscheiden.

Stufe 3, Haiku 5.5 mit Aufwand „low“: `Start-Process explorer.exe -ArgumentList 'C:\Git\vor-ort-quellcode\tmp\launch\ai-run.vbs'` (run.mjs → assemble.mjs → bis zu zwei Wiederholungsrunden). Danach jede Ergebnisdatei mit `node scripts/ai-job.mjs validate …` prüfen und im Adminbereich übernehmen.

Noch offen: Prüfung der Hinweise vor der Übernahme (Stichprobe), SessionNet-6-Adapter, OCR für Bild-PDFs.
