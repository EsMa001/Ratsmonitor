'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {VISIBLE_PAGES,adminHref} from '@/components/admin-chrome';
import {Befund,Zahlen,Fehler,Laden} from '@/components/admin-ui';
import {Icon} from '@/components/admin-icons';
import {n,clock} from '@/components/admin-format';
// Abgespeckter Adminbereich fürs Handy (?seite=mobil): erreichte Einwohner (Gemeindeebene, mit VG, mit Kreisen) und die reale
// Abdeckung der letzten 7 Tage, darunter alle Seiten. Aufbau wie die übrigen Seiten (Befund, Zahlen). Quelle: /api/admin/coverage.
type Share={areas:number;population:number};
type Coverage={total:Share;connected:Share;withVg?:Share;withDistricts?:Share;active?:Share&{days:number}};
const REFRESH_MS=5*60*1000;
const percent=(a:number,b:number)=>(100*a/b).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})+' %';
export function AdminMobile(){
 const [data,setData]=useState<Coverage|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0),[at,setAt]=useState(0);
 useEffect(()=>{
  const c=new AbortController();
  const load=()=>fetch('/api/admin/coverage',{cache:'no-cache',signal:c.signal}).then(async r=>{
   const d=await r.json() as Coverage;
   if(!r.ok||!d?.total?.population)throw Error();
   setData(d);setFailed(false);setAt(Date.now());
  }).catch(e=>{if(e?.name!=='AbortError')setFailed(true);});
  load();const t=setInterval(load,REFRESH_MS);
  return()=>{c.abort();clearInterval(t);};
 },[attempt]);
 const all=data?.total.population||1;
 return <section aria-labelledby="abdeckung" className="mx-auto max-w-[480px] py-6">
  <p className="m-0 text-[14px] text-slate-500">Lückenatlas</p>
  <h1 id="abdeckung" className="m-0 mt-1 flex items-baseline gap-2 text-[28px] font-semibold leading-tight">{data?percent(data.connected.population,all):'–'}<span className="text-[16px] font-normal text-slate-500">der Einwohner erreicht</span></h1>
  {failed&&<Fehler onRetry={()=>setAttempt(a=>a+1)}>Der Wert konnte nicht geladen werden.</Fehler>}
  {!data&&!failed&&<Laden/>}
  {data&&<>
   <Befund stand={<>Stand {clock(new Date(at).toISOString())} · auf Gemeindeebene</>}>{data.active?`In den letzten ${data.active.days} Tagen hat der Abruf bei ${n(data.active.areas)} von ${n(data.connected.areas)} angebundenen Gebieten geklappt (${percent(data.active.population,all)} der Einwohner).`:`${n(data.connected.areas)} Gebiete sind angebunden.`}</Befund>
   <Zahlen items={[...(data.withVg?[{value:percent(data.withVg.population,all),label:'mit VG'}]:[]),...(data.withDistricts?[{value:percent(data.withDistricts.population,all),label:'mit Kreisen'}]:[])]}/>
  </>}
  {/* Die ganze Administration auch vom Handy aus: eine Zeile je Seite, mit Symbol, getrennt durch Linien. */}
  <nav aria-label="Adminseiten" className="mt-10">
   <h2 className="m-0 text-[14px] font-normal text-slate-500">Administration</h2>
   <ul className="m-0 mt-2 list-none border-t border-slate-200 p-0">
    {VISIBLE_PAGES.map(p=><li key={p.id} className="border-b border-slate-200"><Link href={adminHref(p.id)} prefetch={false} className="flex min-h-[44px] items-center gap-3 text-[16px] text-slate-900 no-underline"><Icon name={p.icon} size={18} className="text-teal-700"/><span className="min-w-0 flex-1">{p.label}</span><span aria-hidden="true" className="text-teal-600">→</span></Link></li>)}
   </ul>
  </nav>
 </section>;
}
