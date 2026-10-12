'use client';
import {useCallback,useEffect,useState} from 'react';
import {AdminPageHead,Alert} from '@/components/admin-ui';
import {Icon} from '@/components/admin-icons';
import {when,clock,dur} from '@/components/admin-pdf-parts';

/* Reiter „Jobs & Zeitpläne“ (server/integrations/schedules.mjs, Route /api/admin/zeitplaene): alle Jobs, die auf dem Server von
   selbst laufen, mit Schalter, Zeit, letztem und nächstem Lauf; oben der Tagesablauf der nächtlichen Jobs. */
type Setting={enabled:boolean;time?:string;every?:number};
type RunInfo={lastStart?:string;lastEnd?:string;seconds?:number;exit?:number|string;result?:'ok'|'failed'|'stopped';skipped?:boolean;trigger?:string;running?:{pid:number;startedAt:string}|null};
type Job={id:string;label:string;icon:string;time?:string;every?:number;what:string;steps:string[];limits?:string;warn?:string;setting:Setting;run:RunInfo|null;now:string|null;stop:string|null;next:string|null};
type Data={jobs:Job[];managed:boolean;error?:string};
const EVERY=[10,20,30,60,120];
/* Übliche Dauer, solange noch kein Lauf vermerkt ist (Minuten) */
const TYPICAL:Record<string,number>={'import-nightly':170,backup:20,'search-words':5,'pdf-nightly':180};
// Schreiben beide viel in die Datenbank: überlappen sie, kann einer an einer Sperre scheitern (so am 12.10.2026 um 02:00)
const CLASH=[['import-nightly','pdf-nightly'],['import-nightly','search-words'],['pdf-nightly','search-words']];
const mins=(t:string)=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
const hhmm=(m:number)=>String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0');

/** Tagesablauf: je täglicher Job ein Balken von der Startzeit über die Dauer des letzten Laufs (sonst üblich) */
function DayPlan({jobs}:{jobs:Job[]}){
 const daily=jobs.filter(j=>j.setting.time);
 const span=(j:Job)=>{const a=mins(j.setting.time!),d=Math.max(10,Math.round((j.run?.seconds??(TYPICAL[j.id]||30)*60)/60));return [a,a+d] as const;};
 const clashes=CLASH.filter(([a,b])=>{const x=daily.find(j=>j.id===a),y=daily.find(j=>j.id===b);if(!x||!y||!x.setting.enabled||!y.setting.enabled)return false;
  const [a1,a2]=span(x),[b1,b2]=span(y);const ov=(p:number,q:number,r:number,s:number)=>p<s&&r<q;return ov(a1,a2,b1,b2)||ov(a1+1440,a2+1440,b1,b2)||ov(a1,a2,b1+1440,b2+1440);});
 return <div className="mt-4 max-w-[980px]">
  <div className="relative ml-[150px] h-5 text-[12px] text-slate-500">{[0,3,6,9,12,15,18,21].map(h=><span key={h} className="absolute -translate-x-1/2" style={{left:`${h/24*100}%`}}>{String(h).padStart(2,'0')}</span>)}</div>
  <ul className="m-0 list-none space-y-2 p-0">
   {daily.map(j=>{const [a,b]=span(j),segs=b<=1440?[[a,b]]:[[a,1440],[0,b-1440]];
    return <li key={j.id} className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-x-0 text-[14px]">
     <span className={'truncate pr-3 '+(j.setting.enabled?'':'text-slate-400 line-through')}>{j.label}</span>
     <span className="relative h-5 rounded bg-slate-50">
      {[0,3,6,9,12,15,18,21].map(h=><i key={h} className="absolute top-0 h-full w-px bg-slate-200" style={{left:`${h/24*100}%`}}/>)}
      {segs.map(([x,y],i)=><i key={i} title={`${hhmm(a)} bis etwa ${hhmm(b)}`} className={'absolute top-0.5 h-4 rounded '+(j.setting.enabled?'bg-teal-600':'bg-slate-300')} style={{left:`${x/1440*100}%`,width:`${Math.max(0.6,(y-x)/1440*100)}%`}}/>)}
     </span>
    </li>;})}
  </ul>
  <p className="mt-2 text-[12px] text-slate-500">Balken: Startzeit bis Ende des letzten Laufs (ohne vermerkten Lauf die übliche Dauer). Deutsche Zeit.</p>
  {clashes.map(([a,b])=><p key={a+b} className="mt-2 flex gap-2 text-[14px] font-medium text-slate-900"><Icon name="alert" size={18}/>{daily.find(j=>j.id===a)?.label} und {daily.find(j=>j.id===b)?.label} überschneiden sich. Beide schreiben viel in die Datenbank; einer kann dann an einer Sperre scheitern.</p>)}
 </div>;
}

function Status({job}:{job:Job}){
 const r=job.run;
 if(r?.running)return <span className="font-medium text-teal-600">läuft seit {clock(r.running.startedAt)}</span>;
 if(!r?.lastStart)return <span className="text-slate-500">noch kein Lauf über den Zeitplaner</span>;
 if(r.skipped)return <span className="text-slate-500">zuletzt ausgelassen (ausgeschaltet), {when(r.lastStart)}</span>;
 return <span className={r.result==='ok'?'text-slate-700':'font-medium text-slate-900'}>zuletzt {when(r.lastStart)}, {dur(r.seconds)}: {r.result==='ok'?'fertig':r.result==='stopped'?'angehalten':`Fehler (Exit ${r.exit})`}</span>;
}

export function AdminSchedules(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const load=useCallback(async()=>{
  try{const r=await fetch('/api/admin/zeitplaene',{cache:'no-store'});const d=await r.json() as Data;if(!r.ok)throw Error(d.error||'Die Jobs konnten nicht geladen werden.');setData(d);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Die Jobs konnten nicht geladen werden.');}
 },[]);
 useEffect(()=>{load();const t=setInterval(load,60000);return ()=>clearInterval(t);},[load]);
 const post=async(body:Record<string,unknown>,confirmText?:string)=>{
  if(confirmText&&!window.confirm(confirmText))return;
  setBusy(String(body.id));
  try{const r=await fetch('/api/admin/zeitplaene',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||'Das ging nicht.');await load();}
  catch(e){setError(e instanceof Error?e.message:'Das ging nicht.');}
  finally{setBusy('');}
 };
 const toggle=(j:Job)=>post({action:'set',id:j.id,enabled:!j.setting.enabled},j.setting.enabled?`„${j.label}“ ausschalten? Der Job startet dann nicht mehr von selbst${j.warn?'. '+j.warn:''}.`:undefined);

 return <>
  <AdminPageHead page="zeitplaene"/>
  {error&&<Alert onRetry={load}>{error}</Alert>}
  {data&&!data.managed&&<p className="mt-4 flex max-w-[820px] gap-2 text-[14px] text-slate-900"><Icon name="alert" size={18} className="mt-[1px]"/><span>Noch kein Job ist über den Zeitplaner gelaufen. Auf dem Server laufen die Jobs dann noch zu ihren festen Zeiten, Änderungen hier wirken erst nach der Umstellung der Auslöser (docs/betrieb/node-server.md, „Zeitplaner“).</span></p>}

  <section className="mt-6" aria-label="Tagesablauf">
   <h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name="moon" className="text-teal-600"/>Ablauf der Nacht</h2>
   <p className="mt-1 max-w-[820px] text-[14px] text-slate-500">Die nächtlichen Jobs bauen aufeinander auf: erst Berichte abrufen, dann sichern, dann die Wortliste, dann PDFs und ihre Auswertung. Sie sollten sich nicht überschneiden.</p>
   {data&&<DayPlan jobs={data.jobs}/>}
  </section>

  <section className="mt-12" aria-label="Jobs">
   <h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name="clock" className="text-teal-600"/>Jobs</h2>
   <ul className="m-0 mt-4 max-w-[1100px] list-none border-t border-slate-200 p-0">
    {data?.jobs.map(j=><li key={j.id} className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-4 border-b border-slate-200 py-5 md:grid-cols-[40px_minmax(0,1fr)_300px]">
     <span className={'flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 '+(j.setting.enabled?'text-teal-600':'text-slate-400')}><Icon name={j.icon}/></span>
     <div className="min-w-0">
      <h3 className="text-[18px] font-semibold">{j.label}{!j.setting.enabled&&<span className="ml-2 text-[14px] font-normal text-slate-500">ausgeschaltet</span>}</h3>
      <p className="mt-1 text-[14px] text-slate-700">{j.what}</p>
      <ol className="m-0 mt-2 list-none space-y-1 p-0 text-[14px] text-slate-500">{j.steps.map((s,i)=><li key={s} className="flex gap-2"><span className="w-4 shrink-0 text-right tabular-nums text-slate-400">{i+1}</span><span>{s}</span></li>)}</ol>
      {j.limits&&<p className="mt-2 flex gap-2 text-[14px] text-slate-700"><Icon name="clock" size={16} className="mt-[2px] text-teal-600"/>{j.limits}</p>}
      {!j.setting.enabled&&j.warn&&<p className="mt-2 flex gap-2 text-[14px] font-medium text-slate-900"><Icon name="alert" size={16} className="mt-[2px]"/>{j.warn}</p>}
     </div>
     <div className="col-span-2 mt-4 space-y-3 text-[14px] md:col-span-1 md:mt-0">
      <label className="flex cursor-pointer items-center justify-between gap-3">
       <span>{j.setting.enabled?'Eingeschaltet':'Ausgeschaltet'}</span>
       <input type="checkbox" role="switch" checked={j.setting.enabled} disabled={busy===j.id} onChange={()=>toggle(j)} className="peer sr-only"/>
       <span aria-hidden="true" className="relative h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-teal-600 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600 peer-focus-visible:ring-offset-2"><i className={'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all '+(j.setting.enabled?'left-[22px]':'left-0.5')}/></span>
      </label>
      {j.setting.time?<label className="flex items-center justify-between gap-3"><span>Täglich um</span>
        <input type="time" step={600} defaultValue={j.setting.time} key={j.setting.time} disabled={busy===j.id} className="h-9 rounded-lg border border-slate-300 px-2 tabular-nums"
         onBlur={e=>{const t=e.currentTarget.value;if(t&&t!==j.setting.time){if(!/[0-5]0$/.test(t)){setError('Uhrzeit bitte in 10-Minuten-Schritten (etwa 01:00 oder 05:30).');e.currentTarget.value=j.setting.time!;return;}post({action:'set',id:j.id,time:t});}}}/></label>
       :<label className="flex items-center justify-between gap-3"><span>Alle</span>
        <select value={j.setting.every} disabled={busy===j.id} onChange={e=>post({action:'set',id:j.id,every:Number(e.target.value)})} className="h-9 rounded-lg border border-slate-300 px-2">{EVERY.map(m=><option key={m} value={m}>{m<60?`${m} Minuten`:`${m/60} ${m===60?'Stunde':'Stunden'}`}</option>)}</select></label>}
      <p><Status job={j}/></p>
      <p className="text-slate-500">{j.setting.enabled&&j.next?`Nächster Start ${when(j.next)}`:'Startet nicht von selbst'}</p>
      {j.run?.running&&(j.stop&&j.stop>j.run.running.startedAt?<span className="text-[14px] text-slate-500">wird angehalten …</span>
       :<button type="button" className="text-[14px] font-medium text-slate-900 hover:text-teal-700 disabled:opacity-40" disabled={busy===j.id}
        onClick={()=>post({action:'stop',id:j.id},`„${j.label}“ jetzt anhalten? Der laufende Job endet sofort; was er schon erledigt hat, bleibt.${j.warn?' '+j.warn:''}`)}>Anhalten</button>)}
      <button type="button" className="text-[14px] font-medium text-teal-600 hover:text-teal-700 disabled:opacity-40" disabled={busy===j.id||!!j.run?.running||!!j.now&&(!j.run?.lastStart||j.now>j.run.lastStart)}
       onClick={()=>post({action:'now',id:j.id},`„${j.label}“ jetzt einmal ausführen? Er startet sofort.`)}>{j.now&&(!j.run?.lastStart||j.now>j.run.lastStart)?'Start angefordert …':'Jetzt ausführen →'}</button>
     </div>
    </li>)}
   </ul>
  </section>
 </>;
}
