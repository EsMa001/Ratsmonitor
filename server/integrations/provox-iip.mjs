import {sourceDecision,DECIDING_BODY} from './source-fields.mjs';
import {windowStart,historyWindow} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text,MAX_MEETINGS} from './sessionnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
import {committeePart} from './oparl-regional.mjs';
// Provox IIP ("Bürger- und Ratsinformationssystem" of Provox, ASP.NET, <host>/ris/<client>/…), as hosted by a
// municipality itself (ris.hameln.de/ris/hameln/). Read are plain addresses of the public site only:
// - meeting/ShowEvents?start=<day>&end=<day>: the JSON feed of the month calendar: id, body, start and, for a meeting
//   with a page, its address (a coming meeting without agenda has none),
// - meeting/details/<id>: body, day, place and the agenda. A block "Öffentlich" holds the items; the block
//   "Abstimmungsergebnisse" of a past meeting repeats them with the vote (thumb up/down, "Dafür/Dagegen/Enthalten"
//   in the title of its link). Only blocks marked "Öffentlich" are read (a guest never gets another),
// - agendaitem/details/<id>: the paper (Vorlage) of an item: title, department, resolution text, the file and the
//   "Beratungsfolge" with the votes of each body. Items without such a link (opening, minutes, announcements) carry no
//   matter of their own and are left out.
// Files (file/getfile/<id>) are only linked, not read. Login, members' area ("Erst Anmelden") and the pages of
// persons, votings and minutes extracts are never requested.
export const IIP_RESTRICTED='Nur nach Anmeldung; wird nicht abgefragt.';
const MONTHS={januar:1,februar:2,märz:3,maerz:3,april:4,mai:5,juni:6,juli:7,august:8,september:9,oktober:10,november:11,dezember:12};
const slug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const plain=html=>text(String(html).replace(/<br\s*\/?>/gi,' ')).normalize('NFC').replace(/ /g,' ').replace(/\s+/g,' ').trim();
const clip=(value,max)=>value.length>max?value.slice(0,max).replace(/\s+\S*$/,'')+' …':value;
const dayOf=value=>{
 const iso=String(value).match(/(\d{4})-(\d{2})-(\d{2})/);if(iso)return iso[0];
 const num=String(value).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);if(num)return `${num[3]}-${num[2].padStart(2,'0')}-${num[1].padStart(2,'0')}`;
 const word=String(value).match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s+(\d{4})/);
 const month=word&&MONTHS[word[2].toLowerCase()];
 return month?`${word[3]}-${String(month).padStart(2,'0')}-${word[1].padStart(2,'0')}`:null;
};
const EVENTS='meeting/ShowEvents';
// Pages the reader requests, relative to the client path (e.g. /ris/hameln/).
const PATHS=/^(?:meeting\/ShowEvents|meeting\/details\/\d+|agendaitem\/details\/\d+)$/;
const guard=(url,source)=>{const u=new URL(url),rest=u.pathname.slice(new URL(source.base).pathname.length);if(!PATHS.test(rest))throw Error('Nicht freigegebene Quelladresse');return url;};
/** Address of a page below the client path. */
export const iipUrl=(path,source)=>allowed(new URL(path,source.base).href,source);
export function detectProvoxIip(url,html=''){
 const page=String(html);
 if(!/Provox IIP/i.test(page)&&!/href="https?:\/\/www\.provox\.de"/i.test(page))return null;
 const m=String(url).match(/^(https:\/\/[^/]+\/ris\/[^/?#]+)(?:[/?#]|$)/i);
 return m?{adapter:'provox-iip',base:m[1]+'/'}:null;
}
/**
 * Meetings of the calendar feed: id, day, body (without the bell the calendar puts before a note), time and the
 * address of the meeting page (null while there is none). Newest first.
 */
export function iipMeetings(json,source){
 // With "Accept: application/json" the server sends the list as a JSON string inside JSON; unwrap up to twice.
 let list=json;try{for(let i=0;i<2&&typeof list==='string';i++)list=JSON.parse(list);}catch{return [];}
 if(!Array.isArray(list))return [];
 const rows=[];
 for(const e of list){
  const start=String(e?.start||''),id=String(e?.id??''),date=dayOf(start);
  if(!date||!/^\d+$/.test(id))continue;
  const body=String(e.title||'').replace(/^[^\p{L}\p{N}]+/u,'').trim();
  if(!body)continue;
  rows.push({id,date,body,time:start.match(/T(\d{2}:\d{2})/)?.[1]||'',url:e.url?iipUrl('meeting/details/'+id,source):null});
 }
 return rows.sort((a,b)=>b.date.localeCompare(a.date)||a.body.localeCompare(b.body,'de'));
}
/**
 * A meeting page: body, day, time, place and the public items with a paper: number, title, paper reference ("90/2026",
 * may be empty), address id of the paper, and the vote ({yes,no,abstain,outcome:'for'|'against'}) where one is shown.
 */
export function parseIipMeeting(html){
 const page=String(html),head=page.match(/<h4>\s*(?:<a\b[^>]*>)?([\s\S]*?)(?:<\/a>)?\s*<\/h4>/);
 const bodyText=plain(head?.[1]||'');
 const after=head?page.slice(head.index+head[0].length,head.index+head[0].length+1500):'';
 const date=dayOf(plain(after)),time=plain(after).match(/(\d{1,2}:\d{2})\s*Uhr/)?.[1]||'';
 const place=plain(after.match(/fa-building[^>]*>[^<]*<\/span>([\s\S]*?)<br/i)?.[1]||'');
 const byNumber=new Map();
 for(const block of page.split(/<div class="topic">/i).slice(1)){
  const header=block.match(/<div class="header">([\s\S]*?)<\/div>/i)?.[1]||'';
  // Only the public block; anything else is skipped.
  if(!/^\s*Öffentlich\s*$/i.test(plain(header.split('<div')[0])))continue;
  for(const chunk of block.split(/<div class="meetingitem"/i).slice(1)){
   const number=plain(chunk.match(/class="agendanumber">([\s\S]*?)<\/div>/)?.[1]||'').replace(/\.$/,'');
   const title=plain(chunk.match(/class="TOText"[^>]*>([\s\S]*?)<\/div>/)?.[1]||'');
   if(!/^\d+(?:\.\d+)*$/.test(number)||!title)continue;
   const paper=chunk.match(/agendaitem\/details\/(\d+)/)?.[1]||'';
   const reference=plain(chunk.match(/id="agendaitemnumber"[^>]*>([\s\S]*?)<\/span>/)?.[1]||'');
   const vote=chunk.match(/<a\b[^>]*title="Abstimmungsdetails:([^"]*)"[^>]*>\s*<span[^>]*fa-thumbs-(up|down)/);
   let voting=null;
   if(vote){
    const n=name=>Number(plain(vote[1]).match(new RegExp(name+':\\s*(\\d+)'))?.[1]??NaN);
    voting={yes:n('Dafür'),no:n('Dagegen'),abstain:n('Enthalten'),outcome:vote[2]==='up'?'for':'against'};
   }
   const key=number,was=byNumber.get(key);
   byNumber.set(key,{number,title,paper:paper||was?.paper||'',reference:reference||was?.reference||'',voting:voting||was?.voting||null});
  }
 }
 return {committee:bodyText,date,time,place,items:[...byNumber.values()]};
}
/**
 * A paper (Vorlage): title, department, resolution text, the file and the deliberations
 * ({meeting id, day, top, number, yes, no, abstain, outcome}).
 */
export function parseIipPaper(html){
 const page=String(html);
 const title=plain(page.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1]||'');
 const department=plain(page.match(/<dd class="aidepartment">([\s\S]*?)<\/dd>/)?.[1]||'');
 const resolution=plain(page.match(/<dt>Beschlusstext<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/)?.[1]||'');
 const file=page.match(/href="(\/ris\/[^"/]+\/file\/getfile\/\d+)"/)?.[1]||null;
 const table=page.match(/<th[^>]*>Beratungsfolge<\/th>([\s\S]*?)<\/table>/)?.[1]||'';
 const deliberations=[];
 for(const [,row] of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)){
  const meeting=row.match(/meeting\/details\/(\d+)/i)?.[1];if(!meeting)continue;
  const cells=[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(c=>c[1]);
  const [name,date,top,number,yes,no,abstain,thumb]=cells;
  const num=value=>/^\s*\d+\s*$/.test(plain(value||''))?Number(plain(value)):null;
  deliberations.push({meeting,body:plain(name),date:dayOf(plain(date||'')),top:plain(top||''),number:plain(number||''),yes:num(yes),no:num(no),abstain:num(abstain),outcome:/thumbs-up/.test(thumb||'')?'for':/thumbs-down/.test(thumb||'')?'against':null});
 }
 return {title,department,resolution:clip(resolution,2500),file,deliberations};
}
const voteText=v=>v?`Dafür: ${v.yes}, Dagegen: ${v.no}, Enthalten: ${v.abstain}`:'';
/** The reports of one meeting: a row per public item with a paper. papers: parsed papers by id. */
export function iipItems(parsed,meeting,source,papers=new Map(),now=new Date()){
 const date=parsed.date||meeting.date,committee=parsed.committee||meeting.body,today=now.toISOString().slice(0,10),past=date<=today;
 const decides=DECIDING_BODY.test(committee);
 return parsed.items.filter(i=>i.paper).map(i=>{
  const paper=papers.get(i.paper)||null;
  const turn=paper?.deliberations.find(d=>d.meeting===meeting.id)||null;
  let voting=i.voting;
  if(!voting&&turn&&turn.outcome&&Number.isFinite(turn.yes))voting={yes:turn.yes,no:turn.no,abstain:turn.abstain,outcome:turn.outcome};
  const status=!past?'consulting':!voting?'unknown':voting.outcome==='for'?(decides?'approved':'recommended'):(decides?'rejected':'recommended');
  const result=voting?`${voting.outcome==='for'?'Zugestimmt':'Abgelehnt'} (${voteText(voting)})`:'';
  const description=!past?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':result?`Abstimmung: ${result}`:'In der Tagesordnung geführt; kein Abstimmungsergebnis veröffentlicht.';
  const url=iipUrl('agendaitem/details/'+i.paper,source),reference=i.reference||'';
  const documents=[{title:'Vorlage'+(reference?' '+reference:''),url,kind:'html'}];
  if(paper?.file)documents.push({title:'Vorlagendokument'+(reference?' '+reference:''),url:new URL(paper.file,source.base).href,kind:'pdf'});
  return {id:`${source.id}-iip-${reference?slug(reference):'ai'+i.paper}`,title:paper?.title||i.title,reference,sourceUrl:url,identityLinks:[url],documents,status,text:paper?.resolution||'',
   record:{number:i.number,reference,paper:i.paper,department:paper?.department||'',vote:voting?voteText(voting):'',outcome:voting?.outcome||''},
   event:{date,committee,status,description,result,url:meeting.url,publicEvidence:'Öffentliche Tagesordnung'+(voting?' mit Abstimmungsergebnis':'')+`, TOP ${i.number}`}};
 });
}
// marks (optional): what earlier imports read completely, see meeting-marks.mjs.
export async function collectProvoxIip(source,{now=new Date(),get=fetchText,request=fetch,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 const guarded=(url,init)=>{guard(url,source);return request(url,init);};
 const read=target=>{const url=target.startsWith('http')?allowed(target,source):iipUrl(target,source);guard(url,source);return get(url,source,undefined,guarded);};
 const period=historyWindow(lookback)+':',from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10);
 const issues=[],warnings=[],meetings=new Map(),part=committeePart(source.organizations);
 let withoutAgenda=0;
 try{
  const end=new Date(now.getTime()+90*86400000).toISOString().slice(0,10);
  const rows=iipMeetings(await read(`${EVENTS}?start=${fromDay}&end=${end}`),source);
  if(!rows.length)throw Error('keine Sitzungen im Kalender');
  for(const r of rows){
   if(r.date<fromDay)continue;
   if(!part.keep(r.body,r.url||r.date+r.body))continue;
   if(!r.url){withoutAgenda++;continue;}
   meetings.set(r.url,r);
  }
 }catch(e){issues.push('Sitzungskalender: '+e.message);}
 const papers=new Map();
 const paperOf=async id=>{
  if(!papers.has(id))papers.set(id,read('agendaitem/details/'+id).then(parseIipPaper).catch(e=>{if(/Zeitbudget/.test(e.message))throw e;return null;}));
  return papers.get(id);
 };
 const grouped=new Map(),held={};let count=0,limited=false,unchanged=0,done=0,unread=0;
 await parallel([...meetings.values()].sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date)),async m=>{
  const mark=usableMark(marks,m,now),known=mark&&String(mark.print).startsWith(period)?mark:null;
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;return;}
  if(count>=MAX_MEETINGS){limited=true;return;}count++;
  try{
   const parsed=parseIipMeeting(await read('meeting/details/'+m.id));
   if(!parsed.items.length&&!parsed.committee){issues.push('Unbekanntes Format der Sitzung: '+m.url);return;}
   const meetingDate=parsed.date||m.date,known2=new Map();
   await Promise.all(parsed.items.filter(i=>i.paper).map(async i=>{const p=await paperOf(i.paper);if(p)known2.set(i.paper,p);}));
   const rows=iipItems(parsed,m,source,known2,now),print=period+(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.record,r.status])))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;return;}
   for(const row of rows){
    row.sourceData={version:'public-source-fields-v1',method:'provox-iip',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:row.record}],detailStatus:'completed',issues:[]};delete row.record;
    row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
    const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);previous.identityLinks.push(...row.identityLinks);if(row.text&&!previous.text)previous.text=row.text;}else grouped.set(row.id,{...row,events:[row.event]});
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
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n')+(row.text?'\n'+row.text:''),identityLinks:[...new Set(row.identityLinks)],documents:[...new Map([...row.documents,{title:'Sitzung',url:last.url,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;delete t.text;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche Seiten des Bürger- und Ratsinformationssystems (Provox IIP); nur der öffentliche Teil.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:meetings.size,...(withoutAgenda?{upcomingWithoutAgenda:withoutAgenda}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||limited?{resumable:true}:{}),...(warnings.length||part.warnings().length?{warnings:[...warnings,...part.warnings()]}:{}),sourceCount:1,quiet:topics.length===0&&unchanged===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0||withoutAgenda>0),issues:topics.length||unchanged||withoutAgenda?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
