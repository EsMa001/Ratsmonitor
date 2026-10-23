'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {AdminPageHead,Befund,Zahlen,Abschnitt,Fehler,Laden,Leer,SteuernLink} from '@/components/admin-ui';
import {adminHref} from '@/components/admin-chrome';
import {Glossary,result,type FailRow,type Counter} from '@/components/admin-pipeline-parts';
import {PDF_JOB_TERMS,PHASES,stepName} from '@/shared/pipeline-terms.mjs';
import {n,day,when,clock} from '@/components/admin-format';

/* Altbestand (Route /api/admin/altbestand, server/integrations/altbestand-admin.mjs): alles, was älter ist als der Tagesbereich oder
   vor dem 12.10.2026 gescheitert ist, auf Knopfdruck abrufen, extrahieren, verarbeiten und alte Fehler aufarbeiten. Ausgeführt wird
   auf dem Server von 10 bis 22 Uhr (Jobs „Altbestand“, „OCR, tagsüber“, „PDF-Aufträge“). Zwei Teile (requirements/admin-konzept.md,
   B1a): AdminAltbestand ist die Seite, sie liest nur; AltbestandSteuern sind die Formulare und Knöpfe, sie stehen in der Steuerung.
   Begriffe: shared/pipeline-terms.mjs. */
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
const main='inline-flex items-center gap-2 rounded-full bg-teal-700 px-4 py-2 text-[14px] font-medium text-white hover:bg-teal-800 disabled:opacity-40';
const side='text-[14px] font-medium text-teal-700 hover:text-teal-600 disabled:opacity-40';
const Sub=({children}:{children:React.ReactNode})=><p className="m-0 mt-2 max-w-[820px] text-[14px] text-slate-700">{children}</p>;

/** Stand des Altbestands; liest jede Minute neu */
function useAltbestand(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[lastLoad,setLastLoad]=useState(0);
 const load=useCallback(async()=>{
  try{const r=await fetch('/api/admin/altbestand',{cache:'no-store'});const d=await r.json() as Data;if(!r.ok)throw Error(d.error||'Die Seite konnte nicht geladen werden.');setData(d);setError('');setLastLoad(Date.now());}
  catch(e){setError(e instanceof Error?e.message:'Die Seite konnte nicht geladen werden.');}
 },[]);
 useEffect(()=>{const first=setTimeout(load,0),t=setInterval(load,60000);return ()=>{clearTimeout(first);clearInterval(t);};},[load]);
 const imp=data?.requests.import,impOpen=!!imp&&!imp.finishedAt&&!imp.stoppedAt;
 const rows=data?.failures.rows||[],backlog=rows.filter(r=>r.range==='backlog').reduce((a,r)=>a+r.n,0);
 const rework=data?.requests.rework,reworkOpen=!!rework&&!rework.finishedAt,ocrOpen=!!data?.requests.ocr&&!data.requests.ocr.stoppedAt;
 const waitingKinds=new Set([...(data?.pdfJobs.queue||[]).map(j=>j.kind),...Object.values(data?.pdfJobs.running||{}).filter(Boolean).map(j=>j!.kind)]);
 return {data,error,setError,load,lastLoad,imp,impOpen,backlog,rework,reworkOpen,ocrOpen,waitingKinds};
}
const jobsLine=(d:Data)=>[...Object.values(d.pdfJobs.running).filter(Boolean).map(j=>`${PDF_JOB_TERMS[j!.kind as keyof typeof PDF_JOB_TERMS]||j!.kind} läuft seit ${clock(j!.startedAt)}`),...d.pdfJobs.queue.map(j=>`${PDF_JOB_TERMS[j.kind as keyof typeof PDF_JOB_TERMS]||j.kind} wartet`)].join(', ');

/** Seite „Altbestand“: was angefordert ist, wie weit es ist und was der letzte Lauf getan hat. Startet nichts. */
export function AdminAltbestand(){
 const {data,error,load,lastLoad,imp,impOpen,backlog,rework,reworkOpen,ocrOpen}=useAltbestand();
 const open=[impOpen&&`rückwirkender Abruf (${n(imp!.done+imp!.failed)} von ${n(imp!.total)} Gebieten)`,ocrOpen&&'OCR des Altbestands',reworkOpen&&'alte Fehler',data&&jobsLine(data)].filter(Boolean) as string[];
 const befund=!data?null:open.length?`Angefordert und in Arbeit: ${open.join(', ')}. Ausgeführt wird zwischen 10 und 22 Uhr.`:'Gerade ist nichts angefordert; der Altbestand ruht, bis jemand ihn in der Steuerung anstößt.';
 return <>
  <AdminPageHead page="altbestand" figure={data&&!data.failures.missing?{value:n(backlog),label:'alte Fehler',note:'im Fehlerspeicher'}:undefined}/>
  {error&&<Fehler onRetry={load}>{error}</Fehler>}
  {!data&&!error&&<Laden/>}
  {data&&<>
   <Befund stand={<>Stand {when(new Date(lastLoad).toISOString())} · Sitzungen vor dem {day(data.boundary)} und Fehler vor dem {day(data.since)} · <SteuernLink job="altbestand" label="Anfordern in der Steuerung"/></>}>{befund}</Befund>
   {data.store&&<Zahlen items={[{value:`${n(data.store.loaded+data.store.textOnly)} von ${n(data.store.linked)}`,label:'Hauptdokumente geladen',href:adminHref('pdf')},
    ...(data.store.others?[{value:`${n(data.store.others.loaded)} von ${n(data.store.others.linked)}`,label:'Anlagen',href:adminHref('pdf')}]:[]),
    ...(data.store.ocrWaiting!=null?[{value:n(data.store.ocrWaiting),label:'warten auf OCR',href:adminHref('pdf')}]:[]),
    {value:n(backlog),label:'alte Fehler',href:adminHref('fehler','bereich=altbestand')}]}/>}

   <Abschnitt title="1. Abruf" sub="Berichte rückwirkend abrufen; für jedes Gebiet, dessen Abruf gelingt, laufen gleich Extraktion und Verarbeitung.">
    {imp?<div className="mt-3 max-w-[820px] text-[14px]">
     <p className="m-0"><span className="font-semibold">{impOpen?'Läuft':imp.finishedAt?'Fertig':'Angehalten'}:</span> {imp.scope==='sources'?'alle angebundenen Quellen':n(imp.total)+' Gebiete'}, {WINDOWS.find(w=>w[0]===imp.window)?.[1]||imp.window} zurück, angefordert {when(imp.requestedAt)}.</p>
     <p className="m-0 mt-1 text-slate-700">{n(imp.done)} von {n(imp.total)} Gebieten abgerufen, {n(imp.failed)} gescheitert{imp.lastAt?`, zuletzt ${when(imp.lastAt)}`:''}.</p>
     <span className="mt-2 block h-[3px] max-w-[400px] rounded-full bg-slate-100"><i className="block h-full rounded-full bg-teal-600" style={{width:`${imp.total?(imp.done+imp.failed)/imp.total*100:0}%`}}/></span>
     {imp.failedRegions.length>0&&<p className="m-0 mt-2 break-words text-[12px] text-slate-500">Gescheitert: {imp.failedRegions.join(', ')}</p>}
    </div>:<Leer>Noch kein rückwirkender Abruf angefordert.</Leer>}
   </Abschnitt>

   <Abschnitt title="2. Extraktion" sub="PDFs und Text älterer, schon gespeicherter Berichte. Je Auftrag einer zur Zeit, die übrigen warten.">
    <Sub>{jobsLine(data)||'Kein Auftrag läuft oder wartet.'}{ocrOpen?' Die OCR des Altbestands läuft Tag für Tag weiter, bis jemand sie anhält.':''} Fortschritt im <Link href={adminHref('pdf')} className="text-teal-700">PDF-Import →</Link>{!data.worker?' Auf diesem Rechner führt niemand Aufträge aus (kein Lebenszeichen vom Server).':''}</Sub>
   </Abschnitt>

   <Abschnitt title="3. Verarbeitung" sub={`${stepName('model')} und ${stepName('rules')} laufen nach jedem rückwirkenden Abruf gleich für die geschriebenen Berichte, sonst mit dem Job „Verarbeitung, nachts“.`}>
    <Sub>{data.ruleTexts?<>Zuletzt {when(data.ruleTexts.startedAt)} bis {clock(data.ruleTexts.finishedAt)}, {result(data.ruleTexts.result)}. </>:null}
     KI: startet nicht von selbst. {data.aiCounts?`${n(data.aiCounts.withoutAi)} Berichte mit Zusammenfassung haben noch keine KI-Fassung, ${n(data.aiCounts.newText)} KI-Fassungen haben seitdem neuen Text bekommen. `:''}{data.last?.readyForAi?`Der letzte Lauf hat ${n(data.last.readyForAi)} Berichte neu bereitgestellt. `:''}Bearbeitet werden sie vom Agenten über die <Link href={adminHref('verarbeitung')} className="text-teal-700">KI-Liste →</Link></Sub>
   </Abschnitt>

   <Abschnitt title="Alte Fehler" sub="Einträge des Fehlerspeichers im Altbestand; erneut versucht werden sie nur auf Anforderung.">
    {data.failures.missing?<Leer>Migration 0040 fehlt; ohne sie gibt es keinen Fehlerspeicher.</Leer>:<>
     <Sub>{n(backlog)} Einträge{reworkOpen?`; erneuter Versuch läuft seit ${when(rework!.requestedAt)}${rework!.phase?` (Stufe ${PHASES[rework!.phase as keyof typeof PHASES]?.name})`:''}`:''}.{data.rework?` Zuletzt ${when(data.rework.startedAt)} bis ${clock(data.rework.finishedAt)}: ${n(data.rework.totals?.ok)} gelungen, ${n(data.rework.totals?.again)} neuer Termin, ${n(data.rework.totals?.final)} ohne weiteren Versuch.`:''}</Sub>
     <p className="m-0 mt-2 text-[14px]"><Link href={adminHref('fehler','bereich=altbestand')} className="text-teal-700">Nach Stufe und Grund: Fehler & Server →</Link></p></>}
   </Abschnitt>

   {data.last&&<Abschnitt id="altbestand-lauf" open={false} title="Letzter Lauf" sub={`Job „Altbestand“, ${when(data.last.startedAt)} bis ${clock(data.last.finishedAt)}.`}>
    <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[14px]">{data.last.import.map((c,i)=><li key={i}>Abruf {c.regions?.join(', ')}: {n(c.ok)} gelungen, {n(c.failed)} gescheitert{c.reports?`, ${n(c.reports)} Berichte weiterverarbeitet`:''}</li>)}
     {data.last.rework&&<li>Alte Fehler: {n(data.last.rework.totals?.ok)} gelungen, {n(data.last.rework.totals?.again)} neuer Termin, {n(data.last.rework.totals?.final)} ohne weiteren Versuch</li>}</ul>
   </Abschnitt>}

   <Abschnitt id="altbestand-begriffe" open={false} title="Begriffe" sub="Abläufe und Stufen, wie sie überall in der Administration heißen.">
    <Glossary boundary={data.boundary} since={data.since}/>
   </Abschnitt>
  </>}
 </>;
}

/** Aufträge des Altbestands für die Steuerung: rückwirkender Abruf, Extraktion, OCR, alte Fehler. Legt nur Wünsche ab. */
export function AltbestandSteuern(){
 const {data,setError,error,load,imp,impOpen,backlog,reworkOpen,ocrOpen,waitingKinds}=useAltbestand();
 const [busy,setBusy]=useState(false),[note,setNote]=useState('');
 const [scope,setScope]=useState('sources'),[ids,setIds]=useState(''),[win,setWin]=useState('12m');
 const post=async(body:Record<string,unknown>,confirmText:string,done:(d:Record<string,unknown>)=>string)=>{
  if(!window.confirm(confirmText))return;
  setBusy(true);setNote('');
  try{const r=await fetch('/api/admin/altbestand',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json() as Record<string,unknown>&{error?:string};if(!r.ok)throw Error(d.error||'Das ging nicht.');setNote(done(d));await load();}
  catch(e){setError(e instanceof Error?e.message:'Das ging nicht.');}
  finally{setBusy(false);}
 };
 const list=ids.split(/[\s,;]+/).map(s=>s.trim()).filter(Boolean);
 const row='grid gap-1 border-b border-slate-200 py-3 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-baseline md:gap-4';
 return <div className="mt-6 max-w-[1100px] text-[14px]">
  <h3 className="m-0 text-[16px] font-semibold">Aufträge des Altbestands</h3>
  <p className="m-0 mt-1 text-slate-500">Ausgeführt zwischen 10 und 22 Uhr; nachts hat die Tagespipeline Vorrang. <Link href={adminHref('altbestand')} className="text-teal-700">Stand ansehen →</Link></p>
  {error&&<Fehler onRetry={load}>{error}</Fehler>}
  {note&&<p role="status" className="m-0 mt-2 text-slate-700">{note}</p>}
  <ul className="m-0 mt-2 list-none border-t border-slate-200 p-0">
   <li className="border-b border-slate-200 py-3">
    <form className="grid max-w-[820px] gap-3" onSubmit={e=>{e.preventDefault();
     if(scope==='list'&&!list.length){setError('Bitte mindestens eine Gebietskennung eingeben.');return;}
     const label=WINDOWS.find(w=>w[0]===win)![1];
     void post({action:'import',regions:scope==='sources'?'sources':list,window:win},`${scope==='sources'?'Alle angebundenen Quellen':n(list.length)+' Gebiete'} ${label} rückwirkend abrufen? Das kann je nach Umfang Tage dauern (10 bis 22 Uhr).`,d=>`${n(Number(d.regions))} Gebiete angefordert; der Job „Altbestand“ beginnt binnen 10 Minuten (zwischen 10 und 22 Uhr).`);}}>
     <p className="m-0 font-semibold">Rückwirkender Abruf <span className="font-normal text-slate-500">· danach gleich {stepName('pdf')}, {stepName('text')}, {stepName('ocr')} und Verarbeitung. Ein neuer Wunsch ersetzt den vorigen.</span></p>
     <fieldset className="flex flex-wrap gap-x-6 gap-y-2"><legend className="sr-only">Gebiete</legend>
      <label className="flex items-center gap-2"><input type="radio" name="alt-scope" id="alt-scope-sources" checked={scope==='sources'} onChange={()=>setScope('sources')}/>alle angebundenen Quellen</label>
      <label className="flex items-center gap-2"><input type="radio" name="alt-scope" id="alt-scope-list" checked={scope==='list'} onChange={()=>setScope('list')}/>nur diese Gebiete</label>
     </fieldset>
     {scope==='list'&&<label className="grid gap-1"><span className="text-slate-500">Gebietskennungen, durch Komma oder Zeilen getrennt (etwa billerbeck, nrw-05334002)</span>
      <textarea id="alt-ids" value={ids} onChange={e=>{setIds(e.target.value);setError('');}} rows={3} className="rounded-lg border border-slate-300 p-2 font-mono text-[14px]"/></label>}
     <div className="flex flex-wrap items-center gap-4"><label className="flex items-center gap-3"><span>Zeitraum</span>
      <select id="alt-window" value={win} onChange={e=>setWin(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2">{WINDOWS.map(([k,l])=><option key={k} value={k}>{l} zurück</option>)}</select></label>
      <button type="submit" className={main} disabled={busy}>Abruf anfordern →</button>
      {impOpen&&<button type="button" className={side} disabled={busy} onClick={()=>void post({action:'import-stop'},'Den rückwirkenden Abruf anhalten? Das laufende Paket wird noch fertig.',()=>'Angehalten; das laufende Paket wird noch fertig.')}>Laufenden Abruf anhalten ({n(imp!.done+imp!.failed)} von {n(imp!.total)})</button>}</div>
    </form>
   </li>
   {([['run','Hauptdokumente Monat für Monat zurück, die noch nie versucht wurden.'],['others','Anlagen aller gespeicherten Berichte.'],['texts','Textebene aller abgelegten PDFs, die noch keinen Text haben; lädt nichts.']] as const).map(([k,what])=><li key={k} className={row}>
    <span className="font-semibold">{PDF_JOB_TERMS[k]}</span><span className="text-slate-700">{what}</span>
    <button type="button" className={side} disabled={busy||waitingKinds.has(k)} onClick={()=>void post({action:'pdf',kind:k},`„${PDF_JOB_TERMS[k]}“ anfordern?`,d=>d.created?'Auftrag angelegt.':'Dieser Auftrag läuft oder wartet schon.')}>{waitingKinds.has(k)?'angefordert':'anfordern →'}</button></li>)}
   <li className={row}>
    <span className="font-semibold">{PDF_JOB_TERMS.ocr}</span><span className="text-slate-700">Seiten ohne Text älterer Berichte, nachdem der Tagesbereich gelesen ist. Läuft Tag für Tag weiter, bis jemand anhält.</span>
    {ocrOpen?<button type="button" className={side} disabled={busy} onClick={()=>void post({action:'ocr-stop'},'OCR des Altbestands anhalten? Die OCR des Tagesbereichs läuft weiter.',()=>'Angehalten.')}>anhalten</button>
     :<button type="button" className={side} disabled={busy} onClick={()=>void post({action:'ocr'},'OCR des Altbestands anfordern? Sie läuft zwischen 10 und 22 Uhr, bis Sie anhalten.',()=>'Angefordert; der Job „OCR, tagsüber“ übernimmt binnen 10 Minuten.')}>anfordern →</button>}</li>
   <li className={row}>
    <span className="font-semibold">Alte Fehler erneut versuchen</span><span className="text-slate-700">{data?.failures.missing?'Ohne Migration 0040 kein Fehlerspeicher.':`${n(backlog)} Einträge, alle Stufen: erst Abruf, dann Extraktion, dann Verarbeitung.${reworkOpen?' Läuft gerade.':''}`}</span>
    <button type="button" className={side} disabled={busy||!backlog} onClick={()=>void post({action:'rework',reopen:true},`Alle ${n(backlog)} alten Fehler erneut versuchen? Das kann Tage dauern (10 bis 22 Uhr).`,d=>`${n(Number(d.reopened))} Einträge fällig gemacht; der Job „Altbestand“ beginnt binnen 10 Minuten.`)}>anfordern →</button></li>
  </ul>
 </div>;
}
