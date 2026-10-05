# Niedersachsen, NRW, Berlin, Hamburg, Bremen: Wo stehen Sitzungen, wenn das eigene RIS nicht lesbar ist?

Stand 05.10.2026. Grundlage: Arbeitsliste `ni_nw_stadt.tsv` (270 offene Gebiete), README.md („Bundesweiter Abruf“, „robots.txt“), `requirements/anbindungskonzept.md`, `requirements/website-leser-ideen.md`, `requirements/nds-sources-report.md`, `requirements/de-sources-report.md` und 22 Websuchen. Kommunale Seiten, GovData und GitHub-Fremdrepositorien (OParl-Register) ließen sich aus der Arbeitsumgebung nicht abrufen. Danach war das Websuche-Budget der Sitzung (200 Abfragen, mit anderen Agenten geteilt) aufgebraucht. Deshalb sind die Stadtstaaten gut belegt, Niedersachsen und NRW nur teilweise: Kreis-Amtsblätter, open.nrw und die Mandantenlisten der IT-Dienstleister habe ich nicht mehr gesucht. Was nicht belegt ist, steht als „Vermutung“ oder „ungeprüft“.

## Kurzbefund

- **Hamburg ist der stärkste Fund.** Das Transparenzportal (CKAN, offene JSON-API, Datenlizenz Deutschland – Namensnennung 2.0) führt Drucksachen der Bezirksversammlungen als eigene Datensätze („Bezirk Wandsbek, Drucksache 22-3451“). Belegt sind Wandsbek, Altona, Eimsbüttel und Harburg; laut Portal stammen die Unterlagen aus dem RIS. Dieser Weg führt nicht über die gesperrten `sitzungsdienst-<bezirk>.hamburg.de`.
- **Berlin:** 11 von 12 Bezirksverordnetenversammlungen (BVV) veröffentlichen ihre OParl-Schnittstelle als Open-Data-Datensatz auf daten.berlin.de. Spandau soll OParl mit ALLRIS 4 bekommen. Laut README sperren aber dieselben Rechner unseren Abruf per robots.txt bzw. HTTP 403. Als Begründung nennt der Senat Schutz vor Überlast (Schriftliche Anfrage 19/26786). Weil die Schnittstellen als Open Data veröffentlicht sind, spricht viel für eine Freigabe. Ohne Freigabe bleibt Berlin gesperrt.
- **Bremen:** Die Stadtbürgerschaft und die städtischen Deputationen stehen im SD.NET der Bürgerschaft (`sd.bremische-buergerschaft.de`, Sternberg) und in der Parlamentsdokumentation PARIS. Die 22 Beiräte dokumentieren Sitzungen, Protokolle und Beschlüsse auf den Seiten ihrer Ortsämter (bremen.de-CMS). Das Transparenzportal Bremen hat dafür die Kategorie „Beiratsinformationen und Protokolle“.
- **Niedersachsen:** Samtgemeinden führen die Räte ihrer Mitgliedsgemeinden selbst. Ein Kreis-RIS hilft deshalb nur dort, wo der Kreis tatsächlich Mandanten hostet. Belegt ist das für den Landkreis Göttingen (SessionNet beim krz), für KDG Göttingen (`ris.kdgoe.de`, ALLRIS 4 für Einbeck, Dassel, Moringen, Bad Sachsa, Hattorf und den Landkreis Northeim) und für ITEBO (`*.ris.itebo.de`). Auf kdgoe und itebo lesen wir andere Mandanten bereits. Die offenen Mandanten dort brauchen nur Zuordnung und Code.
- **NRW:** Die 94 offenen Gebiete hängen zu 45 an ratsinfomanagement.net (Sternberg, 403). Ein neuer offener Kanal hat sich nicht gefunden. Zu prüfen bleibt der OParl-Rechner des krz, `sessionnet-oparl.krz.de`: Er ist ein eigener Rechner neben dem robots-gesperrten `sessionnet.owl-it.de`. Ob sein robots.txt den Abruf erlaubt, ist ungeprüft.

## 1. Struktur

| Land | Ebenen im Katalog | Vertretungen darunter | offen (Liste) |
|---|---|---|---|
| Niedersachsen | Städte, Einheitsgemeinden, Samtgemeinden, Landkreise, Region Hannover | Samtgemeinde: Samtgemeinderat **und** die Räte der Mitgliedsgemeinden, beide vom Samtgemeinde-Sitzungsdienst geführt; dazu Ortsräte und Stadtbezirksräte | 173 (54 auf ratsinfomanagement.net) |
| NRW | Städte, Gemeinden, Kreise | Bezirksvertretungen in kreisfreien Städten | 94 (45 auf ratsinfomanagement.net) |
| Berlin | 1 Gebiet (Land = Stadt) | 12 BVV der Bezirke; das Abgeordnetenhaus ist Landesparlament | 1 (3,70 Mio.) |
| Hamburg | 1 Gebiet | 7 Bezirksversammlungen (Altona, Bergedorf, Eimsbüttel, Hamburg-Mitte, Hamburg-Nord, Harburg, Wandsbek); die Bürgerschaft ist Landesparlament | 1 (1,87 Mio.) |
| Bremen | Stadt Bremen (Bremerhaven ist angebunden) | Die 68 Bremer Abgeordneten der Bürgerschaft bilden zugleich die Stadtbürgerschaft; dazu städtische Deputationen und 22 Beiräte in 17 Ortsämtern | 1 (0,59 Mio.) |

**Rechtslage, kurz:**

- **§ 59 Abs. 5 NKomVG:** „Zeit, Ort und Tagesordnung der Sitzungen der Vertretung sind ortsüblich bekannt zu machen“, außer bei nichtöffentlichen Sitzungen (https://gesetze.io/gesetze/ni/nkomvg/59, https://www.anwalt24.de/gesetze/nkomvg/59). Was „ortsüblich“ heißt, regelt die Hauptsatzung, meist Website oder Zeitung. Für Satzungen gilt § 11 NKomVG: ein amtliches Verkündungsblatt, häufig das Amtsblatt des Landkreises, oder das Internet. Eine Pflicht, Beschlüsse oder Niederschriften im Netz zu veröffentlichen, gibt es nicht.
- **§ 48 Abs. 1 GO NRW:** Zeit, Ort und Tagesordnung sind öffentlich bekanntzumachen; die Form legt die Hauptsatzung fest. Nach der BekanntmVO muss die Hauptsatzung die Internetadresse nennen. Das stammt aus `website-leser-ideen.md` und eigener Kenntnis; in dieser Runde nicht nachgeschlagen.
- **Hamburg:** Das Transparenzportal ist das Informationsregister nach dem Hamburgischen Transparenzgesetz (HmbTG). Ausdrücklich veröffentlicht werden „Materialien aus den Sitzungen der Bezirksversammlungen und ihrer Ausschüsse“, entnommen aus dem RIS (https://transparenz.hamburg.de/informationsgegenstaende-796516). Lizenz: dl-de-by-2.0 (https://transparenz.hamburg.de/api-796358).
- **Bremen:** Transparenzportal nach dem Bremischen Informationsfreiheitsgesetz (BremIFG). Die Beiräte regelt das Ortsgesetz über Beiräte und Ortsämter vom 02.02.2010; Protokolle sind Pflicht und enthalten Anträge und Beschlüsse (https://www.transparenz.bremen.de/metainformationen/ortsgesetz-ueber-beiraete-und-ortsaemter-vom-2-februar-2010-85331). Die Paragrafen der Veröffentlichungspflicht im BremIFG habe ich nicht nachgeschlagen.
- **Berlin:** Es gilt das IFG Berlin (Akteneinsicht auf Antrag). Ein Transparenzgesetz mit Register war in dieser Recherche nicht belegt. Für die BVV regelt das Bezirksverwaltungsgesetz die Öffentlichkeit der Sitzungen. Die OParl-Schnittstellen veröffentlichen die Bezirke freiwillig als Open Data.

## 2. Wo Sitzungen dokumentiert sind

### Berlin
- BVV-Systeme: ALLRIS auf `bvv-<bezirk>.berlin.de`, Umstieg auf ALLRIS 4 läuft. Laut README antworten sie unserem Abruf mit HTTP 403 und sperren per robots.txt.
- Auch Suchmaschinen und KI-Crawler sind ausgesperrt; der Senat begründet das mit Lastschutz. Mit ALLRIS 4 ändert sich an robots.txt nichts (https://stefan-ziller.eu/2026/suchmaschinenverbot-allris-verbietet-zugriff-auf-bvv-dokumente/, https://pardok.parlament-berlin.de/starweb/adis/citat/VT/19/SchrAnfr/S19-26786.pdf, https://marzahn-hellersdorf.com/suchmaschinen-bleiben-von-bezirksverordnetenversammlungen-ausgesperrt/).
- **OParl als Open Data:** Datensätze „Schnittstelle zum Informationssystem der BVV …“ auf daten.berlin.de. Gefunden habe ich Mitte, Lichtenberg, Reinickendorf, Charlottenburg-Wilmersdorf, Friedrichshain-Kreuzberg, Pankow, Marzahn-Hellersdorf, Neukölln, Treptow-Köpenick und Tempelhof-Schöneberg. Steglitz-Zehlendorf erschien nicht in den Treffern, laut Quelle sind aber alle außer Spandau dabei.
- Laut den Datensätzen können sich die Adressen beim Umstieg auf ALLRIS 4 ändern und werden dann im Portal nachgeführt (https://daten.berlin.de/datensaetze?tags=Allris, https://odis-berlin.de/aktuelles/2021-09-01-daten-bvv-sitzungen/).
- Die konkreten Endpunkt-URLs stehen in den Datensätzen; ich konnte sie nicht abrufen.
- Drittprojekt `github.com/Aeroid/oparl-bridge`: liest ALLRIS 4 per Playwright und baut daraus OParl. Für uns kein Weg, weil es Zugriffsprüfung und robots umgeht.

### Hamburg
- Bezirks-RIS: ALLRIS auf `sitzungsdienst-<bezirk>.hamburg.de` (Mitte, Nord, Altona, Harburg, Wandsbek belegt), produktiv seit 2013. Laut README robots-gesperrt.
- **Transparenzportal:** Drucksachen der Bezirke als CKAN-Datensätze:
  - https://suche.transparenz.hamburg.de/dataset/bezirk-wandsbek-drucksache-22-3451
  - https://suche.transparenz.hamburg.de/dataset/bezirk-altona-drucksache-21-3944
  - https://suche.transparenz.hamburg.de/dataset/bezirk-eimsbuettel-drucksache-22-2261
  - https://suche.transparenz.hamburg.de/dataset/bezirk-harburg-drucksache-22-1140
- Die Datensätze sind als Typ „document“, Registerobjekt „beschluss“, Format HTML gekennzeichnet; die Suche filtert nach `extras_registerobject_type=beschluss`.
- API: `https://suche.transparenz.hamburg.de/api/3/action/package_search?q=…`; das Beispiel steht auf https://transparenz.hamburg.de/api-796358. Eine Anleitung, alle Datensätze eines Hosts abzufragen, gibt es unter https://hannes.enjoys.it/blog/2016/10/transparenzportal-hamburg-api-alle-datensatze-eines-bestimmten-hosts/.
- **Ungeprüft:**
  - ob Tagesordnungen, Sitzungen und Niederschriften ebenfalls im Portal stehen oder nur Drucksachen;
  - ob alle sieben Bezirke vollständig liefern (Bergedorf, Hamburg-Mitte und Hamburg-Nord nicht als Treffer gesehen);
  - robots.txt von `suche.transparenz.hamburg.de`;
  - ob der HTML-Inhalt den Volltext oder nur einen Link zurück ins gesperrte ALLRIS enthält.
- `bv-hh.de` ist eine inoffizielle Kopie des ALLRIS. Für Ratsmonitor kommt sie nicht als Quelle infrage, ist aber ein Hinweis, dass die Daten öffentlich gespiegelt werden.

### Bremen
- **Stadtbürgerschaft und städtische Deputationen:** SD.NET der Bürgerschaft, Dokumente ab November 2017 (https://sd.bremische-buergerschaft.de/, Termine: https://sd.bremische-buergerschaft.de/termine). Dazu die Parlamentsdokumentation PARIS mit Drucksachen und Protokollen von Landtag und Stadtbürgerschaft (https://paris.bremische-buergerschaft.de/).
- Laut README führt das OParl-System der Bürgerschaft Landtag und Stadtbürgerschaft als eine Körperschaft. Die Gremien lassen sich aber nach Namen trennen („Stadtbürgerschaft“, „Städtische Deputation für …“ gegenüber „Staatliche Deputation …“; belegt: https://www.bremische-buergerschaft.de/index.php?id=613).
- **Beiräte:** Jedes Ortsamt führt Sitzungskalender, Protokolle und Beschlüsse auf seiner bremen.de-Seite, zum Beispiel:
  - https://www.ortsamt-horn-lehe.bremen.de/beirat/sitzungen-protokolle-beschluesse-1658
  - https://www.ortsamt-burglesum.bremen.de/beirat/sitzungen-protokolle-14979
  - https://www.ortsamt-vegesack.bremen.de/der-beirat/sitzungen-und-protokolle-13047
  - https://www.ortsamtschwachhausenvahr.bremen.de/schwachhausen/beirat/protokolle-32219
  - https://www.ortsamt-oberneuland.bremen.de/beirat/protokolle/beiratsprotokolle-9562
  - https://www.ortsamtmitte.bremen.de/ortsamt/zukuenftige-sitzungen-24508
- Die Seiten bieten Sitzungskalender, Sitzungssuche und eine Liste vergangener Sitzungen. Sie haben einheitliche Pfade, vermutlich ein gemeinsames Modul des bremen.de-CMS (Vermutung).
- Transparenzportal Bremen: https://www.transparenz.bremen.de/ (Kategorie „Beiratsinformationen und Protokolle“, Volltextsuche).

### Niedersachsen
- **Samtgemeinden** (44 der 173 offenen Gebiete): Der Sitzungsdienst der Samtgemeinde führt die Räte der Mitgliedsgemeinden mit. Die Mitgliedsgemeinden haben deshalb meist kein eigenes RIS, und ein Kreis-RIS ersetzt das Samtgemeinde-RIS nicht. Das Beispiel Land Hadeln stellt die Geschäftsordnung der Mitgliedsgemeinde Nordleda auf der Samtgemeinde-Website bereit (https://www.samtgemeinde-land-hadeln.de/fileadmin/user/Nordleda/satzungen/Nordleda_Geschaeftsordnung.pdf). Bei „A Kein Link“-Samtgemeinden (Land Hadeln, Elbmarsch, Lachendorf, Hambergen, Baddeckenstedt, Nienstädt, Lühe, Dransfeld, Fintel, Amelinghausen, Lindhorst, Dahlenburg, Siedenburg) ist die Samtgemeinde-Website der Ort für den Website-Leser.
- **Kreis- und Dienstleister-Plattformen mit Gemeinde-Mandanten (belegt):**
  - Landkreis Göttingen: SessionNet unter `sessionnet.landkreisgoettingen.de` bzw. `sessionnet.krz.de/kreis_goettingen/`; der Landkreis selbst ist angebunden.
    - Herzberg am Harz nutzt SessionNet seit 2006 (https://www.herzberg.de/portal/seiten/hinweise-zum-ratsinformationssystem-sessionnet-900000009-25580.html); laut Konzept liegt der Mandant unter `sessionnet.owl-it.de/herzberg/` und ist damit robots-gesperrt.
    - Ob Rosdorf, Friedland, Adelebsen, Duderstadt und Dransfeld Mandanten haben, ist ungeprüft; die Suche fand nur den Kreis.
  - KDG Göttingen (`ris.kdgoe.de`, ALLRIS 4 aus der Cloud mit CC e-gov; https://www.kdgoe.de/portal/seiten/anwendungen-ratsinformationssystem-900000040-12170.html):
    - Landkreis Northeim (`LKNOM_public`) und Samtgemeinde Hattorf (`HAT_public`) sind angebunden.
    - Offen mit „Lesen scheiterte“: Einbeck (`EIN_public`), Dassel (`DAS_public`), Moringen (`MOR_public`), Bad Sachsa (`SAC_public`); Konzept DE5.
  - ITEBO (`<mandant>.ris.itebo.de/bi/`, SessionNet öffentliche Seiten): Langelsheim und Elm-Asse sind angebunden. Offen: Georgsmarienhütte (`gmh.ris.itebo.de`, „Zuordnung unklar“).
  - ratsinfomanagement.net (Sternberg):
    - Die Plattform trägt bei manchen Mandanten auch das **Amtsblatt** (`achim.ratsinfomanagement.net/amtsblatt/`, `rietberg.ratsinfomanagement.net/amtsblatt/`). Dafür gilt dieselbe Sperre per 403.
    - OParl unter `/webservice/oparl/v1.1/system` liefert bei 25 Mandanten (darunter Bad Pyrmont und Nordstemmen in NI).
    - Bei den 99 offenen antwortet der Pfad laut Konzept mit 404 oder 403 oder ist robots-gesperrt (Konzept Frage 6).
- **Amtsblätter der Landkreise:** Belegt online als PDF für Landkreis Leer (https://www.landkreis-leer.de/Aktuelles/Amtsblatt), Ammerland (https://www.ammerland.de/Aktuelles/Bekanntmachungen/Amtsblatt/) und Göttingen (zum Beispiel Nr. 26 vom 13.06.2024 unter landkreisgoettingen.de/PDF/…). In Niedersachsen verkünden viele Gemeinden ihre Satzungen im Kreis-Amtsblatt (§ 11 NKomVG). Sitzungseinladungen stehen dort aber in der Regel nicht, weil „ortsüblich“ meist Website oder Zeitung heißt (Vermutung, Inhalt nicht geprüft). Für Ratsmonitor taugen die Kreis-Amtsblätter deshalb höchstens als Ergänzung, etwa für Satzungsbeschlüsse, nicht als Sitzungsquelle.
- Region Hannover: Das Konzept nennt das Open-Data-Portal HIDD (https://hidd.digital/ueber-das-portal) als möglichen Kanal. In dieser Runde nicht geprüft.

### NRW
- Die offenen Gebiete liegen vor allem auf ratsinfomanagement.net, in Kreisen ohne kommunalen Dienstleister-Hub für die Gemeinden (Märkischer Kreis, Steinfurt, Borken, Minden-Lübbecke, Lippe, Gütersloh, Hochsauerlandkreis).
- Belegte OParl-Kanäle aus dem Bestand:
  - kdvz Frechen: 20 OParl-Quellen, robots-gesperrt.
  - Hagen: `hagen.de/buergerinfo/oparl/1.0/system.asp`, ALLRIS mit Zugriffsprüfung.
- **krz/owl-it (SessionNet):** Der Hersteller Somacos bietet „SessionNet OParl“ als anonymen Lesezugang. Das krz betreibt ihn unter `https://sessionnet-oparl.krz.de/oparl/bodies/<nr>`, belegt durch Dateien von Beckum (Body 5497) und den Bodies 5232, 1648, 5374 und 5205; 5205 steht schon in `data/nrw-seed.json`.
  - Die Bodies sind nicht nur aus NRW: Unter 5374 liegt ein Leitfaden zum NKomVG, also eine niedersächsische Körperschaft.
  - Das ist ein **anderer Rechner** als das robots-gesperrte `sessionnet.owl-it.de`. Für Mandanten, die das krz dort freigeschaltet hat, wäre er der offene Weg. Betroffen in der Liste vermutlich Sprockhövel (`en-kreis`) und Herzberg am Harz.
- open.nrw führt einen Showroom „Nutzung von OParl in Kommunen aus NRW“ (https://open.nrw/open-data/showroom/nutzung-von-oparl-kommunen-aus-nrw) und den Datensatz Bonn (https://open.nrw/dataset/ratsinformationssystem-oparl-api-bn). Eine Gesamtliste habe ich nicht mehr abgefragt.

## 3. Sammelplattformen und Open-Data-Kanäle ohne die gesperrten Seiten

| Kanal | Gebiet(e) | Inhalt | Lesbarkeit | Status |
|---|---|---|---|---|
| Transparenzportal Hamburg, CKAN-API `suche.transparenz.hamburg.de/api/3/action/package_search` | de-02000000 (7 Bezirke) | Drucksachen der Bezirksversammlungen, Beschluss-Registerobjekte | offene API, dl-de-by-2.0; robots ungeprüft | **neu, Code ohne Dritte** |
| daten.berlin.de, Datensätze „Schnittstelle zum Informationssystem der BVV …“ | de-11000000 (11 von 12 Bezirken) | OParl: Sitzungen, Gremien, Drucksachen, Personen | Endpunkte auf BVV-Rechnern: robots + 403 laut README | Freigabe nötig; Open-Data-Veröffentlichung als Argument |
| SD.NET der Bürgerschaft und PARIS | de-04011000 | Stadtbürgerschaft, städtische Deputationen | OParl vorhanden (eine Körperschaft); robots-Status siehe Bestand | Code: Gremienfilter |
| Ortsamt-Seiten bremen.de | de-04011000 (22 Beiräte) | Sitzungskalender, Protokolle, Beschlüsse | Website-Leser; robots ungeprüft | Website-Leser |
| Transparenzportal Bremen | de-04011000 | Beiratsinformationen und Protokolle | Suche, keine API belegt | später prüfen |
| `ris.kdgoe.de` (ALLRIS 4) | nds-03155013, nds-03155003, nds-03155009, nds-03159004 | volles RIS | Leser vorhanden, andere Mandanten angebunden | Code (DE5) |
| `*.ris.itebo.de` (SessionNet) | nds-03459019 | volles RIS | Leser vorhanden | Zuordnung prüfen |
| `sessionnet-oparl.krz.de` | owl-it-Mandanten, vermutlich nrw-05954028, nds-03159019 | OParl | eigener Rechner; robots ungeprüft | einmal messen |
| Kreis-Amtsblätter (Leer, Göttingen, Ammerland) | Gemeinden der Kreise | Satzungen, kaum Sitzungseinladungen (Vermutung) | PDF | nur Ergänzung |

## 4. Folgerungen für Ratsmonitor

1. **Hamburg über das Transparenzportal anbinden.**
   - Ein CKAN-Leser (package_search mit `q="Bezirk <Name>, Drucksache"` bzw. nach Organisation oder Registerobjekttyp, zeitlich über `metadata_modified`) liefert Drucksachen und Beschlüsse der 7 Bezirke, ohne die gesperrten ALLRIS-Rechner zu berühren.
   - Vorher prüfen: robots.txt von `suche.transparenz.hamburg.de`, Feldbelegung (Datum, Gremium, Status) und ob Tagesordnungen enthalten sind.
   - Ergebnis wären „Drucksachen ohne Sitzungskalender“; so muss es im Produkt gekennzeichnet sein.
   - Aufwand ≈ 3–5 PT plus Katalogumbau Bezirke (FG11). Erreichbar: 1,87 Mio. Einwohner, eventuell zunächst ohne Bezirksgliederung.
2. **Berlin:** Freigabe anfragen (R1).
   - Das stärkste Argument: Die Bezirke veröffentlichen die OParl-Schnittstellen selbst als Open Data, sperren sie aber per robots.txt. Eine Ausnahme für die OParl-Pfade oder unsere Kennung widerspricht nicht dem Lastschutz-Argument des Senats, weil OParl ein gedrosselter Abruf von Metadaten ist.
   - Adressaten: Senatskanzlei bzw. ITDZ als Betreiber und ODIS (Open Data Informationsstelle).
   - Ohne Zusage kein Abruf (README-Grundsatz). 3,70 Mio. Einwohner, binär.
3. **Bremen:**
   - (a) OParl der Bürgerschaft auf die Gremien der Stadtbürgerschaft und der städtischen Deputationen filtern. Reine Codeänderung, sofern robots den OParl-Pfad erlaubt.
   - (b) Die 17 Ortsamt-Seiten in den Website-Leser aufnehmen: einheitliches CMS, Protokolle als PDF.
   - Zusammen 0,59 Mio. Einwohner, ohne Dritte erreichbar, wenn robots es erlaubt.
4. **Niedersachsen:**
   - Die 4 kdgoe-Mandanten (≈53.000 Einwohner) über den bestehenden ALLRIS-4-Leser zuordnen (DE5).
   - Georgsmarienhütte (31.000) über itebo prüfen.
   - Herzberg (12.600) und Sprockhövel (24.000): einmal `sessionnet-oparl.krz.de` messen, robots zuerst.
   - Die übrigen 13 „Kein Link“-Samtgemeinden: Samtgemeinde-Website in den Website-Leser (Bekanntmachungen nach § 59 Abs. 5 NKomVG).
   - Kreis-Amtsblätter nicht als Sitzungsquelle planen.
5. **NRW:** Kein neuer offener Kanal. Die 45 ratsinfomanagement.net-Gebiete bleiben im Sternberg-Brief (C6/B9). Darin sollte der Hinweis stehen, dass OParl je Mandant aktivierbar ist und 25 Mandanten es schon liefern.

**Schätzung, nur diese 270 Gebiete:**

| Weg | Gebiete | Einwohner |
|---|---:|---:|
| ohne Dritte, Code | Hamburg 1, Bremen 1, kdgoe 4, itebo 1, krz-OParl bis 2 (falls robots erlaubt) | ≈2,6 Mio. |
| mit Website-Leser (Samtgemeinden „Kein Link“, Bremer Beiräte als Ergänzung) | ≈13–20 | ≈0,2 Mio. |
| Freigabe nötig | Berlin 1, ratsinfomanagement.net 99, ALLRIS-Zugriffsprüfung 10 | 3,70 Mio. + 3,27 Mio. + 1,69 Mio. (Einwohner inkl. Kreise) |

Den größten Gewinn ohne Dritte bringt Hamburg, gefolgt von Bremen.

## 5. Offene Fragen

1. Hamburg: robots.txt von `suche.transparenz.hamburg.de`? Liefern alle 7 Bezirke? Gibt es neben Drucksachen auch Tagesordnungen und Niederschriften? Enthält die HTML-Ressource den Text oder nur den ALLRIS-Link?
2. Berlin: konkrete OParl-URLs aus den daten.berlin.de-Datensätzen und deren Lizenz. Gilt die robots-Sperre auch für den OParl-Pfad, oder nur für die HTML-Seiten? Wer ist Ansprechpartner (Senatskanzlei, ITDZ, ODIS)? Wie ist der Stand von Spandau und Steglitz-Zehlendorf?
3. Bremen: robots.txt von `sd.bremische-buergerschaft.de` (OParl-Pfad) und der Ortsamt-Seiten; amtliche Gliederung der Beiräte für einen späteren Katalog.
4. `sessionnet-oparl.krz.de`: robots.txt, Liste der Bodies (`/oparl/bodies`), sind Herzberg und Sprockhövel dabei?
5. Landkreis Göttingen: Welche Gemeinden (Rosdorf, Friedland, Adelebsen, Duderstadt, Dransfeld) haben Mandanten auf dem Kreis-SessionNet?
6. NI-Kreis-Amtsblätter: Stehen dort Sitzungsbekanntmachungen von Gemeinden? Stichprobe Leer, Göttingen, Cuxhaven, Osterholz, Verden.
7. NRW: Liste von open.nrw „Kommunen-OParl“ gegen die 94 offenen Gebiete abgleichen. Mandantenlisten der IT-Dienstleister (Südwestfalen-IT, KDN, ITK Rheinland, regio iT) für die offenen Gebiete.
8. Rechtliches: Gilt eine Open-Data-Veröffentlichung einer Schnittstelle mit offener Lizenz (Berlin) als ausdrückliche Erlaubnis, die robots.txt verdrängt? Gehört in die Rechtsauskunft vor dem Scharfschalten.

## Quellen (Auswahl, alle oben verwendet)

- Berlin:
  - https://daten.berlin.de/datensaetze/schnittstelle-zum-informationssystem-der-bvv-berlin-mitte
  - https://daten.berlin.de/datensaetze/bvv-charlottenburg-wilmersdorf
  - https://daten.berlin.de/datensaetze/schnittstelle-zum-informationssystem-der-bvv-pankow-von-berlin
  - https://stefan-ziller.eu/2026/suchmaschinenverbot-allris-verbietet-zugriff-auf-bvv-dokumente/
  - https://stefan-ziller.eu/2020/opendata-welche-bezirke-nutzen-die-oparl-schnittstelle-von-allris/
  - https://pardok.parlament-berlin.de/starweb/adis/citat/VT/19/SchrAnfr/S19-26786.pdf
  - https://github.com/Aeroid/oparl-bridge
- Hamburg:
  - https://transparenz.hamburg.de/api-796358
  - https://transparenz.hamburg.de/informationsgegenstaende-796516
  - https://suche.transparenz.hamburg.de/dataset/bezirk-wandsbek-drucksache-22-3451
  - https://sitzungsdienst-hamburg-nord.hamburg.de/bi/allris.net.asp
  - https://bv-hh.de/hamburg-mitte
- Bremen:
  - https://sd.bremische-buergerschaft.de/
  - https://paris.bremische-buergerschaft.de/
  - https://www.ortsamt-horn-lehe.bremen.de/beirat/sitzungen-protokolle-beschluesse-1658
  - https://www.transparenz.bremen.de/
- Niedersachsen:
  - https://gesetze.io/gesetze/ni/nkomvg/59
  - https://sessionnet.landkreisgoettingen.de/bi/info.asp
  - https://sessionnet.krz.de/kreis_goettingen/bi/info.asp
  - https://www.kdgoe.de/portal/seiten/anwendungen-ratsinformationssystem-900000040-12170.html
  - https://www.landkreis-leer.de/Aktuelles/Amtsblatt
  - https://www.ammerland.de/Aktuelles/Bekanntmachungen/Amtsblatt/
- NRW und krz:
  - https://sessionnet-oparl.krz.de/oparl/bodies/5497/downloadfiles/a/00096648.pdf
  - https://sessionnet-oparl.krz.de/Oparl/bodies/5374/downloadfiles/a/00238731.pdf
  - https://open.nrw/open-data/showroom/nutzung-von-oparl-kommunen-aus-nrw
