'use client';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {DatabaseAdmin} from '@/components/database-admin';
import {fetchDashboard} from '@/components/admin-store';
import {AdminQualityCheck} from '@/components/admin-quality-check';
import {AdminPageHead,StandLine,standText,Befund,Zahlen,Abschnitt,Fehler,SectionHelp,SectionTodo,AdminChoice,AdminAreaPick} from '@/components/admin-ui';
import {HELP,QUALITY_TEXT,QUALITY_FIGURE_HELP,REVIEW_HELP,ZUSTAND} from '@/components/admin-texts';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {REVIEW_FILTERS} from '@/shared/admin.mjs';
import {STATUS} from '@/shared/types';
import type {AdminDashboard} from '@/shared/admin-types';
import type {AdminPage} from '@/components/admin-chrome';
import {n,pct} from '@/components/admin-format';
const date=(s:string|null)=>s?new Date(s).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'}):'Noch kein Abruf';
const RUN_MODE:Record<string,string>={'ai-agent-analysis':'KI-Agent-Ergebnisse','claude-analysis':'Claude-Code-Ergebnisse','prepared-analysis':'Vorbereiteter KI-Test','summaries':'Textverarbeitung','analysis':'Labels & Themenmerkmale'};
const RUN_STATE:Record<string,string>={completed:'Abgeschlossen',partial:'Teilweise übernommen',failed:'Fehlgeschlagen',running:'Läuft'};
/** Überschrift eines Abschnitts aus HELP; darunter folgt SectionHelp. */
const Head=({id}:{id:string})=><div className="admin-section-heading"><h2>{HELP[id]?.title}</h2></div>;
/** Zahlen der Inhaltsqualität: Begriff, Wert 22 px, Erklärung als title. */
function Figures({items}:{items:[string,number][]}){
 return <dl className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-6 gap-y-5">{items.map(([label,v])=><div key={label} title={QUALITY_FIGURE_HELP[label]} className="min-w-0"><dt className="text-[12px] text-slate-500">{label}</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{n(v)}</dd></div>)}</dl>;
}
/** Stand des Dashboards einer Seite mit „Aktualisieren“; Prüfliste und Bestandsprüfung lesen es neu, ohne die Seite zu verlassen. */
function useDashboard(initial:AdminDashboard,review:boolean){
 const [data,setData]=useState(initial),[refreshing,setRefreshing]=useState(false),[error,setError]=useState('');
 async function refresh(){setRefreshing(true);setError('');try{setData(await fetchDashboard({review}));}catch(e){setError(ZUSTAND.fehlerNeu((e instanceof Error?e.message:'Aktualisierung fehlgeschlagen').replace(/\.$/,''),standText(data.stand?.computedAt??data.asOf)));}finally{setRefreshing(false);}}
 return {data,refreshing,error,refresh};
}
/** Kopfband mit Kennzahl, Befund mit Stand-Zeile, Zahlen; Inhalt beim Neuladen abgeblendet (Aufbau requirements/admin-konzept.md). */
function Page({page,state,figure,befund,zahlen,children}:{page:AdminPage;state:ReturnType<typeof useDashboard>;figure?:{value:ReactNode;label:string;note?:ReactNode};befund:ReactNode;zahlen?:{value:ReactNode;label:string;href?:string}[];children:ReactNode}){
 return <>
  <AdminPageHead page={page} figure={figure}/>
  {state.error&&<Fehler onRetry={()=>void state.refresh()}>{state.error}</Fehler>}
  <Befund stand={<StandLine stand={state.data.stand??null} action="Aktualisieren" onAction={()=>void state.refresh()} busy={state.refreshing}/>}>{befund}</Befund>
  {zahlen&&<Zahlen items={zahlen}/>}
  <div className={state.refreshing?'opacity-60 transition-opacity':'transition-opacity'} aria-busy={state.refreshing}>{children}</div>
 </>;
}

/** Die letzten 30 Läufe, die dieses System gestartet hat (Seite „Abruf“). */
export function AdminRuns({data}:{data:AdminDashboard}){
 const regionName=(id:string)=>data.sources.find(s=>s.id===id)?.name||id;
 return <section id="abruf-laeufe" className="admin-section">
  <Head id="qualitaet.importe"/><SectionHelp id="qualitaet.importe"/>
  {!data.runs.length?<p className="admin-empty">{QUALITY_TEXT.leer}</p>:<div className="mt-5"><Table className="admin-table"><TableHeader><TableRow><TableHead>Beginn</TableHead><TableHead>Gebiet / Auslöser</TableHead><TableHead>Ergebnis</TableHead><TableHead className="admin-number">Einträge</TableHead></TableRow></TableHeader><TableBody>{data.runs.map(r=>{const kind=RUN_MODE[r.mode]??'Quellenimport';return <TableRow key={r.id}><TableCell>{date(r.startedAt)}<small>{QUALITY_TEXT.art[kind]??kind}</small></TableCell><TableCell>{r.region==='all'?'Alle Gebiete':regionName(r.region)}<small>{r.trigger==='scheduled'?'Geplant':r.trigger==='manual'?'Manuell':'Auslöser nicht erfasst'}</small></TableCell><TableCell><span className={'admin-state'+(['failed','partial'].includes(r.status)||r.abandoned?' needs-attention':'')} title={r.abandoned?QUALITY_TEXT.statusOffen:undefined}>{r.abandoned?'Status offen: länger als 10 Minuten':(RUN_STATE[r.status]||r.status)}</span>{r.finishedAt&&<small>Ende {date(r.finishedAt)}</small>}{r.issueCount>0&&<small>{r.issueCount} Hinweise im Quellenstand</small>}</TableCell><TableCell className="admin-number">{r.count===null?'—':n(r.count)}</TableCell></TableRow>;})}</TableBody></Table></div>}
 </section>;
}

/** Seite „Prüfliste“: wie weit der Bestand aufbereitet ist, Themen und Verfahrensstände, Berichte je Prüfgrund. Liest nur. */
export function AdminReview({initial}:{initial:AdminDashboard}){
 const state=useDashboard(initial,true),data=state.data;
 const [issue,setIssue]=useState('labels'),[reviewRegion,setReviewRegion]=useState('all'),[review,setReview]=useState(initial.review),[reviewBusy,setReviewBusy]=useState(false),[reviewError,setReviewError]=useState('');
 const firstReview=useRef(true);
 const names=useMemo(()=>new Map(data.sources.map(s=>[s.id,s.name])),[data.sources]);
 const regionName=(id:string)=>names.get(id)||id;
 const areaOptions=useMemo(()=>data.sources.filter(s=>s.count>0).map(s=>({id:s.id,name:s.name})),[data.sources]);
 useEffect(()=>{
  if(firstReview.current){firstReview.current=false;return;}
  const controller=new AbortController();setReviewBusy(true);setReviewError('');
  fetch('/api/admin/review?'+new URLSearchParams({issue,region:reviewRegion}),{signal:controller.signal,cache:'no-store'}).then(async r=>{const d=await r.json() as AdminDashboard['review'] & {error?:string};if(!r.ok)throw Error(d.error||'Prüfliste nicht erreichbar.');return d;}).then(setReview).catch(e=>{if(e.name!=='AbortError')setReviewError(e.message);}).finally(()=>{if(!controller.signal.aborted)setReviewBusy(false);});
  return ()=>controller.abort();
 },[issue,reviewRegion,data.asOf]);
 const reviewTotal=review.total;
  const c=data.counts;
  return <Page page="pruefliste" state={state} figure={{value:pct(c.unlabelled,c.online),label:'ohne Thema',note:n(c.unlabelled)+' Berichte'}}
   befund={c.unlabelled?`${n(c.unlabelled)} von ${n(c.online)} Berichten haben kein Thema; die Liste darunter zeigt sie nach Prüfgrund.`:`Alle ${n(c.online)} Berichte haben ein Thema.`}
   zahlen={[{value:n(c.online),label:'Berichte online'},{value:n(c.updated7d),label:'in 7 Tagen neu oder geändert'},{value:pct(c.aiSummaries,c.online),label:'als KI-Text gekennzeichnet'},{value:pct(c.qualityPassed,c.online),label:'Textprüfung bestanden'}]}>
   <Abschnitt id="pruefliste-einordnung" open={false} title={HELP['qualitaet.inhalt']?.title}>
    <SectionHelp id="qualitaet.inhalt"/>
   <Figures items={[['Mit PDF-Unterlage',data.counts.pdfArticles],['KI-Inhaltsanalyse abgeschlossen',data.counts.contentSummaries],['Zu wenig lesbarer Text',data.counts.summaryInsufficient],['KI-Analyse veraltet',data.counts.summaryStale],['KI-Sachgebiete (alle, auch Titeltest)',data.counts.aiLabels]]}/>
   <div className="admin-charts">
    <div><h3>{QUALITY_TEXT.sachgebiete}</h3><p className="admin-note mb-3">{QUALITY_TEXT.sachgebieteNotiz}</p>
     {data.labels.filter(l=>l.count>0).sort((a,b)=>b.count-a.count).map(l=><div className="admin-bar-row" key={l.id}><div><span>{l.name}</span><span>{n(l.count)} · {pct(l.count,data.counts.online)}</span></div><div className="admin-bar" aria-hidden="true"><span style={{width:(data.counts.online?100*l.count/data.counts.online:0)+'%'}}/></div></div>)}</div>
    <div><h3>Verfahrensstand</h3>
     {data.statuses.map(s=>{const known=STATUS[s.id as keyof typeof STATUS];return <div className="admin-status-row" key={s.id} title={known?known.description:QUALITY_TEXT.unbekannt}><span>{known?.label||'Unbekannt'}</span><strong>{n(s.count)}</strong></div>;})}</div>
    </div>
   </Abschnitt>
   <Abschnitt id="pruefliste-liste" title={QUALITY_TEXT.pruefliste} sub={QUALITY_TEXT.prueflisteNotiz}>
   <div className="grid max-w-[820px] gap-4 sm:grid-cols-2">
    <AdminChoice id="admin-review-issue" label="Prüfgrund" value={issue} onChange={setIssue} items={(REVIEW_FILTERS as {id:string;name:string}[]).map(f=>[f.id,f.name] as [string,string])} help={REVIEW_HELP[issue]}/>
    <AdminAreaPick id="admin-review-region" label={QUALITY_TEXT.gebiet} value={reviewRegion} onChange={setReviewRegion} options={areaOptions} allLabel={QUALITY_TEXT.alleGebiete}/>
   </div>
    {reviewError?<Fehler>{reviewError}</Fehler>:<div className={'mt-4'+(reviewBusy?' opacity-60 transition-opacity':'')} aria-busy={reviewBusy}>
    {reviewBusy&&<p role="status" className="admin-note">Prüfliste wird geladen …</p>}
    <p className="admin-note">{reviewTotal===null?<>{QUALITY_TEXT.trefferOffen}{(review.pending||0)>0&&` Noch ${n(review.pending||0)} geänderte Gebiete offen.`}</>:QUALITY_TEXT.treffer(n(reviewTotal))}</p>
    <ol className="admin-review-list">{review.articles.map(a=><li key={a.id}><div><a href={'/beschluss/'+a.id} target="_blank" rel="noreferrer">{a.title} <ArrowUpRight size={15}/></a><small>{regionName(a.regionId)} · Aktualisiert {date(a.updatedAt)}</small></div></li>)}</ol>
    {!review.articles.length&&<p className="admin-empty">Keine Treffer für diesen Prüfgrund.</p>}</div>}
    <SectionTodo id="qualitaet.inhalt"/>
   </Abschnitt>
  </Page>;
}

/** Seite „Bestandsprüfung“: Pflichtangaben je Bericht, technische Prüfungen, Datenbank und Übernahme, Export. */
export function AdminStock({initial}:{initial:AdminDashboard}){
 const state=useDashboard(initial,false),data=state.data,restore=data.processing.restore,busy=!!data.importBusyUntil;
  return <Page page="bestand" state={state} figure={{value:n(data.counts.online),label:'Berichte gespeichert'}}
   befund={`Die Datenbank ist erreichbar (Revision ${n(data.processing.revision)}); darunter Pflichtangaben, technische Prüfungen und der Export.`}>
  <nav className="admin-nav mt-8" aria-label="Abschnitte dieser Seite"><a href="#admin-vollstaendig">Pflichtangaben</a><a href="#admin-pruefung">Duplikate & Defekte</a><a href="#admin-datenbank">Datenbank & Übernahme</a><a href="/api/admin/export?filter=all">Quellen als CSV</a></nav>
  <DatabaseAdmin sources={data.sources} disabled={busy}/>
  <AdminQualityCheck sources={data.sources} disabled={busy}/>
  <section id="admin-datenbank" className="admin-section admin-storage-status">
   <Head id="qualitaet.export"/><SectionHelp id="qualitaet.export"/>
   <dl className="admin-operations mt-5">
    <div><dt>Datenbank</dt><dd>Erreichbar · Revision {n(data.processing.revision)} · {n(data.counts.versions)} archivierte Fassungen · {n(data.counts.analysisVersions)} Analysefassungen · {n(data.counts.aliases)} zusammengeführte Verweise<small>{QUALITY_TEXT.datenbank}</small></dd></div>
    <div><dt>Übernahme</dt><dd>{restore?<>Am {date(restore.at)} wurde ein geprüfter Export vom {date(restore.sourceCreatedAt)} übernommen. {restore.localRevision===data.processing.revision?'Seitdem ist die Inhaltsrevision unverändert.':'Seitdem kann der Bestand weiterbearbeitet worden sein.'}</>:'In dieser Datenbank ist noch kein Übernahmebeleg hinterlegt.'}<small>Für eine lokale Kopie: Export herunterladen, mit dem Wiederherstellungswerkzeug lokal einlesen (README, „Vollständige Datenbank lokal übernehmen“). Ein Download bestätigt keine Speicherung auf einem anderen PC.</small></dd></div>
   </dl>
  </section>
 </Page>;
}
