// Stage 2: classify the links found in stage 1 and verify each proposed source with the real collectors.
// A source is accepted only if the collector returns public agenda items from it. No database writes.
import fs from 'node:fs';
import dns from 'node:dns/promises';
import {loadAreas,skipReason,foreignOwner} from './areas.mjs';
import {collectSessionNet} from '../../server/integrations/sessionnet.mjs';
import {collectRegionalOparl} from '../../server/integrations/oparl-regional.mjs';
import {collectRubin} from '../../server/integrations/more-rubin.mjs';
import {collectSdnet} from '../../server/integrations/sdnet.mjs';
import {collectAllris} from '../../server/integrations/allris.mjs';
import {robotsVerdict} from '../../server/integrations/robots.mjs';
// DIR and AREAS let the same check run over another list of areas (e.g. the random sample of the estimate).
const dir=process.env.DIR||'tmp/source-discovery/';
const UA='Ratsmonitor-SourceCatalog/1.0 (public council information; https://github.com/EsMa001/Ratsmonitor)';
const candidates=JSON.parse(fs.readFileSync(dir+(process.env.CANDIDATES||'candidates.json'),'utf8'));
const outFile=dir+(process.env.OUT||'verified.json');
const done=fs.existsSync(outFile)?JSON.parse(fs.readFileSync(outFile,'utf8')):{};
const only=process.argv[2]?new Set(process.argv[2].split(',')):null;
const WINDOW=process.env.WINDOW||'3m';
const today=new Date().toISOString().slice(0,10);
const norm=s=>String(s).toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').normalize('NFKD').replace(/[^a-z0-9]/g,'');
const normPlain=s=>String(s).toLowerCase().replace(/ß/g,'ss').normalize('NFKD').replace(/[^a-z0-9]/g,'');
// At most two requests or checks at a time on one server, as in the import (pipeline-jobs.mjs). A server is told apart
// like there: by the registrable domain of its operator and by its address. A lock per host name would let every
// worker reach another subdomain of one operator at once; operators such as sitzung-online.de then block the network.
const PER_SERVER=2,slots=new Map(),addresses=new Map();
const addressOf=host=>{if(!addresses.has(host))addresses.set(host,dns.resolve4(host).then(found=>found.sort()[0],()=>null));return addresses.get(host);};
const acquire=key=>{const slot=slots.get(key)||{busy:0,waiting:[]};slots.set(key,slot);if(slot.busy<PER_SERVER){slot.busy++;return Promise.resolve();}return new Promise(turn=>slot.waiting.push(turn));};
const release=key=>{const slot=slots.get(key),turn=slot.waiting.shift();if(turn)turn();else slot.busy--;};
// Always the domain first and the address second, so two checks never wait for each other.
const withHost=async(url,fn)=>{const host=new URL(url).hostname,address=await addressOf(host),keys=['domain:'+host.split('.').slice(-2).join('.'),...(address?['ip:'+address]:[])];for(const key of keys)await acquire(key);try{return await fn();}finally{for(const key of keys.reverse())release(key);}};
// robots.txt of a host is read before its first page (one request per host); a path it disallows for the programs of
// this project is not asked, the candidate is recorded with robots:'verboten' (verdicts as in source-robots.json).
// IGNORE_ROBOTS=1 switches the check off.
const TOKENS=['vorort-politicaltopics','ratsmonitor-sourcecatalog'],robotsFiles=new Map();
async function robotsAllow(url){
 if(process.env.IGNORE_ROBOTS==='1')return true;
 const u=new URL(url);
 if(!robotsFiles.has(u.origin))robotsFiles.set(u.origin,withHost(url,async()=>{try{const r=await fetch(u.origin+'/robots.txt',{redirect:'follow',signal:AbortSignal.timeout(15000),headers:{'User-Agent':UA}});return {status:r.status,text:r.ok?(await r.text()).slice(0,20000):''};}catch{return {status:0,text:''};}}));
 const file=await robotsFiles.get(u.origin);return robotsVerdict(file.status,file.text,u.pathname,TOKENS)!=='verboten';
}
async function page(url,timeout=15000){
 const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(timeout),headers:{'User-Agent':UA,Accept:'text/html,application/xhtml+xml'}});
 if(!r.ok){await r.body?.cancel();return {status:r.status,url:r.url,html:''};}
 const type=r.headers.get('content-type')||'';if(!/html|xml|text|json/i.test(type)){await r.body?.cancel();return {status:r.status,url:r.url,html:''};}
 const b=await r.arrayBuffer();const probe=new TextDecoder().decode(b.slice(0,3000));const latin=/charset=["']?(?:iso-8859-1|windows-1252)/i.test(type+probe);
 return {status:r.status,url:r.url,html:new TextDecoder(latin?'windows-1252':'utf-8').decode(b.slice(0,3e6))};
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
// The public part of a system lies next to its members' area under another name: bi/ for gi/ or ri/, buergerinfo for
// ratsinfo (folder or host name), sessionnetbi for sessionnetri.
function publicSiblings(base){
 const u=new URL(base),paths=[u.pathname.replace(/\/(gi|ri)\/$/i,'/bi/'),u.pathname.replace(/ratsinfo\/$/i,'buergerinfo/'),u.pathname.replace(/sessionnetri\/$/i,'sessionnetbi/'),u.pathname],hosts=[u.hostname,u.hostname.replace(/^ratsinfo(?=[.-])/i,'buergerinfo')];
 return [...new Set(hosts.flatMap(host=>paths.map(path=>'https://'+host+path)))];
}
async function findSessionNet(url){
 const u=new URL(url),here=u.origin+u.pathname.replace(/[^/]*$/,''),bases=[...new Set([here.replace(/\/(gi|ri)\/$/i,'/bi/'),here,...publicSiblings(here),u.origin+'/',u.origin+'/bi/',here+'bi/'])];
 for(const base of bases)for(const extension of ['asp','php']){
  let p;try{p=await withHost(base,()=>page(base+'si0040.'+extension,12000));}catch{continue;}
  if(p.status===200&&!loginPage(p)&&/sessionnet/i.test(p.html)&&/si005[67]\.|smc-|kalender/i.test(p.html))return {base:new URL(p.url).href.replace(/si0040\.(asp|php).*$/i,'').replace(/^http:/,'https:'),extension};
 }
 return null;
}
// Links to read-aloud and sharing services carry the address of the page in their query; they are no council systems.
const SERVICE=/readspeaker\.com|api\.whatsapp\.com|\/\/wa\.me\/|xing\.com|\/\/t\.me\/|threads\.net|bsky\.app|pinterest\.|reddit\.com|tiktok\.com|mastodon/i;
// SD.NET on a host of its own does not always name the product on its start page; its list of papers does.
async function isSdnet(url){
 try{const p=await withHost(url,()=>page(new URL(url).origin+'/vorlagen',12000));return p.status===200&&/SD\.NET|sdnet/i.test(p.html);}catch{return false;}
}
// ALLRIS 4 serves its public pages from one folder, usually /public/. A page of the system names that folder, a page
// of the official website links pages in it (same host, e.g. /allris/si010); a link to the host alone is answered
// from /public/. Addresses ending in .asp belong to the older ALLRIS 3.
function allrisBases(url,html){
 const u=new URL(url);if(/\.asp$/i.test(u.pathname))return [];
 const linked=hrefs(html,url).filter(h=>new URL(h).hostname===u.hostname).map(h=>h.match(/^(https?:\/\/[^?#]*\/)(?:si010|si018|to010|vo020|vo040|gr010|gr020|kp040|tr010)(?:[?#]|$)/)?.[1]).filter(Boolean);
 return [...new Set([/wicket/i.test(html)?u.origin+u.pathname.replace(/[^/]*$/,''):null,...linked,u.origin+'/public/'].filter(Boolean))].map(b=>b.replace(/^http:/,'https:')).slice(0,3);
}
const hrefs=(html,base)=>[...html.matchAll(/(?:href|src|action)\s*=\s*["']([^"'#]+)/gi)].map(m=>{try{const u=new URL(m[1].replace(/&amp;/g,'&'),base);return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}}).filter(Boolean);
const title=html=>(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/\s+/g,' ').trim().slice(0,160);
const text=html=>html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&uuml;/g,'ü').replace(/&auml;/g,'ä').replace(/&ouml;/g,'ö').replace(/&szlig;/g,'ß').replace(/\s+/g,' ');
function systemOf(url,html){
 const s=url+' '+html.slice(0,300000);
 // KISA's "Ratsinfosystem" (ris-<name>.zv-kisa.de) is the newer interface of More! Rubin; its start page names neither.
 if(/gremien\.info|more-rubin|more! ?rubin/i.test(s)||/^https?:\/\/ris-[^/]+\.zv-kisa\.de\//i.test(url))return 'more-rubin';
 if(/sdnetrim|ratsinfomanagement\.net|SD\.NET|sternberg|rim\d{4}\//i.test(s))return 'sdnet';
 if(/allris/i.test(s))return 'allris';
 if(/sessionnet|somacos|si0040\.(asp|php)|smc-/i.test(s))return 'sessionnet';
 if(/provox/i.test(s))return 'provox';
 return 'unknown';
}
function oparlGuesses(url,sn){
 const u=new URL(url),out=[];const prefix=u.pathname.match(/^\/((?:rim|gkz)\d+)\//i)?.[1];
 if(sn)out.push(sn.base+'oparl/1.0/system.'+sn.extension);
 const roots=[u.origin+'/',...(prefix?[u.origin+'/'+prefix+'/']:[])];
 for(const root of roots.reverse())for(const p of ['webservice/oparl/v1.1/system','webservice/oparl/v1.0/system','public/oparl/system','oparl/system','oparl/v1.1/system','oparl'])out.push(root+p);
 return [...new Set(out.map(x=>x.replace(/^http:/,'https:')))];
}
// The linked system must name the area itself; a city page linking to its district's system is not a source for the city.
// Names of municipal councils; they differ between the states (Stadtverordnetenversammlung, Gemeindevertretung, Amtsausschuss …).
const COUNCIL=/\b(stadtrat|gemeinderat|marktgemeinderat|samtgemeinderat|verbandsgemeinderat|stadtverordnetenversammlung|gemeindevertretung|stadtvertretung|amtsausschuss|gemeinschaftsversammlung|rat der (stadt|gemeinde|samtgemeinde|verbandsgemeinde))\b/i;
// Bodies of a More! Rubin system (organizations/bodies); an older system without that call answers with an error: none known.
async function rubinBodies(base){
 try{const r=await fetch(base+'api.php?json=true&id=organizations&action=bodies',{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'User-Agent':UA,Accept:'application/json'}});if(r.status!==200){await r.body?.cancel();return [];}
  const j=await r.json();const list=Array.isArray(j)?j:j.bodies||j.data||[];return list.filter(b=>b&&typeof b==='object'&&b.name&&!b.ErrorCode);}
 catch{return [];}
}
// "Stadtverwaltung Crimmitschau", "Gemeindeverwaltung Dennheritz", "Landkreis Vogtlandkreis": the name without the kind of
// administration has to be the area's own name or that of one of its members.
const bodyOfArea=(name,region)=>{const own=norm(String(name).replace(/^(Stadtverwaltung|Gemeindeverwaltung|Verwaltung|Landratsamt|Landkreis|Kreis|Stadt|Gemeinde|Große Kreisstadt)\s+/i,''));return own.length>=4&&[region.shortName,region.name,...(region.members||[]).map(m=>m.name)].some(n=>norm(n).includes(own)||own.includes(norm(n)));};
// Committees that only a district has. A town's system never holds a Kreistag or Kreisausschuss.
const DISTRICT_BODY=/\bkreistag|\bkreisausschuss|\bkreis\w{0,30}ausschuss/i;
const districtCommittees=topics=>topics.some(t=>[t.committee,...(t.events||[]).map(e=>e.committee)].some(name=>DISTRICT_BODY.test(String(name||''))));
function identity(region,url,html){
 // "Hennef (Sieg)" and "Mülheim an der Ruhr" appear as "hennef" and "muelheim" in addresses.
 // "Dillingen a.d.Donau", "Neumarkt i.d.OPf." and "Bad Homburg v.d.Höhe" appear without their addition as well.
 // "Neukirchen/Erzgeb." and "Lahr/Schwarzwald" without the part after the slash.
 const plain=n=>n.replace(/\(.*?\)/g,'').replace(/\s+(an der|am|im|in der|in|bei|vor der|ob der|unter|über|auf der|auf dem)\s+.*$/i,'').replace(/\s+[a-zäöü]{1,3}\.\s?(?:[a-zäöü]{1,3}\.\s?)?\S.*$/i,'').replace(/\/.*$/,'').trim();
 // A municipal association's system is often named after its seat, one of its members (ris-crimmitschau for the
 // Verwaltungsgemeinschaft Crimmitschau-Dennheritz); the members are part of the area.
 const names=[region.shortName,region.name.replace(/^(Stadt|Gemeinde|Samtgemeinde|Verbandsgemeinde|Verwaltungsgemeinschaft|Verwaltungsverband|Erfüllende Gemeinde|Amt|Kreis|Städteregion|Rhein-Kreis|Landkreis|Regionalverband|Region)\s+/,''),...(Array.isArray(region.members)?region.members.map(m=>m.name):[])].flatMap(n=>[n,plain(n)]);
 const slugs=[...new Set(names.flatMap(n=>[norm(n),normPlain(n)]))].filter(s=>s.length>=3);
 const hay=norm(new URL(url).hostname+new URL(url).pathname),hayPlain=normPlain(new URL(url).hostname+new URL(url).pathname);
 const inUrl=slugs.some(s=>hay.includes(s)||hayPlain.includes(s));
 const body=norm(title(html)+' '+text(html).slice(0,6000));const inText=slugs.some(s=>body.includes(s));
 const t=title(html)+' '+text(html).slice(0,1500);
 const kreisPage=/\b(kreistag|kreisverwaltung|kreisausschuss|landrat)\b/i.test(t)||/kreis/i.test(new URL(url).hostname.split('.').slice(0,-1).join('.'));
 if(region.kind==='city'&&kreisPage&&!COUNCIL.test(t)&&!inUrl)return {ok:false,why:'Seite gehört erkennbar zu einem Kreis'};
 if(region.kind==='district'&&!kreisPage&&!/kreis|region/i.test(t+url))return {ok:false,why:'Kreisbezug nicht erkennbar'};
 // A district council system linked from the district's own website needs no further name match (e.g. "obk").
 if(region.kind==='district'&&/\b(kreistag|kreistagsinformation\w*|kreisausschuss)\b/i.test(t))return {ok:true,by:'Kreistagsseite, von der offiziellen Website verlinkt'};
 return inUrl||inText?{ok:true,by:inUrl?'Adresse':'Seitentext'}:{ok:false,why:'Gebietsname weder in Adresse noch im Seitentext'};
}
async function verify(region,row){
 const result={id:region.id,name:region.name,kind:region.kind,tried:[],systems:[]};
 const strong=/si00\d\d|sessionnet|\/bi\/|gremien\.info|ratsinfomanagement|sdnetrim|allris|sitzung-online|oparl|buergerinfo|ratsinfo|kdz-ws|session/i;
 const ordered=[...row.candidates].filter(c=>!SERVICE.test(c.url)).sort((a,b)=>Number(strong.test(b.url))-Number(strong.test(a.url))||Number(b.byHref)-Number(a.byHref)).slice(0,6);
 const seenBases=new Set(),seenUrls=new Set(ordered.map(c=>c.url));let hops=0;
 // Guessed addresses on shared hosts are not proof of assignment; links from the official website and its own domain are.
 const trusted=c=>!(c.guessed&&c.guessed!=='eigene Domain');
 // exact: only the given address (an OParl address known from the register or the vendor, oparl-register.mjs).
 const tryOparl=async(url,sn,note,verifiedSource,trusted=true,exact=false)=>{
  for(const guess of exact?[url.replace(/^http:/,'https:')]:oparlGuesses(url,sn)){
   const system0=await withHost(guess,()=>probeOparl(guess));if(!system0)continue;note.oparl=guess;
   // Areas outside the NRW catalog carry their official key explicitly, so the body can be matched by it
   // (Lower Saxon Samtgemeinden: 9-digit regional key).
   let source={id:region.id,name:region.name,kind:region.kind,...(process.env.AREAS&&/^[0-9]{5}([0-9]{3,4})?$/.test(region.ags||'')?{ags:region.ags}:{}),system:guess,method:'oparl',...(String(system0.id||'').startsWith('http://')||String(system0.body||'').startsWith('http://')?{upgradeHttpLinks:true}:{})};
   const collect=async()=>{const d=await withHost(guess,()=>collectRegionalOparl(source,{window:WINDOW,maxDurationMs:150000}));note.oparlTopics=d.topics.length;note.oparlIssues=d.coverage.issues.slice(0,4);
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
  if(c.oparlOnly){const note={url:c.url,from:c.from,register:c.register};const got=await tryOparl(c.url,null,note,c.from||c.url,true,true);result.tried.push(note);if(got){result.accepted=got;return result;}continue;}
  if(!await robotsAllow(c.finalUrl||c.url)){result.tried.push({url:c.url,robots:'verboten',from:c.from});continue;}
  let p;try{p=await withHost(c.url,()=>page(c.finalUrl||c.url));}catch(e){p={status:0,url:c.url,html:'',error:e.message};}
  // Many official websites still link with http://; the systems themselves answer only on https://.
  if(p.status!==200&&/^http:/.test(c.finalUrl||c.url)){const secure=(c.finalUrl||c.url).replace(/^http:/,'https:');try{const again=await withHost(secure,()=>page(secure));if(again.status===200)p=again;}catch{}}
  if(p.status!==200){
   // The page is not readable for programs (or failed). Only the official interface is asked; a refusal is never worked around.
   const note={url:c.url,status:p.status,error:p.error,from:c.from};const key=new URL(c.url).origin+'|oparl-only';
   if(!seenBases.has(key)&&strong.test(c.url)){seenBases.add(key);const got=await tryOparl(c.url,null,note,c.from||c.url,trusted(c));if(got){result.accepted=got;result.tried.push(note);return result;}}
   result.tried.push(note);continue;}
  // An internal page about the council: follow its links to an external system once.
  if(hops<8)for(const u of new Set(hrefs(p.html,p.url))){if(seenUrls.has(u)||!strong.test(u)||/[.](pdf|jpe?g|png|css|js|ico|svg)([?]|$)/i.test(u))continue;if(new URL(u).hostname===new URL(p.url).hostname&&!/si00[0-9][0-9]|[/]bi[/]|sessionnet/i.test(u))continue;seenUrls.add(u);ordered.push({url:u,from:p.url,byHref:true});if(++hops>=8)break;}
  const all=[p.url,...hrefs(p.html,p.url)];let system=systemOf(p.url,p.html);
  let sn=sessionNetBase(all.filter(u=>new URL(u).hostname===new URL(p.url).hostname).concat(all));
  // A login page, or an address that names the members' area: look for the public part next to it.
  if(sn&&(loginPage(p)||/\/(gi|ri)\/$|ratsinfo|sessionnetri/i.test(sn.base)))sn=await findSessionNet(sn.base)||sn;
  else if(!sn&&loginPage(p))sn=await findSessionNet(p.url);
  if(!sn&&(system==='sessionnet'||system==='unknown')&&strong.test(p.url))sn=await findSessionNet(p.url);
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
  const verifiedSource=(c.from||c.url);
  const confirmed=d=>{if(who.ok)return true;if(!byCommittees||!districtCommittees(d.topics))return false;who={ok:true,by:'Gremien des Kreises (Kreistag, Kreisausschuss) in den gelesenen Sitzungen; System von der offiziellen Website verlinkt'};note.identity=who;return true;};
  // 1. Official OParl interface, if one answers and the body is unambiguous.
  {const got=await tryOparl(p.url,sn,note,verifiedSource,trusted(c));if(got){result.accepted=got;result.tried.push(note);return result;}}
  if(!who.ok&&!byCommittees){result.tried.push(note);continue;}
  // 2. More! Rubin public calendar interface.
  if(system==='more-rubin'){
   const source={id:region.id,name:region.name,kind:region.kind,method:'official-api',adapter:'more-rubin',base:new URL(p.url).origin+'/'};
   try{
    // One system may serve several bodies (KISA: Crimmitschau and Dennheritz). Without a fixed body the reader takes all
    // of them, so every body has to belong to this area: the area itself or one of its member municipalities.
    const bodies=await withHost(source.base,()=>rubinBodies(source.base));
    if(bodies.length>1){const foreignBodies=bodies.filter(b=>!bodyOfArea(b.name,region));if(foreignBodies.length){note.rubinError='Mehrere Körperschaften im System ('+bodies.map(b=>b.name).join(', ').slice(0,120)+'); Zuordnung nur mit fester Körperschaft';result.tried.push(note);continue;}}
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
   const source={id:region.id,name:region.name,kind:region.kind,method:'scraper',adapter:'sdnet',base:new URL(p.url).origin+'/'};
   try{const d=await withHost(source.base,()=>collectSdnet(source,{window:WINDOW,maxDurationMs:150000}));note.sdTopics=d.topics.length;note.sdMeetings=d.coverage.meetings;note.sdIssues=[...new Set(d.coverage.issues.map(i=>i.replace(/https?:\S+/g,'…')))].slice(0,4);
    if(d.topics.length&&confirmed(d)){result.accepted={...source,...fallback,verifiedSource,verifiedAt:today,apiCheck:fallbackCheck||`OParl-Schnittstelle des Herstellers (webservice/oparl/v1.1/system) war am ${germanDate} nicht aktiviert; öffentliche SD.NET-Seiten erreichbar.`,evidence:{window:WINDOW,topics:d.topics.length,meetings:d.coverage.meetings,identity:who.by}};result.tried.push(note);return result;}
   }catch(e){note.sdError=e.message.slice(0,160);}
  }
  // 5. Public ALLRIS 4 pages. The reader asks the system's own OParl address first and keeps one session.
  if(system==='allris'){
   if(/\.asp$/i.test(new URL(p.url).pathname))note.allrisGeneration=3;
   for(const base of allrisBases(p.url,p.html)){
    const source={id:region.id,name:region.name,kind:region.kind,method:'scraper',adapter:'allris',base};
    try{const d=await withHost(base,()=>collectAllris(source,{window:WINDOW,maxDurationMs:150000,checkOparl:!note.oparl}));note.allrisTopics=d.topics.length;note.allrisMeetings=d.coverage.meetings;note.allrisIssues=[...new Set(d.coverage.issues.map(i=>i.replace(/https?:\S+/g,'…')))].slice(0,4);delete note.allrisError;
     if(d.topics.length&&confirmed(d)){result.accepted={...source,...fallback,verifiedSource,verifiedAt:today,apiCheck:fallbackCheck||`OParl-Adresse des Systems (${base}oparl/system) lieferte am ${germanDate} kein OParl-System; öffentliche ALLRIS-Seiten erreichbar.`,evidence:{window:WINDOW,topics:d.topics.length,meetings:d.coverage.meetings,identity:who.by}};result.tried.push(note);return result;}
     // The system asked not to be read by programs (or not right now): no further address of it is tried.
     if(note.allrisIssues.some(i=>/Zugriffsprüfung|zu viele Zugriffe/.test(i)))break;
    }catch(e){note.allrisError=e.message.slice(0,160);}
   }
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
 done[row.id]=res;n++;if(n%5===0||!queue.length)fs.writeFileSync(outFile,JSON.stringify(done,null,1));
 const a=res.accepted;console.log(n+'/'+todo.length,row.name,'→',a?a.method+(a.adapter?'/'+a.adapter:'')+' '+(a.system||a.base)+' ('+a.evidence.topics+' Artikel)':'– '+(res.systems.join(',')||'kein System erkannt')+(res.error?' '+res.error:''));
}}));
clearInterval(keepAlive);
fs.writeFileSync(outFile,JSON.stringify(done,null,1));
const rows=Object.values(done);console.log('geprüft',rows.length,'übernommen',rows.filter(r=>r.accepted).length,JSON.stringify(rows.filter(r=>r.accepted).reduce((a,r)=>(a[r.accepted.method]=(a[r.accepted.method]||0)+1,a),{})));
