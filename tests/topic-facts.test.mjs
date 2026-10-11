// Fakten für plenara.X: Fraktion als Antragsteller, Förderprogramme (shared/topic-facts.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {factionsOf,fundingOf,factsOf} from '../shared/topic-facts.mjs';

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
 assert.deepEqual(factsOf('Antrag der CDU-Fraktion: Sportplatz','Wir beantragen Fördermittel aus der Sportstättenförderung.'),[
  {kind:'faction',value:'CDU/CSU',detail:'antrag'},{kind:'funding',value:'Sportstätten',detail:'applied'}]);
 assert.deepEqual(factsOf('Antrag der CDU-Fraktion: Sportplatz',''),[{kind:'faction',value:'CDU/CSU',detail:'antrag'}]);
});

test('collective items yield no funding facts unless their title is about funding',()=>{
 const t='Für den Ganztagsausbau liegt ein Förderbescheid vor.';
 assert.deepEqual(factsOf('Mitteilungen der Verwaltung',t),[]);
 assert.deepEqual(factsOf('Einbringung des Haushaltes 2027',t),[]);
 assert.deepEqual(factsOf('Sachstand Fördermittel Ganztag',t),[{kind:'funding',value:'Ganztagsausbau',detail:'granted'}]);
});
