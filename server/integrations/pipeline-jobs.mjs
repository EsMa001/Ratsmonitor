import {AdminError} from './admin-access.mjs';
import regions from '../../shared/nrw-regions.json' with {type:'json'};
import {NRW_SOURCES} from './source-catalog.mjs';
import {SOURCES} from './regions.mjs';
import {historyWindow} from '../../shared/history-window.mjs';
export const canImport=id=>id==='muenster'||SOURCES.some(s=>s.id===id)||NRW_SOURCES.some(s=>s.id===id&&s.method!=='pending');
export function selectedRegions(value){
 if(value==='all')return regions.map(r=>r.id);
 if(!Array.isArray(value)||!value.length||value.length>regions.length||value.some(id=>typeof id!=='string'||!regions.some(r=>r.id===id)))throw new AdminError(400,'Bitte gültige Gebiete auswählen.');
 return [...new Set(value)];
}
/**
 * Areas worked on at the same time. Six is what a browser opens to one server at once. Rule labelling rewrites the
 * stock and stays one at a time.
 */
export const PARALLEL=Object.freeze({metadata:6,analysis:1});
/** Imports that may run at the same time against one operator of council systems. */
export const PER_PROVIDER=2;
// An import that the time limit cut off continues where it stopped, at most this many times per area and job.
const MAX_RESUMES=10;
/**
 * Operator of an area's council system: the registrable part of its host name. Many municipalities share one
 * operator; at most PER_PROVIDER of their areas are read at the same time.
 */
export function provider(id){
 const source=SOURCES.find(s=>s.id===id)||NRW_SOURCES.find(s=>s.id===id);
 try{return new URL(source.system||source.base).hostname.split('.').slice(-2).join('.');}catch{return 'area:'+id;}
}
// A step that has not reported back for this long was interrupted: an import is limited to two minutes plus storing.
const STALE_MS=300000;
const key='admin-pipeline-job';
const read=async db=>{const r=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(key).first();return r?JSON.parse(r.value):null;};
const save=(db,job)=>db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(job)).run();
const stamp=job=>{job.updatedAt=new Date().toISOString();return job;};
const pause=ms=>new Promise(done=>setTimeout(done,ms));
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
 * create | cancel | step. A step claims one waiting area, runs it and stores its result. Several steps may run at the
 * same time (PARALLEL); a step that finds nothing to claim while others are still running answers with wait:true.
 */
export async function pipelineAction(db,body,run){
 if(body.action==='create')return locked(db,async()=>{
  const job=await read(db);
  if(job&&['queued','running'].includes(job.status)&&job.items.some(i=>i.status==='queued'||i.status==='running'))throw new AdminError(409,'Bitte den bestehenden Auftrag fortsetzen oder beenden.');
  if(!['metadata','analysis'].includes(body.stage))throw new AdminError(400,'Ungültige Verarbeitungsstufe.');
  const ids=selectedRegions(body.regions),at=new Date().toISOString();
  // The look-back window is fixed when the job is created, so a resumed job keeps the period the operator chose.
  let lookback;if(body.stage==='metadata'){try{lookback=historyWindow(body.window);}catch{throw new AdminError(400,'Ungültiger Zeitraum für den Abruf.');}}
  const created={id:crypto.randomUUID(),stage:body.stage,...(lookback?{window:lookback}:{}),createdAt:at,updatedAt:at,status:'queued',items:ids.map(region=>({region,status:body.stage==='metadata'&&!canImport(region)?'unavailable':'queued',processed:0,message:body.stage==='metadata'&&!canImport(region)?'Keine angebundene Quelle.':''}))};
  await save(db,created);return created;
 });
 if(body.action==='cancel')return locked(db,async()=>{const job=await current(db,body.id);job.status='cancelled';await save(db,stamp(job));return job;});
 if(body.action!=='step')throw new AdminError(400,'Ungültige Aktion.');
 const claim=await locked(db,async()=>{
  const job=await current(db,body.id);
  if(['completed','cancelled'].includes(job.status))return {job};
  // Interrupted HTTP replies never silently repeat a potentially committed import.
  let changed=false;const now=Date.now();
  for(const i of job.items)if(i.status==='running'&&!(now-Date.parse(i.startedAt||'')<STALE_MS)){i.status='unknown';i.message='Antwort unterbrochen. Quellenstand und Verlauf prüfen; bei Bedarf einen neuen Auftrag starten.';delete i.startedAt;changed=true;}
  const active=job.items.filter(i=>i.status==='running'),busy=new Map();for(const i of active)busy.set(provider(i.region),(busy.get(provider(i.region))||0)+1);
  const item=active.length<(PARALLEL[job.stage]||1)?job.items.find(i=>i.status==='queued'&&!(job.stage==='metadata'&&busy.get(provider(i.region))>=PER_PROVIDER)):null;
  if(item){item.status='running';item.startedAt=new Date(now).toISOString();job.status='running';await save(db,stamp(job));return {job,region:item.region};}
  const open=active.length>0||job.items.some(i=>i.status==='queued');
  if(!open){job.status='completed';changed=true;}
  if(changed)await save(db,stamp(job));
  return {job,wait:open};
 });
 if(!claim.region)return claim.wait?{...claim.job,wait:true}:claim.job;
 let result=null;try{result=await run(claim.job.stage,claim.region,claim.job.window);}catch{}
 return locked(db,async()=>{
  const job=await read(db);
  // The job was replaced in the meantime. The import itself is stored; there is no item left to report to.
  if(!job||job.id!==body.id)return job||claim.job;
  const item=job.items.find(i=>i.region===claim.region),d=result?.data||{};
  delete item.startedAt;
  if(!result){item.status='unknown';item.message='Ausführung unterbrochen. Gespeicherten Bestand vor einem neuen Auftrag prüfen.';}
  else if(result.status===409){item.status='queued';item.message=d.error;}
  else if(result.status!==200){item.status='failed';item.message=(d.error||'Abruf fehlgeschlagen.')+(d.cause?' Ursache: '+String(d.cause).slice(0,300):'');}
  else {item.processed+=Number(d.processed??d.topics??0);
   // The item reports this attempt; the stored period may still be partial from an earlier, wider import.
   const complete=d.attemptComplete??d.coverage?.complete;
   if(job.stage==='metadata'&&d.resume&&(item.resumes||0)<MAX_RESUMES){item.resumes=(item.resumes||0)+1;item.status='queued';item.message=`Zeitlimit erreicht; der Abruf wird fortgesetzt (Teil ${item.resumes+1}).`;}
   else {item.status=job.stage==='analysis'&&d.remaining>0?'queued':d.coverage&&!complete?'partial':'completed';item.message=job.stage==='analysis'?`${d.remaining||0} Artikel noch offen.`:d.quiet?'Keine Sitzungen im gewählten Zeitraum; gespeicherter Bestand unverändert.':d.coverage?.issues?.join(' · ').slice(0,2500)||(d.unchanged?`Ergebnis in der Datenbank gespeichert; ${d.unchanged} unveränderte ${d.unchanged===1?'Sitzung':'Sitzungen'} übersprungen.`:'Ergebnis in der Datenbank gespeichert.');
    if(d.warnings?.length)item.message=(item.message+` Warnung: ${d.warnings.join(' · ')}`).slice(0,3000);}}
  if(job.status!=='cancelled')job.status=job.items.some(i=>i.status==='running')?'running':job.items.some(i=>i.status==='queued')?'queued':'completed';
  await save(db,stamp(job));return job;
 });
}
