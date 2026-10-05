import {extractText,getDocumentProxy} from 'unpdf';
import {sourceDecision,DECIDING_BODY} from './source-fields.mjs';
import {windowStart} from './history-window.mjs';
import {usableMark,newMark} from './meeting-marks.mjs';
import {budgeted,isRejectionPage,REFUSED} from './request-budget.mjs';
import {SOURCE_USER_AGENT} from './no-redirect.mjs';
import {parseRobots,robotsAllow} from './robots.mjs';
import {obeyRobots} from './robots-policy.mjs';
import {category,hash,sourceSummary,parallel} from './oparl.mjs';
import {htmlToLines,pdfLines,normalizeLine,parseSessionText,isSpecialPurposeBody,isNonPublicText,composeUmlauts,similarTitles,capsFix,truncatedText,meetingMoves,germanDates,committeeOf,parseItemLine} from './website-text.mjs';
import {documentLinks,sessionScore,SESSION_THRESHOLD,paginationLinks,parseFeed,parseIcs,parseSitemap,wpEndpoints,parseWpPosts,parseWpMedia,jsonLdEvents,isRisLink,isSearchLink,pdfLinksOf,CMS_FILE_HOST} from './website-feeds.mjs';
// Reader "website": what a municipality without a council system publishes on its own website about the meetings of
// its bodies — notices with agenda (every Land requires them), reports and minutes, its gazette as PDF, and the outputs
// its CMS offers anyway (RSS/Atom, iCal, WordPress REST, JSON-LD events, sitemap.xml). The catalog entry names the pages
// and feeds (scripts/source-discovery/website.mjs finds them); this reader guesses no addresses.
// - Only the site itself: https on the origin of base and of alsoFrom (same registrable domain). Redirects are followed
//   by hand and only within those origins; hosts of publishers, cloud storage and share services are never asked.
// - robots.txt is recorded, not obeyed (robots-policy.mjs, decision of 05.10.2026). With ROBOTS_POLICY=obey: robots.txt
//   of each origin is read before its first other request (RFC 9309); 4xx: no robots.txt, all allowed; 5xx or no
//   answer: nothing is read from that origin. Either way: forms, the site's search, logins and browser disguise are never
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
 // The file storage of the website's CMS (CMS_FILE_HOST) counts as well, but only where the entry names it.
 for(const extra of source.alsoFrom||[]){try{const u=new URL(extra);if(u.protocol==='https:'&&(related(siteHost(u.hostname),siteHost(base.hostname))||CMS_FILE_HOST.test(u.hostname))&&!out.includes(u.origin))out.push(u.origin);}catch{/* not an address */}}
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
/**
 * Text of bytes as UTF-8 or Windows-1252/Latin-1. The bytes decide where answer and page contradict each other (a page
 * moved to another CMS keeps its old charset): bytes that are valid UTF-8 with characters beyond ASCII are UTF-8, bytes
 * that are not valid UTF-8 are Windows-1252, whatever is declared. Text of plain ASCII reads the same either way.
 */
export function decodeText(bytes,type=''){
 let utf8=null;try{utf8=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{/* not UTF-8 */}
 if(utf8!==null&&/[^\x00-\x7f]/.test(utf8))return utf8.replace(/^\ufeff/,'');
 if(utf8===null)return new TextDecoder('windows-1252').decode(bytes);
 const probe=utf8.slice(0,2000),latin=/(?:charset|encoding)\s*=\s*["']?(?:iso-8859-1|iso-8859-15|latin-?1|windows-1252)/i;
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
 // robots.txt is recorded, not obeyed (robots-policy.mjs): every address is open here. Refusals still close an origin
 // (HTTP 403/429 in fetchSite and the reader), and pages of a council system, the search and the non-public part stay
 // closed as before. scripts/source-discovery/robots.mjs records what robots.txt says.
 if(!obeyRobots()){const open=async()=>true;open.issues=[];return open;}
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
// Also what the score of links reads as the non-public part ("…_vertr.pdf", "N-Teil", "-N.pdf"), so that a redirect target is
// checked as strictly as a link.
const closed=(label,url)=>isNonPublicText(label||'')||isNonPublicText(url||'')||isNonPublicText(safeDecode(url||''))||sessionScore({url:url||'',label:label||''})<=-100;
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
// Date and kind of one address with its text, read as documentLinks reads a link.
const asLink=(url,label)=>documentLinks(`<a href="${escape(url)}">${escape(label||'')}</a>`,url)[0]||null;
// Letter-spaced headings with single spaces are joined into one word ("NichtöffentlicherTeil"); the break before the
// part's noun is put back so that the heading is recognised.
const PART_NOUN=/((?:nicht\s*-?\s*)?öffentliche[rnms]?)(Teil|Sitzung|Sitzungsteil|Tagesordnung|Beratung|Punkte)(?!\p{L})/giu;
const repair=line=>{const l=normalizeLine(line);return l.length>90?l:l.replace(PART_NOUN,'$1 $2').replace(/^unterausschlu(ss|ß)deröffentlichkeit$/iu,'Unter Ausschluss der Öffentlichkeit');};
const PLACE_KIND=/^(?:Gemeinde|Stadt|Markt|Marktgemeinde|Hansestadt|Große Kreisstadt|Kreisstadt|Ortsgemeinde|Samtgemeinde|Verbandsgemeinde|Amt|Landkreis|Kreis)\s+/i;
// Titles every agenda has in both parts ("Genehmigung der Niederschrift", "Anfragen"): no sign of the same item. Only a title
// of nothing but such words; "Information zum Rechtsstreit mit der Baufirma Huber GmbH" names a matter.
const STANDARD_WORDS=/(?<![a-z])(?:genehmigung|feststellung|der|des|die|das|den|dem|niederschrift(?:en)?|protokoll[se]*|sitzung(?:en)?|letzten|vorherigen|oeffentlichen|oeffentlicher|mitteilung(?:en)?|bekanntgabe(?:n)?|bekanntgaben|anfrage(?:n)?|verschiedenes|sonstiges|wuensche|antraege|anregungen|information(?:en)?|eroeffnung|begruessung|ordnungsgemaessen|ladung|beschlussfaehigkeit|bericht(?:e)?|buergermeister(?:s|in)?|verwaltung|vorsitzenden|gemeinderat(?:e?s)?|stadtrat(?:e?s)?|ratsmitglieder|und|u|sowie|aus|von|vom|zur|zum|einwohnerfragestunde|buergerfragestunde|fragestunde|tagesordnung|einwaende|gegen|ueber|am|nr|top|[0-9.]+)(?![a-z])/g;
const standardTitle=t=>!/[a-z]/.test(fold(t).replace(STANDARD_WORDS,' '));
// Two wordings of one item where one names a plot more precisely ("Fl.Nr. 412" and "Fl.Nr. 412/3").
const closeTitles=(a,b)=>similarTitles(a,b)||similarTitles(String(a).replace(/(\d+)\/\d+/g,'$1'),String(b).replace(/(\d+)\/\d+/g,'$1'));
// The same body under two names: a council (Marktgemeinderat, Marktrat), or committees that share a word ("Bau- und
// Umweltausschuss", "Ausschuss für Bauen und Umwelt").
const COUNCIL_NAME=/^(?:gemeinderat|stadtrat|marktgemeinderat|marktrat|gemeindevertretung|stadtvertretung|stadtverordnetenversammlung|rat der (?:stadt|gemeinde)|ortsgemeinderat)/;
const bodyWords=c=>fold(c).split(/[^a-z]+/).filter(w=>w.length>=4&&!/^(?:ausschuss\w*|fuer|und|sowie|der|des|rat\w*)$/.test(w));
const sameBodies=(a,b)=>!a||!b||slug(a)===slug(b)||COUNCIL_NAME.test(fold(a))&&COUNCIL_NAME.test(fold(b))||bodyWords(a).some(x=>bodyWords(b).some(y=>x.slice(0,4)===y.slice(0,4)));
const mainNumber=n=>Number(String(n).split('.')[0]);
const firstDay=s=>germanDates(String(s||''))[0]?.iso??null;
const dayDiff=(a,b)=>(Date.parse(b)-Date.parse(a))/864e5;
// Items run together in one line ("Tagesordnung: 1. Genehmigung … 2. Bauantrag …"), numbered one after the other: each on a line.
const splitRunOn=line=>{
 const s=String(line),at=[...s.matchAll(/(?:^|\s)(\d{1,2})[.)]\s+(?=\p{Lu})/gu)];
 if(at.length<2||!at.every((m,k)=>k===0||Number(m[1])===Number(at[k-1][1])+1))return [s];
 const out=[];let prev=0;for(const m of at){const i=m.index+(/^\s/.test(m[0])?1:0);if(i>prev)out.push(s.slice(prev,i).trim());prev=i;}
 out.push(s.slice(prev).trim());return out.filter(Boolean);
};
const SMALL_WORDS=new Set('der die das des den dem und oder fuer von vom zur zum auf aus mit bei einer eines einem eine ein ueber im in am an zu nach sowie bzw'.split(' '));
const stemsOf=t=>new Set(fold(t).split(/[^a-z0-9]+/).filter(w=>w.length>=3&&!SMALL_WORDS.has(w)).map(w=>w.slice(0,6)));
// One item in two wordings for the outcome: similar, and the words of one are all in the other.
const sameItem=(a,b)=>{if(!similarTitles(a,b))return false;const x=stemsOf(a),y=stemsOf(b);return [...x].every(w=>y.has(w))||[...y].every(w=>x.has(w));};

// Status of an item: ahead → announced; an outcome of minutes; only a deciding body decides, a committee's approval or
// rejection is its recommendation (as the other readers have it).
function itemStatus(item,meeting,today){
 if(meeting.date>today)return 'announced';
 if(meeting.kind!=='minutes'||!item.status)return 'unknown';
 return (item.status==='approved'||item.status==='rejected')&&!DECIDING_BODY.test(meeting.committee)?'recommended':item.status;
}
// Bodies that are not the area's own: a special-purpose association, a county body on a town's site, a body of the
// Verbandsgemeinde, Samtgemeinde, Amt or Verwaltungsgemeinschaft on a member's site, the council of another town. The
// head of the meeting (its first lines), the line above it that names who gives notice ("Zweckverband …", "Landkreis …",
// "Gemeinde Bdorf") and the body's name count ("Umweltausschuss des Kreistages", "Gemeindevertretung der Gemeinde X").
const ASSOCIATION=/Verwaltungsgemeinschaft|Verwaltungsverband|Gemeindeverwaltungsverband|Verbandsgemeinde|Samtgemeinde|(?<!\p{L})Amt(?!\p{L})/u;
const COUNTY_HEAD=/(?<!\p{L})(?:des|der|beim|im)\s+(?:Kreistag(?:e?s)?|Landkreis(?:es)?|Kreis(?:es)?|Bezirkstag(?:e?s)?|Landratsamt(?:e?s)?|Kreishaus(?:es)?)(?!\p{L})/u;
const TOWN_COUNCIL=/^(?:Gemeinderat|Stadtrat|Marktgemeinderat|Marktrat|Gemeindevertretung|Stadtvertretung|Stadtverordnetenversammlung|Ortsgemeinderat)\s+(\p{Lu}.*)$/u;
// Bodies of a municipality (or of its districts and associations), never of a county.
const MUNICIPAL_BODY=/^(?:Gemeinderat|Stadtrat|Marktgemeinderat|Marktrat|Gemeindevertretung|Stadtvertretung|Stadtverordnetenversammlung|Ortsgemeinderat|Ortschaftsrat|Ortsrat|Ortsbeirat|Stadtbezirksrat|Verbandsgemeinderat|Samtgemeinderat|Amtsausschuss|Gemeinschaftsversammlung|Gemeinschaftsausschuss|Rat\s+der\s+(?:Stadt|Gemeinde))(?!\p{L})/u;
// Bodies of a special-purpose association, never those of an Amt, Verbandsgemeinde or Verwaltungsgemeinschaft.
const SPECIAL_BODY=/^(?:Verbandsversammlung|Verbandsausschuss|Verbandsvorstand|Verbandsrat)(?!\p{L})/u;
const ASSOCIATION_BODY=/^(?:Verbandsgemeinderat|Samtgemeinderat|Amtsausschuss|Gemeinschaftsausschuss|Gemeinschaftsversammlung|Verbandsausschuss|Verbandsversammlung|Verbandsrat|Amtsvertretung|Samtgemeinde\p{L}*|Verbandsgemeinde\p{L}*|Verwaltungsgemeinschafts\p{L}*|Amts\p{L}*ausschuss)(?!\p{L})/u;
// A body of the association named by its genitive, also without the association's name ("Haupt- und Finanzausschuss der
// Verbandsgemeinde", "Feuerwehrausschuss der Samtgemeinde", "Finanzausschuss des Amtes").
const BODY_OF_ASSOCIATION=/(?:ausschuss|ausschusses|rat|rates|versammlung|vertretung|beirat|beirates)\s+(?:der|des)\s+(?:Verbandsgemeinde|Samtgemeinde|Verwaltungsgemeinschaft|Verwaltungsverband(?:e?s)?|Gemeindeverwaltungsverband(?:e?s)?|Amt(?:e?s)?)(?!\p{L})/iu;
const ASSOCIATION_HEAD=/(?<!\p{L})(?:der|des)\s+(?:Verbandsgemeinde|Samtgemeinde|Verwaltungsgemeinschaft|Verwaltungsverband(?:e?s)?|Gemeindeverwaltungsverband(?:e?s)?|Amt(?:e?s)?)\s+\p{Lu}/u;
const NOTICE='^(?:(?:Öffentliche\\s+)?Bekanntmachung\\s+(?:des|der)\\s+)?';
// Also "Wasser- und Bodenverband …".
const ISSUER_SPECIAL=new RegExp(`${NOTICE}(?:\\p{L}+-\\s+(?:und|u\\.)\\s+)?(?!Verwaltungsverband|Gemeindeverwaltungsverband)\\p{L}*verband(?:e?s)?(?!\\p{L})`,'u');
const ISSUER_COUNTY=new RegExp(`${NOTICE}(?:Landkreis(?:es)?|Landratsamt(?:e?s)?|Kreis(?:es)?|Kreisverwaltung|(?:Der\\s+|Die\\s+)?(?:Landrat|Landrätin)(?=\\s+(?:des|der)\\s))(?!\\p{L})`,'u');
// Also the works and offices of an association ("Verbandsgemeindewerke Musterland", "Samtgemeindeverwaltung").
const ISSUER_ASSOCIATION=new RegExp(`${NOTICE}(?:Amt(?:e?s)?|Amtsverwaltung|Verbandsgemeinde\\p{L}*|Samtgemeinde\\p{L}*|Verwaltungsgemeinschaft|Verwaltungsverband|Gemeindeverwaltungsverband)(?!\\p{L})`,'u');
// A county's offices or its head in the head or signature of a meeting ("Ort: Landratsamt Musterkreis", "Landrat"), and the county
// in the link text ("Kreistag – Ausschuss für Umwelt").
const COUNTY_PLACE=/(?<!\p{L})(?:Landratsamt(?:e?s)?|Kreisverwaltung|Kreishaus(?:es)?|Kreistag(?:e?s)?|Kreisausschuss(?:es)?|Bezirkstag(?:e?s)?)(?!\p{L})/u;
const COUNTY_SIGNATURE=/^(?:(?:Der|Die)\s+)?(?:Landrat|Landrätin|Erste[rn]?\s+Kreisbeigeordnete[rn]?|Kreisbeigeordnete[rn]?|Oberkreisdirektor(?:in)?|Bezirkstagspräsident(?:in)?)(?!\p{L})/u;
const COUNTY_TITLE=/(?<!\p{L})(?:Kreistag\p{L}*|Kreisausschuss\p{L}*|Landkreis\p{L}*|Landratsamt\p{L}*|Kreisverwaltung|Bezirkstag\p{L}*)(?!\p{L})/u;
// The office of a special-purpose association below the items ("Verbandsvorsitzender", "Verbandsvorsteher", "Werkleiter des Zweckverbands").
const SPECIAL_SIGNATURE=/(?<!\p{L})(?:Verbandsvorsitzende[rn]?|Verbandsvorsteher(?:in)?|Zweckverband\p{L}*|Schulverband\p{L}*|Wasserverband\p{L}*|Abwasserverband\p{L}*)(?!\p{L})/u;
// Places named for the meeting: the venue ("im Sitzungssaal des Rathauses Bdorf") and the place of the signature ("Bdorf, 07.10.2026").
const VENUE_TOWN=/(?<!\p{L})(?:Rathaus(?:es)?|Bürgerhaus(?:es)?|Gemeindehaus(?:es)?|Dorfgemeinschaftshaus(?:es)?|Gemeinschaftshaus(?:es)?|Dorfhaus(?:es)?|Feuerwehrhaus(?:es)?|Bürgersaal(?:s|es)?|Gemeindesaal(?:s|es)?|Gemeindezentrum(?:s)?|Bürgerzentrum(?:s)?|Kulturhaus(?:es)?|Kulturzentrum(?:s)?|Vereinsheim(?:s|es)?|Sporthalle|Turnhalle|Festhalle|Mehrzweckhalle|Mehrzweckgebäude(?:s)?|Grundschule|Schule)\s+(?:in\s+)?((?:(?:Bad|Sankt|St\.|Groß|Klein|Alt|Neu|Ober|Unter|Nieder|Hohen)\s+)?\p{Lu}[\p{Ll}-]+)(?!\p{L})/gu;
const SIGN_PLACE=/^((?:(?:Bad|Sankt|St\.|Groß|Klein|Alt|Neu|Ober|Unter|Nieder|Hohen)\s+)?\p{Lu}[\p{L}-]+)(?:\s+(?:a\.|am|an|im|in|ob|bei|vor)\s[^,]{1,30})?,\s*(?:den\s+|am\s+)?\d{1,2}\./u;
// A venue in the head names where the meeting is held, not whose it is ("findet im Rathaus Musterbach eine Sitzung des
// Werkausschusses statt": associations meet in the Rathaus of a member).
const VENUE=/(?<!\p{L})(?:im|in\s+der|in\s+dem|in\s+die|ins)\s+(?:\p{L}+\s+){0,3}?(?:Rathaus(?:es)?|Grundschule|Mittelschule|Schule|Feuerwehrhaus(?:es)?|Sitzungssaal|Bürgerhaus(?:es)?|Gemeindehaus(?:es)?|Dorfgemeinschaftshaus(?:es)?|Mehrzweckhalle|Turnhalle|Halle|Verbandsgebäude|Amtsgebäude)(?:\s+(?:des\s+)?(?:Rathauses\s+)?(?:(?:Bad|Sankt|St\.|Groß|Klein|Alt|Neu|Ober|Unter|Nieder|Hohen)\s+)?\p{Lu}[\p{L}-]+)?/gu;
const ISSUER_TOWN=new RegExp(`${NOTICE}(?:Gemeinde|Stadt|Markt|Marktgemeinde|Ortsgemeinde|Hansestadt|Große\\s+Kreisstadt|Kreisstadt|Universitätsstadt|Landeshauptstadt)\\s+(\\p{Lu}[\\p{L}.-]*(?:\\s+\\p{Lu}[\\p{L}.-]*)?)`,'u');
const HEAD_TOWN=/(?<!\p{L})(?:der|des)\s+(?:Gemeinde|Stadt|Markt|Marktgemeinde|Ortsgemeinde|Hansestadt)\s+(\p{Lu}[\p{L}-]+(?:\s+\p{Lu}[\p{L}-]+)?)/gu;
// A place is compared by its first word, by two for "Bad …", "Sankt …", "Neu …".
const TWO_PART=/^(?:bad|sankt|st|gross|klein|alt|neu|ober|unter|nieder|hohen)$/;
const placeKey=name=>{const w=words(name).trim().split(' ').filter(Boolean);return w.length>1&&TWO_PART.test(w[0])?` ${w[0]} ${w[1]} `:w.length?` ${w[0]} `:'';};
// The heading of a section of a gazette that names a municipality ("Bdorf", "BDORF", "Aus der Gemeinde Bdorf",
// "Amtliche Bekanntmachungen der Gemeinde Bdorf", "Mitgliedsgemeinde Bdorf").
const SECTION_PLACE=/^(?:(?:(?:Amtliche\s+)?Bekanntmachungen?\s+|Aus\s+|Nachrichten\s+|Mitteilungen\s+)(?:der|dem|des)\s+)?(?:Gemeinde|Stadt|Markt|Marktgemeinde|Ortsgemeinde|Mitgliedsgemeinde|Ortsteil|Ortschaft)\s+(\p{Lu}[\p{L}-]+(?:\s+\p{Lu}[\p{L}-]+)?)$|^((?:(?:Bad|Sankt|St\.|Groß|Klein|Alt|Neu|Ober|Unter|Nieder|Hohen)\s+)?\p{Lu}[\p{Ll}-]+|\p{Lu}{3,}(?:-\p{Lu}+)?)$/u;
const NOT_SECTION=/^(?:landkreis|kreis|kreistag|kreisausschuss|landratsamt|kreisverwaltung|ausschuesse|gremien|sitzungstermine|tagesordnungen|staedte|gemeinden|amtliche[rns]?|bekanntmachung(?:en)?|oeffentliche[rns]?|tagesordnung|sitzung(?:en)?|einladung|inhalt|inhaltsverzeichnis|nichtamtliche[rns]?|teil|hinweis(?:e)?|termine|veranstaltungen|rathaus|verwaltung|impressum|aktuelles|nachrichten|mitteilungen|niederschrift|protokoll|beschluesse|gemeinderat|stadtrat|bauausschuss|amtsblatt|mitteilungsblatt|ende|fortsetzung|seite|vereine|kirchen|schulen)$/;
// A gazette of several municipalities by its head.
const SHARED_GAZETTE=/Verwaltungsgemeinschaft|Verbandsgemeinde|Samtgemeinde|Verwaltungsverband|(?<!\p{L})Amt(?:e?s)?(?!\p{L})|Mitgliedsgemeinden|kreisangehörig/u;
// A gazette that belongs to one municipality ("Amtsblatt der Gemeinde Musterbach").
const GAZETTE_OWNER=/(?<!\p{L})(?:der|des)\s+(?:Gemeinde|Stadt|Markt|Marktgemeinde|Ortsgemeinde|Hansestadt)\s+(\p{Lu}[\p{L}-]+(?:\s+\p{Lu}[\p{L}-]+)?)/u;
// The council of a town in the link text ("Bekanntmachung Sitzung Ortsgemeinderat Nachbarhausen").
const TITLE_TOWN=/(?<!\p{L})(?:Gemeinderat|Ortsgemeinderat|Stadtrat|Marktgemeinderat|Marktrat|Gemeindevertretung|Stadtvertretung|Stadtverordnetenversammlung)(?:e?s)?\s+((?:(?:Bad|Sankt|St\.|Groß|Klein|Alt|Neu|Ober|Unter|Nieder|Hohen)\s+)?\p{Lu}[\p{Ll}-]+)(?!\p{L})/u;
// The place of a postal address ("Kirchplatz 2, 99999 Nachbarhausen").
const POSTAL_PLACE=/(?<!\d)\d{5}\s+((?:(?:Bad|Sankt|St\.|Groß|Klein|Alt|Neu|Ober|Unter|Nieder|Hohen)\s+)?\p{Lu}[\p{Ll}-]+)(?!\p{L})/gu;
// A heading that names the town of the meeting in other ways: "Gemeinde Nachbarhausen – Sitzung des Gemeinderates", "Nachbarhausen: Sitzung
// des Gemeinderates", "Sitzung des Gemeinderates (Nachbarhausen)", "Öffentliche Gemeinderatssitzung in Nachbarhausen".
const PLACE_NAME='((?:(?:Bad|Sankt|St\\.|Groß|Klein|Alt|Neu|Ober|Unter|Nieder|Hohen)\\s+)?\\p{Lu}[\\p{Ll}-]+)';
const HEADING_TOWNS=[new RegExp(`^${PLACE_NAME}\\s*:\\s*(?:(?:Öffentliche|Nichtöffentliche|Ordentliche|Außerordentliche|Konstituierende)\\s+)?(?:\\p{L}*[Ss]itzung|Einladung|Tagesordnung|Bekanntmachung|Gemeinderat|Stadtrat|Marktgemeinderat|Gemeindevertretung|Stadtverordnetenversammlung|Ortschaftsrat|\\p{L}*[Aa]usschuss)`,'u'),new RegExp(`\\(\\s*${PLACE_NAME}\\s*\\)`,'gu'),new RegExp(`(?:sitzung|rat(?:e?s)?|ausschuss(?:es)?|vertretung|versammlung|beirat(?:e?s)?)\\s+in\\s+${PLACE_NAME}(?!\\p{L})`,'giu')];
const NOT_PLACE_WORD=/^(?:rathaus\w*|sitzungssaal\w*|saal|buergerhaus\w*|gemeindehaus\w*|turnhalle|schule|grundschule|aula|fortsetzung|sondersitzung|ersatztermin|nachtrag|entwurf|hybrid\w*|online|praesenz\w*|video\w*|livestream|hinweis|achtung|wichtig|info|anmerkung|ort|termin\w*|beginn|ende|uhrzeit|datum|tagesordnung|einladung|bekanntmachung|niederschrift|protokoll|teil|top|ausschuss\w*|gemeinderat\w*|stadtrat\w*|kreistag\w*|sitzung\w*|oeffentlich\w*|nichtoeffentlich\w*|neu|aktuell\w*|update|korrektur|geaendert|verlegt|verschoben|abgesagt|ersatz|form|ortsteil|ortschaft|gemeinde|stadt|markt|zeit|wann|wo|thema|betreff|vorsitz|kuerze|news|meldung|pressemitteilung|amtlich\w*|gremium|status|art|typ)$/;
const NOT_TOWN=/^(?:sitzung\w*|tagesordnung|einladung|bekanntmachung|niederschrift|protokoll|beschluss\w*|oeffentlich\w*|nichtoeffentlich\w*|am|vom|im|in|der|die|das|des|und|termin\w*|januar|februar|maerz|april|mai|juni|juli|august|september|oktober|november|dezember|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|sonnabend|teil|top|nr|ergebnis\w*|bericht|aktuell|ausschuss\w*|haushalt\w*)$/;
function foreignBody(m,committee,source,names,title=''){
 const head=String(m.context||''),issuer=capsFix(String(m.issuer||'')),trailer=[].concat(m.trailer||[]).map(capsFix),headLines=[].concat(m.headLines||[]).map(capsFix),lead=[].concat(m.lead||[]).map(capsFix);
 const own=place=>{const k=placeKey(place);return !k||names.some(n=>n.includes(k));};
 const association=ASSOCIATION.test(source.name||'');
 if(isSpecialPurposeBody(m.committee)||isSpecialPurposeBody(head)||isSpecialPurposeBody(issuer)||ISSUER_SPECIAL.test(issuer)||isSpecialPurposeBody(title)||lead.some(l=>l.length<=100&&isSpecialPurposeBody(l)))return 'Zweckverband';
 // Sections of a collective notice set in capitals or named "Gemeinde X" ("NACHBARHAUSEN" above the second meeting): another member's.
 const sectionsOf=lines=>lines.filter(l=>/^\p{Lu}{3,}(?:[\s-]\p{Lu}{2,})*$/u.test(l)||/^(?:(?:(?:Amtliche\s+)?Bekanntmachungen?\s+|Aus\s+|Nachrichten\s+|Mitteilungen\s+)(?:der|dem|des)\s+)?(?:Gemeinde|Stadt|Markt|Marktgemeinde|Ortsgemeinde|Mitgliedsgemeinde)\s+\p{Lu}[\p{L}-]+(?:\s+\p{Lu}[\p{L}-]+)?$/u.test(l)).map(capsFix).map(l=>l.match(SECTION_PLACE)).filter(Boolean).map(x=>x[1]||x[2]).filter(p=>!words(p).trim().split(' ').some(w=>NOT_SECTION.test(w))&&!/(?:tag|rat|ausschuss|beirat|versammlung|vertretung|amt|ung|heit|keit|schaft|ordnung)$/iu.test(p));
 const sections=sectionsOf([].concat(m.lead||[]));
 if(!m.gazette&&source.kind!=='district'&&sections.some(p=>!own(p)))return 'andere Gemeinde';
 // Who gives notice of the whole text (an Amt, a Verwaltungsgemeinschaft, a Zweckverband or a county above its first meeting) gives notice
 // of a later meeting that names no issuer and no section of the area's own.
 const inherited=!issuer&&!sections.some(own)?[].concat(m.docIssuers||[]).map(capsFix):[];
 if(inherited.some(l=>ISSUER_SPECIAL.test(l)||isSpecialPurposeBody(l)))return 'Zweckverband';
 // The office or name of a special-purpose association in the signature (its chair is often the mayor of a member).
 if(!association&&trailer.some(l=>SPECIAL_SIGNATURE.test(l)||isSpecialPurposeBody(l)))return 'Zweckverband';
 // An Amt or a Verbandsgemeinde has no Verbandsversammlung; a Gemeindeverwaltungsverband has.
 if(association&&!/Verwaltungsverband/u.test(source.name||'')&&SPECIAL_BODY.test(committee))return 'Zweckverband';
 // A county's gazette carries notices of its towns: their councils are never the county's.
 if(source.kind==='district'&&MUNICIPAL_BODY.test(committee))return 'Gemeinde';
 // A county's gazette: a meeting under the section or notice of a town ("STADT MUSTERSTADT", "Musterstadt") is the town's.
 if(source.kind==='district'&&m.gazette){
  const sections=[].concat(m.lead||[]).map(capsFix).map(l=>l.match(SECTION_PLACE)).filter(Boolean).map(x=>x[1]||x[2]).filter(p=>!words(p).trim().split(' ').some(w=>NOT_SECTION.test(w))&&!/(?:tag|rat|ausschuss|beirat|versammlung|vertretung|amt)$/iu.test(p));
  if(sections.some(p=>!own(p))||ISSUER_TOWN.test(issuer))return 'Gemeinde';
 }
 // A gazette of several municipalities (of a Verwaltungsgemeinschaft, an Amt, a Verbandsgemeinde): a town's meeting in it
 // is the area's only where its section, head or issuer names the area, or the gazette is the area's own.
 if(m.gazette&&source.kind!=='district'&&!association){
  const owner=String(m.gazette).match(GAZETTE_OWNER)?.[1],lead=[].concat(m.lead||[]).map(capsFix),text=words(`${lead.join(' ')} ${m.headText||''} ${issuer}`.replace(VENUE,' '));
  const sections=lead.map(l=>l.match(SECTION_PLACE)).filter(Boolean).map(x=>x[1]||x[2]).filter(p=>!words(p).trim().split(' ').some(w=>NOT_SECTION.test(w)));
  if(sections.some(p=>!own(p)))return 'andere Gemeinde';
  if(!names.some(n=>text.includes(n))&&!(owner&&own(owner))&&SHARED_GAZETTE.test(m.gazette))return 'andere Gemeinde';
 }
 if(!association&&(/^(?:Verbandsversammlung|Gemeinschaftsversammlung)(?!\p{L})/u.test(committee)||/Verwaltungsgemeinschaft|\p{L}*verband(?:e?s)?(?!\p{L})/u.test(head)))return 'Verband';
 if(source.kind==='city'&&(/^Kreis(?:tag|ausschuss)(?!\p{L})/iu.test(committee)||COUNTY_HEAD.test(head)||ISSUER_COUNTY.test(issuer)||inherited.some(l=>ISSUER_COUNTY.test(l))||COUNTY_TITLE.test(String(title))||headLines.some(l=>COUNTY_PLACE.test(l)||ISSUER_COUNTY.test(capsFix(l)))||trailer.some(l=>COUNTY_SIGNATURE.test(l)||ISSUER_COUNTY.test(l))))return 'Landkreis';
 if(association)return null;
 // A member's own council may be announced by its Amt or Verbandsgemeinde ("Amt Musterland" / "Gemeindevertretung Musterbach").
 const council=committee.match(TOWN_COUNCIL)?.[1],ownCouncil=!!council&&own(council);
 if(ASSOCIATION_BODY.test(committee)||BODY_OF_ASSOCIATION.test(head)||!ownCouncil&&(ASSOCIATION_HEAD.test(head)||ISSUER_ASSOCIATION.test(issuer)||inherited.some(l=>ISSUER_ASSOCIATION.test(l))||headLines.some(l=>/(?<!\p{L})(?:der|des)\s+(?:Verbandsgemeinde|Samtgemeinde|Verwaltungsgemeinschaft)\p{L}*/u.test(l)||ISSUER_ASSOCIATION.test(capsFix(l)))))return 'Verband';
 // Every town the head, the signature below the items or the link text names for the meeting must be the area's own.
 const titleTown=String(title).match(TITLE_TOWN)?.[1];
 // The town a heading names in other ways (its first line, the link text or summary).
 const headingTowns=[...headLines.slice(0,3),String(m.heading||''),String(title)].flatMap(l=>[l.match(ISSUER_TOWN)?.[1],...HEADING_TOWNS.flatMap(re=>re.global?[...l.matchAll(re)].map(t=>t[1]):[l.match(re)?.[1]])]).filter(p=>p&&!NOT_TOWN.test(fold(p))&&!NOT_PLACE_WORD.test(fold(p))&&!/(?:ung|heit|keit|schaft|tion|sitzung|termin|halle|haus|saal|zentrum|heim|gebäude|schule|kirche|raum|stube)$/iu.test(p));
 const towns=[...headingTowns,council,...[...head.matchAll(HEAD_TOWN)].map(t=>t[1]),issuer.match(ISSUER_TOWN)?.[1],...trailer.flatMap(l=>[l.match(ISSUER_TOWN)?.[1],...[...l.matchAll(HEAD_TOWN)].map(t=>t[1])]),titleTown&&!NOT_TOWN.test(fold(titleTown))?titleTown:null].filter(Boolean);
 if(towns.some(t=>!own(t)))return 'andere Gemeinde';
 // A meeting held in the Rathaus of another town and signed there ("im Sitzungssaal des Rathauses Bdorf", "Bdorf, 07.10.2026"),
 // as the notice page of a Verwaltungsgemeinschaft lists those of all its members; unless the head or signature names the area.
 const places=[...headLines.flatMap(l=>[...[...l.matchAll(VENUE_TOWN)].map(t=>t[1]),...[...l.matchAll(POSTAL_PLACE)].map(t=>t[1])]),...trailer.map(l=>l.match(SIGN_PLACE)?.[1])].filter(p=>p&&!NOT_TOWN.test(fold(p))&&!/^(?:Gemeinde|Stadt|Markt|Rathaus|Sitzungssaal)$/u.test(p));
 // The district a district body is named after is where it meets ("Ortschaftsrat Unterdorf" in the Dorfgemeinschaftshaus Unterdorf).
 const district=committee.match(/^(?:Ortschaftsrat|Ortsrat|Ortsbeirat|Stadtbezirksrat|Bezirksbeirat|Bezirksausschuss)\s+(\p{Lu}.*)$/u)?.[1];
 if(places.some(p=>!own(p)&&!(district&&placeKey(p)===placeKey(district)))&&!names.some(n=>words([...headLines,...trailer].join(' ')).includes(n)))return 'andere Gemeinde';
 return null;
}
export {similarTitles};

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
 const candidates=new Map(),texts=[],events=[],listed=new Set(),direct=new Set(),listRead=new Set(),cancels=[];let listReads=0,listLeft=0;
 const offer=link=>{
  if(!link?.url)return;const seen=candidates.get(link.url);
  if(!seen){candidates.set(link.url,{...link,label:link.label||''});return;}
  if(link.force)seen.force=true;
  if(link.label&&!seen.label.toLowerCase().includes(link.label.toLowerCase()))seen.label=`${seen.label} ${link.label}`.trim();
  seen.date??=link.date;if(link.kind==='pdf')seen.kind='pdf';
 };
 const relevant=(url,label)=>!closed(label,url)&&sessionScore({url:url||'',label:label||''})>=SESSION_THRESHOLD;
 // A copy of a notice (a feed entry, a post, a calendar entry) gives items only where the documents it stands for were read: the page
 // it links (an article, the page of a calendar entry) and the PDF files it links (the official notice with the parts of the meeting).
 // Those are read whatever their links say; one that cannot be read keeps the copy from giving items.
 const needed=(links,label)=>{const out=[];for(const l of links){if(!l?.url||closed(l.label||label,l.url))continue;let u=l.url;try{u=siteAllowed(l.url,source);offer({...asLink(u,l.label||label)||{url:u,label:l.label||label,date:null,kind:l.kind||'pdf'},force:true});}catch{/* another host: never read, so the copy gives nothing */}out.push(u);}return [...new Set(out)];};
 const addText=(url,title,lines,kind,order,needs=[],copy=false)=>{texts.push({url,title,lines:lines.map(repair),kind,wrapped:kind==='application/pdf',order,needs});if(!copy)direct.add(url);};
 // List pages and their following pages (at most three per list, twelve in all).
 await parallel((source.pages||[]).map(String),async start=>{
  const queue=[start];let follow=0;
  while(queue.length){
   const url=queue.shift();if(listed.has(url))continue;listed.add(url);
   const u=await permitted(url);if(!u)continue;
   if(listReads>=LIMITS.listPages){listLeft++;continue;}listReads++;
   let html;try{html=await get(u,site);}catch(e){fail('Listenseite '+u,e);continue;}
   listRead.add(u);
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
   // A teaser cut short ("…", "Weiterlesen") is not the text: its article is read instead.
   // An entry with text of its own needs the PDF files it links, and its article where its text ends on an item of a public part
   // (a teaser may be cut after any word without a mark).
   if(lines.join(' ').length>=200&&!truncatedText(lines)){
    let own=null;try{own=entry.url&&siteAllowed(entry.url,source);}catch{/* the entry links elsewhere */}
    const cut=!!parseItemLine(lines.at(-1))&&!parseSessionText(lines.map(repair),{title:entry.title}).meetings.some(m=>m.restricted);
    addText(own||feed,entry.title,lines,'html',-1,needed([...(own&&cut?[{url:own,label:entry.title,kind:'html'}]:[]),...pdfLinksOf(entry.html,entry.url||feed)],entry.title),true);
    // The entry's own address stays out of the documents unless the entry needs it.
    if(own&&!cut)direct.add(own);
   }
   else if(entry.url)offer(asLink(entry.url,entry.title));
  }
 },2);
 // Calendars: events of a body's meeting in the period.
 await parallel((source.ics||[]).slice(0,LIMITS.ics),async ics=>{
  const text=await read(ics,'Kalender');if(text===null)return;
  for(const ev of parseIcs(text))events.push({name:ev.summary,date:ev.date,time:ev.time,description:ev.description,url:ev.url,from:ics,location:ev.location,organizer:ev.organizer,cancelled:ev.cancelled,links:[...ev.attachments,...pdfLinksOf(ev.description,ev.url||ics).map(l=>l.url)]});
 },2);
 // WordPress: posts are read from the API, PDF media are candidates. Never the search parameter.
 if(source.wp){
  let endpoints=null;try{endpoints=wpEndpoints(source.wp,fromDay);}catch(e){issues.push('WordPress: '+e.message);}
  if(endpoints)await parallel([['posts',endpoints.posts],['media',endpoints.media]],async([what,address])=>{
   for(let page=1;page<=LIMITS.wpPages;page++){
    const json=await read(page>1?`${address}&page=${page}`:address,'WordPress');if(json===null)return;
    let list;try{list=JSON.parse(json);}catch{issues.push(`WordPress ${address}: keine JSON-Antwort`);return;}
    if(!Array.isArray(list))return;
    if(what==='posts'){for(const p of parseWpPosts(list))if(relevant(p.url,p.title)){let own=null;try{own=siteAllowed(p.url,source);}catch{/* elsewhere */}addText(own||address,p.title,htmlToLines(p.html),'html',-1,needed(pdfLinksOf(p.html,p.url),p.title));}}
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
  // A cancelled entry (STATUS:CANCELLED, METHOD:CANCEL, EventCancelled/EventPostponed) names a day without that meeting.
  if(ev.cancelled){cancels.push({from:ev.date,to:null,committee:committeeOf(ev.name)});continue;}
  let own=null;try{own=ev.url&&siteAllowed(ev.url,source);}catch{/* elsewhere */}
  // The entry stands on its own day: "(verlegt)" in its summary says it was moved here, not away.
  const name=String(ev.name||'').replace(/\s*[([]\s*(?:verlegt|verschoben|neuer\s+Termin|Terminänderung|geändert|Ersatztermin)\s*[)\]]/giu,' ').trim();
  const head=`${name} am ${ddmmyyyy(ev.date)}${ev.time?`, ${ev.time} Uhr`:''}`;
  // A description without line breaks (JSON-LD, a cropped calendar text) has its items in one line: they are put on lines of
  // their own. A description cut short is not read; the page it links is. Who organises it stands above the head, where it is held
  // below it, as a notice has them.
  const description=String(ev.description||'').split(/\n/).flatMap(splitRunOn);
  const lines=[...(ev.organizer?[ev.organizer]:[]),head,...(ev.location?[`Ort: ${ev.location}`]:[]),...description];
  const needs=needed([...(own?[{url:own,label:ev.name,kind:'html'}]:[]),...(ev.links||[]).map(url=>({url,label:ev.name,kind:'pdf'}))],ev.name);
  if(!truncatedText(description))texts.push({url:own||ev.from,title:ev.name,lines,kind:'html',wrapped:false,order:-1,event:true,eventDate:ev.date,needs});
  else if(own)offer(asLink(own,ev.name));
 }
 // 3. Which candidates are read: only the site, only paths robots.txt leaves open, never the non-public part, an RIS
 // or the search, only links that look like a meeting's document, never a date outside the period. Documents whose
 // meetings an earlier import read completely (a usable mark) come last, so that a limit leaves them and the next
 // import goes on with what it has not read yet; then dated before undated, the newest first, then by score.
 const chosen=[];
 for(const c of candidates.values()){
  if(listed.has(c.url)||direct.has(c.url)&&!c.force||!['html','pdf'].includes(c.kind)||closed(c.label,c.url))continue;
  const score=sessionScore(c);if(!c.force&&(score<SESSION_THRESHOLD||c.date&&!inWindow(c.date)))continue;
  try{siteAllowed(c.url,source);}catch{continue;}
  chosen.push({...c,score});
 }
 const markedOf=url=>{const keys=Object.keys(marks?.known||{}).filter(k=>k.startsWith(url+'#sitzung-'));return keys.length&&keys.every(k=>Array.isArray(marks.known[k])&&usableMark(marks,{url:k,date:marks.known[k][0]},now))?keys:null;};
 const ranked=[];for(const c of chosen)if(await permitted(c.url))ranked.push({...c,marked:markedOf(c.url)});
 ranked.sort((a,b)=>(a.force?0:1)-(b.force?0:1)||(a.marked?1:0)-(b.marked?1:0)||(a.date?0:1)-(b.date?0:1)||String(b.date??'').localeCompare(String(a.date??''))||b.score-a.score);
 // 4. Documents, at most LIMITS.documents in all. A page that yields no item may link the notice as PDF; a page with items may
 // type off the agenda without its parts and link the official notice. Such PDFs are read right after their page (within the
 // same limit); a page with items whose linked notice is not read (robots.txt, an error, a scan, another host, the limit)
 // gives no items, so that what the notice puts in the non-public part never comes out of the page.
 const unreadable=[],unparsed=[];let documents=0,budget=LIMITS.documents;const reading=new Map();
 const readOnce=(c,order,deeper)=>{if(reading.has(c.url))return reading.get(c.url);if(budget<=0)return null;budget--;const p=readDocument(c,order,deeper);reading.set(c.url,p);return p;};
 const readDocument=async(c,order,deeper)=>{
  let got;try{got=await getBytes(c.url,site);}catch(e){fail('Dokument '+c.url,e);return;}
  documents++;onProgress(`${source.id}: ${documents} Dokumente`);
  const bytes=got.bytes instanceof Uint8Array?got.bytes:new Uint8Array(got.bytes),type=got.type||'';
  const pdf=String.fromCharCode(...bytes.slice(0,1024)).includes('%PDF-')||/pdf/i.test(type)||/\.pdf$/i.test(new URL(c.url).pathname);
  if(pdf){
   if(bytes.byteLength>LIMITS.pdfBytes){issues.push(`Dokument ${c.url}: Quelldokument zu groß`);return;}
   let text;try{text=await pdfText(bytes);}catch(e){fail('Dokument '+c.url,e);return;}
   if(String(text||'').replace(/\s+/g,' ').trim().length<80){issues.push('PDF ohne lesbaren Text (vermutlich eingescannt): '+c.url);if(unreadable.length<LIMITS.unreadable)unreadable.push(c.url);return;}
   texts.push({url:c.url,title:c.label,lines:pdfLines(text).map(repair),kind:'application/pdf',wrapped:true,order,fetched:true});return;
  }
  if(bytes.byteLength>LIMITS.htmlBytes){issues.push(`Dokument ${c.url}: Quelldokument zu groß`);return;}
  const html=decodeText(bytes,type),t={url:c.url,title:c.label,lines:htmlToLines(html).map(repair),kind:'html',wrapped:false,order,fetched:true};
  texts.push(t);
  if(!deeper)return;
  const days=new Set(parseSessionText(t.lines,{title:t.title}).meetings.filter(m=>m.items.length).map(m=>m.date));
  const notices=[];
  for(const l of documentLinks(html,c.url)){
   // A page with items: every PDF of the site it links counts as its notice, whatever the link says ("Amtliche Bekanntmachung (PDF,
   // 85 KB)", "Download", an icon, "Aushang vom …"). A page without items: only links that look like a meeting's document.
   if(l.kind!=='pdf'||closed(l.label,l.url)||!days.size&&sessionScore({url:l.url,label:l.label||t.title})<SESSION_THRESHOLD||l.date&&!inWindow(l.date)&&!days.size)continue;
   // The notice of a page with items: of its day, without a day, or dated by its posting shortly before ("2026-10-07_einladung.pdf").
   // A label that names another meeting's day leaves the PDF out; the day of a posting ("Aushang vom 07.10.2026") does not.
   const labelDay=firstDay(l.label)&&/sitzung|niederschrift|protokoll|einladung|tagesordnung|beschl|rat(?:es|s)?\b|ausschuss|kreistag|vertretung|versammlung/i.test(l.label);
   if(days.size&&l.date&&!days.has(l.date)&&(labelDay||![...days].some(d=>d&&dayDiff(l.date,d)>=0&&dayDiff(l.date,d)<=35)))continue;
   notices.push(l);
  }
  if(days.size)t.requires=notices.map(l=>l.url);
  for(const l of notices){
   let u;try{u=siteAllowed(l.url,source);}catch{continue;}
   if(!await permitted(u))continue;
   const p=readOnce({...l,url:u,label:l.label||t.title},order+0.5,false);if(p)await p;else if(days.size)limitedNotices++;
  }
 };
 let limitedNotices=0;
 await parallel(ranked,async(c,i)=>{const p=readOnce(c,i,true);if(p)await p;},2);
 const rest=ranked.filter(c=>!reading.has(c.url));
 // Documents left out whose meetings are marked count as read; only the others are still to be read.
 const heldBack=rest.filter(c=>c.marked);let left=rest.length-heldBack.length+limitedNotices;
 // A page with items whose linked notice was not read gives nothing.
 const readUrls=new Set([...texts.filter(t=>t.fetched).map(t=>t.url),...listRead]);
 for(const t of texts)if(t.requires?.some(u=>!readUrls.has(u))){t.missingNotice=t.requires.find(u=>!readUrls.has(u));}
 // A copy gives nothing where a document it stands for was not read, or gave nothing itself for want of its notice.
 for(const t of texts)if(!t.fetched&&t.needs?.length){const miss=t.needs.find(u=>!readUrls.has(u)||texts.some(x=>x.fetched&&x.url===u&&x.missingNotice));if(miss)t.missingNotice=miss;}
 if(left)issues.push(`Dokumentlimit erreicht; ${left} ${left===1?'Dokument':'Dokumente'} noch nicht gelesen, weiterer Import erforderlich.`);
 if(heldBack.length)warnings.push(`Dokumentlimit erreicht; ${heldBack.length} bereits vollständig gelesene ${heldBack.length===1?'Dokument':'Dokumente'} diesmal nicht erneut gelesen.`);
 // 5. Meetings of each text.
 const place=String(source.name||'').replace(PLACE_KIND,'').trim();
 const body=c=>place&&c.endsWith(' '+place)?c.slice(0,-place.length-1):c;
 const sessions=[],keys=new Set(),withItems=new Set(),upcoming=new Set(),names=(expectNames||[]).map(words).filter(n=>n.trim());let named=false;
 const ownNames=[words(place),words(source.name),...names].filter(n=>n.trim());
 // Every text is read first: an item one document of a meeting puts in the non-public part (the invitation) never comes
 // out of another document of that meeting (minutes that copy the whole agenda, a page without its headings).
 // Each document is told apart by itself, not by its address: entries of a feed, posts of an API and a calendar entry may share
 // the address of the feed or of the page they link.
 const parsedOf=new Map(),closedOf=new Map(),publicOf=new Map(),moves=[];
 for(const t of texts.sort((a,b)=>a.order-b.order)){
  const parsed=parseSessionText(t.lines,{title:t.title,wrapped:t.wrapped});parsedOf.set(t,parsed);
  moves.push(...meetingMoves(t.lines));
  // By day: the same body may be named otherwise in another document. An item numbered on after the public items of its
  // document (3 and 4 after 1 and 2) closes that number for the same body also where another document words it otherwise.
  for(const m of parsed.meetings)if(m.date){
   const committee=m.committee?body(m.committee):'';
   for(const c of m.closedItems||[])closedOf.set(m.date,[...closedOf.get(m.date)||[],{...c,text:t,url:t.url,committee,standard:standardTitle(c.title),continues:m.lastPublic>0&&mainNumber(c.number)>m.lastPublic}]);
   // The public items of a document that marks its non-public part: an item another document of the meeting gives beyond these
   // (minutes numbered anew after an item was taken off) is not shown to be public.
   if(m.closedItems?.length&&!m.unclear)publicOf.set(m.date,[...publicOf.get(m.date)||[],{text:t,committee,items:m.items}]);
  }
 }
 // A meeting moved to another day (by a notice of its own): what its invitation puts in the non-public part holds for the new
 // day; the old day and a cancelled day have no meeting of that body.
 const movedFrom=[];
 moves.push(...cancels);
 for(const mv of moves){
  movedFrom.push(mv);if(!mv.to)continue;
  const same=c=>!mv.committee||!c.committee||sameBodies(c.committee,body(mv.committee));
  closedOf.set(mv.to,[...closedOf.get(mv.to)||[],...(closedOf.get(mv.from)||[]).filter(same)]);
  publicOf.set(mv.to,[...publicOf.get(mv.to)||[],...(publicOf.get(mv.from)||[]).filter(same)]);
 }
 // Items of the non-public part of the same body on other days (within six weeks), by title only: a meeting moved without a
 // notice the reader found.
 const closedNear=(date,committee)=>[...closedOf.entries()].filter(([d])=>d!==date&&Math.abs(dayDiff(d,date))<=45).flatMap(([,list])=>list).filter(c=>!c.standard&&sameBodies(c.committee,committee));
 for(const t of texts){
  if(names.length&&!named){const all=words(t.title+' '+t.lines.join(' '));named=names.some(n=>all.includes(n));}
  const parsed=parsedOf.get(t);
  for(const note of parsed.issues)warnings.push(`${note} (${t.url})`);
  const known=parsed.meetings.filter(m=>m.date&&m.committee);
  if(!known.length){if(!t.event){issues.push('Keine Sitzung erkannt, nicht übernommen: '+t.url);if(unparsed.length<LIMITS.unparsed)unparsed.push(t.url);}continue;}
  if(parsed.meetings.some(m=>(!m.date||!m.committee)&&(m.items.length||m.unclear)))issues.push('Sitzung ohne erkennbares Datum oder Gremium, nicht übernommen: '+t.url);
  if(t.missingNotice&&parsed.meetings.some(m=>m.items.length)){issues.push(`Verlinkte Bekanntmachung ${t.missingNotice} nicht gelesen; Punkte der Seite nicht übernommen: ${t.url}`);continue;}
  for(let m of known){
   if(!inWindow(m.date))continue;
   // A calendar entry names its day in DTSTART/startDate; a meeting the text gives another day is not taken.
   if(t.event&&m.date!==t.eventDate){if(m.items.length)issues.push(`Kalendereintrag nennt einen anderen Sitzungstag als sein Text (${ddmmyyyy(t.eventDate)}), nicht übernommen: ${t.url}`);continue;}
   const committee=body(m.committee),foreign=foreignBody(m,committee,source,ownNames,t.title);
   if(foreign){if(foreign==='andere Gemeinde'&&m.items.length)issues.push(`Sitzung eines Gremiums einer anderen Gemeinde (${committee}), nicht übernommen: ${t.url}`);continue;}
   const key=`${m.date}|${slug(committee)}`;keys.add(key);
   if(m.unclear){issues.push('Tagesordnung nicht eindeutig als öffentlich erkennbar, nicht übernommen: '+t.url);continue;}
   // A meeting on a day a notice moved or cancelled.
   if(movedFrom.some(mv=>mv.from===m.date&&(!mv.committee||sameBodies(body(mv.committee),committee))&&!(mv.to===m.date))){if(m.items.length)issues.push(`Sitzung ${committee} ${ddmmyyyy(m.date)} laut Bekanntmachung verlegt oder abgesagt, nicht übernommen: ${t.url}`);continue;}
   // An item another document of the same meeting puts in the non-public part goes, with all items after it.
   const elsewhere=(closedOf.get(m.date)||[]).filter(c=>c.text!==t);
   const near=closedNear(m.date,committee).filter(c=>c.text!==t);
   let cut=m.items.findIndex(it=>elsewhere.some(c=>!c.standard&&closeTitles(c.title,it.title)||c.continues&&sameBodies(c.committee,committee)&&mainNumber(it.number)>=mainNumber(c.number))||near.some(c=>closeTitles(c.title,it.title)));
   // An item that is none of the public items of another document of the meeting that marks its non-public part.
   for(const other of (publicOf.get(m.date)||[]).filter(o=>o.text!==t&&sameBodies(o.committee,committee))){
    const k=m.items.findIndex(it=>!other.items.some(o=>slug(o.title)===slug(it.title)||closeTitles(o.title,it.title)));
    if(k>=0&&(cut<0||k<cut))cut=k;
   }
   if(cut>=0){warnings.push(`Punkt ${m.items[cut].number} (${committee} ${ddmmyyyy(m.date)}) steht in einem anderen Dokument dieser Sitzung im nichtöffentlichen Teil; ${m.items.length-cut} ${m.items.length-cut===1?'Punkt':'Punkte'} nicht übernommen (${t.url}).`);m={...m,items:m.items.slice(0,cut)};}
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
   // The same wording first, then the same number with one wording inside the other, then one such wording alone: two
   // building applications of one meeting ("… Am Hang", "… Lindenweg") are not the same item because most words agree.
   const exact=offered.filter(o=>slug(o.item.title)===slug(item.title));
   const same=(exact.length===1?exact[0]:null)||offered.find(o=>o.item.number===item.number&&sameItem(o.item.title,item.title))||(()=>{const like=offered.filter(o=>sameItem(o.item.title,item.title));return like.length===1?like[0]:null;})();
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
