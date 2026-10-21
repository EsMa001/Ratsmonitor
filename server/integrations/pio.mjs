import {sourceDecision} from './source-fields.mjs';
import {windowStart} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text,decode,MAX_MEETINGS} from './sessionnet.mjs';
import {createSession} from './allris.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
import {RESTRICTED,asciiSlug as slug,fnv,germanDay as day,germanLongDay as longDay} from './source-common.mjs';
// PIO, the "Politisches Informationssystem Offenbach" (own development of the city of Offenbach am Main). Every paper,
// invitation and decision is one HTML document (a converted Word file) under index.php?aktiv=doc. Read are plain links
// of the public site only: the agenda overview (one archive list per body), the invitation of each meeting, the page of
// each paper on a public agenda and the decision extracts linked from it. No search form, no "Mappe", no login.
// - Only items above a heading of the non-public part are taken; PIO publishes the public part only.
// - A result is taken from the "Auszug aus der Niederschrift" of the same meeting, which names body and date.
const address=(href,source)=>{if(!source)return null;try{return allowed(new URL(decode(href),source.base).href,source);}catch{return null;}};
// The non-public part. The invitations are converted Word files that write its heading in many ways ("II.
// Nichtöffentlicher Teil", "B) Nicht öffentliche Sitzung", "Nicht öffentlich:", "Vertraulicher Teil", "Teil B –
// nicht öffentlich"). A line that begins with such a word, and any short line that names it, ends the public part.
const closing=line=>RESTRICTED.test(line)&&(line.length<80||/^(?:[IVX]+|[A-Za-z]|\d+)?[.):]?\s*[-–]?\s*(?:nicht\s*[-–]?\s*(?:ö|oe)ffentlich|vertraulich)/i.test(line));
// Names of a body as the overview and an extract write them ("Ausschuss für Umwelt …", "des Ausschusses für Umwelt …").
const nameWords=name=>new Set((String(name).toLowerCase().match(/[a-zäöüß]{3,}/g)||[]).filter(w=>!/^(?:für|und|der|des|die|dem|den|sowie)$/.test(w)).map(w=>w.replace(/(?:es|s)+$/,'')).filter(Boolean));
const sameBody=(a,b)=>{const x=nameWords(a),y=nameWords(b),[small,large]=x.size<=y.size?[x,y]:[y,x];return small.size>0&&[...small].every(w=>large.has(w));};
// The document itself: between the container and the closing notice ("nicht rechtsverbindlich").
const documentBody=html=>{const at=html.search(/class=["']pio-doc-container["']/i);if(at<0)return null;const end=html.indexOf('pio-warnung',at);return html.slice(at,end<0?undefined:end);};
/** Lines of a document with the links each line holds; a link keeps its whole label even across line breaks. */
function lines(fragment,source){
 const found=[];
 const marked=fragment.replace(/<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,(m,href,label)=>{found.push({url:address(href,source),label:text(label)});return `\u0001${found.length-1}\u0002`;});
 return decode(marked.replace(/<br\s*\/?>|<\/(?:p|div|li|h\d|tr)>/gi,'\n').replace(/<[^>]+>/g,' ')).split('\n').map(row=>({text:row.replace(/\u0001(\d+)\u0002/g,(m,i)=>found[i].label).replace(/\s+/g,' ').trim(),links:[...row.matchAll(/\u0001(\d+)\u0002/g)].map(m=>found[m[1]]).filter(l=>l.url)})).filter(l=>l.text);
}
export function detectPio(url,html=''){
 const title=String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';
 if(!/PIO:\s*Politisches Informationssystem/i.test(title)&&!(/index\.php\?aktiv=tagesordnungen/.test(html)&&/class=["'][^"']*\bpio-/.test(html)))return null;
 const u=new URL(url);return {adapter:'pio',base:'https://'+u.host+u.pathname.replace(/[^/]*$/,'')};
}
/** Bodies of the agenda overview, each with its archive list (the plain link the page offers without scripts). */
export function pioBodies(html,source){
 const bodies=[];
 for(const m of html.matchAll(/<td[^>]*class=["'][^"']*pio-ausschuss-ext-name[^"']*["'][^>]*>([\s\S]*?)<\/td>([\s\S]*?)(?=<td[^>]*pio-ausschuss-ext-name|<\/table>)/gi)){
  const list=m[2].match(/index\.php\?aktiv=tagesordnungenliste&(?:amp;)?ausschuss=(\d+)/)?.[1],name=text(m[1]);
  if(list&&name)bodies.push({name,url:allowed(new URL('index.php?aktiv=tagesordnungenliste&ausschuss='+list,source.base).href,source)});
 }
 return bodies;
}
/** Invitations in the archive list of one body; the label names the day of the meeting. */
export function pioInvitations(html,committee,source){
 const meetings=[];
 for(const m of html.matchAll(/<a\b[^>]*href=["']([^"']*aktiv=doc[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  const label=text(m[2]),date=day(label),url=date&&address(m[1],source);
  if(url&&/einladung|tagesordnung/i.test(label))meetings.push({url,date,committee,label});
 }
 return meetings;
}
/** Public agenda items of an invitation; null if the document holds no agenda item. */
export function parsePioAgenda(html,meeting,source,now=new Date()){
 const fragment=documentBody(html);if(!fragment)return null;
 const tops=[];let open=null,current=null;
 for(const line of lines(fragment,source)){
  if(closing(line.text)){open=false;break;}
  if(/^(?:[IVX]+|[A-Za-z]|\d+)?[.):]?\s*öffentliche[rn]?\s+(?:Teil|Sitzung|Tagesordnung)\b/i.test(line.text)){open=true;continue;}
  const top=line.text.match(/^TOP\s*(\d+(?:\.\d+)*[a-z]?)\b\.?:?\s*(.*)$/i);
  if(top){current={number:top[1],rows:top[2]?[{text:top[2],links:line.links}]:[]};tops.push(current);continue;}
  current?.rows.push(line);
 }
 if(!tops.length)return null;
 const today=now.toISOString().slice(0,10),future=meeting.date>today,items=new Map();
 const publicEvidence=open?'Abschnitt „Öffentlicher Teil“ der Einladung':'Öffentlich bereitgestellte Einladung';
 for(const t of tops){
  const all=t.rows.flatMap(r=>r.links),papers=all.filter(l=>/[?&]aktiv=doc\b/.test(l.url)&&new URL(l.url).searchParams.get('dsnummer')),paper=papers[0];
  const title=(paper?.label||t.rows[0]?.text||'').replace(/[\s:]+$/,'');if(!title)continue;
  const reference=paper?new URL(paper.url).searchParams.get('dsnummer').trim():'';
  // Submitter and date of the paper, as the invitation prints them below its title.
  const joined=t.rows.map(r=>r.text).join(' '),after=joined.slice(joined.indexOf(title)+title.length).trim(),cut=reference?after.indexOf(reference):-1;
  const note=(cut>=0?after.slice(0,cut+reference.length):paper?after:'').slice(0,300);
  const id=`${source.id}-${reference?'vo-'+slug(reference):'top-'+meeting.date.replace(/-/g,'')+'-'+fnv([meeting.committee,t.number,title].join('|'))}`;
  const documents=papers.slice(1).map(l=>({title:l.label||'Drucksache',url:l.url,kind:'html'}));
  if(items.has(id)){items.get(id).documents.push(...documents);continue;}
  const status=future?(reference?'consulting':'announced'):'unknown';
  const description=future?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':'Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Abschnitt nicht belegt.';
  items.set(id,{id,title,reference,sourceUrl:paper?.url||meeting.url,identityLinks:[paper?.url].filter(Boolean),status,documents,
   event:{date:meeting.date,committee:meeting.committee,status,description,result:'',url:meeting.url,publicEvidence},agenda:{number:t.number,note,paperUrl:paper?.url||null}});
 }
 return [...items.values()];
}
/**
 * Paper page: header fields and the linked documents (decision extracts, attachments); null if the page is neither a
 * document nor carries the document tree. The paper's text is not kept.
 */
export function parsePioPaper(html,source){
 const at=html.search(/class=["']Baum["']/i);if(at<0&&!documentBody(html))return null;
 const fields=[],push=(field,value)=>{value=text(value);if(value&&value.length<1200)fields.push({field,value});};
 push('Drucksache',html.match(/PIO-Kopfzeile-Links["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]);
 for(const m of html.matchAll(/PIO-Kopfzeile-Rechts["'][^>]*>([\s\S]*?)<\/span>/gi)){const k=text(m[1]).match(/^(Ausgegeben am|Eing\.\s*Dat\.)\s*(.+)$/i);if(k)push(/^Ausgegeben/i.test(k[1])?'Ausgegeben':'Eingang',k[2]);}
 const tree=at<0?'':html.slice(at,html.indexOf('</div>',at)),documents=[],decisions=[];
 for(const m of tree.matchAll(/<li class=["']ref( aktiv)?["'][^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  const span=name=>text(m[3].match(new RegExp(`class=["'][^"']*pio-${name}[^"']*["'][^>]*>([\\s\\S]*?)<\\/span>`,'i'))?.[1]||'');
  const type=span('doctype'),number=span('dsnummer'),subject=span('betreff');
  if(m[1]){push('Dokumentart',type);push('Betreff',subject);continue;}
  const url=address(m[2],source);if(!url)continue;
  documents.push({title:/^Anlage/i.test(type)?subject||type:[type,number].filter(Boolean).join(' ')||'Dokument',url,kind:'html'});
  if(/^Beschluss/i.test(type))decisions.push(url);
 }
 return {fields,documents,decisions};
}
/**
 * Extract of the minutes: the body and day of the meeting and the decisions as published. An extract holds one
 * "Beschlusslage" per paper decided under the item, each headed by its number when there are several (an amendment
 * "…/1" first, then the paper itself).
 */
export function parsePioDecision(html){
 const fragment=documentBody(html);if(!fragment)return null;
 const flat=lines(fragment).map(l=>l.text).join(' ').replace(/\s+/g,' ');
 const head=flat.match(/Niederschrift über die (?:\d+\.\s*)?Sitzung (?:der|des) (.+?) am (\d{1,2}\.\s*[A-Za-zäÄ]+\s+\d{4}|\d{1,2}\.\d{1,2}\.\d{4})/i);if(!head)return null;
 const end=/\s*(?:Der Antragstext kann|Dem Magistrat der Stadt|Obenstehenden Beschlussauszug|Offenbach a\.\s*M\.,\s*den)[\s\S]*$/i;
 const results=flat.split(/Beschlusslage\s*:?\s*/i).slice(1).map(block=>{
  const reference=block.match(/^(\S+\/DS-\S+)\s+/)?.[1]||'';let result=block.slice(reference.length).replace(end,'').trim();
  if(result.length>600)result=result.slice(0,600).replace(/\s+\S*$/,'')+' …';
  return {reference,result};
 }).filter(r=>r.result);
 return {body:head[1].trim(),date:longDay(head[2]),results};
}
/** The decision on one paper: the block headed by its number, or the only block if the extract names none. */
export const pioResult=(decision,reference)=>decision?.results.find(r=>r.reference===reference)||(decision?.results.length===1&&!decision.results[0].reference?decision.results[0]:null);
// marks (optional): what earlier imports read completely, see meeting-marks.mjs.
export async function collectPio(source,{now=new Date(),get=fetchText,request=fetch,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 // One session per import, as a browser holds it; the site opens a new one for every request without its cookie.
 const session=createSession(request),read=url=>get(allowed(url,source),source,undefined,session.plain);
 const from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10),until=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+2,0)).toISOString().slice(0,10);
 const issues=[],meetings=new Map();
 // 1. Agenda overview: the bodies and, for each, the archive list of its invitations.
 let bodies=[];
 try{bodies=pioBodies(await read(source.base+'index.php?aktiv=tagesordnungen'),source);if(!bodies.length)throw Error('Unbekanntes Format der Tagesordnungsübersicht');}catch(e){issues.push('Tagesordnungen: '+e.message);}
 for(const b of bodies){try{for(const m of pioInvitations(await read(b.url),b.name,source))if(m.date>=fromDay&&m.date<=until&&!meetings.has(m.url))meetings.set(m.url,m);}catch(e){issues.push(`Tagesordnungen ${b.name}: ${e.message}`);}}
 const grouped=new Map(),papers=new Map(),decisions=new Map(),held={};let count=0,unchanged=0,done=0,unread=0,upcoming=0,fetched=0,beyond=0;
 const cached=(cache,url,parse)=>{if(!cache.has(url))cache.set(url,read(url).then(parse));return cache.get(url);};
 // A paper page that is not recognisable is a gap, never a paper without documents.
 const paperOf=url=>html=>{const detail=parsePioPaper(html,source);if(!detail)throw Error('Unbekanntes Format der Drucksache: '+url);return detail;};
 // 2. Invitations, then the paper behind each item; decision extracts only for meetings that have taken place.
 await parallel([...meetings.values()].sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date)),async m=>{
  const known=usableMark(marks,m,now);
  // Read completely a moment ago: an import that ran out of time continues behind it without asking again.
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;count++;return;}
  if(fetched>=MAX_MEETINGS){beyond++;return;}fetched++;
  try{
   const rows=parsePioAgenda(await read(m.url),m,source,now);
   // An invitation without agenda items is not an empty agenda: for a past meeting it is a gap.
   if(!rows){if(m.date>today)upcoming++;else issues.push('Keine lesbare öffentliche Tagesordnung: '+m.url);count++;return;}
   const print=(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.reference,r.agenda.number,r.event.status,r.documents.map(d=>d.url)])))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;count++;return;}
   let cut=false,complete=true;
   for(const row of rows){
    const {number,note,paperUrl}=row.agenda;delete row.agenda;
    row.sourceData={version:'public-source-fields-v1',method:'pio',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:{reference:row.reference,title:row.title,number,note}}],detailStatus:'completed',issues:[]};
    if(paperUrl){
     try{const detail=await cached(papers,paperUrl,paperOf(paperUrl));
      row.documents.push(...detail.documents);row.sourceData.records.push({kind:'paper',url:paperUrl,fields:detail.fields});
      // The extract of this meeting: the same day and the same body (two bodies may decide the paper on one day).
      if(m.date<=today)for(const url of detail.decisions){
       const d=await cached(decisions,url,parsePioDecision),own=d?.date===m.date&&sameBody(d.body,m.committee)&&pioResult(d,row.reference);if(!own)continue;
       // The extract is free text written for people ("beschließt gemäß Antrag, nachdem der Änderungsantrag abgelehnt
       // wurde"); a status read from it would be wrong too often. The text is kept, the status stays as the agenda gives it.
       row.event.result=own.result;row.event.description='Beschluss laut Auszug aus der Niederschrift: '+own.result;
       row.sourceData.records.push({kind:'decision',url,fields:{body:d.body,date:d.date,reference:own.reference,result:own.result}});break;
      }
     }catch(e){row.sourceData.detailStatus='partial';row.sourceData.issues.push(e.message);complete=false;if(/Zeitbudget/.test(e.message))cut=true;else issues.push('Vorlagendetails: '+e.message);}
    }
    row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
    const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);previous.identityLinks.push(...row.identityLinks);}else grouped.set(row.id,{...row,events:[row.event]});
   }
   // A meeting counts as read only if every paper page behind it could be read.
   if(cut)unread++;else if(complete){held[m.url]=newMark(m,print,now,rows.length);done++;}
  }catch(e){if(/Zeitbudget/.test(e.message))unread++;else issues.push(m.url+': '+e.message);}
  count++;onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
 },2);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(beyond)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),identityLinks:[...new Set(row.identityLinks)],documents:[...new Map([...row.documents,{title:'Drucksache / öffentliche Tagesordnung',url:row.sourceUrl,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t,{place:source.name}));
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche PIO-Seite; nur Tagesordnungspunkte des öffentlichen Teils der Einladung.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 const listed=meetings.size-upcoming;
 // Unchanged meetings are a successful reading: their reports are in the database already.
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:listed,...(upcoming?{upcomingWithoutAgenda:upcoming}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||beyond?{resumable:true}:{}),sourceCount:1,quiet:listed===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
