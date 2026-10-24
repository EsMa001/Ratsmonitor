import {sourceDecision} from './source-fields.mjs';
import {windowStart,historyWindow} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,MAX_MEETINGS} from './sessionnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
import {asciiSlug as slug,clip,selfClosed} from './source-common.mjs';
// Öffentliche Ordner der Fabasoft Cloud (de.cloud.fabasoft.com/folio/public/<Freigabe>), wie sie Bad Homburg v. d. Höhe (2026)
// für jedes Gremium verlinkt: „Stadtverordnetenversammlung 2026 (öffentlich)“ mit einem Ordner je Sitzung („Stadtverordneten-
// versammlung 2026-09-10 18:30:00“), darin die Einladung (PDF) und je Tagesordnungspunkt ein Ordner („TOP 04 - Tagesordnung I -
// SV 26/41-5 Radschnellweg …“) mit Vorlage, Anlagen und den Beschlusspapieren der beratenden Gremien („Mobilitätsausschuss
// 2026-06-10 18:30:00: SV 26/41-2“). Gelesen wird die JSON-Antwort der Web-App (…/?xhr=1, ohne Anmeldung) und nichts sonst;
// Dateien werden nur verlinkt (…/<Dokument>/download). Der Katalogeintrag nennt die Freigaben der Gremien (folders).
export const FABASOFT_BASE='https://de.cloud.fabasoft.com/folio/public/';
const SHARE=/^[a-z0-9]{20,40}$/,COO=/^COO\.\d+\.\d+\.\d+\.\d+$/;
/** Adresse einer Abfrage: Freigabe und Weg durch die Ordner; nur solche Adressen werden gefragt */
export function fabasoftUrl(share,path=[],{download=false}={}){
 if(!SHARE.test(share)||path.some(p=>!COO.test(p)))throw Error('Nicht freigegebene Quelladresse');
 return FABASOFT_BASE+[share,...path].join('/')+(download?'/download':'/?xhr=1');
}
/** Einträge einer Ordnerantwort: {key, name, folder, pdf} */
export function fabasoftEntries(json){
 const j=typeof json==='string'?JSON.parse(json):json;
 const rows=j?.['p$docBody']?.['p$pageData']?.flatMap(p=>(p['l$list']||[]).flatMap(l=>(l['l$listBody']||[]).flatMap(b=>b['l$listData']||[])))||[];
 return {caption:String(j?.['p$caption']||'').trim(),entries:rows.map(r=>{const [name,kind]=(r['l$dataLeader']?.['l$dataEntry']||[]).map(e=>String(e?._||'').replace(/\s+/g,' ').trim());return {key:String(r['l$key']||''),name:name||'',folder:/^Ordner$/i.test(kind||''),pdf:/PDF/i.test(kind||'')};}).filter(e=>COO.test(e.key)&&e.name)};
}
/** Sitzungsordner: „<Gremium> JJJJ-MM-TT HH:MM:SS“ */
export function fabasoftMeeting(name){
 const m=String(name).match(/^(.*?)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?::\d{2})?\s*$/);
 return m&&m[1].trim()?{body:m[1].trim().replace(/\s+/g,' '),date:m[2],time:m[3]}:null;
}
/** Punktordner: „TOP 04 - Tagesordnung I - SV 26/41-5 Titel“; ohne Vorlagennummer auch „TOP 3 - Titel“ */
export function fabasoftItem(name){
 const m=String(name).replace(/\s+/g,' ').trim().match(/^TOP\s+(\d+[a-z]?(?:\.\d+)?)\s*[-–]\s*(?:Tagesordnung\s+[IVX]+\s*[-–]\s*)?(?:(SV\s+\d+\/\d+(?:-\d+)?)\s+)?(.+)$/i);
 if(!m)return null;
 const paper=m[2]?m[2].replace(/\s+/g,' '):'',title=m[3].replace(/[;,\s]+$/,'').trim();
 return title?{number:m[1].replace(/^0+(?=\d)/,''),paper,matter:paper.replace(/-\d+$/,''),title}:null;
}
const ROUTINE=/^(?:mitteilungen|anfragen|verschiedenes|bekanntgaben?|fragestunde|bürgerfragestunde|einwohnerfragestunde|eröffnung|begrüßung|genehmigung der (?:niederschrift|tagesordnung))\b/i;
/** Status eines Punkts: künftige Sitzung berät noch; sonst ohne veröffentlichten Beschlusstext offen */
const statusOf=(date,today)=>date>today?'consulting':'unknown';
// marks (optional): was frühere Abrufe vollständig gelesen haben, siehe meeting-marks.mjs.
export async function collectFabasoft(source,{now=new Date(),get=fetchText,request=fetch,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 const site={...source,base:FABASOFT_BASE};
 const read=async(share,path=[])=>fabasoftEntries(await get(fabasoftUrl(share,path),site,undefined,request));
 const period=historyWindow(lookback)+':',fromDay=windowStart(now,lookback).toISOString().slice(0,10),today=now.toISOString().slice(0,10);
 const issues=[],warnings=[],meetings=[];
 // 1. Je Gremienordner die Sitzungen im Zeitraum; ein Ordner, der sich selbst nichtöffentlich oder vertraulich nennt, wird
 // nicht gelesen (24.10.2026: nur was sich selbst so nennt)
 for(const share of source.folders||[]){
  try{
   const {caption,entries}=await read(share);
   if(selfClosed(caption)){warnings.push(`Ordner „${caption||share}“ als nichtöffentlich bezeichnet; nicht gelesen.`);continue;}
   for(const e of entries.filter(e=>e.folder)){const m=fabasoftMeeting(e.name);if(m&&m.date>=fromDay)meetings.push({...m,share,key:e.key,url:fabasoftUrl(share,[e.key]).replace('/?xhr=1','/')});}
  }catch(e){issues.push(`Ordner ${share}: ${e.message}`);}
 }
 if(!source.folders?.length)issues.push('Katalogeintrag ohne Ordner (folders)');
 const grouped=new Map(),held={};let count=0,limited=false,unchanged=0,done=0,unread=0,empty=0;
 // 2. Je Sitzung die Punkte, je Punkt die Dateien
 await parallel(meetings.sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date)),async m=>{
  const mark=usableMark(marks,m,now),known=mark&&String(mark.print).startsWith(period)?mark:null;
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;return;}
  if(count>=MAX_MEETINGS){limited=true;return;}count++;
  try{
   const {entries}=await read(m.share,[m.key]);
   const invitation=entries.find(e=>e.pdf&&/einladung|tagesordnung/i.test(e.name.replace(/\s+/g,'')));// „E I N L A D U N G“
   const items=entries.filter(e=>e.folder).map(e=>({...fabasoftItem(e.name),key:e.key})).filter(i=>i.title&&!ROUTINE.test(i.title));
   if(!items.length){if(m.date>today||entries.length)empty++;else issues.push('Sitzung ohne Punkte: '+m.url);return;}
   const print=period+(await hash(JSON.stringify([entries.map(e=>[e.key,e.name])]))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;return;}
   const rows=[];
   for(const i of items){
    let files=[];
    try{files=(await read(m.share,[m.key,i.key])).entries.filter(e=>e.pdf&&!selfClosed(e.name)).map(e=>({title:clip(e.name,200),url:fabasoftUrl(m.share,[m.key,i.key,e.key],{download:true}),kind:'pdf'}));}
    catch(e){if(/Zeitbudget/.test(e.message))throw e;warnings.push(`TOP ${i.number} (${m.body} ${m.date}): Dateien nicht gelesen (${e.message})`);}
    const status=statusOf(m.date,today);
    const event={date:m.date,committee:m.body,status,description:m.date>today?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':'Öffentlich auf der Tagesordnung; ein Beschluss ist in den gelesenen Angaben nicht vermerkt (Beschlusspapiere in den Unterlagen).',result:'',url:m.url,publicEvidence:'Öffentlicher Ordner der Kommune („öffentlich“), Punktordner '+i.number};
    const docs=[...(invitation?[{title:invitation.name,url:fabasoftUrl(m.share,[m.key,invitation.key],{download:true}),kind:'pdf'}]:[]),...files];
    rows.push({id:`${source.id}-fb-${i.matter?slug(i.matter):`${m.date.replace(/-/g,'')}-${slug(m.body).slice(0,40)}-${slug(i.number)}`}`,title:clip(i.title,300),reference:i.paper||`TOP ${i.number}`,sourceUrl:m.url,documents:docs,record:{number:i.number,paper:i.paper},event});
   }
   for(const row of rows){
    row.sourceData={version:'public-source-fields-v1',method:'fabasoft',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:row.record}],detailStatus:'completed',issues:[]};delete row.record;
    row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
    const previous=grouped.get(row.id);
    if(previous){if(!previous.events.some(e=>e.url===row.event.url&&e.date===row.event.date))previous.events.push(row.event);previous.documents.push(...row.documents);}
    else grouped.set(row.id,{...row,identityLinks:[],events:[row.event]});
   }
   held[m.url]=newMark(m,print,now,rows.length);done++;
  }catch(e){if(/Zeitbudget/.test(e.message))unread++;else issues.push(m.url+': '+e.message);}
  onProgress(source.id+': '+count+'/'+meetings.length+' Sitzungen');
 },1);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(limited)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.committee+': '+e.description).join('\n'),documents:[...new Map(row.documents.map(d=>[d.url,d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t,{place:source.name}));
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche Ordner der Kommune in der Fabasoft Cloud; nur Ordner, die sich als öffentlich bezeichnen.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};
  topics.push(t);
 }
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:meetings.length,...(empty?{meetingsWithoutAgenda:empty}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||limited?{resumable:true}:{}),...(warnings.length?{warnings}:{}),sourceCount:1,quiet:topics.length===0&&unchanged===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0||empty>0),issues:topics.length||unchanged||empty?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.page||FABASOFT_BASE+(source.folders?.[0]||'')}};
}
