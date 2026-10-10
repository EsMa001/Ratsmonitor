'use client';
import {useEffect,useRef,useState,useMemo} from 'react';
import {adminHref} from '@/components/admin-chrome';
import {AdminPageHead,AdminChoice,Alert,How,Kpis,SectionHelp,StandLine,mm} from '@/components/admin-ui';
import {FILTER_HELP,HELP,JOB_STATE_HELP,MAP_HELP,STATE_HELP,TERMS} from '@/components/admin-texts';
import {confirmDialog} from '@/components/ratsmonitor/components/ConfirmDialog';
import {AdminProcessingMap} from '@/components/admin-processing-map';
import {splitAiResultBatches} from '@/shared/ai-result-batches.mjs';
import {HISTORY_WINDOWS} from '@/shared/history-window.mjs';
import {reachBucket,freshBucket} from '@/shared/coverage.mjs';
import {ALL_LANDS} from '@/shared/lands.mjs';
import {mergeJob} from '@/shared/pipeline-job.mjs';
import {AdminTimeline} from '@/components/admin-timeline';
import {fetchDashboard} from '@/components/admin-store';
import {SourceNotes} from '@/components/admin-source-notes';
import {AdminRunDebug} from '@/components/admin-run-debug';
import type {AdminDashboard,AdminSource,PipelineJob} from '@/shared/admin-types';
const n=(v:number)=>v.toLocaleString('de-DE');
const termHelp=(t:string)=>TERMS.find(x=>x.term===t)?.text;
const date=(s:string|null|undefined)=>s?new Date(s).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'}):'Noch nicht erfasst';
const kindNames:Record<string,string>={summary:'KI-Zusammenfassung',aiLabel:'KI-Sachgebiet aus dem Inhalt',keywords:'Zehn gewichtete Stichwörter'};
const stateNames:Record<string,string>={queued:'Ausstehend',running:'Läuft',completed:'Gespeichert',partial:'Teilstand gespeichert',failed:'Fehlgeschlagen',unavailable:'Keine Quelle',unknown:'Ausgang prüfen',cancelled:'Beendet'};
// Look-back windows for stage 01; the same keys are validated on the server.
const windowItems=Object.entries(HISTORY_WINDOWS).map(([id,w])=>[id,w.label]) as [string,string][];
const windowLabel=(id?:string)=>windowItems.find(([key])=>key===id)?.[1]||'';
// Over HTTP/1.1 (the tunnel) a browser opens six connections to one server. The page then uses four of them for requests
// that each run six imports side by side on the server (24 at once, the server's own limit) and keeps two free for
// status, pause and overview. Such a request ends only when its slowest import is stored, and its other lanes idle
// meanwhile. Over HTTP/2 or HTTP/3 (Caddy) the requests share one connection: 24 requests with one lane each never wait
// for one another.
const RUNNERS:Record<string,{requests:number;lanes:number}>={metadata:{requests:4,lanes:6},analysis:{requests:1,lanes:1}};
const MULTIPLEXED={requests:24,lanes:1};
const multiplexed=()=>{try{return /^h[23]/.test((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined)?.nextHopProtocol||'');}catch{return false;}};
const runnerFor=(stage:string)=>stage==='metadata'&&multiplexed()?MULTIPLEXED:RUNNERS[stage]||RUNNERS.analysis;
// Order of the areas in the result list of a job: what needs attention comes first. The list shows this many rows.
const JOB_ORDER=['running','failed','unknown','partial','queued','completed','unavailable'],JOB_ROWS=60;
// List filters; "filter" in the address of the page preselects one (links of the overview and quality pages).
const FILTERS:[string,string][]=[['all','Alle Gebiete'],['connected','Mit angebundener Quelle'],['data','Mit Berichten'],['empty','Angebunden, ohne Berichte'],['issues','Mit Hinweisen oder Lücken'],['partial','Teilstand'],['stale','Älter als 7 Tage'],['failed','Letzter Abruf fehlgeschlagen'],['shallow','Berichte reichen unter 3 Monate zurück'],['quiet','Seit über 90 Tagen keine Sitzung'],['selected','Ausgewählt']];
// "shallow" and "quiet" judge the meeting days of the stored reports (shared/coverage.mjs): candidates for a longer
// look-back window, or for a check of the source.
const matchesFilter=(s:AdminSource,filter:string,selected:Set<string>,today:string)=>filter==='all'||filter==='connected'&&s.canImport||filter==='data'&&s.count>0||filter==='empty'&&s.canImport&&!s.count||filter==='issues'&&(s.attention||(s.issueCount||0)>0)||filter==='partial'&&s.partial||filter==='stale'&&s.stale||filter==='failed'&&s.attemptStatus==='failed'||filter==='shallow'&&s.canImport&&s.count>0&&['w','m1'].includes(reachBucket(s.firstEventAt,today))||filter==='quiet'&&s.canImport&&s.count>0&&['d180','old'].includes(freshBucket(s.lastEventAt,today))||filter==='selected'&&selected.has(s.id);
// retry: reads and the steps of a job may be asked again when the server does not answer properly (it restarts, or a reply is
// not JSON at all: an error page). The state of the job is kept on the server, so a repeated step only continues it. onWait
// reports that the page is waiting for the server.
async function api(url:string,body?:unknown,retry?:{onWait?:(waiting:boolean)=>void}):Promise<any>{
 for(let attempt=0;;attempt++){
  let failure='';
  try{
   const r=await fetch(url,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{} )});
   let data:any=null;try{data=await r.json();}catch{/* not JSON: an error page of the server */}
   if(data&&r.ok){retry?.onWait?.(false);return data;}
   if(data?.error)throw Error(data.error);
   failure=`Der Server hat nicht richtig geantwortet (HTTP ${r.status}).`;
  }catch(e){if(!(e instanceof TypeError))throw e;failure='Der Server ist nicht erreichbar.';}
  if(!retry||attempt>=8){retry?.onWait?.(false);throw Error(failure+' Der Auftrag bleibt gespeichert. Wenn der Server neu startet, dort „Auftrag fortsetzen“ klicken; antwortet er danach weiter mit Fehler 500, ihn beenden und neu starten (npm run dev).');}
  retry.onWait?.(true);await new Promise(done=>setTimeout(done,10000));
 }
}
function download(data:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
// initialSelection: areas handed over by the estimate page ("/admin?auswahl=…") as candidates for a twelve-month import.
export function AdminProcessing({initial,initialSelection=[],initialFilter}:{initial:AdminDashboard;displayName?:string;signOutPath?:string;initialSelection?:string[];initialFilter?:string}){
 const [data,setData]=useState(initial),[selected,setSelected]=useState<Set<string>>(new Set(initialSelection)),[query,setQuery]=useState(''),[filter,setFilter]=useState(initialFilter||'all'),[layer,setLayer]=useState('city'),[mode,setMode]=useState('coverage'),[page,setPage]=useState(1);
 const [busy,setBusy]=useState(''),[running,setRunning]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(initialSelection.length?`${initialSelection.length} Gebiete aus der Hochrechnung ausgewählt. Für ein vollständiges Jahr ist in Stufe 01 der Zeitraum „12 Monate“ eingestellt; der Abruf startet erst auf Klick in Stufe 01.`:''),[job,setJob]=useState(initial.processing.job),[kinds,setKinds]=useState(['summary','aiLabel','keywords']),[batchSize,setBatchSize]=useState('10'),[retryBlocked,setRetryBlocked]=useState(false);
 const [lookback,setLookback]=useState(initialSelection.length?'12m':'1m'),[scope,setScope]=useState<'selection'|'sources'>('selection'),[land,setLand]=useState('all'),[jobFilter,setJobFilter]=useState('all');
 // Stage 03 chooses its areas and look-back window on its own, like stage 01: e.g. all of Germany, but only one day.
 const [aiScope,setAiScope]=useState<'selection'|'all'>('selection'),[aiWindow,setAiWindow]=useState('all');
 const [aiPreview,setAiPreview]=useState<{articles:number;steps:Record<string,number>;blocked:number;exported:number}|null>(null),[aiPreviewState,setAiPreviewState]=useState<'idle'|'loading'|'error'>('idle');
 const pause=useRef(false),file=useRef<HTMLInputElement>(null);
 const chosen=data.sources.filter(s=>selected.has(s.id)),total=chosen.reduce((a,s)=>a+s.count,0),count=(key:string)=>chosen.reduce((a,s)=>a+Number(s.processing[key as keyof typeof s.processing]||0),0);
 // The list is filtered again only when what it depends on changes (not with every render of the page, e.g. while a job reports);
 // the search text is lower-cased once.
 const asOfDay=String(data?.asOf||'').slice(0,10);
 const visible=useMemo(()=>{const q=query.toLocaleLowerCase('de-DE');return data.sources.filter(s=>s.kind===layer&&(land==='all'||s.land===land)&&(!q||(s.name+' '+s.ags).toLocaleLowerCase('de-DE').includes(q))&&matchesFilter(s,filter,selected,asOfDay));},[data.sources,layer,land,query,filter,selected,asOfDay]);
 const toggle=(id:string)=>setSelected(prev=>{const next=new Set(prev);if(next.has(id))next.delete(id);else next.add(id);return next;});
 const busySource=busy!==''||running||!!data.importBusyUntil;
 // The timeline is read again after a job or an action (refresh), not with every reload beside a running job.
 const [timelineVersion,setTimelineVersion]=useState(0),[notice,setNotice]=useState('');
 async function refresh(){const next:AdminDashboard=await fetchDashboard();setData(next);setJob(next.processing.job);setTimelineVersion(v=>v+1);return next;}
 async function action(name:string,fn:()=>Promise<void>){setBusy(name);setError('');setMessage('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Aktion fehlgeschlagen.');}finally{setBusy('');}}
 async function drain(start:PipelineJob){
  pause.current=false;setRunning(true);
  const runner=runnerFor(start.stage);
  let latest=start,stopped=false,reloading=false,reloaded=Date.now(),rest=60000;
  // Replies of parallel requests can arrive out of order, and most list only the areas changed since the state the
  // page named; mergeJob keeps the newest state of every area and of the job.
  const show=(next:PipelineJob)=>{latest=mergeJob(latest,next) as PipelineJob;setJob(latest);};
  const call=(action:string,extra:Record<string,unknown>={}):Promise<PipelineJob>=>api('/api/admin/pipeline',{action,id:start.id,since:latest.updatedAt,...extra},{onWait:waiting=>setNotice(waiting?'Der Server antwortet gerade nicht. Der Abruf versucht es gleich noch einmal und macht dort weiter, wo er war.':'')});
  const open=()=>!pause.current&&!['completed','cancelled'].includes(latest.status);
  // The overview reads every stored report and keeps the database busy meanwhile, so the running steps and every
  // other page wait for it. Beside a job it is reloaded at most once a minute and takes at most a tenth of the time;
  // the progress of the job itself comes with the answers of the steps.
  const reload=()=>{if(reloading||Date.now()-reloaded<rest)return;reloading=true;const began=Date.now();void fetchDashboard().then((next:AdminDashboard)=>setData(next)).catch(()=>{}).finally(()=>{reloading=false;reloaded=Date.now();rest=Math.max(60000,10*(reloaded-began));});};
  // One request runs several imports side by side on the server and returns when they are stored.
  const worker=async()=>{try{while(open()){
   const next=await call('run',{lanes:runner.lanes});show(next);
   // The server pauses rule labelling itself when another process holds the stock. Imports are set back on the server
   // instead (a server asked for a pause, an area is being imported elsewhere); then the page asks again at heldUntil.
   if(next.paused)pause.current=true;
   else if(next.wait&&next.heldUntil){const until=Date.parse(next.heldUntil);setNotice(`Wartet auf Server, die um eine Pause gebeten haben, oder auf zurückgestellte Gebiete; weiter ab ${new Date(until).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})} Uhr.`);await new Promise(done=>setTimeout(done,Math.min(30000,Math.max(2500,until-Date.now()))));}
   else if(next.wait){setNotice('Wartet, bis die laufenden Abrufe gespeichert sind. Ein unterbrochener Abruf wird nach fünf Minuten freigegeben.');await new Promise(done=>setTimeout(done,2500));}else setNotice('');
   reload();
  }}catch(e){pause.current=true;throw e;}};
  // Between the answers of those requests the progress is asked for.
  const watch=async()=>{while(!stopped){await new Promise(done=>setTimeout(done,4000));if(stopped)break;try{show(await call('status'));}catch{}}};
  try{
   // A job paused earlier (by the operator or by the server) takes areas again from here on.
   show(await call('resume'));void watch();
   const outcomes=await Promise.allSettled(Array.from({length:runner.requests},worker));
   stopped=true;
   const conflict=latest.stage==='analysis'&&latest.items.some(i=>i.status==='queued'&&i.message?.includes('läuft bereits'));
   await refresh();
   const failed=outcomes.find(o=>o.status==='rejected');if(failed)throw (failed as PromiseRejectedResult).reason;
   if(conflict)setMessage('Andere Verarbeitung läuft. Später ausdrücklich fortsetzen.');else if(!pause.current)setMessage('Auftrag beendet. Teilstände und Fehler stehen im Verlauf unten.');
  }finally{stopped=true;setRunning(false);setNotice('');}
 }
 const activeJob=job&&!['completed','cancelled'].includes(job.status);
 // Rule labelling: the figures of the whole stock (every area of the page, not only the selection) and of the job.
 const labelJob=!!job&&job.stage==='analysis',allTotal=data.sources.reduce((a,s)=>a+s.count,0),allRules=data.sources.reduce((a,s)=>a+Number(s.processing.rules||0),0),allOpen=Math.max(0,allTotal-allRules),jobProcessed=job?job.items.reduce((a,i)=>a+i.processed,0):0;
 // Rule labelling over the whole stock: the reports up to the cursor of all stored (server/integrations/pipeline-jobs.mjs), not the counter
 // of changed reports, which also counts what the triggers of the database write.
 const labelItem=job?.items.find(i=>i.region==='all'),labelTotal=Number(labelItem?.total||0),labelDone=Math.min(Number(labelItem?.position||0),labelTotal),labelPct=labelTotal?Math.round(100*labelDone/labelTotal):0;
 // Pause: no further package or area is claimed; what runs is stored first. Resume continues behind it (cursor).
 const pauseJob=()=>{if(!job)return;pause.current=true;void api('/api/admin/pipeline',{action:'pause',id:job.id}).catch(()=>{});setMessage(labelJob?'Pause angefordert. Das laufende Paket wird noch gespeichert; „Fortsetzen“ macht dahinter weiter.':'Pause angefordert. Die laufenden Abrufe werden noch beendet und gespeichert.');};
 const resumeJob=()=>{if(job)void action('resume',()=>drain(job));};
 const cancelJob=async()=>{if(!job)return;if(!await confirmDialog({title:'Offenen Auftrag beenden?',text:'Bereits Gespeichertes bleibt erhalten; noch nicht begonnene Gebiete werden nicht mehr abgerufen.',confirmLabel:'Beenden'}))return;void action('cancel',async()=>{setJob(await api('/api/admin/pipeline',{action:'cancel',id:job.id}));});};
 const cancelAi=async(id:string)=>{if(!await confirmDialog({title:'KI-Auftrag verwerfen?',text:'Die reservierten Berichte werden wieder frei, stehen aber hinter bisher nicht exportierten Berichten. Vorhandene Analyseergebnisse bleiben erhalten.',confirmLabel:'Verwerfen'}))return;void action('cancel-ai',async()=>{await api('/api/admin/ai-job',{action:'cancel',id});await refresh();});};
 // scope 'sources': every area with a connected source in all states, whatever is selected on the page; such a start
 // ends an open job (replace), which its label says beforehand. scope 'all' (rule labelling): every open report of the
 // stock as one item, package after package. Otherwise the selection of map and list.
 async function start(stage:string,scope?:'sources'|'all'){await action(scope||stage,async()=>{const next=await api('/api/admin/pipeline',{action:'create',stage,regions:scope||[...selected],...(stage==='metadata'?{window:lookback}:{}),...(scope&&activeJob?{replace:true}:{})});setJob(next);await drain(next);});}
 const connected=data.sources.filter(s=>s.canImport).length,connectedChosen=chosen.filter(s=>s.canImport).length;
 const openAreas=job?job.items.filter(i=>i.status==='queued'||i.status==='running').length:0;
 const jobCounts:Record<string,number>={};for(const i of job?.items||[])jobCounts[i.status]=(jobCounts[i.status]||0)+1;
 const jobDone=(job?.items.length||0)-(jobCounts.queued||0)-(jobCounts.running||0),jobShown=jobFilter!=='all'&&!jobCounts[jobFilter]?'all':jobFilter;
 const jobRows=job?job.items.filter(i=>jobShown==='all'||i.status===jobShown).sort((a,b)=>JOB_ORDER.indexOf(a.status)-JOB_ORDER.indexOf(b.status)):[];

 async function downloadAi(id:string){
  let combined:any=null,offset=0;
  do{
   const part=await api('/api/admin/ai-job?id='+encodeURIComponent(id)+'&offset='+offset);
   if(!part||part.id!==id||!Array.isArray(part.articles))throw Error('Auftrag konnte nicht geladen werden.');
   if(!combined)combined={...part,articles:[]};
   if(!part.articles.length&&offset<part.articleCount)throw Error('Auftrag ist unvollständig. Bitte erneut herunterladen.');
   combined.articles.push(...part.articles);offset=combined.articles.length;
   setMessage(`${n(offset)} / ${n(part.articleCount??offset)} Berichte des Auftrags geladen …`);
  }while(offset<(combined.articleCount??offset));
  download(combined,'plenara-ki-auftrag-'+id+'.json');
 }
 // The same settings for the preview and the job.
 const aiRequest=()=>({regions:aiScope==='all'?'all':[...selected],...(aiWindow!=='all'?{window:aiWindow}:{}),kinds,limit:batchSize==='all'?'all':Number(batchSize),retryBlocked});
 // Preview: how many reports a job with these settings would take (counted on the server, nothing is reserved). Asked
 // again shortly after the last change; an older answer arriving late is dropped.
 const previewSeq=useRef(0),aiRevision=data.processing.revision,aiJobKey=data.processing.aiJob?.id+':'+data.processing.aiJob?.status;
 useEffect(()=>{
  const seq=++previewSeq.current;
  if(!kinds.length||aiScope==='selection'&&!selected.size){setAiPreview(null);setAiPreviewState('idle');return;}
  setAiPreviewState('loading');
  const timer=setTimeout(()=>{api('/api/admin/ai-job',{action:'preview',...aiRequest()}).then(p=>{if(seq===previewSeq.current){setAiPreview(p);setAiPreviewState('idle');}}).catch(()=>{if(seq===previewSeq.current)setAiPreviewState('error');});},300);
  return ()=>clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[aiScope,aiWindow,kinds,batchSize,retryBlocked,selected,aiRevision,aiJobKey]);
 async function makeAi(){await action('ai',async()=>{
  const next=await api('/api/admin/ai-job',{action:'create',...aiRequest()});
  try{
   if(next.articleCount)await downloadAi(next.id);
   const held=next.blocked?` ${n(next.blocked)} Berichte ohne erneuten Versuch, weil ihre Quelle nicht ausreichte und sich seitdem nicht geändert hat.`:'';
   setMessage(next.articleCount?`${n(next.articleCount)} Berichte mit ${n(next.requestedSteps??next.articleCount)} fehlenden Einzelschritten reserviert.${next.sharedSources?.length?` ${n(next.sharedSources.length)} Quellen nutzen mehrere Berichte gemeinsam; der Agent liest sie nur einmal.`:''}${next.quickChecks?` ${n(next.quickChecks)} Berichte ohne Vorlage oder Anlage erhalten nur eine Schnellprüfung.`:''} Starten Sie den heruntergeladenen Auftrag mit dem KI-Agenten Ihrer Wahl in Ihrem Projekt. Teilergebnisse können nacheinander eingelesen werden.${held}`:`${aiScope==='all'?'In ganz Deutschland':'In der Auswahl'}${aiWindow!=='all'?` mit Sitzungen ab ${windowLabel(aiWindow)} zurück`:''} stehen für diese KI-Schritte keine Berichte aus.${held}`);
  }finally{await refresh();}
 });}
 async function importAi(f:File){await action('ai-import',async()=>{
  if(f.size>100000000)throw Error('Datei größer als 100 MB. Ergebnisse in mehrere Dateien mit derselben jobId aufteilen.');
  const batches=splitAiResultBatches(JSON.parse(await f.text()));
  let applied=0,skipped=0,conflicts=0,ignored=0;
  try{
   for(let i=0;i<batches.length;i++){
    const receipt=await api('/api/admin/ai-job',{action:'apply',result:batches[i]});
    applied+=receipt.applied;skipped+=receipt.skipped;conflicts+=receipt.conflicts.length;ignored+=receipt.ignored||0;
    setMessage(`Paket ${i+1} / ${batches.length} geprüft · ${n(applied)} Berichte gespeichert · ${n(skipped)} bereits vorhanden · ${n(conflicts)} Konflikte.`);
   }
   setMessage(`${n(applied)} Berichte gespeichert und zurückgelesen · ${n(skipped)} bereits vorhanden · ${n(conflicts)} Konflikte.${ignored?` ${n(ignored)} nicht angeforderte Einzelergebnisse ignoriert.`:''} Noch nicht gelieferte Berichte bleiben reserviert.`);
  }catch(e){throw Error(`Übernahme unterbrochen: ${n(applied)} Berichte gespeichert, ${n(skipped)} bereits vorhanden, ${n(conflicts)} Konflikte. Dieselbe Datei kann erneut eingelesen werden. ${e instanceof Error?e.message:''}`);}
  finally{await refresh();}
 });}
 const aiJob=data.processing.aiJob;
 // Figures of stage 03 for the chosen areas; the look-back window is applied only when the job is prepared.
 const aiTotal=aiScope==='all'?allTotal:total,aiCount=(key:string)=>aiScope==='all'?data.sources.reduce((a,s)=>a+Number(s.processing[key as keyof typeof s.processing]||0),0):count(key);
 const startLabel=scope==='sources'?(activeJob?`Offenen Auftrag beenden und alle ${n(connected)} Quellen abrufen`:`Alle ${n(connected)} Quellen abrufen`):`${n(connectedChosen)} ausgewählte ${connectedChosen===1?'Quelle':'Quellen'} abrufen`;
 const T=(id:string,fallback:string)=>HELP[id]?.title||fallback,refreshing=busy==='refresh';
 // "Alle angebundenen Quellen" belegen die Datenbank lange: erst nach einer Rückfrage.
 async function startMetadata(){
  if(scope==='sources'&&!await confirmDialog({title:'Alle angebundenen Quellen abrufen?',text:`Der Abruf liest ${n(connected)} Gebiete und belegt die Datenbank, solange er läuft. Sie können jederzeit pausieren; Gespeichertes bleibt.`,confirmLabel:'Abruf starten'}))return;
  void start('metadata',scope==='sources'?'sources':undefined);
 }
 const jobTitle=job?(job.stage==='metadata'?(job.scope==='sources'?'Abruf aller Quellen in Deutschland':'Abrufauftrag')+(job.window?' · '+windowLabel(job.window)+' rückwirkend':''):job.scope==='all'?'Einordnung nach Regeln · alle offenen Berichte':'Einordnung nach Regeln'):'';
 return <>
  <AdminPageHead page="abruf"><StandLine stand={data.stand??null} busy={refreshing} action="Aktualisieren" onAction={()=>{if(!busy&&!running)void action('refresh',async()=>{await refresh();});}}/></AdminPageHead>
  <div className={'transition-opacity '+(refreshing?'opacity-60':'')}>
  <div className="mt-8"><Kpis label="Kennzahlen Abruf und Verarbeitung" items={[
   {label:'Berichte gespeichert',value:n(data.counts.online),note:`Doppelungen einmal gezählt · Revision ${n(data.processing.revision)}`,title:'Revision: laufende Nummer des Datenbestands; sie steigt mit jedem Speichern, auch bei einem Abruf ohne neue Berichte.'},
   {label:'Gebiete mit Berichten',value:n(data.sources.filter(s=>s.count>0).length),of:n(data.sources.length),note:`${n(connected)} angebunden · davon ${n(data.sources.filter(s=>s.canImport&&!s.count).length)} noch ohne Berichte`},
   {label:'Letzter Abruf fehlgeschlagen',value:n(data.sources.filter(s=>s.attemptStatus==='failed').length),note:'Gebiete; die zuvor gespeicherten Berichte bleiben erhalten'},
   {label:'Ihre Auswahl',value:n(chosen.length),note:`${n(total)} Berichte · ${n(chosen.filter(s=>!s.canImport).length)} ohne angebundene Quelle; sie erscheinen im Auftrag als „Keine Quelle“`}]}/></div>
  {error&&<Alert>{error}</Alert>}{message&&<p role="status" className="admin-notice">{message}</p>}{notice&&<p role="status" className="admin-notice">{notice}</p>}
  <section className="admin-territories" id="abruf-gebiete"><div className="admin-section-heading"><h2>{T('abruf.gebiete','Gebiete auswählen')}</h2><div className="admin-selection-actions"><span className="admin-note">{n(chosen.length)} ausgewählt</span><button type="button" className="btn-secondary btn-sm" disabled={running||!chosen.length} onClick={()=>setSelected(new Set())}>Auswahl leeren</button></div></div>
  <SectionHelp id="abruf.gebiete"/>
  <div className="admin-geography"><div><div className="admin-source-controls"><AdminChoice id="abruf-land" label="Bundesland" value={land} onChange={s=>{setLand(s);setPage(1);}} items={[["all","Alle Länder"],...ALL_LANDS.map(l=>[l.id,l.name] as [string,string])]}/><AdminChoice id="abruf-ebene" label="Kartenebene" value={layer} onChange={s=>{setLayer(s);setPage(1);}} items={[["city","Städte & Gemeinden"],["district","Kreise"]]}/><div style={{gridColumn:'1 / -1'}}><AdminChoice id="abruf-karte" label="Kartenfarbe" value={mode} onChange={setMode} items={[["coverage","Zustand des letzten Abrufs"],["reach","Rückreichweite"],["fresh","Jüngste Sitzung"],["access","Zugang (OParl, API, HTML, Sperren)"],["count","Anzahl Berichte"],["rules","Anteil nach Regeln bearbeitet"],["summary","Anteil mit KI-Zusammenfassung"],["aiLabel","Anteil mit KI-Sachgebiet aus dem Inhalt"],["keywords","Anteil mit zehn KI-Stichwörtern"]]} help={MAP_HELP[mode]}/></div></div><AdminProcessingMap sources={data.sources} selected={selected} onToggle={toggle} layer={layer} mode={mode} land={land}/></div>
   <div className="admin-region-list"><div className="admin-source-controls"><div className="min-w-0"><label htmlFor="abruf-suche" className="field-label mb-1 block">Ort oder Gemeindeschlüssel</label><input id="abruf-suche" type="search" autoComplete="off" className="field-input" value={query} placeholder="Billerbeck, Coesfeld …" onChange={e=>{setQuery(e.target.value);setPage(1);}}/></div><AdminChoice id="abruf-filter" label="Liste filtern" value={filter} onChange={s=>{setFilter(s);setPage(1);}} items={FILTERS} help={FILTER_HELP[filter]}/></div><div className="admin-list-meta"><span>{n(visible.length)} Treffer</span><button type="button" className="link-btn" disabled={running||!visible.length} onClick={()=>setSelected(prev=>new Set([...prev,...visible.map(s=>s.id)]))}>Alle {n(visible.length)} Treffer auswählen</button></div>
   <div className="admin-source-list">{visible.slice((page-1)*10,page*10).map(s=><div className={'admin-source-item'+(selected.has(s.id)?' is-selected':'')} key={s.id}><label><input type="checkbox" className="h-4 w-4 shrink-0 accent-teal-600" checked={selected.has(s.id)} onChange={()=>toggle(s.id)} aria-label={s.name+' auswählen'}/><span><strong>{s.name}</strong><small>{s.accessLabel||(s.method==='oparl'?'OParl':s.method==='pending'?'Keine Quelle':'RIS')}{s.access==='api'&&s.channel?' ('+s.channel+')':''} · <span title={STATE_HELP[s.state]}>{s.state}</span></small></span><b>{n(s.count)}<small>Berichte</small></b></label><div className="admin-source-meta"><span title={termHelp('Übernahme')}>Übernahme</span> {date(s.lastSuccessAt)} · <span title={termHelp('Letzter Versuch')}>Letzter Versuch</span> {date(s.lastAttemptAt)}{s.count>0&&<> · Sitzungen {mm(s.firstEventAt)} bis {mm(s.lastEventAt)}</>}</div><details><summary>Verarbeitung & Quellenhinweise</summary><dl>{[['rules','Nach Regeln bearbeitet'],['summary','KI-Zusammenfassung'],['aiLabel','KI-Sachgebiet aus dem Inhalt'],['keywords','Zehn KI-Stichwörter aus dem Inhalt']].map(([k,label])=><div key={k}><dt>{label}</dt><dd>{n(Number(s.processing[k as keyof typeof s.processing]||0))} / {n(s.count)}</dd></div>)}</dl><p className="text-[12px] text-slate-500">Die drei KI-Zahlen zählen nur, was aus dem Inhalt der Unterlagen entstand; der frühere Titeltest zählt hier nicht.</p><p>Letzte Bearbeitung: {date(s.processing.processedAt)}</p><p className="text-[12px] text-slate-500">Hinweise: Der Abruf meldet, dass etwas fehlt oder nicht gelesen wurde. Warnungen: Auffälligkeiten, die den Abruf nicht unvollständig machen.</p><SourceNotes id={s.id} issueCount={s.issueCount||0} warningCount={s.warningCount||0}/><a href={'/quellen?region='+s.id}>Quellen ansehen</a> · <a href={adminHref('atlas')}>Im Lückenatlas</a>{s.canImport&&<AdminRunDebug region={s.id} name={s.name}/>}</details></div>)}{!visible.length&&<p className="admin-empty">Keine passenden Gebiete.</p>}</div><div className="admin-list-meta"><button type="button" className="btn-secondary btn-sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>← Zurück</button><span>{page} / {Math.max(1,Math.ceil(visible.length/10))}</span><button type="button" className="btn-secondary btn-sm" disabled={page*10>=visible.length} onClick={()=>setPage(p=>p+1)}>Weiter →</button></div></div></div>
  </section>
  <section className="admin-pipeline" id="abruf-stufen"><div className="admin-section-heading"><h2>{T('abruf.stufen','Drei Stufen, jede startet nur auf Klick')}</h2><span>{n(chosen.length)} Gebiete · {n(total)} Berichte in der Auswahl</span></div><SectionHelp id="abruf.stufen"/>
   <div className="admin-stage-grid"><section className="admin-stage"><div className="admin-stage-number">01</div><h3>Amtliche Daten abrufen</h3><p>Öffentliche Vorgänge, Sitzungen, Gremien, Ergebnisse und Originalverweise aus OParl, Schnittstellen oder den öffentlichen Seiten der Ratssysteme.</p><AdminChoice id="abruf-gebiete-wahl" label="Welche Gebiete" value={scope} onChange={s=>setScope(s as 'selection'|'sources')} items={[["selection",`Ihre Auswahl (${n(connectedChosen)} mit Quelle${chosen.length-connectedChosen?`, ${n(chosen.length-connectedChosen)} ohne`:''})`],["sources",`Alle angebundenen Quellen (${n(connected)})`]]}/><AdminChoice id="abruf-zeitraum" label="Zeitraum rückwirkend" value={lookback} onChange={setLookback} items={windowItems}/><small>Sitzungen ab {windowLabel(lookback)} zurück und bereits veröffentlichte Folgesitzungen. Ältere gespeicherte Berichte bleiben erhalten.{["12m","24m"].includes(lookback)&&" Große Gebiete werden in mehreren Teilen gelesen; ein Teilstand wird vom nächsten Auftrag mit demselben Zeitraum fortgesetzt."}</small><button type="button" className="btn-primary" disabled={busySource||(scope==='selection'?!!activeJob||!connectedChosen:!connected)} onClick={()=>void startMetadata()}>{startLabel}</button>{scope==='sources'&&activeJob&&!running&&<small>Der offene Auftrag ({job?.stage==='metadata'?'Abruf, '+windowLabel(job?.window):'Einordnung nach Regeln'}, {n(openAreas)} Gebiete ausstehend) wird dabei beendet; Gespeichertes bleibt erhalten.</small>}{scope==='selection'&&activeJob&&!running&&<small>Erst den offenen Auftrag unten fortsetzen oder beenden.</small>}{running&&<small>Ein Auftrag läuft. Unten pausieren und warten, bis die laufenden Abrufe gespeichert sind.</small>}</section>
   <section className="admin-stage"><div className="admin-stage-number">02</div><h3>Nach Regeln einordnen</h3><p>Feste Regeln ordnen jeden Bericht anhand seines amtlichen Titels einem Sachgebiet zu und zerlegen den Titel in Begriffe für den Vergleich zwischen Gebieten. Ohne KI, ohne Kosten. Jedes Paket von 500 Berichten wird sofort gespeichert; Sie können jederzeit pausieren und später dort fortsetzen.</p><strong>{n(allRules)} von {n(allTotal)} Berichten nach Regeln bearbeitet</strong><progress value={allRules} max={allTotal||1} aria-label="Nach Regeln bearbeitete Berichte"/><small>{n(allOpen)} offen · gilt für den ganzen Bestand, nicht nur für Ihre Auswahl{labelJob&&labelTotal?` · ${n(labelDone)} von ${n(labelTotal)} Berichten in diesem Auftrag durchgesehen`:''}{labelJob&&running?' · läuft':labelJob&&activeJob?' · pausiert':''}.</small>
   {labelJob&&running?<button type="button" className="btn-secondary btn-sm" onClick={pauseJob}>Nach dem laufenden Paket pausieren</button>
   :labelJob&&activeJob?<div className="admin-selection-actions"><button type="button" className="btn-primary" disabled={!!busy} onClick={resumeJob}>Fortsetzen</button><button type="button" className="btn-secondary btn-sm btn-danger" disabled={!!busy} onClick={()=>void cancelJob()}>Beenden</button></div>
   :<button type="button" className="btn-secondary btn-sm" disabled={busySource||!!activeJob||!allOpen} onClick={()=>void start('analysis','all')}>Alle offenen Berichte einordnen</button>}
   {!activeJob&&!running&&selected.size>0&&total-count('rules')>0&&<small><button type="button" className="link-btn" disabled={busySource} onClick={()=>void start('analysis')}>Nur die Auswahl: {n(total-count('rules'))} offene Berichte in {n(selected.size)} Gebieten</button></small>}
   {activeJob&&!labelJob&&<small>Erst den offenen Abrufauftrag unten fortsetzen oder beenden.</small>}</section>
   <section className="admin-stage admin-stage-ai"><div className="admin-stage-number">03</div><h3>KI-Inhalte erarbeiten</h3><p>Ein KI-Agent Ihrer Wahl liest die Originalunterlagen der gewählten Berichte. Sie laden den Auftrag herunter, starten ihn selbst in Ihrem Projekt und lesen das Ergebnis hier wieder ein.</p><AdminChoice id="abruf-ki-gebiete" label="Welche Gebiete" value={aiScope} onChange={s=>setAiScope(s as 'selection'|'all')} items={[["selection",`Ihre Auswahl (${n(chosen.length)} Gebiete, ${n(total)} Berichte)`],["all",`Ganz Deutschland (${n(allTotal)} Berichte)`]]}/><AdminChoice id="abruf-ki-zeitraum" label="Zeitraum rückwirkend" value={aiWindow} onChange={setAiWindow} items={[["all","Alle gespeicherten Berichte"],...windowItems]}/><small>{aiWindow==='all'?'Ohne Einschränkung nach Sitzungstag.':`Berichte mit einer Sitzung ab ${windowLabel(aiWindow)} zurück und bereits angesetzte Folgesitzungen. Die Zahlen bei den Schritten gelten ohne Zeitraum, die Vorschau über dem Knopf mit.`}</small><div className="admin-ai-kinds">{Object.entries(kindNames).map(([k,label])=><label key={k}><input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600" checked={kinds.includes(k)} onChange={e=>setKinds(prev=>e.target.checked?[...prev,k]:prev.filter(x=>x!==k))}/><span>{label}<small>{n(aiCount(k))} von {n(aiTotal)} gespeichert{aiCount('blocked_'+k)>0&&` · ${n(aiCount('blocked_'+k))} ohne ausreichende Quelle`}</small></span></label>)}</div><How label="Was heißt „ohne ausreichende Quelle“?"><p>Ein früherer Versuch fand zu wenig lesbaren Text, etwa nur einen Titel oder einen Scan. Diese Berichte werden erst wieder angefordert, wenn sich ihre Quelldaten ändern – oder mit dem Haken „erneut versuchen“, der nur nach einer Änderung am Verfahren sinnvoll ist.</p></How><AdminChoice id="abruf-ki-menge" label="Berichte je KI-Auftrag" value={batchSize} onChange={setBatchSize} items={[["10","10 · Testlauf"],["25","25 Berichte"],["50","50 Berichte"],["100","100 Berichte"],["all","Alle offenen Berichte"]]}/><label className="admin-ai-retry"><input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600" checked={retryBlocked} onChange={e=>setRetryBlocked(e.target.checked)}/><span>Berichte ohne ausreichende Quelle erneut versuchen</span></label><div className="admin-ai-preview" role="status" aria-live="polite">{aiPreviewState==='error'?<small>Vorschau nicht verfügbar. Der Auftrag lässt sich trotzdem vorbereiten.</small>:aiPreview?<><strong className={aiPreviewState==='loading'?'opacity-60':''}>{aiPreview.exported?`${n(aiPreview.exported)} ${aiPreview.exported===1?'Bericht würde':'Berichte würden'} exportiert`:'Keine Berichte offen'}</strong><small>{aiPreview.exported<aiPreview.articles?`von ${n(aiPreview.articles)} offenen Berichten mit ${n(Object.values(aiPreview.steps).reduce((a,v)=>a+v,0))} fehlenden Einzelschritten; der Rest bleibt für weitere Aufträge`:`${n(Object.values(aiPreview.steps).reduce((a,v)=>a+v,0))} fehlende Einzelschritte`}{aiPreview.blocked?` · ${n(aiPreview.blocked)} ohne ausreichende Quelle zurückgehalten`:''}</small></>:aiPreviewState==='loading'?<small>Berichte werden gezählt …</small>:null}</div><button type="button" className="btn-secondary btn-sm" disabled={busySource||!aiTotal||!kinds.length||aiJob?.status==='prepared'||aiPreview?.articles===0} onClick={makeAi}>KI-Auftrag vorbereiten</button><small>Je Bericht werden nur die fehlenden Schritte angefordert, zuerst nie exportierte Berichte. Ein offener Auftrag reserviert seine Berichte bis zur Übernahme oder zum Verwerfen.</small></section></div>
  </section>
  {job&&<section className="admin-job" id="abruf-auftrag"><div className="admin-section-heading"><h2>{jobTitle}</h2><div className="admin-selection-actions">{running?<button type="button" className="btn-secondary btn-sm" onClick={pauseJob}>{labelJob?'Nach dem laufenden Paket pausieren':'Nach den laufenden Schritten pausieren'}</button>:activeJob&&<><button type="button" className="btn-primary" disabled={!!busy} onClick={resumeJob}>Auftrag fortsetzen</button><button type="button" className="btn-secondary btn-sm btn-danger" disabled={!!busy} onClick={()=>void cancelJob()}>Auftrag beenden</button></>}</div></div>
   <p className="mt-1 max-w-[820px] text-[14px] text-slate-500">{job.scope==='all'?(labelTotal?`${n(labelDone)} von ${n(labelTotal)} Berichten durchgesehen (${labelPct} %)`:'Der Fortschritt wird mit dem nächsten Paket berechnet'):`${n(jobDone)} / ${n(job.items.length)} Gebiete abgeschlossen`} · {running?`Läuft${jobCounts.running&&job.scope!=='all'?' · '+jobCounts.running+' gleichzeitig':''}`:activeJob?'Pausiert – wartet auf Ihren Start':'Beendet'}</p>
   <SectionHelp id="abruf.auftrag"/>
   <div className="mt-4">{job.scope==='all'?<progress className="admin-job-progress" value={labelDone} max={labelTotal||1} aria-label="Bearbeitete Berichte"/>:<progress className="admin-job-progress" value={jobDone} max={job.items.length||1} aria-label="Abgeschlossene Gebiete"/>}</div>
   <p className="admin-job-counts">{job.scope!=='all'&&JOB_ORDER.filter(s=>jobCounts[s]).map(s=><span key={s} title={JOB_STATE_HELP[stateNames[s]||s]}>{stateNames[s]||s}: <strong>{n(jobCounts[s])}</strong></span>)}<span>{labelJob?'Berichte durchgesehen':'Berichte gelesen'}: <strong>{n(labelJob?labelDone:jobProcessed)}</strong></span></p>
   {/* Ein bundesweiter Auftrag hat mehrere tausend Gebiete: gezeigt wird ein Ausschnitt, Auffälliges zuerst. */}
   <details open={running}><summary>Ergebnisse je Gebiet</summary><div className="admin-source-controls"><AdminChoice id="abruf-auftrag-zustand" label="Anzeigen" value={jobShown} onChange={setJobFilter} items={[["all","Alle – Laufendes und Auffälliges zuerst"],...JOB_ORDER.filter(s=>jobCounts[s]).map(s=>[s,stateNames[s]||s] as [string,string])]}/></div><ul className="admin-job-results">{jobRows.slice(0,JOB_ROWS).map(i=>{const name=data.sources.find(s=>s.id===i.region)?.name||(i.region==='all'?'Alle Gebiete':i.region);return <li key={i.region}><strong>{name}</strong><span title={JOB_STATE_HELP[stateNames[i.status]||i.status]}>{stateNames[i.status]||i.status} · {n(i.processed)} verarbeitet</span>{i.message&&<small>{i.message}</small>}{job.stage==='metadata'&&i.status!=='unavailable'&&i.status!=='queued'&&<AdminRunDebug region={i.region} name={name}/>}</li>;})}</ul>{jobRows.length>JOB_ROWS&&<p className="admin-note">{n(jobRows.length-JOB_ROWS)} weitere Gebiete sind nicht aufgeführt. „Anzeigen“ grenzt die Liste auf einen Zustand ein.</p>}</details></section>}
  {aiJob&&<section className="admin-job" id="abruf-kiauftrag"><div className="admin-section-heading"><h2>{T('abruf.kiauftrag','KI-Auftrag')}</h2></div><p className="admin-note">{aiJob.scope==='all'?'Ganz Deutschland':`${n(aiJob.regions.length)} ${aiJob.regions.length===1?'Gebiet':'Gebiete'}`}{aiJob.window?` · Sitzungen ab ${windowLabel(aiJob.window)} zurück`:''} · {aiJob.count} festgelegte Berichte{aiJob.steps!=null&&` · ${aiJob.steps} fehlende Einzelschritte`} · {aiJob.kinds.map(k=>kindNames[k]).join(', ')} · {aiJob.applied} Ergebnisse übernommen</p><p className="admin-note">{aiJob.status==='prepared'?'Reserviert – der Download allein ist keine erfolgreiche Bearbeitung. Geben Sie den Auftrag an Ihren KI-Agenten und lesen Sie die Ergebnisse hier ein; mehrere Teildateien sind möglich. Solange Berichte fehlen, bleibt der Auftrag offen.':aiJob.status==='cancelled'?'Auftrag verworfen. Die Berichte sind wieder verfügbar, stehen aber hinter bisher nicht exportierten Berichten. Vorhandene Analyseergebnisse bleiben erhalten.':'Ergebnisse übernommen. Fachliche Quellenlücken können weiterhin bestehen.'}</p><div className="admin-selection-actions"><button type="button" className="btn-secondary btn-sm" disabled={!!busy||running} onClick={()=>action('download-job',async()=>{await downloadAi(aiJob.id);setMessage('Auftrag erneut heruntergeladen. Die Berichtsauswahl bleibt unverändert.');})}>Auftrag herunterladen</button>{aiJob.status==='prepared'&&<><button type="button" className="btn-primary" disabled={busySource} onClick={()=>file.current?.click()}>Ergebnisse prüfen & speichern</button><button type="button" className="btn-secondary btn-sm btn-danger" disabled={busySource} onClick={()=>void cancelAi(aiJob.id)}>Auftrag verwerfen</button></>}<input ref={file} hidden type="file" accept="application/json,.json" onChange={e=>{const f=e.target.files?.[0];if(f)void importAi(f);e.target.value='';}}/></div><details><summary>Arbeitsauftrag an den KI-Agenten</summary><p>„Lies requirements/ai-processing.md und die heruntergeladene Auftragsdatei. Bearbeite nur die darin ausgewählten Artikel und Schritte. Erzeuge und validiere die Ergebnisdatei gemäß shared/ai-job.mjs.“</p></details></section>}
  <AdminTimeline selected={selected} version={timelineVersion}/>
  </div>
 </>;
}
