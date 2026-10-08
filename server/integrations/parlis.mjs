import {sourceDecision} from './source-fields.mjs';
import {windowStart,historyWindow} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text,MAX_MEETINGS} from './sessionnet.mjs';
import {resultStatus} from './sdnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
// PARLIS, the "PARLamentsInformationsSystem" of Frankfurt am Main (www.stvv.frankfurt.de, own development of the city).
// Read are plain addresses of the public site only:
// - the lists of minutes (Niederschriften, DOKUMENTTYP=NIED) and of current agendas (Tagesordnungen, TAGO), newest
//   first, 25 per page; the page is chosen by the offset the site's own "Nach unten" link carries ("&?26"),
// - each minutes or agenda document under its permanent name (DDW?W=DOK_NAME='N_H_4_29-09-2026', the name of its PDF).
// The document is the Word file of the office as HTML. Minutes name per item the paper (link DOK_NAME='OM_4243_2023'),
// the decision ("Beschluss:" or, for a recommendation to the council, "Bericht:") and the vote ("Abstimmung:"). The
// council's own minutes are a protocol of decisions: each item is a paragraph ("§ 352", link DOK_NAME='PAR_352_2026').
// The non-public part of minutes is a document of its own under /PARLIS2S/; that path is never requested. The search
// form (full text, date fields) is not used. robots.txt of the site disallows /PARLISLINK; it is recorded, not obeyed
// (robots-policy.mjs, decision of 05.10.2026).
export const PARLIS_NONPUBLIC='Nichtöffentlicher Teil von PARLIS; wird nicht abgefragt.';
const MAX_LIST_PAGES=80;
const day=value=>{const m=String(value).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:null;};
const fnv=value=>{let h=0x811c9dc5;for(const c of new TextEncoder().encode(value)){h^=c;h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,'0');};
const slug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
// Word writes non-breaking hyphens and spaces and sometimes umlauts as letter plus combining mark ("Ka&#776;tches…");
// the text of an item uses plain hyphens, spaces and composed letters.
const plain=html=>text(html).normalize('NFC').replace(/[‐‑]/g,'-').replace(/ /g,' ').replace(/\s+/g,' ').trim();
/** Address of a document by its permanent name. */
export const parlisDocument=(name,source)=>allowed(new URL(`PARLISLINK/DDW?W=DOK_NAME=%27${encodeURIComponent(name)}%27`,source.base).href,source);
/** Address of a list page (minutes NIED, agendas TAGO), newest first; offset is the number of the first row. */
export const parlisList=(type,source,offset=1)=>allowed(new URL(`PARLISLINK/SDF?DOKUMENTTYP=${type}&FORMFL_OB=DATUM&FORM_SO=Absteigend&FORM_C=und`+(offset>1?`&?${offset}`:''),source.base).href,source);
// Only the public application: /PARLIS2S/ holds the non-public part, and nothing outside /PARLISLINK/ is read.
const guard=url=>{const path=new URL(url).pathname;if(/\/PARLIS2S\//i.test(path))throw Error(PARLIS_NONPUBLIC);if(!/^\/PARLISLINK\/(?:SDF|DDW)$/i.test(path))throw Error('Nicht freigegebene Quelladresse');return url;};
export function detectParlis(url,html=''){
 const page=String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';
 if(!/PARLamentsInformationsSystem|^\s*PARLIS\s+-/i.test(page)&&!/\/parlis2\/parlis2\.js|\.\.\/PARLISLINK\/(?:SDF|DDW)/.test(html))return null;
 return {adapter:'parlis',base:'https://'+new URL(url).host+'/'};
}
/**
 * Rows of a list page: day, title, permanent name (from the PDF link) and the meeting the document belongs to
 * ("4. Sitzung des H am 29.09.2026"), plus the offset of the next page (null on the last page) and the total.
 */
export function parlisListRows(html){
 const rows=[];
 // Row by row: a row without its PDF link is skipped, never joined with the next one.
 for(const [row] of String(html).matchAll(/<TR\b[^>]*>[\s\S]*?<\/TR>/gi)){
  const m=row.match(/^<TR\b[^>]*>\s*<TD>\s*\d+\s*<\/TD>\s*<TD>\s*([\d.]+)\s*<\/TD>\s*<TD[^>]*>\s*<A\b[^>]*>([\s\S]*?)<\/A>\s*<A\s+HREF=["'][^"']*\/download\/([^"'/]+)\.pdf["']/i);
  if(!m)continue;
  const date=day(m[1]),title=plain(m[2]);if(!date||!title)continue;
  rows.push({date,title,name:m[3],meeting:title.replace(/^\S+\s+der\s+/i,'').replace(/\s+mit Vorlagen.*$/i,'')});
 }
 const next=String(html).match(/href=["'][^"']*SDF\?[^"']*&\?(\d+)\s*["'][^>]*title=["']Nach unten/i)?.[1];
 const total=Number(String(html).match(/von\s+(\d+)\s*&nbsp;/)?.[1]||rows.length);
 return {rows,next:next?Number(next):null,total};
}
// A paper (OM_4243_2023, OF_47-12_2026); a council decision (PAR_…) is none.
const PAPER=/DOK_NAME=%27((?!PAR_)[A-Z]{1,6}_[0-9][\w-]*_\d{4})/;
const DECISION=/DOK_NAME=%27(PAR_\d+_\d{4})/;
// Items that every agenda has and that carry no matter of their own; taken only when they name a paper.
const ROUTINE=/^(?:Eröffnung|Feststellung|Verabschiedung|Genehmigung)\b|Niederschrift|^Mitteilungen\b|Bürger(?:innen)?(?:-?\s*und\s*Bürger)?(?:fragestunde|runde)|Fragestunde|Viertelstunde|^Verschiedenes|^Unerledigte\b|^Angelegenheiten der Kinder|^Bericht (?:des|der) (?:Magistrat|Ortsvorsteher|Dezernent)|^Anträge? auf Aufnahme/i;
const ORIGIN=/^(?:Vortrag|Antrag|Anregung|Anfrage|Bericht|Etatantrag|Etatanregung|Auskunftsersuchen|Eingabe|Beschluss|Vorlage|Dringlichkeitsantrag|Ergänzungsantrag|Änderungsantrag|Anregung an den Magistrat|Mitteilung)\b[^.]*\bvom\s+\d{1,2}\.\d{1,2}\.\d{4},?$/i;
const LABEL=/^(Beschluss|Bericht|Abstimmung|Sonstige Voten|Vorg\.)\s*:\s*/i;
// Lines of minutes that state a decision without the label "Beschluss:" (the council's minutes list them as a), b) …).
const STATEMENT=/^(?:[a-z]\)\s|\d{1,2}\.\s|Es dient|Die |Der |Das |Dem |Den |Gemäß )/;
// A short heading or line that names the non-public part ("Nichtöffentlicher Teil", "Tagesordnung II - nicht
// öffentlich", "Vertrauliche Punkte") ends the public part, wherever it stands and whatever tag carries it.
const RESTRICTED=/nicht\s*[-–]?\s*(?:ö|oe)ffentlich|vertraulich/i;
/** The public part of a document: everything before the link to its non-public part and before such a heading. */
export function parlisPublicPart(html){
 let end=html.search(/PARLIS2S/i);if(end<0)end=html.length;
 for(const m of html.slice(0,end).matchAll(/<(p|h[1-6]|td|th|div)\b[^>]*>([^<]{0,200}(?:<(?!\/?(?:p|h[1-6]|td|th|div)\b)[^>]*>[^<]{0,200}){0,6})<\/\1>/gi)){
  const t=plain(m[2]);if(t&&t.length<80&&RESTRICTED.test(t)){end=m.index;break;}
 }
 // Cut at the start of the tag that opened the paragraph, so no part of it is read.
 const before=html.slice(0,end),open=before.lastIndexOf('<p');
 return open>before.lastIndexOf('</p>')?before.slice(0,open):before;
}
/**
 * Items of a minutes or agenda document: number, title, paper (name and label), the decision paragraph of the council
 * (PAR_…), the part ("Tagesordnung I") and, in minutes, decision and vote. Header fields: body and day.
 */
export function parseParlisDocument(html){
 const page=String(html),head=plain(page.slice(0,Math.max(0,page.search(/<div\s+class=["']?WordSection1/i))||8000)),all=parlisPublicPart(page);
 const committee=head.match(/Gremium:\s*(.*?)\s*Datum:/)?.[1]?.trim()||'',date=day(head.match(/Datum:\s*([\d.]+)/)?.[1]||'')||null;
 // The council's minutes open each item with a line that holds nothing but its paragraph ("§ 352", linked to
 // PAR_352_2026). A paragraph named elsewhere ("Vorg.: Beschl. d. Stv.-V. vom …, § 222") opens nothing.
 const paragraphLine=(inner,t)=>DECISION.test(inner)&&/^§\s*\d+$/.test(t);
 const council=[...all.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].some(p=>paragraphLine(p[1],plain(p[1])));
 const items=[];let item=null,section='',mode='';
 const close=()=>{if(item)items.push(item);item=null;mode='';};
 const numbered=t=>t.match(/^(\d{1,3}(?:\.\d{1,3})*)\.?(?:\s+(.*))?$/);
 for(const p of all.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)){
  const attributes=p[1],inner=p[2];let t=plain(inner);
  if(!t)continue;
  if(/^Tagesordnung\s+I{1,3}$/.test(t)){close();section=t;continue;}
  if(council&&paragraphLine(inner,t)){close();item={number:'',title:'',decisionName:inner.match(DECISION)[1],section,result:[],vote:[]};mode='number';continue;}
  const n=numbered(t);
  // A numbered paragraph with hanging indent opens an item of committee and district minutes and of agendas. In the
  // council's minutes the item is opened by its paragraph, and the numbered line gives its number. Body text (class
  // Sammeltext) never opens an item, even when it is numbered ("1. Die Vorlage … wurde zurückgezogen").
  if(!council&&n&&/text-indent:\s*-/i.test(attributes)&&!/class=["']?Sammeltext/i.test(attributes)&&!/^\d{1,2}\.\s+[A-ZÄÖÜ][a-zäöü]+\s+\d{4}$/.test(t)){close();item={number:n[1],title:n[2]||'',section,result:[],vote:[]};mode=n[2]?'head':'title';continue;}
  if(!item)continue;
  if(mode==='number'){if(n){item.number=n[1];item.title=n[2]||'';mode=n[2]?'head':'title';}else if(/^\d{1,4}$/.test(t)){/* the paragraph number on a line of its own */}else{item=null;mode='';}continue;}
  if(mode==='title'){item.title=t;mode='head';continue;}
  // The paper line of the item; a labelled line ("Vorg.: …") names earlier papers, not this one.
  const paper=LABEL.test(t)?null:inner.match(PAPER)?.[1];
  if(paper&&!item.paper&&['head','origin'].includes(mode)){item.paper=paper;item.reference=plain(inner.match(new RegExp(`DOK_NAME=%27${paper}[^>]*>([\\s\\S]*?)<\\/a>`,'i'))?.[1]||paper.replace(/_\d{4}$/,'').replace('_',' '));const before=t.slice(0,Math.max(0,t.lastIndexOf(item.reference))).replace(/,\s*$/,'').trim();if(before)item.origin=before;mode='paper';continue;}
  const label=t.match(LABEL);
  if(label){
   const rest=t.slice(label[0].length).replace(/^(?:Nicht auf\s+)?TO(?:\s+I{1,2})?\b\s*/i,'').trim();
   mode={beschluss:'result',bericht:'result',abstimmung:'vote','sonstige voten':'vote','vorg.':'prior'}[label[1].toLowerCase()];
   if(mode==='result'&&/^bericht$/i.test(label[1]))item.report=true;
   if(rest&&mode!=='prior')item[mode].push(rest);continue;
  }
  if(mode==='head'&&ORIGIN.test(t)){item.origin=t.replace(/,\s*$/,'');mode='origin';continue;}
  if(mode==='head'&&/^(?:hier:|-\s)/i.test(t)&&item.title.length<300){item.title+=' '+t;continue;}
  if(mode==='result'||mode==='vote')item[mode].push(t);
  else if(STATEMENT.test(t))(item.after||=[]).push(t);
  else if(mode==='head')(item.notes||=[]).push(t);
 }
 close();
 // The council's minutes repeat the item number in the title line ("3. Fragestunde").
 for(const i of items)if(i.number&&i.title.startsWith(i.number+'.'))i.title=i.title.slice(i.number.length+1).trim();
 return {committee,date,council,items:items.filter(i=>i.title&&(i.paper||!ROUTINE.test(i.title)&&(i.decisionName&&i.number||i.result.length||i.after?.length||i.notes?.length)))};
}
// A decision in several parts ("a) Es dient zur Kenntnis … b) Die Stadtverordnetenversammlung stimmt der Vorlage zu")
// is read by its approval or rejection first.
// Abbreviations ("Dr.", "Abs.") end no sentence, so the pattern spans a bounded stretch instead of stopping at a dot.
// "beschließt" alone approves; "beschließt, den Antrag abzulehnen" rejects.
const REJECTED=/\b(?:wird|werden)\b.{0,120}?\babgelehnt\b|\blehnt\b.{0,200}?\bab\b|\babzulehnen\b/i,STRONG=/\bstimmt\b.{0,300}?\bzu\b|\b(?:wird|werden)\b.{0,120}?\b(?:zugestimmt|beschlossen|angenommen)\b/i;
const APPROVED={test:value=>STRONG.test(value)||/\bbeschließt\b/i.test(value)&&!REJECTED.test(value)};
// Sentences of a decision; "Dr." or "Abs." with a following lower-case word or number end none.
const sentences=value=>value.split(/(?<=[.;])\s+(?=(?:[a-z]\)\s)|[A-ZÄÖÜ])/);
/**
 * Status of a decision. A decision on several papers is read by the sentences that name the item's paper. "Beschluss:"
 * is the body's own decision (approved or rejected); "Bericht:" a recommendation to the council (report: true), as is
 * a decision of a body that does not decide (resultStatus, DECIDING_BODY).
 */
export function parlisStatus(result,committee,{report=false,reference=''}={}){
 let part=result;
 if(reference&&REJECTED.test(result)&&APPROVED.test(result)){const own=sentences(result).filter(s=>s.includes(reference));if(own.length)part=own.join(' ');}
 const rejected=REJECTED.test(part),approved=APPROVED.test(part);
 if(rejected&&approved)return resultStatus(part,committee)||'unknown';
 if(rejected||approved)return report?'recommended':approved?'approved':'rejected';
 return resultStatus(part,committee)||(/zur Kenntnis/i.test(part)?'info':null);
}
const clip=(value,max)=>value.length>max?value.slice(0,max).replace(/\s+\S*$/,'')+' …':value;
/** The reports of one document, by meeting: a row per item with its event. */
export function parlisItems(parsed,meeting,source,now=new Date()){
 const date=parsed.date||meeting.date,committee=parsed.committee||meeting.meeting,today=now.toISOString().slice(0,10),minutes=meeting.kind==='minutes';
 return parsed.items.map(i=>{
  const paperUrl=i.paper?parlisDocument(i.paper,source):null,decisionUrl=i.decisionName?parlisDocument(i.decisionName,source):null;
  const id=`${source.id}-${i.paper?'vo-'+slug(i.paper):i.decisionName?'par-'+slug(i.decisionName.slice(4)):'top-'+date.replace(/-/g,'')+'-'+fnv([committee,i.section,i.number,i.title].join('|'))}`;
  const result=clip((i.result.length?i.result:minutes?i.after||[]:[]).join(' '),900),vote=clip(i.vote.join(' '),400);
  const status=date>today?(paperUrl?'consulting':'announced'):result?parlisStatus(result,committee,{report:i.report,reference:i.reference})||'unknown':'unknown';
  const description=date>today?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':result?(i.report?'Empfehlung: ':'Beschluss: ')+result+(vote?' Abstimmung: '+vote:''):minutes?'In der Niederschrift ohne Beschluss geführt.':'Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Dokument nicht belegt.';
  const documents=[...(paperUrl?[{title:'Vorlage '+(i.reference||i.paper),url:paperUrl,kind:'html'}]:[]),...(decisionUrl?[{title:'Beschluss § '+i.decisionName.split('_')[1],url:decisionUrl,kind:'html'}]:[])];
  return {id,title:i.title,reference:i.reference||'',sourceUrl:paperUrl||decisionUrl||meeting.url,identityLinks:[paperUrl,decisionUrl].filter(Boolean),documents,status,
   record:{number:i.number,section:i.section,origin:i.origin||'',reference:i.reference||'',result,vote},
   event:{date,committee,status,description,result,url:meeting.url,publicEvidence:(minutes?'Öffentliche Niederschrift':'Öffentliche Tagesordnung')+(i.section?`, ${i.section}`:'')}};
 });
}
// marks (optional): what earlier imports read completely, see meeting-marks.mjs.
export async function collectParlis(source,{now=new Date(),get=fetchText,request=fetch,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 // Every address is checked, also each target of a redirect: nothing below /PARLIS2S/ or outside /PARLISLINK/.
 const guarded=(url,init)=>{guard(url);return request(url,init);};
 const read=url=>get(guard(allowed(url,source)),source,undefined,guarded);
 const period=historyWindow(lookback)+':',from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10);
 const issues=[],warnings=[],meetings=new Map();
 // A list newest first, page by page, until a page reaches back before `until` or the list ends. An empty page before
 // the end of the list (an error page) is a gap, never the end.
 async function pagesOf(type,what,each,until=null){
  let offset=1,pages=0,reached=false,known=0;
  while(pages<MAX_LIST_PAGES){
   const {rows,next,total}=parlisListRows(await read(parlisList(type,source,offset)));pages++;known=Math.max(known,total);
   if(!rows.length){if(pages===1&&type==='NIED'||offset<=known)throw Error(`Seite ${pages} der ${what} ohne Einträge`);reached=true;break;}
   rows.forEach(each);
   if(until&&rows.at(-1).date<until||!next||next<=offset){reached=true;break;}
   offset=next;
  }
  if(!reached)issues.push(`Liste der ${what} nicht vollständig gelesen (Seitenlimit).`);
 }
 // 1. Minutes inside the period.
 try{await pagesOf('NIED','Niederschriften',r=>{if(r.date>=fromDay&&r.date<=today)meetings.set(r.meeting,{...r,kind:'minutes',url:parlisDocument(r.name,source)});},fromDay);}
 catch(e){issues.push('Niederschriften: '+e.message);}
 // 2. Current agendas: meetings without minutes yet (coming ones, and held ones whose minutes are not published).
 // The name of an agenda is that of its body ("TO-O-10") and is reused for the next meeting: the day tells them apart.
 try{await pagesOf('TAGO','Tagesordnungen',r=>{if(r.date>=fromDay&&!meetings.has(r.meeting))meetings.set(r.meeting,{...r,kind:'agenda',url:parlisDocument(r.name,source)+'#'+r.date});});}
 catch(e){issues.push('Aktuelle Tagesordnungen: '+e.message);}
 const grouped=new Map(),held={};let count=0,limited=false,unchanged=0,done=0,unread=0;
 await parallel([...meetings.values()].sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date)),async m=>{
  const mark=usableMark(marks,m,now),known=mark&&String(mark.print).startsWith(period)?mark:null;
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;return;}
  if(count>=MAX_MEETINGS){limited=true;return;}count++;
  try{
   const parsed=parseParlisDocument(await read(m.url.replace(/#.*$/,'')));
   if(!parsed.items.length&&!parsed.committee){issues.push('Unbekanntes Format des Dokuments: '+m.url);return;}
   const rows=parlisItems(parsed,m,source,now),print=period+(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.record])))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;return;}
   for(const row of rows){
    row.sourceData={version:'public-source-fields-v1',method:'parlis',fetchedAt:now.toISOString(),records:[{kind:m.kind==='minutes'?'minutes':'agenda',url:m.url,fields:row.record}],detailStatus:'completed',issues:[]};delete row.record;
    row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
    const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);previous.identityLinks.push(...row.identityLinks);}else grouped.set(row.id,{...row,events:[row.event]});
   }
   held[m.url]=newMark({...m,date:parsed.date||m.date},print,now,rows.length);done++;
  }catch(e){if(/Zeitbudget/.test(e.message))unread++;else issues.push(m.url+': '+e.message);}
  onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
 },2);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(limited)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),identityLinks:[...new Set(row.identityLinks)],documents:[...new Map([...row.documents,{title:'Niederschrift / Tagesordnung',url:last.url,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche PARLIS-Dokumente; nur der öffentliche Teil.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:meetings.size,...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||limited?{resumable:true}:{}),...(warnings.length?{warnings}:{}),sourceCount:1,quiet:topics.length===0&&unchanged===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
