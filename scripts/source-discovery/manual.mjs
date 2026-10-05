// Council systems found by hand: a CSV with Gebiet;Land;Adresse becomes candidates of the targeted check
// (<DIR>candidates-fix.json, checked into verified-fix.json, which build.mjs reads after the web search).
//
//   export LAND=de DIR=tmp/source-discovery-de/
//   node scripts/source-discovery/manual.mjs funde.csv
//   CANDIDATES=candidates-fix.json OUT=verified-fix.json ONLY_FILE=$DIR/manuell-<datum>.txt node scripts/source-discovery/verify.mjs
//   (then build.mjs, servers.mjs, ONLY_NEW=1 robots.mjs, dashboard and tests)
//
// Gebiet: name as in the catalog, catalog id or official key; Land: name or two-digit key where a name occurs twice;
// Adresse: the page of the system (https://buergerinfo-ort.digitalfabrix.de/, https://ort.gremien.info/ …).
// A found address is no proof: verify.mjs reads it like every link and takes it only if the system names the area,
// shows public agenda items of the last three months and robots.txt allows it (or a consent covers it).
import fs from 'node:fs';
import {CATALOG,landName} from '../../shared/catalog.mjs';
import {loadAreas} from './areas.mjs';
import {parseAddressCsv} from '../../server/integrations/consents.mjs';
const file=process.argv[2];
if(!file){console.log('Aufruf: node scripts/source-discovery/manual.mjs <funde.csv>');process.exit(1);}
const dir=process.env.DIR||'tmp/source-discovery/',out=dir+'candidates-fix.json',today=new Date().toISOString().slice(0,10);
const {rows,problems}=parseAddressCsv(fs.readFileSync(file,'utf8'),CATALOG,{landName});
for(const p of problems)console.log(' !',p);
const areas=new Set(loadAreas().map(r=>r.id)),mine=rows.filter(r=>areas.has(r.area.id)),elsewhere=rows.length-mine.length;
const candidates=fs.existsSync(out)?JSON.parse(fs.readFileSync(out,'utf8')):{};
for(const {area,url} of mine){
 const row=candidates[area.id]||{id:area.id,name:area.name,kind:area.kind,ags:area.ags,sites:[],candidates:[],log:[]};
 if(!row.candidates.some(c=>c.url===url))row.candidates.unshift({url,from:'manuell '+today,byHref:true,guessed:'Meldung (von Hand gefunden)'});
 candidates[area.id]=row;
}
fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(out,JSON.stringify(candidates,null,1));
const list=`${dir}manuell-${today}.txt`;fs.writeFileSync(list,mine.map(r=>r.area.id).join('\n')+'\n');
console.log(`${mine.length} Adressen für ${dir} übernommen${elsewhere?`, ${elsewhere} gehören zu einem anderen Arbeitsordner (LAND/DIR)`:''}, ${problems.length} zur Rückfrage. Kandidaten: ${out}, Prüfliste: ${list}`);
