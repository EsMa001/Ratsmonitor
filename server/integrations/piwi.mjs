import {sourceDecision} from './source-fields.mjs';
import {windowStart,historyWindow} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text,decode,MAX_MEETINGS} from './sessionnet.mjs';
import {resultStatus} from './sdnet.mjs';
import {createSession} from './allris.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
// PIWi, the "Politisches Informationssystem Wiesbaden" (own development of the city, Apache Wicket). Read are plain
// addresses of the public site only:
// - the calendar export of all bodies (gremium/ical/gremium/0); it reaches back to January of the current year only,
// - the public agenda of each meeting (sitzung/detail/<id>/tagesordnung/oeffentlich),
// - the page of each paper on it (antrag/detail/<id>, sitzungsvorlage/detail/<id>) with its consultation sequence,
// - the published vote of an item (sitzung/top/<id>/abstimmungsergebnis).
// The meeting lists with a date filter are forms of a page session; they are not used. A meeting whose public agenda is
// not released sends the reader to the members' login (extranet): that address is never requested. The non-public
// agenda is never requested either. Decisions themselves are published as PDF only and are linked, not read.
export const LOGIN='Quelle leitet zur Anmeldung um; keine öffentliche Seite.';
const MONTHS={januar:1,februar:2,märz:3,maerz:3,april:4,mai:5,juni:6,juli:7,august:8,september:9,oktober:10,november:11,dezember:12};
const day=value=>{const m=String(value).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:null;};
const longDay=value=>{const m=String(value).match(/(\d{1,2})\.\s*(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/i);return m?`${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2,'0')}-${m[1].padStart(2,'0')}`:day(value);};
const fnv=value=>{let h=0x811c9dc5;for(const c of new TextEncoder().encode(value)){h^=c;h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,'0');};
const slug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
// Wicket writes the session into a link (";jsessionid=…", also "….node1") when a request carries no session cookie.
const clean=url=>url.replace(/;jsessionid=[^?#/]*/gi,'');
const anchors=html=>[...html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)].map(m=>({url:clean(decode(m[2])),attributes:m[1]+m[3],label:text(m[4])}));
const title=a=>decode(a.attributes.match(/title=["']([^"']*)/)?.[1]||'');
const quoted=value=>value.match(/„([^“]+)“/)?.[1]||'';
const address=(href,page,source)=>{try{const u=new URL(clean(href),page);u.search='';u.hash='';return allowed(clean(u.href),source);}catch{return null;}};
const pdfs=(html,page,source)=>anchors(html).filter(a=>/\/dokument\/\w+\/\d+/.test(a.url)).map(a=>({title:(quoted(title(a))||a.label||'Originalunterlage').replace(/\.pdf$/i,''),url:address(a.url,page,source),kind:'application/pdf'})).filter(d=>d.url);
// A heading of the non-public part, however it is written ("Nichtöffentliche Tagesordnung", "Vertraulicher Teil").
const RESTRICTED=/nicht\s*[-–]?\s*(?:ö|oe)ffentlich|vertraulich/i;
const berlin=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'});
// Times in the export are UTC ("…Z"); the day of a meeting is the day in Wiesbaden.
const localDay=stamp=>{const m=stamp.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);if(!m)return null;return m[7]?berlin.format(new Date(Date.UTC(+m[1],m[2]-1,+m[3],+m[4],+m[5],+m[6]))):`${m[1]}-${m[2]}-${m[3]}`;};
const agendaAddress=(id,source)=>allowed(new URL(`sitzung/detail/${id}/tagesordnung/oeffentlich`,source.base).href,source);
export function detectPiwi(url,html=''){
 const page=String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';
 if(!/PIWi\s*-\s*Politisches Informationssystem/i.test(page)&&!(/Wicket/.test(html)&&/PIWI\.|piwi\.css/.test(html)&&/sitzung\/(?:kalender|uebersicht|detail)/.test(html)))return null;
 // The members' login (extranet) and the subscription pages carry the same title; they lie below the root as well.
 const u=new URL(url),root=clean(u.pathname).match(/^(.*?\/)(?:aktuelles|sitzung|sitzungsvorlage|antrag|gremium|fraktion|person|suche|service|dokument|extranet|abo|dokumentversand)(?:[/;?]|$)/)?.[1]||u.pathname.replace(/[^/]*$/,'');
 return {adapter:'piwi',base:'https://'+u.host+root};
}
/**
 * Meetings of the calendar export: the agenda address, the day, the body and whether the meeting is called off
 * (marked in the summary, "(Entfällt)", or by the status of the entry).
 */
export function piwiCalendar(ics,source){
 const meetings=[];
 for(const event of String(ics).replace(/\r?\n[ \t]/g,'').split('BEGIN:VEVENT').slice(1)){
  const start=event.match(/DTSTART[^:\r\n]*:(\d{8}(?:T\d{6}Z?)?)/)?.[1],link=event.match(/\nURL[^:\r\n]*:(\S+\/sitzung\/detail\/(\d+))/);
  if(!start||!link)continue;
  const summary=(event.match(/\nSUMMARY[^:\r\n]*:([^\r\n]*)/)?.[1]||'').replace(/\\([,;\\])/g,'$1').trim(),cancelled=/\((?:entfällt|abgesagt)\)/i.test(summary)||/\nSTATUS[^:\r\n]*:\s*CANCELLED\b/i.test(event);
  try{allowed(link[1],source);meetings.push({url:agendaAddress(link[2],source),date:localDay(start),committee:summary.replace(/^Sitzung\s+/i,'').replace(/\s*\((?:entfällt|abgesagt)\)\s*$/i,''),cancelled});}catch{/* link outside the approved source */}
 }
 return meetings;
}
/**
 * Items of the public agenda; null if the page shows no public agenda. The agenda is divided into parts
 * ("Tagesordnung I", "Tagesordnung II" …); the same paper may stand in two of them and is one item then.
 */
export function parsePiwiAgenda(html,meeting,source,now=new Date()){
 const at=html.search(/<h2>\s*Öffentliche Tagesordnung\s*<\/h2>/i);if(at<0)return null;
 const heading=text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
 const date=longDay(heading)||meeting.date,committee=heading.split(/\s+-\s+/).slice(1).join(' - ').trim()||meeting.committee||'Öffentliche Sitzung';
 const end=html.indexOf('docview-visibility',at),table=html.slice(at,end<0?undefined:end),today=now.toISOString().slice(0,10),items=new Map();let section='';
 for(const row of table.split(/<div class=["']d-table-row\b[^"']*["'][^>]*>/i).slice(1)){
  const kind=row.match(/images\/(TO_\w+)\.svg/)?.[1],headline=text(row.match(/<span class=["']text-keepwhitespace[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]||'');
  // Any row that is no item and names the non-public part ends the public agenda, whatever its icon.
  if(kind!=='TO_TOP'){if(RESTRICTED.test(headline))break;if(kind==='TO_Ueberschrift')section=headline;continue;}
  if(!headline)continue;
  const number=text(row.match(/text-center["'][^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/i)?.[1]||''),all=anchors(row);
  const link=all.find(a=>/\/\w+\/detail\/\d+(?:[?#]|$)/.test(a.url)&&/Vorgang/.test(title(a))),vote=all.find(a=>/\/top\/\d+\/abstimmungsergebnis(?:[?#]|$)/.test(a.url));
  const paperUrl=link?address(link.url,meeting.url,source):null,voteUrl=vote?address(vote.url,meeting.url,source):null;
  const reference=paperUrl?quoted(title(link))||link.label:'',note=text(row.match(/<em>([\s\S]*?)<\/em>/i)?.[1]||''),documents=pdfs(row,meeting.url,source);
  const id=`${source.id}-${reference?'vo-'+slug(reference):paperUrl?'vo-'+paperUrl.match(/(\w+)\/detail\/(\d+)$/).slice(1).join('-'):'top-'+date.replace(/-/g,'')+'-'+fnv([committee,section,number,headline].join('|'))}`;
  const previous=items.get(id);
  // The row that carries the vote (the part where the item was decided) describes the item.
  if(previous){previous.documents.push(...documents);if(voteUrl&&!previous.agenda.voteUrl)Object.assign(previous.agenda,{number,section,voteUrl,note});continue;}
  items.set(id,{id,title:headline,reference,sourceUrl:paperUrl||meeting.url,identityLinks:[paperUrl].filter(Boolean),documents,agenda:{number,section,paperUrl,voteUrl,note}});
 }
 return {date,committee,items:[...items.values()].map(item=>{
  const {section,paperUrl,note}=item.agenda,status=date>today?(paperUrl?'consulting':'announced'):'unknown';
  const description=date>today?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':/noch nicht vor/i.test(note)?'Öffentlich auf der Tagesordnung; ein Beschluss liegt laut Quelle noch nicht vor.':'Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Abschnitt nicht belegt.';
  return {...item,status,event:{date,committee,status,description,result:'',url:meeting.url,publicEvidence:'Öffentliche Tagesordnung'+(section?`, Abschnitt „${section}“`:'')}};
 })};
}
/**
 * Paper page: descriptive fields, the documents and the consultation sequence ("Ergebnisse") with the meetings that
 * discussed the paper; null if the page is not recognisable (no heading). The text of the paper shown on the page
 * ("Ziel der Vorlage") is not kept. Only a paper marked "Öffentlicher Vorgang" keeps its subject and documents: a paper
 * marked otherwise, or not marked at all, counts as not public.
 */
export function parsePiwiPaper(html,source,page){
 const main=html.slice(Math.max(0,html.indexOf('<main')),html.includes('</main>')?html.indexOf('</main>'):undefined),fields=[];
 const heading=text(main.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');if(!heading)return null;fields.push({field:'Vorgang',value:heading});
 const subject=text(main.match(/<h2>\s*Betreff\s*<\/h2>[\s\S]*?<span class=["']text-keepwhitespace["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]||'');if(subject&&subject.length<1200)fields.push({field:'Betreff',value:subject});
 for(const m of main.matchAll(/<div class=["']keyvalue-key["'][^>]*>([\s\S]*?)<\/div>\s*<div class=["']keyvalue-value["'][^>]*>([\s\S]*?)<\/div>/gi)){const field=text(m[1]).replace(/:$/,''),value=text(m[2]);if(field&&field.length<60&&value&&value.length<300)fields.push({field,value});}
 const art=fields.find(f=>f.field==='Art')?.value||'',restricted=RESTRICTED.test(art)||!/^öffentlich/i.test(art);
 const docsAt=main.search(/<h2[^>]*>\s*Dokumente\s*<\/h2>/i),resultsAt=main.search(/<h2[^>]*>\s*Ergebnisse\s*<\/h2>/i);
 const documents=restricted||docsAt<0?[]:pdfs(main.slice(docsAt,resultsAt>docsAt?resultsAt:undefined),page,source),consultations=[];
 for(const entry of (resultsAt<0?'':main.slice(resultsAt)).split(/<div class=["']list-group-item\b/i).slice(1)){
  const date=day(text(entry.match(/<span class=["']font-weight-medium["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]||'')),meeting=entry.match(/href=["']([^"']*sitzung\/detail\/(\d+)\/tagesordnung\/oeffentlich[^"']*)["']/i);
  if(!date||!meeting)continue;
  const body=anchors(entry).find(a=>/\/gremium\/detail\//.test(a.url));
  try{consultations.push({url:agendaAddress(meeting[2],source),date,committee:body?.label||'',documents:restricted?[]:pdfs(entry,page,source)});}catch{/* foreign address */}
 }
 return {fields:restricted?fields.filter(f=>f.field!=='Betreff'):fields,documents,consultations,restricted};
}
/** The published vote of one agenda item, as written ("Einstimmig", "Umsetzung auf TO I" …); null if the page is not recognisable. */
export function parsePiwiVote(html){
 const card=html.match(/Abstimmungs-Ergebnis\s*(?:<\/b>)?\s*<\/div>\s*<div class=["']card-body["'][^>]*>([\s\S]*?)<\/div>/i);if(!card)return null;
 let result=text(card[1]);
 if(result.length>600)result=result.slice(0,600).replace(/\s+\S*$/,'')+' …';
 return result;
}
// marks (optional): what earlier imports read completely, see meeting-marks.mjs. As with SD.NET a mark counts only for
// the import period it was written with: paper pages name earlier meetings, and only those inside the period are read.
export async function collectPiwi(source,{now=new Date(),get=fetchText,request=fetch,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 // One session per import, as a browser holds it. A redirect to the members' login is refused before it is sent.
 const session=createSession(request),guarded=(url,init)=>{if(/\/extranet(?:[/;?]|$)/i.test(new URL(url).pathname))throw Error(LOGIN);return session.plain(url,init);};
 const read=url=>get(allowed(url,source),source,undefined,guarded);
 const period=historyWindow(lookback)+':';
 const from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10),until=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+2,0)).toISOString().slice(0,10);
 // Meetings called off are left out, also when a paper names them in its consultation sequence.
 const issues=[],warnings=[],meetings=new Map(),cancelled=new Set();const keep=m=>{if(m.date>=fromDay&&m.date<=until&&!meetings.has(m.url)&&!cancelled.has(m.url)){meetings.set(m.url,m);return true;}return false;};
 // 1. Calendar export of all bodies.
 try{const listed=piwiCalendar(await read(source.base+'gremium/ical/gremium/0'),source);if(!listed.length)throw Error('Kalenderexport ohne Sitzungen');
  for(const m of listed)if(m.cancelled)cancelled.add(m.url);else keep(m);
  const first=listed.map(m=>m.date).sort()[0];
  // Deliberately an issue, not a warning: the source publishes these meetings, the reader only cannot list them. A
  // period that reaches before January of the export's first year is therefore never complete for this source (the
  // attempt counts as partial), and the coverage says so instead of claiming the whole period.
  if(fromDay<first.slice(0,4)+'-01-01')issues.push(`Der Kalenderexport der Quelle beginnt am ${first.split('-').reverse().join('.')}; frühere Sitzungen im Zeitraum sind nur erfasst, soweit eine gelesene Vorlage sie in ihrer Beratungsfolge nennt.`);
 }catch(e){issues.push('Kalenderexport: '+e.message);}
 const grouped=new Map(),papers=new Map(),votes=new Map(),held={};let count=0,limited=false,upcoming=0,unchanged=0,done=0,unread=0;
 // A page that is not recognisable is a gap, never an empty result.
 const cached=(cache,url,parse,what)=>{if(!cache.has(url))cache.set(url,read(url).then(html=>{const parsed=parse(html);if(parsed==null)throw Error('Unbekanntes Format der '+what+': '+url);return parsed;}));return cache.get(url);};
 // 2. Public agendas. A paper page names every meeting that discussed the paper; meetings inside the period that the
 //    export does not list (earlier years) are read in the next round, until no new meeting turns up.
 let round=[...meetings.values()];
 while(round.length){
  const found=[];
  await parallel(round.sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date)),async m=>{
   const mark=usableMark(marks,m,now),known=mark&&String(mark.print).startsWith(period)?mark:null;
   // Read completely a moment ago: an import that ran out of time continues behind it without asking again.
   if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;return;}
   if(count>=MAX_MEETINGS){limited=true;return;}count++;
   try{
    const html=await read(m.url).catch(e=>{if(e.message===LOGIN)return null;throw e;}),agenda=html&&parsePiwiAgenda(html,m,source,now);
    // A scheduled meeting without a released agenda has nothing public to read yet. A past meeting without a public
    // agenda (only a non-public part, or never released) is a remark; a page that is not recognisable is a gap.
    if(!agenda){if(m.date>today)upcoming++;else if(html===null)warnings.push('Sitzung ohne öffentliche Tagesordnung: '+m.url);else issues.push('Keine lesbare öffentliche Tagesordnung: '+m.url);return;}
    const rows=agenda.items,print=period+(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.reference,r.agenda.number,r.agenda.section,r.agenda.voteUrl,r.agenda.note,r.documents.map(d=>d.url)])))).slice(0,16);
    if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;return;}
    let cut=false,complete=true;
    const fail=(row,e,what)=>{row.sourceData.detailStatus='partial';row.sourceData.issues.push(e.message);complete=false;if(/Zeitbudget/.test(e.message))cut=true;else issues.push(what+': '+e.message);};
    for(const row of rows){
     const {number,section,paperUrl,voteUrl,note}=row.agenda;delete row.agenda;
     row.sourceData={version:'public-source-fields-v1',method:'piwi',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:{reference:row.reference,title:row.title,number,section,note}}],detailStatus:'completed',issues:[]};
     if(voteUrl&&agenda.date<=today){
      try{const result=await cached(votes,voteUrl,parsePiwiVote,'Abstimmungsseite');
       if(result){row.event.result=result;row.event.description='Abstimmungsergebnis: '+result+(row.documents.some(d=>/beschluss/i.test(d.title))?'. Der Beschlusstext liegt als PDF vor.':'');row.event.status=row.status=resultStatus(result,agenda.committee)||row.status;row.sourceData.records.push({kind:'vote',url:voteUrl,fields:{result}});}
      }catch(e){fail(row,e,'Abstimmungsergebnis');}
     }
     if(paperUrl){
      try{const detail=await cached(papers,paperUrl,html=>parsePiwiPaper(html,source,paperUrl),'Vorlagenseite');
       row.documents.push(...detail.documents);row.sourceData.records.push({kind:'paper',url:paperUrl,fields:detail.fields});
       for(const c of detail.consultations)if(keep(c))found.push(c);
      }catch(e){fail(row,e,'Vorlagendetails');}
     }
     row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
     const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);previous.identityLinks.push(...row.identityLinks);}else grouped.set(row.id,{...row,events:[row.event]});
    }
    // A meeting counts as read only if every page behind it could be read.
    if(cut)unread++;else if(complete){held[m.url]=newMark({...m,date:agenda.date},print,now,rows.length);done++;}
   }catch(e){if(/Zeitbudget/.test(e.message))unread++;else issues.push(m.url+': '+e.message);}
   onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
  },2);
  round=found;
 }
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(limited)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),identityLinks:[...new Set(row.identityLinks)],documents:[...new Map([...row.documents,{title:'Vorgang / öffentliche Tagesordnung',url:row.sourceUrl,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche PIWi-Seite; nur Punkte der öffentlichen Tagesordnung.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 const listed=meetings.size-upcoming;
 // Unchanged meetings are a successful reading: their reports are in the database already.
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:listed,...(upcoming?{upcomingWithoutAgenda:upcoming}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||limited?{resumable:true}:{}),...(warnings.length?{warnings}:{}),sourceCount:1,quiet:topics.length===0&&unchanged===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
