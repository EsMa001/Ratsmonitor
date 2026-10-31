'use client';
import {isStep,PDF_JOB_TERMS} from '@/shared/pipeline-terms.mjs';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {AdminPageHead,Befund,Zahlen,Abschnitt,Fehler,Laden,Hinweis,Kpis,SteuernLink} from '@/components/admin-ui';
import {Segmented} from '@/components/ratsmonitor/components/Segmented';
import {adminHref} from '@/components/admin-chrome';
import {month,KIND,MonthBars,SpaceBar,ProcessFlow,HostList,RunList,QualityTable,scorePct,type MonthRow,type Host,type Run,type Quality} from '@/components/admin-pdf-parts';
import {n,pct,gb,when,clock,day,dur} from '@/components/admin-format';

/* PDF-Import (requirements/admin-pdf-ablage-konzept.md): was gerade läuft, wie vollständig die Ablage ist, Texte, Platz, wie der
   Import arbeitet, Fehler und Server, Protokoll. Zwei Teile (requirements/admin-konzept.md, B1a): AdminPdf ist die Seite, sie liest
   nur; PdfSteuern (Bahnen anhalten, Fehlgeschlagene erneut, OCR aller PDFs, Stand neu zählen) steht in der Steuerung. Daten: /api/admin/pdf-ablage
   (server/integrations/pdf-store-admin.mjs); die Seite rechnet nichts, sie liest, was die Skripte auf dem Server ablegen. */
type Reason={reason:string;n:number};
type Stats={at:string;seconds:number;linked:number;allPdfs:number;loaded:number;textOnly:number;failed:number;open:number;openBlocked?:number;reasons:Reason[];
 oldest?:{loaded:string|null;tried:string|null;linked:string|null};completeThrough?:string|null;
 bytes:{pdf:number;pdfPrimary?:number;pdfOthers?:number;text:number;used:number};budgetGb:number;
 threshold?:{others:boolean;score?:number}|null;disk?:{free:number;total:number}|null;
 texts:{files:number;ocrWaiting:number;ocrPages?:number;ocrWaitingAll?:number;ocrPagesAll?:number;missing?:number;linked?:number;complete?:number};summaries?:{withText:number;done:number};
 others?:{linked:number;loaded:number;textOnly:number;failed:number;open:number;openBlocked?:number;withText:number;scans:number;reasons:Reason[];completeThrough?:string|null};
 quality?:Quality;months?:{primary:MonthRow[];others:MonthRow[]};hosts?:{total:number;blocked:number;stages?:boolean;top:Host[]};errorsCsv?:{rows:number}};
type Job={id:string;kind:'run'|'retry'|'others'|'texts'|'ocr'|'index'|'index-full';state:string;requestedAt:string;startedAt?:string;finishedAt?:string;exit?:number|string};
type Progress={kind?:string;startedAt?:string;until?:string;step?:string;at:string;plan?:string[];stepIndex?:number;stepStartedAt?:string;stepUntil?:string;
 fetch?:{what:string;month:string;monthOpen:number;done:number;ok:number;unsupported:number;error:number;rate:number;bytes:number};
 text?:{done:number;total:number;failed:number;waiting:number};ocr?:{done:number;total:number;pages:number;failed:number;workers:number;perHour:number|null;fetched?:number;slow?:number}};
type Lane='chain'|'ocr';
/* Letzter Lauf des Dokumentindex der Dokumentsuche (scripts/pdf-store/doc-index.mjs, system_state 'doc-index-last') */
type DocIndex={at:string;seconds:number;ids?:boolean;sourceFiles:number;files:number;pages:number;remaining:number;added:number;updated:number;removed:number;
 rebuild:boolean;swapped?:boolean;bytes:number;indexFiles:number|null;indexPages:number|null;rebuildFiles:number|null;stopped?:boolean;late?:boolean};
type Data={stats:Stats|null;jobs:{queue:Job[];running:Record<Lane,Job|null>;recent:Job[]};progress:{chain:Progress|null;ocr:Progress|null};runs:Run[];
 stop:{chain?:{requestedAt:string};ocr?:{requestedAt:string}};count:{requestedAt:string;startedAt?:string;finishedAt?:string;ok?:boolean}|null;worker:boolean;docIndex?:DocIndex|null;error?:string};
const JOB:Record<string,string>=PDF_JOB_TERMS;
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

/** Stand der Ablage; solange etwas läuft oder wartet, alle 30 Sekunden neu */
function usePdf(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[lastLoad,setLastLoad]=useState(0);
 const load=useCallback(async()=>{
  try{const r=await fetch('/api/admin/pdf-ablage',{cache:'no-store'});const d=await r.json() as Data;if(!r.ok)throw Error(d.error||'Der Stand konnte nicht geladen werden.');setData(d);setError('');setLastLoad(Date.now());}
  catch(e){setError(e instanceof Error?e.message:'Der Stand konnte nicht geladen werden.');}
 },[]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Abruf beim Öffnen; State wird erst nach dem await gesetzt
 useEffect(()=>{load();},[load]);
 const live=!!data&&(!!data.progress.chain||!!data.progress.ocr||data.jobs.queue.length>0||Object.values(data.jobs.running).some(j=>j?.state==='running')||!!data.count&&!data.count.finishedAt);
 useEffect(()=>{if(!live)return;const t=setInterval(load,30000);return ()=>clearInterval(t);},[live,load]);
 return {data,error,setError,load,lastLoad};
}
const stopping=(data:Data,lane:Lane,p?:Progress|null)=>!!p?.startedAt&&!!data.stop[lane]&&Date.parse(data.stop[lane]!.requestedAt)>=Date.parse(p.startedAt);

/** Die zwei Bahnen (Laden, OCR) mit Fortschritt, die Warteschlange und der letzte Auftrag; mit onStop ein Knopf je Bahn */
function Lanes({data,onStop,disabled}:{data:Data;onStop?:(lane:Lane)=>void;disabled?:boolean}){
 const jobs=data.jobs;
 return <ul className="m-0 mt-3 max-w-[1100px] list-none space-y-3 p-0 text-[14px]">
  {(['chain','ocr'] as Lane[]).map(lane=>{
   const p=data.progress[lane],job=jobs.running[lane];
   if(p)return <li key={lane} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
    <div className="min-w-0"><span className="text-slate-500">Bahn {LANE[lane]}: </span><b className="font-semibold">{KIND[p.kind||'']||p.kind||'Lauf'}</b>{p.step&&<> · Schritt <b className="font-semibold">{p.step}</b></>}<span className="text-slate-500"> · seit {clock(p.startedAt)}{p.until&&`, endet spätestens ${clock(p.until)}`}</span>
     <ProgressLine p={p}/>
     <p className="m-0 mt-1 text-slate-700">{progressText(p)||'Fortschritt folgt (wird jede Minute geschrieben).'}</p></div>
    <div>{onStop&&(stopping(data,lane,p)?<span className="text-slate-500">wird angehalten …</span>:<button type="button" className="font-medium text-slate-900 hover:text-teal-700 disabled:opacity-40" disabled={disabled} onClick={()=>onStop(lane)}>Anhalten</button>)}</div>
   </li>;
   if(job?.state==='running')return <li key={lane}><span className="text-slate-500">Bahn {LANE[lane]}: </span><b className="font-semibold">{KIND[job.kind]}</b> läuft seit {clock(job.startedAt)}; Fortschritt folgt.</li>;
   return <li key={lane} className="text-slate-700"><span className="text-slate-500">Bahn {LANE[lane]}: </span>nichts aktiv.</li>;
  })}
  {jobs.queue.length>0&&<li><span className="text-slate-500">Warten (je Bahn einer zur Zeit, in dieser Reihenfolge):</span>
   <ol className="m-0 mt-1 list-decimal space-y-1 pl-5">{jobs.queue.map(j=><li key={j.id}><b className="font-semibold">{KIND[j.kind]}</b><span className="text-slate-500"> (Bahn {LANE[laneOf(j.kind)]}), angefordert {when(j.requestedAt)}</span></li>)}</ol></li>}
  {jobs.recent[0]&&<li className="text-slate-500">Zuletzt: {KIND[jobs.recent[0].kind]}, {when(jobs.recent[0].startedAt||jobs.recent[0].requestedAt)} bis {clock(jobs.recent[0].finishedAt)}: {jobs.recent[0].exit==='abgebrochen'?'abgebrochen':jobs.recent[0].state==='done'?'fertig':'mit Fehlern beendet'}</li>}
 </ul>;
}

/** Seite „PDF-Import“: liest nur. Oben, was läuft und wie voll die Ablage ist; der Bestand per Umschalter; Einzelheiten zugeklappt. */
export function AdminPdf(){
 const {data,error,load,lastLoad}=usePdf();
 const [reasonsOf,setReasonsOf]=useState<'primary'|'others'>('primary'),[part,setPart]=useState<'all'|'primary'|'others'>('primary');
 const s=data?.stats,o=s?.others,ocr=data?.progress.ocr;
 const v=<T,>(f:(x:Stats)=>T):T|string|undefined=>s?f(s):data?'–':undefined;
 const lastRun=data?.runs[0],ocrRate=ocr?.ocr?.perHour||(()=>{const st=data?.runs.find(r=>r.steps.some(x=>x.name==='OCR'&&x.seconds>600))?.steps.find(x=>x.name==='OCR');const f=Number(st?.summary?.files||0);return st&&f?Math.round(f/(st.seconds/3600)):0;})();
 const loadStep=lastRun?.steps.find(x=>isStep(x.name,'pdf')),keep=(loadStep?.summary?.keeper||null) as Record<string,number>|null;
 const lanes=data?(['chain','ocr'] as Lane[]).filter(l=>data.progress[l]||data.jobs.running[l]?.state==='running').map(l=>LANE[l]):[];
 const befund=!data?null:!s?'Noch kein Stand: er entsteht beim ersten Zählen.'
  :`${lanes.length?`Gerade läuft: Bahn ${lanes.join(' und ')}.`:'Gerade läuft nichts.'} ${pct(s.loaded+s.textOnly,s.linked)} der Hauptdokumente sind geladen, die Ablage belegt ${gb(s.bytes.used)} von ${s.budgetGb} GB.`;
 return <>
  <AdminPageHead page="pdf" figure={s?{value:pct(s.loaded+s.textOnly,s.linked),label:'Hauptdokumente geladen'}:undefined}/>
  {error&&<Fehler onRetry={load}>{error}</Fehler>}
  {!data&&!error&&<Laden/>}
  {data&&<>
   <Befund stand={<>{s?`Gezählt ${when(s.at)}`:`Stand ${when(new Date(lastLoad).toISOString())}`} · <SteuernLink job="pdf-job"/></>}>{befund}</Befund>
   {s&&<Zahlen items={[{value:pct(s.texts.linked??0,s.linked),label:'mit Text'},{value:n(s.texts.ocrWaitingAll??s.texts.ocrWaiting),label:'warten auf OCR'},{value:pct(s.failed,s.linked),label:'fehlgeschlagen'},{value:scorePct(s.quality?.avg),label:'Ø Qualität'}]}/>}
   {!data.worker&&<Hinweis>Auf diesem Rechner führt niemand Aufträge aus (kein Lebenszeichen des Server-Dienstes in den letzten 20 Minuten). Auf dem Server prüfen, ob der Job „PDF-Aufträge und Messungen“ eingeschaltet ist.</Hinweis>}

   <Abschnitt title="Jetzt" sub="Zwei Bahnen laufen nebeneinander: Laden (PDFs, Anlagen, Text) und OCR. Anhalten und neue Aufträge in der Steuerung.">
    <Lanes data={data}/>
   </Abschnitt>

   {s&&<Abschnitt title="Bestand" sub={part==='primary'?'Je Bericht das Dokument, aus dem Zusammenfassung und Fakten entstehen: die Vorlage, sonst Beschlussvorschlag oder Bericht, sonst das erste PDF.':part==='others'?'Anlagen, Pläne und weitere Unterlagen. Sie stehen in der Grenze immer unter allen Hauptdokumenten und bleiben deshalb meist nur als Text.':'Alle PDF-Dokumente der Berichte. Text bleibt immer; das PDF nur, solange es in die Grenze passt.'}
    aside={<Segmented label="Dokumente" value={part} onPick={setPart} options={[['primary','Hauptdokumente'],['others','Übrige'],['all','Alle']]}/>}>
    {part==='all'&&<>
   <div className="mt-5"><Kpis label="Stand aller Dokumente" items={[
    {label:'Verlinkt',value:v(s=>n(s.allPdfs)),note:s?`${n(s.linked)} Hauptdokumente, ${n(o?.linked)} übrige`:undefined},
    {label:'PDF gelesen',value:v(s=>pct(s.loaded+s.textOnly+(o?.loaded??0)+(o?.textOnly??0),s.allPdfs)),note:s?`${n(s.loaded+s.textOnly+(o?.loaded??0)+(o?.textOnly??0))} Dokumente einmal heruntergeladen`:undefined},
    {label:'Text gespeichert',value:v(s=>pct((s.texts.linked??0)+(o?.withText??0),s.allPdfs)),note:s?`${n((s.texts.linked??0)+(o?.withText??0))} Dokumente`:undefined},
    {label:'PDF gespeichert',value:v(s=>pct(s.loaded+(o?.loaded??0),s.allPdfs)),note:s?`${n(s.loaded+(o?.loaded??0))} Dokumente; die übrigen nur als Text, fehlgeschlagen oder noch offen`:undefined},
    {label:'Größe der Ablage',value:v(s=>gb(s.bytes.used)),note:s?`von ${s.budgetGb} GB (PDFs ${gb(s.bytes.pdf)}, Texte ${gb(s.bytes.text)})`:undefined},
    {label:'Ø Qualität',value:v(s=>scorePct(s.quality?.avg)),note:s?.quality?`der ${n(s.quality.files)} als PDF abgelegten Dateien`:s?'nach dem nächsten Zählen':undefined},
   ]}/></div>
    </>}
    {part==='primary'&&<>
   <div className="mt-5"><Kpis label="Stand der Hauptdokumente" items={[
    {label:'Verlinkt',value:v(s=>n(s.linked)),note:s?`von ${n(s.allPdfs)} PDF-Dokumenten`:undefined},
    {label:'PDF gelesen',value:v(s=>pct(s.loaded+s.textOnly,s.linked)),note:s?`${n(s.loaded+s.textOnly)} Dokumente einmal heruntergeladen`:undefined},
    {label:'Text gespeichert',value:v(s=>pct(s.texts.linked??0,s.linked)),note:s?`${n(s.texts.linked)} Dokumente, davon ${n(s.texts.complete)} vollständig`:undefined},
    {label:'PDF gespeichert',value:v(s=>pct(s.loaded,s.linked)),note:s?`${n(s.loaded)} Dokumente, ${n(s.textOnly)} nur noch als Text`:undefined},
    {label:'Größe der PDFs',value:v(s=>gb(s.bytes.pdfPrimary??s.bytes.pdf)),note:s?`von ${s.budgetGb} GB für alle PDFs und Texte`:undefined},
    {label:'Ø Qualität',value:v(s=>scorePct(s.quality?.primary.avg)),note:s?.quality?`der ${n(s.quality.primary.files)} als PDF abgelegten Dateien`:s?'nach dem nächsten Zählen':undefined},
   ]}/></div>
   {s?.months&&<MonthBars rows={s.months.primary} label="Hauptdokumente je Sitzungsmonat"/>}
    </>}
    {part==='others'&&<>
   <div className="mt-5"><Kpis label="Stand der übrigen PDFs" items={[
    {label:'Verlinkt',value:o?n(o.linked):v(()=>'–'),note:s&&o?`von ${n(s.allPdfs)} PDF-Dokumenten`:undefined},
    {label:'PDF gelesen',value:o?pct(o.loaded+o.textOnly,o.linked):v(()=>'–'),note:o?`${n(o.loaded+o.textOnly)} Dokumente einmal heruntergeladen`:undefined},
    {label:'Text gespeichert',value:o?pct(o.withText,o.linked):v(()=>'–'),note:o?`${n(o.withText)} Dokumente; ${n(o.scans)} Scans ohne Textebene`:undefined},
    {label:'PDF gespeichert',value:o?pct(o.loaded,o.linked):v(()=>'–'),note:o?`${n(o.loaded)} Dokumente, ${n(o.textOnly)} nur noch als Text`:undefined},
    {label:'Größe der PDFs',value:v(s=>gb(s.bytes.pdfOthers??0)),note:s?`von ${s.budgetGb} GB für alle PDFs und Texte`:undefined},
    {label:'Ø Qualität',value:v(s=>scorePct(s.quality?.others.avg)),note:s?.quality?`der ${n(s.quality.others.files)} als PDF abgelegten Dateien`:s?'nach dem nächsten Zählen':undefined},
   ]}/></div>
   {s?.months&&s.months.others.some(r=>r.ok+r.textOnly+r.failed>0)&&<MonthBars rows={s.months.others} label="Übrige PDFs je Sitzungsmonat"/>}
    </>}
   </Abschnitt>}

   {s&&<Abschnitt id="pdf-texte" open={false} title="Texte" sub="Aus diesen Texten entstehen Einordnung, Zusammenfassungen, Fakten und Suche (Seite Einordnungsmodell).">
   <div className="mt-5"><Kpis label="Texte" items={[
    {label:'Textfassungen',value:v(s=>n(s.texts.files)),note:'Dateien mit gelesenem Text (Textebene oder OCR)'},
    {label:'PDFs ohne Text',value:v(s=>s.texts.missing===undefined?'–':n(s.texts.missing)),note:s?.texts.missing?'abgelegt, Textebene noch nicht gelesen; mit „Textebene lesen“ nachholen':s?.texts.missing===0?'alle abgelegten PDFs haben Text':'nach dem nächsten Zählen'},
    {label:'Warten auf OCR',value:v(s=>n(s.texts.ocrWaitingAll??s.texts.ocrWaiting)),note:s?(()=>{const all=s.texts.ocrWaitingAll??s.texts.ocrWaiting;return `${n(s.texts.ocrPagesAll??s.texts.ocrPages)} Seiten; davon ${n(s.texts.ocrWaiting)} Hauptdokumente${ocrRate&&all?`; bei ${n(ocrRate)} Dateien je Stunde etwa ${dur(Math.round(all/ocrRate*3600))} OCR`:''}`;})():undefined},
   ]}/></div>
   </Abschnitt>}

   {s&&<Abschnitt id="pdf-platz" open={false} title="Platz und Grenze" sub={`Feste Grenze ${s.budgetGb} GB für PDFs und Texte zusammen. Texte bleiben immer; ist die Grenze erreicht, verdrängt eine neue Datei die am schlechtesten bewertete, oder sie bleibt selbst nur als Text.`}>
   {s&&<SpaceBar limit={s.budgetGb*1073741824} parts={[['PDFs Hauptdokumente',s.bytes.pdfPrimary??s.bytes.pdf,'bg-teal-600'],['PDFs übrige',s.bytes.pdfOthers??0,'bg-teal-300'],['Texte',s.bytes.text,'bg-slate-500']]}/>}
   <ul className="m-0 mt-4 max-w-[820px] list-none space-y-1.5 p-0 text-[14px] text-slate-700">
    {s&&<li>{s.threshold?s.threshold.others?'Ablage voll: neue Hauptdokumente verdrängen zuerst übrige PDFs.':s.threshold.score!=null?`Ablage voll: die schlechteste behaltene Datei hat eine Qualität von ${scorePct(s.threshold.score)}; neue Dateien darunter bleiben nur als Text.`:'Ablage voll: neue Dateien verdrängen die am schlechtesten bewerteten.':`Noch ${gb(s.budgetGb*1073741824-s.bytes.used)} frei bis zur Grenze: jede neue Datei bleibt als PDF.`}</li>}
    {keep&&<li>Letzter Lauf ({when(lastRun?.startedAt)}): {n(keep.kept)} behalten, {n(keep.swapped)} schlechtere verdrängt, {n(keep.rejected)} nicht besser (nur Text), {n(keep.tooBig)} zu groß (nur Text).</li>}
     {s.disk&&<li>Festplatte des Servers: {gb(s.disk.free)} frei von {gb(s.disk.total)} (<Link href={adminHref('speicher')} className="text-teal-700">Speicher & Sicherungen →</Link>)</li>}
    </ul>
   </Abschnitt>}

   {s&&<Abschnitt id="pdf-qualitaet" open={false} title="Qualität der Ablage" sub="Jede Datei hat eine Qualität von 0 bis 100 %: Dokumentart × Formalie × Inhalt × Größe. Die Grenze behält die Dateien mit der höchsten Qualität.">
   <div className="mt-5"><Kpis label="Qualität der Ablage" items={[
    {label:'Ø Qualität',value:v(s=>scorePct(s.quality?.avg)),note:s?.quality?`${n(s.quality.files)} Dateien als PDF`:s?'nach dem nächsten Zählen':undefined},
    {label:'Hauptdokumente',value:v(s=>scorePct(s.quality?.primary.avg)),note:s?.quality?`Ø Qualität von ${n(s.quality.primary.files)} Dateien`:undefined},
    {label:'Übrige PDFs',value:v(s=>scorePct(s.quality?.others.avg)),note:s?.quality?`Ø Qualität von ${n(s.quality.others.files)} Dateien`:undefined},
    {label:'Nur als Text',value:v(s=>scorePct(s.quality?.textOnly.avg)),note:s?.quality?`Ø Qualität der ${n(s.quality.textOnly.files)} verdrängten oder zu großen Dateien (Text bleibt)`:undefined},
   ]}/></div>
   {s?.quality&&s.quality.files>0&&<QualityTable q={s.quality}/>}
   </Abschnitt>}

   {s&&<Abschnitt id="pdf-fehler" open={false} title="Abrufe, Fehler und Server" sub="Was nicht geladen ist und warum; der Fehlerspeicher aller Stufen steht unter Fehler & Server.">
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
   {s?.hosts&&<><h3 className="mt-8 text-[18px] font-semibold">Server, die nicht liefern</h3><HostList hosts={s.hosts.top} total={s.hosts.total} blocked={s.hosts.blocked} stages={!!s.hosts.stages}/></>}
   </Abschnitt>}

   <Abschnitt id="ablauf" open={false} title="So läuft der Import" sub="Jeder Schritt arbeitet nur mit dem, was der vorige abgelegt hat, und fasst nur Neues an. Haken: Regel; Uhr: Grenze.">
   <ProcessFlow steps={[
    {icon:'report',title:'Abruf',what:'Der Abruf speichert je Bericht die Links auf seine Dokumente. Die PDFs selbst lädt erst die Extraktion.',
     rules:['Hauptdokument: die Vorlage, sonst Beschlussvorschlag oder Bericht, sonst das erste PDF','Alle anderen PDFs eines Berichts sind „übrige PDFs“ (Anlagen, Pläne …)','Dieselbe Adresse wird nur einmal geladen, auch wenn mehrere Berichte sie verlinken'],
     value:s?`${n(s.linked)} Hauptdokumente, ${n(o?.linked)} übrige`:undefined},
    {icon:'download',title:'PDF laden, Anlagen laden',what:'Nachts nur die PDFs der Berichte, die der Abruf seit dem letzten Lauf geschrieben hat: erst die Hauptdokumente, dann die Anlagen (die KI liest alle). Ältere Monate nur im Altbestand. Mit der Kennung von Plenara, höflich gegenüber den Servern.',
     rules:['Je Server höchstens 3 Abrufe gleichzeitig, 0,2 Sekunden Abstand','Was scheitert, kommt mit seinem Grund in den Fehlerspeicher; die Nacharbeit versucht es tagsüber erneut (Sitzungen der letzten 7 Tage), Älteres der Altbestand','Ein Server, der bremst (429/503) oder 3-mal in Folge scheitert, wartet 1 Stunde bis 7 Tage und wird dann mit 3 Dokumenten geprüft','„Nicht gefunden“ und „kein PDF“ werden nicht wiederholt'],
     limits:['Je Datei höchstens 10 Sekunden und 30 MB','Nachts höchstens 48 Minuten (Hauptdokumente 29, Anlagen 19)'],
     value:s?`${pct(s.loaded+s.textOnly,s.linked)} geladen`:undefined},
    {icon:'scale',title:'Bewerten und Grenze',what:'Jede neue Datei wird sofort bewertet. Ist die Grenze erreicht, verdrängt sie die am schlechtesten bewertete Datei, wenn sie besser ist; sonst bleibt sie selbst nur als Text.',
     rules:['Qualität 0 bis 100 % = Dokumentart × Formalie × Inhalt × Größe','Dokumentart: Vorlage und Beschluss 1, Niederschrift 0,7, Anlage 0,4, Einladung 0,1; Formalie halber Wert','Dokumentart aus dem ersten Wort des Titels, berichtigt durch den Textanfang (steht dort „Beschlussvorlage“, „Vorlage-Nr.“ oder „Drucksache“, zählt die Datei als Vorlage)','Inhalt voll ab 4.000 Zeichen Text (Seiten, die auf OCR warten, vorläufig 800 Zeichen); Größe voll bis 100 KB, darüber langsam fallend','Scan oder Textebene und Alter zählen nicht','Übrige PDFs stehen immer unter allen Hauptdokumenten','Vor dem Löschen ist die Textebene gelesen; Seiten ohne Text liest später „OCR starten“ (lädt die Datei dafür kurz nach)'],
     limits:[`Feste Grenze ${s?.budgetGb??80} GB für PDFs und Texte zusammen`,'Über 10 MB nur Text (alle Dokumentarten); das PDF wird gleich nach der Textebene gelöscht, auch bei Scans'],
     value:s?`${gb(s.bytes.used)} von ${s.budgetGb} GB`:undefined},
    {icon:'text',title:'Text lesen',what:'Die Textebene jedes PDFs wird gleich beim Laden gelesen und als Textfassung neben dem PDF abgelegt; sie bleibt auch, wenn das PDF gelöscht wird.',
     rules:['Seiten mit weniger als 20 Zeichen gelten als Scan und warten auf OCR'],
     value:s?`${pct(s.texts.linked??0,s.linked)} mit Text`:undefined},
    {icon:'scan',title:'OCR',what:'Liest Seiten ohne Textebene per Texterkennung (Deutsch): nachts die neuen Dateien (bis 45 Minuten), was übrig bleibt der Job „OCR, tagsüber“; den Altbestand nur auf Anforderung (Seite Altbestand).',
     rules:['Hauptdokumente vor Anlagen, abgelegte vor gelöschten, neueste Sitzung zuerst','Schon gelöschte PDFs werden kurz nachgeladen (dieselbe Datei), gelesen und gleich wieder gelöscht','Große Seiten werden verkleinert gelesen (höchstens 12 Megapixel)'],
     limits:['2 Worker, je eine Datei','Je Seite höchstens 90 Sekunden, je Datei 5 Minuten; was länger braucht, kommt in den Fehlerspeicher („zu langsam“)','Ein Paket ohne Lebenszeichen über 3 Minuten wird beendet'],
     value:s?`${n(s.texts.ocrWaitingAll??s.texts.ocrWaiting)} Dateien warten`:undefined},
    {icon:'gauge',title:'Stand zählen',what:'Zählt alles auf dieser Seite neu: verlinkt, geladen, Text, Fehler, Server, Platz.',
     rules:['Am Ende jedes Laufs und mit „Stand neu zählen“'],value:s?`zuletzt ${when(s.at)}`:undefined},
    {icon:'summary',title:'Weiter: Verarbeitung',what:'Aus den abgelegten Texten entstehen Einordnung, Regel-Zusammenfassungen, Fakten, Suche und Zahlen für plenara.X (Job „Einordnung, nachts“, Reiter Einordnungsmodell); die KI liest dieselben Texte.',
     rules:['Direkt nach „Extraktion, nachts“ (sie stößt ihn an), sonst zur Zeit aus der Steuerung','Oder dort per Knopf']},
   ]} when={['Tagespipeline: „Extraktion, nachts“ zur Zeit aus der Steuerung (Standard 05:30 Uhr), höchstens 2 Stunden, nach „Abruf, nachts“ (Standard 01:00 Uhr).','Nacharbeit: tagsüber automatisch, für Sitzungen der letzten 7 Tage (frühestens 12.10.2026).','Altbestand: Aufträge hier und auf der Seite Altbestand, nur zwischen 10 und 22 Uhr; jeder Lauf macht dort weiter, wo der vorige aufgehört hat.']}/>
   </Abschnitt>

   <Abschnitt id="pdf-dokumentindex" open={false} title="Dokumentindex" sub="Index der Dokumentsuche (Pro, Seite Dokumente): jede Seite der Hauptdokumente mit Text. Angelegt per Auftrag in der Steuerung, danach nachts und nach der OCR nachgeführt.">
   <DocIndexKpis d={data.docIndex??null}/>
   </Abschnitt>

   <Abschnitt id="pdf-laeufe" open={false} title="Läufe" sub="Die letzten 20 Läufe (Nachtkette und von Hand); antippen für die Schritte.">
   {data&&<RunList runs={data.runs}/>}
   </Abschnitt>
  </>}
 </>;
}

/** Stand des Dokumentindex aus dem letzten Lauf; ohne Lauf der Hinweis, wie er entsteht */
function DocIndexKpis({d}:{d:DocIndex|null}){
 if(!d)return <p className="m-0 mt-3 text-[14px] text-slate-700">Noch kein Dokumentindex. Anlegen in der Steuerung mit „{JOB.index}“ (10 bis 22 Uhr, in Stücken, neueste Sitzungen zuerst).</p>;
 const files=d.indexFiles??d.files,pages=d.indexPages??d.pages;
 return <div className="mt-5"><Kpis label="Dokumentindex" items={[
  {label:'Dokumente im Index',value:n(files),note:`${pct(files,d.sourceFiles)} der ${n(d.sourceFiles)} Hauptdokumente mit Text`},
  {label:'Seiten',value:n(pages),note:`${gb(d.bytes)} belegt${d.rebuildFiles!=null?`; Neubau bei ${n(d.rebuildFiles)} Dokumenten`:''}`},
  {label:'Rückstand',value:n(d.remaining),note:d.remaining?'neue oder geänderte Texte; der nächste Lauf nimmt sie auf':'alle Texte aufgenommen'},
  {label:'Letzter Lauf',value:when(d.at),note:`${dur(d.seconds)}${d.ids?' (nach OCR)':''}: ${n(d.added)} neu, ${n(d.updated)} geändert, ${n(d.removed)} entfernt${d.late?', Zeit um':''}${d.stopped?', angehalten':''}${d.swapped?', Neubau übernommen':''}`},
 ]}/></div>;
}

/** Aufträge der PDF-Ablage für die Steuerung, in zwei Teilen: „bahnen“ (Gruppe Betrieb, beim Job „PDF-Aufträge und Messungen“):
    laufende Bahnen anhalten, Stand neu zählen; „auftraege“ (Gruppe Altbestand, gleich unter dessen Aufträgen): Fehlgeschlagene erneut,
    OCR aller PDFs. Ältere Monate, Anlagen und Textebene fordert der Altbestand an (dieselben Aufträge). */
export function PdfSteuern({teil}:{teil:'bahnen'|'auftraege'}){
 const {data,error,setError,load}=usePdf();
 const [busy,setBusy]=useState(false),[note,setNote]=useState('');
 const post=async(body:Record<string,unknown>,confirmText?:string)=>{
  if(confirmText&&!window.confirm(confirmText))return;
  setBusy(true);setNote('');
  try{const r=await fetch('/api/admin/pdf-ablage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json() as {error?:string;created?:boolean;reason?:string|null};if(!r.ok)throw Error(d.error||'Das ging nicht.');
   setNote(d.created===false&&d.reason?`„${JOB[String(body.kind)]??'Dieser Auftrag'}“ ${d.reason==='running'?'läuft schon':'wartet schon'}; kein zweiter angelegt.`:'Angefordert.');
   await load();}
  catch(e){setError(e instanceof Error?e.message:'Das ging nicht.');}
  finally{setBusy(false);}
 };
 const canAct=!!data?.worker&&!busy,counting=!!data?.count&&!data.count.finishedAt;
 const row='grid gap-1 border-b border-slate-200 py-3 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-baseline md:gap-4';
 const side='text-[14px] font-medium text-teal-700 hover:text-teal-600 disabled:opacity-40';
 return <div className="mt-6 max-w-[1100px] text-[14px]">
  <h3 className="m-0 text-[16px] font-semibold">{teil==='bahnen'?'PDF-Ablage: Bahnen und Stand':'Weitere PDF-Aufträge'}</h3>
  <p className="m-0 mt-1 text-slate-500">{teil==='bahnen'?'Zwei Bahnen (Laden, OCR), je Bahn ein Auftrag zur Zeit; die übrigen warten.':'Für alle Berichte, egal wie alt; ausgeführt vom Job „PDF-Aufträge und Messungen“.'} <Link href={adminHref('pdf')} className="text-teal-700">Stand ansehen →</Link></p>
  {error&&<Fehler onRetry={load}>{error}</Fehler>}
  {data&&!data.worker&&<Hinweis>Kein Lebenszeichen des Server-Dienstes in den letzten 20 Minuten; die Knöpfe sind gesperrt.</Hinweis>}
  {note&&<p role="status" className="m-0 mt-2 text-slate-700">{note}</p>}
  {teil==='bahnen'&&data&&<Lanes data={data} disabled={!canAct} onStop={lane=>void post({action:'stop',lane},lane==='chain'?'Bahn Laden jetzt anhalten? Der Lauf endet nach wenigen Sekunden, ohne den Schritt abzuwarten. Was schon geladen oder gelesen ist, bleibt; offene Schritte holt der nächste Lauf nach.':'Bahn OCR jetzt anhalten? Fertig gelesene Dateien bleiben, angefangene und der Rest kommen beim nächsten „OCR starten“ oder nachts dran.')}/>}
  <ul className="m-0 mt-3 list-none border-t border-slate-200 p-0">
   {teil==='auftraege'&&<><li className={row}><span className="font-semibold">Fehlgeschlagene PDFs erneut versuchen</span><span className="text-slate-700">Macht alle wiederholbaren Abruffehler und wartenden Server sofort fällig; die Nacharbeit versucht sie, je Server erst mit einer Stichprobe. „Nicht gefunden“ und „kein PDF“ bleiben.</span>
    <button type="button" className={side} disabled={!canAct} onClick={()=>void post({action:'queue',kind:'retry'})}>anfordern →</button></li>
   <li className={row}><span className="font-semibold">OCR aller PDFs</span><span className="text-slate-700">Einmal alle PDFs mit Seiten ohne Text, egal wie alt: Hauptdokumente vor Anlagen, neueste Sitzung zuerst (10 bis 22 Uhr); endet, wenn alles gelesen ist. Anders als „OCR des Altbestands“ oben, die nur ältere Berichte liest und Tag für Tag weiterläuft, bis jemand sie anhält.</span>
    <button type="button" className={side} disabled={!canAct} onClick={()=>void post({action:'queue',kind:'ocr'})}>anfordern →</button></li>
   <li className={row}><span className="font-semibold">{JOB.index}</span><span className="text-slate-700">Index der Dokumentsuche (Pro): nimmt neue und geänderte Texte der Hauptdokumente auf, neueste Sitzungen zuerst; legt ihn beim ersten Mal an (rund 5 bis 7 GB neben der Ablage). Läuft 10 bis 22 Uhr in Stücken und setzt beim nächsten Auftrag fort; nachts führt die Tagespipeline ihn nach.</span>
    <button type="button" className={side} disabled={!canAct} onClick={()=>void post({action:'queue',kind:'index'})}>anfordern →</button></li>
   <li className={row}><span className="font-semibold">{JOB['index-full']}</span><span className="text-slate-700">Baut den Index in einer zweiten Datei neu (nach einer neuen Fassung des Index nötig, sonst nur bei Verdacht auf Fehler); die Suche liest bis zum Ende den alten.</span>
    <button type="button" className={side} disabled={!canAct} onClick={()=>void post({action:'queue',kind:'index-full'},'Den Dokumentindex neu aufbauen? Das dauert mehrere Tage in Stücken und belegt währenddessen den doppelten Platz.')}>anfordern →</button></li>
   </>}
   {teil==='bahnen'&&<li className={row}><span className="font-semibold">Stand neu zählen</span><span className="text-slate-700">Zählt die Seite PDF-Import neu: verlinkt, geladen, Text, Fehler, Server, Platz.</span>
    <button type="button" className={side} disabled={!canAct||counting} onClick={()=>void post({action:'count'})}>{counting?(data?.count?.startedAt?'wird gezählt …':'angefordert …'):'anfordern →'}</button></li>}
  </ul>
 </div>;
}
