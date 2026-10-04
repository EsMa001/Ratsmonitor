import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {relatedTopics,topicPeriod,matchTopics} from '../shared/similarity.mjs';
import {parseAgenda,parseAgendaCards,allowed} from '../server/integrations/sessionnet.mjs';
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
 /* Entscheidende Gremien anderer Länder */
 for(const committee of ['Marktgemeinderat','Gemeindevertretung','Stadtvertretung','Verbandsgemeinderat','Ortsgemeinderat','Gemeinschaftsversammlung','Amtsausschuss'])assert.equal(parseAgenda(html('Ö 1'),{...m,committee},source,now)[0].status,'approved',committee);
 assert.equal(parseAgenda(html('Ö 1'),{...m,committee:'Bauausschuss'},source,now)[0].status,'recommended');
});
test('SessionNet card layout: the agenda on the meeting page, public items only, paper, documents and decision',()=>{
 const source={id:'de-09564000',kind:'city',base:'https://online-service2.nuernberg.de/buergerinfo/'};
 const card=(badge,title,extra='')=>`<div class="card card-light"><div class="card-header" onclick="smcAjaxDV('to0058.asp?smctonr=106625&smcajax=11t')"><h3 class="mb-0 card-header-title"><button> <span class="badge">${badge}</span> <span class="smc-badges"><span class="badge smc-badge-count smc-badge-text">VO</span></span><div class="smc-card-text-title">${title}<br /><br />Vorsitz: Bürgermeister</div></button></h3></div><div class="collapse"><div class="card-body">${extra}</div></div></div>`;
 const page='<div class="accordion" id="smcaccordion"><div class="card card-light smcbox"><div class="card-header"><h2 class="mb-0 card-header-title"><button>&Ouml;ffentlicher Teil:</button></h2></div></div>'
  +card('&Ouml; 3','Entlastung f&#252;r den Jahresabschluss 2023','<a href="getfile.asp?id=940278&type=do" class="smce-a-u">Sitzungsvorlage</a><p class="smc_field_smcdv0_box2_volink"><a href="vo0050.asp?__kvonr=29984" class="smc_datatype_vo">Rpr/002/2026</a></p><p class="smc_field_smcdv0_box2_beschluss margin-bottom-0"><strong>Beschluss:</strong> Einstimmig beschlossen</p>')
  +card('&Ouml; 4','Konsolidierter Jahresabschluss 2024','<p class="smc_field_smcdv0_box2_beschluss"><strong>Beschluss:</strong> Der Bericht dient der Kenntnis</p>')
  +card('N 5','Grundstücksangelegenheit')+'</div>';
 const m={date:'2026-07-22',committee:'Stadtrat',url:source.base+'si0056.asp?__ksinr=16074'};
 const rows=parseAgendaCards(page,m,source,now);
 assert.equal(rows.length,2,'the non-public item is left out');
 assert.deepEqual(rows.map(r=>r.title),['Entlastung für den Jahresabschluss 2023','Konsolidierter Jahresabschluss 2024']);
 assert.equal(rows[0].id,'de-09564000-vo-29984');assert.equal(rows[0].reference,'Rpr/002/2026');assert.equal(rows[0].status,'approved');assert.equal(rows[0].event.result,'Einstimmig beschlossen');
 assert.deepEqual(rows[0].documents.map(d=>d.url),[source.base+'getfile.asp?id=940278&type=do']);assert.equal(rows[0].event.url,m.url);
 /* Kennung ohne Vorlage wie im Tabellenformat: Sitzung und Nummer („Ö 4“ → „-4“) */
 assert.equal(rows[1].id,'de-09564000-top-16074--4');assert.equal(rows[1].status,'info');
 assert.equal(parseAgendaCards(page,{...m,committee:'Ausschuss für Recht'},source,now)[0].status,'recommended');
});
test('all regional articles have stable unique region-prefixed ids and original source links',()=>{
 const d=JSON.parse(fs.readFileSync(new URL('../data/regions.json',import.meta.url)));
 assert.equal(new Set(d.topics.map(t=>t.id)).size,d.topics.length);
 assert.equal(d.coverage.length,6);
 for(const t of d.topics){assert.ok(t.id.startsWith(t.regionId+'-'));assert.ok(t.sourceUrl.startsWith('https://'));assert.ok(t.events.length);}
 assert.equal(d.topics.filter(t=>t.regionId==='borken').length,0);
});
