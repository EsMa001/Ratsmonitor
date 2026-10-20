# Produktvorteile von Plenara (nach Relevanz)

Erzeugt aus `vorteile.json` (`node docs/videos/tools/vorteile.mjs --md`), nicht von Hand ändern. Stand 2026-10-16.

Zentrale Liste der Produktvorteile von Plenara und Plenara.X (108 Einträge), nach Relevanz sortiert (rang 1 = wichtigster, Vorschlag, gerne ändern). Nur belegbare Aussagen, keine Superlative und keine Vergleiche mit anderen Anbietern. pruefen=true: aus der App abgeleitet, vor Verwendung bestätigen. Texte, Videos und Marketing sollen sich an dieser Liste ausrichten.

- **Stufe A:** Rang 1 bis 7: in 10 Sekunden verständlich, gehört in Einleitungen, Einblendungen und Werbung
- **Stufe B:** Rang 8 bis 22: die tieferen Gründe, tragen Kapitel und Zielgruppenvideos
- **Stufe C:** Rang 23 bis 56: Details für Anleitungen und Kurzclips, nicht für Werbung
- **Stufe D:** Rang 57 bis 107: Details und Belege, für Anleitungen, Einblendungen und Kurzclips, nicht für Werbung

| Rang | Stufe | Vorteil | Beleg |
|---|---|---|---|
| 1 | A | Ein Portal statt vieler Systeme | über 6.000 Gemeinden, mehr als 900.000 Einträge (docs/videos/facts.json) |
| 2 | A | Früher erfahren, was beraten wird | Beschlüsse stehen vor der Presse in den Ratsinformationssystemen; Zeitraffer der Analyse Ausbreitung |
| 3 | A | Alarme per E-Mail statt tägliches Suchen | Glocke bei gespeicherten Suchen, E-Mail bei neuen Treffern |
| 4 | A | Ganz Deutschland mit einem Begriff | Suche ohne Ortswahl |
| 5 | A | Jede Angabe mit Originalquelle | Link zur Quelle im Artikel |
| 6 | A | Stand jedes Vorgangs auf einen Blick | Zeitstrahl in der Trefferliste |
| 7 | A | Sofort sehen, wo etwas passiert | Karte mit Flächen, Heatmap, Punkten |
| 8 | B | Sehen, wie sich ein Thema ausbreitet | plenara.X Trends, Ausbreitung eines Begriffs |
| 9 | B | Neues früh erkennen | plenara.X Trends |
| 10 | B | Wochenbericht täglich oder am Wunschtag | Schalter und Rhythmus bei den gespeicherten Suchen |
| 11 | B | Keine Sitzung verpassen | Kalender mit Abonnieren |
| 12 | B | Gezielt eingrenzen | Filter: Zeitraum, Thema, Status |
| 13 | B | Orte vergleichen | plenara.X Atlas, Reiter Vergleich: zwei Orte nebeneinander |
| 14 | B | Beschlüsse einordnen | plenara.X Trends, Reiter Beschlusslage: Quote, Vertagungen, Dauer |
| 15 | B | Den Weg durch die Gremien verstehen | plenara.X Gremien |
| 16 | B | Zusammenhänge entdecken | plenara.X Themennetz |
| 17 | B | Artikel sauber drucken | Druckansicht im Browser ohne Bedienelemente |
| 18 | B | Die Suche kostenlos nutzen | Vom Nutzer bestätigt: Suche von Plenara kostenlos mit begrenztem Funktionsumfang; Plenara.X ist nicht kostenlos |
| 19 | B | Grenzen und Abdeckung offen benannt | Datenabdeckung, Hinweise zu Grenzen bei jeder Analyse |
| 20 | B | Sehen, wie viel wo beraten wird ⚠ | plenara.X Atlas: 10 Themen mit Unterthemen, je Ort und Monat, mit Suchbegriff |
| 21 | B | Vorhaben einzeln verfolgen ⚠ | plenara.X Signale: Vorhaben je Branche mit Ort, Schritt und Quelle |
| 22 | B | Werte aus den Vorlagen vergleichen ⚠ | plenara.X Fakten: Hebesätze und Gebühren je Gemeinde auf der Karte, mit Quelle |
| 23 | C | Aktualität sichtbar | Datenstand mit Datum und Uhrzeit über der Trefferliste |
| 24 | C | Ort direkt erkannt | „Ort erkannt“ in der Suchleiste |
| 25 | C | Exakter Begriff | nur ganze Wörter (Filter) |
| 26 | C | Mehrere Begriffe, wahlweise alle oder einer | Marken, „Begriffe kombinieren“ |
| 27 | C | Häufungen sehen | Heatmap |
| 28 | C | Trefferzahl je Gebiet | Zahlen an den Gebieten der Karte |
| 29 | C | Klick auf ein Gebiet zeigt dessen Beschlüsse | Karte |
| 30 | C | Sortieren nach Datum oder Relevanz | Trefferliste |
| 31 | C | Kompakte oder ausführliche Ansicht | Trefferliste |
| 32 | C | Artikel mit allen Unterlagen und Verlauf | Artikelseite |
| 33 | C | Wichtiges merken | gespeicherte Artikel (Lesezeichen) |
| 34 | C | Suchen speichern | Herz in der Suchleiste |
| 35 | C | Benachrichtigung je Artikel | Glocke im Artikel |
| 36 | C | Artikel teilen | Teilen-Symbol im Artikel |
| 37 | C | Auch am Handy | Oberfläche für Handy angepasst (Layout unter 768 px, eigene Handy-Videos, Handy-Vorschau public/handy.html); geprüft im Code |
| 38 | C | Künftige Sitzungen und Formalien selbst steuern | Schalter im Filter |
| 39 | C | Statusfilter | Angekündigt, In Beratung, Beschlossen u. a. |
| 40 | C | Themenfilter mit Themenfeldern | Filter „Alle Themen“; Zuordnung nach Titelregeln (shared/labels.mjs, title-rules-v2): jeder Eintrag bekommt anhand von Schlüsselwörtern im amtlichen Titel ein Themenfeld; nicht erkennbare bleiben ohne Feld |
| 41 | C | Beispiel-Meldungen im Test-Postfach | zeigt, wie Nachrichten aussehen |
| 42 | C | Kurzfassung zu jedem Eintrag | Kurzfassung unter dem Titel; Stand heute nur, wo ein Dokumenttext vorliegt (KI, ai-summary.mjs), vom Nutzer als künftig für jeden Eintrag geplant bestätigt; in Texten „Kurzfassung“ nennen, nicht „KI“ |
| 43 | C | Suchvorschläge beim Tippen | Vorschlagsliste unter der Suchleiste: Orte und Regionen ab 3 Buchstaben sowie „Zuletzt gesucht“; keine Vorschläge für Fachbegriffe |
| 44 | C | Samtgemeinden richtig berücksichtigt | zählen bei jeder Mitgliedsgemeinde |
| 45 | C | Abdeckung nach Bundesland | Datenabdeckung |
| 46 | C | „Ist Ihr Ort dabei?“ | Ortsabfrage auf der Datenabdeckung |
| 47 | C | Fehlende Kommune melden | Kontaktweg auf der Datenabdeckung |
| 48 | C | Vorreiter-Gebiete sehen | plenara.X Trends, Ausbreitung: früheste Gebiete |
| 49 | C | Verlaufskurven je Begriff | plenara.X Trends, Rangliste |
| 50 | C | Themenprofil im Vergleich | plenara.X Atlas, Vergleich |
| 51 | C | Alle Gebiete als Maßstab | Ortsvergleich gegen den Gesamtbestand |
| 52 | C | Analysen immer frisch berechnet | „bei der Abfrage frisch aus der Datenbank“ (Über Plenara.X) |
| 53 | C | Berichtenswertes mit Zitat und Quelle ⚠ | plenara.X Aktuelles: je Vorgang eine Meldung mit wörtlichem Zitat |
| 54 | C | Fraktionen und ihre Anträge ⚠ | plenara.X Fraktionen: welche Fraktion welche Themen beantragt und was daraus wird |
| 55 | C | Orte, die ein Thema zum ersten Mal beraten ⚠ | plenara.X Signale, „Erstmals hier“ |
| 56 | C | Ein Ort im Vergleich mit ähnlichen Gemeinden ⚠ | plenara.X Atlas: Vergleichsgruppe nach Art, Größe und Land |
| 57 | D | Schnelle Suche über den ganzen Bestand | Vorberechnete Wortliste (search-words.mjs): „keine Treffer“ sofort, Zähler und Karte häufiger Wörter aus vorberechneten Zahlen; Ergebnis identisch mit der vollen Suche (getestet) |
| 58 | D | 227 von 294 Kreisen abgedeckt | Datenabdeckung (docs/videos/facts.json, cov) |
| 59 | D | Daten aus 14 Bundesländern | Datenabdeckung |
| 60 | D | Verschiedene Ratsinformationssysteme einheitlich dargestellt | Vom Nutzer bestätigt: stimmt inhaltlich, Formulierung frei (Anbindung mehrerer Systeme) |
| 61 | D | Einheitliche Statusbezeichnungen | Angekündigt, In Beratung, Beschlossen u. a. |
| 62 | D | Einheitliche Themenfelder | Feste Liste von Themenfeldern (LABELS in shared/labels.mjs), für alle Gebiete gleich per Titelregeln vergeben; nicht alle Einträge sind eingeordnet |
| 63 | D | Gremien nach Art erkennbar | Gremienart wird per Namensmuster aus dem Gremiennamen abgeleitet (analytics-network.mjs, gremiumType); nicht erkennbare = „Sonstige“; die Grenze nennen |
| 64 | D | Letzter Abruf der Daten sichtbar | Datenabdeckung |
| 65 | D | „Hinter den Kulissen“: Abdeckung offen erklärt | Datenabdeckung |
| 66 | D | Fragen und Anregungen jederzeit an das Team | Kontakt am Seitenende |
| 67 | D | Treffer im Text hervorgehoben | gelbe Markierung in der Liste |
| 68 | D | Sitzungsdatum und Gremium in jeder Zeile | Trefferliste |
| 69 | D | Kartendarstellung wechseln, ohne neu zu suchen | Karte |
| 70 | D | Zoomen, Zentrieren, Neu laden an der Karte | Kartenknöpfe |
| 71 | D | Beispielthemen zum Anklicken | Chips unter der Suche |
| 72 | D | Marken unter der Suchleiste, ein Klick entfernt den Filter | Suchleiste |
| 73 | D | Trefferzahl und Stand über der Liste | Trefferliste |
| 74 | D | Ort und Thema zugleich | Suche |
| 75 | D | Mail bei einem Beschluss | Test-Postfach |
| 76 | D | Mail bei einer Sitzung heute | Test-Postfach |
| 77 | D | Mehrere Suchen gleichzeitig überwachen | gespeicherte Suchen |
| 78 | D | Mehrere Regionen und Themen im Blick | Vorstellungsvideo Unternehmen und Verbände |
| 79 | D | Test-Postfach ohne Risiko | Beispiel-Benachrichtigungen |
| 80 | D | Kalender für mehrere Gebiete zugleich | Meine Gebiete |
| 81 | D | Im Kalender: Klick auf einen Tag zeigt Gremium und Themen | Kalender |
| 82 | D | Gespeichertes bleibt im Konto erhalten | Konto |
| 83 | D | Anzahl gespeicherter Suchen und Artikel in der Kopfzeile | Kopfzeile |
| 84 | D | Profil mit Name und E-Mail | Konto |
| 85 | D | Ausbreitung: „Hälfte erreicht“ als Kennzahl | plenara.X Trends, Ausbreitung |
| 86 | D | Ausbreitung: Dauer von 10 auf 90 Prozent der Gebiete | plenara.X Trends, Ausbreitung |
| 87 | D | Ausbreitung: Verlauf als Diagramm, Klick setzt die Karte auf das Datum ⚠ | plenara.X Trends, Ausbreitung |
| 88 | D | Ausbreitung: Bundesländer im Vergleich | plenara.X Trends, Ausbreitung |
| 89 | D | Alle Analysen mit denselben Suchen und Filtern wie die Startseite | Über Plenara.X |
| 90 | D | Trends: Zeitraum wählbar (30, 90, 180 Tage) | plenara.X Trends |
| 91 | D | Trends: Veränderung je Themenfeld | plenara.X Trends |
| 92 | D | Trends: Trendkarte | plenara.X Trends |
| 93 | D | Beschlusslage: Vertagungen und Ablehnungen sichtbar | plenara.X Trends, Reiter Beschlusslage |
| 94 | D | Beschlusslage: Anteil einstimmiger Entscheidungen | plenara.X Trends, Reiter Beschlusslage |
| 95 | D | Beschlusslage: Wie oft Vorlagen geändert werden | plenara.X Trends, Reiter Beschlusslage |
| 96 | D | Beschlusslage: Durchlaufzeit bis zum Beschluss | plenara.X Trends, Reiter Beschlusslage |
| 97 | D | Vergleich: typische und gemeinsame Begriffe | plenara.X Atlas, Vergleich |
| 98 | D | Vergleich: Einträge je Einwohner (nur als Anhaltspunkt) | plenara.X Atlas, Vergleich; Grenze ausdrücklich nennen |
| 99 | D | Themennetz: Knoten anklicken zeigt Details | plenara.X Themennetz |
| 100 | D | Themennetz: Länder und Gremien als Knoten ⚠ | plenara.X Themennetz |
| 101 | D | Gremien: Dauer eines Übergangs | plenara.X Gremien |
| 102 | D | Gremien: Gremienarten als Knoten | plenara.X Gremien |
| 103 | D | Zu jeder Analyse der wissenschaftliche Hintergrund | Über Plenara.X |
| 104 | D | Zu jeder Analyse die Grenzen in Klartext | Über Plenara.X |
| 105 | D | Fakten: übliche Spanne und Median je Wert ⚠ | plenara.X Fakten |
| 106 | D | Atlas: Anteil an allen Sachvorgängen eines Orts ⚠ | plenara.X Atlas |
| 107 | D | Hinter jeder Zahl die Liste der Vorgänge ⚠ | plenara.X: Klick auf eine Zahl zeigt die Vorgänge |
