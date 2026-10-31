// Dokumentindex der Dokumentsuche aufbauen bzw. nachführen (server/node/doc-index.mjs, indexDocuments; Konzept
// requirements/dokumentsuche-konzept.md): Textfassungen der Hauptdokumente aus der Ablage in RM_PDF_STORE/fts.sqlite, die jüngste
// Sitzung zuerst, wiederaufnehmbar. Nachts als Schritt „Dokumente indizieren“ am Ende der Tagespipeline (nightly.mjs --daily) und
// nach der OCR für die Berichte mit neuem Text (--ids), Erstaufbau als Auftrag „index“ im Reiter PDF-Import (job.mjs, 10 bis
// 22 Uhr). Nachts und nach der OCR nur, wenn es den Index schon gibt (angelegt wird er nur per Auftrag oder von Hand).
// Ergebnis des Laufs in system_state 'doc-index-last' (Reiter PDF-Import, Betriebsprüfung) und als Zusammenfassung für nightly.mjs.
//
//   node scripts/pdf-store/doc-index.mjs [--max-minutes M] [--ids datei] [--full] [--if-exists] [--dry-run] [--stats]
//        --ids: nur die Dateien dieser Berichte (eine ID je Zeile); --full: neu bauen in fts.next.sqlite, die Suche liest derweil
//        den alten Index; --if-exists: nichts tun, wenn es noch keinen Index gibt; --stats: Stand ausgeben
// Umgebung: RM_PDF_STORE (Ablage), DATABASE_FILE (Hauptdatenbank, nur für den Stand in system_state)
import fs from 'node:fs';
import path from 'node:path';
import {DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {indexDocuments,docIndexInfo,DOC_INDEX_FILE,DOC_INDEX_NEXT} from '../../server/node/doc-index.mjs';
import {progress,onStop,stepSummary,lane,writeState,readState} from './state.mjs';
import {DOC_INDEX_KEY} from '../../server/integrations/pdf-store-admin.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const dir=process.env.RM_PDF_STORE||DEFAULT_PDF_STORE;
const started=Date.now(),maxMinutes=Number(opt('max-minutes',opt('minutes',0)));
const myLane=lane('chain'),chained=!!process.env.RM_PROGRESS_BASE;

if(flag('stats')){console.log(JSON.stringify({...docIndexInfo(dir),last:readState(DOC_INDEX_KEY)},null,1));process.exit(0);}
if(flag('if-exists')&&!fs.existsSync(path.join(dir,DOC_INDEX_FILE))&&!fs.existsSync(path.join(dir,DOC_INDEX_NEXT))){
 console.log('Kein Dokumentindex angelegt, nichts zu tun (anlegen: Auftrag „Dokumentindex aufbauen“ im Reiter PDF-Import)');
 stepSummary({skipped:'kein Index angelegt'});process.exit(0);
}
const ids=opt('ids')?fs.readFileSync(opt('ids'),'utf8').split(/\s+/).map(x=>x.trim()).filter(Boolean):null;
let halted=false;
onStop(myLane,started,why=>{halted=true;console.log(`Angehalten (${why==='admin'?'Admin-Reiter':why}), nach der laufenden Datei`);});
const tell=detail=>{if(!process.env.RM_NO_PROGRESS)progress(myLane,{...(chained?{}:{kind:'index',startedAt:new Date(started).toISOString()}),step:'Dokumente indizieren',...detail});};
const result=await indexDocuments({dir,full:flag('full'),ids,dryRun:flag('dry-run'),deadline:maxMinutes>0?started+maxMinutes*60000:Infinity,stop:()=>halted,tick:tell});
console.log(JSON.stringify(result));
/* Stand: ein ganzer Lauf ersetzt ihn (Rückstand, Abdeckung); ein Lauf nach der OCR (--ids) vermerkt sich nur daneben, sein
   Rückstand gilt nur für seine Berichte. completeAt: einmal ganz aufgebaut (erst danach warnt die Betriebsprüfung bei Rückstand) */
if(!flag('dry-run')&&!result.busy&&!result.skipped){
 const info=docIndexInfo(dir),prev=readState(DOC_INDEX_KEY),at=new Date().toISOString();
 const counts={indexFiles:info?.files??null,indexPages:info?.pages??null,rebuildFiles:info?.rebuild?.files??null,bytes:result.bytes};
 if(ids)writeState(DOC_INDEX_KEY,{...(prev||{}),...counts,idsRun:{at,seconds:result.seconds,added:result.added,updated:result.updated,removed:result.removed}});
 else writeState(DOC_INDEX_KEY,{at,startedAt:new Date(started).toISOString(),...result,...counts,completeAt:prev?.completeAt||(result.done&&!result.rebuild?at:null)});
}
stepSummary({...result,stopped:halted||result.stopped});
if(!chained)progress(myLane,null);
process.exit(0);
