// Stage 1c: for areas without a link, build addresses from the name of the area ("<name>.de", "stadt-<name>.de",
// platform hosts such as "<name>.gremien.info") and test them. DNS first (no page request); only names that resolve are
// fetched, one request per second per host, identifying ourselves. A platform host that answers for every name
// (wildcard DNS) is fetched, but accepted only if the page names the area. Candidates go to verify.mjs.
// IDS=file with area ids (JSON list), OUT=candidate file.
import fs from 'node:fs';
import dns from 'node:dns/promises';
import {CATALOG} from '../../shared/catalog.mjs';
const UA='Ratsmonitor-SourceCatalog/1.0 (public council information; https://github.com/EsMa001/Ratsmonitor)';
const ids=JSON.parse(fs.readFileSync(process.env.IDS,'utf8')),out=process.env.OUT;
const byId=new Map(CATALOG.map(r=>[r.id,r]));
const ascii=s=>s.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
const strip=s=>s.toLowerCase().replace(/ä/g,'a').replace(/ö/g,'o').replace(/ü/g,'u').replace(/ß/g,'ss');
const slug=s=>s.replace(/\(.*?\)/g,'').trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function variants(r){
 const base=(r.shortName||r.name).replace(/^(Stadt|Gemeinde|Markt|Landkreis|Kreis|Samtgemeinde|Verbandsgemeinde|Amt|Verwaltungsgemeinschaft)\s+/i,'').replace(/,.*$/,'');
 const v=new Set();
 for(const f of [ascii,strip])for(const n of [f(base),f(base).replace(/\s+(an der|am|im|in der|in|bei|ob der)\s+.*$/,'')]){const s=slug(n);if(s.length>=3){v.add(s);v.add(s.replace(/-/g,''));}}
 return [...v];
}
const resolves=async h=>{try{return (await dns.resolve4(h)).length>0;}catch{return false;}};
const PLATFORMS=['{n}.gremien.info','{n}.ris.kommune-aktiv.de','{n}.ratsinfomanagement.net','{n}.ris-portal.de','{n}.mein-intra.net','{n}.komuna.net','{n}.sitzung-online.de','{n}.more-rubin1.de','{n}.allris.cloud','{n}.ratsinfo-online.de','{n}.buergerinfo.net'];
const wild={};
for(const p of PLATFORMS)wild[p]=await resolves(p.replace('{n}','xq-nicht-vorhanden-7391'));
const SUBS=['ratsinfo','ris','session','sessionnet','buergerinfo','allris','sdnet','gremien','ratsinformation','sitzungen','bi'];
const last=new Map();
async function get(url){
 const h=new URL(url).hostname,wait=(last.get(h)||0)+1000-Date.now();last.set(h,Math.max(Date.now(),last.get(h)||0)+(wait>0?wait:0));
 if(wait>0)await new Promise(r=>setTimeout(r,wait));
 try{const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(10000),headers:{'User-Agent':UA,Accept:'text/html'}});
  if(!r.ok){await r.body?.cancel();return {status:r.status,url:r.url,body:''};}
  return {status:r.status,url:r.url,body:new TextDecoder('utf-8').decode((await r.arrayBuffer()).slice(0,600000))};}
 catch(e){return {status:0,url,body:''};}
}
const SYS=/sessionnet|si0040|allris|sd\.net|ratsinfo|oparl|more! ?rubin|sitzung|gremien|tagesordnung/i;
async function one(id){
 const r=byId.get(id),names=variants(r),found=[],log=[];
 if(!r||!names.length)return {id,name:r?.name,kind:r?.kind,ags:r?.ags,sites:[],candidates:[],log:['kein Name']};
 const nm=new RegExp(names[0].split('-')[0].slice(0,Math.max(4,names[0].length-2)).replace(/ae/g,'[aä]e?').replace(/oe/g,'[oö]e?').replace(/ue/g,'[uü]e?'),'i');
 const sites=[];
 // platforms
 for(const n of names)for(const p of PLATFORMS){
  const h=p.replace('{n}',n);if(!await resolves(h))continue;
  const g=await get('https://'+h+'/');log.push(h+' '+g.status);
  if(g.status===200&&nm.test(g.body)&&SYS.test(g.body)&&!(wild[p]&&!new RegExp(r.shortName.split(/[ ,]/)[0],'i').test(g.body)))found.push({url:g.url,from:'Name der Plattform-Adresse',byHref:false,guessed:'Name'});
 }
 // own domains
 for(const n of names)for(const pre of ['','stadt-','gemeinde-','markt-','vg-','amt-','']){
  for(const tld of ['de']){
   const d=pre+n+'.'+tld;if(sites.includes(d)||!await resolves(d))continue;
   const g=await get('https://www.'+d+'/').then(x=>x.status?x:get('https://'+d+'/'));
   if(g.status!==200||!nm.test(g.body))continue;
   if(!/rathaus|gemeinde|stadt|kreis|bürger|buerger|verwaltung|impressum/i.test(g.body))continue;
   sites.push(d);
  }
 }
 for(const d of sites)for(const s of SUBS){
  const h=s+'.'+d;if(!await resolves(h))continue;
  for(const path of ['/','/bi/']){const g=await get('https://'+h+path);log.push(h+path+' '+g.status);
   if(g.status===200&&SYS.test(g.body)){found.push({url:g.url,from:'https://'+d+'/',byHref:true,guessed:'eigene Domain'});break;}}
 }
 return {id,name:r.name,kind:r.kind,ags:r.ags,sites,candidates:found,log:log.slice(0,12)};
}
const done=fs.existsSync(out)?JSON.parse(fs.readFileSync(out,'utf8')):{};
const queue=ids.filter(i=>!done[i]);let n=0;const keep=setInterval(()=>{},1000);
await Promise.all(Array.from({length:Number(process.env.WORKERS)||12},async()=>{for(let i;(i=queue.shift());){
 let row;try{row=await one(i);}catch(e){row={id:i,candidates:[],sites:[],log:['Fehler '+e.message]};}
 done[i]=row;n++;if(n%10===0||!queue.length)fs.writeFileSync(out,JSON.stringify(done,null,1));
 if(row.candidates.length||row.sites.length)console.log(n+'/'+ids.length,row.name,'sites',row.sites.join(','),'→',row.candidates.map(c=>c.url).join(' ')||'–');
}}));
clearInterval(keep);fs.writeFileSync(out,JSON.stringify(done,null,1));
console.log('fertig',Object.keys(done).length,'Treffer',Object.values(done).filter(x=>x.candidates?.length).length,'Websites',Object.values(done).filter(x=>x.sites?.length).length);
