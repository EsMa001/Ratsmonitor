'use client';
import {useEffect,useState} from 'react';
import type {AdminDashboard} from '@/shared/admin-types';
import {AdminPageHead,PageSkeleton,Alert,StandLine} from '@/components/admin-ui';
import {AdminProcessing} from '@/components/admin-processing';
import {AdminVerarbeitung} from '@/components/admin-verarbeitung';
import {AdminReview,AdminStock} from '@/components/admin-dashboard';
import {fetchDashboard,setAdminStaticVersion} from '@/components/admin-store';
export type DashboardPage='abruf'|'verarbeitung'|'pruefliste'|'bestand';
// Grey areas while the data are missing: heading and explanation of each section stand already.
const SKELETON:Record<DashboardPage,[string,number][]>={
 abruf:[['abruf.gebiete',520],['abruf.stufen',260],['qualitaet.importe',240],['abruf.verlauf',300]],
 verarbeitung:[['verarbeitung.regeln',200],['verarbeitung.ki',320]],
 pruefliste:[['qualitaet.inhalt',320]],
 bestand:[['qualitaet.vollstaendig',160],['qualitaet.pruefung',240],['qualitaet.export',120]],
};
// The dashboard of these pages is put together by the browser from three parts (fetchDashboard in admin-store.ts): the
// summary, the rows of figures per area and the static list of areas, which the browser keeps. Embedded by the server it
// delayed the page for the whole read and, at 4.7 MB, broke the local render ("Network connection lost"). The server only
// reads stored figures; areas still being computed show their previous figures and are named in the line under the
// navigation (RegionCatchUp, admin-catch-up.tsx), which computes them in steps.
export function AdminLoader({page,staticVersion='',initialSelection=[],initialFilter}:{page:DashboardPage;staticVersion?:string;initialSelection?:string[];initialFilter?:string}){
 if(staticVersion)setAdminStaticVersion(staticVersion);
 const [data,setData]=useState<AdminDashboard|null>(null),[failed,setFailed]=useState({key:'',text:''}),[attempt,setAttempt]=useState(0);
 // Fehler gelten nur für den Abruf, der sie gemeldet hat (neuer Abruf: kein Zurücksetzen im Effekt nötig)
 const key=page+'|'+attempt,error=failed.key===key?failed.text:'';
 useEffect(()=>{
  const controller=new AbortController();
  // Only the Prüfliste asks with the review list.
  fetchDashboard({review:page==='pruefliste',signal:controller.signal})
   .then(d=>{setData(d);})
   .catch(e=>{if(!controller.signal.aborted)setFailed({key,text:e instanceof Error?e.message:'Der Datenbankstand konnte nicht geladen werden.'});});
  return()=>controller.abort();
 },[page,attempt,key]);
 if(data){
  if(page==='pruefliste')return <AdminReview initial={data}/>;
  if(page==='bestand')return <AdminStock initial={data}/>;
  if(page==='verarbeitung')return <AdminVerarbeitung initial={data}/>;
  return <AdminProcessing initial={data} initialSelection={initialSelection} initialFilter={initialFilter}/>;
 }
 return <>
  <AdminPageHead page={page}><StandLine stand={undefined}/></AdminPageHead>
  {error&&<Alert onRetry={()=>setAttempt(n=>n+1)}>{error} Es werden keine Ersatzzahlen angezeigt.</Alert>}
  <PageSkeleton sections={SKELETON[page]}/>
 </>;
}
