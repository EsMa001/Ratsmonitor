# Titelprüfung: belegte Fehler und offene Zuordnung

Stand: 07.10.2026. Untersuchte Basis: `ba9daa3e9ef1178886490bc4eac17f05e541cfa6`.

## Die 4.963 Fälle sind noch nicht ursächlich zugeordnet

Die README nennt 4.963 Treffer im damaligen Dev-Bestand mit etwa 1,27 Millionen Berichten. Die Messung enthält keine vollständige Fallliste nach Quelle und Adapter. Die Qualitätsprüfung speichert höchstens 20 Beispiele. Weder diese Datenbank noch ein vollständiger Export liegt im Checkout vor; die versionierten Importdateien sind ein anderer Datenstand. Es wurde keine Produktionsdatenbank gelesen oder geändert, kein Import gestartet und nichts deployt.

Die Bedingung zählt kanonische Vorgänge, deren amtlicher Titel (ersatzweise Titel) nach SQLite-`trim` auf `;`, `:` oder `,` endet. Ein solches Ende beweist weder einen Defekt noch dessen Ursache. Die Prüfung behält ihre ID und Trefferbedingung, heißt jetzt „Titel möglicherweise abgeschnitten“ und zählt unter Hinweisen. Auch bereits gespeicherte Messergebnisse werden dadurch nicht mehr als gesicherte Defekte summiert.

Für einen Abschluss der Ursachenanalyse fehlt eine lokale Kopie oder der vollständige Export **des gemessenen Dev-Bestands** mit `topics.payload`, insbesondere `sourceData`, IDs, Quelladressen und Sitzungsbezügen. Ein neuerer Stand kann analysiert werden, ersetzt aber nicht rückwirkend die damalige Messung. Eine passende Trefferzahl allein beweist ebenfalls nicht denselben Datenstand.

## Tatsächlich untersuchter Importstand

`topics.json`, `regions.json` und der geprüfte NRW-Snapshot `e20c38018e3addf1`: **17.358 Berichte, 15 Heuristiktreffer, 0 belegte Ergänzungsvorschläge**. Bei allen 15 fehlt `sourceData`. Ihre vollständigen IDs, Quelladressen, Titel und Payload-Prüfsummen stehen im [reproduzierbaren Audit](title-audit-bundled-2026-10-07.json).

| Gebiet | Quellhost | Treffer | Adapter laut heutigem Katalog, historisch nicht belegt |
| --- | --- | ---: | --- |
| Aachen (`nrw-05334002`) | ratsinfo.aachen.de | 8 | OParl |
| Köln (`nrw-05315000`) | buergerinfo.stadt-koeln.de | 1 | OParl |
| Herford (`nrw-05758012`) | herford.ratsinfomanagement.net | 1 | OParl |
| Senden (`nrw-05558044`) | sessionnet.owl-it.de/gemeinde-senden | 1 | SessionNet |
| Kreis Steinfurt (`steinfurt`) | sessionnet.owl-it.de/kreis_steinfurt | 2 | SessionNet |
| Marl (`nrw-05562024`) | marl.gremien.info | 2 | More! Rubin |

Beispielsweise enthält Aachen „Anfragen:“ und Marl „Kenntnisnahme der Berichtsvorlage en-bloc (TOP 16 -21.a):“. Ohne Originalfeld bleibt offen, ob das vollständige Quelltitel sind. Keine dieser 15 Zeilen wird dem Kartenparser zugeordnet, und keine Zahl wird auf die 4.963 Fälle hochgerechnet. Ein Abrufversuch der öffentlichen Aachener Originaladresse und der Sulzberger Beispielseite war in der Arbeitsumgebung nicht möglich; daraus folgt nichts über deren Inhalt.

## Reproduzierbarer Parserfehler

`parseAgendaCards` in `server/integrations/sessionnet.mjs` las aus `smc-card-text-title` ausschließlich den Teil vor dem ersten `<br>`. `2. Lesung:<br>Haushalt 2027` wurde so zu `2. Lesung:`; auch Titel ohne Satzzeichen verloren ihre Fortsetzung. Das Layout ist durch die vorhandene Sulzberg-Fixture belegt. Die zusätzlichen Umbruchvarianten sind ausdrücklich **synthetische Regressionseingaben**, keine behaupteten Originalbelege der 4.963 Fälle.

Die Korrektur liest den gesamten Titelcontainer. Eine getrennte Vorsitz-Angabe nach einer Leerzeile (`<br><br>Vorsitz: …`, bereits im bestehenden Test) bleibt ausgeschlossen. Ein beliebiger Doppelpunkt, ein Semikolon oder eine Leerzeile beendet den Titel nicht. Ergebnisfelder außerhalb des Containers werden nicht angehängt. Öffentlichkeit, Dokumente und die aus Vorlagen-ID bzw. Sitzung und TOP-Nummer gebildeten Kennungen ändern sich nicht.

`MARKS_VERSION` steigt nach der bestehenden Cache-Regel auf 2. Beim nächsten **manuell gestarteten** Import werden alte Lesemarken aller Adapter ungültig; dadurch können mehr Quellanfragen anfallen. Das verhindert, dass eine kürzlich gelesene Sitzung die Korrektur verdeckt. Der PR startet keinen solchen Import. Die vorhandene Importlogik archiviert geänderte Vorgänge und erhält gespeicherte Analysen; abweichende Analysegrundlagen werden als veraltet markiert.

Andere Parser werden mangels reproduzierbarem Fall aus dem betroffenen Bestand nicht geändert. Der Nachweis des Kartenfehlers ist keine Erklärung für sämtliche Heuristiktreffer, insbesondere nicht für OParl.

## Wiederholbarer, ausschließlich lesender Dry-Run

Node >= 22.13, keine zusätzlichen Abhängigkeiten. Aus dem Repository-Verzeichnis:

```bash
node scripts/audit-report-titles.mjs --bundled
node scripts/audit-report-titles.mjs --database /pfad/zur/lokalen-Kopie.sqlite --expected-count 4963
```

Die zweite Variante öffnet ausschließlich die ausdrücklich angegebene SQLite-Datei mit `readOnly:true` und `query_only`, zählt und liest innerhalb derselben Lesetransaktion. Sie verwendet dieselbe SQL-Bedingung wie die Qualitätsprüfung, liefert **alle** Treffer und gruppiert nach Gebiet, Quellhost und gespeichertem Adapter. Ein aktueller Katalogeintrag erscheint separat als `catalogHint`; fehlende historische Adapter werden nicht erfunden. Beide Varianten schreiben nur JSON nach stdout und rufen keine Quelle ab. Lokale Ausgaben etwa unter `.local-backups/` aufbewahren; vollständige Dev-Daten nicht in Git übernehmen.

`--expected-count` prüft die Anzahl. Bei Abweichung wird der vollständige Bericht ausgegeben und der Prozess endet mit Code 2; ungültige Optionen enden mit Code 1. Wiederholung auf demselben Stand ergibt denselben Bericht. Es gibt bewusst **kein `--apply`**, keinen API-Endpunkt und keine Migration für Titelkorrekturen.

| `cause` | Beleg und Konsequenz |
| --- | --- |
| `missing_provenance` / `missing_own_source_name` | Herkunft oder Originalname des eigenen Vorgangs fehlt; keine Ergänzung. |
| `parsed_fields_only` | Gespeicherte Parserausgabe, etwa `agenda.fields.title`, ist kein unabhängiger Originalbeleg. Auch ein Vorlagen-Betreff wird nicht mit einem TOP-Titel gleichgesetzt. |
| `punctuation_in_original_name` | Der ungekürzte, gespeicherte OParl-Name dieses exakten Vorgangs hat bereits dasselbe Satzzeichenende. Keine importbedingte Abschneidung dieses Felds nachgewiesen; keine Ergänzung. Ein Fehler der Originalquelle bleibt möglich. |
| `source_name_differs_review` | Andere Formulierung, fehlender amtlicher Titel oder fehlender Abrufzeitpunkt: manuell prüfen. |
| `conflicting_or_nonpublic_source` / `identity_conflict` / `column_identity_mismatch` | Widerspruch oder nicht eindeutige Zuordnung: kein Vorschlag. |
| `own_original_name_proves_continuation` | Der gespeicherte rohe OParl-Name des **exakt gleichen** `sourceUrl`/`fields.id` belegt eine eindeutige Fortsetzung. Nur ein Vorschlag für `officialTitle`, kein Schreibauftrag und keine Behauptung über den verantwortlichen Parser. |

Ein Vorschlag setzt das bekannte Herkunftsformat, OParl, einen Abrufzeitpunkt, einen bestehenden amtlichen Titel, eine eindeutige Fortsetzung und widerspruchsfreie eigene `paper`-/öffentliche `agenda`-Originalfelder voraus. Fremde oder nur verknüpfte IDs, gelöschte/nichtöffentliche Felder und konkurrierende Originalnamen sperren ihn. Er enthält Feld, alten/neuen Wert, exakten Belegpfad, Rohwert und SHA-256 von Originaldatensatz und gespeichertem Payload. KI-Titel, Zusammenfassungen und sonstige Felder bleiben außerhalb des Vorschlags. Wenn die vollständige Fassung bereits gespeichert ist, entsteht kein weiterer Vorschlag.

Für historische SessionNet-Karten lässt sich aus einem schon abgeschnittenen, gespeicherten `agenda.fields.title` keine verlorene Zeile zurückgewinnen. Der Import archiviert kein vollständiges HTML. Ohne separat vorhandenen Originalbeleg gibt es deshalb für diese Altzeilen keinen sicheren Reparaturvorschlag. Ein späterer Live-Abruf kann einen inzwischen geänderten Titel liefern und beweist nicht allein die historische Fassung.

## Prüfungen und noch erforderlicher Abschluss

```bash
node --test tests/report-titles.test.mjs tests/quality-check.test.mjs tests/regions.test.mjs tests/sessionnet-layouts.test.mjs tests/meeting-marks.test.mjs tests/topic-identity.test.mjs tests/identity-repository.test.mjs
```

Die Regressionen prüfen Umbrüche (`br`, HTML-Attribute, Großschreibung, CRLF, Leerzeilen), legitime Satzzeichenenden, Vorsitz-Zusätze, unveränderte IDs und Sitzungsbezüge, erhaltene Analysen bei einem normalen Import, alte Lesemarken, widersprüchliche/fehlende Quellenbelege und mehr als 20 Treffer. Beim Dry-Run bleiben SQLite-Datei, Vorgänge, Versionen, Analysen, Suchkarten und Revisionen unverändert; `--apply` wird abgewiesen.

Ergebnis auf der untersuchten Basis: **50 Tests bestanden** (Node 24.19.0; der Repository-Test verwendet TypeScript 5.9.3 aus den bestehenden Entwicklungsabhängigkeiten). Ein direkter Vergleich mit dem unveränderten Basis-Parser bestätigt die Abschneidung und die unveränderte Vorgangs-ID. Der versionierte Audit wurde erneut aus den Eingabedateien erzeugt und bytegleich geprüft. Kein vollständiger Frontend-Build durchgeführt.

Vor Review-Abschluss: den fehlenden Dev-Stand mit diesem Audit lesen, Gruppen und sämtliche belegbaren Abweichungen anhand gespeicherter Originaldaten prüfen, echte betroffene Quellenbeispiele ergänzen und erst daraus weitere Parserkorrekturen ableiten. Ein späterer Schreibpfad benötigt separat geprüfte Belege, Payload-Vergleich gegen gleichzeitige Änderungen, atomare Versionssicherung, ausschließlich gezielte Titeländerungen, Erhalt aller Beziehungen und Analysen sowie explizite Behandlung veralteter Analysegrundlagen. Dieser PR setzt keinen solchen Schreibpfad voraus und führt ihn nicht aus.
