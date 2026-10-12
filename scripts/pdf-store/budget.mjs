// PDF-Ablage mit festem Budget (server/node/pdf-store.mjs, Rang: shared/pdf-rank.mjs): Texte bleiben immer, PDFs nach
// Wert je Byte, bis das Budget voll ist. Ohne --apply wird nur gerechnet.
//
//   node scripts/pdf-store/budget.mjs --backfill           Dokumentart, Formalie, Sitzungstag aus der Datenbank nachtragen
//   node scripts/pdf-store/budget.mjs [--budget-gb 100]    was passt hinein, was behält nur den Text
//   node scripts/pdf-store/budget.mjs --budget-gb 100 --population 870701
//        Hochrechnung: die Ablage als Stichprobe von `population` Dokumenten; das Budget schrumpft im selben Verhältnis
//   node scripts/pdf-store/budget.mjs --budget-gb 15 --apply   PDFs außerhalb des Budgets löschen (Text bleibt, Status 'text-only')
import {existsSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {documentType} from '../../shared/document-type.mjs';
import {TYPE_VALUE} from '../../shared/pdf-rank.mjs';
import {rankedFiles,textBytes as textBytesOf,ocrScheduler,ocrFile} from './store-lib.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE),db=store.db;
const GB=b=>(b/1073741824).toFixed(1)+' GB',pct=(a,b)=>b?(100*a/b).toFixed(1)+' %':'-';

if(flag('backfill')){
 const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
 const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
 const main=new DatabaseSync(process.env.DATABASE_FILE||dir+local,{readOnly:true});
 const hasFormal=main.prepare("SELECT 1 FROM pragma_table_info('search_cards') WHERE name='formal'").get();
 const q=main.prepare(`SELECT event_date AS date,json_extract(payload,'$.documents') AS docs${hasFormal?',(SELECT formal FROM search_cards c WHERE c.id=topics.id) AS formal':''} FROM topics WHERE id=?`);
 const rows=db.prepare("SELECT url,topic_id AS topic FROM pdfs WHERE status IN ('ok','text-only') AND doc_type IS NULL AND topic_id IS NOT NULL").all();
 const t0=Date.now();db.exec('BEGIN');
 rows.forEach((r,i)=>{
  const x=q.get(r.topic);if(!x)return;
  let title='';try{title=JSON.parse(x.docs||'[]').find(d=>d.url===r.url)?.title||'';}catch{/* kaputtes JSON: Art bleibt 'other' */}
  store.setMeta(r.url,{docType:documentType(title),formal:x.formal??null,eventDate:x.date});
  if(i%20000===19999){db.exec('COMMIT;BEGIN');console.log(`${i+1}/${rows.length}`);}
 });
 db.exec('COMMIT');main.close();
 console.log(`${rows.length} Einträge nachgetragen (${((Date.now()-t0)/1000).toFixed(0)} s)`);
 process.exit(0);
}

const ranked=rankedFiles(store),files=ranked,textBytes=textBytesOf(store);

const budget=Number(opt('budget-gb',100))*1073741824,population=Number(opt('population',0));
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
 // Nur löschen, was schon eine Textfassung hat; der Rest wartet auf scripts/pdf-store/text.mjs. Seiten ohne Text (Scans)
 // vorher per OCR lesen, damit der Text vollständig bleibt. Übrige PDFs (role other) nur Textebene, kein OCR.
 const go=dropped.filter(f=>f.chars!=null);let ocr=null,ocrPages=0;
 for(const f of go.filter(f=>f.ocrNeeded>0&&!f.other)){ocr??=await ocrScheduler(Number(opt('ocr-workers',2)));if(!ocr){console.error('OCR-Werkzeuge fehlen: Scans ohne OCR bleiben als PDF.');break;}ocrPages+=await ocrFile(store,f.sha,ocr);f.ocrNeeded=0;}
 if(ocr)await ocr.terminate();
 const now=go.filter(f=>!(f.ocrNeeded>0&&!f.other));
 db.exec('BEGIN');for(const f of now)store.dropPdf(f.sha);db.exec('COMMIT');
 if(ocrPages)console.log(`${ocrPages} Seiten vor dem Löschen per OCR gelesen`);
 console.log(`${now.length} PDFs gelöscht, ihre Texte bleiben; ${dropped.length-now.length} ohne vollständige Textfassung bleiben vorerst.`);
}
store.close();
