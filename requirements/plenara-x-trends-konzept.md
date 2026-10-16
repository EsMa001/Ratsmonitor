# plenara.X Trends – Konzept (Entwurf 16.10.2026)

## Wozu
Eine Seite beantwortet zwei Fragen in einem Blick:
1. **Was kommt gerade auf?** (heute Tool „Trends“: Begriffe, die häufiger werden)
2. **Wo zuerst, und wie breitet es sich aus?** (heute Tool „Ausbreitung“: erste Sitzung je Gebiet)

Zielgruppe: Verbände, Unternehmen, Presse, Verwaltung, die früh sehen wollen, welche Themen in den Räten wandern.
Die Seite gehört ins Menü unter plenara.X, neben Atlas, Signale und Fakten.

## Was gezählt wird
- **Einheit:** Sachvorgänge in `x_cases` über `source()`, wie Atlas und Signale. Kein eigenes Datenmodell, nichts vorrechnen, Zwischenspeicher `xCached`.
- **Gegenstand eines Trends**, in zwei Stufen:
  - **Unterthemen** (70, aus den Regeln, gemessen): Standardansicht, stabil und verständlich.
  - **Begriffe** aus der Wortliste (wie das heutige Tool): als Umschalter „Begriffe“, und immer, wenn jemand selbst sucht.
- **Aufsteigend:** Anteil an allen Sachvorgängen im Zeitraum gegen den Zeitraum davor, mit Wilson-Spanne. Es zählt nur, wenn die Spannen sich nicht überschneiden **und** das Thema in mindestens 3 Gebieten vorkommt. So wird ein einzelner großer Rat kein Trend.
- **Neu aufgekommen:** davor in höchstens 1 Gebiet, jetzt in mindestens 3.
- **Ausbreitung:** Gebiete, die das Thema im Zeitraum **zum ersten Mal** beraten haben (`FIRST_DATE`). Das ist die Kennzahl, die beide Tools verbindet.
- **Zeitraum:** dieselben Pillen wie im Atlas (3, 6, 12 Monate), Vergleich jeweils mit dem gleich langen Zeitraum davor.

## Aufbau (wie Atlas und Signale)
- **Kopf:** kompaktes Band, Zeitraum-Pillen, Suche und Ort, „Folgen“.
- **Antwortzeile:** zum Beispiel „Wärmeplanung: 214 Vorgänge in 6 Monaten, ×2,3 gegenüber davor, 61 Gebiete neu dabei“.
- **Kennzahlen:** Aufsteigend · Neu aufgekommen · Gebiete neu erreicht · +N in den letzten 7 Tagen beraten.

### Links, sticky: Karte der Ausbreitung
- **Ohne Auswahl:** Gebiete eingefärbt nach Zahl der aufsteigenden Themen.
- **Mit Thema:** Farbe nach dem Zeitpunkt der ersten Beratung, in drei Wellen (früh, mittel, jüngst; Petrol hell bis dunkel, Grau = noch nie).
- **Ortsschilder** bei den 5 Vorreitern.
- **Zeitregler unter der Karte** (Monate): Ziehen zeigt den Stand der Ausbreitung zu jedem Monat. Kein Abspielen von selbst.
- **Klick wählt den Ort**, wie im Atlas.

### Rechts: Rangliste
- **Reiter:** Aufsteigend · Neu · Absteigend.
- **Je Zeile:** Unterthema mit Icon, Faktor (×2,3), kleine Linie mit Fläche (keine Säulen), „+N Gebiete“.
- 10 Zeilen, dann „Alle zeigen“.

### Rechts, nach Klick: Steckbrief eines Trends
1. **Verlauf je Monat:** Anteil als Linie mit Fläche, dazu eine zweite Linie mit den Gebieten kumuliert („erreicht“).
2. **Vorreiter:** die ersten 5 Gebiete mit Datum, verlinkt zum ersten Vorgang.
3. **Jüngst dazugekommen:** die letzten 5 Gebiete.
4. **Mit Ort:** Wann kam das Thema hier an? Ein Satz wie „Münster: seit März 2026, 8 Monate nach dem ersten Gebiet, früher als 70 % der Vergleichsgruppe“ (Vergleichsgruppe aus `peer-norms`).
5. **Querverweise:** „Im Atlas ansehen“, und bei passender Kategorie „Signale“.
6. **Neueste Vorgänge:** 5 Einträge, mit Zurück-Schritt.

### Mit Ort ohne Thema
Die Rangliste zeigt dann:
- **„Hier früh dran“:** Themen, die der Ort vor den meisten anderen beraten hat.
- **„Kommt vermutlich“:** Themen, die in vielen Nachbarn und in der Vergleichsgruppe laufen, aber hier noch nicht.

Das ist der eigentliche Mehrwert gegenüber beiden Tools. Es wird klar als „bisher nicht beraten“ beschriftet, nicht als Prognose.

## Technik
- **`GET /api/x?view=trends`**, mit Parametern wie Atlas (Suche, Ort, `zeit`, `thema`/`sub`, `unit=sub|term`). Liefert:
  - Rangliste mit Monatsreihen;
  - erste Sitzung je Gebiet für die Auswahl;
  - Gesamtzahlen für den Nenner.
- **Listen** über `list=1&by=…` wie im Atlas.
- **Begriffe:** derselbe Weg wie heute `/api/analytics/trends`, aber gezählt in `x_cases`.
- **Wiederverwendung:**
  - `RegionMap`, mit neuer Farbskala „Wellen“ und Zeitregler;
  - `Kennzahlen`, `ZeitPills`, `PlaceChip`, `MeinOrt`, `Folgen`, `SubtopicIcon`, `RadarDrill`, `useSearchHistory` (Zurück-Taste).
- **Neu:**
  - `pages/analytics/XTrendsPage.tsx`;
  - die Route in `ANALYTICS_PATHS` und im Menü;
  - eine Wellenfärbung in `countScale`;
  - `plenara-x-trends.mjs` auf der Serverseite.
- **Messen vor der Freigabe:** Stichprobe von 50 aufsteigenden Unterthemen, jeweils mit der Frage „ist das wirklich häufiger, oder kommt das von der Einordnung oder vom Import?“. Gezeigt wird der Trend erst ab 80 % Trefferquote. Eine typische Falle sind neue Gebiete im Bestand: Deshalb zählen nur Gebiete, die in beiden Zeiträumen Sitzungen haben.

## Was mit den alten Tools passiert
- **Ausbreitung:** geht ganz in der neuen Seite auf. Die alte Adresse leitet auf `?q=…` weiter.
- **Trends (Begriffe):** wird zum Umschalter „Begriffe“ in der neuen Seite. Das Tool kommt aus der Tool-Liste, die Adresse leitet weiter.

## Stufen
1. Server `view=trends` mit Unterthemen, Rangliste, Antwortzeile und Kennzahlen; Menüeintrag.
2. Karte mit Wellen, Steckbrief und Vorreitern.
3. Zeitregler, Begriffe-Umschalter, Weiterleitungen der alten Tools.
4. Ort-Ansicht „Hier früh dran“ und „Kommt vermutlich“, danach Messung und Freigabe.

## Offene Fragen
- Name im Menü „Trends“, Adresse `/analytics/trends` übernehmen (altes Tool wird ersetzt)?
- Standard Unterthemen, oder Begriffe gleich gleichwertig?
- „Kommt vermutlich“ zeigen oder lieber erst intern messen?

## Überarbeitung 16.10.2026: fusionieren, nichts kaputt machen

Entscheidung: Die Seite heißt „Trends“ und übernimmt `/analytics/trends`.

**Grundsatz:** Beide Tools bleiben in ihrer Rechnung unverändert. Die neue Seite ist ein Weg durch beide, keine neue Rechnung.

**Ablauf auf der Seite:**
1. **Entdecken.** Das ist das heutige Trends-Tool:
   - Begriffe mit den Reitern Aufsteigend, Neu aufgekommen und Absteigend;
   - Faktor, Spark und Trendkarte (Begriffe nach Häufigkeit und Veränderung);
   - Zeitraum 30, 90 oder 180 Tage.
2. **Klick auf einen Begriff.** Darunter, auf derselben Seite, erscheint die heutige Ausbreitung dieses Begriffs:
   - Karte mit Zeitraffer;
   - Kurve der erreichten Gebiete;
   - Kennzahlen „Hälfte im Bestand“ und „Von 10 % auf 90 %“;
   - Bundesländer und erste neue Gebiete.

   Es gibt kein zweites Tippen und keinen Start-Knopf. Zurück führt wieder zur Liste.
3. **Selbst suchen.** Ein eigener Begriff in der Suche zeigt dessen Trendwerte und gleich seine Ausbreitung.

**Themen** werden nicht zur Zähleinheit, sondern zum Filter: Die Pillen der 10 Themen schränken die Begriffsliste ein. So bleiben die Begriffe der Kern (Antwort auf Frage 2).

**Was UX-seitig neu ist:**
- Kopf, Antwortzeile und Kennzahlen wie im Atlas und in den Signalen.
- Karte links sticky:
  - ohne Auswahl die Trendkarte;
  - mit Begriff die Ausbreitung.
- Rechts die Liste und der Steckbrief.
- Ort wählbar, dazu „Folgen“ und die Zurück-Taste je Schritt.
- In der Ausbreitungskurve werden die Säulen „neu je Monat“ durch eine Linie mit Fläche ersetzt.

**Alte Tools als Sicherung (dauerhaft):** Beide bleiben unverändert unter Tools.
- Sie heißen „Alt: Trends“ (`/analytics/trends-alt`) und „Alt: Ausbreitung“ (`/analytics/diffusion-alt`).
- Die bisherige Adresse `/analytics/diffusion` leitet auf die neue Seite.
- Gemeinsamer Code wird nicht verändert. Was die neue Seite anders braucht, bekommt eigene Bausteine.
- Abnahme: Die neue Seite zeigt für 10 Beispielbegriffe dieselben Zahlen wie die alten Tools.

**„Kommt vermutlich“** (Ort gewählt: Themen, die bei Nachbarn laufen, hier noch nicht) ist zurückgestellt und erst ein späterer Schritt.

## Überarbeitung 2: echte Fusion

1. **Jede Zeile der Liste zeigt beides:**
   - Begriff;
   - Faktor im Zeitraum (×2,3);
   - „+N Gebiete“, also die Gebiete mit dem ersten Eintrag im Zeitraum;
   - eine kleine Ausbreitungskurve (erreichte Gebiete, Linie mit Fläche).

   Sortieren lässt sich nach: Aufsteigend, Neu aufgekommen, **Breitet sich am schnellsten aus** (meiste neue Gebiete im Verhältnis zu den bisher erreichten), Absteigend.
2. **Ein Zeitbegriff, klar beschriftet:**
   - Der Zeitraum (30, 90 oder 180 Tage) gilt für Faktor und „+N Gebiete“.
   - Die Ausbreitungskurve im Steckbrief zeigt die ganze Geschichte. Sie ist beschriftet mit „seit dem ersten Eintrag (Datum)“, und der gewählte Zeitraum ist darin hinterlegt.
3. **Die Karte zeigt immer Ausbreitung:**
   - Ohne Auswahl: neu erreichte Gebiete im Zeitraum über alle aufsteigenden Begriffe.
   - Mit Begriff: Zeitpunkt des ersten Eintrags je Gebiet, mit Zeitraffer.
   - Die Trendkarte (Begriffe nach Häufigkeit und Veränderung) wird ein Reiter „Übersicht“ neben „Liste“ auf der rechten Seite.
4. **Themen-Pillen sichtbar oben,** gegen das Rauschen der Begriffe.

**Stufen:**
1. Alte Tools auf `-alt` sichern; neue Seite mit Liste (Faktor und +N Gebiete), Sortierungen und Menüeintrag.
2. Steckbrief mit der vollen Ausbreitung (Zeitraffer, Kurve, Kennzahlen, Bundesländer) und Karte links.
3. Reiter „Übersicht“ (Trendkarte), Ort, Folgen, Zurück-Taste, Abnahme gegen die alten Tools.

## UX-Prüfung (16.10.2026) und Änderungen

1. **Sofort etwas sehen.** Die Seite rechnet beim Öffnen selbst, ohne Start-Knopf (wie heute Trends ohne Begriff). Erst kommt die Liste, Kurven und „+N“ laden danach Zeile für Zeile nach. Platzhalter haben die feste Zeilenhöhe, damit nichts springt.
2. **Weniger Bedienelemente.** Bisher waren es Zeitraum, Themen-Pillen, 4 Sortierungen und 2 Reiter. Neu:
   - nur 3 Sortierungen: **Aufsteigend · Breitet sich aus · Absteigend**;
   - „Neu aufgekommen“ wird ein Etikett „neu“ in der Zeile, kein eigener Reiter;
   - die Übersicht (Trendkarte) wird ein kleiner Umschalter-Knopf über der Liste, kein gleichrangiger Reiter.
3. **Zeile lesbar halten.**
   - Desktop: Begriff · Faktor · +N Gebiete · Mini-Kurve.
   - Handy: Begriff und **die eine Zahl der gewählten Sortierung**, Kurve ausgeblendet.

   Einmal oben ein Satz zur Erklärung: „×2,3 = Anteil im Zeitraum gegenüber davor · +34 = Gebiete erstmals dabei“.
4. **Die Karte ist ohne Auswahl sofort verständlich.**
   - Grundzustand: „Wo sich gerade viel bewegt“ (aufsteigende Begriffe je Gebiet, mit Erklärsatz).
   - Hover über eine Zeile (am Handy: Antippen) zeigt **als Vorschau** die Ausbreitung dieses Begriffs. Das Wegbewegen stellt den Grundzustand wieder her.

   Das ist der „Wow“-Moment: Man fährt über die Liste und sieht die Karte sich jeweils füllen.
5. **Steckbrief wie im Atlas.**
   - Ein Klick ersetzt rechts die Liste durch den Steckbrief, mit „← Alle Trends“; die Karte links bleibt.
   - Reihenfolge im Steckbrief:
     1. Antwortsatz („Wärmeplanung: ×2,3, 34 Gebiete neu, seit 2021 in 410 Gebieten“).
     2. Ausbreitungskurve mit Zeitraffer.
     3. Kennzahlen (Hälfte im Bestand, 10 → 90 %).
     4. Bundesländer.
     5. Erste und jüngste Gebiete.
     6. Neueste Vorgänge.
6. **Zeitraffer:** Er startet nie von selbst, nur per Knopf. Beim Abspielen hält er die Liste ruhig.
7. **Ort gewählt:** Die Liste zeigt die Trends im eigenen Ort. Die Karte bleibt deutschlandweit, und der Ort ist markiert.

   Dazu ein Satz im Steckbrief: „Hier seit März 2026, Gebiet Nr. 112 von 410.“
8. **URL und Zurück:** Adressen nach dem Muster `?q=` `&sort=` `&zeit=` `&thema=`, sodass sich jeder Stand teilen lässt. Jeder Klick auf einen Begriff ist ein Verlaufsschritt.
9. **Barrierefreiheit:**
   - Liste mit Tastatur bedienbar; Fokus entspricht der Hover-Vorschau.
   - Kurven mit Textalternative.
   - Farben der Karte auch als Legende mit Zahlen.
10. **Ehrlichkeit:** Ein Begriff erscheint unter „Breitet sich aus“ erst ab 3 neuen Gebieten. Unter der Liste steht ein Satz, dass neu angebundene Gebiete nicht mitzählen (nur Gebiete mit Sitzungen in beiden Zeiträumen).

**Risiko:** Für 10 bis 50 Zeilen „+N“ und die Kurven zu rechnen, kostet Zeit. Deshalb gibt es eine Abfrage für alle Zeilen zusammen (erste Sitzung je Begriff und Gebiet in `x_cases`), messen in Stufe 1. Wird es zu langsam, zeigen die Zeilen nur „+N“ und erst der Steckbrief die Kurve.
