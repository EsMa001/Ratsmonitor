# vor Ort · Billerbeck und Region

Responsive MVP zum Lesen öffentlicher Kommunalpolitik. 396 NRW-Städte und Gemeinden sowie 31 Kreise / Städteregionen zur Auswahl; zwölf Monate angefragter Rückblick plus veröffentlichte anstehende Beratungen. Keine Kommentare oder Beteiligungshinweise.

## Daten

Münster nutzt OParl: https://oparl.stadt-muenster.de/system. Die Erweiterung nutzt die öffentliche More-Rubin-API für Recklinghausen und SessionNet-HTML für Billerbeck, Coesfeld, Steinfurt und Warendorf. Borkens öffentlicher Zugang antwortet mit HTTP 403; die Auswahl bleibt mit sichtbarer Datenlücke verfügbar. Eine fehlgeschlagene OParl-Standardpfadprüfung beweist nicht die Abwesenheit jeder Schnittstelle. Bei einem künftig gefundenen OParl-System wird der Import bis zur passenden Adapterkonfiguration angehalten, statt die offizielle Schnittstelle zu umgehen.

Der erste regionale Initialbestand enthält 437 zusätzliche Artikel (84 Billerbeck, 99 Coesfeld, 149 Steinfurt, 44 Warendorf, 61 Recklinghausen). Quellenstand und Teilfehler stehen auf `/quellen`. `node scripts/import-regions.mjs` aktualisiert die regionalen Quelldateien und behält bereits gespeicherte Artikel bei Fehlern. Es werden ausschließlich öffentliche Tagesordnungspunkte eingelesen; Zugangssperren werden nicht umgangen.

Der versionierte Bestand einschließlich Zwölf-Monats-Nachladung umfasst nach lokalem Abgleich 24.921 kanonische Artikel aus 43 Gebieten (39 Kommunen, vier Kreise). Die zwanzig jüngst ergänzten Kommunen im Münsterland und nördlichen Ruhrgebiet liefern nach dem Folgeimport 8.993 Artikel. Er ist keine NRW-Vollerhebung und keine Live-Zählung der Datenbank. Die vollständige Aufteilung sowie offene Anforderungen stehen im Hauptdokument.

Verbindliche Ergänzungen zu Fachlichkeit, Datenbank, Vergleich und Gestaltung: [Konsolidierte Anforderungen v0.22](requirements/vor-Ort_Anforderungen.md).

Der initiale Münster-Datenstand enthält 537 Vorgänge aus 57 Sitzungen (Stand 20.09.2026); fünf nicht erreichbare Verknüpfungen sind als Abdeckungslücke ausgewiesen. Bei 317 Vorgängen wurde Dokumenttext aus über OParl gelieferten PDFs gewonnen. Sieben Beiträge haben bei der Erstellung des MVP KI-Zusammenfassungen erhalten; weitere Beiträge zeigen transparente Quellenüberblicke und Originalauszüge. Es werden keine erfundenen Ratsdaten verwendet.

OParl liefert nicht immer sämtliche Daten; Ergebnisse werden ausschließlich aus `AgendaItem.result` abgeleitet. Ein Beschluss benötigt eine entscheidende Beratungsrolle oder `authoritative=true`. Ankündigungen und Empfehlungen sind keine endgültige Entscheidung. Dokumenttexte können OCR-Fehler enthalten. Auszüge ersetzen keine Zusammenfassung. Die Zuordnung von Themengebieten ist eine regelbasierte Orientierung.

## Administration

`/admin` bündelt Datenbankbestand, Quellenzustand, Inhaltsprüfliste, Importverlauf und Betriebsstatus. Einstieg auch über „Über vor Ort → Administration“. Die Seiten für Bürger bleiben öffentlich. „Artikel online“ zählt kanonische Vorgänge ohne Aliasdatensätze; die Zahlen werden bei Aufruf und über „Zahlen aktualisieren“ aus der Datenbank geladen. Ein Fehler liefert keine scheinbar aktuellen Snapshot-Zahlen.

Für die erste Nutzung mit ChatGPT anmelden und den separat übergebenen Freischaltcode eingeben. Die erste erfolgreiche Zuweisung bindet die vom Sites-Dispatcher verifizierte Nutzer-ID atomar an `system_state['admin-owner-v1']`. Danach genügt dieses Konto. Ein gleichlautender Anzeigename oder dieselbe E-Mail genügt nicht. Zugang wird auf jeder Admin-API geprüft; Schreibaktionen benötigen dieselbe Origin. Metadatenimport je Quelle verwendet die bestehende globale Importsperre. Der CSV-Export enthält den aktuellen Quellenfilter. Die Prüfliste erlaubt noch keine redaktionelle Bearbeitung.

Einrichtung auf einem neuen Deployment: einen kryptografisch zufälligen Code mit mindestens 24 Zufallsbytes erzeugen, dessen SHA-256-Hexdigest als geheimen Runtime-Wert `ADMIN_SETUP_HASH` konfigurieren, neu deployen und den Originalcode dem Betreiber separat geben. Der Code darf nicht im Repository, in Logs oder URLs stehen. Nach der Erstzuweisung ist er wirkungslos; ein Austausch des Hashs setzt den Besitzer nicht zurück. Ein Kontowechsel erfordert einen kontrollierten administrativen Eingriff in die Besitzerzuweisung mit erneuter sicherer Freischaltung. Kein öffentlicher Reset-Endpunkt.

Für einen späteren Umzug ins eigene Repository sind die Anwendungslogik und SQL-Datenhaltung getrennt. Außerhalb von Sites müssen `getChatGPTUser()` und die Anmeldelinks durch eine verifizierte Anmeldung ersetzt werden. Niemals ungeschützte eingehende `oai-authenticated-*`-Header als Identitätsnachweis verwenden. API-/Zähltests stehen in `tests/admin.test.mjs`; die manuelle Anmeldung mit dem Betreiberkonto ist zusätzlich abzunehmen.

## Entwicklungsumgebung

Ladezeitkorrekturen v0.19 (weiterhin gültig): Die Datenbankinitialisierung hält keine laufenden Anfragen in einer globalen Promise fest. Kanonische Gebiets-/Statuszählungen verwenden einen partiellen Index; die Sitzungsvorschau liefert direkt höchstens zwei Sitzungen. Analysen übertragen nur benötigte Quelldaten und verwenden nach Version und Originaltitel geprüfte bestehende Labels. Fertige öffentliche Auswertungen werden höchstens 30 Sekunden für bis zu drei Auswahlen gecacht; Importläufe invalidieren den Cache. Die Karte wird bei Annäherung an den sichtbaren Bereich geladen, Artikellisten erst beim Aufklappen und in Portionen von 30. Der vollständige Bestand und die fachlichen Ergebnisse bleiben erhalten. Messwerte und Grenzen: [Performance-Nachweis](requirements/performance-review-2026-09-27.md).

Das Projekt verwendet Vinext/React, Tailwind und die vorhandenen Shadcn-Komponenten; D1 hält Themen, Quellenstand, Importprotokolle und Push-Abonnements. Logische Bindungen stehen in `.openai/hosting.json`, Schema in `db/schema.ts`, Migrationen in `drizzle/`.

Installations-, Build- und Preview-Abläufe entsprechen dem Sites-Starter. Neue Schemaänderungen mit `npm run db:generate` erzeugen und prüfen. Lokal die Migrationen in Reihenfolge mit Wrangler auf DB anwenden. Keine DDL im Request-Pfad.

`node scripts/import-data.mjs` lädt den rollierenden OParl-Bestand. Der lokale JSON-Cache dient reproduzierbaren Entwicklungsläufen; vor einem neuen aktuellen Abruf `.oparl-cache` leeren oder einen frischen Checkout verwenden. `node scripts/enrich-documents.mjs` extrahiert PDF-Text mit dem lokal installierten `pdftotext`. Die Laufzeitimplementierung nutzt `unpdf`.

`node --test tests/*.test.mjs` prüft die politischen Statusregeln, Paginierung, Quelleneinschränkung und das Verwerfen unbelegter KI-Zahlen. `node node_modules/typescript/bin/tsc --noEmit` prüft die Typen.

## Laufender Betrieb: noch erforderliche Einrichtung

Der veröffentlichte MVP zeigt den initialen Datenstand. Ein unabhängiger Scheduler ist noch **nicht eingerichtet**. Für regelmäßige Aktualisierung muss dieser den geschützten POST-Endpunkt `/api/internal/sync` mit `Authorization: Bearer IMPORT_TOKEN` aufrufen, beispielsweise stündlich. Auf privaten Sites muss der Aufrufer zusätzlich von der vorgeschalteten Zugriffskontrolle zugelassen sein. Private Zugangstoken nicht in URLs verwenden. Der Import aktualisiert die Datenbank und löst bei neu erkannten Entscheidungen Push aus. Anfragen werden durch eine Importsperre serialisiert; ein Teilfehler wird protokolliert. Nach Fehlern den Datenstand prüfen und den Import wiederholen.

Textverarbeitung startet ausschließlich im angemeldeten Adminbereich über die separate Schaltfläche für KI-Zusammenfassungen (ein Gebiet, bis acht Vorgänge je Klick, nur bei konfiguriertem API-Zugang). Der alte interne `mode=summaries`-Aufruf und geplante Textverarbeitung sind gesperrt. Keine automatische Fortsetzung.

Für laufende KI-Zusammenfassungen wird ein vom Betreiber bereitgestellter `OPENAI_API_KEY` benötigt. Er ist **nicht hinterlegt**. Der Nutzer hat das zusätzliche OpenAI-Plugin für diesen Auftrag abgelehnt. Ohne Schlüssel bleiben für noch nicht ausgewertete Artikel Quellenüberblicke erhalten. Der direkt durch Codex erstellte Billerbeck-Test benötigt keinen API-Schlüssel; seine gespeicherten Inhaltszusammenfassungen sind davon unabhängig. `OPENAI_MODEL` ist konfigurierbar. Die KI-Kette erstellt neutralen Text, prüft Belegzitate und numerische Angaben und führt eine weitere Modellanfrage zur Sachprüfung aus. Fehlgeschlagene Ergebnisse werden nicht veröffentlicht; es bleibt der Quellenüberblick. Eine fortlaufende unabhängige Stichprobenevaluation ist organisatorisch noch festzulegen. Modellanfragen verursachen nutzungsabhängige Kosten.

Push-Abonnements werden nur nach Zustimmung im Browser dauerhaft in D1 gespeichert; Abmeldung löscht das Abonnement. VAPID-Schlüssel sind als Laufzeitvariablen gesetzt, der private Schlüssel bleibt geheim. Versand verwendet leere Web-Push-Nachrichten mit VAPID; der Service Worker liest das jüngste Entscheidungsereignis derselben Site. Abgelaufene Abonnements werden entfernt. Initiale historische Beschlüsse erzeugen keine Benachrichtigungsflut. Tatsächliche Endgeräte-Zustellung muss auf einem HTTPS-Endgerät nach Aktivierung und einem neuen Import geprüft werden. iOS erfordert die Installation auf dem Home-Bildschirm. Auf privater Veröffentlichung kann eine abgelaufene Anmeldung Detailabrufe verhindern; die Nachricht enthält dann einen allgemeinen Hinweis.

## Vor öffentlichem Pilotbetrieb

Die bestehende Site ist öffentlich. WhatsApp öffnet eine vorgefüllte Nachricht mit Titel und Thema-Link; der Nutzer wählt Empfänger und Versand. Der Link gewährt selbst keinen Zugriff. Für einen Bürgerpilot müssen Veröffentlichungszugriff, verantwortlicher Betreiber/Impressum, Datenschutzinformationen, Finanzierung und regelmäßige Qualitätsstichproben geklärt werden. Diese organisatorischen Angaben wurden nicht erfunden.

Bilder werden nur aus verifizierten Originalunterlagen verwendet; aktuell ist die Darstellung bildfrei. Ein automatisches Auswählen eingebetteter PDF-Grafiken ist noch nicht enthalten.

## Architektur und API

Ein gemeinsames Projekt mit klaren Modulgrenzen und einem Deployment:

- `components/`: Oberfläche und Browserinteraktion. Kein Datenbank- oder Integrationszugriff.
- `app/`: serverseitige Seiten, die Daten über Repositories laden; `app/api/` bildet die HTTP-Schnittstelle.
- `shared/`: öffentliche Datentypen (`TopicCard`, `TopicDetail`, `FeedPage`), Statusdarstellung und Paginierungsvertrag. Keine Serverabhängigkeiten.
- `server/repositories/`: D1-Abfragen, Initialbestand und Rückfall auf den mitgelieferten Stand.
- `server/services/`: Importsteuerung, Dokument-/Zusammenfassungsablauf und Push-Versand.
- `server/integrations/`: OParl, PDF-Auswertung und KI-Dienst; auch von lokalen Importskripten nutzbar.
- `server/mappers/`: explizite Feldauswahl für Karten und Details. Rohtexte, interne Diagnosefelder und unbekannte Zusatzfelder gelangen nicht in API-Antworten.
- `server/types.ts`: internes gespeichertes Themenmodell; `db/` und `drizzle/`: Datenbankschema und Migrationen.

Server-Einstiegsmodule sind mit `server-only` geschützt. Ein Architekturtest prüft zusätzlich transitive Imports von Komponenten und gemeinsamen Modulen. Die bestehenden fachlichen Tests bleiben erhalten.

### Lesende API für Website und spätere App

`GET /api/topics?limit=12&cursor=…` liefert `topics: TopicCard[]`, `total`, `nextCursor`, `coverage` und `storageAvailable`. Ohne Cursor beginnt die erste Seite; `limit` ist 1–50, Standard 12. Den Cursor unverändert mit `URLSearchParams` an den nächsten Aufruf übergeben. `nextCursor: null` bedeutet Ende. Ungültige Parameter liefern HTTP 400, ein zwischenzeitlich geänderter Importstand HTTP 409; dann bei der ersten Seite beginnen. Die Reihenfolge verwendet Aktualisierungsdatum, Vorlagenkennzeichen und ID als eindeutigen letzten Sortierschlüssel. Die aktuelle Implementierung nutzt begrenzte SQL-Abfragen mit Offset und bindet Cursor an den Importstand.

`GET /api/topics/{id}` liefert ein `TopicDetail` mit Langfassung, Verlauf und Originaldokumenten, jedoch ohne interne Dokumentrohtexte. Unbekannte oder ungültige IDs liefern HTTP 404. HTTP 500 steht für einen unerwarteten Fehler. Bei einer späteren privaten Veröffentlichung gilt die vorgeschaltete Zugriffskontrolle auch für diese API.

Die Startseite liefert zunächst zwölf Karten serverseitig. Der Button lädt weitere Karten per API, zeigt einen Ladezustand und erlaubt bei Netzwerkfehlern einen erneuten Versuch. Die Quellenseite lädt aggregierte Zähler statt aller Themen. Es werden weiterhin derselbe Bestand, dieselben Originalverweise und dieselben Prozessregeln verwendet.

Der interne Importendpunkt prüft Authentifizierung und Modus, delegiert dann an `runSync`. Scheduler und laufende KI-Konfiguration bleiben die oben beschriebenen offenen Betriebsschritte.

## Design: Entwurf 2

Das vom Nutzer gelieferte Design wurde in die React-Seiten übertragen: Fira Sans (lokal eingebunden, Lizenz in `public/fonts/`), schwarz-weiße redaktionelle Darstellung, Kobaltblau für Bedienung, vier Prozessbalken und feste untere Navigation. Designvariablen und Komponentenstile stehen in `app/design-*.css`.

Die Startseite bleibt direkt die Themenübersicht. `/ueber` entspricht dem Einstieg, `/mitteilungen` zeigt die tatsächlich verfügbare Push-Einstellung und zuletzt erfasste Entscheidungen. Die im Entwurf dargestellten, noch nicht implementierten Optionen für Tagesordnungs-Push und tägliche Bündelung werden nicht als aktive Einstellungen angeboten. Beispielkosten, Bildplatzhalter und ein funktionsloser Fehler-melden-Link wurden nicht übernommen.

Die Themen-API unterstützt zusätzlich `filter=alle|offen|entschieden`. Offen umfasst angekündigte, in Beratung befindliche, empfohlene und vertagte Themen. Entschieden umfasst Beschlüsse und Ablehnungen. Kenntnisnahmen und unbekannte Stände erscheinen unter Alle. Cursor sind an ihren Filter gebunden. Anstehende Sitzungen stammen aus veröffentlichten Ereignissen im vorhandenen Bestand und werden nach Datum zusammengefasst.

## Regionale Datenbank und Themenvergleich (v0.5)

`topics.region_id` trennt die Gebiete. IDs werden mit dem Gebiet präfixiert; alte Münster-IDs bleiben gültig. Die zusätzliche Migration `0001_high_brood.sql` ergänzt den Gebietsindex, `article_versions` und `source_coverage`. Der Metadatenimport archiviert die bisherige Artikelfassung und schreibt die neue Fassung in derselben D1-Transaktion. Fehlende Artikel werden niemals aufgrund eines Teilimports gelöscht.

`GET /api/topics?region=coesfeld` und die Startseite `/?region=coesfeld` wählen das Gebiet; Standard ist Billerbeck. Cursor sind an Gebiet und Filter gebunden. `GET /api/topics/{id}/related` liefert Vergleichsartikel, unterschiedliche Kreise je Zeitgruppe, Gründe und Abdeckung. Berechnung aus den gespeicherten Originaltiteln, ohne externe KI. Die Methode `subject-terms-v1` nutzt spezifische Sachbegriffe oder mindestens zwei Titelbegriffe mit 60 % Überschneidung. Sie liefert Hinweise, keine Gleichheit von Vorlagen oder politische Bewertungen.

Stadtartikel und der eigene Kreis sind ausgeschlossen. Bei kreisangehörigen Stadtartikeln wird die Kreiszuordnung verwendet, bei Kreisartikeln direkt die eigene Kreis-ID. Diese Aufrufwege sind durch Repository-Integrationstests geprüft. Ein Kreis zählt insgesamt einmal, kann jedoch in mehreren Zeitgruppen auftreten. Offen mit letztem Termin innerhalb +/-90 Tagen = aktuell; finales Ergebnis oder letzter Termin älter als 90 Tage = früher; sonst unklar. Ein unklarer aktueller Status zählt nicht als laufende Beratung. Jeder Treffer ist mit Artikel und Original belegt.

Der interne Import unterstützt die bisherigen Kerngebiete und alle im gemeinsamen Quellenkatalog konfigurierten NRW-Gebiete. Für vollständige Aktualisierung alle Gebiete nacheinander aufrufen. Scheduler und laufende KI-Erzeugung sind weiterhin nicht eingerichtet. Push bleibt ausdrücklich auf Münster begrenzt und wird durch die neue Feed-Auswahl nicht umgestellt.

## Analysen und Label-Katalog

`/analysen` und `GET /api/analytics` verwenden `region`, `label`, `from`, `to`, `level=all|city|district` und optional `topic`. Vorgänge zählen nach öffentlichen Sitzungsterminen einmal pro Monat und einmal über den gesamten Zeitraum. Fehlende Termine und Zukunftstermine gehen nicht in vergangene Anteile ein. Anteile inklusive unklarer Einordnungen ergeben 100 %. Ein zeitlich unvollständiger Quellenstand bleibt als Teilstand sichtbar.

13 Hauptlabels, darunter getrennt Kultur und Sport & Freizeit. Die erste Klassifikation (`title-rules-v2`, Katalog `labels-v2`) nutzt eindeutige Sachbegriffe im Originaltitel; mehrdeutige Titel bleiben offen. Zwei zusätzliche strukturelle Gruppen kennzeichnen allgemeine Anfragen/Mitteilungen und Sitzungsablauf/Gremienarbeit. Alle Gruppen bleiben im Nenner der Anteile. Der Bestandsvergleich steht in `requirements/label-evaluation-v2.md`. Hauptlabel, Zusatzlabels, Grund, Originaltitel, Quelladresse und Version werden im Artikel-Payload gespeichert; fehlende oder veraltete Einordnungen werden ausschließlich nach ausdrücklichem Betreiberstart bearbeitet. Die Analyseansicht aggregiert gespeicherte Ergebnisse; sie klassifiziert keine Artikel nach. Eine unabhängige fachliche Evaluation ist noch offen. Kein laufender KI-Schlüssel nötig.

Die Deutschlandkarte nutzt amtliche BKG-Verwaltungsgrenzen, lokal gespeichert unter `public/geo/`. Quellen, Lizenz und Veränderungen stehen in `public/geo/SOURCES.md`. Nur Gebiete mit auswertbaren Daten werden thematisch gefärbt; bundesweite Flächen sind keine bundesweite politische Erhebung. Die Standardansicht zeigt den Anteil am jeweiligen erfassten Bestand. Über „Einfärbung der Karte“ stehen zusätzlich Anzahl, zeitliche Veränderung, häufigstes Sachgebiet, offene Labels und Datenabdeckung zur Verfügung; die Legende und Wertetabelle wechseln gemeinsam. Keine Ansicht zeigt Einwohnerdichte oder Budget. Ein Zoom auf die erfasste Region und eine zugängliche Datentabelle ergänzen die Karte. Ohne Vergleichsartikel wird die Verteilung des Hauptlabels gezeigt; mit Artikel werden konkrete Themenähnlichkeiten berechnet. Die bisherige Kreisvergleichsfunktion bleibt separat.

Die Veränderungskarte vergleicht zwei gleich lange Tagesabschnitte innerhalb des ausgewählten Zeitraums, mindestens zehn Vorgänge pro Abschnitt. Bei ungerader Tageszahl wird nur für diesen Vergleich der mittlere Tag ausgelassen. Alle Gebiete nutzen dieselben Grenzen. Die Differenz wird in Prozentpunkten dargestellt. Für das häufigste Sachgebiet gelten mindestens zehn Gesamtvorgänge; formale und offene Gruppen gewinnen nicht, Gleichstände bleiben sichtbar. Die Ansichten Häufigstes Sachgebiet, offene Labels und Datenabdeckung verwenden den Gesamtbestand unabhängig vom Vergleichsartikel. „Teilstände ausblenden“ schraffiert unvollständige Bestände; in der Abdeckungsansicht bleiben sie sichtbar. Regeln und Skalen: `shared/map-metrics.mjs`; Berechnungsnachweise: `tests/map-metrics.test.mjs`.


## NRW-Verzeichnis und portable Importjobs

`shared/nrw-regions.json` enthält 396 Gemeinden und 31 Kreise einschließlich Städteregion Aachen. Amtliche Schlüssel sind eindeutig; bisherige URLs behalten ihre IDs. `city` umfasst technisch auch Gemeinden. Gemeinde- und Kreisdaten dürfen nicht addiert werden, als seien sie dieselbe Verwaltungsebene.

`server/integrations/nrw-sources.json` enthält 57 zusätzliche OParl-Kandidaten aus dem offiziellen OParl-Verzeichnis. Ein gefundener Endpunkt ist noch keine erfolgreiche Anbindung. Nur explizit öffentliche Tagesordnungspunkte werden gespeichert. Nicht konfigurierte Orte bleiben auswählbar und erhalten einen erklärten Leerzustand. Fehler und begrenzte Abrufe bleiben in der Quellenabdeckung sichtbar. Das NRW-Verzeichnis bedeutet keine flächendeckende Artikelerfassung.

Import unabhängig vom Webhosting (Node 22+):

```sh
node scripts/import-nrw.mjs
node scripts/import-nrw.mjs nrw-05114000
node scripts/export-nrw.mjs
```

Einzelne Ergebnisse liegen unter `data/nrw/`, der vorläufige Sammelstand unter `data/nrw.json`. Der explizite Export erzeugt `data/nrw-seed.json` als Manifest und lesbare, prüfsummengesicherte JSON-Teile in `data/nrw-seed-parts/` für Review und Git. `scripts/nrw-snapshot-file.mjs` liest diese oder ältere Ein-Datei-Exporte verlustfrei. `data/nrw-seed-gzip.json` enthält dieselben Daten verlustfrei komprimiert je Gebiet für die Anwendung; nur diese Fassung wird in den Worker eingebettet. Initialimport und Ersatzstand entpacken gezielt einzelne Gebiete. Vorhandene Artikel bleiben bei Fehlern erhalten. Drei Quellen werden parallel bearbeitet. Der generische Adapter begrenzt Abrufe auf 350 Anfragen, standardmäßig sechs Listenseiten (quellenspezifisch maximal 24), fünf Minuten Laufzeitbudget je Quelle, bis zu 55 Sekunden pro Antwort und 5.000.000 Zeichen im gelesenen JSON-Antworttext. Nur Ochtrup erhält wegen seiner nachgewiesen größeren OParl-Sitzungsliste ein Limit von 7.000.000 Zeichen und eine Listenseite; dies bleibt als Teilstand kenntlich. Das ist kein Streaming- oder hartes Byte-Limit. Es gibt noch keinen automatischen Scheduler. Keine API-Schlüssel erforderlich. Für öffentliche Portale ohne nutzbare API muss der vorhandene SessionNet-Adapter mit einer bestätigten Quelle konfiguriert oder ein passender neuer Adapter implementiert werden. 401/403 werden nicht umgangen.

Frontend: `app/` und `components/`; fachliche Regeln: `shared/`; Integrationen und Persistenz: `server/`; Migrationen: `db/`. Importjobs verwenden keine Cloudflare-Imports. Die Web-Persistenz ist derzeit D1-gebunden; für anderes Hosting ist ein Datenbankadapter nötig. Der Git-Checkout enthält Anwendung, Quellenkonfiguration, Anforderungen, Tests und Migrationen; Secrets gehören ausschließlich in Umgebungsvariablen.

Gebietsdaten reproduzieren: `python3 scripts/fetch-nrw.py`, dann `python3 scripts/build-nrw.py`. BKG-Quelle und Lizenz: `public/geo/SOURCES.md`.


### Importhärtung: öffentliche Abschnitte und Folgeimporte

Manche OParl-Anbieter lassen `AgendaItem.public` weg und liefern stattdessen eine geordnete Tagesordnung mit einem ausdrücklichen Abschnitt „Öffentliche Sitzung“. Der Import akzeptiert Punkte innerhalb eines solchen eindeutig benannten Abschnitts und speichert den Nachweis im Ereignis. Nichtöffentliche Abschnitte, ausdrücklich nichtöffentliche Punkte und unbekannte römische Abschnittsüberschriften beenden die Zuordnung. Ohne Kennzeichen oder belegten öffentlichen Abschnitt bleibt ein Punkt ausgeschlossen. Die Anordnung der Quelle wird beibehalten; Titel-Schlagwörter allein reichen nicht.

Teilimporte behalten frühere Ereignisse und Dokumentlinks. Ein erfolgloser Abruf darf den letzten erfolgreichen Artikeldatenstand nicht durch ein frisches Datum ersetzen. Der exportierte Erstbestand bleibt bei einem frischen Checkout erhalten, auch wenn lokale Import-Zwischendateien fehlen. Neue Quellenstände aktualisieren ältere Datenbankstände; ältere Exporte überschreiben keinen jüngeren Abruf.

Bestätigte Abweichungen vom öffentlichen OParl-Verzeichnis stehen in `server/integrations/source-overrides.json` und bleiben beim Neuaufbau des Katalogs erhalten. Aachen: aktuelle amtliche Adresse am 26.09.2026 bestätigt. Dort ausgegebene HTTP-Verweise werden nur auf demselben bestätigten Host auf HTTPS angehoben; fremde Hosts bleiben gesperrt.

Die Zuordnung einer OParl-Körperschaft erfolgt eindeutig über AGS oder einen normalisierten Namen. Amtliche Schlüssel haben Vorrang; Stadt und Kreis bleiben getrennt. Auch referenzierte Körperschaftsobjekte werden aufgelöst. Die Quellenübersicht nennt gespeicherte Artikel je Gebiet und unterscheidet tatsächlichen Bestand von bloß konfigurierten Quellen.

## Vorgangsidentität und Zählung (Arbeitspaket 1)

`shared/topic-identity.mjs` führt Vorgänge ausschließlich anhand amtlicher Datensatzadressen und expliziter Vorlagen-/Tagesordnungspunktbeziehungen innerhalb desselben Gebiets zusammen. Gemeinsame Titel, PDFs und Sitzungsseiten reichen nicht. Die Adapter speichern `identityLinks` beziehungsweise `identityRecords`. Frühere IDs bleiben mit `identity.mergedInto` als Verweise erhalten. Feed, Quellenzähler, Analysen und Vergleich schließen diese Verweise aus; alte Detail- und Analyse-Links werden aufgelöst. Das Detail kennzeichnet offene oder widersprüchliche Vorlagenzuordnungen.

Gehosteter Import sowie portable regionale und NRW-Importe verwenden dieselbe Logik. Ereignisse und Dokumente bleiben bei Teilimporten erhalten. Die gehostete Speicherung archiviert Änderungen und schreibt jeden kanonischen Vorgang samt Aliasdatensätzen atomar. `node scripts/audit-topic-identity.mjs` prüft den versionierten Bestand. Lokale SQLite-Integrationstests in `tests/identity-repository.test.mjs` prüfen die tatsächlichen SQL-Abfragen einschließlich Rollback; sie ersetzen keine Live-Importabnahme.

## Regelmäßiger Import (Arbeitspaket 2)

Der Importbetrieb ist vorbereitet, aber auf dem aktuellen Hosting **noch nicht zeitgesteuert aktiviert**. `scripts/run-imports.mjs` läuft unabhängig vom Website-Build unter Node 22.13+ und ruft die bestehende geschützte HTTP-Schnittstelle sequenziell auf. Er benötigt `SITE_URL` (HTTPS-Origin) und `IMPORT_TOKEN` als Umgebungsvariablen. Tokens nie in Befehlsargumente, URLs, Logs oder Git schreiben. Standardmäßig werden die 43 datenführenden Gebiete abgefragt; dies ist keine vollständige NRW-Anbindung. `IMPORT_REGIONS` erlaubt eine begrenzte Gebietsliste.

Vorbereitete Aktivierung nach Übernahme in ein eigenes GitHub-Repository:

1. Repository-Variable `SITE_URL` auf den veröffentlichten HTTPS-Origin setzen.
2. Repository-Secret `IMPORT_TOKEN` sicher mit dem gleichnamigen Backend-Secret abgleichen. Das vorhandene Secret ist nicht auslesbar; bei Verlust kontrolliert neu setzen und beide Seiten aktualisieren.
3. Variable `IMPORTS_ENABLED=true` setzen. `.github/workflows/import.yml` muss auf dem Default-Branch liegen und Actions aktiviert sein.
4. Zunächst den Workflow manuell auslösen, danach den ersten geplanten Lauf kontrollieren. Zeitplan: 00:17, 06:17, 12:17 und 18:17 UTC. Verzögerungen des Ausführers sind möglich.
5. Zwei reale Folgeimporte prüfen: Artikelbestand, Archivfassungen, Quellenzeitstempel und Workflow-Ergebnis. Quellenlücken separat bewerten. Diese Produktionsabnahme ist noch offen.

Alternativ kann ein Server-Cron denselben Runner ausführen. Nicht beide Zeitgeber parallel aktivieren. Der Backend-Lock begrenzt konkurrierende Läufe; jeder Quellabruf hat 120 Sekunden Netzwerkbudget (SessionNet zusätzlich maximal 20 Sekunden Schnittstellenprobe). Der Runner wartet maximal 240 Sekunden je HTTP-Anfrage, versucht vorübergehende Fehler höchstens dreimal und setzt anschließend mit anderen Gebieten fort. 401/403 der geschützten App-Schnittstelle beendet den gesamten Lauf. Fehlgeschlagene oder leere Quellen erhalten 2 bis maximal 24 Stunden Wiederholungspause; geplante Läufe respektieren diese, manuelle Läufe dürfen bewusst erneut versuchen. Teilimporte mit Artikeln werden nicht als vollständige Abdeckung ausgegeben.

`GET /api/internal/sync` liefert mit demselben Bearer-Zugang die letzten 50 Importläufe. Region, Modus, Auslöser, Beginn, Ende und Ergebnis bleiben gespeichert. Ein harter Prozessabbruch kann einen Lauf im Zustand `running` zurücklassen; nach zehn Minuten läuft die Sperre aus. Solche verwaisten Läufe sind anhand ihres Alters zu untersuchen. Automatische Alarmzustellung ist noch nicht eingerichtet; Workflow-Fehler und das geschützte Protokoll dienen der Betriebsprüfung.

Die Quellenansicht trennt letzte Datenübernahme und letzten Abrufversuch. Bei Fehlern oder leeren Teilabrufen bleiben bisherige Artikel und der erfolgreiche Datenstand erhalten. Der erste Import eines leeren Gebietes erzeugt keine Beschluss-Push-Flut. Automatische KI-Verarbeitung ist nicht Teil dieses Zeitplans.


## Zwölf Monate historisch nachladen

Alle vorhandenen Adapter verwenden `server/integrations/history-window.mjs` (zwölf Monate, kalendarisch geklammert). `node scripts/backfill-year.mjs` lädt die in `DEFAULT_REGIONS` konfigurierten datenführenden Gebiete nach (jetzt 43; das bestehende historische Paket dokumentiert den früheren Lauf mit 13 Gebieten) und speichert das prüfbare Ergebnis in `data/history-backfill.json` sowie eine verlustfrei komprimierte Transportfassung in `data/history-backfill-gzip.json`. Nur die komprimierte Fassung wird in den Worker eingebettet. Beim einmaligen Datenbankimport wird jeweils nur ein Gebiet entpackt; so bleibt der Arbeitsspeicherbedarf begrenzt. `--resume` setzt auf Gebietsebene fort; zum erneuten Versuch eines einzelnen Gebiets dessen Datei unter `tmp/year-backfill` entfernen und mit `--resume` starten. Die Zwischenstände sind nicht in Git. In Umgebungen mit einem verpflichtenden HTTP-Proxy muss der Node-Prozess dessen Konfiguration verwenden, beispielsweise `node --use-env-proxy` bei unterstützter Node-Version.

Der Datenbank-Start führt das neue Bundle mit dem aktuellen Bestand zusammen, archiviert geänderte Fassungen und erhält bestehende IDs. Einmalmarker und Importsperre schützen vor parallelem oder doppeltem Einspielen. Es erfolgt kein historischer Push-Versand. Der erste Datenbankzugriff nach Veröffentlichung kann wegen der Nachladung länger dauern. Leere/fehlgeschlagene Versuche dürfen vorhandene Artikel nicht löschen. Angefragte zwölf Monate bedeuten ausdrücklich keine garantierte Vollständigkeit. Ein monatlich fortsetzbarer Quellencursor ist noch nicht implementiert.

## Zehn neue Kommunen nahe Billerbeck (v0.14)

Nottuln, Havixbeck, Rosendahl, Stadt Coesfeld, Dülmen, Senden, Lüdinghausen, Ahaus, Olfen und Ascheberg liefern jetzt eigene öffentliche Artikel für Feed, Detail und Analyse. Die 3.675 neuen Artikel tragen Regelklassifikationen; es wurden für sie keine KI-Labels oder KI-Zusammenfassungen erzeugt. Die separate Studie über 12.253 Artikel bleibt unverändert. Fünf neue Quellen weisen Teilabrufe auf; zwölf Monate angefragter Rückblick sind keine Vollständigkeitsgarantie.

`server/integrations/nearby-sources.json` hält amtlich bestätigte Quellen fest, `source-catalog.mjs` verbindet sie mit dem OParl-Verzeichnis. Alle zehn geprüften OParl-Herstellerpfade lieferten HTTP 404, daher wird der bestehende öffentliche SessionNet-Adapter genutzt. Neubau des Verzeichnisses, portable Jobs und gehostete Folgeimporte behalten diese Quellen bei. Der Standard-Import umfasste mit v0.14 23 Gebiete und wächst mit v0.15 auf 43; ein Scheduler wird dadurch nicht aktiviert.

Quellen, Einzelzahlen, Datenlücken und Importbefehl: [Erweiterungsbericht](requirements/nearby-municipalities-report.md). Mit `node scripts/report-nearby.mjs` wird der Bericht aus dem exportierten Stand reproduziert.


## Zwanzig weitere Kommunen und Ortsauswahl (v0.15)

Nordkirchen, Rheine, Telgte, Everswinkel, Ostbevern, Sassenberg, Südlohn, Haltern am See, Datteln, Waltrop, Herten, Dorsten, Ennigerloh, Beelen, Ochtrup, Stadt Warendorf, Beckum, Oelde, Wadersloh und Marl liefern 8.866 zusätzliche öffentliche Artikel. Ochtrup nutzt OParl, sieben Kommunen die öffentliche More-Rubin-API und zwölf den vorhandenen SessionNet-Adapter. Die amtlich bestätigten Quellen stehen in `server/integrations/expanded-sources.json` und bleiben beim Neuaufbau des Katalogs erhalten. Sieben Quellen melden Teilabrufe. Neue Artikel haben Regelklassifikationen, keine neu erzeugten KI-Labels oder KI-Zusammenfassungen.

Alle Ortsauswahlen zeigen die gespeicherte Artikelzahl und gegebenenfalls „Teilstand“. Ohne Artikel steht „Noch keine Artikel“. Die Zählung bezieht sich auf den kanonischen Gesamtbestand des Orts, unabhängig vom Zeit- oder Labelfilter. Eine konfigurierte Quelle allein genügt nicht. Suche und Auswahl datenloser Orte bleiben möglich. Datenbankausfälle verwenden den auf der jeweiligen Seite gekennzeichneten Ersatzstand.

[Quellen und Einzelzahlen](requirements/expanded-municipalities-report.md) werden mit `node scripts/report-expanded.mjs` reproduziert. `node scripts/verify-regional-seed.mjs` prüft den tatsächlichen Initialimport gegen SQLite und dessen idempotente Wiederholung: 24.921 kanonische Artikel aus 43 Gebieten. Die Transportkompression wird im Test gegen den vollständigen Rohbestand verglichen.


## Nachprüfung der Quellen (v0.16)

Sieben Quellen wurden erneut eingelesen: 127 zusätzliche Artikel (126 Ochtrup, einer Waltrop), insgesamt 24.921. Waltrops technischer Teilfehler ist behoben; sechs Quellen der jüngsten Erweiterung bleiben Teilstände. Alle 8.866 zuvor vorhandenen Artikellinks der zwanzig Kommunen sind erhalten.

Der Textabruf folgt höchstens drei Weiterleitungen innerhalb desselben freigegebenen HTTPS-Hosts und Portalpfads. Die gesamte Kette teilt sich ein Zeitbudget; fremde Hosts, andere Pfade, Zugangsdaten, HTTP-Downgrades, Schleifen und 401/403 werden nicht umgangen. Noch nicht freigegebene Sitzungsdetails bleiben eine ausdrücklich benannte Datenlücke.

Der OParl-Import erhält eindeutig öffentliche Tagesordnungspunkte auch bei fehlgeschlagenen Vorlagenabrufen. Eine noch offene Zuordnung bleibt sichtbar. Eine später eingelesene amtliche Beziehung führt die Einträge zusammen und erhält bestehende Links. Inhalte fehlender Vorlagen werden nicht erfunden. Der [Folgeimportbericht](requirements/source-followup-report.md) vergleicht den vorherigen und den neuen Datenstand; `node scripts/report-source-followup.mjs` reproduziert ihn aus dem aktuellen Export und dem gespeicherten Ausgangsstand.

### Artikelanalyse nur manuell (v0.20)

`/analysen`, Feed, Details, öffentliche APIs und Admin-Kennzahlen lesen ausschließlich vorhandene Daten; auch eine Datenbankinitialisierung wird dort nicht mehr ausgelöst. Importe erzeugen keine neuen Labels oder Vergleichsmerkmale. Fehlende bzw. veraltete Ergebnisse bleiben als ausstehend sichtbar.

Im Adminbereich: Gebiet wählen → **Labels & Themenmerkmale erstellen (bis 500)**. Der geschützte `POST /api/admin/analyse` verarbeitet genau ein Paket pro Klick, protokolliert den Lauf und nennt verbleibende Artikel. Kein Mount-Effekt, Scheduler, automatischer Wiederholungsaufruf oder Folgelauf. Beim Altbestand bleiben gespeicherte Labels verfügbar; noch nicht gespeicherte Vergleichsmerkmale werden ebenfalls erst durch einen manuellen Start erzeugt. Die KI-Labelstudie bleibt unverändert. Diese Veröffentlichung startet keine Artikelanalyse.


## Gespeicherte Inhaltsanalyse · Billerbeck (v0.21)

402 Artikel sind direkt durch Codex anhand öffentlicher Quellen bearbeitet: 310 Inhaltszusammenfassungen und 92 klar bezeichnete Quellenlücken. Kurz-/Langfassung, Belegzitate, Quellenprüfsummen, getrennte Labels, titelbasierte gewichtete Stichwörter sowie belegte Sitzungsdaten stehen im versionierten, etwa 3 MB großen Serverpaket `server/data/billerbeck-content-v1.json`. Es enthält keine neu archivierten Originalvolltexte. Die Langfassung erscheint auf der Artikelseite mit Quellenbasis und Bearbeitungsstatus. Die normale Kartenanalyse verwendet weiterhin Regel-Labels; die zusätzliche KI-Einordnung ersetzt diese nicht heimlich.

Schema vor Inhaltsimport anwenden: `0003_typical_mauler.sql` ergänzt `article_analyses`. Danach ausdrücklich `/api/admin/prepared-analysis` im geschützten Adminbereich auslösen (maximal 75 Artikel je Klick). Alternativ kann ein autorisierter Dienst das feste Paket per `POST /api/internal/prepared-analysis` mit `Authorization: Bearer PREPARED_ANALYSIS_TOKEN` einspielen. Dieses separate Runtime-Secret muss kryptografisch zufällig und mindestens 32 Zeichen lang sein. Niemals im Repository oder in URLs speichern. Weitere Laufzeitwerte bleiben unverändert. Kein Request-Body kann das feste Paket ersetzen. Bei vorgeschalteter Site-Zugriffskontrolle ist zusätzlich die vom Hosting bereitgestellte Dienstautorisierung erforderlich.

Fortsetzung nur ausdrücklich starten, bis `remaining=0`; `conflictIds` vor weiterer Bearbeitung prüfen. Bereits gespeicherte Analysen werden übersprungen. Die Antwort `stored` zählt den tatsächlichen Billerbeck-Bestand. Pro Artikel erfolgen Versionssicherung, vier getrennte Analysestände und Aktualisierung atomar. Metadatenimporte erhalten vorhandene Zusammenfassungen und markieren geänderte Eingaben als veraltet. Keine Verarbeitung durch GET, Öffnen der Analyse, Import oder Deployment.

Neue API-gestützte Zusammenfassungsversuche speichern ebenfalls nur kompakte Ergebnisse, Belege und Provenienz; neu heruntergeladene Volltexte gelangen nicht in den dauerhaften Artikeldatensatz. Vorhandene Alt-Auszüge bleiben erhalten. Das vorbereitete Paket ist ein einmaliger Teststand und verarbeitet keine späteren Artikel automatisch. Eine erneute direkte Inhaltsanalyse benötigt ein neu geprüftes Paket; die API-gestützte Laufzeitverarbeitung ist weiterhin nicht konfiguriert. Methodik und verbleibende Lücken: [Pilotbericht](requirements/billerbeck-content-pilot.md).


## Vollständige Datenbank lokal übernehmen

Im angemeldeten Adminbereich „Datenbank sichern“ → „Vollständigen Datenexport herunterladen“. Das enthält den tatsächlich gespeicherten Online-Bestand samt alten Fassungen, Analysen und Quellenstand. Die Datei ist keine Auswahl des Feeds und nicht der mitgelieferte Demo-/Ersatzstand. Sie erzeugt keine neuen KI-Texte. „Vollständigkeit prüfen“ zählt fehlende Pflichtangaben ohne Analyseaufruf.

Windows: Den laufenden Server zuerst mit **Strg+C** beenden, bis wieder `PS ...>` erscheint. Im Projektverzeichnis die aktuellen Migrationen anwenden, dann die heruntergeladene Datei importieren:

```powershell
cd "C:\Git\vor-ort-quellcode"
pnpm exec wrangler d1 migrations apply DB --local --config .\wrangler.local.json --persist-to .\.wrangler\state
node scripts/database-restore.mjs "$HOME\Downloads\ratsmonitor-data-2026-09-27.jsonl.gz"
pnpm exec vite --host 127.0.0.1 --port 5173 --strictPort
```

Den tatsächlichen Dateinamen einsetzen. Das Werkzeug benötigt Node >=22.13 (für Windows empfohlen: der bereits eingerichtete Node 24), kein Python. Es findet die vorhandene lokale D1-Datenbank, kontrolliert Prüfsummen und Zeilenzahlen und übernimmt ausschließlich Fachdaten. Der lokale Adminzugang bleibt bestehen. Bei einer bereits gefüllten Datenbank stoppt es ohne Änderung. Nur zum ausdrücklich gewünschten Ersatz `--replace` ergänzen; davor wird automatisch eine SQLite-Sicherung unter `.local-backups/` angelegt. Den lokalen Server während der Wiederherstellung geschlossen lassen.

Die Kopie stimmt mit dem Online-Stand **zum Exportzeitpunkt** überein. Spätere Änderungen laufen nicht automatisch zwischen beiden Installationen mit. Alle bekannten Quellen- und KI-Lücken bleiben in der Kopie sichtbar. Die Dateien `ratsmonitor-data*.json*`, `.local-backups/`, `.wrangler/` und `.dev.vars*` gehören nicht in Git. Regelmäßige separate Sicherungen der Arbeitsergebnisse sind weiterhin erforderlich.

Für einen ausdrücklich beauftragten technischen Export kann `DATA_EXPORT_TOKEN` als separates Runtime-Geheimnis gesetzt werden. `GET /api/internal/database-export` erlaubt ausschließlich die vier festen Inhaltstabellen und Feldprüfungen. Der Browser verwendet stattdessen die bestehende Betreiberanmeldung unter `/api/admin/database`.
