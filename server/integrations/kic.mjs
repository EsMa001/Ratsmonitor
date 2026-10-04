import {sourceDecision} from './source-fields.mjs';
import {windowStart} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,MAX_MEETINGS} from './sessionnet.mjs';
import {resultStatus} from './sdnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
// Public guest access of the KIC council information system (kiC RIS, React app such as ris.aschaffenburg.de/app/).
// The page is an empty shell; the app reads /<version>/webconfig.json (serviceUrl, org_key) and then asks the JSON
// interface named there, sending the headers x-orgkey (org_key), x-uniqueid (host name of the app, plus "/<name>"
// when the app runs below a path) and x-customname. The reader sends the same guest requests the app sends for every
// visitor and nothing that needs a login:
// - web/guestmeetings?from&until (optionally client=<id> on systems shared by several municipalities),
// - web/guestmeetings/<id>: the agenda as parts; the guest view leaves out the non-public part or marks it
//   (protectedpart, restricted). Only items of a part flagged public that are flagged unrestricted themselves are
//   taken; a part or item without such a flag is left out and named as an issue (fail closed).
// - web/guestagendaitems/<id>: consultation sequence (conorderitems), votes (votings) and documents of one item.
// Links point to the pages of the app (app/sitzungen/…, app/download?url=…), which open for every visitor.
// The catalog entry names the app (base) and its interface (api); both are the only hosts asked.
const day=value=>String(value||'').slice(0,10);
// The interface sends plain text, not HTML: only white space is tidied ("Lärm <55 dB" stays as it is).
const plain=value=>String(value??'').replace(/\s+/g,' ').trim();
// Flags of the guest view count only with an explicit value; a missing or unknown flag is neither yes nor no.
const yes=value=>value===true||value==='true',no=value=>value===false||value==='false';
// restricted of an item or consultation: false, or "ö" (öffentlich) as the consultation sequence writes it.
const unrestricted=value=>no(value)||value==='ö';
const number=value=>/^\d+$/.test(String(value??'').trim())?Number(value):null;
// The app appends the role of the consultation to the title of an item: "Satzung … (Beschließend)".
const plainTitle=name=>plain(name).replace(/\s*\((?:beschließend|vorberatend|beratend|zur kenntnisnahme|kenntnisnahme)\)$/i,'');
/**
 * The page of a KIC system: the empty React shell titled "Ratsinformationssystem" that loads
 * /<version>/static/js/index-*.js. null for any other page (another Vite/React app, a CMS page that links the system).
 * base: address of the app (with the path name of a system that runs below a path); client: from ?clientid=.
 */
export function kicShell(url,html){
 const page=String(html||''),version=page.match(/<script\b[^>]*\bsrc=["']\/([\w.-]+)\/static\/js\/index-[\w-]+\.js["']/i)?.[1];
 if(!version||!/<div\s+id=["']root["'][^>]*>\s*<\/div>/i.test(page)||!/<title>\s*Ratsinformationssystem\s*<\/title>/i.test(page))return null;
 let u,first='';try{u=new URL(url);}catch{return null;}
 try{first=decodeURIComponent(u.pathname.split('/')[1].split(';')[0]);}catch{}
 // Same rule as the app: the first path segment names the system unless it is one of the app's own routes. A session
 // suffix (;jsessionid=…) is cut off; a file (index.html), an old link (Meeting.mvc) or a broken escape names nothing.
 const name=/^[\w-]+$/.test(first)&&!/^(app|activateuser|error|feed|login)$/i.test(first)?first:'';
 const client=[...u.searchParams].find(([k])=>k.toLowerCase()==='clientid')?.[1];
 return {base:`https://${u.host}/${name?name+'/':''}`,version,uniqueId:u.hostname+(name?'/'+name:''),customName:name,...(/^\d+$/.test(client||'')?{client:Number(client)}:{})};
}
/** webconfig.json of the app → {api, orgKey}. */
export function kicConfig(json){
 const c=typeof json==='string'?JSON.parse(json):json;let api;
 try{api=new URL(c.serviceUrl);}catch{throw Error('webconfig.json ohne Schnittstellenadresse');}
 if(api.protocol!=='https:'||api.username||api.password||!c.org_key)throw Error('webconfig.json ohne nutzbare Schnittstelle');
 return {api:api.origin+api.pathname.replace(/\/*$/,'/'),orgKey:String(c.org_key)};
}
/** Headers the app sends with every request of a guest. */
export const kicHeaders=({orgKey,uniqueId,customName=''})=>({'x-orgkey':orgKey,'x-uniqueid':uniqueId,'x-customname':customName,Accept:'application/json'});
/** One page of the app for a reader of the report: meeting, agenda item, or the app's download page of a document. */
export const kicLink=(source,path)=>allowed(source.base+path,source);
export const kicDocumentUrl=(source,document)=>kicLink(source,'app/download?'+new URLSearchParams({url:'web/guestagendaitems/documents/'+document.id,fileName:(document.name||'Dokument')+(document.fileext||'')}).toString().replace(/\+/g,'%20'));
/**
 * Meetings of the list (web/guestmeetings). Cancelled meetings (state 3) and meetings that have a non-public part
 * only (visibility 2) are left out, also when the numbers come as strings. visibility 0: no agenda published yet.
 */
export function kicMeetings(json,source){
 const list=typeof json==='string'?JSON.parse(json):json;
 if(!Array.isArray(list?.items))throw Error('Unbekanntes Format der Sitzungsliste');
 const known=list.items.filter(m=>m&&/^\d+$/.test(String(m.id))&&/^\d{4}-\d{2}-\d{2}/.test(m.meetingdate||''));
 // Entries of which none has an id and a date: another format, not a period without meetings.
 if(list.items.length&&!known.length)throw Error('Unbekanntes Format der Sitzungsliste');
 return known.filter(m=>number(m.state)!==3&&number(m.visibility)!==2).map(m=>({id:String(m.id),url:kicLink(source,'app/sitzungen/'+m.id),date:day(m.meetingdate),name:plain(m.name),committee:plain(m.committeename),client:plain(m.clientname),visibility:number(m.visibility)}));
}
/**
 * Public agenda items of one meeting (web/guestmeetings/<id>); null if the guest view shows no agenda at all.
 * Fail closed: an item is taken only if its part says protectedpart false and the item says restricted false.
 * Parts and items marked as protected/restricted are skipped, whatever they are called; items whose flags are missing
 * or unknown are skipped as well and counted in unclear, so that the collector names them.
 */
export function parseKicMeeting(json,meeting={}){
 const m=typeof json==='string'?JSON.parse(json):json;
 if(!Array.isArray(m?.parts))throw Error('Unbekanntes Format der Sitzung');
 if(!m.parts.some(p=>Array.isArray(p?.agendaitems)&&p.agendaitems.length))return null;
 const date=day(m.meetingdate)||meeting.date,committee=[m.committeename,m.committeename2,m.committeename3].map(plain).filter(Boolean).join(', ')||meeting.committee||meeting.name||'Öffentliche Sitzung';
 const items=[];let unclear=0;
 for(const part of m.parts){
  if(!part||yes(part.protectedpart))continue;
  for(const a of Array.isArray(part.agendaitems)?part.agendaitems:[]){
   const title=plainTitle(a?.name);if(!title||yes(a.restricted)||!/^\d+-\d+$/.test(String(a.id)))continue;
   if(!no(part.protectedpart)||!unrestricted(a.restricted)){unclear++;continue;}
   items.push({key:String(a.id),number:plain(a.numbering),title,documents:Number(a.documentcount)||0,downloads:yes(a.downloadallowed),globalId:plain(a.globalid)});
  }
 }
 return {date,committee,items,unclear,changed:[m.state,m.op,m.opdatetime,m.snapdatetime].join('|')};
}
/** Published votes of one item, worded as the app shows them. */
export function kicResult(votings){
 return (Array.isArray(votings)?votings:[]).map(v=>{
  switch(v?.votingkind){
   case 0:return [['Ja',v.resultyes],['Nein',v.resultno],['Enthaltungen',v.resultnone]].filter(([,n])=>n!==null&&n!==undefined).map(([k,n])=>k+': '+n).join(', ');
   case 1:return 'Mehrheitlich angenommen';case 2:return 'Mehrheitlich abgelehnt';case 3:return 'Einstimmig angenommen';case 4:return 'Einstimmig abgelehnt';default:return '';
  }
 }).filter(Boolean).join('; ');
}
/**
 * One agenda item (web/guestagendaitems/<id>): consultation sequence, result and the documents open to guests.
 * Throws unless the item itself is flagged unrestricted, so that a restricted item adds neither documents nor votes.
 * Documents are linked only when texts and downloads are released and the document is flagged visible to guests.
 */
export function parseKicItem(json,source){
 const a=typeof json==='string'?JSON.parse(json):json;
 if(!a||typeof a!=='object'||String(a.id||'')==='')throw Error('Unbekanntes Format des Tagesordnungspunkts');
 if(!unrestricted(a.restricted))throw Error('Tagesordnungspunkt im Gastzugang nicht als öffentlich gekennzeichnet');
 const consultations=(Array.isArray(a.conorderitems)?a.conorderitems:[]).filter(c=>/^\d+-\d+$/.test(String(c?.agendaitemid))).map(c=>({key:String(c.agendaitemid),meeting:String(c.meetingid),date:day(c.meetingdate),committee:plain(c.committeename),number:plain(c.numbering),public:unrestricted(c.restricted),role:plain(c.conordertypename)}));
 const documents=[];
 if(yes(a.textsanddocsvisible)&&yes(a.downloadallowed))for(const d of Array.isArray(a.documents)?a.documents:[]){
  if(!d?.id||yes(d.isprotected)||!yes(d.guestvisible))continue;
  documents.push({title:plain(d.name)||'Originalunterlage',url:kicDocumentUrl(source,d),kind:/^\.?pdf$/i.test(d.fileext||'')?'application/pdf':'document'});
 }
 return {role:plain(a.conordertype),consultations,result:kicResult(a.votings),documents};
}
// marks (optional): what earlier imports read completely, see meeting-marks.mjs.
// request: fetch for the requests to the interface; the headers of the app are added to it.
export async function collectKic(source,{now=new Date(),get=fetchText,request=fetch,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 const from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10),issues=[],warnings=[],meetings=new Map();
 const until=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+2,0));
 if(!source.api)throw Error('Katalogeintrag ohne Schnittstellenadresse (api)');
 const root=String(source.api).replace(/\/*$/,'/'),api={...source,base:root},site={...source,base:new URL(source.base).origin+'/'};
 // 1. The app and its configuration. The interface it names has to be the one of the catalog entry.
 let headers;
 try{
  const shell=kicShell(source.base,await get(source.base,source));if(!shell)throw Error('Seite ist keine KIC-Anwendung (mehr)');
  const config=kicConfig(await get(allowed(site.base+shell.version+'/webconfig.json',site),site));
  if(config.api!==root)throw Error(`Anwendung nennt eine andere Schnittstelle (${config.api}); Katalogeintrag prüfen`);
  headers=kicHeaders({...config,uniqueId:shell.uniqueId,customName:shell.customName});
 }catch(e){issues.push('Anwendung: '+e.message);}
 const send=(url,init={})=>request(url,{...init,headers:{...init.headers,...headers}});
 const read=async url=>JSON.parse(await get(allowed(url,api),api,undefined,send));
 // 2. Meeting list, in steps of three months up to the end of next month.
 if(headers)for(let start=new Date(Date.UTC(from.getUTCFullYear(),from.getUTCMonth(),from.getUTCDate()));start<=until;){
  const end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+3,start.getUTCDate()-1)),stop=end<until?end:until;
  const query=new URLSearchParams({...(source.client?{client:String(source.client)}:{}),from:start.toISOString().slice(0,10),until:stop.toISOString().slice(0,10)});
  try{for(const m of kicMeetings(await read(root+'web/guestmeetings?'+query),source))if(m.date>=fromDay)meetings.set(m.id,m);}
  catch(e){issues.push(`Sitzungsliste ${query.get('from')} bis ${query.get('until')}: ${e.message}`);break;}
  start=new Date(stop.getTime()+86400000);
 }
 const grouped=new Map(),held={};let count=0,unchanged=0,done=0,unread=0,upcoming=0,fetched=0,beyond=0;
 const ordered=[...meetings.values()].sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date));
 // 3. Agenda of each meeting, then each public item. A meeting that has published nothing yet is not asked.
 await parallel(ordered,async m=>{
  if(m.visibility===0&&m.date>today){upcoming++;return;}
  const known=usableMark(marks,m,now);
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;count++;return;}
  if(fetched>=MAX_MEETINGS){beyond++;return;}fetched++;
  try{
   const agenda=parseKicMeeting(await read(root+'web/guestmeetings/'+m.id),m);
   // Items whose release to guests cannot be told are left out and named; their meeting is read again next time.
   if(agenda?.unclear)issues.push(`${m.url}: ${agenda.unclear} ${agenda.unclear===1?'Tagesordnungspunkt':'Tagesordnungspunkte'} ohne erkennbare Freigabe für Gäste ausgelassen`);
   // A meeting without agenda items in the guest view: still ahead, or published without them (date and documents only).
   if(!agenda?.items.length){if(!agenda?.unclear){if(m.date>today)upcoming++;else warnings.push('Sitzung ohne öffentlich einsehbare Tagesordnung: '+m.url);}return;}
   const print=(await hash(JSON.stringify([agenda.changed,agenda.items.map(i=>[i.key,i.title,i.number,i.documents,i.globalId])]))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;count++;return;}
   let cut=false,complete=!agenda.unclear;
   for(const item of agenda.items){
    const own=kicLink(source,`app/sitzungen/${m.id}/${item.key}`);let detail;
    // The identity of an item comes from its consultation sequence, so an item whose page is unreadable is left for later.
    try{detail=parseKicItem(await read(root+'web/guestagendaitems/'+encodeURIComponent(item.key)),source);}
    catch(e){complete=false;if(/Zeitbudget/.test(e.message))cut=true;else issues.push('Tagesordnungspunkt '+own+': '+e.message);continue;}
    // Consultations of one matter in several meetings share the first entry of the sequence: it is the identity of the
    // matter. An item whose sequence is hidden from guests counts as its own first consultation, so its id stays the
    // same when the sequence is shown later.
    const first=detail.consultations[0]||{key:item.key},lead=detail.consultations.find(c=>c.public)||detail.consultations[0];
    const sourceUrl=lead?kicLink(source,`app/sitzungen/${lead.meeting}/${lead.key}`):own;
    const result=agenda.date>today?'':detail.result;
    const status=agenda.date>today?(detail.consultations.length?'consulting':'announced'):resultStatus(result,agenda.committee)||'unknown';
    const description=agenda.date>today?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':result?'Abstimmungsergebnis: '+result:'Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Abschnitt nicht belegt.';
    const event={date:agenda.date,committee:agenda.committee,status,description,result,url:m.url,publicEvidence:'Öffentlicher Teil der Tagesordnung im Gastzugang',attendance:{status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]}};event.decision=sourceDecision(event);
    const row={id:`${source.id}-vo-${first.key}`,title:item.title,reference:'',sourceUrl,identityLinks:[...new Set([sourceUrl,own])],status,documents:item.downloads?detail.documents:[],
     sourceData:{version:'public-source-fields-v1',method:'kic',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:{number:item.number,title:item.title,role:detail.role,result,...(item.globalId?{globalId:item.globalId}:{})}},{kind:'agenda-item',url:own,fields:{consultations:detail.consultations.map(c=>({date:c.date,committee:c.committee,number:c.number,role:c.role,public:c.public}))}}],detailStatus:'completed',issues:[]}};
    const previous=grouped.get(row.id);if(previous){previous.events.push(event);previous.documents.push(...row.documents);previous.identityLinks.push(...row.identityLinks);}else grouped.set(row.id,{...row,events:[event]});
   }
   // A meeting counts as read only if every item behind it could be read.
   if(cut)unread++;else if(complete){held[m.url]=newMark({...m,date:agenda.date},print,now,agenda.items.length);done++;}
  }catch(e){if(/Zeitbudget/.test(e.message))unread++;else issues.push(m.url+': '+e.message);}
  count++;onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
 },2);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(beyond)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),identityLinks:[...new Set(row.identityLinks)],documents:[...new Map([...row.documents,{title:'Tagesordnungspunkt / öffentliche Sitzung',url:row.sourceUrl,kind:'html'}].map(d=>[d.url,d])).values()]};
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentlicher Gastzugang des KIC-Ratsinformationssystems; nur Tagesordnungspunkte des öffentlichen Teils.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 const listed=meetings.size-upcoming;
 // Unchanged meetings are a successful reading: their reports are in the database already.
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:listed,...(upcoming?{upcomingWithoutAgenda:upcoming}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||beyond?{resumable:true}:{}),...(warnings.length?{warnings}:{}),sourceCount:1,quiet:listed===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
/** Municipalities of a shared system (web/clients) → [{id, name}]; the id is the catalog entry's client. */
export const kicClients=json=>{const j=typeof json==='string'?JSON.parse(json):json;return (Array.isArray(j?.items)?j.items:[]).filter(c=>/^\d+$/.test(String(c?.id))&&plain(c?.name)).map(c=>({id:Number(c.id),name:plain(c.name)}));};
/**
 * Recognises a KIC system from a page and reads its configuration (one request: /<version>/webconfig.json on the
 * page's host). null if the page is not the KIC shell; an unreadable configuration throws.
 * Result: {base, api, client?, version, orgKey, uniqueId, customName}; base, api and client belong in the catalog entry.
 * clients: true also asks the interface for the municipalities of the system (second request) → clients:[{id,name}].
 */
export async function detectKic(url,html,{get=fetchText,request=fetch,clients=false}={}){
 const shell=kicShell(url,html);if(!shell)return null;
 const site={base:new URL(shell.base).origin+'/'};
 const found={...shell,...kicConfig(await get(allowed(site.base+shell.version+'/webconfig.json',site),site))};
 if(clients){const api={base:found.api},headers=kicHeaders(found);found.clients=kicClients(await get(allowed(found.api+'web/clients',api),api,undefined,(u,init={})=>request(u,{...init,headers:{...init.headers,...headers}})));}
 return found;
}
