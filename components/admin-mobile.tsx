'use client';
import {useEffect,useState} from 'react';
// Abgespeckter Adminbereich für das Handy: nur die Abdeckung des Lückenatlas (erreichte Einwohner in Prozent).
// Quelle ist die leichte Abfrage /api/admin/coverage (Einwohner der angebundenen Gebiete im Verhältnis zu allen Gebieten).
type Coverage={total:{population:number};connected:{population:number}};
const REFRESH_MS=5*60*1000;
const percent=(a:number,b:number)=>(100*a/b).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})+' %';
export function AdminMobile(){
 const [value,setValue]=useState<string|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const c=new AbortController();
  const load=()=>fetch('/api/admin/coverage',{cache:'no-cache',signal:c.signal}).then(async r=>{
   const d=await r.json() as Coverage;
   if(!r.ok||!d?.total?.population)throw Error();
   setValue(percent(d.connected.population,d.total.population));setFailed(false);
  }).catch(e=>{if(e?.name!=='AbortError')setFailed(true);});
  load();const t=setInterval(load,REFRESH_MS);
  return()=>{c.abort();clearInterval(t);};
 },[attempt]);
 return <section aria-labelledby="abdeckung" className="mx-auto flex min-h-[60vh] max-w-[480px] flex-col justify-center py-10">
  <h1 id="abdeckung" className="text-[14px] font-normal text-slate-500">Lückenatlas · Einwohner erreicht</h1>
  <p className="mt-3 text-[44px] font-semibold leading-none tabular-nums text-slate-900" aria-live="polite">
   {value??(failed?'–':<span className="rm-dots" aria-label="wird geladen"><i/><i/><i/></span>)}
  </p>
  {failed&&<p role="alert" className="mt-4 text-[14px] text-slate-500">Der Wert konnte nicht geladen werden. <button type="button" className="text-teal-600" onClick={()=>setAttempt(a=>a+1)}>Erneut versuchen →</button></p>}
 </section>;
}
