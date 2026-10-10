import {sourceDecision,DECIDING_BODY} from './source-fields.mjs';
import {windowStart,historyWindow} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text,MAX_MEETINGS} from './sessionnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
import {committeePart} from './oparl-regional.mjs';
// Shared frame of the small readers (ris, hhdocuments, rio-sys, hitcom Rats-Info-System): each reader lists the meetings
// of the period and reads one page per meeting; this frame turns the items into reports (topics), keeps marks and builds
// the coverage in the same way as sdnet-rim4.mjs. Only public pages are read.
export const day=value=>{const m=String(value).match(/(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/);if(!m)return null;const y=m[3].length===2?'20'+m[3]:m[3];return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;};
export const slug=value=>String(value).toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const EXTRA={bdquo:'„',ldquo:'“',rdquo:'”',sbquo:'‚',lsquo:'‘',rsquo:'’',euro:'€',hellip:'…',sect:'§',laquo:'«',raquo:'»',middot:'·',shy:'',eacute:'é',egrave:'è',agrave:'à',ccedil:'ç',deg:'°',sup2:'²',sup3:'³',frac12:'½',bull:'•',times:'×',ensp:' ',emsp:' ',thinsp:' ',copy:'©',reg:'®',szlig:'ß'};
export const plain=html=>text(String(html).replace(/<br\s*\/?>/gi,' ').replace(/<\/p>/gi,' ').replace(/&(\w+);/g,(m,k)=>EXTRA[k]??m)).normalize('NFC').replace(/ /g,' ').replace(/\s+/g,' ').trim();
export const clip=(value,max)=>value.length>max?value.slice(0,max).replace(/\s+\S*$/,'')+' …':value;
/** Items every meeting has and that carry no matter of their own. */
export const FORMAL=/^(?:eröffnung|begrüßung|feststellung|genehmigung|bekanntgaben?|mitteilungen?|anfragen?|anregungen?|verschiedenes|einwohner|bürgerfragestunde|fragestunde|fragen|niederschrift|protokoll|sitzungsniederschrift|kurzbericht|schließung|ende der sitzung|wünsche|tagesordnung|regularien|verpflichtung)/i;
/** Status of an item from the resolution text of a past meeting. */
export function resolutionStatus(result,committee){
 const decides=DECIDING_BODY.test(committee);
 if(/zur kenntnis|kenntnisnahme/i.test(result)&&!/beschlu|beschließ/i.test(result))return 'info';
 if(/vertagt|zurückgestellt|abgesetzt|verschoben/i.test(result))return 'postponed';
 if(/abgelehnt|lehnt\b.*\bab\b/i.test(result))return decides?'rejected':'recommended';
 if(/beschließt|beschlossen|beschluss|zugestimmt|stimmt\b.*\bzu\b|angenommen|einstimmig|mehrheitlich|empfiehlt|empfohlen/i.test(result))return decides?'approved':'recommended';
 return 'unknown';
}
/**
 * Reports of one meeting. item: {key, number, title, reference?, documents:[{title,url}], result?, record?}.
 * A past item with a resolution text takes its status from it, a coming one is "consulting".
 */
export function smallItems(meeting,items,source,prefix,label,now=new Date()){
 const date=meeting.date,committee=meeting.body,today=now.toISOString().slice(0,10),past=date<=today;
 return items.map(i=>{
  const result=i.result||'',status=!past?'consulting':result?resolutionStatus(result,committee):'unknown';
  const description=!past?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':result?`Beschluss/Protokoll: ${clip(result,600)}`:'In der Tagesordnung geführt; ein Beschluss ist öffentlich nicht veröffentlicht.';
  return {id:`${source.id}-${prefix}-${i.key}`,title:i.title,reference:i.reference||i.number||i.key,sourceUrl:i.url||meeting.url,identityLinks:[],documents:(i.documents||[]).map(d=>({title:d.title,url:d.url,kind:/\.pdf\b|ceasy\/resource|file\.php|\/ris\//i.test(d.url)?'pdf':'html'})),status,
   record:{number:i.number||'',paper:i.reference||'',resolution:result?clip(result,600):'',...(i.record||{})},
   event:{date,committee,status,description,result:result?clip(result,600):'',url:meeting.url,publicEvidence:`Öffentliche Tagesordnung ${label}${i.number?', TOP '+i.number:''}`}};
 });
}
/**
 * Import frame. spec: {adapter, prefix, label, guard(url,source), listMeetings(read,{fromDay,today,now,source}) → [{url,date,body,...}],
 * readMeeting(read,meeting,source) → {date?,body?,items:[…],empty?}}. read(url) fetches one allowed page.
 */
export async function collectSmall(source,spec,{now=new Date(),get=fetchText,request=fetch,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 const guarded=(url,init)=>{spec.guard(url,source);return request(url,init);};
 const read=target=>{const url=allowed(new URL(target,source.base).href,source);spec.guard(url,source);return get(url,source,spec.timeoutMs,guarded);};
 const period=historyWindow(lookback)+':',from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10);
 const issues=[],warnings=[],meetings=new Map(),part=committeePart(source.organizations);
 let withoutAgenda=0;
 try{
  const rows=await spec.listMeetings(read,{fromDay,today,now,source});
  if(rows.issues?.length)issues.push(...rows.issues);
  if(!rows.length)throw Error('keine Sitzungen in der Übersicht');
  for(const r of rows){
   if(r.date<fromDay)continue;
   if(!part.keep(r.body,r.url||r.date+r.body))continue;
   if(!r.url){withoutAgenda++;continue;}
   meetings.set(r.url,r);
  }
 }catch(e){issues.push('Sitzungsübersicht: '+e.message);}
 const grouped=new Map(),held={};let count=0,limited=false,unchanged=0,done=0,unread=0;
 await parallel([...meetings.values()].sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date)),async m=>{
  const mark=usableMark(marks,m,now),known=mark&&String(mark.print).startsWith(period)?mark:null;
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;return;}
  if(count>=MAX_MEETINGS){limited=true;return;}count++;
  try{
   const parsed=await spec.readMeeting(read,m,source);
   if(parsed.empty){issues.push('Unbekanntes Format der Sitzungsseite: '+m.url);return;}
   const meeting={...m,date:parsed.date||m.date,body:parsed.body||m.body};
   const rows=smallItems(meeting,parsed.items,source,spec.prefix,spec.label,now),print=period+(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.record,r.status,r.documents.length])))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;return;}
   for(const row of rows){
    row.sourceData={version:'public-source-fields-v1',method:spec.adapter,fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:row.record}],detailStatus:'completed',issues:[]};delete row.record;
    row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
    const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);}else grouped.set(row.id,{...row,events:[row.event]});
   }
   held[m.url]=newMark(meeting,print,now,rows.length);done++;
  }catch(e){if(/Zeitbudget/.test(e.message))unread++;else if(/HTTP 404/.test(e.message))warnings.push('Sitzung ohne Seite: '+m.date+' '+m.body);else issues.push(m.url+': '+e.message);}
  onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
 },2);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(limited)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),identityLinks:[],documents:[...new Map([...row.documents,{title:'Sitzung',url:last.url,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:`Öffentliche Seiten (${spec.label}); nur der öffentliche Teil.`},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:meetings.size,...(withoutAgenda?{upcomingWithoutAgenda:withoutAgenda}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||limited?{resumable:true}:{}),...(warnings.length||part.warnings().length?{warnings:[...warnings,...part.warnings()]}:{}),sourceCount:1,quiet:topics.length===0&&unchanged===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0||withoutAgenda>0||meetings.size>0),issues:topics.length||unchanged||withoutAgenda||meetings.size?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
