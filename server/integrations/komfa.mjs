import {sourceDecision} from './source-fields.mjs';
import {windowStart} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted,paced,REFUSED} from './request-budget.mjs';
import {fetchText,allowed,text,decode,MAX_MEETINGS} from './sessionnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
import {committeePart} from './oparl-regional.mjs';
import {isNonPublicText,isNonPublicHeading} from './website-text.mjs';
// Public pages of KOMFA-RIS (kommunalfabrik, ris-<name>.komfa.de). Read are the month view of the calendar, through the
// link the calendar itself offers for the previous and the next month (action=cal&SetFilter=calstartdate&FilterValue=
// <first day>), and the agenda page of each meeting (action=to&id=<id>).
// - The agenda page prints the agenda as one table. A heading row opens the public part ("Öffentlicher Teil",
//   "I. öffentliche Sitzung"); a heading of the non-public part ("II. nichtöffentliche Sitzung …", whose item titles some
//   tenants print, Woldegk) or any other part ends it. Only items after a public heading are taken; a page without one
//   gives nothing (fail closed). A title that names the non-public part is not taken either.
// - Papers carry numbers ("63-26", "47/2026-224") and documents (action=dla&id=<n>, PDF), which are linked, not read.
//   The consultations of one paper in several meetings are joined by its number. The pages publish no results.
// - One system may serve an Amt and its member municipalities: the calendar names each meeting "<municipality>, <body>".
//   The prefix is dropped where it is the area itself; organizations (optional, oparl-regional.mjs) keeps the meetings of
//   one member by that name.
const MONTH_NAMES=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const day=value=>{const m=String(value).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:null;};
const fnv=value=>{let h=0x811c9dc5;for(const c of new TextEncoder().encode(value)){h^=c;h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,'0');};
const attribute=(tag,name)=>decode(String(tag).match(new RegExp(`\\b${name}=["']([^"']*)["']`,'i'))?.[1]||'');
// Typographic entities of the editor KOMFA uses ("&bdquo;Auenhöfe&ldquo;"), which the shared decode does not know.
const TYPOGRAPHIC={bdquo:'„',ldquo:'“',rdquo:'”',sbquo:'‚',lsquo:'‘',rsquo:'’',laquo:'«',raquo:'»',hellip:'…',euro:'€',sect:'§',eacute:'é',egrave:'è',agrave:'à',ccedil:'ç',bull:'•',middot:'·'};
const plain=html=>text(String(html||'').replace(/<br\s*\/?>/gi,' ').replace(/<\/div>\s*<div\b/gi,'</div> <div').replace(/&([a-z]+);/gi,(m,k)=>TYPOGRAPHIC[k]??m));
// Headings of the public part, compared without case, a leading number ("I.", "A)") and surrounding dashes or colons.
const PUBLIC_PART=/^(?:öffentlich|oeffentlich)(?:e[rs]?)?(?:\s+(?:teil|sitzung|sitzungsteil|tagesordnung))?(?:\s|$)/;
const partTitle=title=>String(title).toLowerCase().replace(/\s+/g,' ').replace(/^\s*(?:[a-z]|[ivx]+|\d+)\s*[.)]+\s*/,'').replace(/^[\s\-–—:.*]+|[\s\-–—:.*]+$/g,'');
const NAMES_PART=/(?:nicht|non)[\s-]*öffentlich|nichtoeffentlich|\böffentlich|\boeffentlich|\bteil\b/;
// The closing item of the public part; what follows it belongs to the next part.
const CLOSES_PUBLIC=/^(?:schlie(?:ß|ss)ung|schlie(?:ß|ss)en|ende)\s+(?:de[rs]\s+)?öffentlichen\s+(?:teil|sitzung|sitzungsteil)/;
// The public notice of a meeting among its documents: "Bekanntmachung-oeffentlich", "Bekanntmachung öffentlich".
const PUBLIC_NOTICE=/bekanntmachung[\s_-]*(?:ö|oe)ffentlich/i;
export const NOT_PUBLIC='Sitzung ohne öffentlichen Teil auf der Seite';
/** A page of KOMFA-RIS: the module komfaris and the vendor's mark. base: the folder of its index.php. */
export function detectKomfa(url,html=''){
 const page=String(html);
 if(!/module=komfaris/i.test(page)||!/kommunalfabrik|komfaris\.css/i.test(page))return null;
 let u;try{u=new URL(url);}catch{return null;}
 u.protocol='https:';
 return {base:u.origin+u.pathname.replace(/[^/]*$/,'')};
}
/** The month view of the calendar for a month (1-12), as the calendar links it. */
export function komfaMonthUrl(source,year,month){
 return `${source.base}index.php?module=komfaris&action=cal&SetFilter=calstartdate&FilterValue=${year}-${String(month).padStart(2,'0')}-01`;
}
/** Meetings of a month view: {id, url, date, title}. Throws on a page that is no month view of that month. */
export function parseKomfaCalendar(html,source,{year,month}){
 const page=String(html||'');
 if(!/class=["']cal_table["']/.test(page))throw Error('Unbekanntes Kalenderformat');
 // The view shows the month it was asked for in its header; another month means the filter was not taken.
 const shown=[...page.matchAll(/<b>\s*([^<>]{3,30}?\s\d{4})\s*<\/b>/g)].map(m=>text(m[1])).find(s=>MONTH_NAMES.some(n=>s.startsWith(n+' ')))||'';
 if(shown!==`${MONTH_NAMES[month-1]} ${year}`)throw Error(`Kalender zeigt ${shown||'keinen Monat'} statt ${MONTH_NAMES[month-1]} ${year}`);
 const meetings=[];
 for(const cell of page.split(/<td class=["']cal_cellm\b/).slice(1)){
  const dom=cell.match(/<div class=["']cal_headm["'][^>]*>\s*(\d{1,2})\s*</)?.[1];if(!dom)continue;
  const date=`${year}-${String(month).padStart(2,'0')}-${dom.padStart(2,'0')}`;
  for(const a of cell.matchAll(/<div class=["']cal_eventtitle["'][^>]*>\s*<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
   const href=attribute(a[1],'href'),id=href.match(/[?&]action=to&id=([0-9A-Za-z]+)/)?.[1];if(!id)continue;
   let url;try{url=allowed(new URL(href,source.base).href,source);}catch{continue;}
   meetings.push({id,url,date,title:attribute(a[1],'title')||plain(a[2])});
  }
 }
 return meetings;
}
// The body of a meeting: the calendar title without the area itself ("Stadt Delitzsch, Stadtrat" → "Stadtrat").
const sameName=(a,b)=>{const f=s=>String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');return f(a)===f(b);};
const bodyName=(title,source)=>{const at=title.indexOf(', ');return (at>0&&sameName(title.slice(0,at),source.name)?title.slice(at+2):title).trim().replace(/,$/,'');};
/**
 * Items of the public part of one agenda page: {date, committee, available, items, left}. available is false where the
 * page says that the agenda is not available; items is null where it shows an agenda without a public heading.
 */
export function parseKomfaAgenda(html,meeting,source,now=new Date()){
 const page=String(html||'');
 // The page is titled "Tagesordnung" as well; the agenda is the last such heading, after the meeting data (DATUM …).
 const at=[...page.matchAll(/<h1>\s*Tagesordnung\s*<\/h1>/gi)].at(-1)?.index??-1,from=page.search(/>\s*DATUM\s*</);
 const head=from>=0&&at>from?page.slice(from,at):'';
 const date=day(text(head).match(/\d{1,2}\.\d{1,2}\.\d{4}/)?.[0]||'')||meeting.date;
 // The body: the column GREMIUM of the meeting data, after the municipality the page names in its second heading
 // where that is not the area itself ("Gemeinde Neetzka, Hauptausschuss" in the system of the Amt Woldegk). Without the
 // column, the calendar's title.
 const place=from>=0?[...page.slice(0,from).matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>plain(m[1])).filter(t=>!/^Tagesordnung$/i.test(t)).at(-1)||'':'';
 const body=plain(head.match(/<tr\b[^>]*>\s*<td\b[^>]*>[\s\S]*?<\/td>\s*<td\b[^>]*>[\s\S]*?<\/td>\s*<td\b[^>]*>([\s\S]*?)<\/td>/i)?.[1]||'');
 const committee=body?(place&&!sameName(place,source.name)?place+', '+body:body):bodyName(meeting.title||'',source)||'Sitzung';
 if(at<0)return {date,committee,available:false,items:null,left:0};
 let agenda=page.slice(at);
 // The agenda ends with the greeting of the chair, and the page's dialog boxes follow it.
 const end=agenda.search(/Mit freundlichen Grüßen|<div class=["']modal\b/i);if(end>0)agenda=agenda.slice(0,end);
 if(!/<table\b/i.test(agenda)&&/Tagesordnung ist nicht verfügbar/i.test(text(agenda)))return {date,committee,available:false,items:null,left:0};
 // The documents of an item stand in a folding box after its row, named by the link of its paper number.
 const boxes=new Map();
 agenda=agenda.replace(/<div class=["']collapse["'] id=["'](komfaris[0-9A-Za-z]+)["'][^>]*>([\s\S]*?)<\/table>\s*<\/div>/gi,(all,id,inner)=>{
  const documents=[];
  for(const a of inner.matchAll(/<a\b([^>]*\baction=dla[^>]*)>/gi)){
   const href=attribute(a[1],'href'),title=attribute(a[1],'title')||'Dokument';if(isNonPublicText(title))continue;
   try{documents.push({title,url:allowed(new URL(href,meeting.url).href,source),kind:'application/pdf'});}catch{/* another host */}
  }
  boxes.set(id,documents);return '';
 });
 // Rows after the public heading are public; rows before any heading (loose) wait for the decision after the table.
 const today=now.toISOString().slice(0,10),items=[],loose=[];let open=null,ended=false,closedPublic=false,left=0,leftLoose=0;
 for(const row of agenda.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...row[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)].map(c=>({cls:attribute(c[1],'class'),html:c[2]}));
  if(cells.length<3)continue;
  const numberCell=cells.filter(c=>/\bw05\b/.test(c.cls)).at(-1),titleCell=cells.find(c=>/(?:^|\s)left(?:\s|$)/.test(c.cls)&&!/\bw\d\d\b/.test(c.cls)),refCell=cells.find(c=>/\bw20\b/.test(c.cls));
  if(!titleCell)continue;
  const number=plain(numberCell?.html||''),title=plain(titleCell.html);if(!title)continue;
  const heading=partTitle(title),bold=/<b\b/i.test(titleCell.html);
  // A part heading: the public one opens the agenda, any other one ends it (fail closed).
  if(PUBLIC_PART.test(heading)&&(bold||!number)&&!NAMES_PART.test(heading.replace(PUBLIC_PART,''))){if(open===null){open=true;continue;}ended=true;break;}
  if(isNonPublicHeading(title)||/^(?:nicht|non)[\s-]*öffentlich|^nichtoeffentlich/.test(heading)||bold&&NAMES_PART.test(heading)&&!CLOSES_PUBLIC.test(heading)){ended=true;break;}
  // "Schließen der öffentlichen Sitzung" ends the public part (a procedural item, not taken).
  if(CLOSES_PUBLIC.test(heading)){ended=true;closedPublic=open===null;break;}
  const list=open?items:loose;
  // A title that names the non-public part is not taken, wherever it stands.
  if(isNonPublicText(title)){if(open)left++;else leftLoose++;continue;}
  const reference=plain(refCell?.html||''),box=refCell?.html.match(/href=["']#(komfaris[0-9A-Za-z]+)["']/i)?.[1];
  const documents=box?boxes.get(box)||[]:[];
  const key=reference?reference.replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,''):'';
  const status=date>today?(reference?'consulting':'announced'):'unknown';
  list.push({id:`${source.id}-kf-${key?'vo-'+key:'top-'+date.replace(/-/g,'')+'-'+fnv([committee,number,title].join('|'))}`,title,reference,sourceUrl:meeting.url,identityLinks:[],status,documents,
   event:{date,committee,status,description:date>today?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':'Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Abschnitt nicht belegt.',result:'',url:meeting.url,publicEvidence:open?'Öffentlicher Teil der Tagesordnung im Ratsinformationssystem (KOMFA)':'Tagesordnung ohne Teilüberschrift; öffentliche Bekanntmachung der Sitzung im Ratsinformationssystem (KOMFA)'},
   agenda:{number}});
 }
 if(open)return {date,committee,available:true,items,left};
 // An agenda without a part heading: public where the agenda closes its public part itself ("Schließen der öffentlichen
 // Sitzung") or where the meeting's own documents name its public notice ("Bekanntmachung-oeffentlich", Woldegk), and
 // no other part follows. Tenants that print the non-public part do so under a heading of its own.
 if(open===null&&(closedPublic||!ended&&PUBLIC_NOTICE.test(text(head))))return {date,committee,available:true,items:loose,left:leftLoose};
 return {date,committee,available:true,items:null,left};
}
// source: {id, name, kind, base, organizations?}. marks (optional): what earlier imports read completely (meeting-marks.mjs).
export async function collectKomfa(source,{now=new Date(),get=fetchText,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=paced(budgeted(get,maxDurationMs,2));
 const read=url=>get(allowed(url,source),source);
 const from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10);
 // Invitations appear weeks ahead: the months up to the end of the month after next.
 const until=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+3,0)),untilDay=until.toISOString().slice(0,10);
 const part=committeePart(source.organizations);
 const issues=[],warnings=[],meetings=new Map();
 // 1. The months of the period, newest first: a period cut by the time budget keeps the recent meetings.
 const months=[],first=Date.UTC(from.getUTCFullYear(),from.getUTCMonth(),1);
 for(const d=new Date(Date.UTC(until.getUTCFullYear(),until.getUTCMonth(),1));d.getTime()>=first;d.setUTCMonth(d.getUTCMonth()-1))months.push([d.getUTCFullYear(),d.getUTCMonth()+1]);
 let listed=0;
 for(const [year,month] of months){
  try{
   for(const m of parseKomfaCalendar(await read(komfaMonthUrl(source,year,month)),source,{year,month})){
    if(m.date<fromDay||m.date>untilDay||meetings.has(m.url))continue;
    if(!part.keep(m.title,m.url))continue;
    meetings.set(m.url,m);
   }
   listed++;
  }catch(e){if(/Zeitbudget/.test(e.message)){issues.push('Zeitbudget der Quelle erreicht; ältere Monate nicht gelesen.');break;}issues.push(`Kalender ${String(month).padStart(2,'0')}/${year}: ${e.message}`);if(/HTTP 40[13]/.test(e.message))break;}
 }
 warnings.push(...part.warnings());
 if(!listed)return {topics:[],marks:{},readMeetings:0,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:0,sourceCount:1,quiet:false,complete:false,issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
 // 2. Agenda pages.
 const grouped=new Map(),held={};let count=0,fetched=0,beyond=0,unchanged=0,done=0,unread=0,upcoming=0,refused=0,left=0;
 await parallel([...meetings.values()].sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date)),async m=>{
  const known=usableMark(marks,m,now);
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;count++;return;}
  if(fetched>=MAX_MEETINGS){beyond++;return;}fetched++;
  try{
   const agenda=parseKomfaAgenda(await read(m.url),m,source,now);
   if(!agenda.available){if(agenda.date>today)upcoming++;else warnings.push('Sitzung ohne veröffentlichte Tagesordnung: '+m.url);return;}
   if(!agenda.items){warnings.push(NOT_PUBLIC+': '+m.url);return;}
   left+=agenda.left;
   const print=(await hash(JSON.stringify(agenda.items.map(i=>[i.id,i.title,i.reference,i.documents.map(d=>d.url)])))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;return;}
   for(const row of agenda.items){
    const {number}=row.agenda;delete row.agenda;
    row.sourceData={version:'public-source-fields-v1',method:'komfa',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:{number,title:row.title,reference:row.reference}}],detailStatus:'completed',issues:[]};
    row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
    const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);}else grouped.set(row.id,{...row,events:[row.event]});
   }
   held[m.url]=newMark(m,print,now,agenda.items.length);done++;
  }catch(e){if(/Zeitbudget/.test(e.message))unread++;else if(e.message.includes(REFUSED))refused++;else issues.push(m.url+': '+e.message);}
  finally{count++;onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');}
 },2);
 if(left)warnings.push(`${left} Punkte, deren Titel den nichtöffentlichen Teil nennt, ausgelassen.`);
 if(refused)issues.push(`Server wies ${refused} ${refused===1?'Sitzung':'Sitzungen'} vorübergehend ab; der nächste Schritt setzt dort fort.`);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(beyond)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.committee+': '+e.description).join('\n'),
   documents:[...new Map([...row.documents,{title:'Sitzung / öffentliche Tagesordnung',url:last.url,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche Seiten von KOMFA-RIS; nur Punkte unter der Überschrift des öffentlichen Teils.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:meetings.size,...(upcoming?{upcomingWithoutAgenda:upcoming}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||beyond||refused?{resumable:true}:{}),...(warnings.length?{warnings}:{}),sourceCount:1,quiet:meetings.size===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
