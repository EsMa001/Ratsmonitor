'use client';
import {useCallback,useEffect,useState} from 'react';
import {AdminPageHead,Alert} from '@/components/admin-ui';
type Topic={id:string;title:string;date:string;status:string;region:string;regionId:string;gremium:string;group:string;term:string;score:number;why:string[];otherPlaces:number;link:string;search:string};
type Day={date:string;topics:Topic[]};
type Data={computedAt:string;from:string;to:string;scanned:number;matched:number;days:Day[];error?:string};
const dmy=(d:string)=>d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(0,4);
const WEEKDAY=['So','Mo','Di','Mi','Do','Fr','Sa'];
const dayName=(d:string)=>WEEKDAY[new Date(d+'T12:00:00Z').getUTCDay()]+', '+dmy(d);
const STATUS:Record<string,string>={approved:'beschlossen',recommended:'empfohlen',rejected:'abgelehnt',consulting:'in Beratung',announced:'angekündigt',info:'zur Kenntnis',postponed:'vertagt'};
/** Social Media: Themenvorschläge je Tag aus den letzten 30 Tagen (server/integrations/social-topics.mjs). */
export function AdminSocial(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[onlyFilled,setOnlyFilled]=useState(true);
 const load=useCallback(async(fresh=false)=>{
  setBusy(true);setError('');
  try{const r=await fetch('/api/admin/social'+(fresh?'?neu=1':''),{cache:'no-store'});const d=await r.json() as Data;if(!r.ok)throw Error(d.error||'Die Vorschläge konnten nicht geladen werden.');setData(d);}
  catch(e){setError(e instanceof Error?e.message:'Die Vorschläge konnten nicht geladen werden.');}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{load();},[load]);
 const days=(data?.days||[]).filter(d=>!onlyFilled||d.topics.length);
 const total=(data?.days||[]).reduce((n,d)=>n+d.topics.length,0);
 return <>
  <AdminPageHead page="social">
   <p className="text-[13px] text-slate-500">
    {busy?'Wird berechnet (kann einige Sekunden dauern) …':data?`${total} Vorschläge in den letzten 30 Tagen (${dmy(data.from)} bis ${dmy(data.to)}); ${data.matched.toLocaleString('de-DE')} von ${data.scanned.toLocaleString('de-DE')} Einträgen enthalten ein Streitwort.`:''}
    {' '}<button type="button" className="text-teal-600" disabled={busy} onClick={()=>load(true)}>Neu berechnen →</button>
   </p>
  </AdminPageHead>
  {error&&<Alert>{error}</Alert>}
  <label className="mt-6 flex items-center gap-2 text-[14px] text-slate-600"><input type="checkbox" checked={onlyFilled} onChange={e=>setOnlyFilled(e.target.checked)}/>Tage ohne Vorschlag ausblenden</label>
  <div className="mt-4 space-y-8">
   {days.map(d=><section key={d.date} aria-label={dayName(d.date)}>
    <h2 className="text-[16px] font-semibold">{dayName(d.date)}</h2>
    {d.topics.length===0?<p className="mt-2 text-[14px] text-slate-500">Kein auffälliges Thema.</p>:
     <ul className="mt-3 grid gap-4 lg:grid-cols-3">
      {d.topics.map(t=><li key={t.id} className="rounded-xl border border-slate-200 bg-white p-4">
       <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[18px] font-semibold">{t.region}</h3>
        <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[12px] text-slate-600">{t.group}</span>
       </div>
       <p className="mt-2 text-[15px] leading-snug"><a className="text-teal-600" href={t.link} target="_blank" rel="noreferrer">{t.title}</a></p>
       <p className="mt-2 text-[13px] text-slate-500">{t.gremium&&t.gremium+' · '}{STATUS[t.status]||t.status}</p>
       <p className="mt-2 flex flex-wrap gap-1.5 text-[12px]">{t.why.map(w=><span key={w} className="rounded bg-teal-50 px-2 py-0.5 text-teal-700">{w}</span>)}</p>
       <p className="mt-3 text-[12px] text-slate-500">{t.otherPlaces?`„${t.term}“ gab es im Zeitraum auch in ${t.otherPlaces} anderen Orten · `:''}Stärke {t.score} · <a className="text-teal-600" href={t.search} target="_blank" rel="noreferrer">Suche öffnen →</a></p>
      </li>)}
     </ul>}
   </section>)}
  </div>
 </>;
}
