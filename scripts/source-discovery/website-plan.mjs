// Pure decisions of the website search (website.mjs): which areas to search, which links to follow, which pages count
// as lists of meeting notices, how the catalog entry looks and why an area is not taken. Importing this file asks no
// network and reads no file; tests/website-discovery.test.mjs checks it.
import {sessionScore,SESSION_THRESHOLD,documentLinks,isRisLink,isSearchLink,isCmsFileUrl,TRANSLATED} from '../../server/integrations/website-feeds.mjs';

/** A page counts as a list of meeting notices from this score of listPageScore (one heading and one notice, or three notices). */
export const MIN_LIST_SCORE=3;
/** At most this many list pages go into a catalog entry; the reader reads at most 12 list pages including their following pages. */
export const MAX_LIST_PAGES=5;
export const REASONS={
 robots:'robots.txt der Website untersagt Programmen den Abruf',
 forbidden:'Website antwortet Programmen mit HTTP 403',
 unreachable:'Website nicht erreichbar',
 nothing:'Keine Seite mit Sitzungsbekanntmachungen gefunden',
 unreadable:'Bekanntmachungen gefunden, aber keine öffentlichen Tagesordnungspunkte lesbar',
 foreign:'Gefundene Bekanntmachungen nennen das Gebiet nicht',
};
// robots.txt is recorded, not obeyed (robots-policy.mjs); the check says nothing about it.
export const API_CHECK='Kein Ratsinformationssystem angebunden; öffentliche Bekanntmachungen der offiziellen Website.';

const norm=s=>String(s??'').normalize('NFC').toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
const pathText=url=>{try{const u=new URL(url);let p=u.pathname+' '+u.search;try{p=decodeURIComponent(p);}catch{/* keep as written */}return p;}catch{return '';}};

/** The registrable domain of a host: its last two labels (German municipalities use second-level domains). */
export const registrableDomain=host=>String(host??'').toLowerCase().replace(/\.$/,'').split('.').slice(-2).join('.');
// The website is the host of its start page without "www.", its subdomains and the hosts it is a subdomain of, all on
// one registrable domain. A sibling (another member municipality under the domain of its association, b.vg-x.de for
// a.vg-x.de) is another website; the reader accepts the same family only (siteAllowed in server/integrations/website.mjs).
const bare=host=>String(host??'').toLowerCase().replace(/\.$/,'').replace(/^www\./,'');
const related=(a,b)=>a===b||a.endsWith('.'+b)||b.endsWith('.'+a);
/** An https or http address on the website whose start page lies on host. */
export function sameSite(url,host){try{const u=new URL(url);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password&&registrableDomain(u.hostname)===registrableDomain(host)&&related(bare(u.hostname),bare(host));}catch{return false;}}

// Addresses of a council information system are never followed (isRisLink, shared with the reader).
export {isRisLink};

// --- consideration per server -----------------------------------------------------------------------------------------
/**
 * withHost(url, fn) of the search: fn runs while it holds a slot of every key of the address (registrable domain and
 * IP address, always in this order, so two requests never wait for each other), at most perServer at a time per key,
 * and starts at least gap ms after the start before it on any of its keys. keysOf(url) → Promise<string[]>.
 */
export function serverGate({perServer=2,gap=1000,keysOf,sleep=ms=>new Promise(d=>setTimeout(d,ms))}){
 const slots=new Map(),nextAt=new Map(),started=new Map();
 const acquire=key=>{const slot=slots.get(key)||{busy:0,waiting:[]};slots.set(key,slot);if(slot.busy<perServer){slot.busy++;return Promise.resolve();}return new Promise(turn=>slot.waiting.push(turn));};
 const release=key=>{const slot=slots.get(key),turn=slot.waiting.shift();if(turn)turn();else slot.busy--;};
 return async(url,fn)=>{
  const keys=await keysOf(url);
  for(const key of keys)await acquire(key);
  // The start is reserved before waiting: two requests waiting for one server never start within gap.
  const at=Math.max(Date.now(),...keys.map(k=>nextAt.get(k)||0));for(const k of keys)nextAt.set(k,at+gap);
  try{
   if(at>Date.now())await sleep(at-Date.now());
   // A timer that fired late moves the start before it: the gap counts from the starts that really happened.
   for(let due;(due=Math.max(0,...keys.map(k=>(started.get(k)??-Infinity)+gap)))>Date.now();)await sleep(due-Date.now());
   const now=Date.now();for(const k of keys)started.set(k,now);
   return await fn();
  }finally{for(const key of [...keys].reverse())release(key);}
 };
}
/**
 * The request function the reader's check is given (fetchSiteText/fetchSiteBytes keep redirects and robots.txt): every
 * single request through withHost, with the identity of the search, never to an origin in blocked (it answered 403 or
 * 429; such an answer closes the origin) and never to an RIS address. request: the fetch function of the script.
 */
export function readerFetch({withHost,blocked,userAgent,request}){
 return async(url,init={})=>{
  const origin=new URL(url).origin;
  if(blocked.has(origin))return new Response('',{status:blocked.get(origin)});
  if(isRisLink(url))throw Error('Adresse eines Ratsinformationssystems (wird nicht gelesen)');
  const res=await withHost(url,()=>request(url,{...init,headers:{...init.headers,'User-Agent':userAgent}}));
  if(res.status===403||res.status===429)blocked.set(origin,res.status);
  return res;
 };
}

/** A robots.txt answered with 429 is a refusal, not a missing file: nothing is read from that origin in this run. */
export const robotsRefused=status=>status===429;

// Downloads, other services and pages that never lead to notices.
const SKIP=/\.(?:pdf|jpe?g|png|gif|svg|webp|zip|docx?|xlsx?|pptx?|ics|mp[34]|mov|avi|css|js|xml|rss|gz)(?:[?#]|$)|\/(?:impressum|datenschutz\w*|kontakt|barrierefrei\w*|sitemap|login|anmeld\w*|warenkorb|newsletter)(?:[/.?#]|$)/i;
const NAV_STRONG=/bekanntmachung|amtstafel|amtliche nachrichten|amtsblatt|mitteilungsblatt|gemeindeblatt|nachrichtenblatt|amtsbote|sitzung|gemeinderat|stadtrat|marktrat|marktgemeinderat|gemeindevertretung|stadtverordnet|stadtvertretung|ortschaftsrat|ortsrat|ortsbeirat|kreistag|niederschrift|sitzungsbericht|beschluesse|tagesordnung|ratssitzung/;
const NAV_MEDIUM=/politik|gremien|\brat\b|ortsrecht|ausschuss|ausschuesse|satzungen/;
const NAV_WEAK=/rathaus|verwaltung|aktuelles|aktuell\b|neuigkeiten|nachrichten|meldungen|news\b/;
/**
 * How promising a link of the website is for the search of notice lists: 0 for links not to follow (other kinds of
 * files, RIS, forms, search, services), -100 for the non-public part, otherwise 1 (town hall, news) to 6 (notices,
 * council, meetings). A single dated notice counts 1: the list that links it is what the search wants.
 */
export function navScore({url,label}={}){
 if(!url||isRisLink(url)||isSearchLink(url)||SKIP.test(url)||TRANSLATED.test(url))return 0;
 const s=sessionScore({url,label});if(s===-100)return -100;if(s<=-4)return 0;
 const t=norm(`${label??''} ${pathText(url)}`);
 let n=(NAV_STRONG.test(t)?3:0)+(NAV_MEDIUM.test(t)?2:0)+(NAV_WEAK.test(t)?1:0);
 if(n>=3&&/bekanntmachung|amtstafel|sitzung/.test(t))n+=1;
 if(/(?<!\d)\d{1,2}\.\s?\d{1,2}\.\s?\d{4}(?!\d)|(?<!\d)\d{4}[-_]\d{2}[-_]\d{2}(?!\d)/.test(`${label??''} ${pathText(url)}`)&&s>=SESSION_THRESHOLD)n=Math.min(n,1);
 return Math.min(n,6);
}
/** Links of a page worth following on the website of host, best first: [{url,label,score}]. */
export function navLinks(html,pageUrl,host){
 return documentLinks(html,pageUrl).filter(l=>l.kind==='html'&&sameSite(l.url,host)).map(l=>({url:l.url,label:l.label,score:navScore(l)})).filter(l=>l.score>0).sort((a,b)=>b.score-a.score);
}

// "/bekanntmachungen/page/2/" and "?seite=2" belong to the list "/bekanntmachungen/".
const PAGE_KEY=/^(?:page|seite|p|paged|pg|start|offset|.*\[currentpage\]|.*\[@widget_0\]\[currentpage\])$/i;
/** The list an address belongs to, without its page number. */
export function listKey(url){
 try{const u=new URL(url);u.hash='';for(const k of [...u.searchParams.keys()])if(PAGE_KEY.test(k))u.searchParams.delete(k);
  return u.origin+(u.pathname.replace(/\/(?:page|seite)\/\d+\/?$/i,'').replace(/\/index\.(?:php|html?)$/i,'').replace(/\/+$/,'')||'/')+(u.search);}catch{return String(url);}
}
/**
 * The list pages of a catalog entry from the pages the search scored ([{url,score}]): score at least MIN_LIST_SCORE,
 * never a page of a council system or one whose address names the non-public part, one page per list (a following
 * page of a list is read by the reader itself), highest score first, at most MAX_LIST_PAGES.
 */
export function pickListPages(scored,{max=MAX_LIST_PAGES,min=MIN_LIST_SCORE}={}){
 const best=new Map();
 for(const p of scored||[]){if(!p?.url||!(p.score>=min)||isRisLink(p.url)||sessionScore({url:p.url,label:''})===-100)continue;
  const key=listKey(p.url),seen=best.get(key);
  if(!seen||p.score>seen.score||p.score===seen.score&&p.url.length<seen.url.length)best.set(key,{url:p.url,score:p.score});}
 return [...best.values()].sort((a,b)=>b.score-a.score||a.url.length-b.url.length||a.url.localeCompare(b.url)).slice(0,max).map(p=>p.url);
}

const SITEMAP_HINT=/sitzung|politik|gremi|rat\b|rat[-_.]|bekanntmach|amtsblatt|mitteilungsblatt|amtstafel|aktuell|news|nachricht|meldung|termin|veranstaltung|event|post/i;
/** Sitemaps of an index in reading order: those whose address hints at meetings, politics or news first. */
export const orderSitemaps=urls=>[...new Set(urls||[])].map((u,i)=>({u,i,hit:SITEMAP_HINT.test(pathText(u))})).sort((a,b)=>Number(b.hit)-Number(a.hit)||a.i-b.i).map(x=>x.u);
/** Addresses of a sitemap that look like documents of meetings. */
export const sessionUrls=urls=>(urls||[]).filter(u=>sessionScore({url:u.url??u,label:''})>=SESSION_THRESHOLD).map(u=>u.url??u);
/** Addresses of a sitemap worth opening as possible list pages: [{url,label,score}], at most max. */
export function sitemapPages(urls,host,max=10){
 return (urls||[]).map(u=>({url:u.url??u,lastmod:u.lastmod??null})).filter(u=>sameSite(u.url,host)).map(u=>({url:u.url,label:'',lastmod:u.lastmod,score:navScore({url:u.url,label:''})}))
  .filter(u=>u.score>=3).sort((a,b)=>b.score-a.score||String(b.lastmod??'').localeCompare(String(a.lastmod??''))).slice(0,max).map(({url,label,score})=>({url,label,score}));
}

// --- areas -----------------------------------------------------------------------------------------------------------
/** Areas to search: named ones (argument, ONLY_FILE), otherwise those without a connected source and not yet checked; REASONS narrows by the reason in open.json. */
export function selectAreas(areas,{connected=new Set(),done={},only=null,reasons=null,open=new Map(),skip=()=>null}={}){
 return (areas||[]).filter(a=>{if(skip(a))return false;
  if(reasons&&!reasons.test(open.get(a.id)??''))return false;
  if(only)return only.has(a.id);
  return !connected.has(a.id)&&!done[a.id];});
}
/** Official websites of an area (Wikidata P856); for a municipal association without one, those of its member of the same name and its first members (at most 3). */
export function sitesOf(area,wikidata){
 let sites=[...new Set((wikidata||[]).filter(w=>w.kind===area.kind&&w.ags===area.ags&&w.website).map(w=>w.website))];
 if(!sites.length&&Array.isArray(area.members)){
  const named=area.members.filter(m=>m.name===area.shortName),members=[...named,...area.members.filter(m=>!named.includes(m))];
  sites=[...new Set(members.flatMap(m=>(wikidata||[]).filter(w=>w.kind==='city'&&w.ags===m.ags&&w.website).map(w=>w.website)))].slice(0,3);
 }
 return sites;
}
const TYPE=/^(?:Große Kreisstadt|Kreisfreie Stadt|Kreisstadt|Hansestadt|Universitätsstadt|Stadt|Marktgemeinde|Markt|Gemeinde|Ortsgemeinde|Samtgemeinde|Verbandsgemeinde|Verwaltungsgemeinschaft|Verwaltungsverband|Gemeindeverwaltungsverband|Erfüllende Gemeinde|Amt|Flecken|Landkreis|Kreis|Städteregion|Regionalverband|Region)\s+/i;
// "Neustadt in Sachsen", "Dillingen a.d.Donau", "Lahr/Schwarzwald", "Hennef (Sieg)": the name without its addition.
const plain=n=>n.replace(/\(.*?\)/g,'').replace(/\s+(an der|am|im|in der|in|bei|vor der|ob der|unter|über|auf der|auf dem)\s+.*$/i,'').replace(/\s+[a-zäöü]{1,3}\.\s?(?:[a-zäöü]{1,3}\.\s?)?\S.*$/i,'').replace(/[/,].*$/,'').replace(/\s+/g,' ').trim();
/** Names the notices have to name for the area (expectNames of the reader): full name, short name, both without addition, the members' names. */
export function expectNames(area){
 const raw=[area?.name,area?.shortName,String(area?.name??'').replace(TYPE,''),...(Array.isArray(area?.members)?area.members.map(m=>m.name):[])].filter(Boolean);
 const out=[];for(const n of raw.flatMap(n=>[n,plain(n)]).map(n=>String(n).replace(/\s+/g,' ').trim()))if(n.length>=3&&!out.some(o=>o.toLowerCase()===n.toLowerCase()))out.push(n);
 return out;
}

// --- catalog entry ---------------------------------------------------------------------------------------------------
const originOf=url=>{try{return new URL(url).origin;}catch{return null;}};
/**
 * The catalog entry the reader is checked with. Only fields with content are written: pages, feeds and ics as lists,
 * wp (API root) and sitemap (one file; the reader follows an index itself) as one address. alsoFrom lists the other
 * https origins of the base host's family that any of them lie on, and the file storage of the website's CMS where the
 * list pages link documents of meetings (files: their addresses).
 */
export function buildSource({area,base,pages=[],feeds=[],ics=[],wp=null,sitemap=null,files=[]}){
 const root=new URL(base),inSite=u=>/^https:/i.test(String(u))&&sameSite(u,root.hostname);
 const list=v=>[...new Set((v||[]).filter(inSite))];
 const source={id:area.id,name:area.name,kind:area.kind,method:'scraper',adapter:'website',base:root.origin+'/',pages:list(pages)};
 const f=list(feeds),c=list(ics),map=[].concat(sitemap??[]).find(inSite);
 if(f.length)source.feeds=f;if(c.length)source.ics=c;if(wp&&inSite(wp))source.wp=wp;if(map)source.sitemap=map;
 const others=[...new Set([...source.pages,...f,...c,...(map?[map]:[]),...(source.wp?[source.wp]:[]),...files.filter(isCmsFileUrl)].map(originOf).filter(o=>o&&o!==root.origin))].sort();
 if(others.length)source.alsoFrom=others;
 return source;
}
/** Whether a source has anything for the reader to read. */
export const hasMaterial=s=>!!(s&&(s.pages?.length||s.feeds?.length||s.ics?.length||s.wp||s.sitemap));
const count=v=>Array.isArray(v)?v.length:Number.isFinite(v)?v:0;
/** The figures of a reader result that the check records. */
export function checkOf(result){
 const c=result?.coverage||{};
 return {topics:count(result?.topics),meetings:count(c.meetings),documents:count(c.documents),namesArea:c.namesArea===true,unparsed:count(c.unparsed),unreadable:count(c.unreadable),issues:[...new Set((c.issues||[]).map(String))].slice(0,4)};
}
/** Taken only if the reader returned public agenda items and the notices name the area. */
export const isAccepted=check=>!!check&&check.topics>0&&check.namesArea===true;
/** The accepted entry of verified-website.json. */
export function acceptedEntry(source,{website,today,window,check}){
 return {...source,verifiedSource:website,verifiedAt:today,apiCheck:API_CHECK,evidence:{window,topics:check.topics,meetings:check.meetings,documents:check.documents}};
}

// --- reasons ---------------------------------------------------------------------------------------------------------
/**
 * Why a website was not taken, from what its search and check found:
 * {robots:'erlaubt'|'verboten'|'keine'|'unklar', status (start page), found (material for the reader), check, error}.
 * Returns null when the check accepts the source.
 */
export function reasonOf({robots,status,found,check,error}={}){
 if(robots==='verboten')return REASONS.robots;
 if(status===403)return REASONS.forbidden;
 if(robots==='unklar')return REASONS.unreachable+' (robots.txt ohne Antwort)';
 if(status!==200)return REASONS.unreachable+(status?` (HTTP ${status})`:'');
 if(!found)return REASONS.nothing;
 if(error)return `${REASONS.unreadable} (Leser brach ab: ${String(error).slice(0,120)})`;
 if(isAccepted(check))return null;
 if(check&&check.topics>0)return REASONS.foreign;
 return `${REASONS.unreadable} (${check?.unparsed??0} ohne erkennbaren öffentlichen Teil, ${check?.unreadable??0} nicht lesbar)`;
}
// The further a website got, the more its reason says: an association whose first member's website is closed but whose
// second member's notices were read names the second reason.
const ORDER=[REASONS.robots,REASONS.forbidden,REASONS.unreachable,REASONS.nothing,REASONS.unreadable,REASONS.foreign];
const rank=r=>ORDER.findIndex(o=>String(r??'').startsWith(o));
/** The reason of the website that got furthest. */
export const bestReason=reasons=>(reasons||[]).filter(Boolean).reduce((best,r)=>best===null||rank(r)>rank(best)?r:best,null);

// --- summary ---------------------------------------------------------------------------------------------------------
/** The product a generator line names: "TYPO3 CMS" → TYPO3, "WordPress 6.6.2" → WordPress. */
export function cmsOf(generator){
 const g=String(generator??'').trim();if(!g)return null;
 const known=g.match(/typo3|wordpress|joomla|contao|drupal|ikiss|weblication|govcms|government site builder|six cms|imperia|opencms|plone|neos|wix|jimdo|site ?kit|redaxo|processwire|craft cms|shopware/i)?.[0];
 return known?known.replace(/^./,c=>c.toUpperCase()).replace(/^Typo3$/,'TYPO3').replace(/^Ikiss$/i,'IKISS'):g.split(/[\s,;(]/)[0].replace(/[\d.]+$/,'')||g;
}
/** Counts of a finished run: areas, accepted, reasons (without their part in brackets) and content management systems. */
export function summary(rows,candidates={}){
 const tally=list=>Object.entries(list.reduce((a,k)=>(a[k]=(a[k]||0)+1,a),{})).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 const all=Object.values(rows||{});
 return {areas:all.length,accepted:all.filter(r=>r.accepted).length,
  reasons:tally(all.filter(r=>!r.accepted&&r.reason).map(r=>r.reason.replace(/ \(.*\)$/,''))),
  cms:tally(Object.values(candidates||{}).flatMap(c=>(c.found||[]).map(f=>cmsOf(f.generator)).filter(Boolean)))};
}
