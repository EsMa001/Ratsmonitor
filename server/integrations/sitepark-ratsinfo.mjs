import {sourceDecision} from './source-fields.mjs';
import {windowStart,historyWindow} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,MAX_MEETINGS} from './sessionnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
import {asciiSlug as slug,clip} from './source-common.mjs';
import {committeeOf} from './website-text.mjs';
import {withoutPrivateNames} from '../../shared/private-names.mjs';
// Ratsinfo-Modul des Website-Systems von Sitepark (IES/ionas, 24.10.2026: Eifelkreis Bitburg-Prüm, Amt Itzstedt, Tangstedt,
// Wietze): Die Website der Kommune zeigt die Sitzungen ihres Ratsinformationssystems selbst, unter …/ratsinfo-views/sitzungstermin/
// bzw. …/ratsinfo/sitzungstermin/<id>/<name>/, mit der Tagesordnung (je Punkt „Ö“ oder „N“, Nummer, Titel, Link zur Vorlage).
// Die Sitzungsliste lädt eine Seite der Website als JSON (…/conferences.json?…): nur kommende Sitzungen. Was einmal gelesen ist,
// bleibt gespeichert; ältere Sitzungen sind über diese Liste nicht erreichbar. Gelesen werden nur Seiten der Website der Kommune.
// Nichtöffentliche Punkte nur mit Titel (ohne Namen von Privatpersonen) und Kennzeichen, ohne Vorlage.
const CANCEL=/f(?:ä|ae)llt\s+aus|abgesagt|entf(?:ä|ae)llt|verlegt\s+auf|findet\s+nicht\s+statt/i;
const decode=s=>String(s??'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(m,n)=>String.fromCharCode(Number(n)));
const text=s=>decode(String(s??'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
/** Adressen der Sitzungslisten (conferences.json) einer Seite */
export function conferenceLists(html,base){
 const out=new Set();
 for(const m of String(html??'').matchAll(/["'](https?:\/\/[^"'\s]+\/conferences\.json\?[^"'\s]+|\/[^"'\s]*\/conferences\.json\?[^"'\s]+)["']/g)){try{out.add(new URL(m[1].replace(/&amp;/g,'&'),base).href);}catch{/* keine Adresse */}}
 return [...out];
}
/** Sitzungen einer Liste: [{url,title,date,time}] (Tag und Uhrzeit in deutscher Zeit) */
export function conferenceEntries(json){
 let data;try{data=typeof json==='string'?JSON.parse(json):json;}catch{return [];}
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 return (Array.isArray(data)?data:[]).filter(c=>c?.url&&c?.start&&!Number.isNaN(Date.parse(c.start))).map(c=>{const [date,time]=day.format(new Date(c.start)).split(' ');return {url:String(c.url),title:String(c.title||'').replace(/\s+/g,' ').trim(),date,time};});
}
/** Tagesordnung einer Sitzungsseite: [{publicity:'public'|'nonpublic', number, title, paper, paperUrl}] */
export function conferenceAgenda(html,base){
 const out=[];
 for(const li of String(html??'').matchAll(/<li class="conference-detail__item[^"]*">([\s\S]*?)<\/li>/g)){
  const body=li[1],head=body.match(/<span class="conference-detail__agenda-title">([\s\S]*?)<\/span>\s*(?:<div|$)/)?.[1]??'';
  const status=head.match(/<span[^>]*class="conference-detail__agenda-status ([a-z-]+)"[^>]*>([^<]*)<\/span>/);
  const number=text(head.match(/<span class="conference-detail__agenda-number">([\s\S]*?)<\/span>/)?.[1]);
  const title=text(head.replace(/<span[^>]*class="conference-detail__agenda-(?:status|number)[^"]*"[^>]*>[\s\S]*?<\/span>/g,''));
  const pub=status&&(status[1]==='public'||/^Ö$/i.test(status[2].trim()))?'public':'nonpublic';
  const paper=body.match(/<a [^>]*href="([^"]*\/(?:ratsinfo-views|ratsinfo)\/vorlage\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
  let paperUrl=null;try{paperUrl=paper?new URL(decode(paper[1]),base).href:null;}catch{/* keine Adresse */}
  if(title)out.push({publicity:pub,number,title,paper:paper?text(paper[2]):'',paperUrl});
 }
 return out;
}
const statusOf=(date,today)=>date>today?'consulting':'unknown';
/** Gremium eines Sitzungstitels; im Amt mit dem Namen der Gemeinde („Sitzung der Gemeindevertretung der Gemeinde Kayhude“ →
    „Gemeindevertretung Kayhude“), damit die Räte der Mitgliedsgemeinden unterscheidbar bleiben. */
export function bodyOf(title){
 const t=String(title||'').replace(/\s+/g,' ').trim(),base=committeeOf(t)||t.replace(/^(?:öffentliche|nichtöffentliche|\/|\s)*sitzung\s+(?:des|der)\s+/i,'')||'Sitzung';
 const place=t.match(/\b(?:der|des)\s+(?:Gemeinde|Stadt|Amtes|Marktes|Fleckens)\s+(\p{Lu}[\p{L}.-]*(?:\s+(?:a\.|am|an|im|bei|ob|\p{Lu})[\p{L}.-]*)*)/u)?.[1];
 if(!place||base.includes(place))return base;
 return `${base} ${place}`;
}
// marks (optional): was frühere Abrufe vollständig gelesen haben, siehe meeting-marks.mjs.
export async function collectSiteparkRatsinfo(source,{now=new Date(),get=fetchText,request=fetch,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 const site={...source,base:new URL(source.base).origin+'/'};
 const period=historyWindow(lookback)+':',fromDay=windowStart(now,lookback).toISOString().slice(0,10),today=now.toISOString().slice(0,10);
 const issues=[],warnings=[],seen=new Map();
 // 1. Sitzungslisten der Seiten im Katalog
 for(const page of source.pages||[]){
  try{
   const lists=conferenceLists(await get(page,site,undefined,request),page);
   if(!lists.length){issues.push('Keine Sitzungsliste auf '+page);continue;}
   for(const list of lists)for(const c of conferenceEntries(await get(list,site,undefined,request)))if(c.date>=fromDay&&!seen.has(c.url))seen.set(c.url,c);
  }catch(e){issues.push(`${page}: ${e.message}`);}
 }
 if(!source.pages?.length)issues.push('Katalogeintrag ohne Seite (pages)');
 // excludeTitles (Katalog): Sitzungen, die zu einem anderen Gebiet gehören (Amt Itzstedt verwaltet die amtsfreie Gemeinde Tangstedt mit).
 const meetings=[...seen.values()].filter(m=>!CANCEL.test(m.title)&&!(source.excludeTitles||[]).some(x=>m.title.includes(x)));
 const grouped=new Map(),held={};let count=0,limited=false,unchanged=0,done=0,unread=0,empty=0;
 // 2. Je Sitzung die Tagesordnung
 await parallel(meetings.sort((a,b)=>b.date.localeCompare(a.date)),async m=>{
  const mark=usableMark(marks,m,now),known=mark&&String(mark.print).startsWith(period)?mark:null;
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;return;}
  if(count>=MAX_MEETINGS){limited=true;return;}count++;
  try{
   const html=await get(m.url,site,undefined,request);
   const agenda=conferenceAgenda(html,m.url);
   if(!agenda.length){empty++;return;}
   const print=period+(await hash(JSON.stringify(agenda))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;return;}
   const committee=bodyOf(m.title);
   let rows=0;
   for(const i of agenda){
    const closed=i.publicity==='nonpublic',title=clip(closed?withoutPrivateNames(i.title):i.title,300);
    const event={date:m.date,committee,status:statusOf(m.date,today),description:closed?'Nichtöffentlicher Punkt laut veröffentlichter Tagesordnung; öffentlich bekannt sind Titel, Sitzung und Gremium.':m.date>today?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':'Öffentlich auf der Tagesordnung; ein Beschluss ist in den gelesenen Angaben nicht vermerkt.',result:'',url:m.url,publicEvidence:closed?'nichtöffentlicher Teil laut Quelle':'Punkt mit Kennzeichen „Ö“ (öffentlich) auf der Website der Kommune',...(closed?{publicity:'nonpublic'}:{}),attendance:{status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]}};
    event.decision=sourceDecision(event);
    const id=`${source.id}-sp-${!closed&&i.paper?slug(i.paper):`${m.date.replace(/-/g,'')}-${slug(committee).slice(0,40)}-${slug(i.number||String(rows+1))}`}`;
    const docs=!closed&&i.paperUrl?[{title:'Vorlage '+(i.paper||i.number),url:i.paperUrl,kind:'html'}]:[];
    const previous=grouped.get(id);
    if(previous){if(!previous.events.some(e=>e.url===event.url&&e.date===event.date))previous.events.push(event);previous.documents.push(...docs);}
    else grouped.set(id,{id,title,reference:i.paper||`TOP ${i.number}`,sourceUrl:m.url,documents:docs,identityLinks:[],events:[event],...(closed?{publicity:'nonpublic'}:{}),sourceData:{version:'public-source-fields-v1',method:'sitepark-ratsinfo',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:{number:i.number,paper:i.paper,publicity:i.publicity}}],detailStatus:'completed',issues:[]}});
    rows++;
   }
   held[m.url]=newMark(m,print,now,rows);done++;
  }catch(e){if(/Zeitbudget/.test(e.message))unread++;else issues.push(m.url+': '+e.message);}
  onProgress(source.id+': '+count+'/'+meetings.length+' Sitzungen');
 },2);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(limited)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Tagesordnungspunkt: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.committee+': '+e.description).join('\n'),documents:[...new Map(row.documents.map(d=>[d.url,d])).values()]};
  Object.assign(t,sourceSummary(t,{place:source.name}));
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Sitzungsseiten auf der Website der Kommune; öffentlich nach Kennzeichen „Ö“ je Punkt.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};
  topics.push(t);
 }
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:meetings.length,...(empty?{meetingsWithoutAgenda:empty}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||limited?{resumable:true}:{}),...(warnings.length?{warnings}:{}),sourceCount:1,quiet:topics.length===0&&unchanged===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0||empty>0),issues:topics.length||unchanged||empty?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.pages?.[0]||source.base}};
}
