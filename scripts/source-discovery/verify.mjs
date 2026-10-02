// Stage 2: classify the links found in stage 1 and verify each proposed source with the real collectors.
// A source is accepted only if the collector returns public agenda items from it. No database writes.
import fs from 'node:fs';
import {collectSessionNet} from '../../server/integrations/sessionnet.mjs';
import {collectRegionalOparl} from '../../server/integrations/oparl-regional.mjs';
import {collectRubin} from '../../server/integrations/more-rubin.mjs';
import {collectSdnet} from '../../server/integrations/sdnet.mjs';
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
const locks=new Map();
const withHost=(url,fn)=>{const host=new URL(url).hostname;const prev=locks.get(host)||Promise.resolve();const next=prev.then(fn,fn);locks.set(host,next.catch(()=>{}));return next;};
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
const hrefs=(html,base)=>[...html.matchAll(/(?:href|src|action)\s*=\s*["']([^"'#]+)/gi)].map(m=>{try{const u=new URL(m[1].replace(/&amp;/g,'&'),base);return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}}).filter(Boolean);
const title=html=>(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/\s+/g,' ').trim().slice(0,160);
const text=html=>html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&uuml;/g,'ü').replace(/&auml;/g,'ä').replace(/&ouml;/g,'ö').replace(/&szlig;/g,'ß').replace(/\s+/g,' ');
function systemOf(url,html){
 const s=url+' '+html.slice(0,300000);
 if(/gremien\.info|more-rubin|more! ?rubin/i.test(s))return 'more-rubin';
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
function identity(region,url,html){
 // "Hennef (Sieg)" and "Mülheim an der Ruhr" appear as "hennef" and "muelheim" in addresses.
 const plain=n=>n.replace(/\(.*?\)/g,'').replace(/\s+(an der|am|a\.\s?d\.|im|in der|bei|vor der|ob der)\s+.*$/i,'').trim();
 const names=[region.shortName,region.name.replace(/^(Stadt|Gemeinde|Kreis|Städteregion|Rhein-Kreis|Landkreis)\s+/,'')].flatMap(n=>[n,plain(n)]);
 const slugs=[...new Set(names.flatMap(n=>[norm(n),normPlain(n)]))].filter(s=>s.length>=3);
 const hay=norm(new URL(url).hostname+new URL(url).pathname),hayPlain=normPlain(new URL(url).hostname+new URL(url).pathname);
 const inUrl=slugs.some(s=>hay.includes(s)||hayPlain.includes(s));
 const body=norm(title(html)+' '+text(html).slice(0,6000));const inText=slugs.some(s=>body.includes(s));
 const t=title(html)+' '+text(html).slice(0,1500);
 const kreisPage=/\b(kreistag|kreisverwaltung|kreisausschuss|landrat)\b/i.test(t)||/kreis/i.test(new URL(url).hostname.split('.').slice(0,-1).join('.'));
 if(region.kind==='city'&&kreisPage&&!/\b(stadtrat|gemeinderat|rat der (stadt|gemeinde))\b/i.test(t)&&!inUrl)return {ok:false,why:'Seite gehört erkennbar zu einem Kreis'};
 if(region.kind==='district'&&!kreisPage&&!/kreis|region/i.test(t+url))return {ok:false,why:'Kreisbezug nicht erkennbar'};
 // A district council system linked from the district's own website needs no further name match (e.g. "obk").
 if(region.kind==='district'&&/\b(kreistag|kreistagsinformation\w*|kreisausschuss)\b/i.test(t))return {ok:true,by:'Kreistagsseite, von der offiziellen Website verlinkt'};
 return inUrl||inText?{ok:true,by:inUrl?'Adresse':'Seitentext'}:{ok:false,why:'Gebietsname weder in Adresse noch im Seitentext'};
}
async function verify(region,row){
 const result={id:region.id,name:region.name,kind:region.kind,tried:[],systems:[]};
 const strong=/si00\d\d|sessionnet|\/bi\/|gremien\.info|ratsinfomanagement|sdnetrim|allris|sitzung-online|oparl|buergerinfo|ratsinfo|kdz-ws|session/i;
 const ordered=[...row.candidates].sort((a,b)=>Number(strong.test(b.url))-Number(strong.test(a.url))||Number(b.byHref)-Number(a.byHref)).slice(0,6);
 const seenBases=new Set(),seenUrls=new Set(ordered.map(c=>c.url));let hops=0;
 // Guessed addresses on shared hosts are not proof of assignment; links from the official website and its own domain are.
 const trusted=c=>!(c.guessed&&c.guessed!=='eigene Domain');
 const tryOparl=async(url,sn,note,verifiedSource,trusted=true)=>{
  for(const guess of oparlGuesses(url,sn)){
   const system0=await withHost(guess,()=>probeOparl(guess));if(!system0)continue;note.oparl=guess;
   // Areas outside the NRW catalog carry their official key explicitly, so the body can be matched by it.
   let source={id:region.id,name:region.name,kind:region.kind,...(process.env.AREAS&&/^[0-9]{5}([0-9]{3})?$/.test(region.ags||'')?{ags:region.ags}:{}),system:guess,method:'oparl',...(String(system0.id||'').startsWith('http://')||String(system0.body||'').startsWith('http://')?{upgradeHttpLinks:true}:{})};
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
  let p;try{p=await withHost(c.url,()=>page(c.finalUrl||c.url));}catch(e){p={status:0,url:c.url,html:'',error:e.message};}
  if(p.status!==200){
   // The page is not readable for programs (or failed). Only the official interface is asked; a refusal is never worked around.
   const note={url:c.url,status:p.status,error:p.error,from:c.from};const key=new URL(c.url).origin+'|oparl-only';
   if(!seenBases.has(key)&&strong.test(c.url)){seenBases.add(key);const got=await tryOparl(c.url,null,note,c.from||c.url,trusted(c));if(got){result.accepted=got;result.tried.push(note);return result;}}
   result.tried.push(note);continue;}
  // An internal page about the council: follow its links to an external system once.
  if(hops<8)for(const u of new Set(hrefs(p.html,p.url))){if(seenUrls.has(u)||!strong.test(u)||/[.](pdf|jpe?g|png|css|js|ico|svg)([?]|$)/i.test(u))continue;if(new URL(u).hostname===new URL(p.url).hostname&&!/si00[0-9][0-9]|[/]bi[/]|sessionnet/i.test(u))continue;seenUrls.add(u);ordered.push({url:u,from:p.url,byHref:true});if(++hops>=8)break;}
  const all=[p.url,...hrefs(p.html,p.url)];const system=systemOf(p.url,p.html);if(!result.systems.includes(system))result.systems.push(system);
  const sn=sessionNetBase(all.filter(u=>new URL(u).hostname===new URL(p.url).hostname).concat(all));
  const key=(sn?.base||new URL(p.url).origin)+'|'+system;if(seenBases.has(key))continue;seenBases.add(key);
  // TRUST_LINK: for units that have no name of their own in the system (an association reached through a member
  // municipality), the link from the official website is the evidence. A district page is still never a city's source.
  let who=identity(region,sn?.base||p.url,p.html);
  if(!who.ok&&process.env.TRUST_LINK&&!c.guessed&&who.why!=='Seite gehört erkennbar zu einem Kreis')who={ok:true,by:'Verweis von der offiziellen Website'};
  const note={url:p.url,system,title:title(p.html),identity:who,from:c.from};
  const verifiedSource=(c.from||c.url);
  // 1. Official OParl interface, if one answers and the body is unambiguous.
  {const got=await tryOparl(p.url,sn,note,verifiedSource,trusted(c));if(got){result.accepted=got;result.tried.push(note);return result;}}
  if(!who.ok){result.tried.push(note);continue;}
  // 2. More! Rubin public calendar interface.
  if(system==='more-rubin'){
   const source={id:region.id,name:region.name,kind:region.kind,method:'official-api',adapter:'more-rubin',base:new URL(p.url).origin+'/'};
   try{const d=await withHost(source.base,()=>collectRubin(source,{window:WINDOW,maxDurationMs:120000}));note.rubinTopics=d.topics.length;note.rubinIssues=d.coverage.issues.slice(0,4);
    if(d.topics.length){result.accepted={...source,verifiedSource,verifiedAt:today,apiCheck:note.oparl?'OParl-Adresse antwortet, lieferte aber keine verwertbaren Sitzungen; öffentliche Kalender-API erreichbar.':'Kein nutzbarer OParl-Endpunkt an den geprüften Standardpfaden; öffentliche Kalender-API erreichbar.',evidence:{window:WINDOW,topics:d.topics.length,meetings:d.coverage.meetings}};result.tried.push(note);return result;}
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
    if(d.topics.length){result.accepted={...source,...fallback,verifiedSource,verifiedAt:today,apiCheck:fallbackCheck||`Öffentlicher Hersteller-Standardpfad oparl/1.0/system.${sn.extension} lieferte am ${germanDate} kein OParl-System. Andere API-Adressen sind damit nicht ausgeschlossen; öffentlicher SessionNet-Kalender erreichbar.`,evidence:{window:WINDOW,topics:d.topics.length,meetings:d.coverage.meetings}};result.tried.push(note);return result;}
   }catch(e){note.snError=e.message.slice(0,160);}
  }
  // 4. Public SD.NET pages.
  if(system==='sdnet'){
   const source={id:region.id,name:region.name,kind:region.kind,method:'scraper',adapter:'sdnet',base:new URL(p.url).origin+'/'};
   try{const d=await withHost(source.base,()=>collectSdnet(source,{window:WINDOW,maxDurationMs:150000}));note.sdTopics=d.topics.length;note.sdMeetings=d.coverage.meetings;note.sdIssues=[...new Set(d.coverage.issues.map(i=>i.replace(/https?:\S+/g,'…')))].slice(0,4);
    if(d.topics.length){result.accepted={...source,...fallback,verifiedSource,verifiedAt:today,apiCheck:fallbackCheck||`OParl-Schnittstelle des Herstellers (webservice/oparl/v1.1/system) war am ${germanDate} nicht aktiviert; öffentliche SD.NET-Seiten erreichbar.`,evidence:{window:WINDOW,topics:d.topics.length,meetings:d.coverage.meetings}};result.tried.push(note);return result;}
   }catch(e){note.sdError=e.message.slice(0,160);}
  }
  result.tried.push(note);
 }
 return result;
}
const regions=JSON.parse(fs.readFileSync(process.env.AREAS||'shared/nrw-regions.json','utf8'));
const todo=Object.values(candidates).filter(r=>r.candidates?.length&&(only?only.has(r.id):!done[r.id]));
const queue=[...todo];let n=0;
// AbortSignal.timeout uses an unreferenced timer; without this interval Node may exit while requests are still pending.
const keepAlive=setInterval(()=>{},1000);
await Promise.all(Array.from({length:10},async()=>{for(let row;(row=queue.shift());){
 const region=regions.find(r=>r.id===row.id);let res;
 try{res=await verify(region,row);}catch(e){res={id:row.id,name:row.name,kind:row.kind,tried:[],systems:[],error:e.message};}
 done[row.id]=res;n++;if(n%5===0||!queue.length)fs.writeFileSync(outFile,JSON.stringify(done,null,1));
 const a=res.accepted;console.log(n+'/'+todo.length,row.name,'→',a?a.method+(a.adapter?'/'+a.adapter:'')+' '+(a.system||a.base)+' ('+a.evidence.topics+' Artikel)':'– '+(res.systems.join(',')||'kein System erkannt')+(res.error?' '+res.error:''));
}}));
clearInterval(keepAlive);
fs.writeFileSync(outFile,JSON.stringify(done,null,1));
const rows=Object.values(done);console.log('geprüft',rows.length,'übernommen',rows.filter(r=>r.accepted).length,JSON.stringify(rows.filter(r=>r.accepted).reduce((a,r)=>(a[r.accepted.method]=(a[r.accepted.method]||0)+1,a),{})));
