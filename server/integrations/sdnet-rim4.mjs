import {sourceDecision,DECIDING_BODY} from './source-fields.mjs';
import {windowStart,historyWindow} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text,MAX_MEETINGS} from './sessionnet.mjs';
import {resultStatus} from './sdnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
import {committeePart} from './oparl-regional.mjs';
// SD.NET RIM 4 (Somacos, the newer web interface of the SD.NET Ratsinformationssystem: /termine, /tops, /vorgang),
// as hosted by a municipality itself (ris.wesel.de). Read are plain addresses of the public site only:
// - the iCalendar of the meeting calendar (termine/ics/SD.NET_RIM.ics): every meeting with its day, body and the address
//   of its agenda ("Link zur Tagesordnung"); a meeting without agenda has no address,
// - the agenda tops/?__=<token>: body, day, place and the items; "top-oeff-*" rows are public, "top-noeff-*" rows (the
//   non-public part) are never read; an item with a paper number carries the Vorlage (PDF) and a link to its process,
// - the process vorgang/?__=<token>: subject, department and the "Beratungsfolge" with the resolution of each body.
// The tokens in the addresses are stable. Documents (sdnetrim/…) are only linked, not read here. The classic SD.NET
// (ratsinfomanagement.net, reader "sdnet") has other pages; the hosts of ratsinfomanagement.net are not served by this reader.
export const RIM4_RESTRICTED='Nichtöffentlicher Teil; wird nicht abgefragt.';
const day=value=>{const m=String(value).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:null;};
const slug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const plain=html=>text(String(html).replace(/<br\s*\/?>/gi,' ')).normalize('NFC').replace(/ /g,' ').replace(/\s+/g,' ').trim();
const clip=(value,max)=>value.length>max?value.slice(0,max).replace(/\s+\S*$/,'')+' …':value;
const ICS='termine/ics/SD.NET_RIM.ics';
// Pages the reader requests, relative to the application: the calendar, agendas and processes.
const PATHS=/^(?:termine\/ics\/SD\.NET_RIM\.ics|tops\/|vorgang\/)$/;
const guard=(url,source)=>{const u=new URL(url),rest=u.pathname.slice(new URL(source.base).pathname.length);if(!PATHS.test(rest))throw Error('Nicht freigegebene Quelladresse');return url;};
/** Address of a page below the application (the calendar, or an agenda or process address taken from a page). */
export const rim4Url=(path,source)=>allowed(new URL(path,source.base).href,source);
export function detectRim4(url,html=''){
 if(!/SD\.NET RIM 4/i.test(String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'')||/ratsinfomanagement\.net$/i.test(new URL(url).hostname))return null;
 return {adapter:'sdnet-rim4',base:'https://'+new URL(url).host+'/'};
}
const unfold=ics=>String(ics).replace(/\r?\n[ \t]/g,'');
const unescape=value=>value.replace(/\\n/gi,'\n').replace(/\\([,;\\])/g,'$1');
/**
 * Meetings of the calendar: day, body, address of the agenda (null while there is none), newest first. A note after the
 * address ("Bemerkung: …") is cut off.
 */
export function rim4Meetings(ics){
 const rows=[];
 for(const [,event] of unfold(ics).matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)){
  const start=event.match(/DTSTART[^:\r\n]*:(\d{4})(\d{2})(\d{2})/),summary=event.match(/^SUMMARY:(.*)$/m);
  if(!start||!summary)continue;
  const link=unescape(event.match(/^DESCRIPTION:(.*)$/m)?.[1]||'').match(/https:\/\/[^\s]+\/tops\/[^\s]*/)?.[0]||null;
  rows.push({date:`${start[1]}-${start[2]}-${start[3]}`,body:unescape(summary[1]).trim(),agenda:link,place:unescape(event.match(/^LOCATION:(.*)$/m)?.[1]||'').replace(/[\s,]+$/,'')});
 }
 return rows.sort((a,b)=>b.date.localeCompare(a.date)||a.body.localeCompare(b.body,'de'));
}
// "Vorlage zur Kenntnis T 02/325/26 (exportiert: 18.09.2026) (125 KB)": the kind of the paper is the text before its number.
const kindOf=(title,number)=>title.replace(/\s*\(exportiert:.*$/,'').split(number)[0].trim();
/**
 * An agenda: body, session, day, time, place and the public items with a paper number: number, title, paper number,
 * kind of the paper, documents ({title,url}) and the address of the process. Items without a paper number carry no matter
 * of their own. The non-public part is not read.
 */
export function parseRim4Agenda(html){
 const page=String(html),head=cell=>{const m=page.match(new RegExp(`<th scope="row">${cell}:</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`));return m?m[1]:'';};
 const session=head('Sitzung'),when=head('Termin'),time=plain(when).match(/(\d{1,2}:\d{2})\s*Uhr/)?.[1]||'';
 const items=[];
 for(const [,classes,inner] of page.matchAll(/<tr\b[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/g)){
  if(!/\btop-oeff-data\b/.test(classes))continue;
  const cells=Object.fromEntries([...inner.matchAll(/<td\b[^>]*class="column-([a-z]+)"[^>]*>([\s\S]*?)<\/td>/g)].map(c=>[c[1],c[2]]));
  const number=plain(cells.nummer||'').replace(/^ $/,''),title=plain(cells.bezeichnung||'');
  const process=(cells.dokumente||'').match(/href="([^"]*\/vorgang\/[^"]*)"/)?.[1]?.replace(/&amp;/g,'&')||null;
  if(!title||!number&&!process)continue;
  const documents=[...(cells.dokumente||'').matchAll(/<a\b[^>]*href="([^"]*\/sdnetrim\/[^"]+)"[^>]*>/g)].map(a=>{
   const tag=a[0],label=plain(tag.match(/\btitle="([^"]*)"/)?.[1]||tag.match(/aria-label="([^"]*)"/)?.[1]||'');
   return {title:label.replace(/ im PDF-Format öffnen$/,'').replace(/\s*\(exportiert:.*$/,''),url:a[1].replace(/&amp;/g,'&')};
  }).filter(d=>d.url);
  const first=documents[0]?.title||'';
  items.push({number:plain(cells.topnrtext||'').replace(/\.$/,''),title,paper:number,kind:number?kindOf(first,number):'',documents,process});
 }
 return {committee:plain(session.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1]||session.replace(/,\s*\d+\.\s*Sitzung.*$/,'')),session:plain(session),date:day(plain(when)),time,place:plain(head('Ort')),items};
}
/** A process: subject, kind and number of the paper, department, and the deliberations {date, body, resolution, vote}. */
export function parseRim4Process(html){
 const page=String(html),field=name=>{const m=page.match(new RegExp(`<th scope="row">${name}:</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`));return m?plain(m[1]):'';};
 const first=page.match(/<th scope="row">([^<]*):<\/th>\s*<td[^>]*>\s*([^<]*?)\s*<\/td>/);
 const table=page.match(/<caption class="caption">Beratungsfolge<\/caption>([\s\S]*?)<\/table>/)?.[1]||'';
 const deliberations=[...table.matchAll(/<tr\b[^>]*data-vorgang-id[^>]*>([\s\S]*?)<\/tr>/g)].map(r=>{
  const c=Object.fromEntries([...r[1].matchAll(/<td\b[^>]*class="column-([a-z]+)"[^>]*>([\s\S]*?)<\/td>/g)].map(x=>[x[1],plain(x[2])]));
  return {date:day(c.beginn||''),body:c.gremium||'',resolution:c.beschluss||'',vote:c.ergebnis||''};
 });
 return {kind:first?.[1]||'',number:first?.[2]?.trim()||'',subject:field('Betreff'),department:field('Federführung'),deliberations};
}
// resultStatus knows the wording of classic SD.NET; the resolution column of RIM 4 is free text as well.
const statusOf=(resolution,committee)=>{
 const r=resultStatus(resolution,committee);if(r)return r;
 const decides=DECIDING_BODY.test(committee);
 if(/zur kenntnis/i.test(resolution))return 'info';
 if(/vertagt|zurückgestellt|verschoben/i.test(resolution))return 'postponed';
 if(/abgelehnt|lehnt\b.*\bab\b/i.test(resolution))return decides?'rejected':'recommended';
 if(/beschließt|beschlossen|zugestimmt|stimmt\b.*\bzu\b|angenommen|empfiehlt|empfohlen|einstimmig|mehrheitlich/i.test(resolution))return decides?'approved':'recommended';
 return 'unknown';
};
const norm=value=>String(value).toLowerCase().replace(/[^a-zäöüß0-9]+/g,'');
/** The reports of one meeting: a row per public item with a paper. processes: parsed processes by address. */
export function rim4Items(parsed,meeting,source,processes=new Map(),now=new Date()){
 const date=parsed.date||meeting.date,committee=parsed.committee||meeting.body,today=now.toISOString().slice(0,10),past=date<=today;
 return parsed.items.filter(i=>i.paper).map(i=>{
  const process=i.process?processes.get(i.process)||null:null;
  const turn=process?.deliberations.find(d=>d.date===date&&norm(d.body)===norm(committee))||process?.deliberations.find(d=>d.date===date)||null;
  const resolution=turn?.resolution||'',vote=turn?.vote||'';
  const result=[resolution,vote&&'Abstimmung: '+vote].filter(Boolean).join(' ');
  const status=!past?'consulting':resolution?statusOf(resolution,committee):'unknown';
  const description=!past?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':result?`Beschluss: ${result}`:'In der Tagesordnung geführt; im Vorgang ist kein Beschluss veröffentlicht.';
  const url=i.process||meeting.agenda||meeting.url,id=`${source.id}-vo-${slug(i.paper)}`;
  return {id,title:process?.subject||i.title,reference:i.paper,sourceUrl:url,identityLinks:[i.process].filter(Boolean),documents:i.documents.map(d=>({title:d.title,url:d.url,kind:'pdf'})),status,
   record:{number:i.number,paper:i.paper,kind:i.kind,department:process?.department||'',resolution,vote},
   event:{date,committee,status,description,result,url:meeting.agenda||meeting.url,publicEvidence:(past?'Öffentliche Tagesordnung':'Öffentliche Tagesordnung')+`, TOP ${i.number}`}};
 });
}
// marks (optional): what earlier imports read completely, see meeting-marks.mjs.
export async function collectRim4(source,{now=new Date(),get=fetchText,request=fetch,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 const guarded=(url,init)=>{guard(url,source);return request(url,init);};
 const read=target=>{const url=target.startsWith('http')?allowed(target,source):rim4Url(target,source);guard(url,source);return get(url,source,undefined,guarded);};
 const period=historyWindow(lookback)+':',from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10);
 const issues=[],warnings=[],meetings=new Map(),part=committeePart(source.organizations);
 let withoutAgenda=0;
 try{
  const rows=rim4Meetings(await read(ICS));
  if(!rows.length)throw Error('keine Sitzungen im Kalender');
  for(const r of rows){
   if(r.date<fromDay)continue;
   if(!part.keep(r.body,r.agenda||r.date+r.body))continue;
   if(!r.agenda){withoutAgenda++;continue;}
   meetings.set(r.agenda,{...r,url:r.agenda});
  }
 }catch(e){issues.push('Sitzungskalender: '+e.message);}
 const processes=new Map();
 const processOf=async url=>{
  if(!processes.has(url))processes.set(url,read(url).then(parseRim4Process).catch(e=>{if(/Zeitbudget/.test(e.message))throw e;return null;}));
  return processes.get(url);
 };
 const grouped=new Map(),held={};let count=0,limited=false,unchanged=0,done=0,unread=0;
 await parallel([...meetings.values()].sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date)),async m=>{
  const mark=usableMark(marks,m,now),known=mark&&String(mark.print).startsWith(period)?mark:null;
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;return;}
  if(count>=MAX_MEETINGS){limited=true;return;}count++;
  try{
   const parsed=parseRim4Agenda(await read(m.url));
   if(!parsed.items.length&&!parsed.committee){issues.push('Unbekanntes Format der Tagesordnung: '+m.url);return;}
   const meetingDate=parsed.date||m.date,known2=new Map();
   // The resolution of a past meeting stands in the process; a meeting still to come needs none.
   if(meetingDate<=today)await Promise.all(parsed.items.filter(i=>i.paper&&i.process).map(async i=>{const p=await processOf(i.process);if(p)known2.set(i.process,p);}));
   const rows=rim4Items(parsed,m,source,known2,now),print=period+(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.record,r.status])))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;return;}
   for(const row of rows){
    row.sourceData={version:'public-source-fields-v1',method:'sdnet-rim4',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:row.record}],detailStatus:'completed',issues:[]};delete row.record;
    row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
    const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);previous.identityLinks.push(...row.identityLinks);}else grouped.set(row.id,{...row,events:[row.event]});
   }
   held[m.url]=newMark({...m,date:meetingDate},print,now,rows.length);done++;
  }catch(e){if(/Zeitbudget/.test(e.message))unread++;else if(/HTTP 404/.test(e.message))warnings.push('Sitzung ohne Seite: '+m.date+' '+m.body);else issues.push(m.url+': '+e.message);}
  onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
 },2);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(limited)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),identityLinks:[...new Set(row.identityLinks)],documents:[...new Map([...row.documents,{title:'Tagesordnung',url:last.url,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche Seiten des Ratsinformationssystems (SD.NET RIM 4); nur der öffentliche Teil.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:meetings.size,...(withoutAgenda?{upcomingWithoutAgenda:withoutAgenda}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||limited?{resumable:true}:{}),...(warnings.length||part.warnings().length?{warnings:[...warnings,...part.warnings()]}:{}),sourceCount:1,quiet:topics.length===0&&unchanged===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0||withoutAgenda>0),issues:topics.length||unchanged||withoutAgenda?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
