// Ablauf des Browser-Imports: detect → import → apply → record (→ download). Jeder Schritt ist für sich nutzbar und
// legt seine Ergebnisse im Ausgabeordner der Instanz ab (tmp/browser-import/<instanceId>/). Die Leser des Projekts
// (collectSdnet) lesen die Seiten über den Browser-Transport; gespeichert wird mit applyBackfill in die lokale
// Datenbank, genau wie eine historische Nachladung. Nichts hier läuft im Worker.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {collectSdnet} from '../../server/integrations/sdnet.mjs';
import {applyBackfill} from '../../server/integrations/apply-backfill.mjs';
import {windowStart} from '../../server/integrations/history-window.mjs';
import {sqliteAdapter} from '../ai-job.mjs';
import {validateInstance,sourceOf,oparlVerdict,ADAPTERS,checkPdf,documentName,sha256,shortHash,csvCell,instanceUrl} from './core.mjs';
import {openSession,StopError,decodeResponse} from './session.mjs';
import {browserTransport} from './transport.mjs';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const INSTANCES=path.join(ROOT,'scripts','browser-import','instances');
/** Instanzkonfiguration laden: Name (instances/<name>.json) oder Dateipfad. */
export async function loadInstance(nameOrPath){
 const file=/[\\/]|\.json$/.test(nameOrPath)?path.resolve(nameOrPath):path.join(INSTANCES,nameOrPath+'.json');
 return validateInstance(JSON.parse((await fs.readFile(file,'utf8')).replace(/^﻿/,'')));
}
export const outputDirOf=instance=>path.resolve(ROOT,instance.outputDir);
/** Protokoll in die Konsole und in lauf.log des Ausgabeordners. */
export async function logger(instance,{quiet=false}={}){
 const dir=outputDirOf(instance);await fs.mkdir(path.join(dir,'diagnose'),{recursive:true});
 const file=path.join(dir,'lauf.log');
 const log=message=>{if(!quiet)console.log(message);fs.appendFile(file,`${new Date().toISOString()} ${message}\n`,'utf8').catch(()=>{});};
 return {log,dir};
}
const stamp=()=>new Date().toISOString();
/**
 * detect: Zielseite positiv erkennen (Browserprüfung regulär abwarten) und die OParl-Adresse des Systems aus der Sitzung
 * fragen. Ergebnis in detect.json; die Instanzdatei wird nicht verändert (access.oparlStatus von Hand übernehmen).
 */
export async function detect(instance,{launchOverrides={},quiet=false,sessionFactory=null}={}){
 const {log,dir}=await logger(instance,{quiet});
 const session=await (sessionFactory||openSession)(instance,{log,diagnoseDir:path.join(dir,'diagnose'),launchOverrides});
 const result={schemaVersion:1,instanceId:instance.instanceId,at:stamp(),browser:session.version,entry:null,oparl:null,error:null};
 try{
  const startUrl=new URL(instance.entryPaths.start,new URL(instance.basePath,instance.origin)).href;
  const page=await session.open(startUrl);
  result.entry={url:page.url,title:page.title,httpStatus:page.httpStatus,textLength:page.body.length};
  log(`Zielseite erkannt: ${page.title}`);
  const probe=decodeResponse(await session.fetch(instance.origin+ADAPTERS[instance.adapter].oparlPath));
  result.oparl={url:instance.origin+ADAPTERS[instance.adapter].oparlPath,httpStatus:probe.httpStatus??null,contentType:probe.contentType||'',...oparlVerdict({httpStatus:probe.httpStatus,contentType:probe.contentType,body:probe.text})};
  log(`OParl: ${result.oparl.status} – ${result.oparl.note}`);
 }catch(error){result.error=String(error.message||error);log('ABBRUCH: '+result.error);await session.diagnostics('detect-abbruch');}
 finally{await session.close();}
 await fs.writeFile(path.join(dir,'detect.json'),JSON.stringify(result,null,1),'utf8');
 return result;
}
/**
 * import: die Gebiete der Instanz mit dem Leser des Systems lesen (Zeitraum window), je Gebiet <outputDir>/<regionId>.json
 * im Format einer Nachladung ({topics, coverage}) sowie bericht.txt und report.json. scope: complete_for_scope (Leser meldet
 * vollständig, nichts angehalten), limited (Leser unvollständig: Zeit-, Anfrage- oder Sitzungslimit), stopped (Lauf angehalten).
 */
export async function importInstance(instance,{regions=null,window=instance.window,launchOverrides={},quiet=false,now=new Date(),sessionFactory=null}={}){
 const {log,dir}=await logger(instance,{quiet});
 const chosen=instance.regions.filter(r=>!regions||regions.includes(r.id));
 if(!chosen.length)throw Error('Kein Gebiet der Instanz gewählt.');
 const report={schemaVersion:1,instanceId:instance.instanceId,startedAt:stamp(),window,browser:null,regions:[],requests:[],scope:'stopped',stopped:null,finishedAt:null};
 const session=await (sessionFactory||openSession)(instance,{log,diagnoseDir:path.join(dir,'diagnose'),launchOverrides});
 report.browser=session.version;
 const transport=browserTransport(session,instance,{log,onRequest:r=>{report.requests.push(r);}});
 try{
  log(`BROWSER-IMPORT ${instance.displayName} · Zeitraum ${window} · ${chosen.length} Gebiet(e)`);
  log('Sichtbaren Browser offen lassen; eine verlangte Handlung (Aufgabe) wird nicht gelöst, der Lauf hält dann an.');
  await session.open(transport.startUrl);
  for(const region of chosen){
   if(transport.state.stopped)break;
   const source=sourceOf(instance,region),at=stamp();let result;
   log(`\nGebiet ${region.name} (${region.id})`);
   try{result=await collectSdnet(source,{now,get:transport.get,window,maxDurationMs:instance.limits.maxDurationMs,onProgress:text=>log('  '+text)});}
   catch(error){result={topics:[],coverage:{regionId:region.id,complete:false,issues:[String(error.message||error)],importedAt:null}};}
   result.coverage={...result.coverage,regionId:region.id,method:instance.adapter,transport:'browser',requestedFrom:windowStart(now,window).toISOString().slice(0,10),lastAttemptAt:at,browserImport:{instanceId:instance.instanceId,at,requests:transport.state.requests,stopped:transport.state.stopped}};
   const file=path.join(dir,region.id+'.json');
   await fs.writeFile(file+'.tmp',JSON.stringify(result));await fs.rename(file+'.tmp',file);
   const summary={id:region.id,name:region.name,topics:result.topics.length,meetings:result.coverage.meetings??null,complete:!!result.coverage.complete,issues:(result.coverage.issues||[]).slice(0,8),file:path.relative(ROOT,file)};
   report.regions.push(summary);
   log(`  ${summary.topics} Berichte, ${summary.meetings??'?'} Sitzungen, ${summary.complete?'vollständig':'unvollständig'}${summary.issues.length?' · '+summary.issues[0]:''}`);
  }
 }catch(error){
  if(!(error instanceof StopError))log('FEHLER: '+String(error.message||error));
  transport.state.stopped??=String(error.message||error);await session.diagnostics('import-abbruch');
 }finally{await session.close();}
 report.stopped=transport.state.stopped;report.finishedAt=stamp();
 report.scope=transport.state.stopped?'stopped':report.regions.length&&report.regions.every(r=>r.complete)?'complete_for_scope':'limited';
 report.totals={requests:transport.state.requests,bytes:transport.state.bytes,wafPages:transport.state.waf,reopened:transport.state.reopened,topics:report.regions.reduce((n,r)=>n+r.topics,0)};
 await fs.writeFile(path.join(dir,'report.json'),JSON.stringify({...report,requests:report.requests.slice(-2000)},null,1),'utf8');
 const lines=[`Ergebnis: ${report.scope}`,...report.regions.map(r=>`${r.name}: ${r.topics} Berichte, ${r.meetings??'?'} Sitzungen, ${r.complete?'vollständig':'unvollständig'}`),`Anfragen: ${report.totals.requests} (${(report.totals.bytes/1048576).toFixed(1)} MiB), WAF-Prüfseiten: ${report.totals.wafPages}`,
  ...(report.stopped?[`Angehalten: ${report.stopped}`]:[]),`Zeitraum: ${window} · Ergebnisse: ${dir}`,'Nur der gewählte Zeitraum der Vorlagenliste und des Kalenders; kein vollständiger Archivabruf. Gespeichert wird erst mit apply.'];
 await fs.writeFile(path.join(dir,'bericht.txt'),lines.join('\n')+'\n','utf8');
 log('\n'+lines.join('\n'));
 return report;
}
/** Die Ergebnisdateien der Instanz als Nachladung ({revision, results}). */
export async function bundleOf(instance,{regions=null}={}){
 const dir=outputDirOf(instance),results=[];
 for(const region of instance.regions){
  if(regions&&!regions.includes(region.id))continue;
  try{results.push(JSON.parse(await fs.readFile(path.join(dir,region.id+'.json'),'utf8')));}catch{}
 }
 return {revision:stamp(),results};
}
/** Lokale Datenbank des Dev-Servers (miniflare D1), sofern nicht angegeben. */
export async function defaultDbPath(){
 const dir=path.join(ROOT,'.wrangler','state','v3','d1','miniflare-D1DatabaseObject');
 const files=(await fs.readdir(dir).catch(()=>[])).filter(f=>f.endsWith('.sqlite'));
 if(files.length!==1)throw Error('Lokale Datenbank nicht eindeutig; --db <pfad> angeben.');
 return path.join(dir,files[0]);
}
/** apply: Ergebnisdateien in die lokale Datenbank einspielen (wie eine historische Nachladung: zusammenführen, nie ersetzen). */
export async function apply(instance,{dbPath=null,regions=null}={}){
 const bundle=await bundleOf(instance,{regions});
 if(!bundle.results.length)throw Error('Keine Ergebnisdateien; zuerst import ausführen.');
 const file=dbPath||await defaultDbPath();
 const raw=new DatabaseSync(file);
 try{await applyBackfill(sqliteAdapter(raw),bundle);}finally{raw.close();}
 return {db:file,revision:bundle.revision,regions:bundle.results.map(r=>({id:r.coverage.regionId,topics:r.topics.length,complete:!!r.coverage.complete}))};
}
/**
 * record: Nachweis für den Quellenkatalog. Für jedes Gebiet, dessen Lauf Sitzungen mit Tagesordnung gelesen hat, eine
 * angenommene Quelle (transport 'browser') in verified-browser.json des Arbeitsordners seines Landes; der Katalog-Build
 * (scripts/source-discovery/build.mjs) nimmt sie auf. Ohne gelesene Sitzung wird nichts behauptet.
 */
export async function record(instance,{regions=null,detectResult=null,root=ROOT}={}){
 const dir=outputDirOf(instance),written=[],skipped=[];
 const detect=detectResult||(await fs.readFile(path.join(dir,'detect.json'),'utf8').then(JSON.parse).catch(()=>null));
 for(const region of instance.regions){
  if(regions&&!regions.includes(region.id))continue;
  let result;try{result=JSON.parse(await fs.readFile(path.join(dir,region.id+'.json'),'utf8'));}catch{skipped.push([region.id,'keine Ergebnisdatei']);continue;}
  const meetings=Number(result.coverage?.meetings||0),topics=result.topics?.length||0;
  if(!topics){skipped.push([region.id,'keine Berichte gelesen']);continue;}
  const source=sourceOf(instance,region),checkedAt=(result.coverage.lastAttemptAt||stamp()).slice(0,10);
  const oparl=detect?.oparl?.status==='disabled_confirmed'?{checkedAt:detect.at.slice(0,10),reason:detect.oparl.note}:null;
  const accepted={...source,verifiedSource:instance.origin,verifiedAt:checkedAt,foundBy:'Browser-Import',
   apiCheck:oparl?`OParl-Schnittstelle des Herstellers war am ${oparl.checkedAt} nicht aktiviert; öffentliche SD.NET-Seiten über den Browser-Import gelesen.`:'Öffentliche SD.NET-Seiten über den Browser-Import gelesen; OParl nicht geprüft.',
   ...(oparl?{oparlFallback:oparl}:{}),
   browserImport:{instanceId:instance.instanceId,at:result.coverage.lastAttemptAt,topics,meetings,complete:!!result.coverage.complete}};
  const landDir=region.id.startsWith('nrw-')?'tmp/source-discovery/':region.id.startsWith('nds-')?'tmp/source-discovery-nds/':'tmp/source-discovery-de/';
  const file=path.join(root,landDir,'verified-browser.json');
  await fs.mkdir(path.dirname(file),{recursive:true});
  const rows=await fs.readFile(file,'utf8').then(JSON.parse).catch(()=>({}));
  rows[region.id]={id:region.id,name:region.name,kind:region.kind,accepted,tried:[{url:instance.origin+instance.entryPaths.start,system:instance.adapter,transport:'browser',topics,meetings}],checkedAt:Date.now()};
  await fs.writeFile(file,JSON.stringify(rows,null,1),'utf8');
  written.push([region.id,path.relative(ROOT,file)]);
 }
 return {written,skipped};
}
/**
 * download: Dokumente (PDF) der gelesenen Berichte aus der Sitzung holen, prüfen (Status, Herkunft, keine Prüfseite,
 * PDF-Kopf und Endmarkierung), einmal je Adresse und je Inhalt speichern (downloads/, metadata.json/.csv).
 * Höchstens limits.maxDocuments Anfragen je Lauf; WAF-Prüfseite oder HTTP 401/403/429 halten an.
 */
export async function download(instance,{regions=null,launchOverrides={},quiet=false,maxDocuments=instance.limits.maxDocuments,sessionFactory=null}={}){
 const {log,dir}=await logger(instance,{quiet});
 const bundle=await bundleOf(instance,{regions});
 const wanted=new Map();
 for(const result of bundle.results)for(const t of result.topics)for(const d of t.documents||[]){
  const url=instanceUrl(d.url,instance);if(!url)continue;
  if(!(/\.pdf$/i.test(new URL(url).pathname)||/\/sdnetrim\//i.test(new URL(url).pathname)||/pdf/i.test(d.kind||'')))continue;
  const entry=wanted.get(url)||{url,title:d.title||'',topics:[]};entry.topics.push(t.id);wanted.set(url,entry);
 }
 const meta={schemaVersion:1,instanceId:instance.instanceId,startedAt:stamp(),documents:[],stopped:null};
 if(!wanted.size){meta.finishedAt=stamp();await fs.writeFile(path.join(dir,'metadata.json'),JSON.stringify(meta,null,1),'utf8');return meta;}
 const session=await (sessionFactory||openSession)(instance,{log,diagnoseDir:path.join(dir,'diagnose'),launchOverrides});
 const startUrl=new URL(instance.entryPaths.start,new URL(instance.basePath,instance.origin)).href;
 const byHash=new Map();let attempts=0,lastAt=0;
 try{
  await session.open(startUrl);
  for(const entry of wanted.values()){
   if(attempts>=maxDocuments){meta.documents.push({...entry,status:'limit_erreicht'});continue;}
   attempts++;log(`Dokument ${attempts}/${Math.min(maxDocuments,wanted.size)}: ${documentName(entry.url)}`);
   const record={...entry,checkedAt:stamp()};
   // Takt wie beim Lesen der Seiten: Mindestabstand zwischen zwei Anfragen an die Instanz.
   const wait=instance.limits.delayMs-(Date.now()-lastAt);if(wait>0)await sleep(wait);lastAt=Date.now();
   const response=decodeResponse(await session.fetch(entry.url));
   Object.assign(record,{httpStatus:response.httpStatus??null,contentType:response.contentType||'',finalUrl:response.finalUrl||null});
   let error=response.error||null;
   if(!error&&!(response.httpStatus>=200&&response.httpStatus<300))error='HTTP '+response.httpStatus;
   if(!error&&response.finalUrl&&!instanceUrl(response.finalUrl,instance))error='Umleitung auf eine andere Website.';
   const check=checkPdf(response.body);if(!error&&!check.ok)error=check.reason;
   if(response.waf)error='Die Dokumentanfrage liefert die Prüfseite der WAF statt eines PDF.';
   if(error){
    record.status='fehler';record.error=error;
    if(response.body.length&&!check.ok){const debug=`diagnose/download-${shortHash(entry.url)}.${/<html|<!doctype/i.test(response.text.slice(0,2000))?'html':'txt'}`;await fs.writeFile(path.join(dir,debug),response.text.slice(0,40000),'utf8');record.diagnosticFile=debug;}
    log('  FEHLER: '+error);meta.documents.push(record);
    if(response.waf||[401,403,429].includes(response.httpStatus)){meta.stopped=error+' Der Lauf hält hier an.';log('ANGEHALTEN: '+meta.stopped);break;}
    continue;
   }
   record.bytes=response.body.length;record.sha256=sha256(response.body);record.pdfCheck=check.reason;
   const same=byHash.get(record.sha256);
   if(same){record.status='wiederverwendet';record.localPath=same;}
   else{const relative=`downloads/${documentName(entry.url)}`,full=path.join(dir,relative);await fs.mkdir(path.dirname(full),{recursive:true});await fs.writeFile(full+'.part',response.body);await fs.rename(full+'.part',full);record.status='gespeichert';record.localPath=relative;byHash.set(record.sha256,relative);log(`  PDF OK: ${record.bytes} Bytes → ${relative}`);}
   meta.documents.push(record);
  }
 }catch(error){meta.stopped??=String(error.message||error);log('ABBRUCH: '+meta.stopped);await session.diagnostics('download-abbruch');}
 finally{await session.close();}
 meta.finishedAt=stamp();meta.totals={requested:attempts,saved:meta.documents.filter(d=>d.status==='gespeichert').length,reused:meta.documents.filter(d=>d.status==='wiederverwendet').length,failed:meta.documents.filter(d=>d.status==='fehler').length,skipped:meta.documents.filter(d=>d.status==='limit_erreicht').length};
 await fs.writeFile(path.join(dir,'metadata.json'),JSON.stringify(meta,null,1),'utf8');
 const rows=[['Dokument','Dokument_URL','Status','Datei','Bytes','SHA256','HTTP','Fehler','Berichte'],...meta.documents.map(d=>[d.title,d.url,d.status,d.localPath,d.bytes,d.sha256,d.httpStatus,d.error,(d.topics||[]).join(' ')])];
 await fs.writeFile(path.join(dir,'metadata.csv'),'﻿'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')+'\r\n','utf8');
 log(`Dokumente: ${meta.totals.saved} gespeichert, ${meta.totals.reused} wiederverwendet, ${meta.totals.failed} Fehler, ${meta.totals.skipped} wegen Limit ausgelassen.`);
 return meta;
}
