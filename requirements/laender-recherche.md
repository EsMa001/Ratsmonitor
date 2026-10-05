# Wo kleine Kommunen ihre Sitzungen dokumentieren: Recherche je Land

Stand 05.10.2026. Grundlage: sechs Recherchen über die 3.232 offenen Gebiete, getrennt nach Ländergruppen. Die Einzelberichte mit allen Quellen stehen in [laender-recherche/](laender-recherche/): Bayern (`by.md`), Baden-Württemberg (`bw.md`), Hessen, Rheinland-Pfalz und Saarland (`he_rp_sl.md`), Thüringen, Sachsen und Sachsen-Anhalt (`th_sn_st.md`), Brandenburg, Mecklenburg-Vorpommern und Schleswig-Holstein (`bb_mv_sh.md`), Niedersachsen, NRW und die Stadtstaaten (`ni_nw_stadt.md`).

**Grenzen der Recherche.** Gearbeitet wurde nur mit Suchtreffern; die Cloud-Umgebung erreicht keine kommunalen Server. Das gemeinsame Suchkontingent der Sitzung (200 Suchen) war nach rund 30 Suchen je Gruppe aufgebraucht. Die Funde sind deshalb Stichproben, keine Vollerhebung. Rechtsangaben stammen teils aus `requirements/website-leser-ideen.md` und sind dort, wo vermerkt, nicht am Gesetzestext nachgeprüft. Alle Zahlen zu erreichbaren Gebieten sind Schätzungen der Rechercheure.

## Kernbefund

1. **Kreise dokumentieren die Sitzungen ihrer Gemeinden nicht.** In keinem Land fand sich ein Landkreis-RIS, das Gemeinderäte mitführt. Kreisamtsblätter enthalten Kreis- und Zweckverbandssachen, keine Gemeinderatssitzungen. Ausnahmen sind Einzelfälle (Landkreis Göttingen hostet SessionNet für einige Gemeinden; der Landkreis Cham hat Seiten je Gemeinde mit Gremien und Satzungen, Sitzungen dort unbelegt).
2. **Die tragende Ebene ist der Gemeindeverband.** Verwaltungsgemeinschaft (Bayern, Thüringen, Sachsen), Amt (Brandenburg, Mecklenburg-Vorpommern, Schleswig-Holstein), Verbandsgemeinde (Rheinland-Pfalz, Sachsen-Anhalt), Samtgemeinde (Niedersachsen) und in Baden-Württemberg der Gemeindeverwaltungsverband führen die Sitzungen der Mitgliedsgemeinden. Hat der Verband ein RIS, ein Amtsblatt oder eine Bekanntmachungsseite, sind alle Mitglieder abgedeckt. Im Katalog ist der Verband meist schon das Gebiet; nur in Baden-Württemberg ist jede Gemeinde ein eigenes Gebiet, dort braucht ein gemeinsames System die Zuordnung „Gemeinderat <Ort>“ → Gebiet.
3. **Die Suche übersieht Systeme, die die Website nicht verlinkt.** Mehrere Dutzend offene Gebiete haben ein lesbares RIS auf einer Plattform mit erlaubter robots.txt: SessionNet bei digitalfabriX (Bayern, 10 belegt), sitzung-mv.de (Mecklenburg-Vorpommern, 14 belegt), KITU-SessionNet (Sachsen-Anhalt), kdgoe (Niedersachsen, 4), rznk.de (Saarland), dazu drei Kreise in Rheinland-Pfalz und ekom21-OParl in Hessen.
4. **Mitteilungs- und Amtsblätter sind die breiteste Quelle, aber Verlagsdatenbanken.** LINUS WITTICH (Thüringen, Rheinland-Pfalz, Saarland, Brandenburg, Mecklenburg-Vorpommern; artikelweise auf `ol.wittich.de`) und NUSSBAUM Medien (Baden-Württemberg, über 380 Gemeinden, artikelweise auf `nussbaum.de`) enthalten Einladungen mit Tagesordnung, Sitzungsberichte und Beschlussbekanntmachungen. Ohne Vereinbarung mit dem Verlag werden sie nicht genutzt (Datenbankrecht, robots und Nutzungsbedingungen ungeprüft). Amtsblatt-PDFs auf der eigenen Website der Kommune liest der Website-Leser.
5. **Die Rechtslage stützt den Website-Leser.** Alle Länder verlangen die ortsübliche Bekanntmachung von Zeit, Ort und Tagesordnung; in mehreren ist das Internet die zulässige Form. Baden-Württemberg verpflichtet Gemeinden mit elektronischem Sitzungsdienst, Tagesordnung und Beschlüsse online zu stellen (§ 41b GemO). Thüringen verlangt die Bekanntmachung von Beschlüssen (§ 40 Abs. 2 ThürKO). Niederschriften müssen meist nur zur Einsicht ausliegen, nicht online stehen.
6. **Stadtstaaten haben offene Kanäle oder starke Argumente.** Hamburg führt die Drucksachen der Bezirksversammlungen im Transparenzportal mit offener CKAN-Schnittstelle (dl-de-by-2.0), ohne Umweg über die gesperrten Bezirks-RIS. Berlin veröffentlicht die OParl-Schnittstellen von 11 Bezirksverordnetenversammlungen selbst als Open Data, sperrt dieselben Rechner aber per robots.txt; das ist das stärkste Argument für eine Freigabe-Anfrage. Bremen braucht nur einen Gremienfilter (Stadtbürgerschaft im OParl-System der Bürgerschaft); die Beiräte stehen auf den Ortsamt-Seiten.

## Wege je Land

| Land | Wer führt die Sitzungen kleiner Gemeinden | Neu gefundene Wege ohne Dritte | Nur mit Zustimmung | Schätzung ohne Dritte |
|---|---|---|---|---|
| Bayern | VG für ihre Mitglieder | 10 SessionNet-Systeme bei digitalfabriX ohne Website-Link; weitere über Zertifikatsprotokolle der Plattform auffindbar | komuna (über 40 % Marktanteil), Kommune aktiv | 20–60 weitere über digitalfabriX; Website-Leser ungemessen |
| Baden-Württemberg | jede Gemeinde selbst; GVV/VVG gemeinsam | Verbands-RIS mit allen Gemeinderäten (GVV Altshausen 11 Gebiete, GVV Schönau 6–8), braucht Gremientrennung; Website-Leser mit § 41b | NUSSBAUM (geschätzt 150–300 Gebiete), regisafe (VV Langenau) | 100–150 |
| Hessen | jede Gemeinde selbst | ekom21-OParl (Königstein, Neu-Anspach, Frankenberg), ratsinfomanagement.net-OParl (Fulda, Marburg-Biedenkopf) | Wittich (kein hessischer Titel belegt) | 8–12 belegt; Website-Leser für 208 Gebiete |
| Rheinland-Pfalz | Verbandsgemeinde für Ortsgemeinden | drei Kreise mit belegtem System; in VG-Websites eingebettete Ratsinfo (`/ratsinfo/sitzungstermin/…`) | Wittich-Amtsblätter der VG | 10–20 mit dem eingebetteten Muster |
| Saarland | Gemeinden; Zweckverband eGo-Saar | St. Wendel auf rznk.de; DNS-Prüfung für 15 Gemeinden | Wittich | einzelne |
| Thüringen | VG und erfüllende Gemeinden | Website-Leser (Beschlüsse sind bekanntzumachen) | Wittich (50–90 Gebiete), RIS-Portal/KIV | 30–50 |
| Sachsen | Verwaltungsverbände/-gemeinschaften | KISA-Erkennung (Wilsdruff, Priestewitz); Website-Leser (Amtsblatt-PDFs, KomBekVO) | Riedel (nur per E-Mail), Kommune aktiv, ratsinfomanagement.net | 40–70 |
| Sachsen-Anhalt | Verbandsgemeinden | KITU-Mandanten (Elbe-Heide, Teutschenthal, Sülzetal); komfa-Leser (etwa 12 Gebiete bundesweit) | Wittich | 10–25 |
| Brandenburg | Ämter für amtsangehörige Gemeinden | Sitzungsmodul im Website-CMS (`/politik/sitzungskalender.php`, 9 Ämter); TI-Generator | Wittich, CC e-gov | 10 belegt, 15–30 wahrscheinlich |
| Mecklenburg-Vorpommern | Ämter | 14 Mandanten auf sitzung-mv.de (126 Gemeinden); CMS-Sitzungsmodul (4) | Wittich | 20 belegt, 10–20 wahrscheinlich |
| Schleswig-Holstein | Ämter | CMS-Sitzungsmodul (2) | RIS-Portal und sitzung-online.de (robots) | wenige; vor allem Freigaben |
| Niedersachsen | Samtgemeinden für Mitglieder | kdgoe (4), itebo (1), krz-OParl-Rechner (zu prüfen) | ratsinfomanagement.net, ALLRIS-Zugriffsprüfung | 5–7 plus Website-Leser für Samtgemeinden |
| NRW | jede Gemeinde selbst | kein neuer offener Kanal | ratsinfomanagement.net (Sternberg-Brief) | – |
| Hamburg | Bezirksversammlungen | Transparenzportal (CKAN) | – | 1 Gebiet, 1,87 Mio. Einwohner |
| Berlin | Bezirksverordnetenversammlungen | – | Freigabe der Bezirke (OParl als Open Data veröffentlicht) | – |
| Bremen | Stadtbürgerschaft, Beiräte | Gremienfilter im OParl der Bürgerschaft; Ortsamt-Seiten | – | 1 Gebiet, 0,59 Mio. Einwohner |

## Was daraus umgesetzt ist

- **Prüflisten für 100 offene Gebiete** mit belegten Systemadressen (RIS, Verbands- und Kreissysteme, OParl), im Format von `verify.mjs`: `scripts/source-discovery/candidates/research-2026-10-de.json` (92 Gebiete), `…-nds.json` (6), `…-nrw.json` (2). Verlagsplattformen und kommerzielle Verzeichnisse sind nicht enthalten. Jeder Kandidat trägt `guessed:'Websuche'`: Das System muss das Gebiet selbst nennen, sonst wird nichts übernommen. Prüfaufruf in `scripts/source-discovery/README.md`, Abschnitt „Kandidaten aus der Länderrecherche“.
- **Fehlerkorrekturen in Suche, Prüfung und Bericht** und der **Gremienfilter für OParl** (Bremen): siehe README des Projekts, Abschnitt „Lücken ohne Dritte (05.10.2026)“.

## Was offen bleibt

| Weg | Voraussetzung | Erwartung |
|---|---|---|
| Prüfläufe der Kandidaten und der Neuprüfliste | Rechner des Inhabers (Cloud-Umgebung sperrt kommunale Server) | ein großer Teil der 100 Gebiete, Zahl erst nach dem Lauf |
| Hamburg über das Transparenzportal | Entscheidung, ob die Bezirke eigene Gebiete werden; robots.txt des Portals | 1,87 Mio. Einwohner |
| Gremientrennung für gemeinsame Systeme (Baden-Württemberg, Ämter) | Code; Gremienlisten der Systeme ablesen | 17–19 Gebiete sofort, mehr nach Verbandsabgleich |
| Plattform-Mandanten über Zertifikatsprotokolle (digitalfabriX, RIS-Portal, Kommune aktiv) | Abfrage öffentlicher Protokolle vom Rechner des Inhabers; keine Last auf den Plattformen | 20–60 lesbare Gebiete in Bayern; Neueinordnung gesperrter Gebiete |
| CMS-Sitzungsmodul der Ämter (Brandenburg, Mecklenburg-Vorpommern) und eingebettete Ratsinfo (Rheinland-Pfalz) | echte Seiten als Vorlage für einen Leser; zunächst über den Website-Leser messen | 15–30 Gebiete |
| komfa-Leser | echte Seiten; besser OParl beim Hersteller anfragen | etwa 12 Gebiete |
| Amtsblatt-Verlage (Wittich, NUSSBAUM) | Vereinbarung mit dem Verlag | zusammen mehrere hundert Gebiete, vor allem Baden-Württemberg und Thüringen |
| Berlin | Freigabe der Bezirke bzw. des ITDZ | 3,70 Mio. Einwohner |

Diese Wege gehören als Ergänzung in die Wellen des Konzepts ([anbindungskonzept.md](anbindungskonzept.md)): Prüfläufe, Zertifikatsprotokolle und Gremientrennung in Welle 1, die Verlage als eigene Adressaten in Welle 2, Hamburg und Berlin zu den Sonderfällen in Welle 3.

## Hinweise auf Katalogfehler

Die Recherche fand Doppelungen im Katalog, die zur Klärung der 22 Gebiete ohne Berichtszeile (Konzept, Vorbedingung V4) gehören: `de-08425004` steht als „Gemeinde Altheim“ für zwei verschiedene Altheim im Alb-Donau-Kreis, Tiefenbach (`de-08426118`) dreifach, Waldbrunn (`de-08225118`) doppelt; Waldburg (`de-08436079`) hat 0 Einwohner. Der Link von Hartheim auf buergerinformation.de ist eine Bürgerbroschüre, kein RIS.
