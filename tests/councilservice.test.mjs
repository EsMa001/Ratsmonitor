import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {detectCouncilservice,exportTokens,councilservicePage,councilserviceHeaders,councilserviceLink,councilserviceCommittee,councilserviceMeetings,councilserviceReference,councilserviceDocument,parseCouncilserviceMeeting,collectCouncilservice} from '../server/integrations/councilservice.mjs';
import {READERS} from '../server/integrations/readers.mjs';
import {windowStart} from '../server/integrations/history-window.mjs';
// Excerpts of the live export of Stadt Sonnewalde (stadt-sonnewalde.mein-intra.net, 05.10.2026), shortened and without
// the names of the staff who edited them. Sonnewalde writes "Ö:"/"NÖ:" before every item and sets all items visible.
const fixture=name=>readFileSync(new URL('./fixtures/councilservice/'+name,import.meta.url),'utf8');
const json=name=>JSON.parse(fixture(name));
const token='f163309a-069112b6-c1e2efe3-35282a5d',base='https://stadt-sonnewalde.mein-intra.net/',page='https://www.stadt-sonnewalde.de/seite/438959/ris.html';
const source={id:'de-12062469',name:'Stadt Sonnewalde',kind:'city',method:'scraper',adapter:'councilservice',base,token,page};
const now=new Date('2026-10-05T12:00:00Z');
// Built after the agendas of Arnstein, Ellrich, Tauche and Werra-Suhl-Tal (October 2026): the system hides a
// non-public item (visibility 0, "Nicht-öffentlicher Tagesordnungspunkt"), a heading closes the public part.
let next=0;
const topic=(label,visibility=1,more={})=>{const id=1000+(++next);return {id,position:next,numeration:String(next),label,visibility,description:'','documents-topic':[],children:[],...more};};
const entry=(id,topics,more={})=>({status:'OK',data:{entry:{id,title:'Stadtrat',recurrence_start:'2026-09-15',edited:'2026-09-16 10:00:00',visibility:1,display_contents:1,topics,documents:[],groups:[1],...more}}});
const titles=(topics,more)=>parseCouncilserviceMeeting(entry(7,topics,more),{id:'7'},source).items.map(i=>i.title);
test('the website page that embeds the council service is recognised with system, token and page',async()=>{
 const html=fixture('sonnewalde-page.html');
 const expected={adapter:'councilservice',base,token,page};
 assert.deepEqual(detectCouncilservice(page+'?href=/councilservice/session/list',html),expected);
 // The page links its own menu entries with ?href_<token>=…; the script also writes the address in URL-safe base64.
 assert.deepEqual(detectCouncilservice(page+'?href_'+token+'=/councilservice/group/caucus',html),expected);
 assert.deepEqual(detectCouncilservice(page+'?href='+Buffer.from('/councilservice/session/list').toString('base64url'),html),expected);
 assert.deepEqual(detectCouncilservice(page+'?href=%2Fcouncilservice%2Fsession%2Flist#/councilservice/session/list',html),expected);
 // The page keeps its own query, loses a session suffix; links to a meeting are added to that query.
 assert.equal(detectCouncilservice('https://www.gemeinde-x.de/index.php?id=438&href=/councilservice/session/list',html).page,'https://www.gemeinde-x.de/index.php?id=438');
 assert.equal(councilservicePage('https://www.gemeinde-x.de/ris.html;jsessionid=AB12?href=/councilservice/session/list#top'),'https://www.gemeinde-x.de/ris.html');
 assert.equal(councilserviceLink({page:'https://www.gemeinde-x.de/index.php?id=438'},5),'https://www.gemeinde-x.de/index.php?id=438&href=/councilservice/entry/view/5');
 assert.equal(councilserviceLink(source,121559),page+'?href=/councilservice/entry/view/121559');
 // The same page without the council service in its address shows another module or nothing: no system.
 assert.equal(detectCouncilservice(page,html),null);
 assert.equal(detectCouncilservice(page+'?href=/appointment/index',html),null);
 // A page that links the council service without embedding it, an export in a comment, two exports, a strange token.
 assert.equal(detectCouncilservice(page+'?href=/councilservice/session/list','<a href="/seite/1/ris.html?href=/councilservice/session/list">Sitzungen</a>'),null);
 assert.equal(detectCouncilservice(page+'?href=/councilservice/session/list','<!--'+html+'-->'),null);
 assert.equal(detectCouncilservice(page+'?href=/councilservice/session/list',html+'<script src="https://andere.mein-intra.net/export/js/initialize.js"></script>'),null);
 assert.equal(detectCouncilservice(page+'?href=/councilservice/session/list',html.replace(/initializeExport\("[^"]+"\)/,'initializeExport("x\'+alert(1)+\'")')),null);
 assert.equal(detectCouncilservice(page+'?href=/councilservice/session/list',html.replace(/initializeExport\("[^"]+"\)/,'initializeExport("'+token+'");initializeExport("aaaaaaaa-bbbbbbbb-cccccccc-dddddddd")')),null);
 // The reader of readers.mjs gives the fields of the catalog entry.
 assert.deepEqual(await READERS.councilservice.detect(page+'?href=/councilservice/session/list',html),{base,token,page});
 assert.deepEqual(councilserviceHeaders(token),{'X-Requested-By':'spa-export','X-Export-Token':token,'X-Requested-With':'XMLHttpRequest',Accept:'application/json'});
});
test('the body of a meeting is the group its title names, not the first group invited',()=>{
 const groups=(...names)=>names.map((group_name,i)=>({group_id:i,group_name}));
 assert.equal(councilserviceCommittee({title:'Sitzung des Ausschusses für Bau, Stadtentwicklung und Wirtschaft',groups:groups('Stadtverordnetenversammlung (Sonnewalde)','Ausschuss für Bau, Stadtentwicklung und Wirtschaft (Sonnewalde)')}),'Ausschuss für Bau, Stadtentwicklung und Wirtschaft (Sonnewalde)');
 assert.equal(councilserviceCommittee({title:'Sitzung des Ortsbeirates Goßmar',groups:groups('OT-Verantwortlicher Goßmar (Sonnewalde OT Goßmar)','Ortsbeirat (Sonnewalde OT Goßmar)')}),'Ortsbeirat (Sonnewalde OT Goßmar)');
 // Staff to be informed are no body; the only body among the groups counts when the title names none.
 assert.equal(councilserviceCommittee({title:'Gemeinderatssitzung',groups:groups('Gemeinderat (Mulda/Sachsen)')}),'Gemeinderat (Mulda/Sachsen)');
 assert.equal(councilserviceCommittee({title:'Sitzung der Stadtverordnetenversammlung der Stadt Sonnewalde',groups:groups('Amtsleiter Stadtverwaltung (Sonnewalde)','Stadtverordnetenversammlung (Sonnewalde)')}),'Stadtverordnetenversammlung (Sonnewalde)');
 // Several bodies and none named, or two named equally well: the title of the meeting.
 assert.equal(councilserviceCommittee({title:'Sitzung aller Ortsbeiräte',groups:groups('Ortsbeirat (Sonnewalde OT Zeckerin)','Ortsbeirat (Sonnewalde OT Dabern)')}),'Sitzung aller Ortsbeiräte');
 assert.equal(councilserviceCommittee({title:'Sitzung des Ortsbeirates',groups:groups('Ortsbeirat (X OT Zeckerin)','Ortsbeirat (X OT Dabern)')}),'Sitzung des Ortsbeirates');
});
test('meetings of the list carry date, body and the number of agenda items; another format is an error',()=>{
 const {meetings,issues}=councilserviceMeetings(fixture('sonnewalde-list.json'),source);
 assert.equal(meetings.length,30);assert.deepEqual(issues,[]);
 assert.deepEqual(meetings.filter(m=>m.topics).map(m=>[m.id,m.date,m.committee]),[
  ['121615','2026-09-30','Stadtverordnetenversammlung (Sonnewalde)'],['121560','2026-09-23','Stadtverordnetenversammlung (Sonnewalde)'],
  ['121606','2026-09-16','Ausschuss für Bau, Stadtentwicklung und Wirtschaft (Sonnewalde)'],['121559','2026-06-24','Stadtverordnetenversammlung (Sonnewalde)']]);
 assert.equal(meetings.find(m=>m.id==='121559').url,page+'?href=/councilservice/entry/view/121559');
 // Series and deactivated entries are no meetings; a series that announces agenda items is named.
 const list=json('sonnewalde-list.json');list.data.entries.push({...list.data.entries[0],id:9001,has_recurrence:1,cnt_topics:5},{...list.data.entries[0],id:9002,deactivated:1});
 const more=councilserviceMeetings(list,source);
 assert.equal(more.meetings.length,30);assert.deepEqual(more.issues,['1 Serientermin mit Tagesordnung nicht gelesen']);
 // A list that holds fewer meetings than it counts is incomplete.
 assert.deepEqual(councilserviceMeetings({status:'OK',data:{entries:[list.data.entries[0]],filteredCount:2}},source).issues,['Sitzungsliste unvollständig (1 von 2)']);
 assert.throws(()=>councilserviceMeetings({status:'ERROR',message:'Keine Berechtigung'},source),/Unbekanntes Format/);
 assert.throws(()=>councilserviceMeetings({status:'OK',data:{entries:[{session:1}]}},source),/Unbekanntes Format/);
 assert.deepEqual(councilserviceMeetings({status:'OK',data:{entries:[]}},source).meetings,[]);
});
test('an agenda with "Ö:"/"NÖ:" marks keeps only the items marked public',()=>{
 const agenda=parseCouncilserviceMeeting(json('sonnewalde-entry-121559.json'),{id:'121559',committee:'Stadtverordnetenversammlung (Sonnewalde)'},source);
 assert.equal(agenda.committee,'Stadtverordnetenversammlung (Sonnewalde)');assert.equal(agenda.date,'2026-06-24');
 assert.deepEqual(agenda.items.map(i=>i.number),['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15']);
 assert.equal(agenda.left,5);assert.equal(agenda.unmarked,0);assert.equal(agenda.unclear,0);
 const text=JSON.stringify(agenda);
 for(const hidden of ['NÖ','Verkauf des Flurst','Sitzungsvorbereitung mit KI','nicht öffentlichen'])assert.ok(!text.includes(hidden),hidden);
 // The mark is removed from the title, also behind "in der Sitzung aufgenommen:"; Vorlage numbers are references.
 assert.equal(agenda.items[10].title,'Beschluss zur 1. Nachtragssatzung 2026/2027 (BV 36/2026)');assert.equal(agenda.items[10].reference,'BV 36/2026');
 assert.match(agenda.items[11].title,/^Beschluss zur Unterzeichnung einer öffentlich-rechtlichen Vereinbarung/);
 assert.equal(agenda.items[7].reference,'BV 33/2026');
 // Documents as the page links them; the calendar file of the meeting is no document.
 assert.deepEqual(agenda.items[7].documents.map(d=>d.title),['TOP 08_BV 33_2026_Beschluss Datum BGM-Wahl.pdf','Beschluss 33_2026.pdf']);
 assert.match(agenda.items[7].documents[0].url,new RegExp('^'+base+'export/auth/'+token+'/data/file/councilservice/(\\d+/)+TOP_08_BV_33_2026'));
 assert.deepEqual(agenda.documents.map(d=>d.kind),['application/pdf']);
 assert.ok(!agenda.documents.some(d=>/\.ics/.test(d.url)));
 // An agenda that marks its items: an item without a mark is neither taken nor counted as non-public.
 const unmarked=json('sonnewalde-entry-121559.json');unmarked.data.entry.topics[3].label='Beantwortung der Einwohneranfragen';
 const again=parseCouncilserviceMeeting(unmarked,{id:'121559'},source);
 assert.equal(again.items.length,14);assert.equal(again.unmarked,1);
 assert.throws(()=>parseCouncilserviceMeeting(json('sonnewalde-entry-121559.json'),{id:'121615'},source),/anderen Kennung/);
 assert.throws(()=>parseCouncilserviceMeeting({status:'ERROR'},{id:'1'},source),/Unbekanntes Format/);
 assert.equal(parseCouncilserviceMeeting(entry(5,[]),{id:'5'},source),null);
});
test('other marks of the public and non-public part, also after numbering or behind the title',()=>{
 for(const [pub,np] of [['Ö - Haushalt 2027','NÖ - Verkauf Grundstück Am Markt'],['Ö – Haushalt 2027','NÖ – Verkauf Grundstück Am Markt'],['11. Ö: Haushalt 2027','12. NÖ: Verkauf Grundstück Am Markt'],
  ['TOP 11: Ö: Haushalt 2027','TOP 12: NÖ: Verkauf Grundstück Am Markt'],['Haushalt 2027 (Ö)','Verkauf Grundstück Am Markt (NÖ)'],['Ö: Haushalt 2027','NOe: Verkauf Grundstück Am Markt'],
  ['Ö: Haushalt 2027','N&Ouml;: Verkauf Grundstück Am Markt'],['Ö: Haushalt 2027','NÖ: Verkauf Grundstück Am Markt'],['Ö: Haushalt 2027','​NÖ: Verkauf Grundstück Am Markt'],
  ['Ö: Haushalt 2027','NÃ–: Verkauf Grundstück Am Markt'],['Ö: Haushalt 2027','N.Ö.: Verkauf Grundstück Am Markt'],['ö: Haushalt 2027','nö: Verkauf Grundstück Am Markt']])
  assert.deepEqual(titles([topic(pub),topic(np)]),['Haushalt 2027'],np);
 // Without any mark, a title that names the non-public part in any spelling is left out.
 for(const np of ['Nicht_öffentlich: Verkauf','Verkauf (nicht öffentl.)','Verkauf (nichtöff.)','Verkauf (n.ö.)','nicht&ouml;ffentlich: Verkauf','nicht&amp;ouml;ffentlich: Verkauf','nicht­öffentlich: Verkauf','nicht‑öffentlich: Verkauf','nicht öffentlich: Verkauf','unter Ausschluss der Oeffentlichkeit: Verkauf','Verkauf (Ausschluss der Öffentlichkeit)','Verkauf (geschlossene Sitzung)','Verkauf (intern)','Vertrauliche Personalangelegenheit'])
  assert.deepEqual(titles([topic('Haushalt 2027'),topic(np),topic('Straßenbau Auenheim')]).filter(t=>/Verkauf|Personal/.test(t)),[],np);
});
test('an agenda with visibility flags keeps the visible items before the public part closes',()=>{
 const agenda=parseCouncilserviceMeeting(entry(7,[
  topic('Nicht-öffentlicher Tagesordnungspunkt',0),
  topic('Begrüßung und Feststellung der Beschlussfähigkeit'),
  topic('Genehmigung der Niederschrift des öffentlichen Teils der Sitzung vom 11.08.2026'),
  topic('Öffentlicher Teil',1,{children:[topic('Vergabe Leasing Multicar Bauhof BV 53/2026'),topic('Straßenbau Auenheim BV 61/2026',1,{children:[topic('Variante A')]})]}),
  topic('Bekanntgabe der in nicht öffentlicher Sitzung gefassten Beschlüsse'),
  topic('Personalangelegenheit',''),topic('Grundstücksfrage',[1]),
  topic('Grundstücksangelegenheit',0,{children:[topic('Kaufvertrag Flurstück 12')]}),
  topic('Einladung zur Gemeinderatssitzung am 30. Juli 2026'),
  topic('Schließung des öffentlichen Teils der Sitzung'),
  topic('Verkauf Grundstück Am Markt'),
  topic('Wiederherstellung der Öffentlichkeit und Bekanntgabe der Beschlüsse'),
 ]),{id:'7',committee:'Stadtrat (Stadt Werra-Suhl-Tal)'},source);
 assert.deepEqual(agenda.items.map(i=>[i.title,i.reference]),[
  ['Begrüßung und Feststellung der Beschlussfähigkeit',''],
  ['Genehmigung der Niederschrift des öffentlichen Teils der Sitzung vom 11.08.2026',''],
  ['Vergabe Leasing Multicar Bauhof BV 53/2026','BV 53/2026'],
  ['Straßenbau Auenheim BV 61/2026','BV 61/2026'],
  ['Variante A','']]);
 // Sub-items are numbered below their item, unless the system already gives the full number.
 const nested=parseCouncilserviceMeeting(entry(8,[topic('Straßenbau',1,{numeration:'6',children:[topic('Variante A',1,{numeration:'1'}),topic('Variante B',1,{numeration:'6.2'})]})]),{id:'8'},source);
 assert.deepEqual(nested.items.map(i=>i.number),['6','6.1','6.2']);
 // Hidden by the system (with its sub-item), flag unknown, naming the non-public part, the closing heading and the two
 // items after it; the invitation is no item and is not counted.
 assert.equal(agenda.left,9);
 const text=JSON.stringify(agenda);
 for(const hidden of ['Kaufvertrag','Personal','Grundstücksfrage','Verkauf Grundstück','nicht öffentlicher Sitzung','Wiederherstellung','Einladung'])assert.ok(!text.includes(hidden),hidden);
 // Headings that end the public part, whatever their numbering or spelling: nothing after them is taken.
 for(const heading of ['TOP 12: Nichtöffentlicher Teil','12) Nichtöffentlicher Teil','II) Nichtöffentlicher Teil','12.1 Nichtöffentlicher Teil','Nichtöffentliche Tagesordnung','Nichtöffentlicher Tagesordnungsteil','Nichtoeffentlicher Teil','Nicht oeffentliche Sitzung','Beginn des nichtöffentlichen Teils','Teil B – nicht öffentlich','Nicht öffentlich','Vertrauliche Sitzung','– Nichtöffentlicher Teil –','*** Nichtöffentlicher Teil ***','Schluss der öffentlichen Sitzung','Schließen der öffentlichen Sitzung','Ende öffentlicher Teil','Geschlossener Teil','In geschlossener Sitzung','Ausschluss der Oeffentlichkeit','Ausschluß der Öffentlichkeit','SCHLIEẞUNG DES ÖFFENTLICHEN TEILS','<b>Nicht&ouml;ffentlicher Teil</b>','NÖ-Teil','Interner Teil','Geschlossene Sitzung','B) Nicht-öffentlicher Teil','Ausschluss der Öffentlichkeit','Herstellung der Nichtöffentlichkeit'])
  assert.deepEqual(titles([topic('Haushalt 2027'),topic(heading),topic('Personalsache Müller'),topic('Verkauf Grundstück Am Markt')]),['Haushalt 2027'],heading);
 // An item that only reports on the non-public part is left out, but the public part goes on.
 assert.deepEqual(titles([topic('Bekanntgabe der in nicht öffentlicher Sitzung gefassten Beschlüsse'),topic('Haushalt 2027'),topic('Einwände gegen die Niederschrift über den nichtöffentlichen Teil der Sitzung vom 27.05.2026'),topic('Straßenbau Auenheim')]),['Haushalt 2027','Straßenbau Auenheim']);
 // Public titles with similar words stay.
 const pub=['Feststellung der öffentlichen Tagesordnung','Genehmigung des öffentlichen Teils der Niederschrift','Öffentliche Bekanntmachung des Bebauungsplans','Anfragen zu öffentlichen Angelegenheiten','Schließung der Grundschule Nord','Interne Leistungsverrechnung im Haushalt'];
 assert.deepEqual(titles(pub.map(l=>topic(l))),pub);
});
test('a meeting needs its release, and an agenda of another shape is refused',()=>{
 assert.equal(parseCouncilserviceMeeting(entry(7,[topic('Haushalt 2027')],{display_contents:0}),{id:'7'},source).restricted,true);
 assert.equal(parseCouncilserviceMeeting(entry(7,[topic('Haushalt 2027')],{visibility:0}),{id:'7'},source).restricted,true);
 assert.throws(()=>parseCouncilserviceMeeting(entry(7,[topic('Haushalt 2027')],{visibility:undefined}),{id:'7'},source),/ohne erkennbare Freigabe/);
 assert.throws(()=>parseCouncilserviceMeeting(entry(7,{1:topic('Haushalt 2027')}),{id:'7'},source),/Unbekanntes Format der Tagesordnung/);
 assert.throws(()=>parseCouncilserviceMeeting(entry(7,[topic('Haushalt 2027',1,{children:{1:topic('Verkauf')}})]),{id:'7'},source),/Unbekanntes Format der Tagesordnung/);
 const odd=parseCouncilserviceMeeting(entry(7,[topic('Haushalt 2027'),{...topic('x'),label:{text:'Verkauf'}}]),{id:'7'},source);
 assert.deepEqual(odd.items.map(i=>i.title),['Haushalt 2027']);assert.equal(odd.unclear,1);
});
test('Vorlage numbers are normalised; the last one of a title counts and kinds stay apart',()=>{
 for(const t of ['Bebauungsplan (BV 36/2026)','Bebauungsplan (BV 36/26)','Bebauungsplan (BV 036/2026)','Bebauungsplan (BV-Nr. 36/2026)'])assert.deepEqual(councilserviceReference(t),{label:'BV 36/2026',key:'bv-36-2026'},t);
 assert.equal(councilserviceReference('Stellungnahme zur Drucksache 8/2026 des Kreistages').key,'ds-8-2026');
 assert.equal(councilserviceReference('Aufhebung des Beschlusses BV 12/2024 und Neufassung (BV 40/2026)').key,'bv-40-2026');
 for(const t of ['Haushaltssatzung 2026/2027','Beschluss-Nr. 079-24/29','Vorlage 2026/2027'])assert.equal(councilserviceReference(t),null,t);
});
test('documents are linked only from this export, never when name or address names the non-public part',()=>{
 const link=base+'export/auth/'+token+'/data/file/councilservice/1/7/8/0/Beschluss_43_2026.pdf';
 const doc={path:'councilservice/1/7/8/0/',filename:'Beschluss_43_2026.pdf',filename_original:'Beschluss 43_2026.pdf',description:'Beschluss 43_2026.pdf',paths:{data:link}};
 assert.deepEqual(councilserviceDocument(doc,source),{title:'Beschluss 43_2026.pdf',url:link,kind:'application/pdf'});
 // Without a link of the page the file path below the export is used.
 assert.equal(councilserviceDocument({...doc,paths:undefined,filename:'Anlage 1 (neu).pdf'},source).url,base+'export/auth/'+token+'/data/file/councilservice/1/7/8/0/Anlage%201%20(neu).pdf');
 const bad=[{...doc,paths:{data:'https://evil.example/x.pdf'}},{...doc,paths:{data:link+'#page=3'}},{...doc,paths:{data:link+'?x=1'}},{...doc,paths:{data:link.replace(token,'aaaaaaaa-bbbbbbbb-cccccccc-dddddddd')}},
  {...doc,paths:{data:base+'export/auth/'+token+'/data/file/councilservice/1/..%2F..%2Fadmin'}},{...doc,paths:undefined,path:'../../etc/'},{...doc,paths:undefined,filename:'../x.pdf'},
  {...doc,description:'Niederschrift nichtöffentlicher Teil.pdf'},{...doc,description:'',filename_original:'Protokoll nicht öffentlich.pdf'},{...doc,description:'Niederschrift 24.06.2026',filename:'Niederschrift_nichtoeffentlich.pdf'},
  {...doc,description:'Protokoll (NÖ).pdf'},{...doc,description:'Niederschrift SVV nichtöff. Teil.pdf'},{...doc,paths:{data:link.replace('Beschluss_43_2026','NOe_Anlage_1')}},
  {...doc,is_deleted:1},{...doc,is_deleted:'true'},{...doc,filename_original:'Sitzung.ics'},{...doc,filename:'Sitzung.ics',paths:undefined}];
 for(const d of bad)assert.equal(councilserviceDocument(d,source),null,JSON.stringify(d));
});
test('collect reads the meetings of the period with the requests of the website and builds public reports',async()=>{
 const list=json('sonnewalde-list.json');list.data.entries=list.data.entries.filter(e=>['121615','121559','121562','121617','121608'].includes(String(e.id)));
 list.data.count=list.data.filteredCount=list.data.entries.length;
 // 121608 (past, no agenda) and 121562/121617 (ahead, no agenda) are not asked.
 const calls=[];
 const request=async(url,init)=>{calls.push({url,method:init.method||'GET',body:init.body,headers:init.headers});
  if(url.includes('/session/fetch-overview/'))return new Response(JSON.stringify(list),{status:200,headers:{'content-type':'application/json'}});
  const id=url.match(/fetch\/id\/(\d+)$/)?.[1];return new Response(fixture('sonnewalde-entry-'+id+'.json'),{status:200,headers:{'content-type':'application/json'}});};
 const result=await collectCouncilservice(source,{now,request,window:'12m'});
 assert.equal(calls[0].method,'POST');assert.equal(calls[0].body,'{"usePager":0}');
 const first=new URL(calls[0].url);
 assert.equal(first.origin+first.pathname,base+'councilservice/session/fetch-overview/mine/0/by-docs/0');
 // From the start of the window to the end of next month.
 assert.deepEqual(Object.fromEntries(first.searchParams),{range:'individual',schedule_start:windowStart(now,'12m').toISOString().slice(0,10),schedule_end:'2026-11-30'});
 assert.equal(calls[0].headers['X-Export-Token'],token);assert.equal(calls[0].headers['X-Requested-By'],'spa-export');assert.equal(calls[0].headers['Content-Type'],'application/json');
 assert.deepEqual(calls.slice(1).map(c=>[c.method,c.url]).sort(),[['GET',base+'councilservice/entry/fetch/id/121559'],['GET',base+'councilservice/entry/fetch/id/121615']]);
 assert.ok(calls.every(c=>c.headers['X-Export-Token']===token&&new URL(c.url).origin+'/'===base));
 assert.equal(result.topics.length,22);
 const text=JSON.stringify(result.topics);
 for(const hidden of ['NÖ:','Verkauf des Flurst','Sitzungsvorbereitung mit KI'])assert.ok(!text.includes(hidden),hidden);
 const vergabe=result.topics.find(t=>t.reference==='BV 43/2026');
 assert.equal(vergabe.id,'de-12062469-vo-bv-43-2026');assert.equal(vergabe.status,'unknown');assert.equal(vergabe.committee,'Stadtverordnetenversammlung (Sonnewalde)');
 assert.equal(vergabe.sourceUrl,page+'?href=/councilservice/entry/view/121615');
 assert.ok(vergabe.documents.some(d=>d.url===page+'?href=/councilservice/entry/view/121615'));
 // An item without a Vorlage number is a report of its own meeting.
 const opening=result.topics.filter(t=>/^Eröffnung der Sitzung/.test(t.title)),firstItem=id=>json(`sonnewalde-entry-${id}.json`).data.entry.topics[0].id;
 assert.deepEqual(opening.map(t=>t.id).sort(),[`de-12062469-cs-121559-${firstItem(121559)}`,`de-12062469-cs-121615-${firstItem(121615)}`]);
 assert.equal(result.coverage.meetings,3);assert.equal(result.coverage.upcomingWithoutAgenda,2);
 assert.deepEqual(result.coverage.warnings,['1 vergangene Sitzung ohne veröffentlichte Tagesordnung']);
 assert.deepEqual(result.coverage.issues,[]);assert.equal(result.coverage.complete,true);assert.equal(result.coverage.sourceUrl,page);
 assert.equal(result.readMeetings,2);assert.deepEqual(Object.keys(result.marks).sort(),[page+'?href=/councilservice/entry/view/121559',page+'?href=/councilservice/entry/view/121615']);
 // A second import with the marks of the first (its reports stored) asks the list only.
 const second=[];await collectCouncilservice(source,{now,window:'12m',marks:{known:result.marks,stock:new Set(Object.keys(result.marks))},request:async(url,init)=>{second.push(url);return request(url,init);}});
 assert.equal(second.length,1);
});
test('collect does not mark a meeting as read while items of it could not be told public or not',async()=>{
 const meeting=entry(701,[topic('Ö: Haushalt 2027'),topic('Beantwortung der Anfragen')],{title:'Stadtrat'});
 const list={status:'OK',data:{entries:[{id:701,title:'Stadtrat',recurrence_start:'2026-09-15',cnt_topics:2,groups:[{group_name:'Stadtrat (X)'}]}]}};
 const request=async url=>new Response(JSON.stringify(url.includes('fetch-overview')?list:meeting),{status:200,headers:{'content-type':'application/json'}});
 const result=await collectCouncilservice(source,{now,request,window:'3m'});
 assert.deepEqual(result.topics.map(t=>t.title),['Haushalt 2027']);
 assert.equal(result.coverage.complete,false);assert.match(result.coverage.issues[0],/1 Tagesordnungspunkt ohne Kennzeichnung als öffentlich ausgelassen/);
 assert.deepEqual(result.marks,{});
 // An agenda announced in the list but not delivered is named.
 const empty=await collectCouncilservice(source,{now,window:'3m',request:async url=>new Response(JSON.stringify(url.includes('fetch-overview')?list:entry(701,[])),{status:200})});
 assert.match(empty.coverage.issues[0],/Tagesordnung mit 2 Punkten angekündigt, aber nicht geliefert/);
});
test('collect names a lost token and refuses an entry without system, token or page',async()=>{
 const login=async()=>new Response('<!DOCTYPE html><html><body><form action="/login">Anmelden</form></body></html>',{status:200,headers:{'content-type':'text/html'}});
 const result=await collectCouncilservice(source,{now,request:login,window:'1m'});
 assert.equal(result.topics.length,0);assert.match(result.coverage.issues[0],/^Sitzungsliste: System antwortet mit einer Webseite statt Daten/);
 await assert.rejects(collectCouncilservice({...source,base:'https://evil.example/'},{now,request:login}),/ohne Adresse eines mein-intra-Systems/);
 await assert.rejects(collectCouncilservice({...source,token:''},{now,request:login}),/ohne Export-Schlüssel/);
 await assert.rejects(collectCouncilservice({...source,page:''},{now,request:login}),/ohne Seite der Website/);
});

test('the export loaded after a click with the token as element id (Pößneck) is recognised as well',async()=>{
 // Modelled on www.poessneck.de/stadt/ratsinformationssystem/: no <script src>, the loader receives the element and the
 // script address; initializeExport(b.id) runs with the id of that element. The page never says "councilservice".
 const id='94887bb0-4aa4ba38-4ce333dc-4de7b7bf',ps='https://www.poessneck.de/stadt/ratsinformationssystem/';
 const html='<html><body><h1>Ratsinformationssystem</h1><div id="'+id+'" style="cursor:pointer" onclick="loadExport(true)">Externe Inhalte laden</div>'
  +'<script type="text/javascript">(function(d,c,b,f){function e(a){a&&(a=new Date,a.setTime(a.getTime()+864E5),c.cookie="export_"+b.id+"=1; path=/; expires="+a.toUTCString()+";");b.removeAttribute("style");b.innerHTML="";b.onclick=null;a=c.createElement("script");a.setAttribute("crossorigin","use-credentials");a.onload=function(){d.initializeExport(b.id)};a.src=f;a.type="text/javascript";b.parentNode.insertBefore(a,b.nextSibling)}-1!==c.cookie.indexOf("export_"+b.id)&&e();d.loadExport=e})(window,document,document.getElementById("'+id+'"),"https://poessneck.mein-intra.net/export/js/initialize.js");</script>'
  +'<script>document.getElementById("ionasInfo").innerText="x";</script></body></html>';
 assert.deepEqual(exportTokens(html),[id]);
 assert.deepEqual(detectCouncilservice(ps+'?href=/councilservice/session/list',html),{adapter:'councilservice',base:'https://poessneck.mein-intra.net/',token:id,page:ps});
 assert.deepEqual(await READERS.councilservice.detect(ps+'?href=/councilservice/session/list',html),{base:'https://poessneck.mein-intra.net/',token:id,page:ps});
 // Without the address of the council service, without the loader call, with an id that is no token, or with both forms naming different tokens: nothing.
 assert.equal(detectCouncilservice(ps,html),null);
 assert.equal(detectCouncilservice(ps+'?href=/councilservice/session/list',html.replace('d.initializeExport(b.id)','d.initializeExport()')),null);
 assert.equal(detectCouncilservice(ps+'?href=/councilservice/session/list',html.replaceAll(id,'ris-box')),null);
 assert.equal(detectCouncilservice(ps+'?href=/councilservice/session/list',html+'<script>initializeExport("aaaaaaaa-bbbbbbbb-cccccccc-dddddddd")</script>'),null);
 // The static form still names its token alone.
 assert.deepEqual(exportTokens(fixture('sonnewalde-page.html')),[token]);
});
