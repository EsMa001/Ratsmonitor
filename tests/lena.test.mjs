import test from 'node:test';
import assert from 'node:assert/strict';
import {plan,fromOf,GLOSSAR} from '../components/ratsmonitor/lib/lena.ts';

const now=new Date('2026-10-10T12:00:00Z');
const kind=q=>plan(q,[],now).kind;

test('Lena erkennt die Absicht einfacher Fragen',()=>{
 assert.equal(kind('Hallo'),'gruss');
 assert.equal(kind('Was gibt es zu Photovoltaik in Billerbeck?'),'suche');
 assert.equal(kind('Wurde der Bebauungsplan in Roxel beschlossen?'),'stand');
 assert.equal(kind('Wie entwickelt sich Wärmeplanung?'),'entwicklung');
 assert.equal(kind('Wie hat sich Windkraft ausgebreitet?'),'ausbreitung');
 assert.equal(kind('Vergleiche Köln und Dortmund'),'vergleich');
 assert.equal(kind('Sag mir Bescheid bei Windkraft in Coesfeld'),'alarm');
 assert.equal(kind('Ist Wesel dabei?'),'abdeckung');
 assert.equal(kind('Was bedeutet Vertagung?'),'erklaerung');
 assert.equal(kind(''),'unbekannt');
});

test('Thema, Ort, Stand und Zeit werden getrennt',()=>{
 const p=plan('Neues zum Haushalt in Münster in den letzten 30 Tagen',[],now);
 assert.equal(p.q,'Haushalt Münster');
 assert.equal(p.place,'Münster');
 assert.equal(p.from,'2026-09-10');
 const s=plan('Wurde der Bebauungsplan in Roxel beschlossen?',[],now);
 assert.equal(s.status,'approved');
 assert.equal(s.q,'Bebauungsplan Roxel');
 assert.equal(plan('Photovoltaik in Frankfurt am Main',[],now).place,'Frankfurt am Main');
 assert.equal(plan('Sag mir Bescheid bei Windkraft in Coesfeld',[],now).searchTerm,'Windkraft Coesfeld');
});

test('Analysen führen mit gesetztem Begriff weiter',()=>{
 const p=plan('Wie entwickelt sich Wärmeplanung?',[],now);
 assert.equal(p.links[0].href,'/analytics/trends?thema=W%C3%A4rmeplanung');
});

test('Zeitangaben',()=>{
 assert.equal(fromOf('letzte 7 tage',now),'2026-10-03');
 assert.equal(fromOf('dieses jahr',now),'2026-01-01');
 assert.equal(fromOf('einfach so',now),undefined);
});

test('Erklärungen kommen aus dem Glossar, nie frei formuliert',()=>{
 const p=plan('Was ist ein Bebauungsplan?',[],now);
 assert.equal(p.kind,'erklaerung');
 assert.ok(p.text.startsWith('Bebauungsplan:'));
 assert.ok(GLOSSAR.every(g=>g.a.length>20&&g.keys.length));
});

test('Preisfrage nutzt FAQ-Text, sonst Hinweis auf die Preisseite',()=>{
 const withFaq=plan('Was kostet Pro?',[{q:'Was kostet plenara?',a:'Basic ist kostenlos, Pro kostet einen festen Betrag.'}],now);
 assert.equal(withFaq.kind,'faq');
 assert.ok(withFaq.links.some(l=>l.href==='/preise'));
});
