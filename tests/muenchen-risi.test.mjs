import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchText} from '../server/integrations/sessionnet.mjs';
import {createRisiSession,withoutSessionId,parseRisiCalendar,parseRisiAgenda,parseRisiPaper,parseRisiDecision,risiStatus,detectMuenchenRisi,collectMuenchenRisi,SESSION_ID,RISI_BASE} from '../server/integrations/muenchen-risi.mjs';
// Excerpts of live pages of risi.muenchen.de (04.10.2026): calendar page (October) and the answer to a click on the
// previous month (September), the public agenda of the plenary of 30.09.2026 and of BA 06 of 14.09.2026, a paper page
// and a decision page.
const fixture=name=>readFileSync(new URL('./fixtures/muenchen/'+name,import.meta.url),'utf8');
const base=RISI_BASE,source={id:'de-09162000',name:'Stadt München',kind:'city',method:'scraper',adapter:'muenchen-risi',base};
const now=new Date('2026-10-04T12:00:00Z'),UA='VorOrt-PoliticalTopics/0.5 (public council information)';
const agendaUrl=id=>base+`sitzung/detail/${id}/tagesordnung/oeffentlich`,paperUrl=id=>base+'sitzungsvorlage/detail/'+id,decisionUrl=id=>base+`sitzung/top/${id}/entscheidung`,doc=id=>base+'dokument/v/'+id;
const october=fixture('kalender-str.html'),september=fixture('kalender-str-prev.xml'),plenary=fixture('to-vollversammlung.html'),district=fixture('to-ba.html'),paper=fixture('sitzungsvorlage.html'),decision=fixture('entscheidung.html');
const LABELS=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const label=month=>{const [y,m]=month.split('-').map(Number);return LABELS[m-1]+' '+y;},shift=(month,n)=>{const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+n,1)).toISOString().slice(0,7);};
// The answer to a click, for any month: the September answer with its labels and its list of meetings replaced.
const view=(month,items,kind='str',page=3)=>{let n=0;return september.replace(/(id="id8[1-5]" type="button">)[^<]+(<\/button>)/g,(m,a,b)=>a+label(shift(month,-2+n++))+b).replace(/(<span>|sectionheader-month">)September 2026/g,'$1'+label(month)).replace(/<ul class="list-unstyled list-group list-group-flush">[\s\S]*<\/ul>/,`<ul class="list-unstyled list-group list-group-flush">${items}</ul>`).replaceAll('./str?3-',`./${kind}?${page}-`);};
const entry=(id,day,name,{agenda=true}={})=>`<li class="list-group-item even"><div class="kalender-row"><h3 class="font-size-big"><a class="headline-link text-keepwhitespace" href="../detail/${id}"><span class="sr-only">${day}</span>${name}</a></h3>${agenda?`<div class="mr-3"><img class="svg-icon" src="../../images/Oeffentlich.svg" alt=""> <a href="../detail/${id}/tagesordnung/oeffentlich">Öffentliche TO</a></div>`:''}<div class="keyvalue-value">TO geplant</div></div></li>`;
const rows=html=>html.slice(html.indexOf('<div class="d-table w-100 tops">')).split('<div class="d-table-row ').slice(1).map(r=>'<div class="d-table-row '+r.replace(/<\/section>[\s\S]*$/,''));
// Another meeting's agenda: the plenary page with another heading and some of its rows.
const agendaOf=(heading,pick)=>plenary.replace(/Mittwoch, 30\. September 2026, 09:00 Uhr - Vollversammlung/g,heading).replace(/<div class="d-table w-100 tops">[\s\S]*<\/section>/,'<div class="d-table w-100 tops">\n'+rows(plenary).filter(r=>pick.some(p=>r.includes(p))).join('')+'</div>\n</section>');
const committee=agendaOf('Dienstag, 29. September 2026, 14:00 Uhr - Finanzausschuss',['Landshuter Allee']).replace('top/9983856/','top/9983854/').replaceAll('dokument/v/10029498','dokument/v/10004825');
/**
 * A Wicket server in miniature: the first request opens the session with a redirect that carries the session id, the
 * first page writes it into its links, a click shows another month of the same page only with the session cookie.
 */
function server({pages={},months={}}={}){
 const calls=[],state={};
 const answer=(body,status=200,headers={})=>new Response(body,{status,headers:{'content-type':'text/html;charset=UTF-8',...headers}});
 const request=async(url,init)=>{
  calls.push({url,headers:init.headers});const cookie=init.headers.Cookie||'',calendar=url.match(/sitzung\/kalender\/(str|ba)(?:\?(\d+)(?:-1\.0-kalender-(prev|next|period~choice-(\d)-link))?)?$/);
  if(url in pages)return answer(pages[url]);
  if(!calendar)return answer('',404);
  const [,kind,page,step,choice]=calendar,id=kind==='str'?'3':'8';
  if(!page)return cookie?answer('',302,{location:`./${kind}?${id}`}):answer('',302,{location:`./${kind};jsessionid=ABC?${id}`,'set-cookie':'JSESSIONID=ABC; Path=/risi; HttpOnly'});
  if(!cookie.includes('JSESSIONID=ABC'))return answer('<html>Seite abgelaufen</html>');
  if(!step){state[kind]='2026-10';const first=kind==='str'?october:months.baPage;return answer(first.replaceAll('./str?3-',`./${kind};jsessionid=ABC?${id}-`).replaceAll('href="../detail/9141374"','href="../detail/9141374;jsessionid=ABC"'));}
  if(init.headers['Wicket-Ajax']!=='true'||init.headers['Wicket-Ajax-BaseURL']!==`sitzung/kalender/${kind}?${id}`)return answer('<html>kein Ajax</html>');
  state[kind]=choice?shift(state[kind],-2+Number(choice)):shift(state[kind],step==='prev'?-1:1);
  const month=state[kind],body=months[kind+month]??(kind==='str'&&month==='2026-09'?september:view(month,'',kind,id));
  return answer(kind==='str'&&month==='2026-09'?body:body.replaceAll('./str?3-',`./${kind}?${id}-`),200,{'content-type':'text/xml;charset=UTF-8'});
 };
 return {calls,request,get:(url,src,timeout,send)=>fetchText(url,src,timeout,send)};
}
const city=()=>server({months:{'str2026-11':view('2026-11',entry(9999001,'3. November 2026','09:30 Uhr - Bauausschuss',{agenda:false}))},pages:{
 [agendaUrl(9141186)]:plenary,[agendaUrl(9141158)]:committee,[agendaUrl(9140252)]:agendaOf('Mittwoch, 9. September 2026, 09:00 Uhr - Verwaltungs- und Personalausschuss als Feriensenat',['Teil A Themen']),
 [agendaUrl(9141374)]:agendaOf('Dienstag, 6. Oktober 2026, 09:30 Uhr - Kinder- und Jugendhilfeausschuss',['Besetzung der Leitung']),[agendaUrl(9141451)]:agendaOf('Dienstag, 6. Oktober 2026, 14:00 Uhr - Stadtentwässerungsausschuss',['Dringlichkeitsantrag']),
 ...Object.fromEntries([9958299,9958332,9459416,9807721].map(id=>[paperUrl(id),paper])),...Object.fromEntries([10017091,9983856,9983854,10022417].map(id=>[decisionUrl(id),decision])),
}});
test('München RISI keeps the session by cookie and never asks an address with a session id',async()=>{
 const sent=[];const session=createRisiSession(async(url,init)=>{sent.push({url,headers:init.headers});return sent.length===1?new Response(null,{status:302,headers:[['location','./str;jsessionid=ABC?0'],['set-cookie','JSESSIONID=ABC; Path=/risi; HttpOnly'],['set-cookie','TS01bf1f22=x1; path=/risi']]}):new Response('<html>ok</html>');});
 assert.equal(await fetchText(base+'sitzung/kalender/str',source,5000,session.plain),'<html>ok</html>');
 assert.deepEqual(sent.map(s=>s.url),[base+'sitzung/kalender/str',base+'sitzung/kalender/str?0']);
 assert.equal(sent[0].headers.Cookie,undefined);assert.equal(sent[1].headers.Cookie,'JSESSIONID=ABC; TS01bf1f22=x1');assert.equal(sent[1].headers['User-Agent'],UA);
 await assert.rejects(session.plain(base+'sitzung/detail/1;jsessionid=ABC',{headers:{}}),e=>e.message===SESSION_ID);
 await assert.rejects(session.plain(base+'extranet/login',{headers:{}}),/Anmeldebereich/);assert.equal(sent.length,2);
 assert.equal(withoutSessionId('<a href="../detail/9;jsessionid=8BD364352AF941D8A30D34EB10ACC44A?0-1.0-x">'),'<a href="../detail/9?0-1.0-x">');
});
test('München RISI calendar names its meetings, which of them have a public agenda, and its month buttons',()=>{
 const oct=parseRisiCalendar(october.replaceAll('./str?3-','./str;jsessionid=8BD364352AF941D8A30D34EB10ACC44A?3-'),source);
 assert.equal(oct.month,'2026-10');assert.equal(oct.controls.prev,base+'sitzung/kalender/str?3-1.0-kalender-prev');assert.equal(oct.controls.next,base+'sitzung/kalender/str?3-1.0-kalender-next');
 assert.deepEqual([...oct.controls.months.keys()],['2026-08','2026-09','2026-10','2026-11','2026-12']);assert.equal(oct.controls.months.get('2026-11'),base+'sitzung/kalender/str?3-1.0-kalender-period~choice-3-link');
 assert.deepEqual(oct.meetings.map(m=>[m.id,m.date,m.committee,m.agenda,m.closed,m.joint]),[['9141374','2026-10-06','Kinder- und Jugendhilfeausschuss',true,true,false],['9141398','2026-10-06','Sozialausschuss',false,false,true],['9141451','2026-10-06','Stadtentwässerungsausschuss',true,false,false],['9141801','2026-10-14','Verwaltungs- und Personalausschuss',false,true,false]]);
 assert.equal(oct.meetings[0].url,agendaUrl(9141374));
 // The answer to a click: a cancelled meeting, and the plenary, which as the city council decides finally.
 const sep=parseRisiCalendar(september,source);assert.equal(sep.month,'2026-09');assert.deepEqual([...sep.controls.months.keys()],['2026-07','2026-08','2026-09','2026-10','2026-11']);
 assert.deepEqual(sep.meetings.map(m=>[m.date,m.committee,m.agenda,m.cancelled]),[['2026-09-09','Verwaltungs- und Personalausschuss als Feriensenat',true,false],['2026-09-29','Kreisverwaltungsausschuss',false,true],['2026-09-29','Finanzausschuss',true,false],['2026-09-30','Stadtrat (Vollversammlung)',true,false]]);
 assert.equal(oct.unreadable,0);assert.equal(sep.unreadable,0);
 // The district committees' calendar: its "Vollversammlung" is not the city council's plenary and decides nothing finally.
 const ba=parseRisiCalendar(september.replaceAll('./str?3-','./ba?8-'),source,'ba');assert.deepEqual(ba.meetings.map(m=>[m.committee,m.body]).at(-1),['Vollversammlung','ba']);assert.equal(risiStatus('nach Antrag, einstimmig',ba.meetings.at(-1).committee),'recommended');
 // An entry whose meeting link or day cannot be read is counted, not dropped unseen.
 const odd=parseRisiCalendar(october.replace('href="../detail/9141451"','href="../detail/9141451?0-1.ILinkListener-kalender"').replace('<span class="sr-only">14. Oktober 2026</span>',''),source);
 assert.deepEqual(odd.meetings.map(m=>m.id),['9141374','9141398']);assert.equal(odd.unreadable,2);
 assert.equal(parseRisiCalendar('<html><h1>Wartungsarbeiten</h1></html>',source),null);
 assert.equal(parseRisiCalendar(october.replace('"u":"./str?3-1.0-kalender-prev"','"u":"https://elsewhere.example/risi/sitzung/kalender/str?3-1.0-kalender-prev"'),source).controls.prev,null);
});
test('München RISI agenda keeps the items of the public agenda with their part, paper, matters and decision page',()=>{
 const meeting={id:'9141186',url:agendaUrl(9141186),date:'2026-09-30',committee:'Stadtrat (Vollversammlung)'},read=parseRisiAgenda(plenary,meeting,source,now);
 assert.equal(read.date,'2026-09-30');assert.equal(read.committee,'Stadtrat (Vollversammlung)');
 // Without the calendar's name the heading names the body; its additions are not part of the name.
 assert.equal(parseRisiAgenda(plenary.replace('<span>(TO freigegeben)</span>','<span>(TO freigegeben)</span> <span>(im Anschluss an vorhergehende Sitzung)</span>'),{...meeting,committee:undefined,body:'str'},source,now).committee,'Stadtrat (Vollversammlung)');
 // A "Vollversammlung" of a district committee's calendar, or of no known calendar, is not the city council.
 assert.equal(parseRisiAgenda(plenary,{...meeting,committee:undefined,body:'ba'},source,now).committee,'Vollversammlung');assert.equal(parseRisiAgenda(plenary,{...meeting,committee:undefined},source,now).committee,'Vollversammlung');
 // A page that names no day, for a meeting without one, is not read (no error).
 assert.equal(parseRisiAgenda(plenary.replace('Mittwoch, 30. September 2026, 09:00 Uhr','09:00 Uhr'),{id:meeting.id,url:meeting.url},source,now),null);
 assert.deepEqual(read.items.map(i=>[i.id,i.agenda.number,i.reference,i.status,i.event.result]),[
  ['de-09162000-vo-9958299','Teil A 1.','26-32 / V 01415','unknown',''],['de-09162000-vo-9958332','Teil A 2.','26-32 / V 01416','unknown',''],
  ['de-09162000-vo-9459416','Teil B 4.','20-26 / V 18707','postponed','abgesetzt'],['de-09162000-vo-9807721','Teil B 6.','26-32 / V 01121','unknown',''],['de-09162000-vg-10022363','Teil C 1.','','unknown','']]);
 const [first,pending,withdrawn,tunnel,urgent]=read.items;
 assert.match(tunnel.title,/^Landshuter Allee-Tunnel Sicherheitstechnische Nachrüstung/);assert.equal(tunnel.sourceUrl,paperUrl(9807721));assert.deepEqual(tunnel.identityLinks,[paperUrl(9807721),base+'antrag/detail/10003685']);
 assert.equal(tunnel.agenda.section,'Bestätigung eines Beschlusses des Bauausschusses vom 15.09.2026');assert.equal(tunnel.agenda.type,'Beschlussvorlage VB');assert.equal(tunnel.agenda.decisionUrl,decisionUrl(9983856));
 assert.deepEqual(tunnel.documents,[{title:'Beschluss (Stadtrat (Vollversammlung), 30.09.2026)',url:doc(10029498),kind:'application/pdf'}]);assert.equal(tunnel.event.url,meeting.url);
 assert.equal(first.agenda.part,'Teil A Themen ohne vorherige Sachentscheidung in einem vorberatenden Ausschuss');
 assert.equal(pending.agenda.decisionUrl,null);assert.match(pending.event.description,/Beschluss liegt noch nicht vor/);
 assert.equal(withdrawn.agenda.decisionUrl,null);assert.deepEqual(withdrawn.agenda.matters,['StR-Antrag 20-26 / A 06395','BV-Empfehlung 20-26 / E 02993','StR-Antrag 20-26 / A 06507']);
 assert.equal(urgent.sourceUrl,base+'antrag/detail/10022363');assert.equal(urgent.agenda.paperUrl,null);
 // A meeting still ahead: announced or under consultation, and no decision page is named.
 const ahead=parseRisiAgenda(plenary,meeting,source,new Date('2026-09-20T12:00:00Z'));
 assert.deepEqual(ahead.items.map(i=>i.status),['consulting','consulting','postponed','consulting','announced']);assert.ok(ahead.items.every(i=>!i.agenda.decisionUrl));
 // Only the public agenda counts; a page without the agenda table is not read as an empty agenda.
 assert.equal(parseRisiAgenda(plenary.replace('<span>Öffentliche Tagesordnung</span>','<span>Nichtöffentliche Tagesordnung</span>'),meeting,source,now),null);
 assert.equal(parseRisiAgenda(plenary.replace('d-table w-100 tops','d-table w-100'),meeting,source,now),null);
});
test('München RISI agenda of a district committee: numbered by section, matters as identity',()=>{
 const read=parseRisiAgenda(district,{id:'9709054',url:agendaUrl(9709054),date:'2026-09-14'},source,now);
 assert.equal(read.committee,'BA 06 - Vollgremium');
 assert.deepEqual(read.items.map(i=>[i.id,i.agenda.number,i.status,i.agenda.type]),[['de-09162000-vg-9961460','1.1.','unknown','Entscheidung'],['de-09162000-vo-9852141','5.1.3.','unknown','Beschlussvorlage BA'],['de-09162000-vg-9946474','5.1.5.','unknown',''],['de-09162000-vg-9982579','5.4.3.','postponed','Unterrichtung']]);
 // An item that links neither paper nor matter is told apart by meeting, part, section, number and title.
 const bare=parseRisiAgenda(district.replace(/<a href="[^"]*antrag\/detail\/9961460">[^<]*<\/a>/,''),{id:'9709054',url:agendaUrl(9709054),date:'2026-09-14'},source,now).items[0];
 assert.match(bare.id,/^de-09162000-top-9709054-[0-9a-f]{8}$/);assert.equal(bare.sourceUrl,agendaUrl(9709054));
});
test('München RISI paper and decision pages',()=>{
 const p=parseRisiPaper(paper,source);
 assert.deepEqual(p.fields.map(f=>f.field),['Status','Betreff','Freigabe','Wahlperiode','Zuständiges Referat','Art','Typ','BA-Unterrichtung','Stadtbezirk/e','Abgeschlossen am']);
 assert.equal(p.fields[0].value,'Endgültiger Beschluss');assert.equal(p.fields.find(f=>f.field==='Stadtbezirk/e').value,'09 - Neuhausen-Nymphenburg');assert.ok(!JSON.stringify(p).includes('Ehbauer'),'the person presenting the paper is not kept');
 // The paper's own documents; the decisions listed further down belong to the meetings.
 assert.deepEqual(p.documents,[{title:'V 01121 LAT Instandsetzung DB',url:doc(10016429),kind:'application/pdf'},{title:'V 01121 LAT Instandsetzung BE',url:doc(9997720),kind:'application/pdf'}]);
 assert.deepEqual(parseRisiPaper(paper.replace('<span>Öffentlicher Vorgang</span>','<span>Nichtöffentlicher Vorgang</span>'),source).documents,[]);
 assert.deepEqual(parseRisiPaper(paper.replaceAll('title="Öffentliches Dokument"','title="Nichtöffentliches Dokument"'),source).documents,[]);
 // Another kind than public: no documents either.
 assert.deepEqual(parseRisiPaper(paper.replace('<span>Öffentlicher Vorgang</span>','<span>Vertraulicher Vorgang</span>'),source).documents,[]);
 // Each document needs the mark in its own entry: a document whose icon has none, or a link outside an entry of its
 // own, does not borrow the mark of the document before it.
 const second=/(id="idbc"[\s\S]*?<img class="svg-icon mr-1" src="..\/..\/images\/Oeffentlich.svg") title="Öffentliches Dokument" alt="Öffentliches Dokument">/;
 assert.deepEqual(parseRisiPaper(paper.replace(second,'$1 alt="">'),source).documents.map(d=>d.url),[doc(10016429)]);
 assert.deepEqual(parseRisiPaper(paper.replace(second,'$1 title="Vertrauliches Dokument" alt="">'),source).documents.map(d=>d.url),[doc(10016429)]);
 const unwrapped=paper.replace(/<div class="form-check">(\s*<input[^>]*id="idbc")/,'<div class="d-block">$1');assert.notEqual(unwrapped,paper);
 assert.deepEqual(parseRisiPaper(unwrapped,source).documents.map(d=>d.url),[doc(10016429)]);
 // A short entry without preview and without a mark, close behind a public document.
 const compact=paper.replace(/(<li class="list-group-item odd">)[\s\S]*?(<\/li>)/,'$1<div class="form-check"><div class="align-top d-flex"><div><img class="svg-icon mr-1" src="../../images/Dokument.svg" alt=""></div><div><a class="downloadlink text-nohyphens" href="../../dokument/v/9997720">Anlage BE.pdf</a></div></div></div>$2');
 assert.notEqual(compact,paper);assert.deepEqual(parseRisiPaper(compact,source).documents.map(d=>d.url),[doc(10016429)]);
 assert.deepEqual(parseRisiDecision(decision),{decision:'nach Antrag',vote:'einstimmig',result:'nach Antrag, einstimmig'});assert.equal(parseRisiDecision(decision.replace('TOP 6. (Öffentlich)','TOP 6. (Nichtöffentlich)')),null);
 // Seen live: the decision field only points to the decision document, the vote then names the outcome.
 assert.deepEqual(parseRisiDecision(decision.replace('<span>nach Antrag</span>','<span>siehe Beschlussseite</span>').replace('<span>einstimmig</span>','<span>nach Antrag gegen die Stimme der AfD</span>')),{decision:'siehe Beschlussseite',vote:'nach Antrag gegen die Stimme der AfD',result:'nach Antrag gegen die Stimme der AfD'});
 assert.equal(risiStatus('nach Antrag, einstimmig','Stadtrat (Vollversammlung)'),'approved');assert.equal(risiStatus('nach Antrag, einstimmig','Bauausschuss'),'recommended');
 assert.equal(risiStatus('abgelehnt, mehrheitlich','Stadtrat (Vollversammlung)'),'rejected');assert.equal(risiStatus('Kenntnisnahme','Stadtrat (Vollversammlung)'),'info');assert.equal(risiStatus('vertagt','Finanzausschuss'),'postponed');assert.equal(risiStatus('einstimmig','Stadtrat (Vollversammlung)'),null);
 assert.equal(risiStatus('Ablehnung, mehrheitlich','Stadtrat (Vollversammlung)'),'rejected');assert.equal(risiStatus('Ablehnung','Bauausschuss'),'recommended');
 assert.equal(risiStatus('nach Antrag','Verwaltungs- und Personalausschuss als Feriensenat'),'recommended');assert.equal(risiStatus('nach Antrag','BA 06 - Vollgremium'),'recommended');
});
test('München RISI is recognised by its address or by a link into it',()=>{
 const found={adapter:'muenchen-risi',method:'scraper',base,dataUrl:base+'sitzung/kalender/str'};
 assert.deepEqual(detectMuenchenRisi('https://risi.muenchen.de/risi/aktuelles;jsessionid=F1C06C6758B74E4B5C1DC6908BDA2A11?0',''),found);
 assert.deepEqual(detectMuenchenRisi('https://risi.muenchen.de/risi/rss?feed=StR-Sitzungen',fixture('rss-str.xml')),found);
 assert.deepEqual(detectMuenchenRisi('https://stadt.muenchen.de/rathaus/stadtrat.html','<a href="https://risi.muenchen.de/risi/sitzung/uebersicht">Ratsinformationssystem</a>'),found);
 assert.equal(detectMuenchenRisi('https://risi.muenchen.de/',''),null);assert.equal(detectMuenchenRisi('https://www.example.de/','<a href="https://risi.muenchen.de.example.org/risi/">x</a>'),null);
 assert.equal(detectMuenchenRisi('https://ratsinfo.example.de/risi/sitzung/detail/1','<title>RatsInformationsSystem</title>'),null);assert.equal(detectMuenchenRisi('kein Link',''),null);
 // A link into the system counts only on the city's own domain: the district of Munich (Landkreis), a newspaper or a
 // look-alike host link to it as well, but are not the city.
 const link='<a href="https://risi.muenchen.de/risi/sitzung/uebersicht">Ratsinformationssystem der Stadt</a>';
 assert.deepEqual(detectMuenchenRisi('https://www.muenchen.de/rathaus/stadtrat.html',link),found);assert.deepEqual(detectMuenchenRisi('https://muenchen.de/',link),found);
 assert.equal(detectMuenchenRisi('https://www.landkreis-muenchen.de/kreistag/',link),null);assert.equal(detectMuenchenRisi('https://www.sueddeutsche.de/muenchen/stadtrat-antrag-1.123','<a href="https://risi.muenchen.de/risi/antrag/detail/10022363">Antrag</a>'),null);
 assert.equal(detectMuenchenRisi('https://muenchen.de.example.org/',link),null);assert.equal(detectMuenchenRisi('https://notmuenchen.de/',link),null);
});
test('München RISI collector reads the calendar months, the public agendas, each paper once and the decisions of past items',async()=>{
 const {calls,request,get}=city();
 const d=await collectMuenchenRisi(source,{now,get,request,window:'1m'});
 const asked=calls.map(c=>c.url);
 assert.deepEqual(asked.slice(0,4),[base+'sitzung/kalender/str',base+'sitzung/kalender/str?3',base+'sitzung/kalender/str?3-1.0-kalender-period~choice-3-link',base+'sitzung/kalender/str?3-1.0-kalender-period~choice-0-link'],'October, then November and September by their buttons');
 assert.ok(asked.every(u=>u.startsWith(base)&&!/jsessionid|nichtoeffentlich|extranet/.test(u)));assert.ok(calls.every(c=>c.headers['User-Agent']===UA));
 assert.ok(calls.slice(1).every(c=>c.headers.Cookie==='JSESSIONID=ABC'));assert.deepEqual(calls.slice(2,4).map(c=>[c.headers['Wicket-Ajax'],c.headers['Wicket-Ajax-BaseURL']]),[['true','sitzung/kalender/str?3'],['true','sitzung/kalender/str?3']]);
 assert.equal(asked.filter(u=>u===paperUrl(9807721)).length,1);assert.deepEqual(asked.filter(u=>u.includes('/entscheidung')).sort(),[decisionUrl(10017091),decisionUrl(10022417),decisionUrl(9983854),decisionUrl(9983856)].sort());
 assert.ok(!asked.some(u=>/9141398|9141801|9141129|9999001/.test(u)),'joint, non-public only, cancelled and unpublished meetings are not asked');
 assert.deepEqual(d.coverage.issues,[]);assert.equal(d.coverage.complete,true);assert.equal(d.coverage.meetings,5);assert.equal(d.coverage.upcomingWithoutAgenda,1);assert.equal(d.coverage.method,'scraper');assert.equal(d.coverage.from,'2026-09-04');assert.equal(d.readMeetings,5);assert.equal(d.coverage.warnings,undefined);
 assert.deepEqual(d.topics.map(t=>t.id).sort(),['de-09162000-vg-10022363','de-09162000-vo-9459416','de-09162000-vo-9807721','de-09162000-vo-9958299','de-09162000-vo-9958332']);
 const tunnel=d.topics.find(t=>t.id==='de-09162000-vo-9807721');
 assert.deepEqual(tunnel.events.map(e=>[e.date,e.committee,e.status,e.result,e.decision.kind]),[['2026-09-29','Finanzausschuss','recommended','nach Antrag, einstimmig','recommendation'],['2026-09-30','Stadtrat (Vollversammlung)','approved','nach Antrag, einstimmig','decision']]);
 assert.equal(tunnel.status,'approved');assert.equal(tunnel.committee,'Stadtrat (Vollversammlung)');assert.equal(tunnel.reference,'26-32 / V 01121');assert.equal(tunnel.regionId,source.id);assert.equal(tunnel.public,true);
 assert.deepEqual(tunnel.documents.map(x=>x.url).sort(),[doc(10004825),doc(10016429),doc(10029498),doc(9997720),paperUrl(9807721)]);
 assert.deepEqual(tunnel.sourceData.records.map(r=>r.kind),['agenda','paper','decision']);assert.equal(tunnel.sourceData.method,'muenchen-risi');assert.match(tunnel.longSummary[0],/Stadt München/);
 assert.equal(d.topics.find(t=>t.id==='de-09162000-vo-9459416').status,'postponed');assert.equal(d.topics.find(t=>t.id==='de-09162000-vo-9958332').status,'unknown');
 const urgent=d.topics.find(t=>t.id==='de-09162000-vg-10022363');assert.deepEqual(urgent.events.map(e=>[e.date,e.status]),[['2026-09-30','approved'],['2026-10-06','announced']]);
 assert.ok(!JSON.stringify(d).includes('Ehbauer'));
});
test('München RISI collector skips meetings whose public agenda is unchanged since their pages were read',async()=>{
 const first=await collectMuenchenRisi(source,{now,...city(),window:'1m'});assert.equal(Object.keys(first.marks).length,5);
 // Fifteen days later the September meetings lie more than two weeks back; the October ones have taken place since.
 const later=new Date(now.getTime()+15*86400000),stock=new Set(Object.keys(first.marks));
 const again=city();const second=await collectMuenchenRisi(source,{now:later,get:again.get,request:again.request,window:'3m',marks:{known:first.marks,stock}});
 assert.equal(second.coverage.unchangedMeetings,3);assert.ok(!again.calls.some(c=>c.url===paperUrl(9807721)||c.url===decisionUrl(9983856)));assert.equal(second.coverage.complete,true);
 // The public agenda says something new: the meeting is read again.
 const edited=city();const third=await collectMuenchenRisi(source,{now:later,get:edited.get,request:async(url,init)=>url===agendaUrl(9141186)?new Response(plenary.replace('Wahl der Leitung','Neuwahl der Leitung'),{headers:{'content-type':'text/html;charset=UTF-8'}}):edited.request(url,init),window:'3m',marks:{known:first.marks,stock}});
 assert.equal(third.coverage.unchangedMeetings,2);assert.ok(third.topics.some(t=>t.title.startsWith('Neuwahl der Leitung')));assert.ok(edited.calls.some(c=>c.url===paperUrl(9807721)));
});
test('München RISI collector reads the district committees only when asked, from their own calendar',async()=>{
 const baPage=october.replace(/<ul class="list-unstyled list-group list-group-flush">[\s\S]*<\/ul>/,`<ul class="list-unstyled list-group list-group-flush">${entry(9709127,'5. Oktober 2026','18:30 Uhr - BA 06 - Vollgremium',{agenda:false})}</ul>`).replace('StR-Sitzungskalender','BA-Sitzungskalender');
 const run=()=>{const s=city(),ba=server({months:{baPage,'ba2026-09':view('2026-09',entry(9709054,'14. September 2026','18:30 Uhr - BA 06 - Vollgremium'),'ba',8)},pages:{[agendaUrl(9709054)]:district,[paperUrl(9852141)]:paper}});
  return {s,ba,request:async(url,init)=>/kalender\/ba|9709054|9852141/.test(url)?ba.request(url,init):s.request(url,init)};};
 const plain=run();const d=await collectMuenchenRisi(source,{now,get:plain.s.get,request:plain.request,window:'1m'});assert.equal(plain.ba.calls.length,0);assert.equal(d.coverage.districts,undefined);
 const both=run();const all=await collectMuenchenRisi({...source,districts:true},{now,get:both.s.get,request:both.request,window:'1m'});
 assert.deepEqual(both.ba.calls.slice(0,2).map(c=>c.url),[base+'sitzung/kalender/ba',base+'sitzung/kalender/ba?8']);assert.equal(both.ba.calls[1].headers.Cookie,'JSESSIONID=ABC','one session for both calendars');
 assert.equal(all.coverage.districts,true);assert.equal(all.coverage.meetings,6);assert.equal(all.coverage.upcomingWithoutAgenda,2);assert.deepEqual(all.coverage.issues,[]);
 const districtTopics=all.topics.filter(t=>t.events.some(e=>/^BA \d{2} - /.test(e.committee)));assert.equal(districtTopics.length,4);
 assert.ok(districtTopics.every(t=>t.events.every(e=>/^BA 06 - Vollgremium$/.test(e.committee)&&!['approved','rejected'].includes(e.status))));
});
test('München RISI collector: a meeting named "Vollversammlung" in the district calendar decides nothing finally',async()=>{
 const baPage=october.replace(/<ul class="list-unstyled list-group list-group-flush">[\s\S]*<\/ul>/,'<ul class="list-unstyled list-group list-group-flush"></ul>');
 const s=city(),ba=server({months:{baPage,'ba2026-09':view('2026-09',entry(9709999,'15. September 2026','19:00 Uhr - Vollversammlung'),'ba',8)},pages:{[agendaUrl(9709999)]:agendaOf('Dienstag, 15. September 2026, 19:00 Uhr - Vollversammlung',['Landshuter Allee'])}});
 const d=await collectMuenchenRisi({...source,districts:true},{now,get:s.get,request:async(url,init)=>/kalender\/ba|9709999/.test(url)?ba.request(url,init):s.request(url,init),window:'1m'});
 assert.deepEqual(d.coverage.issues,[]);const tunnel=d.topics.find(t=>t.id==='de-09162000-vo-9807721');
 assert.deepEqual(tunnel.events.map(e=>[e.date,e.committee,e.status,e.decision.kind]),[['2026-09-15','Vollversammlung','recommended','recommendation'],['2026-09-29','Finanzausschuss','recommended','recommendation'],['2026-09-30','Stadtrat (Vollversammlung)','approved','decision']]);
});
test('München RISI collector stops at an access check, and leaves a refused meeting for the next step',async()=>{
 const gate='<html><head><script src="/TSPD/08a1b2c3d4?type=7"></script><script>window["bobcmn"]="1";</script></head><body><noscript>Please enable JavaScript to view the page content.</noscript></body></html>';
 const blocked=server({pages:{[base+'sitzung/kalender/str']:gate}});const d=await collectMuenchenRisi(source,{now,get:blocked.get,request:blocked.request,window:'12m'});
 assert.equal(blocked.calls.length,1);assert.equal(d.topics.length,0);assert.equal(d.coverage.quiet,false);assert.equal(d.coverage.complete,false);assert.equal(d.coverage.resumable,undefined);assert.match(d.coverage.issues[0],/Zugriffsprüfung gegen automatisierte Abrufe; sie wird nicht umgangen/);
 // The firewall's rejection page for one agenda: the other meetings are read, the refused one is left for later.
 const rejected='<html><head><title>Request Rejected</title></head><body>The requested URL was rejected. Please consult with your administrator.<br><br>Your support ID is: 7571357861314030815</body></html>';
 const s=city();const r=await collectMuenchenRisi(source,{now,get:s.get,request:async(url,init)=>url===agendaUrl(9141186)?new Response(rejected,{headers:{'content-type':'text/html'}}):s.request(url,init),window:'1m',maxDurationMs:11000});
 assert.equal(r.coverage.resumable,true);assert.ok(r.coverage.issues.some(i=>/Server wies 1 Sitzung vorübergehend ab/.test(i)));assert.ok(!(agendaUrl(9141186) in r.marks));assert.equal(r.readMeetings,4);
 // The same for a page behind an item (here a decision page): a refusal, not the end of the time budget.
 const t=city();const q=await collectMuenchenRisi(source,{now,get:t.get,request:async(url,init)=>url===decisionUrl(9983856)?new Response(rejected,{headers:{'content-type':'text/html'}}):t.request(url,init),window:'1m',maxDurationMs:11000});
 assert.equal(q.coverage.resumable,true);assert.ok(q.coverage.issues.some(i=>/Server wies 1 Sitzung vorübergehend ab/.test(i)));assert.ok(!q.coverage.issues.some(i=>/Zeitbudget/.test(i)),q.coverage.issues.join('; '));
 assert.ok(!(agendaUrl(9141186) in q.marks));assert.equal(q.readMeetings,4);assert.equal(q.topics.find(t=>t.id==='de-09162000-vo-9807721').sourceData.detailStatus,'partial');
 // A calendar the reader does not know is a gap, not a quiet period; nothing else is asked.
 const odd=server({pages:{[base+'sitzung/kalender/str']:'<html>Wartungsarbeiten</html>'}});const o=await collectMuenchenRisi(source,{now,get:odd.get,request:odd.request,window:'12m'});
 assert.equal(odd.calls.length,1);assert.deepEqual(o.coverage.issues,['Sitzungskalender des Stadtrats: Unbekanntes Kalenderformat','Noch keine Artikel erfolgreich erfasst.']);assert.equal(o.coverage.quiet,false);
 // Calendar entries whose meeting cannot be read are named, not left out unseen; the rest is read.
 const u=city();const w=await collectMuenchenRisi(source,{now,get:u.get,request:async(url,init)=>{const a=await u.request(url,init);if(url!==base+'sitzung/kalender/str?3')return a;return new Response((await a.text()).replace(/href="\.\.\/detail\/9141801"/,'href="../detail/9141801?0-1.ILinkListener-kalender"'),{status:a.status,headers:a.headers});},window:'1m'});
 assert.deepEqual(w.coverage.issues,['Sitzungskalender des Stadtrats: 1 Eintrag ohne lesbare Sitzungsadresse, Tag oder Gremium']);assert.equal(w.coverage.complete,false);assert.equal(w.readMeetings,5);
});
