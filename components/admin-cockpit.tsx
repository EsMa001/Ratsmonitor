'use client';
import Link from 'next/link';
import {useCallback,useEffect,useState,type ReactNode} from 'react';
import {AdminPageHead,Kpis} from '@/components/admin-ui';
import {Icon} from '@/components/admin-icons';
import {adminHref,type AdminPage} from '@/components/admin-chrome';
import {result} from '@/components/admin-pipeline-parts';
import {n,pct,gb,when,clock} from '@/components/admin-format';

/* Startseite der Administration: der Stand auf einen Blick. Liest nur, was die Seiten selbst lesen (Abdeckung
   /api/admin/coverage, Bestand /api/admin/summary, Nacht und Fehler /api/admin/debug, Platz /api/admin/speicher, Jobs
   /api/admin/zeitplaene), jede Quelle für sich: fällt eine aus, bleiben die anderen Kacheln stehen. Jede Zahl führt zu
   ihrer Seite. Alle 5 Minuten neu. */
type Coverage={total:{areas:number;population:number};connected:{areas:number;population:number};data:{areas:number;population:number}};
type Summary={counts:{online:number;updated7d:number;unlabelled:number}};
type Step={startedAt:string;finishedAt:string;result:string};
type Debug={units:{at:string;inactive:string[];stale:boolean}|null;importJob:{status:string;createdAt:string;counts:Record<string,number>}|null;
 pdfRuns:(Step&{kind:string})[];ruleTexts:Step|null;nacharbeit:{startedAt:string;finishedAt:string;due:number}|null;
 failures:{rows?:{range:string;n:number}[];missing?:string};hosts:unknown[];internal:unknown[]};
type Disk={disk:{at:string;disk:{total:number;free:number}|null;backups:{list:{name:string;at?:string|null}[]}}|null};
type Jobs={jobs:{id:string;label:string;next:string|null;run:{running?:{startedAt:string}|null}|null}[]};
const REFRESH_MS=5*60*1000;
const IMPORT_STATE:Record<string,string>={completed:'gespeichert',partial:'teilweise',failed:'gescheitert',deferred:'zurückgestellt',queued:'wartet',running:'läuft',unknown:'unklar',unavailable:'ohne Quelle',cancelled:'beendet'};

/** Liest eine Quelle; null = fehlgeschlagen, undefined = lädt noch. */
function useSource<T>(url:string,tick:number){
 const [value,setValue]=useState<T|null|undefined>(undefined);
 useEffect(()=>{
  const c=new AbortController();
  fetch(url,{cache:'no-store',signal:c.signal}).then(async r=>{if(!r.ok)throw Error();setValue(await r.json() as T);}).catch(e=>{if(e?.name!=='AbortError')setValue(null);});
  return()=>c.abort();
 },[url,tick]);
 return value;
}
const H2=({icon,children}:{icon:string;children:ReactNode})=><h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name={icon} className="text-teal-600"/>{children}</h2>;
const More=({page,params,children}:{page:AdminPage;params?:string;children:ReactNode})=><Link href={adminHref(page,params)} className="text-[14px] text-teal-700">{children} →</Link>;
const failed='nicht erreichbar';

export function AdminCockpit(){
 const [tick,setTick]=useState(0);
 const again=useCallback(()=>setTick(t=>t+1),[]);
 useEffect(()=>{const t=setInterval(again,REFRESH_MS);return()=>clearInterval(t);},[again]);
 const cov=useSource<Coverage>('/api/admin/coverage',tick),sum=useSource<Summary>('/api/admin/summary',tick),dbg=useSource<Debug>('/api/admin/debug',tick);
 const disk=useSource<Disk>('/api/admin/speicher',tick),jobs=useSource<Jobs>('/api/admin/zeitplaene',tick);
 const rows=dbg?.failures.rows||[],daily=rows.filter(r=>r.range==='daily').reduce((a,r)=>a+r.n,0),backlog=rows.filter(r=>r.range==='backlog').reduce((a,r)=>a+r.n,0);
 const d=disk?.disk,lastBackup=d?.backups.list.map(b=>b.at||'').filter(Boolean).sort().at(-1);
 const night=dbg?.pdfRuns.find(r=>r.kind==='nightly'),imp=dbg?.importJob;
 const running=jobs?.jobs.filter(j=>j.run?.running)||[],nextJob=jobs?.jobs.filter(j=>j.next).sort((a,b)=>String(a.next).localeCompare(String(b.next)))[0];
 const val=<T,>(src:T|null|undefined,f:(v:T)=>ReactNode)=>src===undefined?undefined:src===null?failed:f(src);
 const line=(label:string,text:ReactNode)=><li className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3"><span className="font-medium">{label}</span><span className="text-slate-700">{text}</span></li>;
 return <>
  <AdminPageHead page="start"/>
  {dbg?.units&&(dbg.units.inactive.length>0||dbg.units.stale)&&<div role="alert" className="mt-4 max-w-[900px] rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
   <strong>Auslöser auf dem Server:</strong> {dbg.units.stale?`der Zeitplaner hat sich seit ${when(dbg.units.at)} nicht gemeldet; kein Job startet mehr.`:`inaktiv: ${dbg.units.inactive.join(', ')}. Diese Jobs starten nie, bis sie auf dem Server wieder eingeschaltet sind.`} <More page="nacht">Letzte Nacht</More>
  </div>}
  <section className="mt-8">
   <Kpis label="Stand auf einen Blick" items={[
    {label:'Einwohner erreicht',value:val(cov,c=>pct(c.connected.population,c.total.population)),note:cov?<>{n(cov.connected.areas)} von {n(cov.total.areas)} Gebieten angebunden · <More page="abdeckung">Abdeckung</More></>:undefined},
    {label:'Berichte gespeichert',value:val(sum,s=>n(s.counts.online)),note:sum?<>{n(sum.counts.updated7d)} in 7 Tagen neu oder geändert · <More page="abruf">Abruf</More></>:undefined},
    {label:'Fehler im Tagesbereich',value:val(dbg,g=>g.failures.missing?'–':n(daily)),note:dbg?<>{n(backlog)} im Altbestand{dbg.hosts.length?` · ${n(dbg.hosts.length)} Server warten`:''} · <More page="fehler">Fehler & Server</More></>:undefined},
    {label:'Freier Platz',value:val(disk,x=>x.disk?.disk?gb(x.disk.disk.free):'–'),note:d?.disk?<>von {gb(d.disk.total)}{lastBackup?` · letzte Sicherung ${when(lastBackup)}`:''} · <More page="speicher">Speicher</More></>:undefined}]}/>
  </section>

  <section className="mt-12" aria-label="Letzte Nacht">
   <H2 icon="moon">Letzte Nacht</H2>
   {dbg===null?<p className="mt-2 text-[14px] text-slate-500">Der Stand der Nacht ist gerade {failed}.</p>:!dbg?<p className="mt-2 text-[14px] text-slate-500">Wird geladen …</p>:
    <ul className="m-0 mt-3 max-w-[900px] list-none space-y-2 p-0 text-[14px]">
     {line('Abruf',imp?<>{when(imp.createdAt)}: {Object.entries(imp.counts).map(([k,v])=>`${n(v)} ${IMPORT_STATE[k]||k}`).join(', ')||'keine Gebiete'}{imp.status==='completed'?'':' · läuft oder wartet'}</>:'kein Lauf vermerkt')}
     {line('Extraktion',night?<>{when(night.startedAt)} bis {clock(night.finishedAt)}, {result(night.result)}</>:'kein Lauf vermerkt')}
     {line('Verarbeitung',dbg.ruleTexts?<>{when(dbg.ruleTexts.startedAt)} bis {clock(dbg.ruleTexts.finishedAt)}, {result(dbg.ruleTexts.result)}</>:'kein Lauf vermerkt')}
     {line('Nacharbeit',dbg.nacharbeit?<>{when(dbg.nacharbeit.startedAt)} bis {clock(dbg.nacharbeit.finishedAt)}, {n(dbg.nacharbeit.due)} Einträge fällig</>:'kein Lauf vermerkt')}
    </ul>}
   <p className="mt-3"><More page="nacht">Läufe, Zeitachse und Wege der Berichte</More></p>
  </section>

  <section className="mt-12" aria-label="Jobs">
   <H2 icon="clock">Jetzt</H2>
   <p className="mt-2 max-w-[900px] text-[14px] text-slate-700">{jobs===undefined?'Wird geladen …':jobs===null?`Die Jobs sind gerade ${failed}.`:<>
    {running.length?`Läuft: ${running.map(j=>`${j.label} (seit ${clock(j.run!.running!.startedAt)})`).join(', ')}.`:'Gerade läuft kein Job.'}
    {nextJob?` Nächster Start: ${nextJob.label}, ${when(nextJob.next)}.`:''}</>}</p>
   <p className="mt-3"><More page="zeitplaene">Jobs & Zeitpläne</More></p>
  </section>

  <section className="mt-12" aria-label="Als Nächstes">
   <H2 icon="check">Als Nächstes</H2>
   <ul className="m-0 mt-3 max-w-[900px] list-none space-y-2 p-0">
    <li><More page="atlas">{cov?`${n(cov.total.areas-cov.connected.areas)} offene Gebiete im Lückenatlas: warum, und was sie schließen könnte`:'Offene Gebiete im Lückenatlas'}</More></li>
    <li><More page="abruf" params="filter=empty">{cov?`${n(Math.max(0,cov.connected.areas-cov.data.areas))} angebundene Gebiete ohne Berichte abrufen`:'Angebundene Gebiete ohne Berichte abrufen'}</More></li>
    <li><More page="pruefliste">{sum?`${n(sum.counts.unlabelled)} Berichte ohne Thema in der Prüfliste`:'Prüfliste'}</More></li>
    {backlog>0&&<li><More page="altbestand">{n(backlog)} alte Fehler im Altbestand</More></li>}
   </ul>
  </section>
 </>;
}
