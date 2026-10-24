# Nichtöffentliche Tagesordnungspunkte (Plan 24.10.2026; umgesetzt 24.10.2026, siehe „Zwei Regeln“ am Ende)

## Ziel

Öffentliche Informationen über nichtöffentliche Punkte gehören zu Plenara: Titel, Sitzung und Gremium stehen in Einladungen und
Tagesordnungen, die die Kommune selbst veröffentlicht. Sie sollen als Bericht erscheinen. Nichtöffentliche Inhalte (Vorlagen,
Beratung) haben wir nicht und lesen wir nicht. Nichts darf versehentlich als öffentlich erscheinen, was die Quelle als nichtöffentlich
führt.

## Entscheidungen des Projektinhabers (23./24.10.2026)

- Nichtöffentliche Punkte werden übernommen, mit dem Vermerk „nichtöffentlich beraten“.
- Keine auffällige Hervorhebung: Der Vermerk steht im automatischen Überblick des Berichts (`shared/model/overview.mjs`,
  `payload.overview`), zum Beispiel „Der Punkt wurde in nichtöffentlicher Sitzung beraten; öffentlich bekannt sind Titel, Sitzung
  und Gremium.“
- Keine Zusammenfassung, keine Fakten, keine KI-Aufbereitung für solche Punkte.
- Dokumente mit öffentlichem und nichtöffentlichem Teil werden nie wegen „nichtöffentlich“ verworfen (seit `e707ce59` umgesetzt:
  Teil vor der Überschrift des nichtöffentlichen Teils ist öffentlich; Dokument ohne jeden Hinweis wird übernommen).

## Schritte

1. **Datenfeld:** Bericht erhält `payload.publicity` = `'nonpublic'` (sonst fehlt das Feld). Gesetzt nur, wo die Quelle den Punkt
   ausdrücklich dem nichtöffentlichen Teil zuordnet (Überschrift, Kennzeichen N/NÖ, `public:false`, Abschnitt nach „Nichtöffentlicher
   Teil“). „Unklar“ bleibt eine eigene Lage und wird nicht als nichtöffentlich übernommen.
2. **Webseiten-Leser** (`server/integrations/website-text.mjs`, `website.mjs`): Punkte im nichtöffentlichen Teil sammeln statt
   verwerfen (heute `endBlock`, `restricted`, `discard`), mit Kennzeichen. Nur Nummer und Titel, keine Folgezeilen des Punkts
   (dort stünde Inhalt). Die Sammlung früherer Lecks (`tests/fixtures/website/leaks/corpus.mjs`, `tests/website-leaks.test.mjs`)
   prüft dann: Punkt erscheint nur mit `publicity:'nonpublic'`, nie als öffentlicher Punkt, nie mit Inhalt.
3. **Weitere Leser**, einzeln: `server/integrations/public-agenda.mjs` (zählt heute `nonPublic`, verwirft sie; SessionNet, ALLRIS,
   SD.NET, OParl-regional), Münster-OParl (`oparl.mjs`, `public===true`). Nur wo die Quelle Titel nichtöffentlicher Punkte öffentlich
   zeigt; nie Seiten des Mitgliederbereichs oder nichtöffentliche Tagesordnungsseiten aufrufen.
4. **Verarbeitung:** `readReport` (`server/integrations/report-rules.mjs`): bei `publicity:'nonpublic'` keine Regel-Zusammenfassung,
   keine Fakten; das Modell ordnet Thema und Art aus dem Titel ein (das ist öffentlich). KI-Aufträge (`scripts/ai-local.mjs`) lassen
   solche Berichte aus. Überblick (`overview.mjs`) bekommt den Satz zum nichtöffentlichen Punkt; Fassung `OVERVIEW_VERSION` erhöhen.
5. **Oberfläche:** kein eigenes Abzeichen; der Satz im Überblick genügt. Die Suchkarte zeigt den Überblick ohnehin als Kurztext.
   Frontend-Regeln in `components/ratsmonitor/FRONTEND.md`, Farbschema „Petrol klar“.
6. **Zählungen:** plenara.X (`x_cases`), Signale, Social Media: nichtöffentliche Punkte zunächst nicht mitzählen (kein Inhalt,
   Formalie-ähnlich); Abdeckung und Suche zählen sie.

## Entschieden (24.10.2026)

- Personennamen in Titeln nichtöffentlicher Punkte („Personalangelegenheit Herr X“, „Grundstücksverkauf an Familie Müller“): Namen
  von Privatpersonen werden entfernt bzw. durch „…“ ersetzt, soweit sie sich erkennen lassen (Anrede + Name, „Familie …“, Vor- und
  Nachname). Nicht betroffen: Amtsträger in ihrer Funktion („Bürgermeister“), Firmen, Straßen, Orte.
- Ergebnis eines nichtöffentlichen Punkts, das später öffentlich bekannt gegeben wird („Bekanntgabe von Beschlüssen aus
  nichtöffentlicher Sitzung“): wird demselben Bericht zugeordnet, wenn Titel und Gremium passen (sonst eigener Hinweis an der
  Sitzung der Bekanntgabe).

## Zwei Regeln (Entscheidung des Projektinhabers, 24.10.2026, umgesetzt)

Die Öffentlichkeitsprüfung aller Leser ist auf zwei feste Regeln vereinfacht (`markPublicity`, `selfClosed`, `topicPublicity` in
`server/integrations/source-common.mjs`):

1. **Nicht abrufen, was sich selbst nichtöffentlich nennt:** Dokumente, deren Titel, Linktext oder Dateiname „nichtöffentlich“,
   „vertraulich“ oder „nur für Ratsmitglieder“ sagt (`SELF_CLOSED`; Bekanntgaben dort gefasster Beschlüsse sind öffentlich), und
   Seiten des Mitgliederbereichs oder der Anmeldung.
2. **Namen von Privatpersonen** fallen aus Titeln nichtöffentlicher Punkte (`withoutPrivateNames`).

Alles andere wird übernommen. Was ein Dokument über den nichtöffentlichen Teil sagt (Überschrift, „§ 35 GO“, Kennzeichen N, fehlendes
Kennzeichen Ö), markiert nur: `publicity` `nonpublic` oder `unclear` an Bericht, Ereignis und Feld des Datensatzes; „unklar“ wird wie
öffentlich angezeigt. Umgesetzt in SessionNet (alle drei Seitenarten und Bekanntmachung), SessionNet 6, ALLRIS 4, ALLRIS net, SD.NET,
SD.NET RIM 4, OParl (regional und Münster) und im Webseiten-Leser (dort schon zuvor). Vorlagenseiten und Dateien nichtöffentlicher
Punkte werden nicht abgefragt (sie sind für Gäste gesperrt und würden jede Sitzung unvollständig machen); unklare Punkte werden wie
öffentliche gelesen. `assumePublicAgenda` ändert nur noch das Kennzeichen (öffentlich statt unklar). Noch nicht umgestellt: die übrigen
Leser (ris-portal, councilservice, komfa, citystates, piwi, ti-generator u. a.).
