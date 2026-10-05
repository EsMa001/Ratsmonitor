# Bayern: Wo Sitzungen kleiner Kommunen dokumentiert sind (Recherche 05.10.2026)

**Rahmen und Grenzen.** Recherchiert wurde nur mit der Websuche. WebFetch war für alle geprüften Seiten gesperrt (lkr-lif.de, bayernportal.de, de.wikipedia.org, gesetze-bayern.de), ebenso jeder direkte Abruf kommunaler Seiten. Nach rund 35 Suchen war das Suchbudget der Sitzung (200 Abfragen, offenbar mit anderen Agenten geteilt) aufgebraucht. Deshalb ist die Liste der Funde eine Stichprobe und keine vollständige Erhebung. Die Aussagen zum Recht beruhen auf den Normen, die schon in `requirements/website-leser-ideen.md` belegt sind, und auf Art. 4 VGemO (Suchtreffer); der Wortlaut wurde in dieser Sitzung nicht neu abgerufen.

Arbeitsliste: 1.060 offene Gebiete (618 Gemeinden, 149 Städte, 279 VG, 14 Kreise). Davon haben 552 auf ihrer Website keinen RIS-Link (A; 315 Gemeinden, 61 Städte, 170 VG, 6 Kreise; 3,70 Mio. Einwohner). Weitere Gruppen: 325 robots-Sperren (B; 285 komuna, 32 RIS-Portal, 8 sonstige), 107 Abweisungen mit HTTP 403 (C; 99 Kommune aktiv). A-Fälle je Regierungsbezirk: Oberbayern 111, Niederbayern 100, Oberpfalz 82, Oberfranken 69, Mittelfranken 39, Unterfranken 71, Schwaben 80.

## 1. Struktur

- **Gemeinden:** 2.056 politisch selbstständige Gemeinden (Stand 28.01.2025), darunter 386 Märkte und die Städte. Daneben gibt es 25 kreisfreie Städte und 71 Landkreise in 7 Regierungsbezirken; jeder Bezirk ist zugleich ein eigener Selbstverwaltungskörper („Bezirk“ mit Bezirkstag). Quellen: https://de.wikipedia.org/wiki/Liste_der_St%C3%A4dte_und_Gemeinden_in_Bayern, https://www.facebook.com/bayern/photos/schon-gewusst-in-bayern-gibt-es-7-regierungsbezirke-71-landkreise-und-2056-gemei/4148864228481763/
- **Verwaltungsgemeinschaften:** 982 Gemeinden bilden 311 VG (gleiche Quelle). Eine VG ist eine Körperschaft mit Gemeinschaftsversammlung und Geschäftsstelle. Ihre Mitglieder behalten Gemeinderat und Bürgermeister. Nach **Art. 4 VGemO** erledigt die VG den übertragenen Wirkungskreis ihrer Mitglieder, außer dem Erlass von Satzungen und Verordnungen. Im eigenen Wirkungskreis besorgt sie als Behörde der Mitglieder „die verwaltungsmäßige Vorbereitung und den verwaltungsmäßigen Vollzug der Beschlüsse“ sowie die laufenden Angelegenheiten ohne grundsätzliche Bedeutung (https://www.gesetze-bayern.de/Content/Document/BayVGemO-4). Praktisch heißt das: Die VG-Geschäftsstelle führt den Sitzungsdienst aller Mitgliedsgemeinderäte (Ladung, Tagesordnung, Niederschrift, Vollzug). Deshalb liegt ein RIS, wenn es eines gibt, fast immer bei der VG und deckt alle Mitglieder ab. Belegte Beispiele: `buergerinfo-vg-ebermannstadt.digitalfabrix.de` mit Unterpfaden `/ebermannstadt/` und `/unterleinleiter/`; `buergerinfo-vgem-helmstadt.digitalfabrix.de` mit den Sitzungen von Helmstadt, Remlingen und Uettingen; `weitnau.ris-portal.de` mit VG, Markt Weitnau und Missen-Wilhams.
- **Erfüllende Gemeinde:** Bei einigen VG übernimmt eine Mitgliedsgemeinde die Aufgaben der VG (Art. 10 VGemO, nicht neu geprüft). Das RIS läuft dann oft unter dem Namen dieser Gemeinde.
- **Landkreise** führen in der Regel nur Kreistag und Ausschüsse in ihrem RIS (Beispiele: buergerinfo.landkreis-cham.de, service.landkreis-regen.de/bi, Lichtenfels). Für Gemeinderäte waren dort keine Sitzungen belegt.
- **Folge für die Liste:** Die 279 VG-Gebiete sind die richtige Einheit. Ein VG-RIS liefert alle Mitglieder; Ratsmonitor muss die Sitzungen über Gremiennamen oder Unterpfade den Mitgliedsgemeinden zuordnen.

## 2. Wo Sitzungen kleiner Kommunen dokumentiert sind

| Weg | Was | Abdeckung in Bayern | Lesbarkeit | Beispiele |
|---|---|---|---|---|
| **RIS der VG** | Sitzungen, Tagesordnungen, oft Vorlagen und Niederschriften aller Mitgliedsgemeinden | häufig; Produkte vor allem komuna.RIS, SessionNet (digitalfabriX), RIS-Portal (regisafe), Kommune aktiv | SessionNet bei digitalfabriX: lesbar (457 Hosts schon in `de-sources.json`). komuna und RIS-Portal: robots-Sperre. Kommune aktiv: HTTP 403 | buergerinfo-vg-*.digitalfabrix.de, vg-wilburgstetten.ris-portal.de, ris.komuna.net/vgzolling |
| **RIS ohne Link auf der Website** | wie oben | **wichtigster neuer Befund:** mehrere A-Gebiete haben ein SessionNet bei digitalfabriX, das die Website nicht verlinkt | lesbar | 10 Funde, siehe Abschnitt 3 |
| **RIS-Plattform des Landkreises für Gemeinden** | — | **nicht belegt.** Keine Suche fand ein Kreis-RIS, das Gemeinderäte trägt | — | Cham, Regen, Lichtenfels: nur Kreisgremien |
| **Gemeindeseiten auf der Kreis-Website** | Landkreis Cham: „Bürgerservices der Kommunen“ mit einer Seite je Gemeinde (Gemeinderat mit Mitgliedern und Sitzungsrhythmus, Satzungen, Geschäftsverteilung) | Lkr. Cham, mindestens 18 Gemeinden | statische Seiten auf landkreis-cham.de; Sitzungstermine dort nicht belegt | https://www.landkreis-cham.de/landkreis-landratsamt/kommunen/buergerservices/ |
| **Bauleitplanung beim Landratsamt** | Satzungs- und Plan-PDFs der Gemeinden mit Beschlussdaten | Lkr. Regen (`service.landkreis-regen.de/bau/<Gemeinde>/`) | PDF, keine Sitzungen | https://service.landkreis-regen.de/bau/Prackenbach/30_S_Aussenbereichssatzung_Tresdorf/SPlan-Tresdorf-030-000-002.pdf |
| **Amtsblatt des Landkreises** | Bekanntmachungen von Kreis, Landratsamt und Zweckverbänden (Haushalte, Satzungen); Satzungen von Gemeinden ohne eigenes Amtsblatt | alle Kreise; Beispiel Kronach (Kreisamtsblatt als PDF) | PDF; Gemeinderatssitzungen nicht enthalten (Einladungen gehen „ortsüblich“, meist an die Amtstafel) | https://www.landkreis-kronach.de/media/25730/kab_47_2025.pdf, https://www.landkreis-kronach.de/media/17713/kab_43_2022.pdf |
| **Amtsblatt der Regierung bzw. des Bezirks** | Bekanntmachungen von Regierung, Bezirk, Planungsverbänden und Zweckverbänden | 7 Regierungsbezirke | PDF; keine Gemeinderäte | https://www.regierung.oberbayern.bayern.de/mam/dokumente/service/obabl/2026/obabl_04_200226.pdf, https://www.regierung.mittelfranken.bayern.de/mam/service/rabl/rabl_2026_02.pdf |
| **Elektronische Amtstafel und Bekanntmachungsseite der Gemeinde oder VG** | Einladung mit Tagesordnung (Art. 52 Abs. 1 GO) | Pflicht für alle, seit 2023 auch rein digital zulässig | Website-Leser (schon gebaut) | Stockheim (Lkr. Kronach): jede Sitzung als Meldung, https://www.stockheim-online.de/aktuelles/meldungen/gemeinderatssitzung-am-montag-den-05102026 |
| **Mitteilungsblätter, Gemeindeblätter** | amtlicher Teil mit Bekanntmachungen, oft Sitzungsberichte | verbreitet, aber in dieser Sitzung nicht untersucht (Budget) | Verlags-ePaper: nicht verfolgen (siehe website-leser-ideen.md); PDF auf der eigenen Website: Website-Leser | — |
| **BayernPortal** | Leistung „Bürger- und Ratsinformationen online“ mit Link je Behörde; laut Treffer bieten 126 Behörden ein Onlineverfahren an. Dazu Produkteinträge „Ratsinformationssystem (RIS)“ als Onlineverfahren (IDs `0103957199332`, `2372773812248`) mit Ortsparametern `plz`, `behoerde`, `gemeinde` | Wegweiser; 126 ist deutlich weniger als die Zahl der bayerischen Kommunen mit RIS | nur Linkfund, Abruf von hier aus gesperrt; Daten wohl auch über PVOG (OAuth2) | https://www.bayernportal.de/dokumente/onlineservice/70219164659, https://www.bayernportal.de/dokumente/onlineverfahren/0103957199332?localize=false, https://www.bayernportal.de/dokumente/onlineverfahren/2372773812248?contrast=high&localize=false |
| **Kommunale IT-Dienstleister** | siehe Abschnitt 3 | — | — | — |
| **Open Data** | in Bayern nichts für Gemeinderäte gefunden | — | — | — |
| **Regionalzeitungen** | Vor- und Nachberichte (z. B. Neue Presse Coburg zu Pressig: https://www.np-coburg.de/inhalt.gemeinderat-pressig-wird-digital.cb8b43ed-c971-4f00-ba40-a3746a6a2ceb.html) | hoch | nicht übernehmen, höchstens als Hinweis | — |
| **Drittverzeichnis poliscope** | Seiten „Ratsinformationssystem <Ort>“ je Gemeinde und VG, auch für A-Gebiete (Heustreu VGem 096735638, Oberbergkirchen VGem 091835150, Neusorg VGem 093775349) | breit | kommerziell; ob es dort ein RIS gibt, ist offen. Nur als Hinweis nutzen | https://poliscope.de/ratsinformationssystem/heustreu-vgem-/096735638 |

## 3. Kreise und Dienstleister mit Sammelplattformen

**digitalfabriX (SessionNet, Hosts `buergerinfo-<ort>.digitalfabrix.de`).** Der Dienstleister nennt über 1.000 kommunale Kunden (https://www.digitalfabrix.de/). Er hostet SessionNet für viele bayerische Gemeinden, VG (Präfix `vg-` oder `vgem-`) und Landratsämter (`lra-ffb`, `kreis-*`). Lesbar mit dem vorhandenen SessionNet-Leser; Kartenformat `si0056`, siehe README. In den Suchtreffern standen 29 Hosts. 19 davon sind schon Quellen, **die übrigen 10 gehören alle zu A- oder D-Gebieten der Liste:**

| id | Gebiet | Adresse |
|---|---|---|
| de-094745420 | VG Ebermannstadt | https://buergerinfo-vg-ebermannstadt.digitalfabrix.de/ |
| de-095715506 | VG Triesdorf | https://buergerinfo-vg-triesdorf.digitalfabrix.de/ |
| de-096725608 | VG Euerdorf | https://buergerinfo-vg-euerdorf.digitalfabrix.de/ |
| de-095775535 | VG Nennslingen | https://buergerinfo-vg-nennslingen.digitalfabrix.de/ |
| de-096725606 | VG Bad Brückenau | https://buergerinfo-vgem-bad-brueckenau.digitalfabrix.de/ |
| de-092785252 | VG Schwarzach (Zuordnung prüfen) | https://buergerinfo-vgem-schwarzach.digitalfabrix.de/ |
| de-095745528 | VG Happurg (D) | https://buergerinfo-vg-happurg.digitalfabrix.de/ |
| de-09176139 | Markt Kösching | https://buergerinfo-koesching.digitalfabrix.de/ |
| de-09174136 | Gemeinde Petershausen | https://buergerinfo-petershausen.digitalfabrix.de/ |
| de-09574157 | Gemeinde Schwarzenbruck | https://buergerinfo-schwarzenbruck.digitalfabrix.de/ |

Belege: Suchtreffer zu `site:digitalfabrix.de` (Einzel-URLs in `by-kandidaten.json`). robots.txt dieser Hosts wurde nicht geprüft; bei den schon angebundenen digitalfabriX-Quellen gab es keine Sperre.

**komuna GmbH (komuna.RIS, `ris.komuna.net/<mandant>`).** Sitz in Altdorf bei Landshut. Nach eigener Angabe hat die Firma über 40 % Marktanteil in Bayern und mehr als 700 Kommunen und Verbände in Bayern und Baden-Württemberg als Kunden (https://www.komuna-web.de/leistungen/portfolio_front/komuna_ris.php, https://www.komuna-web.de/ueberuns/ueberblick/ueberblick.php). Genannte VG-Kunden sind Hörlkofen, Ichenhausen, **Königstein (de-093715302, in der Liste als A)**, Neumarkt-Sankt Veit, Pfaffenhausen, Pressath und Zolling. Ein gemeinsames komuna-RIS haben Eching a.Ammersee, Greifenberg, Schondorf und die **VG Schondorf (de-091815143, A)** (https://www.eching-ammersee.de/rathaus-verwaltung/rastinformationssystem-ris). Lesbarkeit: robots-Sperre, kein OParl (README). Auch viele A-Gebiete dürften in Wahrheit B-Fälle sein, also komuna-Mandanten ohne Link auf der Website.

**RIS-Portal (regisafe/comundus, `<ort>.ris-portal.de`).** Viele VG nutzen es mit allen Mitgliedern, etwa Weitnau und Wilburgstetten. Neu zugeordnet ist die **VG Wittislingen (de-097735715, A)** über https://www.vg-wittislingen.de/die-verwaltungsgemeinschaft/ris-portal. Auch hier gilt die robots-Sperre.

**Kommune aktiv (multi-INTER-media GmbH, Lohr a.Main, `<ort>.ris.kommune-aktiv.de`).** Das Unternehmen bietet RIS und Websites für Städte, Gemeinden und VG an, vor allem in Unterfranken und Niederbayern (https://www.kommune-aktiv.de/, https://main-spessart.msp.info/multi-INTER-media_GmbH/1560/impressum/Lohr_a_Main.html). Die Mandanten sind in der Suchmaschine nicht indexiert, deshalb gab es keine Mandantenliste. Lesbarkeit: HTTP 403.

**gremien.info, ratsinfomanagement.net (SD.NET RIM, STERNBERG), ALLRIS 3 (Miesbach).** Hier gab es keine neuen Funde für Bayern.

**Landkreis Cham.** Der Kreis betreibt auf seiner Website Seiten je Gemeinde („Bürgerservices der Kommunen“). Laut Treffer gehören dazu Arnschwang, Arrach, Blaibach, Chamerau, Gleißenberg, Grafenwiesen, Hohenwarth, Lohberg, Michelsneukirchen, Traitsching, Treffelstein, Waffenbrunn, Wald, Walderbach, Weiding, Willmering, Zandt und Zell. Seiten gibt es außerdem für Runding, Rimbach, Schorndorf, Miltach, Rötz und Cham. Belegt sind Gemeinderat (Mitglieder, Sitzungsrhythmus; Chamerau „einmal im Monat, mittwochs“), Satzungen und Geschäftsverteilung. Der Landkreis hat in der Liste 24 A-Gebiete, 16 davon tauchen in diesen Bürgerservices auf. Sitzungstermine oder Tagesordnungen sind dort **nicht** belegt. Der Nutzen hängt daran, ob diese Seiten Bekanntmachungen enthalten; das muss der Website-Leser bei einem Messlauf zeigen. Das RIS des Kreises (buergerinfo.landkreis-cham.de, SessionNet) zeigt nur Kreisgremien. Chamerau verweist für den Ratsbereich auf die App Mandatos (Anmeldung nötig).

**Landkreis Regen.** Neben dem Kreis-RIS hostet das Landratsamt Bauleitplanungs-PDFs der Gemeinden (`service.landkreis-regen.de/bau/<Gemeinde>/`). Sitzungen der Gemeinden liegen dort nicht.

## 4. Rechtslage (kurz)

- **Art. 52 Abs. 1 GO:** Zeit und Ort öffentlicher Sitzungen werden mit Tagesordnung spätestens am dritten Tag vor der Sitzung ortsüblich bekanntgemacht. Abs. 2: Die Sitzungen sind öffentlich. Abs. 3: In nichtöffentlicher Sitzung gefasste Beschlüsse werden bekanntgegeben, sobald die Gründe für die Geheimhaltung weggefallen sind.
- **Art. 54 GO:** Es gibt eine Niederschriftspflicht. Abs. 3: Gemeindebürger dürfen die Niederschriften öffentlicher Sitzungen einsehen. Eine Pflicht, Niederschriften oder Beschlüsse im Netz zu veröffentlichen, besteht nicht (anders als in Thüringen nach § 40 ThürKO). Im Netz stehen sie nur freiwillig, über RIS oder Website.
- **Art. 26 Abs. 2 GO und BekV:** Satzungen erscheinen im Amtsblatt der Gemeinde. Bei VG-Mitgliedern gilt das Amtsblatt der VG als Amtsblatt der Gemeinde. Ohne eigenes Amtsblatt erscheinen sie im Amtsblatt des Landkreises oder Landratsamts oder werden niedergelegt und angeschlagen. Seit 2023 ist die rein digitale amtliche Bekanntmachung möglich (Quellen in website-leser-ideen.md). Sitzungseinladungen sind „ortsüblich“, also meist Amtstafel und Website, nicht Kreisamtsblatt.
- **Rolle der VG:** Sie bereitet die Beschlüsse vor und vollzieht sie (Art. 4 Abs. 2 VGemO). Damit führt sie de facto die Unterlagen, Ladungen und Niederschriften aller Mitglieder; ihre Amtstafel oder Website ist der zentrale Ort der Bekanntmachungen.

## 5. Folgerungen für Ratsmonitor

1. **Sofort nutzbar ohne Dritte: SessionNet bei digitalfabriX.** 10 Gebiete der Liste haben nachweislich ein lesbares SessionNet ohne Link auf der Website (8 VG, darunter Mitglieder mit eigenen Unterpfaden). Das ist ein Fehler der Quellensuche: Sie folgt nur Links der Website. Empfehlung: Die Hosts `*.digitalfabrix.de` ohne Abruf kommunaler Seiten auflisten, etwa aus Certificate-Transparency-Protokollen (z. B. crt.sh, Domain `digitalfabrix.de`), und per Namensabgleich mit den 552 A-Gebieten verknüpfen. Hochrechnung: In dieser Stichprobe kamen auf 29 Hosts 10 offene A- oder D-Gebiete. Bei 457 bekannten plus vermutlich mehreren Dutzend unbekannten digitalfabriX-Hosts sind **≈20–60 weitere A-Gebiete** erreichbar, vor allem VG (Schätzung, nicht belegt). Wegen der VG-Struktur deckt jedes Gebiet im Mittel 3 Gemeinden ab.
2. **Neu einordnen statt anbinden: komuna und RIS-Portal ohne Website-Link.** Ein Teil der A-Gebiete sind tatsächlich B-Fälle (Königstein, Schondorf, Wittislingen belegt). Das ändert den Zustand (`gesperrt-robots` statt „kein RIS“) und vergrößert die Zahl für die Briefe an komuna (Welle 2). Die gleiche CT-Methode greift bei RIS-Portal (`*.ris-portal.de`) und Kommune aktiv (`*.ris.kommune-aktiv.de`), nicht bei komuna (Mandanten als Pfad). Geschätzt **≈50–150 A-Gebiete** liegen auf gesperrten Plattformen, abgeleitet aus komunas Angabe von 40 % Marktanteil (Schätzung).
3. **Website-Leser (vorhanden) für Bekanntmachungen.** Das bleibt der Weg für die meisten kleinen Gemeinden ohne RIS. Belegt ist Stockheim (Kronach). Bei VG gehört die Bekanntmachungsseite der VG an das VG-Gebiet, mit Zuordnung zu den Mitgliedern.
4. **Kreis-Wege:** Ein Kreis-RIS für Gemeinden ist in Bayern nicht belegt. Kreisamtsblätter enthalten keine Gemeinderatssitzungen und lohnen sich nicht. Die Gemeindeseiten des Landkreises Cham (16 Gebiete der Liste) sind ein Prüffall für den Website-Leser; sie liefern sicher Gremien und Satzungen, Sitzungen sind unbelegt.
5. **BayernPortal** taugt nur als Wegweiser (126 Behörden mit RIS-Link). Der Produkteintrag „Ratsinformationssystem (RIS)“ könnte alle Kommunen eines Anbieters aufzählen. Das sollte einmal im Browser oder über das PVOG geprüft werden.

Kandidaten-Datei: 29 Einträge, davon 10 sofort lesbare SessionNet-Systeme (`ris`/`vg-ris`), 2 Neueinordnungen auf gesperrte Plattformen, 1 Bekanntmachungsseite und 16 Seiten des Landkreises Cham.

## 6. Offene Fragen

- Vollständige Liste der digitalfabriX-Hosts (CT-Protokolle) und deren robots.txt; Abgleich mit den 552 A-Gebieten.
- BayernPortal-Onlineverfahren `0103957199332` und `2372773812248`: Welches Produkt steckt jeweils dahinter, und welche Kommunen sind gelistet? Ein Treffer nannte Söchtenau, Hebertsfelden, Rimsting und Fridolfing; Hebertsfelden (de-09277124) ist A.
- poliscope führt A-Gebiete (Heustreu, Oberbergkirchen, Neusorg) als „Ratsinformationssystem“. Stecken dort echte RIS dahinter?
- Treffer, dass die VG Wörth a.d.Isar (de-092745222) Bürgerinfo-Systeme für VG, Weng und Wörth hat: Quelle unklar, nicht belegt.
- Enthalten die Gemeindeseiten des Landkreises Cham Sitzungstermine oder Bekanntmachungen, und erlaubt robots.txt den Abruf?
- Mitteilungsblätter und Verlage in Bayern sowie die sechs offenen Kreise (Ansbach, Traunstein, Neumarkt, Donau-Ries, Fürth, Haßberge) wurden wegen des Suchbudgets nicht untersucht.
- Kommune aktiv: Eine Mandantenliste ist nicht öffentlich indexiert. Die Liste müsste beim Anbieter angefragt oder über CT-Protokolle gewonnen werden.
