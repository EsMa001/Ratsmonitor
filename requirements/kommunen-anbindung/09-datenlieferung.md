# Wiederkehrende Datenlieferung vereinbaren

Status: Konzept, Umsetzung offen. Reihenfolge: 09. Stand: 13.10.2026. Teil des [Anbindungskonzepts](../anbindung-fehlender-kommunen-konzept.md).

## Problem und Ist

Ein Teil der Kommunen wird auch nach Adress-, Archiv- und Dokumentprüfung keinen nutzbaren Veröffentlichungsweg liefern. Möglich sind ausschließlich geschützte Zugänge, Veröffentlichungen ohne verwendbare öffentliche Unterlagen oder ein ausschließlich analoger Prozess. Diese Fälle brauchen einen vereinbarten Zugang zur Kommune oder ihrem Dienstleister.

Die bestehenden Leser sind auf konkrete Quellenadressen und Verfahren eingerichtet. Eine einmal erhaltene Datei reicht nicht für einen dauerhaften Anschluss: Neue Sitzungen, geänderte Tagesordnungen und spätere Korrekturen müssen regelmäßig ankommen und demselben Gebiet zugeordnet werden. Einlieferung, Erstprüfung und produktiver Betrieb sind deshalb getrennte Schritte.

## Betroffenheit

Die Zahl ist **noch nicht nachgewiesen**. Aufnahme erfolgt erst nach dokumentierter Diagnose aus [08](08-fehlende-veroeffentlichungen.md) oder einem belegten Zugangsproblem. Die 43 Fälle ohne Unterlagen im Prüfzeitraum und die 27 Restfälle sind keine automatische Lieferliste. Auch OCR- oder Gremienprobleme können zunächst lösbar sein. Mengen überlappen und werden nicht addiert.

## Ziel

Eine wiederkehrende Lieferung veröffentlicht genau die benötigten öffentlichen Sitzungsinformationen in einem stabilen, prüfbaren Verfahren. Für jeden Pilotanschluss sind Verantwortlichkeit, Format, Takt, Korrekturweg und technische Verarbeitung festgelegt.

## Vorgehen

1. Pro Fall eine kurze Anforderung mit Gebiet, erfolglos geprüften Veröffentlichungswegen und benötigten öffentlichen Unterlagen vorbereiten. Ansprechpartner und Betreiber lediglich dokumentieren; **in diesem Auftrag keine Kontakte versenden**.
2. Vorhandene Möglichkeiten zuerst nutzen: öffentliche OParl-Freischaltung oder anderer stabiler Export, Feed je Körperschaft, bereitgestellter Dokumentindex. Wenn das nicht möglich ist, einen wiederkehrenden Datei-Export oder authentifizierten Upload vereinbaren.
3. Einen Mindestvertrag definieren: stabile Gebiets- und Sitzungskennungen, Gremium, Datum, Dokumentart, ausdrücklich öffentlicher Umfang, Originaldateien beziehungsweise dauerhafte Quellenlinks, Änderungsstand und Lösch-/Korrekturhinweise. Ein Format mit Text ist vorzuziehen; Scans gehen in die vorhandene OCR-Verarbeitung.
4. Liefertakt passend zum Veröffentlichungsprozess festlegen. Zusätzlich Zuständigkeit bei Ausfällen, Nachlieferung, Archivstart, Dateigrenzen und Zugangsschutz bestimmen. Ein ausbleibender Lauf muss sichtbar werden.
5. Mit einem kleinen Beispielpaket einen Connector oder Upload-Zulauf entwerfen. Dokumente zunächst in die Quellenarbeitsliste aufnehmen, anschließend regulär prüfen. Wiederholte Lieferungen anhand stabiler Kennungen und Prüfsummen erkennen; Änderungen als Revisionen verarbeiten.

## Abnahmekriterien

- Eine benannte verantwortliche Stelle und ein dokumentierter wiederkehrender Lieferweg liegen vor.
- Ein Beispielpaket und eine zweite Lieferung mit mindestens einer Korrektur sind verarbeitbar; Wiederholung erzeugt keine Doppelungen.
- Jede Sitzung und jedes Dokument haben nachvollziehbare Gebietszuordnung, öffentlichen Umfang und Quellenherkunft.
- Fehlende Lieferung, fehlerhafte Datei und Änderung erhalten getrennte Zustände und nächste Schritte.
- Das Quellenprofil enthält die Betriebsbedingungen. „Angebunden“ gilt erst nach erfolgreicher gemeinsamer produktiver Abnahme in [03](03-produktive-anbindung.md).

## Abhängigkeiten

[Arbeitsliste](01-arbeitsliste.md), [Quellenprofile](02-quellenprofile.md), belegte Diagnose aus [08](08-fehlende-veroeffentlichungen.md), [Dokumentabruf](04-dokumentabruf.md) und gegebenenfalls [gemeinsame Quellen](07-gemeinsame-quellen.md). Externe Zusagen und ein neuer Connector sind Umsetzungsvoraussetzungen, keine bereits erreichten Ergebnisse.

## Direkt nutzbarer Startauftrag

> Wähle drei nachweislich ungelöste Veröffentlichungslücken. Erstelle je Fall einen konkreten Vorschlag für Feed, Export oder Upload mit Mindestfeldern, Liefertakt, Korrekturverfahren und Beispielpaket. Bereite die Kooperationsanforderung vor, versende sie nicht. Beschreibe den Connector und die produktive Abnahme aus 03; dokumentiere externe Abhängigkeiten.

## Codequellen

[Quellenkatalog](../../server/integrations/source-catalog.mjs), [Leserregister](../../server/integrations/readers.mjs), [Quellenabruf](../../server/integrations/collect-region.mjs), [PDF-Ablage](../../server/node/pdf-store.mjs), [Zugangsarten](../../shared/source-access.mjs).
