// Fehlerspeicher für die Skripte der PDF-Ablage (server/integrations/work-failures.mjs, Migration 0040): eine eigene, schreibende
// Verbindung zur Hauptdatenbank (die Skripte lesen sie sonst nur), Serverstufen für die Abrufer und der einmalige Übertrag der
// alten Fehler der Ablage (pdfs.status error/unsupported, ocr_refetch, ocr_slow, statische Serversperre). Ohne Migration 0040
// oder ohne Datenbank liefert open() null; die Skripte arbeiten dann wie früher.
import {existsSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../ai-job.mjs';
import {inDailyRange,hasFailureStore,recordFailure,clearFailure,hostStates,hostWaiting,hostDue,hostOk,classify,nextTry,SAMPLE} from '../../server/integrations/work-failures.mjs';
// Alte Serversperre (wie BLOCK_MIN, BLOCK_SHARE in store-lib.mjs; hier eigen, damit Testattrappen von store-lib genügen)
const BLOCK_MIN=10,BLOCK_SHARE=0.9;

/* Hauptdatenbank wie databaseFile in state.mjs (hier eigen, damit Testattrappen von state.mjs genügen) */
function databaseFile(){
 if(process.env.DATABASE_FILE)return process.env.DATABASE_FILE;
 const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
 const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
 return local?dir+local:null;
}
/** Herkunft eines Eintrags: Tagesbereich (Sitzung höchstens 7 Tage zurück, frühestens 12.10.2026) oder Altbestand (inDailyRange) */
export const originOf=(eventDate,now=Date.now())=>inDailyRange(eventDate,null,now)?'daily':'backlog';

/**
 * Verbindung zum Fehlerspeicher oder null. Rückgabe {db, sql, hosts (Map nicht-ok), waiting(host), due(host), fail(f), ok(f),
 * known(step) → Set der Schlüssel mit Eintrag, close()}. fail/ok fangen Fehler ab (der Speicher ist Beiwerk des Abrufs).
 */
export async function openFailures({file=databaseFile()}={}){
 if(!file||!existsSync(file))return null;
 let sql;
 try{sql=new DatabaseSync(file);sql.exec('PRAGMA busy_timeout=30000');}catch{return null;}
 const db=sqliteAdapter(sql);
 if(!await hasFailureStore(db)){sql.close();return null;}
 let hosts=await hostStates(db);
 const counts={recorded:0,cleared:0,errors:0};
 const self={
  db,sql,counts,
  get hosts(){return hosts;},
  refresh:async()=>{hosts=await hostStates(db);},
  waiting:(host,now=Date.now())=>hostWaiting(hosts.get(host),now),
  due:(host,now=Date.now())=>hostDue(hosts.get(host),now),
  async fail(f){try{const r=await recordFailure(db,f);counts.recorded++;if(f.host){const row=await db.prepare('SELECT * FROM source_hosts WHERE host=?').bind(f.host).first();if(row&&row.state!=='ok')hosts.set(f.host,row);}return r;}catch(e){counts.errors++;return null;}},
  async ok(f){try{await clearFailure(db,f);counts.cleared++;if(f.host)hosts.delete(f.host);}catch{counts.errors++;}},
  async hostOk(host){try{await hostOk(db,host);hosts.delete(host);}catch{counts.errors++;}},
  known:step=>new Set(sql.prepare('SELECT key FROM work_failures WHERE step=?').all(step).map(r=>r.key)),
  close:()=>{try{sql.close();}catch{/* schon zu */}},
 };
 return self;
}
export {SAMPLE};

/**
 * Einmaliger Übertrag der Fehler, die die Ablage vor dem Fehlerspeicher führte (Merkzettel 'failures-seeded' in der Ablage):
 * jeder fehlgeschlagene Abruf als Eintrag 'pdf' (Klasse aus HTTP-Code und Meldung, ein Versuch), ocr_refetch als 'ocr-fetch',
 * ocr_slow als 'slow'; Server, die nach der alten Regel ausgelassen wurden (mindestens BLOCK_MIN Abrufe, BLOCK_SHARE Fehler),
 * starten gebremst bzw. gesperrt, damit sie nicht mit allen Dokumenten auf einmal neu versucht werden. Rückgabe: Zähler.
 */
export async function seedFromStore(store,f,now=Date.now()){
 if(!f||store.note('failures-seeded'))return null;
 const iso=t=>new Date(t).toISOString(),c={pdf:0,ocrFetch:0,slow:0,hosts:0};
 const by=new Map();
 for(const r of store.db.prepare('SELECT url,status FROM pdfs').iterate()){let h;try{h=new URL(r.url).host;}catch{continue;}const x=by.get(h)||{n:0,bad:0,denied:0};x.n++;if(r.status==='error'||r.status==='unsupported')x.bad++;by.set(h,x);}
 for(const r of store.db.prepare("SELECT url,http FROM pdfs WHERE status='error' AND http IN (401,403)").iterate()){let h;try{h=new URL(r.url).host;}catch{continue;}by.get(h).denied++;}
 const ins=f.sql.prepare(`INSERT OR IGNORE INTO work_failures(step,key,host,class,reason,http,tries,first_at,last_at,next_try_at,event_date,origin) VALUES(?,?,?,?,?,?,1,?,?,?,?,?)`);
 const hostIns=f.sql.prepare(`INSERT OR IGNORE INTO source_hosts(host,state,fails,level,next_try_at,last_fail_at,reason,updated_at) VALUES(?,?,?,1,?,?,?,?)`);
 f.sql.exec('BEGIN IMMEDIATE');
 try{
  for(const [h,x] of by)if(x.n>=BLOCK_MIN&&x.bad/x.n>=BLOCK_SHARE){
   const denied=x.denied>=x.bad/2;
   hostIns.run(h,denied?'gesperrt':'bremsen',3,iso(now+(denied?7*864e5:3600000)),iso(now),'aus der alten Serversperre',iso(now));c.hosts++;
  }
  for(const r of store.db.prepare("SELECT url,status,http,error,fetched_at,event_date FROM pdfs WHERE status IN ('error','unsupported')").iterate()){
   let host=null;try{host=new URL(r.url).host;}catch{/* ohne Server */}
   const cls=classify({status:r.status,http:r.http,error:r.error});
   ins.run('pdf',r.url,host,cls,r.error||null,r.http,r.fetched_at||iso(now),r.fetched_at||iso(now),nextTry(cls,1,{now}),r.event_date||null,'backlog');c.pdf++;
  }
  for(const r of store.db.prepare('SELECT r.sha256,r.error,r.tried_at,(SELECT max(event_date) FROM pdfs p WHERE p.sha256=r.sha256) AS ev FROM ocr_refetch r').iterate()){
   const cls=classify({error:r.error,changed:/geändert/.test(r.error||'')});
   ins.run('ocr-fetch',r.sha256,null,cls,r.error||null,null,r.tried_at,r.tried_at,nextTry(cls,1,{now}),r.ev||null,'backlog');c.ocrFetch++;
  }
  for(const r of store.db.prepare('SELECT s.sha256,s.tried_at,(SELECT max(event_date) FROM pdfs p WHERE p.sha256=s.sha256) AS ev FROM ocr_slow s').iterate()){
   ins.run('ocr',r.sha256,null,'slow','Zeitgrenze je Datei',null,r.tried_at,r.tried_at,iso(now),r.ev||null,'backlog');c.slow++;
  }
  f.sql.exec('COMMIT');
 }catch(e){f.sql.exec('ROLLBACK');throw e;}
 // ocr_refetch und ocr_slow führt ab jetzt der Fehlerspeicher (text.mjs schreibt sie nur noch ohne ihn)
 store.db.exec('DELETE FROM ocr_refetch;DELETE FROM ocr_slow;');
 store.setNote('failures-seeded',iso(now));
 await f.refresh();
 return c;
}
