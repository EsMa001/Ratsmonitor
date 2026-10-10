import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {detectTiGenerator,extraPages,parseTiPapers,parseTiNoticeText,collectTiGenerator} from '../server/integrations/ti-generator.mjs';
// Installations without invitation lists: Amt Gartz (Oder) lists the papers per body, VG Vorharz only notices as PDF.
// Excerpts of live pages of 10.10.2026 (menu reduced to the lists, three entries of each list).
const fixture=name=>readFileSync(new URL(`./fixtures/ti-generator/${name}`,import.meta.url),'utf8');
const gb='https://ris.example.test/ris/ti-5/',gs={id:'de-120735304',name:'Amt Gartz (Oder)',kind:'amt',method:'scraper',adapter:'ti-generator',base:gb};
const vb='https://ris.example.test/Ratsmanager/ris/ti-1/',vs={id:'de-150855051',name:'VG Vorharz',kind:'vg',method:'scraper',adapter:'ti-generator',base:vb};
const now=new Date('2026-10-01T12:00:00Z');
const empty=fixture('papers-gartz.html').split('<div data-role="collapsible"')[0]+'</div></div>',nothing='<html><body><p>Unter dieser Kategorie sind momentan keine Eintr&auml;ge vorhanden.</p><p>Stand: 06.10.2026 - 14:16 Uhr</p></body></html>';
test('TI-Generator without invitation lists: papers and notices are found in the menu',()=>{
 const gartz=fixture('start-gartz.html'),vorharz=fixture('start-vorharz.html');
 assert.equal(detectTiGenerator(gb,gartz).invitationLists,0);
 assert.deepEqual(extraPages(gartz,gs).map(p=>[p.url.slice(gb.length),p.kind,p.committee,p.group]),[['listen/ti_13__60_bv_.php','papers','Stadtverordnetenversammlung','60'],['listen/ti_31__60_bk_.php','notices','Stadtverordnetenversammlung','60']]);
 assert.deepEqual(extraPages(vorharz,{base:vb}).map(p=>[p.kind,p.committee,p.until]),[['notices','Verbandsgemeinderat',null],['notices','Verbandsgemeinderat',2019],['notices','Haupt- und Vergabeausschuss',null]]);
});
test('TI-Generator papers list yields the public items of each meeting',()=>{
 const read=parseTiPapers(fixture('papers-gartz.html'),{url:gb+'listen/ti_13__60_bv_.php',committee:'Stadtverordnetenversammlung',group:'60'},gs);
 const m=read.meetings.find(x=>x.date==='2026-09-17');
 assert.equal(m.committee,'Stadtverordnetenversammlung');
 assert.deepEqual(m.agenda.map(i=>[i.number,i.title,i.reference]),[['11.','Beratung und Beschlussfassung zur Entgeltordnung für die Überlassung des Sitzungssaals des Rathauses','G/61/26']]);
 assert.deepEqual(m.agenda[0].documents.map(d=>[d.title,d.url.startsWith(gb+'listen/')]),[['Vorlage G/61/26',true],['ENTWURF Entgeltordnung Rathaus',true]]);
 const hidden=fixture('papers-gartz.html').replace(/\(&nbsp;&ouml;ffentlicher&nbsp;Teil&nbsp;\)/g,'(&nbsp;nicht&nbsp;&ouml;ffentlicher&nbsp;Teil&nbsp;)');
 assert.equal(parseTiPapers(hidden,{url:gb,committee:'X',group:'1'},gs).meetings.length,0,'a paper of the non-public part gives no item');
});
test('TI-Generator notice text yields the items of the public part with references',()=>{
 const read=parseTiNoticeText(fixture('notice-vorharz.txt'));
 assert.equal(read.date,'2026-09-28');
 assert.equal(read.items.length,20);
 assert.deepEqual(read.items[6],{number:'07',title:'Änderung der Kostenbeitragsatzung für den Besuch von Kindertageseinrichtungen und Tagespflegestellen in der Verbandsgemeinde Vorharz ab 01.01.2027',reference:'LP VIII 26-163',documents:[]});
 assert.ok(read.items[14].title.startsWith('3. Änderung der Zusammensetzung des Gemeindewahlausschusses'),'the page footer inside the list is dropped');
 assert.ok(!read.items.some(i=>/Grundstücksangelegenheit|Personalangelegenheit/.test(i.title)),'the non-public part is not taken');
 assert.deepEqual(parseTiNoticeText('Am 01.02.2026 findet eine Sitzung statt.\nNichtöffentlicher Teil:\n01. Personal'),{date:'2026-02-01',items:[]});
});
test('TI-Generator collector reads papers (Amt Gartz) and notices (VG Vorharz) when no invitation lists exist',async()=>{
 const pages={[gb]:fixture('start-gartz.html'),[gb+'listen/ti_13__60_bv_.php']:fixture('papers-gartz.html'),[gb+'listen/ti_31__60_bk_.php']:nothing};
 const done=await collectTiGenerator(gs,{now,get:async url=>{if(!(url in pages))throw Error('Quelle antwortet mit HTTP 404');return pages[url];},getPdf:async()=>{throw Error('kein PDF');}});
 assert.ok(done.topics.some(t=>t.reference==='G/61/26'&&t.committee==='Stadtverordnetenversammlung'));
 assert.ok(!done.coverage.issues.some(i=>/Einladungslisten|Unbekanntes Format/.test(i)),'a list without entries is no unknown format');
 const vp={[vb]:fixture('start-vorharz.html'),[vb+'listen/ti_3__10_bk_.php']:fixture('notices-vorharz.html'),[vb+'listen/ti_7__101_bk_.php']:empty};
 const asked=[],text=fixture('notice-vorharz.txt');
 const read=await collectTiGenerator(vs,{now,get:async url=>{if(!(url in vp))throw Error('Quelle antwortet mit HTTP 404');return vp[url];},getPdf:async url=>{asked.push(url);return text;}});
 assert.ok(asked.length>=1&&asked.every(u=>u.startsWith(vb+'listen/')));
 const topic=read.topics.find(t=>t.reference==='LP VIII 26-163');
 assert.equal(topic.committee,'Verbandsgemeinderat');assert.equal(topic.eventDate,'2026-09-28');
 assert.ok(topic.documents.some(d=>d.kind==='application/pdf'));
});
