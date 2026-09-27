import {historyStart,HISTORY_MONTHS} from './history-window.mjs';
import {budgeted} from './request-budget.mjs';
import {hash,category,sourceSummary,parallel} from './oparl.mjs';
const entities={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',ouml:'ö',auml:'ä',uuml:'ü',Ouml:'Ö',Auml:'Ä',Uuml:'Ü',szlig:'ß',ndash:'-',mdash:'-'};
export function decode(s){return String(s||'').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi,(m,k)=>k[0]==='#'?String.fromCodePoint(k[1].toLowerCase()==='x'?parseInt(k.slice(2),16):Number(k.slice(1))):entities[k]??m)}
export function text(s){return decode(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim()}
export function links(h,base){return [...h.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)].map(m=>({url:new URL(decode(m[2]),base).href,label:text(m[4]),title:decode((m[1]+m[3]).match(/(?:aria-label|title)=["']([^"']*)/)?.[1]||'')}));}
export function allowed(url,source){const u=new URL(url),b=new URL(source.base);if(u.protocol!=='https:'||u.origin!==b.origin||!u.pathname.toLowerCase().startsWith(b.pathname.toLowerCase())||u.username||u.password)throw Error('Nicht freigegebene Quelladresse');return u.href;}
export async function fetchText(url,source,timeoutMs=20000,request=fetch){
 const deadline=Date.now()+timeoutMs,seen=new Set();let next=allowed(url,source);
 for(let hop=0;hop<=3;hop++){
  if(seen.has(next))throw Error('Wiederholte Weiterleitung der Quelle');seen.add(next);
  const remaining=deadline-Date.now();if(remaining<=0)throw Error('Zeitbudget der Quelle erreicht');
  const r=await request(next,{redirect:'manual',signal:AbortSignal.timeout(remaining),headers:{'User-Agent':'VorOrt-PoliticalTopics/0.5 (public council documents)','Accept':'text/html,application/json'}});
  if([301,302,303,307,308].includes(r.status)){
   const location=r.headers.get('location');await r.body?.cancel();
   if(!location)throw Error('Weiterleitung ohne Zieladresse');
   if(hop===3)throw Error('Weiterleitungslimit der Quelle erreicht');
   next=allowed(new URL(location,next).href,source);continue;
  }
  if(!r.ok){await r.body?.cancel();throw Error('Quelle antwortet mit HTTP '+r.status);}
  const b=await r.arrayBuffer();if(b.byteLength>4e6)throw Error('Quelldokument zu groß');const probe=new TextDecoder().decode(b.slice(0,2000));const latin=/charset=["']?(?:iso-8859-1|windows-1252)/i.test(r.headers.get('content-type')||'')||/charset=(?:iso-8859-1|windows-1252)/i.test(probe);return new TextDecoder(latin?'windows-1252':'utf-8').decode(b);
 }
}
export function missingAgendaIssue(html,url){return /Zu dieser Sitzung wurden noch keine Detailinformationen freigegeben/i.test(text(html))?'Sitzungsdetails noch nicht öffentlich freigegeben: '+url:'Keine lesbare öffentliche Tagesordnung: '+url;}
export function meetingRows(h,base){return links(h,base).filter(l=>/si0057\.(asp|php)/.test(l.url)&&/\d{2}\.\d{2}\.\d{4}/.test(l.title)).map(l=>{const date=l.title.match(/(\d{2})\.(\d{2})\.(\d{4})/);return {...l,date:`${date[3]}-${date[2]}-${date[1]}`,committee:l.title.replace(/^Details anzeigen:\s*/,'').replace(/\s*\d{2}\.\d{2}\.\d{4}.*/,'')};});}
export function parseAgenda(h,meeting,source,now=new Date()){
 const result=[];let ordinal=0;
 for(const m of h.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const row=m[1];if(!/class=["'][^"']*tofnum/.test(row))continue;
  const number=text(row.match(/<td[^>]*class=["'][^"']*tofnum[^"']*["'][^>]*>([\s\S]*?)<\/td>/)?.[1]);
  if(!/^Ö\s+\d/.test(number))continue;ordinal++;
  const all=links(row,source.base),paper=all.find(l=>/vo0050\.(asp|php)/.test(l.url)),top=all.find(l=>/to0050\.(asp|php)/.test(l.url));
  const cell=row.match(/<td[^>]*class=["'][^"']*(?:tolink|tobetr)[^"']*["'][^>]*>([\s\S]*?)<\/td>/)?.[1]||'';
  const title=text(cell.match(/<div[^>]*smc-card-header-title[^>]*>([\s\S]*?)<\/div>/)?.[1]||cell.split(/Beschluss:|Abstimmung:/)[0]);
  if(!title)continue;
  const raw=text(cell),decision=raw.match(/Beschluss:\s*(.*?)(?:Abstimmung:|$)/)?.[1]?.trim()||'';
  let status=meeting.date>now.toISOString().slice(0,10)?(paper?'consulting':'announced'):'unknown';
  if(meeting.date>now.toISOString().slice(0,10)){}
  else if(/vertagt|zurückgestellt|abgesetzt/i.test(decision))status='postponed';
  else if(/kenntnis/i.test(decision))status='info';
  else if(/empfohl/i.test(decision))status='recommended';
  else if(/beschlossen|zugestimmt|angenommen|abgelehnt/i.test(decision))status=/^(Rat|Gemeinderat|Stadtrat|Stadtverordnetenversammlung|Kreistag)(\s|$)/i.test(meeting.committee)?(/abgelehnt/i.test(decision)?'rejected':'approved'):'recommended';
  const url=paper?.url||top?.url||meeting.url;const key=paper?new URL(paper.url).searchParams.get('__kvonr'):new URL(meeting.url).searchParams.get('__ksinr')+'-'+number.replace(/\D+/g,'-');
  result.push({id:`${source.id}-${paper?'vo':'top'}-${key}`,title,reference:paper?.label||'',sourceUrl:url,identityLinks:[paper?.url,top?.url].filter(Boolean),status,documents:[...new Map(all.filter(l=>/getfile\.|\/getfile|\.pdf/i.test(l.url)).map(l=>[l.url,{title:l.label||'Originalunterlage',url:allowed(l.url,source),kind:'application/pdf'}])).values()],event:{date:meeting.date,committee:meeting.committee,status,description:decision||'Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Abschnitt nicht belegt.',result:decision,url:meeting.url}});
 }
 return result;
}
export async function collectSessionNet(source,{now=new Date(),get=fetchText,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{}}={}){
 get=budgeted(get,maxDurationMs,2);
 const from=historyStart(now);const fromDay=from.toISOString().slice(0,10),issues=[],meetings=new Map();
 // Calendar months cover the rolling twelve months and already published next-month meetings.
 let denied=false;
 await parallel(Array.from({length:HISTORY_MONTHS+2},(_,i)=>1-i),async offset=>{
  if(denied)return;
  const date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+offset,1));const url=source.base+`si0040.${source.extension}?__cjahr=${date.getUTCFullYear()}&__cmonat=${date.getUTCMonth()+1}`;
  try{const html=await get(url,source);if(!/sessionnet|si0040/i.test(html))throw Error('Unbekanntes Kalenderformat');for(const m of meetingRows(html,source.base))if(m.date>=fromDay)meetings.set(m.url,m);}catch(e){issues.push(e.message);if(/403|401/.test(e.message))denied=true;}
 },3);
 const grouped=new Map();let count=0;
 if(meetings.size>400)issues.push("Sitzungslimit erreicht; weiterer Import erforderlich.");
 await parallel([...meetings.values()].sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date)).slice(0,400),async m=>{
  try{const h=await get(m.url,source);if(!/tofnum/.test(h)) {issues.push(missingAgendaIssue(h,m.url));return;}
   for(const row of parseAgenda(h,m,source,now)){const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);previous.identityLinks.push(...row.identityLinks);}else grouped.set(row.id,{...row,events:[row.event]});}
  }catch(e){issues.push(m.url+': '+e.message);}count++;onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
 },3);
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),documents:[...new Map([...row.documents,{title:'Vorlage / öffentliche Tagesordnung',url:row.sourceUrl,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche SessionNet-Seite; konservative Statusauswertung.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 return {topics,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:now.toISOString().slice(0,10),importedAt:now.toISOString(),meetings:meetings.size,sourceCount:1,complete:issues.length===0&&topics.length>0,issues:topics.length?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
