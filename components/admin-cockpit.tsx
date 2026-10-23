'use client';
import Link from 'next/link';
import {useCallback,useEffect,useState,type ReactNode} from 'react';
import {AdminPageHead,Befund,Zahlen,Abschnitt,Laden} from '@/components/admin-ui';
import {adminHref,type AdminPage} from '@/components/admin-chrome';
import {result} from '@/components/admin-pipeline-parts';
import {n,pct,gb,when,clock} from '@/components/admin-format';

/* Startseite der Administration: beantwortet „Muss ich etwas tun?“ (requirements/admin-konzept.md, B0). Oben, was einen Blick
   braucht (sonst: alles läuft), darunter Zahlen, die letzte Nacht und zugeklappt der Ausbau. Liest nur, was die Seiten selbst lesen (Abdeckung
   /api/admin/coverage, Bestand /api/admin/summary, Nacht und Fehler /api/admin/debug, Platz /api/admin/speicher, Jobs
   /api/admin/zeitplaene), jede Quelle für sich: fällt eine aus, bleiben die anderen Kacheln stehen. Jede Zahl führt zu
   ihrer Seite. Alle 5 Minuten neu. */
type Coverage={total:{areas:number;population:number};connected:{areas:number;population:number};data:{areas:number;population:number};active?:{days:number;areas:number;population:number}};
type Summary={counts:{online:number;updated7d:number;unlabelled:number}};
type Step={startedAt:string;finishedAt:string;result:string};
type Debug={units:{at:string;inactive:string[];stale:boolean}|null;importJob:{status:string;createdAt:string;counts:Record<string,number>}|null;
 pdfRuns:(Step&{kind:string})[];log:{job:string;start:string;end:string;result:string}[];jobs:{id:string;label:string}[];ruleTexts:Step|null;nacharbeit:{startedAt:string;finishedAt:string;due:number}|null;
 failures:{rows?:{range:string;n:number}[];missing?:string};hosts:unknown[];internal:unknown[]};
type Disk={disk:{at:string;disk:{total:number;free:number}|null;backups:{list:{name:string;at?:string|null}[]}}|null};
type Jobs={jobs:{id:string;label:string;next:string|null;run:{running?:{startedAt:string}|null}|null}[]};
/** Grenzen wie die tägliche Betriebsprüfung (OPS_DEFAULTS in server/integrations/ops-check.mjs): Sicherung älter als 36 h, Platte ab 85 % */
const BACKUP_HOURS=36,DISK_PERCENT=85;
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
const failed='nicht erreichbar';
const More=({page,params,children}:{page:AdminPage;params?:string;children:ReactNode})=><Link href={adminHref(page,params)} className="text-[14px] text-teal-700">{children} →</Link>;
/** Eine Sache, die einen Blick braucht: was, warum, wohin */
type Todo={title:string;sub:string;page:AdminPage;params?:string};

export function AdminCockpit(){
 // Uhrzeit des letzten Ladens als Zustand (nicht beim Zeichnen lesen, react-hooks/purity)
 const [tick,setTick]=useState(0),[now,setNow]=useState(()=>Date.now());
 const again=useCallback(()=>{setTick(t=>t+1);setNow(Date.now());},[]);
 useEffect(()=>{const t=setInterval(again,REFRESH_MS);return()=>clearInterval(t);},[again]);
 const cov=useSource<Coverage>('/api/admin/coverage',tick),sum=useSource<Summary>('/api/admin/summary',tick),dbg=useSource<Debug>('/api/admin/debug',tick);
 const disk=useSource<Disk>('/api/admin/speicher',tick),jobs=useSource<Jobs>('/api/admin/zeitplaene',tick);
 const rows=dbg?.failures.rows||[],daily=rows.filter(r=>r.range==='daily').reduce((a,r)=>a+r.n,0),backlog=rows.filter(r=>r.range==='backlog').reduce((a,r)=>a+r.n,0);
 const d=disk?.disk,lastBackup=d?.backups.list.map(b=>b.at||'').filter(Boolean).sort().at(-1);
 const night=dbg?.pdfRuns.find(r=>r.kind==='nightly'),imp=dbg?.importJob;
 const running=jobs?.jobs.filter(j=>j.run?.running)||[],nextJob=jobs?.jobs.filter(j=>j.next).sort((a,b)=>String(a.next).localeCompare(String(b.next)))[0];
 // Was einen Blick braucht; in derselben Reihenfolge wie die Dringlichkeit
 const todo:Todo[]=[];
 if(dbg?.units?.stale)todo.push({title:'Der Zeitplaner meldet sich nicht',sub:`seit ${when(dbg.units.at)}; kein Job startet mehr`,page:'nacht'});
 else if(dbg?.units?.inactive.length)todo.push({title:'Auslöser auf dem Server inaktiv',sub:dbg.units.inactive.join(', '),page:'nacht'});
 const failedRuns=(dbg?.log||[]).filter(r=>r.result==='failed'&&now-Date.parse(r.end||r.start)<864e5);
 if(failedRuns.length)todo.push({title:`${n(failedRuns.length)} Lauf${failedRuns.length>1?'e':''} mit Fehler in den letzten 24 Stunden`,sub:[...new Set(failedRuns.map(r=>dbg?.jobs.find(j=>j.id===r.job)?.label||r.job))].join(', '),page:'nacht'});
 if(daily)todo.push({title:`${n(daily)} Fehler im Tagesbereich`,sub:'Die Nacharbeit versucht sie erneut; nur wiederkehrende brauchen einen Blick.',page:'fehler'});
 if(dbg?.internal.length)todo.push({title:`${n(dbg.internal.length)} Fehler im eigenen Code`,sub:'Diese behebt keine Nacharbeit.',page:'fehler'});
 if(d?.disk&&100-100*d.disk.free/d.disk.total>=DISK_PERCENT)todo.push({title:'Platte fast voll',sub:`${gb(d.disk.free)} frei von ${gb(d.disk.total)}`,page:'speicher'});
 if(d&&(!lastBackup||now-Date.parse(lastBackup)>BACKUP_HOURS*36e5))todo.push({title:'Sicherung zu alt',sub:lastBackup?`letzte ${when(lastBackup)}`:'keine Sicherung gefunden',page:'speicher'});
 const down=[['Abdeckung',cov],['Bestand',sum],['Letzte Nacht',dbg],['Speicher',disk],['Jobs',jobs]].filter(([,v])=>v===null).map(([k])=>k as string);
 if(down.length)todo.push({title:'Nicht alles erreichbar',sub:`Gerade ohne Antwort: ${down.join(', ')}.`,page:'start'});
 const loading=[cov,sum,dbg,disk,jobs].some(v=>v===undefined);
 const stand=<>Stand {clock(new Date(now).toISOString())}{jobs?<> · {running.length?`läuft: ${running.map(j=>j.label).join(', ')}`:'gerade läuft kein Job'}{nextJob?` · nächster Start ${nextJob.label}, ${when(nextJob.next)}`:''}</>:null}</>;
 const line=(label:string,text:ReactNode)=><li className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 border-b border-slate-200 py-2.5"><span className="font-semibold">{label}</span><span className="text-slate-700">{text}</span></li>;
 return <>
  <AdminPageHead page="start" figure={loading?undefined:{value:n(todo.length),label:todo.length===1?'Sache braucht einen Blick':'Sachen brauchen einen Blick'}}/>
  {loading&&!todo.length?<Laden/>:<>
   <Befund stand={stand}>{todo.length?`${todo.length===1?'Eine Sache braucht':`${n(todo.length)} Sachen brauchen`} einen Blick, sonst läuft alles von selbst.`:'Alles läuft von selbst: keine Fehler im Tagesbereich, kein gescheiterter Lauf, Platz und Sicherung in Ordnung.'}</Befund>
   {todo.length>0&&<ul className="m-0 mt-4 max-w-[900px] list-none border-t border-slate-200 p-0">{todo.map(t=><li key={t.title} className="border-b border-slate-200">
    <Link href={adminHref(t.page,t.params)} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-3 hover:bg-slate-50">
     <span className="min-w-0 border-l-2 border-amber-500 pl-3"><span className="block text-[16px] font-semibold text-slate-900">{t.title}</span><span className="block text-[14px] text-slate-500">{t.sub}</span></span>
     <span className="text-[16px] text-teal-700 transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span></Link></li>)}</ul>}
   <Zahlen items={[
    ...(cov?[{value:pct(cov.connected.population,cov.total.population),label:'der Einwohner erreicht',href:adminHref('abdeckung')}]:[]),
    ...(cov?.active?[{value:<>{n(cov.active.areas)}<span className="font-normal text-slate-500"> / {n(cov.connected.areas)}</span></>,label:`Gebiete mit Abruf in ${cov.active.days} Tagen`,href:adminHref('abdeckung')}]:[]),
    ...(sum?[{value:n(sum.counts.online),label:'Berichte',href:adminHref('abruf')},{value:n(sum.counts.updated7d),label:'neu oder geändert in 7 Tagen',href:adminHref('abruf')}]:[]),
    ...(d?.disk?[{value:gb(d.disk.free),label:'frei',href:adminHref('speicher')}]:[]),
    ...(lastBackup?[{value:when(lastBackup),label:'letzte Sicherung',href:adminHref('speicher')}]:[])]}/>

   <Abschnitt id="cockpit-nacht" open={!!failedRuns.length||todo.length===0} title="Letzte Nacht" sub="Die Läufe der Tagespipeline mit Zeit und Ergebnis.">
    {dbg===null?<p className="mt-2 text-[14px] text-slate-500">Der Stand der Nacht ist gerade {failed}.</p>:dbg&&<ul className="m-0 mt-3 max-w-[900px] list-none p-0 text-[14px]">
     {line('Abruf',imp?<>{when(imp.createdAt)}: {Object.entries(imp.counts).map(([k,v])=>`${n(v)} ${IMPORT_STATE[k]||k}`).join(', ')||'keine Gebiete'}{imp.status==='completed'?'':' · läuft oder wartet'}</>:'kein Lauf vermerkt')}
     {line('Extraktion',night?<>{when(night.startedAt)} bis {clock(night.finishedAt)}, {result(night.result)}</>:'kein Lauf vermerkt')}
     {line('Verarbeitung',dbg.ruleTexts?<>{when(dbg.ruleTexts.startedAt)} bis {clock(dbg.ruleTexts.finishedAt)}, {result(dbg.ruleTexts.result)}</>:'kein Lauf vermerkt')}
     {line('Nacharbeit',dbg.nacharbeit?<>{when(dbg.nacharbeit.startedAt)} bis {clock(dbg.nacharbeit.finishedAt)}, {n(dbg.nacharbeit.due)} Einträge fällig</>:'kein Lauf vermerkt')}
    </ul>}
    <p className="mt-3"><More page="nacht">Läufe, Zeitachse und Wege der Berichte</More></p>
   </Abschnitt>

   <Abschnitt id="cockpit-ausbau" open={false} title="Ausbau" sub="Was nicht dringend ist, aber den Bestand größer oder besser macht.">
    <ul className="m-0 mt-3 max-w-[900px] list-none space-y-2 p-0">
     <li><More page="atlas">{cov?`${n(cov.total.areas-cov.connected.areas)} offene Gebiete im Lückenatlas: warum, und was sie schließen könnte`:'Offene Gebiete im Lückenatlas'}</More></li>
     <li><More page="abruf" params="filter=empty">{cov?`${n(Math.max(0,cov.connected.areas-cov.data.areas))} angebundene Gebiete ohne Berichte abrufen`:'Angebundene Gebiete ohne Berichte abrufen'}</More></li>
     <li><More page="pruefliste">{sum?`${n(sum.counts.unlabelled)} Berichte ohne Thema in der Prüfliste`:'Prüfliste'}</More></li>
     {backlog>0&&<li><More page="altbestand">{n(backlog)} alte Fehler im Altbestand</More></li>}
    </ul>
   </Abschnitt>
  </>}
 </>;
}
