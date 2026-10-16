# Anwenderseiten: Ziel 10 von 10 (Konzept 16.10.2026, Entwurf)

## Heute: 7 von 10 (im Browser geprüft, Desktop und Handy)

5 Seiten im Menü „Anwender“: `/anwender/immobilien`, `versorgung`, `planung`, `verbaende`, `oeffentlichkeit` (`info/content.ts`, `info/BranchenPages.tsx`, `info/BranchenLive.tsx`, `info/anwender-beispiele.ts`). Kompakt, mobil sauber, echter Vorgang im Kopf. Es fehlt: Aktualität (feste Beispiele und Schnappschüsse, Stand 08.10.), Bezug zum eigenen Gebiet, ein Beleg für den Zeitvorsprung, ein Abschluss mit nächstem Schritt (`closing` wird nicht angezeigt).

## Was eine 10 ausmacht

Ein Besucher aus der Branche denkt nach 10 Sekunden: „Das betrifft mich, hier in meiner Gegend, und ich hätte es sonst zu spät erfahren.“ Nach 30 Sekunden hat er einen Alarm angelegt oder ein Konto begonnen.

## Aufbau

1. **Kopf: meine Gegend, jetzt.** Titel und ein Satz wie heute. Darunter zwei Felder: Begriff (vorbelegt) und Ort/Kreis (leer = ganz Deutschland, gemerkt im Browser wie „Mein Ort“). Daneben live: Zahl der Vorgänge der letzten 30 Tage und der neueste Vorgang mit Ort, Gremium, Sitzungsdatum, Stand und Quelle. Chips „Auch im Blick“ wechseln den Begriff, ebenfalls live. Quelle: normale Suche, öffentlich wie für Gäste.
2. **Beleg für den Vorsprung (das Herzstück).** Ein echter Vorgang der Branche als Zeitstrahl, von der ersten Erwähnung im Gremium bis zum Ergebnis, mit Datum je Schritt und der Zeile „X Monate zwischen erster Beratung und Beschluss“. Ersetzt den abstrakten Ablauf. Daten: Sitzungen des Vorgangs (wie im Artikel). Auswahl: fester, von Hand gewählter Vorgang je Seite (`href`), Daten live gelesen; so bleibt das Beispiel gut und trotzdem echt.
3. **Wer es nutzt.** Die 3 Rollen wie heute, aber je Rolle nur Name, ein Satz und ein Suchlink (heute 2 bis 3 Absätze).
4. **plenara.X für die Branche.** Eine Kachel mit Link in die echte Auswertung (Signal, Atlas-Auswahl oder Trends zum Begriff), keine Schnappschüsse, kein Einblenden. Nur Auswertungen über dem Qualitätstor.
5. **Abschluss mit nächstem Schritt.** `closing` groß, darunter der Hauptknopf „Alarm für ‚<Begriff>‘ anlegen“ (mit Begriff und Ort aus dem Kopf, führt zur Anmeldung, danach ist der Alarm gespeichert), daneben „Preise ansehen“. Slogan darunter.

## Qualität

- **Tempo:** Gerüst und Texte kommen sofort im HTML (Server), Live-Teile laden danach in Platzhaltern gleicher Größe; nichts springt. Ziel: Kopf sichtbar unter 1 s, Live-Daten unter 2 s.
- **Ehrlich:** jede Zahl mit Stand, jeder Vorgang verlinkt mit Originalquelle; leere Ergebnisse sagen das offen („In den letzten 30 Tagen nichts in <Ort>, ganz Deutschland: N“).
- **Teilen und Suche:** eigener Titel und Beschreibung je Seite für Vorschauen und Suchmaschinen (wie bei `/beschluss/[id]`).
- **Handy:** Felder volle Breite, Zeitstrahl senkrecht, Hauptknopf gut erreichbar.
- **Texte:** nur belegbare Aussagen aus `docs/produkt/vorteile.json` (Stufe A im Kopf und Abschluss).

## Weg fällt

`info/anwender-beispiele.ts` (feste Beispiele), `public/data/branchen-ausschnitte.json` und `scripts/build-branchen-ausschnitte.mjs` (Schnappschüsse), der abstrakte Ablauf-Zeitstrahl.

## Grenzen

Kein neues Datenmodell, keine neue API: Suche, Artikel-Daten und plenara.X wie sie sind. Ob „Alarm nach der Anmeldung speichern“ ohne Backend-Änderung geht, vor der Umsetzung prüfen; sonst führt der Knopf in die Suche mit Begriff und Ort, wo der Alarm einen Klick entfernt ist.

## Prüfen vor der Umsetzung

- Je Seite die Live-Treffer der Begriffe ansehen (passen die neuesten Vorgänge?), sonst Begriffe schärfen.
- Je Seite einen guten Vorgang für den Zeitstrahl wählen (mehrere Sitzungen, Ergebnis, langer Vorlauf).
