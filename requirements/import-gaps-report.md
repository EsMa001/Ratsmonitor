# Lückenhafte Abrufe

Stand: 2026-10-03 · 427 Gebiete im Katalog · erzeugt mit `node scripts/import-gaps.mjs`

| Befund | Gebiete |
|---|---|
| Zeitraum unvollständig | 27 |
| angebunden, keine Daten | 2 |
| letzter Abruf unvollständig | 111 |
| nicht angebunden | 93 |
| ok | 194 |

Die Links öffnen den Admin-Bereich (Seite „Daten & Verarbeitung“) mit vorausgewählten Gebieten. Dort den Abrufzeitraum wählen und den Abruf starten; gespeicherte, fortsetzbare Abrufe machen an der Abbruchstelle weiter.

**1. Vorrang: echte Zeitlücken und Gebiete ohne Daten** (29 Gebiete)

```
/admin?auswahl=billerbeck,nrw-05366004,nrw-05362004,nrw-05362008,borken,nrw-05362020,nrw-05366,nrw-05154016,nrw-05758016,nrw-05362032,nrw-05758020,nrw-05114000,nrw-05358028,nrw-05315000,nrw-05358032,nrw-05766048,nrw-05358040,nrw-05366032,nrw-05358052,nrw-05362036,nrw-05554064,nrw-05358060,nrw-05166,nrw-05758036,nrw-05366040,nrw-05362040,nrw-05166036,nrw-05914000,nrw-05122000
```

**2. Alles, inklusive Abrufe mit einzelnen Fehlern** (140 Gebiete)

```
/admin?auswahl=billerbeck,nrw-05366004,nrw-05362004,nrw-05362008,borken,nrw-05362020,nrw-05366,nrw-05154016,nrw-05758016,nrw-05362032,nrw-05758020,nrw-05114000,nrw-05358028,nrw-05315000,nrw-05358032,nrw-05766048,nrw-05358040,nrw-05366032,nrw-05358052,nrw-05362036,nrw-05554064,nrw-05358060,nrw-05166,nrw-05758036,nrw-05366040,nrw-05362040,nrw-05166036,nrw-05914000,nrw-05122000,nrw-05334002,nrw-05554004,nrw-05358004,nrw-05558004,nrw-05766004,nrw-05970004,nrw-05382008,nrw-05570008,nrw-05570012,nrw-05978004,nrw-05766016,nrw-05554008,nrw-05911000,nrw-05314000,nrw-05362012,nrw-05562004,coesfeld,nrw-05562008,nrw-05562012,nrw-05913000,nrw-05570016,nrw-05112000,nrw-05558016,nrw-05358008,nrw-05111000,nrw-05566008,nrw-05954,nrw-05570020,nrw-05113000,nrw-05366016,nrw-05570024,nrw-05362024,nrw-05978012,nrw-05562014,nrw-05162008,nrw-05554020,nrw-05754,nrw-05915000,nrw-05170012,nrw-05558020,nrw-05358012,nrw-05370,nrw-05962016,nrw-05382020,nrw-05758012,nrw-05158016,nrw-05766032,nrw-05762020,nrw-05358016,nrw-05362028,nrw-05358020,nrw-05358024,nrw-05154024,nrw-05366024,nrw-05166012,nrw-05154036,nrw-05162020,nrw-05970024,nrw-05566032,nrw-05966020,nrw-05316000,nrw-05358036,nrw-05766,nrw-05974024,nrw-05558024,nrw-05766052,nrw-05374024,nrw-05562024,nrw-05958024,nrw-05958028,nrw-05962040,nrw-05170024,nrw-05116000,muenster,nrw-05970032,nrw-05166016,nrw-05170028,nrw-05162024,nrw-05358048,nrw-05566068,nrw-05378020,nrw-05766056,nrw-05558036,nrw-05966024,nrw-05774,nrw-05774032,nrw-05770040,nrw-05120000,nrw-05754028,nrw-05162,nrw-05382,nrw-05382048,nrw-05566076,nrw-05378,nrw-05570036,nrw-05954024,nrw-05370024,nrw-05970,nrw-05334028,steinfurt,nrw-05754040,nrw-05770044,nrw-05154052,nrw-05358056,nrw-05754044,nrw-05154060,warendorf,nrw-05974052,nrw-05170,nrw-05124000,nrw-05370028
```

Hinweis: Eine Lücke zählt erst ab 45 Tagen ohne Daten am Fensteranfang; die Sommerpause (Juli/August) wird nicht als Lücke gewertet. Nichtöffentliche Sitzungsteile sind grundsätzlich nicht abrufbar.

## Zeitraum unvollständig (27)

| Gebiet | Zeitraum | soll ab | Daten ab | fehlen ca. | Vorgänge | fortsetzbar | Fehler |
|---|---|---|---|---|---|---|---|
| Stadt Billerbeck | 24 Monate | 2024-10-03 | 2025-10-09 | 12 Monate | 408 | ja | 13 |
| Gemeinde Weilerswist | 12 Monate | 2025-10-03 | 2026-10-08 | 12 Monate | 28 | nein | 5 |
| Kreis Borken | 12 Monate | 2025-10-03 | 2026-09-17 | 11 Monate | 75 | ja | 16 |
| Stadt Bad Münstereifel | 12 Monate | 2025-10-03 | 2026-09-15 | 11 Monate | 97 | nein | 2 |
| Stadt Bergheim | 12 Monate | 2025-10-03 | 2026-09-15 | 11 Monate | 108 | nein | 2 |
| Stadt Kerpen | 12 Monate | 2025-10-03 | 2026-09-15 | 11 Monate | 180 | nein | 4 |
| Gemeinde Vettweiß | 12 Monate | 2025-10-03 | 2026-09-14 | 11 Monate | 35 | nein | 2 |
| Stadt Pulheim | 12 Monate | 2025-10-03 | 2026-09-10 | 11 Monate | 146 | nein | 2 |
| Stadt Erftstadt | 12 Monate | 2025-10-03 | 2026-09-08 | 11 Monate | 120 | nein | 2 |
| Stadt Wesseling | 12 Monate | 2025-10-03 | 2026-09-08 | 11 Monate | 129 | nein | 5 |
| Kreis Euskirchen | 12 Monate | 2025-10-03 | 2026-09-02 | 11 Monate | 89 | nein | 6 |
| Gemeinde Kreuzau | 12 Monate | 2025-10-03 | 2026-09-02 | 11 Monate | 75 | nein | 2 |
| Kreis Viersen | 12 Monate | 2025-10-03 | 2026-09-02 | 11 Monate | 65 | nein | 1 |
| Gemeinde Langerwehe | 12 Monate | 2025-10-03 | 2026-07-15 | 9 Monate | 71 | nein | 5 |
| Gemeinde Hiddenhausen | 12 Monate | 2025-10-03 | 2026-07-09 | 9 Monate | 77 | nein | 0 |
| Gemeinde Nörvenich | 12 Monate | 2025-10-03 | 2026-07-09 | 9 Monate | 44 | nein | 4 |
| Stadt Bedburg | 12 Monate | 2025-10-03 | 2026-07-07 | 9 Monate | 87 | nein | 4 |
| Gemeinde Leopoldshöhe | 12 Monate | 2025-10-03 | 2026-07-07 | 9 Monate | 96 | nein | 0 |
| Gemeinde Nettersheim | 12 Monate | 2025-10-03 | 2026-07-07 | 9 Monate | 73 | nein | 5 |
| Stadt Vlotho | 12 Monate | 2025-10-03 | 2026-07-07 | 9 Monate | 149 | nein | 0 |
| Stadt Velen | 12 Monate | 2025-10-03 | 2026-07-06 | 9 Monate | 45 | nein | 0 |
| Stadt Goch | 12 Monate | 2025-10-03 | 2026-07-02 | 9 Monate | 111 | nein | 0 |
| Gemeinde Kirchlengern | 12 Monate | 2025-10-03 | 2026-07-02 | 9 Monate | 105 | nein | 0 |
| Gemeinde Merzenich | 12 Monate | 2025-10-03 | 2026-07-02 | 9 Monate | 143 | nein | 11 |
| Stadt Willich | 12 Monate | 2025-10-03 | 2026-07-02 | 9 Monate | 109 | nein | 1 |
| Stadt Krefeld | 12 Monate | 2025-10-03 | 2026-02-04 | 4 Monate | 643 | nein | 4 |
| Stadt Köln | 12 Monate | 2025-10-03 | 2025-12-09 | 2 Monate | 4400 | nein | 1 |

## Angebunden, aber keine Daten (2)

| Gebiet | Quelle | letzter Versuch | Fehler |
|---|---|---|---|
| Stadt Hagen | oparl | 2026-10-01 | 2 |
| Stadt Solingen | oparl | 2026-10-02 | 1 |

## Letzter Abruf unvollständig (Zeitraum aber abgedeckt) (111)

| Gebiet | Daten ab | Vorgänge | fortsetzbar | Fehler |
|---|---|---|---|---|
| Stadt Essen | 2026-07-08 | 893 | nein | 96 |
| Stadt Hennef (Sieg) | 2026-07-06 | 132 | nein | 37 |
| Kreis Siegen-Wittgenstein | 2026-07-03 | 233 | nein | 24 |
| Kreis Lippe | 2026-07-06 | 96 | ja | 13 |
| Stadt Bochum | 2026-07-02 | 355 | nein | 10 |
| Stadt Euskirchen | 2026-07-07 | 120 | nein | 10 |
| Stadt Leverkusen | 2026-07-07 | 341 | ja | 10 |
| Stadt Linnich | 2026-07-08 | 95 | nein | 10 |
| Stadt Lügde | 2026-07-02 | 73 | nein | 10 |
| Stadt Moers | 2026-07-07 | 334 | nein | 9 |
| Gemeinde Augustdorf | 2026-07-02 | 84 | nein | 8 |
| Gemeinde Hürtgenwald | 2026-07-16 | 53 | nein | 8 |
| Gemeinde Titz | 2026-07-02 | 139 | nein | 8 |
| Stadt Blomberg | 2026-07-08 | 61 | nein | 7 |
| Stadt Kempen | 2026-07-02 | 147 | nein | 7 |
| Gemeinde Simmerath | 2026-07-02 | 72 | nein | 7 |
| Stadt Straelen | 2026-07-02 | 108 | nein | 7 |
| Gemeinde Aldenhoven | 2026-07-02 | 60 | nein | 6 |
| Stadt Brühl | 2026-09-08 | 18 | nein | 6 |
| Stadt Rahden | 2026-07-09 | 124 | nein | 6 |
| Stadt Rheine | 2025-09-29 | 894 | nein | 6 |
| Stadt Verl | 2026-07-02 | 104 | nein | 6 |
| Kreis Gütersloh | 2026-09-21 | 55 | nein | 5 |
| Stadt Hilden | 2026-07-02 | 169 | nein | 5 |
| Stadt Kleve | 2026-07-15 | 228 | nein | 5 |
| Stadt Neukirchen-Vluyn | 2026-07-08 | 163 | nein | 5 |
| Kreis Rheinisch-Bergischer Kreis | 2026-09-09 | 90 | nein | 5 |
| Gemeinde Steinhagen | 2026-07-15 | 73 | nein | 5 |
| Gemeinde Wachtendonk | 2026-07-09 | 60 | nein | 5 |
| Stadt Horn-Bad Meinberg | 2026-07-07 | 56 | nein | 4 |
| Stadt Nettetal | 2026-07-02 | 113 | nein | 4 |
| Stadt Wuppertal | 2026-07-02 | 605 | nein | 4 |
| Stadt Bonn | 2026-07-09 | 673 | nein | 3 |
| Stadt Düren | 2026-07-02 | 264 | nein | 3 |
| Stadt Düsseldorf | 2026-07-02 | 1705 | nein | 3 |
| Stadt Kreuztal | 2026-07-06 | 53 | nein | 3 |
| Stadt Mönchengladbach | 2026-07-02 | 396 | nein | 3 |
| Stadt Neuss | 2026-07-02 | 420 | nein | 3 |
| Stadt Olfen | 2025-10-28 | 282 | nein | 3 |
| Kreis Paderborn | 2026-07-06 | 119 | nein | 3 |
| Kreis Steinfurt | 2025-11-03 | 602 | nein | 3 |
| Kreis Warendorf | 2025-09-26 | 333 | nein | 3 |
| Kreis Wesel | 2026-09-14 | 95 | nein | 3 |
| Stadt Bocholt | 2026-09-08 | 192 | nein | 2 |
| Stadt Castrop-Rauxel | 2025-10-02 | 396 | nein | 2 |
| Kreis Coesfeld | 2025-11-05 | 377 | nein | 2 |
| Stadt Drensteinfurt | 2026-07-07 | 74 | nein | 2 |
| Stadt Gladbeck | 2026-09-03 | 170 | nein | 2 |
| Stadt Gronau (Westf.) | 2026-07-02 | 216 | nein | 2 |
| Gemeinde Havixbeck | 2025-10-09 | 294 | nein | 2 |
| Stadt Herford | 2025-10-01 | 564 | nein | 2 |
| Stadt Kalkar | 2026-07-02 | 139 | nein | 2 |
| Gemeinde Kall | 2026-09-22 | 37 | nein | 2 |
| Stadt Korschenbroich | 2026-07-02 | 106 | nein | 2 |
| Stadt Marsberg | 2026-07-02 | 92 | nein | 2 |
| Stadt Netphen | 2026-07-02 | 57 | nein | 2 |
| Stadt Ochtrup | 2025-10-06 | 487 | nein | 2 |
| Gemeinde Odenthal | 2026-07-07 | 74 | nein | 2 |
| Stadt Oerlinghausen | 2026-07-02 | 96 | nein | 2 |
| Stadt Paderborn | 2026-07-09 | 189 | nein | 2 |
| Stadt Rheda-Wiedenbrück | 2026-09-08 | 118 | nein | 2 |
| Kreis Rhein-Kreis Neuss | 2026-08-25 | 192 | nein | 2 |
| Kreis Rhein-Sieg-Kreis | 2026-07-02 | 178 | nein | 2 |
| Stadt Schwelm | 2026-07-07 | 181 | nein | 2 |
| Stadt Werl | 2026-07-02 | 78 | nein | 2 |
| Stadt Übach-Palenberg | 2026-07-07 | 120 | nein | 2 |
| Stadt Aachen | 2025-09-30 | 1654 | nein | 1 |
| Stadt Bad Berleburg | 2026-07-07 | 140 | nein | 1 |
| Stadt Bad Honnef | 2026-07-07 | 197 | nein | 1 |
| Stadt Bergkamen | 2026-07-02 | 87 | nein | 1 |
| Stadt Dorsten | 2025-10-23 | 701 | nein | 1 |
| Stadt Dortmund | 2026-07-02 | 2083 | nein | 1 |
| Stadt Duisburg | 2026-07-02 | 552 | nein | 1 |
| Stadt Emsdetten | 2025-09-29 | 429 | nein | 1 |
| Kreis Ennepe-Ruhr-Kreis | 2026-09-01 | 80 | nein | 1 |
| Stadt Ennigerloh | 2025-10-06 | 636 | nein | 1 |
| Stadt Frechen | 2026-07-07 | 212 | nein | 1 |
| Stadt Fröndenberg/Ruhr | 2026-07-08 | 110 | nein | 1 |
| Stadt Grevenbroich | 2026-07-02 | 231 | nein | 1 |
| Stadt Hamm | 2026-07-02 | 623 | nein | 1 |
| Stadt Hamminkeln | 2026-07-02 | 240 | nein | 1 |
| Stadt Heimbach | 2026-07-02 | 56 | nein | 1 |
| Kreis Heinsberg | 2026-07-07 | 40 | nein | 1 |
| Stadt Hemer | 2026-07-02 | 92 | nein | 1 |
| Stadt Höxter | 2026-07-02 | 180 | nein | 1 |
| Stadt Hürth | 2026-07-07 | 137 | nein | 1 |
| Gemeinde Inden | 2026-07-02 | 99 | nein | 1 |
| Stadt Jülich | 2026-07-02 | 131 | nein | 1 |
| Stadt Lennestadt | 2026-07-15 | 81 | nein | 1 |
| Gemeinde Lippetal | 2026-07-07 | 35 | nein | 1 |
| Stadt Lüdinghausen | 2025-09-30 | 355 | nein | 1 |
| Gemeinde Marienheide | 2026-07-14 | 33 | nein | 1 |
| Stadt Marl | 2025-10-02 | 1051 | nein | 1 |
| Stadt Medebach | 2026-07-16 | 59 | nein | 1 |
| Stadt Menden (Sauerland) | 2026-07-02 | 198 | nein | 1 |
| Gemeinde Niederzier | 2026-07-09 | 66 | nein | 1 |
| Stadt Olpe | 2026-09-01 | 65 | nein | 1 |
| Stadt Remscheid | 2026-07-02 | 978 | ja | 1 |
| Stadt Rheinbach | 2026-07-02 | 160 | nein | 1 |
| Gemeinde Selfkant | 2026-09-15 | 24 | nein | 1 |
| Gemeinde Stemwede | 2026-07-02 | 101 | nein | 1 |
| Stadt Ahaus | 2025-09-29 | 442 | nein | 0 |
| Gemeinde Ascheberg | 2025-09-30 | 222 | nein | 0 |
| Stadt Beckum | 2025-09-30 | 520 | nein | 0 |
| Gemeinde Beelen | 2025-09-29 | 216 | nein | 0 |
| Stadt Datteln | 2025-09-30 | 338 | nein | 0 |
| Stadt Dülmen | 2025-09-30 | 407 | nein | 0 |
| Gemeinde Everswinkel | 2025-10-07 | 203 | nein | 0 |
| Gemeinde Ladbergen | 2025-10-23 | 164 | nein | 0 |
| Stadt Münster | 2025-09-29 | 2450 | nein | 0 |
| Stadt Sassenberg | 2025-10-07 | 408 | nein | 0 |

## Nicht angebunden (keine Quelle konfiguriert) (93)

| Gebiet | Ebene |
|---|---|
| Gemeinde Alfter | Stadt/Gemeinde |
| Stadt Altena | Stadt/Gemeinde |
| Gemeinde Altenberge | Stadt/Gemeinde |
| Stadt Arnsberg | Stadt/Gemeinde |
| Stadt Bad Oeynhausen | Stadt/Gemeinde |
| Stadt Bad Salzuflen | Stadt/Gemeinde |
| Stadt Balve | Stadt/Gemeinde |
| Stadt Barntrup | Stadt/Gemeinde |
| Gemeinde Blankenheim | Stadt/Gemeinde |
| Stadt Borgholzhausen | Stadt/Gemeinde |
| Stadt Breckerfeld | Stadt/Gemeinde |
| Stadt Bünde | Stadt/Gemeinde |
| Gemeinde Dörentrup | Stadt/Gemeinde |
| Gemeinde Engelskirchen | Stadt/Gemeinde |
| Gemeinde Eslohe (Sauerland) | Stadt/Gemeinde |
| Stadt Espelkamp | Stadt/Gemeinde |
| Gemeinde Extertal | Stadt/Gemeinde |
| Stadt Gescher | Stadt/Gemeinde |
| Stadt Greven | Stadt/Gemeinde |
| Stadt Halle (Westf.) | Stadt/Gemeinde |
| Stadt Halver | Stadt/Gemeinde |
| Stadt Harsewinkel | Stadt/Gemeinde |
| Gemeinde Heek | Stadt/Gemeinde |
| Gemeinde Heiden | Stadt/Gemeinde |
| Kreis Herford | Kreis |
| Stadt Herne | Stadt/Gemeinde |
| Kreis Hochsauerlandkreis | Kreis |
| Gemeinde Hopsten | Stadt/Gemeinde |
| Stadt Horstmar | Stadt/Gemeinde |
| Stadt Hörstel | Stadt/Gemeinde |
| Gemeinde Hüllhorst | Stadt/Gemeinde |
| Stadt Ibbenbüren | Stadt/Gemeinde |
| Stadt Iserlohn | Stadt/Gemeinde |
| Stadt Isselburg | Stadt/Gemeinde |
| Gemeinde Kalletal | Stadt/Gemeinde |
| Stadt Kierspe | Stadt/Gemeinde |
| Gemeinde Laer | Stadt/Gemeinde |
| Gemeinde Legden | Stadt/Gemeinde |
| Stadt Lemgo | Stadt/Gemeinde |
| Stadt Lengerich | Stadt/Gemeinde |
| Gemeinde Lienen | Stadt/Gemeinde |
| Gemeinde Lotte | Stadt/Gemeinde |
| Stadt Löhne | Stadt/Gemeinde |
| Stadt Lübbecke | Stadt/Gemeinde |
| Stadt Lünen | Stadt/Gemeinde |
| Stadt Meinerzhagen | Stadt/Gemeinde |
| Gemeinde Metelen | Stadt/Gemeinde |
| Gemeinde Mettingen | Stadt/Gemeinde |
| Stadt Minden | Stadt/Gemeinde |
| Kreis Minden-Lübbecke | Kreis |
| Stadt Monheim am Rhein | Stadt/Gemeinde |
| Gemeinde Morsbach | Stadt/Gemeinde |
| Kreis Märkischer Kreis | Kreis |
| Gemeinde Nachrodt-Wiblingwerde | Stadt/Gemeinde |
| Gemeinde Neuenkirchen | Stadt/Gemeinde |
| Stadt Neuenrade | Stadt/Gemeinde |
| Gemeinde Nordwalde | Stadt/Gemeinde |
| Stadt Oberhausen | Stadt/Gemeinde |
| Stadt Olsberg | Stadt/Gemeinde |
| Stadt Overath | Stadt/Gemeinde |
| Stadt Petershagen | Stadt/Gemeinde |
| Stadt Plettenberg | Stadt/Gemeinde |
| Stadt Porta Westfalica | Stadt/Gemeinde |
| Stadt Preußisch Oldendorf | Stadt/Gemeinde |
| Gemeinde Raesfeld | Stadt/Gemeinde |
| Gemeinde Recke | Stadt/Gemeinde |
| Gemeinde Reken | Stadt/Gemeinde |
| Stadt Rietberg | Stadt/Gemeinde |
| Gemeinde Saerbeck | Stadt/Gemeinde |
| Gemeinde Schalksmühle | Stadt/Gemeinde |
| Gemeinde Schlangen | Stadt/Gemeinde |
| Stadt Schloß Holte-Stukenbrock | Stadt/Gemeinde |
| Gemeinde Schöppingen | Stadt/Gemeinde |
| Stadt Selm | Stadt/Gemeinde |
| Kreis Soest | Kreis |
| Stadt Sprockhövel | Stadt/Gemeinde |
| Stadt Stadtlohn | Stadt/Gemeinde |
| Stadt Steinfurt | Stadt/Gemeinde |
| Stadt Sundern (Sauerland) | Stadt/Gemeinde |
| Stadt Tecklenburg | Stadt/Gemeinde |
| Stadt Velbert | Stadt/Gemeinde |
| Stadt Vreden | Stadt/Gemeinde |
| Stadt Warburg | Stadt/Gemeinde |
| Gemeinde Welver | Stadt/Gemeinde |
| Stadt Werdohl | Stadt/Gemeinde |
| Stadt Wermelskirchen | Stadt/Gemeinde |
| Stadt Werther (Westf.) | Stadt/Gemeinde |
| Stadt Wesel | Stadt/Gemeinde |
| Gemeinde Westerkappeln | Stadt/Gemeinde |
| Stadt Wetter (Ruhr) | Stadt/Gemeinde |
| Gemeinde Wickede (Ruhr) | Stadt/Gemeinde |
| Stadt Winterberg | Stadt/Gemeinde |
| Stadt Wülfrath | Stadt/Gemeinde |
