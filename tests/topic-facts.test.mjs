// Fakten für plenara.X: Fraktion als Antragsteller, Förderprogramme (shared/topic-facts.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {factionsOf,fundingOf,fundingEuroOf,factsOf} from '../shared/topic-facts.mjs';

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
 assert.deepEqual(kitaFeeOf('Satzung über Elternbeiträge in Kindertageseinrichtungen','Die Elternbeiträge für Kinder in der Kita werden zum 1.8. um 5 % erhöht.'),{direction:'Erhöhung',euro:''});
 assert.equal(kitaFeeOf('Kita-Beiträge','Das letzte Kita-Jahr bleibt beitragsfrei.').direction,'Beitragsfreiheit');
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
 assert.deepEqual(e('Der Zuschuss beträgt 350 TEUR.'),[['Sonstige Förderung',350000]]);
 assert.deepEqual(e('Die Förderquote beträgt 80 % der förderfähigen Kosten von 500.000 €.'),[],'förderfähige Kosten');
 assert.deepEqual(e('Die Förderung beträgt bis zu 200.000 €.'),[],'Höchstbetrag');
 assert.deepEqual(e('Finanzschwache Kommunen erhalten einen Fördersatz von 90 % (maximale Fördersumme 200.000 Euro).'),[],'Höchstbetrag vor dem Förderwort');
 assert.deepEqual(e('Der durch Zuwendungen nicht gedeckte Anteil von 303.750 € muss über den Haushalt finanziert werden.'),[],'Eigenanteil');
 assert.deepEqual(e('Für den Projektaufruf 2026 stehen Bundesmittel in Höhe von 250 Mio. Euro zur Verfügung.'),[],'Programmtopf');
 assert.deepEqual(e('Der städtische Zuschuss für den Ersatzneubau in Höhe von 60,5 Mio. € wird beschlossen.'),[],'Zuschuss der Kommune selbst');
 assert.deepEqual(e('Gesamtsumme 9,1 Mio. € Fördermittel 6,37 Mio. € Eigenanteil 2,73 Mio. €'),[['Sonstige Förderung',6370000]],'Tabelle: kein Betrag vor dem Förderwort');
});

test('funding amount without program goes to the only program of the report',()=>{
 const t='Für die Mensa wurden Fördermittel aus dem Programm Ganztagsausbau bewilligt. Der Förderbescheid über 300.000 € liegt vor.';
 assert.deepEqual(factsOf('Neubau Mensa',t).filter(r=>r.kind.startsWith('funding')),[{kind:'funding',value:'Ganztagsausbau',detail:'granted'},{kind:'funding_euro',value:'Ganztagsausbau',detail:'300000'}]);
});
