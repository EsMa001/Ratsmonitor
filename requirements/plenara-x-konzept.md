# plenara.X – Zweck, Datenmodell, Logik (Konzept, 13.10.2026)

## 1. Wozu plenara.X da ist

Die Suche beantwortet: „Wo steht mein Begriff?“ plenara.X beantwortet, was man aus vielen Vorgängen zusammen erst sieht. Die Branchenseiten nennen dafür vier Gruppen von Nutzern:

- **Immobilien, Planungsbüros:** Wo entstehen Baugebiete, in welchem Verfahrensschritt, mit wie vielen Wohneinheiten? Wo werden Planungsleistungen vergeben?
- **Versorger:** Wo laufen Konzessionen, Gebührenkalkulationen, Wärmeplanung, Ausbau?
- **Verbände:** Was beschließen die Kommunen meiner Mitglieder (Hebesätze, Förderung, Haushaltssicherung), und welche Fraktionen treiben was?
- **Presse, Öffentlichkeit:** Was ist diese Woche berichtenswert, wie entscheidet mein Ort im Vergleich?

Daraus folgen fünf Grundfragen. Jede heutige Analyse ist eine davon, auf ein Thema angewandt:

| Frage | heutige Analysen |
|---|---|
| **Wo passiert etwas, und ist das viel?** (Verbreitung, Vergleich mit ähnlichen Orten) | Themenradare, Karte, „Viel oder wenig“, Ortsvergleich |
| **Wie weit ist es?** (Stadium, Ausgang, Dauer) | Bauleitplanung, Beschlüsse, Beratungswege, Wärmeplanung |
| **Wer treibt es?** (Fraktion, Gremium) | Fraktionsprofil, Beratungswege |
| **Um welche Werte geht es?** (Satz, Betrag, Anzahl) | Hebesätze, Gebühren, Förderung, Kita-Beiträge und -Plätze, Wohneinheiten |
| **Wann und in welcher Reihenfolge?** (zeitlicher Verlauf) | Trends, Ausbreitung, Newsradar, Themennetz |

Der Kern ist für alle Gruppen derselbe: **die richtigen Vorgänge finden und einordnen.** Eine Zahl ist nur so viel wert wie die Liste dahinter, und jeder Eintrag der Liste braucht Ort, Stand und Beleg (Produktvorteile Rang 5 „Jede Angabe mit Originalquelle“, 6 „Stand jedes Vorgangs auf einen Blick“, 7 „Sofort sehen, wo etwas passiert“, 20 „Grenzen und Abdeckung offen benannt“). Kennzahlen ohne nachprüfbare Liste, wie der plenara.X Score, gehören nicht dazu. Der Score entfällt.

## 2. Folgerungen für die Technik

1. **Einheit ist der Vorgang**, nicht die Suchkarte und nicht das Dokument. Derselbe Gegenstand in Ausschuss und Rat ist ein Vorgang.
2. **Grundlage sind die Texte aller Dokumente eines Vorgangs** (Vorlage, Anlagen, Niederschrift). Sie liegen in der Regel vor. Zusammenfassungen gibt es nur für einen kleinen Teil (lokal: Regel-Zusammenfassung bei 54.224 von 941.027 Berichten, 6 %). Sie sind deshalb **Ausgabe, nicht Eingabe**: Sie werden angezeigt, wo vorhanden, aber nichts wird aus ihnen berechnet. Dann zählt jeder Vorgang gleich, egal ob er eine Zusammenfassung hat.
3. **Jedes Dokument wird einmal gelesen.** Dieselbe Datei hängt oft an vielen Vorgängen (Haushaltsplan, Niederschrift). Ergebnisse je Dokument werden über die Prüfsumme des Textes gespeichert und wiederverwendet.
4. **Jeder Wert hat einen Beleg** (Satz, Dokument, Seite) und eine gemessene Trefferquote. Was die Schwelle nicht erreicht, wird nicht gezeigt.
5. **Eine Abfrage für alles:** Auswahl × Gliederung × Kennzahl (Abschnitt 6). Jede Seite ist eine feste Einstellung dieser Abfrage.

## 3. Die Oberfläche, auf die das zielt

- **Atlas:** eines der 10 Themen wählen (Abschnitt 5.1), Unterthemen als Knöpfe. Ein Unterthema zeigt, was geschieht (Antrag, Planung, Vergabe, Bau, Beschluss), jüngste Vorgänge, Verlauf je Monat, Karte, und eigene Werte, wo sie verlässlich sind.
- **Ort** unter der Themenwahl: Anteil des Orts gegenüber seiner Vergleichsgruppe, seine jüngsten Vorgänge. Der Ort bleibt beim Themenwechsel gesetzt.
- **Werkzeuge** (Trends, Ausbreitung, Ortsvergleich, Beschlüsse, Beratungswege, Themennetz): mit freier Suche, Thema oder Unterthema, über dieselben Vorgänge und dieselben Zählregeln.
- Hinter jeder Zahl die Liste der Vorgänge mit Beleg. Jede Seite nennt Abdeckung und Messstand.

## 4. Datenmodell

### 4.1 Dokumentebene (einmal je Text)

**`x_docs`** `(text_sha, kind, pages, rules, read_at)`
- `kind` ist die Dokumentart: Vorlage, Beschlussvorschlag, Satzung, Kalkulation, Begründung, Bescheid, Haushaltsplan, Niederschrift, Einladung, sonstige Anlage. Sie kommt aus Titel und Textanfang, wie heute in `shared/document-type.mjs`.

**`x_doc_values`** `(text_sha, kind, key, value, unit, qualifier, page, quote, rules)`
- Alle Rohwerte, die die Regeln in einem Text finden, mit Satz und Seite.
- `qualifier` hält fest, was die Regeln über den Satz wissen: bisher, beantragt, bewilligt, Höchstbetrag, Bestand, geschätzt.
- Abhängig ist das nur vom Text und der Regel-Fassung, nicht vom Vorgang. Ein neuer Vorgang mit bekannter Datei kostet nichts.

### 4.2 Vorgangsebene

**`x_cases`** (ein Vorgang je Zeile)

| Spalte | Inhalt |
|---|---|
| `id` | Vorlagennummer im Gebiet, sonst Gebiet + normalisierter Titel |
| `region_id`, `member_id` | Gebiet; Mitgliedsgemeinde bei Verbänden |
| `title`, `card_ids`, `doc_shas` | Titel, Suchkarten, Texte des Vorgangs |
| `first_date`, `last_date`, `next_date` | erste, letzte, nächste Sitzung |
| `path` | Gremienfolge (für Beratungswege) |
| `status` | beschlossen, abgelehnt, vertagt, Kenntnis, offen; aus den Ereignissen des Ratsinformationssystems, später ergänzt um das Ergebnis aus der Niederschrift |
| `kind` | Antrag, Anfrage, Vorlage, Bericht, Satzung |
| `stage` | was geschieht: Antrag, Planung, Vergabe, Bau, Gebühr, Beschluss … |
| `routine` | Formalie, Besetzung, Fragestunde, privater Bauantrag: zählt nirgends |
| `text_state` | alle Texte gelesen, teilweise, keine (für die Abdeckung) |

**`x_case_topics`** `(case_id, topic_id, where)`
- `where` ist Titel oder Betreff/Beschlussvorschlag.

**`x_case_values`** `(case_id, kind, key, value, unit, status, quote, doc_sha, page, rules)`
- Je Vorgang und Wertart **ein** Ergebnis, aufgelöst aus `x_doc_values` nach festen Regeln (Abschnitt 5.4).

### 4.3 Vorberechnete Zahlen

- **`x_stats`** `(region_id, topic_id, month, cases, by_stage, by_status)`: nur Einträge mit Wert.
- **`x_peers`** `(region_id, group)`: Art, Größenklasse, Land.
- **`x_norms`** `(topic_id, group, quartiles)`: Verteilung je Vergleichsgruppe, je Datenstand einmal.

### 4.4 Was entfällt

- `topic_facts`, `facts_keys` und `scripts/pdf-store/facts.mjs`
- der Faktenteil von `refreshSummaries`
- die eigenen Zwischenspeicher der 16 Module
- Score und `region_scores`

## 5. Logik

### 5.1 Zehn Themen für alles (Entscheidung 13.10.2026)

Es gibt genau **10 Themen**. Sie gelten in Suche, Lena, Trends, Ortsvergleich und plenara.X gleich. Jeder Vorgang hat **genau ein Thema** oder ist „noch nicht zugeordnet“. Die Themen ersetzen die heutigen 16 Sachgebiete (Labels). Sie entstehen durch Zusammenlegen; dadurch lassen sich die bestehenden Referenzsätze mechanisch umschlüsseln.

| Thema | entsteht aus den heutigen Sachgebieten | Anteil lokal |
|---|---|---|
| Bauen & Wohnen | Bauen & Wohnen | 7,2 % |
| Finanzen & Haushalt | Finanzen & Haushalt | 6,6 % |
| Mobilität & Verkehr | Mobilität & Verkehr | 4,8 % |
| Bildung & Betreuung | Bildung & Betreuung | 3,5 % |
| Umwelt, Klima & Energie | Umwelt & Natur, Klima & Energie (auch Wasser, Abwasser, Abfall) | 3,8 % |
| Soziales & Gesundheit | Soziales & Teilhabe, Gesundheit & Pflege | 2,6 % |
| Kultur, Sport & Freizeit | Kultur, Sport & Freizeit | 3,2 % |
| Sicherheit & Ordnung | Sicherheit & Ordnung | 1,7 % |
| Verwaltung & Digitalisierung | Verwaltung & Digitalisierung | 1,9 % |
| Wirtschaft & Arbeit | Wirtschaft & Arbeit | 0,5 % |
| *noch nicht zugeordnet* | Sitzungsablauf & Gremienarbeit, Allgemeine Anfragen & Mitteilungen, Noch nicht eingeordnet | 64 % |

**„Noch nicht zugeordnet“:**
- Der Topf ist groß, weil er fast nur Formalien ohne Sachthema enthält: Niederschriften, Tagesordnung, Mitteilungen.
- „Formalien ausblenden“ in der Suche blendet die meisten weiter aus. Das bleibt eine eigene Markierung (`search_cards.formal`, `x_cases.routine`) und ist kein Thema.
- Das Ziel bleibt, den Anteil der Sachvorgänge darin zu senken.

**Folgen:**
- **Labels** (`shared/labels.mjs`): neue Katalogversion `labels-v3` mit den 10 Themen und neue `CLASSIFIER_VERSION`. Die Entscheidungslogik (Vorrangregeln, erstes Sachgebiet) bleibt; zusammengelegte Gebiete fallen auf ein Thema.
- **Datenbank:** neue Migration für die Suchkarten-Trigger (wie `drizzle/0017`), Backfill mit `scripts/reclassify-rules.mjs`, danach `refresh-search-words.mjs --full` (Zahlen je Thema).
- **Referenzsätze** (`tests/fixtures/label-*.json`): auf die 10 Themen umschlüsseln und neu messen. Für die ehrliche Zahl einen neuen Satz ziehen.
- **Herkunft der Einordnung bleibt getrennt:** Heute steht je Bericht `labelAssessments.rule` (Titelregeln), `.ai` (KI) und `.review` (Korrektur von Hand); die Suche übernimmt nur die Regel. Lokal: 941.185 mit Regel, 406 auch mit KI, 0 Korrekturen. So bleibt es auch mit den 10 Themen: alle drei werden gespeichert, sichtbar ist eine. Zu entscheiden: Darf eine Korrektur von Hand die Regel überstimmen? Empfohlen ja. Darf es eine KI-Einordnung? Empfohlen nein, solange sie nicht gemessen ist.
- **Suche:** Der Filter „Thema“ zeigt nur die 10 Themen und „noch nicht zugeordnet“. Unterthemen gibt es dort nicht.
- **Lena:** Die Wortlisten (`shared/label-words.mjs`) werden auf die 10 Themen zusammengelegt. Lena erkennt so dieselben Themen wie Suche und Atlas.
- **Übrige Nutzer der Labels** (Trends, Ortsvergleich, Themennetz, Beschlüsse, Social Media, Admin-Zahlen) bekommen die 10 Themen über denselben Katalog.

### 5.2 Unterthemen und „Was geschieht“ (nur plenara.X): `shared/plenara-x/topics.mjs`

```js
{id:'verkehr.rad', thema:'Mobilität & Verkehr', name:'Radverkehr',
 begriffe:['Radweg','Radverkehr','Fahrradstraße','Radschnellweg','Fahrradabstell'],
 ausser:['Fahrradleasing','Dienstrad']}
```

- **Streng innerhalb des Themas:** Ein Unterthema gehört zu genau einem der 10 Themen. Es wird nur bei Vorgängen dieses Themas gesucht. So gilt überall dieselbe Zahl: Thema in der Suche = Thema im Atlas. Ein Vorgang hat 0, 1 oder mehrere Unterthemen seines Themas (5.2.1).
- **Begriffe statt versteckter Muster.** Gesucht wird in Titel und Betreff/Beschlussvorschlag des Hauptdokuments, nicht im ganzen Text: Der nennt zu viele Nebenthemen. Die Stichprobe vom 13.10.2026 bestätigt das, Unterthemen über den Titel stimmten in 92 % der Fälle.
- **Gemeinsame Ausschlüsse stehen einmal:** Straßennamen, „Bad …“, Ausschussnamen, Formalien.
- **„Was geschieht“** (`stage`) ist eine zweite Achse quer zu allen Themen: Antrag, Planung und Konzept, Ausschreibung und Vergabe, Bau und Sanierung, Gebühren und Entgelte, Beteiligung und Dialog, Förderung, Beschluss, Bericht. Die heutigen Radare **Vergabe, Gebühren und Beteiligung** werden zu Werten dieser Achse und sind keine Themen mehr. Beispiele: „Gebühren“ in Umwelt, Klima & Energie, „Vergaben“ in Mobilität & Verkehr.
- **Heutige Radare:** siehe 5.2.1; Versorgung, Verkehr, Soziales, Klima und Haushalt gehen als Unterthemen in die passenden der 10 Themen über. Kita, Bauleitplanung und Förderung werden Unterthemen (Kita in Bildung & Betreuung, Bauleitplanung in Bauen & Wohnen) bzw. die Achse „Förderung“.

### 5.2.1 Unterthemen: 7 je Thema, 70 insgesamt (Stand 13.10.2026)

**Zuordnung:**
- **Thema:** Jeder Vorgang hat genau ein Thema oder ist „noch nicht zugeordnet“. Das ist die feste Einordnung, die überall gleich zählt.
- **Unterthemen** sind freiwillig: Ein Vorgang hat 0, 1 oder mehrere Unterthemen seines Themas.
- **Sonstiges:** Wer keines hat, steht im Atlas unter „Sonstiges“ des Themas, sichtbar und mit Anteil.
- **Kein Zwang:** Eine Pflichtzuordnung würde Vorgänge in unpassende Unterthemen zwingen und deren Zahlen und Vergleiche verfälschen.
- **Ziel:** Das Ziel ist ein kleiner Rest, kein leerer: Kein Thema sollte mehr als etwa 25 % „Sonstiges“ haben.

**Wie gemessen:**
- **Grundlage:** Die Anteile sind der Teil der Vorgänge eines Themas, deren Titel das Unterthema trifft. Gezählt mit groben Mustern über die heutigen Labels in der lokalen Datenbank (941.027 Karten).
- **Aussage:** Sie zeigen, ob ein Unterthema genug Vorgänge hat. Ob die Zuordnung stimmt, zeigen erst die Prüflisten.
- **Überschneidungen:** Ein Vorgang kann mehrere Unterthemen treffen; die Summe kann daher über 100 % liegen.
- **Ungenau:** Mit „~“ markierte Werte sind geschätzt (Rest eines geteilten Unterthemas) oder durch zu breite Muster verzerrt.

**Bauen & Wohnen**

| Unterthema | Anteil | Inhalt |
|---|---|---|
| Bauleitplanung und Raumordnung | 33 % | Bebauungs- und Flächennutzungspläne, Veränderungssperren, Regionalplan, Bau-Turbo |
| Bauvorhaben Dritter | 23 % | Bauanträge, Bauvoranfragen, Einvernehmen, Befreiungen |
| Grundstücke und Liegenschaften | 14 % | Verkauf, Ankauf, Erbbau, Vorkaufsrecht |
| Stadtentwicklung, Sanierung und Denkmal | 6 % | Sanierungsgebiete, Städtebauförderung, ISEK, Denkmal, Gestaltungssatzung |
| Wohnungsbau und Wohnraum | 5 % | geförderter Wohnraum, Wohnungsmarkt |
| Erschließung und Baugebiete | 5 % | Erschließung, Neubaugebiete, Bauplätze |
| Öffentliche Gebäude und Plätze | neu | Dorfgemeinschaftshäuser, Neugestaltung von Plätzen, Abbruch (bisher großer Teil des Rests) |

**Finanzen & Haushalt**

| Unterthema | Anteil | Inhalt |
|---|---|---|
| Haushalt und Finanzplanung | 32 % | Haushalt, Nachtrag, Investitionsprogramm, Zwischenberichte, Haushaltsreste |
| Jahresabschluss und Prüfung | 21 % | Jahresabschluss, Rechnungsprüfung, Entlastung, Eröffnungsbilanz |
| Beteiligungen und Eigenbetriebe | 10 % | Wirtschaftspläne, Gesellschaften, Zweckverbände |
| Über- und außerplanmäßige Ausgaben | 6 % | Mehraufwendungen, Mittelbereitstellung |
| Steuern und Hebesätze | 4 % | Grund-, Gewerbe-, Hunde-, Zweitwohnungs-, Übernachtungssteuer |
| Haushaltssicherung | 3 % | Haushaltssicherung, Konsolidierung, Entschuldung |
| Kredite, Umlagen und Zuweisungen | 2 % | Kredite, Bürgschaften, Kreisumlage, Schlüsselzuweisungen |

„Annahme von Spenden“ ist eine Formalie (`routine`), kein Unterthema.

**Mobilität & Verkehr**

| Unterthema | Anteil | Inhalt |
|---|---|---|
| Straßen, Brücken und Beleuchtung | ~50 % | Straßenbau, Deckensanierung, Brücken, Straßenbeleuchtung. Die Zahl ist zu hoch, weil Straßennamen mitgezählt sind. |
| Bus und Bahn | 17 % | ÖPNV, Haltestellen, Linien, Deutschlandticket, Rufbus |
| Radverkehr | 11 % | Radwege, Fahrradstraßen, Abstellanlagen |
| Verkehrssicherheit und Tempo | 11 % | Tempo 30, Querungen, Ampeln, Schulwege, Lärmschutz |
| Parken | 7 % | Parkplätze, Parkgebühren, Bewohnerparken, Stellplatzsatzung |
| Gehwege und Barrierefreiheit | 4 % | Gehwege, barrierefreie Haltestellen |
| Verkehrsplanung und neue Mobilität | 3 % | Mobilitätskonzepte, Carsharing, Mobilitätsstationen, Ladesäulen |

**Bildung & Betreuung**

| Unterthema | Anteil | Inhalt |
|---|---|---|
| Schulbetrieb und Ausstattung | ~32 % | Schulen ohne Bau: Ausstattung, digitale Schule, Schulhof, Schulleitung |
| Kita-Betrieb, Träger und Beiträge | ~25 % | Trägerverträge, Betriebskosten, Elternbeiträge, Kindertagespflege |
| Schulbau und Sanierung | 14 % | Neubau, Erweiterung, Sanierung von Schulen, Turnhallen, Mensen |
| Ganztag und Hort | 12 % | OGS, Hort, Mittags- und Ferienbetreuung |
| Kita-Ausbau und Plätze | 8 % | Neubau, Erweiterung, neue Gruppen und Plätze, Bedarfsplanung |
| Schulentwicklung und Schülerbeförderung | 3 % | Schulentwicklungsplan, Schulbezirke, Zügigkeit, Schülerbeförderung |
| Berufs- und Erwachsenenbildung | 3 % | Berufsschulen, Volkshochschule, Hochschulen |

**Umwelt, Klima & Energie**

| Unterthema | Anteil | Inhalt |
|---|---|---|
| Natur, Bäume und Grünflächen | 25 % | Bäume, Grünflächen, Wald, Artenschutz |
| Wasser und Abwasser | 23 % | Trinkwasser, Kanal, Kläranlage, Niederschlagswasser |
| Erneuerbare Energien | 21 % | Photovoltaik, Solarparks, Agri-PV, Windenergie |
| Abfall und Entsorgung | 10 % | Abfallwirtschaft, Wertstoffe, Container |
| Wärme und Energieversorgung | 10 % | Wärmeplanung, Nah- und Fernwärme, Strom- und Gasnetze, Konzessionen, Stadtwerke |
| Klimaschutz und Energieeffizienz | 9 % | Klimaschutzkonzept, CO2-Bilanz, energetische Sanierung |
| Klimaanpassung, Hochwasser und Starkregen | 8 % | Hitze, Starkregen, Gewässer, Entsiegelung |

**Soziales & Gesundheit**

| Unterthema | Anteil | Inhalt |
|---|---|---|
| Senioren und Pflege | 23 % | Seniorenarbeit, Pflege, Demenz |
| Kinder, Jugend und Familie | 18 % | Jugendhilfe, Jugendarbeit, Schulsozialarbeit, Frühe Hilfen |
| Integration und Geflüchtete | 17 % | Unterkünfte, Integration, Migration |
| Inklusion und Gleichstellung | 15 % | Teilhabe, Behinderung, Gleichstellung |
| Gesundheitsversorgung | 8 % | Ärzte, Krankenhäuser, MVZ |
| Beratung und soziale Träger | 7 % | Beratungsstellen, Wohlfahrtsverbände, Quartiersmanagement |
| Armut, Wohnungslosigkeit und Grundsicherung | 5 % | Obdach, Wohngeld, Sozialticket, Tafel |

**Kultur, Sport & Freizeit**

| Unterthema | Anteil | Inhalt |
|---|---|---|
| Sportstätten und Bäder | 24 % | Sporthallen, Sportplätze, Kunstrasen, Hallen- und Freibäder |
| Kultur und Kunst | 21 % | Kulturarbeit, Museen, Theater, Ausstellungen |
| Feste und Veranstaltungen | 18 % | Feste, Konzerte, Kirmes, Jubiläen, Weihnachtsmärkte |
| Vereinsförderung und Ehrenamt | 16 % | Zuschüsse an Vereine, Sportförderung, Ehrenamt |
| Spiel- und Freizeitanlagen | 11 % | Spielplätze, Skateanlagen, Jugendtreffs |
| Heimat, Partnerschaften und Gedenken | 6 % | Städtepartnerschaften, Ehrungen, Gedenken |
| Bibliotheken und Musikschule | 5 % | Bücherei, Musikschule |

**Sicherheit & Ordnung**

| Unterthema | Anteil | Inhalt |
|---|---|---|
| Feuerwehrhäuser, Bedarfsplan und Organisation | ~38 % | Gerätehäuser, Feuerwachen, Brandschutzbedarfsplan, Satzungen und Organisation der Feuerwehr |
| Feuerwehrfahrzeuge und Ausrüstung | ~22 % | Fahrzeuge, Atemschutz, Funk. Das Muster erkennt bisher nur 6 % und muss verbessert werden. |
| Öffentliche Ordnung und Sicherheit | 16 % | Ordnungsdienst, Videoüberwachung, Gefahrenabwehr, Hunde |
| Friedhöfe und Bestattung | 16 % | Friedhöfe, Bestattung, Friedhofsgebühren (über die Achse Gebühren) |
| Rettungsdienst | 5 % | Rettungswachen, Rettungsdienstbedarf, Notarzt |
| Katastrophen- und Bevölkerungsschutz | 5 % | Sirenen, Warnung, Notstrom, Zivilschutz |
| Märkte, Sondernutzung und Gewerbeaufsicht | 1 % | Märkte, Sondernutzung, Sperrzeiten, verkaufsoffene Sonntage |

**Verwaltung & Digitalisierung**

| Unterthema | Anteil | Inhalt |
|---|---|---|
| Ortsrecht und Satzungen | ~46 % | Hauptsatzung, Geschäftsordnung, Zuständigkeiten. Die Zahl ist zu hoch, weil „Satzung“ zu allgemein ist; eingrenzen auf Ortsrecht. |
| Wahlen | 10 % | Kommunal-, Bürgermeister-, Beiratswahlen (nicht Besetzungen von Gremien, die sind `routine`) |
| Personal und Organisation | 9 % | Stellenplan, Organisation, Rathaus und Dienstgebäude |
| Digitalisierung und IT | 6 % | Software, Onlinezugang, IT-Sicherheit |
| Bürgerbeteiligung und Beiräte | 3 % | Bürgerbegehren, Einwohneranträge, Beiräte, Bürgerhaushalt |
| Breitband und Mobilfunk | 1 % | Glasfaser, Mobilfunk |
| Zusammenarbeit und Gebietsfragen | 1 % | interkommunale Zusammenarbeit, Zweckvereinbarungen, Fusionen |

**Wirtschaft & Arbeit**

| Unterthema | Anteil | Inhalt |
|---|---|---|
| Tourismus | 26 % | Tourismus, Gäste, Hotels, Wohnmobilstellplätze |
| Gewerbegebiete | 20 % | Gewerbe- und Industrieflächen, Gewerbeparks (Planverfahren selbst unter Bauen & Wohnen) |
| Wirtschaftsförderung und Ansiedlung | 18 % | Wirtschaftsförderung, Ansiedlung, Gründungen |
| Innenstadt, Stadtmarketing und Einzelhandel | 8 % | Innenstadt, Leerstand, Stadtmarketing, Einzelhandel |
| Arbeitsmarkt und Fachkräfte | 6 % | Jobcenter, Ausbildung, Fachkräfte |
| Regionalentwicklung und LEADER | neu | LEADER-Projekte, Regionalmanagement (bisher großer Teil des Rests) |
| Landwirtschaft und Forst | 2 % | Landwirtschaft, Forst, Jagd, Flurbereinigung |

**Quer zu allen Themen: Was geschieht (`stage`)**
- Antrag aus der Politik
- Planung und Konzept
- Ausschreibung und Vergabe
- Bau und Sanierung
- Gebühren und Entgelte
- Förderung
- Beteiligung und Dialog
- Beschluss
- Bericht

**Vor der Messung zu schärfen:**
- „Straßen, Brücken und Beleuchtung“ und „Ortsrecht und Satzungen“ sind zu breit.
- „Feuerwehrfahrzeuge und Ausrüstung“ erkennt zu wenig.
- Kleine Unterthemen (1 bis 3 %) bleiben, wenn sie für eine Zielgruppe zählen: Breitband für Versorger, Zusammenarbeit für Verbände, Märkte für Ordnungsämter. Sie haben aber nur wenige Vorgänge je Ort, deshalb kein „viel oder wenig“ für einzelne Orte, nur Listen und Karte.

### 5.3 Regeln je Dokument: `shared/plenara-x/read-doc.mjs`

```
readDoc(text, kind) → values[]
```

- **Rein:** keine Datenbank, kein Netz.
- **Gemeinsam für alle Regeln:** Satzteilung, Silbentrennung, Zahlen- und Betragslesung, Seitenzuordnung.
- **Je Wertart ein Modul** (`values/hebesatz.mjs`, `values/fee-rate.mjs` …). Es legt fest, **welche Dokumentarten es liest:**

| Wertart | liest |
|---|---|
| Hebesatz | Beschlussvorschlag, Satzung, Haushaltssatzung |
| Gebühr je m³/m² | Beschlussvorschlag, Satzung, Kalkulation |
| Bauleitplan: Schritt, Gebietsart | Titel, Beschlussvorschlag |
| Wohneinheiten | Vorlage, Begründung |
| Förderprogramm und -betrag | Vorlage, Bescheid; nie Haushaltsplan |
| Kita-Beiträge, -Plätze | Beschlussvorschlag, Satzung, Vorlage |
| Fraktion | Titel, Kopf der Vorlage |
| Abstimmungsergebnis | Niederschrift, nur der Abschnitt zum eigenen Tagesordnungspunkt (letzte Stufe, Abschnitt 8) |

- **Gemeinsame Kennzeichen** für jeden Treffer statt Einzelausschlüssen je Regel: bisher/Bestand, früher, geschätzt/möglich, Höchst-/Mindestbetrag, Spanne, je Einheit, Zahler ist die Kommune. Die Regeln verwerfen sie nicht, sondern speichern sie in `qualifier`. Die Auflösung entscheidet. So lässt sich später anpassen, ohne alle Texte neu zu lesen.

### 5.4 Auflösung je Vorgang: `shared/plenara-x/resolve.mjs`

```
resolveCase(case, docValues[]) → {topics, values, stage, status}
```

- **Rangfolge der Quellen:** Beschlussvorschlag vor Satzung oder Kalkulation, vor Vorlage, vor übrigen Anlagen.
- **Ein Wert je Vorgang und Wertart.** Treffer mit ausschließendem Kennzeichen (Bestand, Höchstbetrag …) zählen nicht.
- **Widersprüche** werden als `uncertain` markiert und nicht gezeigt, stehen aber in der Administration.

### 5.5 Ein Lauf: `server/integrations/plenara-x-build.mjs`

1. **Neue Texte** (Prüfsumme unbekannt oder Regel-Fassung neu) durch `readDoc` lesen und nach `x_doc_values` schreiben.
2. **Geänderte Vorgänge** (neue Karte, neues Dokument, neuer Text) bilden und auflösen.
3. **`x_stats`** für die betroffenen Gebiete nachführen; `x_norms` je Datenstand.

Der Lauf startet nach jedem Metadaten-Import und nach „Texte erstellen“ bzw. OCR. Er ist fortsetzbar, läuft unter einer Sperre und in Schritten, wie die Wortliste.

**Aufwand:** Der heutige Faktenlauf las 89.126 Texte in 187 s, etwa 2 ms je Text. Alle rund 2 Mio. Dokumente wären einmalig rund 70 Minuten, danach nur die neuen eines Tages. Eine neue Regel-Fassung für eine Wertart liest nur die Dokumentarten dieser Wertart neu.

### 5.6 Eine Abfrage: `server/integrations/plenara-x-query.mjs`, Route `GET /api/x`

```
auswahl   = thema:<eines der 10> | topic:<Unterthema> | suche:<Suchanfrage wie auf der Startseite>
gliederung = ort | monat | stage | status | fraktion | gremium | wert
kennzahl  = anzahl | anteil | vergleich (Vergleichsgruppe) | median/summe eines Werts | dauer | erste Erwähnung
```

- **Die Auswahl ergibt immer eine Menge von Vorgängen** aus `x_cases`. Die Suche liefert Karten, die über `card_ids` zu Vorgängen werden.
- **Danach gelten überall dieselben Regeln:** gleiche Vorgänge einmal, `routine` nie, Mitgliedsgemeinde aus `member_id`.
- **Katalog-Unterthemen** lesen aus `x_stats`. **Freie Suchen** zählen über die Vorgangsmenge und werden je Datenstand zwischengespeichert.
- **`list`** liefert zu jeder Kombination die Vorgänge mit Beleg und Kurzfassung, wo vorhanden.

## 6. Jede heutige Analyse als Einstellung der Abfrage

| Analyse | Auswahl | Gliederung | Kennzahl |
|---|---|---|---|
| Atlas-Thema | thema | Unterthema, stage, ort | anzahl, Vergleich |
| Atlas-Unterthema | topic | stage, monat, ort | anzahl, jüngste Vorgänge |
| Vergabe-, Gebühren-, Beteiligungsradar | thema oder topic | stage = Vergabe / Gebühren / Beteiligung | anzahl, Liste |
| Ort im Vergleich, Ortsvergleich | topic oder suche | ort | anteil, vergleich |
| Bauleitplanung | topic bauen.bauleitplanung | stage, wert (Gebietsart) | anzahl, summe Wohneinheiten |
| Hebesätze, Gebühren | topic | ort, wert | letzter Wert je Ort, median je Land |
| Förderradar | thema oder topic, stage = Förderung | wert (Programm), status | anzahl; Beträge nach Qualitätstor |
| Kita-Radar | topic kita | wert (Richtung) | anzahl; Plätze nach Qualitätstor |
| Fraktionsprofil | suche oder topic | fraktion, status | anzahl, Anteil beschlossen |
| Beschlüsse | suche oder topic | status, ort | anteil, dauer |
| Beratungswege | suche oder topic | gremium (`path`) | anzahl je Übergang |
| Trends | suche oder thema | monat | anzahl, Veränderung |
| Ausbreitung | suche | ort | erste Erwähnung |
| Themennetz | suche | Unterthemen und Wörter der Vorgänge | gemeinsames Vorkommen |
| Newsradar | alle | monat (letzte Tage) | jüngste Vorgänge nach Ausgang |
| Score | – | – | entfällt |

Die 16 Module werden zu einer Abfrageschicht mit diesen Einstellungen. Die Seitenbausteine bleiben weitgehend und bekommen ihre Daten aus `/api/x`.

## 7. Richtigkeit

- **Prüflisten** je Wertart (getrennt nach Dokumentart) und je Unterthema in `tests/fixtures/plenara-x/`:
  - Fälle mit und ohne Treffer, gezogen per SHA-256 aus ungesehenen Vorgängen.
  - Von Hand eingeordnet über eine Tabelle zum Gegenlesen mit den Spalten Satz, Vorschlag, richtig ja/nein.
  - Eine Liste, an der abgestimmt wurde, gilt danach als „gesehen“; für die ehrliche Zahl wird eine neue gezogen.
- **Messung:** `scripts/plenara-x/measure.mjs` ermittelt Genauigkeit und Abdeckung je Wertart, Dokumentart und Unterthema.
- **Qualitätstor:** Werte werden ab 90 % gezeigt, Unterthemen ab 85 %. Darunter stehen sie nur in der Administration. Liefert eine Dokumentart für eine Wertart zu viele Fehler, wird nur diese Kombination abgeschaltet.
- **Abdeckung offen:** Je Seite steht, für wie viele Vorgänge alle Texte gelesen wurden (`text_state`). Die Messwerte sind dort sichtbar.
- **Tests:** `readDoc` und `resolveCase` bekommen Einzelfalltests für jedes Kennzeichen, wie heute `tests/topic-facts.test.mjs`.

**Stand der Messung vom 13.10.2026**, Ausgangspunkt (kleine Stichproben, `docs/qualitaet/plenara-x/`):
- Themenzuordnung: 92 %
- Bauleitplanung, Hebesätze, Fraktion: nahe 100 %
- Förderprogramme: 85 %
- Kita-Beiträge: 75 %
- Kita-Plätze: 68 %
- Förderbeträge: nach Überarbeitung 83 % bei 5 Fällen

## 8. Umsetzung in Schritten

0. **Zehn Themen:** `labels-v3` in `shared/labels.mjs`, Referenzsätze umschlüsseln und messen, Trigger-Migration, Backfill, Wortliste, Lena-Wortlisten, Filter „Thema“ der Suche. Dieser Schritt ist unabhängig vom Rest und kann zuerst kommen.
1. **Unterthemenkatalog, `readDoc`, `resolveCase`** mit den Regeln aus `topic-facts.mjs` und `radars.mjs`, umgebaut auf Kennzeichen statt Verwerfen; Tests.
2. **Tabellen und Lauf**, parallel zu `topic_facts`; ein Vergleichsskript alt gegen neu, jede Abweichung erklärt.
3. **Prüflisten und Qualitätstor** für alle Unterthemen und Wertarten.
4. **Abfrage `/api/x` und neuer Atlas** (Thema, Unterthema, Ort); der Score wird entfernt.
5. **Werkzeuge, Fraktionsprofil und Newsradar** umstellen; danach die alten Module, `topic_facts` und `facts.mjs` entfernen.
6. **Anlagen und Niederschriften:**
   - Anlagen für die Wertarten nach 5.3 einbeziehen.
   - Niederschriften auf den eigenen Tagesordnungspunkt schneiden: Abstimmungsergebnis und Ausgang. Das ist der schwierigste Teil und kommt deshalb zuletzt.

Jeder Schritt ist für sich lauffähig; die heutigen Seiten laufen bis Schritt 5 unverändert.

## 9. Offene Entscheidungen

- **Unterthemen:** 7 je Thema entschieden; Begriffe und Ausschlüsse je Unterthema ausarbeiten und messen (5.2.1).
- **Schwellen:** gelten 90 % für Werte und 85 % für Unterthemen?
- **Zwischenstand:** Die Regeländerungen vom 13.10.2026 (`facts-v15`, nicht committet) übernehmen, als Zwischenstand committen oder verwerfen?
- **Texte auf dem Server:** Lokal liegen Texte nur für einen Teil der Berichte vor (Ablage März bis Oktober 2026). Vor Schritt 2 ist zu prüfen, wie vollständig sie auf dem Server sind, und die Abdeckung je Gebiet anzuzeigen.
