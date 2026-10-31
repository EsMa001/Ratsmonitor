# Bauplan: Social-Media-Videos (Hochformat)

Stand 31.10.2026. Gilt nur für Videos auf Instagram Reels, TikTok und YouTube Shorts. Die Erklärvideos auf plenara.de (`docs/videos/`) sind eine eigene Reihe mit eigenem Regelwerk. Sprechtexte und Datenblätter der einzelnen Folgen gehören nicht in dieses Dokument.

## 1. Ziel und Rahmen

Jedes Video erklärt einen echten Ratsbeschluss (oder Vorgang) so, dass Bürger ihn in 42 bis 65 Sekunden verstehen. Plenara tritt als Quelle auf, nicht als Werbebotschaft: Logo und Ortschip stehen in den Szenen 1 bis 5 von Anfang an oben, die Schlusskarte zeigt das Logo groß und nennt plenara.de als einzigen Aufruf. Etwa vier Fünftel der Zeit gehören dem Beschluss.

Die Videos kommen ohne Fotos und ohne eingebrannte Untertitelspur aus. Sie müssen auch stumm lesbar sein: Bildtext, Icons und Statusfarben tragen den Kern, die Stimme ergänzt. Was in den Netzen über Sehen, Weiterwischen und Teilen entscheidet (erste Sekunde, Sicherheitszonen, Länge, Beschreibung, Messung), steht in Abschnitt 16.

## 2. Technik

| Punkt | Vorgabe |
| --- | --- |
| Format | 1080 × 1920 (9:16), 30 Bilder pro Sekunde, MP4 mit H.264 (CRF 16 bis 17) und AAC |
| Länge | 36,5 bis 65 Sekunden (untere Grenze folgt aus den Mindestdauern), Summe der Szenendauern (Abschnitt 3). Wird es mehr, wird der Sprechtext gekürzt, nicht die Lesezeit |
| Bildaufbau | Jedes Einzelbild wird per Skript gezeichnet (Python mit PIL) und an ffmpeg übergeben (H.264, CRF 16, Preset veryfast, 4:2:0). Szenen werden einzeln gerendert, jede außer der letzten 0,2 s länger als ihre Dauer, und mit `xfade` (0,2 s) verbunden. Die Überblendung liegt über dem Anfang der folgenden Szene, die Gesamtlänge ist deshalb die Summe der Szenendauern. Verbund: CRF 17, Preset medium, `yuv420p` |
| Übergänge | Feste Folge für die Übergänge 1→2 bis 5→6: slideleft, wipeup, circleopen, slideup, slideleft |
| Bewegung | Ganzes Bild (auch Logo und Ortschip) zoomt linear um die Bildmitte von 100 auf 104 Prozent über die Szenendauer, außer in der Schlusskarte. Gemessen wird immer vor dem Zoom: Nach dem Zoom liegt die Grenze 1450 bei etwa 1470 und der Rand von 72 bei etwa 53 Pixel, die freie Zone ab 1500 bleibt frei. Oben läuft ein Fortschrittsbalken (Petrol, 16 Pixel hoch, Breite wächst mit der Zeit über das ganze Video); er zoomt nicht mit |
| Stimme | Eine feste synthetische deutsche Stimme für die ganze Reihe (bisher Piper, Modell `de-thorsten-low`), danach mit `atempo=0,86` verlangsamt. Je Szene eine eigene Sprechdatei |
| Ton | Szenenstimmen werden mit 0,5 s Vorlauf an den Szenenanfang gelegt. Musik läuft darunter und wird bei Stimme automatisch leiser (Sidechain). Ziel −14 LUFS, Spitze höchstens −1,5 dB. Kette siehe „Tonkette“ unten |
| Aussprache | Der Name wird für die Stimme „Plenarra“ geschrieben (nur im Sprechtext, nie im Bild) |

### Bewegungen der Elemente

| Art | Wirkung |
| --- | --- |
| Einblenden | Deckkraft 0 bis 100 Prozent, Standard 0,5 s, Verlauf kubisch auslaufend (schnell am Anfang, ruhig am Ende) |
| Gleiten | Wie Einblenden, dazu von 34 Pixel tiefer einschwebend |
| Poppen | Einblenden in 0,3 bis 0,4 s mit Start 20 bis 50 Prozent größer, die Größe klingt quadratisch auf 100 Prozent ab |
| Stempel | Poppen mit höchstens 20 Prozent, damit die Breite nie über den Bildrand geht; danach schwingt die Neigung um −5 Grad und klingt in etwa einer Sekunde auf −5 Grad ab (Ausschlag anfangs bis −9 Grad) |
| Pulsieren | Dauerbewegung, Größe 100 bis 104 Prozent, Periode 2 s (Icon im Hook und Pille im Schluss) |

Pulsieren und die Schwingung des Stempels zählen in der Prüfung nicht als „neues Element“ (Abschnitt 13). Der Punktring im Hintergrund (Durchmesser 1500, Petrol, Deckkraft etwa 9 bis 13 Prozent) dreht sich mit etwa 30 bis 36 Grad je Sekunde.

### Tonkette

| Stufe | Wert |
| --- | --- |
| Stimme | Piper `de-thorsten-low`, danach `atempo=0,86`, 44,1 kHz. Pro gesprochener Szene eine Datei (Zitat: keine), Startzeit = Szenenanfang + 0,5 s |
| Stimmenbus | Hochpass 90 Hz, Anhebung 3 dB bei 3,2 kHz, Kompressor (Schwelle 0,1, Verhältnis 3, Attack 5 ms, Release 120 ms, Ausgleich +2 dB) |
| Musik | Eigens erzeugt auf die Länge des Videos (Skript, keine fremde Datei, keine Lizenzfragen): ruhiger Akkordteppich Cmaj7, Am7, Fmaj7, G, je Akkord 4 s, dazu leise gezupfte Töne. Einblenden 1 s, Ausblenden 2 s am Ende, Pegel 0,6 |
| Stimmenbus auffüllen | Der Stimmenbus wird vor dem Ducking mit Stille auf die volle Videolänge aufgefüllt (`apad`). Sonst endet das Ducking mit der letzten Stimme, und die Datei wird um den stillen Rest der Schlusskarte (im Test 4,4 s) zu kurz |
| Ducking | Sidechain von der Stimme auf die Musik: Schwelle 0,02, Verhältnis 10, Attack 15 ms, Release 400 ms |
| Töne (nur Automatik) | Eigens erzeugt (`sfx.py`, keine fremde Datei): „Schlag“ (tiefer Ton mit Knack, Spitze 0,8) beim Stempel und beim Statusbadge, „Klick“ (1,5 kHz, Spitze 0,3) bei jedem neuen Teil, „Wusch“ (Rauschen, Spitze 0,38) 0,22 s vor jedem Szenenwechsel, Soundlogo aus drei aufsteigenden Glockentönen (C, E, G) bei 0,1 s und zum Schluss 2,2 s vor dem Ende (E, G, hohes C). Pegel 0,8, gemischt nach dem Ducking, es duckt die Musik nicht |
| Summe | Stimme und Musik (mit Tönen) gemischt, `loudnorm` auf −14 LUFS (Spitze −1,5 dB, LRA 7), danach genaue Pegelung auf −14 LUFS mit Begrenzer, der so lange um 15 Prozent abgesenkt wird (Start 0,84), bis die Spitze nach der AAC-Kodierung höchstens −1,5 dB erreicht (`loud.sh`; ohne diese Schleife lag sie mit den Tönen bei −0,1 dB). AAC 192 kbit/s |
| Messung | EBU R128, integriert (`ebur128=peak=true`): Lautheit −14 ±1 LUFS, True Peak höchstens −1,5 dB |

## 3. Aufbau: sechs Szenen

Jede Folge hat dieselben sechs Szenen. Die Dauer einer Szene ist
**Szenendauer = Maximum aus Mindestdauer und (Stimmenlänge + 0,5 s Vorlauf + Nachlauf)**.
Beispiel: Stimme 5,5 s, Mindestdauer 6 s, Nachlauf 1 s ergibt Maximum aus 6 und 7,0, also 7,0 s. Die Dauern werden auf ganze Bilder (1/30 s) aufgerundet. Die Länge des Videos ist die Summe der sechs Szenendauern. Mit den Mindestdauern allein sind es 38,5 s; kürzer wird ein Video nie.

| Nr. | Szene | Mindestdauer | Nachlauf | Inhalt |
| --- | --- | --- | --- | --- |
| 1 | Hook | 6 s | 1 s | Zeile 1: Ort oder Rubrik mit Doppelpunkt (Schwarzgrau), Zeile 2: Thema oder Name des Vorgangs (Petrol, bei voller Größe bis zu zwei Zeilen). Optional eine einzige Nebenzeile: der Antragsteller („Antrag: Fraktion Freie Wähler“, „Vorschlag der Verwaltung“), sonst das Stichwort; sie entfällt zuerst, wenn der Platz fehlt. Darunter der Stempel mit nur dem Standwort (kein Zusatz, kein Icon), Neigung −5 Grad (weiße Schrift auf Fläche in Statusfarbe, Radius 22, Polster 75 Pixel seitlich und 15 oben und unten), darunter das pulsierende Themen-Icon (Kreis 300). Zeile 1 steht von Beginn an, Zeile 2 und das Icon erscheinen bei 0,5 s, die Nebenzeile bei 1,2 s (einblenden), der Stempel beim Standwort. Abstände: Zeile 1 zu Zeile 2 40, Zeile 2 zum Stempel 90, Stempel zum Icon 70. Die Nebenzeile folgt 40 unter Zeile 2, der Stempel 90 unter der untersten Zeile. Bei Platznot weicht zuerst die Nebenzeile, dann schrumpft das Icon bis 220, dann die Abstände (Zeile 2 zum Stempel von 90 auf 50, Stempel zum Icon von 70 auf 40), dann beginnt der Hook statt bei y = 400 bei y = 370, zuletzt wird das Thema gekürzt. Das Standwort ist das 5. bis 8. gesprochene Wort (bei Handfolgen; die Automatik nennt es gleich im ersten Satz, Abschnitt 15) |
| 2 | Kern | 7 s | 2,5 s | Die Kernaussage groß (Satz in Satzteilen). Bei mehreren Varianten steht darunter die Auswahl: Karten A, B mit Buchstaben-Kreis, Kreis zuerst, Text 0,25 s später, die Karten im Abstand von mindestens 1,4 s |
| 3 | Details (Verlauf) | 5 s | 1,5 s | Betroffene oder Maßnahmen als Zeilen mit Icon, bei Abläufen mit Verbindungslinie, oder Kernzahlen mit Beschriftung |
| 4 | Zitat | Maximum aus 6,5 s und 0,05 s je Zeichen des Zitats (mit Leerzeichen und […], ohne äußere Anführungszeichen); die Szene ist stumm, es gibt keinen Nachlauf | – | Wörtlich aus der Vorlage, Schlüsselwörter (Datenblatt) in Petrol hervorgehoben, darunter „Aus der Vorlage · Ort“. Ist der zitierte Text ein Beschluss- oder Empfehlungsvorschlag („beschließt“, „empfiehlt“) und der Stand nicht „Beschlossen“, steht dort „Vorschlag aus der Vorlage · Ort“, damit er nicht wie ein Beschluss wirkt; ein bloßer Tagesordnungstext („berät über“) heißt „Aus der Vorlage · Ort“. Wird nicht gesprochen, damit Zeit zum Lesen bleibt. Hier ist Stillstand gewollt (Lesezeit), die Ruhebild-Prüfung gilt für diese Szene nicht (Abschnitt 13) |
| 5 | Stand | 7 s | 1,5 s | Statuskarte mit Band in Statusfarbe, Badge, Statuswort, darunter Gremium und „zuletzt beraten am …“, bei Bedarf nächste Sitzung |
| 6 | Schluss | 5 s | 1 s | Titel „Beschlüsse zu Ihrem Ort“, Logo groß, festes Motto, plenara.de als pulsierende Pille, Quelle und Hinweis „kein amtliches Dokument“ |

Statuskarte (von oben, mit Logo-Chip und Ortschip bei y = 190): Beginn bei y = 430. Ein Band über die ganze Bildbreite in der Statusfarbe mit etwa 12 Prozent Deckkraft. Das Badge sitzt mittig zwischen der Beschriftung und dem Statuswort (Abstand oben und unten etwa gleich, 46 und 36 Pixel). (Bandhöhe: 36 + Beschriftung + 46 + Badge 300 + 36 + Höhe des Statusworts + 44). In der linken oberen Ecke des Bandes (x = 72, y = 466) die Beschriftung in Großbuchstaben, 48, Nebenzeilenfarbe, weit gesetzt: bei „Beschlossen“ und „Abgelehnt“ „STAND“, sonst die Zusatzzeile der Tabelle in Abschnitt 5 („NOCH NICHT BESCHLOSSEN“). Darin mittig das Badge (Kreis 300 in der Statusfarbe mit weißem Symbol, y = 530) und darunter das Statuswort (Schwarzgrau, mittig, bis 190 und so klein, dass es in 936 Pixel passt). Unter dem Band höchstens zwei Meta-Zeilen im Abstand 40 zum Band (bei Platznot ersetzt „Nächster Schritt: …“, Dokument-Icon, höchstens zwei Textzeilen, vom Datenblatt gekürzt, die nächste Sitzung) mit je einem Icon (68, Petrol) links und zweizeiligem Text (52 bis 60, Schwarzgrau): Zeile 1 mit Kalender „Gremium / zuletzt beraten am TT.MM.JJ“, Zeile 2 mit Halle „Gremium / nächste Sitzung TT.MM.JJ“ (so gebaut; gab es noch keine gehaltene Sitzung, entfällt Zeile 1 und die nächste Sitzung steht allein als Zeile 1 mit Halle), Abstand zwischen den Zeilen 40. Ende bei etwa 1440; bei Platznot Meta 52 und Statuswort 140. Zeiten: Band und Beschriftung ab 0 s, Badge ab 0,3 bis 0,8 s (0,5 s vor dem gesprochenen Standwort), Statuswort 0,4 s später, Meta-Zeilen ab 1,2 s nach dem Beginn des Badges, im Abstand von mindestens 0,5 s; die letzte erscheint nicht vor Dauer − 4 s (bei 7 s also ab 3,0 s, bei nur einer Zeile erscheint diese dann erst dort).

Schlusskarte (von oben, ohne Logo und Ortschip oben, Beginn bei y = 190, Abstände in Klammern): Titel „Beschlüsse zu Ihrem Ort“ 100 in Schwarzgrau, bricht bei 700 Pixel Breite in zwei Zeilen um (24), Zeile „finden Sie bei“ 64 mit Pin 76 (20), Logo 520 breit, etwa 134 hoch (40), Motto 64 in bis zu zwei Zeilen (40), Pille plenara.de 104 mit 55 Pixel Rand links und rechts, 20 oben und unten (46), Quelle 50, darunter (14) Hinweis „Zusammenfassung von Plenara, kein amtliches Dokument.“ 48. Quelle und Hinweis dürfen umbrechen. Das Ende liegt je nach Zeilenhöhe zwischen 1300 und 1400 und höchstens bei 1450 (das Bauskript meldet den Wert). Der Titel steht von Beginn an. „(24)“ usw. sind die Abstände unter dem jeweiligen Element in Pixel. „104“ bei der Pille ist die Schriftgröße. Das Motto lautet „Besser verstehen, was vor Ort beraten wird.“ Die Folge baut die Karte gestaffelt auf: Pin und Zeile ab 0,4 s, Logo ab 0,3 s, Motto ab 1,1 s, Pille ab 1,5 s, Quelle und Hinweis ab 1,6 s.

Die Schlussszene verwendet in jeder Folge dieselbe Sprechdatei mit dem Wortlaut „Beschlüsse und Unterlagen zu Ihrem Ort finden Sie bei Plenarra.“ (etwa 3,5 s; die Szene dauert deshalb immer 5 s). Gesprochen werden damit vier Teile (Hook, Kern, Details, Stand) plus die feste Schlussdatei; das Zitat bleibt stumm. Richtwert für die Planung: etwa 2 Wörter pro Sekunde (verlangsamt, lange Zahlwörter weniger); gemessen liegen kurze Sätze bei 2,5 bis 2,9 Wörtern je Sekunde (die Schlussdatei: 10 Wörter in 3,5 s). Maßgeblich ist immer die gemessene Länge der Sprechdatei. Wortbudget der vier Sprechteile zusammen: höchstens etwa 70 Wörter bei einem Zitat von 150 Zeichen (bei kürzerem Zitat etwas mehr), sonst wird das Video länger als 65 s.

### Begriffe

- **Titelzeilen:** Hook-Zeile 1 (Ort oder Rubrik mit Doppelpunkt) und Hook-Zeile 2 (Thema). **Nebenzeile:** die eine kleine Zeile darunter (Antragsteller, sonst Stichwort). **Kernaussage:** der Satz der Kern-Szene.
- **Standwort** ist das Plenara-Wort des Stands. Im Bild heißt es **Statuswort** (Stempel, Stand-Szene), im Ton darf es gebeugt stehen („beschlossen“, „empfiehlt“); für die Zeit zählt das erste Wort des Standworts oder sein Stamm.
- **Kurzform:** ein im Datenblatt vereinbartes kürzeres Wort für den Fall, dass das Standwort bei 100 Pixel nicht in die Satzbreite passt; die Zusatzzeile und die Quelle behalten das volle Wort.
- **Ruhelage:** Endposition eines Elements nach dem Einblenden, Gleiten und Poppen.
- **Bauskript:** das Programm, das Szenen zeichnet, Tonspuren mischt und das Layoutprotokoll schreibt.

## 4. Layout und Abstände

Rand links und rechts 72 Pixel, Satzbreite 936 Pixel. Logo-Chip (links) und Ortschip (rechts daneben, Abstand 20, gleiche Höhe, leichter Schatten) stehen bei y = 190, ab dort in jeder Szene außer dem Schluss. Inhalte beginnen bei y = 350 bis 400 (Hook ab 400, Statuskarte ab 430, Zitat mittig im Feld 400 bis 1440) und enden bei höchstens 1450. Ab y = 1500 bleibt alles frei, dort liegen die Bedienelemente der Apps. Text ist links ausgerichtet, der Stempel, das Statuswort und die Icons im Hook und im Stand sind mittig.

Schriftgrößen sind **Höchstwerte in Pixel**. Passt ein Text nicht in die Satzbreite, wird er in Schritten von 2 bis 6 Pixel verkleinert, bis jede Zeile passt. Untergrenzen: 44 für jeden Text, 56 für Zitate, 72 für Titelzeilen (darunter wird umgebrochen, dann gekürzt), 100 für Statuswort und Stempel (reicht das nicht, legt das Datenblatt eine Kurzform fest; die Zusatzzeile nennt das volle Plenara-Wort). Zeilenhöhe: 1,0 für Titel und Zahlen, 1,1 bis 1,2 für Fließtext. Textspalte neben einem Icon-Kreis: 936 minus Kreis minus 30, bei Listen und Auswahlkarten etwa 730. Schnitt: Titel, Zahlen, Statuswort und Stempel SemiBold, übriger Text Regular. Reihenfolge bei zu langen Titelzeilen: Zeile 1 wird verkleinert (bis 72); Zeile 2 (Thema) bricht bei voller Größe auf bis zu zwei Zeilen um, ist sie dann noch zu lang, wird sie bis 72 verkleinert und danach gekürzt

| Element | Größe |
| --- | --- |
| Titel im Hook, Zeile 1 | bis 108 |
| Hook, Zeile 2 (Thema) | bis 104, darf zweizeilig sein |
| Nebenzeile im Hook (Stichwort, Antragsteller) | 56 bis 68, Nebenzeilenfarbe |
| Stempel | Schrift bis 168, Gesamtbreite einschließlich 150 Pixel Polster höchstens 860 vor der Drehung |
| Ortschip | Petrol-Pille mit weißem Pin und Ortsname 44 SemiBold weiß, Höhe wie der Logo-Chip (Logo 300 breit auf weißem Chip). Der Ortsname ist der Kurzname ohne Gemeindeart („Dresden“, nicht „Landeshauptstadt Dresden“) |
| Kernaussage | Ein ganzer Satz in 70 bis 84. Nur bei sehr kurzen Wörtern (etwa 11 Zeichen je Zeile, zum Beispiel „Variante A“ / „oder B“) zwei Zeilen bis 150 |
| Zeilen in Listen | Text 76 bis 84, Icon-Kreis 176, Zeilenabstand 238 (Kreis plus 62) |
| Zitat | von 92 abwärts in 2-Pixel-Schritten, bis es höchstens 800 Pixel hoch ist und das längste Wort in die Satzbreite (abzüglich 40) passt |
| Statusbadge und -wort | Badge 300, Wort bis 190 (bei langen Wörtern wie „Beschlossen“ 140 bis 170), Band darüber mit Beschriftung 48 |
| Meta-Zeilen im Stand | 52 bis 60, Schwarzgrau |
| Zitat-Unterzeile | 54 |
| Quelle und Hinweis im Schluss | 50 und 48 |

Auswahlkarten (A, B): Buchstaben-Kreis 176, Text 76, Abstand zwischen den Karten etwa 110. Kernzahlen: Zahl 118 bis 140 in Petrol, Beschriftung 56, Zahlblöcke mit etwa 64 Pixel Abstand, rechts ein Icon-Kreis 130 bis 150.

Lange Wörter: Das längste Wort jedes Textes muss in die Satzbreite (936 Pixel) passen. Sonst bei Zitaten mit […] kürzen, bei eigenen Texten ein kürzeres Wort oder eine Abkürzung (nach der ersten Nennung) wählen. Die Schrift eines Zitats wird nicht unter 56 Pixel verkleinert, ein längeres Zitat wird gekürzt. Ein Zitat hat höchstens 165 Zeichen (Ziel etwa 150). Die Unterzeile zählt nicht zu den 800 Pixeln Höhe.

Kein Text unter 44 Pixel. Zwischen Gruppen mindestens 40 Pixel Abstand, zwischen Zeilen einer Liste 60 Pixel und mehr. Labels (Pillen und Chips) stehen auf einer Zeile und haben höchstens sechs Wörter; Titelzeilen dürfen umbrechen. Vor jeder Veröffentlichung wird die Unterkante jedes Elements gemessen (Prüfung im Skript), nicht nach Gefühl.

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
| Verkehr, Straße, Wege | Straße (Fahrbahn in Perspektive mit Mittelstrich, `road`); Park-and-Ride-Anlagen: Quadrat mit ausgeschnittenem P (`parking`); Pin nur für Orte. Wer ein Schild oder Auto braucht, ergänzt es im selben Stil und trägt es hier ein |
| Gremium, Rathaus | Halle |
| Termin | Kalender |
| Stand | Haken, Kreuz, Sanduhr |

Für Themen ohne Symbol (zum Beispiel Wärme) das nächstliegende Symbol nehmen (Haus) oder ein neues im selben Stil ergänzen und hier eintragen.

## 5. Stil und Farben

Der Look folgt dem verbindlichen Farbschema „Petrol klar“ (`docs/farbschema-petrol-klar-2026-10-17.pdf`).

| Element | Regel |
| --- | --- |
| Hintergrund | Weiß mit zartem Petrol-Schimmer (Petrol bei sehr geringer Deckkraft) und drehendem Punktring (Petrol, Deckkraft etwa 9 bis 13 Prozent), nie Petrol als Fläche, keine Fotos |
| Hook-Zeile 2 (Thema) | Petrol |
| Statuswort in der Stand-Szene | Schwarzgrau; Badge und Band tragen die Statusfarbe |
| Pille plenara.de | Petrol-Fläche, weiße Schrift |
| Schlusskarte | Titel, Motto, Quelle, Hinweis Schwarzgrau; „finden Sie bei“ und Pin Petrol |
| Schrift | IBM Plex Sans, Überschriften SemiBold, Text Regular |
| Akzent | Petrol `--rm-fill` (#268478) für Icons, Hervorhebungen, Zahlen |
| Text | Schwarzgrau `--rm-c900` (#18181B) für Hook-Zeile 1, Kernaussage, Zitat, Listentexte, Meta-Zeilen, Quelle und Hinweis; Nebenzeilen (Stichwort, Antragsteller, Zitat-Unterzeile) `--rm-c600` (#52525B), mindestens 48 Pixel; Weiß `--rm-on` (#FFFFFF) auf Petrol und Statusfarben |
| Status beschlossen | Dunkelblau `--rm-ok` (#0C4A6E) |
| Status abgelehnt | Orange-Braun `--rm-no` (#B45309) |
| Status offen (alle übrigen) | Grau `--rm-c700` (#3F3F46) |
| Icons | Ein Stil: Kreis in Petrol (Statusfarbe im Stand) mit weißem Symbol |
| Logo | Echtes Plenara-Logo (Seitenverhältnis etwa 3,9 : 1) mit Ortschip in den Szenen 1 bis 5 oben links, groß in der Schlusskarte |
| Motto | Festes Motto der Reihe unter dem Logo, im Repo festgelegt |

Es gelten nur die Farben des Farbschemas, die Werte stehen in `app/styles/tokens.css`. Die ersten vier Folgen verwenden drei Töne, die im Schema nicht vorkommen: für „offen“ ein bläuliches Grau (#3F4850), für „finden Sie bei“ ein dunkleres Petrol (#1F7065) und für die Band-Beschriftung der Stand-Szene und die Zitat-Unterzeile ein Grau (#34343C). Ab der nächsten Folge gelten nur Token: `--rm-c700`, `--rm-fill` (Petrol) und `--rm-c600`; die vier Folgen werden bei Gelegenheit neu gerendert.

### Status und Wortlaut

Die Videos verwenden die Stände von Plenara (`STATUS` in `shared/types.ts`), mit demselben Wort. Der Stand wird in der Stand-Szene immer mit Wort und Icon gezeigt, nie nur mit Farbe. Einzige Ausnahme ist der Stempel im Hook: er zeigt nur das Wort in der Statusfarbe, Icon und Zusatzzeile folgen in der Stand-Szene. Alles außer „Beschlossen“ und „Abgelehnt“ trägt eine Zusatzzeile (Spalte der Tabelle: „Noch nicht beschlossen“, bei „Vertagt“ „Noch nicht entschieden“, bei „Zur Kenntnis“ „Keine Sachentscheidung“), damit eine Empfehlung oder Ankündigung nicht wie ein Beschluss wirkt. Die Statusfarben sind Vorgabe des Farbschemas; Haken und Kreuz sind die Symbole von Plenara selbst.

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

**Zur Kenntnis (Ausnahmefall):** Der Kern ist die Kenntnisnahme samt Gegenstand („Der Gemeinderat hat die Information zur Sanierung der Turnhalle zur Kenntnis genommen“), der Inhalt der Information steht in den Details. Das Zitat ist ein Kernsatz aus der Information der Vorlage, nicht der Satz der Kenntnisnahme (der doppelte den Kern), mit der Unterzeile „Aus der Vorlage · Ort“. Das Fachwort „zur Kenntnis nehmen“ wird nur erklärt, wenn Vorlage oder Glossar es erklären.

Gebaut und gesehen sind bisher Beschlossen, Abgelehnt, Stand offen und Angekündigt. Die übrigen Zeilen sind noch nicht in einem Video erprobt. Wichtig: Ein Beschluss belegt laut Plenara noch keine Umsetzung, das Video sagt deshalb „beschlossen“ und nicht „umgesetzt“.

## 6. Bewegung und Takt

- Etwas Neues erscheint etwa alle ein bis zwei Sekunden, ungefähr dann, wenn es gesprochen wird; hart gilt höchstens 4 Sekunden, auch bis zum Szenenende: Zwischen dem letzten Element und dem Ende einer Szene liegen höchstens 4 Sekunden, das letzte Element erscheint also frühestens bei Dauer − 4 s (Grenzen je Szene: Hook 5 s, Schluss 7 s, Zitat ohne Grenze, Abschnitt 13). Der Sprechtext des Hooks hat deshalb höchstens etwa 10 Wörter. In Szenen mit langer Mindestdauer, vor allem der Stand-Szene (7 s, letztes Element ab 3,0 s), werden die späten Elemente deshalb später gelegt, als die Stimme sie nennt. Ein „Element“ ist eine einzeln einblendende Einheit: eine Textzeile oder ein Satzteil, ein Icon, eine Zahl mit Beschriftung, eine Listenzeile. Sätze in Kern und Details werden deshalb in Satzteile zerlegt (je ein bis drei Zeilen), die nacheinander erscheinen; ein Block, der als Ganzes einblendet, ist nur ein Element. Listenzeilen erscheinen gestaffelt: erst das Icon, 0,25 s später der Text.
- Jede Szene zeigt innerhalb von 0,8 s etwas Lesbares außer Logo, Ortschip und Balken (kein leerer Szenenanfang, kein Ruhebild über mehrere Sekunden).
- Der Stempel im Hook erscheint 0,3 s vor dem gesprochenen Standwort, frühestens bei 1,8 s und spätestens bei 4,2 s. Das Standwort ist das 5. bis 8. gesprochene Wort (bei zwei Wörtern je Sekunde beginnt es zwischen 2,5 und 4,0 s; läge der Stempel dadurch vor 1,8 s, gilt 1,8 s). Bei einem Standwort aus mehreren Wörtern („In Beratung“) zählt das erste. In der Stand-Szene gilt die 5.-bis-8.-Regel nicht: Der Sprechtext beginnt dort mit „Stand: <Standwort>.“, das Badge erscheint 0,5 s vor dem Standwort, zwischen 0,3 und 0,8 s.
- Wortzeiten: Jedes Wort wiegt Zeichenzahl plus 2. Ein Wort beginnt bei Szenenanfang + 0,5 s + Länge der Sprechdatei × (Gewicht aller Wörter davor ÷ Gewicht aller Wörter). Gemessene Wortzeiten ersetzen diese Schätzung, sobald es sie gibt.
- Zahlen zählen nicht hoch, sie erscheinen fertig. Ausnahme: ein einzelner Betrag in der Automatik zählt hoch (Abschnitt 15).
- Die Schlussszene baut sich gestaffelt auf, die Adresse pulsiert, Quelle und Hinweis erscheinen früh genug, um gelesen zu werden.

## 7. Datenblatt je Folge

Jede Folge entsteht aus einem Datenblatt mit diesen Feldern. Ohne vollständiges Datenblatt wird nicht gebaut.

| Feld | Hinweis |
| --- | --- |
| Vorgang | Kennung bei Plenara (verhindert doppelte Folgen). Eine Testfolge ohne Plenara-Eintrag trägt „Test“ und wird nicht veröffentlicht |
| Ort | Kurzname ohne Gemeindeart („Dresden“): im Ortschip, in Hook-Zeile 1 und in der Zitat-Unterzeile |
| Stand | genau einer der Stände aus der Tabelle in Abschnitt 5, so wie ihn Plenara für den Vorgang führt. Liegt nur der Verlauf vor, zählt die jüngste bereits gehaltene Sitzung; angesetzte Termine erscheinen nur als „nächste Sitzung“. Der Verlauf liefert Datum und Sitzung, nicht den Stand |
| Gremium der letzten Beratung | wie in der Quelle; fehlt, wenn noch keine Sitzung stattfand (dann entfällt auch das Datum). Mindestens eines von beidem, letzte Beratung oder nächste Sitzung, ist Pflicht, damit die Stand-Szene eine Meta-Zeile hat |
| Datum der letzten Beratung | im Bild TT.MM.JJ (29.10.26), im Sprechtext Tag und Monat ausgeschrieben, ohne Jahr („am neunundzwanzigsten Oktober“). Gleiches Format für „nächste Sitzung“ in der Stand-Szene; Termine in Detailzeilen TT.MM.JJJJ |
| Gremium und Datum der nächsten Sitzung | nur wenn in den Unterlagen vorhanden. Künftige Termine heißen „nächste Sitzung“, vergangene „zuletzt beraten am“ |
| Titel und Stichwort | Titel zeigt Ort (Zeile 1) und Thema (Zeile 2), Stichwort oder Antragsteller klein darunter. Bei 108 Pixel passen etwa 16 Zeichen je Zeile; längere Zeilen werden behandelt wie in Abschnitt 4 beschrieben (Untergrenze 72) |
| Themen-Icon | ein Symbol aus Abschnitt 4 |
| Antragsteller | nur wenn die Vorlage ihn nennt, nur im Bild (Abschnitt 9, Punkt 4) |
| Kernaussage | ein Satz; bei mehreren Varianten Buchstaben und Kurztexte |
| Details | entweder drei bis vier Zeilen mit Icon (Betroffene, Maßnahmen, Termine; Datum TT.MM.JJJJ oder „Februar 2027“) oder höchstens drei Kernzahlen mit Beschriftung (Beträge, Mengen), nicht gemischt; die Abstimmung zählt als ein Block (Abschnitt 9, Punkt 8). Die Reihenfolge im Datenblatt ist die Rangfolge: die Reihenfolge der Vorlage, Folgen für Betroffene vor Technik und Kosten; was nicht passt, entfällt oder steht im Zitat. „Gemischt“ meint Listenzeilen und Zahlblöcke; ein Betrag darf in einer Listenzeile stehen („Kosten 2,1 Millionen Euro, vorher 1,8“). Zeitangaben stehen so, wie die Vorlage sie nennt („Ende Mai 2027“, „Frühjahr 2027“). Beträge werden gezeigt, nicht gesprochen |
| Abstimmung | nur wenn die Vorlage Zahlen nennt: Ja, Nein, Enthaltungen in der Reihenfolge der Vorlage (Abschnitt 9, Punkt 8). Ohne Zahlen entfällt die Abstimmung ganz, auch Wörter wie „einstimmig“ oder „mehrheitlich“ |
| Wirksam ab / nächster Schritt | wenn vorhanden, als Detailzeile oder in der Stand-Szene („Nächster Schritt: …“, ohne Gremium als Zeile ohne Kalender-Icon) |
| Originalzitat | wörtlich, höchstens 165 Zeichen, Ziel etwa 150 (gezählt mit Leerzeichen und […], ohne die äußeren Anführungszeichen „…“, die im Bild stehen). Auslassungen mit […], auch am Anfang; Kernverb und Gegenstand der Entscheidung bleiben stehen, Kosten und Nebensätze fallen weg. Innere Anführungszeichen einfach (‚…‘). Bei mehreren Varianten wird ein Satz der Kernentscheidung zitiert, die Varianten stehen in der Kern-Szene |
| Schlüsselwörter | zwei bis vier Wörter des Zitats, die in Petrol hervorgehoben werden |
| Quelle | „Quelle: öffentliche Ratsunterlagen der …“ mit Gemeindeart und Namen, wie die Kommune sich selbst nennt (Gemeinde Oststeinbek, Landeshauptstadt Dresden); eigenes Pflichtfeld, nie geraten; darf zweizeilig sein |
| Sprechtext | vier Teile (Hook, Kern, Details, Stand; Zitat bleibt leer) plus die feste Schlussdatei, laut Regeln in Abschnitt 8 |

## 8. Regeln für den Sprechtext

- Anrede „Sie“, Sätze mit höchstens etwa 14 Wörtern.
- Zahlen, Jahre und Daten ausgeschrieben, damit die Stimme sie richtig liest. Sehr lange Zahlwörter vermeiden: Beträge lieber zeigen als vorlesen, das verkürzt die Szene deutlich.
- Der Sprechtext darf kürzer sein als der Bildtext, aber nichts sagen, was nicht in der Vorlage steht.
- Das Zitat wird nicht gesprochen.
- Fachwörter (zum Beispiel „Quartierswärmemanagement“) werden nur erklärt, wenn die Vorlage oder das Plenara-Glossar (`docs/technik/glossar.md`) die Erklärung liefert. Sonst bleibt das Fachwort stehen, eine Abkürzung ist nach der ersten Nennung erlaubt. Eigene Deutungen kommen nicht dazu.
- Der Stand steht im ersten Satz, das Standwort ist das 5. bis 8. Wort. Die Beträge und Zahlen, die im Bild stehen, müssen nicht vorgelesen werden.
- Antragsteller, Fraktions- und Parteinamen werden nicht gesprochen, auch wenn sie im Bild stehen.
- Ist der Stand nicht „Beschlossen“ oder „Abgelehnt“, enthält der Sprechtext der Stand-Szene die Zusatzzeile aus der Tabelle in Abschnitt 5 als Satz: „Noch kein Beschluss.“, bei „Vertagt“ „Noch nicht entschieden.“, bei „Zur Kenntnis“ „Keine Sachentscheidung.“
- Antragsteller werden nie gesprochen, auch nicht „die Verwaltung“ oder ein Gremium als Antragsteller.
- Der Name der Stadt ist in der Schlussdatei nicht enthalten, weil die Datei für alle Folgen gilt.

## 9. Inhaltsregeln

1. Sachlich und neutral. Berichtet wird, was beschlossen oder beraten wurde, nicht bewertet. Keine Superlative, keine Vergleiche.
2. Quelle immer sichtbar (Schlusskarte; die Zitat-Unterzeile nennt Vorlage und Ort). Absender ist Plenara, nicht die Kommune.
3. Zitate wörtlich. Was als „Aus der Vorlage“ erscheint, ist Originaltext. Eigene Zusammenfassungen sind keine Zitate.
4. Antragsteller nur, wenn die Vorlage sie nennt. Die Verfahrensart („Einwohnerantrag“) nennt keinen Namen und darf im Bild und im Ton stehen; die Nebenzeile lautet dann „Antrag aus der Einwohnerschaft“, eine Unterschriftenzahl steht nur, wenn die Vorlage sie nennt, als Detailzeile (Icon Gruppe). Sie stehen klein in der Nebenzeile (Nebenzeilenfarbe), nie im Titel, nie im Stempel und nie im gesprochenen Text.
5. Empfehlung ist kein Beschluss. Begriffe wie „Förderung empfohlen“ gehören mit „Noch nicht beschlossen“ zusammen.
6. Gegenprüfung vor der Veröffentlichung: Zahlen, Daten, Namen und Zitat gegen die Vorlage prüfen, durch jemanden, der das Video nicht gebaut hat.
7. Keine Bilder erkennbarer Personen. Ohne Fotos entfällt die Bildkennzeichnung.
8. Abstimmungsergebnisse stehen als Zahlen in der Reihenfolge der Vorlage, alle in derselben Farbe (Zahl Petrol, Wort Schwarzgrau), nie als Gegenüberstellung, Balken oder mit Wörtern wie „knapp“ oder „deutlich“. Die Abstimmung ist in den Details ein einziger Block (Überschrift „Abstimmung · Gremium“ 56 mit Halle-Icon 140, darunter die drei Zahlen nebeneinander, Zahl 96 Petrol, Wort 56 Schwarzgrau, Höhe etwa 400). Er zählt als einer der höchstens drei Zahlblöcke; in einer Details-Szene mit Listenzeilen steht er nicht. Er nutzt kein Haken- und Kreuz-Symbol. Die Abstimmung darf gesprochen werden.
9. Angekündigte Folgeschritte (zum Beispiel ein neuer Antrag) stehen nur, wenn die Vorlage sie nennt, mit demselben Gewicht wie die übrigen Meta-Zeilen.
10. Ist der zitierte Text ein Vorschlag und der Stand nicht „Beschlossen“, heißt die Unterzeile „Vorschlag aus der Vorlage“.
11. Pakete (zum Beispiel ein Haushalt mit Steuersatz): Die Kernaussage nennt den Gegenstand und jede Teilentscheidung, die Bürger unmittelbar betrifft, im Wortlaut der Vorlage („Hebesatz … angehoben“, nicht „Steuererhöhung“). Zahlen werden nie verrechnet oder gegenübergestellt (keine Differenz zwischen Erträgen und Aufwendungen). Vorher-nachher-Werte stehen als eine Zahl mit Beschriftung („520 Prozent, vorher 480“). Was nicht auf die Karten passt, steht höchstens im Zitat.

## 10. Ablauf

1. Datenblatt ausfüllen und gegen die Vorlage prüfen.
2. Sprechtext schreiben, Stimme erzeugen, auf 86 Prozent verlangsamen und je Szene ablegen.
3. Szenen nach Abschnitt 3 bis 6 bauen, die Dauern ergeben sich aus der Stimme.
4. Unterkanten messen (höchstens 1450) und prüfen, dass kein Wort angeschnitten ist.
5. Prüfen nach Abschnitt 13: erst die Maschinenprüfung, dann Panel mit Vergleich Alt gegen Neu, Befunde ins Register, höchstens drei pro Runde.
6. Ton und Länge sind Teil der Maschinenprüfung.
7. Gegenprüfung des Inhalts (Abschnitt 9, Punkt 6) mit Quelle und Datenblatt.
8. Beschreibungstext, Hashtags und Titelbild nach Abschnitt 16.

## 11. Typische Fehler aus den Prüfrunden

- Text reicht in die untere Zone ab y = 1500 (Zeilen zu groß oder Abstände zu eng).
- Sehr lange Wörter (etwa „Quartierswärmemanagements“) werden angeschnitten: Schrift verkleinern oder das Zitat mit […] kürzen.
- Ein Label bricht in zwei Zeilen um und überlappt das Icon.
- Eine Szene beginnt leer, weil das erste Element zu spät erscheint.
- Kleine graue Nebenzeilen sind für viele kaum lesbar: Nebenzeilenfarbe (#52525B), mindestens 48 Pixel, Meta-Zeilen im Stand in Schwarzgrau.
- Titelzeilen, die bei voller Größe nicht in die Satzbreite passen, werden zu klein: Zeile 2 umbrechen, Zeile kürzen, nicht unter 72 Pixel gehen.
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
- Wortzeiten: Die Zeiten der Wörter werden aus der Zeichenzahl geschätzt, nicht gemessen. Eine Zeitmarkierung aus der Sprechdatei (Wortausrichtung) würde den Stempel und die Listenzeilen genauer an die Stimme binden.
- Das Panel aus Abschnitt 13 ist noch nicht an einer Folge erprobt, die Werte der Tabelle sind Startwerte.

## 13. Prüfverfahren: jede Runde muss besser werden

In den ersten zehn Runden prüfte jedes Mal eine andere Person, die Noten sprangen zwischen 5 und 7, und Befunde widersprachen sich (zu schnell, zu langsam). Das Verfahren unten beseitigt das Rauschen: gleiche Messlatte, harte Maschinenprüfung, Vergleich von Alt und Neu statt Schulnote, und eine Änderung wird nur übernommen, wenn sie nachweislich besser ist.

### Grundsätze

1. **Erst Maschine, dann Mensch.** Alles, was sich messen lässt, wird automatisch geprüft und ist ein Ausschlusskriterium. Personen beurteilen nur, was sich nicht messen lässt.
2. **Vergleichen statt benoten.** Prüfpersonen bekommen Alt und Neu, in zufälliger Reihenfolge und ohne Hinweis, welche Fassung neu ist, und entscheiden je Kriterium, welche besser ist. Ein Vergleich ist weit weniger verrauscht als eine Note von 1 bis 10.
3. **Eine feste Messlatte.** Dieselben Kriterien mit festen Ankern in jeder Runde (Abschnitt „Kriterien“). Keine freie Bewertung.
4. **Festes Panel plus ein Gast.** Drei feste Prüfpersonen (Rollen unten) sehen jede Fassung. Dazu kommt je Runde eine wechselnde Gastperson für neue Blickwinkel. Befunde des Gasts gelten erst, wenn sie zweimal vorkommen (auch durch feste Prüfpersonen bestätigt) oder messbar sind.
5. **Ein Befundregister.** Jeder Befund hat eine Nummer, einen Status und einen Nachweis. Eine Runde bearbeitet höchstens drei Befunde, damit klar bleibt, was wirkte.
6. **Nur Fortschritt übernehmen.** Eine Änderung gilt als besser, wenn sie den Befund beseitigt, kein Kriterium verschlechtert und alle Maschinenprüfungen besteht. Sonst wird sie verworfen.

### Maschinenprüfung (Ausschlusskriterien)

Jede Fassung muss bestehen, bevor Personen sie sehen; die Fakten-Zeile ist eine Handprüfung und gilt vor der Veröffentlichung (Abschnitt 10). Das Bauskript schreibt dafür je Szene ein Layoutprotokoll (Liste der Elemente mit Art, Rechteck vor dem Zoom, Schriftgröße, Wortbreiten, Einblend- und Ausblendzeit). Dauerhafte Elemente (Logo-Chip, Ortschip, Fortschrittsbalken, Hintergrund, Punktring) sind als „Rahmen“ markiert und zählen bei den Prüfungen zu Szenenanfang, Ruhebild und Bildrand nicht. Das Prüfskript liest nur dieses Protokoll, die beiden Tonspuren und die fertige Datei und gibt je Prüfung Messwert, Grenze und Ergebnis aus (Exit-Code ungleich 0 bei einem Fehler).

**Layoutprotokoll** (`layout.json`, neben der Videodatei, Stand: Soll, noch nicht im Bauskript): Pixel mit Ursprung oben links, vor dem Zoom; Zeiten in Sekunden ab Szenenanfang. Aufbau: `szenen[]` mit `nr`, `dauer`, `elemente[]`; jedes Element hat `id`, `art`, `rolle` (bei Text), `x`, `y`, `b`, `h`, `schrift` (Pixel, bei Text), `wortbreite_max` (Pixel, bei Text), `spalte_b` (Breite der Spalte, in der der Text steht), `b_vor_drehung` (beim Stempel) und `t_ein` (Beginn der Einblendung; `t_aus` nur, wenn ein Element wieder verschwindet). Die Szene trägt außerdem `sprechdatei_laenge` und `standwort_beginn` (Sekunden, geschätzt nach Abschnitt 6). Rechteck: der Umriss nach der Drehung (Stempel), Endgröße nach dem Poppen. Werte für `art`: `text`, `zahl`, `icon`, `badge`, `stempel`, `zitat`, `unterzeile`, `pille`, `band`, `rahmen`. Eine Listenzeile besteht aus zwei Elementen (`icon`, `text`), im Takt der Abschnitte 6 zählt sie als eines. Werte für `rolle`: `titelzeile` (Mindestschrift 72), `nebenzeile` und `meta` (48), `statuswort` und `stempel` (100), `zitat` (56), `kernaussage` und `listentext` (44), `quelle` und `hinweis` (48), `chip` (44). „Sichtbar“ im Test zum Szenenanfang heißt: `t_ein` ≤ 0,8. Als `rahmen` gelten Logo-Chip, Fortschrittsbalken, Hintergrund und Punktring; der Ortschip ist Art `chip` und nimmt an der Prüfung auf Wortbreite und Bildrand teil (ein zu langer Ortsname fällt so auf), nicht an den Zeitprüfungen. Der Bildrand ist die Spanne x = 72 bis 1008 (ausgenommen Art `band`, `rahmen` und das Statusband über die ganze Breite). Zusätzlich prüft eine Pixelprobe an allen Einzelbildern des Prüfmaterials (Abschnitt „Material“), dass ab y = 1500 kein Pixel einen Farbabstand (RGB, euklidisch) unter 12 zu einer der Text- und Statusfarben hat: #18181B, #52525B, #3F3F46, #268478, #0C4A6E, #B45309 (Petrol-Schimmer und Punktring sind viel heller und fallen nicht darunter).

| Prüfung | Grenze | Messung |
| --- | --- | --- |
| Unterkante aller Inhalte je Szene | höchstens 1450 Pixel | Protokoll, Unterkante aller Elemente außer „Rahmen“ in der Ruhelage nach dem Poppen, vor dem Zoom. Gleiten (34 Pixel) und Pulsieren zählen nicht, weil sie auch mit Zoom unter 1500 bleiben |
| Kleinste Schrift | 44 Pixel; je Art: Nebenzeile und Meta 48, Zitat 56, Titelzeile 72, Stempel und Statuswort 100 | Protokoll |
| Angeschnittene Wörter | keines | längstes Wort je Text höchstens so breit wie seine Spalte: 936 Pixel, Zitat 896, neben einem Icon-Kreis 936 minus Kreis minus 30 (Listen und Karten etwa 730); Stempel höchstens 860 vor der Drehung und nach Drehung und Zoom höchstens 1008; kein Element außer „Rahmen“ über den Bildrand hinaus |
| Leerer Szenenanfang | in den ersten 0,8 Sekunden jeder Szene ist ein Element mit Text oder Symbol (ohne Rahmen) sichtbar | Protokoll, Einblendzeit relativ zum Szenenanfang |
| Ruhebild | höchstens 4 Sekunden ohne neues Element | größte Lücke zwischen den Einblendzeiten (ohne Rahmen) innerhalb einer Szene, auch vom letzten Element bis Szenenende; Pulsieren und die Schwingung des Stempels zählen nicht. Die Grenze für die Lücke bis zum Szenenende gilt je Szene: Hook 5 Sekunden (der Stempel schwingt, das Icon pulsiert), Kern, Details und Stand 4 Sekunden, Schluss 7 Sekunden (der Aufruf bleibt stehen, die Pille pulsiert), Zitat unbegrenzt (Lesezeit). Die Lücke vom Szenenanfang bis zum ersten Element gehört nicht dazu (dafür gilt der Test zum Szenenanfang) |
| Zitat | höchstens 800 Pixel hoch, Zitat-Unterzeile darunter | Protokoll |
| Ton | −14 LUFS (±1), True Peak höchstens −1,5 dB | `ffmpeg -i datei -af ebur128=peak=true -f null -`, Werte „I“ und „True peak“ der Zusammenfassung. Reißt der True Peak knapp, wird der Begrenzer auf 0,80 gesenkt |
| Stimme gegen Musik | Während die Stimme läuft, liegt die Musik im Mittel mindestens 12 dB darunter (Startwert, noch nicht an einer Folge gemessen) | Das Bauskript legt Stimmenbus und Musik nach dem Ducking als getrennte WAV-Dateien ab (`stimme.wav`, `musik.wav`, 44,1 kHz, so lang wie das Video, neben `layout.json`). Gemessen wird der RMS-Pegel in nicht überlappenden Fenstern von 1 s; ausgewertet werden Fenster, in denen die Stimme über −45 dBFS liegt; Mittel der Pegeldifferenz in dB; Pegelboden −100 dBFS; gibt es kein Fenster mit Stimme, entfällt die Prüfung mit Warnung. Ausgabe aller Prüfungen: `pruefung.json` mit `name`, `messwert`, `grenze`, `ergebnis` |
| Länge | 42 bis 65 Sekunden (Toleranz 0,1 s) | Dauer der Datei; zusätzlich muss die Summe der `dauer` im Protokoll der Dateilänge entsprechen (Toleranz 0,3 s) |
| Zeitfenster | Stempel zwischen 1,8 und 4,2 s und 0,3 s vor `standwort_beginn` (gilt 1,8 s als Untergrenze, ist das erlaubt); Badge der Stand-Szene zwischen 0,3 und 0,8 s; Meta-Zeilen im Abstand von mindestens 0,5 s; Auswahlkarten im Abstand von mindestens 1,4 s; letztes Element frühestens bei `dauer` − Lückengrenze der Szene | Protokoll |
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
| Kommunalpolitiker oder Redakteur | prüft Sachlichkeit | Neutralität, Vertrauen |
| Gast (wechselt) | zum Beispiel Designer, Stratege, Barrierefreiheit | frischer Blick, Befund zählt erst ab zweiter Nennung oder wenn er messbar ist |

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
6. **Neue Fassung prüfen:** Schritte 1 bis 3 mit der geänderten Fassung als Neu und der letzten übernommenen Fassung als Alt.
7. **Übernahme nur bei Fortschritt:** Befund behoben, kein Kriterium schlechter (Median des Panels), Maschinenprüfung bestanden. Dann ist Neu die letzte übernommene Fassung. Sonst zurück zur letzten übernommenen Fassung und anderen Weg wählen. Danach beginnt die nächste Runde.

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
| 2 | Folge „Bebauungsplan“ (vertagt), Folge „Photovoltaik“ (Empfehlung), Widerspruchsprüfung | 10 + 10 + 12, davon 3 + 4 + 2 blockierend | Ruhebild-Ausnahme für den Schluss, Standwort als 5. bis 8. Wort, Statuskarte mit Maßen, Definition „Element“ und Satzteile, Stand aus Plenara, Abstimmung nur mit Zahlen, Details entweder Zeilen oder Zahlen, Zitatgrenze 165, Kurzname und Quellenname getrennt, Datumsformate, Wortzeitformel, Hook bei Platznot, Zoom und Rahmen |
| 3 | Folge „Haushalt“ (Paketbeschluss mit Abstimmung), Folge „Einwohnerantrag“ (Angekündigt, Varianten, lange Wörter), Widerspruchs- und Umsetzbarkeitsprüfung | 10 + 10 + 11, davon 3 + 3 + 5 blockierend | Letztes Element frühestens bei Dauer − 4 s, Stempelfenster 1,8 bis 4,2 s, Layoutprotokoll mit Schema, Unterkante nur in der Ruhelage, Tonspuren getrennt, Mindestschriften je Art, Abstimmung als ein Block, Paketbeschlüsse, Einwohnerantrag, Kern bei Varianten |
| 4 | Folge „Zur Kenntnis“ (Kenntnisnahme ohne Beschluss), Folge „In Beratung“ (Paket aus zwei Teilen, Verbindungslinie), Widerspruchsprüfung | 11 + 10 + 12; blockierend zuletzt: Verbindungslinie und Position der Nebenzeile (Folge „In Beratung“) | Zeitgrenzen je Szene, Rollen im Layoutprotokoll (Spalte B, Bildrand, Pixelprobe), Zur Kenntnis, Begriffsliste, Farbabweichungen der Folgen 1 bis 4, Reihenfolge von Verkleinern und Umbrechen im Hook. Offen aus der „In Beratung“-Prüfung: Maße und Zeit der Verbindungslinie, Position der Nebenzeile im Hook, Präfixtabelle je Antragstellerart, Schriftmetrik |

## 15. Automatik (Stand 31.10.2026)

Für Folgen ohne Handarbeit gilt dieselbe Bauart wie oben, mit den hier genannten Abweichungen. Der Ablauf: Bericht → Datenblatt (`shared/social-video-sheet.mjs`, Version `sheet-v1`, Aufruf `scripts/social-video/sheet-cli.mjs`) → Video (`scripts/social-video/auto.py`). Das Datenblatt setzt nur feste Satzvorlagen ein und nimmt wörtliche Auszüge; fehlt etwas, steht es in `warnings`, `ok` ist falsch und es wird nicht gebaut. Freigabe bleibt Sache einer Person.

| Teil | Regel in der Automatik |
| --- | --- |
| Hook-Satz | „<Standwort> in <Ort>: <Thema>.“ Das Thema (Zeile 2) steht ab 0,45 s im Bild, nicht erst, wenn es gesprochen wird. („Beschlossen in <Ort>: …“, „In Beratung in <Ort>: …“, „Stand offen in <Ort>: …“, „Zur Kenntnis genommen in <Ort>: …“). Das Standwort steht also am Satzanfang. Der Stempel schlägt 0,3 s davor ein, zwischen 0,25 und 1,0 s. Thema (Zeile 2) erscheint, wenn es gesprochen wird |
| Kern (Szene 2) | Gewählt wird der Satz mit dem stärksten Entscheidungsverb („beauftragt“, „beschließt“, „bestätigt“, „empfiehlt“, „genehmigt“) vor schwächeren („wird“, „soll“). Das Zitat erscheint Wort für Wort, jedes Wort zu dem Zeitpunkt, an dem es gesprochen wird. Drei Größen: Subjekt mit Verb 150 (Schwarzgrau), Gegenstand 124 (Petrol), Rest 72 (Nebenzeilenfarbe). Passt der Block nicht bis y = 1380, werden alle Größen gemeinsam verkleinert (Untergrenze 50 Prozent). Der Block steht mittig. Einzelner Betrag im Zitat: er zählt in 0,9 s hoch (Zahl 150, Petrol) |
| Verlauf (Szene 3) | Zeitleiste: je Sitzung ein Punkt (60, grau, der letzte petrol), dazwischen eine petrolfarbene Linie (8, wächst 0,5 s lang), rechts „TT.MM.JJ · Gremium“ 64 und das Ergebnis 58. Höchstens drei Sitzungen; dauert das Video über 65 s, entfällt die älteste. Die Stimme nennt je Sitzung nur Datum und Ergebnis („Am sechzehnten September: mehrheitlich beschlossen.“), das Gremium steht nur im Bild; so bleibt die Szene unter etwa 10 s |
| Zitat (Szene 4) | Das Zitat erscheint im Lesetempo Wort für Wort (0,16 s je Wort), Schlüsselwörter petrol, Block mittig, Quellenzeile zuletzt. Die Szene ist stumm und dauert Maximum aus 6,5 s und 0,05 s je Zeichen |
| Beträge (Szene 4) | Nennen die Auszüge mindestens zwei Beträge mit Bezeichnung aus der Vorlage (Gesamtkosten, Förderung, Zuschuss, Haushaltsmittel, Eigenanteil, Puffer; Zusätze wie „voraussichtlich“ oder „geschätzt“ gehören dazu), ersetzt eine Zahlenszene das Zitat: je Betrag Bezeichnung (70) und Zahl (150, Petrol), alle gleich groß und gleich gefärbt, nacheinander gesprochen („Geschätzte Gesamtkosten: …“). Keine Balken, keine Differenz, keine Gegenüberstellung (Abschnitt 9, Punkt 8 und 11). Ein einzelner Betrag im Kernsatz zählt hoch |
| Stand (Szene 5) | Die nächste Sitzung steht als Datum („nächste Sitzung TT.MM.JJ“), nie als „in N Tagen“: Die Folge wird Tage nach dem Bau gesehen, ein Zählwert wäre dann falsch |
| Hinweis über dem Zitat | „Vorschlag aus der Vorlage“ steht nur, wenn das Zitat selbst einen Vorschlag ausspricht („beschließt“, „beauftragt“, „soll“ …) und der Stand weder „Beschlossen“ noch „Abgelehnt“ ist; sonst „Aus der Vorlage“ (Abschnitt 9, Punkt 10) |
| Zoomstoß | Bei jedem neuen Teil kurz 2,8 Prozent mehr Zoom, abklingend (Zeitkonstante 0,11 s, höchstens 0,8 s) |
| Aussprache | „P&R“ wird als „Park und Ride“ gesprochen, „&“ sonst als „und“; Beträge und Jahre ausgeschrieben |
| Länge | 42 bis 65 s; bei mehr als 65 s wird der Verlauf gekürzt, sonst wird nicht gebaut |

Der Server-Job `social-videos` (täglich 10:30 Uhr) baut zu jedem Vorschlag des Admin-Reiters „Social Media“ genau ein Video und löscht es, sobald der Vorschlag den Reiter verlässt; im Admin gibt es dazu nur die Freigabe (Betrieb: `docs/betrieb/node-server.md`, „Social-Videos“). Ein Datenblatt mit Warnungen wird nicht gebaut, der Grund steht im Reiter.

Nicht in der Automatik: Fotos (die Liste `docs/social/stock-fotos.md` nennt nur IDs; die Bilder müssen auf einem Rechner mit Zugriff geladen und geprüft werden, Kennzeichnung „Symbolbild“), Abstimmungsbalken (der Bericht enthält keine Zahlen dazu), Karte, bessere Stimme (Thorsten medium oder high, Dateien nötig), Plenara-Moment.

## 16. Wirkung in den Netzen

Dieser Abschnitt sagt, wie eine Folge in Instagram Reels, TikTok und YouTube Shorts gesehen, behalten und geteilt wird. Die Plattformangaben sind Arbeitswerte aus Drittquellen (Stand 31.10.2026: reap.video zu Sicherheitszonen, digitalapplied.com zur Hashtag-Grenze, klap.app zur Länge), keine offiziellen Vorgaben der Plattformen; sie sind unten als „Startwert“ gekennzeichnet und werden nach der Veröffentlichung an eigenen Zahlen geprüft.

### Die ersten drei Sekunden

Wer in den ersten Sekunden nicht erfährt, worum es geht und was daraus für ihn folgt, wischt weiter. Deshalb gilt für jede Folge:
- Sekunde 0 bis 1: Ort (Zeile 1) steht schon, der Stempel mit dem Ergebnis schlägt ein (spätestens bei 1,0 s, mit Schlag), Zeile 2 nennt das Thema, sobald es gesprochen wird. Es gibt kein Logo-Intro, keine Begrüßung, keinen Vorlauf.
- Der erste gesprochene Satz nennt Ergebnis, Ort und Thema in dieser Reihenfolge („Beschlossen in <Ort>: <Thema>.“). Er enthält keine Wertung, keine Frage mit Unterton und keine Zuspitzung („Skandal“, „Überraschung“).
- Ein Betrag oder eine Frist darf im Hook stehen, wenn er wörtlich in der Vorlage steht; er steht dann als Zahl, nicht als Frage.
- Das Titelbild (Bild bei 1,6 s, wird beim Bau mitgeschrieben) muss für sich lesbar sein: Ort, Thema und Stempel sichtbar, nichts halb eingeblendet. Prüfung: Bild ansehen, ohne das Video zu kennen.

### Stumm lesbar

Ein großer Teil der Zuschauer sieht ohne Ton. Jede Aussage der Stimme steht auch im Bild (Hook, Kernsatz, Verlauf, Stand). Der Kernsatz erscheint Wort für Wort, wenn er gesprochen wird; das ersetzt die Untertitelspur, die dann nicht zusätzlich eingebrannt wird.

### Sicherheitszonen (Startwert)

Die Oberfläche der Plattformen verdeckt Teile des Bildes. Arbeitswert aus der Quelle: oben etwa 15 Prozent (288 Pixel), unten 25 bis 35 Prozent (480 bis 672), seitlich 10 bis 15 Prozent (108 bis 162). Die Knopfspalte (Gefällt mir, Teilen) sitzt rechts und verdeckt dort die untere Bildhälfte; links ist es freier. Ist-Stand der Folgen: Unterkante des Inhalts bei 1450 (24,5 Prozent unten, am Rand der Vorgabe), seitlicher Rand 72 (6,7 Prozent), Logo und Ortschip bei y = 190 (innerhalb der oberen 15 Prozent). Das Instagram-Profilraster zeigt das Titelbild im Format 3:4 (Ausschnitt y = 240 bis 1680): Ort, Thema und Stempel müssen darin liegen. **Prüfpunkt:** eine Probefolge auf allen drei Plattformen hochladen (privat) und notieren, was verdeckt wird; danach Ränder und Chip-Position in Abschnitt 4 festlegen. Bis dahin gilt: Bedeutung trägt nie allein ein Element im Randstreifen.

### Länge (Startwert)

Zielwert 45 bis 55 Sekunden, Obergrenze 65 (Abschnitt 2). Die Quellen nennen keinen festen Wert: Kürzere Videos werden eher zu Ende gesehen, längere bringen mehr Sehzeit, wenn sie halten. Für erklärende Inhalte werden 30 bis 60 Sekunden genannt. Die Schlusskarte dauert 5 s (am 31.10.2026 von 8,5 s gekürzt, weil beide Prüfer sie als zu lang empfanden); die Haltequote an der Schlusskarte (Abschnitt „Freigabe und Messung“) zeigt, ob 5 s noch zu viel sind.

### Beschreibung, Hashtags, Titelbild

Jede Folge wird mit Text veröffentlicht, der aus dem Datenblatt kommt (keine eigene Deutung):

| Teil | Regel |
| --- | --- |
| Zeile 1 (die ersten 125 Zeichen sind sichtbar) | Hook-Satz plus Kern in einem Satz: „<Standwort> in <Ort>: <Thema>. <Kernsatz verkürzt>“ |
| Zeile 2 | Stand und Sitzung: „Zuletzt beraten: <Gremium>, <Datum>.“ und, wenn vorhanden, „Nächste Sitzung: <Datum>.“ |
| Zeile 3 | Quelle wie im Bild („Quelle: öffentliche Ratsunterlagen …“) und Hinweis „Zusammenfassung von Plenara, kein amtliches Dokument.“ |
| Zeile 4 | Aufruf ohne Druck: „Alle Beschlüsse zu <Ort>: Link im Profil / plenara.de“ |
| Hashtags | drei bis fünf (Instagram begrenzt auf fünf, Startwert): #<Ort>, #Kommunalpolitik, ein Themen-Tag (#Verkehr, #Klima …), #Plenara. Keine Partei-, Personen- oder Wertungs-Tags |
| Barrierefreiheit | Alternativtext und Transkript = Sprechtext der Folge |

### Wiedererkennung

Die Reihe wird an wenigen festen Zeichen erkannt: Stempel mit Standwort, Petrol auf Weiß, Zeitleiste, Soundlogo am Anfang und Ende, Ortschip. Diese Zeichen ändern sich nicht von Folge zu Folge; Neues kommt nur über den Inhalt.

### Neutralität in der Verpackung

Alles oben gilt auch für Beschreibung, Titelbild und Hashtags: wörtlich aus der Vorlage, keine Wertung, kein Parteiname, kein Antragsteller (Abschnitt 9). Wirkung entsteht durch Klarheit und Tempo, nicht durch Zuspitzung.

### Freigabe und Messung

Eine Person gibt jede Folge frei (Video, Titelbild, Beschreibung); das Programm veröffentlicht nichts selbst. Nach der Veröffentlichung werden je Folge erfasst: Anteil, der die ersten drei Sekunden sieht, Haltequote bei der Hälfte und an der Schlusskarte, Sehdauer im Mittel, Speichern, Teilen, Profilbesuche, Klicks auf plenara.de. Nach zehn Folgen werden Länge, Hook-Form und Schlusskarte verglichen und die Startwerte dieses Abschnitts angepasst. Bis dahin sind sie Annahmen, keine Ergebnisse.

### Offene Prüfpunkte vor dem ersten Einsatz

Diese Punkte sind nicht entschieden und brauchen eine Person mit Zuständigkeit oder eine Probe:
- **Kennzeichnung:** Synthetische Stimme und maschinell erstellter Text: prüfen lassen, ob die Kennzeichnungspflichten der Plattformen und der KI-Verordnung (Artikel 50, gilt ab 2.8.2026) greifen oder die Ausnahme für redaktionell geprüfte Inhalte. Rechtsfrage, nicht vom Bauplan zu entscheiden.
- **Untertitel und Transkript:** Plattform-Untertitel einschalten und Eigennamen korrigieren (YouTube: SRT-Datei); das Transkript (Sprechtext) steht in der Beschreibung oder im ersten Kommentar.
- **Sichtbare Zeichen der Beschreibung:** Im Feed sind etwa 125 Zeichen sichtbar, in der Reels- und TikTok-Ansicht vermutlich weniger (60 bis 80, ungeprüft). Der Hook-Satz steht deshalb ganz vorn.
- **Veröffentlichungszeit (Startwert):** innerhalb von 48 Stunden nach der Sitzung; die Uhrzeit wird nach den ersten Folgen aus den eigenen Statistiken gewählt.
- **Kommentare:** Antworten nur mit Fundstelle in den Unterlagen, keine Bewertung, keine Parteinahme. Ein sachlicher Fehler wird mit einem angehefteten Korrekturkommentar benannt, und die Folge wird ersetzt.
- **Gegenprüfung:** Vor jeder Freigabe prüft eine zweite Person Zahlen, Daten, Namen und Zitat gegen die Vorlage (Abschnitt 9, Punkt 6). Ein Verfahrenswort im Verlauf („punktweise Abstimmung“) wird nur gezeigt, wenn das Ergebnis der Sitzung im Verlauf steht oder klar ist.
- **Vergleichbarkeit der Messung:** Mit einer Fassung je Folge gibt es keine Gegenprobe. Vergleich daher über Folgen mit gleichem Stand und ähnlicher Länge, nicht über beliebige Folgen.
