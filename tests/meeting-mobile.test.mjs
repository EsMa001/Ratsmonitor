import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectMeetingMobile,mmUrl,mmMeetings,parseMmMeeting,mmItems,collectMeetingMobile} from '../server/integrations/meeting-mobile.mjs';
// Pages of meeting-mobile.de (RIS Web, Lotus Domino XPages) and ris.reutlingen.de as published on 10.10.2026
// (scripts and styles removed, lists shortened).
const fixture=name=>fs.readFileSync(new URL('./fixtures/meeting-mobile/'+name,import.meta.url),'utf8');
const base='https://www.meeting-mobile.de/mm/unterreichenbach/ris_web.nsf/',source={id:'bw-08235073',name:'Gemeinde Unterreichenbach',kind:'city',method:'scraper',adapter:'meeting-mobile',base};
const now=new Date('2026-10-10T12:00:00Z');
const GR='8B350B35EF66F5E5C1258E720038BAA3';
const rbase='https://ris.reutlingen.de/programme/RIS/ris_web.nsf/',rsource={id:'de-08415061',name:'Stadt Reutlingen',kind:'city',method:'scraper',adapter:'meeting-mobile',base:rbase};

test('Meeting Mobile is recognised by the Domino XPages address and page',()=>{
 const page='<script src="/xsp/.ibmxspres/dojoroot-1.17.3/dojo/dojo.js"></script><a href="/mm/x/ris_web.nsf/meeting_period_doc.xsp">Sitzungen</a>';
 assert.deepEqual(detectMeetingMobile('https://www.meeting-mobile.de/mm/unterreichenbach/ris_web.nsf/meeting_period_overview_doc.xsp',page),{adapter:'meeting-mobile',base});
 assert.deepEqual(detectMeetingMobile('https://ris.reutlingen.de/programme/RIS/ris_web.nsf/desktop_main.xsp',page),{adapter:'meeting-mobile',base:rbase});
 assert.equal(detectMeetingMobile('https://www.example.de/index.html',page),null);
 assert.equal(detectMeetingMobile('https://www.example.de/a/ris_web.nsf/x.xsp','<html>nichts</html>'),null);
 assert.equal(mmUrl('meeting_period_doc.xsp',source),base+'meeting_period_doc.xsp');
});

test('Meeting Mobile list: meetings with day, time, body and the address of their page, newest first',()=>{
 const rows=mmMeetings(fixture('unterreichenbach-liste.html'),base);
 assert.deepEqual(rows.map(r=>[r.date,r.time,r.body]),[['2026-09-22','19:00','Gemeinderat Unterreichenbach'],['2026-07-28','17:00','Personalausschuss'],['2026-07-14','19:00','Gemeinderat Unterreichenbach'],['2026-06-16','19:00','Gemeinderat Unterreichenbach'],['2026-05-20','19:00','Ausschuss Interkommunales Gewerbegebiet']]);
 assert.equal(rows[0].id,GR);assert.equal(rows[0].url,base+`meeting_doc.xsp?documentId=${GR}&action=openDocument`);
 assert.equal(rows.blind,0);
 // A list whose rows link with JavaScript only (Reutlingen) has no addresses.
 const blind=mmMeetings(fixture('reutlingen-liste.html'),rbase);
 assert.equal(blind.length,0);assert.equal(blind.blind,4);
 assert.equal(mmMeetings('<html>Fehler</html>',base).length,0);
});

test('Meeting Mobile month view: the addresses of the meetings of the current month',()=>{
 const rows=mmMeetings(fixture('reutlingen-monat.html'),rbase);
 assert.deepEqual(rows.map(r=>r.id),['EEA2EADEE1A34C36C1258D3B003A160C','FE4E6DF6439280AEC1258D3B003A161D']);
 assert.ok(rows.every(r=>r.date===null&&r.url.startsWith(rbase+'meeting_doc.xsp?documentId=')));
});

test('Meeting Mobile meeting page: body, day, place and the items of the public block with papers',()=>{
 const m=parseMmMeeting(fixture('unterreichenbach-sitzung.html'),base);
 assert.equal(m.committee,'Gemeinderat Unterreichenbach');assert.equal(m.date,'2026-09-22');assert.equal(m.time,'19:00');assert.match(m.place,/Sitzungssaal Rathaus in Unterreichenbach, Im Oberdorf 15, 75399 Unterreichenbach/);
 assert.equal(m.kind,'öffentlich und nichtöffentlich');assert.equal(m.publicBlock,true);
 assert.equal(m.items.length,10);
 const e=m.items[6];
 assert.equal(e.number,'7');assert.equal(e.title,'Mögliche Standorte für E-Ladesäulen');assert.deepEqual(e.documents,[{title:'Mögliche Standorte für E-Ladesäulen',url:base+'xsp/download?documentId=70D724378A3075D0C1258E720038BAF7&file=M%C3%B6gliche%20Standorte%20f%C3%BCr%20E-Lades%C3%A4ulen.pdf'}]);
 // Items 9 and 10 (Bekanntgaben, Bürgerfragestunde) carry no paper.
 assert.deepEqual(m.items.slice(8).map(i=>i.documents.length),[0,0]);
 // Lichtenstein numbers its papers; a link that is only an icon of the page (href="#") is no document.
 const l=parseMmMeeting(fixture('lichtenstein-sitzung.html'),'https://meeting-mobile.de/mm/lichtenstein/ris_web.nsf/');
 assert.equal(l.committee,'Technischer Ausschuss');assert.equal(l.date,'2026-10-08');
 assert.deepEqual(l.items.map(i=>[i.number,i.paper]),[['1','122/26'],['2','151.1/26'],['3','']]);
 assert.equal(l.items[1].documents.length,1);
 assert.equal(parseMmMeeting('<html>Fehler</html>').items.length,0);
});

test('Meeting Mobile: a block "nichtöffentlich" is never read',()=>{
 const html=fixture('unterreichenbach-sitzung.html');
 const hidden=html.replace(/(role="meetingAgendaHeader"[\s\S]*?<span[^>]*>)&ouml;ffentlich/,'$1nicht&ouml;ffentlich');
 assert.notEqual(hidden,html);
 const m=parseMmMeeting(hidden,base);
 assert.equal(m.items.length,0);assert.equal(m.publicBlock,false);
 assert.equal(mmItems(m,{date:'2026-09-22',url:'x'},source,now).length,0);
});

test('Meeting Mobile reports: routine items are left out, a past item is "unknown", a coming one "consulting"',()=>{
 const m=parseMmMeeting(fixture('unterreichenbach-sitzung.html'),base),meeting={date:'2026-09-22',body:m.committee,url:base+`meeting_doc.xsp?documentId=${GR}&action=openDocument`};
 const rows=mmItems(m,meeting,source,now);
 assert.equal(rows.length,8);assert.ok(rows.every(r=>r.id.startsWith('bw-08235073-mm-')&&r.status==='unknown'&&r.documents.length>0));
 assert.equal(rows[2].id,'bw-08235073-mm-jahresabschluss-2024');
 assert.ok(!rows.some(r=>/Bürgerfrage|Bekanntgaben/.test(r.title)));
 assert.ok(mmItems(m,meeting,source,new Date('2026-09-01T00:00:00Z')).every(r=>r.status==='consulting'));
 const l=parseMmMeeting(fixture('lichtenstein-sitzung.html'),'https://meeting-mobile.de/mm/lichtenstein/ris_web.nsf/');
 const lr=mmItems(l,{date:'2026-10-08',url:'u'},{...source,id:'de-08415092'},now);
 assert.deepEqual(lr.map(r=>[r.id,r.reference]),[['de-08415092-mm-122-26','122/26'],['de-08415092-mm-151-1-26','151.1/26']]);
});

const serve=(files)=>{const asked=[];return {asked,get:async url=>{asked.push(url);for(const [k,v] of Object.entries(files))if(url===k||url.startsWith(k))return typeof v==='function'?v(url):v;throw Error('Quelle antwortet mit HTTP 404');}};};

test('Meeting Mobile import reads the list and the pages of the meetings in the period, and keeps marks',async()=>{
 const s=serve({[base+'meeting_period_doc.xsp']:fixture('unterreichenbach-liste.html'),[base+'meeting_doc.xsp']:fixture('unterreichenbach-sitzung.html')});
 const result=await collectMeetingMobile(source,{now,get:s.get,window:'3m'});
 assert.equal(result.coverage.complete,true,JSON.stringify(result.coverage.issues));
 // Three meetings from July on; 20.05. and 16.06. lie outside of three months.
 assert.equal(result.coverage.meetings,3);assert.equal(result.readMeetings,3);
 assert.ok(s.asked.every(u=>u.startsWith(base)&&/(meeting_period_doc\.xsp|meeting_doc\.xsp\?documentId=[0-9A-F]{32}&action=openDocument)$/.test(u)));
 const t=result.topics.find(x=>x.id==='bw-08235073-mm-jahresabschluss-2024');
 assert.equal(t.regionId,source.id);assert.equal(t.committee,'Gemeinderat Unterreichenbach');assert.ok(t.documents.some(d=>d.kind==='pdf'));
 assert.ok(Object.keys(result.marks).length===3);
 // A second import with its marks reads the pages again only where the mark is not trusted; here the same pages give the same print.
 const again=await collectMeetingMobile(source,{now,get:serve({[base+'meeting_period_doc.xsp']:fixture('unterreichenbach-liste.html'),[base+'meeting_doc.xsp']:fixture('unterreichenbach-sitzung.html')}).get,window:'3m',marks:{known:result.marks}});
 assert.equal(again.coverage.complete,true);
});

test('Meeting Mobile import: a list without addresses falls back to the month view; the result is marked partial',async()=>{
 const s=serve({[rbase+'meeting_period_doc.xsp']:fixture('reutlingen-liste.html'),[rbase+'documents_month.xsp']:fixture('reutlingen-monat.html'),[rbase+'meeting_doc.xsp']:fixture('reutlingen-sitzung.html')});
 const result=await collectMeetingMobile(rsource,{now,get:s.get,window:'3m'});
 assert.equal(result.coverage.meetings,2);assert.equal(result.coverage.partial,'laufender Monat');assert.equal(result.coverage.complete,false);
 assert.match(result.coverage.warnings.join(' '),/laufenden Monats/);
 assert.ok(result.topics.length>0&&result.topics.every(t=>t.regionId==='de-08415061'));
 assert.ok(s.asked.every(u=>u.startsWith(rbase)));
});

test('Meeting Mobile import: a failing list is an issue; other addresses are refused',async()=>{
 const bad=await collectMeetingMobile(source,{now,get:async()=>{throw Error('Quelle antwortet mit HTTP 403');},window:'3m'});
 assert.equal(bad.coverage.complete,false);assert.match(bad.coverage.issues.join(' '),/Sitzungsliste/);
 const empty=await collectMeetingMobile(source,{now,get:async()=>'<html>leer</html>',window:'3m'});
 assert.equal(empty.coverage.complete,false);
 const refused=await collectMeetingMobile(source,{now,get:async u=>{throw Error('unerwartet '+u);},request:async()=>{throw Error('Netz');},window:'3m'});
 assert.equal(refused.topics.length,0);
});

test('Meeting Mobile import: organizations keep one body of a shared system; others are left out with a warning',async()=>{
 const s=serve({[base+'meeting_period_doc.xsp']:fixture('unterreichenbach-liste.html'),[base+'meeting_doc.xsp']:fixture('unterreichenbach-sitzung.html')});
 const result=await collectMeetingMobile({...source,organizations:{include:['Personalausschuss']}},{now,get:s.get,window:'3m'});
 assert.equal(result.coverage.meetings,1);
 assert.match((result.coverage.warnings||[]).join(' '),/anderer Gremien/);
});
