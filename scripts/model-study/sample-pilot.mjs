// Zieht Berichte für die Einordnung nach requirements/begriffsbuch-kern.md (Stufe 1 des Modells, requirements/modell-konzept.md):
// Titel, Gremium, Art der Vorlage, Sitzungsdatum, Beratungsfolge mit Ergebnistext der Quelle, Dokumentliste (Name, Größe, Seiten) und je PDF die erste Seite und der Beschlussvorschlag
// aus der PDF-Ablage. Liest Datenbank und Ablage nur (auch auf dem Server unter /tmp lauffähig, ohne weitere Module).
// Auswahl per SHA-256(id + Salz), höchstens --cap Berichte je Gebiet, damit viele Gebiete und Systeme vorkommen.
//   DATABASE_FILE=… RM_PDF_STORE=… node sample-pilot.mjs --out=kern-pilot.json --salt=pilot-2026-10-21 --n=200 [--cap=2]
import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const out=arg('out','kern-pilot.json'),salt=arg('salt','pilot'),n=+arg('n',200),cap=+arg('cap',2),PAGE=+arg('page',1500);
if(existsSync(out)&&!process.argv.includes('--force'))throw new Error(out+' gibt es schon (--force)');
const db=new DatabaseSync(process.env.DATABASE_FILE,{readOnly:true});
const storeDir=process.env.RM_PDF_STORE,idx=new DatabaseSync(storeDir+'/index.sqlite',{readOnly:true});
const pdfRow=idx.prepare('SELECT sha256,bytes,pages,status FROM pdfs WHERE url=?'),textRow=idx.prepare('SELECT status FROM texts WHERE sha256=?');
const pagesOf=url=>{const r=pdfRow.get(url);if(!r||(r.status!=='ok'&&r.status!=='text-only'))return [r,null];if(textRow.get(r.sha256)?.status!=='ok')return [r,null];
 try{return [r,readFileSync(`${storeDir}/files/${r.sha256.slice(0,2)}/${r.sha256}.txt`,'utf8').split('\f')];}catch{return [r,null];}};
const flat=s=>String(s||'').replace(/\s+/g,' ').trim();
// wie decision() in shared/topic-facts.mjs
const decision=text=>(flat(text).match(/(Beschlussvorschlag|beschließt|Beschluss:)[^]{0,600}/i)||[''])[0];
const ids=[];
for(const r of db.prepare('SELECT id,region_id FROM topics WHERE active=1').iterate())ids.push([createHash('sha256').update(r.id+salt).digest('hex'),r.id,r.region_id]);
ids.sort((a,b)=>a[0]<b[0]?-1:1);
const get=db.prepare("SELECT json_extract(payload,'$.title') title,json_extract(payload,'$.committee') committee,json_extract(payload,'$.paperType') paperType,json_extract(payload,'$.documents') docs,json_extract(payload,'$.events') events,json_extract(payload,'$.eventDate') eventDate,status,source FROM topics WHERE id=?");
const perRegion=new Map(),rows=[];
for(const [,id,region] of ids){
 if(rows.length>=n)break;
 if((perRegion.get(region)||0)>=cap)continue;
 const r=get.get(id);if(!r?.title)continue;
 let docs=[];try{docs=JSON.parse(r.docs||'[]');}catch{}
 const pdfs=docs.filter(d=>d.kind==='application/pdf').map((d,i)=>{const [e,pages]=pagesOf(d.url);const all=pages?pages.join('\n'):'';
  return {i,name:flat(d.title),url:d.url,bytes:e?.bytes??null,pages:e?.pages??null,first:pages?flat(pages[0]).slice(0,PAGE):null,decision:pages?decision(all).slice(0,700)||null:null};});
 let ev=[];try{ev=JSON.parse(r.events||'[]');}catch{}
 // Beratungsfolge nur mit Angaben der Quelle (Datum, Gremium, Ergebnistext), ohne den daraus abgeleiteten Status
 const events=ev.map(e=>({date:e.date||null,committee:flat(e.committee),result:flat(e.result||e.decision?.text||e.description)||null}));
 perRegion.set(region,(perRegion.get(region)||0)+1);
 rows.push({id,region,source:r.source,title:flat(r.title),committee:flat(r.committee),paperType:flat(r.paperType),eventDate:r.eventDate||null,events,pdfs,rule:{status:r.status},gold:null});
}
writeFileSync(out,JSON.stringify({version:out.replace(/.*\/|\.json$/g,''),note:`${rows.length} aktive Berichte, Stichtag ${new Date().toISOString().slice(0,10)}, höchstens ${cap} je Gebiet, SHA-256(id+'${salt}'), Server-Datenbank und PDF-Ablage ${new Date().toISOString().slice(0,10)}; je PDF erste Seite (${PAGE} Zeichen) und Beschlussvorschlag; gold von Hand (Claude) nach requirements/begriffsbuch-kern.md`,rows},null,1));
const withPdf=rows.filter(r=>r.pdfs.length),withText=rows.filter(r=>r.pdfs.some(p=>p.first));
console.log(rows.length,'Berichte aus',perRegion.size,'Gebieten · mit PDF',withPdf.length,'· mit Text',withText.length,'· PDFs gesamt',rows.reduce((a,r)=>a+r.pdfs.length,0));
