import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {matchTitle,scoreCard,socialTopics,draftText} from '../server/integrations/social-topics.mjs';

const terms=t=>matchTitle(t).map(h=>h.term);

test('Streitwörter treffen Themen, nicht Verfahrenssprache', () => {
 assert.ok(terms('Wiedereinführung verkaufsoffener Sonntage in der Innenstadt').includes('Sonntagsöffnung'));
 assert.ok(terms('Streichung der Zuschüsse für Vereine im Rahmen der Haushaltskonsolidierung').includes('Streichung / Sparliste'));
 assert.equal(scoreCard({title:'Änderungsantrag der Ratsfraktion zur Grundsteuer B',status:'consulting'}).party,true);
 assert.deepEqual(terms('Einführung von Tempo 30 auf der Hauptstraße'),['Tempo 30']);
 assert.ok(terms('Antrag auf Errichtung von drei Windkraftanlagen').includes('Windkraft'));
 assert.ok(terms('Einführung der Bezahlkarte für Asylbewerber').includes('Bezahlkarte'));
 assert.ok(terms('Schließung des Hallenbades').includes('Schließung'));
});

test('bekannte Fehltreffer bleiben draußen', () => {
 for(const t of [
  'Schließung der Sitzung','Schließen des öffentlichen Teils der Sitzung','Erschließungsplan Gewerbegebiet Nord',
  'Neubau Kita "Regenbogen"','Flst. 5586 (Schulstraße 34): Neubau Einfamilienhaus','Neubau Tiny Häuser – Hallenbadstr. 5',
  'Rücktritt vom Planungs- und Bauvertrag zur Quartiersgarage','Kostenübernahme in der protestantischen Kita',
  'Jahresbericht der Musikschule Neukirchen-Vluyn e. V.','Beschlussfassung über Jahresabschluss 2025 (AfD, BFF dagegen)',
 ])assert.deepEqual(terms(t),[],t);
});

test('Status und Fraktionsantrag verstärken, Formales fällt weg', () => {
 const base={title:'Antrag zur Einführung von Tempo 30 in der Ortsmitte',status:'consulting'};
 const a=scoreCard(base),b=scoreCard({...base,status:'rejected'}),c=scoreCard({...base,title:'AfD-Antrag zur Einführung von Tempo 30 in der Ortsmitte'});
 assert.ok(b.score>a.score);
 assert.ok(c.score>a.score&&c.party);
 assert.equal(scoreCard({title:'Einladung zur Sitzung mit Tempo 30',status:'announced'}),null);
});

test('Auswahl: je Tag und Ort höchstens ein Eintrag, Wiederholungen derselben Gruppe und Woche entfallen', async () => {
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE search_cards (id text,region_id text,date text,status text,label text,title text,gremium text,formal integer DEFAULT 0)');
 sql.exec('CREATE TABLE topics (id text,payload text)');
 sql.prepare('INSERT INTO topics VALUES (?,?)').run('a',JSON.stringify({events:[{result:'mehrheitlich beschlossen'}]}));
 const ins=sql.prepare('INSERT INTO search_cards (id,region_id,date,status,label,title,gremium) VALUES (?,?,?,?,?,?,?)');
 ins.run('a','r1','2026-10-05','rejected','mobilitaet','Antrag der CDU-Fraktion: Tempo 30 in der Dorfstraße','Rat');
 ins.run('b','r1','2026-10-05','announced','mobilitaet','Tempo 30 in der Dorfstraße (Vorlage)','Rat');
 ins.run('c','r1','2026-10-08','rejected','mobilitaet','Tempo 30 in der Dorfstraße, erneuter Antrag','Rat');
 ins.run('d','r2','2026-10-05','rejected','umwelt','Windkraftanlagen im Stadtwald, Antrag abgelehnt','Rat');
 ins.run('e','r3','2026-10-05','rejected','unklar','Tempo 30 und Windkraft','Rat');sql.exec("UPDATE search_cards SET formal=1 WHERE id='e'");
 const r=await socialTopics(sqliteAdapter(sql),[{id:'r1',name:'Stadt Eins',shortName:'Eins'},{id:'r2',name:'Stadt Zwei',shortName:'Zwei'}],{today:'2026-10-11',days:10,minScore:2.5});
 const all=r.days.flatMap(d=>d.topics);
 assert.deepEqual(all.map(t=>t.id).sort(),['a','d']);
 assert.equal(all.find(t=>t.id==='a').region,'Eins');
 assert.ok(all.find(t=>t.id==='a').fit.evidence.some(e=>/mehrheitlich/.test(e)));
 assert.equal(r.days.length,10);
});

test('Aufhänger: Ort, Akteur und Stand mit bereinigtem Titelzitat', async () => {
 const a=draftText({title:'Antrag der CDU-Fraktion: Einführung von Tempo 30 auf der Burscheider Straße',status:'consulting',region:'Solingen',term:'Tempo 30'});
 assert.equal(a.text,'Die CDU beantragt in Solingen: „Einführung von Tempo 30 auf der Burscheider Straße“');
 assert.deepEqual(a.hashtags,['#Tempo30','#Solingen','#Kommunalpolitik']);
 assert.equal(a.question,'Tempo 30 in Solingen: Was meinen Sie?');
 const b=draftText({title:'AfD-Antrag zur Bezahlkarte',status:'rejected',region:'Erkelenz',term:'Bezahlkarte'});
 assert.equal(b.text,'In Erkelenz wurde der Antrag der AfD abgelehnt: „Bezahlkarte“');
 const c=draftText({title:'Windpark Olpe: Beteiligungsvereinbarung nach dem Bürgerenergiegesetz',status:'announced',region:'Olpe',term:'Windkraft'});
 assert.equal(c.text,'In Olpe auf der Tagesordnung: „Windpark Olpe: Beteiligungsvereinbarung nach dem Bürgerenergiegesetz“');
 assert.equal(draftText({title:'x',status:'info',region:'Y',term:'Unbekannt'}),null);
 const d=draftText({title:'Antrag der Fraktionen von CDU und SPD - Beendigung der Nutzung der Unterbringung Obdachloser',status:'consulting',region:'Mülheim',term:'Unterkunft'});
 assert.match(d.text,/^Die CDU und die SPD beantragen in Mülheim: „Beendigung der Nutzung/);
 const e=draftText({title:'Anfrage der SPD-Fraktion zum Sachstand Lückenschluss Geschwindigkeitsbegrenzungen',status:'consulting',region:'Remscheid',term:'Tempo 30'});
 assert.match(e.text,/^Die SPD fragt in Remscheid: /);
 const f=draftText({title:'Antrag der Grünen zu Tempo 30',status:'consulting',region:'Kreis Göttingen',term:'Tempo 30'});
 assert.equal(f.text,'Die Grünen stellen im Kreis Göttingen einen Antrag zum Thema „Tempo 30“');
 const g=draftText({title:'Rücknahme von „Tempo 30/40“ auf den Hauptverkehrsachsen - Antrag der Fraktion AfD vom 29.04.2026 -',status:'recommended',region:'Wiesbaden',term:'Tempo 30'});
 assert.equal(g.text,'In Wiesbaden wurde der Antrag der AfD zur Annahme empfohlen: „Rücknahme von ‚Tempo 30/40‘ auf den Hauptverkehrsachsen“');
 assert.equal(draftText({title:'Bericht zum Sachstand Transparenzgesetz Kreisfinanzen',status:'info',region:'Mettmann',term:'Transparenz'}).text.startsWith('Im Kreis Mettmann gibt es einen Bericht'),false,'Kreis Mettmann ohne Kreis im Namen bleibt „In“');
 assert.ok(!terms('Zeitnahe Veröffentlichung der Ergebnisse - Fraktion Bündnis90/Die Grünen/Tierschutzpartei').includes('Tierschutz'));
 assert.deepEqual(terms('Beschluss über den Ausschluss der Öffentlichkeit'),[]);
});

test('Eignung: Teile, Summe, Reichweite und Aktualität', async () => {
 const {fitScore}=await import('../server/integrations/social-topics.mjs');
 const hits=[{group:'verkehr',groupName:'Verkehr',term:'Tempo 30',weight:3}];
 const c={title:'Antrag der Grünen: Tempo 30 auf der Hauptstraße in der Innenstadt',status:'rejected',date:'2026-10-10',region_id:'r',score:4.5,hits};
 const cal={baseline:{contested:.29},terms:{'Tempo 30':{res:200,contested:.5}}};
 const big=fitScore(c,{today:'2026-10-11',population:{r:500000},calibration:cal}),small=fitScore(c,{today:'2026-10-11',population:{r:4000},calibration:cal});
 assert.equal(Math.max(0,big.parts.reduce((n,p)=>n+p.points,0)),big.raw);
 assert.ok(big.percent<=100&&big.percent>=60);
 assert.ok(big.parts.length>=7);
 assert.ok(big.parts.some(p=>p.key==='abzug'),'Straße im Titel ergibt einen Abzug');
 assert.ok(big.percent>small.percent);
 const old=fitScore({...c,date:'2026-09-01'},{today:'2026-10-11',population:{r:500000},calibration:cal});
 assert.ok(big.percent>old.percent);
 const jargon=fitScore({...c,title:'Aufstellungsbeschluss gem. § 2 BauGB, Flst. 12, Tempo 30; hier: Vorlage; hier: Satzung'},{today:'2026-10-11',population:{r:500000},calibration:cal});
 assert.ok(jargon.parts.find(p=>p.key==='klar').points<10);
});

test('Beleg und Kalibrierung: Abstimmungsergebnis und Themenquote wirken', async () => {
 const {fitScore,evidenceOf,classifyResult,termRate}=await import('../server/integrations/social-topics.mjs');
 assert.equal(classifyResult('einstimmig beschlossen'),'unan');
 assert.equal(classifyResult('mehrheitlich beschlossen'),'maj');
 assert.equal(classifyResult('mit 12 Gegenstimmen beschlossen'),'maj');
 assert.equal(classifyResult('abgelehnt'),'rej');
 assert.equal(classifyResult('vertagt'),'post');
 const ev=evidenceOf({events:[{result:'einstimmig beschlossen'},{result:'zurückgestellt'}],records:[]});
 assert.equal(ev.result,'post');assert.equal(ev.sessions,2);
 const cal={baseline:{contested:.3},terms:{'Flagge / Symbol':{res:90,contested:.64},'Wärme':{res:1000,contested:.18},'Selten':{res:3,contested:1}}};
 assert.ok(termRate('Flagge / Symbol',cal).rate>.5);
 assert.ok(termRate('Wärme',cal).rate<.22);
 assert.ok(termRate('Selten',cal).rate<.4,'wenig Belege bleiben nah am Mittel');
 const hits=(term,group='verkehr')=>[{group,groupName:'X',term,weight:3}];
 const base={title:'Antrag zur Beflaggung des Rathauses mit der Regenbogenflagge',status:'consulting',date:'2026-10-10',region_id:'r',score:3.5,hits:hits('Flagge / Symbol','identitaet')};
 const o={today:'2026-10-11',population:{r:100000},calibration:cal};
 const unan=fitScore(base,{...o,evidence:{result:'unan',sessions:1}}),maj=fitScore(base,{...o,evidence:{result:'maj',sessions:2}});
 assert.ok(maj.percent>unan.percent);
 assert.ok(maj.evidence.some(t=>/mehrheitlich/.test(t)));
 const calm=fitScore({...base,hits:hits('Wärme','energie')},o);
 assert.ok(unan.parts.find(p=>p.key==='thema').points>calm.parts.find(p=>p.key==='thema').points);
});

test('cleanTitle entfernt Antragskopf mit Fraktion, Datum und Trennzeichen', async () => {
  const {cleanTitle,scoreCard}=await import('../server/integrations/social-topics.mjs');
  assert.equal(cleanTitle('Antrag der Fraktion Bündnis 90/ Die GRÜNEN vom 01.06.2026_Prüfung von Tempo 30 auf der Cottenburgstraße'),'Prüfung von Tempo 30 auf der Cottenburgstraße');
  assert.equal(cleanTitle('Abschaffung der Fraktionsmittel •Antrag der Partei dieBasis'),'Abschaffung der Fraktionsmittel');
  assert.equal(cleanTitle('Antrag der CDU-Ratsfraktion, betr. Berichterstattung über Verkehrsversuch auf dem Großflecken'),'Berichterstattung über Verkehrsversuch auf dem Großflecken');
  assert.equal(scoreCard({id:'x',title:'Antrag der SPD-Fraktion: Verfahrensantrag zur Vorlage Zurückstellung der Abstimmung über die Schließung der Volkshochschule',status:'rejected',date:'2026-09-09',gremium:'Rat',region_id:'r',label:''}),null);
});
