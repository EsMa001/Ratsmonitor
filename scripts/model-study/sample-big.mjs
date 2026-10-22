// Große Stichprobe für das Modell (requirements/modell-konzept.md): Prüfsatz rein zufällig, Lernsatz zufällig plus gezielte Anteile
// (Vorauswahl mit groben Suchwörtern im Titel oder Ergebnis; eingeordnet wird jeder Bericht nach dem Begriffsbuch). Liest Datenbank
// und Textablage nur; ohne weitere Module, auch auf dem Server unter /tmp lauffähig. Höchstens --cap Berichte je Gebiet und Anteil.
//   DATABASE_FILE=… RM_PDF_STORE=… node sample-big.mjs --out=kern-big.json --skip=kern-pilot-ids.json [--check=1500] [--cap=3]
import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const out=arg('out','kern-big.json'),cap=+arg('cap',3),PAGE=1500,CHECK=+arg('check',1500);
if(existsSync(out)&&!process.argv.includes('--force'))throw new Error(out+' gibt es schon (--force)');
const skip=new Set(arg('skip','')?JSON.parse(readFileSync(arg('skip',''),'utf8')):[]);
const db=new DatabaseSync(process.env.DATABASE_FILE,{readOnly:true});
const storeDir=process.env.RM_PDF_STORE,idx=new DatabaseSync(storeDir+'/index.sqlite',{readOnly:true});
const pdfRow=idx.prepare('SELECT sha256,bytes,pages,status FROM pdfs WHERE url=?'),textRow=idx.prepare('SELECT status FROM texts WHERE sha256=?');
const pagesOf=url=>{const r=pdfRow.get(url);if(!r||(r.status!=='ok'&&r.status!=='text-only'))return [r,null];if(textRow.get(r.sha256)?.status!=='ok')return [r,null];
 try{return [r,readFileSync(`${storeDir}/files/${r.sha256.slice(0,2)}/${r.sha256}.txt`,'utf8').split('\f')];}catch{return [r,null];}};
const flat=s=>String(s||'').replace(/\s+/g,' ').trim();
const decision=text=>(flat(text).match(/(Beschlussvorschlag|beschließt|Beschluss:)[^]{0,600}/i)||[''])[0];
const hash=(id,salt)=>createHash('sha256').update(id+salt).digest('hex');
const PLACEHOLDER=/^Öffentlich(?:er Tagesordnungspunkt| auf der Tagesordnung);|^In der Tagesordnung geführt/;
// Anteile des Lernsatzes in dieser Reihenfolge (ein Bericht zählt im ersten passenden)
const POOLS=[
 ['waerme',150,r=>/wärmeplan|wärmeleitplan|\bkwp\b/i.test(r.title)],
 ['ablehnung',200,r=>r.results.some(t=>/abgelehnt|vertagt|zurückgestellt|abgesetzt|zurückgezogen|nicht zugestimmt/i.test(t))],
 ['politik',600,r=>/\b(antr[aä]g\w*|anfrage\w*)\b[^.;]{0,50}\b(fraktion|cdu|csu|spd|fdp|afd|grüne\w*|bündnis|linke\w*|bsw|freie[nr]? wähler|fwg|uwg|ödp|volt)\b|\b(fraktion|cdu|csu|spd|fdp|afd|grüne\w*|linke\w*|bsw)\b[^.;]{0,30}\b(antr[aä]g|anfrage)/i.test(r.title)],
 ['plan',500,r=>/bebauungsplan|b-plan|flächennutzungsplan|\bfnp\b|bauleitplan/i.test(r.title)],
 ['wohnbau',300,r=>/baugebiet|wohngebiet|bauplätze|bauplatz|wohnbaufläche|wohnbauland|wohnquartier/i.test(r.title)],
 ['signal',600,r=>/windenergie|windpark|windkraft|photovoltaik|solarpark|freiflächen|batteriespeicher|glasfaser|breitband|mobilfunk|kläranlage|kanalsanierung|trinkwasser|hochwasser|starkregen|radweg|brücke|straßenausbau|ausbau der .*straße|(neubau|sanierung|erweiterung)[^.;]{0,40}(kita|kindergarten|schule|sporthalle|turnhalle|feuerwehr|hallenbad|freibad)|bürgerbus|ladesäule|ladeinfrastruktur|carsharing|gewerbegebiet|rechenzentrum|pflegeheim|ärztehaus|\bmvz\b|supermarkt|nahversorg|vergabe|ausschreibung|beschaffung/i.test(r.title)],
 ['selten',150,r=>/rettungs|katastroph|sirene|wochenmarkt|jahrmarkt|\bleader\b|regionalbudget|fachkräfte|arbeitsmarkt|bücherei|bibliothek|musikschule|volkshochschule|haushaltssicherung|obdach|wohnungslos|wirtschaftsförder|friedhof|städtepartner/i.test(r.title)],
 ['ergebnis',1000,r=>r.pdfCount>0&&(r.results.some(t=>t&&!PLACEHOLDER.test(t))||r.pdfNames.some(n=>/beschluss|auszug|niederschrift|protokoll/i.test(n)))],
 ['zufall',2500,()=>true],
];
// Ein Durchgang über alle aktiven Berichte: nur, was die Auswahl braucht
const t0=Date.now(),all=[];
for(const r of db.prepare("SELECT id,region_id region,json_extract(payload,'$.title') title,json_extract(payload,'$.events') events,json_extract(payload,'$.documents') docs FROM topics WHERE active=1").iterate()){
 if(!r.title||skip.has(r.id))continue;
 let ev=[],docs=[];try{ev=JSON.parse(r.events||'[]');}catch{}try{docs=JSON.parse(r.docs||'[]');}catch{}
 const pdfs=docs.filter(d=>d.kind==='application/pdf');
 all.push({id:r.id,region:r.region,title:flat(r.title),results:ev.map(e=>flat(e.result||e.decision?.text||e.description)),pdfCount:pdfs.length,pdfNames:pdfs.map(d=>flat(d.title))});
 if(all.length%200000===0)console.log('gelesen',all.length,((Date.now()-t0)/1000).toFixed(0)+' s');
}
console.log('aktive Berichte',all.length,((Date.now()-t0)/1000).toFixed(0)+' s');
const taken=new Set();
const pick=(rows,n,salt,label)=>{const per=new Map(),res=[];
 for(const r of rows.map(r=>[hash(r.id,salt),r]).sort((a,b)=>a[0]<b[0]?-1:1).map(([,r])=>r)){
  if(res.length>=n)break;if(taken.has(r.id)||(per.get(r.region)||0)>=cap)continue;
  per.set(r.region,(per.get(r.region)||0)+1);taken.add(r.id);res.push({id:r.id,set:label});}
 return res;};
const chosen=[...pick(all,CHECK,'check-big-2026-10-21','check')];
for(const [name,n,test] of POOLS)chosen.push(...pick(all.filter(test),n,'train-big-2026-10-21-'+name,name));
const counts={};for(const c of chosen)counts[c.set]=(counts[c.set]||0)+1;console.log('Auswahl',JSON.stringify(counts));
// Einzelheiten nur für die Ausgewählten
const get=db.prepare("SELECT json_extract(payload,'$.title') title,json_extract(payload,'$.committee') committee,json_extract(payload,'$.paperType') paperType,json_extract(payload,'$.documents') docs,json_extract(payload,'$.events') events,json_extract(payload,'$.eventDate') eventDate,status,source,region_id region FROM topics WHERE id=?");
const rows=[];
for(const [n,c] of chosen.entries()){
 const r=get.get(c.id);let docs=[],ev=[];try{docs=JSON.parse(r.docs||'[]');}catch{}try{ev=JSON.parse(r.events||'[]');}catch{}
 const pdfs=docs.filter(d=>d.kind==='application/pdf').map((d,i)=>{const [e,pages]=pagesOf(d.url);const whole=pages?pages.join('\n'):'';
  return {i,name:flat(d.title),url:d.url,bytes:e?.bytes??null,pages:e?.pages??null,first:pages?flat(pages[0]).slice(0,PAGE):null,decision:pages?decision(whole).slice(0,700)||null:null};});
 const events=ev.map(e=>({date:e.date||null,committee:flat(e.committee),result:flat(e.result||e.decision?.text||e.description)||null}));
 rows.push({id:c.id,set:c.set,region:r.region,source:r.source,title:flat(r.title),committee:flat(r.committee),paperType:flat(r.paperType),eventDate:r.eventDate||null,events,pdfs,rule:{status:r.status},gold:null});
 if((n+1)%1000===0)console.log('Einzelheiten',n+1,'/',chosen.length,((Date.now()-t0)/1000).toFixed(0)+' s');
}
writeFileSync(out,JSON.stringify({version:'kern-big',note:`Stichtag ${new Date().toISOString().slice(0,10)}; Prüfsatz ${CHECK} zufällig (set check), Lernsatz zufällig plus gezielte Anteile (set = Anteil), höchstens ${cap} je Gebiet und Anteil, ohne Pilot; Server-Datenbank und Textablage; je PDF erste Seite (${PAGE} Zeichen) und Beschlussvorschlag; gold von Hand (Claude) nach requirements/begriffsbuch-kern.md`,counts,rows}));
console.log('fertig',rows.length,'Berichte, mit PDF',rows.filter(r=>r.pdfs.length).length,', mit Text',rows.filter(r=>r.pdfs.some(p=>p.first)).length,((Date.now()-t0)/1000).toFixed(0)+' s');
