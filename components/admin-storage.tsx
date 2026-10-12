'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {AdminPageHead,Alert,Kpis} from '@/components/admin-ui';
import {adminHref} from '@/components/admin-chrome';
import {Icon} from '@/components/admin-icons';
import {n,gb,when,dur} from '@/components/admin-pdf-parts';

/* Reiter „Speicher & Sicherungen“ (server/integrations/server-storage.mjs, Route /api/admin/speicher): was auf der Festplatte
   des Servers wie viel Platz belegt und welche Sicherungen es gibt. Gemessen von scripts/server-disk.mjs auf dem Server. */
type F={name:string;bytes:number;at?:string|null;kind?:string;files?:number;current?:boolean};
type Disk={at:string;seconds:number;disk:{total:number;free:number;used:number}|null;
 parts:{database:number;pdfStore:number;backups:number;releases:number;ocr:number;other:number|null};
 database:{files:F[]};pdfStore:{dir:string;pdfPrimary:number|null;pdfOthers:number;text:number|null;index:number;bytes:number;at:string|null;budgetGb:number|null}|null;
 backups:{dir:string;list:F[];env:F[]};releases:F[];ocr:{label:string;dir:string;bytes:number;files:number}[];
 tables:{at:string;seconds:number;free:number;list:{name:string;bytes:number}[]}|null};
type Data={disk:Disk|null;count:{requestedAt:string;tables:boolean;startedAt?:string;finishedAt?:string}|null;worker:boolean;error?:string};
const PARTS:[keyof Disk['parts'],string,string,string][]=[['database','Datenbank','bg-teal-600','database'],['pdfStore','PDF-Ablage','bg-teal-300','file'],['backups','Sicherungen','bg-slate-600','shield'],['releases','Programmstände','bg-slate-400','box'],['ocr','OCR-Werkzeuge','bg-slate-300','cpu'],['other','System und Sonstiges','bg-slate-200','drive']];
const LOW=20*1073741824;

/** Liste mit Balken relativ zum größten Eintrag */
function Bars({rows,max}:{rows:{key:string;label:React.ReactNode;bytes:number;note?:React.ReactNode}[];max?:number}){
 const top=max??Math.max(1,...rows.map(r=>r.bytes));
 return <ol className="m-0 mt-3 max-w-[820px] list-none border-t border-slate-200 p-0">
  {rows.map(r=><li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-slate-200 py-2.5 text-[14px]">
   <span className="min-w-0"><span className="break-all">{r.label}</span>{r.note&&<span className="ml-2 text-[12px] text-slate-500">{r.note}</span>}<span className="mt-1.5 block h-[3px] rounded-full bg-slate-100"><span className="block h-full rounded-full bg-teal-600" style={{width:`${Math.max(1,r.bytes/top*100)}%`}}/></span></span>
   <b className="text-right font-semibold tabular-nums">{gb(r.bytes)}</b>
  </li>)}
 </ol>;
}

export function AdminStorage(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  try{const r=await fetch('/api/admin/speicher',{cache:'no-store'});const d=await r.json() as Data;if(!r.ok)throw Error(d.error||'Die Messung konnte nicht geladen werden.');setData(d);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Die Messung konnte nicht geladen werden.');}
 },[]);
 useEffect(()=>{load();},[load]);
 const pending=!!data?.count&&!data.count.finishedAt;
 useEffect(()=>{if(!pending)return;const t=setInterval(load,30000);return ()=>clearInterval(t);},[pending,load]);
 const measure=async(tables:boolean)=>{
  setBusy(true);
  try{const r=await fetch('/api/admin/speicher',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'count',tables})});const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||'Das ging nicht.');await load();}
  catch(e){setError(e instanceof Error?e.message:'Das ging nicht.');}
  finally{setBusy(false);}
 };
 const d=data?.disk,disk=d?.disk,v=<T,>(f:(x:Disk)=>T):T|string|undefined=>d?f(d):data?'–':undefined;
 const dbMain=d?.database.files.find(f=>f.kind==='Datenbank')?.bytes||0,dbBackups=d?.backups.list.filter(b=>b.kind==='Datenbank')||[];
 const textBtn='text-[14px] font-medium text-teal-600 hover:text-teal-700 disabled:opacity-40';
 return <>
  <AdminPageHead page="speicher">
   <p className="text-[14px] text-slate-500">{d?`Gemessen ${when(d.at)} (${dur(d.seconds)})`:data?'Noch keine Messung: sie entsteht beim nächsten Aufruf des Jobs „PDF-Aufträge und Messungen“.':'Wird geladen …'}</p>
  </AdminPageHead>
  {error&&<Alert onRetry={load}>{error}</Alert>}
  {data&&!data.worker&&<p className="mt-4 flex max-w-[820px] gap-2 text-[14px] text-slate-900"><Icon name="alert" size={18} className="mt-[1px]"/><span>Auf diesem Rechner misst niemand (kein Lebenszeichen des Server-Dienstes in den letzten 20 Minuten). Die Zahlen sind die der letzten Messung.</span></p>}
  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
   <button type="button" className={textBtn} disabled={busy||pending||!data?.worker} onClick={()=>measure(false)}>{pending?(data?.count?.startedAt?'Wird gemessen …':'Messung angefordert …'):'Neu messen →'}</button>
   <button type="button" className={textBtn} disabled={busy||pending||!data?.worker} onClick={()=>measure(true)}>Mit Tabellen neu messen (einige Minuten) →</button>
  </div>

  <section className="mt-8" aria-label="Festplatte">
   <h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name="drive" className="text-teal-600"/>Festplatte</h2>
   <div className="mt-5"><Kpis label="Festplatte" items={[
    {label:'Größe',value:v(()=>gb(disk?.total))},
    {label:'Belegt',value:v(()=>gb(disk?.used)),note:disk?`${Math.round(disk.used/disk.total*100)} %`:undefined},
    {label:'Frei',value:v(()=>gb(disk?.free)),note:disk&&disk.free<LOW?'Unter 20 GB: Sicherung und PDF-Import brauchen Platz':undefined},
    {label:'Platz für die nächste Sicherung',value:v(()=>disk&&dbMain?(disk.free>dbMain*1.5?'reicht':'knapp'):'–'),note:dbMain?`die ungepackte Kopie braucht vorübergehend etwa ${gb(dbMain)}, dazu die gepackte`:undefined},
   ]}/></div>
   {d&&disk&&<div className="mt-6 max-w-[980px]">
    <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-50" role="img" aria-label={PARTS.map(([k,l])=>`${l} ${gb(d.parts[k])}`).join(', ')+`, frei ${gb(disk.free)}`}>
     {PARTS.map(([k,,c])=>(d.parts[k]||0)>0?<i key={k} className={'block h-full '+c} style={{width:`${(d.parts[k]||0)/disk.total*100}%`}}/>:null)}
    </div>
    <ul className="m-0 mt-4 grid list-none gap-x-8 gap-y-2 p-0 text-[14px] sm:grid-cols-2 lg:grid-cols-3">
     {PARTS.map(([k,l,c,icon])=><li key={k} className="flex items-center gap-2"><i className={'inline-block h-2.5 w-2.5 shrink-0 rounded-sm '+c}/><Icon name={icon} size={16} className="text-slate-500"/><span className="min-w-0 flex-1">{l}</span><b className="font-semibold tabular-nums">{gb(d.parts[k])}</b></li>)}
     <li className="flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-slate-200 bg-slate-50"/><Icon name="check" size={16} className="text-slate-500"/><span className="min-w-0 flex-1">frei</span><b className="font-semibold tabular-nums">{gb(disk.free)}</b></li>
    </ul>
   </div>}
  </section>

  <section className="mt-12" aria-label="Datenbank">
   <h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name="database" className="text-teal-600"/>Datenbank</h2>
   <p className="mt-1 max-w-[820px] text-[14px] text-slate-500">Eine Datei mit allen Berichten, Suchkarten, Auswertungen und Einstellungen. Daneben das Schreibprotokoll (WAL), das SQLite regelmäßig in die Datei zurückschreibt.</p>
   {d&&<Bars rows={d.database.files.map(f=>({key:f.name,label:f.name,bytes:f.bytes,note:f.kind}))}/>}
   {d?.database.files.some(f=>f.kind==='Übrig geblieben')&&<p className="mt-2 max-w-[820px] text-[14px] text-slate-500">„Übrig geblieben“: Nebendateien einer früheren Datenbankdatei gleichen Namens; sie gehören zu keiner laufenden Datenbank. Löschen nur nach Prüfung auf dem Server.</p>}
   <h3 className="mt-8 text-[18px] font-semibold">Größte Tabellen</h3>
   {d?.tables?<>
    <p className="mt-1 text-[14px] text-slate-500">Je Tabelle mit ihren Indizes, gemessen {when(d.tables.at)} ({dur(d.tables.seconds)}).{d.tables.free?` Freie Seiten in der Datei: ${gb(d.tables.free)} (werden bei neuen Daten wieder genutzt).`:''}</p>
    <Bars rows={d.tables.list.slice(0,15).map(t=>({key:t.name,label:t.name,bytes:t.bytes}))}/>
    {d.tables.list.length>15&&<p className="mt-2 text-[14px] text-slate-500">Weitere {n(d.tables.list.length-15)} Tabellen zusammen {gb(d.tables.list.slice(15).reduce((a,t)=>a+t.bytes,0))}.</p>}
   </>:<p className="mt-1 text-[14px] text-slate-500">Noch nicht gemessen (einmal am Tag oder mit „Mit Tabellen neu messen“).</p>}
  </section>

  <section className="mt-12" aria-label="Sicherungen">
   <h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name="shield" className="text-teal-600"/>Sicherungen</h2>
   <p className="mt-1 max-w-[820px] text-[14px] text-slate-500">Nächtliche Kopie der Datenbank, geprüft und mit zstd gepackt (Job „Datensicherung“, <Link href={adminHref('zeitplaene')} className="text-teal-600">Jobs & Zeitpläne →</Link>). Es liegen nie mehr als 2 Kopien auf der Platte: vor einer neuen wird die älteste gelöscht. Während einer neuen braucht die ungepackte Kopie vorübergehend so viel Platz wie die Datenbank. Programmstände sind keine Sicherung der Daten; sie kommen aus Git.</p>
   {d&&(d.backups.list.length?<ol className="m-0 mt-3 max-w-[820px] list-none border-t border-slate-200 p-0">
    {d.backups.list.map(b=><li key={b.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-slate-200 py-2.5 text-[14px] sm:grid-cols-[minmax(0,1fr)_140px_90px]">
     <span className="min-w-0 break-all">{b.name}{b.kind!=='Datenbank'&&<span className="ml-2 text-[12px] text-slate-500">{b.kind}</span>}</span>
     <span className="tabular-nums text-slate-500 max-sm:order-3">{when(b.at)}</span>
     <b className="text-right font-semibold tabular-nums">{gb(b.bytes)}</b>
    </li>)}
   </ol>:<p className="mt-3 flex gap-2 text-[14px] font-medium text-slate-900"><Icon name="alert" size={18}/>Keine Sicherung gefunden in {d.backups.dir}.</p>)}
   {d&&dbBackups.length>0&&<p className="mt-2 text-[14px] text-slate-700">{n(dbBackups.length)} Datenbank-{dbBackups.length===1?'Kopie':'Kopien'}, zusammen {gb(dbBackups.reduce((a,b)=>a+b.bytes,0))}; neueste vom {when(dbBackups[0].at)}.{dbBackups[0].at&&Date.now()-Date.parse(dbBackups[0].at)>36*3600000?' Älter als anderthalb Tage: Job „Datensicherung“ prüfen.':''}</p>}
   {d&&d.backups.env.length>0&&<p className="mt-2 text-[14px] text-slate-500">Dazu {n(d.backups.env.length)} Sicherungen der Einstellungsdatei (zusammen {gb(d.backups.env.reduce((a,b)=>a+b.bytes,0))}).</p>}
  </section>

  <section className="mt-12" aria-label="PDF-Ablage">
   <h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name="file" className="text-teal-600"/>PDF-Ablage</h2>
   <p className="mt-1 max-w-[820px] text-[14px] text-slate-500">Original-PDFs und ihre Textfassungen, feste Grenze {d?.pdfStore?.budgetGb??100} GB (<Link href={adminHref('pdf')} className="text-teal-600">PDF-Import →</Link>). Aufteilung aus dessen letzter Zählung{d?.pdfStore?.at?` (${when(d.pdfStore.at)})`:''}.</p>
   {d?.pdfStore&&<Bars rows={[{key:'p',label:'PDFs der Hauptdokumente',bytes:d.pdfStore.pdfPrimary||0},{key:'o',label:'PDFs der übrigen Dokumente',bytes:d.pdfStore.pdfOthers||0},{key:'t',label:'Textfassungen',bytes:d.pdfStore.text||0},{key:'i',label:'Verzeichnis (index.sqlite)',bytes:d.pdfStore.index}]}/>}
  </section>

  <section className="mt-12" aria-label="Programmstände und Werkzeuge">
   <h2 className="flex items-center gap-2 text-[22px] font-semibold"><Icon name="box" className="text-teal-600"/>Programmstände und Werkzeuge</h2>
   <p className="mt-1 max-w-[820px] text-[14px] text-slate-500">Jedes Ausrollen legt einen Programmstand an; behalten werden der neueste und die zwei davor (zum Zurückgehen). Ein Stand, den ein laufender Job noch nutzt, bleibt bis zum nächsten Ausrollen.</p>
   {d&&(d.releases.length?<Bars rows={d.releases.map(r=>({key:r.name,label:r.name,bytes:r.bytes,note:(r.current?'läuft · ':'')+when(r.at)}))}/>:<p className="mt-3 text-[14px] text-slate-500">Keine Programmstände gefunden (lokal gibt es keine).</p>)}
   {d&&d.ocr.length>0&&<Bars rows={d.ocr.map(x=>({key:x.label,label:x.label,bytes:x.bytes,note:`${n(x.files)} Dateien`}))}/>}
  </section>
 </>;
}
