import {sourceDecision} from './source-fields.mjs';
import {windowStart,historyWindow,windowYears} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text,decode,MAX_MEETINGS} from './sessionnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
// Public pages of SD.NET RIM (Sternberg). Only plain links of the public site are followed:
// the paper list, the calendar export and the meeting pages. The calendar's data endpoint is not used,
// because it answers only with a session cookie and a form token (HTTP 403 otherwise).
const day=value=>{const m=String(value).match(/(\d{2})\.(\d{2})\.(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:null;};
const cell=(row,name)=>row.match(new RegExp(`<td[^>]*class=["'][^"']*column-${name}[^"']*["'][^>]*>([\\s\\S]*?)<\\/td>`,'i'))?.[1]||'';
const anchors=html=>[...html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)].map(m=>({url:decode(m[2]),attributes:m[1]+m[3],label:text(m[4])}));
const title=a=>decode(a.attributes.match(/title=["']([^"']*)/)?.[1]||'');
const fnv=value=>{let h=0x811c9dc5;for(const c of new TextEncoder().encode(value)){h^=c;h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,'0');};
/** Meetings named in the paper list: every scheduled paper links its meeting. */
export function paperListMeetings(html,source){
 const meetings=[];
 for(const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const termin=cell(row[1],'termin');if(!termin)continue;
  const link=anchors(termin).find(a=>/\/tops\/\?__=/.test(a.url));const date=link&&day(title(link)||link.label);if(!date)continue;
  meetings.push({url:allowed(new URL(link.url,source.base).href,source),date,committee:text(termin.match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1]||'')});
 }
 const next=anchors(html).find(a=>a.label==='>'&&/\/vorlagen\/?\?__=/.test(a.url));
 return {meetings,rows:(html.match(/class=["'][^"']*column-betreff/g)||[]).length,next:next?allowed(new URL(next.url,source.base).href,source):null};
}
/** Upcoming meetings from the public calendar export (iCalendar). */
export function calendarMeetings(ics,source){
 const meetings=[];
 for(const event of String(ics).replace(/\r?\n[ \t]/g,'').split('BEGIN:VEVENT').slice(1)){
  const start=event.match(/DTSTART[^:\n]*:(\d{4})(\d{2})(\d{2})/),link=event.match(/https:\/\/[^\s\\]+\/tops\/\?__=[A-Za-z0-9_-]+/)?.[0];
  if(!start||!link)continue;
  try{meetings.push({url:allowed(link,source),date:`${start[1]}-${start[2]}-${start[3]}`,committee:(event.match(/SUMMARY:([^\r\n]*)/)?.[1]||'').replace(/\\([,;])/g,'$1').trim(),cancelled:/entf(ä|ae)llt/i.test(event)});}catch{/* link outside the approved source */}
 }
 return meetings;
}
/** Public agenda items of one meeting page. Rows of the non-public part carry no public marker and are skipped. */
export function parseSdnetAgenda(html,meeting,source,now=new Date()){
 // "table-top" as a whole class name: a page may also carry a "table-top.tischvorlagen" table of late papers.
 const table=html.match(/<table[^>]*class=["'](?:[^"']*\s)?table-top(?:\s[^"']*)?["'][\s\S]*?<\/table>/i)?.[0];if(!table)return null;
 const today=now.toISOString().slice(0,10),items=[];
 for(const m of table.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)){
  if(!/class=["'][^"']*\btop-oeff-data\b/.test(m[1]))continue;
  const headline=text(cell(m[2],'bezeichnung'));if(!headline)continue;
  const number=text(cell(m[2],'topnrtext')),reference=text(cell(m[2],'nummer')),key=m[1].match(/data-vorgang-id=["']([\w-]+)["']/)?.[1];
  const all=anchors(cell(m[2],'dokumente')),matter=all.find(a=>/\/vorgang\/\?__=/.test(a.url));
  const documents=[];for(const a of all.filter(a=>/\/sdnetrim\//.test(a.url))){try{documents.push({title:(title(a)||a.label||'Originalunterlage').replace(/ im PDF-Format öffnen$/,'').replace(/\s*\((?:exportiert|aktualisiert):[^)]*\)\s*\([^)]*\)$/,''),url:allowed(new URL(a.url,source.base).href,source),kind:/\.pdf(?:$|\?)/i.test(a.url)?'application/pdf':'document'});}catch{/* foreign host */}}
  const decided=all.some(a=>/beschluss-link/.test(a.label+a.attributes)||/Beschlusstext/i.test(title(a)));
  const matterUrl=matter?allowed(new URL(matter.url,source.base).href,source):null;
  // The result is published as a PDF only, so no outcome is derived from the page.
  const status=meeting.date>today?(reference?'consulting':'announced'):'unknown';
  const description=meeting.date>today?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':decided?'Öffentlich beraten; der Beschlusstext liegt als Dokument vor. Das Ergebnis ist im eingelesenen Abschnitt nicht belegt.':'Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Abschnitt nicht belegt.';
  // Older installations publish no record id. Addresses carry an opaque parameter whose stability over time is not
  // established, so the paper number (or meeting date, committee, item number and title) identifies the item instead.
  const stable=key||(reference?'nr-'+reference.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''):meeting.date.replace(/-/g,'')+'-'+fnv([meeting.committee,number,headline].join('|')));
  items.push({id:`${source.id}-${reference?'vo':'top'}-${stable}`,title:headline,reference,sourceUrl:matterUrl||meeting.url,identityLinks:[matterUrl].filter(Boolean),status,documents,
   event:{date:meeting.date,committee:meeting.committee,status,description,result:'',url:meeting.url,publicEvidence:'Abschnitt „Öffentliche Sitzung“ der Tagesordnung'},agenda:{number,key:key||null}});
 }
 return items;
}
/** Paper page: descriptive fields and the consultation sequence with the published vote per meeting. */
export function parseSdnetMatter(html,source){
 const fields=[];for(const m of html.matchAll(/<tr\b[^>]*>\s*<t[hd][^>]*>([\s\S]*?)<\/t[hd]>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)){const field=text(m[1]).replace(/:$/,''),value=text(m[2]);if(field.length<60&&value.length<1200&&/Vorlage|Betreff|Federführ|Antrag|Anfrage|Mitteilung|Datum|Art|Status/i.test(field))fields.push({field,value});}
 const table=html.match(/<table[^>]*class=["'][^"']*table-vorgang[^"']*["'][\s\S]*?<\/table>/i)?.[0]||'';const consultations=[];
 for(const m of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const link=anchors(cell(m[1],'beginn')).find(a=>/\/tops\/\?__=/.test(a.url));const date=link&&day(link.label);if(!date)continue;
  try{consultations.push({url:allowed(new URL(link.url,source.base).href,source),date,committee:text(cell(m[1],'gremium')),result:text(cell(m[1],'ergebnis'))});}catch{/* foreign host */}
 }
 return {fields,consultations};
}
// A status is derived only when the published vote names the outcome. "Einstimmig" alone states how, not what.
export function resultStatus(result,committee){
 if(/vertagt|zurückgestellt|abgesetzt|verwiesen/i.test(result))return 'postponed';
 if(/kenntnis/i.test(result))return 'info';
 if(/empfohl/i.test(result))return 'recommended';
 if(/beschlossen|zugestimmt|angenommen|abgelehnt|\b(?:einstimmig|mehrheitlich) (?:dafür|dagegen)\b/i.test(result))return /^(Rat|Gemeinderat|Stadtrat|Stadtverordnetenversammlung|Kreistag)(\s|$)/i.test(committee)?(/abgelehnt|dagegen/i.test(result)?'rejected':'approved'):'recommended';
 return null;
}
// marks (optional): what earlier imports read completely, see meeting-marks.mjs. A mark counts only for the import
// period it was written with: a paper page names the earlier meetings of its paper, and only meetings inside the
// period are followed. After a change to a longer period every meeting is therefore read once more.
// maxListPages: pages of the paper list that are read; by default forty for each year of the period.
export async function collectSdnet(source,{now=new Date(),get=fetchText,maxDurationMs=300000,maxListPages,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 const period=historyWindow(lookback)+':';maxListPages??=40*windowYears(lookback);
 const from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),until=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+2,0)).toISOString().slice(0,10);
 const issues=[],meetings=new Map();const keep=m=>{if(m.date>=fromDay&&m.date<=until&&!meetings.has(m.url))meetings.set(m.url,m);};
 // 1. Paper list, newest papers first. Its order follows the paper number, not the meeting date,
 //    so reading ends only after two consecutive pages without any meeting inside the window.
 let next=source.base+'vorlagen',pages=0,stale=0;const seen=new Set();
 while(next&&!seen.has(next)){
  if(++pages>maxListPages){issues.push('Seitenlimit der Vorlagenliste erreicht; ältere Sitzungen im Zeitraum können fehlen.');break;}
  seen.add(next);
  try{const html=await get(next,source);const list=paperListMeetings(html,source);
   if(pages===1&&!list.rows)throw Error('Unbekanntes Format der Vorlagenliste');
   list.meetings.forEach(keep);stale=list.meetings.some(m=>m.date>=fromDay)?0:stale+1;if(stale>=2)break;next=list.next;
  }catch(e){issues.push('Vorlagenliste: '+e.message);break;}
 }
 // 2. Calendar export: upcoming meetings, including those without papers.
 try{const page=await get(source.base+'termine',source);const exportUrl=decode(page.match(/data-export-url=["']([^"']+)["']/)?.[1]||'');
  if(exportUrl)for(const m of calendarMeetings(await get(allowed(exportUrl,source),source),source))if(!m.cancelled)keep(m);
 }catch(e){issues.push('Kalenderexport: '+e.message);}
 const grouped=new Map(),today=now.toISOString().slice(0,10),held={};let count=0,limited=false,upcoming=0,unchanged=0,done=0,unread=0;
 const matters=new Map();const matter=url=>{if(!matters.has(url))matters.set(url,get(url,source).then(html=>parseSdnetMatter(html,source)));return matters.get(url);};
 // 3. Meeting pages. A paper page names every meeting that discussed the paper; the paper list shows only the
 //    latest one. Meetings found that way are read in the next round, until no new meeting turns up.
 let round=[...meetings.values()];
 while(round.length){
  const found=[];
  await parallel(round.sort((a,b)=>b.date.localeCompare(a.date)),async m=>{
   const mark=usableMark(marks,m,now),known=mark&&String(mark.print).startsWith(period)?mark:null;
   // Read completely a moment ago: an import that ran out of time continues behind it without asking again.
   if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;return;}
   if(count>=MAX_MEETINGS){limited=true;return;}count++;
   try{const html=await get(m.url,source);
    const header=text(html.match(/Sitzung:\s*<\/t[dh]>\s*<td[^>]*>([\s\S]*?)<\/td>/i)?.[1]||'');const meeting={...m,committee:m.committee||header.replace(/\s*,\s*\d+\.\s*Sitzung.*$/,'')||'Öffentliche Sitzung'};
    const items=parseSdnetAgenda(html,meeting,source,now);
    // The calendar export lists every scheduled meeting. An upcoming meeting without an agenda has nothing public
    // to read yet; that is counted, not reported as a gap. A past meeting without a readable agenda is a gap.
    if(!items){if(m.date>today)upcoming++;else issues.push('Keine lesbare öffentliche Tagesordnung: '+m.url);return;}
    // What the agenda page says. If that is what it said when the papers were last read, they are not fetched again.
    const print=period+(await hash(JSON.stringify(items.map(r=>[r.id,r.title,r.reference,r.agenda.number,r.event.description,r.documents.map(d=>d.url)])))).slice(0,16);
    if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;return;}
    let cut=false,complete=true;
    for(const row of items){
     row.sourceData={version:'public-source-fields-v1',method:'sdnet',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:{reference:row.reference,title:row.title,number:row.agenda.number,matter:row.agenda.key}}],detailStatus:'completed',issues:[]};delete row.agenda;
     if(row.reference&&row.identityLinks[0]){
      try{const detail=await matter(row.identityLinks[0]);
       row.sourceData.records.push({kind:'paper',url:row.identityLinks[0],fields:detail.fields});
       const own=detail.consultations.find(c=>c.url===m.url);
       if(own?.result){row.event.result=own.result;row.event.description='Abstimmung laut Beratungsfolge: '+own.result;row.event.status=row.status=resultStatus(own.result,meeting.committee)||row.status;}
       for(const c of detail.consultations)if(c.date>=fromDay&&c.date<=until&&!meetings.has(c.url)){meetings.set(c.url,c);found.push(c);}
      }catch(e){row.sourceData.detailStatus='partial';row.sourceData.issues.push(e.message);complete=false;if(/Zeitbudget/.test(e.message))cut=true;else issues.push('Vorlagendetails: '+e.message);}
     }
     row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
     const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);previous.identityLinks.push(...row.identityLinks);}else grouped.set(row.id,{...row,events:[row.event]});
    }
    // A meeting counts as read only if every paper page behind it could be read.
    if(cut)unread++;else if(complete){held[m.url]=newMark(m,print,now,items.length);done++;}
   }catch(e){if(/Zeitbudget/.test(e.message))unread++;else issues.push(m.url+': '+e.message);}
   onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
  },3);
  round=found;
 }
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(limited)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),identityLinks:[...new Set(row.identityLinks)],documents:[...new Map([...row.documents,{title:'Vorgang / öffentliche Tagesordnung',url:row.sourceUrl,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche SD.NET-Seite; Tagesordnungspunkte aus dem Abschnitt „Öffentliche Sitzung“.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 // Unchanged meetings are a successful reading: their reports are in the database already.
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:now.toISOString().slice(0,10),importedAt:now.toISOString(),meetings:meetings.size-upcoming,upcomingWithoutAgenda:upcoming,...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||limited?{resumable:true}:{}),sourceCount:1,quiet:topics.length===0&&unchanged===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
