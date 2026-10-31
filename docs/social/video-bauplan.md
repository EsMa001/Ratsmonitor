# Bauplan: Social-Media-Videos (Hochformat)

Stand 31.10.2026. Gilt nur für Videos auf Instagram Reels, TikTok und YouTube Shorts. Die Erklärvideos auf plenara.de (`docs/videos/`) sind eine eigene Reihe mit eigenem Regelwerk. Sprechtexte und Datenblätter der einzelnen Folgen gehören nicht in dieses Dokument.

## 1. Ziel und Rahmen

Jedes Video erklärt einen echten Ratsbeschluss (oder Vorgang) so, dass Bürger ihn in 40 bis 65 Sekunden verstehen. Plenara tritt als Quelle auf, nicht als Werbebotschaft: Logo und Ortschip stehen von Anfang an oben, die Schlusskarte nennt plenara.de als einzigen Aufruf. Etwa vier Fünftel der Zeit gehören dem Beschluss.

Die Videos kommen ohne Fotos und ohne Untertitel aus. Sie müssen auch stumm lesbar sein: Bildtext, Icons und Statusfarben tragen den Kern, die Stimme ergänzt.

## 2. Technik

| Punkt | Vorgabe |
| --- | --- |
| Format | 1080 × 1920 (9:16), 30 Bilder pro Sekunde, MP4 mit H.264 (CRF 16 bis 17) und AAC |
| Länge | 40 bis 65 Sekunden, Summe der Szenendauern (Abschnitt 3). Wird es mehr, wird der Sprechtext gekürzt, nicht die Lesezeit |
| Bildaufbau | Jedes Einzelbild wird per Skript gezeichnet (Python mit PIL) und an ffmpeg übergeben (H.264, CRF 16, Preset veryfast, 4:2:0). Szenen werden einzeln gerendert, jede außer der letzten 0,2 s länger als ihre Dauer, und mit `xfade` (0,2 s) verbunden. Die Überblendung liegt über dem Anfang der folgenden Szene, die Gesamtlänge ist deshalb die Summe der Szenendauern. Verbund: CRF 17, Preset medium, `yuv420p` |
| Übergänge | Feste Folge für die Übergänge 1→2 bis 5→6: slideleft, wipeup, circleopen, slideup, slideleft |
| Bewegung | Ganzes Bild (auch Logo und Ortschip) zoomt linear um die Bildmitte von 100 auf 104 Prozent über die Szenendauer, außer in der Schlusskarte. Gemessen wird immer vor dem Zoom: Nach dem Zoom liegt die Grenze 1450 bei etwa 1470 und der Rand von 72 bei etwa 53 Pixel, die freie Zone ab 1500 bleibt frei. Oben läuft ein Fortschrittsbalken (Petrol, 16 Pixel hoch, Breite wächst mit der Zeit über das ganze Video) |
| Stimme | Eine feste synthetische deutsche Stimme für die ganze Reihe (bisher Piper, Modell `de-thorsten-low`), danach mit `atempo=0,86` verlangsamt. Je Szene eine eigene Sprechdatei |
| Ton | Szenenstimmen werden mit 0,5 s Vorlauf an den Szenenanfang gelegt. Musik läuft darunter und wird bei Stimme automatisch leiser (Sidechain). Ziel −14 LUFS, Spitze höchstens −1,5 dB. Kette siehe „Tonkette“ unten |
| Aussprache | Der Name wird für die Stimme „Plenarra“ geschrieben (nur im Sprechtext, nie im Bild) |

### Bewegungen der Elemente

| Art | Wirkung |
| --- | --- |
| Einblenden | Deckkraft 0 bis 100 Prozent, Standard 0,5 s, Verlauf kubisch auslaufend (schnell am Anfang, ruhig am Ende) |
| Gleiten | Wie Einblenden, dazu von 34 Pixel tiefer einschwebend |
| Poppen | Einblenden in 0,3 bis 0,4 s mit Start 20 bis 50 Prozent größer, die Größe klingt quadratisch auf 100 Prozent ab |
| Stempel | Poppen, danach klingt die Neigung von −5 Grad schwingend ab (Winkel −1 bis −9 Grad, etwa eine Sekunde) |
| Pulsieren | Dauerbewegung, Größe 100 bis 104 Prozent, Periode 2 s (Icon im Hook und Pille im Schluss) |

Pulsieren und Wackeln zählen in der Prüfung nicht als „neues Element“ (Abschnitt 13). Der Punktring im Hintergrund (Durchmesser 1500, Petrol, Deckkraft etwa 9 bis 13 Prozent) dreht sich mit etwa 30 bis 36 Grad je Sekunde.

### Tonkette

| Stufe | Wert |
| --- | --- |
| Stimme | Piper `de-thorsten-low`, danach `atempo=0,86`, 44,1 kHz. Pro Szene eine Datei, Startzeit = Szenenanfang + 0,5 s |
| Stimmenbus | Hochpass 90 Hz, Anhebung 3 dB bei 3,2 kHz, Kompressor (Schwelle 0,1, Verhältnis 3, Attack 5 ms, Release 120 ms, Ausgleich +2 dB) |
| Musik | Eigens erzeugt (Skript, keine fremde Datei, keine Lizenzfragen): ruhiger Akkordteppich Cmaj7, Am7, Fmaj7, G, je Akkord 4 s, dazu leise gezupfte Töne. Einblenden 1 s, Ausblenden 2 s am Ende, Pegel 0,6 |
| Ducking | Sidechain von der Stimme auf die Musik: Schwelle 0,02, Verhältnis 10, Attack 15 ms, Release 400 ms |
| Summe | Stimme und Musik gemischt, `loudnorm` auf −14 LUFS (Spitze −1,5 dB, LRA 7), danach genaue Pegelung auf −14 LUFS mit Begrenzer 0,84 (etwa −1,5 dB). AAC 192 kbit/s |
| Messung | EBU R128, integriert (`ebur128=peak=true`): Lautheit −14 ±1 LUFS, True Peak höchstens −1,5 dB |

## 3. Aufbau: sechs Szenen

Jede Folge hat dieselben sechs Szenen. Die Dauer einer Szene ist
**Szenendauer = Maximum aus Mindestdauer und (Stimmenlänge + 0,5 s Vorlauf + Nachlauf)**.
Beispiel: Stimme 5,5 s, Mindestdauer 6 s, Nachlauf 1 s ergibt Maximum aus 6 und 7,0, also 7,0 s. Die Länge des Videos ist die Summe der sechs Szenendauern. Mit den Mindestdauern allein sind es 42 s, mit dem Schluss bei 8,5 s und einem Zitat von 100 Zeichen etwa 43 s.

| Nr. | Szene | Mindestdauer | Nachlauf | Inhalt |
| --- | --- | --- | --- | --- |
| 1 | Hook | 6 s | 1 s | Zeile 1: Ort oder Rubrik mit Doppelpunkt (Schwarzgrau), Zeile 2: Thema oder Name des Vorgangs (Petrol, darf auf zwei Zeilen umbrechen). Optional eine Nebenzeile mit Stichwort oder Antragsteller. Darunter der Stempel mit nur dem Standwort (kein Zusatz, kein Icon), Neigung −5 Grad, danach das pulsierende Themen-Icon (Kreis 300, bei Platznot bis 220). Das Standwort fällt in den ersten acht gesprochenen Wörtern |
| 2 | Kern | 7 s | 2,5 s | Die Kernaussage groß, bei mehreren Varianten als Auswahl (A, B mit Buchstaben-Kreis) |
| 3 | Details | 7 s | 3 s | Betroffene oder Maßnahmen als Zeilen mit Icon, bei Abläufen mit Verbindungslinie, oder Kernzahlen mit Beschriftung |
| 4 | Zitat | Maximum aus 6,5 s und 0,07 s je Zeichen des Zitats (mit Leerzeichen und […], ohne äußere Anführungszeichen); die Szene ist stumm, es gibt keinen Nachlauf | – | Wörtlich aus der Vorlage, Schlüsselwörter (Datenblatt) in Petrol hervorgehoben, darunter „Aus der Vorlage · Ort“. Bei einem Stand außer „Beschlossen“ steht dort „Vorschlag aus der Vorlage · Ort“, damit ein Beschlussvorschlag nicht wie ein Beschluss wirkt. Wird nicht gesprochen, damit Zeit zum Lesen bleibt. Hier ist Stillstand gewollt (Lesezeit), die Ruhebild-Prüfung gilt für diese Szene nicht |
| 5 | Stand | 7 s | 1,5 s | Statuskarte mit Band in Statusfarbe, Badge, Statuswort, darunter Gremium und „zuletzt beraten am …“, bei Bedarf nächste Sitzung |
| 6 | Schluss | 8,5 s | 1 s | Titel „Beschlüsse zu Ihrem Ort“, Logo groß, festes Motto, plenara.de als pulsierende Pille, Quelle und Hinweis „kein amtliches Dokument“ |

Schlusskarte (von oben, ohne Logo und Ortschip oben, Beginn bei y = 190, Abstände in Klammern): Titel „Beschlüsse zu Ihrem Ort“ 100 in Schwarzgrau, bricht bei 700 Pixel Breite in zwei Zeilen um (24), Zeile „finden Sie bei“ 64 mit Pin 76 (20), Logo 520 breit (40), Motto 64 in bis zu zwei Zeilen (40), Pille plenara.de 104 mit 55 Pixel Rand links und rechts, 20 oben und unten (46), Quelle 50, darunter (14) Hinweis „Zusammenfassung von Plenara, kein amtliches Dokument.“ 48. Quelle und Hinweis dürfen umbrechen. Das Ende liegt bei höchstens 1450 (das Bauskript meldet den Wert). Das Motto lautet „Besser verstehen, was vor Ort beraten wird.“ Die Folge baut die Karte gestaffelt auf: Pin und Zeile ab 0,4 s, Logo ab 0,3 s, Motto ab 1,1 s, Pille ab 1,5 s, Quelle und Hinweis ab 1,6 s.

Die Schlussszene verwendet in jeder Folge dieselbe Sprechdatei mit dem Wortlaut „Beschlüsse und Unterlagen zu Ihrem Ort finden Sie bei Plenarra.“ (etwa 3,5 s; die Szene dauert deshalb immer 8,5 s). Das Datenblatt enthält also fünf Sprechteile und die feste Schlussdatei. Richtwert für die Stimme: etwa 2 Wörter pro Sekunde (verlangsamt, lange Zahlwörter weniger). Wortbudget der fünf Sprechteile zusammen: höchstens etwa 75 Wörter, sonst wird das Video länger als 65 s.

## 4. Layout und Abstände

Rand links und rechts 72 Pixel, Satzbreite 936 Pixel. Logo-Chip (links) und Ortschip (rechts daneben, Abstand 20, gleiche Höhe, leichter Schatten) stehen bei y = 190, ab dort in jeder Szene außer dem Schluss. Inhalte beginnen bei y = 350 bis 400 (Hook ab 400, Zitat mittig im Feld 400 bis 1440) und enden bei höchstens 1450. Ab y = 1500 bleibt alles frei, dort liegen die Bedienelemente der Apps. Text ist links ausgerichtet, der Stempel, das Statuswort und die Icons im Hook und im Stand sind mittig.

Schriftgrößen sind **Höchstwerte in Pixel**. Passt ein Text nicht in die Satzbreite, wird er in Schritten von 2 bis 6 Pixel verkleinert, bis jede Zeile passt. Untergrenzen: 44 für jeden Text, 56 für Zitate, 72 für Titelzeilen (darunter wird umgebrochen oder gekürzt), 100 für Statuswort und Stempel (darunter anderes Wort wählen).

| Element | Größe |
| --- | --- |
| Titel im Hook, Zeile 1 | bis 108 |
| Hook, Zeile 2 (Thema) | bis 104, darf zweizeilig sein |
| Nebenzeile im Hook (Stichwort, Antragsteller) | 56 bis 68, Nebenzeilenfarbe |
| Stempel | Schrift bis 168, Gesamtbreite einschließlich 150 Pixel Polster höchstens 860 vor der Drehung |
| Ortschip | Petrol-Pille mit weißem Pin und Ortsname 44 SemiBold weiß, Höhe wie der Logo-Chip (Logo 300 breit auf weißem Chip). Der Ortsname ist der Kurzname ohne Gemeindeart („Dresden“, nicht „Landeshauptstadt Dresden“) |
| Kernaussage | Zwei große Zeilen bis 150 (Schlagzeile mit höchstens etwa 25 Zeichen je Zeile) oder, wenn sie ein ganzer Satz ist, 70 bis 84 |
| Zeilen in Listen | Text 76 bis 84, Icon-Kreis 176, Zeilenabstand 238 (Kreis plus 62) |
| Zitat | von 92 abwärts in 2-Pixel-Schritten, bis es höchstens 800 Pixel hoch ist und das längste Wort in die Satzbreite (abzüglich 40) passt |
| Statusbadge und -wort | Badge 300, Wort bis 190 (bei langen Wörtern wie „Beschlossen“ 140 bis 170), Band darüber mit Beschriftung 48 |
| Meta-Zeilen im Stand | 52 bis 60, Schwarzgrau |
| Zitat-Unterzeile | 54 |
| Quelle und Hinweis im Schluss | 50 und 48 |

Auswahlkarten (A, B): Buchstaben-Kreis 176, Text 76, Abstand zwischen den Karten etwa 110. Kernzahlen: Zahl 118 bis 140 in Petrol, Beschriftung 56, Zahlblöcke mit etwa 64 Pixel Abstand, rechts ein Icon-Kreis 130 bis 150.

Lange Wörter: Das längste Wort jedes Textes muss in die Satzbreite (936 Pixel) passen. Sonst bei Zitaten mit […] kürzen, bei eigenen Texten ein kürzeres Wort oder eine Abkürzung (nach der ersten Nennung) wählen. Die Schrift eines Zitats wird nicht unter 56 Pixel verkleinert, ein längeres Zitat wird gekürzt. Ein Zitat hat höchstens etwa 150 Zeichen.

Kein Text unter 44 Pixel. Zwischen Gruppen mindestens 40 Pixel Abstand, zwischen Zeilen einer Liste 60 Pixel und mehr. Labels (Pillen, Überschriften) stehen auf einer Zeile und haben höchstens sechs Wörter. Vor jeder Veröffentlichung wird die Unterkante jedes Elements gemessen (Prüfung im Skript), nicht nach Gefühl.

### Icons im Bestand

Themen-Icons im Hook und in Zeilen kommen aus dem vorhandenen Satz (ein Stil: Petrol-Kreis mit weißem Symbol). Neue Symbole nur im selben Linienstil und mit derselben Strichstärke ergänzen.

| Thema | Icon |
| --- | --- |
| Ort, Treffpunkt | Pin |
| Bäume, Grün | Baum, Baum mit Maß |
| Hitze, Sonne | Thermometer, Sonne |
| Wasser, Starkregen | Tropfen, Regenwolke |
| Betroffene | Ältere (Person), Kind, Herz (Vorerkrankte), Gruppe |
| Geld, Förderung | Münze |
| Verfahren, Unterlagen | Dokument, Stift, Kran (Bau), Lupe |
| Wohnen, Gebäude | Haus |
| Kinder, Schule, Bildung | Kind |
| Verkehr, Straße | Pin; wer ein Schild oder Auto braucht, ergänzt es im selben Stil und trägt es hier ein |
| Gremium, Rathaus | Halle |
| Termin | Kalender |
| Stand | Haken, Kreuz, Sanduhr |

Für Themen ohne Symbol (zum Beispiel Wärme) das nächstliegende Symbol nehmen (Haus) oder ein neues im selben Stil ergänzen und hier eintragen.

## 5. Stil und Farben

Der Look folgt dem verbindlichen Farbschema „Petrol klar“ (`docs/farbschema-petrol-klar-2026-10-17.pdf`).

| Element | Regel |
| --- | --- |
| Hintergrund | Weiß mit zartem Petrol-Schimmer (Petrol bei sehr geringer Deckkraft) und drehendem Punktring (Petrol, Deckkraft etwa 9 bis 13 Prozent), nie Petrol als Fläche, keine Fotos |
| Pille plenara.de | Petrol-Fläche, weiße Schrift |
| Schrift | IBM Plex Sans, Überschriften SemiBold, Text Regular |
| Akzent | Petrol `--rm-fill` (#268478) für Icons, Hervorhebungen, Zahlen |
| Text | Schwarzgrau `--rm-c900` (#18181B) für Titel, Kernaussage, Zitat, Listentexte, Meta-Zeilen, Quelle und Hinweis; Nebenzeilen (Stichwort, Antragsteller, Zitat-Unterzeile) `--rm-c600` (#52525B), mindestens 48 Pixel; Weiß `--rm-on` (#FFFFFF) auf Petrol und Statusfarben |
| Status beschlossen | Dunkelblau `--rm-ok` (#0C4A6E) |
| Status abgelehnt | Orange-Braun `--rm-no` (#B45309) |
| Status offen (alle übrigen) | Grau `--rm-c700` (#3F3F46) |
| Icons | Ein Stil: Kreis in Petrol (Statusfarbe im Stand) mit weißem Symbol |
| Logo | Echtes Plenara-Logo mit Ortschip dauerhaft oben links, groß in der Schlusskarte |
| Motto | Festes Motto der Reihe unter dem Logo, im Repo festgelegt |

Es gelten nur die Farben des Farbschemas, die Werte stehen in `app/styles/tokens.css`. Die ersten vier Folgen verwenden für „offen“ ein etwas bläuliches Grau (#3F4850), das dort nicht vorkommt. Ab der nächsten Folge gilt `--rm-c700`, die vier Folgen werden bei Gelegenheit neu gerendert.

### Status und Wortlaut

Die Videos verwenden die Stände von Plenara (`STATUS` in `shared/types.ts`), mit demselben Wort. Der Stand wird in der Stand-Szene immer mit Wort und Icon gezeigt, nie nur mit Farbe. Einzige Ausnahme ist der Stempel im Hook: er zeigt nur das Wort in der Statusfarbe, das Icon folgt in der Stand-Szene. Alles außer „Beschlossen“, „Abgelehnt“ und „Zur Kenntnis“ trägt den Zusatz „Noch nicht beschlossen“ (bei „Vertagt“ „Noch nicht entschieden“), damit eine Empfehlung oder Ankündigung nicht wie ein Beschluss wirkt. Die Statusfarben sind Vorgabe des Farbschemas; Haken und Kreuz sind die Symbole von Plenara selbst.

| Plenara-Stand | Wort im Video | Farbe | Icon | Zusatzzeile |
| --- | --- | --- | --- | --- |
| `approved` | Beschlossen | Dunkelblau | Haken | keine |
| `rejected` | Abgelehnt | Orange-Braun | Kreuz | keine |
| `announced` | Angekündigt | Grau | Kalender | Noch nicht beschlossen |
| `consulting` | In Beratung | Grau | Sanduhr | Noch nicht beschlossen |
| `recommended` | Empfehlung | Grau | Dokument | Noch nicht beschlossen |
| `postponed` | Vertagt | Grau | Sanduhr | Noch nicht entschieden |
| `unknown` | Stand offen | Grau | Sanduhr | Noch nicht beschlossen |
| `info` | Zur Kenntnis | Grau | Dokument | Keine Sachentscheidung (nur in Ausnahmefällen als Folge) |

Gebaut und gesehen sind bisher Beschlossen, Abgelehnt, Stand offen und Angekündigt. Die übrigen Zeilen sind noch nicht in einem Video erprobt. Wichtig: Ein Beschluss belegt laut Plenara noch keine Umsetzung, das Video sagt deshalb „beschlossen“ und nicht „umgesetzt“.

## 6. Bewegung und Takt

- Etwas Neues erscheint etwa alle ein bis zwei Sekunden, ungefähr dann, wenn es gesprochen wird. Listenzeilen erscheinen gestaffelt: erst das Icon, 0,25 s später der Text.
- Jede Szene zeigt innerhalb von 0,8 s etwas Lesbares außer Logo, Ortschip und Balken (kein leerer Szenenanfang, kein Ruhebild über mehrere Sekunden).
- Der Stempel im Hook erscheint 0,3 s vor dem gesprochenen Standwort, frühestens bei 1,8 s und spätestens bei 5,0 s (Standwort deshalb in den ersten acht Wörtern). Die Zeit des Standworts kommt aus der Sprechdatei: Die Wortzeiten werden anteilig nach Zeichenzahl über die Länge der Sprechdatei verteilt.
- Zahlen zählen nicht hoch, sie erscheinen fertig.
- Die Schlussszene baut sich gestaffelt auf, die Adresse pulsiert, Quelle und Hinweis erscheinen früh genug, um gelesen zu werden.

## 7. Datenblatt je Folge

Jede Folge entsteht aus einem Datenblatt mit diesen Feldern. Ohne vollständiges Datenblatt wird nicht gebaut.

| Feld | Hinweis |
| --- | --- |
| Vorgang | Kennung bei Plenara (verhindert doppelte Folgen). Eine Testfolge ohne Plenara-Eintrag trägt „Test“ und wird nicht veröffentlicht |
| Ort | wie in der Quelle |
| Stand | genau einer der Stände aus der Tabelle in Abschnitt 5, abgeleitet aus der jüngsten Station des Vorgangs. Der Verlauf liefert nur Datum und Sitzung, nicht den Stand |
| Gremium der letzten Beratung | wie in der Quelle |
| Datum der letzten Beratung | im Bild TT.MM.JJ (29.10.26), im Sprechtext Tag und Monat ausgeschrieben, ohne Jahr („am neunundzwanzigsten Oktober“) |
| Gremium und Datum der nächsten Sitzung | nur wenn in den Unterlagen vorhanden. Künftige Termine heißen „nächste Sitzung“, vergangene „zuletzt beraten am“ |
| Titel und Stichwort | Titel zeigt Ort (Zeile 1) und Thema (Zeile 2), Stichwort oder Antragsteller klein darunter. Pro Zeile höchstens etwa 16 bis 20 Zeichen bei voller Größe, längere Zeilen werden verkleinert (Untergrenze 72) |
| Themen-Icon | ein Symbol aus Abschnitt 4 |
| Antragsteller | nur wenn die Vorlage ihn nennt, nur im Bild (Abschnitt 9, Punkt 4) |
| Kernaussage | ein Satz; bei mehreren Varianten Buchstaben und Kurztexte |
| Details | drei bis vier Zeilen mit Icon, oder Kernzahlen mit Beschriftung. Termine und Beträge als Zeilen (Datum TT.MM.JJJJ oder „Februar 2027“), Kosten gezeigt, nicht gesprochen |
| Abstimmung | wenn die Vorlage sie nennt: Ja, Nein, Enthaltungen in der Reihenfolge der Vorlage (Abschnitt 9, Punkt 8) |
| Wirksam ab / nächster Schritt | wenn vorhanden, als Detailzeile oder in der Stand-Szene („Nächster Schritt: …“, ohne Gremium als Zeile ohne Kalender-Icon) |
| Originalzitat | wörtlich, höchstens etwa 150 Zeichen (gezählt mit Leerzeichen und […]), Auslassungen mit […], innere Anführungszeichen einfach (‚…‘). Bei mehreren Varianten wird ein Satz der Kernentscheidung zitiert, die Varianten stehen in der Kern-Szene. Bei mehreren Sätzen gilt der Satz mit der Kernentscheidung, Kosten gehören in die Details |
| Schlüsselwörter | zwei bis vier Wörter des Zitats, die in Petrol hervorgehoben werden |
| Quelle | „Quelle: öffentliche Ratsunterlagen der …“ mit der Gemeindeart, wie die Kommune sich selbst nennt (Gemeinde Oststeinbek, Landeshauptstadt Dresden); darf zweizeilig sein |
| Sprechtext | fünf Teile (Zitat bleibt leer) plus die feste Schlussdatei, laut Regeln in Abschnitt 8 |

## 8. Regeln für den Sprechtext

- Anrede „Sie“, Sätze mit höchstens etwa 14 Wörtern.
- Zahlen, Jahre und Daten ausgeschrieben, damit die Stimme sie richtig liest. Sehr lange Zahlwörter vermeiden: Beträge lieber zeigen als vorlesen, das verkürzt die Szene deutlich.
- Der Sprechtext darf kürzer sein als der Bildtext, aber nichts sagen, was nicht in der Vorlage steht.
- Das Zitat wird nicht gesprochen.
- Fachwörter (zum Beispiel „Quartierswärmemanagement“) werden nur erklärt, wenn die Vorlage oder das Plenara-Glossar (`docs/technik/glossar.md`) die Erklärung liefert. Sonst bleibt das Fachwort stehen, eine Abkürzung ist nach der ersten Nennung erlaubt. Eigene Deutungen kommen nicht dazu.
- Der Stand steht im ersten Satz, das Standwort unter den ersten acht Wörtern. Die Beträge und Zahlen, die im Bild stehen, müssen nicht vorgelesen werden.
- Fraktions- und Parteinamen werden nicht gesprochen („ein Antrag einer Fraktion“), auch wenn sie im Bild stehen.
- Der Name der Stadt ist in der Schlussdatei nicht enthalten, weil die Datei für alle Folgen gilt.

## 9. Inhaltsregeln

1. Sachlich und neutral. Berichtet wird, was beschlossen oder beraten wurde, nicht bewertet. Keine Superlative, keine Vergleiche.
2. Quelle immer sichtbar (Zitatunterzeile und Schlusskarte). Absender ist Plenara, nicht die Kommune.
3. Zitate wörtlich. Was als „Aus der Vorlage“ erscheint, ist Originaltext. Eigene Zusammenfassungen sind keine Zitate.
4. Antragsteller nur, wenn die Vorlage sie nennt. Sie stehen klein in der Nebenzeile (Nebenzeilenfarbe), nie im Titel, nie im Stempel und nie im gesprochenen Text.
5. Empfehlung ist kein Beschluss. Begriffe wie „Förderung empfohlen“ gehören mit „Noch nicht beschlossen“ zusammen.
6. Gegenprüfung vor der Veröffentlichung: Zahlen, Daten, Namen und Zitat gegen die Vorlage prüfen, durch jemanden, der das Video nicht gebaut hat.
7. Keine Bilder erkennbarer Personen. Ohne Fotos entfällt die Bildkennzeichnung.
8. Abstimmungsergebnisse stehen als Zahlen in der Reihenfolge der Vorlage, alle in derselben Farbe (Zahl Petrol, Wort Schwarzgrau), nie als Gegenüberstellung, Balken oder mit Wörtern wie „knapp“ oder „deutlich“.
9. Angekündigte Folgeschritte (zum Beispiel ein neuer Antrag) stehen nur, wenn die Vorlage sie nennt, mit demselben Gewicht wie die übrigen Meta-Zeilen.
10. Ist der Stand nicht „Beschlossen“, heißt das Zitat „Vorschlag aus der Vorlage“.

## 10. Ablauf

1. Datenblatt ausfüllen und gegen die Vorlage prüfen.
2. Sprechtext schreiben, Stimme erzeugen, auf 86 Prozent verlangsamen und je Szene ablegen.
3. Szenen nach Abschnitt 3 bis 6 bauen, die Dauern ergeben sich aus der Stimme.
4. Unterkanten messen (höchstens 1450) und prüfen, dass kein Wort angeschnitten ist.
5. Prüfen nach Abschnitt 13: erst die Maschinenprüfung, dann Panel mit Vergleich Alt gegen Neu, Befunde ins Register, höchstens drei pro Runde.
6. Ton und Länge sind Teil der Maschinenprüfung.
7. Gegenprüfung des Inhalts (Abschnitt 9, Punkt 6) mit Quelle und Datenblatt.
8. Beschreibungstext schreiben: erster Satz ist der Kern, dann der Link zum Vorgang bei Plenara, drei bis fünf Hashtags (Ort, Thema, Kommunalpolitik).

## 11. Typische Fehler aus den Prüfrunden

- Text reicht in die untere Zone ab y = 1500 (Zeilen zu groß oder Abstände zu eng).
- Sehr lange Wörter (etwa „Quartierswärmemanagements“) werden angeschnitten: Schrift verkleinern oder das Zitat mit […] kürzen.
- Ein Label bricht in zwei Zeilen um und überlappt das Icon.
- Eine Szene beginnt leer, weil das erste Element zu spät erscheint.
- Kleine graue Nebenzeilen sind für viele kaum lesbar: Nebenzeilenfarbe (#52525B), mindestens 48 Pixel, Meta-Zeilen im Stand in Schwarzgrau.
- Titelzeilen, die bei voller Größe nicht in die Satzbreite passen, werden zu klein: Zeile kürzen oder umbrechen statt unter 72 Pixel gehen.
- Der Stempel zeigt das Ergebnis, bevor Titel und Thema gelesen werden können (vor 1,8 s) oder ohne dass die Stimme es nennt. Mehrere Prüfpersonen empfanden das bei Ablehnungen als wertend. Offen bleibt, ob ein flaches Statusschild nach der ersten Aussage noch besser wäre (Abschnitt 12).
- Fachwörter aus der Vorlage (etwa „Mittel einstellen“) bleiben unverständlich: wenn möglich in Klartext fassen, ohne den Sinn zu ändern.

## 12. Noch nicht umgesetzt

- Aufnahme der echten Plenara-Seite („Plenara-Moment“) als Szene vor dem Schluss.
- Menschliche oder hochwertige Stimme für die ganze Reihe.
- Flaches Statusschild statt schräger Stempel, erst nach der ersten Aussage.
- Graues „offen“ in den vier Folgen auf `--rm-c700` umstellen (neu rendern).
- Die Status Empfehlung, In Beratung, Vertagt und Zur Kenntnis in je einer Folge erproben.
- Messung von Sehdauer, Speichern, Teilen und Klicks nach der Veröffentlichung.
- Die Maschinenprüfung aus Abschnitt 13 liegt bisher nur teilweise im Bauskript (Unterkanten, Wortbreite). Layoutprotokoll, leerer Szenenanfang, Ruhebild, Mindestschrift, Stimme gegen Musik und Ton sind noch zu automatisieren. Die Schwelle „12 dB“ ist ein Startwert.
- Bildrate und Wortzeiten: Die Zeiten der Wörter werden aus der Zeichenzahl geschätzt, nicht gemessen. Eine Zeitmarkierung aus der Sprechdatei (Wortausrichtung) würde den Stempel und die Listenzeilen genauer an die Stimme binden.
- Das Panel aus Abschnitt 13 ist noch nicht an einer Folge erprobt, die Werte der Tabelle sind Startwerte.

## 13. Prüfverfahren: jede Runde muss besser werden

In den ersten zehn Runden prüfte jedes Mal eine andere Person, die Noten sprangen zwischen 5 und 7, und Befunde widersprachen sich (zu schnell, zu langsam). Das Verfahren unten beseitigt das Rauschen: gleiche Messlatte, harte Maschinenprüfung, Vergleich von Alt und Neu statt Schulnote, und eine Änderung wird nur übernommen, wenn sie nachweislich besser ist.

### Grundsätze

1. **Erst Maschine, dann Mensch.** Alles, was sich messen lässt, wird automatisch geprüft und ist ein Ausschlusskriterium. Personen beurteilen nur, was sich nicht messen lässt.
2. **Vergleichen statt benoten.** Prüfpersonen bekommen Alt und Neu, in zufälliger Reihenfolge und ohne Hinweis, welche Fassung neu ist, und entscheiden je Kriterium, welche besser ist. Ein Vergleich ist weit weniger verrauscht als eine Note von 1 bis 10.
3. **Eine feste Messlatte.** Dieselben Kriterien mit festen Ankern in jeder Runde (Abschnitt „Kriterien“). Keine freie Bewertung.
4. **Festes Panel plus ein Gast.** Drei feste Prüfpersonen (Rollen unten) sehen jede Fassung. Dazu kommt je Runde eine wechselnde Gastperson für neue Blickwinkel. Befunde des Gasts gelten erst, wenn sie zweimal vorkommen oder messbar sind.
5. **Ein Befundregister.** Jeder Befund hat eine Nummer, einen Status und einen Nachweis. Eine Runde bearbeitet höchstens drei Befunde, damit klar bleibt, was wirkte.
6. **Nur Fortschritt übernehmen.** Eine Änderung gilt als besser, wenn sie den Befund beseitigt, kein Kriterium verschlechtert und alle Maschinenprüfungen besteht. Sonst wird sie verworfen.

### Maschinenprüfung (Ausschlusskriterien)

Jede Fassung muss bestehen, bevor Personen sie sehen. Das Bauskript schreibt dafür je Szene ein Layoutprotokoll (Liste der Elemente mit Art, Rechteck vor dem Zoom, Schriftgröße, Wortbreiten, Einblend- und Ausblendzeit). Dauerhafte Elemente (Logo, Ortschip, Fortschrittsbalken, Hintergrund, Punktring) sind als „Rahmen“ markiert und zählen bei den Prüfungen zu Szenenanfang und Ruhebild nicht. Das Prüfskript liest nur dieses Protokoll und die fertige Datei und gibt je Prüfung Messwert, Grenze und Ergebnis aus (Exit-Code ungleich 0 bei einem Fehler).

| Prüfung | Grenze | Messung |
| --- | --- | --- |
| Unterkante aller Inhalte je Szene | höchstens 1450 Pixel | Protokoll, größte Unterkante aller Elemente zu jeder Zeit, einschließlich Pop-Überschwingern, vor dem Zoom |
| Kleinste Schrift | mindestens 44 Pixel | Protokoll |
| Angeschnittene Wörter | keines | längstes Wort je Text höchstens 936 Pixel (Zitat 896), Stempel höchstens 860, kein Element über den Bildrand hinaus |
| Leerer Szenenanfang | in den ersten 0,8 Sekunden jeder Szene ist ein Element mit Text oder Symbol (ohne Rahmen) sichtbar | Protokoll, Einblendzeit relativ zum Szenenanfang |
| Ruhebild | höchstens 4 Sekunden ohne neues Element | größte Lücke zwischen den Einblendzeiten (ohne Rahmen) innerhalb einer Szene, auch vom letzten Element bis Szenenende; Pulsieren und Wackeln zählen nicht. Ausnahme: Zitat-Szene |
| Zitat | höchstens 800 Pixel hoch, Quelle darunter | Protokoll |
| Ton | −14 LUFS (±1), True Peak höchstens −1,5 dB | EBU R128 integriert (Abschnitt 2, Messung) |
| Stimme gegen Musik | Während die Stimme läuft, liegt die Musik im Mittel mindestens 12 dB darunter (Startwert, noch nicht an einer Folge gemessen) | Pegel in Fenstern von 1 s, Stimme und Musik getrennt vor dem Mischen |
| Länge | 40 bis 65 Sekunden | Dauer der Datei |
| Fakten | Zahlen, Daten, Namen und Zitat stimmen mit der Vorlage überein | **Handprüfung** (Person oder Agent, der nur Vorlage und Datenblatt sieht), kein Skript |

### Kriterien (feste Messlatte, je 0 bis 2)

Jede Prüfperson vergibt je Fassung und Kriterium 0 (Mangel), 1 (in Ordnung) oder 2 (gut), mit dem Anker aus der Tabelle. Dieselbe Tabelle gilt in jeder Runde.

| Kriterium | 2 = gut | 0 = Mangel |
| --- | --- | --- |
| Verstehen in 3 Sekunden | Ort und Thema sind ohne Ton nach 3 Sekunden klar, der Stand nach 6 Sekunden | Man weiß nach 3 Sekunden nicht, worum es geht |
| Kern in einem Satz | Ich kann den Beschluss danach in einem Satz sagen | Ich weiß nicht, was entschieden wurde |
| Lesbarkeit | Alles bequem lesbar auf dem Handy auf Armlänge | Wichtiger Text ist zu klein oder blass |
| Tempo | Ich komme gut mit, nichts ist zu schnell oder zäh | Ich muss zurückspulen oder langweile mich |
| Neutralität | Nichts wirkt wertend oder parteiisch | Farbe, Wortwahl oder Reihenfolge wirkt wertend |
| Vertrauen | Quelle und Stand sind klar, nichts wirkt übertrieben | Ich zweifle, woher das stammt |
| Was heißt das für mich | Ich sehe, was es für Betroffene bedeutet oder was als Nächstes passiert | Offen, warum es mich betrifft |
| Plenara merken | Ich weiß am Ende, wo ich das finde | Der Aufruf ist untergegangen |

Die Rolle der Prüfperson ändert die Kriterien nicht, nur den Blick. Gesamtwert einer Fassung ist die Summe der Mediane je Kriterium über das feste Panel (höchstens 16).

### Panel

| Rolle | Blick | Schwerpunkt |
| --- | --- | --- |
| Bürger mit wenig Zeit | Mutter oder Vater, schaut nebenbei, oft ohne Ton | Verstehen, Tempo, „Was heißt das für mich“ |
| Ältere Person mit schwacher Sehkraft | Handy auf Armlänge | Lesbarkeit, Tempo |
| Kommunalpolitiker oder Redakteur | prüft Sachlichkeit | Neutralität, Vertrauen, Fakten |
| Gast (wechselt) | zum Beispiel Designer, Stratege, Barrierefreiheit | frischer Blick, Befund zählt erst ab zweiter Nennung |

Jede Prüfperson ist ein frischer Agent ohne Vorwissen. Er bekommt nur die Bilder, den festen Briefkasten (Abschnitt „Material für die Prüfung“) und nicht die Absicht der Änderung. In der ersten Runde einer Folge gibt es keine Alt-Fassung: das Panel vergibt dann nur die Werte je Kriterium, der Vergleich beginnt ab der zweiten Fassung.

### Material für die Prüfung

Je Fassung ein Kontaktbogen (ein Bild alle 1,5 Sekunden, 8 Spalten, 270 Pixel Breite, Zeitmarke in Sekunden unter jedem Bild) und zusätzlich Einzelbilder in voller Auflösung je Szene bei 0,8 s und 2,5 s nach Szenenbeginn und 0,5 s vor Szenenende. Kontaktbögen eignen sich für Tempo und Abfolge, nicht für Schriftgrößen: Dafür gelten die Maschinenprüfung und die Einzelbilder.

**Briefkasten** (steht jeder Prüfperson in dieser Form bei, damit feste Vorgaben nicht jedes Mal als Mangel gemeldet werden):

- Hochformat 9:16 für Reels, TikTok und Shorts, auch stumm lesbar.
- Bewusst fest: keine Fotos, keine Untertitel, weißer Hintergrund mit zartem Petrol-Schimmer, Farbschema „Petrol klar“, Statusfarben (Dunkelblau beschlossen, Orange-Braun abgelehnt, Grau offen), die Zone ab 1500 Pixel unten bleibt frei, festes Logo und Ortschip oben, Schlusskarte mit festem Motto, synthetische Stimme.
- Inhalt: Das Video informiert über einen echten Ratsbeschluss und nennt Plenara als Quelle. Es wirbt nicht.
- Gefragt sind die acht Kriterien der Tabelle mit 0, 1 oder 2 und je Befund Szene und Zeitpunkt.

### Ablauf einer Runde

1. **Maschinenprüfung** der neuen Fassung. Fällt etwas durch, wird zuerst das behoben.
2. **Panel vergleicht** Alt gegen Neu (zufällige Reihenfolge) und vergibt die Werte je Kriterium. Befunde mit Zeitpunkt und Szene.
3. **Befunde ins Register** (Nummer, Szene, Kriterium, wer, wie oft, messbar?). Doppelte werden zusammengeführt.
4. **Auswahl:** Höchstens drei Befunde mit der größten Wirkung (zuerst Ausschlusskriterien, dann Befunde mit zwei oder mehr Nennungen).
5. **Ändern** und neu rendern.
6. **Wiederholung** ab Schritt 1 mit Alt = letzte übernommene Fassung.
7. **Übernahme nur bei Fortschritt:** Befund behoben, kein Kriterium schlechter (Median des Panels), Maschinenprüfung bestanden. Sonst zurück zur letzten übernommenen Fassung und anderen Weg wählen.

### Befundregister

| Nr. | Szene | Kriterium | Befund | Nennungen | Messbar | Status | Nachweis |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5 | Tempo | Leerer Szenenanfang | 3 | ja | behoben | Maschinenprüfung Runde 4 |

Status: offen, in Arbeit, behoben (mit Nachweis), verworfen (mit Grund, zum Beispiel „bewusste Vorgabe“ oder „widerspricht einem Befund mit mehr Nennungen“).

### Umgang mit Widersprüchen

Widersprechen sich Prüfpersonen (zu schnell, zu langsam), gilt der Vergleich Alt gegen Neu: Welche Fassung wählt das Panel mehrheitlich? Wird nichts mehrheitlich gewählt, bleibt die Fassung, die kürzer oder einfacher ist. Ein Befund, der einer Vorgabe im Bauplan widerspricht, wird entweder als „bewusste Vorgabe“ verworfen oder der Bauplan wird geändert, nie beides stillschweigend.

### Abbruch

Die Prüfung endet, wenn zwei Runden hintereinander keine Änderung übernommen wurde, oder wenn der Gesamtwert 13 von 16 erreicht und kein Ausschlusskriterium offen ist. Offene Befunde mit Begründung stehen im Register und im Abschnitt „Noch nicht umgesetzt“.

### Nach der Veröffentlichung

Sehdauer, Speichern, Teilen und Klicks werden je Folge festgehalten und neben die Panelwerte gelegt. Sobald genug Folgen vorliegen, zeigt sich, welche Kriterien die Wirkung wirklich vorhersagen. Die Gewichte der Kriterien werden dann angepasst, nicht die Kriterien selbst.

## 14. Prüfprotokoll des Bauplans

Der Bauplan wird wie eine Folge geprüft: Agenten ohne Vorwissen bauen aus ihm und einer erfundenen Vorlage ein Datenblatt, einen Szenenplan, einen Sprechtext und die Dauern und melden jede Stelle, an der sie raten mussten. Eine Runde ist beendet, wenn die Befunde eingearbeitet sind. Der Bauplan gilt als fertig, wenn zwei Runden hintereinander keine Änderung mehr ergeben.

| Runde | Prüfer | Befunde | Änderung |
| --- | --- | --- | --- |
| 1 | Folge „Tempo 30“ (beschlossen), Folge „Mittagessen“ (abgelehnter Antrag), Technikprüfung | 12 + 12 + 12 | Dauerformel, Tonkette, Animationen, Schlusskarte mit Maßen und fester Sprechdatei, Hook-Aufbau, Farbzuordnung je Element, Datenblattfelder, Regeln zu Antragsteller und Abstimmung, Maschinenprüfung mit Messmethode, Briefkasten |
