# Konzept: Anbindung aller offenen Gebiete

Stand 04.10.2026. Dieses Dokument ist eine Entscheidungsvorlage. Außer dem Website-Leser, den der Projektinhaber ausdrücklich beauftragt hat (gebaut, Commit 156fb53), wird nichts umgesetzt, bevor der Inhaber freigibt.

Grundlage: Analyse der 3.232 offenen Gebiete in sechs Problemgruppen mit Vollständigkeitsprüfung (sie gilt, wo sie Gruppenangaben korrigiert), Grundauszählung, Hebel je Betreiber, README.md („Bundesweiter Abruf“, „robots.txt (Entscheidung offen)“), `scripts/source-discovery/README.md`. Einwohner meint die Gemeindeebene ohne Kreise. „≈“ und Spannen sind Schätzungen. Fundstellen nennen Funktionen statt Zeilen, weil der Website-Leser `build.mjs` und `verify.mjs` gegenüber Commit 5d0ef62 verschoben hat.

## 1. Kurzfassung

Von 5.324 Gebieten sind 2.092 angebunden; sie decken 57,9 % der Einwohner. Offen sind 3.232 Gebiete mit 35,1 Mio. Einwohnern, darunter 72 Kreise. Ohne Dritte lassen sich ≈56 Gebiete sofort und ≈330–510 nach Codeänderungen anbinden; das ergibt ≈65–67 %. ≈1.660–1.760 Gebiete hängen an Betreibern oder Kommunen; in zwölf Monaten sind ≈220–270 davon zu erwarten (≈69 %). Über 70–80 % entscheiden zwei Binärblöcke: regisafe/komuna (4,7 Mio.) und Berlin/Hamburg (5,6 Mio.). ≈720 Gebiete haben vermutlich kein Ratsinformationssystem (RIS); ihr positiver Weg ist der Website-Leser, dessen Ertrag erst der erste Messlauf zeigt. Vor allen neuen Anfragen bringt Welle 0 die Freigaben ein, die dem Inhaber schon vorliegen. Eine Freigabe hebt eine robots-Sperre auf, eine Sperre per HTTP 403 nicht; dort muss die Kommune ihren Betreiber beauftragen. Vorbedingung für jede Zahl nach außen ist ein korrigierter Bericht. 602 angebundene Quellen mit 16,5 Mio. Einwohnern liegen hinter einem robots-Verbot; empfohlen wird Option (c) mit einer Frist von sechs Monaten und Rechtsauskunft vor dem Scharfschalten. „Vollständig“ heißt: Jedes Gebiet hat einen belegten Endzustand mit Datum. Aufwand ≈45–60 Personentage (PT) in sechs Monaten, ohne Hosting-Phasen und ohne Leser nach Zusagen.

| Kennzahl | Gebiete | Einwohner | Abdeckung (kumuliert) |
|---|---:|---:|---:|
| heute angebunden | 2.092 von 5.324 | 48.339.597 von 83.447.764 | 57,9 % |
| offen | 3.232 | 35.108.359 | |
| Klasse 1 sofort | ≈56 | ≈1,5 Mio. + ≈10 Kreise | |
| Klasse 2 nach Code | ≈330–510 | ≈4,5–6,5 Mio. | ≈65–67 % |
| Klasse 3 Dritte, adressierbar | ≈1.660–1.760 | ≈23–24 Mio. | |
| davon erwartet (12 Monate) | ≈220–270 | ≈2,5–3,5 Mio. | ≈69 % |
| davon binär | 659 Katalog-Gebiete (657 + Berlin, Hamburg; nach Katalogumbau 676) | ≈10,3–10,4 Mio. | 70–80 % |
| Klasse 4 vermutlich kein RIS | ≈720 | ≈2,3–3,5 Mio. | |
| ohne Endzustand | ≈190–470 | | |
| Welle 0 | Platzhalter (6.6) | Platzhalter | |
| Website-Leser (nach Messlauf) | Platzhalter W, Klasse 4 und gesperrte RIS getrennt (7.2) | Platzhalter | |

## 2. Ausgangslage

### 2.1 Kategorien

| Kat. | Gebiete | Einwohner | Kreise (Kreiseinw.) | Teilgruppen |
|---|---:|---:|---|---|
| A kein Link | 1.631 | 11.793.322 | 19 (3,07 Mio.) | – |
| B robots | 702 | 5.345.388 | 7 (1,28 Mio.) | RIS-Portal 386, komuna 289, sonstige 27 |
| C 403/Firewall | 497 | 6.203.914 | 22 (4,71 Mio.) | ratsinfomanagement.net 252, Kommune aktiv 136, ekom21 55, Zugriffsprüfung 14, sonstige 40 |
| D System, kein Leser | 227 | 3.390.712 | 14 (2,54 Mio.) | ALLRIS 3 78, unbekannt 149 |
| E Lesen scheiterte | 128 | 2.498.221 | 10 (2,66 Mio.) | SD.NET erwähnt 17, gescheitert 111 |
| F geteilt/unklar | 43 | 284.897 | 0 | mitbenutzt 14, unklar 29 |
| G Stadtstaat | 2 | 5.570.050 | 0 | Berlin, Hamburg |
| H Demo-Mandant | 2 | 21.855 | 0 | |
| **Summe** | **3.232** | **35.108.359** | **72 (14,26 Mio.)** | |

### 2.2 Länder

| Land | offen / gesamt | Einwohner offen (Anteil) |
|---|---:|---:|
| 01 Schleswig-Holstein | 97 / 180 | 1.394.005 (47 %) |
| 02 Hamburg | 1 / 1 | 1.869.473 (100 %) |
| 03 Niedersachsen | 173 / 440 | 3.605.769 (45 %) |
| 04 Bremen | 1 / 2 | 588.413 (83 %) |
| 05 Nordrhein-Westfalen | 94 / 427 | 2.545.452 (14 %) |
| 06 Hessen | 316 / 442 | 3.793.175 (60 %) |
| 07 Rheinland-Pfalz | 42 / 194 | 661.652 (16 %) |
| 08 Baden-Württemberg | 780 / 1.136 | 4.475.151 (40 %) |
| 09 Bayern | 1.060 / 1.456 | 6.729.126 (51 %) |
| 10 Saarland | 24 / 58 | 280.375 (28 %) |
| 11 Berlin | 1 / 1 | 3.700.577 (100 %) |
| 12 Brandenburg | 138 / 207 | 1.483.541 (58 %) |
| 13 Mecklenburg-Vorpommern | 70 / 122 | 708.991 (45 %) |
| 14 Sachsen | 205 / 319 | 1.397.286 (35 %) |
| 15 Sachsen-Anhalt | 59 / 133 | 549.866 (26 %) |
| 16 Thüringen | 171 / 206 | 1.325.507 (64 %) |

### 2.3 Hebel je Betreiber

| Betreiber | offen (Kreise) | Einwohner offen | angebunden (davon robots verboten) | Einwohner verboten |
|---|---:|---:|---:|---:|
| Sternberg (SD.NET RIM) | 286¹ | 3.890.480 | 217 (109)² | 3.720.013² |
| owl-it/krz (SessionNet) | 6 (1) | 50.655 | 232 (230) | 5.379.898 |
| CC e-gov (ALLRIS) | 113 (6) | 1.631.905 | 208 (207)³ | 3.764.954³ |
| regisafe (RIS-Portal) | 376 (5) | 2.754.437 | 0 | 0 |
| komuna GmbH (komuna.RIS) | 287 (0) | 1.951.852 | 0 | 0 |
| Kommune aktiv | 136 (0) | 722.006 | 0 | 0 |
| ekom21 | 56 (4) | 642.720 | 22 (0) | 0 |
| hannit | 2 (1) | 522.803 | 0 | 0 |
| Somacos/More! Rubin | 15 (2) | 144.937 | 280 (0) | 0 |
| digitalfabrix | 8 (0) | 50.535 | 228 (3) | 12.776 |
| PortUNA.ris (ratsinformationsdienst.de)⁴ | 11 (1) | 56.664 | 0 | 0 |
| kdgoe, sitzung-mv, itebo, komm.one, KISA | 20 (1) | 167.521 | 305 (0) | 0 |
| ohne Großbetreiber | 239 | 4.145.772 | | |

¹ Es gilt **286**: alle offenen Gebiete auf ratsinfomanagement.net (Domaintabelle). operators.txt zählt 329 (18 Kreise, 4.900.447), weil sein Muster `^ratsinfo\.` jeden Rechner `ratsinfo.<ort>.de` erfasst, auch Systeme anderer Hersteller; von den 43 zusätzlichen sind nur 6 belegte SD.NET-Eigendomains (5 + `sd.odenwaldkreis.de`), die übrigen sind keinem Betreiber zugeordnet. Weitere Zählungen der Gruppen: 254 (nur B/C), 257 (Maximum C6).

² Durch dasselbe Muster überzeichnet. Belegt (B9): 25 OParl-Quellen auf ratsinfomanagement.net (510.441) und bis zu 51 SD.NET-Seitenleser auf eigenen Rechnern, zusammen ≈3,35 Mio.

³ Es gilt 207 / 3.764.954 (B8: sitzung-online.de 184, allris.cloud 22, sitzung-online.com 1), passend zur Summe 602 in 4.3; operators.txt zählt 206 / 3.745.451 (andere Domainabgrenzung).

⁴ Mit VG Asbach und Meckesheim 13 Gebiete, Gemeindeebene 85.761 (C10); so in Abschnitt 8.

Korrekturen: **komuna:** Eine AKDB-Beteiligung ist unbelegt; Adressat ist die komuna GmbH. **regisafe/komuna:** nach Berichtskorrektur 371 bzw. 286. **hannit:** Nur die Region Hannover ist ein hannit-Fall; die Stadt nutzt ein eigenes System (SIM). **CC e-gov:** Nur 9 der 113 sind reine B/C-Fälle; der Rest braucht Code und Freigabe.

### 2.4 Warum der heutige Bericht teils falsch zählt

- **A ist überzeichnet.** `reason()` in `build.mjs` gibt jedem Gebiet ohne Prüfdatensatz „kein Link“, übernimmt aus der Websuche nur akzeptierte Zeilen und nimmt Adressen nur aus `candidates.json`. Frankfurt, Bremen und fünf gesperrte Kreise stehen deshalb in A.
- **Plattformvorrang in B.** `PLATFORMS` greift, sobald irgendein geprüfter Link auf RIS-Portal oder komuna zeigt; 18 Gebiete sind falsch zugeordnet.
- **ALLRIS-3-Text veraltet.** 77 Gebiete melden „kein Leser“, obwohl `allris3` seit dem vierten Durchgang liest; viele D/E-Prüfungen sind älter als die heutigen Regeln.
- **C:** Bei 6 Gebieten steht „OParl nicht aktiviert“, ohne dass die OParl-Adresse gefragt wurde.
- **22 Gebiete ohne Berichtszeile** (zweimal „Gemeinde Altdorf“, VG Altenstadt u. a.) zählen in den 3.232, stehen aber in keinem Bericht.
- Alle Adressatenlisten der Gruppen stammen aus den unkorrigierten Listen und werden neu gezogen.

## 3. Was „vollständig“ heißt

Vollständig ist die Anbindung, wenn jedes Gebiet einen belegten Endzustand mit Datum hat.

| Endzustand | Nachweis | Zustand (Statusmodell) | Wiedervorlage |
|---|---|---|---|
| 1 angebunden über RIS | Leser liefert öffentliche Tagesordnungspunkte (TOPs) | `angebunden` | wöchentliche Abrufkontrolle |
| 2 angebunden über Website-Leser | Leser `website` liefert öffentliche TOPs, nennt das Gebiet | `angebunden`, Quellenart Website, getrennt gezählt | wie 1 |
| 3 System vorhanden, Abruf nicht erlaubt bzw. verweigert | Adresse, Sperrart, Datum von Anfrage und Antwort | `gesperrt-robots`, `gesperrt-403`, `abgelehnt`, `freigabe-erteilt-betreiber-offen`, `leser-fehlt` | 12 Monate; Signale vierteljährlich, bei Freigabe wöchentlich |
| 4 Website sperrt Programme bzw. keine Website bekannt | Protokoll HTTP 403/503; Wikidata und OpenStreetMap ohne Website | `kein-link-website-gesperrt`, `keine-website` | halbjährlich |
| 5 vermutlich kein RIS | alle Suchstufen ohne Treffer (Abschnitt 10) | `kein-ris-vermutet` | halbjährlich |

Zwischenzustände (`kein-link`, `lesen-gescheitert`, `system-unbekannt`, `zuordnung-unklar`, `katalog-fehlt`, laufende Anfragen) sind kein Endzustand. Kennzahl ist der Anteil der Gebiete mit Endzustand.

## 4. Reichweite und Abdeckungspfad

### 4.1 Entdoppelte Bilanz

Jedes Gebiet steht in genau einer Klasse. Die Summe der Gebietsangaben aller Maßnahmen (über 8.000) ist wegen Mehrfachnennung unbrauchbar.

| Klasse | Inhalt | Gebiete | Einwohner |
|---|---|---:|---:|
| 1 sofort maschinell | A2 (7 Kreise, Chemnitz, Salzgitter), B1 Illertissen, C3 (3 von 9), DE4/DE9/DE11/DE12 (43) | ≈56 | ≈1,5 Mio. + ≈10 Kreise |
| 2 nach Codeänderung | A-Trichter ≈290–440 (A3–A9, A13 Bremen, A14), C2/C4 7, DE ≈10–40, FG 21 | ≈330–510 | ≈4,5–6,5 Mio. |
| 3 Zustimmung Dritter | A 350–450 nach Fund, Frankfurt, 5 Kreise; B 682; C 487; DE 127; FG7 15; Berlin/Hamburg | ≈1.660–1.760 | ≈23–24 Mio. + ≈43 Kreise (≈9,5 Mio.) |
| davon erwartet | A11 ≈60, B ≈25, C 100–150, DE ≈30, FG7 ≈5 | ≈220–270 | ≈2,5–3,5 Mio. |
| davon binär | regisafe/komuna 657 (371 + 286), Berlin und Hamburg als 2 Katalog-Gebiete (nach Katalogumbau 19 Bezirke, dann 676) | 659 | ≈10,3–10,4 Mio. |
| 4 vermutlich kein RIS | A18 ≈650, DE24/DE25 ≈60, FG5 4, B10 ≈8 | ≈720 | ≈2,3–3,5 Mio. |
| 5 Entscheidung nötig | keine eigenen Gebiete (robots, Bezirke, Suchwege, Leser-Schwelle) | – | – |
| Rest | rechnerisch 3.232 − Klassen 1–4; benannt: A 81–281 (Website sperrt, keine Website), D/E ≈100, 7 Fehlzuordnungen (≈47.000), ≈10 Kreise (≈2,3 Mio. Kreiseinw.) = ≈198–398; der Rest der Obergrenze ist Schätzunschärfe der Klassen 2 und 3 | ≈190–470 | – |

Die benannten Restteile haben Maßnahmen: die 7 Fehlzuordnungen im Patch V2, die ≈10 Kreise in P1 (7.1), A 81–281 über Website-Leser und A9, sonst Endzustand 4.

Der Meilenstein der Gruppe H („65,4 % in 8 Wochen, alle D/E/F lesbar“) ist nicht haltbar: Ohne Dritte sind in D/E/F ≈70–100 Gebiete mit 1–1,5 Mio. erreichbar, nicht 400 mit 6,2 Mio.

### 4.2 Abdeckungspfad

Ein Prozentpunkt sind 834.478 Einwohner.

| Stufe | Abdeckung | Bedingung |
|---|---:|---|
| heute | 57,9 % | |
| nach Welle 0 | 57,9 % + Platzhalter | Zahl und Art der Freigaben (6.6) |
| Website-Leser | + Platzhalter W | Messlauf; Zielgruppen Klasse 4 und gesperrte RIS getrennt (7.2) |
| nach Klassen 1 und 2 | ≈65–67 % | +≈6–8 Mio., nur Projektarbeit, 8–12 Wochen |
| mit erwarteten Zusagen | ≈69 % | +≈3 Mio. in 12 Monaten |
| mit Binärblöcken | 70–80 % | regisafe/komuna, Berlin/Hamburg, Sternberg-Kreise, Region Hannover |

70 % brauchen rechnerisch die 24 größten offenen Gebiete; 14 davon sind ohne Dritte erreichbar. 80 % brauchen 333 Gebiete und zwei der drei großen Hersteller. Die README rechnet mit Kreisen und nennt 65 %; beide Werte werden ausgewiesen, Meilensteine gelten für die Gemeindeebene.

### 4.3 robots-Verbot im Bestand

| Betreiber | Quellen | Einwohner | Kreise |
|---|---:|---:|---:|
| owl-it | 230 + Alt-Kennung | 5.379.898 | 23 |
| CC e-gov | 207 | 3.764.954 | 21 |
| kommuneeigene Rechner | 116 | 6.309.276 | 21 |
| kdvz Frechen (OParl) | 20 | 535.123 | 2 |
| ratsinfomanagement.net (OParl) | 25 | 510.441 | 1 |
| digitalfabrix | 3 | 12.776 | – |
| **Summe** | **602** | **16.512.468 (19,8 %)** | **68** |

602 Urteile = 601 Katalogquellen + Alt-Kennung `steinfurt` (Kreis Steinfurt, owl-it). Strikt angewandt fiele die Abdeckung auf 38,1 %; NRW verlöre 199 von 332 Quellen (Zählung B2 nach Katalogquellen; README: 199 von 333 angebundenen NRW-Gebieten; vor dem ersten Brief eine Zahl festlegen), Niedersachsen 103 von 267, Schleswig-Holstein 60 von 83.

## 5. Vorbedingungen (Woche 1–3)

| Nr. | Schritt | PT |
|---|---|---:|
| V1 | Arbeitsstand committen: erledigt (Commit 156fb53, Website-Leser mit Änderungen an `build.mjs`, `robots.mjs`, `readers.mjs`) | – |
| V2 | **Ein** Berichtskorrektur-Patch an `build.mjs` (`reason()`, `PLATFORMS`, Adressfeld) und `verify.mjs`: A1, B1 mit den 7 Fehlzuordnungen ohne Zielgruppe (Amt Grabow, Amt Bad Oldesloe-Land, Bellenberg, Illmensee, Horben, Kirchseeon, VG Falkenstein; ≈47.000), C2 Teil 5, DE1/DE2, Grund aus FG5, Abbildung Grund → Zustand (H1); ein Testsatz | ≈3 |
| V3 | **Ein** `build.mjs`-Lauf ohne Netz für de, nds, NRW; danach alle Adressatenlisten neu ziehen | 0,5 |
| V4 | 22 Gebiete ohne Berichtszeile klären (Namensdoppel in `areas.mjs` oder Katalogfehler) | 0,5 |
| V5 | Entscheidungen 1–8, 10, 15, 17 und 19 (Abschnitt 13); die übrigen bis Woche 8 | 1–2 |
| V6 | Kennung und Seite `/bot`, Funktionsadresse mit SPF/DKIM/DMARC | 1,5 |
| V7 | Live-Messungen vom Rechner des Inhabers (die Cloud-Umgebung sperrt kommunale Server); gegen gesperrte Rechner nur robots.txt und Hersteller-OParl-Pfad: H8, FG1, C1, C3/C4, Zählungen aus `candidates.json` und `checkedAt` | 1,5–2 |
| V8 | Liste der vorhandenen Freigaben (Abschnitt 6.5), in Woche 1 | Inhaber |

Keine Zahl geht an einen Hersteller vor V3.

## 6. Welle 0: vorhandene Freigaben einbringen

### 6.1 Zweck

Der Inhaber hat schriftliche Freigaben vieler Gemeinden, die noch nicht umgesetzt sind. Welle 0 bringt sie vor jeder neuen Anfrage ein: Freigaben gegen robots.txt wirken sofort, die Betreiberbriefe können die Zahl zustimmender Kunden nennen, und Bestandsquellen bleiben über die robots-Frist hinaus lesbar. Die Zahl ist unbekannt; gerechnet wird mit Platzhaltern. Welle 0 endet mit M0b spätestens in Woche 3; verzögert sich M0b, warten die Briefe.

### 6.2 Ein Schema

Die Analyse schlug vier Felder für denselben Zweck vor: `robotsWaiver` (A10), `robotsOverride` (B3), `permission` (FG12) und das Urteil „freigegeben“ (H1). Sie werden zu einem Register und einem Katalogfeld zusammengelegt.

**Register** `server/integrations/source-consents.json`, versioniert, ohne Personendaten:

```json
{ "id": "fr-2026-0001", "area": "<Katalog-ID>", "key": "<amtlicher Schlüssel>", "land": "09",
  "date": "2026-05-12", "grantedBy": "Ratsbüro", "channel": "E-Mail",
  "scope": ["robots"], "system": "https://ratsinfo.<ort>.de/bi/", "address": null,
  "operatorState": null, "evidence": "beleg:fr-2026-0001", "reviewAt": "2027-05-12", "revokedAt": null }
```

- `grantedBy` ist eine Rolle (Ratsbüro, Bürgermeister, Hauptamt, IT), nie ein Name. `channel`: E-Mail oder Schreiben; eine telefonische Zusage zählt erst schriftlich bestätigt.
- `scope`: `robots`, `freischaltung`, `oparl`, `adresse`, auch mehrere. `operatorState` (offen, beauftragt, erledigt) gilt für `freischaltung` und `oparl`.
- `evidence` verweist auf den Beleg. Mails, Schreiben, Namen und Mailadressen liegen außerhalb des öffentlichen Repositorys: Belege beim Inhaber mit Sicherung (nicht im von Git ignorierten `tmp/`), im Repository nur die Registernummer.
- `reviewAt`: Prüfdatum, Vorschlag 12 Monate; es erzeugt nur eine Wiedervorlage. `revokedAt`: Widerruf; der nächste `build.mjs`-Lauf entfernt `robotsOverride`, und H2 setzt die Quelle auf `ausgesetzt`.

**Katalogfeld** (Schema aus B3, Rolle statt Kontakt): `robotsOverride: { by: 'Kommune' | 'Betreiber' | 'Lizenz', role, date, extent: 'host' | 'path', paths, evidence }` (`extent` statt `scope`, damit es nicht mit dem Umfang im Register verwechselt wird). `by:'Kommune'` kommt aus dem Register, `'Betreiber'` aus einer Zusage in Welle 2, `'Lizenz'` aus einem Open-Data-Datensatz (B4). `build.mjs` schreibt das Feld; ein Feld ohne Beleg lässt der Test scheitern.

**Gate an drei Stellen:** `robotsAllow()` in `verify.mjs` erlaubt einen Pfad, wenn ein gültiger Eintrag mit `scope:'robots'` Gebiet und Rechner deckt; der globale Schalter `IGNORE_ROBOTS` entfällt. `canImport` in `pipeline-jobs.mjs` lässt „verboten“ mit `robotsOverride` zu (`ROBOTS_MODE`, Abschnitt 12). `robots.mjs` schreibt das Urteil „freigegeben“. Ein Test sichert, dass eine Freigabe nie gegen HTTP 403 wirkt.

### 6.3 Wirkung je Sperrart

| Umfang | Wirkung | Schritt | Zustand danach | Menge (Obergrenze) |
|---|---|---|---|---|
| `robots`, eigener Rechner der Kommune | hebt die Sperre auf | Prüfung mit Ausnahme | angebunden oder Lesegrund | offen 21 (≈503.000), Frankfurt; Bestand 116 |
| `robots`, Mandant auf Hoster-Plattform mit Leser | nach Option (c) ausreichend (die Kommune ist Herstellerin ihrer Datenbank); Rechtsfrage offen | zuerst nur Bestand (unten) | angebunden oder Lesegrund | ≈112 offen (Schätzung: DE16 90 + FG7 15 + B7 1 + B8 3 + A11 3; ≈2,2 Mio. einschließlich 6 + 3 Kreise); Bestand owl-it 230, CC e-gov 207 |
| `robots`, Plattform ohne Leser (RIS-Portal, komuna) | wie oben, aber kein Leser | Zahl der Freigaben je Plattform entscheidet über den Leserbau | `gesperrt-robots` mit Freigabe | 371 + 286 |
| `freischaltung` (403, Firewall, Zugriffsprüfung) | ändert technisch nichts; die Kommune muss ihren Betreiber beauftragen | Neuprüfung nach der Regel unter dieser Tabelle | „Freigabe erteilt, Freischaltung beim Betreiber offen“ | C 497 (darin Kommune aktiv 136), DE17 30, DE18 4 |
| `oparl` | wirkt nach Aktivierung | Kandidat nur für die Schnittstelle | angebunden | ekom21, Sternberg-Mandanten |
| `adresse` | liefert einen Kandidaten | `guessed:'Meldung'`; das System muss das Gebiet nennen | angebunden oder B/C | A 1.631 |
| Bestandsquelle | sichert sie über die Frist | nur Register und `build.mjs` | „freigegeben“ | ≤602 |

**Neuprüfung ohne Wiederholung nach 403.** robots.txt wird bei `freischaltung` wöchentlich gelesen. Den OParl-Pfad fragt die Neuprüfung nur, wenn seine letzte Antwort nicht 403 oder Zugriffsprüfung war (etwa 404 oder nie gefragt). Sonst geht genau eine Anfrage hinaus, sobald Kommune oder Betreiber die Freischaltung melden (`operatorState` erledigt); so verlangt es H8.

**Hoster-Mandanten (F2).** Ob eine Kommunalfreigabe gegen die robots.txt eines Hosters genügt, klärt die Rechtsauskunft (Abschnitt 12, Entscheidung 5). Bis dahin dient F2 nur dem Bestand (owl-it 230 mit 5,38 Mio., CC e-gov 207 mit 3,76 Mio.): Die Freigabe wird registriert und sichert die Quelle über die Frist. Neue Quellen aus F2 werden erst importiert, wenn die Rechtsauskunft vorliegt und der Hoster informiert ist (mit dem Betreiberbrief oder einer kurzen Vorabmitteilung mit Mandantenliste).

### 6.4 Einspielweg

```
export LAND=de DIR=tmp/source-discovery-de/
node scripts/source-discovery/consents.mjs freigaben.csv
CONSENTS=1 CANDIDATES=candidates-consents.json OUT=verified-consents.json ONLY_FILE=tmp/source-discovery-de/consents-<datum>.txt node scripts/source-discovery/verify.mjs
TARGET=server/integrations/de-sources.json REPORT=requirements/de-sources-report.md TITLE="Quellen für die übrigen Länder" node scripts/source-discovery/build.mjs
node scripts/source-discovery/servers.mjs && ONLY_NEW=1 node scripts/source-discovery/robots.mjs && node --test tests/*.test.mjs
```

`consents.mjs` schreibt das Register, `<DIR>candidates-consents.json` (`guessed:'Meldung'`, bei `oparl` als `oparlOnly`) und die Prüfliste `<DIR>consents-<datum>.txt`. `build.mjs` liest `verified-consents.json` nur, wenn die Datei in seine feste Liste aufgenommen wird (eine Zeile neben `verified-search.json`). Der Prüflauf läuft vom Rechner des Inhabers und nie parallel zu einem anderen `verify.mjs`-Lauf.

1. **Abgleich** über Katalog-ID oder Schlüssel, sonst Name und Land; Mehrdeutiges (zweimal „Gemeinde Altdorf“) kommt auf eine Rückfrageliste.
2. **Register** wird nur ergänzt, nie gelöscht.
3. **Prüfliste je Umfang:** `robots` prüfen mit Ausnahme, `adresse` und `oparl` als Kandidat, `freischaltung` und Bestand ohne Prüflauf.
4. **`build.mjs`** übernimmt `robotsOverride`. Der Bericht nennt den neuen Grund, etwa „Freigabe der Kommune vom 12.05.2026; angebunden“ oder „Freigabe vom 12.05.2026, Betreiber schaltet noch frei“.
5. **Adminbereich:** Filter „mit Freigabe“, diese Gebiete oben im Backlog. Kommunen mit `freischaltung` erhalten die genaue Bitte für ihren Betreiber.

Niedersachsen (`LAND=03`, `DIR=tmp/source-discovery-nds/`) und NRW laufen mit eigenem `DIR`, `TARGET` und `TITLE` nach `scripts/source-discovery/README.md`; Skriptname und `CONSENTS` sind Vorschläge. Die Ausnahme in der Prüfung braucht keine Grundsatzentscheidung, weil eine schriftliche Freigabe eine Erlaubnis ist; nur die Wirkung gegen Hoster-Vorlagen setzt Option (c) und die Rechtsauskunft voraus (6.3, Entscheidung 3).

### 6.5 Was die Liste enthalten muss

CSV, UTF-8, Semikolon, eine Zeile je Gebiet und Freigabe:

```
Gebiet;Land;Datum;Umfang;Kanal;Stelle;Adresse;Betreiber
<Katalog-ID oder Schlüssel>;09;2026-05-12;robots;E-Mail;Ratsbüro;;
<Gemeinde Name>;08;2026-06-03;freischaltung+oparl;Schreiben;Bürgermeister;;beauftragt 2026-06-10
```

Gebiet als ID oder Schlüssel, sonst genauer Name mit Art; Land zweistellig; Datum der schriftlichen Freigabe; Umfang nach Wortlaut („Sie dürfen abrufen“ = `robots`, „wir beauftragen unseren Dienstleister“ = `freischaltung`); Kanal; Stelle als Rolle; Adresse bei `adresse` Pflicht, sonst empfohlen; Betreiber (optional, für `freischaltung` und `oparl`): offen, beauftragt oder erledigt, mit Datum. Die Belege bleiben beim Inhaber und bekommen die Registernummer.

### 6.6 Bilanzwirkung mit Platzhaltern

| Platzhalter | Bedeutung | Obergrenze | Klasse |
|---|---|---|---|
| F1 | `robots`, eigener Rechner | 21 offen + Frankfurt | 3 → 1/2 |
| F2 | `robots`, Hoster mit Leser | ≈112 offen (Schätzung, 6.3) | 3 → 1/2 nach Rechtsauskunft und Hosterinformation |
| F3 | `robots`, Plattform ohne Leser | 657 | bleibt 3 bis zum Leser |
| F4 | `freischaltung` | 531 | bleibt 3, neuer Zustand |
| F5 | `oparl` | – | 3 → 1 nach Aktivierung |
| F6 | `adresse` | 1.631 | A → 2 oder B/C |
| F7 | Bestandsquellen | 602 | mindert den Verlust zum Stichtag |

Neu angebunden = q × (F1 + F2) + aktivierte F5 + q_A × F6; q und q_A liefert der erste Prüflauf. Danach werden Abschnitt 1 und 4 neu gerechnet.

## 7. Welle 1: ohne Dritte (Woche 1–8)

### 7.1 Arbeitspakete

| Paket | Maßnahmen | Ertrag (Schätzung) | PT (Einzelangaben) |
|---|---|---|---:|
| P1 Adressen finden | A2, A3, A4+A8, A5†, A6\*, A7, A9, A13 = FG9 (Bremen), A14, FG8, H7; Einzelrecherche der ≈10 Kreise ohne Endzustand‡ | Trichter 300–450 Gebiete (≈3,5–5 Mio.) + 7–9 Kreise; H7 20–60 Kandidaten; nicht additiv | 16–20 |
| P2 Sperren messen | C2, C3, C4 | 10 Gebiete (≈0,35 Mio.); Belege für Welle 2 | 4 |
| P3 Systeme lesbar machen | DE3–DE14, DE24–DE26 | 50–80 Gebiete (0,8–1,3 Mio.), 5–8 Kreise | 13–16 |
| P4 geteilte Systeme | FG2, FG3, FG4, FG6 | bis 21 Gebiete (≈139.000) | 5–8 |
| P5 Website-Leser | Messlauf, Auswertung | wird gemessen (7.2) | 1–2 |
| P6 Statusmodell, Admin | H1, H2, H6, H9, H10 (B3 zählt in Welle 0) | Voraussetzung | 11–14 |

\* Entscheidungsfrage (7.3). † A5 rät ≈400 Adressen auf einem Herstellerrechner: nur die OParl-Schnittstelle, 20 Testanfragen, dann 1 Anfrage/s, Abbruch bei 403/429, robots.txt von rim.ekom21.de vorher neu lesen, Umleitung auf `error_path` gilt als Nichttreffer. ‡ Marburg-Biedenkopf, Main-Taunus, Mansfeld-Südharz, Saalfeld-Rudolstadt, Traunstein, Haßberge, LK Leipzig, Deggendorf, Ludwigsburg, Rems-Murr (≈2,3 Mio. Kreiseinw.): Adresse und Produkt vom Rechner des Inhabers ablesen, danach Website-Leser, Leser oder A11.

Die Einzelangaben ergeben ≈50–64 PT (mit B3 aus Welle 0 ≈52–67), die Vollständigkeitsprüfung setzt nach Abzug von Überschneidungen ≈20–25 PT an. Diese Lücke ist nicht aufgelöst. Empfehlung: mit 20–25 PT planen und nach Hebel ordnen (zuerst A2, A3, A5, A13, DE3/DE4, DE11, FG2, H1, H2; dann A6/A8, C2–C4, DE7, FG6, H9/H10); der Rest rückt in Monat 3–6. Zweitprüfer braucht es für DE7, DE8 und DE13. Nie zwei Prüfläufe gleichzeitig, und nicht am selben Tag gegen dieselben Plattformen. Ebenso laufen Website-Leser-Messlauf, A8-Linksuche und A3-Raten auf eigener Domain nicht gleichzeitig und nicht am selben Tag gegen dieselben Gebiete (höchstens zwei Anfragen je Server). Das Gate läuft protokollierend: `ROBOTS_MODE=ignore` bis zur Entscheidung 4 bzw. zum Versand der Betreiberbriefe, dann `grace` mit `ROBOTS_GRACE_UNTIL` = Versand + 6 Monate, danach `respect`; Verbote erscheinen bis dahin als Hinweis, ein ausdrückliches Nein wirkt sofort über H2.

### 7.2 Website-Leser

**Stand.** Auf Wunsch des Inhabers ist der Leser „Website der Kommune (öffentliche Bekanntmachungen)“ gebaut (Commit 156fb53), mit nachgebildeten Seiten getestet und in mehreren Runden gegnerisch auf die Trennung öffentlich/nichtöffentlich geprüft; an echten Websites ist er noch nicht gemessen: `server/integrations/website.mjs`, `website-text.mjs`, `website-feeds.mjs`, Suche `scripts/source-discovery/website.mjs`, Ideen in `requirements/website-leser-ideen.md`. Er liest Einladungen, Bekanntmachungen, Niederschriften, Sitzungsberichte und Amtsblatt-PDFs der eigenen Website sowie RSS/Atom, iCal, WordPress-REST, JSON-LD und `sitemap.xml`. Er liest nur öffentliche Teile, beachtet robots.txt je Adresse, nutzt keine Formulare und keine Suche und folgt keinem Link auf ein RIS. Er ersetzt A20 (Neubau mit XL-Aufwand).

**Zielgruppe.** Die ≈650–860 Gebiete der Klasse „vermutlich kein RIS“ und Gebiete mit gesperrtem RIS, deren Kommune auf der eigenen Website veröffentlicht (vor allem kleine Gemeinden auf RIS-Portal, komuna, Kommune aktiv). Das umgeht keine Sperre: Die Website ist eine eigene Veröffentlichung auf einem anderen Rechner.

**Messlauf** vom Rechner des Inhabers, weil die Cloud-Umgebung kommunale Websites sperrt: zuerst A-Gebiete unter 5.000 Einwohnern (860), dann übrige A-Gebiete, dann kleine B/C-Gebiete. Gemessen werden Trefferquote, Gründe ohne Übernahme, Zahl unlesbarer Dokumente, CMS und Laufzeit.

**Ertrag.** Vor dem Messlauf wird keine Zahl behauptet. Rechenbeispiel als Annahme (Basis ≈720 Gebiete, ≈2,3–3,5 Mio.):

| angenommene Trefferquote | Gebiete | Einwohner | Punkte |
|---:|---:|---:|---:|
| 10 % | ≈70 | ≈0,2–0,35 Mio. | +0,3–0,4 |
| 25 % | ≈180 | ≈0,6–0,9 Mio. | +0,7–1,0 |
| 50 % | ≈360 | ≈1,2–1,75 Mio. | +1,4–2,1 |

Für die Klasse-4-Gebiete wäre der Einwohnerbeitrag nach dieser Annahme klein; den Beitrag bei gesperrten RIS (RIS-Portal und komuna allein 4,7 Mio.) zeigt erst der Messlauf. Seine Ergebnisse (keine Vorlagen, selten Abstimmungen) werden getrennt gezählt.

**Eingescannte und nicht zerlegbare Dokumente** sammelt der Leser getrennt (`unreadable`, `unparsed`). Sie sind die Grundlage einer späteren Entscheidung über Texterkennung oder KI (Ideenpapier: ≈15 USD im Monat für Texterkennung; Analyse: ≈0,04 USD je Bericht für KI; Rechtslage für Niederschriften vorher prüfen).

### 7.3 Entscheidungsfragen der Suche

| Frage | Zahlen | Empfehlung |
|---|---|---|
| A6 bezahlte Such-API | ≈4.900 Abfragen, ≈25 USD; 90–140 lesbare Systeme | ja |
| A15 poliscope-Verzeichnis | 150–250 lesbar, ersetzt A6; nur mit schriftlicher Zustimmung (Datenbankrecht) | anfragen, A6 nicht davon abhängig machen |
| A16 Mandanten auf Wildcard-Plattformen raten | ≈5.000 Anfragen, 40–120 Gebiete, deckungsgleich mit A6/A7; Umkehr einer dokumentierten Entscheidung | nein, solange A6/A7 nicht nachweislich wenig liefern; sonst nur mit robots.txt je Mandant, einem Arbeiter je Plattform, 1 Anfrage/s, im Land eindeutigen Namen, 50 Testanfragen, Abbruch bei 429/403/Sperrseite, Hersteller vorher informiert |

## 8. Welle 2: Betreiber-Anfragen (ab Woche 3–4)

Frühester Versand ist Woche 3–4 und erst nach M0b: Vorher fehlen der korrigierte Bericht, die Seite `/bot`, die robots-Entscheidung und die Zahl der Freigaben aus Welle 0. Je Betreiber geht **ein** Brief. Gegenleistung in jedem Brief: `/bot` mit Kennung und Kontakt, höchstens zwei Verbindungen je Server, Lesemarken, wöchentlicher Zyklus, Opt-out binnen fünf Werktagen, keine Umgehung, Quellennennung, dazu die Zahl der Kunden mit Freigabe aus Welle 0.

### 8.1 Adressaten in Reihenfolge

| # | Betreiber | offen | Bestand mit Verbot | Bitte | zusätzlich | Antwort / Zusage / Wartezeit | IDs |
|---|---|---|---|---|---|---|---|
| 1 | Lizenznachweise, kdvz | – | 73 OParl (2,54 Mio.), davon kdvz 20 | Allow für OParl-Pfade; Lizenz als Freigabe | kostenlos | 70 % / 60 % / 2–6 Wo. | B4 |
| 2 | owl-it | Wartburgkreis, 3 Altshausen-Mandanten | 230 (5,38 Mio.) | Allow für die Token, ggf. je Mandant | Weingarten ist schon frei | 60–70 % / 40–50 % / 4–10 Wo. | B7, FG7 |
| 3 | CC e-gov | 113 (1,63 Mio.) | 207 (3,76 Mio.) | Allow in der Vorlage; Instanz durch Kommune änderbar?; OParl-Preis; Kennung an der Zugriffsprüfung | eine Sitzung je Abruf | 40–50 % / 20–30 % / 6–12 Wo. | B8, C7, DE16, FG7 |
| 4 | Sternberg | 286 + 6 Eigendomains | 25 OParl, bis 51 SD.NET-Seiten | OParl als Standard; robots-Gruppe; Kennung an der Firewall | 37 + 22 Mandanten liefern OParl | 40–70 % / 20–40 % / 4–12 Wo. (B9, C6); ≈80 Gebiete erw. | A11, B9, C6, DE17 |
| 5 | ekom21 | 55 (623.311) | – | OParl für alle Mandanten | Open-Data-Gesetz Hessen, Landkreistag | ≈80 % / 20–40 % bei aktivem Angebot, sonst 5–15 % / 4–8 Wo.; 10–15 erw. | C8 |
| 6 | hannit, Region Hannover | 1 (1.141.128) | – | OParl außerhalb der Prüfung | Open-Data-Portal HIDD | Monate | C7 |
| 7 | regisafe | 371 (≈2,75 Mio.) | – | Schnittstelle, OParl, Allow | Kreise als Fürsprecher | 40 % / 15–25 % / 8–16 Wo. | B12 |
| 8 | komuna GmbH | 286 (≈1,95 Mio.) | – | OParl, Allow, Doku | Bayerischer Gemeindetag | 40 % / 15–20 % / 6–12 Wo. | B13 |
| 9 | Kommune aktiv | 136 (728.871) | – | Kennung freigeben, Export | Bad Kissingen | ≈50 % / ≈30 %; 41 erw. | C9 |
| 10 | PortUNA.ris | 13 | – | Kennung, OParl | gemeinnützig | ≈50 % / ≈40 %; 5 erw. | C10 |
| 11 | Kleinanbieter (komfa, PROVOX, RIS Web) | je 1–5 | – | OParl statt Leser | – | 30–50 % | DE21–DE23 |

Partner (mandari, Ratslotse, Open Knowledge Foundation, Städte- und Gemeindebünde) werden vor Brief 3 um Mitzeichnung gebeten; ohne Antwort nach drei Wochen gehen die Briefe allein. Erinnerung nach 21, Eskalation nach 42 Tagen. Nach jeder Zusage läuft `robots.mjs` neu, frühestens einen Tag danach (B6), dann `build.mjs`. Verweist ein Betreiber auf die Kommunen, gehen seine Gebiete mit Zitat in Welle 3. Einwohner bei regisafe und komuna nach operators.txt (376 bzw. 287 Gebiete vor der Berichtskorrektur).

**kiC-Probe bei komuna.** Eine Anfrage an `ris.komuna.net/<ort>/app/` widerspräche der robots.txt, die jedes Programm außer Suchmaschinen sperrt. Sie ist nur zulässig auf einem Mandanten, dessen Kommune in Welle 0 eine robots-Freigabe erteilt hat, oder nach Zusage der komuna GmbH (Entscheidung 3). Sonst steht die Frage „Ist die neue Oberfläche das kiC-RIS?“ im Brief an komuna.

### 8.2 Leserbau nur nach Zusage und Schwelle

Ein neuer Leser entsteht nur mit Betreiberzusage oder, ohne Zusage, wenn mindestens 5 Gebiete der Plattform oder ein Kreis bzw. eine Großstadt eine schriftliche robots-Freigabe erteilt haben. In beiden Fällen ist ein Zweitprüfer benannt. Ohne Zusage liest der Leser nur die Mandanten mit Freigabe (Liste aus `source-consents.json`), und der Hoster wird vorher informiert. Bei Kommune aktiv (403) zählen nur Gebiete mit `operatorState` erledigt, weil die Freigabe erst nach der Freischaltung durch den Betreiber wirkt.

| Leser | Gebiete | PT |
|---|---|---:|
| RIS-Portal (B14) | 371 | 5–8 (3–4 bei JSON) + 1 |
| komuna.RIS (B15) | 286 | 1–3 (kiC) bis 6–8 |
| Kommune aktiv (C9) | 136 | 3–8 |
| PortUNA.ris (C10) | 13 | 3–4 |
| PARLIS Frankfurt | 1 (760.656) | 3–4 |
| SIM Hannover (DE20) | 1 (522.803) | 5–8 |
| RIS Web (DE22 = FG10) | 4 (150.927) | 5–7 |
| komfa (DE21) | 5 | 3–4 |

Zusammen ≈28–52 PT, nicht im Gesamtaufwand.

## 9. Welle 3: Kommunen (Monat 3–8) und Sonderfälle

**Zielmenge:** eine Liste aus dem Statusmodell, nach der Berichtskorrektur und ohne Gebiete mit Freigabe aus Welle 0. Kern sind 446 Gebiete (8,82 Mio.; mit 43 Kreisen 17,1 Mio.), dazu Kommunen mit eigenem RIS-Rechner (116 Bestand, 21 offen), DE18 und die fünf gesperrten A-Kreise. **Zeitpunkt:** nach Antwort des Betreibers oder 6–8 Wochen ohne Antwort; Kommunen, die selbst Betreiber sind, ab Woche 4 (nach M0b). **Bitte je Zustand:** OParl einschalten, Betreiber zur Freischaltung beauftragen, schriftliche Freigabe im Format von Welle 0, Adresse nennen. **Ablauf:** größte zuerst, 30–40 Mails je Woche, Erinnerungen nach 21 und 42 Tagen, danach Wiedervorlage in 12 Monaten. Erwartet: 45–90 Gebiete.

| Sonderfall | Einwohner | Lage | Weg |
|---|---:|---|---|
| Frankfurt am Main | 760.656 | PARLIS, robots sperrt Tagesordnungen | Open-Data-Büro und Stadtverordnetenbüro; dann Leser (B11 = A12); früh möglich |
| Stadt Hannover | 522.803 | SIM, falsch verlinkt | Kandidat korrigieren, OParl anfragen, sonst Leser (DE19, DE20) |
| Region Hannover | 1.141.128 | ALLRIS 4 mit Zugriffsprüfung | `/oparl/system` einmal messen, dann hannit (C4, C7) |
| Berlin | 3.700.577 | 12 Bezirke, 403 und robots | Anfrage R1; Katalog mit Bezirken erst nach Zusage, mit Suchlauf für Websites (Wikidata) und Einwohner der 19 Bezirke (FG11, FG12) |
| Hamburg | 1.869.473 | 7 Bezirke, robots, Leser vorhanden | Anfrage R2 (FG11, FG13) |
| Kiel | 251.842 | Zugriffsprüfung; Kandidat war Livestream | korrigieren, anfragen (DE18) |
| LK Osnabrück, Herne, Goslar | 354.359; 156.266; 47.454 | ALLRIS 3, 403 seit 04.10. | anfragen, keine Wiederholung (DE18) |

Bremen (588.413) braucht keine Anfrage, nur den Gremienfilter (A13 = FG9).

## 10. Welle 4: ehrlich ausweisen (ab Monat 6)

**„Vermutlich kein RIS“** (eine Regel, Fassung H20): Website bekannt und erreichbar; Linksuche mit mindestens 5 Seiten ohne HTTP 403; Raten auf der eigenen Domain ohne System; Websuche ohne Treffer; Website-Leser findet keine Sitzungsbekanntmachungen. Übernimmt der Leser das Gebiet, gilt Endzustand 2. Der Grund nennt Datum und Stufen; Wiederholung halbjährlich; Stichprobe 30 Gebiete, Fehlerquote unter 10 %. Betroffen ≈650 (Obergrenze 860), dazu ≈60 aus D/E und 4 aus F. Gebiete, deren Website sperrt oder unbekannt ist (81–281), bekommen einen eigenen Zustand.

**„System vorhanden, Abruf nicht erlaubt“** (B16, C13), getrennt von „kein RIS“: voraussichtlich 800–1.400 Gebiete nach den Anfragen, der größte Block überhaupt. Zustand `abgelehnt`, Wiedervorlage nach 12 Monaten, auf `/quellen` neutral („Das System erlaubt Programmen den Abruf nicht“). Die 657 RIS-Portal- und komuna-Gebiete (371 + 286), die Gruppe B als „kein RIS“ führte, gehören hierher; die 8 geratenen Hosts aus B10 bleiben in Klasse 4. Ein Opt-out gilt verbindlich. Nach der robots-Frist werden ausgesetzte Bestandsquellen ebenso sichtbar ausgewiesen.

**„System ohne Leser“** (DE23): ≈19–28 Gebiete auf Kleinplattformen unter der Schwelle, mit Produktname.

## 11. Querschnitt

**Statusmodell (H1, H2).** Je Land `server/integrations/source-status/<land>.json` (zusammen ≈1 MB) als Nachfolger von `source-overrides.json`, das heute nur für NRW wirkt. Je Gebiet ein Block `auto` (schreibt `build.mjs`: Zustand, Grund, Adresse, Betreiber, robots-Urteil, Prüfdatum) und ein Block `manual` (Hand und Adminbereich: Zustand, Organisation bzw. Rolle, Kanal, Daten, Antwortkategorie, Verweis auf die Anfrage-ID in `source_requests` bzw. die Registernummer; keine Adressen, weil die Datei versioniert und öffentlich ist). Neue Zustände aus Welle 0: `freigabe-erteilt`, `freigabe-erteilt-betreiber-offen`, dazu `keine-website`. Tests: jede Katalog-ID hat einen Eintrag; ein zweiter Lauf ändert keinen `manual`-Block; Zustandssummen gleich Berichtszahlen. Aussetzen und Opt-out wirken für alle Quelldateien (`method:'pending'` mit Notiz).

**Adminansicht „Anbindung“ (H9, H10).** Endpunkt `/api/admin/connect`, Seite 5: Trichter je Land (Katalog → Adresse → importierbar → abgerufen → Berichte), Zustände, Betreiber mit Kontaktstand, Backlog mit Filtern (Zustand, Betreiber, Land, Einwohner, Kreis, **mit Freigabe**), Kachel „Fällig“, Kennzahlen. Die Liste lädt erst nach Filterwahl (Bayern ≈265 KB statt 3,4 MB). Aktionen: Zustand setzen (Tabelle `source_requests`), Anfrage-Text erzeugen, Prüfliste exportieren. Prüfungen bleiben lokal. Funktionsadressen stehen nur in `source_requests` hinter dem Adminbereich, nie im Repository; dort gilt die Löschfrist von 12 Monaten.

**`/bot` und `/quellen` (H3, H17).** Eine Seite und eine Kennung (H3 = B5 = C5), zentral in `shared/user-agent.mjs` statt zwölf Kopien: `VorOrt-PoliticalTopics/0.5 (public council documents; +https://<host>/bot)` und `Ratsmonitor-SourceCatalog/1.0 (…; +https://<host>/bot)`. Die robots-Token bleiben; nach dem ersten Brief wird die Kennung nicht mehr geändert. `/bot` erklärt Zweck, Umfang, Last, Opt-out und rechtliche Einordnung. `/quellen` zeigt alle 16 Länder mit drei öffentlichen Zuständen (angebunden; System gefunden, für Programme nicht lesbar; kein System bekannt), dazu „mit Freigabe der Kommune“ und die Quellenart Website, und bietet „Adresse melden“ (wird nach Sichtung ein Kandidat mit `guessed:'Meldung'`; Schutz durch Begrenzung je IP und Honeypot).

**Anfrageprozess (H11, H12, H16).** Vorlagen für Hersteller, Zweckverbände, Kommunen und Multiplikatoren; Aussagen über Produkte nur aus den Live-Messungen. Einzelmails von `quellen@<domain>` mit SPF, DKIM und DMARC. Erinnerung nach 21, Eskalation nach 42 Tagen, danach `abgelehnt (keine Antwort)`. Wochenroutine 30–60 Minuten, höchstens 40 offene Anfragen je Woche. Eine Ablage (Statusmodell und `source_requests`); Kampagnentabelle (B5) und `source-requests.json` (C13) entfallen.

**Kennzahlen (H6).** Je Lauf ein Datensatz in `requirements/source-kpi.json`: Abdeckung in beiden Definitionen je Land, Website-Leser getrennt, Zustände, Anteil mit Endzustand, je Betreiber offen/verboten/mit Freigabe, Freigaben nach Umfang, Anfragen nach Stand, Quellen ohne Treffer in vier Wochen, Datenbankgröße.

**Betrieb und Kapazität (H18, H19).**

- Laufzeit ≈37 s je Gebiet (NRW-Mix); für RIS-Portal und komuna gibt es keine Messung.
- `PER_PROVIDER=2` nur mit schriftlicher Zustimmung eines Betreibers anheben.
- Datenbank: ≈615.000 Berichte im Jahr aus B/C und D/E/F, ≈10 GB im Jahr im heutigen Schema (≈3,9 GB ohne Vollkopien). Hosting-Phase 3 (Versionen als Diff) und Phase 2 (Zeitplan und Warteschlange statt offenem Admin-Tab) vor der Kommunalwelle.
- KI flächendeckend ≈25.000 USD im Jahr, deshalb nur auf Nachfrage.
- Neuprüfung: `lesen-gescheitert` monatlich (≈130), `system-unbekannt` und `zuordnung-unklar` vierteljährlich (≈190), `kein-link` halbjährlich ohne Gebiete mit Website-403; gesperrte Gebiete vierteljährlich, mit Freigabe wöchentlich, jeweils nur robots.txt; den OParl-Pfad nur nach der Regel in 6.3 (nie erneut nach 403 oder Zugriffsprüfung, sondern einmal nach gemeldeter Freischaltung).
- Ausführungsort: lokal mit Wächter; GitHub Actions ohne feste IP; ein Server mit fester IP nur, wenn Betreiber per IP freigeben. Die Cloud-Umgebung sperrt kommunale Server.

## 12. robots.txt-Grundsatz

Dieser Abschnitt ist keine Rechtsberatung; er sammelt Optionen und Fragen für eine Rechtsauskunft.

| Option | Inhalt | Wirkung |
|---|---|---|
| (a) strikt | 601 Quellen mit Verbot sofort abschalten (602 Urteile, 4.3) | 38,1 % statt 57,9 %; NRW 332 → 133 (README: 333), Niedersachsen 267 → 164, Schleswig-Holstein 83 → 23, Saarland 34 → 19; 68 Kreise |
| (b) heute | Bestand ohne Begründung lesen, neue Quellen nur mit Erlaubnis | inkonsistent, kein Opt-out, widerspricht jedem Brief |
| **(c) empfohlen** | lesen, was robots.txt erlaubt oder dokumentiert freigegeben ist; Bestand befristet weiter | Abdeckung hängt nach der Frist an Freigaben |
| (c-API) | OParl trotz `Disallow: /` | 73 Quellen, 2,54 Mio.; nicht empfohlen, RFC 9309 trennt nicht |
| (d) | dauerhaft trotz Verbot | nicht empfohlen |

Festlegungen zu (c):

- **Eine Frist:** sechs Monate ab Versand der Betreiber-Anfragen, also etwa bis Monat 7; technisch `ROBOTS_MODE=grace` mit `ROBOTS_GRACE_UNTIL` (vorher `ignore`, 7.1), danach `respect`. Ein ausdrückliches Nein gilt sofort.
- **Als Freigabe zählen** eine geänderte robots.txt, eine schriftliche Zusage des Betreibers, eine schriftliche Freigabe der Kommune (auch für ihren Mandanten bei einem Hoster) und eine Open-Data-Lizenz, unter der die Kommune den Endpunkt selbst veröffentlicht.
- **Keine pauschale OParl-Ausnahme**; die 25 OParl-Quellen auf ratsinfomanagement.net laufen bis zur Frist und stehen im Sternberg-Brief.
- **Rechtsauskunft vor dem Scharfschalten** (≈1–2 Tsd. EUR, 2–4 Wochen) zu § 5 UrhG (amtliche Werke), § 44b UrhG (deckt Text und Data Mining, nicht die dauerhafte Bereitstellung), §§ 87a ff. UrhG (Datenbankherstellerin ist die Kommune) und zur Frage, ob eine Hoster-Vorlage als Vorbehalt der Kommune gilt (OLG Hamburg, 5 U 104/24; LG Hamburg, 310 O 227/23).
- **„Keine Umgehung“ gilt unabhängig davon:** keine Browser-Kennung, keine Wiederholung nach 403 oder Zugriffsprüfung, keine Formulare.

## 13. Entscheidungen für den Projektinhaber

1. **Welle 0:** vorhandene Freigaben vor neuen Anfragen einbringen; Register `source-consents.json`, Belege außerhalb des Repositorys, „mit Freigabe der Kommune“ auf `/quellen`. Empfehlung: ja, Liste nach 6.5 liefern.
2. **Ein Schema, ein Gate:** `robotsOverride` mit `by: Kommune | Betreiber | Lizenz` ersetzt drei andere Felder; Ausnahme je Gebiet statt `IGNORE_ROBOTS`; Gate zunächst protokollierend. Empfehlung: ja.
3. **Kommunalfreigabe gegen Hoster-Vorlage** genügt unter (c), gegen 403 nicht. Es geht vor allem um den Bestand (owl-it 230 Quellen mit 5,38 Mio., CC e-gov 207 mit 3,76 Mio.), dazu ≈112 offene Gebiete mit Leser (Schätzung) und 657 ohne, auch um die kiC-Probe bei komuna. Die Rechtsfrage ist offen. Empfehlung: ja; die Frage in den Auftrag der Rechtsauskunft (Entscheidung 5) aufnehmen und bis dahin nach 6.3 verfahren.
4. **robots-Grundsatz:** Option (c), Frist sechs Monate ab Versand, Lizenz zählt, keine OParl-Ausnahme; es geht um 602 Quellen mit 16,5 Mio. (19,8 %). Empfehlung: (c).
5. **Rechtsauskunft** (≈1–2 Tsd. EUR) vor dem Stichtag. Empfehlung: beauftragen.
6. **Kennung, `/bot`, Domain, Funktionsadresse** vor dem ersten Brief festlegen; hängt an der Hosting-Entscheidung. Empfehlung: jetzt.
7. **Wiederprüfung nach Sperren:** einmal nach mindestens 14 Tagen bei 429, 503, „Zu viele Zugriffe“ oder Wartung (etwa Oberhausen 213.178): ja. Nach 403 und Zugriffsprüfung keine Wiederholung: robots.txt ja, den OParl-Pfad nur, wenn er selbst nicht mit 403 oder Zugriffsprüfung antwortete, sonst einmal nach gemeldeter Freischaltung (497 Gebiete, 6,2 Mio.; auch die 11 ALLRIS-Kalender-403 mit 130.838, die die Analyse für vorübergehend hält): ja.
8. **Absender:** allein oder mit mandari, Ratslotse, Open Knowledge Foundation; betrifft 1.111 B/C-Gebiete (9,74 Mio.) und 545 Bestandsquellen (12,85 Mio.). Empfehlung: Partner fragen, nach drei Wochen allein.
9. **Website-Leser:** kein XL-Neubau (A20 entfällt), Messlauf vom Rechner des Inhabers, über Texterkennung und KI erst nach gemessener Trefferquote entscheiden. Empfehlung: ja.
10. **Suchwege A:** Such-API (≈25 USD) ja; poliscope anfragen; Raten auf Plattformen nein, solange A6/A7 genügen. Ziel 300–450 Anbindungen.
11. **Regel „vermutlich kein RIS“** nach Abschnitt 10 (≈650, höchstens 860 Gebiete). Empfehlung: ja.
12. **Endzustand „Abruf nicht erlaubt“** öffentlich und neutral, 800–1.400 Gebiete; Opt-out verbindlich. Offen: Wiedervorlage eines Opt-outs. Empfehlung: einmal nach 12 Monaten.
13. **Leser-Schwelle:** mit Betreiberzusage oder, ohne Zusage, ab 5 Gebieten der Plattform bzw. einem Kreis oder einer Großstadt mit schriftlicher robots-Freigabe; gelesen werden dann nur diese Mandanten (`source-consents.json`), bei Kommune aktiv nur mit `operatorState` erledigt; immer mit Zweitprüfer; 8 Leser, ≈28–52 PT. Empfehlung: ja, Zweitprüfer jetzt benennen.
14. **Berlin und Hamburg:** Bezirke als Kinder der Städte mit Projektschlüsseln (L 5–8 PT, 5,57 Mio.), ohne Freigabe aber keine Quelle; zum Umbau gehört der Suchlauf für Websites (Wikidata) und Einwohner der Bezirke. Empfehlung: Anfragen zuerst, Umbau nach Zusage.
15. **Bremen:** Stadtbürgerschaft gilt als Rat der Stadtgemeinde; Gremienfilter bauen (2–3 PT, 588.413). Empfehlung: ja.
16. **Maß und Meilensteine:** Gemeindeebene, Wert mit Kreisen daneben; M1 ≈65–67 % nach 8–12 Wochen. Empfehlung: ja.
17. **Statusmodell und Datenschutz:** Statusdateien je Land ohne Kontaktdaten (Rolle, Kanal, Daten, Verweis); Funktionsadressen nur in `source_requests` hinter dem Adminbereich, Löschfrist 12 Monate, die in der Git-Historie nicht einzuhalten wäre. Empfehlung: ja.
18. **Betrieb:** lokal beginnen; `PER_PROVIDER` nur mit Zustimmung erhöhen; Hosting-Phasen 2 und 3 vor Monat 3; KI nur auf Nachfrage. Empfehlung: ja.
19. **Budget:** ≈45–60 PT über sechs Monate nach Vollständigkeitsprüfung; Risiko bis ≈73 PT (Summe der Gruppen), die Einzelangaben allein für Welle 1 ergeben ≈50–64 PT. Überprüfung nach Woche 8. Empfehlung: freigeben.

## 14. Offene Fragen (nur Live-Tests oder Dritte)

1. Zahl, Umfang und Systeme der vorhandenen Freigaben.
2. Trefferquote des Website-Lesers, Anteil eingescannter Dokumente.
3. Zahl der A-Gebiete ohne Website bzw. mit Website-403 (`candidates.json`).
4. Prüfdatum der D/E-Zeilen vor oder nach dem Leser-Einbau.
5. Ursache der 22 Gebiete ohne Berichtszeile.
6. Sternberg: OParl-Pfad je Mandant 404, 403 oder robots-gesperrt; Plattform- oder Mandanteneinstellung?
7. CC e-gov: Vorlage zentral oder je Instanz; OParl-Kosten, auch für ALLRIS 3; warum Bonn frei ist.
8. `/oparl/system` bei den 14 ALLRIS-Systemen mit Zugriffsprüfung.
9. regisafe: JSON-Schnittstelle der App; öffentlicher Teil des Landkreises Karlsruhe.
10. komuna: ist die neue Oberfläche das kiC-RIS; Eigentümer?
11. Kommune aktiv und PortUNA: Exporte, aktuelle Kontakte.
12. robots.txt der A2-Kandidaten, von ratsinfo-online.de/.net, komfa, Landkreis Leipzig, Oberhausen, SIM Hannover, Reutlingen.
13. Gleiche Hersteller-robots.txt auf den 116 kommuneeigenen Rechnern?
14. Nennen open.nrw, GovData und kdvz die 73 OParl-Endpunkte mit Lizenz?
15. Berlin: Art des 403; Hamburg: Rechner und robots.txt der Bezirke; amtliche Bezirksschlüssel?
16. Bremen: Namen der städtischen Gremien im OParl-System.
17. Rechnerlisten aus Web-Archiven, Websites aus OpenStreetMap.
18. Nimmt komm.one unser Netz wieder an?
19. Ergebnis der Rechtsauskunft.
20. Datenbankgrenze im Tarif, Laufzeit je Leser.

## 15. Aufwand und Zeitplan

| Welle | Zeitraum | PT |
|---|---|---:|
| Vorbedingungen | Woche 1–3 | 6–8 |
| Welle 0 | Woche 1–3 | 3–4 |
| Welle 1 | Woche 1–8 | 20–25 |
| Querschnitt (`/quellen`, Nachverfolgung, Neuprüfung, Kapazität) | Woche 3–16 | 8–11 |
| Welle 2 | Woche 3–16 | 3–5 |
| Welle 3 | Monat 3–8 | 4–5 |
| Welle 4 | ab Monat 6 | 1–2 |
| **Summe** | **6 Monate** | **≈45–60** |

Gesamtrahmen und Welle 1 stammen aus der Vollständigkeitsprüfung, die übrige Aufteilung ist darauf abgestimmt; Welle 0 enthält B3 (Katalogfeld, Gate, 2–3 PT) und das Einspielskript (Annahme S); H2 zählt in Welle 1 (P6). Nicht enthalten: Hosting-Phasen 2/3, Leser nach Zusage (≈28–52 PT), der Bau des Website-Lesers. Die Gruppen veranschlagten vor Abzug der Überschneidungen ≈73 PT; das Risiko liegt oben.

| Meilenstein | Zeitpunkt | Kriterium |
|---|---|---|
| M0 Grundlage | Woche 3 | Bericht korrigiert, Entscheidungen 1–8, 10, 15, 17, 19, `/bot` online, M0b erreicht |
| M0b Freigaben | spätestens Woche 3 | Register gefüllt, geprüft, Bilanz 6.6 mit echten Zahlen; Bedingung für den ersten Brief |
| M-Web | nach dem Messlauf | Trefferquote des Website-Lesers bekannt |
| M1 | Woche 8–12 | Klassen 1 und 2 erledigt, ≈65–67 % |
| M2 | etwa Monat 7 | robots-Frist abgelaufen, nicht Freigegebenes ausgesetzt und ausgewiesen |
| M3 | Monat 8–12 | jedes Gebiet mit Endzustand und Datum; ≈69 % mit erwarteten Zusagen |
| M4 | Monat 12–18 | 70–80 %, nur mit Binärblöcken |

## Anhang A: Maßnahmenkatalog

Alle 112 Maßnahmen. Gebiete und Einwohner sind Gruppenangaben, nicht additiv (maßgeblich ist 4.1); bei Anfragen steht der erwartete Ertrag („erw.“). PT sind Einzelangaben vor Entdoppelung. Reichweite: sofort, Code (ohne Dritte), Dritte, kein RIS, Entsch. (Entscheidung nötig). „=“ markiert zusammengelegte Doppelungen. § Einwohner vor Berichtskorrektur (386/289 Gebiete); nach operators.txt ≈2,75 bzw. ≈1,95 Mio.

| ID | Kurztitel | Typ | Reichw. | Gebiete/Einw. | PT | abhängig von |
|---|---|---|---|---|---|---|
| A1 | Berichtsgründe korrigieren (Websuche-Prüfungen, Adressen, Grundcodes) | code | sofort | – | 0,5 | – |
| A2 | Websuche-Prüfungen auswerten; 19 Kreise, Chemnitz, Salzgitter | daten | sofort | 9/1,44 Mio. | 1 | A1 |
| A3 | guess.mjs: Präfixe, Meta-Refresh, Domainvarianten für Kreise | code | Code | 30/250 Tsd. | 1 | – |
| A4 | Verbände: Mitglieds-Websites immer durchsuchen | code | Code | 40/300 Tsd. | 1 | A8 |
| A5 | ekom21-OParl für hessische A-Gebiete raten (nur OParl, 20 Testanfragen, 1/s, Abbruch bei 403/429) | code | Code | 15/200 Tsd. | 0,5 | – |
| A6 | Websuche-Automatik (Such-API) je Gebiet | code | Code | 110/1,00 Mio. | 2–3 + ≈25 USD | A1, Entsch. 10 |
| A7 | Rechnernamen der Wildcard-Plattformen aus Web-Archiven (Trichter; ersetzt A16 weitgehend) | code | Code | 50/350 Tsd. | 1–2 | – |
| A8 | Linksuche Generation 2 (robots.txt, Sitemaps, Linkformen) | code | Code | 100/800 Tsd. | 3 | A1, A4 |
| A9 | Zweite Website-Quelle (OpenStreetMap) | daten | Code | 25/150 Tsd. | 1 | Zählung V7, A8 |
| A10 | Katalogfeld für Freigaben (= B3; aufgegangen in Welle 0) | code | Code | – | 1 | Entsch. 2 |
| A11 | Herstellerreferenzen; fünf gesperrte Kreise | anfrage | Dritte | 60/600 Tsd. | 2 | B3, V6 |
| A12 | Frankfurt: PARLIS-Freigabe, dann Leser (= B11) | anfrage | Dritte | 1/761 Tsd. | S + 3 | B3 |
| A13 | Bremen: OParl mit Gremienfilter (= FG9) | code | Code | 1/588 Tsd. | 2 | – |
| A14 | Verwaltungsportale als Hinweisgeber | daten | Code | 20/200 Tsd. | 0,5 | A6 |
| A15 | poliscope-Verzeichnis, nur mit Zustimmung; ersetzt A6 | Entsch. | Dritte | 150/1,20 Mio. | 1 | Entsch. 10 |
| A16 | HTTP-Raten auf Wildcard-Plattformen | Entsch. | Entsch. | 60/400 Tsd. | 2 | A6, A7, Entsch. 10 |
| A17 | Entscheidungen Cluster A (in Abschnitt 13 aufgegangen) | Entsch. | Entsch. | – | S | – |
| A18 | „Kein RIS gefunden“ ausweisen (= H20, Abschnitt 10) | code | kein RIS | 650/1,80 Mio. | 2 | A1, A3, A4, A6, A8 |
| A19 | Meldefeld, Textbaustein, halbjährlicher Lauf | betrieb | Code | 30/250 Tsd. | 1 + 0,5/Halbjahr | A1, A18 |
| A20 | Website-Leser mit KI als Pilot; ersetzt durch Website-Leser | code | entfällt | – | >10 | – |
| B1 | Plattformvorrang und Adresse in build.mjs | code | Code | 8/110 Tsd. | 0,5–1 | – |
| B2 | robots-Grundsatz Option c (= H5, C14, DE15; Frist 6 Monate) | Entsch. | Entsch. | Bestand 601 | S ≤1 + Rechtsauskunft | – |
| B3 | robotsOverride, robots-Prüfsumme, Gate | code | Code | – | 2–3 | B2 |
| B4 | Open-Data-Lizenzen als Freigabe eintragen | daten | sofort | Bestand ≤73/2,54 Mio. | 1 | B2, B3 |
| B5 | Abruf-Policy, Kennung, Opt-out, Kampagnenzähler (= C5, H3; Zähler → H6) | betrieb | sofort | – | 1 | B2 |
| B6 | robots-Lauf nach jeder Zusage | daten | sofort | – | je Lauf ≈10 min | Zusagen |
| B7 | Anfrage owl-it | anfrage | Dritte | 1/153 Tsd.; Bestand 230 | 1 | B3, B5 |
| B8 | Anfrage CC e-gov | anfrage | Dritte | 3/275 Tsd.; Bestand 207 | 1 | B3, B5 |
| B9 | Anfrage Sternberg (robots, OParl, Firewall) | anfrage | Dritte | Bestand 25 + ≤51 | 1 | B4, B5 |
| B10 | Kommunen mit eigenem RIS-Rechner | anfrage | Dritte | 21/503 Tsd.; Bestand 116 | 2–3 | B1, B3, B5 |
| B11 | Frankfurt: Anfrage an Stadt (= A12) | anfrage | Dritte | 1/761 Tsd. | 0,5 + 3–4 | B3, B5 |
| B12 | Anfrage regisafe | anfrage | Dritte | ≤371/2,87 Mio.§ | 1 | B1, B5 |
| B13 | Anfrage komuna GmbH; kiC-Probe nur mit Freigabe | anfrage | Dritte | ≤286/1,97 Mio.§ | 1,5 | B1, B5 |
| B14 | Leser RIS-Portal | code | Dritte | 371/2,87 Mio.§ | 5–8 (3–4) | B12 oder Freigaben |
| B15 | Leser komuna.RIS | code | Dritte | 286/1,97 Mio.§ | 1–3 bis 6–8 | B13 oder Freigaben |
| B16 | Verweigerte Gebiete ausweisen (Klasse „verweigert“, nicht „kein RIS“) | betrieb | Dritte | ≤657 (ohne 8 B10-Hosts, Klasse 4)/4,84 Mio.§ | 0,5 | B10–B13 |
| C1 | Vorhandene Prüfdaten auswerten | daten | sofort | – | 0,5 | – |
| C2 | Sperrart und OParl-Pfadstatus festhalten; Wiederprüfung nur nach Entsch. 7 | code | Code | 4/60 Tsd. | 2,5 | C1 |
| C3 | ekom21-Mandantenerkennung reparieren | code | sofort | 3/95 Tsd. | 0,5 | – |
| C4 | Hersteller-OParl-Adressen als Kandidaten | code | Code | 3/200 Tsd. | 1 | C1, C2 |
| C5 | Kontakt in der Kennung, Abruf-Seite (= B5, H3) | betrieb | sofort | – | 1 | – |
| C6 | Anfrage Sternberg (= B9, DE17; Liste mit 286) | anfrage | Dritte | ≈80 erw. (max. 257) | 1 | C2, C4, C5 |
| C7 | ALLRIS-Zugriffsprüfung: CC e-gov, hannit, Kommunen; ohne Stadt Hannover | anfrage | Dritte | 4–6 erw. (max. 15) | 2 | C4, C5 |
| C8 | Anfrage ekom21 und hessische Verbände | anfrage | Dritte | 10–15 erw. (max. 52) | 2 | C3, C5 |
| C9 | Anfrage Kommune aktiv | anfrage | Dritte | 41 erw. (max. 136) | 0,5; Leser 3–8 | C5, C15 |
| C10 | Anfrage PortUNA.ris | anfrage | Dritte | 5 erw. (max. 13) | 0,5; Leser 3–4 | C5, C15 |
| C11 | Kommunalkampagne ratsinfomanagement.net | anfrage | Dritte | – | 3 | C6 |
| C12 | Gemeinsamer Brief mit anderen Projekten (= H14) | anfrage | Dritte | – | 1 | C5 |
| C13 | Nachverfolgung der Anfragen | betrieb | sofort | – | 1 | C6–C12 |
| C14 | E1: OParl-Pfade mit robots-Verbot (in Abschnitt 12 aufgegangen) | Entsch. | Entsch. | – | S | – |
| C15 | E2: Leser nur nach Freigabe (= DE23, Leser-Schwelle) | Entsch. | Entsch. | – | S | C9, C10 |
| DE1 | Prüfdatum im Bericht | code | Code | – | 0,3 | V7 |
| DE2 | reason(): Reihenfolge, Detail, Texte | code | Code | – | 0,5 | – |
| DE3 | findcity filtern, 41 Wrapper-Gebiete neu durchsuchen | code | Code | 3/513 Tsd. | 0,25 + Lauf | – |
| DE4 | Neuprüfung der D/E-Gebiete | daten | sofort | 25/450 Tsd. | 0,5 + Lauf über 2 Tage | DE1, DE2, DE3 |
| DE5 | kdgoe- und sitzung-mv-Mandanten zuordnen | code | Code | 9/92 Tsd. | 1 | DE4 |
| DE6 | Nebenan-Suche bei 404/0 (nicht 401/403) | code | Code | 8/70 Tsd. | 0,5 | DE2, DE4 |
| DE7 | ALLRIS 3 an Ordneradressen erkennen | code | Code | 12/450 Tsd. | 2–3 + Zweitprüfung | DE4, Live-robots |
| DE8 | SessionNet-Mandant in Prüfung und Katalog | code | Code | 3/44 Tsd. | 2 + Zweitprüfung | DE2, DE4 |
| DE9 | SessionNet ohne TOPs: Ursachen, 6 Monate | daten | sofort | 15/200 Tsd. | 1 | DE2, DE4 |
| DE10 | More!-Rubin-Rechner: Wurzel nachschieben | code | Code | 4/30 Tsd. | 0,5 | DE4 |
| DE11 | Vorübergehende Sperren erneut prüfen | daten | sofort | 1/213 Tsd. | 0,2 | Entsch. 7 |
| DE12 | OParl ohne Sitzungen diagnostizieren | daten | sofort | 2/184 Tsd. | 1 | DE4 |
| DE13 | SD.NET: neues Format der Vorlagenliste | code | Code | 4/93 Tsd. | 2 + Zweitprüfung | Live-Fixtures |
| DE14 | TI-Generator: Ordneradressen | code | Code | 3/45 Tsd. | 1–2 | DE4 |
| DE15 | robots-gesperrte Hoster in D/E (in Entsch. 3/4 aufgegangen) | Entsch. | Entsch. | ≈90/1,26 Mio. | 0,5 | – |
| DE16 | Anfrage CC e-gov als Hoster (= B8-Brief) | anfrage | Dritte | 90/1,26 Mio. | 1 | Entsch. 4 |
| DE17 | ratsinfomanagement.net-Gebiete in Sternberg-Anfrage (= C6-Brief) | anfrage | Dritte | ≈4 erw. (max. 30) | 2 | DE2 |
| DE18 | Kiel, LK Osnabrück, Herne, Goslar | anfrage | Dritte | 4/456 Tsd. | 0,5 | – |
| DE19 | Stadt Hannover: OParl-Anfrage | anfrage | Dritte | 1/523 Tsd. | 0,3 | – |
| DE20 | Leser SIM Hannover | code | Code | 1/523 Tsd. | 5–8 + Zweitprüfung | DE19 |
| DE21 | komfa: OParl anfragen, sonst Leser | code | Code | 5/59 Tsd. | 0,3; Leser 3–4 | DE23 |
| DE22 | Leser RIS Web für Reutlingen, meeting-mobile (= FG10) | code | Code | 4/151 Tsd. | 5–7 + Zweitprüfung | DE23 |
| DE23 | Leser-Schwelle für Kleinplattformen (= C15) | Entsch. | Entsch. | ≈19–28/0,52 Mio. | 1 | – |
| DE24 | Anmeldeseiten ohne öffentlichen Teil benennen | code | kein RIS | 1/10 Tsd. | 0,5 | DE2 |
| DE25 | „Kein RIS gefunden“: CMS, Broschüren, Fehllinks | daten | kein RIS | ≈60 | 0,5 | DE2, DE3 |
| DE26 | Veraltete Prüfungen automatisch erneuern | betrieb | Code | – | 0,5–1 | DE1 |
| FG1 | robots.txt der F/G-Rechner prüfen | daten | sofort | – | 0,5 | – |
| FG2 | Quellen mit fester Körperschaft nicht ausschließen | code | Code | 3/47 Tsd. | 0,5 | – |
| FG3 | KIC-RIS: Mandanten zuordnen | code | Code | 9/14 Tsd. | 1–2 | FG1, FG2 |
| FG4 | Namenszuordnung: Aliase, Bindestriche, Dienstleister | code | Code | 4/53 Tsd. | 1 | FG1 |
| FG5 | Fehlkandidaten korrigieren, Gruppen übergeben | daten | kein RIS | – | 0,5 | – |
| FG6 | Gremien-/Mandantenfilter für geteilte Systeme | code | Code | 4/23 Tsd. | 3–4 | FG1 |
| FG7 | Freigabe-Anfrage CC e-gov und owl-it | anfrage | Dritte | 15/78 Tsd. | 1 | FG6 |
| FG8 | BW-Kleinstgemeinden über Verbandssitze | daten | Code | 10–25/20–40 Tsd. | 2–3 | FG3, FG6 |
| FG9 | Bremen: OParl-Organisationsfilter (= A13) | code | Code | 1/588 Tsd. | 2–3 | FG1 |
| FG10 | Leser RIS Web (= DE22) | code | Code | 1/2 Tsd. | 5–7 | DE23 |
| FG11 | Bezirke Berlin/Hamburg in den Katalog | code | Entsch. | 19/5,57 Mio. | 5–8 | Entsch. 14 |
| FG12 | Berlin: Anfrage R1 | anfrage | Dritte | 12/3,70 Mio. | 1 + 1 | FG11 |
| FG13 | Hamburg: Anfrage R2 | anfrage | Dritte | 7/1,87 Mio. | S + 1 | FG1, FG11 |
| H1 | Statusmodell je Land | code | sofort | – | 3–4 | – |
| H2 | Aussetzen und Opt-out für alle Quelldateien; ROBOTS_MODE | code | Code | Bestand 602 | 1 | H1 |
| H3 | Kennung zentral, Seite /bot (= B5, C5) | betrieb | sofort | – | 1 | Entsch. 6 |
| H4 | Rechtliche Einordnung | Entsch. | Entsch. | – | 0,5–1 | – |
| H5 | robots-Linie für 602 Quellen (= B2; Frist 6 Monate statt 8 Wochen) | Entsch. | Entsch. | Bestand 602/16,5 Mio. | 0,5 | H2, H4 |
| H6 | Kennzahlen und Bilanz je Lauf | daten | sofort | – | 2 | H1 |
| H7 | Open-Data-Portale als Suchquelle | daten | sofort | 20–60 Kandidaten | 1 | – |
| H8 | Live-Test je Betreiber (robots, OParl-Pfad) | daten | sofort | – | 0,5 | H3 |
| H9 | Adminansicht „Anbindung“ | code | Code | – | 3–4 | H1, H6 |
| H10 | Admin-Aktionen, Tabelle source_requests | code | Code | – | 2–3 | H1, H9, H11 |
| H11 | Anfrage-Vorlagen für vier Zielgruppen | anfrage | Dritte | – | 2 | H3, H4, H5, H8 |
| H12 | Funktionsadresse mit SPF/DKIM/DMARC | betrieb | sofort | – | 0,5 | Entsch. 6 |
| H13 | Welle 2: Betreiberbriefe (komuna statt AKDB; Sternberg 286) | anfrage | Dritte | adressierbar 1.111/9,74 Mio. | M | H3, H5, H8, H11, H12 |
| H14 | Multiplikatoren, gemeinsamer Brief (= C12) | anfrage | Dritte | – | 1–2 | H3, H11 |
| H15 | Welle 3: Kommunen | anfrage | Dritte | 45–90 erw. (446 adressierbar) | M–L, ½ Tag/Woche | H10–H13, H16 |
| H16 | Fristen, Kachel „Fällig“, Wochenroutine | betrieb | sofort | – | 1 | H1, H9, H10 |
| H17 | /quellen für alle Länder, „Adresse melden“ | code | Code | – | 3 | H1, H9, H10 |
| H18 | Neuprüfung ohne Wiederholung gegen Sperren | betrieb | Code | – | 3–4 | H1, H3, H8 |
| H19 | Kapazität: Laufzeit, Auftragstabelle, Phasen 2/3 | code | Code | – | 5–7; Phasen XL | H5, Hosting |
| H20 | „Kein RIS vermutet“ mit Nachweis (= A18) | daten | kein RIS | ≤860/2,54 Mio. | 1 + Lauf | H1, Website-Leser |
| H21 | Ziele und Meilensteine (M1 korrigiert auf ≈65–67 %) | Entsch. | Entsch. | – | S | – |
| H22 | Reihenfolge und Gesamtbilanz (D/E/F ≈70–100 statt ≈300) | Entsch. | Entsch. | – | S | H1–H21 |

## Anhang B: Quellen

Externe Quellen der Gruppenanalysen, entdoppelt; „ungeprüft“ heißt: in der Analyse nicht live bestätigt.

- Suche: https://brave.com/learn/best-search-api-2026/, https://costbench.com/software/ai-search-apis/brave-search-api/, https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement, https://www.firecrawl.dev/blog/bing-search-api-alternatives, https://www.bayernportal.de/dokumente/onlineservice/70219164659, https://www.service-bw.de/web/guest/leistung/-/sbw/Ratsinformationssystem-6006031-leistung-0, https://produktportal.pvog.fitko.de/docs/suchdienst/doku/, https://poliscope.de/ratsinformationssystem, https://poliscope.de/blog/api-ratsinformationssysteme, https://docs.poliscope.de/api, https://index.commoncrawl.org/ (ungeprüft), https://web.archive.org/cdx/search/cdx (ungeprüft)
- Hersteller und Betreiber: https://www.sitzungsdienst.net/, https://www.sitzungsdienst.net/informationssystem-sdnet-rim/, https://www.cc-egov.de/referenzen/, https://www.aalen.sitzung-online.de/public/, https://somacos.de/loesungen/sitzungsmanagement/referenzen/, https://somacos.de/kategorie/produkte/sessionnet/, https://somacos.de/somacos-neue-schnittstelle-sessionnet-oparl-1-0/, https://www.komuna-web.de/ueberuns/referenzen/referenzen.php, https://www.komuna-web.de/leistungen/portfolio_front/komuna_ris.php, https://www.regisafe.de/verschmelzung-mit-comundus-gmbh/, https://www.regisafe.de/der-ris-kompass/, https://play.google.com/store/apps/details?id=com.comundus.myris, https://technik.owl-it.de/support, https://www.ekom21.de/loesungen/sd-net/, https://www.ekom21.de/infocenter/einfo21-digital/2021/november/datenplattform/, https://www.kommune-aktiv.de/login/ws/internetsoftware/-/-/page, https://main-spessart.msp.info/KOMMUNE-AKTIV/5000/-/Lohr_a_Main.html, https://www.ratsinformationsdienst.de/seite/144805/vorteile.html, http://www.komfa.de/cms/index.php?module=view&action=impressum, https://ris-delitzsch.komfa.de/, https://ris-brueck.komfa.de/, https://github.com/altcha-org/altcha
- OParl und Open Data: https://oparl.org/oparl-fuer-ris-hersteller/, https://oparl.org/ueber-oparl/, https://oparl.org/oparl-fuer-kommunen/, https://open.nrw/open-data/showroom/nutzung-von-oparl-kommunen-aus-nrw, https://open.nrw/Kommunen-OParl, https://www.daten-bw.de/daten/-/details/objektubersicht-ratsinformationssystem-stadt-heidelberg-oparl, https://digitales.hessen.de/moderne-verwaltung/open-data-portal-hessen, https://hidd.digital/ueber-das-portal, https://www.kommune21.de/k21-meldungen/ris-mit-oparl-schnittstelle/, https://www.kommune21.de/k21-meldungen/zielgerichtete-kommunikation/, https://www.kommune21.de/k21-meldungen/transparenzgesetz-beschlossen/
- Recht: https://www.vossius.eu/de/news/detail/urteil-des-olg-hamburg-zu-ki-trainingsdatensaetzen, https://www.lto.de/recht/hintergruende/h/kuenstliche-intelligenz-ki-urheberrecht-text-data-mining-lg-hamburg-310o22723, https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=BGH&Datum=30.04.2014&Aktenzeichen=I+ZR+224%2F12
- Andere Projekte: https://github.com/mandariOSS/mandari/issues/125, https://github.com/mandariOSS/mandari/pull/283, https://github.com/mandariOSS/mandari/pull/795, https://github.com/mandariOSS/mandari/issues/88, https://github.com/Schereo/Ratslotse/pull/1265
- Einzelne Systeme: https://session-bi.stadt-chemnitz.de/si0046.php, https://sitzungsdienst.salzgitter.de/buergerinfo/to010.asp?SILFDNR=10712, https://ris.kvmyk.de/bi/gr0040.php, https://kreisinfo.schleswig-flensburg.de/startseite, https://sessionnet.krz.de/neckar-odenwald-kreis/bi/info.asp, https://web3.lra-donau-ries.de/buergerinfo/si0046.asp, http://buergerinfo.kreis-gth.de/vo0050.php?__kvonr=2006002196, https://buergerinfo.landkreis-fuerth.de/info.php, https://alzey-worms.gremien.info/, https://www.mtk.org/Burgerinfoportal-3725.htm, https://kreis-vg.ratsinfomanagement.net/, https://landratsamt-ansbach.ratsinfomanagement.net/, https://fulda.ratsinfomanagement.net/, https://www.landkreis-mainz-bingen.sitzung-online.de/bi/to010.asp?SILFDNR=5385, https://www.ratsinfo-online.net/landkreis-mol-bi/to010.asp?SILFDNR=2075, https://www.rosenheim-allris.sitzung-online.de/allrisbi/custom/startseite, https://www.landkreis-neumarkt.de/landkreis-neumarkt/politik/kreistag/protokolle/protokolle-2020-2026/, https://kreistag.landkreis-hildburghausen.de/Aktuelles-Allgemeines/Sitzungsunterlagen, https://www.hassberge.de/landkreis-hassberge/kreistag.html, https://www.stvv.frankfurt.de/parlis2/termine.php, https://www.stvv.frankfurt.de/parlis2/vpakete.php, https://sd.bremische-buergerschaft.de/, https://e-government.hannover-stadt.de/lhhsimwebre.nsf/Kalender.xsp, https://ratsinfo.kiel.de/bi/allris.net.asp, https://ris.reutlingen.de/programme/RIS/ris_web.nsf/, https://meeting-mobile.de/mm/muellheim/ris_web.nsf/factionOverview_doc.xsp, https://www.lk-l.info/, https://ratsinfoservice.de/ris/badmuender, https://client.rlpdirekt.de/public/vgrennerod_bis/home/, https://ratsinfo.fuerth.de/bi/si0046.asp
- Stadtstaaten und geteilte Systeme (ungeprüft): https://pardok.parlament-berlin.de/starweb/adis/citat/VT/19/SchrAnfr/S19-26786.pdf, https://stefan-ziller.eu/2026/suchmaschinenverbot-allris-verbietet-zugriff-auf-bvv-dokumente/, https://daten.odis-berlin.de/en/dataset/bezirksgrenzen/, https://sitzungsdienst-hamburg-mitte.hamburg.de/bi/allris.net.asp, https://suche.transparenz.hamburg.de/dataset/bezirk-harburg-drucksache-22-1257, https://suche.transparenz.hamburg.de/dataset/alkis-verwaltungsgrenzen-hamburg28, https://www.xrepository.de/details/urn:de:bund:destatis:bevoelkerungsstatistik:schluessel:rs, https://daten.berlin.de/datensaetze?tags=Allris, https://www.gvvschoenau.de/pb/491679.html, https://www.gvv-ulstertal.de/die-3-kommunen, https://sprockhoevel.ratsinfomanagement.net/, https://sessionnet.owl-it.de/herzberg/bi/kp0040.asp?__kgrnr=1, https://ris.reutlingen.de/programme/RIS/ris_web.nsf/meeting_period_overview_doc.xsp
