'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {AdminPageHead,Alert,Kpis} from '@/components/admin-ui';
import {adminHref} from '@/components/admin-chrome';
import {Icon} from '@/components/admin-icons';
import {n,pct,gb,when,clock,day,month,dur,KIND,MonthBars,SpaceBar,ProcessFlow,HostList,RunList,QualityTable,scorePct,type MonthRow,type Host,type Run,type Quality} from '@/components/admin-pdf-parts';

/* Reiter „PDF-Import“ (requirements/admin-pdf-ablage-konzept.md): was gerade läuft, wie vollständig die Ablage ist, Texte und
   Auswertung, Platz, wie der Import arbeitet, Fehler und Server, Protokoll. Daten: /api/admin/pdf-ablage
   (server/integrations/pdf-store-admin.mjs); die Seite rechnet nichts, sie liest, was die Skripte auf dem Server ablegen. */
type Reason={reason:string;n:number};
type Stats={at:string;seconds:number;linked:number;allPdfs:number;loaded:number;textOnly:number;failed:number;open:number;openBlocked?:number;reasons:Reason[];
 oldest?:{loaded:string|null;tried:string|null;linked:string|null};completeThrough?:string|null;
 bytes:{pdf:number;pdfPrimary?:number;pdfOthers?:number;text:number;used:number};budgetGb:number;
 threshold?:{others:boolean;score?:number}|null;disk?:{free:number;total:number}|null;
 texts:{files:number;ocrWaiting:number;ocrPages?:number;ocrWaitingAll?:number;ocrPagesAll?:number;missing?:number;linked?:number;complete?:number};summaries?:{withText:number;done:number};
 others?:{linked:number;loaded:number;textOnly:number;failed:number;open:number;openBlocked?:number;withText:number;scans:number;reasons:Reason[];completeThrough?:string|null};
 quality?:Quality;months?:{primary:MonthRow[];others:MonthRow[]};hosts?:{total:number;blocked:number;top:Host[]};errorsCsv?:{rows:number}};
type Job={id:string;kind:'run'|'retry'|'others'|'texts'|'ocr';state:string;requestedAt:string;startedAt?:string;finishedAt?:string;exit?:number|string};
type Progress={kind?:string;startedAt?:string;until?:string;step?:string;at:string;plan?:string[];stepIndex?:number;stepStartedAt?:string;stepUntil?:string;
 fetch?:{what:string;month:string;monthOpen:number;done:number;ok:number;unsupported:number;error:number;rate:number;bytes:number};
 text?:{done:number;total:number;failed:number;waiting:number};ocr?:{done:number;total:number;pages:number;failed:number;workers:number;perHour:number|null;fetched?:number;slow?:number}};
type Lane='chain'|'ocr';
type Data={stats:Stats|null;jobs:{queue:Job[];running:Record<Lane,Job|null>;recent:Job[]};progress:{chain:Progress|null;ocr:Progress|null};runs:Run[];
 stop:{chain?:{requestedAt:string};ocr?:{requestedAt:string}};count:{requestedAt:string;startedAt?:string;finishedAt?:string;ok?:boolean}|null;worker:boolean;error?:string};
const JOB:Record<string,string>={run:'Lauf starten',retry:'Fehlgeschlagene erneut versuchen',others:'Übrige PDFs laden',texts:'Texte erstellen',ocr:'OCR starten'};
/** Zwei Bahnen laufen nebeneinander, je Bahn ein Auftrag (server/integrations/pdf-store-admin.mjs, laneOf) */
const LANE:Record<Lane,string>={chain:'Laden',ocr:'OCR'};
const laneOf=(kind:string):Lane=>kind==='ocr'?'ocr':'chain';

/** Anteil 0–1 eines Vorgangs: im Schritt aus done/total (Text, OCR), beim Laden nach der Zeit bis zur Grenze des Schritts (es
    endet mit der Zeit oder wenn nichts mehr offen ist); über den Lauf: erledigte Schritte plus Anteil des laufenden, alle
    Schritte gleich gewichtet. Schritte ohne Angabe (Dokumentart, Stand) zählen bis zu ihrem Ende als 0. */
function shares(p:Progress){
 const part=(d?:{done:number;total:number})=>d&&d.total>0?Math.min(1,d.done/d.total):null;
 const time=p.fetch&&p.stepStartedAt&&p.stepUntil?Math.min(0.99,Math.max(0,(Date.parse(p.at)-Date.parse(p.stepStartedAt))/(Date.parse(p.stepUntil)-Date.parse(p.stepStartedAt)))):null;
 const step=part(p.ocr)??part(p.text)??time;
 const total=p.plan?.length?Math.min(1,((p.stepIndex??0)+(step??0))/p.plan.length):step;
 return {step,total};
}
const pc=(v:number)=>`${Math.floor(v*100)} %`;
/** Balken 0–100 % mit Schrittangabe */
function ProgressLine({p}:{p:Progress}){
 const {step,total}=shares(p);
 if(total===null)return null;
 return <div className="mt-2 max-w-[620px]">
  <div className="flex items-baseline justify-between gap-3 text-[12px] text-slate-500"><span>{p.plan?.length?`Schritt ${(p.stepIndex??0)+1} von ${p.plan.length}${p.step?`: ${p.step}`:''}${step!==null?` (${pc(step)})`:''}`:p.step||'Fortschritt'}</span><b className="text-[14px] font-semibold tabular-nums text-slate-900">{pc(total)}</b></div>
  <div className="mt-1 h-[8px] overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(total*100)} aria-label="Fortschritt des Laufs"><div className="h-full rounded-full bg-teal-600 transition-[width]" style={{width:`${Math.max(1,total*100)}%`}}/></div>
 </div>;
}

/** Fortschritt eines Vorgangs in einem Satz */
function progressText(p:Progress){
 if(p.fetch){const f=p.fetch;return `${f.what==='others'?'Übrige PDFs':'Hauptdokumente'}, Sitzungsmonat ${month(f.month)} (${n(f.monthOpen)} zu laden): ${n(f.done)} versucht, ${n(f.ok)} geladen, ${n(f.error)} Fehler, ${f.rate.toLocaleString('de-DE')} je Sekunde; Ablage ${gb(f.bytes)}`;}
 if(p.ocr){const o=p.ocr;return `${n(o.done)} von ${n(o.total)} Dateien, ${n(o.pages)} Seiten per OCR${o.fetched!=null?`, ${n(o.fetched)} kurz nachgeladen`:''}${o.slow?`, ${n(o.slow)} über der Zeitgrenze (später)`:''}${o.perHour?`, ${n(o.perHour)} Dateien je Stunde`:''} (${o.workers} Worker)`;}
 if(p.text){const t=p.text;return `${n(t.done)} von ${n(t.total)} Dateien gelesen${t.waiting?`, ${n(t.waiting)} mit Seiten für OCR`:''}`;}
 return '';
}

export function AdminPdf(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState(''),[reasonsOf,setReasonsOf]=useState<'primary'|'others'>('primary');
 const load=useCallback(async()=>{
  try{const r=await fetch('/api/admin/pdf-ablage',{cache:'no-store'});const d=await r.json() as Data;if(!r.ok)throw Error(d.error||'Der Stand konnte nicht geladen werden.');setData(d);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Der Stand konnte nicht geladen werden.');}
 },[]);
 useEffect(()=>{load();},[load]);
 // Solange etwas läuft oder wartet, alle 30 Sekunden neu laden
 const live=!!data&&(!!data.progress.chain||!!data.progress.ocr||data.jobs.queue.length>0||Object.values(data.jobs.running).some(j=>j?.state==='running')||!!data.count&&!data.count.finishedAt);
 useEffect(()=>{if(!live)return;const t=setInterval(load,30000);return ()=>clearInterval(t);},[live,load]);
 const post=async(body:Record<string,unknown>,confirmText?:string)=>{
  if(confirmText&&!window.confirm(confirmText))return;
  setBusy(true);setNote('');
  try{const r=await fetch('/api/admin/pdf-ablage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json() as {error?:string;created?:boolean;reason?:string|null};if(!r.ok)throw Error(d.error||'Das ging nicht.');
   if(d.created===false&&d.reason)setNote(`„${JOB[String(body.kind)]??'Dieser Auftrag'}“ ${d.reason==='running'?'läuft schon':'wartet schon'}; kein zweiter angelegt.`);
   await load();}
  catch(e){setError(e instanceof Error?e.message:'Das ging nicht.');}
  finally{setBusy(false);}
 };
 const s=data?.stats,o=s?.others,jobs=data?.jobs,chain=data?.progress.chain,ocr=data?.progress.ocr;
 const v=<T,>(f:(x:Stats)=>T):T|string|undefined=>s?f(s):data?'–':undefined;
 const stopping=(lane:'chain'|'ocr',p?:Progress|null)=>!!p?.startedAt&&!!data?.stop[lane]&&Date.parse(data.stop[lane]!.requestedAt)>=Date.parse(p.startedAt);
 const lastRun=data?.runs[0],ocrRate=ocr?.ocr?.perHour||(()=>{const st=data?.runs.find(r=>r.steps.some(x=>x.name==='OCR'&&x.seconds>600))?.steps.find(x=>x.name==='OCR');const f=Number(st?.summary?.files||0);return st&&f?Math.round(f/(st.seconds/3600)):null;})();
 const loadStep=lastRun?.steps.find(x=>x.name==='Laden'),keep=(loadStep?.summary?.keeper||null) as Record<string,number>|null;
 const pill='inline-flex h-10 items-center gap-2 rounded-full px-5 text-[14px] font-medium disabled:opacity-40';
 const textBtn='text-[14px] font-medium text-teal-600 hover:text-teal-700 disabled:opacity-40';
 const canAct=!!data?.worker&&!busy;

 return <>
  <AdminPageHead page="pdf">
   <p className="text-[14px] text-slate-500">{s?`Stand ${when(s.at)}`:data?'Noch kein Stand: er entsteht beim ersten Zählen.':'Wird geladen …'}{s&&' · '}<a href="#ablauf" className="text-teal-600">So läuft der Import →</a></p>
  </AdminPageHead>
  {error&&<Alert onRetry={load}>{error}</Alert>}

  {/* A. Jetzt */}
  <section className="mt-6 max-w-[1100px] border-y border-slate-200 py-5" aria-label="Was gerade läuft">
   <h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name="server" className="text-teal-600"/>Jetzt</h2>
   {data&&!data.worker&&<p className="mt-3 flex gap-2 text-[14px] text-slate-900"><Icon name="alert" size={18} className="mt-[1px] text-slate-900"/><span>Auf diesem Rechner führt niemand Aufträge aus (kein Lebenszeichen des Server-Dienstes in den letzten 20 Minuten). Knöpfe sind deshalb gesperrt; auf dem Server prüfen, ob der Job „PDF-Aufträge und Messungen“ eingeschaltet ist (<Link href={adminHref('zeitplaene')} className="text-teal-600">Jobs & Zeitpläne →</Link>).</span></p>}
   <ul className="m-0 mt-3 list-none space-y-3 p-0 text-[14px]">
    {(['chain','ocr'] as Lane[]).map(lane=>{
     const p=lane==='chain'?chain:ocr,job=jobs?.running[lane];
     if(p)return <li key={lane} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
      <div className="min-w-0"><span className="text-slate-500">Bahn {LANE[lane]}: </span><b className="font-semibold">{KIND[p.kind||'']||p.kind||'Lauf'}</b>{p.step&&<> · Schritt <b className="font-semibold">{p.step}</b></>}<span className="text-slate-500"> · seit {clock(p.startedAt)}{p.until&&`, endet spätestens ${clock(p.until)}`}</span>
       <ProgressLine p={p}/>
       <p className="mt-1 text-slate-700">{progressText(p)||'Fortschritt folgt (wird jede Minute geschrieben).'}</p></div>
      <div>{stopping(lane,p)?<span className="text-slate-500">wird angehalten …</span>:<button type="button" className={textBtn} disabled={!canAct} onClick={()=>post({action:'stop',lane},lane==='chain'?'Bahn Laden jetzt anhalten? Der Lauf endet nach wenigen Sekunden, ohne den Schritt abzuwarten. Was schon geladen oder gelesen ist, bleibt; laufende Abrufe bleiben offen, offene Schritte holt der nächste Lauf nach.':'Bahn OCR jetzt anhalten? Sie endet nach wenigen Sekunden; fertig gelesene Dateien bleiben, angefangene und der Rest kommen beim nächsten „OCR starten“ oder nachts dran.')}>Anhalten →</button>}</div>
     </li>;
     if(job?.state==='running')return <li key={lane}><span className="text-slate-500">Bahn {LANE[lane]}: </span><b className="font-semibold">{KIND[job.kind]}</b> läuft seit {clock(job.startedAt)}; Fortschritt folgt.</li>;
     return <li key={lane} className="text-slate-700"><span className="text-slate-500">Bahn {LANE[lane]}: </span>{lane==='chain'?<>nichts aktiv. Die Nachtkette startet zur Zeit aus dem Reiter <Link href={adminHref('zeitplaene')} className="text-teal-600">Jobs & Zeitpläne</Link>; von Hand mit den Knöpfen unten.</>:'nichts aktiv. Nachts stellt die Kette nach dem Laden „OCR starten“ an; von Hand mit dem Knopf unten.'}</li>;
    })}
    {jobs&&jobs.queue.length>0&&<li><span className="text-slate-500">Warten (je Bahn in dieser Reihenfolge, einer zur Zeit; der nächste startet, sobald seine Bahn frei ist):</span>
     <ol className="m-0 mt-1 list-decimal space-y-1 pl-5">{jobs.queue.map(j=><li key={j.id}><b className="font-semibold">{KIND[j.kind]}</b><span className="text-slate-500"> (Bahn {LANE[laneOf(j.kind)]}), angefordert {when(j.requestedAt)}</span> <button type="button" className={textBtn+' ml-2'} disabled={busy} onClick={()=>post({action:'remove',id:j.id})}>Entfernen</button></li>)}</ol></li>}
    {jobs?.recent[0]&&<li className="text-slate-500">Zuletzt: {KIND[jobs.recent[0].kind]}, {when(jobs.recent[0].startedAt||jobs.recent[0].requestedAt)} bis {clock(jobs.recent[0].finishedAt)}: {jobs.recent[0].exit==='abgebrochen'?'abgebrochen':jobs.recent[0].state==='done'?'fertig':'mit Fehlern beendet'}</li>}
   </ul>
   <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
    <button type="button" className={pill+' bg-slate-900 text-white hover:bg-slate-700'} disabled={!canAct} onClick={()=>post({action:'queue',kind:'run'})}><Icon name="play" size={16}/>Lauf starten →</button>
    <button type="button" className={textBtn} disabled={!canAct} onClick={()=>post({action:'queue',kind:'retry'})}>Fehlgeschlagene erneut versuchen →</button>
    <button type="button" className={textBtn} disabled={!canAct} onClick={()=>post({action:'queue',kind:'others'})}>Übrige PDFs laden →</button>
    <button type="button" className={textBtn} disabled={!canAct} onClick={()=>post({action:'queue',kind:'texts'})}>Texte erstellen →</button>
    <button type="button" className={textBtn} disabled={!canAct} onClick={()=>post({action:'queue',kind:'ocr'})}>OCR starten →</button>
    <button type="button" className={textBtn} disabled={!canAct||!!data?.count&&!data.count.finishedAt} onClick={()=>post({action:'count'})}>{data?.count&&!data.count.finishedAt?(data.count.startedAt?'Wird gezählt …':'Zählen angefordert …'):'Stand neu zählen →'}</button>
   </div>
   {note&&<p role="status" className="mt-3 text-[14px] text-slate-900">{note}</p>}
   <p className="mt-3 max-w-[820px] text-[12px] text-slate-500">{Object.entries(JOB).map(([k,l])=>`${l}: ${k==='run'?'Kette wie nachts ohne OCR (neue und noch nicht versuchte Hauptdokumente, Textebene, Auswertung).':k==='retry'?'wie „Lauf starten“, dazu fehlgeschlagene Abrufe und ausgelassene Server; danach dasselbe für die übrigen PDFs (je die Hälfte der Ladezeit).':k==='texts'?'nichts laden; Textebene der abgelegten PDFs ohne Text, dann Zusammenfassungen, Fakten, Wortliste und Stand.':k==='ocr'?'Seiten ohne Text aller PDFs per OCR lesen, Hauptdokumente und übrige; die mit den wenigsten Seiten zuerst, bei gleich vielen Hauptdokumente vor übrigen; braucht eine Datei über 5 Minuten, kommt sie ans Ende; schon gelöschte PDFs werden kurz nachgeladen und gleich wieder gelöscht; danach Auswertung, wenn Hauptdokumente dabei waren.':'nur die übrigen PDFs, nur Textebene.'}`).join(' ')} Zwei Bahnen laufen nebeneinander: Laden (alle Knöpfe außer „OCR starten“) und OCR; je Bahn einer zur Zeit, höchstens 3 Stunden. „Stand neu zählen“ geht jederzeit (etwa eine Minute).</p>
  </section>

  {/* Alle Dokumente: Hauptdokumente und übrige PDFs zusammen, je Adresse */}
  <section className="mt-10" aria-label="Alle Dokumente">
   <h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name="file" className="text-teal-600"/>Alle Dokumente</h2>
   <p className="mt-1 max-w-[820px] text-[14px] text-slate-500">Alle PDF-Dokumente der Berichte, Hauptdokumente und übrige zusammen. Text bleibt immer; das PDF nur, solange es in die Grenze passt.</p>
   <div className="mt-5"><Kpis label="Stand aller Dokumente" items={[
    {label:'Verlinkt',value:v(s=>n(s.allPdfs)),note:s?`${n(s.linked)} Hauptdokumente, ${n(o?.linked)} übrige`:undefined},
    {label:'PDF gelesen',value:v(s=>pct(s.loaded+s.textOnly+(o?.loaded??0)+(o?.textOnly??0),s.allPdfs)),note:s?`${n(s.loaded+s.textOnly+(o?.loaded??0)+(o?.textOnly??0))} Dokumente einmal heruntergeladen`:undefined},
    {label:'Text gespeichert',value:v(s=>pct((s.texts.linked??0)+(o?.withText??0),s.allPdfs)),note:s?`${n((s.texts.linked??0)+(o?.withText??0))} Dokumente`:undefined},
    {label:'PDF gespeichert',value:v(s=>pct(s.loaded+(o?.loaded??0),s.allPdfs)),note:s?`${n(s.loaded+(o?.loaded??0))} Dokumente; die übrigen nur als Text, fehlgeschlagen oder noch offen`:undefined},
    {label:'Größe der Ablage',value:v(s=>gb(s.bytes.used)),note:s?`von ${s.budgetGb} GB (PDFs ${gb(s.bytes.pdf)}, Texte ${gb(s.bytes.text)})`:undefined},
    {label:'Ø Qualität',value:v(s=>scorePct(s.quality?.avg)),note:s?.quality?`der ${n(s.quality.files)} als PDF abgelegten Dateien`:s?'nach dem nächsten Zählen':undefined},
   ]}/></div>
  </section>

  {/* B. Hauptdokumente */}
  <section className="mt-10" aria-label="Hauptdokumente">
   <h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name="report" className="text-teal-600"/>Hauptdokumente</h2>
   <p className="mt-1 max-w-[820px] text-[14px] text-slate-500">Je Bericht das Dokument, aus dem Zusammenfassung und Fakten entstehen: die Vorlage, sonst Beschlussvorschlag oder Bericht, sonst das erste PDF.</p>
   <div className="mt-5"><Kpis label="Stand der Hauptdokumente" items={[
    {label:'Verlinkt',value:v(s=>n(s.linked)),note:s?`von ${n(s.allPdfs)} PDF-Dokumenten`:undefined},
    {label:'PDF gelesen',value:v(s=>pct(s.loaded+s.textOnly,s.linked)),note:s?`${n(s.loaded+s.textOnly)} Dokumente einmal heruntergeladen`:undefined},
    {label:'Text gespeichert',value:v(s=>pct(s.texts.linked??0,s.linked)),note:s?`${n(s.texts.linked)} Dokumente, davon ${n(s.texts.complete)} vollständig`:undefined},
    {label:'PDF gespeichert',value:v(s=>pct(s.loaded,s.linked)),note:s?`${n(s.loaded)} Dokumente, ${n(s.textOnly)} nur noch als Text`:undefined},
    {label:'Größe der PDFs',value:v(s=>gb(s.bytes.pdfPrimary??s.bytes.pdf)),note:s?`von ${s.budgetGb} GB für alle PDFs und Texte`:undefined},
    {label:'Ø Qualität',value:v(s=>scorePct(s.quality?.primary.avg)),note:s?.quality?`der ${n(s.quality.primary.files)} als PDF abgelegten Dateien`:s?'nach dem nächsten Zählen':undefined},
   ]}/></div>
   {s?.months&&<MonthBars rows={s.months.primary} label="Hauptdokumente je Sitzungsmonat"/>}
  </section>

  {/* E. Übrige PDFs */}
  <section className="mt-12" aria-label="Übrige PDFs">
   <h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name="archive" className="text-teal-600"/>Übrige PDFs der Berichte</h2>
   <p className="mt-1 max-w-[820px] text-[14px] text-slate-500">Anlagen, Pläne und weitere Unterlagen, die in keinem Bericht Hauptdokument sind. Laden über „Übrige PDFs laden“, Fehler erneut über „Fehlgeschlagene erneut versuchen“; Scans liest „OCR starten“. Sie stehen in der Grenze immer unter allen Hauptdokumenten und bleiben deshalb meist nur als Text.</p>
   <div className="mt-5"><Kpis label="Stand der übrigen PDFs" items={[
    {label:'Verlinkt',value:o?n(o.linked):v(()=>'–'),note:s&&o?`von ${n(s.allPdfs)} PDF-Dokumenten`:undefined},
    {label:'PDF gelesen',value:o?pct(o.loaded+o.textOnly,o.linked):v(()=>'–'),note:o?`${n(o.loaded+o.textOnly)} Dokumente einmal heruntergeladen`:undefined},
    {label:'Text gespeichert',value:o?pct(o.withText,o.linked):v(()=>'–'),note:o?`${n(o.withText)} Dokumente; ${n(o.scans)} Scans ohne Textebene`:undefined},
    {label:'PDF gespeichert',value:o?pct(o.loaded,o.linked):v(()=>'–'),note:o?`${n(o.loaded)} Dokumente, ${n(o.textOnly)} nur noch als Text`:undefined},
    {label:'Größe der PDFs',value:v(s=>gb(s.bytes.pdfOthers??0)),note:s?`von ${s.budgetGb} GB für alle PDFs und Texte`:undefined},
    {label:'Ø Qualität',value:v(s=>scorePct(s.quality?.others.avg)),note:s?.quality?`der ${n(s.quality.others.files)} als PDF abgelegten Dateien`:s?'nach dem nächsten Zählen':undefined},
   ]}/></div>
   {s?.months&&s.months.others.some(r=>r.ok+r.textOnly+r.failed>0)&&<MonthBars rows={s.months.others} label="Übrige PDFs je Sitzungsmonat"/>}
  </section>

  {/* C. Texte */}
  <section className="mt-12" aria-label="Texte">
   <h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name="text" className="text-teal-600"/>Texte</h2>
   <p className="mt-1 max-w-[820px] text-[14px] text-slate-500">Zusammenfassungen, Fakten und die Wortliste der Suche entstehen aus diesen Texten im Reiter <Link href={adminHref('regeltexte')} className="text-teal-600 hover:text-teal-700">Themen &amp; Texte</Link>, nicht hier.</p>
   <div className="mt-5"><Kpis label="Texte" items={[
    {label:'Textfassungen',value:v(s=>n(s.texts.files)),note:'Dateien mit gelesenem Text (Textebene oder OCR)'},
    {label:'PDFs ohne Text',value:v(s=>s.texts.missing===undefined?'–':n(s.texts.missing)),note:s?.texts.missing?'abgelegt, Textebene noch nicht gelesen; mit „Texte erstellen“ nachholen':s?.texts.missing===0?'alle abgelegten PDFs haben Text':'nach dem nächsten Zählen'},
    {label:'Warten auf OCR',value:v(s=>n(s.texts.ocrWaitingAll??s.texts.ocrWaiting)),note:s?(()=>{const all=s.texts.ocrWaitingAll??s.texts.ocrWaiting;return `${n(s.texts.ocrPagesAll??s.texts.ocrPages)} Seiten; davon ${n(s.texts.ocrWaiting)} Hauptdokumente${ocrRate&&all?`; bei ${n(ocrRate)} Dateien je Stunde etwa ${dur(Math.round(all/ocrRate*3600))} OCR`:''}`;})():undefined},
   ]}/></div>
  </section>

  {/* D. Platz und Grenze */}
  <section className="mt-12" aria-label="Platz und Grenze">
   <h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name="scale" className="text-teal-600"/>Platz und Grenze</h2>
   <p className="mt-1 max-w-[820px] text-[14px] text-slate-500">Feste Grenze {s?.budgetGb??80} GB für PDFs und Texte zusammen. Texte bleiben immer; ist die Grenze erreicht, verdrängt eine neue Datei die am schlechtesten bewertete, oder sie bleibt selbst nur als Text.</p>
   {s&&<SpaceBar limit={s.budgetGb*1073741824} parts={[['PDFs Hauptdokumente',s.bytes.pdfPrimary??s.bytes.pdf,'bg-teal-600'],['PDFs übrige',s.bytes.pdfOthers??0,'bg-teal-300'],['Texte',s.bytes.text,'bg-slate-500']]}/>}
   <ul className="m-0 mt-4 max-w-[820px] list-none space-y-1.5 p-0 text-[14px] text-slate-700">
    {s&&<li>{s.threshold?s.threshold.others?'Ablage voll: neue Hauptdokumente verdrängen zuerst übrige PDFs.':s.threshold.score!=null?`Ablage voll: die schlechteste behaltene Datei hat eine Qualität von ${scorePct(s.threshold.score)}; neue Dateien darunter bleiben nur als Text.`:'Ablage voll: neue Dateien verdrängen die am schlechtesten bewerteten.':`Noch ${gb(s.budgetGb*1073741824-s.bytes.used)} frei bis zur Grenze: jede neue Datei bleibt als PDF.`}</li>}
    {keep&&<li>Letzter Lauf ({when(lastRun?.startedAt)}): {n(keep.kept)} behalten, {n(keep.swapped)} schlechtere verdrängt, {n(keep.rejected)} nicht besser (nur Text), {n(keep.tooBig)} zu groß (nur Text).</li>}
    {s?.disk&&<li className={s.disk.free<20*1073741824?'flex gap-2 font-medium text-slate-900':''}>{s.disk.free<20*1073741824&&<Icon name="alert" size={18}/>}Festplatte des Servers: {gb(s.disk.free)} frei von {gb(s.disk.total)} (Datenbank, Sicherungen und Ablage teilen sie sich; <Link href={adminHref('speicher')} className="text-teal-600">Speicher & Sicherungen →</Link>)</li>}
   </ul>
  </section>

  {/* Qualität der Ablage */}
  <section className="mt-12" aria-label="Qualität der Ablage">
   <h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name="check" className="text-teal-600"/>Qualität der Ablage</h2>
   <p className="mt-1 max-w-[820px] text-[14px] text-slate-500">Jede Datei hat eine Qualität von 0 bis 100 %: Dokumentart (Vorlage und Beschluss 1, Niederschrift 0,7, Anlage 0,4, Einladung 0,1) × 0,5 bei Formalien × Inhalt (voll ab 4.000 Zeichen Text) × Größe (voll bis 100 KB, darüber langsam fallend). 100 % hat eine Vorlage mit viel Text in einer kleinen Datei. Die Grenze behält die Dateien mit der höchsten Qualität.</p>
   <div className="mt-5"><Kpis label="Qualität der Ablage" items={[
    {label:'Ø Qualität',value:v(s=>scorePct(s.quality?.avg)),note:s?.quality?`${n(s.quality.files)} Dateien als PDF`:s?'nach dem nächsten Zählen':undefined},
    {label:'Hauptdokumente',value:v(s=>scorePct(s.quality?.primary.avg)),note:s?.quality?`Ø Qualität von ${n(s.quality.primary.files)} Dateien`:undefined},
    {label:'Übrige PDFs',value:v(s=>scorePct(s.quality?.others.avg)),note:s?.quality?`Ø Qualität von ${n(s.quality.others.files)} Dateien`:undefined},
    {label:'Nur als Text',value:v(s=>scorePct(s.quality?.textOnly.avg)),note:s?.quality?`Ø Qualität der ${n(s.quality.textOnly.files)} verdrängten oder zu großen Dateien (Text bleibt)`:undefined},
   ]}/></div>
   {s?.quality&&s.quality.files>0&&<QualityTable q={s.quality}/>}
  </section>

  {/* Ablauf */}
  <section id="ablauf" className="mt-12 scroll-mt-24" aria-label="So läuft der Import">
   <h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name="download" className="text-teal-600"/>So läuft der Import</h2>
   <p className="mt-1 max-w-[820px] text-[14px] text-slate-500">Jeder Schritt arbeitet nur mit dem, was der vorige abgelegt hat, und fasst nur Neues an. Haken: Regel; Uhr: Grenze. Rechts der aktuelle Stand.</p>
   <ProcessFlow steps={[
    {icon:'report',title:'Bericht mit PDFs',what:'Der Abruf (Reiter Abruf & Verarbeitung) speichert je Bericht die Links auf seine Dokumente. Die PDFs selbst lädt erst dieser Import.',
     rules:['Hauptdokument: die Vorlage, sonst Beschlussvorschlag oder Bericht, sonst das erste PDF','Alle anderen PDFs eines Berichts sind „übrige PDFs“ (Anlagen, Pläne …)','Dieselbe Adresse wird nur einmal geladen, auch wenn mehrere Berichte sie verlinken'],
     value:s?`${n(s.linked)} Hauptdokumente, ${n(o?.linked)} übrige`:undefined},
    {icon:'download',title:'Laden',what:'Monat für Monat ab der neuesten Sitzung zurück, mit der Kennung von Plenara, höflich gegenüber den Servern.',
     rules:['Je Server höchstens 3 Abrufe gleichzeitig, 0,2 Sekunden Abstand','3 Fehler in Folge oder „überlastet“ (429/503): Server für diesen Monat ausgelassen','Server mit mindestens 10 Abrufen und mindestens 90 % Fehlern: ausgelassen, bis „Fehlgeschlagene erneut versuchen“','Fehlgeschlagene Abrufe werden nie von selbst wiederholt, nur mit „Fehlgeschlagene erneut versuchen“ (Hauptdokumente und übrige); sie stehen in der Fehlerliste'],
     limits:['Je Datei höchstens 10 Sekunden und 30 MB','Nachts höchstens 72 Minuten Laden (40 % der Laufzeit), übrige PDFs bis 15 Minuten vor Laufende'],
     value:s?`${pct(s.loaded+s.textOnly,s.linked)} geladen`:undefined},
    {icon:'scale',title:'Bewerten und Grenze',what:'Jede neue Datei wird sofort bewertet. Ist die Grenze erreicht, verdrängt sie die am schlechtesten bewertete Datei, wenn sie besser ist; sonst bleibt sie selbst nur als Text.',
     rules:['Qualität 0 bis 100 % = Dokumentart × Formalie × Inhalt × Größe','Dokumentart: Vorlage und Beschluss 1, Niederschrift 0,7, Anlage 0,4, Einladung 0,1; Formalie halber Wert','Dokumentart aus dem ersten Wort des Titels, berichtigt durch den Textanfang (steht dort „Beschlussvorlage“, „Vorlage-Nr.“ oder „Drucksache“, zählt die Datei als Vorlage)','Inhalt voll ab 4.000 Zeichen Text (Seiten, die auf OCR warten, vorläufig 800 Zeichen); Größe voll bis 100 KB, darüber langsam fallend','Scan oder Textebene und Alter zählen nicht','Übrige PDFs stehen immer unter allen Hauptdokumenten','Vor dem Löschen ist die Textebene gelesen; Seiten ohne Text liest später „OCR starten“ (lädt die Datei dafür kurz nach)'],
     limits:[`Feste Grenze ${s?.budgetGb??80} GB für PDFs und Texte zusammen`,'Über 10 MB nur Text (alle Dokumentarten); das PDF wird gleich nach der Textebene gelöscht, auch bei Scans'],
     value:s?`${gb(s.bytes.used)} von ${s.budgetGb} GB`:undefined},
    {icon:'text',title:'Text lesen',what:'Die Textebene jedes PDFs wird gleich beim Laden gelesen und als Textfassung neben dem PDF abgelegt; sie bleibt auch, wenn das PDF gelöscht wird.',
     rules:['Seiten mit weniger als 20 Zeichen gelten als Scan und warten auf OCR'],
     value:s?`${pct(s.texts.linked??0,s.linked)} mit Text`:undefined},
    {icon:'scan',title:'OCR',what:'Liest Seiten ohne Textebene per Texterkennung (Deutsch), in der eigenen Bahn neben dem Laden.',
     rules:['Hauptdokumente und übrige PDFs in einer Reihe: die mit den wenigsten Seiten zuerst, bei gleich vielen Hauptdokumente vor übrigen','Schon gelöschte PDFs werden kurz nachgeladen (dieselbe Datei), gelesen und gleich wieder gelöscht; scheitert das, kein neuer Versuch','Große Seiten werden verkleinert gelesen (höchstens 12 Megapixel)'],
     limits:['3 Worker, je eine Datei','Je Datei höchstens 5 Minuten, sonst ans Ende der Reihe','Je Lauf höchstens 3 Stunden; nachts stellt die Kette ihn nach dem Laden an'],
     value:s?`${n(s.texts.ocrWaitingAll??s.texts.ocrWaiting)} Dateien warten`:undefined},
    {icon:'gauge',title:'Stand',what:'Zählt alles auf dieser Seite neu: verlinkt, geladen, Text, Fehler, Server, Platz.',
     rules:['Am Ende jedes Laufs und mit „Stand neu zählen“'],value:s?`zuletzt ${when(s.at)}`:undefined},
    {icon:'summary',title:'Weiter: Themen & Texte',what:'Aus den abgelegten Texten entstehen Zusammenfassungen, Fakten für plenara.X und die Wortliste der Suche. Das ist nicht Teil des PDF-Imports, sondern ein eigener Job im Reiter Themen & Texte.',
     rules:['Täglich zur Zeit aus Jobs & Zeitpläne (Standard 09:00 Uhr, nach der Nachtkette)','Oder dort per Knopf']},
   ]} when={['Nachtkette: täglich zur Zeit aus dem Reiter Jobs & Zeitpläne (Standard 05:30 Uhr), höchstens 3 Stunden; danach ist der Abruf der Nacht (Standard 01:00 Uhr) durch. Nach dem Laden stellt sie „OCR starten“ an.','Zwei Bahnen nebeneinander: Laden (alle Aufträge außer OCR, auch die Nachtkette) und OCR; je Bahn einer zur Zeit, weitere warten in der Reihe ihrer Bahn und starten, sobald sie frei ist.','Übrige PDFs: nur von Hand („Übrige PDFs laden“, Fehler mit „Fehlgeschlagene erneut versuchen“), jeder Lauf macht dort weiter, wo der vorige aufgehört hat.']}/>
  </section>

  {/* F. Fehler und Server */}
  <section className="mt-12" aria-label="Fehler und Server">
   <h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name="alert" className="text-teal-600"/>Abrufe, Fehler und Server</h2>
   <div className="mt-5"><Kpis label="Stand der Abrufe" items={[
    {label:'Fehlgeschlagen',value:v(s=>pct(s.failed,s.linked)),note:s?`${n(s.failed)} Hauptdokumente, nur über „Fehlgeschlagene erneut versuchen“ erneut`:undefined},
    {label:'Noch nicht versucht',value:v(s=>pct(s.open,s.linked)),note:s?`${n(s.open)} Hauptdokumente${s.openBlocked?`, davon ${n(s.openBlocked)} bei ausgelassenen Servern`:''}`:undefined},
    {label:'Vollständig bis',value:v(s=>s.completeThrough?month(s.completeThrough):'–'),note:s?`Sitzungsmonat, bis zu dem höchstens 5 % der Hauptdokumente offen sind (ohne ausgelassene Server). Ältestes geladenes Dokument ${day(s.oldest?.loaded)}, älteste verlinkte Sitzung ${day(s.oldest?.linked)}`:undefined},
    {label:'Übrige fehlgeschlagen',value:o?pct(o.failed,o.linked):v(()=>'–'),note:o?`${n(o.failed)} Dokumente`:undefined},
    {label:'Übrige noch nicht versucht',value:o?pct(o.open,o.linked):v(()=>'–'),note:o?`${n(o.open)} Dokumente`:undefined},
   ]}/></div>
   <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
    <span className="inline-flex rounded-full bg-slate-100 p-0.5">{(['primary','others'] as const).map(k=><button key={k} type="button" aria-pressed={reasonsOf===k} onClick={()=>setReasonsOf(k)} className={'h-8 rounded-full px-3 '+(reasonsOf===k?'bg-white font-medium text-slate-900 shadow-sm':'text-slate-500')}>{k==='primary'?'Hauptdokumente':'Übrige PDFs'}</button>)}</span>
    {s?.errorsCsv&&<a href="/api/admin/pdf-ablage/fehler" className="text-teal-600">Fehlerliste als CSV ({n(s.errorsCsv.rows)} Dokumente) →</a>}
   </div>
   {(()=>{const reasons=reasonsOf==='primary'?s?.reasons:o?.reasons,total=reasonsOf==='primary'?s?.failed:o?.failed;
    if(!s)return null;if(!reasons?.length)return <p className="mt-3 text-[14px] text-slate-500">Keine Fehlschläge.</p>;
    return <ol className="m-0 mt-3 max-w-[820px] list-none border-t border-slate-200 p-0">
     {reasons.map(r=><li key={r.reason} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-slate-200 py-2.5 text-[14px]">
      <span className="min-w-0">{r.reason}<span className="mt-1.5 block h-[3px] rounded-full bg-slate-100"><span className="block h-full rounded-full bg-teal-600" style={{width:`${Math.max(2,(r.n/Math.max(1,total||0))*100)}%`}}/></span></span>
      <span className="text-right tabular-nums"><b className="font-semibold">{n(r.n)}</b><span className="ml-2 text-[12px] text-slate-500">{pct(r.n,total||0)}</span></span>
     </li>)}
    </ol>;})()}
   {s?.hosts&&<><h3 className="mt-8 text-[18px] font-semibold">Server, die nicht liefern</h3><HostList hosts={s.hosts.top} total={s.hosts.total} blocked={s.hosts.blocked}/></>}
  </section>

  {/* G. Läufe */}
  <section className="mt-12" aria-label="Protokoll der Läufe">
   <h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name="clock" className="text-teal-600"/>Läufe</h2>
   <p className="mt-1 text-[14px] text-slate-500">Die letzten 20 Läufe (Nachtkette und von Hand); antippen für die Schritte.</p>
   {data&&<RunList runs={data.runs}/>}
  </section>
 </>;
}
