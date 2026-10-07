# Produktvorteile von Plenara (nach Relevanz)

Erzeugt aus `vorteile.json` (`node docs/videos/tools/vorteile.mjs --md`), nicht von Hand ändern. Stand 2026-10-07.

Zentrale Liste der Produktvorteile von Plenara und Plenara.X (98 Einträge), nach Relevanz sortiert (rang 1 = wichtigster, Vorschlag, gerne ändern). Nur belegbare Aussagen, keine Superlative und keine Vergleiche mit anderen Anbietern. pruefen=true: aus der App abgeleitet, vor Verwendung bestätigen. Texte, Videos und Marketing sollen sich an dieser Liste ausrichten.

- **Stufe A:** Rang 1 bis 7: in 10 Sekunden verständlich, gehört in Einleitungen, Einblendungen und Werbung
- **Stufe B:** Rang 8 bis 20: die tieferen Gründe, tragen Kapitel und Zielgruppenvideos
- **Stufe C:** Rang 21 bis 50: Details für Anleitungen und Kurzclips, nicht für Werbung
- **Stufe D:** Rang 51 bis 98: Details und Belege, für Anleitungen, Einblendungen und Kurzclips, nicht für Werbung

| Rang | Stufe | Vorteil | Beleg |
|---|---|---|---|
| 1 | A | Ein System statt vieler Systeme | über 6.000 Gemeinden, mehr als 900.000 Einträge (docs/videos/facts.json) |
| 2 | A | Früher erfahren, was beraten wird | Beschlüsse stehen vor der Presse in den Ratsinformationssystemen; Zeitraffer der Diffusionsanalyse |
| 3 | A | Alarme per E-Mail statt tägliches Suchen | Glocke bei gespeicherten Suchen, E-Mail bei neuen Treffern |
| 4 | A | Ganz Deutschland mit einem Begriff | Suche ohne Ortswahl |
| 5 | A | Jede Angabe mit Originalquelle | Link zur Quelle im Artikel |
| 6 | A | Stand jedes Vorgangs auf einen Blick | Zeitstrahl in der Trefferliste |
| 7 | A | Sofort sehen, wo etwas passiert | Karte mit Flächen, Heatmap, Punkten |
| 8 | B | Sehen, wie sich ein Thema ausbreitet | Plenara.X Diffusionsanalyse |
| 9 | B | Neues früh erkennen | Plenara.X Trends und Frühindikatoren |
| 10 | B | Wochenbericht jeden Montag | Schalter bei den gespeicherten Suchen |
| 11 | B | Keine Sitzung verpassen | Kalender mit Abonnieren |
| 12 | B | Gezielt eingrenzen | Filter: Zeitraum, Thema, Status |
| 13 | B | Orte vergleichen | Plenara.X Gebietsvergleich, 2 bis 4 Orte |
| 14 | B | Beschlüsse einordnen | Plenara.X Status und Beschlüsse: Quote, Vertagungen, Dauer |
| 15 | B | Den Weg durch die Gremien verstehen | Plenara.X Gremiennetz |
| 16 | B | Zusammenhänge entdecken | Plenara.X Knowledge Graph |
| 17 | B | Ergebnisse als Excel oder CSV | Export der Trefferliste |
| 18 | B | Artikel als PDF oder zum Drucken | Export im Artikel |
| 19 | B | Die Suche kostenlos nutzen | Vom Nutzer bestätigt: Suche von Plenara kostenlos mit begrenztem Funktionsumfang; Plenara.X ist nicht kostenlos |
| 20 | B | Grenzen und Abdeckung offen benannt | Datenabdeckung, Hinweise zu Grenzen bei jeder Analyse |
| 21 | C | Aktualität sichtbar | Datenstand mit Datum und Uhrzeit über der Trefferliste |
| 22 | C | Ort direkt erkannt | „Ort erkannt“ in der Suchleiste |
| 23 | C | Exakter Begriff | nur ganze Wörter (Filter) |
| 24 | C | Mehrere Begriffe, wahlweise alle oder einer | Marken, „Begriffe kombinieren“ |
| 25 | C | Häufungen sehen | Heatmap |
| 26 | C | Trefferzahl je Gebiet | Zahlen an den Gebieten der Karte |
| 27 | C | Klick auf ein Gebiet zeigt dessen Beschlüsse | Karte |
| 28 | C | Sortieren nach Datum oder Relevanz | Trefferliste |
| 29 | C | Kompakte oder ausführliche Ansicht | Trefferliste |
| 30 | C | Artikel mit allen Unterlagen und Verlauf | Artikelseite |
| 31 | C | Wichtiges merken | gespeicherte Artikel (Lesezeichen) |
| 32 | C | Suchen speichern | Herz in der Suchleiste |
| 33 | C | Benachrichtigung je Artikel | Glocke im Artikel |
| 34 | C | Artikel teilen | Teilen-Symbol im Artikel |
| 35 | C | Auch am Handy | Oberfläche für Handy angepasst (Layout unter 768 px, eigene Handy-Videos, Handy-Vorschau public/handy.html); geprüft im Code |
| 36 | C | Künftige Sitzungen und Formalien selbst steuern | Schalter im Filter |
| 37 | C | Statusfilter | Angekündigt, In Beratung, Beschlossen u. a. |
| 38 | C | Themenfilter mit Themenfeldern | Filter „Alle Themen“; Zuordnung nach Titelregeln (shared/labels.mjs, title-rules-v2): jeder Eintrag bekommt anhand von Schlüsselwörtern im amtlichen Titel ein Themenfeld; nicht erkennbare bleiben ohne Feld |
| 39 | C | Beispiel-Meldungen im Test-Postfach | zeigt, wie Nachrichten aussehen |
| 40 | C | Kurzfassung zu jedem Eintrag | Kurzfassung unter dem Titel; Stand heute nur, wo ein Dokumenttext vorliegt (KI, ai-summary.mjs), vom Nutzer als künftig für jeden Eintrag geplant bestätigt; in Texten „Kurzfassung“ nennen, nicht „KI“ |
| 41 | C | Suchvorschläge beim Tippen | Vorschlagsliste unter der Suchleiste: Orte und Regionen ab 3 Buchstaben sowie „Zuletzt gesucht“; keine Vorschläge für Fachbegriffe |
| 42 | C | Samtgemeinden richtig berücksichtigt | zählen bei jeder Mitgliedsgemeinde |
| 43 | C | Abdeckung nach Bundesland | Datenabdeckung |
| 44 | C | „Ist Ihr Ort dabei?“ | Ortsabfrage auf der Datenabdeckung |
| 45 | C | Fehlende Kommune melden | Kontaktweg auf der Datenabdeckung |
| 46 | C | Vorreiter-Gebiete sehen | Liste der frühesten Gebiete in der Diffusionsanalyse |
| 47 | C | Verlaufskurven je Begriff | Trends, Rangliste |
| 48 | C | Themenprofil im Vergleich | Gebietsvergleich |
| 49 | C | Alle Gebiete als Maßstab | Gebietsvergleich gegen den Gesamtbestand |
| 50 | C | Analysen immer frisch berechnet | „bei der Abfrage frisch aus der Datenbank“ (Über Plenara.X) |
| 51 | D | Schnelle Suche über den ganzen Bestand | Vorberechnete Wortliste (search-words.mjs): „keine Treffer“ sofort, Zähler und Karte häufiger Wörter aus vorberechneten Zahlen; Ergebnis identisch mit der vollen Suche (getestet) |
| 52 | D | 227 von 294 Kreisen abgedeckt | Datenabdeckung (docs/videos/facts.json, cov) |
| 53 | D | Daten aus 14 Bundesländern | Datenabdeckung |
| 54 | D | Verschiedene Ratsinformationssysteme einheitlich dargestellt | Vom Nutzer bestätigt: stimmt inhaltlich, Formulierung frei (Anbindung mehrerer Systeme) |
| 55 | D | Einheitliche Statusbezeichnungen | Angekündigt, In Beratung, Beschlossen u. a. |
| 56 | D | Einheitliche Themenfelder | Feste Liste von Themenfeldern (LABELS in shared/labels.mjs), für alle Gebiete gleich per Titelregeln vergeben; nicht alle Einträge sind eingeordnet |
| 57 | D | Gremien nach Art erkennbar | Gremienart wird per Namensmuster aus dem Gremiennamen abgeleitet (analytics-network.mjs, gremiumType); nicht erkennbare = „Sonstige“; die Grenze nennen |
| 58 | D | Letzter Abruf der Daten sichtbar | Datenabdeckung |
| 59 | D | „Hinter den Kulissen“: Abdeckung offen erklärt | Datenabdeckung |
| 60 | D | Fragen und Anregungen jederzeit an das Team | Kontakt am Seitenende |
| 61 | D | Treffer im Text hervorgehoben | gelbe Markierung in der Liste |
| 62 | D | Sitzungsdatum und Gremium in jeder Zeile | Trefferliste |
| 63 | D | Kartendarstellung wechseln, ohne neu zu suchen | Karte |
| 64 | D | Zoomen, Zentrieren, Neu laden an der Karte | Kartenknöpfe |
| 65 | D | Beispielthemen zum Anklicken | Chips unter der Suche |
| 66 | D | Marken unter der Suchleiste, ein Klick entfernt den Filter | Suchleiste |
| 67 | D | Trefferzahl und Stand über der Liste | Trefferliste |
| 68 | D | Ort und Thema zugleich | Suche |
| 69 | D | Mail bei einem Beschluss | Test-Postfach |
| 70 | D | Mail bei einer Sitzung heute | Test-Postfach |
| 71 | D | Mehrere Suchen gleichzeitig überwachen | gespeicherte Suchen |
| 72 | D | Mehrere Regionen und Themen im Blick | Vorstellungsvideo Unternehmen und Verbände |
| 73 | D | Test-Postfach ohne Risiko | Beispiel-Benachrichtigungen |
| 74 | D | Kalender für mehrere Gebiete zugleich | Meine Gebiete |
| 75 | D | Im Kalender: Klick auf einen Tag zeigt Gremium und Themen | Kalender |
| 76 | D | Gespeichertes bleibt im Konto erhalten | Konto |
| 77 | D | Anzahl gespeicherter Suchen und Artikel in der Kopfzeile | Kopfzeile |
| 78 | D | Profil mit Name und E-Mail | Konto |
| 79 | D | Diffusion: „Hälfte erreicht“ als Kennzahl | Diffusionsanalyse |
| 80 | D | Diffusion: Dauer von 10 auf 90 Prozent der Gebiete | Diffusionsanalyse |
| 81 | D | Diffusion: Verlauf als Diagramm, Klick setzt die Karte auf das Datum | Diffusionsanalyse |
| 82 | D | Diffusion: Bundesländer im Vergleich | Diffusionsanalyse |
| 83 | D | Alle Analysen mit denselben Suchen und Filtern wie die Startseite | Über Plenara.X |
| 84 | D | Trends: Zeitraum wählbar (30, 90, 180 Tage) | Trends |
| 85 | D | Trends: Veränderung je Themenfeld | Trends |
| 86 | D | Trends: Trendkarte | Trends |
| 87 | D | Beschlüsse: Vertagungen und Ablehnungen sichtbar | Status und Beschlüsse |
| 88 | D | Beschlüsse: Anteil einstimmiger Entscheidungen | Über Plenara.X |
| 89 | D | Beschlüsse: Wie oft Vorlagen geändert werden | Über Plenara.X |
| 90 | D | Beschlüsse: Durchlaufzeit bis zum Beschluss | Status und Beschlüsse |
| 91 | D | Vergleich: typische und gemeinsame Begriffe | Gebietsvergleich |
| 92 | D | Vergleich: Einträge je Einwohner (nur als Anhaltspunkt) | Gebietsvergleich, Grenze ausdrücklich nennen |
| 93 | D | Graph: Knoten anklicken zeigt Details | Knowledge Graph |
| 94 | D | Graph: Länder und Gremien als Knoten | Knowledge Graph |
| 95 | D | Gremiennetz: Dauer eines Übergangs | Gremiennetz |
| 96 | D | Gremiennetz: Gremienarten als Knoten | Gremiennetz |
| 97 | D | Zu jeder Analyse der wissenschaftliche Hintergrund | Über Plenara.X |
| 98 | D | Zu jeder Analyse die Grenzen in Klartext | Über Plenara.X |
