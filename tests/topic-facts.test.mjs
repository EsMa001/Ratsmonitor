// Fakten für plenara.X: Fraktion als Antragsteller, Förderprogramme (shared/topic-facts.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {factionsOf,housingOf,kitaPlacesOf,kitaFeeOf,fundingOf,fundingEuroOf,factsOf,hebesatzOf,feeRateOf,heatPlanOf,grantOf,planUseOf,parkFeeOf,eePowerOf,landPriceOf} from '../shared/topic-facts.mjs';

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

test('funding: program in a funding sentence, granted before applied before mentioned',()=>{
 const text='Die Stadt hat für den Ganztagsausbau einen Förderbescheid über 1,2 Mio. Euro erhalten. Für den Radweg wird ein Förderantrag im Programm Stadt und Land gestellt. Das Denkmal am Markt wird gereinigt. Die Sprachförderung in Kitas wird fortgesetzt.';
 assert.deepEqual(fundingOf(text),[{program:'Ganztagsausbau',status:'granted'},{program:'Radverkehr',status:'applied'}]);
 assert.deepEqual(fundingOf('Für die Sanierung wurde ein Zuwendungsbescheid erteilt.'),[{program:'Sonstige Förderung',status:'granted'}]);
 assert.deepEqual(fundingOf('Die Förderung von Langzeitarbeitslosen im Jobcenter wird ausgebaut.'),[],'Arbeitsförderung ist kein Fördergeld');
 assert.deepEqual(fundingOf('Eine Förderung ist grundsätzlich denkbar.'),[],'bloße Erwähnung ohne Programm zählt nicht');
 assert.deepEqual(fundingOf('Der Denkmalschutz wurde beteiligt. Die Feuerwehr rückte aus.'),[],'Programmwort ohne Förderung zählt nicht');
});

test('factsOf combines both kinds',()=>{
 const only=(t,x)=>factsOf(t,x).filter(r=>!r.kind.startsWith('radar:'));
 assert.deepEqual(only('Antrag der CDU-Fraktion: Sportplatz','Wir beantragen Fördermittel aus der Sportstättenförderung.'),[
  {kind:'faction',value:'CDU/CSU',detail:'antrag'},{kind:'funding',value:'Sportstätten',detail:'applied'}]);
 assert.deepEqual(only('Antrag der CDU-Fraktion: Sportplatz',''),[{kind:'faction',value:'CDU/CSU',detail:'antrag'}]);
});

test('collective items yield no funding facts unless their title is about funding',()=>{
 const t='Für den Ganztagsausbau liegt ein Förderbescheid vor.';
 assert.deepEqual(factsOf('Mitteilungen der Verwaltung',t),[]);
 assert.deepEqual(factsOf('Einbringung des Haushaltes 2027',t),[]);
 assert.deepEqual(factsOf('Sachstand Fördermittel Ganztag',t),[{kind:'funding',value:'Ganztagsausbau',detail:'granted'}]);
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
 const {kitaFeeOf,kitaPlacesOf}=await import('../shared/topic-facts.mjs');
 assert.deepEqual(kitaFeeOf('Satzung über Elternbeiträge in Kindertageseinrichtungen','Beschlussvorschlag: Die Elternbeiträge für Kinder in der Kita werden zum 1.8. um 5 % erhöht.'),{direction:'Erhöhung',euro:''});
 assert.equal(kitaFeeOf('Satzung über Elternbeiträge in Kindertageseinrichtungen','Im Jahr 2023 wurden die Elternbeiträge der Kita erhöht. Beschlussvorschlag: Die Satzung wird neu gefasst.').direction,'Neufassung','Richtung nicht aus dem Hintergrund');
 assert.equal(kitaFeeOf('Information zu den Kita-Elternbeiträgen ab 01.01.2027','Beschlussvorschlag: Für Kinder in der Kita gelten die Absenkungsbeiträge, die Beiträge werden gesenkt.').direction,'Neufassung','Information ohne Richtung im Titel');
 assert.equal(kitaFeeOf('Absenkungsbeiträge für Kita-Elternbeiträge','').direction,'Neufassung','Absenkungsbeitrag ist keine Senkung');
 assert.equal(kitaFeeOf('Kita-Beiträge','Beschlussvorschlag: Das letzte Kita-Jahr bleibt beitragsfrei.').direction,'Beitragsfreiheit');
 assert.equal(kitaFeeOf('Antrag: Reduzierung der Elternbeiträge für Kindertageseinrichtungen','Wegen der Steigerung der Kosten in der Kita …').direction,'Senkung','Titel vor Text');
 assert.equal(kitaFeeOf('Beitragssatzung über wiederkehrende Straßenbeiträge','Die Beiträge werden erhöht.'),null,'Straßenbeiträge sind keine Kita-Beiträge');
 assert.equal(kitaFeeOf('Festsetzung der Elternbeiträge für die Verpflegung in den Kitas','Die Verpflegungspauschale beträgt 3,50 Euro.').direction,'Verpflegung');
 assert.equal(kitaFeeOf('Mitteilungen','Elternbeiträge in der Kita werden erhöht.'),null,'Sammelpunkt');
 assert.equal(kitaPlacesOf('Neubau Kita Siedlung Kohlheck','Für 2026 Kita-Plätze fehlen. In der neuen Kita entstehen 75 Plätze.'),75);
 assert.equal(kitaPlacesOf('Einheitliche Elternbeiträge','Mit dem Ausbau gibt es in den Kitas 564 Plätze.'),null,'kein Ausbau im Titel');
 assert.equal(kitaPlacesOf('Spielplatz','Es entstehen 12 neue Parkplätze.'),null);
 assert.equal(kitaPlacesOf('Schließung eines Kita-Standortes','In der Kita entfallen 77 Plätze durch die Schließung.'),null);
 assert.equal(kitaPlacesOf('Situationsbericht Kindertagesstätten','Durch den Ausbau stehen in den Kitas 928 Plätze zur Verfügung.'),null,'Gesamtbestand');
 assert.equal(kitaPlacesOf('Unterbringung von Geflüchteten','Neben der Kita entstehen 300 neue Plätze in der Unterkunft.'),null);
});

test('funding amounts: only the amount attached to a funding word, never costs, own share, limits or program pools',()=>{
 const e=t=>fundingEuroOf(t).map(x=>[x.program,x.euro]);
 assert.deepEqual(e('Für den Ganztagsausbau wurde eine Zuwendung in Höhe von 450.000 € bewilligt.'),[['Ganztagsausbau',450000]]);
 assert.deepEqual(e('Die Gesamtkosten betragen 2,4 Mio. €, die Fördermittel aus der Städtebauförderung 1,2 Mio. Euro.'),[['Städtebauförderung',1200000]]);
 assert.deepEqual(e('Es wurden 120.000 € Landesmittel beantragt.'),[['Sonstige Förderung',120000]]);
 assert.deepEqual(e('Der Zuschuss des Landes beträgt 350 TEUR.'),[['Sonstige Förderung',350000]]);
 assert.deepEqual(e('Der Zuschuss beträgt 350 TEUR.'),[],'Zuschuss ohne Geldgeber: meist von der Kommune selbst');
 assert.deepEqual(e('Die Förderquote beträgt 80 % der förderfähigen Kosten von 500.000 €.'),[],'förderfähige Kosten');
 assert.deepEqual(e('Die Förderung beträgt bis zu 200.000 €.'),[],'Höchstbetrag');
 assert.deepEqual(e('Finanzschwache Kommunen erhalten einen Fördersatz von 90 % (maximale Fördersumme 200.000 Euro).'),[],'Höchstbetrag vor dem Förderwort');
 assert.deepEqual(e('Der durch Zuwendungen nicht gedeckte Anteil von 303.750 € muss über den Haushalt finanziert werden.'),[],'Eigenanteil');
 assert.deepEqual(e('Für den Projektaufruf 2026 stehen Bundesmittel in Höhe von 250 Mio. Euro zur Verfügung.'),[],'Programmtopf');
 assert.deepEqual(e('Der städtische Zuschuss für den Ersatzneubau in Höhe von 60,5 Mio. € wird beschlossen.'),[],'Zuschuss der Kommune selbst');
 assert.deepEqual(e('Gesamtsumme 9,1 Mio. € Fördermittel 6,37 Mio. € Eigenanteil 2,73 Mio. €'),[['Sonstige Förderung',6370000]],'Tabelle: kein Betrag vor dem Förderwort');
});

test('funding amounts: outgoing grants, donations, ranges and per-unit amounts are not funding (Referenzsatz 13.10.2026)',()=>{
 const e=t=>fundingEuroOf(t).map(x=>x.euro);
 assert.deepEqual(e('Der Förderverein erhält somit auch im Jahr 2027 für den Badbetrieb einen jährlichen Zuschuss in Höhe von 70.000 €.'),[],'Zuschuss an Verein');
 assert.deepEqual(e('Der Kreisausschuss ist zuständig für die Annahme von Spenden und ähnlichen Zuwendungen in einer Wertgrenze von über 1.000 EUR.'),[],'Spende, Wertgrenze');
 assert.deepEqual(e('Pro Projekt ist eine Förderung des Bundes von 250.000 € bis 1,50 Mio. € vorgesehen.'),[],'Spanne');
 assert.deepEqual(e('Damit kann mit einem Förderbetrag des Landes von 8.000 € pro Schuljahr gerechnet werden.'),[],'je Einheit, erwartet');
 assert.deepEqual(e('Für die Kläranlage wurde der Gemeinde eine Zuwendung des Landes in Höhe von 22.000 € bewilligt.'),[22000]);
 assert.deepEqual(e('Damit sind die Förder- mittel des Landes in Höhe von 5,125 Mio. € bis zum 30. Juni reserviert.'),[5125000],'Silbentrennung');
 assert.deepEqual(e('Eine Förderung aus LuKIF-Mittel ist bisher in Höhe von 5,913 Mio. Euro vorgesehen.'),[5913000],'Mio. ist kein Satzende');
});

test('funding amount without program goes to the only program of the report',()=>{
 const t='Für die Mensa wurden Fördermittel aus dem Programm Ganztagsausbau bewilligt. Der Förderbescheid über 300.000 € liegt vor.';
 assert.deepEqual(factsOf('Neubau Mensa',t).filter(r=>r.kind.startsWith('funding')),[{kind:'funding',value:'Ganztagsausbau',detail:'granted'},{kind:'funding_granted',value:'Ganztagsausbau',detail:''},{kind:'funding_euro',value:'Ganztagsausbau',detail:'300000'}]);
});

test('funding: form fields and conditional grants are not funding facts',()=>{
 assert.deepEqual(fundingOf('Finanzielle Auswirkungen: Fördermittel beantragt: Nein Ja Haushaltsmittel stehen bereit.'),[],'Formularfeld');
 assert.deepEqual(fundingOf('Vorbehaltlich der Förderzusage durch das Land wird die Radverkehrsanlage gebaut.'),[{program:'Radverkehr',status:'mentioned'}],'bedingt ist nicht bewilligt');
 assert.deepEqual(fundingOf('Der Förderbescheid für die Radwege liegt vor.'),[{program:'Radverkehr',status:'granted',sure:true}]);
});

test('outgoing grants to clubs and carriers are no funding for the municipality; fee amounts are whole numbers',async()=>{
 const {kitaFeeOf}=await import('../shared/topic-facts.mjs');
 assert.deepEqual(fundingOf('Der Karnevalsverein e. V. hat eine Zuwendung in Höhe von 3.000 EUR beantragt.'),[]);
 assert.deepEqual(fundingEuroOf('Der Karnevalsverein e. V. hat eine Zuwendung in Höhe von 3.000 EUR beantragt.'),[]);
 assert.deepEqual(fundingEuroOf('Für den Ganztagsausbau wurde eine Zuwendung in Höhe von 450.000 € bewilligt.').map(x=>x.euro),[450000]);
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
 const {fundingOf,fundingEuroOf,factsOf}=await import('../shared/topic-facts.mjs');
 assert.deepEqual(fundingOf('Bei Verzögerung droht der Verfall von Fördermitteln in Höhe von 12,2 Mio. Euro, die bewilligt wurden.'),[]);
 const old='Vergabe der Fliesenarbeiten im Oktober 2026 im Rathaus. Mit Bescheid vom 18.12.2023 wurden Fördermittel in Höhe von 8.840.000 Euro bewilligt.';
 assert.deepEqual(fundingEuroOf(old),[]);
 assert.deepEqual(fundingEuroOf('Dem stehen voraussichtlich Fördermittel in Höhe von etwa 23 Mio. € gegenüber.'),[]);
 assert.equal(fundingOf(old)[0]?.status??'mentioned','mentioned');
 const now='Sitzung 2026. Die Fördermittel in Höhe von 450.000 Euro wurden bewilligt. Umsetzung bis 2030.';
 assert.deepEqual(fundingEuroOf(now),[{program:'Sonstige Förderung',euro:450000}]);
 assert.equal(fundingOf(now)[0].status,'granted');
 assert.deepEqual(fundingOf('Für das Feuerwehrhaus wurden Fördermittel der Städtebauförderung bewilligt.').map(x=>x.program),['Städtebauförderung']);
 assert.ok(factsOf('Anfrage zu Fördermitteln für die Ortsmitte','Fördermittel wurden beantragt.').filter(r=>r.kind==='funding').every(r=>r.detail==='mentioned'));
});

test('faction: amendment to another motion belongs to the amending factions; housing: existing units are no plan',()=>{
 assert.deepEqual(factionsOf('AN/068/2025 Änderungsantrag der Fraktionen SPD und FDP zum Antrag der CDU-Fraktion (AN/067/2025)'),{parties:['SPD','FDP'],kind:'antrag'});
 assert.equal(housingOf('Die vormals vorhandenen Wohngebäude mit insgesamt 104 Wohneinheiten mussten abgerissen werden.'),null);
 assert.equal(housingOf('Insgesamt sind ca. 350 Wohnungen in unterschiedlichen Größen vorgesehen.'),350);
});

test('facts-v15: Kita-Plätze ohne Bestand und Senioren, Förderung ohne Geldgeber, alte Beitragsschritte, Ausschussnamen',()=>{
 assert.equal(kitaPlacesOf('Beratung und Beschlussfassung über den Neubau der KiTa Altenglan','Die Kindertagesstätten Altenglan und Mühlbach verfügen derzeit insgesamt über 100 Betreuungsplätze. Mit dem Neubau entstehen 125 Plätze in der neuen Kita.'),125);
 assert.equal(kitaPlacesOf('Erweiterungspläne für die Vita Tagespflege in Ochtrup','Durch die Erweiterung entstehen 11 neue Plätze in der Tagespflege.'),null);
 assert.deepEqual(fundingOf('Der Stadtbezirksbeirat hat die Förderung von Projekten bewilligt. Die Fördermittel werden ausgezahlt.'),[]);
 assert.deepEqual(fundingOf('Für den Mietwohnungsbau wurden Fördermittel des Landes bewilligt.'),[{program:'Wohnraumförderung',status:'granted',sure:true}]);
 assert.equal(kitaFeeOf('Neufassung der Kostenbeitragssatzung für Kindertagesstätten','Beschlussvorschlag: Der Stadtrat beschließt die Neufassung der Kostenbeitragssatzung. In der Sitzung wurde damals die Erhöhung der Kostenbeiträge vertagt.').direction,'Neufassung');
 assert.equal(kitaFeeOf('Abschluss von Qualitäts- und Finanzierungsvereinbarungen mit den Kita-Trägern','Beschlussvorschlag: Der Rat beschließt die Vereinbarungen. Die Benutzungsgebühr bleibt unverändert.'),null);
});

test('park fee per hour: new value, half hours doubled, no deltas or comparisons',()=>{
 assert.equal(parkFeeOf('2. Änderung der Parkgebührenordnung','Erhöhung der Parkgebühr von bislang 2,00 € pro Stunde auf 2,50 € pro Stunde.').euro,'2.50');
 assert.equal(parkFeeOf('Parkgebührenordnung','Gebühren in Höhe von 0,60 Euro je angefangene halbe Stunde.').euro,'1.20');
 assert.equal(parkFeeOf('Parkgebühren','Die Gebühr wird um 0,50 Euro/Stunde erhöht.'),null);
 assert.equal(parkFeeOf('Gebühr für Anwohner-Parkausweis senken','Die Gebühr beträgt 1,00 € pro Stunde.'),null);
 assert.equal(parkFeeOf('Parkgebührenordnung','Die Gebühren betragen 1,20 EUR für eine Stunde.').euro,'1.20');
 assert.equal(parkFeeOf('Parkgebühren','Es gilt ein Preis von 2€ pro Stunde.').euro,'2.00');
 assert.equal(parkFeeOf('Parkgebühren','Das Parken kostet in der ersten Stunde 3,50 Euro.').euro,'3.50');
 assert.equal(parkFeeOf('Parkgebühren','Derzeit beträgt die Parkgebühr 2,00 € je Stunde.'),null,'geltender Satz');
 assert.equal(parkFeeOf('Parkgebühren','Damit müssten Parkgebühren von etwa 2,00 € pro Stunde erhoben werden.'),null,'Schätzung');
 assert.equal(parkFeeOf('Parkhaus','Mit Bescheid vom 03.02.2006 wurde für jede angefangene Stunde 0,50 € zugestimmt.'),null,'alter Bescheid');
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
