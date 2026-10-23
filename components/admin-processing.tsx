'use client';
import Link from 'next/link';
import {useEffect,useRef,useState,useMemo} from 'react';
import {adminHref} from '@/components/admin-chrome';
import {AdminPageHead,AdminChoice,Befund,Zahlen,Fehler,SectionHelp,StandLine} from '@/components/admin-ui';
import {FILTER_HELP,HELP,JOB_STATE_HELP,MAP_HELP,STATE_HELP,TERMS} from '@/components/admin-texts';
import {confirmDialog} from '@/components/ratsmonitor/components/ConfirmDialog';
import {AdminProcessingMap} from '@/components/admin-processing-map';
import {AdminRuns} from '@/components/admin-dashboard';
import {HISTORY_WINDOWS} from '@/shared/history-window.mjs';
import {reachBucket,freshBucket} from '@/shared/coverage.mjs';
import {ALL_LANDS} from '@/shared/lands.mjs';
import {mergeJob} from '@/shared/pipeline-job.mjs';
import {AdminTimeline} from '@/components/admin-timeline';
import {fetchDashboard} from '@/components/admin-store';
import {SourceNotes} from '@/components/admin-source-notes';
import {AdminRunDebug} from '@/components/admin-run-debug';
import type {AdminDashboard,AdminSource,PipelineJob} from '@/shared/admin-types';
import {n,mm} from '@/components/admin-format';
const termHelp=(t:string)=>TERMS.find(x=>x.term===t)?.text;
const date=(s:string|null|undefined)=>s?new Date(s).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'}):'Noch nicht erfasst';
const stateNames:Record<string,string>={queued:'Ausstehend',running:'Läuft',completed:'Gespeichert',partial:'Teilstand gespeichert',failed:'Fehlgeschlagen',unavailable:'Keine Quelle',unknown:'Ausgang prüfen',cancelled:'Beendet',deferred:'Zurückgestellt'};
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
const JOB_ORDER=['running','failed','unknown','partial','queued','deferred','completed','unavailable'],JOB_ROWS=60;
// List filters; "filter" in the address of the page preselects one (links of the overview and quality pages).
const FILTERS:[string,string][]=[['all','Alle Gebiete'],['connected','Mit angebundener Quelle'],['data','Mit Berichten'],['empty','Angebunden, ohne Berichte'],['issues','Mit Hinweisen oder Lücken'],['partial','Teilstand'],['stale','Älter als 7 Tage'],['failed','Letzter Abruf fehlgeschlagen'],['shallow','Berichte reichen unter 3 Monate zurück'],['quiet','Seit über 90 Tagen keine Sitzung'],['selected','Ausgewählt']];
// "shallow" and "quiet" judge the meeting days of the stored reports (shared/coverage.mjs): candidates for a longer
// look-back window, or for a check of the source.
const matchesFilter=(s:AdminSource,filter:string,selected:Set<string>,today:string)=>filter==='all'||filter==='connected'&&s.canImport||filter==='data'&&s.count>0||filter==='empty'&&s.canImport&&!s.count||filter==='issues'&&(s.attention||(s.issueCount||0)>0)||filter==='partial'&&s.partial||filter==='stale'&&s.stale||filter==='failed'&&s.attemptStatus==='failed'||filter==='shallow'&&s.canImport&&s.count>0&&['w','m1'].includes(reachBucket(s.firstEventAt,today))||filter==='quiet'&&s.canImport&&s.count>0&&['d180','old'].includes(freshBucket(s.lastEventAt,today))||filter==='selected'&&selected.has(s.id);
// retry: reads and the steps of a job may be asked again when the server does not answer properly (it restarts, or a reply is
// not JSON at all: an error page). The state of the job is kept on the server, so a repeated step only continues it. onWait
// reports that the page is waiting for the server.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ungeprüfte JSON-Antworten der Admin-Routen; die Aufrufer legen die Form fest
type Json=any;
async function api(url:string,body?:unknown,retry?:{onWait?:(waiting:boolean)=>void}):Promise<Json>{
 for(let attempt=0;;attempt++){
  let failure='';
  try{
   const r=await fetch(url,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{} )});
   let data:Json=null;try{data=await r.json();}catch{/* not JSON: an error page of the server */}
   if(data&&r.ok){retry?.onWait?.(false);return data;}
   if(data?.error)throw Error(data.error);
   failure=`Der Server hat nicht richtig geantwortet (HTTP ${r.status}).`;
  }catch(e){if(!(e instanceof TypeError))throw e;failure='Der Server ist nicht erreichbar.';}
  if(!retry||attempt>=8){retry?.onWait?.(false);throw Error(failure+' Der Auftrag bleibt gespeichert. Wenn der Server neu startet, dort „Auftrag fortsetzen“ klicken; antwortet er danach weiter mit Fehler 500, ihn beenden und neu starten (npm run dev).');}
  retry.onWait?.(true);await new Promise(done=>setTimeout(done,10000));
 }
}
// initialSelection: areas handed over by the estimate page ("/admin?auswahl=…") as candidates for a twelve-month import.
// control: Auftragsmodus (?auftrag=1, aus der Steuerung): Abrufen, Pausieren, Fortsetzen, Beenden. Ohne ihn liest die Seite nur.
export function AdminProcessing({initial,initialSelection=[],initialFilter,control=false}:{initial:AdminDashboard;initialSelection?:string[];initialFilter?:string;control?:boolean}){
 const [data,setData]=useState(initial),[selected,setSelected]=useState<Set<string>>(new Set(initialSelection)),[query,setQuery]=useState(''),[filter,setFilter]=useState(initialFilter||'all'),[layer,setLayer]=useState('city'),[mode,setMode]=useState('coverage'),[page,setPage]=useState(1);
 const [busy,setBusy]=useState(''),[running,setRunning]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(initialSelection.length?`${initialSelection.length} Gebiete aus der Hochrechnung ausgewählt. Für ein vollständiges Jahr ist unter „Berichte abrufen“ der Zeitraum „12 Monate“ eingestellt; der Abruf startet erst auf Klick unter „Berichte abrufen“.`:''),[job,setJob]=useState(initial.processing.job);
 const [lookback,setLookback]=useState(initialSelection.length?'12m':'1m'),[scope,setScope]=useState<'selection'|'sources'>('selection'),[land,setLand]=useState('all'),[jobFilter,setJobFilter]=useState('all');
 const pause=useRef(false);
 const chosen=data.sources.filter(s=>selected.has(s.id)),total=chosen.reduce((a,s)=>a+s.count,0);
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
  // eslint-disable-next-line react-hooks/purity -- drain läuft auf Knopfdruck, nicht beim Rendern
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
  // A request that found the stored job briefly taken by another request (24 of them share it) waits like one that
  // found nothing to claim, instead of ending the whole run.
  const worker=async()=>{try{while(open()){
   let next:PipelineJob;try{next=await call('run',{lanes:runner.lanes});}catch(e){if(e instanceof Error&&/Warteschlangenschritt läuft bereits/.test(e.message)){await new Promise(done=>setTimeout(done,2500));continue;}throw e;}show(next);
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
 // An open job this page does not drive (the import process on the server works it, or another tab): follow its state.
 useEffect(()=>{
  if(!activeJob||running||!job)return;
  const id=job.id,tick=()=>{void api('/api/admin/pipeline',{action:'status',id}).then(next=>setJob(prev=>prev&&prev.id===next.id?mergeJob(prev,next) as PipelineJob:next)).catch(()=>{});};
  const timer=setInterval(tick,10000);return()=>clearInterval(timer);
 },[activeJob,running,job?.id]);
 // Rule labelling (an open job of the former stage 02; new runs start on the page Verarbeitung or at night): figures of the job.
 const labelJob=!!job&&job.stage==='analysis',jobProcessed=job?job.items.reduce((a,i)=>a+i.processed,0):0;
 // Rule labelling over the whole stock: the reports up to the cursor of all stored (server/integrations/pipeline-jobs.mjs), not the counter
 // of changed reports, which also counts what the triggers of the database write.
 const labelItem=job?.items.find(i=>i.region==='all'),labelTotal=Number(labelItem?.total||0),labelDone=Math.min(Number(labelItem?.position||0),labelTotal),labelPct=labelTotal?Math.round(100*labelDone/labelTotal):0;
 // Pause: no further package or area is claimed; what runs is stored first. Resume continues behind it (cursor).
 // The pause must reach the server (the import process keeps working otherwise): one retry, then the error is shown.
 const pauseJob=()=>{if(!job)return;pause.current=true;const ask=()=>api('/api/admin/pipeline',{action:'pause',id:job.id});void ask().catch(ask).then(next=>setJob(prev=>prev&&prev.id===next.id?mergeJob(prev,next) as PipelineJob:next)).catch(e=>setError(e instanceof Error?e.message:'Die Pause ist nicht angekommen.'));setMessage(labelJob?'Pause angefordert. Das laufende Paket wird noch gespeichert; „Fortsetzen“ macht dahinter weiter.':'Pause angefordert. Die laufenden Abrufe werden noch beendet und gespeichert.');};
 const resumeJob=()=>{if(job)void action('resume',()=>drain(job));};
 const cancelJob=async()=>{if(!job)return;if(!await confirmDialog({title:'Offenen Auftrag beenden?',text:'Bereits Gespeichertes bleibt erhalten; noch nicht begonnene Gebiete werden nicht mehr abgerufen.',confirmLabel:'Beenden'}))return;void action('cancel',async()=>{setJob(await api('/api/admin/pipeline',{action:'cancel',id:job.id}));});};
 // scope 'sources': every area with a connected source in all states, whatever is selected on the page; such a start
 // ends an open job (replace), which its label says beforehand. scope 'all' (rule labelling): every open report of the
 // stock as one item, package after package. Otherwise the selection of map and list.
 // background: only create the job; the import process on the server (deploy/node/ratsmonitor-import.timer, every ten
 // minutes) works it off without this page, which may be closed. Otherwise the page drives the job as before.
 async function start(stage:string,scope?:'sources'|'all',background=false){await action(scope||stage,async()=>{const next=await api('/api/admin/pipeline',{action:'create',stage,regions:scope||[...selected],...(stage==='metadata'?{window:lookback}:{}),...(scope&&activeJob?{replace:true}:{})});setJob(next);if(background){setMessage('Auftrag angelegt. Der Importprozess auf dem Server holt ihn innerhalb von zehn Minuten und arbeitet ihn ab; diese Seite kann geschlossen werden. „Fortsetzen“ ruft stattdessen hier im Browser ab.');return;}await drain(next);});}
 const connected=data.sources.filter(s=>s.canImport).length,connectedChosen=chosen.filter(s=>s.canImport).length;
 const openAreas=job?job.items.filter(i=>i.status==='queued'||i.status==='running').length:0;
 const jobCounts:Record<string,number>={};for(const i of job?.items||[])jobCounts[i.status]=(jobCounts[i.status]||0)+1;
 const jobDone=(job?.items.length||0)-(jobCounts.queued||0)-(jobCounts.running||0),jobShown=jobFilter!=='all'&&!jobCounts[jobFilter]?'all':jobFilter;
 const jobRows=job?job.items.filter(i=>jobShown==='all'||i.status===jobShown).sort((a,b)=>JOB_ORDER.indexOf(a.status)-JOB_ORDER.indexOf(b.status)):[];

 const startLabel=scope==='sources'?(activeJob?`Offenen Auftrag beenden und alle ${n(connected)} Quellen abrufen`:`Alle ${n(connected)} Quellen abrufen`):`${n(connectedChosen)} ausgewählte ${connectedChosen===1?'Quelle':'Quellen'} abrufen`;
 const T=(id:string,fallback:string)=>HELP[id]?.title||fallback,refreshing=busy==='refresh';
 // "Alle angebundenen Quellen" belegen die Datenbank lange: erst nach einer Rückfrage.
 async function startMetadata(background=false){
  if(scope==='sources'&&!await confirmDialog({title:'Alle angebundenen Quellen abrufen?',text:`Der Abruf liest ${n(connected)} Gebiete${background?' im Hintergrund auf dem Server':' und belegt die Datenbank, solange er läuft'}. Sie können jederzeit pausieren; Gespeichertes bleibt.`,confirmLabel:background?'Im Hintergrund abrufen':'Abruf starten'}))return;
  void start('metadata',scope==='sources'?'sources':undefined,background);
 }
 const jobTitle=job?(job.stage==='metadata'?(job.scope==='sources'?'Abruf aller Quellen in Deutschland':'Abrufauftrag')+(job.window?' · '+windowLabel(job.window)+' rückwirkend':''):job.scope==='all'?'Einordnung nach Regeln · alle offenen Berichte':'Einordnung nach Regeln'):'';
 return <>
  <AdminPageHead page="abruf" figure={{value:n(data.sources.filter(s=>s.count>0).length),label:'Gebiete mit Berichten',note:`von ${n(data.sources.length)}, ${n(connected)} angebunden`}}/>
  <div className={'transition-opacity '+(refreshing?'opacity-60':'')}>
  <Befund stand={<><StandLine stand={data.stand??null} busy={refreshing} action="Aktualisieren" onAction={()=>{if(!busy&&!running)void action('refresh',async()=>{await refresh();});}}/>{' '}{control?<Link href={adminHref('steuerung')} className="text-[14px] text-teal-700">Zurück zur Steuerung →</Link>:<Link href={adminHref('abruf','auftrag=1')} className="text-[14px] text-teal-700">Abrufauftrag anlegen →</Link>}</>}>
   {control?'Abrufauftrag: Gebiete in Karte oder Liste wählen, dann unten abrufen. Der Auftrag läuft auf dem Server weiter, auch wenn die Seite zu ist.'
    :`${n(data.sources.filter(s=>s.attemptStatus==='failed').length)} Gebiete hatten zuletzt einen fehlgeschlagenen Abruf; ${n(data.counts.online)} Berichte sind gespeichert.${activeJob?' Ein Abrufauftrag ist offen.':''}`}</Befund>
  <Zahlen items={[{value:n(data.counts.online),label:'Berichte gespeichert'},{value:n(data.sources.filter(s=>s.attemptStatus==='failed').length),label:'Abruf zuletzt fehlgeschlagen',href:adminHref('fehler')},{value:n(chosen.length),label:'in Ihrer Auswahl'}]}/>
  {error&&<Fehler>{error}</Fehler>}{message&&<p role="status" className="admin-notice">{message}</p>}{notice&&<p role="status" className="admin-notice">{notice}</p>}
  <section className="admin-territories" id="abruf-gebiete"><div className="admin-section-heading"><h2>{T('abruf.gebiete','Gebiete auswählen')}</h2><div className="admin-selection-actions"><span className="admin-note">{n(chosen.length)} ausgewählt</span><button type="button" className="btn-secondary btn-sm" disabled={running||!chosen.length} onClick={()=>setSelected(new Set())}>Auswahl leeren</button></div></div>
  <SectionHelp id="abruf.gebiete"/>
  <div className="admin-geography"><div><div className="admin-source-controls"><AdminChoice id="abruf-land" label="Bundesland" value={land} onChange={s=>{setLand(s);setPage(1);}} items={[["all","Alle Länder"],...ALL_LANDS.map(l=>[l.id,l.name] as [string,string])]}/><AdminChoice id="abruf-ebene" label="Kartenebene" value={layer} onChange={s=>{setLayer(s);setPage(1);}} items={[["city","Städte & Gemeinden"],["district","Kreise"]]}/><div style={{gridColumn:'1 / -1'}}><AdminChoice id="abruf-karte" label="Kartenfarbe" value={mode} onChange={setMode} items={[["coverage","Zustand des letzten Abrufs"],["reach","Rückreichweite"],["fresh","Jüngste Sitzung"],["access","Zugang (OParl, API, HTML, Sperren)"],["count","Anzahl Berichte"]]} help={MAP_HELP[mode]}/></div></div><AdminProcessingMap sources={data.sources} selected={selected} onToggle={toggle} layer={layer} mode={mode} land={land}/></div>
   <div className="admin-region-list"><div className="admin-source-controls"><div className="min-w-0"><label htmlFor="abruf-suche" className="field-label mb-1 block">Ort oder Gemeindeschlüssel</label><input id="abruf-suche" type="search" autoComplete="off" className="field-input" value={query} placeholder="Billerbeck, Coesfeld …" onChange={e=>{setQuery(e.target.value);setPage(1);}}/></div><AdminChoice id="abruf-filter" label="Liste filtern" value={filter} onChange={s=>{setFilter(s);setPage(1);}} items={FILTERS} help={FILTER_HELP[filter]}/></div><div className="admin-list-meta"><span>{n(visible.length)} Treffer</span><button type="button" className="link-btn" disabled={running||!visible.length} onClick={()=>setSelected(prev=>new Set([...prev,...visible.map(s=>s.id)]))}>Alle {n(visible.length)} Treffer auswählen</button></div>
   <div className="admin-source-list">{visible.slice((page-1)*10,page*10).map(s=><div className={'admin-source-item'+(selected.has(s.id)?' is-selected':'')} key={s.id}><label><input type="checkbox" className="h-4 w-4 shrink-0 accent-teal-600" checked={selected.has(s.id)} onChange={()=>toggle(s.id)} aria-label={s.name+' auswählen'}/><span><strong>{s.name}</strong><small>{s.accessLabel||(s.method==='oparl'?'OParl':s.method==='pending'?'Keine Quelle':'RIS')}{s.access==='api'&&s.channel?' ('+s.channel+')':''} · <span title={STATE_HELP[s.state]}>{s.state}</span></small></span><b>{n(s.count)}<small>Berichte</small></b></label><div className="admin-source-meta"><span title={termHelp('Übernahme')}>Übernahme</span> {date(s.lastSuccessAt)} · <span title={termHelp('Letzter Versuch')}>Letzter Versuch</span> {date(s.lastAttemptAt)}{s.count>0&&<> · Sitzungen {mm(s.firstEventAt)} bis {mm(s.lastEventAt)}</>}</div><details><summary>Verarbeitung & Quellenhinweise</summary><dl>{[['rules','Nach Regeln bearbeitet'],['summary','KI-Zusammenfassung'],['aiLabel','KI-Thema aus dem Inhalt']].map(([k,label])=><div key={k}><dt>{label}</dt><dd>{n(Number(s.processing[k as keyof typeof s.processing]||0))} / {n(s.count)}</dd></div>)}</dl><p className="text-[12px] text-slate-500">Die drei KI-Zahlen zählen nur, was aus dem Inhalt der Unterlagen entstand; der frühere Titeltest zählt hier nicht.</p><p>Letzte Bearbeitung: {date(s.processing.processedAt)}</p><p className="text-[12px] text-slate-500">Hinweise: Der Abruf meldet, dass etwas fehlt oder nicht gelesen wurde. Warnungen: Auffälligkeiten, die den Abruf nicht unvollständig machen.</p><SourceNotes id={s.id} issueCount={s.issueCount||0} warningCount={s.warningCount||0}/><a href={'/quellen?region='+s.id}>Quellen ansehen</a> · <a href={adminHref('atlas')}>Im Lückenatlas</a>{s.canImport&&<AdminRunDebug region={s.id} name={s.name}/>}</details></div>)}{!visible.length&&<p className="admin-empty">Keine passenden Gebiete.</p>}</div><div className="admin-list-meta"><button type="button" className="btn-secondary btn-sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>← Zurück</button><span>{page} / {Math.max(1,Math.ceil(visible.length/10))}</span><button type="button" className="btn-secondary btn-sm" disabled={page*10>=visible.length} onClick={()=>setPage(p=>p+1)}>Weiter →</button></div></div></div>
  </section>
  {control&&<section className="admin-pipeline" id="abruf-stufen"><div className="admin-section-heading"><h2>{T('abruf.stufen','Berichte abrufen')}</h2><span>{n(chosen.length)} Gebiete · {n(total)} Berichte in der Auswahl</span></div><SectionHelp id="abruf.stufen"/>
   <div className="admin-stage-grid admin-stage-grid-local"><section className="admin-stage"><h3>Amtliche Daten abrufen</h3><p>Öffentliche Vorgänge, Sitzungen, Gremien, Ergebnisse und Originalverweise aus OParl, Schnittstellen oder den öffentlichen Seiten der Ratssysteme.</p><AdminChoice id="abruf-gebiete-wahl" label="Welche Gebiete" value={scope} onChange={s=>setScope(s as 'selection'|'sources')} items={[["selection",`Ihre Auswahl (${n(connectedChosen)} mit Quelle${chosen.length-connectedChosen?`, ${n(chosen.length-connectedChosen)} ohne`:''})`],["sources",`Alle angebundenen Quellen (${n(connected)})`]]}/><AdminChoice id="abruf-zeitraum" label="Zeitraum rückwirkend" value={lookback} onChange={setLookback} items={windowItems}/><small>Sitzungen ab {windowLabel(lookback)} zurück und bereits veröffentlichte Folgesitzungen. Ältere gespeicherte Berichte bleiben erhalten.{["12m","24m"].includes(lookback)&&" Große Gebiete werden in mehreren Teilen gelesen; ein Teilstand wird vom nächsten Auftrag mit demselben Zeitraum fortgesetzt."}</small><button type="button" className="btn-primary" disabled={busySource||(scope==='selection'?!!activeJob||!connectedChosen:!connected)} onClick={()=>void startMetadata()}>{startLabel}</button><button type="button" className="btn-secondary" title="Legt den Auftrag nur an; der Importprozess auf dem Server arbeitet ihn ab, auch wenn diese Seite geschlossen ist" disabled={busySource||(scope==='selection'?!!activeJob||!connectedChosen:!connected)} onClick={()=>void startMetadata(true)}>Im Hintergrund abrufen</button>{scope==='sources'&&activeJob&&!running&&<small>Der offene Auftrag ({job?.stage==='metadata'?'Abruf, '+windowLabel(job?.window):'Einordnung nach Regeln'}, {n(openAreas)} Gebiete ausstehend) wird dabei beendet; Gespeichertes bleibt erhalten.</small>}{scope==='selection'&&activeJob&&!running&&<small>Ein Auftrag ist offen (Stand unten); der Importprozess auf dem Server arbeitet ihn ab. Für eine neue Auswahl den Auftrag unten beenden oder warten.</small>}{running&&<small>Ein Auftrag läuft. Unten pausieren und warten, bis die laufenden Abrufe gespeichert sind.</small>}</section>
   <section className="admin-stage"><h3>Was danach passiert</h3><p>Die nächste Tagespipeline lädt die PDFs der neu geschriebenen Berichte, liest ihren Text und ordnet sie mit dem Modell ein und schreibt Zusammenfassung und Fakten. Wer nicht bis zur Nacht warten will, startet die Schritte von Hand.</p>
    <ul className="m-0 list-none space-y-2 p-0 text-[14px]">
     <li><Link href={adminHref('pdf')} className="text-teal-600">PDFs und Text laden: PDF-Import →</Link></li>
     <li><Link href={adminHref('verarbeitung')} className="text-teal-600">Regeln und KI: Verarbeitung →</Link></li>
     <li><Link href={adminHref('altbestand')} className="text-teal-600">Ältere Sitzungen nachholen: Altbestand →</Link></li>
     <li><Link href={adminHref('nacht')} className="text-teal-600">Was die letzte Nacht geschafft hat →</Link></li>
    </ul></section></div>
  </section>}
  {job&&<section className="admin-job" id="abruf-auftrag"><div className="admin-section-heading"><h2>{jobTitle}</h2><div className="admin-selection-actions">{!control?<Link href={adminHref('abruf','auftrag=1')} className="text-[14px] text-teal-700">Auftrag steuern →</Link>:running?<button type="button" className="btn-secondary btn-sm" onClick={pauseJob}>{labelJob?'Nach dem laufenden Paket pausieren':'Nach den laufenden Schritten pausieren'}</button>:activeJob&&<><button type="button" className="btn-primary" disabled={!!busy} onClick={resumeJob}>Auftrag fortsetzen</button><button type="button" className="btn-secondary btn-sm btn-danger" disabled={!!busy} onClick={()=>void cancelJob()}>Auftrag beenden</button></>}</div></div>
   <p className="mt-1 max-w-[820px] text-[14px] text-slate-500">{job.scope==='all'?(labelTotal?`${n(labelDone)} von ${n(labelTotal)} Berichten durchgesehen (${labelPct} %)`:'Der Fortschritt wird mit dem nächsten Paket berechnet'):`${n(jobDone)} / ${n(job.items.length)} Gebiete abgeschlossen`} · {running?`Läuft${jobCounts.running&&job.scope!=='all'?' · '+jobCounts.running+' gleichzeitig':''}`:activeJob?'Pausiert – wartet auf Ihren Start':'Beendet'}</p>
   <SectionHelp id="abruf.auftrag"/>
   <div className="mt-4">{job.scope==='all'?<progress className="admin-job-progress" value={labelDone} max={labelTotal||1} aria-label="Bearbeitete Berichte"/>:<progress className="admin-job-progress" value={jobDone} max={job.items.length||1} aria-label="Abgeschlossene Gebiete"/>}</div>
   <p className="admin-job-counts">{job.scope!=='all'&&JOB_ORDER.filter(s=>jobCounts[s]).map(s=><span key={s} title={JOB_STATE_HELP[stateNames[s]||s]}>{stateNames[s]||s}: <strong>{n(jobCounts[s])}</strong></span>)}<span>{labelJob?'Berichte durchgesehen':'Berichte gelesen'}: <strong>{n(labelJob?labelDone:jobProcessed)}</strong></span></p>
   {/* Ein bundesweiter Auftrag hat mehrere tausend Gebiete: gezeigt wird ein Ausschnitt, Auffälliges zuerst. */}
   <details open={running}><summary>Ergebnisse je Gebiet</summary><div className="admin-source-controls"><AdminChoice id="abruf-auftrag-zustand" label="Anzeigen" value={jobShown} onChange={setJobFilter} items={[["all","Alle – Laufendes und Auffälliges zuerst"],...JOB_ORDER.filter(s=>jobCounts[s]).map(s=>[s,stateNames[s]||s] as [string,string])]}/></div><ul className="admin-job-results">{jobRows.slice(0,JOB_ROWS).map(i=>{const name=data.sources.find(s=>s.id===i.region)?.name||(i.region==='all'?'Alle Gebiete':i.region);return <li key={i.region}><strong>{name}</strong><span title={JOB_STATE_HELP[stateNames[i.status]||i.status]}>{stateNames[i.status]||i.status} · {n(i.processed)} verarbeitet</span>{i.message&&<small>{i.message}</small>}{job.stage==='metadata'&&i.status!=='unavailable'&&i.status!=='queued'&&<AdminRunDebug region={i.region} name={name}/>}</li>;})}</ul>{jobRows.length>JOB_ROWS&&<p className="admin-note">{n(jobRows.length-JOB_ROWS)} weitere Gebiete sind nicht aufgeführt. „Anzeigen“ grenzt die Liste auf einen Zustand ein.</p>}</details></section>}
  <AdminRuns data={data}/>
  <AdminTimeline selected={selected} version={timelineVersion}/>
  </div>
 </>;
}
