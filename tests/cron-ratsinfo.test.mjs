import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {detectCronRatsinfo,listLinks,parseCronList,parseCronMeeting,cronAgenda,collectCronRatsinfo} from '../server/integrations/cron-ratsinfo.mjs';
// Excerpts of the live pages of ris.helmstedt.de, ris.stadt-helmstedt.de and ris.samtgemeinde-nord-elm.de (04.10.2026).
const page=name=>readFileSync(new URL('./fixtures/cron-ratsinfo/'+name,import.meta.url),'utf8');
const lk={id:'nds-03154',name:'Landkreis Helmstedt',kind:'district',method:'scraper',adapter:'cron-ratsinfo',base:'https://ris.helmstedt.de/',start:'https://ris.helmstedt.de/index.php?id=30&no_cache=1'};
const st={id:'nds-03154028',name:'Stadt Helmstedt',kind:'city',method:'scraper',adapter:'cron-ratsinfo',base:'https://ris.stadt-helmstedt.de/',start:'https://ris.stadt-helmstedt.de/index.php?id=8&no_cache=1'};
const now=new Date('2026-10-01T12:00:00Z');
const plugin=(base,view)=>`${base}index.php?id=30&no_cache=1&tx_cronmmratsinfo_pi%5Bview%5D=${view}`;
const lkAll=plugin(lk.base,'sitzungen')+'&tx_cronmmratsinfo_pi%5Bmode%5D=all&tx_cronmmratsinfo_pi%5BshowTops%5D=&cHash=7cced1d5af9dd0505a8b5dc7a76952cf';
const lkTops=plugin(lk.base,'sitzungen')+'&tx_cronmmratsinfo_pi%5Bmode%5D=all&tx_cronmmratsinfo_pi%5BshowTops%5D=1&tx_cronmmratsinfo_pi%5Bortsfilter%5D=&cHash=dfa487bc34068f9148caa9a2c21294b7';
const back='&tx_cronmmratsinfo_pi%5Breturn_url%5D=index.php%3Fid%3D30%26no_cache%3D1%26tx_cronmmratsinfo_pi%255Bview%255D%3Dsitzungen%26tx_cronmmratsinfo_pi%255Bmode%255D%3Dall%26tx_cronmmratsinfo_pi%255BshowTops%255D%3D1%26tx_cronmmratsinfo_pi%255Bortsfilter%255D%3D';
const meeting=(id,hash)=>plugin(lk.base,'sitzung')+`&tx_cronmmratsinfo_pi%5Bsitzung%5D=${id}${back}&cHash=${hash}`;
const kt=meeting(692,'fd2ba6f7b670fd6d9751b66c89ecaf18'),aws=meeting(660,'8c724f55b734b03380ab553753382452'),old=meeting(61,'82c694eeefe1bccc14de1a6e9eca2089');
const paper=(n,top)=>`https://ris.helmstedt.de/index.php?id=30&no_cache=1791136778&type=547&tx_cronmmratsinfo_pi[view]=vorlage&tx_cronmmratsinfo_pi[vorlage]=${n}&tx_cronmmratsinfo_pi[top]=${top}`;
const web=(changes={})=>{
 const pages={[lk.start]:page('lk-start.html'),[lkAll]:page('lk-all.html'),[lkTops]:page('lk-all-tops.html'),[kt]:page('lk-692.html'),[aws]:page('lk-660.html'),...changes};
 const calls=[];return {pages,calls,get:async url=>{calls.push(url);if(!(url in pages))throw Error('Quelle antwortet mit HTTP 404');return pages[url];}};
};
test('cron-ratsinfo is recognised by the plugin on the page; the start page is named without the plugin parameters',()=>{
 assert.deepEqual(detectCronRatsinfo('https://ris.helmstedt.de/index.php?id=30&no_cache=1',page('lk-start.html')),{adapter:'cron-ratsinfo',base:'https://ris.helmstedt.de/',start:'https://ris.helmstedt.de/index.php?id=30&no_cache=1'});
 // Any page of the plugin leads to the same start page: here a meeting page, addressed over http.
 assert.deepEqual(detectCronRatsinfo('http://ris.helmstedt.de/'+kt.slice(25),page('lk-692.html')+`<a href="index.php?id=30&amp;no_cache=1&amp;tx_cronmmratsinfo_pi%5Bview%5D=sitzungen&amp;tx_cronmmratsinfo_pi%5Bmode%5D=all">Zurück</a>`),{adapter:'cron-ratsinfo',base:'https://ris.helmstedt.de/',start:'https://ris.helmstedt.de/index.php?id=30&no_cache=1'});
 // Absolute links and share buttons that carry the list address inside a foreign one.
 assert.equal(detectCronRatsinfo('https://ris.stadt-helmstedt.de/index.php?id=8&no_cache=1',page('st-all.html')).start,st.start);
 assert.deepEqual(detectCronRatsinfo('https://ris.samtgemeinde-nord-elm.de/index.php?id=349',page('ne-start.html')),{adapter:'cron-ratsinfo',base:'https://ris.samtgemeinde-nord-elm.de/',start:'https://ris.samtgemeinde-nord-elm.de/index.php?id=349'});
 assert.equal(detectCronRatsinfo('https://www.example.test/',`<html><meta name="generator" content="TYPO3 CMS"><a href="index.php?id=4">Rat</a></html>`),null);
 assert.equal(detectCronRatsinfo('not a url',page('lk-start.html')),null);
 // The municipality's own site that links the system on another host is no page of the plugin, also behind <base href>.
 assert.equal(detectCronRatsinfo('https://www.helmstedt.de/politik/','<a href="https://ris.helmstedt.de/index.php?id=30&amp;tx_cronmmratsinfo_pi%5Bview%5D=sitzungen">Ratsinfo</a>'),null);
 assert.equal(detectCronRatsinfo('https://www.helmstedt.de/politik/','<base href="https://ris.helmstedt.de/"><a href="index.php?id=30&amp;tx_cronmmratsinfo_pi%5Bview%5D=sitzungen">Ratsinfo</a>'),null);
 // A page that only names the extension, also with its markup as an example.
 assert.equal(detectCronRatsinfo('https://extensions.typo3.org/extension/cronmm_ratsinfo','<p>Das Plugin tx_cronmmratsinfo_pi zeigt Sitzungen.</p><pre>&lt;div class=&quot;tx-cronmmratsinfo-pi&quot;&gt;</pre>'),null);
 // A page of the same host that links a single meeting names no list; one that links the list leads to it.
 assert.equal(detectCronRatsinfo('https://ris.helmstedt.de/index.php?id=1','<a href="index.php?id=30&amp;tx_cronmmratsinfo_pi%5Bview%5D=sitzung&amp;tx_cronmmratsinfo_pi%5Bsitzung%5D=692">Kreistag</a>'),null);
 assert.deepEqual(detectCronRatsinfo('https://ris.helmstedt.de/index.php?id=1','<a href="index.php?id=30&amp;no_cache=1&amp;tx_cronmmratsinfo_pi%5Bview%5D=sitzungen&amp;cHash=1">Sitzungen</a>'),{adapter:'cron-ratsinfo',base:'https://ris.helmstedt.de/',start:'https://ris.helmstedt.de/index.php?id=30&no_cache=1'});
});
test('cron-ratsinfo takes the list addresses with their checksum from the links of the page, never from a foreign host',()=>{
 assert.deepEqual(listLinks(page('lk-start.html'),lk.start,lk),{all:lkAll});
 assert.deepEqual(listLinks(page('lk-all.html'),lkAll,lk),{withTops:lkTops});
 // The share buttons come first on the page of the town and hold the same parameters.
 assert.match(page('st-all.html'),/facebook\.com\/sharer[^"]*tx_cronmmratsinfo_pi%5Bmode%5D=all/);
 assert.deepEqual(listLinks(page('st-all.html'),st.start,st),{withTops:'https://ris.stadt-helmstedt.de/index.php?id=8&no_cache=1&tx_cronmmratsinfo_pi%5Bview%5D=sitzungen&tx_cronmmratsinfo_pi%5Bmode%5D=all&tx_cronmmratsinfo_pi%5BshowTops%5D=1&tx_cronmmratsinfo_pi%5Bortsfilter%5D=&cHash=3321b2907221dad780405ad1a768126c'});
 assert.deepEqual(listLinks(page('lk-start.html'),lk.start,st),{},'links of another source are not followed');
});
test('cron-ratsinfo list names day, committee, meeting page and the numbered public items of every meeting',()=>{
 const list=parseCronList(page('lk-all-tops.html'),lkTops,lk);
 assert.deepEqual(list.map(m=>[m.date,m.committee,m.url,m.record,m.items.length]),[['2026-10-09','Grundstücksverkehrsausschuss (GVA)',null,null,0],['2026-09-30','Kreistag (KT)',kt,'692',9],['2026-09-18','Kreisausschuss (KA)',null,null,0],['2026-09-17','Ausschuss für Wirtschaft und Strategie (AWS)',aws,'660',5],['2017-02-16','Ausschuss für Wirtschaft und Strategie (AWS)',old,'61',2]]);
 assert.deepEqual(list[1].items.slice(5,7),[{number:'17',title:'Bekanntgaben / Kenntnisnahmen'},{number:'17.1',title:'Übernahme der Beförderungskosten für Schüler-/innen der Sekundarstufe II und der Berufsbildenden Schulen'}]);
 assert.match(list[3].items[2].title,/^Weiterentwicklung der Kennzahlensets der wesentlichen Produkte: W-Produkt 36101/);
 // Numbers as the systems print them.
 const odd=parseCronList(`<div class="tx_cronmmratsinfo_pi-sitzungen"><dl><dt><b>Dienstag, 03. März 2026</b></dt><dd><a href="index.php?id=8&amp;tx_cronmmratsinfo_pi%5Bview%5D=sitzung&amp;tx_cronmmratsinfo_pi%5Bsitzung%5D=7&amp;cHash=1">Rat</a><ul><li>5 a. Übergangsfinanzierung</li><li>8 neu. Radwegebau</li><li>--. Änderung der Tagesordnung</li><li>.. Begrüßung durch Dr. Muster</li><li>9a. Mitteilungen</li></ul></dd></dl></div>`,st.start,st);
 assert.deepEqual(odd[0].items.map(i=>[i.number,i.title]),[['5 a','Übergangsfinanzierung'],['8 neu','Radwegebau'],['--','Änderung der Tagesordnung'],['.','Begrüßung durch Dr. Muster'],['9a','Mitteilungen']]);
 assert.equal(odd[0].date,'2026-03-03');assert.equal(odd[0].url,'https://ris.stadt-helmstedt.de/index.php?id=8&tx_cronmmratsinfo_pi%5Bview%5D=sitzung&tx_cronmmratsinfo_pi%5Bsitzung%5D=7&cHash=1');
 assert.equal(parseCronList('<html>Wartungsarbeiten</html>',lkTops,lk),null);
});
test('cron-ratsinfo meeting page links the papers of an item; only items the list names as public are taken',()=>{
 const detail=parseCronMeeting(page('lk-660.html'),aws,lk);
 assert.equal(detail.committee,'Ausschuss für Wirtschaft und Strategie (AWS)');assert.equal(detail.date,'2026-09-17');
 assert.deepEqual(detail.rows.map(r=>[r.number,r.papers.map(p=>p.reference)]),[['1',[]],['5',[]],['13',['ANH033/2026','ANH034/2026']],['14',['V064/2026']],['16',[]]]);
 assert.deepEqual(detail.rows[3].papers,[{record:'2504',reference:'V064/2026',url:paper(2504,11325)}]);
 // A row that the list does not name (e.g. of a non-public part) is never taken, whatever the page shows.
 const extra=page('lk-660.html').replace('</table>','<tr class="listRow"><td><b>TOP 20</b></td><td>Grundstücksangelegenheit</td><td><a href="https://ris.helmstedt.de/index.php?id=30&type=547&tx_cronmmratsinfo_pi[view]=vorlage&tx_cronmmratsinfo_pi[vorlage]=9999" title="V999/2026">x</a></td></tr></table>');
 const m=parseCronList(page('lk-all-tops.html'),lkTops,lk)[3],items=cronAgenda(m,parseCronMeeting(extra,aws,lk),lk,now);
 assert.deepEqual(items.map(i=>[i.id.replace(/[0-9a-f]{8}$/,'#'),i.reference,i.status,i.documents.length]),[['nds-03154-top-660-#','','unknown',0],['nds-03154-top-660-#','','unknown',0],['nds-03154-vo-2536','ANH033/2026','unknown',2],['nds-03154-vo-2504','V064/2026','unknown',1],['nds-03154-top-660-#','','unknown',0]]);
 assert.ok(!JSON.stringify(items).includes('Grundstück'));
 // A listed item under the same number as that row but with another title takes neither its paper nor its id.
 const named=cronAgenda({...m,items:[...m.items,{number:'20',title:'Bericht der Verwaltung'}]},parseCronMeeting(extra,aws,lk),lk,now).at(-1);
 assert.match(named.id,/^nds-03154-top-660-[0-9a-f]{8}$/);assert.equal(named.reference,'');assert.deepEqual(named.documents,[]);assert.equal(named.agenda.onPage,false);
 assert.ok(!JSON.stringify(named).includes('V999')&&!JSON.stringify(named).includes('9999'));
 // Spacing, punctuation or a title cut short in the list still find the row of the item.
 assert.equal(cronAgenda({...m,items:[{number:'14',title:'Entsendung eines Vertreters des  Landkreises Helmstedt –'}]},detail,lk,now)[0].id,'nds-03154-vo-2504');
 // The two items "Einwohnerfragestunde" of one meeting are told apart by their numbers.
 assert.notEqual(items[1].id,items[4].id);
 assert.deepEqual(items[3].documents,[{title:'Vorlage V064/2026',url:paper(2504,11325),kind:'application/pdf'}]);assert.equal(items[3].sourceUrl,aws);assert.deepEqual(items[3].identityLinks,[]);
 // A paper linked to another host is no document, but still names the item.
 const foreign=parseCronMeeting(page('lk-660.html').replaceAll('https://ris.helmstedt.de/index.php?id=30&no_cache','https://elsewhere.example/index.php?id=30&no_cache'),aws,lk);
 assert.deepEqual(foreign.rows[3].papers,[{record:'2504',reference:'V064/2026',url:null}]);assert.equal(cronAgenda(m,foreign,lk,now)[3].id,'nds-03154-vo-2504');
 assert.equal(parseCronMeeting('<html><div class="tx_cronmmratsinfo_pi-sitzungen"></div></html>',aws,lk),null);
 // Ahead of the meeting an item is announced, or under consultation when a paper belongs to it.
 assert.deepEqual(cronAgenda(m,detail,lk,new Date('2026-09-10T12:00:00Z')).map(i=>i.status),['announced','announced','consulting','consulting','announced']);
});
test('cron-ratsinfo collector follows the links of the site to the list, reads each meeting page once and groups items by paper',async()=>{
 const {calls,get}=web(),timeouts={};
 const d=await collectCronRatsinfo(lk,{now,window:'1m',get:(url,source,timeout)=>{timeouts[url]=timeout;return get(url);}});
 // The list with every agenda item takes the server about 17 s; it may take longer than a meeting page.
 assert.ok(timeouts[lkTops]>20000&&timeouts[lkTops]<=60000);assert.ok(timeouts[kt]<=20000);
 assert.deepEqual(calls.slice(0,3),[lk.start,lkAll,lkTops]);assert.deepEqual(calls.slice(3).sort(),[aws,kt].sort());
 assert.ok(calls.every(u=>u.startsWith(lk.base)));assert.ok(!calls.includes(old),'a meeting before the period is not read');
 assert.deepEqual(d.coverage.issues,[]);assert.equal(d.coverage.complete,true);assert.equal(d.coverage.method,'scraper');assert.equal(d.coverage.meetings,2);
 assert.equal(d.coverage.upcomingWithoutAgenda,1);assert.equal(d.coverage.nonPublicMeetings,1);assert.equal(d.coverage.from,'2026-09-01');assert.equal(d.coverage.sourceUrl,lk.start);assert.equal(d.readMeetings,2);
 assert.equal(d.topics.length,13,'fourteen public items, one paper discussed in both meetings');
 const delegate=d.topics.find(t=>t.id==='nds-03154-vo-2504');
 assert.deepEqual(delegate.events.map(e=>[e.date,e.committee,e.status,e.decision.kind]),[['2026-09-17','Ausschuss für Wirtschaft und Strategie (AWS)','unknown','unknown'],['2026-09-30','Kreistag (KT)','unknown','unknown']]);
 assert.equal(delegate.reference,'V064/2026');assert.equal(delegate.eventDate,'2026-09-30');assert.equal(delegate.committee,'Kreistag (KT)');assert.equal(delegate.regionId,lk.id);assert.equal(delegate.source,'district');assert.equal(delegate.public,true);
 // Both meetings link the same paper, each under another address: it is one document.
 assert.deepEqual(delegate.documents.map(d=>[d.title,d.kind]),[['Vorlage V064/2026','application/pdf'],['Sitzung / öffentliche Tagesordnung','html']]);
 assert.equal(delegate.sourceData.method,'cron-ratsinfo');assert.deepEqual(delegate.sourceData.records[0].fields.papers,['V064/2026']);assert.equal(delegate.events[0].attendance.status,'not_collected');
 assert.match(delegate.longSummary[0],/Landkreis Helmstedt/);assert.equal(delegate.quality.passed,false);
 assert.ok(!JSON.stringify(d).includes('Grundstücksverkehrsausschuss'),'a meeting without public items yields nothing');
 assert.deepEqual(Object.keys(d.marks).sort(),[aws,kt].sort());
 // Paper links carry a new no_cache value at every page view; the items keep their ids.
 const again=await collectCronRatsinfo(lk,{now,window:'1m',get:web({[kt]:page('lk-692.html').replaceAll('no_cache=1791136548','no_cache=1791222222'),[aws]:page('lk-660.html').replaceAll('no_cache=1791136778','no_cache=1791222223')}).get});
 assert.deepEqual(again.topics.map(t=>t.id).sort(),d.topics.map(t=>t.id).sort());
});
test('cron-ratsinfo collector skips meeting pages while the list names the same items as at the last complete reading',async()=>{
 const first=await collectCronRatsinfo(lk,{now,get:web().get,window:'1m'});
 const later=new Date(now.getTime()+15*86400000),stock=new Set([kt,aws]);
 const {calls,get}=web();const second=await collectCronRatsinfo(lk,{now:later,get,window:'3m',marks:{known:first.marks,stock}});
 assert.deepEqual(calls,[lk.start,lkAll,lkTops]);assert.equal(second.coverage.unchangedMeetings,2);assert.equal(second.topics.length,0);assert.equal(second.coverage.complete,true);assert.deepEqual(second.coverage.issues,[]);
 // An item added to the agenda: that meeting is read again.
 const changed=web({[lkTops]:page('lk-all-tops.html').replace('<li>19. Schließung der Sitzung</li>','<li>18a. Nachtrag</li><li>19. Schließung der Sitzung</li>')});
 const third=await collectCronRatsinfo(lk,{now:later,get:changed.get,window:'3m',marks:{known:first.marks,stock}});
 assert.equal(third.coverage.unchangedMeetings,1);assert.ok(changed.calls.includes(kt));assert.ok(!changed.calls.includes(aws));assert.ok(third.topics.some(t=>t.title==='Nachtrag'));
 // A meeting still ahead gets papers on its page while the list stays the same: only a recent reading spares its page.
 const before=new Date('2026-09-25T12:00:00Z'),early=await collectCronRatsinfo(lk,{now:before,get:web().get,window:'1m'});
 assert.equal(early.marks[kt][3],'f');assert.ok(!early.topics.some(t=>t.id==='nds-03154-vo-2600'));
 const soon=web();const hour=await collectCronRatsinfo(lk,{now:new Date(before.getTime()+3600000),get:soon.get,window:'1m',marks:{known:early.marks,stock}});
 assert.ok(!soon.calls.includes(kt));assert.ok(hour.coverage.unchangedMeetings>=1);
 const closing=page('lk-692.html').replace(/(Schließung der Sitzung\s*<\/td>\s*<td[^>]*>)[\s\S]*?(<\/td>)/,`$1<a target="_blank" href="${paper(2600,11400)}" title="V070/2026">x</a>$2`);
 const later2=web({[kt]:closing});const next=await collectCronRatsinfo(lk,{now:new Date(before.getTime()+86400000),get:later2.get,window:'1m',marks:{known:early.marks,stock}});
 assert.ok(later2.calls.includes(kt));assert.equal(next.topics.find(t=>t.id==='nds-03154-vo-2600')?.reference,'V070/2026');
});
test('cron-ratsinfo collector reports what it cannot read and never mistakes it for a quiet period',async()=>{
 const asked=[];const foreign=await collectCronRatsinfo(lk,{now,window:'12m',get:async url=>{asked.push(url);return '<html><title>Landkreis</title></html>';}});
 assert.deepEqual(asked,[lk.start]);assert.match(foreign.coverage.issues[0],/^Sitzungsliste: Unbekanntes Format/);assert.equal(foreign.coverage.quiet,false);assert.equal(foreign.coverage.complete,false);
 // A list without the agenda option.
 const plain=await collectCronRatsinfo(lk,{now,window:'12m',get:web({[lkAll]:page('lk-all.html').replace(/<a [^>]*showTops%5D=1[^>]*>anzeigen<\/a>/,'')}).get});
 assert.deepEqual(plain.coverage.issues,['Sitzungsliste: Liste „Alle Sitzungen“ mit Tagesordnung ist nicht verlinkt','Noch keine Artikel erfolgreich erfasst.']);
 // The server ignores the agenda option (e.g. TYPO3 drops the parameters): no meeting of that list counts as non-public.
 const bare=web({[lkTops]:page('lk-all.html')});const untopped=await collectCronRatsinfo(lk,{now,window:'1m',get:bare.get});
 assert.deepEqual(bare.calls,[lk.start,lkAll,lkTops]);assert.deepEqual(untopped.coverage.issues,['Sitzungsliste: Sitzungsliste ohne Tagesordnungspunkte','Noch keine Artikel erfolgreich erfasst.']);
 assert.equal(untopped.coverage.nonPublicMeetings,undefined);assert.equal(untopped.coverage.quiet,false);assert.equal(untopped.coverage.complete,false);
 // The plugin's list in other markup (here a table) is no quiet period.
 const table=await collectCronRatsinfo(lk,{now,window:'1m',get:web({[lkTops]:page('lk-all-tops.html').replace(/<dl>[\s\S]*<\/dl>/,'<table><tr><td>30.09.2026</td><td>Kreistag (KT)</td></tr></table>')}).get});
 assert.deepEqual(table.coverage.issues,['Sitzungsliste: Unbekanntes Format der Sitzungsliste','Noch keine Artikel erfolgreich erfasst.']);assert.equal(table.coverage.quiet,false);
 // A linked meeting whose items are missing from the list is a gap, not a non-public meeting; the other one is read.
 const lost=await collectCronRatsinfo(lk,{now,window:'1m',get:web({[lkTops]:page('lk-all-tops.html').replace(/<ul>\s*<li>1\. Eröffnung der Sitzung<\/li>\s*<li>4\.[\s\S]*?<\/ul>/,'')}).get});
 assert.deepEqual(lost.coverage.issues,['Sitzung vom 2026-09-30 (Kreistag (KT)) verlinkt, aber ohne Tagesordnungspunkte in der Liste']);
 assert.equal(lost.coverage.nonPublicMeetings,1);assert.equal(lost.coverage.meetings,1);assert.equal(lost.coverage.complete,false);assert.deepEqual(Object.keys(lost.marks),[aws]);
 const denied=await collectCronRatsinfo(lk,{now,window:'12m',get:async()=>{throw Error('Quelle antwortet mit HTTP 403');}});
 assert.deepEqual(denied.coverage.issues,['Sitzungsliste: Quelle antwortet mit HTTP 403','Noch keine Artikel erfolgreich erfasst.']);assert.equal(denied.coverage.quiet,false);
 // A meeting page without agenda is a gap; the other meeting is still read.
 const gap=await collectCronRatsinfo(lk,{now,window:'1m',get:web({[kt]:'<html><p>Seite nicht gefunden</p></html>'}).get});
 assert.deepEqual(gap.coverage.issues,['Keine lesbare öffentliche Tagesordnung: '+kt]);assert.equal(gap.coverage.complete,false);assert.deepEqual(Object.keys(gap.marks),[aws]);assert.ok(gap.topics.length>0);
 // Rows that cannot be read, rows numbered in another way ("Ö 1") that match no listed item, or the page of another
 // meeting: nothing of that meeting is kept and no mark is written, so that no item loses its paper and its id.
 for(const wrong of [page('lk-692.html').replace(/<td\b/g,'<th').replace(/<\/td>/g,'</th>'),page('lk-692.html').replace(/<b>TOP /g,'<b>Ö '),page('lk-660.html')]){
  const r=await collectCronRatsinfo(lk,{now,window:'1m',get:web({[kt]:wrong}).get});
  assert.deepEqual(r.coverage.issues,['Keine lesbare öffentliche Tagesordnung: '+kt]);assert.deepEqual(Object.keys(r.marks),[aws]);assert.ok(!r.topics.some(t=>t.events.some(e=>e.url===kt)));
 }
 // Out of time: nothing of that meeting is kept, so that no item changes its id; the import can be resumed.
 const slow=web();const cut=await collectCronRatsinfo(lk,{now,window:'1m',get:async url=>{if(url===kt)throw Error('Zeitbudget der Quelle erreicht');return slow.get(url);}});
 assert.equal(cut.coverage.resumable,true);assert.ok(cut.coverage.issues.includes('Zeitbudget der Quelle erreicht; 1 Sitzung noch nicht vollständig gelesen.'));assert.ok(!cut.topics.some(t=>t.events.some(e=>e.url===kt)));
 // No time left for the list: nothing is asked.
 const none=[];const late=await collectCronRatsinfo(lk,{now,window:'1m',maxDurationMs:0,get:async url=>{none.push(url);return '';}});
 assert.deepEqual(none,[]);assert.deepEqual(late.coverage.issues,['Sitzungsliste: Zeitbudget der Quelle erreicht','Noch keine Artikel erfolgreich erfasst.']);
 // A period with only a non-public meeting is quiet: the list itself says that there is nothing public to read.
 const quiet=web();const calm=await collectCronRatsinfo(lk,{now:new Date('2026-10-12T12:00:00Z'),window:'1w',get:quiet.get});
 assert.deepEqual(quiet.calls,[lk.start,lkAll,lkTops]);assert.equal(calm.coverage.quiet,true);assert.equal(calm.coverage.meetings,0);assert.equal(calm.coverage.nonPublicMeetings,1);assert.deepEqual(calm.coverage.issues,['Noch keine Artikel erfolgreich erfasst.']);
});
test('cron-ratsinfo collector reads a site with absolute links behind share buttons (Stadt Helmstedt)',async()=>{
 const all='https://ris.stadt-helmstedt.de/index.php?id=8&no_cache=1&tx_cronmmratsinfo_pi%5Bview%5D=sitzungen&tx_cronmmratsinfo_pi%5Bmode%5D=all&tx_cronmmratsinfo_pi%5BshowTops%5D=&cHash=cc95fa7af87180f8c888995371f6c4b1';
 const tops='https://ris.stadt-helmstedt.de/index.php?id=8&no_cache=1&tx_cronmmratsinfo_pi%5Bview%5D=sitzungen&tx_cronmmratsinfo_pi%5Bmode%5D=all&tx_cronmmratsinfo_pi%5BshowTops%5D=1&tx_cronmmratsinfo_pi%5Bortsfilter%5D=&cHash=3321b2907221dad780405ad1a768126c';
 const fa=parseCronList(page('st-all-tops.html'),tops,st).find(m=>m.record==='6109').url;
 const pages={[st.start]:page('st-start.html'),[all]:page('st-all.html'),[tops]:page('st-all-tops.html'),[fa]:page('st-6109.html')},calls=[];
 const d=await collectCronRatsinfo(st,{now,window:'1m',get:async url=>{calls.push(url);if(!(url in pages))throw Error('Quelle antwortet mit HTTP 404');return pages[url];}});
 assert.deepEqual(calls,[st.start,all,tops,fa]);assert.deepEqual(d.coverage.issues,[]);assert.equal(d.coverage.meetings,1);assert.equal(d.coverage.upcomingWithoutAgenda,1);
 assert.deepEqual(d.topics.map(t=>[t.id.replace(/[0-9a-f]{8}$/,'#'),t.reference]),[['nds-03154028-top-6109-#',''],['nds-03154028-top-6109-#',''],['nds-03154028-vo-9341','V126/26'],['nds-03154028-vo-9337','V125/26'],['nds-03154028-top-6109-#',''],['nds-03154028-vo-9165','B026/26'],['nds-03154028-top-6109-#','']]);
 assert.equal(d.topics[2].title,'Beschluss über den Jahresabschluss 2025 der Stadt Helmstedt und die Entlastung des Bürgermeisters für das Haushaltsjahr 2025');
});
