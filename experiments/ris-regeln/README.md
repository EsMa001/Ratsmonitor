# Experiment: Regeln für Zusammenfassungen und Kategorien aus RIS-Dokumenten

Stand: 09.10.2026. **Nicht eingebunden:** Kein Import, keine API und keine Oberfläche ruft diesen Code auf. Er läuft nur von Hand auf der Kommandozeile und liegt auf dem Branch `experiment/ris-regeln`, nicht auf `main`. Umgesetzt wird davon nichts, ohne dass der Inhaber es ausdrücklich bestätigt.

## Idee

Viele Vorgänge haben Dokumenttext, aber nur den automatischen Quellenüberblick („Die Details stehen in den verlinkten Originalunterlagen“). KI-Zusammenfassungen kosten pro Dokument. Dieses Experiment prüft, wie weit man **ohne KI** mit festen Regeln kommt: wenige Originalsätze auswählen (nichts neu formulieren, nichts erfinden) und später ggf. die Kategorie aus dem Volltext bestimmen.

## Inhalt

| Datei | Was |
|---|---|
| `ris_regeln.py` | Allgemeine Regeln, ohne Kenntnis des einzelnen Dokuments. Liefert bis zu fünf Originalsätze. |
| `vorversuche/01_fakten_und_begriffe.py` | Beträge, Prozente, Daten, Aktenzeichen, Schlüsselbegriffe (tf-idf) und Auswahlsätze. |
| `vorversuche/02_kategorie_bildung_muster.py` | Muster für „Bildung & Familie“ (Einrichtung, Größe, Träger, Zeitraum, Recht, Verfahren) und deren Trefferquote. |
| `vorversuche/03_kategorie_naive_bayes_schwach.py` | Schneller Test, die Kategorie per Wortstatistik zu raten. Schwach (31 von 128 stimmen mit der bisherigen Einordnung überein), nur zur Doku. |
| `vorversuche/04_regeln_nur_fuer_ein_dokument.py` | Vier Regeln, von Hand für eine einzelne Änderungsvereinbarung geschrieben. Zeigt, wie speziell Regeln werden können. |

Aufruf von `ris_regeln.py` (nur Python 3, keine Zusatzpakete):

```
pdftotext -layout dokument.pdf dokument.txt
python3 experiments/ris-regeln/ris_regeln.py dokument.txt
python3 experiments/ris-regeln/ris_regeln.py data/topics.json                 # zufällige Münster-Vorlage
python3 experiments/ris-regeln/ris_regeln.py data/topics.json --id papers-vo-2004056483
python3 experiments/ris-regeln/ris_regeln.py data/topics.json --titel "Satzung zur Änderung"
```

## Die allgemeinen Regeln

Vorbereitung: wiederkehrende Kopf- und Fußzeilen und „Seite x von y“ entfernen, Silbentrennung am Zeilenende zusammenfügen, kurze Überschriften und Aufzählungsnummern („1.“, „2.“) als harte Satzgrenze behandeln, Ordnungszahlen („72. Änderung“) und Abkürzungen (Abs., Nr., Co., Mio. …) nicht als Satzende lesen.

1. **Typ:** Wörter wie Entwurf, Beschlussvorlage, Satzung, Vereinbarung in den ersten 25 Zeilen.
2. **Beschluss:** die ersten zwei Sätze nach „Beschlussvorschlag/-empfehlung/-entwurf“, sonst Sätze wie „Der Rat beschließt …“.
3. **Anlass:** der erste Satz in der ersten Dokumenthälfte mit „Aufgrund“, „Ziel ist“, „erforderlich“, „daher“, „deshalb“ u. ä.
4. **Kern:** die zwei Sätze mit Entscheidungsverb (soll/wird … errichtet, beauftragt, genehmigt …) und der höchsten Dichte an Zahlen und Eigennamen.
5. **Zahlen:** ein Satz mit Betrag oder Prozent und einem Vergleichswort („Vorjahr“, „Kosten“).
6. **Fristen:** ein Satz mit „tritt … in Kraft“, „bedarf der Genehmigung“, „spätestens“, „Frist“.

Auswahl: bis zu fünf Sätze in der Reihenfolge Beschluss, Anlass, Kern, Zahlen, Fristen; Sätze zwischen 50 und 420 Zeichen.

## Was getestet wurde (ohne Anpassung der Regeln an die Dokumente)

Sechs Dokumente: eine Änderungsvereinbarung (PDF, Anlage zur Vorlage Wertstoffhof Coesfeld) und fünf Münsteraner Vorlagen.

- Gut: Vorlagen mit klarem Beschlussvorschlag (Schulzentrum Hiltrup, Benennungsrechtssatzung, Förderprogramm altersgerechtes Wohnen, 72. FNP-Änderung). Beschluss, Kosten, Vorgeschichte und Aktenzeichen werden gefunden; bei Hiltrup ergeben die drei Teilbeträge genau die genannte Gesamtsumme.
- Mittel: die Änderungsvereinbarung ohne Beschlussvorschlag. Vier von fünf möglichen Sätzen, einer davon ist nur ein Einleitungssatz.

Kein Goldstandard, keine gemessene Trefferquote. Die bisherigen Kategorien stammen selbst aus Titelregeln und taugen nicht als Wahrheit.

## Bekannte Schwächen und offene Punkte

- Abkürzung „gem.“ fehlt in der Liste und beendet Sätze zu früh (weitere Abkürzungen prüfen).
- Aufzählungsnummer „1.“ bleibt manchmal am Satzanfang stehen.
- Einleitungssätze („… wird wie folgt geändert:“) werden als „Kern“ gewertet, weil sie Verb und Datum enthalten.
- Anlass-Regel kann einen Argument-Satz wählen, der dem Ergebnis widerspricht (z. B. Begründung *für* ein Programm, das abgelehnt wird).
- Tabellen gehen beim Textlesen verloren, das „Warum“ steht oft nur im Fließtext.
- Je Dokumenttyp (Vorlage, Vertrag, Jahresabschluss, Niederschrift, Bebauungsplan) bräuchte es eigene Regeln.
- Bei Vorlagen mit Anlagen oder Vereinbarungen fehlt der Zusammenhang, wenn nur die Anlage vorliegt.
- Kategorie aus dem Volltext: Der erste Versuch mit reiner Wortstatistik war schwach. Besser wären feste Fachbegriffe je Kategorie, gesucht in Titel, Betrifft-Zeile und Beschlussvorschlag, und bei Unklarheit „noch nicht eingeordnet“.

## Mögliche nächste Schritte (nur Ideen, nach Bestätigung)

1. Stichprobe von 30 bis 50 Vorgängen, je Dokumenttyp, von Hand prüfen und daran die Trefferquote messen.
2. Abkürzungsliste, Aufzählungsnummern und Einleitungssätze verbessern.
3. Schablonen je Dokumenttyp ergänzen.
4. Prüfen, ob das Ergebnis als Steckbrief (Feld für Feld, jede Angabe mit Beleg) in `shortSummary`/`longSummary` passt, und wie es als „automatischer Auszug“ gekennzeichnet wird.
5. Kategorie aus dem Volltext mit Regeln testen (siehe oben).
