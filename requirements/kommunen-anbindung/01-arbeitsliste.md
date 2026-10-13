# Aktuelle offene Kommunen eindeutig bestimmen

Status: umgesetzt und abgenommen am 13.10.2026. Reihenfolge: 01. Dieses Paket schafft die Arbeitsgrundlage für die folgenden Anbindungen.

## Ergebnis der Umsetzung

Die [Arbeitsliste](daten/website-arbeitsliste.md) enthält **490 eindeutige offene Website/PDF-Gebiete**, exakt nach der aktuellen Adminlogik: 378 Gemeinden/Städte, 107 Gemeindeverbände und 5 Kreise. Keines der 4.041 konfigurierten Gebiete steht darin. [JSON mit Originalbelegen](daten/website-arbeitsliste.json) und [unveränderliche Ausgangsliste](daten/baseline-website.json) sichern IDs, AGS, Gebietsart, Land, gespeicherte Adresse, wörtlichen Grund, Herkunft, Prüfdatum, Dateiprüfsummen und Vergleichsbefunde. Zur Ausgangsliste gibt es bei der Abnahme keine Zu- oder Abgänge.

| Nächstes Hauptpaket | Gebiete | Einordnung |
|---|---:|---|
| 02 Quellenprofile | 263 | Allgemeiner Website/PDF-Hinweis; bei 92 fehlt die gespeicherte Adresse, deshalb zuerst die amtliche Veröffentlichungsseite ermitteln |
| 04 Dokumentabruf | 46 | 37 unlesbare Dokumente und 9 weitere Abrufprobleme |
| 05 Scan-PDFs | 39 | Fehlende Textebene |
| 06 Öffentliche Abschnitte | 81 | Öffentlichkeitsnachweis nicht erkennbar |
| 08 Fehlende Veröffentlichungen | 61 | 43 ohne Unterlagen im geprüften Zeitraum und 18 weitere ungeklärte Fundstellen |

Diese Hauptzuordnung folgt ausschließlich den gespeicherten Gründen und ist keine neue Liveprüfung. Weitere im Grund erkennbare Probleme werden zusätzlich gespeichert. Die Diagnose der folgenden Pakete kann die Zuordnung präzisieren.

Bei 488 Gebieten nennt der Prüfvermerk den 10.10.2026, bei einem den 06.10.2026. Für Gemeinde Mühlenbach (`de-08317078`) bleibt das Datum unbekannt. Die 488 Vermerke vom 10.10. liegen nach dem gespeicherten Atlas-Erzeugungsdatum 09.10. und dem Berichtskopf 06.10.; beide Abweichungen sind explizite `dateIssues`. **23 Fälle haben offene Vergleichskonflikte.** Sie bleiben mit allen Gründen und Herkunftsangaben sichtbar; alte Suchstände werden nicht stillschweigend übernommen. Acht mehrdeutige Namenszuordnungen in den alten Berichten bleiben ebenfalls ungeklärt, statt einem beliebigen Gebiet zugeordnet zu werden.

## Nutzung und technische Abnahme

```powershell
node scripts/source-discovery/connection-worklist.mjs
```

Der Befehl aktualisiert nur die Arbeitsliste. Mit `--out DIR` lässt sich ein anderer Ausgabeordner wählen. `--init-baseline` legt eine Ausgangsliste ausschließlich an, wenn noch keine vorhanden ist; die hier gespeicherte Ausgangsliste bleibt bei Folgeläufen erhalten. Zu- und Abgänge werden nach aktueller Konfiguration, neuer Kategorie oder Entfernung aus dem Gebietskatalog erklärt. Fachliche Änderungen am einzelnen Befund und reine Herkunftsrevisionen stehen getrennt in `changedEvidence` und `changedProvenance`.

Die gemeinsame Quellen- und Kategorienlogik liegt in [atlas-sources.mjs](../../server/integrations/atlas-sources.mjs). [atlas-inputs.mjs](../../scripts/source-discovery/atlas-inputs.mjs) liest die Dateien und sichert die Herkunft, [atlas-evidence.mjs](../../scripts/source-discovery/atlas-evidence.mjs) entscheidet über die Prüfbefunde. Der Atlasgenerator erhält gespeicherte Kategorien; nur eindeutig jüngere, datierte und widerspruchsfrei geordnete Prüfbefunde können sie ersetzen. Unbekannte Datierung oder unklare Reihenfolge bleiben Konflikte. Künftige reguläre Atlas-Neubauten schreiben die Provenienz samt Alternativen in `source-atlas.json/evidence` mit, damit auch entfernte Arbeitsdateien ihre Prüfhistorie nicht mitnehmen.

Abnahme: **64 Tests bestanden**, ESLint für alle geänderten Programm- und Testdateien ohne Befund. Geprüft wurden Quellenvorrang, deaktivierte Quellen, Datumsregeln, Konflikte, Namensmehrdeutigkeiten, Baseline-Differenzen, Linkerhalt und Provenienz über mehrere Neubauten. Ein echter HTML-Probelauf behält Kategorien, Originalgründe und Adressen; der produktive Atlas bleibt dabei unverändert. Zwei aufeinanderfolgende Arbeitslistenläufe erzeugten byteidentische JSON- und Markdown-Dateien sowie dieselbe Ausgangsliste.

Snapshot der Abnahme: `bb62302bf2f0c30c28fe58166ab6cf82bd52b4cb55d7bc1eb8d641b1eb71a921`. Produktive Quellen wurden nicht verändert, Importe nicht gestartet. Nächster Arbeitsschritt ist [02 Quellenprofile](02-quellenprofile.md).

## Problem und betroffene Fälle

Der aktuelle Quellenkatalog und die gespeicherten Atlasgründe ergeben 490 offene Gebiete der Kategorie „Nur Webseite oder PDF“. Ältere `tmp/source-discovery*/open.json` enthalten teilweise andere Gründe. Der Atlasgenerator bevorzugt diese Arbeitsdateien; eine Neuerzeugung kann daher neuere Einordnungen überschreiben. Außerdem passen die Datumsangaben des Atlas nicht durchgehend zu den einzelnen Prüfvermerken.

Das betrifft die Auswahl aller 490 Fälle. Ohne eine verlässliche Liste könnten bereits angebundene Kommunen erneut untersucht oder Fälle dem falschen Problemkonzept zugeordnet werden.

## Ziel

Eine nachvollziehbare, reproduzierbare Liste aller aktuell offenen Website/PDF-Gebiete, mit gespeicherter Adresse, letztem belegten Grund und nächstem Arbeitsschritt. Der vorhandene Quellenkatalog bestimmt, ob ein Gebiet bereits konfiguriert ist; die Atlasgründe erklären die verbleibenden offenen Fälle.

## Vorgehen

1. Dieselbe Quellenzusammenführung wie im Admin-Atlas verwenden. Aktive Quellen, abgeschaltete Einträge und die vorhandenen Kernquellen richtig berücksichtigen.
2. Die verbleibenden Website/PDF-Gebiete mit Gebiets-ID, Gemeindeschlüssel, Name, Gebietsart, Land, Atlasadresse und wörtlichem Prüfgrund erfassen. Gemeinde, Verband und Kreis getrennt halten.
3. Je Prüfgrund Herkunft und tatsächliches Prüfdatum sichern. Unbekannte Daten bleiben unbekannt; das Erzeugungsdatum einer Datei ersetzt kein Prüfdatum.
4. Die Auswahl als versionierten Arbeitsstand mit Quellversion beziehungsweise Prüfsummen ablegen. Alte Arbeitsdateien nur zum Vergleich lesen; Widersprüche sichtbar machen.
5. Das führende Prüfergebnis und die Zusammenführung für künftige Atlasbauten festlegen. Neuere belegte Einordnungen dürfen nicht durch ältere Arbeitsstände zurückgesetzt werden. Bei unbekannter Reihenfolge bleibt ein Konflikt zur Klärung offen.
6. Je Gebiet ein führendes Problem und gegebenenfalls weitere Blocker vergeben. Anbindungsstand und technischer Grund sind getrennte Felder. Die späteren Konzepte dürfen dieselbe Kommune nacheinander bearbeiten.

## Abnahme

- Die Liste stimmt für denselben Quellenstand mit der Adminsicht überein; zum analysierten Ausgangsstand sind es 490 eindeutige Gebiets-IDs.
- Kein aktiv angebundenes Gebiet wird als offen aufgeführt. Änderungen seit dem Ausgangsstand werden als Differenz erklärt, statt die Zahl 490 zu erzwingen.
- Gespeicherte Adressen und Originalgründe bleiben erhalten. Zeit- und Herkunftskonflikte sind nachvollziehbar.
- Eine Wiederholung mit denselben Eingaben erzeugt denselben fachlichen Bestand.
- Ein Atlas-Neubau mit älteren Arbeitsdateien kann die festgelegten jüngeren Prüfergebnisse nicht mehr unbemerkt ersetzen.

## Abhängigkeiten und Übergabe

Keine vorherigen Pakete. Die bereinigte Liste ist Eingang für [02 Quellenprofile](02-quellenprofile.md) und alle späteren Fallbearbeitungen. Zahlen verschiedener Problemkonzepte dürfen wegen Mehrfachblockern nicht addiert werden.

## Startauftrag

Setze Konzept 01 um: Erzeuge die aktuelle Arbeitsliste der offenen Website/PDF-Gebiete nach der Adminlogik, sichere Herkunft und Stand der Gründe und verhindere deren Rückstufung durch ältere Suchdateien. Weise Abweichungen vom Ausgangsbestand aus. Verändere dabei keine produktiven Quellen und starte keine Importe.

## Bezug zur Umsetzung

[Admin-Atlas](../../server/integrations/admin-atlas.mjs), [Atlasdaten](../../server/integrations/source-atlas.json), [Quellenkatalog](../../server/integrations/source-catalog.mjs), [Atlasgenerator](../../scripts/dashboard/build.mjs).
