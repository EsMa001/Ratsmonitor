// Regelbasierte Texte (Job „rule-texts“, Admin-Reiter „Regelbasierte Texte“ und „Jobs & Zeitpläne“): erzeugt aus den Texten der
// PDF-Ablage, was sich ohne KI daraus ableiten lässt. Getrennt vom PDF-Import (Entscheidung 13.10.2026): der lädt, speichert und
// liest nur (Textebene, OCR); hier entstehen die Inhalte. Reihenfolge fest:
//   1. pdf-store/summaries.mjs   Regel-Zusammenfassung für Berichte ohne, deren Hauptdokument als Text vorliegt
//   2. pdf-store/facts.mjs       Fakten für plenara.X
//   3. refresh-search-words.mjs  Wortliste nachführen, nur wenn Zusammenfassungen geschrieben wurden (sie ändern den Suchtext)
// Ergebnis je Schritt in system_state 'rule-texts-last' (Anzeige im Reiter). Scheitert ein Schritt, laufen die übrigen weiter
// (Exit 1). Anhalten: SIGTERM/SIGINT (systemctl stop, Knopf „Anhalten“) geht an den laufenden Schritt, die übrigen entfallen (Exit 3).
//
//   node scripts/rule-texts.mjs [--dry-run]
// Umgebung: DATABASE_FILE (Server), RM_PDF_STORE (Ablage).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {writeState,databaseFile} from './pdf-store/state.mjs';
import {FACTS_VERSION} from '../shared/topic-facts.mjs';
import {RULE_TEXTS_KEY} from '../server/integrations/schedules.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dry=process.argv.includes('--dry-run'),t0=Date.now();
const say=(...a)=>console.log(new Date().toISOString().slice(0,19).replace('T',' '),...a);
const summaryFile=path.join(os.tmpdir(),`rule-texts-step-${process.pid}.json`);
const steps=[],failed=[];
let child=null,stopped=false;
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{if(stopped)process.exit(130);stopped=true;say('angehalten, laufender Schritt wird beendet');try{child?.kill('SIGTERM');}catch{/* schon weg */}});

async function step(name,script,stepArgs=[]){
 const cmd=[process.execPath,'--no-warnings','--max-old-space-size=6144',path.join(root,script),...stepArgs];
 if(dry){say('[Probe]',name+':',cmd.slice(3).join(' '));return null;}
 if(stopped){say(`${name} übersprungen (angehalten)`);return null;}
 say(`${name} …`);
 try{fs.unlinkSync(summaryFile);}catch{/* keine */}
 const t=Date.now();
 const status=await new Promise(resolve=>{
  child=spawn(cmd[0],cmd.slice(1),{cwd:root,stdio:'inherit',env:{...process.env,RM_STEP_SUMMARY:summaryFile}});
  child.on('error',e=>{say(`${name}: ${e.message}`);resolve(127);});
  child.on('exit',(c,s)=>resolve(c??s));
 });
 child=null;
 let summary=null;try{summary=JSON.parse(fs.readFileSync(summaryFile,'utf8'));fs.unlinkSync(summaryFile);}catch{/* ohne */}
 const seconds=Math.round((Date.now()-t)/1000),ok=status===0||stopped;
 steps.push({name,seconds,ok,summary:summary||(stopped?{stopped:true}:null)});
 if(!ok)failed.push(name);
 say(`${name} ${stopped?'angehalten':ok?'fertig':`FEHLER (${status})`} (${seconds} s)`);
 return summary;
}
const skip=(name,why)=>{say(`${name} ausgelassen (${why})`);steps.push({name,seconds:0,ok:true,summary:{skipped:why}});};

const sum=await step('Zusammenfassungen','scripts/pdf-store/summaries.mjs');
await step('Fakten','scripts/pdf-store/facts.mjs');
/* Stand der Fakten für den Reiter (einmal je Lauf gezählt, damit die Seite beim Öffnen nichts rechnet): Berichte mit Fakten,
   davon aus dem Text des Hauptdokuments, in der aktuellen Fassung der Regeln */
let facts=null;
if(!dry)try{
 const db=new DatabaseSync(databaseFile());
 try{facts={version:FACTS_VERSION,...db.prepare("SELECT count(DISTINCT topic_id) reports,count(DISTINCT CASE WHEN method LIKE '%:text' THEN topic_id END) fromText,count(DISTINCT CASE WHEN method NOT LIKE ?||':%' THEN topic_id END) stale FROM topic_facts").get(FACTS_VERSION)};}
 finally{db.close();}
}catch(e){say('Fakten zählen:',e.message);}
if(!dry){
 if(sum&&!sum.withText)skip('Wortliste','keine Zusammenfassung geschrieben');
 else await step('Wortliste','scripts/refresh-search-words.mjs',['--quiet']);
}else await step('Wortliste','scripts/refresh-search-words.mjs',['--quiet']);

const result=stopped?'stopped':failed.length?'failed':'done';
if(!dry)writeState(RULE_TEXTS_KEY,{startedAt:new Date(t0).toISOString(),finishedAt:new Date().toISOString(),result,steps,facts});
say(`Ende nach ${Math.round((Date.now()-t0)/1000)} s${failed.length?`, Fehler in: ${failed.join(', ')}`:''}`);
process.exit(stopped?3:failed.length?1:0);
