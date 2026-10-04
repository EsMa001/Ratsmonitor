import {sourceDecision} from './source-fields.mjs';
import {windowStart} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted,paced,REFUSED,BUDGET_REACHED} from './request-budget.mjs';
import {fetchText,allowed,text,decode,MAX_MEETINGS} from './sessionnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
// Public pages of the TYPO3 extension "cronmmratsinfo" (cron IT), e.g. ris.helmstedt.de. Read are the list "Alle Sitzungen"
// with its agenda option, which names every meeting and the numbered items of its public agenda on one page, and the page
// of each meeting in the period, which links the papers of those items (PDF).
// - TYPO3 accepts the plugin's parameters only together with the checksum (cHash) the site puts into its own links. Both
//   lists and every meeting page are therefore reached through the links the site shows; nothing is computed and the
//   search form is not used.
// - Public is what the list prints: it names the items of the public part only, and a meeting without such items as
//   "nichtöffentlich oder ... noch nicht freigegeben" (without a link to its page). A row of a meeting page that the list
//   does not name is not taken. A list that shows no agenda items, or a linked meeting without items, is reported, never
//   counted as non-public.
// - The pages publish no results, so the outcome of a past item stays open.
// - Paper links carry a new no_cache value at every page view. They are kept as shown, as documents only; an item is
//   identified by the paper's record number, or by the meeting's record number with the item's number and title.
const MONTHS={januar:1,februar:2,märz:3,april:4,mai:5,juni:6,juli:7,august:8,september:9,oktober:10,november:11,dezember:12};
const day=value=>{const m=String(value).toLowerCase().match(/(\d{1,2})\.\s*([a-zä]+)\s+(\d{4})/),month=m&&MONTHS[m[2]];return month?`${m[3]}-${String(month).padStart(2,'0')}-${m[1].padStart(2,'0')}`:null;};
const fnv=value=>{let h=0x811c9dc5;for(const c of new TextEncoder().encode(value)){h^=c;h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,'0');};
const key=value=>String(value).toLowerCase().replace(/\s+/g,'');
// Titles of list and page compared without case, spacing and punctuation; one of them may be cut short.
const plain=value=>String(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
const alike=(a,b)=>{const x=plain(a),y=plain(b);return x&&y?x.startsWith(y)||y.startsWith(x):key(a)===key(b);};
const param=(url,name)=>url.searchParams.get(`tx_cronmmratsinfo_pi[${name}]`);
// Relative links resolve against the page's <base href>.
const at=(html,pageUrl)=>{const b=html.match(/<base\s[^>]*href=["']([^"']+)["']/i)?.[1];try{return b?new URL(decode(b),pageUrl).href:pageUrl;}catch{return pageUrl;}};
const anchors=(html,base)=>[...html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)].flatMap(m=>{try{return [{url:new URL(decode(m[2]),base),attributes:m[1]+m[3],label:text(m[4])}];}catch{return [];}});
const onSource=(url,source)=>{try{return allowed(url.href,source);}catch{return null;}};
const fullList=address=>{const u=new URL(address);return param(u,'view')==='sitzungen'&&param(u,'mode')==='all'&&param(u,'showTops')==='1';};
// One paper is linked from every meeting that discusses it, each time under another address.
const paperKey=document=>{try{const record=param(new URL(document.url),'vorlage');return record?'vorlage:'+record:document.url;}catch{return document.url;}};
const LIST_TIMEOUT=60000;
// A container the plugin renders around its views.
const CONTAINER=/\bclass=["'][^"']*\btx(?:-cronmmratsinfo-pi|_cronmmratsinfo_pi-sitzung(?:en)?)["'\s]/i;
// The list shows its agenda items: it offers to hide them, or a meeting carries items.
const topsShown=(html,pageUrl,source,listed)=>listed.some(m=>m.items.length>0)||anchors(html,at(html,pageUrl)).some(a=>param(a.url,'view')==='sitzungen'&&param(a.url,'showTops')==='0'&&onSource(a.url,source));
/**
 * Recognises a page of the extension: null, or the source fields {adapter, base, start}. base is the folder of the TYPO3
 * site, start the page that shows the plugin's meeting list, without the plugin's own parameters (they hold only with
 * their checksum and are taken from the links of the page at every import).
 * The page must show the plugin itself (one of its containers) or link the meeting list on its own host. A page that
 * only links the system on another host (the municipality's site) or names the extension in its text is not one.
 */
export function detectCronRatsinfo(url,html){
 html=String(html||'');if(!/tx_cronmmratsinfo_pi|tx-cronmmratsinfo-pi/i.test(html))return null;
 let page;try{page=new URL(url);}catch{return null;}
 const link=anchors(html,at(html,page.href)).find(a=>a.url.hostname===page.hostname&&param(a.url,'view')==='sitzungen');
 if(!link&&!CONTAINER.test(html))return null;
 const start=new URL((link?.url||page).href);start.protocol='https:';start.hash='';
 for(const name of [...start.searchParams.keys()])if(/^tx_cronmmratsinfo_pi\[|^cHash$/.test(name))start.searchParams.delete(name);
 return {adapter:'cron-ratsinfo',base:start.origin+start.pathname.replace(/[^/]*$/,''),start:start.href};
}
/** The list views a page links on the source: "Alle Sitzungen" (all) and the same list with the agenda items (withTops). */
export function listLinks(html,pageUrl,source){
 const found={};
 for(const a of anchors(html,at(html,pageUrl))){
  if(param(a.url,'view')!=='sitzungen'||param(a.url,'mode')!=='all')continue;
  // Share buttons of the site carry the same parameters inside a foreign address.
  const address=onSource(a.url,source);if(address)found[param(a.url,'showTops')==='1'?'withTops':'all']??=address;
 }
 return found;
}
/** Meetings of a list view: day, committee, the meeting page as linked and the numbered items of the public agenda. */
export function parseCronList(html,pageUrl,source){
 const from=html.search(/tx_cronmmratsinfo_pi-sitzungen/i);if(from<0)return null;
 const base=at(html,pageUrl),meetings=[];
 for(const m of html.slice(from).matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)){
  const date=day(text(m[1]));if(!date)continue;
  const link=anchors(m[2],base).find(a=>param(a.url,'view')==='sitzung'&&param(a.url,'sitzung'));
  // "<number>. <title>"; numbers such as "17.1", "9a", "8 neu" or "--" occur.
  const items=[...(m[2].match(/<ul\b[^>]*>([\s\S]*?)<\/ul>/i)?.[1]||'').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(l=>{const t=text(l[1]),n=t.match(/^(.*?)\.\s+(\S[\s\S]*)$/);return n?{number:n[1].trim(),title:n[2]}:{number:'',title:t};}).filter(i=>i.title);
  const committee=link?.label||text(m[2].replace(/<i\b[\s\S]*?<\/i>/gi,'').split(/<br\s*\/?>/i).filter(s=>text(s)).at(-1)||'');
  meetings.push({date,committee:committee||'Sitzung',url:link?onSource(link.url,source):null,record:link?param(link.url,'sitzung'):null,items});
 }
 return meetings;
}
/** Rows of a meeting page: number, title and the papers linked to the item. null if the page shows no agenda table. */
export function parseCronMeeting(html,pageUrl,source){
 const from=html.search(/tx_cronmmratsinfo_pi-sitzung["'\s]/i);if(from<0)return null;
 const part=html.slice(from),table=part.match(/<table\b[\s\S]*?<\/table>/i)?.[0];if(!table)return null;
 const base=at(html,pageUrl),rows=[];
 for(const r of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...r[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c=>c[1]);if(cells.length<2)continue;
  const title=text(cells[1]);if(!title)continue;
  const papers=anchors(cells.slice(2).join(''),base).filter(a=>param(a.url,'view')==='vorlage'&&param(a.url,'vorlage')).map(a=>({record:param(a.url,'vorlage'),reference:decode(a.attributes.match(/\btitle=["']([^"']*)/)?.[1]||a.attributes.match(/\balt=["']([^"']*)/)?.[1]||'').trim(),url:onSource(a.url,source)}));
  rows.push({number:text(cells[0]).replace(/^TOP\s*/i,''),title,papers});
 }
 return {committee:text(part.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1]||''),date:day(text(part.match(/<b\b[^>]*>([\s\S]*?)<\/b>/i)?.[1]||'')),rows};
}
/**
 * Agenda items of one meeting: the items of the list, each with the papers its row on the meeting page links. A row
 * counts only with the same number and a like title; a row of another item under the same number lends nothing.
 * agenda.onPage tells whether the item's row was found.
 */
export function cronAgenda(meeting,page,source,now=new Date()){
 const today=now.toISOString().slice(0,10),rows=new Map();
 for(const r of page?.rows||[])rows.set(key(r.number),[...(rows.get(key(r.number))||[]),r]);
 return meeting.items.map(item=>{
  const same=rows.get(key(item.number))||[],near=same.filter(r=>alike(r.title,item.title));
  const row=same.find(r=>key(r.title)===key(item.title))||(near.length===1?near[0]:null);
  const papers=row?.papers||[],paper=papers[0];
  const status=meeting.date>today?(paper?'consulting':'announced'):'unknown';
  const description=meeting.date>today?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':'Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Abschnitt nicht belegt.';
  return {id:`${source.id}-${paper?'vo-'+paper.record:'top-'+meeting.record+'-'+fnv([item.number,item.title].join('|'))}`,title:item.title,reference:paper?.reference||'',sourceUrl:meeting.url,identityLinks:[],status,
   documents:papers.filter(p=>p.url).map(p=>({title:p.reference?'Vorlage '+p.reference:'Vorlage',url:p.url,kind:'application/pdf'})),
   event:{date:meeting.date,committee:meeting.committee,status,description,result:'',url:meeting.url,publicEvidence:'Öffentliche Tagesordnung in der Sitzungsliste „Alle Sitzungen“'},agenda:{number:item.number,papers:papers.map(p=>p.reference||p.record),onPage:Boolean(row)}};
 });
}
// source: {id, name, kind, base, start?}; start is the page that shows the meeting list (default: base).
// marks (optional): what earlier imports read completely, see meeting-marks.mjs. The list names the items of every
// meeting; while they are what they were at the last complete reading, the meeting page is not asked again.
export async function collectCronRatsinfo(source,{now=new Date(),get=fetchText,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 const deadline=Date.now()+maxDurationMs,plain=get;get=paced(budgeted(get,maxDurationMs,2));
 // The server needs about 17 s to build the list with every agenda item (500 KB to 2.2 MB, measured 04.10.2026), close
 // to the 20 s that budgeted allows one request. The three list pages may take up to LIST_TIMEOUT within the same budget.
 const list=async url=>{
  const left=deadline-Date.now();if(left<=0)throw Error(BUDGET_REACHED);
  return plain(url,source,Math.min(LIST_TIMEOUT,left)).catch(e=>{throw Date.now()>=deadline-250&&/aborted|timeout/i.test(e.message)?Error(BUDGET_REACHED):e;});
 };
 const fromDay=windowStart(now,lookback).toISOString().slice(0,10),today=now.toISOString().slice(0,10),issues=[];
 // 1. Start page → "Alle Sitzungen" → the same list with the agenda items, each through the link the page shows.
 let listed=[];
 try{
  let url=allowed(source.start||source.base,source),html=await list(url);
  for(let step=0;!fullList(url);step++){
   if(step===2||!/tx_cronmmratsinfo_pi/i.test(html))throw Error('Unbekanntes Format: keine Sitzungsliste der Erweiterung cronmmratsinfo');
   const links=listLinks(html,url,source),next=links.withTops||links.all;
   if(!next||next===url)throw Error('Liste „Alle Sitzungen“ mit Tagesordnung ist nicht verlinkt');
   html=await list(url=next);
  }
  // "Alle Sitzungen" always holds the past meetings; an empty list is markup this reader does not know.
  listed=parseCronList(html,url,source);if(!listed?.length)throw Error('Unbekanntes Format der Sitzungsliste');
  // Without its agenda items the list would make every meeting look non-public (e.g. parameters dropped by TYPO3).
  if(!topsShown(html,url,source,listed))throw Error('Sitzungsliste ohne Tagesordnungspunkte');
 }catch(e){issues.push('Sitzungsliste: '+e.message);listed=[];}
 const inWindow=listed.filter(m=>m.date>=fromDay),meetings=new Map();let upcoming=0,closed=0;
 for(const m of inWindow){
  // The list links the page of a meeting only when it has public items; linked without items is not non-public.
  if(!m.items.length&&m.record){issues.push(`Sitzung vom ${m.date} (${m.committee}) verlinkt, aber ohne Tagesordnungspunkte in der Liste`);continue;}
  if(!m.items.length){if(m.date>today)upcoming++;else closed++;continue;}
  if(!m.url){issues.push(`Sitzung vom ${m.date} (${m.committee}) ohne lesbaren Link auf ihre Seite`);continue;}
  meetings.set(m.url,m);
 }
 // 2. Meeting pages, newest first.
 const grouped=new Map(),held={};let count=0,fetched=0,beyond=0,unchanged=0,done=0,unread=0,refused=0;
 await parallel([...meetings.values()].sort((a,b)=>b.date.localeCompare(a.date)),async m=>{
  const known=usableMark(marks,m,now),print=(await hash(JSON.stringify([m.committee,m.items.map(i=>[i.number,i.title])]))).slice(0,16);
  // Read completely a moment ago, or the list names the same items as then: the reports are in the database already.
  // Papers of a meeting still ahead appear on its page without any change in the list: there only a recent reading counts.
  if(known?.trusted||known?.print===print&&m.date<=today){held[m.url]=marks.known[m.url];unchanged++;count++;return;}
  if(fetched>=MAX_MEETINGS){beyond++;return;}fetched++;
  try{
   const page=parseCronMeeting(await get(m.url,source),m.url,source),rows=page?cronAgenda(m,page,source,now):[];
   // A page of another day, or one whose rows name none of the listed items, is not read: no item, no mark, so that no
   // item loses its paper and with it its id.
   if(!page||page.date!==m.date||!rows.some(r=>r.agenda.onPage)){issues.push('Keine lesbare öffentliche Tagesordnung: '+m.url);return;}
   for(const row of rows){
    const {number,papers}=row.agenda;delete row.agenda;
    row.sourceData={version:'public-source-fields-v1',method:'cron-ratsinfo',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:{number,title:row.title,papers}}],detailStatus:'completed',issues:[]};
    row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
    const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);}else grouped.set(row.id,{...row,events:[row.event]});
   }
   held[m.url]=newMark(m,print,now,rows.length);done++;
  }catch(e){if(/Zeitbudget/.test(e.message))unread++;else if(e.message.includes(REFUSED))refused++;else issues.push(m.url+': '+e.message);}
  count++;onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
 },2);
 if(refused)issues.push(`Server wies ${refused} ${refused===1?'Sitzung':'Sitzungen'} vorübergehend ab; der nächste Schritt setzt dort fort.`);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(beyond)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),documents:[...new Map([...row.documents,{title:'Sitzung / öffentliche Tagesordnung',url:row.sourceUrl,kind:'html'}].map(d=>[paperKey(d),d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche Seite der TYPO3-Erweiterung cronmmratsinfo; nur Tagesordnungspunkte, die die Sitzungsliste öffentlich ausweist.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 // Past meetings without public items are listed by the source as non-public (or not released): not a gap.
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:meetings.size,...(upcoming?{upcomingWithoutAgenda:upcoming}:{}),...(closed?{nonPublicMeetings:closed}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||beyond||refused?{resumable:true}:{}),sourceCount:1,quiet:meetings.size===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.start||source.base}};
}
