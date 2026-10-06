// Stage 1e: areas without a connected council information system (RIS). Searches the official website of each area
// for the notices of meetings it publishes itself (invitations with agenda, minutes, gazettes on the own website, feeds,
// calendars, WordPress API, sitemap) and checks them with the reader "website" (server/integrations/website.mjs).
// A source is accepted only if the reader returns public agenda items and the notices name the area. No database writes.
//
// Areas whose RIS refuses programs (HTTP 403, web firewall) are checked as well: the municipality's website is a
// publication of its own on another machine, and the notices are published there by law. Reading them works around no
// block of the RIS operator as long as no page of the blocked system is read; links to an RIS (host or path of a known
// system, also on the municipality's own domain) are never followed.
//
// Rules: only the website itself: the host of its start page, its subdomains and parent hosts on one registrable domain
// (redirects followed by hand and only there; a sibling under a shared domain is another website); robots.txt of every
// origin is read before its first page, for its sitemaps and as record, but not obeyed (robots-policy.mjs; with
// ROBOTS_POLICY=obey a disallowed path or a robots.txt without answer is not read); a robots.txt answered with 429
// closes the origin; no forms, no site search, no login, no browser identity; no repetition after HTTP 403 or 429, the
// origin is then left for the rest of the run. At most two
// requests at a time per server (domain and IP address, as verify.mjs) and at least one second between two of them;
// this holds for every single request of the reader's check too, which asks with the identity of the search.
//
// Run: node scripts/source-discovery/website.mjs [id,id,…]   (DIR, LAND, AREAS as the other steps)
//  ONLY_FILE=<one id per line>, REASONS='kein Link|Kein unterstütztes' (regular expression on the reason in <DIR>open.json),
//  WINDOW (3m), MAX_PAGES (25 pages of best-first search per website), WORKERS (12 areas at once), SERVER_LIMIT (2) and
//  SERVER_PAUSE_MS (1000, at least) for a gentler run.
// Writes <DIR>candidates-website.json (what was found per website) and <DIR>verified-website.json (format of verify.mjs);
// build.mjs takes the accepted ones where no other check accepted the area.
import fs from 'node:fs';
import dns from 'node:dns/promises';
import {loadAreas,skipReason} from './areas.mjs';
import {NRW_SOURCES} from '../../server/integrations/source-catalog.mjs';
import {robotsVerdict} from '../../server/integrations/robots.mjs';
import {obeyRobots} from '../../server/integrations/robots-policy.mjs';
import {listPageScore,feedLinks,parseFeed,parseIcs,parseSitemap,robotsSitemaps,wpApiRoot,jsonLdEvents,generatorOf,sessionScore,SESSION_THRESHOLD,documentLinks,isCmsFileUrl} from '../../server/integrations/website-feeds.mjs';
import {collectWebsite,fetchSiteText,fetchSiteBytes} from '../../server/integrations/website.mjs';
import {registrableDomain,sameSite,isRisLink,serverGate,readerFetch,robotsRefused,navLinks,pickListPages,orderSitemaps,sessionUrls,sitemapPages,selectAreas,sitesOf,expectNames,buildSource,hasMaterial,checkOf,acceptedEntry,reasonOf,bestReason,summary,REASONS} from './website-plan.mjs';
const dir=process.env.DIR||'tmp/source-discovery/';
const UA='Ratsmonitor-SourceCatalog/1.0 (public council information; https://github.com/EsMa001/Ratsmonitor)';
const TOKENS=['vorort-politicaltopics','ratsmonitor-sourcecatalog'];
const WINDOW=process.env.WINDOW||'3m',MAX_PAGES=Number(process.env.MAX_PAGES)||25,WORKERS=Number(process.env.WORKERS)||12;
const MAX_DEPTH=3,TIMEOUT=15000,MAX_BYTES=4e6,MAX_SITEMAPS=3,MAX_FEEDS=5,MAX_ICS=3;
const today=new Date().toISOString().slice(0,10);
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const regions=loadAreas(),wikidata=read(dir+'wikidata.json');
const core=['muenster','billerbeck','coesfeld','steinfurt','borken','warendorf','recklinghausen'];
const connected=new Set([...core,...NRW_SOURCES.filter(s=>s.method!=='pending').map(s=>s.id)]);
const candFile=dir+'candidates-website.json',outFile=dir+'verified-website.json';
const found=fs.existsSync(candFile)?read(candFile):{},done=fs.existsSync(outFile)?read(outFile):{};
// The areas to search (again): a comma-separated list as argument, or a file with one id per line (ONLY_FILE).
const only=process.env.ONLY_FILE?new Set(fs.readFileSync(process.env.ONLY_FILE,'utf8').split(/\s+/).filter(Boolean)):process.argv[2]?new Set(process.argv[2].split(',')):null;
const reasons=process.env.REASONS?new RegExp(process.env.REASONS,'i'):null;
const open=reasons?new Map(read(dir+'open.json').map(o=>[o.id,o.reason])):new Map();
const todo=selectAreas(regions,{connected,done,only,reasons,open,skip:skipReason});

// --- consideration per server ------------------------------------------------------------------------------------------
// Many small municipal websites share one hosting machine; only its address reveals that. Locks per registrable domain
// and per IP address, always in this order, so two requests never wait for each other.
// SERVER_LIMIT and SERVER_PAUSE_MS make a run gentler for hosts that refuse busier ones (verwaltungsportal.de).
const PER_SERVER=Math.min(2,Number(process.env.SERVER_LIMIT)||2),GAP=Math.max(1000,Number(process.env.SERVER_PAUSE_MS)||1000),addresses=new Map();
const addressOf=host=>{if(!addresses.has(host))addresses.set(host,dns.resolve4(host).then(list=>list.sort()[0],()=>null));return addresses.get(host);};
const withHost=serverGate({perServer:PER_SERVER,gap:GAP,keysOf:async url=>{const host=new URL(url).hostname,address=await addressOf(host);return ['domain:'+registrableDomain(host),...(address?['ip:'+address]:[])];}});

// --- requests ----------------------------------------------------------------------------------------------------------
// A body is read up to MAX_BYTES; the rest is not transferred.
async function body(r){
 const reader=r.body?.getReader();if(!reader)return new Uint8Array();
 const parts=[];let size=0;
 for(;;){const {done:end,value}=await reader.read();if(end)break;parts.push(value);size+=value.length;if(size>=MAX_BYTES){await reader.cancel().catch(()=>{});break;}}
 const out=new Uint8Array(Math.min(size,MAX_BYTES));let at=0;for(const p of parts){const take=Math.min(p.length,out.length-at);out.set(p.subarray(0,take),at);at+=take;if(at>=out.length)break;}
 return out;
}
const decodeBody=(bytes,type)=>{const probe=new TextDecoder().decode(bytes.slice(0,3000));const latin=/charset=["']?(?:iso-8859-1|windows-1252|latin-?1)/i.test(type+probe);return new TextDecoder(latin?'windows-1252':'utf-8').decode(bytes);};
// robots.txt once per origin. Its redirects are followed on the same website only (http → https, www);
// a redirect elsewhere or no answer counts as "not known", and nothing is read from that origin.
const robotsFiles=new Map();
function robotsFile(origin){
 if(!robotsFiles.has(origin))robotsFiles.set(origin,(async()=>{
  const host=new URL(origin).hostname;let url=origin+'/robots.txt';
  for(let hop=0;hop<=5;hop++){
   let r;try{r=await withHost(url,async()=>{const res=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(TIMEOUT),headers:{'User-Agent':UA,Accept:'text/plain'}});const to=res.status>=300&&res.status<400?res.headers.get('location'):null;const text=res.ok?decodeBody(await body(res),'').slice(0,500000):(await res.body?.cancel(),'');return {status:res.status,to,text};});}
   catch{return {status:0,text:''};}
   if(!r.to)return {status:r.status,text:r.text};
   const next=new URL(r.to,url).href;if(!sameSite(next,host))return {status:0,text:''};url=next;
  }
  // More than five redirects: RFC 9309 lets a crawler take robots.txt as unavailable.
  return {status:404,text:''};
 })());
 return robotsFiles.get(origin);
}
// Origins that answered 403 or 429: never asked again in this run.
const blocked=new Map();
// A refusal of robots.txt itself (429) is no missing robots.txt: the origin is closed as after any other refusal.
const robotsOf=async url=>{const u=new URL(url),f=await robotsFile(u.origin);if(robotsRefused(f.status)){blocked.set(u.origin,f.status);return 'unklar';}return robotsVerdict(f.status,f.text,u.pathname+u.search,TOKENS);};
const secure=url=>String(url).replace(/^http:/i,'https:');
/**
 * One address of the website of host: robots.txt first, redirects by hand on that website only (every target asked
 * against its own robots.txt), never an RIS address. Returns {status,url,body,type} or with robots/error/blocked.
 */
async function get(url,host,{accept='text/html,application/xhtml+xml',types=/html|xml|text/i}={}){
 for(let hop=0;;hop++){
  if(!sameSite(url,host))return {status:0,url,body:'',error:'Weiterleitung auf fremden Rechner '+(()=>{try{return new URL(url).hostname;}catch{return url;}})(),foreign:true};
  if(isRisLink(url))return {status:0,url,body:'',error:'Adresse eines Ratsinformationssystems (wird nicht gelesen)'};
  const origin=new URL(url).origin;
  if(blocked.has(origin))return {status:blocked.get(origin),url,body:'',blocked:true};
  const robots=await robotsOf(url);
  // A refusal of robots.txt itself (429) closed the origin; otherwise robots.txt decides only with ROBOTS_POLICY=obey.
  if(blocked.has(origin))return {status:blocked.get(origin),url,body:'',blocked:true};
  if(obeyRobots()&&(robots==='verboten'||robots==='unklar'))return {status:0,url,body:'',robots};
  let r;
  try{r=await withHost(url,async()=>{
   const res=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(TIMEOUT),headers:{'User-Agent':UA,Accept:accept}});
   const type=res.headers.get('content-type')||'',to=res.status>=300&&res.status<400?res.headers.get('location'):null;
   if(!res.ok||to||type&&!types.test(type)){await res.body?.cancel();return {status:res.status,to,type,text:''};}
   return {status:res.status,type,text:decodeBody(await body(res),type)};
  });}catch(e){return {status:0,url,body:'',error:String(e.cause?.code||e.name==='TimeoutError'&&'Zeitüberschreitung'||e.message).slice(0,120)};}
  if(r.to){if(hop>=5)return {status:r.status,url,body:'',error:'zu viele Weiterleitungen'};url=new URL(r.to,url).href;continue;}
  if(r.status===403||r.status===429){blocked.set(origin,r.status);return {status:r.status,url,body:''};}
  if(r.status!==200)return {status:r.status,url,body:'',type:r.type};
  return {status:200,url,body:r.text,type:r.type};
 }
}

// The reader's check asks with the same consideration as the search (readerRequest in website-plan.mjs).
const readerRequest=readerFetch({withHost,blocked,userAgent:UA,request:fetch});
const readerGet=(url,source,timeoutMs)=>fetchSiteText(url,source,timeoutMs,readerRequest);
const readerBytes=(url,source,timeoutMs)=>fetchSiteBytes(url,source,timeoutMs,readerRequest);

// --- search of one website -----------------------------------------------------------------------------------------------
// The start page as Wikidata names it, over https first; http is asked only when https does not answer, and the page
// reached has to be on https (the reader reads nothing else).
async function openHome(site){
 const start=new URL(site).href,host=new URL(start).hostname;let last=null;
 for(const t of [...new Set([secure(start),start])]){last=await get(t,host);if(last.status===200||last.robots||last.status===403||last.status===429||last.foreign)break;}
 if(last.status===200&&!/^https:/.test(last.url))return {...last,status:0,error:'nur über http erreichbar'};
 return last;
}
const isSession=(url,label)=>sessionScore({url:url||'',label:label||''})>=SESSION_THRESHOLD;
async function searchSite(site){
 const row={site,status:0,base:null,generator:null,pages:[],listPages:[],feeds:[],ics:[],wp:null,sitemaps:[],events:0,log:[]};
 const home=await openHome(site);
 row.status=home.status;if(home.robots)row.robots=home.robots;if(home.error)row.error=home.error;
 if(home.status!==200)return row;
 const origin=new URL(home.url).origin,host=new URL(home.url).hostname;
 row.base=origin+'/';row.generator=generatorOf(home.body);
 const scored=new Map(),feeds=new Map(),visited=new Set([home.url,secure(site)]),files=new Map();let wp=null;
 const look=page=>{
  // Documents of meetings that the page links on the file storage of the website's CMS (daten2.verwaltungsportal.de).
  files.set(page.url,documentLinks(page.body,page.url).filter(l=>isCmsFileUrl(l.url)&&sessionScore(l)>=SESSION_THRESHOLD).map(l=>l.url).slice(0,3));
  const events=jsonLdEvents(page.body,page.url).filter(e=>isSession(e.url,e.name)).length;row.events+=events;
  scored.set(page.url,listPageScore(page.body,page.url)+events);
  for(const f of feedLinks(page.body,page.url))if(sameSite(f.url,host)&&!isRisLink(f.url)&&!feeds.has(secure(f.url)))feeds.set(secure(f.url),f);
  wp=wp||wpApiRoot(page.body,page.url);
 };
 look(home);
 // Sitemaps: those robots.txt names, otherwise the usual address; an index is read with its likely parts first.
 const fromSitemap=[];
 {const queue=robotsSitemaps((await robotsFile(origin)).text).filter(u=>sameSite(u,host)).map(secure);if(!queue.length)queue.push(origin+'/sitemap.xml');
  for(let files=0;queue.length&&files<MAX_SITEMAPS&&!blocked.has(origin);){const u=queue.shift();if(/\.gz(?:[?#]|$)/i.test(u))continue;files++;
   const p=await get(u,host,{accept:'application/xml,text/xml',types:/xml|text/i});if(p.status!==200){row.log.push('Sitemap '+u+': '+(p.robots?'robots.txt '+p.robots:p.error||'HTTP '+p.status));continue;}
   const map=parseSitemap(p.body,p.url);queue.unshift(...orderSitemaps(map.sitemaps.filter(s=>sameSite(s,host)).map(secure)));
   const hits=sessionUrls(map.urls).filter(u=>sameSite(u,host));if(hits.length)row.sitemaps.push({url:p.url,urls:map.urls.length,sessionUrls:hits.length});
   fromSitemap.push(...sitemapPages(map.urls,host));}}
 // Best-first search from the start page: notices, council and meetings before the town hall in general.
 const queue=[...navLinks(home.body,home.url,host),...fromSitemap].map(l=>({...l,depth:1}));
 for(let budget=MAX_PAGES;budget>0&&queue.length&&!blocked.has(origin);){
  queue.sort((a,b)=>b.score-a.score||a.depth-b.depth);
  const next=queue.shift(),url=secure(next.url);if(visited.has(url))continue;visited.add(url);budget--;
  const p=await get(url,host);
  if(p.status!==200){row.log.push(url+': '+(p.robots?'robots.txt '+p.robots:p.error||'HTTP '+p.status));continue;}
  if(p.url!==url){if(visited.has(p.url))continue;visited.add(p.url);}
  look(p);
  if(next.depth<MAX_DEPTH)for(const l of navLinks(p.body,p.url,host))if(!visited.has(secure(l.url)))queue.push({...l,depth:next.depth+1});
 }
 row.pages=[...scored].map(([url,score])=>({url,score})).sort((a,b)=>b.score-a.score).slice(0,10);
 row.listPages=pickListPages(row.pages);
 row.files=[...new Set(row.listPages.flatMap(u=>files.get(u)||[]))];
 // Feeds and calendars count only if one of their entries looks like a meeting.
 const list=[...feeds.values()];
 for(const f of list.filter(f=>f.type!=='ics').slice(0,MAX_FEEDS)){
  const p=await get(secure(f.url),host,{accept:'application/rss+xml,application/atom+xml,application/xml,text/xml',types:/xml|rss|atom|text/i});if(p.status!==200)continue;
  const entries=parseFeed(p.body,p.url);row.feeds.push({url:p.url,type:f.type,entries:entries.length,sessionEntries:entries.filter(e=>isSession(e.url,e.title)).length});
 }
 for(const f of list.filter(f=>f.type==='ics').slice(0,MAX_ICS)){
  const p=await get(secure(f.url),host,{accept:'text/calendar',types:/calendar|text|octet/i});if(p.status!==200)continue;
  const events=parseIcs(p.body);row.ics.push({url:p.url,events:events.length,sessionEvents:events.filter(e=>isSession(e.url,e.summary)).length});
 }
 // The WordPress API where the site announces it. It is an interface for programs: robots.txt (recorded in the log)
 // does not decide over it, also not with ROBOTS_POLICY=obey (shared/source-access.mjs); a refusal of the host does.
 if(wp&&sameSite(wp,host)&&!isRisLink(wp)){const v=await robotsOf(secure(wp));if(!blocked.has(new URL(secure(wp)).origin))row.wp=secure(wp);else row.log.push('WordPress-API: Rechner weist Programme ab');if(v==='verboten')row.log.push('WordPress-API: robots.txt nennt den Pfad (gilt nicht für die Schnittstelle)');}
 if(blocked.has(origin))row.log.push('Abbruch: HTTP '+blocked.get(origin));
 row.log=row.log.slice(0,12);
 return row;
}

// --- one area ------------------------------------------------------------------------------------------------------------
async function searchArea(area){
 const sites=sitesOf(area,wikidata),result={id:area.id,name:area.name,kind:area.kind,ags:area.ags,tried:[]},cand={id:area.id,name:area.name,kind:area.kind,ags:area.ags,sites,found:[],searchedAt:Date.now()};
 if(!sites.length){result.reason=REASONS.nothing+' (keine offizielle Website bekannt)';return {result,cand};}
 const why=[];
 for(const site of sites){
  let row;try{row=await searchSite(site);}catch(e){row={site,status:0,error:e.message.slice(0,160),pages:[],listPages:[],feeds:[],ics:[],sitemaps:[],log:[]};}
  cand.found.push(row);
  const note={site,base:row.base,status:row.status,...(row.robots?{robots:row.robots}:{}),...(row.error?{error:row.error}:{}),generator:row.generator||null};
  if(row.status!==200){why.push(reasonOf({robots:row.robots,status:row.status}));result.tried.push(note);continue;}
  const source=buildSource({area,base:row.base,pages:row.listPages,feeds:row.feeds.filter(f=>f.sessionEntries>0).map(f=>f.url),ics:row.ics.filter(f=>f.sessionEvents>0).map(f=>f.url),wp:row.wp,sitemap:row.sitemaps.map(s=>s.url),files:row.files||[]});
  note.source=source;
  if(!hasMaterial(source)){why.push(REASONS.nothing);result.tried.push(note);continue;}
  let check=null,error=null;
  try{const d=await collectWebsite(source,{window:WINDOW,maxDurationMs:150000,expectNames:expectNames(area),get:readerGet,getBytes:readerBytes});check=checkOf(d);note.check=check;}
  catch(e){error=e.message.slice(0,160);note.error=error;}
  result.tried.push(note);
  const reason=reasonOf({robots:row.robots,status:200,found:true,check,error});
  if(!reason){result.accepted=acceptedEntry(source,{website:site,today,window:WINDOW,check});return {result,cand};}
  why.push(reason);
 }
 result.reason=bestReason(why)||REASONS.nothing;
 return {result,cand};
}

const queue=[...todo];let n=0;
const save=()=>{fs.writeFileSync(candFile,JSON.stringify(found,null,1));fs.writeFileSync(outFile,JSON.stringify(done,null,1));};
// AbortSignal.timeout uses an unreferenced timer; without this interval Node may exit while requests are still pending.
const keepAlive=setInterval(()=>{},1000);
await Promise.all(Array.from({length:WORKERS},async()=>{for(let area;(area=queue.shift());){
 let out;try{out=await searchArea(area);}
 // A failed area is not recorded, so that the next run asks it again.
 catch(e){n++;console.log(n+'/'+todo.length,area.name,'→ Fehler:',e.message);continue;}
 out.result.checkedAt=Date.now();done[area.id]=out.result;found[area.id]=out.cand;n++;
 if(n%10===0||!queue.length)save();
 const a=out.result.accepted;
 console.log(n+'/'+todo.length,area.name,'→',a?`website ${a.base} (${a.evidence.topics} Artikel, ${a.pages.length} Listenseiten${a.feeds?', Feed':''}${a.ics?', iCal':''}${a.wp?', WordPress':''}${a.sitemap?', Sitemap':''})`:'– '+out.result.reason);
}}));
clearInterval(keepAlive);
save();
const s=summary(done,found);
console.log(`Gebiete ${s.areas}, übernommen ${s.accepted}`);
for(const [reason,count] of s.reasons)console.log(`  ${count} × ${reason}`);
console.log('Häufigste CMS: '+(s.cms.slice(0,8).map(([cms,count])=>`${cms} ${count}`).join(', ')||'–'));
