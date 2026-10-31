# Bauplan: Social-Media-Videos (Hochformat)

Stand 31.10.2026. Gilt nur für Videos auf Instagram Reels, TikTok und YouTube Shorts. Die Erklärvideos auf plenara.de (`docs/videos/`) sind eine eigene Reihe mit eigenem Regelwerk. Sprechtexte und Datenblätter der einzelnen Folgen gehören nicht in dieses Dokument.

## 1. Ziel und Rahmen

Jedes Video erklärt einen echten Ratsbeschluss (oder Vorgang) so, dass Bürger ihn in 40 bis 60 Sekunden verstehen. Plenara tritt als Quelle auf, nicht als Werbebotschaft: Logo und Ortschip stehen von Anfang an oben, die Schlusskarte nennt plenara.de als einzigen Aufruf. Etwa vier Fünftel der Zeit gehören dem Beschluss.

Die Videos kommen ohne Fotos und ohne Untertitel aus. Sie müssen auch stumm lesbar sein: Bildtext, Icons und Statusfarben tragen den Kern, die Stimme ergänzt.

## 2. Technik

| Punkt | Vorgabe |
| --- | --- |
| Format | 1080 × 1920 (9:16), 30 Bilder pro Sekunde, MP4 mit H.264 (CRF 16 bis 17) und AAC |
| Länge | 40 bis 65 Sekunden, ergibt sich aus Sprechtext und Mindestdauern der Szenen |
| Bildaufbau | Jedes Einzelbild wird per Skript gezeichnet (Python mit PIL) und an ffmpeg übergeben. Szenen werden einzeln gerendert und mit `xfade` (0,2 s, im Wechsel slideleft, wipeup, circleopen, slideup) verbunden |
| Bewegung | Jede Szene zoomt über ihre Dauer um 4 Prozent, außer der Schlusskarte. Elemente blenden ein, gleiten ein oder poppen (Stempel mit abklingendem Wackeln) |
| Stimme | Eine feste synthetische deutsche Stimme für die ganze Reihe (bisher Piper, Modell `de-thorsten-low`), danach mit `atempo=0,86` verlangsamt. Je Szene eine eigene Sprechdatei |
| Ton | Szenenstimmen werden mit 0,5 s Vorlauf an den Szenenanfang gelegt. Musik läuft darunter und wird bei Stimme automatisch leiser (Sidechain). Ziel −14 LUFS, Spitze höchstens −1,5 dB |
| Aussprache | Der Name wird für die Stimme „Plenarra“ geschrieben (nur im Sprechtext, nie im Bild) |

## 3. Aufbau: sechs Szenen

Jede Folge hat dieselben sechs Szenen. Die Dauer einer Szene ist das Größere aus Mindestdauer und Länge der Stimme plus 0,5 s Vorlauf plus Nachlauf.

| Nr. | Szene | Mindestdauer | Nachlauf | Inhalt |
| --- | --- | --- | --- | --- |
| 1 | Hook | 6 s | 1 s | Ort und Thema als Titel (höchstens zwei Zeilen), darunter Stichwort oder Antragsteller klein. Der Stempel zeigt nur das Standwort (kein Zusatz), Breite höchstens 860 Pixel, Neigung etwa −5 Grad, Schrift bis 168. Darunter pulsiert das Themen-Icon (Kreis 300). Der Stand steht im ersten gesprochenen Satz, höchstens elf Wörter davor |
| 2 | Kern | 7 s | 2,5 s | Die Kernaussage groß, bei mehreren Varianten als Auswahl (A, B mit Buchstaben-Kreis) |
| 3 | Details | 7 s | 3 s | Betroffene oder Maßnahmen als Zeilen mit Icon, bei Abläufen mit Verbindungslinie, oder Kernzahlen mit Beschriftung |
| 4 | Zitat | 6,5 s, mindestens 0,07 s je Zeichen des Zitats (der Nachlauf wird nicht dazugerechnet, die Szene ist stumm) | 1 s | Wörtlich aus der Vorlage, Schlüsselwörter hervorgehoben, darunter „Aus der Vorlage · Ort“. Wird nicht gesprochen, damit Zeit zum Lesen bleibt |
| 5 | Stand | 7 s | 1,5 s | Statuskarte mit Band in Statusfarbe, Badge, Statuswort, darunter Gremium und „zuletzt beraten am …“, bei Bedarf nächste Sitzung |
| 6 | Schluss | 8,5 s | 1 s | Titel „Beschlüsse zu Ihrem Ort“, Logo groß, festes Motto, plenara.de als pulsierende Pille, Quelle und Hinweis „kein amtliches Dokument“ |

Schlusskarte (von oben): Titel „Beschlüsse zu Ihrem Ort“ 100, Zeile „finden Sie bei“ 64 mit Pin, Logo 520 breit, Motto 64, Pille plenara.de 104, Quelle 50, Hinweis 48, Ende bei etwa 1450. Das Motto lautet „Besser verstehen, was vor Ort beraten wird.“

Die Schlussszene verwendet in jeder Folge dieselbe Sprechdatei. Richtwert für die Stimme: etwa 2 Wörter pro Sekunde (verlangsamt, lange Zahlwörter weniger).

## 4. Layout und Abstände

Rand links und rechts 72 Pixel, Satzbreite 936 Pixel. Ortschip und Logo stehen bei y = 190. Inhalte beginnen bei y = 350 bis 400 und enden bei höchstens 1450. Ab y = 1500 bleibt alles frei, dort liegen die Bedienelemente der Apps.

Richtwerte für Schriftgrößen (Pixel, werden bei langen Texten auf die Satzbreite verkleinert):

| Element | Größe |
| --- | --- |
| Titel im Hook | 96 bis 108, passt sich der Satzbreite an |
| Untertitel im Hook | 84 bis 94 |
| Kernaussage | 150 (zwei Zeilen) oder 70 bis 84 als Erklärsatz |
| Zeilen in Listen | Text 76 bis 84, Icon-Kreis 176, Zeilenabstand 238 (Kreis plus 62) |
| Zitat | von 92 abwärts, bis es höchstens 800 Pixel hoch ist und das längste Wort in die Satzbreite passt |
| Statusbadge und -wort | Badge 300, Wort 140 bis 190 |
| Meta-Zeilen im Stand | 52 bis 60, dunkel (nicht grau) |
| Quelle und Hinweis im Schluss | mindestens 48 |

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
| Gremium, Rathaus | Halle |
| Termin | Kalender |
| Stand | Haken, Kreuz, Sanduhr |

Für Themen ohne Symbol (zum Beispiel Wärme) das nächstliegende Symbol nehmen (Haus) oder ein neues im selben Stil ergänzen und hier eintragen.

## 5. Stil und Farben

Der Look folgt dem verbindlichen Farbschema „Petrol klar“ (`docs/farbschema-petrol-klar-2026-10-17.pdf`).

| Element | Regel |
| --- | --- |
| Hintergrund | Weiß mit zartem Petrol-Schimmer und drehendem Punktering, nie Petrol als Fläche, keine Fotos |
| Schrift | IBM Plex Sans, Überschriften SemiBold, Text Regular |
| Akzent | Petrol `--rm-fill` (#268478) für Icons, Hervorhebungen, Zahlen |
| Text | Schwarzgrau `--rm-c900` (#18181B), Nebenzeilen `--rm-c600` (#52525B), Weiß `--rm-on` |
| Status beschlossen | Dunkelblau `--rm-ok` (#0C4A6E) |
| Status abgelehnt | Orange-Braun `--rm-no` (#B45309) |
| Status offen (alle übrigen) | Grau `--rm-c700` (#3F3F46) |
| Icons | Ein Stil: Kreis in Petrol (Statusfarbe im Stand) mit weißem Symbol |
| Logo | Echtes Plenara-Logo mit Ortschip dauerhaft oben links, groß in der Schlusskarte |
| Motto | Festes Motto der Reihe unter dem Logo, im Repo festgelegt |

Es gelten nur die Farben des Farbschemas, die Werte stehen in `app/styles/tokens.css`. Die ersten vier Folgen verwenden für „offen“ ein etwas bläuliches Grau (#3F4850), das dort nicht vorkommt. Ab der nächsten Folge gilt `--rm-c700`, die vier Folgen werden bei Gelegenheit neu gerendert.

### Status und Wortlaut

Die Videos verwenden die Stände von Plenara (`STATUS` in `shared/types.ts`), mit demselben Wort. Der Stand wird immer mit Wort und Icon gezeigt, nie nur mit Farbe. Alles außer „Beschlossen“ und „Abgelehnt“ trägt den Zusatz „Noch nicht beschlossen“ (bei „Vertagt“ „Noch nicht entschieden“), damit eine Empfehlung oder Ankündigung nicht wie ein Beschluss wirkt.

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
- Jede Szene zeigt innerhalb von 0,8 s etwas Lesbares (kein leerer Szenenanfang, kein Ruhebild über mehrere Sekunden).
- Der Stempel im Hook erscheint, wenn die Stimme den Stand nennt, frühestens nach 1,8 s.
- Zahlen zählen nicht hoch, sie erscheinen fertig.
- Die Schlussszene baut sich gestaffelt auf, die Adresse pulsiert, Quelle und Hinweis erscheinen früh genug, um gelesen zu werden.

## 7. Datenblatt je Folge

Jede Folge entsteht aus einem Datenblatt mit diesen Feldern. Ohne vollständiges Datenblatt wird nicht gebaut.

| Feld | Hinweis |
| --- | --- |
| Vorgang | Kennung bei Plenara (verhindert doppelte Folgen) |
| Ort | wie in der Quelle |
| Stand | genau einer der Stände aus der Tabelle in Abschnitt 5, abgeleitet aus der jüngsten Station des Vorgangs. Der Verlauf liefert nur Datum und Sitzung, nicht den Stand |
| Gremium der letzten Beratung | wie in der Quelle |
| Datum der letzten Beratung | im Bild 29.10.26, im Sprechtext ausgeschrieben |
| Gremium und Datum der nächsten Sitzung | nur wenn in den Unterlagen vorhanden. Künftige Termine heißen „nächste Sitzung“, vergangene „zuletzt beraten am“ |
| Titel und Stichwort | Titel zeigt Ort und Thema, Stichwort oder Antragsteller klein darunter |
| Kernaussage | ein Satz |
| Details | drei bis vier Zeilen mit Icon, oder Kernzahlen mit Beschriftung |
| Originalzitat | wörtlich, höchstens etwa 150 Zeichen, Auslassungen mit […], innere Anführungszeichen einfach (‚…‘). Bei mehreren Varianten wird ein Satz der Kernentscheidung zitiert, die Varianten stehen in der Kern-Szene |
| Quelle | „Quelle: öffentliche Ratsunterlagen der …“ |
| Sprechtext | sechs Teile (Zitat bleibt leer), laut Regeln in Abschnitt 8 |

## 8. Regeln für den Sprechtext

- Anrede „Sie“, Sätze mit höchstens etwa 14 Wörtern.
- Zahlen, Jahre und Daten ausgeschrieben, damit die Stimme sie richtig liest. Sehr lange Zahlwörter vermeiden: Beträge lieber zeigen als vorlesen, das verkürzt die Szene deutlich.
- Der Sprechtext darf kürzer sein als der Bildtext, aber nichts sagen, was nicht in der Vorlage steht.
- Das Zitat wird nicht gesprochen.
- Fachwörter (zum Beispiel „Quartierswärmemanagement“) werden nur erklärt, wenn die Vorlage oder das Plenara-Glossar (`docs/technik/glossar.md`) die Erklärung liefert. Sonst bleibt das Fachwort stehen, eine Abkürzung ist nach der ersten Nennung erlaubt. Eigene Deutungen kommen nicht dazu.
- Der Stand steht im ersten Satz. Die Beträge und Zahlen, die im Bild stehen, müssen nicht vorgelesen werden.

## 9. Inhaltsregeln

1. Sachlich und neutral. Berichtet wird, was beschlossen oder beraten wurde, nicht bewertet. Keine Superlative, keine Vergleiche.
2. Quelle immer sichtbar (Zitatunterzeile und Schlusskarte). Absender ist Plenara, nicht die Kommune.
3. Zitate wörtlich. Was als „Aus der Vorlage“ erscheint, ist Originaltext. Eigene Zusammenfassungen sind keine Zitate.
4. Antragsteller nur, wenn die Vorlage sie nennt. Sie stehen klein und grau in der Nebenzeile, nie im Titel und nie im Stempel.
5. Empfehlung ist kein Beschluss. Begriffe wie „Förderung empfohlen“ gehören mit „Noch nicht beschlossen“ zusammen.
6. Gegenprüfung vor der Veröffentlichung: Zahlen, Daten, Namen und Zitat gegen die Vorlage prüfen, durch jemanden, der das Video nicht gebaut hat.
7. Keine Bilder erkennbarer Personen. Ohne Fotos entfällt die Bildkennzeichnung.

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
- Kleine graue Nebenzeilen sind für viele kaum lesbar: dunkle Farbe, mindestens 48 Pixel.
- Der Stempel zeigt das Ergebnis schon nach etwa drei Sekunden, vor dem Inhalt. Mehrere Prüfpersonen empfanden das bei Ablehnungen als wertend.
- Fachwörter aus der Vorlage (etwa „Mittel einstellen“) bleiben unverständlich: wenn möglich in Klartext fassen, ohne den Sinn zu ändern.

## 12. Noch nicht umgesetzt

- Aufnahme der echten Plenara-Seite („Plenara-Moment“) als Szene vor dem Schluss.
- Menschliche oder hochwertige Stimme für die ganze Reihe.
- Flaches Statusschild statt schräger Stempel, erst nach der ersten Aussage.
- Graues „offen“ in den vier Folgen auf `--rm-c700` umstellen (neu rendern).
- Die Status Empfehlung, In Beratung, Vertagt und Zur Kenntnis in je einer Folge erproben.
- Messung von Sehdauer, Speichern, Teilen und Klicks nach der Veröffentlichung.
- Die Maschinenprüfung aus Abschnitt 13 liegt bisher nur teilweise im Bauskript (Unterkanten, Wortbreite). Leerer Szenenanfang, Ruhebild, Mindestschrift und Ton sind noch zu automatisieren.
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

Jede Fassung muss bestehen, bevor Personen sie sehen:

| Prüfung | Grenze |
| --- | --- |
| Unterkante aller Inhalte je Szene | höchstens 1450 Pixel |
| Kleinste Schrift | mindestens 44 Pixel |
| Angeschnittene Wörter | keines (Wortbreite höchstens Satzbreite) |
| Leerer Szenenanfang | in den ersten 0,8 Sekunden jeder Szene ist etwas Lesbares sichtbar |
| Ruhebild | höchstens 4 Sekunden ohne neues Element |
| Zitat | höchstens 800 Pixel hoch, Quelle darunter |
| Ton | −14 LUFS (±1), Spitze höchstens −1,5 dB, Stimme nie von Musik übertönt |
| Länge | 40 bis 65 Sekunden |
| Fakten | Zahlen, Daten, Namen und Zitat stimmen mit der Vorlage überein (Gegenprüfung durch eine Person oder einen Agenten, der nur Vorlage und Datenblatt sieht) |

### Kriterien (feste Messlatte, je 0 bis 2)

Jede Prüfperson vergibt je Fassung und Kriterium 0 (Mangel), 1 (in Ordnung) oder 2 (gut), mit dem Anker aus der Tabelle. Dieselbe Tabelle gilt in jeder Runde.

| Kriterium | 2 = gut | 0 = Mangel |
| --- | --- | --- |
| Verstehen in 3 Sekunden | Ort, Thema und Stand sind ohne Ton sofort klar | Man weiß nach 3 Sekunden nicht, worum es geht |
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

Jede Prüfperson ist ein frischer Agent ohne Vorwissen. Er bekommt nur die Bilder, den festen Briefkasten (unten) und nicht die Absicht der Änderung.

### Material für die Prüfung

Je Fassung ein Kontaktbogen (ein Bild alle 1,5 Sekunden, 8 Spalten, 270 Pixel Breite) und zusätzlich Einzelbilder in voller Auflösung bei 0,8 s, 2,5 s und bei jedem Szenenwechsel. Kontaktbögen eignen sich für Tempo und Abfolge, nicht für Schriftgrößen: Dafür gelten die Maschinenprüfung und die Einzelbilder. Der Briefkasten nennt die bewusst festen Rahmenbedingungen (keine Fotos, weißer Hintergrund, Statusfarben, freie Zone ab 1500, festes Logo), damit sie nicht jedes Mal als Mangel gemeldet werden.

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
