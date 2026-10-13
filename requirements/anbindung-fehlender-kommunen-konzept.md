# Fehlende Kommunen schrittweise anbinden

Stand 13.10.2026. Das Anbindungskonzept ist in neun einzeln bearbeitbare Problemkonzepte aufgeteilt. Jedes enthält Problem, betroffene Fälle, Vorgehen, Abnahmekriterien, Abhängigkeiten und einen direkt verwendbaren Startauftrag. Konzept 01 ist umgesetzt und abgenommen; die Umsetzung der Konzepte 02 bis 09 ist offen.

Ziel bleibt eine laufende Datenanbindung je fehlender Kommune: positiv geprüfte Quelle, produktiv eingetragener Adapter, gespeicherte Daten aus dem Erstimport und bestätigter Folgeabruf. Ausgangspunkt sind die 490 offenen Gebiete der Atlasgruppe „Nur Webseite oder PDF“ im analysierten Projektstand. Gemeinde, Gemeindeverband und Landkreis werden getrennt geführt.

## Reihenfolge der Bearbeitung

| Nr. | Identifiziertes Problem und Einzelkonzept | Fertiges Ergebnis | Stand |
|---|---|---|---|
| 01 | [Veraltete oder widersprüchliche Arbeitslisten](kommunen-anbindung/01-arbeitsliste.md) | [490 aktuelle Fälle](kommunen-anbindung/daten/website-arbeitsliste.md), Herkunft und Vergleichskonflikte gesichert; Rückstufungsschutz im Generator | Abgenommen, 13.10.2026 |
| 02 | [Bekannte Veröffentlichungsseite ohne geprüfte Anbindung](kommunen-anbindung/02-quellenprofile.md) | Quellenprofile direkt prüfen; erste 20 Fälle mit Ergebnis bearbeiten | Umsetzung offen |
| 03 | [Geprüfte Quelle liefert noch keine Daten im laufenden System](kommunen-anbindung/03-produktive-anbindung.md) | Katalogübernahme, Erstimport und regelmäßigen Folgeabruf nachweisen | Umsetzung offen |
| 04 | [Dokumentabruf und externe Dateiablagen scheitern](kommunen-anbindung/04-dokumentabruf.md) | Offiziell verlinkte Unterlagen zuverlässig laden und Abruffehler unterscheiden | Umsetzung offen |
| 05 | [Scan PDFs liefern vor der ersten Anbindung keinen Text](kommunen-anbindung/05-scan-pdfs.md) | Gefundene PDFs ohne vorhandene Artikel-ID durch OCR zur Quellenprüfung führen | Umsetzung offen |
| 06 | [Öffentlicher Abschnitt oder Dokumentstruktur wird nicht erkannt](kommunen-anbindung/06-oeffentliche-abschnitte.md) | Belegte öffentliche Vorgänge auch aus den bestätigten Problemformaten lesen | Umsetzung offen |
| 07 | [Gemeinsame Verbandsquelle wird nicht richtig getrennt](kommunen-anbindung/07-gemeinsame-quellen.md) | Gemeinde und Gremium eindeutig zuordnen; getrennte Profile im Katalog zulassen | Umsetzung offen |
| 08 | [Keine verwertbaren Veröffentlichungen gefunden](kommunen-anbindung/08-fehlende-veroeffentlichungen.md) | Veröffentlichungsort und Zeitraum klären oder konkreten fehlenden Zugang belegen | Umsetzung offen |
| 09 | [Es fehlt ein zugänglicher dauerhafter Lieferweg](kommunen-anbindung/09-datenlieferung.md) | Mit Kommune oder Betreiber einen wiederkehrenden Datenanschluss vereinbaren und prüfen | Umsetzung offen |

Zuerst werden 01, 02 und 03 bearbeitet. Damit steht der vollständige Weg von einer bekannten Quelle bis zur tatsächlich angeschlossenen Kommune. Anschließend werden 04 bis 09 einzeln nach dem jeweils nachgewiesenen Bedarf umgesetzt. Zeigt die Prüfung für ein Paket keine passenden Fälle, wird es mit Begründung zurückgestellt; eine hypothetische Adaptererweiterung ist dann nicht nötig.

Nach jeder technischen Problemlösung gehen die betroffenen Kommunen zurück durch die Profilprüfung aus 02 und die produktive Abnahme aus 03. So endet jedes Paket mit konkreten neuen Anbindungen oder genau benannten Restproblemen. Ein Erfolg beim Herunterladen oder Parsen allein schließt eine Anbindung nicht ab.

## Zuordnung der bisherigen Atlasgründe

| Bisher gespeicherter Hauptgrund | Ausgangszahl | Erster Bearbeitungsweg |
|---|---:|---|
| Allgemeiner Hinweis auf Website oder PDF | 263 | 02; konkrete Blocker danach in 04 bis 09 |
| Öffentlichkeitsnachweis nicht erkennbar | 81 | 06; bei fehlender Textebene zuvor 05 |
| Scan PDF ohne Textebene | 39 | 05 |
| Dokumente nicht lesbar | 37 | 04 zur Diagnose; Text- und Layoutprobleme danach 05 oder 06 |
| Keine Unterlagen im geprüften Zeitraum | 43 | 08 |
| Sonstige Fälle dieser Atlasgruppe | 27 | Ursache klären und passendes Paket zuweisen |
| **Gesamt** | **490** | |

Diese sechs Ausgangsgruppen zählen den jeweils gespeicherten Hauptgrund. Die neun Problemkonzepte sind keine neun disjunkten Gebietsmengen: Eine Kommune kann zuerst einen Downloadfehler, anschließend einen Scan und schließlich eine unklare Zuordnung aufweisen. Fallzahlen der Konzepte werden daher nicht addiert. Insbesondere ist die Zahl gemeinsamer Verbandsquellen innerhalb dieser 490 Fälle noch nicht bestimmt; die fünf anderswo im Atlas als „Gemeinsames System“ geführten Gebiete sind dafür kein Ersatzwert.

## Fortschritt und Abschluss

Für jedes Konzept werden bei der Umsetzung Beginn, bearbeitete Gebiets-IDs, technische Änderungen, geprüfte Beispiele und Abnahmeergebnis dokumentiert. Für jede Kommune bleibt getrennt sichtbar: offen, Quelle gefunden, Profil vorbereitet, Prüfung erfolgreich, produktiv konfiguriert, Erstimport erfolgreich, Folgeabruf geprüft.

Die Hauptkennzahl ist die Zahl vorher fehlender Kommunen mit bestätigter Datenübernahme und funktionierendem Folgeabruf. Ergänzend werden Einwohner auf Gemeindeebene, Aktualität, Teilstände und der verbleibende Anschlussgrund ausgewiesen. Ein alter Quellenfund belegt keine aktuelle Belieferung, eine gefundene URL noch keine nutzbare Anbindung.

Der nächste ausführbare Schritt ist [Konzept 02](kommunen-anbindung/02-quellenprofile.md). Die abgenommene Arbeitsliste aus 01 ordnet 263 Fälle zunächst den Quellenprofilen zu. Bei 92 davon fehlt noch eine gespeicherte Adresse; dort beginnt die Profilprüfung mit der amtlichen Veröffentlichungsseite. Weitere Hauptzuordnungen: 46 Dokumentabruf, 39 Scan-PDFs, 81 öffentliche Abschnitte und 61 fehlende Veröffentlichungen. 23 Vergleichskonflikte und ein unbekanntes Prüfdatum bleiben zur gezielten Klärung sichtbar. Die technische Umsetzung von 01 hat noch keine zusätzliche Kommune produktiv angebunden.
