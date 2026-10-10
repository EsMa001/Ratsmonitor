import {sourceDecision} from './source-fields.mjs';
import {windowStart,historyWindow} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text,MAX_MEETINGS} from './sessionnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
import {committeePart} from './oparl-regional.mjs';
// Meeting Mobile / "RIS Web" (Lotus Domino with XPages; meeting-mobile.de/mm/<ort>/ris_web.nsf, also hosted by a
// municipality itself, e.g. ris.reutlingen.de/programme/RIS/ris_web.nsf). Read are plain GET addresses of the public site:
// - meeting_period_doc.xsp: every meeting with day, time, body and the address of its page (meeting_doc.xsp?documentId=…),
// - meeting_doc.xsp: body, day, place and the agenda; the block headed "öffentlich" lists the items with a paper number
//   and the link of the paper ("xsp/download?…", only linked, not read here). A block "nichtöffentlich" is never read.
// A few installations (Reutlingen) render the meeting list with JavaScript links only; their meetings are taken from
// documents_month.xsp, which links the meetings of the current month (the month tabs are page state and are not used).
// No form, login, session or postback is needed: the pages are complete without cookies.
export const MM_RESTRICTED='Nichtöffentlicher Teil; wird nicht abgefragt.';
const PATHS=/^(?:meeting_period_doc\.xsp|documents_month\.xsp|meeting_doc\.xsp)$/;
const guard=(url,source)=>{const u=new URL(url),rest=u.pathname.slice(new URL(source.base).pathname.length);if(!PATHS.test(rest))throw Error('Nicht freigegebene Quelladresse');
 if([...u.searchParams.keys()].some(k=>!['documentId','action'].includes(k)))throw Error('Nicht freigegebene Quelladresse');return url;};
const slug=value=>String(value).toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const plain=html=>text(String(html).replace(/<br\s*\/?>/gi,' ')).normalize('NFC').replace(/ /g,' ').replace(/\s+/g,' ').trim();
const dmy=value=>{const m=String(value).match(/(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?!\d)/);return m?`${m[3].length===2?'20'+m[3]:m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:null;};
export const mmUrl=(path,source)=>allowed(new URL(path,source.base).href,source);
export function detectMeetingMobile(url,html=''){
 const u=new URL(url),m=u.pathname.match(/^(.*\/ris_web\.nsf\/)/i);
 if(!m||!/xspClientDojo|\/xsp\/\.ibmxspres\//.test(String(html))||!/meeting_period|meeting_doc|documents_month|desktop_main/.test(String(html)))return null;
 return {adapter:'meeting-mobile',base:'https://'+u.host+m[1]};
}
/**
 * Meetings of a list page: {date, time, body, id, url}. meeting_period_doc.xsp has a row per meeting; a row without
 * address (JavaScript link) is counted in `blind`. documents_month.xsp gives addresses only (date and body come from the
 * meeting page): rows without date.
 */
export function mmMeetings(html,base){
 const page=String(html),rows=[],seen=new Set();let blind=0;
 for(const [,inner] of page.matchAll(/<table[^>]*:meetingPeriodTable"[^>]*>([\s\S]*?)<\/table>/g)){
  const date=dmy(plain(inner.match(/computedFieldStartDate"[^>]*>([\s\S]*?)<\/span>/)?.[1]||'')),time=plain(inner.match(/computedFieldStartTime"[^>]*>([\s\S]*?)<\/span>/)?.[1]||'').replace(/\s*Uhr$/,'');
  const a=inner.match(/<a\b[^>]*linkCommitteePeriod[^>]*>([\s\S]*?)<\/a>/),tag=a?a[0].match(/href="([^"]*)"/)?.[1]||'':'';
  const body=plain(a?.[1]||''),id=tag.match(/meeting_doc\.xsp\?documentId=([0-9A-Fa-f]{32})/)?.[1];
  if(!date||!body)continue;
  if(!id){blind++;continue;}
  if(seen.has(id))continue;seen.add(id);
  rows.push({date,time,body,id,url:new URL(`meeting_doc.xsp?documentId=${id}&action=openDocument`,base).href});
 }
 if(!rows.length&&!blind)for(const [,id] of page.matchAll(/meeting_doc\.xsp\?documentId=([0-9A-Fa-f]{32})/g)){
  if(seen.has(id))continue;seen.add(id);rows.push({date:null,time:'',body:'',id,url:new URL(`meeting_doc.xsp?documentId=${id}&action=openDocument`,base).href});
 }
 rows.sort((a,b)=>String(b.date).localeCompare(String(a.date))||a.body.localeCompare(b.body,'de'));
 rows.blind=blind;return rows;
}
const span=(page,name)=>plain(page.match(new RegExp(`${name}"[^>]*>([\\s\\S]*?)</span>`))?.[1]||'');
/**
 * A meeting page: body, day, time, place and the items of the block "öffentlich": number, title, paper number, documents
 * ({title,url}). Other blocks (nichtöffentlich) are skipped.
 */
export function parseMmMeeting(html,base='https://example.invalid/'){
 const page=String(html),body=page.slice(page.indexOf('<body')>=0?page.indexOf('<body'):0);
 const committee=plain(body.match(/meetingCommitteeNameField"[^>]*>([\s\S]*?)<\/a>/)?.[1]||'')||span(body,'meetingSubjectField'),subject=span(body,'meetingSubjectField');
 const date=dmy(span(body,':StartDate')),time=span(body,':StartTime'),place=[span(body,'computedFieldRoom'),span(body,'computedFieldStreet'),[span(body,'computedFieldZip'),span(body,'computedFieldCity')].filter(Boolean).join(' ')].filter(Boolean).join(', ');
 const kind=span(body,'meetingCommitteeTypeField');
 const heads=[...body.matchAll(/role="meetingAgendaHeader"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/g)].map(m=>({at:m.index,label:plain(m[1]).toLowerCase()}));
 const items=[];
 heads.forEach((h,i)=>{
  if(h.label!=='öffentlich')return;
  const block=body.slice(h.at,heads[i+1]?.at??body.length);
  for(const [,row] of block.matchAll(/<td class="meetingSubNoC">([\s\S]*?)(?=<td class="meetingSubNoC">|<\/tbody>)/g)){
   const number=plain(row.match(/noColumn:number"[^>]*>([\s\S]*?)<\/span>/)?.[1]||'').replace(/\.$/,''),title=plain(row.match(/subjectColumn:subject"[^>]*>([\s\S]*?)<\/span>/)?.[1]||'');
   const paper=plain(row.match(/submissionFieldAgendaNumber"[^>]*>([\s\S]*?)<\/span>/)?.[1]||'').replace(/^-$/,'');
   const documents=[...row.matchAll(/href="([^"]*xsp\/download\?[^"]*)"/g)].map(a=>{
    const href=a[1].replace(/&amp;/g,'&'),u=new URL(href,base),file=decodeURIComponent((u.searchParams.get('file')||'').replace(/\+/g,' '));
    return {title:file.replace(/\.[A-Za-z0-9]{2,4}$/,'')||'Vorlage',url:u.href};
   });
   if(title)items.push({number,title,paper,documents});
  }
 });
 return {committee,subject,kind,date,time,place,items,publicBlock:heads.some(h=>h.label==='öffentlich')};
}
// Items every meeting has; they carry no matter of their own.
const ROUTINE=/^(?:eröffnung|begrüßung|genehmigung|feststellung|bekanntgaben?|mitteilungen?|anfragen|fragestunde|bürgerfragestunde|einwohnerfragestunde|verschiedenes|anregungen|niederschrift|protokoll|tagesordnung|wünsche|bürgerfrage|einwohnerfrage)\b/i;
const routine=title=>ROUTINE.test(title)&&title.length<70;
/** The reports of one meeting: a row per public item with a paper number or a paper; routine items are left out. */
export function mmItems(parsed,meeting,source,now=new Date()){
 const date=parsed.date||meeting.date,committee=parsed.committee||meeting.body,today=now.toISOString().slice(0,10),past=date<=today;
 return parsed.items.filter(i=>(i.paper||i.documents.length)&&!routine(i.title)).map(i=>{
  const key=i.paper?slug(i.paper):slug(i.title).slice(0,70),id=`${source.id}-mm-${key}`;
  const status=past?'unknown':'consulting',description=past?'In der öffentlichen Tagesordnung geführt; ein Beschluss ist auf dieser Seite nicht veröffentlicht.':'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.';
  return {id,title:i.title,reference:i.paper||'',sourceUrl:meeting.url,identityLinks:[],documents:i.documents.map(d=>({title:d.title,url:d.url,kind:'pdf'})),status,
   record:{number:i.number,paper:i.paper},
   event:{date,committee,status,description,result:'',url:meeting.url,publicEvidence:`Öffentliche Tagesordnung, TOP ${i.number||'-'}`}};
 });
}
// marks (optional): what earlier imports read completely, see meeting-marks.mjs.
export async function collectMeetingMobile(source,{now=new Date(),get=fetchText,request=fetch,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 const guarded=(url,init)=>{guard(url,source);return request(url,init);};
 const read=target=>{const url=target.startsWith('http')?allowed(target,source):mmUrl(target,source);guard(url,source);return get(url,source,undefined,guarded);};
 const period=historyWindow(lookback)+':',from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10);
 const issues=[],warnings=[],meetings=new Map(),part=committeePart(source.organizations);
 let withoutPage=0,monthOnly=false;
 try{
  let rows=mmMeetings(await read('meeting_period_doc.xsp'),source.base);
  if(rows.blind&&!rows.length){
   // Meeting list without addresses: the month view links the meetings of the current month.
   monthOnly=true;warnings.push('Die Sitzungsliste der Installation hat keine Adressen; gelesen werden nur die Sitzungen des laufenden Monats.');
   rows=mmMeetings(await read('documents_month.xsp'),source.base);
  }else if(rows.blind)withoutPage=rows.blind;
  if(!rows.length)throw Error('keine Sitzungen gefunden');
  for(const r of rows){
   if(r.date&&r.date<fromDay)continue;
   if(r.body&&!part.keep(r.body,r.id))continue;
   meetings.set(r.url,r);
  }
 }catch(e){issues.push('Sitzungsliste: '+e.message);}
 const grouped=new Map(),held={};let count=0,limited=false,unchanged=0,done=0,unread=0,empty=0;
 await parallel([...meetings.values()].sort((a,b)=>oldestFirst?String(a.date).localeCompare(String(b.date)):String(b.date).localeCompare(String(a.date))),async m=>{
  const mark=m.date?usableMark(marks,m,now):null,known=mark&&String(mark.print).startsWith(period)?mark:null;
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;return;}
  if(count>=MAX_MEETINGS){limited=true;return;}count++;
  try{
   const parsed=parseMmMeeting(await read(m.url),source.base);
   if(!parsed.committee&&!parsed.date){issues.push('Unbekanntes Format der Sitzungsseite: '+m.url);return;}
   const meeting={...m,date:parsed.date||m.date,body:parsed.committee||m.body};
   if(monthOnly&&(meeting.date<fromDay||!part.keep(meeting.body,m.id)))return;
   if(!parsed.publicBlock)empty++;
   const rows=mmItems(parsed,meeting,source,now),print=period+(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.record,r.status,r.documents.map(d=>d.url)])))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;return;}
   for(const row of rows){
    row.sourceData={version:'public-source-fields-v1',method:'meeting-mobile',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:row.record}],detailStatus:'completed',issues:[]};delete row.record;
    row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
    const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);}else grouped.set(row.id,{...row,events:[row.event]});
   }
   held[m.url]=newMark(meeting,print,now,rows.length);done++;
  }catch(e){if(/Zeitbudget/.test(e.message))unread++;else if(/HTTP 404/.test(e.message))warnings.push('Sitzung ohne Seite: '+(m.date||'')+' '+m.body);else issues.push(m.url+': '+e.message);}
  onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
 },2);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(limited)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),identityLinks:[],documents:[...new Map([...row.documents,{title:'Tagesordnung',url:last.url,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche Seiten des Ratsinformationssystems (Meeting Mobile, RIS Web); nur der öffentliche Teil.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 const wp=[...warnings,...part.warnings(),...(withoutPage?[`${withoutPage} Sitzungen ohne Seitenadresse in der Liste.`]:[])];
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:meetings.size,...(monthOnly?{partial:'laufender Monat'}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||limited?{resumable:true}:{}),...(wp.length?{warnings:wp}:{}),sourceCount:1,quiet:topics.length===0&&unchanged===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0||meetings.size>0)&&!monthOnly,issues:topics.length||unchanged||meetings.size?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
