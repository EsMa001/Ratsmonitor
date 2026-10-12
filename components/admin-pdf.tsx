'use client';
import {useCallback,useEffect,useState} from 'react';
import {AdminPageHead,Alert,Kpis} from '@/components/admin-ui';
type Stats={at:string;seconds:number;linked:number;allPdfs:number;oldest?:{loaded:string|null;tried:string|null;linked:string|null};loaded:number;textOnly:number;failed:number;open:number;
 reasons:{reason:string;n:number}[];bytes:{pdf:number;text:number;used:number};budgetGb:number;texts:{files:number;ocrWaiting:number;linked?:number;complete?:number};
 others?:{linked:number;loaded:number;textOnly:number;failed:number;open:number;withText:number;scans:number;reasons:{reason:string;n:number}[]}};
type Kind='run'|'retry'|'others';
type Job={kind:Kind;state:'waiting'|'running'|'done'|'failed';requestedAt:string;startedAt?:string;finishedAt?:string;updatedAt?:string;exit?:number|string};
type Data={stats:Stats|null;job:Job|null;error?:string};
const n=(v:number)=>v.toLocaleString('de-DE');
const pct=(a:number,b:number)=>b?(Math.round((a/b)*1000)/10).toLocaleString('de-DE')+' %':'–';
const gb=(b:number)=>(b/1073741824).toLocaleString('de-DE',{maximumFractionDigits:1})+' GB';
const when=(d?:string)=>d?new Date(d).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'–';
const day=(d?:string|null)=>d?d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(0,4):'–';
const KIND={run:'Lauf',retry:'Lauf mit erneutem Versuch der Fehlgeschlagenen',others:'Lauf für die übrigen PDFs'};
const STATE={waiting:'wartet auf den Start (der Server sieht alle 10 Minuten nach)',running:'läuft',done:'fertig',failed:'mit Fehlern beendet'};

/** PDF-Ablage: verlinkte PDFs, geladen, nur Text, fehlgeschlagen (mit Gründen), Texte, Platz; übrige PDFs getrennt; Lauf von Hand anstoßen. */
export function AdminPdf(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  try{const r=await fetch('/api/admin/pdf-ablage',{cache:'no-store'});const d=await r.json() as Data;if(!r.ok)throw Error(d.error||'Der Stand konnte nicht geladen werden.');setData(d);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Der Stand konnte nicht geladen werden.');}
 },[]);
 useEffect(()=>{load();},[load]);
 // Solange ein Auftrag wartet oder läuft, jede Minute neu laden
 const pending=data?.job?.state==='waiting'||data?.job?.state==='running';
 useEffect(()=>{if(!pending)return;const t=setInterval(load,60000);return ()=>clearInterval(t);},[pending,load]);
 const start=async(kind:Kind)=>{
  setBusy(true);
  try{const r=await fetch('/api/admin/pdf-ablage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind})});const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||'Der Auftrag konnte nicht angelegt werden.');await load();}
  catch(e){setError(e instanceof Error?e.message:'Der Auftrag konnte nicht angelegt werden.');}
  finally{setBusy(false);}
 };
 const s=data?.stats,job=data?.job,o=s?.others;
 // Geladen, aber noch kein Stand (kein Lauf bisher): Striche statt Ladepunkten
 const v=<T,>(f:(x:Stats)=>T):T|string|undefined=>s?f(s):data?'–':undefined;
 const btn='h-9 rounded-lg px-4 text-[14px] font-medium disabled:opacity-50';
 return <>
  <AdminPageHead page="pdf">
   <p className="text-[13px] text-slate-500">{s?`Stand ${when(s.at)} (nach dem letzten Lauf gezählt)`:data?'Noch kein Stand: er entsteht nach dem ersten Lauf.':'Wird geladen …'}</p>
  </AdminPageHead>
  {error&&<Alert onRetry={load}>{error}</Alert>}
  <div className="mt-6"><Kpis label="Stand der PDF-Ablage" items={[
   {label:'Verlinkte PDFs',value:v(s=>n(s.linked)),note:s?`Hauptdokument je Bericht; insgesamt ${n(s.allPdfs)} PDF-Dokumente verlinkt`:undefined},
   {label:'Heruntergeladen',value:v(s=>pct(s.loaded+s.textOnly,s.linked)),note:s?`${n(s.loaded)} als PDF, ${n(s.textOnly)} nur noch als Text`:undefined},
   {label:'Mit Text',value:v(s=>pct(s.texts.linked??0,s.linked)),note:s?`${n(s.texts.linked??0)} Dokumente, davon ${n(s.texts.complete??0)} vollständig; ${n(s.texts.ocrWaiting)} warten auf OCR`:undefined},
   {label:'Fehlgeschlagen',value:v(s=>pct(s.failed,s.linked)),note:s?`${n(s.failed)} Dokumente, werden nicht erneut versucht`:undefined},
   {label:'Noch nicht versucht',value:v(s=>pct(s.open,s.linked)),note:s?`${n(s.open)} Dokumente`:undefined},
   {label:'Ältestes geladenes Dokument',value:v(s=>day(s.oldest?.loaded)),note:s?`Sitzungstag; so weit ist der Lauf zurück (versucht bis ${day(s.oldest?.tried)}). Älteste verlinkte Sitzung: ${day(s.oldest?.linked)}`:undefined},
   {label:'Platz',value:v(s=>gb(s.bytes.used)),of:s?s.budgetGb+' GB':undefined,note:s?`PDFs ${gb(s.bytes.pdf)}, Texte ${gb(s.bytes.text)}`:undefined},
  ]}/></div>

  <section className="mt-10" aria-label="Übrige PDFs">
   <h2 className="text-[22px] font-semibold">Übrige PDFs der Berichte</h2>
   <p className="mt-1 max-w-[760px] text-[14px] text-slate-500">Anlagen, Pläne und weitere Unterlagen, die in keinem Bericht Hauptdokument sind. Sie werden nur in einem eigenen Lauf geladen. Gespeichert wird ihre Textebene, ohne OCR. Als PDF bleiben sie nur, wenn sie in die Grenze passen.</p>
   <div className="mt-4"><Kpis label="Stand der übrigen PDFs" items={[
    {label:'Verlinkt',value:o?n(o.linked):v(()=>'–'),note:o?'übrige PDF-Dokumente':undefined},
    {label:'Heruntergeladen',value:o?pct(o.loaded+o.textOnly,o.linked):v(()=>'–'),note:o?`${n(o.loaded)} als PDF, ${n(o.textOnly)} nur noch als Text`:undefined},
    {label:'Mit Text',value:o?pct(o.withText,o.linked):v(()=>'–'),note:o?`${n(o.withText)} Dokumente; ${n(o.scans)} Scans ohne Textebene`:undefined},
    {label:'Fehlgeschlagen',value:o?pct(o.failed,o.linked):v(()=>'–'),note:o?`${n(o.failed)} Dokumente${o.reasons[0]?`, meist ${o.reasons[0].reason}`:''}`:undefined},
    {label:'Noch nicht versucht',value:o?pct(o.open,o.linked):v(()=>'–'),note:o?`${n(o.open)} Dokumente`:undefined},
   ]}/></div>
  </section>

  <section className="mt-10" aria-label="Lauf anstoßen">
   <h2 className="text-[22px] font-semibold">Lauf von Hand</h2>
   <p className="mt-1 max-w-[760px] text-[14px] text-slate-500">Der Lauf ist derselbe wie nachts: neue Dokumente laden (neueste Sitzungen zuerst, feste Grenze mit Tausch), Texte, OCR, Zusammenfassungen, Fakten, Wortliste, danach dieser Stand. Er dauert bis zu drei Stunden. Fehlgeschlagene Abrufe werden sonst nie erneut versucht; mit dem zweiten Knopf in diesem Lauf einmal schon. Der dritte Knopf lädt in einem eigenen Lauf die übrigen PDFs (neueste Sitzungen zuerst, nur Textebene) und zählt danach diesen Stand neu.</p>
   <div className="mt-4 flex flex-wrap gap-3">
    <button type="button" className={btn+' bg-teal-600 text-white hover:bg-teal-700'} disabled={busy||pending} onClick={()=>start('run')}>Lauf starten</button>
    <button type="button" className={btn+' bg-slate-100 text-slate-800 hover:bg-slate-200'} disabled={busy||pending} onClick={()=>start('retry')}>Fehlgeschlagene erneut versuchen</button>
    <button type="button" className={btn+' bg-slate-100 text-slate-800 hover:bg-slate-200'} disabled={busy||pending} onClick={()=>start('others')}>Übrige PDFs laden</button>
   </div>
   {job&&<p role="status" className="mt-3 text-[14px] text-slate-700">{KIND[job.kind]}, angefordert {when(job.requestedAt)}: <strong>{job.exit==='abgebrochen'?'abgebrochen':STATE[job.state]}</strong>{job.startedAt&&`, gestartet ${when(job.startedAt)}`}{job.finishedAt&&`, beendet ${when(job.finishedAt)}`}.</p>}
  </section>

  <section className="mt-10" aria-label="Gründe der Fehlschläge">
   <h2 className="text-[22px] font-semibold">Warum Abrufe fehlschlagen</h2>
   <p className="mt-1 text-[14px] text-slate-500">Anteil an den fehlgeschlagenen Abrufen. Die Liste je Dokument gibt <code>node scripts/pdf-store/fetch.mjs --errors --csv fehler.csv</code> auf dem Server aus.</p>
   {s&&s.reasons.length===0&&<p className="mt-3 text-[14px] text-slate-500">Keine Fehlschläge.</p>}
   {s&&s.reasons.length>0&&<ol className="m-0 mt-3 max-w-[760px] list-none border-t border-slate-200 p-0">
    {s.reasons.map(r=><li key={r.reason} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-slate-200 py-2.5 text-[15px]">
     <span className="min-w-0">{r.reason}<span className="mt-1.5 block h-[3px] rounded-full bg-slate-100"><span className="block h-full rounded-full bg-teal-600" style={{width:`${Math.max(2,(r.n/Math.max(1,s.failed))*100)}%`}}/></span></span>
     <span className="text-right tabular-nums"><b className="font-semibold">{n(r.n)}</b><span className="ml-2 text-[13px] text-slate-500">{pct(r.n,s.failed)}</span></span>
    </li>)}
   </ol>}
  </section>
 </>;
}
