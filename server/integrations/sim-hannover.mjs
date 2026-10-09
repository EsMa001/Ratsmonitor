import {sourceDecision} from './source-fields.mjs';
import {windowStart,historyWindow} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text,MAX_MEETINGS} from './sessionnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
// SIM, the Sitzungsmanagement of the Landeshauptstadt Hannover (e-government.hannover-stadt.de/lhhsimwebre.nsf, a Domino
// application of the city). Read are plain addresses of the public site only:
// - the list of a body (Termine.xsp for the Ratsversammlung, Termine.xsp?view=Termine&grem=<code> for a committee,
//   Termine.xsp?view=TermineSTBR<nn> for a district council; the links come from Ausschuesse.xsp and
//   AuswahlStadtbezirke.xsp): every meeting since 2003 as TM/<yyyymmdd>_<body>,
// - the meeting page TM/<key>: committee, day, place and the agenda; an item with a paper links DS/<number>,
// - the paper DS/<number>[N1]: text, attachments and the "Beratungsverlauf" with the result of each body
//   ("24.09.2026: Ratsversammlung: Einstimmig").
// Items without a paper (opening, minutes, announcements) carry no matter of their own and are left out. Pages of
// the item (TOPS/…) and the minutes (TO/…_P) are not read: confidential items state there that they are not published.
// robots.txt of the site allows everything except the bots "phantom" and "PhantomJS" (checked 09.10.2026).
export const SIM_RESTRICTED='Nicht zur Veröffentlichung im Internet freigegeben.';
const day=value=>{const m=String(value).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:null;};
const keyDay=key=>`${key.slice(0,4)}-${key.slice(4,6)}-${key.slice(6,8)}`;
const slug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const plain=html=>text(html).normalize('NFC').replace(/ /g,' ').replace(/\s+/g,' ').trim();
const clip=(value,max)=>value.length>max?value.slice(0,max).replace(/\s+\S*$/,'')+' …':value;
const PATHS=/^(?:Termine\.xsp|Ausschuesse\.xsp|AuswahlStadtbezirke\.xsp|TM\/\d{8}_[A-Za-z0-9]+|DS\/[0-9][\w-]*)$/;
// Only the public pages above, below the application path of the source.
const guard=(url,source)=>{const u=new URL(url),rest=u.pathname.slice(new URL(source.base).pathname.length);if(!PATHS.test(rest))throw Error('Nicht freigegebene Quelladresse');return url;};
/** Address of a page below the application. */
export const simUrl=(path,source)=>allowed(new URL(path,source.base).href,source);
export function detectSimHannover(url,html=''){
 const m=String(url).match(/^(https:\/\/[^/]+\/[^/]*\.nsf)\//i)||String(url).match(/^(https:\/\/[^/]+\/[^/]*\.nsf)$/i);
 if(!/lhhsimwebre\.nsf/i.test(url)&&!/lhhsimwebre\.nsf\/TermineAktuell\.xsp/.test(html))return null;
 return m?{adapter:'sim-hannover',base:m[1]+'/'}:null;
}
/** Lists of the bodies named by the committee page and the district page: relative addresses of their meeting lists. */
export function simListLinks(html){
 return [...new Set([...String(html).matchAll(/href="(Termine\.xsp\?view=[^"]+)"/g)].map(m=>m[1].replace(/&amp;/g,'&')))];
}
/** Meetings of a list page: key (TM/<key>), day and body code; each meeting once, newest first. */
export function simMeetingRows(html){
 const seen=new Map();
 for(const m of String(html).matchAll(/href="?TM\/((\d{8})_([A-Za-z0-9]+))"?/g))if(!seen.has(m[1]))seen.set(m[1],{key:m[1],date:keyDay(m[1]),body:m[3]});
 return [...seen.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.key.localeCompare(b.key));
}
// "Drucks. Nr. 1389/2026 N1" (also "Informationsdrucks."), the paper of an item without a link to it.
const REFERENCE=/\((?:Informations)?[Dd]rucks\.\s*Nr\.\s*((?:\d{2}-)?\d{3,5})\/(\d{4})(?:\s*([A-Z]\d+))?\)/;
/** Key of a paper as the site addresses it: DS/<number>-<year>[N1]. */
export const simPaperKey=reference=>String(reference).replace(/^DS\//,'').trim();
const paperFromTitle=title=>{const m=title.match(REFERENCE);return m?`${m[1]}-${m[2]}${m[3]||''}`:null;};
// 1389-2026N1 and 1389-2026 are versions of one matter; the number and the year name it.
const matterOf=key=>key.replace(/(?:[A-Z]\d+)+$/,'');
/**
 * A meeting page: body, day, place, time, whether minutes exist and the items with a paper: number, title without the
 * reference, paper key and reference ("1389/2026 N1").
 */
export function parseSimMeeting(html){
 const page=String(html);
 const field=name=>{const m=page.match(new RegExp(`<th scope="row">${name}:</th><td[^>]*>([\\s\\S]*?)</td>`));return m?plain(m[1]):'';};
 const items=[];
 for(const [row] of page.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)){
  const cells=[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(c=>c[1]);
  if(cells.length<4)continue;
  const number=plain(cells[2]).replace(/\.$/,'');
  if(!/^\d+(?:\.\d+)*$/.test(number))continue;
  const link=cells[3].match(/<a\b[^>]*href=["']?(DS|TOPS)\/([^"'\s>]+)[^>]*>([\s\S]*?)<\/a>/i);
  if(!link)continue;
  const full=plain(link[3]),paper=link[1].toUpperCase()==='DS'?simPaperKey(link[2]):paperFromTitle(full);
  if(!paper)continue;
  const ref=full.match(REFERENCE);
  items.push({number,title:full.replace(REFERENCE,'').replace(/\s+/g,' ').trim(),paper,reference:ref?`${ref[1]}/${ref[2]}${ref[3]?' '+ref[3]:''}`:paper.replace(/-(\d{4})/,'/$1')});
 }
 return {committee:field('Gremium'),date:day(field('Sitzungsdatum')),place:field('Tagungsort'),time:field('Beginn'),minutes:/href=["']?TO\/\d{8}_[A-Za-z0-9]+_P["' >]/.test(page),items:items.filter(i=>i.title)};
}
/**
 * A paper: number, title, kind ("Beschlussdrucksache", "Antrag" …), the deliberations (day, body, meeting key and result
 * from the "Beratungsverlauf") and the text, or {restricted: true} for a paper that is not published.
 */
export function parseSimPaper(html){
 const page=String(html);
 if(/nicht zur Veröffentlichung im Internet freigegeben/i.test(page)&&!/Inhalt der Drucksache/.test(page))return {restricted:true};
 const flat=plain(page.slice(page.search(/<body/i)>=0?page.search(/<body/i):0));
 const head=flat.match(/Drucksache Nr\.\s*([\d/]+(?:\s*[A-Z]\d+)*)\s*:\s*(.*?)\s*Informationen:/);
 const block=page.match(/Beratungsverlauf:<\/h4>\s*<ul[^>]*>([\s\S]*?)<\/ul>/)?.[1]||'';
 const deliberations=[...block.matchAll(/<li\b[^>]*>\s*<a\b[^>]*href="[^"]*\/TM\/(\d{8}_[A-Za-z0-9]+)"[^>]*>\s*([\d.]+):\s*([^<]*?)\s*<\/a>\s*:?\s*([^<]*?)\s*<\/li>/g)]
  .map(m=>({key:m[1],date:day(m[2])||keyDay(m[1]),body:plain(m[3]),result:plain(m[4])}));
 const content=flat.split('Inhalt der Drucksache:')[1]||'';
 const body=content.replace(/^\s*Bitte beachten Sie[^"]*"[^"]*"\.\s*/,'').trim();
 return {number:head?.[1]?.replace(/\s+/g,' ')||'',title:head?.[2]||'',deliberations,text:clip(body,2500),attachments:[...page.matchAll(/<li class="att"><a\b[^>]*>([^<]*)<\/a>/g)].map(m=>plain(m[1]))};
}
const DECIDING=/^(?:Ratsversammlung|Verwaltungsausschuss)\b/;
/** Status of a result such as "Einstimmig" or "Zur Kenntnis genommen"; only the deciding bodies approve or reject. */
export function simStatus(result,body){
 const r=String(result||'').trim();if(!r)return null;
 const decides=DECIDING.test(body);
 if(/zur kenntnis/i.test(r))return 'info';
 if(/vertagt|zurückgestellt|verschoben|in die (?:\S+ )?(?:Fraktion|Gruppe)n?\b.*gezogen|in die Fraktion/i.test(r))return 'postponed';
 // "6 Stimmen dafür, 5 Stimmen dagegen, 0 Enthaltungen"
 const votes=r.match(/(\d+)\s+Stimmen?\s+dafür.*?(\d+)\s+Stimmen?\s+dagegen/i);
 if(votes)return Number(votes[1])>Number(votes[2])?(decides?'approved':'recommended'):(decides?'rejected':'recommended');
 if(/abgelehnt|ablehn/i.test(r))return decides?'rejected':'recommended';
 if(/einstimmig|mehrheitlich|beschlossen|zugestimmt|angenommen|empfohlen|befürwortet|genehmigt|bestätigt|verabschiedet|einvernehmen|mit Änderung/i.test(r))return decides?'approved':'recommended';
 return null;
}
/** The reports of one meeting: a row per item with a paper, with its event. papers: parsed papers by key. */
export function simItems(parsed,meeting,source,papers=new Map(),now=new Date()){
 const date=parsed.date||meeting.date,committee=parsed.committee||meeting.body,today=now.toISOString().slice(0,10),past=date<=today;
 return parsed.items.map(i=>{
  const paper=papers.get(i.paper)||null,url=simUrl('DS/'+i.paper,source),matter=matterOf(i.paper);
  const turn=paper?.deliberations?.find(d=>d.key===meeting.key)||null,result=turn?.result||'';
  const status=!past?'consulting':simStatus(result,committee)||'unknown';
  const description=!past?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':result?`Ergebnis: ${result}`:'Im Beratungsverlauf der Drucksache ohne Ergebnis geführt.';
  return {id:`${source.id}-ds-${slug(matter)}`,title:paper?.title||i.title,reference:i.reference,sourceUrl:url,identityLinks:[url],documents:[{title:'Drucksache '+i.reference,url,kind:'html'}],status,text:paper?.text||'',
   record:{number:i.number,reference:i.reference,paper:i.paper,result,attachments:paper?.attachments||[]},
   event:{date,committee,status,description,result,url:meeting.url,publicEvidence:(past&&parsed.minutes?'Öffentliche Sitzung mit Protokoll':'Öffentliche Tagesordnung')+`, TOP ${i.number}`}};
 });
}
// marks (optional): what earlier imports read completely, see meeting-marks.mjs.
export async function collectSimHannover(source,{now=new Date(),get=fetchText,request=fetch,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 const guarded=(url,init)=>{guard(url,source);return request(url,init);};
 const read=path=>{const url=simUrl(path,source);guard(url,source);return get(url,source,undefined,guarded);};
 const period=historyWindow(lookback)+':',from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10);
 const issues=[],warnings=[],meetings=new Map();
 // 1. The lists of all bodies: the Ratsversammlung first, then committees and district councils.
 let lists=['Termine.xsp'];
 for(const page of ['Ausschuesse.xsp','AuswahlStadtbezirke.xsp']){
  try{lists.push(...simListLinks(await read(page)));}catch(e){issues.push(`${page}: ${e.message}`);}
 }
 lists=[...new Set(lists)];
 await parallel(lists,async list=>{
  try{
   const rows=simMeetingRows(await read(list));
   if(!rows.length)throw Error('keine Sitzungen');
   for(const r of rows)if(r.date>=fromDay&&!meetings.has(r.key))meetings.set(r.key,{...r,url:simUrl('TM/'+r.key,source)});
  }catch(e){issues.push(`Sitzungsliste ${list}: ${e.message}`);}
 },2);
 // Papers are read once per run, also when several meetings of the period deal with them.
 const papers=new Map();
 const paperOf=async key=>{
  if(!papers.has(key))papers.set(key,read('DS/'+key).then(parseSimPaper).then(p=>p.restricted?null:p).catch(e=>{if(/Zeitbudget/.test(e.message))throw e;return null;}));
  return papers.get(key);
 };
 const grouped=new Map(),held={};let count=0,limited=false,unchanged=0,done=0,unread=0;
 await parallel([...meetings.values()].sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date)),async m=>{
  const mark=usableMark(marks,m,now),known=mark&&String(mark.print).startsWith(period)?mark:null;
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;return;}
  if(count>=MAX_MEETINGS){limited=true;return;}count++;
  try{
   const parsed=parseSimMeeting(await read('TM/'+m.key));
   if(!parsed.items.length&&!parsed.committee){issues.push('Unbekanntes Format der Sitzung: '+m.url);return;}
   const meetingDate=parsed.date||m.date,known2=new Map();
   // The result of a past meeting stands in the paper; a meeting still to come needs no paper.
   if(meetingDate<=today)await Promise.all(parsed.items.map(async i=>{const p=await paperOf(i.paper);if(p)known2.set(i.paper,p);}));
   const rows=simItems(parsed,m,source,known2,now),print=period+(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.record,r.status])))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;return;}
   for(const row of rows){
    row.sourceData={version:'public-source-fields-v1',method:'sim-hannover',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:row.record}],detailStatus:'completed',issues:[]};delete row.record;
    row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
    const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);previous.identityLinks.push(...row.identityLinks);if(row.text&&!previous.text)previous.text=row.text;}else grouped.set(row.id,{...row,events:[row.event]});
   }
   held[m.url]=newMark({...m,date:meetingDate},print,now,rows.length);done++;
  }catch(e){if(/Zeitbudget/.test(e.message))unread++;else if(/HTTP 404/.test(e.message))warnings.push('Sitzung ohne Seite (geplant oder ausgefallen): '+m.key);else issues.push(m.url+': '+e.message);}
  onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
 },2);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(limited)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n')+(row.text?'\n'+row.text:''),identityLinks:[...new Set(row.identityLinks)],documents:[...new Map([...row.documents,{title:'Sitzung',url:last.url,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;delete t.text;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche Seiten des Sitzungsmanagements der Landeshauptstadt Hannover.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:meetings.size,...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||limited?{resumable:true}:{}),...(warnings.length?{warnings}:{}),sourceCount:1,quiet:topics.length===0&&unchanged===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
