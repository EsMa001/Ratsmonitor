// Stage 1b: for areas without a usable link, try the usual addresses of council information systems.
// An address counts only if it lies on the area's own official domain, or if the third-party system
// proves the assignment itself: a link back to the official website, or the official key (AGS) in OParl.
// Reads only public addresses, identifies itself and never retries a refused request.
import fs from 'node:fs';
const dir='tmp/source-discovery/';
const UA='Ratsmonitor-SourceCatalog/1.0 (public council information; https://github.com/EsMa001/Ratsmonitor)';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const regions=read('shared/nrw-regions.json'),wikidata=read(dir+'wikidata.json');
const connected=new Set(['muenster','billerbeck','coesfeld','steinfurt','borken','warendorf','recklinghausen',...['nrw-sources','nearby-sources','expanded-sources','statewide-sources'].flatMap(f=>{try{return read('server/integrations/'+f+'.json').filter(s=>s.method!=='pending').map(s=>s.id);}catch{return [];}})]);
const verified=fs.existsSync(dir+'verified.json')?read(dir+'verified.json'):{};
const outFile=dir+(process.env.OUT||'candidates-guessed.json');
const only=process.argv[2]?new Set(process.argv[2].split(',')):null;
const todo=regions.filter(r=>only?only.has(r.id):!connected.has(r.id)&&!verified[r.id]?.accepted);
const slug=s=>s.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/\(.*?\)/g,'').trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const domainOf=url=>{try{return new URL(url).hostname.replace(/^www\./,'');}catch{return null;}};
async function get(url,accept='text/html'){
 try{const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(10000),headers:{'User-Agent':UA,Accept:accept}});
  if(!r.ok){await r.body?.cancel();return {status:r.status,url:r.url,body:''};}
  const b=await r.arrayBuffer();return {status:r.status,url:r.url,body:new TextDecoder('windows-1252').decode(b.slice(0,1500000))};}
 catch(e){return {status:0,url,body:'',error:e.cause?.code||e.message};}
}
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
async function guess(region){
 const domains=[...new Set(wikidata.filter(w=>w.kind===region.kind&&w.ags===region.ags&&w.website).map(w=>domainOf(w.website)).filter(Boolean))];
 const name=slug(region.shortName),names=[...new Set([name,name.replace(/-/g,''),...domains.map(d=>d.split('.')[0]),...domains.map(d=>d.split('.')[0].replace(/^(stadt|gemeinde|kreis)-?/,''))])].filter(s=>s.length>=3);
 const found=[],tried=[];
 const backlink=html=>domains.some(d=>html.includes('//'+d)||html.includes('//www.'+d)||html.includes('.'+d+'/'));
 // Own domain: the address itself proves the assignment.
 for(const d of domains){
  for(const base of [`https://ratsinfo.${d}/`,`https://ris.${d}/`,`https://session.${d}/`,`https://sessionnet.${d}/`,`https://buergerinfo.${d}/`,`https://sitzungsdienst.${d}/`,`https://allris.${d}/`,`https://www.${d}/sessionnet/`,`https://www.${d}/buergerinfo/`,`https://www.${d}/ratsinfo/`]){
   const p=await get(base);tried.push(base+' '+p.status);
   if(p.status===200&&/sessionnet|si0040|allris|sd\.net|ratsinfo|oparl|more! ?rubin|sitzung/i.test(p.body))found.push({url:p.url,from:'https://'+d+'/',byHref:true,guessed:'eigene Domain'});
  }
 }
 // Shared hosts: accepted only with a link back to the official website.
 for(const s of names){
  for(const base of [`https://sessionnet.owl-it.de/${s}/bi/`,`https://sessionnet.krz.de/${s}/bi/`,`https://${s}.gremien.info/`,`https://${s}.more-rubin1.de/`]){
   const p=await get(base);tried.push(base+' '+p.status);
   if(p.status===200&&backlink(p.body))found.push({url:p.url,from:base,byHref:true,guessed:'Rückverweis auf die offizielle Website'});
  }
  // Shared OParl hosts: accepted only when the body carries the official key of the area.
  for(const system of [`https://${s}.ratsinfomanagement.net/webservice/oparl/v1.1/system`,`https://www.${s}.sitzung-online.de/oparl/system`,`https://${s}.sitzung-online.de/public/oparl/system`]){
   const p=await get(system,'application/json'),sys=json(p.body);tried.push(system+' '+p.status);
   if(p.status!==200||!/\/System$/.test(sys?.type||''))continue;
   const list=typeof sys.body==='string'?json((await get(sys.body.replace(/^http:/,'https:'),'application/json')).body):{data:sys.body};
   const bodies=(list?.data||[]).filter(b=>b&&typeof b==='object');
   const key=String(region.ags),match=bodies.some(b=>{const raw=String(b.ags||'').replace(/\D/g,'');return raw&&(raw===key||'0'+raw===key||raw.slice(0,key.length)===key&&/^0*$/.test(raw.slice(key.length))||('0'+raw).slice(0,key.length)===key&&/^0*$/.test(('0'+raw).slice(key.length)));});
   if(match)found.push({url:system,from:system,byHref:true,guessed:'amtlicher Schlüssel in der OParl-Körperschaft'});
  }
 }
 return {id:region.id,name:region.name,kind:region.kind,ags:region.ags,sites:domains,candidates:found,log:tried.filter(t=>!/ 0$| 404$/.test(t)).slice(0,12)};
}
// Resumable: areas already in the output file are skipped unless named explicitly.
const done=fs.existsSync(outFile)?read(outFile):{};const queue=todo.filter(r=>only||!done[r.id]);let n=0;
// AbortSignal.timeout uses an unreferenced timer; without this interval Node may exit while requests are still pending.
const keepAlive=setInterval(()=>{},1000);
await Promise.all(Array.from({length:10},async()=>{for(let r;(r=queue.shift());){
 let row;try{row=await guess(r);}catch(e){row={id:r.id,name:r.name,kind:r.kind,ags:r.ags,sites:[],candidates:[],log:['Fehler: '+e.message]};}
 done[r.id]=row;n++;if(n%10===0||!queue.length)fs.writeFileSync(outFile,JSON.stringify(done,null,1));
 console.log(n+'/'+todo.length,r.name,'→',row.candidates.map(c=>c.url+' ['+c.guessed+']').join('  ')||'–');
}}));
clearInterval(keepAlive);
fs.writeFileSync(outFile,JSON.stringify(done,null,1));
console.log('Gebiete',Object.keys(done).length,'mit Treffer',Object.values(done).filter(r=>r.candidates.length).length);
