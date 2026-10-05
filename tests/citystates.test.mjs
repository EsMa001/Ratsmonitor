import test from 'node:test';
import assert from 'node:assert/strict';
import entries from '../server/integrations/citystate-sources.json' with {type:'json'};
import {NRW_SOURCES} from '../server/integrations/source-catalog.mjs';
import {READERS} from '../server/integrations/readers.mjs';
import {collectRegion} from '../server/integrations/collect-region.mjs';
import {pardokProcedure,pardokBlocks,collectPardok,collectBerlin,hamburgPaper,hamburgQuery,collectHamburgTransparenz,collectOparlDistricts,consentValid,eligibleSystems,BERLIN_CONSENT_MISSING,HAMBURG_DISTRICTS} from '../server/integrations/citystates.mjs';

// These tests check the old rule (robots.txt obeyed, ROBOTS_POLICY=obey); the tests marked "standard rule" switch to
// the rule of server/integrations/robots-policy.mjs: robots.txt is recorded, not obeyed, and a refusal stays final.
process.env.ROBOTS_POLICY='obey';
const standardRule=async fn=>{const was=process.env.ROBOTS_POLICY;delete process.env.ROBOTS_POLICY;try{return await fn();}finally{process.env.ROBOTS_POLICY=was;}};

/* Nachgebildete Antworten im Format der CKAN-Schnittstelle (package_search); echte Antworten waren aus der
   Entwicklungsumgebung nicht abrufbar. */
const hh={id:'de-02000000',name:'Stadt Hamburg',kind:'city',method:'scraper',adapter:'hamburg-transparenz',base:'https://suche.transparenz.hamburg.de/',districts:['Wandsbek','Altona']};
const now=new Date('2026-10-05T10:00:00Z');
const pkg=(over={})=>({name:'bezirk-wandsbek-drucksache-22-3451',title:'Bezirk Wandsbek, Drucksache 22-3451: Mehr Fahrradbügel am Markt',notes:'<p>Antrag der Fraktion …</p>',state:'active',private:false,metadata_created:'2026-09-20T08:00:00',metadata_modified:'2026-09-21T08:00:00',extras:[{key:'registerobject_type',value:'beschluss'},{key:'publishing_date',value:'2026-09-19'}],resources:[{name:'Drucksache 22-3451',url:'https://sitzungsdienst-wandsbek.hamburg.de/bi/vo020.asp?VOLFDNR=1',format:'HTML'}],...over});
const answer=results=>JSON.stringify({success:true,result:{count:results.length,results}});

test('a dataset of the portal becomes a paper of its district only with district, number, date and a link',()=>{
 const p=hamburgPaper(pkg(),'Wandsbek',hh);
 assert.equal(p.reference,'22-3451');assert.equal(p.title,'Mehr Fahrradbügel am Markt');assert.equal(p.date,'2026-09-19');
 assert.equal(p.url,'https://suche.transparenz.hamburg.de/dataset/bezirk-wandsbek-drucksache-22-3451');
 assert.ok(p.documents.some(d=>d.url.startsWith('https://sitzungsdienst-wandsbek.hamburg.de/')),'the district system is linked, not read');
 /* Ohne Betreff im Titel: kurze Beschreibung, sonst die Nummer */
 assert.equal(hamburgPaper(pkg({title:'Bezirk Wandsbek, Drucksache 22-3451',notes:'Kurz.'}),'Wandsbek',hh).title,'Kurz.');
 assert.equal(hamburgPaper(pkg({title:'Bezirk Wandsbek, Drucksache 22-3451',notes:'x'.repeat(400)}),'Wandsbek',hh).title,'Drucksache 22-3451');
 /* Fremder Bezirk, anderes Registerobjekt, nicht öffentlich, gelöscht oder ohne Datum: nichts */
 assert.equal(hamburgPaper(pkg(),'Altona',hh),null);
 assert.equal(hamburgPaper(pkg({title:'Bebauungsplan Wandsbek 84'}),'Wandsbek',hh),null);
 assert.equal(hamburgPaper(pkg({title:'Bezirk Wandsbek, Drucksache 22-3451: Nichtöffentliche Vorlage'}),'Wandsbek',hh),null);
 assert.equal(hamburgPaper(pkg({state:'deleted'}),'Wandsbek',hh),null);
 assert.equal(hamburgPaper(pkg({extras:[],metadata_created:''}),'Wandsbek',hh),null);
 /* Schreibweisen des Bezirks */
 assert.ok(hamburgPaper(pkg({title:'Bezirk Hamburg-Nord, Drucksache 22-100'}),'Hamburg-Nord',hh));
 assert.ok(hamburgPaper(pkg({title:'Bezirk Eimsbuettel, Drucksache 22-2261'}),'Eimsbüttel',hh));
 assert.deepEqual(HAMBURG_DISTRICTS.length,7);
});

test('the query asks the search interface for papers of one district changed in the period',()=>{
 const u=new URL(hamburgQuery(hh,'Wandsbek','2026-09-05'));
 assert.equal(u.origin+u.pathname,'https://suche.transparenz.hamburg.de/api/3/action/package_search');
 assert.equal(u.searchParams.get('q'),'title:"Bezirk Wandsbek" AND title:Drucksache');
 assert.equal(u.searchParams.get('fq'),'metadata_modified:[2026-09-05T00:00:00Z TO *]');
});

test('Hamburg: robots.txt decides first; only the portal is asked; papers become topics of their district',async()=>{
 const calls=[];
 const get=async url=>{calls.push(url);if(url.endsWith('/robots.txt'))return 'User-agent: *\nDisallow: /dataset/private\n';const q=new URL(url).searchParams.get('q');if(q.includes('Wandsbek'))return answer([pkg(),pkg({name:'altona-x',title:'Bezirk Altona, Drucksache 21-3944'})]);return answer([]);};
 const d=await collectHamburgTransparenz(hh,{now,get,window:'1m'});
 assert.ok(calls.every(u=>u.startsWith('https://suche.transparenz.hamburg.de/')),'no request outside the portal');
 assert.equal(calls[0],'https://suche.transparenz.hamburg.de/robots.txt');
 assert.equal(d.topics.length,1);const t=d.topics[0];
 assert.equal(t.committee,'Bezirksversammlung Wandsbek');assert.equal(t.eventDate,'2026-09-19');assert.equal(t.public,true);assert.equal(t.status,'unknown');
 assert.equal(t.id,'de-02000000-hh-wandsbek-22-3451');assert.equal(t.events[0].result,'');
 assert.match(d.coverage.note,/ohne Sitzungskalender/);assert.equal(d.coverage.meetings,0);
 assert.ok(d.coverage.warnings.some(w=>/Altona/.test(w)),'a district without papers is named');
 assert.ok(d.coverage.warnings.some(w=>/keine Drucksache des gesuchten Bezirks/.test(w)));
 assert.equal(d.coverage.complete,true);
});

test('Hamburg: a refusal in robots.txt, an unreadable robots.txt or an unknown answer reads nothing',async()=>{
 let calls=[];
 const refused=await collectHamburgTransparenz(hh,{now,get:async url=>{calls.push(url);return 'User-agent: *\nDisallow: /api/\n';}});
 assert.deepEqual(calls,['https://suche.transparenz.hamburg.de/robots.txt']);assert.equal(refused.topics.length,0);assert.match(refused.coverage.issues[0],/robots\.txt/);
 calls=[];
 const unknown=await collectHamburgTransparenz(hh,{now,get:async url=>{calls.push(url);if(url.endsWith('/robots.txt'))throw Error('Quelle antwortet mit HTTP 503');return answer([pkg()]);},maxDurationMs:2000});
 assert.ok(calls.every(u=>u.endsWith('/robots.txt')),'no query without a readable robots.txt');assert.equal(unknown.topics.length,0);
 const odd=await collectHamburgTransparenz(hh,{now,get:async url=>url.endsWith('/robots.txt')?'':'{"help":"x"}'});
 assert.equal(odd.topics.length,0);assert.ok(odd.coverage.issues.some(i=>/Unbekanntes Antwortformat/.test(i)));assert.equal(odd.coverage.complete,false);
});

const berlin=entries.find(e=>e.id==='de-11000000');
test('Berlin: without consent nothing is read where robots.txt refuses; a consent needs who, when and scope',async()=>{
 assert.equal(consentValid(null),false);assert.equal(consentValid({by:'ITDZ',date:'2026-11-01'}),false);
 assert.equal(consentValid({by:'ITDZ Berlin',date:'2026-11-01',scope:'OParl-Schnittstellen aller BVV'}),true);
 const systems=[{district:'Pankow',system:'https://pankow.example.berlin.de/oparl/system',robots:'verboten'},{district:'Mitte',system:'https://mitte.example.berlin.de/oparl/system',robots:'erlaubt'}];
 assert.deepEqual(eligibleSystems({systems}).map(s=>s.district),['Mitte']);
 assert.equal(eligibleSystems({systems,consent:{by:'ITDZ Berlin',date:'2026-11-01',scope:'oparl'}}).length,2);
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('unexpected request');};
 try{
  const none=await collectOparlDistricts({...berlin,systems:systems.slice(0,1)},{now});
  assert.equal(none.topics.length,0);assert.equal(none.coverage.issues[0],BERLIN_CONSENT_MISSING);
  /* robots.txt erlaubte bei der Prüfung, verbietet aber heute: der Bezirk wird nicht gelesen */
  const calls=[];
  const changed=await collectOparlDistricts({...berlin,systems:systems.slice(1)},{now,get:async url=>{calls.push(url);return 'User-agent: *\nDisallow: /\n';}});
  assert.deepEqual(calls,['https://mitte.example.berlin.de/robots.txt']);assert.equal(changed.topics.length,0);assert.match(changed.coverage.issues[0],/BVV Mitte/);
 }finally{globalThis.fetch=original;}
});

test('city-state entries: switched off until checked, readers registered, no request while switched off',async()=>{
 for(const e of entries){
  assert.ok(READERS[e.adapter],e.adapter);
  assert.ok(NRW_SOURCES.some(s=>s.id===e.id),e.id+' in the catalog');
  if(e.method==='pending')assert.ok(e.note,e.id+' names why it is switched off');
  if(e.method!=='pending')assert.ok(e.checkPending||e.verifiedAt,e.id+' says whether it was checked live');
 }
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('unexpected request');};
 try{for(const e of entries.filter(e=>e.method==='pending')){const d=await collectRegion(e.id,{window:'1w'});assert.equal(d.coverage.method,'pending');assert.equal(d.topics.length,0);assert.equal(d.coverage.issues[0],e.note);}}
 finally{globalThis.fetch=original;}
});

/* Nachgebildeter Ausschnitt im Aufbau der PARDOK-Exportdatei (Vorgang mit Dokumenten); die echte Datei war aus der
   Entwicklungsumgebung nicht abrufbar. */
const doc=(art,nr,dat,titel)=>`<Dokument><Wp>19</Wp><DokArt>${art}</DokArt><DokNr>${nr}</DokNr><DokDat>${dat}</DokDat><Titel>${titel}</Titel><LokURL>https://pardok.parlament-berlin.de/starweb/adis/citat/VT/19/DruckSachen/d19-${nr.replace('/','')}.pdf</LokURL></Dokument>`;
const vorgang=(id,typ,docs)=>`<Vorgang><VID>${id}</VID><VNr>${id}</VNr><ReihNr>0000</ReihNr><VTyp>${typ}</VTyp><VTypL>${typ}</VTypL><VSysL>Verkehr</VSysL><Desk>Radverkehr</Desk><Desk>Parkraum</Desk>${docs}</Vorgang>`;
const xml='<?xml version="1.0" encoding="UTF-8"?><Export>'+vorgang('V1','Antrag',doc('Drs','19/2400','01.09.2026','Mehr Radwege &amp; Parkraum')+doc('PlPr','19/80','24.09.2026','Plenarprotokoll'))+vorgang('V2','Schriftliche Anfrage',doc('Drs','19/9999','20.09.2026','Frage zu Bänken'))+vorgang('V3','Vorlage',doc('Drs','19/100','01.01.2025','Alt'))+'</Export>';
const be={id:'de-11000000',name:'Stadt Berlin',kind:'city',adapter:'berlin',pardok:{base:'https://www.parlament-berlin.de/',periods:[19,20]},systems:[],consent:null};

test('Berlin: a procedure of the open-data file with its documents; blocks are found across chunks',async()=>{
 const p=pardokProcedure(vorgang('V1','Antrag',doc('Drs','19/2400','01.09.2026','Mehr Radwege &amp; Parkraum')));
 assert.equal(p.id,'V1');assert.equal(p.type,'Antrag');assert.deepEqual(p.descriptors,['Radverkehr','Parkraum']);
 assert.equal(p.documents[0].date,'2026-09-01');assert.equal(p.documents[0].title,'Mehr Radwege & Parkraum');assert.match(p.documents[0].url,/^https:\/\/pardok/);
 assert.equal(pardokProcedure('<Vorgang><VID>X</VID></Vorgang>'),null);
 const seen=[];const parts=[];for(let i=0;i<xml.length;i+=37)parts.push(xml.slice(i,i+37));
 assert.equal(await pardokBlocks(parts,b=>seen.push(pardokProcedure(b).id)),3);assert.deepEqual(seen,['V1','V2','V3']);
});

test('Berlin: robots.txt first; procedures with a document in the period; inquiries left out; a missing period is no error',async()=>{
 const asked=[];
 const stream=async function*(url){asked.push(url);if(url.endsWith('wp20.xml'))throw Error('Quelle antwortet mit HTTP 404');yield xml.slice(0,500);yield xml.slice(500);};
 const d=await collectPardok(be,{now,window:'1m',get:async()=>'User-agent: *\nDisallow: /intern/\n',stream});
 assert.deepEqual(asked,['https://www.parlament-berlin.de/opendata/pardok-wp20.xml','https://www.parlament-berlin.de/opendata/pardok-wp19.xml'],'newest period first');
 assert.equal(d.topics.length,1);const t=d.topics[0];
 assert.equal(t.id,'de-11000000-pardok-v1');assert.equal(t.title,'Mehr Radwege & Parkraum');assert.equal(t.committee,'Abgeordnetenhaus');assert.equal(t.eventDate,'2026-09-24');
 /* Ein Monat: nur das Plenarprotokoll liegt im Zeitraum, beide Dokumente bleiben verlinkt */
 assert.equal(t.events.length,1);assert.match(t.events[0].description,/Plenarprotokoll · 19\/80/);assert.equal(t.documents.length,2);
 assert.equal(d.coverage.complete,true);assert.ok(d.coverage.warnings.some(w=>/Anfragen ausgelassen/.test(w)));assert.ok(d.coverage.warnings.some(w=>/ohne Datei/.test(w)));
 /* robots.txt verbietet: keine Datei wird geladen */
 const none=[];const refused=await collectPardok(be,{now,get:async()=>'User-agent: *\nDisallow: /opendata/\n',stream:async function*(url){none.push(url);}});
 assert.deepEqual(none,[]);assert.equal(refused.topics.length,0);assert.match(refused.coverage.issues[0],/robots\.txt/);
 /* Unbekanntes Format: keine Vorgänge erkannt */
 const odd=await collectPardok({...be,pardok:{...be.pardok,periods:[19]}},{now,get:async()=>'',stream:async function*(){yield '<html>Wartung</html>';}});
 assert.equal(odd.topics.length,0);assert.match(odd.coverage.issues[0],/Unbekanntes Format/);
});

test('Berlin: the Abgeordnetenhaus is read without consent; the district assemblies are not',async()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('unexpected request');};
 try{
  const d=await collectBerlin({...be,systems:[{district:'Pankow',system:'https://pankow.example.berlin.de/oparl/system',robots:'verboten'}]},{now,window:'1m',get:async()=>'',stream:async function*(url){if(url.endsWith('wp19.xml'))yield xml;else throw Error('Quelle antwortet mit HTTP 404');}});
  assert.equal(d.topics.length,1);assert.ok(d.coverage.warnings.some(w=>/Bezirksverordnetenversammlungen nicht gelesen/.test(w)));
 }finally{globalThis.fetch=original;}
});

test('standard rule: Hamburg reads the portal although robots.txt refuses programs; HTTP 403 ends every request',()=>standardRule(async()=>{
 const calls=[];
 const get=async url=>{calls.push(url);if(url.endsWith('/robots.txt'))return 'User-agent: *\nDisallow: /\n';const q=new URL(url).searchParams.get('q');if(q.includes('Wandsbek'))return answer([pkg()]);return answer([]);};
 const d=await collectHamburgTransparenz(hh,{now,get,window:'1m'});
 assert.ok(!calls.some(u=>u.endsWith('/robots.txt')),'robots.txt is recorded by robots.mjs, not asked by the reader');
 assert.ok(calls.every(u=>u.startsWith('https://suche.transparenz.hamburg.de/')),'no request outside the portal');
 assert.equal(d.topics.length,1);assert.equal(d.topics[0].committee,'Bezirksversammlung Wandsbek');
 const refused=[];
 const shut=await collectHamburgTransparenz(hh,{now,get:async url=>{refused.push(url);throw Error('Quelle antwortet mit HTTP 403');}});
 assert.equal(refused.length,1,'no request after HTTP 403, also not for the next district');
 assert.equal(shut.topics.length,0);assert.ok(shut.coverage.issues.some(i=>/HTTP 403/.test(i)));assert.equal(shut.coverage.complete,false);
}));

test('standard rule: Berlin districts are read unless they refuse technically; the PARDOK file although robots.txt refuses',()=>standardRule(async()=>{
 const systems=[{district:'Pankow',system:'https://pankow.example.berlin.de/oparl/system',robots:'verboten'},{district:'Mitte',system:'https://mitte.example.berlin.de/oparl/system',robots:'erlaubt'},
  {district:'Spandau',system:'https://spandau.example.berlin.de/oparl/system',robots:'unbrauchbar',error:'Quelle antwortet mit HTTP 403',oparl:false},{district:'Neukölln',system:'https://neukoelln.example.berlin.de/oparl/system',oparl:false}];
 assert.deepEqual(eligibleSystems({systems}).map(s=>s.district),['Pankow','Mitte']);
 assert.equal(eligibleSystems({systems,consent:{by:'ITDZ Berlin',date:'2026-11-01',scope:'oparl'}}).length,4);
 // The live check of 05.10.2026: all ten district systems answered with HTTP 403; they stay out.
 assert.deepEqual(eligibleSystems(berlin),[]);
 // A district whose robots.txt refuses is asked without reading robots.txt; its 403 ends its reading.
 const asked=[],robots=[];
 const pankow=await collectOparlDistricts({...berlin,systems:systems.slice(0,1)},{now,window:'1m',get:async url=>{robots.push(url);return '';},getJson:async url=>{asked.push(url);throw Error('Quelle antwortet mit HTTP 403');}});
 assert.deepEqual(robots,[]);assert.equal(asked[0],'https://pankow.example.berlin.de/oparl/system');
 assert.equal(pankow.topics.length,0);assert.match(pankow.coverage.issues.join(' '),/BVV Pankow: .*HTTP 403/);
 // PARDOK: robots.txt disallows /opendata/; the file is read anyway; a 403 ends the reading of every period.
 const files=[];
 const d=await collectPardok(be,{now,window:'1m',get:async()=>'User-agent: *\nDisallow: /opendata/\n',stream:async function*(url){files.push(url);if(url.endsWith('wp20.xml'))throw Error('Quelle antwortet mit HTTP 404');yield xml;}});
 assert.equal(files.length,2);assert.equal(d.topics.length,1);
 const shut=[];
 const refused=await collectPardok(be,{now,window:'1m',get:async()=>'',stream:async function*(url){shut.push(url);throw Error('Quelle antwortet mit HTTP 403');}});
 assert.equal(shut.length,1,'no second file after HTTP 403');assert.equal(refused.topics.length,0);assert.match(refused.coverage.issues[0],/HTTP 403/);
}));
