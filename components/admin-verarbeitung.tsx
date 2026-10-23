'use client';
import Link from 'next/link';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {adminHref} from '@/components/admin-chrome';
import {AdminPageHead,StandLine,standText,Kpis,SectionHelp,Alert,AdminAreaPick} from '@/components/admin-ui';
import {HELP,ZUSTAND} from '@/components/admin-texts';
import {AdminAiLocal} from '@/components/admin-ai-local';
import {fetchDashboard} from '@/components/admin-store';
import type {AdminDashboard} from '@/shared/admin-types';
import {n,pct,when} from '@/components/admin-format';

/* Seite „Verarbeitung“ (dritte Stufe je Bericht, shared/pipeline-terms.mjs): wie weit der Bestand nach Regeln eingeordnet und
   mit KI aufbereitet ist. Die Regeln laufen nachts im Job „Verarbeitung, nachts“ (scripts/rule-texts.mjs: Modell anwenden,
   Zusammenfassung und Fakten, Suche, Zahlen); „Jetzt verarbeiten“ startet ihn sofort (POST /api/admin/zeitplaene). Die KI arbeitet nur
   über den Agentenablauf; die Liste zeigt, was je Bericht bereitsteht. Was die Regeln erzeugen und wie gut, steht auf
   „Einordnungsmodell“. */
type RunInfo={lastStart?:string;lastEnd?:string;result?:'ok'|'failed'|'stopped';running?:{startedAt:string}|null};
type Job={id:string;label:string;run:RunInfo|null;next:string|null;setting:{enabled:boolean}};
const RESULT:Record<string,string>={ok:'erfolgreich',failed:'mit Fehler beendet',stopped:'angehalten'};
const Head=({id}:{id:string})=><div className="admin-section-heading"><h2>{HELP[id]?.title}</h2></div>;

export function AdminVerarbeitung({initial}:{initial:AdminDashboard}){
 const [data,setData]=useState(initial),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[note,setNote]=useState('');
 const [job,setJob]=useState<Job|null>(null),[busy,setBusy]=useState(false),[area,setArea]=useState('all');
 const loadJob=useCallback(async()=>{
  try{const r=await fetch('/api/admin/zeitplaene',{cache:'no-store'});const d=await r.json() as {jobs?:Job[]};if(r.ok)setJob(d.jobs?.find(j=>j.id==='rule-texts')||null);}catch{/* ohne Zeitplaner: keine Laufzeile */}
 },[]);
 useEffect(()=>{const first=setTimeout(loadJob,0),t=setInterval(loadJob,60000);return()=>{clearTimeout(first);clearInterval(t);};},[loadJob]);
 async function refresh(){setRefreshing(true);setError('');try{setData(await fetchDashboard());await loadJob();}catch(e){setError(ZUSTAND.fehlerNeu((e instanceof Error?e.message:'Aktualisierung fehlgeschlagen').replace(/\.$/,''),standText(data.stand?.computedAt??data.asOf)));}finally{setRefreshing(false);}}
 async function runNow(){
  if(!window.confirm('„Verarbeitung, nachts“ jetzt starten? Der Job liest nur Berichte mit neuen Eingaben und läuft auf dem Server.'))return;
  setBusy(true);setNote('');
  try{const r=await fetch('/api/admin/zeitplaene',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'now',id:'rule-texts'})});const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||'Das ging nicht.');setNote('Angestoßen; der Job startet auf dem Server binnen Minuten.');await loadJob();}
  catch(e){setError(e instanceof Error?e.message:'Das ging nicht.');}
  finally{setBusy(false);}
 }
 const sum=(key:'rules'|'summary'|'aiLabel')=>data.sources.reduce((a,s)=>a+Number(s.processing[key]||0),0);
 const total=data.sources.reduce((a,s)=>a+s.count,0),rules=sum('rules'),summary=sum('summary'),aiLabel=sum('aiLabel');
 const areaOptions=useMemo(()=>data.sources.filter(s=>s.count>0).map(s=>({id:s.id,name:s.name})),[data.sources]);
 const selected=useMemo(()=>new Set(area==='all'?[]:[area]),[area]);
 const run=job?.run;
 return <>
  <AdminPageHead page="verarbeitung"><StandLine stand={data.stand??null} action="Aktualisieren" onAction={()=>void refresh()} busy={refreshing}/></AdminPageHead>
  {error&&<Alert>{error}</Alert>}
  {note&&<p role="status" className="admin-notice">{note}</p>}
  <div className={refreshing?'opacity-60 transition-opacity':'transition-opacity'} aria-busy={refreshing}>
   <section className="mt-8">
    <Kpis label="Kennzahlen der Verarbeitung" items={[
     {label:'Berichte gespeichert',value:n(total),note:'Doppelungen einmal gezählt'},
     {label:'Nach Regeln eingeordnet',value:pct(rules,total),note:n(total-rules)+' noch offen'},
     {label:'Mit KI-Zusammenfassung',value:pct(summary,total),note:n(summary)+' Berichte, aus dem Inhalt der Unterlagen'},
     {label:'KI-Thema aus dem Inhalt',value:pct(aiLabel,total),note:n(aiLabel)+' Berichte'}]}/>
   </section>
   <section id="verarbeitung-regeln" className="admin-section">
    <Head id="verarbeitung.regeln"/><SectionHelp id="verarbeitung.regeln"/>
    <div className="mt-4 max-w-[820px]">
     <p className="text-[14px]"><strong>{n(rules)} von {n(total)} Berichten</strong> nach Regeln eingeordnet.</p>
     <progress className="admin-job-progress mt-2" value={rules} max={total||1} aria-label="Nach Regeln eingeordnete Berichte"/>
     <p className="mt-3 text-[14px] text-slate-700">{job?<>Job „{job.label}“: {run?.running?`läuft seit ${when(run.running.startedAt)}`:run?.lastStart?`zuletzt ${when(run.lastStart)} bis ${when(run.lastEnd)}, ${RESULT[run.result||'']||'Ergebnis offen'}`:'noch kein Lauf vermerkt'}{job.next?` · nächster Start ${when(job.next)}`:job.setting.enabled?'':' · ausgeschaltet'}.</>:'Der Zeitplaner meldet keinen Stand (lokal ohne Jobs).'}</p>
     <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
      <button type="button" className="btn-secondary btn-sm" disabled={busy||!!run?.running} onClick={()=>void runNow()}>Jetzt verarbeiten</button>
      <Link href={adminHref('regeltexte')} className="text-teal-600">Einordnung und Regeln: Einordnungsmodell →</Link>
      <Link href={adminHref('zeitplaene')} className="text-teal-600">Zeitplan →</Link>
     </div>
    </div>
   </section>
   <section id="verarbeitung-ki" className="admin-section">
    <Head id="verarbeitung.ki"/><SectionHelp id="verarbeitung.ki"/>
    <div className="mt-4 max-w-[420px]"><AdminAreaPick id="verarbeitung-gebiet" label="Gebiet für „Ihre Auswahl“" value={area} onChange={setArea} options={areaOptions} allLabel="Kein Gebiet gewählt"/></div>
    <div className="admin-stage-grid admin-stage-grid-local mt-4"><AdminAiLocal sources={data.sources} selected={selected} revision={data.processing.revision} legacyJob={data.processing.aiJob}/></div>
   </section>
  </div>
 </>;
}
