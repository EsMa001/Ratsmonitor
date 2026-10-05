# Hessen, Rheinland-Pfalz, Saarland: Wo Sitzungen kleiner Kommunen dokumentiert sind

Stand 05.10.2026. Grundlage: Arbeitsliste `he_rp_sl.tsv` (382 offene Gebiete: HE 316, RP 42, SL 24), Repository-Unterlagen (README „Bundesweiter Abruf“, `requirements/anbindungskonzept.md`, `requirements/website-leser-ideen.md`, `server/integrations/de-sources.json`) und Websuche.

**Einschränkung:** Das Websuche-Budget der Sitzung war nach gut 30 Suchen erschöpft (200 von 200, mit anderen Aufträgen geteilt). WebFetch auf poliscope.de und ol.wittich.de ist vom Proxy gesperrt. Deshalb ist nur ein Teil der Gebiete einzeln untersucht. Die Rechtsangaben stammen aus `website-leser-ideen.md` und wurden nicht neu geprüft. Die Kandidaten (24 Einträge für 21 Gebiete) stehen in `he_rp_sl-kandidaten.json`.

## 1. Struktur

**Hessen.** 21 Landkreise, 5 kreisfreie Städte und 421 kreisangehörige Gemeinden. Es gibt keine Verbandsgemeinden; jede Gemeinde hat eine eigene Gemeindevertretung bzw. Stadtverordnetenversammlung und meist Ortsbeiräte. Deshalb hat die Arbeitsliste so viele kleine Einzelgebiete (316, davon 208 „kein Link“). Die Kreise führen eigene Kreistagssysteme, dokumentieren aber nicht die Sitzungen ihrer Gemeinden. Eine hessische Kreisseite ersetzt also kein Gemeinde-RIS. Der IT-Dienstleister ekom21 (Gießen/Darmstadt/Kassel) betreibt SD.NET RIM für viele Kommunen unter `rim.ekom21.de/<mandant>/`. Daneben gibt es ratsinfomanagement.net (CC e-gov, ebenfalls SD.NET), more! rubin, Kommune aktiv und RIS-Portal (regisafe).

**Rheinland-Pfalz.** Die 42 offenen Gebiete sind 3 Landkreise, 2 Städte, 1 Gemeinde und 36 Verbandsgemeinden. Eine VG verwaltet ihre Ortsgemeinden mit. Das RIS der VG führt deshalb in der Regel auch die Ortsgemeinderäte. Beispiele aus der Suche: Ortsgemeinderat Dausenau bei vgben.de, Gau-Bickelheim bei woellstein.de, Willmenrod bei vg-westerburg.de. Öffentliche Bekanntmachungen erscheinen im **Amtsblatt der VG**. Dieses kommt meist von LINUS WITTICH (Höhr-Grenzhausen, Föhren), z. B. „Loreley-Echo“, „Bad Ems-Nassau aktuell“, „Unsere Heimat VG Herrstein-Rhaunen“ oder „Amtsblatt der VG Lingenfeld“. Darin stehen Tagesordnungen und Beschlüsse von VG- *und* Ortsgemeinderäten.

**Saarland.** 5 Landkreise, der Regionalverband Saarbrücken und 52 Gemeinden, alle ohne Gemeindeverbände; dazu Ortsräte. Fast alle Gemeinden sind Mitglied im Zweckverband **eGo-Saar**, der seinen Mitgliedern ALLRIS anbietet. Diese Systeme liefen früher unter `ratsinfo-<name>.ego-saar.de/allris-public/`, heute unter `ratsinfo-<name>.sitzung-online.de/public/` (so schon angebunden: Homburg, St. Ingbert, Merzig, Mettlach, Großrosseln u. a.). Im Kreis Neunkirchen und im Raum St. Wendel/Saarlouis gibt es zusätzlich SessionNet auf **rznk.de** (`bi<kürzel>.rznk.de`, ein Server 212.88.143.117, 9 Quellen schon angebunden). Die Gemeinden geben wöchentliche Amtsblätter heraus, oft über Wittich.

Quellen: https://www.ego-saar.de/portfolio/loesungen/ratsinformationssystem/, https://www.ego-saar.de/verband/mitglieder/, https://www.ego-saar.de/verband/ueber-uns, https://de.wikipedia.org/wiki/Ekom21, https://www.wittich.de/produkte/zeitungen/amtsblaetter

## 2. Wo Sitzungen dokumentiert sind

### 2.1 ekom21 (Hessen)
- Die SD.NET-Seiten sitzen hinter einer Web-Firewall. Die OParl-Schnittstelle `rim.ekom21.de/<mandant>/webservice/oparl/v1.1/system` ist offen, wo die Kommune sie eingeschaltet hat (22 Gebiete schon angebunden, siehe README).
- **Neu belegt:** Die Suchmaschine hat OParl-Dateien unter `webservice/oparl/v1.1/body/1/files/...` indexiert:
  - **Königstein im Taunus** (de-06434005, bisher „kein Link“), z. B. die Niederschrift der StVV vom 23.03.2023 und ein Plan zu Vorlage 232/2024. OParl ist dort offenbar aktiv.
  - **Neu-Anspach** (de-06434007), mit Dateien von 2022. Die Liste führt Neu-Anspach als „OParl nicht aktiv“; das sollte erneut geprüft werden.
- Weitere Mandanten aus der Suche: `frankenberg` (Bürgerinfosystem, passt zu Frankenberg (Eder), de-06635011, bisher „kein Link“) und `regionalverband` (vermutlich Regionalverband FrankfurtRheinMain, kein Listengebiet). Dazu kommen schon bekannte: dautphetal, homberg-efze, felsberg, lollar.
- Ein Landesverzeichnis der ekom21-Mandanten mit OParl gibt es nicht. ekom21 bewirbt nur eine „urbane Datenplattform“, keine Sammel-OParl-Schnittstelle (https://www.ekom21.de/infocenter/einfo21-digital/2021/november/datenplattform/, https://www.ekom21.de/infocenter/einfo21-digital/2022/april/datenplattform-ekom21/). Hessisches Open-Data-Portal laut Anbindungskonzept: https://digitales.hessen.de/moderne-verwaltung/open-data-portal-hessen. OParl-Datensätze hessischer Kommunen sind dort nicht belegt.
- Quellen: https://rim.ekom21.de/koenigstein/webservice/oparl/v1.1/body/1/files/UGhVM0hpd2NXNFdFcExjZbt2a2EfIT17pWCjQTCJkmRuwJTXvZ5VCbcEc2j9Dgo2/Oeffentliche_Niederschrift_Stadtverordnetenversammlung_23.03.2023.pdf, https://rim.ekom21.de/neu-anspach/webservice/oparl/v1.1/body/1/files/UGhVM0hpd2NXNFdFcExjZcrd5wIai-Q-k2IgC35UzsODM-lHMPpMfPgwkOKXsj1w/Beschlusstext_11-2022_-oeffentlich-_Stadtverordnetenversammlung_17.02.2022.pdf, https://rim.ekom21.de/frankenberg/, https://rim.ekom21.de/regionalverband/startseite

### 2.2 ratsinfomanagement.net (HE, RP)
- **Stadt Fulda** (`fulda.ratsinfomanagement.net`) und **Landkreis Marburg-Biedenkopf** (`marburg-biedenkopf.ratsinfomanagement.net`) haben dort ein RIS, obwohl die Liste sie als „kein Link“ führt. Der Dienst antwortet uns mit 403.
- Der Landkreis Fulda auf demselben Dienst liefert OParl (`landkreis-fulda.ratsinfomanagement.net/webservice/oparl/v1.1/system`, angebunden). Je Mandant lohnt deshalb der Versuch mit `/webservice/oparl/v1.1/system`. Das betrifft auch die 10 RP/HE-Gebiete der Liste mit „403 ratsinfomanagement.net“.
- Quellen: https://fulda.ratsinfomanagement.net/, Kreisseite mit Verweis https://www.marburg-biedenkopf.de/politik_und_gremien/index.php

### 2.3 Eingebettete Ratsinfo auf VG-Websites (RP)
- Viele VG-Websites zeigen Sitzungen und Gremien unter dem eigenen Domainnamen: `/ratsinfo/sitzungstermin/<16 Zeichen>/<titel>/` und `/ratsinfo/gremium/<id>/<titel>/`. Dabei sind VG-Rat, Ausschüsse und **alle Ortsgemeinderäte**.
- Belegt für Bad Ems-Nassau (vgben.de, Liste „kein Link“), Lingenfeld (vg-lingenfeld.de, „kein Link“) und Wöllstein (woellstein.de, Liste „Unbekanntes System“ more-rubin1). Außerhalb der Liste: Nahe-Glan, Rhein-Selz, Pirmasens-Land, Westerburg, Wirges, Sprendlingen-Gensingen, Lauterecken-Wolfstein.
- Die Kunden (Westerwald, Wöllstein) nutzen more! rubin. Wahrscheinlich handelt es sich um eine CMS-Ausgabe der more!-rubin-Daten; der Hersteller der Website-Integration ist nicht belegt.
- Da die Seiten auf der eigenen Domain liegen, wären sie mit dem Website-Leser oder einem kleinen eigenen Leser lesbar. Die robots.txt muss vorher geprüft werden.
- Quellen: https://www.vgben.de/ratsinfo/sitzungstermin/hVfWxEDOV8bAfh2E/1-oeffentliche-konstituierende-sitzung-des-verbandsgemeinderates/, https://www.vg-lingenfeld.de/ratsinfo/gremium/pApTS16AhlcSxBeT/verbandsgemeinderat-lingenfeld/, https://www.woellstein.de/ratsinfo/sitzungstermin/QfofZpdo0N9I4PmX/23-sitzung-des-verbandsgemeinderates/, https://www.vg-westerburg.de/ratsinfo/gremium/aKAtSdeCT6hU_1NO/ortsgemeinderat-der-gemeinde-willmenrod/, https://www.pirmasens-land.de/ratsinfo/sitzungstermin/r5S6qvDYL73UEQ1H/14-sitzung-des-verbandsgemeinderates/, https://www.rhein-zeitung.de/region/aus-den-lokalredaktionen/westerwaelder-zeitung_artikel,-im-internet-ueber-ratssitzungen-informieren-verwaltungen-in-ganz-deutschland-nutzen-waeller-software-_arid,2415563.html

### 2.4 Amts- und Mitteilungsblätter (LINUS WITTICH)
- **ol.wittich.de („Onlinelesen“)** ist eine artikelweise Datenbank der Wittich-Titel. Die Adressen haben die Form `/titel/<nr>/ausgabe/<n>/<jahr>/artikel/<id>`, und jeder Artikel trägt eine Überschrift wie „Sitzung des Gemeinderates“, „Bekanntmachung Beschlüsse“ oder „Öffentliche Bekanntmachung“.
- Laut Wittich ist das Lesen meist kostenlos (die Gemeinde trägt die Kosten), das Archiv reicht 24 Monate zurück. Daneben gibt es PDF-ePaper unter `epaper.wittich.de/frontend/catalogs/<id>/1/pdf/complete.pdf`.
- Gefundene Titel der Liste:
  - 429 Bad Ems-Nassau
  - 437 Loreley
  - 744 Baumholder
  - 747 Herrstein-Rhaunen (Zuordnung aus dem Suchergebnis)
  - 138 Stadt Lebach (Saarland, Tagesordnung des Stadtrats 06.11.2025)
  - VG Lingenfeld (ePaper)
- Weitere Titel aus RP und dem Saarland sind indexiert, z. B. Grafschaft (Titel 02), Asbach (420) und Nohfelden (eigene PDFs).
- **Offen:** robots.txt und Nutzungsbedingungen von ol.wittich.de (Domain für uns gesperrt). Der redaktionelle Teil ist geschützt. Amtliche Bekanntmachungen sind als amtliche Werke nach § 5 UrhG frei, das Layout und die Datenbank aber nicht zwingend. Das Anbindungskonzept sagt bisher „nicht verfolgen ohne Vereinbarung“. Für **RP** ist Wittich trotzdem der stärkste Einzelhebel, weil ein VG-Amtsblatt alle Ortsgemeinden abdeckt.
- In Hessen ist mit dieser Suche kein Wittich-Titel belegt. Die hessischen Kommunen veröffentlichen eher auf der Website („Öffentliche Bekanntmachungen“, § 7 HGO) oder in der Tageszeitung.
- Quellen: https://www.wittich.de/produkte/zeitungen/zeitung-online-lesen, https://www.wittich.de/produkte/zeitungen/amtsblaetter, https://ol.wittich.de/titel/429, https://ol.wittich.de/titel/138/ausgabe/44/2025/artikel/00000000000050288322-OL-138-2025-44-44-0, https://ol.wittich.de/titel/744/ausgabe/11/2023/artikel/00000000000035846289-OL-744-2023-11-11-0, https://ol.wittich.de/titel/420/ausgabe/5/2023/artikel/00000000000035243823-OL-420-2023-5-5-0, https://www.wittich.de/produkte/zeitungen/437-infos-aus-der-verbandsgemeinde-loreley, https://epaper.wittich.de/frontend/catalogs/552675/1/pdf/complete.pdf

### 2.5 Gemeindewebsites mit Amtsblatt-PDF und Bekanntmachungen
- Nohfelden (SL) legt das wöchentliche Amtsblatt als PDF auf der eigenen Domain ab (`/wp-content/uploads/<jahr>/<monat>/Amtsblatt-KW-xx-<jahr>.pdf`).
- Marburg-Biedenkopf veröffentlicht Einladungen zu Kreistagssitzungen als „Öffentliche Bekanntmachung“ (`/bekanntmachungen/<jahr>/OEB_..._KT.php`), der Main-Taunus-Kreis seine Bekanntmachungen unter `mtk.org/Bekanntmachungen-469.htm`.
- Lebach nennt nur die Termine. Bad Homburg zeigt Gremien im Stadt-CMS und erzeugt Bekanntmachungs-PDFs (`/pdf-dokumente/announcements/generated/`).
- Quellen: https://www.nohfelden.de/wp-content/uploads/2024/02/Amtsblatt-KW-06-2024.pdf, https://www.marburg-biedenkopf.de/politik_und_gremien/bekanntmachungen.php, https://www.mtk.org/Bekanntmachungen-469.htm, https://www.lebach.de/lebach/die-stadt/stadtrat-fraktionen/stadtrat-fraktionen/, https://www.bad-homburg.de/en/city/politics/committees/city-council-meeting

### 2.6 Kreise
- Eine Kreisseite dokumentiert in keinem der drei Länder die Sitzungen der Gemeinden. Kreisseiten helfen nur für das Kreisgebiet selbst.
- Für die offenen Kreise sind Systeme belegt:
  - Mayen-Koblenz: SessionNet `ris.kvmyk.de/bi/`
  - Mainz-Bingen: ALLRIS 3 `landkreis-mainz-bingen.sitzung-online.de/bi/`
  - Alzey-Worms: more! rubin `alzey-worms.gremien.info`
  - Main-Taunus: Bürgerinfoportal auf mtk.org
  - Marburg-Biedenkopf: ratsinfomanagement.net
  - Lahn-Dill, Hochtaunus, Limburg-Weilburg, Hersfeld-Rotenburg: ekom21 (stehen schon als C in der Liste)
- Im Saarland ist der Landkreis St. Wendel angebunden (`ratsinformation.lkwnd.de`; Hinweis auf PROVOX `ratsinfoservice.de/ris/lkstwendel`), seine Gemeinden aber großteils nicht.
- Quellen: https://www.kvmyk.de/landkreis/politik/kreistagsinformationssystem/, Anhang B von `requirements/anbindungskonzept.md`, https://ratsinfoservice.de/ris/lkstwendel

### 2.7 Saarland im Einzelnen
- **St. Wendel (Stadt)**: SessionNet `biwnd.rznk.de` liegt auf demselben Server wie 9 angebundene Quellen und ist der stärkste Einzelkandidat.
- Die übrigen 15 Saar-Gebiete ohne Link sind alle eGo-Saar-Mitglieder: Wadgassen, Schwalbach, Rehlingen-Siersburg, Überherrn, Wallerfangen, Tholey, Mandelbachtal, Nohfelden, Nonnweiler, Freisen, Namborn, Weiskirchen, Gersheim, Oberthal, Lebach. Ob sie ALLRIS nutzen, ist nicht belegt. Zwei Adressformen lassen sich aber per DNS prüfen: `ratsinfo-<name>.sitzung-online.de` bzw. `<name>.sitzung-online.de` (sitzung-online.de steht nicht auf der Wildcard-Liste der README) und `bi<kürzel>.rznk.de`. Ob rznk.de Wildcard-DNS hat, ist unbekannt.
- Quellen: https://biwnd.rznk.de/info.php, https://biepp.rznk.de/infobi.php, https://ratsinfo-homburg.ego-saar.de/allris-public/kp020?0&KPLFDNR=469

## 3. Sammelplattformen

| Plattform | Inhalt | Lesbarkeit für Ratsmonitor |
|---|---|---|
| **poliscope.de** | Gibt an, über 4.500 RIS bzw. ≈90 % der Verwaltungseinheiten zu erfassen. Seiten je Gebiet nach Regionalschlüssel, z. B. `/ratsinformationssystem/marburg-biedenkopf/06534`, auch Eppstein (064360002002), Kiedrich (064390009), Selters (065330014), Fulda (83 Sitzungen in 6 Monaten); REST-API v2 und MCP | Kommerziell, API mit Anmeldung; Domain für uns gesperrt. Nicht als Quelle nutzen. Die Gebietsseiten **belegen aber, dass ein RIS existiert**, für Gebiete, die bei uns „kein Link“ haben (Eppstein, Kiedrich, Selters, Fulda, Marburg-Biedenkopf). Gut als Prüfliste. https://poliscope.de/ratsinformationssystem, https://docs.poliscope.de/api |
| **ol.wittich.de / epaper.wittich.de** | Amts- und Mitteilungsblätter der VG (RP) und der Gemeinden (SL, TH, ...), artikelweise | Inhaltlich ideal (Überschrift = Sitzung oder Beschluss, Gliederung nach Titel). robots.txt und Bedingungen ungeprüft; Anfrage beim Verlag empfohlen |
| **eGo-Saar** (ALLRIS über sitzung-online.de) | Plattform für alle Saar-Kommunen | Vorhandener ALLRIS-Leser; nur Mandanten fehlen |
| **rznk.de** | SessionNet für Neunkirchen, St. Wendel, Saarlouis u. a. | Vorhandener Leser |
| **rim.ekom21.de** | SD.NET für viele hessische Kommunen | Nur OParl, wo aktiviert |
| **gremien.info / more-rubin1.de** | more! rubin (RP sehr verbreitet, auch HE) | Vorhandener Leser; Wildcard-DNS, daher kein Raten |
| **ratsinfomanagement.net** | SD.NET (CC e-gov) | 403; OParl je Mandant teils aktiv |

## 4. Rechtslage (aus `website-leser-ideen.md`, nicht neu geprüft)

- **Hessen:** Nach § 58 Abs. 6 HGO werden Zeit, Ort und Tagesordnung vor der Sitzung öffentlich bekanntgemacht. Die Form regelt § 7 HGO mit der Hessischen Kommunalbekanntmachungsverordnung: Zeitung, Amtsblatt **oder Internet** nach der Hauptsatzung. Viele hessische Gemeinden haben deshalb eine Website-Rubrik „Öffentliche Bekanntmachungen“. Eine Pflicht, Niederschriften im Netz zu veröffentlichen, ist nicht belegt.
- **Rheinland-Pfalz:** Nach § 34 Abs. 6 GemO werden Sitzungen öffentlich bekanntgemacht. Die Form regeln § 27 GemO, §§ 7–10 GemODVO und die Hauptsatzung, in der Praxis das **Amtsblatt der Verbandsgemeinde**, auch für die Ortsgemeinden.
- **Saarland:** Nach § 41 Abs. 3 KSVG werden Sitzungen öffentlich bekanntgemacht, mindestens drei Tage vorher, im Eilfall einen Tag. Die Form ist nicht geprüft; in der Praxis Website und Amts- bzw. Wochenblatt.
- Quellen: https://www.anwalt24.de/gesetze/hgo/58, https://www.anwalt24.de/gesetze/hgo/7, https://www.anwalt24.de/gesetze/gemo-1/34, https://www.kommunalbrevier.de/kommunalbrevier/ratssitzung/einladung-oeffentlichkeit-tagesordnung/ii-oeffentlichkeit/4-oeffentliche-bekanntmachung/, https://www.anwalt24.de/gesetze/ksvg/41

## 5. Folgerungen für Ratsmonitor

**Sofort nutzbare Wege (vorhandene Leser, nur Adresse nachtragen und prüfen):**
1. St. Wendel: `biwnd.rznk.de` (SessionNet).
2. Kreise Alzey-Worms (`alzey-worms.gremien.info`, more! rubin), Mayen-Koblenz (`ris.kvmyk.de/bi/`, SessionNet) und Mainz-Bingen (ALLRIS 3, robots.txt prüfen).
3. ekom21-OParl: Königstein (sehr wahrscheinlich aktiv), Neu-Anspach erneut prüfen, Frankenberg (Eder) versuchen.
4. ratsinfomanagement.net-OParl: Fulda und Marburg-Biedenkopf, dazu die 10 Listengebiete „403 ratsinfomanagement.net“ (je eine Anfrage auf `/webservice/oparl/v1.1/system`).
5. Großkrotzenburg: Mandantenadresse von more! rubin von der Gemeindeseite ablesen.

**Mit kleinem Aufwand:**
6. Eingebettete Ratsinfo auf VG-Websites (Bad Ems-Nassau, Lingenfeld, Wöllstein): ein Leser für das Muster `/ratsinfo/sitzungstermin/…` oder den zugehörigen gremien.info-Mandanten ermitteln. Die übrigen RP-A-Gebiete sind wegen des Suchbudgets nicht geprüft und sollten vom Rechner des Inhabers auf dieses Muster getestet werden: Herrstein-Rhaunen, Loreley, Thaleischweiler-Wallhalben, Bellheim, Höhr-Grenzhausen, Göllheim, Deidesheim, Monsheim, Hagenbach, Baumholder, Thalfang, Bad Dürkheim, Budenheim.
7. Saarland: DNS-Prüfung auf `*.sitzung-online.de` und `bi*.rznk.de` für die 15 offenen Gemeinden.
8. Website-Leser für Bekanntmachungen und Amtsblatt-PDFs: Marburg-Biedenkopf, Main-Taunus, Nohfelden, Bad Homburg.

**Erst nach Vereinbarung:** Wittich Onlinelesen. Es würde fast alle RP-Verbandsgemeinden samt Ortsgemeinden und viele Saar-Gemeinden mit Tagesordnungen und Beschlüssen abdecken, ist aber nur mit Zustimmung des Verlags sauber nutzbar. Frankfurt (PARLIS, robots.txt) bleibt gesperrt.

**Schätzung erreichbarer Gebiete (grob):**
- Mit belegten Adressen und vorhandenen Lesern: ≈8–12 Gebiete. Das sind St. Wendel, 3 RP-Kreise, Königstein, Fulda und Marburg-Biedenkopf (falls OParl aktiv ist), Frankenberg, Großkrotzenburg und Neu-Anspach, zusammen ≈0,8–1,0 Mio. Einwohner, vor allem durch die Kreise und Fulda.
- Mit dem eingebetteten VG-Muster und DNS-Prüfung im Saarland zusätzlich ≈10–20 Gebiete.
- Ein Website-Leser für die Rubrik „Öffentliche Bekanntmachungen“ in Hessen bleibt der einzige breite Weg für die 208 hessischen A-Gebiete. Die Trefferquote ist unbekannt (Messlauf nach Anbindungskonzept 7.2).
- Mit einer Wittich-Vereinbarung wären die meisten der 18 RP-A-Gebiete und ein Teil der Saar-Gebiete erreichbar (≈15–25).

## 6. Offene Fragen

1. robots.txt und Nutzungsbedingungen von ol.wittich.de. Gibt es einen Feed oder eine Schnittstelle (meinOrt-App)? Eine Anfrage beim Verlag ist nötig.
2. Welches Produkt bzw. welcher Webdienstleister erzeugt die eingebetteten `/ratsinfo/`-Seiten in RP? Hängt ein gremien.info-Mandant dahinter? Wie lautet die robots.txt?
3. Ist OParl bei Königstein, Neu-Anspach und Frankenberg heute aktiv? Gilt das auch für die ratsinfomanagement.net-Mandanten Fulda und Marburg-Biedenkopf?
4. Hat rznk.de Wildcard-DNS, und wie heißen die Kürzel der Gemeinden im Kreis St. Wendel?
5. Welche hessischen Gemeinden geben ein Mitteilungsblatt über einen Verlag heraus (Wittich, andere)? Mit dieser Suche ist das nicht belegt.
6. Die poliscope-Gebietsseiten zeigen, dass ein RIS existiert, z. B. für Eppstein, Kiedrich und Selters (Taunus). Die Adresse des RIS muss vom Rechner des Inhabers abgelesen werden.
7. Die Rechtsangaben (HKBekV, GemODVO, Bekanntmachung nach KSVG) sollten mit frischem Suchbudget nachgeprüft werden.
