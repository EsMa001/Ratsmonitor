# Billerbeck · gespeicherte Inhaltsanalyse

Stand 27.09.2026 · Anforderungen v0.21 · Paket `billerbeck-content-2026-09-27-v1`

## Umfang und Zählweise

| Ergebnis | Anzahl |
|---|---:|
| Bearbeitete kanonische Artikel | 402 |
| Quellenbasierte KI-Inhaltszusammenfassungen | 310 |
| Davon kurze, ausdrücklich protokollierte Antworten ohne weiteren Sachinhalt | 16 |
| Unzureichende Sachgrundlage | 92 |
| Davon leere Überschriften oder Sammelpunkte | 56 |
| Davon nur Tagesordnungsnachweis | 34 |
| Davon fehlender inhaltlicher Bericht | 2 |
| Getrennte KI-Labelbewertungen | 402 |
| Titelbasierte Stichwortprofile mit ganzzahliger Summe 100 | 402 |
| Sitzungen mit öffentlicher Teilnehmerliste | 39 |
| Person-Sitzungs-Einträge, nicht unterschiedliche Personen | 508 |
| Artikel mit strukturierten Ergebnis-/Umsetzungsangaben | 23 |
| Analysen mit ausdrücklichem Hinweis auf Quellenwidersprüche | 6 |

Diese Zahlen beschreiben das vollständig vorbereitete und technisch geprüfte Paket. Der tatsächliche Speicherstand wird beim ausdrücklich gestarteten Import aus der produktiven Datenbank gezählt und in `import_runs.details.stored` protokolliert. Ein Deployment allein importiert keine Auswertungen.

## Wie die KI-Inhaltsanalyse entstanden ist

Codex hat 240 öffentliche Tagesordnungspunktseiten und 128 Vorlagentexte inhaltlich gelesen, darunter fünf Vorlagen über PDF-Ersatzquellen. Bei weiteren 34 Einträgen war nur die Tagesordnung mit Titel verfügbar. Daraus wurden pro Artikel verständliche Kurz- und Langfassungen formuliert, Originalbelege zugeordnet und Vorschläge von belegten Entscheidungen getrennt. Dies ist eine direkt erstellte KI-Auswertung, keine bloße Umbenennung der früheren Quellenüberblicke. Eine externe Modell-API wurde nicht genutzt.

Leere Sammelpunkte oder nicht erreichbare Berichte erhalten keine erfundene Zusammenfassung. Der gespeicherte Status `insufficient_source` benennt, was fehlt. Ein ausdrücklich protokolliertes „Keine“ wird dagegen als belegte kurze Aussage behandelt. Sichtbare Zahlen-/Datumswidersprüche werden mitgeführt; unsichere Werte werden nicht stillschweigend als Tatsachen übernommen.

Gespeichert werden Ergebnistext, wenige kurze Belegzitate, Originaladressen, Abrufzeitpunkte und Prüfsummen. Vollständige neu abgerufene HTML-Seiten und PDFs gehören nicht zum Produktionspaket oder zur Datenbank. Alte bereits gespeicherte Auszüge werden erhalten. Die Methode ist `codex-direct-v1`; der Status der unabhängigen Prüfung bleibt `not_independently_reviewed`.

## Labels und Stichwörter

Die Regelbewertung nutzt den amtlichen Titel und den bestehenden versionierten Regelkatalog. Sie wird separat erhalten beziehungsweise im ausdrücklich gestarteten Lauf nach aktuellen Regeln ergänzt. Die zusätzliche KI-Bewertung nutzt den tatsächlich verfügbaren Sachtext; ohne Sachtext wird ihre eingeschränkte Titelbasis genannt. Die bestehende Karten- und Zeitreihenanalyse verwendet weiter die Regelbewertung. Abweichungen zwischen beiden Verfahren sind keine belegten Fehler des einen oder anderen Verfahrens.

Die gewichteten Stichwörter übernehmen die frühere direkte KI-Titelstudie unverändert: 402 Profile mit insgesamt 865 Begriffszuweisungen und 502 unterschiedlichen Begriffen, ein bis sieben Begriffe pro Artikel. Jedes Gewicht ist eine positive ganze Zahl, jedes Profil ergibt 100. Diese Gewichte sind relative inhaltliche Schwerpunkte der Titel, keine statistisch kalibrierten Wahrscheinlichkeiten. Zehn gehaltvolle, volltextbasierte Stichpunkte für jeden Bericht sind noch nicht hergestellt.

## Qualität und Grenzen

Geprüft wurden Zuordnung und Einmaligkeit aller 402 Artikel, tatsächlich passende Originalzitate, Quellenadressen und Hashes, Längengrenzen, zulässige Labels und ganzzahlige Gewichtssummen. Regressionstests prüfen außerdem getrennte Bewertungsstände, Zugangsschutz, Paketgrenzen, Wiederholungsschutz, Konflikterkennung, atomare Speicherung und Erhalt der KI-Inhalte bei Folgeimporten.

Technischer Nachweis: 113 automatisierte Tests und die TypeScript-Prüfung bestanden. Die Schutzprüfung umfasst auch den vollständigen Identitätsabgleich bei Folgeimporten.

Eine unabhängige menschliche Stichprobe liegt nicht vor. Es gibt deshalb keine belastbare Prozentangabe zur inhaltlichen Genauigkeit. Insbesondere Zahlen, vorgeschlagene Maßnahmen und tatsächliche Beschlüsse sollten in einer späteren unabhängigen Stichprobe getrennt bewertet werden. Die 92 Quellenlücken und sechs widersprüchlichen Quellen sind dafür ein konkreter Prüfbestand; sie beweisen nicht, dass diese Inhalte im gesamten Ratsinformationssystem fehlen.

Öffentliche Teilnehmerangaben gelten für die ganze Sitzung. Fehlende Stimmenzahlen bleiben unbekannt; ein Beschluss bedeutet nicht automatisch, dass eine Maßnahme umgesetzt wurde. Alle Bearbeitungsdaten sind von amtlichen Änderungs- und Sitzungsdaten getrennt.

Der Test ist auf Billerbeck begrenzt. Neue Artikel und andere Gebiete werden nicht automatisch analysiert. Das Aufrufen von Website, Analyse oder Adminzahlen bleibt eine reine Leseoperation.
