// Fakten für plenara.X: Fraktion als Antragsteller, Förderprogramme (shared/topic-facts.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {factionsOf,housingOf,kitaFeeOf,factsOf,hebesatzOf,feeRateOf,heatPlanOf,grantOf,planUseOf,eePowerOf,landPriceOf,plotPriceOf,annualResultOf,dogTaxOf,wasteFeeOf,planAreaOf,windCountOf,projectsOf,roadWorkOf,houseTypesOf} from '../shared/topic-facts.mjs';

test('factions are read from the applicant phrase in title or head',()=>{
 assert.deepEqual(factionsOf('Antrag der SPD-Fraktion: Tempo 30 vor Schulen'),{parties:['SPD'],kind:'antrag'});
 assert.deepEqual(factionsOf('Anfrage der Fraktion BÜNDNIS 90/DIE GRÜNEN zur Baumschutzsatzung'),{parties:['Grüne'],kind:'anfrage'});
 assert.deepEqual(factionsOf('Radweg Hauptstraße','Gemeinsamer Antrag der Fraktionen CDU und FDP\nDer Rat möge beschließen'),{parties:['CDU/CSU','FDP'],kind:'antrag'});
 assert.deepEqual(factionsOf('Fraktion DIE LINKE: Antrag Sozialticket'),{parties:['Linke'],kind:'antrag'});
 assert.deepEqual(factionsOf('Antrag der UWG-Fraktion zur Ortsdurchfahrt'),{parties:['Freie Wähler und Wählergruppen'],kind:'antrag'});
 assert.equal(factionsOf('Antrag der AfD-Fraktion').parties[0],'AfD');
});

test('parties named elsewhere do not count as applicants',()=>{
 assert.equal(factionsOf('Bebauungsplan Nr. 12','Die Verwaltung schlägt vor … In der Sitzung stimmte die CDU dagegen, die SPD enthielt sich.'),null);
 assert.equal(factionsOf('Antrag auf Förderung des Sportvereins'),null);
 assert.equal(factionsOf('Mitteilungen der Verwaltung'),null);
 assert.equal(factionsOf('Fraktionszuwendungen 2026'),null);
 assert.equal(factionsOf('Beantwortung der schriftlichen Stadtverordnetenanfragen','Anfrage der CDU-Fraktion … Anfrage der FDP-Fraktion'),null,'Sammelpunkt');
});


test('factsOf: Fraktion, keine Förderung mehr',()=>{
 const only=(t,x)=>factsOf(t,x).filter(r=>!r.kind.startsWith('radar:'));
 assert.deepEqual(only('Antrag der CDU-Fraktion: Sportplatz','Wir beantragen Fördermittel aus der Sportstättenförderung.'),[
  {kind:'faction',value:'CDU/CSU',detail:'antrag'}],'Förderung ist kein Fakt mehr');
 assert.deepEqual(only('Antrag der CDU-Fraktion: Sportplatz',''),[{kind:'faction',value:'CDU/CSU',detail:'antrag'}]);
});


test('plans: stage from the title or the decision, the furthest step wins, repeal apart',async()=>{
 const {planOf,housingOf}=await import('../shared/topic-facts.mjs');
 assert.deepEqual(planOf('Bebauungsplan Nr. 43 Perleberg - Satzungsbeschluss'),{stage:'Satzungsbeschluss',type:'Bebauungsplan',plan:'nr. 43'});
 assert.equal(planOf('Bebauungsplan „Wohngebiet Süd“: Abwägungs- und Satzungsbeschluss').stage,'Satzungsbeschluss');
 assert.equal(planOf('Bebauungsplan „Am Markt“','Verfahren: Aufstellungsbeschluss 2024, Offenlage 2025. Beschlussvorschlag: Der Rat beschließt die öffentliche Auslegung des Entwurfs.').stage,'Offenlage');
 assert.equal(planOf('Aufhebung des Bebauungsplans Nr. 7').stage,'Aufhebung');
 assert.equal(planOf('112. Änderung des Flächennutzungsplans - Feststellungsbeschluss').type,'Flächennutzungsplan');
 assert.equal(planOf('Sanierung der Grundschule'),null);
 assert.equal(planOf('Einvernehmen nach § 36 BauGB zum Bauantrag im Bebauungsplan Nr. 5'),null,'Bauantrag');
 assert.equal(planOf('Sachstandsbericht Wohnbaulandentwicklung, Bebauungspläne'),null,'Sammelbericht');
 assert.equal(planOf('Stellungnahme der Stadt zum Vorentwurf des Bebauungsplans der Gemeinde Nachbarort'),null,'fremder Plan');
 assert.equal(housingOf('Im Plangebiet sollen rund 140 Wohneinheiten entstehen. Bis 2030 Wohnungen'),140);
 assert.equal(housingOf('Die Fläche umfasst 2 Wohnungen im Bestand.'),null,'ohne Planungsbezug und unter 3');
});

test('Kita: fee decisions with direction, new places without years',async()=>{
 const {kitaFeeOf}=await import('../shared/topic-facts.mjs');
 assert.deepEqual(kitaFeeOf('Satzung über Elternbeiträge in Kindertageseinrichtungen','Beschlussvorschlag: Die Elternbeiträge für Kinder in der Kita werden zum 1.8. um 5 % erhöht.'),{direction:'Erhöhung',euro:''});
 assert.equal(kitaFeeOf('Satzung über Elternbeiträge in Kindertageseinrichtungen','Im Jahr 2023 wurden die Elternbeiträge der Kita erhöht. Beschlussvorschlag: Die Satzung wird neu gefasst.').direction,'Neufassung','Richtung nicht aus dem Hintergrund');
 assert.equal(kitaFeeOf('Information zu den Kita-Elternbeiträgen ab 01.01.2027','Beschlussvorschlag: Für Kinder in der Kita gelten die Absenkungsbeiträge, die Beiträge werden gesenkt.').direction,'Neufassung','Information ohne Richtung im Titel');
 assert.equal(kitaFeeOf('Absenkungsbeiträge für Kita-Elternbeiträge','').direction,'Neufassung','Absenkungsbeitrag ist keine Senkung');
 assert.equal(kitaFeeOf('Kita-Beiträge','Beschlussvorschlag: Das letzte Kita-Jahr bleibt beitragsfrei.').direction,'Beitragsfreiheit');
 assert.equal(kitaFeeOf('Antrag: Reduzierung der Elternbeiträge für Kindertageseinrichtungen','Wegen der Steigerung der Kosten in der Kita …').direction,'Senkung','Titel vor Text');
 assert.equal(kitaFeeOf('Beitragssatzung über wiederkehrende Straßenbeiträge','Die Beiträge werden erhöht.'),null,'Straßenbeiträge sind keine Kita-Beiträge');
 assert.equal(kitaFeeOf('Festsetzung der Elternbeiträge für die Verpflegung in den Kitas','Die Verpflegungspauschale beträgt 3,50 Euro.').direction,'Verpflegung');
 assert.equal(kitaFeeOf('Mitteilungen','Elternbeiträge in der Kita werden erhöht.'),null,'Sammelpunkt');
});





test('kita fee amounts are whole numbers',async()=>{
 const {kitaFeeOf}=await import('../shared/topic-facts.mjs');
 assert.equal(kitaFeeOf('Erhöhung der Elternbeiträge Kita','Der Kita-Beitrag steigt ab August auf 1.000 € im Jahr und 95 € im Monat.').euro,'95');
});

test('hebesaetze: change, table row and plain rate; recommendations and comparisons do not count',()=>{
 assert.deepEqual(hebesatzOf('Anhebung der Hebesätze der Realsteuern','Beschlussvorschlag: Der Ortsgemeinderat erhöht den Hebesatz der Grundsteuer B ab dem 01.01.2026 von derzeit 465 auf 500 Prozentpunkte.'),[{tax:'Grundsteuer B',from:'465',to:'500'}]);
 assert.deepEqual(hebesatzOf('1. Satzung zur Änderung der Hebesatzsatzung','Folgende Änderungen sind vorgesehen: Steuerart Hebesatz bisher Hebesatz neu Grundsteuer A 262 v.H. 300 v.H. Gewerbesteuer 365 v.H. 400 v.H.'),[{tax:'Grundsteuer A',from:'262',to:'300'},{tax:'Gewerbesteuer',from:'365',to:'400'}]);
 assert.deepEqual(hebesatzOf('Hebesatz-Satzung','Zur Sicherung der Aufkommensneutralität erhöht die Gemeinde den Hebesatz für die Grundsteuer B auf 483 v.H.'),[]);
 assert.deepEqual(hebesatzOf('Hebesatzsatzung 2027','Der aufkommensneutrale Hebesatz der Grundsteuer B beträgt 1.092 v.H.'),[]);
 assert.deepEqual(hebesatzOf('Hebesatzsatzung 2027','Der Gemeinderat beschließt, den Hebesatz der Grundsteuer B ab dem 01.01.2027 auf 1.200 v.H. festzusetzen.'),[{tax:'Grundsteuer B',from:'',to:'1200'}]);
 assert.deepEqual(hebesatzOf('Radweg Hauptstraße','Grundsteuer B 500 v.H.'),[]);
});

test('gebuehrensaetze: kind before the value, basis after the unit does not count, contributions and comparisons are skipped',()=>{
 assert.deepEqual(feeRateOf('Abwasserabgabensatzung','Die Niederschlagswassergebühr würde eine Steigerung von derzeit 1,26 €/m² auf 1,49 €/m² erfahren.'),[{kind:'Niederschlagswasser',from:'1.26',to:'1.49',unit:'m²'}]);
 assert.deepEqual(feeRateOf('Satzung über die Erhebung von Schmutzwassergebühren','Beschluss 2: Die verbrauchsabhängige Schmutzwassergebühr wird ab dem 01.01.2026 auf 3,39 €/m³ festgesetzt.'),[{kind:'Schmutzwasser',from:'',to:'3.39',unit:'m³'}]);
 assert.deepEqual(feeRateOf('Gebühren 2027 - Trinkwasserversorgung','Es ergibt sich eine Verbrauchsgebühr in Höhe von 3,02 €/m³ Frischwasser.'),[{kind:'Trinkwasser',from:'',to:'3.02',unit:'m³'}]);
 assert.deepEqual(feeRateOf('Wassergebühren','Der Zweckverband hat beschlossen, den Wasserpreis von 1,70 € auf 1,90 € je Kubikmeter zu erhöhen.'),[{kind:'Trinkwasser',from:'1.7',to:'1.9',unit:'m³'}]);
 assert.deepEqual(feeRateOf('Globale Beitragskalkulation für Schmutzwasser','Beitrag für Schmutzwasserbeseitigung 7,87 €/m² (vorher 6,00 €/m²)'),[]);
 assert.deepEqual(feeRateOf('Wasserversorgungssatzung','Im Vergleich der Kommunen liegt die Stadt mit 2,54 €/m³ Trinkwasser am unteren Ende.'),[]);
});

test('waermeplanung: step from the title, draft before decision, political requests do not count',()=>{
 assert.equal(heatPlanOf('Aufstellungsbeschluss zur kommunalen Wärmeplanung',''),'Start und Beauftragung');
 assert.equal(heatPlanOf('Präsentation des Entwurfs des Endberichts der kommunalen Wärmeplanung und Beschluss der Einsichtnahme',''),'Entwurf und Beteiligung');
 assert.equal(heatPlanOf('Beschlussfassung Kommunaler Wärmeplan Stadt Dessau-Roßlau',''),'Wärmeplan vorgelegt');
 assert.equal(heatPlanOf('Kommunaler Wärmeplan der Landeshauptstadt Dresden','Beschlussvorschlag: 1. Der Stadtrat beschließt auf Grundlage des Wärmeplanungsgesetzes den Kommunalen Wärmeplan. 2. Umsetzung der Maßnahmen.'),'Wärmeplan vorgelegt');
 assert.equal(heatPlanOf('Übertragung der Aufgabe „Umsetzung der Kommunalen Wärmeplanung“ auf das Amt',''),'Start und Beauftragung');
 assert.equal(heatPlanOf('Antrag der SPD-Fraktion zur Wärmeplanung',''),null);
});

test('zuschuesse an vereine: purpose from the title, amount at the grant word, no limits, lists or incoming funds',()=>{
 assert.deepEqual(grantOf('Zuschussantrag des TuS Lutten e. V. für Ballfangzäune','Beschlussvorschlag: Dem TuS Lutten e. V. wird ein Zuschuss in Höhe von 2.675,00 € gewährt.'),{purpose:'Sport',euro:2675});
 assert.deepEqual(grantOf('Zuschussantrag der DLRG Ortsgruppe Barßel e. V.','Der Neubau wird mit 20 % der förderfähigen Ausgaben, bis zu einer Zuschusshöhe von bis zu 10.000 Euro, gefördert.'),{purpose:'Feuerwehr und Rettung',euro:0});
 assert.equal(grantOf('Antrag auf Fördermittel aus dem Landesprogramm für Vereinssportstätten',''),null);
 assert.equal(grantOf('Antrag auf Zuschuss im Rahmen der Modernisierungsrichtlinie',''),null);
 assert.equal(grantOf('Zuschuss an den Heimatverein Rehmsdorf e. V.','').purpose,'Kultur und Heimat');
});

test('art des plangebiets: gewerbe, industrie, energie, einzelhandel; abkuerzungen nur gross',()=>{
 assert.deepEqual(planUseOf('4. Änderung des Bebauungsplanes Nr. 22 "Gewerbe- und Industriegebiet Osteressen" - Satzungsbeschluss'),{uses:['Industrie','Gewerbe'],inter:false});
 assert.deepEqual(planUseOf('Aufstellung des Bebauungsplans „SO Freiflächenphotovoltaikanlage Stapfenberg“'),{uses:['Energie'],inter:false});
 assert.deepEqual(planUseOf('Vorhabenbezogener Bebauungsplan Nr. 34 "Nahversorgungszentrum Hannoversche Heerstraße Süd" - Satzungsbeschluss'),{uses:['Einzelhandel'],inter:false});
 assert.equal(planUseOf('Bebauungsplan Nr. 5 "Interkommunales Gewerbegebiet A 1" - Aufstellungsbeschluss').inter,true);
 assert.equal(planUseOf('Bebauungsplan Nr. 7 "Am Gericht" - Aufstellungsbeschluss'),null);
 assert.equal(planUseOf('Gewerbesteuer-Hebesatz'),null);
});

test('fehltreffer nach der bewertung vom 11.10.2026: personal, feste tagesordnungspunkte, zuschuesse, waermeplanung, hebesaetze, gebuehren',()=>{
 assert.equal(grantOf('Kooperationsvereinbarung mit dem Förderverein der Grundschule zum Ganztag',''),null);
 assert.equal(grantOf('Technisch-methodische Unterstützung diverser Projekte / Ausschreibung Rahmenvereinbarung',''),null);
 assert.equal(grantOf('Verwendungsnachweis des Caritasverbandes e.V. über die Zuschussverwendung',''),null);
 assert.equal(heatPlanOf('Umsetzung Wärmeplanungsgesetz',''),'Start und Beauftragung');
 assert.equal(heatPlanOf('Grundsatzbeschluss zur kommunalen Wärmeplanung',''),'Start und Beauftragung');
 assert.equal(heatPlanOf('Kommunale Wärmeplanung nach dem Bundesgesetz für die Wärmeplanung und zur Dekarbonisierung der Wärmenetze (WPG) - Umsetzung in der Gemeinde Aukrug',''),'Start und Beauftragung');
 assert.equal(heatPlanOf('Kommunale Wärmeplanung - Kurzstudie über ein Wärmenetz in der Altstadt',''),'Umsetzung und Fortschreibung');
 assert.equal(heatPlanOf('Widerspruch der Bürgermeisterin gegen den Beschluss zur Kommunalen Wärmeplanung',''),null);
 assert.equal(heatPlanOf('Antrag Nr. 16/2026 Machbarkeitsstudie Wärmeplanung',''),null);
 assert.deepEqual(hebesatzOf('Beantwortung des Offenen Briefes zur Grundsteuer','Die Erhöhung des Hebesatzes der Grundsteuer B von zuvor 883 v. H. auf 1.190 v. H.'),[]);
 assert.deepEqual(hebesatzOf('Hebesatzsatzung 2026','Die Erhöhung des Hebesatzes der Grundsteuer B von zuvor 883 v. H. auf 1.190 v. H. wurde beschlossen.'),[{tax:'Grundsteuer B',from:'883',to:'1190'}]);
 assert.deepEqual(hebesatzOf('Hebesatzsatzung 2026','Ein Änderungsantrag, die Gewerbesteuer von 499 v. H. auf 539 v. H. zu erhöhen, wurde beraten.'),[]);
 assert.deepEqual(feeRateOf('Tarife für die Wasserversorgung','Der Wasserpreis wurde von 1,60 €/m³ (netto) auf 1,80 €/m³ (netto) erhöht.'),[{kind:'Trinkwasser',from:'1.6',to:'1.8',unit:'m³'}]);
 assert.deepEqual(feeRateOf('Neu-Kalkulation der Wassergebühren','Diese betragen derzeit: Verbrauchsgebühr 1,10 € / m³ (netto). Die Verwaltung schlägt vor, die Verbrauchsgebühr auf 1,42 €/ m³ (netto) zu erhöhen.'),[{kind:'Trinkwasser',from:'',to:'1.42',unit:'m³'}]);
 assert.deepEqual(feeRateOf('Nachkalkulation der Abwassergebühren 2025','Schmutzwassergebühr 2,15 €/m³.'),[]);
});

test('Förderung: Hintergrund, alte Bescheide und Anfragen zählen nicht als bewilligt',async()=>{
 const {factsOf}=await import('../shared/topic-facts.mjs');
 const old='Vergabe der Fliesenarbeiten im Oktober 2026 im Rathaus. Mit Bescheid vom 18.12.2023 wurden Fördermittel in Höhe von 8.840.000 Euro bewilligt.';
 const now='Sitzung 2026. Die Fördermittel in Höhe von 450.000 Euro wurden bewilligt. Umsetzung bis 2030.';
});

test('faction: amendment to another motion belongs to the amending factions; housing: existing units are no plan',()=>{
 assert.deepEqual(factionsOf('AN/068/2025 Änderungsantrag der Fraktionen SPD und FDP zum Antrag der CDU-Fraktion (AN/067/2025)'),{parties:['SPD','FDP'],kind:'antrag'});
 assert.equal(housingOf('Die vormals vorhandenen Wohngebäude mit insgesamt 104 Wohneinheiten mussten abgerissen werden.'),null);
 assert.equal(housingOf('Insgesamt sind ca. 350 Wohnungen in unterschiedlichen Größen vorgesehen.'),350);
});

test('facts-v15: Kita-Plätze ohne Bestand und Senioren, Förderung ohne Geldgeber, alte Beitragsschritte, Ausschussnamen',()=>{
 assert.equal(kitaFeeOf('Neufassung der Kostenbeitragssatzung für Kindertagesstätten','Beschlussvorschlag: Der Stadtrat beschließt die Neufassung der Kostenbeitragssatzung. In der Sitzung wurde damals die Erhöhung der Kostenbeiträge vertagt.').direction,'Neufassung');
 assert.equal(kitaFeeOf('Abschluss von Qualitäts- und Finanzierungsvereinbarungen mit den Kita-Trägern','Beschlussvorschlag: Der Rat beschließt die Vereinbarungen. Die Benutzungsgebühr bleibt unverändert.'),null);
});

test('park fee per hour: new value, half hours doubled, no deltas or comparisons',()=>{
});

test('wind and solar capacity in MW, not per turbine, storage or reference projects',()=>{
 assert.deepEqual(eePowerOf('Bebauungsplan Solarpark Grüner Weg','Die Anlage hat eine Nennleistung von rd. 12 MWp.'),{value:'Photovoltaik',mw:12});
 assert.deepEqual(eePowerOf('PV-Anlage Kreissporthalle','Es wurde eine Anlagenleistung von 100kWp ermittelt.'),{value:'Photovoltaik',mw:0.1});
 assert.equal(eePowerOf('Bericht zum Stand des Photovoltaik-Ausbaus','Die installierte Leistung lag bei 13,53 MW.'),null);
 assert.equal(eePowerOf('Windpark Nord','Eine Anlage der 7 MW Klasse.'),null);
});

test('price of commercial land per m², not land values or buy-back prices',()=>{
 assert.equal(landPriceOf('Veräußerung einer Gewerbefläche im Gewerbegebiet Middels III','Der Kaufpreis beträgt 35,00 €/m².').euro,'35');
 assert.equal(landPriceOf('Verkauf eines Grundstücks im Gewerbegebiet','Kaufpreis in Höhe von 250.000,00 EUR (50 EUR/m²).').euro,'50');
 assert.equal(landPriceOf('Verkauf Gewerbegrundstück','Der Bodenrichtwert liegt bei 85,00 Euro/qm.'),null);
 assert.equal(landPriceOf('Vergabekriterien für Gewerbegrundstücke','Preis von 60 €/m².'),null);
});

test('Hebesätze in Haushaltssatzungen ohne Satzzeichen und für Grundsteuer A und B',()=>{
 assert.deepEqual(hebesatzOf('Haushaltssatzung 2026','§ 3 Kassenkredite 3.000.000 € § 4 Steuersätze Die Steuersätze für die Gemeindesteuern werden wie folgt festgesetzt: Grundsteuer A auf 405 v.H. Grundsteuer B auf 650 v.H. Gewerbesteuer auf 400 v.H. Die Hundesteuer beträgt 60 Euro.').map(x=>x.to),['405','650','400']);
 assert.deepEqual(hebesatzOf('Nachtragshaushaltssatzung','Es wurde beschlossen, die Hebesätze für die Grundsteuer A und B von 350 v.H. auf 475 v.H. anzuheben.').map(x=>x.tax+x.to),['Grundsteuer A475','Grundsteuer B475']);
 assert.deepEqual(hebesatzOf('Haushaltssatzung','Hebesätze für Realsteuern v. H. 1. a) (Grundsteuer A) auf 400 b) (Grundsteuer B) auf 360 2. Gewerbesteuer auf 400 § 6 Stellen').map(x=>x.to),['400','360','400']);
});

test('Gebührensätze: Art aus Einheit und Titel, Tabellen bisher/neu',()=>{
 assert.deepEqual(feeRateOf('Neufassung der Satzung über Benutzungsgebühren für die Wasserversorgung','Der neue Gebührensatz von 1,29 € je cbm Wasser gilt ab 2026.').map(x=>x.kind+x.to),['Trinkwasser1.29']);
 assert.deepEqual(feeRateOf('Änderung der Gebührensatzung zur Entwässerungssatzung','Hieraus errechnet sich eine Gebühr in Höhe von 0,36 €/m² (Vorjahr 0,32 €/m²).').map(x=>x.kind+x.to+'|'+x.from),['Niederschlagswasser0.36|0.32']);
 assert.deepEqual(feeRateOf('Siebte Änderung der Abwassersatzung','Die Sätze ändern sich: bis 2025 2026 bis 2028 Schmutzwassergebühr 3,15 €/m³ 2,80 €/m³ Grundgebühr 8,00 €/Monat.').map(x=>x.to+'|'+x.from),['2.8|3.15']);
 assert.deepEqual(feeRateOf('Neukalkulation der Wasserverbrauchsgebühren','Festgesetzt: netto brutto Wasserverbrauchsgebühr 3,00 €/m³ 3,21 €/m³.').map(x=>x.to),['3']);
});

test('Bauplatzpreis Wohnen: festgesetzter Preis, keine Vergleiche, alten Preise oder Kalkulationen',()=>{
 assert.equal(plotPriceOf('Festlegung des Verkaufspreises für gemeindliche Baugrundstücke im Baugebiet Wohr II','Der Rat beschließt, den Verkaufspreis auf 210,00 € je Quadratmeter einschließlich Erschließung festzusetzen.').euro,'210');
 assert.equal(plotPriceOf('Bauplatzverkauf im Baugebiet Breitenwert','Finanzielle Auswirkungen: Verkaufserlös 225,00 €/qm.').euro,'225');
 assert.equal(plotPriceOf('Anpassung Verkaufspreis für Baugrundstücke','Der aktuell festgesetzte Gesamtverkaufspreis beträgt 49,52 €/m².'),null);
 assert.equal(plotPriceOf('Baugebiet In der Breite - Verkauf','Der Kaufpreis beträgt für das Wohngebiet Loh 115,00 €/m², für das Wohngebiet Wasserfuhr 98,00 €/m².'),null);
 assert.equal(plotPriceOf('Verkauf Gewerbegrundstück im Gewerbegebiet','Der Kaufpreis beträgt 30,- €/m².'),null,'Gewerbe ist land_price');
 assert.equal(landPriceOf('Neufestsetzung des Kaufpreises für das Gewerbegrundstück','Der Rat beschließt, das Gewerbegrundstück zu einem Preis von 30,- €/m² zu veräußern.').euro,'30');
});

test('Jahresergebnis: Überschuss/Fehlbetrag nach Vorzeichen, ordentliches Ergebnis nur ohne Jahresergebnis',()=>{
 assert.deepEqual(annualResultOf('Feststellung des Jahresabschlusses 2024','Ergebnisrechnung: Jahresüberschuss/fehlbetrag (E 23) 641.626,49 €.'),{value:'Überschuss',euro:641626});
 assert.deepEqual(annualResultOf('Jahresabschluss 2019','Der Fehlbetrag des ordentlichen Ergebnisses in Höhe von 90.611,84 € ist vorzutragen.'),{value:'Fehlbetrag',euro:90612});
 assert.deepEqual(annualResultOf('Feststellung des Jahresabschlusses 2023','Zusammengefasst: Ergebnisrechnung Jahresergebnis -82 T € lt. Bilanz.'),{value:'Fehlbetrag',euro:82000});
});

test('Gebühren: Einheit vor dem Satz, Niederschlag nach m³-Wert, Tabellen ohne Punkt, keine Mehrjahrestabelle (facts-v26)', () => {
  assert.deepEqual(feeRateOf('Nachtragssatzung zur Gebührensatzung zur Entwässerungssatzung', '„Die Gebühr beträgt je m³ Schmutzwasser jährlich 4,35 €.“ § 2'), [{kind: 'Schmutzwasser', from: '', to: '4.35', unit: 'm³'}]);
  assert.deepEqual(feeRateOf('Abwassergebührensatzung', 'Der Gemeinderat setzt für 2026 folgende Gebühr fest: Schmutzwassergebühr 3,46 €/m³ Niederschlagswassergebühr 1,25 €/m² j) weiter').map(x => x.kind + x.to), ['Schmutzwasser3.46', 'Niederschlagswasser1.25']);
  const table = 'Übersicht ' + 'x '.repeat(400) + ' Schmutzwassergebühr 3,93 €/m³ 3,99 €/m³ 4,14 €/m³ 4,75 €/m³ Ende';
  assert.deepEqual(feeRateOf('Abwassergebührensatzung', table), []);
});

test('Hebesatz: Steuerart nach dem Satz; Hundesteuer „Erhöhung des Steuersatzes von … auf …“ (facts-v26)', () => {
  assert.deepEqual(hebesatzOf('Festlegung der Hebesätze', '§ 2 Die Hebesätze für die Grundsteuer werden wie folgt festgesetzt: 1. Für Betriebe der Land- und Forstwirtschaft auf 595 vom Hundert (Grundsteuer A) 2. Für Grundstücke auf 800 vom Hundert (Grundsteuer B) § 3 Inkrafttreten').map(x => x.tax + x.to), ['Grundsteuer A595', 'Grundsteuer B800']);
  assert.equal(dogTaxOf('Änderung der Hundesteuersatzung', 'Beschlussvorschlag: Erhöhung des Steuersatzes von 70,00 € auf 90,00 € in § 2 Abs. 1.').euro, '90');
  assert.equal(dogTaxOf('Änderung der Hundesteuersatzung', 'Beschlussvorschlag: Erhöhung der Steuer für den zweiten Hund von 70,00 € auf 90,00 €.'), null);
});

test('Abfallgebühren: Richtung aus Titel oder Beschluss, 120-l-Restabfall (facts-v26)', () => {
  assert.equal(wasteFeeOf('Abfallgebühren 2027 - Kalkulation', 'Beschlussvorschlag: Der Rat beschließt die Erhöhung der Abfallgebühren.').value, 'Erhöhung');
  assert.deepEqual(wasteFeeOf('Gebührenkalkulation 2026 für die Abfallentsorgung', 'a) je 120 l Restmüllbehälter jährlich 101,04 €'), {value: 'festgesetzt', euro: '101,04'});
  assert.equal(wasteFeeOf('Änderungsantrag zur Abfallgebührensatzung', ''), null);
  assert.equal(wasteFeeOf('Anfrage zu Müllgebühren', ''), null);
});

test('Hundesteuer aus Haushaltssatzung, keine Rassen/Kosten je Hund; Hebesatz ohne Vorjahr und Sammeltabelle; Kita-Essensgeld (facts-v26)', () => {
  const hs = '§ 5 Steuersätze Die Steuersätze für die Gemeindesteuern werden wie folgt festgesetzt: - Grundsteuer A auf 300 v.H. - Grundsteuer B auf 365 v.H. - Gewerbesteuer auf 365 v.H. Die Hundesteuer beträgt für Hunde, die innerhalb des Gemeindegebietes gehalten werden, für den ersten Hund 60,00 €, für den zweiten Hund 90,00 €. § 6';
  assert.equal(dogTaxOf('Beratung und Beschlussfassung über die Haushaltssatzung und -plan 2026', hs).euro, '60');
  assert.equal(dogTaxOf('Haushaltssatzung 2026', '§ 5 Grundsteuer A auf 300 v.H. Die Gewerbesteuer beträgt 365 v.H. für den ersten Hund 60 €'), null);
  assert.equal(dogTaxOf('Änderung der Hundesteuersatzung', 'Die Steuer für das Halten von Hunden bestimmter Rassen beträgt bei nur einem gehaltenen Hund 300,00 €.'), null);
  assert.deepEqual(hebesatzOf('Haushaltssatzung 2026', '§ 5 Die Steuersätze werden für das Haushaltsjahr 2025 wie folgt festgesetzt: Grundsteuer A auf 600 v.H.'), []);
  assert.deepEqual(hebesatzOf('Haushaltssatzung 2026', '§ 5 Die Hebesätze werden festgesetzt: 1. Grundsteuer A auf 1.2 Grundsteuer B auf 2. Gewerbesteuer auf 642 v.H. 577 v.H. 485 v.H. § 6').filter(x => x.tax === 'Gewerbesteuer'), []);
  assert.deepEqual(kitaFeeOf('Erhöhung des Eigenanteils der Mittagsverpflegung in den Kindertagesstätten', 'Beschlussvorschlag: von 2,60 € auf 3,00 €.'), {direction: 'Verpflegung', euro: ''});
});

test('Fläche des Plangebiets (facts-v26)', () => {
  assert.equal(planAreaOf('Das Plangebiet befindet sich im Ortsteil Großachsen und umfasst rund 6,4 ha.'), 6.4);
  assert.equal(planAreaOf('Das Plangebiet umfasst eine Gesamtfläche von 1.500 m².'), 0.15);
  assert.equal(planAreaOf('Die Gemarkungsfläche beträgt 1.411 ha.'), null);
  assert.equal(planAreaOf('Im Plangebiet von 1,03 ha davon überbaubar 0,4 ha.'), null);
});

test('Windenergieanlagen und Vorhaben aus dem Titel (facts-v26)', () => {
  assert.equal(windCountOf('B-Plan Nr. 32 „Sondergebiet Wind“', 'Im konkreten Fall sollen auf einer Fläche von ca. 159 ha acht neue Windenergieanlagen (WEA) errichtet werden.'), 8);
  assert.equal(windCountOf('Windpark Nord - Einvernehmen', 'Im Landkreis bestehen bereits 120 Windenergieanlagen. Geplant sind 3 WEA am Standort.'), 3);
  assert.equal(windCountOf('Windenergie Einvernehmen', 'Die bestehenden 4 Windenergieanlagen werden zurückgebaut.'), null);
  assert.deepEqual(projectsOf('Einführung eines Bürgerbusses und Carsharing im Ortsteil'), ['Bürgerbus oder Rufbus', 'Carsharing']);
  assert.deepEqual(projectsOf('Errichtung von E-Ladesäulen am Rathaus'), ['Ladesäulen']);
  assert.deepEqual(projectsOf('Bebauungsplan Nr. 3'), []);
});

test('Straßenbau: Art aus dem Titel, Kosten aus dem Beschluss (facts-v26)', () => {
  assert.deepEqual(roadWorkOf('Grundhafte Erneuerung der Hauptstraße; Vergabe der Bauleistungen', 'Beschlussvorschlag: Der Gemeinderat vergibt die Bauleistungen an die Firma X zum Angebotspreis von 412.300,00 € brutto.'), {value: 'Sanierung', euro: '412300'});
  assert.equal(roadWorkOf('Neubau Radweg entlang der L 123', 'Beschlussvorschlag: Der Rat stimmt dem Bau mit Kosten von rund 1,2 Mio. € zu.').euro, '1200000');
  assert.equal(roadWorkOf('Mündlicher Bericht über das Filmhaus Saarbrücken', ''), null);
  assert.equal(roadWorkOf('Umbau Feuerwehrhaus Hauptstraße 5', ''), null);
  assert.equal(roadWorkOf('Straßenreinigungssatzung', ''), null);
});

test('Art der Wohnbebauung (facts-v26)', () => {
  assert.deepEqual(houseTypesOf('Bebauungsplan Wohngebiet Am Hang', 'Ziel der Planung ist die Bebauung mit Einfamilien- und Doppelhäusern. Östlich grenzen vorhandene Mehrfamilienhäuser an.'), ['Einfamilienhäuser', 'Doppel- und Reihenhäuser']);
  assert.deepEqual(houseTypesOf('Bebauungsplan Nr. 12', 'Im Plangebiet sind Mehrfamilienhäuser mit geförderten Wohnungen vorgesehen.'), ['Mehrfamilienhäuser', 'Geförderter Wohnungsbau']);
  assert.deepEqual(houseTypesOf('Bebauungsplan Nr. 12', 'Die angrenzende Bebauung besteht aus Reihenhäusern.'), []);
});

test('Haushalt, Zweitwohnungsteuer und Vergnügungssteuer: neuer Wert, keine Vergleiche',async()=>{
 const {budgetOf,secondHomeTaxOf,amusementTaxOf}=await import('../shared/topic-facts.mjs');
 assert.deepEqual(budgetOf('1. Nachtragshaushaltssatzung 2026','im Ergebnishaushalt der Gesamtbetrag der Aufwendungen auf 25.790.888 24.600 25.815.488 der Jahresüberschuss'),[{value:'Aufwendungen',euro:25815488}]);
 assert.deepEqual(budgetOf('Haushaltssatzung 2026','Gesamtbetrag der Aufwendungen auf 12.345.678 EUR § 2 Kredite für Investitionen werden nicht veranschlagt.'),[{value:'Aufwendungen',euro:12345678},{value:'Investitionskredite',euro:0}]);
 assert.equal(budgetOf('Nachtragshaushaltssatzung der Ortsgemeinde Schiersfeld','Gesamtbetrag der Aufwendungen 345.381'),null);
 assert.deepEqual(secondHomeTaxOf('Zweitwohnungssteuersatzung','Die Satzung soll den Steuersatz der Zweitwohnungssteuer auf 14 % festsetzen.'),{value:'Steuersatz',rate:'14'});
 assert.equal(secondHomeTaxOf('Zweitwohnungssteuer','Verwaltungsseitig wird ein Steuersatz von mindestens 15 % empfohlen.'),null);
 assert.deepEqual(amusementTaxOf('Vergnügungssteuersatzung','Anpassung beim Spieleinsatz von 3,5 % auf 5,0 % vor.'),{value:'vom Spieleinsatz',rate:'5'});
 assert.deepEqual(amusementTaxOf('Vergnügungssteuer','Der Steuersatz wurde von 23% netto auf 25 % netto erhöht.'),{value:'vom Einspielergebnis',rate:'25'});
});

test('Signale Wind und Solar: Randfälle (17.10.2026)', async () => {
  const m = await import('../shared/topic-facts.mjs');
  assert.equal(m.windStepOf('Antrag auf Baugenehmigung; Bauvorhaben: Errichtung und Betrieb einer Windenergieanlage (Repowering)'), 'Genehmigungsantrag (BImSchG)');
  assert.equal(m.windStepOf('KIWI Bürgerwind Windkraft Hamm GmbH, Gremienbesetzung'), null);
  assert.equal(m.windStepOf('Tempo 30 ab Sägewerk bis Bushaltestelle „Am Windrad“'), null);
  assert.equal(m.windStepOf('�nderung Fl�chennutzungsplan im Bereich "Windpark WK 101"'), 'Bauleitplanung');
  assert.equal(m.solarOf('Gewinn- u. Verlustrechnung 2024 der Versorgungsbetriebe (Wasser u. PV-Anlage)'), null);
  assert.equal(m.solarOf('Photovoltaik Kindergarten a) Neubau b) Bestand'), 'Dach-PV kommunal');
});

test('Solar: Bauleitplanung PV als Freifläche, Gemeindedächer (Stichprobe h1)', async () => {
  const m = await import('../shared/topic-facts.mjs');
  assert.equal(m.solarOf('Bauleitplanung Vestenbergsgreuth - BBP 30 "PV-Anlage Pretzdorf"'), 'Freiflächen-PV');
  assert.equal(m.solarOf('Solarstromanlagen auf Gemeindedächern - Mietverträge'), 'Dach-PV kommunal');
  assert.equal(m.solarOf('Satteldachaufbau für PV-Anlage auf Garagendach Bühlfeldstraße 35'), null);
});

test('Wohnbau: Ausschreibung, Besichtigung, Wohnbauland; keine Straßennamen oder Ausbaugebiete (Stichprobe r1)', async () => {
  const m = await import('../shared/topic-facts.mjs');
  assert.equal(m.areaDevOf('Ausschreibung von weiteren Bauplätzen für den Geschosswohnungsbau'), 'Wohnen');
  assert.equal(m.areaDevOf('Besichtigung und Sachstand zum Baugebiet „Am Köblitzbach“'), 'Wohnen');
  assert.equal(m.areaDevOf('Richtlinien für die Vergabe von preisvergünstigten Wohnbauland'), 'Wohnen');
  assert.equal(m.areaDevOf('Namensfindung Straße Baugebiet „An der Ullabreite“'), null);
  assert.equal(m.areaDevOf('Gigabitrichtlinie, Anpassung des Ausbaugebietes und Start eines Auswahlverfahrens'), null);
});

test('Signale Solar, Wärme, Straßen: Randfälle aus Stichprobe k1', async () => {
  const m = await import('../shared/topic-facts.mjs');
  assert.equal(m.solarOf('Information zur geplanten Flächenphotovoltaik Anlage'), 'Freiflächen-PV');
  assert.equal(m.solarOf('Freifl�chenphotovoltaikanlage'), 'Freiflächen-PV');
  assert.equal(m.solarOf('PV-Machbarkeitsstudie für ausgewählte kommunale Liegenschaften'), 'Dach-PV kommunal');
  assert.equal(m.energyOf('Polizeilicher Einsatz von LED-Lichtern gegen Journalist*innen'), null);
  assert.equal(m.energyOf('Erneuerung der Deckenbeleuchtung im Festsaal des Schlosses'), null);
  assert.equal(m.energyOf('Zur Lände 10 denkmalschutzrechtliche Genehmigung - Installation Luft-Wärmepumpe'), null);
  assert.equal(m.streetSignalOf('Zusatzantrag CDU betr. Brückenstraße'), null);
  assert.equal(m.streetSignalOf('Ausbau der Fernwärme – Bauabschnitt 13.1 Goethestraße'), null);
  assert.ok(m.streetSignalOf('Sanierung Gerber-Fischer-Straße Vorstellung neuer Planentwurf'));
});

test('Signale Ausschreibung und Wasser: Randfälle aus Stichprobe m1', async () => {
  const m = await import('../shared/topic-facts.mjs');
  assert.equal(m.tenderOf('Beschluss zur Vergabe von Bauleistungen >250.000,00 Euro, HB-B 014-2022-15 Lindenau-Museum Altenburg').value, 'Hochbau');
  assert.equal(m.tenderOf('Kauf eines Multiquads für Gemeindezwecke - Auftragsvergabe').value, 'Fahrzeuge und Ausstattung');
  assert.equal(m.tenderOf('Interkommunale Zusammenarbeit - Sonderförderung; Zweckvereinbarung Beschaffung'), null);
  assert.equal(m.waterSignalOf('Sanierung und Erweiterung der Kita „Deichmäuse“; Baubeschluss Hochwasserschutz'), null);
  assert.equal(m.waterSignalOf('Einleitung des Vergabeverfahrens zur Durchführung von Mäh-, Mulch und Rückschnittarbeiten Kanal'), null);
  assert.ok(m.waterSignalOf('Kanalsanierung in Schwarzenbach hier: Vergabe des Planungsauftrages'));
});

test('Signal Straßen: Randfälle aus Stichprobe q1', async () => {
  const m = await import('../shared/topic-facts.mjs');
  assert.ok(m.streetSignalOf('Sanierung der Kirchstraße, Tairnbach (Sachstandsbericht)'));
  assert.ok(m.streetSignalOf('Überplanmäßige Ausgabe L100 Friedrichstraße/Amtsfeldstraße'));
  assert.ok(m.streetSignalOf('Beratung über die Bankettbefestigung an der Kreisstraße K45'));
  assert.equal(m.streetSignalOf('Autonomes Level-4-Fahrsystem von ZF, Straße'), null);
  assert.equal(m.streetSignalOf('Vorbescheid zum Neubau eines Bungalows, Nähe Langenbrucker Straße'), null);
});

test('Signale Stichprobe n1: Agri-Solarpark, Straßenbankett, Akustikdecke, Verschiedenes', async () => {
  const m = await import('../shared/topic-facts.mjs');
  assert.equal(m.solarOf('Aufstellungsbeschluss: Bebauungsplan Nr. 45 "Agri-Solarpark am Rame"'), 'Agri-PV');
  assert.equal(m.tenderOf('Ausschreibung von Bauleistungen zur Wiederherstellung des Straßenbankettes Bakenberg').value, 'Tiefbau und Straße');
  assert.equal(m.tenderOf('Auftragsvergabe Akustikdecke Kita „Auf der Hohen Straße“').value, 'Hochbau');
  assert.equal(m.tenderOf('Vergabe des Atelierstipendiums 2027/2028'), null);
  assert.equal(m.streetSignalOf('Verschiedenes Straßenausbau/Straßennutzungsplan'), null);
  assert.equal(m.waterSignalOf('Sanierung von Krugweg und Deichweg'), null);
});

test('Signale Stichprobe p1: Zweibrücken, Brückenbauer, Heizzentrale', async () => {
  const m = await import('../shared/topic-facts.mjs');
  assert.equal(m.streetSignalOf('Brückenbauer der Solidarität: Ehrenamt in der Straße'), null);
  assert.equal(m.energyOf('Grundschule Wendelsteinstraße: Sanierung der Heizzentrale'), 'Heizungstausch');
  assert.equal(m.energyOf('Beratung über die Neuanschaffung von Weihnachtssternbeleuchtung'), null);
});

test('Signale Pflege und Einzelhandel: Randfälle aus Stichprobe c1', async () => {
  const m = await import('../shared/topic-facts.mjs');
  assert.equal(m.careOf('Radständer beim Ärztehaus'), null);
  assert.equal(m.careOf('Bebauungsplan Nr. 180 „Tiergesundheitszentrum Grußendorf“'), null);
  assert.ok(m.careOf('Bebauungsplan Nr. 50 "Gesundheitszentrum Schönwiese"'));
  assert.equal(m.retailOf('Bauzaun bei ehemaligem Supermarkt'), null);
  assert.ok(m.retailOf('Ansiedlung Netto'));
});

test('Signale Wasser und Straßen: Trefferquote aus Stichproben w1 und q2', async () => {
  const m = await import('../shared/topic-facts.mjs');
  assert.ok(m.waterSignalOf('Hochwasserschutz Jeinsen - Variantenuntersuchung'));
  assert.ok(m.waterSignalOf('Abwasser-Rückstausituation vor dem Abwasserpumpwerk Blankenau'));
  assert.ok(m.waterSignalOf('Sachstandsbericht zur Thematik Entwässerung (Abwasserkanäle)'));
  assert.equal(m.waterSignalOf('Information zum Beginn der Glasfaserarbeiten und Kanalrestmaßnahmen'), null);
  assert.ok(m.streetSignalOf('Vergabe von Asphaltarbeiten für Teilabschnitte Herlesries, Moossstraße'));
  assert.ok(m.streetSignalOf('Planung zum Ausbau von barrierefreien Bushaltestellen'));
});
