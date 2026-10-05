'use client';
import {useEffect,useState} from 'react';
import type {AdminDashboard} from '@/shared/admin-types';
import {AdminHeader} from '@/components/admin-chrome';
import {AdminProcessing} from '@/components/admin-processing';
import {AdminDashboardView} from '@/components/admin-dashboard';
// The dashboard of pages 1 and 2 (every area with its sources and stages, several MB once the database holds hundreds
// of thousands of reports) is loaded by the browser from the same interface the pages refresh from. Embedded by the
// server it delayed the page for the whole read and, at 4.7 MB, broke the local render ("Network connection lost").
export function AdminLoader({page,displayName,signOutPath,initialSelection=[]}:{page:1|2;displayName:string;signOutPath:string;initialSelection?:string[]}){
 const [data,setData]=useState<AdminDashboard|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setError('');
  // Page 1 asks without the review list of page 2, as its own refresh does.
  fetch(page===2?'/api/admin/overview':'/api/admin/overview?review=0',{cache:'no-store',signal:controller.signal})
   .then(async r=>{const d=await r.json() as AdminDashboard&{error?:string};if(!r.ok)throw Error(d.error||'Der Datenbankstand konnte nicht geladen werden.');setData(d);})
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Der Datenbankstand konnte nicht geladen werden.');});
  return()=>controller.abort();
 },[page,attempt]);
 if(data)return page===2?<AdminDashboardView initial={data} displayName={displayName} signOutPath={signOutPath}/>:<AdminProcessing initial={data} displayName={displayName} signOutPath={signOutPath} initialSelection={initialSelection}/>;
 return <div className="admin-app"><AdminHeader page={page} displayName={displayName} signOutPath={signOutPath}/><main id="inhalt" className="admin-shell admin-workspace">
  <div className="admin-heading"><div><p className="eyebrow">ADMINISTRATION</p><h1>{error?'Administration nicht erreichbar':'Datenbankstand wird geladen …'}</h1><p>{displayName}</p></div></div>
  {error?<><p className="admin-error" role="alert">{error} Es werden keine Ersatzzahlen angezeigt.</p><button type="button" className="text-link" onClick={()=>setAttempt(n=>n+1)}>Erneut versuchen</button></>
   :<p role="status">Alle Gebiete mit Quellen und Verarbeitungsstand; das dauert bei großem Bestand einige Sekunden.</p>}
 </main></div>;
}
