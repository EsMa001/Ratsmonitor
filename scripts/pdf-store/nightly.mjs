// Nächtliche Kette der PDF-Ablage (docs/betrieb/node-server.md, „PDF-Ablage, Texte, Fakten“): jede Stufe liest nur, was die
// vorige abgelegt hat, und fasst nur Neues an. Reihenfolge fest:
//   1. fetch.mjs      Hauptdokumente laden, Monat für Monat ab heute zurück (neue Sitzungen zuerst), bis --budget-gb plus
//                     --headroom-gb (Standard 3): bei voller Ablage kommen so trotzdem neue Sitzungen dazu, Schritt 2 kürzt danach
//   2. budget.mjs     nur wenn die Ablage über dem Budget liegt: PDFs mit dem geringsten Wert je Byte löschen (Text bleibt)
//   3. text.mjs       Textebene der neuen PDFs
//   4. text.mjs --ocr Seiten ohne Textebene (der langsame Teil; was nicht fertig wird, kommt in der nächsten Nacht)
//   5. summaries.mjs  Regel-Zusammenfassung für Berichte ohne, deren Text jetzt vorliegt
//   6. facts.mjs      Fakten für plenara.X (alle Berichte, wenige Minuten)
//   7. refresh-search-words.mjs  Wortliste nachführen (neue Zusammenfassungen ändern den Suchtext)
// Eine Sperre (nightly.lock in der Ablage) verhindert zwei Läufe zugleich. Scheitert eine Stufe, laufen die übrigen weiter;
// der Exit-Code ist dann 1. Zeit: --minutes (Standard 180) für alles; Laden höchstens --fetch-share (0.4) davon, OCR bekommt,
// was bis auf --reserve (25 min für 5 bis 7) übrig ist.
//
//   node scripts/pdf-store/nightly.mjs [--minutes 180] [--budget-gb 65] [--headroom-gb 3] [--months 240] [--ocr-workers 2] [--dry-run]
// Umgebung: DATABASE_FILE (Server), RM_PDF_STORE (Ablage), OCR_TOOLS/OCR_CACHE (text.mjs).
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const minutes=Number(opt('minutes',180)),budgetGb=Number(opt('budget-gb',65)),headroomGb=Number(opt('headroom-gb',3)),months=Number(opt('months',240));
const fetchShare=Number(opt('fetch-share',0.4)),reserve=Number(opt('reserve',25)),ocrWorkers=Number(opt('ocr-workers',2));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=process.env.RM_PDF_STORE||DEFAULT_PDF_STORE;
const t0=Date.now(),left=()=>minutes-(Date.now()-t0)/60000,stamp=()=>new Date().toISOString().slice(0,19).replace('T',' ');
const say=(...a)=>console.log(stamp(),...a);

/* Sperre: Datei mit der Prozessnummer; eine verwaiste Sperre (Prozess läuft nicht mehr) wird übernommen */
fs.mkdirSync(dir,{recursive:true});
const lock=path.join(dir,'nightly.lock');
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}};
try{fs.writeFileSync(lock,String(process.pid),{flag:'wx'});}
catch{
 const pid=Number(fs.readFileSync(lock,'utf8'));
 if(pid&&alive(pid)){say(`läuft schon (Prozess ${pid}), nichts zu tun`);process.exit(0);}
 fs.writeFileSync(lock,String(process.pid));say(`verwaiste Sperre von Prozess ${pid} übernommen`);
}
const release=()=>{try{if(fs.readFileSync(lock,'utf8')===String(process.pid))fs.unlinkSync(lock);}catch{/* schon weg */}};
process.on('exit',release);for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{release();process.exit(1);});

const sizeGb=()=>{const s=openPdfStore(dir);try{return s.size()/1073741824;}finally{s.close();}};
const failed=[];
function step(name,script,stepArgs){
 const cmd=[process.execPath,'--no-warnings','--max-old-space-size=4096',path.join(root,script),...stepArgs];
 if(flag('dry-run')){say('[Probe]',name+':',cmd.slice(3).join(' '));return;}
 say(`${name} …`);
 const t=Date.now(),r=spawnSync(cmd[0],cmd.slice(1),{cwd:root,stdio:'inherit',env:process.env});
 const sec=Math.round((Date.now()-t)/1000);
 if(r.status===0)say(`${name} fertig (${sec} s)`);else{failed.push(name);say(`${name} FEHLER (Exit ${r.status??r.signal}, ${sec} s), weiter mit der nächsten Stufe`);}
}

say(`Start: Ablage ${dir}, ${sizeGb().toFixed(1)} GB, Budget ${budgetGb} GB (Laden bis ${budgetGb+headroomGb} GB), ${minutes} min`);
/* Laden darf um den Puffer über das Budget gehen; sonst stoppt es bei voller Ablage nach den ersten Dateien und neue Sitzungen
   kämen nicht mehr an. Neue Sitzungen haben einen höheren Wert je Byte, das Kürzen trifft deshalb alte, große und gescannte PDFs. */
step('Laden','scripts/pdf-store/fetch.mjs',['--months',String(months),'--max-gb',String(budgetGb+headroomGb),'--max-minutes',String(Math.max(5,Math.floor(minutes*fetchShare))),'--report-mb','1000']);
if(sizeGb()>budgetGb){
 step('Rang nachtragen','scripts/pdf-store/budget.mjs',['--backfill']);
 step('Budget','scripts/pdf-store/budget.mjs',['--budget-gb',String(budgetGb),'--apply']);
}
step('Textebene','scripts/pdf-store/text.mjs',['--max-minutes',String(Math.max(5,Math.floor(left()-reserve)))]);
const ocr=Math.floor(left()-reserve);
if(ocr>=5)step('OCR','scripts/pdf-store/text.mjs',['--ocr','--workers',String(ocrWorkers),'--max-minutes',String(ocr)]);
else say(`OCR übersprungen (nur ${Math.max(0,ocr)} min übrig)`);
step('Zusammenfassungen','scripts/pdf-store/summaries.mjs',[]);
step('Fakten','scripts/pdf-store/facts.mjs',[]);
step('Wortliste','scripts/refresh-search-words.mjs',['--quiet']);
say(`Ende nach ${Math.round((Date.now()-t0)/60000)} min, Ablage ${sizeGb().toFixed(1)} GB${failed.length?`, Fehler in: ${failed.join(', ')}`:''}`);
process.exit(failed.length?1:0);
