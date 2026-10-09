'use client';
import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {DatabaseAdmin} from '@/components/database-admin';
import {fetchDashboard} from '@/components/admin-store';
import {AdminQualityCheck} from '@/components/admin-quality-check';
import {adminHref} from '@/components/admin-chrome';
import {AdminPageHead,StandLine,standText,Kpis,SectionHelp,SectionTodo,Alert,AdminChoice,AdminAreaPick} from '@/components/admin-ui';
import {HELP,QUALITY_TEXT,QUALITY_FIGURE_HELP,REVIEW_HELP,ZUSTAND} from '@/components/admin-texts';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {REVIEW_FILTERS} from '@/shared/admin.mjs';
import {STATUS} from '@/shared/types';
import type {AdminDashboard} from '@/shared/admin-types';
const n=(v:number)=>v.toLocaleString('de-DE');
const date=(s:string|null)=>s?new Date(s).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'}):'Noch kein Abruf';
const pct=(a:number,b:number)=>b?(100*a/b).toLocaleString('de-DE',{maximumFractionDigits:1})+' %':'—';
const RUN_MODE:Record<string,string>={'ai-agent-analysis':'KI-Agent-Ergebnisse','claude-analysis':'Claude-Code-Ergebnisse','prepared-analysis':'Vorbereiteter KI-Test','summaries':'Textverarbeitung','analysis':'Labels & Themenmerkmale'};
const RUN_STATE:Record<string,string>={completed:'Abgeschlossen',partial:'Teilweise übernommen',failed:'Fehlgeschlagen',running:'Läuft'};
/** Überschrift eines Abschnitts aus HELP; darunter folgt SectionHelp. */
const Head=({id}:{id:string})=><div className="admin-section-heading"><h2>{HELP[id]?.title}</h2></div>;
/** Zahlen der Inhaltsqualität: Begriff, Wert 22 px, Erklärung als title. */
function Figures({items}:{items:[string,number][]}){
 return <dl className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-6 gap-y-5">{items.map(([label,v])=><div key={label} title={QUALITY_FIGURE_HELP[label]} className="min-w-0"><dt className="text-[12px] text-slate-500">{label}</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{n(v)}</dd></div>)}</dl>;
}
/** Admin page "Qualität & Betrieb": content quality, import runs, database, operations. Reads; the older tools are folded away. */
export function AdminDashboardView({initial}:{initial:AdminDashboard;displayName?:string;signOutPath?:string}){
 const [data,setData]=useState(initial),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [issue,setIssue]=useState('labels'),[reviewRegion,setReviewRegion]=useState('all'),[review,setReview]=useState(initial.review),[reviewBusy,setReviewBusy]=useState(false),[reviewError,setReviewError]=useState('');
 const [analysisRegion,setAnalysisRegion]=useState('all'),[analysing,setAnalysing]=useState('');
 const firstReview=useRef(true);
 const names=useMemo(()=>new Map(data.sources.map(s=>[s.id,s.name])),[data.sources]),regionName=(id:string)=>names.get(id)||id;
 const populated=useMemo(()=>data.sources.filter(s=>s.count>0),[data.sources]),partial=populated.filter(s=>s.partial),stale=populated.filter(s=>s.stale),configuredEmpty=data.sources.filter(s=>s.canImport&&!s.count),failed=data.sources.filter(s=>s.attemptStatus==='failed');
 const areaOptions=useMemo(()=>populated.map(s=>({id:s.id,name:s.name})),[populated]);
 // Erstes Füllen: Die Zahlen je Gebiet fehlen noch; sie erscheinen erst, wenn alle Gebiete berechnet sind.
 const building=(data.stand?.unbuilt??0)>0;
 useEffect(()=>{
  if(firstReview.current){firstReview.current=false;return;}
  const controller=new AbortController();setReviewBusy(true);setReviewError('');
  fetch('/api/admin/review?'+new URLSearchParams({issue,region:reviewRegion}),{signal:controller.signal,cache:'no-store'}).then(async r=>{const d=await r.json() as AdminDashboard['review'] & {error?:string};if(!r.ok)throw Error(d.error||'Prüfliste nicht erreichbar.');return d;}).then(setReview).catch(e=>{if(e.name!=='AbortError')setReviewError(e.message);}).finally(()=>{if(!controller.signal.aborted)setReviewBusy(false);});
  return ()=>controller.abort();
 },[issue,reviewRegion,data.asOf]);
 async function refresh(preserveError=false){setRefreshing(true);if(!preserveError)setError('');try{setData(await fetchDashboard({review:true}));}catch(e){setError(ZUSTAND.fehlerNeu((e instanceof Error?e.message:'Aktualisierung fehlgeschlagen').replace(/\.$/,''),standText(data.stand?.computedAt??data.asOf)));}finally{setRefreshing(false);}}
 async function startAnalysis(mode:'analysis'|'summaries'){
  setAnalysing(mode);setMessage('');setError('');
  try{const r=await fetch('/api/admin/analyse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({region:analysisRegion,mode}),signal:AbortSignal.timeout(160000)}),d=await r.json() as {error?:string;processed?:number;remaining?:number;more?:boolean};if(!r.ok)throw Error(d.error||'Analyse fehlgeschlagen.');setMessage(mode==='analysis'?QUALITY_TEXT.analysiert(n(d.processed||0),n(d.remaining||0)):QUALITY_TEXT.uebernommen(n(d.processed||0))+' Ergebnisse und Hinweise stehen unter „Die letzten Abrufe“.');}catch(e){setError(e instanceof Error&&e.name!=='TimeoutError'?e.message:'Die Antwort dauert länger. Bitte zuerst die Seite aktualisieren; es wird kein weiterer Lauf automatisch gestartet.');}finally{setAnalysing('');await refresh(true);}
 }
 async function importPrepared(){
  setAnalysing('prepared');setError('');setMessage('');
  try{const r=await fetch('/api/admin/prepared-analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),d=await r.json() as {error?:string;processed:number;skipped:number;remaining:number;conflicts:number};if(!r.ok)throw Error(d.error||'Übernahme fehlgeschlagen.');setMessage(n(d.processed)+' Billerbeck-Ergebnisse gespeichert · '+n(d.skipped)+' bereits vorhanden · '+n(d.remaining)+' noch ausstehend · '+n(d.conflicts)+' Abweichungen zum vorbereiteten Stand. Jeder weitere Lauf benötigt einen Klick.');}catch(e){setError(e instanceof Error?e.message:'Übernahme fehlgeschlagen.');}finally{setAnalysing('');await refresh(true);}
 }
 const busy=!!analysing||!!data.importBusyUntil,restore=data.processing.restore;
 const problemAreas=new Set([...partial,...failed].map(s=>s.id)).size;
 const next:[string,string][]=[
  [n(partial.length)+' Gebiete mit Teilstand',adminHref('abruf','filter=partial')],
  [n(stale.length)+' Gebiete seit 7 Tagen ohne neue Übernahme',adminHref('abruf','filter=stale')],
  [n(configuredEmpty.length)+' angebundene Gebiete ohne Berichte',adminHref('abruf','filter=empty')],
  ['Offene Gebiete im Lückenatlas',adminHref('atlas')]];
 const nav=QUALITY_TEXT.sprungleiste;
 const reviewTotal=review.total;
 return <>
  <AdminPageHead page="qualitaet"><StandLine stand={data.stand??null} action="Aktualisieren" onAction={()=>refresh()} busy={refreshing}/></AdminPageHead>
  {error&&<Alert>{error}</Alert>}
  {message&&<p role="status" className="admin-notice">{message}</p>}
  <div className={refreshing?'opacity-60 transition-opacity':'transition-opacity'} aria-busy={refreshing}>
   <section className="mt-8">
    <Kpis label="Bestandskennzahlen" items={[
     {label:'Berichte online',value:n(data.counts.online),note:'Doppelungen einmal gezählt · '+n(data.counts.updated7d)+' in 7 Tagen neu gespeichert oder geändert',title:'Gezählt nach dem gespeicherten Aktualisierungsdatum. Eine neue Übernahme kann auch bereits vorhandene Berichte ändern; das ist keine Zahl neu entstandener Themen.'},
     {label:'Gebiete mit Berichten',value:building?undefined:n(populated.length),of:n(data.sources.length),note:n(populated.filter(s=>s.kind==='city').length)+' Städte, Gemeinden und Verbände · '+n(populated.filter(s=>s.kind==='district').length)+' Kreise',title:'Gebiete, für die mindestens ein Bericht gespeichert ist, von allen Gebieten im Katalog.'},
     {label:'Ohne Sachgebiet',value:pct(data.counts.unlabelled,data.counts.online),note:<>{n(data.counts.unlabelled)} Berichte · <a href="#admin-qualitaet" className="text-teal-600" onClick={()=>{setIssue('labels');setReviewRegion('all');}}>in der Prüfliste ansehen ↓</a></>,title:REVIEW_HELP.labels},
     {label:'Gebiete mit Abrufproblemen',value:building?undefined:n(problemAreas),note:n(partial.length)+' mit Teilstand · '+n(failed.length)+' letzter Abruf fehlgeschlagen',title:'Gebiete mit Teilstand oder fehlgeschlagenem letztem Abruf; ein Gebiet mit beidem zählt einmal.'}]}/>
   </section>
   <nav className="admin-nav mt-6" aria-label="Abschnitte dieser Seite"><a href="#admin-qualitaet">{nav[0]}</a><a href="#admin-importe">{nav[1]}</a><a href="#admin-datenbank">{nav[2]}</a><a href="#admin-pruefung">{nav[3]}</a><a href="#admin-betrieb">{nav[4]}</a><a href="/api/admin/export?filter=all">{nav[5]}</a><a href="/" target="_blank" rel="noreferrer">{nav[6]}</a></nav>
   {!building&&<p className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-[14px] text-slate-500"><span>Als Nächstes:</span>{next.map(([label,href],i)=><span key={href}>{i>0&&'· '}<Link href={href} className="text-teal-600">{label} →</Link></span>)}</p>}
   <section id="admin-qualitaet" className="admin-section">
    <Head id="qualitaet.inhalt"/><SectionHelp id="qualitaet.inhalt"/>
    <Figures items={[['Als KI-Text gekennzeichnet',data.counts.aiSummaries],['Ohne KI-Kennzeichnung',data.counts.online-data.counts.aiSummaries],['Mit PDF-Unterlage',data.counts.pdfArticles],['Textprüfung bestanden',data.counts.qualityPassed]]}/>
    <Figures items={[['KI-Inhaltsanalyse abgeschlossen',data.counts.contentSummaries],['Zu wenig lesbarer Text',data.counts.summaryInsufficient],['KI-Analyse veraltet',data.counts.summaryStale],['KI-Sachgebiete (alle, auch Titeltest)',data.counts.aiLabels],['KI-Stichwortprofile (alle, auch Titeltest)',data.counts.weightedKeywords]]}/>
    <div className="admin-charts">
     <div><h3>{QUALITY_TEXT.sachgebiete}</h3><p className="admin-note mb-3">{QUALITY_TEXT.sachgebieteNotiz}</p>
      {data.labels.filter(l=>l.count>0).sort((a,b)=>b.count-a.count).map(l=><div className="admin-bar-row" key={l.id}><div><span>{l.name}</span><span>{n(l.count)} · {pct(l.count,data.counts.online)}</span></div><div className="admin-bar" aria-hidden="true"><span style={{width:(data.counts.online?100*l.count/data.counts.online:0)+'%'}}/></div></div>)}</div>
     <div><h3>Verfahrensstand</h3>
      {data.statuses.map(s=>{const known=STATUS[s.id as keyof typeof STATUS];return <div className="admin-status-row" key={s.id} title={known?known.description:QUALITY_TEXT.unbekannt}><span>{known?.label||'Unbekannt'}</span><strong>{n(s.count)}</strong></div>;})}</div>
    </div>
    <div className="admin-review-head"><h3>{QUALITY_TEXT.pruefliste}</h3><p>{QUALITY_TEXT.prueflisteNotiz}</p></div>
    <div className="grid max-w-[820px] gap-4 sm:grid-cols-2">
     <AdminChoice id="admin-review-issue" label="Prüfgrund" value={issue} onChange={setIssue} items={(REVIEW_FILTERS as {id:string;name:string}[]).map(f=>[f.id,f.name] as [string,string])} help={REVIEW_HELP[issue]}/>
     <AdminAreaPick id="admin-review-region" label={QUALITY_TEXT.gebiet} value={reviewRegion} onChange={setReviewRegion} options={areaOptions} allLabel={QUALITY_TEXT.alleGebiete}/>
    </div>
    {reviewError?<Alert>{reviewError}</Alert>:<div className={'mt-4'+(reviewBusy?' opacity-60 transition-opacity':'')} aria-busy={reviewBusy}>
     {reviewBusy&&<p role="status" className="admin-note">Prüfliste wird geladen …</p>}
     <p className="admin-note">{reviewTotal===null?<>{QUALITY_TEXT.trefferOffen}{(review.pending||0)>0&&` Noch ${n(review.pending||0)} geänderte Gebiete offen.`}</>:QUALITY_TEXT.treffer(n(reviewTotal))}</p>
     <ol className="admin-review-list">{review.articles.map(a=><li key={a.id}><div><a href={'/thema/'+a.id} target="_blank" rel="noreferrer">{a.title} <ArrowUpRight size={15}/></a><small>{regionName(a.regionId)} · Aktualisiert {date(a.updatedAt)}</small></div></li>)}</ol>
     {!review.articles.length&&<p className="admin-empty">Keine Treffer für diesen Prüfgrund.</p>}</div>}
    <SectionTodo id="qualitaet.inhalt"/>
   </section>
   <section id="admin-importe" className="admin-section">
    <Head id="qualitaet.importe"/><SectionHelp id="qualitaet.importe"/>
    {!data.runs.length?<p className="admin-empty">{QUALITY_TEXT.leer}</p>:<div className="mt-5"><Table className="admin-table"><TableHeader><TableRow><TableHead>Beginn</TableHead><TableHead>Gebiet / Auslöser</TableHead><TableHead>Ergebnis</TableHead><TableHead className="admin-number">Einträge</TableHead></TableRow></TableHeader><TableBody>{data.runs.map(r=>{const kind=RUN_MODE[r.mode]??'Quellenimport';return <TableRow key={r.id}><TableCell>{date(r.startedAt)}<small>{QUALITY_TEXT.art[kind]??kind}</small></TableCell><TableCell>{r.region==='all'?'Alle Gebiete':regionName(r.region)}<small>{r.trigger==='scheduled'?'Geplant':r.trigger==='manual'?'Manuell':'Auslöser nicht erfasst'}</small></TableCell><TableCell><span className={'admin-state'+(['failed','partial'].includes(r.status)||r.abandoned?' needs-attention':'')} title={r.abandoned?QUALITY_TEXT.statusOffen:undefined}>{r.abandoned?'Status offen: länger als 10 Minuten':(RUN_STATE[r.status]||r.status)}</span>{r.finishedAt&&<small>Ende {date(r.finishedAt)}</small>}{r.issueCount>0&&<small>{r.issueCount} Hinweise im Quellenstand</small>}</TableCell><TableCell className="admin-number">{r.count===null?'—':n(r.count)}</TableCell></TableRow>;})}</TableBody></Table></div>}
   </section>
   <section id="admin-datenbank" className="admin-section admin-storage-status">
    <Head id="qualitaet.export"/><SectionHelp id="qualitaet.export"/>
    <div className="mt-4 space-y-2 text-[14px]">
     {restore?<p>In dieser Datenbank wurde am {date(restore.at)} ein geprüfter Export vom {date(restore.sourceCreatedAt)} übernommen. {restore.localRevision===data.processing.revision?'Seit dieser Übernahme ist die Inhaltsrevision unverändert.':'Seitdem kann der Bestand weiterbearbeitet worden sein; der aktuelle Stand steht oben.'}</p>:<p>In dieser Datenbank ist noch kein Übernahmebeleg hinterlegt. Ein Download bestätigt keine Speicherung auf einem anderen PC.</p>}
     {data.processing.lastAiApply&&<p>Letzter geprüfter KI-Import: {date(data.processing.lastAiApply.at)} · {data.processing.lastAiApply.applied} gespeichert · {data.processing.lastAiApply.conflicts.length} Konflikte.</p>}
     <p className="text-slate-500">Lokal speichern Abruf und Analysen direkt in der lokalen Datenbank. Für die Übertragung aus dem Online-System: Export herunterladen, mit dem Wiederherstellungswerkzeug lokal einlesen und diese Seite lokal öffnen (README, „Vollständige Datenbank lokal übernehmen“).</p>
    </div>
   </section>
   <DatabaseAdmin sources={data.sources} disabled={busy}/>
   <AdminQualityCheck sources={data.sources} disabled={busy}/>
   <section id="admin-betrieb" className="admin-section">
    <Head id="qualitaet.betrieb"/><SectionHelp id="qualitaet.betrieb"/>
    <dl className="admin-operations mt-5">
     <div><dt>Datenbank</dt><dd>Erreichbar · Revision {n(data.processing.revision)} · {n(data.counts.versions)} archivierte Fassungen · {n(data.counts.analysisVersions)} Analysefassungen · {n(data.counts.aliases)} zusammengeführte Verweise<small>{QUALITY_TEXT.datenbank}</small></dd></div>
     <div><dt>Automatische Abrufe</dt><dd>{data.lastScheduledAt?'Letzter protokollierter geplanter Start: '+date(data.lastScheduledAt):'Kein geplanter Lauf protokolliert'}<small>Ein manueller Abruf aktiviert keinen Zeitplan. Ein früherer Lauf bestätigt keine dauerhaft aktive Planung.</small></dd></div>
     <div><dt>{QUALITY_TEXT.kiSchnittstelle}</dt><dd>{data.operations.aiConfigured?QUALITY_TEXT.kiAn:QUALITY_TEXT.kiAus}<small>Nur ein ausdrücklicher Start verarbeitet neue Texte.</small></dd></div>
     <div><dt>Push für Münster</dt><dd>{data.operations.pushConfigured?'Versand konfiguriert':'Versand nicht konfiguriert'} · {n(data.counts.pushSubscriptions)} gespeicherte Abonnements<small>{QUALITY_TEXT.push}</small></dd></div>
     <div><dt>Besucherzahlen</dt><dd>Werden bisher nicht erfasst.</dd></div>
    </dl>
    <details className="admin-legacy"><summary>Ältere Werkzeuge</summary>
     <p className="admin-note">Das feste Billerbeck-Testpaket bleibt für frühere Stände verfügbar; neue KI-Aufträge werden auf „Abruf & Verarbeitung“ vorbereitet.</p>
     <div className="admin-selection-actions"><button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={importPrepared}>Vorbereitete Billerbeck-Ergebnisse übernehmen (bis 75)</button></div>
     {data.operations.aiConfigured&&<><div className="my-3 max-w-[420px]"><AdminAreaPick id="legacy-ai-region" label="Gebiet für API-Zusammenfassungen" value={analysisRegion} onChange={setAnalysisRegion} options={areaOptions} allLabel="Gebiet wählen"/></div><button type="button" className="btn-primary" disabled={busy||analysisRegion==='all'} onClick={()=>startAnalysis('summaries')}>API-Zusammenfassungen erstellen (bis 8)</button></>}
    </details>
   </section>
  </div>
 </>;
}
