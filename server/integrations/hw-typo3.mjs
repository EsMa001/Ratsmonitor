import {sourceDecision,DECIDING_BODY} from './source-fields.mjs';
import {windowStart,historyWindow} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text,MAX_MEETINGS} from './sessionnet.mjs';
import {resultStatus} from './sdnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
import {committeePart} from './oparl-regional.mjs';
// Ratsinformationsmodul "hwratssystem" of Hirsch & Wölfl (TYPO3 extension in the websites of small municipalities,
// Baden-Württemberg). Read are plain addresses of the public site only, all below the page of the meeting calendar
// (source.base = address of that page, e.g. …/ratsinformationssystem/sitzungskalender):
// - the calendar page itself: it names the plugin (pUid) whose month data the page loads by script,
// - the month data of the calendar (the page's own script asks for it, ?tx_hwratssystem_sitzungstermincalendar[…]&pUid=…
//   &type=20230522): JSON with every meeting of the month, its public items (tagesOrdnungsPunkte) with description,
//   resolution text and files. The non-public items (tagesOrdnungsPunkteNoe) are never read.
// Documents (index.php?eID=dumpFile…) are only linked, not read here. A site without items in the data of its meetings
// (Leimen: one collected PDF per meeting) yields no reports.
export const HW_TYPO3='hw-typo3';
const PLUGIN=/hwratssystem__sitzungstermin__calendar_wrapper/;
const ROUTE='tx_hwratssystem_sitzungstermincalendar';
const slug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const plain=html=>text(String(html||'').replace(/<br\s*\/?>/gi,' ').replace(/<\/p>/gi,' ')).normalize('NFC').replace(/ /g,' ').replace(/\s+/g,' ').trim();
// Items that are no matter of their own: formal points of every session.
const FORMAL=/^(?:eröffnung|begrüßung|feststellung der|bürgerfragestunde|einwohnerfragestunde|einwohnerfrage|fragestunde|bürgerfrage|bekanntgabe|bekanntgaben|verschiedenes|anfragen|anregungen|fragen und anträge|wünsche|mitteilungen|schlusswort|genehmigung (?:der |des )?(?:niederschrift|protokoll)|kenntnisnahme (?:der |des )?(?:niederschrift|protokoll)|protokoll|niederschrift|tagesordnung|nicht\s*öffentlich|ende der sitzung)/i;
/** Address of the calendar page, or of its month data, below the application (the base is the calendar page). */
export const hwUrl=(source,month)=>{
 const u=new URL(source.base);
 if(month){
  u.search='';
  for(const [k,v] of Object.entries({action:'calendar',controller:'SitzungsterminCalendarFrontend',ajax:'true',month:month.month,year:month.year}))u.searchParams.set(`${ROUTE}[${k}]`,v);
  u.searchParams.set('pUid',month.pUid);u.searchParams.set('type','20230522');
 }
 return allowed(u.href,source);
};
/** The calendar page of a site with this module: {adapter, base}, otherwise null. */
export function detectHw(url,html=''){
 if(!PLUGIN.test(String(html))||!/id="calendar"[^>]*data-json=/.test(String(html)))return null;
 const u=new URL(url);if(u.protocol!=='https:')return null;
 return {adapter:HW_TYPO3,base:u.origin+u.pathname};
}
/** Number of the plugin on the calendar page (its month data are asked with it). */
export function hwPlugin(html){
 const page=String(html),named=page.match(/hwratssystem__sitzungstermin__calendar__(\d+)/);if(named)return named[1];
 const at=page.search(PLUGIN);if(at<0)return null;
 return [...page.slice(0,at).matchAll(/id="c(\d+)"/g)].at(-1)?.[1]||null;
}
const files=value=>(Array.isArray(value)?value:Object.values(value||{})).filter(f=>f&&f.url).map(f=>({title:plain(f.title||'')||'Dokument',url:String(f.url).replace(/&amp;/g,'&')}));
const absolute=(path,source)=>{try{return allowed(new URL(path,source.base).href.replace(/#.*$/,''),{...source,base:new URL(source.base).origin+'/'});}catch{return null;}};
/** The meetings of a month data answer: [{id, date, time, title, committee, place, url, items:[…]}], newest first. Not JSON → null. */
export function parseHwMonth(json,source={base:'https://example.invalid/'}){
 let events;try{events=typeof json==='string'?JSON.parse(json):json;}catch{return null;}
 if(!Array.isArray(events))return null;
 const rows=[];
 for(const e of events){
  const start=String(e?.start||'').match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}:\d{2}))?/);if(!start||!e.id)continue;
  const x=e.extendedProps||{},title=plain(e.title||''),gremium=plain(e.gremium||x.basicTerminInfos?.gremium||'');
  // Some sites file every meeting under one generic body ("Ratssystem"); the title then names the body.
  const committee=!gremium||/^ratssystem$/i.test(gremium)?title.replace(/\s*\d{1,2}\.\d{1,2}\.(?:\d{2}){1,2}\s*/g,' ').replace(/s?sitzung.*$/i,'').trim()||title:gremium;
  const tops=x.tagesOrdnungsPunkte,list=Array.isArray(tops)?tops.map((t,i)=>[String(i+1),t]):Object.entries(tops||{});
  const items=list.map(([key,t])=>{
   if(!t||typeof t!=='object')return null;
   const raw=plain(t.bezeichnung||''),m=raw.match(/^(?:TOP\s*)?(\d+(?:\.\d+)*)\s*[.):-]?\s+(.*)$/i);
   const name=(m?m[2]:raw).trim(),number=m?m[1]:key;
   return {number,key,title:name,description:plain(t.beschreibung||''),resolution:plain([t.beschlussText,t.text1,t.text2,t.text3].filter(Boolean).join(' ')).slice(0,1500),
    documents:[...files(t.dateien),...files(t.beschlussvorlageDateien),...files(t.beschlussDateien)]};
  }).filter(i=>i&&i.title);
  rows.push({id:String(e.id).replace(/^sitzung_/,''),date:start[1],time:start[2]||'',title,committee,place:plain(e.ort||''),
   url:x.sitzungsterminUrl?absolute(x.sitzungsterminUrl,source):null,invitation:files(x.additionalTerminInfos?.einladungDateien),items});
 }
 return rows.sort((a,b)=>b.date.localeCompare(a.date)||a.committee.localeCompare(b.committee,'de'));
}
// resultStatus knows the wording of resolutions in SD.NET; the text of this module is free as well.
const statusOf=(resolution,committee)=>{
 const r=resultStatus(resolution,committee);if(r)return r;
 const decides=DECIDING_BODY.test(committee);
 if(/zur kenntnis/i.test(resolution))return 'info';
 if(/vertagt|zurückgestellt|verschoben/i.test(resolution))return 'postponed';
 if(/abgelehnt|lehnt\b.*\bab\b/i.test(resolution))return decides?'rejected':'recommended';
 if(/beschließt|beschlossen|zugestimmt|stimmt\b.*\bzu\b|angenommen|empfiehlt|empfohlen|einstimmig|mehrheitlich/i.test(resolution))return decides?'approved':'recommended';
 return 'unknown';
};
/** The reports of one meeting: a row per public item that is no formal point of the session. */
export function hwItems(meeting,source,now=new Date()){
 const date=meeting.date,today=now.toISOString().slice(0,10),past=date<=today;
 return meeting.items.filter(i=>!FORMAL.test(i.title)).map(i=>{
  const resolution=i.resolution,status=!past?'consulting':resolution?statusOf(resolution,meeting.committee):'unknown';
  const description=!past?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':resolution?`Beschluss: ${resolution}`:'In der Tagesordnung geführt; veröffentlicht ist kein Beschluss.';
  const url=meeting.url||source.base;
  return {id:`${source.id}-hw-${slug(meeting.id)}-${slug(i.key)}`,title:i.title,reference:`${meeting.committee} ${date} TOP ${i.number}`,sourceUrl:url,identityLinks:[],documents:i.documents.map(d=>({title:d.title,url:d.url,kind:'pdf'})),status,
   record:{number:i.number,description:i.description,resolution,committee:meeting.committee,place:meeting.place},
   event:{date,committee:meeting.committee,status,description,result:resolution,url,publicEvidence:`Öffentliche Tagesordnung, TOP ${i.number}`}};
 });
}
const monthsBetween=(from,until)=>{
 const out=[];let y=from.getUTCFullYear(),m=from.getUTCMonth();
 while(y<until.getUTCFullYear()||y===until.getUTCFullYear()&&m<=until.getUTCMonth()){out.push({year:y,month:m+1});m++;if(m>11){m=0;y++;}}
 return out;
};
// marks (optional): what earlier imports read completely, see meeting-marks.mjs.
export async function collectHwTypo3(source,{now=new Date(),get=fetchText,request=fetch,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 const guarded=(url,init)=>{allowed(url,source);return request(url,init);};
 const read=url=>get(allowed(url,source),source,undefined,guarded);
 const period=historyWindow(lookback)+':',from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10);
 const until=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+2,1));
 const issues=[],warnings=[],meetings=new Map(),part=committeePart(source.organizations);
 let unread=0,noItems=0;
 try{
  const page=await read(hwUrl(source)),plugin=hwPlugin(page);
  if(!plugin||!PLUGIN.test(page))throw Error('Kein Sitzungskalender des Ratsinformationsmoduls auf der Seite');
  const months=monthsBetween(from,until).reverse(),found=new Map();
  await parallel(months,async m=>{
   try{
    const rows=parseHwMonth(await read(hwUrl(source,{...m,pUid:plugin})),source);
    if(!rows)throw Error('Unbekanntes Format der Monatsdaten '+String(m.month).padStart(2,'0')+'/'+m.year);
    for(const r of rows)found.set(r.id,r);
   }catch(e){if(/Zeitbudget/.test(e.message))unread++;else issues.push('Sitzungskalender: '+e.message);}
  },2);
  for(const r of [...found.values()].sort((a,b)=>b.date.localeCompare(a.date))){
   if(r.date<fromDay)continue;
   if(!part.keep(r.committee,r.id))continue;
   if(!r.items.length){noItems++;continue;}
   meetings.set(r.url||source.base+'#'+r.id,{...r,url:r.url||source.base+'#'+r.id});
  }
 }catch(e){if(/Zeitbudget/.test(e.message))unread++;else issues.push('Sitzungskalender: '+e.message);}
 const grouped=new Map(),held={};let count=0,limited=false,unchanged=0,done=0;
 for(const m of [...meetings.values()].sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date))){
  const mark=usableMark(marks,m,now),known=mark&&String(mark.print).startsWith(period)?mark:null;
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;continue;}
  if(count>=MAX_MEETINGS){limited=true;continue;}count++;
  const rows=hwItems(m,source,now),print=period+(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.record,r.status,r.documents.length])))).slice(0,16);
  if(!rows.length){noItems++;continue;}
  if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;continue;}
  for(const row of rows){
   row.sourceData={version:'public-source-fields-v1',method:HW_TYPO3,fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:row.record}],detailStatus:'completed',issues:[]};delete row.record;
   row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
   const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);}else grouped.set(row.id,{...row,events:[row.event]});
  }
  held[m.url]=newMark(m,print,now,rows.length);done++;
  onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
 }
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Monat':'Monate'} noch nicht gelesen.`);
 if(limited)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Tagesordnungspunkt: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),identityLinks:[],documents:[...new Map([...row.documents,{title:'Tagesordnung',url:last.url,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche Seiten des Ratsinformationsmoduls der Gemeinde (Hirsch & Wölfl); nur der öffentliche Teil.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:meetings.size+noItems,...(noItems?{meetingsWithoutItems:noItems}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||limited?{resumable:true}:{}),...(warnings.length||part.warnings().length?{warnings:[...warnings,...part.warnings()]}:{}),sourceCount:1,quiet:topics.length===0&&unchanged===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0||noItems>0),issues:topics.length||unchanged||noItems?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
