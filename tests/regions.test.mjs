import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {relatedTopics,topicPeriod,matchTopics} from '../shared/similarity.mjs';
import {parseAgenda,allowed} from '../server/integrations/sessionnet.mjs';
const now=new Date('2026-09-26T12:00:00Z');
const item=(id,regionId,status='consulting',eventDate='2026-09-25')=>({id,regionId,source:'district',title:'Fortschreibung des Nahverkehrsplans',officialTitle:'Fortschreibung des Nahverkehrsplans',eventDate,status});
test('comparison counts districts once, excludes own district and city articles',()=>{
 const a=item('a','coesfeld');const b=item('b','steinfurt');
 const r=relatedTopics(a,[a,b,b,item('c','steinfurt','approved'),item('d','warendorf'),{...item('e','muenster'),source:'city'}],{now,ownDistrict:'coesfeld'});
 assert.equal(r.matches.length,3);assert.equal(r.totalDistricts.length,2);
 assert.equal(r.currentDistricts.length,2);assert.equal(r.historicalDistricts.length,1);
});
test('unknown and remote future events do not masquerade as active consultation',()=>{
 assert.equal(topicPeriod(item('a','coesfeld','unknown'),now),'unclear');
 assert.equal(topicPeriod(item('a','coesfeld','consulting','2027-09-26'),now),'unclear');
 assert.equal(topicPeriod(item('a','coesfeld','unknown','2026-01-01'),now),'historical');
 assert.equal(topicPeriod(item('a','coesfeld','approved','2026-10-01'),now),'unclear');
 assert.equal(matchTopics({title:'Anfragen und Mitteilungen'},{title:'Anfragen und Mitteilungen'}),null);
});
test('SessionNet ASP/PHP parsing excludes nonpublic points and keeps committee decisions as recommendations',()=>{
 const source={id:'warendorf',kind:'district',base:'https://www.kreis-warendorf.de/w1/sessionnet/bi/'};
 const html=n=>`<tr><td class="tofnum">${n}</td><td class="tobetr"><div class="smc-card-header-title">Nahverkehrsplan</div><a href="vo0050.php?__kvonr=1">V1</a> Beschluss: einstimmig beschlossen</td></tr>`;
 const m={date:'2026-09-20',committee:'Ausschuss für Verkehr',url:source.base+'si0057.php?__ksinr=2'};
 assert.equal(parseAgenda(html('N 1'),m,source,now).length,0);
 assert.equal(parseAgenda(html('Ö 1'),m,source,now)[0].status,'recommended');
 assert.equal(parseAgenda(html('Ö 1'),{...m,committee:'Kreistag'},source,now)[0].status,'approved');
 assert.equal(parseAgenda(html('Ö 1'),{...m,committee:'Stadtverordnetenversammlung'},source,now)[0].status,'approved');
 assert.equal(parseAgenda(html('Ö 1'),{...m,committee:'Rat der Gemeinde Nottuln'},source,now)[0].status,'approved');
 assert.equal(parseAgenda(html('Ö 1'),{...m,date:'2026-10-20',committee:'Kreistag'},source,now)[0].status,'consulting');
 assert.throws(()=>allowed('https://example.com/secret',source));
});
test('all regional articles have stable unique region-prefixed ids and original source links',()=>{
 const d=JSON.parse(fs.readFileSync(new URL('../data/regions.json',import.meta.url)));
 assert.equal(new Set(d.topics.map(t=>t.id)).size,d.topics.length);
 assert.equal(d.coverage.length,6);
 for(const t of d.topics){assert.ok(t.id.startsWith(t.regionId+'-'));assert.ok(t.sourceUrl.startsWith('https://'));assert.ok(t.events.length);}
 assert.equal(d.topics.filter(t=>t.regionId==='borken').length,0);
});
