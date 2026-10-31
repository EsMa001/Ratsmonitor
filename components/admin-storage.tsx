'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {AdminPageHead,Befund,Zahlen,Abschnitt,Hinweis,Fehler,Laden,Leer,SteuernLink} from '@/components/admin-ui';
import {adminHref} from '@/components/admin-chrome';
import {Icon} from '@/components/admin-icons';
import {n,gb,size,when,dur} from '@/components/admin-format';

/* Reiter „Speicher & Sicherungen“ (server/integrations/server-storage.mjs, Route /api/admin/speicher): was auf der Festplatte
   des Servers wie viel Platz belegt und welche Sicherungen es gibt. Gemessen von scripts/server-disk.mjs auf dem Server. */
type F={name:string;bytes:number;at?:string|null;kind?:string;files?:number;current?:boolean};
type Disk={at:string;seconds:number;disk:{total:number;free:number;used:number}|null;
 parts:{database:number;pdfStore:number;backups:number;releases:number;ocr:number;other:number|null};
 database:{files:F[]};pdfStore:{dir:string;pdfPrimary:number|null;pdfOthers:number;text:number|null;index:number;docIndex?:number;bytes:number;at:string|null;budgetGb:number|null}|null;
 backups:{dir:string;list:F[];env:F[]};releases:F[];ocr:{label:string;dir:string;bytes:number;files:number}[];
 tables:{at:string;seconds:number;free:number;list:{name:string;bytes:number}[]}|null};
type Data={disk:Disk|null;count:{requestedAt:string;tables:boolean;startedAt?:string;finishedAt?:string}|null;worker:boolean;error?:string};
const PARTS:[keyof Disk['parts'],string,string,string][]=[['database','Datenbank','bg-teal-700','database'],['pdfStore','PDF-Ablage','bg-teal-300','file'],['backups','Sicherungen','bg-sky-800','shield'],['releases','Programmstände','bg-sky-300','box'],['ocr','OCR-Werkzeuge','bg-slate-400','cpu'],['other','System und Sonstiges','bg-slate-200','drive']];
const LOW=20*1073741824;
/** Grenzen wie die tägliche Betriebsprüfung (OPS_DEFAULTS in server/integrations/ops-check.mjs) */
const BACKUP_HOURS=36,DISK_PERCENT=85;

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
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState('');
 // Zeitpunkt, zu dem die Seite geöffnet wurde (beim Rendern kein Date.now())
 const [openedAt]=useState(()=>Date.now());
 const load=useCallback(async()=>{
  try{const r=await fetch('/api/admin/speicher',{cache:'no-store'});const d=await r.json() as Data;if(!r.ok)throw Error(d.error||'Die Messung konnte nicht geladen werden.');setData(d);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Die Messung konnte nicht geladen werden.');}
 },[]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Abruf beim Öffnen; State wird erst nach dem await gesetzt
 useEffect(()=>{load();},[load]);
 const pending=!!data?.count&&!data.count.finishedAt;
 useEffect(()=>{if(!pending)return;const t=setInterval(load,30000);return ()=>clearInterval(t);},[pending,load]);
 const d=data?.disk,disk=d?.disk;
 const dbMain=d?.database.files.find(f=>f.kind==='Datenbank')?.bytes||0,dbBackups=d?.backups.list.filter(b=>!!b.kind?.startsWith('Datenbank'))||[];
 // In der Liste nur Datenbankkopien (auch ungepackte und unfertige); Protokolle und Skripte im Ordner nur als Summe
 const copies=d?.backups.list.filter(b=>b.kind!=='Sonstiges')||[],rest=d?.backups.list.filter(b=>b.kind==='Sonstiges')||[];
 const usedPct=disk?disk.used/disk.total*100:0,newest=dbBackups[0]?.at,backupOld=!newest||openedAt-Date.parse(newest)>BACKUP_HOURS*3600000;
 const warn=[disk&&usedPct>=DISK_PERCENT&&`Die Platte ist zu ${Math.round(usedPct)} % belegt`,disk&&disk.free<LOW&&'unter 20 GB frei',disk&&dbMain&&disk.free<=dbMain*1.5&&'der Platz für die nächste Sicherung ist knapp',d&&backupOld&&(newest?`die letzte Sicherung ist älter als ${BACKUP_HOURS} Stunden`:'es gibt keine Sicherung')].filter(Boolean) as string[];
 const befund=!d?null:warn.length?warn.join(', ').replace(/^./,c=>c.toUpperCase())+'.':`Der Platz reicht: ${gb(disk?.free)} frei, die letzte Sicherung ist vom ${when(newest)}.`;
 return <>
  <AdminPageHead page="speicher" figure={disk?{value:gb(disk.free),label:'frei',note:`von ${gb(disk.total)}`}:undefined}/>
  {error&&<Fehler onRetry={load}>{error}</Fehler>}
  {!data&&!error&&<Laden/>}
  {data&&!d&&<Leer>Noch keine Messung: sie entsteht beim nächsten Aufruf des Jobs „PDF-Aufträge und Messungen“.</Leer>}
  {d&&<>
   <Befund stand={<>Gemessen {when(d.at)} ({dur(d.seconds)}){pending?' · Messung angefordert':''} · <SteuernLink job="pdf-job" label="Neu messen in der Steuerung"/></>}>{befund}</Befund>
   {data&&!data.worker&&<Hinweis>Auf diesem Rechner misst niemand (kein Lebenszeichen des Server-Dienstes in den letzten 20 Minuten). Die Zahlen sind die der letzten Messung.</Hinweis>}
   <Zahlen items={[{value:disk?`${Math.round(usedPct)} %`:'–',label:'belegt'},{value:gb(dbMain),label:'Datenbank'},{value:n(dbBackups.length),label:dbBackups.length===1?'Sicherung':'Sicherungen'},{value:gb(d.parts.pdfStore),label:'PDF-Ablage',href:adminHref('pdf')}]}/>

   <Abschnitt title="Festplatte" sub={dbMain?`Wofür der Platz gebraucht wird. Eine Sicherung braucht vorübergehend etwa ${gb(dbMain)} für die ungepackte Kopie, dazu die gepackte.`:'Wofür der Platz gebraucht wird.'}>
    {disk&&<div className="mt-4 max-w-[980px]">
     <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-50" role="img" aria-label={PARTS.map(([k,l])=>`${l} ${gb(d.parts[k])}`).join(', ')+`, frei ${gb(disk.free)}`}>
      {PARTS.map(([k,,c])=>(d.parts[k]||0)>0?<i key={k} className={'block h-full '+c} style={{width:`${(d.parts[k]||0)/disk.total*100}%`}}/>:null)}
     </div>
     <ul className="m-0 mt-4 grid list-none gap-x-8 gap-y-2 p-0 text-[14px] sm:grid-cols-2 lg:grid-cols-3">
      {PARTS.map(([k,l,c,icon])=><li key={k} className="flex items-center gap-2"><i className={'inline-block h-2.5 w-2.5 shrink-0 rounded-sm '+c}/><Icon name={icon} size={16} className="text-slate-500"/><span className="min-w-0 flex-1">{l}</span><b className="font-semibold tabular-nums">{gb(d.parts[k])}</b></li>)}
      <li className="flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-slate-200 bg-slate-50"/><Icon name="check" size={16} className="text-slate-500"/><span className="min-w-0 flex-1">frei</span><b className="font-semibold tabular-nums">{gb(disk.free)}</b></li>
     </ul>
    </div>}
   </Abschnitt>

   <Abschnitt id="speicher-db" open={false} title="Datenbank" sub="Eine Datei mit allen Berichten, Suchkarten, Auswertungen und Einstellungen, dazu das Schreibprotokoll (WAL). Mit den größten Tabellen.">
   {<Bars rows={d.database.files.map(f=>({key:f.name,label:f.name,bytes:f.bytes,note:f.kind}))}/>}
   {d?.database.files.some(f=>f.kind==='Übrig geblieben')&&<p className="mt-2 max-w-[820px] text-[14px] text-slate-500">„Übrig geblieben“: Nebendateien einer früheren Datenbankdatei gleichen Namens; sie gehören zu keiner laufenden Datenbank. Löschen nur nach Prüfung auf dem Server.</p>}
   <h3 className="mt-8 text-[16px] font-semibold">Größte Tabellen</h3>
   {d?.tables?<>
    <p className="mt-1 text-[14px] text-slate-500">Je Tabelle mit ihren Indizes, gemessen {when(d.tables.at)} ({dur(d.tables.seconds)}).{d.tables.free?` Freie Seiten in der Datei: ${gb(d.tables.free)} (werden bei neuen Daten wieder genutzt).`:''}</p>
    <Bars rows={d.tables.list.slice(0,15).map(t=>({key:t.name,label:t.name,bytes:t.bytes}))}/>
    {d.tables.list.length>15&&<p className="mt-2 text-[14px] text-slate-500">Weitere {n(d.tables.list.length-15)} Tabellen zusammen {gb(d.tables.list.slice(15).reduce((a,t)=>a+t.bytes,0))}.</p>}
   </>:<p className="mt-1 text-[14px] text-slate-500">Noch nicht gemessen (einmal am Tag oder mit „Mit Tabellen neu messen“).</p>}
   </Abschnitt>

   <Abschnitt title="Sicherungen" sub={<>Nächtliche Kopie der Datenbank, geprüft und mit zstd gepackt (Job „Sichern“, <Link href={adminHref('steuerung')} className="text-teal-600">Jobs & Zeitpläne →</Link>). Es liegen nie mehr als 2 Kopien auf der Platte: vor einer neuen wird die älteste gelöscht. Während einer neuen braucht die ungepackte Kopie vorübergehend so viel Platz wie die Datenbank. Programmstände sind keine Sicherung der Daten; sie kommen aus Git.</>}>
   {d&&(copies.length?<ol className="m-0 mt-3 max-w-[820px] list-none border-t border-slate-200 p-0">
    {copies.map(b=><li key={b.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-slate-200 py-2.5 text-[14px] sm:grid-cols-[minmax(0,1fr)_140px_90px]">
     <span className="min-w-0 break-all">{b.name}{b.kind!=='Datenbank'&&<span className="ml-2 text-[12px] text-slate-500">{b.kind}</span>}</span>
     <span className="tabular-nums text-slate-500 max-sm:order-3">{when(b.at)}</span>
     <b className="text-right font-semibold tabular-nums">{size(b.bytes)}</b>
    </li>)}
   </ol>:<p className="mt-3 flex gap-2 text-[14px] font-medium text-slate-900"><Icon name="alert" size={18}/>Keine Sicherung gefunden in {d.backups.dir}.</p>)}
   {d&&dbBackups.length>0&&<p className="mt-2 text-[14px] text-slate-700">{n(dbBackups.length)} Datenbank-{dbBackups.length===1?'Kopie':'Kopien'}, zusammen {gb(dbBackups.reduce((a,b)=>a+b.bytes,0))}; neueste vom {when(dbBackups[0].at)}.{dbBackups[0].at&&openedAt-Date.parse(dbBackups[0].at)>36*3600000?' Älter als anderthalb Tage: Job „Sichern“ prüfen.':''}</p>}
   {d&&rest.length>0&&<p className="mt-2 text-[14px] text-slate-500">Dazu {n(rest.length)} weitere Dateien im Ordner (Protokolle, Skripte), zusammen {size(rest.reduce((a,b)=>a+b.bytes,0))}.</p>}
   {d&&d.backups.env.length>0&&<p className="mt-2 text-[14px] text-slate-500">Dazu {n(d.backups.env.length)} Sicherungen der Einstellungsdatei (zusammen {gb(d.backups.env.reduce((a,b)=>a+b.bytes,0))}).</p>}
   </Abschnitt>

   <Abschnitt id="speicher-pdf" open={false} title="PDF-Ablage" sub={<>Original-PDFs und ihre Textfassungen, feste Grenze {d?.pdfStore?.budgetGb??80} GB (<Link href={adminHref('pdf')} className="text-teal-600">PDF-Import →</Link>). Aufteilung aus dessen letzter Zählung{d?.pdfStore?.at?` (${when(d.pdfStore.at)})`:''}.</>}>
   {d?.pdfStore&&<Bars rows={[{key:'p',label:'PDFs der Hauptdokumente',bytes:d.pdfStore.pdfPrimary||0},{key:'o',label:'PDFs der übrigen Dokumente',bytes:d.pdfStore.pdfOthers||0},{key:'t',label:'Textfassungen',bytes:d.pdfStore.text||0},{key:'i',label:'Verzeichnis (index.sqlite)',bytes:d.pdfStore.index},{key:'f',label:'Dokumentindex (fts.sqlite, nicht gesichert)',bytes:d.pdfStore.docIndex||0}]}/>}
   </Abschnitt>

   <Abschnitt id="speicher-programm" open={false} title="Programmstände und Werkzeuge" sub="Jedes Ausrollen legt einen Programmstand an; behalten werden der neueste und die zwei davor (zum Zurückgehen). Ein Stand, den ein laufender Job noch nutzt, bleibt bis zum nächsten Ausrollen.">
   {d&&(d.releases.length?<Bars rows={d.releases.map(r=>({key:r.name,label:r.name,bytes:r.bytes,note:(r.current?'läuft · ':'')+when(r.at)}))}/>:<p className="mt-3 text-[14px] text-slate-500">Keine Programmstände gefunden (lokal gibt es keine).</p>)}
   {d&&d.ocr.length>0&&<Bars rows={d.ocr.map(x=>({key:x.label,label:x.label,bytes:x.bytes,note:`${n(x.files)} Dateien`}))}/>}
   </Abschnitt>
  </>}
 </>;
}

/** Messung für die Steuerung: Platz neu messen, auf Wunsch mit den Tabellen der Datenbank (einige Minuten). Ausgeführt vom Job
    „PDF-Aufträge und Messungen“; die Seite „Speicher & Sicherungen“ liest nur. */
export function SpeicherSteuern(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  try{const r=await fetch('/api/admin/speicher',{cache:'no-store'});const d=await r.json() as Data;if(!r.ok)throw Error(d.error||'Die Messung konnte nicht geladen werden.');setData(d);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Die Messung konnte nicht geladen werden.');}
 },[]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Abruf beim Öffnen; State wird erst nach dem await gesetzt
 useEffect(()=>{load();},[load]);
 const pending=!!data?.count&&!data.count.finishedAt;
 useEffect(()=>{if(!pending)return;const t=setInterval(load,30000);return ()=>clearInterval(t);},[pending,load]);
 const measure=async(tables:boolean)=>{
  setBusy(true);
  try{const r=await fetch('/api/admin/speicher',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'count',tables})});const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||'Das ging nicht.');await load();}
  catch(e){setError(e instanceof Error?e.message:'Das ging nicht.');}
  finally{setBusy(false);}
 };
 const side='text-[14px] font-medium text-teal-700 hover:text-teal-600 disabled:opacity-40',row='grid gap-1 border-b border-slate-200 py-3 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-baseline md:gap-4';
 return <div className="mt-6 max-w-[1100px] text-[14px]">
  <h3 className="m-0 text-[16px] font-semibold">Speicher messen</h3>
  <p className="m-0 mt-1 text-slate-500">{data?.disk?`Zuletzt gemessen ${when(data.disk.at)}.`:'Noch keine Messung.'} <Link href={adminHref('speicher')} className="text-teal-700">Stand ansehen →</Link></p>
  {error&&<Fehler onRetry={load}>{error}</Fehler>}
  {data&&!data.worker&&<Hinweis>Kein Lebenszeichen des Server-Dienstes in den letzten 20 Minuten; Messen ist gesperrt.</Hinweis>}
  <ul className="m-0 mt-2 list-none border-t border-slate-200 p-0">
   <li className={row}><span className="font-semibold">Neu messen</span><span className="text-slate-700">Platte, Datenbank, Sicherungen, PDF-Ablage und Programmstände.</span>
    <button type="button" className={side} disabled={busy||pending||!data?.worker} onClick={()=>void measure(false)}>{pending?(data?.count?.startedAt?'wird gemessen …':'angefordert …'):'anfordern →'}</button></li>
   <li className={row}><span className="font-semibold">Mit Tabellen messen</span><span className="text-slate-700">Dazu die Größe jeder Tabelle der Datenbank; dauert einige Minuten.</span>
    <button type="button" className={side} disabled={busy||pending||!data?.worker} onClick={()=>void measure(true)}>anfordern →</button></li>
  </ul>
 </div>;
}
