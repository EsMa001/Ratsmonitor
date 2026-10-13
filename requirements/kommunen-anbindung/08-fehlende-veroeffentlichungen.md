# Fehlende Veröffentlichungen diagnostizieren

Status: Konzept, Umsetzung offen. Reihenfolge: 08. Stand: 13.10.2026. Teil des [Anbindungskonzepts](../anbindung-fehlender-kommunen-konzept.md).

## Problem und Ist

Die Suche kann eine erreichbare Gemeinde-Website finden, ohne im geprüften Zeitraum Sitzungsunterlagen zu entdecken. Das unterscheidet nicht zuverlässig zwischen einer Sitzungspause, einem unvollständig durchsuchten Archiv, einer geänderten Adresse und einer tatsächlich fehlenden Veröffentlichung. Auch eine vorübergehend nicht erreichbare Website oder ein unbrauchbarer RIS-Link belegt keine dauerhafte Quellenlosigkeit.

Der Website-Leser unterstützt Veröffentlichungsseiten, PDF-Dateien, Feeds, Kalender und einige CMS-Ausgänge. Seine Dokument-, Seiten- und Zeitgrenzen können aber einen Teilbestand zurücklassen. Der bisherige Quellenanschluss verlangt erkannte öffentliche TOPs. Ein leerer Zeitraum ist deshalb als Prüfergebnis zu dokumentieren, ohne daraus „keine Quelle vorhanden“ abzuleiten.

## Betroffenheit

**43 der 490 Website/PDF-Gebiete** tragen ausdrücklich den Grund „keine Sitzungsseite oder keine Sitzungsunterlagen im Zeitraum“. Hinzu kommen **einzeln zu diagnostizierende Teile der 27 übrigen Fälle**: insbesondere nicht erreichbare Websites, gespeicherte unbrauchbare Links und nicht erkannte Systeme. Nicht alle 27 gehören automatisch in dieses Arbeitspaket. Ursachen und Folgeschritte können überlappen; die Zahlen werden nicht summiert.

## Ziel

Für jedes bearbeitete Gebiet steht entweder ein belegter, ausführbarer Veröffentlichungsweg fest oder eine nachvollziehbare Diagnose mit Prüfdatum, Suchumfang und nächstem Schritt. Ein leeres Suchergebnis darf einen vorhandenen Zugang nicht verdecken.

## Vorgehen

1. Offizielle Startadresse und Gebietszuständigkeit bestätigen. Weiterleitungen, Domänenumzüge und den Herausgeber der Bekanntmachungen dokumentieren.
2. Zunächst einen bekannten Sitzungstermin als Anker suchen. Das Archiv auf **zwölf Monate** erweitern und Suchbudget, gelesene Archivseiten sowie ausgelassene Dokumente festhalten. Fehlt ein Archiv, diesen Umstand ausdrücklich nennen.
3. Rathaus, Sitzungsbekanntmachungen, Amtsblatt und Kalender prüfen. Ein amtlich benannter Veröffentlichungsort kann auf einer anderen bestätigten Verwaltungsdomain liegen.
4. Bei einem RIS-Link öffentliche Varianten und offizielle Bürgerinfo-Verweise recherchieren: etwa `bis`, `bi`, `public` oder eine neue Anbieteradresse. Ein Anmeldebereich ist ein Diagnosehinweis; eine öffentliche Variante muss durch eine offizielle Verlinkung oder eindeutige Körperschaftsangaben belegt werden.
5. Ergebnis unterscheiden: Sitzungspause, falscher Einstieg, Archivgrenze, vorübergehender Ausfall, Dokumente vorhanden aber nicht lesbar, oder nach dokumentierter Prüfung kein nutzbarer Veröffentlichungsweg. Lesbare Kandidaten gehen in ein Quellenprofil; Scan-, Zuordnungs- und Öffentlichkeitsfragen in ihre eigenen Arbeitspakete.

## Abnahmekriterien

- Alle 43 Ausgangsfälle und die ausgewählten Restfälle haben eine individuelle Diagnose.
- Zeitraum, amtliche Adressen, geprüfte Wege und Grenzen der Prüfung sind nachvollziehbar.
- Ein leerer Zeitraum wird nicht als Nachweis fehlender Quellen verwendet.
- Ein gefundener Weg liefert ein Quellenprofil und durchläuft [03](03-produktive-anbindung.md). Nachgewiesen ungelöste Veröffentlichungslücken gehen mit Belegen an [09](09-datenlieferung.md).

## Abhängigkeiten

[Arbeitsliste](01-arbeitsliste.md), [Quellenprofile](02-quellenprofile.md), [Dokumentabruf](04-dokumentabruf.md), bei Bedarf [gemeinsame Quellen](07-gemeinsame-quellen.md).

## Direkt nutzbarer Startauftrag

> Diagnostiziere zunächst zehn der 43 Gebiete ohne Unterlagen im Prüfzeitraum. Suche je Gebiet den offiziellen Veröffentlichungsort, ein zwölfmonatiges Archiv und öffentliche RIS-Alternativen. Dokumentiere Fundstellen, Grenzen und Ergebnis. Erstelle für gefundene Wege Quellenprofile; leite nur belegte verbleibende Lücken an 09 weiter. Führe die produktive Abnahme aus 03 aus.

## Codequellen

[Website-Suche](../../scripts/source-discovery/website.mjs), [Suchplanung und Prüfergebnisse](../../scripts/source-discovery/website-plan.mjs), [Website-Leser und Grenzen](../../server/integrations/website.mjs), [Feeds und Archivwege](../../server/integrations/website-feeds.mjs), [Einordnung der Gründe](../../scripts/source-discovery/reasons.mjs).
