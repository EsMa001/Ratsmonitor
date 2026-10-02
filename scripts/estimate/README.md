# Messung für die Hochrechnung

Die Adminseite 3 (`/admin?seite=3`) schätzt das bundesweite Aufkommen an Berichten und Dokumenten. Die Rechnung selbst steht in `shared/estimate.mjs` und `shared/estimate-size.mjs`. Dieses Verzeichnis enthält die Skripte, die ihre Messdaten erzeugen. Sie werden von Hand gestartet, schreiben nichts in die Datenbank und rufen keine KI-Schnittstelle auf.

## Ablauf

| Schritt | Aufruf | Ergebnis |
|---|---|---|
| 1 | `node scripts/build-population.mjs` | `shared/germany-population.json`: Einwohner jeder Gemeinde, jedes Kreises, Gemeindeverbands und Bezirks, nach Bundesland |
| 2 | `node scripts/estimate/draw-sample.mjs` | `tmp/sample/areas.json`: Zufallsstichprobe je Bundesland und Größenklasse |
| 3 | `DIR=tmp/sample/ AREAS=tmp/sample/areas.json node scripts/source-discovery/crawl.mjs`, danach `verify.mjs` mit denselben Variablen | `tmp/sample/verified.json`: gefundene und geprüfte Quellen |
| 4 | `node scripts/estimate/units.mjs prepare`, Verbände prüfen (Aufruf im Kopf des Skripts), dann `node scripts/estimate/units.mjs` | `tmp/sample/sources.json`: je Einheit Quelle und Ergebnis der Suche |
| 5 | `node scripts/estimate/count-year.mjs` | `tmp/sample/year/<id>.json`: Berichte eines Jahres mit Sitzungstagen und Dokumentverweisen |
| 6 | `TOKENIZER_DIR=… node scripts/estimate/measure-size.mjs` | `tmp/size/measured.json`: Messwerte der Dokumente |
| 7 | `node scripts/estimate/build-samples.mjs` | `shared/estimate-samples.json`, `shared/document-size-sample.json` |

Die Schritte 5 und 6 setzen einen unterbrochenen Lauf fort. `TO=2026-10-02` legt in den Schritten 6 und 7 das Ende des Zeitraums fest.

## Stichprobe

- Gezogen wird in fünf Ländern mit unterschiedlicher Gemeindestruktur (Bayern, Rheinland-Pfalz, Schleswig-Holstein, Niedersachsen, Sachsen) je Größenklasse eine feste Zahl an Gemeinden und Kreisen, dazu Gemeindeverbände und alle Bezirke von Berlin und Hamburg. Die Reihenfolge ergibt sich aus einem Hash des amtlichen Schlüssels und einem festen Startwert; dieselbe Eingabe liefert dieselbe Stichprobe.
- Einheiten ohne lesbares System bleiben in der Stichprobe. Sie liefern den Anteil des Aufkommens, der heute erfassbar ist.
- Eine gezogene Mitgliedsgemeinde steht für ihren Gemeindeverband: Verband und Mitglieder führen in der Regel ein gemeinsames System. Welche Gemeinden zusammengehören, ergibt sich aus den ersten neun Stellen des Regionalschlüssels.
- `TRUST_LINK=1` bei der Prüfung der Verbände: Das System eines Verbands nennt die einzelne Mitgliedsgemeinde oft nicht im Namen. Der Verweis von der offiziellen Website der Gemeinde gilt dann als Beleg.

## Zählung

- Ein Bericht zählt an dem Tag, an dem er erstmals auf einer Tagesordnung stand.
- Verbände werden über alle Körperschaften ihres Systems gezählt: SessionNet trennt sie über den Kalenderparameter `__cpanr`, OParl über mehrere `Body`-Einträge, More! Rubin liefert alle zusammen.
- Das Skript benutzt dieselben Abrufbausteine wie der Betrieb (`server/integrations`), mit einem Zeitraum von zwölf Monaten und einem Zeitbudget von zwanzig Minuten je Einheit. Je Server läuft ein Abruf zur gleichen Zeit.

## Dokumentenmessung

- Je Gebiet werden bis zu zwölf Berichte mit Dokumenten ausgewählt (Reihenfolge nach einem Hash der Berichtskennung). Für NRW stammen die Berichte aus der lokalen Datenbank (nur lesend), sonst aus der Zählung.
- Jedes Dokument wird einmal abgerufen. Festgehalten werden Dateigröße, Seiten, Zeichen, Seiten ohne Textebene, Tokens und die Art des Dokuments laut Titel. Text wird nicht gespeichert.
- Dateien über 12 MB werden nicht geladen; ihre Größe stammt aus der Serverangabe. Der Betrieb überspringt solche Dateien ebenfalls.
- Tokens: mit `TOKENIZER_DIR` zählt das Skript lokal mit `@anthropic-ai/tokenizer` und zum Vergleich mit `gpt-tokenizer` (o200k). Beide Pakete liegen außerhalb des Projekts, zum Beispiel `npm install --prefix <Ordner> @anthropic-ai/tokenizer gpt-tokenizer`. Ohne die Variable rechnet die Auswertung mit 2,8 Zeichen je Token. Die Zählung ist eine Näherung; aktuelle Modelle verwenden andere Tokenizer.
- Ein Dokument, das an mehreren Berichten eines Gebiets hängt (Einladung, Niederschrift), zählt in der Variante „jedes Dokument einmal“ anteilig.

## Rücksicht auf die Quellen

Abgerufen werden nur öffentliche Seiten und Dokumente, mit der Kennung des Projekts im `User-Agent`, mit Pausen und ohne parallele Abrufe auf demselben Server. Anmeldungen, Zugriffssperren und HTTP 403 werden nicht umgangen; solche Einheiten gelten als nicht lesbar.
