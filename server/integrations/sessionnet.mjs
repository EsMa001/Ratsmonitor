import {parseAttendance} from './sessionnet-details.mjs';
import {sourceDecision,DECIDING_BODY} from './source-fields.mjs';
import {windowStart,calendarMonthsBack} from './history-window.mjs';
import {budgeted,paced,isRejectionPage,REFUSED,statusError} from './request-budget.mjs';
import {SOURCE_USER_AGENT} from './no-redirect.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {hash,category,sourceSummary,parallel} from './oparl.mjs';
import {committeePart} from './oparl-regional.mjs';
const entities={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',ouml:'ö',auml:'ä',uuml:'ü',Ouml:'Ö',Auml:'Ä',Uuml:'Ü',szlig:'ß',ndash:'-',mdash:'-'};
export function decode(s){return String(s||'').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi,(m,k)=>k[0]==='#'?String.fromCodePoint(k[1].toLowerCase()==='x'?parseInt(k.slice(2),16):Number(k.slice(1))):entities[k]??m)}
export function text(s){return decode(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim()}
// A link that is no valid address (a broken "http://" in a template) is left out; it does not end the reading of a page.
export function links(h,base){return [...h.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)].flatMap(m=>{let url;try{url=new URL(decode(m[2]),base).href;}catch{return [];}return [{url,label:text(m[4]),title:decode((m[1]+m[3]).match(/(?:aria-label|title)=["']([^"']*)/)?.[1]||'')}];});}
// https only; plain http solely for an entry with allowHttp:true whose own base is http, and only for exactly that origin (redirects pass through here too).
export function allowed(url,source){const u=new URL(url),b=new URL(source.base);if(!(u.protocol==='https:'||(u.protocol==='http:'&&source.allowHttp===true&&b.protocol==='http:'))||u.origin!==b.origin||!u.pathname.toLowerCase().startsWith(b.pathname.toLowerCase())||u.username||u.password)throw Error('Nicht freigegebene Quelladresse');return u.href;}
export const SESSIONNET_LOGIN='Nur Mitgliederbereich (Anmeldung), kein öffentlicher Teil',SESSIONNET_ERROR='SessionNet-Fehlerseite',SESSIONNET_SOURCE='SessionNet-Installation liefert Programmquelltext statt Seiten';
const UNKNOWN_CALENDAR='Unbekanntes Kalenderformat',SESSIONNET_PAGE=/\/(?:[a-z]{2}\d{4}|info)\.(?:asp|php)$/i,closedPage=e=>e.message===SESSIONNET_LOGIN||e.message===SESSIONNET_ERROR;
/** Why a page of a SessionNet installation holds nothing public: its login page, its error page or unprocessed program code. */
export function sessionNetPageIssue(html){
 const h=String(html||'');
 if(/smc-pagetype-logon|\bsmc_page_ylogon_/i.test(h))return SESSIONNET_LOGIN;
 if(/\bsmc_page_error_|<title>[^<]*SessionNet Fehlermeldung/i.test(h))return SESSIONNET_ERROR;
 if(/^\s*<\?(?!xml)/i.test(h))return SESSIONNET_SOURCE;
 return null;
}
/**
 * A page of SessionNet itself: it names its version in its head (meta "sessionnet", meta content "SessionNet Version …")
 * or carries the page class smc_page_<page>_…. A CMS page that only echoes a requested address such as …/si0040.asp, or
 * mentions the product in its text, carries none of them.
 * null for any other page; otherwise version, part (bi public, ri members), layout, page name and the issue of a login or error page.
 */
export function sessionNetLandmark(html){
 const h=String(html||''),generator=[...h.matchAll(/<meta\b[^>]*>/gi)].map(m=>m[0].match(/\bcontent=["'][^"']*?SessionNet Version (\d[\d.]*)(?:[^"']*?\b(bi|ri|gi)\b)?(?:[^"']*?\(Layout (\d+)\))?/i)).find(Boolean);
 const page=h.match(/<[a-z]+\b[^>]*\b(?:class|id)=["'][^"']*?\bsmc_page_([a-z]+\d*)_/i)?.[1];
 if(!generator&&!page&&!/<meta\b[^>]*\bname=["']sessionnet["']/i.test(h))return null;
 return {version:generator?.[1]||null,part:generator?.[2]?.toLowerCase()||null,layout:generator?.[3]?Number(generator[3]):null,page:page||null,issue:sessionNetPageIssue(h)};
}
/** Clients (Mandanten) offered by the calendar of a system that serves several, with the calendar query that selects each. */
export function sessionNetClients(html){
 const clients=new Map();
 for(const m of String(html||'').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  if(!/smcfiltermenumandant/.test(m[1]))continue;const href=decode(m[1].match(/href=["']si0040\.(?:asp|php)\?([^"']*)/i)?.[1]||''),p=new URLSearchParams(href);
  const query=p.has('__cpanr')?'__cpanr='+p.get('__cpanr'):p.has('__cmandant')?'__cmandant='+p.get('__cmandant')+'&__cselect=0':null;
  if(query&&!clients.has(query))clients.set(query,{name:text(m[2]),query});
 }
 return [...clients.values()];
}
export async function fetchText(url,source,timeoutMs=20000,request=fetch){
 const deadline=Date.now()+timeoutMs,seen=new Set();let next=allowed(url,source);
 for(let hop=0;hop<=3;hop++){
  if(seen.has(next))throw Error('Wiederholte Weiterleitung der Quelle');seen.add(next);
  const remaining=deadline-Date.now();if(remaining<=0)throw Error('Zeitbudget der Quelle erreicht');
  const r=await request(next,{redirect:'manual',signal:AbortSignal.timeout(remaining),headers:{'User-Agent':SOURCE_USER_AGENT,'Accept':'text/html,application/json'}});
  if([301,302,303,307,308].includes(r.status)){
   const location=r.headers.get('location');await r.body?.cancel();
   if(!location)throw Error('Weiterleitung ohne Zieladresse');
   // SessionNet sends what is not public to its login page and a page it cannot show to its error page.
   const target=new URL(location,next).pathname;
   if(/\/ylogon\.(?:asp|php)$/i.test(target))throw Error(SESSIONNET_LOGIN);
   if(/\/error2?\.(?:asp|php)$/i.test(target)&&SESSIONNET_PAGE.test(new URL(next).pathname))throw Error(SESSIONNET_ERROR);
   if(hop===3)throw Error('Weiterleitungslimit der Quelle erreicht');
   next=allowed(new URL(location,next).href,source);continue;
  }
  if(!r.ok){await r.body?.cancel();throw statusError('Quelle antwortet mit HTTP ',r);}
  const b=await r.arrayBuffer();if(b.byteLength>4e6)throw Error('Quelldokument zu groß');const probe=new TextDecoder().decode(b.slice(0,2000));const latin=/charset=["']?(?:iso-8859-1|windows-1252)/i.test(r.headers.get('content-type')||'')||/charset=(?:iso-8859-1|windows-1252)/i.test(probe);
  const html=new TextDecoder(latin?'windows-1252':'utf-8').decode(b);
  // A firewall's rejection page is no content; it counts as a temporary refusal (not retried; the import stops and continues later, refusalGate).
  if(isRejectionPage(html))throw Error(REFUSED);
  return html;
 }
}
/** Meetings read in one import; a longer list is continued by the next import. */
export const MAX_MEETINGS=400;
export function missingAgendaIssue(html,url){return /Zu dieser Sitzung wurden noch keine Detailinformationen freigegeben/i.test(text(html))?'Sitzungsdetails noch nicht öffentlich freigegeben: '+url:'Keine lesbare öffentliche Tagesordnung: '+url;}
// Some installations link the calendar to the meeting overview (si0056); the agenda of the same meeting is si0057.
// Older layouts (SessionNet 4.9, 5.3) link their agenda page to0040 instead.
const ksinr=url=>new URL(url).searchParams.get('__ksinr');
/**
 * The client (Mandant) of each meeting in a calendar of a system that serves several (sessionnet.owl-it.de/altshausen:
 * the GVV and its member municipalities): ksinr → {panr, name} from the row's cell data-label="Mandant" (class pagel<n>).
 */
export function meetingClients(h){
 const out=new Map();
 for(const row of String(h||'').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cell=row[1].match(/<td\b[^>]*data-label=["']Mandant["'][^>]*class=["'][^"']*\bpagel(\d+)\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/i)||row[1].match(/<td\b[^>]*class=["'][^"']*\bpagel(\d+)\b[^"']*["'][^>]*data-label=["']Mandant["'][^>]*>([\s\S]*?)<\/td>/i);
  if(!cell)continue;
  for(const link of row[1].matchAll(/(?:si005[067]|to0040)\.(?:asp|php)\?[^"']*__ksinr=(\d+)/gi))out.set(link[1],{panr:cell[1],name:text(cell[2])});
 }
 return out;
}
export function meetingRows(h,base){
 const rows=links(h,base).filter(l=>/(?:si005[067]|to0040)\.(asp|php)/.test(l.url)&&/\d{2}\.\d{2}\.\d{4}/.test(l.title)).map(l=>{const date=l.title.match(/(\d{2})\.(\d{2})\.(\d{4})/);return {...l,url:l.url.replace(/si005[06]\.(asp|php)/,'si0057.$1'),date:`${date[3]}-${date[2]}-${date[1]}`,committee:l.title.replace(/^Details anzeigen:\s*/,'').replace(/\s*\d{2}\.\d{2}\.\d{4}.*/,'')};});
 // Only a meeting number joins two links; links without one are never taken for the same meeting.
 const tables=new Set(rows.filter(r=>/si0057\./.test(r.url)).map(r=>ksinr(r.url)).filter(Boolean));
 return rows.filter(r=>!/to0040\./.test(r.url)||!tables.has(ksinr(r.url)));
}
// Status of an agenda item from the published decision; only a deciding body's decision is final (DECIDING_BODY).
function itemStatus(decision,meeting,paper,now){
 if(meeting.date>now.toISOString().slice(0,10))return paper?'consulting':'announced';
 if(/vertagt|zurückgestellt|abgesetzt/i.test(decision))return 'postponed';
 if(/kenntnis/i.test(decision))return 'info';
 if(/empfohl/i.test(decision))return 'recommended';
 if(/beschlossen|zugestimmt|angenommen|abgelehnt/i.test(decision))return DECIDING_BODY.test(meeting.committee)?(/abgelehnt/i.test(decision)?'rejected':'approved'):'recommended';
 return 'unknown';
}
function agendaItem({number,title,paper,top,decision,all},meeting,source,now){
 const status=itemStatus(decision,meeting,paper,now);
 const url=paper?.url||top?.url||meeting.url;const key=paper?new URL(paper.url).searchParams.get('__kvonr'):new URL(meeting.url).searchParams.get('__ksinr')+'-'+number.replace(/\D+/g,'-');
 return {id:`${source.id}-${paper?'vo':'top'}-${key}`,title,reference:paper?.label||'',sourceUrl:url,identityLinks:[paper?.url,top?.url].filter(Boolean),status,documents:[...new Map(all.filter(l=>/getfile\.|\/getfile|\.pdf/i.test(l.url)).flatMap(l=>{try{return [[l.url,{title:l.label||'Originalunterlage',url:allowed(l.url,source),kind:'application/pdf'}]];}catch{return [];/* outside the source */}})).values()],event:{date:meeting.date,committee:meeting.committee,status,description:decision||'Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Abschnitt nicht belegt.',result:decision,url:meeting.url}};
}
export function parseAgenda(h,meeting,source,now=new Date()){
 const result=[];
 for(const m of h.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const row=m[1];if(!/class=["'][^"']*tofnum/.test(row))continue;
  const number=text(row.match(/<td[^>]*class=["'][^"']*tofnum[^"']*["'][^>]*>([\s\S]*?)<\/td>/)?.[1]);
  if(!/^Ö\s+\d/.test(number))continue;
  const all=links(row,source.base),paper=all.find(l=>/vo0050\.(asp|php)/.test(l.url)),top=all.find(l=>/to0050\.(asp|php)/.test(l.url));
  const cell=row.match(/<td[^>]*class=["'][^"']*(?:tolink|tobetr)[^"']*["'][^>]*>([\s\S]*?)<\/td>/)?.[1]||'';
  const title=text(cell.match(/<div[^>]*smc-card-header-title[^>]*>([\s\S]*?)<\/div>/)?.[1]||cell.split(/Beschluss:|Abstimmung:/)[0]);
  if(!title)continue;
  const raw=text(cell),decision=raw.match(/Beschluss:\s*(.*?)(?:Abstimmung:|$)/)?.[1]?.trim()||'';
  result.push(agendaItem({number,title,paper,top,decision,all},meeting,source,now));
 }
 return result;
}
/**
 * Card layout of newer SessionNet installations: the agenda stands on the meeting page si0056 as one card per item;
 * the table page si0057 leads to an error page there. The same rules apply: only items numbered "Ö …" are taken.
 * A card holds the number (badge), the title (first line of smc-card-text-title), the paper (vo0050), the documents
 * (getfile) and the decision (field smcdv0_box2_beschluss). The page footer after the last card is not part of it.
 */
export function parseAgendaCards(h,meeting,source,now=new Date()){
 const result=[];
 for(const card of String(h).split(/<footer\b/i)[0].split(/<div class=["']card card-light/i).slice(1)){
  const number=text(card.match(/<span class=["']badge["']>([\s\S]*?)<\/span>/i)?.[1]);
  if(!/^Ö\s+\d/.test(number))continue;
  const title=text((card.match(/<div[^>]*smc-card-text-title[^>]*>([\s\S]*?)<\/div>/i)?.[1]||'').split(/<br\s*\/?>/i)[0]);
  if(!title)continue;
  const all=links(card,source.base),paper=all.find(l=>/vo0050\.(asp|php)/.test(l.url)),top=all.find(l=>/to0050\.(asp|php)/.test(l.url));
  const decision=text(card.match(/smcdv0_box2_beschluss[^>]*>([\s\S]*?)<\/p>/i)?.[1]||'').replace(/^Beschluss:\s*/i,'');
  result.push(agendaItem({number,title,paper,top,decision,all},meeting,source,now));
 }
 return result;
}
const cell=(row,name)=>row.match(new RegExp(`<td[^>]*class=["'][^"']*\\b${name}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/td>`,'i'))?.[1]||'';
// A row up to its own end: an item cell may hold a table of documents with rows of its own. Without its closing tag the
// row still ends where the next row or the end of its table begins.
const ownRow=chunk=>{let depth=0;for(const m of chunk.matchAll(/<(\/?)(table|tr)\b[^>]*>/gi)){const table=/table/i.test(m[2]);if(depth<=0&&(m[1]||!table))return chunk.slice(0,m.index);if(table)depth+=m[1]?-1:1;}return chunk;};
// A group row opens the public part only if it plainly says so; any other label ("Nicht öffentlicher Teil",
// "Vertraulicher Teil", "Geschlossene Sitzung", an unknown heading) ends it.
const publicPart=part=>/(?:^|[^a-zäöüß])(?:ö|oe)ffentlich/i.test(part)&&!/(?:^|[^a-zäöüß])(?:nicht|vertraulich|geheim|geschlossen)/i.test(part);
/**
 * Older layouts (SessionNet 4.9 and 5.3, Layout 4 and 5): the agenda page to0040 is a table with one row per item,
 * number (smc_tophn) and title (smc_topht), followed by result rows (smc_tophz, "Beschluss:"). Numbers usually carry no
 * "Ö"; the group rows decide: items below "Öffentlicher Teil" are taken, below any other group row none (publicPart).
 * The number gets the "Ö " of the table page si0057, so an item keeps its id whichever page it was read from.
 * The page footer after the table is not part of it.
 */
export function parseAgendaTopTable(h,meeting,source,now=new Date()){
 const result=[];let open=null,last=null;
 for(const chunk of String(h).split(/<footer\b|<div\b[^>]*\bid=["']smcfooter["']/i)[0].split(/<tr\b(?=[^>]*class=["'][^"']*(?:smc_toph|smc-table-group|smcrowh))/i).slice(1)){
  const end=chunk.indexOf('>'),head=chunk.slice(0,end),row=ownRow(chunk.slice(end+1));
  if(/smc-table-group|\bsmcrowh\b/.test(head)){open=publicPart(text(row));last=null;continue;}
  if(/\bsmc_tophz\b/.test(head)){const decision=text(row).match(/^Beschluss:\s*(.+)$/i)?.[1];if(last&&decision&&!last.decision)last.decision=decision;continue;}
  last=null;
  const number=text(cell(row,'smc_tophn')).match(/^(Ö\s*)?(\d+[a-z]?(?:\.\d+[a-z]?)*)/),title=text(cell(row,'smc_topht'));
  if(open===false||!number||!(open||number[1])||!title)continue;
  const all=links(row,source.base);
  last={number:'Ö '+number[2],title,paper:all.find(l=>/vo0050\.(asp|php)/.test(l.url)),top:all.find(l=>/to0050\.(asp|php)/.test(l.url)),decision:'',all};result.push(last);
 }
 return result.map(item=>agendaItem(item,meeting,source,now));
}
// marks (optional): what earlier imports read completely, see meeting-marks.mjs. The result then names the marks that
// hold after this import; the caller stores them once the reports are saved.
export async function collectSessionNet(source,{now=new Date(),get=fetchText,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 // After a rejection the source is asked more slowly (paced); the refused meeting is left for the next step.
 get=paced(budgeted(get,maxDurationMs,2));
 const from=windowStart(now,lookback);const fromDay=from.toISOString().slice(0,10),issues=[],meetings=new Map();
 // Calendar months cover the selected look-back window (default: rolling twelve months) and already published next-month meetings.
 let denied=false,readable=0,failing=0;
 const panr=new URLSearchParams(source.calendarQuery||'').get('__cpanr'),otherClients=new Set(),clientName=source.clientName?String(source.clientName).toLocaleLowerCase('de-DE'):'';
 // organizations (optional): the bodies of one member in a system that serves several without clients, by the name the
 // calendar gives each meeting (oparl-regional.mjs); a meeting the patterns do not assign is not read.
 const part=committeePart(source.organizations);
 await parallel(Array.from({length:calendarMonthsBack(now,from)+2},(_,i)=>1-i),async offset=>{
  if(denied)return;
  // calendarQuery (optional): selects the client of a system that serves several, e.g. "__cpanr=2" (see sessionNetClients).
  const date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+offset,1)),query=new URLSearchParams(source.calendarQuery||'');query.set('__cjahr',date.getUTCFullYear());query.set('__cmonat',date.getUTCMonth()+1);
  const url=source.base+`si0040.${source.extension}?`+query;
  // A login, error or broken page is said as such; a page without the landmark of SessionNet itself (a CMS page that
  // echoes the address or links the system) is no calendar, even if it names the product.
  try{const html=await get(url,source),closed=sessionNetPageIssue(html);if(closed)throw Error(closed);if(!sessionNetLandmark(html))throw Error(UNKNOWN_CALENDAR);readable++;
   // With a client selected (__cpanr), only meetings whose row names that client are taken; a meeting without the cell
   // (a list of next meetings, another layout) is left out: the part of a shared system is read fail closed.
   const owners=panr||clientName?meetingClients(html):null;
   for(const m of meetingRows(html,source.base)){if(m.date<fromDay)continue;if(owners){const o=owners.get(ksinr(m.url));if(clientName?!o||!o.name.toLocaleLowerCase('de-DE').includes(clientName):o?.panr!==panr){otherClients.add(m.url);continue;}}if(!part.keep(m.committee,m.url))continue;meetings.set(m.url,m);}}
  // Each named reason is said once. A login page or program code holds for every month; an error page or an unknown page
  // may concern one month only, so the other months are still read, unless the first three were all of that kind.
  catch(e){const named=[SESSIONNET_LOGIN,SESSIONNET_ERROR,SESSIONNET_SOURCE,UNKNOWN_CALENDAR].includes(e.message);if(!named||!issues.includes(e.message))issues.push(e.message);
   if(e.message===SESSIONNET_LOGIN||e.message===SESSIONNET_SOURCE||/403|401/.test(e.message)||(e.message===SESSIONNET_ERROR||e.message===UNKNOWN_CALENDAR)&&++failing>=3&&!readable)denied=true;}
 },3);
 const grouped=new Map();let count=0,unchanged=0,read=0,unread=0;const detailsCache=new Map(),held={};
 const detail=url=>{if(!detailsCache.has(url))detailsCache.set(url,get(url,source).then(html=>{const closed=sessionNetPageIssue(html);if(closed)throw Error(closed);return html;}));return detailsCache.get(url);};
 // A page that SessionNet answers with its error page holds no agenda: the next page of the meeting is asked instead.
 const agendaPage=url=>get(url,source).then(html=>sessionNetPageIssue(html)===SESSIONNET_ERROR?'':html,e=>{if(e.message===SESSIONNET_ERROR)return '';throw e;});
 // At most MAX_MEETINGS meetings are read per import. Meetings that were read a moment ago do not count, so an
 // import that is continued gets past them and a long period is read in several parts.
 let fetched=0,beyond=0,layout=null,refused=0;
 await parallel([...meetings.values()].sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date)),async m=>{
  const known=usableMark(marks,m,now);
  // Read completely a moment ago: an import that ran out of time continues behind it without asking again.
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;count++;return;}
  if(fetched>=MAX_MEETINGS){beyond++;return;}fetched++;
  try{
   // Agenda pages: the table page si0057; the meeting page si0056 with cards, where si0057 leads to the error page; the
   // agenda page to0040 of older layouts, linked by their calendar or the only one that answers when both others lead
   // to the error page. The page of the layout the last meeting was read from is asked first; if it cannot be read for
   // this meeting, the others follow, so one odd meeting does not decide for all later ones.
   const linked=/to0040\./.test(m.url),pages=linked?['to0040']:layout==='top'?['to0040','si0057','si0056']:layout==='cards'?['si0056','si0057','to0040']:['si0057','si0056','to0040'];
   let step,url,h,parse,shown='';
   for(step of pages){
    if(step==='to0040'&&step!==pages[0]&&shown)break;
    url=m.url.replace(/(?:si005[067]|to0040)\.(asp|php)/,step+'.$1');h=await agendaPage(url);shown||=h;
    parse=/tofnum/.test(h)?parseAgenda:/smc-card-text-title/.test(h)?parseAgendaCards:/smc_tophn/.test(h)?parseAgendaTopTable:null;
    if(parse)break;
   }
   if(!parse){issues.push(missingAgendaIssue(shown,m.url));return;}
   if(!linked)layout=step==='si0057'?null:step==='si0056'?'cards':'top';
   const meeting=url===m.url?m:{...m,url};
   let attendance=parseAttendance(h,meeting.url,now.toISOString());
   const attendanceUrl=links(h,source.base).find(l=>/to0045\.(asp|php)/i.test(l.url))?.url;
   const rows=parse(h,meeting,source,now);
   // Everything the agenda page says: items, results, linked papers and documents, attendance. If that is what it
   // said when the papers were last read, the pages behind it are not fetched again.
   const print=(await hash(JSON.stringify([rows.map(r=>[r.id,r.title,r.reference,r.event.result,r.identityLinks,r.documents.map(d=>d.url)]),attendance.status,attendance.people.length,attendanceUrl||'']))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;count++;return;}
   let cut=false,complete=true;
   // A page behind the login or the error page stays so: the item keeps what its agenda says, and is not read again for it.
   if(attendanceUrl&&attendance.status!=='available'){try{attendance=parseAttendance(await detail(attendanceUrl),attendanceUrl,now.toISOString());}catch(e){if(/Zeitbudget/.test(e.message))cut=true;else if(!closedPage(e))issues.push('Teilnahmeangaben: '+e.message);}}
   for(const row of rows){
    row.event.attendance=attendance;row.event.decision=sourceDecision(row.event);
    row.sourceData={version:'public-source-fields-v1',method:'sessionnet',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:row.sourceUrl,fields:{reference:row.reference,title:row.title,result:row.event.result}}],detailStatus:'completed',issues:[]};
    const detailUrl=row.identityLinks.find(url=>/vo0050\.(asp|php)/.test(url));
    if(detailUrl){try{const html=await detail(detailUrl);const all=links(html,source.base);for(const l of all.filter(l=>/getfile\.|\/getfile|\.pdf/i.test(l.url)))try{row.documents.push({title:l.label||l.title||'Originalunterlage',url:allowed(l.url,source),kind:'application/pdf'});}catch{/* outside the source, e.g. in the page footer */}
     // Preserve structured field/value rows. Never retain the entire page or a full text body.
     const pairs=[];for(const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const cells=[...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>text(m[1]));if(cells.length===2&&cells[0].length<100&&cells[1].length<1200&&/Vorlage|Aktenzeichen|Datum|Art|Betreff|Federführ|Zuständig|Status|Bereich/i.test(cells[0]))pairs.push({field:cells[0],value:cells[1]});}
     row.sourceData.records.push({kind:'paper',url:detailUrl,fields:pairs});
    }catch(e){row.sourceData.detailStatus='partial';row.sourceData.issues.push(e.message);if(!closedPage(e)){complete=false;if(/Zeitbudget|vorübergehend abgewiesen/.test(e.message))cut=true;else issues.push('Vorlagendetails: '+e.message);}}}
    const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);previous.identityLinks.push(...row.identityLinks);}else grouped.set(row.id,{...row,events:[row.event]});}
   // A meeting counts as read only if every paper page behind it could be read.
   if(cut)unread++;else if(complete){held[m.url]=newMark(m,print,now,rows.length);read++;}
  }catch(e){if(/Zeitbudget/.test(e.message))unread++;else if(e.message.includes(REFUSED))refused++;else issues.push(m.url+': '+e.message);}count++;onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
 },3);
 if(refused)issues.push(`Server wies ${refused} ${refused===1?'Sitzung':'Sitzungen'} vorübergehend ab; der nächste Schritt setzt dort fort.`);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(beyond)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),documents:[...new Map([...row.documents,{title:'Vorlage / öffentliche Tagesordnung',url:row.sourceUrl,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche SessionNet-Seite; konservative Statusauswertung.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 // Unchanged meetings are a successful reading: their reports are in the database already.
 const warnings=[...(otherClients.size?[`${otherClients.size} Sitzungen anderer Mandanten des gemeinsamen Systems ausgelassen.`]:[]),...part.warnings()];
 return {topics,marks:held,readMeetings:read,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:now.toISOString().slice(0,10),importedAt:now.toISOString(),meetings:meetings.size,...(warnings.length?{warnings}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||beyond||refused?{resumable:true}:{}),sourceCount:1,quiet:meetings.size===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
