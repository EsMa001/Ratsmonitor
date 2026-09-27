import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {DatabaseSync} from 'node:sqlite';
import {TRANSFER_FORMAT,TRANSFER_TABLES,INITIALIZATION_KEYS,hashText} from '../shared/database-transfer.mjs';

export async function restoreData(db,file,{replace=false}={}){
 // Caller creates a separate backup before opting into replacement.
 for(const [table,columns] of Object.entries(TRANSFER_TABLES)){
  const actual=db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name);
  if(columns.some(c=>!actual.includes(c)))throw Error('Datenbankschema fehlt. Zuerst die lokalen Migrationen anwenden.');
  if(!replace&&db.prepare(`SELECT count(*) n FROM ${table}`).get().n)throw Error('Die lokale Datenbank enthält bereits Artikel. Keine Daten geändert. Für einen bewussten Ersatz --replace verwenden.');
 }
 const stream=fs.createReadStream(file),input=file.endsWith('.gz')?stream.pipe(createGunzip()):stream;
 if(input!==stream)stream.on('error',e=>input.destroy(e));
 const reader=createInterface({input,crlfDelay:Infinity});
 let manifest=null;const counts=Object.fromEntries(Object.keys(TRANSFER_TABLES).map(t=>[t,0])),last={};
 const statements=Object.fromEntries(Object.entries(TRANSFER_TABLES).map(([t,cs])=>[t,db.prepare(`INSERT INTO ${t}(${cs.join(',')}) VALUES(${cs.map(()=>'?').join(',')})`)]));
 db.exec('BEGIN IMMEDIATE');
 try{
  if(replace)for(const t of Object.keys(TRANSFER_TABLES))db.exec(`DELETE FROM ${t}`);
  for await(const line of reader){
   if(!line.trim())continue;const record=JSON.parse(line);
   if(!manifest){
    manifest=record.manifest;
    if(manifest?.format!==TRANSFER_FORMAT||!Number.isSafeInteger(manifest.revision)||!Array.isArray(manifest.tables)||JSON.stringify(manifest.tables.map(t=>[t.name,t.columns]))!==JSON.stringify(Object.entries(TRANSFER_TABLES))||manifest.tables.some(t=>!Number.isSafeInteger(t.count)||t.count<0))throw Error('Ungültiges Exportmanifest');
    if(!Array.isArray(manifest.initialization)||manifest.initialization.some(m=>!INITIALIZATION_KEYS.includes(m.key)||typeof m.value!=='string'))throw Error('Unzulässige Initialisierungsdaten');
    continue;
   }
   const columns=TRANSFER_TABLES[record.table];
   if(!Object.hasOwn(TRANSFER_TABLES,record.table)||record.format!==TRANSFER_FORMAT||record.revision!==manifest.revision||!Array.isArray(record.rows)||record.rows.length===0||await hashText(JSON.stringify(record.rows))!==record.sha256)throw Error('Prüfsumme oder Datenformat stimmt nicht');
   for(const row of record.rows){
    if(Object.keys(row).length!==columns.length||columns.some(c=>!Object.hasOwn(row,c)||typeof row[c]!=='string')||!row[columns[0]]||row[columns[0]]<=(last[record.table]||''))throw Error('Unzulässiger oder doppelter Datensatz');
    const payload=JSON.parse(row.payload);if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Ungültiger Artikelinhalt');
    statements[record.table].run(...columns.map(c=>row[c]));last[record.table]=row[columns[0]];counts[record.table]++;
   }
   if(record.next!==last[record.table])throw Error('Ungültige Seitenfolge');
  }
  if(!manifest||manifest.tables.some(t=>counts[t.name]!==t.count||db.prepare(`SELECT count(*) n FROM ${t.name}`).get().n!==t.count))throw Error('Export ist unvollständig. Anzahl stimmt nicht.');
  // These three flags avoid reapplying the bundled seed over an imported live copy.
  for(const key of INITIALIZATION_KEYS)db.prepare('DELETE FROM system_state WHERE key=?').run(key);
  for(const m of manifest.initialization)db.prepare('INSERT INTO system_state(key,value) VALUES(?,?)').run(m.key,m.value);
  db.prepare("INSERT INTO system_state(key,value) VALUES('last-data-restore',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify({at:new Date().toISOString(),sourceCreatedAt:manifest.createdAt,sourceRevision:manifest.revision,localRevision:Number(db.prepare("SELECT coalesce((SELECT revision FROM data_revisions WHERE id='content'),0) AS revision").get().revision),counts}));
  db.exec('COMMIT');return {counts,sourceCreatedAt:manifest.createdAt,sourceRevision:manifest.revision};
 }catch(error){db.exec('ROLLBACK');throw error;}finally{reader.close();input.destroy();stream.destroy();}
}
function findDatabase(dir){
 if(!fs.existsSync(dir))throw Error('Lokale D1-Datenbank fehlt. Zuerst Migrationen anwenden.');
 const files=fs.readdirSync(dir,{recursive:true}).filter(f=>String(f).endsWith('.sqlite')).map(f=>path.join(dir,String(f)));
 const matches=files.filter(f=>{let db;try{db=new DatabaseSync(f,{readOnly:true});return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='article_analyses'").get();}catch{return false;}finally{db?.close();}});
 if(matches.length!==1)throw Error('Es muss genau eine lokale Ratsmonitor-Datenbank vorhanden sein; gefunden: '+matches.length);
 return matches[0];
}
async function main(){
 const args=process.argv.slice(2);if(args.length<1||args.length>2||args[1]&&args[1]!=='--replace')throw Error('Aufruf: node scripts/database-restore.mjs <Export.jsonl.gz> [--replace]');
 const root=fileURLToPath(new URL('../',import.meta.url)),file=path.resolve(args[0]);if(!fs.existsSync(file))throw Error('Exportdatei nicht gefunden: '+file);
 const database=findDatabase(path.join(root,'.wrangler','state','v3','d1')),db=new DatabaseSync(database);
 try{
  db.exec('PRAGMA busy_timeout=1000');
  if(args.includes('--replace')){
   const backup=path.join(root,'.local-backups','before-restore-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite');fs.mkdirSync(path.dirname(backup),{recursive:true});db.prepare('VACUUM INTO ?').run(backup);console.log('Vorherigen Stand gesichert: '+backup);
  }
  const result=await restoreData(db,file,{replace:args.includes('--replace')});console.log('Datenübernahme geprüft und abgeschlossen.');for(const [table,count] of Object.entries(result.counts))console.log(table+': '+count);console.log('Online-Stand: '+result.sourceCreatedAt+' · Revision '+result.sourceRevision);console.log('Anmeldung und lokaler Adminzugang bleiben erhalten. Das ist kein Nachweis vollständiger KI-Inhalte.');
 }finally{db.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
