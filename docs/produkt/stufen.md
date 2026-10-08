# Funktionsumfang je Stufe (Vorschlag)

Stand: 08.10.2026. Die Werte stammen aus `components/ratsmonitor/lib/tier.ts` (Stufenrechte) und sollen dort und hier gleich bleiben. Wenn sich eine Zahl im Code ändert, dieses Dokument mit ändern.

Zuordnung zu den Preisen aus der Todo-Liste (Vorschlag): Basic = Einfach (9,99 €), Pro = mehr Funktionen (49,99 €), Enterprise = Stufe für Plenara.X-Auswertungen. Preise können später steigen.

| Funktion | Gast | Basic | Pro | Enterprise |
|---|---|---|---|---|
| Treffer je Suche | 10 | unbegrenzt | unbegrenzt | unbegrenzt |
| Filter | nein | ja | ja | ja |
| Gemerkte Artikel | 0 | 1 | 100 | 100 |
| Gespeicherte Suchen | 0 | 1 | 100 | 100 |
| Benachrichtigungen (aktiv) | 0 | 1 | 100 | 100 |
| E-Mail-Benachrichtigungen | 0 | 1 | 1 | 5 |
| Kalender | nein | nein | nein | ja |

Hinweise:

- „100“ ist die interne Obergrenze (`PLAN_MAX`) für Pro und Enterprise, faktisch praktisch unbegrenzt.
- Gast ist die Stufe ohne Konto. Die Grenzen für Gäste zeigen den Hinweis zum Registrieren.
- Plenara.X (tiefere Analysen) ist in diesem Dokument nicht als eigene Spalte geführt. Die Freischaltung dafür steht noch offen.
- Die Grenzen gelten serverseitig nur, soweit das Backend sie prüft. Offen: Tarifrechte serverseitig durchsetzen (Todo `be-tarifrechte`).
