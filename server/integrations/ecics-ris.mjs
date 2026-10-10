import {sourceDecision,DECIDING_BODY} from './source-fields.mjs';
import {windowStart,historyWindow} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text,decode,MAX_MEETINGS} from './sessionnet.mjs';
import {resultStatus} from './sdnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
import {committeePart} from './oparl-regional.mjs';
// Ratsinformationssystem of the municipal website system "ecics" (pages /ris?action=show_sitzungsliste and
// /ris?action=show_sitzung&sitzung_id=N, documents /ris/V_….pdf), as used by many small municipalities of Baden-Württemberg
// (Ilsfeld, Güglingen, Pfaffenhofen, Lauffen, Cleebronn, Zaberfeld, Beilstein, …). The pages exist in several templates
// that differ in their markup only. Read are plain addresses of the public site:
// - the list of meetings (all years on one page): day, time, body and the number of each meeting,
// - the page of a meeting: the public agenda ("TOP n" / "Tagesordnungspunkt n") with the papers (Vorlagen, PDF) of each item
//   and, in some municipalities, the minutes of the item ("Protokoll"), from which the resolution is taken.
// The page shows the public part only; the member area (/system?action=user_login) is never requested. Documents are only linked.
const slug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const MORE={bdquo:'„',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’',laquo:'«',raquo:'»',sect:'§',euro:'€',hellip:'…',middot:'·',deg:'°'};
const plain=html=>text(String(html).replace(/<br\s*\/?>/gi,' ')).replace(/&(\w+);/g,(m,k)=>MORE[k]??m).normalize('NFC').replace(/ /g,' ').replace(/\s+/g,' ').trim();
const clip=(value,max)=>value.length>max?value.slice(0,max).replace(/\s+\S*$/,'')+' …':value;
const LIST='ris?action=show_sitzungsliste',PAGE='ris?action=show_sitzung&sitzung_id=';
// Pages the reader requests: the list and the page of a meeting, nothing else.
const guard=(url,source)=>{const u=new URL(url),rest=u.pathname.slice(new URL(source.base).pathname.length)+u.search;if(!/^ris\?action=show_sitzung(?:sliste|&sitzung_id=\d+)$/.test(rest))throw Error('Nicht freigegebene Quelladresse');return url;};
/** Address of the list of meetings, or of the page of a meeting. */
export const ecicsUrl=(source,id)=>allowed(new URL(id?PAGE+id:LIST,source.base).href,source);
export function detectEcics(url,html=''){
 const page=String(html);
 if(!/action=show_sitzung(?:&amp;|&)sitzung_id=\d+|data-sitzung-id="\d+"/.test(page)||!/\/(?:cssmanager|ecics|central)\//.test(page)||!/ris-year-box|risng|ris_top_list/.test(page))return null;
 return {adapter:'ecics-ris',base:'https://'+new URL(url).host+'/'};
}
const iso=(d,m,y)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
/**
 * Meetings of the list: id, day, time, body, newest first. The list shows the year as a heading; the day of the entry
 * is "20.01." or "20.01.2026". An entry is a list item with the number of the meeting in a link or in data-sitzung-id.
 */
export function ecicsMeetings(html){
 const page=String(html),marks=[...page.matchAll(/<h2\b[^>]*>\s*(\d{4})\s*<\/h2>/g)].map(m=>[m.index,Number(m[1])]);
 const rows=new Map();
 for(const m of page.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/g)){
  const id=(m[1]+m[2]).match(/data-sitzung-id="(\d+)"|sitzung_id=(\d+)/);if(!id)continue;
  const label=plain(m[2].replace(/<span\b[^>]*title="(?:Protokoll|Tagesordnung)"[^>]*>[\s\S]*?<\/span>/gi,' ').replace(/<\/(?:p|a)>/gi,' ')),
   at=label.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})?\s*[-–]\s*(\d{1,2}:\d{2})\s*Uhr[\s:–-]*(.*)$/);
  if(!at)continue;
  const year=at[3]?Number(at[3]):marks.filter(h=>h[0]<m.index).at(-1)?.[1];if(!year||!at[5])continue;
  rows.set(id[1]||id[2],{id:id[1]||id[2],date:iso(at[1],at[2],year),time:at[4],body:at[5].trim()});
 }
 return [...rows.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time)||a.body.localeCompare(b.body,'de'));
}
const ROUTINE=/^(?:bürgerfragestunde|einwohnerfragestunde|fragestunde|bekanntgaben?|verschiedenes|anfragen|informationen|mitteilungen|eröffnung|begrüßung)\b/i;
const PAPER=/^Vorlage\b/i,NONE=/^ohne Vorlage\b/i;
/**
 * The page of a meeting: day, time and the items (number, title, paper number, documents {title,url}, text of the minutes).
 * Only the public part exists on the page. Items without a paper and without minutes (and routine items such as the
 * question time or announcements) carry no matter; they are returned with routine:true so that a caller can skip them.
 */
export function parseEcicsMeeting(html,pageUrl='https://example.invalid/ris'){
 const page=String(html).replace(/<script[\s\S]*?<\/script>/gi,''),when=plain(page.match(/Sitzung am\s+(\d{1,2})\.(\d{1,2})\.(\d{4})\s+um\s+(\d{1,2}:\d{2})\s*Uhr/)?.[0]||'').match(/(\d{1,2})\.(\d{1,2})\.(\d{4}).*?(\d{1,2}:\d{2})/);
 const heads=[...page.matchAll(/<(h3|div)\b[^>]*>\s*(?:TOP|Tagesordnungspunkt)\s+(\d+[a-z]?)\s*<\/\1>/gi)];
 const end=(()=>{const cut=page.search(/<footer|id="main-footer"|class="area-1-2"|id="footer-inner"|id="main-scl"/);return cut<0?page.length:cut;})();
 const items=heads.map((h,k)=>{
  const from=h.index+h[0].length,to=Math.min(k+1<heads.length?heads[k+1].index:end,end),block=page.slice(from,Math.max(from,to));
  const minutes=plain([...block.matchAll(/<div\b[^>]*class="(?:protokoll-text|ris_top_protokoll_text)(?:-inner)?"[^>]*>([\s\S]*?)<\/div>/gi)].map(m=>m[1].replace(/<a\b[^>]*toggle[\s\S]*?<\/a>/gi,'')).join(' '));
  const documents=[...block.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].filter(a=>/Vorlage herunterladen/i.test(a[1])).flatMap(a=>{
   const href=decode(a[1].match(/href="([^"]*)"/)?.[1]||'');let url;try{url=new URL(href,pageUrl).href;}catch{return [];}
   return /\.pdf$/i.test(new URL(url).pathname)?[{title:plain(a[2]).replace(/\s+\(.*$/,'')||'Vorlage',url}]:[];
  });
  const body=block.replace(/<div\b[^>]*class="(?:protokoll-text|ris_top_protokoll_text|proto|ris_top_list_proto)[^"]*"[\s\S]*$/i,'').replace(/<ul\b[^>]*class="vorlagen[\s\S]*$/i,'').replace(/<a\b[^>]*Vorlage herunterladen[\s\S]*?<\/a>/gi,' ');
  // Some templates split the title (descr-1) from a longer explanation (descr-2); the title is the first part.
  const head=body.match(/<div\b[^>]*class="descr-1"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  const lines=[...(head||body).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(p=>plain(p[1])).filter(Boolean);
  const paperLines=[...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(p=>plain(p[1])).filter(Boolean);
  const paperLine=paperLines.find(l=>PAPER.test(l)),titleLines=lines.filter(l=>!PAPER.test(l)&&!NONE.test(l));
  const first=documents[0]?plain([...block.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].find(a=>/Vorlage herunterladen/i.test(a[1]))[2]):'';
  const paper=(paperLine?.replace(/^Vorlage\s*(?:Nr\.?)?\s*/i,'')||(PAPER.test(first)?first.replace(/\s*\(.*$/,'').replace(/^Vorlage\s*/i,''):'')).replace(/\s+/g,' ').trim();
  const title=clip(titleLines.join(' – '),300);
  return {number:h[2],title,paper,documents,minutes,routine:!documents.length&&(!minutes||ROUTINE.test(title))};
 }).filter(i=>i.title);
 return {date:when?iso(when[1],when[2],when[3]):null,time:when?.[4]||'',items};
}
// The resolution of an item is taken from the minutes: the sentence that names it.
const RESOLUTION=/(?:beschließt|beschloss|beschlossen|beschluss|stimmt\b.{0,40}\bzu|zugestimmt|einstimmig|mehrheitlich|abgelehnt|lehnt\b.{0,40}\bab|zur kenntnis genommen|nimmt\b.{0,40}\bkenntnis|vertagt|zurückgestellt)/i;
const STRONG=/beschließt|beschloss|beschlossen|beschluss\b|zugestimmt|stimmt\b.{0,40}\bzu\b|einstimmig/i;
export function ecicsResolution(minutes){
 const sentences=String(minutes||'').split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„"])/);
 const hit=[...sentences].reverse().find(s=>STRONG.test(s))||[...sentences].reverse().find(s=>RESOLUTION.test(s));
 return hit?clip(hit.trim(),400):'';
}
const statusOf=(resolution,committee)=>{
 const r=resultStatus(resolution,committee);if(r)return r;
 const decides=DECIDING_BODY.test(committee);
 if(/zur kenntnis/i.test(resolution))return 'info';
 if(/vertagt|zurückgestellt|verschoben/i.test(resolution))return 'postponed';
 if(/abgelehnt|lehnt\b.*\bab\b/i.test(resolution))return decides?'rejected':'recommended';
 if(/beschließt|beschloss|beschlossen|zugestimmt|stimmt\b.*\bzu\b|einstimmig|mehrheitlich/i.test(resolution))return decides?'approved':'recommended';
 return 'unknown';
};
/** The reports of one meeting: a row per public item with a paper or with minutes. */
export function ecicsItems(parsed,meeting,source,now=new Date()){
 const date=parsed.date||meeting.date,committee=meeting.body,today=now.toISOString().slice(0,10),past=date<=today,url=ecicsUrl(source,meeting.id);
 return parsed.items.filter(i=>!i.routine).map(i=>{
  const resolution=past?ecicsResolution(i.minutes):'',status=!past?'consulting':resolution?statusOf(resolution,committee):'unknown';
  const description=!past?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':resolution?`Beschluss laut Protokoll: ${resolution}`:'In der Tagesordnung geführt; im Protokoll ist kein Beschluss veröffentlicht.';
  return {id:`${source.id}-ec-${meeting.id}-${slug(i.number)}`,title:i.title,reference:i.paper||`TOP ${i.number}`,sourceUrl:url,identityLinks:[],documents:i.documents.map(d=>({title:d.title,url:d.url,kind:'pdf'})),status,
   record:{number:i.number,paper:i.paper,resolution},
   event:{date,committee,status,description,result:resolution,url,publicEvidence:`Öffentliche Tagesordnung, TOP ${i.number}`}};
 });
}
// marks (optional): what earlier imports read completely, see meeting-marks.mjs.
export async function collectEcics(source,{now=new Date(),get=fetchText,request=fetch,oldestFirst=false,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 const guarded=(url,init)=>{guard(url,source);return request(url,init);};
 const read=url=>{guard(url,source);return get(url,source,undefined,guarded);};
 const period=historyWindow(lookback)+':',from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10);
 const issues=[],warnings=[],meetings=new Map(),part=committeePart(source.organizations);
 try{
  const rows=ecicsMeetings(await read(ecicsUrl(source)));
  if(!rows.length)throw Error('keine Sitzungen in der Liste');
  for(const r of rows){
   if(r.date<fromDay)continue;
   if(!part.keep(r.body,r.id+r.body))continue;
   meetings.set(ecicsUrl(source,r.id),{...r,url:ecicsUrl(source,r.id)});
  }
 }catch(e){issues.push('Sitzungsliste: '+e.message);}
 const grouped=new Map(),held={};let count=0,limited=false,unchanged=0,done=0,unread=0,empty=0;
 await parallel([...meetings.values()].sort((a,b)=>oldestFirst?a.date.localeCompare(b.date):b.date.localeCompare(a.date)),async m=>{
  const mark=usableMark(marks,m,now),known=mark&&String(mark.print).startsWith(period)?mark:null;
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;return;}
  if(count>=MAX_MEETINGS){limited=true;return;}count++;
  try{
   const html=await read(m.url),parsed=parseEcicsMeeting(html,m.url);
   if(!parsed.items.length){
    // A meeting without agenda yet (a coming one) is no error; a page without the agenda markup of a past one is.
    if(m.date>today||/Tagesordnung/i.test(text(html))){empty++;return;}
    issues.push('Unbekanntes Format der Tagesordnung: '+m.url);return;
   }
   const rows=ecicsItems(parsed,m,source,now),print=period+(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.record,r.status])))).slice(0,16);
   if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;return;}
   for(const row of rows){
    row.sourceData={version:'public-source-fields-v1',method:'ecics-ris',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:row.record}],detailStatus:'completed',issues:[]};delete row.record;
    row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
    const previous=grouped.get(row.id);if(previous){previous.events.push(row.event);previous.documents.push(...row.documents);}else grouped.set(row.id,{...row,events:[row.event]});
   }
   held[m.url]=newMark({...m,date:parsed.date||m.date},print,now,rows.length);done++;
  }catch(e){if(/Zeitbudget/.test(e.message))unread++;else if(/HTTP 404/.test(e.message)||m.date>today&&/HTTP 403/.test(e.message))warnings.push('Sitzung ohne Seite: '+m.date+' '+m.body);else issues.push(m.url+': '+e.message);}
  onProgress(source.id+': '+count+'/'+meetings.size+' Sitzungen');
 },2);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Sitzung':'Sitzungen'} noch nicht vollständig gelesen.`);
 if(limited)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),identityLinks:[],documents:[...new Map([...row.documents,{title:'Tagesordnung',url:last.url,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche Seiten des Ratsinformationssystems (ecics); nur der öffentliche Teil.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:meetings.size,...(empty?{meetingsWithoutAgenda:empty}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||limited?{resumable:true}:{}),...(warnings.length||part.warnings().length?{warnings:[...warnings,...part.warnings()]}:{}),sourceCount:1,quiet:topics.length===0&&unchanged===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0||empty>0),issues:topics.length||unchanged||empty?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
