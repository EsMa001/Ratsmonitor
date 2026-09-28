import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {articleResult} from '../shared/ai-job.mjs';
import {applyAiResults,getAiJob} from '../server/integrations/ai-jobs.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
function findDatabase(){
 const dir=path.join(root,'.wrangler','state','v3','d1');if(!fs.existsSync(dir))throw Error('Lokale D1-Datenbank fehlt.');
 const matches=fs.readdirSync(dir,{recursive:true}).filter(p=>String(p).endsWith('.sqlite')).map(p=>path.join(dir,String(p))).filter(p=>{let db;try{db=new DatabaseSync(p,{readOnly:true});return ['topics','article_analyses','data_revisions'].every(name=>db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));}catch{return false;}finally{db?.close();}});
 if(matches.length!==1)throw Error('Keine eindeutige Ratsmonitor-Datenbank gefunden: '+matches.length);return matches[0];
}
export function sqliteAdapter(sql){
 return {
  prepare(query){
   let args=[];
   return {
    bind(...values){args=values;return this;},
    async first(){return sql.prepare(query).get(...args)||null;},
    async all(){return {results:sql.prepare(query).all(...args)};},
    async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};},
    execute(){const statement=sql.prepare(query);return statement.columns().length?{results:statement.all(...args)}:{meta:{changes:Number(statement.run(...args).changes)}};}
   };
  },
  async batch(statements){sql.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>s.execute());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}
 };
}
export async function main(){
 const [action,jobFile,resultFile,...rest]=process.argv.slice(2);if(!['validate','apply'].includes(action)||!jobFile||!resultFile||rest.length)throw Error('Aufruf: node scripts/ai-job.mjs validate|apply <Auftrag.json> <Ergebnisse.json>');
 const job=JSON.parse(fs.readFileSync(jobFile,'utf8')),output=JSON.parse(fs.readFileSync(resultFile,'utf8'));
 if(job.format!=='ratsmonitor-ai-job-v1'||output.format!=='ratsmonitor-ai-results-v1'||job.id!==output.jobId||!Array.isArray(output.articles)||!output.articles.length||new Set(output.articles.map(a=>a.id)).size!==output.articles.length)throw Error('Ungültiger Auftrag oder Ergebnisdatei.');
 for(const result of output.articles){const article=job.articles.find(a=>a.id===result.id);if(!article)throw Error('Artikel außerhalb des Auftrags.');await articleResult(job,article,result);}
 console.log(output.articles.length+' Artikel strukturell geprüft. Keine unabhängige Inhaltsfreigabe.');if(action==='validate')return;
 const filename=findDatabase(),sql=new DatabaseSync(filename);sql.exec('PRAGMA busy_timeout=1000');
 try{
  const db=sqliteAdapter(sql),registered=await getAiJob(db);if(!registered||registered.id!==job.id)throw Error('Dieser Auftrag wurde nicht in der lokalen Adminseite vorbereitet. Für lokale Verarbeitung dort einen Auftrag erstellen.');
  const backup=path.join(root,'.local-backups','before-ai-'+Date.now()+'.sqlite');fs.mkdirSync(path.dirname(backup),{recursive:true});sql.prepare('VACUUM INTO ?').run(backup);
  const receipt=await applyAiResults(db,registered,output);sql.close();
  const verify=new DatabaseSync(filename,{readOnly:true});try{if(verify.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('Datenbankprüfung fehlgeschlagen.');const saved=JSON.parse(verify.prepare("SELECT value FROM system_state WHERE key='last-ai-apply'").get().value);if(saved.jobId!==job.id||saved.at!==receipt.at)throw Error('Speichernachweis nicht bestätigt.');}finally{verify.close();}
  console.log(JSON.stringify({...receipt,backup,reopenedAndVerified:true},null,2));
 }finally{try{sql.close();}catch{}}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
