import {sourceDecision} from './source-fields.mjs';
import {windowStart,historyWindow} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,text,decode,MAX_MEETINGS} from './sessionnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
import {committeePart} from './oparl-regional.mjs';
import {statusOf} from './sdnet-rim4.mjs';
// TYPO3 "Bürgerinformationssystem" of a municipality (stadtrat.monheim.de/bi, extension risportal: calendar, meeting
// pages and a small interface below /api/meetings/). Read are addresses of the public site only:
// - /api/meetings/month/YYYY-MM: JSON list {name,start,uri} of the meetings of a month,
// - /api/meetings/stream/<id>: the agenda of a meeting as accordion (the data of the "Rats-TV" tab): number and title of
//   each item and, for items with a paper, its number, kind, date, content, result ("Ergebnis") and documents
//   (/bi/download/*.pdf, only linked, not read). The agenda of a meeting not yet announced is empty.
// The paper pages (tx_risportal_web) are not read. The system shows the public part only.
const origin=source=>new URL(source.base).origin+'/';
const PATHS=/^api\/meetings\/(?:month\/\d{4}-\d{2}|stream\/\d+)$/;
const guard=(url,source)=>{const u=new URL(url);if(u.protocol!=='https:'||u.origin+'/'!==origin(source)||!PATHS.test(u.pathname.slice(1)))throw Error('Nicht freigegebene Quelladresse');return u.href;};
/** Address of a page of the interface (month list or agenda of a meeting). */
export const typo3Url=(path,source)=>guard(new URL(path,origin(source)).href,source);
const slug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const plain=html=>text(html).normalize('NFC').replace(/\s+/g,' ').trim();
export function detectTypo3Bi(url,html=''){
 const page=String(html);
 if(!/powered by TYPO3/i.test(page)||!/data-month="\/api\/meetings\/month\//.test(page)&&!/href="[^"]*\/bi\/sitzungen\/\d+/.test(page))return null;
 const u=new URL(url),m=u.pathname.match(/^(.*?\/bi)(?:\/|$)/);
 return m?{adapter:'typo3-bi',base:u.origin+m[1]+'/'}:null;
}
/** Meetings of a month list (JSON): day, clock time, body (as named), id and address of the meeting page. */
export function typo3Meetings(json){
 let rows;try{rows=JSON.parse(json);}catch{return [];}
 if(!Array.isArray(rows))return [];
 return rows.flatMap(r=>{
  const m=String(r?.start||'').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/),id=String(r?.uri||'').match(/\/sitzungen\/(\d+)/)?.[1];
  return m&&id&&r.name?[{date:m[1],time:m[2],body:String(r.name).trim(),id,uri:r.uri}]:[];
 }).sort((a,b)=>b.date.localeCompare(a.date)||a.body.localeCompare(b.body,'de'));
}
/** The committee as the calendar names it, without the lead-in "Sitzung des/der" and a trailing "(Fortsetzung)". */
export const committeeOf=name=>{
 const n=String(name).trim(),genitive=/^Sitzung des\s+/i.test(n);
 const body=n.replace(/^Sitzung (?:des|der|von)\s+/i,'').replace(/\s*\(Fortsetzung\)\s*$/,'').trim();
 // "Sitzung des Rates" names the body in the genitive: Rates → Rat, Haupt- und Finanzausschusses → …ausschuss.
 return genitive?body.replace(/(ausschuss|rat|beirat)es(?=\s|$)/gi,'$1'):body;
};
/**
 * An agenda: all items {number, title, paper, kind, date, content, result, documents[{title,url}]}. Items without a paper
 * (opening, questions, announcements) have paper ''.
 */
export function parseTypo3Agenda(html,source){
 const base=origin(source),items=[],page=String(html);
 for(const block of page.split('<div class="c-accordion__item">').slice(1)){
  const number=plain(block.match(/c-accordion__count">([\s\S]*?)<\/span>/)?.[1]||''),title=plain(block.match(/c-accordion__title">([\s\S]*?)<svg/)?.[1]||'');
  if(!title)continue;
  const panel=block.match(/<table data-table="split">([\s\S]*?)<\/table>/)?.[1]||'';
  const rows=Object.fromEntries([...panel.matchAll(/<th>([^<]*?)<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(r=>[r[1].replace(/:$/,''),r[2]]));
  const documents=[...panel.matchAll(/<a\b[^>]*href="(\/bi\/download\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(a=>({title:plain(a[0].match(/\btitle="([^"]*)"/)?.[1]||a[2])||'Dokument',url:new URL(decode(a[1]),base).href}));
  items.push({number,title,paper:plain(rows.Nummer||''),kind:plain(rows.Art||''),date:plain(rows.Datum||''),content:plain(rows.Inhalt||''),result:plain(rows.Ergebnis||''),documents:[...new Map(documents.map(d=>[d.url,d])).values()]});
 }
 return items;
}
/** The reports of one meeting: a row per item with a paper number. */
export function typo3Items(items,meeting,source,now=new Date()){
 const committee=committeeOf(meeting.body),today=now.toISOString().slice(0,10),past=meeting.date<=today;
 return items.filter(i=>i.paper).map(i=>{
  const status=!past?'consulting':i.result?statusOf(i.result,committee):'unknown';
  const description=!past?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':i.result?`Ergebnis: ${i.result}`:'In der Tagesordnung geführt; im Informationssystem ist kein Ergebnis veröffentlicht.';
  return {id:`${source.id}-vo-${slug(i.paper)}`,title:i.content||i.title,reference:i.paper,sourceUrl:meeting.url,identityLinks:[],documents:i.documents.map(d=>({title:d.title,url:d.url,kind:'pdf'})),status,
   record:{number:i.number,paper:i.paper,kind:i.kind,paperDate:i.date,agendaTitle:i.title,result:i.result},
   event:{date:meeting.date,committee,status,description,result:i.result,url:meeting.url,publicEvidence:`Öffentliche Tagesordnung, TOP ${i.number}`}};
 });
}
function monthsBetween(from,to){const out=[];let y=from.getUTCFullYear(),m=from.getUTCMonth();while(y<to.getUTCFullYear()||y===to.getUTCFullYear()&&m<=to.getUTCMonth()){out.push(`${y}-${String(m+1).padStart(2,'0')}`);if(++m>11){m=0;y++;}}return out;}
// marks (optional): what earlier imports read completely, see meeting-marks.mjs.
export async function collectTypo3Bi(source,{now=new Date(),get=fetchText,request=fetch,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 const root={...source,base:origin(source)};
 const guarded=(url,init)=>{guard(url,source);return request(url,init);};
 const read=path=>{const url=typo3Url(path,source);return get(url,root,undefined,guarded);};
 const period=historyWindow(lookback)+':',from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10);
 const ahead=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+2,1));
 const issues=[],warnings=[],meetings=new Map(),part=committeePart(source.organizations);
 let withoutAgenda=0;
 try{
  const rows=[];let failed=0;
  await parallel(monthsBetween(from,ahead),async month=>{try{rows.push(...typo3Meetings(await read('api/meetings/month/'+month)));}catch(e){if(/Zeitbudget/.test(e.message))throw e;failed++;issues.push('Sitzungskalender '+month+': '+e.message);}},2);
  if(!rows.length&&!failed)throw Error('keine Sitzungen im Kalender');
  for(const r of rows){
   if(r.date<fromDay||meetings.has(r.id))continue;
   if(!part.keep(r.body,r.id))continue;
   meetings.set(r.id,{...r,url:new URL(r.uri,origin(source)).href});
  }
 }catch(e){issues.push('Sitzungskalender: '+e.message);}
 const grouped=new Map(),held={};let count=0,limited=false,unchanged=0,done=0,unread=0;
 await parallel([...meetings.values()].sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date)),async m=>{
  const mark=usableMark(marks,m,now),known=mark&&String(mark.print).startsWith(period)?mark:null;
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;return;}
  if(count>=MAX_MEETINGS){limited=true;return;}count++;
  try{
   const items=parseTypo3Agenda(await read('api/meetings/stream/'+m.id),source);
   if(!items.length){if(m.date>today)withoutAgenda++;else warnings.push('Sitzung ohne Tagesordnung: '+m.date+' '+m.body);return;}
   const rows=typo3Items(items,m,source,now),print=period+(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.record,r.status])))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;return;}
   for(const row of rows){
    row.sourceData={version:'public-source-fields-v1',method:'typo3-bi',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:row.record}],detailStatus:'completed',issues:[]};delete row.record;
    row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
    const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);}else grouped.set(row.id,{...row,events:[row.event]});
   }
   held[m.url]=newMark(m,print,now,rows.length);done++;
  }catch(e){if(/Zeitbudget/.test(e.message))unread++;else if(/HTTP 404/.test(e.message))warnings.push('Sitzung ohne Seite: '+m.date+' '+m.body);else issues.push(m.url+': '+e.message);}
  onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
 },2);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(limited)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),identityLinks:[],documents:[...new Map([...row.documents,{title:'Tagesordnung',url:last.url,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche Seiten des Bürgerinformationssystems (TYPO3); nur der öffentliche Teil.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:meetings.size,...(withoutAgenda?{upcomingWithoutAgenda:withoutAgenda}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||limited?{resumable:true}:{}),...(warnings.length||part.warnings().length?{warnings:[...warnings,...part.warnings()]}:{}),sourceCount:1,quiet:topics.length===0&&unchanged===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0||withoutAgenda>0),issues:topics.length||unchanged||withoutAgenda?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
