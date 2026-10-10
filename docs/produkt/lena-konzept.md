# Lena: regelbasierte Assistentin (Konzept, ohne KI-Schnittstelle)

Stand: 10.10.2026. Entwurf zur Entscheidung, noch nichts umgesetzt.

## Ziel

Lena beantwortet einfache Fragen zu Vorgängen, Beschlüssen, Gebieten und zur Bedienung von Plenara. Sie antwortet **nur mit dem, was in den Daten steht**, jede Angabe mit Originalquelle (Vorteil 5, Stufe A). Kein Sprachmodell, keine externe Schnittstelle. Sie wird so gebaut, dass später ein Modell hinter derselben Schnittstelle ergänzt werden kann.

Passende Vorteile: Ein Portal statt vieler Systeme (1), Früher erfahren (2), Alarme statt Suchen (3), Ganz Deutschland mit einem Begriff (4), Originalquelle (5), Stand auf einen Blick (6).

## Was Lena kann (Version 1)

| Absicht | Beispielfrage | Antwort |
|---|---|---|
| Suche | „Was gibt es zu Photovoltaik in Billerbeck?“ | Die ersten Treffer der bestehenden Suche (Titel, Datum, Gremium, Status, Link), „alle anzeigen“ öffnet die Suche mit gesetzten Filtern |
| Stand | „Wurde der Bebauungsplan Nr. 12 beschlossen?“ | Status und Verlauf des besten Treffers, sonst Liste zur Auswahl |
| Entwicklung | „Wie entwickelt sich Wärmeplanung?“ | Satz aus der Trendanalyse, Link zu Trends und Ausbreitung mit gesetztem Begriff |
| Vergleich | „Vergleiche Köln und Dortmund“ | Link zum Gebietsvergleich, Kernsatz aus der Analyse |
| Alarm | „Sag mir Bescheid bei Windkraft in Coesfeld“ | Öffnet „Suche speichern“ mit Begriff und Gebiet vorbelegt |
| Abdeckung | „Ist Wesel dabei?“ | Aus der Datenabdeckung: dabei ja/nein, Anzahl, Stand |
| Hilfe | „Was bedeutet Vertagung?“, „Was kostet Pro?“ | Aus Glossar und FAQ, feste Texte |

Alle Antworten sind **Vorlagen mit eingesetzten Werten**. Lena formuliert nichts frei und rät nicht.

## Wie sie versteht (Regeln)

1. **Absicht:** Schlüsselwörter und Muster je Absicht („beschlossen“, „vergleich“, „sag mir bescheid“, „ist … dabei“), mit Gewichten. Erreicht keine Absicht eine Mindestzahl, kommt die Rückfrage.
2. **Ort:** Namensliste der Gebiete (aus dem Gebietskatalog) mit Schreibvarianten und Ortsteilen („Köln-Esch“ → Köln).
3. **Zeit:** „letzte 30 Tage“, „diese Woche“, „2026“, „seit Juli“.
4. **Status:** „beschlossen“, „vertagt“, „abgelehnt“, „in Beratung“ (die Statuswörter der App).
5. **Thema:** Rest der Frage ohne Füllwörter, dazu die Sachgebiets-Wörter der Regel-Labels als Synonyme (Wortliste aus `shared/labels.mjs`).
6. **Rückfrage statt Raten:** Fehlt der Ort bei einer Ortsfrage, fragt Lena mit Auswahlknöpfen („Welches Gebiet?“). Mehr als eine Rückfrage je Frage gibt es nicht.

## Was sie nicht tut

- Keine freie Zusammenfassung mehrerer Dokumente, keine Bewertung, keine Prognose.
- Keine rechtliche, finanzielle oder politische Beratung.
- Keine Antwort ohne Fundstelle. Bei null Treffern sagt sie das, nennt die Abdeckung des Gebiets und bietet einen Alarm an.
- Kein Merken von Fragen über die Sitzung hinaus, keine personenbezogenen Daten im Verlauf (offen: Entscheidung zu Protokollierung, `re-dsgvo`).

## Ton und Aussehen

- Anrede „Sie“, kurz, sachlich, ohne Superlative und Vergleiche mit anderen Anbietern (Regel der Produktvorteile).
- Bei jeder Antwort: Quelle, Stand der Daten, ein Schritt weiter („in der Suche öffnen“, „als Alarm speichern“).
- Ort in der Oberfläche: eigenes Eingabefeld unter der Suche oder Blase unten rechts (offen). Namen und Gesicht: offen.

## Einbau (Dateien, grob)

- `shared/lena/` Absichten, Muster, Glossar, Vorlagen (reine Funktionen, testbar).
- `server/integrations/lena.mjs`: `answer(frage, kontext)` ruft nur bestehende Funktionen (`monitor-search`, Analysen, Abdeckung).
- `app/api/lena/route.ts`: POST, begrenzt je Tarif und Anfragen pro Minute (`LIMITS` in `lib/tier.ts`).
- `components/ratsmonitor/…/Lena.tsx`: Oberfläche. Vor der Umsetzung `components/ratsmonitor/FRONTEND.md` lesen.
- Schnittstelle später für ein Modell: `answer(frage, treffer) → {text, quellen[]}`. Heute die Vorlage, später ein Modell, das nur die gefundenen Treffer sieht.

## Messung (vor dem Einbau)

1. 100 echte Fragen von Hand sammeln (Kollegen, Pilotkunden, Suchprotokoll falls erlaubt), je mit erwarteter Absicht, Ort, Zeit, Thema.
2. `scripts/lena/measure.mjs` (analog `scripts/label-study/measure-rules.mjs`): Absicht richtig, Ort richtig, Antwort mit Quelle, Rückfrage sinnvoll.
3. Ziel für Version 1 (Vorschlag, noch nicht festgelegt): Absicht ≥ 85 %, Ort ≥ 90 %, keine Antwort ohne Quelle (0 Ausnahmen).
4. Nach jeder Regeländerung neu messen. Ein Teil der Fragen bleibt unberührt für die Endmessung, wie bei den Labels.

## Phasen

1. **Fundstellen-Antwort** (Suche, Stand, Abdeckung, Hilfe): geringster Aufwand, größter Nutzen.
2. **Analysen-Sätze und Deep-Links** (Entwicklung, Vergleich), Alarm vorbelegen.
3. **Messung und Nachschärfen** mit echten Fragen.
4. **Optional:** Dokumenttext (Betreff, Beschlussvorschlag) für extraktive Antworten, sobald gespeichert und rechtlich geklärt. Danach erst ein Modell.

## Offene Entscheidungen

1. Name, Bild und Ort in der Oberfläche.
2. Welche Tarife nutzen Lena, mit welchem Limit.
3. Protokollierung der Fragen (Qualität gegen Datenschutz).
4. Rechtliche Hinweise zur Antwort („keine Rechtsberatung, maßgeblich sind die Originalunterlagen“) und Text.
5. Ob und wann Dokumenttext gespeichert wird (`be-quellen`, `re-itrecht`).
