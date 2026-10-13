# Gemeinsame Quellen richtig zuordnen

Status: Konzept, Umsetzung offen. Reihenfolge: 07. Stand: 13.10.2026. Teil des [Anbindungskonzepts](../anbindung-fehlender-kommunen-konzept.md).

## Problem und Ist

Ein Amt, eine Verwaltungsgemeinschaft oder ein Gemeindeverwaltungsverband veröffentlicht Sitzungen mehrerer Gemeinden auf derselben Website, teilweise im selben Amtsblatt. Der Herausgeber ist dann nicht zwingend die Körperschaft, deren Rat tagt. Eine Gemeinde kann auf die Verwaltung oder das RIS einer Nachbargemeinde verweisen. Eine erfolgreiche Texterkennung genügt deshalb nicht für einen Quellenanschluss: Die Quelle muss den richtigen Katalogeintrag und dessen Gremien liefern.

Der Website-Leser prüft bereits Gemeinde, Herausgeber und Gremium. Die Quellensuche erkennt fremde Besitzer und mehrfach beanspruchte RIS-Adressen; explizite Körperschafts- und Gremienfilter ermöglichen getrennte Quellen. Diese Regeln müssen bei gemeinsamen Website-Veröffentlichungen zusammenwirken. Eine gemeinsame Startadresse darf weder pauschal allen Gebieten zugewiesen noch allein wegen ihrer gemeinsamen Nutzung verworfen werden.

## Betroffenheit

Die Fallzahl **innerhalb der 490 Website/PDF-Gebiete ist noch unbekannt** und wird in der [Arbeitsliste](01-arbeitsliste.md) erhoben. Die fünf Gebiete der Atlas-Kategorie „Gemeinsames System“ liegen außerhalb dieser Gruppe und sind keine Schätzung für sie. Fälle können gleichzeitig OCR oder eine Prüfung öffentlicher Abschnitte benötigen; Mengen werden nicht addiert.

## Ziel

Jedes Gebiet erhält ausschließlich die belegten Sitzungen seiner katalogisierten Körperschaft beziehungsweise seiner erfassten Mitglieder. Gemeinsame Dokumente bleiben als gemeinsame Quellen erkennbar, ohne politische Vorgänge mehrfach oder einer Nachbargemeinde zuzuordnen.

## Vorgehen

1. Katalog-ID, Gebietstyp und Mitgliedsgemeinden gegen die tatsächliche Veröffentlichung abgleichen. Verbandsrat und Gemeinderäte getrennt erfassen.
2. Im [Quellenprofil](02-quellenprofile.md) die gemeinsame Website, beteiligte Körperschaften, Gremiennamen und belegte Teilbereiche festhalten. Namensvarianten anhand einer amtlichen Fundstelle bestätigen.
3. Die engste stabile Trennung wählen: eigener Veröffentlichungsbereich, Kalender, Körperschaftskennung oder Gremium. Bei gemeinsamen PDFs jeden Sitzungsabschnitt einzeln zuordnen; der Briefkopf allein entscheidet nicht.
4. Doppelte Katalogbeanspruchungen vergleichen. Dieselbe Adresse mit nachweislich verschiedenen Teilbereichen ist zulässig; dieselben Sitzungen unter zwei Gebiets-IDs sind ein ungeklärter Konflikt.
5. Einen Beispielbestand mit mindestens zwei beteiligten Körperschaften einschließlich eines fremden Gremiums prüfen. Unklare Zuordnungen bleiben offen und erhalten einen konkreten nächsten Prüfschritt.

## Abnahmekriterien

- Jede Zuordnungsregel hat eine amtliche Belegstelle und einen benannten Katalogeintrag.
- Der Beispielbestand enthält alle erwarteten eigenen Sitzungen und keine fremden Sitzungen.
- Ein gemeinsames Dokument erzeugt keine unbegründete Doppelzuordnung; wiederholte Verarbeitung bleibt stabil.
- Aus der Zuordnung wird ein ausführbares Quellenprofil. Der produktive Anschluss folgt der gemeinsamen Abnahme in [03](03-produktive-anbindung.md).

## Abhängigkeiten

[Arbeitsliste](01-arbeitsliste.md), [Quellenprofile](02-quellenprofile.md), bei Bedarf [Scan-PDFs](05-scan-pdfs.md) und [öffentliche Abschnitte](06-oeffentliche-abschnitte.md).

## Direkt nutzbarer Startauftrag

> Wähle fünf Website/PDF-Gebiete mit gemeinsamer Amts- oder VG-Veröffentlichung. Dokumentiere je Gebiet Katalogebene, Mitglieder, eigene und fremde Gremien sowie eine belegte Trennregel. Erstelle Quellenprofile und eine Konfliktliste mehrfach beanspruchter Adressen. Keine Quelle allein aufgrund der gemeinsamen Startadresse übernehmen. Führe anschließend die produktive Abnahme aus 03 aus.

## Codequellen

[Gebietskatalog](../../shared/catalog.mjs), [Website-Zuordnung](../../server/integrations/website.mjs), [Besitzerprüfung](../../scripts/source-discovery/areas.mjs), [Katalogaufbau und Doppelvergabe](../../scripts/source-discovery/build.mjs), [Prüfung gemeinsamer Systeme](../../scripts/source-discovery/verify.mjs).
