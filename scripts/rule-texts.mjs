// Regelbasierte Texte (Job „rule-texts“, Admin-Reiter „Regelbasierte Texte“ und „Jobs & Zeitpläne“): erzeugt aus den Texten der
// PDF-Ablage, was sich ohne KI daraus ableiten lässt. Getrennt vom PDF-Import (Entscheidung 13.10.2026): der lädt, speichert und
// liest nur (Textebene, OCR); hier entstehen die Inhalte. Reihenfolge fest:
//   0. reclassify-rules.mjs        Titelregel (classification, Label der Suche) für neue und veraltete Berichte (seit 15.10.2026)
//   1. pdf-store/read-reports.mjs  alle Regeln je Bericht in einem Durchlauf (readReport): Art des Punkts, Thema,
//                                  Regel-Zusammenfassung, Fakten; nur Berichte mit geänderten Eingaben (report_rules)
//   2. refresh-search-words.mjs    Wortliste nachführen, immer (Zusammenfassungen ändern den Suchtext; rückt auch das Datum
//                                  „Stand heute“ der Karten nach; seit 14.10.2026 gibt es keinen eigenen Wortlisten-Job mehr)
//   3. plenara-x/build-x-cases.mjs Zahlen für plenara.X (x_cases) neu, immer (auch Thema von Hand, KI-Label und neue Karten)
//   4. KI-Zähler ('ai-counts') und Wege der Berichte für die Debug-Seite (pipeline-trace.mjs, 'pipeline-trace')
// Ergebnis je Schritt in system_state 'rule-texts-last' (Anzeige im Reiter). Scheitert ein Schritt, laufen die übrigen weiter
// (Exit 1). Anhalten: SIGTERM/SIGINT (systemctl stop, Knopf „Anhalten“) geht an den laufenden Schritt, die übrigen entfallen (Exit 3).
//
//   node scripts/rule-texts.mjs [--all] [--dry-run]
// --all oder Wunsch „Alle neu erstellen“ (system_state 'rule-texts-all'): alle Berichte neu lesen (read-reports.mjs --all) und
// die Wortliste voll neu (--full); der Wunsch wird beim Start gelöscht.
// Umgebung: DATABASE_FILE (Server), RM_PDF_STORE (Ablage).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {writeState,databaseFile} from './pdf-store/state.mjs';
import {FACTS_VERSION} from '../shared/topic-facts.mjs';
import {RULE_TEXTS_KEY,RULE_TEXTS_ALL_KEY} from '../server/integrations/schedules.mjs';
import {readState} from './pdf-store/state.mjs';
import {stepName} from '../shared/pipeline-terms.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dry=process.argv.includes('--dry-run'),t0=Date.now();
const all=process.argv.includes('--all')||!!readState(RULE_TEXTS_ALL_KEY);
if(all&&!dry)writeState(RULE_TEXTS_ALL_KEY,null);
const say=(...a)=>console.log(new Date().toISOString().slice(0,19).replace('T',' '),...a);
const summaryFile=path.join(os.tmpdir(),`rule-texts-step-${process.pid}.json`);
const steps=[],failed=[];
let child=null,stopped=false;
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{if(stopped)process.exit(130);stopped=true;say('angehalten, laufender Schritt wird beendet');try{child?.kill('SIGTERM');}catch{/* schon weg */}});

/* fatal:false (Zählschritte nach dem Kern): ein Fehler wird vermerkt (warnings), beendet den Lauf aber nicht mit Exit 1; sonst
   liefe um 08:50 der Rückfall-Lauf der Tagespipeline, obwohl Regeln, Suche und Zahlen fertig sind (Befund 16.10.2026) */
const warnings=[];
async function step(name,script,stepArgs=[],{fatal=true}={}){
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
 steps.push({name,seconds,ok,fatal,summary:summary||(stopped?{stopped:true}:null)});
 if(!ok)(fatal?failed:warnings).push(name);
 say(`${name} ${stopped?'angehalten':ok?'fertig':`FEHLER (${status})${fatal?'':', nicht fatal'}`} (${seconds} s)`);
 return summary;
}

if(all)say('Alle neu erstellen');
/* Schritt 0 (Betriebsplan 15.10.2026): Titelregel für neue und veraltete Berichte (classification, Label der Suche). Der
   Nachtimport ordnet nicht ein; ohne diesen Schritt hatten neue Berichte bis zum nächsten Handstart kein Label. */
await step(stepName('title'),'scripts/reclassify-rules.mjs',[]);
await step(stepName('rules'),'scripts/pdf-store/read-reports.mjs',all?['--all']:[]);
/* Stand der Fakten für den Reiter (einmal je Lauf gezählt, damit die Seite beim Öffnen nichts rechnet): Berichte mit Fakten,
   davon aus dem Text des Hauptdokuments, in der aktuellen Fassung der Regeln */
let facts=null;
if(!dry)try{
 const db=new DatabaseSync(databaseFile());
 try{facts={version:FACTS_VERSION,...db.prepare("SELECT count(DISTINCT topic_id) reports,count(DISTINCT CASE WHEN method LIKE '%:text' THEN topic_id END) fromText,count(DISTINCT CASE WHEN method NOT LIKE ?||':%' THEN topic_id END) stale FROM topic_facts").get(FACTS_VERSION)};}
 finally{db.close();}
}catch(e){say('Fakten zählen:',e.message);}
if(!dry){
 if(all)await step(stepName('search'),'scripts/refresh-search-words.mjs',['--quiet','--full']);
 else await step(stepName('search'),'scripts/refresh-search-words.mjs',['--quiet']);
}else await step(stepName('search'),'scripts/refresh-search-words.mjs',all?['--quiet','--full']:['--quiet']);
await step(stepName('xcases'),'scripts/plenara-x/build-x-cases.mjs',dry?['--dry-run']:[]);
/* KI-Zähler (system_state 'ai-counts', Reiter „Pipeline-Debug“ und KI-Fenster): Stand der KI-Arbeit je Zustand, abgeschlossene
   KI-Fassungen, deren Bericht seitdem neu gelesen wurde (neuer Text, etwa nach OCR: beim nächsten ai_list „Veraltet“), und Berichte
   mit Regel-Zusammenfassung ohne KI-Fassung. Nur Zählungen über schmale Tabellen, keine Payloads. */
if(!dry)try{
 const db=new DatabaseSync(databaseFile());db.exec('PRAGMA busy_timeout=30000');
 try{
  const has=t=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
  if(has('ai_work_items')&&has('report_rules')){
   const states=Object.fromEntries(db.prepare('SELECT state,count(*) n FROM ai_work_items GROUP BY state').all().map(r=>[r.state,r.n]));
   const newText=db.prepare("SELECT count(*) n FROM ai_work_items w JOIN report_rules r ON r.topic_id=w.topic_id WHERE w.state='completed' AND r.read_at>w.updated_at").get().n;
   const withoutAi=db.prepare("SELECT count(*) n FROM report_rules r WHERE r.summary_issue IS NULL AND NOT EXISTS(SELECT 1 FROM ai_work_items w WHERE w.topic_id=r.topic_id AND w.state='completed')").get().n;
   writeState('ai-counts',{at:new Date().toISOString(),states,newText,withoutAi});
   say(`KI-Zähler: ${JSON.stringify(states)}, ${newText} mit neuem Text seit der KI-Fassung, ${withoutAi} mit Regel-Zusammenfassung ohne KI-Fassung`);
  }
 }finally{db.close();}
}catch(e){say('KI-Zähler:',e.message);}
/* Weg der Berichte für die Debug-Seite (scripts/pipeline-trace.mjs, vorübergehend) */
await step(stepName('trace'),'scripts/pipeline-trace.mjs',dry?['--dry-run']:[],{fatal:false});

const result=stopped?'stopped':failed.length?'failed':'done';
if(!dry)writeState(RULE_TEXTS_KEY,{startedAt:new Date(t0).toISOString(),finishedAt:new Date().toISOString(),result,all,steps,facts,...(warnings.length?{warnings}:{})});
say(`Ende nach ${Math.round((Date.now()-t0)/1000)} s${failed.length?`, Fehler in: ${failed.join(', ')}`:''}${warnings.length?`, nicht fatal: ${warnings.join(', ')}`:''}`);
process.exit(stopped?3:failed.length?1:0);
