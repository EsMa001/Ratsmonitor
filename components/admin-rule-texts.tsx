'use client';
import {useCallback,useEffect,useState} from 'react';
import {StandLine} from '@/components/admin-stand';
import {AdminPageHead,Alert,Kpis} from '@/components/admin-ui';
import {when,dur} from '@/components/admin-pdf-parts';
import type {Stand} from '@/shared/admin-types';
type Counts={online:number;aiSummaries:number;ruleSummaries:number;ruleScoreSum:number;pdfArticles:number;aiLabels:number;unlabelled:number};
type Summary={counts:Counts;stand?:Stand;statsPending?:number};
type Step={name:string;seconds:number;ok:boolean;summary:Record<string,unknown>|null};
type JobState={setting:{enabled:boolean;time?:string};run:{lastStart?:string;lastEnd?:string;seconds?:number;result?:string;running?:{startedAt:string}|null}|null;now:string|null;next:string|null;last?:{finishedAt:string;result:string;steps:Step[]}|null};
const RESULT:Record<string,string>={ok:'fertig',done:'fertig',failed:'mit Fehler',stopped:'angehalten'};
/** Kurzfassung eines Schritts aus seiner Zusammenfassung */
function stepNote(s:Step){
 const x=s.summary||{};
 if(x.skipped)return 'ausgelassen ('+x.skipped+')';
 if(!s.ok)return 'Fehler';
 if(s.name==='Zusammenfassungen'&&typeof x.summaries==='number')return n(x.summaries)+' neue von '+n(Number(x.withText)||0)+' mit Text';
 return 'fertig';
}
const n=(v:number)=>v.toLocaleString('de-DE');
const pct=(a:number,b:number)=>b?(100*a/b).toLocaleString('de-DE',{maximumFractionDigits:a/b<.01?2:a/b<.1?1:0})+' %':'–';
/** Anteil der Artikel mit KI-Text, mit regelbasiertem Text und ohne, jeweils für Zusammenfassungen und Labels. */
export function AdminRuleTexts(){
 const [data,setData]=useState<Summary|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  setBusy(true);setError('');
  try{const r=await fetch('/api/admin/summary',{cache:'no-store'});const d=await r.json() as Summary&{error?:string};if(!r.ok)throw Error(d.error||'Die Zahlen konnten nicht geladen werden.');setData(d);}
  catch(e){setError(e instanceof Error?e.message:'Die Zahlen konnten nicht geladen werden.');}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{load();},[load]);
 /* Job „Themen & Texte“ (scripts/rule-texts.mjs) über die Zeitpläne: Stand, letzter Lauf, sofort starten */
 const [job,setJob]=useState<JobState|null>(null),[jobError,setJobError]=useState(''),[asking,setAsking]=useState(false);
 const loadJob=useCallback(async()=>{
  try{const r=await fetch('/api/admin/zeitplaene',{cache:'no-store'});const d=await r.json() as {jobs?:(JobState&{id:string})[];error?:string};if(!r.ok)throw Error(d.error||'Der Job konnte nicht geladen werden.');setJob(d.jobs?.find(j=>j.id==='rule-texts')||null);setJobError('');}
  catch(e){setJobError(e instanceof Error?e.message:'Der Job konnte nicht geladen werden.');}
 },[]);
 useEffect(()=>{loadJob();const t=setInterval(loadJob,60000);return ()=>clearInterval(t);},[loadJob]);
 /* Berichte mit Text im Hauptdokument und wie viele davon eine Zusammenfassung haben (Zählung der PDF-Ablage, stats.mjs) */
 const [pdfSum,setPdfSum]=useState<{done:number;withText:number}|null>(null);
 useEffect(()=>{fetch('/api/admin/pdf-ablage',{cache:'no-store'}).then(r=>r.ok?r.json() as Promise<{stats?:{summaries?:{done:number;withText:number}}}>:null).then(d=>setPdfSum(d?.stats?.summaries||null)).catch(()=>{/* Kennzahl bleibt leer */});},[]);
 const start=async()=>{
  if(!window.confirm('Zusammenfassungen, Fakten und Wortliste jetzt erstellen? Der Job startet sofort.'))return;
  setAsking(true);
  try{const r=await fetch('/api/admin/zeitplaene',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'now',id:'rule-texts'})});const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||'Das ging nicht.');await loadJob();}
  catch(e){setJobError(e instanceof Error?e.message:'Das ging nicht.');}
  finally{setAsking(false);}
 };
 const running=!!job?.run?.running,requested=!!job?.now&&(!job.run?.lastStart||job.now>job.run.lastStart);
 const c=data?.counts;
 const total=c?.online??0,ai=c?.aiSummaries??0,rule=c?.ruleSummaries??0,none=Math.max(0,total-ai-rule);
 const aiL=c?.aiLabels??0,noL=c?.unlabelled??0,ruleL=Math.max(0,total-aiL-noL);
 const avg=rule?Math.round((c?.ruleScoreSum||0)/rule):undefined;
 const sum=c?[
  {label:'Mit KI-Zusammenfassung',value:pct(ai,total),note:n(ai)+' von '+n(total)+' Artikeln'},
  {label:'Mit regelbasierter Zusammenfassung',value:pct(rule,total),note:n(rule)+' Artikel; '+n(c.pdfArticles)+' haben ein Dokument'},
  {label:'Ohne Zusammenfassung',value:pct(none,total),note:n(none)+' Artikel (Platzhaltertext)'},
  {label:'Ø Güte der regelbasierten Texte',value:avg===undefined?'–':avg,of:avg===undefined?undefined:'von 100',note:rule?'Mittel über '+n(rule)+' Artikel':'Noch keine gespeichert'},
 ]:['Mit KI-Zusammenfassung','Mit regelbasierter Zusammenfassung','Ohne Zusammenfassung','Ø Güte der regelbasierten Texte'].map(label=>({label,value:undefined}));
 const pdfItem=({label:'Aus PDF-Texten',value:pdfSum?pct(pdfSum.done,pdfSum.withText):'–',note:pdfSum?n(pdfSum.done)+' von '+n(pdfSum.withText)+' Berichten mit Text im Hauptdokument; ohne: Sitzungsunterlagen und Texte, aus denen die Regeln nichts machen':'Stand aus der Zählung der PDF-Ablage'});
 const lab=c?[
  {label:'Artikel gesamt',value:n(total),note:'Grundlage der Anteile'},
  {label:'Mit KI-Label',value:pct(aiL,total),note:n(aiL)+' Artikel'},
  {label:'Nur regelbasiertes Label',value:pct(ruleL,total),note:n(ruleL)+' Artikel'},
  {label:'Ohne Label',value:pct(noL,total),note:n(noL)+' Artikel („Noch nicht eingeordnet“)'},
 ]:['Artikel gesamt','Mit KI-Label','Nur regelbasiertes Label','Ohne Label'].map(label=>({label,value:undefined}));
 return <>
  <AdminPageHead page="regeltexte"><StandLine stand={data?.stand} busy={busy} action="Aktualisieren" onAction={load}/></AdminPageHead>
  {error&&<Alert onRetry={load}>{error}</Alert>}
  {!!data?.statsPending&&<p role="status" className="mt-4 text-[14px] text-slate-500">Die Gebietszahlen werden noch nachgeführt ({n(data.statsPending)} Gebiete offen); die Werte können noch steigen.</p>}
  <section id="regeltexte-job" className="admin-section">
   <div className="admin-section-heading"><h2>Erstellen</h2></div>
   <p className="admin-note">Aus den Texten der PDF-Ablage entstehen nach festen Regeln, ohne KI: Zusammenfassungen für Berichte ohne, Fakten für plenara.X und die Wortliste der Suche (nur wenn Zusammenfassungen dazukamen; gesucht wird in deren Kurzfassung, nicht in der Langfassung). Der PDF-Import lädt und liest nur.</p>
   {jobError&&<Alert onRetry={loadJob}>{jobError}</Alert>}
   <ul className="m-0 mt-4 list-none space-y-1.5 p-0 text-[14px] text-slate-700">
    <li>{running?`Läuft seit ${when(job?.run?.running?.startedAt)}.`:requested?'Start angefordert …':job?.run?.lastStart?`Zuletzt ${when(job.run.lastStart)}, ${RESULT[job.run.result||'']||'–'}, ${dur(job.run.seconds)}.`:job?'Noch nicht gelaufen.':'–'}
     {job&&(job.setting.enabled?` Nächster Start ${when(job.next)} (täglich ${job.setting.time} Uhr, einstellbar unter Jobs & Zeitpläne).`:' Zeitplan ausgeschaltet (Jobs & Zeitpläne).')}</li>
    {job?.last?.steps.map(st=><li key={st.name}><span className="text-slate-500">{st.name}: </span>{stepNote(st)}, {dur(st.seconds)}</li>)}
   </ul>
   <button type="button" className="mt-4 inline-flex h-10 items-center rounded-full bg-slate-900 px-5 text-[14px] font-medium text-white hover:bg-slate-700 disabled:opacity-40" disabled={!job||running||requested||asking} onClick={start}>Jetzt erstellen →</button>
  </section>
  <section id="regeltexte-zusammenfassungen" className="admin-section">
   <div className="admin-section-heading"><h2>Zusammenfassungen</h2></div>
   <p className="admin-note">Ist eine KI-Zusammenfassung vorhanden, steht sie im Artikel; sonst die regelbasierte, sonst der Platzhalter.</p>
   <div className="mt-6"><Kpis label="Kennzahlen der Zusammenfassungen" items={[...sum,pdfItem]}/></div>
  </section>
  <section id="regeltexte-labels" className="admin-section">
   <div className="admin-section-heading"><h2>Labels</h2></div>
   <p className="admin-note">Jeder Artikel hat nach festen Regeln ein Label; die KI kann es ersetzen. „Ohne“ sind Artikel, die keiner Regel zugeordnet werden konnten.</p>
   <div className="mt-6"><Kpis label="Kennzahlen der Labels" items={lab}/></div>
  </section>
 </>;
}
