import {sourceDecision} from './source-fields.mjs';
import {windowStart,calendarMonthsBack} from './history-window.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text,decode,MAX_MEETINGS} from './sessionnet.mjs';
import {resultStatus} from './sdnet.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
import {committeePart} from './oparl-regional.mjs';
// Public pages of ALLRIS 4 (CC e-gov), for areas whose OParl interface is not switched on. Read are the monthly
// calendar (si010), the agenda of each meeting (to010) and the page of each paper on a public agenda (vo020).
//
// - The calendar page shows its rows only after it has been displayed: the page then asks for them with a second
//   request in the same session. The reader does the same and nothing else of that kind: no search forms, no
//   expanding of rows, no login.
// - One session per import, as a browser holds it. A request without the session cookie opens a new session on the
//   server; systems hosted for many municipalities answer a handful of those with "Zu viele Zugriffe aus Ihrem
//   Netzwerk". When a system says so, reading ends at once; it is neither retried nor worked around.
// - Some systems put the vendor's access check against automated requests in front of their pages ("Zugriff
//   pruefen"). That is respected the same way: reading ends, the check is not solved.
// - Only agenda items of the public part are taken. Some systems also print the titles of the non-public part.
const day=value=>{const m=String(value).match(/(\d{2})\.(\d{2})\.(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:null;};
const cell=(row,name)=>row.match(new RegExp(`<td[^>]*class=["'](?:[^"']*\\s)?${name}(?:\\s[^"']*)?["'][^>]*>([\\s\\S]*?)<\\/td>`,'i'))?.[1]||'';
const byId=(html,id)=>html.match(new RegExp(`<span[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/span>`,'i'))?.[1]||'';
// Record number in an address; inside HTML the parameters are separated by "&amp;".
const record=(address,name)=>String(address).match(new RegExp(`[?&;]${name}=(\\d+)`))?.[1]||null;
const anchor=(html,page)=>html.match(new RegExp(`<a\\b[^>]*href=["']([^"']*${page}\\?[^"']*)["'][^>]*>([\\s\\S]*?)<\\/a>`,'i'));
const REFUSAL='Quelle meldet zu viele Zugriffe und sperrt vorübergehend; Abruf beendet.';
const GATE='Quelle verlangt eine Zugriffsprüfung gegen automatisierte Abrufe; sie wird nicht umgangen. Abruf beendet.';
/**
 * Cookies of one import. plain and follow(base) are request functions for fetchText: every answer's cookies go along
 * with the later requests. They are sent to the approved source only, because fetchText checks every address.
 * follow(base) marks the request as the follow-up request of the page `base`, the way the page itself sends it.
 */
export function createSession(request=fetch){
 const jar=new Map();
 const send=extra=>async(url,init={})=>{
  const r=await request(url,{...init,headers:{...init.headers,'Accept-Language':'de-DE,de;q=0.9',...extra,...(jar.size?{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')}:{})}});
  for(const c of r.headers.getSetCookie?.()||[]){const m=c.match(/^\s*([^=;\s]+)=([^;]*)/);if(m)jar.set(m[1],m[2]);}
  return r;
 };
 return {plain:send({}),follow:base=>send({'Wicket-Ajax':'true','Wicket-Ajax-BaseURL':base,'X-Requested-With':'XMLHttpRequest'})};
}
/** Address of the rows a calendar page asks for after it has been displayed; null if the page names none. */
export function listAddress(html,pageUrl,source){
 const found=[...html.matchAll(/"u":"([^"]+)"/g)].map(m=>m[1]).find(u=>/si010\?\d+-\d+\.\d+-(?:&|$)/.test(u));
 return found?allowed(new URL(found,pageUrl).href,source):null;
}
/** Meetings of one calendar month. Every row links the agenda of its meeting; the hint of the link names the day. */
export function calendarMeetings(list,source,{year,month}={}){
 const meetings=[];let dom=null;
 for(const row of list.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  dom=row[1].match(/class=["']dom["'][^>]*>\s*(\d{1,2})/)?.[1]||dom;
  for(const m of row[1].matchAll(/<a\b([^>]*?)href=["']([^"']*to010\?[^"']*)["']([^>]*)>([\s\S]*?)<\/a>/gi)){
   const id=record(decode(m[2]),'SILFDNR');if(!id)continue;
   const date=day(decode((m[1]+m[3]).match(/data-simpletooltip-text=["']([^"']*)/)?.[1]||''))||(year&&month&&dom?`${year}-${String(month).padStart(2,'0')}-${dom.padStart(2,'0')}`:null);
   if(date)meetings.push({url:allowed(source.base+'to010?SILFDNR='+id,source),date,name:text(m[4])});
  }
 }
 return meetings;
}
/**
 * Public agenda items of one meeting page; null if the page shows no agenda.
 * Public is an item numbered "Ö …". Without such numbers the heading of the part decides ("Öffentlicher Teil").
 * Everything below a heading of the non-public part is skipped, whatever it is numbered.
 */
export function parseAllrisAgenda(html,meeting,source,now=new Date()){
 const table=html.match(/<table[^>]*class=["'][^"']*\btoTable\b[^"']*["'][\s\S]*?<\/table>/i)?.[0];if(!table)return null;
 const heading=text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
 const date=day(text(byId(html,'sidatum')))||day(heading)||meeting.date;
 const committee=text(byId(html,'sigremium'))||heading.replace(/\s*-\s*\d{2}\.\d{2}\.\d{4}.*$/,'')||meeting.name||'Öffentliche Sitzung';
 const today=now.toISOString().slice(0,10),url=meeting.url,items=[];let open=null;
 for(const m of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const row=m[1],subject=cell(row,'tobetreff'),top=row.match(/id=["'](?:betreff|link)_(\d+)["']/)?.[1];
  if(!top){const part=text(subject);if(/nicht\s*-?\s*öffentlich/i.test(part))open=false;else if(/öffentlich/i.test(part))open=true;continue;}
  const number=text(cell(row,'tonr')),paper=anchor(cell(row,'tovonr'),'vo020'),paperId=paper&&record(decode(paper[1]),'VOLFDNR');
  if(open===false||!(/^Ö\s*\d/i.test(number)||open===true&&(number?/^\d/.test(number):paperId)))continue;
  const title=text(subject.match(/<a\b[^>]*id=["']betreff_\d+["'][^>]*>([\s\S]*?)<\/a>/i)?.[1]||subject);if(!title)continue;
  const result=text(cell(row,'tobanr')),reference=paper?text(paper[2]):'';
  const paperUrl=paperId?allowed(source.base+'vo020?VOLFDNR='+paperId,source):null,topUrl=anchor(subject,'to020')?allowed(source.base+'to020?TOLFDNR='+top,source):null;
  const status=date>today?(paperId?'consulting':'announced'):resultStatus(result,committee)||'unknown';
  const description=date>today?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':result?'Ergebnis laut Tagesordnung: '+result:'Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Abschnitt nicht belegt.';
  items.push({id:`${source.id}-${paperId?'vo-'+paperId:'top-'+top}`,title,reference,sourceUrl:paperUrl||topUrl||url,identityLinks:[paperUrl,topUrl].filter(Boolean),status,documents:[],
   event:{date,committee,status,description,result,url,publicEvidence:/^Ö/i.test(number)?`Tagesordnungsnummer „${number}“ im öffentlichen Teil`:'Abschnitt „Öffentlicher Teil“ der Tagesordnung'},
   agenda:{number,top,role:text(cell(row,'tozunr')),paperUrl}});
 }
 return {date,committee,items};
}
/**
 * Paper page: descriptive fields, the documents and the consultation sequence with the published result per meeting.
 * Attachments are linked through the page's session only and have no address of their own; the collected document
 * ("Sammeldokument") contains them. The text of the paper shown on the page is not kept.
 */
export function parseAllrisPaper(html,source){
 const fields=[];
 for(const m of html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)){const field=text(m[1]).replace(/:$/,''),value=text(m[2]);if(value&&value.length<1200&&/^(Betreff|Status|Vorlageart|Federführend|Datum|Aktenzeichen)$/i.test(field))fields.push({field,value});}
 const restricted=/nicht\s*-?\s*öffentlich/i.test(text(byId(html,'vostatus'))),documents=[];
 const panel=restricted?'':html.match(/<aside[^>]*id=["']dokumenteHeaderPanel["'][\s\S]*?<\/aside>/i)?.[0]||'';
 for(const m of panel.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)){
  const attributes=m[1]+m[3],address=decode(m[2]);
  if(!/\/doc\d+\.pdf$/i.test(address)||/class=["'][^"']*\bdisable\b/.test(attributes))continue;
  const hint=decode(attributes.match(/data-simpletooltip-text=["']([^"']*)/)?.[1]||'').match(/['"„‚]([^'"“‘]+)['"“‘] in neuem Fenster/)?.[1];
  try{documents.push({title:hint||text(m[4])||'Originalunterlage',url:allowed(new URL(address,source.base).href,source),kind:'application/pdf'});}catch{/* foreign host */}
 }
 const table=html.match(/<table[^>]*class=["'][^"']*\bbfTable\b[^"']*["'][\s\S]*?<\/table>/i)?.[0]||'',consultations=[];
 const column=[...(table.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i)?.[1]||'').matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].findIndex(h=>/^Beschluss/i.test(text(h[1])));
 for(const m of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const link=anchor(m[1],'to010');if(!link)continue;
  const cells=[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c=>text(c[1])),address=decode(link[1]);
  consultations.push({meeting:record(address,'SILFDNR'),top:record(address,'TOLFDNR'),result:cells[column<0?3:column]||''});
 }
 return {fields,documents,consultations,restricted};
}
// marks (optional): what earlier imports read completely, see meeting-marks.mjs.
// checkOparl: ask the system's own OParl address first; if it answers as an OParl system, the pages are not read.
export async function collectAllris(source,{now=new Date(),get=fetchText,request=fetch,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks,checkOparl=false}={}){
 get=budgeted(get,maxDurationMs,2);const deadline=Date.now()+maxDurationMs;
 const from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10),issues=[],warnings=[],meetings=new Map(),part=committeePart(source.organizations),session=createSession(request);
 // halt: the reason why the system must not be asked any further in this import.
 let halt=null,denied=false;
 const read=async(url,followUpOf)=>{
  if(halt)throw Error(halt);
  // A request cut off by the end of the time budget is the budget, not a fault of the page.
  const html=await get(allowed(url,source),source,undefined,followUpOf?session.follow(followUpOf):session.plain).catch(e=>{throw Date.now()>=deadline&&/aborted|timeout/i.test(e.message)?Error('Zeitbudget der Quelle erreicht'):e;});
  if(/\/_gate\/|<altcha-widget/i.test(html))halt=GATE;
  else if(/zu viele zugriffe/i.test(text(html.match(/class=["']message_text["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]||'')))halt=REFUSAL;
  if(halt)throw Error(halt);
  return html;
 };
 const month=async offset=>{
  if(denied||halt)return;
  const date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+offset,1)),year=date.getUTCFullYear(),number=date.getUTCMonth()+1,page=`si010?MM=${number}&YY=${year}`;
  try{
   const html=await read(source.base+page),address=listAddress(html,source.base+page,source);
   // Either the page names where its rows come from, or (older versions) it carries the calendar table itself.
   if(!/allris/i.test(html)||!address&&!/calenderView/.test(html))throw Error('Unbekanntes Kalenderformat');
   const rows=address?await read(address,page):html;
   // Without the session of the page the follow-up request is answered empty.
   if(address&&!/<table/i.test(rows))throw Error('Kalenderliste ohne Inhalt');
   for(const m of calendarMeetings(rows,source,{year,month:number}))if(m.date>=fromDay&&part.keep(m.name,m.url))meetings.set(m.url,m);
  // A refusal, an unknown page or a missing list is not going to differ for the other months.
  }catch(e){if(e.message!==halt)issues.push(`Kalender ${number}/${year}: ${e.message}`);if(/HTTP 4\d\d|Kalenderformat|ohne Inhalt/.test(e.message))denied=true;}
 };
 // Order of sources: OParl where it works. The system's own OParl address is asked in the same session as the pages.
 if(checkOparl){let system=false;try{system=String(JSON.parse(await read(source.base+'oparl/system')).type||'').endsWith('/System');}catch{/* no OParl system at this address */}if(system)throw Error('OParl vorhanden; Adapterfreigabe erforderlich.');}
 // Calendar months cover the selected look-back window and already published meetings of the next month.
 // One after the other: the first opens the session, and the system keeps a calendar page for its follow-up
 // request reliably only while no other page of the same session is being built.
 for(const offset of Array.from({length:calendarMonthsBack(now,from)+2},(_,i)=>1-i))await month(offset);
 const grouped=new Map(),papers=new Map(),held={};let count=0,unchanged=0,done=0,unread=0,upcoming=0;
 const paper=url=>{if(!papers.has(url))papers.set(url,read(url).then(html=>parseAllrisPaper(html,source)));return papers.get(url);};
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
   const html=await read(m.url),agenda=parseAllrisAgenda(html,m,source,now);
   if(agenda&&part.excluded(agenda.committee,m.url)){count++;return;}
   // A scheduled meeting without an agenda has nothing public to read yet. A past meeting that the system shows with
   // its basic data but without an agenda was published that way (some committees never publish one): a remark,
   // not a gap. A page that is not recognisable as a meeting page is a gap.
   if(!agenda){if(m.date>today)upcoming++;else if(/id=["']si(?:datum|gremium)["']/.test(html))warnings.push('Sitzung ohne veröffentlichte Tagesordnung: '+m.url);else issues.push('Keine lesbare öffentliche Tagesordnung: '+m.url);return;}
   const rows=agenda.items,print=(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.reference,r.event.result,r.agenda.number,r.agenda.role])))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;count++;return;}
   let cut=false,complete=true;
   for(const row of rows){
    const {number,top,role,paperUrl}=row.agenda;delete row.agenda;
    row.sourceData={version:'public-source-fields-v1',method:'allris',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:{reference:row.reference,title:row.title,number,role,result:row.event.result}}],detailStatus:'completed',issues:[]};
    if(paperUrl){
     try{const detail=await paper(paperUrl);
      row.documents.push(...detail.documents);row.sourceData.records.push({kind:'paper',url:paperUrl,fields:detail.fields});
      // Systems that print no result on the agenda name it in the consultation sequence of the paper.
      const own=detail.consultations.find(c=>c.top===top);
      if(own?.result&&!row.event.result&&agenda.date<=today){row.event.result=own.result;row.event.description='Ergebnis laut Beratungsfolge: '+own.result;row.event.status=row.status=resultStatus(own.result,agenda.committee)||row.status;}
     }catch(e){row.sourceData.detailStatus='partial';row.sourceData.issues.push(e.message);complete=false;if(/Zeitbudget/.test(e.message)||e.message===halt)cut=true;else issues.push('Vorlagendetails: '+e.message);}
    }
    row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
    const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);previous.identityLinks.push(...row.identityLinks);}else grouped.set(row.id,{...row,events:[row.event]});
   }
   // A meeting counts as read only if every paper page behind it could be read.
   if(cut)unread++;else if(complete){held[m.url]=newMark({...m,date:agenda.date},print,now,rows.length);done++;}
  }catch(e){if(/Zeitbudget/.test(e.message)||e.message===halt)unread++;else issues.push(m.url+': '+e.message);}
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
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche ALLRIS-Seite; nur Tagesordnungspunkte des öffentlichen Teils.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 const listed=meetings.size-upcoming;
 // Unchanged meetings are a successful reading: their reports are in the database already.
 // After a halt nothing is resumed automatically: the next import is the next attempt.
 warnings.push(...part.warnings());
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:listed,...(upcoming?{upcomingWithoutAgenda:upcoming}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...((unread||beyond)&&!halt?{resumable:true}:{}),...(warnings.length?{warnings}:{}),sourceCount:1,quiet:listed===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
