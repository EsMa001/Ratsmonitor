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
const key='admin-pipeline-job';
const read=async db=>{const r=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(key).first();return r?JSON.parse(r.value):null;};
const save=(db,job)=>db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(job)).run();
// Queue lease and import lease have different purposes. Both are compare-and-swap leases.
export async function pipelineAction(db,body,run){
 const lease=String(Date.now()+600000);
 const lock=await db.prepare("INSERT INTO system_state(key,value) VALUES('pipeline-lease',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER)<? RETURNING value").bind(lease,Date.now()).first();
 if(!lock)throw new AdminError(409,'Ein Warteschlangenschritt läuft bereits.');
 try{
  let job=await read(db);
  if(body.action==='create'){
   if(job&&['queued','running'].includes(job.status)&&job.items.some(i=>i.status==='queued'||i.status==='running'))throw new AdminError(409,'Bitte den bestehenden Auftrag fortsetzen oder beenden.');
   if(!['metadata','analysis'].includes(body.stage))throw new AdminError(400,'Ungültige Verarbeitungsstufe.');
   const ids=selectedRegions(body.regions),at=new Date().toISOString();
   // The look-back window is fixed when the job is created, so a resumed job keeps the period the operator chose.
   let lookback;if(body.stage==='metadata'){try{lookback=historyWindow(body.window);}catch{throw new AdminError(400,'Ungültiger Zeitraum für den Abruf.');}}
   job={id:crypto.randomUUID(),stage:body.stage,...(lookback?{window:lookback}:{}),createdAt:at,updatedAt:at,status:'queued',items:ids.map(region=>({region,status:body.stage==='metadata'&&!canImport(region)?'unavailable':'queued',processed:0,message:body.stage==='metadata'&&!canImport(region)?'Keine angebundene Quelle.':''}))};
   await save(db,job);return job;
  }
  if(!job||body.id!==job.id)throw new AdminError(409,'Der Auftrag wurde inzwischen geändert.');
  if(body.action==='cancel'){job.status='cancelled';job.updatedAt=new Date().toISOString();await save(db,job);return job;}
  if(body.action!=='step')throw new AdminError(400,'Ungültige Aktion.');
  if(['completed','cancelled'].includes(job.status))return job;
  // Interrupted HTTP replies never silently repeat a potentially committed import.
  const interrupted=job.items.find(i=>i.status==='running');
  if(interrupted){interrupted.status='unknown';interrupted.message='Antwort unterbrochen. Quellenstand und Verlauf prüfen; bei Bedarf einen neuen Auftrag starten.';}
  const item=job.items.find(i=>i.status==='queued');
  if(!item){job.status='completed';job.updatedAt=new Date().toISOString();await save(db,job);return job;}
  item.status='running';job.status='running';job.updatedAt=new Date().toISOString();await save(db,job);
  try{
   const result=await run(job.stage,item.region,job.window),d=result.data||{};
   if(result.status===409){item.status='queued';item.message=d.error;}
   else if(result.status!==200){item.status='failed';item.message=d.error||'Abruf fehlgeschlagen.';}
   else {item.processed+=Number(d.processed??d.topics??0);
    // The item reports this attempt; the stored period may still be partial from an earlier, wider import.
    const complete=d.attemptComplete??d.coverage?.complete;
    item.status=job.stage==='analysis'&&d.remaining>0?'queued':d.coverage&&!complete?'partial':'completed';item.message=job.stage==='analysis'?`${d.remaining||0} Artikel noch offen.`:d.quiet?'Keine Sitzungen im gewählten Zeitraum; gespeicherter Bestand unverändert.':d.coverage?.issues?.join(' · ').slice(0,2500)||'Ergebnis in der Datenbank gespeichert.';}
  }catch{item.status='unknown';item.message='Ausführung unterbrochen. Gespeicherten Bestand vor einem neuen Auftrag prüfen.';}
  job.status=job.items.some(i=>i.status==='queued')?'queued':'completed';job.updatedAt=new Date().toISOString();await save(db,job);return job;
 }finally{await db.prepare("DELETE FROM system_state WHERE key='pipeline-lease' AND value=?").bind(lease).run();}
}
