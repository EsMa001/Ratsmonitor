// Social Media aus den Antworten des Modells (server/integrations/social-model.mjs): Unterthema statt Streitwort, Fraktion aus
// „Wer“, Bericht und Planung aus der Vorgangsart, Aufhänger ohne Stichwort-Vorlagen.
import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreCard,fitScore,draftText,subRate} from '../server/integrations/social-model.mjs';

const cal={baseline:{contested:.3},subs:{'umwelt.ee':{res:200,contested:.5},'verwaltung.org':{res:200,contested:.1}}};
const card=o=>({id:'x',region_id:'r',date:'2026-10-20',status:'consulting',title:'Windpark am Hohen Feld – Antrag der SPD-Fraktion',gremium:'Rat',
 kind:'subject',subs:'["umwelt.ee"]',subsubs:'["umwelt.ee.wind"]',process:'political',applicants:'["fraction"]',...o});

test('Unterthema des Modells statt Streitwort: Ablauf und Punkte ohne Unterthema fallen weg',()=>{
 assert.equal(scoreCard(card({kind:'procedure'}),cal),null);
 assert.equal(scoreCard(card({subs:'[]'}),cal),null);
 const s=scoreCard(card(),cal);
 assert.equal(s.hits[0].term,'Windenergie');assert.equal(s.hits[0].groupName,'Umwelt, Klima & Energie');assert.equal(s.party,true);
 assert.ok(s.score>scoreCard(card({subs:'["verwaltung.org"]',subsubs:'[]'}),cal).score,'höhere Streitquote, höherer Wert');
 assert.equal(scoreCard(card({applicants:'["residents"]'}),cal).residents,true);
});

test('Streitquote zum Mittel gezogen; Planung und Routinesatzung aus der Vorgangsart',()=>{
 const r=subRate('umwelt.ee',cal);assert.ok(r.rate<.5&&r.rate>.45);
 assert.equal(subRate('gibt.es.nicht',cal).rate,.3);
 const c={...card({process:'planning',applicants:'[]'}),...scoreCard(card({process:'planning',applicants:'[]'}),cal)};
 const f=fitScore(c,{today:'2026-10-21',calibration:cal});
 assert.ok(f.parts.some(p=>/Planungsverfahren/.test(p.label)));assert.equal(f.unmeasured,true);
 const m={...card({process:'money',applicants:'[]',title:'Hebesatzsatzung 2027 der Gemeinde Musterdorf'}),...scoreCard(card({process:'money',applicants:'[]'}),cal)};
 assert.ok(fitScore(m,{today:'2026-10-21',calibration:cal}).parts.some(p=>/Routinesatzung/.test(p.label)));
});

test('Aufhänger: Bericht aus der Vorgangsart, Partei wörtlich aus dem Titel, Hashtag aus dem Unterthema',()=>{
 const d=draftText({title:'Sachstand Windpark am Hohen Feld',status:'info',region:'Gemeinde Musterdorf',term:'Windenergie',process:'information'});
 assert.match(d.text,/gibt es einen Bericht/);assert.ok(d.hashtags.includes('#Windenergie'));
 const a=draftText({title:'Windpark am Hohen Feld – Antrag der SPD-Fraktion',status:'rejected',region:'Gemeinde Musterdorf',term:'Windenergie',process:'political'});
 assert.match(a.text,/Antrag der SPD abgelehnt/);assert.equal(a.party,'SPD');
});
