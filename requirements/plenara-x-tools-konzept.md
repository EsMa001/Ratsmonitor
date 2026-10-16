# plenara.X Tools neu ordnen (Konzept 16.10.2026, umgesetzt)

## Ziel

Alle Tools bleiben, keines wird gestrichen oder versteckt. Die Sammelseite „Tools“ ist weg; jedes Tool hat einen festen, sichtbaren Platz.

## Menü

Zwei Gruppen, jede mit grauem Abzeichen „plenara.X“:

**Analysen** (Mengen und Entwicklung)
- Atlas – Wie viel? · Reiter *Überblick · Vergleich* (bisher Ortsvergleich)
- Signale – Was entsteht?
- Trends – Was verändert sich? · Reiter *Verlauf · Ausgang* (bisher Beschlüsse)
- Fakten – Welcher Wert?

**Einblicke** (wer beteiligt ist, was zusammenhängt)
- Fraktionen – Wer will was? (bisher Fraktionsprofil)
- Gremien – Wer berät was? (bisher Beratungswege)
- Themennetz – Was hängt zusammen?
- Aktuelles – Was ist berichtenswert? (bisher Newsradar)

## Seitenkopf

Gemeinsamer Kopf `XKopf` auf jeder Seite: „‹ Zurück“ statt Pfad, Titel mit Abzeichen, Frage, Info-Knopf mit der Methodik der Seite, Reiter wo vorhanden. Querverweise unten als Kacheln („Weiter mit derselben Suche“), Texte zentral aus `SEITEN`.

## Adressen

Die Adressen der Tools bleiben (/analytics/vergleich, /beschluesse, /gremien, /fraktionen, /graph, /news). Übersichts- und Methodikseiten (/analytics, /ueber, /einblicke, /tools, /methodik, /politik, /finanzen) gibt es nicht mehr (404, keine Umleitung). Alt: Trends und Alt: Ausbreitung sind nicht im Menü, ihre Adressen bleiben vorerst erreichbar.

Kein neues Datenmodell; alles läuft weiter über `source()` und `x_cases`.
