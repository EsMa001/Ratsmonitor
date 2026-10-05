import {sourceDecision,DECIDING_BODY} from './source-fields.mjs';
import {windowStart} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text,MAX_MEETINGS} from './sessionnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
// Public interface of More! Rubin (more! software), read anonymously; only agenda items with the public status are taken.
// - api.php (gremien.info, KISA and the other installations of the single-page interface "Ratsinfosystem"): calendar
//   and meetings with their agenda as JSON.
// - Older installations answer api.php with HTTP 404. Their calendar comes in the same format from the mobile web
//   service; its meeting call answers empty, so the agenda is taken from the JSON that the public meeting page embeds
//   for its own display (window.components["MeetingPage__…"].props["passed-meeting"]).
// One installation may serve several bodies (a town and the Amt next door, a Verwaltungsverband and its members).
// source.bodies names the bodies (Koerperschaftsnummer) of the area; a meeting is read only if one of its committees
// belongs to one of them. Without source.bodies every body of the installation is read.
const WEBSERVICE='webservice-mobile/webservice.php';
const yes=v=>v===true||v===1||v==='1'||v==='true';
const slug=v=>String(v).replace(/[^\w-]+/g,'-').replace(/^-+|-+$/g,'');
const query=(page,params)=>page+'?'+new URLSearchParams({json:'true',...(page===WEBSERVICE?{system:'ris',platform:'ris'}:{}),...params});
/**
 * Address of a meeting page on the approved source. full_url may use http, be malformed ("http:///host/meeting?id=…",
 * "https://host//meeting.php?id=…") or name another host name of the same installation; only the page name and the
 * meeting number are taken from it, so a session parameter in the path (";jsessionid=…") is left behind. Another host name
 * shows a shared installation: it is followed only with source.bodies.
 */
export function rubinMeetingUrl(m,source){
 const raw=String(m.full_url||m.fullUrl||'');let u=null;try{u=new URL(raw);}catch{/* no address */}
 const page=u?.pathname.match(/\/(meeting(?:\.php)?)(?:;[^/]*)?$/i)?.[1]?.toLowerCase(),id=u?.searchParams.get('id');
 if(page&&id){
  if(u.hostname!==new URL(source.base).hostname&&!source.bodies?.length)throw Error(`Sitzungsadresse auf anderem Host (${u.hostname}): gemeinsames System, Körperschaft der Quelle nicht festgelegt`);
  return allowed(new URL(page+'?id='+encodeURIComponent(id),source.base).href,source);
 }
 if(u)return allowed(raw,source);
 if(!m.nummer)throw Error('Sitzung ohne Nummer');
 return allowed(source.base+'meeting?id='+encodeURIComponent(m.nummer),source);
}
// A document address on another host name or over http is moved to the approved source if it names one of the system's
// own scripts; any other foreign address is left out.
function documentUrl(url,source){
 try{return allowed(url,source);}catch{/* checked below */}
 try{const u=new URL(url),page=u.pathname.match(/\/((?:api|documents)\.php)$/)?.[1];if(page)return allowed(new URL(page+u.search,source.base).href,source);}catch{/* foreign host */}
 return null;
}
/**
 * The meeting a page of the older interface embeds for its own display; null if it embeds none. Only the MeetingPage
 * component is read (up to the next window.components entry); its props key may be written with or without quotes.
 */
export function embeddedMeeting(page){
 const all=String(page||''),at=all.search(/components\[["']MeetingPage__/);if(at<0)return null;
 const next=all.slice(at+1).search(/components\[["']/),html=next<0?all.slice(at):all.slice(at,at+1+next);
 const props=html.search(/["']?\bprops["']?\s*:/);if(props<0)return null;
 const start=html.indexOf('{',props);if(start<0)return null;
 let depth=0,quoted=false,escaped=false;
 for(let i=start;i<html.length;i++){
  const c=html[i];
  if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}
  else if(c==='"')quoted=true;else if(c==='{')depth++;
  else if(c==='}'&&!--depth){try{return JSON.parse(html.slice(start,i+1))['passed-meeting']||null;}catch{return null;}}
 }
 return null;
}
/** Bodies of an installation as [{id,name}]. Throws if the list cannot be read: a failed answer is never "one body". */
export async function readRubinBodies(source,{get=fetchText,endpoint=source.endpoint}={}){
 for(const page of endpoint==='webservice'?[WEBSERVICE]:endpoint==='api'?['api.php']:['api.php',WEBSERVICE]){
  let body;
  try{body=await get(source.base+query(page,{id:'organizations',action:'bodies'}),source);}
  catch(e){if(page==='api.php'&&!endpoint&&/HTTP 404/.test(e.message))continue;throw e;}
  let list;try{list=JSON.parse(body);}catch{throw Error('Körperschaftsliste ist kein JSON');}
  if(!Array.isArray(list)||!list.length||list.some(b=>!b||typeof b!=='object'||b.ErrorCode||!b.id||!b.name))throw Error('Unbekanntes Format der Körperschaftsliste');
  return list.map(b=>({id:String(b.id),name:String(b.name)}));
 }
}
// Kind of a body or area before its name, officeholders and parts after it: "Gemeinde Lanze Die Bürgermeisterin",
// "Amt Lütau Der Amtsvorsteher", "Landratsamt Nordhausen Kreistagsbüro", "Stadt Bacharach Ortsteil Steeg".
const KIND=/^(Stadtverwaltung|Gemeindeverwaltung|Verbandsgemeindeverwaltung|Verbandsgemeinde|Samtgemeindeverwaltung|Samtgemeinde|Ortsgemeinde|Marktgemeinde|Gemeinde|Markt|Große Kreisstadt|Hansestadt|Kreisstadt|Stadt|Amtsverwaltung|Amt|Verwaltungsgemeinschaft|Verwaltungsverband|Landratsamt|Landkreis|Kreisverwaltung|Kreis|Regionalverband|Region|Städteregion)\s+/i;
const DISTRICT=/^(?:Landratsamt|Landkreis|Kreisverwaltung|Kreis|Regionalverband|Region|Städteregion)\s|kreistag|landrat|landrät/i;
// The kinds of an association of municipalities, with the catalog type (municipalityType) of the area they name.
const ASSOCIATION={verbandsgemeinde:'Verbandsgemeinde',verbandsgemeindeverwaltung:'Verbandsgemeinde',samtgemeinde:'Samtgemeinde',samtgemeindeverwaltung:'Samtgemeinde',amt:'Amt',amtsverwaltung:'Amt',verwaltungsgemeinschaft:'Verwaltungsgemeinschaft',verwaltungsverband:'Verwaltungsverband'};
const OFFICE=/\s+(?:(?:der|die)\s+)?(?:\S*bürgermeister(?:in)?|\S*vorsteher(?:in)?|landrat|landrätin|kreistagsbüro)(?=\s|$).*$/i;
const PART=/\s+(?:Ortsteil|Ortsbezirk|Stadtteil|Ortschaft)\s+.*$/i;
const norm=s=>s.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').normalize('NFKD').replace(/[^a-z0-9]/g,'');
// "Hörnum (Sylt)", "Weiler bei Bingen", "Niederhausen an der Appel" and "Niederhausen/Appel", "Dillingen a.d.Donau":
// a name splits into its core and its addition; the addition loses its preposition, so "/Appel" is "an der Appel".
const ADDITION=[/\s*\((.*?)\)/g,/\s*\/\s*(.+)$/,/\s+(?:an der|am|im|in der|in|bei|vor der|ob der|unter|über|auf der|auf dem|auf)\s+(.+)$/i,/\s+(?:[a-zäöü]{1,3}\.\s?){1,2}(\S.*)$/i];
const place=s=>{const extra=[];let n=String(s||'').replace(/\bSt\.\s*/g,'Sankt ').replace(/\s+/g,' ').trim();for(const re of ADDITION)n=n.replace(re,(_,x)=>{extra.push(norm(x));return '';});return {core:norm(n),extra:extra.join('')};};
// 'exact': the same core with the same addition or none on either side; 'loose': only one side names an addition
// ("Weiler" and "Weiler bei Bingen"). Two different additions are two places ("Neustadt a.d.Aisch", "Neustadt b.Coburg").
const same=(a,b)=>!a.core||a.core!==b.core?null:a.extra===b.extra?'exact':a.extra&&b.extra?null:'loose';
/**
 * Ids of the bodies that belong to an area (CATALOG entry: name, shortName, kind, municipalityType, members). The body's
 * name without its kind and without officeholder or part must equal a name of the area; equality, not containment:
 * "Stadt Wittlich" is not "Verbandsgemeinde Wittlich-Land". The kind decides which names count:
 * - a district body (Landratsamt, Landkreis, Kreistag …, or a name ending in "kreis"): the district's own name;
 * - an association (Verbandsgemeinde, Samtgemeinde, Amt, Verwaltungsgemeinschaft, Verwaltungsverband): the area's own
 *   name, and only if the area is an association of that type;
 * - a town or municipality (Stadt, Gemeinde, Markt, Stadtverwaltung …): the members of an association area, otherwise the
 *   area's own name. "Stadt Bad Kreuznach" is not "Verbandsgemeinde Bad Kreuznach", whose members do not include the town;
 * - an Ortsgemeinde: only ever a member of a Verbandsgemeinde, never a town of its own ("Ortsgemeinde Roth" of the
 *   Verbandsgemeinde Aar-Einrich is not the Bavarian Stadt Roth).
 * A body without one of these kinds (Zweckverband, Schulverband, a bare place name) cannot be told apart from a town or
 * association of the same name and belongs to none. A name that equals only with an addition on one side ("Stadt Kirchberg"
 * for "Kirchberg an der Jagst") counts only if another body of the list equals a name of the area exactly.
 * Member names repeat across the country ("Gemeinde Basedow" of the Amt Lütau and of the Amt Malchin), so the members of
 * an association count only next to the association's own body; a list without any association body counts through the
 * body of the seat, the member that bears the area's name ("Stadtverwaltung Dommitzsch" for the Verwaltungsgemeinschaft
 * Dommitzsch). Any other list belongs to another association: [].
 */
export function rubinBodyMatch(bodies,area){
 const own=[area?.shortName,String(area?.name||'').replace(KIND,'')].filter(Boolean).map(place),members=(area?.members||[]).map(m=>place(m?.name));
 const district=area?.kind==='district',association=!district&&members.length>0,type=area?.municipalityType;
 const seat=members.filter(m=>own.some(o=>same(m,o)==='exact'));
 let associations=0,ownAssociation=false,ownSeat=false;
 const found=(Array.isArray(bodies)?bodies:[]).flatMap(b=>{
  // "Nationalparkverbandsgemeinde Herrstein-Rhaunen" is a Verbandsgemeinde by its official name.
  const name=String(b?.name||'').replace(/\s+/g,' ').trim().replace(/^Nationalpark-?verbandsgemeinde(?=\s)/i,'Verbandsgemeinde');if(!b?.id||!name)return [];
  const kind=name.match(KIND)?.[1].toLowerCase(),core=name.replace(OFFICE,'').replace(PART,'').replace(KIND,''),at=place(core);
  const level=DISTRICT.test(name)||!kind&&/kreis$/i.test(core)?'district':ASSOCIATION[kind]?'association':kind?'municipal':null;
  const member=level==='municipal'&&association&&(kind!=='ortsgemeinde'||type==='Verbandsgemeinde');
  const names=level==='district'?(district?own:[]):district?[]:level==='association'?(ASSOCIATION[kind]===type?own:[]):member?members:level==='municipal'&&!association&&kind!=='ortsgemeinde'?own:[];
  const result=names.map(n=>same(at,n));
  if(level==='association'){associations++;if(result.some(Boolean))ownAssociation=true;}
  if(member&&seat.some(s=>same(at,s)==='exact'))ownSeat=true;
  return result.includes('exact')?[{id:String(b.id),exact:true}]:result.includes('loose')?[{id:String(b.id),exact:false}]:[];
 });
 if(association&&!ownAssociation&&(associations>0||!ownSeat))return [];
 return found.some(f=>f.exact)?found.map(f=>f.id):[];
}
/**
 * More! Rubin recognised from an address and its page, without a request; null if neither shows it.
 * Returns {adapter:'more-rubin', method:'official-api', base, endpoint, evidence}:
 * - evidence 'host': the vendor's hosting (<name>.gremien.info except www, ris-*.zv-kisa.de);
 * - 'markup': a page of the older interface (meta author "more! software", or the embedded window.components of
 *   /includes/js/dist/ or the mobile web service); endpoint 'webservice';
 * - 'shell': the empty single-page "Ratsinfosystem" (/components/index-*.js, div#app). It names no vendor: confirm with
 *   readRubinBodies before use.
 * A page that only links to a More! Rubin system is not that system.
 */
export function detectRubin(url,html=''){
 let u;try{u=new URL(url);}catch{return null;}
 const page=String(html||''),host=u.hostname.toLowerCase();
 // The installation's directory: where its own scripts lie (an absolute "/components/…" means the root).
 const script=page.match(/<script\b[^>]*\bsrc=["']([^"']*?)(?:includes\/js\/dist|components)\/[^"']*\.js["']/i)?.[1];
 const base=fallback=>{let b=new URL(script===undefined?fallback:script||'./',u.origin+u.pathname);if(b.hostname!==u.hostname)b=new URL('/',u.origin);b.protocol='https:';b.search='';b.hash='';return b.href;};
 const result=(evidence,endpoint,fallback)=>({adapter:'more-rubin',method:'official-api',base:base(fallback),endpoint,evidence});
 // gremien.info and www.gremien.info are the vendor's own website, not the system of an area.
 if(/^(?!www\.)(?:[\w-]+\.)+gremien\.info$/.test(host)||/^ris-[\w-]+\.zv-kisa\.de$/.test(host))return {...result('host','api','/'),base:'https://'+host+'/'};
 const shell=/<title>\s*Ratsinfosystem\s*<\/title>/i.test(page)&&/src=["'][^"']*\/components\/index-[\w-]+\.js["']/i.test(page)&&/<div id=["']app["']/i.test(page);
 if(shell)return result('shell','api','/');
 const markup=/<meta\b[^>]*content=["']more! software["']/i.test(page)||/window\.components\[["']\w+Page__\w+["']\]/.test(page)&&(/includes\/js\/dist\//.test(page)||/webservice-mobile\//.test(page));
 if(markup)return result('markup','webservice',/\.php$/i.test(u.pathname)?'./':'/');
 return null;
}
export function mapRubinMeeting(m,source,now=new Date(),url=rubinMeetingUrl(m,source)){
 if(yes(m.is_draft)||yes(m.fraktionssitzung))return [];
 const committee=(m.committees||[]).map(c=>c.name).filter(Boolean).join(', ')||m.titel,today=now.toISOString().slice(0,10),authority=new URL(source.base).origin;
 return (m.agenda_items||[]).filter(a=>Number(a.status)===1&&!yes(a.is_draft)&&a.title).map(a=>{
  const documents=(a.documents||[]).filter(d=>Number(d.documentPublicStatusId)===1&&!yes(d.is_draft)&&d.documentUrl).map(d=>({title:d.documentName||d.name||'Originalunterlage',url:documentUrl(d.documentUrl,source),kind:d.documentExtension==='pdf'?'application/pdf':'document'})).filter(d=>d.url);
  const result=text(a.abstimmungstext||''),ahead=m.datum>today;let status=ahead?'consulting':'unknown';
  if(/kenntnis|information/i.test(a.counselling_status?.name||''))status=ahead?'announced':'info';
  if(ahead){/* no result before the meeting */}
  else if(/vertagt|zurückgestellt/i.test(result))status='postponed';
  else if(/angenommen|beschlossen|zugestimmt|abgelehnt/i.test(result))status=DECIDING_BODY.test(committee)?(/abgelehnt/i.test(result)?'rejected':'approved'):'recommended';
  // Older installations publish no ai_id. Their item id names the meeting, whose number gains "ni_" with the minutes.
  const item=a.ai_id!=null&&a.ai_id!==''?String(a.ai_id):slug(String(a.id||[m.nummer,a.vorlagennummer,a.topnummer].join('|')).replace(/^ni_/,''));
  // A paper is an item of the kind "vl". Standard items carry short numbers too ("1" for the opening in every meeting).
  const paper=/^\d+$/.test(a.vorlagennummer)&&(a.topart?a.topart==='vl':String(a.vorlagennummer).length>=6),id=paper?source.id+'-vo-'+a.vorlagennummer:source.id+'-top-'+item;
  const event={date:m.datum,committee,status,description:result||'Öffentlicher Tagesordnungspunkt; ein Beschlussergebnis ist im erfassten Text nicht belegt.',result,url,attendance:{status:'not_collected',sourceUrl:url,fetchedAt:now.toISOString(),people:[]}};event.decision=sourceDecision(event);
  return {id,regionId:source.id,source:source.kind,public:true,title:text(a.title),officialTitle:text(a.title),status,category:category(a.title),committee,eventDate:m.datum,updatedAt:now.toISOString(),reference:(a.documents||[]).find(d=>d.alias)?.alias||a.submission?.alias||'',documents:[...documents,{title:'Öffentliche Sitzung',url,kind:'html'}],events:[event],sourceData:{version:'public-source-fields-v1',method:'official-api',fetchedAt:now.toISOString(),records:[{kind:'agenda',url,fields:{id:item,reference:a.vorlagennummer,title:text(a.title),result,consultationStatus:a.counselling_status?.name||'',committees:(m.committees||[]).map(c=>({id:c.id,name:c.name}))}}]},sourceUrl:url,identityRecords:[{authority,kind:'agenda',id:item},...(paper?[{authority,kind:'paper',id:String(a.vorlagennummer)}]:[])],relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:text(a.title)+'\n'+result};
 });
}
// source.bodies: ids of the area's bodies (see rubinBodyMatch). source.endpoint 'webservice': ask the mobile web service
// first; without it api.php is asked first and the other one after an HTTP 404.
// marks (optional): what earlier imports read completely, see meeting-marks.mjs.
export async function collectRubin(source,{now=new Date(),get=fetchText,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 const from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10),next=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1));
 const bodies=(Array.isArray(source.bodies)?source.bodies:[]).map(String).filter(Boolean);
 const issues=[],grouped=new Map(),held={},owner=new Map(),seen=new Set();
 let page=source.endpoint==='webservice'?WEBSERVICE:'api.php';
 const api=async params=>JSON.parse(await get(source.base+query(page,params),source));
 // One body: the calendar is asked for that body only. Several: each meeting is checked below.
 const range={id:'calendar',action:'get',from:fromDay.slice(0,7),to:next.toISOString().slice(0,7),view:'list',body_id:bodies.length===1?bodies[0]:''};
 let calendar;
 try{calendar=await api(range);}catch(e){if(!/HTTP 404/.test(e.message))throw e;page=page===WEBSERVICE?'api.php':WEBSERVICE;calendar=await api(range);}
 if(!Array.isArray(calendar?.meetings))throw Error('Unbekanntes Kalenderformat der öffentlichen Schnittstelle');
 const listed=[];
 for(const m of calendar.meetings){
  if(!(m.datum>=fromDay)||yes(m.is_draft)||yes(m.fraktionssitzung)||/^\s*(?:abgesagt|entf(?:ä|ae)llt)\b/i.test(m.titel||''))continue;
  try{listed.push({url:rubinMeetingUrl(m,source),date:m.datum,nummer:m.nummer,codes:[1,2,3,4,5].map(i=>m['gremium_'+i]).filter(Boolean).map(String)});}
  catch(e){issues.push((m.full_url||m.fullUrl||m.nummer)+': '+e.message);}
 }
 let count=0,fetched=0,beyond=0,unread=0,unchanged=0,done=0,other=0,unknown=0,ours=0,empty=0;
 await parallel(listed.sort((a,b)=>b.date.localeCompare(a.date)),async m=>{
  // Several bodies: a meeting whose committees all belong to another body (learnt from meetings read before) is not asked for.
  if(bodies.length>1&&m.codes.length&&m.codes.every(c=>owner.has(c)&&!bodies.includes(owner.get(c)))){other++;return;}
  const known=usableMark(marks,m,now);
  // Read completely a moment ago: an import that ran out of time continues behind it without asking again.
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;return;}
  if(fetched>=MAX_MEETINGS){beyond++;return;}fetched++;
  try{
   const d=page===WEBSERVICE?embeddedMeeting(await get(m.url,source)):await api({id:'meetings',action:'get',meeting_id:m.nummer,with_agenda_item_documents:'true'});
   if(!Array.isArray(d?.agenda_items))throw Error('Keine öffentliche Tagesordnung verfügbar');
   const own=[];for(const c of d.committees||[]){const body=String(c.Koerperschaftsnummer||'');if(!body)continue;own.push(body);seen.add(body);if(c.id||c.Kuerzel)owner.set(String(c.id||c.Kuerzel),body);}
   // A meeting of another body is not taken; nor one whose body is not named, which is reported below.
   if(bodies.length&&!own.length){unknown++;return;}
   if(bodies.length&&!own.some(b=>bodies.includes(b))){other++;return;}
   ours++;
   const items=mapRubinMeeting({...d,datum:d.datum||m.date},source,now,m.url);if(!items.length)empty++;
   const print=(await hash(JSON.stringify(items.map(t=>[t.id,t.title,t.status,t.reference,t.events[0].result,t.documents.map(x=>x.url)])))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;return;}
   for(const t of items){const old=grouped.get(t.id);if(old){old.events.push(...t.events);old.documents.push(...t.documents);old.identityRecords.push(...t.identityRecords);}else grouped.set(t.id,t);}
   held[m.url]=newMark(m,print,now,items.length);done++;
  }catch(e){if(/Zeitbudget/.test(e.message))unread++;else issues.push(m.url+': '+e.message);}
  onProgress(source.id+': '+(++count)+'/'+listed.length+' Sitzungen');
 },2);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(beyond)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 // With a body filter, meetings that cannot be assigned, or only meetings of other bodies while the configured ones are
 // never named, point to a missing field or to wrong body numbers: reported, not shown as a quiet area.
 if(unknown)issues.push(`Körperschaft der Sitzungen unbekannt: ${unknown} ${unknown===1?'Sitzung nennt':'Sitzungen nennen'} keine Körperschaftsnummer und ${unknown===1?'wurde':'wurden'} nicht übernommen.`);
 else if(other&&!ours&&!unchanged&&!bodies.some(b=>seen.has(b)))issues.push(`Körperschaft der Quelle (${bodies.join(', ')}) in keiner Sitzung genannt; gelesene Sitzungen gehören zu ${[...seen].sort().join(', ')}. Körperschaftsnummern prüfen.`);
 const topics=[];
 for(const t of grouped.values()){
  t.events.sort((a,b)=>a.date.localeCompare(b.date));const last=t.events.at(-1);Object.assign(t,{status:last.status,eventDate:last.date,committee:last.committee});t.documents=[...new Map(t.documents.map(d=>[d.url,d])).values()];
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name.replace(/^(Stadt|Gemeinde) /,''));
  t.quality={passed:false,checks:[{name:'Öffentliche Schnittstelle',passed:true,detail:'Anonymer Lesezugriff; öffentliche Tagesordnungspunkte.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Quellenüberblick ohne abgeschlossene Qualitätsevaluation.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText+JSON.stringify(t.events))};topics.push(t);
 }
 const meetings=listed.length-other-unknown;
 // Unchanged meetings are a successful reading: their reports are in the database already.
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'official-api',from:fromDay,to:today,importedAt:now.toISOString(),meetings,...(other?{otherBodyMeetings:other}:{}),...(unknown?{unknownBodyMeetings:unknown}:{}),...(empty?{meetingsWithoutPublicItems:empty}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||beyond?{resumable:true}:{}),...(seen.size?{seenBodies:[...seen].sort()}:{}),...(page===WEBSERVICE?{endpoint:'webservice'}:{}),sourceCount:1,quiet:meetings===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged||!meetings?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
