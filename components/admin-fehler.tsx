'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {AdminPageHead,Alert} from '@/components/admin-ui';
import {Icon} from '@/components/admin-icons';
import {adminHref} from '@/components/admin-chrome';
import {FailureTable,HostTable,type FailRow} from '@/components/admin-pipeline-parts';
import {PHASES,stepName,CLASS_TERMS} from '@/shared/pipeline-terms.mjs';
import {n,day,when} from '@/components/admin-format';

/* Seite „Fehler & Server“: der Fehlerspeicher aller Stufen an einem Ort (Migration 0040, server/integrations/work-failures.mjs).
   Liest den Stand von /api/admin/debug. „Erneut versuchen“ im Tagesbereich macht Einträge fällig für die Nacharbeit
   (POST /api/admin/debug, reopen); im Altbestand übernimmt der Job „Altbestand“ (POST /api/admin/altbestand, rework). */
type Entry={step:string;key:string;class?:string;reason:string|null;tries:number;last_at:string;next_try_at?:string|null;range?:string;release?:string|null};
type Data={boundary:string;since:string;failures:{rows?:FailRow[];missing?:string};hosts:{host:string;state:string;level:number;next_try_at:string|null;reason:string|null;entries:number}[];internal:Entry[];recent:Entry[];error?:string};
const H2=({icon,children}:{icon:string;children:React.ReactNode})=><h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name={icon} className="text-teal-600"/>{children}</h2>;
const Lead=({children}:{children:React.ReactNode})=><p className="mt-1 max-w-[820px] text-[14px] text-slate-500">{children}</p>;

export function AdminFehler(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState('');
 // ?bereich=altbestand (Link der Seite Altbestand) öffnet den Altbestand
 const params=useSearchParams();
 const [range,setRange]=useState<'daily'|'backlog'>(params.get('bereich')==='altbestand'?'backlog':'daily');
 const load=useCallback(async()=>{
  try{const r=await fetch('/api/admin/debug',{cache:'no-store'});const d=await r.json() as Data;if(!r.ok)throw Error(d.error||'Die Seite konnte nicht geladen werden.');setData(d);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Die Seite konnte nicht geladen werden.');}
 },[]);
 useEffect(()=>{const first=setTimeout(load,0),t=setInterval(load,60000);return ()=>{clearTimeout(first);clearInterval(t);};},[load]);
 const post=async(route:'debug'|'altbestand',body:Record<string,unknown>,confirmText:string,done:(d:Record<string,unknown>)=>string)=>{
  if(!window.confirm(confirmText))return;
  setBusy(true);setNote('');
  try{const r=await fetch('/api/admin/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json() as Record<string,unknown>&{error?:string};if(!r.ok)throw Error(d.error||'Das ging nicht.');setNote(done(d));await load();}
  catch(e){setError(e instanceof Error?e.message:'Das ging nicht.');}
  finally{setBusy(false);}
 };
 const rows=data?.failures.rows||[];
 const sumOf=(r:'daily'|'backlog')=>rows.filter(x=>x.range===r).reduce((a,x)=>a+x.n,0),daily=sumOf('daily'),backlog=sumOf('backlog');
 const retry=(phase:string,cls?:string)=>range==='daily'
  ?post('debug',{action:'reopen',phase,...(cls?{cls}:{})},'Diese Einträge des Tagesbereichs jetzt fällig machen? Die Nacharbeit versucht sie im nächsten Lauf; wartende Server bleiben bis zu ihrer Stichprobe ausgelassen.',d=>`${n(Number(d.reopened)||0)} Einträge sind jetzt fällig; die Nacharbeit versucht sie in ihrem nächsten Lauf (alle 30 Minuten, 9 bis 23 Uhr).`)
  :post('altbestand',{action:'rework',phase,reopen:true,...(cls?{cls}:{})},`Alte Fehler der Stufe ${PHASES[phase as keyof typeof PHASES]?.name} erneut versuchen? Der Job „Altbestand“ arbeitet sie zwischen 10 und 22 Uhr ab.`,()=>'Angefordert; der Job „Altbestand“ arbeitet die Einträge ab.');

 return <>
  <AdminPageHead page="fehler"/>
  {error&&<Alert onRetry={load}>{error}</Alert>}
  {note&&<p role="status" className="mt-4 text-[14px] text-slate-700">{note}</p>}

  <section className="mt-6" aria-label="Fehlerspeicher">
   <H2 icon="alert">Fehlerspeicher</H2>
   {data?.failures.missing?<Lead>Migration 0040 fehlt; ohne sie gibt es keinen Fehlerspeicher.</Lead>:<>
    <Lead>Was gescheitert ist, nach Stufe und Grund. „Jetzt fällig“ kommt im nächsten Lauf dran, „wartet“ hat einen späteren Termin, „kein Versuch mehr“ bleibt liegen, bis jemand ihn wieder öffnet. Tagesbereich: Sitzungen ab {day(data?.boundary)}, bearbeitet von der Nacharbeit. Altbestand: alles Ältere und alles vor dem {day(data?.since)} Gescheiterte, bearbeitet nur auf Knopfdruck.</Lead>
    <div className="mt-3 flex flex-wrap items-center gap-4 text-[14px]" role="radiogroup" aria-label="Bereich">
     {([['daily','Tagesbereich',daily],['backlog','Altbestand',backlog]] as const).map(([k,l,v])=><label key={k} className="flex cursor-pointer items-center gap-2"><input type="radio" name="fehler-bereich" id={'fehler-bereich-'+k} checked={range===k} onChange={()=>setRange(k)}/>{l} ({n(v)})</label>)}
    </div>
    <FailureTable rows={rows} range={range} busy={busy} onRetry={(phase,cls)=>void retry(phase,cls)}/>
    {range==='backlog'&&<p className="mt-3 text-[14px] text-slate-700">Alle alten Fehler auf einmal erneut versuchen: <Link href={adminHref('altbestand')} className="text-teal-700">Altbestand →</Link></p>}
   </>}
  </section>

  {data&&data.hosts.length>0&&<section className="mt-10" aria-label="Server">
   <H2 icon="server">Server, die gerade warten</H2>
   <Lead>Ein Server, der bremst oder mehrfach scheitert, wird eine Zeit lang von allen Abrufen ausgelassen und danach mit drei Dokumenten geprüft. „Freigeben“ zieht die Prüfung vor.</Lead>
   <HostTable hosts={data.hosts} busy={busy} onRelease={h=>void post('debug',{action:'release',host:h},`${h} jetzt freigeben? Die Nacharbeit prüft ihn im nächsten Lauf mit drei Dokumenten.`,()=>'Server freigegeben; die Nacharbeit prüft ihn im nächsten Lauf mit drei Dokumenten.')}/>
   <p className="mt-3 text-[14px] text-slate-700">Server, die beim PDF-Laden scheitern: <Link href={adminHref('pdf')} className="text-teal-700">PDF-Import →</Link></p>
  </section>}

  {data&&data.internal.length>0&&<section className="mt-10" aria-label="Eigener Code">
   <H2 icon="cpu">Fehler im eigenen Code</H2>
   <Lead>Hier hilft kein neuer Versuch; diese Einträge kommen erst nach dem nächsten Deploy wieder dran. Sie sind die Liste für die Entwicklung.</Lead>
   <ul className="m-0 mt-2 max-w-[1100px] list-none space-y-1 p-0 text-[14px]">{data.internal.map(e=><li key={e.step+e.key} className="break-all"><span className="text-slate-500">{stepName(e.step)} · {when(e.last_at)} · Programmstand {e.release||'–'}</span> {e.key}: {e.reason}</li>)}</ul>
  </section>}

  {data&&data.recent.length>0&&<section className="mt-10" aria-label="Letzte Einträge">
   <details className="max-w-[1100px]"><summary className="cursor-pointer text-[22px] font-semibold">Letzte Einträge</summary>
    <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[14px]">{data.recent.map(e=><li key={e.step+e.key} className="break-all"><span className="text-slate-500">{when(e.last_at)} · {e.range==='daily'?'Tagesbereich':'Altbestand'} · {stepName(e.step)} · {CLASS_TERMS[(e.class||'') as keyof typeof CLASS_TERMS]?.name||e.class} · {e.tries}. Versuch · {e.next_try_at?'nächster '+when(e.next_try_at):'kein Versuch mehr'}</span> {e.key}{e.reason?': '+e.reason:''}</li>)}</ul>
   </details>
  </section>}
 </>;
}
