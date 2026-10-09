'use client';
import {useCallback,useEffect,useState} from 'react';
import {StandLine} from '@/components/admin-stand';
import {AdminPageHead,Alert,Kpis} from '@/components/admin-ui';
import type {Stand} from '@/shared/admin-types';
type Counts={online:number;aiSummaries:number;ruleSummaries:number;ruleScoreSum:number;pdfArticles:number;aiLabels:number;unlabelled:number};
type Summary={counts:Counts;stand?:Stand;statsPending?:number};
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
  <section id="regeltexte-zusammenfassungen" className="admin-section">
   <div className="admin-section-heading"><h2>Zusammenfassungen</h2></div>
   <p className="admin-note">Ist eine KI-Zusammenfassung vorhanden, steht sie im Artikel; sonst die regelbasierte, sonst der Platzhalter.</p>
   <div className="mt-6"><Kpis label="Kennzahlen der Zusammenfassungen" items={sum}/></div>
  </section>
  <section id="regeltexte-labels" className="admin-section">
   <div className="admin-section-heading"><h2>Labels</h2></div>
   <p className="admin-note">Jeder Artikel hat nach festen Regeln ein Label; die KI kann es ersetzen. „Ohne“ sind Artikel, die keiner Regel zugeordnet werden konnten.</p>
   <div className="mt-6"><Kpis label="Kennzahlen der Labels" items={lab}/></div>
  </section>
 </>;
}
