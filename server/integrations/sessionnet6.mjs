import {sourceDecision} from './source-fields.mjs';
import {windowStart} from './history-window.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text,MAX_MEETINGS} from './sessionnet.mjs';
import {resultStatus} from './sdnet.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
// Public JSON interface of SessionNet 6 (Somacos). The citizens' information system is an Angular app ("SessionNet |
// Bürgerinformationssystem") that reads everything from <base>api/v1/. The reader asks the addresses the app asks for
// its calendar and its meeting page, and nothing else: the meeting list of a period (sitzungen?von&bis), the agenda
// of a meeting (sitzungen/{siNr}/tagesordnung), the documents of its agenda items (…/tagesordnung/dokumente) and the
// names of the committees (gremien). No members, persons, attendance or search.
// - The app opens a meeting only once it is released (freigabeDatum); other meetings are not asked.
// - The interface returns the public part of an agenda only (the app shows "Öffentlicher Teil"); every item is still
//   checked for oSt 1 (public), anything else is dropped.
// - HTTP 401, 403 or 429 (also a firewall's rejection page) ends the import at once and is not repeated.
const day=date=>date.toISOString().slice(0,10),DAY=86400000,SPAN=91;
const TOO_MANY='Quelle meldet zu viele Zugriffe; Abruf beendet.';
const closed=status=>`Schnittstelle verweigert den Zugriff (HTTP ${status}); Abruf beendet.`;
const digits=value=>/^\d+$/.test(String(value??''))&&Number(value)>0?String(value):null;
// Routes of the app; an address of one of its pages names the app's folder in front of the route.
const ROUTE=/\/(?:startseite|kalender|gremien(?:\/\d+)?|personen(?:\/\d+)?|sitzungen\/\d+|dokumente|suche)\/?$/i;
/**
 * Recognises the start page (or any page) of a SessionNet 6 citizens' information system from its address and HTML.
 * Returns {adapter:'sessionnet6', base, version?} or null. base is the app's folder (https, trailing slash), taken
 * from <base href> where the server filled it in, otherwise from the address without the app's route.
 * The members' area (gi/, ri/, login) is not a public source.
 */
export function detectSessionNet6(url,html){
 const page=String(html||''),title=text(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
 if(!/^SessionNet\b/i.test(title)||/Gremieninfo|Ratsinfo|Mandat|Anmeld|Login/i.test(title)||!/<app-root\b/i.test(page)||!/<script\b[^>]*\bsrc=["'][^"']*\bmain-[\w-]+\.js["']/i.test(page))return null;
 let u;try{u=new URL(url);}catch{return null;}
 if(!/^https?:$/.test(u.protocol)||/\/(?:gi|ri)\/|\/login(?:\/|$)/i.test(u.pathname))return null;
 const href=page.match(/<base\b[^>]*\bhref=["']([^"']*)["']/i)?.[1]||'';
 let path;
 if(href&&!href.includes('@@')){try{const b=new URL(href,u);if(b.origin!==u.origin)return null;path=b.pathname;}catch{return null;}}
 else{path=u.pathname.replace(ROUTE,'/');if(!path.endsWith('/'))path=/\.[a-z0-9]+$/i.test(path)?path.replace(/[^/]*$/,''):path+'/';}
 if(!path.endsWith('/'))path=path.replace(/[^/]*$/,'');
 const version=page.match(/<meta\b[^>]*name=["']app-version["'][^>]*content=["']([^"']*)["']/i)?.[1];
 return {adapter:'sessionnet6',base:'https://'+u.host+path,...(version&&!version.includes('@@')?{version}:{})};
}
/** Meetings of the list answer. url is the app's page of the meeting; released: published (freigabeDatum) by today. */
export function parseMeetings(list,source,now=new Date()){
 if(!Array.isArray(list))throw Error('Unbekanntes Format der Sitzungsliste');
 return list.filter(m=>m&&digits(m.siNr)&&/^\d{4}-\d{2}-\d{2}/.test(m.dat||'')).map(m=>({id:String(m.siNr),url:allowed(source.base+'sitzungen/'+m.siNr,source),date:m.dat.slice(0,10),name:text(m.name)||'Sitzung',number:text(m.nummer),released:Boolean(m.freigabeDatum)&&String(m.freigabeDatum).slice(0,10)<=day(now)}));
}
// An office (Amt) keeps a "Gemeindevertretung" for each member; the meeting's name says whose ("Sitzung der
// Gemeindevertretung Walkendorf"). A committee name of one word takes the rest of the meeting's name after it.
const whose=(committee,meeting)=>{if(/\s/.test(committee))return committee;const rest=meeting.match(new RegExp(`(?:^|\\s)${committee.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s+([^(,;]+)`))?.[1]?.trim();return rest?committee+' '+rest:committee;};
const votes=v=>v&&typeof v==='object'&&['ja','nein','enthaltung','befangen'].every(k=>Number.isInteger(v[k]??0))?`Ja ${v.ja??0}, Nein ${v.nein??0}, Enthaltung ${v.enthaltung??0}${v.befangen?', befangen '+v.befangen:''}`:'';
/**
 * Public agenda items of one meeting; null if the answer is no agenda. committees: grNr → name (gremien).
 * An item with a paper (voNr) is the paper's item: the same paper in committee and council is one topic.
 * A heading of a section (4 above 4.1, 4.2 …) without paper, decision or vote is no item of its own.
 */
export function parseSessionNet6Agenda(list,meeting,source,committees=new Map(),now=new Date()){
 if(!Array.isArray(list))return null;
 const today=day(now),fallback=meeting.name.replace(/^\d+\.\s*/,'')||'Öffentliche Sitzung',items=[];
 const open=list.filter(t=>t&&Number(t.oSt)===1&&digits(t.toNr)).sort((a,b)=>(a.sort??0)-(b.sort??0));
 const numbers=open.map(t=>text(t.nummer).replace(/\.$/,'')).filter(Boolean);
 for(const t of open){
  const title=text(t.text||t.textLang);if(!title)continue;
  const number=text(t.nummer).replace(/\.$/,''),paper=digits(t.voNr),decision=text(t.beschluss),count=Number(t.abstimmungTyp)===0?'':votes(t.abstimmungErgebnis);
  if(!paper&&!decision&&!count&&number&&numbers.some(n=>n.startsWith(number+'.')))continue;
  const result=decision&&count?`${decision} (${count})`:decision||(count?'Abstimmung: '+count:'');
  const named=committees.get(String(t.grNr)),committee=named?whose(named,meeting.name):fallback,url=meeting.url+'#top-'+t.toNr;
  const status=meeting.date>today?(paper?'consulting':'announced'):resultStatus(decision,committee)||'unknown';
  const description=meeting.date>today?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':result?'Ergebnis laut Tagesordnung: '+result:'Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Abschnitt nicht belegt.';
  const long=text(t.textLang);
  items.push({id:`${source.id}-${paper?'vo-'+paper:'top-'+t.toNr}`,title,reference:'',sourceUrl:url,identityLinks:[],status,documents:[],
   event:{date:meeting.date,committee,status,description,result,url:meeting.url,publicEvidence:'Öffentlicher Teil der Tagesordnung laut Schnittstelle des Bürgerinformationssystems'},
   agenda:{number,top:String(t.toNr),paper,...(long&&long!==title&&long.length<1200?{longTitle:long}:{})}});
 }
 return items;
}
/** Documents of the agenda items of one meeting: toNr → [{title,url,kind}]. Addresses outside the source are left out. */
export function agendaDocuments(list,source){
 if(!Array.isArray(list))throw Error('Unbekanntes Format der Dokumentliste');
 const byItem=new Map();
 for(const d of list.filter(d=>d&&digits(d.toNr)&&digits(d.doNr)&&d.ref).sort((a,b)=>(a.sort??0)-(b.sort??0))){
  let url;try{url=allowed(new URL(String(d.ref),source.base).href,source);}catch{continue;}
  const key=String(d.toNr);if(!byItem.has(key))byItem.set(key,[]);
  // The app shows every document in its PDF viewer; the files are delivered as PDF.
  byItem.get(key).push({title:text(d.name)||'Originalunterlage',url,kind:'application/pdf'});
 }
 return byItem;
}
// marks (optional): what earlier imports read completely, see meeting-marks.mjs.
export async function collectSessionNet6(source,{now=new Date(),get=fetchText,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 // 401, 403 and 429 become messages that budgeted does not repeat.
 const ask=async(...args)=>{try{return await get(...args);}catch(e){const status=String(e?.message||e).match(/HTTP (401|403|429)\b/)?.[1];if(status)throw Error(status==='429'?TOO_MANY:closed(status));throw e;}};
 const request=budgeted(ask,maxDurationMs,2);let halt=null;
 const json=async url=>{
  if(halt)throw Error(halt);let body;
  try{body=await request(allowed(url,source),source);}catch(e){if(e.message===TOO_MANY||e.message.startsWith('Schnittstelle verweigert'))halt=e.message;throw e;}
  // An address outside the interface is answered by the app's page, not by JSON.
  try{return JSON.parse(body);}catch{throw Error('Antwort ist kein JSON; keine SessionNet-6-Schnittstelle unter dieser Adresse');}
 };
 const from=windowStart(now,lookback),fromDay=day(from),today=day(now),until=day(new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+2,0)));
 const issues=[],warnings=[],meetings=new Map();
 // The list in spans of about three months, from the start of the period to the end of next month. Neighbouring
 // spans share their border day, so a meeting on it is found whether the interface counts "bis" in or not.
 for(let start=from.getTime();day(new Date(start))<=until;start+=SPAN*DAY){
  const von=day(new Date(start)),bis=[day(new Date(start+SPAN*DAY)),until].sort()[0];
  try{for(const m of parseMeetings(await json(source.base+`api/v1/sitzungen?von=${von}&bis=${bis}`),source,now))if(m.date>=fromDay&&m.date<=until)meetings.set(m.url,m);}
  catch(e){if(e.message!==halt)issues.push(`Sitzungsliste ${von} bis ${bis}: ${e.message}`);break;}
  if(bis===until)break;
 }
 let upcoming=0;const readable=[];
 for(const m of meetings.values()){if(m.released)readable.push(m);else if(m.date>today)upcoming++;else warnings.push('Sitzung ohne freigegebene Tagesordnung: '+m.url);}
 // Committee names: asked once, when the first agenda is read. Without them the meeting's name stands in.
 let named=null;const committees=()=>named??=json(source.base+'api/v1/gremien').then(list=>new Map((Array.isArray(list)?list:[]).filter(g=>g&&digits(g.grNr)&&text(g.name)).map(g=>[String(g.grNr),text(g.name)])),e=>{if(e.message!==halt&&!/Zeitbudget/.test(e.message))warnings.push('Gremienliste nicht lesbar ('+e.message+'); Gremium nach dem Sitzungsnamen.');return new Map();});
 const grouped=new Map(),held={};let count=0,unchanged=0,done=0,unread=0,fetched=0,beyond=0;
 await parallel(readable.sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date)),async m=>{
  if(halt)return;
  const known=usableMark(marks,m,now);
  // Read completely a moment ago: an import that ran out of time continues behind it without asking again.
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;count++;return;}
  if(fetched>=MAX_MEETINGS){beyond++;return;}fetched++;
  const agendaUrl=allowed(source.base+`api/v1/sitzungen/${m.id}/tagesordnung`,source);
  try{
   const list=await json(agendaUrl),rows=parseSessionNet6Agenda(list,m,source,Array.isArray(list)&&list.length?await committees():new Map(),now);
   if(!rows){issues.push('Keine lesbare öffentliche Tagesordnung: '+m.url);return;}
   // A meeting still ahead without public items has nothing to read yet.
   if(!rows.length&&m.date>today){upcoming++;return;}
   const print=(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.agenda.number,r.event.committee,r.event.result])))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;count++;return;}
   let cut=false,complete=true,documents=new Map(),problem=null;
   if(rows.length){try{documents=agendaDocuments(await json(source.base+`api/v1/sitzungen/${m.id}/tagesordnung/dokumente`),source);}catch(e){complete=false;problem=e.message;if(/Zeitbudget/.test(e.message)||e.message===halt)cut=true;else issues.push('Dokumente: '+m.url+': '+e.message);}}
   for(const row of rows){
    const {number,top,paper,longTitle}=row.agenda;delete row.agenda;
    row.documents.push(...(documents.get(top)||[]));
    row.sourceData={version:'public-source-fields-v1',method:'sessionnet6',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:agendaUrl,fields:{number,title:row.title,...(longTitle?{longTitle}:{}),paper,result:row.event.result,meeting:m.name,meetingNumber:m.number}}],detailStatus:complete?'completed':'partial',issues:problem?[problem]:[]};
    row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
    if(!grouped.has(row.id))grouped.set(row.id,[]);grouped.get(row.id).push(row);
   }
   // A meeting counts as read only if the documents of its items could be read as well.
   if(cut)unread++;else if(complete){held[m.url]=newMark(m,print,now,rows.length);done++;}
  }catch(e){if(/Zeitbudget/.test(e.message)||e.message===halt)unread++;else issues.push(m.url+': '+e.message);}
  count++;onProgress(source.id+': '+count+'/'+readable.length+' Sitzungen');
 },2);
 if(halt)issues.push(halt+(unread?` ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`:''));
 else if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(beyond&&!halt)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 // A paper on several agendas is one topic. Its items are put in the order of their meetings, whatever order the
 // meetings were read in; the item of the latest meeting gives title and address.
 for(const rows of grouped.values()){
  rows.sort((a,b)=>(a.event.date+a.sourceUrl).localeCompare(b.event.date+b.sourceUrl));const row=rows.at(-1),last=row.event,events=rows.map(r=>r.event);
  const sourceData={...row.sourceData,records:rows.flatMap(r=>r.sourceData.records),detailStatus:rows.some(r=>r.sourceData.detailStatus==='partial')?'partial':'completed',issues:[...new Set(rows.flatMap(r=>r.sourceData.issues))]};
  const t={...row,events,sourceData,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+events.map(e=>e.date+' '+e.description).join('\n'),identityLinks:[],documents:[...new Map([...rows.flatMap(r=>r.documents),{title:'Sitzung / öffentliche Tagesordnung',url:row.sourceUrl,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche Schnittstelle des SessionNet-Bürgerinformationssystems; nur Tagesordnungspunkte des öffentlichen Teils.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 const listed=meetings.size-upcoming;
 // Unchanged meetings are a successful reading: their reports are in the database already.
 // After a halt nothing is resumed automatically: the next import is the next attempt.
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:listed,...(upcoming?{upcomingWithoutAgenda:upcoming}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...((unread||beyond)&&!halt?{resumable:true}:{}),...(warnings.length?{warnings}:{}),sourceCount:1,quiet:listed===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
