# Scan PDFs vor der ersten Datenanbindung lesen

Status: Konzept, Umsetzung offen. Reihenfolge: 05. Stand: 13.10.2026. Teil des [Anbindungskonzepts](../anbindung-fehlender-kommunen-konzept.md).

## Problem und betroffene Fälle

Im Atlas stehen **39 gespeicherte Scan-Fälle**: Sitzungsunterlagen sind gefunden, aber ihre PDF-Dateien besitzen keine ausreichend lesbare Textebene. Der [Website-Leser](../../server/integrations/website.mjs) extrahiert mit `unpdf`; bei zu wenig Text vermerkt er die Datei als `unreadable` und erzeugt daraus keine Vorgänge.

Die [reguläre PDF-Beschaffung](../../scripts/pdf-store/fetch.mjs) beginnt dagegen bei Dokumenten bereits vorhandener Vorgänge. Ohne erste `topics` gelangt gerade die benötigte Einladung nicht automatisch in diese Verarbeitung. Die [lokale PDF-Ablage](../../server/node/pdf-store.mjs) unterstützt bereits Einträge ohne `topicId`; [Textebene und lokale OCR](../../scripts/pdf-store/store-lib.mjs) sind vorhanden. Es fehlt die Verbindung vom entdeckten Dokument zur OCR und zurück zur Quellenprüfung.

Die 39 sind datierte Hauptgründe, keine bestätigte Erfolgsmenge. Nachprüfung kann andere Ursachen ergeben. Scanprobleme können auch in weiteren Gruppen vorkommen; die Mengen der technischen Konzepte überlappen und dürfen nicht addiert werden.

## Ziel und Abgrenzung

Eine öffentlich belegte Scanquelle soll bereits vor dem ersten Vorgang Text erhalten. Anschließend verarbeitet der normale Website-Leser diesen Text und kann die Kommune positiv prüfen. OCR ist eine Vorstufe der Datenanbindung, kein Nachweis für richtige Gemeinde, öffentliche Sitzung oder vollständige Tagesordnung.

Downloadprobleme gehören zu [04](04-dokumentabruf.md), unklare öffentliche Abschnitte zu [06](06-oeffentliche-abschnitte.md). Ein neuer Cloud-OCR-Dienst und die spätere KI-Berichtserstellung sind für dieses Paket nicht erforderlich.

## Vorgehen

1. Mit [01](01-arbeitsliste.md) und [02](02-quellenprofile.md) bestätigen, welche Scan-Dateien zur Kommune gehören und wo künftig neue Unterlagen erscheinen. Nicht erreichbare Dateien zuerst über Konzept 04 klären.
2. Entdeckte PDFs ohne Artikel-ID in einen dauerhaften Dokumenteneingang aufnehmen: Gebiet, Fundseite, URL, Dateiprüfsumme, Version und Verarbeitungsschritt. Die vorhandene Ablage nach Prüfsumme wiederverwenden.
3. Textebene seitenweise lesen. Fehlende Seiten über die vorhandenen deutschen OCR-Werkzeuge bearbeiten; Originalseitennummern und Herkunft „Text“, „OCR“ oder „gemischt“ bewahren. Die derzeitige Zeichenmengenschwelle um bestätigte fehlerhafte Textfälle ergänzen.
4. OCR mit bestehenden Ressourcen-, Zeit- und Speichergrenzen fortsetzbar ausführen. Die Originalrevision bleibt bis zum Abschluss von OCR und Abschnittsprüfung innerhalb eines festen Budgets erhalten; bei ausgeschöpftem Budget wartet die Aufnahme neuer Dokumente. Ein späteres Nachladen könnte bereits eine andere Fassung liefern. Fehlende Werkzeuge, abgebrochene Dateien und noch unbearbeitete Seiten bleiben sichtbar offen. Eine geänderte Datei erhält eine eigene Version.
5. Den gespeicherten Text über eine gemeinsame Schnittstelle erneut an `collectWebsite` übergeben. Ein OCR-Ergebnis darf weder Öffentlichkeitsprüfung noch Gebietszuordnung überspringen. Problematische Spalten oder Kennzeichen wie „Ö/NÖ“ führen zur Prüfung statt zu geratenen Punkten.

## Abnahme und Abhängigkeiten

- Ein bestätigtes Scan-Beispiel durchläuft Dokumenteneingang, OCR und erneute Quellenprüfung ohne bereits vorhandene Artikel-ID.
- Seitenzahlen, Prüfsumme und Textversion bleiben nachvollziehbar; noch fehlende Seiten werden ausdrücklich ausgewiesen.
- Unterbrechung und Wiederaufnahme verlieren keine Funde; dieselbe fertig verarbeitete Version wird nicht erneut unnötig OCR-gelesen.
- Öffentliche und nichtöffentliche Punkte werden anhand manuell markierter Beispiele korrekt getrennt; ungeklärte Fälle bleiben offen.
- Kritische OCR-Angaben wie Öffentlichkeitskennzeichen und Sitzungstag stimmen in den Prüffällen mit dem Originalseitenbild überein; ein Zitatabgleich nur gegen OCR-Text genügt dafür nicht.
- Jede gelöste Kommune besteht anschließend die gemeinsame Abnahme aus [03](03-produktive-anbindung.md), einschließlich echtem Erstimport und geprüftem Folgeabruf.

## Direkt verwendbarer Startauftrag

> Setze Konzept 05 um. Bestätige drei Scanquellen aus der Arbeitsliste, darunter eine Datei mit gemischter Textebene und ein mehrseitiges Beispiel. Verbinde den Dokumenteneingang ohne Topic-ID mit vorhandener Text/OCR-Verarbeitung und dem Website-Leser. Prüfe Unterbrechung, unveränderte und ersetzte Dateien sowie öffentliche Abschnittsgrenzen. Führe gelöste Quellen durch Konzept 03; weise verbliebene Lese- und Zuordnungsfehler getrennt aus. Kontaktiere keine Dritten.

Weitere Codequelle: [fortsetzbare OCR-Aufträge](../../scripts/pdf-store/text.mjs).
