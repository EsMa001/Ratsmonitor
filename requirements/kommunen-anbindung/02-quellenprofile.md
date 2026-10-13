# Bekannte Veröffentlichungsseiten direkt anbinden

Status: Konzept, Umsetzung offen. Reihenfolge: 02. Voraussetzung: [01 Arbeitsliste](01-arbeitsliste.md).

## Problem und betroffene Fälle

Bei vielen offenen Gebieten ist bereits eine Adresse gespeichert, aber noch kein erfolgreich geprüftes Quellenprofil vorhanden. Die Website-Suche beginnt häufig erneut bei Wikidata und der Homepage. Das allgemeine `verify.mjs` erkennt den Website-Adapter nicht; seine Aufnahmeprüfung ist bisher in den Suchlauf eingebettet.

263 Fälle tragen lediglich einen allgemeinen Website/PDF-Grund. Sie sind ein vorrangiger Prüfbestand, keine zugesagte Zahl leicht anschließbarer Kommunen. Auch andere Problemgruppen können nach ihrer Korrektur dieses Paket nutzen.

## Ziel

Eine bekannte Veröffentlichungsstelle als konkreten Katalogeintrag konfigurieren und mit dem vorhandenen Leser reproduzierbar prüfen. Neue Quellen sollen ohne erneute Vollsuche geprüft werden können.

## Vorgehen

1. Die gespeicherte Atlasadresse direkt prüfen: Ist sie eine laufende Veröffentlichungsliste, ein Archiv, ein einzelnes Dokument, eine allgemeine Informationsseite oder ein RIS?
2. Herausgeber und Gebiet nachweisen. Bei einem einzelnen Dokument zusätzlich die Liste finden, über die neue Unterlagen erscheinen. Bei einem RIS den bestehenden passenden RIS-Prüfweg verwenden.
3. Für Websitequellen `id`, `name`, `kind`, `method: scraper`, `adapter: website`, `base` und konkrete `pages` konfigurieren; vorhandene Feeds, Kalender, WordPress-Ausgaben oder Sitemaps ergänzen. Nur tatsächlich vorhandene und unterstützte Felder verwenden.
4. Eine eigenständig aufrufbare Prüfung des fertigen Profils ergänzen. Sie nutzt `collectWebsite`, die bestehenden Regeln und die erwarteten Gebietsnamen. Sie liefert verwendetes Profil, Zeitraum, öffentliche Vorgänge, Gebietszuordnung und Fehler.
5. Zunächst einen kurzen aktuellen Zeitraum prüfen; bei leerem Ergebnis gezielt einen längeren Zeitraum zur Diagnose verwenden. Historische Lesbarkeit und aktuelle Belieferung getrennt benennen.
6. Mit 20 Gebieten verschiedener Veröffentlichungsformen beginnen. Positive Profile an Paket 03 übergeben. Bei konkreten Blockern die Kommune samt Dokumentadresse und Fehlerbeleg an Paket 04 bis 09 weiterreichen.

## Abnahme

- Ein fertiges Profil lässt sich ohne erneute Quellensuche prüfen.
- Mindestens ein bisher offenes Gebiet liefert damit öffentliche Vorgänge und einen bestätigten Gebietsbezug. Die aktuelle Aufnahmebedingung `topics > 0` und `namesArea = true` wird nicht durch einen bloßen Kalenderfund ersetzt.
- Eine bekannte unpassende Quelle wird nicht akzeptiert, beispielsweise das Gremium einer Nachbargemeinde.
- Die 20 Pilotfälle haben jeweils ein belegtes Ergebnis: positives Profil oder genauer Folgeauftrag. Nicht alle müssen erfolgreich anschließbar sein.
- Prüfergebnis und verwendete Konfiguration bleiben zusammen reproduzierbar gespeichert. Teilstände sind sichtbar.

## Abhängigkeiten und Übergabe

Paket 01 liefert die Liste. [03 Produktive Anbindung](03-produktive-anbindung.md) übernimmt erfolgreiche Profile. Spezialblocker werden einzeln bearbeitet und anschließend erneut mit diesem Prüfweg geprüft; sie blockieren nicht die Aufnahme bereits funktionierender Quellen.

## Startauftrag

Setze Konzept 02 um: Ergänze die direkte Prüfung vorbereiteter Website-Quellenprofile und bearbeite die ersten 20 Fälle aus der bereinigten Arbeitsliste. Nutze die gespeicherten Veröffentlichungsadressen und vorhandenen Adapter. Liefere geprüfte Profile beziehungsweise belegte technische Folgeprobleme für jedes Gebiet.

## Bezug zur Umsetzung

[Website-Suche](../../scripts/source-discovery/website.mjs), [Quellenprofile und Aufnahmeprüfung](../../scripts/source-discovery/website-plan.mjs), [Website-Leser](../../server/integrations/website.mjs), [Leserregister](../../server/integrations/readers.mjs), [RIS-Prüfung](../../scripts/source-discovery/verify.mjs).
