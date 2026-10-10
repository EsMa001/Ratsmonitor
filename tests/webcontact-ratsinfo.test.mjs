import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectWebcontactRatsinfo,parseAgendaHtml,meetingDay,bodyOf,collectWebcontactRatsinfo} from '../server/integrations/webcontact-ratsinfo.mjs';
// Public JSON interface of www.burgbernheim.de (Ratsinfo of webcontact) as published on 10.10.2026, cut to three meetings.
const fixture=name=>fs.readFileSync(new URL('./fixtures/webcontact-ratsinfo/'+name,import.meta.url),'utf8');
const base='https://www.burgbernheim.de/',source={id:'de-095755524',name:'Burgbernheim',kind:'municipality',method:'scraper',adapter:'webcontact-ratsinfo',base};
const now=new Date('2026-10-10T12:00:00Z');
const API=base+'api/cms/ratsinfosystem_sitzungen?taggingpfad=%2Fratsinfo%2Fsitzungen%2F&seite=1&pro_seite=10&order%5B%5D=%60datum%60+DESC';

test('webcontact Ratsinfo is recognised by its page template',()=>{
 const page='<html><script>{"template":"TemplateRatsinfosystemUebersicht","options":{"taggingpfad":"/ratsinfo/sitzungen/"}}</script><script src="/_nuxt/x.js"></script></html>';
 assert.deepEqual(detectWebcontactRatsinfo('https://www.burgbernheim.de/ratsinfo/',page),{adapter:'webcontact-ratsinfo',base});
 assert.equal(detectWebcontactRatsinfo('https://www.burgbernheim.de/ratsinfo/','<html>Rathaus</html>'),null);
 assert.equal(detectWebcontactRatsinfo('http://www.burgbernheim.de/ratsinfo/',page),null);
});

test('webcontact Ratsinfo agenda: table of the Sitzungsbericht and numbered list of the Einladung',()=>{
 const first=JSON.parse(fixture('sitzungen-seite-1.json')).data[0];
 const table=parseAgendaHtml(first.bericht.sitzungsbericht_text);
 assert.equal(table.length,9);
 assert.deepEqual(table[1],{number:'2',title:'Kläranlage Burgbernheim; Antrag auf gehobene wasserrechtliche Erlaubnis',result:''});
 assert.ok(!table[6].title.includes('­'),'soft hyphens are dropped');
 const old=JSON.parse(fixture('einladung-alt.json'));
 const list=parseAgendaHtml(old.einladung.einladung_oeffentlich);
 assert.equal(list[1].number,'2');assert.match(list[1].title,/^Neubau Ärztehaus/);assert.match(list[1].result,/Fa\. Dietzinger/);
 assert.deepEqual(parseAgendaHtml('<p>nichts</p>'),[]);
 assert.equal(meetingDay('2023-03-29T22:00:00.000Z'),'2023-03-30');
 assert.equal(bodyOf('5. Sitzung des Stadtrates'),'Stadtrat');
});

test('webcontact Ratsinfo import: items of the public agenda, only the list interface is requested',async()=>{
 const asked=[];
 const get=async url=>{asked.push(url);if(url===API)return fixture('sitzungen-seite-1.json');throw Error('Quelle antwortet mit HTTP 404');};
 const result=await collectWebcontactRatsinfo(source,{now,get,window:'3m'});
 assert.equal(result.coverage.complete,true,JSON.stringify(result.coverage.issues));
 assert.deepEqual(asked,[API]);
 assert.equal(result.coverage.meetings,3);
 const t=result.topics.find(x=>x.title.startsWith('Kläranlage Burgbernheim'));
 assert.equal(t.committee,'Stadtrat');assert.equal(t.eventDate,'2026-10-15');assert.equal(t.status,'consulting');
 assert.ok(t.events[0].url.startsWith(base+'ratsinfo/sitzungen/5-sitzung-des-stadtrates'));
 assert.ok(!result.topics.some(x=>/^Genehmigung der Sitzungsniederschrift/.test(x.title)),'formal items carry no report');
 const bad=await collectWebcontactRatsinfo(source,{now,get:async()=>'<html>Wartung</html>',window:'3m'});
 assert.equal(bad.coverage.complete,false);assert.match(bad.coverage.issues.join(' '),/Unbekanntes Format/);
});

test('webcontact Ratsinfo refuses addresses beyond the list interface',async()=>{
 const get=async url=>{throw Error('unexpected '+url);};
 const other={...source,path:'/intern/'};
 const result=await collectWebcontactRatsinfo(other,{now,get,window:'3m'});
 assert.equal(result.coverage.complete,false);assert.match(result.coverage.issues.join(' '),/Nicht freigegebene Quelladresse|unexpected/);
});
