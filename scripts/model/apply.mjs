// Schritt „Modell anwenden“ im Job „Themen & Texte“ (scripts/rule-texts.mjs), vor den Regeln: ordnet jeden Bericht mit dem Modell
// ein (requirements/modell-konzept.md, neun Fragen im Begriffsbuch) und schreibt die Antworten nach model_labels (Migration 0046).
// Nur Berichte, deren Eingaben sich geändert haben oder deren Modellfassung alt ist. Einbettungen werden je Text (Prüfsumme) in
// einer eigenen Datei gespeichert (RM_MODEL_STORE, nicht die Hauptdatenbank, nicht in Export oder Sicherung der Daten): gleiche
// Texte rechnet der Encoder nur einmal, und neue Köpfe brauchen kein neues Einbetten.
//
//   node scripts/model/apply.mjs [--dry-run] [--all] [--limit N] [--ids datei] [--measure N]
//   --measure N: nur N Berichte einbetten und die Zeit je Text melden, nichts schreiben (Messung vor dem ersten Durchlauf)
// Umgebung: DATABASE_FILE, RM_PDF_STORE, RM_MODEL_DIR (Encoder und Köpfe), MODEL_TOOLS (transformers.js), RM_MODEL_STORE,
// MODEL_THREADS (Kerne für den Encoder, Standard 2).
// Status: ist das Modell sicher (ab 0,7), schreibt es seinen Status in den Bericht (topics.status), damit Suche, Artikelseite und
// plenara.X denselben zeigen (die Trigger der Suchkarten ziehen nach); sonst bleibt der des Imports. Setzt ein Import ihn zurück,
// schreibt ihn der nächste Lauf wieder (am Ende jedes Laufs für alle Berichte, ohne neu einzuordnen).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {inputOf,encoderTexts,flat,INPUT_VERSION} from '../../shared/model/features.mjs';
import {classify,SURE} from '../../shared/model/heads.mjs';
import {manifest,modelVersion,checkFiles,readHeads,loadEncoder} from '../../server/model/model-files.mjs';
import {databaseFile,stepSummary} from '../pdf-store/state.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const dry=flag('dry-run'),all=flag('all'),limit=Number(opt('limit',0)),measure=Number(opt('measure',0));
const onlyIds=opt('ids')?new Set(fs.readFileSync(opt('ids'),'utf8').split(/\s+/).filter(Boolean)):null;
const today=new Date().toISOString().slice(0,10),t0=Date.now();
const say=(...a)=>console.log(...a);

const m=manifest(),version=modelVersion(m),bad=checkFiles(m);
if(bad.length){console.error('Modelldateien passen nicht zum Manifest (shared/model-manifest.json):\n '+bad.join('\n '));process.exit(1);}
const db=new DatabaseSync(databaseFile());db.exec('PRAGMA busy_timeout=60000');
if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='model_labels'").get()&&!measure){console.error('Tabelle model_labels fehlt: erst Migration 0046 einspielen (scripts/node-migrate.mjs).');process.exit(1);}
const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);

// Einbettungen je Text: 8 Bit mit Maßstab je Vektor (384 + 4 Byte)
const embFile=process.env.RM_MODEL_STORE||'tmp/model-store.sqlite';fs.mkdirSync(path.dirname(path.resolve(embFile)),{recursive:true});
const edb=new DatabaseSync(embFile);edb.exec('PRAGMA journal_mode=WAL;PRAGMA busy_timeout=60000;CREATE TABLE IF NOT EXISTS emb(h TEXT PRIMARY KEY,v BLOB NOT NULL)');
const eGet=edb.prepare('SELECT v FROM emb WHERE h=?'),ePut=edb.prepare('INSERT OR REPLACE INTO emb(h,v) VALUES(?,?)');
const pack=v=>{let s=0;for(const x of v)s=Math.max(s,Math.abs(x));s=s||1;const b=Buffer.alloc(4+v.length);b.writeFloatLE(s,0);for(let i=0;i<v.length;i++)b.writeInt8(Math.round(v[i]/s*127),4+i);return b;};
// node:sqlite liefert BLOBs als Uint8Array
const unpack=u=>{const b=Buffer.from(u.buffer,u.byteOffset,u.byteLength),s=b.readFloatLE(0),v=new Float32Array(b.length-4);for(let i=0;i<v.length;i++)v[i]=b.readInt8(4+i)*s/127;return v;};
const textHash=t=>crypto.createHash('sha256').update(m.encoder.version+'\u0001'+t).digest('hex').slice(0,32);

// Schlüssel je Bericht ohne die Texte zu lesen: alles, wovon die Eingabe abhängt, und welche Sitzungen noch bevorstehen
const keyOf=(p,docs,ev)=>crypto.createHash('sha256').update(JSON.stringify([version,INPUT_VERSION,flat(p.title),flat(p.committee),p.eventDate&&p.eventDate>today,
 ev.map(e=>[e.date&&e.date>today,flat(e.result||e.decision?.text||e.description)]),
 docs.filter(d=>d?.kind==='application/pdf').map(d=>[d.url,flat(d.title),store.entry(d.url)?.bytes??null,store.textMark(d.url)])])).digest('hex').slice(0,24);
const have=all||measure?new Map():new Map(db.prepare('SELECT topic_id,model,key FROM model_labels').all().map(r=>[r.topic_id,r.model+'|'+r.key]));
const todo=[];let total=0;
for(const r of db.prepare("SELECT id,json_extract(payload,'$.title') title,json_extract(payload,'$.committee') committee,json_extract(payload,'$.eventDate') eventDate,json_extract(payload,'$.events') events,json_extract(payload,'$.documents') docs FROM topics WHERE active=1").iterate()){
 if(onlyIds&&!onlyIds.has(r.id))continue;total++;
 let docs=[],ev=[];try{docs=JSON.parse(r.docs||'[]');}catch{/* ohne */}try{ev=JSON.parse(r.events||'[]');}catch{/* ohne */}
 const key=keyOf(r,docs,ev);
 if(onlyIds||have.get(r.id)!==version+'|'+key)todo.push([r.id,key]);
 if((limit&&todo.length>=limit)||(measure&&todo.length>=measure))break;
}
have.clear();
say(`${total} Berichte, ${todo.length} einzuordnen (${version}, ${((Date.now()-t0)/1000).toFixed(0)} s)`);
if(dry){stepSummary({dry:true,total,todo:todo.length,version});process.exit(0);}

const heads=readHeads(),threads=Number(process.env.MODEL_THREADS||2),encode=await loadEncoder({threads});
const getTopic=db.prepare('SELECT payload FROM topics WHERE id=?');
const put=db.prepare(`INSERT OR REPLACE INTO model_labels(topic_id,model,key,kind,kind_p,status,status_p,themes,theme_p,subs,subsubs,process,process_p,project,step,service,applicants,main_url,result_url,doctypes,at)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
// Dokumentart des Modells in die PDF-Ablage (Rang der Dateien): Wörter der Ablage
const STORE_TYPE={paper:'paper',bundle:'paper',attachment:'attachment',result:'decision',minutes:'minutes',session:'invitation',other:'other'};
const stats={storeTypes:0,statusSet:0,done:0,embedded:0,reused:0,kind:{},sure:{kind:0,status:0,process:0},subject:0,theme:0,embedMs:0};
let stopped=false;for(const s of ['SIGTERM','SIGINT'])process.on(s,()=>{stopped=true;});
const BATCH=64;
for(let o=0;o<todo.length&&!stopped;o+=BATCH){
 const part=todo.slice(o,o+BATCH),items=[];
 for(const [id,key] of part){let p={};try{p=JSON.parse(getTopic.get(id)?.payload||'{}');}catch{/* leer */}
  const input=inputOf(p,u=>store.entry(u),u=>store.getText(u)?.pages||null),texts=encoderTexts(input).map(([k,t])=>({k,t,h:textHash(t)}));items.push({id,key,input,texts});}
 // fehlende Einbettungen in Paketen rechnen
 const need=new Map();for(const it of items)for(const x of it.texts)if(!need.has(x.h)){const row=measure?null:eGet.get(x.h);if(row)x.v=unpack(row.v);else need.set(x.h,x.t);}
 const hs=[...need.keys()],te=Date.now(),got=new Map();
 for(let i=0;i<hs.length;i+=16){const vs=await encode(hs.slice(i,i+16).map(h=>need.get(h)));vs.forEach((v,j)=>got.set(hs[i+j],v));}
 stats.embedMs+=Date.now()-te;stats.embedded+=hs.length;
 if(measure)continue;
 db.exec('BEGIN');edb.exec('BEGIN');store.db.exec('BEGIN');
 try{
  for(const [h,v] of got)ePut.run(h,pack(v));
  for(const it of items){const E=new Map();for(const x of it.texts){E.set(x.k,x.v||got.get(x.h));if(x.v)stats.reused++;}
   const out=classify(it.input,k=>E.get(k)||null,heads,today),url=i=>i==null?null:it.input.pdfs.find(p=>p.i===i)?.url||null;
   put.run(it.id,version,it.key,out.kind,out.kindP,out.status,out.statusP,JSON.stringify(out.themes),out.themeP,JSON.stringify(out.subs),JSON.stringify(out.subsubs),
    out.process,out.processP,out.project==null?null:Number(out.project),out.step,out.service,JSON.stringify(out.applicants),url(out.main),url(out.result),JSON.stringify(out.doctypes),new Date().toISOString());
   out.doctypes.forEach((t,j)=>{const u=it.input.pdfs[j]?.url;if(u&&store.setModel(u,STORE_TYPE[t]||'other',out.kind!=='subject'))stats.storeTypes++;});
   stats.done++;stats.kind[out.kind]=(stats.kind[out.kind]||0)+1;
   if(out.kindP>=0.7)stats.sure.kind++;if(out.statusP>=0.7)stats.sure.status++;
   if(out.kind==='subject'){stats.subject++;if(out.themes.length)stats.theme++;if(out.processP>=0.7)stats.sure.process++;}
  }
  db.exec('COMMIT');edb.exec('COMMIT');store.db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');edb.exec('ROLLBACK');store.db.exec('ROLLBACK');throw e;}
 if((o/BATCH)%20===0)say(`${Math.min(o+BATCH,todo.length)} / ${todo.length}, ${stats.embedded} Texte eingebettet (${(stats.embedMs/Math.max(1,stats.embedded)).toFixed(0)} ms je Text), ${((Date.now()-t0)/1000).toFixed(0)} s`);
}
// Sicherer Status des Modells in den Bericht (auch nach einem Import, der ihn zurückgesetzt hat), in Stücken
if(!measure&&!stopped){const ids=db.prepare(`SELECT m.topic_id id,m.status FROM model_labels m JOIN topics t ON t.id=m.topic_id WHERE m.model=? AND m.status_p>=? AND t.status IS NOT m.status`).all(version,SURE);
 const set=db.prepare('UPDATE topics SET status=? WHERE id=?');
 for(let i=0;i<ids.length;i+=500){db.exec('BEGIN IMMEDIATE');try{for(const r of ids.slice(i,i+500))stats.statusSet+=set.run(r.status,r.id).changes;db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
 if(stats.statusSet)say(`Status aus dem Modell in ${stats.statusSet} Berichten`);}
const perText=stats.embedded?Math.round(stats.embedMs/stats.embedded):null;
if(measure){await encode.dispose();say(`Messung: ${stats.embedded} Texte aus ${todo.length} Berichten in ${(stats.embedMs/1000).toFixed(0)} s, ${perText} ms je Text, ${(stats.embedded/Math.max(1,todo.length)).toFixed(2)} Texte je Bericht, ${threads} Kerne`);process.exitCode=0;}
else{
const summary={version,total,statusSet:stats.statusSet,storeTypes:stats.storeTypes,todo:todo.length,done:stats.done,stopped,embedded:stats.embedded,reused:stats.reused,msPerText:perText,kind:stats.kind,subject:stats.subject,
 withTheme:stats.theme,sure:stats.sure,seconds:Math.round((Date.now()-t0)/1000)};
stepSummary(summary);say(JSON.stringify(summary));
await encode.dispose();
process.exitCode=stopped?3:0;
}
