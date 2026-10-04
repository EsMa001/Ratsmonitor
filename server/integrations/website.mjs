import {extractText,getDocumentProxy} from 'unpdf';
import {sourceDecision,DECIDING_BODY} from './source-fields.mjs';
import {windowStart} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted,isRejectionPage,REFUSED} from './request-budget.mjs';
import {SOURCE_USER_AGENT} from './no-redirect.mjs';
import {parseRobots,robotsAllow} from './robots.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
import {htmlToLines,pdfLines,normalizeLine,parseSessionText,isSpecialPurposeBody,isNonPublicText,composeUmlauts} from './website-text.mjs';
import {documentLinks,sessionScore,SESSION_THRESHOLD,paginationLinks,parseFeed,parseIcs,parseSitemap,wpEndpoints,parseWpPosts,parseWpMedia,jsonLdEvents,isRisLink,isSearchLink} from './website-feeds.mjs';
// Reader "website": what a municipality without a council system publishes on its own website about the meetings of
// its bodies — notices with agenda (every Land requires them), reports and minutes, its gazette as PDF, and the outputs
// its CMS offers anyway (RSS/Atom, iCal, WordPress REST, JSON-LD events, sitemap.xml). The catalog entry names the pages
// and feeds (scripts/source-discovery/website.mjs finds them); this reader guesses no addresses.
// - Only the site itself: https on the origin of base and of alsoFrom (same registrable domain). Redirects are followed
//   by hand and only within those origins; hosts of publishers, cloud storage and share services are never asked.
// - robots.txt of each origin is read before its first other request (RFC 9309). 4xx: no robots.txt, all allowed;
//   5xx or no answer: nothing is read from that origin. Forms, the site's search, logins and browser disguise are never
//   used; a refused request is not repeated except by the budget's own retry of transient errors, and after HTTP 403
//   or 429 that origin is not asked again in this import. Pages of a council information system are never read, also
//   not on the town's own domain (isRisLink): an area may be here because its RIS forbids programs.
// - Only items of the public part (website-text.mjs decides). A document whose link text, title or address names the
//   non-public part is not read at all. Where the public part is not evident, nothing of the meeting is taken.
// - Load: at most two requests at a time and fixed limits per import (LIMITS); what is left is read by the next import.
export const WEBSITE_READER_NAME='Website der Kommune (öffentliche Bekanntmachungen)';
/** Product tokens our programs announce in robots.txt groups. */
export const ROBOT_TOKENS=['vorort-politicaltopics','ratsmonitor-sourcecatalog'];
export const LIMITS=Object.freeze({listPages:12,followPages:3,feeds:5,ics:3,wpPages:3,sitemaps:2,sitemapUrls:30,documents:60,unparsed:20,unreadable:20,pdfBytes:12e6,htmlBytes:4e6,pdfPages:150});
/** Key under which collectWebsite hands its robots.txt check to fetchSiteText/fetchSiteBytes (also for redirect targets). */
export const ROBOTS=Symbol('robots');
export const ROBOTS_BLOCKED='Adresse laut robots.txt ausgeschlossen, nicht abgerufen';
const DENIED='Nicht freigegebene Quelladresse';
const NOT_READ='Adresse eines Ratsinformationssystems, der Suche oder des nichtöffentlichen Teils, nicht abgerufen';
// The host without "www.": alsoFrom must be this host, a subdomain of it, or a host it is a subdomain of.
const siteHost=host=>host.toLowerCase().replace(/^www\./,'');
const related=(a,b)=>a===b||a.endsWith('.'+b)||b.endsWith('.'+a);
function origins(source){
 let base;try{base=new URL(source.base);}catch{return [];}
 const out=base.protocol==='https:'?[base.origin]:[];
 for(const extra of source.alsoFrom||[]){try{const u=new URL(extra);if(u.protocol==='https:'&&related(siteHost(u.hostname),siteHost(base.hostname))&&!out.includes(u.origin))out.push(u.origin);}catch{/* not an address */}}
 return out;
}
/** The address without fragment if it is https on the origin of base or of alsoFrom and carries no credentials. */
export function siteAllowed(url,source){
 let u;try{u=new URL(url);}catch{throw Error(DENIED);}
 if(u.protocol!=='https:'||u.username||u.password||!origins(source).includes(u.origin))throw Error(DENIED);
 u.hash='';return u.href;
}
async function bodyBytes(r,limit){
 if(Number(r.headers.get('content-length'))>limit){await r.body?.cancel();throw Error('Quelldokument zu groß');}
 if(!r.body){const b=new Uint8Array(await r.arrayBuffer());if(b.byteLength>limit)throw Error('Quelldokument zu groß');return b;}
 // Read in parts so that a server without Content-Length cannot make us hold more than the limit.
 const reader=r.body.getReader(),parts=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('Quelldokument zu groß');}parts.push(value);}
 const out=new Uint8Array(size);let at=0;for(const p of parts){out.set(p,at);at+=p.byteLength;}return out;
}
/** Text of bytes in the encoding the answer or the page names (Latin-1/Windows-1252 or UTF-8). */
export function decodeText(bytes,type=''){
 const probe=new TextDecoder().decode(bytes.slice(0,2000)),latin=/(?:charset|encoding)\s*=\s*["']?(?:iso-8859-1|iso-8859-15|latin-?1|windows-1252)/i;
 return new TextDecoder(latin.test(type)||!/charset\s*=\s*["']?utf-?8/i.test(type)&&latin.test(probe)?'windows-1252':'utf-8').decode(bytes);
}
async function fetchSite(url,source,timeoutMs,request,accept,limit){
 const deadline=Date.now()+timeoutMs,seen=new Set(),gate=source[ROBOTS];let next=siteAllowed(url,source);
 for(let hop=0;hop<=3;hop++){
  if(seen.has(next))throw Error('Wiederholte Weiterleitung der Quelle');seen.add(next);
  // Every hop, also a redirect target, must be a path robots.txt leaves open.
  if(gate&&!await gate(next))throw Error(ROBOTS_BLOCKED);
  const remaining=deadline-Date.now();if(remaining<=0)throw Error('Zeitbudget der Quelle erreicht');
  const r=await request(next,{redirect:'manual',signal:AbortSignal.timeout(remaining),headers:{'User-Agent':SOURCE_USER_AGENT,Accept:accept}});
  if([301,302,303,307,308].includes(r.status)||r.type==='opaqueredirect'){
   const location=r.headers.get('location');await r.body?.cancel();
   if(!location)throw Error('Weiterleitung ohne Zieladresse');
   if(hop===3)throw Error('Weiterleitungslimit der Quelle erreicht');
   next=siteAllowed(new URL(location,next).href,source);
   // A redirect target is checked as a link is: never the non-public part, an RIS or the site's search.
   if(closed('',next)||isRisLink(next)||isSearchLink(next))throw Error(NOT_READ);
   continue;
  }
  if(!r.ok){await r.body?.cancel();throw Error('Quelle antwortet mit HTTP '+r.status);}
  // A page is read up to the limit of pages also where a document was asked for.
  const type=r.headers.get('content-type')||'',bytes=await bodyBytes(r,/html|xml|json|text\//i.test(type)?Math.min(limit,LIMITS.htmlBytes):limit);
  return {bytes,type};
 }
}
/** A page, feed, calendar or API answer of the site as text (at most 4 MB). */
export async function fetchSiteText(url,source,timeoutMs=20000,request=fetch){
 const {bytes,type}=await fetchSite(url,source,timeoutMs,request,'text/html,application/xhtml+xml,application/xml,application/rss+xml,application/atom+xml,text/calendar,application/json,text/plain',LIMITS.htmlBytes);
 const text=decodeText(bytes,type);
 // A firewall's rejection page is no content; it counts as a temporary refusal.
 if(isRejectionPage(text))throw Error(REFUSED);
 return text;
}
/** A document of the site as bytes with its content type (at most 12 MB): {bytes, type}. */
export async function fetchSiteBytes(url,source,timeoutMs=30000,request=fetch){
 const got=await fetchSite(url,source,timeoutMs,request,'application/pdf,text/html;q=0.9,*/*;q=0.5',LIMITS.pdfBytes);
 if(/html|text\/plain/i.test(got.type)&&got.bytes.byteLength<8000&&isRejectionPage(decodeText(got.bytes,got.type)))throw Error(REFUSED);
 return got;
}
// The document proxy of the current PDF library has no destroy(); its loading task releases the document.
const release=pdf=>pdf.destroy?pdf.destroy():pdf.loadingTask?.destroy?.();
/**
 * Text of a PDF as in documents.mjs (pages joined by line breaks). pdf.js folds runs of spaces into one, so a
 * letter-spaced heading ("N i c h t ö f f e n t l i c h e r   T e i l") arrives as one run of single letters; the
 * parser reads it without spaces (website-text.mjs: closedLine, NONPUBLIC_WORDS).
 */
export async function readPdfText(bytes){
 const pdf=await getDocumentProxy(bytes,{isEvalSupported:false});
 try{if(pdf.numPages>LIMITS.pdfPages)throw Error('Dokument zu umfangreich');const {text}=await extractText(pdf,{mergePages:true});return text;}
 finally{await release(pdf);}
}
/**
 * robots.txt of each origin of the site, read once through get (status in the error message: "Quelle antwortet mit
 * HTTP 404"). The robots.txt of base is read at once, that of another origin before its first address is checked.
 * Returns allows(url) → Promise<boolean>; allows.issues names origins that could not be checked.
 */
export async function robotsGate(get,source){
 const files=new Map(),issues=[];
 const load=origin=>{
  if(!files.has(origin))files.set(origin,(async()=>{
   try{return parseRobots(await get(origin+'/robots.txt',source));}
   catch(e){
    const status=Number(String(e?.message).match(/HTTP (\d{3})/)?.[1]);
    // 4xx: there is no robots.txt, all is allowed. A refusal (429), a server error or no answer: not known, nothing read.
    if(status>=400&&status<500&&status!==429)return [];
    issues.push(`robots.txt von ${origin} nicht lesbar (${e?.message}); von dort wird nichts gelesen.`);return null;
   }
  })());
  return files.get(origin);
 };
 const allows=async url=>{let u;try{u=new URL(url);}catch{return false;}const groups=await load(u.origin);return groups!==null&&robotsAllow(groups,u.pathname+u.search,ROBOT_TOKENS);};
 allows.issues=issues;
 try{await load(new URL(source.base).origin);}catch{/* base is checked by siteAllowed */}
 return allows;
}

const fnv=value=>{let h=0x811c9dc5;for(const c of new TextEncoder().encode(value)){h^=c;h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,'0');};
const fold=s=>composeUmlauts(s).toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
const slug=s=>fold(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const words=s=>' '+fold(s).replace(/[^a-z0-9]+/g,' ').trim()+' ';
const safeDecode=s=>{try{return decodeURIComponent(s);}catch{return s;}};
const ddmmyyyy=iso=>iso.split('-').reverse().join('.');
const closed=(label,url)=>isNonPublicText(label||'')||isNonPublicText(url||'')||isNonPublicText(safeDecode(url||''));
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
// Date and kind of one address with its text, read as documentLinks reads a link.
const asLink=(url,label)=>documentLinks(`<a href="${escape(url)}">${escape(label||'')}</a>`,url)[0]||null;
// Letter-spaced headings with single spaces are joined into one word ("NichtöffentlicherTeil"); the break before the
// part's noun is put back so that the heading is recognised.
const PART_NOUN=/((?:nicht\s*-?\s*)?öffentliche[rnms]?)(Teil|Sitzung|Sitzungsteil|Tagesordnung|Beratung|Punkte)(?!\p{L})/giu;
const repair=line=>{const l=normalizeLine(line);return l.length>90?l:l.replace(PART_NOUN,'$1 $2').replace(/^unterausschlu(ss|ß)deröffentlichkeit$/iu,'Unter Ausschluss der Öffentlichkeit');};
const PLACE_KIND=/^(?:Gemeinde|Stadt|Markt|Marktgemeinde|Hansestadt|Große Kreisstadt|Kreisstadt|Ortsgemeinde|Samtgemeinde|Verbandsgemeinde|Amt|Landkreis|Kreis)\s+/i;

// Status of an item: ahead → announced; an outcome of minutes; only a deciding body decides, a committee's approval or
// rejection is its recommendation (as the other readers have it).
function itemStatus(item,meeting,today){
 if(meeting.date>today)return 'announced';
 if(meeting.kind!=='minutes'||!item.status)return 'unknown';
 return (item.status==='approved'||item.status==='rejected')&&!DECIDING_BODY.test(meeting.committee)?'recommended':item.status;
}
// Bodies that are not the area's own: a special-purpose association, a county body on a town's site, an association's
// assembly on a member's site, the council of another town. The head of the meeting (its first lines) counts, not only
// the body's name ("Umweltausschuss des Kreistages", "Werkausschuss des Abwasserverbandes").
const ASSOCIATION=/Verwaltungsgemeinschaft|Verwaltungsverband|Gemeindeverwaltungsverband|Verbandsgemeinde|Samtgemeinde|(?<!\p{L})Amt(?!\p{L})/u;
const COUNTY_HEAD=/(?<!\p{L})(?:des|der|beim)\s+(?:Kreistag(?:e?s)?|Landkreis(?:es)?|Kreis(?:es)?|Bezirkstag(?:e?s)?)(?!\p{L})/u;
const TOWN_COUNCIL=/^(?:Gemeinderat|Stadtrat|Marktgemeinderat|Marktrat|Gemeindevertretung|Stadtvertretung|Stadtverordnetenversammlung)\s+(\p{Lu}.*)$/u;
function foreignBody(m,committee,source,names){
 const head=String(m.context||'');
 if(isSpecialPurposeBody(m.committee)||isSpecialPurposeBody(head))return 'Zweckverband';
 const association=ASSOCIATION.test(source.name||'');
 if(!association&&(/^(?:Verbandsversammlung|Gemeinschaftsversammlung)(?!\p{L})/u.test(committee)||/Verwaltungsgemeinschaft|\p{L}*verband(?:e?s)?(?!\p{L})/u.test(head)))return 'Verband';
 if(source.kind==='city'&&(/^Kreis(?:tag|ausschuss)(?!\p{L})/iu.test(committee)||COUNTY_HEAD.test(head)))return 'Landkreis';
 const town=committee.match(TOWN_COUNCIL)?.[1];
 if(town&&!association&&!names.some(n=>n.includes(words(town))))return 'andere Gemeinde';
 return null;
}
// Words of a title for comparing the agenda's and the minutes' wording: stems of six letters, without small words.
const SMALL=new Set('der die das des den dem und oder fuer von vom zur zum auf aus mit bei einer eines einem eine ein ueber im in am an zu nach sowie bzw'.split(' '));
const stems=t=>new Set(fold(t).split(/[^a-z0-9]+/).filter(w=>w.length>=3&&!SMALL.has(w)).map(w=>w.slice(0,6)));
/** Whether two titles name the same item: most words of the shorter one are in the other. */
export function similarTitles(a,b){
 const x=stems(a),y=stems(b);if(!x.size||!y.size)return false;
 let shared=0;for(const w of x)if(y.has(w))shared++;
 return shared/Math.min(x.size,y.size)>=0.6;
}

// A refusal (HTTP 403, 429 or a firewall's rejection page) closes that origin for the rest of the import: no further
// request goes there, also not the budget's retry. The error tells which origin was closed.
const CLOSED_ORIGIN='Server hat Abrufe abgewiesen; in diesem Import keine weiteren Anfragen dorthin';
const refusal=e=>{const m=String(e?.message||e);return m.includes(REFUSED)?429:Number(m.match(/HTTP (403|429)\b/)?.[1])||0;};
function refusals(){
 const shut=new Map();
 const guard=fn=>async(url,...rest)=>{
  let origin='';try{origin=new URL(url).origin;}catch{/* checked by siteAllowed */}
  if(shut.has(origin))throw Error(CLOSED_ORIGIN);
  try{return await fn(url,...rest);}catch(e){const status=refusal(e);if(status&&origin)shut.set(origin,status);throw e;}
 };
 return {guard,shut};
}

/**
 * Reads a catalog entry {id, name, kind, base, pages, feeds, ics, wp, sitemap, alsoFrom}. Returns {topics, marks,
 * readMeetings, coverage}. get(url, source, timeoutMs) → text; getBytes(url, source, timeoutMs) → {bytes, type};
 * pdfText(bytes) → text. expectNames: names of the area; coverage.namesArea tells whether a document read names one.
 */
export async function collectWebsite(source,{now=new Date(),get=fetchSiteText,getBytes=fetchSiteBytes,pdfText=readPdfText,maxDurationMs=300000,onProgress=()=>{},window:lookback,marks,expectNames}={}){
 const {guard,shut}=refusals();
 get=budgeted(guard(get),maxDurationMs,2);getBytes=budgeted(guard(getBytes),maxDurationMs,2);
 // Meetings from the start of the period up to the end of the month after next: notices appear weeks ahead.
 const from=windowStart(now,lookback),fromDay=from.toISOString().slice(0,10),today=now.toISOString().slice(0,10),until=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+3,0)).toISOString().slice(0,10);
 const inWindow=d=>d>=fromDay&&d<=until,issues=[],warnings=[];let unread=0,robotsSkipped=0,notRead=0,afterRefusal=0;
 const fail=(what,e)=>{const m=String(e?.message||e);if(/Zeitbudget/.test(m))unread++;else if(m===ROBOTS_BLOCKED)robotsSkipped++;else if(m===NOT_READ)notRead++;else if(m===CLOSED_ORIGIN)afterRefusal++;else issues.push(`${what}: ${m}`);};
 // 1. robots.txt before anything else; every later request carries the check, also for redirect targets.
 const allows=await robotsGate(get,source),site={...source,[ROBOTS]:allows};
 // Never an RIS page, the site's search or the non-public part, whatever list, feed or sitemap names it.
 const permitted=async url=>{let u;try{u=siteAllowed(url,source);}catch{return null;}if(isRisLink(u)||isSearchLink(u)||closed('',u)){notRead++;return null;}if(await allows(u))return u;robotsSkipped++;return null;};
 const read=async(url,what)=>{const u=await permitted(url);if(!u)return null;try{return await get(u,site);}catch(e){fail(`${what} ${u}`,e);return null;}};
 // 2. Sources of candidates. texts: what is parsed (documents read, entries with text of their own); candidates:
 // addresses of documents that may be read; events: calendar entries (iCal, JSON-LD).
 const candidates=new Map(),texts=[],events=[],listed=new Set(),direct=new Set();let listReads=0,listLeft=0;
 const offer=link=>{
  if(!link?.url)return;const seen=candidates.get(link.url);
  if(!seen){candidates.set(link.url,{...link,label:link.label||''});return;}
  if(link.label&&!seen.label.toLowerCase().includes(link.label.toLowerCase()))seen.label=`${seen.label} ${link.label}`.trim();
  seen.date??=link.date;if(link.kind==='pdf')seen.kind='pdf';
 };
 const relevant=(url,label)=>!closed(label,url)&&sessionScore({url:url||'',label:label||''})>=SESSION_THRESHOLD;
 const addText=(url,title,lines,kind,order)=>{texts.push({url,title,lines:lines.map(repair),kind,wrapped:kind==='application/pdf',order});direct.add(url);};
 // List pages and their following pages (at most three per list, twelve in all).
 await parallel((source.pages||[]).map(String),async start=>{
  const queue=[start];let follow=0;
  while(queue.length){
   const url=queue.shift();if(listed.has(url))continue;listed.add(url);
   const u=await permitted(url);if(!u)continue;
   if(listReads>=LIMITS.listPages){listLeft++;continue;}listReads++;
   let html;try{html=await get(u,site);}catch(e){fail('Listenseite '+u,e);continue;}
   onProgress(`${source.id}: ${listReads} Listenseiten`);
   for(const l of documentLinks(html,u))offer(l);
   for(const ev of jsonLdEvents(html,u))events.push({...ev,from:u});
   for(const next of paginationLinks(html,u))if(follow<LIMITS.followPages&&!listed.has(next)&&!queue.includes(next)){queue.push(next);follow++;}
  }
 },2);
 if(listLeft)warnings.push(`Listenlimit erreicht; ${listLeft} Listenseiten nicht gelesen.`);
 // Feeds: an entry with text of its own is read as it is; otherwise its link is a candidate.
 await parallel((source.feeds||[]).slice(0,LIMITS.feeds),async feed=>{
  const xml=await read(feed,'Feed');if(xml===null)return;
  for(const entry of parseFeed(xml,feed)){
   if(!relevant(entry.url,entry.title))continue;
   const lines=htmlToLines(entry.html);
   if(lines.join(' ').length>=200){let own=null;try{own=entry.url&&siteAllowed(entry.url,source);}catch{/* the entry links elsewhere */}addText(own||feed,entry.title,lines,'html',-1);}
   else if(entry.url)offer(asLink(entry.url,entry.title));
  }
 },2);
 // Calendars: events of a body's meeting in the period.
 await parallel((source.ics||[]).slice(0,LIMITS.ics),async ics=>{
  const text=await read(ics,'Kalender');if(text===null)return;
  for(const ev of parseIcs(text))events.push({name:ev.summary,date:ev.date,time:ev.time,description:ev.description,url:ev.url,from:ics});
 },2);
 // WordPress: posts are read from the API, PDF media are candidates. Never the search parameter.
 if(source.wp){
  let endpoints=null;try{endpoints=wpEndpoints(source.wp,fromDay);}catch(e){issues.push('WordPress: '+e.message);}
  if(endpoints)await parallel([['posts',endpoints.posts],['media',endpoints.media]],async([what,address])=>{
   for(let page=1;page<=LIMITS.wpPages;page++){
    const json=await read(page>1?`${address}&page=${page}`:address,'WordPress');if(json===null)return;
    let list;try{list=JSON.parse(json);}catch{issues.push(`WordPress ${address}: keine JSON-Antwort`);return;}
    if(!Array.isArray(list))return;
    if(what==='posts'){for(const p of parseWpPosts(list))if(relevant(p.url,p.title)){let own=null;try{own=siteAllowed(p.url,source);}catch{/* elsewhere */}addText(own||address,p.title,htmlToLines(p.html),'html',-1);}}
    else for(const m of parseWpMedia(list)){const l=asLink(m.url,m.title);if(l)offer({...l,kind:'pdf'});}
    if(list.length<50)return;
   }
  },2);
 }
 // Sitemap: addresses with a meeting word in the path and a date in the period (from the address, else lastmod).
 if(source.sitemap){
  const queue=[source.sitemap],found=[];let files=0;
  while(queue.length&&files<LIMITS.sitemaps){
   const url=queue.shift(),xml=await read(url,'Sitemap');files++;if(xml===null)continue;
   const map=parseSitemap(xml,url);queue.push(...map.sitemaps);
   for(const {url:address,lastmod} of map.urls){
    if(found.length>=LIMITS.sitemapUrls)break;
    const l=asLink(address,'');if(!l||!relevant(address,''))continue;
    if(l.date?inWindow(l.date):lastmod&&lastmod>=fromDay&&lastmod<=today)found.push(l);
   }
  }
  for(const l of found)offer(l);
 }
 // Calendar entries of a meeting: head line from summary, day and time, then the description.
 for(const ev of events){
  if(!ev.date||!inWindow(ev.date)||!relevant(ev.url,ev.name))continue;
  let own=null;try{own=ev.url&&siteAllowed(ev.url,source);}catch{/* elsewhere */}
  const head=`${ev.name} am ${ddmmyyyy(ev.date)}${ev.time?`, ${ev.time} Uhr`:''}`;
  texts.push({url:own||ev.from,title:ev.name,lines:[head,...String(ev.description||'').split(/\n/)],kind:'html',wrapped:false,order:-1,event:true});
  if(own)offer(asLink(own,ev.name));
 }
 // 3. Which candidates are read: only the site, only paths robots.txt leaves open, never the non-public part, an RIS
 // or the search, only links that look like a meeting's document, never a date outside the period. Documents whose
 // meetings an earlier import read completely (a usable mark) come last, so that a limit leaves them and the next
 // import goes on with what it has not read yet; then dated before undated, the newest first, then by score.
 const chosen=[];
 for(const c of candidates.values()){
  if(listed.has(c.url)||direct.has(c.url)||!['html','pdf'].includes(c.kind)||closed(c.label,c.url))continue;
  const score=sessionScore(c);if(score<SESSION_THRESHOLD||c.date&&!inWindow(c.date))continue;
  try{siteAllowed(c.url,source);}catch{continue;}
  chosen.push({...c,score});
 }
 const markedOf=url=>{const keys=Object.keys(marks?.known||{}).filter(k=>k.startsWith(url+'#sitzung-'));return keys.length&&keys.every(k=>Array.isArray(marks.known[k])&&usableMark(marks,{url:k,date:marks.known[k][0]},now))?keys:null;};
 const ranked=[];for(const c of chosen)if(await permitted(c.url))ranked.push({...c,marked:markedOf(c.url)});
 ranked.sort((a,b)=>(a.marked?1:0)-(b.marked?1:0)||(a.date?0:1)-(b.date?0:1)||String(b.date??'').localeCompare(String(a.date??''))||b.score-a.score);
 const take=ranked.slice(0,LIMITS.documents),rest=ranked.slice(take.length);
 // Documents left out whose meetings are marked count as read; only the others are still to be read.
 const heldBack=rest.filter(c=>c.marked);let left=rest.length-heldBack.length;
 // 4. Documents. HTML pages that yield no item may link the notice as PDF; those are read in a second round.
 const unreadable=[],unparsed=[];let documents=0;
 const readDocument=async(c,order,deeper)=>{
  let got;try{got=await getBytes(c.url,site);}catch(e){fail('Dokument '+c.url,e);return;}
  documents++;onProgress(`${source.id}: ${documents} Dokumente`);
  const bytes=got.bytes instanceof Uint8Array?got.bytes:new Uint8Array(got.bytes),type=got.type||'';
  const pdf=String.fromCharCode(...bytes.slice(0,1024)).includes('%PDF-')||/pdf/i.test(type)||/\.pdf$/i.test(new URL(c.url).pathname);
  if(pdf){
   if(bytes.byteLength>LIMITS.pdfBytes){issues.push(`Dokument ${c.url}: Quelldokument zu groß`);return;}
   let text;try{text=await pdfText(bytes);}catch(e){fail('Dokument '+c.url,e);return;}
   if(String(text||'').replace(/\s+/g,' ').trim().length<80){issues.push('PDF ohne lesbaren Text (vermutlich eingescannt): '+c.url);if(unreadable.length<LIMITS.unreadable)unreadable.push(c.url);return;}
   texts.push({url:c.url,title:c.label,lines:pdfLines(text).map(repair),kind:'application/pdf',wrapped:true,order});return;
  }
  if(bytes.byteLength>LIMITS.htmlBytes){issues.push(`Dokument ${c.url}: Quelldokument zu groß`);return;}
  const html=decodeText(bytes,type);
  texts.push({url:c.url,title:c.label,lines:htmlToLines(html).map(repair),kind:'html',wrapped:false,order,links:deeper?documentLinks(html,c.url):null});
 };
 await parallel(take,(c,i)=>readDocument(c,i,true),2);
 const second=[],seen=new Set([...candidates.keys(),...listed,...direct]);
 for(const t of texts.filter(t=>t.links).sort((a,b)=>a.order-b.order)){
  if(parseSessionText(t.lines,{title:t.title}).meetings.some(m=>m.items.length))continue;
  for(const l of t.links)if(l.kind==='pdf'&&!seen.has(l.url)&&!closed(l.label,l.url)&&sessionScore(l)>=SESSION_THRESHOLD&&!(l.date&&!inWindow(l.date))){seen.add(l.url);try{siteAllowed(l.url,source);second.push({...l,label:l.label||t.title});}catch{/* elsewhere */}}
 }
 const room=LIMITS.documents-take.length,more=[];for(const c of second){if(more.length>=room){left++;continue;}if(await permitted(c.url))more.push(c);}
 await parallel(more,(c,i)=>readDocument(c,take.length+i,false),2);
 if(left)issues.push(`Dokumentlimit erreicht; ${left} ${left===1?'Dokument':'Dokumente'} noch nicht gelesen, weiterer Import erforderlich.`);
 if(heldBack.length)warnings.push(`Dokumentlimit erreicht; ${heldBack.length} bereits vollständig gelesene ${heldBack.length===1?'Dokument':'Dokumente'} diesmal nicht erneut gelesen.`);
 // 5. Meetings of each text.
 const place=String(source.name||'').replace(PLACE_KIND,'').trim();
 const body=c=>place&&c.endsWith(' '+place)?c.slice(0,-place.length-1):c;
 const sessions=[],keys=new Set(),withItems=new Set(),upcoming=new Set(),names=(expectNames||[]).map(words).filter(n=>n.trim());let named=false;
 const ownNames=[words(place),words(source.name),...names].filter(n=>n.trim());
 for(const t of texts.sort((a,b)=>a.order-b.order)){
  if(names.length&&!named){const all=words(t.title+' '+t.lines.join(' '));named=names.some(n=>all.includes(n));}
  const parsed=parseSessionText(t.lines,{title:t.title,wrapped:t.wrapped});
  for(const note of parsed.issues)warnings.push(`${note} (${t.url})`);
  const known=parsed.meetings.filter(m=>m.date&&m.committee);
  if(!known.length){if(!t.event){issues.push('Keine Sitzung erkannt, nicht übernommen: '+t.url);if(unparsed.length<LIMITS.unparsed)unparsed.push(t.url);}continue;}
  if(parsed.meetings.some(m=>(!m.date||!m.committee)&&(m.items.length||m.unclear)))issues.push('Sitzung ohne erkennbares Datum oder Gremium, nicht übernommen: '+t.url);
  for(const m of known){
   if(!inWindow(m.date))continue;
   const committee=body(m.committee),foreign=foreignBody(m,committee,source,ownNames);
   if(foreign){if(foreign==='andere Gemeinde'&&m.items.length)issues.push(`Sitzung eines Gremiums einer anderen Gemeinde (${committee}), nicht übernommen: ${t.url}`);continue;}
   const key=`${m.date}|${slug(committee)}`;keys.add(key);
   if(m.unclear){issues.push('Tagesordnung nicht eindeutig als öffentlich erkennbar, nicht übernommen: '+t.url);continue;}
   if(!m.items.length){if(m.date>today)upcoming.add(key);continue;}
   withItems.add(key);
   sessions.push({...m,committee,key,url:`${t.url}#sitzung-${m.date}-${slug(committee)}`,doc:t});
  }
 }
 // 6. Topics: one per item of a meeting. One meeting yields one event per kind: the first document of that kind (in
 // reading order) leads, the same notice as HTML and PDF or in the gazette only adds its document.
 const leads=new Map(),also=new Map(),seenUrl=new Set();
 for(const s of sessions){
  if(seenUrl.has(s.url))continue;seenUrl.add(s.url);
  const k=`${s.key}|${s.kind}`,lead=leads.get(k);
  if(!lead){leads.set(k,s);also.set(s,[]);continue;}
  also.get(lead).push(s.doc);
 }
 const meetingsOut=[...leads.values()].sort((a,b)=>b.date.localeCompare(a.date)||(a.kind==='minutes')-(b.kind==='minutes'));
 // Ids: day, body, number and title. The minutes of an item join the invitation's topic where the number and the
 // wording agree (or, renumbered, the wording alone does); otherwise they make a topic of their own, so that the
 // outcome of one item never lands on the topic of another.
 const idOf=(s,item)=>`${source.id}-web-${s.date.replace(/-/g,'')}-${fnv(`${slug(s.committee)}|${item.number||''}|${slug(item.title)}`)}`;
 const ids=new Map();
 for(const s of meetingsOut){
  const invitation=s.kind==='minutes'?leads.get(`${s.key}|invitation`)||leads.get(`${s.key}|null`):null;
  const offered=invitation?invitation.items.map(item=>({item,id:idOf(invitation,item)})):[];
  ids.set(s,s.items.map(item=>{
   if(!invitation)return idOf(s,item);
   const same=offered.find(o=>o.item.number===item.number&&similarTitles(o.item.title,item.title))||(()=>{const like=offered.filter(o=>similarTitles(o.item.title,item.title));return like.length===1?like[0]:null;})();
   if(same){offered.splice(offered.indexOf(same),1);return same.id;}
   if(offered.some(o=>o.item.number===item.number))warnings.push(`Punkt ${item.number} (${s.committee} ${ddmmyyyy(s.date)}): Einladung und Niederschrift nennen verschiedene Titel; getrennt geführt.`);
   return idOf(s,item);
  }));
 }
 const grouped=new Map(),held={};let unchanged=0,done=0;
 const prepared=[];
 for(const s of meetingsOut){
  const known=usableMark(marks,s,now),minutes=s.kind==='minutes',idList=ids.get(s);
  const rows=s.items.map((item,n)=>{
   const status=itemStatus(item,s,today),ahead=s.date>today,result=minutes&&!ahead?item.result:'';
   const description=ahead?'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.':result?`Laut veröffentlichter Niederschrift: ${result}`:'Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Abschnitt nicht belegt.';
   const event={date:s.date,committee:s.committee,status,description,result,url:s.url,publicEvidence:s.publicEvidence};
   return {id:idList[n],title:item.title,number:item.number,votes:minutes?item.votes:null,minutes,event};
  });
  const print=(await hash(JSON.stringify(rows.map(r=>[r.id,r.title,r.number,r.event.status,r.event.result,s.doc.url])))).slice(0,16);
  prepared.push({s,known,rows,print,same:known?.trusted||known?.print===print});
 }
 // A meeting with a changed document is given out with all its documents: a report that appears weeks after the
 // invitation joins the invitation's topic and title instead of replacing them.
 const changedKeys=new Set(prepared.filter(p=>!p.same).map(p=>p.s.key));
 for(const {s,rows,print,same} of prepared){
  if(same&&!changedKeys.has(s.key)){held[s.url]=marks.known[s.url];unchanged++;continue;}
  const minutes=s.kind==='minutes',fetchedAt=now.toISOString();
  const docs=[s.doc,...also.get(s)].map(d=>({title:d.title||(minutes?'Niederschrift':'Bekanntmachung'),url:d.url,kind:d.kind}));
  for(const row of rows){
   const {event}=row;
   event.attendance={status:'not_collected',sourceUrl:s.url,fetchedAt,people:[]};event.decision=sourceDecision(event);
   const record={kind:minutes?'minutes':'agenda',url:s.url,fields:{title:row.title,number:row.number,...(minutes?{status:event.status,result:event.result,...(row.votes||{})}:{})}};
   const previous=grouped.get(row.id);
   if(!previous){grouped.set(row.id,{id:row.id,title:row.title,fromInvitation:!minutes,reference:'',sourceUrl:s.url,identityLinks:[],documents:[...docs],events:[event],sourceData:{version:'public-source-fields-v1',method:'website',fetchedAt,records:[record],detailStatus:'completed',issues:[]}});continue;}
   if(!previous.events.some(e=>e.url===event.url)){previous.events.push(event);previous.sourceData.records.push(record);}
   previous.documents.push(...docs);
   // The invitation names the item as the agenda put it; a report often shortens it.
   if(!minutes&&!previous.fromInvitation){previous.title=row.title;previous.sourceUrl=s.url;previous.fromInvitation=true;}
  }
  held[s.url]=newMark(s,print,now,rows.length);done++;
 }
 // Documents held back by the limit: their meetings stay as the earlier import read them.
 for(const c of heldBack)for(const k of c.marked)if(!held[k]){held[k]=marks.known[k];unchanged++;}
 const topics=[];
 for(const row of grouped.values()){
  // Same day for all events of a topic: the invitation first, the minutes (with the outcome) last.
  row.events.sort((a,b)=>a.date.localeCompare(b.date)||(a.result?1:0)-(b.result?1:0));
  row.sourceData.records.sort((a,b)=>(a.kind==='minutes')-(b.kind==='minutes'));
  const last=row.events.at(-1);delete row.fromInvitation;
  const t={...row,regionId:source.id,source:source.kind,public:true,officialTitle:row.title,category:category(row.title),status:last.status,committee:last.committee,eventDate:last.date,updatedAt:now.toISOString(),relevanceReason:'Öffentlicher Vorgang: '+source.name,sourceText:row.title+'\n'+row.events.map(e=>e.date+' '+e.description).join('\n'),documents:[...new Map(row.documents.map(d=>[d.url,d])).values()]};
  Object.assign(t,sourceSummary(t));t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+source.name);
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Offizielle Website der Kommune; nur Punkte des öffentlichen Teils einer Bekanntmachung oder Niederschrift.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};
  topics.push(t);
 }
 issues.unshift(...allows.issues);
 if(unread)issues.push(`Zeitbudget der Quelle erreicht; ${unread} ${unread===1?'Seite':'Seiten'} noch nicht gelesen.`);
 const temporary=[...shut.values()].some(v=>v===429);
 for(const [origin,status] of shut)issues.push(`${origin} wies Abrufe ab (HTTP ${status}); in diesem Import keine weiteren Anfragen dorthin${afterRefusal?`, ${afterRefusal} ${afterRefusal===1?'Adresse':'Adressen'} nicht abgefragt`:''}.`);
 if(robotsSkipped)warnings.push(`${robotsSkipped} ${robotsSkipped===1?'Adresse':'Adressen'} laut robots.txt ausgeschlossen, nicht abgerufen.`);
 if(notRead)warnings.push(`${notRead} ${notRead===1?'Adresse':'Adressen'} eines Ratsinformationssystems, der Suche oder des nichtöffentlichen Teils nicht abgerufen.`);
 const waiting=[...upcoming].filter(k=>!withItems.has(k)).length,meetings=keys.size-waiting;
 // Unchanged meetings are a successful reading: their reports are in the database already.
 return {topics,marks:held,readMeetings:done,coverage:{regionId:source.id,method:'scraper',listStrategy:'website',from:fromDay,to:today,importedAt:now.toISOString(),meetings,documents,
  ...(waiting?{upcomingWithoutAgenda:waiting}:{}),...(unchanged?{unchangedMeetings:unchanged}:{}),...(unread||left||temporary?{resumable:true}:{}),...(warnings.length?{warnings}:{}),...(unparsed.length?{unparsed}:{}),...(unreadable.length?{unreadable}:{}),...(names.length?{namesArea:named}:{}),
  sourceCount:1,quiet:meetings===0&&issues.length===0,complete:issues.length===0&&(topics.length>0||unchanged>0),issues:topics.length||unchanged?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:source.base}};
}
