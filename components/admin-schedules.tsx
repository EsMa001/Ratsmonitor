'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {AdminPageHead,Befund,Zahlen,Abschnitt,Hinweis,Fehler,Laden} from '@/components/admin-ui';
import {adminHref,type AdminPage} from '@/components/admin-chrome';
import {IconChevronDown} from '@/components/ratsmonitor/components/icons';
import {FLOWS} from '@/shared/pipeline-terms.mjs';
import {AltbestandSteuern} from '@/components/admin-altbestand';
import {PdfSteuern} from '@/components/admin-pdf';
import {FehlerSteuern} from '@/components/admin-fehler';
import {SpeicherSteuern} from '@/components/admin-storage';
import {Icon} from '@/components/admin-icons';
import {n,when,clock,dur} from '@/components/admin-format';

/* Seite „Steuerung“ (früher „Jobs & Zeitpläne“; server/integrations/schedules.mjs, Route /api/admin/zeitplaene): die einzige Stelle
   mit Schaltern (requirements/admin-konzept.md, B1a). Alle Jobs nach Ablauf gruppiert, mit Schalter, Zeit, Jetzt ausführen und
   Anhalten; was ein Job tut, klappt auf. Lese-Seiten springen mit #job-<id> hierher. Unten der Ablauf der Nacht. */
type Setting={enabled:boolean;time?:string;every?:number};
type RunInfo={lastStart?:string;lastEnd?:string;seconds?:number;exit?:number|string;result?:'ok'|'failed'|'stopped';skipped?:boolean;trigger?:string;running?:{pid:number;startedAt:string}|null};
type Job={id:string;label:string;flow:string;icon:string;time?:string;every?:number;window?:[string,string];what:string;steps:string[];limits?:string;warn?:string;setting:Setting;run:RunInfo|null;now:string|null;stop:string|null;next:string|null};
type Data={jobs:Job[];managed:boolean;error?:string};
const EVERY=[10,20,30,60,120];
/* Übliche Dauer, solange noch kein Lauf vermerkt ist (Minuten) */
const TYPICAL:Record<string,number>={'import-nightly':170,backup:20,'startseite-trends':2,'pdf-nightly':180,'rule-texts':10,accounts:1,betrieb:1,'social-videos':15};
// Schreiben beide viel in die Datenbank: überlappen sie, kann einer an einer Sperre scheitern (so am 12.10.2026 um 02:00)
const CLASH=[['import-nightly','pdf-nightly'],['import-nightly','backup'],['pdf-nightly','rule-texts']];
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

/** Gruppen der Steuerung: die drei Abläufe (FLOWS), dazu der Betrieb (Sichern, Konten, Mails, Prüfung, Startseite) */
// Betrieb: Sichern, Konten, Mails, Prüfung, Startseite und der Job der PDF-Aufträge und Messungen (Bahnen, Stand, Speicher)
const BETRIEB=['backup','accounts','notify','betrieb','startseite-trends','social-videos','pdf-job'];
const GROUPS:{id:string;title:string;sub:string;open:boolean;has:(j:Job)=>boolean}[]=[
 {id:'tages',title:FLOWS.tages.name,sub:'Jede Nacht: holt und verarbeitet, was neu ist.',open:true,has:j=>j.flow==='tages'&&!BETRIEB.includes(j.id)},
 {id:'nacharbeit',title:FLOWS.nacharbeit.name,sub:'Tagsüber von selbst: versucht erneut, was nachts gescheitert ist.',open:true,has:j=>j.flow==='nacharbeit'},
 {id:'altbestand',title:FLOWS.altbestand.name,sub:'Nur auf Knopfdruck: Älteres abrufen und aufarbeiten, Aufträge abarbeiten.',open:false,has:j=>j.flow==='altbestand'&&!BETRIEB.includes(j.id)},
 {id:'betrieb',title:'Betrieb',sub:'Sichern, Konten, Benachrichtigungen, Betriebsprüfung, Startseite, Social-Videos, PDF-Bahnen und Messungen.',open:false,has:j=>BETRIEB.includes(j.id)},
];
/** Wo man das Ergebnis eines Jobs ansieht */
const RESULT_PAGE:Record<string,AdminPage>={'import-nightly':'nacht','pdf-nightly':'pdf','rule-texts':'regeltexte',nacharbeit:'fehler',ocr:'pdf',altbestand:'altbestand',import:'abruf','pdf-job':'pdf',backup:'speicher',betrieb:'start'};
const pending=(j:Job)=>!!j.now&&(!j.run?.lastStart||j.now>j.run.lastStart);

/** Ein Job: Name, Zustand und nächster Start; rechts Schalter, Zeit und Knöpfe; was er tut, klappt auf */
function JobCard({j,busy,post,toggle,onBadTime}:{j:Job;busy:string;post:(b:Record<string,unknown>,c?:string)=>void;toggle:(j:Job)=>void;onBadTime:()=>void}){
 const [open,setOpen]=useState(false);
 const page=RESULT_PAGE[j.id];
 return <li id={'job-'+j.id} className="scroll-mt-36 border-b border-slate-200 py-4">
  <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 md:grid-cols-[minmax(0,1fr)_320px]">
   <div className="min-w-0">
    <button type="button" aria-expanded={open} onClick={()=>setOpen(!open)} className="flex items-center gap-2 text-left">
     <IconChevronDown size={14} className={'shrink-0 text-teal-700 transition-transform '+(open?'':'-rotate-90')}/>
     <span className={'text-[16px] font-semibold '+(j.setting.enabled?'text-slate-900':'text-slate-500')}>{j.label}</span>
     {!j.setting.enabled&&<span className="text-[14px] text-slate-500">ausgeschaltet</span>}</button>
    <p className="m-0 mt-1 pl-[22px] text-[14px]"><Status job={j}/></p>
    <p className="m-0 pl-[22px] text-[14px] text-slate-500">{j.setting.enabled&&j.next?`Nächster Start ${when(j.next)}`:'Startet nicht von selbst'}{j.window?` · nur ${j.window[0]} bis ${j.window[1]} Uhr`:''}{page&&<> · <Link href={adminHref(page)} className="text-teal-700">Ergebnis ansehen →</Link></>}</p>
    {!j.setting.enabled&&j.warn&&<p className="m-0 mt-1 border-l-2 border-amber-500 pl-3 text-[14px] text-slate-700">{j.warn}</p>}
   </div>
   <div className="space-y-2 text-[14px] max-md:pl-[22px]">
    <div className="flex items-center justify-between gap-3">
     <label className="flex cursor-pointer items-center gap-3">
      <input type="checkbox" role="switch" checked={j.setting.enabled} disabled={busy===j.id} onChange={()=>toggle(j)} className="peer sr-only"/>
      <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-teal-600 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600 peer-focus-visible:ring-offset-2"><i className={'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all '+(j.setting.enabled?'left-[22px]':'left-0.5')}/></span>
      <span className="sr-only">{j.label} </span><span>{j.setting.enabled?'an':'aus'}</span></label>
     {j.setting.time?<label className="flex items-center gap-2"><span className="text-slate-500">täglich</span>
       <input type="time" step={600} defaultValue={j.setting.time} key={j.setting.time} disabled={busy===j.id} className="h-9 rounded-lg border border-slate-300 px-2 tabular-nums"
        onBlur={e=>{const t=e.currentTarget.value;if(t&&t!==j.setting.time){if(!/[0-5]0$/.test(t)){onBadTime();e.currentTarget.value=j.setting.time!;return;}post({action:'set',id:j.id,time:t});}}}/></label>
      :<label className="flex items-center gap-2"><span className="text-slate-500">alle</span>
       <select value={j.setting.every} disabled={busy===j.id} onChange={e=>post({action:'set',id:j.id,every:Number(e.target.value)})} className="h-9 rounded-lg border border-slate-300 px-2">{EVERY.map(m=><option key={m} value={m}>{m<60?`${m} Minuten`:`${m/60} ${m===60?'Stunde':'Stunden'}`}</option>)}</select></label>}
    </div>
    <div className="flex flex-wrap justify-end gap-x-4 gap-y-1">
     {j.run?.running&&(j.stop&&j.stop>j.run.running.startedAt?<span className="text-slate-500">wird angehalten …</span>
      :<button type="button" className="font-medium text-slate-900 hover:text-teal-700 disabled:opacity-40" disabled={busy===j.id}
       onClick={()=>post({action:'stop',id:j.id},`„${j.label}“ jetzt anhalten? Der laufende Job endet sofort; was er schon erledigt hat, bleibt.${j.warn?' '+j.warn:''}`)}>Anhalten</button>)}
     {j.id==='rule-texts'&&<button type="button" className="font-medium text-teal-700 hover:text-teal-800 disabled:opacity-40" disabled={busy===j.id||!!j.run?.running||pending(j)}
      onClick={()=>post({action:'all',id:j.id},'Alle Berichte neu einordnen und Zusammenfassungen, Fakten und Suche neu erstellen? Das dauert deutlich länger als ein normaler Lauf.')}>Alle neu erstellen →</button>}
     <button type="button" className="font-medium text-teal-700 hover:text-teal-800 disabled:opacity-40" disabled={busy===j.id||!!j.run?.running||pending(j)}
      onClick={()=>post({action:'now',id:j.id},`„${j.label}“ jetzt einmal ausführen? Er startet sofort.`)}>{pending(j)?'Start angefordert …':'Jetzt ausführen →'}</button>
    </div>
   </div>
  </div>
  {open&&<div className="mt-3 max-w-[820px] pl-[22px] text-[14px]">
   <p className="m-0 text-slate-700">{j.what}</p>
   <ol className="m-0 mt-2 list-none space-y-1 p-0 text-slate-500">{j.steps.map((s,i)=><li key={s} className="flex gap-2"><span className="w-4 shrink-0 text-right tabular-nums text-slate-400">{i+1}</span><span>{s}</span></li>)}</ol>
   {j.limits&&<p className="m-0 mt-2 text-slate-700">{j.limits}</p>}
  </div>}
 </li>;
}

export function AdminSchedules(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[lastLoad,setLastLoad]=useState(0);
 const load=useCallback(async()=>{
  try{const r=await fetch('/api/admin/zeitplaene',{cache:'no-store'});const d=await r.json() as Data;if(!r.ok)throw Error(d.error||'Die Jobs konnten nicht geladen werden.');setData(d);setError('');setLastLoad(Date.now());}
  catch(e){setError(e instanceof Error?e.message:'Die Jobs konnten nicht geladen werden.');}
 },[]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Abruf beim Öffnen; State wird erst nach dem await gesetzt
 useEffect(()=>{load();const t=setInterval(load,60000);return ()=>clearInterval(t);},[load]);
 const post=async(body:Record<string,unknown>,confirmText?:string)=>{
  if(confirmText&&!window.confirm(confirmText))return;
  setBusy(String(body.id));
  try{const r=await fetch('/api/admin/zeitplaene',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||'Das ging nicht.');await load();}
  catch(e){setError(e instanceof Error?e.message:'Das ging nicht.');}
  finally{setBusy('');}
 };
 const toggle=(j:Job)=>post({action:'set',id:j.id,enabled:!j.setting.enabled},j.setting.enabled?`„${j.label}“ ausschalten? Der Job startet dann nicht mehr von selbst${j.warn?'. '+j.warn:''}.`:undefined);
 // Sprung von einer Lese-Seite (?job=…#job-…): die Gruppe des Jobs aufklappen und hinscrollen
 const hash=useSearchParams().get('job')||'';
 useEffect(()=>{if(!data||!hash)return;const t=setTimeout(()=>document.getElementById('job-'+hash)?.scrollIntoView({block:'start'}),50);return ()=>clearTimeout(t);},[data,hash]);
 const jobs=data?.jobs||[],running=jobs.filter(j=>j.run?.running),failedLast=jobs.filter(j=>j.setting.enabled&&j.run?.result==='failed'&&!j.run.running),off=jobs.filter(j=>!j.setting.enabled);
 const next=jobs.filter(j=>j.setting.enabled&&j.next).sort((a,b)=>String(a.next).localeCompare(String(b.next)))[0];
 const befund=!data?null:`${running.length?`Läuft gerade: ${running.map(j=>j.label).join(', ')}.`:'Gerade läuft nichts.'}${next?` Nächster Start: ${next.label}, ${when(next.next)}.`:''}${failedLast.length?` Zuletzt mit Fehler: ${failedLast.map(j=>j.label).join(', ')}.`:''}`;
 const card=(j:Job)=><JobCard key={j.id} j={j} busy={busy} post={(b,c)=>void post(b,c)} toggle={j=>void toggle(j)} onBadTime={()=>setError('Uhrzeit bitte in 10-Minuten-Schritten (etwa 01:00 oder 05:30).')}/>;

 return <>
  <AdminPageHead page="steuerung" figure={data?{value:n(running.length),label:running.length===1?'Job läuft':'Jobs laufen',note:next?`nächster ${clock(next.next)}`:undefined}:undefined}/>
  {error&&<Fehler onRetry={load}>{error}</Fehler>}
  {!data&&!error&&<Laden/>}
  {data&&<>
   <Befund stand={<>Stand {when(new Date(lastLoad).toISOString())} · aktualisiert sich jede Minute · Starten, Anhalten und Zeitpläne liegen nur hier</>}>{befund}</Befund>
   <Zahlen items={[{value:`${n(jobs.length-off.length)} von ${n(jobs.length)}`,label:'eingeschaltet'},{value:n(failedLast.length),label:'zuletzt mit Fehler'}]}/>
   {!data.managed&&<Hinweis>Noch kein Job ist über den Zeitplaner gelaufen. Auf dem Server laufen die Jobs dann noch zu ihren festen Zeiten, Änderungen hier wirken erst nach der Umstellung der Auslöser (docs/betrieb/node-server.md, „Zeitplaner“).</Hinweis>}

   {running.length>0&&<Abschnitt title="Läuft gerade"><ul className="m-0 mt-2 max-w-[1100px] list-none border-t border-slate-200 p-0">{running.map(card)}</ul></Abschnitt>}
   {GROUPS.map(g=>{const list=jobs.filter(g.has).filter(j=>!j.run?.running);if(!list.length)return null;
    return <Abschnitt key={g.id} id={'steuerung-'+g.id} open={g.open} force={list.some(j=>j.id===hash)} title={g.title} sub={g.sub}>
     <ul className="m-0 mt-2 max-w-[1100px] list-none border-t border-slate-200 p-0">{list.map(card)}</ul>
     {g.id==='nacharbeit'&&<FehlerSteuern/>}
     {g.id==='betrieb'&&<><PdfSteuern teil="bahnen"/><SpeicherSteuern/></>}
     {g.id==='altbestand'&&<><div className="mt-6 max-w-[1100px] text-[14px]"><h3 className="m-0 text-[16px] font-semibold">Abrufauftrag</h3>
      <p className="m-0 mt-1 text-slate-500">Gebiete in Karte oder Liste wählen und mit Zeitraum abrufen; der Job „Abrufaufträge“ arbeitet ihn auf dem Server ab. <Link href={adminHref('abruf','auftrag=1')} className="font-medium text-teal-700">Abrufauftrag anlegen →</Link></p></div>
      <AltbestandSteuern/><PdfSteuern teil="auftraege"/></>}</Abschnitt>;})}

   <Abschnitt id="steuerung-nacht" open={false} title="Ablauf der Nacht" sub="Die nächtlichen Jobs bauen aufeinander auf: erst sichern, dann abrufen, dann PDFs, Texte und OCR, dann Einordnung, Suche und Zahlen. Sie sollten sich nicht überschneiden.">
    <DayPlan jobs={jobs.filter(j=>j.id!=='accounts'&&j.id!=='betrieb')}/>
   </Abschnitt>
  </>}
 </>;
}
