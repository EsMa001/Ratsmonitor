import {sourceDecision,DECIDING_BODY} from './source-fields.mjs';
import {windowStart} from './history-window.mjs';
import {budgeted,paced,REFUSED} from './request-budget.mjs';
import {fetchText,allowed,text,decode,MAX_MEETINGS} from './sessionnet.mjs';
import {createSession} from './allris.mjs';
import {resultStatus} from './sdnet.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
// RIS of the City of Munich (risi.muenchen.de/risi), an own development on Apache Wicket behind an F5 firewall.
// - robots.txt disallows every address containing "jsessionid" for all programs. Wicket writes the session id into the
//   redirect of a session's first request and into the links of its first page. It is removed from every address before
//   anything is asked; the session is kept by its cookie alone. An address that still holds one is never asked.
// - Meetings come from the monthly calendar of the city council (sitzung/kalender/str). Another month is shown after a
//   click on it, which the page sends as a follow-up request in the same session (GET, no form data). The reader does
//   the same and nothing else of that kind. The RSS feeds name only the meetings of the next two weeks.
// - Of a meeting only the public agenda (sitzung/detail/<id>/tagesordnung/oeffentlich) is read, never the non-public
//   one; behind an item the page of its paper (Sitzungsvorlage) and its decision page (sitzung/top/<id>/entscheidung).
// - District committees (Bezirksausschüsse) are separate bodies. They are read only if the catalog entry says
//   districts:true, from their own calendar (sitzung/kalender/ba); the source names them "BA nn - …".
export const RISI_BASE='https://risi.muenchen.de/risi/';
const MONTHS=['januar','februar','märz','april','mai','juni','juli','august','september','oktober','november','dezember'];
const monthOf=label=>{const m=String(label).match(/([A-Za-zÄäÖöÜü]+)\s+(\d{4})/),i=m?MONTHS.indexOf(m[1].toLowerCase()):-1;return i<0?null:`${m[2]}-${String(i+1).padStart(2,'0')}`;};
const dayOf=label=>{const m=String(label).match(/(\d{1,2})\.\s*([A-Za-zÄäÖöÜü]+)\s+(\d{4})/),month=m&&monthOf(m[2]+' '+m[3]);return month?`${month}-${m[1].padStart(2,'0')}`:null;};
const shift=(month,n)=>{const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+n,1)).toISOString().slice(0,7);};
const german=date=>date.split('-').reverse().join('.');
const fnv=value=>{let h=0x811c9dc5;for(const c of new TextEncoder().encode(value)){h^=c;h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,'0');};
const anchors=html=>[...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(m=>({attributes:m[1],href:decode(m[1].match(/\bhref=["']([^"']*)["']/i)?.[1]||''),html:m[2]}));
const value=(html,key)=>text(html.match(new RegExp(`<div class=["']keyvalue-key["']>\\s*${key}:\\s*<\\/div>\\s*<div class=["']keyvalue-value[^"']*["']>([\\s\\S]*?)<\\/div>`,'i'))?.[1]||'');
// The plenary is called "Vollversammlung" by the source; as the city council it decides finally (DECIDING_BODY).
// Only a meeting of the city council's calendar (kind "str") is renamed: a district committee's "Vollversammlung" is not
// the city council, and a meeting of unknown kind is not taken for it.
const bodyName=(name,kind)=>kind==='str'&&/^Vollversammlung$/i.test(name)?'Stadtrat (Vollversammlung)':name;
export const SESSION_ID='Adresse mit Sitzungskennung (jsessionid); laut robots.txt ausgeschlossen, nicht abgerufen.';
const GATE='Quelle verlangt eine Zugriffsprüfung gegen automatisierte Abrufe; sie wird nicht umgangen. Abruf beendet.';
export const withoutSessionId=address=>String(address).replace(/;jsessionid=[^?#/"'&\s<>]*/gi,'');
/**
 * Request functions for fetchText (see createSession in allris.mjs) that keep the session by cookie: an address with a
 * session id or of the members' area (extranet) is refused, and a redirect that names the session id in its target is
 * passed on without it.
 */
export function createRisiSession(request=fetch){
 const session=createSession(async(url,init)=>{if(/jsessionid/i.test(url))throw Error(SESSION_ID);if(/^\/risi\/extranet\//i.test(new URL(url).pathname))throw Error('Anmeldebereich wird nicht abgerufen');return request(url,init);});
 const clean=send=>async(url,init)=>{const r=await send(url,init),location=r.headers.get('location');if(!location||!/jsessionid/i.test(location))return r;await r.body?.cancel();return new Response(null,{status:r.status,headers:{location:withoutSessionId(location)}});};
 return {plain:clean(session.plain),follow:base=>clean(session.follow(base))};
}
/**
 * Public documents of a part of a page: download links whose own entry (the div "form-check" that holds the link) is
 * marked "Öffentliches Dokument" and nothing else. A link without such an entry of its own is left out, so that the
 * mark of the document before it never counts for it.
 */
function publicDocuments(html,source,suffix=''){
 const out=[];
 for(const m of html.matchAll(/<a\b([^>]*\bdownloadlink\b[^>]*)>([\s\S]*?)<\/a>/gi)){
  const before=html.slice(Math.max(0,m.index-3000),m.index),start=[...before.matchAll(/<div\b[^>]*\bclass=["'](?:[^"']*\s)?form-check["'\s]/gi)].at(-1)?.index;
  const entry=start===undefined?'':before.slice(start),marks=[...entry.matchAll(/title=["']([^"']*Dokument)["']/g)].map(t=>t[1]);
  const id=m[1].match(/href=["'][^"']*\/dokument\/v\/(\d+)/i)?.[1];
  if(!id||/\bdownloadlink\b/.test(entry)||!marks.length||marks.some(t=>t!=='Öffentliches Dokument'))continue;
  const name=text(m[2]);out.push({title:(name.replace(/\.pdf$/i,'')||'Dokument')+suffix,url:allowed(source.base+'dokument/v/'+id,source),kind:/\.pdf$/i.test(name)?'application/pdf':'document'});
 }
 return out;
}
/**
 * One month of a meeting calendar, from the page or from the answer to a follow-up request: {month, meetings, controls}.
 * controls names the addresses of the month buttons (by month), of "previous" and "next". null if no month is shown.
 * unreadable counts the entries with a meeting link that could not be read (no meeting address, day or name).
 */
export function parseRisiCalendar(html,source,kind='str'){
 const page=withoutSessionId(html),month=monthOf(text(page.match(/id=["']sectionheader-month["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1]||''));if(!month)return null;
 const at=source.base+'sitzung/kalender/'+kind,address=u=>{try{return allowed(new URL(decode(u),at).href,source);}catch{return null;}};
 const bound=new Map([...page.matchAll(/Wicket\.Ajax\.ajax\(\{"u":"([^"]+)"[^}]*?"c":"([^"]+)"/g)].map(m=>[m[2],m[1]]));
 const control=re=>{const u=[...bound.values()].find(u=>re.test(u));return u?address(u):null;},months=new Map();
 for(const m of page.matchAll(/<button\b[^>]*\bid=["']([^"']+)["'][^>]*>\s*([^<]+?)\s*<\/button>/gi)){const label=monthOf(m[2]),u=bound.get(m[1]);if(label&&u&&address(u))months.set(label,address(u));}
 const meetings=[];let unreadable=0;
 for(const chunk of page.split(/<li\b[^>]*class=["'][^"']*\blist-group-item\b/i).slice(1)){
  const heads=anchors(chunk).filter(a=>/\bheadline-link\b/.test(a.attributes));if(!heads.length)continue;
  const link=heads.find(a=>/detail\/\d+$/.test(a.href));if(!link){unreadable++;continue;}
  const id=link.href.match(/(\d+)$/)[1],date=dayOf(text(link.html.match(/<span[^>]*sr-only[^>]*>([\s\S]*?)<\/span>/i)?.[1]||''));
  const name=text(link.html.replace(/<span[^>]*sr-only[^>]*>[\s\S]*?<\/span>/i,'')).replace(/^\d{1,2}:\d{2}\s*Uhr\s*-\s*/,''),plain=text(chunk);if(!date||!name){unreadable++;continue;}
  meetings.push({id,url:source.base+`sitzung/detail/${id}/tagesordnung/oeffentlich`,date,committee:bodyName(name,kind),body:kind,agenda:new RegExp(`/detail/${id}/tagesordnung/oeffentlich["']`).test(chunk),closed:new RegExp(`/detail/${id}/tagesordnung/nichtoeffentlich["']`).test(chunk),cancelled:/\(entfällt\)/i.test(plain),joint:/Hauptsitzung:/.test(plain)});
 }
 return {month,meetings,unreadable,controls:{prev:control(/-kalender-prev$/),next:control(/-kalender-next$/),months}};
}
/**
 * Public agenda page of one meeting: {date, committee, items}; null if the page is not the public agenda or names no day.
 * meeting.body is the calendar it comes from ("str" or "ba"); without it a plenary named in the heading is not taken
 * for the city council.
 * Rows "topueberschrift" and "topabschnitt" are headings (part, section); items carry the icon "Tagesordnungspunkt".
 * Item numbers start again in every part, so an item without paper or matter is told apart by part, section and number.
 */
export function parseRisiAgenda(html,meeting,source,now=new Date()){
 const page=withoutSessionId(html);
 if(!/^Öffentliche Tagesordnung$/.test(text(page.match(/<h2[^>]*id=["']sectionheader-tagesordnung["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1]||'')))return null;
 const start=page.search(/<div\b[^>]*class=["'][^"']*\bd-table\b[^"']*\btops\b[^"']*["']/i);if(start<0)return null;
 const end=page.indexOf('</section>',start),table=page.slice(start,end<0?undefined:end);
 // The heading names day, time and body, followed by additions such as "(TO freigegeben)"; the calendar names the body.
 const heading=text((page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'').replace(/<span[^>]*page-additionaltitle[\s\S]*$/i,'')),date=dayOf(heading)||meeting.date;if(!date)return null;
 const committee=meeting.committee||bodyName(heading.match(/Uhr\s*-\s*(.+)$/)?.[1]||'',meeting.body)||'Öffentliche Sitzung';
 const today=now.toISOString().slice(0,10),ahead=date>today,items=[];let part=null,section=null;
 for(const chunk of table.split(/<div class=["']d-table-row\b/).slice(1)){
  const kind=chunk.slice(0,chunk.indexOf('>')),cells=chunk.split(/<div class=["']d-table-cell\b/).slice(1);
  const own=cell=>cell?cell.slice(cell.indexOf('>')+1):'',number=text(own(cells[1])),body=own(cells[2]),title=text(body.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1]||'');
  if(/\btopueberschrift\b/.test(kind)){part={number,title};section=null;continue;}
  if(/\btopabschnitt\b/.test(kind)){section={number,title};continue;}
  if(!/title=["']Tagesordnungspunkt["']/.test(cells[0]||''))continue;
  const subject=title.replace(/^TOP\s*-\s*/,'');if(!subject)continue;
  const links=anchors(body),paper=links.find(a=>/\/sitzungsvorlage\/detail\/\d+$/.test(a.href)),matters=links.filter(a=>/\/antrag\/detail\/\d+$/.test(a.href));
  const paperUrl=paper?allowed(source.base+'sitzungsvorlage/detail/'+paper.href.match(/(\d+)$/)[1],source):null,matterUrls=matters.map(a=>allowed(source.base+'antrag/detail/'+a.href.match(/(\d+)$/)[1],source));
  const top=links.map(a=>a.href.match(/\/top\/(\d+)\/entscheidung$/)?.[1]).find(Boolean),decisionUrl=top?allowed(source.base+`sitzung/top/${top}/entscheidung`,source):null;
  const scope=(section?.number||part?.number||'').trim(),label=scope?(/[\d.]$/.test(scope)?scope.replace(/\.?$/,'.')+number:scope+' '+number):number;
  const reference=paper?text(paper.html).replace(/^Sitzungsvorlage\s*/i,''):'',withdrawn=/\btopabgesetzt\b/.test(kind)||/>\s*Abgesetzt\s*</.test(body),pending=/Beschluss liegt noch nicht vor/.test(text(body));
  const stable=paperUrl?'vo-'+paperUrl.match(/(\d+)$/)[1]:matterUrls.length?'vg-'+matterUrls[0].match(/(\d+)$/)[1]:`top-${meeting.id||fnv(meeting.url)}-${fnv([part?.number,part?.title,section?.number,section?.title,number,subject].join('|'))}`;
  const status=withdrawn?'postponed':ahead?(paperUrl?'consulting':'announced'):'unknown';
  const description=withdrawn?'Von der Tagesordnung abgesetzt.':ahead?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':pending?'Öffentlich auf der Tagesordnung; ein Beschluss liegt noch nicht vor.':'Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Abschnitt nicht belegt.';
  items.push({id:`${source.id}-${stable}`,title:subject,reference,sourceUrl:paperUrl||matterUrls[0]||meeting.url,identityLinks:[paperUrl,...matterUrls].filter(Boolean),status,documents:publicDocuments(body,source,` (${committee}, ${german(date)})`),
   event:{date,committee,status,description,result:withdrawn?'abgesetzt':'',url:meeting.url,publicEvidence:'Öffentliche Tagesordnung der Sitzung'},
   agenda:{number:label,part:part?[part.number,part.title].filter(Boolean).join(' '):'',section:section?[section.number,section.title].filter(Boolean).join(' '):'',type:value(body,'Typ'),matters:matters.map(a=>text(a.html)),paperUrl,decisionUrl:withdrawn||ahead?null:decisionUrl}});
 }
 return {date,committee,items};
}
/** Paper page (Sitzungsvorlage): descriptive fields and its public documents. The text of the paper is not kept. */
export function parseRisiPaper(html,source){
 const page=withoutSessionId(html),fields=[];
 const status=text(page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'').match(/\(([^()]+)\)/)?.[1];if(status)fields.push({field:'Status',value:status});
 const subject=text(page.match(/id=["']sectionheader-betreff["'][\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1]||'');if(subject&&subject.length<1200)fields.push({field:'Betreff',value:subject});
 for(const m of page.matchAll(/<div class=["']keyvalue-key["']>([\s\S]*?)<\/div>\s*<div class=["']keyvalue-value[^"']*["']>([\s\S]*?)<\/div>/gi)){const field=text(m[1]).replace(/:$/,''),v=text(m[2]);if(v&&v.length<1200&&/^(Freigabe|Wahlperiode|Zuständiges Referat|Art|Typ|BA-Unterrichtung|Stadtbezirk\/e|Abgeschlossen am)$/.test(field))fields.push({field,value:v});}
 // A paper whose kind (Art) says anything but public ("Nichtöffentlicher Vorgang", "Vertraulicher Vorgang" …) keeps no
 // documents; without that field only the mark of each document decides.
 const art=fields.find(f=>f.field==='Art')?.value,restricted=art!==undefined&&(!/^Öffentlich/i.test(art)||/nicht\s*öffentlich/i.test(art));
 const from=page.search(/<h2\b[^>]*>\s*Dokumente\b/i),to=page.search(/id=["']ergebnisse["']/i);
 return {fields,restricted,documents:restricted||from<0?[]:publicDocuments(page.slice(from,to>from?to:undefined),source)};
}
/** Decision page of a public agenda item: {decision, vote, result}; null if the page does not show a public item. */
export function parseRisiDecision(html){
 const page=withoutSessionId(html);
 if(!/\(Öffentlich\)/.test(text(page.match(/id=["']sectionheader-topinfo["'][\s\S]*?<span>([\s\S]*?)<\/span>/i)?.[1]||'')))return null;
 // "siehe Beschlussseite" only points to the decision document.
 const decision=value(page,'Entscheidung'),vote=value(page,'Ergebnis');return {decision,vote,result:[decision,vote].filter(v=>v&&!/^siehe Beschlussseite$/i.test(v)).join(', ')};
}
// "nach Antrag" (as proposed) is the usual wording of an approval here. Only the plenary decides finally (DECIDING_BODY);
// a committee's decision, the summer committee's (Feriensenat) included, counts as a recommendation.
export const risiStatus=(result,committee)=>{
 const status=resultStatus(result,committee);if(status)return status;
 const final=DECIDING_BODY.test(committee);
 return /Ablehnung/i.test(result)?(final?'rejected':'recommended'):/nach Antrag|wie beantragt|antragsgemäß|Zustimmung|geändert|mit Änderung/i.test(result)?(final?'approved':'recommended'):null;
};
/**
 * The RIS of Munich, recognised by its address (risi.muenchen.de below /risi, with or without ";jsessionid=…") or by
 * a page of the city's own domain (muenchen.de and its subdomains) that links into it. Pages of other hosts link to it
 * too (Landkreis München, newspapers) and are not the city: a link there does not count. Returns the catalog fields or
 * null. dataUrl is the first page the reader asks.
 */
export function detectMuenchenRisi(url,html=''){
 let page;try{page=new URL(url);}catch{return null;}
 const host=page.hostname.toLowerCase(),web=/^https?:$/.test(page.protocol);
 const own=web&&host==='risi.muenchen.de'&&/^\/risi(?:[/;?]|$)/i.test(page.pathname);
 const linked=web&&(host==='muenchen.de'||host.endsWith('.muenchen.de'))&&/(?:href|src|action)\s*=\s*["']https?:\/\/risi\.muenchen\.de\/risi[/;?"']/i.test(String(html||''));
 return own||linked?{adapter:'muenchen-risi',method:'scraper',base:RISI_BASE,dataUrl:RISI_BASE+'sitzung/kalender/str'}:null;
}
// marks (optional): what earlier imports read completely, see meeting-marks.mjs.
// districts (or source.districts): also the meetings of the district committees.
export async function collectMuenchenRisi(source,{now=new Date(),get=fetchText,request=fetch,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks,districts=source.districts===true}={}){
 // After a rejection by the firewall the source is asked more slowly (paced); the refused meeting is left for later.
 get=paced(budgeted(get,maxDurationMs,2));
 const from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10),until=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+2,0)).toISOString().slice(0,10);
 const issues=[],warnings=[],listed=new Map(),session=createRisiSession(request);let halt=null;
 const read=async(url,followUpOf)=>{
  if(halt)throw Error(halt);if(/jsessionid/i.test(url))throw Error(SESSION_ID);
  const html=await get(allowed(url,source),source,undefined,followUpOf?session.follow(followUpOf):session.plain);
  // The firewall's check against automated requests (F5 bot defence) is respected: reading ends, it is not solved.
  if(/\/TSPD\/|bobcmn/i.test(html)){halt=GATE;throw Error(halt);}
  return html;
 };
 // Calendar months: the window and the next month. A month is reached through its button where the calendar shows one,
 // otherwise by "previous" or "next", one request per month; the requests of one calendar go one after the other.
 const wanted=[];for(let month=shift(now.toISOString().slice(0,7),1);month>=fromDay.slice(0,7);month=shift(month,-1))wanted.push(month);
 const calendar=async kind=>{
  const name=kind==='ba'?'Sitzungskalender der Bezirksausschüsse':'Sitzungskalender des Stadtrats',seen=new Set();let unreadable=0;
  const take=view=>{seen.add(view.month);unreadable+=view.unreadable;for(const m of view.meetings)if(m.date>=fromDay&&m.date<=until&&!listed.has(m.url))listed.set(m.url,m);};
  try{
   let view=parseRisiCalendar(await read(source.base+'sitzung/kalender/'+kind),source,kind);if(!view)throw Error('Unbekanntes Kalenderformat');take(view);
   for(const target of wanted)for(let step=0;!seen.has(target);step++){
    const url=view.controls.months.get(target)||(target<view.month?view.controls.prev:view.controls.next);if(!url||step>2)throw Error(`Monat ${german(target+'-01').slice(3)} nicht erreichbar`);
    const address=new URL(url),page=address.pathname.slice(new URL(source.base).pathname.length)+(address.search.match(/^\?\d+/)?.[0]||'');
    const next=parseRisiCalendar(await read(url,page),source,kind);if(!next)throw Error('Folgeseite ohne Monatsansicht');
    take(next);view={...next,controls:{...next.controls,prev:next.controls.prev||view.controls.prev,next:next.controls.next||view.controls.next}};
   }
  }catch(e){if(e.message!==halt)issues.push(name+': '+e.message);}
  // An entry of the calendar that cannot be read is a gap, not one meeting less: it is named.
  if(unreadable)issues.push(`${name}: ${unreadable} ${unreadable===1?'Eintrag':'Einträge'} ohne lesbare Sitzungsadresse, Tag oder Gremium`);
 };
 await calendar('str');if(districts&&!halt)await calendar('ba');
 // A meeting without a public agenda link: cancelled, a joint meeting whose agenda stands at its main meeting, only a
 // non-public part, or not yet published. Only the last, once the day has passed, is worth a remark.
 const meetings=[];let upcoming=0;
 for(const m of listed.values()){if(m.agenda){meetings.push(m);continue;}if(m.cancelled||m.joint||m.closed)continue;if(m.date>today)upcoming++;else warnings.push('Sitzung ohne veröffentlichte Tagesordnung: '+source.base+'sitzung/detail/'+m.id);}
 const grouped=new Map(),held={},cache=new Map();let count=0,fetched=0,beyond=0,unchanged=0,done=0,unread=0,refused=0;
 const once=(url,parse)=>{if(!cache.has(url))cache.set(url,read(url).then(html=>parse(html,source)));return cache.get(url);};
 await parallel(meetings.sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date)),async m=>{
  if(halt)return;
  const known=usableMark(marks,m,now);
  // Read completely a moment ago: an import that ran out of time continues behind it without asking again.
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;count++;return;}
  if(fetched>=MAX_MEETINGS){beyond++;return;}fetched++;
  try{
   const agenda=parseRisiAgenda(await read(m.url),m,source,now);if(!agenda){issues.push('Keine lesbare öffentliche Tagesordnung: '+m.url);return;}
   const rows=agenda.items,print=(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.reference,r.status,r.agenda.number,r.agenda.decisionUrl,r.documents.map(d=>d.url)])))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;count++;return;}
   // A page behind an item cut off by the time budget or the halt (cut), or refused by the firewall (denied): the meeting
   // is left for the next step and counted for its reason.
   let cut=false,denied=false,complete=true;
   const failed=(row,what,e)=>{row.sourceData.detailStatus='partial';row.sourceData.issues.push(e.message);complete=false;if(/Zeitbudget/.test(e.message)||e.message===halt)cut=true;else if(e.message.includes(REFUSED))denied=true;else issues.push(what+': '+e.message);};
   for(const row of rows){
    const {number,part,section,type,matters,paperUrl,decisionUrl}=row.agenda;delete row.agenda;
    row.sourceData={version:'public-source-fields-v1',method:'muenchen-risi',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:{reference:row.reference,title:row.title,number,part,section,type,matters,result:row.event.result}}],detailStatus:'completed',issues:[]};
    if(paperUrl){try{const p=await once(paperUrl,parseRisiPaper);row.documents.push(...p.documents);row.sourceData.records.push({kind:'paper',url:paperUrl,fields:p.fields});}catch(e){failed(row,'Vorlagendetails',e);}}
    if(decisionUrl){try{const d=await once(decisionUrl,parseRisiDecision);
     if(d?.result){row.event.result=d.result;row.event.description='Entscheidung laut Sitzungsseite: '+d.result;row.event.status=row.status=risiStatus(d.result,agenda.committee)||'unknown';row.sourceData.records.push({kind:'decision',url:decisionUrl,fields:{decision:d.decision,vote:d.vote}});}
    }catch(e){failed(row,'Entscheidung',e);}}
    row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
    const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);previous.identityLinks.push(...row.identityLinks);}else grouped.set(row.id,{...row,events:[row.event]});
   }
   // A meeting counts as read only if every page behind it could be read.
   if(cut)unread++;else if(denied)refused++;else if(complete){held[m.url]=newMark({...m,date:agenda.date},print,now,rows.length);done++;}
  }catch(e){if(/Zeitbudget/.test(e.message)||e.message===halt)unread++;else if(e.message.includes(REFUSED))refused++;else issues.push(m.url+': '+e.message);}
  count++;onProgress(source.id+': '+count+'/'+meetings.length+' Sitzungen');
 },2);
 if(halt)issues.push(halt+(unread?` ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`:''));
 else if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(refused)issues.push(`Server wies ${refused} ${refused===1?'Sitzung':'Sitzungen'} vorübergehend ab; der nächste Schritt setzt dort fort.`);
 if(beyond&&!halt)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  // A paper can stand twice on one agenda, once withdrawn: the item that was dealt with comes last.
  row.events.sort((a,b)=>a.date.localeCompare(b.date)||(b.result==='abgesetzt')-(a.result==='abgesetzt'));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),identityLinks:[...new Set(row.identityLinks)],documents:[...new Map([...row.documents,{title:'Vorlage / öffentliche Tagesordnung',url:row.sourceUrl,kind:'html'}].map(d=>[d.url,d])).values()]};
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche Seite des Ratsinformationssystems München; nur Tagesordnungspunkte der öffentlichen Tagesordnung.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 // Unchanged meetings are a successful reading: their reports are in the database already.
 // After a halt nothing is resumed automatically: the next import is the next attempt.
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:meetings.length,...(upcoming?{upcomingWithoutAgenda:upcoming}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...((unread||beyond||refused)&&!halt?{resumable:true}:{}),...(warnings.length?{warnings}:{}),...(districts?{districts:true}:{}),sourceCount:1,quiet:listed.size===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
