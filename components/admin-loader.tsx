'use client';
import {useEffect,useState} from 'react';
import type {AdminDashboard} from '@/shared/admin-types';
import {AdminHeader} from '@/components/admin-chrome';
import {AdminProcessing} from '@/components/admin-processing';
import {AdminDashboardView} from '@/components/admin-dashboard';
// The dashboard of the import and quality pages (every area with its sources and stages, several MB once the database
// holds hundreds of thousands of reports) is loaded by the browser from the same interface the pages refresh from.
// Embedded by the server it delayed the page for the whole read and, at 4.7 MB, broke the local render ("Network
// connection lost").
export function AdminLoader({page,displayName,signOutPath,initialSelection=[],initialFilter}:{page:'abruf'|'qualitaet';displayName:string;signOutPath:string;initialSelection?:string[];initialFilter?:string}){
 const [data,setData]=useState<AdminDashboard|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[pending,setPending]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setError('');
  // The import page asks without the review list of the quality page, as its own refresh does.
  fetch(page==='qualitaet'?'/api/admin/overview':'/api/admin/overview?review=0',{cache:'no-store',signal:controller.signal})
   // While figures of changed areas are still being computed (a few seconds per request), ask again; each request
   // continues where the last one stopped.
   .then(async r=>{const d=await r.json() as AdminDashboard&{error?:string};if(!r.ok)throw Error(d.error||'Der Datenbankstand konnte nicht geladen werden.');if(d.statsPending){setPending(d.statsPending);setTimeout(()=>{if(!controller.signal.aborted)setAttempt(n=>n+1);},300);return;}setData(d);})
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Der Datenbankstand konnte nicht geladen werden.');});
  return()=>controller.abort();
 },[page,attempt]);
 if(data)return page==='qualitaet'?<AdminDashboardView initial={data} displayName={displayName} signOutPath={signOutPath}/>:<AdminProcessing initial={data} displayName={displayName} signOutPath={signOutPath} initialSelection={initialSelection} initialFilter={initialFilter}/>;
 return <div className="admin-app"><AdminHeader page={page} displayName={displayName} signOutPath={signOutPath}/><main id="inhalt" className="admin-shell admin-workspace">
  <div className="admin-heading"><div><p className="eyebrow">ADMINISTRATION</p><h1>{error?'Administration nicht erreichbar':'Datenbankstand wird geladen …'}</h1><p>{displayName}</p></div></div>
  {error?<><p className="admin-error" role="alert">{error} Es werden keine Ersatzzahlen angezeigt.</p><button type="button" className="text-link" onClick={()=>setAttempt(n=>n+1)}>Erneut versuchen</button></>
   :<p role="status">{pending?`Kennzahlen werden berechnet: noch ${pending.toLocaleString('de-DE')} Gebiete. Das geschieht einmal nach größeren Änderungen; danach öffnet sich die Seite in Sekunden.`:'Alle Gebiete mit Quellen und Verarbeitungsstand; das dauert bei großem Bestand einige Sekunden.'}</p>}
 </main></div>;
}
