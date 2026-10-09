'use client';
import {useEffect,useRef,useState,useMemo} from 'react';
import {Download,RefreshCw,Play,Pause,MapPinned} from 'lucide-react';
import {AdminHeader,adminHref} from '@/components/admin-chrome';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Checkbox} from '@/components/ui/checkbox';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
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
const date=(s:string|null|undefined)=>s?new Date(s).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'}):'Noch nicht erfasst';
const kindNames:Record<string,string>={summary:'KI-Zusammenfassung',aiLabel:'KI-Label aus Inhalt',keywords:'Gewichtete Stichwörter'};
const stateNames:Record<string,string>={queued:'Ausstehend',running:'Läuft',completed:'Gespeichert',partial:'Teilstand gespeichert',failed:'Fehlgeschlagen',unavailable:'Keine Quelle',unknown:'Ausgang prüfen',cancelled:'Beendet'};
// Look-back windows for stage 01; the same keys are validated on the server.
const windowItems=Object.entries(HISTORY_WINDOWS).map(([id,w])=>[id,w.label]) as [string,string][];
const windowLabel=(id?:string)=>windowItems.find(([key])=>key===id)?.[1]||'';
// A browser opens six connections to one server. The page uses four of them for requests that each run six imports
// side by side on the server (24 at once, the server's own limit) and keeps two free for status, pause and overview.
const RUNNERS:Record<string,{requests:number;lanes:number}>={metadata:{requests:4,lanes:6},analysis:{requests:1,lanes:1}};
// Order of the areas in the result list of a job: what needs attention comes first. The list shows this many rows.
const JOB_ORDER=['running','failed','unknown','partial','queued','completed','unavailable'],JOB_ROWS=60;
// List filters; "filter" in the address of the page preselects one (links of the overview and quality pages).
const FILTERS:[string,string][]=[['all','Alle Gebiete'],['connected','Mit angebundener Quelle'],['data','Mit Berichten'],['empty','Angebunden, ohne Berichte'],['issues','Mit Hinweisen oder Lücken'],['shallow','Berichte reichen unter 3 Monate zurück'],['quiet','Seit über 90 Tagen keine Sitzung'],['selected','Ausgewählt']];
// "shallow" and "quiet" judge the meeting days of the stored reports (shared/coverage.mjs): candidates for a longer
// look-back window, or for a check of the source.
const matchesFilter=(s:AdminSource,filter:string,selected:Set<string>,today:string)=>filter==='all'||filter==='connected'&&s.canImport||filter==='data'&&s.count>0||filter==='empty'&&s.canImport&&!s.count||filter==='issues'&&(s.attention||(s.issueCount||0)>0)||filter==='shallow'&&s.canImport&&s.count>0&&['w','m1'].includes(reachBucket(s.firstEventAt,today))||filter==='quiet'&&s.canImport&&s.count>0&&['d180','old'].includes(freshBucket(s.lastEventAt,today))||filter==='selected'&&selected.has(s.id);
function Choice({label,value,onChange,items}:{label:string;value:string;onChange:(s:string)=>void;items:[string,string][]}){return <label className="admin-field"><span>{label}</span><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{items.map(([v,name])=><SelectItem key={v} value={v}>{name}</SelectItem>)}</SelectContent></Select></label>;}
async function api(url:string,body?:unknown):Promise<any>{const r=await fetch(url,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{} )}),data=await r.json() as any;if(!r.ok)throw Error(data.error||'Anfrage fehlgeschlagen.');return data;}
const month=(d:string|null)=>d?d.slice(0,7).split('-').reverse().join('.'):'–';
function download(data:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
// initialSelection: areas handed over by the estimate page ("/admin?auswahl=…") as candidates for a twelve-month import.
export function AdminProcessing({initial,displayName,signOutPath,initialSelection=[],initialFilter}:{initial:AdminDashboard;displayName:string;signOutPath:string;initialSelection?:string[];initialFilter?:string}){
 const [data,setData]=useState(initial),[selected,setSelected]=useState<Set<string>>(new Set(initialSelection)),[query,setQuery]=useState(''),[filter,setFilter]=useState(initialFilter||'all'),[layer,setLayer]=useState('city'),[mode,setMode]=useState('coverage'),[page,setPage]=useState(1);
 const [busy,setBusy]=useState(''),[running,setRunning]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(initialSelection.length?`${initialSelection.length} Gebiete aus der Hochrechnung ausgewählt. Für ein vollständiges Jahr ist in Stufe 01 der Zeitraum „12 Monate“ eingestellt; der Abruf startet erst mit „Abruf starten“.`:''),[job,setJob]=useState(initial.processing.job),[kinds,setKinds]=useState(['summary','aiLabel','keywords']),[batchSize,setBatchSize]=useState('10'),[retryBlocked,setRetryBlocked]=useState(false);
 const [lookback,setLookback]=useState(initialSelection.length?'12m':'1m'),[scope,setScope]=useState<'selection'|'sources'>('selection'),[land,setLand]=useState('all'),[jobFilter,setJobFilter]=useState('all');
 const pause=useRef(false),file=useRef<HTMLInputElement>(null);
 const chosen=data.sources.filter(s=>selected.has(s.id)),total=chosen.reduce((a,s)=>a+s.count,0),count=(key:string)=>chosen.reduce((a,s)=>a+Number(s.processing[key as keyof typeof s.processing]||0),0);
 // The list is filtered again only when what it depends on changes (not with every render of the page, e.g. while a job reports);
 // the search text is lower-cased once.
 const asOfDay=String(data?.asOf||'').slice(0,10);
 const visible=useMemo(()=>{const q=query.toLocaleLowerCase('de-DE');return data.sources.filter(s=>s.kind===layer&&(land==='all'||s.land===land)&&(!q||(s.name+' '+s.ags).toLocaleLowerCase('de-DE').includes(q))&&matchesFilter(s,filter,selected,asOfDay));},[data.sources,layer,land,query,filter,selected,asOfDay]);
 const toggle=(id:string)=>setSelected(prev=>{const next=new Set(prev);if(next.has(id))next.delete(id);else next.add(id);return next;});
 const busySource=busy!==''||running||!!data.importBusyUntil;
 // The timeline is read again after a job or an action (refresh), not with every reload beside a running job.
 const [timelineVersion,setTimelineVersion]=useState(0);
 async function refresh(){const next:AdminDashboard=await fetchDashboard();setData(next);setJob(next.processing.job);setTimelineVersion(v=>v+1);return next;}
 async function action(name:string,fn:()=>Promise<void>){setBusy(name);setError('');setMessage('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Aktion fehlgeschlagen.');}finally{setBusy('');}}
 async function drain(start:PipelineJob){
  pause.current=false;setRunning(true);
  const runner=RUNNERS[start.stage]||RUNNERS.analysis;
  let latest=start,stopped=false,reloading=false,reloaded=Date.now(),rest=60000;
  // Replies of parallel requests can arrive out of order, and most list only the areas changed since the state the
  // page named; mergeJob keeps the newest state of every area and of the job.
  const show=(next:PipelineJob)=>{latest=mergeJob(latest,next) as PipelineJob;setJob(latest);};
  const call=(action:string,extra:Record<string,unknown>={}):Promise<PipelineJob>=>api('/api/admin/pipeline',{action,id:start.id,since:latest.updatedAt,...extra});
  const open=()=>!pause.current&&!['completed','cancelled'].includes(latest.status);
  // The overview reads every stored report and keeps the database busy meanwhile, so the running steps and every
  // other page wait for it. Beside a job it is reloaded at most once a minute and takes at most a tenth of the time;
  // the progress of the job itself comes with the answers of the steps.
  const reload=()=>{if(reloading||Date.now()-reloaded<rest)return;reloading=true;const began=Date.now();void fetchDashboard().then((next:AdminDashboard)=>setData(next)).catch(()=>{}).finally(()=>{reloading=false;reloaded=Date.now();rest=Math.max(60000,10*(reloaded-began));});};
  // One request runs several imports side by side on the server and returns when they are stored.
  const worker=async()=>{try{while(open()){
   const next=await call('run',{lanes:runner.lanes});show(next);
   // The server pauses a job itself when another process holds the stock.
   if(next.paused)pause.current=true;
   else if(next.wait)await new Promise(done=>setTimeout(done,2500));
   reload();
  }}catch(e){pause.current=true;throw e;}};
  // Between the answers of those requests the progress is asked for.
  const watch=async()=>{while(!stopped){await new Promise(done=>setTimeout(done,4000));if(stopped)break;try{show(await call('status'));}catch{}}};
  try{
   // A job paused earlier (by the operator or by the server) takes areas again from here on.
   show(await call('resume'));void watch();
   const outcomes=await Promise.allSettled(Array.from({length:runner.requests},worker));
   stopped=true;
   const conflict=latest.items.some(i=>i.status==='queued'&&i.message?.includes('läuft bereits'));
   await refresh();
   const failed=outcomes.find(o=>o.status==='rejected');if(failed)throw (failed as PromiseRejectedResult).reason;
   if(conflict)setMessage('Andere Verarbeitung läuft. Später ausdrücklich fortsetzen.');else if(!pause.current)setMessage('Auftrag beendet. Teilstände und Fehler stehen im Verlauf unten.');
  }finally{stopped=true;setRunning(false);}
 }
 const activeJob=job&&!['completed','cancelled'].includes(job.status);
 // Rule labelling: the figures of the whole stock (every area of the page, not only the selection) and of the job.
 const labelJob=!!job&&job.stage==='analysis',allTotal=data.sources.reduce((a,s)=>a+s.count,0),allRules=data.sources.reduce((a,s)=>a+Number(s.processing.rules||0),0),allOpen=Math.max(0,allTotal-allRules),jobProcessed=job?job.items.reduce((a,i)=>a+i.processed,0):0;
 // Pause: no further package or area is claimed; what runs is stored first. Resume continues behind it (cursor).
 const pauseJob=()=>{if(!job)return;pause.current=true;void api('/api/admin/pipeline',{action:'pause',id:job.id}).catch(()=>{});setMessage(labelJob?'Pause angefordert. Das laufende Paket wird noch gespeichert; „Fortsetzen“ macht dahinter weiter.':'Pause angefordert. Die laufenden Abrufe werden noch beendet und gespeichert.');};
 const resumeJob=()=>{if(job)void action('resume',()=>drain(job));};
 const cancelJob=()=>{if(job)void action('cancel',async()=>{setJob(await api('/api/admin/pipeline',{action:'cancel',id:job.id}));});};
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
   setMessage(`${n(offset)} / ${n(part.articleCount??offset)} Auftragsartikel geladen …`);
  }while(offset<(combined.articleCount??offset));
  download(combined,'plenara-ki-auftrag-'+id+'.json');
 }
 async function makeAi(){await action('ai',async()=>{
  const next=await api('/api/admin/ai-job',{action:'create',regions:[...selected],kinds,limit:batchSize==='all'?'all':Number(batchSize),retryBlocked});
  try{
   if(next.articleCount)await downloadAi(next.id);
   const held=next.blocked?` ${n(next.blocked)} Artikel ohne erneuten Versuch, weil ihre Quelle nicht ausreichte und sich seitdem nicht geändert hat.`:'';
   setMessage(next.articleCount?`${n(next.articleCount)} Artikel mit ${n(next.requestedSteps??next.articleCount)} fehlenden Einzelschritten reserviert.${next.sharedSources?.length?` ${n(next.sharedSources.length)} Quellen nutzen mehrere Artikel gemeinsam; der Agent liest sie nur einmal.`:''}${next.quickChecks?` ${n(next.quickChecks)} Artikel ohne Vorlage oder Anlage erhalten nur eine Schnellprüfung.`:''} Auftrag speichern und den KI-Agenten deiner Wahl manuell damit starten. Teilergebnisse können nacheinander eingelesen werden.${held}`:`In der Auswahl stehen für diese KI-Schritte keine Artikel aus.${held}`);
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
    setMessage(`Paket ${i+1} / ${batches.length} geprüft · ${n(applied)} Artikel gespeichert · ${n(skipped)} bereits vorhanden · ${n(conflicts)} Konflikte.`);
   }
   setMessage(`${n(applied)} Artikel gespeichert und zurückgelesen · ${n(skipped)} bereits vorhanden · ${n(conflicts)} Konflikte.${ignored?` ${n(ignored)} nicht angeforderte Einzelergebnisse ignoriert.`:''} Noch nicht gelieferte Artikel bleiben reserviert.`);
  }catch(e){throw Error(`Übernahme unterbrochen: ${n(applied)} Artikel gespeichert, ${n(skipped)} bereits vorhanden, ${n(conflicts)} Konflikte. Dieselbe Datei kann erneut eingelesen werden. ${e instanceof Error?e.message:''}`);}
  finally{await refresh();}
 });}
 const aiJob=data.processing.aiJob;
 const startLabel=scope==='sources'?(activeJob?`Offenen Auftrag beenden und alle ${n(connected)} Quellen abrufen`:`Alle ${n(connected)} Quellen abrufen`):`${n(connectedChosen)} ausgewählte ${connectedChosen===1?'Quelle':'Quellen'} abrufen`;
 return <div className="admin-app"><AdminHeader page="abruf" displayName={displayName} signOutPath={signOutPath}/><main id="inhalt" className="admin-shell admin-workspace">
  <div className="admin-heading"><div><p className="eyebrow">ABRUF & VERARBEITUNG</p><h1>Gebiete wählen, Daten holen, Inhalte erarbeiten.</h1><p>{displayName} · Stand {date(data.asOf)}</p></div><Button variant="outline" disabled={!!busy||running} onClick={()=>action('refresh',async()=>{await refresh();})}><RefreshCw size={16}/> Aktualisieren</Button></div>
  <div className="admin-kpis"><div className="admin-kpi admin-kpi-primary"><span>Berichte gespeichert</span><strong>{n(data.counts.online)}</strong><small>In der verbundenen Datenbank · Revision {n(data.processing.revision)}</small></div><div className="admin-kpi"><span>Gebiete mit Berichten</span><strong>{n(data.sources.filter(s=>s.count>0).length)} <em>/ {n(data.sources.length)}</em></strong><small>{n(connected)} Gebiete mit angebundener Quelle · {n(data.sources.filter(s=>s.canImport&&!s.count).length)} davon noch ohne Berichte</small></div><div className="admin-kpi"><span>Letzter Abruf fehlgeschlagen</span><strong>{n(data.sources.filter(s=>s.attemptStatus==='failed').length)}</strong><small>Vorheriger Bestand bleibt erhalten</small></div><div className="admin-kpi"><span>Deine Auswahl</span><strong>{n(chosen.length)}</strong><small>{n(total)} Berichte · {n(chosen.filter(s=>!s.canImport).length)} ohne angebundene Quelle</small></div></div>
  {error&&<p role="alert" className="admin-error">{error}</p>}{message&&<p role="status" className="admin-notice">{message}</p>}
  <section className="admin-territories"><div className="admin-section-heading"><h2><MapPinned size={22}/> Gebiete auswählen</h2><div className="admin-selection-actions"><span className="admin-note">{n(chosen.length)} ausgewählt</span><Button variant="ghost" disabled={running||!chosen.length} onClick={()=>setSelected(new Set())}>Auswahl leeren</Button></div></div>
  <p className="admin-note">Auf der Karte oder in der Liste anklicken. Die Filter grenzen die Liste ein; „Alle Treffer auswählen“ nimmt die gefilterte Liste in die Auswahl, etwa ein ganzes Land oder alle angebundenen Gebiete ohne Berichte.</p>
  <div className="admin-geography"><div><div className="admin-source-controls"><Choice label="Bundesland" value={land} onChange={s=>{setLand(s);setPage(1);}} items={[["all","Alle Länder"],...ALL_LANDS.map(l=>[l.id,l.name] as [string,string])]}/><Choice label="Kartenebene" value={layer} onChange={s=>{setLayer(s);setPage(1);}} items={[["city","Städte & Gemeinden"],["district","Kreise"]]}/><Choice label="Kartenfarbe" value={mode} onChange={setMode} items={[["coverage","Datenabdeckung & Abruf"],["reach","Rückreichweite der Berichte"],["fresh","Jüngste Sitzung"],["access","Zugang (OParl, API, HTML, Sperren)"],["count","Anzahl Berichte"],["rules","Anteil Regel-Labels"],["summary","Anteil KI-Zusammenfassungen"],["aiLabel","Anteil KI-Labels aus Inhalt"],["keywords","Anteil vollständiger Stichwortprofile"]]}/></div><AdminProcessingMap sources={data.sources} selected={selected} onToggle={toggle} layer={layer} mode={mode} land={land}/></div>
   <div className="admin-region-list"><div className="admin-source-controls"><label className="admin-field"><span>Ort oder Gemeindeschlüssel</span><Input value={query} placeholder="Billerbeck, Coesfeld …" onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label><Choice label="Liste filtern" value={filter} onChange={s=>{setFilter(s);setPage(1);}} items={FILTERS}/></div><div className="admin-list-meta"><span>{n(visible.length)} Treffer</span><Button variant="link" disabled={running||!visible.length} onClick={()=>setSelected(prev=>new Set([...prev,...visible.map(s=>s.id)]))}>Alle {n(visible.length)} Treffer auswählen</Button></div>
   <div className="admin-source-list">{visible.slice((page-1)*10,page*10).map(s=><div className={'admin-source-item'+(selected.has(s.id)?' is-selected':'')} key={s.id}><label><Checkbox checked={selected.has(s.id)} onCheckedChange={()=>toggle(s.id)} aria-label={s.name+' auswählen'}/><span><strong>{s.name}</strong><small>{s.accessLabel||(s.method==='oparl'?'OParl':s.method==='pending'?'Keine Quelle':'RIS')}{s.access==='api'&&s.channel?' ('+s.channel+')':''} · {s.state}</small></span><b>{n(s.count)}<small>Berichte</small></b></label><div className="admin-source-meta">Übernahme: {date(s.lastSuccessAt)}<br/>Letzter Versuch: {date(s.lastAttemptAt)}{s.count>0&&<><br/>Sitzungen: {month(s.firstEventAt)} bis {month(s.lastEventAt)}</>}</div><details><summary>Verarbeitung & Quellenhinweise</summary><dl>{[['rules','Regel-Labels'],['summary','KI-Zusammenfassungen'],['aiLabel','KI-Labels'],['keywords','10 Inhaltsstichwörter']].map(([k,label])=><div key={k}><dt>{label}</dt><dd>{n(Number(s.processing[k as keyof typeof s.processing]||0))} / {n(s.count)}</dd></div>)}</dl><p>Letzte Bearbeitung: {date(s.processing.processedAt)}</p><SourceNotes id={s.id} issueCount={s.issueCount||0} warningCount={s.warningCount||0}/><a href={'/quellen?region='+s.id}>Quellen ansehen</a> · <a href={adminHref('atlas')}>Im Lückenatlas</a>{s.canImport&&<AdminRunDebug region={s.id} name={s.name}/>}</details></div>)}{!visible.length&&<p className="admin-empty">Keine passenden Gebiete.</p>}</div><div className="admin-list-meta"><Button variant="outline" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Zurück</Button><span>{page} / {Math.max(1,Math.ceil(visible.length/10))}</span><Button variant="outline" disabled={page*10>=visible.length} onClick={()=>setPage(p=>p+1)}>Weiter</Button></div></div></div>
  </section>
  <section className="admin-pipeline"><div className="admin-section-heading"><div><p className="eyebrow">DREI STUFEN</p><h2>Jeder Start bewusst.</h2></div><span>{n(chosen.length)} Gebiete · {n(total)} Berichte in der Auswahl</span></div><p className="admin-note">Seitenaufrufe lesen nur den Status. Ein Abruf liest bis zu 24 Gebiete gleichzeitig, höchstens zwei auf demselben Server, die Server mit den meisten Gebieten zuerst; Regel-Labeling läuft Gebiet für Gebiet. Schließen der Seite pausiert nach den laufenden Schritten; „Auftrag fortsetzen“ macht dort weiter.</p>
   <div className="admin-stage-grid"><section className="admin-stage"><div className="admin-stage-number">01</div><h3>Amtliche Daten abrufen</h3><p>Öffentliche Vorgänge, Sitzungen, Gremien, Ergebnisse und Originalverweise aus OParl, Schnittstellen oder den öffentlichen Seiten der Ratssysteme.</p><Choice label="Welche Gebiete" value={scope} onChange={s=>setScope(s as 'selection'|'sources')} items={[["selection",`Deine Auswahl (${n(connectedChosen)} mit Quelle${chosen.length-connectedChosen?`, ${n(chosen.length-connectedChosen)} ohne`:''})`],["sources",`Alle angebundenen Quellen (${n(connected)})`]]}/><Choice label="Zeitraum rückwirkend" value={lookback} onChange={setLookback} items={windowItems}/><small>Sitzungen ab {windowLabel(lookback)} zurück und bereits veröffentlichte Folgesitzungen. Ältere gespeicherte Berichte bleiben erhalten.{["12m","24m"].includes(lookback)&&" Große Gebiete werden in mehreren Teilen gelesen; ein Teilstand wird vom nächsten Auftrag mit demselben Zeitraum fortgesetzt."}</small><Button disabled={busySource||(scope==='selection'?!!activeJob||!connectedChosen:!connected)} onClick={()=>start('metadata',scope==='sources'?'sources':undefined)}><Play size={15}/> {startLabel}</Button>{scope==='sources'&&activeJob&&!running&&<small>Der offene Auftrag ({job?.stage==='metadata'?'Abruf, '+windowLabel(job?.window):'Regel-Labeling'}, {n(openAreas)} Gebiete ausstehend) wird dabei beendet; Gespeichertes bleibt erhalten.</small>}{scope==='selection'&&activeJob&&!running&&<small>Erst den offenen Auftrag unten fortsetzen oder beenden.</small>}{running&&<small>Ein Auftrag läuft. Unten pausieren und warten, bis die laufenden Abrufe gespeichert sind.</small>}</section>
   <section className="admin-stage"><div className="admin-stage-number">02</div><h3>Regeln anwenden</h3><p>Regel-Labels und Vergleichsmerkmale aus den amtlichen Titeln für alle offenen Berichte, unabhängig von der KI-Bewertung. Jedes Paket von 500 Berichten wird sofort gespeichert; du kannst jederzeit pausieren und später dahinter fortsetzen.</p><strong>{n(allRules)} / {n(allTotal)} bearbeitet</strong><progress value={allRules} max={allTotal||1}/><small>{n(allOpen)} offen{labelJob&&jobProcessed>0?` · ${n(jobProcessed)} in diesem Auftrag bearbeitet`:''}{labelJob&&running?' · läuft':labelJob&&activeJob?' · pausiert':''}.</small>
   {labelJob&&running?<Button variant="outline" onClick={pauseJob}><Pause size={15}/> Nach dem laufenden Paket pausieren</Button>
   :labelJob&&activeJob?<div className="admin-selection-actions"><Button disabled={!!busy} onClick={resumeJob}><Play size={15}/> Fortsetzen</Button><Button variant="outline" disabled={!!busy} onClick={cancelJob}>Beenden</Button></div>
   :<Button variant="outline" disabled={busySource||!!activeJob||!allOpen} onClick={()=>start('analysis','all')}><Play size={15}/> Alle offenen Berichte labeln</Button>}
   {!activeJob&&!running&&selected.size>0&&total-count('rules')>0&&<small><button type="button" className="admin-timeline-retry" disabled={busySource} onClick={()=>void start('analysis')}>Nur die Auswahl: {n(total-count('rules'))} offene Berichte in {n(selected.size)} Gebieten</button></small>}
   {activeJob&&!labelJob&&<small>Erst den offenen Abrufauftrag unten fortsetzen oder beenden.</small>}</section>
   <section className="admin-stage admin-stage-ai"><div className="admin-stage-number">03</div><h3>KI-Inhalte erarbeiten</h3><p>Der KI-Agent deiner Wahl liest die Originalinhalte der Auswahl. Du startest den heruntergeladenen Auftrag manuell in deinem Projekt.</p><div className="admin-ai-kinds">{Object.entries(kindNames).map(([k,label])=><label key={k}><Checkbox checked={kinds.includes(k)} onCheckedChange={checked=>setKinds(prev=>checked?[...prev,k]:prev.filter(x=>x!==k))}/><span>{label}<small>{n(count(k))} / {n(total)} gespeichert{count('blocked_'+k)>0&&` · ${n(count('blocked_'+k))} ohne ausreichende Quelle`}</small></span></label>)}</div><Choice label="Artikel je KI-Auftrag" value={batchSize} onChange={setBatchSize} items={[["10","10 · Testlauf"],["25","25 Artikel"],["50","50 Artikel"],["100","100 Artikel"],["all","Alle offenen Artikel"]]}/><label className="admin-ai-retry"><Checkbox checked={retryBlocked} onCheckedChange={checked=>setRetryBlocked(checked===true)}/><span>Artikel ohne ausreichende Quelle erneut versuchen<small>Nur sinnvoll, wenn sich am Agenten oder an der Quellenarbeit etwas geändert hat.</small></span></label><Button variant="outline" disabled={busySource||!total||!kinds.length||aiJob?.status==='prepared'} onClick={makeAi}><Download size={15}/> KI-Auftrag vorbereiten</Button><small>Je Artikel werden nur die fehlenden Schritte angefordert, zuerst nie exportierte Artikel. Ein offener Auftrag reserviert seine Artikel bis zur Übernahme oder zum Verwerfen.</small></section></div>
  </section>
  {job&&<section className="admin-job"><div className="admin-section-heading"><div><h2>{job.stage==='metadata'?(job.scope==='sources'?'Abruf aller Quellen in Deutschland':'Abrufauftrag')+(job.window?' · '+windowLabel(job.window)+' rückwirkend':''):job.scope==='all'?'Regel-Labeling · alle offenen Berichte':'Regel-Labeling'}</h2><p>{job.scope==='all'?`${n(jobProcessed)} Berichte bearbeitet, ${n(allOpen)} offen laut letzter Zählung`:`${n(jobDone)} / ${n(job.items.length)} Gebiete abgeschlossen`} · {running?`Läuft${jobCounts.running&&job.scope!=='all'?' · '+jobCounts.running+' gleichzeitig':''}`:activeJob?'Pausiert – wartet auf deinen Start':'Beendet'}</p></div><div className="admin-selection-actions">{running?<Button variant="outline" onClick={pauseJob}><Pause size={16}/> {labelJob?'Nach dem laufenden Paket pausieren':'Nach den laufenden Schritten pausieren'}</Button>:activeJob&&<><Button disabled={!!busy} onClick={resumeJob}>Auftrag fortsetzen</Button><Button variant="outline" disabled={!!busy} onClick={cancelJob}>Auftrag beenden</Button></>}</div></div>
   {job.scope==='all'?<progress className="admin-job-progress" value={allRules} max={allTotal||1} aria-label="Bearbeitete Berichte"/>:<progress className="admin-job-progress" value={jobDone} max={job.items.length||1} aria-label="Abgeschlossene Gebiete"/>}
   <p className="admin-job-counts">{job.scope!=='all'&&JOB_ORDER.filter(s=>jobCounts[s]).map(s=><span key={s}>{stateNames[s]||s}: <strong>{n(jobCounts[s])}</strong></span>)}<span>{labelJob?'Berichte bearbeitet':'Berichte gelesen'}: <strong>{n(jobProcessed)}</strong></span></p>
   {/* Ein bundesweiter Auftrag hat mehrere tausend Gebiete: gezeigt wird ein Ausschnitt, Auffälliges zuerst. */}
   <details open={running}><summary>Ergebnisse je Gebiet</summary><div className="admin-source-controls"><Choice label="Anzeigen" value={jobShown} onChange={setJobFilter} items={[["all","Alle – Laufendes und Auffälliges zuerst"],...JOB_ORDER.filter(s=>jobCounts[s]).map(s=>[s,stateNames[s]||s] as [string,string])]}/></div><ul className="admin-job-results">{jobRows.slice(0,JOB_ROWS).map(i=>{const name=data.sources.find(s=>s.id===i.region)?.name||(i.region==='all'?'Alle Gebiete':i.region);return <li key={i.region}><strong>{name}</strong><span>{stateNames[i.status]||i.status} · {n(i.processed)} verarbeitet</span>{i.message&&<small>{i.message}</small>}{job.stage==='metadata'&&i.status!=='unavailable'&&i.status!=='queued'&&<AdminRunDebug region={i.region} name={name}/>}</li>;})}</ul>{jobRows.length>JOB_ROWS&&<p className="admin-note">{n(jobRows.length-JOB_ROWS)} weitere Gebiete sind nicht aufgeführt. „Anzeigen“ grenzt die Liste auf einen Zustand ein.</p>}</details></section>}
  {aiJob&&<section className="admin-job"><h2>KI-Auftrag</h2><p>{aiJob.count} festgelegte Artikel{aiJob.steps!=null&&` · ${aiJob.steps} fehlende Einzelschritte`} · {aiJob.kinds.map(k=>kindNames[k]).join(', ')} · {aiJob.applied} Ergebnisse übernommen</p><p className="admin-note">{aiJob.status==='prepared'?'Reserviert – der Download allein ist keine erfolgreiche Bearbeitung. Auftrag an deinen KI-Agenten übergeben und Ergebnisse hier einlesen; mehrere Teildateien sind möglich. Solange Artikel fehlen, bleibt dieser Auftrag offen.':aiJob.status==='cancelled'?'Auftrag verworfen. Die Artikel sind wieder verfügbar, stehen aber hinter bisher nicht exportierten Artikeln. Vorhandene Analyseergebnisse bleiben erhalten.':'Ergebnisse übernommen. Fachliche Quellenlücken können weiterhin bestehen.'}</p><div className="admin-selection-actions"><Button variant="outline" disabled={!!busy||running} onClick={()=>action('download-job',async()=>{await downloadAi(aiJob.id);setMessage('Auftrag erneut heruntergeladen. Die Artikelauswahl bleibt unverändert.');})}><Download size={16}/> Auftrag herunterladen</Button>{aiJob.status==='prepared'&&<><Button disabled={busySource} onClick={()=>file.current?.click()}>Ergebnisse prüfen & speichern</Button><Button variant="ghost" disabled={busySource} onClick={()=>action('cancel-ai',async()=>{await api('/api/admin/ai-job',{action:'cancel',id:aiJob.id});await refresh();})}>Auftrag verwerfen</Button></>}<input ref={file} hidden type="file" accept="application/json,.json" onChange={e=>{const f=e.target.files?.[0];if(f)void importAi(f);e.target.value='';}}/></div><details><summary>Arbeitsauftrag an den KI-Agenten</summary><p>„Lies requirements/ai-processing.md und die heruntergeladene Auftragsdatei. Bearbeite nur die darin ausgewählten Artikel und Schritte. Erzeuge und validiere die Ergebnisdatei gemäß shared/ai-job.mjs.“</p></details></section>}
  <AdminTimeline selected={selected} version={timelineVersion}/>
  <footer className="admin-footer">Bestandszahlen schließen zusammengeführte Verweise aus. <span><a href={adminHref('atlas')}>Lückenatlas</a> · <a href={adminHref('qualitaet','#admin-datenbank')}>Datenbank sichern und prüfen</a></span></footer>
 </main></div>;
}
