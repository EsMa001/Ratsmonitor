# Sitzungsdaten für Gebiete ohne Ratsinformationssystem: Ideen und Quellen

Stand 04.10.2026. Grundlage: Auswertung der offenen Gebiete (Quellensuche vom 04.10.2026), README.md (Abschnitte „Bundesweiter Abruf“ und „robots.txt“), `scripts/source-discovery/README.md`, `requirements/de-sources-report.md` (Abschnitt „Nicht angebundene Gebiete“) und eine Websuche. Kommunale Websites waren aus der Arbeitsumgebung nicht abrufbar; Aussagen über einzelne Websites stammen aus Suchergebnissen und sind entsprechend gekennzeichnet. Was nicht belegt ist, steht als „Vermutung“ oder „nicht geprüft“.

## Kurzfassung

1.631 Gebiete mit 11,8 Mio. Einwohnern haben auf ihrer offiziellen Website keinen Link zu einem Ratsinformationssystem; überwiegend sind es kleine Gemeinden und Gemeindeverbände (darunter 19 Kreise), vor allem in Bayern (552), Baden-Württemberg (322), Hessen (208), Sachsen (155), Thüringen (127) und Brandenburg (99). Jede dieser Kommunen muss Zeit, Ort und Tagesordnung ihrer öffentlichen Sitzungen bekanntmachen; das ist in allen 13 Flächenländern gesetzlich geregelt (Tabelle unten). Immer mehr Länder lassen die Bekanntmachung im Internet als amtliche Form zu, sodass die Einladung mit Tagesordnung oft als HTML-Seite oder PDF auf der Website der Kommune steht. Der Leser `website` (v1) nutzt genau das: Bekanntmachungsseiten, Niederschriften, Amtsblatt-PDFs auf der eigenen Website und die maschinenlesbaren Ausgänge der verbreiteten CMS (RSS/Atom, iCal, WordPress-REST, JSON-LD, sitemap.xml). Verlagsplattformen für Amts- und Mitteilungsblätter, Gemeinde-Apps und Zeitungen liest er nicht; sie bieten keine belegte offene Schnittstelle, und ihr redaktioneller Teil ist geschützt. Thüringen ist ein Sonderfall: Dort sind auch die Beschlüsse öffentlicher Sitzungen ortsüblich bekanntzumachen (§ 40 Abs. 2 ThürKO), die Website kann also Beschlussstände liefern. Ergebnisse dieses Lesers sind weniger vollständig als die eines RIS (keine Vorlagentexte, selten Abstimmungsdetails) und müssen im Produkt so gekennzeichnet sein.

## Datenquellen

Abdeckung = geschätzter Anteil der 1.631 Gebiete ohne Link, bei denen die Quelle Sitzungsdaten liefert. Die Werte sind begründete Schätzungen, nicht gemessen; die erste Messung liefert der Leser selbst.

| Quelle | Was sie liefert | Abdeckung (geschätzt) | Recht / robots | Status |
|---|---|---|---|---|
| Bekanntmachungs- oder Amtstafelseite der Website (HTML, verlinkte PDF) | Einladung: Gremium, Zeit, Ort, Tagesordnung öffentlicher Teil | hoch, wo die Hauptsatzung die Internetform vorsieht; sonst nur als Zweitveröffentlichung | amtliche Bekanntmachung, § 5 Abs. 1 UrhG; robots.txt je Origin | im Leser v1 |
| Seiten „Sitzungen“, „Gemeinderat“, „Sitzungsberichte“ | Termine, teils Kurzberichte und Beschlussübersichten | mittel | Bericht der Verwaltung, nur öffentlicher Teil | im Leser v1 |
| Niederschriften öffentlicher Sitzungen auf der Website | Beschlüsse, teils Abstimmungsergebnisse | gering bis mittel; in Thüringen höher (Beschlussbekanntmachung Pflicht) | Einsichtsrecht besteht (z. B. § 38 GemO BW, Art. 54 GO BY), Veröffentlichung im Netz aber freiwillig | im Leser v1 |
| Amts- oder Mitteilungsblatt als PDF auf der eigenen Website | Sitzungsbekanntmachungen im amtlichen Teil | mittel (BW, BY, TH, ST: viele Gemeinden stellen das Blatt selbst ein; Vermutung nach Suchtreffern) | amtlicher Teil § 5 UrhG; redaktioneller Teil und Anzeigen geschützt | im Leser v1, nur Bekanntmachungen |
| RSS/Atom des CMS | neue Bekanntmachungen und Meldungen mit Datum | mittel | wie Website | im Leser v1 |
| iCal-Kalender | Termine mit Ort | gering bis mittel | wie Website | im Leser v1 |
| WordPress-REST (`/wp-json/wp/v2/posts`, `/wp/v2/media`) | Beiträge, PDF-Anhänge mit Datum | gering (kleine Gemeinden, Vereinsbaukästen) | wie Website | im Leser v1 |
| schema.org-Event (JSON-LD) | Termine mit Ort | gering | wie Website | im Leser v1 |
| sitemap.xml | Adressen mit `lastmod`, findet Bekanntmachungen ohne Navigation | hoch als Wegweiser, liefert selbst keine Daten | wie Website | im Leser v1 (nur Entdeckung) |
| Amtsblatt der Verwaltungsgemeinschaft, des Amtes oder der Verbandsgemeinde | Bekanntmachungen aller Mitgliedsgemeinden | hoch für 360 VG, 146 Ämter, 48 VGem im offenen Bestand | in BY gilt das VG-Amtsblatt als Amtsblatt der Gemeinde (Art. 26 Abs. 2 GO) | später (Zuordnung zu Mitgliedern) |
| Hauptsatzung / Bekanntmachungssatzung | nennt die amtliche Internetadresse der Bekanntmachungen | hoch als Wegweiser | NRW: Adresse in der Hauptsatzung Pflicht (BekanntmVO); NI: § 11 NKomVG | später (Quellensuche) |
| Verlagsplattformen (lokalmatador, wittich.de, myeblaettle.de) | ePaper der Amtsblätter | hoch in BW, mittel in RP, TH, ST, BB (Vermutung) | redaktioneller Teil geschützt, teils Anmeldung (NussbaumID); robots nicht geprüft | nicht verfolgen ohne Vereinbarung |
| OParl-Verzeichnis (`dev.oparl.org/api/endpoints`) | RIS-Schnittstellen | bereits ausgewertet (`oparl-register.mjs`) | offen | bereits genutzt |
| GovData und Länderportale | einzelne RIS-Exporte (Bielefeld, Karlsruhe, Moers) | nahe null für Gebiete ohne RIS | offene Lizenz | nicht verfolgen |
| BayernPortal / PVOG | Leistungsbeschreibung „Bürger- und Ratsinformationen online“, Behördendaten | Wegweiser, keine Sitzungsdaten | PVOG nur mit OAuth2-Registrierung | später prüfen (nur Linkfund) |
| Sitzungskalender des Landkreises | Sitzungen der Kreisgremien | keine Gemeindedaten | — | später (Abgleich, siehe unten) |
| Tageszeitungen | Vorberichte und Berichte | hoch | Presseverlegerrecht (§§ 87f ff. UrhG, nicht im Einzelnen geprüft) | nicht verfolgen; höchstens Hinweis |
| Livestream-Kanäle | Sitzungstermin | gering | Bild- und Tonaufnahmen nicht übernehmen | später, nur Termin-Hinweis |
| Gemeinde-Apps (Heimat-Info, DorfFunk/DorfNews, NOLIS CityApp) | Meldungen, Amtsblatt-Hinweise | mittel (Vermutung) | keine offene Schnittstelle belegt | nicht verfolgen |
| Rückkanal „Ihre Kommune fehlt?“ | von der Kommune genannte Adresse oder Feed | wächst mit Bekanntheit | Einwilligung der Kommune | später |

## Rechtsrahmen je Land

Alle Länder verlangen, dass Zeit, Ort und Tagesordnung öffentlicher Sitzungen der Vertretung bekanntgemacht werden. Die Form („ortsüblich“, „öffentlich“) regelt die Hauptsatzung im Rahmen der Bekanntmachungsvorschriften des Landes. Absätze sind nur angegeben, wo eine Quelle sie nennt.

| Land | Fundstelle Sitzungsbekanntmachung | Weitere Pflichten zu Beschlüssen und Niederschriften | Internet als amtliche Form | Wo es typischerweise steht |
|---|---|---|---|---|
| Bayern | Art. 52 Abs. 1 GO: spätestens am dritten Tag vor der Sitzung ortsüblich, mit Tagesordnung | Art. 52 Abs. 3: nichtöffentliche Beschlüsse bekanntgeben, sobald Geheimhaltungsgründe weggefallen; Art. 54 Abs. 3: Einsicht der Gemeindebürger in Niederschriften öffentlicher Sitzungen | Art. 26 Abs. 2 GO mit BekV; seit 2023 rein digitale Bekanntmachung möglich | Amtstafel, Amtsblatt der Gemeinde oder VG, Website „Bekanntmachungen“ |
| Baden-Württemberg | § 34 Abs. 1 GemO: rechtzeitig ortsüblich | § 35 Abs. 1: nichtöffentliche Beschlüsse im Wortlaut bekanntgeben; § 38 Abs. 2: Einsicht der Einwohner in Niederschriften öffentlicher Sitzungen | § 1 DVO GemO, Bekanntmachungssatzung mit Internetadresse | Mitteilungsblatt (meist Verlag), Website |
| Hessen | § 58 Abs. 6 HGO: vor der Sitzung öffentlich | nicht geprüft | § 7 HGO: Zeitung, Amtsblatt oder Internet; Einzelheiten HKBekV | Website „Öffentliche Bekanntmachungen“, Zeitung |
| Thüringen | § 35 ThürKO: mindestens vier Tage vorher ortsüblich, bei Dringlichkeit zwei | § 40 Abs. 2: Beschlüsse öffentlicher Sitzungen alsbald ortsüblich bekanntmachen, nichtöffentliche nach Wegfall der Gründe | Formen in Drucksache 7/5553 des Landtags beschrieben (Inhalt nicht im Einzelnen geprüft) | Amtsblatt der Gemeinde oder VG, Website |
| Sachsen | § 36 Abs. 4 SächsGemO: rechtzeitig ortsüblich (nicht im Eilfall) | § 37: nichtöffentliche Beschlüsse in öffentlicher Sitzung bekanntgeben; § 40 Abs. 2: Einsicht in Niederschriften öffentlicher Sitzungen | nicht geprüft | Amtsblatt, Website |
| Brandenburg | § 36 BbgKVerf: öffentlich nach Hauptsatzung, Frist in der Hauptsatzung | § 36: Einsicht in Beschlussvorlagen öffentlicher Punkte | Hauptsatzung (Muster des Städte- und Gemeindebunds) | Amtsblatt des Amtes, Website |
| Rheinland-Pfalz | § 34 Abs. 6 GemO: öffentlich | nicht geprüft | § 27 GemO, §§ 7–10 GemODVO, Hauptsatzung | Amtsblatt der Verbandsgemeinde (Verlag), Website |
| Saarland | § 41 Abs. 3 KSVG: öffentlich, mindestens drei Tage, im Eilfall ein Tag | nicht geprüft | nicht geprüft | Website, Wochenblatt |
| Mecklenburg-Vorpommern | § 29 Abs. 6 KV M-V: rechtzeitig öffentlich | nicht geprüft | nicht geprüft | Amtsblatt oder Website des Amtes |
| Schleswig-Holstein | § 34 GO: unverzüglich örtlich bekanntmachen (Absatz nicht geprüft) | nicht geprüft | Hauptsatzung (Ortsrecht im Zuständigkeitsfinder zufish.schleswig-holstein.de) | Website des Amtes, Aushang |
| Sachsen-Anhalt | § 53 KVG LSA: rechtzeitig ortsüblich (Absatz nicht geprüft; eine Quelle nennt § 52 Abs. 4) | nicht geprüft | nicht geprüft | Amtsblatt der Verbandsgemeinde, Website |
| Niedersachsen | § 59 NKomVG: ortsüblich, außer bei nichtöffentlicher Sitzung (Absatz nicht geprüft) | nicht geprüft | § 11 NKomVG: elektronisches Verkündungsblatt, Adresse in der Hauptsatzung | Website, gemeinsames Amtsblatt |
| Nordrhein-Westfalen | § 48 Abs. 1 GO NRW: Bürgermeister macht öffentlich bekannt | nicht geprüft | BekanntmVO §§ 4, 6: Bereitstellung im Internet, Adresse in der Hauptsatzung | Website „Amtsblatt / Bekanntmachungen“ |

Folgerungen für den Leser: Die Einladung enthält nur Titel der öffentlichen Punkte; nichtöffentliche Punkte stehen höchstens als Überschrift oder als „N“-Punkte darin und werden verworfen. Thüringen liefert zusätzlich Beschlüsse, BW, BY und SN liefern nachträglich bekanntgegebene nichtöffentliche Beschlüsse in der nächsten öffentlichen Sitzung oder Niederschrift; diese übernimmt der Leser nur, wenn sie im öffentlichen Teil eines Dokuments stehen.

## CMS und ihre Ausgänge

| CMS | Verbreitung (Herstellerangabe) | Belegte maschinenlesbare Ausgänge | Typische Pfade |
|---|---|---|---|
| iKISS (Advantic) | 457 Kunden, 985 Auftritte; jeder vierte Landkreis | Module Bekanntmachungen und Veranstaltungen; Inhalte als RSS abonnierbar (Advantic, Basisumfang; RSS-Seiten z. B. Celle, Scharbeutz) | RSS-Übersichtsseite der Kommune; iCal nicht geprüft |
| NOLIS | mehr als 300 Kommunen | CityApp übernimmt Inhalte aus dem CMS (interne Schnittstelle, nicht offen belegt) | `/portal/seiten/…-<id>.html`, `/portal/meldungen/…`; RSS nicht geprüft |
| Weblication | über 10.000 Kunden insgesamt, CityWeb für Kommunen | nicht geprüft | nicht geprüft |
| webEdition | einzelne Städte (Korschenbroich) | RSS für Bekanntmachungen (`/rss_feed/bekanntmachungen.php`) | wie Beispiel |
| TYPO3 mit EXT:news | verbreitet (nicht beziffert) | RSS über `?type=9818` oder umgeschriebene Adresse; iCalendar-Ausgabe dokumentiert | `/feed.rss`, `?type=9818` |
| TYPO3 mit calendarize | nicht beziffert | ICS-Import dokumentiert; Export nicht geprüft | nicht geprüft |
| Government Site Builder 11 | Bund, Länder, Kommunen möglich; auf TYPO3 | Erweiterung `gsb-rss`: RSS aus gefilterten Suchlisten | nicht geprüft |
| Contao | nicht beziffert | Nachrichten und Kalender als RSS/Atom/JSON in `share/*.xml`; iCal über Erweiterung | `/share/<name>.xml` |
| Joomla | nicht beziffert | RSS je Kategorie mit `?format=feed&type=rss` | Kategorieseite + Parameter |
| WordPress | kleine Gemeinden (Vermutung) | REST `/wp-json/wp/v2/posts`, `/wp-json/wp/v2/media?mime_type=application/pdf`; The Events Calendar: `/wp-json/tribe/events/v1/events`, `?ical=1` | `/wp-json/` |
| komuna-Website, AKDB, Komm.ONE, rathaus.io, add.min, GEM2GO | nicht beziffert | nicht geprüft | nicht geprüft |

Der Leser sollte CMS nicht raten, sondern Ausgänge erkennen: `<link rel="alternate" type="application/rss+xml">` und `text/calendar` im Kopf der Startseite und der Bekanntmachungsseite, `/wp-json/` nur, wenn die Seite selbst darauf verweist (`<link rel="https://api.w.org/">`), JSON-LD in der Seite, sitemap.xml aus robots.txt (`Sitemap:`). Geratene Pfade kosten Anfragen und können robots.txt-Regeln berühren; ein Versuch je bekanntem Pfad ist vertretbar, mehr nicht.

## Amts- und Mitteilungsblätter

- **NUSSBAUM Medien** (BW): 340 Amtsblätter und 40 Lokalzeitungen, ePaper über lokalmatador; Konto „NussbaumID“ für die Plattformen. Keine offene Schnittstelle gefunden.
- **LINUS WITTICH**: über 1.000 Titel; online als ePaper/PDF, als Einzelartikel in einer Datenbank-Ausgabe, in der Web-App „meinOrt“, Archiv 24 Monate. Die artikelweise Ausgabe wäre technisch ideal; eine offene Schnittstelle oder ein Feed ist nicht belegt.
- **Primo** (Stockach): über 165 Städte und Gemeinden, Archiv auf myeblaettle.de.
- **Heimat-Info** (Cosmema WITTICH): App mit Meldungen, Veranstaltungen und Bekanntmachungen; keine offene Schnittstelle belegt.

Rechtslage: Bekanntmachungen im amtlichen Teil sind amtliche Werke nach § 5 Abs. 1 UrhG und gemeinfrei; der redaktionelle Teil (Vereinsberichte, Kirchennachrichten) und Anzeigen sind geschützt. Die Gestaltung des ePapers und die Datenbank des Verlags können eigene Rechte tragen (nicht geprüft). Vorschlag: Der Leser liest ein Amts- oder Mitteilungsblatt nur, wenn die Kommune es als PDF auf ihrer eigenen Website bereitstellt. Er sucht darin nur Abschnitte, die als Sitzungsbekanntmachung erkennbar sind („Einladung zur öffentlichen Sitzung des Gemeinderats …“), übernimmt nur Gremium, Termin, Ort und öffentliche Punkte und speichert weder den übrigen Text noch die Datei. Verlagsplattformen nur nach schriftlicher Vereinbarung mit dem Verlag, etwa über einen Feed der amtlichen Rubrik; robots.txt der Verlage vorher prüfen (aus dieser Umgebung nicht möglich).

## Weitere Ideen mit Bewertung

**Hauptsatzung als Wegweiser.** NRW und Niedersachsen verlangen die Internetadresse der Bekanntmachungen in der Hauptsatzung, BW in der Bekanntmachungssatzung. Die Quellensuche könnte diese Satzung finden (sitemap.xml, Ortsrecht-Seite, in SH der Zuständigkeitsfinder) und die genannte Adresse als `source.base` eintragen. Nutzen: trifft genau die amtliche Seite. Aufwand: mittel (Textsuche in PDF). Risiko: veraltete Satzungen; nur Adressen auf der eigenen Domain übernehmen.

**Amtsblatt des Gemeindeverbands.** 360 Verwaltungsgemeinschaften, 146 Ämter und 48 Verbandsgemeinden sind offen. Ihr Amtsblatt oder ihre Bekanntmachungsseite deckt alle Mitglieder; das Gremium im Titel („Gemeinderat X“) ordnet die Sitzung zu. Nutzen: hoch. Aufwand: gering bis mittel (Zuordnung über Mitgliedsnamen, wie in der Quellensuche). Risiko: Fehlzuordnung bei gleichen Gremiennamen; im Zweifel nicht übernehmen.

**OCR für eingescannte Aushänge.** Viele kleine Gemeinden stellen gescannte Einladungen ohne Textebene ein (Vermutung). Kosten: Google Enterprise Document OCR 1,50 USD je 1.000 Seiten. Bei angenommen 1.600 Gebieten, zwei Sitzungen im Monat und drei Seiten je Einladung wären das rund 10.000 Seiten oder etwa 15 USD im Monat. Aufwand: mittel; OCR läuft nicht im Worker, sondern als eigener Schritt. Risiko: Lesefehler bei Punktnummern („N“ vs. „11“) gefährden die Trennung öffentlich/nichtöffentlich, deshalb nur bei klarer Überschrift „öffentlich“ übernehmen; Datenschutz: Aushänge nennen teils Bauherren oder Antragsteller, also nur temporär verarbeiten, nur Tagesordnungstitel speichern, Auftragsverarbeitung mit dem Anbieter.

**KI-Extraktion bei unbekanntem Layout.** Wo die Regeln des Lesers keine Tagesordnung finden, kann der manuelle KI-Ablauf aus `requirements/ai-processing.md` die Seite lesen: Quelle einmal abrufen, Prüfsumme und Auszug belegen, `insufficient_source` statt Raten. Nutzen: deckt Einzelfälle ab. Aufwand: mittel. Risiko: Halluzinierte Punkte; Pflicht ist ein wörtlicher Beleg je Punkt und der Öffentlichkeitsnachweis aus dem Text. Erst nach v1, wenn die Fehlerfälle des Lesers bekannt sind.

**Änderungserkennung.** Bedingte Anfragen mit `If-None-Match`/`If-Modified-Since` (RFC 9110) und `lastmod` aus sitemap.xml sparen Abrufe: Unveränderte Seiten antworten mit 304, und nur geänderte Adressen werden gelesen. Nutzen: deutlich weniger Last bei täglichen Läufen. Aufwand: gering (ETag je Adresse speichern). Risiko: `lastmod` ist oft ungenau; daher nur als Vorrang, nicht als Ausschluss nutzen.

**Rückkanal „Ihre Kommune fehlt?“** Ein Formular auf der öffentlichen Seite, über das eine Kommune ihre Bekanntmachungsseite, einen Feed oder eine OParl-Adresse nennt. Nutzen: genaue Adressen, dazu Freigaben bei Anbietern mit robots-Sperre. Aufwand: gering. Risiko: Falschmeldungen; übernommen wird nur eine Adresse auf der offiziellen Domain (Wikidata P856) und nach erfolgreicher Prüfung mit `verify.mjs`.

**Abgleich mit dem Landkreis.** Kreissysteme führen nur Kreisgremien und taugen nicht als Quelle einer Gemeinde (Regel der Quellensuche). Brauchbar sind sie als Plausibilität: Ein Kreisamtsblatt, das Bekanntmachungen kreisangehöriger Gemeinden mitführt, wäre ein Wegweiser (Vermutung, nicht geprüft). Nutzen: gering bis mittel. Aufwand: mittel. Status: später prüfen.

**Livestreams und Zeitungen.** Ein angekündigter Livestream belegt nur einen Termin; der Leser übernimmt höchstens Datum und Gremium als Hinweis, nie Bild, Ton oder Beschreibungstext. Zeitungsartikel bleiben außen vor; ein Link „Bericht in der Lokalpresse“ ist denkbar, wird aber nicht automatisch gesucht.

## Grenzen der Website-Variante

- **Keine Vorlagentexte.** Einladungen nennen nur Titel; Sachstand, Begründung und Anlagen fehlen. Inhaltsanalysen haben dann meist `insufficient_source`.
- **Beschlüsse nur teilweise.** Außer in Thüringen ist die Veröffentlichung von Beschlüssen und Niederschriften im Netz freiwillig. Abstimmungsergebnisse stehen nur in Niederschriften, und die erscheinen oft Wochen später.
- **Vollständigkeit unbekannt.** Seiten werden gelöscht, wenn die Aushangfrist endet; Ausschusssitzungen fehlen oft. Eine leere Liste heißt nicht „keine Sitzung“.
- **Keine Vorgangsverknüpfung.** Ohne Vorlagennummern lassen sich Punkte verschiedener Sitzungen nur über ähnliche Titel verbinden.
- **Kennzeichnung im Produkt.** Jede Sitzung trägt die Quellenart „Website der Kommune (öffentliche Bekanntmachung)“ mit Link auf die gelesene Seite, den Hinweis „Tagesordnung ohne Sitzungsunterlagen“ und, wo vorhanden, die Herkunft des Beschlusses („laut Niederschrift vom …“). In der Abdeckung zählen diese Gebiete getrennt von Gebieten mit RIS.

## Quellen

- Art. 52 GO Bayern: https://www.gesetze-bayern.de/Content/Pdf/BayGO-52?all=False, https://gesetze.io/gesetze/by/go/52
- Art. 54 GO Bayern: https://www.gesetze-bayern.de/Content/Document/BayGO-54
- Art. 26 GO Bayern und digitale Bekanntmachung: https://www.gesetze-bayern.de/Content/Document/BayGO-26, https://bayrvr.boorberg.de/2024/06/19/digitale-amtliche-bekanntmachungen-und-ihre-rechtliche-umsetzung/
- § 34, § 35, § 38 GemO BW: https://dejure.org/gesetze/GemO/34.html, https://dejure.org/gesetze/GemO/35.html, https://dejure.org/gesetze/GemO/38.html
- § 1 DVO GemO BW, Internetbekanntmachung: https://www.landesrecht-bw.de/jportal/?quelle=jlink&query=GemODV+BW+%C2%A7+1&psml=bsbawueprod.psml&max=true, https://publicus.boorberg.de/oeffentliche-bekanntmachungen-im-internet-anforderungen-an-gemeinden/
- § 58, § 7 HGO: https://www.anwalt24.de/gesetze/hgo/58, https://www.anwalt24.de/gesetze/hgo/7
- § 35, § 40 ThürKO: https://www.anwalt24.de/gesetze/thuerko/35, https://www.anwalt24.de/gesetze/thuerko/40
- Thüringer Landtag Drs. 7/5553: https://parldok.thueringer-landtag.de/ParlDok/dokument/87107/bekanntmachungsformen_in_den_thueringer_kommunen.pdf
- §§ 36, 37, 40 SächsGemO: https://www.anwalt24.de/gesetze/saechsgemo/36, https://www.revosax.sachsen.de/vorschrift/2754-Saechsische-Gemeindeordnung
- § 36 BbgKVerf: https://bravors.brandenburg.de/gesetze/bbgkverf, https://www.anwalt24.de/gesetze/bbgkverf/36
- § 34 GemO RP: https://www.anwalt24.de/gesetze/gemo-1/34, https://www.kommunalbrevier.de/kommunalbrevier/ratssitzung/einladung-oeffentlichkeit-tagesordnung/ii-oeffentlichkeit/4-oeffentliche-bekanntmachung/
- § 41 KSVG Saarland: https://www.anwalt24.de/gesetze/ksvg/41
- § 29 KV M-V: https://www.anwalt24.de/gesetze/kv_m_v/29
- § 34 GO SH: https://www.gesetze-rechtsprechung.sh.juris.de/jportal/?quelle=jlink&query=GemO+SH+%C2%A7+34&psml=bsshoprod.psml&max=true
- § 53 KVG LSA: https://www.anwalt24.de/gesetze/kvg_lsa/53
- § 59, § 11 NKomVG: https://www.anwalt24.de/gesetze/nkomvg/59, https://voris.wolterskluwer-online.de/browse/document/307a384f-d212-341e-b936-71a94259bcf3
- § 48 GO NRW, BekanntmVO: https://www.anwalt24.de/gesetze/go_nrw/48, https://recht.nrw.de/lrgv/rechtsverordnung/21112015-verordnung-ueber-die-oeffentliche-bekanntmachung-von-kommunalem/
- iKISS: https://www.advantic.de/CMS-iKISS/, https://www.advantic.de/CMS-iKISS/Basisumfang/, https://www.celle.de/Stadt/Stadtverwaltung/Mitteilungen/RSS-Feeds-abonnieren/
- NOLIS: https://www.nolis.de/leistungen/webprojekte/webseiten-portale
- Weblication: https://www.weblication.de/cms/cityweb.php
- webEdition-Beispiel: http://www.korschenbroich.de/rss_feed/bekanntmachungen.php?we_objectID=13226
- TYPO3 EXT:news RSS und iCalendar: https://docs.typo3.org/p/georgringer/news/main/en-us/Tutorials/BestPractice/Rss/Index.html, https://docs.typo3.org/p/georgringer/news/main/en-us/Tutorials/BestPractice/ICalendar/Index.html
- calendarize ICS-Import: https://docs.typo3.org/p/lochmueller/calendarize/main/en-us/AdministratorManual/Scheduler/ImportICal.html
- GSB 11, gsb-rss: https://produkt.gsb.bund.de/, https://root.packagist.org/packages/itzbund/gsb-rss
- Contao Feeds: https://docs.contao.org/5.x/manual/en/site-structure/news-feed/
- Joomla RSS: https://www.djaonline.co.uk/blog/create-an-rss-feed-from-a-joomla-category
- WordPress REST Media: https://developer.wordpress.org/rest-api/reference/media/
- The Events Calendar REST: https://theeventscalendar.com/knowledgebase/introduction-to-the-events-calendar-rest-api/
- schema.org Event: https://schema.org/Event, https://developers.google.com/search/docs/appearance/structured-data/event
- Sitemap-Protokoll: https://www.sitemaps.org/protocol.html
- HTTP-Bedingungen (ETag, Last-Modified): https://www.rfc-editor.org/rfc/rfc9110
- NUSSBAUM Medien: https://www.nussbaum-medien.de/produkte/amtsblaetter-lokalzeitungen
- LINUS WITTICH: https://www.wittich.de/produkte/zeitungen/zeitung-online-lesen, https://www.wittich.de/produkte/zeitungen
- Primo: https://de.linkedin.com/company/primo-verlag-anton-st%C3%A4hle-gmbh-&-co.-kg
- Heimat-Info: https://www.cosmema.de/heimat-info-app/
- Digitale Dörfer: https://de.wikipedia.org/wiki/Digitale_D%C3%B6rfer
- § 5 UrhG: https://de.wikipedia.org/wiki/Amtliches_Werk, https://www.ipwiki.de/urheberrecht:amtliche_werke
- BayernPortal „Bürger- und Ratsinformationen online“: https://www.bayernportal.de/dokumente/onlineservice/70219164659
- PVOG: https://docs.fitko.de/pvog/docs/anbindung_bed/, https://www.fitko.de/produktmanagement/pvog
- OParl-Verzeichnis: https://dev.oparl.org/, https://oparl.org/2017/06/14/kurzmeldung-liste-der-bekannten-oparl-endpunkte/
- GovData Ratsinformationen: https://www.govdata.de/suche/daten/ratsinformationssystem
- Google Document AI Preise: https://cloud.google.com/document-ai
- Livestream und Datenschutz: https://www.datenschutz-bayern.de/datenschutzreform2018/aki54.pdf
- mandari, Bekanntmachung der Sitzungen: https://github.com/mandariOSS/mandari/issues/749
