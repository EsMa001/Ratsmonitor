// PDF-Ablage mit festem Budget (server/node/pdf-store.mjs, Score: shared/pdf-rank.mjs): Texte bleiben immer, PDFs nach
// Score, bis das Budget voll ist. Ohne --apply wird nur gerechnet.
//
//   node scripts/pdf-store/budget.mjs --backfill           Dokumentart, Formalie, Sitzungstag aus der Datenbank nachtragen, dazu die
//        Art laut Textanfang (texts.head_type); nach neuen Regeln (DOC_TYPE_VERSION) alle Einträge neu, sonst nur fehlende
//   node scripts/pdf-store/budget.mjs [--budget-gb 80]    was passt hinein, was behält nur den Text
//   node scripts/pdf-store/budget.mjs --budget-gb 80 --population 870701
//        Hochrechnung: die Ablage als Stichprobe von `population` Dokumenten; das Budget schrumpft im selben Verhältnis
//   node scripts/pdf-store/budget.mjs --budget-gb 15 --apply   PDFs außerhalb des Budgets löschen (Text bleibt, Status 'text-only')
import {existsSync,readdirSync,openSync,readSync,closeSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {documentType,documentTypeFromText,DOC_TYPE_VERSION} from '../../shared/document-type.mjs';
import {TYPE_VALUE,BUDGET_GB} from '../../shared/pdf-rank.mjs';
import {rankedFiles,textBytes as textBytesOf} from './store-lib.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE),db=store.db;
const GB=b=>(b/1073741824).toFixed(1)+' GB',pct=(a,b)=>b?(100*a/b).toFixed(1)+' %':'-';

if(flag('backfill')){
 const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
 const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
 const main=new DatabaseSync(process.env.DATABASE_FILE||dir+local,{readOnly:true});
 const hasFormal=main.prepare("SELECT 1 FROM pragma_table_info('search_cards') WHERE name='formal'").get();
 const q=main.prepare(`SELECT event_date AS date,json_extract(payload,'$.documents') AS docs${hasFormal?',(SELECT formal FROM search_cards c WHERE c.id=topics.id) AS formal':''} FROM topics WHERE id=?`);
 const retype=store.note('doc-type-version')!==String(DOC_TYPE_VERSION);
 if(retype)console.log(`Regeln der Dokumentart neu (Fassung ${DOC_TYPE_VERSION}): alle Einträge werden neu eingeordnet`);
 const rows=db.prepare(`SELECT url,topic_id AS topic FROM pdfs WHERE status IN ('ok','text-only') AND topic_id IS NOT NULL${retype?'':' AND doc_type IS NULL'}`).all();
 const t0=Date.now();db.exec('BEGIN');
 rows.forEach((r,i)=>{
  const x=q.get(r.topic);if(!x)return;
  let title='';try{title=JSON.parse(x.docs||'[]').find(d=>d.url===r.url)?.title||'';}catch{/* kaputtes JSON: Art bleibt 'other' */}
  store.setMeta(r.url,{docType:documentType(title),formal:x.formal??null,eventDate:x.date});
  if(i%20000===19999){db.exec('COMMIT;BEGIN');console.log(`${i+1}/${rows.length}`);}
 });
 db.exec('COMMIT');main.close();
 console.log(`${rows.length} Einträge nachgetragen (${((Date.now()-t0)/1000).toFixed(0)} s)`);
 // Art laut Textanfang: die ersten Zeichen jeder Textfassung
 const head=sha=>{try{const fd=openSync(store.file(sha).replace(/\.pdf$/,'.txt'),'r'),b=Buffer.alloc(2400);try{return b.subarray(0,readSync(fd,b,0,2400,0)).toString('utf8');}finally{closeSync(fd);}}catch{return null;}};
 const texts=db.prepare(`SELECT sha256 AS sha FROM texts WHERE status='ok'${retype?'':' AND head_type IS NULL'}`).all(),t1=Date.now();let found=0;
 db.exec('BEGIN');
 texts.forEach((r,i)=>{const h=head(r.sha);if(h==null)return;const type=documentTypeFromText(h);if(type)found++;store.setHeadType(r.sha,type);
  if(i%20000===19999){db.exec('COMMIT;BEGIN');console.log(`Textanfang ${i+1}/${texts.length}`);}});
 db.exec('COMMIT');
 store.setNote('doc-type-version',DOC_TYPE_VERSION);
 console.log(`${texts.length} Textanfänge gelesen, ${found} mit erkennbarer Art (${((Date.now()-t1)/1000).toFixed(0)} s)`);
 process.exit(0);
}

const ranked=rankedFiles(store),files=ranked,textBytes=textBytesOf(store);

const budget=Number(opt('budget-gb',BUDGET_GB))*1073741824,population=Number(opt('population',0));
const share=population?files.length/population:1,limit=budget*share;
let used=textBytes,cut=null;const kept=[],dropped=[];
for(const f of ranked){if(f.keep&&used+f.bytes<=limit){used+=f.bytes;kept.push(f);}else{dropped.push(f);cut??=f;}}
const total=files.reduce((a,f)=>a+f.bytes,0);
console.log(`${files.length} PDFs (${GB(total)}), Texte ${GB(textBytes)}${population?`; Hochrechnung auf ${population} Dokumente: Budget ${GB(budget)} entspricht hier ${GB(limit)}`:`; Budget ${GB(budget)}`}`);
console.log(`behalten: ${kept.length} PDFs (${pct(kept.length,files.length)}), ${GB(kept.reduce((a,f)=>a+f.bytes,0))} (${pct(kept.reduce((a,f)=>a+f.bytes,0),total)} des PDF-Platzes)`);
console.log(`nur Text: ${dropped.length} PDFs, ${GB(dropped.reduce((a,f)=>a+f.bytes,0))}${cut?`; erste Datei außerhalb: ${(cut.bytes/1048576).toFixed(1)} MB, ${cut.type}`:''}`);
const by={};for(const [k,list] of [['behalten',kept],['nur Text',dropped]])for(const f of list){by[f.type]??={behalten:[0,0],'nur Text':[0,0]};by[f.type][k][0]++;by[f.type][k][1]+=f.bytes;}
console.log('\nArt         behalten            nur Text');
for(const [t,v] of Object.entries(by).sort((a,b)=>(TYPE_VALUE[b[0]]??0)-(TYPE_VALUE[a[0]]??0)))
 console.log(t.padEnd(11),`${v.behalten[0]} (${GB(v.behalten[1])})`.padEnd(19),`${v['nur Text'][0]} (${GB(v['nur Text'][1])})`);
const biggest=kept.reduce((m,f)=>Math.max(m,f.bytes),0);
console.log(`\ngrößtes behaltenes PDF: ${(biggest/1048576).toFixed(1)} MB; Scans behalten: ${kept.filter(f=>f.scan).length}, nur Text: ${dropped.filter(f=>f.scan).length}`);
if(flag('apply')){
 if(population){console.error('--apply nur ohne --population');process.exit(1);}
 // Nur löschen, was schon eine Textfassung hat; der Rest wartet auf scripts/pdf-store/text.mjs. Keine OCR vorher (Entscheidung
 // 12.10.2026): Seiten ohne Text liest der Auftrag „OCR starten“, der die Datei dafür kurz nachlädt.
 const now=dropped.filter(f=>f.chars!=null);
 store.dropPdfs(now.map(f=>f.sha));
 console.log(`${now.length} PDFs gelöscht, ihre Texte bleiben; ${dropped.length-now.length} ohne Textfassung bleiben vorerst.`);
}
store.close();
