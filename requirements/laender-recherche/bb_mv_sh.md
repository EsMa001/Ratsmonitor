# Brandenburg, Mecklenburg-Vorpommern, Schleswig-Holstein: Wo die Sitzungen kleiner Kommunen dokumentiert sind

Stand 05.10.2026. Grundlage: Arbeitsliste `bb_mv_sh.tsv` (305 offene Gebiete: BB 138, MV 70, SH 97), `shared/de-regions.json`, `server/integrations/de-sources.json`, README („Bundesweiter Abruf“, „robots.txt“), `requirements/anbindungskonzept.md`, `requirements/website-leser-ideen.md` und eine Websuche. Kommunale Websites waren nicht abrufbar (WebFetch/curl gesperrt). Alle Adressen unten stammen aus Suchtreffern (Titel/URL im Suchindex) oder aus Projektdateien. Das Suchbudget der Sitzung war nach rund 30 eigenen Suchen erschöpft (200 Suchen für die ganze Sitzung). Deshalb sind SH und der Rechtsteil dünner belegt als MV und BB.

## 1. Struktur

| Land | Gebiete im Katalog (Gemeindeebene) | davon Ämter | Mitgliedsgemeinden der Verbände | Kreise | offen |
|---|---|---|---|---|---|
| Schleswig-Holstein | 169 (51 Städte, 35 Gemeinden, 83 Ämter) | 83 | 1.018 | 11 | 97 |
| Brandenburg | 193 (77 Städte, 64 Gemeinden, 50 Ämter, 2 Verbandsgemeinden) | 50 | 272 | 14 (+4 kreisfreie Städte) | 138 |
| Mecklenburg-Vorpommern | 116 (30 Städte, 10 Gemeinden, 76 Ämter) | 76 | 684 | 6 (+2 kreisfreie Städte) | 70 |

Allen drei Ländern gemeinsam: Das Amt (BB auch die Verbandsgemeinde) ist die Verwaltung seiner amtsangehörigen Gemeinden. Es bereitet deren Sitzungen vor, lädt ein und schreibt die Niederschriften. Ein Gebiet „Amt“ im Katalog steht deshalb für bis zu 20 Gemeindevertretungen und den Amtsausschuss, in SH oft für noch mehr (im Schnitt 12 Gemeinden je Amt).

**Führen Ämter ein gemeinsames RIS für alle Gemeindevertretungen?** Ja, das ist der Regelfall. Wo ein Amt ein System hat, liegen darin alle Gemeindevertretungen, Ausschüsse und der Amtsausschuss. Belege:
- sitzung-mv.de: Im Mandanten `rehna` stehen die Gemeindevertretungen Königsfeld, Dechow, Rieps, Carlow und Holdorf, die Stadtvertretung Rehna und der Amtsausschuss ([gr020?GRLFDNR=57](https://rehna.sitzung-mv.de/public/gr020?GRLFDNR=57), [GRLFDNR=46](https://rehna.sitzung-mv.de/public/gr020?GRLFDNR=46)). Beim Amt Demmin-Land sind es Amtsausschuss und die Gemeindevertretungen Siedenbrünzow und Schönfeld ([gr020?GRLFDNR=3](https://amt-demmin-land.sitzung-mv.de/public/gr020?GRLFDNR=3), [si019?SILFDNR=1000646](https://amt-demmin-land.sitzung-mv.de/public/si019?SILFDNR=1000646)).
- poliscope führt das Amt Treptower Tollensewinkel als ein RIS mit allen 20 Gemeinden ([poliscope](https://poliscope.de/ratsinformationssystem/treptower-tollensewinkel/130715163)).
- Auch die CMS-Sitzungskalender der Ämter (Abschnitt 2.3) listen die Gemeindevertretungen aller Mitgliedsgemeinden, etwa GV Retzow und GV Mühlenberge beim Amt Friesack ([1](https://www.amt-friesack.de/politik/sitzungskalender.php?a=view&gremium=7862&id=125273), [2](https://www.amt-friesack.de/politik/sitzungskalender.php?a=view&gremium=7858&id=104724)).

Folge für Ratsmonitor: Ein gefundenes Amtssystem deckt in der Regel alle Mitgliedsgemeinden ab. Die Zuordnung zu den Gemeinden läuft über die Gremiennamen („Gemeindevertretung <Name>“).

Ausnahme **mitbenutzte Systeme**: Wo ein Amt von einer Stadt mitverwaltet wird oder Stadt und Amt eine Instanz teilen, liegt das Amt im System der Stadt. Beispiele: Grevesmühlen-Land in `grevesmuehlen.sitzung-mv.de`, vermutlich auch Neubukow-Salzhaff in `neubukow.sitzung-mv.de` (nicht belegt). Hier braucht der Leser `bodies` je Gebiet, wie bei More! Rubin.

## 2. Wo Sitzungen dokumentiert sind

### 2.1 MV: Landesplattform sitzung-mv.de (eGo-MV)

- **Betreiber:** Der Zweckverband Elektronische Verwaltung in Mecklenburg-Vorpommern (eGo-MV, Schwerin) hat nach einer Ausschreibung einen Rahmenvertrag mit CC e-gov über ALLRIS geschlossen. Seine Mitglieder (Ämter, Städte, Kreise) beziehen ALLRIS darüber. Quellen: [ego-mv.de ALLRIS](https://www.ego-mv.de/portal/seiten/allris-ratsinformationssystem-900000035-10044.html), [ego-mv.de Ratsinformationssystem](https://www.ego-mv.de/portal/seiten/ratsinformationssystem-900000020-10044.html), [Update ALLRIS 4.0.8](https://www.ego-mv.de/portal/meldungen/update-auf-allris-4-0-8-erfolgreich-abgeschlossen-900000600-10044.html). Der Verband führt selbst einen Mandanten ([egomv.sitzung-mv.de](https://egomv.sitzung-mv.de/public/gr020?GRLFDNR=1)).
- **Produkt:** ALLRIS 4 (Wicket, Pfade `/public/si019`, `to010`, `to020`, `vo020`, `gr020`). Der Leser `allris` liest es bereits; 30 Mandanten sind angebunden. OParl war bei den angebundenen Mandanten am 04.10.2026 nicht aktiv. Die robots.txt erlaubt den Abruf (README).
- **Warum Gebiete offen blieben:** Wildcard-DNS, Mandanten ließen sich nicht raten (README). **Die Websuche löst das:** `site:sitzung-mv.de` liefert die Mandantennamen aus dem Suchindex.
- **Neu gefundene Mandanten für offene Gebiete (14):** amt-demmin-land, amt-stargarder-land, amtneverin, roebelmueritz, kluetzer-winkel, plau, altentreptow (Amt Treptower Tollensewinkel), sternberg (öffentlicher Teil `/public/` statt der gefundenen Anmeldeseite), nordruegen, sassnitz, carbaek, ludwigslustland, grevesmuehlen (für Grevesmühlen-Land, mitbenutzt), feldberg (nur Anmeldebereich belegt). Zusammen 125.755 Einwohner und 126 Mitgliedsgemeinden. Einzelbelege in der Kandidatendatei.
- Nicht gefunden über diese Suche: Malchin, Malchow, Penzliner Land, Seenlandschaft Waren (haben andere Systeme, siehe unten), Rügen-Ämter außer Nord-Rügen, Ämter im Landkreis Vorpommern-Greifswald außer den schon angebundenen. Die Suche mit Ortsnamen ist unscharf, weil Orte auch in fremden Vorlagen vorkommen. Eine systematische Suche je Amt steht noch aus (Abschnitt 5).

### 2.2 TI-Generator (BB, MV)

- Amt Malchow: `http://infosystem.inselstadt-malchow.de/ris/ti-malchow-4/` (Suchtreffer „Gemeinde Fünfseen“). Der Leser `ti-generator` existiert schon; Amt Friedland (MV) und Nauen (BB) sind darüber angebunden.

### 2.3 CMS-Sitzungskalender der Ämter (wichtigster neuer Weg für BB und kleine Ämter in MV/SH)

Viele Ämter haben kein eigenständiges RIS. Sie nutzen ein Ratsinfo-Modul ihres Website-CMS mit einheitlichen Pfaden:
- `/politik/sitzungskalender.php` (Übersicht; `?a=view&gremium=<id>&id=<sitzung>` für eine Sitzung mit Einladung und Protokoll)
- `/politik/gremium.php?id=<id>` (Gremium)
- Variante `/ratsinfo/sitzungen/…`, `/ratsinfo/gremium/…` (Plessa, Süderbrarup)

Auf denselben Websites liegen auch `/news/index.php?news=<id>`, `/bekanntmachungen/index.php`, `/seite/<id>/…` und `/verwaltung/einheiten`. Dateiablage beim Modul „councilservice“: `<mandant>.mein-intra.net/data/file/councilservice/…`, bundesweit verbreitet, z. B. Sondershausen (TH), Dogern und Dachsberg (BW). Den Hersteller konnte ich nicht belegen.

Belegt für offene Gebiete:
- **BB (9):** Amt Brück ([Link](https://www.amt-brueck.de/politik/sitzungskalender.php?a=view)), Amt Wusterwitz ([Link](https://www.amt-wusterwitz.de/politik/sitzungskalender.php)), Amt Altdöbern ([GV Bronkow](https://www.amt-altdoebern.de/politik/gremium.php?id=3370)), Amt Brüssow ([Link](https://www.amt-bruessow.de/politik/sitzungskalender.php)), Amt Gramzow ([Link](https://www.amt-gramzow.de/politik/sitzungskalender.php)), Amt Gerswalde ([Link](https://www.amt-gerswalde.de/politik/sitzungskalender.php?a=view&gremium=124&id=45915)), Amt Friesack, Amt Schlaubetal ([Link](https://www.amt-schlaubetal.de/politik/sitzungskalender.php?a=view&gremium=5847&id=130882)) und Amt Plessa ([Dokumente](https://www.plessa.de/ratsinfo/sitzungen/dokumente.php)). Amt Gartz (Oder) erschien in derselben Treffergruppe, die Adresse ist aber nicht belegt.
- **BB, councilservice:** Amt Scharmützelsee. Seit 09.09.2019 stehen Vorlagen und Niederschriften des öffentlichen Teils im System ([PDF-Beispiel](https://amt-scharmuetzelsee.mein-intra.net/data/file/councilservice/3/5/9/02._GV_BS_09-09-2019_NS_Buerger.pdf)).
- **MV (4):** Amt Malchin am Kummerower See ([Sitzung](https://www.amt-malchin-am-kummerower-see.de/politik/sitzungskalender.php?a=view&gremium=2914&id=126657); laut Amt seit März 2026 Probleme bei der Umstellung, [Meldung](https://www.amt-malchin-am-kummerower-see.de/news/index.php?news=1206622)), Amt Lubmin ([GV Loissin](https://www.amtlubmin.de/politik/sitzungskalender.php?a=view&gremium=3600&id=39592)), Amt Miltzow ([Link](https://www.amt-miltzow.de/politik/sitzungskalender.php?ebene=5452)) und Amt Seenlandschaft Waren ([Link](https://www.amt-slw.de/seite/271499/gremien-sitzungskalender.html)).
- **SH (2):** Amt Krempermarsch ([Link](https://www.amt-krempermarsch.de/politik/sitzungskalender.php?a=view&gremium=5483&id=100800); die Gemeinde Dägeling zeigt denselben Bestand: [Link](https://www.daegeling.de/politik/sitzungskalender.php?a=view&gremium=5486&id=82809)) und Amt Süderbrarup ([CMS-Ratsinfo](https://ratsinfo.amt-suederbrarup.de/ratsinfo/sitzungen/114515/sitzung-der-gemeindevertretung-steinfeld.html), neben dem robots-gesperrten RIS-Portal; Aktualität offen). Amt Horst-Herzhorn nutzt das Modul ebenfalls, ist aber nicht in der offenen Liste.

Lesbarkeit: einheitliches, vermutlich serverseitig gerendertes HTML mit stabilen IDs. Ein eigener Leser (`cms-sitzungskalender`) lohnt sich, weil das Muster in allen drei Ländern vorkommt. Der Website-Leser trifft die Seiten nur zufällig. OParl gibt es nicht, robots.txt ist nicht geprüft. Öffentlich sind Einladung und Protokoll je Sitzung, Vorlagen nur teilweise (Scharmützelsee: ja).

### 2.4 Weitere Hersteller-RIS (robots/403, Lage wie im README)

- **SD.NET RIM 4 auf ratsinfomanagement.net (Sternberg):** Amt Penzliner Land ([Startseite](https://amt-penzliner-land.ratsinfomanagement.net/startseite)), Landkreis Vorpommern-Greifswald (`kreis-vg.ratsinfomanagement.net`, laut Konzept), dazu die schon gelisteten BB-Fälle (Templin, Prenzlau, Bestensee, Am Mellensee, Odervorland, Märkische Schweiz, Biesenthal-Barnim, Fürstenberg) und Schwaan (MV). Weg: Freigabe beim Anbieter.
- **CC e-gov ALLRIS 3 auf ratsinfo-online.de/.net:** viele BB-Gemeinden im Berliner Umland. Die Standard-robots.txt sperrt alles. Weg: Freigabe bei CC e-gov; derselbe Hersteller betreibt sitzung-mv.de mit offener robots.txt. Das wäre ein Argument im Brief.
- **RIS-Portal/regisafe:** SH (17 Ämter), Hagenow-Land, Neukloster-Warin, Panketal, Lübben, Kappeln. Robots-Sperre, Lage wie im README.

### 2.5 Amtsblätter und Bekanntmachungen

- **Verlag Wittich** gibt in BB und MV die Amtsblätter vieler Ämter heraus, als ePaper (`epaper.wittich.de/frontend/catalogs/<id>/1/pdf/complete.pdf`) und als „Onlinelesen“ (`ol.wittich.de/titel/<titel>/…`). Belegt: „Gemeindeschreiber für das Amt Plessa“ mit Sitzungsterminen aller Gemeindevertretungen ([ePaper](https://epaper.wittich.de/frontend/catalogs/533165/1/pdf/complete.pdf), [Onlinelesen](https://ol.wittich.de/titel/2905/ausgabe/2/2024/artikel/00000000000040932795-OL-2905-2024-7-2-0)), „Amtliches Bekanntmachungsblatt des Amtes Malchin am Kummerower See“ ([ePaper](https://epaper.wittich.de/frontend/catalogs/544891/1/pdf/complete.pdf)) und „Amtskurier des Amtes Treptower Tollensewinkel“ ([Wittich](https://www.wittich.de/produkte/zeitungen/3401-amtskurier-des-amtes-treptower-tollensewinkel)). Inhaltlich wertvoll, weil dort für alle Mitgliedsgemeinden Einladungen und teils Beschlüsse stehen. Es ist aber eine Verlagsplattform, nach `website-leser-ideen.md` nur mit Vereinbarung zu lesen. Eine Anfrage an Wittich deckt viele kleine Ämter auf einmal ab.
- **Amtsblatt-PDF auf eigener Domain:** Stadt Brandenburg an der Havel ([Amtsblatt 08/26](https://www.stadt-brandenburg.de/fileadmin/pdf/10/Buero_SVV/Amtsblatt/2026/Amtsblatt_08_26.pdf)), Schwielowsee (Beleg von 2017). Das kann der Website-Leser heute schon lesen.
- **Bekanntmachungsseiten der Ämter:** z. B. [Malchin](https://www.amt-malchin-am-kummerower-see.de/bekanntmachungen/index.php), [Amt Dorf Mecklenburg-Bad Kleinen](https://www.amt-dorfmecklenburg-badkleinen.de/bekanntmachung-der-sitzung-der-gemeindevertretung-hohen-viecheln-montag-12-10-2026-um-1930-uhr/) (einzelne Beiträge je Sitzung, WordPress-artig; schon über sitzung-mv.de angebunden), Fredersdorf-Vogelsdorf (Nachrichten zu Sitzungen), Ahrensfelde (Seite „Gremiensitzungen“). Das ist der Weg des Website-Lesers für die übrigen Gebiete.

### 2.6 Kreise

Die Kreis-RIS führen in allen drei Ländern nur Kreistag und Kreisausschüsse. **Ich habe kein Kreis-RIS gefunden, das Gemeindevertretungen oder Ämter mitführt.** Die Kreise sind deshalb kein Ersatzweg für kleine Gemeinden. Offen im Katalog: Schleswig-Flensburg (`kreisinfo.schleswig-flensburg.de`, laut Konzept), Märkisch-Oderland (ALLRIS 3 `ratsinfo-online.net/landkreis-mol-bi`, robots), Vorpommern-Greifswald (ratsinfomanagement.net), Ludwigslust-Parchim (SessionNet `bis.kreis-lup.de`, Lesen scheiterte) und Steinburg (sitzung-online.de, robots).

### 2.7 Landesportale, Open Data, Dienstleister

- **BB:** Der Landesservice führt ein Kommunalverzeichnis je Amt mit Adressen ([Beispiel Scharmützelsee](https://service.brandenburg.de/service/de/adressen/kommunalverzeichnis/ansicht/~120675707-scharmuetzelsee)). Sitzungsdaten oder RIS-Verweise dort sind nicht belegt; es eignet sich höchstens als Wegweiser zur Website. Ein „Kommunalportal“ mit Sitzungen habe ich nicht gefunden.
- **MV:** Das Behördenverzeichnis des MV-Serviceportals ([Beispiel](https://behoerdenverzeichnis.mv-serviceportal.de/en?ouId=106211723)) dient ebenfalls nur als Wegweiser. sitzung-mv.de ist die einzige Landesplattform mit Sitzungen (eGo-MV, kein Landesbetrieb).
- **SH:** Der Zuständigkeitsfinder (`<amt>.buergerportal.sh`) führt die Leistung „Bürger- und Ratsinformationssystem“, z. B. [Amt Trave-Land](https://amt-trave-land.buergerportal.sh/buergerportal/zustaendigkeitsfinder/vorgang/buerger-und-ratsinformationssystem-2335). Möglicherweise steht dort je Amt der RIS-Link; das ist ein Wegweiser für die Linksuche (nicht geprüft). Zu Dataport habe ich kein RIS-Angebot gefunden (nicht gesucht, Budget).
- **Open Data:** Keine Sitzungsdaten der drei Länder gefunden (nicht gezielt gesucht).
- **ITDZ, KSM Schwerin:** nicht mehr gesucht (Budget). In MV ist der relevante Dienstleister eGo-MV, siehe 2.1.

### 2.8 Sammelplattform poliscope.de

poliscope.de ist ein privates Angebot. Es liest nach eigener Angabe die öffentlichen RIS von Kommunen und Kreisen, speichert Tagesordnungen, Vorlagen, Beschlüsse und Niederschriften und führt die Gebiete nach amtlichem Regionalschlüssel (`/ratsinformationssystem/<name>/<ARS>`). Für unsere offenen Gebiete führt es Treptower Tollensewinkel, Feldberger Seenlandschaft, Plessa und Scharmützelsee ([Startseite](https://poliscope.de/), [Liste](https://poliscope.de/ratsinformationssystem)). poliscope ist keine Quelle zum Übernehmen (Datenbankrecht, keine offene Schnittstelle belegt). Es taugt aber als Prüfliste: Wo poliscope ein Gebiet führt, gibt es ein lesbares System. Eine Abfrage `site:poliscope.de` je ARS der offenen Gebiete wäre ein billiger nächster Schritt.

## 3. Rechtliche Lage

Die Einzelheiten unten habe ich nicht mehr per Suche nachprüfen können (Suchbudget). Sie stammen aus Fachwissen und den Projektunterlagen; Absätze sind darum nur als Orientierung angegeben.

- **Brandenburg:** BbgKVerf ([bravors](https://bravors.brandenburg.de/gesetze/bbgkverf/list)). Zeit, Ort und Tagesordnung der Sitzungen der Gemeindevertretung sind öffentlich bekanntzumachen; Form und Frist regelt die Hauptsatzung ([Muster-Hauptsatzung StGB 2024](https://www.stgb-brandenburg.de/fileadmin/user_upload/stgb-brandenburg.de/dokumente/Satzungsmuster/013-04-2024-07-01_Muster_HS_2024.pdf); [Rundschreiben MIK](https://mik.brandenburg.de/sixcms/media.php/9/080602_Rundschreiben_Kommunalverfassung.pdf); [Kommunalrecht MIK 2025](https://mik.brandenburg.de/sixcms/media.php/9/Buch_Kommunalrecht_Ausgabe_02_2025.pdf)). § 36 BbgKVerf regelt die Öffentlichkeit der Sitzungen; laut `website-leser-ideen.md` auch die Einsicht in Beschlussvorlagen öffentlicher Punkte. Das Amt macht für seine Gemeinden bekannt, meist im **Amtsblatt des Amtes**; die Bekanntmachung im Internet ist nach Bekanntmachungsverordnung und Hauptsatzung zulässig. Beschlussbekanntmachung und Niederschrift-Veröffentlichung: nicht geprüft.
- **Mecklenburg-Vorpommern:** § 29 KV M-V (Sitzungen; Abs. 6 nach Projektunterlage: rechtzeitig öffentlich bekanntmachen); Bekanntmachungsform nach der Durchführungsverordnung zur KV und der Hauptsatzung, Internet zulässig. Viele Ämter machen auf der Website bekannt (Beispiel Dorf Mecklenburg-Bad Kleinen) oder im Amtsblatt (Wittich). Niederschrift und Beschlussbekanntmachung: nicht geprüft.
- **Schleswig-Holstein:** § 34 GO (Einberufung; Zeit, Ort und Tagesordnung örtlich bekanntmachen), § 35 GO (Öffentlichkeit), § 41 GO (Niederschrift; die Einsicht der Einwohner in Niederschriften öffentlicher Sitzungen ist vermutlich geregelt, nicht geprüft). Ortsrecht und Hauptsatzungen stehen im Zuständigkeitsfinder. Bekanntmachung nach Bekanntmachungsverordnung, die die Internetform zulässt (nicht geprüft). Die Ämter machen für ihre Gemeinden auf der Amts-Website bekannt.
- **Für alle drei:** Einladungen mit Tagesordnung sind amtliche Bekanntmachungen (§ 5 Abs. 1 UrhG). Verlagsamtsblätter sind nur im amtlichen Teil frei, die Plattform selbst ist eine Frage der Vereinbarung (wie in `website-leser-ideen.md`).

## 4. Folgerungen für Ratsmonitor

Nutzbare Wege nach Aufwand:

| Weg | Gebiete (offen) | Einwohner | Mitgliedsgemeinden | Aufwand / Voraussetzung |
|---|---|---|---|---|
| A. sitzung-mv.de-Mandanten eintragen (Leser vorhanden, robots erlaubt) | 14 MV (12 eigen, Grevesmühlen-Land mitbenutzt, Feldberg mit Pfadprüfung) | ≈126.000 | 126 | gering: Einträge in `de-sources.json`, `verify.mjs`; bei Grevesmühlen-Land `bodies` |
| B. TI-Generator Malchow | 1 MV | ≈10.300 | 8 | gering (vorhandener Leser; robots prüfen) |
| C. Neuer Leser „CMS-Sitzungskalender“ (`politik/sitzungskalender.php`, `/ratsinfo/`) | 15 belegt (BB 9, MV 4, SH 2) | ≈117.000 | ≈100 | mittel: ein Leser; Muster bundesweit (auch TH/BW); robots je Domain prüfen |
| D. councilservice/mein-intra.net | 1 BB (Scharmützelsee), bundesweit mehr | ≈10.600 | 5 | mittel; erst nach C |
| E. Website-Leser (Bekanntmachungen, Amtsblatt-PDF eigener Domain) | unbestimmt; Kandidaten Brandenburg a. d. H., Schwielowsee, Fredersdorf-Vogelsdorf, Ahrensfelde, Malchin | – | – | vorhanden; Messung an echten Seiten fehlt |
| F. Brief an Wittich (Amtsblätter BB/MV) | geschätzt 30–60 Ämter (Vermutung) | – | – | Vereinbarung |
| G. Brief an CC e-gov (ratsinfo-online.de, sitzung-online.de) und Sternberg (ratsinfomanagement.net) | BB ≈25, SH ≈40, MV ≈5 aus der Arbeitsliste | – | – | Freigabe (Welle 2 des Konzepts) |

**Schätzung:** Ohne Dritte (A–D) sind sofort oder nach einem Leser **31 der 305 Gebiete** mit rund **265.000 Einwohnern** und gut 240 Gemeinden erreichbar (MV 20, BB 10, SH 2; MV ≈181.000, BB ≈70.000, SH ≈21.000; ohne Doppelzählung von Feldberg). Mit systematischer Suche nach weiteren sitzung-mv.de-Mandanten und CMS-Sitzungskalendern (Abschnitt 5) halte ich für MV weitere 10–20 und für BB weitere 15–30 Ämter und Gemeinden für wahrscheinlich. Die CMS-Ämter mit Pfad `/politik/sitzungskalender.php` häufen sich in Uckermark, Potsdam-Mittelmark, Havelland, Oder-Spree und Elbe-Elster. SH bleibt der schwierigste Fall: Die Masse liegt auf RIS-Portal und sitzung-online.de, beide robots-gesperrt, sodass dort fast nur Freigaben helfen; die 19 SH-Ämter ohne Link brauchen den Website-Leser. Kreisseiten sind kein Ersatzweg.

## 5. Offene Fragen und nächste Schritte

1. Systematische Suche je offenem MV-Gebiet: `site:sitzung-mv.de "<Amtsname>"` sowie `"<Amtssitz>".sitzung-mv.de`. Danach `verify.mjs` mit robots-Prüfung. Offen sind v. a. die Rügen-Ämter (Bergen, West-Rügen, Mönchgut-Granitz), Franzburg-Richtenberg, Recknitz-Trebeltal, die Ämter im Landkreis Rostock (Güstrow-Land, Krakow am See, Laage, Tessin), Vorpommern-Greifswald (Am Peenestrom, Jarmen-Tutow, Peenetal/Loitz, Torgelow-Ferdinandshof, Usedom-Nord) und Ludwigslust-Parchim (Boizenburg-Land, Dömitz-Malliß, Goldberg-Mildenitz).
2. Quellensuche ergänzen: Gebiet ohne RIS-Link → `/politik/sitzungskalender.php` und `/ratsinfo/` auf der eigenen Domain prüfen (wie `OWN_ONLY=1` in `guess.mjs`). Das findet die CMS-Ämter ohne Websuche.
3. Hersteller des CMS-Moduls und von „councilservice/mein-intra.net“ bestimmen; prüfen, ob es einen Export (iCal, RSS) gibt.
4. Gehört Amt Neubukow-Salzhaff zu `neubukow.sitzung-mv.de` (angebunden für Stadt Neubukow), und wird Grevesmühlen-Land von der Stadt verwaltet? Davon hängt ab, ob `bodies` nötig ist.
5. Ist Amt Klützer Winkel auf sitzung-mv.de aktuell (Treffer von 2008/2014)? Bleibt Amt Süderbrarups CMS-Ratsinfo nach dem Wechsel zu RIS-Portal gepflegt? Läuft Malchins Sitzungskalender nach der Umstellung 2026 wieder?
6. Rechtsfundstellen (§ 36 BbgKVerf, § 29 KV M-V, §§ 34, 35, 41 GO SH; Bekanntmachungsverordnungen) mit Absätzen nachprüfen. Klären, ob in einem der Länder Beschlüsse öffentlicher Sitzungen bekanntgemacht werden müssen (wie in TH).
7. Wittich: Gibt es eine Schnittstelle oder Lizenz für den amtlichen Teil der ePaper? Die Anfrage gehört in Welle 2.
8. poliscope als Prüfliste: Für welche offenen Gebiete führt es ein RIS? (`site:poliscope.de` je ARS).
9. Den SH-Zuständigkeitsfinder (`<amt>.buergerportal.sh`, Leistung „Bürger- und Ratsinformationssystem“) auf RIS-Links prüfen.
