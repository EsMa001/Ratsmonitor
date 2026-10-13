# Geprüfte Quellen bis zum laufenden Datenimport übernehmen

Status: Konzept, Umsetzung offen. Reihenfolge: 03. Voraussetzung: erste positive Profile aus [02 Quellenprofile](02-quellenprofile.md). Dieser Ablauf gilt anschließend für jede weitere Problemlösung.

## Problem und betroffene Fälle

Ein erfolgreicher Quellentest schreibt noch keine Ratsdaten in die Datenbank. Der Kataloggenerator schreibt Quelldateien und Prüfberichte; erst der aktive Serverkatalog und ein Importauftrag erzeugen gespeicherte Vorgänge. Im Atlas kann ein Katalogeintrag bereits als angebunden erscheinen, obwohl noch keine Daten übernommen wurden.

Das betrifft jede neue Anbindung. Es ist keine zusätzliche Teilmenge der 490 offenen Gebiete.

## Ziel

Für jede neue Kommune nachweisen: Quelle geprüft, Konfiguration produktiv verfügbar, Erstimport erfolgreich, Folgeabruf funktionsfähig. Alle nachfolgenden Problemkonzepte benutzen diese gemeinsame Abnahme.

## Vorgehen

1. Positive Prüfergebnisse gezielt in die passende Quelldatei übernehmen. Bestehende kuratierte Einträge und andere Quellen erhalten. Profil, Gebiet, Prüfumfang und offene Teilfehler zusammen sichern.
2. Katalogzusammenführung und Mehrfachzuordnung prüfen. Eine Quelle eines Verbands darf nicht ohne belegten Filter mehreren Gemeinden zugeschrieben werden.
3. Atlas und erforderliche abgeleitete Quellendaten konsistent aktualisieren. Paket 01 schützt dabei vor veralteten Gründen.
4. Den neuen Katalog über den vorhandenen Ausrollweg bereitstellen. Am laufenden System nachweisen, dass die neue Gebiets-ID mit der geprüften Konfiguration geladen ist.
5. Einen gezielten Erstimport starten und bis zum abgeschlossenen beziehungsweise klar dokumentierten Teilstand führen. Gespeicherte Vorgänge, richtige Kommune/Gremien, Originalverweise und erfolgreichen Abrufzeitpunkt prüfen.
6. Einen Folgeabruf durchführen. Bei unverändertem Bestand darf die Zahl neuer Vorgänge null sein; vorhandene Daten und Lesemarken müssen erhalten bleiben. Geänderte oder neue Unterlagen sollen übernommen werden, ohne Dubletten zu erzeugen.
7. Tatsächliche Aktivierung und Ausführung des regelmäßigen Abrufs prüfen. Websitequellen benötigen zusätzlich längere Rückblicke: Der vorhandene Nachtimport mit einer Woche kann spät veröffentlichte Protokolle älterer Sitzungen übersehen. Einen begrenzten regelmäßigen Nachlauf, zunächst beispielsweise drei Monate, anhand echter Fälle festlegen.

## Abnahme

- Die produktive Konfiguration entspricht dem positiv geprüften Profil.
- Mindestens ein echter öffentlicher Vorgang des neuen Gebiets ist gespeichert; Zeitpunkt, Quelle und Importergebnis sind nachvollziehbar.
- Der zweite Lauf erzeugt keine Dubletten. Ein erfolgreich unveränderter Abruf wird korrekt behandelt.
- Ein nachträglich veröffentlichtes Dokument zu einer älteren Sitzung wird vom vorgesehenen Nachlauf erfasst.
- Das regelmäßige Abrufverfahren ist nachweislich aktiv; seine bloße Existenz im Code genügt nicht.
- Konfiguriert, Erstimport erfolgreich und Folgeabruf geprüft werden getrennt ausgewiesen. KI-Texte sind keine Abnahmebedingung.

## Abhängigkeiten und Übergabe

Paket 01 und ein positives Profil aus Paket 02 sind erforderlich. Nach Abschluss von 04 bis 09 durchläuft jede betroffene Kommune erneut die Profilprüfung und diesen Übernahmeweg. Die globale Arbeit an weiteren Problemen muss nicht auf neue Veröffentlichungen einer einzelnen Pilotkommune warten; noch offene Betriebsnachweise bleiben datiert sichtbar.

## Startauftrag

Setze Konzept 03 für die positiv geprüften Quellenprofile um: Übernimm die Konfigurationen über den bestehenden Katalog- und Ausrollweg, bestätige Erstimport und Folgeabruf und dokumentiere den regelmäßigen Betrieb. Verwende die vorhandenen Betriebsanweisungen und die für produktive Änderungen geltenden Berechtigungen.

## Bezug zur Umsetzung

[Kataloggenerator](../../scripts/source-discovery/build.mjs), [Quellenkatalog](../../server/integrations/source-catalog.mjs), [Regulärer Abruf](../../server/integrations/collect-region.mjs), [Job-Konfiguration](../../server/integrations/schedules.mjs), [Betriebsanleitung](../../docs/betrieb/node-server.md).
