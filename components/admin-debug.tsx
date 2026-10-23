'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {AdminPageHead,Befund,Zahlen,Abschnitt,Aufklapp,Hinweis,Fehler,Laden,Leer,SteuernLink} from '@/components/admin-ui';
import {ListRow} from '@/components/ratsmonitor/pages/analytics/ListRow';
import {Segmented} from '@/components/ratsmonitor/components/Segmented';
import {adminHref} from '@/components/admin-chrome';
import {Glossary,StepList,Timeline,result,type Step,type FailRow,type Counter} from '@/components/admin-pipeline-parts';
import {PHASES,stepName,CLASS_TERMS} from '@/shared/pipeline-terms.mjs';
import {n,when,clock,dur} from '@/components/admin-format';

/* Seite „Letzte Nacht“ (früher „Pipeline-Debug“; Route /api/admin/debug, server/integrations/pipeline-debug.mjs), Muster des
   einheitlichen Aufbaus (requirements/admin-konzept.md): Kopfband mit Kennzahl, Befund, Zahlen, Abschnitte, unten Begriffe und
   Laufbuch. Liest nur gespeicherte Stände: wann lief was, was haben die Läufe getan, welchen Weg nahmen die Berichte. Den
   Fehlerspeicher zeigt die Seite „Fehler & Server“, den Altbestand die Seite „Altbestand“. Begriffe: shared/pipeline-terms.mjs. */
type PdfRun={kind:string;startedAt:string;finishedAt:string;result:string;steps:Step[]};
type RuleRun={startedAt:string;finishedAt:string;result:string;steps:Step[]};
type NachStep={step:string;name?:string;entries:number;ok?:number;again?:number;final?:number;untouched?:number;skipped?:string;seconds?:number};
type Nach={startedAt:string;finishedAt:string;due:number;steps:NachStep[];followUp?:{after:string;step:string;code:number|string;reports?:number}[];readyForAi?:number;totals?:Counter};
type Win={since:string;written:number;withPdf:number;noPdf:number;main:number;session:number;noMain:number;pdf:Counter;failures:Counter;text:Counter;ocr:Counter;rules:Counter;summary:Counter;label:Counter;ai:Counter;imports:Counter};
type Entry={step:string;key:string;class?:string;reason:string|null;tries:number;last_at:string;next_try_at?:string|null;range?:string;release?:string|null};
type Data={at:string;boundary:string;since:string;units:{at:string;inactive:string[];stale:boolean}|null;jobs:{id:string;label:string;flow:string}[];log:{job:string;start:string;end:string;seconds:number;result:string;trigger:string}[];
 backfill?:{round:number;startedAt:string;total:number;remaining:number;last:{at:string;round:number;picked:number;done:number;kept:number;failed:number;minutes:number}|null}|null;
 pdfRuns:PdfRun[];ruleTexts:RuleRun|null;nacharbeit:Nach|null;altbestand:{last:{startedAt:string;finishedAt:string;readyForAi?:number}|null;importOpen:boolean;reworkOpen:boolean;ocrOpen:boolean};
 aiCounts:{at:string;states:Counter;newText:number;withoutAi:number}|null;trace:{at:string;seconds:number;windows:Record<string,Win>}|null;pdfDaily:{startedAt:string}|null;
 importJob:{status:string;createdAt:string;updatedAt:string;window:string|null;counts:Counter;deferred:{region:string;message:string}[];failed:{region:string;message:string}[]}|null;
 failures:{rows?:FailRow[];hosts?:Counter;missing?:string};hosts:{host:string;state:string;level:number;next_try_at:string|null;reason:string|null;entries:number}[];internal:Entry[];recent:Entry[];error?:string};

const IMPORT_STATE:Record<string,string>={completed:'gespeichert',partial:'teilweise gespeichert',failed:'gescheitert',deferred:'zurückgestellt',queued:'wartet',running:'läuft',unknown:'Ausgang unklar',unavailable:'ohne Quelle'};
const AI_STATE:Record<string,string>={completed:'fertig',failed:'gescheitert',insufficient_source:'Quelle reicht nicht',processing:'in Arbeit',pending:'bereit',stale:'veraltet',waiting_text:'wartet auf Text',legacy:'frühere Fassung'};
const words=(c:Counter,names:Record<string,string>)=>Object.entries(c).map(([k,v])=>`${n(v)} ${names[k]||k}`).join(', ');
const Sub=({children}:{children:React.ReactNode})=><p className="m-0 mt-1 text-[14px] text-slate-500">{children}</p>;
/** Ein Lauf: Name, Zeit und Ausgang immer; die Schritte klappen auf. Rechts der Weg zur Steuerung */
const Run=({title,job,note,children}:{title:string;job:string;note?:React.ReactNode;children?:React.ReactNode})=><Aufklapp title={title} note={note} aside={<SteuernLink job={job}/>}>{children}</Aufklapp>;
const span=(r:{startedAt:string;finishedAt:string;result?:string})=>`${when(r.startedAt)} bis ${clock(r.finishedAt)}${r.result?', '+result(r.result):''}`;

/** Weg der Berichte, nach Stufen: je Zeile Anzahl, Balken (Anteil an den geschriebenen) und was abzweigt */
function Paths({w}:{w:Win}){
 const base=Math.max(1,w.written),inStore=(w.pdf.ok||0)+(w.pdf['text-only']||0),pdfFail=(w.pdf.error||0)+(w.pdf.unsupported||0);
 // „Titel eingeordnet“ (Titelregel) entfällt seit dem Modell; read-reports liest nur Berichte mit Modellantwort
 const rows:[string,string,number,string][]=[
  ['abruf','Berichte geschrieben',w.written,`${n(w.noPdf)} davon ohne PDF`],
  ['abruf','mit PDF',w.withPdf,`${n(w.session)} nur mit Unterlage der ganzen Sitzung, ${n(w.noMain)} ohne erkennbares Hauptdokument`],
  ['extraktion','Hauptdokument geladen',inStore,`${n(w.pdf['text-only'])} nur noch als Text, ${n(pdfFail)} gescheitert, ${n(w.pdf.none)} noch nicht versucht`],
  ['extraktion','Text gelesen',w.text.ok||0,`${n(w.text.missing)} noch ohne Text, ${n(w.text.error)} nicht lesbar`],
  ['extraktion','Text vollständig',(w.ocr.none||0)+(w.ocr.done||0),`${n(w.ocr.done)} per OCR ergänzt, ${n(w.ocr.waiting)} warten auf OCR`],
  ['verarbeitung','Modell und Regeln angewendet',w.rules.read||0,`${n(w.rules.stale)} mit älterem Stand, ${n(w.rules.never)} noch nie`],
  ['verarbeitung','Zusammenfassung',w.summary.yes||0,''],
  ['verarbeitung','KI-Fassung',w.ai.completed||0,`${n(w.ai.other)} in Arbeit oder gescheitert, ${n(w.ai.none)} noch nicht bearbeitet`],
 ];
 const fails=Object.entries(w.failures||{});
 return <div className="max-w-[900px]">
  {Object.entries(PHASES).map(([k,p])=><div key={k} className="mt-6"><p className="m-0 text-[12px] font-medium uppercase tracking-wide text-slate-500">{p.name}</p>
   <ul className="m-0 list-none p-0">{rows.filter(r=>r[0]===k).map(([,label,v,note])=><ListRow key={label} title={label} sub={note||undefined} value={n(v)} valueSub={`${Math.round(v/base*100)} %`} bar={v/base*100} arrow={false}/>)}</ul></div>)}
  <p className="mt-4 text-[14px] text-slate-500">{fails.length>0&&<>Im Fehlerspeicher (Hauptdokument): {fails.map(([k,v])=>`${n(v)} ${CLASS_TERMS[k as keyof typeof CLASS_TERMS]?.name||k}`).join(', ')}. </>}Abrufe je Gebiet und Teil: {words(w.imports||{},IMPORT_STATE)||'keine'}.</p>
 </div>;
}

export function AdminDebug(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[win,setWin]=useState<'24h'|'7d'>('24h');
 const load=useCallback(async()=>{
  try{const r=await fetch('/api/admin/debug',{cache:'no-store'});const d=await r.json() as Data;if(!r.ok)throw Error(d.error||'Die Seite konnte nicht geladen werden.');setData(d);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Die Seite konnte nicht geladen werden.');}
 },[]);
 // Erster Abruf gleich nach dem Einhängen, danach jede Minute (nicht synchron im Effekt, react-hooks/set-state-in-effect)
 useEffect(()=>{const first=setTimeout(load,0),t=setInterval(load,60000);return ()=>{clearTimeout(first);clearInterval(t);};},[load]);
 const rows=data?.failures.rows||[],w=data?.trace?.windows?.[win],w24=data?.trace?.windows?.['24h'];
 const daily=rows.filter(r=>r.range==='daily').reduce((a,r)=>a+r.n,0),backlog=rows.filter(r=>r.range==='backlog').reduce((a,r)=>a+r.n,0);
 const nightRun=data?.pdfRuns.find(r=>r.kind==='nightly'),ocrRun=data?.pdfRuns.find(r=>r.kind==='ocr');
 const imp=data?.importJob;
 // Läufe der letzten 24 Stunden aus dem Laufbuch: Kennzahl und Befund
 const since=data?Date.parse(data.at)-864e5:0,runs=data?data.log.filter(r=>Date.parse(r.end||r.start)>=since):[];
 const failed=runs.filter(r=>r.result==='failed').length,done=runs.filter(r=>r.result==='ok'||r.result==='done').length;
 const unitsBad=!!data?.units&&(data.units.inactive.length>0||data.units.stale);
 const befund=!data?null:!runs.length?'In den letzten 24 Stunden lief kein Job.'
  :`${failed?`${n(failed)} von ${n(runs.length)} Läufen der letzten 24 Stunden hatten Fehler`:`Alle ${n(runs.length)} Läufe der letzten 24 Stunden sind ohne Fehler durchgelaufen`}${w24?.written?`; der Abruf hat ${n(w24.written)} Berichte geschrieben.`:'.'}${unitsBad?' Auf dem Server sind Auslöser ausgefallen.':''}`;

 return <>
  <AdminPageHead page="nacht" figure={data?{value:<>{n(done)}<span className="text-[22px] font-normal opacity-70"> / {n(runs.length)}</span></>,label:'Läufe fertig',note:'letzte 24 Stunden'}:undefined}/>
  {error&&<Fehler onRetry={load}>{error}</Fehler>}
  {!data&&!error&&<Laden/>}
  {data&&<>
   <Befund stand={<>Stand {when(data.at)} · aktualisiert sich jede Minute</>}>{befund}</Befund>
   <Zahlen items={data.failures.missing?[{value:'–',label:'Fehlerspeicher fehlt (Migration 0040)'}]:[
    {value:n(daily),label:'Fehler im Tagesbereich',href:adminHref('fehler')},
    {value:n(backlog),label:'im Altbestand',href:adminHref('fehler')},
    {value:n(data.hosts.length),label:'Server warten',href:adminHref('fehler')},
    {value:n(data.internal.length),label:'Fehler im eigenen Code',href:adminHref('fehler')}]}/>
   {unitsBad&&data.units&&<Hinweis><strong>Auslöser auf dem Server:</strong>{' '}
    {data.units.stale?<>der Zeitplaner hat sich seit {when(data.units.at)} nicht gemeldet; kein Job startet mehr.</>:<>inaktiv: {data.units.inactive.join(', ')}. Diese Jobs starten nie, bis jemand sie auf dem Server wieder einschaltet (<code>systemctl start {data.units.inactive.join(' ')}</code>). Jobs nur über „Anhalten“ stoppen, nie über <code>systemctl stop …timer</code>.</>}</Hinweis>}

   <Abschnitt title="Wann lief was" sub="Letzte 24 Stunden, je Job eine Zeile.">
    {data.log.length?<Timeline at={data.at} jobs={data.jobs} log={data.log}/>:<Leer>Noch kein Lauf im Laufbuch. Es füllt sich, sobald die Jobs über den Zeitplaner laufen.</Leer>}
   </Abschnitt>

   <Abschnitt title="Was die letzten Läufe getan haben" sub="Je Lauf Zeit und Ergebnis; ein Klick zeigt die Schritte. Starten und anhalten über die Steuerung.">
    <div className="mt-2 grid max-w-[1100px] gap-x-12 gap-y-8 md:grid-cols-2">
     <div className="min-w-0">
      <p className="m-0 mt-4 text-[12px] font-medium uppercase tracking-wide text-slate-500">Tagespipeline, nachts</p>
      <Run title="Abruf" job="import-nightly" note={imp?`${when(imp.createdAt)}, ${imp.window==='1d'?'1 Tag':imp.window} zurück${imp.status==='completed'?'':', läuft oder wartet'}`:'kein Abruf vermerkt'}>
       {imp&&<><Sub>{words(imp.counts,IMPORT_STATE)}.</Sub>
       {imp.deferred.length?<><Sub>{n(imp.deferred.length)} Gebiete zurückgestellt (Quelle oder Server wartet):</Sub><ul className="m-0 mt-1 list-none p-0 text-[14px] text-slate-700">{imp.deferred.map(d=><li key={d.region}>{d.region}: <span className="text-slate-500">{d.message}</span></li>)}</ul></>:null}</>}
      </Run>
      <Run title="Lückenabruf" job="import-nightly" note={data.backfill?`Runde ${data.backfill.round}: ${n(data.backfill.total-data.backfill.remaining)} von ${n(data.backfill.total)} Gebieten`:'noch keine Runde'}>
       {data.backfill?.last&&<Sub>Zuletzt {when(data.backfill.last.at)}: {n(data.backfill.last.picked)} Gebiete über 12 Monate, {n(data.backfill.last.done)} erledigt, {n(data.backfill.last.kept)} bleiben in der Runde{data.backfill.last.failed?`, ${n(data.backfill.last.failed)} gescheitert (Fehlerspeicher)`:''}, {String(data.backfill.last.minutes).replace('.',',')} min. Runde begonnen {when(data.backfill.startedAt)}; Gebiete mit wenigen Berichten zuerst.</Sub>}
      </Run>
      <Run title="Extraktion" job="pdf-nightly" note={nightRun?span(nightRun):'noch kein Lauf'}>{nightRun&&<StepList steps={nightRun.steps}/>}</Run>
      <Run title="Verarbeitung" job="rule-texts" note={data.ruleTexts?span(data.ruleTexts):'noch kein Lauf'}>{data.ruleTexts&&<StepList steps={data.ruleTexts.steps}/>}</Run>
      {data.aiCounts&&<Sub>KI (von Hand über den Agenten): {words(data.aiCounts.states,AI_STATE)||'noch nichts bearbeitet'}. {n(data.aiCounts.newText)} KI-Fassungen haben seitdem neuen Text bekommen, {n(data.aiCounts.withoutAi)} Berichte mit Zusammenfassung haben noch keine.</Sub>}
     </div>
     <div className="min-w-0">
      <p className="m-0 mt-4 text-[12px] font-medium uppercase tracking-wide text-slate-500">Tagsüber</p>
      <Run title="Nacharbeit" job="nacharbeit" note={data.nacharbeit?`${span(data.nacharbeit)}: ${n(data.nacharbeit.totals?.ok)} von ${n(data.nacharbeit.due)} gelungen`:'noch kein Lauf'}>
       {data.nacharbeit&&<>
        <Sub>{n(data.nacharbeit.due)} Einträge fällig, {n(data.nacharbeit.totals?.ok)} gelungen, {n(data.nacharbeit.totals?.again)} wieder gescheitert (neuer Termin), {n(data.nacharbeit.totals?.final)} ohne weiteren Versuch.</Sub>
        <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[14px]">{data.nacharbeit.steps.map(s=><li key={s.step} className="grid grid-cols-[150px_minmax(0,1fr)] gap-x-3"><span>{s.name||stepName(s.step)}</span>
         <span className="text-slate-700">{s.skipped?`ausgelassen (${s.skipped})`:`${n(s.entries)} versucht: ${n(s.ok)} gelungen, ${n(s.again)} neuer Termin, ${n(s.final)} kein Versuch mehr${s.untouched?`, ${n(s.untouched)} nicht drangekommen`:''} · ${dur(s.seconds)}`}</span></li>)}</ul>
        {data.nacharbeit.followUp?.length?<Sub>Danach gleich weiter: {data.nacharbeit.followUp.map(f=>`${f.step} (nach ${f.after})`).join(', ')}.{data.nacharbeit.readyForAi?` ${n(data.nacharbeit.readyForAi)} Berichte stehen damit für die KI bereit.`:''}</Sub>:null}
       </>}
      </Run>
      <Run title="OCR" job="ocr" note={ocrRun?span(ocrRun):'noch kein Lauf mit gelesenen Dateien'}>{ocrRun&&<StepList steps={ocrRun.steps}/>}</Run>
      <Run title="Altbestand" job="altbestand" note={[data.altbestand.last?span(data.altbestand.last):'noch kein Lauf',data.altbestand.importOpen&&'Abruf angefordert',data.altbestand.reworkOpen&&'alte Fehler werden erneut versucht',data.altbestand.ocrOpen&&'OCR angefordert'].filter(Boolean).join(' · ')}/>
     </div>
    </div>
   </Abschnitt>

   <Abschnitt id="nacht-wege" open={false} title="Welchen Weg die Berichte genommen haben" sub={data.trace?<>Alle Berichte, die der Abruf im Zeitraum geschrieben hat, und wie weit jeder gekommen ist. Je Bericht zählt sein Hauptdokument. Gezählt {when(data.trace.at)} am Ende von „Einordnung, nachts“.</>:'Noch keine Zählung. Sie entsteht am Ende von „Einordnung, nachts“.'}
    aside={<Segmented label="Zeitraum" value={win} onPick={setWin} options={[['24h','24 Stunden'],['7d','7 Tage']]}/>}>
    {w&&(w.written?<Paths w={w}/>:<Leer>In diesem Zeitraum hat der Abruf keine Berichte geschrieben.</Leer>)}
   </Abschnitt>

   <section className="mt-12 max-w-[1100px] space-y-4 border-t border-slate-200 pt-6" aria-label="Begriffe und Laufbuch">
    <details><summary className="cursor-pointer text-[16px] font-semibold">So liest man diese Seite</summary>
     <Sub>Jeder Bericht durchläuft drei Stufen. Was nachts nicht klappt, kommt mit seinem Grund in den Fehlerspeicher; die Nacharbeit versucht es tagsüber erneut, sobald der Grund es erlaubt. Ältere Dinge bearbeitet nur die Seite <Link href={adminHref('altbestand')} className="text-teal-700">Altbestand</Link>.</Sub>
     <Glossary boundary={data.boundary} since={data.since}/></details>
    <details><summary className="cursor-pointer text-[16px] font-semibold">Laufbuch des Zeitplaners</summary>
    <table className="mt-2 w-full border-collapse text-[14px]"><thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="py-1 pr-3 font-normal">Job</th><th className="pr-3 font-normal">Start</th><th className="pr-3 font-normal">Ende</th><th className="pr-3 text-right font-normal">Dauer</th><th className="pr-3 font-normal">Ergebnis</th><th className="font-normal">Anlass</th></tr></thead>
     <tbody>{data.log.slice(0,120).map(r=><tr key={r.job+r.start} className="border-b border-slate-100"><td className="py-1 pr-3">{data.jobs.find(j=>j.id===r.job)?.label||r.job}</td><td className="pr-3 tabular-nums">{when(r.start)}</td><td className="pr-3 tabular-nums">{clock(r.end)}</td><td className="pr-3 text-right tabular-nums">{dur(r.seconds)}</td><td className="pr-3">{result(r.result)}</td><td>{r.trigger==='plan'?'Zeitplan':r.trigger==='jetzt'?'Knopf':'von Hand'}</td></tr>)}</tbody></table>
    </details>
   </section>
  </>}
 </>;
}
