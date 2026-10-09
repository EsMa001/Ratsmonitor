import {AdminError} from './admin-access.mjs';
import {CATALOG as regions} from '../../shared/catalog.mjs';
import {NRW_SOURCES} from './source-catalog.mjs';
import {SOURCES} from './regions.mjs';
import {serverOf,MUENSTER} from './source-servers.mjs';
import {historyWindow,windowYears} from '../../shared/history-window.mjs';
const known=new Set(regions.map(r=>r.id)),legacy=new Map(SOURCES.map(s=>[s.id,s])),catalog=new Map(NRW_SOURCES.map(s=>[s.id,s]));
export const canImport=id=>id==='muenster'||legacy.has(id)||(catalog.has(id)&&catalog.get(id).method!=='pending');
/** 'all': every area of the catalog. 'sources': every area with a connected source, whatever its state. Otherwise a list of ids. */
export function selectedRegions(value){
 if(value==='all')return regions.map(r=>r.id);
 if(value==='sources')return regions.map(r=>r.id).filter(canImport);
 if(!Array.isArray(value)||!value.length||value.length>regions.length||value.some(id=>typeof id!=='string'||!known.has(id)))throw new AdminError(400,'Bitte gültige Gebiete auswählen.');
 return [...new Set(value)];
}
/**
 * Areas worked on at the same time. Twenty-four imports reach every server that has work while each server still
 * sees at most PER_PROVIDER of them; more would not finish a job sooner, because the servers that host many areas are
 * worked through two at a time. Rule labelling rewrites the stock and stays one at a time.
 */
export const PARALLEL=Object.freeze({metadata:24,analysis:1});
/** Imports that may run at the same time against one server of council systems. */
export const PER_PROVIDER=2;
// An import that the time limit cut off continues where it stopped, at most this many times per area and job.
// Continuations of one area within a job, for each year of the import period.
const MAX_RESUMES=10;
/**
 * Server an area's council system runs on (source-servers.mjs): areas of one operator's domain or on one IP address
 * share it. At most PER_PROVIDER of them are read at the same time.
 */
export function provider(id){
 const source=id==='muenster'?MUENSTER:legacy.get(id)||catalog.get(id);
 return (source&&serverOf(source.system||source.base))||'area:'+id;
}
// A step that has not reported back for this long was interrupted: an import is limited to two minutes plus storing.
const STALE_MS=300000;
// One request of the page may run several steps side by side (action 'run'): a browser opens only six connections
// to one server. A lane takes new areas for this long; the request ends when its lanes have finished their imports.
const RUN_MS=90000,MAX_LANES=8;
const key='admin-pipeline-job';
const read=async db=>{const r=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(key).first();return r?JSON.parse(r.value):null;};
const save=(db,job)=>db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(job)).run();
// Every change carries the moment it was stored: the job as a whole and the area it concerns.
const stamp=(job,at=new Date().toISOString())=>{job.updatedAt=at;return job;};
const pause=ms=>new Promise(done=>setTimeout(done,ms));
const ended=job=>['completed','cancelled'].includes(job.status);
// The lease covers only the short moments in which the stored job is read and written, never an import itself.
// Parallel steps therefore wait briefly for each other instead of being refused.
async function locked(db,fn){
 for(let attempt=0;;attempt++){
  const lease=String(Date.now()+30000);
  const lock=await db.prepare("INSERT INTO system_state(key,value) VALUES('pipeline-lease',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER)<? RETURNING value").bind(lease,Date.now()).first();
  if(lock)try{return await fn();}finally{await db.prepare("DELETE FROM system_state WHERE key='pipeline-lease' AND value=?").bind(lease).run();}
  if(attempt>=60)throw new AdminError(409,'Ein Warteschlangenschritt läuft bereits.');
  await pause(40+Math.random()*80);
 }
}
const current=async(db,id)=>{const job=await read(db);if(!job||id!==job.id)throw new AdminError(409,'Der Auftrag wurde inzwischen geändert.');return job;};
/**
 * What a caller gets back: the job with the number of areas per status. With `since` (the updatedAt the caller saw
 * last) only the areas changed from that moment on are listed; a large job is not sent again with every answer.
 */
function view(job,since,extra={}){
 const counts={};for(const i of job.items)counts[i.status]=(counts[i.status]||0)+1;
 const whole={...job,counts,...extra};
 // An area without a time has not changed since the job was created. "From that moment on" includes the moment itself:
 // two changes can be stored within one millisecond, and an area sent twice does no harm.
 return typeof since==='string'&&since?{...whole,delta:true,items:job.items.filter(i=>(i.at||'')>=since)}:whole;
}
/**
 * The area a step takes next. Imports: an area of the server with the most open areas among those that still have
 * room. Those servers decide when the job ends, so they start first and stay occupied.
 */
function next(job){
 const active=job.items.filter(i=>i.status==='running');
 if(active.length>=(PARALLEL[job.stage]||1))return null;
 if(job.stage!=='metadata')return job.items.find(i=>i.status==='queued')||null;
 const serverOfItem=i=>i.server||provider(i.region),busy=new Map(),open=new Map();
 for(const i of job.items)if(i.status==='running'||i.status==='queued'){const s=serverOfItem(i);open.set(s,(open.get(s)||0)+1);if(i.status==='running')busy.set(s,(busy.get(s)||0)+1);}
 let item=null,most=0;
 for(const i of job.items){if(i.status!=='queued')continue;const s=serverOfItem(i);if((busy.get(s)||0)>=PER_PROVIDER)continue;if(open.get(s)>most){most=open.get(s);item=i;}}
 return item;
}
/** Claims one waiting area, runs it and stores its result. wait: nothing could be claimed while others are still running. */
async function step(db,id,run){
 const claim=await locked(db,async()=>{
  const job=await current(db,id);
  if(ended(job))return {job};
  // Interrupted HTTP replies never silently repeat a potentially committed import.
  let changed=false;const now=Date.now(),at=new Date(now).toISOString();
  // Rule labelling is repeatable: every package is stored as it is written, and the next one continues behind the cursor.
  for(const i of job.items)if(i.status==='running'&&!(now-Date.parse(i.startedAt||'')<STALE_MS)){if(job.stage==='analysis'){i.status='queued';i.message='Antwort unterbrochen; gespeicherte Pakete bleiben erhalten, das nächste Paket folgt.';}else{i.status='unknown';i.message='Antwort unterbrochen. Quellenstand und Verlauf prüfen; bei Bedarf einen neuen Auftrag starten.';}delete i.startedAt;i.at=at;changed=true;}
  const item=job.paused?null:next(job);
  if(item){item.status='running';item.startedAt=at;item.at=at;job.status='running';await save(db,stamp(job,at));return {job,region:item.region,cursor:item.cursor};}
  const open=job.items.some(i=>i.status==='running'||i.status==='queued');
  if(!open){job.status='completed';changed=true;}
  if(changed)await save(db,stamp(job,at));
  return {job,wait:open&&!job.paused};
 });
 if(!claim.region)return claim;
 // The cursor (rule labelling) is handed on only when the item has one; imports take their three arguments as before.
 let result=null;try{result=await run(claim.job.stage,claim.region,claim.job.window,...(claim.cursor!==undefined?[claim.cursor]:[]));}catch{}
 return locked(db,async()=>{
  const job=await read(db);
  // The job was replaced in the meantime. The import itself is stored; there is no item left to report to.
  if(!job||job.id!==id)return {job:job||claim.job};
  const item=job.items.find(i=>i.region===claim.region),d=result?.data||{},at=new Date().toISOString();
  // A large job keeps short notes: the full notes of an import are stored with the source status.
  const [short,long]=job.items.length>200?[240,320]:[2500,3000];
  delete item.startedAt;item.at=at;
  if(!result){if(job.stage==='analysis'){item.status='queued';item.message='Paket unterbrochen; gespeicherte Pakete bleiben erhalten, das nächste Paket folgt beim Fortsetzen.';job.paused=true;}else{item.status='unknown';item.message='Ausführung unterbrochen. Gespeicherten Bestand vor einem neuen Auftrag prüfen.';}}
  // Another process holds the stock (or this area). The job waits for an explicit continuation instead of asking again and again.
  else if(result.status===409){item.status='queued';item.message=d.error;job.paused=true;}
  else if(result.status!==200){item.status='failed';item.message=((d.error||'Abruf fehlgeschlagen.')+(d.cause?' Ursache: '+String(d.cause).slice(0,300):'')).slice(0,long);}
  else {item.processed+=Number(d.processed??d.topics??0);
   // The item reports this attempt; the stored period may still be partial from an earlier, wider import.
   const complete=d.attemptComplete??d.coverage?.complete;
   if(job.stage==='metadata'&&d.resume&&(item.resumes||0)<MAX_RESUMES*windowYears(job.window)){item.resumes=(item.resumes||0)+1;item.status='queued';item.message=`Zeitlimit erreicht; der Abruf wird fortgesetzt (Teil ${item.resumes+1}).`;}
   else if(job.stage==='analysis'){
    // The next package continues behind the cursor; remaining is known for one region, for the whole stock only whether more may follow.
    if(d.cursor)item.cursor=d.cursor;
    if(typeof d.remaining==='number')item.remaining=d.remaining;else delete item.remaining;
    const open=d.more||d.remaining>0;
    item.status=open?'queued':'completed';item.message=!open?'Alle offenen Berichte bearbeitet.':typeof d.remaining==='number'?`${d.remaining} Berichte noch offen; das nächste Paket folgt.`:'Weitere Berichte offen; das nächste Paket folgt.';
    if(!open)delete item.cursor;}
   else {item.status=d.coverage&&!complete?'partial':'completed';item.message=d.quiet?'Keine Sitzungen im gewählten Zeitraum; gespeicherter Bestand unverändert.':d.coverage?.issues?.join(' · ').slice(0,short)||(d.unchanged?`Ergebnis in der Datenbank gespeichert; ${d.unchanged} unveränderte ${d.unchanged===1?'Sitzung':'Sitzungen'} übersprungen.`:'Ergebnis in der Datenbank gespeichert.');
    if(d.warnings?.length)item.message=(item.message+` Warnung: ${d.warnings.join(' · ')}`).slice(0,long);}}
  if(job.status!=='cancelled')job.status=job.items.some(i=>i.status==='running')?'running':job.items.some(i=>i.status==='queued')?'queued':'completed';
  await save(db,stamp(job,at));return {job,claimed:true};
 });
}
/**
 * create | cancel | pause | resume | status | step | run.
 * - step claims one waiting area, runs it and stores its result. Several steps may run at the same time (PARALLEL);
 *   a step that finds nothing to claim while others are still running answers with wait:true.
 * - run does the same in up to MAX_LANES lanes within one request, each taking area after area for RUN_MS.
 * - pause stops further claims until resume; running imports finish and report. An import refused because another
 *   process holds the stock pauses the job as well.
 * - status only reads. Every answer accepts `since` (see view).
 */
export async function pipelineAction(db,body,run){
 const since=typeof body.since==='string'&&body.since.length<40?body.since:undefined;
 if(body.action==='create')return locked(db,async()=>{
  const job=await read(db);
  if(job&&['queued','running'].includes(job.status)&&job.items.some(i=>i.status==='queued'||i.status==='running')){
   // replace: the operator ends the open job with the start of the new one. Imports of it that are still running
   // (another tab, another request) are waited for; their results would have no job left to report to.
   if(!body.replace)throw new AdminError(409,'Bitte den bestehenden Auftrag fortsetzen oder beenden.');
   if(job.items.some(i=>i.status==='running'&&Date.now()-Date.parse(i.startedAt||'')<STALE_MS))throw new AdminError(409,'Der offene Auftrag ruft gerade noch Gebiete ab. Bitte pausieren und warten, bis die laufenden Abrufe gespeichert sind.');
  }
  if(!['metadata','analysis'].includes(body.stage))throw new AdminError(400,'Ungültige Verarbeitungsstufe.');
  const at=new Date().toISOString(),imports=body.stage==='metadata';
  // Rule labelling of the whole stock is one item: package after package over every region in id order, with a cursor
  // (manual-analysis.mjs); a list of areas labels each area on its own.
  if(!imports&&body.regions==='all'){const created={id:crypto.randomUUID(),stage:body.stage,scope:'all',createdAt:at,updatedAt:at,status:'queued',items:[{region:'all',status:'queued',processed:0,message:''}]};await save(db,created);return view(created);}
  const ids=selectedRegions(body.regions);
  // The look-back window is fixed when the job is created, so a resumed job keeps the period the operator chose.
  let lookback;if(imports){try{lookback=historyWindow(body.window);}catch{throw new AdminError(400,'Ungültiger Zeitraum für den Abruf.');}}
  const created={id:crypto.randomUUID(),stage:body.stage,...(lookback?{window:lookback}:{}),...(typeof body.regions==='string'?{scope:body.regions}:{}),createdAt:at,updatedAt:at,status:'queued',items:ids.map(region=>{const open=!imports||canImport(region);return {region,status:open?'queued':'unavailable',processed:0,message:open?'':'Keine angebundene Quelle.',...(imports&&open?{server:provider(region)}:{})};})};
  await save(db,created);return view(created);
 });
 if(body.action==='cancel')return locked(db,async()=>{const job=await current(db,body.id);job.status='cancelled';delete job.paused;await save(db,stamp(job));return view(job,since);});
 if(body.action==='pause'||body.action==='resume')return locked(db,async()=>{const job=await current(db,body.id);if(body.action==='pause'&&!ended(job))job.paused=true;else delete job.paused;await save(db,stamp(job));return view(job,since);});
 if(body.action==='status')return view(await current(db,body.id),since);
 if(body.action==='step'){const done=await step(db,body.id,run);return view(done.job,since,done.wait?{wait:true}:{});}
 if(body.action!=='run')throw new AdminError(400,'Ungültige Aktion.');
 const lanes=Math.max(1,Math.min(MAX_LANES,Math.floor(Number(body.lanes))||1)),until=Date.now()+RUN_MS;
 // Rule labelling works through the whole stock in packages and keeps the runtime busy for the whole request; between two
 // packages it rests as long as the package took (at most 2.5 s), so pages and status requests are answered meanwhile.
 const lane=async()=>{let done;do{const began=Date.now();done=await step(db,body.id,run);if(done.claimed&&done.job.stage==='analysis'&&!done.job.paused&&!ended(done.job))await new Promise(r=>setTimeout(r,Math.min(2500,Date.now()-began)));}while(done.claimed&&!done.job.paused&&!ended(done.job)&&Date.now()<until);return done;};
 // A lane that fails must not end the request while the others still import: their results are reported first.
 const outcomes=await Promise.allSettled(Array.from({length:lanes},lane)),finished=outcomes.filter(o=>o.status==='fulfilled').map(o=>o.value);
 if(!finished.length)throw outcomes[0].reason;
 const job=await current(db,body.id);
 // wait: no lane found anything to claim; the caller asks again a little later instead of at once.
 return view(job,since,!ended(job)&&!job.paused&&finished.every(done=>done.wait)?{wait:true}:{});
}
