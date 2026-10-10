import {sourceDecision} from './source-fields.mjs';
import {windowStart,historyWindow} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text,decode,MAX_MEETINGS} from './sessionnet.mjs';
import {resultStatus} from './sdnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
import {organizationFilter} from './oparl-regional.mjs';
import {isNonPublicText,isNonPublicHeading} from './website-text.mjs';
// RIS-Portal of comundus regisafe (<name>.ris-portal.de): a Liferay portal "Ratsinformation" with the portlet RisSitzung.
// Read are the addresses the public site asks for every visitor, nothing that needs a login:
// - the meetings of one month (portlet resource loadSessions, JSON: sitzungId, start, sessionLink and the body),
// - the page of each meeting (sitzungen?sitzungId=<id>) with its agenda in parts and the documents of each item.
// Only items listed under the heading of the public part ("Öffentlich", "Öffentlicher Teil") are taken. The page lists
// the non-public part below its own heading: the agenda is cut off there, and so at any heading that is not the
// public part (fail closed). Items whose title names the non-public part ("Bekanntgabe der Beschlüsse aus
// nichtöffentlicher Sitzung") are left out as well. The detail page of an item (top-detail) is never requested.
// RIS-Portal has no pages of its own for papers. The document of a paper (Sitzungsvorlage) keeps its id in every meeting
// that discusses it; the consultations of a paper are joined by that id. Documents are linked, not read. Where the
// municipality publishes votes, the meeting page holds them in a side panel per item (offcanvas-abstimmung<id>).
// A shared system (a Gemeindeverwaltungsverband with the councils of its members, vghexental.ris-portal.de) is separated
// by the field organizations of the catalog entry ({include, exclude} name patterns, as in oparl-regional.mjs); a meeting
// whose body the filter does not assign is not read.
const day=value=>{const m=String(value).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:null;};
const fnv=value=>{let h=0x811c9dc5;for(const c of new TextEncoder().encode(value)){h^=c;h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,'0');};
const attribute=(tag,name)=>decode(tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`,'i'))?.[1]||'');
// Titles keep the line breaks of the source as spaces ("… (RLG)<br>hier: …").
const plain=html=>text(String(html||'').replace(/<br\s*\/?>/gi,' '));
const CANCELLED=/\b(?:abgesagt|entfällt|entfaellt|ausgefallen|fällt aus)\b/i;
// The heading of the public part. Each tenant words it itself: "Öffentlich", "- öffentlich -", "ÖFFENTLICHER TEIL:",
// "I. Öffentlicher Teil", "A.) Öffentlicher Teil", "Tagesordnung: öffentlich", "Tagesordnung - öffentlicher Teil",
// "Öffentliche Tagesordnungspunkte". Compared without case, a leading number and surrounding dashes or colons; any other
// heading ends the public agenda. A heading that is only "Tagesordnung" is the public agenda when it is the only part on
// the page: tenants that publish a non-public part show it under a heading of its own (Welver, Hexental).
const PUBLIC_PART=/^(?:(?:tagesordnung|teil\s+[a-z0-9]+)\s*[-–:]?\s*)?(?:öffentlich|oeffentlich)(?:e[rs]?)?(?:\s+(?:teil(?:\s+der\s+tagesordnung)?|sitzung|sitzungsteil|tagesordnung|tagesordnungspunkte|beratungen))?$/;
const partTitle=title=>title.toLowerCase().replace(/\s+/g,' ').replace(/^\s*(?:[a-z]|[ivx]+|\d+)\s*[.)]+\s*/,'').replace(/^[\s\-–—:.*]+|[\s\-–—:.*]+$/g,'');
export const NOT_PUBLIC='Sitzung ohne öffentlichen Teil auf der Seite';
/**
 * A page of the portal: the theme of comundus (obis-theme) and the portlets of com.comundus.ris. base: the site of the
 * portal on that host (/web/ratsinformation/, or the root of a host mapped to its site), taken from the page's own
 * address of the meeting portlet where it shows one.
 */
export function detectRisPortal(url,html=''){
 const page=String(html);
 if(!/obis-theme/.test(page)||!/RisSitzung|com\.comundus\.ris|\/o\/ris-sitzung\//.test(page))return null;
 let u;try{u=new URL(url);}catch{return null;}
 const host=u.hostname.replace(/\./g,'\\.');
 const portlet=page.match(new RegExp(`https://${host}(?::443)?(/[^"'?\\s<>]*?/|/)sitzungen\\?p_p_id=RisSitzung`,'i'))?.[1];
 const nav=page.match(/href=["'](\/(?:web\/[\w-]+\/)?)sitzungen["']/i)?.[1];
 // The general start page of a portal (/startseite of the guest site) links its sites: the council site is taken.
 const council=page.match(/href=["'](\/web\/[\w-]*rats[\w-]*)\/?["']/i)?.[1];
 const site=portlet||nav||u.pathname.match(/^(\/web\/[\w-]+\/)/)?.[1]||(council?council+'/':'/');
 return {adapter:'ris-portal',base:'https://'+u.host+site};
}
/** Address of the meetings of one month (month 0–11 as the portal counts). */
export const risPortalMonthUrl=(source,year,month)=>allowed(source.base+'sitzungen?'+new URLSearchParams({p_p_id:'RisSitzung',p_p_lifecycle:'2',p_p_state:'normal',p_p_mode:'view',p_p_cacheability:'cacheLevelPage',_RisSitzung_resource:'loadSessions',_RisSitzung_year:String(year),_RisSitzung_month:String(month),_RisSitzung_day:'1',_RisSitzung_filterGremiumIds:'',_RisSitzung_filterTypeOfRisCalendarItems:'',_RisSitzung_viewMode:'month'}),source);
/**
 * Meetings of the month list: id, address of the meeting page, day, body (full name and short form), cancelled.
 * Throws on an answer that is no list of meetings (the gap is named, never taken as an empty month).
 */
export function risPortalMeetings(json,source){
 const list=typeof json==='string'?JSON.parse(json):json;
 if(!Array.isArray(list))throw Error('Unbekanntes Format der Sitzungsliste');
 const meetings=[];
 for(const s of list){
  const id=String(s?.sitzungId??'');if(!/^\d+$/.test(id))continue;
  const date=String(s.start||'').match(/^(\d{4}-\d{2}-\d{2})/)?.[1];if(!date)continue;
  const html=String(s.text||''),badge=plain(html.match(/rp-gremium-badge mbsc-hide-in-calendar['"][^>]*>([\s\S]*?)<\/div>/i)?.[1]||'');
  const short=plain(html.match(/rp-gremium-badge mbsc-hide-in-eventlist['"][^>]*>([\s\S]*?)<\/div>/i)?.[1]||'')||String(s.label||'').replace(/\s+\d{1,2}\.\d{1,2}\.\d{4}\s*$/,'').trim();
  let url;try{url=allowed(new URL(String(s.sessionLink||''),source.base).href,source);}catch{continue;}
  // The redesigned theme has no badge with the full name; the link text of the entry states it ("Sitzung Stadtrat am 10.11.2026").
  const linked=plain(html.match(/<a\b[^>]*>\s*Sitzung\s+([\s\S]*?)\s+am\s+\d{1,2}\.\d{1,2}\.\d{4}\s*<\/a>/i)?.[1]||'');
  meetings.push({id,url,date,committee:badge||linked||short,shortName:short,cancelled:CANCELLED.test(plain(html)+' '+String(s.label||''))});
 }
 return meetings;
}
/** The published vote of one item (side panel offcanvas-abstimmung<id>): text and counts, or null. */
export function parseRisPortalVote(html,id){
 const page=String(html||''),at=page.search(new RegExp(`id=["']offcanvas-abstimmung${id}["']`));if(at<0)return null;
 const next=page.indexOf('<div class="offcanvas',at+20),panel=page.slice(at,next<0?at+30000:next);
 const said=plain(panel.match(/Abstimmungstext:[\s\S]*?rp-poll-text-answer[^>]*>([\s\S]*?)<\/div>/i)?.[1]||'');
 const count=kind=>{const n=panel.match(new RegExp(`<li class=["']${kind}["'][^>]*>[\\s\\S]*?<div>\\s*<span>\\s*(\\d+)\\s*<\\/span>`,'i'))?.[1];return n===undefined?null:Number(n);};
 const votes=[['Ja','yes'],['Nein','no'],['Enthalten','contain'],['Befangen','biased'],['Ausgeschlossen','exclusion']].map(([label,kind])=>[label,count(kind)]).filter(([,n])=>n!==null);
 if(!said&&!votes.some(([,n])=>n>0))return null;
 return (said||'Abstimmung')+(votes.some(([,n])=>n>0)?' ('+votes.filter(([label,n])=>n>0||label==='Nein').map(([label,n])=>label+' '+n).join(', ')+')':'');
}
/**
 * Items of the public part of one meeting page; null if the page shows no public part. Items stand in the part's list
 * (li.rp-lis-item) with their number and title; the documents are buttons with the address of a portlet resource.
 */
export function parseRisPortalMeeting(html,meeting,source,now=new Date()){
 const page=String(html||'');
 const heading=plain(page.match(/<h2 class=["']h1["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1]||'');
 const date=meeting.date||day(heading),committee=meeting.committee||heading.match(/^Sitzung\s+(.+?)\s+am\s+\d/)?.[1]||heading||'Öffentliche Sitzung';
 // The redesigned theme (ris-redesign-theme, Dachau) lists the items as div.rp-session-top-result under
 // <h3 class="accordion-list-header">; the classic theme as li.rp-lis-item under <h3 class="h4 accordion-list-header">.
 const redesign=/\brp-session-top-result\b/.test(page);
 const parts=page.split(redesign?/<h3 class=["']accordion-list-header["'][^>]*>/i:/<h3 class=["']h4 accordion-list-header["'][^>]*>/i).slice(1);
 let publicPart=null;
 for(const part of parts){
  const title=partTitle(plain(part.slice(0,part.search(/<\/h3>/i))));
  if((PUBLIC_PART.test(title)||title==='tagesordnung'&&parts.length===1)&&!publicPart){publicPart=part;continue;}
  // The non-public part, or any heading the reader does not know, ends the public agenda.
  break;
 }
 if(!publicPart)return null;
 // The list ends before the side panels (votes, documents, participants) and the meeting data that follow the agenda;
 // the next part (if any) was cut off above. The members' voting form inside an item (offcanvas-top-votes_<id>) is
 // part of the item and no end.
 const end=publicPart.search(/<\/h3>/i),after=publicPart.slice(end);
 const stop=after.search(/<div class=["']offcanvas\b[^>]*\bid=["']offcanvas-(?!top-votes_)|<div class=["']rp-meta-data\b/i),list=stop<0?after:after.slice(0,stop);
 const today=now.toISOString().slice(0,10),items=new Map();let left=0;
 for(const chunk of list.split(redesign?/<div\s+class=["']list-group-item rp-result rp-session-top-result[^"']*["']/i:/<li class=["']rp-lis-item["']/i).slice(1)){
  const number=attribute(chunk.slice(0,chunk.indexOf('>')),'data-top-number').trim();
  const content=redesign?chunk.match(/<h3>\s*<a\b[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i)?.[1]||'':chunk.match(/<div class=["']top-item-content["'][^>]*>\s*<p>([\s\S]*?)<\/p>/i)?.[1]||'';
  const spans=redesign?[]:[...content.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map(m=>plain(m[1]));
  const title=redesign?plain(content).trim():(spans.length>1&&spans[0].replace(/\s+/g,'')===number.replace(/\s+/g,'')?spans.slice(1).join(' '):plain(content).replace(new RegExp('^'+number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*'),'')).trim();
  if(!title)continue;
  // A title that names the non-public part (or is a heading of it) is not taken, whatever part it stands in.
  if(isNonPublicText(title)||isNonPublicHeading(title)){left++;continue;}
  const documents=[];
  const buttons=redesign?[...chunk.matchAll(/<a class=["']document-link["']([^>]*)>([\s\S]*?)<\/a>/gi)]:[...chunk.matchAll(/<button class=["']document-button["']([^>]*)>([\s\S]*?)<\/button>/gi)];
  for(const button of buttons){
   const href=attribute(button[1],'data-href'),docid=attribute(button[1],'data-docid'),type=attribute(button[1],'data-type');
   if(!docid||!href)continue;
   const label=redesign?plain(attribute(button[1],'data-title')||button[2])||type||'Dokument':plain(button[2].match(/<span class=["']d-none doc-title["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]||'')||type||'Dokument';
   if(isNonPublicText(label))continue;
   let url;try{url=allowed(new URL(href,meeting.url).href,source);}catch{continue;}
   documents.push({title:label,url,kind:'application/pdf',type,docid});
  }
  const paper=documents.find(d=>/^Sitzungsvorlage$/i.test(d.type)||/vorlage/i.test(d.type)&&!/unterlage/i.test(d.type));
  const id=`${source.id}-rp-${paper?'vo-'+paper.docid:'top-'+date.replace(/-/g,'')+'-'+fnv([committee,number,title].join('|'))}`;
  if(items.has(id)){items.get(id).documents.push(...documents);continue;}
  const decided=documents.some(d=>/beschluss/i.test(d.type)||/beschluss/i.test(d.title));
  const voteId=chunk.match(/data-target=["']offcanvas-abstimmung(\d+)["']/i)?.[1],result=date<=today&&voteId?parseRisPortalVote(page,voteId)||'':'';
  const status=date>today?(paper?'consulting':'announced'):result&&resultStatus(result,committee)||'unknown';
  const description=date>today?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':result?'Abstimmungsergebnis: '+result:decided?'Öffentlich auf der Tagesordnung; der Beschluss liegt als Dokument vor.':'Öffentlich auf der Tagesordnung; ein Ergebnis ist auf der Sitzungsseite nicht angegeben.';
  items.set(id,{id,title,reference:'',number,sourceUrl:meeting.url,identityLinks:[meeting.url],documents:documents.map(({title,url,kind})=>({title,url,kind})),status,
   event:{date,committee,status,description,result,url:meeting.url,publicEvidence:'Öffentliche Tagesordnung, Abschnitt „'+plain(publicPart.slice(0,end))+'“'}});
 }
 return {date,committee,items:[...items.values()],left};
}
// marks (optional): what earlier imports read completely, see meeting-marks.mjs; a mark counts only for its period.
export async function collectRisPortal(source,{now=new Date(),get=fetchText,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 const read=url=>get(allowed(url,source),source);
 const period=historyWindow(lookback)+':';
 const from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10);
 // Notices appear weeks ahead: the months up to the end of the month after next.
 const until=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+3,0)),untilDay=until.toISOString().slice(0,10);
 const filter=source.organizations?organizationFilter(source.organizations):null,skipped={filtered:0,mixed:0,unassigned:0};
 const issues=[],warnings=[],meetings=new Map();let cancelled=0;
 // 1. The months of the period, newest first: a period cut by the time budget keeps the recent meetings.
 const months=[],first=Date.UTC(from.getUTCFullYear(),from.getUTCMonth(),1);
 for(const d=new Date(Date.UTC(until.getUTCFullYear(),until.getUTCMonth(),1));d.getTime()>=first;d.setUTCMonth(d.getUTCMonth()-1))months.push([d.getUTCFullYear(),d.getUTCMonth()]);
 let listed=0;
 for(const [year,month] of months){
  try{
   for(const m of risPortalMeetings(await read(risPortalMonthUrl(source,year,month)),source)){
    if(m.date<fromDay||m.date>untilDay||meetings.has(m.id))continue;
    if(m.cancelled){cancelled++;continue;}
    if(filter){const verdict=filter([{name:m.committee,shortName:m.shortName}]);if(verdict!=='kept'){skipped[verdict]++;continue;}}
    meetings.set(m.id,m);
   }
   listed++;
  }catch(e){if(/Zeitbudget/.test(e.message)){issues.push('Zeitbudget der Quelle erreicht; ältere Monate nicht gelesen.');break;}issues.push(`Sitzungsliste ${String(month+1).padStart(2,'0')}/${year}: ${e.message}`);}
 }
 if(!listed)return {topics:[],marks:{},readMeetings:0,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:0,sourceCount:1,quiet:false,complete:false,issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
 if(skipped.filtered)warnings.push(`${skipped.filtered} Sitzungen anderer Gremien des gemeinsamen Systems ausgelassen.`);
 if(skipped.unassigned)warnings.push(`${skipped.unassigned} Sitzungen ohne zuordenbares Gremium ausgelassen.`);
 if(cancelled)warnings.push(`${cancelled} abgesagte Sitzungen ausgelassen.`);
 // 2. Meeting pages.
 const grouped=new Map(),held={};let count=0,limited=false,upcoming=0,unchanged=0,done=0,unread=0,left=0;
 await parallel([...meetings.values()].sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date)),async m=>{
  const mark=usableMark(marks,m,now),known=mark&&String(mark.print).startsWith(period)?mark:null;
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;return;}
  if(count>=MAX_MEETINGS){limited=true;return;}count++;
  try{
   const agenda=parseRisPortalMeeting(await read(m.url),m,source,now);
   // A scheduled meeting whose agenda is not released has nothing public yet; a past one is named.
   if(!agenda){if(m.date>today)upcoming++;else warnings.push(NOT_PUBLIC+': '+m.url);return;}
   left+=agenda.left;
   const rows=agenda.items,print=period+(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.number,r.documents.map(d=>d.url)])))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;return;}
   for(const row of rows){
    const {number}=row;delete row.number;
    row.sourceData={version:'public-source-fields-v1',method:'ris-portal',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:{title:row.title,number,committee:agenda.committee}}],detailStatus:'completed',issues:[]};
    row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
    const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);previous.identityLinks.push(...row.identityLinks);}else grouped.set(row.id,{...row,events:[row.event]});
   }
   held[m.url]=newMark({...m,date:agenda.date},print,now,rows.length);done++;
  }catch(e){if(/Zeitbudget/.test(e.message))unread++;else issues.push(m.url+': '+e.message);}
  onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
 },2);
 if(left)warnings.push(`${left} Punkte, deren Titel den nichtöffentlichen Teil nennt, nicht übernommen.`);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht gelesen.`);
 if(limited)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Tagesordnungspunkt: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.committee+': '+e.description).join('\n'),identityLinks:[...new Set(row.identityLinks)],documents:[...new Map([...row.documents,{title:'Sitzung / öffentliche Tagesordnung',url:row.sourceUrl,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche Seite des RIS-Portals; nur Punkte des öffentlichen Teils.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:meetings.size-upcoming,...(upcoming?{upcomingWithoutAgenda:upcoming}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||limited?{resumable:true}:{}),...(warnings.length?{warnings}:{}),sourceCount:1,quiet:topics.length===0&&unchanged===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
