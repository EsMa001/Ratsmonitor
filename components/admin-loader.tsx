'use client';
import {useEffect,useState} from 'react';
import type {AdminDashboard} from '@/shared/admin-types';
import {AdminHeader} from '@/components/admin-chrome';
import {AdminProcessing} from '@/components/admin-processing';
import {AdminDashboardView} from '@/components/admin-dashboard';
import {fetchDashboard,setAdminStaticVersion} from '@/components/admin-store';
// The dashboard of the import and quality pages is put together by the browser from three parts (fetchDashboard in
// admin-store.ts): the summary, the rows of figures per area and the static list of areas, which the browser keeps.
// Embedded by the server it delayed the page for the whole read and, at 4.7 MB, broke the local render ("Network
// connection lost"). The server only reads stored figures; areas still being computed show their previous figures and
// are named in the line under the navigation (RegionCatchUp, admin-catch-up.tsx), which computes them in steps.
export function AdminLoader({page,displayName,signOutPath,staticVersion='',initialSelection=[],initialFilter}:{page:'abruf'|'qualitaet';displayName:string;signOutPath:string;staticVersion?:string;initialSelection?:string[];initialFilter?:string}){
 if(staticVersion)setAdminStaticVersion(staticVersion);
 const [data,setData]=useState<AdminDashboard|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setError('');
  // The import page asks without the review list of the quality page, as its own refresh does.
  fetchDashboard({review:page==='qualitaet',signal:controller.signal})
   .then(d=>{setData(d);})
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Der Datenbankstand konnte nicht geladen werden.');});
  return()=>controller.abort();
 },[page,attempt]);
 if(data)return page==='qualitaet'?<AdminDashboardView initial={data} displayName={displayName} signOutPath={signOutPath}/>:<AdminProcessing initial={data} displayName={displayName} signOutPath={signOutPath} initialSelection={initialSelection} initialFilter={initialFilter}/>;
 return <div className="admin-app"><AdminHeader page={page} displayName={displayName} signOutPath={signOutPath}/><main id="inhalt" className="admin-shell admin-workspace">
  <div className="admin-heading"><div><p className="eyebrow">ADMINISTRATION</p><h1>{error?'Administration nicht erreichbar':'Datenbankstand wird geladen …'}</h1><p>{displayName}</p></div></div>
  {error?<><p className="admin-error" role="alert">{error} Es werden keine Ersatzzahlen angezeigt.</p><button type="button" className="text-link" onClick={()=>setAttempt(n=>n+1)}>Erneut versuchen</button></>
   :<p role="status">Alle Gebiete mit Quellen und Verarbeitungsstand werden geladen.</p>}
 </main></div>;
}
