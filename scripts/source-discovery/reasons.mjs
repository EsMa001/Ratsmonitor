// Reasons of the report of build.mjs: why an area is not connected, and which address the report shows for it.
// Pure functions: no file is read, nothing is written; build.mjs hands in the check results and the lists it builds.
// The report groups areas by these texts (its summary cuts a detail in brackets at the end), and later steps select
// areas by them (website.mjs REASONS); a text is changed only together with its meaning.
import {obeyRobots} from '../../server/integrations/robots-policy.mjs';

// Check results of other stages besides verified.json. Accepted sources count in this order; verified-website.json
// (website.mjs) comes last, so it adds an area only where no check of a council information system accepted one.
export const ACCEPTED_FILES=['verified-guessed.json','verified-guessed-own.json','verified-oparl.json','verified-search.json','verified-research.json','verified-hosted.json','verified-consents.json','verified-fix.json','verified-website.json'];
// Candidates set on purpose for one area (web search, diagnosis, correction): a check of them without a source still
// says more than the check of the links of the website, so it stands in the report (the later file wins).
// verified-research.json holds the checks of the candidates from the research per Land (candidates/research-*.json).
export const TARGETED_FILES=['verified-search.json','verified-research.json','verified-consents.json','verified-fix.json'];
// Guessed addresses: only a system found there or a refusal by robots.txt is a finding; a guessed page without a
// system changes nothing.
export const GUESSED_FILES=['verified-guessed-own.json','verified-guessed.json','verified-hosted.json'];
// Candidate files whose first address the report shows when no check names one (guessed platform addresses on shared
// hosts are no evidence and are left out).
export const CANDIDATE_FILES=['candidates.json','candidates-search.json','candidates-research.json','candidates-hosted.json','candidates-consents.json','candidates-guessed-own.json','candidates-fix.json'];

// The part of a shared system: the municipality of a KIC app, the client of SessionNet, name patterns of bodies, the
// bodies of More! Rubin.
const PART_FIELDS=['client','calendarQuery','organizations','bodies'];
const hasPart=source=>Boolean(source)&&PART_FIELDS.some(k=>source[k]!==undefined);
/**
 * The check results that the report uses, by area id: verified.json, completed by the other files ({file: rows}).
 * An accepted source always wins; then a targeted check that tried something; then a guessed address with a finding.
 * One exception: a targeted check that took only the area's part of a shared system replaces a source that took the
 * whole system (each member would show the bodies of all; rules.mjs sharedBodies).
 */
export function mergeChecks(verified,files={}){
 const out={...verified},rows=file=>Object.values(files[file]||{});
 for(const file of ACCEPTED_FILES)for(const row of rows(file)){
  const was=out[row.id]?.accepted;
  if(row.accepted&&(!was||TARGETED_FILES.includes(file)&&hasPart(row.accepted)&&!hasPart(was)))out[row.id]=row;
 }
 for(const file of TARGETED_FILES)for(const row of rows(file))if(!row.accepted&&(row.tried||[]).length&&!out[row.id]?.accepted)out[row.id]=row;
 for(const file of GUESSED_FILES)for(const row of rows(file))if(!out[row.id]&&((row.tried||[]).some(forbidden)||(row.systems||[]).some(s=>s!=='unknown')))out[row.id]=row;
 return out;
}

export const PLATFORMS=[
 // RIS-Portal (regisafe) and komuna forbid every program but search engines in robots.txt and offer no OParl. Since
 // 05.10.2026 robots.txt is recorded, not obeyed (robots-policy.mjs), and both have a reader (ris-portal.mjs; komuna is
 // a KIC app, kic.mjs): their reason comes from the check like that of any other system.
 [/(^|\.)kommune-aktiv\.de$/,'Kommune aktiv: antwortet Programmen mit HTTP 403'],
 [/(^|\.)ekom21\.de$/,'ekom21 (SD.NET): vorgeschaltete Web-Firewall leitet Programme auf eine Fehlerseite um'],
];
const hostOf=url=>{try{return new URL(url).hostname;}catch{return '';}};
const platformOf=url=>PLATFORMS.find(([host])=>host.test(hostOf(url)))||null;
// verify.mjs records a path that robots.txt disallows with robots:'verboten'; a redirect to such a path ends the page
// with this error instead.
const forbidden=t=>t.robots==='verboten'||/robots\.txt untersagt/.test(t.error||'');
// A page on which verify.mjs recognised a system: a product of its own detection, a reader of readers.mjs or an OParl
// interface that answered.
const recognised=t=>Boolean((t.system&&t.system!=='unknown')||t.reader||t.oparl);
const last=(list,test)=>[...list].reverse().find(test);
/**
 * The entry of a check that decides its reason and the address of the report. A municipality's website may link the
 * platform of its district besides its own system (a Kreis-RIS-Portal and its own gremien.info); the own system decides.
 * Order: the last page with a recognised system that names the area; the last one with a recognised system whose
 * robots.txt refuses programs; the first refusal by robots.txt; the last page with a recognised system; the first
 * address on a platform host (their pages answer with errors or firewall pages); the first address at all.
 */
export function mainEntry(tried=[]){
 const withUrl=tried.filter(t=>t.url);
 return last(withUrl,t=>recognised(t)&&t.identity?.ok)||last(withUrl,t=>recognised(t)&&forbidden(t))||withUrl.find(forbidden)
  ||last(withUrl,recognised)||withUrl.find(t=>platformOf(t.url))||withUrl[0]||null;
}

/** The address the report shows for an open area: the deciding entry of its check, otherwise the first candidate. */
export function foundLink(row,candidateRows=[]){
 const main=mainEntry(row?.tried||[]);if(main)return main.url;
 for(const c of candidateRows){const url=c?.candidates?.find(x=>x.url)?.url;if(url)return url;}
 return '';
}

/** Reason of an area whose last check obeyed robots.txt (before 05.10.2026); the dashboard shows it as "Neuprüfung ausstehend". */
export const ROBOTS_RECHECK='robots.txt des gefundenen Systems sperrte bei der letzten Prüfung; Neuprüfung ausstehend (robots.txt wird seit 05.10.2026 nur festgehalten)';

export const germanDay=ms=>new Date(ms).toISOString().slice(0,10).split('-').reverse().join('.');
// Addresses of council systems. An unrecognised page on such an address is a system that could not be assigned, not
// a plain web page.
const RIS_ADDRESS=/ratsinfo|sessionnet|allris|si00\d\d|gremien\.info|more-rubin|sdnet|ratsinfomanagement|sitzung-online|kdz-ws|ris-portal|komuna|\/\/ris[.-]|\/ris\/|\/bi\/|oparl/i;
// Links that publish meetings as web page or document: an e-paper of the gazette, a calendar or notice page (also as
// the address inside a sharing link: x.com/intent/tweet?url=…/sitzungskalender…).
const PUBLICATION=/epaper|amtsblatt|mitteilungsblatt|kalender|sitzungstermin|bekanntmachung/i;
const decoded=url=>{try{return decodeURIComponent(url);}catch{return url;}};
const NO_RIS='Kein Ratsinformationssystem erkennbar; Sitzungen nur als Webseite oder PDF';
// Why the links of the website were no candidates (crawl.mjs: sites, pages, log). A run reads at most 21 pages per
// website (start page and 20 more).
function noLink(crawl){
 const log=crawl?.log||[];
 if(crawl&&!(crawl.sites||[]).length&&!log.some(l=>/^Fehler/.test(l)))return 'Keine offizielle Website in Wikidata (P856)';
 if(crawl&&(crawl.pages||0)<=4&&log.some(l=>/HTTP (403|503)\b/.test(l)))return 'Offizielle Website antwortet Programmen nicht (HTTP 403/503)';
 if(crawl&&(crawl.pages||0)>=20)return 'Website durchsucht, kein Link zu einem Ratsinformationssystem gefunden';
 return 'Auf der offiziellen Website kein Link zu einem Ratsinformationssystem gefunden';
}
// Status of the pages that did not answer: "mit HTTP 404" or "nicht (Zeitüberschreitung)".
function noAnswer(tried){
 const codes=[...new Set(tried.map(t=>t.status).filter(s=>s>0))].sort((a,b)=>a-b),none=tried.filter(t=>!(t.status>0));
 const why=none.some(t=>/timeout|aborted|zeit/i.test(t.error||''))?'Zeitüberschreitung':'keine Verbindung';
 if(!codes.length)return `Verlinkte Seite antwortet Programmen nicht (${why})`;
 return `Verlinkte Seite antwortet Programmen mit HTTP ${codes.join('/')}`+(none.length?` oder gar nicht (${why})`:'');
}

/**
 * The reason why an open area is not connected.
 * row: its check result (verify.mjs format) or null; crawl: its row of candidates.json (crawl.mjs) or null.
 * ctx: skipReason(area), dropped, placeholder (sets of ids), foreign (id → owner), oparlAsked (set of ids),
 * websiteChecks (id → website check without source), readerName(adapter).
 */
export function openReason(area,row,crawl,ctx={}){
 const has=(list,id)=>Boolean(list&&id!==undefined&&list.has(id));
 const skip=area&&ctx.skipReason?ctx.skipReason(area):null;if(skip)return skip;
 // The website check stands after the reason; its date in brackets at the end is cut off by the summary.
 const site=area&&ctx.websiteChecks?.get(area.id),withSite=text=>site?`${text}; Website geprüft: ${site.reason}`+(site.checkedAt?` (${germanDay(site.checkedAt)})`:''):text;
 if(!row)return crawl?.candidates?.length?'Link auf der Website gefunden, noch nicht geprüft':withSite(noLink(crawl));
 if(has(ctx.dropped,row.id))return 'Adresse mehreren Gebieten zugeordnet';
 if(has(ctx.placeholder,row.id))return 'Verlinktes System führt nur einen Demo-Mandanten des Herstellers (z. B. „Stadt Musterstadt“)';
 if(has(ctx.foreign,row.id))return `Mitbenutztes System von ${ctx.foreign.get(row.id)}; die Leser trennen die Gremien eines gemeinsamen Systems nicht`;
 if(row.error)return 'Prüfung abgebrochen: '+row.error;
 // verify.mjs stops asking an operator that refused three times in one run; the area waits for a later run.
 if((row.tried||[]).some(t=>/wiederholt ab \(HTTP 403\/429\)/.test(t.error||t.readerError||''))&&!(row.tried||[]).some(t=>t.identity?.ok&&(t.readerTopics||t.snTopics||t.allrisTopics||t.sdTopics||t.rubinTopics)))return 'Betreiber wies Programme bei der Prüfung wiederholt ab (HTTP 403/429); Neuprüfung später';
 const tried=row.tried||[],systems=(row.systems||[]).filter(s=>s!=='unknown'),readerName=ctx.readerName||(a=>a);
 // verify.mjs checked the area but tried nothing: every link was one of its services (read-aloud, sharing, app
 // stores, e-paper, vendor pages). An e-paper or a shared calendar page still shows where the meetings stand.
 if(!tried.length&&crawl?.candidates?.length)return withSite(crawl.candidates.some(c=>PUBLICATION.test(decoded(c.url||'')))?NO_RIS:'Nur Links auf Vorlese-, Teilen-, App- oder Herstellerseiten gefunden, kein Ratsinformationssystem');
 const main=mainEntry(tried);
 // Platforms that serve many areas outside NRW and cannot be read: their name says what would open them up. They
 // come first: a page of such a platform can look like another system (RIS-Portal was taken for SessionNet once).
 const platform=main?platformOf(main.url):null;
 if(platform&&/^ekom21/.test(platform[1])&&has(ctx.oparlAsked,row.id))return platform[1]+'; die OParl-Schnittstelle des Herstellers ist für diese Kommune nicht aktiviert, Freischaltung bei der Kommune anfragen';
 if(platform)return platform[1];
 // With ROBOTS_POLICY=obey verify.mjs does not read a path that the system's robots.txt disallows for programs. Under
 // the standard rule such a refusal comes from a check made before 05.10.2026: the area waits for its new check.
 if(main&&forbidden(main))return obeyRobots()?'robots.txt sperrt den HTML-Zugriff auf das gefundene System (keine OParl-Schnittstelle oder API gefunden); Freigabe beim Betreiber anfragen'
  :ROBOTS_RECHECK;
 const several=tried.find(t=>/^Mehrere Körperschaften/.test(t.rubinError||''));
 if(several)return several.rubinError.replace(/; Zuordnung nur mit fester Körperschaft$/,'')+'; der Leser trennt sie noch nicht';
 // A system with the councils of other areas of the district: taken only with the part of this area (verify.mjs).
 const shared=tried.find(t=>t.sharedSystem?.others?.length);
 if(shared){const others=shared.sharedSystem.others;return `Gemeinsames System mehrerer Gemeinden (auch ${others.slice(0,3).join(', ')}${others.length>3?' u. a.':''}); der Teil des Gebiets ist noch nicht festgelegt`;}
 const sn=tried.find(t=>t.snError||t.snTopics===0);
 if(sn)return 'SessionNet gefunden, Abruf lieferte keine öffentlichen Tagesordnungspunkte'+(sn.snError?` (${sn.snError})`:sn.snIssues?.length?` (${sn.snIssues[0]})`:'');
 // The list of bodies is read before the assignment; its error counts only on a system that names the area.
 const rubin=tried.find(t=>t.rubinTopics===0||(t.rubinError&&t.identity?.ok));
 if(rubin)return 'More! Rubin gefunden, Abruf lieferte keine öffentlichen Tagesordnungspunkte'+(rubin.rubinError?` (${rubin.rubinError})`:rubin.rubinIssues?.length?` (${rubin.rubinIssues[0]})`:'');
 if(tried.some(t=>t.system==='sdnet'&&t.oparl))return 'SD.NET mit antwortender OParl-Schnittstelle, die keine verwertbaren Sitzungen lieferte; öffentliche Seiten werden dann nicht gelesen (Freigabe erforderlich)';
 const list=tried.map(t=>(t.sdIssues||[]).map(i=>i.match(/^Vorlagenliste: Quelle antwortet mit HTTP (\d+)/)?.[1]).find(Boolean)).find(Boolean);
 // HTTP 403 on the list of papers is the same refusal as on a page: only the vendor's OParl address may be asked.
 if(list==='403')return 'Zugriffsschutz (HTTP 403) für Programme; OParl nicht aktiviert';
 if(list)return 'SD.NET: Startseite erreichbar, Vorlagenliste antwortet mit HTTP '+list;
 if(tried.some(t=>t.sdTopics===0||t.sdError))return 'SD.NET gefunden, Abruf der öffentlichen Seiten lieferte keine Tagesordnungspunkte'+(tried.find(t=>t.sdIssues?.length)?' ('+tried.find(t=>t.sdIssues?.length).sdIssues[0]+')':'');
 if(tried.some(t=>t.oparl&&!t.oparlTopics))return 'OParl-Schnittstelle antwortet, lieferte aber keine verwertbaren Sitzungen'+(tried.find(t=>t.oparlError)?' ('+tried.find(t=>t.oparlError).oparlError+')':'');
 if(tried.length&&tried.every(t=>t.status===403))return 'Zugriffsschutz (HTTP 403) für Programme; OParl nicht aktiviert';
 // No page named the area. Was it a system? Pages that no detection recognised (a district portal, a calendar of the
 // website's CMS, an e-paper) on addresses that do not look like a council system are no system at all.
 if(tried.some(t=>t.identity&&!t.identity.ok)&&!tried.some(t=>t.identity?.ok)){
  const pages=tried.filter(t=>t.system!==undefined);
  if(pages.length&&pages.every(t=>!recognised(t)&&!forbidden(t)&&!RIS_ADDRESS.test(t.url||'')))return withSite(NO_RIS);
  return 'Gefundenes System nicht eindeutig dem Gebiet zuzuordnen';
 }
 if(systems.includes('sdnet'))return 'SD.NET erwähnt, System selbst nicht erreichbar oder nicht gefunden';
 if(tried.some(t=>t.system==='allris'&&/Wartungsarbeiten/i.test(t.title||'')))return 'ALLRIS 4; die Bürgerinformation war bei der Prüfung wegen Wartungsarbeiten nicht verfügbar. Erneut prüfen';
 if(tried.some(t=>(t.allrisIssues||[]).some(i=>/Zugriffsprüfung/.test(i))))return 'ALLRIS 4 mit Zugriffsprüfung des Herstellers gegen automatisierte Abrufe (wird nicht umgangen); OParl nicht aktiviert';
 if(tried.some(t=>(t.allrisIssues||[]).some(i=>/zu viele Zugriffe/.test(i))))return 'ALLRIS 4 gefunden; das System meldete bei der Prüfung zu viele Zugriffe und sperrte vorübergehend. Erneut prüfen';
 // A reader of readers.mjs that read the page decides before the ALLRIS 4 reader (an ALLRIS 3 page is read by allris3).
 // A CKAN portal (server/integrations/ckan.mjs) without query profile: its interface is there, the reader needs the profile.
 const ckan=tried.find(t=>t.reader==='ckan'&&(t.readerIssues||[]).some(i=>/Leser\/Connector fehlt/.test(i)));
 if(ckan)return ckan.readerIssues.find(i=>/Leser\/Connector fehlt/.test(i));
 const reader=tried.find(t=>t.reader&&(t.readerError||t.readerTopics===0));
 if(reader)return `${readerName(reader.reader)} gefunden, Abruf lieferte keine öffentlichen Tagesordnungspunkte`+(reader.readerIssues?.length?' ('+reader.readerIssues[0]+')':'');
 if(tried.some(t=>t.allrisTopics===0||t.allrisError))return 'ALLRIS 4 gefunden, Abruf der öffentlichen Seiten lieferte keine Tagesordnungspunkte'+(tried.find(t=>t.allrisError||t.allrisIssues?.length)?' ('+(tried.find(t=>t.allrisError)?.allrisError||tried.find(t=>t.allrisIssues?.length).allrisIssues[0])+')':'');
 // Checks before the ALLRIS 3 reader existed (or without its result) recorded only the generation.
 if(tried.some(t=>t.allrisGeneration===3&&!t.reader))return 'ALLRIS 3 erkannt; Leser noch nicht angewendet (Neuprüfung ausstehend)';
 if(systems.includes('allris'))return 'ALLRIS ohne erreichbare OParl-Schnittstelle';
 // No linked page answered with a page (verify.mjs records the status only then).
 if(tried.length&&tried.every(t=>t.status!==undefined&&t.status!==200))return noAnswer(tried);
 return 'Kein unterstütztes Ratsinformationssystem erkannt';
}

/** Address key of a catalog entry: one address serves one area, unless the entries fix different bodies. */
export const sourceAddress=s=>(s.system||s.base)+'|'+(s.body||'')+'|'+[...(s.bodies||[])].sort().join(',')+(s.client!==undefined?'|client:'+s.client:'')+(s.organizations?'|organizations:'+JSON.stringify(s.organizations):'')+(s.calendarQuery?'|'+s.calendarQuery:'');
/**
 * An entry that reads only a fixed part of a shared system (OParl body, More! Rubin bodies, the municipality of a KIC
 * app, the bodies of a filter, the client of a SessionNet calendar) takes no meetings of another area.
 */
export const fixedBody=s=>Boolean(s.method==='oparl'||s.body||s.bodies?.length||s.client!==undefined||s.organizations?.include?.length||s.calendarQuery);
