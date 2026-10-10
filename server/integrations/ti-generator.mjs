import {sourceDecision} from './source-fields.mjs';
import {windowStart} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted} from './request-budget.mjs';
import {fetchText,allowed,text,decode,MAX_MEETINGS} from './sessionnet.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
import {extractText,getDocumentProxy} from 'unpdf';
import {fetchNoRedirect,SOURCE_USER_AGENT} from './no-redirect.mjs';
// Public pages of the "TI-Generator" (Town Hall Information WEB-Generator, Bartel Software Engineering): static sites
// that the Rats-Manager writes to a web host. The start page holds a menu with one entry per committee and list; the
// page's script loads each list from listen/<file> (the address of the menu entry itself answers 404). Read are the
// start page, the invitation lists (…_el_.php: every meeting with its agenda) and the decision lists ("Beschlüsse",
// …_bv_.php: vote counts and decision document per decision). Nothing else is asked; the search service is not used.
// - Only the panel "öffentliche Tagesordnung" of a meeting is read. The lists print the titles of the non-public part in
//   a panel of their own; it is skipped, and so is every decision that is not marked "öffentlicher Teil". A panel is cut
//   off at the next panel or panel heading of any class; where the public panel still holds the label or lock of
//   another agenda, the two were not told apart and no item of that meeting is taken (an issue names it).
// - The pages carry a "Stand", the time they were last written. Some installations are no longer updated: what they
//   hold is returned, the coverage names the date (sourceStand) and leaves the import open, since a long break without
//   meetings looks the same.
// - Lists whose menu entry names a period that ended before the import period ("2015 - 2022", "bis 2024") are not read.
// - Lists, meetings and decisions are joined by the number of the body in the file names (ti_<list>__<body>_el_.php),
//   not by its name: an Amt may list several bodies of one name, and the menu may name none.
/** Days without a new "Stand" after which an installation counts as no longer updated. */
export const STALE_DAYS=120;
const MORE={sbquo:',',bdquo:'„',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’',sect:'§',euro:'€',minus:'-',hellip:'…',laquo:'«',raquo:'»',deg:'°',eacute:'é',egrave:'è',aacute:'á',agrave:'à',ccedil:'ç',middot:'·',bull:'•',shy:''};
// The generator writes "&sbquo;" where a comma stands ("Bau&sbquo; Wirtschaft").
const clean=s=>text(String(s||'').replace(/&([a-z]+);/gi,(m,k)=>MORE[k]??m));
const day=value=>{const m=String(value).match(/(\d{2})\.(\d{2})\.(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:null;};
const fnv=value=>{let h=0x811c9dc5;for(const c of new TextEncoder().encode(value)){h^=c;h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,'0');};
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
// "09", "10.3." and "10.3" name the same item.
const topKey=n=>String(n).replace(/\.$/,'').split('.').map(p=>p.replace(/^0+(?=\d)/,'')).join('.');
const attr=(attributes,name)=>attributes.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,'i'))?.slice(1).find(v=>v!==undefined)||'';
const blocks=html=>String(html).split(/<div\b[^>]*?\sdata-role\s*=\s*["']collapsible["'][^>]*>/i).slice(1);
// A panel starts at its outer <div class="panel …"> or at its <div class="panel-heading …">, whatever else the class
// says; its heading ends where the collapsible body starts.
const PANEL=/<div\b[^>]*?\sclass\s*=\s*["'](?:[^"']*\s)?panel(?:-heading)?(?=[\s"'])[^"']*["'][^>]*>/i;
const HEAD_END=/<div\b[^>]*?\s(?:id\s*=\s*["'][^"']*collapse|class\s*=\s*["'](?:[^"']*\s)?panel-(?:collapse|body)\b)/i;
const LOCK=/\b(?:fa-expeditedssl|fa-lock|glyphicon-lock)\b/i;
const panels=block=>block.split(PANEL).slice(1).map(p=>{const head=p.split(HEAD_END)[0];return {heading:clean(head),locked:LOCK.test(head),body:p.slice(head.length)};});
const NONPUBLIC=/nicht\s*-?\s*öffentl|ausgeschlossen|vertraulich|geschlossene[rn]?\s+(?:Sitzung|Teil|Tagesord)/iu;
const ITEM=/<(li|a)\b([^>]*?)\stitle=["'](?:Tagesordnungspunkt[^"']*|TOP betrachten\.?)["']([^>]*)>([\s\S]*?)<\/\1>/gi;
// A list page shows its count of files ("13 Akten") or its collapsible set, also when it holds no meeting; a page that
// merely says "Akte" is not one. A list without any file says "keine Einträge vorhanden" (Amt Gartz).
const listPage=html=>/data-role\s*=\s*["']collapsible(?:set)?["']|\b\d+\s+Akten?\b|keine\s+Eintr(?:ä|&auml;)ge\s+vorhanden/i.test(html);
// Session ids (";jsessionid=…", "?PHPSESSID=…") and other additions name no other file of the static site.
const plain=address=>address.replace(/[;?#].*$/s,'');
// A document is linked by href or, on some installations, opened by onclick="window.open('listen/…pdf',…)".
const pdf=(attributes,title,source)=>{const address=plain(decode(attr(attributes,'href')||attr(attributes,'onclick').match(/window\.open\(\s*['"]([^'"]+)/)?.[1]||''));if(!/\.pdf$/i.test(address))return null;try{return {title,url:allowed(new URL(address,source.base).href,source),kind:'application/pdf'};}catch{return null;/* foreign host */}};
/** Newest "Stand" (date the pages were written) on a page, as YYYY-MM-DD. */
export function standOf(html){
 let newest=null;
 for(const m of String(html).matchAll(/Stand:(?:\s|&nbsp;)*(\d{2})\.(\d{2})\.(\d{4}|\d{2})\b/g)){const iso=`${m[3].length===2?'20'+m[3]:m[3]}-${m[2]}-${m[1]}`;if(!newest||iso>newest)newest=iso;}
 return newest;
}
/**
 * Invitation and decision lists named in the menu of the start page. Invitation lists end in _el_; the lists of papers
 * ("Sitzungsvorlagen") share the ending _bv_ with the decision lists, so the label decides. until: last year of a
 * period named in the entry ("Archiv: Einladungen 2015 - 2022"), otherwise null. group: the number of the body in the
 * file name, the same on its invitation, decision and archive lists.
 */
export function menuPages(html,source){
 const pages=new Map();
 for(const m of String(html).matchAll(/<a\s((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)){
  if(!/(?:^|\s)menu-link(?:\s|$)/.test(attr(m[1],'class')))continue;
  const href=plain(decode(attr(m[1],'href')).replace(/^\.\//,'')),label=clean(attr(m[1],'data-link')),name=clean(attr(m[1],'data-name'));
  const kind=/^ti_\d+__\d+_el_\.php$/i.test(href)?'invitations':/^ti_\d+__\d+_bv_\.php$/i.test(href)&&/Beschl(?:ü|ue)sse|Beschlossene/i.test(label)?'decisions':null;
  if(!kind)continue;
  let url;try{url=allowed(new URL('listen/'+href,source.base).href,source);}catch{continue;}
  const ended=`${name} ${label}`.match(/(?:\d{4}\s*[-–]\s*|\bbis\s+)(\d{4})\b/i)?.[1];
  const committee=name.replace(/^Archiv:?\s*/i,'').replace(/\s*(?:\d{4}\s*[-–]\s*\d{4}|(?:ab|bis)\s+\d{4})$/i,'').trim();
  if(!pages.has(url))pages.set(url,{url,kind,committee:committee==='undefined'?'':committee,group:href.match(/__(\d+)_/)[1],label,until:ended?Number(ended):null});
 }
 return [...pages.values()];
}
/**
 * Meetings of one invitation list with the items of their public agenda. agenda is null where the list shows no public
 * agenda for the meeting; restricted tells that it shows one of the non-public part. unclear: the list shows an agenda
 * that is not told apart as public (another label, or the public panel runs on into another agenda); agenda is then
 * null. A meeting has no page of its own: its address is the list with the meeting day as fragment.
 */
export function parseTiList(html,page,source){
 const meetings=[],days=new Map();
 for(const block of blocks(html)){
  const head=block.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1]||'';
  const date=day(clean(head.match(/Sitzungsdatum:([\s\S]*?)<\/p>/i)?.[1]))||day(clean(block.match(/>\s*Datum:([^<]*)/i)?.[1]));if(!date)continue;
  const heading=clean(head.replace(/<div\b[^>]*>[\s\S]*?<\/div>/gi,' ').replace(/<p\b[^>]*>[\s\S]*?<\/p>/gi,' '));
  const n=(days.get(date)||0)+1;days.set(date,n);
  let agenda=null,restricted=false,unclear=false;
  for(const panel of panels(block)){
   if(!/Tagesord/i.test(panel.heading))continue;
   if(panel.locked||NONPUBLIC.test(panel.heading)){restricted=true;continue;}
   if(!/(?<!\p{L})öffentl/iu.test(panel.heading)){unclear=true;continue;}
   // Besides its items the panel holds the column head "TOP - Betreff" only.
   const rest=panel.body.replace(ITEM,' ');
   if(/Tagesord/i.test(clean(rest))||NONPUBLIC.test(clean(rest))||LOCK.test(rest)){unclear=true;continue;}
   agenda??=[];
   for(const m of panel.body.matchAll(ITEM)){
    const spans=[...m[4].matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)].map(s=>clean(s[1]));
    const [number,title]=spans.length>1?[spans[0].replace(/^\?$/,''),spans[1]]:['',spans[0]||''];
    if(!/\p{L}{2}/u.test(title))continue;
    const reference=spans.slice(2).join(' ').match(/Vorlage-Nr\.?:?\s*(.+?)\s*(?:\bmit\s+\d+\s+Anlagen?\b|\[|\(|$)/i)?.[1]||'';
    const document=m[1].toLowerCase()==='a'&&pdf(m[2]+m[3],reference?'Vorlage '+reference:`Unterlage zu TOP ${number}`.trim(),source);
    agenda.push({number,title,reference,documents:document?[document]:[]});
   }
  }
  const committee=page.committee||heading.replace(/^\d+\.\s*/,'').replace(/^(?:öffentliche\s+)?(?:Sitzung|Beratung)\s+(?:der|des)\s+/i,'').replace(/\s*(?:am\s+)?\d{2}\.\d{2}\.\d{4}.*$/,'')||'Öffentliche Sitzung';
  meetings.push({url:`${page.url}#sitzung-${date}${n>1?'-'+n:''}`,date,committee,group:page.group??'',heading,agenda:unclear?null:agenda,restricted,unclear});
 }
 return {stand:standOf(html),meetings};
}
/** Decisions of one decision list that were taken in the public part: meeting day, item, paper, votes, document. */
export function parseTiDecisions(html,source){
 const decisions=[];
 for(const block of blocks(html)){
  const panel=panels(block).find(p=>/Angaben zur Beschlussfassung/i.test(p.heading))?.body;if(!panel)continue;
  const field=name=>clean(panel.match(new RegExp(`>\\s*${name}:([\\s\\S]*?)</div>`,'i'))?.[1]);
  const top=field('TOP'),date=day(field('Sitzungsdatum'));
  if(!date||!/\(\s*öffentlicher\s+Teil\s*\)/i.test(top)||/nicht\s*-?\s*öffentl/i.test(top))continue;
  const decision=field('Beschluss-Nr\\.'),count=name=>field(name).match(/^\d+/)?.[0]??null;
  const link=block.match(/<a\b([^>]*?)\stitle=["']Dokument anzeigen\.?["']([^>]*)>/i),document=link&&pdf(link[1]+link[2],('Beschluss '+decision).trim(),source);
  decisions.push({date,number:top.replace(/\(.*$/,'').trim(),reference:field('Vorlage-Nr\\.'),decision,votes:{yes:count('Ja-Stimmen'),no:count('Nein-Stimmen'),abstentions:count('Stimm-Enthaltungen')},document:document||null});
 }
 return decisions;
}
/**
 * Lists of installations without invitation lists (Amt Gartz, VG Vorharz): the lists of papers ("Sitzungsvorlagen",
 * _bv_) and of notices ("Bekanntmachungen", _bk_; a PDF per meeting with its agenda). Same fields as menuPages.
 */
export function extraPages(html,source){
 const pages=new Map();
 for(const m of String(html).matchAll(/<a\s((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)){
  if(!/(?:^|\s)menu-link(?:\s|$)/.test(attr(m[1],'class')))continue;
  const href=plain(decode(attr(m[1],'href')).replace(/^\.\//,'')),label=clean(attr(m[1],'data-link')),name=clean(attr(m[1],'data-name'));
  const kind=/^ti_\d+__\d+_bv_\.php$/i.test(href)&&/^Sitzungsvorlagen$/i.test(label)?'papers':/^ti_\d+__\d+_bk_\.php$/i.test(href)&&/^(?:Archiv:?\s*)?Bekanntmachungen?\b/i.test(label)&&!/^Bekanntmachungen der /i.test(name)?'notices':null;
  if(!kind)continue;
  let url;try{url=allowed(new URL('listen/'+href,source.base).href,source);}catch{continue;}
  const ended=`${name} ${label}`.match(/(?:\d{4}\s*[-–]\s*|\bbis\s+)(\d{4})\b/i)?.[1];
  if(!pages.has(url))pages.set(url,{url,kind,committee:name.replace(/^Archiv:?\s*/i,'').trim(),group:href.match(/__(\d+)_/)[1],label,until:ended?Number(ended):null});
 }
 return [...pages.values()];
}
/**
 * Public agenda items from the list of papers: every paper names the meeting it is dealt with in the body of the list
 * ("Angaben zur Beratung im aktuellen Gremium": meeting, day, item number and "öffentlicher Teil"). Papers of the
 * non-public part are skipped. Meetings are made of these items; a meeting holds only the papers published so far.
 */
export function parseTiPapers(html,page,source){
 const found=new Map();
 for(const block of blocks(html)){
  const panel=panels(block).find(p=>/Angaben zur Beratung/i.test(p.heading))?.body;if(!panel)continue;
  const field=name=>clean(panel.match(new RegExp(`>\\s*${name}:([\\s\\S]*?)</div>`,'i'))?.[1]);
  const top=field('TOP'),date=day(field('Sitzungsdatum'));
  if(!date||!/\(\s*öffentlicher\s+Teil\s*\)/i.test(top)||/nicht\s*-?\s*öffentl/i.test(top))continue;
  const head=block.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1]||'';
  const title=clean(head.replace(/<div\b[^>]*>[\s\S]*?<\/div>/gi,' '));if(!/\p{L}{2}/u.test(title))continue;
  const reference=clean(block.match(/>\s*Vorlage Nr\.:?([^<]*)</i)?.[1]).trim();
  const documents=[];
  for(const a of block.matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi)){
   const kind=/title=["']Dokument anzeigen/i.test(a[1])?'paper':/title=["']Anlage betrachten/i.test(a[1])?'annex':null;if(!kind)continue;
   const d=pdf(a[1],kind==='paper'?(reference?'Vorlage '+reference:'Vorlage'):clean(a[2].replace(/<span\b[\s\S]*$/i,'')),source);if(d)documents.push(d);
  }
  const number=top.replace(/\(.*$/,'').trim(),beratung=field('Beratung'),key=date;
  if(!found.has(key))found.set(key,{url:`${page.url}#sitzung-${date}`,date,committee:page.committee||beratung,group:page.group??'',heading:beratung||page.committee,agenda:[],restricted:false,unclear:false});
  found.get(key).agenda.push({number,title,reference,documents});
 }
 for(const m of found.values())m.agenda.sort((a,b)=>topKey(a.number).localeCompare(topKey(b.number),'de',{numeric:true}));
 return {stand:standOf(html),meetings:[...found.values()]};
}
/** Notices of the list of announcements that name a meeting: title, number and the PDF. */
export function parseTiNotices(html,page,source){
 const notices=[];
 for(const block of blocks(html)){
  const head=block.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1]||'';
  const title=clean(head.replace(/<div\b[^>]*>[\s\S]*?<\/div>/gi,' '));if(!/Sitzung/i.test(title))continue;
  const link=block.match(/<a\b([^>]*?)\stitle=["']Dokument anzeigen\.?["']([^>]*)>/i),document=link&&pdf(link[1]+link[2],'Bekanntmachung zur Sitzung',source);if(!document)continue;
  notices.push({title,date:day(title),number:title.match(/(\d+)\.\s*Sitzung/i)?.[1]||'',document,page:page.url});
 }
 return notices;
}
/**
 * Items of the public part from the text of a notice ("Am 28.09.2026, 18.30 Uhr, findet eine Sitzung … statt",
 * "Öffentlicher Teil: Vorlagen-Nr.", "01. Eröffnung …", reference "LP VIII 26-163", "Nichtöffentlicher Teil").
 * date null where the text names none; items empty where the notice shows no public part.
 */
export function parseTiNoticeText(raw){
 const body=String(raw).replace(/H\s?i\s?n\s?w\s?e\s?i\s?s\s?:[\s\S]*?bekanntmachungen\.html/gi,'\n').replace(/\r/g,'');
 const date=day(body.match(/\bAm\s+(\d{1,2}\.\d{1,2}\.\d{4})/i)?.[1]||'');
 const start=body.search(/(?<!\p{L})Öffentlicher\s+Teil\s*:?/iu);if(start<0)return {date,items:[]};
 let part=body.slice(start).replace(/^Öffentlicher\s+Teil\s*:?[^\n]*\n/i,'');
 const end=part.search(/Nicht\s*-?\s*öffentlicher\s+Teil/i);if(end>=0)part=part.slice(0,end);
 const items=[];let current=null;
 for(const line of part.split('\n').map(l=>l.trim()).filter(Boolean)){
  const m=line.match(/^(\d{1,2})\.\s+(\S.*)$/);
  if(m&&(!current||Number(m[1])===Number(current.number)+1||items.length===0)){current={number:m[1].padStart(2,'0'),text:m[2]};items.push(current);}
  else if(current)current.text+=' '+line;
 }
 return {date,items:items.map(i=>{
  const ref=i.text.match(/\s+((?:[A-ZÄÖÜ]{1,4}\s+[IVX]+\s+\d{2}-\d{2,4}|\d{3,4}\/\d{2}))\s*$/);
  const title=clean((ref?i.text.slice(0,ref.index):i.text).replace(/\s+/g,' '));
  return {number:i.number,title,reference:ref?.[1]||'',documents:[]};
 }).filter(i=>/\p{L}{2}/u.test(i.title))};
}
/**
 * Recognises a page of the generator (start page): {adapter, method, base, invitationLists, stand} or null.
 * base is the folder of the page on https; invitationLists counts the invitation lists in its menu (0: the site holds
 * no meetings, e.g. a site of announcements only); stand is the date the site was last written.
 * The generator names itself in the meta line "generator"; without it, the credit "TI-Generator … Bartel Software"
 * counts only beside a menu of TI lists. A town's page that merely mentions or links the system is not one.
 */
export function detectTiGenerator(url,html){
 const page=String(html||'');
 let u;try{u=new URL(url);}catch{return null;}
 if(!/^https?:$/.test(u.protocol))return null;
 // A last part without file ending is the folder itself (…/ti-1 for …/ti-1/).
 const path=/\.(?:php\d?|s?html?|aspx?|jsp)$/i.test(u.pathname.split('/').pop())?u.pathname:u.pathname.replace(/\/?$/,'/');
 const base=`https://${u.host}${path.replace(/[^/]*$/,'').replace(/listen\/$/i,'')}`,lists=menuPages(page,{base});
 const meta=[...page.matchAll(/<meta\s((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)].some(m=>/^generator$/i.test(attr(m[1],'name'))&&/Town Hall Information WEB-Generator|TI-Generator/i.test(attr(m[1],'content')));
 if(!meta&&!(/TI-Generator/.test(page)&&/Bartel Software/i.test(page)&&lists.length))return null;
 return {adapter:'ti-generator',method:'scraper',base,invitationLists:lists.filter(p=>p.kind==='invitations').length,stand:standOf(page)};
}
/** Text of a notice (PDF of the site, at most 3 MB and 12 pages), read in memory; never kept. */
export async function readNoticePdf(url,source){
 const r=await fetchNoRedirect(allowed(url,source),{signal:AbortSignal.timeout(30000),headers:{'User-Agent':SOURCE_USER_AGENT}});
 if(!r.ok){await r.body?.cancel();throw Error('Quelle antwortet mit HTTP '+r.status);}
 const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.byteLength>3e6)throw Error('Quelldokument zu groß');
 const pdf=await getDocumentProxy(bytes,{isEvalSupported:false,verbosity:0});
 try{if(pdf.numPages>12)throw Error('Quelldokument zu umfangreich');return (await extractText(pdf,{mergePages:true})).text;}finally{await (pdf.destroy?pdf.destroy():pdf.loadingTask?.destroy?.());}
}
const votes=v=>v.yes===null?'':` (${v.yes} Ja-Stimmen, ${v.no??0} Nein-Stimmen, ${v.abstentions??0} Enthaltungen)`;
function agendaRows(m,source,now,decided){
 const ahead=m.date>now.toISOString().slice(0,10);
 return m.agenda.map(item=>{
  const byPaper=item.reference&&decided.get([m.group,m.date,'r',slug(item.reference)].join('|'));
  const byItem=!byPaper&&item.number&&decided.get([m.group,m.date,'n',topKey(item.number)].join('|'));
  // A decision list names its paper; an item that names another paper is not the same item.
  const d=ahead?null:byPaper||(byItem&&(!byItem.reference||!item.reference||slug(byItem.reference)===slug(item.reference))?byItem:null);
  // The list gives the vote counts only; whether the motion was carried is stated in the decision document.
  const result=d?`Beschluss ${d.decision}${votes(d.votes)}`.trim():'';
  const status=ahead?(item.reference?'consulting':'announced'):'unknown';
  const description=ahead?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':d?`In der Beschlussliste verzeichnet: ${result}. Das Ergebnis nennt das Beschlussdokument.`:'Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Abschnitt nicht belegt.';
  const id=item.reference&&slug(item.reference)?`${source.id}-vo-nr-${slug(item.reference)}`:`${source.id}-top-${m.date.replace(/-/g,'')}-${fnv([m.committee,item.number,item.title].join('|'))}`;
  return {id,title:item.title,reference:item.reference,sourceUrl:m.url,identityLinks:[],status,documents:[...item.documents,...(d?.document?[d.document]:[])],
   event:{date:m.date,committee:m.committee,status,description,result,url:m.url,publicEvidence:'Abschnitt „öffentliche Tagesordnung“ der Einladung'},agenda:{number:item.number,decision:d}};
 });
}
// marks (optional): what earlier imports read completely, see meeting-marks.mjs. Every list is read in each import (a
// list holds all its meetings); a meeting whose items and decisions are unchanged yields no reports again.
async function collectOneTi(source,{now=new Date(),get=fetchText,getPdf=readNoticePdf,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks}={}){
 get=budgeted(get,maxDurationMs,2);
 // Meetings from the start of the period up to the end of the next month, as with SD.NET.
 const from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10),until=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+2,0)).toISOString().slice(0,10),issues=[],warnings=[];
 const meetings=new Map(),decided=new Map(),incomplete=new Set();let pages=[],unread=0,stand=null,lists=0;
 const later=s=>{if(s&&(!stand||s>stand))stand=s;};
 const read=async(url,what)=>{try{return await get(url,source);}catch(e){if(/Zeitbudget/.test(e.message))unread++;else issues.push(what+': '+e.message);return null;}};
 const start=await read(source.base,'Startseite');
 let extra=[];
 if(start!==null){
  if(!detectTiGenerator(source.base,start))issues.push('Startseite: Unbekanntes Format, kein TI-Generator');
  else{
   later(standOf(start));pages=menuPages(start,source).filter(p=>!p.until||p.until>=from.getUTCFullYear());
   // Without invitation lists the meetings are made of the papers (Amt Gartz) or of the notices (VG Vorharz).
   if(!pages.some(p=>p.kind==='invitations')){
    extra=extraPages(start,source).filter(p=>!p.until||p.until>=from.getUTCFullYear());
    const papers=extra.filter(p=>p.kind==='papers');if(papers.length)extra=papers;
    if(!extra.length)issues.push('Startseite: keine Einladungslisten im Menü');
   }
  }
 }
 // 1. Invitation lists: every meeting of a committee with its public agenda.
 const within=list=>list.meetings.filter(m=>m.date>=fromDay&&m.date<=until);
 const found=await parallel([...pages.filter(p=>p.kind==='invitations'),...extra],async p=>{
  const html=await read(p.url,`${p.committee||'Gremium'}, ${p.label}`);if(html===null)return [];
  if(!listPage(html)){issues.push(`${p.committee||'Gremium'}, ${p.label}: Unbekanntes Format der Liste`);return [];}
  if(p.kind==='notices'){
   const out=[];later(standOf(html));
   for(const n of parseTiNotices(html,p,source)){
    if(n.date&&(n.date<fromDay||n.date>until))continue;
    let read2;try{read2=parseTiNoticeText(await getPdf(n.document.url,source));}catch(e){if(/Zeitbudget/.test(e.message))unread++;else issues.push(`${n.title}: ${e.message}`);continue;}
    const date=read2.date||n.date;if(!date||date<fromDay||date>until)continue;
    const heading=n.title.replace(/^Bekanntmachung\s+(?:zur|der)\s+/i,'');
    out.push({url:`${p.url}#sitzung-${date}`,date,committee:p.committee,group:p.group,heading,agenda:read2.items.length?read2.items.map(i=>({...i,documents:[n.document]})):null,restricted:!read2.items.length,unclear:false});
   }
   onProgress(`${source.id}: ${++lists} Listen`);return out;
  }
  const list=p.kind==='papers'?parseTiPapers(html,p,source):parseTiList(html,p,source);later(list.stand);onProgress(`${source.id}: ${++lists} Listen`);
  return within(list);
 },2);
 // A meeting on a current list and on an archive list of its body keeps the address of the list named first in the menu.
 for(const m of found.flat()){const key=[m.group,m.date,m.heading].join('|');if(!meetings.has(key))meetings.set(key,m);}
 // 2. Decision lists, only of bodies with past meetings in the period.
 const held={},needed=new Set([...meetings.values()].filter(m=>m.date<=today&&m.agenda?.length).map(m=>m.group));
 await parallel(pages.filter(p=>p.kind==='decisions'&&needed.has(p.group)),async p=>{
  const what=`${p.committee||'Gremium'}, ${p.label}`,html=await read(p.url,what);if(html===null){incomplete.add(p.group);return;}
  if(!listPage(html)){issues.push(what+': Unbekanntes Format der Liste');incomplete.add(p.group);return;}
  later(standOf(html));
  for(const d of parseTiDecisions(html,source)){const e={...d,page:p.url};if(d.reference)decided.set([p.group,d.date,'r',slug(d.reference)].join('|'),e);if(d.number)decided.set([p.group,d.date,'n',topKey(d.number)].join('|'),e);}
 },2);
 const grouped=new Map();let count=0,beyond=0,unchanged=0,done=0,upcoming=0;
 for(const m of [...meetings.values()].sort((a,b)=>b.date.localeCompare(a.date))){
  // An announced meeting without agenda has nothing public yet; a past one is a remark. A meeting with an agenda of the
  // non-public part only has no public item. An agenda not told apart as public is not taken, and that is an issue.
  if(m.unclear){issues.push('Tagesordnung nicht eindeutig als öffentlich erkennbar, nicht übernommen: '+m.url);continue;}
  if(!m.agenda){if(m.date>today)upcoming++;else if(!m.restricted)warnings.push('Sitzung ohne veröffentlichte Tagesordnung: '+m.url);continue;}
  const known=usableMark(marks,m,now);
  if(known?.trusted){held[m.url]=marks.known[m.url];unchanged++;continue;}
  if(count>=MAX_MEETINGS){beyond++;continue;}count++;
  const rows=agendaRows(m,source,now,decided);
  const print=(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.reference,r.agenda.number,r.event.result,r.documents.map(d=>d.url)])))).slice(0,16);
  if(known?.print===print){held[m.url]=marks.known[m.url];unchanged++;continue;}
  for(const row of rows){
   const {number,decision}=row.agenda;delete row.agenda;
   row.sourceData={version:'public-source-fields-v1',method:'ti-generator',fetchedAt:now.toISOString(),records:[{kind:'agenda',url:m.url,fields:{reference:row.reference,title:row.title,number}},...(decision?[{kind:'decision',url:decision.page,fields:{decision:decision.decision,number:decision.number,reference:decision.reference,...decision.votes}}]:[])],detailStatus:'completed',issues:[]};
   row.event.attendance={status:'not_collected',sourceUrl:m.url,fetchedAt:now.toISOString(),people:[]};row.event.decision=sourceDecision(row.event);
   const previous=grouped.get(row.id);
   if(!previous)grouped.set(row.id,{...row,events:[row.event]});
   else{previous.documents.push(...row.documents);if(!previous.events.some(e=>e.url===m.url))previous.events.push(row.event);}
  }
  // Without its body's decision list a meeting is not read completely; the next import reads it again.
  if(!incomplete.has(m.group)){held[m.url]=newMark(m,print,now,rows.length);done++;}
 }
 // A site not written for so long may be abandoned or merely without meetings; the pages do not tell, so the import
 // stays open and the issue says only what is known.
 if(stand&&now.getTime()-Date.parse(stand+'T00:00:00Z')>STALE_DAYS*86400000)issues.push(`Quelle seit Stand ${stand.split('-').reverse().join('.')} nicht aktualisiert; ob es seither Sitzungen gab, ist dort nicht zu erkennen.`);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Seite':'Seiten'} noch nicht gelesen.`);
 if(beyond)issues.push('Sitzungslimit erreicht; weiterer Import erforderlich.');
 const topics=[];
 for(const row of grouped.values()){
  row.events.sort((a,b)=>a.date.localeCompare(b.date));const last=row.events.at(-1);
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),documents:[...new Map([...row.documents,{title:'Öffentliche Tagesordnung',url:row.sourceUrl,kind:'html'}].map(d=>[d.url,d])).values()]};delete t.event;
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Öffentliche Seite des TI-Generators; nur Tagesordnungspunkte der öffentlichen Tagesordnung.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};topics.push(t);
 }
 const listed=meetings.size-upcoming;
 // Unchanged meetings are a successful reading: their reports are in the database already.
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:listed,...(upcoming?{upcomingWithoutAgenda:upcoming}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||beyond?{resumable:true}:{}),...(warnings.length?{warnings}:{}),...(stand?{sourceStand:stand}:{}),sourceCount:1,quiet:listed===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}

/**
 * An Amt may publish one generator site per municipality (Amt Gartz (Oder): ti-1 for the Amt, ti-2 … ti-6 for its
 * municipalities). An entry with `bases` (further folders on the same host) reads every site and joins the results;
 * the coverage is complete only where all sites are.
 */
export async function collectTiGenerator(source,options={}){
 const bases=[source.base,...(Array.isArray(source.bases)?source.bases:[])];
 if(bases.length===1)return collectOneTi(source,options);
 const host=new URL(source.base).origin,parts=[];
 for(const base of bases){
  if(new URL(base).origin!==host)continue;
  parts.push({base,result:await collectOneTi({...source,base,bases:undefined},options)});
 }
 const topics=new Map(),marks={},issues=[],warnings=[];let readMeetings=0,meetings=0,unchanged=0,upcoming=0,stand=null,resumable=false,quiet=true,complete=true;
 for(const {base,result} of parts){
  for(const t of result.topics){
   const known=topics.get(t.id);
   if(!known)topics.set(t.id,t);
   else{known.events=[...known.events,...t.events].sort((a,b)=>a.date.localeCompare(b.date));known.documents=[...new Map([...known.documents,...t.documents].map(d=>[d.url,d])).values()];}
  }
  Object.assign(marks,result.marks);readMeetings+=result.readMeetings||0;
  const c=result.coverage,label=new URL(base).pathname.replace(/^\/|\/$/g,'');
  meetings+=c.meetings||0;unchanged+=c.unchangedMeetings||0;upcoming+=c.upcomingWithoutAgenda||0;resumable||=!!c.resumable;quiet&&=!!c.quiet;complete&&=!!c.complete;
  if(c.sourceStand&&(!stand||c.sourceStand>stand))stand=c.sourceStand;
  for(const i of c.issues||[])if(!/^Noch keine Artikel erfolgreich erfasst\.$/.test(i))issues.push(`${label}: ${i}`);
  for(const w of c.warnings||[])warnings.push(w);
 }
 const first=parts[0].result.coverage,list=[...topics.values()];
 // A site without meetings is no gap as long as another one holds reports; with none at all the usual hint stays.
 if(!list.length&&!unchanged)issues.push('Noch keine Artikel erfolgreich erfasst.');
 return {topics:list,marks,readMeetings,coverage:{...first,meetings,...(upcoming?{upcomingWithoutAgenda:upcoming}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(resumable?{resumable:true}:{}),...(warnings.length?{warnings}:{}),...(stand?{sourceStand:stand}:{}),sourceCount:parts.length,quiet:quiet&&issues.length===0,complete:issues.length===0&&(list.length>0||unchanged>0),issues}};
}
