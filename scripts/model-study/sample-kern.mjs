// Stichprobe für die Kernsätze (Zusammenfassung aus dem Modell, requirements/modell-konzept.md): zufällige Sachpunkte mit Text im
// Hauptdokument, ohne Sitzungsunterlagen, höchstens --cap je Gebiet; je Bericht Titel, Gremium und die ersten 15.000 Zeichen des
// Hauptdokuments (wie readDocument). Liest Datenbank und Textablage nur; läuft auch auf dem Server unter /tmp, dann neben einer
// Kopie von shared/document-type.mjs und shared/item-kind.mjs.
//   DATABASE_FILE=… RM_PDF_STORE=… node sample-kern.mjs --out=kern-saetze.json [--n=1500] [--check=300] [--cap=2]
import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const here=existsSync(new URL('./document-type.mjs',import.meta.url))?'./':'../../shared/';
const {primaryPdf,sessionDocument}=await import(here+'document-type.mjs');
const {itemKind}=await import(here+'item-kind.mjs');

const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const out=arg('out','kern-saetze.json'),N=+arg('n',1500),CHECK=+arg('check',300),cap=+arg('cap',2),CHARS=15000;
if(existsSync(out)&&!process.argv.includes('--force'))throw new Error(out+' gibt es schon (--force)');
const db=new DatabaseSync(process.env.DATABASE_FILE,{readOnly:true});
const storeDir=process.env.RM_PDF_STORE,idx=new DatabaseSync(storeDir+'/index.sqlite',{readOnly:true});
const pdfRow=idx.prepare('SELECT sha256,status FROM pdfs WHERE url=?'),textRow=idx.prepare('SELECT status FROM texts WHERE sha256=?');
const hasText=url=>{const r=pdfRow.get(url);return !!r&&(r.status==='ok'||r.status==='text-only')&&textRow.get(r.sha256)?.status==='ok';};
const textOf=url=>{const r=pdfRow.get(url);try{return readFileSync(`${storeDir}/files/${r.sha256.slice(0,2)}/${r.sha256}.txt`,'utf8').split('\f');}catch{return null;}};
const merge=pages=>pages.join('\n').replace(/[^\S\n]+/g,' ').replace(/ ?\n ?/g,'\n').replace(/\n{3,}/g,'\n\n');
const flat=s=>String(s||'').replace(/\s+/g,' ').trim();
const hash=id=>createHash('sha256').update(id+'kern-saetze-2026-10-22').digest('hex');

// Ein Durchgang: Sachpunkte nach Titel, in Zufallsreihenfolge (Prüfsumme der ID)
const t0=Date.now(),cand=[];
for(const r of db.prepare("SELECT id,region_id region,json_extract(payload,'$.title') title FROM topics WHERE active=1").iterate()){
 if(!r.title||itemKind(r.title)!=='subject')continue;cand.push([hash(r.id),r.id,r.region]);
}
cand.sort((a,b)=>a[0]<b[0]?-1:1);
console.log('Sachpunkte',cand.length,((Date.now()-t0)/1000).toFixed(0)+' s');
const get=db.prepare("SELECT json_extract(payload,'$.title') title,json_extract(payload,'$.committee') committee,json_extract(payload,'$.documents') docs FROM topics WHERE id=?");
const per=new Map(),rows=[];
for(const [,id,region] of cand){
 if(rows.length>=N)break;if((per.get(region)||0)>=cap)continue;
 const r=get.get(id);let docs=[];try{docs=JSON.parse(r.docs||'[]');}catch{continue;}
 const doc=primaryPdf(docs,{hasText});if(!doc||sessionDocument(doc)||!hasText(doc.url))continue;
 const pages=textOf(doc.url);if(!pages||pages.length>150)continue;
 const text=merge(pages).slice(0,CHARS);if(text.trim().length<1500)continue;
 per.set(region,(per.get(region)||0)+1);
 rows.push({id,set:rows.length<CHECK?'check':'train',region,title:flat(r.title),committee:flat(r.committee),doc:{name:flat(doc.title),url:doc.url},text,gold:null});
 if(rows.length%250===0)console.log('gewählt',rows.length,((Date.now()-t0)/1000).toFixed(0)+' s');
}
writeFileSync(out,JSON.stringify({version:'kern-saetze',note:`Stichtag ${new Date().toISOString().slice(0,10)}; ${CHECK} Prüfberichte (set check), übrige zum Lernen; zufällige Sachpunkte mit Text im Hauptdokument, höchstens ${cap} je Gebiet; erste ${CHARS} Zeichen`,rows}));
console.log('fertig',rows.length,'Berichte',((Date.now()-t0)/1000).toFixed(0)+' s');
