'use client';
import {useCallback,useEffect,useState} from 'react';
import {AdminPageHead,Alert,Kpis} from '@/components/admin-ui';
type Draft={text:string;question:string;hashtags:string[];party:string|null};
type Fit={percent:number;parts:{key:string;label:string;points:number;max:number}[]};
type Summary={count:number;avgFit:number|null;strong:number;daysWithTopic:number;days:number;minFit:number};
type Topic={fit:Fit;draft:Draft|null;id:string;title:string;date:string;status:string;region:string;regionId:string;gremium:string;group:string;term:string;score:number;why:string[];otherPlaces:number;link:string;search:string};
type Day={date:string;topics:Topic[]};
type Data={summary:Summary;computedAt:string;from:string;to:string;scanned:number;matched:number;days:Day[];error?:string};
const full=(d:Draft)=>d.text+'\n'+d.question+'\n'+d.hashtags.join(' ');
/** Textvorschlag mit Kopieren-Knopf; feste Vorlagen, Zahlen und Namen stammen aus dem Eintrag. */
function DraftBox({d}:{d:Draft}){
 const [done,setDone]=useState(false);
 const copy=async()=>{try{await navigator.clipboard.writeText(full(d));setDone(true);setTimeout(()=>setDone(false),1500);}catch{/* Zwischenablage nicht erlaubt */}};
 return <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[14px] leading-snug">
  <p className="font-medium">{d.text}</p>
  <p className="mt-1 text-slate-600">{d.question}</p>
  <p className="mt-1 text-[12px] text-teal-700">{d.hashtags.join(' ')}</p>
  <button type="button" onClick={copy} className="mt-2 text-[12px] text-teal-600">{done?'Kopiert ✓':'Text kopieren →'}</button>
 </div>;
}
const fitClass=(p:number)=>p>=70?'bg-teal-50 text-teal-700':p>=50?'bg-slate-100 text-slate-700':'bg-amber-50 text-amber-700';
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
  <div className="mt-6"><Kpis label="Kennzahlen der Vorschläge" items={[
   {label:'Ø Eignung',value:data?(data.summary.avgFit===null?'–':data.summary.avgFit+' %'):undefined,note:'Mittel über alle Vorschläge; 100 % wäre ein Thema mit allem, was gut teilbar ist'},
   {label:'Vorschläge',value:data?data.summary.count:undefined,note:'ab '+(data?.summary.minFit??40)+' % Eignung, höchstens 3 je Tag'},
   {label:'Davon stark (ab 70 %)',value:data?data.summary.strong:undefined,note:'am ehesten sofort verwendbar'},
   {label:'Tage mit Vorschlag',value:data?data.summary.daysWithTopic:undefined,of:data?.summary.days,note:'schwache Tage bleiben leer'},
  ]}/></div>
  <p className="mt-4 max-w-[760px] text-[12px] leading-[1.5] text-slate-500">
   Eignung = Streitpotenzial (30) + Alltagsnähe (20) + Reichweite des Ortes (15) + Aktualität (15) + Konkretheit (10) + Verständlichkeit (10).
   Reine Regelrechnung, keine Vorhersage von Klicks.
  </p>
  <label className="mt-6 flex items-center gap-2 text-[14px] text-slate-600"><input type="checkbox" checked={onlyFilled} onChange={e=>setOnlyFilled(e.target.checked)}/>Tage ohne Vorschlag ausblenden</label>
  <div className="mt-4 space-y-8">
   {days.map(d=><section key={d.date} aria-label={dayName(d.date)}>
    <h2 className="text-[16px] font-semibold">{dayName(d.date)}</h2>
    {d.topics.length===0?<p className="mt-2 text-[14px] text-slate-500">Kein auffälliges Thema.</p>:
     <ul className="mt-3 grid gap-4 lg:grid-cols-3">
      {d.topics.map(t=><li key={t.id} className="rounded-xl border border-slate-200 bg-white p-4">
       <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[18px] font-semibold">{t.region}</h3>
        <span className={'shrink-0 rounded px-2 py-0.5 text-[13px] font-semibold tabular-nums '+fitClass(t.fit.percent)} title={t.fit.parts.map(p=>p.label+' '+p.points+' von '+p.max).join('\n')}>{t.fit.percent} %</span>
       </div>
       <p className="mt-1 text-[12px] text-slate-500">{t.group} · Eignung für Social Media</p>
       <p className="mt-2 text-[15px] leading-snug"><a className="text-teal-600" href={t.link}>{t.title}</a></p>
       {t.draft&&<DraftBox d={t.draft}/>}
       <p className="mt-2 text-[11px] leading-snug text-slate-500">{t.fit.parts.map(p=>p.label+' '+p.points+'/'+p.max).join(' · ')}</p>
       <p className="mt-2 text-[13px] text-slate-500">{t.gremium&&t.gremium+' · '}{STATUS[t.status]||t.status}</p>
       <p className="mt-2 flex flex-wrap gap-1.5 text-[12px]">{t.why.map(w=><span key={w} className="rounded bg-teal-50 px-2 py-0.5 text-teal-700">{w}</span>)}</p>
       <p className="mt-3 text-[12px] text-slate-500">{t.otherPlaces?`„${t.term}“ gab es im Zeitraum auch in ${t.otherPlaces} anderen Orten · `:''}Stärke {t.score} · <a className="text-teal-600" href={t.search}>Suche öffnen →</a></p>
      </li>)}
     </ul>}
   </section>)}
  </div>
 </>;
}
