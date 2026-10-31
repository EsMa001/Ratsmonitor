// Speicher und Sicherungen für den Admin-Reiter „Speicher & Sicherungen“ (server/integrations/server-storage.mjs): was auf der
// Festplatte wie viel Platz belegt (Datenbank mit Nebendateien, PDF-Ablage, Sicherungen, Programmstände, OCR-Werkzeuge,
// Rest), welche Sicherungen es gibt, und mit --tables die größten Tabellen der Datenbank (dbstat; liest die ganze Datenbank,
// deshalb nur einmal am Tag). Schreibt nach system_state ('server-disk'); ohne --tables bleiben die letzten Tabellenzahlen.
// Auf dem Server ruft job.mjs das höchstens stündlich auf (Timer der PDF-Aufträge) und auf Wunsch („Neu messen“).
//
//   node scripts/server-disk.mjs [--tables] [--print]
// Pfade: DATABASE_FILE (Datenbank; ihr Ordner und dessen Elternordner sind die Grundlage), BACKUP_DIR (Standard
// <Grundordner>/backups), RM_PDF_STORE, OCR_TOOLS, OCR_CACHE; Programmstände: der Ordner releases/ über dem Arbeitsordner.
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {DEFAULT_PDF_STORE} from '../server/node/pdf-store.mjs';
import {indexBytes as docIndexBytes} from '../server/node/doc-index.mjs';
import {DISK_KEY} from '../server/integrations/server-storage.mjs';
import {STATS_KEY} from '../server/integrations/pdf-store-admin.mjs';
import {databaseFile} from './pdf-store/state.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n);
const file=databaseFile();
if(!file){console.error('Keine Datenbank (DATABASE_FILE oder .wrangler/).');process.exit(1);}
const t0=Date.now(),abs=path.resolve(file),dataDir=path.dirname(abs),base=path.dirname(dataDir);

/* Belegter Platz auf der Platte (Blöcke, nicht Dateigröße), rekursiv; Verweise werden nicht verfolgt */
function du(p){
 let bytes=0,files=0;
 const walk=q=>{let st;try{st=fs.lstatSync(q);}catch{return;}
  bytes+=st.blocks!=null?st.blocks*512:st.size;
  if(st.isDirectory()){let names=[];try{names=fs.readdirSync(q);}catch{return;}for(const n of names)walk(path.join(q,n));}else files++;};
 walk(p);return {bytes,files};
}
const size=p=>{try{const st=fs.statSync(p);return st.blocks!=null?st.blocks*512:st.size;}catch{return 0;}};
const mtime=p=>{try{return fs.statSync(p).mtime.toISOString();}catch{return null;}};

/* Platte */
let disk=null;try{const s=fs.statfsSync(dataDir);disk={total:s.blocks*s.bsize,free:s.bavail*s.bsize,used:(s.blocks-s.bfree)*s.bsize};}catch{/* nicht ermittelbar */}

/* Datenbank: Hauptdatei, WAL, SHM und übrig gebliebene Nebendateien gleichen Namens */
const dbName=path.basename(abs);
const dbFiles=fs.readdirSync(dataDir).filter(n=>n.startsWith(dbName)).map(n=>({name:n,bytes:size(path.join(dataDir,n)),
 kind:n===dbName?'Datenbank':n===dbName+'-wal'?'Schreibprotokoll (WAL)':n===dbName+'-shm'?'Gemeinsamer Speicher (SHM)':'Übrig geblieben'})).sort((a,b)=>b.bytes-a.bytes);

/* PDF-Ablage: Aufteilung aus dem letzten Stand (stats.mjs), Index gemessen; der ganze Ordner gemessen wäre zu langsam */
const storeDir=path.resolve(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
const db=new DatabaseSync(abs);db.exec('PRAGMA busy_timeout=30000');
const read=key=>{try{const r=db.prepare('SELECT value FROM system_state WHERE key=?').get(key);return r?JSON.parse(r.value):null;}catch{return null;}};
const ps=read(STATS_KEY),indexBytes=['index.sqlite','index.sqlite-wal','index.sqlite-shm'].reduce((a,n)=>a+size(path.join(storeDir,n)),0);
/* Dokumentindex der Dokumentsuche (fts.sqlite, ein angefangener Neubau): abgeleitet, nicht in der Sicherung (backup.sh) */
const docIndex=docIndexBytes(storeDir);
const pdfStore=fs.existsSync(storeDir)?{dir:storeDir,pdfPrimary:ps?.bytes?.pdfPrimary??ps?.bytes?.pdf??null,pdfOthers:ps?.bytes?.pdfOthers??0,text:ps?.bytes?.text??null,index:indexBytes,docIndex,
 at:ps?.at||null,budgetGb:ps?.budgetGb??null}:null;
if(pdfStore)pdfStore.bytes=(pdfStore.pdfPrimary||0)+(pdfStore.pdfOthers||0)+(pdfStore.text||0)+indexBytes+docIndex;

/* Sicherungen: Datenbankkopien (backup.sh) und Sicherungen der Einstellungsdatei (nur Name und Größe, nie der Inhalt) */
const backupDir=path.resolve(process.env.BACKUP_DIR||path.join(base,'backups'));
let backups=[];try{backups=fs.readdirSync(backupDir).map(n=>({name:n,bytes:size(path.join(backupDir,n)),at:mtime(path.join(backupDir,n)),
 kind:/\.sqlite(\.zst)?\.part$/.test(n)?'Unfertige Kopie':/\.sqlite\.zst$/.test(n)?'Datenbank':/\.sqlite$/.test(n)?'Datenbank, ungepackt':'Sonstiges'})).sort((a,b)=>(b.at||'').localeCompare(a.at||''));}catch{/* kein Ordner */}
let envBackups=[];try{envBackups=fs.readdirSync(base).filter(n=>/\.env\.bak/.test(n)).map(n=>({name:n,bytes:size(path.join(base,n)),at:mtime(path.join(base,n))}));}catch{/* nichts */}

/* Programmstände: releases/ über dem Arbeitsordner (auf dem Server app/current → app/releases/<Stand>) */
let releases=[];
try{
 const cur=fs.realpathSync(process.cwd()),dir=path.dirname(cur);
 if(path.basename(dir)==='releases')releases=fs.readdirSync(dir).map(n=>{const p=path.join(dir,n),d=du(p);return {name:n,bytes:d.bytes,files:d.files,at:mtime(p),current:p===cur};}).sort((a,b)=>(b.at||'').localeCompare(a.at||''));
}catch{/* lokal: kein releases/ */}

/* OCR-Werkzeuge und Sprachdaten */
const ocr=[[process.env.OCR_TOOLS,'OCR-Werkzeuge'],[process.env.OCR_CACHE,'OCR-Sprachdaten']].filter(([p])=>p&&fs.existsSync(p)).map(([p,label])=>({label,dir:p,...du(p)}));

/* Tabellen der Datenbank (dbstat): je Tabelle mit ihren Indizes; nur mit --tables, sonst die vom letzten Mal */
const old=read(DISK_KEY);
let tables=old?.tables||null;
if(flag('tables')){
 const t=Date.now(),owner=new Map(db.prepare("SELECT name,tbl_name FROM sqlite_schema WHERE type IN ('table','index')").all().map(r=>[r.name,r.tbl_name]));
 const by=new Map();
 for(const r of db.prepare('SELECT name,SUM(pgsize) AS bytes FROM dbstat GROUP BY name').iterate()){const k=owner.get(r.name)||r.name;by.set(k,(by.get(k)||0)+Number(r.bytes));}
 const free=db.prepare('PRAGMA freelist_count').get().freelist_count*db.prepare('PRAGMA page_size').get().page_size;
 tables={at:new Date().toISOString(),seconds:Math.round((Date.now()-t)/1000),free,list:[...by].sort((a,b)=>b[1]-a[1]).map(([name,bytes])=>({name,bytes}))};
}

const sum=a=>a.reduce((x,y)=>x+(y.bytes||0),0);
const parts={database:sum(dbFiles),pdfStore:pdfStore?.bytes||0,backups:sum(backups)+sum(envBackups),releases:sum(releases),ocr:sum(ocr)};
const known=Object.values(parts).reduce((a,b)=>a+b,0);
const out={at:new Date().toISOString(),seconds:Math.round((Date.now()-t0)/1000),disk,parts:{...parts,other:disk?Math.max(0,disk.used-known):null},
 database:{files:dbFiles},pdfStore,backups:{dir:backupDir,list:backups,env:envBackups},releases,ocr,tables};
db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(DISK_KEY,JSON.stringify(out));
db.close();
const gb=b=>(b/1073741824).toFixed(1)+' GB';
if(flag('print'))console.log(JSON.stringify(out,null,1));
else console.log(`Platte ${disk?gb(disk.used)+' von '+gb(disk.total)+', frei '+gb(disk.free):'?'}; Datenbank ${gb(parts.database)}, Ablage ${gb(parts.pdfStore)}, Sicherungen ${gb(parts.backups)} (${backups.length}), Programmstände ${gb(parts.releases)} (${releases.length}), OCR ${gb(parts.ocr)}${tables?`, Tabellen vom ${tables.at.slice(0,10)}`:''} (${out.seconds} s)`);
