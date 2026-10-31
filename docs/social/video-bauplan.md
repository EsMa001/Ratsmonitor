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
| 1 | Hook | 6 s | 1 s | Ort und Thema als Titel, darunter Stichwort oder Antragsteller klein. Nach etwa drei Sekunden schlägt der Stempel mit dem Stand ein, darunter pulsiert das Themen-Icon |
| 2 | Kern | 7 s | 2,5 s | Die Kernaussage groß, bei mehreren Varianten als Auswahl (A, B mit Buchstaben-Kreis) |
| 3 | Details | 7 s | 3 s | Betroffene oder Maßnahmen als Zeilen mit Icon, bei Abläufen mit Verbindungslinie, oder Kernzahlen mit Beschriftung |
| 4 | Zitat | 6,5 s, mindestens 0,07 s je Zeichen des Zitats | 1 s | Wörtlich aus der Vorlage, Schlüsselwörter hervorgehoben, darunter „Aus der Vorlage · Ort“. Wird nicht gesprochen, damit Zeit zum Lesen bleibt |
| 5 | Stand | 7 s | 1,5 s | Statuskarte mit Band in Statusfarbe, Badge, Statuswort, darunter Gremium und „zuletzt beraten am …“, bei Bedarf nächste Sitzung |
| 6 | Schluss | 8,5 s | 1 s | Titel „Beschlüsse zu Ihrem Ort“, Logo groß, festes Motto, plenara.de als pulsierende Pille, Quelle und Hinweis „kein amtliches Dokument“ |

Die Schlussszene verwendet in jeder Folge dieselbe Sprechdatei.

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

Kein Text unter 44 Pixel. Zwischen Gruppen mindestens 40 Pixel Abstand, zwischen Zeilen einer Liste 60 Pixel und mehr. Labels (Pillen, Überschriften) stehen auf einer Zeile und haben höchstens sechs Wörter. Vor jeder Veröffentlichung wird die Unterkante jedes Elements gemessen (Prüfung im Skript), nicht nach Gefühl.

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
| Ort und Gremium | wie in der Quelle |
| Stand | beschlossen, abgelehnt, offen oder angekündigt |
| Datum der letzten Beratung, nächste Sitzung | nur wenn in den Unterlagen vorhanden |
| Titel und Stichwort | Titel zeigt Ort und Thema, Stichwort oder Antragsteller klein darunter |
| Kernaussage | ein Satz |
| Details | drei bis vier Zeilen mit Icon, oder Kernzahlen mit Beschriftung |
| Originalzitat | wörtlich, Auslassungen mit […], innere Anführungszeichen einfach (‚…‘) |
| Quelle | „Quelle: öffentliche Ratsunterlagen der …“ |
| Sprechtext | sechs Teile (Zitat bleibt leer), laut Regeln in Abschnitt 8 |

## 8. Regeln für den Sprechtext

- Anrede „Sie“, Sätze mit höchstens etwa 14 Wörtern.
- Zahlen, Jahre und Daten ausgeschrieben, damit die Stimme sie richtig liest. Sehr lange Zahlwörter vermeiden: Beträge lieber zeigen als vorlesen, das verkürzt die Szene deutlich.
- Der Sprechtext darf kürzer sein als der Bildtext, aber nichts sagen, was nicht in der Vorlage steht.
- Das Zitat wird nicht gesprochen.

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
5. Kontaktbögen (ein Bild alle 1,5 bis 2 Sekunden) und Einzelbilder bei 0,8 s und 2,5 s ansehen. Auf leere Szenenanfänge, umbrochene Labels, abgeschnittene Wörter und Überlappungen achten.
6. Ton prüfen (−14 LUFS, Spitze höchstens −1,5 dB).
7. Gegenprüfung des Inhalts (Abschnitt 9, Punkt 6).
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

## 13. Prüfverfahren

Zehn Prüfrunden mit je einer anderen kalten Prüfperson (sieht nur Kontaktbögen und Einzelbilder, kennt den Rahmen) haben das Gerüst geschärft. Die Noten lagen zwischen 5 und 7 von 10 und stiegen nicht stetig, einzelne Prüfpersonen widersprachen sich (zu schnell oder zu langsam). Neue Folgen werden deshalb mit zwei bis drei unterschiedlichen Prüfpersonen geprüft, nicht mit einer. Gebaut sind bisher vier Folgen: Halle (abgelehnt), Dresden (beschlossen), Billerbeck (offen) und Oststeinbek (angekündigt).
