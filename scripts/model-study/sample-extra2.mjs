// Zweite Nachlieferung nach dem ersten vollen Lauf des Modells (23.10.2026): Sachpunkte nach dem Modell (model_labels.kind),
// Schwerpunkt fehlendes oder unsicheres Unterthema (Finanzen, Soziales, Bildung, Kultur), kleine Vorhaben ohne „Vorhaben“ und
// Antragsteller (Anfragen einzelner Mitglieder, Beiräte, Elternräte, Anfragen ohne Fragesteller, Einwohner). Dazu eine frische,
// rein zufällige Prüfmenge (set check), die nie zum Lernen dient. Liest Datenbank und Textablage nur; ohne weitere Module, auch
// auf dem Server unter /tmp lauffähig. Höchstens --cap Berichte je Gebiet und Anteil.
//   DATABASE_FILE=… RM_PDF_STORE=… node sample-extra2.mjs --out=kern-extra2.json --skip=skip-ids.json [--check=300] [--cap=2]
import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const out=arg('out','kern-extra2.json'),cap=+arg('cap',2),PAGE=1500,CHECK=+arg('check',300);
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
const has=(r,t)=>r.themes.includes(t);
const weakSub=r=>r.subs.length===0||r.theme_p<0.6;
// Anteile des Lernsatzes in dieser Reihenfolge (ein Bericht zählt im ersten passenden)
const POOLS=[
 ['antrag-mitglied',90,r=>/\b(anfrage|antrag|anregung)\w*\b[^.;]{0,40}\b(des|der|von)\s+(stadtverordnete\w*|ratsmitglied\w*|ratsherr\w*|ratsfrau|gemeinderat(?:s|smitglied\w*)?|gemeinderätin|stadtrat(?:s)?|stadträtin|kreistagsmitglied\w*|kreistagsabgeordnete\w*|kreisrat|kreisrätin|herrn|frau|hr\.|fr\.)\b/i.test(r.title)],
 ['antrag-gremium',70,r=>/\b(anfrage|antrag|anregung|empfehlung)\w*\b[^.;]{0,50}\b(beirat\w*|beirates|elternrat\w*|elternbeirat\w*|stadtelternrat\w*|jugendrat\w*|jugendparlament\w*|ortsbeirat\w*|ortschaftsrat\w*|bezirksbeirat\w*|seniorenvertretung|integrationsrat\w*|kinder- und jugendparlament\w*)/i.test(r.title)],
 ['antrag-einwohner',40,r=>/einwohnerantrag|bürgerantrag|petition|anregung (gem|nach)|bürgeranregung|anregung und beschwerde|einwohneranregung/i.test(r.title)],
 ['anfrage-ohne',50,r=>/^(beantwortung (der |einer )?)?(anfrage|anfragen)\b(?![^.;]{0,40}\b(fraktion|cdu|csu|spd|fdp|afd|grüne\w*|linke\w*|bsw|freie[nr]? wähler|des|der|von)\b)/i.test(r.title)],
 ['vorhaben-klein',150,r=>!r.project&&/(abbruch|abriss|rückbau|neugestaltung|erneuerung|anschaffung|beschaffung|errichtung|einbau|umbau|anbau|ausbau|markierung|ausstattung|aufstellung von|installation|sanierung|instandsetzung|herstellung|neubau|umgestaltung|erweiterung)\b/i.test(r.title)],
 ['finanzen',110,r=>has(r,'finanzen')&&weakSub(r)],
 ['soziales',110,r=>has(r,'soziales')&&weakSub(r)],
 ['bildung',110,r=>has(r,'bildung')&&weakSub(r)],
 ['kultur',110,r=>has(r,'kultur')&&weakSub(r)],
 ['unsicher',110,r=>weakSub(r)],
 ['zufall',50,()=>true],
];
// Ein Durchgang über alle Sachpunkte nach dem Modell: nur, was die Auswahl braucht
const t0=Date.now(),all=[];
for(const r of db.prepare("SELECT t.id,t.region_id region,json_extract(t.payload,'$.title') title,m.themes,m.theme_p,m.subs,m.project FROM model_labels m JOIN topics t ON t.id=m.topic_id WHERE t.active=1 AND m.kind='subject'").iterate()){
 if(!r.title||skip.has(r.id))continue;
 let themes=[],subs=[];try{themes=JSON.parse(r.themes||'[]');}catch{}try{subs=JSON.parse(r.subs||'[]');}catch{}
 all.push({id:r.id,region:r.region,title:flat(r.title),themes,theme_p:r.theme_p,subs,project:!!r.project});
 if(all.length%200000===0)console.log('gelesen',all.length,((Date.now()-t0)/1000).toFixed(0)+' s');
}
console.log('Sachpunkte',all.length,((Date.now()-t0)/1000).toFixed(0)+' s');
const taken=new Set();
const pick=(rows,n,salt,label)=>{const per=new Map(),res=[];
 for(const r of rows.map(r=>[hash(r.id,salt),r]).sort((a,b)=>a[0]<b[0]?-1:1).map(([,r])=>r)){
  if(res.length>=n)break;if(taken.has(r.id)||(per.get(r.region)||0)>=cap)continue;
  per.set(r.region,(per.get(r.region)||0)+1);taken.add(r.id);res.push({id:r.id,set:label});}
 return res;};
const chosen=[...pick(all,CHECK,'check-extra2-2026-10-23','check')];
for(const [name,n,test] of POOLS)chosen.push(...pick(all.filter(test),n,'extra2-2026-10-23-'+name,name));
const counts={};for(const c of chosen)counts[c.set]=(counts[c.set]||0)+1;console.log('Auswahl',JSON.stringify(counts));
const get=db.prepare("SELECT json_extract(payload,'$.title') title,json_extract(payload,'$.committee') committee,json_extract(payload,'$.paperType') paperType,json_extract(payload,'$.documents') docs,json_extract(payload,'$.events') events,json_extract(payload,'$.eventDate') eventDate,status,source,region_id region FROM topics WHERE id=?");
const rows=[];
for(const [n,c] of chosen.entries()){
 const r=get.get(c.id);let docs=[],ev=[];try{docs=JSON.parse(r.docs||'[]');}catch{}try{ev=JSON.parse(r.events||'[]');}catch{}
 const pdfs=docs.filter(d=>d.kind==='application/pdf').map((d,i)=>{const [e,pages]=pagesOf(d.url);const whole=pages?pages.join('\n'):'';
  return {i,name:flat(d.title),url:d.url,bytes:e?.bytes??null,pages:e?.pages??null,first:pages?flat(pages[0]).slice(0,PAGE):null,decision:pages?decision(whole).slice(0,700)||null:null};});
 const events=ev.map(e=>({date:e.date||null,committee:flat(e.committee),result:flat(e.result||e.decision?.text||e.description)||null}));
 rows.push({id:c.id,set:c.set,region:r.region,source:r.source,title:flat(r.title),committee:flat(r.committee),paperType:flat(r.paperType),eventDate:r.eventDate||null,events,pdfs,rule:{status:r.status},gold:null});
}
writeFileSync(out,JSON.stringify({version:'kern-extra2',note:`Stichtag ${new Date().toISOString().slice(0,10)}; zweite Nachlieferung nach dem ersten Lauf des Modells: Prüfsatz ${CHECK} zufällige Sachpunkte nach dem Modell (set check, nie zum Lernen), Lernsatz mit Schwerpunkt unsicheres Unterthema, kleine Vorhaben, Antragsteller (set = Anteil), höchstens ${cap} je Gebiet und Anteil, ohne frühere Stichproben; je PDF erste Seite (${PAGE} Zeichen) und Beschlussvorschlag; gold von Hilfsagenten nach requirements/begriffsbuch-kern.md`,counts,rows}));
console.log('fertig',rows.length,'Berichte, mit PDF',rows.filter(r=>r.pdfs.length).length,', mit Text',rows.filter(r=>r.pdfs.some(p=>p.first)).length,((Date.now()-t0)/1000).toFixed(0)+' s');
