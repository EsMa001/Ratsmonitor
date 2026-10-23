'use client';
import Link from 'next/link';
import {useMemo,useState} from 'react';
import {adminHref} from '@/components/admin-chrome';
import {AdminPageHead,StandLine,standText,Befund,Zahlen,Abschnitt,Fehler,SectionHelp,AdminAreaPick} from '@/components/admin-ui';
import {HELP,ZUSTAND} from '@/components/admin-texts';
import {AdminAiLocal} from '@/components/admin-ai-local';
import {fetchDashboard} from '@/components/admin-store';
import type {AdminDashboard} from '@/shared/admin-types';
import {n,pct} from '@/components/admin-format';

/* Seite „KI-Aufbereitung“ (früher „Verarbeitung“; Adresse ?seite=verarbeitung): was die KI aus dem Inhalt der Unterlagen bearbeitet
   hat und was für den Agenten bereitsteht. Die KI arbeitet nur über den Agentenablauf (MCP), nie von selbst. Einordnung, Zusammenfassung
   und Fakten nach Regeln stehen auf „Einordnungsmodell“, gestartet wird in der Steuerung. */

export function AdminVerarbeitung({initial}:{initial:AdminDashboard}){
 const [data,setData]=useState(initial),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[area,setArea]=useState('all');
 async function refresh(){setRefreshing(true);setError('');try{setData(await fetchDashboard());}catch(e){setError(ZUSTAND.fehlerNeu((e instanceof Error?e.message:'Aktualisierung fehlgeschlagen').replace(/\.$/,''),standText(data.stand?.computedAt??data.asOf)));}finally{setRefreshing(false);}}
 const sum=(key:'summary'|'aiLabel')=>data.sources.reduce((a,s)=>a+Number(s.processing[key]||0),0);
 const total=data.sources.reduce((a,s)=>a+s.count,0),summary=sum('summary'),aiLabel=sum('aiLabel');
 const areaOptions=useMemo(()=>data.sources.filter(s=>s.count>0).map(s=>({id:s.id,name:s.name})),[data.sources]);
 const selected=useMemo(()=>new Set(area==='all'?[]:[area]),[area]);
 return <>
  <AdminPageHead page="verarbeitung" figure={{value:pct(summary,total),label:'mit KI-Zusammenfassung',note:n(summary)+' von '+n(total)+' Berichten'}}/>
  {error&&<Fehler onRetry={()=>void refresh()}>{error}</Fehler>}
  <Befund stand={<StandLine stand={data.stand??null} action="Aktualisieren" onAction={()=>void refresh()} busy={refreshing}/>}>Die KI startet nie von selbst: Der Agent bearbeitet die Berichte aus der Liste darunter über den Agentenablauf (MCP). Einordnung, Zusammenfassung und Fakten nach Regeln stehen unter <Link href={adminHref('regeltexte')} className="text-teal-700">Einordnungsmodell</Link>.</Befund>
  <Zahlen items={[{value:n(total),label:'Berichte gespeichert'},{value:pct(aiLabel,total),label:'mit KI-Thema aus dem Inhalt'}]}/>
  <div className={refreshing?'opacity-60 transition-opacity':'transition-opacity'} aria-busy={refreshing}>
   <Abschnitt id="verarbeitung-ki" title={HELP['verarbeitung.ki']?.title}>
    <SectionHelp id="verarbeitung.ki"/>
    <div className="mt-4 max-w-[420px]"><AdminAreaPick id="verarbeitung-gebiet" label="Gebiet für „Ihre Auswahl“" value={area} onChange={setArea} options={areaOptions} allLabel="Kein Gebiet gewählt"/></div>
    <div className="admin-stage-grid admin-stage-grid-local mt-4"><AdminAiLocal sources={data.sources} selected={selected} revision={data.processing.revision} legacyJob={data.processing.aiJob}/></div>
   </Abschnitt>
  </div>
 </>;
}
