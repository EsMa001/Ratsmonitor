import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {kicShell,kicConfig,kicHeaders,kicMeetings,parseKicMeeting,parseKicItem,kicResult,collectKic,detectKic} from '../server/integrations/kic.mjs';
// Excerpts of the live guest interface (October 2026), shortened: Aschaffenburg (risapi.aschaffenburg.de),
// Amt Eidertal and Buttenheim (risapi3.kic-software.de), Waldkraiburg (risapi1.kic-software.de).
const fixture=name=>readFileSync(new URL('./fixtures/kic/'+name,import.meta.url),'utf8');
const json=name=>JSON.parse(fixture(name));
const base='https://ris.aschaffenburg.de/',api='https://risapi.aschaffenburg.de/';
const source={id:'de-09661000',name:'Stadt Aschaffenburg',kind:'city',method:'scraper',adapter:'kic',base,api};
const now=new Date('2026-10-04T12:00:00Z');
test('KIC shell is recognised from the app page; the configuration names the interface and the key',async()=>{
 const html=fixture('aschaffenburg-shell.html');
 assert.deepEqual(kicShell('https://ris.aschaffenburg.de/app/dashboard',html),{base,version:'51b',uniqueId:'ris.aschaffenburg.de',customName:''});
 // A system below a path is named by it; ?clientid= selects one municipality of a shared system; old .mvc links are no name.
 assert.deepEqual(kicShell('https://ris.example.test/musterstadt/app/liste?clientid=32',html),{base:'https://ris.example.test/musterstadt/',version:'51b',uniqueId:'ris.example.test/musterstadt',customName:'musterstadt',client:32});
 assert.equal(kicShell('https://ris.burghaslach.de/Meeting.mvc/Index',html).base,'https://ris.burghaslach.de/');
 assert.equal(kicShell(base,'<html><body><div id="root"></div><script src="/static/js/main.js"></script></body></html>'),null);
 assert.equal(kicShell(base,html.replace('<div id="root"></div>','<div id="root"><p>x</p></div>')),null);
 // Another Vite/React app with the same file layout, and a CMS page that merely links the system, are no KIC shell.
 assert.equal(kicShell('https://shop.example.test/',html.replace('Ratsinformationssystem','Shop').replace(/\/51b\//g,'/v2/')),null);
 assert.equal(kicShell('https://www.aschaffenburg.de/',`<html><head><title>Ratsinformationssystem</title></head><body><div id="root"></div><a href="${base}app/dashboard">Ratsinformationssystem</a><script src="/v2/static/js/main-abc123.js"></script></body></html>`),null);
 // A file, a session suffix or a broken escape in the first path segment does not become the name of a system.
 assert.equal(kicShell('https://ris.aschaffenburg.de/index.html',html).base,base);
 assert.equal(kicShell(base+'app/dashboard;jsessionid=AB12CD34',html).base,base);
 assert.deepEqual(kicShell('https://ris.example.test/musterstadt;jsessionid=AB12CD34/app/liste',html),{base:'https://ris.example.test/musterstadt/',version:'51b',uniqueId:'ris.example.test/musterstadt',customName:'musterstadt'});
 assert.deepEqual(kicShell('https://ris.example.test/%E0%A4%A/app/',html),{base:'https://ris.example.test/',version:'51b',uniqueId:'ris.example.test',customName:''});
 assert.deepEqual(kicConfig(fixture('aschaffenburg-webconfig.json')),{api,orgKey:'7D12C300D8A945DA92DC76B57BDC2F87'});
 assert.throws(()=>kicConfig({serviceUrl:'http://risapi.example.test',org_key:'X'}),/ohne nutzbare/);
 assert.throws(()=>kicConfig({org_key:'X'}),/ohne Schnittstellenadresse/);
 assert.deepEqual(kicHeaders({orgKey:'K',uniqueId:'ris.aschaffenburg.de'}),{'x-orgkey':'K','x-uniqueid':'ris.aschaffenburg.de','x-customname':'',Accept:'application/json'});
 const calls=[];const found=await detectKic('https://ris.aschaffenburg.de/app/dashboard',html,{get:async(url,site)=>{calls.push([url,site.base]);return fixture('aschaffenburg-webconfig.json');}});
 assert.deepEqual(calls,[['https://ris.aschaffenburg.de/51b/webconfig.json','https://ris.aschaffenburg.de/']]);
 assert.deepEqual(found,{base,version:'51b',uniqueId:'ris.aschaffenburg.de',customName:'',api,orgKey:'7D12C300D8A945DA92DC76B57BDC2F87'});
 assert.equal(await detectKic(base,'<html>SessionNet</html>',{get:async()=>{throw Error('no request expected');}}),null);
 // A system shared by several municipalities: the interface names them with the id the catalog entry needs as client.
 const shared=[];const schoenau=await detectKic('https://ris.gvvschoenau.de/',html.replace(/\/51b\//g,'/51/'),{clients:true,request:async(url,init)=>init.headers,get:async(url,site,timeout,request)=>{shared.push([url,site.base,request&&await request(url,{headers:{}})]);return url.endsWith('webconfig.json')?JSON.stringify({serviceUrl:'https://risapi51a.kic-software.de',org_key:'55269502266E4E23813EC338F21AB5FD'}):fixture('gvvschoenau-clients.json');}});
 assert.deepEqual(shared.map(c=>c[0]),['https://ris.gvvschoenau.de/51/webconfig.json','https://risapi51a.kic-software.de/web/clients']);
 assert.equal(shared[1][2]['x-uniqueid'],'ris.gvvschoenau.de');assert.equal(schoenau.api,'https://risapi51a.kic-software.de/');
 assert.deepEqual(schoenau.clients.find(c=>c.name==='Gemeinde Utzenfeld'),{id:39,name:'Gemeinde Utzenfeld'});assert.equal(schoenau.clients.length,10);
});
test('KIC meeting list leaves out cancelled meetings and meetings with a non-public part only',()=>{
 const list={items:[...json('aschaffenburg-meetings.json').items,{id:7,name:'Abgesagt',meetingdate:'2026-09-30T00:00:00',state:3,visibility:1},{id:8,name:'Nur nichtöffentlich',meetingdate:'2026-09-30T00:00:00',state:0,visibility:2}]};
 const meetings=kicMeetings(list,source);
 assert.deepEqual(meetings.map(m=>[m.id,m.date,m.visibility]),[['100898951','2026-10-19',0],['100898937','2026-10-08',3],['100898916','2026-10-05',3],['100898894','2026-09-22',1],['100898178','2026-07-15',1],['100898171','2026-07-14',1]]);
 assert.deepEqual(meetings[3],{id:'100898894',url:base+'app/sitzungen/100898894',date:'2026-09-22',name:'7. Sitzung des Planungs- und Verkehrssenates',committee:'Planungs- und Verkehrssenat',client:'Stadt Aschaffenburg',visibility:1});
 assert.throws(()=>kicMeetings({message:'Tenant unknown'},source),/Unbekanntes Format/);
 // State and visibility sent as strings are the same numbers.
 const strings=kicMeetings({items:[{id:9,meetingdate:'2026-09-30T00:00:00',state:'3',visibility:'1'},{id:10,meetingdate:'2026-09-30T00:00:00',state:'0',visibility:'2'},{id:11,meetingdate:'2026-10-30T00:00:00',state:'0',visibility:'0'}]},source);
 assert.deepEqual(strings.map(m=>[m.id,m.visibility]),[['11',0]]);
 // A list whose entries carry neither id nor date is another format, not a period without meetings.
 assert.throws(()=>kicMeetings({items:[{meetingId:9,date:'2026-09-30'}]},source),/Unbekanntes Format/);
 assert.deepEqual(kicMeetings({items:[]},source),[]);
});
test('KIC agenda keeps only public items; the role appended to a title is removed',()=>{
 // Amt Eidertal shows the titles of its non-public part to guests, marked as protected part and restricted items.
 const agenda=parseKicMeeting(json('eidertal-meeting-52376529.json'),{id:'52376529',date:'2026-10-05'});
 assert.equal(agenda.committee,'Gemeindevertretung Rumohr');assert.equal(agenda.date,'2026-10-05');
 assert.deepEqual(agenda.items.map(i=>i.number),['1','2','3','4','5','6','7','8']);
 assert.ok(!JSON.stringify(agenda).includes('Verkauf der DHH'));assert.ok(!JSON.stringify(agenda).includes('nichtöffentlichen Sitzung'));
 assert.deepEqual(agenda.items[6],{key:'52376529-63134834',number:'7',title:'Jahresabschluss 2025 (SV)',documents:2,downloads:true,globalId:''});
 // An item marked restricted inside a public part is skipped as well.
 const mixed=json('eidertal-meeting-52376529.json');mixed.parts[0].agendaitems[1].restricted=true;
 assert.equal(parseKicMeeting(mixed,{date:'2026-10-05'}).items.length,7);
 const senat=parseKicMeeting(json('aschaffenburg-meeting-100898894.json'),{date:'2026-09-22'});
 assert.match(senat.items[0].title,/^Klärwerk: 4\. Reinigungsstufe - Aktualisierung .* Weyarn$/);assert.match(senat.items[1].title,/\(Nr\. 3\/28\)$/);
 // Buttenheim publishes date and documents of a meeting, but no agenda items to guests.
 assert.equal(parseKicMeeting(json('buttenheim-meeting-11973843.json'),{date:'2026-09-14'}),null);
 // Fail closed: a part or an item without a flag, or with a value the reader does not know (a non-public part labelled
 // otherwise), is not taken but counted, so that the collector names it.
 const flags=(protectedpart,restricted)=>({parts:[{...(protectedpart===undefined?{}:{protectedpart}),agendaitems:[{id:'1-2',name:'Grundstücksverkauf (nichtöffentlich)',...(restricted===undefined?{}:{restricted})}]}]});
 for(const [part,item] of [[undefined,undefined],[false,undefined],[undefined,false],[0,false],['nein',false],[false,'nö'],[false,1]])assert.deepEqual(parseKicMeeting(flags(part,item)).items,[],JSON.stringify([part,item]));
 assert.equal(parseKicMeeting(flags(undefined,undefined)).unclear,1);
 assert.equal(parseKicMeeting(flags(true,undefined)).unclear,0);assert.equal(parseKicMeeting(flags(false,true)).unclear,0);
 assert.equal(parseKicMeeting(flags('false','false')).items.length,1);assert.equal(parseKicMeeting(flags(false,'ö')).items.length,1);
 assert.equal(parseKicMeeting(json('eidertal-meeting-52376529.json')).unclear,0);
 // A broken part is skipped, not the meeting; a title is plain text, not HTML.
 const broken=json('eidertal-meeting-52376529.json');broken.parts.unshift(null,{protectedpart:false,agendaitems:[null,{id:'52376529-1',numbering:'0',name:'Lärm <55 dB und >45 dB\r\n(Beschließend)',restricted:false,downloadallowed:true}]});
 const noisy=parseKicMeeting(broken);assert.equal(noisy.items.length,9);assert.deepEqual([noisy.items[0].title,noisy.items[0].number],['Lärm <55 dB und >45 dB','0']);
 // An answer without parts is not an empty agenda.
 assert.throws(()=>parseKicMeeting({id:1,meetingdate:'2026-10-05T00:00:00',agenda:[]}),/Unbekanntes Format der Sitzung/);
});
test('KIC agenda item yields the consultation sequence, the vote and the documents open to guests',()=>{
 const eidertal={...source,base:'https://ris.amt-eidertal.de/',api:'https://risapi3.kic-software.de/'};
 const item=parseKicItem(json('eidertal-item-52376529-63134834.json'),eidertal);
 assert.deepEqual(item.consultations.map(c=>[c.key,c.date,c.committee,c.public]),[['52376165-57902542','2026-09-21','Finanzausschuss Rumohr',true],['52376529-63134834','2026-10-05','Gemeindevertretung Rumohr',true]]);
 assert.equal(item.documents.length,2);assert.equal(item.documents[0].kind,'application/pdf');
 assert.equal(item.documents[0].url,'https://ris.amt-eidertal.de/app/download?url=web%2Fguestagendaitems%2Fdocuments%2F52376529-63134834-63124689&fileName=06-RUM%20-%20Jahresabschluss%202025%20kpl.%20finale%20Endfassung%20Stand%208.%20Jul%2026.pdf');
 assert.equal(new URL(item.documents[0].url).searchParams.get('fileName'),'06-RUM - Jahresabschluss 2025 kpl. finale Endfassung Stand 8. Jul 26.pdf');
 // Documents not open to guests are not linked.
 const hidden=json('eidertal-item-52376529-63134834.json');hidden.documents[0].guestvisible=false;hidden.documents[1].isprotected=true;
 assert.deepEqual(parseKicItem(hidden,eidertal).documents,[]);
 // Fail closed: without the flag that guests may see it, a document is not linked; without released texts, none is.
 const unflagged=json('eidertal-item-52376529-63134834.json');delete unflagged.documents[0].guestvisible;
 assert.equal(parseKicItem(unflagged,eidertal).documents.length,1);
 const unreleased=json('eidertal-item-52376529-63134834.json');delete unreleased.textsanddocsvisible;
 assert.deepEqual(parseKicItem(unreleased,eidertal).documents,[]);
 // A document without a name still gets a usable file name.
 const nameless=json('eidertal-item-52376529-63134834.json');delete nameless.documents[0].name;
 const doc=parseKicItem(nameless,eidertal).documents[0];assert.equal(doc.title,'Originalunterlage');assert.equal(new URL(doc.url).searchParams.get('fileName'),'Dokument.pdf');
 // The item's own page has to call it public as well: a restricted detail, or one without the flag, adds nothing.
 for(const restricted of [true,'true',undefined,'nö']){
  const closed=json('eidertal-item-52376529-63134834.json');if(restricted===undefined)delete closed.restricted;else closed.restricted=restricted;
  assert.throws(()=>parseKicItem(closed,eidertal),/nicht als öffentlich gekennzeichnet/);
 }
 assert.equal(parseKicItem(json('aschaffenburg-item-100898178-104869054.json'),source).result,'Einstimmig angenommen');
 assert.equal(kicResult([{votingkind:0,resultyes:12,resultno:3,resultnone:null},{votingkind:2}]),'Ja: 12, Nein: 3; Mehrheitlich abgelehnt');
 // Waldkraiburg shows neither texts nor documents nor the sequence to guests.
 assert.deepEqual(parseKicItem(json('waldkraiburg-item-42943872-42911946.json'),{...source,base:'https://ris.waldkraiburg.de/'}),{role:'beschließend',consultations:[],result:'',documents:[]});
});
// The Stadtrat meeting of 5 October and its item are built from the Senat excerpt: the same matter, decided there.
const stadtrat=()=>{const m=json('aschaffenburg-meeting-100898894.json');Object.assign(m,{id:100898916,name:'13. Sitzung des Stadtrates (Plenum)',meetingdate:'2026-10-05T00:00:00',committeename:'Stadtrat (Plenum)'});m.parts[0].agendaitems=[{...m.parts[0].agendaitems[1],id:'100898916-105768971',numbering:'4',name:m.parts[0].agendaitems[1].name.replace('(Vorberatend)','(Beschließend)')}];return m;};
const stadtratItem=()=>({...json('aschaffenburg-item-100898894-105768989.json'),id:'100898916-105768971',meetingid:100898916,committeename:'Stadtrat (Plenum)',conordertype:'Beschließend',meetingdate:'2026-10-05T00:00:00'});
function system(overrides={}){
 const lists=[],headers=[];
 const pages={
  [base]:fixture('aschaffenburg-shell.html'),
  [base+'51b/webconfig.json']:fixture('aschaffenburg-webconfig.json'),
  [api+'web/guestmeetings/100898937']:JSON.stringify({...json('buttenheim-meeting-11973843.json'),meetingdate:'2026-10-08T00:00:00'}),
  [api+'web/guestmeetings/100898916']:JSON.stringify(stadtrat()),
  [api+'web/guestmeetings/100898894']:fixture('aschaffenburg-meeting-100898894.json'),
  [api+'web/guestmeetings/100898178']:fixture('aschaffenburg-meeting-100898178.json'),
  [api+'web/guestmeetings/100898171']:JSON.stringify({...json('buttenheim-meeting-11973843.json'),meetingdate:'2026-07-14T00:00:00'}),
  [api+'web/guestagendaitems/100898916-105768971']:JSON.stringify(stadtratItem()),
  [api+'web/guestagendaitems/100898894-105768989']:fixture('aschaffenburg-item-100898894-105768989.json'),
  [api+'web/guestagendaitems/100898178-104869054']:fixture('aschaffenburg-item-100898178-104869054.json'),
  ...overrides,
 };
 const calls=[];
 const get=async(url,site,timeout,request)=>{
  calls.push(url);assert.ok(url.startsWith(site.base),'every address lies inside the approved source: '+url);
  if(url.startsWith(api)){assert.equal(typeof request,'function');headers.push(await request(url,{headers:{'User-Agent':'UA'}}));}
  const u=new URL(url);
  if(u.pathname==='/web/guestmeetings'){lists.push(Object.fromEntries(u.searchParams));return JSON.stringify({items:json('aschaffenburg-meetings.json').items.filter(m=>m.meetingdate.slice(0,10)>=u.searchParams.get('from')&&m.meetingdate.slice(0,10)<=u.searchParams.get('until'))});}
  // Remaining items of the excerpted meetings: a plain item without a consultation sequence.
  const item=u.pathname.match(/^\/web\/guestagendaitems\/(\d+)-(\d+)$/);
  if(!(url in pages)&&item)return JSON.stringify({id:item[1]+'-'+item[2],restricted:false,textsanddocsvisible:true,downloadallowed:true,documents:[],conorderitems:[],votings:[]});
  if(!(url in pages))throw Error('Quelle antwortet mit HTTP 404');
  if(pages[url] instanceof Error)throw pages[url];
  return pages[url];
 };
 return {get,calls,lists,headers,request:async(url,init)=>init.headers};
}
test('KIC collector reads the guest interface with the headers of the app and joins the consultations of a matter',async()=>{
 const s=system();const d=await collectKic(source,{now,window:'3m',get:s.get,request:s.request});
 // The list is asked in steps of three months up to the end of next month.
 assert.deepEqual(s.lists,[{from:'2026-07-04',until:'2026-10-03'},{from:'2026-10-04',until:'2026-11-30'}]);
 for(const h of s.headers)assert.deepEqual(h,{'User-Agent':'UA','x-orgkey':'7D12C300D8A945DA92DC76B57BDC2F87','x-uniqueid':'ris.aschaffenburg.de','x-customname':'',Accept:'application/json'});
 // The upcoming meeting without a published agenda (visibility 0) is not asked.
 assert.ok(!s.calls.some(u=>u.includes('100898951')));
 assert.deepEqual(d.coverage.issues,[]);assert.equal(d.coverage.complete,true);assert.equal(d.coverage.method,'scraper');
 assert.equal(d.coverage.meetings,4);assert.equal(d.coverage.upcomingWithoutAgenda,2);
 assert.deepEqual(d.coverage.warnings,['Sitzung ohne öffentlich einsehbare Tagesordnung: '+base+'app/sitzungen/100898171']);
 const matter=d.topics.find(t=>t.id==='de-09661000-vo-100898894-105768989');
 assert.deepEqual(matter.events.map(e=>[e.date,e.committee,e.status]),[['2026-09-22','Planungs- und Verkehrssenat','unknown'],['2026-10-05','Stadtrat (Plenum)','consulting']]);
 assert.equal(matter.sourceUrl,base+'app/sitzungen/100898894/100898894-105768989');assert.equal(matter.status,'consulting');assert.equal(matter.eventDate,'2026-10-05');
 assert.deepEqual(matter.identityLinks,[base+'app/sitzungen/100898894/100898894-105768989',base+'app/sitzungen/100898916/100898916-105768971']);
 assert.equal(matter.regionId,source.id);assert.equal(matter.public,true);assert.doesNotMatch(matter.title,/Vorberatend|Beschließend/);
 assert.deepEqual(matter.sourceData.records[1].fields.consultations.map(c=>[c.date,c.committee,c.role]),[['2026-09-22','Planungs- und Verkehrssenat','Vorberatend'],['2026-10-05','Stadtrat (Plenum)','Beschließend']]);
 // A unanimous vote of a committee that is not the council is a recommendation.
 const vote=d.topics.find(t=>t.id==='de-09661000-vo-100898178-104869054');
 assert.equal(vote.status,'recommended');assert.equal(vote.events[0].result,'Einstimmig angenommen');assert.equal(vote.events[0].decision.kind,'recommendation');
 assert.equal(vote.sourceData.records[0].fields.globalId,'UKVS/4/2/26');
 assert.equal(d.topics.length,5);assert.equal(d.readMeetings,3);assert.equal(Object.keys(d.marks).length,3);
 // A second import right after the first relies on the marks and asks for no meeting.
 const again=system();const second=await collectKic(source,{now,window:'3m',get:again.get,request:again.request,marks:{known:d.marks,stock:new Set(Object.keys(d.marks))}});
 assert.equal(second.coverage.unchangedMeetings,3);assert.ok(!again.calls.some(u=>/guestagendaitems|guestmeetings\/100898(894|916|178)/.test(u)));
});
test('KIC collector: the council decides; a shared system is asked for one municipality; gaps are named',async()=>{
 const decided=stadtratItem();decided.votings=[{votingkind:1,resultyes:null,resultno:null,resultnone:null,textblocks:[]}];
 const later=new Date('2026-10-06T12:00:00Z'),s=system({[api+'web/guestagendaitems/100898916-105768971']:JSON.stringify(decided)});
 const d=await collectKic({...source,client:32},{now:later,window:'1m',get:s.get,request:s.request});
 assert.ok(s.lists.every(q=>q.client==='32'));
 const matter=d.topics.find(t=>t.id==='de-09661000-vo-100898894-105768989');assert.equal(matter.status,'approved');assert.equal(matter.events.at(-1).decision.kind,'decision');
 // An unreadable item is a gap, and its meeting is read again next time.
 const broken=system({[api+'web/guestagendaitems/100898894-105768989']:Error('Quelle antwortet mit HTTP 500')});
 const gap=await collectKic(source,{now,window:'1m',get:broken.get,request:broken.request});
 assert.deepEqual(gap.coverage.issues,[`Tagesordnungspunkt ${base}app/sitzungen/100898894/100898894-105768989: Quelle antwortet mit HTTP 500`]);
 assert.ok(!(base+'app/sitzungen/100898894' in gap.marks));assert.ok(base+'app/sitzungen/100898916' in gap.marks);assert.equal(gap.coverage.complete,false);
 // The app names another interface than the catalog: nothing is asked there.
 const moved=system({[base+'51b/webconfig.json']:JSON.stringify({serviceUrl:'https://risapi9.kic-software.de',org_key:'K'})});
 const other=await collectKic(source,{now,window:'1m',get:moved.get,request:moved.request});
 assert.match(other.coverage.issues[0],/andere Schnittstelle \(https:\/\/risapi9\.kic-software\.de\/\)/);assert.ok(!moved.calls.some(u=>u.includes('risapi')));assert.equal(other.coverage.quiet,false);
 // The interface does not know the system (wrong host name): an error, never a quiet period.
 const unknown=system();const failing=async(url,...rest)=>url.includes('/web/guestmeetings?')?(()=>{throw Error('Quelle antwortet mit HTTP 404');})():unknown.get(url,...rest);
 const tenant=await collectKic(source,{now,window:'1m',get:failing,request:unknown.request});
 assert.match(tenant.coverage.issues[0],/^Sitzungsliste 2026-09-04 bis 2026-11-30: Quelle antwortet mit HTTP 404$/);assert.equal(tenant.coverage.quiet,false);
 await assert.rejects(collectKic({...source,api:undefined},{now,get:s.get}),/ohne Schnittstellenadresse/);
 // An interface address written without the closing slash is the same interface.
 const plain=system();assert.equal((await collectKic({...source,api:'https://risapi.aschaffenburg.de'},{now,window:'1m',get:plain.get,request:plain.request})).coverage.complete,true);
});
test('KIC collector fails closed: items without a clear release and unknown pages are named, never imported',async()=>{
 // Senat meeting: the third item has no restricted flag, the detail of the first calls itself restricted.
 const senat=json('aschaffenburg-meeting-100898894.json');delete senat.parts[0].agendaitems[2].restricted;
 // A past meeting whose items carry no flags at all, and a meeting page in another format.
 const flagless={...json('aschaffenburg-meeting-100898178.json'),id:100898171,meetingdate:'2026-07-14T00:00:00',parts:[{agendaitems:[{id:'100898171-1',numbering:'1',name:'Grundstücksangelegenheit'}]}]};
 const s=system({
  [api+'web/guestmeetings/100898894']:JSON.stringify(senat),
  [api+'web/guestagendaitems/100898894-101579760']:JSON.stringify({id:'100898894-101579760',restricted:true,textsanddocsvisible:true,downloadallowed:true,documents:[{id:'100898894-101579760-1',name:'Vertrag',fileext:'.pdf',guestvisible:true}],conorderitems:[],votings:[{votingkind:3}]}),
  [api+'web/guestmeetings/100898171']:JSON.stringify(flagless),
  [api+'web/guestmeetings/100898178']:JSON.stringify({id:100898178,meetingdate:'2026-07-15T00:00:00',agenda:[]}),
 });
 const d=await collectKic(source,{now,window:'3m',get:s.get,request:s.request});
 assert.deepEqual(d.coverage.issues.toSorted(),[
  `Tagesordnungspunkt ${base}app/sitzungen/100898894/100898894-101579760: Tagesordnungspunkt im Gastzugang nicht als öffentlich gekennzeichnet`,
  `${base}app/sitzungen/100898171: 1 Tagesordnungspunkt ohne erkennbare Freigabe für Gäste ausgelassen`,
  `${base}app/sitzungen/100898178: Unbekanntes Format der Sitzung`,
  `${base}app/sitzungen/100898894: 1 Tagesordnungspunkt ohne erkennbare Freigabe für Gäste ausgelassen`,
 ]);
 assert.equal(d.coverage.complete,false);assert.equal(d.coverage.warnings,undefined);
 // The unclear item is not even asked; neither it nor the restricted one becomes a topic, the rest of the meeting does.
 assert.ok(!s.calls.some(u=>u.includes('100898894-105769028')));
 assert.ok(!d.topics.some(t=>t.identityLinks.some(l=>/105769028|101579760/.test(l))));assert.ok(!JSON.stringify(d.topics).includes('Vertrag'));
 assert.ok(d.topics.some(t=>t.id==='de-09661000-vo-100898894-105768989'));
 // None of these meetings counts as read, so the next import asks them again.
 assert.deepEqual(Object.keys(d.marks),[base+'app/sitzungen/100898916']);
});
test('KIC topic id does not depend on whether guests see the consultation sequence; list numbers may be strings',async()=>{
 const hidden={...json('aschaffenburg-item-100898178-104869054.json'),conorderitems:[]};
 const s=system({[api+'web/guestagendaitems/100898178-104869054']:JSON.stringify(hidden)});
 const strings=async(url,...rest)=>{const answer=await s.get(url,...rest);return url.includes('/web/guestmeetings?')?JSON.stringify({items:JSON.parse(answer).items.map(m=>({...m,state:String(m.state),visibility:String(m.visibility)}))}):answer;};
 const d=await collectKic(source,{now,window:'3m',get:strings,request:s.request});
 // Same id as with the sequence shown (see above); the link is the item's own page.
 const vote=d.topics.find(t=>t.id==='de-09661000-vo-100898178-104869054');
 assert.ok(vote);assert.equal(vote.sourceUrl,base+'app/sitzungen/100898178/100898178-104869054');
 assert.ok(d.topics.every(t=>t.id.startsWith(source.id+'-vo-')));assert.equal(d.topics.length,5);
 // visibility "0" is the upcoming meeting without an agenda: not asked.
 assert.ok(!s.calls.some(u=>u.includes('100898951')));assert.equal(d.coverage.upcomingWithoutAgenda,2);assert.deepEqual(d.coverage.issues,[]);
});
