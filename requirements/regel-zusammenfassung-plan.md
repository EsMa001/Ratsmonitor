# Mehr Berichte mit Regel-Zusammenfassung (Plan, 21.10.2026)

Ziel: Bei möglichst vielen Berichten steht im Artikel etwas Vernünftiges: ein Auszug aus dem eigenen Dokument, sonst aus
der Sitzungsunterlage, sonst Eckdaten aus den Sitzungsdaten. Alles regelbasiert, ohne KI, nur aus gespeicherten Quellen.

## Ausgangslage (Server, `report_rules`, 21.10.2026)

Gründe ohne Zusammenfassung, nur Sachpunkte (`item_kind = subject`); Formalien, Sammelpunkte und Routine in Klammern:

| Grund | Sachpunkte | (übrige) | Bedeutung |
| --- | --- | --- | --- |
| mit Zusammenfassung | 228.110 | (29.408) | |
| `no-document` | 386.414 | (525.862) | kein PDF, nur HTML-Tagesordnung und Sitzungsdaten |
| `no-text` | 109.626 | (19.694) | PDF da, Text fehlt: Stichprobe 58 % nicht in der Ablage, 38 % Abruf gescheitert |
| `no-summary` | 79.115 | (47.575) | Text da, Regeln liefern nichts |
| `session-document` | 28.608 | (45.423) | Hauptdokument ist Einladung oder Niederschrift (oder an ≥ 5 Berichten) |
| `unreadable`, `too-long` | 3.106 | (6.320) | Scan ohne OCR, über 150 Seiten |

Stichprobe `no-summary` (800, Server): nicht die Güte unter 60 ist das Problem (unter 1 %), sondern die Regeln wählen
keinen Satz:
- 71 % „keine Gliederung“: weder Beschlusstext noch Sachverhalt-Abschnitt erkannt; die Langfassung bricht dann immer
  ab, die Kurzfassung nur mit sehr strengem Titeltreffer. Typen: Anfragen und Antworten („Text der Anfrage:“,
  „Die Fragen werden wie folgt beantwortet“), Auszüge aus der Niederschrift („Tagesordnungspunkt: … Bericht erstattet:“),
  Sitzungsvorlagen ohne Überschrift (Inhalt steht direkt nach dem Betreff), Mitteilungen mit „Kurzbegründung:“.
- 12 % kaum Sätze, 8 % als Niederschrift erkannt (oft ein Auszug für genau diesen Punkt), 8 % sonst.

Stichprobe `no-document` (1.500): 36 % der Sitzungen haben irgendein PDF an einem anderen Bericht, 9 % eine Niederschrift
mit diesem Namen.

## Vorgehen (Reihenfolge nach Hebel)

1. **Ungegliederte Dokumente** (`rule-summary.mjs`, Ziel ein großer Teil der 79k + 48k):
   - neue Abschnittsmarken: „Text der Anfrage“, „Anfrage“, „Antwort“, „Die Fragen werden wie folgt beantwortet“,
     „Kurzbegründung“, „Kurzzusammenfassung“, „Bericht erstattet“, „Mitteilung“;
   - ohne Marke: Text nach Kopf und Betreff (Kopfzeilen wie Drucksache, Beratungsfolge, Gremium, Datum abschneiden) als
     Sachverhalt behandeln, damit die Langfassung nicht mehr sofort abbricht;
   - Auszug aus der Niederschrift für genau diesen Punkt nicht mehr als Niederschrift verwerfen, sondern den Abschnitt
     des Tagesordnungspunkts nehmen; „Es liegen keine Anfragen vor“ als ehrliche Kurzfassung zulassen.
   - Güte und Mindestgüte 60 bleiben; neue Wege werden in der Güte nicht bevorzugt.
2. **Sitzungsunterlagen** (29k + 45k): aus Niederschrift oder Einladung den Abschnitt dieses Tagesordnungspunkts suchen
   (Nummer oder Titel), daraus die Zusammenfassung wie aus einem eigenen Dokument; Quelle im Artikel als Sitzungsunterlage
   benennen. Findet sich kein Abschnitt: weiter zu Schritt 3.
3. **Eckdaten ohne Dokument** (386k + Rest): eine eigene, kurz gekennzeichnete Fassung aus den Sitzungsdaten statt eines
   Platzhalters: Gremium, Sitzungstag, öffentlich, Beratungsweg über mehrere Sitzungen, Ergebnis (wenn belegt),
   Antragsteller aus dem Titel („Antrag der Fraktion X vom …“), Thema. Gibt es in derselben Sitzung eine Niederschrift
   in der Ablage, zuerst deren Abschnitt (wie Schritt 2). Diese Fassung heißt im Artikel nicht „Zusammenfassung“,
   sondern z. B. „Eckdaten“, und zählt in der Kennzahl getrennt.
4. **Formalien und Routine**: bekommen nichts Neues außer über Schritt 2 (z. B. Antworten unter „Anfragen“ aus der
   Niederschrift). Reine Formalien bleiben ohne Text.
5. **Fehlender Text** (`no-text`, 110k): keine Regelfrage, sondern Ablage. Prüfen, warum 58 % nie geladen wurden
   (Zeitraum, Budget, Server) und ob die gescheiterten Abrufe in die Nacharbeit gehören; nur Befund, Umbau getrennt.

## Stand Schritt 1 (21.10.2026, `sum4`)

Umgesetzt in `rule-summary.mjs`: neue Marken (Anfrage, Antwort, Kurzbegründung, Inhalt der Mitteilung, Sachtext …),
Text nach dem Betreff als Sachverhalt (`afterHeader`, auch wenn unter einer Marke kaum Text steht), Auszug aus der
Niederschrift für einen Punkt (`isExcerpt`) nicht mehr verworfen, gesperrte Schrift, „gez.“, Aufzählungsbuchstaben,
Zwischenüberschriften und Bezeichnungen vor dem Satz, Standardsätze der Vordrucke, Wiederholung des Titels, OCR-Reste.

Messung (Texte vom Server, Code lokal): Entwicklung 1.479, frisch 675 und 474 Berichte mit `no-summary`.
- Abdeckung: 46 bis 50 % bekommen jetzt eine Zusammenfassung (Sachpunkte 51 bis 57 %), hochgerechnet gut 55.000 Berichte.
- Qualität der neuen (frisch, 50 gelesen): 82 % brauchbar. Fehler: nur Titel, Bruchstück am Satzanfang („Aber …“),
  Formularrest, Tabellenzeile; nichts Erfundenes (nur Originalsätze). Entscheidung Nutzer 21.10.: so übernehmen.
- Bestehende (488): 98 Texte geändert, fast alle besser (Formularreste weg), 2 schlechter, 1 entfällt.

## Kennzahl

Kachel in „Themen & Texte“ aufteilen: aus eigenem Dokument, aus Sitzungsunterlage, Eckdaten, ohne; Nenner bleibt
erkennbar. Hinweistext berichtigen (der Rest sind nicht nur Sitzungsunterlagen).

## Messen (auf dem Server, nur lesend)

- Vorher/nachher je Grund an frischer Zufallsstichprobe: Anteil mit Zusammenfassung.
- Qualität je neuem Weg: 50 frische Fälle lesen und bewerten (passt zum Punkt, kein fremder TOP, keine falsche
  Aussage); Ziel ab 90 % brauchbar, sonst Weg nicht freigeben. Ehrliche Zahl in `shared/rule-quality.json`.
- Tests: neue Fälle in `tests/` für jede Marke und für Fehltreffer (fremder TOP, Kopfzeilen als Satz).

## Danach

`RULE_SUMMARY_VERSION` erhöhen, `read-reports.mjs --all` (Job „Alle neu erstellen“), Wortliste `--full`.
Ausrollen nur nach Zustimmung.
