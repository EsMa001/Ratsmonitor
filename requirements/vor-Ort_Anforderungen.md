# vor Ort - Anforderungen v0.23: Kommunalpolitik in NRW

Stand: 27.09.2026. Version v0.23 ergänzt die Adminzentrale mit Karte, Gebietsauswahl, manuellen Verarbeitungsaufträgen, KI-Agent-Ergebnisimport und Speichernachweisen (Abschnitt 31). Version v0.22 ergänzt die verbindliche Inhaltsvollständigkeit und Übertragung des tatsächlichen Online-Bestands in die lokale Datenbank (Abschnitt 30). Version v0.21 ergänzt gespeicherte KI-Inhaltszusammenfassungen und nachvollziehbare Artikeldaten für den Billerbeck-Test (Abschnitt 29). Version v0.20 trennt das Lesen gespeicherter Auswertungen von der ausschließlich manuell gestarteten Artikelanalyse (Abschnitt 28). Die Performance-Korrekturen aus Abschnitt 27 bleiben erhalten. Die sechs Kartenansichten aus v0.18 sowie Administration und Folgeimporte bleiben erhalten. Dieses Dokument ist die maßgebliche aktuelle Ergänzung zur Stakeholder-Basis v0.3 und zum Anforderungsabgleich v0.4. Bei Widersprüchen gilt v0.23. Bestehende Anforderungs-IDs bleiben erhalten. Frühere Prüfberichte und Studien dokumentieren ihren damaligen, eingefrorenen Stand; sie werden durch den neuen Import nicht rückwirkend verändert.

**Anforderung und Erfüllung sind getrennt:** „Umgesetzt“ bedeutet im Code vorhanden, keine vollständige Produktabnahme. „Teilweise“ bezeichnet eine vorhandene Funktion mit einer benannten Grenze. „Offen“ bezeichnet eine weiterhin geltende, nicht erfüllte Anforderung oder ausstehende Prüfung. Die Aktualisierung v0.20 dokumentiert weiterhin die technische Vorbereitung des regelmäßigen Importbetriebs. Seine dauerhafte Aktivierung und Produktionsabnahme stehen aus. Abweichungen werden nicht durch Abschwächen der Anforderungen verdeckt.

**Lesepfad:** 01–05 Produkt, Funktionen und Gestaltung; 06–07 Datenstand und Abnahme; 08–11 Labels, Zeitbezug und Karte; 12–14 Umsetzung, NRW-Anbindung und Klassifikation; 15 Analysebeispiele; 16 Bedienbarkeit; 17 Abgleich der Implementierung und offene Punkte; 18 Korrekturen und Nachweise aus Arbeitspaket 1; 19 Importbetrieb und Aktivierungsgrenze; 20 zwölf Monate Rückblick; 21 separater Regel-/KI-Labelvergleich; 22 erste zehn neue Kommunen nahe Billerbeck; 23 weitere zwanzig Kommunen und Bestandskennzeichnung; 24 gezielte Nachimporte und Erhalt öffentlicher Tagesordnungspunkte.

## 01 / Ziel und Geltungsbereich

Bürgerinnen und Bürger wählen ihr Gebiet, lesen belegte politische Vorgänge und erkennen, ob ähnliche Sachthemen auch in anderen Kreisen vorkommen. Die Oberfläche bleibt im bestehenden vor-Ort-Design. Die Auswahl ersetzt die frühere Festlegung auf einen einzigen Ort und das frühere generelle Scraping-Verbot.

Billerbeck ist eine Stadt im Kreis Coesfeld. Die Auswahl umfasst alle 396 Städte und Gemeinden sowie 31 Kreise einschließlich Städteregion Aachen in NRW. Kreisfreie Städte erscheinen auf Gemeindeebene und nicht doppelt als Kreis. Bisherige Gebietskennungen und Artikellinks bleiben erhalten. Standard ist Billerbeck. Ein Kreisfeed zeigt die öffentlichen Themen des gewählten Kreises; der Stadtfeed zeigt Stadtvorgänge. Die ursprünglich gewünschte Ergänzung eines Stadtfeeds um ausschließlich stadtbezogene Kreisthemen bleibt eine offene Anforderung (SA-02). Derzeit werden die beiden Ebenen getrennt ausgewählt; ein automatischer Relevanzfilter für den Stadtbezug ist nicht implementiert.

Weiterhin gelten: öffentliche Originalquellen, kurze Kartenansicht mit etwa 45 Wörtern, ausführliche Detailansicht, nachvollziehbarer Prozessstand, verbundene Aktualisierungen eines Vorgangs, WhatsApp-Teilen und Bilder ausschließlich aus Originalunterlagen. Kommentare und Beteiligungsangebote bleiben außerhalb des MVP. Zwölf Monate ersetzen ab v0.12 den bisherigen dreimonatigen rückwirkenden Einstiegsbestand; dies ist keine Entwicklungsfrist. Ältere bereits gespeicherte Artikel bleiben im Archiv.

## 02 / Stakeholder-Anforderungen

### SA-25 / Gebiet auswählen

Bürger können zwischen den 396 NRW-Kommunen und 31 Kreisen / Städteregionen wechseln. Gebiet, Artikelbestand, Filter und kommende Sitzungen gehören stets zusammen. Die URL enthält die Auswahl; ein geteilter Artikellink öffnet den richtigen Vorgang unabhängig vom zuvor gewählten Gebiet.

Abnahme: Alle 427 Gebiete erscheinen mit ausgeschriebenem Namen. Ein Wechsel lädt nur den ausgewählten Bestand. Ein Gebiet ohne Daten zeigt einen erklärten Leerzustand. Billerbeck wird nicht als Kreis bezeichnet.

### SA-26 / Politisches Gedächtnis

Artikel werden dauerhaft mit Gebiet, stabiler ID, Originaltitel, Kurz- und Langfassung, Status, Ereignissen, Dokumentlinks und Herkunft gespeichert. Aktualisierungen überschreiben den bisherigen Stand erst, nachdem dessen Fassung gesichert wurde. Ein fehlgeschlagener oder unvollständiger Import darf vorhandene Artikel nicht löschen.

Abnahme: Wiederholter Import erzeugt keine zweiten Artikel für dieselbe Quelle. Eine geänderte Metadatenfassung ist in der Versionsablage erhalten. Alte Artikel bleiben auffindbar und für Vergleiche verfügbar. Die Versionsablage ist vorerst eine Backend-Funktion, keine zusätzliche Historienoberfläche.

### SA-27 / Über Kreisgrenzen vergleichen

Jeder Artikel zeigt, in welchen und wie vielen anderen NRW-Kreisen ähnliche Themen vorkommen. Aktuelle beziehungsweise offene, frühere beziehungsweise abgeschlossene und zeitlich unklare Vorgänge werden unterschieden. Jeder Treffer führt zum entsprechenden Artikel und dessen Originalquelle.

Abnahme: Zwei ähnliche Artikel desselben Kreises erhöhen die Gesamtzahl nur um eins. Der eigene Kreis wird ausgeschlossen. Stadtartikel erhöhen keinen Kreiszähler. Fehlende Treffer werden als fehlende Treffer im verfügbaren Bestand formuliert, niemals als Beweis, dass ein Thema anderswo nicht behandelt wird.

### SA-28 / Ergebnisse einordnen können

Nutzer erkennen Datenstand, Lücken und Grenzen der automatischen Ähnlichkeit. Die Zuordnung ist ein Recherchehinweis und keine Behauptung über identische Beschlüsse, politische Positionen oder gleiche Zuständigkeiten.

Abnahme: Datenlücken werden unmittelbar beim Vergleich angezeigt. Zu jedem Treffer ist ein sachlicher Zuordnungsgrund vorhanden. Die Methodenerklärung benennt die Zeitregel und die verglichenen Daten.

## 03 / Funktionale Anforderungen

### FA-08 / Konsistente Gebietsauswahl

Startseite und Themen-API akzeptieren ausschließlich die 427 amtlich zugeordneten Gebietskennungen. Standard: billerbeck. Paginierungscursor sind an Gebiet, Statusfilter und Datenrevision gebunden. Bei Gebietswechsel beginnt die Ergebnisliste von vorn. Bestehende Münster-Artikellinks bleiben gültig.

Abnahme: Ein für Steinfurt erzeugter Cursor wird bei einer Coesfeld-Abfrage zurückgewiesen. Kein Nachladen mischt Gebiete. Ungültige API-Parameter liefern einen erklärten Fehler.

### FA-09 / Offizielle Quelle zuerst

Münster und acht weitere Kommunen einschließlich Ochtrup verwenden OParl. Kreis Recklinghausen sowie Südlohn, Haltern am See, Datteln, Waltrop, Herten, Dorsten und Marl verwenden die öffentliche More-Rubin-Portalschnittstelle. Billerbeck, die Kreise Coesfeld, Steinfurt und Warendorf sowie die zehn Kommunen aus Abschnitt 22 und zwölf weitere aus Abschnitt 23 nutzen konfigurierte SessionNet-Adapter für öffentliche Kalender und Tagesordnungen. Borken bleibt wegen HTTP 403 ohne eingelesenen Bestand. Weitere Quellen werden gemäß FA-21/22 einzeln geprüft und angebunden. Die Prüfung eines Hersteller-Standardpfads ist kein vollständiger Nachweis, dass keine andere API existiert.

Abnahme: Methode, Originaladresse, Abrufdatum und Fehler stehen je Gebiet fest. Nichtöffentliche Punkte werden verworfen. HTTP 401/403 wird als Zugangshindernis behandelt. Ein künftig erkannter OParl-Endpunkt wird vor Nutzung korrekt angebunden; bis dahin wird dieser Import angehalten. Keine Umgehung von Anmeldung oder Sperren.

### FA-10 / Nachvollziehbare Ähnlichkeit

Die erste Version vergleicht Originaltitel. Ein gemeinsames konkretes Sachthema aus einer definierten Begriffsliste oder mindestens zwei aussagekräftige Titelbegriffe bei mindestens 60 Prozent Überschneidung der kleineren Begriffsmenge ergeben einen Treffer. Allgemeine Wörter und gemeinsame Kategorien allein reichen nicht.

Abnahme: Allgemeine Überschriften wie Anfragen und Mitteilungen erzeugen keinen Treffer. Ein Treffer nennt Sachthema oder gemeinsame Titelbegriffe. Die Methodenversion wird mitgeliefert. Der Wert ist eine regelbasierte Rangfolge, keine statistische Wahrscheinlichkeit. Ein späterer semantischer Vergleich ist eine mögliche Weiterentwicklung.

### FA-11 / Zeitliche Einordnung und Zählung

Aktuell / offen: Status angekündigt, in Beratung, empfohlen oder vertagt und letzter erfasster Termin innerhalb von 90 Tagen vor oder nach heute. Früher erfasst / abgeschlossen: dokumentierter Beschluss, Ablehnung oder Kenntnisnahme mit vergangenem Termin, oder letzter erfasster Termin vor mehr als 90 Tagen. Sonst: zeitliche Einordnung offen. Die Zeitregel ist eine Produktfestlegung und kein amtlicher Verfahrensstatus.

Abnahme: Ein unklarer jüngerer Status zählt nicht als aktuelle Beratung. Ein weit in der Zukunft liegender Termin zählt nicht als historisch. Jeder Kreis zählt je Gruppe einmal und insgesamt einmal; derselbe Kreis darf in mehreren Gruppen vorkommen. Der Katalog umfasst 31 Kreise einschließlich Städteregion Aachen. Der eigene Kreis wird aus dem Vergleich ausgeschlossen. Die Zahl auswählbarer Kreise wird nicht mit tatsächlich datenführenden Kreisen gleichgesetzt.

### FA-12 / Archiv und Teilimporte

Der laufende Import ergänzt neue Artikel und aktualisiert vorhandene. Bisherige Fassungen werden beim Metadatenwechsel atomar gesichert. Vorhandene Artikel bleiben bei fehlenden Quelleneinträgen erhalten. Vollständigkeit, Importfehler und letzter Datenstand werden separat gespeichert.

Abnahme: Ein Import mit null erreichbaren Artikeln löscht den vorherigen Bestand nicht. Ein gescheiterter Einzelschritt führt zu einem sichtbaren Teilstand. Pro Quelle gelten Zeit-, Größen- und Sitzungslimits; kein unbegrenztes Crawling.

### FA-13 / Qualitätsprüfung

Nach ausdrücklich manuellem Start erzeugte Zusammenfassungen dürfen weiterhin ohne menschliche Vorabfreigabe erscheinen, benötigen aber die bestehenden Beleg- und Plausibilitätsprüfungen. Neue regionale Artikel werden zunächst als Quellenüberblick gekennzeichnet. Die Qualitätsprüfung der Ähnlichkeit muss zusätzlich relevante und irrelevante Treffer über verschiedene Sachthemen und Kreise prüfen.

Abnahme: Keine Bezeichnung als geprüfte KI-Zusammenfassung ohne tatsächliche Prüfung. Vor einem breiten Pilotbetrieb ist eine manuell bewertete Stichprobe mit dokumentierter Treffergenauigkeit, Fehlzuordnungen und Verbesserungsmaßnahmen erforderlich. Verantwortliche Person, Umfang und Qualitätsziel sind organisatorisch noch festzulegen.

## 04 / Datenbank und Schnittstellen

### TA-05 / Gebiete und stabile Identität

Die Artikeltabelle erhält region_id und einen Index für Gebiet plus Aktualisierungsdatum. Neue IDs sind mit dem Gebiet präfixiert und verwenden die amtliche Vorlagen- oder Tagesordnungspunktkennung. Stadt und Kreis bleiben unterschiedliche Quelltypen. Die bestehende Datenbank wird über eine versionierte Migration erweitert.

### TA-06 / Persistente Fassungen

D1 speichert den aktuellen Artikelbestand, frühere Artikelfassungen und den Quellenstand je Gebiet. Die Tabellen heißen topics, article_versions und source_coverage. Metadatenänderung und Sicherung der bisherigen Fassung erfolgen gemeinsam. Die mitgelieferten Quelldateien dienen dem initialen Import und einem ausdrücklich gekennzeichneten Rückfall bei Datenbankausfall.

### TA-07 / Begrenzte Importe

Der gehostete Verwaltungsendpunkt /api/internal/sync ist serverseitig und authentifiziert; seine Sperre verhindert konkurrierende Importe. Die dort unterstützten bisherigen Gebiete werden nacheinander aktualisiert. Der zusätzliche portable NRW-Job nach TA-14 ist ein separater Ausführungsweg und bearbeitet bis zu drei Quellen parallel. Ein automatischer Scheduler ist für keinen der beiden Wege eingerichtet. SessionNet-Anfragen sind auf konfigurierte HTTPS-Quellen begrenzt, auf 20 Sekunden und vier MB pro Antwort sowie maximal 400 Sitzungen je Lauf. Der Eingangsscan umfasst zwölf Monate Rückblick und bereits veröffentlichte Termine des Folgemonats.

### TA-08 / Vergleich aus gespeicherten Artikeln

Vergleiche erfolgen serverseitig aus dem gespeicherten Bestand und sind mit subject-terms-v1 gekennzeichnet. Die Berechnung benötigt keinen externen KI-Schlüssel. API und Detailseite verwenden dieselbe Logik. Es werden keine aktuellen politischen Daten erfunden, um leere Regionen zu füllen.

### TA-09 / Wiederverwendbare API

GET /api/topics?region=coesfeld liefert den regionalen Feed. GET /api/topics/{id} liefert das Artikeldetail. GET /api/topics/{id}/related liefert Vergleichsartikel, Kreismengen je Zeitgruppe, Zuordnungsgründe, Methodenkennung und Abdeckungsinformationen. Interne Dokumentrohtexte und Importgeheimnisse bleiben ausgeschlossen. Unbekannte Artikel liefern HTTP 404.

## 05 / Gestaltung und Website-Abdeckung

### DA-28 / Gebietsauswahl im Kopfbereich

Die bestehende Fira-Sans-Typografie, Schwarz-Weiß-Flächen, kobaltblauer Akzent #2352AD und feine Trennlinien bleiben verbindlich. Die Gebietsauswahl steht vor den Themenfiltern, trägt eine sichtbare Beschriftung und zeigt den vollständigen Namen. Sie ist per Tastatur bedienbar und passt auf schmale Bildschirme. Keine separate Auswahl-Landingpage.

### DA-29 / Vergleich im Artikeldetail

Die Detailseite führt vom Artikelkopf über Verfahrensstand, belegte Eckdaten, Langfassung und Ereignisverlauf zu den Originalunterlagen. Danach folgen thematische Einordnung mit Analyselink, der Kreisvergleich und zuletzt Herkunfts- und Prüfinformationen. Er enthält Gesamtzahl, zwei hervorgehobene Zeitzähler, einen gesonderten Abschnitt für unklare Einordnung, Datenlücken und aufklappbare Kreisgruppen. Treffer zeigen Titel, Termin, Status, Zuordnungsgrund und Originalverweis. Leere Ergebnisse bleiben verständlich. Unterschiede werden nicht ausschließlich durch Farbe vermittelt.

### DA-30 / Quellenstand pro Gebiet

Die Quellenseite zeigt für jedes Gebiet Quelle, Importmethode, Erfassungszeitraum, letzten Abruf, Anzahl gespeicherter Artikel und bekannte Probleme. Eine Übersicht unterscheidet Gebiete mit Artikeln, Gebiete mit konfigurierter Quelle und Gebiete ohne Quelle. Die Artikelzahl bezeichnet den gespeicherten Gesamtbestand, keine garantierte Vollständigkeit des Rückblickzeitraums. Fehlende Daten erscheinen nicht wie eine inhaltliche Nullmeldung. Die Darstellung verwendet dieselben Überschriften, Abstände, Links und Trennlinien wie die Website. Dokumente übernehmen diese Gestaltung mit stabilen Anforderungs-IDs und Seitenzahlen.

| Website-Element | Anforderung | Nachweis |
| --- | --- | --- |
| Gebietsauswahl und Feed | SA-25, FA-08, DA-28 | 427 Gebiete, Suchauswahl, regionaler API-Filter, Cursorprüfung |
| Artikeldetail und Prozess | SA-10/11/13/21, FA-06/07, DA-07 bis DA-16 | Vier Prozessschritte, Kurz-/Langansicht, Verlauf, Quellen und WhatsApp |
| Vergleich je Artikel | SA-27, FA-10/11, DA-29 | Kreisgruppen, Zeitgruppen, Gründe, Originalverweise |
| Quellen- und Fehleranzeige | SA-28, FA-09/12, DA-30 | Abdeckung je Gebiet und Lückenhinweise |
| Dauerhafter Bestand | SA-26, TA-05/06 | Datenbankmigration und Fassungsablage |
| App-fähige Datenschnittstelle | TA-08/09 | Regionale Feed-, Detail- und Vergleichs-API |

## 06 / Datenstand und Grenzen

Der versionierte Bestand umfasst nach Abgleich mit der Zwölf-Monats-Nachladung **24.921 kanonische Artikel aus 43 Gebieten: 39 Kommunen und vier Kreise**. Die zwanzig mit v0.15 ergänzten Kommunen im Münsterland und nördlichen Ruhrgebiet liefern nach dem Folgeimport v0.16 insgesamt 8.993 Artikel; das sind 127 mehr als beim Erstimport. Die Auswahl bleibt bei 427 Gebieten. Stadt und Kreis Coesfeld sowie Stadt und Kreis Warendorf sind getrennte Quellen.

**Nachweisbasis:** data/topics.json, data/regions.json, data/nrw-seed.json und data/history-backfill.json; Auswertung mit scripts/report-expanded.mjs am 27.09.2026. Zusätzlich wurde der tatsächliche Initialimport gegen eine lokale SQLite-Datenbank mit allen Migrationen geprüft: ebenfalls 24.921 kanonische Artikel in 43 Gebieten, unverändert bei erneutem Aufruf aus einem frischen Modul. Dies ist keine Live-Datenbankmessung. Der ausdrücklich gekennzeichnete Ersatzstand bei Datenbankausfall kann kleiner sein als der nachgeladene Datenbankbestand. Zukünftige und undatierte Artikel zählen zum Gesamtbestand, aber nicht zu vergangenen Themenanteilen.

| Gebiet | Artikel | Nachweis |
| --- | ---: | --- |
| Stadt Münster | 2.368 | Bisheriger Bestand einschließlich Nachladung |
| Stadt Billerbeck | 402 | Bisheriger Bestand einschließlich Nachladung |
| Kreis Coesfeld | 372 | Bisheriger Bestand einschließlich Nachladung |
| Kreis Steinfurt | 560 | Bisheriger Bestand einschließlich Nachladung |
| Kreis Warendorf | 302 | Bisheriger Bestand einschließlich Nachladung |
| Kreis Recklinghausen | 289 | Bisheriger Bestand einschließlich Nachladung |
| Stadt Aachen | 1.605 | Bisheriger Bestand einschließlich Nachladung |
| Stadt Castrop-Rauxel | 447 | Bisheriger Bestand einschließlich Nachladung |
| Stadt Emsdetten | 371 | Bisheriger Bestand einschließlich Nachladung |
| Stadt Herford | 495 | Bisheriger Bestand einschließlich Nachladung |
| Stadt Krefeld | 516 | Bisheriger Bestand einschließlich Nachladung |
| Stadt Köln | 4.368 | Bisheriger Bestand einschließlich Nachladung |
| Gemeinde Ladbergen | 158 | Bisheriger Bestand einschließlich Nachladung |
| Gemeinde Nottuln | 363 | Bisheriger Bestand einschließlich Nachladung |
| Gemeinde Havixbeck | 294 | Bisheriger Bestand einschließlich Nachladung |
| Gemeinde Rosendahl | 418 | Bisheriger Bestand einschließlich Nachladung |
| Stadt Coesfeld | 484 | Bisheriger Bestand einschließlich Nachladung |
| Stadt Dülmen | 393 | Bisheriger Bestand einschließlich Nachladung |
| Gemeinde Senden | 450 | Bisheriger Bestand einschließlich Nachladung |
| Stadt Lüdinghausen | 348 | Bisheriger Bestand einschließlich Nachladung |
| Stadt Ahaus | 433 | Bisheriger Bestand einschließlich Nachladung |
| Stadt Olfen | 282 | Bisheriger Bestand einschließlich Nachladung |
| Gemeinde Ascheberg | 210 | Bisheriger Bestand einschließlich Nachladung |
| Gemeinde Nordkirchen | 218 | Neue Anbindung mit Folgeimport v0.16 |
| Stadt Rheine | 894 | Neue Anbindung mit Folgeimport v0.16 |
| Stadt Telgte | 516 | Neue Anbindung mit Folgeimport v0.16 |
| Gemeinde Everswinkel | 203 | Neue Anbindung mit Folgeimport v0.16 |
| Gemeinde Ostbevern | 396 | Neue Anbindung mit Folgeimport v0.16 |
| Stadt Sassenberg | 405 | Neue Anbindung mit Folgeimport v0.16 |
| Gemeinde Südlohn | 176 | Neue Anbindung mit Folgeimport v0.16 |
| Stadt Haltern am See | 257 | Neue Anbindung mit Folgeimport v0.16 |
| Stadt Datteln | 333 | Neue Anbindung mit Folgeimport v0.16 |
| Stadt Waltrop | 292 | Neue Anbindung mit Folgeimport v0.16 |
| Stadt Herten | 521 | Neue Anbindung mit Folgeimport v0.16 |
| Stadt Dorsten | 696 | Neue Anbindung mit Folgeimport v0.16 |
| Stadt Ennigerloh | 617 | Neue Anbindung mit Folgeimport v0.16 |
| Gemeinde Beelen | 216 | Neue Anbindung mit Folgeimport v0.16 |
| Stadt Ochtrup | 489 | Neue Anbindung mit Folgeimport v0.16 |
| Stadt Warendorf | 425 | Neue Anbindung mit Folgeimport v0.16 |
| Stadt Beckum | 498 | Neue Anbindung mit Folgeimport v0.16 |
| Stadt Oelde | 441 | Neue Anbindung mit Folgeimport v0.16 |
| Gemeinde Wadersloh | 396 | Neue Anbindung mit Folgeimport v0.16 |
| Stadt Marl | 1.004 | Neue Anbindung mit Folgeimport v0.16 |
| Gesamt | 24.921 | 43 datenführende Gebiete |

Der [Bericht zu den zwanzig neuen Kommunen](expanded-municipalities-report.md) nennt amtliche Adressen, Artikelzahlen, Zeiträume und gemeldete Fehler; 6 der zwanzig neuen Quellen haben Teilabrufe. Auch fehlerfreie Abrufe beweisen keine Vollständigkeit. Der [Bericht zur ersten Erweiterung um zehn Kommunen](nearby-municipalities-report.md) dokumentiert den Stand v0.14. Frühere Gesamtzahlen von 4.683, 12.253 und 15.928 sind historische Vergleichsstände. Die Website zeigt den verfügbaren Artikelbestand je Gebiet nun auch direkt in der Ortsauswahl. Ein konfigurierter Endpunkt bedeutet keine Datenerfassung.

Noch offen: automatischer regelmäßiger Importbetrieb, laufende KI-Konfiguration, unabhängige Inhaltsstichproben sowie Betreiber- und Finanzierungsfragen. Push-Anmeldung und Versandpfad bestehen für Münster; eine gebietsbezogene Push-Funktion für Billerbeck und weitere Orte ist noch nicht umgesetzt. Ein Wechsel der Gebietsauswahl verändert ein bestehendes Münster-Abonnement nicht. Die Oberfläche muss diese Begrenzung ausdrücklich nennen.

## 07 / Abnahme und nächste Schritte

Der vorhandene Prüfbestand umfasst Statusregeln, API-Paginierung, Bindung von Cursorn an Gebiet und Filter, Modulgrenzen, öffentliche Tagesordnungspunkte, Ähnlichkeitsregeln, Gebiets- und Zeitfilter, Monatszählung und eindeutige IDs. Im letzten Bedienbarkeitsdurchlauf wurden 22 gezielte automatisierte Prüfungen sowie Typprüfung und Produktionsbuild erfolgreich ausgeführt. Der aktuelle Dokumentabgleich prüft Text, Quellenbezüge, Datenzahlen und Export; er ersetzt keinen erneuten vollständigen Anwendungstest.

**Keine pauschale Abnahme:** Ein Test des Kreis-Ausschlusses in der Vergleichsfunktion belegt nicht sämtliche Aufrufwege. Die zuvor dokumentierte Abweichung für Kreisartikel als Ausgangspunkt ist in Arbeitspaket 1 behoben und zusätzlich über die tatsächlichen Repository-Aufrufe geprüft; siehe Abschnitt 18. Browser-, Mobilgeräte- und Screenreader-Prüfungen sind durch den bisherigen Code-Review nicht nachgewiesen.

Für den Pilotbetrieb bleiben reale Folgeimporte und Fassungsarchivierung, unabhängige Stichproben von Zusammenfassungen, Labels und Ähnlichkeiten, Endgeräte-Zustellung von Push sowie Verhalten bei dauerhaft gesperrten Quellen zu prüfen. Verantwortliche, Prüfumfang, Zielwerte und Wiederholungsrhythmus sind noch festzulegen. Die sinkende Quote offener Labels ist kein Ersatz für eine gemessene fachliche Genauigkeit.

## 08 / Neue Funktion: Themenlabels und Entwicklung

Bestätigt am 26.09.2026: Kultur wird von Sport & Freizeit getrennt. Die monatliche Auswertung zählt alle unterschiedlichen Vorgänge auf öffentlichen Tagesordnungen, einschließlich erneut aufgegriffener Vorgänge. Klassifikation, Verteilung, Monatsverlauf und Deutschlandkarte werden auf einer eigenen Seite /analysen umgesetzt. Die bestehende Gebietsauswahl einschließlich Billerbeck bleibt verfügbar.

### SA-29 / Billerbeck gleichberechtigt berücksichtigen

Billerbeck ist als eigenständige Stadt, getrennt vom Kreis Coesfeld, in Gebietsauswahl, Artikelbestand, Klassifikation, Verteilungsansicht und Zeitvergleich zu berücksichtigen. Die neue Statistik umfasst alle eingebundenen Städte und Kreise. Die bestehende Funktion zum Finden ähnlicher Themen in anderen Kreisen bleibt davon getrennt.

Abnahme: Für Billerbeck lassen sich eigene Themenanteile und ein eigener Zeitverlauf anzeigen. Coesfelder Kreisthemen werden nicht ohne ausdrückliche Auswahl als Billerbecker Stadtthemen mitgezählt. Ein fehlender Quellenbestand erscheint als Datenlücke und nicht als Nullaktivität.

### SA-30 / Themen erkennen und vergleichen

Jeder Artikel erhält nachvollziehbare Themenlabels. Nutzer können die Anteile der Themenbereiche für ein ausgewähltes Gebiet und einen Zeitraum sehen und dieselbe Auswertung für andere Gebiete betrachten. Anzahl und prozentualer Anteil werden gemeinsam angezeigt.

Abnahme: Ein Anteil nennt immer Gebiet, Zeitraum, Zähleinheit, Zähler und Nenner. Stadt- und Kreiszuständigkeiten bleiben erkennbar. Die Verteilung beschreibt die Zusammensetzung des erfassten Themenbestands, nicht Budgetanteile, Arbeitszeit oder politische Wichtigkeit.

### SA-31 / Veränderung über die Zeit

Die Website zeigt, wie sich Themenanteile innerhalb eines Gebiets verändern. Zeitintervalle, Datenlücken, nachträgliche Ergänzungen und Änderungen der Klassifikation müssen nachvollziehbar sein. Rückwirkende Auswertungen sind nur für tatsächlich verfügbare Daten zulässig.

Abnahme: Ein ausgewählter Themenbereich lässt sich über mehrere Zeitintervalle verfolgen. Neben Anteilen bleiben absolute Fallzahlen sichtbar. Angefangene Monate werden gekennzeichnet; Monate ohne Daten erscheinen als Lücke. Fehlende Monate werden nicht interpoliert oder mit null gefüllt.

## 09 / Bestätigter Label-Katalog

Umgesetzt sind 13 fachliche Hauptlabels, zwei strukturelle Gruppen und der Zustand Noch nicht eingeordnet, insgesamt 16 Auswertungsgruppen. Genau eine Gruppe bildet das Hauptlabel eines Vorgangs. Weitere erkannte Sachgebiete werden als Zusatzlabels gespeichert. Ein fachlich abgestimmter feiner Unterlabel-Katalog ist weiterhin offen. Die Beispiele sind Abgrenzungshilfen, keine bereits implementierten Unterlabels.

| Hauptlabel | Beispiele | Abgrenzung |
| --- | --- | --- |
| Bildung & Betreuung | Kita, Schule, Ganztag, Weiterbildung | Bildungs- oder Betreuungszweck steht im Vordergrund |
| Bauen & Wohnen | Bauleitplanung, Wohnraum, Baugebiete, öffentliche Gebäude | Räumliche Entwicklung, Baugenehmigung oder Wohnversorgung als Kern |
| Mobilität & Verkehr | Bus, Bahn, Radverkehr, Straßen, Parken | Verkehrsfunktion und Erreichbarkeit |
| Umwelt & Natur | Naturschutz, Gewässer, Abfall, Grünflächen | Umweltqualität und natürliche Lebensgrundlagen |
| Klima & Energie | Wärmeplanung, Erneuerbare, Klimaschutz, Klimaanpassung | Energieversorgung, Emissionen oder Klimafolgen |
| Soziales & Teilhabe | Sozialleistungen, Integration, Inklusion, Jugendhilfe | Unterstützung und gesellschaftliche Teilhabe |
| Gesundheit & Pflege | Pflegeplanung, Gesundheitsversorgung, Prävention | Gesundheitliche und pflegerische Versorgung |
| Wirtschaft & Arbeit | Gewerbe, Standortentwicklung, Beschäftigung, Tourismus | Wirtschaftliche Tätigkeit und Arbeitsplätze |
| Kultur | Museen, Bibliotheken, Theater, Kulturförderung | Kulturelle Angebote und Einrichtungen |
| Sport & Freizeit | Sportvereine, Sportstätten, Schwimmbäder, Spielplätze | Sport- und Freizeitnutzung |
| Sicherheit & Ordnung | Feuerwehr, Katastrophenschutz, Rettungsdienst, Ordnungsrecht | Gefahrenabwehr und öffentliche Sicherheit |
| Finanzen & Haushalt | Gesamthaushalt, Jahresabschluss, Steuern, Verschuldung | Übergreifende Finanzsteuerung; Kosten allein reichen nicht |
| Verwaltung & Digitalisierung | Verwaltungsorganisation, Personal, Bürgerservice, IT | Organisation und Leistungserbringung der Verwaltung |

| Weitere Gruppe | Stabile ID | Bedeutung |
| --- | --- | --- |
| Allgemeine Anfragen & Mitteilungen | allgemein | Generische Punkte ohne belegbares Sachgebiet |
| Sitzungsablauf & Gremienarbeit | sitzung | Formale Sitzungs- und Gremienangelegenheiten |
| Noch nicht eingeordnet | unklar | Fehlende oder widersprüchliche Anhaltspunkte |

Diese drei Gruppen sind keine fachlichen Politikbereiche. Sie bleiben sichtbar und im Nenner der Standardverteilung. Alle 16 stabilen IDs, Namen und Farben stehen in shared/labels.mjs; Katalog labels-v2, Verfahren title-rules-v2.

### FA-14 / Hauptlabel und zusätzliche Labels

Pro Artikel wird genau ein Hauptlabel nach dem zentralen Regelungsgegenstand vergeben. Zusätzliche Sachlabels dürfen Querverbindungen zeigen. Ein Schulneubau kann beispielsweise Bildung & Betreuung erhalten; ein ausdrücklich benanntes Bebauungsplanverfahren gehört zu Bauen & Wohnen. Ein feines Unterlabel wie Schulbau ist eine mögliche spätere Katalogergänzung und derzeit nicht umgesetzt. Mehrdeutige Fälle dürfen nicht allein aufgrund beiläufiger Titelbegriffe entschieden werden; für eine belastbare fachliche Klärung ist der Inhalt der Vorlage maßgeblich.

Umsetzungsstand: Der Regelklassifikator wertet ausschließlich den Originaltitel aus. Der Billerbeck-Test ergänzt eine getrennte KI-Einordnung anhand verfügbarer Originalinhalte (Abschnitt 29); bei fehlendem Sachtext bleibt deren Grundlage ausdrücklich der Titel. Eine flächendeckende Inhaltsanalyse und bestätigte Einzelkorrekturen sind offen. Die aktuelle Einordnung ist deshalb eine Orientierung, keine abschließende Inhaltsprüfung.

Abnahme: Die Standardverteilung summiert sich einschließlich Noch nicht eingeordnet auf 100 Prozent, abgesehen von kenntlich gemachten Rundungsdifferenzen. Zusätzliche Labels erhöhen diese Standardanteile nicht. Eine eigene Mehrfachlabel-Auswertung müsste ausdrücklich erklären, dass ihre Anteile zusammen über 100 Prozent liegen können.

### FA-15 / Fachlicher Gegenstand vor Finanzbezug

Die Einführung von Kita-Beiträgen bleibt im Themenbereich Bildung & Betreuung, auch wenn Gebühren im Mittelpunkt stehen. Finanzen & Haushalt wird für übergreifende Haushaltssteuerung verwendet. Entsprechend führt ein digitaler Schulunterricht nicht automatisch zum Hauptlabel Verwaltung & Digitalisierung. Bei fehlender ausreichender Evidenz bleibt die Zuordnung offen; eine Kategorie darf nicht erzwungen werden.

Abnahme: Der Katalog enthält Definitionen, Positiv- und Gegenbeispiele sowie Regeln für typische Überschneidungen. Dieselbe Regel gilt für Billerbeck, Münster und alle Kreise. Bestätigte Einzelkorrekturen müssen nachvollziehbar gespeichert werden; dieser Korrekturprozess ist noch nicht implementiert. Vorhanden sind Regeln, Gegenbeispiele und versionierte automatische Klassifikationsmetadaten.

## 10 / Auswertung und Zeitbezug

### FA-16 / Eindeutige Zählung

Gezählt werden unterschiedliche politische Vorgänge, nicht einzelne Dokumente, KI-Zusammenfassungen, Importläufe oder Artikelversionen. Ein Vorgang mit mehreren Dokumenten oder mehreren Beratungen zählt innerhalb des ausgewählten Auswertungsintervalls nur einmal. Der Artikel ist die Darstellung eines Vorgangs; verwandte, aber eigenständige amtliche Vorlagen werden nicht allein wegen ihrer Ähnlichkeit zusammengelegt.

Anteil eines Hauptlabels = Anzahl der im Intervall gezählten Vorgänge mit diesem Hauptlabel geteilt durch die Anzahl aller im Intervall gezählten Vorgänge des Gebiets. Noch nicht eingeordnete Vorgänge gehören zum Nenner und erscheinen als eigene Gruppe. Bei Nenner null wird kein Prozentwert berechnet.

Abnahme: Drei Beratungen derselben Vorlage innerhalb eines Monats zählen einmal. Zwei getrennte Vorlagen desselben Hauptlabels zählen zweimal. Quellenfehler dürfen die Statistik nicht unbemerkt als vollständige Erhebung erscheinen lassen.

Umsetzungsstand: Die Zähleinheit ist der kanonische gespeicherte Vorgang. Wiederholte Termine sowie über eindeutige amtliche Beziehungen zusammengeführte IDs zählen einmal. Frühere IDs bleiben als Verweise erhalten und erhöhen keine Zähler. Wo die amtlichen Verknüpfungen fehlen oder widersprüchlich sind, bleiben Einträge getrennt und erhalten einen Hinweis im Detail. Eine vollständige historische Auflösung aller fehlenden Beziehungen ist weiterhin nicht nachgewiesen; FA-30 und TA-17 legen die konservative Behandlung fest.

### FA-17 / Monatliche Themenaktivität

Standard ist eine monatliche Auswertung der Vorgänge, die mindestens einmal auf einer öffentlich dokumentierten Tagesordnung in diesem Monat standen. Maßgeblich ist der Sitzungstermin, nicht der Importzeitpunkt. Die Auswertung behauptet damit nicht, dass jeder Punkt tatsächlich beraten oder beschlossen wurde. Zukunftstermine werden separat als angekündigte Themen behandelt und nicht in vergangene Aktivität gemischt.

Ein Vorgang kann in mehreren Monaten jeweils einmal vorkommen. Für einen Gesamtzeitraum wird er erneut über den gesamten Zeitraum dedupliziert. Deshalb ist die Summe der monatlichen Vorgangszahlen nicht zwangsläufig gleich der Anzahl unterschiedlicher Vorgänge im Gesamtzeitraum. Später importierte Unterlagen werden ihrem tatsächlichen Bezugsmonat zugeordnet. Vorgänge ohne belastbaren Sitzungstermin werden separat ausgewiesen und nicht willkürlich einem Monat zugeordnet.

Bestätigte Auswahl: wiederholt aufgegriffene Themen werden im jeweiligen Monat erneut berücksichtigt. Eine separate Auswertung ausschließlich erstmals veröffentlichter Themen ist in diesem Schritt nicht vorgesehen.

### FA-18 / Verlässliche Vergleiche

Verteilungen verschiedener Gebiete verwenden denselben Zeitraum, dieselbe Zählregel und dieselbe Version des Label-Katalogs. Der Vergleich nennt Quellenabdeckung und Fallzahl. Städte und Kreise werden als unterschiedliche Ebenen kenntlich gemacht; unterschiedliche Aufgaben dürfen nicht als unterschiedliche politische Priorität ausgegeben werden.

Abnahme: Ein Ortswechsel im Analyseformular erhält Zeitraum, Themenlabel und Gebietsebene; der ortsgebundene Vergleichsartikel und seine Beispielfrage werden zurückgesetzt. Die allgemeine Seitennavigation erhält das Gebiet, nicht sämtliche Analysefilter. Kleine Fallzahlen werden sichtbar gemacht. Der Unterschied zwischen zwei Anteilen wird in Prozentpunkten angegeben. Ein Anstieg von 20 auf 30 Prozent wird als plus zehn Prozentpunkte beschrieben.

### TA-10 / Versionierte Klassifikation

Umgesetzt sind stabile Label-IDs und Namen, Abgrenzungsregeln, Katalogversion sowie je Vorgang Hauptlabel, zusätzliche Labels, Zuordnungsgrund, Originaltitel als Beleg, Quelladresse, Methodenversion und Zuordnungszeitpunkt. Ein abgestimmter Unterlabel-Katalog und die Speicherung bestätigter Einzelkorrekturen sind als Erweiterung vorzusehen; ein entsprechender Redaktionsablauf fehlt derzeit. Die Methode title-rules-v2 nutzt eindeutige Sachbegriffe im Originaltitel; mehrdeutige Titel erhalten Noch nicht eingeordnet. Das ist eine konservative Erstklassifikation, keine vollständige semantische Dokumentenanalyse. Katalogversion: labels-v2.

Auswertungen geben Katalogversion, Datenstand und Zeitregel mit aus. Bei geänderten Kategorien wird ein verglichener Zeitraum erst nach ausdrücklichem Betreiberstart einheitlich neu klassifiziert; bis dahin wird ausstehende oder veraltete Einordnung sichtbar ausgewiesen. Unterschiedliche historische Katalogversionen dürfen keinen scheinbaren thematischen Trend erzeugen.

### TA-11 / Aggregation und Prüfung

Die Auswertungs-API liefert pro Gebiet und Intervall absolute Anzahlen, Nenner, Anteile, unbekannte Zuordnungen und Abdeckung. Aggregation und Anzeige nutzen dieselben Regeln. Automatisierte Tests prüfen Mehrfachberatungen, Monatsgrenzen, Datenlücken und konsistente Label-Zählung. Die unabhängige fachliche Stichprobenevaluation aus mehreren Gebieten bleibt vor einem breiten Pilotbetrieb erforderlich; sie ist noch nicht abgeschlossen. Eine Prozentzahl zur KI-Sicherheit wird nur gezeigt, wenn sie methodisch begründet ist.

### DA-31 / Labels im Artikel

Hauptlabels erscheinen als ruhige, beschriftete Kennzeichnungen auf Themenkarten und im Artikeldetail. Sie bleiben optisch von Prozessstatus und Gebietsname unterscheidbar. Zusätzliche Labels dürfen die kurze Kartenansicht nicht überladen. Text bleibt auch ohne Farbwahrnehmung verständlich. Noch nicht eingeordnet wird ausdrücklich angezeigt.

### DA-32 / Verteilung und Verlauf

Vorgesehen sind eine nach Anteilen sortierte horizontale Balkenansicht für ein Gebiet und ein Liniendiagramm für den Zeitverlauf ausgewählter Labels. Gebiet, Zeitraum und Zählregel stehen unmittelbar bei der Grafik. Anzahl und Anteil sind gemeinsam verfügbar; eine Datentabelle bietet dieselben Werte zugänglich an. Labels behalten in den Diagrammen konsistente Farben. Lücken unterbrechen Linien und erhalten keine künstlichen Nullwerte. Die Gestaltung folgt Fira Sans, klarer Schwarz-Weiß-Struktur und den bisherigen Akzenten.

## 11 / Deutschlandkarte und Ortsvergleich

### SA-32 / Themenaufkommen räumlich erkennen

Auf der eigenen Analyseseite können Bürger sehen, wie viele ähnliche Vorgänge in welchen anderen angebundenen Orten vorkommen. Die Deutschlandkarte ordnet die Ergebnisse räumlich ein. Als Orte gelten alle NRW-Städte, Gemeinden und Kreise; ihre Ebenen bleiben gekennzeichnet. Auswertungen sind ausschließlich für tatsächlich verfügbare politische Daten zulässig.

Abnahme: Für ein ausgewähltes Thema werden Trefferzahl, Zahl unterschiedlicher anderer Gebiete, Originalverweise und Datenlage gezeigt. Das Ausgangsgebiet erhöht den Zähler anderer Orte nicht. Billerbeck und Kreis Coesfeld bleiben getrennte Zuständigkeiten. Ein Filter erlaubt nur Städte, nur Kreise oder beide Ebenen.

### FA-19 / Themenbereich und konkreter Artikel

In den Ansichten Themenanteil, Anzahl und Veränderung zeigt die Karte ohne Vergleichsartikel das Aufkommen des ausgewählten Hauptlabels. Mit einem Vergleichsartikel aus dem Ausgangsgebiet werden konkrete Themenähnlichkeiten über die bereits vorhandene Methode subject-terms-v1 gesucht. Eine gemeinsame Kategorie allein genügt im Artikelvergleich nicht. Der Zeitraum begrenzt die gezählten Treffer auf Vorgänge mit Sitzungsterminen innerhalb des Intervalls. Der manuell gewählte Vergleichsartikel darf aus dem gesamten gespeicherten Bestand des Ausgangsgebiets stammen, auch außerhalb dieses Zeitraums. Automatisch angebotene lokale Themenbeispiele nach FA-28 stammen dagegen aus dem gewählten Zeitraum.

Abnahme: Die Oberfläche benennt, ob gleiche Hauptlabels oder ähnliche konkrete Themen gezählt werden. Der Vergleichsartikel ist auswählbar; Artikeldetails verlinken auf die passende Analyseseite. Treffer sind bis zum lokalen Artikel und zur Originalquelle nachvollziehbar.

### FA-20 / Farbskala und Datenlücken

In der Standardansicht Themenanteil entspricht die Farbintensität der Flächen dem Anteil passender Vorgänge am gesamten erfassten Vorgangsbestand desselben Gebiets und Zeitraums. Anzahl und Nenner werden zusätzlich angezeigt. Die Skala ist fest: null, größer null bis zehn Prozent, über zehn bis 25, über 25 bis 50 sowie über 50 Prozent. Ohne Nenner erfolgt keine Prozentberechnung.

Abnahme: Null Treffer bei vorhandenem Bestand, angebundene Gebiete ohne Daten und nicht angebundene Gebiete sind unterscheidbar. Unvollständige Quellenstände werden im Detail und in der Tabelle ausgewiesen. Die Darstellung erlaubt keine Aussage über Einwohneranteile, Ausgaben oder politische Priorität.

### DA-33 / Eigene Analyseseite

Die vierteilige Hauptnavigation führt zu Themen, Analysen, Mitteilungen und Quellen. Auf /analysen folgen auf einen kompakten Einstieg die Basisfilter Ort und Zeitraum sowie aufklappbare Vergleichsoptionen für Themenlabel, Gebietsebene und konkreten Artikel. Sprunglinks erschließen die Auswertungen. Beispielfragen liefern direkte Antworten; konkrete Artikelbeispiele und Zählerklärung sind bei Nichtbedarf eingeklappt. Es folgen Gesamtverteilung, Einzelthemenverlauf, Monatsmix mit Veränderungen sowie Karte und Treffertabelle. Verteilung und Einzelverlauf stehen auf großen Bildschirmen nebeneinander, mobil untereinander. DA-38 bis DA-43 präzisieren Aufbau und Bedienung.

### DA-34 / Zugängliche Deutschland-Heatmap

Die Karte zeigt Deutschland und bietet einen vergrößerten Ausschnitt der erfassten Region. Auswählbare Flächen liefern Gebietsname, Ebene, Trefferzahl, Nenner, Anteil und Datenlage. Dieselben Gebiete sind über eine per Tastatur bedienbare Suchauswahl und dieselben Zahlen in einer Tabelle erreichbar. Die Suchauswahl ermöglicht dieselbe Gebietsauswahl per Tastatur. Eine sichtbare, zur gewählten Kartenansicht passende Legende erklärt Skala und fehlende Daten. Ansichtsspezifische Werte stehen in der Wertetabelle; die themenbezogene Trefferliste bleibt separat.

Abnahme: Die Deutschlandansicht erzeugt keinen Eindruck einer bundesweit vollständigen politischen Datenerhebung. Nur die tatsächlich angebundenen Gebiete werden thematisch eingefärbt. Die kleine Fläche Billerbecks bleibt über NRW-Ansicht und Gebietssuche erreichbar.

### TA-12 / Amtliche Geometrien und Quellenangabe

Die Karte verwendet lokal gespeicherte amtliche BKG-Geometrien: VG2500 für Länder und Kreise, VG250 für alle 396 NRW-Kommunen. VG2500-Grenzstand: 31.12.2024; Abruf 26.09.2026. Quelle, Lizenz, Abrufstand und Veränderung durch Projektion und Einfärbung bleiben dokumentiert. Die Karte ruft zur Laufzeit keinen externen Kartendienst auf.

Quelle: [BKG VG2500](https://gdz.bkg.bund.de/index.php/default/wfs-verwaltungsgebiete-1-2-500-000-stand-31-12-wfs-vg2500.html). Quellenvermerk: © BKG (2026), [dl-de/by-2-0](https://www.govdata.de/dl-de/by-2-0); [Datenquellen](https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf). Die politischen Daten stammen weiterhin aus den jeweils genannten Ratsinformationssystemen.

### TA-13 / Gemeinsame Analyse-API

GET /api/analytics liefert Gesamtverteilung, Monatswerte einschließlich aller 16 Gruppen, monthlyComparison für den ersten und letzten befüllten Monat, Gebietsvergleiche einschließlich offener Labels, führender Sachgebiete und Abschnittsvergleichen, die gemeinsamen comparisonPeriods der Karte, Trefferbelege, verfügbare lokale Vergleichsartikel, konkrete Sachbegriffe aus Originaltiteln, Datenlage und Methodenkennungen. Parameter: region, from, to, label, level und optional topic. example speichert ausschließlich die Beispielfrage der Oberfläche und ist kein fachlicher API-Filter.

Standardwerte: Billerbeck, Bildung & Betreuung und alle Gebietsebenen. Der Zeitraum beginnt am ersten Tag des elf Monate zurückliegenden Kalendermonats und endet heute in der Zeitzone Europe/Berlin. Das ist vom rollierenden zwölfmonatigen Importfenster zu unterscheiden. Gültige Datumswerte müssen geordnet sein, dürfen nicht nach heute reichen und höchstens 1.098 Tage auseinanderliegen. Unbekannte Gebiete, Labels, Ebenen sowie fremde Vergleichsartikel werden zurückgewiesen.

Das Themenlabel steuert den Einzelverlauf sowie Themenanteil, Anzahl und Veränderung auf der Karte ohne Artikelvergleich. Ein konkreter Artikel steuert stattdessen die Ähnlichkeitssuche in diesen drei Kartenansichten. Häufigstes Sachgebiet, offene Labels und Datenabdeckung verwenden stets alle Vorgänge je Gebiet im Zeitraum. Gesamtverteilung und Monatsmix enthalten stets alle Gruppen des Ausgangsgebiets. Alle Zeitvergleiche verwenden dieselbe aktuelle Label-Methode. Ein Datenbankausfall wird über storageAvailable kenntlich gemacht; mitgelieferte Importdateien dienen als Rückfallbestand.

## 12 / Umsetzungsstand und Grenzen

Implementiert: 13 fachliche Hauptlabels, zwei strukturelle Gruppen und offene Einordnung, dauerhafte Klassifikationsmetadaten, eigene Analyseseite, Monatszählung gespeicherter Vorgangs-IDs, Deutschland- und NRW-Karte mit Ebenenauswahl, feste Anteilsskala, Themenbereichs- und Artikelvergleich, fünf Beispielfragen, konkrete lokale Themenbeispiele, vollständiger Monatsmix und Tabellenalternativen. Kultur und Sport & Freizeit sind getrennt. Die Bedienbarkeitskorrekturen aus dem unabhängigen Code-Review sind in Website v14 enthalten.

Die manuell gestartete regelbasierte Einordnung basiert zunächst auf Originaltiteln. Allgemeine Titel wie Anfragen oder Verschiedenes werden als Allgemeine Anfragen & Mitteilungen gekennzeichnet. Sitzungsformalitäten bilden die Gruppe Sitzungsablauf & Gremienarbeit. Mehrdeutige Querschnittsthemen bleiben offen. Zusätzliche erkannte Sachgebiete werden als Metadaten gespeichert; ein redaktionell abgestimmter feiner Unterlabel-Katalog ist noch offen. Die Verteilungen sind deshalb als erster Analysebestand zu lesen. Ohne zusätzliche Quellanbindungen entsteht keine deutschlandweite Themenabdeckung. Borken bleibt wegen der Zugangssperre eine Datenlücke.

Automatische fachliche Tests prüfen die Trennung von Kultur und Sport, thematischen Vorrang vor Finanzbezug, offene Mehrdeutigkeit, Deduplizierung pro Monat und Gesamtzeitraum, Zukunfts- und Datumsfilter, Ausschluss des Ausgangsgebiets sowie den Unterschied zwischen Hauptlabel- und Artikelvergleich. Die Datenbankaktualisierung der Klassifikation wird auf Erhalt vorhandener Artikelfelder geprüft. Typprüfung und produktiver Build müssen vor Veröffentlichung erfolgreich sein. Eine visuelle Prüfung im Browser, auf realen Mobilgeräten und mit assistiven Technologien ist durch die vorliegenden Nachweise nicht abgedeckt; siehe Abschnitte 16 und 17.


## 13 / Erweiterung auf alle Kommunen in NRW

### SA-33 / Landesweiter Gebietskatalog

Die Anwendung bietet 396 Städte und Gemeinden sowie 31 Kreise einschließlich Städteregion Aachen an. Die amtlichen Gemeindeschlüssel, ausgeschriebenen Namen, Gebietstypen und Beziehungen zum übergeordneten Kreis sind gespeichert. Billerbeck bleibt Standard. Eine Kommune ohne verfügbaren Artikelbestand ist auswählbar und zeigt einen verständlichen Leerzustand.

Abnahme: 427 eindeutige Gebietskennungen; 396 Einträge auf Gemeindeebene, 31 auf Kreisebene. Jede kreisangehörige Gemeinde ist genau ihrem Kreis zugeordnet. Die 22 kreisfreien Städte haben keinen Kreis-Elterneintrag. Bestehende Links nach Billerbeck, Münster und in die bisherigen fünf Kreise funktionieren weiterhin.

### FA-21 / Quellenanbindung ist ein eigener Status

Gebietskatalog, gefundene Datenquelle, Abrufversuch und tatsächlich eingelesener politischer Bestand sind unterschiedliche Zustände. Eine im OParl-Verzeichnis gefundene Adresse ist nur ein Quellenkandidat. Sie wird erst nach Prüfung des Systems, der zuständigen Körperschaft und der öffentlichen Inhalte als datenführend behandelt. Die Körperschaft wird über den amtlichen Gebietsschlüssel oder, wenn dieser fehlt, über einen eindeutig passenden Namen zugeordnet. Stadt und gleichnamiger Kreis dürfen nicht verwechselt werden. Mehrdeutige, gelöschte oder widersprüchlich zugeordnete Körperschaften werden abgewiesen; verlinkte Körperschaftsobjekte werden vor der Auswahl aufgelöst. Nichtöffentliche oder gelöschte Einträge werden ausgeschlossen. Der Öffentlichkeitsnachweis stammt entweder aus dem Kennzeichen des Tagesordnungspunkts oder aus einem ausdrücklich bezeichneten öffentlichen Abschnitt der geordneten Originaltagesordnung. Nichtöffentliche und unklare Abschnittsgrenzen beenden diese Zuordnung; der Nachweis wird am Ereignis gespeichert.

Abnahme: Ein neuer Gebietseintrag erzeugt weder Artikel noch Prozentwerte. Ein gescheiterter Abruf bleibt sichtbar. Die Quellenseite nennt die konfigurierte Adresse, die Methode, den tatsächlichen Stand und die bekannten Fehler. Ein fehlender Importzeitpunkt wird nicht durch das aktuelle Datum ersetzt. Eine Quellenlücke erscheint nicht als politischer Stillstand.

### FA-22 / API zuerst, gezielter Scraper als Rückfall

Für neue NRW-Quellen hat eine nutzbare offizielle Schnittstelle Vorrang. Der generische OParl-Adapter verarbeitet System, Körperschaft, Sitzungen, Tagesordnungspunkte, Beratungen, Vorlagen und Dokumentverweise. Bei fehlender nutzbarer API wird ein zum öffentlichen Portal passender Scraper konfiguriert und geprüft. Der vorhandene SessionNet-Scraper ist kein Universaladapter für alle Hersteller.

Abnahme: Nur konfigurierte HTTPS-Quellen sind abrufbar. Verlinkungen auf andere Hosts werden nicht ungeprüft verfolgt. 401/403 lösen keinen Versuch aus, Zugangssperren zu umgehen. Fehlende Adapter und nicht bestätigte URLs bleiben offene Anbindungen. Ein Import darf bei Fehlern vorhandene Artikel nicht löschen. Ältere Ereignisse und Dokumentverweise bleiben bei begrenzten Folgeimporten erhalten. Ein Abruf ohne Artikel erhält den letzten erfolgreichen Datenstand und nennt den fehlgeschlagenen Versuch separat.

### TA-14 / Import unabhängig vom Webhosting

Der zusätzliche NRW-Import läuft als eigenständiger Node-Job und verwendet keine Cloudflare- oder UI-Abhängigkeiten. Quellenkonfiguration, Gebietskatalog und Datenzugriffslogik bleiben getrennt. Ein Lauf kann auf einzelne Gebietskennungen begrenzt werden. Ergebnisse werden je Quelle gespeichert und zu einem überprüfbaren Erstbestand zusammengeführt. Die Website speichert den importierten Bestand weiterhin in ihrer vorhandenen D1-Datenbank. Neuere Exporte aktualisieren bestehende Artikel mit atomarer Sicherung der bisherigen Fassung. Ältere Exporte überschreiben weder Artikel noch neuere Quellenstände. Ein Export aus einem frischen Checkout behält bereits gespeicherte Quellenbestände bei, wenn lokale Import-Zwischendateien fehlen.

Abnahme: Ausführung über node scripts/import-nrw.mjs, optional mit Gebietskennungen. Grenzen: drei parallele Quellen, 350 Anfragen je Quelle, standardmäßig sechs Listenseiten (bei einzeln bestätigter Quellenkonfiguration maximal 24), fünf Minuten Laufzeitbudget je Quelle, bis zu 55 Sekunden je Antwort innerhalb des verbleibenden Quellenbudgets und standardmäßig höchstens 5.000.000 Zeichen im gelesenen JSON-Antworttext (bestätigte Ausnahme Ochtrup: 7.000.000, siehe TA-23). Die Zeichenprüfung ist kein hartes Byte- oder Streaming-Speicherlimit. Ein begrenzter Scan vom Ende der Sitzungsliste wird als Teilstand markiert. Vorhandene Artikel bleiben bei Teilimporten erhalten. Die zukünftige Übernahme in ein eigenes Repository benötigt keine Änderung der fachlichen Importregeln; eine andere Web-Datenbank benötigt einen entsprechenden Persistenzadapter.

### DA-35 / Suchauswahl für 427 Gebiete

Die Gebietsauswahl ist ein beschriftetes Suchfeld mit aufklappbaren Treffern, Suche nach Name und amtlichem Schlüssel, erkennbarem Auswahlzustand und Tastaturbedienung. Gemeinde und gleichnamiger Kreis bleiben unterscheidbar. Die Auswahl wird in Feed, Analyse und Karteninspektor konsistent verwendet. 427 gleichzeitig sichtbare Auswahlknöpfe sind nicht vorgesehen.

Abnahme: Billerbeck, Münster und beliebige neue Gemeinden sind ohne lange Scrollstrecke auffindbar. Die Auswahl passt auf Mobilbildschirme. Gebietswechsel setzt feedbezogene Paginierung zurück. Auf der Analyse bleiben Zeitraum und Themenfilter erhalten; ein Vergleichsartikel des vorherigen Gebiets wird zurückgesetzt.

### DA-36 / NRW-Karte und lesbare Ergebnistabelle

Die Karte bietet eine NRW-Ansicht sowie die Deutschlandübersicht. Gemeinde- und Kreisflächen werden auf getrennten Ebenen dargestellt, damit sie sich nicht verdecken. Graue Flächen stehen für noch nicht angebundene Gebiete, Schraffur für konfigurierte Quellen ohne auswertbaren Bestand und die feste Farbskala für tatsächliche Themenanteile. Der Inspektor zeigt zusätzlich Namen, Ebene, Anzahl, Nenner, Anteil und Datenlage.

Abnahme: Keine Beschriftung aller 396 kleinen Flächen gleichzeitig. Dasselbe Gebiet ist über die Suchauswahl erreichbar. Die Ergebnistabelle zeigt Gebiete mit auswertbarem Bestand; ein Hinweis nennt die Anzahl weiterer Gebiete ohne auswertbare Daten und führt zum Quellenverzeichnis. Fehlende Daten werden nicht in Prozentwerte umgewandelt.

### TA-15 / Reproduzierbarer amtlicher Katalog

Der NRW-Katalog und die Gemeindegeometrien stammen aus dem BKG-WFS VG250 mit Landesfilter 05. Kreise und Länder stammen aus VG2500. Abrufdatum: 26.09.2026. Der Datensatz behält seine amtlichen Schlüssel. Kartengeometrien werden für die Bildschirmdarstellung vereinfacht; der Lizenz- und Quellenvermerk bleibt erhalten. Ein Skript lädt die öffentlichen Ausgangsdaten, ein weiteres erzeugt Katalog, Quellenkandidaten und Kartenflächen.

Abnahme: Automatische Prüfung der Gebietszahl, Eindeutigkeit der IDs und amtlichen Schlüssel, Kreiszuordnung und Geometrien für jedes Gebiet. Keine externen Kartenabrufe im Browser. Die Darstellung behauptet keine flächendeckende politische Datenabdeckung in NRW oder Deutschland.

### Umsetzungsstand dieser Erweiterung

Implementiert sind der vollständige NRW-Gebietskatalog, Suchauswahl, NRW-Kartenebenen, die Anpassung von Feed und Analyse, explizite Leerzustände, persistente Ablage für NRW-Importe sowie ein unabhängig ausführbarer OParl-Job. 57 zusätzliche OParl-Adressen sind als Quellenkandidaten konfiguriert. Mehrere Abrufe scheitern an Zeitüberschreitungen, veralteten Adressen oder Zugangshindernissen. Der konkrete Importstand wird auf der Website je Gebiet angezeigt. Der aktuelle, abgeglichene Bestand umfasst 24.921 kanonische Artikel; die Aufteilung und Grenzen stehen in Abschnitt 06. Neben den OParl-Kandidaten sind die bestätigten zusätzlichen Quellen aus Abschnitt 22 und 23 angebunden.

Noch nicht erreicht ist eine flächendeckende Erfassung der Artikel aller 396 Kommunen. Dafür müssen weitere Quellen ermittelt, Herstelleradapter geprüft und fehlgeschlagene Schnittstellen geklärt werden. Der regelmäßige Hintergrundimport bleibt unkonfiguriert. Diese Grenzen sind Teil des veröffentlichten Produktstands; der vollständige Gebietskatalog darf nicht als abgeschlossene landesweite Datenanbindung beworben werden.


## 14 / Präzisere Einordnung ohne Scheingenauigkeit

### FA-26 / Fachgebiete und strukturelle Gruppen

Die 13 fachlichen Hauptlabels bleiben erhalten. Hinzu kommen zwei ausdrücklich nicht fachliche Gruppen: Allgemeine Anfragen & Mitteilungen (allgemein) für generische Tagesordnungspunkte und Sitzungsablauf & Gremienarbeit (sitzung) für formale Punkte. Noch nicht eingeordnet bleibt für fehlende oder widersprüchliche Anhaltspunkte bestehen. Eine allgemeine Mitteilung wird nicht allein aufgrund des zuständigen Ausschusses zu einem Sachthema.

### TA-16 / Nachvollziehbare Regeln und Aktualisierung

Katalog labels-v2 und Methode title-rules-v2 erweitern die Titelregeln um kommunale Fachbegriffe, übliche Abkürzungen und eindeutige zusammengesetzte Wörter. Angehängte Namen von Fragestellern dürfen keine Sachgebietstreffer auslösen. Explizite Planverfahren haben Vorrang vor beiläufigen Fachbegriffen; Mehrdeutigkeit wird nicht durch eine beliebige Ersttrefferregel aufgelöst. Der Originaltitel bleibt als Beleg erhalten. API, Oberfläche, Import und persistierte Klassifikationen verwenden dieselbe Methode. Die bestehende versionierte Nachklassifikation aktualisiert vorhandene Klassifikationen beim nächsten Zugriff, ohne das Datenbankschema im Request zu verändern.

### DA-37 / Verständliche Verteilung

Die Methodenerklärung nennt 13 Sachgebiete, zwei strukturelle Gruppen und offene Einordnungen. Alle Vorgänge bleiben im Nenner der Prozentanteile. Die strukturellen Gruppen dürfen nicht als inhaltliche Politikschwerpunkte oder als nachgewiesene Themenähnlichkeit dargestellt werden. Eine niedrigere offene Quote ist kein Nachweis höherer Klassifikationsgenauigkeit.

### QA-05 / Regressionsprüfung und Bestandsvergleich

Vor Veröffentlichung sind bekannte Fehlklassifikationen und Gegenbeispiele zu prüfen: Personennamen, Transport gegenüber Sport, Straßennamen gegenüber Friedhöfen, mehrere Sachgebiete, allgemeine Überschriften gegenüber inhaltlichen Anfragen sowie Planverfahren. Bestandsvergleiche verwenden identische Vorgänge und Zeitfilter. Anzahl, Datenstand und Anteil struktureller Gruppen sind auszuweisen. Der Prüfbericht requirements/label-evaluation-v2.md dokumentiert die Messung. Titelregeln ersetzen weiterhin keine semantische Analyse der vollständigen Dokumente; verbleibende unklare Projektbezeichnungen dürfen nicht geraten werden.

## 15 / Analysebeispiele und vollständiger Monatsmix

Diese Anforderungen übernehmen die bisherigen Analyse-Ergänzungen ohne neue Zählmethodik. Alle Beispiele verwenden die vorhandenen Daten und erklären ihre Aussagegrenzen.

### FA-27 / Fünf direkt nutzbare Beispielfragen

Auf der Analyseseite lassen sich fünf Fragen auswählen: häufigste Sachgebiete, Veränderung von Anteilen, Auftreten eines Themenfelds in anderen Orten, ähnliche konkrete Vorhaben und Belastbarkeit der Datengrundlage. Jede Frage zeigt eine berechnete Antwort sowie einen Sprung zur passenden Verteilung, Monatstabelle, Karte oder Methodenerklärung. Antworten verwenden denselben gefilterten Datenbestand wie die vorhandenen Diagramme.

Ort, Zeitraum und Gebietsebene bleiben erhalten. Der Schwerpunktvergleich wählt das häufigste fachliche Label; allgemeine, formale und offene Einordnungen sind keine fachlichen Spitzenreiter. Alle bleiben im Nenner. Gleichstände werden genannt. Zeit- und Ortsvergleich verwenden das gewählte Label. Allgemeine Beispiele entfernen einen zuvor gewählten Artikelvergleich. Das konkrete Beispiel verwendet einen Artikel aus dem gewählten Zeitraum mit erkennbarem Sachthema. Ohne geeigneten Artikel ist es als nicht verfügbar zu kennzeichnen. Es wird kein Beispiel erfunden oder aus einem anderen Ort eingesetzt.

### DA-38 / Fragen und Antworten im bestehenden Design

Fünf nummerierte, beschriftete Links bilden den Einstieg. Die aktive Frage ist durch Farbe und aria-current gekennzeichnet. Darunter stehen Ergebnis, Bezugsgrößen, Grenze der Aussage und Detailverweis. Desktop: fünf nebeneinander liegende Fragen; Mobil: untereinander, Antwort darunter. Gestaltung folgt Fira Sans, Schwarz/Weiß, Blau #2352AD und feinen Trennlinien. Bedienelemente sind per Tastatur erreichbar und haben einen sichtbaren Fokus. Die Frage wird in der URL gespeichert; Filter können anschließend angepasst werden.

### QA-06 / Keine Schlussfolgerungen jenseits der Daten

Vorgangshäufigkeit bedeutet weder Budgetanteil noch politische Bedeutung. Monatsdifferenzen werden in Prozentpunkten mit Zähler und Nenner ausgewiesen; verglichen werden erster und letzter Monat mit Daten. Lücken sind keine Nullwerte. Teilmonate, unterschiedliche Quellenabdeckung und kleine Bestände begrenzen den Vergleich. Bei weniger als zwei befüllten Monaten gibt es keine Differenzaussage. Ein solcher Vergleich belegt keinen gesicherten politischen Trend.

Im Ortsvergleich werden Kommunen und Kreise getrennt gezählt. Es gibt keine behauptete Repräsentativität für NRW, keine Einwohnerquote und kein Leistungsranking. Ähnlichkeit bedeutet nicht identische Maßnahmen oder Beschlüsse. Der Datenlage-Check unterscheidet fachliche Hauptlabels, strukturelle Gruppen und offene Einordnungen und verweist gesondert auf die Quellenvollständigkeit. Tests prüfen Filtererhalt, Auswahlgrenzen, Datenlücken und leere Bestände.

### FA-28 / Konkrete Themen aus dem gewählten Bestand

Zusätzlich zu den fünf Fragen stehen konkrete, datenabhängige Beispiele zur Auswahl: etwa Wärmeplanung, Kita-Beiträge oder Radverkehr, soweit entsprechende Sachbegriffe im Originaltitel der ausgewählten lokalen Vorgänge erkannt wurden. Die Analyse-API liefert diese Sachthemen aus dem Originaltitel; gekürzte Anzeigetitel sind kein Ersatzbeleg. Zukunftstermine, fremde Gebiete und Vorgänge außerhalb des gewählten Zeitraums erzeugen keine lokalen Beispiele.

Je Sachthema nennt die Oberfläche die Anzahl unterschiedlicher lokaler Vorgangs-IDs und einen konkreten Vergleichsartikel. Ein Vorgang kann mehreren Sachthemen angehören; die Zahlen werden daher nicht zu einer Themenverteilung addiert. Die lokale Anzahl ist ausdrücklich von der Anzahl ähnlicher Vorgänge andernorts zu unterscheiden. Beim Öffnen werden Ort, Zeitraum und Gebietsebene beibehalten und die bestehende Artikelsuche nach ähnlichen Themen verwendet. Ein bereits ausgewählter lokaler Artikel bleibt beim erneuten Aufruf seines Beispiels erhalten.

### DA-39 / Konkrete Beispiele und schneller Themenwechsel

Der Abschnitt konkreter Beispiele ist außerhalb der Frage nach ähnlichen Vorhaben zunächst eingeklappt. Bis zu sechs konkrete Beispiele werden als zweispaltige Karten auf größeren Bildschirmen und untereinander auf kleinen Bildschirmen dargestellt. Weitere Sachthemen sind aufklappbar. Aktive Artikelbeispiele stehen zuerst, danach wird nach lokaler Vorgangsanzahl und Themenname sortiert. Ohne Belege erscheint ein Leerzustand. Eine gekürzte Kartendarstellung ersetzt nicht den vollständigen Titel in der Analyseantwort.

Zeit- und Ortsvergleich bieten direkt auswählbare Sachgebiete mit ihrer jeweiligen lokalen Vorgangsanzahl. Es werden nur fachliche Labels mit Vorgängen angeboten. Ein Wechsel beendet den bisherigen Artikelvergleich und erhält die übrigen Filter. Hinweise und Originalquellen bleiben in der Detailauswertung verfügbar.

### FA-29 / Themenmix und Änderungen zwischen Monaten

Die Analyseseite zeigt je Monat die Verteilung aller Hauptlabels einschließlich struktureller Gruppen und offener Einordnungen. Derselbe Vorgang zählt pro Monat einmal, auch bei mehreren Sitzungsterminen. Wiederholtes Auftreten in verschiedenen Monaten ist zulässig. Bezugsgröße sind alle im jeweiligen Monat und gewählten Zeitraum erfassten Vorgänge. Jeder befüllte Monat ergibt zusammen 100 Prozent; Monate ohne Vorgänge haben keine Anteile.

Die bis zu fünf größten absoluten Veränderungen fachlicher Anteile zwischen dem ersten und letzten befüllten Monat werden in Prozentpunkten mit Zählern und Nennern ausgewiesen. Strukturelle Gruppen und offene Einordnungen werden nicht als fachliche Veränderungsspitzen geführt, bleiben aber in allen Nennern und vollständigen Tabellen enthalten. Gleiche Anteile erzeugen keine Änderungsspitze. Für weniger als zwei befüllte Monate ist kein Monatsvergleich möglich.

### DA-40 / Monatsbalken und zugängliche Tabellen

Je Monat gibt es einen horizontalen, auf 100 Prozent normierten gestapelten Balken in den bestehenden Labelfarben. Monatsname, Vorgangsanzahl und Teilstand stehen sichtbar am Balken. Fehlende Monate werden als Lücke dargestellt. Die Legende nennt alle im Zeitraum vorkommenden Labels und erlaubt deren Auswahl für die bestehende Einzelthemenanalyse; dadurch werden keine Gruppen aus der Verteilung entfernt. Eine vollständige aufklappbare Tabelle nennt Anzahl und Anteil jedes Labels in jedem Monat. Breite Tabellen scrollen innerhalb der Seite und sind mit der Tastatur erreichbar. Mobil bleiben Monatslabel und Balken lesbar untereinander angeordnet.

### QA-07 / Monatsdifferenz ist keine Trendaussage

Anfang und Ende der tatsächlich ausgewählten Monatsabschnitte, ihre Vorgangsanzahlen und dazwischen liegende Datenlücken werden angegeben. Teilmonate, Quellenlücken und kleine Bestände begrenzen die Interpretation. Ein Anteil kann wachsen, obwohl seine Vorgangsanzahl gleich bleibt oder sinkt, wenn sich andere Sachgebiete verändern. Die Oberfläche darf daraus weder politische Prioritäten noch statistisch gesicherte Trends ableiten. Tests prüfen Summen, Mehrfachtermine, fehlende Monate, begrenzte Zeiträume und den Ausschluss struktureller Gruppen aus fachlichen Veränderungsspitzen.

## 16 / Bedienbarkeit und Orientierung

Grundlage ist der unabhängige Code-Review vom 26.09.2026 und seine zweite Prüfung nach der Überarbeitung. Geprüft wurden Komponenten, CSS, Navigation und Zustandswechsel. Der Review bestätigt keinen visuellen Browser- oder Screenreader-Test. Der vollständige Prüfbericht bleibt unter requirements/ux-review-2026-09-26.md erhalten; verbindlich sind die folgenden Anforderungen in diesem Hauptdokument.

### DA-41 / Durchgängige Gebietsorientierung

Navigation und kontextbezogene Quellenlinks erhalten das ausgewählte Gebiet. Die vierteilige Hauptnavigation bleibt einzeilig; Seiteninhalte werden durch die fixe Leiste und Gerätesicherheitsabstände nicht verdeckt. Ein ausdrücklich ortsfestes Abonnement muss weiterhin erkennbar bleiben.

### DA-42 / Progressive Anzeige der Analyseoptionen

Ort und Zeitraum sind sofort bedienbar. Weitere Vergleichsoptionen sind aufklappbar und bei aktivem Artikel- oder Ebenenfilter geöffnet. Eine Zusammenfassung macht die gesetzten Optionen sichtbar. Nicht angewendete Filteränderungen werden benannt. Der Wirkungsbereich von Sachgebiet und Artikelvergleich wird erklärt. Beispiele und Hilfstexte dürfen den Zugang zu Ergebnissen nicht unnötig verlängern.

### DA-43 / Konsistente Karte und zugängliche Alternativen

Kartenebene, ausgewähltes Gebiet, zulässige Suchergebnisse und Detailanzeige sind konsistent. Jede Zeigerauswahl hat einen gleichwertigen Tastaturweg über die Gebietssuche. Diagrammtexte dürfen nicht durch mobile Skalierung unlesbar werden; Scrollbereiche erhalten Namen und Tastaturzugang. Inhaltssprungziele funktionieren auch im Fehlerfall.

## 17 / Abgleich mit der Implementierung

### Unveränderte MVP-Basis

Die folgenden Vorgaben aus der Stakeholder-Basis und dem Designabgleich bleiben gültig. Sie werden durch Gebietsauswahl, Analysen und die folgenden Designpräzisierungen ergänzt. Insbesondere ersetzt die vierteilige Navigation die frühere Navigation mit drei Zielen; die Gebietsauswahl ersetzt die Beschränkung auf einen einzigen Startort.

| Bestandteil | Anforderungen | Aktueller Stand und Grenze |
| --- | --- | --- |
| Direkter Themenfeed, Filter und Nachladen | SA-05, FA-01 bis FA-03, DA-01 bis DA-06 | Vorhanden; Filter Alle, Offen, Entschieden. Standardort Billerbeck. |
| Kurz- und Langansicht | SA-04/21, DA-05/11/13 | Vorhanden; etwa 45 Wörter als Richtwert der Kurzansicht. Quellenüberblicke sind nicht automatisch geprüfte, leicht verständliche Zusammenfassungen. |
| Prozessstand und verbundene Ereignisse | SA-10/13/14, FA-06/07, DA-07 bis DA-09/14 | Vier Schritte: Tagesordnung, Beratung, Empfehlung, Entscheidung. Status und zeitlicher Verlauf bleiben quellengebunden. Vollständige Verknüpfung aller Dokumente ist nicht nachgewiesen. |
| Originalquellen und WhatsApp | SA-11/24, DA-15/16 | Links in Übersicht und Detail; WhatsApp öffnet eine vorbereitete Nachricht. Empfänger und Versand wählt der Nutzer. |
| Sitzungen und erklärender Einstieg | SA-09, FA-04, DA-10/17 | Kommende Termine aus dem vorhandenen Bestand; /ueber erläutert Zweck und Grenzen. |
| Benachrichtigungen | SA-06/16, FA-05, DA-18/19 | Münster-Abonnement vorhanden; weitere Gebiete, regelmäßiger Import und Endgeräteabnahme offen. Die Entscheidungsliste ist kein Zustellnachweis. |
| Bilder, Kommentare, Beteiligung | RV-07/08/12, DA-23/25 | Aktuell bildfrei. Nur Bilder aus Originalunterlagen zulässig; automatische Auswahl fehlt. Kommentare und Beteiligungsinfos bleiben außerhalb des MVP. |
| Zwölf Monate Rückblick | SA-20, FA-12/17 | Importfenster auf zwölf Monate erweitert; Archiv vorhanden. Die vollständige Nachladung ist je Quelle zu prüfen. Lücken und Analyse-Standardzeitraum bleiben ausdrücklich erkennbar. |

### Rückverfolgbarkeit der aktuellen Erweiterungen

Die folgenden Dateien belegen die Umsetzung im geprüften Stand. Ein Codebezug ist kein Nachweis einer vollständigen fachlichen oder geräteübergreifenden Abnahme.

| Funktion | Anforderungen | Codebezug und Status |
| --- | --- | --- |
| NRW-Auswahl und Quellenstand | SA-25/33, FA-08/09/21/22, DA-28/30/35 | shared/regions.ts, shared/nrw-regions.json, components/region-picker.tsx, app/quellen/page.tsx. Katalog umgesetzt; Datenanbindung teilweise. |
| Datenbank und portable Importe | SA-26, FA-12, TA-05 bis TA-07/14 | db/schema.ts, server/repositories/seed.ts, scripts/import-nrw.mjs. Speicherung und Job umgesetzt; Scheduler offen. |
| Frontend und Backend | TA-08/09/13/14 | app und components für Darstellung; shared für gemeinsame Regeln; server für Datenzugriff/Integrationen; app/api für HTTP. Ein gemeinsames Deployment mit D1, keine getrennten laufenden Dienste. |
| Labels und Metadaten | SA-29/30, FA-14/15/26, TA-10/16, DA-31/37, QA-05 | shared/labels.mjs und server/repositories/seed.ts. Titelregeln umgesetzt; KI-Inhaltsprüfung im Billerbeck-Test nach Abschnitt 29. Flächendeckende Inhaltsprüfung und Einzelkorrekturen offen. |
| Verteilung, Verlauf und Monatsmix | SA-31, FA-16 bis FA-18/29, TA-11/13, DA-32/40, QA-07 | shared/analytics.mjs, shared/monthly-mix.mjs, components/monthly-mix.tsx. Umgesetzt auf Basis gespeicherter IDs; Quelldubletten bleiben eine Grenze. |
| Beispielanalysen | FA-27/28, DA-38/39, QA-06 | shared/analysis-examples.mjs, components/analysis-examples.tsx. Fünf Fragen und datenabhängige Sachthemen umgesetzt. |
| Deutschland-/NRW-Karte | SA-32, FA-19/20, DA-34/36/43, TA-12/15 | components/germany-heatmap.tsx, shared/map-selection.mjs, public/geo. Umgesetzt; politische Daten nur für erfasste Gebiete. |
| Kreisvergleich im Artikel | SA-27/28, FA-10/11, DA-29, TA-08/09 | shared/similarity.mjs, server/repositories/regions.ts. Umgesetzt; Ausschluss des eigenen Kreises für Stadt- und Kreisartikel in Arbeitspaket 1 korrigiert und geprüft. |
| Bedienung und Navigation | DA-33/41 bis DA-43 | components/site-chrome.tsx, components/analysis-controls.tsx, shared/navigation.mjs, app/design-styles.css. Korrekturen umgesetzt; visueller Nachweis offen. |

### Offene Anforderungen und Abweichungen

Diese Liste ist Teil des Abgleichs, kein neuer Ausschluss aus dem Produktziel. Arbeitspaket 1 hat den Kreis-Ausschluss korrigiert und die amtlich belegte Zusammenführung ergänzt. Die verbleibenden Grenzen sind unten aufgeführt. Die Priorität beschreibt den nächsten sinnvollen Prüf- oder Umsetzungsschritt, keine zugesagte Frist.

| Offener Punkt | Bezug | Erforderlicher Nachweis oder nächste Umsetzung |
| --- | --- | --- |
| Stadtbezogene Kreisthemen | SA-02 | Relevanzregel und Beleg für den Stadtbezug definieren; ausschließlich passende Kreisthemen im gewählten Stadtbezug ergänzen. Getrennte Feeds erfüllen diese Anforderung noch nicht. |
| Quellenabdeckung und Aktualität | SA-01/03/18/20, FA-09/12/21/22 | Weitere Quellen anbinden, fehlgeschlagene Abrufe klären, den vorbereiteten Zeitplan auf einem ausführenden Repository oder Server aktivieren und reale produktive Folgeimporte prüfen (Abschnitt 19). 43 datenführende Gebiete sind keine NRW-Vollerhebung. |
| Zusammenfassungen und KI-Qualität | SA-04/21 bis SA-23, FA-13 | Laufende KI-Verarbeitung konfigurieren; unabhängigen Referenzbestand, Metriken, Schwellen und Prüfzyklus vereinbaren und auswerten. Vorhandene technische Belegprüfungen ersetzen diese Evaluation nicht. |
| Historisch fehlende Vorgangsverknüpfungen | SA-13/26, FA-16/30 | Amtlich belegte Zusammenführung, Linkerhalt und korrekte Zählung sind implementiert. Fehlende Beziehungen müssen durch weitere öffentliche Abrufe oder fachliche Prüfung geklärt werden; ohne Beleg bleibt der Eintrag getrennt. |
| Labelqualität und Korrekturen | FA-14/15, TA-10, QA-05 | Fachlich bewertete unabhängige Stichprobe, Regeln für mehrdeutige Titel und nachvollziehbare Einzelkorrekturen ergänzen. Feine Unterlabels bleiben auszuarbeiten. |
| Push außerhalb Münsters | SA-06/16, DA-18 | Gebietsspezifisches Abonnement- und Ereignismodell umsetzen; regelmäßige Aktualisierung und echte Endgeräte-Zustellung prüfen. |
| Visuelle und zugängliche Bedienung | SA-19, DA-26/27/41 bis DA-43 | Browserprüfung auf großen und kleinen Ansichten, reale Tastatur- und Screenreader-Wege sowie lange Titel, Leer- und Fehlerzustände prüfen. Code-Review und Build sind hierfür nur Teilnachweise. |
| Betrieb und Verantwortlichkeit | Organisatorische Festlegungen | Betreiber, redaktionelle Verantwortung, Kosten, Finanzierung, Impressum und Datenschutzangaben konkretisieren. Keine erfundenen Angaben veröffentlichen. |

### Einordnung der Labelverbesserung

Der dokumentierte Regelvergleich verwendet denselben Importbestand: Offen sinkt von 3.051 auf 1.693 von 4.683 Vorgängen, also von 65,2 auf 36,2 Prozent. 979 Vorgänge fallen nun in die zwei strukturellen Gruppen. Für Billerbeck im Zeitraum 01.07.–26.09.2026 sinkt Offen von 48 auf drei von 67 Vorgängen, also von 71,6 auf 4,5 Prozent; 14 Vorgänge sind strukturell eingeordnet. Das sind Bestandsmessungen, keine Trefferquoten und keine Aussage zur gesamten NRW-Politik. Der Prüfbericht requirements/label-evaluation-v2.md bleibt maßgeblich für Umfang und Grenzen dieser Messung.

### Dokumentpflege und Nachweisgrenzen

requirements/vor-Ort_Anforderungen.md ist die aktuelle normative Ergänzung im Repository. Die frühere Datei vor-Ort_Erweiterung_v0.5.md verweist darauf. requirements/analysis-examples.md verweist für verbindliche Regeln auf Abschnitt 15; der UX-Prüfbericht bleibt ein historischer Nachweis und verweist für DA-41 bis DA-43 auf Abschnitt 16. Abschnitt 18 führt die Anforderungen aus Arbeitspaket 1 fort. Weitere Änderungen sollen künftig direkt in diesem Hauptdokument gepflegt werden.

Für den ursprünglichen Abgleich v0.9 wurden alle bisherigen Anforderungs-IDs des Hauptdokuments erhalten, die neuen Analyse- und UX-IDs ohne Duplikate integriert, Codepfade und Datenzahlen abgeglichen sowie Markdown und PDF aus demselben Text erzeugt. Die Gestaltung übernimmt Schrift, Farben und Linien der Website. Der Export wurde auf lesbare Tabellen, Seitenumbrüche und Textvollständigkeit geprüft. Es erfolgte kein neuer Import, keine Live-Datenbankprüfung und keine neue fachliche Produktabnahme.

## 18 / Arbeitspaket 1: Kreisvergleich und Vorgangsidentität

Umgesetzt am 26.09.2026. Der eigene Kreis wird bei kreisangehörigen Städten aus der Kreiszuordnung, bei Kreisartikeln direkt aus der eigenen Gebiets-ID bestimmt. Kreisfreie Städte haben keinen eigenen Kreis. Zusätzlich schützt die gemeinsame Vergleichsfunktion den Aufruf für Kreisartikel auch ohne übergebenen Elterneintrag.

### FA-30 / Amtlich belegte Zusammenführung

Vorgänge desselben Gebiets werden nur durch identische amtliche Datensatzadressen oder ausdrücklich erfasste Beziehungen zwischen Vorlage und Tagesordnungspunkt zusammengeführt. Die OParl-, SessionNet- und More-Rubin-Adapter erhalten diese Beziehungen beim Import. Gleichlautende Titel, gleiche Kategorien, Dokumentanhänge, Vorlagennummern ohne Quellenkontext oder eine gemeinsame Sitzungsseite genügen nicht.

Abnahme: Mehrere belegte Beratungen einer Vorlage ergeben einen kanonischen Vorgang. Getrennte Vorlagen bleiben auch bei gleichen Titeln getrennt. Widersprüchliche Zuordnungen zu unterschiedlichen Vorlagen werden nicht automatisch zusammengelegt. Der Abgleich bleibt auf das jeweilige Gebiet begrenzt.

### TA-17 / Historie und alte Artikellinks erhalten

Die Methode official-records-v1 erhält Ereignisse und Dokumentverweise über begrenzte Folgeimporte hinweg. Ältere Stände verdrängen keine neueren Metadaten. Eine Zusammenführung erhält eine bisherige ID als kanonische ID und speichert weitere IDs als Verweise im bisherigen Datensatz. Kein Datensatz wird dafür gelöscht. Detailabrufe über alte IDs und Artikelvergleiche auf der Analyseseite lösen diese Verweise auf.

Feed, Quellenzähler, Statistik und Ähnlichkeitsvergleich berücksichtigen nur kanonische Vorgänge. Der gehostete Import archiviert bisherige Fassungen und schreibt kanonischen Vorgang samt zugehörigen Verweisen gemeinsam in einer Datenbanktransaktion. Ein Fehler muss die gesamte betroffene Gruppe zurückrollen. Der portable Import und Export verwenden dieselbe Zusammenführungslogik. Wiederholte Läufe verändern den bereits zusammengeführten Bestand nicht erneut.

### DA-44 / Offene Verknüpfung sichtbar machen

Das Artikeldetail zeigt beim Verlauf einen Hinweis, wenn keine eindeutige amtliche Vorlagenzuordnung erkannt wurde oder widersprüchliche Zuordnungen vorliegen. Der Hinweis erklärt, dass der Eintrag vorerst getrennt gezählt wird und weitere Beratungen separat erscheinen können. Fehlende Zuordnung beweist keine Dublette; insbesondere haben allgemeine Tagesordnungspunkte nicht zwingend eine eigene Vorlage.

### Prüfung und verbleibende Grenze

Die automatisierten Prüfungen decken den Kreis-Ausschluss für Stadt- und Kreisartikel, kreisfreie Städte, wiederholte Beratungen, unterschiedliche Vorlagen mit gleichen Titeln, gemeinsame Sitzungsseiten und Dokumente, widersprüchliche Beziehungen, Gebietstrennung, ältere und begrenzte Folgeimporte, alte Artikellinks und idempotente Wiederholung ab. Integrationstests führen die tatsächlichen Repository- und Importabfragen gegen eine lokale SQLite-Datenbank mit dem Projektschema aus. Geprüft werden Archivierung, Zähler, Aliasauflösung und Rückrollen nach simuliertem Transaktionsfehler. Dies ist kein Test einer neuen Live-Importserie in der produktiven D1-Datenbank.

Der reproduzierbare Bestandscheck über scripts/audit-topic-identity.mjs umfasst 4.683 gespeicherte Vorgänge. Für 871 wird eine Vorlagenidentität anhand der unterstützten amtlichen Adressen oder Adapter-IDs erkannt; 3.812 bleiben ohne solche Zuordnung. Es wurden keine mehrfach gespeicherten, identischen amtlichen Vorgangsadressen innerhalb desselben Gebiets gefunden. Gemeinsame Sitzungsadressen werden ausdrücklich nicht als Dublettenbeleg gewertet. Der Bestand wurde deshalb nicht künstlich verkleinert. Diese Zahlen sind keine Quote fehlerhafter Datensätze und keine Live-Datenbankmessung.

Fehlende Beziehungen im historischen Bestand sind durch die neue Logik nicht erfunden worden. Sobald ein Folgeimport eine eindeutige amtliche Beziehung liefert, kann er bisher getrennte Einträge zusammenführen. Quellenerschließung und laufender Importbetrieb bleiben Gegenstand der folgenden Arbeitspakete.


## 19 / Arbeitspaket 2: Importbetrieb

Technisch vorbereitet am 26.09.2026. Der portable HTTP-Runner und die Backend-Absicherung sind implementiert. Der aktuelle Hosting-Zugang stellt keinen konfigurierbaren Zeitgeber bereit. Deshalb ist der regelmäßige Betrieb weiterhin nicht aktiv. Die vorbereitete GitHub-Actions-Datei wird erst nach Übernahme in ein ausführendes Repository, sicherer Zugangskonfiguration und ausdrücklicher Aktivierung wirksam. Diese Grenze wird auch auf der Quellenansicht genannt.

### TA-18 / Portabler Zeitplan und begrenzte Wiederholung

Der Import soll alle sechs Stunden laufen. Der vorbereitete Plan nutzt 00:17, 06:17, 12:17 und 18:17 UTC und erlaubt einen manuellen Start. Der Runner arbeitet unabhängig vom Website-Build und setzt die 43 datenführenden Gebiete fort. Weitere Gebiete gehören zur Quellenerschließung; ein konfigurierter NRW-Katalog beweist keine Datenabdeckung.

Anfragen erfolgen sequenziell über HTTPS mit einem geschützten Bearer-Zugang. Weiterleitungen sind untersagt; Geheimnisse dürfen weder im Repository noch im Protokoll stehen. Vorübergehende Transport- und Serverfehler erhalten höchstens drei Versuche mit Wartezeit. Ein abgelehnter Zugang zur Anwendung beendet den Lauf. Einzelne Quellenfehler dürfen andere Gebiete nicht blockieren. Eine Datenbanksperre verhindert gleichzeitige Importe; das Netzwerkbudget je Quelle ist auf 120 Sekunden begrenzt, bei SessionNet zuzüglich maximal 20 Sekunden Schnittstellenprobe. Ein externer Anfrageabbruch beendet nicht garantiert die bereits laufende Backend-Anfrage; Wiederholungen müssen daher die Sperre respektieren.

### TA-19 / Importzustand und Bestandserhalt

Jeder gestartete Backend-Lauf protokolliert Gebiet, Modus, Auslöser, Start, Ende und Ergebnis. Das geschützte Betriebsprotokoll liefert die letzten 50 Läufe. Fehlgeschlagene oder leere Teilabrufe erhalten eine Wiederholungspause von zwei bis höchstens 24 Stunden. Geplante Läufe berücksichtigen diese Pause; ein bewusst ausgelöster manueller Lauf darf sie übergehen. Teilimporte mit verwertbaren Artikeln bleiben als Teilimporte erkennbar.

Artikel und erfolgreiche Quellendaten werden durch einen leeren oder fehlgeschlagenen Abruf nicht gelöscht. Eine erfolgreiche Übernahme bedeutet nicht zwingend vollständige Abdeckung. Zeitpunkte der letzten Übernahme, des letzten Versuchs und des letzten technisch vollständigen Abrufs werden getrennt gespeichert. Folgeimporte archivieren nur geänderte Fassungen. Der erstmalige Aufbau eines leeren Gebiets versendet keine Push-Nachrichten für den historischen Beschlussbestand.

Ein harter Prozessabbruch kann einen offenen Protokolleintrag hinterlassen; die Sperre läuft nach zehn Minuten aus. Alte offene Läufe müssen im Betrieb untersucht werden. Automatische Alarmzustellung ist noch nicht eingerichtet. Bei Fehlern nach bereits abgeschlossenen Artikeltransaktionen kann ein Teilbestand aktualisiert sein; die Fehlermeldung darf keinen vollständigen Rollback behaupten.

### DA-45 / Aktualität verständlich anzeigen

Die Quellenansicht zeigt letzte Datenübernahme und letzten Abrufversuch mit Datum und Uhrzeit in der Zeitzone Europe/Berlin. Sie unterscheidet vollständigen technischen Abruf, Teilübernahme, leeren Abruf und Fehler. Eine Wiederholungspause erscheint mit dem frühestmöglichen nächsten Versuch. Dieser Zeitpunkt ist keine Zusage, dass ein noch nicht aktivierter Zeitgeber tatsächlich läuft. Bestehende Hinweise zu Quellenlücken bleiben zugänglich. Ein Sitzungstermin ersetzt keinen Importzeitpunkt.

### QA-07 / Folgeimporte und Betriebsabnahme

Lokale automatisierte Prüfungen müssen wiederholte Importe, Erhalt des Artikelbestands bei Fehlern und leeren Antworten, gleichbleibende Archivzahl bei unveränderten Folgeläufen, Protokollkontext, Sperren, Wiederholungspausen, begrenzte Netzwerkversuche und Abbruch bei ungültigem Zugang abdecken. Die Datenbanktests verwenden das tatsächliche Projektschema und die tatsächlichen Importabfragen in SQLite.

Vor der Betriebsfreigabe sind zusätzlich ein manueller und ein zeitgesteuerter Produktionslauf nachzuweisen. Für mindestens zwei echte Folgeimporte sind Artikelzahlen, Archivfassungen, Quellenzeiten und Protokolle zu vergleichen. Diese Produktionsabnahme und die dauerhafte Aktivierung sind noch offen. Ein lokaler Test oder ein erfolgreich gebauter Workflow ersetzt sie nicht. Die laufende KI-Verarbeitung wird durch diesen Metadaten-Zeitplan nicht aktiviert.

Nachweis dieses Stands: 63 automatisierte Tests erfolgreich; TypeScript-Prüfung ohne Fehler. Die zwei zusätzlich versuchten öffentlichen Billerbeck-Abrufe sind kein Nachweis erfolgreicher produktiver Folgeimporte; begrenzte Abrufe können vor dem Einlesen von Artikeln ihr Zeitbudget erreichen.

Implementierung: server/services/sync.ts, server/integrations/import-health.mjs, server/integrations/request-budget.mjs, app/api/internal/sync/route.ts, scripts/run-imports.mjs, .github/workflows/import.yml und app/quellen/page.tsx. Die sichere Aktivierungsanleitung steht im README.


## 20 / Zwölf Monate Rückblick für vorhandene Quellen

### FA-31 / Erweiterter historischer Zeitraum

Ab 27.09.2026 fragen die vorhandenen OParl-, SessionNet- und More-Rubin-Adapter zwölf rollierende Kalendermonate anstelle von drei Monaten ab. Bereits veröffentlichte zukünftige Beratungen bleiben berücksichtigt. Monatsenden und Schaltjahre werden kalendarisch korrekt behandelt. Die Erweiterung betrifft die vorhandenen Quellen; sie erschließt keine zusätzlichen Gebiete und behauptet keine vollständige NRW-Abdeckung.

Die Analyse startet mit dem laufenden und den elf vorherigen Kalendermonaten. Benutzer können den Zeitraum weiterhin selbst ändern. Monate ohne eingelesene Vorgänge bleiben Datenlücken. Quellen mit unvollständigem Import dürfen keine vollständige Erhebung suggerieren. Die Quellenansicht unterscheidet den angefragten Zeitraum vom tatsächlich dokumentierten Datenstand.

### TA-20 / Historische Nachladung ohne Bestandsverlust

Der portable Job scripts/backfill-year.mjs bearbeitet die Standardliste der datenführenden Gebiete mit drei parallelen Quellen (jetzt 43; der erste historische Lauf umfasste 13). Die Nachladung begrenzt jede Quelle auf 180 Sekunden Netzwerkbudget, OParl auf 1.200 Anfragen und 24 Listenseiten. SessionNet fragt 14 Kalendermonate einschließlich überlappendem Startmonat und Folgemonat ab; maximal 400 Sitzungen werden mit bis zu drei gleichzeitigen Anfragen verarbeitet. Die historische Nachladung beginnt mit den ältesten Sitzungen im Fenster; reguläre Aktualisierungen beginnen mit den neuesten. Diese Grenzen können auch bei erreichbarer Quelle zu unvollständigen Ergebnissen führen.

Ergebnisse werden nach jedem Gebiet atomar zwischengespeichert. --resume überspringt bereits abgeschlossene Gebietsversuche; es ist keine Fortsetzung innerhalb einer abgebrochenen Quellenseite. Fehlgeschlagene Gebiete müssen gezielt neu abgerufen werden. Das geprüfte Ergebnis wird als versionierter Bestand mit der Website ausgeliefert. Beim nächsten Datenbankzugriff werden amtlich belegte Beziehungen mit dem aktuellen Bestand zusammengeführt; frühere Fassungen und alte Links bleiben erhalten. Eine Sperre verhindert paralleles Einspielen. Erneutes Einspielen derselben Version ist wirkungslos. Historische Nachladungen versenden keine Push-Nachrichten.

### Nachweisgrenze

Die technische Erweiterung ist durch Tests des Zwölf-Monats-Zeitraums, von Schaltjahren, Kalenderabrufen und wiederholtem Einspielen historischer Daten geprüft. Ein gesetztes Startdatum ist kein Beleg für vollständige Erfassung. Der Ergebnisbericht der Nachladung führt pro Quelle erhaltene Artikel und verbleibende Fehler auf. Die bisherigen Bestandsmessungen und Labelquoten in älteren Abschnitten beziehen sich weiterhin auf den dort ausdrücklich datierten Datensatz.


### Ergebnis der Nachladung am 27.09.2026

Die 13 bereits datenführenden Gebiete lieferten insgesamt 10.006 Datensätze. Nach dem lokalen Abgleich mit dem bisherigen ausgelieferten Bestand steigt die Zahl kanonischer Artikel von 4.683 auf 12.253. Billerbeck wächst von 84 auf 402 Artikel, Münster von 537 auf 2.368. Der früheste eingelesene Sitzungstermin liegt für Billerbeck am 09.10.2025, für Münster am 29.09.2025. Diese Termine beweisen keine lückenlose Erfassung dazwischen.

Für zwölf der 13 Gebiete bestehen weiterhin technische Hinweise oder Abruflimits; nur Recklinghausen hat in diesem Lauf keine erkannten technischen Lücken. Insbesondere reicht der früheste gespeicherte Termin in Krefeld derzeit nur bis 04.02.2026, in Köln bis 09.12.2025 zurück. Die Erweiterung des angefragten Fensters ist umgesetzt; eine überall vollständige Zwölf-Monats-Erhebung ist nicht erreicht.

66 automatisierte Tests und die TypeScript-Prüfung sind erfolgreich. Zusätzlich wurde das vollständige Nachladepaket gegen eine lokale SQLite-Datenbank mit dem Projektschema eingespielt: Alle ursprünglichen IDs blieben erhalten, 2.436 frühere Fassungen wurden archiviert, und ein zweites Einspielen änderte weder Artikel- noch Archivzahl. Die 12.254 gespeicherten Zeilen enthalten einen Verweisdatensatz; 12.253 sind kanonische Artikel. Der gebietsweise Bericht steht in requirements/year-backfill-report.md. Diese Messung ist zunächst ein lokaler Abgleich und keine unabhängige Vollständigkeitsprüfung der Originalquellen.


## 21 / Regelbasierte und KI-basierte Labels getrennt vergleichen

### FA-32 / Zwei unabhängige Labelserien

Jeder kanonische Artikel erhält ein unverändertes Regelergebnis und ein davon getrenntes KI-Ergebnis. Der eingefrorene Vergleichsbestand enthält 12.253 Artikel aus dem versionierten Repository einschließlich Zwölf-Monats-Nachladung; er ist kein neuer Live-Datenbankexport. Regellabel, Textstand und Text-Hash, Katalog-, Regel- und Promptversion bleiben nachvollziehbar. Ein Modellwechsel erfordert einen eigenen Studienstand. Die KI erhält keine Regel- oder Referenzlabels.

Die KI verwendet den bestehenden Katalog mit 13 Sachgebieten, zwei strukturellen Gruppen und Offen. Ihr Hauptlabel muss gültig sein und durch wortgetreue Belegstellen im Eingangstext gestützt werden; Offen darf ohne Belegstelle bleiben. Schema- und Belegprüfungen ersetzen keine sachliche Qualitätsbewertung. Fehlende oder fehlgeschlagene KI-Ergebnisse sind eigene Zustände und dürfen nicht als Offen oder als Regelergebnis ausgegeben werden. Die produktiven Labels werden durch die Studie nicht überschrieben.

### TA-21 / Fortsetzbarer Klassifikationslauf

Der portable Lauf speichert jedes Ergebnis getrennt mit Artikel-ID, Text-Hash, Modell, Promptversion, Zeitpunkt, Belegen, Begründung und vom Anbieter gemeldeter Tokennutzung. Bereits fertig verarbeitete identische Eingaben werden übersprungen. Fehler können gezielt erneut verarbeitet werden. Ungültiger Zugang, Kontingentfehler oder zehn Fehler beenden den Lauf zur Prüfung. Geheimnisse werden nur über die Ausführungsumgebung bereitgestellt.

Standardmodus source verwendet Titel und bereits verfügbare Originalauszüge beziehungsweise extrahierte Dokumenttexte. Generierte Zusammenfassungen werden nicht als Quelle verwendet. Fehlende PDF-Volltexte werden in diesem Schritt nicht automatisch nachgeladen. Dokumenttext-Verfügbarkeit und Kürzung bei 55.000 Zeichen werden festgehalten. Der zusätzliche Modus title ermöglicht einen kontrollierten Vergleich beider Verfahren auf derselben Titelbasis; der Produktionsvergleich source enthält dagegen einen Informationsvorteil für die KI gegenüber den Titelregeln. Beide Fragestellungen sind getrennt zu berichten.

### QA-08 / Unabhängige Referenz und gepaarte Bewertung

Eine vor dem KI-Lauf festgelegte, reproduzierbare Zufallsstichprobe von 300 Artikeln wird ohne angezeigte Regel- oder KI-Labels geprüft. Referenzlabel, Prüfer und Begründung sind zu dokumentieren. Erst nach Klärung von Zweifeln erhält ein Artikel den Status adjudicated. Für eine belastbare fachliche Bewertung sollen zwei Personen unabhängig urteilen und Differenzen vor Freigabe klären. Die finale Teststichprobe darf nicht zugleich zur Optimierung der Regeln oder des Prompts verwendet werden.

Übereinstimmung zwischen KI und Regeln ist keine Genauigkeit. Genauigkeit, Macro-F1 über in der Referenz vertretene Klassen, klassenweise Kennzahlen und Verwechslungsmatrix werden auf denselben freigegebenen Artikeln mit KI-Ergebnis berechnet. Zusätzlich werden KI-Abdeckung, Fehler, Offen-Anteil sowie die Regelgüte auf allen freigegebenen Referenzen ausgewiesen. Ohne unabhängige Referenzen bleiben Genauigkeitswerte leer. Die Gesamtstichprobe belegt nicht automatisch die Güte seltener Labels oder einzelner Gebiete; dafür sind ergänzende, getrennt ausgewiesene Stichproben erforderlich.

### Historischer Stand der API-Vorbereitung (v0.13)

Dieser Absatz beschreibt den damaligen API-Vorbereitungslauf, nicht eine spätere separate chatbasierte Bewertung. Die neuen Kommunen aus Abschnitt 22 und 23 sind kein Bestandteil dieses eingefrorenen Studienkorpus.

Vorbereitet waren Korpus, Regellabel, fortsetzbarer KI-Runner, separate Ergebnisspeicherung, verblindete Referenzdatei und Auswertung. 4.356 von 12.253 Artikeln sind regelbasiert Offen (35,6 Prozent). In diesem damaligen API-Vorbereitungslauf lagen null KI-Ergebnisse und null freigegebene Referenzen vor. Weder im Backend noch in der aktuellen lokalen Ausführungsumgebung ist ein KI-API-Schlüssel konfiguriert; deshalb wurde kein vollständiger KI-Lauf ausgeführt und keine Genauigkeit behauptet. Eine alternativ auswählbare KI-Labelserie in der Website ist noch nicht implementiert. Die Studie ist zunächst ein separater Analysebestand.

Code und Anleitung: scripts/label-study/README.md; gemeinsame Validierung und Metriken: shared/label-study.mjs. Automatisierte Tests prüfen insbesondere, dass ein übereinstimmendes falsches Label keine korrekte Klassifikation ist, ausstehende Antworten keine Enthaltungen sind und geänderte Text-Hashes nicht gegen veraltete Referenzen bewertet werden.

## 22 / Zehn weitere Kommunen nahe Billerbeck

### SA-38 / Datenführende Nachbarregionen

Nottuln, Havixbeck, Rosendahl, Stadt Coesfeld, Dülmen, Senden, Lüdinghausen, Ahaus, Olfen und Ascheberg werden als zusätzliche kommunale Datenquellen aufgenommen. Die bestehende Auswahl wird mit echten öffentlichen Vorgängen gefüllt. Nähe zu Billerbeck und erreichbare Quellen bestimmen diese Auswahl im Münsterland; eine exakt nach Straßenkilometern sortierte Top-10 wird nicht behauptet. Näher gelegene, gesperrte Portale werden nicht umgangen.

Abnahme: Alle zehn Orte besitzen einen eigenen Bestand, Originalverweise und den korrekten amtlichen Gemeindeschlüssel. Stadt Coesfeld (`nrw-05558012`) bleibt vom Kreis Coesfeld (`coesfeld`) getrennt. Billerbeck bleibt Standard. Bestehende Orts- und Artikellinks bleiben gültig.

### FA-37 / Gleiche Funktionen und transparente Datenlücken

Neue Ortsartikel erscheinen im Feed und in der Detailansicht mit Prozess, Originalquellen und WhatsApp-Teilen. Sie fließen in Themenanteile, Monatsverläufe, Ortsvergleiche und Karte ein. Fehlende Daten sind keine thematische Nullmeldung. Die bisherige Beschränkung des separaten Artikelvergleichs auf Kreise und der Push-Funktion auf Münster bleibt kenntlich.

Abnahme: Je neuer Kommune sind historische Artikel für die Analyse vorhanden; Labelanteile einschließlich offener Zuordnung ergeben 100 Prozent. Kommende Termine zählen nicht zu vergangenen Anteilen. Quellenüberblick wird nicht als geprüfte KI-Zusammenfassung bezeichnet.

### TA-22 / Einheitlicher Quellenkatalog und Folgeimporte

`server/integrations/nearby-sources.json` enthält die zehn bestätigten öffentlichen Quellen einschließlich amtlichem Einstieg und Prüftermin. `source-catalog.mjs` verbindet sie mit den 57 OParl-Kandidaten. Ein Neubau des Verzeichnisses darf bestätigte Quellen nicht entfernen. Portabler Import, Export, gehosteter Import und Quellenübersicht verwenden diesen gemeinsamen Katalog. Die Standardliste für Folgeimporte umfasste mit v0.14 23 datenführende Gebiete und wächst mit Abschnitt 23 auf 43.

OParl wird zuerst geprüft. Am 27.09.2026 antworteten die zehn geprüften Hersteller-Standardpfade mit HTTP 404; deshalb wird der vorhandene SessionNet-Adapter genutzt. Das schließt andere API-Adressen nicht aus. Ein künftig gefundener OParl-Endpunkt wird passend konfiguriert. Es gelten die bestehenden Zeit-/Größenlimits, zwölf Monate angefragter Rückblick, öffentliche Punkte, Originalverweise und Erhalt vorhandener Daten bei Teilimporten. Die Erweiterung aktiviert keinen Scheduler.

### FA-38 / Regelklassifikation und unveränderter Studienbezug

Die in v0.14 eingeführten Artikel erhielten `title-rules-v2` / `labels-v2` mit Hauptlabel, Zusatzlabels, Begründung, Quelle und Versionsangabe. Von 3.675 neuen Artikeln bleiben 1.295 offen (35,2 Prozent). Eine Zuordnung wird nicht allein zur Senkung dieser Quote erzwungen. Für diese Erweiterung wurden keine neuen KI-Labels oder KI-Zusammenfassungen erstellt. Der bisherige Regel-/KI-Vergleich über 12.253 Artikel bleibt separat und unverändert; seine Ergebnisse dürfen nicht auf die neuen Artikel übertragen werden. Eine erneute Vergleichsstudie benötigt einen eigenen Korpus mit dokumentiertem Textstand.

### Nachweis und Grenzen

Der reproduzierbare Bericht steht in [nearby-municipalities-report.md](nearby-municipalities-report.md). Tests prüfen alle zehn Bestände, öffentliche Herkunft, stabile IDs, Labels, zwölfmonatigen Anfragezeitraum und Analysierbarkeit. Der SessionNet-Parser erkennt außerdem die Dülmener Stadtverordnetenversammlung als entscheidendes Ratsgremium. Anforderungen an unabhängige fachliche Qualitätsbewertung und dauerhaften Importbetrieb bleiben offen.

## 23 / Zwanzig weitere Kommunen und sichtbarer Artikelbestand

### SA-39 / Verfügbare Orte vor der Auswahl erkennen

Zusätzlich werden Nordkirchen, Rheine, Telgte, Everswinkel, Ostbevern, Sassenberg, Südlohn, Haltern am See, Datteln, Waltrop, Herten, Dorsten, Ennigerloh, Beelen, Ochtrup, Stadt Warendorf, Beckum, Oelde, Wadersloh und Marl mit öffentlichen Artikeln angebunden. Die Auswahl berücksichtigt die Nähe zu Billerbeck und erreichbare amtliche Quellen; sie ist keine exakt nach Entfernung sortierte Rangliste. Billerbeck bleibt Standard.

Abnahme: Alle zwanzig Kommunen besitzen echte, quellenverlinkte Artikel, einen eigenen Gemeindeschlüssel und historische Daten für die Analysen. Stadt und Kreis bleiben getrennt. Die neuen Artikel verwenden dieselben Feed-, Detail-, Prozess- und Analysefunktionen wie bisherige Orte.

### FA-39 / Datenkennzeichnung in jeder Ortsauswahl

Jeder Ort zeigt in der Dropdown-Liste und im geschlossenen Auswahlfeld „N Artikel“. Bei bekannt unvollständigem Quellenstand kommt „Teilstand“ hinzu. Ohne gespeicherte Artikel steht „Noch keine Artikel“; bei unbekanntem Zähler „Datenstand unbekannt“. Eine konfigurierte Datenquelle allein löst keine positive Kennzeichnung aus. Datenlose Orte bleiben auswählbar.

Abnahme: Startseite, Analyseformular, Karteninspektor und Quellenseite verwenden denselben Bestandsindikator. Gezählt werden alle gespeicherten kanonischen Artikel eines Gebiets, einschließlich zukünftiger Artikel, unabhängig vom Analysezeitraum oder Label. Verweisdatensätze zusammengeführter Artikel werden ausgeschlossen. Im Normalbetrieb stammt der Zähler aus der Datenbank; beim gekennzeichneten Ausfall aus dem ausgelieferten Ersatzstand. Die Zahl behauptet keine vollständige Quellenabdeckung.

### DA-46 / Lesbare Bestandsmarkierung

Der Ortsname bleibt an erster Stelle. Unter Name, Gebietszuordnung und Gemeindeschlüssel steht eine beschriftete Marke: hellblauer Hintergrund für vorhandene Artikel, neutralgrau bei fehlenden Daten. Text vermittelt die gesamte Bedeutung; Farbe allein genügt nicht. Im ausgewählten Feld steht die Artikelzahl in einer zweiten Zeile. Der Listenhinweis erklärt Gesamtbestand und Teilstand. Fira Sans, kobaltblaue Akzente und die bestehende Gestaltung bleiben erhalten.

Abnahme: Name und Kennzeichnung dürfen auf schmalen Bildschirmen umbrechen. Suchfeld, Tastaturbedienung und sichtbarer Fokus bleiben erhalten. Der zugängliche Name des Auswahlfelds enthält Ort und Bestandsangabe. Die Marke verwendet mindestens 14 Pixel Schriftgröße.

### TA-23 / Erweiterbare Quellen und begrenzter Speicherbedarf

expanded-sources.json enthält die zwanzig bestätigten Quellen; source-catalog.mjs verbindet sie mit den bisherigen Katalogen. Ochtrup nutzt OParl, sieben Orte nutzen die öffentliche Portal-API und zwölf SessionNet. Nur für Ochtrups große Sitzungsliste wird das JSON-Limit auf sieben Millionen Zeichen angehoben und der Scan auf eine Listenseite begrenzt. Dieses Limit erzeugt einen sichtbaren Teilstand. Die übrigen Quellen behalten ihre Grenzen. HTTP 401/403 und Anmeldung werden nicht umgangen.

Der Export erzeugt den prüfbaren Rohbestand als Manifest mit kleinen JSON-Teilen (je maximal 100 Artikel und vier MB, Prüfsumme und Gebietsprüfung) sowie eine verlustfrei komprimierte Transportfassung je Gebiet. So bleibt jede Git-Datei begrenzt; der Node-Leser unterstützt auch ältere Ein-Datei-Exporte. Die Anwendung importiert die Transportfassung, entpackt beim Initialimport jeweils nur ein Gebiet und nutzt bei Datenbankausfall begrenzte bzw. projizierte Ersatzdaten. Schema, Archivierung, stabile IDs und Schutz vor doppeltem Initialimport bleiben bestehen. Die Standardliste für Folgeimporte umfasst 43 Gebiete; der vorbereitete Scheduler wird dadurch nicht aktiviert.

### Nachweis und Grenzen

Der Erstimport v0.15 enthielt 8.866 Artikel mit title-rules-v2 / labels-v2, davon 4.103 offen. Eine erzwungene Einordnung allein zur Senkung der Offenquote ist unzulässig. Es wurden keine zusätzlichen KI-Labels oder KI-Zusammenfassungen erzeugt; die separate Vergleichsstudie über 12.253 Artikel bleibt unverändert. Beim Erstimport v0.15 meldeten sieben neue Quellen Teilabrufe; die Nachprüfung steht in Abschnitt 24. Zwölf angefragte Monate sind keine Vollständigkeitsgarantie.

Alle 76 automatisierten Tests und die TypeScript-Prüfung bestehen im Stand v0.15. Sie prüfen unter anderem eindeutige Gebietszuordnung, öffentliche Herkunft, Originalverweise, Regelklassifikation, historische Analysierbarkeit, korrekte Bestandskennzeichnung und verlustfreie Kompression. scripts/verify-regional-seed.mjs prüft den tatsächlichen Datenbank-Initialimport einschließlich idempotenter Wiederholung. Amtliche Quellen und Einzelzahlen stehen in [expanded-municipalities-report.md](expanded-municipalities-report.md). Dauerhafter Importbetrieb, unabhängige Inhaltsbewertung und Endgeräteabnahme bleiben offen.

## 24 / Folgeimporte und nachvollziehbare Datenlücken

### FA-40 / Öffentliche Tagesordnungspunkte bei Teilfehlern erhalten

Ein durch die Quelle eindeutig als öffentlich belegter Tagesordnungspunkt darf nicht vollständig entfallen, wenn der Abruf seiner verknüpften Beratung oder Vorlage fehlschlägt. Der Import speichert nur tatsächlich verfügbare Angaben aus der öffentlichen Tagesordnung, insbesondere Originaltitel, Sitzungstermin und veröffentlichten Ergebnistext. Fehlender Vorlageninhalt wird nicht ergänzt. Der Quellenstand bleibt bei einem solchen Fehler unvollständig; im Artikel bleibt eine fehlende Vorlagenzuordnung erkennbar.

Abnahme: Ein gezielt fehlgeschlagener Vorlagenabruf liefert weiterhin den öffentlichen Tagesordnungspunkt, jedoch keine erfundenen Vorlageninformationen oder Entscheidung. Ein später erfolgreich eingelesener amtlicher Zusammenhang führt die Einträge über die bestehende Identitätslogik zusammen; beide bisherigen Artikellinks bleiben gültig. Nichtöffentliche oder gelöschte Punkte werden weiterhin verworfen. Gemeinsamkeiten im Titel allein reichen nicht zur Zusammenführung.

### TA-24 / Kontrollierte Weiterleitungen öffentlicher Portale

Öffentliche SessionNet-Portale leiten manche Tagesordnungslinks auf Informationsseiten derselben Sitzung um. Der Textabruf darf bis zu drei Weiterleitungen innerhalb des bereits freigegebenen HTTPS-Hosts und Portalpfads verfolgen. Alle Schritte teilen sich das ursprüngliche Zeitbudget. Fremde Hosts, URLs mit Zugangsdaten, andere Portalpfade, HTTP-Downgrades, Schleifen und längere Ketten werden abgewiesen. HTTP 401/403 bleibt ein Zugangshindernis.

Abnahme: Weiterleitungsziele werden vor jedem Netzabruf geprüft. Ein Portalhinweis auf noch nicht freigegebene Sitzungsdetails wird ausdrücklich als solcher in der Quellenansicht ausgewiesen. Eine Seite ohne lesbare öffentliche Tagesordnung ist kein vollständiger Abruf mit null Themen. Die Dropdown-Markierung „Teilstand“ bleibt für ungelöste Lücken erhalten.

### Nachweis und Grenzen

Sieben zuvor unvollständige Quellen wurden gezielt erneut eingelesen. Der Bestand wächst um 127 kanonische Artikel auf 24.921: Ochtrup von 363 auf 489, Waltrop von 291 auf 292. Waltrops technischer Teilfehler ist im Folgeabruf behoben. Sechs Quellen der Erweiterung bleiben als Teilstand ausgewiesen. Der Vergleich mit v0.15 und die verbleibenden Hinweise stehen in [source-followup-report.md](source-followup-report.md). Frühere Artikel blieben erhalten; die zusätzlichen Artikel wurden im damaligen Stand v0.16 automatisch regelbasiert klassifiziert. Seit v0.20 gilt dafür ausschließlich der manuelle Start nach Abschnitt 28. Der separate KI-Vergleich bleibt unverändert. Der erneute Import aktiviert keinen Scheduler und hebt weder Ochtrups Listenlimit noch Zugangsbeschränkungen auf.

Automatisierte Prüfungen decken freigegebene und unzulässige Weiterleitungen, Schleifen, Abrufgrenzen, nicht freigegebene Sitzungen sowie den Übergang vom unverknüpften Tagesordnungspunkt zur Vorlage mit stabilen Artikellinks ab. Alle 79 automatisierten Tests, die TypeScript-Prüfung und der vollständige Datenbank- und Kompressionsabgleich bestehen mit dem neuen Stand. Der Initialimport liefert 24.921 kanonische Artikel und bleibt bei erneuter Initialisierung unverändert. Alle 8.866 zuvor vorhandenen Artikellinks der zwanzig Kommunen sind erhalten. Alle 490 ausdrücklich öffentlichen Tagesordnungspunkte aus Ochtrups eingelesener Sitzungsliste sind durch Original- oder Identitätsverweise im Bestand vertreten. Diese Prüfung gilt für die gelesene Liste und behauptet keine Vollständigkeit außerhalb ihres Umfangs.

## 25 / Geschützte Administration

### SA-40 / Bestand und Pflegeaufwand überblicken

Der Betreiber kann unter `/admin` sehen, wie viele eigenständige Artikel im Themenfeed bereitstehen, welche Gebiete Daten liefern und wo Quellen oder Inhalte geprüft werden müssen. Die Seite verwendet dieselbe Datenbank wie die Bürgerseiten. Die allgemeine Website bleibt öffentlich; die Administration benötigt einen eigenen, serverseitig geprüften Zugang.

### FA-41 / Nachvollziehbare Kennzahlen und Quellenübersicht

Die Übersicht zeigt Artikel online, Gebiete mit Artikeln im Verhältnis zum NRW-Verzeichnis, Quellen mit Teilstand und Anteil offener Hauptlabels. „Online“ zählt alle gespeicherten kanonischen Vorgänge, unabhängig vom gerade im Bürgerfeed gewählten Zeitraum. Zusammengeführte Verweise zählen nicht als weitere Artikel. Die Gesamtzahl enthält kommunale und Kreisvorgänge; sie ist keine bereinigte Zahl unterschiedlicher politischer Sachthemen über Verwaltungsebenen hinweg.

Eine filterbare Quellenliste zeigt Artikelzahl, Importmethode, letzten übernommenen Stand, Teilfehler und gegebenenfalls Wiederholungszeitpunkt. Suchbar sind Ortsname und amtlicher Schlüssel. Quellen ohne erfolgreiche Übernahme seit mindestens sieben Tagen werden als ältere Datenstände kenntlich gemacht; dies ist keine Live-Erreichbarkeitsprüfung. Nicht angebundene Gebiete werden von konfigurierten Quellen ohne Artikel unterschieden. Die Liste ist zunächst auf 25 Zeilen begrenzt und erweitert sich auf Anforderung. Ein CSV-Export übernimmt den aktuellen Such- und Zustandsfilter.

Abnahme: Zähler und Quellenzahlen ergeben denselben kanonischen Bestand. Bei nicht erreichbarer Datenbank erscheinen Fehlermeldungen; es werden keine statischen Ersatzzahlen als aktueller Betriebsstand ausgegeben. Bereits im Browser geladene Werte bleiben bei einem fehlgeschlagenen Aktualisierungsversuch mit Hinweis sichtbar.

### FA-42 / Inhaltsprüfung, gezielter Import und Betriebsstatus

Der Betreiber sieht die Zahl vorhandener KI-Zusammenfassungen, Quellenüberblicke, Artikel mit PDF-Verweis und bestandener technischer Textprüfungen. Hauptlabels und Verfahrensstände werden als Verteilungen dargestellt. Technisch bestandene Textprüfungen gelten nicht als unabhängige fachliche Freigabe. Die separate eingefrorene KI-Labelstudie bleibt von dieser laufenden Bestandsübersicht getrennt.

Eine nach Gebiet und Prüfgrund filterbare Prüfliste verlinkt bis zu 25 zuletzt aktualisierte Artikel mit offenem Label, unbekanntem Verfahrensstand, widersprüchlicher Identitätszuordnung oder Textverarbeitungsfehler. Der Aktualisierungszähler für sieben Tage ist ausdrücklich keine Zahl erstmals veröffentlichter Artikel.

Je konfigurierter Quelle kann der Betreiber einen Metadatenimport starten. Die bestehende globale Importsperre verhindert konkurrierende Läufe. Der Import zeigt Fehler und Teilstände, erhält vorhandene Artikel und archiviert Änderungen nach den bisherigen Regeln. Neue Entscheidungen in Münster können den bestehenden Push-Versand auslösen; dies wird an der Aktion erklärt. Die Administration aktiviert weder einen Zeitplan noch kostenpflichtige KI-Verarbeitung.

Die letzten 30 im Backend protokollierten Importläufe zeigen Gebiet, Auslöser, Beginn, Ende und Ergebnis. Unabgeschlossene Läufe über zehn Minuten werden als ungeklärt markiert. Extern eingespielte historische Nachladungen sind über den Quellenstand dokumentiert. Der Betriebsabschnitt zeigt archivierte Fassungen, zusammengeführte Verweise, konfigurierte KI-/Push-Zugänge und die Anzahl gespeicherter Push-Abonnements. Ein früherer geplanter Lauf belegt keinen dauerhaft aktiven Scheduler. Besucherzahlen werden bisher nicht erfasst und erhalten keinen erfundenen Kennwert.

### TA-25 / Geschützter Admin-Zugang und Datenminimierung

Die Anmeldung nutzt die vom Hosting bereitgestellte ChatGPT-Anmeldung. Eine einmalige Freischaltung bindet eine verifizierte Site-spezifische Nutzer-ID dauerhaft an den Admin-Bereich. Der zufällige Freischaltcode wird nur als SHA-256-Hash in der geheimen Laufzeitvariable `ADMIN_SETUP_HASH` hinterlegt. Die atomare Erstzuweisung steht unter `admin-owner-v1` in `system_state`; spätere Freischaltversuche können sie nicht überschreiben. E-Mail und Anzeigename entscheiden nicht über Berechtigungen. Der Code gehört weder ins Repository noch in URLs oder Browserspeicher.

Jeder Daten- und Aktionsendpunkt prüft die Berechtigung serverseitig. Schreibaktionen akzeptieren nur JSON derselben Origin. Der Import akzeptiert ausschließlich konfigurierte Gebiets-IDs, keine frei eingegebenen Quelladressen. Antworten sind nicht öffentlich cachebar und die Seite ist von Suchmaschinenindexierung ausgeschlossen. Private Schlüssel, Push-Endpunkte und Nutzerlisten werden nicht an den Browser geliefert. CSV-Zellen sind gegen Formelinterpretation abgesichert. Bei einem Umzug aus Sites benötigt die Anwendung eine vertrauenswürdige Anmeldung, die die Identität serverseitig verifiziert; frei gesetzte HTTP-Header dürfen dort nicht als Anmeldung gelten.

### DA-47 / Gestaltung der Administration

Fira Sans, die Wortmarke „vor Ort.“, weißer Hintergrund, dunkle Typografie und Kobaltblau entsprechen der Bürgerwebsite. Vier Kennzahlen bilden den Einstieg, gefolgt von Abschnittslinks und konkretem Prüfbedarf. Darunter folgen Quellen, Inhaltsqualität, Importverlauf und Betrieb. Der Arbeitsbereich ist auf 1.200 Pixel begrenzt. Auf kleinen Bildschirmen stehen Kennzahlen zweispaltig und Inhaltsbereiche einspaltig; breite Datentabellen scrollen innerhalb ihres Containers. Zustände werden mit Text bezeichnet und nicht ausschließlich farblich vermittelt. Formulare erhalten sichtbare Beschriftungen, Ladezustände und Fehlermeldungen.

### Umsetzungsstand und Grenzen

SA-40, FA-41, FA-42, TA-25 und DA-47 sind im Code umgesetzt. Die erste Freischaltung muss der Betreiber nach Anmeldung selbst ausführen. Alle 86 automatisierten Tests und die TypeScript-Prüfung bestehen. Die Prüfungen umfassen Zugriffsschutz für alle Admin-APIs, konkurrierende Freischaltungen, Origin-Prüfung, Eingabevalidierung, CSV-Schutz und echte SQL-Zählungen. Der lokale Initialbestand liefert auch über die neuen Abfragen 24.921 kanonische Artikel aus 43 Gebieten; produktive Werte können sich durch spätere Importe ändern.

Weiterhin offen sind unabhängige fachliche Inhaltsbewertung, dauerhafter Schedulerbetrieb, weitere Admin-Rollen, redaktionelle Korrektur-/Freigabeworkflows und Besucheranalyse. Einträge der Prüfliste lassen sich bislang zur Prüfung öffnen, aber nicht als bearbeitet markieren. Die Anwendung bietet keine Lösch- oder Depublikationsaktion. Die Anmeldung und Endgerätebedienung benötigen zusätzlich die praktische Abnahme mit dem Betreiberkonto; automatisierte API-Tests ersetzen diese nicht.

## 26 / Umschaltbare Kartenanalysen

### SA-41 / Räumliche Unterschiede aus mehreren Blickwinkeln erkunden

Nutzer können die Einfärbung der vorhandenen Deutschland-/NRW-Karte auf derselben Analyseseite umschalten. Gebiet, Zeitraum und Ebene bleiben erhalten. Der Wechsel verändert die Darstellung sofort ohne zusätzlichen Datenabruf. Kommunen und Kreise werden als getrennte Ebenen dargestellt. Die Gebietsdetails und eine ausklappbare Wertetabelle zeigen dieselbe Kennzahl wie die Karte.

### FA-43 / Sechs Kartenansichten und verbindliche Bezugsgrößen

| Ansicht | Bezugsgröße | Darstellung und Grenzen |
|---|---|---|
| Themenanteil | Passende Vorgänge / alle erfassten Vorgänge im Gebiet und Zeitraum | Feste Blauklassen: 0; über 0–10; über 10–25; über 25–50; über 50 Prozent. |
| Anzahl der Vorgänge | Absolute Zahl passender Vorgänge | Feste Violettklassen: 0; 1–9; 10–49; 50–199; ab 200. Keine Einwohnernormierung. |
| Veränderung im Zeitraum | Anteil im zweiten minus Anteil im ersten Vergleichsabschnitt | Orange für Abnahme, Blau für Zunahme; Einheit Prozentpunkte. Unter −10; −10 bis unter −2; −2 bis +2; über +2 bis +10; über +10. Die mittlere Klasse beschreibt einen kleinen Unterschied, keine statistische Signifikanz. |
| Häufigstes Sachgebiet | Häufigstes der 13 fachlichen Hauptlabels | Bestehende Label-Farben; bei Gleichstand neutrale Farbe und Nennung aller Führenden. Allgemeine/formale/offene Gruppen können nicht gewinnen, bleiben aber im Nenner des angezeigten Anteils. |
| Anteil offener Labels | Noch nicht eingeordnet / alle Vorgänge | Feste Weiß-/Orange-Klassen mit denselben Prozentgrenzen wie der Themenanteil. Keine Genauigkeits- oder KI-Sicherheitskennzahl. |
| Datenabdeckung | Quellenabdeckung des gesamten gewählten Zeitraums | Türkis: keine gemeldete technische oder zeitliche Lücke. Ocker: Teilstand. Fehlender Bestand und fehlende Anbindung bleiben gesondert erkennbar. Keine Vollständigkeitsgarantie und kein Live-Verfügbarkeitstest. |

Themenanteil, Anzahl und Veränderung verwenden das gewählte Hauptlabel oder die bestehenden Ähnlichkeitstreffer zum Vergleichsartikel. Die anderen drei Ansichten verwenden alle Vorgänge des Gebiets im Zeitraum und benennen diesen abweichenden Bezug sichtbar. Die bestehende Trefferliste bleibt auf das gewählte Thema bezogen und wird entsprechend überschrieben. Es entstehen keine zusätzlichen KI-Labels oder KI-Zusammenfassungen.

### FA-44 / Vergleich gleich langer Zeitabschnitte

Für alle Gebiete werden dieselben zwei Zeitabschnitte innerhalb des gewählten Intervalls verwendet. Beide umfassen jeweils die abgerundete Hälfte seiner Kalendertage. Bei ungerader Tageszahl wird der mittlere Tag ausschließlich aus dem Abschnittsvergleich ausgeschlossen; die übrigen Analysen behalten ihn bei. Die Oberfläche zeigt beide Datumsbereiche, Tageszahl und gegebenenfalls den ausgelassenen Tag. Ein einzelner Tag erlaubt keinen Vergleich.

Ein kanonischer Vorgang zählt je Abschnitt einmal, wenn er dort mindestens einen öffentlichen Sitzungstermin hat. Er darf in beiden Abschnitten vorkommen; die Summen der Abschnittszähler müssen deshalb nicht dem Gesamtzähler entsprechen. Zukunftstermine, fehlende Termine und zusammengeführte Verweise erhöhen die Zähler nicht. Beide Abschnitte werden mit derselben aktuellen Regelklassifikation berechnet. Für eine farbliche Veränderung sind mindestens zehn Vorgänge in jedem Abschnitt erforderlich. Fehlender Nenner wird nicht als null Prozent ersetzt. Das häufigste Sachgebiet wird erst ab zehn Vorgängen im Gesamtintervall eingefärbt. Diese Schwellen sind eine konservative Darstellungshilfe, kein statistischer Signifikanznachweis.

### FA-45 / Datenlücken und Teilstände sichtbar halten

Null Treffer bei vorhandenem Bestand wird als eigener weißer Wert gezeigt. Ohne auswertbare Daten, bei zu kleiner Vergleichsbasis, fehlendem fachlichem Label oder ausgeblendeten Teilständen erscheint Schraffur; Details und Tabelle nennen den konkreten Grund. Nicht angebundene Gebiete erscheinen grau. Eine Option blendet Teilstände aus thematischen Einfärbungen aus, ohne die Quelldaten zu löschen. In der Ansicht Datenabdeckung bleiben Teilstände immer sichtbar. Gestrichelte Grenzen kennzeichnen Teilstände; die Auswahl erhält eine deutliche dunkle Umrandung. Ein Hinweis nennt die Zahl tatsächlich eingefärbter Gebiete in der aktuellen Ebene.

### DA-48 / Passende Legenden und zugängliche Werte

Über der Karte stehen der Auswahlschalter „Einfärbung der Karte“, die Bezugsgröße, der Zeitraum und eine konkrete Frage zur gewählten Ansicht. Darunter folgen gegebenenfalls die Vergleichsabschnitte, Ausschnitt/Ebene und Teilstandsfilter. Die Karte steht am Desktop neben einer Gebietsinspektion; mobil stehen beide untereinander. Die vollständige Legende steht unter der Karte und verwendet explizite Einheiten und Klassengrenzen. Kategorische Farben behalten die Zuordnung des übrigen Label-Katalogs. Legende, Werkzeughinweise, Gebietsdetails und Tabelle stammen aus derselben Darstellungslogik. Die Suche und Schaltflächen in der Tabelle ermöglichen dieselbe Gebietsauswahl per Tastatur. Farben sind nie die einzige Erklärung eines Werts.

### TA-26 / Gemeinsame Aggregation und Nachweis

`shared/analytics.mjs` ergänzt die gemeinsame Analyseantwort um `comparisonPeriods` sowie je Gebiet `unlabelled`, `dominant` und `comparison`. `shared/map-metrics.mjs` kapselt Abschnittsbildung, Kennzahlen, Farbschwellen und lesbare Werte. Der Browser importiert keine Rohtexte oder Servermodule. Für diese Kartenfunktionen waren keine erneute Datenerhebung, neue Laufzeitvariable oder Datenbankmigration erforderlich; der ergänzende Performance-Index ist in Abschnitt 27 dokumentiert.

Abnahme: Tests prüfen identische Zeitgrenzen, ungerade Zeiträume, Schaltjahre, Mehrfachtermine, Alias-/Zukunftsausschluss, fehlende Nenner, Gleichstände, Labelgruppen, Klassengrenzen und den konkreten Artikelvergleich. Der tatsächliche Initialbestand wurde zusätzlich über die neuen Aggregate ausgewertet: Für 01.10.2025–27.09.2026 liefern 43 Gebiete gültige Kartenwerte. Alle 93 automatisierten Tests, die TypeScript-Prüfung und die serverseitige Darstellung mit echten UI-Komponenten bestehen. Die Produktansichten sind im Code umgesetzt; daraus folgt weiterhin keine Vollerhebung, redaktionelle Bestätigung oder gesicherte Aussage über politische Priorität. Die praktische Prüfung auf Mobilgeräten und mit assistiven Technologien bleibt gesondert erforderlich.

## 27 / Ladezeit und bedarfsgesteuerte Übertragung

### TA-27 / Unabhängige Anfragen und effiziente Datenabfragen

Eine laufende Datenbankoperation darf nicht als modulglobale Promise von späteren Besucheranfragen übernommen werden. Die Initialisierung speichert nur ihre abgeschlossene Bereitschaft; ein neuer Request prüft fehlende Bereitschaft mit einer eigenen Datenbankanfrage. Drei Import-Versionsmarker werden gemeinsam gelesen; Klassifikation ist seit v0.20 kein Initialisierungsschritt mehr. Öffentliche Leseaufrufe starten keine Initialisierung. Fehlende Initialimporte werden mit einer atomaren, zeitlich begrenzten Datenbanksperre serialisiert. Ein konkurrierender Import wartet nicht auf den fremden Request. Öffentliche Seiten lesen währenddessen den bereits gespeicherten Bestand. Neue Tabellen oder Schemaänderungen bleiben Migrationen vorbehalten.

Die Migration `0002_melodic_mulholland_black.sql` ergänzt einen partiellen Index für kanonische Vorgänge nach Gebiet und Status. Er unterstützt Bestandszählung und Entscheidungsfilter ohne erneute Prüfung großer Artikel-Payloads für jede Zählung. Die Sitzungsvorschau aggregiert und begrenzt Ergebnisse in SQL auf zwei unterschiedliche anstehende Sitzungen; sie überträgt keine vollständigen historischen Ereignislisten mehr.

Analysen laden nur notwendige Titel, Quellverweise, Identitätsverweise, Termine und geprüfte Klassifikationsangaben. Gespeicherte Labels dürfen nur wiederverwendet werden, wenn Katalog, Regelversion und belegter Originaltitel unverändert übereinstimmen und das Label zum Katalog gehört. Sonst bleibt die Analyse ausstehend, bis der Betreiber sie ausdrücklich startet. Fertig berechnete öffentliche Analyseergebnisse können höchstens 30 Sekunden und für maximal drei Auswahlen im Arbeitsspeicher vorgehalten werden. Laufende Promises, Admin-Daten und fehlgeschlagene Ersatzstände werden nicht so zwischengespeichert. Backend-Importe invalidieren den Cache ihres Workers; bei anderen Worker-Instanzen begrenzt die Ablaufzeit die Verzögerung. Datenbank und versionierte Quellen bleiben maßgeblich.

### FA-46 / Vollständige Listen in begrenzten Portionen

Die erste Analyseseite zeigt Kennzahlen und Zusammenfassungen. Einzelvorgänge des gewählten Orts sowie Treffer in anderen Gebieten werden erst beim Öffnen der jeweiligen Liste angefordert. `GET /api/analytics/articles` übernimmt die bestehende Analyseauswahl sowie `scope=local|matches`, gegebenenfalls `target`, `offset` und `revision`. Pro Antwort werden höchstens 30 Vorgänge geliefert. Gesamtzahl, Fortsetzungsposition und Originalverweise bleiben erhalten. Eine geänderte Listenrevision erfordert Neuladen statt unbemerkt vermischter Seiten. Ungültige Gebiete, Auswahlparameter und Positionen werden zurückgewiesen. Das ist eine Portionierung der Anzeige, keine fachliche Beschränkung des Bestands.

### DA-49 / Sofort nutzbare Analyse und nachgeladene Karte

Die bestehenden Kartenansichten und Geometrien werden erst geladen, wenn der Kartenbereich in die Nähe des sichtbaren Ausschnitts kommt oder „Karte jetzt laden“ betätigt wird. Bis dahin reserviert ein beschrifteter Platzhalter Raum. Die übrigen Auswertungen bleiben verfügbar. Laden, Fehler und erneuter Versuch sind sichtbar; fehlgeschlagene Kartenmodule dürfen nicht die gesamte Analyse unbenutzbar machen. Aufklappbare Listen zeigen Ladezustand, erreichten Listenstand und einen Fortsetzungsbutton. Fehlgeschlagene oder nach zwölf Sekunden abgebrochene Listenanfragen können erneut versucht werden. Browserkomponenten erhalten ausschließlich ihre benötigten Datenfelder.

### Abnahme und Messgrenzen

Vorher-/Nachher-Messung mit identischem lokalem Datenbestand: Die eigenständige HTML-Darstellung der Standardanalyse sinkt von rund 1,12 MB auf rund 64 KB. Die Kennzahlen, Monatswerte, Kartenwerte und Trefferlisten sind über einen vollständigen Ergebnisvergleich unverändert. Die lokale Messung umfasst weder den gesamten RSC-Transport noch Browser-, Netz- oder Produktionslatenzen und ist keine garantierte Ladezeit auf Endgeräten. Produktionsprotokolle vor der Korrektur belegen einen erfolgreichen Analyseaufruf mit 6.123 ms Laufzeit sowie abgebrochene Mitteilungsaufrufe. Eine erneute praktische Messung auf Endgeräten bleibt erforderlich. Einzelheiten stehen in [performance-review-2026-09-27.md](performance-review-2026-09-27.md).

## 28 / Artikelanalyse ausschließlich auf Betreiberanforderung (v0.20)

### SA-42 / Auswertung ansehen und Artikel analysieren sind getrennte Aktionen

Ein Klick auf „Analyse“, Filterwechsel, Kartenansichten, das Öffnen einer Artikelliste oder eines Artikels sowie das Aktualisieren von Admin-Kennzahlen dürfen keine neue Klassifizierung, Themenmerkmalsextraktion oder KI-Zusammenfassung starten. Diese GET-Lesewege dürfen weder die Datenbank initialisieren noch Artikel verändern. Angezeigt und aggregiert werden ausschließlich bereits gespeicherte Ergebnisse; Prozentwerte, Datumsfilter und der Vergleich gespeicherter Merkmale bleiben normale Leseoperationen.

### FA-47 / Manueller Analyselauf

Nur der angemeldete, freigeschaltete Betreiber darf im Adminbereich unter „Neue Artikel analysieren“ ein Gebiet oder alle Gebiete auswählen und „Labels & Themenmerkmale erstellen (bis 500)“ auslösen. `POST /api/admin/analyse` prüft Betreiberidentität, gleichen Ursprung und Eingaben. Ein Klick bearbeitet genau ein begrenztes Paket von höchstens 500 kanonischen Artikeln mit fehlenden oder veralteten Ergebnissen. Er speichert Hauptlabel, Begründung, Version, Originaltitel und Zeitpunkt sowie Vergleichsmerkmale mit Version und Zeitpunkt. Die Funktion verwendet Regeln, keine KI-API. Die separate eingefrorene KI-Labelstudie wird nicht verändert.

Ausstehende Artikel, Anzahl bearbeiteter Artikel und verbleibende Anzahl werden angezeigt. Es gibt weder eine automatische Fortsetzung noch einen Start beim Mounten der Oberfläche, durch Zeitplan, Import oder Veröffentlichung einer neuen Website-Version. Eine fortgesetzte Bearbeitung benötigt den nächsten ausdrücklichen Klick. Mehrdeutige, bereits bearbeitete Titel werden nicht allein wegen ihres offenen Hauptlabels wiederholt verarbeitet.

### TA-28 / Schreiben und Lesen technisch trennen

`storedClassification` und gespeicherte Themenmerkmale werden beim Lesen auf passende Version und unveränderten Originaltitel geprüft. Fehlt ein gültiges Ergebnis, wird kein Klassifikator als Rückfall aufgerufen. Importe und historische Nachladungen erzeugen keine neuen Labels oder Themenmerkmale; vorhandene Ergebnisse bleiben gespeichert und werden bei verändertem Originaltitel bis zum nächsten manuellen Lauf als veraltet behandelt. Bereits fertig analysierte Importdateien dürfen ihre gespeicherten Ergebnisse mitbringen.

Import und manueller Analyselauf teilen eine atomare Sperre. Läufe werden mit manuellem Auslöser im vorhandenen Verlauf protokolliert. Abgeschlossene Ergebnisse bleiben bei Fehlern erhalten; nach erneutem Betreiberstart werden ausstehende Datensätze verarbeitet. Schreibvorgänge prüfen nochmals den zugrunde liegenden Originaltitel. Erfolgreiche und teilweise abgeschlossene Läufe invalidieren den öffentlichen Auswertungscache; andere Worker zeigen spätestens nach 30 Sekunden den neuen Stand.

KI-Zusammenfassungen sind ein separater manueller Schritt für ein einzelnes Gebiet mit höchstens acht Vorgängen pro Klick und bestehenden Qualitätschecks. Die Schaltfläche wird nur bei eingerichtetem API-Zugang angeboten und benennt mögliche API-Kosten. Der frühere Aufruf `POST /api/internal/sync?mode=summaries` ist gesperrt, auch mit Importtoken. Geplante Textverarbeitung wird zusätzlich im Dienst abgewiesen. Quellenimporte im Modus `metadata` bleiben technisch getrennt möglich.

### DA-50 / Bearbeitungsstatus sichtbar halten

Die Analyseseite weist auf gespeicherte Ergebnisse und ausstehende Labelanalysen hin. Noch nicht analysierte Artikel bleiben im Gesamtbestand und im Nenner der Anteile enthalten; sie zählen zur offenen Gruppe, werden in Artikellisten und Feed aber ausdrücklich als „Analyse ausstehend“ benannt. Dies ist von einem bereits geprüften, mehrdeutigen Titel zu unterscheiden.

Artikelvergleiche verwenden ausschließlich gespeicherte Themenmerkmale. Fehlen Merkmale für den Ausgangsartikel, wird „Analyse ausstehend“ statt eines abgeschlossenen Nulltreffer-Ergebnisses angezeigt. Fehlen Vergleichsmerkmale im Gebietsbestand, bleiben die betreffenden thematischen Kartenwerte als ausstehend markiert; vorhandene Trefferlisten werden als unvollständig erläutert. Der Altbestand kann bereits Labels besitzen, obwohl Vergleichsmerkmale noch nicht gespeichert wurden. Deren erstmalige Speicherung benötigt ebenfalls einen manuellen Start.

### Abnahme

Regressionsprüfungen müssen unveränderte Datenbankinhalte nach öffentlichen Leseaufrufen, ausstehende statt automatisch erzeugter Labels, fehlende Merkmalsextraktion beim Lesen, reine Quellenimporte, Betreiber- und Origin-Prüfung, Sperrverhalten, Paketgrenze, manuelle Fortsetzung und Wiederaufnahme geänderter Titel abdecken. Für diese Umstellung wird kein produktiver Analyselauf ausgeführt.

Nachweis v0.20: 104 automatisierte Tests und TypeScript-Prüfung bestanden. Die manuelle Paketverarbeitung wird ausschließlich an einer lokalen Testdatenbank geprüft; der produktive Bestand wurde für diese Änderung nicht neu analysiert. Die Bedienung mit dem Betreiberkonto bleibt praktisch abzunehmen.


## 29 / Gespeicherte Artikelinhalte und Billerbeck-Test (v0.21)

### SA-43 / Verständlicher Inhalt als Kernfunktion

Jeder Artikel soll eine kurze KI-Inhaltszusammenfassung für die Übersicht und eine ausführlichere Fassung für die Detailseite erhalten. Grundlage sind tatsächlich gelesene öffentliche Vorlagen oder Niederschriften. Ein Dokumenttitel allein darf nicht als Zusammenfassung eines ungelesenen Dokuments erscheinen. Für jeden bearbeiteten Artikel wird deshalb auch ein Ergebnisstatus gespeichert: abgeschlossen, unzureichende Quelle, fehlgeschlagen oder veraltet. Fehlt Sachtext, zeigt die Website die konkrete Lücke. Zusammenfassungen bleiben nach der Bearbeitung in der Datenbank verfügbar.

### TA-29 / Kompakter Mindestdatensatz und Nachvollziehbarkeit

| Bereich | Gespeicherte Daten / Regel |
|---|---|
| Metadaten | Erstimport, letzter Quellenabruf, letzte interne Bearbeitung, amtliches Änderungsdatum soweit vorhanden. Unbekannte historische Zeitpunkte bleiben `null`. |
| Vorgang | Gebiet, Gremium und Sitzung, Datum, vorhandene Vorgangsnummer, stabile Quellkennung und Prozessstand. |
| Inhalt | Amtlicher Titel, Kurz- und Langzusammenfassung, Methode und Bearbeitungszeitpunkt. Vorschläge, Beratungen und Entscheidungen müssen sprachlich getrennt bleiben. |
| Belege | Originaladressen, begrenzte Belegzitate, Abrufzeitpunkte und SHA-256-Prüfsummen des verwendeten Quellenstands. Ein Hash belegt einen Stand, nicht dessen Vollständigkeit. |
| Labels | Regelbewertung, KI-Bewertung und eine gegebenenfalls später unabhängig geprüfte Referenz getrennt mit Methode, Eingabegrundlage und Zeitpunkt. Die Regelbewertung bleibt die Grundlage der bestehenden Karten und Zeitreihen. |
| Stichwörter | Begriff, positives ganzzahliges Gewicht, Summe genau 100; Methode, Eingabegrundlage und Bearbeitungszeitpunkt. Keine künstliche Auffüllung fehlender Begriffe. |
| Sitzungsteilnahme | Öffentlich dokumentierter Name, Rolle, Anwesenheitsangabe und Quellenverweis je Sitzung. Anwesenheit in einer Sitzung beweist keine Teilnahme an jedem einzelnen Tagesordnungspunkt. |
| Ergebnis | Belegter Beschluss beziehungsweise Kenntnisnahme, Datum, Abstimmungsbeschreibung und Zahlen nur bei vorliegenden Angaben. Umsetzungsstand wird getrennt gespeichert und bleibt ohne Beleg unbekannt. |
| Qualität | Technische Einzelprüfungen, konkrete Unsicherheiten, Quellenlücken und Status einer unabhängigen fachlichen Prüfung. |

Die aktuelle Artikelfassung bleibt in `topics.payload`. Frühere Fassungen stehen in `article_versions`. Die Migration `0003_typical_mauler.sql` ergänzt ausschließlich das Schema für `article_analyses`: getrennte, unveränderliche Auswertungsstände für Zusammenfassung, Regel-Label, KI-Label und Stichwörter. Sicherung, Auswertungsstände und Aktualisierung eines Artikels erfolgen in einer gemeinsamen Datenbanktransaktion. Migrationen enthalten keine Inhaltsimporte.

### TA-30 / Keine vollständige Originalsammlung

Vollständige Originaldokumente, HTML-Seiten und extrahierte Volltexte werden für diese neue Verarbeitung nur vorübergehend gelesen. Dauerhaft gespeichert werden kompakte Auswertung, begrenzte Belege, Prüfsummen und Originalverweise. Bereits vorhandene Auszüge im Altbestand werden durch diese Änderung weder erweitert noch pauschal gelöscht. Diese Vorgabe ersetzt eine etwaige frühere Forderung nach einer vollständigen Originalarchivierung.

Ein reiner Metadatenimport darf eine vorhandene KI-Zusammenfassung, belegte Sitzungsdetails oder getrennte Bewertungen nicht durch einen automatischen Quellenüberblick ersetzen. Änderungen an Titel, erfassten Ereignissen, Prozessstand oder Dokumentadressen markieren die Inhaltsanalyse als veraltet; ein geänderter Titel macht auch titelbasierte Stichwörter veraltet. Eine Änderung innerhalb eines Dokuments bei identischer Adresse wird erst bei erneutem gezieltem Inhaltsabruf sichtbar. Es wird keine automatische Neuanalyse ausgelöst.

### FA-48 / Ausdrücklich gestarteter Import vorbereiteter KI-Ergebnisse

Für diesen Test erstellt Codex die Bewertungen direkt anhand gelesener Originalinhalte, ohne externe KI-API. Das feste Paket `server/data/billerbeck-content-v1.json` wird ausschließlich durch einen bewussten Schreibaufruf in die produktive Datenbank übernommen. `POST /api/admin/prepared-analysis` verlangt Betreiberidentität und gleichen Ursprung. Für die vom Nutzer beauftragte technische Einspielung besteht zusätzlich `POST /api/internal/prepared-analysis` mit einem eigenen geheimen Diensttoken. Beide Wege akzeptieren nur das versionierte serverseitige Billerbeck-Paket, keine frei eingereichten Inhalte oder Datenbankbefehle.

Pro Aufruf werden höchstens 75 Artikel gespeichert. Gemeinsame Importsperre, Versionsprüfung, Wiederholungsschutz, Liste widersprüchlicher Artikel und Importprotokoll verhindern unbemerkte Überschreibungen. Geänderte Quelldatensätze benötigen einen erneuten Abgleich. Die Antwort zählt tatsächlich gespeicherte Analysestatus, KI-Labels und Stichwortprofile aus der Datenbank. Öffentliche Seiten, GET-Aufrufe, neue Deployments und Quellenimporte starten diesen Prozess nicht. Die vollständige aktuelle Nutzervorgabe autorisiert die einmalige Fortsetzung aller Pakete für den Billerbeck-Test; die Adminoberfläche startet je Klick nur ein Paket.

### DA-51 / Verständliche Detail- und Adminansicht

Die bestehende Gestaltung mit Fira Sans, dunkler Schrift, weißem Grund und Kobaltblau bleibt bestehen. Unter der Langfassung erscheinen Bearbeitungsstand und Quellenbasis, aufklappbare Belege, gewichtete Stichwörter und getrennte Labelbewertungen. Datumsangaben und unbekannte Werte werden verständlich bezeichnet. Sitzungsdetails erläutern die Reichweite der Anwesenheitsliste; fehlende Abstimmungszahlen werden nicht als null ausgegeben. Quellenlücken, Veraltung und fehlende unabhängige Prüfung sind textlich erkennbar.

Die Adminseite ergänzt Kennzahlen für abgeschlossene Inhaltszusammenfassungen, Quellenlücken, veraltete Analysen, KI-Labels und Stichwortprofile sowie den manuellen Import des Testpakets. Ein technisch abgeschlossener Lauf darf nicht als unabhängige fachliche Freigabe bezeichnet werden.

### QA-08 / Pilotumfang, Ergebnis und verbleibende Grenzen

Das vorbereitete Paket bearbeitet alle **402 Billerbecker Artikel**. Es enthält **310 quellenbasierte KI-Zusammenfassungen** und **92 dokumentierte Quellenlücken**. Die 310 enthalten 16 ausdrücklich protokollierte Antworten wie „Keine“; diese sind von leeren Überschriften zu unterscheiden. Die 92 Lücken bestehen aus 56 leeren Sammel-/Überschriftspunkten, 34 nur über eine Tagesordnung belegten Einträgen und zwei fehlenden inhaltlichen Berichten. Die Quellenlücken erhalten einen gespeicherten, ehrlichen Hinweis anstelle erfundenen Inhalts.

Alle 402 Artikel besitzen getrennte Regel-/KI-Labels und das bereits ausgearbeitete Stichwortprofil. Die Stichwörter beruhen weiterhin auf den Titeln: ein bis sieben Begriffe, ganzzahlige Gewichte mit Summe 100. Das ursprüngliche Ziel von zehn inhaltlich gehaltvollen Stichpunkten je Bericht bleibt damit teilweise offen; es wird nicht als bereits vollständige Inhaltsanalyse ausgegeben. Die KI-Labels beruhen bei verfügbarem Sachtext auf diesem, andernfalls auf dem ausdrücklich genannten Titel. Ein Vergleich zur Titelregel hat daher nicht überall dieselbe Informationsbasis und ist keine Genauigkeitsmessung.

Für 39 Sitzungen wurden öffentliche Teilnahmeangaben erfasst; die 508 Einträge sind Person-Sitzungs-Zuordnungen, keine 508 unterschiedlichen Menschen. 23 Artikel enthalten strukturierte Ergebnis-/Umsetzungsangaben. Sechs Quellen weisen erkennbare Widersprüche oder Rechen-/Datumsprobleme auf, die separat festgehalten werden. Fehlende Teilnehmer, Stimmenzahlen oder Sachverhalte werden nicht ergänzt.

Prüfungen müssen Paketvollständigkeit, Originalbelege, Quellenzuordnung, Grenzen der Textlänge, Gewichte, getrennte Methoden, Zugangsschutz, atomare Speicherung, Wiederholungsschutz und Erhalt bei Folgeimporten abdecken. Diese technischen Prüfungen und die Erstellung durch dasselbe KI-System ersetzen **keine unabhängige Inhaltsstichprobe**. Diese ist vor belastbaren Aussagen zur Genauigkeit weiterhin erforderlich. Einzelheiten und Zählregeln: [Billerbeck-Inhaltstest](billerbeck-content-pilot.md).


## 30 / Vollständige Artikelbestände online und lokal (v0.22)

### SA-44 / Derselbe vollständige Mindestdatensatz in beiden Betriebsarten

Alle Artikel sollen online und lokal die Angaben aus TA-29 enthalten. Dies umfasst insbesondere Bearbeitungsdatum, Gremium, Stadt/Kreis, öffentlich belegte Sitzungsteilnahme, Vorgangsnummer soweit vorhanden, bekannten Prozessstand, Titel, kurze und ausführliche KI-Inhaltszusammenfassung, Originalverweise, getrennte Regel-/KI-Labels und zehn inhaltsbasierte Stichwörter mit positiven ganzzahligen Gewichten und Summe 100. Die lokale Website darf nicht nur einen vereinfachten Ersatzbestand erhalten. Eine unbekannte Vorgangsnummer ist von belegtem Nichtvorliegen zu unterscheiden.

**Vollständige Übertragung ist nicht gleich vollständige inhaltliche Bearbeitung.** Fehlende, veraltete oder unzureichend belegte Inhalte bleiben offene Anforderungen. Es werden weder erfundene Teilnehmer ergänzt noch Titeltexte zu KI-Inhaltszusammenfassungen umbenannt. Zehn Stichwörter dürfen nicht durch Synonyme, allgemeine Füllbegriffe oder erfundene Inhalte erzwungen werden. Für inhaltsleere amtliche Einträge bleibt eine begründete Quellenlücke statt eines künstlichen Berichts.

### TA-31 / Vollständiger, überprüfbarer Datentransfer

Der Export umfasst alle Zeilen von `topics` einschließlich zusammengeführter Verweise, `article_versions`, `article_analyses` und `source_coverage` mit unveränderten Payloads. Metadaten, Sitzungen, Teilnehmer, Zusammenfassungen und Bewertungen werden vollständig übertragen, soweit gespeichert. Inhaltsimporte werden durch den Export nicht gestartet. Originaldokumente werden für die Sicherung nicht neu heruntergeladen.

Jede Inhaltsänderung erhöht durch Datenbanktrigger eine Revisionsnummer. Alle Exportseiten müssen dieselbe Revision besitzen. Wird während der Übertragung geändert, wird sie verworfen und muss neu gestartet werden. Begrenzte Seiten, SHA-256-Prüfsummen und erwartete Zeilenzahlen sichern die Übertragung ab. Prüfsummen belegen technische Integrität, nicht sachliche Richtigkeit oder eine unabhängige Freigabe. Migration 0004 ergänzt lediglich Tabelle und Trigger; sie füllt keine Artikel auf.

Der lokale Import läuft in einer einzigen Transaktion. Fehlerhafte, manipulierte oder unvollständige Daten werden zurückgerollt. Vorhandene Artikel werden standardmäßig nicht ersetzt. Ein expliziter Ersatz sichert zuerst die lokale SQLite-Datei. Lokale Anmeldung, Adminbindung und Push-Abonnements bleiben erhalten. Drei ausdrücklich erlaubte Initialisierungsmarker vermeiden ein späteres Überschreiben durch den mitgelieferten Anfangsbestand. Administrative Geheimnisse, Anmeldedaten, Abonnements, Sperren und Betriebsprotokolle gehören nicht in den fachlichen Transfer.

Eine wiederhergestellte Kopie entspricht genau dem Exportzeitpunkt. Automatische Synchronisation oder Konfliktauflösung zwischen zwei weiterbearbeiteten Datenbanken ist nicht Bestandteil dieser Änderung. Quellcode, Schema und Wiederherstellungswerkzeug gehören in Git; vollständige aktuelle Datenexports und SQLite-Sicherungen werden getrennt gesichert und standardmäßig ignoriert.

### FA-49 / Betreiberprüfung und Sicherung

Die Adminseite bietet eine manuell abrufbare Tabelle je Pflichtangabe für den Gesamtbestand und Billerbeck: vorhanden, offen sowie Anzahl der Artikel, die alle Kriterien gleichzeitig erfüllen. Unbekannte Werte zählen nicht als abgeschlossen. Die Prüfung klassifiziert nicht und erzeugt keine Inhalte. Zusätzlich kann der Betreiber den vollständigen Artikelbestand herunterladen. Der Betreiberzugang wird auf jedem API-Aufruf geprüft. Ein gesondertes geheimes Exporttoken erlaubt ausschließlich lesende Abrufe über den internen Exportendpunkt, keine Analyse oder Schreiboperationen.

### DA-52 / Verständliche Grenzen

Der Bereich „Datenbank & Vollständigkeit“ übernimmt Schrift, Tabellen, Farben und Schaltflächen der bestehenden Adminseite. Er nennt Fortschritt und Fehler, erläutert Sitzungsteilnahme und grenzt den Übertragungszeitpunkt von einer laufenden Synchronisation ab. „Vollständig übertragen“ darf nicht als „alle KI-Inhalte erstellt“ dargestellt werden.

### QA-09 / Abnahme und offene Inhalte

Technisch zu prüfen: vollständige Hin-/Rückübertragung einschließlich Analysehistorie; Erhalt der lokalen Adminbindung; gesperrter Zugriff auf geschützte Tabellen; Abbruch bei zwischenzeitlicher Inhaltsänderung; Rücknahme bei Prüfsummenfehler oder fehlenden Exportseiten; keine Schreiboperation beim Prüfen. Die tatsächliche inhaltliche Komplettierung des Gesamtbestands bleibt offen. Der bisherige Billerbeck-Stand aus QA-08 bleibt unverändert: 310 Inhaltszusammenfassungen, 92 Quellenlücken und titelbasierte Stichwortprofile mit weniger als zehn Begriffen. Ein Datenexport behebt diese Lücken nicht.

## 31 / Admin als Daten- und Verarbeitungszentrale (v0.23)

Diese Anforderungen konkretisieren SA-44, FA-49 und DA-52. Die bisherigen Einschränkungen zur manuellen Analyse, unabhängigen Prüfung und fehlenden vollständigen Originalarchivierung gelten weiter.

### FA-50 / Zwei Adminseiten und territoriale Übersicht

Seite 1 (`/admin`) ist die primäre Arbeitsansicht: NRW-Karte, Bestands- und Abrufstatus, Kommunen-/Kreisauswahl, Verarbeitungsstufen, gespeicherte Aufträge, Datenbankprüfung und Export. Seite 2 (`/admin?seite=2`) enthält Qualitätsstatistiken, Prüflisten, historische Importläufe, das ältere vorbereitete Billerbeck-Paket, optionale API-Zusammenfassungen und Betriebseinstellungen. Der bisherige Betreiberzugang schützt beide Seiten und jeden Verwaltungsendpunkt.

Die Karte zeigt Kommunen und Kreise in getrennten Ebenen. Auswahl ist per Karte und per beschrifteter Liste möglich. Gebiete ohne Quelle, angebundene Gebiete ohne Daten, Teilbestände, vorhandene Daten und fehlgeschlagene letzte Abrufe müssen unterscheidbar sein. Weitere Kartenfarben zeigen Berichtszahlen und den Anteil abgeschlossener Verarbeitungsschritte. Fehlende Daten sind kein Nullwert politischer Aktivität. Die Karte wird als statische Datei nachgeladen, keine Analyse beim Öffnen.

Je Gebiet: Zahl kanonischer Berichte, Zeitpunkt des letzten Versuchs und der letzten erfolgreichen Übernahme, letzte gespeicherte Bearbeitung, Quellenmethode, Abrufhinweise und Zähler je Prozessschritt. Ein später fehlgeschlagener Abruf darf den letzten erfolgreichen Stand nicht verdecken oder löschen.

### FA-51 / Manuelle Auswahl und gespeicherte Aufträge

Einzelne Gebiete, mehrere Gebiete, alle Gebiete mit Daten oder ganz NRW (396 Kommunen und 31 Kreise) können ausgewählt werden. „Ganz NRW“ bedeutet alle Kataloggebiete, keine Behauptung einer bereits vollständigen Quellenanbindung. Nicht angebundene Quellen bleiben mit Begründung offen.

Ein ausdrücklicher Start erzeugt eine gespeicherte Warteschlange. Für Stufe 1 wird je Schritt ein Gebiet abgerufen; Stufe 2 verarbeitet bis zu 500 Artikel eines Gebiets und setzt innerhalb des beauftragten Sammelauftrags fort. Schließen der Browserseite stoppt die weitere Ausführung nach dem laufenden Serveraufruf. Wiederöffnen darf keine Verarbeitung starten: Fortsetzen benötigt einen Klick. Pause wirkt nach dem aktuellen Schritt. Abbruch löscht keine gespeicherten Daten. Bei abgerissener Antwort wird ein möglicherweise bereits gespeicherter Schritt als „Ausgang prüfen“ markiert, statt unbemerkt wiederholt zu werden. Bestehende Import- und Auftragssperren verhindern parallele Schreibläufe.

### TA-32 / Stufe 1: öffentliche Quelldaten ohne KI

Es werden die über angebundene OParl-/RIS-Adapter erreichbaren öffentlichen Angaben übernommen: Identität, Zeitpunkte, Titel, Referenz, Gremien, Sitzungen, Beratungsergebnisse, Dokument- und Protokollverweise, belegte Teilnehmerangaben und zusätzliche strukturierte Quellfelder. OParl-Teilnehmer stammen aus dem expliziten `participant`-Feld, nicht aus Gremienmitgliedschaften. SessionNet liest erkannte öffentliche Teilnahmetabellen und verlinkte Vorlagendetails. Nicht öffentliche Tagesordnungspunkte werden ausgeschlossen. Original-HTML/PDF und vollständige Texte werden nicht dauerhaft gesammelt (TA-30).

**Vollständige Extraktion bleibt das Ziel, keine pauschale Erfolgsgarantie:** Anbieterformate, nicht freigegebene Unterlagen, fehlende Felder, Pagination und begrenzte Abrufzeit können Lücken erzeugen. SessionNet-Detailfelder werden für bekannte tabellarische Strukturen gelesen; unbekannte RIS-Layouts und nicht exponierte Teilnehmerdaten sind nicht automatisch vollständig erschlossen. More-Rubin liefert im aktuellen Adapter keine gesicherte Teilnehmerliste. Der Status muss Teilstände und solche fehlenden Pflichtfelder anzeigen. Ein weiterer gleicher Abruf garantiert keinen Fortschritt jenseits eines festen Anbieter-/Zeitlimits; anbieterspezifische Fortsetzung bleibt ein weiterer Ausbaupunkt. Die neue Oberfläche allein ersetzt keine fehlenden Quellenadapter.

### TA-33 / Stufen 2 und 3: Regeln und KI-Agenten

Regel-Labels und Vergleichsmerkmale werden getrennt von KI-Ergebnissen gespeichert. Stufe 3 erlaubt unabhängige Auswahl von KI-Inhaltszusammenfassung, KI-Label und zehn gewichteten Inhaltsstichwörtern. Titelbasierte alte Stichwortprofile zählen nicht als vollständige Inhaltsstichwörter. KI-Labels zählen in Stufe 3 nur bei ausgewiesener Inhaltsbasis (`source_content`); die 92 alten Titel-/Teilinhalt-Labels bleiben gespeichert, zählen dort aber offen. Die historischen Qualitätsstatistiken auf Seite 2 dürfen weiterhin alle KI-Labels getrennt zählen. Gewichte bleiben positiv und ganzzahlig; Summe 100.

Für den gewählten Ablauf ohne zusätzliche KI-API erstellt die Adminseite einen Auftrag mit 1–100 fest ausgewählten Artikeln (Standard: 10), Quellverweisen, Methodenversion, Labelkatalog und Eingabeprüfsummen. Dieser Auftrag startet keinen KI-Agenten fern. Der Betreiber startet den KI-Agenten seiner Wahl manuell mit der Auftragsdatei. Neue Aufträge verwenden die agentenunabhängige Methode `ai-agent-content-v1`; tatsächlicher Agent und Modell werden je Ergebnis gespeichert. Vorhandene historische Methodenkennungen bleiben erhalten. Die Ergebnisdatei kann im Adminbereich geprüft und in die verbundene Datenbank übernommen werden; alternativ lokal durch `scripts/ai-job.mjs` mit Sicherung und erneuter Öffnung zur Prüfung. Die verbindliche ausführbare Arbeitsanweisung steht in `requirements/ai-processing.md`.

Schema, Belege, aktuelle Eingabefassung, Auswahl, Labelkatalog und Gewichte werden vor dem Speichern geprüft. Erfolgreiche Ergebnisse, begründete Quellenlücken und technische Fehler erhalten getrennte Analysefassungen. Quellenlücken ersetzen keine guten vorhandenen Inhalte. Wiederholungen sind ohne Doppelanalysen möglich; zwischenzeitliche Änderungen erzeugen Konflikte. Validierte KI-Ergebnisse sind weiterhin nicht unabhängig fachlich freigegeben. Unterschiedliche Informationsbasis bleibt beim späteren Regel-/KI-Vergleich sichtbar.

### TA-34 / Stufe 4: nachvollziehbare Speicherung

Die Oberfläche liest ihre Zahlen aus der aktuell verbundenen Datenbank und zeigt deren Inhaltsrevision. Nach KI-Import werden die gespeicherten Payloads erneut gelesen; der Importbeleg nennt gespeicherte und bereits vorhandene Artikel sowie Konflikte. Ergebnisse aller abgeschlossenen Stufen sind unmittelbar in dieser Datenbank gespeichert.

Ein Export belegt nur die heruntergeladene Momentaufnahme. Eine Online-Seite hat keinen automatischen Einblick in die Windows-Datenbank. Erst die lokale Wiederherstellung hinterlegt einen Übernahmebeleg mit Quellstand, Anzahl und lokaler Revision. Die lokale Adminseite zeigt diesen Beleg und den aktuellen Bestand. Bei direktem lokalen Arbeiten ist kein zusätzlicher Export erforderlich. Für ältere Übernahmebelege ohne lokale Revision darf nicht behauptet werden, der Stand sei seitdem unverändert.

### DA-53 / Arbeitsfläche und zugängliche Statusdarstellung

Fira Sans, Kobaltblau und die bestehende Typografie bleiben erhalten. Oben: Seitennavigation, kompakte Bestandszahlen, Karte und auswählbare Gebietsliste. Darunter: vier nummerierte Stufen mit Zahlen, Aktionen und klaren offenen Zuständen. Farbcodes werden durch Text, Legende und Liste ergänzt. Such- und Mehrfachauswahl funktionieren unabhängig von der SVG-Karte per Tastatur. Auf kleinen Bildschirmen stehen Karte, Liste und Schritte untereinander. Tabellen/Listen sind begrenzt und eigene längere Listen scrollbar. Die zweite Adminseite darf die operative Hauptansicht nicht ersetzen.

### QA-10 / Prüfungen

Zu prüfen sind Zugangsschutz der neuen Endpunkte, Gebietseingaben einschließlich Gesamt-NRW, Wiederaufnahme/Abbruch, erhaltene Quellenlücken, keine GET-Mutationen, korrekte SQL-Zähler, deterministische Integer-Gewichte, unveränderte Regel-Labels, Quellen-/Hashkonflikte, Wiederholung identischer Ergebnisse, atomare Speicherung und lokale Importbelege. Keine dieser Prüfungen startet einen echten NRW-Import oder kostenpflichtige KI-Aufrufe. Ein vollständiger NRW-Abruf und eine unabhängige Bewertung neuer KI-Texte sind gesonderte Betriebsschritte.
