# plenara.X Signale: Kategorien und Filter

Stand 14.10.2026, festgelegt mit Nico. plenara.X Signale ist eine Filterfunktion: Branchen sehen, wo gerade etwas entsteht.

- Höchstens 10 Kategorien, alle nach Branchennutzen ausgewählt. Die Themen bleiben außen vor; man kann sie über den Filter neben der Suchleiste dazunehmen.
- Je Kategorie Filter als Knöpfe. Dazu kommt der Stand des Verfahrens.
- Jede Kategorie und jeder Filter hat eine eigene Regel (`shared/topic-facts.mjs`).
- Die Zuordnung wird gemessen:
  - Qualität: Gehört der Vorgang dazu? Ziel mindestens 90 %.
  - Trefferquote: Finden wir die passenden Vorgänge?
- Freigegeben wird eine Kategorie erst über dem Ziel. Der Messstand steht unten und in `shared/rule-quality.json`.
- Vorgehen: eine Kategorie nach der anderen. Regel bauen, ungesehene Stichprobe messen, eintragen, dann die nächste.

| # | Kategorie | Filter | Für wen | Stand |
|---|---|---|---|---|
| 1 | Ausschreibungen und Vergaben | Hochbau · Tiefbau und Straße · Wasser und Abwasser · Planungsleistungen · IT und Glasfaser · Fahrzeuge und Ausstattung | Bauindustrie, Ingenieurbüros, Lieferanten, IT | Regel `tenderOf` (nur Titel, Fakt `tender`, Stand Ausschreibung/Vergabe/Nachtrag); lokale Probe 3 (gesehen): Kategorie ca. 36/40, Filter ca. 38/40; danach Ausschlüsse Richtlinie, Mitteln, Konzeptvergabe, Bieterverfahren. Offen: ungesehene Server-Stichprobe, Signal-Seite auf die 10 Kategorien umstellen |
| 2 | Neue Wohnbaugebiete | Einfamilienhäuser · Doppel- und Reihenhäuser · Mehrfamilienhäuser · geförderter Wohnungsbau · Seniorenwohnen · Bauplatzverkauf (mit €/m²) | Fertighaus, Bauträger, Makler, Banken | Hausform 1. Messung 53 %, Regeln verbessert |
| 3 | Gewerbe- und Industrieflächen | Gewerbe · Industrie · Logistik · Rechenzentrum · Batteriespeicher und Wasserstoff · Hotel, Camping und Freizeit · Grundstücksverkauf (mit €/m²) | Projektentwicklung, Logistik, Handel, Wirtschaftsförderung | Nutzung vorhanden (plan_use) |
| 4 | Windenergie | Genehmigungsantrag (BImSchG) · Einvernehmen · Bauleitplanung · Bürger- und Kommunalbeteiligung; Zahl der Anlagen | Projektierer, Stadtwerke, Netzbetreiber | Anlagenzahl 1. Messung 67–87 % |
| 5 | Solarenergie | Freiflächen-PV · Agri-PV · Dach-PV auf kommunalen Gebäuden · Batteriespeicher | Projektierer, Landwirtschaft, Netzbetreiber, Handwerk | offen |
| 6 | Wärme und Energieeffizienz | Wärmeplanung (Schritt) · Wärmenetz und Fernwärme · Heizungstausch · LED-Straßenbeleuchtung · energetische Sanierung | Stadtwerke, Energieberatung, Heizungsbranche, Contracting | Wärmeplanung vorhanden (heat_plan) |
| 7 | Schulen, Kitas und Sportstätten | Kita · Grundschule · weiterführende Schule · Sporthalle · Schwimmbad | Bau, Modulbau, Ausstattung, Bäderbau | offen |
| 8 | Pflege und Gesundheit | Pflegeheim · Seniorenwohnen · Ärztehaus und MVZ · Krankenhaus | Pflegebetreiber, Projektentwicklung, Gesundheitswirtschaft | offen |
| 9 | Einzelhandel und Nahversorgung | Supermarkt und Discounter · Drogerie · Fachmarkt · Innenstadt und Leerstand | Handelsketten, Expansion, Makler | offen |
| 10 | Mobilität | Bürgerbus und Rufbus · Carsharing · Ladesäulen · Rad- und Lastenradverleih · Mitfahrbank | Mobilitätsanbieter, Ladeinfrastruktur, ÖPNV | Vorhaben 1. Messung ca. 87 % |

Verworfen: Feuerwehr. Nicht als eigene Kategorie: Grundstücksverkäufe (Filter in 2 und 3), Digitalisierung und Wasser/Abwasser (Filter in 1), Energieeffizienz (in 5 und 6), Tourismus (in 3 und 7).

## Arbeitsstand 14.10.2026 abends (uncommittet, `nico_front`)

- Regeln gebaut: `tenderOf` (1), `houseTypesOf` (2), `PLAN_USES` mit Speicher/Wasserstoff und Hotel/Camping (3), `windStepOf` + `windCountOf` (4), `solarOf` (5), `energyOf` + `heat_plan` (6), `schoolBuildOf` (7), `careOf` (8), `retailOf` (9), `projectsOf` (10). Alle in `shared/topic-facts.mjs`, eingetragen in `factsOf`.
- `server/integrations/plenara-x-signals.mjs` kennt die 10 Kategorien (Filter „Art“ über `sig.art`, Stand über `sig.phase`), Route `/api/x/signale` (Cache-Schlüssel x-signale-v5), Tests `tests/plenara-x-signals.test.mjs` grün.
- Seite `SignalePage.tsx` auf die 10 Kategorien umgestellt; Standard ist „Ausschreibungen und Vergaben“.
- Lokal zum Prüfen die Titel-Fakten nachgetragen (`scratchpad/localfacts.mjs`, 54.995 Fakten); auf dem Server erst mit facts-v26 nach dem Ausrollen.
- Admin „Themen & Texte“: Abschnitt Signale (Gruppe `signals` in `rule-quality.json`), Erklärung beim Darüberfahren.
- Nächster Schritt: Seite im Browser prüfen, dann je Kategorie die ungesehene Server-Stichprobe für Qualität und Trefferquote (Optimierung).

## Messung 1–6 (14.10.2026, Server, ungesehen, je 20 + 20)

Zwei Läufe; eingetragen in `rule-quality.json` ist Lauf 2 (Seed 8282), gemessen nach den Korrekturen aus Lauf 1 (Seed 5151). Die Trefferquote ist ein Anteil der sicher passenden Titel unter 20 Titeln mit Grobfilter-Wort; bei kleinen Zahlen ist sie nur eine grobe Angabe.

| # | Qualität L1 → L2 | Trefferquote L1 → L2 | Filter L2 |
|---|---|---|---|
| 1 Vergaben | 20/20 → 20/20 | 13/13 → 11/12 | 17/20 |
| 2 Wohnbau | 14/20 → 15/20 | ca. 1/3 → ca. 2/5 | zu wenige Hausformen |
| 3 Gewerbe | 18/20 → 19/20 | 4/9 → 6/6 | 16/16 |
| 4 Wind | 20/20 → 20/20 | 11/12 → 8/9 | 19/20 |
| 5 Solar | 17/20 → 19/20 | 17/17 → 18/18 | 17/19 |
| 6 Wärme | 13/20 → 18/20 | 8/12 → 13/14 | 19/20 |

- Nach Lauf 1 korrigiert: „LED“ nur als Wort (passte in „erledigenden“), „WA“, „GE“, „GI“ nur groß geschrieben, Abwägung eingegangener Stellungnahmen zählt als Planverfahren, Einzelgrundstücke und Aufhebungen sind kein neues Plangebiet, neuer Fakt `area_dev` (Bau- und Gewerbegebiete ohne Bebauungsplan im Titel), Solar-Filter „Sonstige PV“ statt Freiflächen als Rest, Wind-Filter „Regionalplanung“.
- Nach Lauf 2 korrigiert, nicht neu gemessen: „Sanierung von Straßen“ als Tiefbau, Garage als Hochbau, „Beteiligung an Windenergieanlagen“, Raumordnungsplan Wind, „Agri PV“ mit Leerzeichen, Wärmeerzeugung, „…siedlung“ als Wohnen, „Baugebiet X“ allein, Einzelgrundstück-Verkäufe raus.
- Schwach bleibt 2 (Wohnbau): viele Bebauungspläne nennen die Nutzung weder im Titel noch im Beschlussvorschlag.
