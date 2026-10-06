import test from 'node:test';
import assert from 'node:assert/strict';
import {ckanUrl,ckanSearchUrl,ckanExtra,ckanActive,ckanLinks,ckanSession,detectCkan,probeCkan,collectCkan,isCkanAnswer,CKAN_NO_PROFILE} from '../server/integrations/ckan.mjs';
import {READERS} from '../server/integrations/readers.mjs';
import {channelOf,accessOfSource} from '../shared/source-access.mjs';

// The generic CKAN connector (server/integrations/ckan.mjs). The answers follow the format of the action API
// (package_search, status_show); the Hamburg reader (citystates.mjs) is tested on real answers of its portal.
process.env.ROBOTS_POLICY='obey';
const base='https://opendata.beispielstadt.de/',now=new Date('2026-10-05T10:00:00Z');
const dataset=(over={})=>({name:'ratsbeschluss-12-2026',title:'Ratsbeschluss 12/2026: Radweg Hauptstraße',notes:'<p>Beschluss des Rates vom 01.09.2026</p>',state:'active',private:false,license_id:'dl-de-by-2.0',metadata_created:'2026-09-20T08:00:00',metadata_modified:'2026-09-21T08:00:00',
 extras:[{key:'number',value:'12/2026'},{key:'issued',value:'2026-09-19'}],resources:[{name:'Beschluss (PDF)',url:'https://opendata.beispielstadt.de/dataset/x/resource/1/download/beschluss.pdf',format:'PDF'},{name:'Alt',url:'http://alt.beispielstadt.de/x',format:'HTML'}],...over});
const answer=(results,count=results.length)=>JSON.stringify({help:base+'api/3/action/help_show',success:true,result:{count,results}});
const profile={queries:[{label:'Ratsbeschlüsse',q:'tags:ratsbeschluss'}],committee:'Rat der Stadt Beispielstadt'};

test('addresses of the action API: action, search with q, fq, sort, rows and start',()=>{
 assert.equal(ckanUrl(base,'status_show'),'https://opendata.beispielstadt.de/api/3/action/status_show');
 const u=new URL(ckanSearchUrl(base,{q:'tags:rat',fq:'organization:stadt',start:200}));
 assert.equal(u.pathname,'/api/3/action/package_search');
 assert.deepEqual([...u.searchParams.keys()],['q','fq','sort','rows','start']);
 assert.equal(u.searchParams.get('sort'),'metadata_modified desc');assert.equal(u.searchParams.get('rows'),'100');assert.equal(u.searchParams.get('start'),'200');
 assert.equal(new URL(ckanSearchUrl(base)).searchParams.get('fq'),null,'no empty filter');
});

test('fields of a dataset: extras, active and public, links (https only, page first)',()=>{
 const d=dataset();
 assert.equal(ckanExtra(d,['missing','number']),'12/2026');assert.equal(ckanExtra(d,['title']),d.title,'a field of the dataset itself');assert.equal(ckanExtra(d,['missing']),'');
 assert.equal(ckanActive(d),true);assert.equal(ckanActive({...d,private:true}),false);assert.equal(ckanActive({...d,state:'deleted'}),false);assert.equal(ckanActive(null),false);
 const {page,documents}=ckanLinks(d,base,{pageTitle:'Datensatz im Open-Data-Portal'});
 assert.equal(page,'https://opendata.beispielstadt.de/dataset/ratsbeschluss-12-2026');
 assert.deepEqual(documents.map(x=>[x.title,x.kind]),[['Datensatz im Open-Data-Portal','html'],['Beschluss (PDF)','application/pdf']],'the http link is left out');
 assert.equal(isCkanAnswer({success:true,result:{}}),true);assert.equal(isCkanAnswer({help:'x'}),false);
});

test('a CKAN portal is recognised from its page (generator tag or the body attributes of its templates) and confirmed by status_show',async()=>{
 assert.deepEqual(detectCkan(base+'dataset','<html><head><meta name="generator" content="ckan 2.9.5"></head><body></body></html>'),{base});
 assert.deepEqual(detectCkan('https://daten.example.de/de/dataset','<body data-site-root="https://daten.example.de/" data-locale-root="https://daten.example.de/de/">'),{base:'https://daten.example.de/'});
 assert.equal(detectCkan(base,'<html><head><meta name="generator" content="TYPO3 CMS"></head><body data-site-root="/"></body></html>'),null);
 assert.equal(detectCkan('http://alt.example.de/','<meta name="generator" content="ckan 2.8">'),null,'only https');
 const asked=[];
 const found=await probeCkan(base,async url=>{asked.push(url);return JSON.stringify({success:true,result:{ckan_version:'2.10.4',site_title:'Offene Daten Beispielstadt'}});});
 assert.deepEqual(found,{version:'2.10.4',title:'Offene Daten Beispielstadt'});assert.deepEqual(asked,[base+'api/3/action/status_show']);
 assert.equal(await probeCkan(base,async()=>'<html>Wartung</html>'),null);
 assert.equal(await probeCkan(base,async()=>{throw Error('Quelle antwortet mit HTTP 403');}),null);
});

test('a search session reads all pages, counts foreign hits, and stops every request after a refusal',async()=>{
 const asked=[];
 const pages=[Array.from({length:100},(_,i)=>dataset({name:'d'+i})),[dataset({name:'last'}),{title:'fremd'}]];
 const {search,state}=ckanSession(base,async url=>{asked.push(url);return answer(pages[asked.length-1],101);},{base});
 let taken=0;await search('Abfrage',{q:'*:*'},pkg=>{if(!pkg.name)return false;taken++;return true;});
 assert.equal(asked.length,2);assert.equal(new URL(asked[1]).searchParams.get('start'),'100');assert.equal(taken,101);assert.equal(state.foreign,1);assert.deepEqual(state.issues,[]);
 const refused=[];
 const s2=ckanSession(base,async url=>{refused.push(url);throw Error('Quelle antwortet mit HTTP 403');},{base},{portal:'Das Portal der Stadt'});
 await s2.search('Erste',{q:'a'},()=>true);await s2.search('Zweite',{q:'b'},()=>true);
 assert.equal(refused.length,1,'no request after HTTP 403');assert.equal(s2.state.shut,true);
 assert.match(s2.state.issues.join(' '),/Erste: Quelle antwortet mit HTTP 403/);assert.match(s2.state.issues.join(' '),/Das Portal der Stadt hat den Abruf abgewiesen/);
 const odd=ckanSession(base,async()=>'{"help":"x"}',{base});await odd.search('Format',{q:'a'},()=>true);
 assert.match(odd.state.issues[0],/Unbekanntes Antwortformat/);
});

test('generic reader: without query profile no request (API verfügbar, Leser/Connector fehlt); with profile datasets of the period become topics',async()=>{
 const none=[];
 const empty=await collectCkan({id:'de-1',name:'Stadt Beispielstadt',kind:'city',adapter:'ckan',base},{now,get:async url=>{none.push(url);return answer([]);}});
 assert.deepEqual(none,[]);assert.equal(empty.topics.length,0);assert.equal(empty.coverage.issues[0],CKAN_NO_PROFILE);
 const asked=[];
 const source={id:'de-1',name:'Stadt Beispielstadt',kind:'city',method:'scraper',adapter:'ckan',base,ckan:profile};
 const d=await collectCkan(source,{now,window:'1m',get:async url=>{asked.push(url);return answer([dataset(),dataset({name:'alt',extras:[{key:'issued',value:'2025-01-01'}]}),dataset({name:'geheim',title:'Nichtöffentliche Vorlage'}),dataset({name:'privat',private:true})]);}});
 assert.ok(asked.every(u=>u.startsWith(base+'api/3/action/package_search?')),'only the search interface; robots.txt is not asked (also with ROBOTS_POLICY=obey)');
 const q=new URL(asked[0]).searchParams;assert.equal(q.get('q'),'tags:ratsbeschluss');assert.equal(q.get('fq'),'metadata_modified:[2026-09-05T00:00:00Z TO *]');
 assert.equal(d.topics.length,1);const t=d.topics[0];
 assert.equal(t.id,'de-1-ckan-ratsbeschluss-12-2026');assert.equal(t.title,'Ratsbeschluss 12/2026: Radweg Hauptstraße');assert.equal(t.reference,'12/2026');
 assert.equal(t.eventDate,'2026-09-19');assert.equal(t.committee,'Rat der Stadt Beispielstadt');assert.equal(t.status,'unknown');assert.equal(t.public,true);
 assert.equal(t.sourceUrl,'https://opendata.beispielstadt.de/dataset/ratsbeschluss-12-2026');assert.equal(t.sourceData.method,'ckan');
 assert.equal(d.coverage.complete,true);assert.match(d.coverage.warnings[0],/^2 Treffer/,'the restricted and the private dataset');
});

test('CKAN is a reader of its own, like OParl a channel of programs: robots.txt does not label it',async()=>{
 assert.ok(READERS.ckan);assert.equal(READERS.ckan.collect,collectCkan);
 assert.deepEqual(await READERS.ckan.detect(base,'<meta name="generator" content="ckan 2.9.5">'),{base});
 assert.deepEqual(channelOf({adapter:'ckan'}),{kind:'api',name:'CKAN',documented:true});
 assert.equal(accessOfSource({method:'scraper',adapter:'ckan',base},'verboten'),'api');
});
