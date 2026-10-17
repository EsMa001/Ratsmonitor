'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {AdminPageHead,Alert} from '@/components/admin-ui';
import {Icon} from '@/components/admin-icons';
import {adminHref} from '@/components/admin-chrome';
import {when,clock,dur} from '@/components/admin-pdf-parts';
import {n,day,Glossary,StepList,Timeline,FailureTable,HostTable,result,type Step,type FailRow,type Counter} from '@/components/admin-pipeline-parts';
import {PHASES,stepName,CLASS_TERMS} from '@/shared/pipeline-terms.mjs';

/* Reiter „Pipeline-Debug“ (vorübergehend, nicht langfristig gebraucht; Route /api/admin/debug, server/integrations/pipeline-debug.mjs).
   Liest nur gespeicherte Stände: wann lief was, was haben die Läufe getan, welchen Weg nahmen die Berichte, was steht im
   Fehlerspeicher des Tagesbereichs. Den Altbestand bearbeitet die Seite „Altbestand“. Begriffe: shared/pipeline-terms.mjs. */
type PdfRun={kind:string;startedAt:string;finishedAt:string;result:string;steps:Step[]};
type RuleRun={startedAt:string;finishedAt:string;result:string;steps:Step[]};
type NachStep={step:string;name?:string;entries:number;ok?:number;again?:number;final?:number;untouched?:number;skipped?:string;seconds?:number};
type Nach={startedAt:string;finishedAt:string;due:number;steps:NachStep[];followUp?:{after:string;step:string;code:number|string;reports?:number}[];readyForAi?:number;totals?:Counter};
type Win={since:string;written:number;withPdf:number;noPdf:number;main:number;session:number;noMain:number;pdf:Counter;failures:Counter;text:Counter;ocr:Counter;rules:Counter;summary:Counter;label:Counter;ai:Counter;imports:Counter};
type Entry={step:string;key:string;class?:string;reason:string|null;tries:number;last_at:string;next_try_at?:string|null;range?:string;release?:string|null};
type Data={at:string;boundary:string;since:string;units:{at:string;inactive:string[];stale:boolean}|null;jobs:{id:string;label:string;flow:string}[];log:{job:string;start:string;end:string;seconds:number;result:string;trigger:string}[];
 pdfRuns:PdfRun[];ruleTexts:RuleRun|null;nacharbeit:Nach|null;altbestand:{last:{startedAt:string;finishedAt:string;readyForAi?:number}|null;importOpen:boolean;reworkOpen:boolean;ocrOpen:boolean};
 aiCounts:{at:string;states:Counter;newText:number;withoutAi:number}|null;trace:{at:string;seconds:number;windows:Record<string,Win>}|null;pdfDaily:{startedAt:string}|null;
 importJob:{status:string;createdAt:string;updatedAt:string;window:string|null;counts:Counter;deferred:{region:string;message:string}[];failed:{region:string;message:string}[]}|null;
 failures:{rows?:FailRow[];hosts?:Counter;missing?:string};hosts:{host:string;state:string;level:number;next_try_at:string|null;reason:string|null;entries:number}[];internal:Entry[];recent:Entry[];error?:string};

const IMPORT_STATE:Record<string,string>={completed:'gespeichert',partial:'teilweise gespeichert',failed:'gescheitert',deferred:'zurückgestellt',queued:'wartet',running:'läuft',unknown:'Ausgang unklar',unavailable:'ohne Quelle'};
const AI_STATE:Record<string,string>={completed:'fertig',failed:'gescheitert',insufficient_source:'Quelle reicht nicht',processing:'in Arbeit',pending:'bereit',stale:'veraltet',waiting_text:'wartet auf Text',legacy:'frühere Fassung'};
const words=(c:Counter,names:Record<string,string>)=>Object.entries(c).map(([k,v])=>`${n(v)} ${names[k]||k}`).join(', ');
const H2=({icon,children}:{icon:string;children:React.ReactNode})=><h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name={icon} className="text-teal-600"/>{children}</h2>;
const Lead=({children}:{children:React.ReactNode})=><p className="mt-1 max-w-[820px] text-[14px] text-slate-500">{children}</p>;

/** Weg der Berichte, nach Stufen: je Zeile Anzahl, Balken (Anteil an den geschriebenen) und was abzweigt */
function Paths({w}:{w:Win}){
 const base=Math.max(1,w.written),inStore=(w.pdf.ok||0)+(w.pdf['text-only']||0),pdfFail=(w.pdf.error||0)+(w.pdf.unsupported||0);
 const rows:[string,string,number,string][]=[
  ['abruf','Berichte geschrieben',w.written,`${n(w.noPdf)} davon ohne PDF`],
  ['abruf','mit PDF',w.withPdf,`${n(w.session)} nur mit Unterlage der ganzen Sitzung, ${n(w.noMain)} ohne erkennbares Hauptdokument`],
  ['extraktion','Hauptdokument geladen',inStore,`${n(w.pdf['text-only'])} davon nur noch als Text (Grenze der Ablage); ${n(pdfFail)} gescheitert, ${n(w.pdf.none)} noch nicht versucht`],
  ['extraktion','Text gelesen',w.text.ok||0,`${n(w.text.missing)} noch ohne Text, ${n(w.text.error)} nicht lesbar`],
  ['extraktion','Text vollständig',(w.ocr.none||0)+(w.ocr.done||0),`${n(w.ocr.done)} per OCR ergänzt, ${n(w.ocr.waiting)} warten noch auf OCR`],
  ['verarbeitung','Titel eingeordnet',w.label.yes||0,`${n(w.label.no)} ohne aktuelle Einordnung`],
  ['verarbeitung','Regeln angewendet',w.rules.read||0,`${n(w.rules.stale)} mit älterem Stand, ${n(w.rules.never)} noch nie`],
  ['verarbeitung','Regel-Zusammenfassung',w.summary.yes||0,''],
  ['verarbeitung','KI-Fassung',w.ai.completed||0,`${n(w.ai.other)} in Arbeit oder gescheitert, ${n(w.ai.none)} noch nicht bearbeitet`],
 ];
 const fails=Object.entries(w.failures||{});
 return <div className="mt-3 max-w-[1100px]">
  {Object.entries(PHASES).map(([k,p])=><div key={k} className="mt-4"><p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">{p.name}</p>
   <ul className="m-0 mt-1 list-none space-y-2 p-0">{rows.filter(r=>r[0]===k).map(([,label,v,note])=><li key={label} className="grid grid-cols-1 gap-x-4 text-[14px] md:grid-cols-[220px_90px_minmax(0,1fr)]">
    <span>{label}</span><span className="tabular-nums md:text-right">{n(v)}</span>
    <span className="min-w-0"><span className="block h-3 rounded bg-slate-100"><i className="block h-3 rounded bg-teal-600" style={{width:`${Math.min(100,v/base*100)}%`}}/></span>{note&&<span className="mt-0.5 block text-[12px] text-slate-500">{note}</span>}</span>
   </li>)}</ul></div>)}
  {fails.length>0&&<p className="mt-4 text-[14px] text-slate-700">Davon im Fehlerspeicher (Hauptdokument): {fails.map(([k,v])=>`${n(v)} ${CLASS_TERMS[k as keyof typeof CLASS_TERMS]?.name||k}`).join(', ')}.</p>}
  <p className="mt-1 text-[14px] text-slate-700">Abrufe in dieser Zeit (je Gebiet und Teil): {words(w.imports||{},IMPORT_STATE)||'keine'}.</p>
 </div>;
}

export function AdminDebug(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[win,setWin]=useState('7d'),[note,setNote]=useState('');
 const load=useCallback(async()=>{
  try{const r=await fetch('/api/admin/debug',{cache:'no-store'});const d=await r.json() as Data;if(!r.ok)throw Error(d.error||'Die Seite konnte nicht geladen werden.');setData(d);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Die Seite konnte nicht geladen werden.');}
 },[]);
 // Erster Abruf gleich nach dem Einhängen, danach jede Minute (nicht synchron im Effekt, react-hooks/set-state-in-effect)
 useEffect(()=>{const first=setTimeout(load,0),t=setInterval(load,60000);return ()=>{clearTimeout(first);clearInterval(t);};},[load]);
 const post=async(body:Record<string,unknown>,confirmText:string)=>{
  if(!window.confirm(confirmText))return;
  setBusy(true);
  try{const r=await fetch('/api/admin/debug',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json() as {error?:string;reopened?:number};if(!r.ok)throw Error(d.error||'Das ging nicht.');
   setNote(typeof d.reopened==='number'?`${n(d.reopened)} Einträge sind jetzt fällig; die Nacharbeit versucht sie in ihrem nächsten Lauf (alle 30 Minuten, 9 bis 23 Uhr).`:'Server freigegeben; die Nacharbeit prüft ihn im nächsten Lauf mit drei Dokumenten.');await load();}
  catch(e){setError(e instanceof Error?e.message:'Das ging nicht.');}
  finally{setBusy(false);}
 };
 const rows=data?.failures.rows||[],w=data?.trace?.windows?.[win];
 const daily=rows.filter(r=>r.range==='daily').reduce((a,r)=>a+r.n,0),backlog=rows.filter(r=>r.range==='backlog').reduce((a,r)=>a+r.n,0);
 const nightRun=data?.pdfRuns.find(r=>r.kind==='nightly'),ocrRun=data?.pdfRuns.find(r=>r.kind==='ocr');
 const imp=data?.importJob;

 return <>
  <AdminPageHead page="debug"/>
  {error&&<Alert onRetry={load}>{error}</Alert>}
  {note&&<p role="status" className="mt-4 text-[14px] text-slate-700">{note}</p>}
  {data?.units&&(data.units.inactive.length>0||data.units.stale)&&<div role="alert" className="mt-4 max-w-[900px] rounded-md border border-red-300 bg-red-50 px-4 py-3 text-[14px] text-red-900">
   <strong>Auslöser auf dem Server:</strong>{' '}
   {data.units.stale?<>der Zeitplaner hat sich seit {when(data.units.at)} nicht gemeldet; kein Job startet mehr.</>:<>inaktiv: {data.units.inactive.join(', ')}. Diese Jobs starten nie, bis jemand sie auf dem Server wieder einschaltet (<code>systemctl start {data.units.inactive.join(' ')}</code>). Jobs nur über „Anhalten“ stoppen, nie über <code>systemctl stop …timer</code>.</>}
  </div>}

  <section className="mt-6" aria-label="Begriffe">
   <H2 icon="report">So liest man diese Seite</H2>
   <Lead>Jeder Bericht durchläuft drei Stufen. Was nachts nicht klappt, kommt mit seinem Grund in den Fehlerspeicher; die Nacharbeit versucht es tagsüber erneut, sobald der Grund es erlaubt. Ältere Dinge bearbeitet nur die Seite <Link href={adminHref('altbestand')} className="text-teal-700">Altbestand</Link>.</Lead>
   {data&&<Glossary boundary={data.boundary} since={data.since}/>}
  </section>

  <section className="mt-10" aria-label="Zeitachse">
   <H2 icon="clock">Wann lief was (letzte 24 Stunden)</H2>
   {data&&(data.log.length?<Timeline at={data.at} jobs={data.jobs} log={data.log}/>:<Lead>Noch kein Lauf im Laufbuch. Es füllt sich, sobald die Jobs auf dem Server über den Zeitplaner laufen.</Lead>)}
  </section>

  <section className="mt-10" aria-label="Läufe">
   <H2 icon="play">Was die letzten Läufe getan haben</H2>
   <div className="mt-3 grid max-w-[1100px] gap-x-10 gap-y-8 md:grid-cols-2">
    <div className="min-w-0">
     <h3 className="text-[18px] font-semibold">Tagespipeline</h3>
     <p className="mt-3 text-[14px] font-medium">Abruf</p>
     {imp?<p className="text-[14px] text-slate-700">{when(imp.createdAt)}, {imp.window==='1d'?'1 Tag':imp.window} zurück: {words(imp.counts,IMPORT_STATE)}.{imp.status==='completed'?'':' Läuft oder wartet noch.'}</p>:<p className="text-[14px] text-slate-500">Kein Abruf vermerkt.</p>}
     {imp?.deferred.length?<details className="mt-1 text-[14px]"><summary className="cursor-pointer text-teal-700">{n(imp.deferred.length)} Gebiete zurückgestellt (Quelle oder Server wartet)</summary><ul className="m-0 mt-1 list-none p-0 text-slate-700">{imp.deferred.map(d=><li key={d.region}>{d.region}: <span className="text-slate-500">{d.message}</span></li>)}</ul></details>:null}
     <p className="mt-3 text-[14px] font-medium">Extraktion {nightRun&&<span className="font-normal text-slate-500">· {when(nightRun.startedAt)} bis {clock(nightRun.finishedAt)}, {result(nightRun.result)}</span>}</p>
     {nightRun?<StepList steps={nightRun.steps}/>:<p className="text-[14px] text-slate-500">Noch kein Lauf von „Extraktion, nachts“ vermerkt.</p>}
     <p className="mt-3 text-[14px] font-medium">Verarbeitung {data?.ruleTexts&&<span className="font-normal text-slate-500">· {when(data.ruleTexts.startedAt)} bis {clock(data.ruleTexts.finishedAt)}, {result(data.ruleTexts.result)}</span>}</p>
     {data?.ruleTexts?<StepList steps={data.ruleTexts.steps}/>:<p className="text-[14px] text-slate-500">Noch kein Lauf vermerkt.</p>}
     {data?.aiCounts&&<p className="mt-2 text-[14px] text-slate-700">KI (von Hand über den Agenten): {words(data.aiCounts.states,AI_STATE)||'noch nichts bearbeitet'}. {n(data.aiCounts.newText)} KI-Fassungen haben seitdem neuen Text bekommen, {n(data.aiCounts.withoutAi)} Berichte mit Regel-Zusammenfassung haben noch keine.</p>}
    </div>
    <div className="min-w-0">
     <h3 className="text-[18px] font-semibold">Nacharbeit</h3>
     {data?.nacharbeit?<>
      <p className="mt-2 text-[14px] text-slate-700">{when(data.nacharbeit.startedAt)} bis {clock(data.nacharbeit.finishedAt)}: {n(data.nacharbeit.due)} Einträge fällig, {n(data.nacharbeit.totals?.ok)} gelungen, {n(data.nacharbeit.totals?.again)} wieder gescheitert (neuer Termin), {n(data.nacharbeit.totals?.final)} ohne weiteren Versuch.</p>
      <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[14px]">{data.nacharbeit.steps.map(s=><li key={s.step} className="grid grid-cols-[150px_minmax(0,1fr)] gap-x-3"><span>{s.name||stepName(s.step)}</span>
       <span className="text-slate-700">{s.skipped?`ausgelassen (${s.skipped})`:`${n(s.entries)} versucht: ${n(s.ok)} gelungen, ${n(s.again)} neuer Termin, ${n(s.final)} kein Versuch mehr${s.untouched?`, ${n(s.untouched)} nicht drangekommen`:''} · ${dur(s.seconds)}`}</span></li>)}</ul>
      {data.nacharbeit.followUp?.length?<p className="mt-2 text-[14px] text-slate-700">Danach gleich weiter: {data.nacharbeit.followUp.map(f=>`${f.step} (nach ${f.after})`).join(', ')}.{data.nacharbeit.readyForAi?` ${n(data.nacharbeit.readyForAi)} Berichte stehen damit für die KI bereit.`:''}</p>:null}
     </>:<p className="mt-2 text-[14px] text-slate-500">Noch kein Lauf.</p>}
     <p className="mt-4 text-[14px] font-medium">OCR, tagsüber {ocrRun&&<span className="font-normal text-slate-500">· {when(ocrRun.startedAt)} bis {clock(ocrRun.finishedAt)}, {result(ocrRun.result)}</span>}</p>
     {ocrRun?<StepList steps={ocrRun.steps}/>:<p className="text-[14px] text-slate-500">Noch kein Lauf mit gelesenen Dateien (Läufe ohne Arbeit stehen nicht im Protokoll).</p>}
     <h3 className="mt-8 text-[18px] font-semibold">Altbestand</h3>
     <p className="mt-2 text-[14px] text-slate-700">{data?.altbestand.importOpen?'Rückwirkender Abruf angefordert. ':''}{data?.altbestand.reworkOpen?'Alte Fehler werden erneut versucht. ':''}{data?.altbestand.ocrOpen?'OCR des Altbestands angefordert. ':''}
      {data?.altbestand.last?`Letzter Lauf ${when(data.altbestand.last.startedAt)} bis ${clock(data.altbestand.last.finishedAt)}.`:'Noch kein Lauf.'} <Link href={adminHref('altbestand')} className="text-teal-700">Zur Seite Altbestand →</Link></p>
    </div>
   </div>
  </section>

  <section className="mt-10" aria-label="Wege der Berichte">
   <H2 icon="report">Welchen Weg die Berichte genommen haben</H2>
   <Lead>Alle Berichte, die der Abruf im gewählten Zeitraum geschrieben hat, und wie weit jeder gekommen ist. Je Bericht zählt sein Hauptdokument; die Anlagen liest die KI zusätzlich.</Lead>
   <div className="mt-2 flex flex-wrap items-center gap-4 text-[14px]" role="radiogroup" aria-label="Zeitraum">
    {[['24h','letzte 24 Stunden'],['7d','letzte 7 Tage']].map(([k,l])=><label key={k} className="flex cursor-pointer items-center gap-2"><input type="radio" name="debug-win" id={'debug-win-'+k} checked={win===k} onChange={()=>setWin(k)}/>{l}</label>)}
   </div>
   {data?.trace?<p className="mt-1 text-[12px] text-slate-500">Gezählt {when(data.trace.at)} in {dur(data.trace.seconds)}, am Ende von „Verarbeitung, nachts“.</p>
    :<Lead>Noch keine Zählung. Sie entsteht am Ende von „Verarbeitung, nachts“.</Lead>}
   {w&&(w.written?<Paths w={w}/>:<p className="mt-3 text-[14px] text-slate-500">In diesem Zeitraum hat der Abruf keine Berichte geschrieben.</p>)}
  </section>

  <section className="mt-10" aria-label="Fehlerspeicher">
   <H2 icon="alert">Fehlerspeicher: Tagesbereich</H2>
   {data?.failures.missing?<Lead>Migration 0040 fehlt; ohne sie gibt es keinen Fehlerspeicher.</Lead>:<>
    <Lead>Was in der Tagespipeline gescheitert ist (Sitzungen ab {day(data?.boundary)}), nach Stufe und Grund. „Jetzt fällig“ nimmt die Nacharbeit im nächsten Lauf, „wartet“ hat einen späteren Termin, „kein Versuch mehr“ bleibt liegen, bis jemand ihn wieder öffnet. {n(daily)} Einträge im Tagesbereich; {n(backlog)} weitere gehören zum <Link href={adminHref('altbestand')} className="text-teal-700">Altbestand</Link>.</Lead>
    <FailureTable rows={rows} range="daily" busy={busy} onRetry={(phase,cls)=>post({action:'reopen',phase,...(cls?{cls}:{})},`Diese Einträge des Tagesbereichs jetzt fällig machen? Die Nacharbeit versucht sie im nächsten Lauf; wartende Server bleiben bis zu ihrer Stichprobe ausgelassen.`)}/>
    {data&&data.hosts.length>0&&<><h3 className="mt-8 text-[18px] font-semibold">Server, die gerade warten</h3>
     <Lead>Ein Server, der bremst oder mehrfach scheitert, wird eine Zeit lang von allen Abrufen ausgelassen und danach mit drei Dokumenten geprüft. „Freigeben“ zieht die Prüfung vor.</Lead>
     <HostTable hosts={data.hosts} busy={busy} onRelease={h=>post({action:'release',host:h},`${h} jetzt freigeben? Die Nacharbeit prüft ihn im nächsten Lauf mit drei Dokumenten.`)}/></>}
    {data&&data.internal.length>0&&<><h3 className="mt-8 text-[18px] font-semibold">Fehler im eigenen Code</h3><Lead>Hier hilft kein neuer Versuch; diese Einträge kommen erst nach dem nächsten Deploy wieder dran. Sie sind die Liste für die Entwicklung.</Lead>
     <ul className="m-0 mt-2 max-w-[1100px] list-none space-y-1 p-0 text-[14px]">{data.internal.map(e=><li key={e.step+e.key} className="break-all"><span className="text-slate-500">{stepName(e.step)} · {when(e.last_at)} · Programmstand {e.release||'–'}</span> {e.key}: {e.reason}</li>)}</ul></>}
    {data&&data.recent.length>0&&<details className="mt-8 max-w-[1100px]"><summary className="cursor-pointer text-[18px] font-semibold">Letzte Einträge</summary>
     <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[14px]">{data.recent.map(e=><li key={e.step+e.key} className="break-all"><span className="text-slate-500">{when(e.last_at)} · {e.range==='daily'?'Tagesbereich':'Altbestand'} · {stepName(e.step)} · {CLASS_TERMS[(e.class||'') as keyof typeof CLASS_TERMS]?.name||e.class} · {e.tries}. Versuch · {e.next_try_at?'nächster '+when(e.next_try_at):'kein Versuch mehr'}</span> {e.key}{e.reason?': '+e.reason:''}</li>)}</ul></details>}
   </>}
  </section>

  {data&&<section className="mt-10" aria-label="Laufbuch">
   <details className="max-w-[1100px]"><summary className="cursor-pointer text-[22px] font-semibold">Laufbuch des Zeitplaners</summary>
    <table className="mt-2 w-full border-collapse text-[14px]"><thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="py-1 pr-3 font-normal">Job</th><th className="pr-3 font-normal">Start</th><th className="pr-3 font-normal">Ende</th><th className="pr-3 text-right font-normal">Dauer</th><th className="pr-3 font-normal">Ergebnis</th><th className="font-normal">Anlass</th></tr></thead>
     <tbody>{data.log.slice(0,120).map(r=><tr key={r.job+r.start} className="border-b border-slate-100"><td className="py-1 pr-3">{data.jobs.find(j=>j.id===r.job)?.label||r.job}</td><td className="pr-3 tabular-nums">{when(r.start)}</td><td className="pr-3 tabular-nums">{clock(r.end)}</td><td className="pr-3 text-right tabular-nums">{dur(r.seconds)}</td><td className="pr-3">{result(r.result)}</td><td>{r.trigger==='plan'?'Zeitplan':r.trigger==='jetzt'?'Knopf':'von Hand'}</td></tr>)}</tbody></table>
   </details>
  </section>}
 </>;
}
