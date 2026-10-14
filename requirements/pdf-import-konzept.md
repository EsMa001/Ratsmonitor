# PDF-Import: Befunde und Konzept (14.10.2026)

Grundlage: Stand der Ablage auf dem Server (`pdf-store-stats` vom 13.10.2026, Index `pdf-store/index.sqlite`), Probeabrufe
vom Server und von einem Rechner im deutschen Heimnetz mit derselben Projektkennung, Code `scripts/pdf-store/`,
`server/node/pdf-store.mjs`. Nur gelesen, nichts geändert.

## Ausgangslage

| | Hauptdokumente | übrige PDFs |
|---|---|---|
| mit Berichten verknüpft | 536.380 | 683.342 |
| als PDF in der Ablage | 379.658 (71 %) | 7.818 |
| nur als Text | 10.171 | 300.018 |
| gescheitert (nie wieder versucht) | 53.854 (10 %) | 11.429 |
| offen | 92.697, davon 79.909 auf gesperrten Servern | 364.077, davon 152.944 auf gesperrten Servern |

- Ablage voll: 80 GB Grenze, 85,9 GB belegt (PDFs 78,4 GB, Texte 7,5 GB). Jedes neue Hauptdokument verdrängt ein schlechteres.
- Texte: 386.410 Hauptdokumente vollständig lesbar (72 % der verknüpften).
- OCR offen: 31.014 Dateien mit 202.326 Seiten; auf dem Server (tesseract.js, 2 Worker) zuletzt rund 2 Seiten je Minute.
- Server: 1.709, davon 703 ausgelassen (mindestens 10 Abrufe, mindestens 90 % gescheitert).
- Gründe der Fehlschläge (Hauptdokumente): kein Zugriff 401/403 20.951, nicht gefunden 404/410 16.425, kein PDF 8.844,
  Zeitüberschreitung 7.074, übrige unter 600.
- In der Administration ausgeschaltet seit 12.10.: Import, nächtlicher Import, PDF-Nachtkette.

## Befunde

**B1. Ein großer Teil der Server sperrt die Adresse des Rechenzentrums.** Probe mit derselben Projektkennung:
`rim.ekom21.de` (10.744 offene Hauptdokumente), `piwi.wiesbaden.de` (5.555), `ratsinfo-online.de` (4.081) antworten dem
Server auch nach 90 s nicht (kein einziges Byte), aus einem Heimnetz in unter 1 s (Wiesbaden liefert das PDF).
`emsdetten.ratsinfomanagement.net` liefert dem Server 403 mit einer Bot-Abwehrseite („challenge“), dem Heimnetz 200.
Betroffen sind unter den 100 größten Servern 12 mit „Zeitüberschreitung“ (30.377 offen) und 54 mit „kein Zugriff“
(55.604 offen), zusammen rund 86.000 Hauptdokumente (16 % aller verknüpften). Der Server läuft bei Hostinger
(AS47583); Rechenzentrumsadressen werden von Behörden-IT (ekom21, CC e-gov/ratsinfomanagement, ris-portal,
digitalfabrix) offenbar pauschal abgewiesen.

**B2. Eine Zeitüberschreitung sperrt die Datei für immer.** Jeder Fehlschlag wird vermerkt und nie wieder versucht
(`--retry-days` unendlich), auch wenn der Server nur einmal langsam war: 291 Server, die sonst liefern, haben 1.745
solche Dateien.

**B3. Nicht öffentliche Dokumente zählen als „kein PDF“.** `…/do027.asp?DOLFDNR=…&options=64` (sitzung-online,
ratsinfo-online) leitet ohne Anmeldung auf `noauth.asp` weiter. Diese Dokumente sind nicht öffentlich, kein Fehler
der Ablage, werden aber als gescheitert gezählt und halten Server in der Sperrliste (Würzburg 696, Amt Eidertal 645,
Südangeln 571 …).

**B4. KIC-RIS (komuna) liefert über die Download-Adresse die App-Hülle.** `ris.komuna.net/<ort>/app/download?url=…`
gibt HTML zurück (1.260 Dateien). Für die Sachtexte gibt es schon einen Weg über die öffentliche Gastschnittstelle
(`kicText` in `scripts/ai-batch/lib.mjs`); für Dateien fehlt er.

**B5. 404 sind echt.** Vom Heimnetz wie vom Server 404 (Stichprobe mittelholstein). Nicht wiederholen.

**B6. Übrige PDFs werden geladen, aber nicht behalten.** Sie stehen immer unter allen Hauptdokumenten; bei voller
Ablage bleibt praktisch nur der Text (300.018 nur Text, 1.782 als PDF). Jeder Lauf beginnt beim neuesten Monat und
läuft rückwärts, bis die Zeit um ist; ältere Monate kommen selten dran. Die Zahl „neu zu laden“ besteht vor allem aus
Servern, die frühere Läufe für den Monat aufgegeben hatten (3 Fehler in Folge).

**B7. Die OCR auf dem Server ist zu langsam für den Rückstand.** 202.326 Seiten bei rund 2 Seiten je Minute wären
Monate Dauerbetrieb. Reihenfolge heute: wenigste Seiten zuerst, nicht nach Bedeutung.

**B8. Anzeige.** Fehler übriger PDFs zählten als Fehler bei Hauptdokumenten (behoben in `defce906e62e`, noch nicht
ausgerollt). Fehlschläge haben keinen Sitzungsmonat, die Fehler je Monat sind deshalb nicht auswertbar.

## Vorschläge, nach Wirkung

**P1. Gesperrte Rechenzentrumsadresse: Betreiber fragen, nicht umgehen.** Die Sperren (Bot-Abwehr, stilles Verwerfen)
sind Absicht der Betreiber. Ein Abruf über eine andere Leitung (Heimnetz, fremde Adressen) wäre technisch leicht,
umginge aber genau diese Abwehr; das sollte Plenara nur mit Zustimmung des Betreibers tun.
- Betreiber anschreiben (ekom21, Stadt Wiesbaden, CC e-gov für ratsinfomanagement.net, ris-portal, digitalfabrix,
  ratsinfo-online): Projektkennung, Zweck, Abrufrate, Bitte um Freigabe der Serveradresse oder um einen
  Schnittstellenzugang. Liste der Server mit offenen Dokumenten erzeugt der Stand schon (`hosts.top`).
- Bis dahin eigener Zustand „vom Server nicht erreichbar“ je Server (statt Fehler je Datei): Dateien bleiben offen,
  kein Fehlervermerk, eigene Zeile im Reiter PDF-Import mit Zahl der Dokumente; einmal je Woche eine Probeanfrage je
  Server, ob die Sperre noch gilt.
- Wirkung bei Freigabe: bis zu 86.000 Hauptdokumente (+16 Prozentpunkte Abdeckung).

**P2. Zeitüberschreitung nicht dauerhaft.** Zeitüberschreitung und Verbindungsfehler als „vorläufig“ vermerken: neuer
Versuch nach 7 Tagen, höchstens 3 Versuche, danach endgültig. 404/410, „kein PDF“ und „zu groß“ bleiben endgültig.
Wirkung: 1.745 Dateien auf erreichbaren Servern, künftige Ausreißer.

**P3. Nicht öffentlich erkennen.** Weiterleitung auf eine Anmelde- oder `noauth`-Seite als eigener Zustand „nicht
öffentlich“, nicht als Fehler; zählt weder als gescheitert noch als offen, hält keinen Server in der Sperrliste. Danach
fallen Server wie Würzburg aus der Sperre, ihre öffentlichen Dokumente werden wieder versucht. Prüfen, ob der Import
solche Dokumente überhaupt als öffentlich führen sollte.

**P4. KIC-Dateien über die Gastschnittstelle.** Download-Adressen `app/download?url=…` in die Dateiadresse der
Gastschnittstelle übersetzen (wie `kicText`). Wirkung: 1.260 Dateien, alle KIC-Orte künftig.

**P5. Übrige PDFs als reiner Textlauf, mit Fortsetzung.** Laden, Textebene lesen, PDF sofort verwerfen (nie gegen die
80 GB rechnen); Scans für die OCR vormerken, PDF bei Bedarf kurz nachladen (wie heute bei verdrängten Dateien).
Statt immer beim neuesten Monat zu beginnen, merkt sich der Lauf, bis wohin er kam, und setzt dort fort; die neuesten
Monate holt die Nachtkette mit. Einfacher, berechenbar, keine Tauscharbeit.

**P6. OCR nach Bedeutung und auf dem Mac.** Reihenfolge: Hauptdokumente vor übrigen, Sachpunkte vor Formalien, neue
Sitzungen vor alten, innerhalb davon wenige Seiten zuerst. Schwere OCR (Apple Vision) auf dem Mac (Arbeit der
OCR-Sitzung: `ocr-mac.mjs`, `ocr-import.mjs`), der Server nur noch für einzelne neue Hauptdokumente.

**P7. Betrieb.** Import und PDF-Nachtkette wieder einschalten, sobald gewünscht; die Nachtkette stößt jetzt „Themen &
Texte“ selbst an. Fehlschläge mit Sitzungsmonat und Rolle vermerken (Rolle erledigt), Kennzahl „öffentlich und vom
Server erreichbar“ getrennt von „gesperrt“ und „nicht öffentlich“ zeigen.

## Reihenfolge der Umsetzung

1. P2 und P3 (klein, nur `fetch.mjs`/`pdf-store.mjs`, sofort wirksam, keine Entscheidung nötig).
2. P1 Zustand „vom Server nicht erreichbar“ und Server-Liste für die Anfrage an die Betreiber; die Anfrage selbst
   verschickt Nico.
3. P4 KIC-Adapter.
4. P5 Textlauf für übrige PDFs.
5. P6 OCR-Reihenfolge; Mac-OCR mit der OCR-Sitzung abstimmen.

## Entscheidungen (14.10.2026)

- P2, P3 und ein wöchentlicher neuer Versuch bei ausgelassenen Servern waren umgesetzt (`eb2512d`), wurden aber nicht
  ausgerollt und auf Nicos Wunsch zurückgenommen. Fehlschläge bleiben endgültig, ausgelassene Server ausgelassen.
- P5: übrige PDFs nicht grundsätzlich nur als Text; sie bleiben nach ihrem Wert als PDF (Score), dass derzeit kaum welche
  bleiben, ist in Ordnung.
- P6: OCR für alle PDFs, die sie brauchen, auch übrige; Ziel: möglichst alle PDFs einmal gelesen und als Text abgelegt.
- Offen: P1 (Betreiber fragen), P4 (KIC-Dateien), Fortsetzen statt Neubeginn beim neuesten Monat.
