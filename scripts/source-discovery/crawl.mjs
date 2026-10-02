// Stage 1: find links to the council information system (RIS) on each official municipal website.
// Reads only public pages, follows normal links, identifies itself and never retries a refused request.
import fs from 'node:fs';
// DIR and AREAS let the same search run over another list of areas (e.g. the random sample of the estimate).
const dir=process.env.DIR||'tmp/source-discovery/';
const UA='Ratsmonitor-SourceCatalog/1.0 (public council information; https://github.com/EsMa001/Ratsmonitor)';
const regions=JSON.parse(fs.readFileSync(process.env.AREAS||'shared/nrw-regions.json','utf8'));
const wikidata=JSON.parse(fs.readFileSync(dir+'wikidata.json','utf8'));
const configured=new Set(['muenster','billerbeck','coesfeld','steinfurt','borken','warendorf','recklinghausen',...['nrw-sources','nearby-sources','expanded-sources','statewide-sources'].flatMap(f=>{try{return JSON.parse(fs.readFileSync('server/integrations/'+f+'.json','utf8')).map(s=>s.id);}catch{return [];}})]);
const outFile=dir+(process.env.OUT||'candidates.json');
const done=fs.existsSync(outFile)?JSON.parse(fs.readFileSync(outFile,'utf8')):{};
const only=process.argv[2]?new Set(process.argv[2].split(',')):null;
const todo=regions.filter(r=>only?only.has(r.id):!configured.has(r.id)&&!done[r.id]);

export const RIS_HREF=/(sessionnet|si00\d\d\.(?:asp|php)|\/info\.(?:asp|php)|\/bi\/|buergerinfo|ratsinfo|allris|sitzung-online\.de|gremien\.info|more-rubin|ratsinfomanagement\.net|sdnetrim|kdz-ws\.net|sessionweb|\/\/session\.|\/\/ris[.-]|\/ris\/|sitzungsdienst|ratsportal|\/oparl|rim\d{4}|gremieninfo|ratsinformation|kreistagsinfo|\/\/rim\.|\/\/sd\.|pv-rat|provox|\/\/politik\.|\/\/rat\.|session\.[a-z0-9-]+\.de|tagesordnung|sitzungskalender)/i;
const RIS_TEXT=/(ratsinfo|rats- und bürgerinfo|bürgerinfo|buergerinfo|ratsinformation|kreistagsinfo|kreistagsinformation|sitzungskalender|sitzungsdienst|gremieninfo|sitzungstermine|allris|session ?net|ratsportal|rats- und ausschuss|sitzungen)/i;
const NAV=/(politik|stadtrat|gemeinderat|kreistag|\brat\b|gremien|rathaus|verwaltung|kommunalpolitik|ortsrecht|sitzung)/i;

async function get(url,timeout=15000){
 const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(timeout),headers:{'User-Agent':UA,Accept:'text/html,application/xhtml+xml'}});
 const type=r.headers.get('content-type')||'';
 if(!r.ok){await r.body?.cancel();return {status:r.status,url:r.url,html:''};}
 if(!/html|xml|text/i.test(type)){await r.body?.cancel();return {status:r.status,url:r.url,html:''};}
 const b=await r.arrayBuffer();const probe=new TextDecoder().decode(b.slice(0,3000));
 const latin=/charset=["']?(?:iso-8859-1|windows-1252)/i.test(type+probe);
 return {status:r.status,url:r.url,html:new TextDecoder(latin?'windows-1252':'utf-8').decode(b.slice(0,3e6))};
}
const strip=s=>s.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&uuml;/g,'ü').replace(/&auml;/g,'ä').replace(/&ouml;/g,'ö').replace(/\s+/g,' ').trim();
function anchors(html,base){
 const out=[];
 for(const m of html.matchAll(/<a\b([^>]*?)href\s*=\s*["']([^"'#]+)[^"']*["']([^>]*)>([\s\S]{0,400}?)<\/a>/gi)){
  try{const u=new URL(m[2].replace(/&amp;/g,'&').trim(),base);if(!/^https?:$/.test(u.protocol))continue;out.push({url:u.href,text:(strip(m[4])+' '+((m[1]+m[3]).match(/title\s*=\s*["']([^"']*)/i)?.[1]||'')).trim().slice(0,120)});}catch{}
 }
 for(const m of html.matchAll(/<(?:iframe|frame)\b[^>]*src\s*=\s*["']([^"']+)["']/gi)){try{out.push({url:new URL(m[1],base).href,text:'(eingebettet)'});}catch{}}
 return out;
}
const skip=/\.(pdf|jpe?g|png|gif|svg|zip|docx?|xlsx?|ics|mp[34])(\?|$)|mailto:|facebook|instagram|youtube|twitter|linkedin|google\.|wikipedia|\/(impressum|datenschutz|kontakt|barrierefrei)/i;
async function crawl(region){
 const sites=[...new Set(wikidata.filter(w=>w.kind===region.kind&&w.ags===region.ags&&w.website).map(w=>w.website))];
 const found=new Map(),visited=new Set(),log=[];let budget=20;
 const bare=h=>h.replace(/^www\./,'');
 const IN_SITE=/sessionnet|si00[0-9][0-9][.](asp|php)|[/]bi[/]|[/]info[.](asp|php)/i;
 // A hit is a link that leaves the municipal site (or is an embedded SessionNet path). Internal pages about the council are explored further.
 const scan=(page,host)=>{const nav=[];for(const a of anchors(page.html,page.url)){if(skip.test(a.url))continue;let u;try{u=new URL(a.url);}catch{continue;}
   const external=bare(u.hostname)!==host,href=RIS_HREF.test(a.url),text=RIS_TEXT.test(a.text);
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
  while(budget>0&&!found.size&&queue.length){
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
 return {id:region.id,name:region.name,kind:region.kind,ags:region.ags,sites,candidates:[...found.values()].slice(0,40),pages:visited.size,log:log.slice(0,8)};
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
