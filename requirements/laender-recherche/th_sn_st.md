# Thüringen, Sachsen, Sachsen-Anhalt: Wo kleine Kommunen ihre Sitzungen dokumentieren

Stand 05.10.2026. Grundlage: Arbeitsliste `th_sn_st.tsv` (435 offene Gebiete: TH 171, SN 205, ST 59), README.md („Bundesweiter Abruf“, „robots.txt“), `requirements/anbindungskonzept.md`, `requirements/website-leser-ideen.md`, Projektdateien `server/integrations/de-sources.json` und `source-robots.json` sowie rund 50 Websuchen. Kommunale Seiten, Verlagsplattformen (ol.wittich.de, epaper.wittich.de), poliscope.de und ratsinfo.kitu-genossenschaft.de waren aus der Umgebung nicht abrufbar (Proxy 403). Alle Aussagen über Inhalte stammen deshalb aus Suchtreffern, robots.txt dieser Plattformen ist **nicht geprüft**. Danach war das Suchkontingent der Sitzung aufgebraucht, deshalb fehlen Einzelprüfungen in Sachsen (siehe offene Fragen).

## Kurzfassung

- **Kreisseiten helfen kaum.** In keinem der drei Länder wurde ein Landkreis-RIS gefunden, das die Sitzungen der kreisangehörigen Gemeinden mitführt. Das gilt auch für den Kyffhäuserkreis (`bi.lrakyf.de`), dessen Gremienliste nur geprüft werden müsste, weil die Quellensuche es Artern zugeordnet hat. Die Amtsblätter der Landkreise enthalten Kreistagsthemen, keine Gemeinderatssitzungen.
- **Verwaltungsgemeinschaft und Verbandsgemeinde sind die richtige Ebene.** Die Bekanntmachungen der Mitgliedsgemeinden laufen über das Amtsblatt bzw. die Website der VG (TH, SN) oder der Verbandsgemeinde (ST). Auch ein RIS ist, wo vorhanden, meist eines der VG.
- **Thüringen: das Amtsblatt der VG kommt fast immer von LINUS WITTICH (Langewiesen).** Für 20 der 37 offenen TH-VG ohne Link ist ein Wittich-Titel belegt, gesucht wurde nur nach einem Teil. Wittich stellt die Blätter artikelweise mit Überschrift online (`ol.wittich.de/titel/<nr>/…/artikel/…`, z. B. „Beschlüsse der 32. Gemeinderatssitzung der Gemeinde Schmiedehausen“) und als vollständiges PDF (`epaper.wittich.de/frontend/catalogs/<id>/1/pdf/complete.pdf`). Damit steht die Thüringer Pflicht, Beschlüsse bekanntzumachen, gut erreichbar im Netz. Nutzbar ist das aber nur mit Zustimmung des Verlags.
- **Sachsen-Anhalt: KITU-SessionNet und komfa.** Drei neue Mandanten auf `ratsinfo.kitu-genossenschaft.de` sind belegt (Elbe-Heide, Teutschenthal, Sülzetal `_bi`). Die übrigen 14 KITU-Mandanten im Bestand haben robots „erlaubt“ und werden schon gelesen. Zwei weitere Gebiete stehen auf komfa (Goldene Aue, Harzgerode); dafür gibt es noch keinen Leser.
- **Sachsen: kaum Sammelstellen.** KISA ist im Bestand schon breit angebunden (59 Mandanten). Die übrigen sächsischen Systeme sperren Programme aus: kommune-aktiv und ratsinfomanagement.net antworten mit 403, RIS-Portal sperrt per robots.txt. Die Amtsblätter druckt im Erzgebirge, in Mittelsachsen und im Vogtland überwiegend Riedel (Lichtenau), digital gibt es sie dort nur auf Anfrage per E-Mail. Für die 155 sächsischen Gebiete ohne Link bleibt praktisch nur die eigene Website (Website-Leser), weil die KomBekVO die elektronische Bekanntmachung zulässt.
- **37 belegte Kandidaten für 34 Gebiete**, siehe `th_sn_st-kandidaten.json`.

## 1. Struktur

| Land | Gemeindeverband | Wer führt die Sitzungen kleiner Gemeinden | Offene Gebiete (Liste) |
|---|---|---|---|
| Thüringen | Verwaltungsgemeinschaft (VG) mit Gemeinschaftsversammlung; erfüllende Gemeinde nach § 51 ThürKO (mind. 3.000 Einwohner, hauptamtlicher Bürgermeister); Landgemeinden | Jede Mitgliedsgemeinde behält ihren Gemeinderat und ihren eigenen Wirkungskreis. Die VG bzw. die erfüllende Gemeinde erledigt den Sitzungsdienst und gibt das Amtsblatt heraus. Laut Landesstatistik 601 Städte und Gemeinden, davon die in 69 VG zusammengefassten; eine andere Quelle nennt 42 VG mit 365 Mitgliedern (verschiedene Stichtage). | 171: 40 VG (37 ohne Link), 32 erfüllende Gemeinden, 35 Gemeinden, 55 Städte, 9 Kreise; 127 ohne Link |
| Sachsen | Verwaltungsgemeinschaft (erfüllende Gemeinde erledigt die Aufgaben) und Verwaltungsverband (Verbandsversammlung) | Mitgliedsgemeinden mit eigenem Gemeinderat. Sitzungsdienst und Amtsblatt liegen meist bei der erfüllenden Gemeinde, die Amtsblätter erscheinen oft gemeinsam für die VG. | 205: 41 VG, 5 Verwaltungsverbände, 98 Gemeinden, 59 Städte, 2 Kreise; 155 ohne Link |
| Sachsen-Anhalt | Verbandsgemeinde (eigener Verbandsgemeinderat) neben Einheitsgemeinden | Mitgliedsgemeinden der Verbandsgemeinde mit eigenem Gemeinderat. Die Verbandsgemeinde führt Sitzungsdienst, RIS und Amtsblatt für alle. | 59: 13 Verbandsgemeinden, 36 Städte, 7 Gemeinden, 3 Kreise; 34 ohne Link |

IT-Dienstleister und Produkte:
- **TH:** KIV Thüringen GmbH bietet den REGISAFE-Sitzungsdienst mit Ratsinformation an. Das erklärt, warum in Thüringen so oft `*.ris-portal.de` vorkommt (26 Gebiete in der Liste, robots-gesperrt). Dazu ALLRIS über ratsinfo-online, ratsinfomanagement.net und More! Rubin.
- **SN:** KISA (More! Rubin, `ris-<name>.zv-kisa.de`), Lecos/SAKD/Komm24 vor allem für die Großstädte, kommune-aktiv (`<name>.ris.kommune-aktiv.de`), ratsinfomanagement.net, RIS-Portal.
- **ST:** KITU eG (SessionNet `ratsinfo.kitu-genossenschaft.de/<kürzel>_bi/`; über 100 Mitglieder, darunter die Verbandsgemeinden Arneburg-Goldbeck, Beetzendorf-Diesdorf, Elbe-Havel-Land, Goldene Aue, Obere Aller, Seehausen), ALLRIS über ratsinfo-online, komfa.

Quellen: https://statistik.thueringen.de/datenbank/auflistungVG.asp, https://www.anwalt24.de/gesetze/thuerkwo/51, https://en.wikipedia.org/wiki/Municipal_associations_in_Thuringia, https://portal.kiv-thueringen.de/web/loesungen/sitzungsdienst/, https://portal.kiv-thueringen.de/web/veranstaltungen/regisafe-sitzungsdienst/, https://kisa.it/de/sitzungsmanagement/rats-und-buergerinfosystem.html, https://www.lecos.de/unternehmen/meilensteine/, https://www.komm24.de/, https://www.kitu-genossenschaft.de/Das-sind-wir-/Mitglieder/, https://www.kommune-aktiv.de/seite/sm/internetsoftware/046/-/Ratsinformationssystem.html

## 2. Wo Sitzungen dokumentiert sind

### 2.1 Rechtslage (was es geben muss)

| | Einladung / Tagesordnung | Beschlüsse | Niederschrift | Internet als Bekanntmachungsform |
|---|---|---|---|---|
| TH | § 35 ThürKO: ortsüblich bekanntmachen, mind. 4 Tage vorher | **§ 40 Abs. 2 ThürKO: Beschlüsse öffentlicher Sitzungen alsbald ortsüblich bekanntmachen** | § 42 Abs. 3 ThürKO: Einsicht für Bürger in der Verwaltung. Das Innenministerium hält die Vorschrift für abschließend, deshalb lehnen manche Gemeinden die Veröffentlichung im Netz ab (TLfDI). | ThürBekVO, novelliert und seit 26.08.2023 in Kraft: Satzungen dürfen ausschließlich im Internet bekanntgemacht werden, die Form regelt die Hauptsatzung (§ 21 ThürKO). Drs. 7/5553 beschreibt die Bekanntmachungsformen der Kommunen. |
| SN | § 36 SächsGemO: rechtzeitig ortsüblich | § 37: nichtöffentlich gefasste Beschlüsse werden in öffentlicher Sitzung bekanntgegeben | § 40: Einsicht in Niederschriften öffentlicher Sitzungen | KomBekVO: elektronische Bekanntmachung nach § 4 SächsEGovG zulässig; Bekanntmachung mit Ablauf des Tages der Bereitstellung im Internet vollendet. Beispiele: Landkreis Zwickau und Gornsdorf (elektronisches Amtsblatt auf der Homepage). |
| ST | § 53 Abs. 4 KVG LSA: Zeit, Ort und Tagesordnung ortsüblich bekanntmachen (laut Geschäftsordnungen mind. 3 Kalendertage vorher, mit Raum). Einige Quellen nennen § 52 Abs. 4, die Absatznummer ist nicht am Gesetzestext geprüft. | keine allgemeine Bekanntmachungspflicht gefunden | § 58 KVG LSA: Niederschrift mit Anträgen, Beschlüssen und Abstimmungsergebnissen, binnen 30 Tagen; Einsicht für Einwohner in Niederschriften öffentlicher Sitzungen | § 9 KVG LSA: Aushang, Amtsblatt, Zeitung **oder Internet**, Festlegung in der Hauptsatzung |

Folgerung: In allen drei Ländern müssen Einladungen mit Tagesordnung ortsüblich erscheinen, also im Amtsblatt der VG oder der Verbandsgemeinde, im Schaukasten oder auf der Website. Nur Thüringen verlangt zusätzlich, die Beschlüsse bekanntzumachen. Diese Beschlussbekanntmachungen stehen sichtbar im Wittich-Onlinelesen (Beispiel unten).

Quellen: https://www.anwalt24.de/gesetze/thuerko/35, https://www.anwalt24.de/gesetze/thuerko/40, https://www.lexsoft.de/cgi-bin/lexsoft/justizportal_nrw.cgi?xid=149084,43, https://tlfdi.de/fileadmin/tlfdi/info/Veroeffentlichungen_nach_dem_ThuerTG/1/Anlage2_Auszug_2.TB_ThuerTG.pdf, https://media.frag-den-staat.de/files/foi/970207/rundschreibennachnovellierungthrbekvo.pdf, https://parldok.thueringer-landtag.de/ParlDok/dokument/87107/bekanntmachungsformen_in_den_thueringer_kommunen.pdf, https://www.anwalt24.de/gesetze/thuerko/21, https://www.revosax.sachsen.de/vorschrift/2754-Saechsische-Gemeindeordnung, https://www.revosax.sachsen.de/vorschrift/16777-Kommunalbekanntmachungsverordnung, https://www.landkreis-zwickau.de/uploads/formulare/BekanntmachungssatzungLandkreisZwickau2021-12-16_741_1.pdf, https://www.anwalt24.de/gesetze/kvg_lsa/9, http://www.anwalt24.de/rund-ums-recht/Paragraph_52_KVG_LSA_Oeffentlichkeit_der_Sitzungen-d7093763,53.html, https://www.quedlinburg.de/PDF/Gesch%C3%A4ftsordnung.PDF?ObjSvrID=3771&ObjID=2518&ObjLa=1&Ext=PDF&WTR=1&_ts=1733226075, https://www.lexaris.de/book/version/documentflat/head/1311033, https://informationsfreiheit.sachsen-anhalt.de/informationen/taetigkeitsberichte/tb-2/6-haeufige-fragestellungen/68-izg-lsa-und-kommunalrecht/681-zugang-zu-sitzungsunterlagen

### 2.2 Landkreise

- **Kein Kreis-RIS mit Gemeindegremien gefunden.** Der Kyffhäuserkreis (`https://bi.lrakyf.de/`, SessionNet, im Bestand mit 28 Berichten, robots „keine“) ist der Fall, bei dem die Quellensuche eine Gemeinde (Erfüllende Gemeinde Artern, Kategorie F) auf das Kreissystem verwies. Die Websuche fand keinen Beleg, dass dort Gremien von Artern geführt werden. Wahrscheinlicher ist ein Link von der Artern-Website auf das Kreis-RIS. Klärt sich mit einem Blick in die Gremienliste.
- **Kreis-Amtsblätter** (z. B. Landkreis Sömmerda und Saale-Orla-Kreis, beide bei Wittich, Titel 1771 und 1758; Erzgebirgskreis) enthalten Kreisangelegenheiten, keine Gemeinderatssitzungen. Für Gemeinden ohne RIS sind sie kein Ersatz.
- **Landesportale:** Der Thüringer Zuständigkeitsfinder, Amt24 Sachsen und das Organisationsportal `include-st.zfinder.de` liefern Behördendaten (Adressen, Organigramme), keine Sitzungen. Nützlich als Wegweiser ist die Liste der Gemeinde-Internetadressen je Kreis beim TLS (`https://statistik.thueringen.de/datenbank/adressenGemeinden.asp?krs=65`). Auf den Open-Data-Portalen der drei Länder wurden in der Suche keine Sitzungsdaten kleiner Gemeinden gefunden (nur mit wenigen Suchen geprüft).

### 2.3 Amtsblätter der VG und ihre Verlage

**LINUS WITTICH Medien KG, Langewiesen (TH, auch ST).** Belegte Titel für offene Gebiete (Produktseite `wittich.de/produkte/zeitungen/<nr>-…`; die Titelnummer ist auf `ol.wittich.de/titel/<nr>` dieselbe):

| Gebiet (ID) | Titel | Nr. |
|---|---|---|
| VG Dornburg-Camburg (de-160745015) | Amtsblatt der Verwaltungsgemeinschaft | 1629 |
| VG Südliches Saaletal (de-160745011) | Amtsblatt VG „Südliches Saaletal“ | 1753 |
| VG Schiefergebirge (de-160735005) | Amtsblatt der VG Schiefergebirge | 1740 |
| VG Ranis-Ziegenrück (de-160755013) | Amtsblatt der VG Ranis-Ziegenrück | 1747 |
| VG Seenplatte (de-160755004) | Amtsblatt der VG Seenplatte | 1737 |
| VG Triptis (de-160755011) | Amtsblatt der VG Triptis (ePaper; Seite triptis.de/amtsblatt) | – |
| VG Hohe Rhön (de-160665005) | Rhöner Nachrichten | 1695 |
| VG Dolmar-Salzbrücke (de-160665014) | VG Dolmar-Salzbrücke | 1769 |
| VG Hainich-Werratal (de-160635006) + Stadt Treffurt (de-16063076) | Werratal Bote | 1630 |
| VG Gramme-Vippach (de-160685012) | Amtsblatt der VG Gramme-Vippach | 1763 |
| VG Heideland-Elstertal-Schkölen (de-160745005) | Amtsblatt der VG Heideland-Elstertal | 1631 |
| VG Straußfurt (de-160685009) | Amtsblatt der VG Straußfurt | 1777 |
| VG Bad Tennstedt (de-160645001) | Amtliches Mitteilungsblatt | 1611 |
| VG Fahner Höhe (de-160675012) | „Fahner Höhe“ Kurier | 1788 |
| VG Nesseaue (de-160675007) | Amtsblatt der VG „Nesseaue“ | 1655 |
| VG Eichsfeld-Wipperaue (de-160615006) | Amtsblatt der VG „Eichsfeld-Wipperaue“ | 1627 |
| VG Ershausen/Geismar (de-160615014) | Südeichsfeld Bote (Zuordnung prüfen) | 1646 |
| VG Heldburger Unterland (de-160695004) | Amts- und Mitteilungsblatt | 1675 |
| VG Riechheimer Berg (de-160705009) | Amts- und Nachrichtenblatt | 1697 |
| VG Geratal/Plaue (de-160705002) | Geratal-Anzeiger | 1661 |
| VG Schwarzatal (de-160735012, hat RIS-Portal) | Amtsblatt der VG „Schwarzatal“ | 1733 |
| VG Beetzendorf-Diesdorf (ST, de-150815051) | Amtsblatt (Onlinelesen) | 5323 |

Genannt, aber ohne belegte Adresse: Hanstein-Rusteberg („Kurier“), Leinetal („Leinetalbote“), Westerwald-Obereichsfeld („Obereichsfelder Heimatbote“), Wasungen-Amt Sand (nur ein yumpu-Spiegel). Wittich führt außerdem Blätter von Landgemeinden (z. B. Grammetalbote, 1690).

Was die Plattform liefert (aus Suchtreffern):
- **Onlinelesen (`ol.wittich.de`)**: jeder Beitrag als eigene Seite mit Überschrift, Ausgabe und Rubrik. Belegte Überschriften sind etwa „Beschlüsse der 32. Gemeinderatssitzung der Gemeinde Schmiedehausen am 03.05.2023“ (Titel 1610), „Bericht zur Sitzung des Gemeinderates vom 07. September 2023“, „Niederschrift aus der Gemeinderatssitzung vom 26.04.2023 …“ und „Hauptsatzung“. Inhaltsverzeichnis je Ausgabe unter `…/rubrik/alle/seite/0/sortiert/inhaltsverzeichnis`. **Gesamtliste aller Titel nach PLZ: `https://ol.wittich.de/uebersicht`**, also eine fertige Liste zum Zuordnen der Titel zu den Gebieten. Laut `website-leser-ideen.md` bleibt das Archiv 24 Monate.
- **ePaper (`epaper.wittich.de/frontend/catalogs/<id>/1/pdf/complete.pdf`)**: ganze Ausgabe als PDF, offenbar ohne Anmeldung, weil Suchmaschinen sie indexieren.
- Rechtlich: Der amtliche Teil ist nach § 5 UrhG gemeinfrei. Die Plattform ist aber eine Datenbank des Verlags (§ 87b UrhG), robots.txt und Nutzungsbedingungen sind nicht geprüft. Wie im Anbindungskonzept also nur mit Vereinbarung. Ein Brief an einen einzigen Verlag würde dafür einen großen Teil der Thüringer VG abdecken.

**Riedel Verlag & Druck KG, Lichtenau (SN).** Zeigt aktuelle Ausgaben vieler Amtsblätter im Erzgebirge und in Mittelsachsen (Altenberg, Auerbach, Drebach, Zschorlau u. a.). Die digitale Ausgabe gibt es kostenlos, aber **nur per E-Mail-Link auf Anfrage**. Ein öffentliches Archiv ist nicht belegt, als Quelle ist Riedel deshalb ungeeignet. Viele Gemeinden stellen das Riedel-Blatt aber selbst als PDF auf ihre Website (Beispiele Klingenberg, Eibenstock, Glashütte, Nünchritz), und dieses PDF kann der Website-Leser lesen. Die Chemnitzer Zeitung „Blick“ führt eine Übersicht von Amtsblättern (`https://www.blick.de/service/amtsblaetter`), nicht geprüft.

Quellen: https://www.wittich.de/produkte/zeitungen, https://www.wittich.de/produkte/zeitungen/amtsblaetter, https://ol.wittich.de/uebersicht, https://ol.wittich.de/titel/1610/ausgabe/7/2023/artikel/00000000000037610379-OL-1610-2023-29-7-0, https://ol.wittich.de/titel/415/ausgabe/43/2023/artikel/00000000000038951868-OL-415-2023-43-43-0, https://ol.wittich.de/titel/2055/ausgabe/9/2023/artikel/00000000000036579267-OL-2055-2023-18-9-0, https://ol.wittich.de/titel/1753/ausgabe/11/2023/rubrik/alle/seite/0/sortiert/inhaltsverzeichnis, https://epaper.wittich.de/frontend/catalogs/501498/1/pdf/complete.pdf, https://www.riedel-verlag.de/de/aktuelle-ausgaben, https://www.gemeinde-klingenberg.de/amtsblatt/index.php, https://www.eibenstock.de/deutsch/buerger/buergerservice/amtsblatt/, https://www.glashuette-sachs.de/de/amtsblatt.html, https://www.nuenchritz.de/de/datei/download/id/12691,27/nnn_06_vom_19.03.2025.pdf

### 2.4 RIS der VG / Verbandsgemeinde und Kleinanbieter

- **KITU (ST)**: SessionNet für Verbandsgemeinden und Einheitsgemeinden. Im Bestand sind 14 Mandanten mit robots „erlaubt“ (Gardelegen, Haldensleben, Wethautal …). Neu belegt: `elbeheide_bi` (VG Elbe-Heide, Verbandsgemeinderat WP 2024–2029), `teutschenthal_bi` (Sitzung 17393), `suelze_bi` (öffentlicher Teil neben dem gefundenen Anmeldebereich `suelze_ri`). Saale-Wipper, Biederitz und Arneburg-Goldbeck stehen schon mit KITU-Adresse in der Liste (Kategorie E/F). Bei Biederitz wurde nur der Anmeldebereich `biederitz_ri/ylogon.asp` gefunden, die Prüfregel „ylogon → öffentlicher Teil daneben“ sollte `biederitz_bi` finden. Warum Saale-Wipper und Arneburg-Goldbeck nicht gelesen wurden, ist offen.
- **komfa / Kommunalfabrik (`ris-<name>.komfa.de`, „komfaris“)**: Terminlisten öffentlich. In der Liste stehen Delitzsch, Raguhn-Jeßnitz und Aken (alle „Unbekanntes System“), neu belegt sind Goldene Aue (VG mit 5 Mitgliedsgemeinden) und Harzgerode. Weitere Mandanten in BB/MV: Brück, Kremmen, Wustermark, Groß Pankow, Unterspreewald, Woldegk, Putlitz-Berge. Damit stehen etwa 12 Gebiete auf einer einzigen Plattform, mehr als die 5 im Anbindungskonzept (DE21).
- **Mandatos (SOMACOS)**: VG Beetzendorf-Diesdorf verlinkt auf ihrer Website ein „Bürger- und Ratsinformationssystem / Sitzungskalender“ auf Mandatos-Basis. Die Adresse des Systems selbst ist nicht belegt.
- **KISA (SN)**: 59 Mandanten im Bestand. Zwei Gebiete der Liste haben KISA-Adressen, sind aber als „Unbekanntes System“ geführt (Wilsdruff, Priestewitz). Vermutlich ein Erkennungsfehler, der Leser existiert.
- **ris-portal.de (regisafe/KIV, TH)** und **kommune-aktiv, ratsinfomanagement.net (SN)**: Mandanten der VG sind zu finden (z. B. `vg-schwarzatal.ris-portal.de` für 10 Gemeinden, `vg-kranichfeld.ris-portal.de`, `scheibenberg.ris.kommune-aktiv.de`), aber gesperrt (robots bzw. 403). Hier entscheidet die robots-Frage des Projekts, nicht die Suche.

Quellen: https://ratsinfo.kitu-genossenschaft.de/elbeheide_bi/kp0040.asp?__kgrnr=1, https://www.server-lesen.de/kitu/verbandsgemeinde-elbe-heide-ist-neu-in-der-kitu.html, https://ratsinfo.kitu-genossenschaft.de/teutschenthal_bi/si0056.asp?__ksinr=17393, https://ratsinfo.kitu-genossenschaft.de/suelze_bi/si0042.asp, https://ris-goldene-aue.komfa.de/, https://ris-harzgerode.komfa.de/, https://ris-delitzsch.komfa.de/, https://ris-brueck.komfa.de/index.php, https://www.webwiki.de/komfa.de, https://www.beetzendorf-diesdorf.de/seite/689140/b%C3%BCrger-und-ratsinformationssystem-sitzungskalender.html, https://ris-nuenchritz.zv-kisa.de/, https://www.gemeinde-lichtenau.de/ratsinformationssystem.html

### 2.5 Eigene Websites (Bekanntmachungsseiten)

Belegt sind Seiten für amtliche Bekanntmachungen bei VG Obere Aller, VG Elbe-Heide (Sitzungsbekanntmachungen der Gemeinderäte Colbitz, Zielitz, Westheide …), Gemeinde Floh-Seligenthal, VG Triptis, Bad Tennstedt, Gramme-Vippach, Eichsfeld-Wipperaue und Dolmar-Salzbrücke (die letzten fünf jeweils mit Amtsblatt-Seite), außerdem bei der erfüllenden Gemeinde Artern (Amtsblatt-PDF für Artern und die Mitgliedsgemeinden). Das ist der Weg des vorhandenen Website-Lesers. Auf sächsischen Seiten fand die Suche vor allem Amtsblatt-PDFs, viele vom Riedel-Verlag.

## 3. Sammelplattformen

| Plattform | Reichweite in TH/SN/ST | Lesbarkeit | Bewertung |
|---|---|---|---|
| **ol.wittich.de / epaper.wittich.de** | Großer Teil der Thüringer VG; einzelne Verbandsgemeinden in ST (Titel 5323) | HTML je Beitrag mit Überschrift; PDF je Ausgabe; Titelliste nach PLZ | stärkster Hebel für TH; nur mit Verlagszustimmung (Datenbankrecht, robots ungeprüft); im Anbindungskonzept bisher „nicht verfolgen ohne Vereinbarung“, jetzt mit konkreter Zahl begründbar |
| **poliscope.de** | Bundesweit nach eigener Angabe 4.500 RIS, auch die VG Seehausen (Altmark) mit Schlüssel 150905053 und die VG Schwarzatal; Seiten je amtlichem Gemeindeschlüssel | kommerziell, liest offenbar auch Systeme, die robots-gesperrt sind | als Verzeichnis nützlich, um herauszufinden, **ob** ein Gebiet ein RIS hat; Inhalte nur mit Zustimmung (Anbindungskonzept A15) |
| **ratsinfo.kitu-genossenschaft.de** | über 100 KITU-Mitglieder in ST | SessionNet, robots „erlaubt“ | lesbar; neue Mandanten über DNS nicht zu raten (Pfad statt Subdomain), aber über Mitgliederliste + Kürzelmuster `<kürzel>_bi` |
| **komfa.de** | ca. 5 Gebiete in SN/ST, weitere 7 in BB/MV | öffentliche Terminliste, HTML | Leser oder OParl-Anfrage lohnt sich jetzt eher (ca. 12 Gebiete) |
| **zv-kisa.de** | SN | More! Rubin api.php | schon angebunden |
| Riedel Verlag | SN (Erzgebirge, Mittelsachsen) | digitale Ausgabe nur per E-Mail | ungeeignet |
| Landesportale (Zuständigkeitsfinder TH, Amt24 SN, zfinder ST), Open Data | – | keine Sitzungsdaten | nur Wegweiser (Adressen) |

Quellen: https://poliscope.de/, https://poliscope.de/ratsinformationssystem/seehausen-altmark-/150905053, https://poliscope.de/ratsinformationssystem/schwarzatal/160735012, https://www.kitu-genossenschaft.de/Das-sind-wir-/Mitglieder/, http://include-st.zfinder.de/119102464

## 4. Folgerungen für Ratsmonitor

**Sofort nutzbar, ohne Dritte (Code oder Prüfregel):**
1. **KITU-Mandanten nachtragen:** Elbe-Heide, Teutschenthal, Sülzetal (`_bi`) sowie Biederitz über die ylogon-Regel. Saale-Wipper und Arneburg-Goldbeck neu prüfen. Der Leser ist vorhanden, robots erlaubt. **3–6 Gebiete in ST.** Zusätzlich bei jedem KITU-Mitglied ohne Quelle das Muster `ratsinfo.kitu-genossenschaft.de/<kürzel>_bi/info.asp` aus den Websuchtreffern ableiten. Die Mitgliederliste nennt auch Obere Aller, Seehausen und Elbe-Havel-Land, deren Kürzel unbekannt sind.
2. **KISA-Erkennung** für Wilsdruff und Priestewitz prüfen: **2 Gebiete in SN**.
3. **komfa-Leser** (einfache Terminliste) oder OParl-Anfrage beim Hersteller: Delitzsch, Raguhn-Jeßnitz, Aken, Goldene Aue, Harzgerode, dazu 7 Gebiete in BB/MV. **5 Gebiete hier, etwa 12 bundesweit.**
4. **Website-Leser** für die VG-, Verbandsgemeinde- und Gemeindeseiten mit Bekanntmachungs- oder Amtsblatt-Seite (Kandidaten in der JSON). In Sachsen ist das wegen der KomBekVO und der vielen selbst eingestellten Amtsblatt-PDFs der Hauptweg. In Thüringen liefert er zusätzlich Beschlüsse (§ 40 Abs. 2 ThürKO). Viele Amtsblätter sind Druck-PDFs, mehrspaltig, teils mit Bildern, darum braucht der Leser eine gute Textextraktion.
5. **VG-Zuordnung:** Ein Amtsblatt oder RIS der VG deckt **alle** Mitgliedsgemeinden ab. Im Katalog zählt die VG als ein Gebiet, die Berichte müssen aber den Mitgliedsgemeinden zugeordnet werden.

**Nur mit Zustimmung:**
6. **LINUS WITTICH** anfragen (Feed oder Erlaubnis für ol.wittich.de, Titelliste `ol.wittich.de/uebersicht`). Belegt sind 20 TH-Gebiete und 1 ST-Gebiet. Hochgerechnet auf alle Thüringer VG und Landgemeinden mit Wittich-Blatt: **etwa 50–90 TH-Gebiete, dazu einzelne in ST.** Bei Zusage wäre das der größte einzelne Zuwachs in den drei Ländern.
7. **poliscope** nur als Verzeichnis (Existenzprüfung) mit Zustimmung.
8. **RIS-Portal/regisafe (KIV Thüringen) und kommune-aktiv / ratsinfomanagement.net:** Entscheidung zu robots.txt bzw. Betreiberbrief, betrifft in der Liste etwa 30 TH- und etwa 30 SN-Gebiete. Für Thüringen könnte die KIV als Landesdienstleister der richtige Adressat sein.

**Schätzung der erreichbaren Gebiete (von 435):**

| Weg | TH | SN | ST |
|---|---|---|---|
| KITU / KISA / komfa (Code, Prüfregel) | 0 | 2–3 | 6–10 |
| Website-Leser (eigene Seiten, sofern robots erlaubt und Text lesbar) | 30–50 | 40–70 | 10–15 |
| Wittich mit Zustimmung (überschneidet sich teils mit dem Website-Leser) | 50–90 | 0–5 | 2–5 |
| robots-/403-Plattformen mit Zustimmung | 25–30 | 25–35 | 5–8 |

Ohne Dritte also etwa **90–150 Gebiete**, überwiegend über den Website-Leser, dessen Trefferquote noch ungemessen ist. Mit Wittich- und Betreiberzusagen wären es **etwa 200–280**. Das sind begründete Schätzungen, keine Messungen.

## 5. Offene Fragen

1. robots.txt und Nutzungsbedingungen von `ol.wittich.de`, `epaper.wittich.de`, `ris-*.komfa.de` und `poliscope.de` sind ungeprüft (aus der Umgebung nicht abrufbar).
2. Führt `bi.lrakyf.de` Gremien von Artern oder anderen Gemeinden des Kyffhäuserkreises? Gremienliste ansehen.
3. Führen die RIS der Verbandsgemeinden (KITU: Elbe-Heide, Saale-Wipper, Arneburg-Goldbeck; komfa: Goldene Aue) auch die Gemeinderäte der Mitgliedsgemeinden?
4. Wie viele der 37 TH-VG und 24 erfüllenden Gemeinden ohne Link haben einen Wittich-Titel? `ol.wittich.de/uebersicht` mit den PLZ der Gebiete abgleichen. Ebenso offen: Wie viele sächsische Gemeinden haben ein Wittich- statt eines Riedel-Blatts?
5. In Sachsen war wegen des aufgebrauchten Suchkontingents keine Einzelprüfung der großen Gebiete ohne Link möglich (Chemnitz, VG Rund um den Auersberg, Naunhof, Burgstädt, Zschopau, Oelsnitz/Vogtl., Auerbach/Vogtl., Oschatz). Für Chemnitz ist ein eigenes RIS sehr wahrscheinlich; es sollte vor allen anderen gesucht werden.
6. KITU-Kürzel der übrigen Mitglieder (Obere Aller, Seehausen, Elbe-Havel-Land, An der Finne, Egelner Mulde …) sind unbekannt. Wahrscheinlich haben nicht alle ein öffentliches SessionNet.
7. Absatz der Bekanntmachungspflicht im KVG LSA (§ 52 Abs. 4 oder § 53 Abs. 4) am amtlichen Text prüfen.
8. Rechtliche Frage für Wittich: Reicht § 5 UrhG für den amtlichen Teil, wenn er aus einer Verlagsdatenbank entnommen wird (§ 87b UrhG)? Bis zur Klärung nur mit Vereinbarung.
