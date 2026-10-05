import {sourceDecision} from './source-fields.mjs';
import {windowStart} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,MAX_MEETINGS} from './sessionnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
import {decodeEntities,repairMojibake,composeUmlauts,isNonPublicText,isNonPublicHeading,closedLine} from './website-text.mjs';
// Sitzungsdienst "councilservice" of mein-intra.net, embedded in the municipality's own website (Sonnewalde, Mulda/Sa.,
// Werra-Suhl-Tal …). The website page loads <mandant>.mein-intra.net/export/js/initialize.js and calls
// initializeExport("<token>"); the script then asks the JSON interface of the system with the headers
// X-Requested-By: spa-export and X-Export-Token: <token>. Without the token the system sends programs and people to its
// login. The reader sends the same requests the page sends for every visitor and nothing that needs a login:
// - POST councilservice/session/fetch-overview/mine/0/by-docs/0?range=individual&schedule_start&schedule_end with
//   {usePager:0}: the meetings of a period,
// - GET councilservice/entry/fetch/id/<id>: one meeting with its agenda (topics, nested as children) and documents.
// Public and non-public items (in doubt nothing is taken):
// - A meeting counts only if it says visibility 1 and display_contents 1; an item only with visibility 1. Most systems
//   set visibility 0 on a non-public item, and the interface then shows "Nicht-öffentlicher Tagesordnungspunkt".
// - Some set every item visible and mark the title instead ("Ö: …", "NÖ: …", Sonnewalde). Where an agenda marks items
//   as public, an item without that mark is neither public nor non-public: it is left out and named.
// - An item whose title names the non-public part in any spelling (isNonPublicText of the website reader: "NÖ", "N.Ö.",
//   "nichtöff.", "Ausschluss der Öffentlichkeit" …) is left out with its sub-items. If it is a heading of the
//   non-public part ("Nichtöffentlicher Teil", "Teil B – nicht öffentlich"), or a heading closes the public part
//   ("Schließung des öffentlichen Teils", "Geschlossene Sitzung"), nothing after it is taken.
// - Documents whose name or address names the non-public part are not linked.
// Links point to the page of the municipality's website that embeds the system (…href=/councilservice/entry/view/<id>)
// and to the files of the system as that page links them. The catalog entry names the system (base), the token and
// that page (page); the system is the only host asked.
const day=value=>/^\d{4}-\d{2}-\d{2}/.test(String(value||''))?String(value).slice(0,10):null;
// Text as a person reads it: markup and entities (also escaped twice), UTF-8 read as Windows-1252, combining umlauts,
// soft hyphens and zero-width characters. Anything but text is no text.
const plain=value=>typeof value==='string'||typeof value==='number'?composeUmlauts(repairMojibake(decodeEntities(String(value).replace(/<[^>]*>/g,' ')))).replace(/[­​-‍⁠﻿]/g,'').replace(/\s+/g,' ').trim():'';
const TOKEN=/^[0-9a-f]{8}(?:-[0-9a-f]{4,12}){2,5}$/i,TENANT=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,BASE=/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.mein-intra\.net\/$/;
const yes=value=>value===1||value==='1',no=value=>value===0||value==='0';
const HREF=/^href(?:_[A-Za-z0-9_-]+)?$/;
// The address the website hands the embedded system: ?href=/councilservice/… or ?href_<token>=…, plain or in the
// URL-safe base64 the script writes itself.
function hrefParameter(url){
 let u;try{u=new URL(url);}catch{return null;}
 for(const [key,value] of u.searchParams){
  if(!HREF.test(key))continue;
  if(value.startsWith('/'))return value;
  if(/^[A-Za-z0-9_-]+={0,2}$/.test(value))try{
   const b64=value.replace(/-/g,'+').replace(/_/g,'/').replace(/=+$/,''),text=new TextDecoder().decode(Uint8Array.from(atob(b64+'='.repeat((4-b64.length%4)%4)),c=>c.charCodeAt(0)));
   if(text.startsWith('/'))return text;
  }catch{}
 }
 return null;
}
/** The page of the website without the address of the embedded system (href, href_*), session suffix and fragment. */
export function councilservicePage(url){
 let u;try{u=new URL(url);}catch{return null;}
 if(!/^https?:$/.test(u.protocol)||u.username||u.password)return null;
 for(const key of [...u.searchParams.keys()])if(HREF.test(key))u.searchParams.delete(key);
 u.pathname=u.pathname.replace(/;jsessionid=[^/]*/i,'');u.hash='';
 return u.href;
}
/**
 * The page of a municipal website that embeds the council service: the export script of a mein-intra.net system and
 * its token, on a page whose address opens the council service (…?href=/councilservice/…). null for any other page:
 * another module of the same system (appointments, forms) or a page that merely links the council service.
 * Result: {base, token, page}; page keeps the page's own query (index.php?id=438) without the system's address.
 */
export function detectCouncilservice(url,html=''){
 const code=String(html).replace(/<!--[\s\S]*?-->/g,'');
 const scripts=[...code.matchAll(/<script\b[^>]*\bsrc=["']https:\/\/([a-z0-9-]+)\.mein-intra\.net\/export\/js\/initialize\.js["']/gi)].map(m=>m[1].toLowerCase());
 const tokens=[...new Set([...code.matchAll(/initializeExport\(\s*["']([^"']+)["']\s*\)/g)].map(m=>m[1]))];
 // One system and one export on the page; several are not told apart.
 if(new Set(scripts).size!==1||tokens.length!==1||!TENANT.test(scripts[0])||!TOKEN.test(tokens[0]))return null;
 if(!/^\/councilservice\//.test(hrefParameter(url)||''))return null;
 const page=councilservicePage(url);if(!page)return null;
 return {adapter:'councilservice',base:`https://${scripts[0]}.mein-intra.net/`,token:tokens[0],page};
}
/** Headers the export script sends with every request. */
export const councilserviceHeaders=token=>({'X-Requested-By':'spa-export','X-Export-Token':token,'X-Requested-With':'XMLHttpRequest',Accept:'application/json'});
/** The page of the website that shows one meeting (the website's own link format). */
export const councilserviceLink=(source,id)=>source.page+(source.page.includes('?')?'&':'?')+'href=/councilservice/entry/view/'+encodeURIComponent(String(id));
// Bodies among the groups of a meeting. Besides the body, a meeting names the staff to be informed ("Amtsleiter
// Stadtverwaltung", "OT-Verantwortlicher Zeckerin"); those are no body.
const BODY=/(?:versammlung|vertretung|gemeinderat|stadtrat|ortschaftsrat|ortsrat|ortsbeirat|beirat|ausschuss|kreistag|\brat\b)/i;
const bare=group=>group.replace(/\s*\(.*\)\s*$/,'');
// Words of a name as a title writes them ("Ausschusses für Bau" → ausschu, bau), as in pio.mjs.
const nameWords=name=>new Set((plain(name).toLowerCase().match(/[a-zäöüß]{3,}/g)||[]).filter(w=>!/^(?:für|und|der|des|die|dem|den|sowie|sitzung|sondersitzung|öffentliche|stadt|gemeinde)$/.test(w)).map(w=>w.replace(/(?:es|s)+$/,'')).filter(w=>w.length>=3));
/**
 * The body of a meeting. The groups of a meeting are the invited (a committee meeting invites the council too, "Sitzung
 * aller Ortsbeiräte" every Ortsbeirat): taken is the body whose name the title of the meeting holds, else the only body
 * among the groups, else the title. Two bodies that the title names equally well: the title.
 */
export function councilserviceCommittee(entry){
 const bodies=(Array.isArray(entry?.groups)?entry.groups:[]).map(g=>plain(g?.group_name)).filter(g=>g&&BODY.test(bare(g)));
 const title=nameWords(entry?.title),hits=name=>[...nameWords(name)].filter(w=>title.has(w)).length;
 const named=bodies.filter(g=>{const own=nameWords(bare(g));return own.size>0&&[...own].every(w=>title.has(w));}).sort((a,b)=>hits(b)-hits(a));
 if(named.length>1&&hits(named[0])===hits(named[1]))return plain(entry?.title)||'Öffentliche Sitzung';
 return named[0]||(bodies.length===1?bodies[0]:'')||plain(entry?.title)||'Öffentliche Sitzung';
}
/**
 * Meetings of the list → {meetings:[{id, date, title, committee, topics, url}], issues}. Deactivated entries and series
 * (has_recurrence) are left out; a series is a calendar entry, not a meeting with an agenda of its own, and one that
 * announces agenda items is named. A list that holds fewer meetings than it counts is named as well.
 */
export function councilserviceMeetings(json,source){
 const list=typeof json==='string'?JSON.parse(json):json,entries=list?.data?.entries;
 if(list?.status!=='OK'||!Array.isArray(entries))throw Error('Unbekanntes Format der Sitzungsliste');
 const known=entries.filter(e=>e&&/^\d+$/.test(String(e.id))&&day(e.recurrence_start));
 if(entries.length&&!known.length)throw Error('Unbekanntes Format der Sitzungsliste');
 const issues=[],counted=Number(list.data.filteredCount??list.data.count);
 if(Number.isFinite(counted)&&counted>entries.length)issues.push(`Sitzungsliste unvollständig (${entries.length} von ${counted})`);
 const series=known.filter(e=>yes(e.has_recurrence)&&Number(e.cnt_topics)>0).length;
 if(series)issues.push(`${series} ${series===1?'Serientermin':'Serientermine'} mit Tagesordnung nicht gelesen`);
 const meetings=known.filter(e=>!yes(e.deactivated)&&!yes(e.has_recurrence)).map(e=>({id:String(e.id),date:day(e.recurrence_start),title:plain(e.title),committee:councilserviceCommittee(e),topics:Number(e.cnt_topics)||0,url:councilserviceLink(source,e.id)}));
 return {meetings,issues};
}
// Numbering before a title ("TOP 12:", "12.1", "II)", "B –"), and the note on items added in the meeting.
const NUMBERING=/^(?:TOP\s*)?(?:\d+(?:\.\d+)*[a-z]?|[IVX]+|[A-H])\s*[.):–-]?\s+/iu,ADDED=/^in\s+der\s+sitzung\s+aufgenommen\s*:\s*/iu;
const core=label=>label.replace(ADDED,'').replace(NUMBERING,'').replace(ADDED,'');
// A mark of the public part: "Ö:" before the title or "(Ö)" after it (also "Ö -", "- ö -", "[Ö]").
const PUBLIC_MARK=/^Ö\s*[:.)\-–]\s*/iu,PUBLIC_MARK_END=/\s*(?:\(\s*Ö\s*\)|\[\s*Ö\s*\]|[-–]\s*Ö\s*[-–]?)\s*$/iu;
const publicMark=label=>PUBLIC_MARK.test(core(label))||PUBLIC_MARK_END.test(label);
// A non-public mark before the title, removed to see what the title is.
const RESTRICTED_MARK=/^(?:N\.?\s?Ö\.?|NOE)\s*[:.)\-–]?\s*/iu;
// The end of the public part, named without naming the non-public part ("Schluss der öffentlichen Sitzung") or naming it.
const CLOSING=/^(?:(?:schluss|schließ(?:ung|en)|schliess(?:ung|en)|ende|beendigung|abschluss)\s+(?:des|der)?\s*öffentliche[nr]?\s+(?:teils?|sitzung|tagesordnung)|beginn\s+(?:des|der)\s+nicht\s*[-–_]?\s*(?:ö|oe)ffentlichen|geschlossene[rn]?\s+(?:teil|sitzung)|in\s+geschlossener\s+sitzung|interne[rn]?\s+(?:teil|sitzung)|(?:ausschlu(?:ss|ß)|ausschließung)\s+der\s+(?:ö|oe)ffentlichkeit|herstellung\s+der\s+nicht\s*[-–_]?\s*(?:ö|oe)ffentlichkeit|nicht\s*[-–_]?\s*(?:ö|oe)ffentliche[rn]?\s+(?:teil|sitzung|tagesordnung(?:steil)?)(?!\p{L})|vertrauliche[rn]?\s+(?:teil|sitzung))/iu;
// A title that names the non-public part and is a heading of it: short, or beginning with it ("Teil B – nicht öffentlich").
const opensRestricted=(label,c)=>{const t=c.replace(RESTRICTED_MARK,'');return t.length<=40||isNonPublicHeading(label)||closedLine(label)||/^(?:teil\s*[a-z0-9]\s*[-–:]?\s*)?(?:nicht\s*[-–_]?\s*(?:ö|oe)ffentl|nichtöffentl|nichtoeffentl|vertraulich|geschlossen|intern)/iu.test(t);};
// Vorlage numbers in titles ("(BV 27/2026)", "BV-Nr. 53/26", "Drucksache 8/2026"): one matter consulted in several
// meetings. The last number of a title counts ("Aufhebung des Beschlusses BV 12/2024 … (BV 40/2026)"); kind, number and
// year are normalised, so "BV 036/26" and "BV 36/2026" are the same matter and a Drucksache 8/2026 is another one.
const REFERENCE=/(?<![\p{L}\p{N}])(BV|DS|Beschlussvorlage|Drucksache)(?:[\s.-]*Nr\.?)?\s*[-:]?\s*(\d{1,4})\s*[/_-]\s*(\d{4}|\d{2})(?!\d)/giu;
export function councilserviceReference(title){
 const m=[...String(title).matchAll(REFERENCE)].at(-1);if(!m)return null;
 const kind=/^(?:BV|Beschlussvorlage)$/i.test(m[1])?'BV':'DS',number=Number(m[2]),year=m[3].length===2?'20'+m[3]:m[3];
 return {label:`${kind} ${number}/${year}`,key:`${kind.toLowerCase()}-${number}-${year}`};
}
/**
 * A document of the system as the page links it; null for anything that is not a file of the council service of this
 * export, for a calendar file and for a document whose name or address names the non-public part.
 */
export function councilserviceDocument(document,source){
 if(!document||typeof document!=='object')return null;
 const names=[document.description,document.filename_original,document.filename,document.link,document.paths?.data].filter(v=>typeof v==='string'&&v);
 if(names.some(isNonPublicText)||names.some(n=>/\.ics(?:$|[?#])/i.test(n)))return null;
 if(!(document.is_deleted===undefined||document.is_deleted===null||document.is_deleted===false||no(document.is_deleted)))return null;
 const title=plain(document.description)||plain(document.filename_original)||plain(document.filename);if(!title)return null;
 let url=null;
 if(document.paths?.data!==undefined&&document.paths?.data!==null){
  // The link of the page: on this system, below the export of this token, no query, no fragment, no encoded separator.
  try{const u=new URL(String(document.paths.data)),m=u.pathname.match(/^\/export\/auth\/([0-9a-f-]+)\/data\/file\/councilservice\/(?:\d+\/)+[^/]+$/i);
   if(u.origin+'/'===source.base&&!u.search&&!u.hash&&m&&m[1]===source.token&&!/%(?:2e|2f|5c)/i.test(u.pathname))url=allowed(u.href,source);}catch{}
 }else if(/^councilservice\/(?:\d+\/)+$/.test(String(document.path||''))&&/^[^/\\?#%]+$/.test(String(document.filename||''))&&!/^\.+$/.test(String(document.filename))){
  url=allowed(source.base+'export/auth/'+source.token+'/data/file/'+document.path+encodeURIComponent(document.filename),source);
 }
 if(!url)return null;
 return {title,url,kind:/\.pdf$/i.test(String(document.filename||''))?'application/pdf':'document'};
}
/**
 * Public agenda items of one meeting (entry/fetch/id/<id>); null if the meeting has no agenda at all; restricted:true if
 * the meeting itself is not released (visibility or display_contents 0).
 * left: items left out as non-public (flag, mark, words, after the end of the public part); unmarked: items without the
 * public mark on an agenda that uses it; unclear: items of an unknown format.
 */
export function parseCouncilserviceMeeting(json,meeting={},source){
 const j=typeof json==='string'?JSON.parse(json):json,e=j?.data?.entry;
 if(j?.status!=='OK'||!e||typeof e!=='object')throw Error('Unbekanntes Format der Sitzung');
 if(meeting.id&&String(e.id)!==String(meeting.id))throw Error('Sitzung antwortet mit einer anderen Kennung');
 if(!Array.isArray(e.topics))throw Error('Unbekanntes Format der Tagesordnung');
 // The meeting names its groups by number only; their names come with the list (meeting.committee).
 const date=day(e.recurrence_start)||meeting.date,committee=meeting.committee||councilserviceCommittee(e);
 if(no(e.visibility)||no(e.display_contents))return {date,committee,items:[],documents:[],restricted:true,left:0,unmarked:0,unclear:0,changed:''};
 if(!yes(e.visibility)||!yes(e.display_contents))throw Error('Sitzung ohne erkennbare Freigabe (visibility/display_contents)');
 if(!e.topics.length)return null;
 const children=t=>{if(t?.children===undefined||t?.children===null)return [];if(!Array.isArray(t.children))throw Error('Unbekanntes Format der Tagesordnung');return t.children;};
 const count=list=>{let n=0;const c=l=>{for(const t of l){n++;if(t&&typeof t==='object')c(children(t));}};c(list);return n;};
 const all=[];const flat=list=>{for(const t of list){all.push(t);if(t&&typeof t==='object')flat(children(t));}};flat(e.topics);
 const marks=all.some(t=>typeof t?.label==='string'&&publicMark(plain(t.label)));
 const items=[];let left=0,unmarked=0,unclear=0,closed=false;
 const walk=(list,parent)=>{
  for(const t of list){
   if(closed){left++;if(t&&typeof t==='object')left+=count(children(t));continue;}
   if(!t||typeof t!=='object'||typeof t.label!=='string'){unclear++;if(t&&typeof t==='object')unclear+=count(children(t));continue;}
   const label=plain(t.label),c=core(label),below=count(children(t));
   // A heading that ends the public part ends it whatever its flag says.
   if(CLOSING.test(c)){closed=true;left+=1+below;continue;}
   // visibility 1 only; 0 (the system hides the item) and anything else are left out with all items below.
   if(!yes(t.visibility)){left+=1+below;continue;}
   if(isNonPublicText(label)){if(opensRestricted(label,c))closed=true;left+=1+below;continue;}
   if(marks&&!publicMark(label)){unmarked+=1+below;continue;}
   // The mark is not part of the title; numbering before "Ö:" goes with it ("12. Ö: Haushalt" → "Haushalt").
   const title=(marks&&PUBLIC_MARK.test(c)?c.replace(PUBLIC_MARK,''):label.replace(ADDED,'').replace(marks?PUBLIC_MARK_END:/$^/,'')).trim();
   const own=plain(t.numeration)||plain(t.custom_numeration)||String(t.position??''),number=parent&&!own.includes('.')?parent+'.'+own:own;
   // A heading of the public part groups items; an invitation is no item. Their sub-items are read.
   if(!title||/^(?:[IVX]+\.?|[A-Z][.)]|\d+\.?)?\s*öffentliche[rn]?\s+(?:teil|sitzung|tagesordnung)\s*:?$/iu.test(title)||/^einladung\b/iu.test(title)){walk(children(t),parent);continue;}
   const reference=councilserviceReference(title);
   const documents=(Array.isArray(t['documents-topic'])?t['documents-topic']:[]).map(d=>councilserviceDocument(d,source)).filter(Boolean);
   if(/^\d+$/.test(String(t.id)))items.push({key:String(t.id),number,title,reference:reference?.label||'',referenceKey:reference?.key||'',documents});else unclear++;
   walk(children(t),number);
  }
 };
 walk(e.topics,'');
 const documents=(Array.isArray(e.documents)?e.documents:[]).map(d=>councilserviceDocument(d,source)).filter(Boolean);
 return {date,committee,items,documents,left,unmarked,unclear,changed:[e.edited,e.recurrence_start,e.title].join('|')};
}
// marks (optional): what earlier imports read completely, see meeting-marks.mjs.
// request: fetch for the requests to the system; the headers of the export script are added to it.
export async function collectCouncilservice(source,{now=new Date(),get=fetchText,request=fetch,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 const from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10),issues=[],warnings=[],meetings=new Map();
 const until=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+2,0)).toISOString().slice(0,10);
 if(!BASE.test(String(source.base||'')))throw Error('Katalogeintrag ohne Adresse eines mein-intra-Systems (base)');
 if(!TOKEN.test(String(source.token||'')))throw Error('Katalogeintrag ohne Export-Schlüssel (token)');
 if(!/^https?:\/\/[^/?#]+\/[^#]*$/.test(String(source.page||'')))throw Error('Katalogeintrag ohne Seite der Website (page)');
 const headers=councilserviceHeaders(source.token);
 const send=body=>(url,init={})=>request(url,{...init,...(body?{method:'POST',body:JSON.stringify(body)}:{}),headers:{...init.headers,...headers,...(body?{'Content-Type':'application/json'}:{})}});
 // Without a valid token the system answers with its login page: no JSON, named as such.
 const read=async(url,body)=>{const text=await get(allowed(url,source),source,undefined,send(body));try{return JSON.parse(text);}catch{throw Error(/<html/i.test(text)?'System antwortet mit einer Webseite statt Daten (Export-Schlüssel nicht mehr gültig?)':'Antwort ist kein JSON');}};
 // 1. Meetings of the period, up to the end of next month, in one list.
 try{
  const query=new URLSearchParams({range:'individual',schedule_start:fromDay,schedule_end:until});
  const list=councilserviceMeetings(await read(source.base+'councilservice/session/fetch-overview/mine/0/by-docs/0?'+query,{usePager:0}),source);
  issues.push(...list.issues);
  for(const m of list.meetings)if(m.date>=fromDay&&m.date<=until)meetings.set(m.id,m);
 }catch(e){issues.push('Sitzungsliste: '+e.message);}
 const grouped=new Map(),held={};let count=0,unchanged=0,done=0,unread=0,upcoming=0,fetched=0,beyond=0,withoutAgenda=0,restricted=0;
 const ordered=[...meetings.values()].sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date));
 // 2. Agenda of each meeting that has one.
 await parallel(ordered,async m=>{
  if(!m.topics){if(m.date>today)upcoming++;else withoutAgenda++;return;}
  const known=usableMark(marks,m,now);
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;count++;return;}
  if(fetched>=MAX_MEETINGS){beyond++;return;}fetched++;
  try{
   const agenda=parseCouncilserviceMeeting(await read(source.base+'councilservice/entry/fetch/id/'+encodeURIComponent(m.id)),m,source);
   if(!agenda){issues.push(`${m.url}: Tagesordnung mit ${m.topics} ${m.topics===1?'Punkt':'Punkten'} angekündigt, aber nicht geliefert`);count++;return;}
   if(agenda.restricted){restricted++;count++;return;}
   // Items without the public mark on an agenda that marks the others are neither public nor non-public: named, and the
   // meeting is read again next time.
   if(agenda.unmarked)issues.push(`${m.url}: ${agenda.unmarked} ${agenda.unmarked===1?'Tagesordnungspunkt':'Tagesordnungspunkte'} ohne Kennzeichnung als öffentlich ausgelassen`);
   if(agenda.unclear)issues.push(`${m.url}: ${agenda.unclear} ${agenda.unclear===1?'Tagesordnungspunkt':'Tagesordnungspunkte'} in unbekanntem Format ausgelassen`);
   if(!agenda.items.length){if(!agenda.unmarked&&!agenda.unclear){if(m.date>today)upcoming++;else withoutAgenda++;}count++;return;}
   const print=(await hash(JSON.stringify([agenda.changed,agenda.items.map(i=>[i.key,i.title,i.number,i.documents.map(d=>d.url)]),agenda.documents.map(d=>d.url)]))).slice(0,16);
   if(known?.print===print&&!agenda.unmarked&&!agenda.unclear){held[m.url]=marks.known[m.url];unchanged++;count++;return;}
   const future=agenda.date>today;
   for(const item of agenda.items){
    const status=future?(item.reference?'consulting':'announced'):'unknown';
    const description=future?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':'Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Abschnitt nicht belegt.';
    const event={date:agenda.date,committee:agenda.committee,status,description,result:'',url:m.url,publicEvidence:'Öffentlicher Teil der Tagesordnung im Sitzungsdienst der Website',attendance:{status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]}};event.decision=sourceDecision(event);
    // One matter in several meetings shares its Vorlage number; an item without one is a matter of its own.
    const id=item.referenceKey?`${source.id}-vo-${item.referenceKey}`:`${source.id}-cs-${m.id}-${item.key}`;
    const row={id,title:item.title,reference:item.reference,sourceUrl:m.url,identityLinks:[m.url],status,documents:[...item.documents,...agenda.documents],
     sourceData:{version:'public-source-fields-v1',method:'councilservice',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:{number:item.number,title:item.title,...(item.reference?{reference:item.reference}:{})}}],detailStatus:'completed',issues:[]}};
    const previous=grouped.get(row.id);if(previous){previous.events.push(event);previous.documents.push(...row.documents);previous.identityLinks.push(...row.identityLinks);}else grouped.set(row.id,{...row,events:[event]});
   }
   // A meeting counts as read only if every item could be told public or not.
   if(!agenda.unmarked&&!agenda.unclear){held[m.url]=newMark({...m,date:agenda.date},print,now,agenda.items.length);done++;}
  }catch(e){if(/Zeitbudget/.test(e.message))unread++;else issues.push(m.url+': '+e.message);}
  count++;onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
 },2);
 if(withoutAgenda)warnings.push(`${withoutAgenda} ${withoutAgenda===1?'vergangene Sitzung':'vergangene Sitzungen'} ohne veröffentlichte Tagesordnung`);
 if(restricted)warnings.push(`${restricted} ${restricted===1?'Sitzung':'Sitzungen'} ohne Freigabe der Inhalte für die Website`);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(beyond)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),identityLinks:[...new Set(row.identityLinks)],documents:[...new Map([...row.documents,{title:'Sitzung / öffentliche Tagesordnung',url:row.sourceUrl,kind:'html'}].map(d=>[d.url,d])).values()]};
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Sitzungsdienst (councilservice) auf der Website der Kommune; nur Tagesordnungspunkte des öffentlichen Teils.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 const listed=meetings.size-upcoming;
 // Unchanged meetings are a successful reading: their reports are in the database already.
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:listed,...(upcoming?{upcomingWithoutAgenda:upcoming}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||beyond?{resumable:true}:{}),...(warnings.length?{warnings}:{}),sourceCount:1,quiet:listed===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.page}};
}
