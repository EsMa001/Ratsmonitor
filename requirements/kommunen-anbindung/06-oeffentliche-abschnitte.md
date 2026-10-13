# Öffentliche Sitzungsabschnitte zuverlässig erkennen

Status: Konzept, Umsetzung offen. Reihenfolge: 06. Stand: 13.10.2026. Teil des [Anbindungskonzepts](../anbindung-fehlender-kommunen-konzept.md).

## Problem und betroffene Fälle

Bei **81 gespeicherten Fällen** fand die Prüfung Unterlagen, konnte aber keine eindeutig öffentlichen Tagesordnungspunkte übernehmen. Diese Hauptgründe beweisen weder fehlende öffentliche Daten noch einen Parserfehler. Möglich sind verlorene Überschriften, ungewohnte Tabellen, ein unvollständiger Dokumentabruf oder tatsächlich fehlende Kennzeichnung.

Der vorhandene [Textparser](../../server/integrations/website-text.mjs) erkennt Sitzungen, nummerierte TOPs, öffentliche Abschnitte und Ergebnisse. Er verwirft mehrdeutige Grenzen. Der [Website-Leser](../../server/integrations/website.mjs) berücksichtigt widersprechende Kennzeichnungen in zugehörigen Dokumenten. Unnummerierte kommunale Sitzungsberichte werden zwar als Dokumentart erkannt, erzeugen ohne unterstützte Punktstruktur aber bisher keine Vorgänge. Solche Formate gehören erst nach Bestätigung dazu; ihre Zahl ist unbekannt.

Die Mengen der technischen Konzepte überlappen und dürfen nicht addiert werden. Scans oder fehlgeschlagene Downloads können zugleich den vermeintlich fehlenden Öffentlichkeitsnachweis verursachen.

## Ziel und Abgrenzung

Der Adapter soll öffentliche TOPs in bestätigten Formaten lesen. Für bestätigte unnummerierte Veröffentlichungen wird ausdrücklich definiert, ob ein abgegrenztes öffentliches Sachthema als unterstützter Vorgang übernommen werden kann. Eine TOP-Nummer oder ein Beschluss wird dabei nicht erfunden.

Öffentliche Erreichbarkeit allein genügt nicht. Ungeklärte Öffentlichkeit bleibt ein offener Fall. Dieses Paket erweitert die Erkennung und Aufnahmeprüfung; es erzeugt keine KI-Zusammenfassungen. Dokumentabruf, OCR und gemeinsame Quellen werden über [04](04-dokumentabruf.md), [05](05-scan-pdfs.md) und [07](07-gemeinsame-quellen.md) gelöst.

## Vorgehen

1. Vollständige erreichbare Beispiele aus [01](01-arbeitsliste.md) und [02](02-quellenprofile.md) sichern und manuell markieren: Gemeinde, Gremium, Sitzungstag, öffentlicher Nachweis, Beginn und Ende des Abschnitts sowie zugehörige Punkte. Veröffentlichungsdatum und Sitzungstag getrennt erfassen.
2. Ursache bestimmen. Fehlende Dateien oder Textebene zuerst beheben; nur nachgewiesene Layoutprobleme werden Parseraufträge. Bei tatsächlich fehlendem Nachweis bleibt der Anschluss offen oder geht in ein Lieferkonzept.
3. Einen gemeinsamen Abschnittsindex für HTML und PDF verwenden. Er bewahrt Originalpositionen beziehungsweise Seiten und trennt Dokumentkopf, Tagesordnung, Sachabschnitte und andere Bekanntmachungen. Wiederholte TOP-Titel im Inhaltsverzeichnis und Protokoll dürfen keine falsche Zuordnung auslösen.
4. Bestehende Öffentlichkeitserkennung gezielt je bestätigter Formatfamilie ergänzen. Einladung, Protokoll und spätere Veröffentlichung gemeinsam berücksichtigen; ein widersprechender nichtöffentlicher Nachweis wird nicht durch eine bequemere Quelle überstimmt.
5. Für unnummerierte Sachthemen eine eigene, belegte Abschnittszuordnung und stabile Vorgangskennung definieren. Die Website-Aufnahmeprüfung muss solche ausdrücklich unterstützten Vorgänge akzeptieren können. Der bestehende [TOP-Zuschnitt](../../server/node/ai-local-sources.mjs) kann denselben Index verwenden; die Anbindung benötigt seine spätere Inhaltsaufbereitung nicht.

## Abnahme und Abhängigkeiten

- Für jede ergänzte Formatfamilie stimmen gelieferte Gemeinde, Gremium, Datum und öffentliche Punkte mit markiertem Originalmaterial überein.
- Eine zurückgehaltene Auswahl prüft die Regel außerhalb ihrer Entwicklungsbeispiele. Nichtöffentliche und mehrdeutige Abschnitte werden nicht übernommen.
- Jeder übernommene Abschnitt besitzt Originalverweis, Position und konkreten Öffentlichkeitsbeleg. Unnummerierte Vorgänge erhalten keine erfundene TOP-Nummer.
- Wiederholung beziehungsweise eine korrigierte Veröffentlichung erzeugt keine unbeabsichtigten Dubletten.
- Jede gelöste Kommune durchläuft [03 Produktive Anbindung](03-produktive-anbindung.md); eine verbesserte Parserausgabe allein ist noch kein produktiver Anschluss.

## Direkt verwendbarer Startauftrag

> Setze Konzept 06 für eine anhand echter Unterlagen bestätigte Formatfamilie um. Markiere Referenzbeispiele und zurückgehaltene Prüfdokumente, ergänze Abschnittserkennung und Aufnahmeprüfung und dokumentiere jeden öffentlichen Nachweis. Prüfe gemischte Teile, doppelte Überschriften und gegebenenfalls unnummerierte Sachthemen. Führe erfolgreich geprüfte Kommunen durch Konzept 03. Weite den Parser nicht pauschal auf alle 81 Fälle aus und kontaktiere keine Dritten.
