import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {detectTiGenerator,menuPages,standOf,parseTiList,parseTiDecisions,collectTiGenerator} from '../server/integrations/ti-generator.mjs';
// Excerpts of live pages (Stadt Nauen, Gemeinde Kolkwitz; September 2026), contact panels removed. The start page carries
// one added menu entry of an archive list in the markup of Gemeinde Fehrbellin.
const fixture=name=>readFileSync(new URL(`./fixtures/ti-generator/${name}.html`,import.meta.url),'utf8');
const start=fixture('start'),svv=fixture('invitations-svv'),kolkwitz=fixture('invitations-kolkwitz'),decisions=fixture('decisions-svv');
const base='https://ris.example.test/ti-stadt/',source={id:'de-12063208',name:'Stadt Nauen',kind:'city',method:'scraper',adapter:'ti-generator',base};
const now=new Date('2026-10-01T12:00:00Z');
const list=file=>base+'listen/'+file,emptyList=decisions.split('<div data-role="collapsible"')[0]+'</div></div></div>';
const svvPage={url:list('ti_229__30_el_.php'),committee:'Stadtverordnetenversammlung'};
const web=(changes={})=>{
 const pages={[base]:start,[list('ti_229__30_el_.php')]:svv,[list('ti_231__30_bv_.php')]:decisions,[list('ti_234__301_el_.php')]:kolkwitz,[list('ti_235__301_bv_.php')]:emptyList,[list('ti_238__302_el_.php')]:emptyList,[list('ti_201__30_el_.php')]:svv,...changes};
 const calls=[];return {pages,calls,get:async url=>{calls.push(url);if(pages[url] instanceof Error)throw pages[url];if(!(url in pages))throw Error('Quelle antwortet mit HTTP 404');return pages[url];}};
};
test('TI-Generator start page is recognised by its generator and names the folder of the site',()=>{
 assert.deepEqual(detectTiGenerator(base+'index.php',start),{adapter:'ti-generator',method:'scraper',base,invitationLists:4,stand:'2026-09-25'});
 // An address read with http:// or inside listen/ leads to the same site on https://.
 assert.equal(detectTiGenerator('http://ris.example.test/ti-stadt/listen/ti_229__30_el_.php',start).base,base);
 assert.equal(detectTiGenerator(base,'<html><meta name="generator" content="Town Hall Information WEB-Generator  (c) Bartel Software Engineering GbR"></html>').invitationLists,0);
 assert.equal(detectTiGenerator(base,'<html><title>SessionNet</title><a href="si0040.asp">Kalender</a></html>'),null);
 assert.equal(detectTiGenerator(base,svv),null,'a list page carries no generator');
 assert.equal(standOf('<p>Stand:&nbsp; 03.12.21  10:33 Uhr</p><p>Stand:&nbsp; 03.12.2021 - 10:33 Uhr</p>'),'2021-12-03');
 // The folder named without its final slash is the folder, not the host.
 assert.equal(detectTiGenerator('https://ris.example.test/ti-stadt',start).base,base);
 assert.equal(detectTiGenerator('https://ris.example.test/ti-stadt/listen',start).base,base);
 // A town's page that merely names or links the system is not a TI site; the credit counts beside a menu of TI lists.
 const cms='<html><head><meta name="generator" content="TYPO3 CMS"><title>Stadt Nauen</title></head><body><p>Ratsinformation: <a href="https://ris.example.test/ti-stadt/">Town Hall Information WEB-Generator</a> (TI-Generator, Bartel Software Engineering)</p></body></html>';
 assert.equal(detectTiGenerator('https://www.example.test/rathaus/',cms),null);
 const credit=start.replace(/<meta name="generator"[^>]*>/,'').replace('</body>','<p>TI-Generator &copy; Bartel Software Engineering GbR</p></body>');
 assert.deepEqual(detectTiGenerator(base,credit),{adapter:'ti-generator',method:'scraper',base,invitationLists:4,stand:'2026-09-25'});
 assert.equal(detectTiGenerator(base,credit.replace(/class="menu-link"/g,'class="nav-link"')),null);
});
test('TI-Generator menu yields the invitation and decision lists under listen/, with committee and period',()=>{
 const pages=menuPages(start,source);
 assert.deepEqual(pages.map(p=>[p.url,p.kind,p.committee,p.until]),[
  [list('ti_229__30_el_.php'),'invitations','Stadtverordnetenversammlung',null],[list('ti_231__30_bv_.php'),'decisions','Stadtverordnetenversammlung',null],
  [list('ti_234__301_el_.php'),'invitations','Hauptausschuss',null],[list('ti_235__301_bv_.php'),'decisions','Hauptausschuss',null],
  [list('ti_238__302_el_.php'),'invitations','Bau, Wirtschaftsf., Landwirtschaft, Umweltschutz und Energie',null],
  [list('ti_201__30_el_.php'),'invitations','Stadtverordnetenversammlung',2024]]);
 // Papers share the ending _bv_ with decisions (Uckerland); Trebbin's "Beschlüsse" are extracts of minutes (_bp_).
 const other='<li><a class="menu-link" href="ti_118__10_bv_.php" data-name="Gemeindevertretung" data-group="Data_Group_2" data-link="Sitzungsvorlagen">Sitzungsvorlagen</a></li><li><a class="menu-link" href="ti_119__10_bv_.php" data-name="Gemeindevertretung" data-group="Data_Group_2" data-link="Beschl&uuml;sse">Beschl&uuml;sse</a></li><li><a class="menu-link" id="t_326" href="ti_326__13_bp_.php" data-name="Stadtverordnetenversammlung" data-group="Data_Group_6" data-link="Beschl&uuml;sse">Beschl&uuml;sse</a></li><li><a class="menu-link" href="ti_60__10_el_.php" data-name="Gemeindevertretung" data-group="Data_Group_2" data-link="Einladungen / Tagesordnung ab 2025">x</a></li><li><a class="menu-link" href="ti_19__10_el_.php" data-name="Gemeindevertretung" data-group="Data_Group_2" data-link="Archiv: Einladungen / Tagesordnung bis 2024">x</a></li>';
 assert.deepEqual(menuPages(other,source).map(p=>[p.url.slice(base.length),p.kind,p.committee,p.until]),[['listen/ti_119__10_bv_.php','decisions','Gemeindevertretung',null],['listen/ti_60__10_el_.php','invitations','Gemeindevertretung',null],['listen/ti_19__10_el_.php','invitations','Gemeindevertretung',2024]]);
 // The body is the number in the file name: the same on current, decision and archive lists, also where no name is given.
 assert.deepEqual(menuPages(start,source).map(p=>p.group),['30','30','301','301','302','30']);
 assert.deepEqual(menuPages(start.replace(/ data-name="[^"]*"/g,''),source).map(p=>[p.committee,p.group]).slice(0,2),[['','30'],['','30']]);
 // A link rewritten with a session id names the same list; the id is not kept.
 const session=menuPages(start.replace('href="ti_229__30_el_.php"','href="ti_229__30_el_.php;jsessionid=0A1B2C3D4E"').replace('href="ti_231__30_bv_.php"','href="./ti_231__30_bv_.php?PHPSESSID=abc123"'),source);
 assert.deepEqual(session.slice(0,2).map(p=>[p.url,p.kind]),[[list('ti_229__30_el_.php'),'invitations'],[list('ti_231__30_bv_.php'),'decisions']]);
});
test('TI-Generator invitation list yields each meeting with the items of its public agenda only',()=>{
 const read=parseTiList(svv,svvPage,source);
 assert.equal(read.stand,'2026-09-25');
 assert.deepEqual(read.meetings.map(m=>[m.url,m.date,m.committee,m.heading,m.restricted]),[
  [svvPage.url+'#sitzung-2026-10-07','2026-10-07','Stadtverordnetenversammlung','13. Sitzung der Stadtverordnetenversammlung 07.10.2026',true],
  [svvPage.url+'#sitzung-2026-09-16','2026-09-16','Stadtverordnetenversammlung','12. Sitzung der Stadtverordnetenversammlung 16.09.2026',true],
  [svvPage.url+'#sitzung-2026-05-20','2026-05-20','Stadtverordnetenversammlung','11. Sitzung der Stadtverordnetenversammlung 20.05.2026',true]]);
 assert.deepEqual(read.meetings[1].agenda.map(i=>[i.number,i.title,i.reference]),[['01','Eröffnung der Sitzung',''],['07','Behandlung der Anfragen von Mitgliedern der Stadtverordnetenversammlung und Ortsvorsteher',''],['08','Abberufung des Rechnungsprüfers Wilfried Breckenfelder','0247/26'],['09','Dienstaufwandsentschädigung Erste Beigeordnete','0221/26']]);
 assert.deepEqual(read.meetings[1].agenda[2].documents,[{title:'Vorlage 0247/26',url:base+'listen/Beleg_e202687C8E96D8D4EF9057FBF4CA46208B8F3AN120_g.pdf',kind:'application/pdf'}]);
 assert.deepEqual(read.meetings[2].agenda.map(i=>[i.number,i.reference]),[['10',''],['10.1','0195-1/26'],['10.3','0195/26_neu']]);
 // The panel "nichtöffentliche Tagesordnung" names items and papers that are never taken.
 assert.ok(!/Einstellung eines Mitarbeiters|Vergleichsabschluss|0248\/26|nichtöffentlichen Teil/.test(JSON.stringify(read.meetings)));
 // An announced meeting without agenda; an item without number; documents opened by script; a document elsewhere.
 const other=parseTiList(kolkwitz,{url:list('ti_234__301_el_.php'),committee:'Hauptausschuss'},source);
 assert.deepEqual(other.meetings.map(m=>[m.date,m.agenda&&m.agenda.length,m.restricted]),[['2026-11-24',null,false],['2026-09-22',3,false]]);
 assert.deepEqual(other.meetings[1].agenda[0],{number:'',title:'Vergabe zu 54 Baumfällungen im Rahmen der Verkehrssicherung',reference:'0084/26',documents:[{title:'Vorlage 0084/26',url:base+'listen/Beleg_e20261680FA0E5A53CA35B680529A98BD13E8AN85_g.pdf',kind:'application/pdf'}]});
 const scripted=parseTiList(kolkwitz.replace(/href="(listen\/Beleg_[^"]+AN85_g\.pdf)"/,`onclick="window.open('$1#toolbar=1','_blank','');"`).replace(/href="listen\/Beleg_[^"]+AN73_g\.pdf"/,'href="https://elsewhere.example/listen/x.pdf"'),{url:list('x'),committee:'Hauptausschuss'},source);
 assert.deepEqual(scripted.meetings[1].agenda.map(i=>i.documents.map(d=>d.url)),[[base+'listen/Beleg_e20261680FA0E5A53CA35B680529A98BD13E8AN85_g.pdf'],[],[]]);
 // Two meetings of one committee on the same day keep apart.
 const twice=svv.replace(/(<div data-role="collapsible"[^>]*>[\s\S]*?)(?=<div data-role="collapsible")/,'$1$1');
 assert.deepEqual(parseTiList(twice,svvPage,source).meetings.slice(0,2).map(m=>m.url.split('#')[1]),['sitzung-2026-10-07','sitzung-2026-10-07-2']);
 // A document link rewritten with a session id is the same document, kept without the id; the attributes of a meeting
 // may come in another order.
 const session=parseTiList(svv.replace('AN120_g.pdf#pagemode=bookmarks','AN120_g.pdf;jsessionid=0A1B2C3D4E#pagemode=bookmarks').replace(/<div data-role="collapsible" data-theme="c"/g,'<div data-theme="c" data-role="collapsible"'),svvPage,source);
 assert.equal(session.meetings.length,3);assert.deepEqual(session.meetings[1].agenda[2].documents,read.meetings[1].agenda[2].documents);
});
test('TI-Generator invitation list never takes an item of the non-public part, whatever its panel is called',()=>{
 const secret=/Einstellung eines Mitarbeiters|Vergleichsabschluss|0248\/26|0249\/26|Einwendungen/;
 const publicItems=parseTiList(svv,svvPage,source).meetings[1].agenda;
 // The non-public panel of 16 September changed in one respect or several.
 const panel=(...changes)=>svv.replace(/^.*href="#tgo_collapse_6".*$/m,line=>changes.reduce((l,[from,to])=>l.replace(from,to),line));
 const outer=['<div class="panel panel-default"><div class="panel-heading list-group">','<div class="panel panel-danger"><div class="panel-heading list-group">'];
 const unknown=['<div class="panel panel-default"><div class="panel-heading list-group">','<div class="card"><div class="card-header">'];
 const label=to=>[/nicht&ouml;ffentl(?:\.Tagesordng\.|iche Tagesordnung)/g,to],unlocked=[/fa-expeditedssl/g,'fa-info-circle'];
 const read=html=>parseTiList(html,svvPage,source).meetings[1];
 // Another class of the panel: it is still cut off, its items are not taken, the public ones are.
 for(const html of [panel(outer),panel(['<div class="panel panel-default"><div class="panel-heading list-group">','<div class="panel-danger panel" data-x="1"><div class="list-group panel-heading">'])]){
  const m=read(html);assert.equal(m.restricted,true);assert.equal(m.unclear,false);assert.deepEqual(m.agenda,publicItems);assert.ok(!secret.test(JSON.stringify(m)));
 }
 // Another label of the non-public part, or a label that says nothing but the lock.
 for(const html of [panel(label('Tagesordnung (&Ouml;ffentlichkeit ausgeschlossen)'),unlocked),panel(label('vertrauliche Tagesordnung'),unlocked),panel(label('Tagesordnung Teil B'))]){
  const m=read(html);assert.equal(m.restricted,true);assert.deepEqual(m.agenda,publicItems);assert.ok(!secret.test(JSON.stringify(m)));
 }
 // Not told apart: a panel no class cuts off runs on inside the public one, or an agenda labelled neither way. No item of
 // the meeting is taken.
 for(const html of [panel(unknown),panel(unknown,label('Tagesordnung Teil B'),unlocked),panel(label('Tagesordnung Teil B'),unlocked)]){
  const m=read(html);assert.equal(m.unclear,true);assert.equal(m.agenda,null);assert.ok(!secret.test(JSON.stringify(m)));
 }
 // The other meetings of the list are not concerned.
 assert.deepEqual(parseTiList(panel(unknown),svvPage,source).meetings.map(m=>m.agenda&&m.agenda.length),[3,null,3]);
});
test('TI-Generator decision list yields decisions of the public part with votes and document',()=>{
 const read=parseTiDecisions(decisions,source);
 assert.deepEqual(read,[
  {date:'2026-09-16',number:'09',reference:'0221/26',decision:'206/2026',votes:{yes:'25',no:'0',abstentions:'0'},document:{title:'Beschluss 206/2026',url:base+'listen/Beleg_b2026BE5CBEBAC0AE756CBD5EE6B1A5A091D1.pdf',kind:'application/pdf'}},
  {date:'2026-09-16',number:'08',reference:'0247/26',decision:'205/2026',votes:{yes:'25',no:'0',abstentions:'0'},document:{title:'Beschluss 205/2026',url:base+'listen/Beleg_b2026ECE88BDFB65E699B87028125FA9A393A.pdf',kind:'application/pdf'}}]);
 // Decision 194/2026 names no meeting and no part; a decision of the non-public part is never taken either.
 assert.ok(!JSON.stringify(read).includes('194/2026'));
 assert.deepEqual(parseTiDecisions(decisions.replace('&nbsp;(&nbsp;&ouml;ffentlicher&nbsp;Teil','&nbsp;(&nbsp;nicht&ouml;ffentlicher&nbsp;Teil'),source).map(d=>d.decision),['205/2026']);
});
test('TI-Generator collector reads start page and lists only, and joins items, papers and decisions',async()=>{
 const {calls,get}=web();
 const d=await collectTiGenerator(source,{now,get,window:'12m'});
 assert.equal(calls[0],base);assert.ok(calls.slice(1).every(u=>u.startsWith(base+'listen/')),'menu entries are read from listen/');
 assert.ok(!calls.includes(list('ti_201__30_el_.php')),'a list of a period that ended before the import period is not read');
 assert.equal(calls.filter(u=>u===list('ti_231__30_bv_.php')).length,1);assert.equal(calls.length,6);
 assert.deepEqual(d.coverage.issues,[]);assert.equal(d.coverage.complete,true);assert.equal(d.coverage.method,'scraper');assert.equal(d.coverage.meetings,4);assert.equal(d.coverage.upcomingWithoutAgenda,1);
 assert.equal(d.coverage.sourceStand,'2026-09-30');assert.equal(d.coverage.from,'2025-10-01');assert.equal(d.coverage.to,'2026-10-01');assert.equal(d.coverage.sourceUrl,base);assert.equal(d.readMeetings,4);
 assert.equal(d.topics.length,13);
 const paid=d.topics.find(t=>t.id==='de-12063208-vo-nr-0221-26');
 assert.deepEqual(paid.events.map(e=>[e.date,e.committee,e.status,e.result,e.decision.kind]),[['2026-09-16','Stadtverordnetenversammlung','unknown','Beschluss 206/2026 (25 Ja-Stimmen, 0 Nein-Stimmen, 0 Enthaltungen)','unknown']]);
 assert.match(paid.events[0].description,/Beschlussliste.*Beschlussdokument/);
 assert.deepEqual(paid.documents.map(x=>[x.title,x.kind]),[['Vorlage 0221/26','application/pdf'],['Beschluss 206/2026','application/pdf'],['Öffentliche Tagesordnung','html']]);
 assert.deepEqual(paid.sourceData.records.map(r=>r.kind),['agenda','decision']);assert.equal(paid.sourceData.method,'ti-generator');assert.equal(paid.sourceData.records[1].fields.yes,'25');
 assert.equal(paid.regionId,source.id);assert.equal(paid.public,true);assert.equal(paid.reference,'0221/26');assert.equal(paid.sourceUrl,svvPage.url+'#sitzung-2026-09-16');assert.match(paid.longSummary[0],/Stadt Nauen/);
 // A meeting still ahead: papers are being consulted, other items announced; nothing is decided.
 const ahead=d.topics.filter(t=>t.eventDate==='2026-10-07');
 assert.deepEqual(ahead.map(t=>[t.title,t.status]).sort(),[['1. Nachtragshaushalt der Stadt Nauen für das Haushaltsjahr 2026','consulting'],['Eröffnung der Sitzung','announced'],['Wahl der kommunalen Gleichstellungsbeauftragten','consulting']]);
 // Items without paper are told apart by meeting day, committee, number and title.
 const opening=d.topics.filter(t=>t.title==='Eröffnung der Sitzung');assert.equal(opening.length,2);assert.match(opening[0].id,/^de-12063208-top-2026\d{4}-[0-9a-f]{8}$/);
 assert.deepEqual(d.topics.find(t=>t.reference==='0084/26').events.map(e=>[e.committee,e.date]),[['Hauptausschuss','2026-09-22']]);
 assert.deepEqual(Object.keys(d.marks).sort(),[svvPage.url+'#sitzung-2026-05-20',svvPage.url+'#sitzung-2026-09-16',svvPage.url+'#sitzung-2026-10-07',list('ti_234__301_el_.php')+'#sitzung-2026-09-22'].sort());
 assert.ok(!/Einstellung eines Mitarbeiters|Vergleichsabschluss|0248\/26|Ansprechpartner/.test(JSON.stringify(d)));
 // A longer period reaches the archive list; a meeting on both lists keeps the address of the list named first.
 const long=web({[list('ti_201__30_el_.php')]:svv}),slow=async url=>{if(url===list('ti_229__30_el_.php'))await new Promise(done=>setTimeout(done,20));return long.get(url);};
 const both=await collectTiGenerator(source,{now,get:slow,window:'24m'});
 assert.ok(long.calls.includes(list('ti_201__30_el_.php')));assert.equal(both.coverage.meetings,4);assert.ok(both.topics.every(t=>t.events.every(e=>!e.url.includes('ti_201__30'))));
 // A short period: the list of decisions is read only for committees with a past meeting in it.
 const short=web();const recent=await collectTiGenerator(source,{now,get:short.get,window:'1w'});
 assert.ok(!short.calls.some(u=>/_bv_/.test(u)));assert.equal(recent.coverage.meetings,1);assert.deepEqual(recent.topics.map(t=>t.eventDate),['2026-10-07','2026-10-07','2026-10-07']);
 // Meetings announced beyond the end of the next month are left for a later import, as with SD.NET.
 const far=await collectTiGenerator(source,{now,window:'12m',get:web({[list('ti_229__30_el_.php')]:svv.replace(/07\.10\.2026/g,'07.01.2027')}).get});
 assert.equal(far.coverage.meetings,3);assert.ok(!far.topics.some(t=>t.eventDate>'2026-11-30'));assert.equal(far.topics.length,10);
});
test('TI-Generator collector joins lists by the number of the body, not by its name',async()=>{
 const paid=d=>d.topics.find(t=>t.id==='de-12063208-vo-nr-0221-26').events.map(e=>[e.url.slice(base.length),e.result]);
 // A menu that names no body: the decisions are still read and joined.
 const unnamed=web({[base]:start.replace(/ data-name="[^"]*"/g,'')});
 const d=await collectTiGenerator(source,{now,window:'12m',get:unnamed.get});
 assert.ok(unnamed.calls.includes(list('ti_231__30_bv_.php')));assert.deepEqual(d.coverage.issues,[]);
 assert.deepEqual(paid(d),[['listen/ti_229__30_el_.php#sitzung-2026-09-16','Beschluss 206/2026 (25 Ja-Stimmen, 0 Nein-Stimmen, 0 Enthaltungen)']]);
 assert.equal(d.topics.find(t=>t.reference==='0221/26').committee,'Stadtverordnetenversammlung');
 // Two bodies of one name (an Amt and a town): the decisions of the one are never given to the meetings of the other.
 const twin=start.replace(/data-name="Hauptausschuss"/g,'data-name="Stadtverordnetenversammlung"');
 const other=await collectTiGenerator(source,{now,window:'12m',get:web({[base]:twin,[list('ti_231__30_bv_.php')]:emptyList,[list('ti_235__301_bv_.php')]:decisions}).get});
 assert.deepEqual(paid(other),[['listen/ti_229__30_el_.php#sitzung-2026-09-16','']]);assert.ok(!JSON.stringify(other.topics).includes('206/2026'));
 // Meetings of the same day and heading of two bodies of one name are both kept.
 const both=await collectTiGenerator(source,{now,window:'12m',get:web({[base]:twin,[list('ti_234__301_el_.php')]:svv}).get});
 assert.equal(both.coverage.meetings,6);assert.deepEqual(paid(both).sort(),[['listen/ti_229__30_el_.php#sitzung-2026-09-16','Beschluss 206/2026 (25 Ja-Stimmen, 0 Nein-Stimmen, 0 Enthaltungen)'],['listen/ti_234__301_el_.php#sitzung-2026-09-16','']]);
});
test('TI-Generator collector reads a meeting again only when its items or decisions changed',async()=>{
 const {get,pages}=web();
 const first=await collectTiGenerator(source,{now,get,window:'12m'});const stock=new Set(Object.keys(first.marks));
 const soon=await collectTiGenerator(source,{now:new Date(now.getTime()+3600000),get,window:'12m',marks:{known:first.marks,stock}});
 assert.equal(soon.topics.length,0);assert.equal(soon.coverage.unchangedMeetings,4);assert.equal(soon.coverage.complete,true);
 // Fifteen days later the meeting of 7 October has taken place, and the decision list names another vote.
 pages[list('ti_231__30_bv_.php')]=decisions.replace(/(Ja-Stimmen:(?:&nbsp;)*\s*)25/,'$124');
 const later=await collectTiGenerator(source,{now:new Date(now.getTime()+15*86400000),get,window:'12m',marks:{known:first.marks,stock}});
 assert.equal(later.coverage.unchangedMeetings,2);assert.deepEqual([...new Set(later.topics.map(t=>t.eventDate))].sort(),['2026-09-16','2026-10-07']);
 assert.equal(later.topics.find(t=>t.id==='de-12063208-vo-nr-0221-26').events[0].result,'Beschluss 206/2026 (24 Ja-Stimmen, 0 Nein-Stimmen, 0 Enthaltungen)');
 assert.equal(later.topics.find(t=>t.id==='de-12063208-vo-nr-0218-26').status,'unknown');
});
test('TI-Generator collector returns what a no longer updated site holds and names its date',async()=>{
 const old=html=>html.replace(/(Stand:(?:&nbsp;|\s)*)\d{2}\.\d{2}\.(?:\d{4}|\d{2})/g,'$103.12.2021');
 const {get}=web({[base]:old(start),[list('ti_229__30_el_.php')]:old(emptyList),[list('ti_234__301_el_.php')]:old(emptyList),[list('ti_238__302_el_.php')]:old(emptyList)});
 const d=await collectTiGenerator(source,{now,get,window:'12m'});
 assert.equal(d.coverage.sourceStand,'2021-12-03');assert.equal(d.topics.length,0);assert.equal(d.coverage.quiet,false);assert.equal(d.coverage.complete,false);
 // A long break without meetings looks the same as an abandoned site: the issue says what is known, not that meetings are missing.
 assert.deepEqual(d.coverage.issues,['Quelle seit Stand 03.12.2021 nicht aktualisiert; ob es seither Sitzungen gab, ist dort nicht zu erkennen.','Noch keine Artikel erfolgreich erfasst.']);
 // Up to date and nothing in a short period: a quiet period.
 const quiet=await collectTiGenerator(source,{now,window:'1w',get:web({[list('ti_229__30_el_.php')]:emptyList,[list('ti_234__301_el_.php')]:emptyList}).get});
 assert.equal(quiet.coverage.quiet,true);assert.equal(quiet.coverage.sourceStand,'2026-09-25');
});
test('TI-Generator collector reports pages it cannot read and never mistakes them for a quiet period',async()=>{
 const asked=[];const foreign=await collectTiGenerator(source,{now,window:'12m',get:async url=>{asked.push(url);return '<html><title>Wartungsarbeiten</title></html>';}});
 assert.deepEqual(asked,[base]);assert.deepEqual(foreign.coverage.issues,['Startseite: Unbekanntes Format, kein TI-Generator','Noch keine Artikel erfolgreich erfasst.']);assert.equal(foreign.coverage.quiet,false);
 const none=await collectTiGenerator(source,{now,window:'12m',get:async()=>'<html><meta name="generator" content="Town Hall Information WEB-Generator  (c) Bartel Software Engineering GbR"><a class="menu-link" href="ti_3__10_bk_.php" data-name="Verbandsgemeinderat" data-link="Bekanntmachungen">x</a></html>'});
 assert.match(none.coverage.issues[0],/keine Einladungslisten/);assert.equal(none.coverage.quiet,false);
 // A missing list is named; the other lists are read.
 const gap=await collectTiGenerator(source,{now,window:'12m',get:web({[list('ti_234__301_el_.php')]:Error('Quelle antwortet mit HTTP 404')}).get});
 assert.deepEqual(gap.coverage.issues,['Hauptausschuss, Einladungen / Vorlagen: Quelle antwortet mit HTTP 404']);assert.equal(gap.coverage.complete,false);assert.equal(gap.topics.length,10);
 // Without the decision list the items are reported, but their meetings count as not read completely.
 const partial=await collectTiGenerator(source,{now,window:'12m',get:web({[list('ti_231__30_bv_.php')]:Error('Quelle antwortet mit HTTP 500')}).get});
 assert.deepEqual(partial.coverage.issues,['Stadtverordnetenversammlung, Beschlüsse: Quelle antwortet mit HTTP 500']);assert.equal(partial.topics.find(t=>t.id==='de-12063208-vo-nr-0221-26').events[0].result,'');
 assert.deepEqual(Object.keys(partial.marks),[list('ti_234__301_el_.php')+'#sitzung-2026-09-22']);
 // Out of time: the import can be continued.
 const cut=await collectTiGenerator(source,{now,window:'12m',get:web({[list('ti_229__30_el_.php')]:Error('Zeitbudget der Quelle erreicht')}).get});
 assert.equal(cut.coverage.resumable,true);assert.deepEqual(cut.coverage.issues,['Zeitbudget der Quelle erreicht; 1 Seite noch nicht gelesen.']);
 // A list or decision list in an unknown form is named, also when it mentions a file ("Akte"); without its decision list a
 // meeting is not marked as read.
 const odd=await collectTiGenerator(source,{now,window:'12m',get:web({[list('ti_234__301_el_.php')]:'<html><p>Akte nicht gefunden</p></html>',[list('ti_231__30_bv_.php')]:'<html><title>Wartungsarbeiten</title></html>'}).get});
 assert.deepEqual(odd.coverage.issues.sort(),['Hauptausschuss, Einladungen / Vorlagen: Unbekanntes Format der Liste','Stadtverordnetenversammlung, Beschlüsse: Unbekanntes Format der Liste']);
 assert.deepEqual(Object.keys(odd.marks),[]);assert.equal(odd.coverage.complete,false);
 // A meeting whose public panel runs on into the non-public one is not taken, and that is an issue, not a quiet meeting.
 const merged=svv.replace(/^.*href="#tgo_collapse_6".*$/m,line=>line.replace('<div class="panel panel-default"><div class="panel-heading list-group">','<div class="card"><div class="card-header">'));
 const mixed=await collectTiGenerator(source,{now,window:'12m',get:web({[list('ti_229__30_el_.php')]:merged}).get});
 assert.deepEqual(mixed.coverage.issues,['Tagesordnung nicht eindeutig als öffentlich erkennbar, nicht übernommen: '+svvPage.url+'#sitzung-2026-09-16']);
 assert.equal(mixed.coverage.complete,false);assert.equal(mixed.coverage.quiet,false);assert.equal(mixed.topics.length,9);assert.ok(!(svvPage.url+'#sitzung-2026-09-16' in mixed.marks));
 assert.ok(!/Einstellung eines Mitarbeiters|Vergleichsabschluss|0248\/26|0249\/26|Abberufung des Rechnungspr/.test(JSON.stringify(mixed)));
 // A past meeting that the list shows without any agenda is a remark, not a gap.
 const bare=await collectTiGenerator(source,{now,window:'12m',get:web({[list('ti_234__301_el_.php')]:kolkwitz.replace(/24\.11\.2026/g,'24.08.2026')}).get});
 assert.deepEqual(bare.coverage.warnings,['Sitzung ohne veröffentlichte Tagesordnung: '+list('ti_234__301_el_.php')+'#sitzung-2026-08-24']);assert.deepEqual(bare.coverage.issues,[]);
});
test('TI-Generator collector asks only the approved source, as the import does',async()=>{
 const {pages}=web(),original=globalThis.fetch,requests=[];
 try{
  globalThis.fetch=async(url,init)=>{requests.push({url:String(url),agent:init.headers['User-Agent']});const body=pages[String(url)];return body===undefined?new Response('',{status:404}):new Response(body,{status:200,headers:{'content-type':'text/html; charset=UTF-8'}});};
  const d=await collectTiGenerator(source,{now,window:'1m'});
  assert.equal(d.topics.length,10);assert.ok(requests.every(r=>r.url.startsWith(base)&&/VorOrt-PoliticalTopics/.test(r.agent)));
  // The catalog names the site on https://; an address without it is never asked.
  requests.length=0;const plain=await collectTiGenerator({...source,base:'http://ris.example.test/ti-stadt/'},{now,window:'1m'});
  assert.equal(requests.length,0);assert.match(plain.coverage.issues[0],/^Startseite: Nicht freigegebene Quelladresse/);
 }finally{globalThis.fetch=original;}
});
