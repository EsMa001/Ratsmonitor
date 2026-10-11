import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {matchTitle,scoreCard,socialTopics} from '../server/integrations/social-topics.mjs';

const terms=t=>matchTitle(t).map(h=>h.term);

test('Streitwörter treffen Themen, nicht Verfahrenssprache', () => {
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
 sql.exec('CREATE TABLE search_cards (id text,region_id text,date text,status text,label text,title text,gremium text)');
 const ins=sql.prepare('INSERT INTO search_cards VALUES (?,?,?,?,?,?,?)');
 ins.run('a','r1','2026-10-05','rejected','mobilitaet','Antrag der CDU-Fraktion: Tempo 30 in der Dorfstraße','Rat');
 ins.run('b','r1','2026-10-05','announced','mobilitaet','Tempo 30 in der Dorfstraße (Vorlage)','Rat');
 ins.run('c','r1','2026-10-08','rejected','mobilitaet','Tempo 30 in der Dorfstraße, erneuter Antrag','Rat');
 ins.run('d','r2','2026-10-05','rejected','umwelt','Windkraftanlagen im Stadtwald, Antrag abgelehnt','Rat');
 ins.run('e','r3','2026-10-05','rejected','sitzung','Tempo 30 und Windkraft','Rat');
 const r=await socialTopics(sqliteAdapter(sql),[{id:'r1',name:'Stadt Eins',shortName:'Eins'},{id:'r2',name:'Stadt Zwei',shortName:'Zwei'}],{today:'2026-10-11',days:10,minScore:2.5});
 const all=r.days.flatMap(d=>d.topics);
 assert.deepEqual(all.map(t=>t.id).sort(),['a','d']);
 assert.equal(all.find(t=>t.id==='a').region,'Eins');
 assert.equal(r.days.length,10);
});
