# plenara.X Tools neu ordnen (Konzept 16.10.2026, nicht umgesetzt)

## Ziel

Alle Tools bleiben, keines wird gestrichen oder versteckt. Die Sammelseite „Tools“ fällt weg; jedes Tool bekommt einen festen, sichtbaren Platz.

## Menü

**Analysen by plenara.X** (Mengen und Entwicklung)
- Atlas – Wie viel? · neuer Reiter *Vergleich* (bisher Ortsvergleich)
- Signale – Was entsteht? · neuer Reiter *Diese Woche* (bisher Newsradar)
- Trends – Was verändert sich? · neuer Reiter *Ausgang* (bisher Beschlüsse)
- Fakten – Welcher Wert?

**Akteure by plenara.X** (wer beteiligt ist, was zusammenhängt; Name offen: Alternative „Einblicke“)
- Fraktionen – Wer will was? (bisher Fraktionsprofil)
- Gremien – Wer berät was, auf welchem Weg? (bisher Beratungswege)
- Themennetz – Was hängt zusammen? (groß, volle Breite, wie heute)

Darstellung: beide Gruppen mit Logo, oder einmal „by plenara.X“ über beiden Gruppen – im Menü vergleichen.

## Querverweise

- Fraktion irgendwo angeklickt → Fraktionen
- „Wo wird das beraten?“ (Trends, Atlas-Vorgang) → Gremien
- „Zusammenhänge zu diesem Begriff“ (Trends) → Themennetz
- Akteursseiten verlinken zurück auf Atlas und Trends (Ort, Begriff werden mitgegeben)

## Reiter

- Volle Breite, Ort bzw. Begriff der Seite wird übernommen, Adresse merkt den Reiter (wie ?ort=).
- Inhalt = das heutige Tool, Funktion unverändert; nur Kopf und Auswahl an die Seite angepasst.

## Alte Adressen

/analytics/vergleich, /news, /beschluesse, /gremien, /fraktionen, /graph, /tools leiten auf das neue Ziel um.
Alt: Trends und Alt: Ausbreitung raus aus dem Menü, Adressen bleiben vorerst erreichbar; später entfernen.

## Schritte

1. Menü: zwei Gruppen, Akteursseiten als eigene Einträge mit Frage, Tools-Seite weg (Umleitung).
2. Reiter *Vergleich* im Atlas.
3. Reiter *Diese Woche* in Signale.
4. Reiter *Ausgang* in Trends.
5. Querverweise in beide Richtungen.
6. Branchenseiten, Über-Seite, Sperrseite (AnalyticsLocked) und FRONTEND.md nachziehen.

Kein neues Datenmodell; alles läuft weiter über `source()` und `x_cases`.

## Offen

- Gruppenname: „Akteure“ (Favorit) oder „Einblicke“.
- Logo zweimal oder einmal über beiden Gruppen.
