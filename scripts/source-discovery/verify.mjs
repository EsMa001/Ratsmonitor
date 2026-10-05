// Stage 2: classify the links found in stage 1 and verify each proposed source with the real collectors.
// A source is accepted only if the collector returns public agenda items from it. No database writes.
import fs from 'node:fs';
import dns from 'node:dns/promises';
import {loadAreas,skipReason,foreignOwner} from './areas.mjs';
import {collectSessionNet,sessionNetLandmark} from '../../server/integrations/sessionnet.mjs';
import {collectRegionalOparl} from '../../server/integrations/oparl-regional.mjs';
import {collectRubin,readRubinBodies,rubinBodyMatch,detectRubin} from '../../server/integrations/more-rubin.mjs';
import {collectSdnet} from '../../server/integrations/sdnet.mjs';
import {collectAllris} from '../../server/integrations/allris.mjs';
import {robotsVerdict} from '../../server/integrations/robots.mjs';
import {READERS} from '../../server/integrations/readers.mjs';
import {fetchText} from '../../server/integrations/sessionnet.mjs';
import {SERVICE,unwrapLink,followUpsAfterFailure,MEMBERS_AREA,publicSiblings,allrisBases,allrisGeneration,hrefs,title,identity} from './rules.mjs';
// DIR and AREAS let the same check run over another list of areas (e.g. the random sample of the estimate).
const dir=process.env.DIR||'tmp/source-discovery/';
const UA='Ratsmonitor-SourceCatalog/1.0 (public council information; https://github.com/EsMa001/Ratsmonitor)';
const candidates=JSON.parse(fs.readFileSync(dir+(process.env.CANDIDATES||'candidates.json'),'utf8'));
const outFile=dir+(process.env.OUT||'verified.json');
const done=fs.existsSync(outFile)?JSON.parse(fs.readFileSync(outFile,'utf8')):{};
// The areas to check (again): a comma-separated list as argument, or a file with one id per line (ONLY_FILE).
const only=process.env.ONLY_FILE?new Set(fs.readFileSync(process.env.ONLY_FILE,'utf8').split(/\s+/).filter(Boolean)):process.argv[2]?new Set(process.argv[2].split(',')):null;
const WINDOW=process.env.WINDOW||'3m';
const today=new Date().toISOString().slice(0,10);
// At most two requests or checks at a time on one server, as in the import (pipeline-jobs.mjs). A server is told apart
// like there: by the registrable domain of its operator and by its address. A lock per host name would let every
// worker reach another subdomain of one operator at once; operators such as sitzung-online.de then block the network.
// SERVER_LIMIT and SERVER_PAUSE_MS (a pause after each request or check) for hosts that refuse busier runs (crawl.mjs).
const PER_SERVER=Number(process.env.SERVER_LIMIT||2),PAUSE=Number(process.env.SERVER_PAUSE_MS||0),slots=new Map(),addresses=new Map();
const addressOf=host=>{if(!addresses.has(host))addresses.set(host,dns.resolve4(host).then(found=>found.sort()[0],()=>null));return addresses.get(host);};
const acquire=key=>{const slot=slots.get(key)||{busy:0,waiting:[]};slots.set(key,slot);if(slot.busy<PER_SERVER){slot.busy++;return Promise.resolve();}return new Promise(turn=>slot.waiting.push(turn));};
const release=key=>{const slot=slots.get(key),turn=slot.waiting.shift();if(turn)turn();else slot.busy--;};
// Always the domain first and the address second, so two checks never wait for each other.
const withHost=async(url,fn)=>{const host=new URL(url).hostname,address=await addressOf(host),keys=['domain:'+host.split('.').slice(-2).join('.'),...(address?['ip:'+address]:[])];for(const key of keys)await acquire(key);try{return await fn();}finally{if(PAUSE)await new Promise(r=>setTimeout(r,PAUSE));for(const key of keys.reverse())release(key);}};
// robots.txt of a host is read before its first page (one request per host); a path it disallows for the programs of
// this project is not asked, the candidate is recorded with robots:'verboten' (verdicts as in source-robots.json).
// IGNORE_ROBOTS=1 switches the check off.
const TOKENS=['vorort-politicaltopics','ratsmonitor-sourcecatalog'],robotsFiles=new Map();
const robotsFile=u=>{if(!robotsFiles.has(u.origin))robotsFiles.set(u.origin,(async()=>{try{const r=await fetch(u.origin+'/robots.txt',{redirect:'follow',signal:AbortSignal.timeout(15000),headers:{'User-Agent':UA}});return {status:r.status,text:r.ok?(await r.text()).slice(0,20000):''};}catch{return {status:0,text:''};}})());return robotsFiles.get(u.origin);};
async function robotsAllowFree(url){if(process.env.IGNORE_ROBOTS==='1')return true;const u=new URL(url),file=await robotsFile(u);return robotsVerdict(file.status,file.text,u.pathname,TOKENS)!=='verboten';}
async function robotsAllow(url){
 if(process.env.IGNORE_ROBOTS==='1')return true;
 const u=new URL(url);
 if(!robotsFiles.has(u.origin))robotsFiles.set(u.origin,withHost(url,async()=>{try{const r=await fetch(u.origin+'/robots.txt',{redirect:'follow',signal:AbortSignal.timeout(15000),headers:{'User-Agent':UA}});return {status:r.status,text:r.ok?(await r.text()).slice(0,20000):''};}catch{return {status:0,text:''};}}));
 const file=await robotsFiles.get(u.origin);return robotsVerdict(file.status,file.text,u.pathname,TOKENS)!=='verboten';
}
async function page(url,timeout=15000,hops=1){
 // Redirects are followed by hand: every target has to be allowed by its robots.txt (a Wicket application sends
 // ";jsessionid=" addresses that its robots.txt disallows).
 let r;for(let n=0;;n++){
  r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(timeout),headers:{'User-Agent':UA,Accept:'text/html,application/xhtml+xml'}});
  const to=r.status>=300&&r.status<400&&r.headers.get('location');if(!to)break;await r.body?.cancel();
  const next=new URL(to,url).href;if(n>=5)return {status:r.status,url,html:'',error:'zu viele Weiterleitungen'};
  if(!await robotsAllowFree(next))return {status:0,url:next,html:'',error:'robots.txt untersagt die Weiterleitungsadresse',robots:'verboten'};
  url=next;
 }
 Object.defineProperty(r,'url',{value:url});
 if(!r.ok){await r.body?.cancel();return {status:r.status,url:r.url,html:''};}
 const type=r.headers.get('content-type')||'';if(!/html|xml|text|json/i.test(type)){await r.body?.cancel();return {status:r.status,url:r.url,html:''};}
 const b=await r.arrayBuffer();const probe=new TextDecoder().decode(b.slice(0,3000));const latin=/charset=["']?(?:iso-8859-1|windows-1252)/i.test(type+probe);
 const html=new TextDecoder(latin?'windows-1252':'utf-8').decode(b.slice(0,3e6));
 // A start page that only forwards by <meta http-equiv="refresh"> (SessionNet: default.asp) is followed once on the
 // same host; the page reached is what the check looks at.
 const refresh=html.length<6000&&html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["']\s*\d+\s*;\s*url=([^"'>\s]+)/i)?.[1];
 if(refresh&&hops>0){try{const next=new URL(refresh.replace(/&amp;/g,'&'),r.url);if(next.host===new URL(r.url).host&&next.href!==r.url&&await robotsAllowFree(next.href)){const p=await page(next.href,timeout,hops-1);if(p.status===200)return p;}}catch{}}
 return {status:r.status,url:r.url,html};
}
async function probeOparl(url){
 try{const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{Accept:'application/json','User-Agent':UA}});
  if(r.status!==200){await r.body?.cancel();return null;}const t=await r.text();if(t.length>2e6)return null;const j=JSON.parse(t);return /\/(System|Body)$/.test(j.type||'')?j:null;}catch{return null;}
}
function sessionNetBase(urls){
 for(const u of urls){const m=u.match(/^(https?:\/\/[^?#]*\/)(?:si0040|si0041|si0046|si0057|info|default|kp0041|kp0040|gr0040|vo0040|to0040|pa0040|suchen01|recherche|do0040|au0040|yw0040)\.(asp|php)/i);if(m)return {base:m[1].replace(/^http:/,'https:'),extension:m[2].toLowerCase()};}
 return null;
}
// A linked start page often shows no SessionNet address itself (it redirects by script, or sits in a frame, or the
// system lives at the root of its own host). Then the usual entry page is asked for next to it. Plain requests only.
// The members' area of SessionNet answers with its login (ylogon); it is never the public calendar.
const loginPage=p=>/ylogon\.(asp|php)/i.test(p.url)||/smc-pagetype-logon/i.test(p.html);
// The public part of a system next to its members' area (gi/, ri/, ratsinfo, sessionnetri): publicSiblings in rules.mjs.
async function findSessionNet(url){
 const u=new URL(url),here=u.origin+u.pathname.replace(/[^/]*$/,''),bases=[...new Set([here.replace(/\/(gi|ri)\/$/i,'/bi/'),here,...publicSiblings(here),u.origin+'/',u.origin+'/bi/',here+'bi/'])];
 // A host that did not answer at all (time limit, network error) is not asked again for its other folders.
 const silent=new Set();
 for(const base of bases)for(const extension of ['asp','php']){
  if(silent.has(new URL(base).origin))continue;
  // robots.txt decides for every address asked here as well; the search next to a failed page asks several.
  if(!await robotsAllow(base+'si0040.'+extension))continue;
  let p;try{p=await withHost(base,()=>page(base+'si0040.'+extension,12000));}catch{silent.add(new URL(base).origin);continue;}
  const mark=p.status===200&&!loginPage(p)?sessionNetLandmark(p.html):null;if(mark&&!mark.issue&&/si005[67]\.|smc-|kalender|to0040\./i.test(p.html))return {base:new URL(p.url).href.replace(/si0040\.(asp|php).*$/i,'').replace(/^http:/,'https:'),extension};
 }
 return null;
}
// Links to read-aloud and sharing services, directories and vendor pages are no council systems (SERVICE in rules.mjs).
// A read-aloud or sharing link counts as the page of the website it carries (unwrapLink).
// SD.NET usually sits at the root of its host, sometimes in a folder of its own (ratsinfo.kassel.de/sdnet4/) or of
// the tenant (rim.ekom21.de/<mandant>/); that folder is the base of the reader and of the vendor's OParl address.
const sdnetBase=url=>{const u=new URL(url);return u.origin+'/'+(u.pathname.match(/^\/((?:sdnet\d*|rim\d{4})\/)/i)?.[1]||'');};
// SD.NET on a host of its own does not always name the product on its start page; its list of papers does.
async function isSdnet(url){
 try{const p=await withHost(url,()=>page(sdnetBase(url)+'vorlagen',12000));return p.status===200&&/SD\.NET|sdnet/i.test(p.html);}catch{return false;}
}
// ALLRIS 4 folders (allrisBases) and the generation of an ALLRIS page (allrisGeneration): rules.mjs.
function systemOf(url,html){
 const s=url+' '+html.slice(0,300000);
 // KISA's "Ratsinfosystem" (ris-<name>.zv-kisa.de) is the newer interface of More! Rubin; its start page names neither.
 if(/gremien\.info|more-rubin|more! ?rubin/i.test(s)||/^https?:\/\/ris-[^/]+\.zv-kisa\.de\//i.test(url)||detectRubin(url,html))return 'more-rubin';
 if(/sdnetrim|ratsinfomanagement\.net|SD\.NET|sternberg|rim\d{4}\//i.test(s))return 'sdnet';
 if(/allris/i.test(s))return 'allris';
 if(/sessionnet|somacos|si0040\.(asp|php)|smc-/i.test(s))return 'sessionnet';
 if(/provox/i.test(s))return 'provox';
 return 'unknown';
}
// OParl systems that a page links with their files (…/oparl/bodies/0001/downloadfiles/…, Karlsruhe's calendar on
// web2.karlsruhe.de/ris/oparl): the system address is the folder before "bodies".
const oparlLinked=(html,base)=>[...new Set(hrefs(html||'',base).map(h=>h.match(/^(https?:\/\/[^?#]+\/oparl)\/(?:bodies|body|files?|meetings?|papers?)\//i)?.[1]).filter(Boolean).map(s=>s+'/system'))].slice(0,2);
function oparlGuesses(url,sn,html){
 const u=new URL(url),out=[...oparlLinked(html,url)];const prefix=u.pathname.match(/^\/((?:rim|gkz)\d+|sdnet\d*)\//i)?.[1];
 if(sn)out.push(sn.base+'oparl/1.0/system.'+sn.extension);
 const roots=[u.origin+'/',...(prefix?[u.origin+'/'+prefix+'/']:[])];
 for(const root of roots.reverse())for(const p of ['webservice/oparl/v1.1/system','webservice/oparl/v1.0/system','public/oparl/system','oparl/system','oparl/v1.1/system','oparl'])out.push(root+p);
 return [...new Set(out.map(x=>x.replace(/^http:/,'https:')))];
}
async function infoIdentity(region,sn){
 try{const info=await withHost(sn.base,()=>page(sn.base+'info.'+sn.extension,12000));if(info.status!==200||loginPage(info))return null;
  const clients=info.html.match(/<a\b[^>]*smcfiltermenumandant[^>]*>[\s\S]*?<\/a>/gi)||[],own=clients.length>1?clients.reduce((h,a)=>h.replace(a,' '),info.html):info.html;
  const who=identity(region,sn.base,own);return who.ok?{ok:true,by:'Infoseite des Systems ('+who.by+')'}:null;}catch{return null;}
}
// The linked system must name the area itself (identity in rules.mjs); a city page linking to its district's system is
// not a source for the city.
// Committees that only a district has. A town's system never holds a Kreistag or Kreisausschuss.
const DISTRICT_BODY=/\bkreistag|\bkreisausschuss|\bkreis\w{0,30}ausschuss/i;
const districtCommittees=topics=>topics.some(t=>[t.committee,...(t.events||[]).map(e=>e.committee)].some(name=>DISTRICT_BODY.test(String(name||''))));
async function verify(region,row){
 const result={id:region.id,name:region.name,kind:region.kind,tried:[],systems:[]};
 const strong=/ris-portal\.de|komuna\.net|cm-ratsinfos\.de|si00\d\d|sessionnet|\/bi\/|gremien\.info|ratsinfomanagement|sdnetrim|allris|sitzung-online|oparl|buergerinfo|ratsinfo|kdz-ws|session/i;
 const ordered=row.candidates.map(c=>{let inner=null;try{inner=c.from?unwrapLink(c.url,new URL(c.from).hostname):null;}catch{/* no page */}return inner?{...c,url:inner,unwrapped:c.url}:c;}).filter(c=>!SERVICE.test(c.url)).sort((a,b)=>Number(strong.test(b.url))-Number(strong.test(a.url))||Number(b.byHref)-Number(a.byHref)).slice(0,6);
 const seenBases=new Set(),seenUrls=new Set(ordered.map(c=>c.url));let hops=0;
 // Guessed addresses on shared hosts are not proof of assignment; links from the official website and its own domain are.
 const trusted=c=>!(c.guessed&&c.guessed!=='eigene Domain');
 // exact: only the given address (an OParl address known from the register or the vendor, oparl-register.mjs).
 const tryOparl=async(url,sn,note,verifiedSource,trusted=true,exact=false,html='')=>{
  for(const guess of exact?[url.replace(/^http:/,'https:')]:oparlGuesses(url,sn,html)){
   // robots.txt decides for every address asked, also for the vendor's standard paths.
   if(!await robotsAllow(guess))continue;
   const system0=await withHost(guess,()=>probeOparl(guess));if(!system0)continue;note.oparl=guess;
   // Areas outside the NRW catalog carry their official key explicitly, so the body can be matched by it
   // (Lower Saxon Samtgemeinden: 9-digit regional key).
   let source={id:region.id,name:region.name,kind:region.kind,...(process.env.AREAS&&/^[0-9]{5}([0-9]{3,4})?$/.test(region.ags||'')?{ags:region.ags}:{}),system:guess,method:'oparl',...Object.fromEntries(['body','organizations'].map(k=>[k,row.candidates.find(x=>x.url===url)?.[k]]).filter(([,v])=>v)),...(String(system0.id||'').startsWith('http://')||String(system0.body||'').startsWith('http://')?{upgradeHttpLinks:true}:{})};
   const collect=async()=>{let d=await withHost(guess,()=>collectRegionalOparl(source,{window:WINDOW,maxDurationMs:150000}));
    // A large system (Karlsruhe) answers the date filter too slowly for its time box; the reader then lists from the end
    // and stops at its list limit before a recent meeting. Asked once more with the filter and without the time box.
    if(!d.topics.length&&!source.meetingScan&&d.coverage.issues.some(i=>/Listenlimit/.test(i))){const again=await withHost(guess,()=>collectRegionalOparl({...source,meetingScan:'filter'},{window:WINDOW,maxDurationMs:150000}));if(again.topics.length){source={...source,meetingScan:'filter'};d=again;}}note.oparlTopics=d.topics.length;note.oparlIssues=d.coverage.issues.slice(0,4);
    // The list method that delivered the meetings is fixed in the entry, so every import uses the verified one.
    return d.topics.length?{...source,...(['filter','end','forward'].includes(d.coverage.listStrategy)?{meetingScan:d.coverage.listStrategy}:{}),state:'system-verified',verifiedSource,verifiedAt:today,evidence:{window:WINDOW,topics:d.topics.length,meetings:d.coverage.meetings,body:d.coverage.body}}:null;};
   try{const got=await collect();if(got)return got;}
   catch(e){note.oparlError=e.message.slice(0,160);
    // The system is linked from the official website and serves exactly one body whose name or key differs
    // (e.g. "Stadt Emmerich" for Emmerich am Rhein, "Instance 0001"): that body is assigned explicitly.
    if(trusted&&/nicht eindeutig/.test(e.message)){
     try{const body=await withHost(guess,()=>onlyBody(system0));
      if(body&&!(region.kind==='city'&&/^(kreis|landkreis|kreisverwaltung)\s/i.test(body.name||''))&&!(region.kind==='district'&&/^(stadt|gemeinde)\s/i.test(body.name||''))){
       source={...source,body:String(body.id).replace(/^http:/,'https:'),note:`Einzige Körperschaft des von der offiziellen Website verlinkten Systems („${body.name||''}“); fest zugeordnet.`};
       const got=await collect();if(got){delete note.oparlError;return got;}}
     }catch(e2){note.oparlError=e2.message.slice(0,160);}
    }
   }
   break;
  }
  return null;
 };
 const onlyBody=async system=>{
  const getJson=async u=>{const r=await fetch(String(u).replace(/^http:/,'https:'),{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});if(r.status!==200){await r.body?.cancel();throw Error('OParl HTTP '+r.status);}return r.json();};
  let bodies=system.body;if(typeof bodies==='string')bodies=(await getJson(bodies)).data||[];
  const resolved=[];for(const b of (bodies||[]).slice(0,5))resolved.push(typeof b==='string'?await getJson(b):b);
  const usable=resolved.filter(b=>b&&!b.deleted&&b.meeting&&b.id);return usable.length===1&&resolved.length===1?usable[0]:null;
 };
 for(let i=0;i<ordered.length&&i<12;i++){const c=ordered[i];
  // An OParl address from the register or of a linked vendor tenant: only the interface itself is asked, no page and
  // no other path (the pages of ekom21 tenants are closed to programs).
  if(c.oparlOnly){const note={url:c.url,from:c.from,register:c.register};const got=await tryOparl(c.url,null,note,c.from||c.url,trusted(c),true);result.tried.push(note);if(got){result.accepted=got;return result;}continue;}
  // A system that one reader of readers.mjs reads, whose pages the check itself would not get past (München: the
  // application answers with session addresses that robots.txt disallows): the reader is asked directly.
  if(c.reader&&READERS[c.reader]){
   const reader=READERS[c.reader],note={url:c.url,from:c.from,reader:c.reader},fields=await reader.detect(c.url,'',{}).catch(()=>null),who=identity(region,c.url,'');note.identity=who;
   if(fields?.base&&who.ok&&await robotsAllow(fields.base)){
    const source={id:region.id,name:region.name,kind:region.kind,method:'scraper',adapter:c.reader,...fields};
    try{const d=await withHost(source.base,()=>reader.collect(source,{window:WINDOW,maxDurationMs:150000}));note.readerTopics=d.topics.length;note.readerMeetings=d.coverage.meetings;note.readerIssues=[...new Set(d.coverage.issues)].slice(0,4);
     if(d.topics.length){result.accepted={...source,verifiedSource:/^https?:/.test(c.from||'')?c.from:c.url,verifiedAt:today,apiCheck:`Keine offizielle OParl-Schnittstelle gefunden; ${reader.name} erreichbar.`,evidence:{window:WINDOW,topics:d.topics.length,meetings:d.coverage.meetings,identity:who.by}};result.tried.push(note);return result;}
    }catch(e){note.readerError=e.message.slice(0,160);}
   }
   result.tried.push(note);continue;
  }
  if(!await robotsAllow(c.finalUrl||c.url)){result.tried.push({url:c.url,robots:'verboten',from:c.from});continue;}
  let p;try{p=await withHost(c.url,()=>page(c.finalUrl||c.url));}catch(e){p={status:0,url:c.url,html:'',error:e.message};}
  // Many official websites still link with http://; the systems themselves answer only on https://.
  if(p.status!==200&&/^http:/.test(c.finalUrl||c.url)){const secure=(c.finalUrl||c.url).replace(/^http:/,'https:');try{const again=await withHost(secure,()=>page(secure));if(again.status===200)p=again;}catch{}}
  if(p.status!==200){
   // The page is not readable for programs (or failed). Only the official interface is asked; a refusal is never worked around.
   const note={url:c.url,status:p.status,error:p.error,from:c.from};const key=new URL(c.url).origin+'|oparl-only';
   if(!seenBases.has(key)&&strong.test(c.url)){seenBases.add(key);const got=await tryOparl(c.url,null,note,c.from||c.url,trusted(c));if(got){result.accepted=got;result.tried.push(note);return result;}}
   // A SessionNet folder that moved or timed out (404, 0, broken redirect chain): the entry page next to it is asked; a
   // More! Rubin path that is gone: the root of the host. Never after 401/403 or a robots.txt refusal (rules.mjs).
   // What is found becomes the next candidate and passes robots.txt, identity and the readers like any other.
   const next=followUpsAfterFailure(c.finalUrl||c.url,p),follow=url=>{if(seenUrls.has(url))return false;seenUrls.add(url);ordered.splice(i+1,0,{url,from:c.from,byHref:true,...(c.guessed?{guessed:c.guessed}:{}),after:c.url});return true;};
   if(next.nearby){const sn=await findSessionNet(c.finalUrl||c.url);if(sn&&follow(sn.base+'si0040.'+sn.extension))note.nearby=sn.base;}
   if(next.root&&follow(next.root))note.nearby=next.root;
   result.tried.push(note);continue;}
  // An internal page about the council: follow its links to an external system once.
  if(hops<8)for(const u of new Set(hrefs(p.html,p.url))){if(seenUrls.has(u)||!strong.test(u)||/[.](pdf|jpe?g|png|css|js|ico|svg)([?]|$)/i.test(u))continue;if(new URL(u).hostname===new URL(p.url).hostname&&!/si00[0-9][0-9]|[/]bi[/]|sessionnet/i.test(u))continue;seenUrls.add(u);ordered.push({url:u,from:p.url,byHref:true});if(++hops>=8)break;}
  const all=[p.url,...hrefs(p.html,p.url)];let system=systemOf(p.url,p.html);
  let sn=sessionNetBase(all.filter(u=>new URL(u).hostname===new URL(p.url).hostname).concat(all));
  // A login page, or an address that names the members' area: look for the public part next to it.
  if(sn&&(loginPage(p)||MEMBERS_AREA.test(sn.base)))sn=await findSessionNet(sn.base)||sn;
  else if(!sn&&loginPage(p))sn=await findSessionNet(p.url);
  if(!sn&&(system==='sessionnet'||system==='unknown')&&(strong.test(p.url)||/<meta[^>]+name=["']sessionnet["']/i.test(p.html)))sn=await findSessionNet(p.url);
  if(sn&&system==='unknown')system='sessionnet';
  if(!sn&&system==='unknown'&&strong.test(p.url)&&await isSdnet(p.url))system='sdnet';
  if(!result.systems.includes(system))result.systems.push(system);
  const key=(sn?.base||new URL(p.url).origin)+'|'+system;if(seenBases.has(key))continue;seenBases.add(key);
  // TRUST_LINK: for units that have no name of their own in the system (an association reached through a member
  // municipality), the link from the official website is the evidence. A district page is still never a city's source.
  let who=identity(region,sn?.base||p.url,p.html);
  // A district's own website links its council system, but address and start page often name neither the district nor
  // its Kreistag (muenchen.gremien.info for the Landkreis München). Then the meetings read decide: committees of a
  // district (Kreistag, Kreisausschuss) confirm the system; a town's committees do not.
  const byCommittees=region.kind==='district'&&!who.ok&&/^(Kreisbezug|Gebietsname)/.test(who.why||'')&&trusted(c);
  if(!who.ok&&process.env.TRUST_LINK&&!c.guessed&&who.why!=='Seite gehört erkennbar zu einem Kreis')who={ok:true,by:'Verweis von der offiziellen Website'};
  // The address names another municipality and not this one: a shared system whose councils the readers cannot separate.
  if(who.ok&&region.kind==='city'){const owner=foreignOwner(region,sn?.base||p.url,regions);if(owner)who={ok:false,why:'Adresse nennt '+owner+' (mitbenutztes System)'};}
  const note={url:p.url,system,title:title(p.html),identity:who,from:c.from};
  // The address read can lie elsewhere than the candidate: after a redirect, or the public part of SessionNet next to
  // the members' area (ratsinfo.kyritz.de → buergerinfo.kyritz.de). Its robots.txt decides as well.
  if(!await robotsAllow(sn?.base||p.url)){note.robots='verboten';result.tried.push(note);continue;}
  // SessionNet's start page or month grid often names nobody; its info page names the client ("Sitzungsdienst der
  // Kreisstadt Neunkirchen", "Kreistag des Landkreises Görlitz"). The client list of the search form is left out: a
  // shared system lists all its members there.
  if(!who.ok&&sn&&/^(Gebietsname|Kreisbezug)/.test(who.why||'')){const again=await infoIdentity(region,sn);if(again){who=again;if(region.kind==='city'){const owner=foreignOwner(region,sn.base,regions);if(owner)who={ok:false,why:'Adresse nennt '+owner+' (mitbenutztes System)'};}note.identity=who;}}
  // More! Rubin: the list of bodies names the area when start page and address do not (vgtt.gremien.info for the
  // Verbandsgemeinde Traben-Trarbach). It also says which bodies of a shared system belong to the area.
  let rubin=null;
  if(system==='more-rubin'){
   const found=detectRubin(p.url,p.html),base=found?.base||new URL(p.url).origin+'/';
   rubin={base,endpoint:found?.endpoint,bodies:null};
   try{rubin.bodies=await withHost(base,()=>readRubinBodies({id:region.id,base},{get:(u,src)=>fetchText(u,src),endpoint:found?.endpoint}));}catch(e){note.rubinError='Körperschaften nicht lesbar: '+e.message.slice(0,120);}
   if(rubin.bodies){rubin.own=rubinBodyMatch(rubin.bodies,region);
    if(!who.ok&&trusted(c)&&rubin.own.length&&/^(Gebietsname|Kreisbezug)/.test(who.why||'')){who={ok:true,by:'Körperschaft im System ('+rubin.bodies.filter(b=>rubin.own.includes(b.id)).map(b=>b.name).join(', ').slice(0,80)+')'};note.identity=who;}}
  }
  const verifiedSource=(c.from||c.url);
  const confirmed=d=>{if(who.ok)return true;if(!byCommittees||!districtCommittees(d.topics))return false;who={ok:true,by:'Gremien des Kreises (Kreistag, Kreisausschuss) in den gelesenen Sitzungen; System von der offiziellen Website verlinkt'};note.identity=who;return true;};
  // 1. Official OParl interface, if one answers and the body is unambiguous.
  {const got=await tryOparl(p.url,sn,note,verifiedSource,trusted(c),false,p.html);if(got){result.accepted=got;result.tried.push(note);return result;}}
  if(!who.ok&&!byCommittees){result.tried.push(note);continue;}
  // 2. More! Rubin public calendar interface.
  if(system==='more-rubin'){
   const source={id:region.id,name:region.name,kind:region.kind,method:'official-api',adapter:'more-rubin',base:rubin.base,...(rubin.endpoint==='webservice'?{endpoint:'webservice'}:{})};
   try{
    // One system may serve several bodies (KISA: Crimmitschau and Dennheritz; lauenburg.gremien.info: the town and the
    // Amt Lütau). The reader then reads only the bodies of this area; without a readable list of bodies nothing is taken.
    if(!rubin.bodies){result.tried.push(note);continue;}
    if(rubin.bodies.length>1){if(!rubin.own.length){note.rubinError='Mehrere Körperschaften im System ('+rubin.bodies.map(b=>b.name).join(', ').slice(0,120)+'); keine gehört zum Gebiet';result.tried.push(note);continue;}if(rubin.own.length<rubin.bodies.length)source.bodies=rubin.own;}
    const d=await withHost(source.base,()=>collectRubin(source,{window:WINDOW,maxDurationMs:120000}));note.rubinTopics=d.topics.length;note.rubinIssues=d.coverage.issues.slice(0,4);
    if(d.topics.length&&confirmed(d)){result.accepted={...source,verifiedSource,verifiedAt:today,apiCheck:note.oparl?'OParl-Adresse antwortet, lieferte aber keine verwertbaren Sitzungen; öffentliche Kalender-API erreichbar.':'Kein nutzbarer OParl-Endpunkt an den geprüften Standardpfaden; öffentliche Kalender-API erreichbar.',evidence:{window:WINDOW,topics:d.topics.length,meetings:d.coverage.meetings,identity:who.by}};result.tried.push(note);return result;}
   }catch(e){note.rubinError=e.message.slice(0,160);}
  }
  // Order: OParl where it works; otherwise the public pages. If an OParl address answered above but delivered
  // nothing usable, the page scraper is the fallback and the catalog entry records why (oparlFallback).
  const germanDate=today.split('-').reverse().join('.');
  const fallback=note.oparl?{oparlFallback:{system:note.oparl,reason:(note.oparlError||(note.oparlIssues||[]).join(' · ')||'keine öffentlichen Tagesordnungspunkte im Prüfzeitraum').slice(0,200),checkedAt:today}}:{};
  const fallbackCheck=note.oparl?`OParl-Adresse ${note.oparl} antwortete am ${germanDate}, lieferte aber keine verwertbaren Sitzungen (${fallback.oparlFallback.reason}); deshalb öffentliche Seiten.`:null;
  // 3. Public SessionNet pages.
  if(sn){
   const source={id:region.id,name:region.name,kind:region.kind,method:'scraper',base:sn.base,extension:sn.extension};
   try{const d=await withHost(sn.base,()=>collectSessionNet(source,{window:WINDOW,maxDurationMs:150000}));note.snTopics=d.topics.length;note.snMeetings=d.coverage.meetings;note.snIssues=[...new Set(d.coverage.issues)].slice(0,4);
    if(d.topics.length&&confirmed(d)){result.accepted={...source,...fallback,verifiedSource,verifiedAt:today,apiCheck:fallbackCheck||`Öffentlicher Hersteller-Standardpfad oparl/1.0/system.${sn.extension} lieferte am ${germanDate} kein OParl-System. Andere API-Adressen sind damit nicht ausgeschlossen; öffentlicher SessionNet-Kalender erreichbar.`,evidence:{window:WINDOW,topics:d.topics.length,meetings:d.coverage.meetings,identity:who.by}};result.tried.push(note);return result;}
   }catch(e){note.snError=e.message.slice(0,160);}
  }
  // 4. Public SD.NET pages.
  if(system==='sdnet'){
   const source={id:region.id,name:region.name,kind:region.kind,method:'scraper',adapter:'sdnet',base:sdnetBase(p.url)};
   try{const d=await withHost(source.base,()=>collectSdnet(source,{window:WINDOW,maxDurationMs:150000}));note.sdTopics=d.topics.length;note.sdMeetings=d.coverage.meetings;note.sdIssues=[...new Set(d.coverage.issues.map(i=>i.replace(/https?:\S+/g,'…')))].slice(0,4);
    if(d.topics.length&&confirmed(d)){result.accepted={...source,...fallback,verifiedSource,verifiedAt:today,apiCheck:fallbackCheck||`OParl-Schnittstelle des Herstellers (webservice/oparl/v1.1/system) war am ${germanDate} nicht aktiviert; öffentliche SD.NET-Seiten erreichbar.`,evidence:{window:WINDOW,topics:d.topics.length,meetings:d.coverage.meetings,identity:who.by}};result.tried.push(note);return result;}
   }catch(e){note.sdError=e.message.slice(0,160);}
  }
  // 5. Public ALLRIS 4 pages. The reader asks the system's own OParl address first and keeps one session.
  // ALLRIS 3 (an .asp address, a folder that frames or links only .asp programs) is left to its reader in step 6.
  if(system==='allris'&&allrisGeneration(p.url,p.html)===3)note.allrisGeneration=3;
  else if(system==='allris'){
   for(const base of allrisBases(p.url,p.html)){
    const source={id:region.id,name:region.name,kind:region.kind,method:'scraper',adapter:'allris',base};
    try{const d=await withHost(base,()=>collectAllris(source,{window:WINDOW,maxDurationMs:150000,checkOparl:!note.oparl}));note.allrisTopics=d.topics.length;note.allrisMeetings=d.coverage.meetings;note.allrisIssues=[...new Set(d.coverage.issues.map(i=>i.replace(/https?:\S+/g,'…')))].slice(0,4);delete note.allrisError;
     if(d.topics.length&&confirmed(d)){result.accepted={...source,...fallback,verifiedSource,verifiedAt:today,apiCheck:fallbackCheck||`OParl-Adresse des Systems (${base}oparl/system) lieferte am ${germanDate} kein OParl-System; öffentliche ALLRIS-Seiten erreichbar.`,evidence:{window:WINDOW,topics:d.topics.length,meetings:d.coverage.meetings,identity:who.by}};result.tried.push(note);return result;}
     // The system asked not to be read by programs (or not right now): no further address of it is tried.
     if(note.allrisIssues.some(i=>/Zugriffsprüfung|zu viele Zugriffe/.test(i)))break;
    }catch(e){note.allrisError=e.message.slice(0,160);}
   }
  }
  // 6. Further readers (server/integrations/readers.mjs): the first that recognises the page reads it.
  for(const [adapter,reader] of Object.entries(READERS)){
   let fields;try{fields=await reader.detect(p.url,p.html,{get:(u,src)=>withHost(u,()=>fetchText(u,src))});}catch(e){note.readerError=adapter+': '+e.message.slice(0,140);continue;}
   if(!fields?.base)continue;
   if(!result.systems.includes(adapter))result.systems.push(adapter);note.reader=adapter;
   const source={id:region.id,name:region.name,kind:region.kind,method:'scraper',adapter,...fields};
   if(!await robotsAllow(source.base)){note.robots='verboten';break;}
   try{const d=await withHost(source.base,()=>reader.collect(source,{window:WINDOW,maxDurationMs:150000,...(reader.oparlCheck?{checkOparl:!note.oparl}:{})}));note.readerTopics=d.topics.length;note.readerMeetings=d.coverage.meetings;note.readerIssues=[...new Set(d.coverage.issues.map(i=>i.replace(/https?:\S+/g,'…')))].slice(0,4);
    if(d.topics.length&&confirmed(d)){result.accepted={...source,...fallback,verifiedSource,verifiedAt:today,apiCheck:fallbackCheck||`Kein nutzbarer OParl-Endpunkt an den geprüften Standardpfaden; ${reader.name} erreichbar.`,evidence:{window:WINDOW,topics:d.topics.length,meetings:d.coverage.meetings,identity:who.by}};result.tried.push(note);return result;}
   }catch(e){note.readerError=adapter+': '+e.message.slice(0,140);}
   break;
  }
  result.tried.push(note);
 }
 return result;
}
const regions=loadAreas();
const todo=Object.values(candidates).filter(r=>r.candidates?.length&&(only?only.has(r.id):!done[r.id])&&!skipReason(regions.find(x=>x.id===r.id)||{}));
const queue=[...todo];let n=0;
// AbortSignal.timeout uses an unreferenced timer; without this interval Node may exit while requests are still pending.
const keepAlive=setInterval(()=>{},1000);
// More workers than before reach more servers at once; each server still sees at most PER_SERVER of them.
await Promise.all(Array.from({length:24},async()=>{for(let row;(row=queue.shift());){
 const region=regions.find(r=>r.id===row.id);let res;
 try{res=await verify(region,row);}catch(e){res={id:row.id,name:row.name,kind:row.kind,tried:[],systems:[],error:e.message};}
 res.checkedAt=Date.now();done[row.id]=res;n++;if(n%5===0||!queue.length)fs.writeFileSync(outFile,JSON.stringify(done,null,1));
 const a=res.accepted;console.log(n+'/'+todo.length,row.name,'→',a?a.method+(a.adapter?'/'+a.adapter:'')+' '+(a.system||a.base)+' ('+a.evidence.topics+' Artikel)':'– '+(res.systems.join(',')||'kein System erkannt')+(res.error?' '+res.error:''));
}}));
clearInterval(keepAlive);
fs.writeFileSync(outFile,JSON.stringify(done,null,1));
const rows=Object.values(done);console.log('geprüft',rows.length,'übernommen',rows.filter(r=>r.accepted).length,JSON.stringify(rows.filter(r=>r.accepted).reduce((a,r)=>(a[r.accepted.method]=(a[r.accepted.method]||0)+1,a),{})));
