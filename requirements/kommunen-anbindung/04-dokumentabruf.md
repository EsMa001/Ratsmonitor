# Öffentliche Dokumentablagen und fehlerhafte Downloads anbinden

Status: Konzept, Umsetzung offen. Reihenfolge: 04. Stand: 13.10.2026. Teil des [Anbindungskonzepts](../anbindung-fehlender-kommunen-konzept.md).

## Problem und betroffene Fälle

Eine Kommune kann ihre öffentlichen Unterlagen auf der eigenen Website verlinken, aber auf einer anderen Domain speichern. Der [Website-Leser](../../server/integrations/website.mjs) erlaubt über `siteAllowed` und `alsoFrom` derzeit nur verwandte Hosts und bestimmte bekannte CMS-Dateihosts. Eine zusätzlich eingetragene beliebige Fremddomain wird dadurch noch nicht lesbar. Die [Quellensuche](../../scripts/source-discovery/website-plan.mjs) begrenzt Funde entsprechend.

Die **37 gespeicherten Fälle „Dokumente nicht lesbar“** sind eine Sammelgruppe. Darunter können fehlgeschlagene Downloads, Weiterleitungen, defekte Dateien, ungeeignete Formate oder Textprobleme liegen. Weder sind alle Fälle Fremdhostprobleme, noch ist ihre erfolgreiche Anbindung zugesagt. Externe Ablagen können auch unter anderen Atlasgründen vorkommen. Die Mengen der technischen Konzepte überlappen und dürfen nicht addiert werden.

## Ziel und Abgrenzung

Ein belegter öffentlicher Dokumentenlink soll mit dem Quellenprofil wiederholbar abrufbar sein. Die Kommune braucht außerdem eine Veröffentlichungsseite oder einen anderen nachvollziehbaren Weg zu neuen Dokumenten. Eine einzelne heruntergeladene Datei genügt nicht für eine laufende Anbindung.

Dieses Paket löst Herkunfts- und Abrufprobleme. Scanverarbeitung gehört zu [05](05-scan-pdfs.md), öffentliche Abschnittserkennung zu [06](06-oeffentliche-abschnitte.md). Anmeldung, Browserprüfungen und technische Sperren werden nicht umgangen. Verlags- oder Liefervereinbarungen gehören gegebenenfalls zu [09](09-datenlieferung.md).

## Vorgehen

1. Die Fälle aus [01 Arbeitsliste](01-arbeitsliste.md) einzeln diagnostizieren: Fundseite, Zieladresse, tatsächliches Weiterleitungsziel, HTTP-Ergebnis, Dateityp und konkrete Fehlerursache festhalten. Ein fehlender Download wird nicht als OCR-Problem behandelt.
2. Im [Quellenprofil](02-quellenprofile.md) den offiziellen Herkunftslink, Herausgeber und zulässigen Dokumentbereich hinterlegen. Zusätzliche Hosts werden ausdrücklich gebunden; ein gemeinsamer Hoster ist keine Freigabe aller seiner Mandanten.
3. Die Herkunftsbindung durch Suche, Leser und Ablage führen. Vorhandene Prüfungen für HTTPS, Zieladressen, Weiterleitungen, Größe, Zeitbudget und Sperrstopp wiederverwenden; jeder Weiterleitungsschritt muss zum belegten Abrufbereich gehören.
4. Format anhand der tatsächlichen Antwort prüfen. Eine Fehlerseite mit Status 200 ist kein PDF. Defekte Dateien und vorübergehende Fehler erhalten getrennte Zustände; Wiederholungen bleiben begrenzt.
5. Erfolgreiche Funde mit Adresse, Herkunft, Prüfsumme und Version erfassen und dem bisherigen Leser übergeben. Nur nachfolgend erkannte öffentliche Vorgänge ermöglichen die Anbindung.

## Abnahme und Abhängigkeiten

- Ein Beispiel einer belegten externen Ablage ist reproduzierbar abrufbar; ein nicht zugeordnetes Ziel und eine fremde Weiterleitung werden abgewiesen.
- HTML-Fehlerantwort, defektes PDF und Zugriffssperre erhalten passende Befunde; kein Fall gilt allein wegen HTTP 200 als erfolgreich.
- Ein zweiter Abruf erkennt dieselbe beziehungsweise eine geänderte Datei ohne unkontrollierte Wiederholungen.
- Für jede tatsächlich gelöste Kommune folgt vollständig [03 Produktive Anbindung](03-produktive-anbindung.md): Prüfung, produktiver Katalog, Erstimport und Folgeabruf.

## Direkt verwendbarer Startauftrag

> Setze Konzept 04 um. Wähle aus der bereinigten Arbeitsliste drei bestätigte Abruffälle mit unterschiedlichen Ursachen. Dokumentiere ihre Quellenprofile, ergänze ausschließlich die nachgewiesenen Herkunfts- und Abruflücken und prüfe erlaubte sowie abgewiesene Zieladressen. Übergib lesbare Dokumente an den vorhandenen Leser; führe gelöste Kommunen durch Konzept 03. Ordne übrige Fälle mit datiertem Grund dem passenden Folgekonzept zu. Kontaktiere keine Dritten.

Weitere Codequelle: [bestehender Dokumentenabruf](../../scripts/pdf-store/store-lib.mjs).
