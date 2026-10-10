// Stage 1: find links to the council information system (RIS) on each official municipal website.
// Reads only public pages, follows normal links, identifies itself and never retries a refused request.
import fs from 'node:fs';
import dns from 'node:dns/promises';
import {loadAreas,skipReason} from './areas.mjs';
import {CRAWL_SKIP,unwrapLink,anchors} from './rules.mjs';
import {EXPORT_SCRIPT,exportTokens} from '../../server/integrations/councilservice.mjs';
// DIR, LAND and AREAS let the same search run over another list of areas (another state, or the random sample of the estimate).
const dir=process.env.DIR||'tmp/source-discovery/';
const UA='Ratsmonitor-SourceCatalog/1.0 (public council information; https://github.com/EsMa001/Ratsmonitor)';
const regions=loadAreas();
const wikidata=JSON.parse(fs.readFileSync(dir+'wikidata.json','utf8'));
const configured=new Set(['muenster','billerbeck','coesfeld','steinfurt','borken','warendorf','recklinghausen',...['nrw-sources','nearby-sources','expanded-sources','statewide-sources','nds-sources','de-sources','citystate-sources'].flatMap(f=>{try{return JSON.parse(fs.readFileSync('server/integrations/'+f+'.json','utf8')).map(s=>s.id);}catch{return [];}})]);
const outFile=dir+(process.env.OUT||'candidates.json');
const done=fs.existsSync(outFile)?JSON.parse(fs.readFileSync(outFile,'utf8')):{};
// The areas to search again: a comma-separated list as argument, or a file with one id per line (ONLY_FILE).
const only=process.env.ONLY_FILE?new Set(fs.readFileSync(process.env.ONLY_FILE,'utf8').split(/\s+/).filter(Boolean)):process.argv[2]?new Set(process.argv[2].split(',')):null;
const todo=regions.filter(r=>only?only.has(r.id):!configured.has(r.id)&&!done[r.id]&&!skipReason(r));

export const RIS_HREF=/(sessionnet|councilservice|si00\d\d\.(?:asp|php)|\/info\.(?:asp|php)|\/bi\/|buergerinfo|ratsinfo|allris|sitzung-online\.de|gremien\.info|more-rubin|ratsinfomanagement\.net|sdnetrim|kdz-ws\.net|sessionweb|\/\/session\.|\/\/ris[.-]|\/ris\/|sitzungsdienst|ratsportal|\/oparl|rim\d{4}|gremieninfo|ratsinformation|kreistagsinfo|\/\/rim\.|\/\/sd\.|pv-rat|provox|\/\/politik\.|\/\/rat\.|session\.[a-z0-9-]+\.de|tagesordnung|sitzungskalender)/i;
// "Bürgerinfo" and "Bürgerinformationssystem" name the public part; verify.mjs checks such a link before a
// "Ratsinformationssystem" link next to it (rankCandidates in rules.mjs).
const RIS_TEXT=/(ratsinfo|rats- und bürgerinfo|bürgerinfo|buergerinfo|bürgerinformationssystem|ratsinformation|kreistagsinfo|kreistagsinformation|sitzungskalender|sitzungsdienst|gremieninfo|sitzungstermine|allris|session ?net|ratsportal|rats- und ausschuss|sitzungen)/i;
// Brochures ("Bürgerinfobroschüre"), magazines, forms, livestreams and budget pages share words with council systems.
const NOT_RIS_TEXT=/broschüre|magazin|formular|livestream|video|haushalt|newsletter|app\b/i;
const NAV=/(politik|stadtrat|gemeinderat|kreistag|\brat\b|gremien|rathaus|verwaltung|kommunalpolitik|ortsrecht|sitzung)/i;
// Export of a mein-intra.net system on a page of the website (Sitzungsdienst "councilservice" and other modules): the
// script and a token (initializeExport("<token>"), or the element id a loader hands it, Pößneck). A page that names the
// council service, or one that loads its export only after a click (the page then never says "councilservice"), is a hit.
const embeddedCouncilservice=html=>{const code=String(html||'').replace(/<!--[\s\S]*?-->/g,'');return new RegExp(EXPORT_SCRIPT.source,'i').test(code)&&exportTokens(code).length===1&&(/councilservice/i.test(code)||/initializeExport\(\s*[a-zA-Z_$][\w$]*\.id\s*\)/.test(code));};

// At most two requests at a time on one server, told apart as in verify.mjs by the registrable domain and the address.
// Hosts of municipal websites serve hundreds of them from one address (verwaltungsportal.de: about 350 open areas on two
// addresses) and answered the earlier runs without this limit with HTTP 403 for most of their websites.
// Even so verwaltungsportal.de refused every request for hours after a run on 05.10.2026 (21 pages per website).
// A gentle run over such hosts: SERVER_LIMIT=1 SERVER_PAUSE_MS=3000 (one request at a time, a pause after each) and
// HOME_ONLY=1 (only the start page, where these websites link their council service in the menu).
const PER_SERVER=Number(process.env.SERVER_LIMIT||2),PAUSE=Number(process.env.SERVER_PAUSE_MS||0),slots=new Map(),addresses=new Map();
const addressOf=host=>{if(!addresses.has(host))addresses.set(host,dns.resolve4(host).then(found=>found.sort()[0],()=>null));return addresses.get(host);};
const acquire=key=>{const slot=slots.get(key)||{busy:0,waiting:[]};slots.set(key,slot);if(slot.busy<PER_SERVER){slot.busy++;return Promise.resolve();}return new Promise(turn=>slot.waiting.push(turn));};
const release=key=>{const slot=slots.get(key),turn=slot.waiting.shift();if(turn)turn();else slot.busy--;};
const withHost=async(url,fn)=>{const host=new URL(url).hostname,address=await addressOf(host),keys=['domain:'+host.split('.').slice(-2).join('.'),...(address?['ip:'+address]:[])];for(const key of keys)await acquire(key);try{return await fn();}finally{if(PAUSE)await new Promise(r=>setTimeout(r,PAUSE));for(const key of keys.reverse())release(key);}};
const get=(url,timeout)=>withHost(url,()=>fetchPage(url,timeout));
async function fetchPage(url,timeout=15000){
 const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(timeout),headers:{'User-Agent':UA,Accept:'text/html,application/xhtml+xml'}});
 const type=r.headers.get('content-type')||'';
 if(!r.ok){await r.body?.cancel();return {status:r.status,url:r.url,html:''};}
 if(!/html|xml|text/i.test(type)){await r.body?.cancel();return {status:r.status,url:r.url,html:''};}
 const b=await r.arrayBuffer();const probe=new TextDecoder().decode(b.slice(0,3000));
 const latin=/charset=["']?(?:iso-8859-1|windows-1252)/i.test(type+probe);
 return {status:r.status,url:r.url,html:new TextDecoder(latin?'windows-1252':'utf-8').decode(b.slice(0,3e6))};
}
// Files, social media, read-aloud and sharing services, app stores, directories (findcity.de) and vendor pages: rules.mjs.
const skip=CRAWL_SKIP;
async function crawl(region){
 let sites=[...new Set(wikidata.filter(w=>w.kind===region.kind&&w.ags===region.ags&&w.website).map(w=>w.website))];
 // A municipal association without a website of its own: the website of its member of the same name (an "erfüllende
 // Gemeinde" carries out the tasks of the others), otherwise those of its first members. The system found there still
 // has to name the association itself (verify.mjs).
 if(!sites.length&&Array.isArray(region.members)){
  const named=region.members.filter(m=>m.name===region.shortName),members=[...named,...region.members.filter(m=>!named.includes(m))];
  sites=[...new Set(members.flatMap(m=>wikidata.filter(w=>w.kind==='city'&&w.ags===m.ags&&w.website).map(w=>w.website)))].slice(0,3);
 }
 const found=new Map(),visited=new Set(),log=[];let budget=process.env.HOME_ONLY==='1'?0:20;
 const bare=h=>h.replace(/^www\./,'');
 const IN_SITE=/sessionnet|councilservice|si00[0-9][0-9][.](asp|php)|[/]bi[/]|[/]info[.](asp|php)|[/]allris[/]|[/](si010|si018|gr010|to010|vo020|kp040)([?]|$)/i;
 // A hit is a link that leaves the municipal site (or is an embedded SessionNet path or the council service of
 // mein-intra.net, which the website shows on a page of its own: …/ris.html?href=/councilservice/session/list).
 // Internal pages about the council are explored further.
 // A read-aloud or sharing link counts as the page of the website it carries (readspeaker …&url=…/Ratsinfosystem/).
 const scan=(page,host)=>{const nav=[];
  // A page that embeds the council service by script and links none of its addresses: the page itself, opened on the
  // list of meetings, is the hit (verify.mjs recognises the system there, server/integrations/councilservice.mjs).
  // The page keeps its own query (index.php?id=438); only the address of the embedded system is replaced.
  if(embeddedCouncilservice(page.html)){try{const u=new URL(page.url);for(const key of [...u.searchParams.keys()])if(/^href(?:_|$)/.test(key))u.searchParams.delete(key);u.hash='';const k=u.href+(u.search?'&':'?')+'href=/councilservice/session/list';if(!found.has(k))found.set(k,{url:k,text:'(eingebetteter Sitzungsdienst)',from:page.url,byHref:true});}catch{}}
  for(const link of anchors(page.html,page.url)){const inner=unwrapLink(link.url,host),a=inner?{...link,url:inner}:link;if(skip.test(a.url))continue;let u;try{u=new URL(a.url);}catch{continue;}
   const external=bare(u.hostname)!==host,href=RIS_HREF.test(a.url),text=RIS_TEXT.test(a.text)&&!NOT_RIS_TEXT.test(a.text);
   if((external&&(href||text))||(!external&&IN_SITE.test(a.url))){const k=a.url.split('#')[0];if(!found.has(k))found.set(k,{url:k,text:a.text,from:page.url,byHref:href,byText:text});}
   else if(!external&&(href||text||NAV.test(a.text)||NAV.test(u.pathname)))nav.push({...a,hot:href||text,from:page.url});}
  return nav;};
 for(const site of sites){
  let home;try{home=await get(site);}catch(e){log.push(site+': '+e.message);
   if(site.startsWith('http://'))try{home=await get(site.replace('http://','https://'));}catch(e2){log.push('https: '+e2.message);}
   if(!home)continue;}
  visited.add(home.url);if(home.status!==200){log.push(site+': HTTP '+home.status);continue;}
  const host=bare(new URL(home.url).hostname);
  // Best-first search: pages that look like the council section are opened before general navigation.
  const queue=scan(home,host).map(x=>({...x,depth:1}));
  while(budget>0&&![...found.values()].some(c=>c.byHref)&&queue.length){
   queue.sort((x,y)=>score(y)-score(x)||x.depth-y.depth);
   const a=queue.shift(),k=a.url.split('#')[0];if(visited.has(k))continue;visited.add(k);budget--;
   try{const page=await get(k,12000);
    // Internal redirect links (e.g. /redirect.phtml) that lead to an external system count as a hit.
    if(bare(new URL(page.url).hostname)!==host){if(a.hot||RIS_HREF.test(page.url))found.set(page.url,{url:page.url,text:a.text,from:a.from||home.url,byHref:RIS_HREF.test(page.url),byText:!!a.hot,viaRedirect:k});}
    else if(page.status===200){if(a.depth<3)queue.push(...scan(page,host).map(x=>({...x,depth:a.depth+1})));}
    else log.push(k+': HTTP '+page.status);
   }catch(e){log.push(k+': '+e.message);}
  }
 }
 return {id:region.id,name:region.name,kind:region.kind,ags:region.ags,sites,candidates:[...found.values()].slice(0,40),pages:visited.size,log:log.slice(0,8),searchedAt:Date.now()};
}
const score=a=>(a.hot?6:0)+(/ratsinfo|sitzung|gremien|politik/i.test(a.text+a.url)?3:0)+(/stadtrat|gemeinderat|kreistag|\brat\b/i.test(a.text)?2:0)+(/rathaus|verwaltung/i.test(a.text)?1:0);
const queue=[...todo];let n=0;
// AbortSignal.timeout uses an unreferenced timer; without this interval Node may exit while requests are still pending.
const keepAlive=setInterval(()=>{},1000);
await Promise.all(Array.from({length:12},async()=>{for(let r;(r=queue.shift());){
 let row;try{row=await crawl(r);}catch(e){row={id:r.id,name:r.name,kind:r.kind,ags:r.ags,sites:[],candidates:[],log:['Fehler: '+e.message]};}
 done[r.id]=row;n++;if(n%10===0||!queue.length)fs.writeFileSync(outFile,JSON.stringify(done,null,1));
 console.log(n+'/'+todo.length,r.name,'→',row.candidates.filter(c=>c.byHref).length,'Adress-Treffer,',row.candidates.filter(c=>!c.byHref).length,'Text-Treffer',row.log.length?'| '+row.log[0].slice(0,80):'');
}}));
clearInterval(keepAlive);
fs.writeFileSync(outFile,JSON.stringify(done,null,1));
const rows=Object.values(done);console.log('Gebiete',rows.length,'mit Adress-Treffer',rows.filter(r=>r.candidates.some(c=>c.byHref)).length,'nur Text',rows.filter(r=>!r.candidates.some(c=>c.byHref)&&r.candidates.length).length,'ohne',rows.filter(r=>!r.candidates.length).length);
