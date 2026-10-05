import {sourceDecision} from './source-fields.mjs';
import {windowStart,calendarMonthsBack} from './history-window.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text,decode,MAX_MEETINGS} from './sessionnet.mjs';
import {resultStatus} from './sdnet.mjs';
import {createSession} from './allris.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
// Public pages of ALLRIS net, the older ALLRIS generation (ALLRIS 3): .asp programs in one folder. Read are the monthly
// calendar (si010, si010_e, si010_j or the responsive si010_r), the agenda of each meeting (to010) and the page of each
// paper on a public agenda (vo020).
//
// - Each installation releases its own calendar program and answers the others with "Zugriff verweigert (Programm …)".
//   The program is taken from the installation's menu, never guessed; a refusal ends reading. Agenda and paper pages
//   are taken from the links of the pages read, so the responsive variant (_r) and the classic ones read alike.
// - Only agenda items numbered "Ö …" are taken. The non-public part is printed as "N …" with the title
//   "(nichtöffentlich)" or left out, and public items can follow it.
// - Attachments are linked under temporary addresses (___tmp) and are not kept. Documents of a paper are kept under the
//   address of the document program (do027), the same link the responsive pages give.
const day=value=>{const m=String(value).match(/(\d{2})\.(\d{2})\.(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:null;};
const cell=(row,name)=>row.match(new RegExp(`<td[^>]*class=["'](?:[^"']*\\s)?${name}(?:\\s[^"']*)?["'][^>]*>([\\s\\S]*?)<\\/td>`,'i'))?.[1]||'';
const byId=(html,id)=>html.match(new RegExp(`<span[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/span>`,'i'))?.[1]||'';
// Classic pages: a label cell (class kb1) followed by its value cell.
const labelled=(html,label)=>html.match(new RegExp(`<td[^>]*class=["']kb1["'][^>]*>\\s*${label}:?\\s*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`,'i'))?.[1]||'';
// Record number in an address; inside HTML the parameters may be separated by "&amp;".
const record=(address,name)=>String(address).match(new RegExp(`[?&;]${name}=(\\d+)`,'i'))?.[1]||null;
// From the first opening tag to the first end tag: responsive agenda pages write the opening tag and caption twice.
const table=(html,name)=>html.match(new RegExp(`<table[^>]*class=["'](?:[^"']*\\s)?${name}(?:\\s[^"']*)?["'][\\s\\S]*?<\\/table>`,'i'))?.[0]||null;
const rows=html=>[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>m[1]);
const attribute=(tag,name)=>decode(tag.match(new RegExp(`\\b${name}=["']([^"']*)`,'i'))?.[1]||'');
// Address of one record: the program the link names, with the record number as its only parameter.
const address=(href,name,id,source)=>{const u=new URL(decode(href),source.base);u.search=`?${name}=${id}`;u.hash='';return allowed(u.href,source);};
const CALENDAR=/^si010(?:_[a-z])?\.asp$/i;
const MARKER=/allriscontainer|allriscontent|allrisnet\.js|ALLRIS net|images\/ALLRIS\.ico|id=["']allris["']|allris\.net\.asp/i;
const REFUSAL='Quelle meldet zu viele Zugriffe und sperrt vorübergehend; Abruf beendet.';
const GATE='Quelle verlangt eine Zugriffsprüfung gegen automatisierte Abrufe; sie wird nicht umgangen. Abruf beendet.';
const closed=program=>`Programm ${program} ist auf dieser Installation nicht freigegeben („Zugriff verweigert“).`;
/**
 * Program the installation refuses, sent with HTTP 200 as "Zugriff verweigert (Programm si010_r.asp)" or with its
 * path ("… (Programm /buergerinformationssystem2/si010.asp)"); null otherwise.
 */
export function refusedProgram(html){html=String(html||'');const named=html.length<2000&&html.match(/Zugriff verweigert \(Programm ([^)\s]+?)\.?\)/i)?.[1];return named?named.split('/').pop():null;}
const folder=u=>new URL('./',u).href.toLowerCase();
// Public folder next to the members' area: bi/ for ri/, <name>-bi/ for <name>-ri/ (also with "_").
const publicFolder=href=>href.replace(/(\/|[-_])ri\/$/i,'$1bi/');
/**
 * First calendar program among the links of a page (menu or month navigation); null if the page names none. With base,
 * only a program in that folder counts: pages inside a municipality's website may also link an older installation.
 * page: address the links are relative to, if not base.
 */
export function calendarProgram(html,base,page=base){
 if(refusedProgram(html))return null;
 for(const m of String(html||'').matchAll(/(?:href|action)=["']([^"']*?si010(?:_[a-z])?\.asp)(?=[?#"'])/gi)){
  if(!base)return m[1].split('/').pop();
  try{const u=new URL(decode(m[1]),page);if(u.origin===new URL(base).origin&&folder(u)===base.toLowerCase())return u.pathname.split('/').pop();}catch{/* no address */}
 }
 return null;
}
/**
 * ALLRIS 3 behind an address. url: the linked page; html: its content as received.
 * Returns null if the page is not ALLRIS 3, otherwise {base, calendar}:
 * - base: folder of the ALLRIS programs, ending in "/". It is the folder of the page itself when the page is an ALLRIS
 *   program (si010_r.asp, allris.net.asp, …). For a page that is no program (a folder address, a frameset, a page of the
 *   municipality's website), it is the folder of the calendar or start page it links (else of the first ALLRIS program
 *   it links), on the same host only. Such a page counts without ALLRIS markers if it links a calendar program.
 *   The members' area is never the base: for the login (ri/logon.asp, <name>-ri/logon.asp of the ratsinfo-online
 *   hosting) and for a folder address in it (ri/, <name>-ri/) it is the public sibling folder bi/ or <name>-bi/, as for
 *   SessionNet (scripts/source-discovery/README.md, "Anmeldebereich").
 * - calendar: the calendar program (si010.asp, si010_e.asp, si010_j.asp or si010_r.asp) the page is or links in base,
 *   or null when the page names none, or when it is the refusal of a calendar program. collectAllris3 then reads
 *   <base>allris.net.asp once and takes the program from its menu.
 */
export function detectAllris3(url,html=''){
 let page;try{page=new URL(url);}catch{return null;}
 html=String(html||'');
 const program=page.pathname.match(/\/((?:[a-z]{2}\d{3}(?:_[a-z])?|allris\.net|logon)\.asp)$/i)?.[1]||null,refused=refusedProgram(html);
 // The login counts among the links of a folder address (a frame or link to logon.asp in ri/), never as its base.
 const linked=[...html.matchAll(/(?:href|action|src)=["']([^"']*?(?:[a-z]{2}\d{3}(?:_[a-z])?|allris\.net|logon)\.asp)(?=[?#"'])/gi)].map(m=>{try{return new URL(decode(m[1]),page);}catch{return null;}}).filter(u=>u?.origin===page.origin);
 if(!(MARKER.test(html)||refused||!program&&linked.some(u=>CALENDAR.test(u.pathname.split('/').pop())))||!program&&!linked.length)return null;
 const base=program?(/^logon\.asp$/i.test(program)?publicFolder(new URL('./',page).href):new URL('./',page).href):publicFolder(new URL('./',linked.find(u=>/\/(?:si010(?:_[a-z])?|allris\.net)\.asp$/i.test(u.pathname))||linked[0]).href);
 const own=program&&CALENDAR.test(program)&&!refused&&/calenderView|class=["']tl1["']/i.test(html)?program:null;
 return {base,calendar:own||calendarProgram(html,base,page.href)};
}
/**
 * Request function for fetchText. ALLRIS 3 sends "text/html" without a character set and declares it in the page,
 * mostly as iso-8859-1, on some installations as charset="ISO-8859-15", which fetchText does not recognise. The first
 * declaration counts (some pages declare UTF-8 further down for embedded parts); a Latin one is passed on in the header.
 */
export function declaredCharset(request=fetch){
 return async(url,init)=>{
  const r=await request(url,init);
  if(!r.ok||/charset=/i.test(r.headers.get('content-type')||''))return r;
  const body=await r.arrayBuffer(),declared=new TextDecoder().decode(body.slice(0,4000)).match(/(?:charset|encoding)\s*=\s*["']?([\w-]+)/i)?.[1]||'';
  const headers=new Headers(r.headers);
  if(/^(?:iso-8859-15?|windows-1252|latin-?1)$/i.test(declared))headers.set('content-type',(r.headers.get('content-type')||'text/html')+'; charset=windows-1252');
  return new Response(body,{status:r.status,statusText:r.statusText,headers});
 };
}
/**
 * Meetings of one calendar page that link their agenda; null if the page shows no calendar. A meeting without a link
 * has no published agenda or is not public. Classic pages (table tl1) name the day in the second cell, responsive ones
 * (calenderView) in span.dom; further meetings of the same day leave it out. Range views name the full date.
 */
export function parseAllris3Calendar(html,source,{year,month}={}){
 const list=table(html,'calenderView')||table(html,'tl1');if(!list)return null;
 const meetings=[];let dom=null;
 for(const row of rows(list)){
  const full=day(row.match(/<td[^>]*>\s*(\d{2}\.\d{2}\.\d{4})\s*<\/td>/)?.[1]||'');
  dom=row.match(/class=["']dom["'][^>]*>\s*(\d{1,2})\s*</)?.[1]||row.match(/<td[^>]*class=["']text2["'][^>]*>(?:\s|&nbsp;)*(\d{1,2})\s*<\/td>/i)?.[1]||dom;
  for(const m of row.matchAll(/<a\b[^>]*href=["']([^"']*to010(?:_[a-z])?\.asp\?[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)){
   const id=record(decode(m[1]),'SILFDNR'),date=full||(year&&month&&dom?`${year}-${String(month).padStart(2,'0')}-${dom.padStart(2,'0')}`:null);
   if(id&&date)meetings.push({url:address(m[1],'SILFDNR',id,source),date,name:text(m[2])});
  }
 }
 return meetings;
}
/** Public agenda items of one meeting page; null if the page shows no agenda. Public is an item numbered "Ö …". */
export function parseAllris3Agenda(html,meeting,source,now=new Date()){
 const list=table(html,'toTable')||table(html,'tl1');if(!list)return null;
 const heading=text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'').replace(/^Tagesordnung\s*-\s*/i,'');
 const date=day(text(byId(html,'sidatum')||labelled(html,'Datum')))||meeting.date;
 const committee=text(byId(html,'sigremium')||labelled(html,'Gremium'))||heading.replace(/\s*-\s*\d{2}\.\d{2}\.\d{4}.*$/,'')||meeting.name||'Öffentliche Sitzung';
 const today=now.toISOString().slice(0,10),url=meeting.url,items=[];
 for(const row of rows(list)){
  const link=row.match(/<a\b[^>]*href=["']([^"']*to010(?:_[a-z])?\.asp\?[^"']*TOLFDNR=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);if(!link)continue;
  const number=text(link[2]),top=record(decode(link[1]),'TOLFDNR');
  if(!/^Ö\s*\d/.test(number))continue;
  // Classic rows end the subject cell with a comment naming the item; responsive rows have a cell of their own.
  const subject=(row.match(/<td[^>]*>((?:(?!<td)[\s\S])*?)<\/td>\s*<!--\s*\d+\s*-->/i)?.[1]||cell(row,'tobetreff')).replace(/<span[^>]*title=["']Zusatzinfo["'][^>]*>[\s\S]*?<\/span>/gi,'');
  const title=text(subject);if(!title)continue;
  const paper=row.match(/<a\b[^>]*href=["']([^"']*vo020(?:_[a-z])?\.asp\?[^"']*?VOLFDNR=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i),item=subject.match(/href=["']([^"']*to020(?:_[a-z])?\.asp\?[^"']*)["']/i);
  // Classic pages name the result in the hint of the item's button; "(offen)" means none yet.
  const named=attribute(row.match(/<input\b[^>]*class=["']il1_naz["'][^>]*>/i)?.[0]||'','title').trim(),result=/^\(?offen\)?$/i.test(named)?'':named;
  const paperUrl=paper?address(paper[1],'VOLFDNR',paper[2],source):null,topUrl=item?address(item[1],'TOLFDNR',top,source):null,reference=paper?text(paper[3]):'';
  const status=date>today?(paperUrl?'consulting':'announced'):resultStatus(result,committee)||'unknown';
  const description=date>today?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':result?'Ergebnis laut Tagesordnung: '+result:'Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Abschnitt nicht belegt.';
  items.push({id:`${source.id}-${paper?'vo-'+paper[2]:'top-'+top}`,title,reference,sourceUrl:paperUrl||topUrl||url,identityLinks:[paperUrl,topUrl].filter(Boolean),status,documents:[],
   event:{date,committee,status,description,result,url,publicEvidence:`Tagesordnungsnummer „${number}“ im öffentlichen Teil`},agenda:{number,top,paperUrl}});
 }
 return {date,committee,items};
}
const FIELDS={vobetreff:'Betreff',vostatus:'Status',voart:'Vorlage-Art',voamt:'Federführend'};
/**
 * Paper page: descriptive fields, documents and the consultation sequence with the published result per meeting.
 * People (Bearbeiter/-in, Berichterstatter/in, Vorstand) and the embedded texts of the paper are not kept.
 */
export function parseAllris3Paper(html,source){
 // The texts of the paper follow as embedded documents, each announced by a comment "<!-- ### SV….rtf -->".
 const head=String(html).split(/<!--\s*###/)[0],fields=[];
 for(const [id,field] of Object.entries(FIELDS)){const value=text(byId(head,id));if(value&&value.length<1200)fields.push({field,value});}
 if(!fields.length)for(const m of head.matchAll(/<td[^>]*class=["']kb1["'][^>]*>\s*([^<:]+?):?\s*<\/td>\s*<td[^>]*class=["']text\d["'][^>]*>([\s\S]*?)<\/td>/gi)){const field=text(m[1]),value=text(m[2]);if(value&&value.length<1200&&/^(Betreff|Status|Vorlage-Art|Federführend|Datum|Aktenzeichen)$/i.test(field))fields.push({field,value});}
 const restricted=/nicht\s*-?\s*öffentlich/i.test(fields.find(f=>f.field==='Status')?.value||''),documents=[];
 const keep=(target,values,title)=>{
  if(!values.DOLFDNR)return;const u=new URL(decode(target),source.base);u.search='?'+['DOLFDNR','options','typ'].filter(k=>values[k]).map(k=>k+'='+encodeURIComponent(values[k])).join('&');u.hash='';
  try{documents.push({title:title||'Originalunterlage',url:allowed(u.href,source),kind:'application/pdf'});}catch{/* foreign host */}
 };
 if(!restricted){
  // Responsive pages link the documents; classic pages send a form to the same program.
  const panel=head.match(/<aside[^>]*id=["']dokumenteHeaderPanel["'][\s\S]*?<\/aside>/i)?.[0]||'';
  for(const m of panel.matchAll(/<a\b([^>]*?)href=["']([^"']*do027\.asp\?[^"']*)["']([^>]*)>([\s\S]*?)<\/a>/gi)){
   const attributes=m[1]+m[3];if(/class=["'][^"']*\bdisable\b/.test(attributes))continue;
   const values=Object.fromEntries(new URL(decode(m[2]),source.base).searchParams);
   keep(m[2],values,decode(attributes.match(/data-simpletooltip-text=["']([^"']*)/)?.[1]||'').match(/['"„‚]([^'"“‘]+)['"“‘] in neuem Fenster/)?.[1]||text(m[4]));
  }
  for(const f of head.matchAll(/<form\b[^>]*action=["']([^"']*do027\.asp)["'][^>]*>([\s\S]*?)<\/form>/gi)){
   const inputs=[...f[2].matchAll(/<input\b[^>]*>/gi)].map(i=>i[0]),values={};
   for(const tag of inputs)if(/type=["']hidden["']/i.test(tag))values[attribute(tag,'name')]=attribute(tag,'value');
   keep(f[1],values,attribute(inputs.find(tag=>/type=["']submit["']/i.test(tag))||'','value'));
  }
 }
 // Responsive pages: table bfTable with a "Beschluss" column. Classic pages: a nested table in which a row naming the
 // committee is followed by the row of its meeting (date, link, result in td.text3).
 const consultations=[],bf=table(head,'bfTable');
 const column=bf?[...(bf.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i)?.[1]||'').matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].findIndex(h=>/^Beschluss/i.test(text(h[1]))):-1;
 for(const row of rows(bf||head)){
  const link=row.match(/<a\b[^>]*href=["']([^"']*to010(?:_[a-z])?\.asp\?[^"']*SILFDNR=\d+[^"']*)["']/i);if(!link)continue;
  const target=decode(link[1]),top=record(target,'TOLFDNR')||row.match(/topSelected=(\d+)/i)?.[1]||row.match(/to020(?:_[a-z])?\.asp\?[^"']*?TOLFDNR=(\d+)/i)?.[1]||row.match(/name=["']TOLFDNR["'][^>]*value=["'](\d+)/i)?.[1]||null;
  const result=bf?[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c=>text(c[1]))[column<0?3:column]||'':text(cell(row,'text3'));
  consultations.push({meeting:record(target,'SILFDNR'),top,date:day(text(row)),result});
 }
 return {fields,documents,consultations,restricted};
}
/**
 * Reads one ALLRIS 3 installation. source: {id, name, kind, base, calendar?}; without calendar, <base>allris.net.asp is
 * read once and the calendar program is taken from its menu. marks (optional): what earlier imports read completely,
 * see meeting-marks.mjs. checkOparl: ask <base>oparl/1.0/system.asp first; if it answers as an OParl system, the pages
 * are not read.
 */
export async function collectAllris3(source,{now=new Date(),get=fetchText,request=fetch,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks,checkOparl=false}={}){
 if(source.calendar&&!CALENDAR.test(source.calendar))throw Error('Unbekanntes Kalenderprogramm: '+source.calendar);
 get=budgeted(get,maxDurationMs,2);const deadline=Date.now()+maxDurationMs;
 const from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10),issues=[],warnings=[],meetings=new Map();
 // One session per import, as a browser holds it; every answer opens one (ASPSESSIONID) for requests without it.
 const send=declaredCharset(createSession(request).plain),refused=new Set();
 // halt: the reason why the system must not be asked any further in this import.
 let halt=null,denied=false;
 const read=async url=>{
  if(halt)throw Error(halt);
  const program=new URL(url).pathname.split('/').pop().toLowerCase();if(refused.has(program))throw Error(closed(program));
  // A request cut off by the end of the time budget is the budget, not a fault of the page.
  const html=await get(allowed(url,source),source,undefined,send).catch(e=>{throw Date.now()>=deadline&&/aborted|timeout/i.test(e.message)?Error('Zeitbudget der Quelle erreicht'):e;});
  if(/\/_gate\/|<altcha-widget/i.test(html))halt=GATE;
  else if(html.length<20000&&/zu viele zugriffe/i.test(text(html)))halt=REFUSAL;
  if(halt)throw Error(halt);
  if(refusedProgram(html)){refused.add(program);throw Error(closed(program));}
  return html;
 };
 if(checkOparl){let system=false;try{system=String(JSON.parse(await read(source.base+'oparl/1.0/system.asp')).type||'').endsWith('/System');}catch{/* no OParl system at this address */}if(system)throw Error('OParl vorhanden; Adapterfreigabe erforderlich.');}
 let calendar=source.calendar||null;
 // The start page may also forward to the calendar itself; its links then name the program as well.
 if(!calendar&&!halt){try{calendar=calendarProgram(await read(source.base+'allris.net.asp'),source.base);if(!calendar)issues.push('Startseite allris.net.asp nennt keinen Sitzungskalender.');}catch(e){if(e.message!==halt)issues.push('Startseite allris.net.asp: '+e.message);}}
 const month=async offset=>{
  if(denied||halt||!calendar)return;
  const date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+offset,1)),year=date.getUTCFullYear(),number=date.getUTCMonth()+1;
  try{
   const found=parseAllris3Calendar(await read(source.base+`${calendar}?MM=${number}&YY=${year}`),source,{year,month:number});
   if(!found)throw Error('Unbekanntes Kalenderformat');
   for(const m of found)if(m.date>=fromDay)meetings.set(m.url,m);
  // A refusal, an unknown page or a missing program is not going to differ for the other months.
  }catch(e){if(e.message!==halt)issues.push(`Kalender ${number}/${year}: ${e.message}`);if(/HTTP 4\d\d|Kalenderformat|nicht freigegeben/.test(e.message))denied=true;}
 };
 // Calendar months cover the selected look-back window and already published meetings of the next month, one after
 // the other: the first opens the session.
 for(const offset of Array.from({length:calendarMonthsBack(now,from)+2},(_,i)=>1-i))await month(offset);
 const grouped=new Map(),papers=new Map(),held={};let count=0,unchanged=0,done=0,unread=0,upcoming=0;
 const paper=url=>{if(!papers.has(url))papers.set(url,read(url).then(html=>parseAllris3Paper(html,source)));return papers.get(url);};
 // At most MAX_MEETINGS meetings are read per import. Meetings that were read a moment ago do not count, so an
 // import that is continued gets past them and a long period is read in several parts.
 let fetched=0,beyond=0;
 await parallel([...meetings.values()].sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date)),async m=>{
  if(halt)return;
  const known=usableMark(marks,m,now);
  // Read completely a moment ago: an import that ran out of time continues behind it without asking again.
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;count++;return;}
  if(fetched>=MAX_MEETINGS){beyond++;return;}fetched++;
  try{
   const html=await read(m.url),agenda=parseAllris3Agenda(html,m,source,now);
   // A scheduled meeting without an agenda has nothing public to read yet. A past meeting shown with its basic data
   // but without an agenda was published that way: a remark, not a gap. An unrecognisable page is a gap.
   if(!agenda){if(m.date>today)upcoming++;else if(/id=["']si(?:datum|gremium)["']|class=["']kb1["'][^>]*>\s*(?:Gremium|Datum):/i.test(html))warnings.push('Sitzung ohne veröffentlichte Tagesordnung: '+m.url);else issues.push('Keine lesbare öffentliche Tagesordnung: '+m.url);return;}
   const rows=agenda.items,print=(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.reference,r.event.result,r.agenda.number])))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;count++;return;}
   let cut=false,complete=true;const meeting=record(m.url,'SILFDNR');
   for(const row of rows){
    const {number,top,paperUrl}=row.agenda;delete row.agenda;
    row.sourceData={version:'public-source-fields-v1',method:'allris3',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:{reference:row.reference,title:row.title,number,result:row.event.result}}],detailStatus:'completed',issues:[]};
    if(paperUrl){
     try{const detail=await paper(paperUrl);
      row.documents.push(...detail.documents);row.sourceData.records.push({kind:'paper',url:paperUrl,fields:detail.fields});
      // Responsive pages print no result on the agenda; the consultation sequence of the paper names it.
      const own=detail.consultations.find(c=>c.top?c.top===top:c.meeting===meeting);
      if(own?.result&&!row.event.result&&agenda.date<=today){row.event.result=own.result;row.event.description='Ergebnis laut Beratungsfolge: '+own.result;row.event.status=row.status=resultStatus(own.result,agenda.committee)||row.status;}
     }catch(e){row.sourceData.detailStatus='partial';row.sourceData.issues.push(e.message);complete=false;if(/Zeitbudget/.test(e.message)||e.message===halt)cut=true;else issues.push('Vorlagendetails: '+e.message);}
    }
    row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
    const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);previous.identityLinks.push(...row.identityLinks);}else grouped.set(row.id,{...row,events:[row.event]});
   }
   // A meeting counts as read only if every paper page behind it could be read.
   if(cut)unread++;else if(complete){held[m.url]=newMark({...m,date:agenda.date},print,now,rows.length);done++;}
  }catch(e){if(/Zeitbudget/.test(e.message)||e.message===halt)unread++;else issues.push(refused.size&&/nicht freigegeben/.test(e.message)?e.message:m.url+': '+e.message);}
  count++;onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
 },2);
 if(halt)issues.push(halt+(unread?` ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`:''));
 else if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(beyond&&!halt)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),identityLinks:[...new Set(row.identityLinks)],documents:[...new Map([...row.documents,{title:'Vorlage / öffentliche Tagesordnung',url:row.sourceUrl,kind:'html'}].map(d=>[d.url,d])).values()]};
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche ALLRIS-net-Seite (ALLRIS 3); nur Tagesordnungspunkte des öffentlichen Teils.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 const listed=meetings.size-upcoming,found=[...new Set(issues)];
 // Unchanged meetings are a successful reading: their reports are in the database already.
 // After a halt nothing is resumed automatically: the next import is the next attempt.
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:listed,...(upcoming?{upcomingWithoutAgenda:upcoming}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...((unread||beyond)&&!halt?{resumable:true}:{}),...(warnings.length?{warnings}:{}),sourceCount:1,quiet:listed===0&&found.length===0,complete:found.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged?found:[...found,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
