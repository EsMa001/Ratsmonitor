'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {AdminPageHead,Alert} from '@/components/admin-ui';
import {Icon} from '@/components/admin-icons';
import {adminHref} from '@/components/admin-chrome';
import {when,clock} from '@/components/admin-pdf-parts';
import {n,day,Glossary,result,type FailRow,type Counter} from '@/components/admin-pipeline-parts';
import {PDF_JOB_TERMS,PHASES,stepName} from '@/shared/pipeline-terms.mjs';

/* Seite „Altbestand“ (Gruppe Pipeline; Route /api/admin/altbestand, server/integrations/altbestand-admin.mjs): alles, was älter ist als
   der Tagesbereich oder vor dem 12.10.2026 gescheitert ist, auf Knopfdruck abrufen, extrahieren, verarbeiten und alte Fehler
   aufarbeiten. Die Seite legt nur Wünsche ab; ausgeführt wird auf dem Server von 10 bis 22 Uhr (Jobs „Altbestand“, „OCR, tagsüber“,
   „PDF-Aufträge“). Begriffe: shared/pipeline-terms.mjs. */
type Imp={window:string;scope:string;requestedAt:string;total:number;done:number;failed:number;failedRegions:string[];lastAt?:string;finishedAt?:string;stoppedAt?:string};
type Req={import:Imp|null;rework?:{requestedAt:string;phase:string|null;finishedAt?:string};ocr?:{requestedAt:string;stoppedAt?:string}};
type PdfJob={id:string;kind:string;state:string;requestedAt:string;startedAt?:string};
type Data={at:string;boundary:string;since:string;requests:Req;last:{startedAt:string;finishedAt:string;import:{regions:string[];ok:number;failed:number;reports?:number}[];rework:{totals:Counter;readyForAi:number}|null;readyForAi:number}|null;
 rework:{startedAt:string;finishedAt:string;due:number;totals:Counter}|null;jobRuns:Record<string,{lastStart?:string;lastEnd?:string;result?:string;running?:unknown}|null>;
 failures:{rows?:FailRow[];missing?:string};hosts:{host:string;state:string;level:number;next_try_at:string|null;reason:string|null;entries:number}[];
 pdfJobs:{queue:PdfJob[];running:Record<string,PdfJob|null>;recent:(PdfJob&{finishedAt?:string;exit?:string|number})[]};worker:boolean;
 store:{at:string;linked:number;loaded:number;textOnly:number;ocrWaiting:number|null;others:{linked:number;loaded:number}|null}|null;
 ruleTexts:{startedAt:string;finishedAt:string;result:string}|null;aiCounts:{states:Counter;newText:number;withoutAi:number}|null;error?:string};

const WINDOWS:[string,string][]=[['1m','1 Monat'],['3m','3 Monate'],['12m','12 Monate'],['24m','24 Monate']];
const H2=({icon,children}:{icon:string;children:React.ReactNode})=><h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name={icon} className="text-teal-600"/>{children}</h2>;
const Lead=({children}:{children:React.ReactNode})=><p className="mt-1 max-w-[820px] text-[14px] text-slate-500">{children}</p>;
const main='inline-flex items-center gap-2 rounded-full bg-teal-700 px-4 py-2 text-[14px] font-medium text-white hover:bg-teal-800 disabled:opacity-40';
const side='text-[14px] font-medium text-teal-700 hover:text-teal-600 disabled:opacity-40';

export function AdminAltbestand(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState('');
 const [scope,setScope]=useState('sources'),[ids,setIds]=useState(''),[win,setWin]=useState('12m');
 const load=useCallback(async()=>{
  try{const r=await fetch('/api/admin/altbestand',{cache:'no-store'});const d=await r.json() as Data;if(!r.ok)throw Error(d.error||'Die Seite konnte nicht geladen werden.');setData(d);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Die Seite konnte nicht geladen werden.');}
 },[]);
 useEffect(()=>{const first=setTimeout(load,0),t=setInterval(load,60000);return ()=>{clearTimeout(first);clearInterval(t);};},[load]);
 const post=async(body:Record<string,unknown>,confirmText:string,done:(d:Record<string,unknown>)=>string)=>{
  if(!window.confirm(confirmText))return;
  setBusy(true);setNote('');
  try{const r=await fetch('/api/admin/altbestand',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json() as Record<string,unknown>&{error?:string};if(!r.ok)throw Error(d.error||'Das ging nicht.');setNote(done(d));await load();}
  catch(e){setError(e instanceof Error?e.message:'Das ging nicht.');}
  finally{setBusy(false);}
 };
 const list=ids.split(/[\s,;]+/).map(s=>s.trim()).filter(Boolean);
 const imp=data?.requests.import,impOpen=!!imp&&!imp.finishedAt&&!imp.stoppedAt;
 const rows=data?.failures.rows||[],backlog=rows.filter(r=>r.range==='backlog').reduce((a,r)=>a+r.n,0);
 const rework=data?.requests.rework,reworkOpen=!!rework&&!rework.finishedAt,ocrOpen=!!data?.requests.ocr&&!data.requests.ocr.stoppedAt;
 const waitingKinds=new Set([...(data?.pdfJobs.queue||[]).map(j=>j.kind),...Object.values(data?.pdfJobs.running||{}).filter(Boolean).map(j=>j!.kind)]);
 const windowNote='Ausgeführt wird auf dem Server zwischen 10 und 22 Uhr; nachts hat die Tagespipeline Vorrang.';

 return <>
  <AdminPageHead page="altbestand"/>
  {error&&<Alert onRetry={load}>{error}</Alert>}
  {note&&<p role="status" className="mt-4 text-[14px] text-slate-700">{note}</p>}

  <section className="mt-6" aria-label="Begriffe">
   <H2 icon="archive">Was hier bearbeitet wird</H2>
   <Lead>Alles, was nicht zum Tagesbereich gehört: Sitzungen vor dem {day(data?.boundary)} und alle Fehler, die vor dem {day(data?.since)} entstanden sind. Die automatische Nacharbeit fasst das nicht an; hier wird es auf Knopfdruck in denselben drei Stufen nachgeholt. {windowNote}</Lead>
   {data&&<details className="mt-2"><summary className="cursor-pointer text-[14px] text-teal-700">Begriffe: Abläufe und Stufen</summary><Glossary boundary={data.boundary} since={data.since}/></details>}
  </section>

  <section className="mt-10" aria-label="Abruf">
   <H2 icon="download">1. Abruf: Berichte rückwirkend abrufen</H2>
   <Lead>Holt für die gewählten Gebiete die Sitzungen und Berichte des Zeitraums, je 8 Gebiete zur Zeit. Für jedes Gebiet, dessen Abruf gelingt, laufen gleich {stepName('pdf')}, {stepName('others')}, {stepName('text')}, {stepName('ocr')} und {stepName('rules')} für die geschriebenen Berichte. Ein neuer Wunsch ersetzt den vorigen; erledigte Gebiete zählen dann neu.</Lead>
   <form className="mt-3 grid max-w-[820px] gap-3 text-[14px]" onSubmit={e=>{e.preventDefault();
    if(scope==='list'&&!list.length){setError('Bitte mindestens eine Gebietskennung eingeben.');return;}
    const label=WINDOWS.find(w=>w[0]===win)![1];
    post({action:'import',regions:scope==='sources'?'sources':list,window:win},`${scope==='sources'?'Alle angebundenen Quellen':n(list.length)+' Gebiete'} ${label} rückwirkend abrufen? Das kann je nach Umfang Tage dauern (10 bis 22 Uhr).`,d=>`${n(Number(d.regions))} Gebiete angefordert; der Job „Altbestand“ beginnt binnen 10 Minuten (zwischen 10 und 22 Uhr).`);}}>
    <fieldset className="flex flex-wrap gap-x-6 gap-y-2"><legend className="mb-1 font-medium">Gebiete</legend>
     <label className="flex items-center gap-2"><input type="radio" name="alt-scope" id="alt-scope-sources" checked={scope==='sources'} onChange={()=>setScope('sources')}/>alle angebundenen Quellen</label>
     <label className="flex items-center gap-2"><input type="radio" name="alt-scope" id="alt-scope-list" checked={scope==='list'} onChange={()=>setScope('list')}/>nur diese Gebiete</label>
    </fieldset>
    {scope==='list'&&<label className="grid gap-1"><span className="text-slate-500">Gebietskennungen, durch Komma oder Zeilen getrennt (etwa billerbeck, nrw-05334002)</span>
     <textarea id="alt-ids" value={ids} onChange={e=>{setIds(e.target.value);setError('');}} rows={3} className="rounded-lg border border-slate-300 p-2 font-mono text-[14px]"/></label>}
    <label className="flex items-center gap-3"><span className="font-medium">Zeitraum</span>
     <select id="alt-window" value={win} onChange={e=>setWin(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2">{WINDOWS.map(([k,l])=><option key={k} value={k}>{l} zurück</option>)}</select></label>
    <div><button type="submit" className={main} disabled={busy}>Abruf anfordern →</button></div>
   </form>
   {imp&&<div className="mt-4 max-w-[820px] border-t border-slate-200 pt-3 text-[14px]">
    <p><span className="font-medium">{impOpen?'Läuft':imp.finishedAt?'Fertig':'Angehalten'}:</span> {imp.scope==='sources'?'alle angebundenen Quellen':n(imp.total)+' Gebiete'}, {WINDOWS.find(w=>w[0]===imp.window)?.[1]||imp.window} zurück, angefordert {when(imp.requestedAt)}.</p>
    <p className="text-slate-700">{n(imp.done)} von {n(imp.total)} Gebieten abgerufen, {n(imp.failed)} gescheitert (stehen im Fehlerspeicher unten){imp.lastAt?`, zuletzt ${when(imp.lastAt)}`:''}.</p>
    <span className="mt-1 block h-2 max-w-[400px] rounded bg-slate-100"><i className="block h-2 rounded bg-teal-600" style={{width:`${imp.total?(imp.done+imp.failed)/imp.total*100:0}%`}}/></span>
    {imp.failedRegions.length>0&&<p className="mt-1 break-words text-[12px] text-slate-500">Gescheitert: {imp.failedRegions.join(', ')}</p>}
    {impOpen&&<button type="button" className={side+' mt-2'} disabled={busy} onClick={()=>post({action:'import-stop'},'Den rückwirkenden Abruf anhalten? Das laufende Paket wird noch fertig.',()=>'Angehalten; das laufende Paket wird noch fertig.')}>Anhalten →</button>}
   </div>}
  </section>

  <section className="mt-10" aria-label="Extraktion">
   <H2 icon="file">2. Extraktion: PDFs und Text älterer Berichte</H2>
   <Lead>Für Berichte, die schon gespeichert sind. Je Knopf ein Auftrag; einer zur Zeit, die übrigen warten. {windowNote}{data&&!data.worker?' Auf diesem Rechner führt niemand Aufträge aus (kein Lebenszeichen vom Server).':''}</Lead>
   {data?.store&&<p className="mt-2 text-[14px] text-slate-700">Stand der Ablage ({when(data.store.at)}): {n(data.store.loaded+data.store.textOnly)} von {n(data.store.linked)} Hauptdokumenten geladen{data.store.others?`, ${n(data.store.others.loaded)} von ${n(data.store.others.linked)} Anlagen`:''}{data.store.ocrWaiting!=null?`, ${n(data.store.ocrWaiting)} Dateien warten auf OCR`:''}.</p>}
   <ul className="m-0 mt-3 max-w-[820px] list-none space-y-3 p-0 text-[14px]">
    {([['run','Hauptdokumente Monat für Monat zurück, die noch nie versucht wurden.'],['others','Anlagen aller gespeicherten Berichte (die KI liest sie mit).'],['texts','Textebene aller abgelegten PDFs, die noch keinen Text haben; lädt nichts.']] as const).map(([k,what])=><li key={k} className="grid gap-1 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-baseline md:gap-4">
     <span className="font-medium">{PDF_JOB_TERMS[k]}</span><span className="text-slate-700">{what}</span>
     <button type="button" className={side} disabled={busy||waitingKinds.has(k)} onClick={()=>post({action:'pdf',kind:k},`„${PDF_JOB_TERMS[k]}“ anfordern?`,d=>d.created?'Auftrag angelegt.':'Dieser Auftrag läuft oder wartet schon.')}>{waitingKinds.has(k)?'angefordert':'anfordern →'}</button></li>)}
    <li className="grid gap-1 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-baseline md:gap-4">
     <span className="font-medium">{PDF_JOB_TERMS.ocr}</span><span className="text-slate-700">Seiten ohne Text älterer Berichte, nachdem der Tagesbereich gelesen ist (Job „OCR, tagsüber“). Hauptdokumente vor Anlagen, neueste Sitzung zuerst; läuft Tag für Tag weiter, bis Sie anhalten.</span>
     {ocrOpen?<button type="button" className={side} disabled={busy} onClick={()=>post({action:'ocr-stop'},'OCR des Altbestands anhalten? Die OCR des Tagesbereichs läuft weiter.',()=>'Angehalten.')}>anhalten →</button>
      :<button type="button" className={side} disabled={busy} onClick={()=>post({action:'ocr'},'OCR des Altbestands anfordern? Sie läuft zwischen 10 und 22 Uhr, bis Sie anhalten.',()=>'Angefordert; der Job „OCR, tagsüber“ übernimmt binnen 10 Minuten.')}>anfordern →</button>}</li>
   </ul>
   {data&&(data.pdfJobs.queue.length>0||Object.values(data.pdfJobs.running).some(Boolean))&&<p className="mt-3 text-[14px] text-slate-700">Aufträge: {[...Object.values(data.pdfJobs.running).filter(Boolean).map(j=>`${PDF_JOB_TERMS[j!.kind as keyof typeof PDF_JOB_TERMS]||j!.kind} läuft seit ${clock(j!.startedAt)}`),...data.pdfJobs.queue.map(j=>`${PDF_JOB_TERMS[j.kind as keyof typeof PDF_JOB_TERMS]||j.kind} wartet`)].join(', ')}. Fortschritt im Reiter <Link href={adminHref('pdf')} className="text-teal-700">PDF-Import</Link>.</p>}
  </section>

  <section className="mt-10" aria-label="Verarbeitung">
   <H2 icon="text">3. Verarbeitung: Regeln und KI</H2>
   <Lead>{stepName('title')} und {stepName('rules')} laufen nach jedem rückwirkenden Abruf schon für die geschriebenen Berichte. Für alle übrigen Berichte mit neuen Eingaben (etwa nach „{PDF_JOB_TERMS.texts}“ oder der OCR) gibt es diese Knöpfe.</Lead>
   <div className="mt-3 flex flex-wrap gap-4 text-[14px]">
    <button type="button" className={side} disabled={busy} onClick={()=>post({action:'rules'},'„Verarbeitung“ jetzt starten? Sie liest nur Berichte mit neuen Eingaben.',()=>'Angestoßen; der Job „Verarbeitung, nachts“ startet binnen 10 Minuten.')}>Verarbeitung jetzt starten →</button>
    <button type="button" className={side} disabled={busy} onClick={()=>post({action:'rules',all:true},'Alle Berichte neu verarbeiten? Das dauert etwa eine Stunde.',()=>'Angestoßen: alle Berichte neu.')}>Alle Berichte neu verarbeiten →</button>
   </div>
   {data?.ruleTexts&&<p className="mt-2 text-[14px] text-slate-500">Zuletzt {when(data.ruleTexts.startedAt)} bis {clock(data.ruleTexts.finishedAt)}, {result(data.ruleTexts.result)}.</p>}
   <p className="mt-3 max-w-[820px] text-[14px] text-slate-700">KI: Sie startet nicht von selbst (kein automatischer Modellaufruf). {data?.aiCounts?`${n(data.aiCounts.withoutAi)} Berichte mit Regel-Zusammenfassung haben noch keine KI-Fassung, ${n(data.aiCounts.newText)} KI-Fassungen haben seitdem neuen Text bekommen. `:''}{data?.last?.readyForAi?`Der letzte Lauf hat ${n(data.last.readyForAi)} Berichte neu bereitgestellt. `:''}Bearbeitet werden sie vom Agenten über die KI-Liste im Reiter <Link href={adminHref('abruf')} className="text-teal-700">Abruf &amp; Verarbeitung</Link> (Schritt 03).</p>
  </section>

  <section className="mt-10" aria-label="Alte Fehler">
   <H2 icon="alert">Alte Fehler erneut versuchen (alle Stufen)</H2>
   {data?.failures.missing?<Lead>Migration 0040 fehlt; ohne sie gibt es keinen Fehlerspeicher.</Lead>:<>
    <Lead>{n(backlog)} Einträge im Altbestand, nach Stufe und Grund. „Erneut versuchen“ macht sie sofort fällig, auch die ohne weiteren Versuch, und der Job „Altbestand“ arbeitet sie ab: erst Abruf, dann Extraktion, dann Verarbeitung; was gelingt, läuft gleich in die nächste Stufe. Server, die warten, werden erst nach ihrer Prüfung mit drei Dokumenten wieder gefragt.</Lead>
    <div className="mt-3 flex flex-wrap items-center gap-4">
     <button type="button" className={main} disabled={busy||!backlog} onClick={()=>post({action:'rework',reopen:true},`Alle ${n(backlog)} alten Fehler erneut versuchen? Das kann Tage dauern (10 bis 22 Uhr).`,d=>`${n(Number(d.reopened))} Einträge fällig gemacht; der Job „Altbestand“ beginnt binnen 10 Minuten.`)}>Alle alten Fehler erneut versuchen →</button>
     {reworkOpen&&<span className="text-[14px] text-slate-700">Läuft seit {when(rework!.requestedAt)}{rework!.phase?` (Stufe ${PHASES[rework!.phase as keyof typeof PHASES]?.name})`:''}.</span>}
    </div>
    <p className="mt-3 text-[14px] text-slate-700">Einzelne Stufen und Gründe, wartende Server: <Link href={adminHref('fehler','bereich=altbestand')} className="text-teal-700">Fehler & Server →</Link></p>
    {data?.rework&&<p className="mt-3 text-[14px] text-slate-700">Zuletzt {when(data.rework.startedAt)} bis {clock(data.rework.finishedAt)}: {n(data.rework.totals?.ok)} gelungen, {n(data.rework.totals?.again)} neuer Termin, {n(data.rework.totals?.final)} ohne weiteren Versuch.</p>}
   </>}
  </section>

  {data?.last&&<section className="mt-10" aria-label="Letzter Lauf">
   <details className="max-w-[1100px]"><summary className="cursor-pointer text-[18px] font-semibold">Letzter Lauf des Jobs „Altbestand“ ({when(data.last.startedAt)})</summary>
    <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[14px]">{data.last.import.map((c,i)=><li key={i}>Abruf {c.regions?.join(', ')}: {n(c.ok)} gelungen, {n(c.failed)} gescheitert{c.reports?`, ${n(c.reports)} Berichte weiterverarbeitet`:''}</li>)}
     {data.last.rework&&<li>Alte Fehler: {n(data.last.rework.totals?.ok)} gelungen, {n(data.last.rework.totals?.again)} neuer Termin, {n(data.last.rework.totals?.final)} ohne weiteren Versuch</li>}</ul>
   </details>
  </section>}
 </>;
}
