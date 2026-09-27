# Labelvergleich

Regel- und KI-Labels bleiben getrennt. Diese Studie verändert die produktiven Labels nicht. Der unveränderliche Korpus enthält kanonische Artikel aus dem versionierten Repository einschließlich historischer Nachladung. Neue produktive Daten benötigen einen neuen Studienstand.

## Ablauf

1. `node scripts/label-study/prepare.mjs tmp/label-study source` friert Texte, IDs, Hashes und Regelergebnisse ein. Ein vorhandener Korpus wird nicht überschrieben.
2. `OPENAI_API_KEY` und `OPENAI_LABEL_MODEL` sicher in der Ausführungsumgebung setzen. Das Backend besitzt derzeit keinen KI-API-Schlüssel. Der Runner erbt ein vorhandenes `OPENAI_MODEL`, wenn kein gesondertes Labelmodell gesetzt ist. Modellwahl und API-Abrechnung müssen im ausführenden Konto verfügbar sein.
3. `node scripts/label-study/run.mjs tmp/label-study --limit=100` verarbeitet zunächst 100 Artikel. Der Lauf sendet ausschließlich verfügbare Originaltexte und den Labelkatalog, ohne Regel- oder Referenzlabels. Es erfolgt keine Nachladung fehlender PDF-Volltexte und keine Erfindung von Dokumentinhalten.
4. `node scripts/label-study/run.mjs tmp/label-study --all` setzt bis zum vollständigen Korpus fort. Fertige identische Ergebnisse werden übersprungen. Fehler bleiben getrennt erhalten; `--retry-errors` erlaubt ihre erneute Verarbeitung. Bei Zugang-/Kontingentfehlern oder zehn Fehlern stoppt der Lauf. Tokens werden pro erfolgreicher Antwort protokolliert, Geheimnisse nicht. Ein Modellwechsel braucht eine eigene Studie.
5. `referenzstichprobe.csv` unabhängig prüfen: Originalquelle konsultieren, `referenz_label` aus `catalog.json`, Prüfer und Begründung eintragen. Erst nach Klärung von Zweifeln `status=adjudicated` setzen. Idealerweise prüfen zwei Personen unabhängig; Differenzen werden vor Freigabe geklärt. Nicht anhand der KI- oder Regelvorhersage entscheiden. Originaltexte in der CSV nicht als Tabellenformeln ausführen.
6. `python3 scripts/label-study/import-reference.py tmp/label-study` übernimmt die Freigaben in `references.json`. Ungeprüfte Artikel bleiben pending.
7. `node scripts/label-study/report.mjs tmp/label-study` erzeugt CSV, Kennzahlen und Bericht. Genauigkeit, Macro-F1 (über in der Referenz vertretene Klassen), Klassenmetriken und Verwechslungsmatrix beziehen sich auf dieselben referenzbewerteten Artikel mit KI-Ergebnis. Regeln werden ergänzend auf allen freigegebenen Referenzen ausgewertet. Abdeckung und Fehler bleiben getrennt sichtbar.

## Auswertung richtig lesen

Übereinstimmung zwischen KI und Regeln ist keine Genauigkeit. Ohne unabhängige Referenzen gibt es keinen Genauigkeitswert. Auch „unklar“ ist ein zulässiges Referenzlabel; eine fehlende KI-Antwort ist kein „unklar“. Die 300 Artikel werden vor dem KI-Lauf reproduzierbar mit SHA-256 ausgewählt. Das ist eine ungegewichtete Zufallsstichprobe des eingefrorenen Bestands. Seltene Labels und einzelne Gebiete können darin fehlen; ihre Genauigkeit ist dann nicht belegt. Für Detailaussagen braucht es zusätzliche Stichproben, deren Ergebnisse getrennt auszuweisen sind. Eine Stichprobe beweist nicht die Richtigkeit sämtlicher Artikel. Nicht dieselbe Referenzstichprobe zum Optimieren und zum abschließenden Gütenachweis verwenden.

Modus `source` vergleicht die bestehenden Titelregeln mit KI auf den verfügbaren Originaltexten. Er misst die Produktionsverfahren einschließlich unterschiedlicher Informationsbasis. Für einen kontrollierten Vergleich auf identischem Text `prepare.mjs tmp/label-study-title title` verwenden. Bereits vorhandene Dokumenttexte werden berücksichtigt; viele Artikel haben nur Titel und veröffentlichte Ergebnisfelder. Das Feld `hasDocumentText` und das Kürzungsmerkmal halten diese Grenze fest. Generierte Zusammenfassungen sind kein Eingangstext.

Die KI-Ergebnisse sind als Studienartefakt gespeichert, noch nicht als alternativ auswählbare Labelserie in der Website. Erst nach dem Vergleich wird über die produktive Übernahme entschieden.
