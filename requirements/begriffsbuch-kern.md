# Begriffsbuch: neun Fragen je Bericht

Stand 21.10.2026 (zweite Fassung, vereinfacht), zum Konzept `requirements/modell-konzept.md`. Ohne Regeln ist die Einordnung der Beispiele die Definition: Was hier steht, lernt das Modell. Entscheidungen: Nico, 21.10.2026; Ergänzungen nach dem Pilot (`tests/fixtures/kern-pilot.json`) sind eingearbeitet.

Ein Bericht ist ein Tagesordnungspunkt mit Titel, Gremium, Sitzungsdatum, Ergebnisfeldern des Quellsystems und Dokumenten. Eingeordnet wird nach dem, was dasteht; nichts wird dazu erfunden.

## 0. Überblick

| Frage | Ergebnis | Abschnitt |
|---|---|---|
| 1. Ist das ein Sachpunkt? | Art: Sachpunkt, Ablauf, Personalie | 1 |
| 2. Worum geht es? | Thema (10), Unterthema (70), Unter-Unterthema (wo die Signale es brauchen) | 2, 6, 7 |
| 3. Was für ein Vorgang ist das? | Vorgangsart (8) | 3 |
| 4. Wie ist es ausgegangen? | Status (8) | 4 |
| 5. Ist das ein konkretes Vorhaben? | ja oder nein (Grundlage der Signale) | 4a |
| 6. Wo steht das Verfahren? | Schritt (8), bei Planung und Regelung | 4b |
| 7. Wer stellt den Antrag? | Art des Antragstellers (Fraktion, Mitglied, Gremium, Einwohner); die Partei liest der Fakt | 4b |
| 8. Was wird beauftragt? | Leistungsart (5), bei Bau und Vergabe mit Auftrag | 3 |
| 9. Welche Dokumente? | Dokumentart je PDF, Hauptdokument, Ergebnisdokument | 5 |

Jede Frage lernt das Modell auf dieselbe Weise (`requirements/modell-konzept.md`); keine Regeln. Stand 22.10.2026 (Nico): Planschritt und Schritt der Wärmeplanung sind zu einem Schritt zusammengelegt; Empfehlung der Verwaltung und Hausform sind gestrichen, bis es genug Beispiele gibt (35 bzw. 21 Fälle), und gibt es bis dahin auch nicht als Regel.

Alles Weitere wird daraus abgeleitet (Abschnitt 8): „Formalien ausblenden“, Signale mit Filtern und Schritt, privater Bauantrag, Routinepunkte, Ausgang im Newsradar. Thema, Unterthemen, Vorgangsart gibt es nur bei Sachpunkten; Status und Hilfsschritte bei allen.

## 1. Art des Punkts

| Klasse | Definition | Beispiele |
|---|---|---|
| Sachpunkt | ein eigener Gegenstand | Vorlagen, Anträge und Anfragen mit Gegenstand, Bauanträge, Berichte zu einem Thema, „Mitteilungen: Sanierung der Grundschule“ |
| Ablauf | Ablauf der Sitzung oder Sammlung ohne einzelnen Gegenstand | Eröffnung, Ladung, Beschlussfähigkeit, Tagesordnung, Niederschrift, Befangenheit, nichtöffentlicher Teil, Schließung; Mitteilungen, Anfragen, Verschiedenes, Bekanntgaben, Einwohnerfragestunde, „Berichte“ |
| Personalie | Personen und Besetzungen | Wahl von Vertretern, Besetzung von Gremien und Beiräten, Verpflichtung, Ausscheiden, Ehrungen einzelner Personen, Spendenannahme |

Grenzfälle:
- Sammelwort mit eigenem Gegenstand („Mitteilungen: Sanierung der Grundschule“, „Information Sachstand Anbindung Carling“) → Sachpunkt.
- Mehrzahl ohne Gegenstand („Auftragsvergaben“, „Verschiedene Zuschussanträge“, Rubriken wie „Haushalt und Finanzen“, „Politisches Controlling“) und Platzhalter („wird in der Sitzung bekanntgegeben“, „Beratung ohne Beschlussvorlage“) → Ablauf.
- „Bekanntgabe der Beschlüsse aus nichtöffentlicher Sitzung“, „Unterbrechung für die Einwohnerfragestunde“, „Übersicht der offenen Beschlüsse“, „Rede der Fraktion X“, „Rückmeldung aus den Arbeitskreisen“, „Drucksachen“ → Ablauf.
- Bericht einer Person mit Fachbezug („Bericht des Stadtbrandmeisters“, „Bericht des Abwassermeisters“) → Sachpunkt; „Bericht des Bürgermeisters“ ohne Gegenstand → Ablauf.
- Wahl oder Besetzung, auch in einem themennahen Gremium („Besetzung des Seniorenbeirats“, „Wahl des Schiedsmanns“) → Personalie. Die Zahl der Sitze, Stellvertreter oder Ausschüsse festlegen → Sachpunkt (Verwaltung, Ortsrecht).
- Spendenannahme, auch für einen Zweck, Schenkungen und Sponsoring → Personalie.
- Nur ein Name („BRK Weidenbach“) → Sachpunkt, Thema nur offen.

## 2. Thema, Unterthema, Unter-Unterthema

Katalog aus `shared/themes.mjs` (10 Themen `THEMES`, 70 Unterthemen `SUBTOPICS`, Beschreibungen in Abschnitt 6); darunter Unter-Unterthemen, wo die Signale feinere Filter brauchen (Abschnitt 7). Regeln:

1. Thema ist der Gegenstand, nicht das Verfahren: „Haushaltsmittel für den Radweg“ → Mobilität (Radverkehr).
2. Mehrere Themen nur, wenn beide wirklich Gegenstand sind; das passendste zuerst.
3. „Offen“ zusätzlich, wenn der Punkt vertretbar auch ohne Thema bliebe; nur „offen“, wenn kein Gegenstand erkennbar ist.
4. Finanzen und Verwaltung nur, wenn es um Geld, Haushalt, Satzungen, Personal oder Wahlen selbst geht.
5. Straßen-, Orts-, Personen- und Ausschussnamen sagen nichts über das Thema („Schulstraße 34“ ist keine Schule). Das Gremium allein macht kein Thema („Jugendhilfeausschuss: Bericht der Verwaltung“ → offen).
6. Gebäude der Kommune nach Zweck: Schule, Kita → Bildung; Sporthalle, Bad → Kultur (Sportstätten); Feuerwehrhaus → Sicherheit; Rathaus, Bürgerhaus, Bauhof → Bauen (Öffentliche Gebäude).
7. Grundlage ist der Titel; nennt er keinen Gegenstand, Betreff und Beschlussvorschlag des Hauptdokuments.
8. Unterthemen: alle zutreffenden der vergebenen Themen, meist eins. Unter-Unterthemen: nur unter vergebenen Unterthemen, die welche haben, alle zutreffenden; keins, wenn keins passt.

## 3. Vorgangsart

Ein Wert je Sachpunkt: Was für ein Geschäft wird hier behandelt? Grundlage ist der Titel; nennt er nichts davon, Betreff und Beschlussvorschlag des Hauptdokuments. Bei mehreren gilt das Geschäft, über das entschieden wird („Vergabe der Bauleistungen für den Neubau der Kita“ → Bau und Vergabe; „Antrag der SPD auf Sanierung der Schule“ → Antrag aus der Politik).

| Klasse | Definition | Beispiele |
|---|---|---|
| Information | informiert, ohne zu entscheiden: Bericht, Sachstand, Vorstellung, Antwort auf eine Anfrage | „Sachstand Glasfaserausbau“, „Vorstellung der Ergebnisse …“ |
| Antrag aus der Politik | Antrag oder Anfrage einer Fraktion, eines Mitglieds, von Einwohnern (Einwohnerantrag, Anregung, Petition) | „Antrag der SPD-Fraktion zur Kita-Gebühr“ |
| Genehmigung für Dritte | die Gemeinde befindet als Behörde über ein Vorhaben anderer: Bauantrag, Bauvoranfrage, Befreiung, Einvernehmen, immissions- oder wasserrechtliche Zulassung, Stellungnahme zu Vorhaben und Plänen anderer | „Bauantrag Einfamilienhaus, Flst. 120“, „Einvernehmen zu zwei Windenergieanlagen“ |
| Planung und Regelung | die Gemeinde setzt Regeln oder plant: Bauleitplanung, Konzepte, Gutachten, Studien, Satzungen, Verordnungen, Richtlinien, Allgemeinverfügungen, Widmung und Einziehung | „Satzungsbeschluss B-Plan Nr. 30“, „Mobilitätskonzept“, „Änderung der Hauptsatzung“ |
| Bau und Vergabe | eigenes Vorhaben ausführen oder beschaffen: Neubau, Sanierung, Ausbau, Ausschreibung, Vergabe, Beauftragung, Nachtrag, Beschaffung | „Vergabe Rohbauarbeiten Grundschule“, „Ersatzbeschaffung HLF 20“ |
| Geld | Haushalt, Wirtschaftsplan, Abschluss, über- und außerplanmäßig, Gebühren, Beiträge, Steuern, Förderung, die die Gemeinde gibt oder bekommt, Zuschüsse, Bürgschaften, Kredite | „Haushaltssatzung 2026“, „Zuschüsse für die örtlichen Vereine“, „Förderantrag Städtebauförderung“ |
| Vertrag und Grundstück | Verträge, Vereinbarungen, Zusammenarbeit mit anderen Kommunen, Kauf, Verkauf, Pacht, Vorkaufsrecht | „Öffentlich-rechtliche Vereinbarung …“, „Verkauf einer gemeindlichen Fläche“ |
| Sonstiges | nichts davon | „Ehrenamtstag planen und organisieren“ |

Grenzfälle:
- Antrag eines Vereins, einer Schule oder Firma auf Geld → Geld; Kaufantrag → Vertrag und Grundstück. „Antrag aus der Politik“ nur von Politik und Einwohnern.
- Budgetierungs- oder Controllingbericht mit Beschluss → Geld; ohne Beschluss → Information.
- „Ingenieurleistungen für …“, „Planungsleistungen …“ (Auftrag) → Bau und Vergabe; das Gutachten selbst vorgestellt → Information oder Planung.

**Leistungsart bei Bau und Vergabe** (Filter der Signale „Ausschreibungen und Vergaben“), ein Wert: Bauleistung (Hoch-, Tief-, Straßen-, Wasserbau) · Planungs- und Ingenieurleistung (Planung, Gutachten, Vermessung, Projektsteuerung) · Lieferung und Fahrzeuge (Fahrzeuge, Geräte, Ausstattung, Möbel) · IT und Digitales (Software, Hardware, Netze) · Dienstleistung (Reinigung, Grünpflege, Winterdienst, Sicherheit, Energie- und Essenslieferung). Was gebaut oder beschafft wird (Schule, Straße, Kanal), sagt das Thema. Die Leistungsart gilt nur, wenn etwas beauftragt oder beschafft wird (Ausschreibung, Vergabe, Auftrag, Nachtrag, Beschaffung); bei einem eigenen Vorhaben ohne Auftrag („Sanierung der Grundschule – Sachstand“, Baubeschluss) bleibt sie leer (Entscheidung 22.10.2026).

## 4. Status

Wie ist der Punkt ausgegangen, nach den Quellen? Ein Wert je Bericht; Werte wie in `shared/types.ts`.

| Klasse | Definition |
|---|---|
| Angekündigt | noch keine Sitzung der Beratungsfolge hat ein Ergebnis, und die nächste liegt in der Zukunft (nach dem Stichtag); hat eine frühere Sitzung schon ein Ergebnis, gilt dieses (zum Beispiel Empfehlung); eine vergangene Sitzung ohne Beleg ist Stand offen |
| In Beratung | beraten, aber ohne Ergebnis; verwiesen an ein anderes Gremium; erste Lesung, Einbringung |
| Empfehlung | die Quelle nennt eine Empfehlung („empfiehlt“, „Empfehlungsbeschluss“, „Vorberatung“), oder auf ein „beschlossen“ eines Ausschusses folgt in der Beratungsfolge noch das entscheidende Gremium |
| Beschlossen | beschlossen, sofern es keine Empfehlung ist (siehe oben), auch mit Änderungen, mehrheitlich oder als geänderte Fassung; Abstimmungszahlen mit Mehrheit dafür („Ja 7, Nein 0“) |
| Abgelehnt | abgelehnt, auch ein Antrag, dem nicht gefolgt wird |
| Vertagt | vertagt, zurückgestellt, abgesetzt, zurückgezogen |
| Zur Kenntnis | Information zur Kenntnis genommen, ohne Sachentscheidung |
| Stand offen | aus den Quellen nicht sicher ableitbar |

Quellen in dieser Reihenfolge: Ergebnisfeld des Quellsystems (wenn eindeutig), Ergebnisdokument (Beschlussauszug, Niederschrift), Beschlussvorschlag und Art (eine Information ohne Beschlussvorschlag nach der Sitzung → Zur Kenntnis), Sitzungsdatum (Zukunft → Angekündigt). Was nicht belegt ist, ist Stand offen; nie raten. Mehrere Ergebnisse (Ausschuss empfiehlt, Rat beschließt) → das letzte bis heute.

## 4a. Konkretes Vorhaben

Nur bei Sachpunkten: ja oder nein. Ein Vorhaben ist etwas Bestimmtes, das gebaut, saniert, beschafft, geplant, ausgewiesen oder angesiedelt werden soll, mit erkennbarem Gegenstand oder Ort. Es ist die Grundlage der Signale (Abschnitt 8): Signal = Sachpunkt + Vorhaben + passendes Unter- oder Unter-Unterthema.

- **Ja:** Vorhaben der Gemeinde (Neubau Kita Sonnenschein, Sanierung der Grundschule Am Bach, Ersatzbeschaffung HLF 20, Glasfaserausbau Ortsteil Nord, Bürgerbus-Linie, Ladesäulen am Rathaus) und größere Vorhaben Dritter (Windpark, Freiflächen-PV, Gewerbeansiedlung, Rechenzentrum, Wohnbaugebiet eines Investors, Pflegeheim eines Trägers). Auch als Sachstand, Vergabe, Förderantrag oder Planung, solange es um dieses eine Vorhaben geht. Ein Bebauungsplan für ein bestimmtes Gebiet ist ein Vorhaben (das Gebiet), ebenso die kommunale Wärmeplanung und ein Wärmenetz.
- **Nein:** Haushalt, Abschluss und Gebühren allgemein; Satzungen und Richtlinien ohne bestimmtes Vorhaben; allgemeine Konzepte und Entwicklungspläne (Schulentwicklungsplan, Mobilitätskonzept, Klimaschutzkonzept) ohne bestimmtes Vorhaben; Anfragen und Anträge, die nur prüfen, fragen oder fordern, ohne Beschluss über ein bestimmtes Vorhaben; private Einzelbauanträge (Wohnhaus, Carport, Wintergarten, Werbeanlage, Stall); Personal, Organisation, Verträge ohne Vorhaben; Zuschüsse an Vereine für den Betrieb.
- Grenzfälle: Antrag einer Fraktion auf ein bestimmtes Vorhaben, über das beschlossen wird („Antrag der SPD: Bau eines Kreisverkehrs an der B 12“) → ja. Prüfauftrag („prüfen, ob …“) → nein. Mehrere Vorhaben in einer Liste („Investitionsprogramm 2026“) → nein. Grundstücksverkauf für ein bestimmtes Vorhaben (Gewerbeansiedlung, Bauplätze im Baugebiet) → ja; sonst nein.

## 4b. Schritt und Antragsteller (nur Sachpunkte, nur wenn erkennbar)

**Schritt** bei Vorgangsart Planung und Regelung: wo das Verfahren steht, gleich für Bauleitplan, Wärmeplan, Konzept oder Satzung. Ein Wert; mehrere Schritte im Titel: der weiteste.

| Schritt | Definition | Bauleitplanung | Wärmeplanung |
|---|---|---|---|
| `start` | Verfahren wird begonnen | Aufstellungs- oder Einleitungsbeschluss | Grundsatzbeschluss, Beauftragung, Übertragung der Aufgabe, Förderantrag |
| `frueh` | frühe Phase, Vorarbeit | frühzeitige Beteiligung, Vorentwurf | Bestands- und Potenzialanalyse, Zwischenstand |
| `entwurf` | Entwurf liegt vor, Beteiligung | Entwurfs- oder Auslegungsbeschluss, Offenlage, erneute Beteiligung | Entwurf, Offenlage, Beteiligung |
| `abwaegung` | Stellungnahmen werden abgewogen, ohne Abschluss | Abwägung ohne Satzung | – |
| `beschluss` | Verfahren wird abgeschlossen | Satzungs- oder Feststellungsbeschluss, auch mit der Abwägung | Wärmeplan beschlossen oder vorgelegt |
| `umsetzung` | Umsetzung, Fortschreibung, Kontrolle | – | Umsetzung, Fortschreibung, Monitoring |
| `aufhebung` | Verfahren oder Plan wird aufgehoben | Aufhebung | – |
| `sonst` | Sachstand oder Änderung ohne erkennbaren Schritt, Veränderungssperre, Einstellung | sonst | – |

Die bisherigen Einordnungen gelten übersetzt: Planschritt aufstellung → start, fruehzeitig → frueh, satzung → beschluss, übrige gleich; Schritt der Wärmeplanung analyse → frueh, übrige gleich. Eingeordnet sind bisher nur Bauleit- und Wärmepläne; Beispiele anderer Planungen kommen mit der nächsten Nachlieferung.

**Antragsteller** bei Anträgen und Anfragen aus der Politik, ein Wert (seit 22.10.2026): `fraction` (Fraktion, Gruppe, Partei, Wählergemeinschaft, auch gemeinsame Anträge), `member` (einzelnes Mitglied ohne erkennbare Fraktion), `body` (Gremium als Antragsteller: Ortsbeirat, Ortschaftsrat, Beirat, Jugendrat, Ausschuss), `residents` (Einwohner, Bürger, Initiative, Bürgerbegehren). Welche Partei, ist ein Name im Text und kommt aus dem Fakt `faction` (nur, wenn hier `fraction` steht). Frühere Einordnungen mit Parteien gelten übersetzt (`applicantKind` in shared/model/features.mjs: Partei → fraction, sonst Gremium vor Mitglied vor Einwohner).

## 5. Hilfsschritte: Hauptdokument, Ergebnisdokument, Dokumentart

**Dokumentart** je PDF, grob: Vorlage (Beschluss-, Informations-, Mitteilungsvorlage, Antrag, Anfrage, Antwort oder Stellungnahme der Verwaltung) · Sammeldokument (Vorlage und Anlagen in einem PDF) · Anlage (Plan, Präsentation, Gutachten, Satzungs- oder Vertragsentwurf, Finanzunterlage, Stellungnahme Dritter, Foto) · Ergebnis (Beschlussauszug, Abstimmungsergebnis, Niederschriftsauszug, „Mitteilung aus der Sitzung“, beschlossene Fassung) · Niederschrift der ganzen Sitzung · Sitzungsunterlage (Einladung, Bekanntmachung, Tagesordnung, Sitzungsmappe) · Sonstiges (Vorlagenlebenslauf, Vorberatung ohne Ergebnis, nicht erkennbar). Name des PDFs und erste Seite zählen beide; widersprechen sie sich, gilt die erste Seite.

**Hauptdokument:** das eine PDF, das den Gegenstand trägt: Vorlage oder Sammeldokument; nennt der Titel einen Antrag und liegen Antrag und Vorlage nebeneinander, der Antrag; mehrere Fassungen: die jüngste vollständige. Gibt es nur ein Ergebnis-PDF, ist es das Hauptdokument. Nur Anlagen oder nur Sitzungsunterlagen → kein Hauptdokument. Ein PDF an fünf und mehr Berichten ist eine Sitzungsunterlage, auch wenn es „Vorlage“ heißt. Gilt auch für Ablauf und Personalie (dort meist keins).

**Ergebnisdokument:** das PDF mit dem Ergebnis dieses Punkts (Ergebnis-Art), sonst die Niederschrift der Sitzung, sonst keins.

## 6. Die 70 Unterthemen

Je Unterthema: was dazugehört, Beispiele, und was nicht (mit dem richtigen Ort). Die Beispiele sind typische Titel, keine Wortliste: Entscheidend ist der Gegenstand, nicht ein einzelnes Wort. Wo die Signale feinere Filter brauchen, gibt es Unter-Unterthemen (Abschnitt 7).

### Bauen & Wohnen (`bauen`)

- **plan – Bauleitplanung und Raumordnung:** Verfahren nach BauGB und Raumordnung: Bebauungs- und Flächennutzungspläne in jedem Schritt (Aufstellung, Offenlage, Abwägung, Satzung, Änderung, Aufhebung), Veränderungssperren, Regional- und Landesentwicklungspläne, Stellungnahmen zu Plänen der Nachbarn. Beispiele: „Satzungsbeschluss B-Plan Nr. 30“, „Bauturbo – Anwendung in der Gemeinde“. Nicht: Bauantrag im Plangebiet (→ dritte); Wind- oder Solarpläne zuerst → `umwelt.ee`, `plan` als zweites.
- **dritte – Bauvorhaben Dritter:** Vorhaben von Privaten, Firmen oder Kirchen, über die die Gemeinde als Behörde befindet: Bauantrag, Bauvoranfrage, Befreiung, Abweichung, Einvernehmen, Nutzungsänderung. Beispiele: „Bauantrag Anbau Wintergarten, Flst. 120“, „Nutzungsänderung Pfarrheim zu Kindergarten“. Nicht: Bauten der Gemeinde selbst (→ nach Zweck, z. B. `oeff`, `schulbau`).
- **grund – Grundstücke und Liegenschaften:** Kauf, Verkauf, Tausch, Pacht, Miete, Erbbaurecht, Vorkaufsrecht und Gestattung von Flächen der Gemeinde. Beispiele: „Verkauf einer gemeindlichen Fläche“, „Gestattungsvertrag für das Grundstück am Turm“. Nicht: Bauplatzvergabe in einem neuen Baugebiet (→ `erschl`); Jagd- und Landpacht (→ `wirtschaft.landforst`).
- **stadt – Stadtentwicklung, Sanierung und Denkmal:** Entwicklung von Ortsteilen und Quartieren: Stadtentwicklungs- und Rahmenkonzepte (ISEK), Sanierungsgebiete, Städtebauförderung, Dorferneuerung, Ortsmitte, Konversionsflächen, Leerstand von Gebäuden, Denkmalschutz. Beispiele: „Städtebauliche Rahmenplanung Marktplatz“, „Aufnahme ins Programm Lebendige Zentren“. Nicht: Einzelhandel und Stadtmarketing (→ `wirtschaft.innen`).
- **wohnen – Wohnungsbau und Wohnraum:** Wohnraum als Gegenstand: geförderter Wohnungsbau, Wohnungsgesellschaften, Mietspiegel, Belegungsbindung, Zweckentfremdung, Wohnraumbedarf. Beispiele: „Wohnraumversorgungskonzept“, „Mietspiegel 2026“. Nicht: Wohnungslosigkeit (→ `soziales.armut`), Seniorenwohnen (→ `soziales.senior`, `wohnen` als zweites möglich).
- **erschl – Erschließung und Baugebiete:** Neue Baugebiete außerhalb des Planverfahrens: Erschließung (Straße, Kanal, Strom), Umlegung, Erschließungsverträge und -beiträge, Vermarktung und Vergabe von Bauplätzen, Baulandpotenziale. Beispiele: „Erschließung Baugebiet Hornweg, Vergabe Tiefbau“, „Vergaberichtlinie Bauplätze“. Nicht: der Bebauungsplan selbst (→ `plan`).
- **oeff – Öffentliche Gebäude und Plätze:** Bau, Sanierung und Betrieb von Gebäuden und Plätzen der Gemeinde ohne eigenes Fachthema: Rathaus, Verwaltungsgebäude, Bürgerhaus, Dorfgemeinschaftshaus, Bauhof, öffentliche Toiletten, Markt- und Kirchplätze. Beispiele: „Sanierung des Bürgerhauses“, „Neugestaltung Kirchplatz“. Nicht: Schule, Kita, Sporthalle, Feuerwehrhaus, Museum (→ ihr Fachthema).

### Finanzen & Haushalt (`finanzen`)

- **hh – Haushalt und Finanzplanung:** Haushaltssatzung und -plan, Nachtragshaushalt, Finanzplanung, Investitionsprogramm, Eckwerte, Stellenplan als Teil des Haushalts, Finanzcontrolling und Finanzberichte. Beispiele: „Haushaltssatzung 2026“, „Finanzcontrolling I/2026“. Nicht: Geld für einen bestimmten Gegenstand (→ dessen Thema, z. B. „Haushaltsmittel für den Radweg“ → `mobilitaet.rad`).
- **abschl – Jahresabschluss und Prüfung:** Jahresabschluss, Gesamtabschluss, Jahresrechnung, Rechnungs- und Kassenprüfung, Prüfberichte, Entlastung, Ergebnisverwendung. Beispiele: „Jahresrechnung 2024 – Entlastung“, „Bestellung eines Wirtschaftsprüfers“.
- **beteil – Beteiligungen und Eigenbetriebe:** Unternehmen der Gemeinde und ihre Beteiligungen: Stadtwerke, Eigenbetriebe, GmbHs, Zweckgesellschaften, Beteiligungsbericht, Wirtschaftspläne und Gremien dieser Unternehmen. Beispiele: „Wirtschaftsplan Eigenbetrieb Abwasser 2027“, „Beteiligungsbericht 2025“. Nicht: der Fachgegenstand, wenn er im Vordergrund steht („Bäder-GmbH: Sanierung Hallenbad“ → `kultur.sport`).
- **upl – Über- und außerplanmäßige Ausgaben:** Ausgaben über den Plan hinaus und ihre Genehmigung, Mittelbereitstellung, Aufhebung von Sperrvermerken, Ermächtigungsübertragungen. Beispiele: „Überplanmäßige Ausgabe gem. § 100 GemO“. Nicht: wenn der Gegenstand klar ist und im Titel vorne steht (→ dessen Thema, `upl` als zweites).
- **steuer – Steuern und Hebesätze:** Grund-, Gewerbe-, Hunde-, Zweitwohnung-, Vergnügungs-, Beherbergungssteuer, Hebesätze, Steuersatzungen. Beispiele: „Festsetzung der Hebesätze 2026“. Nicht: Gebühren und Beiträge (→ Thema der Leistung, z. B. Abwassergebühr → `umwelt.wasser`, Kitabeitrag → `bildung.kitabetr`).
- **hsk – Haushaltssicherung:** Haushaltssicherungs- und Konsolidierungskonzepte, Sparlisten, Entschuldung, Stabilisierungshilfen, Defizitabbau, Kürzung freiwilliger Leistungen. Beispiele: „Haushaltssicherungskonzept 2026“, „Stabilisierungshilfe nach Art. 11 BayFAG“.
- **kredit – Kredite, Umlagen und Zuweisungen:** Kredite und Zinsen, Bürgschaften, Kreis- und Verbandsumlagen, Schlüsselzuweisungen, Finanzausgleich, Sondervermögen und Pauschalen von Bund und Land. Beispiele: „Aufnahme eines Investitionskredits“, „Kreisumlage 2026“.

### Mobilität & Verkehr (`mobilitaet`)

- **strasse – Straßen, Brücken und Beleuchtung:** Bau, Ausbau, Sanierung und Unterhalt von Straßen, Wirtschaftswegen und Brücken, Straßenbeleuchtung, Winterdienst, Straßenreinigung. Beispiele: „Ersatzneubau Brücke über die Schwabach“, „Deckensanierung Kreisstraße 12“. Nicht: Straßenname als Ortsangabe (zählt nicht); Straßenbenennung (→ `kultur.heimat`); LED-Umrüstung der Beleuchtung zuerst → `umwelt.klimaschutz`.
- **oepnv – Bus und Bahn:** Buslinien, Haltestellen, Bürger- und Rufbus, Bahn und Bahnhöfe, Tarife, Nahverkehrsplan, Schienenverkehr. Beispiele: „Anpassung des Gemeinschaftstarifs“, „Zuschuss zum Bürgerbus“. Nicht: Schulbus (→ `bildung.schulentw`).
- **rad – Radverkehr:** Radwege, Fahrradstraßen, Radrouten, Abstellanlagen, Lastenräder, Leihräder, Radverkehrskonzept. Beispiele: „Neubau Radwegebrücke“, „Radverkehrskonzept 2030“.
- **sicher – Verkehrssicherheit und Tempo:** Geschwindigkeit (Tempo 30), Verkehrsberuhigung, Überwege, Querungshilfen, Ampeln, Schulwegsicherung, Verkehrsüberwachung, Verkehrsschau. Beispiele: „Tempo-30-Zone Laubendorf“, „Geschwindigkeitsüberwachung“.
- **park – Parken:** Parkplätze, Parkhäuser, Parkgebühren, Bewohnerparken, Stellplatzsatzung, Halte- und Parkverbote. Beispiele: „Parksituation am Hasenberg“, „Parkgebührenordnung“.
- **geh – Gehwege und Barrierefreiheit:** Gehwege, Fußwege, Bordsteinabsenkungen, Treppen, barrierefreie Haltestellen, Fußverkehr. Beispiele: „Gehwegverlängerung Am Röttgen“. Nicht: Barrierefreiheit in Gebäuden (→ dessen Zweck, `soziales.inkl` als zweites).
- **plan – Verkehrsplanung und neue Mobilität:** Verkehrs- und Mobilitätskonzepte, Verkehrsgutachten, Verkehrsführung, Carsharing, Ladesäulen, Mitfahrbänke, Kfz-Kennzeichen. Beispiele: „Mobilitätskonzept – Vorstellung der Ergebnisse“, „Ladeinfrastruktur im Ortskern“.

### Bildung & Betreuung (`bildung`)

- **kitabau – Kita-Ausbau und Plätze:** Bau, Erweiterung und Sanierung von Kitas, Außenanlagen, Kita-Bedarfsplan, Zahl der Plätze, neue Gruppen. Beispiele: „Erweiterung Kita Sonnenschein um zwei Gruppen“, „Kindergartenbedarfsplan 2026“.
- **kitabetr – Kita-Betrieb, Träger und Beiträge:** Betrieb der Kitas: Träger, Verträge, Elternbeiträge, Verpflegung, Öffnungszeiten, Kindertagespflege, Personal in Kitas, Zuschüsse an freie Träger. Beispiele: „Satzung über Elternbeiträge“, „Betriebskostenzuschuss an den Träger“.
- **schulbau – Schulbau und Sanierung:** Bau, Erweiterung, Sanierung und Raumbedarf von Schulgebäuden, Schulhöfen, Mensen, Schulturnhallen als Teil der Schule. Beispiele: „Sanierung und Erweiterung der Grundschule“, „Raumbedarf OGS“ (mit `ganztag`). Nicht: Sporthalle, die vor allem Vereine nutzen (→ `kultur.sport`).
- **schulbetr – Schulbetrieb und Ausstattung:** Ausstattung (Digitalpakt, Tafeln, Möbel), Schulsozialarbeit, Programme, Fördervereine, Verpflegung, Vandalismus, Alltag der Schulen. Beispiele: „Bericht zum Startchancen-Programm“, „Beschaffung digitaler Tafeln“.
- **ganztag – Ganztag und Hort:** Offene und gebundene Ganztagsschule, Hort, Nachmittags-, Mittags- und Ferienbetreuung von Schulkindern, Rechtsanspruch Ganztag. Beispiele: „Errichtung einer Offenen Ganztagsschule“, „Elternbefragung Ganztagsbedarf“.
- **schulentw – Schulentwicklung und Schülerbeförderung:** Schulentwicklungsplan, Schulstandorte, Schulbezirke, Zügigkeit, Anmelde- und Schülerzahlen, Schulform, Schülerbeförderung, Schulbus, Schulweg. Beispiele: „Schulentwicklungsplan 2026–2031“, „Schülerbeförderung zum Schuljahr“.
- **beruf – Berufs- und Erwachsenenbildung:** Berufsschulen und -kollegs, Volkshochschule, Weiterbildung, Übergang Schule–Beruf, Bildungswerke. Beispiele: „VHS-Programm“, „Maßnahmen für unversorgte Schulabgänger“. Nicht: Arbeitsmarktförderung (→ `wirtschaft.arbeit`).

### Umwelt, Klima & Energie (`umwelt`)

- **natur – Natur, Bäume und Grünflächen:** Naturschutz, Landschaftsschutz, Bäume (Fällung, Pflanzung, Baumschutz), Grünflächen und ihre Pflege, Blühflächen, Ausgleichsmaßnahmen, Gewässerrenaturierung, Wildtiere (Biber, Wolf). Beispiele: „Baumschutzsatzung“, „Biberproblematik“. Nicht: Wald als Wirtschaftsbetrieb (→ `wirtschaft.landforst`).
- **wasser – Wasser und Abwasser:** Trinkwasser, Abwasser, Kanäle, Kläranlagen, Pumpwerke, Niederschlagswasser, Gebühren und Satzungen dazu, Wasserversorger. Beispiele: „Kanalsanierung nach Eigenkontrollverordnung“, „Abwassergebühren 2026“. Nicht: Hochwasser und Starkregen (→ `anpass`).
- **abfall – Abfall und Entsorgung:** Müllabfuhr, Wertstoffe, Sperrmüll, Grünschnitt, Container, Recycling, Abfallgebühren, Müllsammelaktionen. Beispiele: „Abfallgebührensatzung“, „Müll-Sammel-Aktion“.
- **ee – Erneuerbare Energien:** Wind, Photovoltaik (Freifläche, Dach, Agri-PV), Batteriespeicher, Biogas, Geothermie, Wasserkraft, Bürgerenergie, auch ihre Bauleitplanung. Beispiele: „B-Plan Sondergebiet Wind“, „PV-Anlage auf dem Rathausdach“.
- **waerme – Wärme und Energieversorgung:** Kommunale Wärmeplanung, Wärme- und Fernwärmenetze, Heizungen in Gebäuden der Gemeinde, Strom- und Gasnetze, Konzessionen, Energieeinkauf, Netzentwicklung. Beispiele: „Kommunale Wärmeplanung – Beschluss“, „Konzessionsvertrag Gas“. Nicht: Heizung als Teil einer Gebäudesanierung, wenn das Gebäude im Vordergrund steht (→ dessen Thema, `waerme` als zweites).
- **klimaschutz – Klimaschutz und Energieeffizienz:** Klimaschutzkonzept und -management, CO₂-Bilanz, energetische Sanierung, LED-Umrüstung, Energiesparen, Klimaförderprogramme. Beispiele: „Klimaschutzkonzept – Fortschreibung“, „LED-Umrüstung der Straßenbeleuchtung“.
- **anpass – Klimaanpassung, Hochwasser und Starkregen:** Hochwasserschutz, Deiche, Rückhaltebecken, Starkregenvorsorge, Hitzeschutz, Entsiegelung, Schwammstadt, Dürre. Beispiele: „Starkregenrisikomanagement“, „Hitzeaktionsplan“.

### Soziales & Gesundheit (`soziales`)

- **senior – Senioren und Pflege:** Angebote für ältere Menschen, Pflegeeinrichtungen, Seniorenwohnen, Seniorenbeirat als Gegenstand, Demenz, Pflegeplanung. Beispiele: „Seniorentag 2026“, „Neubau Seniorenzentrum“. Nicht: Besetzung des Seniorenbeirats (Personalie, kein Thema).
- **jugend – Kinder, Jugend und Familie:** Jugendarbeit, Jugendzentren, Jugendamt, Kinderschutz, Familienförderung, Ferienprogramme, Jugendhilfe. Beispiele: „Bericht Haus der Jugend“, „Ferienprogramm 2026“. Nicht: Kita und Schule (→ `bildung`).
- **integ – Integration und Geflüchtete:** Unterbringung Geflüchteter, Integration, Migration, Asyl, Integrationsrat, Bezahlkarte. Beispiele: „Gemeinschaftsunterkunft – Sachstand“, „Integrationskonzept“.
- **inkl – Inklusion und Gleichstellung:** Menschen mit Behinderung, Barrierefreiheit als Gegenstand, Teilhabe, Gleichstellung von Frauen und Männern, Vielfalt. Beispiele: „Tätigkeitsbericht der Gleichstellungsbeauftragten“, „Aktionsplan Inklusion“.
- **gesund – Gesundheitsversorgung:** Ärzte und Ärzteförderung, MVZ, Krankenhäuser, Hospiz, Gesundheitsamt, Prävention, Sucht. Beispiele: „Ärzteförderung“, „Nachnutzung des Krankenhauses“. Nicht: Rettungsdienst (→ `sicherheit.rett`).
- **beratung – Beratung und soziale Träger:** Beratungsstellen (Schuldner-, Erziehungs-, Sozialberatung), Wohlfahrtsverbände, soziale Projekte und ihre Förderung, Einsamkeit, Ehrenamtsbörsen im sozialen Bereich. Beispiele: „Förderung der Schuldnerberatung 2027–2029“, „Runder Tisch gegen Einsamkeit“.
- **armut – Armut, Wohnungslosigkeit und Grundsicherung:** Wohnungslosigkeit, Notunterkünfte, Grundsicherung, Sozialhilfe, Bürgergeld, Kosten der Unterkunft, Tafeln, Sozialpass. Beispiele: „Obdachlosenunterkunft“, „Jahresbericht der Tafel“.

### Kultur, Sport & Freizeit (`kultur`)

- **sport – Sportstätten und Bäder:** Sporthallen, Sportplätze, Kunstrasen, Stadien, Frei- und Hallenbäder, Badestellen, Schwimmunterricht, Sportförderung von Anlagen. Beispiele: „Sanierung Freizeitbad“, „Kunstrasenplatz Sportanlage Nord“.
- **kultur – Kultur und Kunst:** Museen, Theater, Konzerte, Ausstellungen, Kunst im öffentlichen Raum, Kulturförderung, Kulturbüro, Kino. Beispiele: „Jahresbericht Kulturbüro“, „Fassadensanierung Museum“.
- **feste – Feste und Veranstaltungen:** Stadt- und Dorffeste, Märkte als Fest (Weihnachtsmarkt), Karneval, Jubiläen, Veranstaltungskalender, Ferienpass als Veranstaltung. Beispiele: „Familienfest am 30.05.“, „Weihnachtsmarkt 2026“. Nicht: Marktordnung und Standgebühren (→ `sicherheit.markt`).
- **verein – Vereinsförderung und Ehrenamt:** Zuschüsse an Vereine, Vereinsförderrichtlinie, Ehrenamt, Ehrungen von Ehrenamtlichen und Sportlern, Vereinsheime. Beispiele: „Zuschüsse für die örtlichen Vereine 2026“, „Ehrenamtskarte“.
- **spiel – Spiel- und Freizeitanlagen:** Spielplätze, Bolz- und Skateplätze, Pumptracks, Freizeitanlagen, Grillplätze, Tierparks. Beispiele: „Erneuerung Spielplatz Mühlenbach“, „Skateranlage“.
- **heimat – Heimat, Partnerschaften und Gedenken:** Städtepartnerschaften, Heimatpflege, Ortsgeschichte, Gedenken, Denkmäler für Personen, Ehrenbürger, Straßenbenennungen, Welterbe. Beispiele: „Städtepartnerschaft mit …“, „Benennung einer Straße“.
- **bib – Bibliotheken und Musikschule:** Büchereien, Bibliotheken, Musik- und Kunstschulen, Leseförderung. Beispiele: „Bericht der Stadtbücherei“, „Beitritt zum Trägerverband der Musikschule“.

### Sicherheit & Ordnung (`sicherheit`)

- **fwhaus – Feuerwehrhäuser, Bedarfsplan und Organisation:** Feuerwehrhäuser und -wachen, Brandschutzbedarfsplan, Organisation der Wehr, Löschwasser, Wehrführung als Gegenstand. Beispiele: „Neubau Feuerwehrhaus“, „Brandschutzbedarfsplan 2026“. Nicht: Wahl oder Bestellung des Wehrführers (Personalie, kein Thema).
- **fwfz – Feuerwehrfahrzeuge und Ausrüstung:** Löschfahrzeuge, Drehleitern, Einsatzgeräte, Schutzausrüstung. Beispiele: „Ersatzbeschaffung HLF 20“, „Persönliche Schutzausrüstung“.
- **rett – Rettungsdienst:** Rettungswachen, Rettungsdienstbedarfsplan, Notarzt, Leitstelle, Wasserrettung, First Responder. Beispiele: „Neubau Rettungswache“, „Bedarfsplan Rettungsdienst“.
- **kats – Katastrophen- und Bevölkerungsschutz:** Katastrophenschutz, Sirenen und Warnung, Notstrom, Stromausfall, Krisenstab, Notfalltreffpunkte, Kampfmittel, Talsperrensicherheit. Beispiele: „Sirenenprogramm“, „Notstromaggregat“.
- **ordnung – Öffentliche Ordnung und Sicherheit:** Ordnungsamt, Ordnungsdienst, Gefahrenabwehrverordnung, Polizei, Videoüberwachung, Alkohol- und Waffenverbote, Hunde, Tierseuchen, Lärm. Beispiele: „Gefahrenabwehrverordnung“, „Kommunaler Ordnungsdienst – Bericht“.
- **friedhof – Friedhöfe und Bestattung:** Friedhöfe, Bestattungsformen, Trauerhallen, Friedhofssatzung und -gebühren. Beispiele: „Neugestaltung Waldfriedhof“, „Friedhofsgebührensatzung“.
- **markt – Märkte, Sondernutzung und Gewerbeaufsicht:** Wochen- und Jahrmärkte als Einrichtung (Satzung, Gebühren), Sondernutzung, Außengastronomie, Werbeanlagen im öffentlichen Raum, Gewerbeaufsicht. Beispiele: „Marktsatzung“, „Kirmesstandgebühren 2026“.

### Verwaltung & Digitalisierung (`verwaltung`)

- **ortsrecht – Ortsrecht und Satzungen:** Hauptsatzung, Geschäftsordnung, Zuständigkeiten, Entschädigungssatzung, allgemeine Satzungen ohne eigenes Fachthema, Zahl der Ausschüsse und Sitze. Beispiele: „Änderung der Hauptsatzung“, „Neufassung der Geschäftsordnung“. Nicht: Fachsatzungen (Abwassersatzung → `umwelt.wasser`, Friedhofssatzung → `sicherheit.friedhof`).
- **wahlen – Wahlen:** Durchführung von Wahlen und Abstimmungen der Bürger: Kommunal-, Bürgermeister-, Landtags-, Bundestagswahl, Wahlbezirke, Wahlhelfer, Wahlleitung, Bürgerentscheid, Bürgerbegehren. Beispiele: „Einteilung der Wahlbezirke“, „Berufung der Gemeindewahlleiterin“. Nicht: Wahl oder Besetzung von Gremien und Vertretern (Personalie, kein Thema).
- **personal – Personal und Organisation:** Stellen, Stellenplan außerhalb des Haushalts, Tarif, Ausbildung in der Verwaltung, Organisation und Struktur der Verwaltung, Dienstvereinbarungen, Arbeitszeit. Beispiele: „Organisationsuntersuchung Bauamt“, „Einsparmöglichkeiten der Verwaltung“.
- **digital – Digitalisierung und IT:** Software, IT-Konzept, Onlinezugang, E-Akte, Datenschutz, Informationssicherheit, Apps, Ratsinformationssystem, KI in der Verwaltung. Beispiele: „Fortschreibung IT-Konzept“, „Einführung einer Gemeinde-App“.
- **breit – Breitband und Mobilfunk:** Glasfaser, Breitbandförderung, Mobilfunkmasten, 5G, öffentliches WLAN. Beispiele: „Sachstand Glasfaserausbau“, „Mobilfunkmast am Sportplatz“.
- **beteil – Bürgerbeteiligung und Beiräte:** Beteiligungsformate, Bürgerhaushalt, Befragungen, Einwohnerversammlung als Gegenstand, Beiräte und Jugendparlamente (Einrichtung, Arbeit), Petitionen, Einwohneranträge. Beispiele: „Jugendforum“, „Leitlinien Bürgerbeteiligung“. Nicht: Besetzung eines Beirats (Personalie, kein Thema); Bürgerbegehren (→ `wahlen`).
- **zusammen – Zusammenarbeit und Gebietsfragen:** Interkommunale Zusammenarbeit, Zweckverbände, öffentlich-rechtliche Vereinbarungen, Aufgabenübertragung, Gebietsänderungen, Fusionen. Beispiele: „Öffentlich-rechtliche Vereinbarung zur gemeinsamen Dienststelle“, „Beitritt zum Zweckverband“. Nicht: wenn das Fachthema im Vordergrund steht („Übertragung der Wärmeplanung“ → `umwelt.waerme`, `zusammen` als zweites).

### Wirtschaft & Arbeit (`wirtschaft`)

- **foerd – Wirtschaftsförderung und Ansiedlung:** Wirtschaftsförderung, Ansiedlung von Firmen, Gründerzentren, Innovations- und Technologiezentren, Handwerk, Mittelstand. Beispiele: „Gesellschaft für Wirtschaftsförderung – Wirtschaftsplan“, „Ansiedlung eines Logistikunternehmens“.
- **gewerbe – Gewerbegebiete:** Gewerbe- und Industriegebiete und -flächen, ihre Planung, Erschließung und Vermarktung. Beispiele: „B-Plan Gewerbegebiet Nord“ (mit `bauen.plan`), „Verkauf von Gewerbeflächen“.
- **innen – Innenstadt, Stadtmarketing und Einzelhandel:** Innenstadtbelebung, Stadtmarketing, Citymanagement, Einzelhandel, Nahversorgung, Leerstand von Läden, verkaufsoffene Sonntage. Beispiele: „Einzelhandelskonzept“, „Veranstaltungen Citymanagement“.
- **tour – Tourismus:** Tourismus, Kurbeitrag und Gästebeitrag, Wohnmobil- und Campingplätze, Wanderwege, Tourismusgesellschaften. Beispiele: „Tourismusstrategie“, „Satzung über den Gästebeitrag“.
- **arbeit – Arbeitsmarkt und Fachkräfte:** Fachkräftesicherung, Ausbildungsplätze, Beschäftigungsprojekte, Arbeitsmarktförderung, Jobcenter-Maßnahmen. Beispiele: „Beschäftigungsprojekt Jugend“, „Ausbildungsmesse“.
- **leader – Regionalentwicklung und LEADER:** LEADER, Regionalmanagement, ILE, Regionalbudget, Strukturwandel-Programme, Metropolregion. Beispiele: „LEADER-Förderperiode 2028“, „Regionalbudget – Kleinprojekte“.
- **landforst – Landwirtschaft und Forst:** Landwirtschaft, Wald als Wirtschaftsbetrieb (Forstwirtschaftsplan, Holzeinschlag), Jagd und Jagdpacht, Feldwege der Landwirtschaft, Tierhaltung, Fischerei. Beispiele: „Forstlicher Wirtschaftsplan 2026“, „Jagdpacht“. Nicht: Naturschutz im Wald (→ `umwelt.natur`); Bauantrag für einen Stall (→ `bauen.dritte`, `landforst` als zweites).


## 7. Unter-Unterthemen

Nur dort, wo die Signale (`docs/produkt/plenara-x-signale.md`) feinere Filter brauchen; die übrigen Unterthemen haben keine. Kürzel als `unterthema.kürzel`, mehrere möglich.

| Unterthema | Unter-Unterthemen |
|---|---|
| `bauen.plan` Bauleitplanung und `bauen.erschl` Erschließung und Baugebiete | Nutzung des Gebiets: `wohnen` Wohnen · `misch` Mischgebiet, Dorfgebiet · `gewerbe` Gewerbe · `industrie` Industrie · `logistik` Logistik · `rechenzentrum` Rechenzentrum · `handel` Einzelhandel, Nahversorgung · `energie` Wind, Solar, Speicher, Wasserstoff · `freizeit` Hotel, Camping, Ferienhäuser, Freizeit · `gemeinbedarf` Schule, Kita, Feuerwehr, Pflege, Sport · `gruen` Grün, Landwirtschaft, Ausgleich |
| `bauen.erschl` zusätzlich | Vorhaben: `neu` neues Baugebiet · `erweiterung` Erweiterung · `erschliessung` Erschließung, Umlegung · `bauplatz` Bauplatzverkauf, Vergabekriterien |
| `bauen.grund` Grundstücke | `bauplatz` Wohnbauplätze · `gewerbeflaeche` Gewerbeflächen · `sonstig` andere Flächen |
| `umwelt.ee` Erneuerbare Energien | `wind` Windenergie · `pv_frei` Freiflächen-PV · `pv_agri` Agri-PV · `pv_dach` PV auf Gebäuden · `speicher` Batteriespeicher · `wasserstoff` Wasserstoff, Elektrolyse · `bio` Biogas, Biomasse · `geo` Geothermie, Wasserkraft |
| `umwelt.waerme` Wärme und Energieversorgung | `waermeplan` kommunale Wärmeplanung · `netz` Wärme- und Fernwärmenetz · `heizung` Heizungstausch in Gebäuden der Gemeinde · `konzession` Konzessionen, Strom- und Gasnetze |
| `umwelt.klimaschutz` Klimaschutz | `led` LED-Umrüstung · `sanierung` energetische Sanierung · `konzept` Klimaschutzkonzept, Management, Bilanz |
| `umwelt.wasser` Wasser und Abwasser | `klaeranlage` Kläranlage · `kanal` Kanal und Abwasser · `trinkwasser` Trinkwasser · `regenwasser` Niederschlagswasser |
| `umwelt.anpass` Klimaanpassung | `hochwasser` Hochwasser, Deiche · `starkregen` Starkregen, Rückhaltung · `hitze` Hitze, Entsiegelung, Dürre |
| `mobilitaet.strasse` Straßen, Brücken, Beleuchtung | `ausbau` Ausbau und Sanierung · `bruecke` Brücke · `knoten` Ortsdurchfahrt, Kreisverkehr, Kreuzung · `wirtschaftsweg` Wirtschafts- und Feldweg · `beleuchtung` Straßenbeleuchtung · `unterhalt` Winterdienst, Reinigung, Unterhalt |
| `mobilitaet.oepnv` Bus und Bahn | `buergerbus` Bürger- und Rufbus, Bedarfsverkehr · `linie` Linien, Takt, Tarif · `haltestelle` Haltestellen · `bahn` Bahn, Bahnhof |
| `mobilitaet.plan` Verkehrsplanung und neue Mobilität | `konzept` Verkehrs- und Mobilitätskonzept · `carsharing` Carsharing · `laden` Ladesäulen · `mitfahr` Mitfahrbank · `verleih` Rad- und Lastenradverleih |
| `bildung.schulbau` Schulbau und Sanierung | `grundschule` Grundschule · `weiterfuehrend` weiterführende Schule · `foerderschule` Förderschule · `berufsschule` Berufsschule |
| `bildung.kitabau` Kita-Ausbau | `neubau` Neubau · `erweiterung` Erweiterung, neue Gruppen · `sanierung` Sanierung, Außenanlagen |
| `kultur.sport` Sportstätten und Bäder | `halle` Sporthalle · `platz` Sportplatz, Kunstrasen · `bad` Frei- und Hallenbad, Badestelle |
| `kultur.spiel` Spiel und Freizeit | `spielplatz` Spielplatz · `jugend` Bolzplatz, Skate, Pumptrack · `freizeit` Freizeitanlagen, Grillplätze, Tierparks |
| `verwaltung.breit` Breitband und Mobilfunk | `glasfaser` Glasfaser · `mobilfunk` Mobilfunk · `wlan` öffentliches WLAN |
| `soziales.senior` Senioren und Pflege | `pflegeheim` Pflegeheim, Tages- und Kurzzeitpflege · `wohnen` Seniorenwohnen, betreutes Wohnen · `angebot` Angebote, Seniorentag |
| `soziales.gesund` Gesundheitsversorgung | `aerzte` Ärzte, Ärztehaus, MVZ · `krankenhaus` Krankenhaus · `sonstig` Apotheke, Hebammen, Prävention, Sucht |
| `wirtschaft.innen` Innenstadt und Einzelhandel | `nahversorgung` Supermarkt, Discounter, Dorfladen · `fachmarkt` Fachmarkt, Drogerie · `innenstadt` Innenstadt, Leerstand, Citymanagement |
| `sicherheit.ordnung` Öffentliche Ordnung und Sicherheit | `laerm` Lärm (Lärmaktionsplan, Umgebungslärm, Lärmschutz) · `ordnungsdienst` Ordnungsamt, Ordnungsdienst, Polizei, Videoüberwachung · `gefahrenabwehr` Gefahrenabwehrverordnung, Verbote, Hunde, Tierseuchen |
| `wirtschaft.gewerbe` Gewerbegebiete | wie die Nutzung unter `bauen.plan`: `gewerbe` · `industrie` · `logistik` · `rechenzentrum` · `energie` · `handel` |

## 8. Abgeleitet, nicht eigens eingeordnet

- **Formalien ausblenden** (Suche): Art ist nicht Sachpunkt.
- **Privater Bauantrag** (plenara.X): Vorgangsart Genehmigung für Dritte, Unterthema `bauen.dritte`.
- **Routinepunkte** (plenara.X): Art Ablauf oder Personalie.
- **Ausgang** (Newsradar): Status.
- **Status eines Vorgangs** (mehrere Berichte derselben Vorlage, `case_key`): das letzte belegte Ergebnis aller Berichte bis zum Stichtag; Angekündigt nur, wenn keiner ein Ergebnis hat.
- **Fraktionsprofil:** Partei aus dem Fakt `faction`, gelesen nur bei Antrag aus der Politik mit Antragsteller Fraktion; Status aus dem Modell.
- **Schritt der Signale:** Schritt, sonst Vorgangsart.
- **Signale:** nur konkrete Vorhaben (Abschnitt 4a); Kategorie, Filter und Schritt aus Thema, Unterthema, Unter-Unterthema, Vorgangsart und Status:

| Signal | Auswahl | Filter | Schritt |
|---|---|---|---|
| Ausschreibungen und Vergaben | Vorgangsart Bau und Vergabe | Leistungsart; Gegenstand aus dem Thema | Status |
| Neue Wohnbaugebiete | `bauen.plan` oder `bauen.erschl` mit Nutzung `wohnen`/`misch` | Vorhaben unter `bauen.erschl`, sonst Planung | Vorgangsart und Status |
| Gewerbe, Industrie und Handel | Nutzung `gewerbe`, `industrie`, `logistik`, `rechenzentrum`, `handel`, `freizeit` oder `wirtschaft.gewerbe`/`innen` | Nutzung bzw. Unter-Unterthema | Vorgangsart und Status |
| Windenergie, Solarenergie | `umwelt.ee` mit `wind` bzw. `pv_*`, `speicher` | Unter-Unterthema; bei Wind die Vorgangsart (Genehmigung für Dritte, Planung, Vertrag) | Vorgangsart und Status |
| Wärme, Energieeffizienz und Netze | `umwelt.waerme`, `umwelt.klimaschutz` | Unter-Unterthema | Vorgangsart und Status |
| Schulen, Kitas und Sportstätten | `bildung.schulbau`, `bildung.kitabau`, `kultur.sport`, `kultur.spiel`, Vorgangsart Bau und Vergabe oder Planung | Unterthema und Unter-Unterthema | Vorgangsart und Status |
| Straßen, Brücken und Radwege | `mobilitaet.strasse`, `rad`, `geh` | Unterthema und Unter-Unterthema | Vorgangsart und Status |
| Wasser, Abwasser und Hochwasserschutz | `umwelt.wasser`, `umwelt.anpass` | Unter-Unterthema | Vorgangsart und Status |
| Breitband und Mobilfunk | `verwaltung.breit` | Unter-Unterthema | Vorgangsart und Status |
| Mobilität | `mobilitaet.oepnv` `buergerbus`, `mobilitaet.plan` | Unter-Unterthema | Vorgangsart und Status |
| Pflege und Gesundheit, Einzelhandel (zurückgestellt) | `soziales.senior`, `soziales.gesund`, `wirtschaft.innen` | Unter-Unterthema | Vorgangsart und Status |

Nicht abgedeckt und bewusst später: Werte aus den Unterlagen (Fakten), Kernsätze der Zusammenfassung, Empfehlung der Verwaltung, Hausform.

## 9. Ergänzungen nach dem zweiten Pilot (entschieden 21.10.2026, Claude im Auftrag von Nico)

1. **Status:** Platzhalter des Imports („Öffentlich auf der Tagesordnung; ein Ergebnis ist … nicht belegt“) sind kein Beleg. Vergangene Sitzung ohne Beleg → Stand offen, nie Angekündigt. Ausnahme wie in Abschnitt 4: ein Sachpunkt mit Vorgangsart Information ohne Beschlussvorschlag, dessen Sitzung vorbei ist → Zur Kenntnis (der Vorgang dient der Information). Bei Ablauf und Personalie „Zur Kenntnis“ nur, wenn es belegt ist („zur Kenntnis genommen“, „Erledigt“ bei einem Bericht). Nimmt ein Ausschuss zur Kenntnis und das letzte Gremium hat kein Ergebnis → Zur Kenntnis.
2. **Thema vor Verfahren auch bei Geld:** „Überplanmäßige Ausgabe für die Zufahrt zum Feuerwehrhaus“ → Sicherheit (Feuerwehrhäuser) zuerst, `finanzen.upl` als zweites; ebenso Bürgschaft für einen Verein → Kultur (Vereine), `finanzen.kredit` als zweites.
3. **Vorgangsart:** entscheidet, worüber beschlossen wird, nicht das Wort im Titel („Vorstellung …“ mit Beschluss zur Umsetzung → das beschlossene Geschäft). Gebühren-, Beitrags- und Steuersatzungen → Geld. Straßenbenennung → Planung und Regelung. Anfrage eines Ratsmitglieds mit Antwort → Antrag aus der Politik. Satzung oder Maßnahme auf Antrag oder Anregung (im Titel genannt) → Antrag aus der Politik. Stellungnahme eines Ausschusses oder Beirats → Information.
4. **Art:** Antrag auf Benennung oder Entsendung eines Mitglieds → Personalie.
5. **Dokumente:** Liegen Vorlage und Sammeldokument nebeneinander, ist die Vorlage das Hauptdokument. Ein Vorlagenlebenslauf oder Beratungsverlauf mit Abstimmungsergebnis → Ergebnis (kann Ergebnisdokument sein), ohne Ergebnis → Sonstiges. Niederschrift einer früheren Sitzung, die nur genehmigt wird → Niederschrift.
6. **Leistungsart:** Digitalfunk und Funktechnik → IT und Digitales.
7. **Lärm:** kein neues Unterthema; Lärmaktionsplan, Umgebungslärm, Lärmschutz → `sicherheit.ordnung.laerm` (Abschnitt 7). Neue Unterthemen gibt es nicht, nur neue Unter-Unterthemen.
8. **Empfehlung oder Beschlossen:** Ob ein Ausschuss vorberät oder selbst entscheidet, ist aus den Daten meist nicht erkennbar. Deshalb: Empfehlung nur, wenn die Quelle es sagt oder in der Beratungsfolge danach noch das entscheidende Gremium kommt; sonst gilt das letzte „beschlossen“ bis zum Stichtag als Beschlossen.

## 10. Ergänzungen nach dem Nachtrag (entschieden 21.10.2026, Claude im Auftrag von Nico)

1. **Vorhaben ja:** auch kleine bestimmte Vorhaben und Beschaffungen (neue Internetseite, Erdverkabelung eines Netzbetreibers); ob daraus ein Signal wird, entscheidet das Unterthema. Eine Flächennutzungsplan-Änderung zählt als Vorhaben, auch wenn das Gebiet nur im Text steht.
2. **Vorhaben nein:** Gesamtkonzepte und -prüfungen (Starkregenrisikomanagement, Prüfung aller Brücken), Rahmenverträge (Straßenunterhaltung), Benennungen (Straßennamen im Baugebiet), Denkmalbereichssatzungen.
3. **Antragsteller:** Ortsbeiräte, Ortschaftsräte, Beiräte und Jugendräte als Antragsteller → `body`.
4. **Empfehlung:** nur wenn der Beschlussvorschlag oder eine Stellungnahme der Verwaltung es klar sagt; sonst `none`.

## 11. Ergänzungen während der großen Einordnung (entschieden 21.10.2026, Claude im Auftrag von Nico)

1. **Status:** Antrag „für erledigt erklärt“ oder „bearbeitet“ nach einem Bericht → Zur Kenntnis. „Erledigt“ bei einer Beschlussvorlage ohne weitere Angabe, leeres „Abstimmungsergebnis:“, Ergebnis-PDF ohne Text → kein Beleg. Beschlussvorschlag „nimmt zur Kenntnis“ und Ergebnis „beschlossen“ → Zur Kenntnis.
2. **Art:** Ehrung einzelner Personen, auch Sportlerehrung, und Wahl der Schriftführung → Personalie (die Richtlinie für Ehrungen ist ein Sachpunkt, `kultur.verein`).
3. **Schritt (Bauleitplanung):** Veränderungssperre, Einstellung des Verfahrens → `sonst`; Abwägung mit erneuter Offenlage → `entwurf`. Stellungnahme der Gemeinde zum Plan einer Nachbargemeinde → Vorgangsart Genehmigung für Dritte, Unterthema `bauen.plan`, Planschritt `sonst`.
4. **Vorgangsart:** Zulassung, die die Gemeinde für ein eigenes Vorhaben beantragt (wasserrechtliche Erlaubnis für die eigene Kläranlage) → nach dem Vorhaben (meist Bau und Vergabe), nicht Genehmigung für Dritte. Bürgerbegehren und Widerspruch dazu → Antrag aus der Politik. Stellenplan als eigener Punkt → Geld (`finanzen.hh`).
5. **Empfehlung:** `accept` nur, wenn die Verwaltung zustimmt oder den Antrag als Beschlussvorschlag übernimmt; gibt die Vorlage den Antrag nur wieder → `none`.
6. **Thema ohne passendes Unterthema** (Beflaggung, Forderungspapier zur Selbstverwaltung): Thema vergeben, Unterthema leer lassen. Vorgarten- und Gestaltungssatzung → `bauen.stadt`; rechtliche Betreuung → `soziales.beratung`; Frauenhaus → `soziales.inkl`.
7. **Dokumente:** PDFs, die erkennbar zu einem anderen Punkt gehören, → Sonstiges, nie Haupt- oder Ergebnisdokument. Besteht der Bericht nur aus Schreiben Dritter oder Protokollen, gibt es kein Hauptdokument.
8. **Nur ein Name** (eines Gremiums, Bauwerks, Projekts: „Brückentor-Komplex“, „Baumaßnahme An der Karlsquelle“): Sachpunkt; Thema, was erkennbar ist, sonst offen; Vorhaben ja, wenn ein bestimmtes Bauwerk oder Projekt genannt ist.
9. **Angebote ohne Bau** (Hort, Buslinie, Beratungsstelle einrichten) → Planung und Regelung, Vorhaben ja. Laufende Dienstleistungen (Reinigung, Winterdienst) vergeben → Bau und Vergabe mit Leistungsart Dienstleistung, Vorhaben nein (wie Rahmenvertrag).
10. **Einzelne Zuordnungen:** Querungshilfe an einer Straße → `mobilitaet.sicher`, Vorhaben ja; mobile Eisbahn → `kultur.spiel.freizeit`; Tierschutz, Tierheim → `sicherheit.ordnung`; Betriebshof im Plangebiet → Nutzung `gemeinbedarf`.
11. **Dokumente:** „Kurzbeschlüsse“ oder Beschlussliste der ganzen Sitzung → Niederschrift; derselbe Dokumentsatz bei mehreren Gremien → je Bericht normal einordnen. Ergebnis-PDF ohne Text → Dokumentart Ergebnis nach dem Namen, aber kein Beleg für den Status.
12. **Anfrage „beantwortet“** ohne genannten Fragesteller → Vorgangsart Antrag aus der Politik, Antragsteller leer.
13. **Status über mehrere Gremien:** Hat ein späteres Gremium (Sitzung vorbei) nur einen Platzhalter, ist der Stand offen, auch wenn ein früheres ein Ergebnis hatte; Ausnahme: das frühere Ergebnis beendet den Vorgang („zurückgezogen“, „abgelehnt“ im entscheidenden Gremium).
14. **Wärmeplanung:** „Vorstellung der kommunalen Wärmeplanung“ ohne Beschluss → `frueh` (früher `analyse`); mit Beschluss des Plans → `beschluss`. Zustimmung oder Stellungnahme einer Ortsgemeinde zum Flächennutzungsplan der Verbandsgemeinde → Genehmigung für Dritte, Planschritt `sonst`.
15. **Angekündigt mit Vorgeschichte:** Hat ein früheres Gremium der Beratungsfolge schon ein Ergebnis (empfohlen, beschlossen, vertagt), ist der Status dieses Ergebnis, auch wenn die nächste Sitzung noch aussteht; Angekündigt nur ohne jedes frühere Ergebnis.

## 12. Kernsätze (Zusammenfassung kurz und lang, seit 22.10.2026)

Die Zusammenfassung besteht aus wörtlichen Sätzen des Hauptdokuments, nichts wird umformuliert. Eingeordnet wird je Bericht, welche der nummerierten Sätze (Satzkandidaten, `shared/model/sentences.mjs`) in die Kurz- und welche in die Langfassung gehören. Nur was im Satz steht, zählt.

**Kurzfassung:** 1 oder 2 Sätze, zusammen höchstens etwa 40 Wörter. Sie sagen, worum es geht und was beschlossen werden soll (bei Beschlussvorlagen meist ein Satz aus dem Beschlussvorschlag) bzw. was berichtet oder beantragt wird. Der erste Satz muss allein verständlich sein: kein „dies“, „diese Maßnahme“, „wie oben“ ohne Bezug im Satz.

**Langfassung:** 3 bis 6 Sätze, zusammen etwa 80 bis 140 Wörter, in der Reihenfolge des Dokuments. Sie enthält die Sätze der Kurzfassung und dazu, was ein Leser zum Verständnis braucht: Anlass, Ziel, wichtige Zahlen (Kosten, Beträge, Fristen, Mengen, Flächen), Folgen und, falls genannt, die Haltung der Verwaltung.

**Nicht nehmen:** Kopfzeilen und Formularfelder (Drucksache, Datum, Beratungsfolge, Öffentlichkeitsstatus), Anrede und Grußformeln, bloße Wiederholung des Titels, reine Aufzählungen von Rechtsgrundlagen („gemäß § 5 Abs. 2 …“ ohne Inhalt), Verweise ohne Inhalt („siehe Anlage“), Tabellenreste und abgebrochene Sätze, Sätze über andere Tagesordnungspunkte.

**Keine Zusammenfassung** (beide leer): wenn kein Satz den Gegenstand trägt, etwa bei einer Niederschrift der ganzen Sitzung, einem Deckblatt, einer Einladung, einem Schreiben ohne Inhalt oder unlesbarem Text.

Grenzfälle:
- Antrag einer Fraktion: Kurzfassung ist der beantragte Beschluss („Die Verwaltung wird beauftragt, …“), nicht die Begründung.
- Mitteilung, Bericht, Antwort auf eine Anfrage: Kurzfassung ist der Satz mit der eigentlichen Auskunft, nicht „Die Verwaltung teilt Folgendes mit“.
- Bebauungsplan: Kurzfassung ist der Beschluss mit Planname und Schritt; in die Langfassung Lage, Ziel des Plans, Größe.
- Haushalt und Gebühren: Beträge und Sätze gehören in die Langfassung, wenn sie im Satz stehen.
